"""Scan execution, polling, findings review, decisions, and insights endpoints."""

from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db, scoped
from app.models import Finding, ScanJob, User
from app.scan import execute_scan
from app.workflow import (
    InvalidState, NotFound, brand_drift_analytics, decide_finding, latest_scan,
    latest_version, rule_stats, scan_counts, start_scan
)

router = APIRouter(tags=["scans"])


# --- Trigger & Poll Scan ---
@router.post("/documents/{document_id}/scans")
def trigger_scan(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        job = start_scan(db, current_user.org_id, document_id, current_user.id)
        background_tasks.add_task(execute_scan, job.id, current_user.org_id, job.version_id)
        return {"scan_job_id": str(job.id), "status": job.status, "progress": job.progress}
    except InvalidState as e:
        raise HTTPException(status_code=409, detail=str(e))
    except NotFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/scans/{scan_id}")
def poll_scan(scan_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.execute(scoped(ScanJob, current_user.org_id).where(ScanJob.id == scan_id)).scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found")

    counts = scan_counts(db, current_user.org_id, scan_id)
    return {
        "id": str(job.id),
        "status": job.status,
        "progress": job.progress,
        "error": job.error,
        "counts": counts
    }


# --- Findings & Review Decisions ---
@router.get("/documents/{document_id}/findings")
def get_findings(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    version = latest_version(db, current_user.org_id, document_id)
    if not version:
        return []
    scan = latest_scan(db, current_user.org_id, version.id)
    if not scan:
        return []

    findings = list(
        db.execute(
            scoped(Finding, current_user.org_id)
            .where(Finding.scan_job_id == scan.id)
            .order_by(Finding.span_start.nulls_last())
        ).scalars()
    )

    return [
        {
            "id": str(f.id),
            "block_id": str(f.block_id),
            "layer": f.layer,
            "severity": f.severity,
            "verdict": f.verdict,
            "span_start": f.span_start,
            "span_end": f.span_end,
            "quoted_text": f.quoted_text,
            "explanation": f.explanation,
            "suggested_fix": f.suggested_fix,
            "citation": f.citation,
            "status": f.status,
            "final_text": f.final_text
        }
        for f in findings
    ]


class DecisionRequest(BaseModel):
    decision: str  # accepted | edited | rejected | open
    final_text: str | None = None


@router.patch("/findings/{finding_id}/decision")
def review_decision(
    finding_id: UUID,
    payload: DecisionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        finding = decide_finding(
            db=db,
            org_id=current_user.org_id,
            finding_id=finding_id,
            user_id=current_user.id,
            decision=payload.decision,
            final_text=payload.final_text
        )
        return {"id": str(finding.id), "status": finding.status, "final_text": finding.final_text}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except (NotFound, InvalidState) as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- Insights & Analytics ---
@router.get("/insights/rules")
def get_rule_insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return rule_stats(db, current_user.org_id)


@router.get("/insights/brand-drift")
def get_brand_drift_insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Executive Brand Drift Analytics: Top violated rules, fatigue alerts, and health metrics."""
    return brand_drift_analytics(db, current_user.org_id)


