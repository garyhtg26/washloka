/** Escape all interpolated values, including query strings, for HTML email. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function secureUrl(value: string, label: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${label} tidak valid`); }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error(`${label} harus menggunakan HTTPS`);
  return url;
}

/**
 * Build a responsive email and its text alternative. `siteUrl` must be a
 * configured public origin, never the request Host header. `verificationUrl`
 * must be the server-generated Firebase verification link.
 */
export function verificationEmail({
  verificationUrl,
  siteUrl,
  name,
}: {
  verificationUrl: string;
  siteUrl: string;
  name?: string | null;
}) {
  const link = secureUrl(verificationUrl, "Tautan verifikasi").toString();
  const site = secureUrl(siteUrl, "Alamat website");
  const logo = new URL("/washloka/email-wordmark.png", site.origin).toString();
  const firstName = name?.trim().split(/\s+/)[0]?.slice(0, 60);
  const greeting = firstName ? `Halo, ${firstName}.` : "Halo!";
  const subject = "Verifikasi email akun Washloka";
  const text = `${greeting}\n\nSatu langkah lagi untuk menggunakan akun Washloka. Verifikasi alamat email kamu melalui tautan ini:\n\n${link}\n\nKalau kamu tidak meminta verifikasi ini, abaikan email ini.\n\nTim Washloka`;
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f7f5f6;color:#292328;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;color:#f7f5f6;max-height:0;overflow:hidden;opacity:0;">Verifikasi email untuk mulai menggunakan akun Washloka.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f5f6;"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border-collapse:separate;">
    <tr><td style="padding:0 0 24px;"><img src="${escapeHtml(logo)}" width="168" height="32" alt="Washloka" style="display:block;width:168px;height:auto;border:0;"></td></tr>
    <tr><td style="background:#fff;border:1px solid #ece5e8;border-radius:20px;overflow:hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#7a0e2f;height:7px;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:36px 32px 34px;">
        <p style="margin:0 0 18px;color:#7a0e2f;font-size:11px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;">AKUN WASHLOKA</p>
        <h1 style="margin:0 0 18px;color:#242024;font-size:28px;line-height:1.2;letter-spacing:-0.7px;">Satu langkah lagi.</h1>
        <p style="margin:0 0 12px;color:#30292d;font-size:16px;font-weight:700;line-height:1.5;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 26px;color:#62585e;font-size:15px;line-height:1.7;">Verifikasi alamat email kamu untuk mulai menggunakan akun Washloka.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#7a0e2f" style="border-radius:10px;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Verifikasi email</a></td></tr></table>
        <p style="margin:28px 0 0;color:#756c71;font-size:13px;line-height:1.65;">Kalau kamu tidak meminta verifikasi ini, abaikan email ini.</p>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:22px 4px 0;color:#8a7e84;font-size:12px;line-height:1.65;">Email ini dikirim untuk verifikasi akun Washloka.<br>Salam,<br><strong style="color:#6d5c64;">Tim Washloka</strong></td></tr>
  </table>
</td></tr></table></body></html>`;
  return { subject, html, text };
}
