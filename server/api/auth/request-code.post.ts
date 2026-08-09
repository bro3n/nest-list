export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event);
  const email = normalizeEmail(body?.email);
  if (!email) throw createError({ statusCode: 400, statusMessage: "invalid_email" });

  const ip =
    getHeader(event, "cf-connecting-ip") ??
    getRequestIP(event, { xForwardedFor: true }) ??
    "unknown";
  const hour = 60 * 60 * 1000;
  const okIp = await rateLimit(event, `req:ip:${ip}`, 20, hour);
  const okEmail = await rateLimit(event, `req:email:${email}`, 5, hour);
  if (!okIp || !okEmail) throw createError({ statusCode: 429, statusMessage: "too_many_requests" });

  const code = await issueOtp(event, email);
  await sendOtpEmail(event, email, code);

  // Generic response — never reveal whether the email already has an account.
  return { ok: true };
});
