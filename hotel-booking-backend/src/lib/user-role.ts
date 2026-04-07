export type AppRole = "user" | "hotel_owner" | "admin";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const defaultAppRole: AppRole = "user";

export const isAppRole = (value: unknown): value is AppRole =>
  value === "user" || value === "hotel_owner" || value === "admin";

export const resolvePersistedRole = (value: unknown): AppRole =>
  isAppRole(value) ? value : defaultAppRole;

export const isOwnerOrAdmin = (role?: string) =>
  role === "hotel_owner" || role === "admin";
