// The authenticated user's pending invitations (matched by their email).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);

  const { results } = await db
    .prepare(
      "SELECT i.id, i.list_id, i.role, l.title AS list_title, u.email AS inviter_email " +
        "FROM list_invitations i " +
        "JOIN lists l ON l.id = i.list_id " +
        "JOIN users u ON u.id = i.invited_by " +
        "WHERE i.email = ? AND i.status = 'pending' ORDER BY i.created_at DESC",
    )
    .bind(user.email)
    .all<{
      id: string;
      list_id: string;
      role: "editor" | "viewer";
      list_title: string;
      inviter_email: string;
    }>();

  return results.map((r) => ({
    id: r.id,
    listId: r.list_id,
    listTitle: r.list_title,
    role: r.role,
    inviterEmail: r.inviter_email,
  }));
});
