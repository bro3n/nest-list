<script setup lang="ts">
import type { ShareMember, ShareInvitation } from "~/composables/useSharing";

const props = defineProps<{ listId: string }>();
const open = defineModel<boolean>("open", { required: true });

const { t, locale } = useI18n();
const { getShares, invite, setRole, removeMember, revokeInvite, transfer } = useSharing();
const { refresh: refreshLists } = useLists();

type Role = "editor" | "viewer";

const members = ref<ShareMember[]>([]);
const invitations = ref<ShareInvitation[]>([]);
const email = ref("");
const role = ref<Role>("editor");
const loading = ref(false);
const error = ref("");

const transferTarget = ref<ShareMember | null>(null);
const showTransferConfirm = ref(false);
const transferring = ref(false);

const refresh = async () => {
  try {
    const r = await getShares(props.listId);
    members.value = r.members;
    invitations.value = r.invitations;
  } catch (e) {
    console.error("[share] load failed", e);
  }
};

watch(open, (isOpen) => {
  if (isOpen) {
    error.value = "";
    email.value = "";
    refresh();
  }
});

const messageFor = (e: unknown): string => {
  const key = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? "";
  switch (key) {
    case "invalid_email":
      return t("share.errorEmail");
    case "cannot_invite_self":
      return t("share.errorSelf");
    case "already_member":
      return t("share.errorMember");
    default:
      return t("share.errorGeneric");
  }
};

const onInvite = async () => {
  error.value = "";
  if (!email.value.trim()) return;
  loading.value = true;
  try {
    await invite(props.listId, email.value.trim(), role.value, locale.value);
    email.value = "";
    await refresh();
  } catch (e) {
    error.value = messageFor(e);
  } finally {
    loading.value = false;
  }
};

const onSetRole = async (userId: string, r: Role) => {
  await setRole(props.listId, userId, r);
  await refresh();
};
const onRemove = async (userId: string) => {
  await removeMember(props.listId, userId);
  await refresh();
};
const onRevoke = async (invitationId: string) => {
  await revokeInvite(props.listId, invitationId);
  await refresh();
};

const onMakeOwner = (m: ShareMember) => {
  transferTarget.value = m;
  showTransferConfirm.value = true;
};
const onConfirmTransfer = async () => {
  if (!transferTarget.value) return;
  transferring.value = true;
  try {
    await transfer(props.listId, transferTarget.value.userId);
    showTransferConfirm.value = false;
    open.value = false; // the current user is no longer the owner
    await refreshLists();
  } catch (e) {
    console.error("[share] transfer failed", e);
  } finally {
    transferring.value = false;
  }
};
</script>

<template>
  <UModal v-model:open="open" :title="$t('share.title')">
    <template #body>
      <div class="flex flex-col gap-5">
        <!-- Invite -->
        <form class="flex flex-col gap-2" @submit.prevent="onInvite">
          <UFormField :label="$t('share.inviteLabel')" :error="error || undefined">
            <div class="flex flex-col gap-2 sm:flex-row">
              <UInput
                v-model="email"
                type="email"
                autocomplete="off"
                :placeholder="$t('share.emailPlaceholder')"
                class="flex-1"
              />
              <div class="flex gap-1">
                <UButton
                  size="sm"
                  color="neutral"
                  :variant="role === 'editor' ? 'solid' : 'soft'"
                  :label="$t('share.role.editor')"
                  @click="role = 'editor'"
                />
                <UButton
                  size="sm"
                  color="neutral"
                  :variant="role === 'viewer' ? 'solid' : 'soft'"
                  :label="$t('share.role.viewer')"
                  @click="role = 'viewer'"
                />
              </div>
            </div>
          </UFormField>
          <UButton
            type="submit"
            block
            :loading="loading"
            icon="i-heroicons-paper-airplane"
            :label="$t('share.invite')"
          />
        </form>

        <!-- Members -->
        <div v-if="members.length" class="flex flex-col gap-3">
          <p class="text-sm font-medium">{{ $t("share.members") }}</p>
          <div v-for="m in members" :key="m.userId" class="flex flex-col gap-2">
            <div
              class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
            >
              <span class="min-w-0 truncate text-sm sm:flex-1">{{ m.email }}</span>
              <div class="flex shrink-0 items-center gap-1">
                <UButton
                  size="xs"
                  color="neutral"
                  :variant="m.role === 'editor' ? 'solid' : 'soft'"
                  :label="$t('share.role.editor')"
                  @click="onSetRole(m.userId, 'editor')"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  :variant="m.role === 'viewer' ? 'solid' : 'soft'"
                  :label="$t('share.role.viewer')"
                  @click="onSetRole(m.userId, 'viewer')"
                />
              </div>
            </div>
            <div class="flex flex-wrap gap-1 sm:justify-end">
              <UButton
                size="xs"
                icon="i-heroicons-arrow-up-circle"
                color="neutral"
                variant="ghost"
                :label="$t('share.makeOwner')"
                @click="onMakeOwner(m)"
              />
              <UButton
                size="xs"
                icon="i-heroicons-x-mark"
                color="error"
                variant="ghost"
                :label="$t('share.remove')"
                @click="onRemove(m.userId)"
              />
            </div>
          </div>
        </div>

        <!-- Pending invitations -->
        <div v-if="invitations.length" class="flex flex-col gap-2">
          <p class="text-sm font-medium">{{ $t("share.pending") }}</p>
          <div
            v-for="inv in invitations"
            :key="inv.id"
            class="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
          >
            <span class="min-w-0 truncate text-sm text-slate-500 sm:flex-1 dark:text-slate-400">
              {{ inv.email }} · {{ $t(`share.role.${inv.role}`) }}
            </span>
            <UButton
              size="xs"
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              class="self-start sm:self-auto"
              :label="$t('share.revoke')"
              @click="onRevoke(inv.id)"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>

  <UModal v-model:open="showTransferConfirm" :title="$t('share.transferTitle')">
    <template #body>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        {{ $t("share.transferMessage", { email: transferTarget?.email }) }}
      </p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :label="$t('common.cancel')"
          @click="showTransferConfirm = false"
        />
        <UButton
          :loading="transferring"
          :label="$t('share.makeOwner')"
          @click="onConfirmTransfer"
        />
      </div>
    </template>
  </UModal>
</template>
