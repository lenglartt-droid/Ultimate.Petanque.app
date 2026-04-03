/**
 * Role Analysis Service
 *
 * Analyzes historical match data to determine optimal roles for players
 * and provides per-role performance breakdowns.
 */

import { Match, PlayerAction } from '@/types/petanque';

export type PlayerRoleType = 'Pointeur' | 'Milieu' | 'Tireur';

export interface RolePerformance {
  role: PlayerRoleType;
  matchCount: number;
  tirs: number;
  tirsSuccess: number;
  points: number;
  pointsSuccess: number;
  carreaux: number;
  tirRate: number;
  pointRate: number;
  carreauRate: number;
  score: number; // 0-100 compatibility score
}

export interface RoleSuggestion {
  bestRole: PlayerRoleType;
  confidence: number; // 0-100
  performances: RolePerformance[];
  reason: string;
}

/**
 * Analyze a player's historical performance per role across all matches
 */
export function analyzePlayerRoles(
  playerId: string,
  matches: Match[],
  language: string = 'fr'
): RoleSuggestion | null {
  const fr = language === 'fr';
  const roleStats: Record<PlayerRoleType, {
    matchCount: number;
    tirs: number;
    tirsSuccess: number;
    points: number;
    pointsSuccess: number;
    carreaux: number;
  }> = {
    Pointeur: { matchCount: 0, tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 },
    Milieu: { matchCount: 0, tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 },
    Tireur: { matchCount: 0, tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 },
  };

  let totalMatchesWithRole = 0;

  for (const match of matches) {
    // Find what role this player had in this match
    let playerRole: PlayerRoleType | null = null;
    const teamARoleEntry = match.teamA.playerRoles?.find(r => r.playerId === playerId);
    const teamBRoleEntry = match.teamB.playerRoles?.find(r => r.playerId === playerId);
    if (teamARoleEntry) playerRole = teamARoleEntry.role as PlayerRoleType;
    else if (teamBRoleEntry) playerRole = teamBRoleEntry.role as PlayerRoleType;

    if (!playerRole) continue;

    // Find player actions in this match
    const pa = match.playerActions?.find(a => a.playerId === playerId);
    if (!pa) {
      roleStats[playerRole].matchCount++;
      totalMatchesWithRole++;
      continue;
    }

    roleStats[playerRole].matchCount++;
    roleStats[playerRole].tirs += pa.actions.tirs;
    roleStats[playerRole].tirsSuccess += pa.actions.tirsSuccess;
    roleStats[playerRole].points += pa.actions.points;
    roleStats[playerRole].pointsSuccess += pa.actions.pointsSuccess;
    roleStats[playerRole].carreaux += pa.actions.carreaux;
    totalMatchesWithRole++;
  }

  // Also check role segments stored in player actions
  for (const match of matches) {
    const pa = match.playerActions?.find(a => a.playerId === playerId);
    if (!pa || !(pa as any).roleSegments) continue;
    const segments = (pa as any).roleSegments as { role: PlayerRoleType; actions: typeof pa.actions }[];
    for (const seg of segments) {
      if (!roleStats[seg.role]) continue;
      // These are already counted in the main actions, so we skip double-counting
      // Role segments are for display within a single match
    }
  }

  if (totalMatchesWithRole < 2) return null;

  // Compute per-role performance scores
  const performances: RolePerformance[] = (['Pointeur', 'Milieu', 'Tireur'] as PlayerRoleType[]).map(role => {
    const rs = roleStats[role];
    const tirRate = rs.tirs > 0 ? Math.round((rs.tirsSuccess / rs.tirs) * 100) : 0;
    const pointRate = rs.points > 0 ? Math.round((rs.pointsSuccess / rs.points) * 100) : 0;
    const carreauRate = rs.tirs > 0 ? Math.round((rs.carreaux / rs.tirs) * 100) : 0;

    // Score computation based on role expectations
    let score = 0;
    if (role === 'Tireur') {
      // Tireur: heavy weight on tir success and carreaux
      score = tirRate * 0.6 + carreauRate * 0.25 + pointRate * 0.15;
    } else if (role === 'Pointeur') {
      // Pointeur: heavy weight on point success
      score = pointRate * 0.6 + tirRate * 0.25 + carreauRate * 0.15;
    } else {
      // Milieu: balanced
      score = tirRate * 0.4 + pointRate * 0.4 + carreauRate * 0.2;
    }

    // Boost score if enough data (confidence factor)
    const dataFactor = Math.min(1, rs.matchCount / 5);
    score = Math.round(score * dataFactor);

    return {
      role,
      matchCount: rs.matchCount,
      tirs: rs.tirs,
      tirsSuccess: rs.tirsSuccess,
      points: rs.points,
      pointsSuccess: rs.pointsSuccess,
      carreaux: rs.carreaux,
      tirRate,
      pointRate,
      carreauRate,
      score: Math.min(100, Math.max(0, score)),
    };
  });

  // Sort by score descending
  const sorted = [...performances].sort((a, b) => b.score - a.score);
  const best = sorted[0];

  if (best.matchCount === 0 && sorted[1].matchCount === 0) return null;

  // Confidence based on data volume and score gap
  const scoreGap = best.score - (sorted[1]?.score || 0);
  const dataVolume = Math.min(100, totalMatchesWithRole * 10);
  const confidence = Math.min(100, Math.round((scoreGap * 0.6 + dataVolume * 0.4)));

  // Generate reason
  let reason = '';
  if (best.role === 'Tireur') {
    reason = fr
      ? `${best.tirRate}% reussite au tir sur ${best.matchCount} match(s)`
      : `${best.tirRate}% shot success over ${best.matchCount} match(es)`;
  } else if (best.role === 'Pointeur') {
    reason = fr
      ? `${best.pointRate}% reussite au point sur ${best.matchCount} match(s)`
      : `${best.pointRate}% point success over ${best.matchCount} match(es)`;
  } else {
    reason = fr
      ? `Polyvalent: ${best.tirRate}% tir, ${best.pointRate}% point`
      : `Versatile: ${best.tirRate}% shot, ${best.pointRate}% point`;
  }

  return {
    bestRole: best.role,
    confidence,
    performances: sorted,
    reason,
  };
}

