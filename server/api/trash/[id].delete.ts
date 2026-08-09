// Removes one trash entry (used on restore or dismiss). Scoped to the user.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const id = getRouterParam(event, "id") as string;

  await db
    .prepare("DELETE FROM deleted_items WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .run();

  return { ok: true };
});
