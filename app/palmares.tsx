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

const PODIUM_RESULTS = ['1er', '2ème', '3ème', '1er Tableau A', '1er Tableau B', '1er Tableau C', 'Finaliste Tableau A', 'Finaliste Tableau B', 'Finaliste Tableau C'];
const TITLE_RESULTS = ['1er', '1er Tableau A', '1er Tableau B', '1er Tableau C'];

const RESULT_CONFIG: Record<string, { icon: string; color: string; rank: number }> = {
  '1er': { icon: 'emoji-events', color: '#FFD700', rank: 1 },
  '2ème': { icon: 'workspace-premium', color: '#C0C0C0', rank: 2 },
  '3ème': { icon: 'military-tech', color: '#CD7F32', rank: 3 },
  '1er Tableau A': { icon: 'emoji-events', color: '#FFD700', rank: 4 },
  'Finaliste Tableau A': { icon: 'workspace-premium', color: '#C0C0C0', rank: 5 },
  '1er Tableau B': { icon: 'emoji-events', color: '#4A90D9', rank: 6 },
  'Finaliste Tableau B': { icon: 'workspace-premium', color: '#4A90D9', rank: 7 },
  '1er Tableau C': { icon: 'emoji-events', color: '#7B8794', rank: 8 },
  'Finaliste Tableau C': { icon: 'workspace-premium', color: '#7B8794', rank: 9 },
  'Demi-finale': { icon: 'trending-up', color: '#4A90D9', rank: 10 },
  'Quart de finale': { icon: 'trending-flat', color: '#F5A623', rank: 11 },
  '1/8 finale': { icon: 'sports', color: '#7B8794', rank: 12 },
  'Poules': { icon: 'group', color: '#7B8794', rank: 13 },
  'Autre': { icon: 'more-horiz', color: '#7B8794', rank: 14 },
};

function TournamentCard({ item, index }: { item: TournamentPalmaresItem; index: number }) {
  const { tournament, stats } = item;
  const resultCfg = RESULT_CONFIG[tournament.finalResult || ''] || { icon: 'sports', color: theme.textMuted, rank: 99 };
  const hasFinancials = (tournament.registrationCost && tournament.registrationCost > 0) || (tournament.prizeWon && tournament.prizeWon > 0);
  const netGain = (tournament.prizeWon || 0) - (tournament.registrationCost || 0);

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
                {new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <View style={styles.dot} />
              <Text style={styles.cardFormat}>{tournament.format}</Text>
              <View style={styles.dot} />
              <Text style={styles.cardCity}>{tournament.location?.city}</Text>
            </View>
          </View>
          {tournament.finalResult && (
            <View style={[styles.resultTag, { backgroundColor: resultCfg.color + '15', borderColor: resultCfg.color + '40' }]}>
              <Text style={[styles.resultTagText, { color: resultCfg.color }]}>{tournament.finalResult}</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.played}</Text>
            <Text style={styles.statLabel}>Matchs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.success }]}>{stats.wins}</Text>
            <Text style={styles.statLabel}>V</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.error }]}>{stats.losses}</Text>
            <Text style={styles.statLabel}>D</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{stats.winRate}%</Text>
            <Text style={styles.statLabel}>Vict.</Text>
          </View>
          {stats.tirRate !== null && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.tirColor }]}>{stats.tirRate}%</Text>
                <Text style={styles.statLabel}>Tir</Text>
              </View>
            </>
          )}
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: stats.pointDiff >= 0 ? theme.success : theme.error }]}>
              {stats.pointDiff > 0 ? '+' : ''}{stats.pointDiff}
            </Text>
            <Text style={styles.statLabel}>Diff.</Text>
          </View>
        </View>

        {/* Financials Row */}
        {hasFinancials && (
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
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.cardType}>
            <MaterialIcons name="category" size={12} color={theme.textMuted} />
            <Text style={styles.cardTypeText}>{tournament.type}</Text>
          </View>
          {stats.carreaux > 0 && (
            <View style={styles.carreauBadge}>
              <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
              <Text style={styles.carreauText}>{stats.carreaux} carreaux</Text>
            </View>
          )}
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

const FORMAT_FILTERS: { id: FormatFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'Tête-à-tête', label: 'TàT' },
  { id: 'Doublette', label: 'Doublette' },
  { id: 'Triplette', label: 'Triplette' },
];

