import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";

export interface AuthUser {
  name: string;
  oid?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export function authDisabled(): boolean {
  return (process.env.AUTH_DISABLED ?? "true").toLowerCase() !== "false";
}

let jwks: jwksRsa.JwksClient | null = null;

function getJwks(): jwksRsa.JwksClient {
  const tenant = process.env.AZURE_AD_TENANT_ID;
  if (!tenant) throw new Error("AZURE_AD_TENANT_ID required when AUTH_DISABLED=false");
  jwks ??= jwksRsa({
    jwksUri: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
    cache: true,
  });
  return jwks;
}

export async function authHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (authDisabled()) {
    req.user = { name: process.env.DEMO_USER ?? "demo.user" };
    return;
  }
  if (req.method === "OPTIONS" || req.url === "/api/health" || req.url.startsWith("/api/auth/config")) {
    return;
  }
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Jeton Bearer manquant" });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
      throw new Error("token");
    }
    const key = await getJwks().getSigningKey(decoded.header.kid);
    const payload = jwt.verify(token, key.getPublicKey(), {
      audience: process.env.AZURE_AD_API_AUDIENCE ?? process.env.AZURE_AD_CLIENT_ID,
      issuer: process.env.AZURE_AD_ISSUER ?? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }) as jwt.JwtPayload;
    req.user = {
      name: String(payload.preferred_username ?? payload.upn ?? payload.name ?? payload.oid ?? "user"),
      oid: typeof payload.oid === "string" ? payload.oid : undefined,
    };
  } catch {
    reply.code(401).send({ error: "Jeton Entra ID invalide" });
  }
}

export function entraClientConfig() {
  return {
    authDisabled: authDisabled(),
    clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
    tenantId: process.env.AZURE_AD_TENANT_ID ?? "",
    apiScope: process.env.AZURE_AD_API_SCOPE ?? "",
    redirectUri: process.env.AZURE_AD_REDIRECT_URI ?? windowSafeRedirect(),
  };
}

function windowSafeRedirect(): string {
  return process.env.PUBLIC_WEB_URL ?? "http://localhost:5173";
}
