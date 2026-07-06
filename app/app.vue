<script setup lang="ts">
const appConfig = useAppConfig();
const { locale, locales, setLocale } = useI18n();

const flagMap: Record<string, string> = { fr: "🇫🇷", en: "🇬🇧", es: "🇪🇸", zh: "🇨🇳" };

const localeOptions = computed(() =>
  locales.value.map((l) => {
    const code = typeof l === "string" ? l : l.code;
    const name = typeof l === "string" ? l : l.name || l.code;
    return { label: `${flagMap[code]} ${name}`, value: code };
  }),
);
const currentLocaleOption = computed(() =>
  localeOptions.value.find((opt) => opt.value === locale.value),
);
const updateLocale = (option: { value: string }) => {
  setLocale(option.value as typeof locale.value);
};

const year = new Date().getFullYear();

const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === "dark");
const toggleDark = () => {
  colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
};

useHead({
  title: appConfig.title,
});
</script>

<template>
  <div
    class="flex min-h-screen flex-col bg-slate-200 text-slate-900 dark:bg-slate-950 dark:text-white"
  >
    <header class="border-b border-slate-400 dark:border-slate-800">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <NuxtLink to="/" class="text-lg font-bold">
          {{ $t("nav.title") }}
        </NuxtLink>

        <nav class="hidden items-center gap-3 sm:flex">
          <UButton to="/lists/new" icon="i-heroicons-plus" size="sm" :label="$t('lists.add')" />

          <USelectMenu
            :model-value="currentLocaleOption"
            :items="localeOptions"
            :search-input="false"
            class="w-40"
            @update:model-value="updateLocale"
          />

          <UButton
            :icon="isDark ? 'i-heroicons-sun' : 'i-heroicons-moon'"
            color="neutral"
            variant="ghost"
            :aria-label="isDark ? $t('common.lightMode') : $t('common.darkMode')"
            @click="toggleDark"
          />
        </nav>

        <MobileMenu
          :locale-options="localeOptions"
          :current-locale-option="currentLocaleOption"
          :is-dark="isDark"
          class="sm:hidden"
          @update-locale="updateLocale"
          @toggle-dark="toggleDark"
        />
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4">
      <NuxtPage />
    </main>

    <footer class="mt-auto border-t border-slate-400 dark:border-slate-800">
      <div class="mx-auto w-full max-w-5xl px-4 py-4 text-center text-sm text-slate-500">
        {{ $t("footer.copyright", { year }) }}
      </div>
    </footer>

    <PwaUpdateBanner />
  </div>
</template>
