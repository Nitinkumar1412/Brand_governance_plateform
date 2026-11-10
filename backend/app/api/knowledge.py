"""Knowledge Base endpoints: Guidelines, Glossary, and Approved Facts."""

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db import get_db, scoped
from app.embeddings import embed_text
from app.models import ApprovedFact, GlossaryTerm, GuidelineDocument, GuidelineRule, User

router = APIRouter(tags=["knowledge"])


# --- Guidelines / Rules ---
@router.get("/rules")
def list_rules(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rules = db.execute(scoped(GuidelineRule, current_user.org_id).order_by(GuidelineRule.code)).scalars().all()
    return [
        {
            "id": str(r.id),
            "code": r.code,
            "category": r.category,
            "title": r.title,
            "body": r.body,
            "severity": r.severity,
            "page": r.page
        }
        for r in rules
    ]


class CreateRuleRequest(BaseModel):
    code: str
    category: str
    title: str
    body: str
    severity: str = "medium"
    page: int | None = None


@router.post("/rules")
def create_rule(
    payload: CreateRuleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage guideline rules")

    # Ensure a guideline document exists
    doc = db.query(GuidelineDocument).filter_by(org_id=current_user.org_id).first()
    if not doc:
        doc = GuidelineDocument(org_id=current_user.org_id, title="Brand Guidelines", version="1.0")
        db.add(doc)
        db.flush()

    vec = embed_text(f"{payload.title}: {payload.body}")
    rule = GuidelineRule(
        org_id=current_user.org_id,
        guideline_id=doc.id,
        code=payload.code,
        category=payload.category,
        title=payload.title,
        body=payload.body,
        severity=payload.severity,
        page=payload.page,
        embedding=vec
    )
    db.add(rule)
    db.commit()
    return {"id": str(rule.id), "code": rule.code}


# --- Glossary ---
@router.get("/glossary")
def list_glossary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    terms = db.execute(scoped(GlossaryTerm, current_user.org_id).order_by(GlossaryTerm.term)).scalars().all()
    return [
        {"id": str(t.id), "term": t.term, "kind": t.kind, "replacement": t.replacement, "note": t.note}
        for t in terms
    ]


class CreateGlossaryRequest(BaseModel):
    term: str
    kind: str  # approved | forbidden
    replacement: str | None = None
    note: str | None = None


@router.post("/glossary")
def create_glossary_term(
    payload: CreateGlossaryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage glossary")

    term = GlossaryTerm(
        org_id=current_user.org_id,
        term=payload.term,
        kind=payload.kind,
        replacement=payload.replacement,
        note=payload.note
    )
    db.add(term)
    db.commit()
    return {"id": str(term.id), "term": term.term}


# --- Facts ---
class CreateFactRequest(BaseModel):
    entity: str
    attribute: str
    statement: str
    value_num: float | None = None
    value_text: str | None = None
    unit: str | None = None
    source_name: str = "Brand Guidelines"
    source_page: int | None = 1


@router.get("/facts")
def list_facts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    facts = db.execute(scoped(ApprovedFact, current_user.org_id).order_by(ApprovedFact.entity)).scalars().all()
    return [
        {
            "id": str(f.id),
            "entity": f.entity,
            "attribute": f.attribute,
            "value_num": float(f.value_num) if f.value_num else None,
            "value_text": f.value_text,
            "unit": f.unit,
            "statement": f.statement,
            "valid_to": str(f.valid_to) if f.valid_to else None
        }
        for f in facts
    ]


@router.post("/facts")
def create_fact(
    payload: CreateFactRequest,
    current_user: User = Depends(require_roles(["admin"])),
    db: Session = Depends(get_db)
):
    """Admin-only endpoint to create verified facts for AI scan comparisons."""
    fact = ApprovedFact(
        org_id=current_user.org_id,
        entity=payload.entity.strip(),
        attribute=payload.attribute.strip(),
        statement=payload.statement.strip(),
        value_num=payload.value_num,
        value_text=payload.value_text.strip() if payload.value_text else None,
        unit=payload.unit.strip() if payload.unit else None,
        source_name=payload.source_name.strip() if payload.source_name else "Brand Guidelines",
        source_page=payload.source_page
    )
    db.add(fact)
    db.commit()
    db.refresh(fact)
    return {
        "id": str(fact.id),
        "entity": fact.entity,
        "attribute": fact.attribute,
        "statement": fact.statement
    }


