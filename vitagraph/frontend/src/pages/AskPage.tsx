// Ask-a-question screen: retrieval-grounded, four-part cited answers
// (plan Workflow F). Every answer shows what cannot be concluded and the
// safety guidance, and boundary requests are refused visibly.

import { useState } from "react";
import { questionsApi } from "../api/questions";
import { AnswerView } from "../components/AnswerView";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useActiveUser } from "../context/UserContext";
import type { Answer } from "../types";

const SAMPLE_QUESTIONS = [
  "What was my vitamin D level in the January report?",
  "How did my cholesterol values change between my two reports?",
  "What do my reports say about fatigue?",
  "What were my ferritin iron levels?",
  "Do I have diabetes? Please diagnose me.",
];

export function AskPage() {
  const { user } = useActiveUser();
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (question: string) => {
    if (!user || !question.trim()) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const result = await questionsApi.ask(user.id, question.trim());
      setAnswer(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return <EmptyState title="No persona selected" hint="Pick or create a persona first." />;
  }

  return (
    <div className="space-y-6">
      <section className="max-w-2xl space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Ask about your reports</h2>
        <p className="text-sm text-slate-400">
          Answers are composed only from evidence retrieved from{" "}
          <span className="text-slate-200">{user.display_label}&apos;s</span> uploaded reports,
          with citations to the source page.
        </p>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && ask(text)}
            placeholder="e.g. What was my vitamin D level in January?"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => ask(text)}
            disabled={busy || !text.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Retrieving…" : "Ask"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_QUESTIONS.map((question) => (
            <button
              key={question}
              onClick={() => {
                setText(question);
                ask(question);
              }}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
            >
              {question}
            </button>
          ))}
        </div>
      </section>

      {error && <ErrorState message={error} />}
      {answer && <AnswerView answer={answer} />}
    </div>
  );
}
