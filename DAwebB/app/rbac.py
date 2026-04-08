from typing import Any, Dict, List, Optional, Set

from app.config import COL_PLUGIN_USERS, COL_USERS
from app.db import get_db


ROLE_C = "C_SUITE"
ROLE_HEAD = "DEPARTMENT_HEAD"
ROLE_MEMBER = "DEPARTMENT_MEMBER"


def role_from_user(doc: Optional[Dict[str, Any]]) -> str:
    if not doc:
        return ""
    r = str(doc.get("role_key") or "").strip().upper().replace(" ", "_")
    if r in ("C-SUITE", "CSUITE"):
        r = ROLE_C
    return r


def load_user_by_id(session_id: str) -> Optional[Dict[str, Any]]:
    """JWT sub — dashboard users._id or user_mac_id (legacy name)."""
    if not session_id:
        return None
    db = get_db()
    return db[COL_USERS].find_one(
        {"$or": [{"_id": session_id}, {"user_mac_id": session_id}, {"user_id": session_id}]}
    )


def allowed_user_mac_ids_for_actor(actor: Dict[str, Any]) -> Optional[Set[str]]:
    """
    None = full access (C-Suite).
    Set[str] = only these device ids.
    """
    r = role_from_user(actor)
    if r == ROLE_C:
        return None
    if r == ROLE_HEAD:
        dept = (actor.get("department") or "").strip()
        if not dept:
            return set()
        db = get_db()
        cur = db[COL_USERS].find(
            {"department": dept},
            {"_id": 1, "user_mac_id": 1},
        )
        out: Set[str] = set()
        for d in cur:
            uid = d.get("user_id") or d.get("user_mac_id") or d.get("_id")
            if uid:
                out.add(str(uid))
        return out
    if r == ROLE_MEMBER:
        uid = actor.get("user_id") or actor.get("user_mac_id") or actor.get("_id")
        if uid:
            return {str(uid)}
        return set()
    return set()


def can_access_user_mac_id(actor: Dict[str, Any], target_uid: str) -> bool:
    allowed = allowed_user_mac_ids_for_actor(actor)
    if allowed is None:
        return True
    return str(target_uid) in allowed


def can_access_screenshot_tracker(actor: Dict[str, Any], target_uid: str) -> bool:
    """
    SAS URL / single-doc access: screenshot rows use extension `user_id` (trackerUserId),
    which may differ from dashboard `user_mac_id`. Allow if same person via plugin_users.email.
    """
    if not actor or not target_uid:
        return False
    if can_access_user_mac_id(actor, target_uid):
        return True
    allowed = allowed_user_mac_ids_for_actor(actor)
    if allowed is None:
        return True
    r = role_from_user(actor)
    db = get_db()
    pu = db[COL_PLUGIN_USERS].find_one({"trackerUserId": str(target_uid)}, {"email": 1})
    if not pu or not pu.get("email"):
        return False
    ext_email = str(pu.get("email")).strip().lower()
    if r == ROLE_MEMBER:
        me_email = (
            str(actor.get("company_username_norm") or actor.get("company_username") or actor.get("email") or "")
            .strip()
            .lower()
        )
        return bool(me_email and ext_email == me_email)
    if r == ROLE_HEAD:
        dept = (actor.get("department") or "").strip()
        if not dept:
            return False
        qu = db[COL_USERS].find_one(
            {
                "$or": [
                    {"company_username_norm": ext_email},
                    {"company_username": pu.get("email")},
                ],
                "department": dept,
            },
            {"_id": 1},
        )
        return qu is not None
    return False


def can_access_telemetry_targets(
    actor: Dict[str, Any],
    target_ids: List[str],
    scope_email: Optional[str] = None,
) -> bool:
    """
    RBAC for logs/screenshots when one person may have multiple trackerUserIds (merged by email).

    - C_SUITE: always allowed.
    - DEPARTMENT_MEMBER: own email matches scope_email OR own dashboard id is in target_ids.
    - DEPARTMENT_HEAD: scope_email resolves to a user in the same department, OR any target_id in allowed set.
    """
    if not actor:
        return False
    allowed = allowed_user_mac_ids_for_actor(actor)
    if allowed is None:
        return True
    r = role_from_user(actor)
    if r == ROLE_MEMBER:
        me_email = (
            str(actor.get("company_username_norm") or actor.get("company_username") or actor.get("email") or "")
            .strip()
            .lower()
        )
        if scope_email and me_email and scope_email.strip().lower() == me_email:
            return True
        uid = str(actor.get("user_id") or actor.get("user_mac_id") or actor.get("_id") or "")
        if uid and target_ids and uid in target_ids:
            return True
        return False
    if r == ROLE_HEAD:
        dept = (actor.get("department") or "").strip()
        if not dept:
            return False
        if scope_email and "@" in scope_email:
            db = get_db()
            qu = db[COL_USERS].find_one(
                {
                    "$or": [
                        {"company_username_norm": scope_email.strip().lower()},
                        {"company_username": scope_email.strip()},
                    ],
                    "department": dept,
                },
                {"_id": 1},
            )
            if qu is not None:
                return True
        if target_ids:
            return any(tid in allowed for tid in target_ids)
        return False
    return False


def list_users_filter_query(actor: Dict[str, Any]) -> Dict[str, Any]:
    r = role_from_user(actor)
    if r == ROLE_C:
        return {}
    if r == ROLE_HEAD:
        dept = (actor.get("department") or "").strip()
        if not dept:
            return {"_id": {"$exists": False}}
        return {"department": dept}
    return {"_id": {"$exists": False}}
