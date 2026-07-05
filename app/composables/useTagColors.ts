interface TagColorStore {
  seed: number;
  colors: Record<string, number>;
}

const STORAGE_KEY = "nest-list:tag-colors";
// Golden angle: successive hues land far apart around the color wheel,
// so no two tag colors are ever close to each other.
const GOLDEN_ANGLE = 137.508;

// Interim persistence in localStorage, alongside useLists. Colors are assigned
// once per tag and kept stable afterwards.
export const useTagColors = () => {
  const store = useState<TagColorStore>("tagColors", () => {
    if (!import.meta.client) return { seed: 0, colors: {} };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as TagColorStore;
      } catch {
        // fall through to a fresh store
      }
    }
    // Random starting offset so the first tag's color varies between users.
    return { seed: Math.random() * 360, colors: {} };
  });

  const persist = () => {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.value));
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

  return { ensureColor, hueForTag };
};
