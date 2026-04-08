import express, { CookieOptions, Request, Response } from "express";
import { check, validationResult } from "express-validator";
import User from "../models/user";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import verifyToken from "../middleware/auth";
import {
  normalizeEmail,
  resolvePersistedRole,
  defaultAppRole,
  AppRole,
} from "../lib/user-role";
import { recordAuditEvent } from "../lib/audit-log";
import { logError } from "../lib/logger";

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_SECRET;
const MICROSOFT_CLIENT_ID = process.env.MS_ENTRA_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MS_ENTRA_CLIENT_SECRET;
const MICROSOFT_TENANT_ID = process.env.MS_ENTRA_TENANT_ID || "common";
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5174").replace(
  /\/$/,
  ""
);
const BACKEND_URL = (
  process.env.BACKEND_URL ||
  `http://localhost:${process.env.PORT || 5000}`
).replace(/\/$/, "");

const microsoftBaseUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0`;
const isProduction = process.env.NODE_ENV === "production";
const useInMemoryMongo =
  !isProduction && process.env.USE_IN_MEMORY_MONGO === "true";
const sessionCookieName = "session_id";
const oauthStateCookieName = "oauth_state";
const localDevDefaultRole: AppRole = useInMemoryMongo ? "admin" : defaultAppRole;

const getSessionCookieOptions = (
  overrides: Partial<CookieOptions> = {}
): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
  ...overrides,
});

const getOAuthStateCookieOptions = (
  overrides: Partial<CookieOptions> = {}
): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
  maxAge: 10 * 60 * 1000,
  ...overrides,
});

const redirectToAuthCallback = (
  res: Response,
  params: Record<string, string | undefined>
) => {
  const redirectUrl = new URL(`${FRONTEND_URL}/auth/callback`);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      redirectUrl.searchParams.set(key, value);
    }
  });

  return res.redirect(redirectUrl.toString());
};

const issueToken = (userId: string, role: AppRole) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET_KEY as string, {
    expiresIn: "1d",
  });
};

const ensurePersistedRole = async (user: any, email: string) => {
  const computedRole = user.role
    ? resolvePersistedRole(user.role)
    : localDevDefaultRole;
  const previousRole = user.role;

  if (!user.role || user.role !== computedRole) {
    user.role = computedRole;
    await user.save();

    await recordAuditEvent({
      action: "user.role.defaulted",
      entityType: "user",
      entityId: String(user._id),
      targetUserId: String(user._id),
      actorId: String(user._id),
      actorRole: computedRole,
      actorEmail: email,
      metadata: {
        previousRole: previousRole || null,
        nextRole: computedRole,
        reason: "persisted-role-missing-or-invalid",
      },
    });
  }

  return computedRole;
};

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth
 *     description: Redirects user to Google sign-in
 *     tags: [Authentication]
 */
router.get("/google", (req: Request, res: Response) => {
  return res.status(410).json({
    message: "Google OAuth is disabled. Use Microsoft sign-in.",
  });
});

router.get("/microsoft", (req: Request, res: Response) => {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    return res.status(500).json({ message: "Microsoft OAuth not configured" });
  }

  const state = crypto.randomBytes(32).toString("hex");
  const redirectUri = `${BACKEND_URL}/api/auth/callback/microsoft`;
  const scope = "openid profile email User.Read";
  const url = `${microsoftBaseUrl}/authorize?client_id=${MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(scope)}&state=${state}`;

  res.cookie(oauthStateCookieName, state, getOAuthStateCookieOptions());
  res.redirect(url);
});

/**
 * @swagger
 * /api/auth/callback/google:
 *   get:
 *     summary: Google OAuth callback
 *     description: Handles redirect from Google, creates/logs in user
 *     tags: [Authentication]
 */
router.get("/callback/google", async (req: Request, res: Response) => {
  return res.status(410).json({
    message: "Google OAuth callback disabled. Use Microsoft sign-in.",
  });

  const { code, error } = req.query;

  if (error) {
    return res.redirect(
      `${FRONTEND_URL}/sign-in?error=${encodeURIComponent(String(error))}`
    );
  }

  if (!code || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect(
      `${FRONTEND_URL}/sign-in?error=oauth_config`
    );
  }

  try {
    const redirectUri = `${BACKEND_URL}/api/auth/callback/google`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      logError("Google token exchange failed", undefined, {
        provider: "google",
        status: tokenRes.status,
        code: tokenData.error,
      });
      return res.redirect(
        `${FRONTEND_URL}/sign-in?error=token_exchange`
      );
    }

    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const googleUser = await userRes.json();

    const email = normalizeEmail(googleUser.email || "");
    if (!email) {
      return res.redirect(`${FRONTEND_URL}/sign-in?error=oauth_email_missing`);
    }

    const name = googleUser.name || "";
    const [firstName, ...lastParts] = name.split(" ");
    const lastName = lastParts.join(" ") || firstName;
    const image = googleUser.picture || undefined;

    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      user = new User({
        email,
        firstName: firstName || "User",
        lastName: lastName || "Google",
        password: randomPassword,
        image,
        emailVerified: true,
        role: "user",
      });
      await user.save();
    } else {
      const role = await ensurePersistedRole(user, email);
      await User.findByIdAndUpdate(user._id, {
        image,
        emailVerified: true,
        role,
      });
    }

    const computedRole = await ensurePersistedRole(user, email);

    const token = issueToken(user.id, computedRole);

    const redirectUrl = new URL(`${FRONTEND_URL}/auth/callback`);
    redirectUrl.searchParams.set("token", token);
    redirectUrl.searchParams.set("provider", "google");
    redirectUrl.searchParams.set("userId", String(user._id));
    redirectUrl.searchParams.set("email", user.email);
    redirectUrl.searchParams.set("firstName", user.firstName);
    redirectUrl.searchParams.set("lastName", user.lastName);
    redirectUrl.searchParams.set("role", computedRole);
    if (image) redirectUrl.searchParams.set("image", image);

    res.redirect(redirectUrl.toString());
  } catch (err) {
    logError("Google OAuth callback failed", err, { provider: "google" });
    res.redirect(
      `${FRONTEND_URL}/sign-in?error=server_error`
    );
  }
});

router.get("/callback/microsoft", async (req: Request, res: Response) => {
  const { code, error, state } = req.query;

  if (error) {
    return redirectToAuthCallback(res, {
      error: encodeURIComponent(String(error)),
    });
  }

  if (!code || !MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    return redirectToAuthCallback(res, { error: "oauth_config" });
  }

  const expectedState = req.cookies[oauthStateCookieName];
  if (!state || !expectedState || String(state) !== expectedState) {
    res.clearCookie(oauthStateCookieName, getOAuthStateCookieOptions({ maxAge: 0 }));
    return redirectToAuthCallback(res, { error: "oauth_state" });
  }

  try {
    const redirectUri = `${BACKEND_URL}/api/auth/callback/microsoft`;
    const tokenRes = await fetch(`${microsoftBaseUrl}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MICROSOFT_CLIENT_ID,
        client_secret: MICROSOFT_CLIENT_SECRET,
        code: String(code),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error || !tokenData.access_token) {
      logError("Microsoft token exchange failed", undefined, {
        provider: "microsoft",
        status: tokenRes.status,
        code: tokenData.error || "missing_access_token",
      });
      return redirectToAuthCallback(res, { error: "token_exchange" });
    }

    const profileRes = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=givenName,surname,displayName,mail,userPrincipalName",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );
    const profile = await profileRes.json();

    if (profile.error) {
      logError("Microsoft profile fetch failed", undefined, {
        provider: "microsoft",
        status: profileRes.status,
        code: profile.error?.code || "profile_fetch_failed",
      });
      return redirectToAuthCallback(res, { error: "profile_fetch" });
    }

    const email = normalizeEmail(profile.mail || profile.userPrincipalName || "");
    if (!email) {
      return redirectToAuthCallback(res, { error: "oauth_email_missing" });
    }

    const firstName = profile.givenName || "User";
    const lastName = profile.surname || profile.displayName || "Microsoft";

    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      user = new User({
        email,
        firstName,
        lastName,
        password: randomPassword,
        emailVerified: true,
        role: localDevDefaultRole,
      });
      await user.save();
    }

    const computedRole = await ensurePersistedRole(user, email);

    const token = issueToken(user.id, computedRole);

    res.clearCookie(oauthStateCookieName, getOAuthStateCookieOptions({ maxAge: 0 }));
    res.cookie(sessionCookieName, token, getSessionCookieOptions());

    return redirectToAuthCallback(res, {
      provider: "microsoft",
      success: "1",
      token,
    });
  } catch (err) {
    logError("Microsoft OAuth callback failed", err, { provider: "microsoft" });
    res.clearCookie(oauthStateCookieName, getOAuthStateCookieOptions({ maxAge: 0 }));
    return redirectToAuthCallback(res, { error: "server_error" });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                   description: User ID
 *       400:
 *         description: Invalid credentials or validation error
 *       500:
 *         description: Server error
 */
router.post(
  "/login",
  [
    check("email", "Email is required").isEmail(),
    check("password", "Password with 6 or more characters required").isLength({
      min: 6,
    }),
  ],
  async (req: Request, res: Response) => {
    return res.status(410).json({
      message: "Email/password login disabled. Use Microsoft sign-in.",
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array() });
    }

    const email = normalizeEmail(req.body.email || "");
    const { password } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid Credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid Credentials" });
      }

      const computedRole = await ensurePersistedRole(user, email);
      const token = issueToken(user.id, computedRole);

      // Return JWT token in response body for localStorage storage
      res.status(200).json({
        userId: user._id,
        message: "Login successful",
        token: token, // JWT token in response body
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: computedRole,
        },
      });
    } catch (error) {
      logError("Email/password login handler failed", error, { route: "auth.login" });
      res.status(500).json({ message: "Something went wrong" });
    }
  }
);

/**
 * @swagger
 * /api/auth/validate-token:
 *   get:
 *     summary: Validate authentication token
 *     description: Validate the current user's authentication token
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                   description: User ID
 *       401:
 *         description: Token is invalid or expired
 */
router.get("/validate-token", verifyToken, async (req: Request, res: Response) => {
  const user = await User.findById(req.userId).select(
    "role email firstName lastName image"
  );
  if (!user) {
    return res.status(401).json({ message: "unauthorized" });
  }

  const role = user.role
    ? resolvePersistedRole(user.role)
    : localDevDefaultRole;
  if (!user.role || user.role !== role) {
    user.role = role;
    await user.save();

    await recordAuditEvent({
      action: "user.role.defaulted",
      entityType: "user",
      entityId: String(user._id),
      targetUserId: String(user._id),
      actorId: String(user._id),
      actorRole: role,
      actorEmail: user.email,
      metadata: {
        previousRole: null,
        nextRole: role,
        reason: "validate-token-missing-role",
      },
    });
  }

  res.status(200).send({
    userId: req.userId,
    role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
  });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Logout user by clearing authentication cookie
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie(sessionCookieName, getSessionCookieOptions({ maxAge: 0 }));
  res.send();
});

export default router;
