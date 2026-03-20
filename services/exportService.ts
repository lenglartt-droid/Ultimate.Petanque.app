import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { Match, Challenge, Tournament } from '@/services/mockData';

export type ExportFormat = 'csv' | 'pdf';
export type ExportDataType = 'matches' | 'challenges' | 'statistics';
export type ExportPeriod = 'all' | '7d' | '30d' | '3m' | '6m' | '1y';
export type ExportPreset = 'none' | 'tournament' | 'season' | 'comparative';

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
  const seasonStart = new Date(startYear, 8, 1); // Sept 1
  const seasonEnd = new Date(startYear + 1, 5, 30, 23, 59, 59); // June 30
  return items.filter(item => {
    const d = new Date(item.date);
    return d >= seasonStart && d <= seasonEnd;
  });
}

function filterByTournament(matches: Match[], tournamentId: string): Match[] {
  return matches.filter(m => m.tournamentId === tournamentId);
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
    const { format, dataType, period, language, username, preset, tournamentId, tournamentName, seasonYear, comparePeriod, compareSeasonYear } = options;
    const dateStr = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US');

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
        if (Platform.OS === 'web') {
          const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url; link.download = fileName; link.click();
          URL.revokeObjectURL(url);
          return { success: true };
        }
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, '\ufeff' + csvContent, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: fileName });
        return { success: true };
      } else {
        const title = language === 'fr' ? `Comparatif : ${statsA.label} vs ${statsB.label}` : `Comparative: ${statsA.label} vs ${statsB.label}`;
        const htmlContent = comparativeToHtml(statsA, statsB, language);
        const fullHtml = generatePdfHtml(title, htmlContent, username, dateStr);
        if (Platform.OS === 'web') {
          const pw = window.open('', '_blank');
          if (pw) { pw.document.write(fullHtml); pw.document.close(); pw.print(); }
          return { success: true };
        }
        const { uri } = await Print.printToFileAsync({ html: fullHtml });
        const fileName = `comparatif_${new Date().toISOString().slice(0, 10)}.pdf`;
        const newUri = `${FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.moveAsync({ from: uri, to: newUri });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: fileName });
        return { success: true };
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

      if (Platform.OS === 'web') {
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = fileName; link.click();
        URL.revokeObjectURL(url);
        return { success: true };
      }

      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, '\ufeff' + csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: fileName, UTI: 'public.comma-separated-values-text' });
      return { success: true };

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

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) { printWindow.document.write(fullHtml); printWindow.document.close(); printWindow.print(); }
        return { success: true };
      }

      const { uri } = await Print.printToFileAsync({ html: fullHtml });
      let fileName = `${dataType}_${new Date().toISOString().slice(0, 10)}.pdf`;
      if (preset === 'tournament' && tournamentName) {
        fileName = `tournoi_${tournamentName.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.pdf`;
      } else if (preset === 'season' && seasonYear) {
        fileName = `saison_${seasonYear}-${seasonYear + 1}_${new Date().toISOString().slice(0, 10)}.pdf`;
      }
      const newUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newUri });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' });
      return { success: true };
    }
  } catch (error: any) {
    console.error('Export error:', error);
    return { success: false, error: error.message || 'Export failed' };
  }
}
