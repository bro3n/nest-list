// Upserts the user's tag-color store {seed, colors}.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const db = useDb(event);
  const body = await readBody<{ seed?: number; colors?: Record<string, number> }>(event);

  const json = JSON.stringify({
    seed: typeof body?.seed === "number" ? body.seed : 0,
    colors: body?.colors ?? {},
  });

  await db
    .prepare(
      "INSERT INTO user_settings (user_id, tag_colors) VALUES (?, ?) " +
        "ON CONFLICT(user_id) DO UPDATE SET tag_colors = excluded.tag_colors",
    )
    .bind(user.id, json)
    .run();

  return { ok: true };
});
