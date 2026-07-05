<script setup lang="ts">
const props = defineProps<{
  tag: string;
  active?: boolean;
  clickable?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();

const { hueForTag } = useTagColors();
const hue = computed(() => hueForTag(props.tag));
</script>

<template>
  <component
    :is="clickable ? 'button' : 'span'"
    :type="clickable ? 'button' : undefined"
    class="tag-chip"
    :class="{ 'tag-chip--clickable': clickable, 'tag-chip--active': active }"
    :style="{ '--tag-h': hue }"
    @click="clickable && emit('click')"
  >
    {{ tag }}
  </component>
</template>
