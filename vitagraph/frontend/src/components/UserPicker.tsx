// Persona selector shown in the header when a persona is active.

import { Link } from "react-router-dom";
import { useActiveUser } from "../context/UserContext";

export function UserPicker() {
  const { user, setUser } = useActiveUser();

  if (!user) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1 text-indigo-300">
        {user.display_label}
      </span>
      <Link to="/" className="text-slate-400 underline-offset-2 hover:underline" onClick={() => setUser(null)}>
        switch
      </Link>
    </div>
  );
}
