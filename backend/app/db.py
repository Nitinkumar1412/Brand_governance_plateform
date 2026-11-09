"""Database connection and sessions.

DATABASE_URL comes from the environment (.env locally, host settings when deployed).
Both plain 'postgresql://...' (what Neon shows) and 'postgres://...' work; we switch
them to the psycopg 3 driver here, so nobody has to edit the URL by hand.
"""

import os
from collections.abc import Iterator
from functools import lru_cache
from dotenv import load_dotenv


from sqlalchemy import Select, create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


load_dotenv()

def normalize_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Copy .env.example to .env and fill it in.")
    # pool_pre_ping: a hosted free database (Neon) suspends when idle, so a pooled
    # connection can be dead. Test it before use instead of failing the request.
    # pool_recycle: drop connections older than 5 minutes for the same reason.
    return create_engine(normalize_url(url), pool_pre_ping=True, pool_recycle=300)


@lru_cache(maxsize=1)
def _session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: `db: Session = Depends(get_db)`.

    Commit is explicit (db.commit()) in the code that changes data, so a request
    that raises halfway never leaves a half-saved change.
    """
    db = _session_factory()()
    
    try:
        yield db
    finally:
        db.close()


def scoped(model, org_id) -> Select:
    """The ONLY way to start a query on an org-owned table.

    `db.execute(scoped(Document, org_id).where(Document.id == doc_id))`

    Always filtering by org_id is how this project backs the tenant-isolation claim.
    The database also refuses cross-org references (composite foreign keys), but
    reads have to be filtered here.
    """
    return select(model).where(model.org_id == org_id)
