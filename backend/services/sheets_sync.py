"""Google Sheets sync service for dynamic knowledge bases."""

import os
import json
from dotenv import load_dotenv

load_dotenv()


async def fetch_sheets_data(sheet_url: str) -> list:
    """Fetch data from a public or shared Google Sheet.

    For public sheets, we use a CSV export URL approach.
    For private sheets, we use gspread with service account credentials.
    """
    rows = []
    creds_path = os.getenv("GOOGLE_SHEETS_CREDENTIALS_PATH", "")

    # Extract sheet ID from URL
    sheet_id = extract_sheet_id(sheet_url)
    if not sheet_id:
        print(f"Invalid Google Sheets URL: {sheet_url}")
        return []

    # Try gspread with service account first
    if creds_path and os.path.exists(creds_path):
        try:
            import gspread
            from google.oauth2.service_account import Credentials

            scopes = [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
            creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
            gc = gspread.authorize(creds)

            spreadsheet = gc.open_by_key(sheet_id)
            worksheet = spreadsheet.sheet1
            records = worksheet.get_all_records()

            for record in records:
                row_text = " | ".join([
                    f"{k}: {v}" for k, v in record.items()
                    if v and str(v).strip()
                ])
                if row_text:
                    rows.append(row_text)

            return rows
        except Exception as e:
            print(f"gspread error: {e}, falling back to public CSV")

    # Fallback: public CSV export
    try:
        import urllib.request
        csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
        import pandas as pd
        import io

        response = urllib.request.urlopen(csv_url)
        data = response.read()
        df = pd.read_csv(io.BytesIO(data))

        for _, row in df.iterrows():
            row_text = " | ".join([
                f"{col}: {val}" for col, val in row.items()
                if pd.notna(val) and str(val).strip()
            ])
            if row_text:
                rows.append(row_text)
    except Exception as e:
        print(f"Public CSV fallback error: {e}")

    return rows


def extract_sheet_id(url: str) -> str:
    """Extract Google Sheet ID from a URL."""
    import re
    patterns = [
        r'/spreadsheets/d/([a-zA-Z0-9-_]+)',
        r'key=([a-zA-Z0-9-_]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""


async def sync_dynamic_kb(kb_id: str, sheet_url: str, db_session) -> int:
    """Sync a dynamic KB from Google Sheets — replaces all entries."""
    from models import KBEntry
    from services.gemini_service import generate_embedding

    rows = await fetch_sheets_data(sheet_url)
    if not rows:
        return 0

    # Delete existing entries for this KB
    db_session.query(KBEntry).filter(KBEntry.kb_id == kb_id).delete()
    db_session.commit()

    count = 0
    for i, row_text in enumerate(rows):
        embedding = await generate_embedding(row_text)
        entry = KBEntry(
            kb_id=kb_id,
            content=row_text,
            embedding=embedding,
            source_file="google_sheets",
            chunk_index=i
        )
        db_session.add(entry)
        count += 1

    db_session.commit()
    return count
