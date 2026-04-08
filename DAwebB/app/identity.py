"""
Identity alignment with discovery-ai-backend-main:

- plugin_users: trackerUserId (required), email, username, …
- logs / screenshots: user_id = extension batch item.userId (same string as trackerUserId)

Dashboard `users` collection still stores legacy field user_mac_id as the primary key for
password/JWT users; API responses expose user_id / tracker_user_id as canonical names.

Merged view: same work email on multiple browsers => multiple trackerUserIds in plugin_users.
When querying by company_username (email), all those IDs are included in $in queries.
"""
from typing import Any, Dict, List, Optional, Set, Tuple

from app.config import COL_PLUGIN_USERS, COL_USERS
from app.db import get_db


def _norm_email(s: str) -> str:
    return (s or "").strip().lower()


def resolve_telemetry_user_id(db, args: Dict[str, Any]) -> str:
    """
    Resolve a single id (first match) — legacy callers.

    Accepts (priority): user_id, tracker_user_id, user_mac_id (legacy alias),
    or company_username / email lookup in users then plugin_users.
    """
    ids, _ = resolve_telemetry_user_ids(db, args)
    return ids[0] if ids else ""


def resolve_telemetry_user_ids(db, args: Dict[str, Any]) -> Tuple[List[str], Optional[str]]:
    """
    Return (list of user_id / trackerUserId strings, optional email used for RBAC).

    When `company_username` or `email` is present, merge ALL plugin_users.trackerUserId
    for that email plus the dashboard `users.user_mac_id` for that email (if any).

    Otherwise returns a single-element list from user_id / tracker_user_id / user_mac_id.
    """
    company_username = (args.get("company_username") or args.get("email") or "").strip()
    target = (
        (args.get("user_id") or "").strip()
        or (args.get("tracker_user_id") or "").strip()
        or (args.get("user_mac_id") or "").strip()
    )

    ids: Set[str] = set()
    scope_email: Optional[str] = None

    if company_username:
        raw = company_username.strip()
        low = _norm_email(company_username)

        if "@" in raw:
            # Same work email across Chrome, Edge, Safari, etc.
            for pu in db[COL_PLUGIN_USERS].find(
                {"$or": [{"email": low}, {"email": raw}]},
                {"trackerUserId": 1},
            ):
                tid = (pu.get("trackerUserId") or "").strip()
                if tid:
                    ids.add(tid)
            u = db[COL_USERS].find_one(
                {"$or": [{"company_username_norm": low}, {"company_username": raw}]},
                {"user_mac_id": 1, "_id": 1},
            )
            if u:
                um = str(u.get("user_mac_id") or u.get("_id") or "").strip()
                if um:
                    ids.add(um)
            if ids:
                return (sorted(ids), low)
        else:
            for pu in db[COL_PLUGIN_USERS].find(
                {"$or": [{"username": raw}, {"username": low}]},
                {"trackerUserId": 1},
            ):
                tid = (pu.get("trackerUserId") or "").strip()
                if tid:
                    ids.add(tid)
            if ids:
                return (sorted(ids), None)

    if target:
        return ([target], None)

    return ([], None)


def actor_effective_id(actor: Optional[Dict[str, Any]]) -> str:
    """Logged-in dashboard user id (JWT sub) — same string we store in users._id / user_mac_id."""
    if not actor:
        return ""
    return str(
        actor.get("user_id")
        or actor.get("user_mac_id")
        or actor.get("_id")
        or ""
    ).strip()
