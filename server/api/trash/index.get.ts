// Returns all trashed items for the authenticated user, newest first.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);

  const { results } = await db
    .prepare(
      "SELECT id, list_id, list_title, text, checked, deleted_at FROM deleted_items " +
        "WHERE user_id = ? ORDER BY deleted_at DESC",
    )
    .bind(user.id)
    .all<{
      id: string;
      list_id: string;
      list_title: string;
      text: string;
      checked: number;
      deleted_at: string;
    }>();

  return results.map((r) => ({
    id: r.id,
    listId: r.list_id,
    listTitle: r.list_title,
    text: r.text,
    checked: !!r.checked,
    deletedAt: r.deleted_at,
  }));
});
