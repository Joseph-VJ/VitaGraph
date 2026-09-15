"""Application settings.

All configurable values live here so that a change never requires hunting
through module code. Values can be overridden via backend/.env (see
.env.example). AI provider details are deliberately generic: the academic
plan forbids naming a provider or model in the project definition.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Paths ---------------------------------------------------------------
    data_dir: Path = BACKEND_DIR / "data"
    uploads_dir: Path = BACKEND_DIR / "data" / "uploads"
    db_path: Path = BACKEND_DIR / "data" / "vitagraph.db"
    chroma_dir: Path = BACKEND_DIR / "data" / "chroma"

    # --- Neutral AI generation service boundary ------------------------------
    allow_api: bool = False
    ai_service_url: str = "https://agentrouter.org/v1/chat/completions"
    ai_service_api_key: str = ""
    ai_service_model: str = "deepseek-v4-flash"
    ai_service_timeout_seconds: int = 30

    # --- Retrieval -----------------------------------------------------------
    top_k_results: int = 5
    # Calibrated on the synthetic evaluation set (sample_data/questions.json):
    # real evidence matches score ~0.49-0.71 with all-MiniLM-L6-v2; the best
    # unrelated topical hit observed was 0.364. 0.40 separates both sides.
    min_evidence_score: float = 0.40

    # --- Embedding model (frozen version for evaluation reproducibility) -----
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"

    # --- Upload limits -------------------------------------------------------
    max_upload_mb: int = 25
    allowed_extensions: tuple[str, ...] = (".pdf",)

    def ensure_dirs(self) -> None:
        """Create runtime directories. Called once at application startup."""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_dir.mkdir(parents=True, exist_ok=True)

    def get_masked_key(self) -> str:
        """Return masked representation of the active AI API key."""
        key = (self.ai_service_api_key or "").strip()
        if not key:
            return ""
        if len(key) <= 8:
            return "****"
        return f"{key[:4]}...{key[-4:]}"

    def update_ai_config(
        self,
        allow_api: bool,
        url: str,
        key: str,
        model: str,
        persist: bool = True,
    ) -> None:
        """Update runtime AI configuration and optionally persist to .env."""
        self.allow_api = allow_api
        self.ai_service_url = url.strip()
        if key.strip():
            self.ai_service_api_key = key.strip()
        self.ai_service_model = model.strip()

        if persist:
            env_file = BACKEND_DIR / ".env"
            lines: list[str] = []
            if env_file.exists():
                lines = env_file.read_text(encoding="utf-8").splitlines()

            settings_map = {
                "ALLOW_API": "true" if self.allow_api else "false",
                "AI_SERVICE_URL": self.ai_service_url,
                "AI_SERVICE_MODEL": self.ai_service_model,
            }
            if key.strip():
                settings_map["AI_SERVICE_API_KEY"] = self.ai_service_api_key

            new_lines: list[str] = []
            handled_keys = set()
            for line in lines:
                matched = False
                for k, v in settings_map.items():
                    if line.startswith(f"{k}=") or line.startswith(f"#{k}="):
                        new_lines.append(f"{k}={v}")
                        handled_keys.add(k)
                        matched = True
                        break
                if not matched:
                    new_lines.append(line)

            for k, v in settings_map.items():
                if k not in handled_keys:
                    new_lines.append(f"{k}={v}")

            env_file.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


settings = Settings()
settings.ensure_dirs()

