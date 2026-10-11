import React, { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { aura } from '../lib/theme';
import { Button, Card, Page } from '../components/ui';
import { AuraLoadingOverlay } from '../components/AuraLoader';

function PasswordField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  const [hidden, setHidden] = useState(true);
  return <View style={{ marginTop: 15 }}><Text style={{ color: aura.ink, fontSize: 12, fontWeight: '800', marginBottom: 6 }}>{label}</Text><View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCFAF8', borderWidth: 1, borderColor: aura.border, borderRadius: 14, paddingHorizontal: 13 }}><Ionicons name="lock-closed-outline" size={19} color={aura.caramel} /><TextInput value={value} onChangeText={onChangeText} secureTextEntry={hidden} autoCorrect={false} autoCapitalize="none" style={{ flex: 1, minHeight: 51, color: aura.ink, marginLeft: 10 }} /><Pressable accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'} onPress={() => setHidden(!hidden)} hitSlop={10}><Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={aura.muted} /></Pressable></View></View>;
}

export default function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!oldPassword) return setError('Vui lòng nhập mật khẩu hiện tại.');
    if (newPassword.length < 6 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) return setError('Mật khẩu mới cần ít nhất 6 ký tự, gồm chữ và số.');
    if (newPassword === oldPassword) return setError('Mật khẩu mới cần khác mật khẩu hiện tại.');
    if (newPassword !== confirm) return setError('Mật khẩu xác nhận chưa khớp.');
    setBusy(true); setError(null);
    try {
      await api.changePassword(oldPassword, newPassword);
      setOldPassword(''); setNewPassword(''); setConfirm('');
      Alert.alert('Thành công', 'Mật khẩu đã được cập nhật.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể đổi mật khẩu.'); }
    finally { setBusy(false); }
  };
  return <View style={{ flex: 1 }}><Page><Card style={{ padding: 22, borderRadius: 24, marginTop: 14 }}>
    <View style={{ width: 54, height: 54, borderRadius: 17, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="lock-open-outline" size={29} color={aura.caramel} /></View>
    <Text style={{ color: aura.espresso, fontSize: 22, fontWeight: '900', marginTop: 17 }}>Bảo vệ tài khoản</Text>
    <Text style={{ color: aura.muted, fontSize: 13, lineHeight: 19, marginTop: 7 }}>Nhập mật khẩu hiện tại, sau đó tạo mật khẩu mới cho tài khoản Aura của bạn.</Text>
    <View style={{ marginTop: 9 }}><PasswordField label="Mật khẩu hiện tại" value={oldPassword} onChangeText={setOldPassword} /><PasswordField label="Mật khẩu mới" value={newPassword} onChangeText={setNewPassword} /><PasswordField label="Nhập lại mật khẩu mới" value={confirm} onChangeText={setConfirm} /></View>
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'center' }}><Ionicons name="information-circle-outline" size={16} color={aura.muted} /><Text style={{ color: aura.muted, fontSize: 11 }}>Tối thiểu 6 ký tự, gồm chữ cái và chữ số.</Text></View>
    {error && <View style={{ marginTop: 15, padding: 12, borderRadius: 12, backgroundColor: '#FCEEE8' }}><Text style={{ color: '#B3261E', fontSize: 12 }}>{error}</Text></View>}
    <View style={{ marginTop: 20 }}><Button title={busy ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'} disabled={busy} onPress={() => void submit()} /></View>
  </Card></Page><AuraLoadingOverlay visible={busy} message="Đang cập nhật mật khẩu..." /></View>;
}
