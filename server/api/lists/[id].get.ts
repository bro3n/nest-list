// Single list the user can access. With `?rev=N`, returns a tiny "unchanged"
// response when the list is still at revision N — the cheap poll path.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const id = getRouterParam(event, "id") as string;

  const role = await getListRole(event, id, user.id);
  if (!role) throw createError({ statusCode: 404, statusMessage: "not_found" });

  const meta = await db
    .prepare(
      "SELECT l.title, l.tags, l.created_at, l.updated_at, l.revision, o.email AS owner_email, " +
        "CASE WHEN p.user_id IS NOT NULL THEN 1 ELSE 0 END AS featured " +
        "FROM lists l JOIN users o ON o.id = l.owner_id " +
        "LEFT JOIN list_pins p ON p.list_id = l.id AND p.user_id = ? " +
        "WHERE l.id = ?",
    )
    .bind(user.id, id)
    .first<{
      title: string;
      tags: string;
      created_at: string;
      updated_at: string;
      revision: number;
      owner_email: string;
      featured: number;
    }>();
  if (!meta) throw createError({ statusCode: 404, statusMessage: "not_found" });

  const reqRev = Number(getQuery(event).rev);
  if (Number.isInteger(reqRev) && reqRev === meta.revision) {
    return { revision: meta.revision, unchanged: true };
  }

  const { results: items } = await db
    .prepare("SELECT id, text, checked FROM list_items WHERE list_id = ? ORDER BY position")
    .bind(id)
    .all<{ id: string; text: string; checked: number }>();

  return {
    id,
    title: meta.title,
    items: items.map((i) => ({ id: i.id, text: i.text, checked: !!i.checked })),
    featured: !!meta.featured,
    tags: JSON.parse(meta.tags) as string[],
    createdAt: meta.created_at,
    updatedAt: meta.updated_at,
    role,
    ownerEmail: meta.owner_email,
    revision: meta.revision,
  };
});
