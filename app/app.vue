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

const router = useRouter();
const { isAuthenticated, logout } = useAuth();
const { count: invitationCount } = useInvitations();
const onLogout = async () => {
  await logout();
  await router.push("/auth");
};

useHead({
  title: appConfig.title,
});
</script>

<template>
  <div
    class="flex min-h-dvh flex-col bg-slate-200 text-slate-900 dark:bg-slate-950 dark:text-white"
  >
    <header class="border-b border-slate-400 dark:border-slate-800">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <NuxtLink to="/" :aria-label="$t('nav.title')" class="shrink-0">
          <AppLogo />
        </NuxtLink>

        <nav class="hidden items-center gap-3 sm:flex">
          <UButton
            v-if="isAuthenticated"
            to="/lists/new"
            icon="i-heroicons-plus"
            size="sm"
            :label="$t('lists.add')"
          />

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

          <UChip
            v-if="isAuthenticated"
            :text="invitationCount"
            :show="invitationCount > 0"
            color="error"
            size="2xl"
          >
            <UButton
              to="/invitations"
              icon="i-heroicons-inbox"
              color="neutral"
              variant="ghost"
              :aria-label="$t('invitations.heading')"
            />
          </UChip>

          <UButton
            v-if="isAuthenticated"
            to="/account"
            icon="i-heroicons-user-circle"
            color="neutral"
            variant="ghost"
            :aria-label="$t('account.heading')"
          />

          <UButton
            v-if="isAuthenticated"
            icon="i-heroicons-arrow-right-on-rectangle"
            color="neutral"
            variant="ghost"
            :aria-label="$t('auth.logout')"
            @click="onLogout"
          />
        </nav>

        <MobileMenu
          :locale-options="localeOptions"
          :current-locale-option="currentLocaleOption"
          :is-dark="isDark"
          :is-authenticated="isAuthenticated"
          class="sm:hidden"
          @update-locale="updateLocale"
          @toggle-dark="toggleDark"
          @logout="onLogout"
        />
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4">
      <NuxtPage />
    </main>

    <footer class="mt-auto border-t border-slate-400 dark:border-slate-800">
      <div
        class="mx-auto w-full max-w-5xl px-4 py-2.5 text-center text-xs text-slate-500 sm:py-4 sm:text-sm"
      >
        {{ $t("footer.copyright", { year }) }}
      </div>
    </footer>

    <PwaUpdateBanner />
  </div>
</template>
