"""Scan runner orchestrator.

Runs all 3 checker layers (Terminology, Facts, Tone) over content blocks,
updates progress in real-time, saves findings, and finishes the scan job.
Guarantees that errors result in finish_scan(ok=False) instead of hung jobs.
"""

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.checkers.facts import check_facts
from app.checkers.terminology import check_terminology
from app.checkers.tone import check_tone
from app.db import get_engine, scoped
from app.models import ContentBlock, DocumentVersion, Finding, ScanJob
from app.workflow import finish_scan, update_scan_progress

logger = logging.getLogger(__name__)


def execute_scan(scan_job_id: UUID, org_id: UUID, version_id: UUID):
    """Executes the full brand governance scan pipeline for a document version.
    
    Designed to be invoked via FastAPI BackgroundTasks or directly.
    """
    engine = get_engine()
    with Session(engine) as db:
        try:
            logger.info(f"Starting scan job {scan_job_id} for version {version_id}")
            update_scan_progress(db, org_id, scan_job_id, progress=10)

            # 1. Fetch all content blocks for this version
            blocks = list(
                db.execute(
                    scoped(ContentBlock, org_id)
                    .where(ContentBlock.version_id == version_id)
                    .order_by(ContentBlock.block_no)
                ).scalars()
            )

            all_findings: list[Finding] = []

            # 2. Layer 1: Terminology Checker (Plain Python Regex)
            logger.info(f"Running Terminology checker on {len(blocks)} blocks...")
            term_findings = check_terminology(db, org_id, scan_job_id, blocks)
            all_findings.extend(term_findings)
            update_scan_progress(db, org_id, scan_job_id, progress=40)

            # 3. Layer 2: Facts & Claims Checker (LLM extraction + Code comparison)
            logger.info("Running Facts checker...")
            fact_findings = check_facts(db, org_id, scan_job_id, blocks)
            all_findings.extend(fact_findings)
            update_scan_progress(db, org_id, scan_job_id, progress=70)

            # 4. Layer 3: Tone & Voice Checker (Semantic retrieval + LLM citation)
            logger.info("Running Tone checker...")
            tone_findings = check_tone(db, org_id, scan_job_id, blocks)
            all_findings.extend(tone_findings)
            update_scan_progress(db, org_id, scan_job_id, progress=90)

            # 5. Persist all findings to database
            if all_findings:
                db.add_all(all_findings)
                db.commit()
                logger.info(f"Saved {len(all_findings)} findings for scan {scan_job_id}")

            # 6. Mark scan as finished
            finish_scan(db, org_id, scan_job_id, ok=True)
            logger.info(f"Scan job {scan_job_id} completed successfully.")

        except Exception as e:
            logger.exception(f"Scan job {scan_job_id} failed: {e}")
            try:
                finish_scan(db, org_id, scan_job_id, ok=False, error=str(e))
            except Exception:
                db.rollback()

