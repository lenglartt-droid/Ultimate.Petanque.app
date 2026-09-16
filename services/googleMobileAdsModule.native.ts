// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleMobileAdsModule = any;

let cachedModule: GoogleMobileAdsModule | null | undefined;

/** Lazy-load react-native-google-mobile-ads.
 * Do not depend on a NativeModules key here because the key name can differ
 * between versions/builds. Requiring the package is the reliable check.
 * We intentionally use `any` typing (rather than `typeof import(...)`) so that
 * bundlers that scan for top-level imports (e.g. Metro on web) never try to
 * resolve the native-only package even at the type level.
 */
export function getGoogleMobileAdsModule(): GoogleMobileAdsModule | null {
  if (cachedModule !== undefined) return cachedModule;

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
