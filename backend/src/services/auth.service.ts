import crypto from 'node:crypto';
import prisma from '../config/prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { OtpEmailPurpose, sendOtpEmail } from './email.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const OTP_EXPIRY_MINUTES = 10;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;

export class AuthError extends Error {
  statusCode: number;
  code: string;
  data?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
    this.data = data;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(email: string, purpose: OtpEmailPurpose, otp: string): string {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${email}:${purpose}:${otp}`)
    .digest('hex');
}

function verifyOtpHash(email: string, purpose: OtpEmailPurpose, otp: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashOtp(email, purpose, otp), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function issueAuthTokens(user: { id: number; role: string }) {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

async function issueOtp(email: string, purpose: OtpEmailPurpose, fullName?: string) {
  const now = new Date();
  const latest = await prisma.emailOtp.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: 'desc' },
  });

  if (latest && !latest.usedAt) {
    const elapsedMs = now.getTime() - latest.createdAt.getTime();
    const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
    if (elapsedMs < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      throw new AuthError(
        429,
        'OTP_COOLDOWN',
        `Vui lòng chờ ${retryAfterSeconds} giây trước khi yêu cầu gửi lại mã OTP.`,
        { retryAfterSeconds }
      );
    }
  }

  const otp = generateOtpCode();
  const codeHash = hashOtp(email, purpose, otp);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const createdOtp = await prisma.$transaction(async (tx) => {
    await tx.emailOtp.updateMany({
      where: { email, purpose, usedAt: null },
      data: { usedAt: now },
    });

    return tx.emailOtp.create({
      data: {
        email,
        purpose,
        codeHash,
        expiresAt,
      },
    });
  });

  try {
    const { delivery } = await sendOtpEmail({
      to: email,
      otp,
      purpose,
      fullName,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
    return { expiresInSeconds: OTP_EXPIRY_MINUTES * 60, delivery };
  } catch (error: any) {
    await prisma.emailOtp.update({
      where: { id: createdOtp.id },
      data: { usedAt: new Date() },
    }).catch(() => undefined);
    throw new AuthError(
      502,
      'EMAIL_SEND_FAILED',
      error?.message || 'Không thể gửi email mã OTP. Vui lòng thử lại sau.'
    );
  }
}

async function verifyOtpRecord(email: string, purpose: OtpEmailPurpose, otpInput: string) {
  const otp = otpInput.trim();
  if (!/^\d{6}$/.test(otp)) {
    throw new AuthError(400, 'INVALID_OTP_FORMAT', 'Mã OTP phải gồm đúng 6 chữ số.');
  }

  const record = await prisma.emailOtp.findFirst({
    where: { email, purpose, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new AuthError(400, 'OTP_NOT_FOUND', 'Không tìm thấy mã OTP hợp lệ. Vui lòng yêu cầu gửi lại mã mới.');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AuthError(400, 'OTP_EXPIRED', 'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.');
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AuthError(
      429,
      'OTP_MAX_ATTEMPTS',
      'Bạn đã nhập sai mã OTP quá số lần quy định. Vui lòng yêu cầu gửi lại mã mới.'
    );
  }

  if (!verifyOtpHash(email, purpose, otp, record.codeHash)) {
    const nextAttempts = record.attempts + 1;
    await prisma.emailOtp.update({
      where: { id: record.id },
      data: { attempts: nextAttempts },
    });

    const remainingAttempts = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
    throw new AuthError(
      400,
      'INVALID_OTP',
      remainingAttempts > 0
        ? `Mã OTP không chính xác. Bạn còn ${remainingAttempts} lần thử.`
        : 'Bạn đã nhập sai mã OTP quá số lần quy định. Vui lòng yêu cầu gửi lại mã mới.',
      { remainingAttempts }
    );
  }

  return record;
}

export class AuthService {
  static async register(data: { email: string; password: string; fullName: string; phone?: string }) {
    const email = normalizeEmail(data.email);
    const fullName = data.fullName.trim();
    const phone = data.phone?.trim() || null;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && (existingUser.emailVerified || existingUser.status !== 'PENDING')) {
      throw new AuthError(400, 'EMAIL_EXISTS', 'Email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password: hashedPassword,
            fullName,
            phone,
            role: 'MEMBER',
            status: 'PENDING',
            emailVerified: false,
          },
        })
      : await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            fullName,
            phone,
            role: 'MEMBER',
            status: 'PENDING',
            emailVerified: false,
          },
        });

    const otpMeta = await issueOtp(email, 'REGISTER_VERIFY', user.fullName);
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      requiresEmailVerification: true,
      email: user.email,
      expiresInSeconds: otpMeta.expiresInSeconds,
      delivery: otpMeta.delivery,
    };
  }

  static async verifyRegisterOtp(emailInput: string, otp: string) {
    const email = normalizeEmail(emailInput);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AuthError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản với email này.');
    }
    if (user.status === 'SUSPENDED' || user.status === 'BANNED' || user.status === 'INACTIVE') {
      throw new AuthError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa hoặc vô hiệu hóa.');
    }
    if (user.emailVerified && user.status === 'ACTIVE') {
      throw new AuthError(400, 'ALREADY_VERIFIED', 'Email này đã được xác thực. Vui lòng đăng nhập.');
    }

    const otpRecord = await verifyOtpRecord(email, 'REGISTER_VERIFY', otp);
    const now = new Date();

    const updatedUser = await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailOtp.updateMany({
        where: { id: otpRecord.id, usedAt: null },
        data: { verifiedAt: now, usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new AuthError(400, 'OTP_ALREADY_USED', 'Mã OTP đã được sử dụng. Vui lòng yêu cầu mã mới.');
      }

      return tx.user.update({
        where: { id: user.id },
        data: { emailVerified: true, status: 'ACTIVE' },
      });
    });

    const tokens = issueAuthTokens(updatedUser);
    const { password, ...userWithoutPassword } = updatedUser;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  static async resendRegisterOtp(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AuthError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản với email này.');
    }
    if (user.status === 'SUSPENDED' || user.status === 'BANNED' || user.status === 'INACTIVE') {
      throw new AuthError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa hoặc vô hiệu hóa.');
    }
    if (user.emailVerified && user.status === 'ACTIVE') {
      throw new AuthError(400, 'ALREADY_VERIFIED', 'Email này đã được xác thực. Vui lòng đăng nhập.');
    }

    const otpMeta = await issueOtp(email, 'REGISTER_VERIFY', user.fullName);
    return {
      email,
      expiresInSeconds: otpMeta.expiresInSeconds,
      delivery: otpMeta.delivery,
    };
  }

  static async login(data: { email: string; password: string }) {
    const email = normalizeEmail(data.email);
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      throw new AuthError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED' || user.status === 'INACTIVE') {
      throw new AuthError(401, 'ACCOUNT_SUSPENDED', 'Account is suspended');
    }

    if (!user.emailVerified || user.status === 'PENDING') {
      throw new AuthError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Email chưa được xác thực. Vui lòng nhập mã OTP đã gửi về email.',
        { email: user.email }
      );
    }

    const tokens = issueAuthTokens(user);
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  static async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AuthError(404, 'USER_NOT_FOUND', 'User not found');

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new AuthError(400, 'INCORRECT_OLD_PASSWORD', 'Incorrect old password');
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new AuthError(400, 'SAME_PASSWORD', 'New password must differ from old password');
    }
    if (user.mustChangePassword && (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword))) {
      throw new AuthError(400, 'WEAK_PASSWORD', 'New password must contain letters and numbers');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false },
    });
  }

  static async forgotPassword(emailInput: string) {
    const email = normalizeEmail(emailInput);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AuthError(404, 'USER_NOT_FOUND', 'User with this email does not exist');
    }
    if (user.status === 'SUSPENDED' || user.status === 'BANNED' || user.status === 'INACTIVE') {
      throw new AuthError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa hoặc vô hiệu hóa.');
    }

    const otpMeta = await issueOtp(email, 'FORGOT_PASSWORD', user.fullName);
    return {
      email,
      expiresInSeconds: otpMeta.expiresInSeconds,
      delivery: otpMeta.delivery,
    };
  }

  static async verifyForgotPasswordOtp(emailInput: string, otp: string) {
    const email = normalizeEmail(emailInput);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AuthError(404, 'USER_NOT_FOUND', 'User with this email does not exist');
    }
    if (user.status === 'SUSPENDED' || user.status === 'BANNED' || user.status === 'INACTIVE') {
      throw new AuthError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa hoặc vô hiệu hóa.');
    }

    const otpRecord = await verifyOtpRecord(email, 'FORGOT_PASSWORD', otp);
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        otpId: otpRecord.id,
        purpose: 'PASSWORD_RESET',
      },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    return {
      resetToken,
      expiresInSeconds: 600,
    };
  }

  static async resetPassword(resetToken: string, newPassword: string) {
    let decoded: { userId?: number; email?: string; otpId?: number; purpose?: string };
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET) as {
        userId?: number;
        email?: string;
        otpId?: number;
        purpose?: string;
      };
    } catch {
      throw new AuthError(400, 'INVALID_RESET_TOKEN', 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }

    if (
      decoded.purpose !== 'PASSWORD_RESET' ||
      !decoded.userId ||
      !decoded.otpId ||
      !decoded.email
    ) {
      throw new AuthError(400, 'INVALID_RESET_TOKEN', 'Phiên đặt lại mật khẩu không hợp lệ.');
    }

    const otpRecord = await prisma.emailOtp.findUnique({ where: { id: decoded.otpId } });
    if (
      !otpRecord ||
      otpRecord.purpose !== 'FORGOT_PASSWORD' ||
      otpRecord.email !== normalizeEmail(decoded.email) ||
      !otpRecord.verifiedAt
    ) {
      throw new AuthError(400, 'OTP_NOT_VERIFIED', 'Yêu cầu chưa được xác thực bằng mã OTP.');
    }
    if (otpRecord.usedAt) {
      throw new AuthError(400, 'RESET_TOKEN_USED', 'Mã xác thực này đã được sử dụng. Vui lòng yêu cầu mã OTP mới.');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw new AuthError(404, 'USER_NOT_FOUND', 'User not found');

    if (user.password && (await bcrypt.compare(newPassword, user.password))) {
      throw new AuthError(400, 'SAME_PASSWORD', 'New password must differ from old password');
    }
    if (user.mustChangePassword && (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword))) {
      throw new AuthError(400, 'WEAK_PASSWORD', 'New password must contain letters and numbers');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailOtp.updateMany({
        where: { id: otpRecord.id, usedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new AuthError(400, 'RESET_TOKEN_USED', 'Mã xác thực này đã được sử dụng. Vui lòng yêu cầu mã OTP mới.');
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
          emailVerified: true,
          status: user.status === 'PENDING' ? 'ACTIVE' : user.status,
        },
      });
    });
  }

  static async googleLogin(idToken: string) {
    let payload: { email?: string; name?: string; picture?: string } | undefined;

    if (process.env.NODE_ENV !== 'production' && idToken.startsWith('expo-google:')) {
      try {
        const parsed = JSON.parse(decodeURIComponent(idToken.slice('expo-google:'.length)));
        const candidateEmail = typeof parsed?.email === 'string' ? parsed.email.trim().toLowerCase() : '';
        if (candidateEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
          payload = {
            email: candidateEmail,
            name: typeof parsed?.name === 'string' && parsed.name.trim() ? parsed.name.trim() : candidateEmail.split('@')[0],
            picture: typeof parsed?.picture === 'string' ? parsed.picture : undefined,
          };
        }
      } catch {
        // Fallback to standard verifyIdToken below
      }
    }

    if (!payload) {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    }

    if (!payload || !payload.email) {
      throw new AuthError(401, 'INVALID_GOOGLE_TOKEN', 'Invalid Google Token');
    }

    const email = normalizeEmail(payload.email);
    const { name, picture } = payload;

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: name || 'Google User',
          password: '',
          avatar: picture || null,
          role: 'MEMBER',
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
    } else {
      if (user.status === 'INACTIVE' || user.status === 'SUSPENDED' || user.status === 'BANNED') {
        throw new AuthError(401, 'ACCOUNT_SUSPENDED', 'Your account has been deactivated or suspended');
      }
      if (!user.emailVerified || user.status === 'PENDING') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            status: 'ACTIVE',
            avatar: user.avatar || picture || null,
          },
        });
      }
    }

    const tokens = issueAuthTokens(user);
    const { password, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, ...tokens };
  }
}
