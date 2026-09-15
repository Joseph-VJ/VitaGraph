"""Small file helpers: hashing and upload validation."""

from __future__ import annotations

import hashlib

from fastapi import HTTPException

from app.core.config import settings


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_upload(filename: str, size: int) -> None:
    """Reject unsupported extensions and oversized files before storage."""
    suffix = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix not in settings.allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Supported: {', '.join(settings.allowed_extensions)}",
        )
    if size > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds the {settings.max_upload_mb} MB upload limit.",
        )
