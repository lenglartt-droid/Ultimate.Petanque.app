import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, G, Text as SvgText, Rect } from 'react-native-svg';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { Tournament, Match } from '@/services/mockData';

const { width: screenWidth } = Dimensions.get('window');

interface TournamentPalmaresItem {
  tournament: Tournament;
  matches: Match[];
  stats: {
    played: number;
    wins: number;
    losses: number;
    winRate: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDiff: number;
    tirRate: number | null;
    carreaux: number;
  };
}

const RESULT_CONFIG: Record<string, { icon: string; color: string; rank: number }> = {
  '1er': { icon: 'emoji-events', color: '#FFD700', rank: 1 },
  '2ème': { icon: 'workspace-premium', color: '#C0C0C0', rank: 2 },
  '3ème': { icon: 'military-tech', color: '#CD7F32', rank: 3 },
  'Demi-finale': { icon: 'trending-up', color: '#4A90D9', rank: 4 },
  'Quart de finale': { icon: 'trending-flat', color: '#F5A623', rank: 5 },
  '1/8 finale': { icon: 'sports', color: '#7B8794', rank: 6 },
  'Poules': { icon: 'group', color: '#7B8794', rank: 7 },
  'Autre': { icon: 'more-horiz', color: '#7B8794', rank: 8 },
};

// --- Performance Badge definitions ---
interface PerformanceBadge {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  earned: boolean;
  value?: string;
}

