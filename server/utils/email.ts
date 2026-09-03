import type { H3Event } from "h3";
import type { Locale } from "./validate";

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type InviteRole = "editor" | "viewer";

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
    console.error("[email] EMAIL_FROM is not set, refusing to fall back to the Resend sandbox");
    throw createError({ statusCode: 500, statusMessage: "email_from_missing" });
  }

  // Show a friendly sender name unless EMAIL_FROM already carries one.
  const from = EMAIL_FROM.includes("<") ? EMAIL_FROM : `Nest List <${EMAIL_FROM}>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });

  if (!res.ok) {
    console.error(`[email] Resend send failed (${res.status}): ${await res.text()}`);
    throw createError({ statusCode: 502, statusMessage: "email_send_failed" });
  }
};

// Shared, inbox-safe HTML shell. This string is the email document (not an
// Artifact), so a full <html> is correct here. The logo is a hosted PNG since
// email clients don't render inline SVG reliably.
const shell = (origin: string, inner: string, footer: string): string =>
  `<!doctype html><html><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
  `<body style="margin:0;background:#f1ede6;padding:24px;` +
  `font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
  `style="max-width:600px;margin:0 auto;border-collapse:collapse;">` +
  `<tr><td style="background:#ffffff;border-radius:12px;overflow:hidden;">` +
  `<div style="background:#1e293b;padding:20px 28px;">` +
  `<img src="${origin}/icon-192-v2.png" width="34" height="34" alt="" ` +
  `style="vertical-align:middle;border-radius:8px;">` +
  `<span style="vertical-align:middle;margin-left:10px;font-size:20px;font-weight:600;color:#ffffff;` +
  `font-family:Georgia,'Times New Roman',serif;">Nest ` +
  `<span style="font-style:italic;color:#e0a45a;">List</span></span>` +
  `</div>` +
  `<div style="padding:30px 28px 26px;color:#23303f;">${inner}</div>` +
  `<div style="border-top:1px solid #eee7db;padding:18px 28px 24px;font-size:12px;color:#6b7688;` +
  `line-height:1.6;">${footer}</div>` +
  `</td></tr></table></body></html>`;

const brandFooter = `<b style="color:#3c4756;">Nest List</b> &middot; nestlist.org`;

/* ---------------------------------- OTP ---------------------------------- */

interface OtpStrings {
  subject: (code: string) => string;
  kicker: string;
  heading: string;
  expires: string;
  body: string;
  security: string;
}

const OTP: Record<Locale, OtpStrings> = {
  en: {
    subject: (c) => `${c} is your Nest List code`,
    kicker: "Sign in",
    heading: "Here's your sign-in code",
    expires: "Expires in 10 minutes",
    body: "Enter it on the sign-in screen to finish logging in. The code works once.",
    security:
      "Didn't try to sign in? You can ignore this email. Your account stays locked without the code.",
  },
  fr: {
    subject: (c) => `${c} est votre code Nest List`,
    kicker: "Connexion",
    heading: "Voici votre code de connexion",
    expires: "Expire dans 10 minutes",
    body: "Saisissez-le sur l'écran de connexion pour terminer. Le code ne fonctionne qu'une fois.",
    security:
      "Vous n'avez pas tenté de vous connecter ? Ignorez cet email. Votre compte reste protégé sans le code.",
  },
  es: {
    subject: (c) => `${c} es tu código de Nest List`,
    kicker: "Iniciar sesión",
    heading: "Aquí tienes tu código de acceso",
    expires: "Caduca en 10 minutos",
    body: "Introdúcelo en la pantalla de acceso para terminar. El código se usa una sola vez.",
    security:
      "¿No intentaste iniciar sesión? Ignora este correo. Tu cuenta sigue protegida sin el código.",
  },
  zh: {
    subject: (c) => `${c} 是你的 Nest List 验证码`,
    kicker: "登录",
    heading: "这是你的登录验证码",
    expires: "10 分钟后失效",
    body: "在登录页面输入即可完成登录。验证码仅可使用一次。",
    security: "不是你本人操作？忽略此邮件即可。没有验证码，你的账户依然安全。",
  },
};

const otpInner = (t: OtpStrings, code: string): string =>
  `<p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;` +
  `letter-spacing:0.14em;text-transform:uppercase;color:#b8721f;">${t.kicker}</p>` +
  `<h1 style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:600;color:#23303f;` +
  `line-height:1.15;">${t.heading}</h1>` +
  `<div style="margin-top:22px;background:#fbf3e6;border:1px solid #eeddc2;border-radius:12px;` +
  `padding:20px;text-align:center;">` +
  `<div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;` +
  `letter-spacing:8px;color:#1e293b;">${escapeHtml(code)}</div>` +
  `<div style="font-family:'Courier New',monospace;font-size:12px;color:#b8721f;` +
  `margin-top:8px;">${t.expires}</div></div>` +
  `<p style="font-size:15px;color:#3c4756;margin-top:18px;">${t.body}</p>` +
  `<p style="font-size:13px;color:#6b7688;margin-top:16px;">${t.security}</p>`;

const otpText = (t: OtpStrings, code: string): string =>
  `${t.heading}\n\n  ${code}\n\n${t.body}\n\n${t.security}\n\nNest List · nestlist.org\n`;

