"""
Database engine, session factory, transactional context manager, and PostgreSQL
SQLSTATE error inspection helpers (mirroring `lib/db.ts`).
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Generator, Optional

from sqlalchemy import Engine, create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from .config import DatabaseSettings, normalize_postgres_url

_ENGINE: Optional[Engine] = None
_SESSION_FACTORY: Optional[sessionmaker[Session]] = None


def set_engine(engine: Optional[Engine]) -> None:
    """Allows tests to swap or reset the global SQLAlchemy engine."""
    global _ENGINE, _SESSION_FACTORY
    _ENGINE = engine
    _SESSION_FACTORY = (
        sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
        if engine is not None
        else None
    )


def get_engine(database_url: Optional[str] = None) -> Engine:
    """Returns or initializes the singleton SQLAlchemy 2.0 Engine for PostgreSQL."""
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is not None and database_url is None:
        return _ENGINE

    settings = (
        DatabaseSettings(
            database_url=normalize_postgres_url(database_url),
            site_url="http://localhost:3000",
        )
        if database_url
        else DatabaseSettings.from_env()
    )
    engine = create_engine(
        settings.database_url,
        echo=settings.echo_sql,
        pool_pre_ping=True,
        pool_size=settings.pool_size,
        max_overflow=settings.max_overflow,
    )
    if database_url is None:
        set_engine(engine)
    return engine


def get_session_factory(database_url: Optional[str] = None) -> sessionmaker[Session]:
    """Returns a configured SQLAlchemy sessionmaker."""
    global _SESSION_FACTORY
    if _SESSION_FACTORY is not None and database_url is None:
        return _SESSION_FACTORY
    engine = get_engine(database_url)
    factory = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    if database_url is None:
        _SESSION_FACTORY = factory
    return factory


@contextmanager
def transaction(session: Optional[Session] = None) -> Generator[Session, None, None]:
    """
    Runs operations inside a single database transaction; any raised exception
    rolls everything back cleanly, mirroring `db.transaction(fn)` in `lib/db.ts`.
    """
    owns_session = session is None
    db_session = session if session is not None else get_session_factory()()
    try:
        if db_session.in_transaction():
            with db_session.begin_nested():
                yield db_session
        else:
            with db_session.begin():
                yield db_session
    except Exception:
        if owns_session and db_session.is_active:
            db_session.rollback()
        raise
    finally:
        if owns_session:
            db_session.close()


def _extract_pgcode_and_constraint(error: BaseException) -> tuple[Optional[str], Optional[str], str]:
    """Extracts PostgreSQL SQLSTATE code (e.g. '23505') and constraint name from DBAPI errors."""
    orig: Any = getattr(error, "orig", error)
    pgcode: Optional[str] = getattr(orig, "pgcode", None) or getattr(orig, "sqlstate", None)
    diag: Any = getattr(orig, "diag", None)
    constraint_name: Optional[str] = getattr(diag, "constraint_name", None) if diag else None
    message = str(orig or error)
    return pgcode, constraint_name, message


def is_unique_violation(error: BaseException, constraint_or_index: Optional[str] = None) -> bool:
    """
    PostgreSQL unique-violation helper (SQLSTATE 23505).
    Also supports matching constraint or index names such as `matches_one_live`,
    `users_email_key`, or `teams_name_key`.
    """
    if not isinstance(error, (IntegrityError, Exception)):
        return False
    pgcode, constraint, message = _extract_pgcode_and_constraint(error)
    is_23505 = pgcode == "23505" or "unique constraint" in message.lower() or "duplicate key" in message.lower()
    if not is_23505:
        return False
    if not constraint_or_index:
        return True
    return constraint == constraint_or_index or constraint_or_index in message


def is_foreign_key_violation(error: BaseException) -> bool:
    """
    PostgreSQL foreign-key violation helper.
    23503 = foreign_key_violation; 23001 = restrict_violation (ON DELETE RESTRICT).
    """
    if not isinstance(error, (IntegrityError, Exception)):
        return False
    pgcode, _, message = _extract_pgcode_and_constraint(error)
    return (
        pgcode in ("23503", "23001")
        or "foreign key constraint" in message.lower()
        or "violates foreign key" in message.lower()
    )
