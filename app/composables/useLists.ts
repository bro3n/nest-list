export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export type ListRole = "owner" | "editor" | "viewer";

export interface NestList {
  id: string;
  title: string;
  items: ChecklistItem[];
  featured: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // Present on lists loaded from the server: my role, the owner's email, the
  // change counter used to detect other members' edits while polling, and whether
  // the list is shared (has another member or a pending invitation).
  role?: ListRole;
  ownerEmail?: string;
  revision?: number;
  shared?: boolean;
}

type ListPatch = Partial<Pick<NestList, "title" | "items" | "tags">> & {
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
const retryCount = new Map<string, number>();
const inFlight = new Set<string>();

// Module-level handle to the shared list state, so the debounced flush (which
// runs outside a Nuxt context) can advance a list's known revision after a write.
let listsState: { value: NestList[] } | null = null;

// Reactive: true while one or more writes are failing and being retried.
const syncFailing = ref(false);

// Statuses that mean the write will never succeed — drop it instead of retrying.
const PERMANENT = new Set([400, 401, 403, 404, 409, 422]);

let onlineHooked = false;
const hookOnline = () => {
  if (onlineHooked || typeof window === "undefined") return;
  onlineHooked = true;
  window.addEventListener("online", () => {
    for (const id of [...pendingBody.keys()]) {
      retryCount.delete(id);
      clearTimeout(pendingTimer.get(id));
      pendingTimer.delete(id);
      flushPatch(id);
    }
  });
};

// A queued change stays in `pendingBody` until it is actually accepted by the
// server, so a failed write is retried (never silently lost) and the realtime
// poll stays blocked on that list until it lands (never clobbering it).
const hasPendingWrite = (id: string) => pendingBody.has(id);

const flushPatch = async (id: string) => {
  if (inFlight.has(id)) {
    // A flush is already running; try again shortly with whatever is queued then.
    clearTimeout(pendingTimer.get(id));
    pendingTimer.set(
      id,
      setTimeout(() => flushPatch(id), 400),
    );
    return;
  }
  pendingTimer.delete(id);
  const body = pendingBody.get(id);
  if (!body) return;
  inFlight.add(id);
  try {
    const create = creating.get(id);
    if (create) await create;
    const res = await $fetch<{ revision?: number }>(`/api/lists/${id}`, { method: "PATCH", body });
    if (pendingBody.get(id) === body) pendingBody.delete(id); // nothing newer queued
    retryCount.delete(id);
    // Advance the known revision so the poll doesn't treat our own write as remote.
    if (res?.revision != null && listsState) {
      const l = listsState.value.find((x) => x.id === id);
      if (l) l.revision = res.revision;
    }
  } catch (e) {
    const status =
      (e as { statusCode?: number; response?: { status?: number } }).statusCode ??
      (e as { response?: { status?: number } }).response?.status;
    if (status && PERMANENT.has(status)) {
      // Rejected for good — drop it and let the next poll reconcile local state.
      if (pendingBody.get(id) === body) pendingBody.delete(id);
      retryCount.delete(id);
      console.error("[lists] patch rejected", status);
    } else {
      // Transient (offline / 5xx / timeout) — keep it and retry with backoff.
      const n = (retryCount.get(id) ?? 0) + 1;
      retryCount.set(id, n);
      clearTimeout(pendingTimer.get(id));
      pendingTimer.set(
        id,
        setTimeout(() => flushPatch(id), Math.min(1000 * 2 ** (n - 1), 30000)),
      );
      console.error("[lists] patch failed, will retry", e);
    }
  } finally {
    inFlight.delete(id);
    syncFailing.value = retryCount.size > 0;
  }
};

const queuePatch = (id: string, patch: ListPatch) => {
  pendingBody.set(id, { ...pendingBody.get(id), ...patch });
  retryCount.delete(id); // a fresh user edit resets the backoff
  syncFailing.value = retryCount.size > 0;
  clearTimeout(pendingTimer.get(id));
  pendingTimer.set(
    id,
    setTimeout(() => flushPatch(id), 400),
  );
  hookOnline();
};

export const useLists = () => {
  const { ensureColor } = useTagColors();

  const lists = useState<NestList[]>("lists", () => []);
  const loaded = useState<boolean>("lists:loaded", () => false);
  listsState = lists;

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

  const refresh = async () => {
    loaded.value = false;
    await load();
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
      role: "owner",
      revision: 0,
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

  // Pinning is per-user (list_pins) and not a content edit: it never bumps
  // updatedAt and goes through its own endpoint rather than a list PATCH.
  const toggleFeatured = async (id: string) => {
    const list = getList(id);
    if (!list) return;
    list.featured = !list.featured;
    const method = list.featured ? "PUT" : "DELETE";
    try {
      const create = creating.get(id);
      if (create) await create;
      await $fetch(`/api/lists/${id}/pin`, { method });
    } catch (e) {
      console.error("[lists] pin failed", e);
    }
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
    pendingTimer.delete(id);
    pendingBody.delete(id);
    retryCount.delete(id);
    syncFailing.value = retryCount.size > 0;
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

  // Applies a fresh server snapshot to the stored list (realtime poll) without
  // triggering any write-back.
  const applyRemote = (
    id: string,
    snap: {
      title: string;
      items: ChecklistItem[];
      tags: string[];
      updatedAt: string;
      revision: number;
    },
  ) => {
    const list = getList(id);
    if (!list) return;
    list.title = snap.title;
    list.items = snap.items;
    list.tags = snap.tags;
    list.updatedAt = snap.updatedAt;
    list.revision = snap.revision;
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
    refresh,
    reset,
    hasPendingWrite,
    applyRemote,
    syncFailing,
  };
};
