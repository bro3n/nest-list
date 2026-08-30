// Unpins a list from the current user's personal view.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const id = getRouterParam(event, "id") as string;
  await requireListRole(event, id, user.id, ["owner", "editor", "viewer"]);

  await db
    .prepare("DELETE FROM list_pins WHERE user_id = ? AND list_id = ?")
    .bind(user.id, id)
    .run();

  return { ok: true };
});
