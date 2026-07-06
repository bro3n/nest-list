<script setup lang="ts">
import Sortable from "sortablejs";
import type { ChecklistItem } from "~/composables/useLists";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { getList, titleExists, createList, updateList, setTags, removeList, allTags } = useLists();
const { record: recordDeleted } = useDeletedItems();

const routeId = route.params.id as string;
const isNew = routeId === "new";
const initial = isNew ? undefined : getList(routeId);

// null while the list is only a draft (new page, no valid title yet).
const listId = ref<string | null>(isNew ? null : initial ? routeId : null);
// A non-"new" route pointing at an unknown id.
const missing = !isNew && !initial;

const title = ref(initial?.title ?? "");
const items = ref<ChecklistItem[]>((initial?.items ?? []).map((item) => ({ ...item })));
const tags = ref<string[]>([...(initial?.tags ?? [])]);

// Real items = those with text; the trailing empty row is only the "add" line.
const realItems = () => items.value.filter((item) => item.text.trim());

// Keep exactly one empty row at the end: typing in it turns it into a real item
// and a fresh empty row is appended, so there is no explicit "add" button.
const ensureTrailingEmpty = () => {
  const last = items.value[items.value.length - 1];
  if (!last || last.text !== "") {
    items.value.push({ id: crypto.randomUUID(), text: "", checked: false });
  }
};
ensureTrailingEmpty();

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
// Switch is driven by check mode so its lit (colored) state is the default one.
const checkMode = computed({
  get: () => !dragMode.value,
  set: (value) => {
    dragMode.value = !value;
  },
});
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

onMounted(() => {
  if (!listEl.value) return;
  sortable = Sortable.create(listEl.value, {
    handle: ".drag-handle",
    draggable: ".drag-item",
    animation: 150,
    disabled: !dragMode.value,
    // Never let a row cross the trailing empty row.
    onMove: (event) => !event.related?.classList.contains("drag-empty"),
    onEnd: applyDragOrder,
  });
});
onBeforeUnmount(() => sortable?.destroy());

watch(dragMode, (enabled) => sortable?.option("disabled", !enabled));

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
    if (listId.value === null) return;
    const normalized = setTags(listId.value, tags.value);
    if (normalized.join("\n") !== tags.value.join("\n")) tags.value = normalized;
  },
  { deep: true },
);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

const showDeleteConfirm = ref(false);

const onDelete = () => {
  if (listId.value) removeList(listId.value);
  router.push("/");
};
</script>

<template>
  <div class="w-full py-8">
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
        <USwitch
          v-model="checkMode"
          checked-icon="i-heroicons-check"
          unchecked-icon="i-heroicons-arrows-up-down"
          :ui="{ base: 'data-[state=unchecked]:bg-blue-500' }"
          :aria-label="$t('list.dragMode')"
        />
        <UButton
          v-if="listId"
          icon="i-heroicons-archive-box"
          color="neutral"
          variant="ghost"
          :aria-label="$t('nav.trash')"
          @click="router.push(`/lists/${listId}/trash`)"
        >
          <span class="hidden sm:inline">{{ $t("nav.trash") }}</span>
        </UButton>
        <UButton
          v-if="listId"
          icon="i-heroicons-trash"
          color="error"
          variant="ghost"
          :aria-label="$t('list.delete')"
          @click="showDeleteConfirm = true"
        >
          <span class="hidden sm:inline">{{ $t("list.delete") }}</span>
        </UButton>
      </div>
    </div>

    <p v-if="missing" class="text-slate-500 dark:text-slate-400">
      {{ $t("list.notFound") }}
    </p>

    <div v-else class="flex flex-col gap-4">
      <UFormField :label="$t('list.titleLabel')" :error="displayedTitleError || undefined">
        <UInput
          v-model="title"
          :placeholder="$t('list.untitled')"
          class="w-full"
          @blur="commitTitle"
          @keyup.enter="commitTitle"
        />
      </UFormField>

      <UFormField :label="$t('list.itemsLabel')">
        <div ref="listEl" class="flex flex-col gap-2">
          <div
            v-for="item in items"
            :key="item.id"
            :data-id="item.id"
            class="flex items-center gap-2"
            :class="item.text ? 'drag-item' : 'drag-empty'"
          >
            <UButton
              v-if="item.text"
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              :aria-label="$t('list.removeItem')"
              @click="removeItem(item.id)"
            />
            <UInput
              v-model="item.text"
              :placeholder="$t('list.itemPlaceholder')"
              class="flex-1"
              :ui="{ base: item.checked ? 'line-through text-slate-400 dark:text-slate-500' : '' }"
            />
            <span
              v-if="item.text && dragMode"
              class="drag-handle flex cursor-grab touch-none text-slate-400 active:cursor-grabbing"
              :aria-label="$t('list.reorder')"
            >
              <UIcon name="i-heroicons-bars-2" class="size-5" />
            </span>
            <UCheckbox v-if="item.text && !dragMode" v-model="item.checked" size="xl" />
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <UButton
            icon="i-heroicons-check-circle"
            color="info"
            variant="soft"
            :disabled="allChecked"
            :label="$t('list.checkAll')"
            @click="checkAll"
          />
          <UButton
            icon="i-heroicons-trash"
            color="warning"
            variant="soft"
            :disabled="!hasChecked"
            :label="$t('list.clearChecked')"
            @click="clearChecked"
          />
        </div>
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

      <dl v-if="list" class="flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400">
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
  </div>
</template>
