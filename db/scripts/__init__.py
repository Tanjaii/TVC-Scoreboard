"""
CLI scripts package for TVC Scoreboard database operations:
- `python -m db.scripts.migrate`
- `python -m db.scripts.seed_teams`
- `python -m db.scripts.bootstrap_admin`
"""

from .bootstrap_admin import bootstrap_first_admin
from .migrate import run_migrations
from .seed_teams import STARTER_TEAMS, seed_starter_teams

__all__ = [
    "bootstrap_first_admin",
    "run_migrations",
    "STARTER_TEAMS",
    "seed_starter_teams",
]
