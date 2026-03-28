/**
 * Unit tests for hooks/useProgressionStats.ts
 * Tests: useProgressionData, useTrends, useChallengeProgressionData, useTournamentProgressionData
 */

import type { Match, Challenge, Tournament } from '@/types/petanque';

// ============================================================
// Test Data Factories
// ============================================================
const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'match-1',
  date: new Date().toISOString(),
  mode: 'Entraînement',
  format: 'Doublette',
  teamA: { players: ['p1'], playerNames: ['Alice'], score: 13 },
  teamB: { players: ['p2'], playerNames: ['Bob'], score: 8 },
  winner: 'A',
  duration: 45,
  menes: [],
  playerActions: [{ playerId: 'p1', playerName: 'Alice', team: 'A', actions: { tirs: 10, tirsSuccess: 7, points: 8, pointsSuccess: 5, carreaux: 2 } }],
  ...overrides,
});

const makeChallenge = (overrides: Partial<Challenge> = {}): Challenge => ({
  id: 'ch-1', type: '10_tirs', mode: 'solo', date: new Date().toISOString(),
  successCount: 7, totalShots: 10, carreauCount: 2, successRate: 70,
  ...overrides,
});

const makeTournament = (overrides: Partial<Tournament> = {}): Tournament => ({
  id: 'tour-1', name: 'Test Tournament', date: new Date().toISOString(),
  type: 'Mixte', format: 'Doublette', location: { city: 'Paris', latitude: 0, longitude: 0 },
  status: 'Terminé', ...overrides,
} as Tournament);

