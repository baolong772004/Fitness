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

export interface WalkInEmailPayload {
  to: string;
  fullName: string;
  packageName: string;
  startDate: Date;
  endDate: Date;
  isQueued: boolean;
  amount: number;
  paymentMethod: string;
  transactionNo: string;
  accountCreated: boolean;
  temporaryPassword?: string | null;
  mustChangePassword?: boolean;
}

export interface WalkInEmailResult {
  to: string;
  sent: boolean;
  delivery: 'smtp' | 'console' | 'skipped' | 'failed';
  reason?: string;
}

export async function sendWalkInNotificationEmail(payload: WalkInEmailPayload): Promise<WalkInEmailResult> {
  const to = payload.to.trim().toLowerCase();
  if (!to || to.endsWith('@gymfitness.local') || to.endsWith('.invalid')) {
    return {
      to,
      sent: false,
      delivery: 'skipped',
      reason: 'Email không phải địa chỉ nhận thư thực tế.',
    };
  }

  const startStr = payload.startDate.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const endStr = payload.endDate.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const amountStr = `${Number(payload.amount).toLocaleString('vi-VN')} đ`;
  const subject = `[Aura Fitness] Xác nhận đăng ký gói ${payload.packageName}`;

  const accountLineText = payload.accountCreated && payload.temporaryPassword
    ? `Tài khoản đăng nhập: ${to}\nMật khẩu tạm thời: ${payload.temporaryPassword}\nLưu ý đăng nhập lần đầu (Web hoặc Mobile App): Bạn cần xác thực mã OTP gửi về email, sau đó bắt buộc đổi mật khẩu mới.`
    : payload.mustChangePassword
      ? `Email đăng nhập: ${to} (vui lòng hoàn tất xác thực OTP và đổi mật khẩu mới khi đăng nhập)`
      : `Email đăng nhập: ${to} (sử dụng mật khẩu hiện tại của bạn)`;

  const text = [
    `Xin chào ${payload.fullName},`,
    '',
    `Cảm ơn bạn đã đăng ký gói tập [${payload.packageName}] tại Aura Fitness Club.`,
    `Trạng thái gói: ${payload.isQueued ? 'Đang xếp hàng chờ kích hoạt' : 'Đã kích hoạt (ACTIVE)'}`,
    `Thời hạn sử dụng: ${startStr} – ${endStr}`,
    `Thanh toán: ${amountStr} (${payload.paymentMethod}) · Mã giao dịch: ${payload.transactionNo}`,
    '',
    accountLineText,
    '',
    'Hẹn gặp lại bạn tại phòng tập!',
    'Aura Fitness Club',
  ].join('\n');

  const accountHtml = payload.accountCreated && payload.temporaryPassword
    ? `
      <p style="margin: 0 0 6px; font-size: 13px;"><strong>Email đăng nhập:</strong> ${escapeHtml(to)}</p>
      <p style="margin: 0 0 6px; font-size: 13px;"><strong>Mật khẩu tạm thời:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold;">${escapeHtml(payload.temporaryPassword)}</span></p>
      <p style="margin: 0; font-size: 12px; color: #9c4a2e;">* Ở lần đăng nhập đầu tiên (trên Web hoặc Mobile App), bạn bắt buộc phải <strong>xác thực OTP qua email này</strong> và <strong>đổi mật khẩu mới</strong>.</p>
    `
    : `<p style="margin: 0; font-size: 13px;"><strong>Email đăng nhập:</strong> ${escapeHtml(to)} (${payload.mustChangePassword ? 'vui lòng hoàn tất xác thực OTP và đổi mật khẩu khi đăng nhập' : 'sử dụng mật khẩu hiện tại của bạn'}).</p>`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #eadfd7; border-radius: 14px; background: #fffdfb; color: #2b211b;">
      <p style="margin: 0 0 8px; font-size: 11px; letter-spacing: 2px; font-weight: bold; color: #9c6b4e;">AURA FITNESS CLUB</p>
      <h2 style="margin: 0 0 14px; font-size: 20px; color: #2b211b;">Chào mừng ${escapeHtml(payload.fullName)}!</h2>
      <p style="margin: 0 0 14px; font-size: 14px; line-height: 1.5;">Gói tập <strong>${escapeHtml(payload.packageName)}</strong> của bạn đã được ghi nhận tại quầy lễ tân.</p>
      <div style="margin: 16px 0; padding: 14px 16px; background: #f8f1eb; border-radius: 10px; font-size: 13px; line-height: 1.7;">
        <div><strong>Trạng thái:</strong> ${payload.isQueued ? 'Chờ kích hoạt (nối tiếp gói hiện tại)' : 'Đang hoạt động (ACTIVE)'}</div>
        <div><strong>Thời hạn:</strong> ${escapeHtml(startStr)} – ${escapeHtml(endStr)}</div>
        <div><strong>Thanh toán:</strong> ${escapeHtml(amountStr)} (${escapeHtml(payload.paymentMethod)}) · Mã GD: ${escapeHtml(payload.transactionNo)}</div>
      </div>
      <div style="margin: 16px 0; padding: 14px 16px; border: 1px dashed #c89f84; border-radius: 10px; background: #ffffff;">
        ${accountHtml}
      </div>
      <p style="margin: 0; font-size: 12px; color: #8c7a70;">Chúc bạn có những buổi tập hiệu quả tại Aura Fitness Club.</p>
    </div>
  `;

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      return {
        to,
        sent: false,
        delivery: 'failed',
        reason: 'Dịch vụ gửi email (SMTP) chưa được cấu hình trên máy chủ.',
      };
    }
    console.info(`[DEV WALK-IN EMAIL] To: ${to} | Package: ${payload.packageName} | TempPassword: ${payload.temporaryPassword ?? '(existing)'}`);
    return { to, sent: true, delivery: 'console' };
  }

  try {
    const from = process.env.SMTP_FROM || `"Aura Fitness" <${process.env.SMTP_USER}>`;
    const transporter = getTransporter();
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    return { to, sent: true, delivery: 'smtp' };
  } catch (error: any) {
    console.error('Lỗi gửi email thông báo Walk-in:', error);
    return {
      to,
      sent: false,
      delivery: 'failed',
      reason: error?.message || 'Không thể gửi email qua máy chủ SMTP.',
    };
  }
}
