// Persona selection / creation screen (plan Workflow A).
// Only synthetic demo personas may be created here.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usersApi } from "../api/users";
import { useActiveUser } from "../context/UserContext";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import type { User } from "../types";

export function PersonaPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setUser } = useActiveUser();
  const navigate = useNavigate();

  const refresh = () => usersApi.list().then(setUsers).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const user = await usersApi.create(label.trim());
      setUser(user);
      navigate("/reports");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const select = (user: User) => {
    setUser(user);
    navigate("/reports");
  };

  const remove = async (userId: string) => {
    setError(null);
    try {
      await usersApi.remove(userId);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="max-w-xl space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Create a synthetic persona</h2>
        <p className="text-sm text-slate-400">
          Use invented demo personas only — never a real person&apos;s name or identifiers.
        </p>
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Demo Persona A"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            onClick={create}
            disabled={busy || !label.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </section>

      {error && <ErrorState message={error} />}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Existing personas</h2>
        {users.length === 0 ? (
          <EmptyState title="No personas yet" hint="Create one above to begin." />
        ) : (
          <ul className="grid gap-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200">{user.display_label}</p>
                  <p className="text-xs text-slate-500">created {user.created_at}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => select(user)}
                    className="rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-sm text-indigo-300 hover:bg-indigo-500/25"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => remove(user.id)}
                    className="text-sm text-slate-500 underline-offset-2 hover:text-rose-400 hover:underline"
                  >
                    delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
