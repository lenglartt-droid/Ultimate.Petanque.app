// ============================================
// Trust Score Service
// Computes anti-cheat trust score (0-100)
// ============================================
import { getSupabaseClient } from '@/template';

export interface TrustScoreData {
  score: number;
  level: 'high' | 'medium' | 'low' | 'suspicious';
  flags: string[];
}

// Thresholds
const TRUST_HIGH = 75;
const TRUST_MEDIUM = 50;
const TRUST_LOW = 25;

/**
 * Compute a simplified trust score from available leaderboard stats.
 * Used for inline display - no extra DB queries needed.
 */
export function computeQuickTrustScore(player: {
  stats: {
    matchesPlayed: number;
    winRate: number;
    tirRate: number;
    pointRate: number;
    carreauRate: number;
  };
  createdAt?: string;
}): TrustScoreData {
  const flags: string[] = [];
  let score = 100;

  const { matchesPlayed, winRate, tirRate, pointRate, carreauRate } = player.stats;

  // 1. Stats regularity (25 points)
  // Extreme win rates are suspicious
  if (winRate > 95 && matchesPlayed >= 10) {
    score -= 20;
    flags.push('extreme_win_rate');
  } else if (winRate > 90 && matchesPlayed >= 10) {
    score -= 10;
  } else if (winRate < 5 && matchesPlayed >= 10) {
    score -= 15;
    flags.push('extreme_loss_rate');
  }

  // Both tir and point rates > 85% is unusual
  if (tirRate > 85 && pointRate > 85) {
    score -= 15;
    flags.push('unrealistic_combined_rates');
  }

  // Carreau rate > 50% is very suspicious
  if (carreauRate > 50 && matchesPlayed >= 10) {
    score -= 15;
    flags.push('extreme_carreau_rate');
  }

  // 2. Match volume (20 points)
  // More matches = more trusted
  if (matchesPlayed >= 50) {
    score += 0; // neutral, good volume
  } else if (matchesPlayed >= 30) {
    score -= 5;
  } else if (matchesPlayed >= 15) {
    score -= 10;
  } else if (matchesPlayed >= 10) {
    score -= 15;
    flags.push('low_match_count');
  }

  // 3. Account age (20 points)
  if (player.createdAt) {
    const ageMs = Date.now() - new Date(player.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 7) {
      score -= 20;
      flags.push('very_new_account');
    } else if (ageDays < 30) {
      score -= 10;
      flags.push('new_account');
    } else if (ageDays < 90) {
      score -= 5;
    }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  const level: TrustScoreData['level'] =
    score >= TRUST_HIGH ? 'high' :
    score >= TRUST_MEDIUM ? 'medium' :
    score >= TRUST_LOW ? 'low' : 'suspicious';

  return { score, level, flags };
}

/**
 * Get trust score color for display
 */
export function getTrustScoreColor(score: number): string {
  if (score >= 75) return '#22C55E'; // green
  if (score >= 50) return '#D97706'; // amber
  if (score >= 25) return '#F97316'; // orange
  return '#EF4444'; // red
}

/**
 * Get trust level label
 */
export function getTrustLevelLabel(level: TrustScoreData['level'], fr: boolean): string {
  switch (level) {
    case 'high': return fr ? 'Fiable' : 'Trusted';
    case 'medium': return fr ? 'Normal' : 'Normal';
    case 'low': return fr ? 'A surveiller' : 'Watch';
    case 'suspicious': return fr ? 'Suspect' : 'Suspicious';
  }
}

/**
 * Fetch stored trust scores from DB (from Edge Function analysis)
 */
export async function fetchTrustScores(playerIds: string[]): Promise<Map<string, { score: number; flags: string[] }>> {
  const result = new Map<string, { score: number; flags: string[] }>();
  if (playerIds.length === 0) return result;

  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('suspicious_players')
      .select('player_id, trust_score, flags')
      .in('player_id', playerIds);

    if (!error && data) {
      for (const row of data) {
        result.set(row.player_id, {
          score: row.trust_score,
          flags: Array.isArray(row.flags) ? row.flags : [],
        });
      }
    }
  } catch { /* silent */ }

  return result;
}

/**
 * Fetch all suspicious players for admin view
 */
export async function fetchSuspiciousPlayers(): Promise<{
  players: Array<{
    id: string;
    playerId: string;
    userId: string;
    trustScore: number;
    flags: string[];
    details: any;
    status: string;
    adminNotes?: string;
    analyzedAt: string;
    playerName?: string;
    playerAvatar?: string;
  }>;
  error: string | null;
}> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('suspicious_players')
      .select('*')
      .order('trust_score', { ascending: true });

    if (error) return { players: [], error: error.message };

    // Enrich with player names
    const enriched = [];
    for (const row of data || []) {
      let playerName: string | undefined;
      let playerAvatar: string | undefined;
      try {
        const { data: p } = await supabase
          .from('players')
          .select('name, avatar')
          .eq('id', row.player_id)
          .single();
        playerName = p?.name;
        playerAvatar = p?.avatar || undefined;
      } catch { /* silent */ }

      enriched.push({
        id: row.id,
        playerId: row.player_id,
        userId: row.user_id,
        trustScore: row.trust_score,
        flags: Array.isArray(row.flags) ? row.flags : [],
        details: row.details || {},
        status: row.status,
        adminNotes: row.admin_notes || undefined,
        analyzedAt: row.analyzed_at,
        playerName,
        playerAvatar,
      });
    }

    return { players: enriched, error: null };
  } catch (e: any) {
    return { players: [], error: e.message };
  }
}

/**
 * Update suspicious player status (admin action)
 */
export async function updateSuspiciousStatus(
  id: string,
  status: string,
  adminNotes?: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;

    const { error } = await supabase
      .from('suspicious_players')
      .update(updateData)
      .eq('id', id);

    return { error: error?.message || null };
  } catch (e: any) {
    return { error: e.message };
  }
}
