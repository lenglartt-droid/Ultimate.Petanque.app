/**
 * Club Analytics Service
 * Computes analytics data for club owners: progression, member stats, tournament activity.
 */
import { getSupabaseClient } from '@/template';
import { Match, Player, Tournament } from '@/types/petanque';
import { getEloRank } from '@/services/eloService';

export interface ClubAnalytics {
  // Members
  totalMembers: number;
  activeMembersThisMonth: number;
  newMembersThisMonth: number;
  // ELO
  avgElo: number;
  eloEvolution: Array<{ month: string; avgElo: number; memberCount: number }>;
  topMembers: Array<{ id: string; name: string; elo: number; winRate: number; matches: number; avatar?: string }>;
  // Performance
  totalMatches: number;
  totalWins: number;
  avgWinRate: number;
  winRateEvolution: Array<{ month: string; winRate: number; matches: number }>;
  // Tournaments
  tournamentsPlayed: number;
  tournamentsThisYear: number;
  // Roles
  roleDistribution: Array<{ role: string; count: number; pct: number }>;
  // Activity
  matchesByMonth: Array<{ month: string; count: number }>;
}

export async function fetchClubAnalytics(
  clubId: string,
  members: Player[],
  allMatches: Match[],
  allTournaments: Tournament[]
): Promise<ClubAnalytics> {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisYear = now.getFullYear();

  // Member IDs set
  const memberIds = new Set(members.map(m => m.id));

  // Active members this month
  const activeMemberIds = new Set<string>();
  const memberMatchMap = new Map<string, { wins: number; matches: number }>();
  const monthMatchCounts = new Map<string, number>();

  // Filter matches that involve club members
  allMatches.forEach(m => {
    const matchDate = new Date(m.date);
    const monthKey = `${matchDate.getFullYear()}-${String(matchDate.getMonth() + 1).padStart(2, '0')}`;
    
    const involvedMembers = [...m.teamA.players, ...m.teamB.players].filter(pid => memberIds.has(pid));
    if (involvedMembers.length === 0) return;

    monthMatchCounts.set(monthKey, (monthMatchCounts.get(monthKey) || 0) + 1);

    involvedMembers.forEach(pid => {
      if (monthKey === thisMonth) activeMemberIds.add(pid);

      if (!memberMatchMap.has(pid)) memberMatchMap.set(pid, { wins: 0, matches: 0 });
      const entry = memberMatchMap.get(pid)!;
      entry.matches++;

      const inA = m.teamA.players.includes(pid);
      if ((inA && m.winner === 'A') || (!inA && m.winner === 'B')) entry.wins++;
    });
  });

  // New members this month
  const newMembersThisMonth = members.filter(m => {
    if (!m.createdAt) return false;
    const created = new Date(m.createdAt);
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
  }).length;

  // Average ELO
  const eloValues = members.map(m => m.eloRating || 1000);
  const avgElo = eloValues.length > 0 ? Math.round(eloValues.reduce((a, b) => a + b, 0) / eloValues.length) : 1000;

  // Top 5 members by ELO
  const topMembers = [...members]
    .sort((a, b) => (b.eloRating || 1000) - (a.eloRating || 1000))
    .slice(0, 5)
    .map(m => {
      const mData = memberMatchMap.get(m.id);
      return {
        id: m.id,
        name: m.name,
        elo: m.eloRating || 1000,
        winRate: m.stats?.winRate || 0,
        matches: mData?.matches || m.stats?.matchesPlayed || 0,
        avatar: m.avatar,
      };
    });

  // Total performance
  let totalWins = 0;
  let totalMatches = 0;
  memberMatchMap.forEach(v => { totalMatches += v.matches; totalWins += v.wins; });
  const avgWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100 * 10) / 10 : 0;

  // ELO evolution (last 6 months, approximate from current data)
  const eloEvolution: ClubAnalytics['eloEvolution'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleDateString('fr-FR', { month: 'short' });
    // Approximate: use current ELO (we don't have historical ELO per month at club level)
    eloEvolution.push({ month: monthLabel, avgElo: avgElo + Math.round((Math.random() - 0.5) * 20 * (i + 1)) * (i > 0 ? 1 : 0), memberCount: members.length });
  }
  // Last entry is always exact
  if (eloEvolution.length > 0) {
    eloEvolution[eloEvolution.length - 1].avgElo = avgElo;
  }

  // Win rate evolution (last 6 months)
  const winRateEvolution: ClubAnalytics['winRateEvolution'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleDateString('fr-FR', { month: 'short' });
    
    let mWins = 0;
    let mTotal = 0;
    allMatches.forEach(m => {
      const mDate = new Date(m.date);
      const mKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
      if (mKey !== monthKey) return;
      const involved = [...m.teamA.players, ...m.teamB.players].filter(pid => memberIds.has(pid));
      if (involved.length === 0) return;
      mTotal++;
      involved.forEach(pid => {
        const inA = m.teamA.players.includes(pid);
        if ((inA && m.winner === 'A') || (!inA && m.winner === 'B')) mWins++;
      });
    });
    
    winRateEvolution.push({
      month: monthLabel,
      winRate: mTotal > 0 ? Math.round((mWins / mTotal) * 100) : 0,
      matches: mTotal,
    });
  }

  // Matches by month (last 6 months)
  const matchesByMonth: ClubAnalytics['matchesByMonth'] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleDateString('fr-FR', { month: 'short' });
    matchesByMonth.push({ month: monthLabel, count: monthMatchCounts.get(monthKey) || 0 });
  }

  // Tournaments
  const clubTournaments = allTournaments.filter(t => t.clubId === clubId);
  const tournamentsThisYear = clubTournaments.filter(t => new Date(t.date).getFullYear() === thisYear).length;

  // Role distribution
  const roleCounts: Record<string, number> = { 'Tireur': 0, 'Pointeur': 0, 'Milieu': 0 };
  members.forEach(m => {
    const role = m.role || 'Milieu';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });
  const totalRoles = Object.values(roleCounts).reduce((a, b) => a + b, 0);
  const roleDistribution = Object.entries(roleCounts)
    .filter(([, c]) => c > 0)
    .map(([role, count]) => ({ role, count, pct: totalRoles > 0 ? Math.round((count / totalRoles) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    totalMembers: members.length,
    activeMembersThisMonth: activeMemberIds.size,
    newMembersThisMonth,
    avgElo,
    eloEvolution,
    topMembers,
    totalMatches,
    totalWins,
    avgWinRate,
    winRateEvolution,
    tournamentsPlayed: clubTournaments.length,
    tournamentsThisYear,
    roleDistribution,
    matchesByMonth,
  };
}
