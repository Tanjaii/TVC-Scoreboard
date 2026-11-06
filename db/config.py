"""
Database configuration and environment loading for TVC Scoreboard.
Supports Neon Serverless Postgres and standard PostgreSQL connection strings.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

try:
    from dotenv import load_dotenv
    # Load .env.local first (Next.js convention in TVC-Scoreboard), then .env
    root_dir = Path(__file__).resolve().parent.parent
    load_dotenv(root_dir / ".env.local")
    load_dotenv(root_dir / ".env")
except ImportError:
    pass


def normalize_postgres_url(url: str) -> str:
    """
    Normalizes a PostgreSQL connection URL for SQLAlchemy 2.0 + Psycopg 3.
    Converts `postgres://` or `postgresql://` to `postgresql+psycopg://` if no
    explicit driver is specified, while preserving query parameters like `sslmode=require`.
    """
    raw = url.strip()
    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg://" + raw[len("postgres://") :]
    elif raw.startswith("postgresql://"):
        raw = "postgresql+psycopg://" + raw[len("postgresql://") :]

    parsed = urlparse(raw)
    query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    # Strip channel_binding if unsupported by certain serverless poolers
    normalized_query = urlencode(query_params)
    return urlunparse(parsed._replace(query=normalized_query))


@dataclass(frozen=True)
class DatabaseSettings:
    database_url: str
    site_url: str
    echo_sql: bool = False
    pool_size: int = 5
    max_overflow: int = 10

    @classmethod
    def from_env(cls) -> "DatabaseSettings":
        raw_url = os.environ.get("DATABASE_URL", "").strip()
        if not raw_url:
            raise RuntimeError(
                "DATABASE_URL is not set. Add your PostgreSQL / Neon connection string to .env or .env.local."
            )
        site_url = os.environ.get("SITE_URL", "http://localhost:3000").rstrip("/")
        echo_sql = os.environ.get("DB_ECHO", "false").lower() in ("1", "true", "yes")
        return cls(
            database_url=normalize_postgres_url(raw_url),
            site_url=site_url,
            echo_sql=echo_sql,
        )
