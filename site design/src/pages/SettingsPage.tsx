import React, { useEffect, useState } from "react";
import { aiApi, type AiConfig, type HealthInfo } from "../api/ai";
import { usersApi } from "../api/users";
import { reportsApi } from "../api/reports";
import { PageState } from "../components/ui";
import { useActiveUser } from "../context/UserContext";
import {
  BACKGROUND_LEVEL_DEFAULT,
  BACKGROUND_LEVEL_MAX,
  BACKGROUND_LEVEL_MIN,
  setPreference,
  usePreferences,
  type ProcessSpeed,
} from "../lib/preferences";

export const SettingsPage: React.FC = () => {
  const { user, setUser, refreshUsers } = useActiveUser();
  const prefs = usePreferences();
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadTick, setLoadTick] = useState(0);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "deleting">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [chunkSize, setChunkSize] = useState<number>(prefs.chunkSize || 200);
  const [avgCharsPerPage, setAvgCharsPerPage] = useState<number | null>(null);

  // Sync chunkSize with prefs if prefs change
  useEffect(() => {
    if (prefs.chunkSize) {
      setChunkSize(prefs.chunkSize);
    }
  }, [prefs.chunkSize]);

  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    Promise.all([aiApi.getConfig(), aiApi.getHealth()])
      .then(([loadedConfig, loadedHealth]) => {
        if (!alive) return;
        setConfig(loadedConfig);
        setHealth(loadedHealth);
        if (typeof loadedHealth.chunk_target_chars === "number") {
          const storedRaw = localStorage.getItem("vitagraph_preferences");
          if (!storedRaw || !JSON.parse(storedRaw).chunkSize) {
            setChunkSize(loadedHealth.chunk_target_chars);
            setPreference("chunkSize", loadedHealth.chunk_target_chars);
          }
        }
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [loadTick]);

  // Load latest report pages to compute avgCharsPerPage for the estimate
  useEffect(() => {
    if (!user?.id) {
      setAvgCharsPerPage(null);
      return;
    }
    let alive = true;
    reportsApi
      .list(user.id)
      .then(async (reps) => {
        if (!alive) return;
        if (!reps || reps.length === 0) {
          setAvgCharsPerPage(null);
          return;
        }
        const latest = reps[0];
        try {
          const pgs = await reportsApi.pages(user.id, latest.id);
          if (!alive) return;
          if (pgs && pgs.length > 0) {
            const totalChars = pgs.reduce((acc, p) => acc + (p.text_length || 0), 0);
            setAvgCharsPerPage(totalChars / pgs.length);
          } else {
            setAvgCharsPerPage(null);
          }
        } catch {
          if (alive) setAvgCharsPerPage(null);
        }
      })
      .catch(() => {
        if (alive) setAvgCharsPerPage(null);
      });

    return () => {
      alive = false;
    };
  }, [user?.id]);

  const changePrivacy = async (allow: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      const next = await aiApi.setPrivacy(allow);
      setConfig(next);
      try {
        sessionStorage.setItem("vg_allow_api", String(next.allow_api));
      } catch {
        /* storage unavailable */
      }
      window.dispatchEvent(new CustomEvent("vitagraph:ai-config", { detail: { allow_api: next.allow_api } }));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "The change could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const deletePersona = async () => {
    if (!user) return;
    setDeleteStep("deleting");
    setDeleteError(null);
    try {
      await usersApi.remove(user.id);
      setUser(null);
      setDeleteStep("idle");
      await refreshUsers();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "The persona could not be deleted.");
      setDeleteStep("confirm");
    }
  };

  const unavailable = loadFailed ? "Not available while the backend is unreachable." : "Loading";
  const embeddingNote = health ? `${health.embedding_model.split("/").pop()} · 384 dimensions · runs locally` : unavailable;
  const vectorNote = user
    ? `Every query is filtered to user_id ${user.id}. This cannot be turned off.`
    : "Every query is filtered to the active persona. This cannot be turned off.";

  const chunkEstimate =
    avgCharsPerPage !== null && avgCharsPerPage > 0 && chunkSize > 0
      ? `${Math.ceil((5 * avgCharsPerPage) / chunkSize)} chunks`
      : "Upload a report to see an estimate";

  return (
    <div
      data-screen-label="Settings"
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "var(--space-8)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {loadFailed ? (
        <PageState
          kind="offline"
          title="Backend settings are not available"
          detail="The backend did not answer. Settings stored in this browser still work."
          action={{
            label: "Try again",
            onClick: () => setLoadTick((t) => t + 1),
          }}
        />
      ) : null}

      {/* INGESTION */}
      <div
        style={{
          padding: "var(--space-6) 0 var(--space-2)",
          borderBottom: "2px solid var(--color-text)",
          fontSize: "0.6875rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-accent-700)",
        }}
      >
        Ingestion
      </div>

      {/* Process speed */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Process speed</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            Fast is about 13 s, Normal about 25 s, Real-time about 45 s for the full show.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {[
            { key: "fast" as ProcessSpeed, label: "Fast" },
            { key: "normal" as ProcessSpeed, label: "Normal" },
            { key: "slow" as ProcessSpeed, label: "Real-time" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={prefs.speed === item.key ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setPreference("speed", item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chunk size */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Chunk size</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            Characters per chunk. Smaller chunks mean more chunks.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <input
            type="range"
            min={120}
            max={600}
            step={10}
            value={chunkSize}
            onChange={(e) => {
              const val = Number(e.target.value);
              setChunkSize(val);
              setPreference("chunkSize", val);
            }}
            style={{ width: 220, accentColor: "var(--color-accent)" }}
          />
          <span style={{ width: "5rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {chunkSize} chars
          </span>
        </div>
      </div>

      {/* Chunks for a 5-page report */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--space-6)",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Chunks for a 5-page report</div>
        <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)", textAlign: "right" }}>
          {chunkEstimate}
        </div>
      </div>

      {/* READING */}
      <div
        style={{
          padding: "var(--space-6) 0 var(--space-2)",
          borderBottom: "2px solid var(--color-text)",
          fontSize: "0.6875rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-accent-700)",
        }}
      >
        Reading
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--space-6)",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Embedding model</div>
        <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)", textAlign: "right" }}>
          {embeddingNote}
        </div>
      </div>

      {/* PRIVACY AND ANSWERS */}
      <div
        style={{
          padding: "var(--space-6) 0 var(--space-2)",
          borderBottom: "2px solid var(--color-text)",
          fontSize: "0.6875rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-accent-700)",
        }}
      >
        Privacy and answers
      </div>

      {/* Send retrieved passages to the AI model */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Send retrieved passages to the AI model</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            Off keeps answers to quoted report text only.
          </div>
          {saveError ? (
            <div role="status" style={{ fontSize: "0.875rem", color: "var(--color-accent-700)", fontWeight: 600 }}>
              {saveError}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <button
            type="button"
            className={config?.allow_api ? "btn btn-primary" : "btn btn-secondary"}
            disabled={saving || config === null}
            onClick={() => changePrivacy(true)}
          >
            On
          </button>
          <button
            type="button"
            className={config && !config.allow_api ? "btn btn-primary" : "btn btn-secondary"}
            disabled={saving || config === null}
            onClick={() => changePrivacy(false)}
          >
            Off
          </button>
        </div>
      </div>

      {/* Vector filter */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--space-6)",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Vector filter</div>
        <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)", textAlign: "right" }}>
          {vectorNote}
        </div>
      </div>

      {/* DISPLAY */}
      <div
        style={{
          padding: "var(--space-6) 0 var(--space-2)",
          borderBottom: "2px solid var(--color-text)",
          fontSize: "0.6875rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-accent-700)",
        }}
      >
        Display
      </div>

      {/* Reduce motion */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Reduce motion</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            Shortens animations and stops graph rotation.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <button
            type="button"
            className={prefs.reduceMotion ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setPreference("reduceMotion", true)}
          >
            On
          </button>
          <button
            type="button"
            className={!prefs.reduceMotion ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setPreference("reduceMotion", false)}
          >
            Off
          </button>
        </div>
      </div>

      {/* Living background */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Living background</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            A quiet moving layer behind the pages. It never covers text.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <button
            type="button"
            className={prefs.background === "off" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setPreference("background", "off")}
          >
            Off
          </button>
          <button
            type="button"
            className={prefs.background === "soft" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setPreference("background", "soft")}
          >
            Soft
          </button>
          <button
            type="button"
            className={prefs.background === "full" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setPreference("background", "full")}
          >
            Full
          </button>
        </div>
      </div>

      {/* Background intensity: lighter or darker */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
          opacity: prefs.background === "off" ? 0.5 : 1,
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Background intensity</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            Make the background lighter or darker. 100 % is the designed look.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-neutral-700)" }}>Lighter</span>
          <input
            type="range"
            aria-label="Background intensity"
            min={BACKGROUND_LEVEL_MIN}
            max={BACKGROUND_LEVEL_MAX}
            step={5}
            value={prefs.backgroundLevel}
            disabled={prefs.background === "off"}
            onChange={(e) => setPreference("backgroundLevel", Number(e.target.value))}
            style={{ width: 200, accentColor: "var(--color-accent)" }}
          />
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-neutral-700)" }}>Darker</span>
          <span style={{ width: "3.5rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
            {prefs.backgroundLevel} %
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={prefs.background === "off" || prefs.backgroundLevel === BACKGROUND_LEVEL_DEFAULT}
            onClick={() => setPreference("backgroundLevel", BACKGROUND_LEVEL_DEFAULT)}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Background style */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Background style</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            Choose the pattern and motion of the decorative canvas.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--space-2)", flex: "2 1 320px" }}>
          <button
            type="button"
            className={prefs.backgroundEngine === "warp" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "var(--space-2) var(--space-3)" }}
            onClick={() => setPreference("backgroundEngine", "warp")}
          >
            <span style={{ fontWeight: 800 }}>Rubber grid</span>
            <span style={{ fontSize: "0.75rem", opacity: 0.85, fontWeight: 400 }}>Page grid bends</span>
          </button>
          <button
            type="button"
            className={prefs.backgroundEngine === "flow" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "var(--space-2) var(--space-3)" }}
            onClick={() => setPreference("backgroundEngine", "flow")}
          >
            <span style={{ fontWeight: 800 }}>Ink currents</span>
            <span style={{ fontSize: "0.75rem", opacity: 0.85, fontWeight: 400 }}>Flowing ink lines</span>
          </button>
          <button
            type="button"
            className={prefs.backgroundEngine === "stars" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "var(--space-2) var(--space-3)" }}
            onClick={() => setPreference("backgroundEngine", "stars")}
          >
            <span style={{ fontWeight: 800 }}>Constellation</span>
            <span style={{ fontSize: "0.75rem", opacity: 0.85, fontWeight: 400 }}>Connected data dots</span>
          </button>
          <button
            type="button"
            className={prefs.backgroundEngine === "type" ? "btn btn-primary" : "btn btn-secondary"}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "var(--space-2) var(--space-3)" }}
            onClick={() => setPreference("backgroundEngine", "type")}
          >
            <span style={{ fontWeight: 800 }}>Living type</span>
            <span style={{ fontSize: "0.75rem", opacity: 0.85, fontWeight: 400 }}>Spells app actions</span>
          </button>
        </div>
      </div>

      {/* Play mode */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Play mode</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            Fill the page and play with the layer. Esc leaves.
          </div>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.dispatchEvent(new CustomEvent("vitagraph:enter-play"))}
          >
            Enter play mode
          </button>
        </div>
      </div>

      {/* PERSONA */}
      <div
        style={{
          padding: "var(--space-6) 0 var(--space-2)",
          borderBottom: "2px solid var(--color-text)",
          fontSize: "0.6875rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-accent-700)",
        }}
      >
        Persona
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-3) var(--space-6)",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--space-4) 0",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Delete this persona</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            {user
              ? `Removes ${user.display_label} (${user.id}) and its reports, pages, chunks, vectors, questions, answers, timeline, raw files, AI Agent folder, AI Agent conversations, artifacts and AI call records.`
              : "No persona is active."}
          </div>
          {deleteError ? (
            <div
              role="alert"
              style={{ fontSize: "0.875rem", color: "var(--color-accent-700)", fontWeight: 600, marginTop: "var(--space-1)" }}
            >
              {deleteError}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {deleteStep === "idle" ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!user}
              onClick={() => setDeleteStep("confirm")}
            >
              Delete persona
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={deleteStep === "deleting"}
                onClick={deletePersona}
              >
                {deleteStep === "deleting" ? "Deleting" : "Yes, delete everything"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={deleteStep === "deleting"}
                onClick={() => setDeleteStep("idle")}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
