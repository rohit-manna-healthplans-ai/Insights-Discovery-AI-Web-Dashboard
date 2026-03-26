import os
from dotenv import load_dotenv

load_dotenv()


def _get(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


MONGO_URI = _get("MONGO_URI", "mongodb://127.0.0.1:27017")
# Same cluster as discovery-ai-backend-main; use MONGO_DB_NAME or MONGO_DBNAME (Node) + db name "test" if you share that DB.
MONGO_DB_NAME = (_get("MONGO_DB_NAME") or _get("MONGO_DBNAME") or "test").strip() or "test"
JWT_SECRET = _get("JWT_SECRET", "dev-secret-change-in-production")
JWT_EXPIRES_HOURS = int(_get("JWT_EXPIRES_HOURS", "72") or "72")

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
