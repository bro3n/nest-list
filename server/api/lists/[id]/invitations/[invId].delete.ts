// Revokes a pending invitation (owner only).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const listId = getRouterParam(event, "id") as string;
  const invId = getRouterParam(event, "invId") as string;
  await requireListRole(event, listId, user.id, ["owner"]);

  await db
    .prepare("DELETE FROM list_invitations WHERE id = ? AND list_id = ?")
    .bind(invId, listId)
    .run();

  return { ok: true };
});
