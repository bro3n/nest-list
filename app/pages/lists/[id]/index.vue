<script setup lang="ts">
import Sortable from "sortablejs";
import type { ChecklistItem } from "~/composables/useLists";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const {
  getList,
  titleExists,
  createList,
  updateList,
  setTags,
  removeList,
  allTags,
  hasPendingWrite,
  applyRemote,
  syncFailing,
} = useLists();
const { record: recordDeleted } = useDeletedItems();
const { user } = useAuth();
const { leave } = useSharing();

const routeId = route.params.id as string;
const isNew = routeId === "new";
const initial = isNew ? undefined : getList(routeId);

// null while the list is only a draft (new page, no valid title yet).
const listId = ref<string | null>(isNew ? null : initial ? routeId : null);
// A non-"new" route pointing at an unknown id.
const missing = !isNew && !initial;

// My role on this list drives what the UI allows. A draft is always "owner".
const myRole = computed(() => {
  if (isNew || listId.value === null) return "owner";
  return getList(listId.value)?.role;
});
const canEdit = computed(() => myRole.value === "owner" || myRole.value === "editor");
const isOwner = computed(() => myRole.value === "owner");

// Realtime sync (polling). `editingField` and pending writes gate the merge so a
// remote update never clobbers what the local user is typing.
const editingField = ref<string | null>(null);
const applyingRemote = ref(false);

// Sync is paused when offline or while writes are failing/retrying.
const online = useState<boolean>("net:online", () => true);
const syncPaused = computed(() => !online.value || syncFailing.value);

const title = ref(initial?.title ?? "");
const items = ref<ChecklistItem[]>((initial?.items ?? []).map((item) => ({ ...item })));
const tags = ref<string[]>([...(initial?.tags ?? [])]);

// The last row is always the "add" line (kept empty); every earlier row is a
// real item, which must have content.
const lastIndex = computed(() => items.value.length - 1);
const realItems = () => items.value.filter((item) => item.text.trim());

// The trailing empty "add" row exists only when the user can edit. For a viewer
// there is no add row, so every row is a real item (and keeps its checkbox).
const isAddRow = (index: number) => canEdit.value && index === lastIndex.value;

// Keep exactly one empty row at the end: typing in it turns it into a real item
// and a fresh empty row is appended, so there is no explicit "add" button.
const ensureTrailingEmpty = () => {
  const last = items.value[items.value.length - 1];
  if (!last || last.text !== "") {
    items.value.push({ id: crypto.randomUUID(), text: "", checked: false });
  }
};
if (canEdit.value) ensureTrailingEmpty();

// Enter commits the current item (when it has text) and jumps to the next row,
// creating a fresh empty one if needed — so on mobile you can add items rapidly:
// type, Enter, type, Enter. Without this the trailing row's key reads "Go" / does
// nothing. IME composition (e.g. Chinese) is left to confirm on its own.
const onItemEnter = (index: number, event: KeyboardEvent) => {
  if (event.isComposing) return;
  event.preventDefault();
  if (!canEdit.value) return;
  const item = items.value[index];
  if (!item || !item.text.trim()) return;
  ensureTrailingEmpty();
  const nextInput = () =>
    listEl.value
      ?.querySelectorAll<HTMLElement>(".drag-item, .drag-empty")
      ?.[index + 1]?.querySelector<HTMLInputElement>("input");
  // Focus synchronously when the next row already exists (typing appended it), so
  // the mobile keyboard stays open; otherwise fall back after the DOM updates.
  const next = nextInput();
  if (next) next.focus();
  else nextTick(() => nextInput()?.focus());
};

const removeItem = (itemId: string) => {
  const item = items.value.find((i) => i.id === itemId);
  if (item && listId.value) recordDeleted([item], listId.value, title.value.trim());
  items.value = items.value.filter((i) => i.id !== itemId);
};
const hasChecked = computed(() => items.value.some((item) => item.text.trim() && item.checked));
const clearChecked = () => {
  const removed = items.value.filter((item) => item.text.trim() && item.checked);
  if (listId.value) recordDeleted(removed, listId.value, title.value.trim());
  items.value = items.value.filter((item) => !(item.text.trim() && item.checked));
};
const allChecked = computed(() => {
  const real = realItems();
  return real.length > 0 && real.every((item) => item.checked);
});
const checkAll = () => {
  items.value.forEach((item) => {
    if (item.text.trim()) item.checked = true;
  });
};

