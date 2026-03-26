import { getSupabaseClient } from '@/template';

export type AmbassadorLevel = 'decouverte' | 'confirme' | 'elite';

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
  ambassadorLevel: AmbassadorLevel;
  referralCode?: string;
  referralCount: number;
  totalReferralXp: number;
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
        ambassadorLevel: (a.ambassador_level || 'decouverte') as AmbassadorLevel,
        referralCode: a.referral_code || undefined,
        referralCount: a.referral_count || 0,
        totalReferralXp: a.total_referral_xp || 0,
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

/** Generate a unique referral code for an ambassador */
export async function generateReferralCode(ambassadorId: string, displayName: string): Promise<{ code: string | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    // Generate code from display name initials + random
    const initials = displayName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'AMB';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 5; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    const code = `${initials}-${suffix}`;

    const { error } = await supabase
      .from('ambassadors')
      .update({ referral_code: code, updated_at: new Date().toISOString() })
      .eq('id', ambassadorId);

    if (error) return { code: null, error: error.message };
    invalidateAmbassadorCache();
    return { code, error: null };
  } catch (e: any) {
    return { code: null, error: e.message };
  }
}

/** Track a referral via code */
export async function trackReferral(referralCode: string, referredUserId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    // Find ambassador with this code
    const { data: amb, error: findErr } = await supabase
      .from('ambassadors')
      .select('id, referral_count, total_referral_xp')
      .eq('referral_code', referralCode.toUpperCase().trim())
      .maybeSingle();

    if (findErr || !amb) return { success: false, error: 'Code invalide' };

    // Increment referral count and XP
    const xpPerReferral = 50;
    const { error: upErr } = await supabase
      .from('ambassadors')
      .update({
        referral_count: (amb.referral_count || 0) + 1,
        total_referral_xp: (amb.total_referral_xp || 0) + xpPerReferral,
        updated_at: new Date().toISOString(),
      })
      .eq('id', amb.id);

    if (upErr) return { success: false, error: upErr.message };

    // Track analytics event
    await supabase.from('ambassador_analytics').insert({
      ambassador_id: amb.id,
      event_type: 'referral',
      viewer_id: referredUserId,
      source_page: 'referral_code',
    }).catch(() => {});

    invalidateAmbassadorCache();
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/** Update ambassador level */
export async function updateAmbassadorLevel(ambassadorId: string, level: AmbassadorLevel): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('ambassadors')
      .update({ ambassador_level: level, updated_at: new Date().toISOString() })
      .eq('id', ambassadorId);
    if (error) return { error: error.message };
    invalidateAmbassadorCache();
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Ambassador level configuration */
export const AMBASSADOR_LEVELS = {
  decouverte: {
    color: '#3B82F6',
    icon: 'explore' as const,
    minReferrals: 0,
    minEvents: 0,
    minImpressions: 0,
  },
  confirme: {
    color: '#7C3AED',
    icon: 'trending-up' as const,
    minReferrals: 5,
    minEvents: 3,
    minImpressions: 500,
  },
  elite: {
    color: '#F59E0B',
    icon: 'military-tech' as const,
    minReferrals: 20,
    minEvents: 10,
    minImpressions: 2000,
  },
} as const;
