-- Scope list item ids to their list (composite primary key) so a client-supplied
-- id can only ever collide within the same list, never break another list's write.
-- SQLite can't alter a primary key in place, so recreate the table.
CREATE TABLE list_items_new (
  id TEXT NOT NULL,
  list_id TEXT NOT NULL REFERENCES lists(id),
  text TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (list_id, id)
);

INSERT INTO list_items_new (id, list_id, text, checked, position)
SELECT id, list_id, text, checked, position FROM list_items;

DROP TABLE list_items;
ALTER TABLE list_items_new RENAME TO list_items;
-- The composite PK already indexes list_id (leftmost column), so no extra index.
