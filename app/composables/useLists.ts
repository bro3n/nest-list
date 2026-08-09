export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface NestList {
  id: string;
  title: string;
  items: ChecklistItem[];
  featured: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

type ListPatch = Partial<Pick<NestList, "title" | "items" | "featured" | "tags">> & {
  updatedAt?: string;
};

// Persistence is optimistic: mutations update the reactive state immediately,
// then sync to D1 in the background. Ids are generated client-side so creates
// return synchronously and callers (and the URL) can use the id at once.
// Hot-path edits (title/items) are debounced per list; a create's POST is
// awaited before any later PATCH for the same list so they can't race.
const creating = new Map<string, Promise<unknown>>();
const pendingBody = new Map<string, ListPatch>();
const pendingTimer = new Map<string, ReturnType<typeof setTimeout>>();

const flushPatch = async (id: string) => {
  const body = pendingBody.get(id);
  pendingBody.delete(id);
  if (!body) return;
  try {
    const create = creating.get(id);
    if (create) await create;
    await $fetch(`/api/lists/${id}`, { method: "PATCH", body });
  } catch (e) {
    console.error("[lists] patch failed", e);
  }
};

const queuePatch = (id: string, patch: ListPatch) => {
  pendingBody.set(id, { ...pendingBody.get(id), ...patch });
  clearTimeout(pendingTimer.get(id));
  pendingTimer.set(
    id,
    setTimeout(() => flushPatch(id), 400),
  );
};

export const useLists = () => {
  const { ensureColor } = useTagColors();

  const lists = useState<NestList[]>("lists", () => []);
  const loaded = useState<boolean>("lists:loaded", () => false);

  const load = async () => {
    if (loaded.value) return;
    try {
      lists.value = await $fetch<NestList[]>("/api/lists");
      loaded.value = true;
      for (const tag of new Set(lists.value.flatMap((list) => list.tags ?? []))) ensureColor(tag);
    } catch (e) {
      console.error("[lists] load failed", e);
    }
  };

  const reset = () => {
    lists.value = [];
    loaded.value = false;
  };

  // Featured first, then most recently updated on top within each group.
  const sortedLists = computed(() =>
    [...lists.value].sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    }),
  );

  const allTags = computed(() =>
    [...new Set(lists.value.flatMap((list) => list.tags ?? []))].sort((a, b) => a.localeCompare(b)),
  );

  const getList = (id: string) => lists.value.find((list) => list.id === id);

  // Titles must be unique (case-insensitive, trimmed).
  const titleExists = (title: string, exceptId?: string) => {
    const normalized = title.trim().toLowerCase();
    return lists.value.some(
      (list) => list.id !== exceptId && list.title.trim().toLowerCase() === normalized,
    );
  };

  // Returns null when the title is empty or already taken: an untitled or
  // duplicate list is never persisted.
  const createList = (title: string): NestList | null => {
    const clean = title.trim();
    if (!clean || titleExists(clean)) return null;
    const now = new Date().toISOString();
    const list: NestList = {
      id: crypto.randomUUID(),
      title: clean,
      items: [],
      featured: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    lists.value = [list, ...lists.value];
    creating.set(
      list.id,
      $fetch("/api/lists", { method: "POST", body: list }).catch((e) =>
        console.error("[lists] create failed", e),
      ),
    );
    return list;
  };

  const updateList = (id: string, patch: Partial<Pick<NestList, "title" | "items">>) => {
    const list = getList(id);
    if (!list) return;
    const updatedAt = new Date().toISOString();
    Object.assign(list, patch, { updatedAt });
    queuePatch(id, { ...patch, updatedAt });
  };

  // Append a checklist item at the end of a list (used to restore deleted items).
  const appendItem = (id: string, text: string) => {
    const list = getList(id);
    if (!list) return;
    list.items.push({ id: crypto.randomUUID(), text, checked: false });
    list.updatedAt = new Date().toISOString();
    queuePatch(id, { items: list.items, updatedAt: list.updatedAt });
  };

  // Pinning is not an edit: it must not bump updatedAt.
  const toggleFeatured = (id: string) => {
    const list = getList(id);
    if (!list) return;
    list.featured = !list.featured;
    queuePatch(id, { featured: list.featured });
  };

  const normalizeTag = (tag: string) => tag.trim().toLowerCase().replace(/\s+/g, "");

  // Tagging is classification, not a content edit: it must not bump updatedAt.
  const setTags = (id: string, tags: string[]): string[] => {
    const list = getList(id);
    if (!list) return [];
    const normalized = [...new Set(tags.map(normalizeTag).filter(Boolean))];
    list.tags = normalized;
    normalized.forEach(ensureColor);
    queuePatch(id, { tags: normalized });
    return normalized;
  };

  const removeList = (id: string) => {
    lists.value = lists.value.filter((list) => list.id !== id);
    clearTimeout(pendingTimer.get(id));
    pendingBody.delete(id);
    const del = async () => {
      try {
        const create = creating.get(id);
        if (create) await create;
        await $fetch(`/api/lists/${id}`, { method: "DELETE" });
      } catch (e) {
        console.error("[lists] delete failed", e);
      }
    };
    del();
  };

  return {
    lists,
    sortedLists,
    allTags,
    getList,
    titleExists,
    createList,
    updateList,
    appendItem,
    toggleFeatured,
    setTags,
    removeList,
    load,
    reset,
  };
};
