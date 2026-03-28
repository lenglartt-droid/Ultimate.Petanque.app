import React, { useState, useMemo, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
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
import { ProgressRing, StatRow, SectionHeader, ProgressBar, BreakdownBar, NAPlaceholder } from '@/components/feature/stats/StatsPrimitives';
import { PerformanceSection } from '@/components/feature/stats/PerformanceSection';
import { TirSection } from '@/components/feature/stats/TirSection';
import { PointSection } from '@/components/feature/stats/PointSection';
import { ErrorsSection } from '@/components/feature/stats/ErrorsSection';
type ProgressionFilter = '4weeks' | '8weeks' | '3months' | '6months' | 'year' | '2years' | '5years' | '10years' | '25years';
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
  const TIME_FILTERS = useMemo(() => TIME_FILTER_KEYS.map(f => ({ ...f, label: t('stats', f.key) || t('common', f.key) })), [language]);
  const PROGRESSION_FILTERS = useMemo(() => PROGRESSION_FILTER_KEYS.map(f => ({ ...f, label: t('stats', f.key) })), [language]);
  const CATEGORY_TABS = useMemo(() => CATEGORY_TAB_KEYS.map(f => ({ ...f, label: t('stats', f.key) })), [language]);
  
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
  const filteredMatches = useMemo(() => {
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

  const filteredChallenges = useMemo(() => {
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
  const activeFilterLabel = useMemo(() => {
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

// PERFORMANCE STATS CALCULATION
  const performanceStats = useMemo(() => {
    const total = filteredMatches.length;
    const trainingMatches = filteredMatches.filter(m => m.mode === 'Entraînement');
    const tournamentMatches = filteredMatches.filter(m => m.mode === 'Tournoi');
    
    const wins = filteredMatches.filter(m => m.winner === 'A').length;
    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    // Win rate by format
    const byFormat: Record<string, { total: number; wins: number }> = {
      'Tête-à-tête': { total: 0, wins: 0 },
      'Doublette': { total: 0, wins: 0 },
      'Triplette': { total: 0, wins: 0 },
    };
    filteredMatches.forEach(m => {
      if (byFormat[m.format]) {
        byFormat[m.format].total++;
        if (m.winner === 'A') byFormat[m.format].wins++;
      }
    });
    
    // Points stats
    let totalPointsFor = 0, totalPointsAgainst = 0;
    let totalMenes = 0, menesWon = 0;
    let totalMenePointsFor = 0, totalMenePointsAgainst = 0;
    
    filteredMatches.forEach(match => {
      totalPointsFor += match.teamA?.score || 0;
      totalPointsAgainst += match.teamB?.score || 0;
      
      if (match.menes && match.menes.length > 0) {
        match.menes.forEach(mene => {
          totalMenes++;
          const meneA = mene.teamAPoints || mene.scoreA || 0;
          const meneB = mene.teamBPoints || mene.scoreB || 0;
          totalMenePointsFor += meneA;
          totalMenePointsAgainst += meneB;
          if (meneA > meneB) menesWon++;
        });
      }
    });
    
    const avgScoreFor = total > 0 ? (totalPointsFor / total).toFixed(1) : '0';
    const avgScoreAgainst = total > 0 ? (totalPointsAgainst / total).toFixed(1) : '0';
    const pointDiff = totalPointsFor - totalPointsAgainst;
    const avgPointDiff = total > 0 ? (pointDiff / total).toFixed(1) : '0';
    
    const meneWinRate = totalMenes > 0 ? Math.round((menesWon / totalMenes) * 100) : 0;
    const avgMenePointsFor = totalMenes > 0 ? (totalMenePointsFor / totalMenes).toFixed(1) : '0';
    const avgMenePointsAgainst = totalMenes > 0 ? (totalMenePointsAgainst / totalMenes).toFixed(1) : '0';
    
    // Streaks
    let currentStreak = 0, maxWinStreak = 0, maxLossStreak = 0;
    let tempWinStreak = 0, tempLossStreak = 0;
    
    const sortedMatches = [...filteredMatches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    sortedMatches.forEach((m, i) => {
      if (m.winner === 'A') {
        tempWinStreak++;
        tempLossStreak = 0;
        if (i === 0) currentStreak = tempWinStreak;
        maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
      } else {
        tempLossStreak++;
        tempWinStreak = 0;
        if (i === 0) currentStreak = -tempLossStreak;
        maxLossStreak = Math.max(maxLossStreak, tempLossStreak);
      }
    });

    // Series stats
    const seriesMap: Record<string, { wins: number; seriesWinner?: 'A' | 'B' }> = {};
    filteredMatches.forEach(m => {
      if (m.seriesInfo?.seriesId) {
        if (!seriesMap[m.seriesInfo.seriesId]) seriesMap[m.seriesInfo.seriesId] = { wins: 0 };
        if (m.winner === 'A') seriesMap[m.seriesInfo.seriesId].wins++;
        if (m.seriesInfo.seriesComplete && m.seriesInfo.seriesWinner) {
          seriesMap[m.seriesInfo.seriesId].seriesWinner = m.seriesInfo.seriesWinner;
        }
      }
    });
    const seriesComplete = Object.values(seriesMap).filter(s => s.seriesWinner);
    const seriesWon = seriesComplete.filter(s => s.seriesWinner === 'A').length;

    // Fanny stats
    const fannyWins = filteredMatches.filter(m => m.winner === 'A' && m.teamA.score === 13 && m.teamB.score === 0).length;
    const fannyLosses = filteredMatches.filter(m => m.winner === 'B' && m.teamB.score === 13 && m.teamA.score === 0).length;

    // Duration stats
    const matchesWithDuration = filteredMatches.filter(m => m.duration && m.duration > 0);
    const totalDuration = matchesWithDuration.reduce((sum, m) => sum + (m.duration || 0), 0);
    const avgDuration = matchesWithDuration.length > 0 ? Math.round(totalDuration / matchesWithDuration.length) : 0;
    const minDuration = matchesWithDuration.length > 0 ? Math.min(...matchesWithDuration.map(m => m.duration || 0)) : 0;
    const maxDuration = matchesWithDuration.length > 0 ? Math.max(...matchesWithDuration.map(m => m.duration || 0)) : 0;
    
    const durationByFormat: Record<string, { total: number; count: number }> = {};
    matchesWithDuration.forEach(m => {
      if (!durationByFormat[m.format]) durationByFormat[m.format] = { total: 0, count: 0 };
      durationByFormat[m.format].total += m.duration || 0;
      durationByFormat[m.format].count++;
    });
    
    let totalMeneDuration = 0, menesWithDuration = 0;
    filteredMatches.forEach(match => {
      if (match.menes) {
        match.menes.forEach(mene => {
          if (mene.duration && mene.duration > 0) {
            totalMeneDuration += mene.duration;
            menesWithDuration++;
          }
        });
      }
    });
    const avgMeneDuration = menesWithDuration > 0 ? Math.round(totalMeneDuration / menesWithDuration) : 0;

    return {
      total, trainingCount: trainingMatches.length, tournamentCount: tournamentMatches.length,
      wins, losses, winRate,
      trainingWinRate: trainingMatches.length > 0 ? Math.round((trainingMatches.filter(m => m.winner === 'A').length / trainingMatches.length) * 100) : 0,
      tournamentWinRate: tournamentMatches.length > 0 ? Math.round((tournamentMatches.filter(m => m.winner === 'A').length / tournamentMatches.length) * 100) : 0,
      byFormat, avgScoreFor, avgScoreAgainst, pointDiff, avgPointDiff,
      totalMenes, menesWon, meneWinRate, avgMenePointsFor, avgMenePointsAgainst,
      currentStreak, maxWinStreak, maxLossStreak,
      seriesPlayed: Object.keys(seriesMap).length, seriesWon, seriesLost: seriesComplete.length - seriesWon,
      fannyWins, fannyLosses,
      totalDuration, avgDuration, minDuration, maxDuration,
      matchesWithDuration: matchesWithDuration.length, durationByFormat, avgMeneDuration, menesWithDuration,
    };
  }, [filteredMatches]);

// TIR STATS
  const tirStats = useMemo(() => {
    let totalTirs = 0, tirsSuccess = 0, carreaux = 0;
    
    const shotTypeStats: Record<string, { total: number; success: number }> = {
      au_fer: { total: 0, success: 0 }, au_plomb: { total: 0, success: 0 },
      en_rafle: { total: 0, success: 0 }, court_ramasse: { total: 0, success: 0 },
      carreau: { total: 0, success: 0 },
    };
    
    // Shot result stats (for failed tirs - where the shot went)
    const shotResultStats: Record<string, number> = {
      court_droite: 0, court_gauche: 0, long: 0, tir_bouchon: 0,
    };
    
    const shotQualityStats: Record<string, number> = { gain_point: 0, sans_effet: 0, negatif: 0, decisif: 0 };
    
    // Cross-reference: shotType -> impact distribution
    const crossTypeImpact: Record<string, { gain_point: number; sans_effet: number; negatif: number; decisif: number; total: number }> = {
      au_fer: { gain_point: 0, sans_effet: 0, negatif: 0, decisif: 0, total: 0 },
      au_plomb: { gain_point: 0, sans_effet: 0, negatif: 0, decisif: 0, total: 0 },
      en_rafle: { gain_point: 0, sans_effet: 0, negatif: 0, decisif: 0, total: 0 },
      court_ramasse: { gain_point: 0, sans_effet: 0, negatif: 0, decisif: 0, total: 0 },
    };
    
    // Cross-reference: shotType -> shotResult distribution (failed tirs only)
    const crossTypeResult: Record<string, { court_droite: number; court_gauche: number; long: number; tir_bouchon: number; total: number }> = {
      au_fer: { court_droite: 0, court_gauche: 0, long: 0, tir_bouchon: 0, total: 0 },
      au_plomb: { court_droite: 0, court_gauche: 0, long: 0, tir_bouchon: 0, total: 0 },
      en_rafle: { court_droite: 0, court_gauche: 0, long: 0, tir_bouchon: 0, total: 0 },
    };
    
    filteredMatches.forEach(match => {
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          totalTirs += pa.actions.tirs;
          tirsSuccess += pa.actions.tirsSuccess;
          carreaux += pa.actions.carreaux;
          
          if ((pa as any).detailedShots) {
            (pa as any).detailedShots.filter((s: any) => s.actionType === 'tir').forEach((shot: any) => {
              if (shot.shotType && shotTypeStats[shot.shotType]) {
                shotTypeStats[shot.shotType].total++;
                if (shot.success) shotTypeStats[shot.shotType].success++;
              }
              // Track shot result (for failed tirs - new field)
              if (shot.shotResult && shotResultStats[shot.shotResult] !== undefined) {
                shotResultStats[shot.shotResult]++;
              }
              // Backward compatibility: also check shotType for legacy data
              if (!shot.shotResult && !shot.success && shot.shotType) {
                if (shotResultStats[shot.shotType] !== undefined) {
                  shotResultStats[shot.shotType]++;
                }
              }
              if (shot.carreau) { shotTypeStats.carreau.total++; shotTypeStats.carreau.success++; }
              if (shot.shotQuality && shotQualityStats[shot.shotQuality] !== undefined) {
                shotQualityStats[shot.shotQuality]++;
                // Cross-reference: track impact per shot type
                if (shot.shotType && crossTypeImpact[shot.shotType]) {
                  const impactKey = shot.shotQuality as keyof typeof crossTypeImpact['au_fer'];
                  if (impactKey !== 'total' && crossTypeImpact[shot.shotType][impactKey] !== undefined) {
                    crossTypeImpact[shot.shotType][impactKey]++;
                    crossTypeImpact[shot.shotType].total++;
                  }
                }
              }
              // Cross-reference: track shotResult per shot type (failed tirs only)
              if (!shot.success && shot.shotType && crossTypeResult[shot.shotType]) {
                const resultKey = shot.shotResult || shot.shotType; // backward compat
                if (resultKey && crossTypeResult[shot.shotType][resultKey as keyof typeof crossTypeResult['au_fer']] !== undefined) {
                  const rk = resultKey as 'court_droite' | 'court_gauche' | 'long' | 'tir_bouchon';
                  crossTypeResult[shot.shotType][rk]++;
                  crossTypeResult[shot.shotType].total++;
                }
              }
            });
          }
        });
      }
    });
    
    let challengeTirs = 0, challengeSuccess = 0, challengeCarreaux = 0;
    filteredChallenges.forEach(c => {
      if (c.type === '10_tirs' || c.type === '10_tirs_sautee') {
        challengeTirs += c.totalShots || 0;
        challengeSuccess += c.successCount || 0;
        challengeCarreaux += c.carreauCount || 0;
      }
    });

    // Process challenge detailed shots for advanced analysis
    filteredChallenges.forEach(c => {
      if (c.detailedShots) {
        c.detailedShots.filter(s => s.actionType === 'tir').forEach((shot: any) => {
          if (shot.shotType && shotTypeStats[shot.shotType]) {
            shotTypeStats[shot.shotType].total++;
            if (shot.success) shotTypeStats[shot.shotType].success++;
          }
          if (shot.shotResult && shotResultStats[shot.shotResult] !== undefined) {
            shotResultStats[shot.shotResult]++;
          }
          if (!shot.shotResult && !shot.success && shot.shotType) {
            if (shotResultStats[shot.shotType] !== undefined) {
              shotResultStats[shot.shotType]++;
            }
          }
          if (shot.carreau) { shotTypeStats.carreau.total++; shotTypeStats.carreau.success++; }
          if (shot.shotQuality && shotQualityStats[shot.shotQuality] !== undefined) {
            shotQualityStats[shot.shotQuality]++;
            if (shot.shotType && crossTypeImpact[shot.shotType]) {
              const impactKey = shot.shotQuality as keyof typeof crossTypeImpact['au_fer'];
              if (impactKey !== 'total' && crossTypeImpact[shot.shotType][impactKey] !== undefined) {
                crossTypeImpact[shot.shotType][impactKey]++;
                crossTypeImpact[shot.shotType].total++;
              }
            }
          }
          if (!shot.success && shot.shotType && crossTypeResult[shot.shotType]) {
            const resultKey = shot.shotResult || shot.shotType;
            if (resultKey && crossTypeResult[shot.shotType][resultKey as keyof typeof crossTypeResult['au_fer']] !== undefined) {
              const rk = resultKey as 'court_droite' | 'court_gauche' | 'long' | 'tir_bouchon';
              crossTypeResult[shot.shotType][rk]++;
              crossTypeResult[shot.shotType].total++;
            }
          }
        });
      }
    });
    
    const combinedTirs = totalTirs + challengeTirs;
    const combinedSuccess = tirsSuccess + challengeSuccess;
    const combinedCarreaux = carreaux + challengeCarreaux;
    
    const successRate = combinedTirs > 0 ? Math.round((combinedSuccess / combinedTirs) * 100) : 0;
    const carreauRate = combinedTirs > 0 ? Math.round((combinedCarreaux / combinedTirs) * 100) : 0;
    const missedRate = combinedTirs > 0 ? Math.round(((combinedTirs - combinedSuccess) / combinedTirs) * 100) : 0;
    const tirsPerMatch = filteredMatches.length > 0 ? (totalTirs / filteredMatches.length).toFixed(1) : '0';
    const tirsPerMene = performanceStats.totalMenes > 0 ? (totalTirs / performanceStats.totalMenes).toFixed(1) : '0';
    const demiTirs = combinedSuccess - combinedCarreaux;
    const demiTirRate = combinedTirs > 0 ? Math.round((demiTirs / combinedTirs) * 100) : 0;
    
    const hasDetailedData = Object.values(shotTypeStats).some(s => s.total > 0) || Object.values(shotQualityStats).some(v => v > 0);
    const totalDetailedTirs = Object.values(shotTypeStats).reduce((sum, s) => sum + s.total, 0);
    const totalQualityTracked = Object.values(shotQualityStats).reduce((sum, v) => sum + v, 0);

    const hasCrossData = Object.values(crossTypeImpact).some(v => v.total > 0);
    const totalCrossTracked = Object.values(crossTypeImpact).reduce((sum, v) => sum + v.total, 0);

    const hasCrossResultData = Object.values(crossTypeResult).some(v => v.total > 0);
    const totalCrossResultTracked = Object.values(crossTypeResult).reduce((sum, v) => sum + v.total, 0);

    return {
      totalTirs: combinedTirs, tirsSuccess: combinedSuccess, carreaux: combinedCarreaux,
      successRate, carreauRate, demiTirRate, missedRate, tirsPerMatch, tirsPerMene,
      matchTirs: totalTirs, challengeTirs, hasDetailedData, totalDetailedTirs, totalQualityTracked,
      crossTypeImpact, hasCrossData, totalCrossTracked,
      crossTypeResult, hasCrossResultData, totalCrossResultTracked,
      tirGainPoint: shotQualityStats.gain_point, tirSansEffet: shotQualityStats.sans_effet,
      tirNegatif: shotQualityStats.negatif, tirsDecisifs: shotQualityStats.decisif,
      tirAuFer: shotTypeStats.au_fer, tirAuPlomb: shotTypeStats.au_plomb,
      tirEnRafle: shotTypeStats.en_rafle, tirCourtRamasse: shotTypeStats.court_ramasse,
      tirCarreau: shotTypeStats.carreau,
      tirCourtDroite: shotResultStats.court_droite,
      tirCourtGauche: shotResultStats.court_gauche,
      tirLong: shotResultStats.long,
      tirBouchon: shotResultStats.tir_bouchon,
    };
  }, [filteredMatches, filteredChallenges, performanceStats.totalMenes]);

// POINT STATS
  const pointStats = useMemo(() => {
    let totalPoints = 0, pointsSuccess = 0;
    
    const pointTypeStats: Record<string, { total: number; success: number }> = {
      roule: { total: 0, success: 0 }, plombe: { total: 0, success: 0 },
      demi_portee: { total: 0, success: 0 }, portee: { total: 0, success: 0 },
    };
    
    const pointQualityStats: Record<string, number> = {
      excellent: 0, bon: 0, moyen: 0, au_bouchon: 0, devant_boule: 0, rate: 0, crochete: 0, sorti: 0,
    };
    
    filteredMatches.forEach(match => {
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          totalPoints += pa.actions.points;
          pointsSuccess += pa.actions.pointsSuccess;
          
          if ((pa as any).detailedShots) {
            (pa as any).detailedShots.filter((s: any) => s.actionType === 'point').forEach((shot: any) => {
              if (shot.pointType && pointTypeStats[shot.pointType]) {
                pointTypeStats[shot.pointType].total++;
                if (shot.success) pointTypeStats[shot.pointType].success++;
              }
              if (shot.pointQuality && pointQualityStats[shot.pointQuality] !== undefined) {
                pointQualityStats[shot.pointQuality]++;
              }
            });
          }
        });
      }
    });
    
    const successRate = totalPoints > 0 ? Math.round((pointsSuccess / totalPoints) * 100) : 0;
    const pointsPerMene = performanceStats.totalMenes > 0 ? (totalPoints / performanceStats.totalMenes).toFixed(1) : '0';
    
    const hasDetailedData = Object.values(pointTypeStats).some(s => s.total > 0) || Object.values(pointQualityStats).some(v => v > 0);
    const totalDetailedPoints = Object.values(pointTypeStats).reduce((sum, s) => sum + s.total, 0);
    const totalQualityTracked = Object.values(pointQualityStats).reduce((sum, v) => sum + v, 0);
    const successQualitiesTotal = pointQualityStats.excellent + pointQualityStats.bon + pointQualityStats.moyen + pointQualityStats.au_bouchon + pointQualityStats.devant_boule;
    const failureQualitiesTotal = pointQualityStats.rate + pointQualityStats.crochete + pointQualityStats.sorti;

    // Cross-reference: pointType -> quality distribution
    const crossTypeQuality: Record<string, { excellent: number; bon: number; moyen: number; au_bouchon: number; devant_boule: number; rate: number; crochete: number; sorti: number; total: number; successTotal: number; failTotal: number }> = {
      roule: { excellent: 0, bon: 0, moyen: 0, au_bouchon: 0, devant_boule: 0, rate: 0, crochete: 0, sorti: 0, total: 0, successTotal: 0, failTotal: 0 },
      plombe: { excellent: 0, bon: 0, moyen: 0, au_bouchon: 0, devant_boule: 0, rate: 0, crochete: 0, sorti: 0, total: 0, successTotal: 0, failTotal: 0 },
      demi_portee: { excellent: 0, bon: 0, moyen: 0, au_bouchon: 0, devant_boule: 0, rate: 0, crochete: 0, sorti: 0, total: 0, successTotal: 0, failTotal: 0 },
      portee: { excellent: 0, bon: 0, moyen: 0, au_bouchon: 0, devant_boule: 0, rate: 0, crochete: 0, sorti: 0, total: 0, successTotal: 0, failTotal: 0 },
    };

    filteredMatches.forEach(match => {
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          if ((pa as any).detailedShots) {
            (pa as any).detailedShots.filter((s: any) => s.actionType === 'point').forEach((shot: any) => {
              if (shot.pointType && crossTypeQuality[shot.pointType] && shot.pointQuality) {
                const entry = crossTypeQuality[shot.pointType];
                const qKey = shot.pointQuality as keyof typeof entry;
                if (qKey !== 'total' && qKey !== 'successTotal' && qKey !== 'failTotal' && entry[qKey] !== undefined) {
                  (entry as any)[qKey]++;
                  entry.total++;
                  if (shot.success) entry.successTotal++;
                  else entry.failTotal++;
                }
              }
            });
          }
        });
      }
    });

    const hasCrossData = Object.values(crossTypeQuality).some(v => v.total > 0);
    const totalCrossTracked = Object.values(crossTypeQuality).reduce((sum, v) => sum + v.total, 0);

    return {
      totalPoints, pointsSuccess, successRate, pointsPerMene,
      hasDetailedData, totalDetailedPoints, totalQualityTracked,
      crossTypeQuality, hasCrossData, totalCrossTracked,
      pointRoule: pointTypeStats.roule, pointPlombe: pointTypeStats.plombe,
      pointDemiPortee: pointTypeStats.demi_portee, pointPortee: pointTypeStats.portee,
      pointExcellent: pointQualityStats.excellent, pointBon: pointQualityStats.bon,
      pointMoyen: pointQualityStats.moyen, pointAuBouchon: pointQualityStats.au_bouchon,
      pointDevantBoule: pointQualityStats.devant_boule, successQualitiesTotal, pointRate: pointQualityStats.rate,
      pointCrochete: pointQualityStats.crochete, pointSorti: pointQualityStats.sorti,
      failureQualitiesTotal,
    };
  }, [filteredMatches, performanceStats.totalMenes]);

