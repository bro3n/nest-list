// Returns the authenticated user's lists — owned and accepted-shared — each with
// its ordered items, the user's role, the owner's email, and the user's own pin.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);

  const { results: lists } = await db
    .prepare(
      "SELECT l.id, l.title, l.tags, l.created_at, l.updated_at, l.revision, " +
        "o.email AS owner_email, " +
        "CASE WHEN l.owner_id = ? THEN 'owner' ELSE m.role END AS role, " +
        "CASE WHEN p.user_id IS NOT NULL THEN 1 ELSE 0 END AS featured " +
        "FROM lists l " +
        "JOIN users o ON o.id = l.owner_id " +
        "LEFT JOIN list_members m ON m.list_id = l.id AND m.user_id = ? " +
        "LEFT JOIN list_pins p ON p.list_id = l.id AND p.user_id = ? " +
        "WHERE l.owner_id = ? OR m.user_id = ?",
    )
    .bind(user.id, user.id, user.id, user.id, user.id)
    .all<{
      id: string;
      title: string;
      tags: string;
      created_at: string;
      updated_at: string;
      revision: number;
      owner_email: string;
      role: "owner" | "editor" | "viewer";
      featured: number;
    }>();

  const { results: items } = await db
    .prepare(
      "SELECT i.id, i.list_id, i.text, i.checked FROM list_items i " +
        "WHERE i.list_id IN (" +
        "SELECT id FROM lists WHERE owner_id = ? " +
        "UNION SELECT list_id FROM list_members WHERE user_id = ?" +
        ") ORDER BY i.position",
    )
    .bind(user.id, user.id)
    .all<{ id: string; list_id: string; text: string; checked: number }>();

  const itemsByList = new Map<string, { id: string; text: string; checked: boolean }[]>();
  for (const it of items) {
    const arr = itemsByList.get(it.list_id) ?? [];
    arr.push({ id: it.id, text: it.text, checked: !!it.checked });
    itemsByList.set(it.list_id, arr);
  }

  return lists.map((l) => ({
    id: l.id,
    title: l.title,
    items: itemsByList.get(l.id) ?? [],
    featured: !!l.featured,
    tags: JSON.parse(l.tags) as string[],
    createdAt: l.created_at,
    updatedAt: l.updated_at,
    role: l.role,
    ownerEmail: l.owner_email,
    revision: l.revision,
  }));
});
