"""
Grouped validation log pipelines for the dashboard (by client_delivery_id),
plus screenshot rows linked to the same delivery ids.
"""
from collections import defaultdict
from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request

from app.auth_jwt import require_auth
from app.config import COL_LOGS, COL_SCREENSHOTS, COL_VALIDATION_LOGS
from app.db import get_db
from app.identity import resolve_telemetry_user_ids
from app.rbac import can_access_telemetry_targets, load_user_by_id
from app.serializers import screenshot_row
from app.time_range import range_iso_strings, range_utc_datetimes

bp = Blueprint("validation_overview", __name__, url_prefix="/api/validation-overview")


def _actor(request):
    uid = getattr(request, "jwt_payload", {}).get("sub")
    return load_user_by_id(uid) if uid else None


def _iso(val):
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        return val.isoformat().replace("+00:00", "Z")
    return val


def _serialize_value(val):
    """JSON-friendly values for every validation_logs attribute (aligned with discovery ValidationLog schema)."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.isoformat().replace("+00:00", "Z")
    if isinstance(val, ObjectId):
        return str(val)
    if isinstance(val, dict):
        return {str(k): _serialize_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_serialize_value(x) for x in val]
    if isinstance(val, (bool, int, float)):
        return val
    if isinstance(val, str):
        return val
    cls = type(val).__name__
    if cls == "Decimal128" and hasattr(val, "to_decimal"):
        return str(val.to_decimal())
    if cls == "Binary" and hasattr(val, "__len__"):
        return f"<binary {len(val)} bytes>"
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    return str(val)


def validation_log_public(doc: dict) -> dict:
    """
    Full validation log document for the dashboard — every stored field the API returns,
    so new schema fields on the server still appear without code changes.
    """
    if not doc:
        return {}
    out: dict = {}
    for k, v in doc.items():
        if k == "grp":
            continue
        if k == "_id":
            out["_id"] = str(v) if v is not None else None
            continue
        sv = _serialize_value(v)
        if k == "error_stack" and isinstance(sv, str) and len(sv) > 24000:
            sv = sv[:24000] + "\n… (truncated for dashboard payload)"
        out[str(k)] = sv
    return out


_MERGE_FETCH_CAP = 4000


def _object_id_or_none(raw: str):
    s = (raw or "").strip()
    if not s or len(s) != 24:
        return None
    try:
        return ObjectId(s)
    except Exception:
        return None


def _resolve_focused_client_delivery_id(
    db,
    uid_clause_s: dict,
    focus_delivery_id: str,
    focus_screenshot_id: str,
    focus_log_id: str,
) -> tuple[str, str]:
    """
    Returns (client_delivery_id, resolved_via) for validation journey linking from dashboard.
    Via is one of: delivery_id, screenshot, log, screenshot_via_log, empty string.
    """
    did = (focus_delivery_id or "").strip()
    if did:
        return did, "delivery_id"

    sid = (focus_screenshot_id or "").strip()
    if sid:
        shot_or = [{"screenshot_id": sid}]
        oid = _object_id_or_none(sid)
        if oid is not None:
            shot_or.append({"_id": oid})
        doc = db[COL_SCREENSHOTS].find_one({"$and": [uid_clause_s, {"$or": shot_or}]})
        if doc:
            cid = (doc.get("client_delivery_id") or "").strip()
            if cid:
                return cid, "screenshot"
        return "", ""

    lid = (focus_log_id or "").strip()
    if not lid:
        return "", ""

    log_or = [{"log_id": lid}]
    oid_l = _object_id_or_none(lid)
    if oid_l is not None:
        log_or.append({"_id": oid_l})
    log_doc = db[COL_LOGS].find_one({"$and": [uid_clause_s, {"$or": log_or}]})
    if not log_doc:
        return "", ""

    cid = (log_doc.get("client_delivery_id") or "").strip()
    if cid:
        return cid, "log"

    shot_ref = (log_doc.get("screenshot_id") or "").strip()
    if not shot_ref:
        return "", ""

    shot_or2 = [{"screenshot_id": shot_ref}]
    oid_s = _object_id_or_none(shot_ref)
    if oid_s is not None:
        shot_or2.append({"_id": oid_s})
    shot_doc = db[COL_SCREENSHOTS].find_one({"$and": [uid_clause_s, {"$or": shot_or2}]})
    if shot_doc:
        cid2 = (shot_doc.get("client_delivery_id") or "").strip()
        if cid2:
            return cid2, "screenshot_via_log"
    return "", ""


def _sort_key_ts(ts) -> datetime:
    if ts is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    if isinstance(ts, datetime):
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    s = str(ts).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return datetime.min.replace(tzinfo=timezone.utc)


def _stage_status_label(st: dict) -> str:
    if not st:
        return "—"
    return f"{st.get('stage') or '—'} · {st.get('status') or '—'}"


def _build_interlinked_table(
    db,
    uid_clause_s: dict,
    start_iso: str,
    end_iso: str,
    v_col,
    page: int,
    limit: int,
) -> dict:
    """
    Single timeline: activity logs + screenshots sorted by time, with shared client_delivery_id
    and the first two validation stages for interpretability.
    """
    log_filt: dict = {"$and": [uid_clause_s, {"ts": {"$gte": start_iso, "$lte": end_iso}}]}
    shot_filt: dict = {"$and": [uid_clause_s, {"ts": {"$gte": start_iso, "$lte": end_iso}}]}

    log_proj = {
        "log_id": 1,
        "ts": 1,
        "client_delivery_id": 1,
        "screenshot_id": 1,
        "event_type": 1,
        "category": 1,
        "operation": 1,
    }
    shot_proj = {
        "screenshot_id": 1,
        "ts": 1,
        "client_delivery_id": 1,
        "application": 1,
        "window_title": 1,
    }

    logs = list(db[COL_LOGS].find(log_filt, log_proj).sort("ts", -1).limit(_MERGE_FETCH_CAP))
    shots = list(db[COL_SCREENSHOTS].find(shot_filt, shot_proj).sort("ts", -1).limit(_MERGE_FETCH_CAP))

    shot_delivery_by_sid: dict[str, str] = {}
    for s in shots:
        sid = (str(s.get("screenshot_id") or s.get("_id") or "")).strip()
        if not sid:
            continue
        cid = (s.get("client_delivery_id") or "").strip()
        shot_delivery_by_sid[sid] = cid

    logs_by_shot: dict[str, list[str]] = defaultdict(list)
    for lg in logs:
        lid = (lg.get("log_id") or str(lg.get("_id") or "")).strip()
        sid = (lg.get("screenshot_id") or "").strip()
        if sid and lid:
            logs_by_shot[sid].append(lid)

    merged: list[dict] = []

    for lg in logs:
        lid = (lg.get("log_id") or str(lg.get("_id") or "")).strip()
        sid = (lg.get("screenshot_id") or "").strip()
        raw_cid = (lg.get("client_delivery_id") or "").strip()
        eff = raw_cid or (shot_delivery_by_sid.get(sid, "").strip() if sid else "")
        rel_parts = []
        if sid:
            rel_parts.append(f"Screenshot id: {sid}")
        merged.append(
            {
                "_sort": _sort_key_ts(lg.get("ts")),
                "row_kind": "activity_log",
                "item_label": "Activity log",
                "primary_id": lid or "—",
                "time": lg.get("ts"),
                "client_delivery_id": raw_cid or None,
                "effective_delivery_id": eff or None,
                "related_summary": " · ".join(rel_parts) if rel_parts else None,
                "context": (lg.get("operation") or lg.get("category") or lg.get("event_type") or "")[:120] or None,
            }
        )

    for s in shots:
        sid = (str(s.get("screenshot_id") or s.get("_id") or "")).strip()
        if not sid:
            continue
        raw_cid = (s.get("client_delivery_id") or "").strip()
        eff = raw_cid
        log_ids = logs_by_shot.get(sid, [])
        rel = None
        if log_ids:
            rel = "Activity log id(s): " + ", ".join(log_ids[:5]) + ("…" if len(log_ids) > 5 else "")
        merged.append(
            {
                "_sort": _sort_key_ts(s.get("ts")),
                "row_kind": "screenshot",
                "item_label": "Screenshot",
                "primary_id": sid,
                "time": s.get("ts"),
                "client_delivery_id": raw_cid or None,
                "effective_delivery_id": eff or None,
                "related_summary": rel,
                "context": (s.get("application") or s.get("window_title") or "")[:120] or None,
            }
        )

    merged.sort(key=lambda r: r["_sort"], reverse=True)
    total = len(merged)
    capped = len(logs) >= _MERGE_FETCH_CAP or len(shots) >= _MERGE_FETCH_CAP

    all_dids: set[str] = set()
    for r in merged:
        e = (r.get("effective_delivery_id") or "").strip()
        if e:
            all_dids.add(e)

    stages_by_delivery: dict[str, list] = defaultdict(list)
    if all_dids:
        cur = v_col.find({"client_delivery_id": {"$in": list(all_dids)}}).sort("ts", 1)
        for doc in cur:
            cid = (doc.get("client_delivery_id") or "").strip()
            if cid:
                stages_by_delivery[cid].append(validation_log_public(doc))

    skip = (page - 1) * limit
    page_rows = merged[skip : skip + limit]

    out_rows = []
    for i, r in enumerate(page_rows):
        eff = (r.get("effective_delivery_id") or "").strip()
        stages = stages_by_delivery.get(eff, []) if eff else []
        st_sorted = sorted(stages, key=lambda x: str(x.get("ts") or ""))
        anchor = st_sorted[0].get("validation_log_id") if st_sorted else None
        s1 = _stage_status_label(st_sorted[0]) if len(st_sorted) >= 1 else "—"
        s2 = _stage_status_label(st_sorted[1]) if len(st_sorted) >= 2 else "—"
        row_out = {
            "s_no": skip + i + 1,
            "item_type": r["row_kind"],
            "item_label": r["item_label"],
            "primary_id": r["primary_id"],
            "time": r.get("time"),
            "time_iso": _iso(r["_sort"]) if isinstance(r["_sort"], datetime) else None,
            "client_delivery_id": r.get("client_delivery_id"),
            "effective_delivery_id": r.get("effective_delivery_id"),
            "related_summary": r.get("related_summary"),
            "context": r.get("context"),
            "validation_anchor_id": anchor,
            "status_1": s1,
            "status_2": s2,
            "validation_stage_count": len(st_sorted),
            "validation_stages": st_sorted,
        }
        out_rows.append(row_out)

    return {
        "rows": out_rows,
        "total": total,
        "page": page,
        "limit": limit,
        "merge_fetch_capped": capped,
    }


@bp.get("")
@require_auth
def validation_overview():
    actor = _actor(request)
    if not actor:
        return jsonify({"ok": False, "error": "Unauthorized"}), 401

    from_d = (request.args.get("from") or "").strip()
    to_d = (request.args.get("to") or "").strip()

    if not from_d or not to_d:
        return jsonify({"ok": False, "error": "from and to (YYYY-MM-DD) required"}), 400

    try:
        start_iso, end_iso = range_iso_strings(from_d, to_d)
        start_dt, end_dt = range_utc_datetimes(from_d, to_d)
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

    if len(target_ids) == 1:
        tid0 = target_ids[0]
        uid_clause_s: dict = {"$or": [{"user_mac_id": tid0}, {"user_id": tid0}]}
    else:
        uid_clause_s = {"$or": [{"user_id": {"$in": target_ids}}, {"user_mac_id": {"$in": target_ids}}]}

    try:
        t_page = max(1, int(request.args.get("table_page") or 1))
    except ValueError:
        t_page = 1
    try:
        t_limit = min(100, max(5, int(request.args.get("table_limit") or 25)))
    except ValueError:
        t_limit = 25

    try:
        d_page = max(1, int(request.args.get("delivery_page") or 1))
    except ValueError:
        d_page = 1
    try:
        d_limit = min(200, max(1, int(request.args.get("delivery_limit") or 50)))
    except ValueError:
        d_limit = 50

    try:
        s_page = max(1, int(request.args.get("screenshot_page") or 1))
    except ValueError:
        s_page = 1
    try:
        s_limit = min(200, max(1, int(request.args.get("screenshot_limit") or 50)))
    except ValueError:
        s_limit = 50

    uid_clause_v: dict
    if len(target_ids) == 1:
        tid = target_ids[0]
        uid_clause_v = {"user_id": tid}
    else:
        uid_clause_v = {"user_id": {"$in": target_ids}}

    v_match = {"$and": [uid_clause_v, {"ts": {"$gte": start_dt, "$lte": end_dt}}]}
    v_col = db[COL_VALIDATION_LOGS]

    skip_d = (d_page - 1) * d_limit

    pipeline = [
        {"$match": v_match},
        {
            "$addFields": {
                "grp": {
                    "$cond": {
                        "if": {
                            "$and": [
                                {"$ne": [{"$ifNull": ["$client_delivery_id", ""]}, ""]},
                            ]
                        },
                        "then": "$client_delivery_id",
                        "else": "$validation_log_id",
                    }
                }
            }
        },
        {"$sort": {"ts": 1}},
        {
            "$group": {
                "_id": "$grp",
                "delivery_id": {"$first": "$client_delivery_id"},
                "primary_validation_log_id": {"$first": "$validation_log_id"},
                # Full BSON document per stage so any attribute stored in validation_logs is available.
                "stages": {"$push": "$$ROOT"},
                "first_ts": {"$first": "$ts"},
                "last_ts": {"$last": "$ts"},
            }
        },
        {
            "$facet": {
                "meta": [{"$count": "total"}],
                "page": [{"$sort": {"last_ts": -1}}, {"$skip": skip_d}, {"$limit": d_limit}],
            }
        },
    ]

    agg = list(v_col.aggregate(pipeline))
    facet = agg[0] if agg else {"meta": [], "page": []}
    delivery_total = int(facet["meta"][0]["total"]) if facet.get("meta") else 0
    raw_groups = facet.get("page") or []

    deliveries = []
    for g in raw_groups:
        stages_in = g.get("stages") or []
        stages = [validation_log_public(s) for s in stages_in]
        did = g.get("delivery_id") or ""
        deliveries.append(
            {
                "group_key": g.get("_id"),
                "client_delivery_id": did if str(did).strip() else None,
                "primary_validation_log_id": g.get("primary_validation_log_id"),
                "stage_count": len(stages),
                "stages": stages,
                "first_ts": _iso(g.get("first_ts")),
                "last_ts": _iso(g.get("last_ts")),
            }
        )

    s_filt = {
        "$and": [
            uid_clause_s,
            {"ts": {"$gte": start_iso, "$lte": end_iso}},
            {"client_delivery_id": {"$exists": True, "$nin": [None, ""]}},
        ]
    }
    s_col = db[COL_SCREENSHOTS]
    screenshot_total = s_col.count_documents(s_filt)
    s_skip = (s_page - 1) * s_limit
    shot_docs = list(s_col.find(s_filt).sort("ts", -1).skip(s_skip).limit(s_limit))

    delivery_ids = []
    for d in shot_docs:
        cid = (d.get("client_delivery_id") or "").strip()
        if cid and cid not in delivery_ids:
            delivery_ids.append(cid)

    stages_by_delivery: dict[str, list] = defaultdict(list)
    if delivery_ids:
        cur = v_col.find({"client_delivery_id": {"$in": delivery_ids}}).sort("ts", 1)
        for doc in cur:
            cid = (doc.get("client_delivery_id") or "").strip()
            if cid:
                stages_by_delivery[cid].append(validation_log_public(doc))

    screenshot_rows = []
    for d in shot_docs:
        base = screenshot_row(d)
        cid = (d.get("client_delivery_id") or "").strip()
        base["client_delivery_id"] = cid or None
        base["validation_stages"] = stages_by_delivery.get(cid, [])
        screenshot_rows.append(base)

    interlinked_table = _build_interlinked_table(db, uid_clause_s, start_iso, end_iso, v_col, t_page, t_limit)

    focus_delivery_id = (request.args.get("focus_delivery_id") or "").strip()
    focus_screenshot_id = (request.args.get("focus_screenshot_id") or "").strip()
    focus_log_id = (request.args.get("focus_log_id") or "").strip()

    focused_delivery_journey = None
    fdid, resolved_via = _resolve_focused_client_delivery_id(
        db, uid_clause_s, focus_delivery_id, focus_screenshot_id, focus_log_id
    )
    if fdid:
        v_focus_match = {"$and": [uid_clause_v, {"client_delivery_id": fdid}]}
        focus_stages_in = list(v_col.find(v_focus_match).sort("ts", 1))
        focus_stages = [validation_log_public(s) for s in focus_stages_in]
        focused_delivery_journey = {
            "client_delivery_id": fdid,
            "resolved_via": resolved_via,
            "stage_count": len(focus_stages),
            "stages": focus_stages,
        }

    return jsonify(
        {
            "ok": True,
            "data": {
                "interlinked_table": interlinked_table,
                "deliveries": deliveries,
                "delivery_total": delivery_total,
                "delivery_page": d_page,
                "delivery_limit": d_limit,
                "screenshot_rows": screenshot_rows,
                "screenshot_total": screenshot_total,
                "screenshot_page": s_page,
                "screenshot_limit": s_limit,
                "merged_tracker_count": len(target_ids),
                "focused_delivery_journey": focused_delivery_journey,
            },
        }
    )
