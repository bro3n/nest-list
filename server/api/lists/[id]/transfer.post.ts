// Transfers ownership to another member (owner only). The target becomes owner
// (removed from list_members); the previous owner stays on as an editor.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const listId = getRouterParam(event, "id") as string;
  await requireListRole(event, listId, user.id, ["owner"]);

  const body = await readBody<{ userId?: string }>(event);
  const targetId = body?.userId;
  if (!targetId) throw createError({ statusCode: 400, statusMessage: "invalid_input" });

  const member = await db
    .prepare("SELECT 1 FROM list_members WHERE list_id = ? AND user_id = ?")
    .bind(listId, targetId)
    .first();
  if (!member) throw createError({ statusCode: 400, statusMessage: "not_a_member" });

  await db.batch([
    db.prepare("UPDATE lists SET owner_id = ? WHERE id = ?").bind(targetId, listId),
    db.prepare("DELETE FROM list_members WHERE list_id = ? AND user_id = ?").bind(listId, targetId),
    db
      .prepare(
        "INSERT INTO list_members (list_id, user_id, role, created_at) VALUES (?, ?, 'editor', ?) " +
          "ON CONFLICT(list_id, user_id) DO UPDATE SET role = 'editor'",
      )
      .bind(listId, user.id, Date.now()),
  ]);

  return { ok: true };
});
