from flask import Blueprint, jsonify, request

from app.auth_jwt import require_auth
from app.config import COL_LOGS
from app.db import get_db
from app.identity import resolve_telemetry_user_ids
from app.rbac import can_access_telemetry_targets, load_user_by_id
from app.serializers import log_row
from app.time_range import range_iso_strings

bp = Blueprint("logs", __name__, url_prefix="/api/logs")

# Only fields the dashboard needs — less data over the wire & faster BSON decode
_LOG_FIELDS = {
    "_id": 1,
    "log_id": 1,
    "user_mac_id": 1,
    "user_id": 1,
    "pc_username": 1,
    "ts": 1,
    "category": 1,
    "category_key": 1,
    "event_type": 1,
    "details": 1,
    "application": 1,
    "window_title": 1,
    "application_tab": 1,
    "operation": 1,
    "capture_screen": 1,
    "screenshot_id": 1,
    "client_delivery_id": 1,
    "created_at": 1,
}


def _actor(request):
    uid = getattr(request, "jwt_payload", {}).get("sub")
    return load_user_by_id(uid) if uid else None


@bp.get("")
@require_auth
def list_logs():
    actor = _actor(request)
    if not actor:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    from_d = (request.args.get("from") or "").strip()
    to_d = (request.args.get("to") or "").strip()

    if not from_d or not to_d:
        return jsonify({"ok": False, "error": "from and to (YYYY-MM-DD) required"}), 400

    try:
        start_iso, end_iso = range_iso_strings(from_d, to_d)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Invalid date range: {e}"}), 400

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

    try:
        page = max(1, int(request.args.get("page") or 1))
    except ValueError:
        page = 1
    try:
        limit = min(500, max(1, int(request.args.get("limit") or 100)))
    except ValueError:
        limit = 100

    # discovery-ai-backend-main ActivityLog: user_id = extension userId; merge multiple IDs (same email, different browsers)
    uid_clause: dict
    if len(target_ids) == 1:
        tid = target_ids[0]
        uid_clause = {"$or": [{"user_mac_id": tid}, {"user_id": tid}]}
    else:
        uid_clause = {"$or": [{"user_id": {"$in": target_ids}}, {"user_mac_id": {"$in": target_ids}}]}

    filt: dict = {"$and": [uid_clause, {"ts": {"$gte": start_iso, "$lte": end_iso}}]}

    col = db[COL_LOGS]
    total = col.count_documents(filt)
    skip = (page - 1) * limit

    cur = col.find(filt, _LOG_FIELDS).sort("ts", -1).skip(skip).limit(limit)

    items = [log_row(d) for d in cur]
    return jsonify(
        {
            "ok": True,
            "data": {
                "items": items,
                "total": total,
                "page": page,
                "limit": limit,
                "merged_tracker_count": len(target_ids),
            },
        }
    )
