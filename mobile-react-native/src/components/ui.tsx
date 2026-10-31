import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { aura } from '../lib/theme';
import { AuraLoader } from './AuraLoader';

export function Page({
  children,
  refresh,
  loading,
  refreshing,
  style,
}: {
  children: React.ReactNode;
  refresh?: () => void | Promise<void>;
  loading?: boolean;
  refreshing?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [showLoader, setShowLoader] = useState(!!loading);
  const loadStartedAt = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (loading) {
      loadStartedAt.current = Date.now();
      setShowLoader(true);
    } else if (showLoader) {
      const remaining = Math.max(0, 1100 - (Date.now() - loadStartedAt.current));
      timer = setTimeout(() => setShowLoader(false), remaining);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [loading, showLoader]);

  const isPullRefreshing = refreshing !== undefined ? refreshing : !!loading;

  return (
    <View style={[styles.page, style]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          refresh ? (
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={refresh}
              tintColor={aura.caramel}
              colors={[aura.caramel]}
              progressBackgroundColor="#FFFFFF"
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {showLoader && (
        <View accessibilityViewIsModal pointerEvents="auto" style={styles.pageLoading}>
          <View style={styles.pageLoadingCard}>
            <AuraLoader size={68} />
            <Text style={styles.pageLoadingTitle}>Đang tải dữ liệu</Text>
            <Text style={styles.pageLoadingSub}>Vui lòng đợi trong giây lát</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export function Header({ title, subtitle, dark = false }: { title: string; subtitle?: string; dark?: boolean }) {
  return <View style={[styles.header, dark && { backgroundColor: aura.espresso }]}><Text style={[styles.headerTitle, dark && { color: aura.white }]}>{title}</Text>{subtitle ? <Text style={[styles.headerSub, dark && { color: aura.latte }]}>{subtitle}</Text> : null}</View>;
}

export function Hero({ eyebrow, title, subtitle, image }: { eyebrow: string; title: string; subtitle?: string; image?: any }) {
  return <LinearGradient colors={[aura.caramel, aura.darkCoffee, aura.espresso]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
    {image && <Image source={image} style={styles.heroImage as ImageStyle} resizeMode="cover" />}
    <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text><Text style={styles.heroTitle}>{title}</Text>{subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
  </LinearGradient>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return <View style={styles.section}><View style={styles.sectionIcon}><Ionicons name={icon || 'layers-outline'} size={20} color={aura.darkCoffee} /></View><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View></View>;
}

export function Button({ title, onPress, secondary = false, disabled = false, icon, compact = false, loading = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; compact?: boolean; loading?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && { opacity: .45 }, compact && { paddingVertical: 9, paddingHorizontal: 11 }]}>
    {loading ? <AuraLoader size={compact ? 20 : 23} centerColor={secondary ? aura.darkCoffee : aura.white} /> : icon && <Ionicons name={icon} size={17} color={secondary ? aura.darkCoffee : aura.white} />}
    <Text style={[styles.buttonText, secondary && { color: aura.darkCoffee }, compact && { fontSize: 12 }]}>{title}</Text>
  </Pressable>;
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline }: { label?: string; value: string; onChangeText: (text: string) => void; placeholder?: string; secureTextEntry?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric'; multiline?: boolean }) {
  return <View style={{ marginBottom: 12 }}>{label ? <Text style={styles.fieldLabel}>{label}</Text> : null}<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={aura.muted} secureTextEntry={secureTextEntry} keyboardType={keyboardType} multiline={multiline} style={[styles.input, multiline && { minHeight: 82, textAlignVertical: 'top' }]} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} /></View>;
}

export function Empty({ title, message, icon = 'file-tray-outline' }: { title: string; message?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return <Card style={styles.empty}><Ionicons name={icon} size={38} color={aura.muted} /><Text style={styles.emptyTitle}>{title}</Text>{message ? <Text style={styles.emptyMessage}>{message}</Text> : null}</Card>;
}

export function Row({ title, subtitle, onPress, icon = 'chevron-forward', trailing }: { title: string; subtitle?: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; trailing?: string }) {
  return <Pressable onPress={onPress} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{title}</Text>{subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}</View>{trailing ? <Text style={styles.rowSubtitle}>{trailing}</Text> : null}<Ionicons name={icon} size={17} color={aura.muted} /></Pressable>;
}

export function Pill({ text, color = aura.caramel }: { text: string; color?: string }) {
  return <View style={[styles.pill, { backgroundColor: `${color}17` }]}><Text style={{ color, fontSize: 10, fontWeight: '800' }}>{text}</Text></View>;
}

export function Divider() { return <View style={{ height: 1, backgroundColor: aura.border, marginVertical: 10 }} />; }

export function showError(error: unknown) { Alert.alert('Aura Fitness', error instanceof Error ? error.message : 'Không thể xử lý yêu cầu. Vui lòng thử lại.'); }
export function confirm(title: string, message: string, action: () => void) { Alert.alert(title, message, [{ text: 'Để sau', style: 'cancel' }, { text: 'Xác nhận', onPress: action }]); }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: aura.cream },
  pageContent: { padding: 16, paddingBottom: 32, gap: 12 },
  pageLoading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 20, backgroundColor: 'rgba(59,24,14,0.52)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  pageLoadingCard: { minWidth: 230, maxWidth: 330, alignItems: 'center', backgroundColor: aura.cream, paddingHorizontal: 30, paddingVertical: 25, borderRadius: 24, borderWidth: 1, borderColor: aura.border, shadowColor: '#000', shadowOpacity: .22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 16 },
  pageLoadingTitle: { color: aura.espresso, fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 15 },
  pageLoadingSub: { color: aura.caramel, fontSize: 12, marginTop: 5 },
  header: { paddingVertical: 10 }, headerTitle: { color: aura.ink, fontSize: 25, fontWeight: '900' }, headerSub: { color: aura.muted, fontSize: 12, marginTop: 4 },
  hero: { borderRadius: 23, padding: 22, minHeight: 148, overflow: 'hidden', justifyContent: 'center' },
  heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '55%', opacity: .22 },
  eyebrow: { color: '#FFD6B4', letterSpacing: 1.4, fontSize: 10, fontWeight: '900' },
  heroTitle: { color: aura.white, fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 8 },
  heroSubtitle: { color: aura.latte, fontSize: 12, marginTop: 8, lineHeight: 19 },
  card: { backgroundColor: aura.white, borderWidth: 1, borderColor: aura.border, borderRadius: 19, padding: 15 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 11, marginBottom: 2 },
  sectionIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: aura.latte, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: aura.ink, fontWeight: '900', fontSize: 17 }, sectionSubtitle: { color: aura.muted, fontSize: 11, marginTop: 2 },
  button: { backgroundColor: aura.darkCoffee, borderRadius: 13, minHeight: 42, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { backgroundColor: aura.white, borderColor: aura.darkCoffee, borderWidth: 1 }, buttonText: { color: aura.white, fontWeight: '800', fontSize: 13, textAlign: 'center' },
  fieldLabel: { color: aura.ink, fontWeight: '700', fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: aura.white, borderColor: aura.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: aura.ink, fontSize: 14 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 }, emptyTitle: { color: aura.ink, fontWeight: '900', fontSize: 16 }, emptyMessage: { color: aura.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  row: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: aura.border },
  rowTitle: { color: aura.ink, fontWeight: '700', fontSize: 14 }, rowSubtitle: { color: aura.muted, fontSize: 11, marginTop: 3 },
  pill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
});
