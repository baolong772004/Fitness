export const aura = {
  coffee: '#6B2D1B',
  espresso: '#3B180E',
  darkCoffee: '#5A2314',
  caramel: '#8C3E26',
  cream: '#FAF7F2',
  latte: '#F1E2D4',
  ink: '#2C1B12',
  muted: '#8C7567',
  border: '#EADBCE',
  green: '#2E7D32',
  white: '#FFFFFF',
};

export const money = (value: unknown) => `${Number(value ?? 0).toLocaleString('vi-VN')} đ`;
export const dateLabel = (value: unknown) => {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
};
export const timeLabel = (value: unknown) => {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const list = <T = Record<string, unknown>>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];
export const asRecord = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
