import { NativeModules, TurboModuleRegistry } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleMobileAdsModule = any;

let cachedModule: GoogleMobileAdsModule | null | undefined;
let nativeModulePresenceCached: boolean | undefined;

/**
 * Whether the native AdMob TurboModule / legacy NativeModule is actually
 * registered in the current binary.
 *
 * IMPORTANT: `require('react-native-google-mobile-ads')` triggers
 * `TurboModuleRegistry.getEnforcing('RNGoogleMobileAdsModule')` at module
 * initialization time. When the native module is missing (Expo Go, some
 * dev builds, Android emulator without linked module), this throws a
 * `TurboModuleRegistry.getEnforcing` Invariant Violation that Hermes
 * propagates as a `JavascriptException` up to native code, even when the
 * `require` call is wrapped in try/catch.
 *
 * We therefore pre-check the module registration via `TurboModuleRegistry.get`
 * (returns `null` instead of throwing) and legacy `NativeModules` BEFORE
 * requiring the JS package. This guarantees `require` is only executed when
 * the native module is available.
 */
function isNativeModuleRegistered(): boolean {
  if (nativeModulePresenceCached !== undefined) return nativeModulePresenceCached;

  try {
    // TurboModuleRegistry.get returns null if the module can't be found (does not throw)
    const turboGet = (TurboModuleRegistry as unknown as { get?: (name: string) => unknown })?.get;
    if (typeof turboGet === 'function') {
      const turboMod = turboGet('RNGoogleMobileAdsModule');
      if (turboMod) {
        nativeModulePresenceCached = true;
        return true;
      }
    }
  } catch {
    // ignore
  }

  try {
    // Legacy NativeModules fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacy = (NativeModules as any)?.RNGoogleMobileAdsModule;
    if (legacy) {
      nativeModulePresenceCached = true;
      return true;
    }
  } catch {
    // ignore
  }

  nativeModulePresenceCached = false;
  return false;
}

/** Lazy-load react-native-google-mobile-ads.
 * We intentionally use `any` typing (rather than `typeof import(...)`) so that
 * bundlers that scan for top-level imports (e.g. Metro on web) never try to
 * resolve the native-only package even at the type level.
 */
export function getGoogleMobileAdsModule(): GoogleMobileAdsModule | null {
  if (cachedModule !== undefined) return cachedModule;

  // Pre-flight guard: never require the package if the native TurboModule is not registered.
  // This prevents the `TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could
  // not be found.` Invariant Violation that escapes JS try/catch in Hermes.
  if (!isNativeModuleRegistered()) {
    cachedModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-google-mobile-ads') as GoogleMobileAdsModule;

    if (!mod?.BannerAd || !mod?.BannerAdSize) {
      cachedModule = null;
      return null;
    }

    cachedModule = mod;
  } catch {
    cachedModule = null;
  }

  return cachedModule;
}

export function isGoogleMobileAdsAvailable(): boolean {
  return getGoogleMobileAdsModule() !== null;
}
