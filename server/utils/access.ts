import type { H3Event } from "h3";

export type ListRole = "owner" | "editor" | "viewer";

// The user's role on a list: "owner" (lists.owner_id), a membership role, or null.
export const getListRole = async (
  event: H3Event,
  listId: string,
  userId: string,
): Promise<ListRole | null> => {
  const db = useDb(event);
  const owned = await db
    .prepare("SELECT 1 FROM lists WHERE id = ? AND owner_id = ?")
    .bind(listId, userId)
    .first();
  if (owned) return "owner";
  const member = await db
    .prepare("SELECT role FROM list_members WHERE list_id = ? AND user_id = ?")
    .bind(listId, userId)
    .first<{ role: ListRole }>();
  return member?.role ?? null;
};

// Guards a route by role. 404 when the user has no access at all (don't reveal
// existence), 403 when they have access but not enough.
export const requireListRole = async (
  event: H3Event,
  listId: string,
  userId: string,
  allowed: ListRole[],
): Promise<ListRole> => {
  const role = await getListRole(event, listId, userId);
  if (!role) throw createError({ statusCode: 404, statusMessage: "not_found" });
  if (!allowed.includes(role)) throw createError({ statusCode: 403, statusMessage: "forbidden" });
  return role;
};
