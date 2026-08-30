// Changes a member's role (owner only).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const listId = getRouterParam(event, "id") as string;
  const targetId = getRouterParam(event, "userId") as string;
  await requireListRole(event, listId, user.id, ["owner"]);

  const body = await readBody<{ role?: string }>(event);
  if (body?.role !== "editor" && body?.role !== "viewer") {
    throw createError({ statusCode: 400, statusMessage: "invalid_role" });
  }

  await db
    .prepare("UPDATE list_members SET role = ? WHERE list_id = ? AND user_id = ?")
    .bind(body.role, listId, targetId)
    .run();

  return { ok: true };
});
