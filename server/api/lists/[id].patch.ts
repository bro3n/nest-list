interface ClientItem {
  id: string;
  text: string;
  checked: boolean;
}
interface PatchBody {
  title?: string;
  items?: ClientItem[];
  featured?: boolean;
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
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (typeof body?.title === "string") {
    sets.push("title = ?");
    binds.push(body.title.trim());
  }
  if (typeof body?.featured === "boolean") {
    sets.push("featured = ?");
    binds.push(body.featured ? 1 : 0);
  }
  if (Array.isArray(body?.tags)) {
    sets.push("tags = ?");
    binds.push(JSON.stringify(body.tags));
  }
  if (typeof body?.updatedAt === "string") {
    sets.push("updated_at = ?");
    binds.push(body.updatedAt);
  }

  const stmts = [];
  if (sets.length) {
    stmts.push(db.prepare(`UPDATE lists SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, id));
  }
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
  if (stmts.length) await db.batch(stmts);

  return { ok: true };
});
