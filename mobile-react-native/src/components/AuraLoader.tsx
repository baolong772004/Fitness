import React, { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { aura } from '../lib/theme';

const AnimatedView = Animated.View;

export function AuraLoader({ size = 56, centerColor = aura.darkCoffee }: { size?: number; centerColor?: string }) {
  const [rotation] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: 2600,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const turn = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const center = size / 2;
  const radius = size * 0.35;
  const circumference = 2 * Math.PI * radius;
  const colors = [aura.latte, aura.caramel, aura.darkCoffee, aura.coffee, aura.latte];
  const bubbles = [aura.latte, aura.caramel, aura.coffee, aura.border, aura.darkCoffee, aura.latte];

  return <View accessible accessibilityRole="progressbar" accessibilityLabel="Đang tải" style={{ width: size, height: size }}>
    <AnimatedView style={{ width: size, height: size, transform: [{ rotate: turn }] }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="auraLoaderStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            {colors.map((color, index) => <Stop key={`${color}-${index}`} offset={`${index * 25}%`} stopColor={color} />)}
          </LinearGradient>
          <LinearGradient id="auraLoaderCore" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={aura.cream} />
            <Stop offset="100%" stopColor={aura.latte} />
          </LinearGradient>
        </Defs>
        <Circle cx={center} cy={center} r={radius} fill="none" stroke={aura.caramel} opacity={0.23} strokeWidth={size * 0.16} strokeDasharray={`${circumference * 0.74} ${circumference * 0.26}`} strokeLinecap="round" />
        <Circle cx={center} cy={center} r={radius} fill="none" stroke="url(#auraLoaderStroke)" strokeWidth={size * 0.09} strokeDasharray={`${circumference * 0.74} ${circumference * 0.26}`} strokeLinecap="round" />
        {bubbles.map((color, index) => {
          const angle = (index * Math.PI) / 3;
          const x = center + Math.cos(angle) * radius * 0.76;
          const y = center + Math.sin(angle) * radius * 0.76;
          const bubbleRadius = size * (index % 2 ? 0.062 : 0.045);
          return <React.Fragment key={`${color}-${index}`}>
            <Circle cx={x} cy={y} r={bubbleRadius * 1.45} fill={color} opacity={0.22} />
            <Circle cx={x} cy={y} r={bubbleRadius * 0.72} fill={color} opacity={0.95} />
          </React.Fragment>;
        })}
        <Circle cx={center} cy={center} r={size * 0.15} fill="url(#auraLoaderCore)" />
      </Svg>
    </AnimatedView>
    <Ionicons name="barbell" size={size * 0.26} color={centerColor} style={{ position: 'absolute', left: size * 0.37, top: size * 0.37 }} />
  </View>;
}

export function AuraLoadingOverlay({ visible, message }: { visible: boolean; message: string }) {
  if (!visible) return null;
  return <View accessibilityViewIsModal pointerEvents="auto" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 20, backgroundColor: 'rgba(59,24,14,0.60)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
    <View style={{ minWidth: 230, maxWidth: 330, alignItems: 'center', backgroundColor: aura.cream, paddingHorizontal: 30, paddingVertical: 25, borderRadius: 24, borderWidth: 1, borderColor: aura.border, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 16 }}>
      <AuraLoader size={68} />
      <Text style={{ color: aura.espresso, fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 15 }}>{message}</Text>
      <Text style={{ color: aura.caramel, fontSize: 12, marginTop: 5 }}>Vui lòng đợi trong giây lát</Text>
    </View>
  </View>;
}
