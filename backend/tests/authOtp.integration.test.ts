import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import prisma from '../src/config/prisma.js';
import authRoutes from '../src/routes/auth.routes.js';
import { OtpEmailPayload, setEmailSenderForTests } from '../src/services/email.service.js';

interface SentEmail extends OtpEmailPayload {}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = createTestApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to bind ephemeral port');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function postJson(baseUrl: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

function makeTestEmail() {
  return `otp-test-${randomUUID()}@example.invalid`;
}

async function cleanupTestEmails(emails: string[]) {
  if (emails.length === 0) return;
  await prisma.emailOtp.deleteMany({ where: { email: { in: emails } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

test('Guest register OTP verification, cooldown, max attempts, login gate, and active user check', async (t) => {
  const createdEmails: string[] = [];
  const sentEmails: SentEmail[] = [];

  setEmailSenderForTests(async (payload) => {
    sentEmails.push(payload);
    return { delivery: 'test' };
  });

  t.after(async () => {
    setEmailSenderForTests(null);
    await cleanupTestEmails(createdEmails);
  });

  await withServer(async (baseUrl) => {
    const email = makeTestEmail();
    createdEmails.push(email);

    // 1. Register creates PENDING user & sends 6-digit OTP
    const regRes = await postJson(baseUrl, '/api/auth/register', {
      email,
      password: 'Password123',
      fullName: 'Guest OTP Test',
      phone: '0901234567',
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.json.success, true);
    assert.equal(regRes.json.data.requiresEmailVerification, true);
    assert.equal(regRes.json.data.email, email);
    assert.equal(regRes.json.data.otp, undefined);

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].purpose, 'REGISTER_VERIFY');
    assert.match(sentEmails[0].otp, /^\d{6}$/);
    const firstOtp = sentEmails[0].otp;

    const pendingUser = await prisma.user.findUnique({ where: { email } });
    assert.ok(pendingUser);
    assert.equal(pendingUser.status, 'PENDING');
    assert.equal(pendingUser.emailVerified, false);

    // 2. Login is blocked before OTP verification
    const blockedLogin = await postJson(baseUrl, '/api/auth/login', {
      email,
      password: 'Password123',
    });
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.json.code, 'EMAIL_NOT_VERIFIED');

    // 3. Resend immediately triggers 429 cooldown
    const cooldownRes = await postJson(baseUrl, '/api/auth/resend-register-otp', { email });
    assert.equal(cooldownRes.status, 429);
    assert.equal(cooldownRes.json.code, 'OTP_COOLDOWN');

    // 4. Wrong OTP increments attempts and locks after 5 tries
    const wrongOtp = firstOtp === '000000' ? '999999' : '000000';
    for (let i = 1; i <= 5; i++) {
      const badVerify = await postJson(baseUrl, '/api/auth/verify-register-otp', { email, otp: wrongOtp });
      assert.equal(badVerify.status, 400);
      assert.equal(badVerify.json.code, 'INVALID_OTP');
      assert.equal(badVerify.json.data.remainingAttempts, 5 - i);
    }
    const lockedVerify = await postJson(baseUrl, '/api/auth/verify-register-otp', { email, otp: firstOtp });
    assert.equal(lockedVerify.status, 429);
    assert.equal(lockedVerify.json.code, 'OTP_MAX_ATTEMPTS');

    // 5. After cooldown expires, resend issues a fresh OTP and invalidates old one
    await prisma.emailOtp.updateMany({
      where: { email, purpose: 'REGISTER_VERIFY' },
      data: { createdAt: new Date(Date.now() - 65_000) },
    });

    const resendRes = await postJson(baseUrl, '/api/auth/resend-register-otp', { email });
    assert.equal(resendRes.status, 200);
    assert.equal(sentEmails.length, 2);
    const secondOtp = sentEmails[1].otp;
    assert.match(secondOtp, /^\d{6}$/);

    // 6. Verify with fresh OTP activates user and returns accessToken + refreshToken
    const verifyRes = await postJson(baseUrl, '/api/auth/verify-register-otp', { email, otp: secondOtp });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.json.success, true);
    assert.ok(verifyRes.json.data.accessToken);
    assert.ok(verifyRes.json.data.refreshToken);
    assert.equal(verifyRes.json.data.user.status, 'ACTIVE');
    assert.equal(verifyRes.json.data.user.emailVerified, true);

    // 7. Login succeeds now
    const loginRes = await postJson(baseUrl, '/api/auth/login', {
      email,
      password: 'Password123',
    });
    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.json.data.accessToken);

    // 8. Re-registering verified email fails with EMAIL_EXISTS
    const dupReg = await postJson(baseUrl, '/api/auth/register', {
      email,
      password: 'Password123',
      fullName: 'Duplicate',
    });
    assert.equal(dupReg.status, 400);
    assert.equal(dupReg.json.code, 'EMAIL_EXISTS');
  });
});

