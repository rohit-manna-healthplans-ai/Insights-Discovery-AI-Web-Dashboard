"""
Identity alignment with discovery-ai-backend-main:

- plugin_users: trackerUserId (required), email, username, …
- logs / screenshots: user_id = extension batch item.userId (same string as trackerUserId)

Dashboard `users` collection still stores legacy field user_mac_id as the primary key for
password/JWT users; API responses expose user_id / tracker_user_id as canonical names.
"""
from typing import Any, Dict, Optional

from app.config import COL_PLUGIN_USERS, COL_USERS
from app.db import get_db


def resolve_telemetry_user_id(db, args: Dict[str, Any]) -> str:
    """
    Resolve the id used in logs.user_id / screenshots.user_id.

    Accepts (priority): user_id, tracker_user_id, user_mac_id (legacy alias),
    or company_username / email lookup in users then plugin_users.
    """
    target = (
        (args.get("user_id") or "").strip()
        or (args.get("tracker_user_id") or "").strip()
        or (args.get("user_mac_id") or "").strip()
    )
    company_username = (args.get("company_username") or args.get("email") or "").strip()
    if not target and company_username:
        low = company_username.lower()
        u = db[COL_USERS].find_one(
            {"$or": [{"company_username_norm": low}, {"company_username": company_username}]},
            {"_id": 1, "user_mac_id": 1},
        )
        if u:
            return str(u.get("user_mac_id") or u.get("_id") or "")
        pu = db[COL_PLUGIN_USERS].find_one(
            {"$or": [{"email": low}, {"username": low}, {"username": company_username}]}
        )
        if pu and pu.get("trackerUserId"):
            return str(pu["trackerUserId"]).strip()
    return target


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
