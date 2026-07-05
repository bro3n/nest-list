<script setup lang="ts">
interface LocaleOption {
  label: string;
  value: string;
}

defineProps<{
  localeOptions: LocaleOption[];
  currentLocaleOption?: LocaleOption;
  isDark: boolean;
}>();

const emit = defineEmits<{
  updateLocale: [option: LocaleOption];
  toggleDark: [];
}>();

const open = ref(false);

const onUpdateLocale = (option: LocaleOption) => {
  emit("updateLocale", option);
  open.value = false;
};
</script>

<template>
  <div>
    <UButton
      icon="i-heroicons-bars-3"
      color="neutral"
      variant="ghost"
      :aria-label="$t('nav.title')"
      @click="open = true"
    />

    <USlideover v-model:open="open" :title="$t('nav.title')">
      <template #body>
        <div class="flex flex-col gap-4">
          <UButton
            to="/lists/new"
            icon="i-heroicons-plus"
            block
            :label="$t('lists.add')"
            @click="open = false"
          />

          <USelectMenu
            :model-value="currentLocaleOption"
            :items="localeOptions"
            :search-input="false"
            class="w-full"
            @update:model-value="onUpdateLocale"
          />

          <UButton
            :icon="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
            color="neutral"
            variant="soft"
            block
            :label="isDark ? $t('common.lightMode') : $t('common.darkMode')"
            @click="emit('toggleDark')"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>
