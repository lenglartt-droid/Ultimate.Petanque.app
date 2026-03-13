// ============================================
// Ad Service - Native implementation with Google AdMob
// ============================================
// NOTE: Replace test IDs with real AdMob unit IDs before publishing
// NOTE: Requires a custom dev build (not Expo Go) to function

import { Platform } from 'react-native';

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
// ============================================
let adsModule: any = null;
let moduleChecked = false;
let moduleAvailable = false;

function getAdsModule(): any {
  if (moduleChecked) return adsModule;
  moduleChecked = true;
  try {
    adsModule = require('react-native-google-mobile-ads');
    moduleAvailable = true;
  } catch {
    adsModule = null;
    moduleAvailable = false;
  }
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

    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
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

export async function checkAdMobAvailability(): Promise<boolean> {
  getAdsModule();
  return moduleAvailable;
}

export function isInterstitialReady(): boolean {
  return isInterstitialLoaded;
}
