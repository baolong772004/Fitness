import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EditorialCard, editorialRows } from '../components/editorial';
import { Header, Page } from '../components/ui';
import { articles } from '../lib/articles';
import { aura } from '../lib/theme';

export default function Articles() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const title = kind === 'news' ? 'Tin tức AURA FITNESS' : kind === 'guides' ? 'Tài liệu, chính sách' : 'Tin tức & hướng dẫn';
  const rows = kind === 'news' || kind === 'guides' ? editorialRows[kind] : articles;
  return <Page><Header title={title} subtitle={`${rows.length} bài viết từ Aura Fitness`} /><View style={{ alignItems: 'center', gap: 12 }}>{rows.map(item => <EditorialCard key={item.id} item={item} width={320} />)}</View><Text style={{ color: aura.muted, textAlign: 'center', fontSize: 11 }}>Nội dung được cập nhật bởi Aura Fitness Team</Text></Page>;
}
