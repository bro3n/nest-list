// Deletes the authenticated user's account and all their personal data.
// Refused (409) while the user still owns shared lists — they must transfer or
// delete those first. Solo owned lists are removed with the account.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);

  const shared = await db
    .prepare(
      "SELECT COUNT(DISTINCT l.id) AS n FROM lists l " +
        "JOIN list_members m ON m.list_id = l.id WHERE l.owner_id = ?",
    )
    .bind(user.id)
    .first<{ n: number }>();
  if ((shared?.n ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "owns_shared_lists",
      data: { count: shared?.n ?? 0 },
    });
  }

  // Remaining owned lists have no members (solo). Delete them and their children
  // before removing the user's membership rows (the subquery relies on them).
  const soloLists =
    "SELECT id FROM lists WHERE owner_id = ? AND id NOT IN (SELECT list_id FROM list_members)";

  await db.batch([
    db.prepare(`DELETE FROM list_items WHERE list_id IN (${soloLists})`).bind(user.id),
    db.prepare(`DELETE FROM list_pins WHERE list_id IN (${soloLists})`).bind(user.id),
    db.prepare(`DELETE FROM list_invitations WHERE list_id IN (${soloLists})`).bind(user.id),
    db
      .prepare(
        "DELETE FROM lists WHERE owner_id = ? AND id NOT IN (SELECT list_id FROM list_members)",
      )
      .bind(user.id),
    db.prepare("DELETE FROM list_members WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM list_pins WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM deleted_items WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM user_settings WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM list_invitations WHERE email = ?").bind(user.email),
    db.prepare("DELETE FROM otp_codes WHERE email = ?").bind(user.email),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    db.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
  ]);

  await destroySession(event);
  return { ok: true };
});
