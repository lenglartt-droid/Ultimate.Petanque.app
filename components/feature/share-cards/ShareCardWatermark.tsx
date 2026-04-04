/**
 * Watermark branding component for share cards.
 * Displays "Ultimate Petanque" logo + app name subtly.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface WatermarkProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
}

export default function ShareCardWatermark({ variant = 'light', size = 'md' }: WatermarkProps) {
  const isDark = variant === 'dark';
  const isSm = size === 'sm';
  const textColor = isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)';
  const dotColor = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)';

  return (
    <View style={[s.container, isSm && s.containerSm]}>
      <View style={[s.logoBg, { backgroundColor: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)' }]}>
        <MaterialIcons name="sports" size={isSm ? 12 : 16} color={textColor} />
      </View>
      <View>
        <Text style={[s.appName, { color: textColor }, isSm && s.appNameSm]}>Ultimate Petanque</Text>
        <Text style={[s.tagline, { color: dotColor }, isSm && s.taglineSm]}>petanque-score.app</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  containerSm: { gap: 6, paddingVertical: 6, paddingHorizontal: 10 },
  logoBg: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  appNameSm: { fontSize: 10 },
  tagline: { fontSize: 9, fontWeight: '500', marginTop: 1 },
  taglineSm: { fontSize: 7 },
});