/**
 * Get role suggestion color based on confidence
 */
export function getSuggestionColor(confidence: number): string {
  if (confidence >= 70) return '#10B981';
  if (confidence >= 40) return '#D97706';
  return '#94A3B8';
}

/**
 * Get role icon name
 */
export function getRoleIcon(role: PlayerRoleType): string {
  switch (role) {
    case 'Tireur': return 'gps-fixed';
    case 'Pointeur': return 'adjust';
    case 'Milieu': return 'swap-horiz';
    default: return 'person';
  }
}

/**
 * Get role color
 */
export function getRoleColor(role: PlayerRoleType): string {
  switch (role) {
    case 'Tireur': return '#F97316';
    case 'Pointeur': return '#3B82F6';
    case 'Milieu': return '#8B5CF6';
    default: return '#64748B';
  }
}

// ============================================
// HEAD-TO-HEAD ROLE ANALYSIS
// ============================================

export interface H2HRoleData {
  role: PlayerRoleType;
  player1: { matches: number; tirs: number; tirsSuccess: number; points: number; pointsSuccess: number; carreaux: number; tirRate: number; pointRate: number };
  player2: { matches: number; tirs: number; tirsSuccess: number; points: number; pointsSuccess: number; carreaux: number; tirRate: number; pointRate: number };
}

export interface HeadToHeadRoleResult {
  totalMatches: number;
  player1Wins: number;
  player2Wins: number;
  roles: H2HRoleData[];
  recommendation: string;
}

/**
 * Compare two players' performance per role from their shared matches.
 */