export const sendOtpEmail = async (
  event: H3Event,
  email: string,
  code: string,
  locale: Locale,
): Promise<void> => {
  if (import.meta.dev) console.info(`[auth] OTP for ${email}: ${code}`);
  const t = OTP[locale];
  const origin = getRequestURL(event).origin;
  await deliver(event, {
    to: email,
    subject: t.subject(code),
    html: shell(origin, otpInner(t, code), brandFooter),
    text: otpText(t, code),
  });
};

/* -------------------------------- Invite --------------------------------- */

interface InviteStrings {
  subject: (inviter: string, list: string) => string;
  kicker: string;
  heading: (inviter: string) => string;
  role: (role: InviteRole) => string;
  body: string;
  cta: string;
  signin: string;
  footerNote: string;
}

const INVITE: Record<Locale, InviteStrings> = {
  en: {
    subject: (inv, list) => `${inv} shared "${list}" with you`,
    kicker: "Shared with you",
    heading: (inv) => `${inv} shared a list with you`,
    role: (r) => (r === "editor" ? "Can edit" : "Can view"),
    body: "Open Nest List to view it and start adding items together.",
    cta: "Open Nest List",
    signin:
      "Sign in with this email address to accept the invitation. No account yet? Signing in creates one.",
    footerNote: "You received this because someone shared a list with this address.",
  },
  fr: {
    subject: (inv, list) => `${inv} a partagé « ${list} » avec vous`,
    kicker: "Partagé avec vous",
    heading: (inv) => `${inv} a partagé une liste avec vous`,
    role: (r) => (r === "editor" ? "Peut modifier" : "Lecture seule"),
    body: "Ouvrez Nest List pour la voir et ajouter des éléments ensemble.",
    cta: "Ouvrir Nest List",
    signin:
      "Connectez-vous avec cette adresse email pour accepter l'invitation. Pas encore de compte ? La connexion en crée un.",
    footerNote: "Vous recevez cet email car une liste a été partagée avec cette adresse.",
  },
  es: {
    subject: (inv, list) => `${inv} compartió "${list}" contigo`,
    kicker: "Compartido contigo",
    heading: (inv) => `${inv} compartió una lista contigo`,
    role: (r) => (r === "editor" ? "Puede editar" : "Solo lectura"),
    body: "Abre Nest List para verla y empezar a añadir elementos juntos.",
    cta: "Abrir Nest List",
    signin:
      "Inicia sesión con esta dirección de correo para aceptar la invitación. ¿Aún no tienes cuenta? Al iniciar sesión se crea una.",
    footerNote: "Recibes esto porque alguien compartió una lista con esta dirección.",
  },
  zh: {
    subject: (inv, list) => `${inv} 与你共享了“${list}”`,
    kicker: "与你共享",
    heading: (inv) => `${inv} 与你共享了一个清单`,
    role: (r) => (r === "editor" ? "可编辑" : "仅查看"),
    body: "打开 Nest List 查看，并一起添加项目。",
    cta: "打开 Nest List",
    signin: "使用此邮箱地址登录即可接受邀请。还没有账户？登录时会自动创建。",
    footerNote: "你收到此邮件是因为有人向此地址共享了清单。",
  },
};

const inviteInner = (
  t: InviteStrings,
  safeInviter: string,
  safeList: string,
  role: InviteRole,
  origin: string,
): string =>
  `<p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;` +
  `letter-spacing:0.14em;text-transform:uppercase;color:#b8721f;">${t.kicker}</p>` +
  `<h1 style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:600;color:#23303f;` +
  `line-height:1.15;">${t.heading(safeInviter)}</h1>` +
  `<div style="margin-top:22px;background:#f7f9fb;border:1px solid #e7ecf1;border-radius:12px;` +
  `padding:14px 16px;">` +
  `<span style="font-size:16px;font-weight:600;color:#23303f;">${safeList}</span><br>` +
  `<span style="display:inline-block;margin-top:4px;font-family:'Courier New',monospace;` +
  `font-size:11px;text-transform:uppercase;color:#4a5565;background:#e7ecf1;border-radius:999px;` +
  `padding:2px 8px;">${t.role(role)}</span></div>` +
  `<p style="font-size:15px;color:#3c4756;margin-top:18px;">${t.body}</p>` +
  `<a href="${origin}" style="display:inline-block;margin-top:20px;background:#e0a45a;color:#2a1d08;` +
  `font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px;">` +
  `${t.cta}</a>` +
  `<p style="font-size:13px;color:#6b7688;margin-top:18px;">${t.signin}</p>`;

const inviteText = (
  t: InviteStrings,
  inviter: string,
  list: string,
  role: InviteRole,
  origin: string,
): string =>
  `${t.heading(inviter)}\n\n  "${list}" (${t.role(role)})\n\n${t.body}\n${origin}\n\n` +
  `${t.signin}\n\nNest List · nestlist.org\n`;

export const sendShareInviteEmail = async (
  event: H3Event,
  email: string,
  listTitle: string,
  inviterEmail: string,
  appUrl: string,
  role: InviteRole,
  locale: Locale,
): Promise<void> => {
  const t = INVITE[locale];
  await deliver(event, {
    to: email,
    subject: t.subject(inviterEmail, listTitle),
    html: shell(
      appUrl,
      inviteInner(t, escapeHtml(inviterEmail), escapeHtml(listTitle), role, appUrl),
      `${brandFooter}<br>${t.footerNote}`,
    ),
    text: inviteText(t, inviterEmail, listTitle, role, appUrl),
  });
};
