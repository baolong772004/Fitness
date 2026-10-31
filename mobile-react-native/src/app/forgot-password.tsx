import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { aura } from '../lib/theme';
import { Button, Card, Field, Hero, Page, showError } from '../components/ui';
import { AuraLoadingOverlay } from '../components/AuraLoader';

export default function ForgotPassword() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(initialEmail || ''); const [token, setToken] = useState('');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [requesting, setRequesting] = useState(false);
  const requestToken = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('Email chưa hợp lệ', 'Vui lòng nhập đúng địa chỉ email.');
    setBusy(true); setRequesting(true);
    try { const result = await api.forgotPassword(email); const code = result.data?.resetToken; if (code) setToken(String(code)); else Alert.alert('Đã gửi', result.message || 'Vui lòng kiểm tra email.'); }
    catch (error) { showError(error); } finally { setBusy(false); setRequesting(false); }
  };
  const reset = async () => {
    if (password.length < 6 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu cần ít nhất 6 ký tự, gồm chữ và số.');
    if (password !== confirm) return Alert.alert('Mật khẩu chưa khớp', 'Hãy nhập lại mật khẩu mới.');
    setBusy(true); setRequesting(false);
    try { await api.resetPassword(token, password); Alert.alert('Thành công', 'Đổi mật khẩu thành công. Hãy đăng nhập lại.', [{ text: 'Đăng nhập', onPress: () => router.canGoBack() ? router.back() : router.replace('/auth') }]); }
    catch (error) { showError(error); } finally { setBusy(false); }
  };
  return <View style={{ flex: 1 }}><Page><Hero eyebrow="BẢO MẬT TÀI KHOẢN" title="Khôi phục mật khẩu" subtitle={token ? 'Tạo mật khẩu mới cho tài khoản Aura của bạn.' : 'Nhập email để lấy lại quyền truy cập tài khoản.'} />
    <Card><View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Ionicons name={token ? 'lock-open-outline' : 'mail-outline'} size={21} color={aura.darkCoffee} /></View>
      {!token ? <><Text style={{ color: aura.ink, fontWeight: '900', fontSize: 17, marginBottom: 7 }}>Nhận mã đặt lại mật khẩu</Text><Text style={{ color: aura.muted, fontSize: 12, lineHeight: 18, marginBottom: 16 }}>Hệ thống sẽ tạo mã khôi phục cho email bạn đã đăng ký.</Text><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" /><Button disabled={busy} title={busy ? 'Đang lấy mã...' : 'Lấy mã đặt lại'} onPress={() => void requestToken()} /></> : <><Text style={{ color: aura.ink, fontWeight: '900', fontSize: 17, marginBottom: 7 }}>Đặt mật khẩu mới</Text><Text style={{ color: aura.muted, fontSize: 12, lineHeight: 18, marginBottom: 16 }}>Mã khôi phục đã được tạo cho {email}.</Text><Field label="Mật khẩu mới" value={password} onChangeText={setPassword} secureTextEntry /><Field label="Nhập lại mật khẩu mới" value={confirm} onChangeText={setConfirm} secureTextEntry /><Text style={{ color: aura.muted, fontSize: 11, marginBottom: 15 }}>Tối thiểu 6 ký tự, gồm chữ cái và chữ số.</Text><Button disabled={busy} title={busy ? 'Đang cập nhật...' : 'Đổi mật khẩu'} onPress={() => void reset()} /><View style={{ height: 10 }} /><Button secondary disabled={busy} title="Lấy mã mới" onPress={() => void requestToken()} /></>}
    </Card>
  </Page><AuraLoadingOverlay visible={busy} message={requesting ? 'Đang tạo mã khôi phục...' : 'Đang cập nhật mật khẩu...'} /></View>;
}
