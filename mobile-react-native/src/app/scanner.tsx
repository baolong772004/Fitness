import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '../lib/api';
import { aura } from '../lib/theme';
import { Button } from '../components/ui';

export default function Scanner() {
  const { kind, bookingId } = useLocalSearchParams<{ kind?: string; bookingId?: string }>();
  const [permission, askPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const scan = async (qrToken: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'class') await api.checkInClass(Number(bookingId), qrToken);
      else await api.startPt(qrToken);
      Alert.alert('Điểm danh thành công', kind === 'class' ? 'Bạn đã check-in lớp học.' : 'Buổi tập PT đã bắt đầu.', [{ text: 'Đóng', onPress: () => router.back() }]);
    } catch (cause) {
      Alert.alert('Không thể điểm danh', cause instanceof Error ? cause.message : 'Vui lòng thử lại.', [{ text: 'Quét lại', onPress: () => setBusy(false) }]);
    }
  };
  return <View style={{ flex: 1, backgroundColor: '#140E0B' }}>
    <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}><Pressable onPress={() => router.back()} accessibilityLabel="Quay lại"><Ionicons name="arrow-back" size={25} color="#fff" /></Pressable><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>Quét QR {kind === 'class' ? 'Workclass' : 'buổi tập PT'}</Text><Text style={{ color: '#FFFFFFB8', fontSize: 12, marginTop: 4 }}>Đưa mã QR do HLV hiển thị vào khung.</Text></View></View>
    <View style={{ flex: 1, margin: 18, borderRadius: 24, overflow: 'hidden', backgroundColor: aura.espresso, justifyContent: 'center' }}>
      {permission?.granted ? <><CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={busy ? undefined : result => void scan(result.data)} /><View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', width: 245, height: 245, borderWidth: 2, borderColor: '#FFFFFFD9', borderRadius: 26, backgroundColor: '#FFFFFF12' }} /><View pointerEvents="none" style={{ position: 'absolute', bottom: 28, alignSelf: 'center', backgroundColor: '#000000AA', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{busy ? 'Đang xác nhận điểm danh...' : 'Đặt mã QR vào chính giữa khung'}</Text></View></> : <View style={{ alignItems: 'center', padding: 28, gap: 15 }}><Ionicons name="camera-outline" size={50} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, textAlign: 'center' }}>Cần quyền sử dụng camera</Text><Text style={{ color: '#FFFFFFC2', textAlign: 'center', fontSize: 12, lineHeight: 19 }}>Cho phép Aura Fitness mở camera để quét mã điểm danh từ Coach.</Text><Button title="Cho phép camera" onPress={() => void askPermission()} /></View>}
    </View>
    <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingBottom: 24 }}><Ionicons name="shield-checkmark-outline" size={20} color="#E8C6AC" /><Text style={{ color: '#E8C6AC', fontSize: 11, marginTop: 6, textAlign: 'center' }}>Mã được kiểm tra trực tiếp với lịch đã đặt của bạn.</Text></View>
  </View>;
}
