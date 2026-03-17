import { Image } from 'expo-image';

/**
 * Image Cache Service
 * Handles prefetching of frequently used images and periodic cache cleanup.
 */

// Track prefetch state to avoid duplicate calls
let lastPrefetchTimestamp = 0;
const PREFETCH_COOLDOWN_MS = 60000; // 1 minute between prefetch batches

// Track cleanup intervals
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
const MEMORY_CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Collect avatar URLs from players array
 */
function collectAvatarUrls(players: { avatar?: string | null }[]): string[] {
  return players
    .filter(p => p.avatar && typeof p.avatar === 'string' && p.avatar.startsWith('http'))
    .map(p => p.avatar as string);
}

/**
 * Collect terrain photo URLs (first photo of each terrain)
 */
function collectTerrainPhotoUrls(terrains: { photos?: string[] | null }[]): string[] {
  return terrains
    .filter(t => t.photos && t.photos.length > 0 && typeof t.photos[0] === 'string' && t.photos[0].startsWith('http'))
    .map(t => t.photos![0]);
}

/**
 * Collect boules set photo URLs
 */
function collectBoulesPhotoUrls(boulesSets: { photo?: string | null }[]): string[] {
  return boulesSets
    .filter(b => b.photo && typeof b.photo === 'string' && b.photo.startsWith('http'))
    .map(b => b.photo as string);
}

/**
 * Prefetch critical images (avatars, terrain thumbnails, boules photos).
 * Batches into groups to avoid overwhelming the network.
 * Respects cooldown to prevent redundant calls.
 */
export async function prefetchImages(data: {
  players?: { avatar?: string | null }[];
  terrains?: { photos?: string[] | null }[];
  boulesSets?: { photo?: string | null }[];
}): Promise<void> {
  const now = Date.now();
  if (now - lastPrefetchTimestamp < PREFETCH_COOLDOWN_MS) return;
  lastPrefetchTimestamp = now;

  const urls: string[] = [];

  if (data.players) {
    urls.push(...collectAvatarUrls(data.players));
  }
  if (data.terrains) {
    urls.push(...collectTerrainPhotoUrls(data.terrains));
  }
  if (data.boulesSets) {
    urls.push(...collectBoulesPhotoUrls(data.boulesSets));
  }

  // Deduplicate
  const uniqueUrls = [...new Set(urls)];

  if (uniqueUrls.length === 0) return;

  // Batch prefetch in groups of 10 to avoid overwhelming the network
  const BATCH_SIZE = 10;
  for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
    const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
    try {
      await Image.prefetch(batch);
    } catch {
      // Silent - prefetch failure should not block the app
    }
  }

  console.log(`Prefetched ${uniqueUrls.length} images`);
}

/**
 * Start periodic memory cache cleanup.
 * Clears memory cache every 30 minutes to prevent OOM while keeping disk cache intact.
 */
export function startPeriodicCacheCleanup(): void {
  if (cleanupIntervalId) return; // Already running

  cleanupIntervalId = setInterval(async () => {
    try {
      await Image.clearMemoryCache();
      console.log('Periodic memory cache cleanup completed');
    } catch {
      // Silent
    }
  }, MEMORY_CLEANUP_INTERVAL_MS);
}

/**
 * Stop periodic cache cleanup (on unmount/logout).
 */
export function stopPeriodicCacheCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

/**
 * Manually clear all image caches (memory + disk).
 * Use sparingly - only for logout or explicit user action.
 */
export async function clearAllImageCache(): Promise<void> {
  try {
    await Promise.all([
      Image.clearMemoryCache(),
      Image.clearDiskCache(),
    ]);
    console.log('All image caches cleared');
  } catch {
    // Silent
  }
}
