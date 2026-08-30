// Members and pending invitations of a list (owner only — the share dialog).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const listId = getRouterParam(event, "id") as string;
  await requireListRole(event, listId, user.id, ["owner"]);

  const { results: members } = await db
    .prepare(
      "SELECT m.user_id, u.email, m.role FROM list_members m " +
        "JOIN users u ON u.id = m.user_id WHERE m.list_id = ? ORDER BY u.email",
    )
    .bind(listId)
    .all<{ user_id: string; email: string; role: "editor" | "viewer" }>();

  const { results: invitations } = await db
    .prepare(
      "SELECT id, email, role FROM list_invitations " +
        "WHERE list_id = ? AND status = 'pending' ORDER BY email",
    )
    .bind(listId)
    .all<{ id: string; email: string; role: "editor" | "viewer" }>();

  return {
    members: members.map((m) => ({ userId: m.user_id, email: m.email, role: m.role })),
    invitations,
  };
});
