<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: "horizontal" | "stacked";
    size?: number;
    /** Show the slate app tile behind the mark. When false, the mark sits on the
     * surrounding background (transparent) and the checkmark uses currentColor. */
    tile?: boolean;
  }>(),
  { variant: "horizontal", size: 30, tile: true },
);

// Unique gradient id so multiple instances on a page never collide.
const gid = useId();

// With the tile, pad the mark inside it; without, crop tight to the ink so the
// glyph keeps a comparable visual weight.
const viewBox = computed(() => (props.tile ? "0 0 100 100" : "18 20 64 64"));
const markTransform = computed(() => (props.tile ? "translate(18 18) scale(0.64)" : null));
const checkStroke = computed(() => (props.tile ? "#f3e9d6" : "currentColor"));
</script>

<template>
  <span
    class="app-logo inline-flex select-none items-center"
    :class="variant === 'stacked' ? 'flex-col gap-1.5' : 'gap-2.5'"
  >
    <svg
      :viewBox="viewBox"
      aria-hidden="true"
      class="shrink-0"
      :style="{ width: `${size}px`, height: `${size}px` }"
    >
      <defs v-if="tile">
        <radialGradient :id="gid" cx="30%" cy="20%" r="120%">
          <stop offset="0" stop-color="#24344a" />
          <stop offset="0.46" stop-color="#1e293b" />
          <stop offset="1" stop-color="#14202f" />
        </radialGradient>
      </defs>
      <rect v-if="tile" width="100" height="100" rx="24" :fill="`url(#${gid})`" />
      <g :transform="markTransform" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 48 C24 66 40 76 50 76 C60 76 76 66 76 48" stroke="#e0a45a" stroke-width="8" />
        <path d="M37 45 L47 57 L67 29" :stroke="checkStroke" stroke-width="8" />
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
