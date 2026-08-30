<script setup lang="ts">
const { t } = useI18n();
const router = useRouter();
const { user, deleteAccount } = useAuth();

const showConfirm = ref(false);
const confirmEmail = ref("");
const deleting = ref(false);
const error = ref("");

// Typing the exact email arms the irreversible delete.
const canDelete = computed(
  () => !!user.value && confirmEmail.value.trim().toLowerCase() === user.value.email.toLowerCase(),
);

const openConfirm = () => {
  error.value = "";
  confirmEmail.value = "";
  showConfirm.value = true;
};

const onDelete = async () => {
  if (!canDelete.value) return;
  error.value = "";
  deleting.value = true;
  try {
    await deleteAccount();
    await router.push("/auth");
  } catch (e) {
    const key = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? "";
    error.value =
      key === "owns_shared_lists" ? t("account.errorSharedLists") : t("account.errorGeneric");
  } finally {
    deleting.value = false;
  }
};
</script>

<template>
  <div class="w-full py-8">
    <h1 class="mb-6 text-2xl font-bold">{{ $t("account.heading") }}</h1>

    <p class="mb-8 text-sm text-slate-500 dark:text-slate-400">
      {{ $t("account.signedInAs", { email: user?.email }) }}
    </p>

    <div class="rounded-lg border border-red-300 p-4 dark:border-red-900/60">
      <h2 class="mb-1 font-medium text-red-600 dark:text-red-400">
        {{ $t("account.dangerZone") }}
      </h2>
      <p class="mb-4 text-sm text-slate-600 dark:text-slate-300">
        {{ $t("account.deleteWarning") }}
      </p>
      <UButton color="error" :label="$t('account.deleteButton')" @click="openConfirm" />
    </div>

    <UModal v-model:open="showConfirm" :title="$t('account.deleteTitle')">
      <template #body>
        <div class="flex flex-col gap-3">
          <p class="text-sm text-slate-600 dark:text-slate-300">
            {{ $t("account.deleteWarning") }}
          </p>
          <UFormField
            :label="$t('account.confirmPrompt', { email: user?.email })"
            :error="error || undefined"
          >
            <UInput
              v-model="confirmEmail"
              :placeholder="user?.email"
              autocomplete="off"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('common.cancel')"
            @click="showConfirm = false"
          />
          <UButton
            color="error"
            :loading="deleting"
            :disabled="!canDelete"
            :label="$t('account.confirmDelete')"
            @click="onDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
