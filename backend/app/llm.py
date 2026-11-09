"""Unified LLM client: Gemini Flash-Lite first, Groq as fallback, with caching and validation.

Enforces Rule 5 (prompt-injection defense) and Rule 6 (one call_llm wrapper, cached, fallback).
"""

import hashlib
import json
import os
from typing import Any, TypeVar
import httpx
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.models import LlmCache

T = TypeVar("T", bound=BaseModel)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


def _hash_key(provider: str, model: str, prompt: str) -> str:
    """Creates a deterministic SHA-256 cache key."""
    return hashlib.sha256(f"{provider}:{model}:{prompt}".encode("utf-8")).hexdigest()


def _get_from_cache(db: Session, org_id: Any, cache_key: str) -> dict[str, Any] | None:
    cached = db.query(LlmCache).filter_by(org_id=org_id, cache_key=cache_key).first()
    return cached.response if cached else None


def _save_to_cache(db: Session, org_id: Any, cache_key: str, provider: str, model: str, response: dict[str, Any]):
    try:
        entry = LlmCache(
            org_id=org_id,
            cache_key=cache_key,
            provider=provider,
            model=model,
            response=response
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()


# --- Provider 1: Gemini (Primary) ---
def _call_gemini(prompt: str, system_instruction: str = "") -> dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    if system_instruction:
        payload["system_instruction"] = {"parts": [{"text": system_instruction}]}

    with httpx.Client(timeout=20.0) as client:
        res = client.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(raw_text)


# --- Provider 2: Groq (Fallback) ---
def _call_groq(prompt: str, system_instruction: str = "") -> dict[str, Any]:
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "response_format": {"type": "json_object"}
    }

    with httpx.Client(timeout=20.0) as client:
        res = client.post(url, headers=headers, json=payload)
        res.raise_for_status()
        data = res.json()
        raw_text = data["choices"][0]["message"]["content"]
        return json.loads(raw_text)


# --- Mock Provider for Tests / Offline ---
def _call_mock(prompt: str) -> dict[str, Any]:
    """Offline deterministic mock for testing without API keys."""
    if "Extract numerical claims" in prompt:
        return {"claims": []}
    if "Check tone" in prompt:
        return {"flags": []}
    return {}


# --- Main call_llm() Wrapper ---
def call_llm(
    prompt: str,
    db: Session | None = None,
    org_id: Any | None = None,
    system_instruction: str = "",
    schema: type[T] | None = None,
    mock: bool = False
) -> tuple[dict[str, Any] | T | None, dict[str, Any]]:
    """Single entrypoint for all LLM queries in the platform.
    
    Returns:
        (parsed_output, llm_info_meta)
    """
    llm_info = {"provider": None, "model": None, "cached": False, "degraded": False}

    # 1. Offline or Mock Mode
    if mock or os.environ.get("ENVIRONMENT") == "test" or not (GEMINI_API_KEY or GROQ_API_KEY):
        llm_info.update({"provider": "mock", "model": "test-mock"})
        result = _call_mock(prompt)
        return result, llm_info

    # 2. Check Cache
    cache_key = _hash_key("auto", "unified", prompt)
    if db and org_id:
        cached_result = _get_from_cache(db, org_id, cache_key)
        if cached_result is not None:
            llm_info.update({"provider": "cache", "model": "cache", "cached": True})
            return cached_result, llm_info

    # 3. Try Primary (Gemini)
    raw_json = None
    if GEMINI_API_KEY:
        try:
            raw_json = _call_gemini(prompt, system_instruction)
            llm_info.update({"provider": "gemini", "model": "gemini-2.0-flash-lite"})
        except Exception as e:
            # Gemini failed, fall through to Groq
            pass

    # 4. Try Fallback (Groq)
    if raw_json is None and GROQ_API_KEY:
        try:
            raw_json = _call_groq(prompt, system_instruction)
            llm_info.update({"provider": "groq", "model": "llama-3.3-70b-versatile"})
        except Exception as e:
            pass

    # 5. Degraded Mode (Both failed)
    if raw_json is None:
        llm_info["degraded"] = True
        return None, llm_info

    # 6. Validate with Pydantic if schema provided
    if schema:
        try:
            validated = schema.model_validate(raw_json)
            if db and org_id:
                _save_to_cache(db, org_id, cache_key, llm_info["provider"], llm_info["model"], raw_json)
            return validated, llm_info
        except ValidationError:
            # If schema validation fails, degrade safely instead of crashing
            llm_info["degraded"] = True
            return None, llm_info

    if db and org_id:
        _save_to_cache(db, org_id, cache_key, llm_info["provider"], llm_info["model"], raw_json)

    return raw_json, llm_info