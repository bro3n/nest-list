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

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM || "onboarding@resend.dev",
      to: email,
      subject: `Nest List — ${code}`,
      text: `Your Nest List sign-in code is ${code}. It expires in 10 minutes.`,
    }),
  });

  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `Email send failed: ${await res.text()}` });
  }
};
