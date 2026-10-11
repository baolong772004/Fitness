import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { articles } from '../lib/articles';
import { aura } from '../lib/theme';

export const editorialRows = {
  news: articles.filter(item => ['gym', 'first'].includes(item.id)),
  guides: articles.filter(item => ['booking', 'checkin', 'support'].includes(item.id)),
};

export function EditorialCard({ item, width = 286 }: { item: typeof articles[number]; width?: number }) {
  return <Pressable onPress={() => router.push({ pathname: '/article', params: { id: item.id } })} style={{ width, height: 255, borderRadius: 19, backgroundColor: '#fff', overflow: 'hidden', borderColor: aura.border, borderWidth: 1 }}>
    <View style={{ height: 146, backgroundColor: aura.darkCoffee }}>
      {item.image ? <Image source={item.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <LinearGradient colors={[aura.espresso, aura.caramel]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={item.id === 'checkin' ? 'qr-code-outline' : item.id === 'support' ? 'headset-outline' : 'calendar-outline'} size={55} color="#FFFFFF99" /></LinearGradient>}
    </View>
    <View style={{ padding: 12 }}><Text style={{ color: aura.caramel, fontSize: 9, fontWeight: '900', letterSpacing: .8 }}>{item.category}</Text><Text numberOfLines={2} style={{ color: aura.darkCoffee, fontSize: 14, fontWeight: '900', lineHeight: 18, marginTop: 4 }}>{item.title}</Text><Text numberOfLines={2} style={{ color: aura.muted, fontSize: 11, lineHeight: 15, marginTop: 4 }}>{item.summary}</Text></View>
  </Pressable>;
}

export function ArticleRail({ kind }: { kind: keyof typeof editorialRows }) {
  const title = kind === 'news' ? 'Tin tức AURA FITNESS' : 'Tài liệu, chính sách';
  return <View style={{ marginTop: 14, marginHorizontal: -16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 11 }}><Text style={{ flex: 1, color: aura.darkCoffee, fontWeight: '900', fontSize: 19 }}>{title}</Text><Text onPress={() => router.push({ pathname: '/articles', params: { kind } })} style={{ color: aura.darkCoffee, fontWeight: '800', fontSize: 12 }}>Xem tất cả</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>{editorialRows[kind].map(item => <EditorialCard key={item.id} item={item} />)}</ScrollView>
  </View>;
}
