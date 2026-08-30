// Declines a pending invitation addressed to the user.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const invId = getRouterParam(event, "id") as string;

  await db
    .prepare(
      "UPDATE list_invitations SET status = 'declined' " +
        "WHERE id = ? AND email = ? AND status = 'pending'",
    )
    .bind(invId, user.email)
    .run();

  return { ok: true };
});
