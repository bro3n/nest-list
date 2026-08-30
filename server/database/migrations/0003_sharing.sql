-- Email-based list sharing: pending invitations (list_members already exists).

CREATE TABLE list_invitations (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id),
  email TEXT NOT NULL, -- normalised (lowercase)
  role TEXT NOT NULL, -- editor | viewer
  invited_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | revoked
  created_at INTEGER NOT NULL,
  UNIQUE (list_id, email)
);
CREATE INDEX idx_invitations_email_status ON list_invitations(email, status);
CREATE INDEX idx_list_members_user ON list_members(user_id);
