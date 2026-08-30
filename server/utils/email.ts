import type { H3Event } from "h3";

interface Mail {
  to: string;
  subject: string;
  text: string;
}

// Sends via Resend. In dev (or without a real API key) nothing is sent — the mail
// is logged to the server console so flows stay testable without spamming inboxes.
const deliver = async (event: H3Event, mail: Mail): Promise<void> => {
  const { RESEND_API_KEY, EMAIL_FROM } = useCfEnv(event);
  const hasRealKey = !!RESEND_API_KEY && !RESEND_API_KEY.startsWith("re_dev");

  if (import.meta.dev || !hasRealKey) {
    console.info(`[email] to ${mail.to}: ${mail.subject}`);
    return;
  }

  if (!EMAIL_FROM) {
    console.error("[email] EMAIL_FROM is not set — refusing to fall back to the Resend sandbox");
    throw createError({ statusCode: 500, statusMessage: "email_from_missing" });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text }),
  });

  if (!res.ok) {
    console.error(`[email] Resend send failed (${res.status}): ${await res.text()}`);
    throw createError({ statusCode: 502, statusMessage: "email_send_failed" });
  }
};

export const sendOtpEmail = async (event: H3Event, email: string, code: string): Promise<void> => {
  if (import.meta.dev) console.info(`[auth] OTP for ${email}: ${code}`);
  await deliver(event, {
    to: email,
    subject: `Nest List — ${code}`,
    text: `Your Nest List sign-in code is ${code}. It expires in 10 minutes.`,
  });
};

export const sendShareInviteEmail = async (
  event: H3Event,
  email: string,
  listTitle: string,
  inviterEmail: string,
  appUrl: string,
): Promise<void> => {
  await deliver(event, {
    to: email,
    subject: `${inviterEmail} shared a list with you on Nest List`,
    text:
      `${inviterEmail} invited you to the list "${listTitle}" on Nest List.\n\n` +
      `Open ${appUrl} and sign in with this email address to accept the invitation.`,
  });
};
