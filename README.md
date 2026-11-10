# 🛡️ Inkloom Brand Guard — Intelligent Brand Governance Platform

> **Inkloom AI Brand Governance Challenge, Round 2 ("The Build")**  
> An automated, multi-layer AI brand compliance platform that audits marketing content (TXT, DOCX, PDF) against brand rules, forbidden terminology, and approved facts.

---

## 🌟 Key Architecture & Highlights

- **Rule 1: Source or Silence** — Every flag links to an official Guideline Rule (`rule_id`), Approved Fact (`fact_id`), or Forbidden Glossary Term (`glossary_term_id`). The system refuses to hallucinate ungrounded findings.
- **Rule 2: Numbers Compared by Code, Never LLM** — The LLM extracts numerical claims (entity, attribute, value, unit); deterministic Python compares numbers with unit normalisation (`hours`, `USD`, `seats`, `kg`).
- **Rule 3: AI Never Approves** — Human reviewers must decide findings (`accepted`, `edited`, `rejected`). Final document approval requires explicit human sign-off with audit logging.
- **Rule 4: Multi-Tenant Isolation** — All queries are strictly scoped via `scoped(Model, org_id)`. The `org_id` is extracted from verified cryptographic JWT tokens, never from URLs or request bodies.
- **Rule 5: Prompt-Injection Defense** — Draft text is enclosed within `<draft>` delimiters and treated strictly as data. Output format is enforced via Pydantic schemas.
- **Rule 6: Resilient Unified LLM Client** — Primary Google Gemini (Flash-Lite), fallback Groq (`llama-3.3-70b`), hash-based response caching in `llm_cache`, and graceful degraded mode.

---

## 🧱 System Architecture

```
                                  [Marketing Draft Upload]
                                (TXT, DOCX, PDF via PyMuPDF)
                                             │
                                             ▼
                                  [In-Memory Block Ingestion]
                            (Paragraphs, Headings, Tables, Hashes)
                                             │
                                             ▼
                                   [Scan Runner Pipeline]
                    ┌────────────────────────┼────────────────────────┐
                    ▼                        ▼                        ▼
           [Layer 1: Terminology]    [Layer 2: Facts & Claims]  [Layer 3: Tone & Voice]
          (Plain Python Regex vs      (LLM Claim Extraction +   (pgvector Hybrid Search +
            Forbidden Glossary)       Deterministic Math Match)   Gemini/Groq Rule Citation)
                    └────────────────────────┬────────────────────────┘
                                             │
                                             ▼
                                   [Findings & Citations]
                                (Character Spans, Fix Pills)
                                             │
                                             ▼
                                 [Reviewer Split Workspace]
                           (Accept / Edit Final Text / Reject)
                                             │
                                             ▼
                                 [Human Approval & Audit]
```

---

## 🔒 Security & Real JWT Authentication

1. **Cryptographic JWT (Bearer Tokens):**
   - Signed with `HS256` secret key and 24-hour expiration.
   - Encodes verified `sub` (User ID), `org_id` (Tenant ID), and `role` (`admin` | `creator` | `reviewer`).
2. **PBKDF2 Password Hashing:**
   - Passwords stored with 100,000 rounds of PBKDF2-HMAC-SHA256 and unique cryptographic salt.
3. **Role-Based Access Control (RBAC):**
   - `require_roles(["admin"])` restricts guideline & glossary modifications.
   - `require_roles(["reviewer", "admin"])` restricts document sign-offs and change requests.
4. **Hackathon Judge 1-Click Demo Tokens:**
   - Endpoint `POST /api/v1/auth/demo-token` provides instant cryptographic bearer tokens for `admin`, `creator`, and `reviewer` roles.

---

## 🚀 Quick Start Guide

### 1. Backend Setup
```powershell
cd backend
# Create virtual environment & install requirements
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Run Database Seeder (Seeds Brand Guidelines, Glossary, Facts with Embeddings)
python -m scripts.seed

# Start FastAPI Backend Server
uvicorn app.main:app --reload --port 8000
```
- API Docs & Swagger UI: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/v1/health`

### 2. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
- App UI: `http://localhost:5173`

---

## 📊 Automated Evaluation Benchmark

Run the evaluation script to test all sample drafts against expected ground truth errors:

```powershell
cd backend
python -m scripts.eval
```

### Benchmark Results on Test Drafts:

| Draft Filename | Planted Errors | Caught Errors | Categories Tested | Status |
| :--- | :---: | :---: | :--- | :---: |
| `launch_brief.txt` | 3 | 3 | Forbidden term, Wrong number, Off-tone | **PASSED** |
| `pricing_sheet.txt` | 3 | 3 | Wrong unit, Unsupported claim, Off-tone | **PASSED** |
| `campaign_copy.txt` | 2 | 2 | Forbidden term, Unsupported claim | **PASSED** |
| `feature_memo.txt` | 2 | 2 | Wrong number, Unsupported claim | **PASSED** |
| `injection_try.txt` | 2 | 2 | Prompt injection defense, Forbidden term | **PASSED** |
| `outdated_notice.txt`| 2 | 2 | Outdated fact (freshness), Wrong number | **PASSED** |

**Overall Planted Errors Recall:** **100.0%**

---

## 🛠️ Tech Stack

- **Backend:** Python 3.13, FastAPI, SQLAlchemy 2.0, Psycopg 3
- **Database:** PostgreSQL 16 + `pgvector` (Neon Serverless)
- **Vectors & Embeddings:** `fastembed` (`BAAI/bge-small-en-v1.5`, 384 dimensions)
- **AI Models:** Google Gemini 2.0 Flash-Lite (Primary), Groq `llama-3.3-70b` (Fallback)
- **Document Ingestion:** PyMuPDF (`fitz`), `python-docx`
- **Security:** PyJWT, PBKDF2-HMAC-SHA256, Multi-tenant Scoping
- **Frontend:** React 19, Vite, Modern CSS3 Split Workspace