// ERROR ANALYSIS STATS
  const errorStats = useMemo(() => {
    // Total errors
    const totalTirErrors = tirStats.totalTirs - tirStats.tirsSuccess;
    const totalPointErrors = pointStats.totalPoints - pointStats.pointsSuccess;
    const totalErrors = totalTirErrors + totalPointErrors;
    
    // Error rate by match duration
    const shortMatches = filteredMatches.filter(m => m.duration && m.duration < 30);
    const mediumMatches = filteredMatches.filter(m => m.duration && m.duration >= 30 && m.duration < 60);
    const longMatches = filteredMatches.filter(m => m.duration && m.duration >= 60);
    
    const getErrorRate = (matchList: typeof filteredMatches) => {
      let tirs = 0, tirsSuccess = 0, points = 0, pointsSuccess = 0;
      matchList.forEach(m => {
        if (m.playerActions) {
          m.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
            tirs += pa.actions.tirs;
            tirsSuccess += pa.actions.tirsSuccess;
            points += pa.actions.points;
            pointsSuccess += pa.actions.pointsSuccess;
          });
        }
      });
      const totalAttempts = tirs + points;
      const totalSuccess = tirsSuccess + pointsSuccess;
      return totalAttempts > 0 ? Math.round(((totalAttempts - totalSuccess) / totalAttempts) * 100) : 0;
    };
    
    const shortMatchErrorRate = getErrorRate(shortMatches);
    const mediumMatchErrorRate = getErrorRate(mediumMatches);
    const longMatchErrorRate = getErrorRate(longMatches);
    
    // Error by format
    const errorByFormat: Record<string, { errors: number; total: number; rate: number }> = {};
    ['Tête-à-tête', 'Doublette', 'Triplette'].forEach(format => {
      const formatMatches = filteredMatches.filter(m => m.format === format);
      let tirs = 0, tirsSuccess = 0, points = 0, pointsSuccess = 0;
      formatMatches.forEach(m => {
        if (m.playerActions) {
          m.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
            tirs += pa.actions.tirs;
            tirsSuccess += pa.actions.tirsSuccess;
            points += pa.actions.points;
            pointsSuccess += pa.actions.pointsSuccess;
          });
        }
      });
      const total = tirs + points;
      const errors = total - (tirsSuccess + pointsSuccess);
      errorByFormat[format] = {
        errors, total, rate: total > 0 ? Math.round((errors / total) * 100) : 0,
      };
    });
    
    // Error by mode
    const trainingMatches = filteredMatches.filter(m => m.mode === 'Entraînement');
    const tournamentMatches = filteredMatches.filter(m => m.mode === 'Tournoi');
    const trainingErrorRate = getErrorRate(trainingMatches);
    const tournamentErrorRate = getErrorRate(tournamentMatches);
    
    // Consecutive errors analysis (streaks of failures)
    let maxConsecutiveErrors = 0;
    let currentConsecutiveErrors = 0;
    let totalErrorStreaks = 0;
    
    filteredMatches.forEach(match => {
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          if ((pa as any).detailedShots) {
            (pa as any).detailedShots.forEach((shot: any) => {
              if (!shot.success) {
                currentConsecutiveErrors++;
                maxConsecutiveErrors = Math.max(maxConsecutiveErrors, currentConsecutiveErrors);
              } else {
                if (currentConsecutiveErrors >= 3) totalErrorStreaks++;
                currentConsecutiveErrors = 0;
              }
            });
          }
        });
      }
    });
    
    // Detailed tir error types - shot result (where the shot went)
    const tirErrorResults = {
      courtDroite: tirStats.tirCourtDroite,
      courtGauche: tirStats.tirCourtGauche,
      long: tirStats.tirLong,
      tirBouchon: tirStats.tirBouchon,
    };
    const totalTirErrorResults = Object.values(tirErrorResults).reduce((a, b) => a + b, 0);
    
    // Technique failure rates (separate from results to avoid double counting)
    const tirErrorByTechnique = {
      auFerRate: tirStats.tirAuFer.total - tirStats.tirAuFer.success,
      auPlombRate: tirStats.tirAuPlomb.total - tirStats.tirAuPlomb.success,
      enRafleRate: tirStats.tirEnRafle.total - tirStats.tirEnRafle.success,
    };
    const totalTirErrorByTechnique = Object.values(tirErrorByTechnique).reduce((a, b) => a + b, 0);
    
    // Combined for backward compat - use results as primary, technique as secondary
    const tirErrorTypes = { ...tirErrorResults };
    const totalTirErrorTyped = totalTirErrorResults > 0 ? totalTirErrorResults : totalTirErrorByTechnique;
    
    // Detailed point error types
    const pointErrorTypes = {
      rate: pointStats.pointRate,
      crochete: pointStats.pointCrochete,
      sorti: pointStats.pointSorti,
      rouleRate: pointStats.pointRoule.total - pointStats.pointRoule.success,
      plombeRate: pointStats.pointPlombe.total - pointStats.pointPlombe.success,
      demiPorteeRate: pointStats.pointDemiPortee.total - pointStats.pointDemiPortee.success,
      porteeRate: pointStats.pointPortee.total - pointStats.pointPortee.success,
    };
    const totalPointErrorTyped = Object.values(pointErrorTypes).reduce((a, b) => a + b, 0);
    
    // Most common error
    const allErrors = [
      { type: t('stats', 'errorCourtDroite'), count: tirErrorResults.courtDroite, category: 'tir' },
      { type: t('stats', 'errorCourtGauche'), count: tirErrorResults.courtGauche, category: 'tir' },
      { type: t('stats', 'errorLong'), count: tirErrorResults.long, category: 'tir' },
      { type: t('stats', 'errorTirBouchon'), count: tirErrorResults.tirBouchon, category: 'tir' },
      { type: t('stats', 'errorPointRate'), count: pointErrorTypes.rate, category: 'point' },
      { type: t('stats', 'errorPointCrochete'), count: pointErrorTypes.crochete, category: 'point' },
      { type: t('stats', 'errorPointSorti'), count: pointErrorTypes.sorti, category: 'point' },
    ].filter(e => e.count > 0).sort((a, b) => b.count - a.count);
    
    const mostCommonError = allErrors.length > 0 ? allErrors[0] : null;
    
    return {
      totalErrors, totalTirErrors, totalPointErrors,
      tirErrorRate: tirStats.missedRate, pointErrorRate: 100 - pointStats.successRate,
      shortMatchErrorRate, mediumMatchErrorRate, longMatchErrorRate,
      shortMatchCount: shortMatches.length, mediumMatchCount: mediumMatches.length, longMatchCount: longMatches.length,
      errorByFormat, trainingErrorRate, tournamentErrorRate,
      maxConsecutiveErrors, totalErrorStreaks,
      tirErrorTypes, totalTirErrorTyped,
      tirErrorResults, totalTirErrorResults,
      tirErrorByTechnique, totalTirErrorByTechnique,
      pointErrorTypes, totalPointErrorTyped,
      mostCommonError, allErrors,
    };
  }, [filteredMatches, tirStats, pointStats, language]);

  const boulesSetStats = useMemo(() => {
    const bySet: Record<string, {
      name: string; brand?: string; diameter?: number; weight?: number;
      matches: number; wins: number;
      tirs: number; tirsSuccess: number; carreaux: number;
      points: number; pointsSuccess: number;
      challenges: number;
      devantBoule: number; pointQualitiesSuccess: number;
    }> = {};

    filteredMatches.forEach(match => {
      if (!match.boulesSetId) return;
      const bs = boulesSets.find(b => b.id === match.boulesSetId);
      if (!bs) return;
      if (!bySet[match.boulesSetId]) bySet[match.boulesSetId] = {
        name: bs.name, brand: bs.brand, diameter: bs.diameter, weight: bs.weight,
        matches: 0, wins: 0, tirs: 0, tirsSuccess: 0, carreaux: 0, points: 0, pointsSuccess: 0, challenges: 0,
        devantBoule: 0, pointQualitiesSuccess: 0,
      };
      const s = bySet[match.boulesSetId];
      s.matches++;
      if (match.winner === 'A') s.wins++;
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          s.tirs += pa.actions.tirs;
          s.tirsSuccess += pa.actions.tirsSuccess;
          s.carreaux += pa.actions.carreaux;
          s.points += pa.actions.points;
          s.pointsSuccess += pa.actions.pointsSuccess;
          if ((pa as any).detailedShots) {
            (pa as any).detailedShots.filter((shot: any) => shot.actionType === 'point' && shot.success && shot.pointQuality).forEach((shot: any) => {
              s.pointQualitiesSuccess++;
              if (shot.pointQuality === 'devant_boule') s.devantBoule++;
            });
          }
        });
      }
    });

    filteredChallenges.forEach(ch => {
      if (!ch.boulesSetId) return;
      const bs = boulesSets.find(b => b.id === ch.boulesSetId);
      if (!bs) return;
      if (!bySet[ch.boulesSetId]) bySet[ch.boulesSetId] = {
        name: bs.name, brand: bs.brand, diameter: bs.diameter, weight: bs.weight,
        matches: 0, wins: 0, tirs: 0, tirsSuccess: 0, carreaux: 0, points: 0, pointsSuccess: 0, challenges: 0,
        devantBoule: 0, pointQualitiesSuccess: 0,
      };
      bySet[ch.boulesSetId].challenges++;
    });

    const sets = Object.keys(bySet).sort((a, b) => (bySet[b].matches + bySet[b].challenges) - (bySet[a].matches + bySet[a].challenges));
    const totalWithBoules = sets.reduce((sum, id) => sum + bySet[id].matches, 0);
    return { bySet, sets, hasData: sets.length > 0, totalWithBoules };
  }, [filteredMatches, filteredChallenges, boulesSets]);

  const terrainTypeStats = useMemo(() => {
    const getTerrainType = (match: typeof filteredMatches[0]): string | null => {
      if ((match as any).terrainType) return (match as any).terrainType;
      if (match.tournamentId) {
        const tour = tournaments.find(t => t.id === match.tournamentId);
        if (tour?.terrainType) return tour.terrainType;
      }
      return null;
    };

    const byTerrain: Record<string, {
      matches: number; wins: number;
      tirs: number; tirsSuccess: number; carreaux: number;
      points: number; pointsSuccess: number;
    }> = {};

    filteredMatches.forEach(match => {
      const tt = getTerrainType(match);
      if (!tt) return;
      if (!byTerrain[tt]) byTerrain[tt] = { matches: 0, wins: 0, tirs: 0, tirsSuccess: 0, carreaux: 0, points: 0, pointsSuccess: 0 };
      const s = byTerrain[tt];
      s.matches++;
      if (match.winner === 'A') s.wins++;
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          s.tirs += pa.actions.tirs;
          s.tirsSuccess += pa.actions.tirsSuccess;
          s.carreaux += pa.actions.carreaux;
          s.points += pa.actions.points;
          s.pointsSuccess += pa.actions.pointsSuccess;
          if ((pa as any).detailedShots) {
            (pa as any).detailedShots.filter((shot: any) => shot.actionType === 'point' && shot.success && shot.pointQuality).forEach((shot: any) => {
              s.pointQualitiesSuccess++;
              if (shot.pointQuality === 'devant_boule') s.devantBoule++;
            });
          }
        });
      }
    });

    const types = Object.keys(byTerrain).sort((a, b) => byTerrain[b].matches - byTerrain[a].matches);
    const totalTerrainMatches = types.reduce((sum, t) => sum + byTerrain[t].matches, 0);
    return { byTerrain, types, hasData: types.length > 0, totalTerrainMatches };
  }, [filteredMatches, tournaments]);

  const precisionWorkshopStats = useMemo(() => {
    const precisionChallenges = filteredChallenges.filter(c => c.type === 'precision' && c.precisionShots && c.precisionShots.length > 0);
    if (precisionChallenges.length === 0) return null;

    const ATELIERS = ['boule_seule', 'derriere_but', 'entre_2_boules', 'sautee', 'tir_but'] as const;
    const atelierData: Record<string, {
      totalShots: number; totalPoints: number; maxSingleShot: number;
      sessions: number; bestSessionScore: number;
      sessionScores: { date: string; score: number }[];
      successCount: number; maxSessionPoints: number;
    }> = {};

    ATELIERS.forEach(a => {
      atelierData[a] = { totalShots: 0, totalPoints: 0, maxSingleShot: 0, sessions: 0, bestSessionScore: 0, sessionScores: [], successCount: 0, maxSessionPoints: 0 };
    });

    // Sort challenges by date for evolution tracking
    const sortedChallenges = [...precisionChallenges].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedChallenges.forEach(c => {
      const sessionAtelierScores: Record<string, { score: number; shots: number }> = {};
      c.precisionShots!.forEach(ps => {
        const data = atelierData[ps.atelier];
        if (data) {
          data.totalShots++;
          data.totalPoints += ps.points;
          data.maxSingleShot = Math.max(data.maxSingleShot, ps.points);
          if (ps.points >= 3) data.successCount++;
          if (!sessionAtelierScores[ps.atelier]) sessionAtelierScores[ps.atelier] = { score: 0, shots: 0 };
          sessionAtelierScores[ps.atelier].score += ps.points;
          sessionAtelierScores[ps.atelier].shots++;
        }
      });

      Object.entries(sessionAtelierScores).forEach(([atelier, info]) => {
        if (atelierData[atelier]) {
          atelierData[atelier].sessions++;
          atelierData[atelier].sessionScores.push({ date: c.date, score: info.score });
          atelierData[atelier].bestSessionScore = Math.max(atelierData[atelier].bestSessionScore, info.score);
          atelierData[atelier].maxSessionPoints = Math.max(atelierData[atelier].maxSessionPoints, info.shots * 5);
        }
      });
    });

    const activeAteliers = ATELIERS.filter(a => atelierData[a].totalShots > 0);

    return {
      atelierData,
      totalSessions: precisionChallenges.length,
      activeAteliers,
      hasData: activeAteliers.length > 0,
    };
  }, [filteredChallenges]);

  const progressionData = useMemo(() => {
    const selectedFilter = PROGRESSION_FILTERS.find(f => f.id === progressionFilter) || PROGRESSION_FILTERS[1];
    const weeksToShow = selectedFilter.weeks;
    
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // For periods > 52 weeks, group by month instead of week
    const useMonthly = weeksToShow > 52;
    
    const weeklyData: { 
      week: string; weekDate: Date; matches: number; wins: number; winRate: number;
      tirSuccess: number; tirTotal: number; tirRate: number;
      pointSuccess: number; pointTotal: number; pointRate: number;
      carreaux: number; errors: number; errorRate: number;
    }[] = [];
    
    if (sortedMatches.length === 0) return { weeklyData, weeksToShow, useMonthly };
    
    const now = new Date();
    
    if (useMonthly) {
      // Monthly grouping for long periods
      const totalMonths = Math.ceil(weeksToShow / 4.33);
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - totalMonths);
      startDate.setDate(1);
      
      const currentDate = new Date(startDate);
      
      while (currentDate <= now) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
        
        const monthMatches = sortedMatches.filter(m => {
          const matchDate = new Date(m.date);
          return matchDate >= monthStart && matchDate <= monthEnd;
        });
        
        let tirSuccess = 0, tirTotal = 0, pointSuccess = 0, pointTotal = 0, carreaux = 0;
        monthMatches.forEach(match => {
          if (match.playerActions) {
            match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
              tirTotal += pa.actions.tirs;
              tirSuccess += pa.actions.tirsSuccess;
              pointTotal += pa.actions.points;
              pointSuccess += pa.actions.pointsSuccess;
              carreaux += pa.actions.carreaux;
            });
          }
        });
        
        const wins = monthMatches.filter(m => m.winner === 'A').length;
        const totalAttempts = tirTotal + pointTotal;
        const totalSuccess = tirSuccess + pointSuccess;
        const errors = totalAttempts - totalSuccess;
        
        const monthLabel = `${monthStart.getMonth() + 1}/${String(monthStart.getFullYear()).slice(-2)}`;
        
        weeklyData.push({
          week: monthLabel,
          weekDate: new Date(monthStart),
          matches: monthMatches.length,
          wins,
          winRate: monthMatches.length > 0 ? Math.round((wins / monthMatches.length) * 100) : 0,
          tirSuccess, tirTotal,
          tirRate: tirTotal > 0 ? Math.round((tirSuccess / tirTotal) * 100) : 0,
          pointSuccess, pointTotal,
          pointRate: pointTotal > 0 ? Math.round((pointSuccess / pointTotal) * 100) : 0,
          carreaux, errors,
          errorRate: totalAttempts > 0 ? Math.round((errors / totalAttempts) * 100) : 0,
        });
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    } else {
      // Weekly grouping for shorter periods
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - (weeksToShow * 7));
      startDate.setDate(startDate.getDate() - startDate.getDay());
      
      const currentDate = new Date(startDate);
      
      while (currentDate <= now) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const weekMatches = sortedMatches.filter(m => {
          const matchDate = new Date(m.date);
          return matchDate >= weekStart && matchDate <= weekEnd;
        });
        
        let tirSuccess = 0, tirTotal = 0, pointSuccess = 0, pointTotal = 0, carreaux = 0;
        weekMatches.forEach(match => {
          if (match.playerActions) {
            match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
              tirTotal += pa.actions.tirs;
              tirSuccess += pa.actions.tirsSuccess;
              pointTotal += pa.actions.points;
              pointSuccess += pa.actions.pointsSuccess;
              carreaux += pa.actions.carreaux;
            });
          }
        });
        
        const wins = weekMatches.filter(m => m.winner === 'A').length;
        const totalAttempts = tirTotal + pointTotal;
        const totalSuccess = tirSuccess + pointSuccess;
        const errors = totalAttempts - totalSuccess;
        
        weeklyData.push({
          week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
          weekDate: new Date(weekStart),
          matches: weekMatches.length,
          wins,
          winRate: weekMatches.length > 0 ? Math.round((wins / weekMatches.length) * 100) : 0,
          tirSuccess, tirTotal,
          tirRate: tirTotal > 0 ? Math.round((tirSuccess / tirTotal) * 100) : 0,
          pointSuccess, pointTotal,
          pointRate: pointTotal > 0 ? Math.round((pointSuccess / pointTotal) * 100) : 0,
          carreaux, errors,
          errorRate: totalAttempts > 0 ? Math.round((errors / totalAttempts) * 100) : 0,
        });
        
        currentDate.setDate(currentDate.getDate() + 7);
      }
    }
    
    return { weeklyData, weeksToShow, useMonthly };
  }, [matches, progressionFilter]);

  // Calculate trends
  const trends = useMemo(() => {
    const data = progressionData.weeklyData;
    if (data.length < 2) return { winRate: 'neutral', tirRate: 'neutral', pointRate: 'neutral', errorRate: 'neutral' };
    
    const recentWeeks = data.slice(-4);
    const olderWeeks = data.slice(-8, -4);
    
    const getAvg = (weeks: typeof data, field: 'winRate' | 'tirRate' | 'pointRate' | 'errorRate') => {
      const validWeeks = weeks.filter(w => w.matches > 0);
      if (validWeeks.length === 0) return 0;
      return validWeeks.reduce((sum, w) => sum + w[field], 0) / validWeeks.length;
    };
    
    const getTrend = (recent: number, older: number, isError = false) => {
      const diff = recent - older;
      if (Math.abs(diff) < 5) return 'neutral' as const;
      if (isError) return diff > 0 ? 'down' as const : 'up' as const;
      return diff > 0 ? 'up' as const : 'down' as const;
    };
    
    return {
      winRate: getTrend(getAvg(recentWeeks, 'winRate'), getAvg(olderWeeks, 'winRate')),
      tirRate: getTrend(getAvg(recentWeeks, 'tirRate'), getAvg(olderWeeks, 'tirRate')),
      pointRate: getTrend(getAvg(recentWeeks, 'pointRate'), getAvg(olderWeeks, 'pointRate')),
      errorRate: getTrend(getAvg(recentWeeks, 'errorRate'), getAvg(olderWeeks, 'errorRate'), true),
    };
  }, [progressionData]);

  const challengeProgressionData = useMemo(() => {
    const sel = PROGRESSION_FILTERS.find(f => f.id === progressionFilter) || PROGRESSION_FILTERS[1];
    const weeksToShow = sel.weeks;
    const sorted = [...challenges].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sorted.length === 0) return { weeklyData: [], hasData: false };
    const now = new Date(); const start = new Date(now); start.setDate(start.getDate() - (weeksToShow * 7)); start.setDate(start.getDate() - start.getDay());
    const TYPES = ['10_tirs', '10_tirs_sautee', 'precision'] as const;
    const cur = new Date(start); const weeklyData: { week: string; byType: Record<string, { count: number; avgRate: number }> }[] = [];
    while (cur <= now) {
      const ws = new Date(cur); const we = new Date(cur); we.setDate(we.getDate() + 6);
      const wc = sorted.filter(c => { const d = new Date(c.date); return d >= ws && d <= we; });
      const byType: Record<string, { count: number; avgRate: number }> = {};
      TYPES.forEach(type => { const tc = wc.filter(c => c.type === type); let tr = 0; tc.forEach(c => { if (type === 'precision') { tr += (c.maxPoints && c.maxPoints > 0) ? ((c.totalPoints || 0) / c.maxPoints) * 100 : 0; } else { tr += c.successRate || 0; } }); byType[type] = { count: tc.length, avgRate: tc.length > 0 ? Math.round(tr / tc.length) : 0 }; });
      weeklyData.push({ week: `${ws.getDate()}/${ws.getMonth() + 1}`, byType }); cur.setDate(cur.getDate() + 7);
    }
    return { weeklyData, hasData: weeklyData.some(w => Object.values(w.byType).some(t => t.count > 0)) };
  }, [challenges, progressionFilter]);

  // ============================================
  // TOURNAMENT PROGRESSION DATA
  // ============================================
  const tournamentProgressionData = useMemo(() => {
    const finishedTournaments = tournaments.filter(t => t.status === 'Terminé');
    if (finishedTournaments.length === 0) return { items: [], hasData: false };
    const RESULT_RANKS: Record<string, number> = { '1er': 100, '2ème': 85, '3ème': 70, 'Demi-finale': 55, 'Quart de finale': 40, '1/8 finale': 25, 'Poules': 10, 'Autre': 5 };
    const RESULT_COLORS: Record<string, string> = { '1er': '#FFD700', '2ème': '#A8B4C0', '3ème': '#CD7F32', 'Demi-finale': '#4A90D9', 'Quart de finale': '#F5A623', '1/8 finale': '#7B8794', 'Poules': '#7B8794', 'Autre': theme.textMuted };
    const items = finishedTournaments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(tour => {
      const tourMatches = matches.filter(m => m.tournamentId === tour.id);
      const wins = tourMatches.filter(m => m.winner === 'A').length;
      const totalM = tourMatches.length;
      const ptsFor = tourMatches.reduce((s, m) => s + (m.teamA?.score || 0), 0);
      const ptsAgainst = tourMatches.reduce((s, m) => s + (m.teamB?.score || 0), 0);
      return { id: tour.id, name: tour.name, date: tour.date, result: tour.finalResult || 'Autre', resultRank: RESULT_RANKS[tour.finalResult || ''] || 5, resultColor: RESULT_COLORS[tour.finalResult || ''] || theme.textMuted, winRate: totalM > 0 ? Math.round((wins / totalM) * 100) : 0, matches: totalM, wins, pointDiff: ptsFor - ptsAgainst, format: tour.format };
    });
    return { items, hasData: items.length > 0 };
  }, [tournaments, matches]);

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
