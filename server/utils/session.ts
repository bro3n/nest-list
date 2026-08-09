import type { H3Event } from "h3";

const COOKIE_NAME = "nest_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

export interface SessionUser {
  id: string;
  email: string;
}

export const createSession = async (event: H3Event, userId: string): Promise<void> => {
  const db = useDb(event);
  const token = randomToken();
  const tokenHash = await hmac(token, sessionSecret(event));
  const now = Date.now();

  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      crypto.randomUUID(),
      userId,
      tokenHash,
      now,
      now + SESSION_TTL_SECONDS * 1000,
      getHeader(event, "user-agent") ?? null,
    )
    .run();

  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: !import.meta.dev, // localhost is treated as secure, but be lax on plain-http dev setups
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const getSessionUser = async (event: H3Event): Promise<SessionUser | null> => {
  const token = getCookie(event, COOKIE_NAME);
  if (!token) return null;

  const db = useDb(event);
  const tokenHash = await hmac(token, sessionSecret(event));
  const row = await db
    .prepare(
      "SELECT u.id AS id, u.email AS email, s.expires_at AS expiresAt " +
        "FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    )
    .bind(tokenHash)
    .first<{ id: string; email: string; expiresAt: number }>();

  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return { id: row.id, email: row.email };
};

// Guards a route: returns the current user or throws 401.
export const requireUser = async (event: H3Event): Promise<SessionUser> => {
  const user = await getSessionUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: "unauthenticated" });
  return user;
};

export const destroySession = async (event: H3Event): Promise<void> => {
  const token = getCookie(event, COOKIE_NAME);
  if (token) {
    const db = useDb(event);
    const tokenHash = await hmac(token, sessionSecret(event));
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  deleteCookie(event, COOKIE_NAME, { path: "/" });
};