export function computeHeadToHeadRoleAnalysis(
  player1Id: string,
  player2Id: string,
  matches: Match[],
  language: string = 'fr'
): HeadToHeadRoleResult | null {
  const fr = language === 'fr';
  // Find all matches where both players participated
  const sharedMatches = matches.filter(m => {
    const allPlayers = [...m.teamA.players, ...m.teamB.players];
    return allPlayers.includes(player1Id) && allPlayers.includes(player2Id);
  });

  if (sharedMatches.length === 0) return null;

  let p1Wins = 0, p2Wins = 0;
  const roleAgg: Record<PlayerRoleType, { p1: { m: number; t: number; ts: number; p: number; ps: number; c: number }; p2: { m: number; t: number; ts: number; p: number; ps: number; c: number } }> = {
    Pointeur: { p1: { m: 0, t: 0, ts: 0, p: 0, ps: 0, c: 0 }, p2: { m: 0, t: 0, ts: 0, p: 0, ps: 0, c: 0 } },
    Milieu: { p1: { m: 0, t: 0, ts: 0, p: 0, ps: 0, c: 0 }, p2: { m: 0, t: 0, ts: 0, p: 0, ps: 0, c: 0 } },
    Tireur: { p1: { m: 0, t: 0, ts: 0, p: 0, ps: 0, c: 0 }, p2: { m: 0, t: 0, ts: 0, p: 0, ps: 0, c: 0 } },
  };

  for (const match of sharedMatches) {
    const p1InA = match.teamA.players.includes(player1Id);
    const p2InA = match.teamA.players.includes(player2Id);
    const p1Won = (p1InA && match.winner === 'A') || (!p1InA && match.winner === 'B');
    const p2Won = (p2InA && match.winner === 'A') || (!p2InA && match.winner === 'B');
    if (p1Won) p1Wins++;
    if (p2Won) p2Wins++;

    // Get roles
    const getRole = (pid: string): PlayerRoleType | null => {
      const aRole = match.teamA.playerRoles?.find(r => r.playerId === pid);
      if (aRole) return aRole.role as PlayerRoleType;
      const bRole = match.teamB.playerRoles?.find(r => r.playerId === pid);
      if (bRole) return bRole.role as PlayerRoleType;
      return null;
    };

    const p1Role = getRole(player1Id);
    const p2Role = getRole(player2Id);

    // Aggregate actions
    const addActions = (pid: string, role: PlayerRoleType, key: 'p1' | 'p2') => {
      if (!role || !roleAgg[role]) return;
      roleAgg[role][key].m++;
      const pa = match.playerActions?.find(a => a.playerId === pid);
      if (pa) {
        roleAgg[role][key].t += pa.actions.tirs;
        roleAgg[role][key].ts += pa.actions.tirsSuccess;
        roleAgg[role][key].p += pa.actions.points;
        roleAgg[role][key].ps += pa.actions.pointsSuccess;
        roleAgg[role][key].c += pa.actions.carreaux;
      }
    };

    if (p1Role) addActions(player1Id, p1Role, 'p1');
    if (p2Role) addActions(player2Id, p2Role, 'p2');
  }

  const roles: H2HRoleData[] = (['Tireur', 'Pointeur', 'Milieu'] as PlayerRoleType[]).map(role => {
    const p1 = roleAgg[role].p1;
    const p2 = roleAgg[role].p2;
    return {
      role,
      player1: {
        matches: p1.m, tirs: p1.t, tirsSuccess: p1.ts, points: p1.p, pointsSuccess: p1.ps, carreaux: p1.c,
        tirRate: p1.t > 0 ? Math.round((p1.ts / p1.t) * 100) : 0,
        pointRate: p1.p > 0 ? Math.round((p1.ps / p1.p) * 100) : 0,
      },
      player2: {
        matches: p2.m, tirs: p2.t, tirsSuccess: p2.ts, points: p2.p, pointsSuccess: p2.ps, carreaux: p2.c,
        tirRate: p2.t > 0 ? Math.round((p2.ts / p2.t) * 100) : 0,
        pointRate: p2.p > 0 ? Math.round((p2.ps / p2.p) * 100) : 0,
      },
    };
  }).filter(r => r.player1.matches > 0 || r.player2.matches > 0);

  // Generate alignment recommendation
  let recommendation = '';
  if (roles.length > 0) {
    const bestP1 = [...roles].sort((a, b) => {
      const scoreA = a.player1.tirRate * 0.5 + a.player1.pointRate * 0.5;
      const scoreB = b.player1.tirRate * 0.5 + b.player1.pointRate * 0.5;
      return scoreB - scoreA;
    })[0];
    recommendation = fr
      ? `Meilleur role en commun : ${bestP1.role} (Tir ${bestP1.player1.tirRate}% vs ${bestP1.player2.tirRate}%)`
      : `Best shared role: ${bestP1.role} (Shot ${bestP1.player1.tirRate}% vs ${bestP1.player2.tirRate}%)`;
  }

  return { totalMatches: sharedMatches.length, player1Wins: p1Wins, player2Wins: p2Wins, roles, recommendation };
}

