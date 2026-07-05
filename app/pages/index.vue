<script setup lang="ts">
const { lists, sortedLists, allTags, toggleFeatured } = useLists();
const router = useRouter();

const activeTag = ref<string | null>(null);

const add = () => router.push("/lists/new");

const toggleFilter = (tag: string) => {
  activeTag.value = activeTag.value === tag ? null : tag;
};

const visibleLists = computed(() =>
  activeTag.value
    ? sortedLists.value.filter((list) => list.tags?.includes(activeTag.value as string))
    : sortedLists.value,
);
</script>

<template>
  <div class="w-full py-8">
    <div v-if="allTags.length" class="mb-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-full px-2.5 py-0.5 text-xs font-medium transition"
        :class="
          activeTag === null
            ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
        "
        @click="activeTag = null"
      >
        {{ $t("lists.allTags") }}
      </button>
      <TagChip
        v-for="tag in allTags"
        :key="tag"
        :tag="tag"
        clickable
        :active="activeTag === tag"
        @click="toggleFilter(tag)"
      />
    </div>

    <p v-if="!lists.length" class="text-slate-500 dark:text-slate-400">
      {{ $t("lists.empty") }}
    </p>
    <p v-else-if="!visibleLists.length" class="text-slate-500 dark:text-slate-400">
      {{ $t("lists.noneForTag") }}
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="list in visibleLists"
        :key="list.id"
        class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white pr-3 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      >
        <UButton
          :icon="list.featured ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
          :color="list.featured ? 'warning' : 'neutral'"
          variant="ghost"
          :aria-label="list.featured ? $t('list.unpin') : $t('list.pin')"
          @click="toggleFeatured(list.id)"
        />
        <NuxtLink
          :to="`/lists/${list.id}`"
          class="flex flex-1 items-center justify-between py-3 pr-1"
        >
          <span class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ list.title || $t("list.untitled") }}</span>
            <TagChip v-for="tag in list.tags" :key="tag" :tag="tag" />
          </span>
          <UIcon name="i-heroicons-chevron-right" class="text-slate-400" />
        </NuxtLink>
      </li>
    </ul>

    <UButton
      icon="i-heroicons-plus"
      size="xl"
      :aria-label="$t('lists.add')"
      :ui="{ leadingIcon: 'size-10' }"
      class="fixed right-6 bottom-20 z-40 h-20 w-20 justify-center rounded-full shadow-lg sm:hidden"
      @click="add"
    />
  </div>
</template>
