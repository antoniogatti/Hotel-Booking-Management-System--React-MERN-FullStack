import { Request, Response, NextFunction } from "express";

const CSRF_COOKIE_NAME = "XSRF-TOKEN";
const SESSION_COOKIE_NAME = "session_id";

// Simple double-submit cookie CSRF protection for cookie-authenticated browser clients.
// - If a request contains an Authorization header, it is treated as an API client and CSRF is skipped.
// - For cookie-based sessions, non-safe HTTP methods must include header `X-XSRF-TOKEN` matching the cookie.
export default function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const authHeader = req.get("authorization") || req.get("Authorization");
  if (authHeader) {
    // API clients use Authorization header and are not subject to cookie CSRF checks
    return next();
  }

  const sessionCookie = req.cookies && req.cookies[SESSION_COOKIE_NAME];
  if (!sessionCookie) {
    // No cookie-based session present; skip CSRF validation
    return next();
  }

  const headerToken = req.get("X-XSRF-TOKEN") || req.get("x-xsrf-token") || "";
  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE_NAME];

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({ message: "CSRF token missing or invalid" });
  }

  return next();
}
