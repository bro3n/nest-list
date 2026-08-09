// Returns the authenticated user's lists, each with its ordered items.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);

  const { results: lists } = await db
    .prepare(
      "SELECT id, title, featured, tags, created_at, updated_at FROM lists WHERE owner_id = ?",
    )
    .bind(user.id)
    .all<{
      id: string;
      title: string;
      featured: number;
      tags: string;
      created_at: string;
      updated_at: string;
    }>();

  const { results: items } = await db
    .prepare(
      "SELECT i.id, i.list_id, i.text, i.checked FROM list_items i " +
        "JOIN lists l ON l.id = i.list_id WHERE l.owner_id = ? ORDER BY i.position",
    )
    .bind(user.id)
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
  }));
});
