"""Strip secrets and normalize API shapes (aligned with discovery-ai-backend-main field names)."""
import json
from typing import Any, Dict
from urllib.parse import urlparse

from bson import ObjectId


def _parse_web_details(details: Any) -> Dict[str, Any]:
    """Extract browser, url, title from discovery `details` JSON string (`{ \"web\": { ... } }`)."""
    out: Dict[str, Any] = {}
    if not details or not isinstance(details, str):
        return out
    try:
        j = json.loads(details)
    except Exception:
        return out
    web = j.get("web") if isinstance(j, dict) else None
    if not isinstance(web, dict):
        return out
    meta = web.get("extensionMeta") if isinstance(web.get("extensionMeta"), dict) else {}
    if meta.get("browserName"):
        out["browser_name"] = str(meta.get("browserName"))[:80]
    if meta.get("os"):
        out["client_os"] = str(meta.get("os"))[:80]
    if meta.get("platform"):
        out["client_platform"] = str(meta.get("platform"))[:80]
    if web.get("url"):
        out["page_url"] = str(web.get("url"))[:2000]
    title = web.get("title")
    if title is not None:
        out["page_title"] = str(title)[:500]
    return out


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
    out.pop("is_active", None)
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
    details = doc.get("details")
    parsed = _parse_web_details(details)
    app = doc.get("application") or ""
    win = doc.get("window_title") or ""
    tab = doc.get("application_tab") or ""
    # Concise one-liner for UI: browser · page title · host
    summary_parts = []
    if parsed.get("browser_name"):
        summary_parts.append(parsed["browser_name"])
    pt = parsed.get("page_title") or ""
    if pt:
        summary_parts.append(pt[:120] + ("…" if len(pt) > 120 else ""))
    elif win:
        summary_parts.append(win[:120] + ("…" if len(str(win)) > 120 else ""))
    if parsed.get("page_url"):
        try:
            host = urlparse(parsed["page_url"]).netloc or ""
            if host:
                summary_parts.append(host)
        except Exception:
            pass
    elif app and app != "browser":
        summary_parts.append(app)
    summary = " · ".join(summary_parts) if summary_parts else (tab or "—")

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
        "details": details,
        "details_summary": summary,
        "application": app,
        "window_title": win,
        "application_tab": tab,
        "operation": doc.get("operation"),
        "capture_screen": doc.get("capture_screen"),
        "screenshot_id": doc.get("screenshot_id"),
        "client_delivery_id": doc.get("client_delivery_id") or None,
        "created_at": doc.get("created_at"),
        "browser_name": parsed.get("browser_name"),
        "client_os": parsed.get("client_os"),
        "page_url": parsed.get("page_url"),
        "page_title": parsed.get("page_title"),
    }
    return out


def screenshot_row(doc: Dict[str, Any]) -> Dict[str, Any]:
    """screenshots collection: discovery uses user_id."""
    if not doc:
        return {}
    op = doc.get("operation")
    uid = doc.get("user_id") or doc.get("user_mac_id")
    app = doc.get("application") or ""
    win = doc.get("window_title") or ""
    tab = doc.get("application_tab") or ""
    browser = (doc.get("browser_name") or "").strip()
    cos = (doc.get("client_os") or "").strip()
    summary = " · ".join([x for x in [browser or None, app, win[:80] if win else ""] if x]) or tab or "—"
    out = {
        "_id": str(doc.get("_id")) if doc.get("_id") is not None else None,
        "screenshot_id": doc.get("screenshot_id"),
        "user_id": uid,
        "tracker_user_id": uid,
        "user_mac_id": uid,
        "pc_username": doc.get("pc_username"),
        "ts": doc.get("ts"),
        "application": app,
        "window_title": win,
        "application_tab": tab,
        "browser_name": browser or None,
        "client_os": cos or None,
        "details_summary": summary,
        "operation": op,
        "capture_screen": doc.get("capture_screen"),
        "label": doc.get("label") or op,
        "file_path": doc.get("file_path"),
        "screenshot_url": doc.get("screenshot_url"),
        "created_at": doc.get("created_at"),
        "client_delivery_id": doc.get("client_delivery_id") or None,
    }
    return out
