"""SQLite access and schema.

The logical record contracts follow the project plan (Section 14): users,
reports (immutable versions), report_pages, report_chunks, questions,
answers, and history_events. Graph node/edge tables are added in a later
phase and are intentionally absent here.

Every derived record carries user_id so that isolation can be enforced at
the query level, and the enforcement lives in the service modules — a query
without a user filter is treated as a bug, never a default.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager

from app.core.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    display_label TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS reports (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL REFERENCES users(id),
    original_filename TEXT NOT NULL,
    stored_filename  TEXT NOT NULL,
    file_hash        TEXT NOT NULL,
    report_date      TEXT,
    upload_time      TEXT NOT NULL,
    version          INTEGER NOT NULL DEFAULT 1,
    status           TEXT NOT NULL DEFAULT 'received',
    page_count       INTEGER,
    error_message    TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

CREATE TABLE IF NOT EXISTS report_pages (
    id                TEXT PRIMARY KEY,
    report_id         TEXT NOT NULL REFERENCES reports(id),
    page_number       INTEGER NOT NULL,
    extracted_text    TEXT NOT NULL,
    extraction_method TEXT NOT NULL,   -- 'native' | 'ocr' | 'failed'
    text_length       INTEGER NOT NULL,
    quality           TEXT NOT NULL    -- 'good' | 'sparse' | 'uncertain' | 'failed'
);
CREATE INDEX IF NOT EXISTS idx_pages_report ON report_pages(report_id);

CREATE TABLE IF NOT EXISTS report_chunks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    report_id   TEXT NOT NULL REFERENCES reports(id),
    page_id     TEXT NOT NULL REFERENCES report_pages(id),
    page_number INTEGER NOT NULL,
    sequence    INTEGER NOT NULL,
    text        TEXT NOT NULL,
    char_start  INTEGER NOT NULL,
    char_end    INTEGER NOT NULL,
    section     TEXT,
    metadata    TEXT NOT NULL          -- JSON blob (plan Section 8 metadata table)
);
CREATE INDEX IF NOT EXISTS idx_chunks_user ON report_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_report ON report_chunks(report_id);

CREATE TABLE IF NOT EXISTS questions (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id),
    text          TEXT NOT NULL,
    classification TEXT NOT NULL,      -- educational|administrative|unsupported|urgent|out_of_bounds
    asked_at       TEXT NOT NULL,
    status         TEXT NOT NULL       -- answered|refused|insufficient_evidence|error
);
CREATE INDEX IF NOT EXISTS idx_questions_user ON questions(user_id);

CREATE TABLE IF NOT EXISTS answers (
    id                  TEXT PRIMARY KEY,
    question_id         TEXT NOT NULL REFERENCES questions(id),
    user_id             TEXT NOT NULL,
    summary_text        TEXT NOT NULL,     -- part 1: what the reports say
    limitations_text    TEXT NOT NULL,     -- part 3: what cannot be concluded
    safety_text         TEXT NOT NULL,     -- part 4: safety guidance
    evidence_json       TEXT NOT NULL,     -- part 2: evidence used (list of cards)
    ai_service_status   TEXT NOT NULL,     -- ok|disabled|error|replaced_by_fallback
    ai_service_config   TEXT NOT NULL,     -- configuration version label
    safety_status       TEXT NOT NULL,     -- passed|refused|insufficient_evidence
    safety_check_note   TEXT,              -- persisted safety/fallback reason (audit)
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_calls (
    id          TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    workflow_id TEXT NOT NULL,          -- ties upload -> answer -> audit in one trace
    request_id  TEXT,                    -- generation service request id
    status      TEXT NOT NULL,           -- ok|disabled|error|not_used|replaced_by_fallback
    used_ai     INTEGER NOT NULL,        -- 1 if a real external AI call was made
    error       TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_calls_user ON ai_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_question ON ai_calls(question_id);

CREATE TABLE IF NOT EXISTS history_events (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id),
    event_type TEXT NOT NULL,
    timestamp  TEXT NOT NULL,
    payload    TEXT NOT NULL              -- JSON blob, no unnecessary raw health text
);
CREATE INDEX IF NOT EXISTS idx_events_user ON history_events(user_id);
"""


@contextmanager
def get_db():
    """Yield a connection with row access by column name.

    A fresh connection per call keeps usage thread-safe and simple; SQLite
    handles this volume comfortably for a local demo.
    """
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as db:
        db.executescript(SCHEMA)
        _migrate(db)


def _migrate(db) -> None:
    """Lightweight column migrations for databases created by older versions."""
    migrations = [
        "ALTER TABLE answers ADD COLUMN safety_check_note TEXT",
    ]
    for statement in migrations:
        try:
            db.execute(statement)
        except sqlite3.OperationalError:
            pass  # column already exists
