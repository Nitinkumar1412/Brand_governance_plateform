"""Document management, ingestion, upload, and lifecycle approval endpoints."""

import io
import os
from uuid import UUID
import docx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db, scoped
from app.ingestion import extract_blocks
from app.models import ContentBlock, Document, DocumentVersion, Finding, User
from app.workflow import (
    InvalidState, NotFound, approve_document, document_history,
    latest_scan, latest_version, request_changes, submit_document
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = scoped(Document, current_user.org_id)
    
    # Creator privacy: Creator ke draft documents (status 'draft' ya 'scanning')
    # sirf unke creator ko hi dikhte hain. Jab tak review ke liye submit na ho,
    # reviewers aur admins ki list me draft clutter nahi dikhta.
    if current_user.role in ("reviewer", "admin"):
        # Agar admin/reviewer ne khud koi draft banaya ho toh wo apna draft dekh sakta hai,
        # lekin dusro ke sirf submitted/review wale dikhenge.
        query = query.where(
            (Document.status.in_(["in_review", "changes_requested", "approved"])) |
            (Document.created_by == current_user.id)
        )

    docs = db.execute(query.order_by(Document.created_at.desc())).scalars().all()
    results = []
    for d in docs:
        version = latest_version(db, current_user.org_id, d.id)
        open_findings = 0
        total_findings = 0
        scan_job = None
        if version:
            scan_job = latest_scan(db, current_user.org_id, version.id)
            if scan_job:
                findings = list(
                    db.execute(
                        scoped(Finding, current_user.org_id).where(Finding.scan_job_id == scan_job.id)
                    ).scalars()
                )
                total_findings = len(findings)
                open_findings = len([f for f in findings if f.status == "open"])
        
        creator_user = db.query(User).filter_by(id=d.created_by).first() if d.created_by else None
        creator_name = creator_user.full_name if creator_user else "Team Member"

        results.append({
            "id": str(d.id),
            "title": d.title,
            "status": d.status,
            "version_no": version.version_no if version else 1,
            "version_id": str(version.id) if version else None,
            "scan_progress": scan_job.progress if scan_job and scan_job.status in ("queued", "running") else None,
            "scan_status": scan_job.status if scan_job else None,
            "open_findings": open_findings,
            "total_findings": total_findings,
            "creator_name": creator_name,
            "created_at": d.created_at.isoformat(),
            "updated_at": d.updated_at.isoformat()
        })
    return results


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    content = await file.read()
    filename = file.filename or "untitled.txt"
    doc_title = title or os.path.splitext(filename)[0]

    # Ingestion into structured content blocks
    content_hash, extracted_blocks = extract_blocks(content, filename)

    # 1. Create Document
    doc = Document(org_id=current_user.org_id, title=doc_title, created_by=current_user.id, status="draft")
    db.add(doc)
    db.flush()

    # 2. Create DocumentVersion
    file_type = "pdf" if filename.endswith(".pdf") else ("docx" if filename.endswith(".docx") else "text")
    version = DocumentVersion(
        org_id=current_user.org_id,
        document_id=doc.id,
        version_no=1,
        file_type=file_type,
        original_filename=filename,
        content_hash=content_hash,
        uploaded_by=current_user.id,
    )
    db.add(version)
    db.flush()

    # 3. Create ContentBlocks
    for b in extracted_blocks:
        block = ContentBlock(
            org_id=current_user.org_id,
            version_id=version.id,
            block_no=b["block_no"],
            block_type=b["block_type"],
            content=b["content"],
            page=b.get("page"),
            alt_text=b.get("alt_text"),
        )
        db.add(block)

    db.commit()
    return {"document_id": str(doc.id), "version_id": str(version.id), "blocks_count": len(extracted_blocks)}


@router.get("/{document_id}")
def get_document_detail(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.execute(scoped(Document, current_user.org_id).where(Document.id == document_id)).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    version = latest_version(db, current_user.org_id, document_id)
    blocks = []
    scan_job = None
    if version:
        blocks = list(
            db.execute(
                scoped(ContentBlock, current_user.org_id)
                .where(ContentBlock.version_id == version.id)
                .order_by(ContentBlock.block_no)
            ).scalars()
        )
        scan_job = latest_scan(db, current_user.org_id, version.id)

    return {
        "id": str(doc.id),
        "title": doc.title,
        "status": doc.status,
        "version_id": str(version.id) if version else None,
        "scan_job_id": str(scan_job.id) if scan_job else None,
        "scan_status": scan_job.status if scan_job else None,
        "blocks": [
            {"id": str(b.id), "block_no": b.block_no, "block_type": b.block_type, "content": b.content, "page": b.page}
            for b in blocks
        ]
    }


# --- Document Lifecycle Actions ---
@router.post("/{document_id}/submit")
def submit_doc(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        doc = submit_document(db, current_user.org_id, document_id, current_user.id)
        return {"id": str(doc.id), "status": doc.status}
    except InvalidState as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{document_id}/request-changes")
def req_changes(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        doc = request_changes(db, current_user.org_id, document_id, current_user.id)
        return {"id": str(doc.id), "status": doc.status}
    except InvalidState as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{document_id}/approve")
def approve_doc(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        doc = approve_document(db, current_user.org_id, document_id, current_user.id, require_all_decided=True)
        return {"id": str(doc.id), "status": doc.status, "approved_at": doc.approved_at.isoformat()}
    except InvalidState as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/{document_id}/history")
def get_history(document_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = document_history(db, current_user.org_id, document_id)
    actor_ids = {log.actor_id for log in logs if log.actor_id}
    actors = {}
    if actor_ids:
        users = db.query(User).filter(User.id.in_(actor_ids)).all()
        actors = {u.id: {"name": u.full_name, "role": u.role, "email": u.email} for u in users}

    return [
        {
            "action": log.action,
            "entity_type": log.entity_type,
            "created_at": log.created_at.isoformat(),
            "actor": actors.get(log.actor_id),
            "details": log.details
        }
        for log in logs
    ]


@router.get("/{document_id}/export")
def export_clean_document(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generates a polished, brand-compliant DOCX by applying all accepted/edited fixes."""
    doc = db.execute(scoped(Document, current_user.org_id).where(Document.id == document_id)).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    version = latest_version(db, current_user.org_id, document_id)
    if not version:
        raise HTTPException(status_code=400, detail="Document has no content versions")

    # Fetch blocks in reading order
    blocks = list(
        db.execute(
            scoped(ContentBlock, current_user.org_id)
            .where(ContentBlock.version_id == version.id)
            .order_by(ContentBlock.block_no)
        ).scalars()
    )

    # Fetch findings for the latest scan that have been accepted or edited
    scan = latest_scan(db, current_user.org_id, version.id)
    findings_by_block: dict[UUID, list[Finding]] = {}
    if scan:
        resolved_findings = list(
            db.execute(
                scoped(Finding, current_user.org_id)
                .where(Finding.scan_job_id == scan.id)
                .where(Finding.status.in_(["accepted", "edited"]))
            ).scalars()
        )
        for f in resolved_findings:
            findings_by_block.setdefault(f.block_id, []).append(f)

    # Build clean Word document
    out_doc = docx.Document()
    out_doc.add_heading(doc.title, level=0)

    for b in blocks:
        text = b.content or ""
        # Apply fixes if any exist for this block
        block_findings = findings_by_block.get(b.id, [])
        for f in block_findings:
            replacement = f.final_text if f.status == "edited" and f.final_text else f.suggested_fix
            if replacement and f.quoted_text and f.quoted_text in text:
                text = text.replace(f.quoted_text, replacement)

        if not text.strip():
            continue

        b_type = (b.block_type or "paragraph").lower()
        if b_type == "heading":
            out_doc.add_heading(text, level=2)
        elif b_type == "list":
            out_doc.add_paragraph(text, style="List Bullet")
        else:
            out_doc.add_paragraph(text)

    # Stream the file back
    file_stream = io.BytesIO()
    out_doc.save(file_stream)
    file_stream.seek(0)

    clean_filename = f"{doc.title.replace(' ', '_')}_compliant.docx"
    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={clean_filename}"}
    )


