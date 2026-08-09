import type { ChecklistItem } from "~/composables/useLists";

export interface DeletedItem {
  id: string;
  text: string;
  checked: boolean;
  listId: string;
  listTitle: string;
  deletedAt: string;
}

// Kept per list, most recent first (also enforced server-side).
const MAX_PER_LIST = 100;

// Trash persisted in D1 (via /api/trash), optimistic like useLists.
export const useDeletedItems = () => {
  const deleted = useState<DeletedItem[]>("deletedItems", () => []);
  const loaded = useState<boolean>("deletedItems:loaded", () => false);

  const load = async () => {
    if (loaded.value) return;
    try {
      deleted.value = await $fetch<DeletedItem[]>("/api/trash");
      loaded.value = true;
    } catch (e) {
      console.error("[trash] load failed", e);
    }
  };

  const reset = () => {
    deleted.value = [];
    loaded.value = false;
  };

  // Most recently deleted first.
  const sorted = computed(() =>
    [...deleted.value].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
  );

  const record = (items: ChecklistItem[], listId: string, listTitle: string) => {
    const now = new Date().toISOString();
    const entries: DeletedItem[] = items
      .filter((item) => item.text.trim())
      .map((item) => ({
        id: crypto.randomUUID(),
        text: item.text,
        checked: item.checked,
        listId,
        listTitle,
        deletedAt: now,
      }));
    if (!entries.length) return;
    // Prepend the new entries (newest first), then cap each list to its limit.
    const counts: Record<string, number> = {};
    deleted.value = [...entries, ...deleted.value].filter((entry) => {
      counts[entry.listId] = (counts[entry.listId] ?? 0) + 1;
      return counts[entry.listId] <= MAX_PER_LIST;
    });
    $fetch("/api/trash", { method: "POST", body: { entries } }).catch((e) =>
      console.error("[trash] record failed", e),
    );
  };

  const remove = (id: string) => {
    deleted.value = deleted.value.filter((entry) => entry.id !== id);
    $fetch(`/api/trash/${id}`, { method: "DELETE" }).catch((e) =>
      console.error("[trash] remove failed", e),
    );
  };

  return { deleted, sorted, record, remove, load, reset };
};
