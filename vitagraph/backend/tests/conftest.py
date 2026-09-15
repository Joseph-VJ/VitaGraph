"""Test configuration: isolate every test run from real data.

Env overrides are set BEFORE any app import so the shared settings object
picks them up. Each pytest invocation gets its own temporary data root.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="vitagraph_test_"))
os.environ["DATA_DIR"] = str(_TMP)
os.environ["UPLOADS_DIR"] = str(_TMP / "uploads")
os.environ["DB_PATH"] = str(_TMP / "test.db")
os.environ["CHROMA_DIR"] = str(_TMP / "chroma")
os.environ["ALLOW_API"] = "false"

from app.core.database import init_db  # noqa: E402
from app.services import user_service  # noqa: E402

init_db()

SAMPLE_DATA = Path(__file__).resolve().parent.parent.parent / "sample_data"


def sample_pdf(name: str) -> bytes:
    return (SAMPLE_DATA / name).read_bytes()


def make_user(label: str) -> dict:
    """Create a persona that has accepted the data-use statement.

    Most tests exercise post-consent behavior; consent-specific tests use
    user_service.create_user directly.
    """
    user = user_service.create_user(label)
    return user_service.accept_consent(user["id"])
