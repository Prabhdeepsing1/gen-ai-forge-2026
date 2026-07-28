# backend/database.py
import os
from urllib.parse import urlparse, urlunparse
# import ssl
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")


def _normalize_database_url(database_url: str) -> str:
    """Use the psycopg driver for plain PostgreSQL URLs."""
    if database_url.startswith("postgresql://") and "+psycopg" not in database_url and "+psycopg2" not in database_url:
        parsed = urlparse(database_url)
        return urlunparse(parsed._replace(scheme="postgresql+psycopg"))
    return database_url


ENGINE_URL = _normalize_database_url(DATABASE_URL)

# Supabase uses PostgreSQL — create_engine works directly
# pool_pre_ping avoids stale-connection errors after idle periods
engine = create_engine(
    ENGINE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"sslmode": "require"},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency: yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()