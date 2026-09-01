<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "horizontal" | "stacked";
    size?: number;
  }>(),
  { variant: "horizontal", size: 30 },
);

// Unique gradient id so multiple instances on a page never collide.
const gid = useId();
</script>

<template>
  <span
    class="app-logo inline-flex select-none items-center"
    :class="variant === 'stacked' ? 'flex-col gap-1.5' : 'gap-2.5'"
  >
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      class="shrink-0"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <defs>
        <radialGradient :id="gid" cx="30%" cy="20%" r="120%">
          <stop offset="0" stop-color="#24344a" />
          <stop offset="0.46" stop-color="#1e293b" />
          <stop offset="1" stop-color="#14202f" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="24" :fill="`url(#${gid})`" />
      <g
        transform="translate(18 18) scale(0.64)"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M24 48 C24 66 40 76 50 76 C60 76 76 66 76 48" stroke="#e0a45a" stroke-width="8" />
        <path d="M37 45 L47 57 L67 29" stroke="#f3e9d6" stroke-width="8" />
      </g>
    </svg>

    <span class="wordmark text-lg leading-none tracking-tight">
      <span class="font-semibold">Nest</span>
      <span class="italic text-[#b8721f] dark:text-[#e0a45a]">List</span>
    </span>
  </span>
</template>

<style scoped>
.wordmark {
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
}
</style>
