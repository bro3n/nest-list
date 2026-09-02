<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { requestCode, verify } = useAuth();

const step = ref<"email" | "code">("email");
const email = ref("");
const code = ref("");
const loading = ref(false);
const error = ref("");
// Last 6-digit code auto-submitted, to avoid re-firing the same value.
let lastSubmitted = "";

// Only allow in-app relative redirects (guards against open-redirect via ?redirect=).
const safeRedirect = (): string => {
  const r = route.query.redirect;
  return typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? r : "/";
};

const messageFor = (e: unknown): string => {
  const key = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? "";
  switch (key) {
    case "invalid_email":
    case "invalid_input":
      return t("auth.emailInvalid");
    case "too_many_requests":
      return t("auth.tooManyRequests");
    case "expired":
      return t("auth.expiredCode");
    case "invalid":
    case "too_many_attempts":
      return t("auth.invalidCode");
    default:
      return t("auth.genericError");
  }
};

const onSendCode = async () => {
  error.value = "";
  loading.value = true;
  code.value = "";
  lastSubmitted = "";
  try {
    await requestCode(email.value.trim());
    step.value = "code";
  } catch (e) {
    error.value = messageFor(e);
  } finally {
    loading.value = false;
  }
};

const onVerify = async () => {
  error.value = "";
  loading.value = true;
  try {
    await verify(email.value.trim(), code.value.replace(/\D/g, ""));
    await router.push(safeRedirect());
  } catch (e) {
    error.value = messageFor(e);
  } finally {
    loading.value = false;
  }
};

// Submit as soon as a full 6-digit code is present (manual entry or OTP autofill),
// so there's no need to press the button. Guard against re-firing the same value,
// e.g. after a wrong-code error.
watch(code, (value) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 6 && !loading.value && digits !== lastSubmitted) {
    lastSubmitted = digits;
    onVerify();
  }
});

const backToEmail = () => {
  step.value = "email";
  code.value = "";
  error.value = "";
  lastSubmitted = "";
};
</script>

<template>
  <div class="flex w-full flex-1 items-center justify-center py-8">
    <div class="w-full max-w-sm">
      <h1 class="mb-2 text-center text-2xl font-bold">{{ $t("auth.title") }}</h1>
      <p class="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {{ step === "email" ? $t("auth.subtitle") : $t("auth.checkEmail", { email }) }}
      </p>

      <form v-if="step === 'email'" class="flex flex-col gap-4" @submit.prevent="onSendCode">
        <UFormField :label="$t('auth.emailLabel')" :error="error || undefined">
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            autofocus
            :placeholder="$t('auth.emailPlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UButton type="submit" block size="lg" :loading="loading" :label="$t('auth.sendCode')" />
      </form>

      <form v-else class="flex flex-col gap-4" @submit.prevent="onVerify">
        <UFormField :label="$t('auth.codeLabel')" :error="error || undefined">
          <UInput
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            autofocus
            :placeholder="$t('auth.codePlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UButton type="submit" block size="lg" :loading="loading" :label="$t('auth.verify')" />
        <div class="flex justify-between">
          <UButton
            variant="link"
            color="neutral"
            :label="$t('auth.changeEmail')"
            @click="backToEmail"
          />
          <UButton
            variant="link"
            :disabled="loading"
            :label="$t('auth.resend')"
            @click="onSendCode"
          />
        </div>
      </form>
    </div>
  </div>
</template>
