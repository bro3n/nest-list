// Invites an email to a list (owner only). Creates a pending invitation and
// emails the invitee; they accept on sign-in. Never adds access directly.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const listId = getRouterParam(event, "id") as string;
  await requireListRole(event, listId, user.id, ["owner"]);

  const body = await readBody<{ email?: string; role?: string }>(event);
  const email = normalizeEmail(body?.email);
  const role = body?.role;
  if (!email) throw createError({ statusCode: 400, statusMessage: "invalid_email" });
  if (role !== "editor" && role !== "viewer") {
    throw createError({ statusCode: 400, statusMessage: "invalid_role" });
  }
  if (email === user.email)
    throw createError({ statusCode: 409, statusMessage: "cannot_invite_self" });

  const invitee = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (invitee) {
    const member = await db
      .prepare("SELECT 1 FROM list_members WHERE list_id = ? AND user_id = ?")
      .bind(listId, invitee.id)
      .first();
    if (member) throw createError({ statusCode: 409, statusMessage: "already_member" });
  }

  // Re-inviting the same email refreshes the role and re-opens the invitation.
  await db
    .prepare(
      "INSERT INTO list_invitations (id, list_id, email, role, invited_by, status, created_at) " +
        "VALUES (?, ?, ?, ?, ?, 'pending', ?) " +
        "ON CONFLICT(list_id, email) DO UPDATE SET role = excluded.role, " +
        "status = 'pending', invited_by = excluded.invited_by, created_at = excluded.created_at",
    )
    .bind(crypto.randomUUID(), listId, email, role, user.id, Date.now())
    .run();

  const list = await db
    .prepare("SELECT title FROM lists WHERE id = ?")
    .bind(listId)
    .first<{ title: string }>();
  await sendShareInviteEmail(
    event,
    email,
    list?.title ?? "a list",
    user.email,
    getRequestURL(event).origin,
  );

  return { ok: true };
});
