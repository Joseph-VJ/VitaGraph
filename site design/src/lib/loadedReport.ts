// The report the person just uploaded. The AI Agent page opens scoped to it until they
// choose "Use all my reports". Kept per persona in sessionStorage, so a new browser
// session starts unscoped.

const KEY = "vitagraph_loaded_report";

interface Loaded {
  userId: string;
  reportId: string;
}

export function rememberLoadedReport(userId: string, reportId: string): void {
  try {
    const value: Loaded = { userId, reportId };
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage can be blocked; the "Ask about this report" button still works */
  }
}

export function getLoadedReportId(userId: string): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Loaded>;
    return parsed.userId === userId && typeof parsed.reportId === "string" ? parsed.reportId : null;
  } catch {
    return null;
  }
}

export function clearLoadedReport(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
