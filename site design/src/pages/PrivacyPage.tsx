import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { aiApi } from "../api/ai";
import {
  privacyApi,
  type LedgerRow,
  type LedgerScope,
  type PreviewResult,
  type PrivacySummary,
  type PrivacyTerm,
  type TamperResult,
  type VerifyResult,
} from "../api/privacy";
import { LedgerDrawer } from "../components/privacy/LedgerDrawer";
import { MaskedText } from "../components/privacy/MaskedText";
import { PageFrame, PageState, PersonaState, SectionHead } from "../components/ui";
import { useActiveUser } from "../context/UserContext";
import {
  countParts,
  countWord,
  formatNumber,
  formatWhen,
  hiddenLine,
  purposeLabel,
  sentSummaryLine,
  toCounts,
} from "../lib/privacyFormat";

const SAMPLE_TEXT =
  "Patient: Kiruthika R\nPhone: 98765 43210\nEmail: kiruthika@example.com\nWhat was my hemoglobin on 15 January 2025? Result: 13.8 g/dL";

const PREVIEW_DEBOUNCE_MS = 250;
const MAX_PREVIEW_CHARS = 20000;

const errorText = (error: unknown, fallback: string): string => (error instanceof Error ? error.message : fallback);

const bodyText: React.CSSProperties = { fontSize: "0.9375rem", color: "var(--color-neutral-700)", margin: 0, maxWidth: "70ch" };

const leadText: React.CSSProperties = { fontSize: "1.125rem", fontWeight: 800, letterSpacing: "-0.01em", margin: 0, maxWidth: "60ch" };

const kicker: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-neutral-700)",
};

// Every button is at least 40 px high and reads at 15 px, so it is easy to hit and easy to read.
const buttonSize: React.CSSProperties = { minHeight: 40, fontSize: "0.9375rem" };

const stack = (gap: string): React.CSSProperties => ({ display: "flex", flexDirection: "column", gap });

const Square: React.FC<{ red?: boolean }> = ({ red }) => (
  <span
    aria-hidden="true"
    style={{ display: "inline-block", width: 10, height: 10, flex: "none", background: red ? "var(--color-accent)" : "var(--color-text)" }}
  />
);

