import React, { useEffect, useState } from "react";
import { aiApi, type AiConfig, type HealthInfo } from "../api/ai";
import { usersApi } from "../api/users";
import { reportsApi } from "../api/reports";
import { PageState } from "../components/ui";
import { useActiveUser } from "../context/UserContext";
import { setPreference, usePreferences, type ProcessSpeed } from "../lib/preferences";

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
          const pgs = await reportsApi.pages(latest.id);
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

      {/* Cinematic ingestion */}
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
          <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>Cinematic ingestion</div>
          <div style={{ fontSize: "0.875rem", color: "var(--color-neutral-700)" }}>
            Run the full-screen show when a report is ingested.
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <button
            type="button"
            className={prefs.cinematic ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setPreference("cinematic", true)}
          >
            On
          </button>
          <button
            type="button"
            className={!prefs.cinematic ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setPreference("cinematic", false)}
          >
            Off
          </button>
        </div>
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
            Shortens the ingestion show and stops graph rotation.
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
