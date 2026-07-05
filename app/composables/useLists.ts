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

// Shape as stored on disk, tolerant of the pre-checklist format (content string).
type StoredList = Partial<NestList> & { content?: string };

const STORAGE_KEY = "nest-list:lists";

// Migrate a stored list to the current shape: a plain-text content is turned
// into one checklist item per non-empty line.
const migrateList = (raw: StoredList): NestList => {
  const items: ChecklistItem[] = Array.isArray(raw.items)
    ? raw.items
    : typeof raw.content === "string"
      ? raw.content
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((text) => ({ id: crypto.randomUUID(), text, checked: false }))
      : [];
  return {
    id: raw.id as string,
    title: raw.title ?? "",
    items,
    featured: !!raw.featured,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createdAt: raw.createdAt as string,
    updatedAt: raw.updatedAt as string,
  };
};

// Runs once per client session: backfill colors for tags created before the
// color feature (or restored from storage).
let tagColorsInitialized = false;

// Interim persistence in localStorage. To be replaced by Turso sync later:
// only the read/write internals of this composable should need to change.
export const useLists = () => {
  const { ensureColor } = useTagColors();

  const lists = useState<NestList[]>("lists", () => {
    if (!import.meta.client) return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return (JSON.parse(raw) as StoredList[]).map(migrateList);
    } catch {
      return [];
    }
  });

  const persist = () => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists.value));
  };

  if (import.meta.client && !tagColorsInitialized) {
    tagColorsInitialized = true;
    for (const tag of new Set(lists.value.flatMap((list) => list.tags ?? []))) ensureColor(tag);
  }

  // Featured first, then most recently updated on top within each group.
  const sortedLists = computed(() =>
    [...lists.value].sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    }),
  );

  // All tags used across lists, deduped and alphabetically sorted.
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
    persist();
    return list;
  };

  const updateList = (id: string, patch: Partial<Pick<NestList, "title" | "items">>) => {
    const list = getList(id);
    if (!list) return;
    Object.assign(list, patch, { updatedAt: new Date().toISOString() });
    persist();
  };

  // Append a checklist item at the end of a list (used to restore deleted items).
  const appendItem = (id: string, text: string) => {
    const list = getList(id);
    if (!list) return;
    list.items.push({ id: crypto.randomUUID(), text, checked: false });
    list.updatedAt = new Date().toISOString();
    persist();
  };

  // Pinning is not an edit: it must not bump updatedAt.
  const toggleFeatured = (id: string) => {
    const list = getList(id);
    if (!list) return;
    list.featured = !list.featured;
    persist();
  };

  // Tags are always lowercase and space-free.
  const normalizeTag = (tag: string) => tag.trim().toLowerCase().replace(/\s+/g, "");

  // Tagging is classification, not a content edit: it must not bump updatedAt.
  // Returns the normalized tags so callers can reflect them in the UI.
  const setTags = (id: string, tags: string[]): string[] => {
    const list = getList(id);
    if (!list) return [];
    const normalized = [...new Set(tags.map(normalizeTag).filter(Boolean))];
    list.tags = normalized;
    normalized.forEach(ensureColor);
    persist();
    return normalized;
  };

  const removeList = (id: string) => {
    lists.value = lists.value.filter((list) => list.id !== id);
    persist();
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
  };
};
