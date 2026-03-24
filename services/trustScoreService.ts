// ============================================
// Trust Score Service
// Computes and fetches anti-cheat trust scores (0-100)
// ============================================
import { getSupabaseClient } from '@/template';

export interface TrustScoreData {
  score: number;
  level: 'verified' | 'high' | 'medium' | 'low' | 'suspicious';
  flags: string[];
  details?: Record<string, any>;
  analyzedAt?: string;
}

// Thresholds
const TRUST_VERIFIED = 80;
const TRUST_HIGH = 65;
const TRUST_MEDIUM = 45;
const TRUST_LOW = 25;

/**
 * Compute a quick trust score from locally available stats.
 * Used as fallback when no DB score exists.
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
  let score = 75; // Start at 75 for quick estimate (no full analysis)

  const { matchesPlayed, winRate, tirRate, pointRate, carreauRate } = player.stats;

  // Stats regularity
  if (winRate > 95 && matchesPlayed >= 10) {
    score -= 15;
    flags.push('extreme_win_rate');
  } else if (winRate > 90 && matchesPlayed >= 10) {
    score -= 8;
  }

  if (tirRate > 85 && pointRate > 85) {
    score -= 10;
    flags.push('unrealistic_combined_rates');
  }

  if (carreauRate > 50 && matchesPlayed >= 10) {
    score -= 10;
    flags.push('extreme_carreau_rate');
  }

  // Match volume bonus
  if (matchesPlayed >= 50) {
    score += 10;
  } else if (matchesPlayed >= 30) {
    score += 5;
  } else if (matchesPlayed < 10) {
    score -= 10;
    flags.push('low_match_count');
  }

  // Account age
  if (player.createdAt) {
    const ageMs = Date.now() - new Date(player.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 7) {
      score -= 10;
      flags.push('very_new_account');
    } else if (ageDays < 30) {
      score -= 5;
      flags.push('new_account');
    } else if (ageDays >= 180) {
      score += 5; // Longevity bonus
    }
  }

  score = Math.max(0, Math.min(100, score));

  const level: TrustScoreData['level'] = getLevel(score);

  return { score, level, flags };
}

function getLevel(score: number): TrustScoreData['level'] {
  if (score >= TRUST_VERIFIED) return 'verified';
  if (score >= TRUST_HIGH) return 'high';
  if (score >= TRUST_MEDIUM) return 'medium';
  if (score >= TRUST_LOW) return 'low';
  return 'suspicious';
}

/**
 * Get trust score color for display (accepts level string or numeric score)
 */
export function getTrustScoreColor(levelOrScore: TrustScoreData['level'] | number): string {
  const level = typeof levelOrScore === 'number' ? getLevel(levelOrScore) : levelOrScore;
  switch (level) {
    case 'verified': return '#22C55E';
    case 'high': return '#3B82F6';
    case 'medium': return '#D97706';
    case 'low': return '#F97316';
    case 'suspicious': return '#EF4444';
  }
}

/**
 * Get trust score icon (accepts level string or numeric score)
 */
export function getTrustScoreIcon(levelOrScore: TrustScoreData['level'] | number): string {
  const level = typeof levelOrScore === 'number' ? getLevel(levelOrScore) : levelOrScore;
  switch (level) {
    case 'verified': return 'verified-user';
    case 'high': return 'shield';
    case 'medium': return 'shield';
    case 'low': return 'warning';
    case 'suspicious': return 'gpp-bad';
  }
}

/**
 * Get trust level label (accepts level string or numeric score)
 */
export function getTrustLevelLabel(levelOrScore: TrustScoreData['level'] | number, fr: boolean): string {
  const level = typeof levelOrScore === 'number' ? getLevel(levelOrScore) : levelOrScore;
  switch (level) {
    case 'verified': return fr ? 'Verifie' : 'Verified';
    case 'high': return fr ? 'Fiable' : 'Trusted';
    case 'medium': return fr ? 'Standard' : 'Standard';
    case 'low': return fr ? 'A surveiller' : 'Watch';
    case 'suspicious': return fr ? 'Suspect' : 'Suspicious';
  }
}

/**
 * Get level from numeric score (public version)
 */
export function getLevelFromScore(score: number): TrustScoreData['level'] {
  return getLevel(score);
}

/**
 * Get trust badge description for tips
 */
export function getTrustBadgeDescription(level: TrustScoreData['level'], fr: boolean): string {
  switch (level) {
    case 'verified':
      return fr
        ? 'Profil verifie avec un bon historique de matchs multi-joueurs et des stats coherentes.'
        : 'Verified profile with good multi-player match history and consistent stats.';
    case 'high':
      return fr
        ? 'Bon niveau de confiance. Continuez a jouer avec d\'autres utilisateurs pour augmenter votre score.'
        : 'Good trust level. Keep playing with other users to increase your score.';
    case 'medium':
      return fr
        ? 'Niveau standard. Jouez plus de matchs avec d\'autres utilisateurs de l\'app pour ameliorer votre fiabilite.'
        : 'Standard level. Play more matches with other app users to improve your reliability.';
    case 'low':
      return fr
        ? 'Fiabilite faible. Augmentez vos matchs multi-joueurs et diversifiez vos adversaires.'
        : 'Low reliability. Increase multi-player matches and diversify your opponents.';
    case 'suspicious':
      return fr
        ? 'Profil signale pour des statistiques inhabituelles. Contactez-nous si vous pensez que c\'est une erreur.'
        : 'Profile flagged for unusual statistics. Contact us if you think this is an error.';
  }
}

