from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from app.auth_jwt import require_auth
from app.config import COL_USER_HEARTBEATS
from app.db import get_db
from app.identity import resolve_telemetry_user_ids
from app.rbac import can_access_telemetry_targets, load_user_by_id

bp = Blueprint("user_heartbeat", __name__, url_prefix="/api/user-heartbeat")


def _actor(request):
    uid = getattr(request, "jwt_payload", {}).get("sub")
    return load_user_by_id(uid) if uid else None


def _as_utc_aware(dt) -> datetime | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    return None


@bp.get("")
@require_auth
def get_user_heartbeat():
    """Latest extension heartbeat per tracker id (merged email => multiple rows)."""
    actor = _actor(request)
    if not actor:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    try:
        threshold_minutes = max(1, min(120, int(request.args.get("threshold_minutes") or 10)))
    except ValueError:
        threshold_minutes = 10

    db = get_db()
    args = dict(request.args)
    target_ids, scope_email = resolve_telemetry_user_ids(db, args)

    if not target_ids:
        return jsonify(
            {
                "ok": False,
                "error": "user_id or tracker_user_id (or legacy user_mac_id / company_username) required",
            }
        ), 400

    if not can_access_telemetry_targets(actor, target_ids, scope_email):
        return jsonify({"ok": False, "error": "Forbidden"}), 403

    col = db[COL_USER_HEARTBEATS]
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=threshold_minutes)

    per_tracker = []
    latest_any: datetime | None = None

    for tid in target_ids:
        row = col.find_one({"user_id": tid}, {"user_id": 1, "last_heartbeat_at": 1, "extension_version": 1, "browser": 1, "os": 1})
        raw_ts = row.get("last_heartbeat_at") if row else None
        ts_aware = _as_utc_aware(raw_ts)
        online = bool(ts_aware and ts_aware >= cutoff)
        iso = ts_aware.isoformat().replace("+00:00", "Z") if ts_aware else None
        if ts_aware and (latest_any is None or ts_aware > latest_any):
            latest_any = ts_aware
        per_tracker.append(
            {
                "user_id": tid,
                "last_heartbeat_at": iso,
                "online": online,
                "extension_version": (row or {}).get("extension_version") or "",
                "browser": (row or {}).get("browser") or "",
                "os": (row or {}).get("os") or "",
            }
        )

    merged_online = any(x["online"] for x in per_tracker)
    merged_iso = latest_any.isoformat().replace("+00:00", "Z") if latest_any else None

    return jsonify(
        {
            "ok": True,
            "data": {
                "per_tracker": per_tracker,
                "last_heartbeat_at": merged_iso,
                "online": merged_online,
                "threshold_minutes": threshold_minutes,
            },
        }
    )
