// Persona API calls.

import { api } from "./client";
import type { User } from "../types";

export const usersApi = {
  create: (displayLabel: string) =>
    api.post<User>("/api/users", { display_label: displayLabel }),
  list: () => api.get<User[]>("/api/users"),
  consent: (userId: string) => api.post<User>(`/api/users/${userId}/consent`, {}),
  remove: (userId: string) => api.del<{ deleted: string }>(`/api/users/${userId}`),
};
