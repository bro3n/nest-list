interface TagColorStore {
  seed: number;
  colors: Record<string, number>;
}

// Golden angle: successive hues land far apart around the color wheel,
// so no two tag colors are ever close to each other.
const GOLDEN_ANGLE = 137.508;

let saveTimer: ReturnType<typeof setTimeout> | undefined;

// Per-user colors persisted in D1 (via /api/settings/tag-colors). Colors are
// assigned once per tag and kept stable afterwards; writes are debounced.
export const useTagColors = () => {
  const store = useState<TagColorStore>("tagColors", () => ({ seed: 0, colors: {} }));
  const loaded = useState<boolean>("tagColors:loaded", () => false);

  const load = async () => {
    if (loaded.value) return;
    try {
      store.value = await $fetch<TagColorStore>("/api/settings/tag-colors");
      loaded.value = true;
    } catch (e) {
      console.error("[tagColors] load failed", e);
    }
  };

  const reset = () => {
    store.value = { seed: 0, colors: {} };
    loaded.value = false;
  };

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      $fetch("/api/settings/tag-colors", { method: "PUT", body: store.value }).catch((e) =>
        console.error("[tagColors] save failed", e),
      );
    }, 400);
  };

  // Assign a stable, well-separated hue the first time a tag is seen.
  const ensureColor = (tag: string) => {
    const key = tag.trim();
    if (!key || key in store.value.colors) return;
    const index = Object.keys(store.value.colors).length;
    const hue = Math.round((store.value.seed + index * GOLDEN_ANGLE) % 360);
    store.value.colors = { ...store.value.colors, [key]: hue };
    persist();
  };

  const hueForTag = (tag: string): number => {
    const stored = store.value.colors[tag];
    if (stored !== undefined) return stored;
    // Deterministic fallback so a color always exists, even before assignment.
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) % 360;
    return hash;
  };

  return { ensureColor, hueForTag, load, reset };
};
