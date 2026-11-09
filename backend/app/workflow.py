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
    """Numbers for GET /scans/{id}: total, open, and findings per layer."""
    rows = db.execute(
        select(Finding.layer, Finding.status, func.count())
        .where(Finding.org_id == org_id, Finding.scan_job_id == scan_job_id)
        .group_by(Finding.layer, Finding.status)
    ).all()
    by_layer: dict[str, int] = {}
    total = open_ = 0
    for layer, status, n in rows:
        by_layer[layer] = by_layer.get(layer, 0) + n
        total += n
        if status == "open":
            open_ += n
    return {"total": total, "open": open_, "by_layer": by_layer}


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
