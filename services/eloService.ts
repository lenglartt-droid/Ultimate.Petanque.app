/**
 * ELO Rating Service
 * 
 * Implements a standard ELO rating system adapted for pétanque:
 * - Initial rating: 1000
 * - Adaptive K-factor: 40 (<10 matches), 20 (10-30), 10 (30+)
 * - Match validation weight multiplier from trustScoreService
 * - ELO history tracking for progression charts
 */
import { getSupabaseClient } from '@/template';
import { getMatchValidationWeight } from '@/services/trustScoreService';

// ============================================
// TYPES
// ============================================
export interface EloHistoryEntry {
  id: string;
  playerId: string;
  eloBefore: number;
  eloAfter: number;
  eloDelta: number;
  matchId?: string;
  opponentElo?: number;
  opponentName?: string;
  won: boolean;
  recordedAt: string;
}

export type EloRankTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master';

export interface EloRankInfo {
  tier: EloRankTier;
  label: { fr: string; en: string };
  color: string;
  icon: string;
  minElo: number;
}

// ============================================
// CONSTANTS
// ============================================
export const ELO_INITIAL = 1000;

export const ELO_RANKS: EloRankInfo[] = [
  { tier: 'master', label: { fr: 'Maitre', en: 'Master' }, color: '#9333EA', icon: 'auto-awesome', minElo: 1800 },
  { tier: 'diamond', label: { fr: 'Diamant', en: 'Diamond' }, color: '#06B6D4', icon: 'diamond', minElo: 1500 },
  { tier: 'gold', label: { fr: 'Or', en: 'Gold' }, color: '#F59E0B', icon: 'emoji-events', minElo: 1200 },
  { tier: 'silver', label: { fr: 'Argent', en: 'Silver' }, color: '#94A3B8', icon: 'workspace-premium', minElo: 1000 },
  { tier: 'bronze', label: { fr: 'Bronze', en: 'Bronze' }, color: '#CD7F32', icon: 'shield', minElo: 0 },
];

// ============================================
// CORE ELO CALCULATION
// ============================================

/** Get adaptive K-factor based on number of matches played */
export function getKFactor(matchesPlayed: number): number {
  if (matchesPlayed < 10) return 40;
  if (matchesPlayed <= 30) return 20;
  return 10;
}

/** Calculate expected score (probability of winning) */
export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/** 
 * Calculate new ELO rating after a match 
 * @param playerElo Current ELO
 * @param opponentElo Opponent ELO
 * @param won Whether the player won
 * @param matchesPlayed Number of matches played (for K-factor)
 * @param validationWeight Match validation weight (0.3-2.0)
 * @returns New ELO rating and delta
 */
export function calculateElo(
  playerElo: number,
  opponentElo: number,
  won: boolean,
  matchesPlayed: number,
  validationWeight: number = 1.0
): { newElo: number; delta: number } {
  const K = getKFactor(matchesPlayed);
  const expected = expectedScore(playerElo, opponentElo);
  const actual = won ? 1 : 0;
  
  // Apply validation weight to K-factor (stronger matches have more impact)
  const adjustedK = K * Math.min(validationWeight, 2.0);
  const delta = Math.round(adjustedK * (actual - expected));
  const newElo = Math.max(100, playerElo + delta); // Floor at 100
  
  return { newElo, delta };
}

/** Get rank tier from ELO rating */
export function getEloRank(elo: number): EloRankInfo {
  for (const rank of ELO_RANKS) {
    if (elo >= rank.minElo) return rank;
  }
  return ELO_RANKS[ELO_RANKS.length - 1];
}

/** Get rank color for a given ELO */
export function getEloColor(elo: number): string {
  return getEloRank(elo).color;
}

/** Get ELO delta display text with sign */
export function formatEloDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Recalculate ELO for all players from match history.
 * Replays all matches chronologically and updates player elo_rating.
 */
