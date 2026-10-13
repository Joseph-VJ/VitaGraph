"""Application settings.

All configurable values live here so that a change never requires hunting
through module code. Values can be overridden via backend/.env (see
.env.example). AI provider details are deliberately generic: the academic
plan forbids naming a provider or model in the project definition.
"""

from __future__ import annotations

from pathlib import Path
import logging
import os

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

ALLOWED_AGENTROUTER_MODELS: frozenset[str] = frozenset({
    "deepseek-v4-flash",
    "gpt-6-astra",
    "claude-opus-5",
    "claude-opus-4-8",
})

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


def _env_file_path() -> Path:
    """The file settings are saved to: backend/.env, or the path in VITAGRAPH_ENV_FILE (used by scratch servers and tests)."""
    override = os.environ.get("VITAGRAPH_ENV_FILE", "").strip()
    return Path(override) if override else BACKEND_DIR / ".env"


def write_env_values(updates: dict[str, str]) -> None:
    """Save KEY=value lines in the .env file.

    The first `KEY=` (or `#KEY=`) line of each key is replaced, repeated `KEY=` lines are dropped, keys that are not in the file are
    appended. Every other line (comments, other settings) stays as it is. The file is replaced in one step, so a crash never leaves a
    half-written file. A value must be a single line.
    """
    for name, value in updates.items():
        if any(ch in value for ch in ("\r", "\n", "\x00")):
            raise ValueError(f"{name} must be a single line")
    env_file = _env_file_path()
    lines = env_file.read_text(encoding="utf-8").splitlines() if env_file.exists() else []
    handled: set[str] = set()
    out: list[str] = []
    for line in lines:
        hit = next((name for name in updates if line.startswith(f"{name}=") or line.startswith(f"#{name}=")), None)
        if hit is None:
            out.append(line)
        elif hit in handled:
            if not line.startswith(f"{hit}="):
                out.append(line)  # a second commented example stays; a second active line is a duplicate and goes
        else:
            out.append(f"{hit}={updates[hit]}")
            handled.add(hit)
    for name, value in updates.items():
        if name not in handled:
            out.append(f"{name}={value}")
    tmp = env_file.with_name(env_file.name + ".tmp")
    tmp.write_text("\n".join(out) + "\n", encoding="utf-8")
    os.replace(tmp, env_file)


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

    # --- AgentRouter AI Gateway ----------------------------------------------
    agentrouter_api_key: str = ""
    agentrouter_base_url: str = "https://agentrouter.org/v1"
    agentrouter_model: str = "deepseek-v4-flash"
    agentrouter_fallback_models: str = "gpt-6-astra,claude-opus-5"

    # --- Model API (provider-neutral; takes over the two blocks above) -------
    # When MODEL_API_KEY is set, MODEL_API_URL / MODEL_NAME replace the gateway
    # values below. The URL and name are only applied together with the key, so
    # an older gateway key is never sent to a different host.
    model_api_key: str = ""
    model_api_url: str = ""
    model_name: str = ""
    model_api_format: str = "chat"  # "chat" = /chat/completions, "responses" = /responses
    model_fallback_models: str = ""
    model_reasoning_effort: str = "low"  # minimal | low | medium | high; empty string turns reasoning control off
    model_reasoning_summary: str = "auto"  # asks the model for a short reasoning summary to show live; empty = off
    model_max_output_tokens: int = 50107
    model_temperature: float = 1.0
    model_top_p: float = 1.0
    # Address the agent worker uses to reach this backend's loopback translation route.
    backend_url: str = "http://127.0.0.1:8000"

    def _derive_from_model_api(self) -> None:
        """Copy MODEL_API_URL / MODEL_NAME onto the active fields. Only done together with the key, so an old gateway key can never go to a new host."""
        key = self.model_api_key.strip()
        if not key:
            return
        self.agentrouter_api_key = key
        if self.model_api_url.strip():
            self.agentrouter_base_url = self.model_api_url.strip()
        if self.model_name.strip():
            self.agentrouter_model = self.model_name.strip()
            self.agentrouter_fallback_models = self.model_fallback_models

    @model_validator(mode="after")
    def _apply_model_api(self) -> "Settings":
        if not self.model_api_key.strip():
            if self.model_api_url.strip() or self.model_name.strip():
                logger.warning("MODEL_API_URL / MODEL_NAME are set but MODEL_API_KEY is empty; ignoring them.")
            return self
        self._derive_from_model_api()
        return self

    @staticmethod
    def _normalise_base(url: str) -> str:
        url = (url or "").strip().rstrip("/")
        for suffix in ("/chat/completions", "/responses"):
            if url.endswith(suffix):
                url = url[: -len(suffix)]
        return url.rstrip("/")

    @property
    def api_format(self) -> str:
        """'responses' only while the active endpoint is the configured MODEL_API_URL, else 'chat'."""
        if (
            self.model_api_format.strip().lower() == "responses"
            and self.model_api_key.strip()
            and self.effective_base_url == self._normalise_base(self.model_api_url)
        ):
            return "responses"
        return "chat"

    @property
    def effective_api_key(self) -> str:
        return (self.agentrouter_api_key or self.ai_service_api_key or "").strip()

    @property
    def effective_base_url(self) -> str:
        url = (self.agentrouter_base_url or "").strip()
        if not url:
            url = (self.ai_service_url or "").strip()
        return self._normalise_base(url)

    @property
    def effective_model(self) -> str:
        return (self.agentrouter_model or self.ai_service_model or "deepseek-v4-flash").strip()

    @property
    def model_chain(self) -> list[str]:
        """Ordered chain of models to try: [effective_model] + fallbacks."""
        chain = [self.effective_model]
        for item in self.agentrouter_fallback_models.split(","):
            m = item.strip()
            if m and m not in chain:
                chain.append(m)
        return chain

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
        key = self.effective_api_key
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
            settings_map = {
                "ALLOW_API": "true" if self.allow_api else "false",
                "AI_SERVICE_URL": self.ai_service_url,
                "AI_SERVICE_MODEL": self.ai_service_model,
            }
            if key.strip():
                settings_map["AI_SERVICE_API_KEY"] = self.ai_service_api_key
            write_env_values(settings_map)

    def apply_model_connection(
        self,
        *,
        url: str,
        key: str,
        model: str,
        api_format: str,
        reasoning_effort: str,
        persist: bool = True,
    ) -> None:
        """Use a new model endpoint at once and (by default) remember it in the .env file.

        `key` empty keeps the key that is already saved. `api_format` is "responses" or "chat". `reasoning_effort` is
        minimal | low | medium | high, or "" to leave the choice to the provider.
        """
        self.model_api_url = url.strip()
        if key.strip():
            self.model_api_key = key.strip()
        self.model_name = model.strip()
        self.model_api_format = api_format
        self.model_reasoning_effort = reasoning_effort
        self._derive_from_model_api()
        if persist:
            updates = {
                "MODEL_API_URL": self.model_api_url,
                "MODEL_NAME": self.model_name,
                "MODEL_API_FORMAT": self.model_api_format,
                "MODEL_REASONING_EFFORT": self.model_reasoning_effort,
            }
            if key.strip():
                updates["MODEL_API_KEY"] = self.model_api_key
            write_env_values(updates)

    def forget_model_key(self, persist: bool = True) -> None:
        """Remove the saved key everywhere it is used."""
        self.model_api_key = ""
        self.agentrouter_api_key = ""
        self.ai_service_api_key = ""
        if persist:
            write_env_values({"MODEL_API_KEY": ""})


    def validate_models(self) -> None:
        """Log warning if effective_model is not in the allowed AgentRouter set."""
        if self.model_name.strip() and self.model_api_key.strip():
            return
        if self.effective_model not in ALLOWED_AGENTROUTER_MODELS:
            logger.warning(
                "Configured effective model '%s' is not in verified AgentRouter whitelist %s. "
                "Allowed models: %s",
                self.effective_model,
                sorted(ALLOWED_AGENTROUTER_MODELS),
                ", ".join(sorted(ALLOWED_AGENTROUTER_MODELS)),
            )


settings = Settings()
settings.ensure_dirs()
settings.validate_models()

