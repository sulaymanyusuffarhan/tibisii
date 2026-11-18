import nodemailer from 'nodemailer';

export interface EmailConfigStatus {
  configured: boolean;
  host: string | null;
  from: string | null;
  notificationRecipient: string | null;
  warning: string | null;
}

export function getEmailConfigStatus(): EmailConfigStatus {
  const host = process.env.SMTP_HOST?.trim() || null;
  const from = process.env.SMTP_FROM?.trim() || null;
  const notificationRecipient = process.env.ENQUIRY_NOTIFICATION_EMAIL?.trim() || null;
  const configured = Boolean(host && from);

  return {
    configured,
    host,
    from,
    notificationRecipient,
    warning: configured
      ? null
      : 'SMTP email service is not currently configured (SMTP_HOST / SMTP_FROM unset). All public submissions and password reset requests are securely stored in PostgreSQL, and no outbound emails are claimed to have been sent until authorized TBC ICT SMTP credentials are supplied.',
  };
}

export async function sendSystemEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ status: 'sent' | 'not_configured' | 'failed'; error?: string }> {
  const cfg = getEmailConfigStatus();
  if (!cfg.configured || !cfg.host || !cfg.from) {
    return { status: 'not_configured' };
  }

  try {
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 8_000,
    });

    await transporter.sendMail({
      from: cfg.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    return { status: 'sent' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'SMTP dispatch error';
    return { status: 'failed', error: message };
  }
}
