import { config } from '@/constants/config';

/** Landing URL encoded in invite QRs and social-share watermarks. */
export function getAppDownloadUrl(): string {
  return config.appDownloadUrl;
}

export function getIosAppStoreUrl(): string {
  return config.iosAppStoreUrl || '';
}

export function getAndroidPlayStoreUrl(): string {
  return config.androidPlayStoreUrl || '';
}

export function hasStoreListings(): boolean {
  return !!(getIosAppStoreUrl() || getAndroidPlayStoreUrl());
}

export function detectMobileStore(os: string, userAgent?: string): 'ios' | 'android' | null {
  if (os === 'ios') return 'ios';
  if (os === 'android') return 'android';
  if (os === 'web' && userAgent) {
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
    if (/Android/i.test(userAgent)) return 'android';
  }
  return null;
}

/** Store URL for this device when published; otherwise the smart download page. */
export function getPreferredStoreUrl(os: string, userAgent?: string): string {
  const kind = detectMobileStore(os, userAgent);
  if (kind === 'ios' && getIosAppStoreUrl()) return getIosAppStoreUrl();
  if (kind === 'android' && getAndroidPlayStoreUrl()) return getAndroidPlayStoreUrl();
  return getAppDownloadUrl();
}

export function buildAppDownloadLink(query?: Record<string, string | undefined | null>): string {
  const base = getAppDownloadUrl().replace(/\/$/, '');
  if (!query) return base;
  const params = Object.entries(query)
    .filter(([, value]) => !!value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length ? `${base}?${params.join('&')}` : base;
}

export function buildAppShareMessage(fr: boolean): string {
  const lines = [
    fr ? 'Telecharge Ultimate Petanque :' : 'Download Ultimate Petanque:',
    getAppDownloadUrl(),
  ];
  if (getIosAppStoreUrl()) {
    lines.push(`iOS: ${getIosAppStoreUrl()}`);
  }
  if (getAndroidPlayStoreUrl()) {
    lines.push(`Android: ${getAndroidPlayStoreUrl()}`);
  }
  return lines.join('\n');
}
