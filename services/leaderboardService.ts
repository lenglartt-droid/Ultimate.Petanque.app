import { getSupabaseClient } from '@/template';

export interface LeaderboardPlayer {
  id: string;
  userId: string;
  name: string;
  nickname?: string;
  avatar?: string;
  club?: string;
  role: string;
  level: string;
  country?: string;
  city?: string;
  boulesBrand?: string;
  boulesModel?: string;
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    tirRate: number;
    pointRate: number;
    carreauRate: number;
  };
}

export type LeaderboardSort = 'winRate' | 'matches' | 'tirRate' | 'carreauRate';

export async function fetchLeaderboard(): Promise<{ players: LeaderboardPlayer[]; error: string | null }> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('players')
      .select('id, user_id, name, nickname, avatar, club, role, level, country, location, stats, boules')
      .eq('is_public', true);

    if (error) return { players: [], error: error.message };

    const players: LeaderboardPlayer[] = (data || [])
      .filter((p: any) => {
        const stats = p.stats || {};
        return (stats.matchesPlayed || 0) >= 1;
      })
      .map((p: any) => {
        const stats = p.stats || {};
        return {
          id: p.id,
          userId: p.user_id,
          name: p.name,
          nickname: p.nickname || undefined,
          avatar: p.avatar || undefined,
          club: p.club || undefined,
          role: p.role || 'Milieu',
          level: p.level || 'Intermédiaire',
          country: p.country || undefined,
          city: p.location?.city || undefined,
          boulesBrand: p.boules?.brand || undefined,
          boulesModel: p.boules?.model || undefined,
          stats: {
            matchesPlayed: stats.matchesPlayed || 0,
            wins: stats.wins || 0,
            losses: stats.losses || 0,
            winRate: stats.winRate || 0,
            tirRate: stats.tirRate || 0,
            pointRate: stats.pointRate || 0,
            carreauRate: stats.carreauRate || 0,
          },
        };
      });

    return { players, error: null };
  } catch (e: any) {
    return { players: [], error: e.message || 'Leaderboard error' };
  }
}

export function sortLeaderboard(players: LeaderboardPlayer[], sortBy: LeaderboardSort): LeaderboardPlayer[] {
  return [...players].sort((a, b) => {
    switch (sortBy) {
      case 'winRate':
        if (b.stats.winRate !== a.stats.winRate) return b.stats.winRate - a.stats.winRate;
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      case 'matches':
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      case 'tirRate':
        if (b.stats.tirRate !== a.stats.tirRate) return b.stats.tirRate - a.stats.tirRate;
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      case 'carreauRate':
        if (b.stats.carreauRate !== a.stats.carreauRate) return b.stats.carreauRate - a.stats.carreauRate;
        return b.stats.matchesPlayed - a.stats.matchesPlayed;
      default:
        return b.stats.winRate - a.stats.winRate;
    }
  });
}
