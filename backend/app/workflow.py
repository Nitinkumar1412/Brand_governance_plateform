"""Business actions on documents, scans and findings.

Each function is one action = one database transaction. It changes the rows, writes the
audit_log entry and commits, so a change and its log line are saved together or not at all.
Functions raise:
    NotFound      the row does not exist in this org (the API turns this into 404)
    InvalidState  the action is not allowed right now (409)
    ValueError    the input is wrong (422)
Who may do an action (admin / creator / reviewer) is checked by the API layer, not here.

Document status flow:
    draft -> scanning -> draft -> in_review -> approved
                                  in_review -> changes_requested -> (scan again) -> in_review
"""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.orm import Session

from .db import scoped
from .models import AuditLog, Document, DocumentVersion, Finding, ScanJob


class NotFound(Exception):
    pass


class InvalidState(Exception):
    pass


DECISIONS = ("accepted", "edited", "rejected")


def _now() -> datetime:
    return datetime.now(UTC)


# --- audit ---------------------------------------------------------------------------


def write_audit(
    db: Session,
    org_id: UUID,
    actor_id: UUID | None,
    action: str,
    entity_type: str,
    entity_id: UUID | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Adds a log line to the current transaction (the caller commits)."""
    db.add(
        AuditLog(
            org_id=org_id,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
        )
    )


def document_history(db: Session, org_id: UUID, document_id: UUID, limit: int = 200) -> list[AuditLog]:
    """Log lines for one document: its own actions plus decisions on its findings. Newest first."""
    _get_document(db, org_id, document_id)
    stmt = (
        scoped(AuditLog, org_id)
        .where(
            or_(
                and_(AuditLog.entity_type == "document", AuditLog.entity_id == document_id),
                AuditLog.details["document_id"].as_string() == str(document_id),
            )
        )
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
    )
    return list(db.execute(stmt).scalars())


# --- lookups -------------------------------------------------------------------------


def _get_document(db: Session, org_id: UUID, document_id: UUID, lock: bool = False) -> Document:
    stmt = scoped(Document, org_id).where(Document.id == document_id)
    if lock:
        stmt = stmt.with_for_update()
    doc = db.execute(stmt).scalar_one_or_none()
    if doc is None:
        raise NotFound("document not found")
    return doc


def latest_version(db: Session, org_id: UUID, document_id: UUID) -> DocumentVersion | None:
    stmt = (
        scoped(DocumentVersion, org_id)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_no.desc())
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def latest_scan(db: Session, org_id: UUID, version_id: UUID) -> ScanJob | None:
    stmt = (
        scoped(ScanJob, org_id).where(ScanJob.version_id == version_id).order_by(ScanJob.created_at.desc()).limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def _document_of_scan(db: Session, org_id: UUID, scan_job_id: UUID) -> Document:
    stmt = (
        scoped(Document, org_id)
        .join(
            DocumentVersion,
            (DocumentVersion.org_id == Document.org_id) & (DocumentVersion.document_id == Document.id),
        )
        .join(ScanJob, (ScanJob.org_id == DocumentVersion.org_id) & (ScanJob.version_id == DocumentVersion.id))
        .where(ScanJob.id == scan_job_id)
    )
    doc = db.execute(stmt).scalar_one_or_none()
    if doc is None:
        raise NotFound("document not found for this scan")
    return doc


# --- scans ---------------------------------------------------------------------------


def start_scan(
    db: Session, org_id: UUID, document_id: UUID, user_id: UUID, version_id: UUID | None = None
) -> ScanJob:
    """Creates a queued scan job and moves the document to 'scanning'."""
    doc = _get_document(db, org_id, document_id, lock=True)
    if doc.status in ("approved", "scanning"):
        raise InvalidState(f"document is {doc.status}; it cannot be scanned now")
    if version_id is None:
        version = latest_version(db, org_id, document_id)
    else:
        version = db.execute(
            scoped(DocumentVersion, org_id).where(
                DocumentVersion.id == version_id, DocumentVersion.document_id == document_id
            )
        ).scalar_one_or_none()
    if version is None:
        raise NotFound("version not found")
    job = ScanJob(org_id=org_id, version_id=version.id, requested_by=user_id)
    db.add(job)
    doc.status = "scanning"
    db.flush()
    write_audit(db, org_id, user_id, "scan.started", "document", doc.id, {"scan_job_id": str(job.id)})
    db.commit()
    return job


def update_scan_progress(db: Session, org_id: UUID, scan_job_id: UUID, progress: int) -> None:
    job = db.execute(scoped(ScanJob, org_id).where(ScanJob.id == scan_job_id)).scalar_one_or_none()
    if job is None:
        raise NotFound("scan not found")
    if job.status == "queued":
        job.status, job.started_at = "running", _now()
    job.progress = max(0, min(100, progress))
    db.commit()


def finish_scan(
    db: Session,
    org_id: UUID,
    scan_job_id: UUID,
    ok: bool = True,
    error: str | None = None,
    llm_info: dict[str, Any] | None = None,
) -> ScanJob:
    """Marks the scan done (or failed) and puts the document back to 'draft'."""
    job = db.execute(scoped(ScanJob, org_id).where(ScanJob.id == scan_job_id).with_for_update()).scalar_one_or_none()
    if job is None:
        raise NotFound("scan not found")
    doc = _document_of_scan(db, org_id, scan_job_id)
    job.status = "done" if ok else "failed"
    job.progress = 100 if ok else job.progress
    job.error = None if ok else (error or "scan failed")
    job.finished_at = _now()
    if llm_info is not None:
        job.llm_info = llm_info
    if doc.status == "scanning":
        doc.status = "draft"
    write_audit(
        db, org_id, None, "scan.finished" if ok else "scan.failed", "document", doc.id, {"scan_job_id": str(job.id)}
    )
    db.commit()
    return job


def scan_counts(db: Session, org_id: UUID, scan_job_id: UUID) -> dict[str, Any]:
    """Numbers for GET /scans/{id}: total, open, findings per layer, and compliance health score."""
    rows = db.execute(
        select(Finding.layer, Finding.status, Finding.severity, func.count())
        .where(Finding.org_id == org_id, Finding.scan_job_id == scan_job_id)
        .group_by(Finding.layer, Finding.status, Finding.severity)
    ).all()
    by_layer: dict[str, int] = {}
    by_severity: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
    total = open_ = 0
    for layer, status, severity, n in rows:
        by_layer[layer] = by_layer.get(layer, 0) + n
        sev_key = (severity or "medium").lower()
        by_severity[sev_key] = by_severity.get(sev_key, 0) + n
        total += n
        if status == "open":
            open_ += n

    # Dynamic Brand Compliance Score (0 to 100)
    penalty = (by_severity.get("high", 0) * 15) + (by_severity.get("medium", 0) * 8) + (by_severity.get("low", 0) * 3)
    score = max(0, min(100, 100 - penalty))

    if score >= 90:
        grade, risk_level = "A", "low"
    elif score >= 75:
        grade, risk_level = "B", "moderate"
    elif score >= 50:
        grade, risk_level = "C", "high"
    else:
        grade, risk_level = "F", "critical"

    return {
        "total": total,
        "open": open_,
        "by_layer": by_layer,
        "by_severity": by_severity,
        "compliance": {
            "score": score,
            "grade": grade,
            "risk_level": risk_level,
            "is_publishable": score >= 85 and open_ == 0
        }
    }


# --- review --------------------------------------------------------------------------


def decide_finding(
    db: Session,
    org_id: UUID,
    finding_id: UUID,
    user_id: UUID,
    decision: str,
    final_text: str | None = None,
) -> Finding:
    """Reviewer accepts, edits or rejects a finding. A later decision replaces the earlier one."""
    if decision not in DECISIONS:
        raise ValueError(f"decision must be one of {DECISIONS}")
    if decision == "edited" and not (final_text and final_text.strip()):
        raise ValueError("final_text is required when decision is 'edited'")

    finding = db.execute(scoped(Finding, org_id).where(Finding.id == finding_id).with_for_update()).scalar_one_or_none()
    if finding is None:
        raise NotFound("finding not found")
    doc = _document_of_scan(db, org_id, finding.scan_job_id)
    if doc.status == "approved":
        raise InvalidState("document is already approved")

    previous = finding.status
    finding.status = decision
    finding.final_text = final_text.strip() if decision == "edited" and final_text else None
    finding.decided_by = user_id
    finding.decided_at = _now()
    write_audit(
        db,
        org_id,
        user_id,
        f"finding.{decision}",
        "finding",
        finding.id,
        {"document_id": str(doc.id), "previous_status": previous, "layer": finding.layer},
    )
    db.commit()
    return finding


def _open_findings(db: Session, org_id: UUID, document_id: UUID) -> int:
    version = latest_version(db, org_id, document_id)
    if version is None:
        return 0
    scan = latest_scan(db, org_id, version.id)
    if scan is None:
        return 0
    return db.execute(
        select(func.count()).select_from(Finding).where(
            Finding.org_id == org_id, Finding.scan_job_id == scan.id, Finding.status == "open"
        )
    ).scalar_one()


def submit_document(db: Session, org_id: UUID, document_id: UUID, user_id: UUID) -> Document:
    """Creator sends a scanned draft to review."""
    doc = _get_document(db, org_id, document_id, lock=True)
    if doc.status not in ("draft", "changes_requested"):
        raise InvalidState(f"document is {doc.status}; only a draft can be submitted")
    version = latest_version(db, org_id, document_id)
    scan = latest_scan(db, org_id, version.id) if version else None
    if scan is None or scan.status != "done":
        raise InvalidState("the latest version has no finished scan")
    doc.status = "in_review"
    write_audit(db, org_id, user_id, "document.submitted", "document", doc.id, {"version_id": str(version.id)})
    db.commit()
    return doc


def request_changes(db: Session, org_id: UUID, document_id: UUID, user_id: UUID) -> Document:
    doc = _get_document(db, org_id, document_id, lock=True)
    if doc.status != "in_review":
        raise InvalidState(f"document is {doc.status}; only a document in review can get a change request")
    doc.status = "changes_requested"
    write_audit(db, org_id, user_id, "document.changes_requested", "document", doc.id)
    db.commit()
    return doc


def approve_document(
    db: Session, org_id: UUID, document_id: UUID, user_id: UUID, require_all_decided: bool = True
) -> Document:
    """A person approves the latest version. The database CHECK refuses 'approved' without
    approved_by, approved_at and approved_version_id, so nothing can skip that.

    require_all_decided=True: every finding of the latest scan must be accepted, edited or
    rejected first (open question in docs/api-contract.md; set False if the team decides otherwise).
    """
    doc = _get_document(db, org_id, document_id, lock=True)
    if doc.status != "in_review":
        raise InvalidState(f"document is {doc.status}; only a document in review can be approved")
    version = latest_version(db, org_id, document_id)
    if version is None:
        raise InvalidState("document has no version")
    if require_all_decided:
        n_open = _open_findings(db, org_id, document_id)
        if n_open:
            raise InvalidState(f"{n_open} finding(s) are still open")
    doc.status = "approved"
    doc.approved_by = user_id
    doc.approved_at = _now()
    doc.approved_version_id = version.id
    write_audit(db, org_id, user_id, "document.approved", "document", doc.id, {"version_id": str(version.id)})
    db.commit()
    return doc


# --- insights ------------------------------------------------------------------------


def rule_stats(db: Session, org_id: UUID) -> list[dict[str, Any]]:
    """Per rule: how often it is flagged and how often reviewers reject it (view rule_stats)."""
    rows = (
        db.execute(
            text(
                "SELECT rule_id, code, title, findings, accepted, rejected, reject_rate_pct "
                "FROM rule_stats WHERE org_id = :org ORDER BY findings DESC, code"
            ),
            {"org": org_id},
        )
        .mappings()
        .all()
    )
    return [
        {**r, "reject_rate_pct": float(r["reject_rate_pct"]) if r["reject_rate_pct"] is not None else None}
        for r in rows
    ]


def brand_drift_analytics(db: Session, org_id: UUID) -> dict[str, Any]:
    """Executive insights: brand health drift, top violated rules (hall of shame), and false-positive fatigue."""
    # 1. Total findings breakdown across all historical scans
    stats_query = db.execute(
        select(
            Finding.layer,
            Finding.status,
            Finding.severity,
            func.count()
        )
        .where(Finding.org_id == org_id)
        .group_by(Finding.layer, Finding.status, Finding.severity)
    ).all()

    total_violations = 0
    layer_counts = {"terminology": 0, "facts": 0, "tone": 0}
    status_counts = {"open": 0, "accepted": 0, "edited": 0, "rejected": 0}

    for layer, status, severity, count in stats_query:
        total_violations += count
        layer_counts[layer] = layer_counts.get(layer, 0) + count
        status_counts[status] = status_counts.get(status, 0) + count

    # 2. Top Violated Rules (Hall of Shame)
    rules = rule_stats(db, org_id)
    top_violated = rules[:5] if rules else []

    # 3. Rules with highest Reviewer Rejection (Rule Fatigue / False-positive alerts)
    fatigue_rules = [
        r for r in rules
        if r.get("reject_rate_pct") is not None and r["reject_rate_pct"] > 35 and r.get("findings", 0) >= 2
    ]

    # 4. Overall Brand Health Index
    total_decided = status_counts["accepted"] + status_counts["edited"] + status_counts["rejected"]
    acceptance_rate = (
        round(((status_counts["accepted"] + status_counts["edited"]) / total_decided) * 100, 1)
        if total_decided > 0 else 100.0
    )

    # 5. Severity distribution
    severity_query = db.execute(
        select(Finding.severity, func.count())
        .where(Finding.org_id == org_id)
        .group_by(Finding.severity)
    ).all()
    severity_counts = {"low": 0, "medium": 0, "high": 0}
    for sev, cnt in severity_query:
        if sev in severity_counts:
            severity_counts[sev] = cnt

    # 6. Recent Findings feed (top 15 recent)
    recent_findings_raw = db.execute(
        select(Finding)
        .where(Finding.org_id == org_id)
        .order_by(Finding.created_at.desc())
        .limit(15)
    ).scalars().all()

    recent_findings = [
        {
            "id": str(f.id),
            "layer": f.layer,
            "severity": f.severity,
            "status": f.status,
            "quoted_text": f.quoted_text,
            "explanation": f.explanation,
            "suggested_fix": f.suggested_fix,
            "final_text": f.final_text,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in recent_findings_raw
    ]

    return {
        "summary": {
            "total_violations_flagged": total_violations,
            "violations_by_layer": layer_counts,
            "violations_by_severity": severity_counts,
            "reviewer_decisions": status_counts,
            "brand_alignment_rate": acceptance_rate,
        },
        "hall_of_shame": [
            {
                "rule_code": r.get("code"),
                "title": r.get("title"),
                "violation_count": r.get("findings", 0),
                "rejection_rate": f"{(r.get('reject_rate_pct') or 0.0):.1f}%"
            }
            for r in top_violated
        ],
        "rule_fatigue_alerts": [
            {
                "rule_code": r.get("code"),
                "title": r.get("title"),
                "rejection_rate": f"{(r.get('reject_rate_pct') or 0.0):.1f}%",
                "suggestion": "Reviewer rejection is high. Consider updating or softening this guideline."
            }
            for r in fatigue_rules
        ],
        "recent_findings": recent_findings
    }

