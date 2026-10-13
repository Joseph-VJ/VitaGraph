import React, { useEffect, useId, useState } from "react";
import { aiApi, type ModelConnection, type ModelFormat, type ModelReasoning } from "../../api/ai";
import { ConfirmDialog } from "../data/ConfirmDialog";

const REASONING: { value: ModelReasoning; label: string }[] = [
  { value: "minimal", label: "Fastest" },
  { value: "low", label: "Quick" },
  { value: "medium", label: "Balanced" },
  { value: "high", label: "Thorough" },
  { value: "default", label: "Service default" },
];

const FORMATS: { value: ModelFormat; label: string }[] = [
  { value: "auto", label: "Detect from the address" },
  { value: "responses", label: "Responses" },
  { value: "chat", label: "Chat" },
];

interface Form {
  url: string;
  model: string;
  key: string;
  format: ModelFormat;
  reasoning: ModelReasoning;
}

type Busy = "idle" | "testing" | "saving" | "removing";
type Notice = { tone: "ok" | "error"; text: string } | null;

const formFrom = (c: ModelConnection): Form => ({
  url: c.url,
  model: c.model,
  key: "",
  format: c.url ? c.api_format : "auto",
  reasoning: c.reasoning,
});

const sectionHead: React.CSSProperties = {
  padding: "var(--space-6) 0 var(--space-2)",
  borderBottom: "2px solid var(--color-text)",
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-accent-700)",
};
const block: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  padding: "var(--space-4) 0",
  borderBottom: "1px solid var(--color-divider)",
};
const labelStyle: React.CSSProperties = { fontSize: "1.0625rem", fontWeight: 800 };
const helpStyle: React.CSSProperties = { fontSize: "0.875rem", color: "var(--color-neutral-700)" };
const inputStyle: React.CSSProperties = { width: "100%", maxWidth: 560 };

const hostOf = (address: string): string => {
  try {
    return new URL(address.trim()).host.toLowerCase();
  } catch {
    return "";
  }
};

