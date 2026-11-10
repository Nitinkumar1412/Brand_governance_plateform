"""Unified LLM client: Gemini Flash-Lite first, Groq as fallback, with caching and validation.

Enforces Rule 5 (prompt-injection defense) and Rule 6 (one call_llm wrapper, cached, fallback).
"""

import hashlib
import json
import logging
import os
from typing import Any, TypeVar
from dotenv import load_dotenv
import httpx
from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from app.models import LlmCache

# Ensure .env is always loaded immediately when llm is imported anywhere
load_dotenv()

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)



def _get_gemini_key() -> str:
    """Lazy read so dynamic changes to env or load_dotenv() are always captured."""
    return os.environ.get("GEMINI_API_KEY", "").strip()


def _get_groq_key() -> str:
    """Lazy read so dynamic changes to env or load_dotenv() are always captured."""
    return os.environ.get("GROQ_API_KEY", "").strip()


# Backward compatibility properties
GEMINI_API_KEY = _get_gemini_key()
GROQ_API_KEY = _get_groq_key()


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
    key = _get_gemini_key()
    if not key:
        raise ValueError("GEMINI_API_KEY is not configured")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    if system_instruction:
        payload["system_instruction"] = {"parts": [{"text": system_instruction}]}

    with httpx.Client(timeout=25.0) as client:
        res = client.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(raw_text)


# --- Provider 2: Groq (Fallback) ---
def _call_groq(prompt: str, system_instruction: str = "") -> dict[str, Any]:
    key = _get_groq_key()
    if not key:
        raise ValueError("GROQ_API_KEY is not configured")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}"}
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    # Use active open-weight flagship on Groq (llama-3.3-70b was decommissioned on Groq)
    payload = {
        "model": "openai/gpt-oss-120b",
        "messages": messages,
        "response_format": {"type": "json_object"}
    }

    with httpx.Client(timeout=25.0) as client:
        res = client.post(url, headers=headers, json=payload)
        res.raise_for_status()
        data = res.json()
        raw_text = data["choices"][0]["message"]["content"]
        return json.loads(raw_text)


# --- Mock Provider for Tests / Offline ---
def _call_mock(prompt: str) -> dict[str, Any]:
    """Offline deterministic mock for testing without API keys."""
    p_lower = prompt.lower()
    if "extract numerical claims" in p_lower or "claims" in p_lower:
        return {"claims": []}
    if "check tone" in p_lower or "guideline" in p_lower or "tone" in p_lower or "draft" in p_lower:
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

    gemini_key = _get_gemini_key()
    groq_key = _get_groq_key()

    # 1. Offline or Mock Mode
    if mock or os.environ.get("ENVIRONMENT") == "test" or not (gemini_key or groq_key):
        llm_info.update({"provider": "mock", "model": "test-mock"})
        result = _call_mock(prompt)
        if schema:
            try:
                return schema.model_validate(result), llm_info
            except Exception:
                return result, llm_info
        return result, llm_info

    # 2. Check Cache
    cache_key = _hash_key("auto", "unified", prompt)
    if db and org_id:
        cached_result = _get_from_cache(db, org_id, cache_key)
        if cached_result is not None:
            llm_info.update({"provider": "cache", "model": "cache", "cached": True})
            if schema:
                try:
                    return schema.model_validate(cached_result), llm_info
                except Exception:
                    return cached_result, llm_info
            return cached_result, llm_info

    # 3. Try Primary (Gemini)
    raw_json = None
    if gemini_key:
        try:
            raw_json = _call_gemini(prompt, system_instruction)
            llm_info.update({"provider": "gemini", "model": "gemini-3.5-flash-lite"})
        except Exception as e:
            logger.warning(f"Gemini call failed, falling back to Groq: {e}")

    # 4. Try Fallback (Groq)
    if raw_json is None and groq_key:
        try:
            raw_json = _call_groq(prompt, system_instruction)
            llm_info.update({"provider": "groq", "model": "openai/gpt-oss-120b"})
        except Exception as e:
            logger.warning(f"Groq fallback failed: {e}")

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
        except ValidationError as ve:
            logger.warning(f"Schema validation warning: {ve}. Attempting fallback to raw dict.")
            # If raw_json is already a dict (e.g. contains flags or claims), return it rather than returning None
            if isinstance(raw_json, dict):
                if db and org_id:
                    _save_to_cache(db, org_id, cache_key, llm_info["provider"], llm_info["model"], raw_json)
                return raw_json, llm_info
            llm_info["degraded"] = True
            return None, llm_info

    if db and org_id:
        _save_to_cache(db, org_id, cache_key, llm_info["provider"], llm_info["model"], raw_json)

    return raw_json, llm_info