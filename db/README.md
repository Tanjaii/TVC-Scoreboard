# TVC Scoreboard — Python Database Package (`db`)

Production-ready Python database layer for **[Tanjaii/TVC-Scoreboard](https://github.com/Tanjaii/TVC-Scoreboard)** built with **SQLAlchemy 2.0** and **Alembic** targeting **PostgreSQL / Neon Serverless Postgres**.

## Package Structure

```text
db/
├── __init__.py                 # Public package exports
├── schema.sql                  # Idempotent PostgreSQL DDL schema
├── config.py                   # DATABASE_URL & SITE_URL settings (Neon/Postgres compatible)
├── models.py                   # SQLAlchemy 2.0 Declarative Mapped ORM models (6 tables)
├── session.py                  # Engine, sessionmaker, transaction() context, SQLSTATE 23505/23503 helpers
├── auth.py                     # Scrypt (N=16384, r=8, p=1) password hashing & SHA-256 token hashing
├── match_logic.py              # Volleyball match validation, role permissions & conflict diffing
├── alembic.ini                 # Alembic CLI configuration
├── requirements.txt            # Python package dependencies
├── migrations/
│   ├── env.py                  # Alembic migration runner bound to Base.metadata
│   ├── script.py.mako          # Alembic revision template
│   └── versions/
│       └── 0001_initial_tvc_scoreboard_schema.py
├── repositories/
│   ├── __init__.py
│   ├── users.py                # Login rate limiting (5/email, 30/IP per 15m) & user queries
│   ├── invitations.py          # Single-use invitation links & atomic account creation
│   ├── teams.py                # Team CRUD with lower(name) uniqueness & ON DELETE RESTRICT handling
│   └── matches.py              # Match CRUD with SELECT ... FOR UPDATE row locking & version checking
└── scripts/
    ├── __init__.py
    ├── migrate.py              # CLI: Apply schema.sql or Alembic migrations
    ├── seed_teams.py           # CLI: Seed 4 starter volleyball teams (Aardvark, Breeze, Titan, Vortex)
    └── bootstrap_admin.py      # CLI: Create the first 24-hour one-time administrator invitation link
```

## Quick Start

```bash
# 1. Install Python dependencies
pip install -r db/requirements.txt

# 2. Set your PostgreSQL / Neon connection string in .env or .env.local
export DATABASE_URL="postgresql://user:pass@ep-example.region.aws.neon.tech/neondb?sslmode=require"
export SITE_URL="http://localhost:3000"

# 3. Run schema migration (idempotent schema.sql or Alembic)
python -m db.scripts.migrate
# Or using Alembic revision history:
python -m db.scripts.migrate --alembic

# 4. Seed the 4 starter volleyball teams
python -m db.scripts.seed_teams

# 5. Bootstrap the first administrator one-time invitation link
python -m db.scripts.bootstrap_admin
```
