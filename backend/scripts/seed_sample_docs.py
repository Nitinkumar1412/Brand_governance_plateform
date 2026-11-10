"""Seed sample documents that match the exact mockup screenshot."""
import sys, os
from pathlib import Path
from uuid import uuid4
from datetime import datetime, UTC

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.chdir(str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(".env")

from app.db import _session_factory
from app.models import Document, DocumentVersion, ContentBlock, Finding, User, Organization
from app.scan import execute_scan

def seed_sample_docs():
    db = _session_factory()()
    org = db.query(Organization).first()
    creator = db.query(User).filter_by(role='creator').first()
    reviewer = db.query(User).filter_by(role='reviewer').first()

    # Check if 'Phone X spec sheet (PDF)' already exists
    existing = db.query(Document).filter_by(title="Phone X spec sheet (PDF)").first()
    if existing:
        print("✓ Already seeded.")
        db.close()
        return

    print("Creating sample documents matching screenshot...")

    # 1. 'Launch post' (In review, 4 open of 6 findings)
    doc1 = Document(
        org_id=org.id,
        title="Launch post",
        created_by=creator.id,
        status="in_review"
    )
    db.add(doc1)
    db.flush()

    ver1 = DocumentVersion(
        org_id=org.id,
        document_id=doc1.id,
        version_no=2,
        file_type="docx",
        original_filename="launch-post.docx",
        content_hash=uuid4().hex,
        uploaded_by=creator.id
    )
    db.add(ver1)
    db.flush()

    blocks1 = [
        "Meet Phone X",
        "Our revolutionary new phone has a 7000 mAh battery and the fastest charging in its class.",
        "You won't believe this deal!!! Read on for the details.",
        "Image: phone-front.png",
        "Buy now or regret it forever."
    ]

    for idx, content in enumerate(blocks1):
        cb = ContentBlock(
            org_id=org.id,
            version_id=ver1.id,
            block_no=idx + 1,
            block_type="heading" if idx == 0 else "image" if "Image:" in content else "paragraph",
            content=content
        )
        db.add(cb)
    db.commit()

    # Run actual scan engine on doc1
    from app.workflow import start_scan
    scan_job = start_scan(db, org.id, doc1.id, creator.id)
    execute_scan(scan_job.id, org.id, ver1.id)
    doc1.status = "in_review"
    db.commit()
    print("✓ Created & Scanned 'Launch post'")

    # 2. 'Spring sale email' (Changes requested)
    doc2 = Document(org_id=org.id, title="Spring sale email", created_by=creator.id, status="changes_requested")
    db.add(doc2)
    db.flush()
    ver2 = DocumentVersion(org_id=org.id, document_id=doc2.id, version_no=3, file_type="docx", original_filename="spring-sale.docx", content_hash=uuid4().hex, uploaded_by=creator.id)
    db.add(ver2)
    db.flush()
    cb2 = ContentBlock(org_id=org.id, version_id=ver2.id, block_no=1, block_type="paragraph", content="Don't miss our unmatched guaranteed discounts.")
    db.add(cb2)
    db.commit()
    scan_job2 = start_scan(db, org.id, doc2.id, creator.id)
    execute_scan(scan_job2.id, org.id, ver2.id)
    doc2.status = "changes_requested"
    db.commit()
    print("✓ Created 'Spring sale email'")

    # 3. 'Phone X spec sheet (PDF)' (Approved)
    doc3 = Document(org_id=org.id, title="Phone X spec sheet (PDF)", created_by=creator.id, status="draft")
    db.add(doc3)
    db.flush()
    ver3 = DocumentVersion(org_id=org.id, document_id=doc3.id, version_no=1, file_type="pdf", original_filename="phone-x-spec.pdf", content_hash=uuid4().hex, uploaded_by=creator.id)
    db.add(ver3)
    db.flush()
    cb3 = ContentBlock(org_id=org.id, version_id=ver3.id, block_no=1, block_type="paragraph", content="Phone X specifications and regulatory compliance overview.")
    db.add(cb3)
    doc3.approved_version_id = ver3.id
    doc3.approved_by = reviewer.id
    doc3.approved_at = datetime.now(UTC)
    doc3.status = "approved"
    db.commit()
    print("✓ Created 'Phone X spec sheet (PDF)'")

    # 4. 'Newsletter, November' (Draft)
    doc4 = Document(org_id=org.id, title="Newsletter, November", created_by=creator.id, status="draft")
    db.add(doc4)
    db.flush()
    ver4 = DocumentVersion(org_id=org.id, document_id=doc4.id, version_no=1, file_type="docx", original_filename="newsletter.docx", content_hash=uuid4().hex, uploaded_by=creator.id)
    db.add(ver4)
    db.flush()
    cb4 = ContentBlock(org_id=org.id, version_id=ver4.id, block_no=1, block_type="paragraph", content="Monthly newsletter draft covering product updates.")
    db.add(cb4)
    doc4.status = "draft"
    db.commit()
    print("✓ Created 'Newsletter, November'")

    # 5. 'Store poster copy' (Scanning, 60%)
    doc5 = Document(org_id=org.id, title="Store poster copy", created_by=creator.id, status="scanning")
    db.add(doc5)
    db.flush()
    ver5 = DocumentVersion(org_id=org.id, document_id=doc5.id, version_no=1, file_type="text", original_filename="poster.txt", content_hash=uuid4().hex, uploaded_by=creator.id)
    db.add(ver5)
    db.flush()
    cb5 = ContentBlock(org_id=org.id, version_id=ver5.id, block_no=1, block_type="paragraph", content="Store poster copy currently in progress.")
    db.add(cb5)
    doc5.status = "scanning"
    db.commit()
    print("✓ Created 'Store poster copy'")

    # 6. 'Support FAQ update' (Approved)
    doc6 = Document(org_id=org.id, title="Support FAQ update", created_by=creator.id, status="draft")
    db.add(doc6)
    db.flush()
    ver6 = DocumentVersion(org_id=org.id, document_id=doc6.id, version_no=2, file_type="docx", original_filename="faq.docx", content_hash=uuid4().hex, uploaded_by=creator.id)
    db.add(ver6)
    db.flush()
    cb6 = ContentBlock(org_id=org.id, version_id=ver6.id, block_no=1, block_type="paragraph", content="Frequently asked questions and verified support procedures.")
    db.add(cb6)
    doc6.approved_version_id = ver6.id
    doc6.approved_by = reviewer.id
    doc6.approved_at = datetime.now(UTC)
    doc6.status = "approved"
    db.commit()
    print("✓ Created 'Support FAQ update'")

    db.close()
    print("🎉 All sample documents seeded successfully!")

if __name__ == "__main__":
    seed_sample_docs()
