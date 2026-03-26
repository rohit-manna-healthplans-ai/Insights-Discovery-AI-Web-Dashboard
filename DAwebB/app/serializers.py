"""Strip secrets and normalize API shapes (aligned with discovery-ai-backend-main field names)."""
from typing import Any, Dict

from bson import ObjectId


def _str_id(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, ObjectId):
        return str(val)
    return str(val)


def user_public(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Dashboard `users` collection — internal key may be user_mac_id; API exposes user_id."""
    if not doc:
        return {}
    out = dict(doc)
    out.pop("password_hash", None)
    uid = out.get("user_mac_id") or out.get("user_id") or out.get("_id")
    if uid is not None:
        sid = str(uid)
        out["_id"] = sid
        out["user_id"] = sid
        out["tracker_user_id"] = sid
        # Legacy alias only — same value as discovery's extension id for this account
        out["user_mac_id"] = sid
    return out


def plugin_user_public(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    plugin_users collection (ExtensionUser): trackerUserId links to logs.user_id / screenshots.user_id.
    """
    if not doc:
        return {}
    tid = (doc.get("trackerUserId") or doc.get("user_id") or "").strip() or _str_id(doc.get("_id"))
    email = (doc.get("email") or "").strip().lower()
    username = (doc.get("username") or "").strip()
    norm = email or (username.lower() if username else "")
    display = (doc.get("email") or doc.get("username") or tid or "").strip()
    return {
        "_id": tid,
        "user_id": tid,
        "tracker_user_id": doc.get("trackerUserId") or tid,
        "user_mac_id": tid,
        "company_username_norm": norm or None,
        "company_username": display,
        "full_name": doc.get("name") or doc.get("username") or "",
        "role_key": "DEPARTMENT_MEMBER",
        "department": None,
        "is_active": doc.get("isActive", True),
        "approval_status": "APPROVED",
        "source": "plugin_users",
        "last_seen_at": doc.get("last_seen_at"),
        "extension_browser": doc.get("extensionBrowserName") or None,
        "extension_os": doc.get("extensionOs") or None,
    }


def department_public(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return {}
    return {
        "_id": doc.get("_id"),
        "department_name": doc.get("department_name"),
        "department_code": doc.get("department_code") or doc.get("_id"),
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def log_row(doc: Dict[str, Any]) -> Dict[str, Any]:
    """logs collection: discovery uses user_id; legacy rows may use user_mac_id."""
    if not doc:
        return {}
    uid = doc.get("user_id") or doc.get("user_mac_id")
    out = {
        "_id": str(doc.get("_id")) if doc.get("_id") is not None else None,
        "log_id": doc.get("log_id"),
        "user_id": uid,
        "tracker_user_id": uid,
        "user_mac_id": uid,
        "pc_username": doc.get("pc_username"),
        "ts": doc.get("ts"),
        "category": doc.get("category"),
        "category_key": doc.get("category_key"),
        "event_type": doc.get("event_type"),
        "details": doc.get("details"),
        "application": doc.get("application"),
        "window_title": doc.get("window_title"),
        "application_tab": doc.get("application_tab"),
        "operation": doc.get("operation"),
        "screenshot_id": doc.get("screenshot_id"),
        "created_at": doc.get("created_at"),
    }
    return out


def screenshot_row(doc: Dict[str, Any]) -> Dict[str, Any]:
    """screenshots collection: discovery uses user_id."""
    if not doc:
        return {}
    op = doc.get("operation")
    uid = doc.get("user_id") or doc.get("user_mac_id")
    out = {
        "_id": str(doc.get("_id")) if doc.get("_id") is not None else None,
        "screenshot_id": doc.get("screenshot_id"),
        "user_id": uid,
        "tracker_user_id": uid,
        "user_mac_id": uid,
        "pc_username": doc.get("pc_username"),
        "ts": doc.get("ts"),
        "application": doc.get("application"),
        "window_title": doc.get("window_title"),
        "application_tab": doc.get("application_tab"),
        "operation": op,
        "label": doc.get("label") or op,
        "file_path": doc.get("file_path"),
        "screenshot_url": doc.get("screenshot_url"),
        "created_at": doc.get("created_at"),
    }
    return out
