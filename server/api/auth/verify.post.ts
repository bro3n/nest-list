export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; code?: string }>(event);
  const email = normalizeEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: "invalid_input" });
  }

  const result = await verifyOtp(event, email, code);
  if (result !== "ok") throw createError({ statusCode: 401, statusMessage: result });

  const db = useDb(event);
  const now = Date.now();
  let user = await db
    .prepare("SELECT id, email FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; email: string }>();

  if (!user) {
    const id = crypto.randomUUID();
    await db
      .prepare("INSERT INTO users (id, email, created_at, last_login_at) VALUES (?, ?, ?, ?)")
      .bind(id, email, now, now)
      .run();
    user = { id, email };
  } else {
    await db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(now, user.id).run();
  }

  await createSession(event, user.id);
  return { user: { id: user.id, email: user.email } };
});
