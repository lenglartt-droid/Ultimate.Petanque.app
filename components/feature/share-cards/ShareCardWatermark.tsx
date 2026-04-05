/**
 * Watermark branding component for share cards.
 * Displays "Ultimate Petanque" logo + app name + QR code for app download.
 * Always positioned at the bottom of the card with guaranteed visibility.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

const APP_DOWNLOAD_URL = 'https://ultimatepetanque.app/download';

interface WatermarkProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
  absolute?: boolean;
  hideQR?: boolean;
}

export default function ShareCardWatermark({ variant = 'light', size = 'md', absolute = false, hideQR = false }: WatermarkProps) {
  const isDark = variant === 'dark';
  const isSm = size === 'sm';
  const textColor = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';
  const dotColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.45)';
  const bgColor = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const qrSize = isSm ? 28 : 36;
  const qrColor = isDark ? '#333333' : '#FFFFFF';
  const qrBgColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.05)';

  return (
    <View style={[
      s.container,
      isSm && s.containerSm,
      absolute && s.absolute,
    ]}>
      <View style={[s.inner, { backgroundColor: bgColor }, isSm && s.innerSm]}>
        {!hideQR ? (
          <View style={[s.qrWrap, { backgroundColor: qrBgColor }, isSm && s.qrWrapSm]}>
            <QRCode value={APP_DOWNLOAD_URL} size={qrSize} color={qrColor} backgroundColor="transparent" />
          </View>
        ) : null}
        <View style={[s.logoBg, { backgroundColor: isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.14)' }, isSm && s.logoBgSm]}>
          <MaterialIcons name="sports" size={isSm ? 11 : 15} color={textColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.appName, { color: textColor }, isSm && s.appNameSm]}>Ultimate Petanque</Text>
          <Text style={[s.tagline, { color: dotColor }, isSm && s.taglineSm]}>{isSm ? 'Telecharger' : 'Scannez pour telecharger'}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    marginTop: 'auto' as any,
  },
  containerSm: {
    paddingTop: 6,
    paddingBottom: 2,
  },
  absolute: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  innerSm: {
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  logoBg: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBgSm: {
    width: 20,
    height: 20,
    borderRadius: 6,
  },
  qrWrap: {
    borderRadius: 6,
    padding: 3,
    overflow: 'hidden' as const,
  },
  qrWrapSm: {
    borderRadius: 5,
    padding: 2,
  },
  appName: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  appNameSm: { fontSize: 9, fontWeight: '700' },
  tagline: { fontSize: 8, fontWeight: '500', marginTop: 0.5 },
  taglineSm: { fontSize: 6.5 },
});
