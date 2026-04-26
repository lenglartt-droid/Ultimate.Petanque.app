/**
 * Watermark branding component for share cards.
 * Displays the new UP globe logo + "Ultimate Petanque" name + QR code.
 * Always positioned at the bottom of the card with guaranteed visibility.
 * 
 * FIX: Removed marginTop: 'auto' which caused clipping when card content
 * overflows the parent's fixed height. Now uses compact fixed-height layout
 * that is always visible regardless of content above.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import QRCode from 'react-native-qrcode-svg';

const APP_DOWNLOAD_URL = 'https://ultimatepetanque.app/download';
const APP_LOGO = require('@/assets/images/logo-up-globe.png');

interface WatermarkProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'xs';
  absolute?: boolean;
  hideQR?: boolean;
}

export default function ShareCardWatermark({ variant = 'light', size = 'md', absolute = false, hideQR = false }: WatermarkProps) {
  const isDark = variant === 'dark';
  const isSm = size === 'sm' || size === 'xs';
  const isXs = size === 'xs';
  const textColor = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)';
  const subtextColor = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';
  const bgColor = isDark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const qrSize = isXs ? 22 : isSm ? 30 : 38;
  const qrColor = isDark ? '#333333' : '#FFFFFF';
  const qrBgColor = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.05)';

  const logoSize = isXs ? 28 : isSm ? 36 : 44;

  return (
    <View style={[
      s.container,
      isSm && s.containerSm,
      isXs && s.containerXs,
      absolute && s.absolute,
    ]}>
      <View style={[s.inner, { backgroundColor: bgColor }, isSm && s.innerSm, isXs && s.innerXs]}>
        {/* App Logo — new globe with crown */}
        <View style={[s.logoWrap, { width: logoSize, height: logoSize }]}>
          <Image
            source={APP_LOGO}
            style={{ width: logoSize, height: logoSize }}
            contentFit="contain"
            transition={0}
          />
        </View>
        <View style={{ flex: 1, flexShrink: 1 }}>
          <Text style={[s.appName, { color: textColor }, isSm && s.appNameSm, isXs && s.appNameXs]} numberOfLines={1}>
            Ultimate Petanque
          </Text>
          {!isXs ? (
            <Text style={[s.tagline, { color: subtextColor }, isSm && s.taglineSm]} numberOfLines={1}>
              {isSm ? 'ultimatepetanque.app' : 'Scannez pour telecharger'}
            </Text>
          ) : null}
        </View>
        {!hideQR ? (
          <View style={[s.qrWrap, { backgroundColor: qrBgColor }, isSm && s.qrWrapSm, isXs && s.qrWrapXs]}>
            <QRCode value={APP_DOWNLOAD_URL} size={qrSize} color={qrColor} backgroundColor="transparent" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    // REMOVED marginTop: 'auto' — this was causing the watermark to be
    // pushed outside the visible card area when content overflows
    flexShrink: 0, // Prevent watermark from being compressed
  },
  containerSm: {
    paddingTop: 6,
    paddingBottom: 3,
  },
  containerXs: {
    paddingTop: 4,
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
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  innerSm: {
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  innerXs: {
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  logoWrap: {
    // No background — the logo itself has the visual
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrWrap: {
    borderRadius: 6,
    padding: 3,
    overflow: 'hidden' as const,
  },
  qrWrapSm: {
    borderRadius: 5,
    padding: 2.5,
  },
  qrWrapXs: {
    borderRadius: 4,
    padding: 2,
  },
  appName: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  appNameSm: { fontSize: 12, fontWeight: '800' },
  appNameXs: { fontSize: 10, fontWeight: '700' },
  tagline: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  taglineSm: { fontSize: 8 },
});
