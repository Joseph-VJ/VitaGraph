import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agentApi, type ConversationSummary } from "../../api/agent";
import { ConfirmDialog } from "../data/ConfirmDialog";
import { PageState } from "../ui/PageState";

/** The person's chats, loaded once for the whole AI Agent page (the top bar needs the current title too). */
export function useConversationList(userId: string, refreshSignal: number) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!userId) return;
    const mine = ++seq.current;
    setError(null);
    try {
      const data = await agentApi.listConversations(userId);
      if (mine === seq.current) setItems(data);
    } catch {
      if (mine === seq.current) setError("Could not load your chats.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshSignal]);

  const replace = useCallback((next: ConversationSummary) => {
    setItems((current) => current.map((c) => (c.id === next.id ? { ...c, ...next } : c)));
  }, []);
  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((c) => c.id !== id));
  }, []);

  return { items, loading, error, reload, replace, remove };
}

export interface ConversationListProps {
  userId: string;
  currentId: string | null;
  items: ConversationSummary[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  /** A chat was renamed or pinned: the server's new version of it. */
  onUpdated: (item: ConversationSummary) => void;
  onRemoved: (id: string) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  /** Chats with an answer being written right now. */
  runningIds?: string[];
  /** Chats whose answer finished while the person was elsewhere. */
  readyIds?: string[];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

type Group = "Pinned" | "Today" | "Yesterday" | "Earlier";
const GROUP_ORDER: Group[] = ["Pinned", "Today", "Yesterday", "Earlier"];

function groupOf(item: ConversationSummary, now: number): Group {
  if (item.pinned) return "Pinned";
  const when = Date.parse(item.updated_at);
  if (Number.isNaN(when)) return "Earlier";
  const today = startOfDay(new Date(now));
  if (when >= today) return "Today";
  if (when >= startOfDay(new Date(today - 12 * HOUR))) return "Yesterday";
  return "Earlier";
}

function relTime(iso: string, now: number): string {
  const when = Date.parse(iso);
  if (Number.isNaN(when)) return "";
  const age = now - when;
  if (age < MINUTE) return "now";
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min`;
  if (when >= startOfDay(new Date(now))) return `${Math.floor(age / HOUR)} h`;
  try {
    return new Date(when).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function questionsLabel(turns: number): string {
  return `${turns} ${turns === 1 ? "question" : "questions"}`;
}

function turnsOf(item: ConversationSummary): number {
  return typeof item.turns === "number" ? item.turns : Math.max(1, Math.ceil(item.message_count / 2));
}

interface MenuState {
  id: string;
  top: number;
  left: number;
}

const DotsIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="3" y="10.5" width="3" height="3" />
    <rect x="10.5" y="10.5" width="3" height="3" />
    <rect x="18" y="10.5" width="3" height="3" />
  </svg>
);

export const ConversationList: React.FC<ConversationListProps> = ({
  userId,
  currentId,
  items,
  loading,
  error,
  onReload,
  onUpdated,
  onRemoved,
  onOpen,
  onNew,
  runningIds = [],
  readyIds = [],
}) => {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const menuRef = useRef<HTMLDivElement>(null);
  const now = Date.now();

  const running = useMemo(() => new Set(runningIds), [runningIds]);
  const ready = useMemo(() => new Set(readyIds), [readyIds]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const shown = items
      .filter((c) => !needle || (c.title ?? "New chat").toLowerCase().includes(needle))
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    const out = new Map<Group, ConversationSummary[]>();
    for (const item of shown) {
      const g = groupOf(item, Date.now());
      out.set(g, [...(out.get(g) ?? []), item]);
    }
    return GROUP_ORDER.flatMap((g) => (out.has(g) ? [{ name: g, rows: out.get(g)! }] : []));
  }, [items, query]);

  const closeMenu = useCallback((returnFocus: boolean) => {
    setMenu((open) => {
      if (open && returnFocus) triggers.current.get(open.id)?.focus();
      return null;
    });
  }, []);

  // Menu: first item takes focus; a click outside closes it.
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if ([...triggers.current.values()].some((t) => t.contains(target))) return;
      setMenu(null);
    };
    const onScroll = () => setMenu(null);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScroll);
    };
  }, [menu]);

  const openMenu = (item: ConversationSummary) => {
    const el = triggers.current.get(item.id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 188;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 2, window.innerHeight - 160);
    setMenu({ id: item.id, top, left });
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = entries.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      entries[(at + 1) % entries.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      entries[(at - 1 + entries.length) % entries.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      entries[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      entries[entries.length - 1]?.focus();
    } else if (event.key === "Tab") {
      closeMenu(false);
    }
  };

  const startRename = (item: ConversationSummary) => {
    setMenu(null);
    setActionError(null);
    setRenamingId(item.id);
    setRenameValue(item.title ?? "");
  };

  const saveRename = async (item: ConversationSummary) => {
    const title = renameValue.trim().slice(0, 120);
    setRenamingId(null);
    triggers.current.get(item.id)?.focus();
    if (!title || title === (item.title ?? "")) return;
    try {
      onUpdated(await agentApi.updateConversation(userId, item.id, { title }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not rename that chat.");
    }
  };

  const togglePin = async (item: ConversationSummary) => {
    closeMenu(true);
    setActionError(null);
    try {
      onUpdated(await agentApi.updateConversation(userId, item.id, { pinned: !item.pinned }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not pin that chat.");
    }
  };

  const confirmItem = items.find((c) => c.id === confirmId) ?? null;
  const doDelete = async () => {
    if (!confirmItem) return;
    setBusy(true);
    setActionError(null);
    try {
      await agentApi.deleteConversation(userId, confirmItem.id);
      const wasCurrent = currentId === confirmItem.id;
      onRemoved(confirmItem.id);
      setConfirmId(null);
      if (wasCurrent) onNew();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not delete that chat.");
    } finally {
      setBusy(false);
    }
  };

  const menuItem = menu ? items.find((c) => c.id === menu.id) ?? null : null;

  return (
    <nav aria-label="Chats" data-testid="agent-conversations" className="vg-agent-history">
      <div className="vg-agent-history-top">
        <button type="button" className="btn btn-primary vg-agent-newbtn" onClick={onNew} data-testid="agent-conversation-new">
          <span aria-hidden="true" style={{ fontSize: "1.25rem", lineHeight: 1, fontWeight: 600 }}>
            +
          </span>
          New chat
        </button>
        <input
          type="search"
          className="input vg-agent-search"
          data-testid="agent-history-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
          autoComplete="off"
        />
      </div>

      {actionError ? (
        <div role="alert" className="vg-agent-note vg-agent-note-error">
          {actionError}
        </div>
      ) : null}

      <div className="vg-agent-history-scroll">
        {loading && items.length === 0 ? (
          <PageState kind="loading" title="Loading your chats" />
        ) : error && items.length === 0 ? (
          <PageState kind="error" title="Could not load your chats" detail="Check that the backend is running." action={{ label: "Try again", onClick: onReload }} />
        ) : items.length === 0 ? (
          <p className="vg-agent-note">No chats yet. Ask a question to start one.</p>
        ) : groups.length === 0 ? (
          <p className="vg-agent-note">No chat matches &ldquo;{query.trim()}&rdquo;.</p>
        ) : (
          groups.map((group) => (
            <section key={group.name} aria-label={group.name}>
              <h3 className="vg-agent-group">{group.name}</h3>
              {group.rows.map((c) => {
                const isCurrent = currentId === c.id;
                // The run store follows every running answer (it attaches to /runs/active), so it is the truth;
                // the list's own flag can be a moment stale right after Stop.
                const isRunning = running.has(c.id);
                const isReady = !isRunning && !isCurrent && ready.has(c.id);
                const title = c.title || "New chat";
                const turns = turnsOf(c);
                if (renamingId === c.id) {
                  return (
                    <div key={c.id} className="vg-agent-row is-renaming">
                      <input
                        autoFocus
                        className="input vg-agent-rename"
                        data-testid="agent-conversation-rename"
                        aria-label="Chat name"
                        value={renameValue}
                        maxLength={120}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveRename(c);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            setRenamingId(null);
                            triggers.current.get(c.id)?.focus();
                          }
                        }}
                        onBlur={() => setRenamingId(null)}
                      />
                    </div>
                  );
                }
                return (
                  <div key={c.id} className={`vg-agent-row${isCurrent ? " is-current" : ""}${menu?.id === c.id ? " is-menu" : ""}`}>
                    <button
                      type="button"
                      className="vg-agent-row-main"
                      data-testid="agent-conversation-row"
                      aria-current={isCurrent ? "true" : undefined}
                      title={`${title} · ${questionsLabel(turns)}`}
                      onClick={() => onOpen(c.id)}
                    >
                      <span className="vg-agent-row-title">{title}</span>
                      {isRunning ? (
                        <>
                          <span className="vg-agent-running" aria-hidden="true" />
                          <span className="vg-agent-sr">Answering now</span>
                        </>
                      ) : isReady ? (
                        <>
                          <span className="vg-agent-ready" aria-hidden="true" />
                          <span className="vg-agent-sr">Answer ready</span>
                        </>
                      ) : null}
                      <span className="vg-agent-row-time">{relTime(c.updated_at, now)}</span>
                    </button>
                    <button
                      type="button"
                      className="vg-agent-row-menu"
                      data-testid="agent-conv-menu"
                      aria-label={`Options for ${title}`}
                      aria-haspopup="menu"
                      aria-expanded={menu?.id === c.id}
                      ref={(el) => {
                        if (el) triggers.current.set(c.id, el);
                        else triggers.current.delete(c.id);
                      }}
                      onClick={() => (menu?.id === c.id ? closeMenu(false) : openMenu(c))}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown" && menu?.id !== c.id) {
                          e.preventDefault();
                          openMenu(c);
                        }
                      }}
                    >
                      <DotsIcon />
                    </button>
                  </div>
                );
              })}
            </section>
          ))
        )}
      </div>

      {menu && menuItem ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Options for ${menuItem.title || "New chat"}`}
          className="vg-agent-menu"
          style={{ top: menu.top, left: menu.left }}
          onKeyDown={onMenuKeyDown}
        >
          <div className="vg-agent-menu-info">{questionsLabel(turnsOf(menuItem))}</div>
          <button type="button" role="menuitem" tabIndex={-1} className="vg-agent-menu-item" onClick={() => startRename(menuItem)}>
            Rename
          </button>
          <button type="button" role="menuitem" tabIndex={-1} className="vg-agent-menu-item" onClick={() => void togglePin(menuItem)}>
            {menuItem.pinned ? "Unpin" : "Pin to top"}
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="vg-agent-menu-item is-danger"
            data-testid="agent-conversation-delete"
            onClick={() => {
              setConfirmId(menuItem.id);
              setMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}

      {confirmItem ? (
        <ConfirmDialog
          testId="agent-conversation-confirm"
          title={`Delete "${confirmItem.title || "New chat"}"?`}
          body={`This removes the chat and its ${questionsLabel(turnsOf(confirmItem))}. This cannot be undone.`}
          confirmLabel="Delete chat"
          busy={busy}
          error={actionError}
          onConfirm={() => void doDelete()}
          onCancel={() => {
            setConfirmId(null);
            setActionError(null);
          }}
        />
      ) : null}
    </nav>
  );
};
