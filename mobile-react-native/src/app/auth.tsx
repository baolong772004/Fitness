import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Page, showError } from '../components/ui';
import { AuraLoadingOverlay } from '../components/AuraLoader';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getGoogleIdToken } from '../lib/google';
import { aura } from '../lib/theme';

function AuthField({
  label,
  icon,
  value,
  onChangeText,
  keyboardType,
  secret = false,
  maxLength,
  centered = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'email-address' | 'phone-pad' | 'number-pad';
  secret?: boolean;
  maxLength?: number;
  centered?: boolean;
}) {
  const [hidden, setHidden] = useState(secret);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: aura.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 }}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: aura.border,
          borderRadius: 14,
          backgroundColor: '#FFFEFC',
          paddingHorizontal: 13,
        }}
      >
        <Ionicons name={icon} size={19} color={aura.caramel} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={hidden}
          maxLength={maxLength}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
          autoCorrect={false}
          placeholder={centered ? '••••••' : label}
          placeholderTextColor={aura.muted}
          style={{
            flex: 1,
            minHeight: 49,
            marginLeft: 10,
            color: aura.ink,
            fontSize: centered ? 19 : 14,
            fontWeight: centered ? '800' : '400',
            letterSpacing: centered ? 6 : 0,
            textAlign: centered ? 'center' : 'left',
          }}
        />
        {secret && (
          <Pressable
            accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
            onPress={() => setHidden(!hidden)}
            hitSlop={10}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={aura.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function AuthScreen() {
  const { register } = useLocalSearchParams<{ register?: string }>();
  const { signIn, signUp, verifySignUpOtp, resendSignUpOtp, signInWithGoogle } = useAuth();
  const [creating, setCreating] = useState(register === '1');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Guest registration email OTP state
  const [verifyingEmail, setVerifyingEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const navigateAfterAuth = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const submit = async () => {
    if (!email.trim() || !password || (creating && name.trim().length < 2)) {
      return Alert.alert('Thiếu thông tin', 'Vui lòng điền email, mật khẩu và họ tên hợp lệ.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      return Alert.alert('Email không hợp lệ', 'Vui lòng kiểm tra địa chỉ email.');
    }
    if (password.length < 6) {
      return Alert.alert('Mật khẩu quá ngắn', 'Mật khẩu cần ít nhất 6 ký tự.');
    }
    if (creating && (!/[A-Za-z]/.test(password) || !/\d/.test(password))) {
      return Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu cần có cả chữ cái và chữ số.');
    }
    if (creating && password !== confirmPassword) {
      return Alert.alert('Mật khẩu chưa khớp', 'Hãy nhập lại mật khẩu xác nhận.');
    }
    if (
      creating &&
      phone.trim() &&
      (!/^\+?[0-9 ()-]+$/.test(phone.trim()) ||
        phone.replace(/\D/g, '').length < 8 ||
        phone.replace(/\D/g, '').length > 15)
    ) {
      return Alert.alert('Số điện thoại không hợp lệ', 'Số điện thoại cần từ 8 đến 15 chữ số.');
    }

    setBusy(true);
    try {
      if (creating) {
        const res = await signUp(name, email, password, phone);
        setVerifyingEmail(res.email);
        setOtp('');
        setCooldown(60);
        Alert.alert(
          'Kiểm tra email',
          `Mã OTP 6 chữ số đã được gửi tới ${res.email}. Vui lòng nhập mã để hoàn tất đăng ký.`
        );
      } else {
        const loggedInUser = await signIn(email, password);
        if (!loggedInUser.mustChangePassword) {
          navigateAfterAuth();
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
        const unverifiedEmail = String(error.data?.email || email.trim().toLowerCase());
        setCreating(true);
        setVerifyingEmail(unverifiedEmail);
        setOtp('');
        Alert.alert('Chưa xác thực email', error.message);
        return;
      }
      if (error instanceof ApiError && error.code === 'OTP_COOLDOWN' && error.data?.retryAfterSeconds) {
        setCooldown(Number(error.data.retryAfterSeconds));
      }
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const submitVerifyOtp = async () => {
    if (!verifyingEmail) return;
    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      return Alert.alert('Mã OTP chưa hợp lệ', 'Vui lòng nhập đủ 6 chữ số OTP đã gửi về email.');
    }
    setBusy(true);
    try {
      const loggedInUser = await verifySignUpOtp(verifyingEmail, trimmedOtp);
      if (!loggedInUser.mustChangePassword) {
        navigateAfterAuth();
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (!verifyingEmail || cooldown > 0 || busy) return;
    setBusy(true);
    try {
      await resendSignUpOtp(verifyingEmail);
      setCooldown(60);
      Alert.alert('Đã gửi lại mã OTP', `Mã OTP mới đã được gửi tới ${verifyingEmail}.`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'OTP_COOLDOWN' && error.data?.retryAfterSeconds) {
        setCooldown(Number(error.data.retryAfterSeconds));
      }
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      const loggedInUser = await signInWithGoogle(idToken);
      if (!loggedInUser.mustChangePassword) {
        navigateAfterAuth();
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const isVerifying = creating && Boolean(verifyingEmail);

  return (
    <View style={{ flex: 1 }}>
      <Page>
        <LinearGradient
          colors={[aura.espresso, aura.darkCoffee, aura.coffee]}
          style={{
            marginHorizontal: -16,
            marginTop: -16,
            paddingHorizontal: 22,
            paddingTop: 42,
            paddingBottom: 66,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: '#FFFFFF20',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 22,
            }}
          >
            <Ionicons name={isVerifying ? 'shield-checkmark-outline' : 'barbell-outline'} color="#fff" size={27} />
          </View>
          <Text style={{ color: '#E7BEA8', fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>
            AURA FITNESS CLUB
          </Text>
          <Text style={{ color: '#fff', fontSize: 29, fontWeight: '900', marginTop: 9 }}>
            {isVerifying ? 'Xác thực email' : creating ? 'Tạo tài khoản' : 'Chào mừng trở lại'}
          </Text>
          <Text style={{ color: '#E8D8CF', fontSize: 13, marginTop: 6 }}>
            {isVerifying
              ? `Nhập mã OTP 6 chữ số đã gửi tới ${verifyingEmail}.`
              : creating
                ? 'Đăng ký để bắt đầu tập luyện cùng Aura.'
                : 'Đăng nhập để tiếp tục hành trình của bạn.'}
          </Text>
        </LinearGradient>

        <Card
          style={{
            marginTop: -48,
            borderRadius: 26,
            padding: 20,
            shadowColor: aura.espresso,
            shadowOpacity: 0.12,
            shadowRadius: 22,
            elevation: 7,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              padding: 4,
              backgroundColor: aura.cream,
              borderRadius: 14,
              marginBottom: 21,
            }}
          >
            {[
              { value: false, title: 'Đăng nhập' },
              { value: true, title: 'Đăng ký' },
            ].map((item) => (
              <Pressable
                key={item.title}
                onPress={() => {
                  setCreating(item.value);
                  setVerifyingEmail(null);
                  setOtp('');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 11,
                  backgroundColor: creating === item.value ? aura.darkCoffee : 'transparent',
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    fontWeight: '800',
                    color: creating === item.value ? '#fff' : aura.muted,
                  }}
                >
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </View>

          {isVerifying ? (
            <>
              <View
                style={{
                  backgroundColor: aura.cream,
                  borderWidth: 1,
                  borderColor: aura.border,
                  borderRadius: 14,
                  padding: 13,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: aura.ink, fontSize: 12, lineHeight: 18 }}>
                  Mã OTP xác thực email đã được gửi tới{' '}
                  <Text style={{ fontWeight: '800' }}>{verifyingEmail}</Text>. Mã có hiệu lực trong 10 phút.
                </Text>
              </View>

              <AuthField
                label="Mã OTP (6 chữ số)"
                icon="shield-checkmark-outline"
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                centered
              />

              <Button
                title={busy ? 'Đang xác thực...' : 'Xác thực & Đăng nhập  →'}
                disabled={busy || otp.length !== 6}
                onPress={() => void submitVerifyOtp()}
              />

              <View style={{ height: 10 }} />

              <Button
                secondary
                title={cooldown > 0 ? `Gửi lại mã OTP (${cooldown}s)` : 'Gửi lại mã OTP'}
                disabled={busy || cooldown > 0}
                onPress={() => void handleResendOtp()}
              />

              <Pressable
                onPress={() => {
                  setVerifyingEmail(null);
                  setOtp('');
                }}
                style={{ alignSelf: 'center', marginTop: 15 }}
              >
                <Text style={{ color: aura.caramel, fontWeight: '800', fontSize: 12 }}>
                  Quay lại chỉnh sửa thông tin
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {creating && (
                <>
                  <AuthField label="Họ và tên" icon="person-outline" value={name} onChangeText={setName} />
                  <AuthField
                    label="Số điện thoại (không bắt buộc)"
                    icon="call-outline"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </>
              )}
              <AuthField
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <AuthField label="Mật khẩu" icon="lock-closed-outline" value={password} onChangeText={setPassword} secret />
              {creating ? (
                <>
                  <AuthField
                    label="Nhập lại mật khẩu"
                    icon="shield-checkmark-outline"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secret
                  />
                  <Text style={{ color: aura.muted, fontSize: 11, marginBottom: 16 }}>
                    Mật khẩu từ 6 ký tự gồm chữ và số. Hệ thống sẽ gửi mã OTP về email để xác thực tài khoản.
                  </Text>
                </>
              ) : (
                <Pressable
                  onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
                  style={{ alignSelf: 'flex-end', marginBottom: 17 }}
                >
                  <Text style={{ color: aura.caramel, fontWeight: '800', fontSize: 12 }}>Quên mật khẩu?</Text>
                </Pressable>
              )}
              <Button
                title={busy ? 'Đang xử lý...' : creating ? 'Tiếp tục & Nhận OTP  →' : 'Đăng nhập  →'}
                disabled={busy}
                onPress={() => void submit()}
              />
              {!creating && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 17 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: aura.border }} />
                    <Text style={{ color: aura.muted, fontSize: 10, fontWeight: '800' }}>HOẶC</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: aura.border }} />
                  </View>
                  <Button
                    secondary
                    icon="logo-google"
                    title="Tiếp tục với Google"
                    disabled={busy}
                    onPress={() => void submitGoogle()}
                  />
                </>
              )}
            </>
          )}
        </Card>
        <Text style={{ color: aura.muted, textAlign: 'center', fontSize: 11, lineHeight: 17 }}>
          AURA FITNESS · Cùng bạn xây dựng thói quen tập luyện
        </Text>
      </Page>
      <AuraLoadingOverlay
        visible={busy}
        message={
          isVerifying
            ? 'Đang xác thực mã OTP...'
            : creating
              ? 'Đang gửi mã OTP...'
              : 'Đang đăng nhập...'
        }
      />
    </View>
  );
}
