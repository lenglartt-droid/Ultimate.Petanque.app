import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { Match, Challenge, Tournament, Player } from '@/services/mockData';

export type ExportFormat = 'csv' | 'pdf';
export type ExportDataType = 'matches' | 'challenges' | 'statistics';
export type ExportPeriod = 'all' | '7d' | '30d' | '3m' | '6m' | '1y';
export type ExportPreset = 'none' | 'tournament' | 'season' | 'comparative' | 'match' | 'player' | 'challenge';

interface ExportOptions {
  format: ExportFormat;
  dataType: ExportDataType;
  period: ExportPeriod;
  language: 'fr' | 'en';
  username: string;
  preset?: ExportPreset;
  tournamentId?: string;
  tournamentName?: string;
  seasonYear?: number;
  comparePeriod?: ExportPeriod;
  compareSeasonYear?: number;
  matchId?: string;
  playerId?: string;
  playerName?: string;
  challengeId?: string;
}

export interface PeriodStats {
  label: string;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  totalTirs: number;
  tirsSuccess: number;
  tirRate: number;
  totalPoints: number;
  pointsSuccess: number;
  pointRate: number;
  carreaux: number;
  carreauRate: number;
  totalChallenges: number;
  avgDuration: number;
}

export interface PreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  title: string;
}

// ============================================
// FILTER HELPERS
// ============================================

function filterByPeriod<T extends { date: string }>(items: T[], period: ExportPeriod): T[] {
  if (period === 'all') return items;
  const now = new Date();
  const cutoff = new Date();
  switch (period) {
    case '7d': cutoff.setDate(now.getDate() - 7); break;
    case '30d': cutoff.setDate(now.getDate() - 30); break;
    case '3m': cutoff.setMonth(now.getMonth() - 3); break;
    case '6m': cutoff.setMonth(now.getMonth() - 6); break;
    case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
  }
  return items.filter(item => new Date(item.date) >= cutoff);
}

function filterBySeason<T extends { date: string }>(items: T[], startYear: number): T[] {
  const seasonStart = new Date(startYear, 8, 1);
  const seasonEnd = new Date(startYear + 1, 5, 30, 23, 59, 59);
  return items.filter(item => {
    const d = new Date(item.date);
    return d >= seasonStart && d <= seasonEnd;
  });
}

function filterByTournament(matches: Match[], tournamentId: string): Match[] {
  return matches.filter(m => m.tournamentId === tournamentId);
}

function filterMatchesByPlayer(matches: Match[], playerId: string): Match[] {
  return matches.filter(m =>
    m.teamA.players.includes(playerId) || m.teamB.players.includes(playerId)
  );
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ============================================
// PERIOD STATS COMPUTATION
// ============================================

export function computePeriodStats(
  matches: Match[],
  challenges: Challenge[],
  label: string,
): PeriodStats {
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.winner === 'A').length;
  let totalTirs = 0, tirsSuccess = 0, totalPoints = 0, pointsSuccess = 0, carreaux = 0, totalDuration = 0;

  matches.forEach(m => {
    totalDuration += m.duration || 0;
    if (m.playerActions) {
      m.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
        totalTirs += pa.actions.tirs;
        tirsSuccess += pa.actions.tirsSuccess;
        totalPoints += pa.actions.points;
        pointsSuccess += pa.actions.pointsSuccess;
        carreaux += pa.actions.carreaux;
      });
    }
  });

  return {
    label,
    totalMatches,
    wins,
    losses: totalMatches - wins,
    winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
    totalTirs,
    tirsSuccess,
    tirRate: totalTirs > 0 ? Math.round((tirsSuccess / totalTirs) * 100) : 0,
    totalPoints,
    pointsSuccess,
    pointRate: totalPoints > 0 ? Math.round((pointsSuccess / totalPoints) * 100) : 0,
    carreaux,
    carreauRate: tirsSuccess > 0 ? Math.round((carreaux / tirsSuccess) * 100) : 0,
    totalChallenges: challenges.length,
    avgDuration: totalMatches > 0 ? Math.round(totalDuration / totalMatches) : 0,
  };
}

// ============================================
// PREVIEW GENERATION
// ============================================

