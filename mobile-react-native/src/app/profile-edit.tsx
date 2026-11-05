import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
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
  const { user, refreshSession } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Nam');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const roleStr = String(user?.role || '').toUpperCase().trim();
  const isCoach = roleStr === 'COACH' || roleStr === 'TRAINER' || roleStr === 'PT' || roleStr === 'HLV';

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
    if (!fullName.trim()) {
      Alert.alert('Aura Fitness', 'Vui lòng nhập họ và tên của bạn.');
      return;
    }
    setLoading(true);
    try {
      const genderMap: Record<string, string> = { Nam: 'MALE', Nữ: 'FEMALE', Khác: 'OTHER' };
      await api.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        dateOfBirth: dateOfBirth ? dateOfBirth.trim() : undefined,
        gender: genderMap[gender] || gender,
        height: height ? Number(height) : undefined,
        weight: weight ? Number(weight) : undefined,
      });

      await refreshSession?.();

      Alert.alert(
        'Thành công',
        'Thông tin hồ sơ cá nhân đã được cập nhật thành công.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      showError(error);
    } finally {
      setLoading(false);
    }
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
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                {isCoach ? 'HLV Aura Fitness' : 'Hội viên Aura Club'} #{user?.id}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Thông tin được phép chỉnh sửa */}
      <Section title="Thông tin cá nhân (Có thể chỉnh sửa)" icon="create-outline" />
      <Card>
        <Field label="Họ và tên *" value={fullName} onChangeText={setFullName} placeholder="Nhập họ và tên" />
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

      {/* Chỉ số cơ thể được phép chỉnh sửa */}
      <Section title="Chỉ số cơ thể (Có thể chỉnh sửa)" icon="body-outline" subtitle="Dữ liệu quan trọng giúp HLV lên giáo án & dinh dưỡng phù hợp" />
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
                <Text style={{ color: aura.muted, fontSize: 10, fontWeight: '800' }}>CHỈ SỐ BMI TỰ ĐỘNG</Text>
                <Text style={{ color: aura.ink, fontSize: 22, fontWeight: '900', marginTop: 4 }}>
                  {(Number(weight) / ((Number(height) / 100) ** 2)).toFixed(1)}
                </Text>
                <Text style={{ color: aura.caramel, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                  {(() => {
                    const bmi = Number(weight) / ((Number(height) / 100) ** 2);
                    if (bmi < 18.5) return 'Thiếu cân';
                    if (bmi < 25) return 'Thể trạng bình thường ✓';
                    if (bmi < 30) return 'Thừa cân nhẹ';
                    return 'Cần điều chỉnh giảm cân';
                  })()}
                </Text>
              </View>
            )}
          </View>
        )}
      </Card>

      {/* Thông tin hệ thống: Khóa không cho sửa (Hiển thị rõ lý do theo logic) */}
      <Section title="Thông tin hệ thống (Không thể chỉnh sửa)" icon="lock-closed-outline" />
      <Card>
        <View style={styles.lockedField}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="lock-closed" size={14} color={aura.muted} />
            <Text style={styles.lockedLabel}>Email định danh:</Text>
          </View>
          <Text style={styles.lockedValue}>{user?.email}</Text>
        </View>
        <Text style={styles.lockedNote}>
          Email là tài khoản định danh bảo mật duy nhất, không thể thay đổi để đảm bảo an toàn giao dịch.
        </Text>

        <View style={[styles.lockedField, { marginTop: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="shield-checkmark" size={14} color={aura.muted} />
            <Text style={styles.lockedLabel}>Vai trò tài khoản:</Text>
          </View>
          <Text style={styles.lockedValue}>
            {isCoach ? 'Huấn luyện viên (PT)' : 'Hội viên Aura'}
          </Text>
        </View>
        <Text style={styles.lockedNote}>
          Vai trò do ban quản trị Aura Club chỉ định và phân quyền, hội viên không thể tự thay đổi.
        </Text>

        <View style={[styles.lockedField, { marginTop: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="barcode-outline" size={14} color={aura.muted} />
            <Text style={styles.lockedLabel}>Mã định danh hệ thống:</Text>
          </View>
          <Text style={styles.lockedValue}>#{user?.id}</Text>
        </View>
        <Text style={styles.lockedNote}>
          Mã số ID cố định duy nhất dùng cho điểm danh, đặt lịch và quản lý hồ sơ.
        </Text>
      </Card>

      {/* Save Button */}
      <Button
        title={loading ? 'Đang lưu thay đổi...' : 'Lưu thay đổi'}
        icon="checkmark-outline"
        loading={loading}
        disabled={loading}
        onPress={save}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  lockedField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  lockedLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: aura.muted,
  },
  lockedValue: {
    fontSize: 13,
    fontWeight: '800',
    color: aura.ink,
  },
  lockedNote: {
    fontSize: 11,
    color: aura.muted,
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 15,
  },
});