// Drag-and-drop reordering (touch + mouse) via SortableJS.
// Off by default: rows show checkboxes; toggling on shows drag handles instead.
const dragMode = ref(false);
const listEl = ref<HTMLElement | null>(null);
let sortable: Sortable | null = null;

// Rebuild the items order from the DOM after a drag, keeping the empty row last.
const applyDragOrder = () => {
  if (!listEl.value) return;
  const ids = Array.from(listEl.value.querySelectorAll<HTMLElement>(".drag-item")).map(
    (el) => el.dataset.id,
  );
  const byId = new Map(items.value.map((item) => [item.id, item]));
  const reordered = ids
    .map((id) => byId.get(id as string))
    .filter((item): item is ChecklistItem => Boolean(item));
  const trailing = items.value.filter((item) => !item.text.trim());
  items.value = [...reordered, ...trailing];
};

const createSortable = () => {
  if (sortable || !listEl.value) return;
  sortable = Sortable.create(listEl.value, {
    handle: ".drag-handle",
    draggable: ".drag-item",
    animation: 150,
    // Never let a row cross the trailing empty row.
    onMove: (event) => !event.related?.classList.contains("drag-empty"),
    onEnd: applyDragOrder,
  });
};
const destroySortable = () => {
  sortable?.destroy();
  sortable = null;
};

// Attach SortableJS only in drag mode: while typing (checkbox mode) it would
// fight Vue's DOM patching and steal focus / close the mobile keyboard.
watch(dragMode, (enabled) => {
  if (enabled) nextTick(createSortable);
  else destroySortable();
});
onBeforeUnmount(destroySortable);

const list = computed(() => (listId.value ? getList(listId.value) : undefined));

// "Required" is only shown once the field has been touched, so a brand-new
// list doesn't greet the user with an error. A duplicate is flagged live.
const titleTouched = ref(false);
const displayedTitleError = computed(() => {
  const clean = title.value.trim();
  if (!clean) return titleTouched.value ? t("list.titleRequired") : "";
  if (titleExists(clean, listId.value ?? undefined)) return t("list.titleDuplicate");
  return "";
});

// Suggestions: every existing tag, plus the ones already on this list.
const tagItems = computed(() => [...new Set([...allTags.value, ...tags.value])]);

// Force the typed query to lowercase and space-free so neither can be entered
// at all (and so autocomplete matches the normalized existing tags).
const tagSearch = ref("");
watch(tagSearch, (value) => {
  const cleaned = value.toLowerCase().replace(/\s+/g, "");
  if (cleaned !== value) tagSearch.value = cleaned;
});

const onCreateTag = (raw: string) => {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized && !tags.value.includes(normalized)) tags.value = [...tags.value, normalized];
  tagSearch.value = "";
};

// Committed when the user leaves the title field (blur or Enter), so a draft
// is created — and the URL switched — only once, not on every keystroke.
// A draft with an empty or duplicate title is never persisted.
const commitTitle = () => {
  if (!canEdit.value) return;
  titleTouched.value = true;
  const clean = title.value.trim();
  if (!clean || titleExists(clean, listId.value ?? undefined)) return;
  if (listId.value === null) {
    const created = createList(clean);
    if (!created) return;
    listId.value = created.id;
    if (realItems().length) updateList(created.id, { items: realItems() });
    if (tags.value.length) tags.value = setTags(created.id, tags.value);
    // Update the address bar silently: a router navigation here would steal
    // focus from the field the user just tabbed into.
    if (import.meta.client) window.history.replaceState(history.state, "", `/lists/${created.id}`);
  } else {
    updateList(listId.value, { title: clean });
  }
};

watch(
  items,
  () => {
    if (applyingRemote.value || !canEdit.value) return;
    ensureTrailingEmpty();
    if (listId.value === null) return;
    updateList(listId.value, { items: realItems() });
  },
  { deep: true },
);

