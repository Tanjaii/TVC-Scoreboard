"""
First administrator invitation bootstrap script (`scripts/bootstrap-admin.ts`).
Creates the very first administrator's 24-hour one-time invitation link if `count_users(db) == 0`.
After that, invitations are created from the Admin > Invitations area.

Usage:
    python -m db.scripts.bootstrap_admin
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from typing import Optional

from ..repositories.invitations import create_invitation
from ..repositories.users import count_users
from ..session import transaction


@dataclass(frozen=True)
class BootstrapResult:
    ok: bool
    invite_url: Optional[str] = None
    token: Optional[str] = None
    expires_at: Optional[str] = None
    error: Optional[str] = None


def bootstrap_first_admin(
    session=None,
    *,
    site_url: Optional[str] = None,
) -> BootstrapResult:
    """
    Creates the very first administrator's 24-hour one-time invitation link.
    Refuses if any user account already exists in `users`.
    """
    base_url = (site_url or os.environ.get("SITE_URL") or "http://localhost:3000").rstrip("/")
    with transaction(session) as db:
        if count_users(db) > 0:
            return BootstrapResult(
                ok=False,
                error="An account already exists. Create further invitations from the admin area (Invitations).",
            )
        invite = create_invitation(
            db,
            role="admin",
            note="First administrator",
            created_by=None,
            days=1,
        )
        return BootstrapResult(
            ok=True,
            invite_url=f"{base_url}/invite/{invite.token}",
            token=invite.token,
            expires_at=invite.expiresAt,
        )


def main() -> None:
    try:
        result = bootstrap_first_admin()
        if not result.ok:
            print(result.error, file=sys.stderr)
            sys.exit(1)
        print(
            "\nOpen this one-time link within 24 hours to create the first administrator:\n\n"
            f"  {result.invite_url}\n"
        )
    except Exception as exc:
        print(f"Bootstrap failed: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
