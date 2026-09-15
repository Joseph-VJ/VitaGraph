// Active-persona context: every screen works within one selected user,
// mirroring the backend's strict user scoping.

import { createContext, useContext, useState, type ReactNode } from "react";
import type { User } from "../types";

interface UserContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  setUser: () => undefined,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  return <UserContext.Provider value={{ user, setUser }}>{children}</UserContext.Provider>;
}

export function useActiveUser() {
  return useContext(UserContext);
}
