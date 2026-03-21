// ============================================
// Boules Brand/Model Leaderboard Service
// Aggregates match stats by boules brand & model
// ============================================
import { getSupabaseClient } from '@/template';

export interface LeaderboardBoulesEntry {
  id: string;
  brand: string;
  model?: string;
  userCount: number;
  totalMatches: number;
  stats: {
    avgWinRate: number;
    avgTirRate: number;
    avgPointRate: number;
    avgCarreauRate: number;
  };
  // Breakdown by role
  byRole?: {
    role: string;
    userCount: number;
    avgWinRate: number;
    avgTirRate: number;
  }[];
}

export type BoulesLeaderboardSort = 'avgWinRate' | 'totalMatches' | 'userCount' | 'avgTirRate' | 'avgCarreauRate';

export type BoulesLeaderboardMode = 'brand' | 'model';

interface PlayerBoulesData {
  userId: string;
  brand: string;
  model: string;
  role: string;
  stats: {
    matchesPlayed: number;
    wins: number;
    winRate: number;
    tirRate: number;
    pointRate: number;
    carreauRate: number;
  };
}

export async function fetchBoulesLeaderboard(): Promise<{ entries: PlayerBoulesData[]; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    // Fetch public players with boules info
    const { data, error } = await supabase
      .from('players')
      .select('user_id, name, role, stats, boules')
      .eq('is_public', true);

    if (error) return { entries: [], error: error.message };

    const entries: PlayerBoulesData[] = [];

    for (const p of data || []) {
      const stats = p.stats || {};
      if ((stats.matchesPlayed || 0) < 1) continue;

      const boules = p.boules || {};
      const brand = boules.brand;
      if (!brand) continue;

      entries.push({
        userId: p.user_id,
        brand: brand,
        model: boules.model || boules.name || '',
        role: p.role || 'Milieu',
        stats: {
          matchesPlayed: stats.matchesPlayed || 0,
          wins: stats.wins || 0,
          winRate: stats.winRate || 0,
          tirRate: stats.tirRate || 0,
          pointRate: stats.pointRate || 0,
          carreauRate: stats.carreauRate || 0,
        },
      });
    }

    return { entries, error: null };
  } catch (e: any) {
    return { entries: [], error: e.message || 'Boules leaderboard error' };
  }
}

export function aggregateBoulesData(
  entries: PlayerBoulesData[],
  mode: BoulesLeaderboardMode,
  filterRole?: string
): LeaderboardBoulesEntry[] {
  // Apply role filter if set
  let filtered = entries;
  if (filterRole && filterRole !== 'all') {
    filtered = entries.filter(e => e.role === filterRole);
  }

  // Group by brand or brand+model
  const groupMap = new Map<string, PlayerBoulesData[]>();
  for (const entry of filtered) {
    const key = mode === 'brand' ? entry.brand : `${entry.brand}|||${entry.model}`;
    const existing = groupMap.get(key) || [];
    existing.push(entry);
    groupMap.set(key, existing);
  }

  const results: LeaderboardBoulesEntry[] = [];

  for (const [key, group] of groupMap) {
    const brand = mode === 'brand' ? key : key.split('|||')[0];
    const model = mode === 'model' ? key.split('|||')[1] : undefined;

    // Deduplicate by userId (a user might appear once per brand)
    const uniqueUsers = new Set(group.map(g => g.userId));
    const userCount = uniqueUsers.size;
    const totalMatches = group.reduce((sum, g) => sum + g.stats.matchesPlayed, 0);

    const avgWinRate = Math.round(group.reduce((sum, g) => sum + g.stats.winRate, 0) / group.length);
    const avgTirRate = Math.round(
      group.filter(g => g.stats.tirRate > 0).reduce((sum, g) => sum + g.stats.tirRate, 0) /
      Math.max(1, group.filter(g => g.stats.tirRate > 0).length)
    );
    const avgPointRate = Math.round(
      group.filter(g => g.stats.pointRate > 0).reduce((sum, g) => sum + g.stats.pointRate, 0) /
      Math.max(1, group.filter(g => g.stats.pointRate > 0).length)
    );
    const avgCarreauRate = Math.round(
      group.filter(g => g.stats.carreauRate > 0).reduce((sum, g) => sum + g.stats.carreauRate, 0) /
      Math.max(1, group.filter(g => g.stats.carreauRate > 0).length)
    );

    // Breakdown by role (only for brand mode to keep it readable)
    const byRole: LeaderboardBoulesEntry['byRole'] = [];
    if (mode === 'brand') {
      const roleMap = new Map<string, PlayerBoulesData[]>();
      for (const g of group) {
        const roleGroup = roleMap.get(g.role) || [];
        roleGroup.push(g);
        roleMap.set(g.role, roleGroup);
      }
      for (const [role, roleEntries] of roleMap) {
        byRole.push({
          role,
          userCount: new Set(roleEntries.map(r => r.userId)).size,
          avgWinRate: Math.round(roleEntries.reduce((s, r) => s + r.stats.winRate, 0) / roleEntries.length),
          avgTirRate: Math.round(
            roleEntries.filter(r => r.stats.tirRate > 0).reduce((s, r) => s + r.stats.tirRate, 0) /
            Math.max(1, roleEntries.filter(r => r.stats.tirRate > 0).length)
          ),
        });
      }
    }

    results.push({
      id: key,
      brand,
      model: model || undefined,
      userCount,
      totalMatches,
      stats: { avgWinRate, avgTirRate, avgPointRate, avgCarreauRate },
      byRole: byRole.length > 0 ? byRole : undefined,
    });
  }

  return results;
}

export function sortBoulesLeaderboard(entries: LeaderboardBoulesEntry[], sortBy: BoulesLeaderboardSort): LeaderboardBoulesEntry[] {
  return [...entries].sort((a, b) => {
    switch (sortBy) {
      case 'avgWinRate':
        if (b.stats.avgWinRate !== a.stats.avgWinRate) return b.stats.avgWinRate - a.stats.avgWinRate;
        return b.totalMatches - a.totalMatches;
      case 'totalMatches':
        return b.totalMatches - a.totalMatches;
      case 'userCount':
        if (b.userCount !== a.userCount) return b.userCount - a.userCount;
        return b.stats.avgWinRate - a.stats.avgWinRate;
      case 'avgTirRate':
        if (b.stats.avgTirRate !== a.stats.avgTirRate) return b.stats.avgTirRate - a.stats.avgTirRate;
        return b.totalMatches - a.totalMatches;
      case 'avgCarreauRate':
        if (b.stats.avgCarreauRate !== a.stats.avgCarreauRate) return b.stats.avgCarreauRate - a.stats.avgCarreauRate;
        return b.totalMatches - a.totalMatches;
      default:
        return b.stats.avgWinRate - a.stats.avgWinRate;
    }
  });
}
