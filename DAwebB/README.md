# Discovery Agent API

Flask + PyMongo backend. Collections: `users`, `departments`, `logs`, `screenshots`, `validation_logs`, `user_heartbeats`.

**Database:** Use `AZURE_COSMOS_MONGO_URI` (Azure Cosmos DB for MongoDB, `mongodb+srv://…cosmos.azure.com/…`) or `MONGO_URI` for a standard MongoDB host. Set `MONGO_DB_NAME` to the same logical database as the extension backend (e.g. `IDAI_Web_Database` on Cosmos, or `test` locally). Cosmos URIs get driver options aligned with `extension-repo/export_to_combined_csv_file.py` (SCRAM-SHA-256, `retryWrites` false when appropriate).

## Setup

```bash
cd DA_backend-main
python -m venv venv
.\venv\Scripts\activate   # Windows
pip install -r requirements.txt
# includes flask-compress for gzip JSON responses (faster over slow networks)
copy .env.example .env     # edit AZURE_COSMOS_MONGO_URI or MONGO_URI / JWT_SECRET / MONGO_DB_NAME
python run.py
```

Server: `http://127.0.0.1:5000` (same as frontend `VITE_API_BASE_URL` default).

## Auth

- Users collection must include **`password_hash`** (bcrypt) for dashboard login (not shown in API responses).
- Login: `POST /api/auth/login` `{ "email", "password" }` → JWT.
- First `POST /api/auth/register` works without token (bootstrap); after that only **C_SUITE** can register new users via API.

## Data rules (aligned with `discovery-ai-backend-main`)

| Concept | MongoDB | Notes |
|--------|---------|--------|
| Extension install / plugin user | `plugin_users` | `trackerUserId` (required) |
| Activity rows | `logs` | `user_id` = extension `userId` from collect batch |
| Screenshot rows | `screenshots` | `user_id` = same |

Dashboard **`users`** collection still uses legacy field **`user_mac_id`** as the document primary key for password login; API responses expose **`user_id`** and **`tracker_user_id`** with the same string so the UI matches discovery naming.

- **GET /api/logs** and **GET /api/screenshots** query params: **`user_id`** (preferred), **`tracker_user_id`**, or legacy **`user_mac_id`**, or **`company_username`** (resolves `users` then `plugin_users` by email).
- Date range on **`ts`** (ISO strings, `from` / `to` query params).
- Indexes are created on app startup (`app/db.py` → `ensure_indexes()`).
- RBAC: **C_SUITE** all devices; **DEPARTMENT_HEAD** same `department` field as `users.department`; **DEPARTMENT_MEMBER** only own `user_mac_id`.

## Frontend

Point `DA_Frontend-main/.env` `VITE_API_BASE_URL` to this server.
