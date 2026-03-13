// ============================================
// Ad Service - Native implementation with Google AdMob
// ============================================
// NOTE: Replace test IDs with real AdMob unit IDs before publishing

import { Platform } from 'react-native';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

// ============================================
// AD UNIT IDS
// ============================================
// Google official test IDs - replace with your real IDs for production
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';

export const AD_UNIT_IDS = {
  banner: Platform.select({
    android: TEST_BANNER_ANDROID,
    ios: TEST_BANNER_IOS,
    default: TEST_BANNER_ANDROID,
  }),
  interstitial: Platform.select({
    android: TEST_INTERSTITIAL_ANDROID,
    ios: TEST_INTERSTITIAL_IOS,
    default: TEST_INTERSTITIAL_ANDROID,
  }),
} as const;

// ============================================
// INTERSTITIAL AD MANAGER
// ============================================
let interstitialAd: ReturnType<typeof InterstitialAd.createForAdRequest> | null = null;
let isInterstitialLoaded = false;

/**
 * Pre-load an interstitial ad so it is ready to show immediately
 */
export async function preloadInterstitial(): Promise<void> {
  try {
    const adUnitId = AD_UNIT_IDS.interstitial;
    if (!adUnitId) return;

    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      isInterstitialLoaded = true;
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      isInterstitialLoaded = false;
      // Preload the next one
      preloadInterstitial();
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
      isInterstitialLoaded = false;
    });

    interstitialAd.load();
  } catch {
    // Silently fail
  }
}

/**
 * Show the interstitial ad if loaded, otherwise skip
 */
export async function showInterstitial(): Promise<boolean> {
  if (!isInterstitialLoaded || !interstitialAd) {
    preloadInterstitial();
    return false;
  }

  try {
    await interstitialAd.show();
    return true;
  } catch {
    isInterstitialLoaded = false;
    preloadInterstitial();
    return false;
  }
}

/**
 * Check if AdMob library is available
 */
export async function checkAdMobAvailability(): Promise<boolean> {
  return true;
}

/**
 * Check if an interstitial is ready to show
 */
export function isInterstitialReady(): boolean {
  return isInterstitialLoaded;
}