/**
 * Fetch stored trust score from DB for a single player
 */
export async function fetchTrustScore(playerId: string): Promise<TrustScoreData | null> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('suspicious_players')
      .select('trust_score, flags, details, analyzed_at')
      .eq('player_id', playerId)
      .single();

    if (error || !data) return null;

    const score = data.trust_score;
    return {
      score,
      level: getLevel(score),
      flags: Array.isArray(data.flags) ? data.flags : [],
      details: data.details || {},
      analyzedAt: data.analyzed_at,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch stored trust scores from DB (batch)
 */
export async function fetchTrustScores(playerIds: string[]): Promise<Map<string, TrustScoreData>> {
  const result = new Map<string, TrustScoreData>();
  if (playerIds.length === 0) return result;

  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('suspicious_players')
      .select('player_id, trust_score, flags, details, analyzed_at')
      .in('player_id', playerIds);

    if (!error && data) {
      for (const row of data) {
        const score = row.trust_score;
        result.set(row.player_id, {
          score,
          level: getLevel(score),
          flags: Array.isArray(row.flags) ? row.flags : [],
          details: row.details || {},
          analyzedAt: row.analyzed_at,
        });
      }
    }
  } catch { /* silent */ }

  return result;
}

/**
 * Trigger trust score computation for the current user via Edge Function.
 * Called after match/challenge saves.
 */
export async function triggerTrustScoreComputation(): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    await supabase.functions.invoke('detect-suspicious', {
      body: { mode: 'self' },
    });
  } catch (e) {
    console.log('[trustScore] Trigger computation error:', e);
  }
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

/**
 * Update trust score directly (admin action)
 */
export async function updateTrustScore(
  id: string,
  trustScore: number
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('suspicious_players')
      .update({ trust_score: trustScore, updated_at: new Date().toISOString() })
      .eq('id', id);
    return { error: error?.message || null };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ============================================
// MATCH VALIDATION WEIGHT
// ============================================

export type MatchValidationLevel = 'solo' | 'shared_2' | 'shared_3plus' | 'witnessed';

/**
 * Get the validation weight multiplier for a match based on participant count.
 * - solo (0-1 participant_user_ids): 0.3x
 * - shared_2 (2 participants): 1.0x
 * - shared_3plus (3-4 participants): 1.5x
 * - witnessed (sponsored event with witnesses): 2.0x
 */
export function getMatchValidationWeight(participantCount: number, isWitnessedEvent?: boolean): number {
  if (isWitnessedEvent) return 2.0;
  if (participantCount >= 3) return 1.5;
  if (participantCount >= 2) return 1.0;
  return 0.3;
}

/**
 * Get the validation level label and color for display
 */
export function getMatchValidationLevel(participantCount: number, isWitnessedEvent?: boolean): MatchValidationLevel {
  if (isWitnessedEvent) return 'witnessed';
  if (participantCount >= 3) return 'shared_3plus';
  if (participantCount >= 2) return 'shared_2';
  return 'solo';
}

export function getValidationColor(level: MatchValidationLevel): string {
  switch (level) {
    case 'witnessed': return '#7C3AED';
    case 'shared_3plus': return '#22C55E';
    case 'shared_2': return '#3B82F6';
    case 'solo': return '#9CA3AF';
  }
}

export function getValidationIcon(level: MatchValidationLevel): string {
  switch (level) {
    case 'witnessed': return 'visibility';
    case 'shared_3plus': return 'groups';
    case 'shared_2': return 'people';
    case 'solo': return 'person';
  }
}

export function getValidationLabel(level: MatchValidationLevel, fr: boolean): string {
  switch (level) {
    case 'witnessed': return fr ? 'Atteste (2.0x)' : 'Witnessed (2.0x)';
    case 'shared_3plus': return fr ? '3+ joueurs (1.5x)' : '3+ players (1.5x)';
    case 'shared_2': return fr ? '2 joueurs (1.0x)' : '2 players (1.0x)';
    case 'solo': return fr ? 'Solo (0.3x)' : 'Solo (0.3x)';
  }
}

export function getValidationWeightFromLevel(level: MatchValidationLevel): number {
  switch (level) {
    case 'witnessed': return 2.0;
    case 'shared_3plus': return 1.5;
    case 'shared_2': return 1.0;
    case 'solo': return 0.3;
  }
}
