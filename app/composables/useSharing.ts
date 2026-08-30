import type { ListRole } from "~/composables/useLists";

export interface ShareMember {
  userId: string;
  email: string;
  role: Exclude<ListRole, "owner">;
}
export interface ShareInvitation {
  id: string;
  email: string;
  role: Exclude<ListRole, "owner">;
}

// Thin wrappers over the sharing endpoints (no shared reactive state — the share
// dialog owns its local copy).
export const useSharing = () => {
  const getShares = (listId: string) =>
    $fetch<{ members: ShareMember[]; invitations: ShareInvitation[] }>(
      `/api/lists/${listId}/shares`,
    );

  const invite = (listId: string, email: string, role: Exclude<ListRole, "owner">) =>
    $fetch(`/api/lists/${listId}/shares`, { method: "POST", body: { email, role } });

  const setRole = (listId: string, userId: string, role: Exclude<ListRole, "owner">) =>
    $fetch(`/api/lists/${listId}/shares/${userId}`, { method: "PATCH", body: { role } });

  const removeMember = (listId: string, userId: string) =>
    $fetch(`/api/lists/${listId}/shares/${userId}`, { method: "DELETE" });

  const revokeInvite = (listId: string, invitationId: string) =>
    $fetch(`/api/lists/${listId}/invitations/${invitationId}`, { method: "DELETE" });

  const leave = (listId: string, myUserId: string) => removeMember(listId, myUserId);

  const transfer = (listId: string, userId: string) =>
    $fetch(`/api/lists/${listId}/transfer`, { method: "POST", body: { userId } });

  return { getShares, invite, setRole, removeMember, revokeInvite, leave, transfer };
};
