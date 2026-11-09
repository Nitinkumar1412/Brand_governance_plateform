"""Database seeder script.
Loads sample data from data/sample/ into Neon PostgreSQL with vector embeddings.
Idempotent: safe to run multiple times without duplicating rows.

Run: python -m scripts.seed
"""

import json
import os
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from app.api.deps import hash_password
from app.db import get_engine, scoped
from app.embeddings import embed_texts
from app.models import (
    ApprovedFact, Base, GlossaryTerm, GuidelineDocument,
    GuidelineRule, Organization, User
)
from sqlalchemy import text
from sqlalchemy.orm import Session

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "sample"


def load_json(filename: str):
    file_path = DATA_DIR / filename
    if not file_path.exists():
        print(f"Warning: {file_path} not found.")
        return []
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed():
    engine = get_engine()
    with Session(engine) as db:
        print("🌱 Seeding database...")

        # 1. Default Organization
        org = db.query(Organization).filter_by(name="Acme Corp").first()
        if not org:
            org = Organization(name="Acme Corp")
            db.add(org)
            db.flush()
            print(f"✓ Created Organization: {org.name} ({org.id})")
        else:
            print(f"✓ Organization already exists: {org.name} ({org.id})")

        # 2. Users (Admin, Creator, Reviewer)
        users_data = load_json("users.json")
        for u in users_data:
            existing_user = db.query(User).filter_by(email=u["email"]).first()
            default_pwd = f"{u['role']}123"
            pwd_hash = hash_password(default_pwd)
            if not existing_user:
                new_user = User(
                    org_id=org.id,
                    email=u["email"],
                    full_name=u["email"].split("@")[0].title(),
                    password_hash=pwd_hash,
                    role=u["role"]
                )
                db.add(new_user)
                print(f"✓ Created User: {u['email']} [{u['role']}] (Password: {default_pwd})")
            else:
                existing_user.password_hash = pwd_hash
                print(f"✓ User updated with secure hash: {u['email']} [{u['role']}] (Password: {default_pwd})")

        # 3. Guideline Document
        guideline = db.query(GuidelineDocument).filter_by(org_id=org.id, title="Brand Guidelines 2026").first()
        if not guideline:
            guideline = GuidelineDocument(
                org_id=org.id,
                title="Brand Guidelines 2026",
                version="1.0",
                status="active"
            )
            db.add(guideline)
            db.flush()
            print(f"✓ Created Guideline Document: {guideline.title}")
        else:
            print(f"✓ Guideline Document already exists: {guideline.title}")

        # 4. Guideline Rules (with Embeddings!)
        rules_data = load_json("rules.json")
        if rules_data:
            print(f"Embedding {len(rules_data)} guideline rules...")
            rule_texts = [f"{r['title']}: {r['body']}" for r in rules_data]
            rule_vectors = embed_texts(rule_texts)

            for r, vec in zip(rules_data, rule_vectors):
                existing_rule = db.query(GuidelineRule).filter_by(org_id=org.id, code=r["code"]).first()
                if not existing_rule:
                    new_rule = GuidelineRule(
                        org_id=org.id,
                        guideline_id=guideline.id,
                        code=r["code"],
                        category=r["category"],
                        title=r["title"],
                        body=r["body"],
                        severity=r.get("severity", "medium"),
                        page=r.get("page"),
                        embedding=vec
                    )
                    db.add(new_rule)
                    print(f"✓ Added Rule: {r['code']} ({r['category']})")
                else:
                    print(f"✓ Rule already exists: {r['code']}")

        # 5. Glossary Terms
        glossary_data = load_json("glossary.json")
        for g in glossary_data:
            existing_term = db.query(GlossaryTerm).filter_by(org_id=org.id, term=g["term"]).first()
            if not existing_term:
                new_term = GlossaryTerm(
                    org_id=org.id,
                    term=g["term"],
                    kind=g["kind"],
                    replacement=g.get("replacement"),
                    note=g.get("note")
                )
                db.add(new_term)
                print(f"✓ Added Glossary: {g['term']} ({g['kind']})")
            else:
                print(f"✓ Glossary already exists: {g['term']}")

        # 6. Approved Facts (with Embeddings!)
        facts_data = load_json("facts.json")
        if facts_data:
            print(f"Embedding {len(facts_data)} approved facts...")
            fact_texts = [f['statement'] for f in facts_data]
            fact_vectors = embed_texts(fact_texts)

            for f, vec in zip(facts_data, fact_vectors):
                existing_fact = db.query(ApprovedFact).filter_by(
                    org_id=org.id, entity=f["entity"], attribute=f["attribute"]
                ).first()
                if not existing_fact:
                    val_num = Decimal(str(f["value_num"])) if f.get("value_num") is not None else None
                    v_to = date.fromisoformat(f["valid_to"]) if f.get("valid_to") else None
                    v_from = date.fromisoformat(f["valid_from"]) if f.get("valid_from") else None

                    new_fact = ApprovedFact(
                        org_id=org.id,
                        entity=f["entity"],
                        attribute=f["attribute"],
                        value_num=val_num,
                        value_text=f.get("value_text"),
                        unit=f.get("unit"),
                        statement=f["statement"],
                        source_name=f["source_name"],
                        source_page=f.get("source_page"),
                        valid_from=v_from,
                        valid_to=v_to,
                        embedding=vec
                    )
                    db.add(new_fact)
                    print(f"✓ Added Fact: {f['entity']} - {f['attribute']}")
                else:
                    print(f"✓ Fact already exists: {f['entity']} - {f['attribute']}")

        db.commit()
        print("\n🎉 Seeding completed successfully! All brand guidelines and facts are live in Neon DB.")


if __name__ == "__main__":
    seed()

