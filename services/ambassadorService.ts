import { getSupabaseClient } from '@/template';

export interface Ambassador {
  id: string;
  userId: string;
  playerId?: string;
  displayName: string;
  bio?: string;
  photo?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  instagramHandle?: string;
  twitterHandle?: string;
  websiteUrl?: string;
  isFeatured: boolean;
  badgeType: string;
  // Joined player stats (if available)
  stats?: {
    matchesPlayed: number;
    wins: number;
    winRate: number;
    tirRate: number;
    pointRate: number;
    carreauRate: number;
  };
  role?: string;
  level?: string;
  club?: string;
  city?: string;
}

let cachedAmbassadors: Ambassador[] | null = null;
let cachedAmbassadorUserIds: Set<string> | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute

export async function fetchAmbassadors(): Promise<{ ambassadors: Ambassador[]; error: string | null }> {
  const now = Date.now();
  if (cachedAmbassadors && now - lastFetchTime < CACHE_TTL) {
    return { ambassadors: cachedAmbassadors, error: null };
  }

  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('ambassadors')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return { ambassadors: [], error: error.message };

    const ambassadorRows = data || [];

    // Fetch linked player data for stats
    const playerIds = ambassadorRows.map((a: any) => a.player_id).filter(Boolean);
    let playerMap = new Map<string, any>();
    if (playerIds.length > 0) {
      const { data: playersData } = await supabase
        .from('players')
        .select('id, stats, role, level, club, location')
        .in('id', playerIds);
      if (playersData) {
        playersData.forEach((p: any) => playerMap.set(p.id, p));
      }
    }

    const ambassadors: Ambassador[] = ambassadorRows.map((a: any) => {
      const player = a.player_id ? playerMap.get(a.player_id) : null;
      return {
        id: a.id,
        userId: a.user_id,
        playerId: a.player_id || undefined,
        displayName: a.display_name,
        bio: a.bio || undefined,
        photo: a.photo || undefined,
        youtubeUrl: a.youtube_url || undefined,
        tiktokUrl: a.tiktok_url || undefined,
        instagramHandle: a.instagram_handle || undefined,
        twitterHandle: a.twitter_handle || undefined,
        websiteUrl: a.website_url || undefined,
        isFeatured: a.is_featured,
        badgeType: a.badge_type || 'ambassador',
        stats: player?.stats ? {
          matchesPlayed: player.stats.matchesPlayed || 0,
          wins: player.stats.wins || 0,
          winRate: player.stats.winRate || 0,
          tirRate: player.stats.tirRate || 0,
          pointRate: player.stats.pointRate || 0,
          carreauRate: player.stats.carreauRate || 0,
        } : undefined,
        role: player?.role || undefined,
        level: player?.level || undefined,
        club: player?.club || undefined,
        city: player?.location?.city || undefined,
      };
    });

    cachedAmbassadors = ambassadors;
    cachedAmbassadorUserIds = new Set(ambassadors.map(a => a.userId));
    lastFetchTime = now;

    return { ambassadors, error: null };
  } catch (e: any) {
    return { ambassadors: [], error: e.message || 'Failed to fetch ambassadors' };
  }
}

/** Check if a user is an ambassador (direct DB query, not limited to is_active) */
export async function isUserAmbassador(userId: string): Promise<boolean> {
  // First check the cache for active ambassadors (fast path)
  if (cachedAmbassadorUserIds && Date.now() - lastFetchTime < CACHE_TTL) {
    if (cachedAmbassadorUserIds.has(userId)) return true;
  }
  // If not found in cache, query DB directly (includes inactive ambassadors for portal access)
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('ambassadors')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (error) return false;
    return (data && data.length > 0) || false;
  } catch {
    return false;
  }
}

/** Get the set of ambassador user IDs (for leaderboard badge display) */
export async function getAmbassadorUserIds(): Promise<Set<string>> {
  if (cachedAmbassadorUserIds && Date.now() - lastFetchTime < CACHE_TTL) {
    return cachedAmbassadorUserIds;
  }
  await fetchAmbassadors();
  return cachedAmbassadorUserIds ?? new Set();
}

/** Get featured ambassadors only (for home page widget) */
export async function getFeaturedAmbassadors(): Promise<Ambassador[]> {
  const { ambassadors } = await fetchAmbassadors();
  const featured = ambassadors.filter(a => a.isFeatured);
  return featured.length > 0 ? featured : ambassadors.slice(0, 3);
}

/** Invalidate cache (e.g. after admin changes) */
export function invalidateAmbassadorCache() {
  cachedAmbassadors = null;
  cachedAmbassadorUserIds = null;
  lastFetchTime = 0;
}
