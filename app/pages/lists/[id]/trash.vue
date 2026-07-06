<script setup lang="ts">
import type { DeletedItem } from "~/composables/useDeletedItems";

const route = useRoute();
const router = useRouter();
const { locale } = useI18n();
const { sorted, remove } = useDeletedItems();
const { getList, appendItem } = useLists();

const id = route.params.id as string;
const list = computed(() => getList(id));
const entries = computed(() => sorted.value.filter((entry) => entry.listId === id));

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

const restore = (entry: DeletedItem) => {
  appendItem(id, entry.text);
  remove(entry.id);
};
</script>

<template>
  <div class="w-full py-8">
    <div class="mb-6">
      <UButton
        icon="i-heroicons-arrow-left"
        color="neutral"
        variant="ghost"
        :label="$t('list.back')"
        @click="router.push(`/lists/${id}`)"
      />
    </div>

    <p v-if="!list" class="text-slate-500 dark:text-slate-400">
      {{ $t("list.notFound") }}
    </p>

    <template v-else>
      <h1 class="mb-6 text-2xl font-bold">{{ $t("trash.heading") }}</h1>

      <p v-if="!entries.length" class="text-slate-500 dark:text-slate-400">
        {{ $t("trash.empty") }}
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="entry in entries"
          :key="entry.id"
          class="flex items-center justify-between gap-3 rounded-lg border border-slate-400 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <div class="min-w-0">
            <p class="truncate font-medium">{{ entry.text }}</p>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">
              {{ formatDate(entry.deletedAt) }}
            </p>
          </div>

          <UButton
            icon="i-heroicons-arrow-uturn-left"
            size="sm"
            variant="soft"
            :label="$t('trash.restore')"
            @click="restore(entry)"
          />
        </li>
      </ul>
    </template>
  </div>
</template>
