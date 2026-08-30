<script setup lang="ts">
import type { ShareMember, ShareInvitation } from "~/composables/useSharing";

const props = defineProps<{ listId: string }>();
const open = defineModel<boolean>("open", { required: true });

const { t } = useI18n();
const { getShares, invite, setRole, removeMember, revokeInvite } = useSharing();

type Role = "editor" | "viewer";

const members = ref<ShareMember[]>([]);
const invitations = ref<ShareInvitation[]>([]);
const email = ref("");
const role = ref<Role>("editor");
const loading = ref(false);
const error = ref("");

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
    await invite(props.listId, email.value.trim(), role.value);
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
        <div v-if="members.length" class="flex flex-col gap-2">
          <p class="text-sm font-medium">{{ $t("share.members") }}</p>
          <div v-for="m in members" :key="m.userId" class="flex items-center justify-between gap-2">
            <span class="min-w-0 flex-1 truncate text-sm">{{ m.email }}</span>
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
              <UButton
                size="xs"
                icon="i-heroicons-x-mark"
                color="error"
                variant="ghost"
                :aria-label="$t('share.remove')"
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
            class="flex items-center justify-between gap-2"
          >
            <span class="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
              {{ inv.email }} · {{ $t(`share.role.${inv.role}`) }}
            </span>
            <UButton
              size="xs"
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              :aria-label="$t('share.revoke')"
              @click="onRevoke(inv.id)"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
