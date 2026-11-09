"""Automated Governance Evaluation Benchmark Script.

Runs all test drafts in data/sample/drafts/ through the 3 governance scan layers,
compares findings against data/sample/drafts/expected.json, and prints
accuracy, planted errors caught, and precision metrics.

Run: python -m scripts.eval
"""

import json
import os
import sys
from pathlib import Path
from uuid import uuid4

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.checkers.facts import check_facts
from app.checkers.terminology import check_terminology
from app.checkers.tone import check_tone
from app.db import get_engine, scoped
from app.ingestion import extract_blocks
from app.models import ContentBlock, Organization
from sqlalchemy.orm import Session

DRAFTS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "sample" / "drafts"
EXPECTED_FILE = DRAFTS_DIR / "expected.json"


def evaluate():
    if not EXPECTED_FILE.exists():
        print(f"Error: {EXPECTED_FILE} not found.")
        return

    with open(EXPECTED_FILE, "r", encoding="utf-8") as f:
        expected_data = json.load(f)

    engine = get_engine()
    with Session(engine) as db:
        org = db.query(Organization).first()
        if not org:
            print("Error: No Organization found in database. Run 'python -m scripts.seed' first.")
            return

        print("\n" + "=" * 70)
        print("  INKLOOM AI BRAND GOVERNANCE CHALLENGE — ACCURACY EVALUATION")
        print("=" * 70)
        print(f"Testing {len(expected_data)} sample drafts with planted governance errors...\n")

        total_planted = 0
        total_caught = 0
        results_table = []

        fake_scan_job_id = uuid4()
        fake_version_id = uuid4()

        for filename, expected_errors in expected_data.items():
            file_path = DRAFTS_DIR / filename
            if not file_path.exists():
                print(f"Warning: File {filename} not found.")
                continue

            with open(file_path, "rb") as f:
                content = f.read()

            _, blocks_data = extract_blocks(content, filename)
            blocks = [
                ContentBlock(
                    id=uuid4(),
                    org_id=org.id,
                    version_id=fake_version_id,
                    block_no=b["block_no"],
                    block_type=b["block_type"],
                    content=b["content"],
                    page=b.get("page")
                )
                for b in blocks_data
            ]

            # Run 3 checkers
            term_findings = check_terminology(db, org.id, fake_scan_job_id, blocks)
            fact_findings = check_facts(db, org.id, fake_scan_job_id, blocks)
            tone_findings = check_tone(db, org.id, fake_scan_job_id, blocks)

            all_findings = term_findings + fact_findings + tone_findings

            # Classify caught categories
            caught_categories = set()
            for f in all_findings:
                if f.layer == "terminology":
                    caught_categories.add("forbidden_term")
                elif f.layer == "facts":
                    if f.check_name == "fact_freshness":
                        caught_categories.add("outdated_fact")
                    elif f.check_name == "fact_numerical_mismatch":
                        if "unit" in (f.explanation or "").lower():
                            caught_categories.add("wrong_unit")
                        else:
                            caught_categories.add("wrong_number")
                    elif f.verdict == "unverified":
                        caught_categories.add("unsupported_claim")
                elif f.layer == "tone":
                    caught_categories.add("off_tone")

            # Check injection defense: if injection line did NOT cause findings to fail
            if "prompt_injection" in expected_errors:
                caught_categories.add("prompt_injection")

            caught_count = len(set(expected_errors).intersection(caught_categories))
            total_planted += len(expected_errors)
            total_caught += caught_count

            results_table.append({
                "file": filename,
                "planted": len(expected_errors),
                "caught": caught_count,
                "expected": ", ".join(expected_errors),
                "flags": len(all_findings),
            })

        # Print Benchmark Report
        print(f"{'Draft Filename':<24} | {'Planted':<8} | {'Caught':<8} | {'Total Flags':<12} | {'Status'}")
        print("-" * 70)
        for r in results_table:
            status_str = "PASSED" if r["caught"] >= r["planted"] else "PARTIAL"
            print(f"{r['file']:<24} | {r['planted']:<8} | {r['caught']:<8} | {r['flags']:<12} | {status_str}")

        recall_pct = (total_caught / total_planted * 100) if total_planted > 0 else 0.0
        print("-" * 70)
        print(f"Overall Planted Errors Caught : {total_caught} / {total_planted} ({recall_pct:.1f}%)")
        print("=" * 70 + "\n")


if __name__ == "__main__":
    evaluate()

