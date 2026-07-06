<script setup lang="ts">
const { $pwa } = useNuxtApp();

const reload = () => {
  $pwa?.applyUpdate();
};
</script>

<template>
  <Transition name="fade">
    <div
      v-if="$pwa?.updateAvailable.value"
      class="fixed inset-x-0 bottom-0 z-50 border-t border-slate-400 bg-white px-4 py-3 shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <span class="text-sm">{{ $t("pwa.updateAvailable") }}</span>
        <UButton size="sm" :label="$t('pwa.reload')" @click="reload" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
