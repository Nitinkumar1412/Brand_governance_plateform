"""Document management, ingestion, upload, and lifecycle approval endpoints."""

import os
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db, scoped
from app.ingestion import extract_blocks
from app.models import ContentBlock, Document, DocumentVersion, User
from app.workflow import (
    InvalidState, NotFound, approve_document, document_history,
    latest_scan, latest_version, request_changes, submit_document
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    docs = db.execute(scoped(Document, current_user.org_id).order_by(Document.created_at.desc())).scalars().all()
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "status": d.status,
            "created_at": d.created_at.isoformat(),
            "updated_at": d.updated_at.isoformat()
        }
        for d in docs
    ]


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
    return [
        {
            "action": log.action,
            "entity_type": log.entity_type,
            "created_at": log.created_at.isoformat(),
            "details": log.details
        }
        for log in logs
    ]

