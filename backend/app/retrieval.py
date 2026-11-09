"""Search over the knowledge base: the queries behind the AI engine's retrieval step.

Every function takes org_id first and filters by it. The caller passes the query's
embedding (from fastembed); this module never calls an embedding model itself, so it
can be tested with plain vectors.

Two ways to find a rule or fact:
  * by meaning: pgvector cosine distance (nearest_rules / nearest_facts)
  * by keywords: Postgres full-text search (keyword_rules / keyword_facts)
retrieve_rules / retrieve_facts merge both lists (reciprocal rank fusion), because
meaning search alone can miss an exact term and keyword search alone can miss a paraphrase.
"""

from collections.abc import Sequence
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from .db import scoped
from .models import ApprovedFact, GlossaryTerm, GuidelineRule

Vec = Sequence[float]


# --- rules ---------------------------------------------------------------------------


def nearest_rules(
    db: Session, org_id: UUID, query_vec: Vec, k: int = 5, category: str | None = None
) -> list[tuple[GuidelineRule, float]]:
    """Closest rules by meaning. Returns (rule, cosine distance); smaller distance = closer."""
    dist = GuidelineRule.embedding.cosine_distance(query_vec).label("distance")
    stmt = scoped(GuidelineRule, org_id).add_columns(dist).where(GuidelineRule.embedding.is_not(None))
    if category:
        stmt = stmt.where(GuidelineRule.category == category)
    rows = db.execute(stmt.order_by(dist).limit(k)).all()
    return [(r[0], float(r[1])) for r in rows]


def keyword_rules(db: Session, org_id: UUID, query: str, k: int = 5, category: str | None = None) -> list[GuidelineRule]:
    tsq = func.plainto_tsquery("english", query)
    stmt = scoped(GuidelineRule, org_id).where(GuidelineRule.tsv.op("@@")(tsq))
    if category:
        stmt = stmt.where(GuidelineRule.category == category)
    return list(db.execute(stmt.order_by(func.ts_rank(GuidelineRule.tsv, tsq).desc()).limit(k)).scalars())


def retrieve_rules(
    db: Session, org_id: UUID, query: str, query_vec: Vec, k: int = 5, category: str | None = None
) -> list[GuidelineRule]:
    semantic = [r for r, _ in nearest_rules(db, org_id, query_vec, k * 2, category)]
    keyword = keyword_rules(db, org_id, query, k * 2, category)
    return _fuse([semantic, keyword])[:k]


# --- facts ---------------------------------------------------------------------------


def nearest_facts(db: Session, org_id: UUID, query_vec: Vec, k: int = 5) -> list[tuple[ApprovedFact, float]]:
    dist = ApprovedFact.embedding.cosine_distance(query_vec).label("distance")
    stmt = scoped(ApprovedFact, org_id).add_columns(dist).where(ApprovedFact.embedding.is_not(None))
    rows = db.execute(stmt.order_by(dist).limit(k)).all()
    return [(r[0], float(r[1])) for r in rows]


def keyword_facts(db: Session, org_id: UUID, query: str, k: int = 5) -> list[ApprovedFact]:
    tsq = func.plainto_tsquery("english", query)
    stmt = scoped(ApprovedFact, org_id).where(ApprovedFact.tsv.op("@@")(tsq))
    return list(db.execute(stmt.order_by(func.ts_rank(ApprovedFact.tsv, tsq).desc()).limit(k)).scalars())


def retrieve_facts(db: Session, org_id: UUID, query: str, query_vec: Vec, k: int = 5) -> list[ApprovedFact]:
    semantic = [f for f, _ in nearest_facts(db, org_id, query_vec, k * 2)]
    keyword = keyword_facts(db, org_id, query, k * 2)
    return _fuse([semantic, keyword])[:k]


def lookup_facts(db: Session, org_id: UUID, entity: str, attribute: str) -> list[ApprovedFact]:
    """Exact lookup (case ignored) once the LLM has extracted entity and attribute from a claim.

    The claim checker then compares value_num and unit in plain Python. The LLM never
    decides whether two numbers agree. Facts with no end date come first, then the
    most recently valid ones.
    """
    stmt = (
        scoped(ApprovedFact, org_id)
        .where(func.lower(ApprovedFact.entity) == entity.strip().lower())
        .where(func.lower(ApprovedFact.attribute) == attribute.strip().lower())
        .order_by(ApprovedFact.valid_to.desc().nulls_first())
    )
    return list(db.execute(stmt).scalars())


def is_outdated(fact: ApprovedFact, today: date | None = None) -> bool:
    """Freshness check: a fact past its valid_to date counts as outdated."""
    return fact.valid_to is not None and fact.valid_to < (today or date.today())


# --- glossary ------------------------------------------------------------------------


def glossary_terms(db: Session, org_id: UUID, kind: str | None = None) -> list[GlossaryTerm]:
    """All terms for the terminology checker (plain code matches them against the text)."""
    stmt = scoped(GlossaryTerm, org_id).order_by(func.lower(GlossaryTerm.term))
    if kind:
        stmt = stmt.where(GlossaryTerm.kind == kind)
    return list(db.execute(stmt).scalars())


# --- helpers -------------------------------------------------------------------------


def _fuse(rankings: list[list[Any]], c: int = 60) -> list[Any]:
    """Reciprocal rank fusion: an item near the top of either list ends up near the top."""
    scores: dict[Any, float] = {}
    items: dict[Any, Any] = {}
    for ranking in rankings:
        for rank, item in enumerate(ranking):
            scores[item.id] = scores.get(item.id, 0.0) + 1.0 / (c + rank + 1)
            items[item.id] = item
    return [items[i] for i in sorted(scores, key=lambda i: scores[i], reverse=True)]
