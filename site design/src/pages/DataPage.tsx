import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { agentApi } from "../api/agent";
import { overviewApi, type Overview, type OverviewChat, type OverviewReport } from "../api/overview";
import { reportsApi } from "../api/reports";
import { ActivityList } from "../components/data/ActivityList";
import { AiReportList } from "../components/data/AiReportList";
import { chatTitle, ChatRow } from "../components/data/ChatRow";
import { ConfirmDialog } from "../components/data/ConfirmDialog";
import { DataTabs, tabButtonId, tabPanelId, type DataTab, type DataTabId } from "../components/data/DataTabs";
import { ReportRow } from "../components/data/ReportRow";
import { Square, bodyStyle, errorText, isBeingRead, kickerStyle, mutedStyle, plural, reportDateText } from "../components/data/helpers";
import { PageFrame, PageState, PersonaState } from "../components/ui";
import { useActiveUser } from "../context/UserContext";
import { formatNumber } from "../lib/privacyFormat";

const POLL_MS = 4000;

type Pending =
  | { kind: "report"; id: string; name: string }
  | { kind: "chat"; id: string; name: string };

export const DataPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: personaLoading, refreshUsers } = useActiveUser();
  const userId = user?.id ?? "";

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<DataTabId>("reports");
  const [query, setQuery] = useState("");
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [openChat, setOpenChat] = useState<string | null>(null);

  const [pending, setPending] = useState<Pending | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // One call lists everything. A quiet refresh (after a delete, or while a report is being read) keeps the page on screen.
  const load = useCallback(
    async (quiet: boolean) => {
      if (!userId) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      if (!quiet) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await overviewApi.get(userId, controller.signal);
        if (controller.signal.aborted) return;
        setOverview(data);
        setError(null);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (!quiet) setError(errorText(e, "Your data could not be loaded."));
        else {
          const warning = "The list could not be refreshed. Reload the page to see the latest.";
          setNotice((cur) => (cur?.includes(warning) ? cur : cur ? `${cur} ${warning}` : warning));
        }
      } finally {
        if (!controller.signal.aborted && !quiet) setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    setOverview(null);
    setOpenReport(null);
    setOpenChat(null);
    setNotice(null);
    setQuery("");
    void load(false);
    return () => controllerRef.current?.abort();
  }, [load]);

  // While a report is still being read, look again every few seconds so its row catches up by itself.
  const anyReading = overview?.reports.some((r) => isBeingRead(r.status)) ?? false;
  useEffect(() => {
    if (!anyReading) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [anyReading, load]);

  // After a delete the row is gone: put the focus back on the list instead of losing it.
  useEffect(() => {
    if (focusTick > 0) panelRef.current?.focus();
  }, [focusTick]);

  const q = query.trim().toLowerCase();
  const matches = useCallback(
    (...parts: (string | null | undefined)[]) => q === "" || parts.some((p) => (p ?? "").toLowerCase().includes(q)),
    [q]
  );

  const reports = useMemo(
    () => (overview?.reports ?? []).filter((r) => matches(r.original_filename, reportDateText(r), r.report_date)),
    [overview, matches]
  );
  const chats = useMemo(
    () => (overview?.chats ?? []).filter((c) => matches(chatTitle(c), c.first_question, ...c.reports_used.map((u) => u.filename))),
    [overview, matches]
  );
  const savedReports = useMemo(() => (overview?.saved_reports ?? []).filter((s) => matches(s.title)), [overview, matches]);
  const activity = useMemo(() => (overview?.activity ?? []).filter((a) => matches(a.text)), [overview, matches]);

  const askDeleteReport = (report: OverviewReport) => {
    setDeleteError(null);
    setPending({ kind: "report", id: report.id, name: report.original_filename });
  };
  const askDeleteChat = (chat: OverviewChat) => {
    setDeleteError(null);
    setPending({ kind: "chat", id: chat.id, name: chatTitle(chat) });
  };

  const confirmDelete = async () => {
    if (!pending || !userId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pending.kind === "report") {
        const result = await reportsApi.remove(userId, pending.id);
        const removed = typeof result.chunks_removed === "number" ? ` ${plural(result.chunks_removed, "passage was", "passages were")} removed.` : "";
        setNotice(`Deleted ${result.filename || pending.name}.${removed}`);
        setOpenReport(null);
      } else {
        await agentApi.deleteConversation(userId, pending.id);
        setNotice(`Deleted the chat "${pending.name}".`);
        setOpenChat(null);
      }
      setPending(null);
      await load(true);
      setFocusTick((n) => n + 1);
    } catch (e) {
      setDeleteError(errorText(e, "That could not be deleted."));
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <PageFrame label="My Data" testId="data-page">
        <PersonaState loading={personaLoading} onRetry={() => void refreshUsers()} />
      </PageFrame>
    );
  }

  if (error && !overview) {
    return (
      <PageFrame label="My Data" testId="data-page">
        <PageState
          kind="error"
          title="Your data is not available"
          detail={error}
          action={{ label: "Try again", onClick: () => void load(false) }}
        />
      </PageFrame>
    );
  }

  if (loading || !overview) {
    return (
      <PageFrame label="My Data" testId="data-page">
        <PageState kind="loading" title="Loading your data" />
      </PageFrame>
    );
  }

  const totals = overview.totals;
  const tabs: DataTab[] = [
    { id: "reports", label: "Reports", count: overview.reports.length, note: "Files you added" },
    { id: "chats", label: "Chats", count: overview.chats.length, note: "Questions you asked" },
    { id: "ai-reports", label: "AI reports", count: overview.saved_reports.length, note: "Written by the AI Agent" },
    { id: "activity", label: "Activity", count: overview.activity.length, note: "What happened, newest first" },
  ];

  const hasQuery = q !== "";
  const nothingMatches = (what: string) => (
    <p style={{ ...mutedStyle, padding: "var(--space-4)" }} data-testid="data-no-match">
      Nothing in {what} matches "{query.trim()}".
    </p>
  );

  let panel: React.ReactNode;
  if (tab === "reports") {
    panel =
      overview.reports.length === 0 ? (
        <PageState
          kind="empty"
          title="No reports yet"
          detail="Add a health report and it will show up here with its pages, the values found in it and the chats that used it."
          action={{ label: "Add your first report", onClick: () => navigate("/upload") }}
          testId="data-empty-reports"
        />
      ) : reports.length === 0 ? (
        nothingMatches("your reports")
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "2px solid var(--color-divider)" }} data-testid="data-report-list">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              userId={userId}
              report={report}
              chats={overview.chats}
              open={openReport === report.id}
              onToggle={() => setOpenReport((cur) => (cur === report.id ? null : report.id))}
              onDelete={askDeleteReport}
            />
          ))}
        </ul>
      );
  } else if (tab === "chats") {
    panel =
      overview.chats.length === 0 ? (
        <PageState
          kind="empty"
          title="No chats yet"
          detail="Ask the AI Agent a question about your reports. The chat is saved here."
          action={{ label: "Open the AI Agent", onClick: () => navigate("/agent") }}
          testId="data-empty-chats"
        />
      ) : chats.length === 0 ? (
        nothingMatches("your chats")
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "2px solid var(--color-divider)" }} data-testid="data-chat-list">
          {chats.map((chat) => (
            <ChatRow
              key={chat.id}
              userId={userId}
              chat={chat}
              open={openChat === chat.id}
              onToggle={() => setOpenChat((cur) => (cur === chat.id ? null : chat.id))}
              onDelete={askDeleteChat}
            />
          ))}
        </ul>
      );
  } else if (tab === "ai-reports") {
    panel =
      overview.saved_reports.length === 0 ? (
        <PageState
          kind="empty"
          title="No saved AI reports yet"
          detail="In the AI Agent, ask it to write a report. Saved reports appear here with a PDF download."
          action={{ label: "Open the AI Agent", onClick: () => navigate("/agent") }}
          testId="data-empty-ai-reports"
        />
      ) : savedReports.length === 0 ? (
        nothingMatches("your AI reports")
      ) : (
        <div style={{ borderTop: "2px solid var(--color-divider)" }}>
          <AiReportList userId={userId} items={savedReports} chats={overview.chats} />
        </div>
      );
  } else {
    panel =
      overview.activity.length === 0 ? (
        <PageState
          kind="empty"
          title="Nothing has happened yet"
          detail="Adding a report or asking a question shows up here."
          testId="data-empty-activity"
        />
      ) : activity.length === 0 ? (
        nothingMatches("the activity")
      ) : (
        <div style={{ borderTop: "2px solid var(--color-divider)" }}>
          <ActivityList items={activity} reports={overview.reports} chats={overview.chats} />
        </div>
      );
  }

  const sentTile = (
    <Link
      to="/privacy"
      data-testid="data-tab-sent"
      style={{
        minHeight: 96,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        padding: "var(--space-3) var(--space-4)",
        borderTop: "2px solid var(--color-text)",
        color: "var(--color-text)",
        textDecoration: "none",
      }}
    >
      <span style={kickerStyle}>Sent to the AI</span>
      <span style={{ fontSize: "1.75rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
        {formatNumber(totals.ai_messages_sent)}
      </span>
      <span style={{ ...mutedStyle, fontSize: "0.8125rem" }}>
        {overview.allow_api ? "" : "Sending is turned off. "}
        {formatNumber(totals.details_hidden)} private {totals.details_hidden === 1 ? "detail" : "details"} hidden first
      </span>
      <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: "var(--color-accent-700)" }}>See what was sent</span>
    </Link>
  );

  const searchLabel = tab === "chats" ? "Find a chat" : tab === "reports" ? "Find a file" : "Find a file or chat";

  return (
    <PageFrame label="My Data" testId="data-page">
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.01em", overflowWrap: "anywhere" }}>
          Everything in {overview.persona.display_label}
        </h2>
        <p style={{ ...mutedStyle, maxWidth: "70ch" }}>
          Files you added, questions you asked and what was sent to the AI. {plural(totals.pages, "page", "pages")} and{" "}
          {plural(totals.chunks, "passage", "passages")} are stored on this computer.
        </p>
      </header>

      <DataTabs
        tabs={tabs}
        active={tab}
        onChange={(id) => {
          setTab(id);
          setOpenReport(null);
          setOpenChat(null);
        }}
        extra={sentTile}
      />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
        <input
          className="input"
          type="search"
          data-testid="data-search"
          aria-label={searchLabel}
          placeholder="Find a file or chat"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ flex: "1 1 260px", maxWidth: 420, minHeight: 44, fontSize: "0.9375rem" }}
        />
        {hasQuery ? (
          <button type="button" className="btn btn-ghost" onClick={() => setQuery("")} style={{ minHeight: 44 }}>
            Clear search
          </button>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="data-notice"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--color-surface)", borderLeft: "5px solid var(--color-accent)" }}
        >
          <Square red />
          <span style={{ ...bodyStyle, fontWeight: 600, flex: "1 1 240px", overflowWrap: "anywhere" }}>{notice}</span>
          <button type="button" className="btn btn-ghost" onClick={() => setNotice(null)} style={{ minHeight: 44 }}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div
        ref={panelRef}
        role="tabpanel"
        id={tabPanelId(tab)}
        aria-labelledby={tabButtonId(tab)}
        tabIndex={-1}
        style={{ outline: "none", minWidth: 0 }}
      >
        {panel}
      </div>

      {pending ? (
        <ConfirmDialog
          title={pending.kind === "report" ? `Delete ${pending.name}?` : `Delete the chat "${pending.name}"?`}
          body={
            pending.kind === "report"
              ? "This removes the file, its text, its passages and its search entries. Chats keep their words. This cannot be undone."
              : "Its questions and answers are removed. Your reports are not touched. This cannot be undone."
          }
          confirmLabel={pending.kind === "report" ? "Delete report" : "Delete chat"}
          busy={deleting}
          error={deleteError}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            setPending(null);
            setDeleteError(null);
          }}
        />
      ) : null}
    </PageFrame>
  );
};
