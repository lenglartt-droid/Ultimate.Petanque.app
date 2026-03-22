import { getSupabaseClient } from '@/template';

export interface AmbassadorAnalytics {
  profileViews: number;
  socialClicks: number;
  bannerImpressions: number;
  socialBreakdown: Record<string, number>;
}

/**
 * Track an ambassador visibility event (fire-and-forget).
 * Deduplication is handled per-session in the calling component.
 */
export function trackAmbassadorEvent(
  ambassadorId: string,
  eventType: 'profile_view' | 'social_click' | 'banner_impression',
  socialPlatform?: string
) {
  const supabase = getSupabaseClient();
  supabase
    .from('ambassador_analytics')
    .insert({
      ambassador_id: ambassadorId,
      event_type: eventType,
      social_platform: socialPlatform || null,
    })
    .then(() => {})
    .catch(() => {});
}

/**
 * Fetch aggregated analytics for all ambassadors (admin only).
 */
export async function fetchAmbassadorAnalytics(): Promise<{
  stats: Map<string, AmbassadorAnalytics>;
  error: string | null;
}> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('ambassador_analytics')
      .select('ambassador_id, event_type, social_platform');

    if (error) return { stats: new Map(), error: error.message };

    const statsMap = new Map<string, AmbassadorAnalytics>();

    (data || []).forEach((row: any) => {
      if (!statsMap.has(row.ambassador_id)) {
        statsMap.set(row.ambassador_id, {
          profileViews: 0,
          socialClicks: 0,
          bannerImpressions: 0,
          socialBreakdown: {},
        });
      }
      const s = statsMap.get(row.ambassador_id)!;
      switch (row.event_type) {
        case 'profile_view':
          s.profileViews++;
          break;
        case 'social_click':
          s.socialClicks++;
          if (row.social_platform) {
            s.socialBreakdown[row.social_platform] =
              (s.socialBreakdown[row.social_platform] || 0) + 1;
          }
          break;
        case 'banner_impression':
          s.bannerImpressions++;
          break;
      }
    });

    return { stats: statsMap, error: null };
  } catch (e: any) {
    return { stats: new Map(), error: e.message || 'Failed to fetch analytics' };
  }
}
