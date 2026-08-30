// Pins a list in the current user's personal view (any role can pin).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const id = getRouterParam(event, "id") as string;
  await requireListRole(event, id, user.id, ["owner", "editor", "viewer"]);

  await db
    .prepare("INSERT OR IGNORE INTO list_pins (user_id, list_id) VALUES (?, ?)")
    .bind(user.id, id)
    .run();

  return { ok: true };
});