const StatCell: React.FC<{ label: string; value: string; testId: string }> = ({ label, value, testId }) => (
  <div style={{ borderTop: "2px solid var(--color-text)", paddingTop: "var(--space-3)", minWidth: 0 }}>
    <div style={kicker}>{label}</div>
    <div data-testid={testId} style={{ fontSize: "1.75rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.2, overflowWrap: "anywhere" }}>
      {value}
    </div>
  </div>
);

const Step: React.FC<{ step: string; title: string; text: string }> = ({ step, title, text }) => (
  <div style={{ background: "var(--color-surface)", borderTop: "2px solid var(--color-text)", padding: "var(--space-3)", ...stack("var(--space-1)"), minWidth: 0 }}>
    <div style={kicker}>{step}</div>
    <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>{title}</div>
    <div style={{ fontSize: "0.9375rem", color: "var(--color-neutral-700)" }}>{text}</div>
  </div>
);

const foldStyle: React.CSSProperties = {
  border: "1px solid var(--color-divider)",
  borderTop: "2px solid var(--color-text)",
};

// The shared .vg-fold class (index.css) adds the plus/minus marker, so it is clear the box can be opened.
const foldSummary: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  fontSize: "1.0625rem",
  fontWeight: 800,
  lineHeight: 1.4,
};

const HIDDEN_ITEMS = [
  ["Names", "[PERSON_1]"],
  ["Report and patient IDs", "[ID_1]"],
  ["Phone numbers", "[PHONE_1]"],
  ["Emails", "[EMAIL_1]"],
  ["Dates of birth", "[DOB_1]"],
  ["Addresses", "[ADDRESS_1]"],
  ["Aadhaar, PAN, passport numbers", "[GOV_ID_1]"],
  ["Words you added above", "[CUSTOM_1]"],
];

export const PrivacyPage: React.FC = () => {
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const userId = user?.id ?? "";

  const [summary, setSummary] = useState<PrivacySummary | null>(null);
  const [allowApi, setAllowApi] = useState<boolean | null>(null);
  const [terms, setTerms] = useState<PrivacyTerm[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [scope, setScope] = useState<LedgerScope>("persona");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadTick, setLoadTick] = useState(0);

  const [text, setText] = useState(SAMPLE_TEXT);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewFor, setPreviewFor] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTick, setPreviewTick] = useState(0);

  const [termInput, setTermInput] = useState("");
  const [termError, setTermError] = useState<string | null>(null);
  const [termBusy, setTermBusy] = useState(false);

  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [tamper, setTamper] = useState<TamperResult | null>(null);
  const [chainBusy, setChainBusy] = useState<"verify" | "tamper" | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const closeDrawer = useCallback(() => setDrawerId(null), []);

  // Everything the page shows from the server: summary, "always hide" words, the history of the chosen scope.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      privacyApi.summary(userId),
      privacyApi.terms(userId),
      privacyApi.ledger(userId, scope),
      aiApi.getConfig().then((c) => c.allow_api).catch(() => null),
    ])
      .then(([loadedSummary, loadedTerms, loadedLedger, allow]) => {
        if (!alive) return;
        setSummary(loadedSummary);
        setTerms(loadedTerms);
        setLedger(loadedLedger);
        setAllowApi(allow);
        setLoading(false);
      })
      .catch((error) => {
        if (!alive) return;
        setLoadError(errorText(error, "The privacy history could not be loaded."));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, scope, loadTick]);

  // The checks belong to one history; a different persona or scope starts unchecked.
  useEffect(() => {
    setVerify(null);
    setTamper(null);
    setChainError(null);
  }, [userId, scope]);

  // Live preview: wait for a pause in typing, cancel the request before it when a newer one starts.
  const previewTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    if (!text.trim()) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    if (text.length > MAX_PREVIEW_CHARS) {
      setPreview(null);
      setPreviewError(`That text is longer than ${formatNumber(MAX_PREVIEW_CHARS)} characters.`);
      return;
    }
    const controller = new AbortController();
    previewTimer.current = window.setTimeout(() => {
      privacyApi
        .preview(userId, text, controller.signal)
        .then((result) => {
          setPreview(result);
          setPreviewFor(text);
          setPreviewError(null);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setPreviewError(errorText(error, "The preview could not be made."));
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
      controller.abort();
    };
  }, [userId, text, previewTick]);

  const addTerm = async () => {
    const term = termInput.trim();
    if (!term || termBusy) return;
    setTermBusy(true);
    setTermError(null);
    try {
      const created = await privacyApi.addTerm(userId, term);
      setTerms((current) => [created, ...current]);
      setTermInput("");
      setPreviewTick((n) => n + 1);
    } catch (error) {
      setTermError(errorText(error, "The word could not be added."));
    } finally {
      setTermBusy(false);
    }
  };

  const removeTerm = async (id: string) => {
    setTermError(null);
    try {
      await privacyApi.deleteTerm(userId, id);
      setTerms((current) => current.filter((t) => t.id !== id));
      setPreviewTick((n) => n + 1);
    } catch (error) {
      setTermError(errorText(error, "The word could not be removed."));
    }
  };

  const runVerify = async () => {
    setChainBusy("verify");
    setChainError(null);
    try {
      setVerify(await privacyApi.verify(userId, scope));
    } catch (error) {
      setChainError(errorText(error, "The history could not be checked."));
    } finally {
      setChainBusy(null);
    }
  };

  const runTamper = async () => {
    setChainBusy("tamper");
    setChainError(null);
    try {
      setTamper(await privacyApi.tamperTest(userId, scope));
    } catch (error) {
      setChainError(errorText(error, "The test could not run."));
    } finally {
      setChainBusy(null);
    }
  };

  if (!user) {
    return (
      <PageFrame label="Privacy Shield">
        <PersonaState loading={personaLoading} onRetry={() => void refreshUsers()} />
      </PageFrame>
    );
  }

  if (loadError) {
    return (
      <PageFrame label="Privacy Shield">
        <PageState
          kind="error"
          title="The privacy history is not available"
          detail={loadError}
          action={{ label: "Try again", onClick: () => setLoadTick((n) => n + 1) }}
        />
      </PageFrame>
    );
  }

  if (loading && !summary) {
    return (
      <PageFrame label="Privacy Shield">
        <PageState kind="loading" title="Loading the privacy page" />
      </PageFrame>
    );
  }

  const previewParts = preview ? countParts(toCounts(preview.counts)) : [];
  const lastCheck = verify ? (verify.ok ? "Nothing was changed" : "Something was changed") : "Not checked yet";

  return (
    <PageFrame label="Privacy Shield" testId="privacy-page">
      {/* 1. Am I safe? */}
      <section
        aria-label="Shield status"
        style={{ ...stack("var(--space-4)"), border: "1px solid var(--color-divider)", borderTop: "3px solid var(--color-accent)", padding: "var(--space-4)" }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.25, margin: 0, maxWidth: "36ch" }}>
          VitaGraph hides the private details it recognises before anything goes to the AI.
        </h2>
        <p data-testid="privacy-limits" style={{ ...bodyText, maxWidth: "72ch" }}>
          It finds names, IDs, phone numbers, emails and addresses that have a label such as "Patient Name:", or that follow a known pattern. It can miss a name written inside a sentence, a first name on its own, or a name in another language. If you see one, add it under "Hide more words" below.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "var(--space-3)" }}>
          <Step step="Step 1" title="You ask a question" text="Type it in the AI Agent." />
          <Step step="Step 2" title="VitaGraph hides your details" text="Names, IDs and phone numbers are swapped for tags on this computer." />
          <Step step="Step 3" title="The AI answers" text="Your details are put back on your screen." />
        </div>

        <p data-testid="privacy-summary-line" style={{ ...bodyText, fontSize: "1.0625rem", color: "var(--color-text)" }}>
          {sentSummaryLine(summary?.calls ?? 0, summary?.removed_total ?? 0)}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-6)" }}>
          <StatCell label="Messages sent to the AI" value={formatNumber(summary?.calls ?? 0)} testId="privacy-stat-calls" />
          <StatCell label="Private details hidden" value={formatNumber(summary?.removed_total ?? 0)} testId="privacy-stat-masked" />
          <StatCell label="Characters of text sent" value={formatNumber(summary?.chars_sent ?? 0)} testId="privacy-stat-chars" />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
          {allowApi !== null ? (
            <span className="tag tag-neutral" style={{ fontWeight: 800, fontSize: "0.8125rem" }} data-testid="privacy-send-state">
              Sending to the AI is {allowApi ? "On" : "Off"}
            </span>
          ) : null}
          {summary && !summary.covered ? (
            <span className="tag tag-outline" style={{ fontWeight: 800, fontSize: "0.8125rem" }} data-testid="privacy-not-covered">
              Not covered
            </span>
          ) : null}
          <span style={bodyText}>
            {summary && !summary.covered
              ? "This kind of AI connection does not pass through the shield."
              : allowApi === false
                ? "Nothing leaves this computer while sending is Off."
                : "Every message to the AI passes through the shield. There is no off switch."}{" "}
            {allowApi !== null ? (
              <Link to="/settings" style={{ color: "var(--color-accent-700)", fontWeight: 800 }}>
                Change in Settings
              </Link>
            ) : null}
          </span>
        </div>
      </section>

      {/* 2. Try it */}
      <section style={stack("var(--space-3)")}>
        <SectionHead title="Try it" accent />
        <p style={leadText}>Type anything and watch your details disappear.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center", justifyContent: "space-between" }}>
          <label htmlFor="privacy-try" style={bodyText}>
            This is an example. Replace it with your own text.
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="privacy-try-example"
            onClick={() => setText(SAMPLE_TEXT)}
            style={buttonSize}
          >
            Use an example
          </button>
        </div>
        <textarea
          id="privacy-try"
          data-testid="privacy-try-input"
          className="input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          style={{ minHeight: 120, width: "100%", fontSize: "0.9375rem" }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "var(--space-4)" }}>
          <div style={{ minWidth: 0, borderTop: "2px solid var(--color-divider)", paddingTop: "var(--space-2)" }}>
            <div style={{ ...kicker, paddingBottom: "var(--space-2)" }}>What you typed</div>
            <MaskedText mode="original" text={text} spans={preview && !previewError && previewFor === text ? preview.spans : []} testId="privacy-original" />
          </div>
          <div style={{ minWidth: 0, borderTop: "2px solid var(--color-text)", paddingTop: "var(--space-2)" }}>
            <div style={{ ...kicker, paddingBottom: "var(--space-2)" }}>What the AI would get</div>
            <MaskedText mode="masked" text={preview ? preview.masked : ""} testId="privacy-masked" />
          </div>
        </div>
        {previewError ? (
          <div role="alert" style={{ fontSize: "0.9375rem", color: "var(--color-accent-800)", background: "var(--color-accent-100)", padding: "var(--space-3)" }}>
            {previewError}
          </div>
        ) : (
          <div data-testid="privacy-counts" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
            {preview ? (
              previewParts.length > 0 ? (
                <>
                  <span style={bodyText}>Hidden:</span>
                  {previewParts.map((part) => (
                    <span key={part} className="tag tag-neutral" style={{ fontSize: "0.8125rem" }}>
                      {part}
                    </span>
                  ))}
                </>
              ) : (
                <span style={bodyText}>Nothing personal found.</span>
              )
            ) : null}
          </div>
        )}
        <p style={bodyText}>
          A tag like [PERSON_1] means a name was hidden. [PHONE_1] is a phone number and [ID_1] is an ID. Nothing is sent or saved while you type here.
        </p>
      </section>

      {/* 3. Hide more words */}
      <section style={stack("var(--space-3)")}>
        <SectionHead title="Hide more words" accent />
        <p style={bodyText}>
          Is there a name or place that must never reach the AI? Add it here. It will be hidden in everything sent.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void addTerm();
          }}
          style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}
        >
          <input
            className="input"
            data-testid="privacy-term-input"
            aria-label="Word to always hide"
            placeholder="A name or place"
            maxLength={80}
            value={termInput}
            onChange={(event) => setTermInput(event.target.value)}
            style={{ flex: "1 1 240px", width: "auto", minHeight: 40, fontSize: "0.9375rem" }}
          />
          <button type="submit" className="btn btn-primary" data-testid="privacy-term-add" disabled={termBusy || termInput.trim().length < 2} style={buttonSize}>
            Add
          </button>
        </form>
        {termError ? (
          <div role="alert" data-testid="privacy-term-error" style={{ fontSize: "0.9375rem", color: "var(--color-accent-800)" }}>
            {termError}
          </div>
        ) : null}
        {terms.length > 0 ? (
          <ul
            data-testid="privacy-terms"
            aria-label="Words that are always hidden"
            style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}
          >
            {terms.map((t) => (
              <li
                key={t.id}
                title={`Added ${formatWhen(t.created_at)}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  maxWidth: "100%",
                  minHeight: 40,
                  background: "var(--color-surface)",
                  borderLeft: "3px solid var(--color-accent)",
                  paddingLeft: "var(--space-3)",
                }}
              >
                <span style={{ fontWeight: 800, fontSize: "0.9375rem", overflowWrap: "anywhere" }}>{t.term}</span>
                <button type="button" className="btn btn-ghost" onClick={() => void removeTerm(t.id)} aria-label={`Remove ${t.term}`} style={buttonSize}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={bodyText}>No words added yet.</p>
        )}
      </section>

      {/* 4. History of what was sent */}
      <section style={stack("var(--space-3)")}>
        <SectionHead
          title="History of what was sent"
          accent
          aside={
            <div className="seg" role="group" aria-label="Show the history of">
              <label className="seg-opt" style={{ position: "relative", minHeight: 40, fontSize: "0.9375rem" }}>
                <input type="radio" name="ledger-scope" checked={scope === "persona"} onChange={() => setScope("persona")} />
                My questions
              </label>
              <label className="seg-opt" style={{ position: "relative", minHeight: 40, fontSize: "0.9375rem" }}>
                <input type="radio" name="ledger-scope" checked={scope === "tools"} onChange={() => setScope("tools")} />
                Tools (Text to Graph)
              </label>
            </div>
          }
        />
        {ledger.length === 0 ? (
          <PageState
            kind="empty"
            title={scope === "persona" ? "Nothing has been sent to the AI yet" : "Nothing has been sent from the Tools yet"}
            detail={
              scope === "persona"
                ? "Ask the AI Agent something and come back."
                : "Text to Graph and the connection test appear here."
            }
            testId="privacy-ledger-empty"
          />
        ) : (
          <ul data-testid="privacy-ledger" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {ledger.map((row) => (
              <li
                key={row.id}
                data-testid="privacy-ledger-row"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  padding: "var(--space-3) 0",
                  borderBottom: "1px solid var(--color-divider)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "1.0625rem", fontWeight: 800 }}>{purposeLabel(row.purpose)}</div>
                  <div style={{ ...bodyText, fontVariantNumeric: "tabular-nums" }}>
                    {formatWhen(row.created_at)} · {countWord(row.chars_sent, "character", "characters")} · {hiddenLine(row.removed_total)}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setDrawerId(row.id)} data-testid="privacy-ledger-view" style={buttonSize}>
                  See what was sent
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5. Advanced */}
      <details className="vg-fold" data-testid="privacy-advanced" style={foldStyle}>
        <summary style={foldSummary}>
          <span>Advanced: prove nothing was changed</span>
          <span style={{ fontSize: "0.9375rem", fontWeight: 400, color: "var(--color-neutral-700)", marginLeft: "var(--space-3)" }}>
            For people who want proof
          </span>
        </summary>
        <div style={{ ...stack("var(--space-3)"), padding: "var(--space-2) var(--space-4) var(--space-4)" }}>
          <p style={bodyText}>
            Every record in the history is locked to the one before it, like numbered pages sewn into a book. If anyone edits an old record, this check fails.
          </p>
          <div style={{ maxWidth: 320 }}>
            <StatCell label="Last check" value={lastCheck} testId="privacy-stat-ledger" />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <button type="button" className="btn btn-secondary" data-testid="privacy-verify" onClick={() => void runVerify()} disabled={chainBusy !== null} style={buttonSize}>
              {chainBusy === "verify" ? "Checking" : "Check that nothing was changed"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              data-testid="privacy-tamper"
              onClick={() => void runTamper()}
              disabled={chainBusy !== null || ledger.length === 0}
              style={buttonSize}
            >
              {chainBusy === "tamper" ? "Testing" : "Try to cheat (on a copy)"}
            </button>
          </div>
          <p style={bodyText}>
            "Try to cheat" changes one letter in a copy of the history and shows the check catching it. Your real records are never touched.
          </p>
          <div aria-live="polite" style={stack("var(--space-2)")}>
            {verify ? (
              <div data-testid="privacy-verify-result" style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", fontSize: "0.9375rem" }}>
                <Square red={!verify.ok} />
                <span>
                  {verify.ok
                    ? verify.checked === 0
                      ? "There is nothing to check yet."
                      : `All ${countWord(verify.checked, "record", "records")} checked. Nothing was changed.`
                    : `Record ${verify.broken_at_seq ?? "?"} was changed after it was written.`}
                </span>
              </div>
            ) : null}
            {tamper ? (
              <div data-testid="privacy-tamper-result" style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start", fontSize: "0.9375rem" }}>
                <span style={{ paddingTop: 5 }}>
                  <Square red={!tamper.detected} />
                </span>
                <span>
                  {tamper.detected
                    ? `Test on a copy: one letter in record ${tamper.changed_seq} was changed, and the check caught it at record ${tamper.detected_at_seq ?? tamper.changed_seq}. Your real records were not touched.`
                    : `Test on a copy: one letter in record ${tamper.changed_seq} was changed and the check did not notice. Your real records were not touched.`}
                </span>
              </div>
            ) : null}
            {chainError ? (
              <div role="alert" style={{ fontSize: "0.9375rem", color: "var(--color-accent-800)" }}>
                {chainError}
              </div>
            ) : null}
          </div>
        </div>
      </details>

      {/* 6. What is hidden and what is kept */}
      <details className="vg-fold" data-testid="privacy-keeps" style={foldStyle}>
        <summary style={foldSummary}>
          <span>What is hidden, and what is kept</span>
        </summary>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: "var(--space-6)",
            padding: "var(--space-2) var(--space-4) var(--space-4)",
          }}
        >
          <div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 800, paddingBottom: "var(--space-2)" }}>Hidden before sending</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {HIDDEN_ITEMS.map(([label, example]) => (
                <li
                  key={label}
                  style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--space-2)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-divider)", fontSize: "0.9375rem" }}
                >
                  <span>{label}</span>
                  <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{example}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: "1.0625rem", fontWeight: 800, paddingBottom: "var(--space-2)" }}>Kept, because the answer needs it</div>
            <p style={bodyText}>
              Test names, values, units, normal ranges, flags, test dates, lab name, age and sex. VitaGraph compares your reports over time, so the AI needs these. Only what is needed is shared.
            </p>
          </div>
        </div>
      </details>

      {drawerId ? <LedgerDrawer userId={userId} scope={scope} rowIds={[drawerId]} onClose={closeDrawer} /> : null}
    </PageFrame>
  );
};
