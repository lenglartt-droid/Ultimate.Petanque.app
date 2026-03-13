// ============================================
// AdMob Service - Google Mobile Ads Integration
// ============================================
// NOTE: Ads only work in custom dev builds (not Expo Go/Live Preview)
// Replace test IDs with real AdMob unit IDs before publishing

import { Platform } from 'react-native';

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
let interstitialAd: any = null;
let isInterstitialLoaded = false;
let isAdMobAvailable = false;
let InterstitialAdClass: any = null;
let AdEventTypeEnum: any = null;
let TestIdsRef: any = null;

// Lazy-load the library to prevent crashes in Expo Go/Live Preview
async function ensureAdMobLoaded(): Promise<boolean> {
  if (isAdMobAvailable) return true;
  
  try {
    const admob = await import('react-native-google-mobile-ads');
    InterstitialAdClass = admob.InterstitialAd;
    AdEventTypeEnum = admob.AdEventType;
    TestIdsRef = admob.TestIds;
    isAdMobAvailable = true;
    return true;
  } catch {
    // Library not available (Expo Go, web, or not installed)
    isAdMobAvailable = false;
    return false;
  }
}

/**
 * Pre-load an interstitial ad so it is ready to show immediately
 */
export async function preloadInterstitial(): Promise<void> {
  const available = await ensureAdMobLoaded();
  if (!available || !InterstitialAdClass || !AdEventTypeEnum) return;

  try {
    const adUnitId = AD_UNIT_IDS.interstitial;
    interstitialAd = InterstitialAdClass.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitialAd.addAdEventListener(AdEventTypeEnum.LOADED, () => {
      isInterstitialLoaded = true;
    });

    interstitialAd.addAdEventListener(AdEventTypeEnum.CLOSED, () => {
      isInterstitialLoaded = false;
      // Preload the next one
      preloadInterstitial();
    });

    interstitialAd.addAdEventListener(AdEventTypeEnum.ERROR, () => {
      isInterstitialLoaded = false;
    });

    interstitialAd.load();
  } catch {
    // Silently fail
  }
}

/**
 * Show the interstitial ad if loaded, otherwise skip
 * Returns true if ad was shown, false otherwise
 */
export async function showInterstitial(): Promise<boolean> {
  if (!isAdMobAvailable || !isInterstitialLoaded || !interstitialAd) {
    // Ad not ready, preload for next time
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
 * Check if AdMob library is available (not in Expo Go/web)
 */
export async function checkAdMobAvailability(): Promise<boolean> {
  return ensureAdMobLoaded();
}

/**
 * Check if an interstitial is ready to show
 */
export function isInterstitialReady(): boolean {
  return isAdMobAvailable && isInterstitialLoaded;
}
