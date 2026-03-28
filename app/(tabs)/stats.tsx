import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import { Image } from 'expo-image';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import Svg, { Circle, Line, G, Text as SvgText, Rect, Polygon } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';
import AdBanner from '@/components/ui/AdBanner';
import SponsorBanner from '@/components/ui/SponsorBanner';



import { filterByTime } from '@/hooks/useFilteredStats';
import type { TimeFilter } from '@/hooks/useFilteredStats';
import { usePerformanceStats, useTirStats, usePointStats, useErrorStats } from '@/hooks/useStatsComputation';
import { useBoulesSetStats, useTerrainTypeStats, usePrecisionWorkshopStats, useProgressionData, useTrends, useChallengeProgressionData, useTournamentProgressionData } from '@/hooks/useProgressionStats';
import type { ProgressionFilter } from '@/hooks/useProgressionStats';
import { ProgressRing, StatRow, SectionHeader, ProgressBar, BreakdownBar, NAPlaceholder } from '@/components/feature/stats/StatsPrimitives';
import { PerformanceSection } from '@/components/feature/stats/PerformanceSection';
import { TirSection } from '@/components/feature/stats/TirSection';
import { PointSection } from '@/components/feature/stats/PointSection';
import { ErrorsSection } from '@/components/feature/stats/ErrorsSection';
// TimeFilter imported from @/hooks/useFilteredStats
type StatsCategory = 'performance' | 'tir' | 'point' | 'errors';

const TIME_FILTER_KEYS: { id: TimeFilter; key: string }[] = [
  { id: 'today', key: 'today' },
  { id: 'week', key: 'week' },
  { id: 'month', key: 'month' },
  { id: '3months', key: 'threeMonths' },
  { id: '6months', key: 'sixMonths' },
  { id: 'year', key: 'year' },
  { id: 'all', key: 'all' },
];

const PROGRESSION_FILTER_KEYS: { id: ProgressionFilter; key: string; weeks: number }[] = [
  { id: '4weeks', key: 'fourWeeks', weeks: 4 },
  { id: '8weeks', key: 'eightWeeks', weeks: 8 },
  { id: '3months', key: 'threeMonths', weeks: 13 },
  { id: '6months', key: 'sixMonths', weeks: 26 },
  { id: 'year', key: 'year', weeks: 52 },
  { id: '2years', key: 'twoYears', weeks: 104 },
  { id: '5years', key: 'fiveYears', weeks: 260 },
  { id: '10years', key: 'tenYears', weeks: 520 },
  { id: '25years', key: 'twentyFiveYears', weeks: 1300 },
];

const CATEGORY_TAB_KEYS: { id: StatsCategory; key: string; icon: string; color: string }[] = [
  { id: 'performance', key: 'performance', icon: 'emoji-events', color: theme.primary },
  { id: 'tir', key: 'tir', icon: 'gps-fixed', color: theme.tirColor },
  { id: 'point', key: 'point', icon: 'adjust', color: theme.pointColor },
  { id: 'errors', key: 'errors', icon: 'error-outline', color: theme.error },
];

// filterByTime imported from @/hooks/useFilteredStats

