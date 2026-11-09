"""
Jab user TXT, DOCX ya PDF file upload karega, toh system ko us file se text aur images 
nikal kar database ke format (ContentBlock) mein convert karna hai.
"""

"""Document ingestion: turning TXT, DOCX, and PDF uploads into structured ContentBlocks.

Render's free tier has an ephemeral disk, so we extract blocks directly into memory
and save them into the content_blocks table. The original file does not need to persist.
"""

import hashlib
import io
import os
from typing import Any

import docx
import fitz  # PyMuPDF


def _compute_hash(blocks: list[dict[str, Any]]) -> str:
    """Calculates SHA-256 hash of all text content for version deduplication."""
    hasher = hashlib.sha256()
    for b in blocks:
        if b.get("content"):
            hasher.update(b["content"].encode("utf-8"))
    return hasher.hexdigest()


def extract_from_txt(data: bytes) -> list[dict[str, Any]]:
    """Splits plain text by double-newlines into paragraphs."""
    text = data.decode("utf-8", errors="replace")
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    blocks = []
    for idx, p in enumerate(paragraphs):
        blocks.append({
            "block_no": idx,
            "block_type": "paragraph",
            "content": p,
            "page": 1,
            "alt_text": None,
        })
    return blocks


def extract_from_docx(data: bytes) -> list[dict[str, Any]]:
    """Extracts paragraphs, headings, lists, and tables from DOCX in reading order."""
    doc = docx.Document(io.BytesIO(data))
    blocks = []
    block_no = 0

    # 1. Paragraphs & Headings
    for p in doc.paragraphs:
        txt = p.text.strip()
        if not txt:
            continue
        style_name = p.style.name.lower() if p.style else ""
        if "heading" in style_name:
            b_type = "heading"
        elif "list" in style_name or "bullet" in style_name:
            b_type = "list"
        else:
            b_type = "paragraph"

        blocks.append({
            "block_no": block_no,
            "block_type": b_type,
            "content": txt,
            "page": 1,
            "alt_text": None,
        })
        block_no += 1

    # 2. Tables
    for tbl in doc.tables:
        table_rows = []
        for row in tbl.rows:
            row_data = [cell.text.strip() for cell in row.cells]
            table_rows.append(" | ".join(row_data))
        table_txt = "\n".join(table_rows)
        if table_txt.strip():
            blocks.append({
                "block_no": block_no,
                "block_type": "table",
                "content": table_txt,
                "page": 1,
                "alt_text": None,
            })
            block_no += 1

    return blocks


def extract_from_pdf(data: bytes) -> list[dict[str, Any]]:
    """Extracts text blocks page by page using PyMuPDF."""
    doc = fitz.open(stream=data, filetype="pdf")
    blocks = []
    block_no = 0

    for page_no, page in enumerate(doc, start=1):
        page_blocks = page.get_text("blocks")
        for b in page_blocks:
            # b[4] is the text content, b[6] is block type (0=text, 1=image)
            text = b[4].strip() if len(b) > 4 else ""
            if not text:
                continue
            blocks.append({
                "block_no": block_no,
                "block_type": "paragraph",
                "content": text,
                "page": page_no,
                "alt_text": None,
            })
            block_no += 1

    return blocks


def extract_blocks(data: bytes, filename: str) -> tuple[str, list[dict[str, Any]]]:
    """Main ingestion entrypoint. Detects extension and returns (content_hash, blocks)."""
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".txt":
        blocks = extract_from_txt(data)
    elif ext == ".docx":
        blocks = extract_from_docx(data)
    elif ext == ".pdf":
        blocks = extract_from_pdf(data)
    else:
        blocks = extract_from_txt(data)

    content_hash = _compute_hash(blocks)
    return content_hash, blocks