import crypto from "crypto";

const MICROSOFT_CLIENT_ID = process.env.MS_ENTRA_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MS_ENTRA_CLIENT_SECRET;
const MICROSOFT_TENANT_ID = process.env.MS_ENTRA_TENANT_ID || "common";
const microsoftBaseUrl = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0`;
const graphTokenScope = "openid profile email offline_access User.Read Files.Read";

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  scope?: string;
  token_type?: string;
};

const getEncryptionKey = () => {
  const secret = process.env.MS_GRAPH_TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing MS_GRAPH_TOKEN_ENCRYPTION_KEY or JWT_SECRET_KEY for Graph token encryption");
  }

  return crypto.createHash("sha256").update(secret).digest();
};

const encryptSecret = (value: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
};

const decryptSecret = (payload: string) => {
  const [ivHex, authTagHex, encryptedHex] = String(payload || "").split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted secret payload");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

const toExpiryDate = (expiresIn?: number | string) => {
  const seconds = Number(expiresIn || 0);
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 3600;
  return new Date(Date.now() + safeSeconds * 1000);
};

export const persistMicrosoftGraphAuth = (user: any, tokenPayload: TokenPayload) => {
  if (!tokenPayload.access_token) {
    throw new Error("Missing Microsoft access token");
  }

  const existing = user.microsoftGraphAuth || {};
  user.microsoftGraphAuth = {
    provider: "microsoft",
    scope: tokenPayload.scope || existing.scope || graphTokenScope,
    tokenType: tokenPayload.token_type || existing.tokenType || "Bearer",
    accessTokenCiphertext: encryptSecret(tokenPayload.access_token),
    refreshTokenCiphertext: tokenPayload.refresh_token
      ? encryptSecret(tokenPayload.refresh_token)
      : existing.refreshTokenCiphertext,
    expiresAt: toExpiryDate(tokenPayload.expires_in),
    connectedAt: existing.connectedAt || new Date(),
    lastRefreshedAt: new Date(),
  };
};

const refreshMicrosoftAccessToken = async (refreshToken: string) => {
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
    throw new Error("Microsoft OAuth not configured");
  }

  const tokenRes = await fetch(`${microsoftBaseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: graphTokenScope,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || "Microsoft token refresh failed");
  }

  return tokenData as TokenPayload;
};

export const hasMicrosoftGraphAccess = (user: any) => {
  return Boolean(user?.microsoftGraphAuth?.accessTokenCiphertext);
};

export const getValidMicrosoftGraphAccessToken = async (user: any) => {
  const graphAuth = user?.microsoftGraphAuth;
  if (!graphAuth?.accessTokenCiphertext) {
    return null;
  }

  const expiresAt = graphAuth.expiresAt ? new Date(graphAuth.expiresAt) : null;
  const refreshMarginMs = 2 * 60 * 1000;

  if (expiresAt && expiresAt.getTime() > Date.now() + refreshMarginMs) {
    return decryptSecret(graphAuth.accessTokenCiphertext);
  }

  if (!graphAuth.refreshTokenCiphertext) {
    return decryptSecret(graphAuth.accessTokenCiphertext);
  }

  const refreshedToken = await refreshMicrosoftAccessToken(
    decryptSecret(graphAuth.refreshTokenCiphertext)
  );
  persistMicrosoftGraphAuth(user, refreshedToken);
  await user.save();
  return decryptSecret(user.microsoftGraphAuth.accessTokenCiphertext);
};

export const MICROSOFT_GRAPH_SIGN_IN_SCOPE = graphTokenScope;