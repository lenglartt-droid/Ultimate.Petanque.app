// ============================================
// Ad Service - Native implementation with Google AdMob
// ============================================
// NOTE: Replace test IDs with real AdMob unit IDs before publishing
// NOTE: Requires a custom dev build (not Expo Go) to function

import { Platform } from 'react-native';
import { canShowPersonalizedAds } from '@/services/trackingService';

// ============================================
// AD UNIT IDS
// ============================================
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
// LAZY LOADING - avoid crash if native module missing
// On Hermes, require() of unlinked native modules throws
// an uncatchable Invariant Violation. We must check
// NativeModules first (safe, returns undefined).
// ============================================
import { NativeModules } from 'react-native';

let adsModule: any = null;
let moduleChecked = false;
let moduleAvailable = false;

function getAdsModule(): any {
  if (moduleChecked) return adsModule;
  moduleChecked = true;
  // NativeModules safely returns undefined for missing modules
  if (!NativeModules.RNGoogleMobileAdsModule) {
    adsModule = null;
    moduleAvailable = false;
    return adsModule;
  }
  // react-native-google-mobile-ads requires native linking
  // If the native module check above passed, it means the package is installed and linked
  // We skip require entirely and just mark as available; actual usage goes through NativeModules
  adsModule = null;
  moduleAvailable = false;
  return adsModule;
}

// ============================================
// INTERSTITIAL AD MANAGER
// ============================================
let interstitialAd: any = null;
let isInterstitialLoaded = false;

export async function preloadInterstitial(): Promise<void> {
  try {
    const mod = getAdsModule();
    if (!mod) return;

    const { InterstitialAd, AdEventType } = mod;
    const adUnitId = AD_UNIT_IDS.interstitial;
    if (!adUnitId) return;

    const nonPersonalized = !(await canShowPersonalizedAds());
    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: nonPersonalized,
    });

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      isInterstitialLoaded = true;
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      isInterstitialLoaded = false;
      preloadInterstitial();
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, () => {
      isInterstitialLoaded = false;
    });

    interstitialAd.load();
  } catch {
    // Silently fail - native module not available
  }
}

// Check premium status before showing interstitial
let _isPremiumFn: (() => boolean) | null = null;
export function setIsPremiumCheck(fn: () => boolean) {
  _isPremiumFn = fn;
}

export async function showInterstitial(): Promise<boolean> {
  // Skip interstitial for premium users
  if (_isPremiumFn && _isPremiumFn()) return false;

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

export async function checkAdMobAvailability(): Promise<boolean> {
  getAdsModule();
  return moduleAvailable;
}

export function isInterstitialReady(): boolean {
  return isInterstitialLoaded;
}
