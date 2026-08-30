# List sharing — functional spec

Sharing Nest List lists between users, keyed by **email**. Builds on the existing
auth (email-OTP, users identified by email), `lists.owner_id`, and the
`list_members(list_id, user_id, role)` table.

## Roles & permissions

The **owner** is `lists.owner_id`. Other members live in `list_members` with a role.

| Action | Viewer | Editor | Owner |
|---|:--:|:--:|:--:|
| View the list and its items | ✅ | ✅ | ✅ |
| Check / edit / add / remove items | — | ✅ | ✅ |
| Rename the list, manage tags | — | ✅ | ✅ |
| Pin the list (**personal view**) | ✅ | ✅ | ✅ |
| Invite / change a role / remove a member | — | — | ✅ |
| Delete the list | — | — | ✅ |
| Leave the list | ✅ | ✅ | — (must transfer first) |

Membership management is **owner-only**. Editors change content, not access.

## Email-based invitation model

One flow whether the invitee has an account or not:

1. Owner enters an **email + role** → an **invitation** is created (`pending`) and an
   email is sent (Resend).
2. Invitee opens the app and signs in (OTP) with that email — creating an account if
   needed; same email, so the invitation finds them.
3. On sign-in, their **pending invitations** are shown. They **Accept** or **Decline**.
4. On accept → a `list_members` row is created and the list appears in their lists.

**Acceptance is explicit** (not auto-add): a list never appears for someone without
their consent, which also guards against email typos.

Invitation states: `pending → accepted` / `declined` / `revoked` (cancelled by owner).

## User journeys

- **Share (owner)**: "Share" button on the list page → dialog with an email field + role
  selector, plus the current members and pending invitations (with role change / removal).
- **Receive**: email "X shared the list \"Y\" with you". In-app, an **Invitations** area
  (header badge) lists pending invitations → Accept / Decline.
- **Browse**: shared lists appear alongside owned ones, marked with a badge ("Shared by X"
  / role). Viewers get a read-only view.
- **Manage / leave**: owner changes roles or removes members from the share dialog; a
  member can **Leave** a list.

## Rules & edge cases

- Emails normalised to lowercase (`normalizeEmail`) → case-insensitive matching.
- Inviting yourself → rejected. Inviting an existing member/invitee → idempotent (offer a
  role change instead of a duplicate).
- Deleting a list → cascades members + invitations.
- **Pinning is per-user** (see Phase B): stored per (user, list); everyone pins in their
  own view.
- **Ownership transfer**: the sole owner cannot just leave a **shared** list — they must
  first transfer ownership to another member. A non-shared (solo) list has nothing to
  transfer, so "leaving" it means deleting it.
- **Trash on a shared list**: item content is shared (deleting an item removes it for
  everyone), but the trash/undo entry is **personal** to whoever deleted it
  (`deleted_items.user_id`, unchanged).
- **Tag colors** stay **personal** per user (unchanged).

## Out of scope (v1)

Real-time sync (still reload / last-write-wins), push notifications, history/versions,
comments, account deletion.

---

## Data model (deltas)

`list_members` already exists. New:

```sql
-- Phase A
CREATE TABLE list_invitations (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id),
  email TEXT NOT NULL,               -- normalised (lowercase)
  role TEXT NOT NULL,                -- editor | viewer
  invited_by TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | revoked
  created_at INTEGER NOT NULL,
  UNIQUE (list_id, email)
);

-- Phase B: pin becomes per-user; `featured` is dropped from `lists`.
CREATE TABLE list_pins (
  user_id TEXT NOT NULL REFERENCES users(id),
  list_id TEXT NOT NULL REFERENCES lists(id),
  PRIMARY KEY (user_id, list_id)
);
```

## API surface

- `GET /api/lists` — **extended**: owned + accepted-shared lists, each with my `role`,
  the owner's email, and my personal pin state.
- `POST /api/lists/:id/shares` `{email, role}` — invite (owner).
- `GET /api/lists/:id/shares` — members + pending invitations.
- `PATCH /api/lists/:id/shares/:userId` `{role}` / `DELETE …/:userId` — change role /
  remove member (owner), or self-leave.
- `GET /api/invitations` — my pending invitations.
- `POST /api/invitations/:id/accept` / `…/decline`.
- `POST /api/lists/:id/transfer` `{userId}` — transfer ownership (owner). *(Phase C)*
- Existing `PATCH /api/lists/:id` requires editor+, `DELETE` requires owner.

---

## Implementation phases

**Phase A — Sharing core (end-to-end).** `list_invitations` migration; role resolution
helper; extend `GET /api/lists` with shared lists + role + owner email; invite / shares /
accept / decline endpoints; permission checks on `PATCH`/`DELETE`; invite email; share
dialog + invitations area + header badge; viewer read-only gating; i18n ×4. Pinning stays
a shared column in this phase.

**Phase B — Per-user pinning.** `list_pins` migration, drop `featured` from `lists`; adapt
`toggleFeatured` / "pinned first" sort / `GET /api/lists` to be per-user. Self-contained
refactor, app stays working.

**Phase C — Ownership transfer & polish.** Transfer endpoint + UI; "leave" flow with the
sole-owner-must-transfer rule; remaining edge cases and i18n polish.
