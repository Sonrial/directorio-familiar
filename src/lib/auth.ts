import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { createOpaqueToken, sha256 } from "@/lib/crypto";
import { HttpError } from "@/lib/security";

export const SESSION_COOKIE = "directorio_session";
const SESSION_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  must_change_password: boolean;
};

export async function createSession(userId: string, request: Request) {
  const sql = getDb();
  const token = createOpaqueToken();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ipHash = forwarded ? sha256(`${forwarded}:${process.env.VAULT_ENCRYPTION_KEY}`) : null;
  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_hash)
    VALUES (${userId}, ${sha256(token)}, ${expires.toISOString()},
      ${request.headers.get("user-agent")?.slice(0, 500) ?? null}, ${ipHash})
  `;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
    priority: "high",
  });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sql = getDb();
  const rows = (await sql`
    SELECT u.id, u.email, u.name, u.role, u.must_change_password
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${sha256(token)}
      AND s.expires_at > now()
      AND u.active = true
    LIMIT 1
  `) as SessionUser[];
  if (!rows[0]) return null;
  void sql`UPDATE sessions SET last_seen_at = now() WHERE token_hash = ${sha256(token)}`;
  return rows[0];
}

export async function requireUser(options: { allowPasswordChange?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Debes iniciar sesión");
  if (user.must_change_password && !options.allowPasswordChange) {
    throw new HttpError(428, "Debes crear tu contraseña personal antes de continuar");
  }
  return user;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await getDb()`DELETE FROM sessions WHERE token_hash = ${sha256(token)}`;
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function audit(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  await getDb()`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (${userId}, ${action}, ${entityType}, ${entityId ?? null}, ${JSON.stringify(metadata)}::jsonb)
  `;
}