export async function recalculateAllElo(): Promise<{ success: boolean; error: string | null; playersUpdated: number }> {
  const supabase = getSupabaseClient();

  try {
    // 1. Fetch all matches ordered by date
    const { data: matchesData, error: matchErr } = await supabase
      .from('matches')
      .select('id, team_a, team_b, winner, participant_user_ids, date')
      .order('date', { ascending: true });

    if (matchErr) return { success: false, error: matchErr.message, playersUpdated: 0 };

    // 2. Fetch all players
    const { data: playersData, error: playerErr } = await supabase
      .from('players')
      .select('id, user_id, name, stats');

    if (playerErr) return { success: false, error: playerErr.message, playersUpdated: 0 };

    // 3. Initialize ELO map
    const eloMap = new Map<string, number>();
    const matchCountMap = new Map<string, number>();
    const playerNameMap = new Map<string, string>();
    
    for (const p of (playersData || [])) {
      eloMap.set(p.id, ELO_INITIAL);
      matchCountMap.set(p.id, 0);
      playerNameMap.set(p.id, p.name);
    }

    // 4. Replay all matches chronologically
    for (const match of (matchesData || [])) {
      const participantIds: string[] = match.participant_user_ids || [];
      // Only count real multi-user matches for ELO
      if (participantIds.length < 2) continue;
      
      const validationWeight = getMatchValidationWeight(participantIds.length);
      const teamAPlayers: string[] = match.team_a?.players || [];
      const teamBPlayers: string[] = match.team_b?.players || [];

      // Calculate average ELO for each team
      const teamAElos = teamAPlayers.filter(id => eloMap.has(id)).map(id => eloMap.get(id)!);
      const teamBElos = teamBPlayers.filter(id => eloMap.has(id)).map(id => eloMap.get(id)!);

      if (teamAElos.length === 0 || teamBElos.length === 0) continue;

      const avgEloA = Math.round(teamAElos.reduce((a, b) => a + b, 0) / teamAElos.length);
      const avgEloB = Math.round(teamBElos.reduce((a, b) => a + b, 0) / teamBElos.length);

      // Update ELO for team A players
      for (const pid of teamAPlayers) {
        if (!eloMap.has(pid)) continue;
        const currentElo = eloMap.get(pid)!;
        const mc = matchCountMap.get(pid) || 0;
        const won = match.winner === 'A';
        const { newElo } = calculateElo(currentElo, avgEloB, won, mc, validationWeight);
        eloMap.set(pid, newElo);
        matchCountMap.set(pid, mc + 1);
      }

      // Update ELO for team B players
      for (const pid of teamBPlayers) {
        if (!eloMap.has(pid)) continue;
        const currentElo = eloMap.get(pid)!;
        const mc = matchCountMap.get(pid) || 0;
        const won = match.winner === 'B';
        const { newElo } = calculateElo(currentElo, avgEloA, won, mc, validationWeight);
        eloMap.set(pid, newElo);
        matchCountMap.set(pid, mc + 1);
      }
    }

    // 5. Batch update all players with new ELO
    let updatedCount = 0;
    const entries = [...eloMap.entries()];
    for (let i = 0; i < entries.length; i += 50) {
      const batch = entries.slice(i, i + 50);
      for (const [playerId, elo] of batch) {
        const { error: updateErr } = await supabase
          .from('players')
          .update({ elo_rating: elo })
          .eq('id', playerId);
        if (!updateErr) updatedCount++;
      }
    }

    return { success: true, error: null, playersUpdated: updatedCount };
  } catch (e: any) {
    return { success: false, error: e.message || 'ELO recalculation error', playersUpdated: 0 };
  }
}

/**
 * Update ELO ratings after a single match.
 * Called after match creation/save.
 */
