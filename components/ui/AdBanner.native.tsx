// ============================================
// AdBanner - Native implementation with Google AdMob
// ============================================
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS } from '@/services/adService';
import theme from '@/constants/theme';

interface AdBannerProps {
  position?: 'inline' | 'sticky';
  bottomOffset?: number;
}

const AdBanner = React.memo(({ position = 'inline', bottomOffset = 0 }: AdBannerProps) => {
  const [isAvailable, setIsAvailable] = useState(true);

  if (!isAvailable || !AD_UNIT_IDS.banner) {
    return null;
  }

  if (position === 'sticky') {
    return (
      <View style={[styles.stickyContainer, { paddingBottom: bottomOffset }]}>
        <BannerAd
          unitId={AD_UNIT_IDS.banner}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={() => setIsAvailable(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.inlineContainer}>
      <BannerAd
        unitId={AD_UNIT_IDS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
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