// UI Components (ProgressRing, StatRow, SectionHeader, ProgressBar, BreakdownBar, NAPlaceholder)
// imported from @/components/feature/stats/StatsPrimitives

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { matches, challenges, tournaments, players, terrains, boulesSets, getMatchesByTournament, selfPlayer } = useApp();
  type ItemFilterType = 'all' | 'match' | 'challenge' | 'tournament' | 'opponent' | 'partner' | 'terrain' | 'boules';
  const { t, language } = useLanguage();
  const { timeFilter: timeFilterParam } = useLocalSearchParams<{ timeFilter?: string }>();

  // Translated filter/tab arrays
  const TIME_FILTERS = React.useMemo(() => TIME_FILTER_KEYS.map(f => ({ ...f, label: t('stats', f.key) || t('common', f.key) })), [language]);
  const PROGRESSION_FILTERS = React.useMemo(() => PROGRESSION_FILTER_KEYS.map(f => ({ ...f, label: t('stats', f.key) })), [language]);
  const CATEGORY_TABS = React.useMemo(() => CATEGORY_TAB_KEYS.map(f => ({ ...f, label: t('stats', f.key) })), [language]);
  
  // Responsive dimensions for tablet
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width || 375);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;
  const modalChartWidth = isTablet ? Math.floor((Math.min(screenWidth, 960) - 112) / 2) : screenWidth - 64;
  const modalChartHeight = isTablet ? 190 : 160;
  const modalBarChartHeight = isTablet ? 160 : 140;

  const [timeFilter, setTimeFilter] = useState<TimeFilter>(() => {
    const valid: TimeFilter[] = ['today', 'week', 'month', '3months', '6months', 'year', 'all'];
    if (timeFilterParam && valid.includes(timeFilterParam as TimeFilter)) return timeFilterParam as TimeFilter;
    return 'all';
  });
  const [category, setCategory] = useState<StatsCategory>('performance');
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [progressionFilter, setProgressionFilter] = useState<ProgressionFilter>('8weeks');
  const [chartTooltip, setChartTooltip] = useState<{ chart: string; index: number } | null>(null);

  // Item filter state
  const [itemFilterType, setItemFilterType] = useState<ItemFilterType>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | null>(null);
  const [selectedBoulesSetId, setSelectedBoulesSetId] = useState<string | null>(null);
  const [showItemPickerModal, setShowItemPickerModal] = useState(false);
  const [itemPickerType, setItemPickerType] = useState<'match' | 'challenge' | 'tournament' | 'opponent' | 'partner' | 'terrain' | 'boules'>('match');
  const [itemPickerSearch, setItemPickerSearch] = useState('');


  // Time-filtered base data
  const timeFilteredMatches = filterByTime(matches, timeFilter);
  const timeFilteredChallenges = filterByTime(challenges, timeFilter);

  // Apply item filter on top of time filter
  const filteredMatches = React.useMemo(() => {
    if (itemFilterType === 'match' && selectedMatchId) {
      return timeFilteredMatches.filter(m => m.id === selectedMatchId);
    }
    if (itemFilterType === 'tournament' && selectedTournamentId) {
      return timeFilteredMatches.filter(m => m.tournamentId === selectedTournamentId);
    }
    if (itemFilterType === 'challenge') {
      return [];
    }
    if (itemFilterType === 'opponent' && selectedOpponentId) {
      return timeFilteredMatches.filter(m => m.teamB.players.includes(selectedOpponentId));
    }
    if (itemFilterType === 'partner' && selectedPartnerId) {
      return timeFilteredMatches.filter(m => m.teamA.players.includes(selectedPartnerId));
    }
    if (itemFilterType === 'terrain' && selectedTerrainId) {
      return timeFilteredMatches.filter(m => m.terrainId === selectedTerrainId);
    }
    if (itemFilterType === 'boules' && selectedBoulesSetId) {
      return timeFilteredMatches.filter(m => m.boulesSetId === selectedBoulesSetId);
    }
    return timeFilteredMatches;
  }, [timeFilteredMatches, itemFilterType, selectedMatchId, selectedTournamentId, selectedOpponentId, selectedPartnerId, selectedTerrainId, selectedBoulesSetId]);

  const filteredChallenges = React.useMemo(() => {
    if (itemFilterType === 'challenge' && selectedChallengeId) {
      return timeFilteredChallenges.filter(c => c.id === selectedChallengeId);
    }
    if (itemFilterType === 'opponent' && selectedOpponentId) {
      return timeFilteredChallenges.filter(c => c.mode === '1v1' && c.opponentId === selectedOpponentId);
    }
    if (itemFilterType === 'boules' && selectedBoulesSetId) {
      return timeFilteredChallenges.filter(c => c.boulesSetId === selectedBoulesSetId);
    }
    // When filtering by match, tournament, or partner, don't include challenges in stats
    if (itemFilterType === 'match' || itemFilterType === 'tournament' || itemFilterType === 'partner' || itemFilterType === 'terrain') {
      return [];
    }
    return timeFilteredChallenges;
  }, [timeFilteredChallenges, itemFilterType, selectedChallengeId, selectedMatchId, selectedTournamentId, selectedOpponentId, selectedPartnerId, selectedTerrainId, selectedBoulesSetId]);

  // Active filter label
  const activeFilterLabel = React.useMemo(() => {
    if (itemFilterType === 'match' && selectedMatchId) {
      const m = matches.find(m => m.id === selectedMatchId);
      if (m) {
        const dateStr = new Date(m.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
        return `${m.teamA.playerNames[0]?.split(' ')[0] || '?'} vs ${m.teamB.playerNames[0]?.split(' ')[0] || '?'} (${dateStr})`;
      }
    }
    if (itemFilterType === 'challenge' && selectedChallengeId) {
      const c = challenges.find(c => c.id === selectedChallengeId);
      if (c) {
        const dateStr = new Date(c.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
        return `${t('challengeNames', c.type)} (${dateStr})`;
      }
    }
    if (itemFilterType === 'tournament' && selectedTournamentId) {
      const tour = tournaments.find(t => t.id === selectedTournamentId);
      if (tour) return tour.name;
    }
    if (itemFilterType === 'opponent' && selectedOpponentId) {
      const opp = players.find(p => p.id === selectedOpponentId);
      if (opp) return `vs ${opp.name}`;
    }
    if (itemFilterType === 'partner' && selectedPartnerId) {
      const partner = players.find(p => p.id === selectedPartnerId);
      if (partner) return `${t('statsExtra', 'withPartner')} ${partner.name}`;
    }
    if (itemFilterType === 'terrain' && selectedTerrainId) {
      const terr = terrains.find(te => te.id === selectedTerrainId);
      if (terr) return terr.name;
    }
    if (itemFilterType === 'boules' && selectedBoulesSetId) {
      const bs = boulesSets.find(b => b.id === selectedBoulesSetId);
      if (bs) return bs.name;
    }
    return null;
  }, [itemFilterType, selectedMatchId, selectedChallengeId, selectedTournamentId, selectedOpponentId, selectedPartnerId, selectedTerrainId, selectedBoulesSetId, matches, challenges, tournaments, players, terrains, boulesSets, language]);

  const clearItemFilter = () => {
    setItemFilterType('all');
    setSelectedMatchId(null);
    setSelectedChallengeId(null);
    setSelectedTournamentId(null);
    setSelectedOpponentId(null);
    setSelectedPartnerId(null);
    setSelectedTerrainId(null);
    setSelectedBoulesSetId(null);
  };

  const openItemPicker = (type: 'match' | 'challenge' | 'tournament' | 'opponent' | 'partner' | 'terrain' | 'boules') => {
    setItemPickerType(type);
    setItemPickerSearch('');
    setShowItemPickerModal(true);
  };

  const selectMatch = (id: string) => {
    setItemFilterType('match');
    setSelectedMatchId(id);
    setSelectedChallengeId(null);
    setSelectedTournamentId(null);
    setSelectedOpponentId(null);
    setSelectedPartnerId(null);
    setShowItemPickerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectChallenge = (id: string) => {
    setItemFilterType('challenge');
    setSelectedChallengeId(id);
    setSelectedMatchId(null);
    setSelectedTournamentId(null);
    setSelectedOpponentId(null);
    setSelectedPartnerId(null);
    setShowItemPickerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectTournament = (id: string) => {
    setItemFilterType('tournament');
    setSelectedTournamentId(id);
    setSelectedMatchId(null);
    setSelectedChallengeId(null);
    setSelectedOpponentId(null);
    setSelectedPartnerId(null);
    setShowItemPickerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectOpponent = (id: string) => {
    setItemFilterType('opponent');
    setSelectedOpponentId(id);
    setSelectedMatchId(null);
    setSelectedChallengeId(null);
    setSelectedTournamentId(null);
    setSelectedPartnerId(null);
    setShowItemPickerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectPartner = (id: string) => {
    setItemFilterType('partner');
    setSelectedPartnerId(id);
    setSelectedMatchId(null);
    setSelectedChallengeId(null);
    setSelectedTournamentId(null);
    setSelectedOpponentId(null);
    setSelectedTerrainId(null);
    setShowItemPickerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectTerrain = (id: string) => {
    setItemFilterType('terrain');
    setSelectedTerrainId(id);
    setSelectedMatchId(null);
    setSelectedChallengeId(null);
    setSelectedTournamentId(null);
    setSelectedOpponentId(null);
    setSelectedPartnerId(null);
    setSelectedBoulesSetId(null);
    setShowItemPickerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const selectBoulesSet = (id: string) => {
    setItemFilterType('boules');
    setSelectedBoulesSetId(id);
    setSelectedMatchId(null);
    setSelectedChallengeId(null);
    setSelectedTournamentId(null);
    setSelectedOpponentId(null);
    setSelectedPartnerId(null);
    setSelectedTerrainId(null);
    setShowItemPickerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

// PERFORMANCE STATS — delegated to shared hook
  const performanceStats = usePerformanceStats(filteredMatches);

// TIR STATS — delegated to shared hook
  const tirStats = useTirStats(filteredMatches, filteredChallenges, performanceStats.totalMenes);

// POINT STATS — delegated to shared hook
  const pointStats = usePointStats(filteredMatches, performanceStats.totalMenes);

// ERROR ANALYSIS STATS — delegated to shared hook
  const errorStats = useErrorStats(filteredMatches, tirStats, pointStats, t);

// BOULES SET STATS — delegated to shared hook
  const boulesSetStats = useBoulesSetStats(filteredMatches, filteredChallenges, boulesSets);

// TERRAIN TYPE STATS — delegated to shared hook
  const terrainTypeStats = useTerrainTypeStats(filteredMatches, tournaments);

// PRECISION WORKSHOP STATS — delegated to shared hook
  const precisionWorkshopStats = usePrecisionWorkshopStats(filteredChallenges);

// PROGRESSION DATA — delegated to shared hook
  const progressionData = useProgressionData(matches, progressionFilter);

// TRENDS — delegated to shared hook
  const trends = useTrends(progressionData);

// CHALLENGE PROGRESSION — delegated to shared hook
  const challengeProgressionData = useChallengeProgressionData(challenges, progressionFilter);

// TOURNAMENT PROGRESSION — delegated to shared hook
  const tournamentProgressionData = useTournamentProgressionData(tournaments, matches);

  const hasData = performanceStats.total > 0 || filteredChallenges.length > 0;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header - Glassmorphism Hero */}
      <View style={styles.header}>
        <View style={[styles.headerGradient, { backgroundColor: '#0F172A' }]}>
          {/* Decorative circles for glassmorphism depth */}
          <View style={styles.headerDecoCircle1} />
          <View style={styles.headerDecoCircle2} />
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{t('stats', 'statistics')}</Text>
              <Text style={styles.headerSubtitle}>{performanceStats.total} {t('stats', 'matches')} • {performanceStats.winRate}% {t('stats', 'victories')}</Text>
            </View>
            <View style={styles.headerButtons}>
              <Pressable style={styles.progressionButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowProgressionModal(true); }}>
                <MaterialIcons name="trending-up" size={18} color="#FFF" />
                <Text style={styles.progressionButtonText}>{t('stats', 'progression')}</Text>
              </Pressable>
              <Pressable style={styles.historyButton} onPress={() => router.push('/history')}>
                <MaterialIcons name="history" size={22} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
          </View>
          <View style={styles.headerStatsRow}>
            {[{ val: `${performanceStats.winRate}%`, lbl: t('stats', 'victoriesLabel'), color: '#60A5FA' }, { val: `${tirStats.successRate}%`, lbl: t('stats', 'shotShort'), color: '#93C5FD' }, { val: `${pointStats.successRate}%`, lbl: t('stats', 'pointShort'), color: '#86EFAC' }, { val: `${tirStats.carreauRate}%`, lbl: t('stats', 'carreauxLabel'), color: '#FDE68A' }, { val: pointStats.successQualitiesTotal > 0 ? `${Math.round((pointStats.pointDevantBoule / pointStats.successQualitiesTotal) * 100)}%` : '-', lbl: t('leaderboard', 'devantBouleShort'), color: '#C4B5FD' }].map((s, i) => (<React.Fragment key={i}>{i > 0 ? <View style={styles.headerStatDivider} /> : null}<View style={styles.headerStatItem}><Text style={[styles.headerStatValue, { color: s.color }]}>{s.val}</Text><Text style={styles.headerStatLabel}>{s.lbl}</Text></View></React.Fragment>))}
          </View>
        </View>

        {/* Time Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
          {TIME_FILTERS.map(filter => (
            <Pressable
              key={filter.id}
              style={[styles.filterPill, timeFilter === filter.id && styles.filterPillActive]}
              onPress={() => { Haptics.selectionAsync(); setTimeFilter(filter.id); }}
            >
              <Text style={[styles.filterPillText, timeFilter === filter.id && styles.filterPillTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Item Filter Bar */}
        <View style={styles.itemFilterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemFilterScroll}>
            <Pressable
              style={[styles.itemFilterChip, itemFilterType !== 'all' && styles.itemFilterChipInactive]}
              onPress={() => { Haptics.selectionAsync(); clearItemFilter(); }}
            >
              <MaterialIcons name="select-all" size={14} color={itemFilterType === 'all' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.itemFilterChipText, itemFilterType !== 'all' && styles.itemFilterChipTextInactive]}>
                {t('profile', 'statsFilterAll')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.itemFilterChip, itemFilterType === 'match' ? styles.itemFilterChipMatch : styles.itemFilterChipInactive]}
              onPress={() => { Haptics.selectionAsync(); openItemPicker('match'); }}
            >
              <MaterialIcons name="sports" size={14} color={itemFilterType === 'match' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.itemFilterChipText, itemFilterType !== 'match' && styles.itemFilterChipTextInactive]}>
                {t('profile', 'statsFilterMatch')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.itemFilterChip, itemFilterType === 'challenge' ? styles.itemFilterChipChallenge : styles.itemFilterChipInactive]}
              onPress={() => { Haptics.selectionAsync(); openItemPicker('challenge'); }}
            >
              <MaterialIcons name="flag" size={14} color={itemFilterType === 'challenge' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.itemFilterChipText, itemFilterType !== 'challenge' && styles.itemFilterChipTextInactive]}>
                {t('profile', 'statsFilterChallenge')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.itemFilterChip, itemFilterType === 'tournament' ? styles.itemFilterChipTournament : styles.itemFilterChipInactive]}
              onPress={() => { Haptics.selectionAsync(); openItemPicker('tournament'); }}
            >
              <MaterialIcons name="emoji-events" size={14} color={itemFilterType === 'tournament' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.itemFilterChipText, itemFilterType !== 'tournament' && styles.itemFilterChipTextInactive]}>
                {t('profile', 'statsFilterTournament')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.itemFilterChip, itemFilterType === 'opponent' ? styles.itemFilterChipOpponent : styles.itemFilterChipInactive]}
              onPress={() => { Haptics.selectionAsync(); openItemPicker('opponent'); }}
            >
              <MaterialIcons name="people" size={14} color={itemFilterType === 'opponent' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.itemFilterChipText, itemFilterType !== 'opponent' && styles.itemFilterChipTextInactive]}>
                {t('profile', 'statsFilterOpponent')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.itemFilterChip, itemFilterType === 'partner' ? styles.itemFilterChipPartner : styles.itemFilterChipInactive]}
              onPress={() => { Haptics.selectionAsync(); openItemPicker('partner'); }}
            >
              <MaterialIcons name="group" size={14} color={itemFilterType === 'partner' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.itemFilterChipText, itemFilterType !== 'partner' && styles.itemFilterChipTextInactive]}>
                {t('profile', 'statsFilterPartner')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.itemFilterChip, itemFilterType === 'terrain' ? styles.itemFilterChipTerrain : styles.itemFilterChipInactive]}
              onPress={() => { Haptics.selectionAsync(); openItemPicker('terrain'); }}
            >
              <MaterialIcons name="sports-soccer" size={14} color={itemFilterType === 'terrain' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.itemFilterChipText, itemFilterType !== 'terrain' && styles.itemFilterChipTextInactive]}>
                {t('profile', 'statsFilterTerrain')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.itemFilterChip, itemFilterType === 'boules' ? styles.itemFilterChipBoules : styles.itemFilterChipInactive]}
              onPress={() => { Haptics.selectionAsync(); openItemPicker('boules'); }}
            >
              <MaterialIcons name="sports-baseball" size={14} color={itemFilterType === 'boules' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.itemFilterChipText, itemFilterType !== 'boules' && styles.itemFilterChipTextInactive]}>
                {t('profile', 'statsFilterBoules')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Active Filter Indicator */}
        {activeFilterLabel && (
          <View style={styles.activeFilterBanner}>
            <MaterialIcons 
              name={itemFilterType === 'match' ? 'sports' : itemFilterType === 'challenge' ? 'flag' : itemFilterType === 'opponent' ? 'people' : itemFilterType === 'partner' ? 'group' : itemFilterType === 'terrain' ? 'sports-soccer' : itemFilterType === 'boules' ? 'sports-baseball' : 'emoji-events'} 
              size={14} 
              color={itemFilterType === 'match' ? theme.tirColor : itemFilterType === 'challenge' ? theme.accent : itemFilterType === 'opponent' ? theme.pointColor : itemFilterType === 'partner' ? theme.success : itemFilterType === 'terrain' ? '#8B5CF6' : itemFilterType === 'boules' ? '#D97706' : theme.carreauColor} 
            />
            <Text style={styles.activeFilterText} numberOfLines={1}>{activeFilterLabel}</Text>
            <Pressable style={styles.activeFilterClear} onPress={clearItemFilter}>
              <MaterialIcons name="close" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Category Tabs - Glassmorphism */}
        <View style={styles.categoryTabs}>
          {CATEGORY_TABS.map(tab => {
            const isActive = category === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[styles.categoryTab, isActive && [styles.categoryTabActive, { backgroundColor: tab.color + '12', borderColor: tab.color + '30' }]]}
                onPress={() => { Haptics.selectionAsync(); setCategory(tab.id); }}
              >
                <View style={[styles.categoryTabIconBg, isActive && { backgroundColor: tab.color + '18' }]}>
                  <MaterialIcons name={tab.icon as any} size={16} color={isActive ? tab.color : theme.textMuted} />
                </View>
                <Text style={[styles.categoryTabText, isActive && [styles.categoryTabTextActive, { color: tab.color }]]}>
                  {tab.label}
                </Text>
                {isActive ? <View style={[styles.categoryTabDot, { backgroundColor: tab.color }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }, isTablet && styles.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
      >
        <SponsorBanner page="stats" />

        {!hasData ? (
          <View style={styles.emptyState}>
            <Image source={require('@/assets/images/empty-stats.png')} style={styles.emptyImage} contentFit="contain" />
            <Text style={styles.emptyTitle}>{t('stats','noStatsYet')}</Text>
            <Text style={styles.emptyText}>{t('stats','playToSee')}</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/match/new')}>
              <MaterialIcons name="sports" size={18} color="#FFF" />
              <Text style={styles.emptyButtonText}>{t('stats','newMatch')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* PERFORMANCE */}
            {category === 'performance' && (
              <PerformanceSection
                t={t}
                language={language}
                isTablet={isTablet}
                performanceStats={performanceStats}
                tirStats={tirStats}
                pointStats={pointStats}
                terrainTypeStats={terrainTypeStats}
                boulesSetStats={boulesSetStats}
                filteredChallenges={filteredChallenges}
                itemFilterType={itemFilterType}
                formatDuration={formatDuration}
                selectBoulesSet={selectBoulesSet}
              />
            )}

            {/* TIR */}
            {category === 'tir' && (
              <TirSection
                t={t}
                isTablet={isTablet}
                tirStats={tirStats}
                terrainTypeStats={terrainTypeStats}
                precisionWorkshopStats={precisionWorkshopStats}
              />
            )}

            {/* POINT */}
            {category === 'point' && (
              <PointSection
                t={t}
                isTablet={isTablet}
                pointStats={pointStats}
                terrainTypeStats={terrainTypeStats}
                filteredChallenges={filteredChallenges}
                itemFilterType={itemFilterType}
              />
            )}

            {/* ERRORS */}
            {category === 'errors' && (
              <ErrorsSection
                t={t}
                isTablet={isTablet}
                errorStats={errorStats}
                tirStats={tirStats}
                terrainTypeStats={terrainTypeStats}
              />
            )}
          </>
        )}

      </ScrollView>

      {/* Enhanced Progression Modal */}
      <Modal visible={showProgressionModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProgressionModal(false)}>
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.progressionModalHeader}>
            <View style={styles.progressionModalHeaderTop}>
              <View>
                <Text style={styles.progressionModalTitle}>{t('stats', 'progressionTitle')}</Text>
                <Text style={styles.progressionModalSubtitle}>{t('stats', 'performanceEvolution')}</Text>
              </View>
              <Pressable style={styles.progressionModalCloseBtn} onPress={() => setShowProgressionModal(false)}>
                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressionFilterScroll}>
              {PROGRESSION_FILTERS.map(filter => (
                <Pressable key={filter.id} style={[styles.progressionFilterPill, progressionFilter === filter.id && styles.progressionFilterPillActive]} onPress={() => { Haptics.selectionAsync(); setProgressionFilter(filter.id); setChartTooltip(null); }}>
                  <Text style={[styles.progressionFilterText, progressionFilter === filter.id && styles.progressionFilterTextActive]}>{filter.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={[styles.modalScrollContent, isTablet && styles.modalScrollContentTablet]} showsVerticalScrollIndicator={false}>
            {progressionData.weeklyData.length > 0 ? (
              <>
                <View style={[styles.trendCardsRow, isTablet && styles.trendCardsRowTablet]}>
                  <View style={[styles.trendCard, { borderLeftColor: theme.primary }, isTablet && styles.trendCardTablet]}>
                    <View style={styles.trendCardHeader}><MaterialIcons name="emoji-events" size={isTablet ? 22 : 18} color={theme.primary} /><MaterialIcons name={trends.winRate === 'up' ? 'trending-up' : trends.winRate === 'down' ? 'trending-down' : 'remove'} size={isTablet ? 20 : 16} color={trends.winRate === 'up' ? theme.success : trends.winRate === 'down' ? theme.error : theme.textMuted} /></View>
                    <Text style={[styles.trendCardValue, isTablet && styles.trendCardValueTablet]}>{performanceStats.winRate}%</Text>
                    <Text style={[styles.trendCardLabel, isTablet && styles.trendCardLabelTablet]}>{t('stats', 'victoriesLabel')}</Text>
                  </View>
                  <View style={[styles.trendCard, { borderLeftColor: theme.tirColor }, isTablet && styles.trendCardTablet]}>
                    <View style={styles.trendCardHeader}><MaterialIcons name="gps-fixed" size={isTablet ? 22 : 18} color={theme.tirColor} /><MaterialIcons name={trends.tirRate === 'up' ? 'trending-up' : trends.tirRate === 'down' ? 'trending-down' : 'remove'} size={isTablet ? 20 : 16} color={trends.tirRate === 'up' ? theme.success : trends.tirRate === 'down' ? theme.error : theme.textMuted} /></View>
                    <Text style={[styles.trendCardValue, isTablet && styles.trendCardValueTablet]}>{tirStats.successRate}%</Text>
                    <Text style={[styles.trendCardLabel, isTablet && styles.trendCardLabelTablet]}>{t('stats', 'shotShort')}</Text>
                  </View>
                  <View style={[styles.trendCard, { borderLeftColor: theme.pointColor }, isTablet && styles.trendCardTablet]}>
                    <View style={styles.trendCardHeader}><MaterialIcons name="adjust" size={isTablet ? 22 : 18} color={theme.pointColor} /><MaterialIcons name={trends.pointRate === 'up' ? 'trending-up' : trends.pointRate === 'down' ? 'trending-down' : 'remove'} size={isTablet ? 20 : 16} color={trends.pointRate === 'up' ? theme.success : trends.pointRate === 'down' ? theme.error : theme.textMuted} /></View>
                    <Text style={[styles.trendCardValue, isTablet && styles.trendCardValueTablet]}>{pointStats.successRate}%</Text>
                    <Text style={[styles.trendCardLabel, isTablet && styles.trendCardLabelTablet]}>{t('stats', 'pointageLabel')}</Text>
                  </View>
                </View>
                <View style={isTablet ? styles.modalTabletRow : undefined}>
                {/* Win Rate Evolution */}
                <View style={[styles.progressionSection, isTablet && styles.modalTabletHalf]}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.primary + '15' }]}>
                      <MaterialIcons name="emoji-events" size={20} color={theme.primary} />
                    </View>
                    <View>
                      <Text style={[styles.progressionSectionTitle, isTablet && styles.progressionSectionTitleTablet]}>{t('stats', 'winRateLabel')}</Text>
                      <Text style={[styles.progressionSectionSubtitle, isTablet && styles.progressionSectionSubtitleTablet]}>{progressionData.weeklyData.reduce((sum, d) => sum + d.matches, 0)} {t('stats', 'gamesUnit')}</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    <Svg width={modalChartWidth} height={modalChartHeight}>
                      {[0, 50, 100].map((v, i) => (
                        <G key={i}>
                          <Line x1="35" y1={(modalChartHeight - 20) - (v / 100) * (modalChartHeight - 40)} x2={modalChartWidth} y2={(modalChartHeight - 20) - (v / 100) * (modalChartHeight - 40)} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                          <SvgText x="30" y={(modalChartHeight - 15) - (v / 100) * (modalChartHeight - 40)} fontSize={isTablet ? '12' : '10'} fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                        </G>
                      ))}
                      {progressionData.weeklyData.map((data, i) => {
                        const x = 45 + (i * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1)));
                        const y = (modalChartHeight - 20) - (data.winRate / 100) * (modalChartHeight - 40);
                        const prevData = progressionData.weeklyData[i - 1];
                        const prevX = prevData ? 45 + ((i - 1) * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1))) : x;
                        const prevY = prevData ? (modalChartHeight - 20) - (prevData.winRate / 100) * (modalChartHeight - 40) : y;
                        return (
                          <G key={i}>
                            {i > 0 && <Line x1={prevX} y1={prevY} x2={x} y2={y} stroke={theme.primary} strokeWidth="2.5" />}
                            <Circle cx={x} cy={y} r={20} fill="transparent" onPress={() => { Haptics.selectionAsync(); setChartTooltip(chartTooltip?.chart === 'winRate' && chartTooltip?.index === i ? null : { chart: 'winRate', index: i }); }} />
                            <Circle cx={x} cy={y} r={isTablet ? 6 : 5} fill={chartTooltip?.chart === 'winRate' && chartTooltip?.index === i ? '#FFF' : theme.primary} stroke={chartTooltip?.chart === 'winRate' && chartTooltip?.index === i ? theme.primary : 'none'} strokeWidth={2} />
                            {data.matches > 0 && !(chartTooltip?.chart === 'winRate' && chartTooltip?.index === i) && <SvgText x={x} y={y - 10} fontSize={isTablet ? '11' : '9'} fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.winRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
                    {chartTooltip?.chart === 'winRate' && chartTooltip.index < progressionData.weeklyData.length && (() => {
                      const d = progressionData.weeklyData[chartTooltip.index];
                      const tx = 45 + (chartTooltip.index * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1)));
                      const ty = (modalChartHeight - 20) - (d.winRate / 100) * (modalChartHeight - 40);
                      return (
                        <Pressable style={[styles.chartTooltip, { left: Math.max(4, Math.min(tx - 68, modalChartWidth - 140)), top: Math.max(0, ty - 68) }]} onPress={() => setChartTooltip(null)}>
                          <Text style={styles.chartTooltipTitle}>{d.week}</Text>
                          <Text style={styles.chartTooltipRow}>{d.matches} {t('stats', 'gamesUnit')} \u2022 {d.wins}V-{d.matches - d.wins}D</Text>
                          <Text style={[styles.chartTooltipValue, { color: theme.primary }]}>{d.winRate}%</Text>
                        </Pressable>
                      );
                    })()}
                  </View>
                </View>

                {/* Tir Evolution */}
                <View style={[styles.progressionSection, isTablet && styles.modalTabletHalf]}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.tirColor + '15' }]}>
                      <MaterialIcons name="gps-fixed" size={20} color={theme.tirColor} />
                    </View>
                    <View>
                      <Text style={[styles.progressionSectionTitle, isTablet && styles.progressionSectionTitleTablet]}>{t('stats', 'shotRateLabel')}</Text>
                      <Text style={[styles.progressionSectionSubtitle, isTablet && styles.progressionSectionSubtitleTablet]}>{progressionData.weeklyData.reduce((sum, d) => sum + d.tirTotal, 0)} {t('stats', 'shotsUnit')}</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    <Svg width={modalChartWidth} height={modalChartHeight}>
                      {[0, 50, 100].map((v, i) => (
                        <G key={i}>
                          <Line x1="35" y1={(modalChartHeight - 20) - (v / 100) * (modalChartHeight - 40)} x2={modalChartWidth} y2={(modalChartHeight - 20) - (v / 100) * (modalChartHeight - 40)} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                          <SvgText x="30" y={(modalChartHeight - 15) - (v / 100) * (modalChartHeight - 40)} fontSize={isTablet ? '12' : '10'} fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                        </G>
                      ))}
                      {progressionData.weeklyData.map((data, i) => {
                        const x = 45 + (i * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1)));
                        const y = (modalChartHeight - 20) - (data.tirRate / 100) * (modalChartHeight - 40);
                        const prevData = progressionData.weeklyData[i - 1];
                        const prevX = prevData ? 45 + ((i - 1) * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1))) : x;
                        const prevY = prevData ? (modalChartHeight - 20) - (prevData.tirRate / 100) * (modalChartHeight - 40) : y;
                        return (
                          <G key={i}>
                            {i > 0 && <Line x1={prevX} y1={prevY} x2={x} y2={y} stroke={theme.tirColor} strokeWidth="2.5" />}
                            <Circle cx={x} cy={y} r={20} fill="transparent" onPress={() => { Haptics.selectionAsync(); setChartTooltip(chartTooltip?.chart === 'tir' && chartTooltip?.index === i ? null : { chart: 'tir', index: i }); }} />
                            <Circle cx={x} cy={y} r={isTablet ? 6 : 5} fill={chartTooltip?.chart === 'tir' && chartTooltip?.index === i ? '#FFF' : theme.tirColor} stroke={chartTooltip?.chart === 'tir' && chartTooltip?.index === i ? theme.tirColor : 'none'} strokeWidth={2} />
                            {data.tirTotal > 0 && !(chartTooltip?.chart === 'tir' && chartTooltip?.index === i) && <SvgText x={x} y={y - 10} fontSize={isTablet ? '11' : '9'} fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.tirRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
                    {chartTooltip?.chart === 'tir' && chartTooltip.index < progressionData.weeklyData.length && (() => {
                      const d = progressionData.weeklyData[chartTooltip.index];
                      const tx = 45 + (chartTooltip.index * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1)));
                      const ty = (modalChartHeight - 20) - (d.tirRate / 100) * (modalChartHeight - 40);
                      return (
                        <Pressable style={[styles.chartTooltip, { left: Math.max(4, Math.min(tx - 68, modalChartWidth - 140)), top: Math.max(0, ty - 68) }]} onPress={() => setChartTooltip(null)}>
                          <Text style={styles.chartTooltipTitle}>{d.week}</Text>
                          <Text style={styles.chartTooltipRow}>{d.tirSuccess}/{d.tirTotal} {t('stats', 'shotsUnit')}</Text>
                          <Text style={[styles.chartTooltipValue, { color: theme.tirColor }]}>{d.tirRate}%</Text>
                        </Pressable>
                      );
                    })()}
                  </View>
                </View>
                </View>

                {/* Charts Row 2: Point + Carreaux */}
                <View style={isTablet ? styles.modalTabletRow : undefined}>
                {/* Point Evolution */}
                <View style={[styles.progressionSection, isTablet && styles.modalTabletHalf]}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.pointColor + '15' }]}>
                      <MaterialIcons name="adjust" size={20} color={theme.pointColor} />
                    </View>
                    <View>
                      <Text style={[styles.progressionSectionTitle, isTablet && styles.progressionSectionTitleTablet]}>{t('stats', 'pointRateLabel')}</Text>
                      <Text style={[styles.progressionSectionSubtitle, isTablet && styles.progressionSectionSubtitleTablet]}>{progressionData.weeklyData.reduce((sum, d) => sum + d.pointTotal, 0)} {t('stats', 'pointsUnit')}</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    <Svg width={modalChartWidth} height={modalChartHeight}>
                      {[0, 50, 100].map((v, i) => (
                        <G key={i}>
                          <Line x1="35" y1={(modalChartHeight - 20) - (v / 100) * (modalChartHeight - 40)} x2={modalChartWidth} y2={(modalChartHeight - 20) - (v / 100) * (modalChartHeight - 40)} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                          <SvgText x="30" y={(modalChartHeight - 15) - (v / 100) * (modalChartHeight - 40)} fontSize={isTablet ? '12' : '10'} fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                        </G>
                      ))}
                      {progressionData.weeklyData.map((data, i) => {
                        const x = 45 + (i * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1)));
                        const y = (modalChartHeight - 20) - (data.pointRate / 100) * (modalChartHeight - 40);
                        const prevData = progressionData.weeklyData[i - 1];
                        const prevX = prevData ? 45 + ((i - 1) * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1))) : x;
                        const prevY = prevData ? (modalChartHeight - 20) - (prevData.pointRate / 100) * (modalChartHeight - 40) : y;
                        return (
                          <G key={i}>
                            {i > 0 && <Line x1={prevX} y1={prevY} x2={x} y2={y} stroke={theme.pointColor} strokeWidth="2.5" />}
                            <Circle cx={x} cy={y} r={20} fill="transparent" onPress={() => { Haptics.selectionAsync(); setChartTooltip(chartTooltip?.chart === 'point' && chartTooltip?.index === i ? null : { chart: 'point', index: i }); }} />
                            <Circle cx={x} cy={y} r={isTablet ? 6 : 5} fill={chartTooltip?.chart === 'point' && chartTooltip?.index === i ? '#FFF' : theme.pointColor} stroke={chartTooltip?.chart === 'point' && chartTooltip?.index === i ? theme.pointColor : 'none'} strokeWidth={2} />
                            {data.pointTotal > 0 && !(chartTooltip?.chart === 'point' && chartTooltip?.index === i) && <SvgText x={x} y={y - 10} fontSize={isTablet ? '11' : '9'} fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.pointRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
                    {chartTooltip?.chart === 'point' && chartTooltip.index < progressionData.weeklyData.length && (() => {
                      const d = progressionData.weeklyData[chartTooltip.index];
                      const tx = 45 + (chartTooltip.index * ((modalChartWidth - 45) / Math.max(progressionData.weeklyData.length - 1, 1)));
                      const ty = (modalChartHeight - 20) - (d.pointRate / 100) * (modalChartHeight - 40);
                      return (
                        <Pressable style={[styles.chartTooltip, { left: Math.max(4, Math.min(tx - 68, modalChartWidth - 140)), top: Math.max(0, ty - 68) }]} onPress={() => setChartTooltip(null)}>
                          <Text style={styles.chartTooltipTitle}>{d.week}</Text>
                          <Text style={styles.chartTooltipRow}>{d.pointSuccess}/{d.pointTotal} {t('stats', 'pointsUnit')}</Text>
                          <Text style={[styles.chartTooltipValue, { color: theme.pointColor }]}>{d.pointRate}%</Text>
                        </Pressable>
                      );
                    })()}
                  </View>
                </View>

                {/* Carreaux Bar Chart */}
                <View style={[styles.progressionSection, isTablet && styles.modalTabletHalf]}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                      <MaterialIcons name="stars" size={20} color={theme.carreauColor} />
                    </View>
                    <View>
                      <Text style={[styles.progressionSectionTitle, isTablet && styles.progressionSectionTitleTablet]}>{t('stats', 'carreauxLabel')}</Text>
                      <Text style={[styles.progressionSectionSubtitle, isTablet && styles.progressionSectionSubtitleTablet]}>{progressionData.weeklyData.reduce((sum, d) => sum + d.carreaux, 0)} {t('stats', 'inTotal')}</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    <Svg width={modalChartWidth} height={modalBarChartHeight}>
                      {progressionData.weeklyData.map((data, i) => {
                        const barWidth = Math.max((modalChartWidth - 40) / progressionData.weeklyData.length - 6, 8);
                        const x = 40 + (i * ((modalChartWidth - 16) / progressionData.weeklyData.length));
                        const maxCarreaux = Math.max(...progressionData.weeklyData.map(d => d.carreaux), 1);
                        const barAreaH = modalBarChartHeight - 50;
                        const barHeight = Math.max((data.carreaux / maxCarreaux) * barAreaH, data.carreaux > 0 ? 4 : 0);
                        return (
                          <G key={i}>
                            <Rect x={x} y={(modalBarChartHeight - 30) - barHeight} width={barWidth} height={Math.max(barHeight, 20)} fill={chartTooltip?.chart === 'carreaux' && chartTooltip?.index === i ? theme.carreauColor + '60' : 'transparent'} rx="3" onPress={() => { Haptics.selectionAsync(); setChartTooltip(chartTooltip?.chart === 'carreaux' && chartTooltip?.index === i ? null : { chart: 'carreaux', index: i }); }} />
                            <Rect x={x} y={(modalBarChartHeight - 30) - barHeight} width={barWidth} height={barHeight} fill={theme.carreauColor} rx="3" />
                            {data.carreaux > 0 && <SvgText x={x + barWidth / 2} y={(modalBarChartHeight - 35) - barHeight} fontSize={isTablet ? '12' : '10'} fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.carreaux}</SvgText>}
                            <SvgText x={x + barWidth / 2} y={modalBarChartHeight - 10} fontSize={isTablet ? '10' : '8'} fill={theme.textMuted} textAnchor="middle">{data.week}</SvgText>
                          </G>
                        );
                      })}
                    </Svg>
                    {chartTooltip?.chart === 'carreaux' && chartTooltip.index < progressionData.weeklyData.length && (() => {
                      const d = progressionData.weeklyData[chartTooltip.index];
                      const barWidth = Math.max((modalChartWidth - 40) / progressionData.weeklyData.length - 6, 8);
                      const tx = 40 + (chartTooltip.index * ((modalChartWidth - 16) / progressionData.weeklyData.length)) + barWidth / 2;
                      const maxC = Math.max(...progressionData.weeklyData.map(dd => dd.carreaux), 1);
                      const barH = Math.max((d.carreaux / maxC) * (modalBarChartHeight - 50), 4);
                      const ty = (modalBarChartHeight - 30) - barH;
                      return (
                        <Pressable style={[styles.chartTooltip, { left: Math.max(4, Math.min(tx - 68, modalChartWidth - 140)), top: Math.max(0, ty - 68) }]} onPress={() => setChartTooltip(null)}>
                          <Text style={styles.chartTooltipTitle}>{d.week}</Text>
                          <Text style={styles.chartTooltipRow}>{d.matches} {t('stats', 'gamesUnit')}</Text>
                          <Text style={[styles.chartTooltipValue, { color: theme.carreauColor }]}>{d.carreaux} {t('stats', 'carreauxLabel')}</Text>
                        </Pressable>
                      );
                    })()}
                  </View>
                </View>
                </View>

                {/* Challenge Progression */}
                {challengeProgressionData.hasData && (
                  <View style={styles.progressionSection}>
                    <View style={styles.progressionSectionHeader}>
                      <View style={[styles.progressionSectionIcon, { backgroundColor: theme.accent + '15' }]}>
                        <MaterialIcons name="flag" size={20} color={theme.accent} />
                      </View>
                      <View>
                        <Text style={[styles.progressionSectionTitle, isTablet && styles.progressionSectionTitleTablet]}>{t('stats', 'challengeProgressionTitle')}</Text>
                        <Text style={[styles.progressionSectionSubtitle, isTablet && styles.progressionSectionSubtitleTablet]}>{t('stats', 'challengeProgressionSubtitle')}</Text>
                      </View>
                    </View>
                    <View style={styles.chartContainer}>
                      <Svg width={modalChartWidth} height={modalChartHeight + 20}>
                        {[0, 50, 100].map((v, i) => (
                          <G key={i}>
                            <Line x1="35" y1={(modalChartHeight - 20) - (v / 100) * (modalChartHeight - 40)} x2={modalChartWidth} y2={(modalChartHeight - 20) - (v / 100) * (modalChartHeight - 40)} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                            <SvgText x="30" y={(modalChartHeight - 15) - (v / 100) * (modalChartHeight - 40)} fontSize={isTablet ? '12' : '10'} fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                          </G>
                        ))}
                        {[
                          { type: '10_tirs', color: '#F97316' },
                          { type: '10_tirs_sautee', color: '#3B82F6' },
                          { type: 'precision', color: '#F59E0B' },
                        ].map(({ type, color }) => {
                          const dataPoints = challengeProgressionData.weeklyData.map((w, i) => ({
                            x: 45 + (i * ((modalChartWidth - 45) / Math.max(challengeProgressionData.weeklyData.length - 1, 1))),
                            y: (modalChartHeight - 20) - (w.byType[type].avgRate / 100) * (modalChartHeight - 40),
                            hasData: w.byType[type].count > 0,
                            rate: w.byType[type].avgRate,
                          }));
                          return (
                            <G key={type}>
                              {dataPoints.map((pt, i) => {
                                if (i === 0 || !pt.hasData) return null;
                                const prev = dataPoints[i - 1];
                                if (!prev.hasData) return null;
                                return <Line key={`l-${i}`} x1={prev.x} y1={prev.y} x2={pt.x} y2={pt.y} stroke={color} strokeWidth="2.5" />;
                              })}
                              {dataPoints.map((pt, i) => {
                                if (!pt.hasData) return null;
                                return (
                                  <G key={`d-${i}`}>
                                    <Circle cx={pt.x} cy={pt.y} r={isTablet ? 5 : 4} fill={color} />
                                    <SvgText x={pt.x} y={pt.y - 10} fontSize={isTablet ? '11' : '9'} fill={color} textAnchor="middle" fontWeight="600">{pt.rate}%</SvgText>
                                  </G>
                                );
                              })}
                            </G>
                          );
                        })}
                      </Svg>
                    </View>
                    {/* Legend */}
                    <View style={styles.challengeProgLegend}>
                      {[
                        { nameKey: 'tenShots', color: '#F97316' },
                        { nameKey: 'tenShotsLob', color: '#3B82F6' },
                        { nameKey: 'precision', color: '#F59E0B' },
                      ].map(({ nameKey, color }) => (
                        <View key={nameKey} style={styles.challengeProgLegendItem}>
                          <View style={[styles.challengeProgLegendDot, { backgroundColor: color }]} />
                          <Text style={styles.challengeProgLegendText}>{t('challenge', nameKey)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {tournamentProgressionData.hasData?<View style={styles.progressionSection}><View style={styles.progressionSectionHeader}><View style={[styles.progressionSectionIcon,{backgroundColor:theme.carreauColor+'15'}]}><MaterialIcons name="emoji-events" size={20} color={theme.carreauColor}/></View><View><Text style={[styles.progressionSectionTitle,isTablet&&styles.progressionSectionTitleTablet]}>{t('stats','tournamentProgressionTitle')}</Text><Text style={[styles.progressionSectionSubtitle,isTablet&&styles.progressionSectionSubtitleTablet]}>{tournamentProgressionData.items.length} {t('palmares','tournois')}</Text></View></View><View style={styles.chartContainer}><Svg width={modalChartWidth} height={modalChartHeight+30}>{[0,50,100].map((v,i)=>(<G key={i}><Line x1="35" y1={(modalChartHeight-20)-(v/100)*(modalChartHeight-40)} x2={modalChartWidth} y2={(modalChartHeight-20)-(v/100)*(modalChartHeight-40)} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4"/><SvgText x="30" y={(modalChartHeight-15)-(v/100)*(modalChartHeight-40)} fontSize={isTablet?'12':'10'} fill={theme.textMuted} textAnchor="end">{v}%</SvgText></G>))}{tournamentProgressionData.items.map((it,i)=>{const x=45+(i*((modalChartWidth-45)/Math.max(tournamentProgressionData.items.length-1,1)));const y=(modalChartHeight-20)-(it.winRate/100)*(modalChartHeight-40);const p=tournamentProgressionData.items[i-1];const px=p?45+((i-1)*((modalChartWidth-45)/Math.max(tournamentProgressionData.items.length-1,1))):x;const py=p?(modalChartHeight-20)-(p.winRate/100)*(modalChartHeight-40):y;return(<G key={i}>{i>0?<Line x1={px} y1={py} x2={x} y2={y} stroke={theme.carreauColor} strokeWidth="2.5"/>:null}<Circle cx={x} cy={y} r={6} fill={it.resultColor} stroke="#FFF" strokeWidth={2}/>{it.matches>0?<SvgText x={x} y={y-12} fontSize="9" fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{it.winRate}%</SvgText>:null}</G>);})}</Svg></View></View>:null}
                {/* Summary Table */}
                <View style={styles.progressionSection}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.textSecondary + '15' }]}>
                      <MaterialIcons name="table-chart" size={20} color={theme.textSecondary} />
                    </View>
                    <Text style={[styles.progressionSectionTitle, isTablet && styles.progressionSectionTitleTablet]}>{t('stats', 'summaryLabel')}</Text>
                  </View>
                  <View style={styles.summaryTable}>
                    <View style={styles.summaryHeader}>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1.2 }]}>{progressionData.useMonthly ? t('statsExtra', 'monthLabel') : t('stats', 'weekShort')}</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>{t('stats', 'gamesShort')}</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>{t('stats', 'winsShort')}</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>{t('stats', 'shotShort')}</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>{t('stats', 'pointShort')}</Text>
                    </View>
                    {progressionData.weeklyData.filter(d => d.matches > 0).slice(-12).map((data, i) => (
                      <View key={i} style={[styles.summaryRow, i % 2 === 0 && styles.summaryRowAlt]}>
                        <Text style={[styles.summaryCell, { flex: 1.2 }]}>{data.week}</Text>
                        <Text style={[styles.summaryCell, { flex: 1 }]}>{data.matches}</Text>
                        <Text style={[styles.summaryCell, { flex: 1, color: theme.primary, fontWeight: '600' }]}>{data.winRate}%</Text>
                        <Text style={[styles.summaryCell, { flex: 1, color: theme.tirColor, fontWeight: '600' }]}>{data.tirRate}%</Text>
                        <Text style={[styles.summaryCell, { flex: 1, color: theme.pointColor, fontWeight: '600' }]}>{data.pointRate}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.noProgressionData}>
                <MaterialIcons name="show-chart" size={64} color={theme.textMuted} />
                <Text style={styles.noProgressionTitle}>{t('stats', 'notEnoughDataLabel')}</Text>
                <Text style={styles.noProgressionText}>{t('stats', 'playMoreMatchesLabel')}</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      {/* Item Picker Modal */}
      <Modal visible={showItemPickerModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowItemPickerModal(false)}>
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {itemPickerType === 'match' ? t('profile', 'selectMatch') : itemPickerType === 'challenge' ? t('profile', 'selectChallenge') : itemPickerType === 'opponent' ? t('profile', 'selectOpponent') : itemPickerType === 'partner' ? t('profile', 'selectPartner') : itemPickerType === 'terrain' ? t('profile', 'selectTerrain') : itemPickerType === 'boules' ? t('profile', 'selectBoulesSet') : t('profile', 'selectTournament')}
              </Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={() => setShowItemPickerModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.pickerSearchContainer}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.pickerSearchInput}
              value={itemPickerSearch}
              onChangeText={setItemPickerSearch}
              placeholder={t('common', 'search') + '...'}
              placeholderTextColor={theme.textMuted}
            />
            {itemPickerSearch.length > 0 && (
              <Pressable onPress={() => setItemPickerSearch('')}>
                <MaterialIcons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Match Picker */}
          {itemPickerType === 'match' && (() => {
            const search = itemPickerSearch.toLowerCase();
            const items = timeFilteredMatches.filter(m => {
              if (!search) return true;
              const allNames = [...m.teamA.playerNames, ...m.teamB.playerNames].join(' ').toLowerCase();
              const modeName = m.mode.toLowerCase();
              const formatName = m.format.toLowerCase();
              const tName = (m.tournamentName || '').toLowerCase();
              return allNames.includes(search) || modeName.includes(search) || formatName.includes(search) || tName.includes(search);
            });
            return items.length > 0 ? (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                renderItem={({ item: m }) => {
                  const dateStr = new Date(m.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                  const isWin = m.winner === 'A';
                  const isSelected = selectedMatchId === m.id;
                  return (
                    <Pressable
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => selectMatch(m.id)}
                    >
                      <View style={[styles.pickerItemIndicator, { backgroundColor: isWin ? theme.success : theme.error }]} />
                      <View style={styles.pickerItemContent}>
                        <View style={styles.pickerItemRow}>
                          <Text style={styles.pickerItemTitle} numberOfLines={1}>
                            {m.teamA.playerNames.join(', ')}
                          </Text>
                          <Text style={[styles.pickerItemScore, { color: isWin ? theme.success : theme.error }]}>
                            {m.teamA.score} - {m.teamB.score}
                          </Text>
                        </View>
                        <Text style={styles.pickerItemSubtitle} numberOfLines={1}>
                          vs {m.teamB.playerNames.join(', ')}
                        </Text>
                        <View style={styles.pickerItemMeta}>
                          <Text style={styles.pickerItemMetaText}>{dateStr}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{t('formats', m.format)}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{m.mode === 'Tournoi' ? (m.tournamentName || t('modes', 'tournament')) : t('modes', 'training')}</Text>
                        </View>
                      </View>
                      {isSelected && <MaterialIcons name="check-circle" size={22} color={theme.primary} />}
                    </Pressable>
                  );
                }}
              />
            ) : (
              <View style={styles.pickerEmpty}>
                <MaterialIcons name="sports" size={48} color={theme.textMuted} />
                <Text style={styles.pickerEmptyText}>{t('profile', 'noMatchesAvailable')}</Text>
              </View>
            );
          })()}

          {/* Challenge Picker */}
          {itemPickerType === 'challenge' && (() => {
            const search = itemPickerSearch.toLowerCase();
            const items = timeFilteredChallenges.filter(c => {
              if (!search) return true;
              const typeName = (t('challengeNames', c.type) || c.type).toLowerCase();
              const playerName = (c.playerName || '').toLowerCase();
              const oppName = (c.opponentName || '').toLowerCase();
              return typeName.includes(search) || playerName.includes(search) || oppName.includes(search);
            });
            return items.length > 0 ? (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                renderItem={({ item: c }) => {
                  const dateStr = new Date(c.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                  const isSelected = selectedChallengeId === c.id;
                  const successLabel = c.type === 'precision' 
                    ? `${c.totalPoints || 0}/${c.maxPoints || 100} pts` 
                    : `${c.successCount || 0}/${c.totalShots || 10}`;
                  return (
                    <Pressable
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => selectChallenge(c.id)}
                    >
                      <View style={[styles.pickerItemIndicator, { backgroundColor: theme.accent }]} />
                      <View style={styles.pickerItemContent}>
                        <View style={styles.pickerItemRow}>
                          <Text style={styles.pickerItemTitle}>{t('challengeNames', c.type)}</Text>
                          <Text style={[styles.pickerItemScore, { color: theme.accent }]}>{successLabel}</Text>
                        </View>
                        <View style={styles.pickerItemMeta}>
                          <Text style={styles.pickerItemMetaText}>{dateStr}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{c.mode === '1v1' ? `vs ${c.opponentName || '?'}` : 'Solo'}</Text>
                          {c.carreauCount ? <><View style={styles.pickerItemDot} /><Text style={[styles.pickerItemMetaText, { color: theme.carreauColor }]}>{c.carreauCount} C</Text></> : null}
                        </View>
                      </View>
                      {isSelected && <MaterialIcons name="check-circle" size={22} color={theme.accent} />}
                    </Pressable>
                  );
                }}
              />
            ) : (
              <View style={styles.pickerEmpty}>
                <MaterialIcons name="flag" size={48} color={theme.textMuted} />
                <Text style={styles.pickerEmptyText}>{t('profile', 'noChallengesAvailable')}</Text>
              </View>
            );
          })()}

          {/* Tournament Picker */}
          {itemPickerType === 'tournament' && (() => {
            const search = itemPickerSearch.toLowerCase();
            // Only show tournaments that have matches
            const tournamentsWithMatches = tournaments.filter(tour => {
              const tourMatches = timeFilteredMatches.filter(m => m.tournamentId === tour.id);
              return tourMatches.length > 0;
            });
            const items = tournamentsWithMatches.filter(tour => {
              if (!search) return true;
              return tour.name.toLowerCase().includes(search) || (tour.location?.city || '').toLowerCase().includes(search);
            });
            return items.length > 0 ? (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                renderItem={({ item: tour }) => {
                  const tourMatchCount = timeFilteredMatches.filter(m => m.tournamentId === tour.id).length;
                  const dateStr = new Date(tour.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
                  const isSelected = selectedTournamentId === tour.id;
                  return (
                    <Pressable
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => selectTournament(tour.id)}
                    >
                      <View style={[styles.pickerItemIndicator, { backgroundColor: theme.carreauColor }]} />
                      <View style={styles.pickerItemContent}>
                        <View style={styles.pickerItemRow}>
                          <Text style={styles.pickerItemTitle} numberOfLines={1}>{tour.name}</Text>
                          {tour.finalResult ? <Text style={[styles.pickerItemScore, { color: theme.carreauColor }]}>{t('palmaresResults', tour.finalResult)}</Text> : null}
                        </View>
                        <View style={styles.pickerItemMeta}>
                          <Text style={styles.pickerItemMetaText}>{dateStr}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{tourMatchCount} {t('profile', 'matchesInTournament')}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{t('formats', tour.format)}</Text>
                        </View>
                      </View>
                      {isSelected && <MaterialIcons name="check-circle" size={22} color={theme.carreauColor} />}
                    </Pressable>
                  );
                }}
              />
            ) : (
              <View style={styles.pickerEmpty}>
                <MaterialIcons name="emoji-events" size={48} color={theme.textMuted} />
                <Text style={styles.pickerEmptyText}>{t('profile', 'noTournamentsAvailable')}</Text>
              </View>
            );
          })()}

          {/* Partner Picker */}
          {itemPickerType === 'partner' && (() => {
            const search = itemPickerSearch.toLowerCase();
            const partnerIds = new Set<string>();
            timeFilteredMatches.forEach(m => { m.teamA.players.forEach(pid => partnerIds.add(pid)); });
            if (selfPlayer) partnerIds.delete(selfPlayer.id);
            const partnerPlayers = players.filter(p => partnerIds.has(p.id));
            const items = partnerPlayers.filter(p => {
              if (!search) return true;
              return p.name.toLowerCase().includes(search) || (p.club || '').toLowerCase().includes(search);
            });
            return items.length > 0 ? (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                renderItem={({ item: p }) => {
                  const matchCount = timeFilteredMatches.filter(m => m.teamA.players.includes(p.id)).length;
                  const isSelected = selectedPartnerId === p.id;
                  const wins = timeFilteredMatches.filter(m => m.teamA.players.includes(p.id) && m.winner === 'A').length;
                  return (
                    <Pressable
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => selectPartner(p.id)}
                    >
                      <View style={[styles.pickerItemIndicator, { backgroundColor: theme.success }]} />
                      <View style={styles.pickerItemContent}>
                        <View style={styles.pickerItemRow}>
                          <Text style={styles.pickerItemTitle} numberOfLines={1}>{p.name}</Text>
                          <Text style={[styles.pickerItemScore, { color: wins >= matchCount - wins ? theme.success : theme.error }]}>{wins}W-{matchCount - wins}L</Text>
                        </View>
                        <View style={styles.pickerItemMeta}>
                          <Text style={styles.pickerItemMetaText}>{t('roles', p.role)}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{matchCount} {t('stats', 'matches')}</Text>
                          {p.club ? <><View style={styles.pickerItemDot} /><Text style={styles.pickerItemMetaText}>{p.club}</Text></> : null}
                        </View>
                      </View>
                      {isSelected && <MaterialIcons name="check-circle" size={22} color={theme.success} />}
                    </Pressable>
                  );
                }}
              />
            ) : (
              <View style={styles.pickerEmpty}>
                <MaterialIcons name="group" size={48} color={theme.textMuted} />
                <Text style={styles.pickerEmptyText}>{t('profile', 'noPartnersAvailable')}</Text>
              </View>
            );
          })()}

          {/* Terrain Picker */}
          {itemPickerType === 'terrain' && (() => {
            const search = itemPickerSearch.toLowerCase();
            // Only show terrains that have matches
            const terrainsWithMatches = terrains.filter(terr => {
              const terrMatches = timeFilteredMatches.filter(m => m.terrainId === terr.id);
              return terrMatches.length > 0;
            });
            const items = terrainsWithMatches.filter(terr => {
              if (!search) return true;
              return terr.name.toLowerCase().includes(search) || terr.city.toLowerCase().includes(search) || (terr.type || '').toLowerCase().includes(search);
            });
            return items.length > 0 ? (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                renderItem={({ item: terr }) => {
                  const matchCount = timeFilteredMatches.filter(m => m.terrainId === terr.id).length;
                  const wins = timeFilteredMatches.filter(m => m.terrainId === terr.id && m.winner === 'A').length;
                  const isSelected = selectedTerrainId === terr.id;
                  return (
                    <Pressable
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => selectTerrain(terr.id)}
                    >
                      <View style={[styles.pickerItemIndicator, { backgroundColor: '#8B5CF6' }]} />
                      <View style={styles.pickerItemContent}>
                        <View style={styles.pickerItemRow}>
                          <Text style={styles.pickerItemTitle} numberOfLines={1}>{terr.name}</Text>
                          <Text style={[styles.pickerItemScore, { color: wins >= matchCount - wins ? theme.success : theme.error }]}>{wins}W-{matchCount - wins}L</Text>
                        </View>
                        <View style={styles.pickerItemMeta}>
                          <Text style={styles.pickerItemMetaText}>{terr.city}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{t('terrainTypes', terr.type)}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{matchCount} {t('profile', 'matchesOnTerrain')}</Text>
                        </View>
                      </View>
                      {isSelected && <MaterialIcons name="check-circle" size={22} color={'#8B5CF6'} />}
                    </Pressable>
                  );
                }}
              />
            ) : (
              <View style={styles.pickerEmpty}>
                <MaterialIcons name="sports-soccer" size={48} color={theme.textMuted} />
                <Text style={styles.pickerEmptyText}>{t('profile', 'noTerrainsAvailable')}</Text>
              </View>
            );
          })()}

          {/* Boules Set Picker */}
          {itemPickerType === 'boules' && (() => {
            const search = itemPickerSearch.toLowerCase();
            const setsWithData = boulesSets.filter(bs => {
              const hasMatch = timeFilteredMatches.some(m => m.boulesSetId === bs.id);
              const hasChallenge = timeFilteredChallenges.some(c => c.boulesSetId === bs.id);
              return hasMatch || hasChallenge;
            });
            const items = setsWithData.filter(bs => {
              if (!search) return true;
              return bs.name.toLowerCase().includes(search) || (bs.brand || '').toLowerCase().includes(search);
            });
            return items.length > 0 ? (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                renderItem={({ item: bs }) => {
                  const matchCount = timeFilteredMatches.filter(m => m.boulesSetId === bs.id).length;
                  const challengeCount = timeFilteredChallenges.filter(c => c.boulesSetId === bs.id).length;
                  const wins = timeFilteredMatches.filter(m => m.boulesSetId === bs.id && m.winner === 'A').length;
                  const isSelected = selectedBoulesSetId === bs.id;
                  return (
                    <Pressable
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => selectBoulesSet(bs.id)}
                    >
                      <View style={[styles.pickerItemIndicator, { backgroundColor: '#D97706' }]} />
                      <View style={styles.pickerItemContent}>
                        <View style={styles.pickerItemRow}>
                          <Text style={styles.pickerItemTitle} numberOfLines={1}>{bs.name}</Text>
                          {matchCount > 0 ? <Text style={[styles.pickerItemScore, { color: wins >= matchCount - wins ? theme.success : theme.error }]}>{wins}W-{matchCount - wins}L</Text> : null}
                        </View>
                        <View style={styles.pickerItemMeta}>
                          {bs.brand ? <><Text style={styles.pickerItemMetaText}>{bs.brand}</Text><View style={styles.pickerItemDot} /></> : null}
                          {bs.diameter ? <><Text style={styles.pickerItemMetaText}>{bs.diameter}mm</Text><View style={styles.pickerItemDot} /></> : null}
                          {bs.weight ? <><Text style={styles.pickerItemMetaText}>{bs.weight}g</Text><View style={styles.pickerItemDot} /></> : null}
                          <Text style={styles.pickerItemMetaText}>{matchCount} {t('stats', 'matches')}</Text>
                          {challengeCount > 0 ? <><View style={styles.pickerItemDot} /><Text style={[styles.pickerItemMetaText, { color: theme.accent }]}>{challengeCount} {t('profile', 'challenges')}</Text></> : null}
                        </View>
                      </View>
                      {isSelected ? <MaterialIcons name="check-circle" size={22} color={'#D97706'} /> : null}
                    </Pressable>
                  );
                }}
              />
            ) : (
              <View style={styles.pickerEmpty}>
                <MaterialIcons name="sports-baseball" size={48} color={theme.textMuted} />
                <Text style={styles.pickerEmptyText}>{t('profile', 'noBoulesSetAvailable')}</Text>
              </View>
            );
          })()}

          {/* Opponent Picker */}
          {itemPickerType === 'opponent' && (() => {
            const search = itemPickerSearch.toLowerCase();
            const opponentIds = new Set<string>();
            timeFilteredMatches.forEach(m => { m.teamB.players.forEach(pid => opponentIds.add(pid)); });
            timeFilteredChallenges.forEach(c => { if (c.opponentId) opponentIds.add(c.opponentId); });
            const opponentPlayers = players.filter(p => opponentIds.has(p.id));
            const items = opponentPlayers.filter(p => {
              if (!search) return true;
              return p.name.toLowerCase().includes(search) || (p.club || '').toLowerCase().includes(search);
            });
            return items.length > 0 ? (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                renderItem={({ item: p }) => {
                  const matchCount = timeFilteredMatches.filter(m => m.teamB.players.includes(p.id)).length;
                  const challengeCount = timeFilteredChallenges.filter(c => c.mode === '1v1' && c.opponentId === p.id).length;
                  const isSelected = selectedOpponentId === p.id;
                  const wins = timeFilteredMatches.filter(m => m.teamB.players.includes(p.id) && m.winner === 'A').length;
                  return (
                    <Pressable
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => selectOpponent(p.id)}
                    >
                      <View style={[styles.pickerItemIndicator, { backgroundColor: theme.pointColor }]} />
                      <View style={styles.pickerItemContent}>
                        <View style={styles.pickerItemRow}>
                          <Text style={styles.pickerItemTitle} numberOfLines={1}>{p.name}</Text>
                          <Text style={[styles.pickerItemScore, { color: wins >= matchCount - wins ? theme.success : theme.error }]}>{wins}W-{matchCount - wins}L</Text>
                        </View>
                        <View style={styles.pickerItemMeta}>
                          <Text style={styles.pickerItemMetaText}>{t('roles', p.role)}</Text>
                          <View style={styles.pickerItemDot} />
                          <Text style={styles.pickerItemMetaText}>{matchCount} {t('stats', 'matches')}</Text>
                          {challengeCount > 0 ? <><View style={styles.pickerItemDot} /><Text style={[styles.pickerItemMetaText, { color: theme.accent }]}>{challengeCount} {t('profile', 'challenges')}</Text></> : null}
                          {p.club ? <><View style={styles.pickerItemDot} /><Text style={styles.pickerItemMetaText}>{p.club}</Text></> : null}
                        </View>
                      </View>
                      {isSelected && <MaterialIcons name="check-circle" size={22} color={theme.pointColor} />}
                    </Pressable>
                  );
                }}
              />
            ) : (
              <View style={styles.pickerEmpty}>
                <MaterialIcons name="people" size={48} color={theme.textMuted} />
                <Text style={styles.pickerEmptyText}>{t('profile', 'noOpponentsAvailable')}</Text>
              </View>
            );
          })()}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// STYLES
const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#F8FAFC'},
  header:{backgroundColor:theme.surface,borderBottomWidth:0,paddingBottom:12},
  headerGradient:{paddingTop:16,paddingBottom:28,paddingHorizontal:20,borderBottomLeftRadius:24,borderBottomRightRadius:24,overflow:'hidden' as const,position:'relative' as const},
  headerDecoCircle1:{position:'absolute' as const,top:-40,right:-30,width:140,height:140,borderRadius:70,backgroundColor:'rgba(255,255,255,0.04)'},
  headerDecoCircle2:{position:'absolute' as const,bottom:-20,left:-20,width:100,height:100,borderRadius:50,backgroundColor:'rgba(255,255,255,0.03)'},
  headerTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18},
  headerTitle:{fontSize:26,fontWeight:'800',color:'#FFF',letterSpacing:-0.3},
  headerSubtitle:{fontSize:13,color:'rgba(255,255,255,0.6)',marginTop:3,fontWeight:'500'},
  headerButtons:{flexDirection:'row',alignItems:'center',gap:8},

  progressionButtonText:{fontSize:11,fontWeight:'700' as const,color:'rgba(255,255,255,0.8)'},
  progressionButton:{width:42,height:42,borderRadius:14,backgroundColor:'rgba(255,255,255,0.12)',alignItems:'center' as const,justifyContent:'center' as const,borderWidth:1,borderColor:'rgba(255,255,255,0.1)'},
  historyButton:{width:42,height:42,borderRadius:14,backgroundColor:'rgba(255,255,255,0.08)',alignItems:'center' as const,justifyContent:'center' as const,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',position:'relative' as const},
  headerStatsRow:{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.08)',borderRadius:16,paddingVertical:14,paddingHorizontal:10,borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},
  headerStatItem:{flex:1,alignItems:'center' as const},
  headerStatValue:{fontSize:17,fontWeight:'800',color:'#FFF'},
  headerStatLabel:{fontSize:8,fontWeight:'700',color:'rgba(255,255,255,0.5)',marginTop:3,textTransform:'uppercase' as const,letterSpacing:0.5},
  headerStatDivider:{width:1,height:28,backgroundColor:'rgba(255,255,255,0.1)'},
  filterBar:{paddingHorizontal:16,gap:8,marginTop:12,marginBottom:8},
  // Item filter bar
  itemFilterBar: { marginBottom: 8 },
  itemFilterScroll: { paddingHorizontal: 16, gap: 6 },
  itemFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.borderRadius.full, backgroundColor: theme.primary },
  itemFilterChipInactive: { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  itemFilterChipMatch: { backgroundColor: theme.tirColor },
  itemFilterChipChallenge: { backgroundColor: theme.accent },
  itemFilterChipTournament: { backgroundColor: theme.carreauColor },
  itemFilterChipOpponent: { backgroundColor: theme.pointColor },
  itemFilterChipPartner: { backgroundColor: theme.success },
  itemFilterChipTerrain: { backgroundColor: '#8B5CF6' },
  itemFilterChipBoules: { backgroundColor: '#D97706' },
  itemFilterChipText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  itemFilterChipTextInactive: { color: theme.textSecondary },
  activeFilterBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.border },
  activeFilterText: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  activeFilterClear: { padding: 4 },
  // Picker modal
  pickerSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.borderRadius.md, gap: 10, borderWidth: 1, borderColor: theme.border },
  pickerSearchInput: { flex: 1, fontSize: 15, color: theme.textPrimary, padding: 0 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 8, ...theme.shadows.card },
  pickerItemSelected: { borderWidth: 2, borderColor: theme.primary },
  pickerItemIndicator: { width: 4, height: '80%', borderRadius: 2, marginRight: 12 },
  pickerItemContent: { flex: 1 },
  pickerItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pickerItemTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, flex: 1, marginRight: 8 },
  pickerItemScore: { fontSize: 15, fontWeight: '700' },
  pickerItemSubtitle: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  pickerItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  pickerItemMetaText: { fontSize: 11, color: theme.textMuted },
  pickerItemDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted },
  pickerEmpty: { alignItems: 'center', paddingVertical: 48 },
  pickerEmptyText: { fontSize: 15, color: theme.textMuted, marginTop: 12 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.borderRadius.full, backgroundColor: theme.backgroundSecondary },
  filterPillActive: { backgroundColor: theme.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  filterPillTextActive: { color: '#FFF' },
  categoryTabs:{flexDirection:'row',paddingHorizontal:12,gap:6,marginTop:6},
  categoryTab:{flex:1,flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,paddingVertical:12,paddingHorizontal:4,borderRadius:16,backgroundColor:'#F1F5F9',borderWidth:1.5,borderColor:'transparent'},
  categoryTabActive:{...theme.shadows.card},
  categoryTabIconBg:{width:30,height:30,borderRadius:10,alignItems:'center' as const,justifyContent:'center' as const,backgroundColor:'transparent'},
  categoryTabText:{fontSize:10,fontWeight:'600',color:theme.textMuted,letterSpacing:0.2},
  categoryTabTextActive:{fontWeight:'800'},
  categoryTabDot:{width:4,height:4,borderRadius:2,marginTop:-2},
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  weeklyHeroWrap: { marginBottom: 12 },
  scrollContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },
  tabletRow: { flexDirection: 'row' as const, gap: 16, marginBottom: 0 },
  tabletHalf: { flex: 1 },
  heroCardTablet: { padding: 28 },
  sectionTabletWide: { },
  errorRatesGridTablet: { gap: 20 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10, position: 'relative' as const },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, letterSpacing: -0.1 },
  sectionSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  sectionAccent: { position: 'absolute' as const, right: 0, top: 4, bottom: 4, width: 3, borderRadius: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E8EDF2', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  heroCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, marginBottom: 20, ...theme.shadows.cardElevated, borderWidth: 1, borderColor: '#E8EDF2' },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  heroStats: { gap: 18 },
  heroStatItem: { alignItems: 'center' },
  heroStatValue: { fontSize: 26, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.3 },
  heroStatLabel: { fontSize: 10, color: theme.textMuted, marginTop: 3, fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  ringValue: { fontWeight: '800', letterSpacing: -0.5 },
  ringLabel: { color: theme.textSecondary, marginTop: -1, fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  statsGrid3: { flexDirection: 'row', justifyContent: 'space-around' },
  gridItem: { alignItems: 'center' },
  gridValue: { fontSize: 30, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.5 },
  gridLabel: { fontSize: 10, color: theme.textMuted, marginTop: 4, fontWeight: '600', textTransform: 'uppercase' as const },
  modeWinRates: { gap: 16 },
  modeWinRateItem: { gap: 8 },
  modeLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBarTrack: { flex: 1, height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', position: 'relative' as const },
  progressBarFill: { height: '100%', borderRadius: 5 },
  progressBarShine: { position: 'absolute' as const, top: 0, left: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 5 },
  progressBarValueBg: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, minWidth: 50, alignItems: 'center' as const },
  progressBarValue: { fontSize: 13, fontWeight: '800' },
  formatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  formatInfo: { width: 100 },
  formatName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  formatRecord: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  formatBarContainer: { flex: 1, marginLeft: 12 },
  scoreComparison: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16 },
  scoreItem: { flex: 1, alignItems: 'center' },
  scoreValue: { fontSize: 34, fontWeight: '800', marginTop: 8, letterSpacing: -0.5 },
  scoreLabel: { fontSize: 10, color: theme.textMuted, marginTop: 4, fontWeight: '600', textTransform: 'uppercase' as const },
  scoreDiff: { alignItems: 'center', paddingHorizontal: 16 },
  scoreDiffBadge: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  scoreDiffText: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  scoreDiffLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2, fontWeight: '600' },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  statRowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  statRowContent: { flex: 1 },
  statRowLabel: { fontSize: 13, color: theme.textPrimary, fontWeight: '500' },
  statRowSubValue: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  statRowValue: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.3 },
  statRowValueNA: { color: theme.textMuted, fontWeight: '500', fontStyle: 'italic' },
  breakdownContainer: { gap: 12 },
  breakdownBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: theme.backgroundSecondary },
  breakdownSegment: { height: '100%' },
  breakdownLegend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12 },
  breakdownLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLegendText: { fontSize: 11, color: theme.textSecondary },
  breakdownLegendValue: { fontSize: 11, fontWeight: '600', color: theme.textPrimary },
  naPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 8, marginTop: 8, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.sm },
  naText: { fontSize: 11, color: theme.textMuted, flex: 1 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
  emptyState:{alignItems:'center',paddingVertical:40},
  emptyImage:{width:160,height:160,marginBottom:8},
  emptyTitle:{fontSize:20,fontWeight:'700',color:theme.textPrimary,marginTop:8},
  emptyText:{fontSize:14,color:theme.textSecondary,textAlign:'center',marginTop:8,marginBottom:24,maxWidth:280,lineHeight:21},
  emptyButton:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:theme.primary,paddingHorizontal:28,paddingVertical:16,borderRadius:16},
  emptyButtonText:{fontSize:15,fontWeight:'700',color:'#FFF'},
  durationHero: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  durationMain: { flex: 1, alignItems: 'center' },
  durationMainValue: { fontSize: 32, fontWeight: '700', color: theme.accent, marginTop: 4 },
  durationMainLabel: { fontSize: 12, color: theme.textMuted },
  durationMinMax: { flexDirection: 'row', gap: 16 },
  durationMinMaxItem: { alignItems: 'center' },
  durationMinMaxValue: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 4 },
  durationMinMaxLabel: { fontSize: 10, color: theme.textMuted },
  totalTimeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  totalTimeLabel: { flex: 1, fontSize: 13, color: theme.textPrimary },
  totalTimeValue: { fontSize: 15, fontWeight: '700', color: theme.accent },
  // Error Analysis Styles
  errorHeroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  errorHeroMain: { alignItems: 'center' },
  errorHeroValue: { fontSize: 52, fontWeight: '800', color: theme.error, marginTop: 8, letterSpacing: -1 },
  errorHeroLabel: { fontSize: 11, color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase' as const },
  errorHeroBreakdown: { gap: 16 },
  errorHeroItem: { alignItems: 'center' },
  errorHeroItemValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginTop: 4 },
  errorHeroItemLabel: { fontSize: 10, color: theme.textMuted },
  mostCommonError: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  mostCommonErrorText: { flex: 1, fontSize: 12, color: theme.textSecondary },
  mostCommonErrorHighlight: { fontWeight: '700', color: theme.warning },
  errorRatesGrid: { flexDirection: 'row', gap: 12 },
  errorRateCard: { flex: 1, alignItems: 'center', padding: 18, borderRadius: 18, borderWidth: 2, backgroundColor: '#FAFAFA' },
  errorRateValue: { fontSize: 32, fontWeight: '800', marginTop: 8, letterSpacing: -0.5 },
  errorRateLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4, fontWeight: '600' },
  insightBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14, padding: 14, backgroundColor: '#FFFBEB', borderRadius: 14, borderLeftWidth: 3, borderLeftColor: '#F59E0B', borderWidth: 1, borderTopColor: '#FEF3C7', borderRightColor: '#FEF3C7', borderBottomColor: '#FEF3C7' },
  insightText: { flex: 1, fontSize: 12, color: '#78350F', lineHeight: 18 },
  contextComparison: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8 },
  contextItem: { alignItems: 'center' },
  contextLabel: { fontSize: 12, color: theme.textMuted, marginBottom: 4 },
  contextValue: { fontSize: 32, fontWeight: '700' },
  contextSubLabel: { fontSize: 10, color: theme.textMuted },
  contextDivider: { paddingHorizontal: 16 },
  errorSubsectionTitle: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 8, marginBottom: 4 },
  coachingTip: { marginLeft: 38, marginRight: 8, marginBottom: 8, marginTop: -4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.tirColor + '08', borderRadius: theme.borderRadius.sm, borderLeftWidth: 2, borderLeftColor: theme.tirColor + '40' },
  coachingTipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  coachingTipCause: { fontSize: 11, fontWeight: '600', color: theme.tirColor, fontStyle: 'italic' },
  coachingTipAdvice: { fontSize: 11, color: theme.textSecondary, lineHeight: 16 },
  coachingTipPoint: { marginLeft: 38, marginRight: 8, marginBottom: 8, marginTop: -4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.pointColor + '08', borderRadius: theme.borderRadius.sm, borderLeftWidth: 2, borderLeftColor: theme.pointColor + '40' },
  consecutiveErrorsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  consecutiveErrorItem: { alignItems: 'center' },
  consecutiveErrorValue: { fontSize: 36, fontWeight: '700', color: theme.error },
  consecutiveErrorLabel: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 4 },
  // Precision Workshop Stats
  precisionWorkshopRow: { paddingVertical: 14 },
  precisionWorkshopHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  precisionWorkshopIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  precisionWorkshopInfo: { flex: 1 },
  precisionWorkshopName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  precisionWorkshopMeta: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  precisionWorkshopStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
  precisionWorkshopStatItem: { alignItems: 'center' },
  precisionWorkshopStatValue: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  precisionWorkshopStatLabel: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  precisionEvolutionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border + '50' },
  precisionEvolutionLabel: { fontSize: 10, color: theme.textMuted, width: 50 },
  precisionEvolutionBars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 36 },
  precisionEvolutionBarCol: { flex: 1, alignItems: 'center' },
  precisionEvolutionBarTrack: { width: '100%', height: 28, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' },
  precisionEvolutionBarFill: { width: '100%', borderRadius: 3 },
  precisionEvolutionBarLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2 },
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  modalSubtitle: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  modalCloseButton: { padding: 8 },
  modalContent: { flex: 1 },
  modalScrollContent: { padding: 16, paddingBottom: 32 },
  progressionModalHeader: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 14 },
  progressionModalHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  progressionModalTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  progressionModalSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  progressionModalCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  progressionFilterScroll: { paddingHorizontal: 16, gap: 8 },
  progressionFilterPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.borderRadius.full, backgroundColor: theme.backgroundSecondary, borderWidth: 1.5, borderColor: theme.border },
  progressionFilterPillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  progressionFilterText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  progressionFilterTextActive: { color: '#FFF' },
  trendCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  trendCardsRowTablet: { gap: 16, marginBottom: 24 },
  trendCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderLeftWidth: 4, ...theme.shadows.card, borderWidth: 1, borderTopColor: '#F1F5F9', borderRightColor: '#F1F5F9', borderBottomColor: '#F1F5F9' },
  trendCardTablet: { padding: 18, borderLeftWidth: 4 },
  trendCardValueTablet: { fontSize: 28 },
  trendCardLabelTablet: { fontSize: 13 },
  trendCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trendCardValue: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  trendCardLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  progressionSection: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, ...theme.shadows.card },
  progressionSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  progressionSectionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  progressionSectionTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  progressionSectionTitleTablet: { fontSize: 17 },
  progressionSectionSubtitle: { fontSize: 11, color: theme.textMuted },
  progressionSectionSubtitleTablet: { fontSize: 13 },
  modalScrollContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },
  modalTabletRow: { flexDirection: 'row' as const, gap: 16, marginBottom: 0 },
  modalTabletHalf: { flex: 1 },
  chartContainer: { alignItems: 'center', marginBottom: 8, position: 'relative' as const },
  // Chart tooltip
  chartTooltip: { position: 'absolute' as const, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 136, zIndex: 100, ...theme.shadows.cardElevated, borderWidth: 1, borderColor: theme.border },
  chartTooltipTitle: { fontSize: 12, fontWeight: '700', color: theme.textPrimary, marginBottom: 3 },
  chartTooltipRow: { fontSize: 11, color: theme.textSecondary, marginBottom: 2 },
  chartTooltipValue: { fontSize: 16, fontWeight: '800' },
  summaryTable: { borderRadius: theme.borderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  summaryHeader: { flexDirection: 'row', backgroundColor: theme.backgroundSecondary, paddingVertical: 10 },
  summaryRow: { flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border },
  summaryRowAlt: { backgroundColor: theme.backgroundSecondary + '50' },
  summaryCell: { fontSize: 12, color: theme.textPrimary, textAlign: 'center', fontWeight: '500' },
  summaryCellHeader: { fontWeight: '700', color: theme.textSecondary, fontSize: 11 },
  noProgressionData: { alignItems: 'center', paddingVertical: 48 },
  noProgressionTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  noProgressionText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 260 },
  // Boules comparison chart
  boulesCompChart: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  boulesCompChartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  boulesCompChartTitle: { fontSize: 13, fontWeight: '700', color: '#D97706' },
  boulesCompMetricRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  boulesCompMetricLabel: { width: 60, fontSize: 11, fontWeight: '600', color: theme.textSecondary, paddingTop: 2 },
  boulesCompBarsCol: { flex: 1, gap: 4 },
  boulesCompBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boulesCompBarTrack: { flex: 1, height: 8, backgroundColor: theme.backgroundSecondary, borderRadius: 4, overflow: 'hidden' },
  boulesCompBarFill: { height: '100%', borderRadius: 4 },
  boulesCompBarValue: { fontSize: 11, fontWeight: '700', minWidth: 32, textAlign: 'right' as const },
  boulesCompLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4, justifyContent: 'center' as const },
  boulesCompLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 120 },
  boulesCompLegendDot: { width: 8, height: 8, borderRadius: 4 },
  boulesCompLegendText: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  // Challenge progression legend
  challengeProgLegend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginTop: 4 },
  challengeProgLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  challengeProgLegendDot: { width: 10, height: 10, borderRadius: 5 },
  challengeProgLegendText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  // Cross-reference table styles
  crossTableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: '#E2E8F0', marginBottom: 4 },
  crossTableHeaderLabel: { flex: 1.5, paddingLeft: 4 },
  crossTableHeaderText: { fontSize: 10, fontWeight: '800', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  crossTableHeaderCell: { flex: 1, alignItems: 'center', gap: 2 },
  crossTableHeaderCellText: { fontSize: 9, fontWeight: '700' },
  crossTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  crossTableRowAlt: { backgroundColor: '#F8FAFC' },
  crossTableRowLabel: { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  crossTableRowLabelText: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  crossTableCell: { flex: 1, alignItems: 'center' },
  crossTableCellValue: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  crossTableCellPct: { fontSize: 9, color: theme.textMuted, marginTop: 1 },
});
