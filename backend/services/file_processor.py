"""File processing service — CSV, PDF, Excel parsing and text chunking."""

import pandas as pd
from PyPDF2 import PdfReader
import io
import re


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    """Split text into overlapping chunks of approximately chunk_size words."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks if chunks else [text.strip()] if text.strip() else []


def process_csv(file_bytes: bytes, filename: str) -> list:
    """Parse CSV file and return text chunks."""
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
        texts = []
        # Convert each row to a readable text format
        for _, row in df.iterrows():
            row_text = " | ".join([
                f"{col}: {val}" for col, val in row.items()
                if pd.notna(val) and str(val).strip()
            ])
            if row_text:
                texts.append(row_text)

        # Combine rows and chunk
        full_text = "\n".join(texts)
        chunks = chunk_text(full_text)
        return [{"content": c, "source": filename, "index": i}
                for i, c in enumerate(chunks)]
    except Exception as e:
        print(f"CSV processing error: {e}")
        return []


def process_pdf(file_bytes: bytes, filename: str) -> list:
    """Parse PDF file and return text chunks."""
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        full_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"

        full_text = re.sub(r'\s+', ' ', full_text).strip()
        chunks = chunk_text(full_text)
        return [{"content": c, "source": filename, "index": i}
                for i, c in enumerate(chunks)]
    except Exception as e:
        print(f"PDF processing error: {e}")
        return []


def process_excel(file_bytes: bytes, filename: str) -> list:
    """Parse Excel file and return text chunks."""
    try:
        df = pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl')
        texts = []
        for _, row in df.iterrows():
            row_text = " | ".join([
                f"{col}: {val}" for col, val in row.items()
                if pd.notna(val) and str(val).strip()
            ])
            if row_text:
                texts.append(row_text)

        full_text = "\n".join(texts)
        chunks = chunk_text(full_text)
        return [{"content": c, "source": filename, "index": i}
                for i, c in enumerate(chunks)]
    except Exception as e:
        print(f"Excel processing error: {e}")
        return []


def process_file(file_bytes: bytes, filename: str) -> list:
    """Route file to appropriate processor based on extension."""
    ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''

    if ext == 'csv':
        return process_csv(file_bytes, filename)
    elif ext == 'pdf':
        return process_pdf(file_bytes, filename)
    elif ext in ('xlsx', 'xls'):
        return process_excel(file_bytes, filename)
    else:
        # Treat as plain text
        text = file_bytes.decode('utf-8', errors='ignore')
        chunks = chunk_text(text)
        return [{"content": c, "source": filename, "index": i}
                for i, c in enumerate(chunks)]
