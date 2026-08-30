<script setup lang="ts">
const { invitations, load, accept, decline } = useInvitations();
const busy = ref<string | null>(null);

onMounted(() => load(true));

const run = async (id: string, fn: (id: string) => Promise<void>) => {
  busy.value = id;
  try {
    await fn(id);
  } finally {
    busy.value = null;
  }
};
</script>

<template>
  <div class="w-full py-8">
    <h1 class="mb-6 text-2xl font-bold">{{ $t("invitations.heading") }}</h1>

    <p v-if="!invitations.length" class="text-slate-500 dark:text-slate-400">
      {{ $t("invitations.empty") }}
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="inv in invitations"
        :key="inv.id"
        class="flex items-center justify-between gap-3 rounded-lg border border-slate-400 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="min-w-0">
          <p class="truncate font-medium">{{ inv.listTitle }}</p>
          <p class="truncate text-xs text-slate-500 dark:text-slate-400">
            {{ $t("invitations.from", { email: inv.inviterEmail }) }} ·
            {{ $t(`share.role.${inv.role}`) }}
          </p>
        </div>
        <div class="flex shrink-0 gap-2">
          <UButton
            size="sm"
            :loading="busy === inv.id"
            :label="$t('invitations.accept')"
            @click="run(inv.id, accept)"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            :disabled="busy === inv.id"
            :label="$t('invitations.decline')"
            @click="run(inv.id, decline)"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
