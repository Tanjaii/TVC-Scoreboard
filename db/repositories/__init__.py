"""
Repositories package for TVC Scoreboard Python database layer.
"""

from .invitations import (
    AcceptInvitationResult,
    CreatedInvitation,
    InvitationRecord,
    accept_invitation,
    create_invitation,
    list_invitations,
    peek_invitation,
    revoke_invitation,
)
from .matches import (
    CreateMatchResult,
    SaveMatchResult,
    create_match,
    delete_match,
    get_match,
    list_matches,
    save_match,
)
from .teams import (
    TeamInput,
    TeamRecord,
    TeamResult,
    create_team,
    delete_team,
    list_teams,
    update_team,
)
from .users import LoginResult, attempt_login, count_users, list_users

__all__ = [
    "AcceptInvitationResult",
    "CreatedInvitation",
    "InvitationRecord",
    "accept_invitation",
    "create_invitation",
    "list_invitations",
    "peek_invitation",
    "revoke_invitation",
    "CreateMatchResult",
    "SaveMatchResult",
    "create_match",
    "delete_match",
    "get_match",
    "list_matches",
    "save_match",
    "TeamInput",
    "TeamRecord",
    "TeamResult",
    "create_team",
    "delete_team",
    "list_teams",
    "update_team",
    "LoginResult",
    "attempt_login",
    "count_users",
    "list_users",
]
