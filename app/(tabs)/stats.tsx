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
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import Svg, { Circle, Line, G, Text as SvgText, Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';
import AdBanner from '@/components/ui/AdBanner';

const defaultScreenWidth = Dimensions.get('window').width;

// ============================================
// TYPES & CONSTANTS
// ============================================
type TimeFilter = 'today' | 'week' | 'month' | '3months' | '6months' | 'year' | 'all';
type ProgressionFilter = '4weeks' | '8weeks' | '3months' | '6months' | 'year';
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
];

const CATEGORY_TAB_KEYS: { id: StatsCategory; key: string; icon: string; color: string }[] = [
  { id: 'performance', key: 'performance', icon: 'emoji-events', color: theme.primary },
  { id: 'tir', key: 'tir', icon: 'gps-fixed', color: theme.tirColor },
  { id: 'point', key: 'point', icon: 'adjust', color: theme.pointColor },
  { id: 'errors', key: 'errors', icon: 'error-outline', color: theme.error },
];

// ============================================
// HELPER FUNCTIONS
// ============================================
function filterByTime<T extends { date: string }>(items: T[], filter: TimeFilter): T[] {
  if (filter === 'all') return items;
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate: Date;
  switch (filter) {
    case 'today':
      startDate = new Date(startOfDay);
      break;
    case 'week':
      startDate = new Date(startOfDay);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(startOfDay);
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '3months':
      startDate = new Date(startOfDay);
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case '6months':
      startDate = new Date(startOfDay);
      startDate.setMonth(startDate.getMonth() - 6);
      break;
    case 'year':
      startDate = new Date(startOfDay);
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      return items;
  }
  
  return items.filter(item => new Date(item.date) >= startDate);
}

// ============================================
// COMPONENTS
// ============================================

// Progress Ring Component
function ProgressRing({ 
  value, 
  size = 80,
  strokeWidth = 6,
  color = theme.primary,
  label,
}: { 
  value: number; 
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill as any}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.ringValue, { color, fontSize: size * 0.22 }]}>{value}%</Text>
          {label && <Text style={[styles.ringLabel, { fontSize: size * 0.11 }]}>{label}</Text>}
        </View>
      </View>
    </View>
  );
}

// Stat Row Component
function StatRow({ 
  label, 
  value, 
  subValue, 
  icon, 
  color,
  isNA = false,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: string;
  color?: string;
  isNA?: boolean;
}) {
  return (
    <View style={styles.statRow}>
      {icon && (
        <View style={[styles.statRowIcon, { backgroundColor: (color || theme.primary) + '15' }]}>
          <MaterialIcons name={icon as any} size={16} color={color || theme.primary} />
        </View>
      )}
      <View style={styles.statRowContent}>
        <Text style={styles.statRowLabel}>{label}</Text>
        {subValue && <Text style={styles.statRowSubValue}>{subValue}</Text>}
      </View>
      <Text style={[styles.statRowValue, isNA && styles.statRowValueNA, color ? { color } : null]}>
        {isNA ? 'N/A' : value}
      </Text>
    </View>
  );
}

