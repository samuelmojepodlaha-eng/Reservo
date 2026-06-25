import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "noreply@rezervo.cz";
const APP_URL = process.env.NEXTAUTH_URL ?? "https://reservo-eta.vercel.app";

interface ReservationEmailData {
  customerName: string;
  customerEmail: string;
  restaurantName: string;
  restaurantAddress?: string | null;
  date: string;
  timeFrom: string;
  timeTo: string;
  tableName: string;
  partySize: number;
  depositCzk: number;
  cancelToken: string;
  cancellationHours: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function emailBase(content: string) {
  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <!-- Logo -->
        <tr><td style="padding-bottom:24px;text-align:center;">
          <div style="display:inline-block;width:40px;height:40px;background:#111827;border-radius:12px;text-align:center;line-height:40px;">
            <span style="color:#fff;font-weight:700;font-size:18px;">R</span>
          </div>
          <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Rezervo</p>
        </td></tr>
        <!-- Obsah -->
        <tr><td style="background:#fff;border-radius:16px;border:1px solid #e5e7eb;padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:20px;text-align:center;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">Rezervo · Rezervačný systém pre reštaurácie</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendConfirmationEmail(data: ReservationEmailData) {
  const cancelUrl = `${APP_URL}/cancel/${data.cancelToken}`;

  const html = emailBase(`
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;">Rezervácia potvrdená</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${data.restaurantName}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:4px 0;">
        <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;font-weight:600;letter-spacing:.05em;">Dátum</span><br>
        <span style="color:#111827;font-size:15px;font-weight:500;">${formatDate(data.date)}</span>
      </td></tr>
      <tr><td style="padding:8px 0 4px;border-top:1px solid #e5e7eb;margin-top:8px;">
        <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;font-weight:600;letter-spacing:.05em;">Čas</span><br>
        <span style="color:#111827;font-size:15px;font-weight:500;">${data.timeFrom} – ${data.timeTo}</span>
      </td></tr>
      <tr><td style="padding:8px 0 4px;border-top:1px solid #e5e7eb;">
        <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;font-weight:600;letter-spacing:.05em;">Stôl / Počet osôb</span><br>
        <span style="color:#111827;font-size:15px;font-weight:500;">${data.tableName} · ${data.partySize} osoby</span>
      </td></tr>
      <tr><td style="padding:8px 0 0;border-top:1px solid #e5e7eb;">
        <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;font-weight:600;letter-spacing:.05em;">Záloha</span><br>
        <span style="color:#111827;font-size:15px;font-weight:500;">${data.depositCzk} Kč (zablokovaná na karte)</span>
      </td></tr>
    </table>

    <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">
      Záloha bude odpočítaná od vášho účtu pri návšteve.
      Storno bez poplatku je možné do <strong>${data.cancellationHours} hodín</strong> pred rezerváciou.
    </p>

    <a href="${cancelUrl}" style="display:block;text-align:center;background:#f3f4f6;color:#374151;padding:12px;border-radius:10px;font-size:13px;font-weight:500;text-decoration:none;">
      Zrušiť rezerváciu
    </a>

    <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
      Ak ste túto rezerváciu nevytvorili, ignorujte tento email.
    </p>
  `);

  await resend.emails.send({
    from: FROM,
    to: data.customerEmail,
    subject: `Rezervácia potvrdená — ${data.restaurantName}`,
    html,
  });
}

export async function sendReminderEmail(data: ReservationEmailData) {
  const cancelUrl = `${APP_URL}/cancel/${data.cancelToken}`;

  const html = emailBase(`
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;">Pripomienka rezervácie</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Zajtra vás čakáme v ${data.restaurantName}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:24px;">
      <tr><td style="padding:4px 0;">
        <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;font-weight:600;letter-spacing:.05em;">Dátum a čas</span><br>
        <span style="color:#111827;font-size:15px;font-weight:500;">${formatDate(data.date)}, ${data.timeFrom} – ${data.timeTo}</span>
      </td></tr>
      <tr><td style="padding:8px 0 0;border-top:1px solid #e5e7eb;">
        <span style="color:#9ca3af;font-size:12px;text-transform:uppercase;font-weight:600;letter-spacing:.05em;">Miesto</span><br>
        <span style="color:#111827;font-size:15px;font-weight:500;">${data.restaurantName}${data.restaurantAddress ? `, ${data.restaurantAddress}` : ""}</span>
      </td></tr>
    </table>

    <p style="margin:0 0 20px;color:#4b5563;font-size:14px;line-height:1.6;">
      Ak nemôžete prísť, zrušte rezerváciu <strong>najneskôr dnes</strong> aby vám nebola účtovaná záloha ${data.depositCzk} Kč.
    </p>

    <a href="${cancelUrl}" style="display:block;text-align:center;background:#f3f4f6;color:#374151;padding:12px;border-radius:10px;font-size:13px;font-weight:500;text-decoration:none;">
      Zrušiť rezerváciu
    </a>
  `);

  await resend.emails.send({
    from: FROM,
    to: data.customerEmail,
    subject: `Zajtra o ${data.timeFrom} — ${data.restaurantName}`,
    html,
  });
}