function BadgeCard({ badge, index }: { badge: PerformanceBadge; index: number }) {
  return (
    <Animated.View entering={FadeInDown.duration(250).delay(index * 40)}>
      <View style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}>
        <View style={[styles.badgeIconCircle, { backgroundColor: badge.earned ? badge.bgColor : theme.backgroundSecondary }]}>
          <MaterialIcons
            name={badge.icon as any}
            size={22}
            color={badge.earned ? badge.color : theme.textMuted}
          />
        </View>
        <Text style={[styles.badgeLabel, !badge.earned && { color: theme.textMuted }]} numberOfLines={1}>
          {badge.label}
        </Text>
        {badge.earned && badge.value ? (
          <Text style={[styles.badgeValue, { color: badge.color }]}>{badge.value}</Text>
        ) : null}
        <Text style={styles.badgeDesc} numberOfLines={2}>{badge.description}</Text>
        {!badge.earned ? (
          <View style={styles.badgeLockOverlay}>
            <MaterialIcons name="lock-outline" size={12} color={theme.textMuted} />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function TournamentCard({ item, index, t, language }: { item: TournamentPalmaresItem; index: number; t: (s: string, k: string) => string; language: string }) {
  const { tournament, stats } = item;
  const resultCfg = RESULT_CONFIG[tournament.finalResult || ''] || { icon: 'sports', color: theme.textMuted, rank: 99 };
  const hasFinancials = (tournament.registrationCost && tournament.registrationCost > 0) || (tournament.prizeWon && tournament.prizeWon > 0);
  const netGain = (tournament.prizeWon || 0) - (tournament.registrationCost || 0);
  const locale = language === 'en' ? 'en-US' : 'fr-FR';

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
      <Pressable
        style={styles.card}
        onPress={() => {
          Haptics.selectionAsync();
          router.push(`/tournament/${tournament.id}`);
        }}
      >
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={[styles.resultBadge, { backgroundColor: resultCfg.color + '20' }]}>
            <MaterialIcons name={resultCfg.icon as any} size={24} color={resultCfg.color} />
          </View>
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardName} numberOfLines={2}>{tournament.name}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.cardDate}>
                {new Date(tournament.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <View style={styles.dot} />
              <Text style={styles.cardFormat}>{t('formats', tournament.format)}</Text>
              {tournament.location?.city ? (
                <>
                  <View style={styles.dot} />
                  <Text style={styles.cardCity}>{tournament.location.city}</Text>
                </>
              ) : null}
            </View>
          </View>
          {tournament.finalResult ? (
            <View style={[styles.resultTag, { backgroundColor: resultCfg.color + '15', borderColor: resultCfg.color + '40' }]}>
              <Text style={[styles.resultTagText, { color: resultCfg.color }]}>{tournament.finalResult}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.played}</Text>
            <Text style={styles.statLabel}>{t('palmares', 'matchs')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.success }]}>{stats.wins}</Text>
            <Text style={styles.statLabel}>V</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.error }]}>{stats.losses}</Text>
            <Text style={styles.statLabel}>{language === 'en' ? 'L' : 'D'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{stats.winRate}%</Text>
            <Text style={styles.statLabel}>{language === 'en' ? 'Win' : 'Vict.'}</Text>
          </View>
          {stats.tirRate !== null ? (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.tirColor }]}>{stats.tirRate}%</Text>
                <Text style={styles.statLabel}>{t('stats', 'tir')}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: stats.pointDiff >= 0 ? theme.success : theme.error }]}>
              {stats.pointDiff > 0 ? '+' : ''}{stats.pointDiff}
            </Text>
            <Text style={styles.statLabel}>Diff.</Text>
          </View>
        </View>

        {/* Financials Row */}
        {hasFinancials ? (
          <View style={styles.financialRow}>
            {tournament.registrationCost ? (
              <View style={styles.financialItem}>
                <MaterialIcons name="payments" size={14} color={theme.error} />
                <Text style={[styles.financialText, { color: theme.error }]}>-{tournament.registrationCost}€</Text>
              </View>
            ) : null}
            {tournament.prizeWon ? (
              <View style={styles.financialItem}>
                <MaterialIcons name="emoji-events" size={14} color={theme.success} />
                <Text style={[styles.financialText, { color: theme.success }]}>+{tournament.prizeWon}€</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }} />
            <View style={[styles.netBadge, { backgroundColor: netGain >= 0 ? theme.success + '15' : theme.error + '15' }]}>
              <Text style={[styles.netText, { color: netGain >= 0 ? theme.success : theme.error }]}>
                Net: {netGain >= 0 ? '+' : ''}{netGain}€
              </Text>
            </View>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.cardType}>
            <MaterialIcons name="category" size={12} color={theme.textMuted} />
            <Text style={styles.cardTypeText}>{tournament.type}</Text>
          </View>
          {stats.carreaux > 0 ? (
            <View style={styles.carreauBadge}>
              <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
              <Text style={styles.carreauText}>{stats.carreaux} {t('palmares', 'carreaux').toLowerCase()}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

type YearFilter = 'all' | string;
type FormatFilter = 'all' | 'Tête-à-tête' | 'Doublette' | 'Triplette';
type ResultFilter = 'all' | 'podium';
type GroupMode = 'rank' | 'season';

export default function PalmaresScreen() {
  const insets = useSafeAreaInsets();
  const { tournaments, matches } = useApp();
  const { t, language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : 'fr-FR';

  const FORMAT_FILTERS: { id: FormatFilter; label: string }[] = [
    { id: 'all', label: t('palmares', 'allFormats') },
    { id: 'Tête-à-tête', label: t('formats', 'TàT') },
    { id: 'Doublette', label: t('formats', 'Doublette') },
    { id: 'Triplette', label: t('formats', 'Triplette') },
  ];

  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [showChart, setShowChart] = useState(false);
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>('rank');
  const [showBadges, setShowBadges] = useState(true);

  React.useEffect(() => {
    setSelectedChartIndex(null);
  }, [yearFilter, formatFilter, resultFilter]);

  // Build palmares data
  const allPalmaresData = useMemo(() => {
    const finishedTournaments = tournaments.filter(t => t.status === 'Terminé');

    const items: TournamentPalmaresItem[] = finishedTournaments.map(tournament => {
      const tournamentMatches = matches.filter(m => m.tournamentId === tournament.id);
      const wins = tournamentMatches.filter(m => m.winner === 'A').length;
      const losses = tournamentMatches.length - wins;
      const pointsFor = tournamentMatches.reduce((sum, m) => sum + (m.teamA?.score || 0), 0);
      const pointsAgainst = tournamentMatches.reduce((sum, m) => sum + (m.teamB?.score || 0), 0);

      let totalTirs = 0, totalTirsSuccess = 0, totalCarreaux = 0;
      tournamentMatches.forEach(m => {
        if (m.playerActions) {
          m.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
            totalTirs += pa.actions.tirs;
            totalTirsSuccess += pa.actions.tirsSuccess;
            totalCarreaux += pa.actions.carreaux;
          });
        }
      });

      return {
        tournament,
        matches: tournamentMatches,
        stats: {
          played: tournamentMatches.length,
          wins,
          losses,
          winRate: tournamentMatches.length > 0 ? Math.round((wins / tournamentMatches.length) * 100) : 0,
          pointsFor,
          pointsAgainst,
          pointDiff: pointsFor - pointsAgainst,
          tirRate: totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : null,
          carreaux: totalCarreaux,
        },
      };
    });

    return items;
  }, [tournaments, matches]);

  // Available years (seasons)
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allPalmaresData.forEach(item => {
      years.add(new Date(item.tournament.date).getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [allPalmaresData]);

  // Filtered data
  const palmaresData = useMemo(() => {
    const filtered = allPalmaresData.filter(item => {
      if (yearFilter !== 'all' && new Date(item.tournament.date).getFullYear().toString() !== yearFilter) return false;
      if (formatFilter !== 'all' && item.tournament.format !== formatFilter) return false;
      if (resultFilter === 'podium' && !['1er', '2ème', '3ème'].includes(item.tournament.finalResult || '')) return false;
      return true;
    });

    if (groupMode === 'rank') {
      filtered.sort((a, b) => {
        const rankA = RESULT_CONFIG[a.tournament.finalResult || '']?.rank || 99;
        const rankB = RESULT_CONFIG[b.tournament.finalResult || '']?.rank || 99;
        if (rankA !== rankB) return rankA - rankB;
        return new Date(b.tournament.date).getTime() - new Date(a.tournament.date).getTime();
      });
    } else {
      filtered.sort((a, b) => new Date(b.tournament.date).getTime() - new Date(a.tournament.date).getTime());
    }

    return filtered;
  }, [allPalmaresData, yearFilter, formatFilter, resultFilter, groupMode]);

  // Season grouping
  const seasonGroups = useMemo(() => {
    if (groupMode !== 'season') return [];
    const groups: Record<string, { year: string; items: TournamentPalmaresItem[]; summary: { total: number; wins: number; matches: number; podiums: number; titles: number; winRate: number } }> = {};

    palmaresData.forEach(item => {
      const year = new Date(item.tournament.date).getFullYear().toString();
      if (!groups[year]) {
        groups[year] = { year, items: [], summary: { total: 0, wins: 0, matches: 0, podiums: 0, titles: 0, winRate: 0 } };
      }
      groups[year].items.push(item);
      groups[year].summary.total++;
      groups[year].summary.wins += item.stats.wins;
      groups[year].summary.matches += item.stats.played;
      if (['1er', '2ème', '3ème'].includes(item.tournament.finalResult || '')) groups[year].summary.podiums++;
      if (item.tournament.finalResult === '1er') groups[year].summary.titles++;
    });

    Object.values(groups).forEach(g => {
      g.summary.winRate = g.summary.matches > 0 ? Math.round((g.summary.wins / g.summary.matches) * 100) : 0;
    });

    return Object.values(groups).sort((a, b) => parseInt(b.year) - parseInt(a.year));
  }, [palmaresData, groupMode]);

  // Summary
  const summary = useMemo(() => {
    const totalTournaments = palmaresData.length;
    const totalWins = palmaresData.reduce((sum, item) => sum + item.stats.wins, 0);
    const totalMatches = palmaresData.reduce((sum, item) => sum + item.stats.played, 0);
    const podiums = palmaresData.filter(item => ['1er', '2ème', '3ème'].includes(item.tournament.finalResult || '')).length;
    const titles = palmaresData.filter(item => item.tournament.finalResult === '1er').length;
    const seconds = palmaresData.filter(item => item.tournament.finalResult === '2ème').length;
    const thirds = palmaresData.filter(item => item.tournament.finalResult === '3ème').length;
    const totalCarreaux = palmaresData.reduce((sum, item) => sum + item.stats.carreaux, 0);
    const avgWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    // Best win streak
    let maxStreak = 0, currentStreak = 0;
    const sortedByDate = [...palmaresData].sort((a, b) => new Date(a.tournament.date).getTime() - new Date(b.tournament.date).getTime());
    sortedByDate.forEach(item => {
      item.matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(m => {
        if (m.winner === 'A') { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); }
        else { currentStreak = 0; }
      });
    });

    // Best tir rate tournament
    let bestTirTournament: TournamentPalmaresItem | null = null;
    palmaresData.forEach(item => {
      if (item.stats.tirRate !== null && (bestTirTournament === null || (item.stats.tirRate > (bestTirTournament.stats.tirRate || 0)))) {
        bestTirTournament = item;
      }
    });

    // Undefeated tournaments
    const undefeated = palmaresData.filter(item => item.stats.played > 0 && item.stats.losses === 0).length;

    return { totalTournaments, totalWins, totalMatches, podiums, titles, seconds, thirds, totalCarreaux, avgWinRate, maxStreak, bestTirTournament, undefeated };
  }, [palmaresData]);

  // Performance Badges
  const badges: PerformanceBadge[] = useMemo(() => {
    return [
      {
        id: 'champion', icon: 'emoji-events', label: t('palmares', 'champion'),
        description: t('palmares', 'championDesc'),
        color: '#FFD700', bgColor: '#FFD700' + '18',
        earned: summary.titles > 0,
        value: summary.titles > 0 ? `${summary.titles} ${t('palmares', 'titleCount')}` : undefined,
      },
      {
        id: 'podium_collector', icon: 'workspace-premium', label: t('palmares', 'collector'),
        description: t('palmares', 'collectorDesc'),
        color: '#C0C0C0', bgColor: '#C0C0C0' + '18',
        earned: summary.podiums >= 3,
        value: summary.podiums >= 3 ? `${summary.podiums} ${t('palmares', 'podiumCount')}` : undefined,
      },
      {
        id: 'invincible', icon: 'shield', label: t('palmares', 'invincible'),
        description: t('palmares', 'invincibleDesc'),
        color: theme.success, bgColor: theme.success + '15',
        earned: summary.undefeated > 0,
        value: summary.undefeated > 0 ? `${summary.undefeated} ${t('palmares', 'times')}` : undefined,
      },
      {
        id: 'streak', icon: 'local-fire-department', label: t('palmares', 'onFire'),
        description: t('palmares', 'onFireDesc'),
        color: '#FF6B35', bgColor: '#FF6B35' + '15',
        earned: summary.maxStreak >= 5,
        value: summary.maxStreak >= 5 ? `${summary.maxStreak} ${t('palmares', 'matchCount')}` : undefined,
      },
      {
        id: 'sniper', icon: 'gps-fixed', label: t('palmares', 'sniper'),
        description: t('palmares', 'sniperDesc'),
        color: theme.tirColor, bgColor: theme.tirColor + '15',
        earned: summary.bestTirTournament !== null && (summary.bestTirTournament.stats.tirRate || 0) >= 60,
        value: summary.bestTirTournament ? `${summary.bestTirTournament.stats.tirRate}%` : undefined,
      },
      {
        id: 'carreau_master', icon: 'stars', label: t('palmares', 'carreauMaster'),
        description: t('palmares', 'carreauMasterDesc'),
        color: theme.carreauColor, bgColor: theme.carreauColor + '15',
        earned: summary.totalCarreaux >= 10,
        value: summary.totalCarreaux >= 10 ? `${summary.totalCarreaux} ${t('palmares', 'carreaux').toLowerCase()}` : undefined,
      },
      {
        id: 'veteran', icon: 'military-tech', label: t('palmares', 'veteran'),
        description: t('palmares', 'veteranDesc'),
        color: '#8B5CF6', bgColor: '#8B5CF6' + '15',
        earned: summary.totalTournaments >= 10,
        value: summary.totalTournaments >= 10 ? `${summary.totalTournaments} ${t('palmares', 'tournois')}` : undefined,
      },
      {
        id: 'winner', icon: 'trending-up', label: t('palmares', 'winner'),
        description: t('palmares', 'winnerDesc'),
        color: theme.primary, bgColor: theme.primary + '15',
        earned: summary.avgWinRate >= 60 && summary.totalMatches >= 5,
        value: summary.avgWinRate >= 60 ? `${summary.avgWinRate}%` : undefined,
      },
    ];
  }, [summary, t]);

  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);

  // Chart data
  const chartData = useMemo(() => {
    const sorted = [...palmaresData].sort((a, b) => new Date(a.tournament.date).getTime() - new Date(b.tournament.date).getTime());
    return sorted.map((item, index) => {
      const cumulativeWins = sorted.slice(0, index + 1).reduce((sum, i) => sum + i.stats.wins, 0);
      const cumulativeMatches = sorted.slice(0, index + 1).reduce((sum, i) => sum + i.stats.played, 0);
      return {
        label: new Date(item.tournament.date).toLocaleDateString(locale, { month: 'short', year: '2-digit' }),
        shortName: item.tournament.name.substring(0, 10),
        winRate: cumulativeMatches > 0 ? Math.round((cumulativeWins / cumulativeMatches) * 100) : 0,
        tournamentWinRate: item.stats.winRate,
        pointDiff: item.stats.pointDiff,
        tournamentName: item.tournament.name,
        tournamentDate: new Date(item.tournament.date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
        tournamentCity: item.tournament.location?.city || '',
        tournamentFormat: item.tournament.format,
        tournamentResult: item.tournament.finalResult,
        tournamentId: item.tournament.id,
        statsPlayed: item.stats.played,
        statsWins: item.stats.wins,
        statsLosses: item.stats.losses,
      };
    });
  }, [palmaresData, locale]);

  // Build flat list data for season mode
  const flatListData = useMemo(() => {
    if (groupMode === 'rank') return palmaresData;
    // For season mode, we'll render in the header
    return [];
  }, [palmaresData, groupMode]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('palmares', 'title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={flatListData}
        keyExtractor={item => item.tournament.id}
        renderItem={({ item, index }) => <TournamentCard item={item} index={index} t={t} language={language} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            {/* Podium Hero */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
              {summary.podiums > 0 ? (
                <View style={styles.podiumContainer}>
                  {/* 2nd place */}
                  <View style={styles.podiumColumn}>
                    <View style={[styles.podiumMedalCircle, { backgroundColor: '#C0C0C0' + '20' }]}>
                      <MaterialIcons name="workspace-premium" size={24} color="#C0C0C0" />
                    </View>
                    <Text style={[styles.podiumCount, { color: '#A0A0A0' }]}>{summary.seconds}</Text>
                    <View style={[styles.podiumBar, styles.podiumBar2nd]}>
                      <Text style={styles.podiumBarText}>{language === 'en' ? '2nd' : '2e'}</Text>
                    </View>
                  </View>
                  {/* 1st place */}
                  <View style={styles.podiumColumn}>
                    <View style={[styles.podiumMedalCircle, { backgroundColor: '#FFD700' + '20' }]}>
                      <MaterialIcons name="emoji-events" size={28} color="#FFD700" />
                    </View>
                    <Text style={[styles.podiumCount, { color: '#DAA520' }]}>{summary.titles}</Text>
                    <View style={[styles.podiumBar, styles.podiumBar1st]}>
                      <Text style={styles.podiumBarText}>{language === 'en' ? '1st' : '1er'}</Text>
                    </View>
                  </View>
                  {/* 3rd place */}
                  <View style={styles.podiumColumn}>
                    <View style={[styles.podiumMedalCircle, { backgroundColor: '#CD7F32' + '20' }]}>
                      <MaterialIcons name="military-tech" size={24} color="#CD7F32" />
                    </View>
                    <Text style={[styles.podiumCount, { color: '#CD7F32' }]}>{summary.thirds}</Text>
                    <View style={[styles.podiumBar, styles.podiumBar3rd]}>
                      <Text style={styles.podiumBarText}>{language === 'en' ? '3rd' : '3e'}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.heroIconRow}>
                  <View style={styles.heroIcon}>
                    <MaterialIcons name="emoji-events" size={36} color={theme.carreauColor} />
                  </View>
                </View>
              )}

              <Text style={styles.heroTitle}>{summary.totalTournaments} {t('palmares', 'tournois')}</Text>
              <Text style={styles.heroSubtitle}>
                {summary.totalMatches} {t('palmares', 'matchs')} • {summary.totalWins} {t('palmares', 'victoires')} • {summary.avgWinRate}% {t('palmares', 'taux')}
              </Text>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.carreauColor }]}>{summary.titles}</Text>
                  <Text style={styles.heroStatLabel}>{t('palmares', 'titres')}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.accent }]}>{summary.podiums}</Text>
                  <Text style={styles.heroStatLabel}>{t('palmares', 'podiums')}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.success }]}>{summary.avgWinRate}%</Text>
                  <Text style={styles.heroStatLabel}>{t('palmares', 'victoires')}</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.tirColor }]}>{summary.totalCarreaux}</Text>
                  <Text style={styles.heroStatLabel}>{t('palmares', 'carreaux')}</Text>
                </View>
              </View>
            </Animated.View>

            {/* Performance Badges */}
            <Animated.View entering={FadeInDown.duration(400).delay(50)}>
              <Pressable
                style={styles.badgesSectionHeader}
                onPress={() => { Haptics.selectionAsync(); setShowBadges(!showBadges); }}
              >
                <View style={styles.badgesSectionLeft}>
                  <MaterialIcons name="stars" size={18} color={theme.carreauColor} />
                  <Text style={styles.badgesSectionTitle}>{t('palmares', 'badges')}</Text>
                  <View style={styles.badgeCountPill}>
                    <Text style={styles.badgeCountText}>{earnedBadges.length}/{badges.length}</Text>
                  </View>
                </View>
                <MaterialIcons name={showBadges ? 'expand-less' : 'expand-more'} size={22} color={theme.textSecondary} />
              </Pressable>

              {showBadges ? (
                <Animated.View entering={FadeIn.duration(300)} style={styles.badgesGrid}>
                  {/* Earned first */}
                  {earnedBadges.map((badge, i) => (
                    <BadgeCard key={badge.id} badge={badge} index={i} />
                  ))}
                  {/* Locked after */}
                  {lockedBadges.map((badge, i) => (
                    <BadgeCard key={badge.id} badge={badge} index={earnedBadges.length + i} />
                  ))}
                </Animated.View>
              ) : null}
            </Animated.View>

            {/* Filters */}
            <View style={styles.filtersSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <Pressable
                  style={[styles.filterChip, yearFilter === 'all' && styles.filterChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setYearFilter('all'); }}
                >
                  <Text style={[styles.filterChipText, yearFilter === 'all' && styles.filterChipTextActive]}>{t('palmares', 'allYears')}</Text>
                </Pressable>
                {availableYears.map(year => (
                  <Pressable
                    key={year}
                    style={[styles.filterChip, yearFilter === year && styles.filterChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setYearFilter(yearFilter === year ? 'all' : year); }}
                  >
                    <Text style={[styles.filterChipText, yearFilter === year && styles.filterChipTextActive]}>{year}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.filterRowWrap}>
                {FORMAT_FILTERS.map(f => (
                  <Pressable
                    key={f.id}
                    style={[styles.filterChipSmall, formatFilter === f.id && styles.filterChipSmallActive]}
                    onPress={() => { Haptics.selectionAsync(); setFormatFilter(f.id); }}
                  >
                    <Text style={[styles.filterChipSmallText, formatFilter === f.id && styles.filterChipSmallTextActive]}>{f.label}</Text>
                  </Pressable>
                ))}
                <View style={styles.filterSeparator} />
                <Pressable
                  style={[styles.filterChipSmall, resultFilter === 'podium' && styles.filterChipPodiumActive]}
                  onPress={() => { Haptics.selectionAsync(); setResultFilter(resultFilter === 'podium' ? 'all' : 'podium'); }}
                >
                  <MaterialIcons name="emoji-events" size={14} color={resultFilter === 'podium' ? theme.carreauColor : theme.textMuted} />
                  <Text style={[styles.filterChipSmallText, resultFilter === 'podium' && { color: theme.carreauColor }]}>{t('palmares', 'podiumsOnly')}</Text>
                </Pressable>
              </View>
            </View>

            {/* Group Mode Toggle */}
            <View style={styles.groupToggleContainer}>
              <Pressable
                style={[styles.groupToggleBtn, groupMode === 'rank' && styles.groupToggleBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setGroupMode('rank'); }}
              >
                <MaterialIcons name="emoji-events" size={15} color={groupMode === 'rank' ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.groupToggleText, groupMode === 'rank' && styles.groupToggleTextActive]}>{t('palmares', 'byRank')}</Text>
              </Pressable>
              <Pressable
                style={[styles.groupToggleBtn, groupMode === 'season' && styles.groupToggleBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setGroupMode('season'); }}
              >
                <MaterialIcons name="date-range" size={15} color={groupMode === 'season' ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.groupToggleText, groupMode === 'season' && styles.groupToggleTextActive]}>{t('palmares', 'bySeason')}</Text>
              </Pressable>
            </View>

            {/* Chart Toggle */}
            {palmaresData.length >= 2 ? (
              <Pressable
                style={styles.chartToggle}
                onPress={() => { Haptics.selectionAsync(); setShowChart(!showChart); }}
              >
                <MaterialIcons name="show-chart" size={18} color={theme.primary} />
                <Text style={styles.chartToggleText}>{showChart ? t('palmares', 'hideChart') : t('palmares', 'showProgression')}</Text>
                <MaterialIcons name={showChart ? 'expand-less' : 'expand-more'} size={20} color={theme.primary} />
              </Pressable>
            ) : null}

            {/* Chart */}
            {showChart && chartData.length >= 2 ? (
              <Animated.View entering={FadeIn.duration(400)} style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <MaterialIcons name="trending-up" size={18} color={theme.primary} />
                  <Text style={styles.chartTitle}>{t('palmares', 'tournamentEvolution')}</Text>
                </View>
                <Text style={styles.chartSubtitle}>{t('palmares', 'winRateByTournament')}</Text>
                <View style={styles.chartContainer}>
                  <Svg width={screenWidth - 80} height={180}>
                    {[0, 25, 50, 75, 100].map((v, i) => (
                      <G key={i}>
                        <Line x1="35" y1={160 - (v / 100) * 130} x2={screenWidth - 80} y2={160 - (v / 100) * 130} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                        <SvgText x="30" y={165 - (v / 100) * 130} fontSize="9" fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                      </G>
                    ))}
                    {chartData.map((data, i) => {
                      const chartWidth = screenWidth - 115;
                      const x = 45 + (i * (chartWidth / Math.max(chartData.length - 1, 1)));
                      const y = 160 - (data.tournamentWinRate / 100) * 130;
                      const prevData = chartData[i - 1];
                      const prevX = prevData ? 45 + ((i - 1) * (chartWidth / Math.max(chartData.length - 1, 1))) : x;
                      const prevY = prevData ? 160 - (prevData.tournamentWinRate / 100) * 130 : y;
                      const isSelected = selectedChartIndex === i;
                      return (
                        <G key={i}>
                          {i > 0 ? <Line x1={prevX} y1={prevY} x2={x} y2={y} stroke={theme.primary} strokeWidth="2.5" /> : null}
                          <Circle cx={x} cy={y} r="18" fill="transparent" onPress={() => { Haptics.selectionAsync(); setSelectedChartIndex(isSelected ? null : i); }} />
                          <Circle cx={x} cy={y} r={isSelected ? 8 : 5} fill={data.tournamentWinRate >= 50 ? theme.success : theme.error} stroke={isSelected ? theme.primary : 'transparent'} strokeWidth={isSelected ? 3 : 0} onPress={() => { Haptics.selectionAsync(); setSelectedChartIndex(isSelected ? null : i); }} />
                          <SvgText x={x} y={y - 12} fontSize="9" fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.tournamentWinRate}%</SvgText>
                        </G>
                      );
                    })}
                  </Svg>
                </View>

                {selectedChartIndex !== null && chartData[selectedChartIndex] ? (
                  <Animated.View entering={FadeIn.duration(250)} style={styles.tooltipCard}>
                    <Pressable style={styles.tooltipClose} onPress={() => setSelectedChartIndex(null)}>
                      <MaterialIcons name="close" size={16} color={theme.textMuted} />
                    </Pressable>
                    <View style={styles.tooltipHeader}>
                      {(() => {
                        const d = chartData[selectedChartIndex];
                        const rCfg = RESULT_CONFIG[d.tournamentResult || ''] || { icon: 'sports', color: theme.textMuted };
                        return (
                          <>
                            <View style={[styles.tooltipResultIcon, { backgroundColor: rCfg.color + '20' }]}>
                              <MaterialIcons name={rCfg.icon as any} size={20} color={rCfg.color} />
                            </View>
                            <View style={styles.tooltipHeaderInfo}>
                              <Text style={styles.tooltipName} numberOfLines={2}>{d.tournamentName}</Text>
                              <Text style={styles.tooltipDate}>{d.tournamentDate} — {d.tournamentCity}</Text>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                    <View style={styles.tooltipStatsRow}>
                      <View style={styles.tooltipStatItem}>
                        <Text style={styles.tooltipStatLabel}>Format</Text>
                        <Text style={styles.tooltipStatValue}>{t('formats', chartData[selectedChartIndex].tournamentFormat)}</Text>
                      </View>
                      <View style={styles.tooltipStatDivider} />
                      <View style={styles.tooltipStatItem}>
                        <Text style={styles.tooltipStatLabel}>{language === 'en' ? 'Result' : 'Résultat'}</Text>
                        <Text style={[styles.tooltipStatValue, { color: RESULT_CONFIG[chartData[selectedChartIndex].tournamentResult || '']?.color || theme.textPrimary }]}>
                          {chartData[selectedChartIndex].tournamentResult || '-'}
                        </Text>
                      </View>
                      <View style={styles.tooltipStatDivider} />
                      <View style={styles.tooltipStatItem}>
                        <Text style={styles.tooltipStatLabel}>{t('palmares', 'matchs')}</Text>
                        <Text style={styles.tooltipStatValue}>{chartData[selectedChartIndex].statsWins}V-{chartData[selectedChartIndex].statsLosses}{language === 'en' ? 'L' : 'D'}</Text>
                      </View>
                      <View style={styles.tooltipStatDivider} />
                      <View style={styles.tooltipStatItem}>
                        <Text style={styles.tooltipStatLabel}>Diff.</Text>
                        <Text style={[styles.tooltipStatValue, { color: chartData[selectedChartIndex].pointDiff >= 0 ? theme.success : theme.error }]}>
                          {chartData[selectedChartIndex].pointDiff > 0 ? '+' : ''}{chartData[selectedChartIndex].pointDiff}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.tooltipDetailBtn}
                      onPress={() => {
                        const tid = chartData[selectedChartIndex!]?.tournamentId;
                        setSelectedChartIndex(null);
                        if (tid) router.push(`/tournament/${tid}`);
                      }}
                    >
                      <Text style={styles.tooltipDetailBtnText}>{t('palmares', 'seeJourney')}</Text>
                      <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
                    </Pressable>
                  </Animated.View>
                ) : null}

                <View style={styles.chartDivider} />
                <Text style={styles.chartSubtitle}>{t('palmares', 'pointDiffByTournament')}</Text>
                <View style={styles.chartContainer}>
                  <Svg width={screenWidth - 80} height={120}>
                    {chartData.map((data, i) => {
                      const barWidth = Math.max((screenWidth - 120) / chartData.length - 8, 12);
                      const x = 40 + (i * ((screenWidth - 100) / chartData.length));
                      const maxDiff = Math.max(...chartData.map(d => Math.abs(d.pointDiff)), 1);
                      const barHeight = Math.abs(data.pointDiff) / maxDiff * 35;
                      const isPositive = data.pointDiff >= 0;
                      const barY = isPositive ? 55 - barHeight : 55;
                      const isSelected = selectedChartIndex === i;
                      return (
                        <G key={i}>
                          <Rect x={x} y={barY} width={barWidth} height={Math.max(barHeight, 2)} fill={isPositive ? theme.success : theme.error} rx="3" opacity={isSelected ? 1 : 0.8} stroke={isSelected ? theme.primary : 'transparent'} strokeWidth={isSelected ? 2 : 0} onPress={() => { Haptics.selectionAsync(); setSelectedChartIndex(isSelected ? null : i); }} />
                          <Rect x={x - 4} y={0} width={barWidth + 8} height={120} fill="transparent" onPress={() => { Haptics.selectionAsync(); setSelectedChartIndex(isSelected ? null : i); }} />
                          <SvgText x={x + barWidth / 2} y={isPositive ? barY - 6 : barY + barHeight + 12} fontSize="9" fill={isPositive ? theme.success : theme.error} textAnchor="middle" fontWeight="600">
                            {isPositive ? '+' : ''}{data.pointDiff}
                          </SvgText>
                          <SvgText x={x + barWidth / 2} y={105} fontSize="7" fill={isSelected ? theme.primary : theme.textMuted} textAnchor="middle" fontWeight={isSelected ? '700' : '400'}>{data.label}</SvgText>
                        </G>
                      );
                    })}
                    <Line x1="35" y1="55" x2={screenWidth - 80} y2="55" stroke={theme.border} strokeWidth="1" />
                  </Svg>
                </View>
              </Animated.View>
            ) : null}

            {/* Season Groups (when in season mode) */}
            {groupMode === 'season' ? (
              <>
                {seasonGroups.map((group, gi) => (
                  <Animated.View key={group.year} entering={FadeInDown.duration(300).delay(gi * 60)}>
                    {/* Season Header Card */}
                    <View style={styles.seasonHeaderCard}>
                      <View style={styles.seasonHeaderLeft}>
                        <MaterialIcons name="date-range" size={20} color={theme.primary} />
                        <Text style={styles.seasonYear}>{t('palmares', 'season')} {group.year}</Text>
                      </View>
                      <View style={styles.seasonBadgeRow}>
                        {group.summary.titles > 0 ? (
                          <View style={[styles.seasonMini, { backgroundColor: '#FFD700' + '18' }]}>
                            <MaterialIcons name="emoji-events" size={12} color="#FFD700" />
                            <Text style={[styles.seasonMiniText, { color: '#DAA520' }]}>{group.summary.titles}</Text>
                          </View>
                        ) : null}
                        {group.summary.podiums > group.summary.titles ? (
                          <View style={[styles.seasonMini, { backgroundColor: '#C0C0C0' + '18' }]}>
                            <MaterialIcons name="workspace-premium" size={12} color="#C0C0C0" />
                            <Text style={[styles.seasonMiniText, { color: '#A0A0A0' }]}>{group.summary.podiums - group.summary.titles}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Season Stats */}
                    <View style={styles.seasonStatsBar}>
                      <View style={styles.seasonStatCell}>
                        <Text style={styles.seasonStatVal}>{group.summary.total}</Text>
                        <Text style={styles.seasonStatLbl}>{t('palmares', 'tournois')}</Text>
                      </View>
                      <View style={styles.seasonStatDiv} />
                      <View style={styles.seasonStatCell}>
                        <Text style={[styles.seasonStatVal, { color: theme.success }]}>{group.summary.wins}</Text>
                        <Text style={styles.seasonStatLbl}>{t('palmares', 'victoires')}</Text>
                      </View>
                      <View style={styles.seasonStatDiv} />
                      <View style={styles.seasonStatCell}>
                        <Text style={styles.seasonStatVal}>{group.summary.matches}</Text>
                        <Text style={styles.seasonStatLbl}>{t('palmares', 'matchs')}</Text>
                      </View>
                      <View style={styles.seasonStatDiv} />
                      <View style={styles.seasonStatCell}>
                        <Text style={[styles.seasonStatVal, { color: theme.primary }]}>{group.summary.winRate}%</Text>
                        <Text style={styles.seasonStatLbl}>{language === 'en' ? 'Win' : 'Vict.'}</Text>
                      </View>
                      <View style={styles.seasonStatDiv} />
                      <View style={styles.seasonStatCell}>
                        <Text style={[styles.seasonStatVal, { color: theme.accent }]}>{group.summary.podiums}</Text>
                        <Text style={styles.seasonStatLbl}>{t('palmares', 'podiums')}</Text>
                      </View>
                    </View>

                    {/* Season Tournaments */}
                    {group.items.map((item, idx) => (
                      <TournamentCard key={item.tournament.id} item={item} index={idx} t={t} language={language} />
                    ))}

                    {gi < seasonGroups.length - 1 ? <View style={styles.seasonDivider} /> : null}
                  </Animated.View>
                ))}
              </>
            ) : (
              palmaresData.length > 0 ? (
                <Text style={styles.listSectionTitle}>{t('palmares', 'detailByTournament')} ({palmaresData.length})</Text>
              ) : null
            )}
          </>
        )}
        ListEmptyComponent={() => (
          groupMode === 'rank' ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="emoji-events" size={64} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>{t('palmares', 'noFinished')}</Text>
              <Text style={styles.emptyText}>{t('palmares', 'noFinishedText')}</Text>
              <Pressable style={styles.emptyButton} onPress={() => router.push('/tournament/new')}>
                <MaterialIcons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>{t('palmares', 'createTournament')}</Text>
              </Pressable>
            </View>
          ) : null
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Hero
  heroCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.xl,
    padding: 24, alignItems: 'center', marginBottom: 16, ...theme.shadows.card,
  },
  heroIconRow: { marginBottom: 12 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: theme.carreauColor + '15', alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  heroSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 4, marginBottom: 20 },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.lg,
    paddingVertical: 16, paddingHorizontal: 8,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  heroStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: theme.border },

  // Podium
  podiumContainer: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    marginBottom: 16, gap: 12,
  },
  podiumColumn: { alignItems: 'center', gap: 6 },
  podiumMedalCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  podiumCount: { fontSize: 18, fontWeight: '800' },
  podiumBar: {
    width: 64, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8,
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
  },
  podiumBar1st: {
    height: 72, backgroundColor: '#FFD700' + '30',
    borderWidth: 2, borderBottomWidth: 0, borderColor: '#FFD700' + '50',
  },
  podiumBar2nd: {
    height: 52, backgroundColor: '#C0C0C0' + '25',
    borderWidth: 2, borderBottomWidth: 0, borderColor: '#C0C0C0' + '40',
  },
  podiumBar3rd: {
    height: 40, backgroundColor: '#CD7F32' + '20',
    borderWidth: 2, borderBottomWidth: 0, borderColor: '#CD7F32' + '35',
  },
  podiumBarText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },

  // Badges Section
  badgesSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 4, marginBottom: 4,
  },
  badgesSectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgesSectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  badgeCountPill: {
    backgroundColor: theme.primary + '15', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  badgeCountText: { fontSize: 12, fontWeight: '700', color: theme.primary },
  badgesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 16,
  },
  badgeCard: {
    width: (screenWidth - 32 - 30) / 4,
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.md,
    padding: 10, alignItems: 'center', ...theme.shadows.card,
    minHeight: 110,
  },
  badgeCardLocked: { opacity: 0.5 },
  badgeIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  badgeLabel: { fontSize: 11, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', marginBottom: 2 },
  badgeValue: { fontSize: 10, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  badgeDesc: { fontSize: 8, color: theme.textMuted, textAlign: 'center', lineHeight: 11 },
  badgeLockOverlay: {
    position: 'absolute', top: 6, right: 6,
  },

  // Group Toggle
  groupToggleContainer: {
    flexDirection: 'row', backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg, padding: 4, marginBottom: 12,
    ...theme.shadows.card,
  },
  groupToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: theme.borderRadius.md,
  },
  groupToggleBtnActive: { backgroundColor: theme.primary },
  groupToggleText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  groupToggleTextActive: { color: '#FFF' },

  // List section
  listSectionTitle: {
    fontSize: 12, fontWeight: '600', color: theme.textSecondary,
    letterSpacing: 1, marginBottom: 12, paddingLeft: 4,
  },

  // Card
  card: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 16, marginBottom: 12, ...theme.shadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  resultBadge: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardHeaderInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardDate: { fontSize: 12, color: theme.textSecondary },
  cardFormat: { fontSize: 12, color: theme.textSecondary },
  cardCity: { fontSize: 12, color: theme.textSecondary },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted, marginHorizontal: 6 },
  resultTag: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: theme.borderRadius.full, borderWidth: 1,
  },
  resultTagText: { fontSize: 12, fontWeight: '700' },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: theme.border },

  // Financials in card
  financialRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, marginBottom: 8,
  },
  financialItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  financialText: { fontSize: 13, fontWeight: '600' },
  netBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  netText: { fontSize: 12, fontWeight: '700' },

  // Footer
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardType: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  cardTypeText: { fontSize: 11, color: theme.textMuted, fontWeight: '500' },
  carreauBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.carreauColor + '15', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  carreauText: { fontSize: 11, color: theme.carreauColor, fontWeight: '600' },

  // Filters
  filtersSection: { marginBottom: 12, gap: 10 },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: theme.borderRadius.full, backgroundColor: theme.surface,
    borderWidth: 1.5, borderColor: theme.border,
  },
  filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  filterChipTextActive: { color: '#FFF' },
  filterChipSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: theme.borderRadius.full, backgroundColor: theme.surface,
    borderWidth: 1.5, borderColor: theme.border,
  },
  filterChipSmallActive: { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
  filterChipPodiumActive: { borderColor: theme.carreauColor, backgroundColor: theme.carreauColor + '10' },
  filterChipSmallText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  filterChipSmallTextActive: { color: theme.primary },
  filterSeparator: { width: 1, height: 20, backgroundColor: theme.border, marginHorizontal: 4 },

  // Chart
  chartToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.primary + '10', paddingVertical: 12,
    borderRadius: theme.borderRadius.md, marginBottom: 16,
  },
  chartToggleText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  chartCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 16, marginBottom: 20, ...theme.shadows.card,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  chartSubtitle: { fontSize: 11, color: theme.textMuted, marginBottom: 12 },
  chartContainer: { alignItems: 'center', marginBottom: 8 },
  chartDivider: { height: 1, backgroundColor: theme.border, marginVertical: 14 },

  // Tooltip
  tooltipCard: {
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.lg,
    padding: 14, marginTop: 8, marginBottom: 4, borderWidth: 1, borderColor: theme.primary + '30',
  },
  tooltipClose: {
    position: 'absolute', top: 8, right: 8, zIndex: 1,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
  },
  tooltipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingRight: 28 },
  tooltipResultIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  tooltipHeaderInfo: { flex: 1 },
  tooltipName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  tooltipDate: { fontSize: 11, color: theme.textSecondary },
  tooltipStatsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.md,
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 10,
  },
  tooltipStatItem: { flex: 1, alignItems: 'center' },
  tooltipStatLabel: { fontSize: 9, color: theme.textMuted, marginBottom: 2 },
  tooltipStatValue: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  tooltipStatDivider: { width: 1, height: 24, backgroundColor: theme.border },
  tooltipDetailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.md,
  },
  tooltipDetailBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },

  // Season grouping
  seasonHeaderCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
    ...theme.shadows.card, borderLeftWidth: 4, borderLeftColor: theme.primary,
  },
  seasonHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seasonYear: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  seasonBadgeRow: { flexDirection: 'row', gap: 6 },
  seasonMini: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.full,
  },
  seasonMiniText: { fontSize: 12, fontWeight: '700' },
  seasonStatsBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.md,
    paddingVertical: 12, paddingHorizontal: 4, marginBottom: 12,
    ...theme.shadows.card,
  },
  seasonStatCell: { flex: 1, alignItems: 'center' },
  seasonStatVal: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  seasonStatLbl: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  seasonStatDiv: { width: 1, height: 24, backgroundColor: theme.border },
  seasonDivider: { height: 2, backgroundColor: theme.border, marginVertical: 16, borderRadius: 1 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 260, marginBottom: 24 },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  emptyButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
