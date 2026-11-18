import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api, ApiError } from '../lib/api';
import { aura } from '../lib/theme';
import { Button, Card, Field, Hero, Page, showError } from '../components/ui';
import { AuraLoadingOverlay } from '../components/AuraLoader';

export default function ForgotPassword() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState(initialEmail || '');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('Đang xử lý...');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const requestOtp = async (isResend = false) => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return Alert.alert('Email chưa hợp lệ', 'Vui lòng nhập đúng địa chỉ email.');
    }
    setBusy(true);
    setBusyMessage(isResend ? 'Đang gửi lại mã OTP...' : 'Đang gửi mã OTP...');
    try {
      await api.forgotPassword(email);
      setOtp('');
      setCooldown(60);
      setStep(2);
      Alert.alert(
        'Đã gửi mã OTP',
        `Mã OTP 6 chữ số đã được gửi về ${email.trim().toLowerCase()}. Vui lòng kiểm tra hộp thư.`
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'OTP_COOLDOWN' && error.data?.retryAfterSeconds) {
        setCooldown(Number(error.data.retryAfterSeconds));
      }
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      return Alert.alert('Mã OTP chưa hợp lệ', 'Vui lòng nhập đủ 6 chữ số OTP.');
    }
    setBusy(true);
    setBusyMessage('Đang xác thực mã OTP...');
    try {
      const result = await api.verifyForgotPasswordOtp(email, trimmedOtp);
      const resetToken = result.data?.resetToken;
      if (!resetToken) {
        throw new Error('Máy chủ chưa trả về mã xác thực đặt lại mật khẩu.');
      }
      setToken(String(resetToken));
      setPassword('');
      setConfirm('');
      setStep(3);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (password.length < 6 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu cần ít nhất 6 ký tự, gồm chữ và số.');
    }
    if (password !== confirm) {
      return Alert.alert('Mật khẩu chưa khớp', 'Hãy nhập lại mật khẩu mới.');
    }
    setBusy(true);
    setBusyMessage('Đang cập nhật mật khẩu...');
    try {
      await api.resetPassword(token, password);
      Alert.alert('Thành công', 'Đổi mật khẩu thành công. Hãy đăng nhập lại.', [
        {
          text: 'Đăng nhập',
          onPress: () => (router.canGoBack() ? router.back() : router.replace('/auth')),
        },
      ]);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    step === 1
      ? 'Nhập email để nhận mã OTP đặt lại mật khẩu.'
      : step === 2
        ? `Nhập mã OTP 6 chữ số đã gửi về ${email.trim().toLowerCase()}.`
        : 'Tạo mật khẩu mới cho tài khoản Aura của bạn.';

  return (
    <View style={{ flex: 1 }}>
      <Page>
        <Hero eyebrow="BẢO MẬT TÀI KHOẢN" title="Khôi phục mật khẩu" subtitle={subtitle} />
        <Card>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              backgroundColor: aura.latte,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Ionicons
              name={step === 1 ? 'mail-outline' : step === 2 ? 'shield-checkmark-outline' : 'lock-open-outline'}
              size={21}
              color={aura.darkCoffee}
            />
          </View>

          {step === 1 && (
            <>
              <Text style={{ color: aura.ink, fontWeight: '900', fontSize: 17, marginBottom: 7 }}>
                Nhận mã OTP qua email
              </Text>
              <Text style={{ color: aura.muted, fontSize: 12, lineHeight: 18, marginBottom: 16 }}>
                Hệ thống sẽ gửi mã OTP 6 chữ số đến email bạn đã đăng ký.
              </Text>
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Button
                disabled={busy}
                title={busy ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
                onPress={() => void requestOtp(false)}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={{ color: aura.ink, fontWeight: '900', fontSize: 17, marginBottom: 7 }}>
                Xác thực mã OTP
              </Text>
              <Text style={{ color: aura.muted, fontSize: 12, lineHeight: 18, marginBottom: 16 }}>
                Mã OTP có hiệu lực trong 10 phút. Nhập mã trước khi đặt mật khẩu mới.
              </Text>
              <Field
                label="Mã OTP (6 chữ số)"
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="numeric"
                placeholder="123456"
              />
              <Button
                disabled={busy || otp.length !== 6}
                title={busy ? 'Đang xác thực...' : 'Xác thực mã OTP'}
                onPress={() => void verifyOtp()}
              />
              <View style={{ height: 10 }} />
              <Button
                secondary
                disabled={busy || cooldown > 0}
                title={cooldown > 0 ? `Gửi lại mã OTP (${cooldown}s)` : 'Gửi lại mã OTP'}
                onPress={() => void requestOtp(true)}
              />
              <Pressable
                onPress={() => {
                  setStep(1);
                  setOtp('');
                }}
                style={{ alignSelf: 'center', marginTop: 14 }}
              >
                <Text style={{ color: aura.caramel, fontWeight: '800', fontSize: 12 }}>Đổi email khác</Text>
              </Pressable>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={{ color: aura.ink, fontWeight: '900', fontSize: 17, marginBottom: 7 }}>
                Đặt mật khẩu mới
              </Text>
              <Text style={{ color: aura.muted, fontSize: 12, lineHeight: 18, marginBottom: 16 }}>
                Email {email.trim().toLowerCase()} đã được xác thực. Hãy tạo mật khẩu mới.
              </Text>
              <Field label="Mật khẩu mới" value={password} onChangeText={setPassword} secureTextEntry />
              <Field label="Nhập lại mật khẩu mới" value={confirm} onChangeText={setConfirm} secureTextEntry />
              <Text style={{ color: aura.muted, fontSize: 11, marginBottom: 15 }}>
                Tối thiểu 6 ký tự, gồm chữ cái và chữ số.
              </Text>
              <Button
                disabled={busy}
                title={busy ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                onPress={() => void reset()}
              />
            </>
          )}
        </Card>
      </Page>
      <AuraLoadingOverlay visible={busy} message={busyMessage} />
    </View>
  );
}
