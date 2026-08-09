const encoder = new TextEncoder();

const base64Url = (buf: Uint8Array): string => {
  let bin = "";
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Opaque, URL-safe session token. Only its HMAC is ever stored.
export const randomToken = (bytes = 32): string => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64Url(buf);
};

// 6-digit numeric code, zero-padded. Modulo bias is negligible for a short-lived OTP.
export const randomOtp = (): string => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = (buf[0] ?? 0) % 1_000_000;
  return n.toString().padStart(6, "0");
};

// HMAC-SHA256(value, secret) as hex — used so a DB leak never exposes raw codes/tokens.
export const hmac = async (value: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

// Constant-time comparison of two equal-length hex digests.
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
};