function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  disabled: boolean;
  testId: string;
}) {
  return (
    <div role="radiogroup" aria-label={props.label} data-testid={props.testId} style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          disabled={props.disabled}
          className={props.value === o.value ? "btn btn-primary" : "btn btn-secondary"}
          data-testid={`${props.testId}-${o.value}`}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const announce = (c: ModelConnection) =>
  window.dispatchEvent(new CustomEvent("vitagraph:ai-config", { detail: { allow_api: c.allow_api } }));

/** The AI connection: endpoint, key, model name. The key is sent to the backend only and is never shown again. */
export const AiConnectionSection: React.FC = () => {
  const [conn, setConn] = useState<ModelConnection | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<Form>({ url: "", model: "", key: "", format: "auto", reasoning: "low" });
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<Busy>("idle");
  const [notice, setNotice] = useState<Notice>(null);
  const [canForce, setCanForce] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const urlId = useId();
  const keyId = useId();
  const keyHelpId = useId();
  const modelId = useId();

  useEffect(() => {
    let alive = true;
    aiApi
      .getModel()
      .then((c) => {
        if (!alive) return;
        setConn(c);
        setForm(formFrom(c));
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof Form>(name: K, value: Form[K]) => setForm((f) => ({ ...f, [name]: value }));

  const base = conn ? formFrom(conn) : null;
  const dirty =
    base !== null &&
    (form.url !== base.url || form.model !== base.model || form.key !== "" || form.format !== base.format || form.reasoning !== base.reasoning);
  const canEdit = conn?.can_edit ?? false;
  // A saved key is only used with the address it was saved for, so a new host needs the key typed again.
  const hostChanged = Boolean(conn?.has_key) && conn !== null && conn.url !== "" && hostOf(form.url) !== "" && hostOf(form.url) !== hostOf(conn.url);
  const needsKey = hostChanged && form.key.trim() === "";
  const filled =
    form.url.trim() !== "" && form.model.trim() !== "" && (form.key.trim() !== "" || (Boolean(conn?.has_key) && !hostChanged));
  const working = busy !== "idle";
  const effectiveFormat = form.format === "auto" ? (/\/responses\/*$/i.test(form.url.trim()) ? "responses" : "chat") : form.format;
  const showShieldWarning = canEdit && effectiveFormat === "chat" && (form.url.trim() !== "" || Boolean(conn?.has_key));

  const payload = (skipTest = false) => ({
    url: form.url.trim(),
    key: form.key.trim(),
    model: form.model.trim(),
    api_format: form.format,
    reasoning: form.reasoning,
    ...(skipTest ? { skip_test: true } : {}),
  });

  const test = async () => {
    setBusy("testing");
    setNotice(null);
    setCanForce(false);
    try {
      const result = await aiApi.testModel(payload());
      setNotice({ tone: result.ok ? "ok" : "error", text: result.message });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "The connection could not be tested." });
    } finally {
      setBusy("idle");
    }
  };

  const save = async (skipTest = false) => {
    setBusy("saving");
    setNotice(null);
    setCanForce(false);
    try {
      const next = await aiApi.saveModel(payload(skipTest));
      setConn(next);
      setForm(formFrom(next));
      setShowKey(false);
      setNotice({ tone: "ok", text: `Saved. ${next.message} The AI Agent uses it from its next question.` });
      announce(next);
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "The connection could not be saved." });
      setCanForce(true);
    } finally {
      setBusy("idle");
    }
  };

  const removeKey = async () => {
    setBusy("removing");
    setRemoveError(null);
    try {
      const next = await aiApi.removeModelKey();
      setConn(next);
      setForm(formFrom(next));
      setConfirmRemove(false);
      setNotice({ tone: "ok", text: next.message || "The saved key was removed." });
      announce(next);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "The key could not be removed.");
    } finally {
      setBusy("idle");
    }
  };

  return (
    <>
      <div style={sectionHead}>AI connection</div>

      {loadFailed ? (
        <div role="status" style={{ ...block, ...helpStyle }} data-testid="ai-conn-unavailable">
          The connection settings are not available while the backend is unreachable.
        </div>
      ) : conn === null ? (
        <div role="status" style={{ ...block, ...helpStyle }}>
          Loading
        </div>
      ) : (
        <form
          data-testid="ai-conn"
          onSubmit={(event) => {
            event.preventDefault();
            if (canEdit && filled && dirty && !working) void save();
          }}
        >
          <div style={block}>
            <div style={helpStyle}>
              The address, key and model name of the AI service that writes answers. They are saved on this computer only. Nothing is sent until you turn
              on &ldquo;Send retrieved passages to the AI model&rdquo; below.
            </div>
            {!canEdit ? (
              <div role="status" data-testid="ai-conn-readonly" style={{ ...helpStyle, color: "var(--color-accent-700)", fontWeight: 600 }}>
                This can only be changed on the computer that runs VitaGraph.
              </div>
            ) : null}
            {!conn.allow_api ? (
              <div role="status" data-testid="ai-conn-off-note" style={helpStyle}>
                Sending passages to the AI is Off, so this connection is not used yet.
              </div>
            ) : null}
          </div>

          <div style={block}>
            <label htmlFor={urlId} style={labelStyle}>
              Address
            </label>
            <div style={helpStyle}>For example https://your-provider.example/v1 or an address ending in /responses.</div>
            <input
              id={urlId}
              className="input"
              style={inputStyle}
              data-testid="ai-conn-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={500}
              disabled={!canEdit || working}
              value={form.url}
              placeholder="https://your-provider.example/v1"
              onChange={(e) => set("url", e.target.value)}
            />
          </div>

          <div style={block}>
            <label htmlFor={keyId} style={labelStyle}>
              API key
            </label>
            <div id={keyHelpId} style={needsKey ? { ...helpStyle, color: "var(--color-accent-700)", fontWeight: 600 } : helpStyle} data-testid="ai-conn-key-help">
              {needsKey
                ? "You changed the address, so paste the key again. A saved key is only used with the address it was saved for."
                : conn.has_key
                  ? `A key ending in ${conn.masked_key.slice(-4)} is saved. Leave this empty to keep it.`
                  : "Paste the key from your provider. It is never shown again."}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
              <input
                id={keyId}
                className="input"
                style={{ ...inputStyle, flex: "1 1 280px" }}
                data-testid="ai-conn-key"
                type={showKey ? "text" : "password"}
                autoComplete="new-password"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={500}
                aria-describedby={keyHelpId}
                disabled={!canEdit || working}
                value={form.key}
                placeholder={needsKey ? "Paste your API key" : conn.has_key ? "Leave empty to keep the saved key" : "Paste your API key"}
                onChange={(e) => set("key", e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost"
                data-testid="ai-conn-key-toggle"
                aria-pressed={showKey}
                disabled={!canEdit || working || form.key === ""}
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? "Hide" : "Show"}
              </button>
              {conn.has_key && canEdit ? (
                <button type="button" className="btn btn-ghost" data-testid="ai-conn-remove-key" disabled={working} onClick={() => setConfirmRemove(true)}>
                  Remove saved key
                </button>
              ) : null}
            </div>
          </div>

          <div style={block}>
            <label htmlFor={modelId} style={labelStyle}>
              Model name
            </label>
            <div style={helpStyle}>Exactly as your provider writes it.</div>
            <input
              id={modelId}
              className="input"
              style={inputStyle}
              data-testid="ai-conn-model"
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={100}
              disabled={!canEdit || working}
              value={form.model}
              placeholder="the model name from your provider"
              onChange={(e) => set("model", e.target.value)}
            />
          </div>

          <div style={block}>
            <div style={labelStyle}>Request format</div>
            <div style={helpStyle}>Most services use Chat. Choose Responses when your provider asks for it. The default reads it from the address.</div>
            <Choice label="Request format" value={form.format} options={FORMATS} disabled={!canEdit || working} testId="ai-conn-format" onChange={(v) => set("format", v)} />
            {showShieldWarning ? (
              <div role="status" data-testid="ai-conn-shield-warning" style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-accent-700)" }}>
                With the Chat format the Privacy Shield cannot hide private details before they are sent. Choose Responses if your provider supports it.
              </div>
            ) : null}
          </div>

          <div style={block}>
            <div style={labelStyle}>How carefully the AI thinks</div>
            <div style={helpStyle}>Faster settings answer sooner. Thorough settings can take much longer.</div>
            <Choice label="How carefully the AI thinks" value={form.reasoning} options={REASONING} disabled={!canEdit || working} testId="ai-conn-reasoning" onChange={(v) => set("reasoning", v)} />
          </div>

          <div style={{ ...block, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
            <button type="button" className="btn btn-secondary" data-testid="ai-conn-test" disabled={!canEdit || !filled || working} onClick={() => void test()}>
              {busy === "testing" ? "Testing…" : "Test connection"}
            </button>
            <button type="submit" className="btn btn-primary" data-testid="ai-conn-save" disabled={!canEdit || !filled || !dirty || working}>
              {busy === "saving" ? "Saving…" : "Save"}
            </button>
            {canForce ? (
              <button type="button" className="btn btn-ghost" data-testid="ai-conn-save-anyway" disabled={!canEdit || !filled || !dirty || working} onClick={() => void save(true)}>
                Save without testing
              </button>
            ) : null}
          </div>

          <div
            role={notice?.tone === "error" ? "alert" : "status"}
            data-testid="ai-conn-status"
            style={{
              minHeight: "1.5em",
              padding: "var(--space-3) 0",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: notice?.tone === "error" ? "var(--color-accent-700)" : "var(--color-text)",
            }}
          >
            {notice?.text ?? ""}
          </div>
        </form>
      )}

      {confirmRemove ? (
        <ConfirmDialog
          title="Remove the saved key?"
          body="The AI Agent and the AI summaries stop working until you save a new key. Everything else keeps working."
          confirmLabel="Remove key"
          busy={busy === "removing"}
          error={removeError}
          onConfirm={() => void removeKey()}
          onCancel={() => {
            setConfirmRemove(false);
            setRemoveError(null);
          }}
          testId="ai-conn-remove-dialog"
        />
      ) : null}
    </>
  );
};
