import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { shouldUseNativeMapView } from '@/utils/shouldUseNativeMapView';
import theme from '@/constants/theme';

interface Props {
  latA: number | null | undefined;
  lngA: number | null | undefined;
  latB: number | null | undefined;
  lngB: number | null | undefined;
  labelA?: string;
  labelB?: string;
  distanceKm?: number;
  color?: string;
  height?: number;
}

/**
 * Small non-interactive map showing 2 terrains connected by a colored
 * polyline. Falls back to a text tile on emulators where the native map is
 * unavailable. Requires valid finite coordinates on both endpoints.
 */
export default function MiniTravelMap({
  latA,
  lngA,
  latB,
  lngB,
  labelA,
  labelB,
  distanceKm,
  color = '#EF4444',
  height = 140,
}: Props) {
  const hasCoords =
    Number.isFinite(latA) &&
    Number.isFinite(lngA) &&
    Number.isFinite(latB) &&
    Number.isFinite(lngB);
  const useNative = hasCoords && shouldUseNativeMapView();

  const fallback = (
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

  if (!useNative) return fallback;

  try {
    const Maps: any = require('react-native-maps');
    const MapView = Maps.default || Maps.MapView;
    const Marker = Maps.Marker;
    const Polyline = Maps.Polyline;

    if (!MapView || !Marker || !Polyline) return fallback;

    const a = { latitude: latA as number, longitude: lngA as number };
    const b = { latitude: latB as number, longitude: lngB as number };
    const centerLat = (a.latitude + b.latitude) / 2;
    const centerLng = (a.longitude + b.longitude) / 2;
    const latDelta = Math.max(0.6, Math.abs(a.latitude - b.latitude) * 1.8);
    const lngDelta = Math.max(0.6, Math.abs(a.longitude - b.longitude) * 1.8);

    return (
      <View style={[styles.mapWrap, { height }]}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: latDelta,
            longitudeDelta: lngDelta,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          liteMode={Platform.OS === 'android'}
          pointerEvents="none"
        >
          <Marker coordinate={a} title={labelA} pinColor={color} />
          <Marker coordinate={b} title={labelB} pinColor={color} />
          <Polyline
            coordinates={[a, b]}
            strokeColor={color}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        </MapView>
        {typeof distanceKm === 'number' ? (
          <View style={[styles.distanceOverlay, { backgroundColor: color }]}>
            <Text style={styles.distanceText}>{distanceKm} km</Text>
          </View>
        ) : null}
      </View>
    );
  } catch {
    return fallback;
  }
}

const styles = StyleSheet.create({
  mapWrap: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: theme.backgroundSecondary,
  },
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
  distanceOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
  },
});
