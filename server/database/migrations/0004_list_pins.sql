-- Pinning becomes per-user. Existing (shared) pins are migrated to the list owner.
-- `lists.featured` is left in place but no longer read (avoids a risky D1 DROP COLUMN).

CREATE TABLE list_pins (
  user_id TEXT NOT NULL REFERENCES users(id),
  list_id TEXT NOT NULL REFERENCES lists(id),
  PRIMARY KEY (user_id, list_id)
);
CREATE INDEX idx_list_pins_user ON list_pins(user_id);

INSERT INTO list_pins (user_id, list_id) SELECT owner_id, id FROM lists WHERE featured = 1;