// ============================================
// SEASONAL ROLE EVOLUTION
// ============================================

export interface SeasonalRoleData {
  period: string;
  periodLabel: string;
  startDate: Date;
  totalMatches: number;
  roles: { role: PlayerRoleType; count: number; pct: number }[];
  dominantRole: PlayerRoleType;
}

export interface RoleEvolutionResult {
  seasons: SeasonalRoleData[];
  hasEvolution: boolean;
  migrationPath: PlayerRoleType[];
  migrationSummary: string;
}

/**
 * Analyze how a player's preferred role has evolved over time.
 * Groups matches into periods (quarters, semesters, or years depending on data span)
 * and tracks the dominant role per period.
 */
export function computeSeasonalRoleEvolution(
  playerId: string,
  matches: Match[],
  language: string = 'fr'
): RoleEvolutionResult | null {
  const fr = language === 'fr';

  // Collect matches with role data
  const matchesWithRoles: { date: Date; role: PlayerRoleType }[] = [];
  for (const match of matches) {
    let playerRole: PlayerRoleType | null = null;
    const aEntry = match.teamA.playerRoles?.find(r => r.playerId === playerId);
    const bEntry = match.teamB.playerRoles?.find(r => r.playerId === playerId);
    if (aEntry) playerRole = aEntry.role as PlayerRoleType;
    else if (bEntry) playerRole = bEntry.role as PlayerRoleType;
    if (!playerRole) continue;
    matchesWithRoles.push({ date: new Date(match.date), role: playerRole });
  }

  if (matchesWithRoles.length < 3) return null;

  matchesWithRoles.sort((a, b) => a.date.getTime() - b.date.getTime());

  const firstDate = matchesWithRoles[0].date;
  const lastDate = matchesWithRoles[matchesWithRoles.length - 1].date;
  const spanMonths = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

  // Determine granularity
  let periodMonths: number;
  if (spanMonths > 24) periodMonths = 12;
  else if (spanMonths > 12) periodMonths = 6;
  else periodMonths = 3;

  // Generate period buckets
  const periods: { start: Date; end: Date; label: string; key: string }[] = [];
  let cursor = new Date(firstDate.getFullYear(), Math.floor(firstDate.getMonth() / periodMonths) * periodMonths, 1);
  while (cursor <= lastDate) {
    const end = new Date(cursor);
    end.setMonth(end.getMonth() + periodMonths);
    let label: string;
    if (periodMonths === 12) {
      label = `${cursor.getFullYear()}`;
    } else if (periodMonths === 6) {
      label = `${cursor.getMonth() < 6 ? 'S1' : 'S2'} ${cursor.getFullYear().toString().slice(-2)}`;
    } else {
      label = `Q${Math.floor(cursor.getMonth() / 3) + 1} ${cursor.getFullYear().toString().slice(-2)}`;
    }
    periods.push({ start: new Date(cursor), end, label, key: `${cursor.getFullYear()}-${cursor.getMonth()}` });
    cursor = new Date(end);
  }

  // Aggregate per period
  const seasons: SeasonalRoleData[] = [];
  for (const period of periods) {
    const pm = matchesWithRoles.filter(m => m.date >= period.start && m.date < period.end);
    if (pm.length === 0) continue;
    const rc: Record<PlayerRoleType, number> = { Pointeur: 0, Milieu: 0, Tireur: 0 };
    pm.forEach(m => { rc[m.role]++; });
    const total = pm.length;
    const roles = (['Tireur', 'Pointeur', 'Milieu'] as PlayerRoleType[]).map(role => ({
      role, count: rc[role], pct: Math.round((rc[role] / total) * 100),
    }));
    const dominant = roles.reduce((a, b) => b.count > a.count ? b : a).role;
    seasons.push({ period: period.key, periodLabel: period.label, startDate: period.start, totalMatches: total, roles, dominantRole: dominant });
  }

  if (seasons.length < 2) return null;

  // Detect migration path (only when dominant role changes)
  const migrationPath: PlayerRoleType[] = [seasons[0].dominantRole];
  for (let i = 1; i < seasons.length; i++) {
    if (seasons[i].dominantRole !== migrationPath[migrationPath.length - 1]) {
      migrationPath.push(seasons[i].dominantRole);
    }
  }

  const hasEvolution = migrationPath.length > 1;
  const migrationSummary = hasEvolution
    ? migrationPath.join(' \u2192 ')
    : (fr ? 'Role stable : ' + migrationPath[0] : 'Stable role: ' + migrationPath[0]);

  return { seasons, hasEvolution, migrationPath, migrationSummary };
}

