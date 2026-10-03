import React, { useEffect, useRef } from "react";
import { DetentPress } from "../../motion/fx/DetentPress";
import { playDetent } from "../../motion";

export type AnswerMode = "rag_ai" | "rag_only";

// The backend rejects anything outside these bounds with a 422 (QuestionCreate.text), so the UI enforces them first.
export const MIN_QUESTION_CHARS = 3;
export const MAX_QUESTION_CHARS = 500;

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  mode: AnswerMode;
  onModeChange: (mode: AnswerMode) => void;
  /** Names the PDF the answers are limited to, shown in the placeholder. */
  scopeName?: string | null;
}

const MODES: ReadonlyArray<readonly [AnswerMode, string, string]> = [
  ["rag_ai", "Evidence + AI", "Retrieve passages from your PDF, then the AI explains them"],
  ["rag_only", "Evidence only", "Show matching passages from your PDF without calling the AI"],
];

const MAX_HEIGHT = 168;

export const ChatComposer: React.FC<ChatComposerProps> = ({ value, onChange, onSend, onStop, isStreaming, mode, onModeChange, scopeName }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Ready to type on arrival (skipped on touch so the keyboard does not pop up uninvited).
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) ref.current?.focus();
  }, []);

  // Grow with the text up to MAX_HEIGHT, then scroll inside the field.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const length = value.trim().length;
  const tooShort = length > 0 && length < MIN_QUESTION_CHARS;
  const nearLimit = value.length >= MAX_QUESTION_CHARS - 50;
  const canSend = length >= MIN_QUESTION_CHARS && !isStreaming;

  return (
    <div className="rounded-[var(--r-10)] bg-[var(--ink-800)] border border-[var(--line-control)] focus-within:border-[var(--focus)] focus-within:shadow-[0_0_0_1px_var(--focus)] transition-colors">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend(value);
          }
        }}
        placeholder={scopeName ? `Ask about ${scopeName}` : "Ask about a result, a date or a trend in your reports"}
        aria-label="Your question"
        maxLength={MAX_QUESTION_CHARS}
        className="block w-full resize-none bg-transparent px-4 pt-3 pb-1 type-body text-[var(--bone)] placeholder-[var(--faint)] focus-visible:outline-none!"
        data-testid="ask-question-input"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
        <div role="radiogroup" aria-label="Answer mode" className="flex rounded-[var(--r-6)] border border-[var(--line-control)] overflow-hidden">
          {MODES.map(([m, label, hint]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              title={hint}
              disabled={isStreaming}
              onClick={() => onModeChange(m)}
              className={`px-3 h-8 text-[13px] font-medium cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)] ${
                mode === m ? "bg-[var(--accent)] text-[var(--text-on-primary)]" : "bg-transparent text-[var(--dim)] hover:text-[var(--bone)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {tooShort ? (
            <span className="type-meta text-[var(--ochre-ink)]" role="status" data-testid="ask-too-short">
              Add a few more words (at least {MIN_QUESTION_CHARS} characters)
            </span>
          ) : nearLimit ? (
            <span className="type-meta" role="status">
              {value.length} / {MAX_QUESTION_CHARS}
            </span>
          ) : (
            <span className="type-meta hidden sm:inline">Enter to send, Shift+Enter for a new line</span>
          )}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              data-testid="ask-stop-button"
              className="inline-flex items-center gap-2 h-8 px-3.5 rounded-[var(--r-6)] bg-[var(--ink-800)] text-[var(--bone)] border border-[var(--line-control)] hover:bg-[var(--ink-700)] text-[14px] font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--madder)]" aria-hidden="true" />
              Stop
            </button>
          ) : (
            <DetentPress>
              <button
                type="button"
                disabled={!canSend}
                onClick={() => {
                  playDetent();
                  onSend(value);
                }}
                data-testid="ask-send-button"
                className="inline-flex items-center justify-center h-8 px-4 rounded-[var(--r-6)] bg-[var(--accent)] text-[var(--text-on-primary)] text-[14px] font-medium hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                Send
              </button>
            </DetentPress>
          )}
        </div>
      </div>
    </div>
  );
};
