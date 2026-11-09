"""FastAPI Application Entry Point.

Clean, modular, industry-standard setup:
- Configures CORS middleware
- Health check endpoint
- Mounts domain routers from app.api (auth, knowledge, documents, scans)
"""

import os
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.knowledge import router as knowledge_router
from app.api.scans import router as scans_router
from app.db import get_db

app = FastAPI(
    title="Inkloom Brand Governance API",
    description="Automated multi-layer brand governance platform checking terminology, facts, and tone.",
    version="1.0.0"
)

# CORS configuration
_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# Global Health Check
@app.get("/api/v1/health", tags=["system"])
def health(db: Session = Depends(get_db)):
    """Verifies backend is healthy, Neon DB responds, and pgvector extension is loaded."""
    try:
        db.execute(text("SELECT 1"))
        has_vector = db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).first() is not None
        return {"status": "ok", "db": "ok", "pgvector": has_vector}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "db": "error", "pgvector": False})


# Include modular routers under /api/v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(knowledge_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(scans_router, prefix="/api/v1")
