import os
from dotenv import load_dotenv

load_dotenv()


def _get(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


# Azure Cosmos DB for MongoDB: set AZURE_COSMOS_MONGO_URI (mongodb+srv://…cosmos.azure.com/…)
# or a single MONGO_URI. If both are set, AZURE_COSMOS_MONGO_URI wins (see extension-repo export script).
_AZ_COSMOS = _get("AZURE_COSMOS_MONGO_URI", "").strip()
MONGO_URI = _AZ_COSMOS or _get("MONGO_URI", "mongodb://127.0.0.1:27017")
# Logical database name (e.g. IDAI_Web_Database on Cosmos, or test on local Node backend).
MONGO_DB_NAME = (_get("MONGO_DB_NAME") or _get("MONGO_DBNAME") or "test").strip() or "test"
JWT_SECRET = _get("JWT_SECRET", "dev-secret-change-in-production")
# Prefer JWT_EXP_MINUTES (e.g. 720 = 12h); else JWT_EXPIRES_HOURS (integer hours).
_jwt_min = (_get("JWT_EXP_MINUTES") or "").strip()
if _jwt_min:
    try:
        JWT_EXPIRES_HOURS = max(1 / 60.0, int(_jwt_min) / 60.0)
    except ValueError:
        JWT_EXPIRES_HOURS = int(_get("JWT_EXPIRES_HOURS", "72") or "72")
else:
    JWT_EXPIRES_HOURS = int(_get("JWT_EXPIRES_HOURS", "72") or "72")

# CORS: comma-separated origins (required for credentialed requests from Vercel / local Vite).
_cors_raw = (_get("CORS_ORIGINS") or "").strip()
if _cors_raw:
    CORS_ORIGINS = [o.strip().rstrip("/") for o in _cors_raw.split(",") if o.strip()]
else:
    CORS_ORIGINS = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]

# If true, POST /api/auth/register works without admin token even when users already exist.
# Use for staging / small teams. Production: keep false and add users as logged-in C-Suite.
OPEN_REGISTRATION = _get("OPEN_REGISTRATION", "false").strip().lower() in ("1", "true", "yes", "on")

# Bootstrap admin for first login. Override with env values in production.
BOOTSTRAP_ADMIN_EMAIL = _get("BOOTSTRAP_ADMIN_EMAIL", "admin123@gmail.com").strip().lower()
BOOTSTRAP_ADMIN_PASSWORD = _get("BOOTSTRAP_ADMIN_PASSWORD", "123456")
BOOTSTRAP_ADMIN_NAME = _get("BOOTSTRAP_ADMIN_NAME", "Super Admin")

COL_USERS = "users"
# Same collection name as discovery-ai-backend-main ExtensionUser model (`plugin_users`)
COL_PLUGIN_USERS = _get("COL_PLUGIN_USERS", "plugin_users").strip() or "plugin_users"
COL_DEPARTMENTS = "departments"
COL_LOGS = "logs"
COL_SCREENSHOTS = "screenshots"
COL_VALIDATION_LOGS = _get("COL_VALIDATION_LOGS", "validation_logs").strip() or "validation_logs"
COL_USER_HEARTBEATS = _get("COL_USER_HEARTBEATS", "user_heartbeats").strip() or "user_heartbeats"
