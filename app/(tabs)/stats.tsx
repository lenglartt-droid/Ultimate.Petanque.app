import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import Svg, { Circle, Line, G, Text as SvgText, Rect } from 'react-native-svg';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

// ============================================
// TYPES & CONSTANTS
// ============================================
type TimeFilter = 'week' | 'month' | 'year' | 'all';
type ProgressionFilter = '4weeks' | '8weeks' | '3months' | '6months' | 'year';
type StatsCategory = 'performance' | 'tir' | 'point' | 'errors';

const TIME_FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'week', label: '7j' },
  { id: 'month', label: '30j' },
  { id: 'year', label: '1an' },
  { id: 'all', label: 'Tout' },
];

const PROGRESSION_FILTERS: { id: ProgressionFilter; label: string; weeks: number }[] = [
  { id: '4weeks', label: '4 sem.', weeks: 4 },
  { id: '8weeks', label: '8 sem.', weeks: 8 },
  { id: '3months', label: '3 mois', weeks: 13 },
  { id: '6months', label: '6 mois', weeks: 26 },
  { id: 'year', label: '1 an', weeks: 52 },
];

const CATEGORY_TABS: { id: StatsCategory; label: string; icon: string; color: string }[] = [
  { id: 'performance', label: 'Perf.', icon: 'emoji-events', color: theme.primary },
  { id: 'tir', label: 'Tir', icon: 'gps-fixed', color: theme.tirColor },
  { id: 'point', label: 'Point', icon: 'adjust', color: theme.pointColor },
  { id: 'errors', label: 'Erreurs', icon: 'error-outline', color: theme.error },
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
    case 'week':
      startDate = new Date(startOfDay);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
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
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { matches, challenges } = useApp();
  
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [category, setCategory] = useState<StatsCategory>('performance');
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [progressionFilter, setProgressionFilter] = useState<ProgressionFilter>('8weeks');

  // Filter data
  const filteredMatches = filterByTime(matches, timeFilter);
  const filteredChallenges = filterByTime(challenges, timeFilter);

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
      carreau: { total: 0, success: 0 }, court_droite: { total: 0, success: 0 },
      court_gauche: { total: 0, success: 0 }, long: { total: 0, success: 0 },
      tir_bouchon: { total: 0, success: 0 },
    };
    
    const shotQualityStats: Record<string, number> = { gain_point: 0, sans_effet: 0, negatif: 0, decisif: 0 };
    
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
              if (shot.carreau) { shotTypeStats.carreau.total++; shotTypeStats.carreau.success++; }
              if (shot.shotQuality && shotQualityStats[shot.shotQuality] !== undefined) {
                shotQualityStats[shot.shotQuality]++;
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

    return {
      totalTirs: combinedTirs, tirsSuccess: combinedSuccess, carreaux: combinedCarreaux,
      successRate, carreauRate, demiTirRate, missedRate, tirsPerMatch, tirsPerMene,
      matchTirs: totalTirs, challengeTirs, hasDetailedData, totalDetailedTirs, totalQualityTracked,
      tirGainPoint: shotQualityStats.gain_point, tirSansEffet: shotQualityStats.sans_effet,
      tirNegatif: shotQualityStats.negatif, tirsDecisifs: shotQualityStats.decisif,
      tirAuFer: shotTypeStats.au_fer, tirAuPlomb: shotTypeStats.au_plomb,
      tirEnRafle: shotTypeStats.en_rafle, tirCourtRamasse: shotTypeStats.court_ramasse,
      tirCarreau: shotTypeStats.carreau, tirCourtDroite: shotTypeStats.court_droite,
      tirCourtGauche: shotTypeStats.court_gauche, tirLong: shotTypeStats.long,
      tirBouchon: shotTypeStats.tir_bouchon,
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
      excellent: 0, bon: 0, moyen: 0, au_bouchon: 0, rate: 0, crochete: 0, sorti: 0,
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
    const successQualitiesTotal = pointQualityStats.excellent + pointQualityStats.bon + pointQualityStats.moyen + pointQualityStats.au_bouchon;
    const failureQualitiesTotal = pointQualityStats.rate + pointQualityStats.crochete + pointQualityStats.sorti;

    return {
      totalPoints, pointsSuccess, successRate, pointsPerMene,
      hasDetailedData, totalDetailedPoints, totalQualityTracked,
      pointRoule: pointTypeStats.roule, pointPlombe: pointTypeStats.plombe,
      pointDemiPortee: pointTypeStats.demi_portee, pointPortee: pointTypeStats.portee,
      pointExcellent: pointQualityStats.excellent, pointBon: pointQualityStats.bon,
      pointMoyen: pointQualityStats.moyen, pointAuBouchon: pointQualityStats.au_bouchon,
      successQualitiesTotal, pointRate: pointQualityStats.rate,
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
    
    // Detailed tir error types
    const tirErrorTypes = {
      courtDroite: tirStats.tirCourtDroite.total,
      courtGauche: tirStats.tirCourtGauche.total,
      long: tirStats.tirLong.total,
      tirBouchon: tirStats.tirBouchon.total,
      auFerRate: tirStats.tirAuFer.total - tirStats.tirAuFer.success,
      auPlombRate: tirStats.tirAuPlomb.total - tirStats.tirAuPlomb.success,
      enRafleRate: tirStats.tirEnRafle.total - tirStats.tirEnRafle.success,
    };
    const totalTirErrorTyped = Object.values(tirErrorTypes).reduce((a, b) => a + b, 0);
    
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
      { type: 'Court à droite', count: tirErrorTypes.courtDroite, category: 'tir' },
      { type: 'Court à gauche', count: tirErrorTypes.courtGauche, category: 'tir' },
      { type: 'Long', count: tirErrorTypes.long, category: 'tir' },
      { type: 'Tir sur bouchon', count: tirErrorTypes.tirBouchon, category: 'tir' },
      { type: 'Point raté', count: pointErrorTypes.rate, category: 'point' },
      { type: 'Point crocheté', count: pointErrorTypes.crochete, category: 'point' },
      { type: 'Point sorti', count: pointErrorTypes.sorti, category: 'point' },
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
      pointErrorTypes, totalPointErrorTyped,
      mostCommonError, allErrors,
    };
  }, [filteredMatches, tirStats, pointStats]);

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

  const hasData = performanceStats.total > 0;

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
            <Text style={styles.headerTitle}>Statistiques</Text>
            <Text style={styles.headerSubtitle}>
              {performanceStats.total} parties • {performanceStats.winRate}% victoires
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <Pressable 
              style={styles.progressionButton}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowProgressionModal(true); }}
            >
              <MaterialIcons name="trending-up" size={18} color={theme.primary} />
              <Text style={styles.progressionButtonText}>Progression</Text>
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {!hasData ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="bar-chart" size={64} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Pas encore de statistiques</Text>
            <Text style={styles.emptyText}>Jouez des matchs pour voir vos statistiques évoluer</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/match/new')}>
              <MaterialIcons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>Nouveau match</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* PERFORMANCE */}
            {category === 'performance' && (
              <>
                <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
                  <View style={styles.heroContent}>
                    <ProgressRing value={performanceStats.winRate} size={110} strokeWidth={9} color={theme.primary} label="Victoires" />
                    <View style={styles.heroStats}>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.success }]}>{performanceStats.wins}</Text>
                        <Text style={styles.heroStatLabel}>Gagnées</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.error }]}>{performanceStats.losses}</Text>
                        <Text style={styles.heroStatLabel}>Perdues</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatValue}>{performanceStats.total}</Text>
                        <Text style={styles.heroStatLabel}>Total</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title="Parties jouées" icon="sports" color={theme.primary} />
                  <View style={styles.card}>
                    <View style={styles.statsGrid3}>
                      <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.total}</Text><Text style={styles.gridLabel}>Total</Text></View>
                      <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.trainingCount}</Text><Text style={styles.gridLabel}>Entraînement</Text></View>
                      <View style={styles.gridItem}><Text style={styles.gridValue}>{performanceStats.tournamentCount}</Text><Text style={styles.gridLabel}>Tournoi</Text></View>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                  <SectionHeader title="Taux de victoire par mode" icon="emoji-events" color={theme.carreauColor} />
                  <View style={styles.card}>
                    <View style={styles.modeWinRates}>
                      <View style={styles.modeWinRateItem}>
                        <Text style={styles.modeLabel}>Entraînement</Text>
                        <ProgressBar value={performanceStats.trainingWinRate} color={theme.primary} />
                      </View>
                      <View style={styles.modeWinRateItem}>
                        <Text style={styles.modeLabel}>Tournoi</Text>
                        <ProgressBar value={performanceStats.tournamentWinRate} color={theme.carreauColor} />
                      </View>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                  <SectionHeader title="Taux de victoire par format" icon="group" color={theme.accent} />
                  <View style={styles.card}>
                    {Object.entries(performanceStats.byFormat).map(([format, data]) => {
                      const rate = data.total > 0 ? Math.round((data.wins / data.total) * 100) : 0;
                      return (
                        <View key={format} style={styles.formatRow}>
                          <View style={styles.formatInfo}>
                            <Text style={styles.formatName}>{format}</Text>
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
                  <SectionHeader title="Score moyen par partie" icon="scoreboard" color={theme.success} />
                  <View style={styles.card}>
                    <View style={styles.scoreComparison}>
                      <View style={styles.scoreItem}>
                        <MaterialIcons name="add-circle" size={28} color={theme.success} />
                        <Text style={[styles.scoreValue, { color: theme.success }]}>{performanceStats.avgScoreFor}</Text>
                        <Text style={styles.scoreLabel}>Marqués</Text>
                      </View>
                      <View style={styles.scoreDiff}>
                        <View style={[styles.scoreDiffBadge, { backgroundColor: performanceStats.pointDiff >= 0 ? theme.success + '15' : theme.error + '15' }]}>
                          <Text style={[styles.scoreDiffText, { color: performanceStats.pointDiff >= 0 ? theme.success : theme.error }]}>
                            {performanceStats.avgPointDiff > '0' ? '+' : ''}{performanceStats.avgPointDiff}
                          </Text>
                          <Text style={styles.scoreDiffLabel}>moy./partie</Text>
                        </View>
                      </View>
                      <View style={styles.scoreItem}>
                        <MaterialIcons name="remove-circle" size={28} color={theme.error} />
                        <Text style={[styles.scoreValue, { color: theme.error }]}>{performanceStats.avgScoreAgainst}</Text>
                        <Text style={styles.scoreLabel}>Encaissés</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                {performanceStats.matchesWithDuration > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                    <SectionHeader title="Durée des parties" icon="timer" color={theme.accent} />
                    <View style={styles.card}>
                      <View style={styles.durationHero}>
                        <View style={styles.durationMain}>
                          <MaterialIcons name="schedule" size={28} color={theme.accent} />
                          <Text style={styles.durationMainValue}>{formatDuration(performanceStats.avgDuration)}</Text>
                          <Text style={styles.durationMainLabel}>durée moyenne</Text>
                        </View>
                        <View style={styles.durationMinMax}>
                          <View style={styles.durationMinMaxItem}>
                            <MaterialIcons name="fast-forward" size={16} color={theme.success} />
                            <Text style={styles.durationMinMaxValue}>{formatDuration(performanceStats.minDuration)}</Text>
                            <Text style={styles.durationMinMaxLabel}>plus rapide</Text>
                          </View>
                          <View style={styles.durationMinMaxItem}>
                            <MaterialIcons name="hourglass-full" size={16} color={theme.warning} />
                            <Text style={styles.durationMinMaxValue}>{formatDuration(performanceStats.maxDuration)}</Text>
                            <Text style={styles.durationMinMaxLabel}>plus longue</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.divider} />
                      <View style={styles.totalTimeRow}>
                        <MaterialIcons name="access-time" size={18} color={theme.textSecondary} />
                        <Text style={styles.totalTimeLabel}>Temps total de jeu</Text>
                        <Text style={styles.totalTimeValue}>{formatDuration(performanceStats.totalDuration)}</Text>
                      </View>
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            {/* TIR */}
            {category === 'tir' && (
              <>
                <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
                  <View style={styles.heroContent}>
                    <ProgressRing value={tirStats.successRate} size={110} strokeWidth={9} color={theme.tirColor} label="Réussite" />
                    <View style={styles.heroStats}>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.success }]}>{tirStats.tirsSuccess}</Text>
                        <Text style={styles.heroStatLabel}>Réussis</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.error }]}>{tirStats.totalTirs - tirStats.tirsSuccess}</Text>
                        <Text style={styles.heroStatLabel}>Manqués</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatValue}>{tirStats.totalTirs}</Text>
                        <Text style={styles.heroStatLabel}>Total</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title="Volume & Réussite" icon="gps-fixed" color={theme.tirColor} />
                  <View style={styles.card}>
                    <StatRow label="Tirs tentés" value={tirStats.totalTirs} icon="radio-button-unchecked" color={theme.textSecondary} />
                    <StatRow label="% de réussite" value={`${tirStats.successRate}%`} icon="percent" color={theme.tirColor} />
                    <StatRow label="% de carreaux" value={`${tirStats.carreauRate}%`} icon="stars" color={theme.carreauColor} />
                    <StatRow label="Tirs par partie" value={tirStats.tirsPerMatch} icon="sports" color={theme.primary} />
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                  <SectionHeader title="Répartition des résultats" icon="pie-chart" color={theme.primary} />
                  <View style={styles.card}>
                    <BreakdownBar items={[
                      { label: 'Carreaux', value: tirStats.carreaux, color: theme.carreauColor },
                      { label: 'Demi-tirs', value: tirStats.tirsSuccess - tirStats.carreaux, color: theme.pointColor },
                      { label: 'Manqués', value: tirStats.totalTirs - tirStats.tirsSuccess, color: theme.error },
                    ]} />
                  </View>
                </Animated.View>

                {tirStats.hasDetailedData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                    <SectionHeader title="Types de tir" subtitle={`${tirStats.totalDetailedTirs} tirs analysés`} icon="category" color={theme.tirColor} />
                    <View style={styles.card}>
                      <StatRow label="Tir tendu" value={`${tirStats.tirAuFer.success}/${tirStats.tirAuFer.total}`} subValue={tirStats.tirAuFer.total > 0 ? `${Math.round((tirStats.tirAuFer.success / tirStats.tirAuFer.total) * 100)}%` : ''} icon="gps-fixed" color={theme.tirColor} />
                      <StatRow label="Tir en cloche" value={`${tirStats.tirAuPlomb.success}/${tirStats.tirAuPlomb.total}`} subValue={tirStats.tirAuPlomb.total > 0 ? `${Math.round((tirStats.tirAuPlomb.success / tirStats.tirAuPlomb.total) * 100)}%` : ''} icon="flight-takeoff" color={theme.pointColor} />
                      <StatRow label="En rafle" value={`${tirStats.tirEnRafle.success}/${tirStats.tirEnRafle.total}`} subValue={tirStats.tirEnRafle.total > 0 ? `${Math.round((tirStats.tirEnRafle.success / tirStats.tirEnRafle.total) * 100)}%` : ''} icon="swap-horiz" color={theme.accent} />
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            {/* POINT */}
            {category === 'point' && (
              <>
                <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
                  <View style={styles.heroContent}>
                    <ProgressRing value={pointStats.successRate} size={110} strokeWidth={9} color={theme.pointColor} label="Réussite" />
                    <View style={styles.heroStats}>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.success }]}>{pointStats.pointsSuccess}</Text>
                        <Text style={styles.heroStatLabel}>Réussis</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={[styles.heroStatValue, { color: theme.error }]}>{pointStats.totalPoints - pointStats.pointsSuccess}</Text>
                        <Text style={styles.heroStatLabel}>Manqués</Text>
                      </View>
                      <View style={styles.heroStatItem}>
                        <Text style={styles.heroStatValue}>{pointStats.totalPoints}</Text>
                        <Text style={styles.heroStatLabel}>Total</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title="Réussite" icon="adjust" color={theme.pointColor} />
                  <View style={styles.card}>
                    <StatRow label="Points tentés" value={pointStats.totalPoints} icon="radio-button-unchecked" color={theme.textSecondary} />
                    <StatRow label="% de réussite" value={`${pointStats.successRate}%`} icon="percent" color={theme.pointColor} />
                    <StatRow label="Points par mène" value={pointStats.pointsPerMene} icon="timeline" color={theme.accent} />
                  </View>
                </Animated.View>

                {pointStats.hasDetailedData && (
                  <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                    <SectionHeader title="Types de points" subtitle={`${pointStats.totalDetailedPoints} analysés`} icon="category" color={theme.primary} />
                    <View style={styles.card}>
                      <StatRow label="Point roulé" value={`${pointStats.pointRoule.success}/${pointStats.pointRoule.total}`} icon="sports-baseball" color={theme.pointColor} />
                      <StatRow label="Point plombé" value={`${pointStats.pointPlombe.success}/${pointStats.pointPlombe.total}`} icon="flight-land" color={theme.tirColor} />
                      <StatRow label="Point portée" value={`${pointStats.pointPortee.success}/${pointStats.pointPortee.total}`} icon="flight" color={theme.accent} />
                    </View>
                  </Animated.View>
                )}

                {pointStats.successQualitiesTotal > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                    <SectionHeader title="Qualité des points réussis" subtitle={`${pointStats.successQualitiesTotal} qualifiés`} icon="straighten" color={theme.success} />
                    <View style={styles.card}>
                      <StatRow label="Excellent (< 10 cm)" value={pointStats.pointExcellent} subValue={`${Math.round((pointStats.pointExcellent / pointStats.successQualitiesTotal) * 100)}%`} icon="stars" color={theme.carreauColor} />
                      <StatRow label="Bon (< 30 cm)" value={pointStats.pointBon} subValue={`${Math.round((pointStats.pointBon / pointStats.successQualitiesTotal) * 100)}%`} icon="check-circle" color={theme.success} />
                      <StatRow label="Moyen (< 50 cm)" value={pointStats.pointMoyen} subValue={`${Math.round((pointStats.pointMoyen / pointStats.successQualitiesTotal) * 100)}%`} icon="radio-button-checked" color={theme.warning} />
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            {/* ERRORS ANALYSIS */}
            {category === 'errors' && (
              <>
                {/* Hero Errors */}
                <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroCard, { borderLeftWidth: 4, borderLeftColor: theme.error }]}>
                  <View style={styles.errorHeroContent}>
                    <View style={styles.errorHeroMain}>
                      <MaterialIcons name="error-outline" size={48} color={theme.error} />
                      <Text style={styles.errorHeroValue}>{errorStats.totalErrors}</Text>
                      <Text style={styles.errorHeroLabel}>erreurs totales</Text>
                    </View>
                    <View style={styles.errorHeroBreakdown}>
                      <View style={styles.errorHeroItem}>
                        <MaterialIcons name="gps-fixed" size={20} color={theme.tirColor} />
                        <Text style={styles.errorHeroItemValue}>{errorStats.totalTirErrors}</Text>
                        <Text style={styles.errorHeroItemLabel}>Tirs ratés</Text>
                      </View>
                      <View style={styles.errorHeroItem}>
                        <MaterialIcons name="adjust" size={20} color={theme.pointColor} />
                        <Text style={styles.errorHeroItemValue}>{errorStats.totalPointErrors}</Text>
                        <Text style={styles.errorHeroItemLabel}>Points ratés</Text>
                      </View>
                    </View>
                  </View>
                  {errorStats.mostCommonError && (
                    <View style={styles.mostCommonError}>
                      <MaterialIcons name="warning" size={16} color={theme.warning} />
                      <Text style={styles.mostCommonErrorText}>
                        Erreur la plus fréquente: <Text style={styles.mostCommonErrorHighlight}>{errorStats.mostCommonError.type}</Text> ({errorStats.mostCommonError.count}x)
                      </Text>
                    </View>
                  )}
                </Animated.View>

                {/* Error rates */}
                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title="Taux d'erreur global" icon="analytics" color={theme.error} />
                  <View style={styles.card}>
                    <View style={styles.errorRatesGrid}>
                      <View style={[styles.errorRateCard, { borderColor: theme.tirColor }]}>
                        <MaterialIcons name="gps-fixed" size={24} color={theme.tirColor} />
                        <Text style={[styles.errorRateValue, { color: theme.tirColor }]}>{errorStats.tirErrorRate}%</Text>
                        <Text style={styles.errorRateLabel}>Tirs ratés</Text>
                      </View>
                      <View style={[styles.errorRateCard, { borderColor: theme.pointColor }]}>
                        <MaterialIcons name="adjust" size={24} color={theme.pointColor} />
                        <Text style={[styles.errorRateValue, { color: theme.pointColor }]}>{errorStats.pointErrorRate}%</Text>
                        <Text style={styles.errorRateLabel}>Points ratés</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                {/* Error by duration */}
                {(errorStats.shortMatchCount > 0 || errorStats.mediumMatchCount > 0 || errorStats.longMatchCount > 0) && (
                  <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                    <SectionHeader title="Erreurs selon durée de partie" subtitle="Impact de la fatigue" icon="timer" color={theme.warning} />
                    <View style={styles.card}>
                      <StatRow label="Parties courtes (< 30 min)" value={`${errorStats.shortMatchErrorRate}%`} subValue={`${errorStats.shortMatchCount} parties`} icon="fast-forward" color={theme.success} />
                      <StatRow label="Parties moyennes (30-60 min)" value={`${errorStats.mediumMatchErrorRate}%`} subValue={`${errorStats.mediumMatchCount} parties`} icon="schedule" color={theme.warning} />
                      <StatRow label="Parties longues (> 60 min)" value={`${errorStats.longMatchErrorRate}%`} subValue={`${errorStats.longMatchCount} parties`} icon="hourglass-full" color={theme.error} />
                      {errorStats.longMatchErrorRate > errorStats.shortMatchErrorRate + 10 && (
                        <View style={styles.insightBox}>
                          <MaterialIcons name="lightbulb" size={16} color={theme.warning} />
                          <Text style={styles.insightText}>Vos erreurs augmentent de {errorStats.longMatchErrorRate - errorStats.shortMatchErrorRate}% dans les parties longues. Pensez à travailler votre endurance.</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* Error by format */}
                <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                  <SectionHeader title="Erreurs par format" icon="group" color={theme.accent} />
                  <View style={styles.card}>
                    {Object.entries(errorStats.errorByFormat).map(([format, data]) => (
                      <View key={format} style={styles.formatRow}>
                        <View style={styles.formatInfo}>
                          <Text style={styles.formatName}>{format}</Text>
                          <Text style={styles.formatRecord}>{data.errors} erreurs / {data.total} actions</Text>
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
                  <SectionHeader title="Erreurs par contexte" subtitle="Entraînement vs Tournoi" icon="psychology" color={theme.primary} />
                  <View style={styles.card}>
                    <View style={styles.contextComparison}>
                      <View style={styles.contextItem}>
                        <Text style={styles.contextLabel}>Entraînement</Text>
                        <Text style={[styles.contextValue, { color: errorStats.trainingErrorRate > errorStats.tournamentErrorRate ? theme.error : theme.success }]}>
                          {errorStats.trainingErrorRate}%
                        </Text>
                        <Text style={styles.contextSubLabel}>d'erreurs</Text>
                      </View>
                      <View style={styles.contextDivider}>
                        <MaterialIcons name="compare-arrows" size={24} color={theme.textMuted} />
                      </View>
                      <View style={styles.contextItem}>
                        <Text style={styles.contextLabel}>Tournoi</Text>
                        <Text style={[styles.contextValue, { color: errorStats.tournamentErrorRate > errorStats.trainingErrorRate ? theme.error : theme.success }]}>
                          {errorStats.tournamentErrorRate}%
                        </Text>
                        <Text style={styles.contextSubLabel}>d'erreurs</Text>
                      </View>
                    </View>
                    {Math.abs(errorStats.trainingErrorRate - errorStats.tournamentErrorRate) > 10 && (
                      <View style={styles.insightBox}>
                        <MaterialIcons name="psychology" size={16} color={theme.primary} />
                        <Text style={styles.insightText}>
                          {errorStats.tournamentErrorRate > errorStats.trainingErrorRate 
                            ? 'La pression des tournois semble vous affecter. Travaillez votre mental.'
                            : 'Vous êtes plus concentré en tournoi. Reproduisez cette intensité à l\'entraînement.'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Animated.View>

                {/* Detailed tir errors */}
                {errorStats.totalTirErrorTyped > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                    <SectionHeader title="Types de tirs ratés" subtitle={`${errorStats.totalTirErrorTyped} erreurs analysées`} icon="gps-off" color={theme.tirColor} />
                    <View style={styles.card}>
                      {errorStats.tirErrorTypes.courtDroite > 0 && (
                        <StatRow label="Court, à droite" value={errorStats.tirErrorTypes.courtDroite} subValue={`${Math.round((errorStats.tirErrorTypes.courtDroite / errorStats.totalTirErrorTyped) * 100)}%`} icon="subdirectory-arrow-right" color={theme.error} />
                      )}
                      {errorStats.tirErrorTypes.courtGauche > 0 && (
                        <StatRow label="Court, à gauche" value={errorStats.tirErrorTypes.courtGauche} subValue={`${Math.round((errorStats.tirErrorTypes.courtGauche / errorStats.totalTirErrorTyped) * 100)}%`} icon="subdirectory-arrow-left" color={theme.error} />
                      )}
                      {errorStats.tirErrorTypes.long > 0 && (
                        <StatRow label="Long" value={errorStats.tirErrorTypes.long} subValue={`${Math.round((errorStats.tirErrorTypes.long / errorStats.totalTirErrorTyped) * 100)}%`} icon="arrow-upward" color={theme.error} />
                      )}
                      {errorStats.tirErrorTypes.tirBouchon > 0 && (
                        <StatRow label="Tir sur bouchon" value={errorStats.tirErrorTypes.tirBouchon} subValue={`${Math.round((errorStats.tirErrorTypes.tirBouchon / errorStats.totalTirErrorTyped) * 100)}%`} icon="adjust" color={theme.warning} />
                      )}
                      <View style={styles.divider} />
                      <BreakdownBar items={[
                        { label: 'Court D', value: errorStats.tirErrorTypes.courtDroite, color: '#E57373' },
                        { label: 'Court G', value: errorStats.tirErrorTypes.courtGauche, color: '#EF5350' },
                        { label: 'Long', value: errorStats.tirErrorTypes.long, color: '#F44336' },
                        { label: 'Bouchon', value: errorStats.tirErrorTypes.tirBouchon, color: theme.warning },
                      ].filter(i => i.value > 0)} />
                      {(errorStats.tirErrorTypes.courtDroite + errorStats.tirErrorTypes.courtGauche) > errorStats.tirErrorTypes.long && (
                        <View style={styles.insightBox}>
                          <MaterialIcons name="lightbulb" size={16} color={theme.tirColor} />
                          <Text style={styles.insightText}>Vos tirs sont majoritairement courts. Travaillez la puissance de votre lancer.</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* Detailed point errors */}
                {errorStats.totalPointErrorTyped > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
                    <SectionHeader title="Analyse des échecs (Points)" subtitle={`${errorStats.totalPointErrorTyped} erreurs analysées`} icon="highlight-off" color={theme.pointColor} />
                    <View style={styles.card}>
                      {errorStats.pointErrorTypes.rate > 0 && (
                        <StatRow label="Raté (trop loin du but)" value={errorStats.pointErrorTypes.rate} subValue={`${Math.round((errorStats.pointErrorTypes.rate / errorStats.totalPointErrorTyped) * 100)}%`} icon="cancel" color={theme.error} />
                      )}
                      {errorStats.pointErrorTypes.crochete > 0 && (
                        <StatRow label="Crocheté (mauvaise ouverture)" value={errorStats.pointErrorTypes.crochete} subValue={`${Math.round((errorStats.pointErrorTypes.crochete / errorStats.totalPointErrorTyped) * 100)}%`} icon="sync-problem" color={theme.warning} />
                      )}
                      {errorStats.pointErrorTypes.sorti > 0 && (
                        <StatRow label="Sorti du terrain" value={errorStats.pointErrorTypes.sorti} subValue={`${Math.round((errorStats.pointErrorTypes.sorti / errorStats.totalPointErrorTyped) * 100)}%`} icon="logout" color={theme.error} />
                      )}
                      <View style={styles.divider} />
                      <Text style={styles.errorSubsectionTitle}>Échecs par type de point</Text>
                      {errorStats.pointErrorTypes.rouleRate > 0 && (
                        <StatRow label="Points roulés ratés" value={errorStats.pointErrorTypes.rouleRate} icon="sports-baseball" color={theme.textMuted} />
                      )}
                      {errorStats.pointErrorTypes.plombeRate > 0 && (
                        <StatRow label="Points plombés ratés" value={errorStats.pointErrorTypes.plombeRate} icon="flight-land" color={theme.textMuted} />
                      )}
                      {errorStats.pointErrorTypes.porteeRate > 0 && (
                        <StatRow label="Points portée ratés" value={errorStats.pointErrorTypes.porteeRate} icon="flight" color={theme.textMuted} />
                      )}
                      <View style={styles.divider} />
                      <BreakdownBar items={[
                        { label: 'Raté', value: errorStats.pointErrorTypes.rate, color: theme.error },
                        { label: 'Crocheté', value: errorStats.pointErrorTypes.crochete, color: theme.warning },
                        { label: 'Sorti', value: errorStats.pointErrorTypes.sorti, color: '#8B0000' },
                      ].filter(i => i.value > 0)} />
                      {errorStats.pointErrorTypes.crochete > errorStats.pointErrorTypes.rate && (
                        <View style={styles.insightBox}>
                          <MaterialIcons name="lightbulb" size={16} color={theme.pointColor} />
                          <Text style={styles.insightText}>Vos erreurs viennent principalement du lâcher. Concentrez-vous sur l'ouverture de main.</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* Consecutive errors */}
                {errorStats.maxConsecutiveErrors > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
                    <SectionHeader title="Séries d'erreurs" subtitle="Analyse des passages difficiles" icon="trending-down" color={theme.error} />
                    <View style={styles.card}>
                      <View style={styles.consecutiveErrorsGrid}>
                        <View style={styles.consecutiveErrorItem}>
                          <Text style={styles.consecutiveErrorValue}>{errorStats.maxConsecutiveErrors}</Text>
                          <Text style={styles.consecutiveErrorLabel}>erreurs consécutives max</Text>
                        </View>
                        <View style={styles.consecutiveErrorItem}>
                          <Text style={styles.consecutiveErrorValue}>{errorStats.totalErrorStreaks}</Text>
                          <Text style={styles.consecutiveErrorLabel}>séries de 3+ erreurs</Text>
                        </View>
                      </View>
                      {errorStats.maxConsecutiveErrors >= 5 && (
                        <View style={styles.insightBox}>
                          <MaterialIcons name="warning" size={16} color={theme.error} />
                          <Text style={styles.insightText}>Vous avez eu des passages très difficiles. Prenez le temps de vous recentrer après 2-3 erreurs consécutives.</Text>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                )}

                {/* No detailed data */}
                {errorStats.totalTirErrorTyped === 0 && errorStats.totalPointErrorTyped === 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                    <View style={styles.card}>
                      <NAPlaceholder message="Utilisez la notation détaillée pendant vos matchs pour obtenir une analyse approfondie de vos erreurs" />
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
              <Text style={styles.modalTitle}>Progression</Text>
              <Text style={styles.modalSubtitle}>Évolution de vos performances</Text>
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
          
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {progressionData.weeklyData.length > 0 ? (
              <>
                {/* Trend Summary Cards */}
                <View style={styles.trendCardsRow}>
                  <View style={[styles.trendCard, { borderLeftColor: theme.primary }]}>
                    <View style={styles.trendCardHeader}>
                      <MaterialIcons name="emoji-events" size={18} color={theme.primary} />
                      <MaterialIcons name={trends.winRate === 'up' ? 'trending-up' : trends.winRate === 'down' ? 'trending-down' : 'remove'} size={16} color={trends.winRate === 'up' ? theme.success : trends.winRate === 'down' ? theme.error : theme.textMuted} />
                    </View>
                    <Text style={styles.trendCardValue}>{performanceStats.winRate}%</Text>
                    <Text style={styles.trendCardLabel}>Victoires</Text>
                  </View>
                  <View style={[styles.trendCard, { borderLeftColor: theme.tirColor }]}>
                    <View style={styles.trendCardHeader}>
                      <MaterialIcons name="gps-fixed" size={18} color={theme.tirColor} />
                      <MaterialIcons name={trends.tirRate === 'up' ? 'trending-up' : trends.tirRate === 'down' ? 'trending-down' : 'remove'} size={16} color={trends.tirRate === 'up' ? theme.success : trends.tirRate === 'down' ? theme.error : theme.textMuted} />
                    </View>
                    <Text style={styles.trendCardValue}>{tirStats.successRate}%</Text>
                    <Text style={styles.trendCardLabel}>Tir</Text>
                  </View>
                  <View style={[styles.trendCard, { borderLeftColor: theme.pointColor }]}>
                    <View style={styles.trendCardHeader}>
                      <MaterialIcons name="adjust" size={18} color={theme.pointColor} />
                      <MaterialIcons name={trends.pointRate === 'up' ? 'trending-up' : trends.pointRate === 'down' ? 'trending-down' : 'remove'} size={16} color={trends.pointRate === 'up' ? theme.success : trends.pointRate === 'down' ? theme.error : theme.textMuted} />
                    </View>
                    <Text style={styles.trendCardValue}>{pointStats.successRate}%</Text>
                    <Text style={styles.trendCardLabel}>Pointage</Text>
                  </View>
                </View>

                {/* Win Rate Evolution */}
                <View style={styles.progressionSection}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.primary + '15' }]}>
                      <MaterialIcons name="emoji-events" size={20} color={theme.primary} />
                    </View>
                    <View>
                      <Text style={styles.progressionSectionTitle}>Taux de victoire</Text>
                      <Text style={styles.progressionSectionSubtitle}>{progressionData.weeklyData.reduce((sum, d) => sum + d.matches, 0)} parties</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    <Svg width={screenWidth - 64} height={160}>
                      {[0, 50, 100].map((v, i) => (
                        <G key={i}>
                          <Line x1="35" y1={140 - (v / 100) * 120} x2={screenWidth - 64} y2={140 - (v / 100) * 120} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                          <SvgText x="30" y={145 - (v / 100) * 120} fontSize="10" fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                        </G>
                      ))}
                      {progressionData.weeklyData.map((data, i) => {
                        const x = 45 + (i * ((screenWidth - 109) / Math.max(progressionData.weeklyData.length - 1, 1)));
                        const y = 140 - (data.winRate / 100) * 120;
                        const prevData = progressionData.weeklyData[i - 1];
                        const prevX = prevData ? 45 + ((i - 1) * ((screenWidth - 109) / Math.max(progressionData.weeklyData.length - 1, 1))) : x;
                        const prevY = prevData ? 140 - (prevData.winRate / 100) * 120 : y;
                        return (
                          <G key={i}>
                            {i > 0 && <Line x1={prevX} y1={prevY} x2={x} y2={y} stroke={theme.primary} strokeWidth="2.5" />}
                            <Circle cx={x} cy={y} r="5" fill={theme.primary} />
                            {data.matches > 0 && <SvgText x={x} y={y - 10} fontSize="9" fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.winRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
                  </View>
                </View>

                {/* Tir Evolution */}
                <View style={styles.progressionSection}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.tirColor + '15' }]}>
                      <MaterialIcons name="gps-fixed" size={20} color={theme.tirColor} />
                    </View>
                    <View>
                      <Text style={styles.progressionSectionTitle}>Taux de tir</Text>
                      <Text style={styles.progressionSectionSubtitle}>{progressionData.weeklyData.reduce((sum, d) => sum + d.tirTotal, 0)} tirs</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    <Svg width={screenWidth - 64} height={160}>
                      {[0, 50, 100].map((v, i) => (
                        <G key={i}>
                          <Line x1="35" y1={140 - (v / 100) * 120} x2={screenWidth - 64} y2={140 - (v / 100) * 120} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                          <SvgText x="30" y={145 - (v / 100) * 120} fontSize="10" fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                        </G>
                      ))}
                      {progressionData.weeklyData.map((data, i) => {
                        const x = 45 + (i * ((screenWidth - 109) / Math.max(progressionData.weeklyData.length - 1, 1)));
                        const y = 140 - (data.tirRate / 100) * 120;
                        const prevData = progressionData.weeklyData[i - 1];
                        const prevX = prevData ? 45 + ((i - 1) * ((screenWidth - 109) / Math.max(progressionData.weeklyData.length - 1, 1))) : x;
                        const prevY = prevData ? 140 - (prevData.tirRate / 100) * 120 : y;
                        return (
                          <G key={i}>
                            {i > 0 && <Line x1={prevX} y1={prevY} x2={x} y2={y} stroke={theme.tirColor} strokeWidth="2.5" />}
                            <Circle cx={x} cy={y} r="5" fill={theme.tirColor} />
                            {data.tirTotal > 0 && <SvgText x={x} y={y - 10} fontSize="9" fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.tirRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
                  </View>
                </View>

                {/* Point Evolution */}
                <View style={styles.progressionSection}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.pointColor + '15' }]}>
                      <MaterialIcons name="adjust" size={20} color={theme.pointColor} />
                    </View>
                    <View>
                      <Text style={styles.progressionSectionTitle}>Taux de pointage</Text>
                      <Text style={styles.progressionSectionSubtitle}>{progressionData.weeklyData.reduce((sum, d) => sum + d.pointTotal, 0)} points</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    <Svg width={screenWidth - 64} height={160}>
                      {[0, 50, 100].map((v, i) => (
                        <G key={i}>
                          <Line x1="35" y1={140 - (v / 100) * 120} x2={screenWidth - 64} y2={140 - (v / 100) * 120} stroke={theme.border} strokeWidth="1" strokeDasharray="4,4" />
                          <SvgText x="30" y={145 - (v / 100) * 120} fontSize="10" fill={theme.textMuted} textAnchor="end">{v}%</SvgText>
                        </G>
                      ))}
                      {progressionData.weeklyData.map((data, i) => {
                        const x = 45 + (i * ((screenWidth - 109) / Math.max(progressionData.weeklyData.length - 1, 1)));
                        const y = 140 - (data.pointRate / 100) * 120;
                        const prevData = progressionData.weeklyData[i - 1];
                        const prevX = prevData ? 45 + ((i - 1) * ((screenWidth - 109) / Math.max(progressionData.weeklyData.length - 1, 1))) : x;
                        const prevY = prevData ? 140 - (prevData.pointRate / 100) * 120 : y;
                        return (
                          <G key={i}>
                            {i > 0 && <Line x1={prevX} y1={prevY} x2={x} y2={y} stroke={theme.pointColor} strokeWidth="2.5" />}
                            <Circle cx={x} cy={y} r="5" fill={theme.pointColor} />
                            {data.pointTotal > 0 && <SvgText x={x} y={y - 10} fontSize="9" fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.pointRate}%</SvgText>}
                          </G>
                        );
                      })}
                    </Svg>
                  </View>
                </View>

                {/* Carreaux Bar Chart */}
                <View style={styles.progressionSection}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                      <MaterialIcons name="stars" size={20} color={theme.carreauColor} />
                    </View>
                    <View>
                      <Text style={styles.progressionSectionTitle}>Carreaux</Text>
                      <Text style={styles.progressionSectionSubtitle}>{progressionData.weeklyData.reduce((sum, d) => sum + d.carreaux, 0)} au total</Text>
                    </View>
                  </View>
                  <View style={styles.chartContainer}>
                    <Svg width={screenWidth - 64} height={140}>
                      {progressionData.weeklyData.map((data, i) => {
                        const barWidth = Math.max((screenWidth - 104) / progressionData.weeklyData.length - 6, 8);
                        const x = 40 + (i * ((screenWidth - 80) / progressionData.weeklyData.length));
                        const maxCarreaux = Math.max(...progressionData.weeklyData.map(d => d.carreaux), 1);
                        const barHeight = Math.max((data.carreaux / maxCarreaux) * 90, data.carreaux > 0 ? 4 : 0);
                        return (
                          <G key={i}>
                            <Rect x={x} y={110 - barHeight} width={barWidth} height={barHeight} fill={theme.carreauColor} rx="3" />
                            {data.carreaux > 0 && <SvgText x={x + barWidth / 2} y={105 - barHeight} fontSize="10" fill={theme.textPrimary} textAnchor="middle" fontWeight="600">{data.carreaux}</SvgText>}
                            <SvgText x={x + barWidth / 2} y={130} fontSize="8" fill={theme.textMuted} textAnchor="middle">{data.week}</SvgText>
                          </G>
                        );
                      })}
                    </Svg>
                  </View>
                </View>

                {/* Summary Table */}
                <View style={styles.progressionSection}>
                  <View style={styles.progressionSectionHeader}>
                    <View style={[styles.progressionSectionIcon, { backgroundColor: theme.textSecondary + '15' }]}>
                      <MaterialIcons name="table-chart" size={20} color={theme.textSecondary} />
                    </View>
                    <Text style={styles.progressionSectionTitle}>Résumé</Text>
                  </View>
                  <View style={styles.summaryTable}>
                    <View style={styles.summaryHeader}>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1.2 }]}>Sem.</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>Parties</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>Vict.</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>Tir</Text>
                      <Text style={[styles.summaryCell, styles.summaryCellHeader, { flex: 1 }]}>Point</Text>
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
                <Text style={styles.noProgressionTitle}>Pas assez de données</Text>
                <Text style={styles.noProgressionText}>Jouez plus de matchs pour voir votre progression</Text>
              </View>
            )}
          </ScrollView>
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
  filterBar: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
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
  consecutiveErrorsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  consecutiveErrorItem: { alignItems: 'center' },
  consecutiveErrorValue: { fontSize: 36, fontWeight: '700', color: theme.error },
  consecutiveErrorLabel: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 4 },
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
  trendCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 12, borderLeftWidth: 3, ...theme.shadows.card },
  trendCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  trendCardValue: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  trendCardLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  progressionSection: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, ...theme.shadows.card },
  progressionSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  progressionSectionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  progressionSectionTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  progressionSectionSubtitle: { fontSize: 11, color: theme.textMuted },
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
});
