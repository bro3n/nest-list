export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const id = getRouterParam(event, "id") as string;

  const owned = await db
    .prepare("SELECT 1 FROM lists WHERE id = ? AND owner_id = ?")
    .bind(id, user.id)
    .first();
  if (!owned) throw createError({ statusCode: 404, statusMessage: "not_found" });

  await db.batch([
    db.prepare("DELETE FROM list_items WHERE list_id = ?").bind(id),
    db.prepare("DELETE FROM lists WHERE id = ?").bind(id),
  ]);

  return { ok: true };
});
