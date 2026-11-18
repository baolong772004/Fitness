import nodemailer, { Transporter } from 'nodemailer';

export type OtpEmailPurpose = 'REGISTER_VERIFY' | 'FORGOT_PASSWORD';

export interface OtpEmailPayload {
  to: string;
  otp: string;
  purpose: OtpEmailPurpose;
  fullName?: string;
  expiresInMinutes: number;
}

export type OtpEmailSender = (payload: OtpEmailPayload) => Promise<{ delivery: 'smtp' | 'console' | 'test' }>;

let customEmailSenderForTests: OtpEmailSender | null = null;
let cachedTransporter: Transporter | null = null;
let cachedConfigKey = '';

export function setEmailSenderForTests(sender: OtpEmailSender | null) {
  customEmailSenderForTests = sender;
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const key = `${host}:${port}:${secure}:${user}:${pass}`;

  if (!cachedTransporter || cachedConfigKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    cachedConfigKey = key;
  }

  return cachedTransporter;
}

function buildOtpEmailContent(payload: OtpEmailPayload) {
  const isRegister = payload.purpose === 'REGISTER_VERIFY';
  const greetingName = payload.fullName?.trim() || 'bạn';
  const subject = isRegister
    ? '[Aura Fitness] Mã OTP xác thực đăng ký tài khoản'
    : '[Aura Fitness] Mã OTP khôi phục mật khẩu';

  const actionText = isRegister
    ? 'xác thực email để hoàn tất đăng ký tài khoản Aura Fitness'
    : 'xác thực yêu cầu đặt lại mật khẩu tài khoản Aura Fitness';

  const text = [
    `Xin chào ${greetingName},`,
    '',
    `Mã OTP để ${actionText} của bạn là: ${payload.otp}`,
    `Mã có hiệu lực trong ${payload.expiresInMinutes} phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.`,
    '',
    'Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.',
    'Aura Fitness Club',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #eadfd7; border-radius: 14px; background: #fffdfb; color: #2b211b;">
      <p style="margin: 0 0 8px; font-size: 11px; letter-spacing: 2px; font-weight: bold; color: #9c6b4e;">AURA FITNESS CLUB</p>
      <h2 style="margin: 0 0 16px; font-size: 20px; color: #2b211b;">${isRegister ? 'Xác thực email đăng ký' : 'Khôi phục mật khẩu'}</h2>
      <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.5;">Xin chào <strong>${escapeHtml(greetingName)}</strong>,</p>
      <p style="margin: 0 0 18px; font-size: 14px; line-height: 1.5;">Sử dụng mã OTP dưới đây để ${actionText}:</p>
      <div style="text-align: center; margin: 22px 0; padding: 16px; background: #f8f1eb; border-radius: 12px; border: 1px dashed #c89f84;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #3d281e;">${escapeHtml(payload.otp)}</span>
      </div>
      <p style="margin: 0 0 10px; font-size: 13px; color: #6e5a4f;">Mã OTP có hiệu lực trong <strong>${payload.expiresInMinutes} phút</strong>. Tuyệt đối không chia sẻ mã này với người khác.</p>
      <p style="margin: 0; font-size: 12px; color: #8c7a70;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
    </div>
  `;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendOtpEmail(payload: OtpEmailPayload): Promise<{ delivery: 'smtp' | 'console' | 'test' }> {
  if (customEmailSenderForTests) {
    return customEmailSenderForTests(payload);
  }

  const { subject, text, html } = buildOtpEmailContent(payload);

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Dịch vụ gửi email (SMTP) chưa được cấu hình trên máy chủ.');
    }
    console.info(`[DEV OTP EMAIL] To: ${payload.to} | Purpose: ${payload.purpose} | OTP: ${payload.otp} (hết hạn sau ${payload.expiresInMinutes} phút)`);
    return { delivery: 'console' };
  }

  const from = process.env.SMTP_FROM || `"Aura Fitness" <${process.env.SMTP_USER}>`;
  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: payload.to,
    subject,
    text,
    html,
  });

  return { delivery: 'smtp' };
}
