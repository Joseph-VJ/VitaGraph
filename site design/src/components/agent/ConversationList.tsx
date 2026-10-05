import React, { useEffect, useState, useCallback } from "react";
import { agentApi, type ConversationSummary } from "../../api/agent";
import { PageState } from "../ui/PageState";

export interface ConversationListProps {
  userId: string;
  currentId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  refreshSignal?: number;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export const ConversationList: React.FC<ConversationListProps> = ({
  userId,
  currentId,
  onOpen,
  onNew,
  refreshSignal = 0,
}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await agentApi.listConversations(userId);
      setConversations(data);
    } catch {
      setError("Could not load conversations.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshSignal]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await agentApi.deleteConversation(userId, id);
      setDeleteConfirmId(null);
      await fetchConversations();
      if (currentId === id) {
        onNew();
      }
    } catch {
      // deletion error
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <nav
      aria-label="Conversations"
      data-testid="agent-conversations"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "var(--space-4)",
        borderRight: "2px solid var(--color-divider)",
        background: "var(--color-surface)",
        boxSizing: "border-box",
      }}
    >
      <button
        type="button"
        className="btn btn-primary"
        onClick={onNew}
        style={{
          width: "100%",
          justifyContent: "center",
          marginBottom: "var(--space-4)",
        }}
      >
        New conversation
      </button>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <PageState
            kind="loading"
            title="Loading conversations"
            detail="Fetching past chats..."
          />
        ) : error ? (
          <PageState
            kind="error"
            title="Could not load conversations"
            detail="Try again"
            action={{
              label: "Try again",
              onClick: fetchConversations,
            }}
          />
        ) : conversations.length === 0 ? (
          <div
            style={{
              padding: "var(--space-4)",
              fontSize: "0.875rem",
              color: "var(--color-neutral-700)",
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            No conversations yet. Ask a question to start one.
          </div>
        ) : (
          conversations.map((c) => {
            const isCurrent = currentId === c.id;
            const isConfirming = deleteConfirmId === c.id;

            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderLeft: isCurrent ? "4px solid var(--color-accent)" : "4px solid transparent",
                  background: isCurrent ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent",
                  padding: "var(--space-2) var(--space-3)",
                  marginBottom: "var(--space-2)",
                  borderRadius: 0,
                  transition: "background 0.15s ease",
                }}
              >
                <button
                  type="button"
                  data-testid="agent-conversation-row"
                  onClick={() => onOpen(c.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: 0,
                    width: "100%",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: isCurrent ? 800 : 600,
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.title || "Conversation"}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.75rem",
                      color: "var(--color-neutral-700)",
                      marginTop: "var(--space-1)",
                    }}
                  >
                    <span>{formatDate(c.updated_at)}</span>
                    <span>
                      {c.message_count} {c.message_count === 1 ? "turn" : "turns"}
                    </span>
                  </div>
                </button>

                <div
                  style={{
                    marginTop: "var(--space-1)",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  {isConfirming ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        fontSize: "0.75rem",
                      }}
                    >
                      <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>
                        Delete this conversation?
                      </span>
                      <button
                        type="button"
                        data-testid="agent-conversation-confirm-delete"
                        className="btn btn-ghost"
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 6px",
                          color: "var(--color-accent-700)",
                        }}
                        disabled={isDeleting}
                        onClick={() => handleDelete(c.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="agent-conversation-delete"
                      className="btn btn-ghost"
                      style={{
                        fontSize: "0.6875rem",
                        padding: "2px 4px",
                        opacity: 0.6,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(c.id);
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </nav>
  );
};
