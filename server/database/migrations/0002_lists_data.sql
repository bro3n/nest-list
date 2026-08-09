-- Persistence for trash and per-user tag colors (previously localStorage-only).

CREATE TABLE deleted_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  list_id TEXT NOT NULL,
  list_title TEXT NOT NULL,
  text TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT NOT NULL
);
CREATE INDEX idx_deleted_user_list ON deleted_items(user_id, list_id);

-- Per-user settings blob. Currently holds the tag-color store {seed, colors}.
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  tag_colors TEXT NOT NULL DEFAULT '{"seed":0,"colors":{}}'
);
