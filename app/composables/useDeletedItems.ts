import type { ChecklistItem } from "~/composables/useLists";

export interface DeletedItem {
  id: string;
  text: string;
  checked: boolean;
  listId: string;
  listTitle: string;
  deletedAt: string;
}

const STORAGE_KEY = "nest-list:deleted";
// Kept per list, most recent first.
const MAX_PER_LIST = 100;

// Interim persistence in localStorage, like useLists. Keeps at most the 100
// most recently deleted checklist items.
export const useDeletedItems = () => {
  const deleted = useState<DeletedItem[]>("deletedItems", () => {
    if (!import.meta.client) return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as DeletedItem[];
    } catch {
      return [];
    }
  });

  const persist = () => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(deleted.value));
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
    persist();
  };

  const remove = (id: string) => {
    deleted.value = deleted.value.filter((entry) => entry.id !== id);
    persist();
  };

  return { deleted, sorted, record, remove };
};