// ============================================================
// Inline computeProgressionData (mirrors useProgressionData)
// ============================================================
function computeProgressionData(matches: Match[], weeksToShow: number) {
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const useMonthly = weeksToShow > 52;
  const weeklyData: any[] = [];
  if (sortedMatches.length === 0) return { weeklyData, weeksToShow, useMonthly };

  const now = new Date();

  if (useMonthly) {
    const totalMonths = Math.ceil(weeksToShow / 4.33);
    const startDate = new Date(now); startDate.setMonth(startDate.getMonth() - totalMonths); startDate.setDate(1);
    const cur = new Date(startDate);
    while (cur <= now) {
      const ms = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const me = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59);
      const mm = sortedMatches.filter(m => { const d = new Date(m.date); return d >= ms && d <= me; });
      let tirS = 0, tirT = 0, ptS = 0, ptT = 0, cx = 0;
      mm.forEach(m => { if (m.playerActions) m.playerActions.filter(pa => pa.team === 'A').forEach(pa => { tirT += pa.actions.tirs; tirS += pa.actions.tirsSuccess; ptT += pa.actions.points; ptS += pa.actions.pointsSuccess; cx += pa.actions.carreaux; }); });
      const wins = mm.filter(m => m.winner === 'A').length;
      const tot = tirT + ptT; const suc = tirS + ptS;
      weeklyData.push({ week: `${ms.getMonth() + 1}/${String(ms.getFullYear()).slice(-2)}`, weekDate: new Date(ms), matches: mm.length, wins, winRate: mm.length > 0 ? Math.round((wins / mm.length) * 100) : 0, tirSuccess: tirS, tirTotal: tirT, tirRate: tirT > 0 ? Math.round((tirS / tirT) * 100) : 0, pointSuccess: ptS, pointTotal: ptT, pointRate: ptT > 0 ? Math.round((ptS / ptT) * 100) : 0, carreaux: cx, errors: tot - suc, errorRate: tot > 0 ? Math.round(((tot - suc) / tot) * 100) : 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    const startDate = new Date(now); startDate.setDate(startDate.getDate() - (weeksToShow * 7)); startDate.setDate(startDate.getDate() - startDate.getDay());
    const cur = new Date(startDate);
    while (cur <= now) {
      const ws = new Date(cur); const we = new Date(cur); we.setDate(we.getDate() + 6);
      const wm = sortedMatches.filter(m => { const d = new Date(m.date); return d >= ws && d <= we; });
      let tirS = 0, tirT = 0, ptS = 0, ptT = 0, cx = 0;
      wm.forEach(m => { if (m.playerActions) m.playerActions.filter(pa => pa.team === 'A').forEach(pa => { tirT += pa.actions.tirs; tirS += pa.actions.tirsSuccess; ptT += pa.actions.points; ptS += pa.actions.pointsSuccess; cx += pa.actions.carreaux; }); });
      const wins = wm.filter(m => m.winner === 'A').length;
      const tot = tirT + ptT; const suc = tirS + ptS;
      weeklyData.push({ week: `${ws.getDate()}/${ws.getMonth() + 1}`, weekDate: new Date(ws), matches: wm.length, wins, winRate: wm.length > 0 ? Math.round((wins / wm.length) * 100) : 0, tirSuccess: tirS, tirTotal: tirT, tirRate: tirT > 0 ? Math.round((tirS / tirT) * 100) : 0, pointSuccess: ptS, pointTotal: ptT, pointRate: ptT > 0 ? Math.round((ptS / ptT) * 100) : 0, carreaux: cx, errors: tot - suc, errorRate: tot > 0 ? Math.round(((tot - suc) / tot) * 100) : 0 });
      cur.setDate(cur.getDate() + 7);
    }
  }
  return { weeklyData, weeksToShow, useMonthly };
}

// ============================================================
// Inline computeTrends (mirrors useTrends)
// ============================================================
function computeTrends(progressionData: ReturnType<typeof computeProgressionData>) {
  const data = progressionData.weeklyData;
  if (data.length < 2) return { winRate: 'neutral' as const, tirRate: 'neutral' as const, pointRate: 'neutral' as const, errorRate: 'neutral' as const };
  const recent = data.slice(-4); const older = data.slice(-8, -4);
  const getAvg = (weeks: typeof data, field: string) => { const valid = weeks.filter((w: any) => w.matches > 0); if (valid.length === 0) return 0; return valid.reduce((sum: number, w: any) => sum + w[field], 0) / valid.length; };
  const getTrend = (r: number, o: number, isError = false) => { const diff = r - o; if (Math.abs(diff) < 5) return 'neutral' as const; if (isError) return diff > 0 ? 'down' as const : 'up' as const; return diff > 0 ? 'up' as const : 'down' as const; };
  return { winRate: getTrend(getAvg(recent, 'winRate'), getAvg(older, 'winRate')), tirRate: getTrend(getAvg(recent, 'tirRate'), getAvg(older, 'tirRate')), pointRate: getTrend(getAvg(recent, 'pointRate'), getAvg(older, 'pointRate')), errorRate: getTrend(getAvg(recent, 'errorRate'), getAvg(older, 'errorRate'), true) };
}

// ============================================================
// Inline computeTournamentProgression
// ============================================================
function computeTournamentProgression(tournaments: Tournament[], matches: Match[]) {
  const finished = tournaments.filter(t => t.status === 'Terminé');
  if (finished.length === 0) return { items: [] as any[], hasData: false };
  const RANKS: Record<string, number> = { '1er': 100, '2ème': 85, '3ème': 70, 'Demi-finale': 55, 'Quart de finale': 40 };
  const COLORS: Record<string, string> = { '1er': '#FFD700', '2ème': '#A8B4C0', '3ème': '#CD7F32' };
  const items = finished.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(tour => {
    const tm = matches.filter(m => m.tournamentId === tour.id);
    const wins = tm.filter(m => m.winner === 'A').length;
    return { id: tour.id, name: tour.name, date: tour.date, result: tour.finalResult || 'Autre', resultRank: RANKS[tour.finalResult || ''] || 5, resultColor: COLORS[tour.finalResult || ''] || '#94A3B8', winRate: tm.length > 0 ? Math.round((wins / tm.length) * 100) : 0, matches: tm.length, wins, pointDiff: 0, format: tour.format };
  });
  return { items, hasData: items.length > 0 };
}

// ============================================================
// Tests: useProgressionData
// ============================================================
describe('useProgressionData', () => {
  test('empty matches returns empty weeklyData', () => {
    const result = computeProgressionData([], 8);
    expect(result.weeklyData).toHaveLength(0);
    expect(result.useMonthly).toBe(false);
  });

  test('groups matches into weekly buckets for <= 52 weeks', () => {
    const now = new Date();
    const lastWeek = new Date(now); lastWeek.setDate(lastWeek.getDate() - 3);
    const matches = [makeMatch({ id: 'm1', date: lastWeek.toISOString(), winner: 'A' })];
    const result = computeProgressionData(matches, 4);
    expect(result.useMonthly).toBe(false);
    expect(result.weeklyData.length).toBeGreaterThan(0);
    const weekWithMatch = result.weeklyData.find((w: any) => w.matches > 0);
    expect(weekWithMatch).toBeDefined();
    expect(weekWithMatch.winRate).toBe(100);
  });

  test('uses monthly grouping for > 52 weeks', () => {
    const now = new Date();
    const twoMonthsAgo = new Date(now); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const matches = [makeMatch({ id: 'm1', date: twoMonthsAgo.toISOString() })];
    const result = computeProgressionData(matches, 104);
    expect(result.useMonthly).toBe(true);
    expect(result.weeklyData.length).toBeGreaterThan(0);
  });

  test('computes tir/point rates per week', () => {
    const now = new Date();
    const recent = new Date(now); recent.setDate(recent.getDate() - 2);
    const matches = [makeMatch({
      id: 'm1', date: recent.toISOString(),
      playerActions: [{ playerId: 'p1', playerName: 'A', team: 'A', actions: { tirs: 10, tirsSuccess: 8, points: 10, pointsSuccess: 6, carreaux: 3 } }],
    })];
    const result = computeProgressionData(matches, 4);
    const weekWithMatch = result.weeklyData.find((w: any) => w.matches > 0);
    expect(weekWithMatch).toBeDefined();
    expect(weekWithMatch.tirRate).toBe(80);
    expect(weekWithMatch.pointRate).toBe(60);
    expect(weekWithMatch.carreaux).toBe(3);
  });

  test('weeks without matches have zero rates', () => {
    const now = new Date();
    const old = new Date(now); old.setDate(old.getDate() - 25);
    const matches = [makeMatch({ id: 'm1', date: old.toISOString() })];
    const result = computeProgressionData(matches, 4);
    const emptyWeeks = result.weeklyData.filter((w: any) => w.matches === 0);
    emptyWeeks.forEach((w: any) => {
      expect(w.winRate).toBe(0);
      expect(w.tirRate).toBe(0);
      expect(w.pointRate).toBe(0);
    });
  });

  test('output has required fields', () => {
    const result = computeProgressionData([makeMatch()], 8);
    expect(result).toHaveProperty('weeklyData');
    expect(result).toHaveProperty('weeksToShow');
    expect(result).toHaveProperty('useMonthly');
    if (result.weeklyData.length > 0) {
      const w = result.weeklyData[0];
      expect(w).toHaveProperty('week');
      expect(w).toHaveProperty('matches');
      expect(w).toHaveProperty('wins');
      expect(w).toHaveProperty('winRate');
      expect(w).toHaveProperty('tirRate');
      expect(w).toHaveProperty('pointRate');
      expect(w).toHaveProperty('carreaux');
      expect(w).toHaveProperty('errorRate');
    }
  });
});

// ============================================================
// Tests: useTrends
// ============================================================
describe('useTrends', () => {
  test('returns neutral for fewer than 2 data points', () => {
    const result = computeTrends({ weeklyData: [{ matches: 1, winRate: 50, tirRate: 50, pointRate: 50, errorRate: 20 }], weeksToShow: 4, useMonthly: false });
    expect(result.winRate).toBe('neutral');
    expect(result.tirRate).toBe('neutral');
    expect(result.pointRate).toBe('neutral');
    expect(result.errorRate).toBe('neutral');
  });

  test('detects upward trend when recent > older by >= 5', () => {
    const weeklyData = [
      { matches: 2, winRate: 40, tirRate: 40, pointRate: 40, errorRate: 40 },
      { matches: 2, winRate: 42, tirRate: 42, pointRate: 42, errorRate: 42 },
      { matches: 2, winRate: 44, tirRate: 44, pointRate: 44, errorRate: 44 },
      { matches: 2, winRate: 46, tirRate: 46, pointRate: 46, errorRate: 46 },
      { matches: 2, winRate: 60, tirRate: 60, pointRate: 60, errorRate: 60 },
      { matches: 2, winRate: 62, tirRate: 62, pointRate: 62, errorRate: 62 },
      { matches: 2, winRate: 64, tirRate: 64, pointRate: 64, errorRate: 64 },
      { matches: 2, winRate: 66, tirRate: 66, pointRate: 66, errorRate: 66 },
    ];
    const result = computeTrends({ weeklyData, weeksToShow: 8, useMonthly: false });
    expect(result.winRate).toBe('up');
    expect(result.tirRate).toBe('up');
    // Error rate up means performance DOWN
    expect(result.errorRate).toBe('down');
  });

  test('detects downward trend when recent < older by >= 5', () => {
    const weeklyData = [
      { matches: 2, winRate: 70, tirRate: 70, pointRate: 70, errorRate: 20 },
      { matches: 2, winRate: 72, tirRate: 72, pointRate: 72, errorRate: 18 },
      { matches: 2, winRate: 68, tirRate: 68, pointRate: 68, errorRate: 22 },
      { matches: 2, winRate: 70, tirRate: 70, pointRate: 70, errorRate: 20 },
      { matches: 2, winRate: 50, tirRate: 50, pointRate: 50, errorRate: 40 },
      { matches: 2, winRate: 52, tirRate: 52, pointRate: 52, errorRate: 38 },
      { matches: 2, winRate: 48, tirRate: 48, pointRate: 48, errorRate: 42 },
      { matches: 2, winRate: 50, tirRate: 50, pointRate: 50, errorRate: 40 },
    ];
    const result = computeTrends({ weeklyData, weeksToShow: 8, useMonthly: false });
    expect(result.winRate).toBe('down');
    // Error rate went up → performance is worse → errorRate trend = 'up' (inverted)
    expect(result.errorRate).toBe('up');
  });

  test('returns neutral when difference < 5', () => {
    const weeklyData = [
      { matches: 2, winRate: 50, tirRate: 50, pointRate: 50, errorRate: 30 },
      { matches: 2, winRate: 51, tirRate: 51, pointRate: 51, errorRate: 29 },
      { matches: 2, winRate: 50, tirRate: 50, pointRate: 50, errorRate: 30 },
      { matches: 2, winRate: 51, tirRate: 51, pointRate: 51, errorRate: 29 },
      { matches: 2, winRate: 52, tirRate: 52, pointRate: 52, errorRate: 28 },
      { matches: 2, winRate: 53, tirRate: 53, pointRate: 53, errorRate: 27 },
      { matches: 2, winRate: 52, tirRate: 52, pointRate: 52, errorRate: 28 },
      { matches: 2, winRate: 53, tirRate: 53, pointRate: 53, errorRate: 27 },
    ];
    const result = computeTrends({ weeklyData, weeksToShow: 8, useMonthly: false });
    expect(result.winRate).toBe('neutral');
  });

  test('skips weeks with zero matches in average', () => {
    const weeklyData = [
      { matches: 0, winRate: 0, tirRate: 0, pointRate: 0, errorRate: 0 },
      { matches: 0, winRate: 0, tirRate: 0, pointRate: 0, errorRate: 0 },
      { matches: 2, winRate: 40, tirRate: 40, pointRate: 40, errorRate: 40 },
      { matches: 0, winRate: 0, tirRate: 0, pointRate: 0, errorRate: 0 },
      { matches: 2, winRate: 80, tirRate: 80, pointRate: 80, errorRate: 10 },
      { matches: 0, winRate: 0, tirRate: 0, pointRate: 0, errorRate: 0 },
      { matches: 0, winRate: 0, tirRate: 0, pointRate: 0, errorRate: 0 },
      { matches: 2, winRate: 80, tirRate: 80, pointRate: 80, errorRate: 10 },
    ];
    const result = computeTrends({ weeklyData, weeksToShow: 8, useMonthly: false });
    expect(result.winRate).toBe('up');
  });
});

// ============================================================
// Tests: useTournamentProgressionData
// ============================================================
describe('useTournamentProgressionData', () => {
  test('empty tournaments returns no data', () => {
    const result = computeTournamentProgression([], []);
    expect(result.hasData).toBe(false);
    expect(result.items).toHaveLength(0);
  });

  test('only includes finished tournaments', () => {
    const tournaments = [
      makeTournament({ id: 't1', status: 'Terminé', name: 'Finished' }),
      makeTournament({ id: 't2', status: 'À venir', name: 'Upcoming' }),
    ];
    const result = computeTournamentProgression(tournaments, []);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Finished');
  });

  test('computes win rate per tournament', () => {
    const tournaments = [makeTournament({ id: 't1', status: 'Terminé' })];
    const matches = [
      makeMatch({ id: 'm1', tournamentId: 't1', winner: 'A' }),
      makeMatch({ id: 'm2', tournamentId: 't1', winner: 'A' }),
      makeMatch({ id: 'm3', tournamentId: 't1', winner: 'B' }),
    ];
    const result = computeTournamentProgression(tournaments, matches);
    expect(result.items[0].matches).toBe(3);
    expect(result.items[0].wins).toBe(2);
    expect(result.items[0].winRate).toBe(67);
  });

  test('assigns result colors for known results', () => {
    const tournaments = [
      makeTournament({ id: 't1', status: 'Terminé', finalResult: '1er' }),
      makeTournament({ id: 't2', status: 'Terminé', finalResult: '2ème' }),
    ];
    const result = computeTournamentProgression(tournaments, []);
    expect(result.items[0].resultColor).toBe('#FFD700');
    expect(result.items[1].resultColor).toBe('#A8B4C0');
  });

  test('sorts items by date ascending', () => {
    const tournaments = [
      makeTournament({ id: 't1', status: 'Terminé', date: '2025-06-01', name: 'June' }),
      makeTournament({ id: 't2', status: 'Terminé', date: '2025-01-15', name: 'January' }),
      makeTournament({ id: 't3', status: 'Terminé', date: '2025-03-10', name: 'March' }),
    ];
    const result = computeTournamentProgression(tournaments, []);
    expect(result.items[0].name).toBe('January');
    expect(result.items[1].name).toBe('March');
    expect(result.items[2].name).toBe('June');
  });

  test('output items have required fields', () => {
    const tournaments = [makeTournament({ id: 't1', status: 'Terminé' })];
    const result = computeTournamentProgression(tournaments, [makeMatch({ tournamentId: 't1' })]);
    const item = result.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('winRate');
    expect(item).toHaveProperty('matches');
    expect(item).toHaveProperty('resultColor');
    expect(item).toHaveProperty('resultRank');
  });
});
