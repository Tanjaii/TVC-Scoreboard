"""
Schema migration CLI script for TVC Scoreboard (`scripts/migrate.ts`).
Supports both Alembic versioned migrations (`--alembic`) and idempotent execution
of `db/schema.sql`.

Usage:
    python -m db.scripts.migrate
    python -m db.scripts.migrate --alembic
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from ..session import get_engine


def run_migrations(*, use_alembic: bool = False, database_url: Optional[str] = None) -> str:
    """
    Applies the TVC Scoreboard PostgreSQL schema.
    When `use_alembic=True`, runs `alembic upgrade head`.
    Otherwise executes the idempotent `db/schema.sql` file inside a transaction.
    """
    db_dir = Path(__file__).resolve().parent.parent
    if use_alembic:
        alembic_cfg = Config(str(db_dir / "alembic.ini"))
        alembic_cfg.set_main_option("script_location", str(db_dir / "migrations"))
        if database_url:
            alembic_cfg.set_main_option("sqlalchemy.url", database_url)
        command.upgrade(alembic_cfg, "head")
        return "Alembic migrations applied up to head (0001_initial)."

    schema_path = db_dir / "schema.sql"
    schema_sql = schema_path.read_text(encoding="utf-8")
    engine = get_engine(database_url)
    with engine.begin() as conn:
        conn.exec_driver_sql(schema_sql)
    return "Database schema is up to date."


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply TVC Scoreboard PostgreSQL schema migrations.")
    parser.add_argument(
        "--alembic",
        action="store_true",
        help="Run `alembic upgrade head` instead of executing `db/schema.sql` directly.",
    )
    args = parser.parse_args()
    try:
        msg = run_migrations(use_alembic=args.alembic)
        print(msg)
    except Exception as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
