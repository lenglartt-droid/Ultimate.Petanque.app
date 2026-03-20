import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { Match, Challenge, Tournament } from '@/services/mockData';

export type ExportFormat = 'csv' | 'pdf';
export type ExportDataType = 'matches' | 'challenges' | 'statistics';
export type ExportPeriod = 'all' | '7d' | '30d' | '3m' | '6m' | '1y';

interface ExportOptions {
  format: ExportFormat;
  dataType: ExportDataType;
  period: ExportPeriod;
  language: 'fr' | 'en';
  username: string;
}

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

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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

  const totalMatches = matches.length;
  const wins = matches.filter(m => m.winner === 'A').length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  let totalTirs = 0, tirsSuccess = 0, totalPoints = 0, pointsSuccess = 0, carreaux = 0;
  matches.forEach(m => {
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

  const tirRate = totalTirs > 0 ? Math.round((tirsSuccess / totalTirs) * 100) : 0;
  const pointRate = totalPoints > 0 ? Math.round((pointsSuccess / totalPoints) * 100) : 0;
  const carreauRate = tirsSuccess > 0 ? Math.round((carreaux / tirsSuccess) * 100) : 0;

  const totalChallenges = challenges.length;
  const completedTournaments = tournaments.filter(t => t.status === 'Termine' || t.status === 'Terminé').length;

  const rows = [
    [lbl('Statistique', 'Statistic'), lbl('Valeur', 'Value')],
    [lbl('Matchs joues', 'Matches played'), totalMatches],
    [lbl('Victoires', 'Wins'), wins],
    [lbl('Defaites', 'Losses'), totalMatches - wins],
    [lbl('Taux de victoire (%)', 'Win rate (%)'), winRate],
    [''],
    [lbl('Tirs tentes', 'Shots attempted'), totalTirs],
    [lbl('Tirs reussis', 'Shots succeeded'), tirsSuccess],
    [lbl('Taux de tir (%)', 'Shot rate (%)'), tirRate],
    [lbl('Carreaux', 'Carreaux'), carreaux],
    [lbl('Taux de carreaux (%)', 'Carreau rate (%)'), carreauRate],
    [''],
    [lbl('Points tentes', 'Points attempted'), totalPoints],
    [lbl('Points reussis', 'Points succeeded'), pointsSuccess],
    [lbl('Taux de pointage (%)', 'Point rate (%)'), pointRate],
    [''],
    [lbl('Defis completes', 'Challenges completed'), totalChallenges],
    [lbl('Tournois termines', 'Tournaments completed'), completedTournaments],
  ];

  return rows.map(r => r.map(escapeCsv).join(',')).join('\n');
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
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.winner === 'A').length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  let totalTirs = 0, tirsSuccess = 0, totalPoints = 0, pointsSuccess = 0, carreaux = 0;
  matches.forEach(m => {
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

  const tirRate = totalTirs > 0 ? Math.round((tirsSuccess / totalTirs) * 100) : 0;
  const pointRate = totalPoints > 0 ? Math.round((pointsSuccess / totalPoints) * 100) : 0;
  const carreauRate = tirsSuccess > 0 ? Math.round((carreaux / tirsSuccess) * 100) : 0;

  const rows = [
    [lbl('Matchs joues', 'Matches played'), totalMatches],
    [lbl('Victoires', 'Wins'), `${wins} (${winRate}%)`],
    [lbl('Defaites', 'Losses'), totalMatches - wins],
    ['', ''],
    [lbl('Taux de tir', 'Shot rate'), `${tirRate}% (${tirsSuccess}/${totalTirs})`],
    [lbl('Taux de pointage', 'Point rate'), `${pointRate}% (${pointsSuccess}/${totalPoints})`],
    [lbl('Taux de carreaux', 'Carreau rate'), `${carreauRate}% (${carreaux})`],
    ['', ''],
    [lbl('Defis completes', 'Challenges completed'), challenges.length],
    [lbl('Tournois termines', 'Tournaments completed'), tournaments.filter(t => t.status === 'Termine' || t.status === 'Terminé').length],
  ];

  const tableRows = rows.map(([label, value]) => {
    if (!label) return '<tr class="section-break"><td colspan="2"></td></tr>';
    return `<tr class="stat-row"><td>${label}</td><td>${value}</td></tr>`;
  }).join('');

  return `<table><thead><tr><th>${lbl('Statistique', 'Statistic')}</th><th>${lbl('Valeur', 'Value')}</th></tr></thead><tbody>${tableRows}</tbody></table>`;
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
    const { format, dataType, period, language, username } = options;
    const dateStr = new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US');

    const filteredMatches = filterByPeriod(matches, period);
    const filteredChallenges = filterByPeriod(challenges, period);

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

      if (Platform.OS === 'web') {
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        return { success: true };
      }

      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, '\ufeff' + csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: fileName, UTI: 'public.comma-separated-values-text' });
      }
      return { success: true };

    } else {
      // PDF
      let htmlContent = '';
      let title = '';

      switch (dataType) {
        case 'matches':
          title = language === 'fr' ? 'Mes Matchs' : 'My Matches';
          htmlContent = matchesToHtml(filteredMatches, language);
          break;
        case 'challenges':
          title = language === 'fr' ? 'Mes Defis' : 'My Challenges';
          htmlContent = challengesToHtml(filteredChallenges, language);
          break;
        case 'statistics':
          title = language === 'fr' ? 'Mes Statistiques' : 'My Statistics';
          htmlContent = statisticsToHtml(filteredMatches, filteredChallenges, tournaments, language);
          break;
      }

      const fullHtml = generatePdfHtml(title, htmlContent, username, dateStr);

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(fullHtml);
          printWindow.document.close();
          printWindow.print();
        }
        return { success: true };
      }

      const { uri } = await Print.printToFileAsync({ html: fullHtml });
      const fileName = `${dataType}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const newUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.moveAsync({ from: uri, to: newUri });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' });
      }
      return { success: true };
    }
  } catch (error: any) {
    console.error('Export error:', error);
    return { success: false, error: error.message || 'Export failed' };
  }
}
