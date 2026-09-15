import { useEffect, useState } from "react";
import { usersApi } from "../api/users";
import type { User } from "../types";

export function PersonaModal({
  isOpen,
  onClose,
  activeUserId,
  onSelectUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeUserId: string;
  onSelectUser: (user: { id: string; name: string }) => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      usersApi
        .list()
        .then((list) => {
          if (isMounted) setUsers(list);
        })
        .catch(() => {
          if (isMounted) {
            setUsers([
              {
                id: "VG-2026-001",
                display_label: "Arjun R",
                created_at: "2026-01-10",
                status: "active",
                consent_accepted: true,
              },
              {
                id: "VG-2026-002",
                display_label: "Priya S (Demo B)",
                created_at: "2026-02-01",
                status: "active",
                consent_accepted: true,
              },
            ]);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const created = await usersApi.create(newLabel.trim());
      const updatedList = await usersApi.list().catch(() => []);
      setUsers(updatedList);
      onSelectUser({ id: created.id, name: created.display_label });
      setNewLabel("");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border-2 border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 jakarta">
              Select or Create Persona
            </h3>
            <p className="text-xs text-slate-500">
              Isolated user scope in SQLite and Chroma vector database
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Existing Personas List */}
        <div className="mt-4 space-y-2 max-h-56 overflow-y-auto">
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
            Available Personas
          </div>
          {users.map((u) => {
            const isSelected = u.id === activeUserId;
            return (
              <div
                key={u.id}
                onClick={() => {
                  onSelectUser({ id: u.id, name: u.display_label });
                  onClose();
                }}
                className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition ${
                  isSelected
                    ? "border-blue-500 bg-blue-50/50 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-slate-800">
                    {u.display_label}
                  </div>
                  <div className="text-xs text-slate-500">ID: {u.id}</div>
                </div>
                {isSelected ? (
                  <span className="px-2 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-lg">
                    Active
                  </span>
                ) : (
                  <span className="text-xs text-blue-600 font-medium hover:underline">
                    Switch →
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Create Persona Form */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-2">
            Create Synthetic Persona
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Meera K (Demo)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1 px-3 py-2 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCreate}
              disabled={loading || !newLabel.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
