/**
 * Badge Service — Gamification engine.
 * Defines 10 badges, checks unlock conditions, manages XP, and persists to DB.
 */
import { getSupabaseClient } from '@/template';

// ============================================
// TYPES
// ============================================
export interface BadgeDefinition {
  id: string;
  icon: string;
  color: string;
  xpReward: number;
  condition: (ctx: BadgeContext) => boolean;
}

export interface UserBadge {
  badgeId: string;
  unlockedAt: string;
}

export interface BadgeContext {
  matchCount: number;
  winRate: number;
  tirRate: number;
  carreauRate: number;
  totalCarreaux: number;
  sharedAcceptedCount: number;
  invitedUsersCount: number; // not tracked yet — placeholder
  uniqueTerrainsPlayed: number;
  leaderboardRank: number | null;
  consecutiveDaysPlayed: number;
  isAmbassador: boolean;
}

// ============================================
// XP LEVELS
// ============================================
export const XP_LEVELS = [
  { name: 'Débutant', nameEn: 'Beginner', minXp: 0, icon: 'school' },
  { name: 'Intermédiaire', nameEn: 'Intermediate', minXp: 50, icon: 'trending-up' },
  { name: 'Confirmé', nameEn: 'Advanced', minXp: 200, icon: 'stars' },
  { name: 'Expert', nameEn: 'Expert', minXp: 500, icon: 'emoji-events' },
] as const;

export function getLevelFromXp(xp: number): typeof XP_LEVELS[number] {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].minXp) return XP_LEVELS[i];
  }
  return XP_LEVELS[0];
}

export function getNextLevel(xp: number): { level: typeof XP_LEVELS[number]; xpNeeded: number } | null {
  const currentIdx = XP_LEVELS.findIndex((l, i) => {
    const next = XP_LEVELS[i + 1];
    return next ? xp < next.minXp : true;
  });
  if (currentIdx >= XP_LEVELS.length - 1) return null;
  const next = XP_LEVELS[currentIdx + 1];
  return { level: next, xpNeeded: next.minXp - xp };
}

export function getXpProgress(xp: number): { current: number; max: number; percent: number } {
  const currentLevel = getLevelFromXp(xp);
  const currentIdx = XP_LEVELS.indexOf(currentLevel);
  if (currentIdx >= XP_LEVELS.length - 1) {
    return { current: xp, max: xp, percent: 100 };
  }
  const nextLevel = XP_LEVELS[currentIdx + 1];
  const levelStart = currentLevel.minXp;
  const levelEnd = nextLevel.minXp;
  const progress = xp - levelStart;
  const range = levelEnd - levelStart;
  return { current: progress, max: range, percent: Math.min(100, Math.round((progress / range) * 100)) };
}

// ============================================
// XP REWARDS (per-action, not badge-related)
// ============================================
export const XP_PER_MATCH = 10;
export const XP_PER_CARREAU = 5;
export const XP_PER_SHARE_ACCEPTED = 15;
export const XP_PER_BADGE = 50;

