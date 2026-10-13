import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { agentApi, type Conversation } from "../../api/agent";
import type { OverviewChat } from "../../api/overview";
import { splitFollowUps } from "../../lib/answerFormat";
import { formatWhen } from "../../lib/privacyFormat";
import { Tag } from "../ui";
import { bodyStyle, errorText, kickerStyle, mutedStyle, plural } from "./helpers";
import { actionStyle } from "./ReportDetail";

/** The answer as plain reading text: no links, no pictures, no tool details. */
const PLAIN: Components = {
  p: ({ children }) => <p style={{ ...bodyStyle, margin: "0 0 var(--space-2)" }}>{children}</p>,
  ul: ({ children }) => <ul style={{ ...bodyStyle, margin: "0 0 var(--space-2)", paddingLeft: "1.3em", listStyle: "square" }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ ...bodyStyle, margin: "0 0 var(--space-2)", paddingLeft: "1.5em", listStyle: "decimal" }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: "var(--space-1)" }}>{children}</li>,
  h1: ({ children }) => <p style={{ ...bodyStyle, fontWeight: 800, margin: "0 0 var(--space-1)" }}>{children}</p>,
  h2: ({ children }) => <p style={{ ...bodyStyle, fontWeight: 800, margin: "0 0 var(--space-1)" }}>{children}</p>,
  h3: ({ children }) => <p style={{ ...bodyStyle, fontWeight: 800, margin: "0 0 var(--space-1)" }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 800 }}>{children}</strong>,
  a: ({ children }) => <span>{children}</span>,
  img: () => null,
  pre: ({ children }) => <pre style={{ ...bodyStyle, whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "0 0 var(--space-2)", background: "var(--color-bg)", padding: "var(--space-3)" }}>{children}</pre>,
  code: ({ children }) => <code style={{ fontFamily: "inherit", fontWeight: 600 }}>{children}</code>,
};

export function chatTitle(chat: Pick<OverviewChat, "title" | "first_question">): string {
  return chat.title?.trim() || chat.first_question?.trim() || "Untitled chat";
}

export interface ChatRowProps {
  userId: string;
  chat: OverviewChat;
  open: boolean;
  onToggle: () => void;
  onDelete: (chat: OverviewChat) => void;
}

/** One chat with the AI Agent. The header is a button; opening it shows the questions and answers as plain text. */
export const ChatRow: React.FC<ChatRowProps> = ({ userId, chat, open, onToggle, onDelete }) => {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setConversation(null);
    setError(null);
    agentApi
      .getConversation(userId, chat.id)
      .then((data) => alive && setConversation(data))
      .catch((e: unknown) => alive && setError(errorText(e, "The chat could not be loaded.")));
    return () => {
      alive = false;
    };
  }, [open, userId, chat.id]);

  const summary = useMemo(() => {
    const parts = [plural(chat.questions, "question", "questions")];
    if (chat.reports_used.length > 0) parts.push(`used ${plural(chat.reports_used.length, "report", "reports")}`);
    if (chat.refused > 0) parts.push(`${chat.refused} refused`);
    return parts.join(" · ");
  }, [chat]);

  const panelId = `data-chat-panel-${chat.id}`;

  return (
    <li style={{ borderBottom: "1px solid var(--color-divider)", listStyle: "none" }} data-testid="data-chat-row" data-chat-id={chat.id}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        style={{
          appearance: "none",
          width: "100%",
          minHeight: 64,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          alignItems: "center",
          gap: "var(--space-3)",
          textAlign: "left",
          font: "inherit",
          color: "var(--color-text)",
          background: open ? "var(--color-surface)" : "transparent",
          border: 0,
          borderLeft: open ? "5px solid var(--color-accent)" : "5px solid transparent",
          padding: "var(--space-4)",
          cursor: "pointer",
        }}
      >
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
          <span style={{ fontSize: "1.0625rem", fontWeight: 800, overflowWrap: "anywhere" }}>{chatTitle(chat)}</span>
          <span style={mutedStyle}>
            {formatWhen(chat.updated_at)} · {summary}
          </span>
        </span>
        <span aria-hidden="true" style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--color-neutral-700)", whiteSpace: "nowrap" }}>
          {open ? "Hide" : "Open"}
        </span>
      </button>

      {open ? (
        <div
          id={panelId}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-4) var(--space-4) var(--space-6)", background: "var(--color-surface)", borderTop: "1px solid var(--color-divider)" }}
          data-testid="data-chat-detail"
        >
          {chat.reports_used.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
              <span style={kickerStyle}>Reports used</span>
              {chat.reports_used.map((used) =>
                used.deleted ? (
                  <Tag key={used.id} tone="neutral" title="This report has been deleted.">
                    {used.filename || "A report"} (deleted)
                  </Tag>
                ) : (
                  <Link
                    key={used.id}
                    to={`/library?report=${encodeURIComponent(used.id)}`}
                    className="vg-chip"
                    style={{ textDecoration: "none", minHeight: 36, display: "inline-flex", alignItems: "center" }}
                  >
                    {used.filename || "A report"}
                  </Link>
                )
              )}
            </div>
          ) : null}

          {error ? (
            <p role="alert" style={{ ...bodyStyle, color: "var(--color-accent-800)" }}>{error}</p>
          ) : conversation === null ? (
            <p style={mutedStyle}>Loading the chat</p>
          ) : conversation.messages.length === 0 ? (
            <p style={mutedStyle}>This chat has no messages.</p>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {conversation.messages.map((message) => {
                const isUser = message.role === "user";
                const text = isUser ? message.content : splitFollowUps(message.content).body;
                const looked = isUser ? [] : Array.from(new Set(message.evidence.map((card) => card.report_filename).filter(Boolean)));
                return (
                  <li
                    key={message.seq}
                    style={{
                      borderLeft: isUser ? "3px solid var(--color-text)" : "3px solid var(--color-divider)",
                      paddingLeft: "var(--space-3)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-1)",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
                      <span style={kickerStyle}>{isUser ? "You asked" : "AI Agent answered"}</span>
                      <span style={{ ...mutedStyle, fontSize: "0.8125rem" }}>{formatWhen(message.created_at)}</span>
                      {!isUser && message.status === "refused" ? <Tag tone="neutral">Refused</Tag> : null}
                    </div>
                    {isUser ? (
                      <p style={{ ...bodyStyle, fontWeight: 600, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text}</p>
                    ) : text.trim() ? (
                      <div style={{ overflowWrap: "anywhere" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={PLAIN}>
                          {text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p style={mutedStyle}>No answer was written.</p>
                    )}
                    {looked.length > 0 ? (
                      <p style={{ ...mutedStyle, fontSize: "0.8125rem" }}>Looked at: {looked.join(", ")}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
            <Link to={`/agent?c=${encodeURIComponent(chat.id)}`} className="btn btn-primary" style={actionStyle}>
              Continue in AI Agent
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ ...actionStyle, borderColor: "var(--color-accent)", color: "var(--color-accent-700)" }}
              onClick={() => onDelete(chat)}
              data-testid="data-delete-chat"
            >
              Delete chat
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
};
