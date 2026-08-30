import type { ListRole } from "~/composables/useLists";

export interface Invitation {
  id: string;
  listId: string;
  listTitle: string;
  role: ListRole;
  inviterEmail: string;
}

// The current user's pending invitations. Loaded at boot (header badge) and
// refreshed on the invitations page.
export const useInvitations = () => {
  const invitations = useState<Invitation[]>("invitations", () => []);
  const loaded = useState<boolean>("invitations:loaded", () => false);

  const load = async (force = false) => {
    if (loaded.value && !force) return;
    try {
      invitations.value = await $fetch<Invitation[]>("/api/invitations");
      loaded.value = true;
    } catch (e) {
      console.error("[invitations] load failed", e);
    }
  };

  const reset = () => {
    invitations.value = [];
    loaded.value = false;
  };

  const count = computed(() => invitations.value.length);

  const accept = async (id: string) => {
    await $fetch(`/api/invitations/${id}/accept`, { method: "POST" });
    invitations.value = invitations.value.filter((i) => i.id !== id);
    // The newly accepted list must show up in the user's lists.
    await useLists().refresh();
  };

  const decline = async (id: string) => {
    await $fetch(`/api/invitations/${id}/decline`, { method: "POST" });
    invitations.value = invitations.value.filter((i) => i.id !== id);
  };

  return { invitations, count, load, reset, accept, decline };
};
