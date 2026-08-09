import type { H3Event } from "h3";

// Sends the OTP via Resend. Without a real API key (dev / placeholder) the send
// is skipped and the code is logged to the server console so the flow stays testable.
export const sendOtpEmail = async (event: H3Event, email: string, code: string): Promise<void> => {
  const { RESEND_API_KEY, EMAIL_FROM } = useCfEnv(event);
  const hasRealKey = !!RESEND_API_KEY && !RESEND_API_KEY.startsWith("re_dev");

  if (import.meta.dev || !hasRealKey) {
    console.info(`[auth] OTP for ${email}: ${code}`);
  }
  if (!hasRealKey) return;

  if (!EMAIL_FROM) {
    console.error("[auth] EMAIL_FROM is not set — refusing to fall back to the Resend sandbox sender");
    throw createError({ statusCode: 500, statusMessage: "email_from_missing" });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: email,
      subject: `Nest List — ${code}`,
      text: `Your Nest List sign-in code is ${code}. It expires in 10 minutes.`,
    }),
  });

  if (!res.ok) {
    // Nitro hides 5xx detail from the HTTP response, so log the Resend reason server-side.
    console.error(`[auth] Resend send failed (${res.status}): ${await res.text()}`);
    throw createError({ statusCode: 502, statusMessage: "email_send_failed" });
  }
};