test('Pending unverified guest can re-register and expired OTP is rejected', async (t) => {
  const createdEmails: string[] = [];
  const sentEmails: SentEmail[] = [];

  setEmailSenderForTests(async (payload) => {
    sentEmails.push(payload);
    return { delivery: 'test' };
  });

  t.after(async () => {
    setEmailSenderForTests(null);
    await cleanupTestEmails(createdEmails);
  });

  await withServer(async (baseUrl) => {
    const email = makeTestEmail();
    createdEmails.push(email);

    const firstReg = await postJson(baseUrl, '/api/auth/register', {
      email,
      password: 'Password123',
      fullName: 'First Name',
    });
    assert.equal(firstReg.status, 201);

    // Age previous OTP past cooldown and re-register same unverified email
    await prisma.emailOtp.updateMany({
      where: { email, purpose: 'REGISTER_VERIFY' },
      data: { createdAt: new Date(Date.now() - 65_000) },
    });

    const secondReg = await postJson(baseUrl, '/api/auth/register', {
      email,
      password: 'NewPassword123',
      fullName: 'Updated Name',
    });
    assert.equal(secondReg.status, 201);
    assert.equal(secondReg.json.data.user.fullName, 'Updated Name');

    // Expire the latest OTP
    await prisma.emailOtp.updateMany({
      where: { email, purpose: 'REGISTER_VERIFY', usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const expiredVerify = await postJson(baseUrl, '/api/auth/verify-register-otp', {
      email,
      otp: sentEmails[1].otp,
    });
    assert.equal(expiredVerify.status, 400);
    assert.equal(expiredVerify.json.code, 'OTP_EXPIRED');
  });
});

test('Forgot password OTP flow verifies OTP before reset and enforces single-use resetToken', async (t) => {
  const createdEmails: string[] = [];
  const sentEmails: SentEmail[] = [];

  setEmailSenderForTests(async (payload) => {
    sentEmails.push(payload);
    return { delivery: 'test' };
  });

  t.after(async () => {
    setEmailSenderForTests(null);
    await cleanupTestEmails(createdEmails);
  });

  await withServer(async (baseUrl) => {
    const email = makeTestEmail();
    createdEmails.push(email);

    // Register & verify user first
    await postJson(baseUrl, '/api/auth/register', {
      email,
      password: 'OldPassword123',
      fullName: 'Forgot Flow User',
    });
    const verifyReg = await postJson(baseUrl, '/api/auth/verify-register-otp', {
      email,
      otp: sentEmails[0].otp,
    });
    assert.equal(verifyReg.status, 200);
    const loginAccessToken = verifyReg.json.data.accessToken as string;

    // 1. Unknown email returns 404
    const unknownForgot = await postJson(baseUrl, '/api/auth/forgot-password', {
      email: makeTestEmail(),
    });
    assert.equal(unknownForgot.status, 404);

    // 2. Request forgot-password OTP (must NOT return OTP or resetToken in JSON)
    const forgotRes = await postJson(baseUrl, '/api/auth/forgot-password', { email });
    assert.equal(forgotRes.status, 200);
    assert.equal(forgotRes.json.data.resetToken, undefined);
    assert.equal(forgotRes.json.data.otp, undefined);
    assert.equal(sentEmails.length, 2);
    assert.equal(sentEmails[1].purpose, 'FORGOT_PASSWORD');
    const forgotOtp = sentEmails[1].otp;

    // 3. Cannot use normal login accessToken as resetToken
    const badTokenReset = await postJson(baseUrl, '/api/auth/reset-password', {
      resetToken: loginAccessToken,
      newPassword: 'NewPassword123',
    });
    assert.equal(badTokenReset.status, 400);
    assert.equal(badTokenReset.json.code, 'INVALID_RESET_TOKEN');

    // 4. Wrong OTP rejected
    const wrongOtpVerify = await postJson(baseUrl, '/api/auth/verify-forgot-password-otp', {
      email,
      otp: forgotOtp === '111111' ? '222222' : '111111',
    });
    assert.equal(wrongOtpVerify.status, 400);
    assert.equal(wrongOtpVerify.json.code, 'INVALID_OTP');

    // 5. Valid OTP returns short-lived resetToken
    const verifyForgot = await postJson(baseUrl, '/api/auth/verify-forgot-password-otp', {
      email,
      otp: forgotOtp,
    });
    assert.equal(verifyForgot.status, 200);
    const resetToken = verifyForgot.json.data.resetToken as string;
    assert.ok(resetToken);

    // 6. Reset password succeeds
    const resetRes = await postJson(baseUrl, '/api/auth/reset-password', {
      resetToken,
      newPassword: 'NewPassword123',
    });
    assert.equal(resetRes.status, 200);

    // 7. Reusing the same resetToken fails
    const replayReset = await postJson(baseUrl, '/api/auth/reset-password', {
      resetToken,
      newPassword: 'AnotherPassword123',
    });
    assert.equal(replayReset.status, 400);
    assert.equal(replayReset.json.code, 'RESET_TOKEN_USED');

    // 8. Old password fails, new password succeeds
    const oldLogin = await postJson(baseUrl, '/api/auth/login', {
      email,
      password: 'OldPassword123',
    });
    assert.equal(oldLogin.status, 401);

    const newLogin = await postJson(baseUrl, '/api/auth/login', {
      email,
      password: 'NewPassword123',
    });
    assert.equal(newLogin.status, 200);
    assert.ok(newLogin.json.data.accessToken);
  });
});

test('Email delivery failure rolls back OTP cooldown so user can retry immediately', async (t) => {
  const createdEmails: string[] = [];
  let shouldFail = true;

  setEmailSenderForTests(async () => {
    if (shouldFail) {
      throw new Error('SMTP connection timeout');
    }
    return { delivery: 'test' };
  });

  t.after(async () => {
    setEmailSenderForTests(null);
    await cleanupTestEmails(createdEmails);
  });

  await withServer(async (baseUrl) => {
    const email = makeTestEmail();
    createdEmails.push(email);

    const failReg = await postJson(baseUrl, '/api/auth/register', {
      email,
      password: 'Password123',
      fullName: 'Mail Fail Retry',
    });
    assert.equal(failReg.status, 502);
    assert.equal(failReg.json.code, 'EMAIL_SEND_FAILED');

    // Immediate retry succeeds once email service recovers (not blocked by cooldown)
    shouldFail = false;
    const retryRes = await postJson(baseUrl, '/api/auth/resend-register-otp', { email });
    assert.equal(retryRes.status, 200);
  });
});
