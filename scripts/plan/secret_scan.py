"""Security secret scanner (Task F2).

Scans all tracked git files (excluding binary files) for committed API keys,
tokens, passwords, and private keys.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

# Patterns to scan
# 1. sk- followed by 20 or more letters, digits, _ or -, with no letter/digit just before it
RE_SK = re.compile(r"(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}")

# 2. Name ending in API_KEY, SECRET, TOKEN or PASSWORD, followed by = or : and value >= 16 chars
RE_ASSIGN = re.compile(
    r"(?i)\b[A-Za-z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*[:=]\s*(?:(['\"])(.*?)\1|([^\s;,\r\n()]+))"
)

# 3. -----BEGIN … PRIVATE KEY-----
RE_PRIVATE_KEY = re.compile(r"-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----")

# 4. AKIA followed by 16 capitals or digits
RE_AKIA = re.compile(r"(?<![A-Za-z0-9])AKIA[A-Z0-9]{16}(?![A-Za-z0-9])")

PLACEHOLDER_SUBSTRINGS = (
    "replace",
    "your",
    "example",
    "changeme",
    "xxx",
    "redacted",
    "placeholder",
    "test",
    "canary",
    "dummy",
    "mock",
    "fake",
    "secret-key",
    "secret_key",
)


def is_placeholder(val: str) -> bool:
    v = val.strip().strip("'\"")
    v_lower = v.lower()
    if v.startswith(("<", "${", "$env:")):
        return True
    return any(sub in v_lower for sub in PLACEHOLDER_SUBSTRINGS)


def is_binary_file(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            chunk = f.read(8192)
            if b"\0" in chunk:
                return True
        return False
    except OSError:
        return True


def mask_value(val: str) -> str:
    cleaned = val.strip().strip("'\"")
    return f"{cleaned[:4]}... ({len(cleaned)} chars)"


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent.parent

    try:
        res = subprocess.run(
            ["git", "ls-files"],
            capture_output=True,
            text=True,
            check=True,
            cwd=str(repo_root),
        )
        files = [line.strip() for line in res.stdout.splitlines() if line.strip()]
    except Exception as exc:
        print(f"Error listing git files: {exc}", file=sys.stderr)
        sys.exit(1)

    this_file = Path(__file__).resolve().relative_to(repo_root).as_posix()
    findings: list[str] = []

    for rel_path in files:
        # Avoid scanner matching its own regex patterns
        if rel_path == this_file:
            continue

        full_path = repo_root / rel_path
        if not full_path.is_file() or is_binary_file(full_path):
            continue

        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                for line_no, line in enumerate(f, start=1):
                    # Check Pattern 1: sk-
                    for m in RE_SK.finditer(line):
                        val = m.group(0)
                        if not is_placeholder(val):
                            findings.append(
                                f"{rel_path}:{line_no}: sk-key: {mask_value(val)}"
                            )

                    # Check Pattern 2: API_KEY / SECRET / TOKEN / PASSWORD
                    for m in RE_ASSIGN.finditer(line):
                        raw_val = m.group(2) if m.group(2) is not None else m.group(3)
                        if not raw_val:
                            continue
                        clean_v = raw_val.strip().strip("'\"")
                        # Skip code references (attribute lookups like settings.x or cfg.y)
                        if "." in clean_v:
                            continue
                        if len(clean_v) >= 16 and not is_placeholder(raw_val):
                            findings.append(
                                f"{rel_path}:{line_no}: credential assignment: {mask_value(clean_v)}"
                            )

                    # Check Pattern 3: Private key
                    for m in RE_PRIVATE_KEY.finditer(line):
                        val = m.group(0)
                        if not is_placeholder(val):
                            findings.append(
                                f"{rel_path}:{line_no}: private key: {mask_value(val)}"
                            )

                    # Check Pattern 4: AWS AKIA
                    for m in RE_AKIA.finditer(line):
                        val = m.group(0)
                        if not is_placeholder(val):
                            findings.append(
                                f"{rel_path}:{line_no}: aws akia: {mask_value(val)}"
                            )
        except OSError:
            continue

    if findings:
        for f in findings:
            print(f)
        print(f"RESULT: FAIL ({len(findings)} findings)")
        sys.exit(1)
    else:
        print("RESULT: PASS")
        sys.exit(0)


if __name__ == "__main__":
    main()
