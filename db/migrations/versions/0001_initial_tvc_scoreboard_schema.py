"""Initial TVC Scoreboard PostgreSQL Schema

Revision ID: 0001_initial
Revises: None
Create Date: 2026-11-06 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("role in ('admin', 'scorekeeper')", name="users_role_check"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "users_email_key",
        "users",
        [sa.text("lower(email)")],
        unique=True,
    )

    # 2. sessions table
    op.create_table(
        "sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("sessions_user_idx", "sessions", ["user_id"], unique=False)

    # 3. invitations table
    op.create_table(
        "invitations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("used_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("used_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("revoked_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint("role in ('admin', 'scorekeeper')", name="invitations_role_check"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["used_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )

    # 4. login_attempts table
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column(
            "at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("login_attempts_key_idx", "login_attempts", ["key", "at"], unique=False)

    # 5. teams table
    op.create_table(
        "teams",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("short_name", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("logo_url", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("info", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "teams_name_key",
        "teams",
        [sa.text("lower(name)")],
        unique=True,
    )

    # 6. matches table
    op.create_table(
        "matches",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("home_team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("away_team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stage", sa.Text(), server_default=sa.text("''"), nullable=False),
        sa.Column("scheduled_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.Text(),
            server_default=sa.text("'scheduled'"),
            nullable=False,
        ),
        sa.Column(
            "sets",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("current_set", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("stats", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "is_broadcasting",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status in ('scheduled', 'live', 'completed')",
            name="matches_status_check",
        ),
        sa.CheckConstraint(
            "home_team_id <> away_team_id",
            name="matches_different_teams_check",
        ),
        sa.ForeignKeyConstraint(["home_team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["away_team_id"], ["teams.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "matches_one_live",
        "matches",
        ["status"],
        unique=True,
        postgresql_where=sa.text("status = 'live'"),
    )
    op.create_index(
        "matches_schedule_idx",
        "matches",
        ["status", "scheduled_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("matches_schedule_idx", table_name="matches")
    op.drop_index("matches_one_live", table_name="matches")
    op.drop_table("matches")
    op.drop_index("teams_name_key", table_name="teams")
    op.drop_table("teams")
    op.drop_index("login_attempts_key_idx", table_name="login_attempts")
    op.drop_table("login_attempts")
    op.drop_table("invitations")
    op.drop_index("sessions_user_idx", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("users_email_key", table_name="users")
    op.drop_table("users")
