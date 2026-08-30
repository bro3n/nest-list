// Removes a member. The owner can remove anyone; a member can remove themselves
// (leave). The owner cannot leave a shared list — they must transfer first.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const listId = getRouterParam(event, "id") as string;
  const targetId = getRouterParam(event, "userId") as string;

  if (targetId === user.id) {
    const role = await getListRole(event, listId, user.id);
    if (!role) throw createError({ statusCode: 404, statusMessage: "not_found" });
    if (role === "owner") {
      throw createError({ statusCode: 400, statusMessage: "owner_must_transfer" });
    }
  } else {
    await requireListRole(event, listId, user.id, ["owner"]);
  }

  await db
    .prepare("DELETE FROM list_members WHERE list_id = ? AND user_id = ?")
    .bind(listId, targetId)
    .run();

  return { ok: true };
});
