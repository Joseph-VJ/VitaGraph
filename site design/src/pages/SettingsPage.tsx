import React, { useEffect, useState } from "react";
import { aiApi, type AiConfig, type HealthInfo } from "../api/ai";
import { usersApi } from "../api/users";
import { PageFrame, PageState } from "../components/ui";
import { useActiveUser } from "../context/UserContext";
import { setPreference, usePreferences } from "../lib/preferences";

const rowBox: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-3) var(--space-6)",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "var(--space-4) 0",
  borderBottom: "1px solid var(--color-divider)",
};
const rowTitle: React.CSSProperties = { fontSize: "1.0625rem", fontWeight: 800 };
const rowDesc: React.CSSProperties = { fontSize: "0.875rem", color: "var(--color-neutral-700)" };

const Head: React.FC<{ title: string }> = ({ title }) => (
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
    {title}
  </div>
);

interface OptionRowProps {
  testId: string;
  title: string;
  desc: string;
  current: boolean | null;
  disabled: boolean;
  status?: string;
  onPick: (value: boolean) => void;
}

const OptionRow: React.FC<OptionRowProps> = ({ testId, title, desc, current, disabled, status, onPick }) => (
  <div style={rowBox} data-testid={testId}>
    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
      <div style={rowTitle}>{title}</div>
      <div style={rowDesc}>{desc}</div>
      {status ? (
        <div role="status" style={{ ...rowDesc, color: "var(--color-accent-700)", fontWeight: 600 }}>
          {status}
        </div>
      ) : null}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
      {[
        { value: true, label: "On" },
        { value: false, label: "Off" },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          className={current === option.value ? "btn btn-primary" : "btn btn-secondary"}
          aria-pressed={current === option.value}
          disabled={disabled}
          onClick={() => onPick(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const NoteRow: React.FC<{ testId: string; title: string; desc: string }> = ({ testId, title, desc }) => (
  <div
    data-testid={testId}
    style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: "var(--space-3) var(--space-6)",
      padding: "var(--space-4) 0",
      borderBottom: "1px solid var(--color-divider)",
    }}
  >
    <div style={rowTitle}>{title}</div>
    <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)", overflowWrap: "anywhere" }}>{desc}</div>
  </div>
);

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

  useEffect(() => {
    let alive = true;
    setLoadFailed(false);
    Promise.all([aiApi.getConfig(), aiApi.getHealth()])
      .then(([loadedConfig, loadedHealth]) => {
        if (!alive) return;
        setConfig(loadedConfig);
        setHealth(loadedHealth);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [loadTick]);

  const changePrivacy = async (allow: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      const next = await aiApi.setPrivacy(allow);
      setConfig(next);
      try {
        sessionStorage.setItem("vg_allow_api", String(next.allow_api));
      } catch {
        /* storage unavailable: the header reads the backend again on its next load */
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

  let privacyStatus: string | undefined;
  if (loadFailed) {
    privacyStatus = "The backend is not reachable, so this setting cannot be read or changed.";
  } else if (saveError) {
    privacyStatus = saveError;
  } else if (config && config.allow_api && !config.has_api_key) {
    privacyStatus = "No AI key is set on the backend, so answers use quoted report text only.";
  }

  const unavailable = loadFailed ? "Not available while the backend is unreachable." : "Loading";
  const chunkNote = health
    ? `About ${health.chunk_target_chars} characters per chunk, never more than ${health.chunk_max_chars}.`
    : unavailable;
  const embeddingNote = health ? `${health.embedding_model.split("/").pop()} · runs locally` : unavailable;
  const vectorNote = user
    ? `Every query is filtered to user_id ${user.id}. This cannot be turned off.`
    : "Every query is filtered to the active persona. This cannot be turned off.";

  return (
    <PageFrame label="Settings" width="narrow" gap="0">
      <style>{`
        .btn-primary { background: var(--color-accent-700) !important; color: var(--color-bg) !important; }
      `}</style>
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
      <Head title="Ingestion" />
      <OptionRow
        testId="setting-cinematic"
        title="Cinematic ingestion"
        desc="Run the full-screen show when a report is ingested."
        current={prefs.cinematic}
        disabled={false}
        onPick={(value) => setPreference("cinematic", value)}
      />
      <NoteRow testId="setting-chunk-size" title="Chunk size" desc={chunkNote} />

      <Head title="Reading" />
      <NoteRow testId="setting-embedding" title="Embedding model" desc={embeddingNote} />

      <Head title="Privacy and answers" />
      <OptionRow
        testId="setting-privacy"
        title="Send retrieved passages to the AI model"
        desc="Off keeps answers to quoted report text only."
        current={config ? config.allow_api : null}
        disabled={saving || config === null}
        status={privacyStatus}
        onPick={changePrivacy}
      />
      <NoteRow testId="setting-vector-filter" title="Vector filter" desc={vectorNote} />

      <Head title="Display" />
      <OptionRow
        testId="setting-reduce-motion"
        title="Reduce motion"
        desc="Turns off animations and transitions across the app."
        current={prefs.reduceMotion}
        disabled={false}
        onPick={(value) => setPreference("reduceMotion", value)}
      />

      <Head title="Persona" />
      <div style={rowBox} data-testid="setting-delete-persona">
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <div style={rowTitle}>Delete this persona</div>
          <div style={rowDesc}>
            {user
              ? `Removes ${user.display_label} (${user.id}) and its reports, pages, chunks, vectors, questions, answers, timeline, raw files and AI Agent folder.`
              : "No persona is active."}
          </div>
          {deleteError ? (
            <div
              role="alert"
              style={{ ...rowDesc, color: "var(--color-accent-700)", fontWeight: 600, marginTop: "var(--space-1)" }}
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
                data-testid="setting-delete-confirm"
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
    </PageFrame>
  );
};