export async function updateEloAfterMatch(
  matchId: string,
  teamAPlayerIds: string[],
  teamBPlayerIds: string[],
  winner: 'A' | 'B',
  participantUserIds: string[]
): Promise<void> {
  if (participantUserIds.length < 2) return; // Skip solo matches

  const supabase = getSupabaseClient();
  const validationWeight = getMatchValidationWeight(participantUserIds.length);

  try {
    // Fetch current ELO and stats for all players in the match
    const allPlayerIds = [...teamAPlayerIds, ...teamBPlayerIds];
    const { data: playersData } = await supabase
      .from('players')
      .select('id, user_id, name, elo_rating, stats')
      .in('id', allPlayerIds);

    if (!playersData || playersData.length === 0) return;

    const playerMap = new Map(playersData.map(p => [p.id, p]));

    // Calculate team average ELOs
    const teamAElos = teamAPlayerIds.filter(id => playerMap.has(id)).map(id => playerMap.get(id)!.elo_rating || ELO_INITIAL);
    const teamBElos = teamBPlayerIds.filter(id => playerMap.has(id)).map(id => playerMap.get(id)!.elo_rating || ELO_INITIAL);

    if (teamAElos.length === 0 || teamBElos.length === 0) return;

    const avgEloA = Math.round(teamAElos.reduce((a, b) => a + b, 0) / teamAElos.length);
    const avgEloB = Math.round(teamBElos.reduce((a, b) => a + b, 0) / teamBElos.length);

    // Get opponent team names for history
    const teamANames = teamAPlayerIds.map(id => playerMap.get(id)?.name || '').filter(Boolean).join(', ');
    const teamBNames = teamBPlayerIds.map(id => playerMap.get(id)?.name || '').filter(Boolean).join(', ');

    const historyRows: any[] = [];

    // Update team A players
    for (const pid of teamAPlayerIds) {
      const p = playerMap.get(pid);
      if (!p) continue;
      const currentElo = p.elo_rating || ELO_INITIAL;
      const mc = p.stats?.matchesPlayed || 0;
      const won = winner === 'A';
      const { newElo, delta } = calculateElo(currentElo, avgEloB, won, mc, validationWeight);
      
      await supabase.from('players').update({ elo_rating: newElo }).eq('id', pid);

      if (p.user_id) {
        historyRows.push({
          user_id: p.user_id,
          player_id: pid,
          elo_before: currentElo,
          elo_after: newElo,
          elo_delta: delta,
          match_id: matchId,
          opponent_elo: avgEloB,
          opponent_name: teamBNames,
          won,
        });
      }
    }

    // Update team B players
    for (const pid of teamBPlayerIds) {
      const p = playerMap.get(pid);
      if (!p) continue;
      const currentElo = p.elo_rating || ELO_INITIAL;
      const mc = p.stats?.matchesPlayed || 0;
      const won = winner === 'B';
      const { newElo, delta } = calculateElo(currentElo, avgEloA, won, mc, validationWeight);
      
      await supabase.from('players').update({ elo_rating: newElo }).eq('id', pid);

      if (p.user_id) {
        historyRows.push({
          user_id: p.user_id,
          player_id: pid,
          elo_before: currentElo,
          elo_after: newElo,
          elo_delta: delta,
          match_id: matchId,
          opponent_elo: avgEloA,
          opponent_name: teamANames,
          won,
        });
      }
    }

    // Insert history records
    if (historyRows.length > 0) {
      await supabase.from('elo_history').insert(historyRows);
    }
  } catch (e) {
    console.log('[ELO] Error updating after match:', e);
  }
}

/**
 * Fetch ELO history for a player (last N entries)
 */
export async function fetchEloHistory(
  playerId: string,
  limit: number = 30
): Promise<{ history: EloHistoryEntry[]; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('elo_history')
      .select('*')
      .eq('player_id', playerId)
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error) return { history: [], error: error.message };

    const history: EloHistoryEntry[] = (data || []).map((row: any) => ({
      id: row.id,
      playerId: row.player_id,
      eloBefore: row.elo_before,
      eloAfter: row.elo_after,
      eloDelta: row.elo_delta,
      matchId: row.match_id,
      opponentElo: row.opponent_elo,
      opponentName: row.opponent_name,
      won: row.won,
      recordedAt: row.recorded_at,
    }));

    return { history, error: null };
  } catch (e: any) {
    return { history: [], error: e.message || 'Failed to fetch ELO history' };
  }
}

/**
 * Get current ELO rating for a player from DB
 */
export async function fetchPlayerElo(playerId: string): Promise<number> {
  const supabase = getSupabaseClient();
  try {
    const { data } = await supabase
      .from('players')
      .select('elo_rating')
      .eq('id', playerId)
      .single();
    return data?.elo_rating || ELO_INITIAL;
  } catch {
    return ELO_INITIAL;
  }
}