function matchToRow(m: Match, lang: 'fr' | 'en'): string[] {
  return [
    new Date(m.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'),
    m.mode,
    m.format,
    m.teamA.playerNames.join(' + '),
    `${m.teamA.score} - ${m.teamB.score}`,
    m.winner === 'A' ? (lang === 'fr' ? 'V' : 'W') : (lang === 'fr' ? 'D' : 'L'),
    m.duration ? `${m.duration} min` : '-',
  ];
}

function challengeToRow(c: Challenge, lang: 'fr' | 'en'): string[] {
  const typeLabels: Record<string, Record<string, string>> = {
    '10_tirs': { fr: '10 Tirs', en: '10 Shots' },
    '10_tirs_sautee': { fr: '10 Tirs sautee', en: '10 Lob' },
    'precision': { fr: 'Precision', en: 'Precision' },
  };
  return [
    new Date(c.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'),
    typeLabels[c.type]?.[lang] || c.type,
    c.mode === 'solo' ? 'Solo' : '1v1',
    c.successCount != null ? `${c.successCount}/${c.totalShots || 10}` : (c.totalPoints != null ? `${c.totalPoints} pts` : '-'),
    c.carreauCount != null ? String(c.carreauCount) : '-',
    c.winner === 'player' ? (lang === 'fr' ? 'V' : 'W') : c.winner === 'opponent' ? (lang === 'fr' ? 'D' : 'L') : c.winner === 'draw' ? '=' : '-',
  ];
}

export function generatePreview(
  options: ExportOptions,
  matches: Match[],
  challenges: Challenge[],
  tournaments: Tournament[],
  userStats: any,
  maxRows: number = 5,
): PreviewData {
  const { dataType, period, language, preset, tournamentId, tournamentName, seasonYear, comparePeriod, matchId, playerId, playerName, challengeId } = options;
  const lbl = (fr: string, en: string) => language === 'fr' ? fr : en;

  // ---- COMPARATIVE ----
  if (preset === 'comparative' && comparePeriod) {
    const matchesA = filterByPeriod(matches, period);
    const matchesB = filterByPeriod(matches, comparePeriod);
    const challengesA = filterByPeriod(challenges, period);
    const challengesB = filterByPeriod(challenges, comparePeriod);
    const pLabels: Record<string, string> = language === 'fr'
      ? { all: 'Tout', '7d': '7j', '30d': '30j', '3m': '3m', '6m': '6m', '1y': '1an' }
      : { all: 'All', '7d': '7d', '30d': '30d', '3m': '3m', '6m': '6m', '1y': '1y' };
    const statsA = computePeriodStats(matchesA, challengesA, pLabels[period] || period);
    const statsB = computePeriodStats(matchesB, challengesB, pLabels[comparePeriod] || comparePeriod);
    const headers = [lbl('Stat', 'Stat'), statsA.label, statsB.label, 'Delta'];
    const rows = [
      [lbl('Matchs', 'Games'), String(statsA.totalMatches), String(statsB.totalMatches), `${statsA.totalMatches - statsB.totalMatches > 0 ? '+' : ''}${statsA.totalMatches - statsB.totalMatches}`],
      [lbl('Vict.%', 'Win%'), `${statsA.winRate}%`, `${statsB.winRate}%`, `${statsA.winRate - statsB.winRate > 0 ? '+' : ''}${statsA.winRate - statsB.winRate}%`],
      [lbl('Tir%', 'Shot%'), `${statsA.tirRate}%`, `${statsB.tirRate}%`, `${statsA.tirRate - statsB.tirRate > 0 ? '+' : ''}${statsA.tirRate - statsB.tirRate}%`],
      [lbl('Carreau%', 'Car.%'), `${statsA.carreauRate}%`, `${statsB.carreauRate}%`, `${statsA.carreauRate - statsB.carreauRate > 0 ? '+' : ''}${statsA.carreauRate - statsB.carreauRate}%`],
    ];
    return { headers, rows, totalRows: rows.length, title: lbl('Comparatif', 'Comparative') };
  }

  // ---- SINGLE MATCH ----
  if (preset === 'match' && matchId) {
    const m = matches.find(mt => mt.id === matchId);
    if (!m) return { headers: [], rows: [], totalRows: 0, title: lbl('Match', 'Match') };
    const headers = [lbl('Info', 'Info'), lbl('Valeur', 'Value')];
    const rows: string[][] = [
      [lbl('Date', 'Date'), new Date(m.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')],
      ['Format', m.format],
      ['Mode', m.mode],
      [lbl('Equipe A', 'Team A'), m.teamA.playerNames.join(', ')],
      [lbl('Equipe B', 'Team B'), m.teamB.playerNames.join(', ')],
      ['Score', `${m.teamA.score} - ${m.teamB.score}`],
      [lbl('Duree', 'Duration'), m.duration ? `${m.duration} min` : '-'],
      [lbl('Menes', 'Ends'), String(m.menes?.length || 0)],
    ];
    if (m.playerActions) {
      m.playerActions.forEach(pa => {
        rows.push([`${pa.playerName} - Tir`, `${pa.actions.tirsSuccess}/${pa.actions.tirs}`]);
        rows.push([`${pa.playerName} - Pts`, `${pa.actions.pointsSuccess}/${pa.actions.points}`]);
      });
    }
    return { headers, rows: rows.slice(0, maxRows), totalRows: rows.length, title: `Match ${new Date(m.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}` };
  }

  // ---- SINGLE CHALLENGE ----
  if (preset === 'challenge' && challengeId) {
    const c = challenges.find(ch => ch.id === challengeId);
    if (!c) return { headers: [], rows: [], totalRows: 0, title: lbl('Defi', 'Challenge') };
    const typeLabels: Record<string, Record<string, string>> = {
      '10_tirs': { fr: '10 Tirs', en: '10 Shots' },
      '10_tirs_sautee': { fr: '10 Tirs sautee', en: '10 Lob Shots' },
      'precision': { fr: 'Precision', en: 'Precision' },
    };
    const headers = [lbl('Info', 'Info'), lbl('Valeur', 'Value')];
    const rows: string[][] = [
      [lbl('Date', 'Date'), new Date(c.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')],
      ['Type', typeLabels[c.type]?.[language] || c.type],
      ['Mode', c.mode === 'solo' ? 'Solo' : `1v1 vs ${c.opponentName || '?'}`],
      [lbl('Reussite', 'Success'), c.successCount != null ? `${c.successCount}/${c.totalShots || 10}` : '-'],
      ['Carreaux', String(c.carreauCount ?? 0)],
      [lbl('Taux', 'Rate'), c.successRate != null ? `${Math.round(c.successRate)}%` : (c.totalPoints != null ? `${c.totalPoints} pts` : '-')],
      [lbl('Duree', 'Duration'), c.duration ? `${c.duration}s` : '-'],
    ];
    if (c.mode === '1v1' && c.opponentResult) {
      rows.push([lbl('Adv. reussite', 'Opp. success'), `${c.opponentResult.successCount ?? '-'}/${c.opponentResult.totalShots ?? '-'}`]);
      rows.push([lbl('Resultat', 'Result'), c.winner === 'player' ? lbl('Victoire', 'Win') : c.winner === 'opponent' ? lbl('Defaite', 'Loss') : lbl('Egalite', 'Draw')]);
    }
    return { headers, rows: rows.slice(0, maxRows), totalRows: rows.length, title: `${typeLabels[c.type]?.[language] || c.type}` };
  }

  // ---- BY PLAYER ----
  if (preset === 'player' && playerId) {
    const playerMatches = filterMatchesByPlayer(matches, playerId);
    const name = playerName || 'Joueur';
    if (dataType === 'matches') {
      const headers = [lbl('Date', 'Date'), 'Format', lbl('Equipes', 'Teams'), 'Score', lbl('R', 'R')];
      const rows = playerMatches.slice(0, maxRows).map(m => [
        new Date(m.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US'),
        m.format,
        `${m.teamA.playerNames.join('+')} vs ${m.teamB.playerNames.join('+')}`,
        `${m.teamA.score}-${m.teamB.score}`,
        m.winner === 'A' ? (m.teamA.players.includes(playerId) ? 'V' : 'D') : (m.teamB.players.includes(playerId) ? 'V' : 'D'),
      ]);
      return { headers, rows, totalRows: playerMatches.length, title: `${name}` };
    } else {
      const playerChallenges = challenges.filter(c => c.playerId === playerId);
      const stats = computePeriodStats(playerMatches, playerChallenges, name);
      const headers = [lbl('Stat', 'Stat'), lbl('Valeur', 'Value')];
      const rows: string[][] = [
        [lbl('Matchs', 'Games'), String(stats.totalMatches)],
        [lbl('Victoires', 'Wins'), `${stats.wins} (${stats.winRate}%)`],
        [lbl('Tir', 'Shot'), `${stats.tirRate}%`],
        [lbl('Point', 'Point'), `${stats.pointRate}%`],
        [lbl('Carreau', 'Carreau'), `${stats.carreauRate}%`],
      ];
      return { headers, rows, totalRows: rows.length, title: `${name}` };
    }
  }

  // ---- STANDARD / TOURNAMENT / SEASON ----
  let filteredMatches: Match[];
  let filteredChallenges: Challenge[];
  let title = '';

  if (preset === 'tournament' && tournamentId) {
    filteredMatches = filterByTournament(matches, tournamentId);
    filteredChallenges = [];
    title = tournamentName || lbl('Tournoi', 'Tournament');
  } else if (preset === 'season' && seasonYear) {
    filteredMatches = filterBySeason(matches, seasonYear);
    filteredChallenges = filterBySeason(challenges, seasonYear);
    title = `${lbl('Saison', 'Season')} ${seasonYear}-${seasonYear + 1}`;
  } else {
    filteredMatches = filterByPeriod(matches, period);
    filteredChallenges = filterByPeriod(challenges, period);
    title = lbl('Export', 'Export');
  }

  if (dataType === 'matches') {
    const headers = [lbl('Date', 'Date'), 'Mode', 'Format', lbl('Eq. A', 'Tm A'), 'Score', lbl('R', 'R'), lbl('Dur.', 'Dur.')];
    const rows = filteredMatches.slice(0, maxRows).map(m => matchToRow(m, language));
    return { headers, rows, totalRows: filteredMatches.length, title };
  } else if (dataType === 'challenges') {
    const headers = [lbl('Date', 'Date'), 'Type', 'Mode', lbl('Score', 'Score'), 'Car.', lbl('R', 'R')];
    const rows = filteredChallenges.slice(0, maxRows).map(c => challengeToRow(c, language));
    return { headers, rows, totalRows: filteredChallenges.length, title };
  } else {
    const stats = computePeriodStats(filteredMatches, filteredChallenges, '');
    const headers = [lbl('Stat', 'Stat'), lbl('Valeur', 'Value')];
    const rows: string[][] = [
      [lbl('Matchs', 'Games'), String(stats.totalMatches)],
      [lbl('Victoires', 'Wins'), `${stats.wins} (${stats.winRate}%)`],
      [lbl('Tir', 'Shot'), `${stats.tirRate}% (${stats.tirsSuccess}/${stats.totalTirs})`],
      [lbl('Point', 'Point'), `${stats.pointRate}% (${stats.pointsSuccess}/${stats.totalPoints})`],
      [lbl('Carreau', 'Carreau'), `${stats.carreauRate}% (${stats.carreaux})`],
    ];
    return { headers, rows, totalRows: rows.length, title };
  }
}

// ============================================
// CSV EXPORTS
// ============================================

export function matchesToCsv(matches: Match[], lang: 'fr' | 'en'): string {
  const headers = lang === 'fr'
    ? ['Date', 'Mode', 'Format', 'Tournoi', 'Equipe A', 'Score A', 'Equipe B', 'Score B', 'Vainqueur', 'Duree (min)', 'Menes', 'Terrain']
    : ['Date', 'Mode', 'Format', 'Tournament', 'Team A', 'Score A', 'Team B', 'Score B', 'Winner', 'Duration (min)', 'Ends', 'Terrain'];

  const rows = matches.map(m => [
    new Date(m.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'),
    m.mode,
    m.format,
    m.tournamentName || '',
    m.teamA.playerNames.join(' + '),
    m.teamA.score,
    m.teamB.playerNames.join(' + '),
    m.teamB.score,
    m.winner === 'A' ? m.teamA.playerNames.join(' + ') : m.teamB.playerNames.join(' + '),
    m.duration || '',
    m.menes?.length || 0,
    m.terrainType || '',
  ]);

  return [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
}

function singleMatchToCsv(m: Match, lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const rows: string[][] = [
    [lbl('Info', 'Info'), lbl('Valeur', 'Value')],
    [lbl('Date', 'Date'), new Date(m.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')],
    ['Format', m.format],
    ['Mode', m.mode],
    [lbl('Equipe A', 'Team A'), m.teamA.playerNames.join(', ')],
    [lbl('Equipe B', 'Team B'), m.teamB.playerNames.join(', ')],
    ['Score', `${m.teamA.score} - ${m.teamB.score}`],
    [lbl('Vainqueur', 'Winner'), m.winner === 'A' ? m.teamA.playerNames.join(', ') : m.teamB.playerNames.join(', ')],
    [lbl('Duree (min)', 'Duration (min)'), String(m.duration || '-')],
    [lbl('Menes', 'Ends'), String(m.menes?.length || 0)],
    [lbl('Tournoi', 'Tournament'), m.tournamentName || '-'],
    [''],
  ];
  if (m.menes && m.menes.length > 0) {
    rows.push([lbl('Mene', 'End'), lbl('Eq. A', 'Team A'), lbl('Eq. B', 'Team B'), lbl('Score A', 'Score A'), lbl('Score B', 'Score B')]);
    let cumA = 0, cumB = 0;
    m.menes.forEach((mene, i) => {
      cumA += mene.teamAPoints;
      cumB += mene.teamBPoints;
      rows.push([String(i + 1), String(mene.teamAPoints), String(mene.teamBPoints), String(cumA), String(cumB)]);
    });
    rows.push(['']);
  }
  if (m.playerActions) {
    rows.push([lbl('Joueur', 'Player'), lbl('Equipe', 'Team'), lbl('Tirs', 'Shots'), lbl('Tirs reussis', 'Shots hit'), lbl('Points', 'Points'), lbl('Points reussis', 'Points hit'), lbl('Carreaux', 'Carreaux')]);
    m.playerActions.forEach(pa => {
      rows.push([pa.playerName, pa.team, String(pa.actions.tirs), String(pa.actions.tirsSuccess), String(pa.actions.points), String(pa.actions.pointsSuccess), String(pa.actions.carreaux)]);
    });
  }
  return rows.map(r => r.map(escapeCsv).join(',')).join('\n');
}

function singleChallengeToCsv(c: Challenge, lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const typeLabels: Record<string, Record<string, string>> = {
    '10_tirs': { fr: '10 Tirs', en: '10 Shots' },
    '10_tirs_sautee': { fr: '10 Tirs sautee', en: '10 Lob Shots' },
    'precision': { fr: 'Precision', en: 'Precision' },
  };
  const rows: string[][] = [
    [lbl('Info', 'Info'), lbl('Valeur', 'Value')],
    [lbl('Date', 'Date'), new Date(c.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')],
    ['Type', typeLabels[c.type]?.[lang] || c.type],
    ['Mode', c.mode === 'solo' ? 'Solo' : `1v1 vs ${c.opponentName || '?'}`],
    [lbl('Reussite', 'Success'), `${c.successCount ?? '-'} / ${c.totalShots ?? '-'}`],
    ['Carreaux', String(c.carreauCount ?? 0)],
    [lbl('Taux', 'Rate'), c.successRate != null ? `${Math.round(c.successRate)}%` : (c.totalPoints != null ? `${c.totalPoints} pts` : '-')],
    [lbl('Duree (s)', 'Duration (s)'), String(c.duration ?? '-')],
  ];
  if (c.mode === '1v1' && c.opponentResult) {
    rows.push(['']);
    rows.push([lbl('Adversaire', 'Opponent'), c.opponentName || '']);
    rows.push([lbl('Reussite adv.', 'Opp. success'), `${c.opponentResult.successCount ?? '-'} / ${c.opponentResult.totalShots ?? '-'}`]);
    rows.push([lbl('Resultat', 'Result'), c.winner === 'player' ? lbl('Victoire', 'Win') : c.winner === 'opponent' ? lbl('Defaite', 'Loss') : lbl('Egalite', 'Draw')]);
  }
  if (c.shots && c.shots.length > 0) {
    rows.push(['']);
    rows.push([lbl('Tir #', 'Shot #'), lbl('Resultat', 'Result'), lbl('Carreau', 'Carreau')]);
    c.shots.forEach(s => {
      rows.push([String(s.number), s.success ? lbl('Reussi', 'Hit') : lbl('Rate', 'Miss'), s.carreau ? lbl('Oui', 'Yes') : '']);
    });
  }
  return rows.map(r => r.map(escapeCsv).join(',')).join('\n');
}

export function challengesToCsv(challenges: Challenge[], lang: 'fr' | 'en'): string {
  const headers = lang === 'fr'
    ? ['Date', 'Type', 'Mode', 'Adversaire', 'Reussite', 'Total tirs', 'Carreaux', 'Taux (%)', 'Points', 'Duree (s)', 'Resultat']
    : ['Date', 'Type', 'Mode', 'Opponent', 'Success', 'Total shots', 'Carreaux', 'Rate (%)', 'Points', 'Duration (s)', 'Result'];

  const typeLabels: Record<string, Record<string, string>> = {
    '10_tirs': { fr: '10 Tirs', en: '10 Shots' },
    '10_tirs_sautee': { fr: '10 Tirs sautee', en: '10 Lob Shots' },
    'precision': { fr: 'Precision', en: 'Precision' },
  };

  const rows = challenges.map(c => [
    new Date(c.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'),
    typeLabels[c.type]?.[lang] || c.type,
    c.mode === 'solo' ? 'Solo' : '1v1',
    c.opponentName || '',
    c.successCount ?? '',
    c.totalShots ?? '',
    c.carreauCount ?? '',
    c.successRate != null ? Math.round(c.successRate) : (c.totalPoints ?? ''),
    c.totalPoints ?? '',
    c.duration ?? '',
    c.winner === 'player' ? (lang === 'fr' ? 'Victoire' : 'Win') : c.winner === 'opponent' ? (lang === 'fr' ? 'Defaite' : 'Loss') : c.winner === 'draw' ? (lang === 'fr' ? 'Egalite' : 'Draw') : '',
  ]);

  return [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
}

export function statisticsToCsv(
  matches: Match[],
  challenges: Challenge[],
  tournaments: Tournament[],
  userStats: any,
  lang: 'fr' | 'en',
): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const stats = computePeriodStats(matches, challenges, '');
  const completedTournaments = tournaments.filter(t => t.status === 'Termine' || t.status === 'Terminé').length;

  const rows = [
    [lbl('Statistique', 'Statistic'), lbl('Valeur', 'Value')],
    [lbl('Matchs joues', 'Matches played'), stats.totalMatches],
    [lbl('Victoires', 'Wins'), stats.wins],
    [lbl('Defaites', 'Losses'), stats.losses],
    [lbl('Taux de victoire (%)', 'Win rate (%)'), stats.winRate],
    [''],
    [lbl('Tirs tentes', 'Shots attempted'), stats.totalTirs],
    [lbl('Tirs reussis', 'Shots succeeded'), stats.tirsSuccess],
    [lbl('Taux de tir (%)', 'Shot rate (%)'), stats.tirRate],
    [lbl('Carreaux', 'Carreaux'), stats.carreaux],
    [lbl('Taux de carreaux (%)', 'Carreau rate (%)'), stats.carreauRate],
    [''],
    [lbl('Points tentes', 'Points attempted'), stats.totalPoints],
    [lbl('Points reussis', 'Points succeeded'), stats.pointsSuccess],
    [lbl('Taux de pointage (%)', 'Point rate (%)'), stats.pointRate],
    [''],
    [lbl('Defis completes', 'Challenges completed'), stats.totalChallenges],
    [lbl('Tournois termines', 'Tournaments completed'), completedTournaments],
    [lbl('Duree moyenne (min)', 'Avg duration (min)'), stats.avgDuration],
  ];

  return rows.map(r => r.map(escapeCsv).join(',')).join('\n');
}

function comparativeToCsv(statsA: PeriodStats, statsB: PeriodStats, lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const delta = (a: number, b: number) => {
    const d = a - b;
    return d > 0 ? `+${d}` : `${d}`;
  };
  const deltaPct = (a: number, b: number) => {
    const d = a - b;
    return d > 0 ? `+${d}%` : `${d}%`;
  };

  const headers = [lbl('Statistique', 'Statistic'), statsA.label, statsB.label, 'Delta'];
  const rows = [
    [lbl('Matchs', 'Matches'), statsA.totalMatches, statsB.totalMatches, delta(statsA.totalMatches, statsB.totalMatches)],
    [lbl('Victoires', 'Wins'), statsA.wins, statsB.wins, delta(statsA.wins, statsB.wins)],
    [lbl('Taux victoire', 'Win rate'), `${statsA.winRate}%`, `${statsB.winRate}%`, deltaPct(statsA.winRate, statsB.winRate)],
    [lbl('Taux tir', 'Shot rate'), `${statsA.tirRate}%`, `${statsB.tirRate}%`, deltaPct(statsA.tirRate, statsB.tirRate)],
    [lbl('Taux pointage', 'Point rate'), `${statsA.pointRate}%`, `${statsB.pointRate}%`, deltaPct(statsA.pointRate, statsB.pointRate)],
    [lbl('Taux carreaux', 'Carreau rate'), `${statsA.carreauRate}%`, `${statsB.carreauRate}%`, deltaPct(statsA.carreauRate, statsB.carreauRate)],
    [lbl('Defis', 'Challenges'), statsA.totalChallenges, statsB.totalChallenges, delta(statsA.totalChallenges, statsB.totalChallenges)],
    [lbl('Duree moy.', 'Avg duration'), `${statsA.avgDuration} min`, `${statsB.avgDuration} min`, `${delta(statsA.avgDuration, statsB.avgDuration)} min`],
  ];

  return [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
}

// ============================================
// PDF EXPORTS
// ============================================

function generatePdfHtml(title: string, content: string, username: string, date: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 32px; color: #1a1a2e; }
    h1 { font-size: 24px; color: #D97706; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th { background: #f3f4f6; color: #374151; text-align: left; padding: 8px 10px; border-bottom: 2px solid #D97706; font-weight: 700; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
    .stat-row td:first-child { font-weight: 600; color: #374151; }
    .stat-row td:last-child { font-weight: 700; color: #D97706; }
    .section-break { height: 8px; }
    .delta-positive { color: #059669; font-weight: 700; }
    .delta-negative { color: #dc2626; font-weight: 700; }
    .delta-neutral { color: #6b7280; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="subtitle">${username} - ${date}</div>
  ${content}
  <div class="footer">Ultimate Petanque - Export</div>
</body>
</html>`;
}

function matchesToHtml(matches: Match[], lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const headers = [lbl('Date', 'Date'), lbl('Mode', 'Mode'), lbl('Format', 'Format'), lbl('Equipe A', 'Team A'), 'Score', lbl('Equipe B', 'Team B'), lbl('Duree', 'Duration')];
  const rows = matches.map(m => {
    const winA = m.winner === 'A';
    return `<tr>
      <td>${new Date(m.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</td>
      <td>${m.mode}</td>
      <td>${m.format}</td>
      <td style="${winA ? 'font-weight:700;color:#059669' : ''}">${m.teamA.playerNames.join(', ')}</td>
      <td style="text-align:center;font-weight:700">${m.teamA.score} - ${m.teamB.score}</td>
      <td style="${!winA ? 'font-weight:700;color:#059669' : ''}">${m.teamB.playerNames.join(', ')}</td>
      <td>${m.duration ? `${m.duration} min` : '-'}</td>
    </tr>`;
  }).join('');
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

function singleMatchToHtml(m: Match, lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const winA = m.winner === 'A';
  let html = `<table><thead><tr><th>${lbl('Info', 'Info')}</th><th>${lbl('Valeur', 'Value')}</th></tr></thead><tbody>`;
  html += `<tr class="stat-row"><td>${lbl('Date', 'Date')}</td><td>${new Date(m.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</td></tr>`;
  html += `<tr class="stat-row"><td>Format</td><td>${m.format}</td></tr>`;
  html += `<tr class="stat-row"><td>Mode</td><td>${m.mode}</td></tr>`;
  html += `<tr class="stat-row"><td>${lbl('Equipe A', 'Team A')}</td><td style="${winA ? 'color:#059669' : ''}">${m.teamA.playerNames.join(', ')}</td></tr>`;
  html += `<tr class="stat-row"><td>${lbl('Equipe B', 'Team B')}</td><td style="${!winA ? 'color:#059669' : ''}">${m.teamB.playerNames.join(', ')}</td></tr>`;
  html += `<tr class="stat-row"><td>Score</td><td style="font-weight:700">${m.teamA.score} - ${m.teamB.score}</td></tr>`;
  html += `<tr class="stat-row"><td>${lbl('Duree', 'Duration')}</td><td>${m.duration ? `${m.duration} min` : '-'}</td></tr>`;
  html += `</tbody></table>`;
  if (m.playerActions && m.playerActions.length > 0) {
    html += `<h2 style="font-size:16px;margin-top:20px;color:#374151">${lbl('Actions des joueurs', 'Player actions')}</h2>`;
    html += `<table><thead><tr><th>${lbl('Joueur', 'Player')}</th><th>${lbl('Tirs', 'Shots')}</th><th>${lbl('Reussis', 'Hit')}</th><th>Points</th><th>${lbl('Reussis', 'Hit')}</th><th>Carreaux</th></tr></thead><tbody>`;
    m.playerActions.forEach(pa => {
      html += `<tr><td>${pa.playerName} (${pa.team})</td><td>${pa.actions.tirs}</td><td style="color:#059669;font-weight:700">${pa.actions.tirsSuccess}</td><td>${pa.actions.points}</td><td style="color:#059669;font-weight:700">${pa.actions.pointsSuccess}</td><td style="color:#D97706;font-weight:700">${pa.actions.carreaux}</td></tr>`;
    });
    html += `</tbody></table>`;
  }
  return html;
}

function singleChallengeToHtml(c: Challenge, lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const typeLabels: Record<string, Record<string, string>> = {
    '10_tirs': { fr: '10 Tirs', en: '10 Shots' },
    '10_tirs_sautee': { fr: '10 Tirs sautee', en: '10 Lob Shots' },
    'precision': { fr: 'Precision', en: 'Precision' },
  };
  let html = `<table><thead><tr><th>${lbl('Info', 'Info')}</th><th>${lbl('Valeur', 'Value')}</th></tr></thead><tbody>`;
  html += `<tr class="stat-row"><td>${lbl('Date', 'Date')}</td><td>${new Date(c.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</td></tr>`;
  html += `<tr class="stat-row"><td>Type</td><td>${typeLabels[c.type]?.[lang] || c.type}</td></tr>`;
  html += `<tr class="stat-row"><td>Mode</td><td>${c.mode === 'solo' ? 'Solo' : `1v1 vs ${c.opponentName || '?'}`}</td></tr>`;
  html += `<tr class="stat-row"><td>${lbl('Reussite', 'Success')}</td><td>${c.successCount ?? '-'} / ${c.totalShots ?? '-'}</td></tr>`;
  html += `<tr class="stat-row"><td>Carreaux</td><td>${c.carreauCount ?? 0}</td></tr>`;
  html += `<tr class="stat-row"><td>${lbl('Taux', 'Rate')}</td><td>${c.successRate != null ? `${Math.round(c.successRate)}%` : (c.totalPoints != null ? `${c.totalPoints} pts` : '-')}</td></tr>`;
  html += `</tbody></table>`;
  if (c.shots && c.shots.length > 0) {
    html += `<h2 style="font-size:16px;margin-top:20px;color:#374151">${lbl('Detail des tirs', 'Shot detail')}</h2>`;
    html += `<table><thead><tr><th>#</th><th>${lbl('Resultat', 'Result')}</th><th>Carreau</th></tr></thead><tbody>`;
    c.shots.forEach(s => {
      html += `<tr><td>${s.number}</td><td style="${s.success ? 'color:#059669;font-weight:700' : 'color:#dc2626'}">${s.success ? lbl('Reussi', 'Hit') : lbl('Rate', 'Miss')}</td><td>${s.carreau ? '\u2022' : ''}</td></tr>`;
    });
    html += `</tbody></table>`;
  }
  return html;
}

function challengesToHtml(challenges: Challenge[], lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const typeLabels: Record<string, Record<string, string>> = {
    '10_tirs': { fr: '10 Tirs', en: '10 Shots' },
    '10_tirs_sautee': { fr: '10 Tirs sautee', en: '10 Lob Shots' },
    'precision': { fr: 'Precision', en: 'Precision' },
  };
  const headers = [lbl('Date', 'Date'), 'Type', 'Mode', lbl('Reussite', 'Success'), lbl('Carreaux', 'Carreaux'), lbl('Taux', 'Rate'), lbl('Resultat', 'Result')];
  const rows = challenges.map(c => {
    const rate = c.successRate != null ? `${Math.round(c.successRate)}%` : (c.totalPoints != null ? `${c.totalPoints} pts` : '-');
    const result = c.winner === 'player' ? `<span style="color:#059669;font-weight:700">${lbl('Victoire', 'Win')}</span>` : c.winner === 'opponent' ? `<span style="color:#dc2626">${lbl('Defaite', 'Loss')}</span>` : c.winner === 'draw' ? lbl('Egalite', 'Draw') : '-';
    return `<tr>
      <td>${new Date(c.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US')}</td>
      <td>${typeLabels[c.type]?.[lang] || c.type}</td>
      <td>${c.mode === 'solo' ? 'Solo' : `1v1 vs ${c.opponentName || '?'}`}</td>
      <td>${c.successCount ?? '-'} / ${c.totalShots ?? '-'}</td>
      <td>${c.carreauCount ?? '-'}</td>
      <td style="font-weight:700;color:#D97706">${rate}</td>
      <td>${result}</td>
    </tr>`;
  }).join('');
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

function statisticsToHtml(matches: Match[], challenges: Challenge[], tournaments: Tournament[], lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;
  const stats = computePeriodStats(matches, challenges, '');
  const completedTournaments = tournaments.filter(t => t.status === 'Termine' || t.status === 'Terminé').length;

  const rows = [
    [lbl('Matchs joues', 'Matches played'), stats.totalMatches],
    [lbl('Victoires', 'Wins'), `${stats.wins} (${stats.winRate}%)`],
    [lbl('Defaites', 'Losses'), stats.losses],
    ['', ''],
    [lbl('Taux de tir', 'Shot rate'), `${stats.tirRate}% (${stats.tirsSuccess}/${stats.totalTirs})`],
    [lbl('Taux de pointage', 'Point rate'), `${stats.pointRate}% (${stats.pointsSuccess}/${stats.totalPoints})`],
    [lbl('Taux de carreaux', 'Carreau rate'), `${stats.carreauRate}% (${stats.carreaux})`],
    ['', ''],
    [lbl('Defis completes', 'Challenges completed'), challenges.length],
    [lbl('Tournois termines', 'Tournaments completed'), completedTournaments],
    [lbl('Duree moyenne', 'Avg duration'), `${stats.avgDuration} min`],
  ];

  const tableRows = rows.map(([label, value]) => {
    if (!label) return '<tr class="section-break"><td colspan="2"></td></tr>';
    return `<tr class="stat-row"><td>${label}</td><td>${value}</td></tr>`;
  }).join('');

  return `<table><thead><tr><th>${lbl('Statistique', 'Statistic')}</th><th>${lbl('Valeur', 'Value')}</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}

function comparativeToHtml(statsA: PeriodStats, statsB: PeriodStats, lang: 'fr' | 'en'): string {
  const lbl = (fr: string, en: string) => lang === 'fr' ? fr : en;

  const deltaClass = (a: number, b: number) => a > b ? 'delta-positive' : a < b ? 'delta-negative' : 'delta-neutral';
  const deltaStr = (a: number, b: number, suffix = '') => {
    const d = a - b;
    const sign = d > 0 ? '+' : '';
    return `<span class="${deltaClass(a, b)}">${sign}${d}${suffix}</span>`;
  };

  const metrics = [
    { label: lbl('Matchs joues', 'Matches played'), a: statsA.totalMatches, b: statsB.totalMatches },
    { label: lbl('Victoires', 'Wins'), a: statsA.wins, b: statsB.wins },
    { label: lbl('Taux victoire', 'Win rate'), a: statsA.winRate, b: statsB.winRate, pct: true },
    { label: lbl('Taux tir', 'Shot rate'), a: statsA.tirRate, b: statsB.tirRate, pct: true },
    { label: lbl('Taux pointage', 'Point rate'), a: statsA.pointRate, b: statsB.pointRate, pct: true },
    { label: lbl('Taux carreaux', 'Carreau rate'), a: statsA.carreauRate, b: statsB.carreauRate, pct: true },
    { label: lbl('Defis', 'Challenges'), a: statsA.totalChallenges, b: statsB.totalChallenges },
    { label: lbl('Duree moy. (min)', 'Avg duration (min)'), a: statsA.avgDuration, b: statsB.avgDuration },
  ];

  const headers = `<tr><th>${lbl('Statistique', 'Statistic')}</th><th>${statsA.label}</th><th>${statsB.label}</th><th>Delta</th></tr>`;
  const rows = metrics.map(m => {
    const suffix = m.pct ? '%' : '';
    return `<tr class="stat-row">
      <td>${m.label}</td>
      <td>${m.a}${suffix}</td>
      <td>${m.b}${suffix}</td>
      <td>${deltaStr(m.a, m.b, suffix)}</td>
    </tr>`;
  }).join('');

  return `<table><thead>${headers}</thead><tbody>${rows}</tbody></table>`;
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

export async function exportData(
  options: ExportOptions,
  matches: Match[],
  challenges: Challenge[],
  tournaments: Tournament[],
  userStats: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { format, dataType, period, language, username, preset, tournamentId, tournamentName, seasonYear, comparePeriod, compareSeasonYear, matchId, playerId, playerName, challengeId } = options;
    const dateStr = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US');

    // ---- SINGLE MATCH ----
    if (preset === 'match' && matchId) {
      const m = matches.find(mt => mt.id === matchId);
      if (!m) return { success: false, error: language === 'fr' ? 'Match introuvable' : 'Match not found' };
      const title = language === 'fr' ? `Match du ${new Date(m.date).toLocaleDateString('fr-FR')}` : `Match ${new Date(m.date).toLocaleDateString('en-US')}`;
      if (format === 'csv') {
        const csvContent = singleMatchToCsv(m, language);
        const fileName = `match_${new Date(m.date).toISOString().slice(0, 10)}.csv`;
        return await shareFile(csvContent, fileName, 'text/csv', language);
      } else {
        const htmlContent = singleMatchToHtml(m, language);
        const fullHtml = generatePdfHtml(title, htmlContent, username, dateStr);
        const fileName = `match_${new Date(m.date).toISOString().slice(0, 10)}.pdf`;
        return await sharePdf(fullHtml, fileName, language);
      }
    }

    // ---- SINGLE CHALLENGE ----
    if (preset === 'challenge' && challengeId) {
      const c = challenges.find(ch => ch.id === challengeId);
      if (!c) return { success: false, error: language === 'fr' ? 'Defi introuvable' : 'Challenge not found' };
      const typeLabels: Record<string, Record<string, string>> = {
        '10_tirs': { fr: '10 Tirs', en: '10 Shots' },
        '10_tirs_sautee': { fr: '10 Tirs sautee', en: '10 Lob Shots' },
        'precision': { fr: 'Precision', en: 'Precision' },
      };
      const title = `${typeLabels[c.type]?.[language] || c.type} - ${new Date(c.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}`;
      if (format === 'csv') {
        const csvContent = singleChallengeToCsv(c, language);
        const fileName = `defi_${new Date(c.date).toISOString().slice(0, 10)}.csv`;
        return await shareFile(csvContent, fileName, 'text/csv', language);
      } else {
        const htmlContent = singleChallengeToHtml(c, language);
        const fullHtml = generatePdfHtml(title, htmlContent, username, dateStr);
        const fileName = `defi_${new Date(c.date).toISOString().slice(0, 10)}.pdf`;
        return await sharePdf(fullHtml, fileName, language);
      }
    }

    // ---- BY PLAYER ----
    if (preset === 'player' && playerId) {
      const playerMatches = filterMatchesByPlayer(matches, playerId);
      const playerChallenges = challenges.filter(c => c.playerId === playerId);
      const name = playerName || 'Joueur';
      if (dataType === 'matches') {
        const title = language === 'fr' ? `Matchs de ${name}` : `Matches of ${name}`;
        if (format === 'csv') {
          const csvContent = matchesToCsv(playerMatches, language);
          const fileName = `matchs_${name.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.csv`;
          return await shareFile(csvContent, fileName, 'text/csv', language);
        } else {
          const htmlContent = matchesToHtml(playerMatches, language);
          const fullHtml = generatePdfHtml(title, htmlContent, username, dateStr);
          const fileName = `matchs_${name.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.pdf`;
          return await sharePdf(fullHtml, fileName, language);
        }
      } else {
        const title = language === 'fr' ? `Stats de ${name}` : `Stats of ${name}`;
        if (format === 'csv') {
          const csvContent = statisticsToCsv(playerMatches, playerChallenges, tournaments, userStats, language);
          const fileName = `stats_${name.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.csv`;
          return await shareFile(csvContent, fileName, 'text/csv', language);
        } else {
          const htmlContent = statisticsToHtml(playerMatches, playerChallenges, tournaments, language);
          const fullHtml = generatePdfHtml(title, htmlContent, username, dateStr);
          const fileName = `stats_${name.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.pdf`;
          return await sharePdf(fullHtml, fileName, language);
        }
      }
    }

    // ---- COMPARATIVE MODE ----
    if (preset === 'comparative' && comparePeriod) {
      let matchesA: Match[], matchesB: Match[], challengesA: Challenge[], challengesB: Challenge[];
      let labelA: string, labelB: string;

      if (seasonYear && compareSeasonYear) {
        matchesA = filterBySeason(matches, seasonYear);
        matchesB = filterBySeason(matches, compareSeasonYear);
        challengesA = filterBySeason(challenges, seasonYear);
        challengesB = filterBySeason(challenges, compareSeasonYear);
        labelA = `${seasonYear}-${seasonYear + 1}`;
        labelB = `${compareSeasonYear}-${compareSeasonYear + 1}`;
      } else {
        matchesA = filterByPeriod(matches, period);
        matchesB = filterByPeriod(matches, comparePeriod);
        challengesA = filterByPeriod(challenges, period);
        challengesB = filterByPeriod(challenges, comparePeriod);
        const periodLabels: Record<string, Record<string, string>> = {
          'all': { fr: 'Tout', en: 'All' },
          '7d': { fr: '7 jours', en: '7 days' },
          '30d': { fr: '30 jours', en: '30 days' },
          '3m': { fr: '3 mois', en: '3 months' },
          '6m': { fr: '6 mois', en: '6 months' },
          '1y': { fr: '1 an', en: '1 year' },
        };
        labelA = periodLabels[period]?.[language] || period;
        labelB = periodLabels[comparePeriod]?.[language] || comparePeriod;
      }

      const statsA = computePeriodStats(matchesA, challengesA, labelA);
      const statsB = computePeriodStats(matchesB, challengesB, labelB);

      if (format === 'csv') {
        const csvContent = comparativeToCsv(statsA, statsB, language);
        const fileName = `comparatif_${new Date().toISOString().slice(0, 10)}.csv`;
        return await shareFile(csvContent, fileName, 'text/csv', language);
      } else {
        const title = language === 'fr' ? `Comparatif : ${statsA.label} vs ${statsB.label}` : `Comparative: ${statsA.label} vs ${statsB.label}`;
        const htmlContent = comparativeToHtml(statsA, statsB, language);
        const fullHtml = generatePdfHtml(title, htmlContent, username, dateStr);
        const fileName = `comparatif_${new Date().toISOString().slice(0, 10)}.pdf`;
        return await sharePdf(fullHtml, fileName, language);
      }
    }

    // ---- STANDARD / TOURNAMENT / SEASON MODE ----
    let filteredMatches: Match[];
    let filteredChallenges: Challenge[];

    if (preset === 'tournament' && tournamentId) {
      filteredMatches = filterByTournament(matches, tournamentId);
      filteredChallenges = [];
    } else if (preset === 'season' && seasonYear) {
      filteredMatches = filterBySeason(matches, seasonYear);
      filteredChallenges = filterBySeason(challenges, seasonYear);
    } else {
      filteredMatches = filterByPeriod(matches, period);
      filteredChallenges = filterByPeriod(challenges, period);
    }

    if (format === 'csv') {
      let csvContent = '';
      let fileName = '';

      switch (dataType) {
        case 'matches':
          csvContent = matchesToCsv(filteredMatches, language);
          fileName = `matchs_${new Date().toISOString().slice(0, 10)}.csv`;
          break;
        case 'challenges':
          csvContent = challengesToCsv(filteredChallenges, language);
          fileName = `defis_${new Date().toISOString().slice(0, 10)}.csv`;
          break;
        case 'statistics':
          csvContent = statisticsToCsv(filteredMatches, filteredChallenges, tournaments, userStats, language);
          fileName = `statistiques_${new Date().toISOString().slice(0, 10)}.csv`;
          break;
      }

      if (preset === 'tournament' && tournamentName) {
        fileName = `tournoi_${tournamentName.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (preset === 'season' && seasonYear) {
        fileName = `saison_${seasonYear}-${seasonYear + 1}_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      return await shareFile(csvContent, fileName, 'text/csv', language);

    } else {
      let htmlContent = '';
      let title = '';

      switch (dataType) {
        case 'matches':
          title = language === 'fr' ? 'Mes Matchs' : 'My Matches';
          if (preset === 'tournament' && tournamentName) title = `${language === 'fr' ? 'Matchs -' : 'Matches -'} ${tournamentName}`;
          else if (preset === 'season' && seasonYear) title = `${language === 'fr' ? 'Matchs - Saison' : 'Matches - Season'} ${seasonYear}-${seasonYear + 1}`;
          htmlContent = matchesToHtml(filteredMatches, language);
          break;
        case 'challenges':
          title = language === 'fr' ? 'Mes Defis' : 'My Challenges';
          if (preset === 'season' && seasonYear) title = `${language === 'fr' ? 'Defis - Saison' : 'Challenges - Season'} ${seasonYear}-${seasonYear + 1}`;
          htmlContent = challengesToHtml(filteredChallenges, language);
          break;
        case 'statistics':
          title = language === 'fr' ? 'Mes Statistiques' : 'My Statistics';
          if (preset === 'tournament' && tournamentName) title = `${language === 'fr' ? 'Stats -' : 'Stats -'} ${tournamentName}`;
          else if (preset === 'season' && seasonYear) title = `${language === 'fr' ? 'Stats - Saison' : 'Stats - Season'} ${seasonYear}-${seasonYear + 1}`;
          htmlContent = statisticsToHtml(filteredMatches, filteredChallenges, tournaments, language);
          break;
      }

      const fullHtml = generatePdfHtml(title, htmlContent, username, dateStr);
      let fileName = `${dataType}_${new Date().toISOString().slice(0, 10)}.pdf`;
      if (preset === 'tournament' && tournamentName) {
        fileName = `tournoi_${tournamentName.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.pdf`;
      } else if (preset === 'season' && seasonYear) {
        fileName = `saison_${seasonYear}-${seasonYear + 1}_${new Date().toISOString().slice(0, 10)}.pdf`;
      }

      return await sharePdf(fullHtml, fileName, language);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    return { success: false, error: error.message || 'Export failed' };
  }
}

// ============================================
// FILE SHARING HELPERS
// ============================================

async function shareFile(content: string, fileName: string, mimeType: string, language: string): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    const blob = new Blob(['\ufeff' + content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName; link.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, '\ufeff' + content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: fileName });
  return { success: true };
}

async function sharePdf(fullHtml: string, fileName: string, language: string): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS === 'web') {
    const pw = window.open('', '_blank');
    if (pw) { pw.document.write(fullHtml); pw.document.close(); pw.print(); }
    return { success: true };
  }
  const { uri } = await Print.printToFileAsync({ html: fullHtml });
  const newUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: newUri });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: fileName });
  return { success: true };
}
