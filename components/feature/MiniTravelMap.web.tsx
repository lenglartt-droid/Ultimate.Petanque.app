// ============================================
// MiniTravelMap - Web stub
// ============================================
// react-native-maps only supports iOS/Android. On web we render a
// text-only tile so Metro never resolves the native-only package.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import theme from '@/constants/theme';

interface Props {
  latA?: number | null;
  lngA?: number | null;
  latB?: number | null;
  lngB?: number | null;
  labelA?: string;
  labelB?: string;
  distanceKm?: number;
  color?: string;
  height?: number;
}

export default function MiniTravelMap({
  labelA,
  labelB,
  distanceKm,
  color = '#EF4444',
  height = 140,
}: Props) {
  return (
    <View style={[styles.fallback, { height }]}>
      <MaterialIcons name="map" size={22} color={theme.textMuted} />
      <Text style={styles.fallbackText} numberOfLines={1}>
        {(labelA || 'A') + '  ->  ' + (labelB || 'B')}
      </Text>
      {typeof distanceKm === 'number' ? (
        <Text style={[styles.fallbackDistance, { color }]}>{distanceKm} km</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  fallbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  fallbackDistance: {
    fontSize: 14,
    fontWeight: '800',
  },
});
