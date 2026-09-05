const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
};

// Caps on list content — generous for real use, but they bound what an
// authenticated editor can store. Enforced server-side (the real boundary);
// the client mirrors them with maxlength so a legitimate user never hits them.
export const LIMITS = {
  lists: 200,
  title: 50,
  items: 200,
  itemText: 100,
  tags: 10,
  tagLen: 20,
  itemId: 36, // a UUID v4 is exactly 36 chars
} as const;

// Validates the size/shape of a list write (create or patch). Only checks the
// fields that are present. Returns an error key, or null when everything fits.
export const validateListInput = (input: {
  title?: unknown;
  items?: unknown;
  tags?: unknown;
}): string | null => {
  if (typeof input.title === "string" && input.title.trim().length > LIMITS.title) {
    return "title_too_long";
  }
  if (Array.isArray(input.items)) {
    if (input.items.length > LIMITS.items) return "too_many_items";
    for (const it of input.items) {
      const id = (it as { id?: unknown })?.id;
      const text = (it as { text?: unknown })?.text;
      if (typeof id !== "string" || id.length > LIMITS.itemId) return "invalid_item";
      if (typeof text !== "string" || text.length > LIMITS.itemText) return "invalid_item";
    }
  }
  if (Array.isArray(input.tags)) {
    if (input.tags.length > LIMITS.tags) return "too_many_tags";
    for (const t of input.tags) {
      if (typeof t !== "string" || t.length > LIMITS.tagLen) return "invalid_tag";
    }
  }
  return null;
};

export type Locale = "fr" | "en" | "es" | "zh";
const LOCALES: Locale[] = ["fr", "en", "es", "zh"];

// Emails are localized to the sender's app language. Fall back to English when the
// client sends nothing recognizable (e.g. an older cached build).
export const normalizeLocale = (raw: unknown): Locale =>
  typeof raw === "string" && (LOCALES as string[]).includes(raw) ? (raw as Locale) : "en";
