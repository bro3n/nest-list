const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
};

export type Locale = "fr" | "en" | "es" | "zh";
const LOCALES: Locale[] = ["fr", "en", "es", "zh"];

// Emails are localized to the sender's app language. Fall back to English when the
// client sends nothing recognizable (e.g. an older cached build).
export const normalizeLocale = (raw: unknown): Locale =>
  typeof raw === "string" && (LOCALES as string[]).includes(raw) ? (raw as Locale) : "en";
