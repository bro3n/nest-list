interface ClientItem {
  id: string;
  text: string;
  checked: boolean;
}
interface PatchBody {
  title?: string;
  items?: ClientItem[];
  tags?: string[];
  updatedAt?: string;
}

// Partial update of a list the user can edit (owner or editor). Only provided
// fields change; `items` (when given) fully replaces the list's items.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const id = getRouterParam(event, "id") as string;

  await requireListRole(event, id, user.id, ["owner", "editor"]);

  const body = await readBody<PatchBody>(event);
  const invalid = validateListInput(body ?? {});
  if (invalid) throw createError({ statusCode: 400, statusMessage: invalid });

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (typeof body?.title === "string") {
    sets.push("title = ?");
    binds.push(body.title.trim());
  }
  if (Array.isArray(body?.tags)) {
    sets.push("tags = ?");
    binds.push(JSON.stringify(body.tags));
  }
  if (typeof body?.updatedAt === "string") {
    sets.push("updated_at = ?");
    binds.push(body.updatedAt);
  }

  // Every patch bumps the revision so other members' polls detect the change.
  const stmts = [];
  sets.push("revision = revision + 1");
  stmts.push(db.prepare(`UPDATE lists SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, id));
  if (Array.isArray(body?.items)) {
    stmts.push(db.prepare("DELETE FROM list_items WHERE list_id = ?").bind(id));
    body.items.forEach((it, i) =>
      stmts.push(
        db
          .prepare(
            "INSERT INTO list_items (id, list_id, text, checked, position) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(it.id, id, it.text, it.checked ? 1 : 0, i),
      ),
    );
  }
  await db.batch(stmts);

  const row = await db
    .prepare("SELECT revision FROM lists WHERE id = ?")
    .bind(id)
    .first<{ revision: number }>();
  return { ok: true, revision: row?.revision };
});