// Tags are classification, persisted separately so they don't bump updatedAt.
watch(
  tags,
  () => {
    if (applyingRemote.value || !canEdit.value || listId.value === null) return;
    const normalized = setTags(listId.value, tags.value);
    if (normalized.join("\n") !== tags.value.join("\n")) tags.value = normalized;
  },
  { deep: true },
);

interface RemoteList {
  id: string;
  title: string;
  items: ChecklistItem[];
  tags: string[];
  updatedAt: string;
  revision: number;
}

// Adaptive cadence: normally every 2s, tightened to 1s for a short window after a
// change from another member — so concurrent editors converge quickly.
const IDLE_MS = 2000;
const ACTIVE_MS = 1000;
const ACTIVE_WINDOW_MS = 8000;
let lastRemoteChangeAt = 0;

// Known revision lives in the store: advanced by our own writes (flush) and by
// merges, so a diff detected here always means a change from someone else.
const knownRev = () => (listId.value ? (getList(listId.value)?.revision ?? 0) : 0);

// Pull a fresh server snapshot into the local editable state (watchers suppressed).
const mergeRemote = (data: RemoteList) => {
  applyingRemote.value = true;
  title.value = data.title;
  items.value = data.items.map((it) => ({ ...it }));
  if (canEdit.value) ensureTrailingEmpty();
  tags.value = [...data.tags];
  applyRemote(data.id, {
    title: data.title,
    items: data.items,
    tags: data.tags,
    updatedAt: data.updatedAt,
    revision: data.revision,
  });
  lastRemoteChangeAt = Date.now();
  nextTick(() => {
    applyingRemote.value = false;
  });
};

// Skip while the user is mid-edit, has an unsent change, or the tab is hidden.
const syncBlocked = () =>
  !listId.value ||
  editingField.value !== null ||
  hasPendingWrite(listId.value) ||
  (typeof document !== "undefined" && document.hidden);

const poll = async () => {
  if (syncBlocked()) return;
  const id = listId.value as string;
  try {
    const data = await $fetch<RemoteList | { unchanged: true; revision: number }>(
      `/api/lists/${id}`,
      { query: { rev: knownRev() } },
    );
    if ("unchanged" in data) return;
    if (syncBlocked() || data.id !== listId.value) return; // re-check after the await
    mergeRemote(data);
  } catch {
    // 404 (deleted / not yet created) or network — retry on the next tick.
  }
};

let pollTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleNext = () => {
  const fast = Date.now() - lastRemoteChangeAt < ACTIVE_WINDOW_MS;
  pollTimer = setTimeout(runPoll, fast ? ACTIVE_MS : IDLE_MS);
};
const runPoll = async () => {
  await poll();
  scheduleNext();
};
onMounted(scheduleNext);
onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer);
});

