interface ClientItem {
  id: string;
  text: string;
  checked: boolean;
}
interface CreateBody {
  id?: string;
  title?: string;
  items?: ClientItem[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Creates a list owned by the authenticated user. The client provides the id
// and timestamps (it owns the reactive state); the server persists them.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const body = await readBody<CreateBody>(event);

  const title = (body?.title ?? "").trim();
  if (!title) throw createError({ statusCode: 400, statusMessage: "title_required" });

  const dup = await db
    .prepare("SELECT 1 FROM lists WHERE owner_id = ? AND lower(title) = lower(?)")
    .bind(user.id, title)
    .first();
  if (dup) throw createError({ statusCode: 409, statusMessage: "title_duplicate" });

  const id = body?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const items = Array.isArray(body?.items) ? body.items : [];

  await db.batch([
    db
      .prepare(
        "INSERT INTO lists (id, owner_id, title, tags, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        user.id,
        title,
        JSON.stringify(Array.isArray(body?.tags) ? body.tags : []),
        body?.createdAt ?? now,
        body?.updatedAt ?? now,
      ),
    ...items.map((it, i) =>
      db
        .prepare(
          "INSERT INTO list_items (id, list_id, text, checked, position) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(it.id, id, it.text, it.checked ? 1 : 0, i),
    ),
  ]);

  return { id };
});
