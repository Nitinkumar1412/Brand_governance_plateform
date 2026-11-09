"""Layer 1: Terminology Checker (Plain Python, No LLM).

Finds forbidden glossary terms using whole-word case-insensitive regex matching.
Provides character spans (span_start, span_end) and replacements (suggested_fix).
Enforces Challenge Rule 1 (Source or Silence) by linking to glossary_term_id.
"""

import re
from uuid import UUID
from sqlalchemy.orm import Session

from app.models import ContentBlock, Finding
from app.retrieval import glossary_terms


def check_terminology(
    db: Session,
    org_id: UUID,
    scan_job_id: UUID,
    blocks: list[ContentBlock]
) -> list[Finding]:
    """Scans blocks against forbidden glossary terms and returns findings."""
    terms = glossary_terms(db, org_id, kind="forbidden")
    if not terms:
        return []

    findings: list[Finding] = []

    for block in blocks:
        if not block.content:
            continue

        text = block.content
        for t in terms:
            # Word boundary regex with case-insensitive matching
            pattern = re.compile(rf"\b{re.escape(t.term)}\b", re.IGNORECASE)
            for match in pattern.finditer(text):
                start, end = match.span()
                matched_word = match.group()

                explanation = (
                    f"Forbidden term '{matched_word}' detected. "
                    f"Preferred replacement: '{t.replacement}'."
                    if t.replacement
                    else f"Forbidden term '{matched_word}' is discouraged by brand guidelines."
                )
                if t.note:
                    explanation += f" ({t.note})"

                finding = Finding(
                    org_id=org_id,
                    scan_job_id=scan_job_id,
                    block_id=block.id,
                    layer="terminology",
                    check_name="glossary_match",
                    severity="high" if t.term.lower() in ("inkloom max", "guaranteed") else "medium",
                    confidence=1.0,  # Deterministic code match = 100% confidence
                    span_start=start,
                    span_end=end,
                    quoted_text=matched_word,
                    explanation=explanation,
                    suggested_fix=t.replacement,
                    glossary_term_id=t.id,
                    citation=f"Glossary term: {t.term}",
                    status="open",
                )
                findings.append(finding)

    return findings

