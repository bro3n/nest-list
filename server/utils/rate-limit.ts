import type { H3Event } from "h3";

// Fixed-window limiter backed by D1. Returns true when the request is allowed.
export const rateLimit = async (
  event: H3Event,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> => {
  const db = useDb(event);
  const now = Date.now();
  const row = await db
    .prepare("SELECT count, window_start AS windowStart FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; windowStart: number }>();

  if (!row || now - row.windowStart > windowMs) {
    await db
      .prepare(
        "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) " +
          "ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start",
      )
      .bind(key, now)
      .run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
};
