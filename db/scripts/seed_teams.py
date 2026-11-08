"""
Starter volleyball teams seeding script (`scripts/seed-teams.ts`).
Idempotently inserts the 4 starter teams using PostgreSQL `ON CONFLICT ((lower(name))) DO NOTHING`.

Usage:
    python -m db.scripts.seed_teams
"""

from __future__ import annotations

import sys
from typing import Optional

from sqlalchemy import text

from ..session import transaction

# Starter teams taken from the logo files supplied in `Tanjaii/TVC-Scoreboard`.
# Edit names, short names, and info in Admin > Teams.
STARTER_TEAMS: list[dict[str, str]] = [
    {"name": "Aardvark", "shortName": "AAR", "logoUrl": "/assets/aardvark-logo.jpeg"},
    {"name": "Breeze Spikers", "shortName": "BRZ", "logoUrl": "/assets/breeze-spikers-logo.jpeg"},
    {"name": "Titan Spikers", "shortName": "TTN", "logoUrl": "/assets/titan-spikers-logo.jpeg"},
    {"name": "Vortex Spikers", "shortName": "VTX", "logoUrl": "/assets/vortex-spikers-logo.jpeg"},
]


def seed_starter_teams(session=None) -> int:
    """
    Ensures all 4 starter teams exist in the `teams` table.
    Uses PostgreSQL functional index conflict target `ON CONFLICT ((lower(name))) DO NOTHING`.
    """
    sql = text(
        "INSERT INTO teams (name, short_name, logo_url) "
        "VALUES (:name, :short_name, :logo_url) "
        "ON CONFLICT ((lower(name))) DO NOTHING"
    )
    with transaction(session) as db:
        for team in STARTER_TEAMS:
            db.execute(
                sql,
                {
                    "name": team["name"],
                    "short_name": team["shortName"],
                    "logo_url": team["logoUrl"],
                },
            )
    return len(STARTER_TEAMS)


def main() -> None:
    try:
        count = seed_starter_teams()
        print(f"Ensured {count} starter teams exist.")
    except Exception as exc:
        print(f"Seeding starter teams failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
