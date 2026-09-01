-- Monotonic change counter per list, bumped on every shared write (title/items/tags).
-- Clients poll it to detect changes made by other members.
ALTER TABLE lists ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
