// ============================================
// AdBanner - Native implementation with Google AdMob
// Gracefully degrades if native module is not linked
// ============================================
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { AD_UNIT_IDS } from '@/services/adService';
import { useApp } from '@/contexts/AppContext';
import { canShowPersonalizedAds } from '@/services/trackingService';
import theme from '@/constants/theme';

interface AdBannerProps {
  position?: 'inline' | 'sticky';
  bottomOffset?: number;
}

import { NativeModules } from 'react-native';

// Lazy-load the ads module to avoid crash if native module is missing.
// On Hermes, require() of unlinked TurboModules throws an uncatchable
// Invariant Violation. Check NativeModules first (safe, returns undefined).
let BannerAdComponent: any = null;
let BannerAdSizeEnum: any = null;
let adsModuleLoaded = false;
let adsModuleAvailable = false;

function loadAdsModule() {
  if (adsModuleLoaded) return;
  adsModuleLoaded = true;
  // NativeModules safely returns undefined for missing modules
  if (!NativeModules.RNGoogleMobileAdsModule) {
    adsModuleAvailable = false;
    return;
  }
  try {
    const mod = require('react-native-google-mobile-ads');
    BannerAdComponent = mod.BannerAd;
    BannerAdSizeEnum = mod.BannerAdSize;
    adsModuleAvailable = true;
  } catch {
    adsModuleAvailable = false;
  }
}

const AdBanner = React.memo(({ position = 'inline', bottomOffset = 0 }: AdBannerProps) => {
  const [isAvailable, setIsAvailable] = useState(true);
  const [nonPersonalized, setNonPersonalized] = useState(true);
  let isPremium = false;
  try { isPremium = useApp().isPremium; } catch { /* outside provider */ }

  useEffect(() => {
    loadAdsModule();
    if (!adsModuleAvailable) {
      setIsAvailable(false);
    }
    canShowPersonalizedAds().then(can => setNonPersonalized(!can));
  }, []);

  // Hide ads for premium users
  if (isPremium) return null;

  if (!isAvailable || !adsModuleAvailable || !BannerAdComponent || !AD_UNIT_IDS.banner) {
    return null;
  }

  if (position === 'sticky') {
    return (
      <View style={[styles.stickyContainer, { paddingBottom: bottomOffset }]}>
        <BannerAdComponent
          unitId={AD_UNIT_IDS.banner}
          size={BannerAdSizeEnum.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: nonPersonalized }}
          onAdFailedToLoad={() => setIsAvailable(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.inlineContainer}>
      <BannerAdComponent
        unitId={AD_UNIT_IDS.banner}
        size={BannerAdSizeEnum.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: nonPersonalized }}
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
