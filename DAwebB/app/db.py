from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import bcrypt
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import OperationFailure

from app.config import (
    MONGO_URI,
    MONGO_DB_NAME,
    COL_USERS,
    COL_DEPARTMENTS,
    COL_LOGS,
    COL_SCREENSHOTS,
    COL_VALIDATION_LOGS,
    COL_USER_HEARTBEATS,
    BOOTSTRAP_ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD,
    BOOTSTRAP_ADMIN_NAME,
)


def _safe_index(collection, keys, **kwargs):
    """Create index; ignore conflicts if an equivalent index already exists."""
    try:
        collection.create_index(keys, **kwargs)
    except OperationFailure as e:
        code = getattr(e, "code", None)
        if code in (85, 86, 11000):  # IndexOptionsConflict / duplicate name / etc.
            return
        if "already exists" in str(e).lower() or "same name" in str(e).lower():
            return
        raise


def _is_azure_cosmos_mongo_uri(uri: str) -> bool:
    """Host patterns for Azure Cosmos DB for MongoDB (same idea as extension-repo export script)."""
    u = (uri or "").lower()
    return (
        "mongocluster.cosmos.azure.com" in u
        or "cosmos.azure.com" in u
        or ".mongo.cosmos.azure.com" in u
    )


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    uri = MONGO_URI
    base: dict[str, Any] = {
        "serverSelectionTimeoutMS": 45_000,
        "connectTimeoutMS": 10_000,
        "socketTimeoutMS": 45_000,
        "maxPoolSize": 50,
    }
    if _is_azure_cosmos_mongo_uri(uri):
        base["authMechanism"] = "SCRAM-SHA-256"
        if "retrywrites=true" not in uri.lower().replace(" ", ""):
            base["retryWrites"] = False
    else:
        base["retryWrites"] = True
    return MongoClient(uri, **base)


def get_db():
    return get_client()[MONGO_DB_NAME]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_indexes() -> None:
    """Idempotent index creation for fast dashboard queries."""
    db = get_db()

    # users
    _safe_index(db[COL_USERS], [("company_username_norm", ASCENDING)], unique=True, sparse=True)
    _safe_index(db[COL_USERS], [("user_mac_id", ASCENDING)])
    _safe_index(db[COL_USERS], [("department", ASCENDING)])
    _safe_index(db[COL_USERS], [("approval_status", ASCENDING)])

    # departments
    _safe_index(db[COL_DEPARTMENTS], [("department_code", ASCENDING)], unique=True, sparse=True)
    _safe_index(db[COL_DEPARTMENTS], [("department_name", ASCENDING)])

    # logs — primary read path: user + time (ts)
    _safe_index(db[COL_LOGS], [("user_mac_id", ASCENDING), ("ts", DESCENDING)])
    # discovery-ai-backend writes extension id as user_id
    _safe_index(db[COL_LOGS], [("user_id", ASCENDING), ("ts", DESCENDING)])
    _safe_index(db[COL_LOGS], [("log_id", ASCENDING)], unique=True, sparse=True)
    _safe_index(db[COL_LOGS], [("screenshot_id", ASCENDING)], sparse=True)
    _safe_index(db[COL_LOGS], [("application", ASCENDING), ("ts", DESCENDING)])
    _safe_index(db[COL_LOGS], [("operation", ASCENDING), ("ts", DESCENDING)])

    # screenshots
    _safe_index(db[COL_SCREENSHOTS], [("user_mac_id", ASCENDING), ("ts", DESCENDING)])
    _safe_index(db[COL_SCREENSHOTS], [("user_id", ASCENDING), ("ts", DESCENDING)])
    _safe_index(db[COL_SCREENSHOTS], [("screenshot_id", ASCENDING)], unique=True, sparse=True)
    _safe_index(db[COL_SCREENSHOTS], [("application", ASCENDING), ("ts", DESCENDING)])
    _safe_index(db[COL_SCREENSHOTS], [("operation", ASCENDING), ("ts", DESCENDING)])
    _safe_index(db[COL_SCREENSHOTS], [("client_delivery_id", ASCENDING)], sparse=True)

    # validation_logs / user_heartbeats (discovery-ai-backend-main)
    _safe_index(db[COL_VALIDATION_LOGS], [("user_id", ASCENDING), ("ts", DESCENDING)])
    _safe_index(db[COL_VALIDATION_LOGS], [("client_delivery_id", ASCENDING), ("ts", ASCENDING)])
    _safe_index(db[COL_USER_HEARTBEATS], [("user_id", ASCENDING)], unique=True)
    _safe_index(db[COL_USER_HEARTBEATS], [("last_heartbeat_at", DESCENDING)])


def ensure_bootstrap_admin() -> None:
    """
    Ensure one deterministic C-Suite admin exists for first-time setup.
    """
    db = get_db()
    email = (BOOTSTRAP_ADMIN_EMAIL or "").strip().lower()
    password = BOOTSTRAP_ADMIN_PASSWORD or ""
    if not email or not password:
        return

    now = utc_now_iso()
    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    existing = db[COL_USERS].find_one({"company_username_norm": email})

    if existing:
        db[COL_USERS].update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "company_username": email,
                    "company_username_norm": email,
                    "full_name": existing.get("full_name") or BOOTSTRAP_ADMIN_NAME,
                    "role_key": "C_SUITE",
                    "department": None,
                    "approval_status": "APPROVED",
                    "approved_at": existing.get("approved_at") or now,
                    "updated_at": now,
                    "password_hash": pw_hash,
                },
                "$setOnInsert": {"created_at": now},
            },
        )
        return

    user_mac_id = f"bootstrap-admin-{email}"
    db[COL_USERS].insert_one(
        {
            "_id": user_mac_id,
            "user_mac_id": user_mac_id,
            "pc_username": "",
            "company_username_norm": email,
            "company_username": email,
            "full_name": BOOTSTRAP_ADMIN_NAME,
            "contact_no": None,
            "role_key": "C_SUITE",
            "department": None,
            "license_accepted": True,
            "license_version": "bootstrap",
            "license_accepted_at": now,
            "last_seen_at": now,
            "created_at": now,
            "updated_at": now,
            "password_hash": pw_hash,
            "approval_status": "APPROVED",
            "approved_by": "SYSTEM_BOOTSTRAP",
            "approved_at": now,
        }
    )
