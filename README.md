# Dashboard (DAwebB + DAwebF)

This folder contains the full dashboard stack:

- `DAwebB` -> Flask backend API
- `DAwebF` -> React + Vite frontend

## Project Structure

```text
dashboard/
  DAwebB/   # Python backend
  DAwebF/   # React frontend
```

## Prerequisites

- Python 3.10+ (recommended 3.11/3.12)
- Node.js 18+
- npm
- MongoDB connection string

## 1) Run Backend (`DAwebB`)

```powershell
cd C:\Web_plugin\dashboard\DAwebB
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Backend runs on: `http://127.0.0.1:5000`

Required environment values in `DAwebB/.env`:

- `MONGO_URI`
- `JWT_SECRET`
- `MONGO_DB_NAME` (or `MONGO_DBNAME`)

## 2) Run Frontend (`DAwebF`)

```powershell
cd C:\Web_plugin\dashboard\DAwebF
npm install
copy .env.example .env
npm run dev
```

Frontend default dev URL: `http://localhost:5173`

Set API base in `DAwebF/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

## Build Frontend

```powershell
cd C:\Web_plugin\dashboard\DAwebF
npm run build
npm run preview
```

## Deployment Notes

- Backend can be deployed as a web service (Docker or Python runtime) with the `DAwebB` folder as root.
- Frontend can be deployed as static hosting from `DAwebF` (`npm run build` output).
- If using Render:
  - Create one service for `DAwebB` (API)
  - Create one static site for `DAwebF` (or serve build through nginx/container)
  - Configure `VITE_API_BASE_URL` to point to deployed backend URL.

## Related Docs

- Backend details: `DAwebB/README.md`