// Section Header
function SectionHeader({ title, subtitle, icon, color }: { 
  title: string; 
  subtitle?: string;
  icon?: string;
  color?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      {icon && (
        <View style={[styles.sectionIcon, { backgroundColor: (color || theme.primary) + '15' }]}>
          <MaterialIcons name={icon as any} size={18} color={color || theme.primary} />
        </View>
      )}
      <View style={styles.sectionHeaderText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

// Progress Bar
function ProgressBar({ value, color, showValue = true }: { value: number; color: string; showValue?: boolean }) {
  return (
    <View style={styles.progressBarContainer}>
      <View style={styles.progressBarTrack}>
        <Animated.View 
          entering={FadeIn.duration(600)}
          style={[styles.progressBarFill, { width: `${Math.min(value, 100)}%`, backgroundColor: color }]} 
        />
      </View>
      {showValue && <Text style={[styles.progressBarValue, { color }]}>{value}%</Text>}
    </View>
  );
}

// Breakdown Bar
function BreakdownBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <View style={styles.breakdownContainer}>
      <View style={styles.breakdownBar}>
        {items.map((item, i) => (
          <View 
            key={i}
            style={[
              styles.breakdownSegment, 
              { 
                width: total > 0 ? `${(item.value / total) * 100}%` : '0%', 
                backgroundColor: item.color,
                borderTopLeftRadius: i === 0 ? 4 : 0,
                borderBottomLeftRadius: i === 0 ? 4 : 0,
                borderTopRightRadius: i === items.length - 1 ? 4 : 0,
                borderBottomRightRadius: i === items.length - 1 ? 4 : 0,
              }
            ]} 
          />
        ))}
      </View>
      <View style={styles.breakdownLegend}>
        {items.map((item, i) => (
          <View key={i} style={styles.breakdownLegendItem}>
            <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
            <Text style={styles.breakdownLegendText}>{item.label}</Text>
            <Text style={styles.breakdownLegendValue}>{total > 0 ? Math.round((item.value / total) * 100) : 0}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// NA Placeholder
function NAPlaceholder({ message }: { message: string }) {
  return (
    <View style={styles.naPlaceholder}>
      <MaterialIcons name="hourglass-empty" size={20} color={theme.textMuted} />
      <Text style={styles.naText}>{message}</Text>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
type ItemFilterType = 'all' | 'match' | 'challenge' | 'tournament' | 'opponent' | 'partner' | 'terrain';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { matches, challenges, tournaments, players, terrains, getMatchesByTournament, selfPlayer } = useApp();
  const { t, language } = useLanguage();

  // Translated filter/tab arrays
  const TIME_FILTERS = useMemo(() => TIME_FILTER_KEYS.map(f => ({ ...f, label: t('stats', f.key) || t('common', f.key) })), [language]);
  const PROGRESSION_FILTERS = useMemo(() => PROGRESSION_FILTER_KEYS.map(f => ({ ...f, label: t('stats', f.key) })), [language]);
  const CATEGORY_TABS = useMemo(() => CATEGORY_TAB_KEYS.map(f => ({ ...f, label: t('stats', f.key) })), [language]);
  
  // Responsive dimensions for tablet
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;
  const modalChartWidth = isTablet ? Math.floor((Math.min(screenWidth, 960) - 112) / 2) : screenWidth - 64;
  const modalChartHeight = isTablet ? 190 : 160;
  const modalBarChartHeight = isTablet ? 160 : 140;

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [category, setCategory] = useState<StatsCategory>('performance');
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [progressionFilter, setProgressionFilter] = useState<ProgressionFilter>('8weeks');

  // Item filter state
  const [itemFilterType, setItemFilterType] = useState<ItemFilterType>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | null>(null);
  const [showItemPickerModal, setShowItemPickerModal] = useState(false);
  const [itemPickerType, setItemPickerType] = useState<'match' | 'challenge' | 'tournament' | 'opponent' | 'partner' | 'terrain'>('match');
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
    return timeFilteredMatches;
  }, [timeFilteredMatches, itemFilterType, selectedMatchId, selectedTournamentId, selectedOpponentId, selectedPartnerId, selectedTerrainId]);

  const filteredChallenges = useMemo(() => {
    if (itemFilterType === 'challenge' && selectedChallengeId) {
      return timeFilteredChallenges.filter(c => c.id === selectedChallengeId);
    }
    if (itemFilterType === 'opponent' && selectedOpponentId) {
      return timeFilteredChallenges.filter(c => c.mode === '1v1' && c.opponentId === selectedOpponentId);
    }
    // When filtering by match, tournament, or partner, don't include challenges in stats
    if (itemFilterType === 'match' || itemFilterType === 'tournament' || itemFilterType === 'partner' || itemFilterType === 'terrain') {
      return [];
    }
    return timeFilteredChallenges;
  }, [timeFilteredChallenges, itemFilterType, selectedChallengeId, selectedMatchId, selectedTournamentId, selectedOpponentId, selectedPartnerId, selectedTerrainId]);

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
      if (partner) return `${language === 'fr' ? 'avec' : 'with'} ${partner.name}`;
    }
    if (itemFilterType === 'terrain' && selectedTerrainId) {
      const terr = terrains.find(te => te.id === selectedTerrainId);
      if (terr) return terr.name;
    }
    return null;
  }, [itemFilterType, selectedMatchId, selectedChallengeId, selectedTournamentId, selectedOpponentId, selectedPartnerId, selectedTerrainId, matches, challenges, tournaments, players, terrains, language]);

  const clearItemFilter = () => {
    setItemFilterType('all');
    setSelectedMatchId(null);
    setSelectedChallengeId(null);
    setSelectedTournamentId(null);
    setSelectedOpponentId(null);
    setSelectedPartnerId(null);
    setSelectedTerrainId(null);
  };

  const openItemPicker = (type: 'match' | 'challenge' | 'tournament' | 'opponent' | 'partner' | 'terrain') => {
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
    setShowItemPickerModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ============================================
  // PERFORMANCE STATS CALCULATION
  // ============================================
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

  // ============================================
  // TIR STATS
  // ============================================
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

  // ============================================
  // POINT STATS
  // ============================================
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

  // ============================================
  // ERROR ANALYSIS STATS
  // ============================================
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

  // ============================================
  // TERRAIN TYPE STATS
  // ============================================
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
        });
      }
    });

    const types = Object.keys(byTerrain).sort((a, b) => byTerrain[b].matches - byTerrain[a].matches);
    const totalTerrainMatches = types.reduce((sum, t) => sum + byTerrain[t].matches, 0);
    return { byTerrain, types, hasData: types.length > 0, totalTerrainMatches };
  }, [filteredMatches, tournaments]);

  // ============================================
  // PRECISION WORKSHOP STATS
  // ============================================
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

  // ============================================
  // PROGRESSION DATA
  // ============================================
  const progressionData = useMemo(() => {
    const selectedFilter = PROGRESSION_FILTERS.find(f => f.id === progressionFilter) || PROGRESSION_FILTERS[1];
    const weeksToShow = selectedFilter.weeks;
    
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const weeklyData: { 
      week: string; weekDate: Date; matches: number; wins: number; winRate: number;
      tirSuccess: number; tirTotal: number; tirRate: number;
      pointSuccess: number; pointTotal: number; pointRate: number;
      carreaux: number; errors: number; errorRate: number;
    }[] = [];
    
    if (sortedMatches.length === 0) return { weeklyData, weeksToShow };
    
    const now = new Date();
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
    
    return { weeklyData, weeksToShow };
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

  const hasData = performanceStats.total > 0 || filteredChallenges.length > 0;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>{t('stats', 'statistics')}</Text>
            <Text style={styles.headerSubtitle}>
              {performanceStats.total} {t('stats', 'matches')} • {performanceStats.winRate}% {t('stats', 'victories')}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable 
              style={styles.progressionButton}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowProgressionModal(true); }}
            >
              <MaterialIcons name="trending-up" size={18} color={theme.primary} />
              <Text style={styles.progressionButtonText}>{t('stats', 'progression')}</Text>
            </Pressable>
            <Pressable style={styles.historyButton} onPress={() => router.push('/history')}>
              <MaterialIcons name="history" size={22} color={theme.textSecondary} />
            </Pressable>
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
          </ScrollView>
        </View>

        {/* Active Filter Indicator */}
        {activeFilterLabel && (
          <View style={styles.activeFilterBanner}>
            <MaterialIcons 
              name={itemFilterType === 'match' ? 'sports' : itemFilterType === 'challenge' ? 'flag' : itemFilterType === 'opponent' ? 'people' : itemFilterType === 'partner' ? 'group' : itemFilterType === 'terrain' ? 'sports-soccer' : 'emoji-events'} 
              size={14} 
              color={itemFilterType === 'match' ? theme.tirColor : itemFilterType === 'challenge' ? theme.accent : itemFilterType === 'opponent' ? theme.pointColor : itemFilterType === 'partner' ? theme.success : itemFilterType === 'terrain' ? '#8B5CF6' : theme.carreauColor} 
            />
            <Text style={styles.activeFilterText} numberOfLines={1}>{activeFilterLabel}</Text>
            <Pressable style={styles.activeFilterClear} onPress={clearItemFilter}>
              <MaterialIcons name="close" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
        )}

        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {CATEGORY_TABS.map(tab => (
            <Pressable
              key={tab.id}
              style={[styles.categoryTab, category === tab.id && styles.categoryTabActive]}
              onPress={() => { Haptics.selectionAsync(); setCategory(tab.id); }}
            >
              <MaterialIcons name={tab.icon as any} size={18} color={category === tab.id ? tab.color : theme.textMuted} />
              <Text style={[styles.categoryTabText, category === tab.id && [styles.categoryTabTextActive, { color: tab.color }]]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }, isTablet && styles.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
      >
        {!hasData ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="bar-chart" size={64} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>{t('stats', 'noStatsYet')}</Text>
            <Text style={styles.emptyText}>{t('stats', 'playToSee')}</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/match/new')}>
              <MaterialIcons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>{t('stats', 'newMatch')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* PERFORMANCE */}
            {category === 'performance' && (
              <>
                {/* Challenge-specific performance when filtering by challenge */}
                {itemFilterType === 'challenge' && filteredChallenges.length > 0 && performanceStats.total === 0 ? (
                  <>
                    {filteredChallenges.map((ch, idx) => {
                      const isPrecision = ch.type === 'precision';
                      const successRate = isPrecision
                        ? (ch.maxPoints && ch.maxPoints > 0 ? Math.round(((ch.totalPoints || 0) / ch.maxPoints) * 100) : 0)
                        : (ch.successRate ? Math.round(ch.successRate) : 0);
                      const heroLabel = isPrecision ? `${ch.totalPoints || 0}/${ch.maxPoints || 100} pts` : `${ch.successCount || 0}/${ch.totalShots || 10}`;
                      return (
                        <Animated.View key={ch.id} entering={FadeInDown.duration(400).delay(idx * 50)} style={[styles.heroCard, { borderLeftWidth: 4, borderLeftColor: theme.accent }]}>
                          <View style={styles.heroContent}>
                            <ProgressRing value={successRate} size={110} strokeWidth={9} color={theme.accent} label={t('stats', 'successLabel')} />
                            <View style={styles.heroStats}>
                              <View style={styles.heroStatItem}>
                                <Text style={[styles.heroStatValue, { color: theme.accent }]}>{heroLabel}</Text>
                                <Text style={styles.heroStatLabel}>{t('challengeNames', ch.type)}</Text>
                              </View>
                              {!isPrecision && ch.carreauCount ? (
                                <View style={styles.heroStatItem}>
                                  <Text style={[styles.heroStatValue, { color: theme.carreauColor }]}>{ch.carreauCount}</Text>
                                  <Text style={styles.heroStatLabel}>{t('stats', 'carreauxLabel')}</Text>
                                </View>
                              ) : null}
                              {ch.duration ? (
                                <View style={styles.heroStatItem}>
                                  <Text style={styles.heroStatValue}>{formatDuration(Math.round((ch.duration || 0) / 60))}</Text>
                                  <Text style={styles.heroStatLabel}>{t('match', 'durationLabel')}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          {ch.mode === '1v1' && ch.opponentName ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                              <MaterialIcons name="people" size={16} color={theme.textMuted} />
                              <Text style={{ fontSize: 12, color: theme.textSecondary }}>vs {ch.opponentName}</Text>
                              {ch.winner ? (
                                <View style={{ marginLeft: 'auto', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: ch.winner === 'player' ? theme.success + '20' : ch.winner === 'opponent' ? theme.error + '20' : theme.warning + '20' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: ch.winner === 'player' ? theme.success : ch.winner === 'opponent' ? theme.error : theme.warning }}>
                                    {ch.winner === 'player' ? t('history', 'victory') : ch.winner === 'opponent' ? t('history', 'defeat') : t('history', 'draw')}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                          {isPrecision && ch.atelierScores ? (
                            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>{t('stats', 'challengeAtelierScores')}</Text>
                              {Object.entries(ch.atelierScores).map(([atelier, score]) => (
                                <StatRow key={atelier} label={t('precisionWorkshops', atelier)} value={`${score} pts`} icon="sports-score" color={theme.accent} />
                              ))}
                            </View>
                          ) : null}
                        </Animated.View>
                      );
                    })}
                    {/* Tir stats summary for challenge */}
                    {tirStats.totalTirs > 0 && (
                      <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                        <SectionHeader title={t('stats', 'challengeTirSummary')} icon="gps-fixed" color={theme.tirColor} />
                        <View style={styles.card}>
                          <StatRow label={t('stats', 'shotsAttempted')} value={tirStats.totalTirs} icon="radio-button-unchecked" color={theme.textSecondary} />
                          <StatRow label={t('stats', 'successPercent')} value={`${tirStats.successRate}%`} icon="percent" color={theme.tirColor} />
                          <StatRow label={t('stats', 'carreauPercent')} value={`${tirStats.carreauRate}%`} icon="stars" color={theme.carreauColor} />
                        </View>
                      </Animated.View>
                    )}
                  </>
                ) : (
                <>
                <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroCard, isTablet && styles.heroCardTablet]}>
                  <View style={styles.heroContent}>
                    <ProgressRing value={performanceStats.winRate} size={isTablet ? 130 : 110} strokeWidth={isTablet ? 10 : 9} color={theme.primary} label={t('stats', 'victoriesLabel')} />
                    <View style={styles.heroStats}>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.success }]}>{performanceStats.wins}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'wonLabel')}</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.error }]}>{performanceStats.losses}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'lostLabel')}</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatValue}>{performanceStats.total}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'totalLabel')}</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                {/* Tablet 2-column row for games played + win rate by mode */}
                {isTablet ? (
                  <View style={styles.tabletRow}>
                    <Animated.View entering={FadeInDown.duration(400).delay(50)} style={[styles.section, styles.tabletHalf]}>
                      <SectionHeader title={t('stats', 'gamesPlayedSection')} icon="sports" color={theme.primary} />
                      <View style={styles.card}>
                        <View style={styles.statsGrid3}>
                          <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.total}</Text><Text style={styles.gridLabel}>{t('stats', 'totalLabel')}</Text></View>
                          <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.trainingCount}</Text><Text style={styles.gridLabel}>{t('stats', 'training')}</Text></View>
                          <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.tournamentCount}</Text><Text style={styles.gridLabel}>{t('stats', 'tournamentLabel')}</Text></View>
                        </View>
                      </View>
                    </Animated.View>
                    <Animated.View entering={FadeInDown.duration(400).delay(100)} style={[styles.section, styles.tabletHalf]}>
                      <SectionHeader title={t('stats', 'winRateByModeSection')} icon="emoji-events" color={theme.carreauColor} />
                      <View style={styles.card}>
                        <View style={styles.modeWinRates}>
                          <View style={styles.modeWinRateItem}>
                            <Text style={styles.modeLabel}>{t('stats', 'training')}</Text>
                            <ProgressBar value={performanceStats.trainingWinRate} color={theme.primary} />
                          </View>
                          <View style={styles.modeWinRateItem}>
                            <Text style={styles.modeLabel}>{t('stats', 'tournamentLabel')}</Text>
                            <ProgressBar value={performanceStats.tournamentWinRate} color={theme.carreauColor} />
                          </View>
                        </View>
                      </View>
                    </Animated.View>
                  </View>
                ) : (
                <>
                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title={t('stats', 'gamesPlayedSection')} icon="sports" color={theme.primary} />
                  <View style={styles.card}>
                    <View style={styles.statsGrid3}>
                      <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.total}</Text><Text style={styles.gridLabel}>{t('stats', 'totalLabel')}</Text></View>
                      <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.trainingCount}</Text><Text style={styles.gridLabel}>{t('stats', 'training')}</Text></View>
                      <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.tournamentCount}</Text><Text style={styles.gridLabel}>{t('stats', 'tournamentLabel')}</Text></View>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                  <SectionHeader title={t('stats', 'winRateByModeSection')} icon="emoji-events" color={theme.carreauColor} />
                  <View style={styles.card}>
                    <View style={styles.modeWinRates}>
                      <View style={styles.modeWinRateItem}>
                        <Text style={styles.modeLabel}>{t('stats', 'training')}</Text>
                        <ProgressBar value={performanceStats.trainingWinRate} color={theme.primary} />
                      </View>
                      <View style={styles.modeWinRateItem}>
                        <Text style={styles.modeLabel}>{t('stats', 'tournamentLabel')}</Text>
                        <ProgressBar value={performanceStats.tournamentWinRate} color={theme.carreauColor} />
                      </View>
                    </View>
                  </View>
                </Animated.View>
                </>
                )}

                {/* Ad Banner */}
                <AdBanner position="inline" />

                {/* Tablet 2-column row for format + score */}
                {isTablet ? (
                  <View style={styles.tabletRow}>
                    <Animated.View entering={FadeInDown.duration(400).delay(150)} style={[styles.section, styles.tabletHalf]}>
                      <SectionHeader title={t('stats', 'winRateByFormatSection')} icon="group" color={theme.accent} />
                      <View style={styles.card}>
                        {Object.entries(performanceStats.byFormat).map(([format, data]) => {
                          const rate = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0;
                          return (
                            <View key={format} style={styles.formatRow}>
                              <View style={styles.formatInfo}>
                                <Text style={styles.formatName}>{t('formats', format)}</Text>
                                <Text style={styles.formatRecord}>{data.wins}V - {data.total - data.wins}D ({data.total})</Text>
                              </View>
                              <View style={styles.formatBarContainer}>
                                <ProgressBar value={rate} color={format === 'Tête-à-tête' ? theme.tirColor : format === 'Doublette' ? theme.primary : theme.accent} />
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </Animated.View>
                    <Animated.View entering={FadeInDown.duration(400).delay(200)} style={[styles.section, styles.tabletHalf]}>
                      <SectionHeader title={t('stats', 'avgScoreSection')} icon="scoreboard" color={theme.success} />
                      <View style={styles.card}>
                        <View style={styles.scoreComparison}>
                          <View style={styles.scoreItem}>
                            <MaterialIcons name="add-circle" size={28} color={theme.success} />
                            <Text style={[styles.scoreValue, { color: theme.success }]}>{performanceStats.avgScoreFor}</Text>
                            <Text style={styles.scoreLabel}>{t('stats', 'scoredLabel')}</Text>
                          </View>
                          <View style={styles.scoreDiff}>
                            <View style={[styles.scoreDiffBadge, { backgroundColor: performanceStats.pointDiff >= 0 ? theme.success + '15' : theme.error + '15' }]}>
                              <Text style={[styles.scoreDiffText, { color: performanceStats.pointDiff >= 0 ? theme.success : theme.error }]}>
                                {performanceStats.avgPointDiff > '0' ? '+' : ''}{performanceStats.avgPointDiff}
                              </Text>
                              <Text style={styles.scoreDiffLabel}>{t('stats', 'avgPerGameLabel')}</Text>
                            </View>
                          </View>
                          <View style={styles.scoreItem}>
                            <MaterialIcons name="remove-circle" size={28} color={theme.error} />
                            <Text style={[styles.scoreValue, { color: theme.error }]}>{performanceStats.avgScoreAgainst}</Text>
                            <Text style={styles.scoreLabel}>{t('stats', 'concededLabel')}</Text>
                          </View>
                        </View>
                      </View>
                    </Animated.View>
                  </View>
                ) : (
                <>
                <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                  <SectionHeader title={t('stats', 'winRateByFormatSection')} icon="group" color={theme.accent} />
                  <View style={styles.card}>
                    {Object.entries(performanceStats.byFormat).map(([format, data]) => {
                      const rate = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0;
                      return (
                        <View key={format} style={styles.formatRow}>
                          <View style={styles.formatInfo}>
                            <Text style={styles.formatName}>{t('formats', format)}</Text>
                            <Text style={styles.formatRecord}>{data.wins}V - {data.total - data.wins}D ({data.total})</Text>
                          </View>
                          <View style={styles.formatBarContainer}>
                            <ProgressBar value={rate} color={format === 'Tête-à-tête' ? theme.tirColor : format === 'Doublette' ? theme.primary : theme.accent} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
                  <SectionHeader title={t('stats', 'avgScoreSection')} icon="scoreboard" color={theme.success} />
                  <View style={styles.card}>
                    <View style={styles.scoreComparison}>
                      <View style={styles.scoreItem}>
                        <MaterialIcons name="add-circle" size={28} color={theme.success} />
                        <Text style={[styles.scoreValue, { color: theme.success }]}>{performanceStats.avgScoreFor}</Text>
                        <Text style={styles.scoreLabel}>{t('stats', 'scoredLabel')}</Text>
                      </View>
                      <View style={styles.scoreDiff}>
                        <View style={[styles.scoreDiffBadge, { backgroundColor: performanceStats.pointDiff >= 0 ? theme.success + '15' : theme.error + '15' }]}>
                          <Text style={[styles.scoreDiffText, { color: performanceStats.pointDiff >= 0 ? theme.success : theme.error }]}>
                            {performanceStats.avgPointDiff > '0' ? '+' : ''}{performanceStats.avgPointDiff}
                          </Text>
                          <Text style={styles.scoreDiffLabel}>{t('stats', 'avgPerGameLabel')}</Text>
                        </View>
                      </View>
                      <View style={styles.scoreItem}>
                        <MaterialIcons name="remove-circle" size={28} color={theme.error} />
                        <Text style={[styles.scoreValue, { color: theme.error }]}>{performanceStats.avgScoreAgainst}</Text>
                        <Text style={styles.scoreLabel}>{t('stats', 'concededLabel')}</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
                </>
                )}

                {performanceStats.matchesWithDuration > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                    <SectionHeader title={t('stats', 'gameDurationSection')} icon="timer" color={theme.accent} />
                    <View style={styles.card}>
                      <View style={styles.durationHero}>
                        <View style={styles.durationMain}>
                          <MaterialIcons name="schedule" size={28} color={theme.accent} />
                          <Text style={styles.durationMainValue}>{formatDuration(performanceStats.avgDuration)}</Text>
                          <Text style={styles.durationMainLabel}>{t('stats', 'avgDurationLabel')}</Text>
                        </View>
                        <View style={styles.durationMinMax}>
                          <View style={styles.durationMinMaxItem}>
                            <MaterialIcons name="fast-forward" size={16} color={theme.success} />
                            <Text style={styles.durationMinMaxValue}>{formatDuration(performanceStats.minDuration)}</Text>
                            <Text style={styles.durationMinMaxLabel}>{t('stats', 'fastestLabel')}</Text>
                          </View>
                          <View style={styles.durationMinMaxItem}>
                            <MaterialIcons name="hourglass-full" size={16} color={theme.warning} />
                            <Text style={styles.durationMinMaxValue}>{formatDuration(performanceStats.maxDuration)}</Text>
                            <Text style={styles.durationMinMaxLabel}>{t('stats', 'longestLabel')}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.totalTimeRow}>
                        <MaterialIcons name="access-time" size={18} color={theme.textSecondary} />
                        <Text style={styles.totalTimeLabel}>{t('stats', 'totalPlayTimeLabel')}</Text>
                        <Text style={styles.totalTimeValue}>{formatDuration(performanceStats.totalDuration)}</Text>
                      </View>
                    </View>
                  </Animated.View>
                )}
                {terrainTypeStats.hasData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
                    <SectionHeader title={t('stats', 'statsByTerrainSection')} subtitle={`${terrainTypeStats.totalTerrainMatches} ${t('stats', 'terrainMatchesSubtitle')}`} icon="terrain" color={theme.success} />
                    <View style={styles.card}>
                      <View style={styles.crossTableHeader}>
                        <View style={styles.crossTableHeaderLabel}><Text style={styles.crossTableHeaderText}>{t('stats', 'terrainColumn')}</Text></View>
                        <View style={styles.crossTableHeaderCell}><Text style={styles.crossTableHeaderCellText}>{t('stats', 'matchesColumn')}</Text></View>
                        <View style={styles.crossTableHeaderCell}><Text style={[styles.crossTableHeaderCellText, { color: theme.primary }]}>{t('stats', 'winRateColumn')}</Text></View>
                      </View>
                      {terrainTypeStats.types.map((type, idx) => {
                        const data = terrainTypeStats.byTerrain[type];
                        const winRate = data.matches > 0 ? Math.round((data.wins / data.matches) * 100) : 0;
                        return (
                          <View key={type} style={[styles.crossTableRow, idx % 2 === 0 && styles.crossTableRowAlt]}>
                            <View style={styles.crossTableRowLabel}>
                              <Text style={styles.crossTableRowLabelText} numberOfLines={1}>{t('terrainTypes', type)}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={styles.crossTableCellValue}>{data.matches}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: winRate >= 60 ? theme.success : winRate >= 45 ? theme.warning : theme.error }]}>{winRate}%</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </Animated.View>
                )}
                </>
                )}
              </>
            )}

            {/* TIR */}
            {category === 'tir' && (
              <>
                <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroCard, isTablet && styles.heroCardTablet]}>
                  <View style={styles.heroContent}>
                    <ProgressRing value={tirStats.successRate} size={isTablet ? 130 : 110} strokeWidth={isTablet ? 10 : 9} color={theme.tirColor} label={t('stats', 'successLabel')} />
                    <View style={styles.heroStats}>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.success }]}>{tirStats.tirsSuccess}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'succeededLabel')}</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.error }]}>{tirStats.totalTirs - tirStats.tirsSuccess}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'missedLabel')}</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatValue}>{tirStats.totalTirs}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'totalLabel')}</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title={t('stats', 'volumeSuccessSection')} icon="gps-fixed" color={theme.tirColor} />
                  <View style={styles.card}>
                    <StatRow label={t('stats', 'shotsAttempted')} value={tirStats.totalTirs} icon="radio-button-unchecked" color={theme.textSecondary} />
                    <StatRow label={t('stats', 'successPercent')} value={`${tirStats.successRate}%`} icon="percent" color={theme.tirColor} />
                    <StatRow label={t('stats', 'carreauPercent')} value={`${tirStats.carreauRate}%`} icon="stars" color={theme.carreauColor} />
                    <StatRow label={t('stats', 'shotsPerGameLabel')} value={tirStats.tirsPerMatch} icon="sports" color={theme.primary} />
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                  <SectionHeader title={t('stats', 'resultBreakdownSection')} icon="pie-chart" color={theme.primary} />
                  <View style={styles.card}>
                    <BreakdownBar items={[
                      { label: t('stats', 'carreauxLabel'), value: tirStats.carreaux, color: theme.carreauColor },
                      { label: t('stats', 'halfShotsLabel'), value: tirStats.tirsSuccess - tirStats.carreaux, color: theme.pointColor },
                      { label: t('stats', 'missedLabel'), value: tirStats.totalTirs - tirStats.tirsSuccess, color: theme.error },
                    ]} />
                  </View>
                </Animated.View>

                {/* Ad Banner */}
                <AdBanner position="inline" />

                {tirStats.hasDetailedData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(150)} style={[styles.section, isTablet && styles.sectionTabletWide]}>
                    <SectionHeader title={t('stats', 'shotTypesSection')} subtitle={`${tirStats.totalDetailedTirs} ${t('stats', 'analyzedLabel')}`} icon="category" color={theme.tirColor} />
                    <View style={styles.card}>
                      <StatRow label={t('stats', 'tirTenduLabel')} value={`${tirStats.tirAuFer.success}/${tirStats.tirAuFer.total}`} subValue={tirStats.tirAuFer.total > 0 ? `${Math.round((tirStats.tirAuFer.success / tirStats.tirAuFer.total) * 100)}%` : ''} icon="gps-fixed" color={theme.tirColor} />
                      <StatRow label={t('stats', 'tirClocheLabel')} value={`${tirStats.tirAuPlomb.success}/${tirStats.tirAuPlomb.total}`} subValue={tirStats.tirAuPlomb.total > 0 ? `${Math.round((tirStats.tirAuPlomb.success / tirStats.tirAuPlomb.total) * 100)}%` : ''} icon="flight-takeoff" color={theme.pointColor} />
                      <StatRow label={t('stats', 'enRafleLabel')} value={`${tirStats.tirEnRafle.success}/${tirStats.tirEnRafle.total}`} subValue={tirStats.tirEnRafle.total > 0 ? `${Math.round((tirStats.tirEnRafle.success / tirStats.tirEnRafle.total) * 100)}%` : ''} icon="swap-horiz" color={theme.accent} />
                      {tirStats.tirCourtRamasse.total > 0 && (
                        <StatRow label={t('stats', 'courtRamasseLabel')} value={`${tirStats.tirCourtRamasse.success}/${tirStats.tirCourtRamasse.total}`} subValue={tirStats.tirCourtRamasse.total > 0 ? `${Math.round((tirStats.tirCourtRamasse.success / tirStats.tirCourtRamasse.total) * 100)}%` : ''} icon="sports-handball" color={theme.carreauColor} />
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* Cross-reference: Type x Impact */}
                {tirStats.hasCrossData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(175)} style={styles.section}>
                    <SectionHeader title={t('stats', 'shotTypeImpactSection')} subtitle={`${tirStats.totalCrossTracked} ${t('stats', 'crossedLabel')}`} icon="grid-on" color={theme.accent} />
                    <View style={styles.card}>
                      {/* Table Header */}
                      <View style={styles.crossTableHeader}>
                        <View style={styles.crossTableHeaderLabel}>
                          <Text style={styles.crossTableHeaderText}>{t('stats', 'typeLabel')}</Text>
                        </View>
                        <View style={styles.crossTableHeaderCell}>
                          <MaterialIcons name="add-circle" size={12} color={theme.success} />
                          <Text style={[styles.crossTableHeaderCellText, { color: theme.success }]}>{t('stats', 'gainLabel')}</Text>
                        </View>
                        <View style={styles.crossTableHeaderCell}>
                          <MaterialIcons name="whatshot" size={12} color={theme.carreauColor} />
                          <Text style={[styles.crossTableHeaderCellText, { color: theme.carreauColor }]}>{t('stats', 'decisiveLabel')}</Text>
                        </View>
                        <View style={styles.crossTableHeaderCell}>
                          <MaterialIcons name="remove-circle-outline" size={12} color={theme.textMuted} />
                          <Text style={[styles.crossTableHeaderCellText, { color: theme.textMuted }]}>{t('stats', 'neutralLabel')}</Text>
                        </View>
                        <View style={styles.crossTableHeaderCell}>
                          <MaterialIcons name="trending-down" size={12} color={theme.error} />
                          <Text style={[styles.crossTableHeaderCellText, { color: theme.error }]}>{t('stats', 'negativeLabel')}</Text>
                        </View>
                      </View>
                      {/* Table Rows */}
                      {[
                        { key: 'au_fer', label: t('stats', 'tirTenduLabel'), icon: 'gps-fixed', color: theme.tirColor },
                        { key: 'au_plomb', label: t('stats', 'tirClocheLabel'), icon: 'flight-takeoff', color: theme.pointColor },
                        { key: 'en_rafle', label: t('stats', 'enRafleLabel'), icon: 'swap-horiz', color: theme.accent },
                        { key: 'court_ramasse', label: t('stats', 'courtRamasseLabel'), icon: 'sports-handball', color: theme.carreauColor },
                      ].filter(row => tirStats.crossTypeImpact[row.key]?.total > 0).map((row, idx) => {
                        const data = tirStats.crossTypeImpact[row.key];
                        return (
                          <View key={row.key} style={[styles.crossTableRow, idx % 2 === 0 && styles.crossTableRowAlt]}>
                            <View style={styles.crossTableRowLabel}>
                              <MaterialIcons name={row.icon as any} size={14} color={row.color} />
                              <Text style={styles.crossTableRowLabelText} numberOfLines={1}>{row.label}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.success }]}>{data.gain_point}</Text>
                              <Text style={styles.crossTableCellPct}>{data.total > 0 ? `${Math.round((data.gain_point / data.total) * 100)}%` : '-'}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.carreauColor }]}>{data.decisif}</Text>
                              <Text style={styles.crossTableCellPct}>{data.total > 0 ? `${Math.round((data.decisif / data.total) * 100)}%` : '-'}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.textMuted }]}>{data.sans_effet}</Text>
                              <Text style={styles.crossTableCellPct}>{data.total > 0 ? `${Math.round((data.sans_effet / data.total) * 100)}%` : '-'}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.error }]}>{data.negatif}</Text>
                              <Text style={styles.crossTableCellPct}>{data.total > 0 ? `${Math.round((data.negatif / data.total) * 100)}%` : '-'}</Text>
                            </View>
                          </View>
                        );
                      })}
                      {/* Best/Worst insight */}
                      {(() => {
                        const entries = Object.entries(tirStats.crossTypeImpact).filter(([, v]) => v.total >= 3);
                        if (entries.length < 2) return null;
                        const labels: Record<string, string> = { au_fer: t('stats', 'tirTenduLabel'), au_plomb: t('stats', 'tirClocheLabel'), en_rafle: t('stats', 'enRafleLabel'), court_ramasse: t('stats', 'courtRamasseLabel') };
                        const positiveRates = entries.map(([key, v]) => ({ key, rate: v.total > 0 ? ((v.gain_point + v.decisif) / v.total) * 100 : 0 }));
                        positiveRates.sort((a, b) => b.rate - a.rate);
                        const best = positiveRates[0];
                        const worst = positiveRates[positiveRates.length - 1];
                        if (best.rate - worst.rate < 10) return null;
                        return (
                          <View style={styles.insightBox}>
                            <MaterialIcons name="lightbulb" size={16} color={theme.accent} />
                            <Text style={styles.insightText}>
                              {t('stats', 'yourLabel')} <Text style={{ fontWeight: '700', color: theme.success }}>{labels[best.key]}</Text> {t('stats', 'insightBestImpact')} ({Math.round(best.rate)}%). 
                              <Text style={{ fontWeight: '700', color: theme.error }}>{labels[worst.key]}</Text> {t('stats', 'insightLeastEffective')} ({Math.round(worst.rate)}%).
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </Animated.View>
                )}

                {/* Impact du tir */}
                {tirStats.totalQualityTracked > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
                    <SectionHeader title={t('stats', 'shotImpactSection')} subtitle={`${tirStats.totalQualityTracked} ${t('stats', 'qualifiedLabel')}`} icon="flash-on" color={theme.carreauColor} />
                    <View style={styles.card}>
                      <StatRow label={t('stats', 'gainPointLabel')} value={tirStats.tirGainPoint} subValue={tirStats.totalQualityTracked > 0 ? `${Math.round((tirStats.tirGainPoint / tirStats.totalQualityTracked) * 100)}%` : ''} icon="add-circle" color={theme.success} />
                      <StatRow label={t('stats', 'decisiveLabel')} value={tirStats.tirsDecisifs} subValue={tirStats.totalQualityTracked > 0 ? `${Math.round((tirStats.tirsDecisifs / tirStats.totalQualityTracked) * 100)}%` : ''} icon="whatshot" color={theme.carreauColor} />
                      <StatRow label={t('stats', 'noEffectLabel')} value={tirStats.tirSansEffet} subValue={tirStats.totalQualityTracked > 0 ? `${Math.round((tirStats.tirSansEffet / tirStats.totalQualityTracked) * 100)}%` : ''} icon="remove-circle-outline" color={theme.textMuted} />
                      <StatRow label={t('stats', 'negativeLabel')} value={tirStats.tirNegatif} subValue={tirStats.totalQualityTracked > 0 ? `${Math.round((tirStats.tirNegatif / tirStats.totalQualityTracked) * 100)}%` : ''} icon="trending-down" color={theme.error} />
                      <View style={{ height: 8 }} />
                      <BreakdownBar items={[
                        { label: t('stats', 'gainLabel'), value: tirStats.tirGainPoint, color: theme.success },
                        { label: t('stats', 'decisiveLabel'), value: tirStats.tirsDecisifs, color: theme.carreauColor },
                        { label: t('stats', 'noEffectLabel'), value: tirStats.tirSansEffet, color: theme.textMuted },
                        { label: t('stats', 'negativeLabel'), value: tirStats.tirNegatif, color: theme.error },
                      ].filter(i => i.value > 0)} />
                    </View>
                  </Animated.View>
                )}
                {/* Precision Workshop Stats */}
                {precisionWorkshopStats && precisionWorkshopStats.hasData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(225)} style={styles.section}>
                    <SectionHeader title={t('stats', 'precisionWorkshopTitle')} subtitle={`${precisionWorkshopStats.totalSessions} ${t('stats', 'precisionSessionsLabel')}`} icon="stars" color={theme.carreauColor} />
                    <View style={styles.card}>
                      {/* Per-workshop rows */}
                      {precisionWorkshopStats.activeAteliers.map((atelier, idx) => {
                        const data = precisionWorkshopStats.atelierData[atelier];
                        const successRate = data.totalShots > 0 ? Math.round((data.successCount / data.totalShots) * 100) : 0;
                        const avgPoints = data.totalShots > 0 ? (data.totalPoints / data.totalShots).toFixed(1) : '0';
                        const atelierColors: Record<string, string> = {
                          boule_seule: theme.tirColor,
                          derriere_but: theme.primary,
                          entre_2_boules: theme.accent,
                          sautee: theme.pointColor,
                          tir_but: theme.carreauColor,
                        };
                        const color = atelierColors[atelier] || theme.primary;
                        return (
                          <View key={atelier} style={[styles.precisionWorkshopRow, idx < precisionWorkshopStats.activeAteliers.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                            <View style={styles.precisionWorkshopHeader}>
                              <View style={[styles.precisionWorkshopIcon, { backgroundColor: color + '15' }]}>
                                <MaterialIcons name="gps-fixed" size={16} color={color} />
                              </View>
                              <View style={styles.precisionWorkshopInfo}>
                                <Text style={styles.precisionWorkshopName} numberOfLines={1}>{t('precisionWorkshops', atelier)}</Text>
                                <Text style={styles.precisionWorkshopMeta}>{data.totalShots} {t('stats', 'shotsUnit')} \u2022 {data.sessions} {t('stats', 'precisionSessionsLabel')}</Text>
                              </View>
                            </View>
                            <View style={styles.precisionWorkshopStats}>
                              <View style={styles.precisionWorkshopStatItem}>
                                <Text style={[styles.precisionWorkshopStatValue, { color }]}>{successRate}%</Text>
                                <Text style={styles.precisionWorkshopStatLabel}>{t('stats', 'successLabel')}</Text>
                              </View>
                              <View style={styles.precisionWorkshopStatItem}>
                                <Text style={styles.precisionWorkshopStatValue}>{avgPoints}</Text>
                                <Text style={styles.precisionWorkshopStatLabel}>{t('stats', 'precisionAvgPtsLabel')}</Text>
                              </View>
                              <View style={styles.precisionWorkshopStatItem}>
                                <Text style={[styles.precisionWorkshopStatValue, { color: theme.carreauColor }]}>{data.bestSessionScore}</Text>
                                <Text style={styles.precisionWorkshopStatLabel}>{t('stats', 'precisionBestLabel')}</Text>
                              </View>
                            </View>
                            {/* Evolution mini-bars (last 5 sessions) */}
                            {data.sessionScores.length >= 2 ? (
                              <View style={styles.precisionEvolutionRow}>
                                <Text style={styles.precisionEvolutionLabel}>{t('stats', 'precisionEvolutionLabel')}</Text>
                                <View style={styles.precisionEvolutionBars}>
                                  {data.sessionScores.slice(-5).map((s, i) => {
                                    const maxPts = data.maxSessionPoints || 20;
                                    const pct = maxPts > 0 ? Math.min(100, (s.score / maxPts) * 100) : 0;
                                    return (
                                      <View key={i} style={styles.precisionEvolutionBarCol}>
                                        <View style={styles.precisionEvolutionBarTrack}>
                                          <View style={[styles.precisionEvolutionBarFill, { height: `${Math.max(pct, 4)}%`, backgroundColor: color }]} />
                                        </View>
                                        <Text style={styles.precisionEvolutionBarLabel}>{s.score}</Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                      {/* Insight */}
                      {(() => {
                        const entries = precisionWorkshopStats.activeAteliers.filter(a => precisionWorkshopStats.atelierData[a].totalShots >= 2);
                        if (entries.length < 2) return null;
                        const rates = entries.map(a => ({ a, rate: precisionWorkshopStats.atelierData[a].totalShots > 0 ? (precisionWorkshopStats.atelierData[a].successCount / precisionWorkshopStats.atelierData[a].totalShots) * 100 : 0 }));
                        rates.sort((a, b) => b.rate - a.rate);
                        const best = rates[0];
                        const worst = rates[rates.length - 1];
                        if (best.rate - worst.rate < 15) return null;
                        return (
                          <View style={styles.insightBox}>
                            <MaterialIcons name="lightbulb" size={16} color={theme.carreauColor} />
                            <Text style={styles.insightText}>
                              {t('stats', 'yourLabel')} <Text style={{ fontWeight: '700', color: theme.success }}>{t('precisionWorkshops', best.a)}</Text> {t('stats', 'precisionInsightBest')} ({Math.round(best.rate)}%). 
                              <Text style={{ fontWeight: '700', color: theme.error }}>{t('precisionWorkshops', worst.a)}</Text> {t('stats', 'precisionInsightWorst')} ({Math.round(worst.rate)}%).
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </Animated.View>
                )}

                {terrainTypeStats.hasData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                    <SectionHeader title={t('stats', 'statsByTerrainSection')} subtitle={`${terrainTypeStats.totalTerrainMatches} ${t('stats', 'terrainMatchesSubtitle')}`} icon="terrain" color={theme.tirColor} />
                    <View style={styles.card}>
                      <View style={styles.crossTableHeader}>
                        <View style={styles.crossTableHeaderLabel}><Text style={styles.crossTableHeaderText}>{t('stats', 'terrainColumn')}</Text></View>
                        <View style={styles.crossTableHeaderCell}><Text style={[styles.crossTableHeaderCellText, { color: theme.tirColor }]}>{t('stats', 'shotSuccessColumn')}</Text></View>
                        <View style={styles.crossTableHeaderCell}><Text style={[styles.crossTableHeaderCellText, { color: theme.carreauColor }]}>{t('stats', 'carreauShortColumn')}</Text></View>
                      </View>
                      {terrainTypeStats.types.map((type, idx) => {
                        const data = terrainTypeStats.byTerrain[type];
                        const tirRate = data.tirs > 0 ? Math.round((data.tirsSuccess / data.tirs) * 100) : 0;
                        const carRate = data.tirs > 0 ? Math.round((data.carreaux / data.tirs) * 100) : 0;
                        return (
                          <View key={type} style={[styles.crossTableRow, idx % 2 === 0 && styles.crossTableRowAlt]}>
                            <View style={styles.crossTableRowLabel}>
                              <Text style={styles.crossTableRowLabelText} numberOfLines={1}>{t('terrainTypes', type)}</Text>
                              <Text style={styles.crossTableCellPct}>{data.tirs} {t('stats', 'shotsUnit')}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.tirColor }]}>{tirRate}%</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.carreauColor }]}>{carRate}%</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            {/* POINT */}
            {category === 'point' && (
              <>
                {itemFilterType === 'challenge' && filteredChallenges.length > 0 && pointStats.totalPoints === 0 ? (
                  <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
                    <View style={styles.card}>
                      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                        <MaterialIcons name="info-outline" size={40} color={theme.textMuted} />
                        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginTop: 12 }}>{t('stats', 'challengeNoPointData')}</Text>
                        <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 260 }}>{t('stats', 'challengeNoPointDataDesc')}</Text>
                      </View>
                    </View>
                  </Animated.View>
                ) : (
                <>
                <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroCard, isTablet && styles.heroCardTablet]}>
                  <View style={styles.heroContent}>
                    <ProgressRing value={pointStats.successRate} size={isTablet ? 130 : 110} strokeWidth={isTablet ? 10 : 9} color={theme.pointColor} label={t('stats', 'successLabel')} />
                    <View style={styles.heroStats}>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.success }]}>{pointStats.pointsSuccess}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'succeededLabel')}</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.error }]}>{pointStats.totalPoints - pointStats.pointsSuccess}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'missedLabel')}</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatValue}>{pointStats.totalPoints}</Text>
                        <Text style={styles.heroStatLabel}>{t('stats', 'totalLabel')}</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title={t('stats', 'successLabel')} icon="adjust" color={theme.pointColor} />
                  <View style={styles.card}>
                    <StatRow label={t('stats', 'pointsAttemptedLabel')} value={pointStats.totalPoints} icon="radio-button-unchecked" color={theme.textSecondary} />
                    <StatRow label={t('stats', 'successPercent')} value={`${pointStats.successRate}%`} icon="percent" color={theme.pointColor} />
                    <StatRow label={t('stats', 'pointsPerEndLabel')} value={pointStats.pointsPerMene} icon="timeline" color={theme.accent} />
                  </View>
                </Animated.View>

                {pointStats.hasDetailedData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                    <SectionHeader title={t('stats', 'pointTypesSection')} subtitle={`${pointStats.totalDetailedPoints} ${t('stats', 'pointAnalyzedLabel')}`} icon="category" color={theme.primary} />
                    <View style={styles.card}>
                      <StatRow label={t('stats', 'rolledPointLabel')} value={`${pointStats.pointRoule.success}/${pointStats.pointRoule.total}`} subValue={pointStats.pointRoule.total > 0 ? `${Math.round((pointStats.pointRoule.success / pointStats.pointRoule.total) * 100)}%` : ''} icon="sports-baseball" color={theme.pointColor} />
                      <StatRow label={t('stats', 'droppedPointLabel')} value={`${pointStats.pointPlombe.success}/${pointStats.pointPlombe.total}`} subValue={pointStats.pointPlombe.total > 0 ? `${Math.round((pointStats.pointPlombe.success / pointStats.pointPlombe.total) * 100)}%` : ''} icon="flight-land" color={theme.tirColor} />
                      {pointStats.pointDemiPortee.total > 0 && (
                        <StatRow label={t('stats', 'halfCarryLabel')} value={`${pointStats.pointDemiPortee.success}/${pointStats.pointDemiPortee.total}`} subValue={pointStats.pointDemiPortee.total > 0 ? `${Math.round((pointStats.pointDemiPortee.success / pointStats.pointDemiPortee.total) * 100)}%` : ''} icon="height" color={theme.primary} />
                      )}
                      <StatRow label={t('stats', 'carriedPointLabel')} value={`${pointStats.pointPortee.success}/${pointStats.pointPortee.total}`} subValue={pointStats.pointPortee.total > 0 ? `${Math.round((pointStats.pointPortee.success / pointStats.pointPortee.total) * 100)}%` : ''} icon="flight" color={theme.accent} />
                    </View>
                  </Animated.View>
                )}

                {/* Ad Banner */}
                <AdBanner position="inline" />

                {pointStats.successQualitiesTotal > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                    <SectionHeader title={t('stats', 'successQualitySection')} subtitle={`${pointStats.successQualitiesTotal} ${t('stats', 'qualifiedLabel')}`} icon="straighten" color={theme.success} />
                    <View style={styles.card}>
                      <StatRow label={t('stats', 'excellentLabel')} value={pointStats.pointExcellent} subValue={`${Math.round((pointStats.pointExcellent / pointStats.successQualitiesTotal) * 100)}%`} icon="stars" color={theme.carreauColor} />
                      <StatRow label={t('stats', 'goodLabel')} value={pointStats.pointBon} subValue={`${Math.round((pointStats.pointBon / pointStats.successQualitiesTotal) * 100)}%`} icon="check-circle" color={theme.success} />
                      <StatRow label={t('stats', 'averageLabel')} value={pointStats.pointMoyen} subValue={`${Math.round((pointStats.pointMoyen / pointStats.successQualitiesTotal) * 100)}%`} icon="radio-button-checked" color={theme.warning} />
                      <StatRow label={t('stats', 'atJackLabel')} value={pointStats.pointAuBouchon} subValue={`${Math.round((pointStats.pointAuBouchon / pointStats.successQualitiesTotal) * 100)}%`} icon="adjust" color={theme.primary} />
                      <StatRow label={t('stats', 'inFrontBallLabel')} value={pointStats.pointDevantBoule} subValue={`${Math.round((pointStats.pointDevantBoule / pointStats.successQualitiesTotal) * 100)}%`} icon="sports-baseball" color={theme.accent} />
                    </View>
                  </Animated.View>
                )}

                {/* Cross-reference: Type x Quality */}
                {pointStats.hasCrossData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(175)} style={styles.section}>
                    <SectionHeader title={t('stats', 'pointTypeQualitySection')} subtitle={`${pointStats.totalCrossTracked} ${t('stats', 'pointsCrossedLabel')}`} icon="grid-on" color={theme.accent} />
                    <View style={styles.card}>
                      {/* Table Header */}
                      <View style={styles.crossTableHeader}>
                        <View style={styles.crossTableHeaderLabel}>
                          <Text style={styles.crossTableHeaderText}>{t('stats', 'typeLabel')}</Text>
                        </View>
                        <View style={styles.crossTableHeaderCell}>
                          <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
                          <Text style={[styles.crossTableHeaderCellText, { color: theme.carreauColor }]}>{t('stats', 'excShort')}</Text>
                        </View>
                        <View style={styles.crossTableHeaderCell}>
                          <MaterialIcons name="check-circle" size={12} color={theme.success} />
                          <Text style={[styles.crossTableHeaderCellText, { color: theme.success }]}>{t('stats', 'goodShort')}</Text>
                        </View>
                        <View style={styles.crossTableHeaderCell}>
                          <MaterialIcons name="radio-button-checked" size={12} color={theme.warning} />
                          <Text style={[styles.crossTableHeaderCellText, { color: theme.warning }]}>{t('stats', 'avgShort')}</Text>
                        </View>
                        <View style={styles.crossTableHeaderCell}>
                          <MaterialIcons name="cancel" size={12} color={theme.error} />
                          <Text style={[styles.crossTableHeaderCellText, { color: theme.error }]}>{t('stats', 'missedShort')}</Text>
                        </View>
                      </View>
                      {/* Table Rows */}
                      {[
                        { key: 'roule', label: t('stats', 'rolledPointLabel'), icon: 'sports-baseball', color: theme.pointColor },
                        { key: 'plombe', label: t('stats', 'droppedPointLabel'), icon: 'flight-land', color: theme.tirColor },
                        { key: 'demi_portee', label: t('stats', 'halfCarryLabel'), icon: 'height', color: theme.primary },
                        { key: 'portee', label: t('stats', 'carriedPointLabel'), icon: 'flight', color: theme.accent },
                      ].filter(row => pointStats.crossTypeQuality[row.key]?.total > 0).map((row, idx) => {
                        const data = pointStats.crossTypeQuality[row.key];
                        return (
                          <View key={row.key} style={[styles.crossTableRow, idx % 2 === 0 && styles.crossTableRowAlt]}>
                            <View style={styles.crossTableRowLabel}>
                              <MaterialIcons name={row.icon as any} size={14} color={row.color} />
                              <Text style={styles.crossTableRowLabelText} numberOfLines={1}>{row.label}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.carreauColor }]}>{data.excellent}</Text>
                              <Text style={styles.crossTableCellPct}>{data.total > 0 ? `${Math.round((data.excellent / data.total) * 100)}%` : '-'}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.success }]}>{data.bon}</Text>
                              <Text style={styles.crossTableCellPct}>{data.total > 0 ? `${Math.round((data.bon / data.total) * 100)}%` : '-'}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.warning }]}>{data.moyen}</Text>
                              <Text style={styles.crossTableCellPct}>{data.total > 0 ? `${Math.round((data.moyen / data.total) * 100)}%` : '-'}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.error }]}>{data.rate + data.crochete + data.sorti}</Text>
                              <Text style={styles.crossTableCellPct}>{data.total > 0 ? `${Math.round(((data.rate + data.crochete + data.sorti) / data.total) * 100)}%` : '-'}</Text>
                            </View>
                          </View>
                        );
                      })}
                      {/* Best/Worst insight */}
                      {(() => {
                        const entries = Object.entries(pointStats.crossTypeQuality).filter(([, v]) => v.total >= 3);
                        if (entries.length < 2) return null;
                        const labels: Record<string, string> = { roule: t('stats', 'rolledPointLabel'), plombe: t('stats', 'droppedPointLabel'), demi_portee: t('stats', 'halfCarryLabel'), portee: t('stats', 'carriedPointLabel') };
                        const successRates = entries.map(([key, v]) => ({ key, rate: v.total > 0 ? (v.successTotal / v.total) * 100 : 0 }));
                        successRates.sort((a, b) => b.rate - a.rate);
                        const best = successRates[0];
                        const worst = successRates[successRates.length - 1];
                        if (best.rate - worst.rate < 10) return null;
                        return (
                          <View style={styles.insightBox}>
                            <MaterialIcons name="lightbulb" size={16} color={theme.accent} />
                            <Text style={styles.insightText}>
                              {t('stats', 'yourLabel')} <Text style={{ fontWeight: '700', color: theme.success }}>{labels[best.key]}</Text> {t('stats', 'insightBestQuality')} ({Math.round(best.rate)}% {t('stats', 'insightSucceeded')}). 
                              <Text style={{ fontWeight: '700', color: theme.error }}>{labels[worst.key]}</Text> {t('stats', 'insightLeastReliable')} ({Math.round(worst.rate)}%).
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </Animated.View>
                )}
                {terrainTypeStats.hasData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
                    <SectionHeader title={t('stats', 'statsByTerrainSection')} subtitle={`${terrainTypeStats.totalTerrainMatches} ${t('stats', 'terrainMatchesSubtitle')}`} icon="terrain" color={theme.pointColor} />
                    <View style={styles.card}>
                      <View style={styles.crossTableHeader}>
                        <View style={styles.crossTableHeaderLabel}><Text style={styles.crossTableHeaderText}>{t('stats', 'terrainColumn')}</Text></View>
                        <View style={styles.crossTableHeaderCell}><Text style={[styles.crossTableHeaderCellText, { color: theme.pointColor }]}>{t('stats', 'pointSuccessColumn')}</Text></View>
                        <View style={styles.crossTableHeaderCell}><Text style={styles.crossTableHeaderCellText}>{t('stats', 'matchesColumn')}</Text></View>
                      </View>
                      {terrainTypeStats.types.map((type, idx) => {
                        const data = terrainTypeStats.byTerrain[type];
                        const ptRate = data.points > 0 ? Math.round((data.pointsSuccess / data.points) * 100) : 0;
                        return (
                          <View key={type} style={[styles.crossTableRow, idx % 2 === 0 && styles.crossTableRowAlt]}>
                            <View style={styles.crossTableRowLabel}>
                              <Text style={styles.crossTableRowLabelText} numberOfLines={1}>{t('terrainTypes', type)}</Text>
                              <Text style={styles.crossTableCellPct}>{data.points} {t('stats', 'pointsUnit')}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: theme.pointColor }]}>{ptRate}%</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={styles.crossTableCellValue}>{data.matches}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </Animated.View>
                )}
                </>
                )}
              </>
            )}

            {/* ERRORS ANALYSIS */}
            {category === 'errors' && (
              <>
                {/* Hero Errors */}
                <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroCard, { borderLeftWidth: 4, borderLeftColor: theme.error }, isTablet && styles.heroCardTablet]}>
                  <View style={styles.errorHeroContent}>
                    <View style={styles.errorHeroMain}>
                      <MaterialIcons name="error-outline" size={48} color={theme.error} />
                      <Text style={styles.errorHeroValue}>{errorStats.totalErrors}</Text>
                      <Text style={styles.errorHeroLabel}>{t('stats', 'totalErrorsLabel')}</Text>
                    </View>
                    <View style={styles.errorHeroBreakdown}>
                      <View style={styles.errorHeroItem}>
                        <MaterialIcons name="gps-fixed" size={20} color={theme.tirColor} />
                        <Text style={styles.errorHeroItemValue}>{errorStats.totalTirErrors}</Text>
                        <Text style={styles.errorHeroItemLabel}>{t('stats', 'missedShotsLabel')}</Text>
                      </View>
                      <View style={styles.errorHeroItem}>
                        <MaterialIcons name="adjust" size={20} color={theme.pointColor} />
                        <Text style={styles.errorHeroItemValue}>{errorStats.totalPointErrors}</Text>
                        <Text style={styles.errorHeroItemLabel}>{t('stats', 'missedPointsLabel')}</Text>
                      </View>
                    </View>
                  </View>
                  {errorStats.mostCommonError && (
                    <View style={styles.mostCommonError}>
                      <MaterialIcons name="warning" size={16} color={theme.warning} />
                      <Text style={styles.mostCommonErrorText}>
                        {t('stats', 'mostCommonErrorLabel')}: <Text style={styles.mostCommonErrorHighlight}>{errorStats.mostCommonError.type}</Text> ({errorStats.mostCommonError.count}x)
                      </Text>
                    </View>
                  )}
                </Animated.View>

                {/* Error rates */}
                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title={t('stats', 'overallErrorRateSection')} icon="analytics" color={theme.error} />
                  <View style={styles.card}>
                    <View style={[styles.errorRatesGrid, isTablet && styles.errorRatesGridTablet]}>
                      <View style={[styles.errorRateCard, { borderColor: theme.tirColor }]}>
                        <MaterialIcons name="gps-fixed" size={24} color={theme.tirColor} />
                        <Text style={[styles.errorRateValue, { color: theme.tirColor }]}>{errorStats.tirErrorRate}%</Text>
                        <Text style={styles.errorRateLabel}>{t('stats', 'missedShotsLabel')}</Text>
                      </View>
                      <View style={[styles.errorRateCard, { borderColor: theme.pointColor }]}>
                        <MaterialIcons name="adjust" size={24} color={theme.pointColor} />
                        <Text style={[styles.errorRateValue, { color: theme.pointColor }]}>{errorStats.pointErrorRate}%</Text>
                        <Text style={styles.errorRateLabel}>{t('stats', 'missedPointsLabel')}</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                {/* Error by duration */}
                {(errorStats.shortMatchCount > 0 || errorStats.mediumMatchCount > 0 || errorStats.longMatchCount > 0) && (
                  <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                    <SectionHeader title={t('stats', 'errorsByDurationSection')} subtitle={t('stats', 'fatigueImpactLabel')} icon="timer" color={theme.warning} />
                    <View style={styles.card}>
                      <StatRow label={t('stats', 'shortGamesLabel')} value={`${errorStats.shortMatchErrorRate}%`} subValue={`${errorStats.shortMatchCount} ${t('stats', 'gamesUnit')}`} icon="fast-forward" color={theme.success} />
                      <StatRow label={t('stats', 'mediumGamesLabel')} value={`${errorStats.mediumMatchErrorRate}%`} subValue={`${errorStats.mediumMatchCount} ${t('stats', 'gamesUnit')}`} icon="schedule" color={theme.warning} />
                      <StatRow label={t('stats', 'longGamesLabel')} value={`${errorStats.longMatchErrorRate}%`} subValue={`${errorStats.longMatchCount} ${t('stats', 'gamesUnit')}`} icon="hourglass-full" color={theme.error} />
                      {errorStats.longMatchErrorRate > errorStats.shortMatchErrorRate + 10 && (
                        <View style={styles.insightBox}>
                          <MaterialIcons name="lightbulb" size={16} color={theme.warning} />
                          <Text style={styles.insightText}>{t('stats', 'insightFatigueIncrease')} {errorStats.longMatchErrorRate - errorStats.shortMatchErrorRate}% {t('stats', 'insightFatigueWork')}</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* Error by format */}
                <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                  <SectionHeader title={t('stats', 'errorsByFormatSection')} icon="group" color={theme.accent} />
                  <View style={styles.card}>
                    {Object.entries(errorStats.errorByFormat).map(([format, data]) => (
                      <View key={format} style={styles.formatRow}>
                        <View style={styles.formatInfo}>
                          <Text style={styles.formatName}>{t('formats', format)}</Text>
                          <Text style={styles.formatRecord}>{data.errors} {t('stats', 'errorsSlashActions')} / {data.total} {t('stats', 'actionsUnit')}</Text>
                        </View>
                        <View style={styles.formatBarContainer}>
                          <ProgressBar value={data.rate} color={data.rate > 40 ? theme.error : data.rate > 25 ? theme.warning : theme.success} />
                        </View>
                      </View>
                    ))}
                  </View>
                </Animated.View>

                {/* Error by mode */}
                <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
                  <SectionHeader title={t('stats', 'errorsByContextSection')} subtitle={t('stats', 'trainingVsTournamentLabel')} icon="psychology" color={theme.primary} />
                  <View style={styles.card}>
                    <View style={styles.contextComparison}>
                      <View style={styles.contextItem}>
                        <Text style={styles.contextLabel}>{t('stats', 'training')}</Text>
                        <Text style={[styles.contextValue, { color: errorStats.trainingErrorRate > errorStats.tournamentErrorRate ? theme.error : theme.success }]}>
                          {errorStats.trainingErrorRate}%
                        </Text>
                        <Text style={styles.contextSubLabel}>{t('stats', 'ofErrorsLabel')}</Text>
                      </View>
                      <View style={styles.contextDivider}>
                        <MaterialIcons name="compare-arrows" size={24} color={theme.textMuted} />
                      </View>
                      <View style={styles.contextItem}>
                        <Text style={styles.contextLabel}>{t('stats', 'tournamentLabel')}</Text>
                        <Text style={[styles.contextValue, { color: errorStats.tournamentErrorRate > errorStats.trainingErrorRate ? theme.error : theme.success }]}>
                          {errorStats.tournamentErrorRate}%
                        </Text>
                        <Text style={styles.contextSubLabel}>{t('stats', 'ofErrorsLabel')}</Text>
                      </View>
                    </View>
                    {Math.abs(errorStats.trainingErrorRate - errorStats.tournamentErrorRate) > 10 && (
                      <View style={styles.insightBox}>
                        <MaterialIcons name="psychology" size={16} color={theme.primary} />
                        <Text style={styles.insightText}>
                          {errorStats.tournamentErrorRate > errorStats.trainingErrorRate 
                            ? t('stats', 'insightTournamentPressure')
                            : t('stats', 'insightMoreFocused')}
                        </Text>
                      </View>
                    )}
                  </View>
                </Animated.View>

                {/* Analyse des échecs (Tir) - Unified */}
                {(errorStats.totalTirErrorResults > 0 || errorStats.totalTirErrorByTechnique > 0 || tirStats.hasCrossResultData) && (
                  <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                    <SectionHeader title={t('stats', 'shotFailAnalysisSection')} subtitle={`${Math.max(errorStats.totalTirErrorResults, errorStats.totalTirErrorByTechnique, tirStats.totalCrossResultTracked)} ${t('stats', 'missedShotsAnalyzed')}`} icon="highlight-off" color={theme.tirColor} />
                    <View style={styles.card}>
                      {/* Shot results (where the shot went) */}
                      {errorStats.totalTirErrorResults > 0 && (
                        <>
                          {errorStats.tirErrorResults.courtDroite > 0 && (
                            <>
                              <StatRow label={t('stats', 'courtDroiteLabel')} value={errorStats.tirErrorResults.courtDroite} subValue={`${Math.round((errorStats.tirErrorResults.courtDroite / errorStats.totalTirErrorResults) * 100)}%`} icon="subdirectory-arrow-right" color="#E57373" />
                              <View style={styles.coachingTip}>
                                <View style={styles.coachingTipHeader}>
                                  <MaterialIcons name="psychology" size={14} color={theme.tirColor} />
                                  <Text style={styles.coachingTipCause}>{t('stats', 'courtDroiteCause')}</Text>
                                </View>
                                <Text style={styles.coachingTipAdvice}>{t('stats', 'courtDroiteAdvice')}</Text>
                              </View>
                            </>
                          )}
                          {errorStats.tirErrorResults.courtGauche > 0 && (
                            <>
                              <StatRow label={t('stats', 'courtGaucheLabel')} value={errorStats.tirErrorResults.courtGauche} subValue={`${Math.round((errorStats.tirErrorResults.courtGauche / errorStats.totalTirErrorResults) * 100)}%`} icon="subdirectory-arrow-left" color="#EF5350" />
                              <View style={styles.coachingTip}>
                                <View style={styles.coachingTipHeader}>
                                  <MaterialIcons name="psychology" size={14} color={theme.tirColor} />
                                  <Text style={styles.coachingTipCause}>{t('stats', 'courtGaucheCause')}</Text>
                                </View>
                                <Text style={styles.coachingTipAdvice}>{t('stats', 'courtGaucheAdvice')}</Text>
                              </View>
                            </>
                          )}
                          {errorStats.tirErrorResults.long > 0 && (
                            <>
                              <StatRow label={t('stats', 'longLabel')} value={errorStats.tirErrorResults.long} subValue={`${Math.round((errorStats.tirErrorResults.long / errorStats.totalTirErrorResults) * 100)}%`} icon="arrow-upward" color="#F44336" />
                              <View style={styles.coachingTip}>
                                <View style={styles.coachingTipHeader}>
                                  <MaterialIcons name="psychology" size={14} color={theme.tirColor} />
                                  <Text style={styles.coachingTipCause}>{t('stats', 'longCause')}</Text>
                                </View>
                                <Text style={styles.coachingTipAdvice}>{t('stats', 'longAdvice')}</Text>
                              </View>
                            </>
                          )}
                          {errorStats.tirErrorResults.tirBouchon > 0 && (
                            <>
                              <StatRow label={t('stats', 'tirBouchonLabel')} value={errorStats.tirErrorResults.tirBouchon} subValue={`${Math.round((errorStats.tirErrorResults.tirBouchon / errorStats.totalTirErrorResults) * 100)}%`} icon="adjust" color={theme.warning} />
                              <View style={styles.coachingTip}>
                                <View style={styles.coachingTipHeader}>
                                  <MaterialIcons name="psychology" size={14} color={theme.tirColor} />
                                  <Text style={styles.coachingTipCause}>{t('stats', 'tirBouchonCause')}</Text>
                                </View>
                                <Text style={styles.coachingTipAdvice}>{t('stats', 'tirBouchonAdvice')}</Text>
                              </View>
                            </>
                          )}
                          <View style={styles.divider} />
                          <BreakdownBar items={[
                            { label: t('stats', 'courtDShort'), value: errorStats.tirErrorResults.courtDroite, color: '#E57373' },
                            { label: t('stats', 'courtGShort'), value: errorStats.tirErrorResults.courtGauche, color: '#EF5350' },
                            { label: t('stats', 'longShort'), value: errorStats.tirErrorResults.long, color: '#F44336' },
                            { label: t('stats', 'jackShort'), value: errorStats.tirErrorResults.tirBouchon, color: theme.warning },
                          ].filter(i => i.value > 0)} />
                        </>
                      )}
                      {/* Technique failure rates (only if no shot results available) */}
                      {errorStats.totalTirErrorResults === 0 && errorStats.totalTirErrorByTechnique > 0 && (
                        <>
                          {errorStats.tirErrorByTechnique.auFerRate > 0 && (
                            <StatRow label={t('stats', 'tirTenduMissedLabel')} value={errorStats.tirErrorByTechnique.auFerRate} subValue={`${Math.round((errorStats.tirErrorByTechnique.auFerRate / errorStats.totalTirErrorByTechnique) * 100)}%`} icon="gps-fixed" color={theme.tirColor} />
                          )}
                          {errorStats.tirErrorByTechnique.auPlombRate > 0 && (
                            <StatRow label={t('stats', 'tirClocheMissedLabel')} value={errorStats.tirErrorByTechnique.auPlombRate} subValue={`${Math.round((errorStats.tirErrorByTechnique.auPlombRate / errorStats.totalTirErrorByTechnique) * 100)}%`} icon="flight-takeoff" color={theme.pointColor} />
                          )}
                          {errorStats.tirErrorByTechnique.enRafleRate > 0 && (
                            <StatRow label={t('stats', 'enRafleMissedLabel')} value={errorStats.tirErrorByTechnique.enRafleRate} subValue={`${Math.round((errorStats.tirErrorByTechnique.enRafleRate / errorStats.totalTirErrorByTechnique) * 100)}%`} icon="swap-horiz" color={theme.accent} />
                          )}
                        </>
                      )}
                      {/* Technique breakdown with cross-reference */}
                      {tirStats.hasCrossResultData && errorStats.totalTirErrorResults > 0 && (
                        <>
                          <View style={styles.divider} />
                          <Text style={styles.errorSubsectionTitle}>{t('stats', 'failsByTechniqueLabel')}</Text>
                          {[
                            { key: 'au_fer', label: t('stats', 'tirTenduMissedLabel'), icon: 'gps-fixed', color: theme.tirColor },
                            { key: 'au_plomb', label: t('stats', 'tirClocheMissedLabel'), icon: 'flight-takeoff', color: theme.pointColor },
                            { key: 'en_rafle', label: t('stats', 'enRafleMissedLabel'), icon: 'swap-horiz', color: theme.accent },
                          ].filter(row => tirStats.crossTypeResult[row.key]?.total > 0).map((row, idx, arr) => {
                            const data = tirStats.crossTypeResult[row.key];
                            const resultItems = [
                              { label: t('stats', 'courtDroiteFull'), short: t('stats', 'courtDroiteAbbr'), value: data.court_droite, color: '#E57373' },
                              { label: t('stats', 'courtGaucheFull'), short: t('stats', 'courtGaucheAbbr'), value: data.court_gauche, color: '#EF5350' },
                              { label: t('stats', 'longFull'), short: t('stats', 'longAbbr'), value: data.long, color: '#F44336' },
                              { label: t('stats', 'jackFull'), short: t('stats', 'jackAbbr'), value: data.tir_bouchon, color: theme.warning },
                            ];
                            const dominant = resultItems.reduce((max, r) => r.value > max.value ? r : max, resultItems[0]);
                            const dominantPct = data.total > 0 ? Math.round((dominant.value / data.total) * 100) : 0;
                            return (
                              <View key={row.key}>
                                <StatRow
                                  label={row.label}
                                  value={data.total}
                                  subValue={dominant.value > 0 ? `${t('stats', 'insightMainly')} ${dominant.label.toLowerCase()} (${dominantPct}%)` : ''}
                                  icon={row.icon}
                                  color={row.color}
                                />
                                {data.total > 1 && (
                                  <View style={{ paddingLeft: 38, paddingRight: 8, paddingBottom: 8, paddingTop: 4 }}>
                                    <BreakdownBar items={resultItems.filter(r => r.value > 0).map(r => ({
                                      label: r.short, value: r.value, color: r.color,
                                    }))} />
                                  </View>
                                )}
                                {idx < arr.length - 1 && <View style={styles.divider} />}
                              </View>
                            );
                          })}
                        </>
                      )}
                      {(() => {
                        const entries = Object.entries(tirStats.crossTypeResult).filter(([, v]) => v.total >= 2);
                        if (entries.length < 2) return null;
                        const labels: Record<string, string> = { au_fer: t('stats', 'tirTenduLabel'), au_plomb: t('stats', 'tirClocheLabel'), en_rafle: t('stats', 'enRafleLabel') };
                        const courtRates = entries.map(([key, v]) => ({ key, rate: v.total > 0 ? ((v.court_droite + v.court_gauche) / v.total) * 100 : 0 }));
                        const longRates = entries.map(([key, v]) => ({ key, rate: v.total > 0 ? (v.long / v.total) * 100 : 0 }));
                        courtRates.sort((a, b) => b.rate - a.rate);
                        longRates.sort((a, b) => b.rate - a.rate);
                        const worstCourt = courtRates[0];
                        const worstLong = longRates[0];
                        if (worstCourt.rate < 30 && worstLong.rate < 30) return null;
                        const mainIssue = worstCourt.rate >= worstLong.rate ? worstCourt : worstLong;
                        const issueType = worstCourt.rate >= worstLong.rate ? 'courts' : 'longs';
                        return (
                          <View style={styles.insightBox}>
                            <MaterialIcons name="lightbulb" size={16} color={theme.tirColor} />
                            <Text style={styles.insightText}>
                              {t('stats', 'yourLabel')} <Text style={{ fontWeight: '700', color: theme.error }}>{labels[mainIssue.key]}</Text> {issueType === 'courts' ? t('stats', 'insightMainlyCourts') : t('stats', 'insightMainlyLongs')} ({Math.round(mainIssue.rate)}%).
                              {issueType === 'courts' ? ` ${t('stats', 'insightWorkPower')}` : ` ${t('stats', 'insightReduceForce')}`}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </Animated.View>
                )}

                {/* Ad Banner */}
                <AdBanner position="inline" />

                {/* Detailed point errors */}
                {errorStats.totalPointErrorTyped > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
                    <SectionHeader title={t('stats', 'pointFailAnalysisSection')} subtitle={`${errorStats.totalPointErrorTyped} ${t('stats', 'errorsAnalyzedLabel')}`} icon="highlight-off" color={theme.pointColor} />
                    <View style={styles.card}>
                      {errorStats.pointErrorTypes.rate > 0 && (
                        <>
                          <StatRow label={t('stats', 'pointRateLabel2')} value={errorStats.pointErrorTypes.rate} subValue={`${Math.round((errorStats.pointErrorTypes.rate / errorStats.totalPointErrorTyped) * 100)}%`} icon="cancel" color={theme.error} />
                          <View style={styles.coachingTipPoint}>
                            <View style={styles.coachingTipHeader}>
                              <MaterialIcons name="psychology" size={14} color={theme.pointColor} />
                              <Text style={[styles.coachingTipCause, { color: theme.pointColor }]}>{t('stats', 'pointRateCause')}</Text>
                            </View>
                            <Text style={styles.coachingTipAdvice}>{t('stats', 'pointRateAdvice')}</Text>
                          </View>
                        </>
                      )}
                      {errorStats.pointErrorTypes.crochete > 0 && (
                        <>
                          <StatRow label={t('stats', 'pointCrocheteLabel')} value={errorStats.pointErrorTypes.crochete} subValue={`${Math.round((errorStats.pointErrorTypes.crochete / errorStats.totalPointErrorTyped) * 100)}%`} icon="sync-problem" color={theme.warning} />
                          <View style={styles.coachingTipPoint}>
                            <View style={styles.coachingTipHeader}>
                              <MaterialIcons name="psychology" size={14} color={theme.pointColor} />
                              <Text style={[styles.coachingTipCause, { color: theme.pointColor }]}>{t('stats', 'pointCrocheteCause')}</Text>
                            </View>
                            <Text style={styles.coachingTipAdvice}>{t('stats', 'pointCrocheteAdvice')}</Text>
                          </View>
                        </>
                      )}
                      {errorStats.pointErrorTypes.sorti > 0 && (
                        <>
                          <StatRow label={t('stats', 'pointSortiLabel')} value={errorStats.pointErrorTypes.sorti} subValue={`${Math.round((errorStats.pointErrorTypes.sorti / errorStats.totalPointErrorTyped) * 100)}%`} icon="logout" color={theme.error} />
                          <View style={styles.coachingTipPoint}>
                            <View style={styles.coachingTipHeader}>
                              <MaterialIcons name="psychology" size={14} color={theme.pointColor} />
                              <Text style={[styles.coachingTipCause, { color: theme.pointColor }]}>{t('stats', 'pointSortiCause')}</Text>
                            </View>
                            <Text style={styles.coachingTipAdvice}>{t('stats', 'pointSortiAdvice')}</Text>
                          </View>
                        </>
                      )}
                      <View style={styles.divider} />
                      <Text style={styles.errorSubsectionTitle}>{t('stats', 'failsByPointTypeLabel')}</Text>
                      {errorStats.pointErrorTypes.rouleRate > 0 && (
                        <StatRow label={t('stats', 'rolledMissedLabel')} value={errorStats.pointErrorTypes.rouleRate} icon="sports-baseball" color={theme.textMuted} />
                      )}
                      {errorStats.pointErrorTypes.plombeRate > 0 && (
                        <StatRow label={t('stats', 'lobbedMissedLabel')} value={errorStats.pointErrorTypes.plombeRate} icon="flight-land" color={theme.textMuted} />
                      )}
                      {errorStats.pointErrorTypes.demiPorteeRate > 0 && (
                        <StatRow label={t('stats', 'halfCarryMissedLabel')} value={errorStats.pointErrorTypes.demiPorteeRate} icon="height" color={theme.textMuted} />
                      )}
                      {errorStats.pointErrorTypes.porteeRate > 0 && (
                        <StatRow label={t('stats', 'carriedMissedLabel')} value={errorStats.pointErrorTypes.porteeRate} icon="flight" color={theme.textMuted} />
                      )}
                      <View style={styles.divider} />
                      <BreakdownBar items={[
                        { label: t('stats', 'missedPointShort'), value: errorStats.pointErrorTypes.rate, color: theme.error },
                        { label: t('stats', 'hookedShort'), value: errorStats.pointErrorTypes.crochete, color: theme.warning },
                        { label: t('stats', 'outOfBoundsShort'), value: errorStats.pointErrorTypes.sorti, color: '#8B0000' },
                      ].filter(i => i.value > 0)} />
                      {errorStats.pointErrorTypes.crochete > errorStats.pointErrorTypes.rate && (
                        <View style={styles.insightBox}>
                          <MaterialIcons name="lightbulb" size={16} color={theme.pointColor} />
                          <Text style={styles.insightText}>{t('stats', 'insightReleaseError')}</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* Consecutive errors */}
                {errorStats.maxConsecutiveErrors > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
                    <SectionHeader title={t('stats', 'errorStreaksSection')} subtitle={t('stats', 'difficultPassagesLabel')} icon="trending-down" color={theme.error} />
                    <View style={styles.card}>
                      <View style={styles.consecutiveErrorsGrid}>
                        <View style={styles.consecutiveErrorItem}>
                          <Text style={styles.consecutiveErrorValue}>{errorStats.maxConsecutiveErrors}</Text>
                          <Text style={styles.consecutiveErrorLabel}>{t('stats', 'maxConsecutiveLabel')}</Text>
                        </View>
                        <View style={styles.consecutiveErrorItem}>
                          <Text style={styles.consecutiveErrorValue}>{errorStats.totalErrorStreaks}</Text>
                          <Text style={styles.consecutiveErrorLabel}>{t('stats', 'streaks3PlusLabel')}</Text>
                        </View>
                      </View>
                      {errorStats.maxConsecutiveErrors >= 5 && (
                        <View style={styles.insightBox}>
                          <MaterialIcons name="warning" size={16} color={theme.error} />
                          <Text style={styles.insightText}>{t('stats', 'insightConsecutiveErrors')}</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* No detailed data */}
                {errorStats.totalTirErrorTyped === 0 && errorStats.totalPointErrorTyped === 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                    <View style={styles.card}>
                      <NAPlaceholder message={t('stats', 'useDetailedNotationLabel')} />
                    </View>
                  </Animated.View>
                )}

                {terrainTypeStats.hasData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
                    <SectionHeader title={t('stats', 'statsByTerrainSection')} subtitle={`${terrainTypeStats.totalTerrainMatches} ${t('stats', 'terrainMatchesSubtitle')}`} icon="terrain" color={theme.error} />
                    <View style={styles.card}>
                      <View style={styles.crossTableHeader}>
                        <View style={styles.crossTableHeaderLabel}><Text style={styles.crossTableHeaderText}>{t('stats', 'terrainColumn')}</Text></View>
                        <View style={styles.crossTableHeaderCell}><Text style={[styles.crossTableHeaderCellText, { color: theme.error }]}>{t('stats', 'errorRateColumn')}</Text></View>
                        <View style={styles.crossTableHeaderCell}><Text style={styles.crossTableHeaderCellText}>{t('stats', 'matchesColumn')}</Text></View>
                      </View>
                      {terrainTypeStats.types.map((type, idx) => {
                        const data = terrainTypeStats.byTerrain[type];
                        const totalActions = data.tirs + data.points;
                        const totalSuccess = data.tirsSuccess + data.pointsSuccess;
                        const errRate = totalActions > 0 ? Math.round(((totalActions - totalSuccess) / totalActions) * 100) : 0;
                        return (
                          <View key={type} style={[styles.crossTableRow, idx % 2 === 0 && styles.crossTableRowAlt]}>
                            <View style={styles.crossTableRowLabel}>
                              <Text style={styles.crossTableRowLabelText} numberOfLines={1}>{t('terrainTypes', type)}</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={[styles.crossTableCellValue, { color: errRate > 40 ? theme.error : errRate > 25 ? theme.warning : theme.success }]}>{errRate}%</Text>
                            </View>
                            <View style={styles.crossTableCell}>
                              <Text style={styles.crossTableCellValue}>{data.matches}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </Animated.View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Enhanced Progression Modal */}
      <Modal visible={showProgressionModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProgressionModal(false)}>
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{t('stats', 'progressionTitle')}</Text>
              <Text style={styles.modalSubtitle}>{t('stats', 'performanceEvolution')}</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={() => setShowProgressionModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>

          {/* Progression Time Filter */}
          <View style={styles.progressionFilterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressionFilterScroll}>
              {PROGRESSION_FILTERS.map(filter => (
                <Pressable
                  key={filter.id}
                  style={[styles.progressionFilterPill, progressionFilter === filter.id && styles.progressionFilterPillActive]}
                  onPress={() => { Haptics.selectionAsync(); setProgressionFilter(filter.id); }}
                >
                  <Text style={[styles.progressionFilterText, progressionFilter === filter.id && styles.progressionFilterTextActive]}>
                    {filter.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          
          <ScrollView style={styles.modalContent} contentContainerStyle={[styles.modalScrollContent, isTablet && styles.modalScrollContentTablet]} showsVerticalScrollIndicator={false}>
            {progressionData.weeklyData.length > 0 ? (
              <>
                {/* Trend Summary Cards */}
                <View style={[styles.trendCardsRow, isTablet && styles.trendCardsRowTablet]}>
                  <View style={[styles.trendCard, { borderLeftColor: theme.primary }, isTablet && styles.trendCardTablet]}>
                    <View style={styles.trendCardHeader}>
                      <MaterialIcons name="emoji-events" size={isTablet ? 22 : 18} color={theme.primary} />
                      <MaterialIcons name={trends.winRate === 'up' ? 'trending-up' : trends.winRate === 'down' ? 'trending-down' : 'remove'} size={isTablet ? 20 : 16} color={trends.winRate === 'up' ? theme.success : trends.winRate === 'down' ? theme.error : theme.textMuted} />
                    </View>
                    <Text style={[styles.trendCardValue, isTablet && styles.trendCardValueTablet]}>{performanceStats.winRate}%</Text>
                    <Text style={[styles.trendCardLabel, isTablet && styles.trendCardLabelTablet]}>{t('stats', 'victoriesLabel')}</Text>
                  </View>
                  <View style={[styles.trendCard, { borderLeftColor: theme.tirColor }, isTablet && styles.trendCardTablet]}>
                    <View style={styles.trendCardHeader}>
                      <MaterialIcons name="gps-fixed" size={isTablet ? 22 : 18} color={theme.tirColor} />
                      <MaterialIcons name={trends.tirRate === 'up' ? 'trending-up' : trends.tirRate === 'down' ? 'trending-down' : 'remove'} size={isTablet ? 20 : 16} color={trends.tirRate === 'up' ? theme.success : trends.tirRate === 'down' ? theme.error : theme.textMuted} />
                    </View>
                    <Text style={[styles.trendCardValue, isTablet && styles.trendCardValueTablet]}>{tirStats.successRate}%</Text>
                    <Text style={[styles.trendCardLabel, isTablet && styles.trendCardLabelTablet]}>{t('stats', 'shotShort')}</Text>
                  </View>
                  <View style={[styles.trendCard, { borderLeftColor: theme.pointColor }, isTablet && styles.trendCardTablet]}>
                    <View style={styles.trendCardHeader}>
                      <MaterialIcons name="adjust" size={isTablet ? 22 : 18} color={theme.pointColor} />
                      <MaterialIcons name={trends.pointRate === 'up' ? 'trending-up' : trends.pointRate === 'down' ? 'trending-down' : 'remove'} size={isTablet ? 20 : 16} color={trends.pointRate === 'up' ? theme.success : trends.pointRate === 'down' ? theme.error : theme.textMuted} />
                    </View>
                    <Text style={[styles.trendCardValue, isTablet && styles.trendCardValueTablet]}>{pointStats.successRate}%</Text>
                    <Text style={[styles.trendCardLabel, isTablet && styles.trendCardLabelTablet]}>{t('stats', 'pointageLabel')}</Text>
                  </View>
                </View>

                {/* Charts Row 1: Win Rate + Tir */}
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
                            <Circle cx={x} cy={y} r={isTablet ? 6 : 5} fill={theme.primary} />
                            {data.matches > 0 && <SvgText x={x} y={y - 10} fontSize={isTablet ? '11' : '9'} fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.winRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
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
                            <Circle cx={x} cy={y} r={isTablet ? 6 : 5} fill={theme.tirColor} />
                            {data.tirTotal > 0 && <SvgText x={x} y={y - 10} fontSize={isTablet ? '11' : '9'} fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.tirRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
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
                            <Circle cx={x} cy={y} r={isTablet ? 6 : 5} fill={theme.pointColor} />
                            {data.pointTotal > 0 && <SvgText x={x} y={y - 10} fontSize={isTablet ? '11' : '9'} fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.pointRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
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
                            <Rect x={x} y={(modalBarChartHeight - 30) - barHeight} width={barWidth} height={barHeight} fill={theme.carreauColor} rx="3" />
                            {data.carreaux > 0 && <SvgText x={x + barWidth / 2} y={(modalBarChartHeight - 35) - barHeight} fontSize={isTablet ? '12' : '10'} fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.carreaux}</SvgText>}
                            <SvgText x={x + barWidth / 2} y={modalBarChartHeight - 10} fontSize={isTablet ? '10' : '8'} fill={theme.textMuted} textAnchor="middle">{data.week}</SvgText>
                          </G>
                        );
                      })}
                    </Svg>
                  </View>
                </View>
                </View>

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
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1.2 }]}>{t('stats', 'weekShort')}</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>{t('stats', 'gamesShort')}</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>{t('stats', 'winsShort')}</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>{t('stats', 'shotShort')}</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>{t('stats', 'pointShort')}</Text>
                    </View>
                    {progressionData.weeklyData.slice(-8).map((data, i) => (
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
                {itemPickerType === 'match' ? t('profile', 'selectMatch') : itemPickerType === 'challenge' ? t('profile', 'selectChallenge') : itemPickerType === 'opponent' ? t('profile', 'selectOpponent') : itemPickerType === 'partner' ? t('profile', 'selectPartner') : itemPickerType === 'terrain' ? t('profile', 'selectTerrain') : t('profile', 'selectTournament')}
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

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12, marginBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: theme.textPrimary },
  headerSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.primary + '15', borderRadius: theme.borderRadius.md },
  progressionButtonText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  historyButton: { padding: 8, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md },
  filterBar: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
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
  categoryTabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 6 },
  categoryTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: theme.borderRadius.md, backgroundColor: theme.backgroundSecondary },
  categoryTabActive: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  categoryTabText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },
  categoryTabTextActive: { fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  scrollContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },
  tabletRow: { flexDirection: 'row' as const, gap: 16, marginBottom: 0 },
  tabletHalf: { flex: 1 },
  heroCardTablet: { padding: 28 },
  sectionTabletWide: { },
  errorRatesGridTablet: { gap: 20 },
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  sectionSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  card: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, ...theme.shadows.card },
  heroCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, marginBottom: 20, ...theme.shadows.card },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  heroStats: { gap: 16 },
  heroStatItem: { alignItems: 'center' },
  heroStatValue: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
  heroStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  ringValue: { fontWeight: '700' },
  ringLabel: { color: theme.textSecondary, marginTop: -2 },
  statsGrid3: { flexDirection: 'row', justifyContent: 'space-around' },
  gridItem: { alignItems: 'center' },
  gridValue: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  gridLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  modeWinRates: { gap: 16 },
  modeWinRateItem: { gap: 8 },
  modeLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBarTrack: { flex: 1, height: 8, backgroundColor: theme.backgroundSecondary, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressBarValue: { fontSize: 14, fontWeight: '700', minWidth: 45, textAlign: 'right' },
  formatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  formatInfo: { width: 100 },
  formatName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  formatRecord: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  formatBarContainer: { flex: 1, marginLeft: 12 },
  scoreComparison: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16 },
  scoreItem: { flex: 1, alignItems: 'center' },
  scoreValue: { fontSize: 32, fontWeight: '700', marginTop: 8 },
  scoreLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  scoreDiff: { alignItems: 'center', paddingHorizontal: 16 },
  scoreDiffBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  scoreDiffText: { fontSize: 20, fontWeight: '700' },
  scoreDiffLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2 },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  statRowIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  statRowContent: { flex: 1 },
  statRowLabel: { fontSize: 13, color: theme.textPrimary },
  statRowSubValue: { fontSize: 10, color: theme.textMuted },
  statRowValue: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
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
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24, maxWidth: 260 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: theme.borderRadius.md },
  emptyButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
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
  errorHeroValue: { fontSize: 48, fontWeight: '700', color: theme.error, marginTop: 8 },
  errorHeroLabel: { fontSize: 12, color: theme.textMuted },
  errorHeroBreakdown: { gap: 16 },
  errorHeroItem: { alignItems: 'center' },
  errorHeroItemValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginTop: 4 },
  errorHeroItemLabel: { fontSize: 10, color: theme.textMuted },
  mostCommonError: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  mostCommonErrorText: { flex: 1, fontSize: 12, color: theme.textSecondary },
  mostCommonErrorHighlight: { fontWeight: '700', color: theme.warning },
  errorRatesGrid: { flexDirection: 'row', gap: 12 },
  errorRateCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: theme.borderRadius.md, borderWidth: 2, backgroundColor: theme.backgroundSecondary },
  errorRateValue: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  errorRateLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  insightBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12, padding: 12, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, borderLeftWidth: 3, borderLeftColor: theme.warning },
  insightText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 18 },
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
  progressionFilterContainer: { backgroundColor: theme.surface, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  progressionFilterScroll: { paddingHorizontal: 16, gap: 8 },
  progressionFilterPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.borderRadius.full, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  progressionFilterPillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  progressionFilterText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  progressionFilterTextActive: { color: '#FFF' },
  trendCardsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  trendCardsRowTablet: { gap: 16, marginBottom: 24 },
  trendCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 12, borderLeftWidth: 3, ...theme.shadows.card },
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
  chartContainer: { alignItems: 'center', marginBottom: 8 },
  summaryTable: { borderRadius: theme.borderRadius.md, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  summaryHeader: { flexDirection: 'row', backgroundColor: theme.backgroundSecondary, paddingVertical: 10 },
  summaryRow: { flexDirection: 'row', paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border },
  summaryRowAlt: { backgroundColor: theme.backgroundSecondary + '50' },
  summaryCell: { fontSize: 12, color: theme.textPrimary, textAlign: 'center', fontWeight: '500' },
  summaryCellHeader: { fontWeight: '700', color: theme.textSecondary, fontSize: 11 },
  noProgressionData: { alignItems: 'center', paddingVertical: 48 },
  noProgressionTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  noProgressionText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 260 },
  // Cross-reference table styles
  crossTableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border, marginBottom: 4 },
  crossTableHeaderLabel: { flex: 1.5, paddingLeft: 4 },
  crossTableHeaderText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  crossTableHeaderCell: { flex: 1, alignItems: 'center', gap: 2 },
  crossTableHeaderCellText: { fontSize: 9, fontWeight: '600' },
  crossTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border + '50' },
  crossTableRowAlt: { backgroundColor: theme.backgroundSecondary + '40' },
  crossTableRowLabel: { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4 },
  crossTableRowLabelText: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  crossTableCell: { flex: 1, alignItems: 'center' },
  crossTableCellValue: { fontSize: 15, fontWeight: '700' },
  crossTableCellPct: { fontSize: 9, color: theme.textMuted, marginTop: 1 },
});
