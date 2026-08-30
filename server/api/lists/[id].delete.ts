// Deletes a list (owner only), cascading its items, members and invitations.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const id = getRouterParam(event, "id") as string;

  await requireListRole(event, id, user.id, ["owner"]);

  await db.batch([
    db.prepare("DELETE FROM list_items WHERE list_id = ?").bind(id),
    db.prepare("DELETE FROM list_members WHERE list_id = ?").bind(id),
    db.prepare("DELETE FROM list_invitations WHERE list_id = ?").bind(id),
    db.prepare("DELETE FROM lists WHERE id = ?").bind(id),
  ]);

  return { ok: true };
});
