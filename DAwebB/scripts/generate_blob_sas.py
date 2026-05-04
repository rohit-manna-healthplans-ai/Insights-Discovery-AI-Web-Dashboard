#!/usr/bin/env python3
"""
CLI: paste an Azure Blob HTTPS URL, print a time-limited read SAS URL.

Uses AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY from DAwebB/.env
(same as GET /api/screenshots/<id>/sas-url). Do not hardcode account keys in scripts.

Usage (from dashboard/DAwebB):
  python scripts/generate_blob_sas.py "https://<account>.blob.core.windows.net/<container>/<blob>"
  # or interactive:
  python scripts/generate_blob_sas.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root))
    os.chdir(root)

    from dotenv import load_dotenv

    load_dotenv(root / ".env")

    from app.azure_blob import sign_read_sas_https_blob_url

    blob_url = (sys.argv[1] if len(sys.argv) > 1 else input("Enter blob HTTPS URL: ")).strip()
    if not blob_url:
        print("Missing URL.", file=sys.stderr)
        return 1
    try:
        sas_url, mins = sign_read_sas_https_blob_url(blob_url)
    except Exception as e:
        print(e, file=sys.stderr)
        return 1
    print(f"\nSAS URL (read, expires in ~{mins} minutes):\n{sas_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