export default function PalmaresScreen() {
  const insets = useSafeAreaInsets();
  const { tournaments, matches } = useApp();

  const [yearFilter, setYearFilter] = useState<YearFilter>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [showChart, setShowChart] = useState(false);
  const [selectedChartIndex, setSelectedChartIndex] = useState<number | null>(null);

  // Reset chart selection when filters change
  React.useEffect(() => {
    setSelectedChartIndex(null);
  }, [yearFilter, formatFilter, resultFilter]);

  // Build palmares data (unfiltered for summary)
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

    items.sort((a, b) => {
      const rankA = RESULT_CONFIG[a.tournament.finalResult || '']?.rank || 99;
      const rankB = RESULT_CONFIG[b.tournament.finalResult || '']?.rank || 99;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.tournament.date).getTime() - new Date(a.tournament.date).getTime();
    });

    return items;
  }, [tournaments, matches]);

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    allPalmaresData.forEach(item => {
      years.add(new Date(item.tournament.date).getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [allPalmaresData]);

  // Filtered palmares data
  const palmaresData = useMemo(() => {
    return allPalmaresData.filter(item => {
      if (yearFilter !== 'all' && new Date(item.tournament.date).getFullYear().toString() !== yearFilter) return false;
      if (formatFilter !== 'all' && item.tournament.format !== formatFilter) return false;
      if (resultFilter === 'podium' && !PODIUM_RESULTS.includes(item.tournament.finalResult || '')) return false;
      return true;
    });
  }, [allPalmaresData, yearFilter, formatFilter, resultFilter]);

  // Summary stats (from filtered data)
  const summary = useMemo(() => {
    const totalTournaments = palmaresData.length;
    const totalWins = palmaresData.reduce((sum, item) => sum + item.stats.wins, 0);
    const totalMatches = palmaresData.reduce((sum, item) => sum + item.stats.played, 0);
    const totalGains = palmaresData.reduce((sum, item) => sum + (item.tournament.prizeWon || 0), 0);
    const totalCosts = palmaresData.reduce((sum, item) => sum + (item.tournament.registrationCost || 0), 0);
    const podiums = palmaresData.filter(item => PODIUM_RESULTS.includes(item.tournament.finalResult || '')).length;
    const titles = palmaresData.filter(item => TITLE_RESULTS.includes(item.tournament.finalResult || '')).length;

    return { totalTournaments, totalWins, totalMatches, totalGains, totalCosts, podiums, titles };
  }, [palmaresData]);

  // Chart data: evolution over time (sorted by date, all finished tournaments)
  const chartData = useMemo(() => {
    const sorted = [...palmaresData].sort((a, b) => new Date(a.tournament.date).getTime() - new Date(b.tournament.date).getTime());
    return sorted.map((item, index) => {
      const cumulativeWins = sorted.slice(0, index + 1).reduce((sum, i) => sum + i.stats.wins, 0);
      const cumulativeMatches = sorted.slice(0, index + 1).reduce((sum, i) => sum + i.stats.played, 0);
      return {
        label: new Date(item.tournament.date).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        shortName: item.tournament.name.substring(0, 10),
        winRate: cumulativeMatches > 0 ? Math.round((cumulativeWins / cumulativeMatches) * 100) : 0,
        tournamentWinRate: item.stats.winRate,
        pointDiff: item.stats.pointDiff,
        // Full tournament detail for tooltip
        tournamentName: item.tournament.name,
        tournamentDate: new Date(item.tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        tournamentCity: item.tournament.location?.city || '',
        tournamentFormat: item.tournament.format,
        tournamentResult: item.tournament.finalResult,
        tournamentId: item.tournament.id,
        statsPlayed: item.stats.played,
        statsWins: item.stats.wins,
        statsLosses: item.stats.losses,
        opponents: item.matches.map(m => m.teamB?.playerNames?.[0]).filter(Boolean).slice(0, 3),
      };
    });
  }, [palmaresData]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Mon Palmarès</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={palmaresData}
        keyExtractor={item => item.tournament.id}
        renderItem={({ item, index }) => <TournamentCard item={item} index={index} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            {/* Summary Hero */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
              <View style={styles.heroIconRow}>
                <View style={styles.heroIcon}>
                  <MaterialIcons name="emoji-events" size={36} color={theme.carreauColor} />
                </View>
              </View>
              <Text style={styles.heroTitle}>{summary.totalTournaments} tournois</Text>
              <Text style={styles.heroSubtitle}>{summary.totalMatches} matchs joués</Text>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.carreauColor }]}>{summary.titles}</Text>
                  <Text style={styles.heroStatLabel}>Titres</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.accent }]}>{summary.podiums}</Text>
                  <Text style={styles.heroStatLabel}>Podiums</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.success }]}>{summary.totalWins}</Text>
                  <Text style={styles.heroStatLabel}>Victoires</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: summary.totalGains - summary.totalCosts >= 0 ? theme.success : theme.error }]}>
                    {summary.totalGains - summary.totalCosts >= 0 ? '+' : ''}{summary.totalGains - summary.totalCosts}€
                  </Text>
                  <Text style={styles.heroStatLabel}>Bilan</Text>
                </View>
              </View>
            </Animated.View>

            {/* Filters */}
            <View style={styles.filtersSection}>
              {/* Year Filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <Pressable
                  style={[styles.filterChip, yearFilter === 'all' && styles.filterChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setYearFilter('all'); }}
                >
                  <Text style={[styles.filterChipText, yearFilter === 'all' && styles.filterChipTextActive]}>Toutes</Text>
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

              {/* Format & Result Filters */}
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
                  <Text style={[styles.filterChipSmallText, resultFilter === 'podium' && { color: theme.carreauColor }]}>Podiums</Text>
                </Pressable>
              </View>
            </View>

            {/* Evolution Chart Toggle */}
            {palmaresData.length >= 2 && (
              <Pressable
                style={styles.chartToggle}
                onPress={() => { Haptics.selectionAsync(); setShowChart(!showChart); }}
              >
                <MaterialIcons name="show-chart" size={18} color={theme.primary} />
                <Text style={styles.chartToggleText}>{showChart ? 'Masquer le graphique' : 'Voir la progression'}</Text>
                <MaterialIcons name={showChart ? 'expand-less' : 'expand-more'} size={20} color={theme.primary} />
              </Pressable>
            )}

            {/* Evolution Chart */}
            {showChart && chartData.length >= 2 && (
              <Animated.View entering={FadeIn.duration(400)} style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <MaterialIcons name="trending-up" size={18} color={theme.primary} />
                  <Text style={styles.chartTitle}>Évolution en tournoi</Text>
                </View>
                <Text style={styles.chartSubtitle}>Taux de victoire par tournoi — touchez un point</Text>
                <View style={styles.chartContainer}>
                  <Svg width={screenWidth - 80} height={180}>
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map((v, i) => (
                      <G key={i}>
                        <Line x1="35" y1={160 - (v / 100) * 130} x2={screenWidth - 80} y2={160 - (v / 100) * 130} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                        <SvgText x="30" y={165 - (v / 100) * 130} fontSize="9" fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                      </G>
                    ))}
                    {/* Data points & lines */}
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
                          {i > 0 && <Line x1={prevX} y1={prevY} x2={x} y2={y} stroke={theme.primary} strokeWidth="2.5" />}
                          {/* Invisible larger hit area */}
                          <Circle cx={x} cy={y} r="18" fill="transparent" onPress={() => { Haptics.selectionAsync(); setSelectedChartIndex(isSelected ? null : i); }} />
                          <Circle cx={x} cy={y} r={isSelected ? 8 : 5} fill={data.tournamentWinRate >= 50 ? theme.success : theme.error} stroke={isSelected ? theme.primary : 'transparent'} strokeWidth={isSelected ? 3 : 0} onPress={() => { Haptics.selectionAsync(); setSelectedChartIndex(isSelected ? null : i); }} />
                          <SvgText x={x} y={y - 12} fontSize="9" fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.tournamentWinRate}%</SvgText>
                        </G>
                      );
                    })}
                  </Svg>
                </View>

                {/* Tooltip for selected tournament */}
                {selectedChartIndex !== null && chartData[selectedChartIndex] && (
                  <Animated.View entering={FadeIn.duration(250)} style={styles.tooltipCard}>
                    <Pressable style={styles.tooltipClose} onPress={() => setSelectedChartIndex(null)}>
                      <MaterialIcons name="close" size={16} color={theme.textMuted} />
                    </Pressable>
                    <View style={styles.tooltipHeader}>
                      {(() => {
                        const d = chartData[selectedChartIndex];
                        const resultCfg = RESULT_CONFIG[d.tournamentResult || ''] || { icon: 'sports', color: theme.textMuted };
                        return (
                          <>
                            <View style={[styles.tooltipResultIcon, { backgroundColor: resultCfg.color + '20' }]}>
                              <MaterialIcons name={resultCfg.icon as any} size={20} color={resultCfg.color} />
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
                        <Text style={styles.tooltipStatValue}>{chartData[selectedChartIndex].tournamentFormat}</Text>
                      </View>
                      <View style={styles.tooltipStatDivider} />
                      <View style={styles.tooltipStatItem}>
                        <Text style={styles.tooltipStatLabel}>Résultat</Text>
                        <Text style={[styles.tooltipStatValue, { color: RESULT_CONFIG[chartData[selectedChartIndex].tournamentResult || '']?.color || theme.textPrimary }]}>
                          {chartData[selectedChartIndex].tournamentResult || '-'}
                        </Text>
                      </View>
                      <View style={styles.tooltipStatDivider} />
                      <View style={styles.tooltipStatItem}>
                        <Text style={styles.tooltipStatLabel}>Matchs</Text>
                        <Text style={styles.tooltipStatValue}>{chartData[selectedChartIndex].statsWins}V-{chartData[selectedChartIndex].statsLosses}D</Text>
                      </View>
                      <View style={styles.tooltipStatDivider} />
                      <View style={styles.tooltipStatItem}>
                        <Text style={styles.tooltipStatLabel}>Diff.</Text>
                        <Text style={[styles.tooltipStatValue, { color: chartData[selectedChartIndex].pointDiff >= 0 ? theme.success : theme.error }]}>
                          {chartData[selectedChartIndex].pointDiff > 0 ? '+' : ''}{chartData[selectedChartIndex].pointDiff}
                        </Text>
                      </View>
                    </View>
                    {chartData[selectedChartIndex].opponents.length > 0 && (
                      <View style={styles.tooltipOpponents}>
                        <MaterialIcons name="people" size={14} color={theme.textMuted} />
                        <Text style={styles.tooltipOpponentsText} numberOfLines={1}>
                          {chartData[selectedChartIndex].opponents.join(', ')}
                        </Text>
                      </View>
                    )}
                    <Pressable
                      style={styles.tooltipDetailBtn}
                      onPress={() => { setSelectedChartIndex(null); router.push(`/tournament/${chartData[selectedChartIndex!].tournamentId}`); }}
                    >
                      <Text style={styles.tooltipDetailBtnText}>Voir le parcours</Text>
                      <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
                    </Pressable>
                  </Animated.View>
                )}

                {/* Point Diff bar chart */}
                <View style={styles.chartDivider} />
                <Text style={styles.chartSubtitle}>Différence de points par tournoi</Text>
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
                          {/* Invisible wider hit area */}
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
            )}

            {palmaresData.length > 0 && (
              <Text style={styles.listSectionTitle}>DÉTAIL PAR TOURNOI ({palmaresData.length})</Text>
            )}
          </>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <MaterialIcons name="emoji-events" size={64} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Aucun tournoi terminé</Text>
            <Text style={styles.emptyText}>Participez à des tournois pour construire votre palmarès</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/tournament/new')}>
              <MaterialIcons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>Créer un tournoi</Text>
            </Pressable>
          </View>
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
    padding: 24, alignItems: 'center', marginBottom: 20, ...theme.shadows.card,
  },
  heroIconRow: { marginBottom: 12 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: theme.carreauColor + '15', alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  heroSubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4, marginBottom: 20 },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.lg,
    paddingVertical: 16, paddingHorizontal: 8,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  heroStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: theme.border },
  // List
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
  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: theme.border },
  // Financials
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
  filtersSection: { marginBottom: 16, gap: 10 },
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
  tooltipOpponents: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border, marginBottom: 8,
  },
  tooltipOpponentsText: { fontSize: 12, color: theme.textSecondary, flex: 1 },
  tooltipDetailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.md,
  },
  tooltipDetailBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },
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
