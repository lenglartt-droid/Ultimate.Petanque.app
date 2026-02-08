import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import Svg, { Circle, Line, Path, G, Text as SvgText, Rect } from 'react-native-svg';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

// ============================================
// TYPES & CONSTANTS
// ============================================
type TimeFilter = 'week' | 'month' | 'year' | 'all';
type StatsCategory = 'performance' | 'tir' | 'point';

const TIME_FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'week', label: '7j' },
  { id: 'month', label: '30j' },
  { id: 'year', label: '1an' },
  { id: 'all', label: 'Tout' },
];

const CATEGORY_TABS: { id: StatsCategory; label: string; icon: string; color: string }[] = [
  { id: 'performance', label: 'Performance', icon: 'emoji-events', color: theme.primary },
  { id: 'tir', label: 'Tir', icon: 'gps-fixed', color: theme.tirColor },
  { id: 'point', label: 'Pointage', icon: 'adjust', color: theme.pointColor },
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

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = theme.primary,
  trend,
  small = false,
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon?: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
  small?: boolean;
}) {
  return (
    <View style={[styles.statCard, small && styles.statCardSmall]}>
      {icon && (
        <View style={[styles.statCardIcon, { backgroundColor: color + '15' }]}>
          <MaterialIcons name={icon as any} size={small ? 16 : 20} color={color} />
        </View>
      )}
      <Text style={[styles.statCardTitle, small && styles.statCardTitleSmall]}>{title}</Text>
      <View style={styles.statCardValueRow}>
        <Text style={[styles.statCardValue, small && styles.statCardValueSmall, { color }]}>{value}</Text>
        {trend && (
          <MaterialIcons 
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'} 
            size={14} 
            color={trend === 'up' ? theme.success : trend === 'down' ? theme.error : theme.textMuted} 
          />
        )}
      </View>
      {subtitle && <Text style={styles.statCardSubtitle}>{subtitle}</Text>}
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

// Breakdown Bar (for showing distribution)
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
    
    // Mène stats
    const meneWinRate = totalMenes > 0 ? Math.round((menesWon / totalMenes) * 100) : 0;
    const avgMenePointsFor = totalMenes > 0 ? (totalMenePointsFor / totalMenes).toFixed(1) : '0';
    const avgMenePointsAgainst = totalMenes > 0 ? (totalMenePointsAgainst / totalMenes).toFixed(1) : '0';
    
    // Streaks calculation
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    
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
        if (!seriesMap[m.seriesInfo.seriesId]) {
          seriesMap[m.seriesInfo.seriesId] = { wins: 0 };
        }
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

    return {
      total,
      trainingCount: trainingMatches.length,
      tournamentCount: tournamentMatches.length,
      wins,
      losses,
      winRate,
      trainingWinRate: trainingMatches.length > 0 ? Math.round((trainingMatches.filter(m => m.winner === 'A').length / trainingMatches.length) * 100) : 0,
      tournamentWinRate: tournamentMatches.length > 0 ? Math.round((tournamentMatches.filter(m => m.winner === 'A').length / tournamentMatches.length) * 100) : 0,
      byFormat,
      avgScoreFor,
      avgScoreAgainst,
      pointDiff,
      avgPointDiff,
      totalMenes,
      menesWon,
      meneWinRate,
      avgMenePointsFor,
      avgMenePointsAgainst,
      currentStreak,
      maxWinStreak,
      maxLossStreak,
      seriesPlayed: Object.keys(seriesMap).length,
      seriesWon,
      seriesLost: seriesComplete.length - seriesWon,
      fannyWins,
      fannyLosses,
    };
  }, [filteredMatches]);

  // ============================================
  // TIR (SHOOTING) STATS CALCULATION
  // ============================================
  const tirStats = useMemo(() => {
    let totalTirs = 0, tirsSuccess = 0, carreaux = 0;
    
    // Detailed stats from advanced notation
    const shotTypeStats: Record<string, { total: number; success: number }> = {
      au_fer: { total: 0, success: 0 },
      au_plomb: { total: 0, success: 0 },
      en_rafle: { total: 0, success: 0 },
      court: { total: 0, success: 0 },
      long: { total: 0, success: 0 },
      en_angle: { total: 0, success: 0 },
      sur_boule: { total: 0, success: 0 },
      sur_but: { total: 0, success: 0 },
      autre: { total: 0, success: 0 },
    };
    
    const shotQualityStats: Record<string, number> = {
      gain_point: 0,
      sans_effet: 0,
      negatif: 0,
      decisif: 0,
      sous_pression: 0,
      equipe_menee: 0,
      equipe_mene: 0,
    };
    
    // From matches
    filteredMatches.forEach(match => {
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          totalTirs += pa.actions.tirs;
          tirsSuccess += pa.actions.tirsSuccess;
          carreaux += pa.actions.carreaux;
          
          // Process detailed shot records if available
          if (pa.detailedShots) {
            pa.detailedShots.filter((s: any) => s.actionType === 'tir').forEach((shot: any) => {
              if (shot.shotType && shotTypeStats[shot.shotType]) {
                shotTypeStats[shot.shotType].total++;
                if (shot.success) shotTypeStats[shot.shotType].success++;
              }
              if (shot.shotQuality && shotQualityStats[shot.shotQuality] !== undefined) {
                shotQualityStats[shot.shotQuality]++;
              }
            });
          }
        });
      }
    });
    
    // From challenges (10_tirs and 10_tirs_sautee)
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
    
    // Tirs per match/mène
    const tirsPerMatch = filteredMatches.length > 0 ? (totalTirs / filteredMatches.length).toFixed(1) : '0';
    const tirsPerMene = performanceStats.totalMenes > 0 ? (totalTirs / performanceStats.totalMenes).toFixed(1) : '0';
    
    // Demi-tirs estimation (touches without carreau)
    const demiTirs = combinedSuccess - combinedCarreaux;
    const demiTirRate = combinedTirs > 0 ? Math.round((demiTirs / combinedTirs) * 100) : 0;
    
    // Calculate detailed stats only if we have data
    const hasDetailedData = Object.values(shotTypeStats).some(s => s.total > 0);
    const totalDetailedTirs = Object.values(shotTypeStats).reduce((sum, s) => sum + s.total, 0);

    return {
      totalTirs: combinedTirs,
      tirsSuccess: combinedSuccess,
      carreaux: combinedCarreaux,
      successRate,
      carreauRate,
      demiTirRate,
      missedRate,
      tirsPerMatch,
      tirsPerMene,
      matchTirs: totalTirs,
      challengeTirs,
      // Quality stats (from detailed tracking)
      hasDetailedData,
      totalDetailedTirs,
      tirGainPoint: hasDetailedData ? shotQualityStats.gain_point : null,
      tirSansEffet: hasDetailedData ? shotQualityStats.sans_effet : null,
      tirNegatif: hasDetailedData ? shotQualityStats.negatif : null,
      tirsDecisifs: hasDetailedData ? shotQualityStats.decisif : null,
      tirsSousPression: hasDetailedData ? shotQualityStats.sous_pression : null,
      tirsQuandMene: hasDetailedData ? shotQualityStats.equipe_menee : null,
      tirsQuandMenant: hasDetailedData ? shotQualityStats.equipe_mene : null,
      // Type stats (from detailed tracking)
      tirAuFer: hasDetailedData ? shotTypeStats.au_fer : null,
      tirAuPlomb: hasDetailedData ? shotTypeStats.au_plomb : null,
      tirEnRafle: hasDetailedData ? shotTypeStats.en_rafle : null,
      tirCourt: hasDetailedData ? shotTypeStats.court : null,
      tirLong: hasDetailedData ? shotTypeStats.long : null,
      tirEnAngle: hasDetailedData ? shotTypeStats.en_angle : null,
      tirSurBoule: hasDetailedData ? shotTypeStats.sur_boule : null,
      tirSurBut: hasDetailedData ? shotTypeStats.sur_but : null,
    };
  }, [filteredMatches, filteredChallenges, performanceStats.totalMenes]);

  // ============================================
  // POINT (POINTING) STATS CALCULATION
  // ============================================
  const pointStats = useMemo(() => {
    let totalPoints = 0, pointsSuccess = 0;
    
    // Detailed stats from advanced notation
    const pointTypeStats: Record<string, { total: number; success: number }> = {
      roule: { total: 0, success: 0 },
      plombe: { total: 0, success: 0 },
      demi_portee: { total: 0, success: 0 },
      portee_haute: { total: 0, success: 0 },
      au_but: { total: 0, success: 0 },
      securite: { total: 0, success: 0 },
      autre: { total: 0, success: 0 },
    };
    
    const pointQualityStats: Record<string, number> = {
      excellent: 0,   // < 10cm
      bon: 0,         // < 30cm
      moyen: 0,       // < 50cm
      rate: 0,        // missed
      gagnant: 0,
      placement: 0,
      moins_50cm: 0,
      moins_30cm: 0,
      moins_10cm: 0,
      rate_court: 0,
      rate_long: 0,
      trop_droite: 0,
      trop_gauche: 0,
    };
    
    filteredMatches.forEach(match => {
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          totalPoints += pa.actions.points;
          pointsSuccess += pa.actions.pointsSuccess;
          
          // Process detailed point records if available
          if (pa.detailedShots) {
            pa.detailedShots.filter((s: any) => s.actionType === 'point').forEach((shot: any) => {
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
    
    // Calculate detailed stats only if we have data
    const hasDetailedData = Object.values(pointTypeStats).some(s => s.total > 0);
    const totalDetailedPoints = Object.values(pointTypeStats).reduce((sum, s) => sum + s.total, 0);

    return {
      totalPoints,
      pointsSuccess,
      successRate,
      pointsPerMene,
      // Detailed data available flag
      hasDetailedData,
      totalDetailedPoints,
      // Quality stats (from detailed tracking)
      distanceMoyenne: null, // Would need actual measurements
      ecartMoyen: null,
      pointsMoins50cm: hasDetailedData ? (pointQualityStats.moins_50cm + pointQualityStats.moyen) : null,
      pointsMoins30cm: hasDetailedData ? (pointQualityStats.moins_30cm + pointQualityStats.bon) : null,
      pointsMoins10cm: hasDetailedData ? (pointQualityStats.moins_10cm + pointQualityStats.excellent) : null,
      pointsRatesCourts: hasDetailedData ? pointQualityStats.rate_court : null,
      pointsRatesLongs: hasDetailedData ? pointQualityStats.rate_long : null,
      pointsTropDroite: hasDetailedData ? pointQualityStats.trop_droite : null,
      pointsTropGauche: hasDetailedData ? pointQualityStats.trop_gauche : null,
      // Type stats (from detailed tracking)
      pointRoule: hasDetailedData ? pointTypeStats.roule : null,
      pointPlombe: hasDetailedData ? pointTypeStats.plombe : null,
      pointDemiPortee: hasDetailedData ? pointTypeStats.demi_portee : null,
      pointPorteeHaute: hasDetailedData ? pointTypeStats.portee_haute : null,
      pointAuBut: hasDetailedData ? pointTypeStats.au_but : null,
      pointSecurite: hasDetailedData ? pointTypeStats.securite : null,
      pointsGagnants: hasDetailedData ? pointQualityStats.gagnant : null,
      pointsPlacement: hasDetailedData ? pointQualityStats.placement : null,
    };
  }, [filteredMatches, performanceStats.totalMenes]);

  const hasData = performanceStats.total > 0;

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
          <Pressable 
            style={styles.historyButton}
            onPress={() => router.push('/history')}
          >
            <MaterialIcons name="history" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Time Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
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
              <MaterialIcons 
                name={tab.icon as any} 
                size={20} 
                color={category === tab.id ? tab.color : theme.textMuted} 
              />
              <Text style={[
                styles.categoryTabText, 
                category === tab.id && [styles.categoryTabTextActive, { color: tab.color }]
              ]}>
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
            <Text style={styles.emptyText}>
              Jouez des matchs pour voir vos statistiques évoluer
            </Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/match/new')}>
              <MaterialIcons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>Nouveau match</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ========================================
                PERFORMANCE GÉNÉRALE
            ======================================== */}
            {category === 'performance' && (
              <>
                {/* Hero Stats */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
                  <View style={styles.heroContent}>
                    <ProgressRing 
                      value={performanceStats.winRate} 
                      size={110} 
                      strokeWidth={9} 
                      color={theme.primary}
                      label="Victoires"
                    />
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

                {/* Parties jouées */}
                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title="Parties jouées" icon="sports" color={theme.primary} />
                  <View style={styles.card}>
                    <View style={styles.statsGrid3}>
                      <View style={styles.gridItem}>
                        <Text style={styles.gridValue}>{performanceStats.total}</Text>
                        <Text style={styles.gridLabel}>Total</Text>
                      </View>
                      <View style={styles.gridItem}>
                        <Text style={styles.gridValue}>{performanceStats.trainingCount}</Text>
                        <Text style={styles.gridLabel}>Entraînement</Text>
                      </View>
                      <View style={styles.gridItem}>
                        <Text style={styles.gridValue}>{performanceStats.tournamentCount}</Text>
                        <Text style={styles.gridLabel}>Tournoi</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                {/* Taux de victoire par mode */}
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

                {/* Taux de victoire par format */}
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
                            <ProgressBar value={rate} color={
                              format === 'Tête-à-tête' ? theme.tirColor : 
                              format === 'Doublette' ? theme.primary : theme.accent
                            } />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>

                {/* Score & Points */}
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
                        <View style={[
                          styles.scoreDiffBadge,
                          { backgroundColor: performanceStats.pointDiff >= 0 ? theme.success + '15' : theme.error + '15' }
                        ]}>
                          <Text style={[
                            styles.scoreDiffText,
                            { color: performanceStats.pointDiff >= 0 ? theme.success : theme.error }
                          ]}>
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
                    <View style={styles.totalDiff}>
                      <Text style={styles.totalDiffLabel}>Différentiel total:</Text>
                      <Text style={[
                        styles.totalDiffValue,
                        { color: performanceStats.pointDiff >= 0 ? theme.success : theme.error }
                      ]}>
                        {performanceStats.pointDiff > 0 ? '+' : ''}{performanceStats.pointDiff} pts
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Statistiques de mènes */}
                {performanceStats.totalMenes > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                    <SectionHeader title="Statistiques de mènes" icon="timeline" color={theme.pointColor} />
                    <View style={styles.card}>
                      <View style={styles.meneStats}>
                        <View style={styles.meneStatMain}>
                          <ProgressRing 
                            value={performanceStats.meneWinRate} 
                            size={80} 
                            strokeWidth={7} 
                            color={theme.pointColor}
                            label="gagnées"
                          />
                        </View>
                        <View style={styles.meneStatDetails}>
                          <StatRow 
                            label="Mènes jouées" 
                            value={performanceStats.totalMenes} 
                            icon="format-list-numbered" 
                            color={theme.textSecondary}
                          />
                          <StatRow 
                            label="Points marqués/mène" 
                            value={performanceStats.avgMenePointsFor} 
                            icon="add" 
                            color={theme.success}
                          />
                          <StatRow 
                            label="Points encaissés/mène" 
                            value={performanceStats.avgMenePointsAgainst} 
                            icon="remove" 
                            color={theme.error}
                          />
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {/* Séries */}
                <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
                  <SectionHeader title="Séries de victoires / défaites" icon="show-chart" color={theme.primary} />
                  <View style={styles.card}>
                    <View style={styles.streaksGrid}>
                      <View style={styles.streakItem}>
                        <Text style={styles.streakLabel}>Série actuelle</Text>
                        <Text style={[
                          styles.streakValue,
                          { color: performanceStats.currentStreak >= 0 ? theme.success : theme.error }
                        ]}>
                          {performanceStats.currentStreak > 0 ? '+' : ''}{performanceStats.currentStreak}
                        </Text>
                        <Text style={styles.streakType}>
                          {performanceStats.currentStreak > 0 ? 'Victoires' : performanceStats.currentStreak < 0 ? 'Défaites' : '-'}
                        </Text>
                      </View>
                      <View style={styles.streakItem}>
                        <Text style={styles.streakLabel}>Meilleure série V</Text>
                        <Text style={[styles.streakValue, { color: theme.success }]}>
                          {performanceStats.maxWinStreak}
                        </Text>
                        <Text style={styles.streakType}>Victoires</Text>
                      </View>
                      <View style={styles.streakItem}>
                        <Text style={styles.streakLabel}>Pire série D</Text>
                        <Text style={[styles.streakValue, { color: theme.error }]}>
                          {performanceStats.maxLossStreak}
                        </Text>
                        <Text style={styles.streakType}>Défaites</Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>

                {/* Séries Best of 3 */}
                {performanceStats.seriesPlayed > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
                    <SectionHeader title="Séries (Best of 3)" icon="military-tech" color={theme.accent} />
                    <View style={styles.card}>
                      <View style={styles.seriesStats}>
                        <View style={styles.seriesMain}>
                          <Text style={styles.seriesPlayed}>{performanceStats.seriesPlayed}</Text>
                          <Text style={styles.seriesPlayedLabel}>séries jouées</Text>
                        </View>
                        <View style={styles.seriesResults}>
                          <View style={styles.seriesResult}>
                            <Text style={[styles.seriesResultValue, { color: theme.success }]}>{performanceStats.seriesWon}</Text>
                            <Text style={styles.seriesResultLabel}>Gagnées</Text>
                          </View>
                          <View style={styles.seriesResult}>
                            <Text style={[styles.seriesResultValue, { color: theme.error }]}>{performanceStats.seriesLost}</Text>
                            <Text style={styles.seriesResultLabel}>Perdues</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {/* Fanny */}
                {(performanceStats.fannyWins > 0 || performanceStats.fannyLosses > 0) && (
                  <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
                    <SectionHeader title="Fanny (13-0)" icon="celebration" color={theme.carreauColor} />
                    <View style={styles.card}>
                      <View style={styles.fannyStats}>
                        <View style={styles.fannyItem}>
                          <Svg width={32} height={32} viewBox="0 0 24 24">
                            <Circle cx="9" cy="14" r="5" fill={theme.success} opacity={0.9} />
                            <Circle cx="15" cy="14" r="5" fill={theme.success} opacity={0.9} />
                          </Svg>
                          <Text style={[styles.fannyValue, { color: theme.success }]}>{performanceStats.fannyWins}</Text>
                          <Text style={styles.fannyLabel}>Infligées</Text>
                        </View>
                        <View style={styles.fannyItem}>
                          <Svg width={32} height={32} viewBox="0 0 24 24">
                            <Circle cx="9" cy="14" r="5" fill={theme.error} opacity={0.9} />
                            <Circle cx="15" cy="14" r="5" fill={theme.error} opacity={0.9} />
                          </Svg>
                          <Text style={[styles.fannyValue, { color: theme.error }]}>{performanceStats.fannyLosses}</Text>
                          <Text style={styles.fannyLabel}>Subies</Text>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                )}
              </>
            )}

            {/* ========================================
                STATISTIQUES DE TIR
            ======================================== */}
            {category === 'tir' && (
              <>
                {/* Hero Tir */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
                  <View style={styles.heroContent}>
                    <ProgressRing 
                      value={tirStats.successRate} 
                      size={110} 
                      strokeWidth={9} 
                      color={theme.tirColor}
                      label="Réussite"
                    />
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

                {/* Volume & Réussite */}
                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title="Volume & Réussite" icon="gps-fixed" color={theme.tirColor} />
                  <View style={styles.card}>
                    <StatRow label="Tirs tentés" value={tirStats.totalTirs} icon="radio-button-unchecked" color={theme.textSecondary} />
                    <StatRow label="Tirs réussis" value={tirStats.tirsSuccess} icon="check-circle" color={theme.success} />
                    <StatRow label="% de réussite global" value={`${tirStats.successRate}%`} icon="percent" color={theme.tirColor} />
                    <StatRow label="% de carreaux" value={`${tirStats.carreauRate}%`} icon="stars" color={theme.carreauColor} />
                    <StatRow label="% de demi-tirs" value={`${tirStats.demiTirRate}%`} icon="radio-button-checked" color={theme.pointColor} />
                    <StatRow label="% de tirs manqués" value={`${tirStats.missedRate}%`} icon="cancel" color={theme.error} />
                  </View>
                </Animated.View>

                {/* Répartition des tirs */}
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

                {/* Tirs par partie/mène */}
                <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                  <SectionHeader title="Fréquence" icon="speed" color={theme.accent} />
                  <View style={styles.card}>
                    <StatRow label="Tirs par partie" value={tirStats.tirsPerMatch} icon="sports" color={theme.primary} />
                    <StatRow label="Tirs par mène" value={tirStats.tirsPerMene} icon="timeline" color={theme.accent} />
                  </View>
                </Animated.View>

                {/* Source des tirs */}
                {tirStats.challengeTirs > 0 && (
                  <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
                    <SectionHeader title="Source des tirs" icon="source" color={theme.textSecondary} />
                    <View style={styles.card}>
                      <StatRow label="Tirs en match" value={tirStats.matchTirs} icon="sports" color={theme.primary} />
                      <StatRow label="Tirs en défi" value={tirStats.challengeTirs} icon="emoji-events" color={theme.carreauColor} />
                    </View>
                  </Animated.View>
                )}

                {/* Qualité du tir - Données disponibles si enregistrées */}
                <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
                  <SectionHeader title="Qualité du tir" subtitle={tirStats.hasDetailedData ? `${tirStats.totalDetailedTirs} tirs analysés` : 'Statistiques avancées'} icon="insights" color={theme.primary} />
                  <View style={styles.card}>
                    <StatRow 
                      label="Tir avec gain de point" 
                      value={tirStats.tirGainPoint !== null ? tirStats.tirGainPoint : '-'} 
                      isNA={tirStats.tirGainPoint === null} 
                      icon="trending-up" 
                      color={theme.success} 
                    />
                    <StatRow 
                      label="Tir sans effet" 
                      value={tirStats.tirSansEffet !== null ? tirStats.tirSansEffet : '-'} 
                      isNA={tirStats.tirSansEffet === null} 
                      icon="remove" 
                      color={theme.textMuted} 
                    />
                    <StatRow 
                      label="Tir négatif" 
                      value={tirStats.tirNegatif !== null ? tirStats.tirNegatif : '-'} 
                      isNA={tirStats.tirNegatif === null} 
                      icon="trending-down" 
                      color={theme.error} 
                    />
                    <StatRow 
                      label="Tirs décisifs (fin de mène)" 
                      value={tirStats.tirsDecisifs !== null ? tirStats.tirsDecisifs : '-'} 
                      isNA={tirStats.tirsDecisifs === null} 
                      icon="flag" 
                      color={theme.primary} 
                    />
                    <StatRow 
                      label="Tirs sous pression" 
                      value={tirStats.tirsSousPression !== null ? tirStats.tirsSousPression : '-'} 
                      isNA={tirStats.tirsSousPression === null} 
                      icon="psychology" 
                      color={theme.accent} 
                    />
                    <StatRow 
                      label="Tirs quand équipe menée" 
                      value={tirStats.tirsQuandMene !== null ? tirStats.tirsQuandMene : '-'} 
                      isNA={tirStats.tirsQuandMene === null} 
                      icon="arrow-downward" 
                      color={theme.error} 
                    />
                    <StatRow 
                      label="Tirs quand équipe mène" 
                      value={tirStats.tirsQuandMenant !== null ? tirStats.tirsQuandMenant : '-'} 
                      isNA={tirStats.tirsQuandMenant === null} 
                      icon="arrow-upward" 
                      color={theme.success} 
                    />
                    {!tirStats.hasDetailedData && (
                      <NAPlaceholder message="Utilisez la notation détaillée pendant les matchs (appui long sur TIR)" />
                    )}
                  </View>
                </Animated.View>

                {/* Types de tir - Données disponibles si enregistrées */}
                <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
                  <SectionHeader title="Types de tir" subtitle={tirStats.hasDetailedData ? 'Analyse technique' : 'Analyse technique'} icon="category" color={theme.tirColor} />
                  <View style={styles.card}>
                    <StatRow 
                      label="Tir au fer" 
                      value={tirStats.tirAuFer !== null ? `${tirStats.tirAuFer.success}/${tirStats.tirAuFer.total}` : '-'} 
                      subValue={tirStats.tirAuFer !== null && tirStats.tirAuFer.total > 0 ? `${Math.round((tirStats.tirAuFer.success / tirStats.tirAuFer.total) * 100)}% réussite` : ''}
                      isNA={tirStats.tirAuFer === null} 
                      icon="gps-fixed" 
                      color={theme.tirColor} 
                    />
                    <StatRow 
                      label="Tir au plomb" 
                      value={tirStats.tirAuPlomb !== null ? `${tirStats.tirAuPlomb.success}/${tirStats.tirAuPlomb.total}` : '-'} 
                      subValue={tirStats.tirAuPlomb !== null && tirStats.tirAuPlomb.total > 0 ? `${Math.round((tirStats.tirAuPlomb.success / tirStats.tirAuPlomb.total) * 100)}% réussite` : ''}
                      isNA={tirStats.tirAuPlomb === null} 
                      icon="flight-takeoff" 
                      color={theme.pointColor} 
                    />
                    <StatRow 
                      label="Tir en rafle" 
                      value={tirStats.tirEnRafle !== null ? `${tirStats.tirEnRafle.success}/${tirStats.tirEnRafle.total}` : '-'} 
                      subValue={tirStats.tirEnRafle !== null && tirStats.tirEnRafle.total > 0 ? `${Math.round((tirStats.tirEnRafle.success / tirStats.tirEnRafle.total) * 100)}% réussite` : ''}
                      isNA={tirStats.tirEnRafle === null} 
                      icon="swap-horiz" 
                      color={theme.accent} 
                    />
                    <StatRow 
                      label="Tir court" 
                      value={tirStats.tirCourt !== null ? `${tirStats.tirCourt.success}/${tirStats.tirCourt.total}` : '-'} 
                      isNA={tirStats.tirCourt === null} 
                      icon="vertical-align-bottom" 
                      color={theme.warning} 
                    />
                    <StatRow 
                      label="Tir long" 
                      value={tirStats.tirLong !== null ? `${tirStats.tirLong.success}/${tirStats.tirLong.total}` : '-'} 
                      isNA={tirStats.tirLong === null} 
                      icon="vertical-align-top" 
                      color={theme.accent} 
                    />
                    <StatRow 
                      label="Tir en angle" 
                      value={tirStats.tirEnAngle !== null ? `${tirStats.tirEnAngle.success}/${tirStats.tirEnAngle.total}` : '-'} 
                      isNA={tirStats.tirEnAngle === null} 
                      icon="turn-right" 
                      color={theme.primary} 
                    />
                    <StatRow 
                      label="Tir sur boule adverse" 
                      value={tirStats.tirSurBoule !== null ? `${tirStats.tirSurBoule.success}/${tirStats.tirSurBoule.total}` : '-'} 
                      isNA={tirStats.tirSurBoule === null} 
                      icon="sports-baseball" 
                      color={theme.error} 
                    />
                    <StatRow 
                      label="Tir sur but" 
                      value={tirStats.tirSurBut !== null ? `${tirStats.tirSurBut.success}/${tirStats.tirSurBut.total}` : '-'} 
                      isNA={tirStats.tirSurBut === null} 
                      icon="adjust" 
                      color={theme.carreauColor} 
                    />
                    {!tirStats.hasDetailedData && (
                      <NAPlaceholder message="Spécifiez le type de tir lors de l'enregistrement (appui long)" />
                    )}
                  </View>
                </Animated.View>
              </>
            )}

            {/* ========================================
                STATISTIQUES DE POINTAGE
            ======================================== */}
            {category === 'point' && (
              <>
                {/* Hero Point */}
                <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
                  <View style={styles.heroContent}>
                    <ProgressRing 
                      value={pointStats.successRate} 
                      size={110} 
                      strokeWidth={9} 
                      color={theme.pointColor}
                      label="Réussite"
                    />
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

                {/* Réussite */}
                <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
                  <SectionHeader title="Réussite" icon="adjust" color={theme.pointColor} />
                  <View style={styles.card}>
                    <StatRow label="Points tentés" value={pointStats.totalPoints} icon="radio-button-unchecked" color={theme.textSecondary} />
                    <StatRow label="Points réussis" value={pointStats.pointsSuccess} icon="check-circle" color={theme.success} />
                    <StatRow label="% de points réussis" value={`${pointStats.successRate}%`} icon="percent" color={theme.pointColor} />
                    <StatRow label="Points par mène" value={pointStats.pointsPerMene} icon="timeline" color={theme.accent} />
                  </View>
                </Animated.View>

                {/* Types de points - Données disponibles si enregistrées */}
                <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                  <SectionHeader title="Types de points" subtitle={pointStats.hasDetailedData ? `${pointStats.totalDetailedPoints} points analysés` : 'Analyse technique'} icon="category" color={theme.primary} />
                  <View style={styles.card}>
                    <StatRow 
                      label="Points gagnants (meilleure boule)" 
                      value={pointStats.pointsGagnants !== null ? pointStats.pointsGagnants : '-'} 
                      isNA={pointStats.pointsGagnants === null} 
                      icon="emoji-events" 
                      color={theme.carreauColor} 
                    />
                    <StatRow 
                      label="Points de placement" 
                      value={pointStats.pointsPlacement !== null ? pointStats.pointsPlacement : '-'} 
                      isNA={pointStats.pointsPlacement === null} 
                      icon="shield" 
                      color={theme.accent} 
                    />
                    <View style={styles.divider} />
                    <StatRow 
                      label="Point roulé" 
                      value={pointStats.pointRoule !== null ? `${pointStats.pointRoule.success}/${pointStats.pointRoule.total}` : '-'} 
                      subValue={pointStats.pointRoule !== null && pointStats.pointRoule.total > 0 ? `${Math.round((pointStats.pointRoule.success / pointStats.pointRoule.total) * 100)}% réussite` : ''}
                      isNA={pointStats.pointRoule === null} 
                      icon="sports-baseball" 
                      color={theme.pointColor} 
                    />
                    <StatRow 
                      label="Point plombé" 
                      value={pointStats.pointPlombe !== null ? `${pointStats.pointPlombe.success}/${pointStats.pointPlombe.total}` : '-'} 
                      subValue={pointStats.pointPlombe !== null && pointStats.pointPlombe.total > 0 ? `${Math.round((pointStats.pointPlombe.success / pointStats.pointPlombe.total) * 100)}% réussite` : ''}
                      isNA={pointStats.pointPlombe === null} 
                      icon="flight-land" 
                      color={theme.tirColor} 
                    />
                    <StatRow 
                      label="Point demi-portée" 
                      value={pointStats.pointDemiPortee !== null ? `${pointStats.pointDemiPortee.success}/${pointStats.pointDemiPortee.total}` : '-'} 
                      isNA={pointStats.pointDemiPortee === null} 
                      icon="height" 
                      color={theme.primary} 
                    />
                    <StatRow 
                      label="Point portée haute" 
                      value={pointStats.pointPorteeHaute !== null ? `${pointStats.pointPorteeHaute.success}/${pointStats.pointPorteeHaute.total}` : '-'} 
                      isNA={pointStats.pointPorteeHaute === null} 
                      icon="flight" 
                      color={theme.accent} 
                    />
                    <StatRow 
                      label="Point au but" 
                      value={pointStats.pointAuBut !== null ? `${pointStats.pointAuBut.success}/${pointStats.pointAuBut.total}` : '-'} 
                      isNA={pointStats.pointAuBut === null} 
                      icon="adjust" 
                      color={theme.carreauColor} 
                    />
                    <StatRow 
                      label="Point de sécurité" 
                      value={pointStats.pointSecurite !== null ? `${pointStats.pointSecurite.success}/${pointStats.pointSecurite.total}` : '-'} 
                      isNA={pointStats.pointSecurite === null} 
                      icon="security" 
                      color={theme.success} 
                    />
                    {!pointStats.hasDetailedData && (
                      <NAPlaceholder message="Spécifiez le type de point lors de l'enregistrement (appui long sur POINT)" />
                    )}
                  </View>
                </Animated.View>

                {/* Qualité du point - Données disponibles si enregistrées */}
                <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
                  <SectionHeader title="Qualité du point" subtitle="Précision" icon="straighten" color={theme.success} />
                  <View style={styles.card}>
                    <StatRow label="Distance moyenne du but" value="-" isNA icon="straighten" color={theme.primary} />
                    <StatRow label="Écart moyen boule/but" value="-" isNA icon="swap-horiz" color={theme.accent} />
                    <View style={styles.divider} />
                    <StatRow 
                      label="Points à moins de 50 cm" 
                      value={pointStats.pointsMoins50cm !== null ? pointStats.pointsMoins50cm : '-'} 
                      isNA={pointStats.pointsMoins50cm === null} 
                      icon="looks-one" 
                      color={theme.success} 
                    />
                    <StatRow 
                      label="Points à moins de 30 cm" 
                      value={pointStats.pointsMoins30cm !== null ? pointStats.pointsMoins30cm : '-'} 
                      isNA={pointStats.pointsMoins30cm === null} 
                      icon="looks-two" 
                      color={theme.pointColor} 
                    />
                    <StatRow 
                      label="Points à moins de 10 cm" 
                      value={pointStats.pointsMoins10cm !== null ? pointStats.pointsMoins10cm : '-'} 
                      isNA={pointStats.pointsMoins10cm === null} 
                      icon="looks-3" 
                      color={theme.carreauColor} 
                    />
                    {!pointStats.hasDetailedData && (
                      <NAPlaceholder message="Utilisez la notation détaillée pour un suivi précis (appui long)" />
                    )}
                  </View>
                </Animated.View>

                {/* Erreurs de pointage - Données disponibles si enregistrées */}
                <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
                  <SectionHeader title="Analyse des erreurs" subtitle="Axes d'amélioration" icon="error-outline" color={theme.error} />
                  <View style={styles.card}>
                    <StatRow 
                      label="Points ratés courts" 
                      value={pointStats.pointsRatesCourts !== null ? pointStats.pointsRatesCourts : '-'} 
                      isNA={pointStats.pointsRatesCourts === null} 
                      icon="vertical-align-bottom" 
                      color={theme.error} 
                    />
                    <StatRow 
                      label="Points ratés longs" 
                      value={pointStats.pointsRatesLongs !== null ? pointStats.pointsRatesLongs : '-'} 
                      isNA={pointStats.pointsRatesLongs === null} 
                      icon="vertical-align-top" 
                      color={theme.error} 
                    />
                    <StatRow 
                      label="Points trop à droite" 
                      value={pointStats.pointsTropDroite !== null ? pointStats.pointsTropDroite : '-'} 
                      isNA={pointStats.pointsTropDroite === null} 
                      icon="chevron-right" 
                      color={theme.warning} 
                    />
                    <StatRow 
                      label="Points trop à gauche" 
                      value={pointStats.pointsTropGauche !== null ? pointStats.pointsTropGauche : '-'} 
                      isNA={pointStats.pointsTropGauche === null} 
                      icon="chevron-left" 
                      color={theme.warning} 
                    />
                    {!pointStats.hasDetailedData && (
                      <NAPlaceholder message="Analysez vos erreurs avec la notation détaillée pour progresser" />
                    )}
                  </View>
                </Animated.View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  
  // Header
  header: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 12, marginBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: theme.textPrimary },
  headerSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  historyButton: { padding: 8, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md },
  
  // Filter Bar
  filterBar: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.borderRadius.full, backgroundColor: theme.backgroundSecondary },
  filterPillActive: { backgroundColor: theme.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  filterPillTextActive: { color: '#FFF' },
  
  // Category Tabs
  categoryTabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  categoryTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: theme.borderRadius.md, backgroundColor: theme.backgroundSecondary },
  categoryTabActive: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  categoryTabText: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  categoryTabTextActive: { fontWeight: '700' },
  
  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  
  // Section
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  sectionSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  
  // Card
  card: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, ...theme.shadows.card },
  
  // Hero Card
  heroCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, marginBottom: 20, ...theme.shadows.card },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  heroStats: { gap: 16 },
  heroStatItem: { alignItems: 'center' },
  heroStatValue: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
  heroStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  
  // Ring
  ringValue: { fontWeight: '700' },
  ringLabel: { color: theme.textSecondary, marginTop: -2 },
  
  // Stats Grid
  statsGrid3: { flexDirection: 'row', justifyContent: 'space-around' },
  gridItem: { alignItems: 'center' },
  gridValue: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  gridLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  
  // Mode Win Rates
  modeWinRates: { gap: 16 },
  modeWinRateItem: { gap: 8 },
  modeLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  
  // Progress Bar
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBarTrack: { flex: 1, height: 8, backgroundColor: theme.backgroundSecondary, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressBarValue: { fontSize: 14, fontWeight: '700', minWidth: 45, textAlign: 'right' },
  
  // Format Row
  formatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  formatInfo: { width: 100 },
  formatName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  formatRecord: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  formatBarContainer: { flex: 1, marginLeft: 12 },
  
  // Score Comparison
  scoreComparison: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16 },
  scoreItem: { flex: 1, alignItems: 'center' },
  scoreValue: { fontSize: 32, fontWeight: '700', marginTop: 8 },
  scoreLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  scoreDiff: { alignItems: 'center', paddingHorizontal: 16 },
  scoreDiffBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  scoreDiffText: { fontSize: 20, fontWeight: '700' },
  scoreDiffLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2 },
  totalDiff: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border, gap: 8 },
  totalDiffLabel: { fontSize: 12, color: theme.textMuted },
  totalDiffValue: { fontSize: 14, fontWeight: '700' },
  
  // Mène Stats
  meneStats: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  meneStatMain: {},
  meneStatDetails: { flex: 1 },
  
  // Streaks
  streaksGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  streakItem: { alignItems: 'center', flex: 1 },
  streakLabel: { fontSize: 10, color: theme.textMuted, textAlign: 'center' },
  streakValue: { fontSize: 28, fontWeight: '700', marginVertical: 4 },
  streakType: { fontSize: 11, color: theme.textSecondary },
  
  // Series Stats
  seriesStats: { flexDirection: 'row', alignItems: 'center' },
  seriesMain: { flex: 1, alignItems: 'center' },
  seriesPlayed: { fontSize: 36, fontWeight: '700', color: theme.textPrimary },
  seriesPlayedLabel: { fontSize: 12, color: theme.textMuted },
  seriesResults: { flexDirection: 'row', gap: 24 },
  seriesResult: { alignItems: 'center' },
  seriesResultValue: { fontSize: 24, fontWeight: '700' },
  seriesResultLabel: { fontSize: 11, color: theme.textMuted },
  
  // Fanny
  fannyStats: { flexDirection: 'row', justifyContent: 'space-around' },
  fannyItem: { alignItems: 'center' },
  fannyValue: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  fannyLabel: { fontSize: 11, color: theme.textMuted, marginTop: 4 },
  
  // Stat Row
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  statRowIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  statRowContent: { flex: 1 },
  statRowLabel: { fontSize: 13, color: theme.textPrimary },
  statRowSubValue: { fontSize: 10, color: theme.textMuted },
  statRowValue: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  statRowValueNA: { color: theme.textMuted, fontWeight: '500', fontStyle: 'italic' },
  
  // Stat Card
  statCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, alignItems: 'center', ...theme.shadows.card },
  statCardSmall: { padding: 10 },
  statCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statCardTitle: { fontSize: 11, color: theme.textMuted, textAlign: 'center' },
  statCardTitleSmall: { fontSize: 10 },
  statCardValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statCardValue: { fontSize: 20, fontWeight: '700' },
  statCardValueSmall: { fontSize: 16 },
  statCardSubtitle: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  
  // Breakdown
  breakdownContainer: { gap: 12 },
  breakdownBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: theme.backgroundSecondary },
  breakdownSegment: { height: '100%' },
  breakdownLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  breakdownLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLegendText: { fontSize: 11, color: theme.textSecondary },
  breakdownLegendValue: { fontSize: 11, fontWeight: '600', color: theme.textPrimary },
  
  // NA Placeholder
  naPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 8, marginTop: 8, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.sm },
  naText: { fontSize: 11, color: theme.textMuted, flex: 1 },
  
  // Divider
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 8 },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24, maxWidth: 260 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: theme.borderRadius.md },
  emptyButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
