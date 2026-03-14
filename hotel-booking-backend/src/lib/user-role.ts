export type AppRole = "user" | "hotel_owner" | "admin";

export const OWNER_DOMAIN = "palazzopintobnb.com";
export const ADMIN_EMAIL = "info@palazzopintobnb.com";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const resolveRoleForEmail = (email: string): AppRole => {
  const normalized = normalizeEmail(email);

  if (normalized === ADMIN_EMAIL) {
    return "admin";
  }

  if (normalized.endsWith(`@${OWNER_DOMAIN}`)) {
    return "hotel_owner";
  }

  return "user";
};

export const isOwnerOrAdmin = (role?: string) =>
  role === "hotel_owner" || role === "admin";
