type StorageKind = "local" | "session";
const store = (kind: StorageKind): Storage => kind === "local" ? window.localStorage : window.sessionStorage;

export function readStorage(key: string, kind: StorageKind = "local"): string | null {
  try { return store(kind).getItem(key); } catch { return null; }
}
export function writeStorage(key: string, value: string, kind: StorageKind = "local"): void {
  try { store(kind).setItem(key, value); } catch { /* In-memory state remains usable for this visit. */ }
}
export function removeStorage(key: string, kind: StorageKind = "local"): void {
  try { store(kind).removeItem(key); } catch { /* No persisted value is accessible. */ }
}
