import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { aura } from '../lib/theme';
import { Button, Card, Field, Page, Section, showError } from '../components/ui';

const GENDERS = ['Nam', 'Nữ', 'Khác'];

function SelectPill({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <Button
          key={opt}
          title={opt}
          secondary={value !== opt}
          compact
          onPress={() => onChange(opt)}
        />
      ))}
    </View>
  );
}

export default function ProfileEdit() {
  const { user } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Nam');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const loadProfile = useCallback(async () => {
    setFetching(true);
    try {
      const result = await api.myProfile();
      const p = result.data ?? result;
      if (p.fullName) setFullName(String(p.fullName));
      if (p.phone) setPhone(String(p.phone));
      if (p.dateOfBirth) setDateOfBirth(String(p.dateOfBirth).split('T')[0]);
      if (p.gender) setGender(String(p.gender) === 'MALE' ? 'Nam' : String(p.gender) === 'FEMALE' ? 'Nữ' : 'Khác');
      if (p.height) setHeight(String(p.height));
      if (p.weight) setWeight(String(p.weight));
    } catch {
      // fall back to auth user data
    } finally {
      setFetching(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

  const save = async () => {
    if (!fullName.trim()) { Alert.alert('Aura Fitness', 'Vui lòng nhập họ tên.'); return; }
    setLoading(true);
    try {
      const genderMap: Record<string, string> = { Nam: 'MALE', Nữ: 'FEMALE', Khác: 'OTHER' };
      await api.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        gender: genderMap[gender],
        height: height ? Number(height) : undefined,
        weight: weight ? Number(weight) : undefined,
      });
      Alert.alert('Đã lưu', 'Thông tin hồ sơ đã được cập nhật thành công.');
    } catch (error) { showError(error); }
    finally { setLoading(false); }
  };

  return (
    <Page loading={fetching}>
      {/* Avatar header */}
      <LinearGradient
        colors={[aura.espresso, aura.darkCoffee]}
        style={{ borderRadius: 22, padding: 20, alignItems: 'center', gap: 12 }}
      >
        <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF55', backgroundColor: '#FFFFFF29', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person" size={44} color="#fff" />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>{fullName || user?.fullName || 'Hội viên'}</Text>
          <Text style={{ color: '#E8D8CF', fontSize: 12, marginTop: 4 }}>{user?.email}</Text>
          <View style={{ marginTop: 10 }}>
            <View style={{ backgroundColor: '#FFFFFF22', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Mã hội viên: #{user?.id}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Basic info */}
      <Section title="Thông tin cá nhân" icon="person-outline" />
      <Card>
        <Field label="Họ và tên *" value={fullName} onChangeText={setFullName} placeholder="Nguyễn Văn A" />
        <Field label="Số điện thoại" value={phone} onChangeText={setPhone} placeholder="0901234567" keyboardType="phone-pad" />
        <Field
          label="Ngày sinh (YYYY-MM-DD)"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="2000-01-15"
          keyboardType="numeric"
        />
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: aura.ink, fontWeight: '700', fontSize: 12, marginBottom: 8 }}>Giới tính</Text>
          <SelectPill options={GENDERS} value={gender} onChange={setGender} />
        </View>
      </Card>

      {/* Body metrics */}
      <Section title="Chỉ số cơ thể" icon="body-outline" subtitle="Giúp Coach tạo kế hoạch tập phù hợp" />
      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="Chiều cao (cm)" value={height} onChangeText={setHeight} placeholder="170" keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Cân nặng (kg)" value={weight} onChangeText={setWeight} placeholder="65" keyboardType="numeric" />
          </View>
        </View>
        {(height || weight) && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            {height && weight && (
              <View style={{ backgroundColor: aura.latte, borderRadius: 12, padding: 12, flex: 1, alignItems: 'center' }}>
                <Text style={{ color: aura.muted, fontSize: 10, fontWeight: '800' }}>CHỈ SỐ BMI</Text>
                <Text style={{ color: aura.ink, fontSize: 22, fontWeight: '900', marginTop: 4 }}>
                  {(Number(weight) / ((Number(height) / 100) ** 2)).toFixed(1)}
                </Text>
                <Text style={{ color: aura.caramel, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                  {(() => {
                    const bmi = Number(weight) / ((Number(height) / 100) ** 2);
                    if (bmi < 18.5) return 'Thiếu cân';
                    if (bmi < 25) return 'Bình thường ✓';
                    if (bmi < 30) return 'Thừa cân';
                    return 'Béo phì';
                  })()}
                </Text>
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Save */}
      <Button
        title={loading ? 'Đang lưu...' : 'Lưu thay đổi'}
        icon="checkmark-outline"
        loading={loading}
        disabled={loading}
        onPress={save}
      />
    </Page>
  );
}