// ============================================
// ROLE PERFORMANCE EXPORT DATA
// ============================================

export interface RoleExportData {
  role: PlayerRoleType;
  matchCount: number;
  wins: number;
  losses: number;
  winRate: number;
  tirRate: number;
  pointRate: number;
  carreauRate: number;
  tirs: number;
  tirsSuccess: number;
  points: number;
  pointsSuccess: number;
  carreaux: number;
}

/**
 * Generate role performance data suitable for CSV/PDF export.
 */
export function generateRoleExportData(
  selfPlayerId: string,
  matches: Match[],
): RoleExportData[] {
  const roleStats: Record<PlayerRoleType, { matchCount: number; wins: number; losses: number; tirs: number; tirsSuccess: number; points: number; pointsSuccess: number; carreaux: number }> = {
    Pointeur: { matchCount: 0, wins: 0, losses: 0, tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 },
    Milieu: { matchCount: 0, wins: 0, losses: 0, tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 },
    Tireur: { matchCount: 0, wins: 0, losses: 0, tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 },
  };

  for (const match of matches) {
    let playerRole: PlayerRoleType | null = null;
    let team: 'A' | 'B' | null = null;
    const aEntry = match.teamA.playerRoles?.find(r => r.playerId === selfPlayerId);
    const bEntry = match.teamB.playerRoles?.find(r => r.playerId === selfPlayerId);
    if (aEntry) { playerRole = aEntry.role as PlayerRoleType; team = 'A'; }
    else if (bEntry) { playerRole = bEntry.role as PlayerRoleType; team = 'B'; }
    if (!playerRole || !team) continue;

    const rs = roleStats[playerRole];
    rs.matchCount++;
    if (match.winner === team) rs.wins++;
    else rs.losses++;

    const pa = match.playerActions?.find(a => a.playerId === selfPlayerId);
    if (pa) {
      rs.tirs += pa.actions.tirs;
      rs.tirsSuccess += pa.actions.tirsSuccess;
      rs.points += pa.actions.points;
      rs.pointsSuccess += pa.actions.pointsSuccess;
      rs.carreaux += pa.actions.carreaux;
    }
  }

  return (['Tireur', 'Pointeur', 'Milieu'] as PlayerRoleType[]).map(role => {
    const rs = roleStats[role];
    return {
      role,
      matchCount: rs.matchCount,
      wins: rs.wins,
      losses: rs.losses,
      winRate: rs.matchCount > 0 ? Math.round((rs.wins / rs.matchCount) * 100) : 0,
      tirRate: rs.tirs > 0 ? Math.round((rs.tirsSuccess / rs.tirs) * 100) : 0,
      pointRate: rs.points > 0 ? Math.round((rs.pointsSuccess / rs.points) * 100) : 0,
      carreauRate: rs.tirs > 0 ? Math.round((rs.carreaux / rs.tirs) * 100) : 0,
      tirs: rs.tirs,
      tirsSuccess: rs.tirsSuccess,
      points: rs.points,
      pointsSuccess: rs.pointsSuccess,
      carreaux: rs.carreaux,
    };
  });
}
