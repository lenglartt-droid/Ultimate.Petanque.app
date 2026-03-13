// ============================================
// AdBanner - Reusable Google AdMob Banner Component
// ============================================
// Only renders on native platforms with AdMob available
// Gracefully falls back to empty view in Expo Go/web

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import theme from '@/constants/theme';

interface AdBannerProps {
  /** Position: inline (in scroll), or sticky (bottom of screen) */
  position?: 'inline' | 'sticky';
  /** Extra bottom padding for sticky banners (e.g. tab bar height) */
  bottomOffset?: number;
}

const AdBanner = React.memo(({ position = 'inline', bottomOffset = 0 }: AdBannerProps) => {
  const [AdComponent, setAdComponent] = useState<any>(null);
  const [adSize, setAdSize] = useState<any>(null);
  const [adUnitId, setAdUnitId] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Only attempt on native platforms
    if (Platform.OS === 'web') return;

    (async () => {
      try {
        const admob = await import('react-native-google-mobile-ads');
        const { AD_UNIT_IDS } = await import('@/services/adService');
        
        setAdComponent(() => admob.BannerAd);
        setAdSize(admob.BannerAdSize.ANCHORED_ADAPTIVE_BANNER);
        setAdUnitId(AD_UNIT_IDS.banner);
        setIsAvailable(true);
      } catch {
        // AdMob not available
        setIsAvailable(false);
      }
    })();
  }, []);

  if (!isAvailable || !AdComponent || !adUnitId || !adSize) {
    return null;
  }

  const BannerAdComponent = AdComponent;

  if (position === 'sticky') {
    return (
      <View style={[styles.stickyContainer, { paddingBottom: bottomOffset }]}>
        <BannerAdComponent
          unitId={adUnitId}
          size={adSize}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={() => setIsAvailable(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.inlineContainer}>
      <BannerAdComponent
        unitId={adUnitId}
        size={adSize}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setIsAvailable(false)}
      />
    </View>
  );
});

export default AdBanner;

const styles = StyleSheet.create({
  inlineContainer: {
    alignItems: 'center',
    marginVertical: 12,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  stickyContainer: {
    alignItems: 'center',
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
});