// ============================================
// BADGE DEFINITIONS
// ============================================
export const BADGES: BadgeDefinition[] = [
  {
    id: 'premier_lancer',
    icon: 'sports',
    color: '#10B981',
    xpReward: 50,
    condition: (ctx) => ctx.matchCount >= 1,
  },
  {
    id: 'statisticien',
    icon: 'bar-chart',
    color: '#3B82F6',
    xpReward: 50,
    condition: (ctx) => ctx.matchCount >= 5,
  },
  {
    id: 'oeil_de_lynx',
    icon: 'gps-fixed',
    color: '#8B5CF6',
    xpReward: 50,
    condition: (ctx) => ctx.matchCount >= 10 && ctx.tirRate >= 70,
  },
  {
    id: 'roi_du_carreau',
    icon: 'star',
    color: '#F59E0B',
    xpReward: 50,
    condition: (ctx) => ctx.totalCarreaux >= 10,
  },
  {
    id: 'social_player',
    icon: 'handshake',
    color: '#EC4899',
    xpReward: 50,
    condition: (ctx) => ctx.sharedAcceptedCount >= 1,
  },
  {
    id: 'recruteur',
    icon: 'campaign',
    color: '#06B6D4',
    xpReward: 50,
    condition: (ctx) => ctx.invitedUsersCount >= 3,
  },
  {
    id: 'explorateur',
    icon: 'explore',
    color: '#14B8A6',
    xpReward: 50,
    condition: (ctx) => ctx.uniqueTerrainsPlayed >= 5,
  },
  {
    id: 'classe',
    icon: 'emoji-events',
    color: '#EF4444',
    xpReward: 50,
    condition: (ctx) => ctx.leaderboardRank !== null && ctx.leaderboardRank <= 100,
  },
  {
    id: 'en_feu',
    icon: 'local-fire-department',
    color: '#F97316',
    xpReward: 50,
    condition: (ctx) => ctx.consecutiveDaysPlayed >= 7,
  },
  {
    id: 'ambassadeur',
    icon: 'verified',
    color: '#7C3AED',
    xpReward: 100,
    condition: (ctx) => ctx.isAmbassador,
  },
];

// ============================================
// BADGE NAMES (i18n inline to keep it self-contained)
// ============================================
export function getBadgeName(badgeId: string, lang: 'fr' | 'en'): string {
  const names: Record<string, { fr: string; en: string }> = {
    premier_lancer: { fr: 'Premier Lancer', en: 'First Throw' },
    statisticien: { fr: 'Statisticien', en: 'Statistician' },
    oeil_de_lynx: { fr: 'Oeil de Lynx', en: 'Eagle Eye' },
    roi_du_carreau: { fr: 'Roi du Carreau', en: 'Carreau King' },
    social_player: { fr: 'Social Player', en: 'Social Player' },
    recruteur: { fr: 'Recruteur', en: 'Recruiter' },
    explorateur: { fr: 'Explorateur', en: 'Explorer' },
    classe: { fr: 'Classé', en: 'Ranked' },
    en_feu: { fr: 'En Feu', en: 'On Fire' },
    ambassadeur: { fr: 'Ambassadeur', en: 'Ambassador' },
  };
  return names[badgeId]?.[lang] || badgeId;
}

