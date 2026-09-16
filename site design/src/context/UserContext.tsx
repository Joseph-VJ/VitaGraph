// Active-persona context for site design: provides current user and user list
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "../types";
import { usersApi } from "../api/users";

interface UserContextValue {
  user: User | null;
  users: User[];
  setUser: (user: User | null) => void;
  refreshUsers: () => Promise<void>;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  users: [],
  setUser: () => undefined,
  refreshUsers: async () => {},
  loading: true,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUsers = async () => {
    try {
      const list = await usersApi.list();
      setUsers(list);
      if (list.length > 0) {
        const savedId = localStorage.getItem("vitagraph_user_id");
        const matched = list.find((u) => u.id === savedId) || list[0];
        setUserState(matched);
      } else {
        const initial = await usersApi.create("Sample Persona");
        try {
          await usersApi.consent(initial.id);
        } catch {
          // ignore consent error if already set
        }
        setUsers([initial]);
        setUserState(initial);
        localStorage.setItem("vitagraph_user_id", initial.id);
      }
    } catch {
      // Backend may be offline
    } finally {
      setLoading(false);
    }
  };

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem("vitagraph_user_id", newUser.id);
    } else {
      localStorage.removeItem("vitagraph_user_id");
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  return (
    <UserContext.Provider value={{ user, users, setUser, refreshUsers, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useActiveUser() {
  return useContext(UserContext);
}

export const useUser = useActiveUser;