const onTitleBlur = () => {
  editingField.value = null;
  commitTitle();
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

const showDeleteConfirm = ref(false);
const showShare = ref(false);
const showLeaveConfirm = ref(false);

// Title + tags live in a modal to keep the items front and center. A brand-new
// list opens it straight away so it gets named first. Edits apply live (optimistic),
// so the footer just closes — committing any pending title on the way out.
const showEdit = ref(isNew);
// The modal doubles as "add a list" (create) and "edit details". The mode is
// captured when it opens so labels/dates don't flip mid-click while a new list
// is being created (which would shift the layout and steal the button click).
const editMode = ref(false);
const openEdit = () => {
  if (!canEdit.value) return;
  editMode.value = listId.value !== null;
  showEdit.value = true;
};
const closeEdit = () => {
  commitTitle();
  // Creating with an invalid title: keep the modal open so the error shows.
  if (!editMode.value && listId.value === null) return;
  showEdit.value = false;
};

// Dismissing the create modal (X / backdrop) without naming the list must not
// strand the user on an untitled draft — go back instead of creating nothing.
watch(showEdit, (isOpen) => {
  if (!isOpen && isNew && listId.value === null) {
    if (import.meta.client && window.history.length > 1) router.back();
    else router.push("/");
  }
});

// Delete lives inside the edit modal (owner only): close it, then confirm.
const onEditDelete = () => {
  showEdit.value = false;
  showDeleteConfirm.value = true;
};

const onDelete = () => {
  if (listId.value) removeList(listId.value);
  router.push("/");
};

const onLeave = async () => {
  showLeaveConfirm.value = false;
  if (!listId.value || !user.value) return;
  try {
    await leave(listId.value, user.value.id);
  } catch (e) {
    console.error("[share] leave failed", e);
  }
  router.push("/");
};
</script>

<template>
  <div class="w-full py-8">
    <div v-if="!missing" class="mb-4 flex flex-col gap-2">
      <h1
        class="text-center text-xl font-bold wrap-break-word sm:text-2xl"
        :class="{ 'text-slate-400 dark:text-slate-500': !title.trim() }"
      >
        {{ title.trim() || $t("list.untitled") }}
      </h1>
      <div v-if="tags.length" class="flex flex-wrap justify-center gap-2">
        <TagChip v-for="tag in tags" :key="tag" :tag="tag" />
      </div>
    </div>

    <div class="mb-6 flex items-center justify-between gap-4">
      <UButton
        icon="i-heroicons-arrow-left"
        color="neutral"
        variant="ghost"
        :aria-label="$t('list.back')"
        @click="router.push('/')"
      >
        <span class="hidden sm:inline">{{ $t("list.back") }}</span>
      </UButton>
      <div class="flex items-center gap-2 sm:gap-3">
        <UButton
          v-if="canEdit"
          icon="i-heroicons-pencil-square"
          color="neutral"
          variant="ghost"
          :aria-label="$t('list.editDetails')"
          @click="openEdit"
        >
          <span class="hidden sm:inline">{{ $t("list.edit") }}</span>
        </UButton>
        <UButton
          v-if="listId && canEdit"
          icon="i-heroicons-archive-box"
          color="neutral"
          variant="ghost"
          :aria-label="$t('nav.trash')"
          @click="router.push(`/lists/${listId}/trash`)"
        >
          <span class="hidden sm:inline">{{ $t("nav.trash") }}</span>
        </UButton>
        <UButton
          v-if="listId && isOwner"
          icon="i-heroicons-user-plus"
          color="neutral"
          variant="ghost"
          :aria-label="$t('share.title')"
          @click="showShare = true"
        >
          <span class="hidden sm:inline">{{ $t("share.title") }}</span>
        </UButton>
        <UButton
          v-if="listId && myRole && !isOwner"
          icon="i-heroicons-arrow-left-on-rectangle"
          color="neutral"
          variant="ghost"
          :aria-label="$t('share.leave')"
          @click="showLeaveConfirm = true"
        >
          <span class="hidden sm:inline">{{ $t("share.leave") }}</span>
        </UButton>
      </div>
    </div>

    <p v-if="missing" class="text-slate-500 dark:text-slate-400">
      {{ $t("list.notFound") }}
    </p>

    <div v-else class="flex flex-col gap-4">
      <p
        v-if="syncPaused"
        class="flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      >
        <UIcon name="i-heroicons-cloud" class="size-4 shrink-0" />
        {{ $t("sync.paused") }}
      </p>

      <p v-if="list && !isOwner" class="text-sm text-slate-500 dark:text-slate-400">
        {{ $t("share.sharedBy", { email: list.ownerEmail }) }} · {{ $t(`share.role.${myRole}`) }}
      </p>

      <UFormField>
        <div ref="listEl" class="flex flex-col gap-2">
          <div
            v-for="(item, index) in items"
            :key="item.id"
            :data-id="item.id"
            class="flex items-center gap-2"
            :class="isAddRow(index) ? 'drag-empty' : 'drag-item'"
          >
            <UButton
              v-if="canEdit && !isAddRow(index)"
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              :aria-label="$t('list.removeItem')"
              @click="removeItem(item.id)"
            />
            <UInput
              v-model="item.text"
              :placeholder="isAddRow(index) ? $t('list.itemPlaceholder') : $t('list.itemRequired')"
              :readonly="!canEdit"
              :color="!isAddRow(index) && !item.text.trim() ? 'error' : undefined"
              :highlight="!isAddRow(index) && !item.text.trim()"
              class="item-field flex-1"
              enterkeyhint="next"
              :ui="{ base: item.checked ? 'line-through text-slate-400 dark:text-slate-500' : '' }"
              @focus="editingField = item.id"
              @blur="editingField = null"
              @keydown.enter="onItemEnter(index, $event)"
            />
            <span
              v-if="dragMode && !isAddRow(index)"
              class="drag-handle flex cursor-grab touch-none text-slate-400 active:cursor-grabbing"
              :aria-label="$t('list.reorder')"
            >
              <UIcon name="i-heroicons-bars-2" class="size-5" />
            </span>
            <UCheckbox
              v-show="!isAddRow(index) && !dragMode"
              v-model="item.checked"
              :disabled="!canEdit"
              size="xl"
            />
          </div>
        </div>

        <div v-if="canEdit" class="mt-3 flex flex-wrap gap-2">
          <UButton
            v-if="!dragMode"
            icon="i-heroicons-check-circle"
            color="info"
            variant="soft"
            :disabled="allChecked"
            :label="$t('list.checkAll')"
            @click="checkAll"
          />
          <UButton
            v-if="!dragMode"
            icon="i-heroicons-trash"
            color="warning"
            variant="soft"
            :disabled="!hasChecked"
            :label="$t('list.clearChecked')"
            @click="clearChecked"
          />
          <UButton
            :icon="dragMode ? 'i-heroicons-check' : 'i-heroicons-arrows-up-down'"
            color="neutral"
            :variant="dragMode ? 'solid' : 'soft'"
            :label="dragMode ? $t('common.done') : $t('list.reorderMode')"
            @click="dragMode = !dragMode"
          />
        </div>
      </UFormField>
    </div>

    <UModal v-model:open="showDeleteConfirm" :title="$t('list.deleteConfirmTitle')">
      <template #body>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ $t("list.deleteConfirmMessage") }}
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('common.cancel')"
            @click="showDeleteConfirm = false"
          />
          <UButton color="error" :label="$t('list.delete')" @click="onDelete" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showLeaveConfirm" :title="$t('share.leaveConfirmTitle')">
      <template #body>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ $t("share.leaveConfirmMessage") }}
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('common.cancel')"
            @click="showLeaveConfirm = false"
          />
          <UButton color="error" :label="$t('share.leave')" @click="onLeave" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showEdit"
      :title="editMode ? $t('list.editDetails') : $t('list.addTitle')"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <UFormField :label="$t('list.titleLabel')" :error="displayedTitleError || undefined">
            <UInput
              v-model="title"
              :placeholder="$t('list.untitled')"
              autofocus
              class="w-full"
              @focus="editingField = 'title'"
              @blur="onTitleBlur"
              @keyup.enter="commitTitle"
            />
          </UFormField>

          <UFormField :label="$t('list.tagsLabel')">
            <UInputMenu
              v-model="tags"
              v-model:search-term="tagSearch"
              :items="tagItems"
              multiple
              create-item
              :placeholder="$t('list.tagsPlaceholder')"
              class="w-full"
              @create="onCreateTag"
            />
          </UFormField>

          <dl
            v-if="list && editMode"
            class="flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400"
          >
            <div class="flex gap-2">
              <dt>{{ $t("list.createdAt") }}</dt>
              <dd>{{ formatDate(list.createdAt) }}</dd>
            </div>
            <div class="flex gap-2">
              <dt>{{ $t("list.updatedAt") }}</dt>
              <dd>{{ formatDate(list.updatedAt) }}</dd>
            </div>
          </dl>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full items-center justify-between gap-2">
          <UButton
            v-if="listId && isOwner && editMode"
            icon="i-heroicons-trash"
            color="error"
            variant="ghost"
            :label="$t('list.delete')"
            @click="onEditDelete"
          />
          <UButton
            class="ms-auto"
            :label="editMode ? $t('common.done') : $t('lists.add')"
            @click="closeEdit"
          />
        </div>
      </template>
    </UModal>

    <ShareDialog v-if="listId" v-model:open="showShare" :list-id="listId" />
  </div>
</template>