export function getBadgeDescription(badgeId: string, lang: 'fr' | 'en'): string {
  const descs: Record<string, { fr: string; en: string }> = {
    premier_lancer: { fr: '1er match enregistré', en: '1st match recorded' },
    statisticien: { fr: '5 matchs enregistrés', en: '5 matches recorded' },
    oeil_de_lynx: { fr: '70%+ taux de tir sur 10+ matchs', en: '70%+ shot rate on 10+ matches' },
    roi_du_carreau: { fr: '10 carreaux en carrière', en: '10 carreaux in career' },
    social_player: { fr: '1er match partagé accepté', en: '1st shared match accepted' },
    recruteur: { fr: '3 joueurs invités inscrits', en: '3 invited players registered' },
    explorateur: { fr: '5 terrains différents joués', en: '5 different courts played' },
    classe: { fr: 'Entrer dans le top 100', en: 'Enter the top 100' },
    en_feu: { fr: '7 jours consécutifs avec un match', en: '7 consecutive days with a match' },
    ambassadeur: { fr: 'Devenir ambassadeur officiel', en: 'Become official ambassador' },
  };
  return descs[badgeId]?.[lang] || '';
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Load user badges and XP from DB.
 */
export async function loadUserBadges(userId: string): Promise<{ badges: UserBadge[]; xp: number }> {
  const supabase = getSupabaseClient();
  try {
    const [badgesRes, profileRes] = await Promise.all([
      supabase.from('user_badges').select('badge_id, unlocked_at').eq('user_id', userId),
      supabase.from('user_profiles').select('xp').eq('id', userId).single(),
    ]);

    const badges: UserBadge[] = (badgesRes.data || []).map((b: any) => ({
      badgeId: b.badge_id,
      unlockedAt: b.unlocked_at,
    }));

    const xp = profileRes.data?.xp || 0;

    return { badges, xp };
  } catch (e) {
    console.log('Error loading badges:', e);
    return { badges: [], xp: 0 };
  }
}

/**
 * Build context from app data for badge condition checks.
 */
export function buildBadgeContext(params: {
  matches: any[];
  challenges: any[];
  userStats: any;
  sharedMatchIds: string[];
  userId: string;
  isAmbassador: boolean;
  leaderboardRank: number | null;
}): BadgeContext {
  const { matches, challenges, userStats, sharedMatchIds, userId, isAmbassador, leaderboardRank } = params;

  // Count total carreaux from player actions
  let totalCarreaux = 0;
  matches.forEach((m: any) => {
    if (m.playerActions) {
      m.playerActions.forEach((pa: any) => {
        totalCarreaux += pa.actions?.carreaux || 0;
      });
    }
  });

  // Count unique terrains played
  const terrainSet = new Set<string>();
  matches.forEach((m: any) => {
    if (m.terrainId) terrainSet.add(m.terrainId);
  });

  // Consecutive days with a match
  const matchDates = matches
    .map((m: any) => {
      const d = new Date(m.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    .sort()
    .reverse();

  let consecutiveDays = 0;
  if (matchDates.length > 0) {
    consecutiveDays = 1;
    for (let i = 0; i < matchDates.length - 1; i++) {
      const current = new Date(matchDates[i]);
      const prev = new Date(matchDates[i + 1]);
      const diff = (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (Math.round(diff) === 1) {
        consecutiveDays++;
      } else {
        break;
      }
    }
  }

  return {
    matchCount: matches.length,
    winRate: userStats.winRate || 0,
    tirRate: userStats.tirSuccessRate || 0,
    carreauRate: userStats.carreauRate || 0,
    totalCarreaux,
    sharedAcceptedCount: sharedMatchIds.length,
    invitedUsersCount: 0, // Future feature
    uniqueTerrainsPlayed: terrainSet.size,
    leaderboardRank,
    consecutiveDaysPlayed: consecutiveDays,
    isAmbassador,
  };
}

/**
 * Check for newly unlockable badges and award them.
 * Returns list of newly unlocked badge IDs.
 */
export async function checkAndAwardBadges(
  userId: string,
  context: BadgeContext,
  existingBadges: UserBadge[]
): Promise<string[]> {
  const supabase = getSupabaseClient();
  const existingIds = new Set(existingBadges.map(b => b.badgeId));
  const newlyUnlocked: string[] = [];

  for (const badge of BADGES) {
    if (existingIds.has(badge.id)) continue;
    if (badge.condition(context)) {
      try {
        const { error } = await supabase.from('user_badges').insert({
          user_id: userId,
          badge_id: badge.id,
        });
        if (!error) {
          newlyUnlocked.push(badge.id);
          // Award XP
          await supabase.rpc('', {}).catch(() => {});
          // Manual XP increment
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('xp')
            .eq('id', userId)
            .single();
          const currentXp = profileData?.xp || 0;
          await supabase
            .from('user_profiles')
            .update({ xp: currentXp + badge.xpReward })
            .eq('id', userId);
        }
      } catch (e) {
        console.log('Error awarding badge:', badge.id, e);
      }
    }
  }

  return newlyUnlocked;
}

/**
 * Calculate total XP from matches, carreaux, shares, and badges.
 */
export function calculateTotalXp(params: {
  matchCount: number;
  totalCarreaux: number;
  sharedAcceptedCount: number;
  badgeCount: number;
}): number {
  return (
    params.matchCount * XP_PER_MATCH +
    params.totalCarreaux * XP_PER_CARREAU +
    params.sharedAcceptedCount * XP_PER_SHARE_ACCEPTED +
    params.badgeCount * XP_PER_BADGE
  );
}

/**
 * Sync calculated XP to the database.
 */
export async function syncXpToDb(userId: string, xp: number): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    await supabase.from('user_profiles').update({ xp }).eq('id', userId);
  } catch (e) {
    console.log('Error syncing XP:', e);
  }
}
