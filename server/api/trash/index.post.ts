interface Entry {
  id: string;
  text: string;
  checked: boolean;
  listId: string;
  listTitle: string;
  deletedAt: string;
}

const MAX_PER_LIST = 100;

// Records deleted items (ids/timestamps provided by the client), then prunes
// each affected list back to its most-recent MAX_PER_LIST entries.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const body = await readBody<{ entries?: Entry[] }>(event);
  const entries = Array.isArray(body?.entries) ? body.entries : [];
  if (!entries.length) return { ok: true };

  await db.batch(
    entries.map((e) =>
      db
        .prepare(
          "INSERT INTO deleted_items (id, user_id, list_id, list_title, text, checked, deleted_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(e.id, user.id, e.listId, e.listTitle, e.text, e.checked ? 1 : 0, e.deletedAt),
    ),
  );

  for (const listId of new Set(entries.map((e) => e.listId))) {
    await db
      .prepare(
        "DELETE FROM deleted_items WHERE user_id = ? AND list_id = ? AND id NOT IN " +
          "(SELECT id FROM deleted_items WHERE user_id = ? AND list_id = ? " +
          "ORDER BY deleted_at DESC LIMIT ?)",
      )
      .bind(user.id, listId, user.id, listId, MAX_PER_LIST)
      .run();
  }

  return { ok: true };
});
