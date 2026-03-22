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
  eventType: 'profile_view' | 'social_click' | 'banner_impression' | 'sponsored_challenge',
  socialPlatform?: string,
  options?: { sourcePage?: string; viewerId?: string }
) {
  const supabase = getSupabaseClient();
  supabase
    .from('ambassador_analytics')
    .insert({
      ambassador_id: ambassadorId,
      event_type: eventType,
      social_platform: socialPlatform || null,
      source_page: options?.sourcePage || null,
      viewer_id: options?.viewerId || null,
    })
    .then(() => {})
    .catch(() => {});
}

/**
 * Fetch aggregated analytics for all ambassadors (admin only).
 */
export async function fetchAmbassadorAnalytics(period?: 'today' | '7d' | '30d' | 'all'): Promise<{
  stats: Map<string, AmbassadorAnalytics>;
  error: string | null;
}> {
  const supabase = getSupabaseClient();
  try {
    let query = supabase
      .from('ambassador_analytics')
      .select('ambassador_id, event_type, social_platform');

    if (period && period !== 'all') {
      const now = new Date();
      let threshold: Date;
      switch (period) {
        case 'today':
          threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '7d':
          threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          threshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          threshold = new Date(0);
      }
      query = query.gte('created_at', threshold.toISOString());
    }

    const { data, error } = await query;

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

/**
 * Fetch sponsored challenge event counts per ambassador (admin only).
 */
export async function fetchSponsoredChallengeAnalytics(period?: 'today' | '7d' | '30d' | 'all'): Promise<{
  counts: Map<string, number>;
  error: string | null;
}> {
  const supabase = getSupabaseClient();
  try {
    let query = supabase
      .from('ambassador_analytics')
      .select('ambassador_id')
      .eq('event_type', 'sponsored_challenge');

    if (period && period !== 'all') {
      const now = new Date();
      let threshold: Date;
      switch (period) {
        case 'today':
          threshold = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case '7d':
          threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          threshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          threshold = new Date(0);
      }
      query = query.gte('created_at', threshold.toISOString());
    }

    const { data, error } = await query;
    if (error) return { counts: new Map(), error: error.message };

    const counts = new Map<string, number>();
    (data || []).forEach((row: any) => {
      counts.set(row.ambassador_id, (counts.get(row.ambassador_id) || 0) + 1);
    });

    return { counts, error: null };
  } catch (e: any) {
    return { counts: new Map(), error: e.message || 'Failed to fetch sponsored challenge analytics' };
  }
}

/**
 * Fetch daily sponsored_challenge counts for sparkline (admin only).
 * Returns a Map of ambassadorId -> array of daily counts (oldest first, 30 days).
 */
export async function fetchDailySponsoredChallengeCounts(days: number = 30): Promise<{
  data: Map<string, number[]>;
  error: string | null;
}> {
  const supabase = getSupabaseClient();
  try {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('ambassador_analytics')
      .select('ambassador_id, created_at')
      .eq('event_type', 'sponsored_challenge')
      .gte('created_at', threshold.toISOString());

    if (error) return { data: new Map(), error: error.message };

    const allDates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      allDates.push(d.toISOString().slice(0, 10));
    }

    const grouped = new Map<string, Map<string, number>>();
    (data || []).forEach((row: any) => {
      if (!grouped.has(row.ambassador_id)) grouped.set(row.ambassador_id, new Map());
      const dateStr = new Date(row.created_at).toISOString().slice(0, 10);
      const dayMap = grouped.get(row.ambassador_id)!;
      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
    });

    const result = new Map<string, number[]>();
    grouped.forEach((dayMap, ambId) => {
      result.set(ambId, allDates.map(date => dayMap.get(date) || 0));
    });

    return { data: result, error: null };
  } catch (e: any) {
    return { data: new Map(), error: e.message || 'Failed to fetch daily sponsored challenge counts' };
  }
}

/**
 * Fetch daily impression counts per ambassador for sparkline display (admin only).
 * Returns a Map of ambassadorId -> array of daily counts (oldest first).
 */
/**
 * Fetch detailed banner analytics for a specific ambassador.
 * Returns impressions by page, click-through rate, unique reach, and daily evolution.
 */
export interface BannerDetailedAnalytics {
  impressionsByPage: Record<string, number>;
  clicksByPage: Record<string, number>;
  totalImpressions: number;
  totalClicks: number;
  clickThroughRate: number;
  uniqueViewers: number;
  dailyImpressions: number[]; // oldest first
  dailyClicks: number[];
  dailyDates: string[];
}

export async function fetchDetailedBannerAnalytics(
  ambassadorId: string,
  days: number = 30
): Promise<{ data: BannerDetailedAnalytics; error: string | null }> {
  const supabase = getSupabaseClient();
  const empty: BannerDetailedAnalytics = {
    impressionsByPage: {},
    clicksByPage: {},
    totalImpressions: 0,
    totalClicks: 0,
    clickThroughRate: 0,
    uniqueViewers: 0,
    dailyImpressions: [],
    dailyClicks: [],
    dailyDates: [],
  };
  try {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('ambassador_analytics')
      .select('event_type, source_page, viewer_id, created_at')
      .eq('ambassador_id', ambassadorId)
      .in('event_type', ['banner_impression', 'profile_view', 'social_click'])
      .gte('created_at', threshold.toISOString());

    if (error) return { data: empty, error: error.message };

    // Build date keys
    const allDates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      allDates.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    }

    const impressionsByPage: Record<string, number> = {};
    const clicksByPage: Record<string, number> = {};
    let totalImpressions = 0;
    let totalClicks = 0;
    const uniqueViewerSet = new Set<string>();
    const dailyImpMap = new Map<string, number>();
    const dailyClickMap = new Map<string, number>();

    (data || []).forEach((row: any) => {
      const page = row.source_page || 'unknown';
      const dateStr = new Date(row.created_at).toISOString().slice(0, 10);
      if (row.viewer_id) uniqueViewerSet.add(row.viewer_id);

      if (row.event_type === 'banner_impression') {
        totalImpressions++;
        impressionsByPage[page] = (impressionsByPage[page] || 0) + 1;
        dailyImpMap.set(dateStr, (dailyImpMap.get(dateStr) || 0) + 1);
      } else if (row.event_type === 'profile_view' || row.event_type === 'social_click') {
        totalClicks++;
        clicksByPage[page] = (clicksByPage[page] || 0) + 1;
        dailyClickMap.set(dateStr, (dailyClickMap.get(dateStr) || 0) + 1);
      }
    });

    return {
      data: {
        impressionsByPage,
        clicksByPage,
        totalImpressions,
        totalClicks,
        clickThroughRate: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0,
        uniqueViewers: uniqueViewerSet.size,
        dailyImpressions: allDates.map(d => dailyImpMap.get(d) || 0),
        dailyClicks: allDates.map(d => dailyClickMap.get(d) || 0),
        dailyDates: allDates,
      },
      error: null,
    };
  } catch (e: any) {
    return { data: empty, error: e.message || 'Failed to fetch banner analytics' };
  }
}

export async function fetchDailyAnalyticsCounts(days: number = 30): Promise<{
  data: Map<string, number[]>;
  error: string | null;
}> {
  const supabase = getSupabaseClient();
  try {
    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('ambassador_analytics')
      .select('ambassador_id, event_type, created_at')
      .gte('created_at', threshold.toISOString());

    if (error) return { data: new Map(), error: error.message };

    // Build all date keys (oldest first)
    const allDates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      allDates.push(d.toISOString().slice(0, 10));
    }

    // Group by ambassador_id and date
    const grouped = new Map<string, Map<string, number>>();
    (data || []).forEach((row: any) => {
      if (!grouped.has(row.ambassador_id)) grouped.set(row.ambassador_id, new Map());
      const dateStr = new Date(row.created_at).toISOString().slice(0, 10);
      const dayMap = grouped.get(row.ambassador_id)!;
      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
    });

    // Build result with 0-filled days
    const result = new Map<string, number[]>();
    grouped.forEach((dayMap, ambId) => {
      result.set(ambId, allDates.map(date => dayMap.get(date) || 0));
    });

    return { data: result, error: null };
  } catch (e: any) {
    return { data: new Map(), error: e.message || 'Failed to fetch daily analytics' };
  }
}
