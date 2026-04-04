/**
 * Share Card Service
 * Captures React Native views as images and shares via native sheet.
 * Uses react-native-view-shot + expo-sharing.
 */
import { Platform } from 'react-native';

export type ShareCardFormat = 'square' | 'story' | 'landscape';

export const CARD_DIMENSIONS: Record<ShareCardFormat, { width: number; height: number; label: string; labelFr: string; icon: string }> = {
  square: { width: 1080, height: 1080, label: 'Square', labelFr: 'Carre', icon: 'crop-square' },
  story: { width: 1080, height: 1920, label: 'Story', labelFr: 'Story', icon: 'crop-portrait' },
  landscape: { width: 1200, height: 630, label: 'Landscape', labelFr: 'Paysage', icon: 'crop-landscape' },
};

/**
 * Capture a view ref as a PNG image URI.
 */
export async function captureCardAsImage(viewRef: any): Promise<string | null> {
  try {
    const ViewShot = require('react-native-view-shot');
    const uri = await ViewShot.captureRef(viewRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    return uri;
  } catch (e) {
    console.log('[ShareCard] Capture error:', e);
    return null;
  }
}

/**
 * Share a captured image via native share sheet.
 */
export async function shareImage(uri: string, title?: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      // Web: download the image
      const a = document.createElement('a');
      a.href = uri;
      a.download = `${title || 'share-card'}.png`;
      a.click();
      return true;
    }
    const Sharing = require('expo-sharing');
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      console.log('[ShareCard] Sharing not available');
      return false;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: title || 'Share',
      UTI: 'public.png',
    });
    return true;
  } catch (e) {
    console.log('[ShareCard] Share error:', e);
    return false;
  }
}

/**
 * Capture and share in one step.
 */
export async function captureAndShare(viewRef: any, title?: string): Promise<boolean> {
  const uri = await captureCardAsImage(viewRef);
  if (!uri) return false;
  return shareImage(uri, title);
}
