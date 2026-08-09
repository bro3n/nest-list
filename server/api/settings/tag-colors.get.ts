// Returns the user's tag-color store {seed, colors}, or an empty default.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);

  const row = await db
    .prepare("SELECT tag_colors FROM user_settings WHERE user_id = ?")
    .bind(user.id)
    .first<{ tag_colors: string }>();

  return row
    ? (JSON.parse(row.tag_colors) as { seed: number; colors: Record<string, number> })
    : { seed: 0, colors: {} };
});
