import { NextFunction, Request, Response } from "express";
import jwt, { JwtHeader, JwtPayload } from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      userRole?: string;
      authProvider?: "app" | "aad";
      aadClaims?: JwtPayload;
    }
  }
}

const jwksClientCache = new Map<string, JwksClient>();

const getTokenFromRequest = (req: Request) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return req.cookies["session_id"];
};

const getJwksClient = (tenantId: string) => {
  const cacheKey = tenantId.trim().toLowerCase();
  const existingClient = jwksClientCache.get(cacheKey);
  if (existingClient) {
    return existingClient;
  }

  const client = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cache: true,
    cacheMaxEntries: 10,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });

  jwksClientCache.set(cacheKey, client);
  return client;
};

const getAzureSigningKey = async (tenantId: string, kid: string) => {
  const client = getJwksClient(tenantId);
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
};

const getAllowedAzureAudiences = () => {
  const configuredAudiences = String(process.env.MS_ENTRA_ALLOWED_AUDIENCES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const derivedAudiences = [
    process.env.MS_ENTRA_CLIENT_ID,
    process.env.SOFIA_CLIENT_ID,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((clientId) => [clientId, `api://${clientId}`]);

  return Array.from(new Set([...configuredAudiences, ...derivedAudiences]));
};

const verifyAzureAdToken = async (token: string): Promise<JwtPayload | null> => {
  const decoded = jwt.decode(token, { complete: true }) as
    | { header: JwtHeader; payload: JwtPayload }
    | null;

  if (!decoded?.header?.kid || !decoded?.payload) {
    return null;
  }

  const tenantFromToken = String(decoded.payload.tid || "").trim();
  const configuredTenant = String(process.env.MS_ENTRA_TENANT_ID || "common").trim();
  const tenantId = tenantFromToken || configuredTenant;

  if (!tenantId || tenantId === "common") {
    return null;
  }

  const audiences = getAllowedAzureAudiences();
  if (audiences.length === 0) {
    return null;
  }

  const publicKey = await getAzureSigningKey(tenantId, decoded.header.kid);
  const issuerV2 = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const issuerSts = `https://sts.windows.net/${tenantId}/`;

  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    audience: audiences,
    issuer: [issuerV2, issuerSts],
  }) as JwtPayload;
};

const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: "unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
    req.userId = (decoded as JwtPayload).userId;
    req.userRole = (decoded as JwtPayload).role;
    req.authProvider = "app";
    next();
  } catch (error) {
    return res.status(401).json({ message: "unauthorized" });
  }
};

export const verifyTokenOrAzureAd = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: "unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string) as JwtPayload;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.authProvider = "app";
    return next();
  } catch {
    try {
      const aadClaims = await verifyAzureAdToken(token);
      if (!aadClaims) {
        return res.status(401).json({ message: "unauthorized" });
      }

      req.authProvider = "aad";
      req.aadClaims = aadClaims;
      return next();
    } catch {
      return res.status(401).json({ message: "unauthorized" });
    }
  }
};

export default verifyToken;
