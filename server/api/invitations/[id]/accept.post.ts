// Accepts a pending invitation addressed to the user: grants membership.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const invId = getRouterParam(event, "id") as string;

  const inv = await db
    .prepare(
      "SELECT list_id, email, role FROM list_invitations WHERE id = ? AND status = 'pending'",
    )
    .bind(invId)
    .first<{ list_id: string; email: string; role: "editor" | "viewer" }>();
  if (!inv) throw createError({ statusCode: 404, statusMessage: "not_found" });
  if (inv.email !== user.email) throw createError({ statusCode: 403, statusMessage: "forbidden" });

  await db.batch([
    db
      .prepare(
        "INSERT INTO list_members (list_id, user_id, role, created_at) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(list_id, user_id) DO UPDATE SET role = excluded.role",
      )
      .bind(inv.list_id, user.id, inv.role, Date.now()),
    db.prepare("UPDATE list_invitations SET status = 'accepted' WHERE id = ?").bind(invId),
  ]);

  return { ok: true };
});
