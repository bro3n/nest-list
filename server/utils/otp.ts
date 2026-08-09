import type { H3Event } from "h3";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

// Creates (or replaces) the active code for an email and returns the raw code to send.
export const issueOtp = async (event: H3Event, email: string): Promise<string> => {
  const db = useDb(event);
  const code = randomOtp();
  const codeHash = await hmac(code, sessionSecret(event));
  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO otp_codes (email, code_hash, expires_at, attempts, created_at) VALUES (?, ?, ?, 0, ?) " +
        "ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, " +
        "expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at",
    )
    .bind(email, codeHash, now + OTP_TTL_MS, now)
    .run();
  return code;
};

export type OtpResult = "ok" | "invalid" | "expired" | "too_many_attempts";

export const verifyOtp = async (
  event: H3Event,
  email: string,
  code: string,
): Promise<OtpResult> => {
  const db = useDb(event);
  const row = await db
    .prepare(
      "SELECT code_hash AS codeHash, expires_at AS expiresAt, attempts FROM otp_codes WHERE email = ?",
    )
    .bind(email)
    .first<{ codeHash: string; expiresAt: number; attempts: number }>();

  if (!row) return "invalid";

  if (row.expiresAt < Date.now()) {
    await db.prepare("DELETE FROM otp_codes WHERE email = ?").bind(email).run();
    return "expired";
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db.prepare("DELETE FROM otp_codes WHERE email = ?").bind(email).run();
    return "too_many_attempts";
  }

  const candidate = await hmac(code, sessionSecret(event));
  if (!timingSafeEqual(candidate, row.codeHash)) {
    await db
      .prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE email = ?")
      .bind(email)
      .run();
    return "invalid";
  }

  await db.prepare("DELETE FROM otp_codes WHERE email = ?").bind(email).run();
  return "ok";
};
