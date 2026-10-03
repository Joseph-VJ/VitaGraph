import type { AgentEvidenceRef, ModelFallback, StageEvent, ThinkingLog, ToolCall } from "../../hooks/useAgentStream";
import type { Answer } from "../../types";

export interface TurnTrace {
  thinkingLogs: ThinkingLog[];
  stageEvents: StageEvent[];
  toolCalls: ToolCall[];
  modelFallbacks: ModelFallback[];
  error: string | null;
  diagnostic: string | null;
}

/** One question and everything that came back for it. Past turns are frozen copies of the stream state. */
export interface TurnView {
  id: string;
  text: string;
  time: string;
  answerMarkdown: string;
  result: Answer | null;
  /** The backend safety check rejected the AI wording; only the evidence-only answer is shown. */
  withheld: boolean;
  isStreaming: boolean;
  /** The user pressed Stop before the answer finished. */
  stopped: boolean;
  streamError: string | null;
  streamEvidence: AgentEvidenceRef[];
  trace: TurnTrace;
}
