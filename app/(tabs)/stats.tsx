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
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { ChallengeType, SeriesInfo } from '@/services/mockData';
import Svg, { Circle, Line, Path, G, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

// ============================================
// TYPES & CONSTANTS
// ============================================
type TimeFilter = 'week' | 'month' | 'year' | 'all';
type StatsMode = 'simple' | 'advanced';

const TIME_FILTERS: { id: TimeFilter; label: string; shortLabel: string }[] = [
  { id: 'week', label: 'Cette semaine', shortLabel: '7j' },
  { id: 'month', label: 'Ce mois', shortLabel: '30j' },
  { id: 'year', label: 'Cette année', shortLabel: '1an' },
  { id: 'all', label: 'Tout', shortLabel: 'Tout' },
];

const CHALLENGE_CONFIG = {
  '10_tirs': { name: '10 Tirs', icon: 'gps-fixed' as const, color: '#F97316' },
  '10_tirs_sautee': { name: 'Sautée', icon: 'sports' as const, color: '#3B82F6' },
  'precision': { name: 'Précision', icon: 'stars' as const, color: '#F59E0B' },
};

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

function getEvolutionData(matches: any[], timeFilter: TimeFilter) {
  const now = new Date();
  let periods: { start: Date; end: Date; label: string }[] = [];
  
  switch (timeFilter) {
    case 'week':
      for (let i = 6; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        periods.push({
          start,
          end,
          label: start.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 2),
        });
      }
      break;
    case 'month':
      for (let i = 3; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - i * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        periods.push({ start, end, label: `S${4 - i}` });
      }
      break;
    case 'year':
    case 'all':
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        periods.push({
          start,
          end,
          label: start.toLocaleDateString('fr-FR', { month: 'short' }).slice(0, 3),
        });
      }
      break;
  }
  
  return periods.map(period => {
    const periodMatches = matches.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= period.start && itemDate < period.end;
    });
    const wins = periodMatches.filter(m => m.winner === 'A').length;
    return {
      label: period.label,
      winRate: periodMatches.length > 0 ? Math.round((wins / periodMatches.length) * 100) : 0,
      matches: periodMatches.length,
    };
  });
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
  showValue = true,
  label,
}: { 
  value: number; 
  size?: number;
  strokeWidth?: number;
  color?: string;
  showValue?: boolean;
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
      {showValue && (
        <View style={StyleSheet.absoluteFill as any}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[styles.ringValue, { color, fontSize: size * 0.22 }]}>{value}%</Text>
            {label && <Text style={[styles.ringLabel, { fontSize: size * 0.12 }]}>{label}</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

// Evolution Line Chart
function EvolutionChart({ 
  data, 
  height = 160,
  color = theme.primary,
}: { 
  data: { label: string; winRate: number; matches: number }[];
  height?: number;
  color?: string;
}) {
  const width = screenWidth - 64;
  
  if (data.length === 0 || data.every(d => d.matches === 0)) {
    return (
      <View style={[styles.chartEmpty, { height }]}>
        <MaterialIcons name="show-chart" size={32} color={theme.textMuted} />
        <Text style={styles.chartEmptyText}>Pas encore de données</Text>
      </View>
    );
  }

  const padding = { top: 16, right: 12, bottom: 28, left: 32 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
    y: padding.top + chartHeight - (d.winRate / 100) * chartHeight,
    value: d.winRate,
    matches: d.matches,
    label: d.label,
  }));
  
  const createPath = () => {
    if (points.length < 2) return `M ${points[0].x} ${points[0].y}`;
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };
  
  const createAreaPath = () => {
    const linePath = createPath();
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    return `${linePath} L ${lastPoint.x} ${padding.top + chartHeight} L ${firstPoint.x} ${padding.top + chartHeight} Z`;
  };

  return (
    <Svg width={width} height={height}>
      {/* Grid lines */}
      {[0, 50, 100].map((val, i) => {
        const y = padding.top + chartHeight - (val / 100) * chartHeight;
        return (
          <G key={i}>
            <Line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke={theme.border}
              strokeWidth={1}
              strokeDasharray={val === 50 ? "0" : "3,3"}
              opacity={0.5}
            />
            <SvgText x={padding.left - 6} y={y + 3} fontSize={9} fill={theme.textMuted} textAnchor="end">
              {val}
            </SvgText>
          </G>
        );
      })}
      
      {/* Area fill */}
      <Path d={createAreaPath()} fill={color} opacity={0.08} />
      
      {/* Line */}
      <Path d={createPath()} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      
      {/* Data points */}
      {points.map((point, i) => (
        <G key={i}>
          {point.matches > 0 && (
            <>
              <Circle cx={point.x} cy={point.y} r={5} fill={theme.surface} stroke={color} strokeWidth={2} />
              <Circle cx={point.x} cy={point.y} r={2} fill={color} />
            </>
          )}
          <SvgText x={point.x} y={height - 8} fontSize={9} fill={theme.textSecondary} textAnchor="middle">
            {point.label}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

// Quick Stat Item
function QuickStat({ icon, iconColor, value, label, trend }: {
  icon: string;
  iconColor: string;
  value: string | number;
  label: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <View style={styles.quickStat}>
      <View style={[styles.quickStatIcon, { backgroundColor: iconColor + '15' }]}>
        <MaterialIcons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.quickStatContent}>
        <View style={styles.quickStatRow}>
          <Text style={styles.quickStatValue}>{value}</Text>
          {trend && (
            <MaterialIcons 
              name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'} 
              size={14} 
              color={trend === 'up' ? theme.success : trend === 'down' ? theme.error : theme.textMuted} 
            />
          )}
        </View>
        <Text style={styles.quickStatLabel}>{label}</Text>
      </View>
    </View>
  );
}

// Skill Bar
function SkillBar({ label, value, color, detail }: { 
  label: string; 
  value: number; 
  color: string;
  detail?: string;
}) {
  return (
    <View style={styles.skillBar}>
      <View style={styles.skillBarHeader}>
        <Text style={styles.skillBarLabel}>{label}</Text>
        <View style={styles.skillBarValueRow}>
          <Text style={[styles.skillBarValue, { color }]}>{value}%</Text>
          {detail && <Text style={styles.skillBarDetail}>{detail}</Text>}
        </View>
      </View>
      <View style={styles.skillBarTrack}>
        <Animated.View 
          entering={FadeIn.duration(600)}
          style={[styles.skillBarFill, { width: `${value}%`, backgroundColor: color }]} 
        />
      </View>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, matches, challengeStats, challenges, tournaments, selfPlayer } = useApp();
  
  const [statsMode, setStatsMode] = useState<StatsMode>('simple');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [showTimeModal, setShowTimeModal] = useState(false);

  // Filter data
  const filteredMatches = filterByTime(matches, timeFilter);
  const filteredChallenges = filterByTime(challenges, timeFilter);
  
  // Evolution data
  const evolutionData = useMemo(() => getEvolutionData(matches, timeFilter), [matches, timeFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredMatches.length;
    const wins = filteredMatches.filter(m => m.winner === 'A').length;
    const losses = total - wins;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    const tournamentMatches = filteredMatches.filter(m => m.mode === 'Tournoi');
    const trainingMatches = filteredMatches.filter(m => m.mode === 'Entraînement');
    const tournamentWins = tournamentMatches.filter(m => m.winner === 'A').length;
    const trainingWins = trainingMatches.filter(m => m.winner === 'A').length;
    
    // Fanny stats (13-0)
    const fannyWins = filteredMatches.filter(m => m.winner === 'A' && m.teamA.score === 13 && m.teamB.score === 0).length;
    const fannyLosses = filteredMatches.filter(m => m.winner === 'B' && m.teamB.score === 13 && m.teamA.score === 0).length;
    
    // Points
    let totalPointsFor = 0, totalPointsAgainst = 0;
    filteredMatches.forEach(match => {
      totalPointsFor += match.teamA.score;
      totalPointsAgainst += match.teamB.score;
    });

    // Actions
    let matchTirs = 0, matchTirsSuccess = 0, matchCarreaux = 0;
    let matchPoints = 0, matchPointsSuccess = 0;
    filteredMatches.forEach(match => {
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          matchTirs += pa.actions.tirs;
          matchTirsSuccess += pa.actions.tirsSuccess;
          matchCarreaux += pa.actions.carreaux;
          matchPoints += pa.actions.points;
          matchPointsSuccess += pa.actions.pointsSuccess;
        });
      }
    });

    const tirRate = matchTirs > 0 ? Math.round((matchTirsSuccess / matchTirs) * 100) : 0;
    const pointRate = matchPoints > 0 ? Math.round((matchPointsSuccess / matchPoints) * 100) : 0;
    const carreauRate = matchTirs > 0 ? Math.round((matchCarreaux / matchTirs) * 100) : 0;
    
    // Duration stats
    const matchesWithDuration = filteredMatches.filter(m => m.duration > 0);
    const avgDuration = matchesWithDuration.length > 0 
      ? Math.round(matchesWithDuration.reduce((sum, m) => sum + m.duration, 0) / matchesWithDuration.length) 
      : 0;
    const totalDuration = matchesWithDuration.reduce((sum, m) => sum + m.duration, 0);

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
    const finales = filteredMatches.filter(m => m.seriesInfo?.isFinale);
    const finalesWon = finales.filter(m => m.winner === 'A').length;

    return {
      total,
      wins,
      losses,
      winRate,
      tournamentMatches: tournamentMatches.length,
      trainingMatches: trainingMatches.length,
      tournamentWins,
      trainingWins,
      tournamentWinRate: tournamentMatches.length > 0 ? Math.round((tournamentWins / tournamentMatches.length) * 100) : 0,
      trainingWinRate: trainingMatches.length > 0 ? Math.round((trainingWins / trainingMatches.length) * 100) : 0,
      totalPointsFor,
      totalPointsAgainst,
      pointDiff: totalPointsFor - totalPointsAgainst,
      tirRate,
      pointRate,
      carreauRate,
      matchTirs,
      matchTirsSuccess,
      matchCarreaux,
      matchPoints,
      matchPointsSuccess,
      avgDuration,
      totalDuration,
      seriesPlayed: Object.keys(seriesMap).length,
      seriesWon,
      seriesLost: seriesComplete.length - seriesWon,
      seriesWinRate: seriesComplete.length > 0 ? Math.round((seriesWon / seriesComplete.length) * 100) : 0,
      finalesPlayed: finales.length,
      finalesWon,
      finaleWinRate: finales.length > 0 ? Math.round((finalesWon / finales.length) * 100) : 0,
      fannyWins,
      fannyLosses,
    };
  }, [filteredMatches]);

  // Challenge stats
  const challengeData = useMemo(() => {
    const byType: Record<ChallengeType, { count: number; avgSuccess: number; bestScore: number }> = {
      '10_tirs': { count: 0, avgSuccess: 0, bestScore: 0 },
      '10_tirs_sautee': { count: 0, avgSuccess: 0, bestScore: 0 },
      'precision': { count: 0, avgSuccess: 0, bestScore: 0 },
    };
    const typeTotal: Record<ChallengeType, number> = { '10_tirs': 0, '10_tirs_sautee': 0, 'precision': 0 };

    // Aggregate challenge technical stats
    let challengeTirs = 0, challengeTirsSuccess = 0, challengeCarreaux = 0;
    
    filteredChallenges.forEach(c => {
      byType[c.type].count++;
      if (c.type === 'precision') {
        typeTotal[c.type] += c.totalPoints || 0;
        byType[c.type].bestScore = Math.max(byType[c.type].bestScore, c.totalPoints || 0);
      } else {
        typeTotal[c.type] += c.successRate || 0;
        byType[c.type].bestScore = Math.max(byType[c.type].bestScore, c.successRate || 0);
        // Aggregate tir stats from challenges (10_tirs and 10_tirs_sautee are shooting challenges)
        challengeTirs += c.totalShots || 0;
        challengeTirsSuccess += c.successCount || 0;
        challengeCarreaux += c.carreauCount || 0;
      }
    });

    Object.keys(byType).forEach(key => {
      const t = byType[key as ChallengeType];
      t.avgSuccess = t.count > 0 ? Math.round(typeTotal[key as ChallengeType] / t.count) : 0;
    });

    // 1v1 stats
    const challenges1v1 = filteredChallenges.filter(c => c.mode === '1v1');
    const won1v1 = challenges1v1.filter(c => c.winner === 'player').length;

    return {
      total: filteredChallenges.length,
      byType,
      challenges1v1: challenges1v1.length,
      won1v1,
      winRate1v1: challenges1v1.length > 0 ? Math.round((won1v1 / challenges1v1.length) * 100) : 0,
      challengeTirs,
      challengeTirsSuccess,
      challengeCarreaux,
      challengeTirRate: challengeTirs > 0 ? Math.round((challengeTirsSuccess / challengeTirs) * 100) : 0,
      challengeCarreauRate: challengeTirs > 0 ? Math.round((challengeCarreaux / challengeTirs) * 100) : 0,
    };
  }, [filteredChallenges]);

  // Terrain stats (advanced)
  const terrainStats = useMemo(() => {
    const byType: Record<string, { matches: number; wins: number }> = {};
    filteredMatches.forEach(match => {
      if (match.tournamentId) {
        const tournament = tournaments.find(t => t.id === match.tournamentId);
        if (tournament?.terrainType) {
          if (!byType[tournament.terrainType]) byType[tournament.terrainType] = { matches: 0, wins: 0 };
          byType[tournament.terrainType].matches++;
          if (match.winner === 'A') byType[tournament.terrainType].wins++;
        }
      }
    });
    return Object.entries(byType)
      .map(([type, data]) => ({
        type,
        matches: data.matches,
        wins: data.wins,
        winRate: data.matches > 0 ? Math.round((data.wins / data.matches) * 100) : 0,
      }))
      .sort((a, b) => b.matches - a.matches);
  }, [filteredMatches, tournaments]);

  // Financial stats (advanced)
  const financialStats = useMemo(() => {
    const completedTournaments = tournaments.filter(t => t.status === 'Terminé');
    const totalCost = completedTournaments.reduce((sum, t) => sum + (t.registrationCost || 0), 0);
    const totalGain = completedTournaments.reduce((sum, t) => sum + (t.prizeWon || 0), 0);
    return {
      totalCost,
      totalGain,
      balance: totalGain - totalCost,
      tournamentsPlayed: completedTournaments.length,
    };
  }, [tournaments]);

  // Trend calculation
  const getTrend = (current: number, threshold: number = 50): 'up' | 'down' | 'neutral' => {
    if (current > threshold + 5) return 'up';
    if (current < threshold - 5) return 'down';
    return 'neutral';
  };

  const currentFilter = TIME_FILTERS.find(f => f.id === timeFilter);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Statistiques</Text>
            <Text style={styles.headerSubtitle}>
              {stats.total} matchs • {stats.winRate}% victoires
            </Text>
          </View>
          
          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <Pressable
              style={[styles.modeButton, statsMode === 'simple' && styles.modeButtonActive]}
              onPress={() => { Haptics.selectionAsync(); setStatsMode('simple'); }}
            >
              <MaterialIcons 
                name="dashboard" 
                size={16} 
                color={statsMode === 'simple' ? '#FFF' : theme.textSecondary} 
              />
              <Text style={[styles.modeButtonText, statsMode === 'simple' && styles.modeButtonTextActive]}>
                Simple
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, statsMode === 'advanced' && styles.modeButtonActive]}
              onPress={() => { Haptics.selectionAsync(); setStatsMode('advanced'); }}
            >
              <MaterialIcons 
                name="insights" 
                size={16} 
                color={statsMode === 'advanced' ? '#FFF' : theme.textSecondary} 
              />
              <Text style={[styles.modeButtonText, statsMode === 'advanced' && styles.modeButtonTextActive]}>
                Avancé
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Time Filter Pills */}
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
                {filter.shortLabel}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================
            SIMPLE MODE
        ======================================== */}
        {statsMode === 'simple' && (
          <>
            {/* Main Win Rate Card */}
            <Animated.View entering={ZoomIn.duration(400)} style={styles.heroCard}>
              <View style={styles.heroContent}>
                <ProgressRing 
                  value={stats.winRate} 
                  size={120} 
                  strokeWidth={10} 
                  color={theme.primary}
                  label="Victoires"
                />
                <View style={styles.heroStats}>
                  <View style={styles.heroStatRow}>
                    <View style={[styles.heroDot, { backgroundColor: theme.success }]} />
                    <Text style={styles.heroStatText}>{stats.wins} gagnés</Text>
                  </View>
                  <View style={styles.heroStatRow}>
                    <View style={[styles.heroDot, { backgroundColor: theme.error }]} />
                    <Text style={styles.heroStatText}>{stats.losses} perdus</Text>
                  </View>
                  <View style={styles.heroStatRow}>
                    <View style={[styles.heroDot, { backgroundColor: theme.accent }]} />
                    <Text style={styles.heroStatText}>{stats.total} total</Text>
                  </View>
                </View>
              </View>
              
              {/* Fanny Stats */}
              {(stats.fannyWins > 0 || stats.fannyLosses > 0) && (
                <View style={styles.fannySection}>
                  <View style={styles.fannySeparator} />
                  <View style={styles.fannyRow}>
                    <View style={styles.fannyIconContainer}>
                      <Svg width={24} height={24} viewBox="0 0 24 24">
                        <Circle cx="9" cy="14" r="5" fill={theme.carreauColor} opacity={0.9} />
                        <Circle cx="15" cy="14" r="5" fill={theme.carreauColor} opacity={0.9} />
                        <Path d="M12 10 Q12 16 12 19" stroke={theme.textMuted} strokeWidth="1" fill="none" />
                      </Svg>
                    </View>
                    <Text style={styles.fannyLabel}>Fanny (13-0)</Text>
                    <View style={styles.fannyStats}>
                      <View style={styles.fannyStat}>
                        <Text style={[styles.fannyValue, { color: theme.success }]}>{stats.fannyWins}</Text>
                        <Text style={styles.fannyStatLabel}>infligées</Text>
                      </View>
                      <Text style={styles.fannySeparatorText}>•</Text>
                      <View style={styles.fannyStat}>
                        <Text style={[styles.fannyValue, { color: theme.error }]}>{stats.fannyLosses}</Text>
                        <Text style={styles.fannyStatLabel}>subies</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Quick Stats Grid */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <View style={styles.quickStatsGrid}>
                <QuickStat 
                  icon="emoji-events" 
                  iconColor={theme.carreauColor}
                  value={`${stats.tournamentWinRate}%`}
                  label="Tournois"
                  trend={getTrend(stats.tournamentWinRate)}
                />
                <QuickStat 
                  icon="fitness-center" 
                  iconColor={theme.primary}
                  value={`${stats.trainingWinRate}%`}
                  label="Entraînements"
                  trend={getTrend(stats.trainingWinRate)}
                />
                <QuickStat 
                  icon="timer" 
                  iconColor={theme.accent}
                  value={`${stats.avgDuration}m`}
                  label="Durée moyenne"
                />
                <QuickStat 
                  icon="sports" 
                  iconColor={theme.success}
                  value={stats.pointDiff > 0 ? `+${stats.pointDiff}` : stats.pointDiff}
                  label="Diff. points"
                  trend={stats.pointDiff > 0 ? 'up' : stats.pointDiff < 0 ? 'down' : 'neutral'}
                />
              </View>
            </Animated.View>

            {/* Evolution Chart */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Évolution</Text>
                {evolutionData.some(d => d.matches > 0) && (
                  <View style={styles.trendBadge}>
                    {(() => {
                      const validData = evolutionData.filter(d => d.matches > 0);
                      if (validData.length < 2) return null;
                      const diff = validData[validData.length - 1].winRate - validData[0].winRate;
                      const isUp = diff > 0;
                      return (
                        <>
                          <MaterialIcons 
                            name={isUp ? 'trending-up' : diff < 0 ? 'trending-down' : 'trending-flat'} 
                            size={14} 
                            color={isUp ? theme.success : diff < 0 ? theme.error : theme.textMuted} 
                          />
                          <Text style={[styles.trendBadgeText, { color: isUp ? theme.success : diff < 0 ? theme.error : theme.textMuted }]}>
                            {isUp ? '+' : ''}{diff}%
                          </Text>
                        </>
                      );
                    })()}
                  </View>
                )}
              </View>
              <View style={styles.chartCard}>
                <EvolutionChart data={evolutionData} color={theme.primary} />
              </View>
            </Animated.View>

            {/* Skills Summary */}
            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Performance technique</Text>
                {challengeData.challengeTirs > 0 && (
                  <View style={styles.includeChallengesBadge}>
                    <MaterialIcons name="add-circle" size={12} color={theme.primary} />
                    <Text style={styles.includeChallengesText}>Défis inclus</Text>
                  </View>
                )}
              </View>
              <View style={styles.skillsCard}>
                <SkillBar 
                  label="Tir" 
                  value={challengeData.challengeTirs > 0 
                    ? Math.round(((stats.matchTirsSuccess + challengeData.challengeTirsSuccess) / (stats.matchTirs + challengeData.challengeTirs)) * 100) || 0
                    : stats.tirRate} 
                  color={theme.tirColor}
                  detail={challengeData.challengeTirs > 0 
                    ? `${stats.matchTirsSuccess + challengeData.challengeTirsSuccess}/${stats.matchTirs + challengeData.challengeTirs}`
                    : `${stats.matchTirsSuccess}/${stats.matchTirs}`}
                />
                <SkillBar 
                  label="Point" 
                  value={stats.pointRate} 
                  color={theme.pointColor}
                  detail={`${stats.matchPointsSuccess}/${stats.matchPoints}`}
                />
                <SkillBar 
                  label="Carreau" 
                  value={challengeData.challengeTirs > 0 
                    ? Math.round(((stats.matchCarreaux + challengeData.challengeCarreaux) / (stats.matchTirs + challengeData.challengeTirs)) * 100) || 0
                    : stats.carreauRate} 
                  color={theme.carreauColor}
                  detail={challengeData.challengeTirs > 0 
                    ? `${stats.matchCarreaux + challengeData.challengeCarreaux} réussis`
                    : `${stats.matchCarreaux} réussis`}
                />
              </View>
            </Animated.View>

            {/* Challenges Summary */}
            {challengeData.total > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Défis</Text>
                  <Pressable onPress={() => router.push('/challenge/new')}>
                    <Text style={styles.sectionLink}>+ Nouveau</Text>
                  </Pressable>
                </View>
                <View style={styles.challengeGrid}>
                  {Object.entries(CHALLENGE_CONFIG).map(([type, config]) => {
                    const data = challengeData.byType[type as ChallengeType];
                    return (
                      <View key={type} style={styles.challengeCard}>
                        <View style={[styles.challengeIcon, { backgroundColor: config.color + '15' }]}>
                          <MaterialIcons name={config.icon} size={20} color={config.color} />
                        </View>
                        <Text style={styles.challengeName}>{config.name}</Text>
                        <Text style={styles.challengeCount}>{data.count}</Text>
                        {data.count > 0 && (
                          <Text style={[styles.challengeBest, { color: config.color }]}>
                            ⭐ {data.bestScore}{type === 'precision' ? 'pts' : '%'}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            )}
          </>
        )}

        {/* ========================================
            ADVANCED MODE
        ======================================== */}
        {statsMode === 'advanced' && (
          <>
            {/* Overall Performance */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>Performance globale</Text>
              <View style={styles.advancedGrid}>
                <View style={styles.advancedCard}>
                  <ProgressRing value={stats.winRate} size={90} strokeWidth={8} color={theme.primary} label="Global" />
                </View>
                <View style={styles.advancedCard}>
                  <ProgressRing value={stats.tournamentWinRate} size={90} strokeWidth={8} color={theme.carreauColor} label="Tournois" />
                </View>
                <View style={styles.advancedCard}>
                  <ProgressRing value={stats.trainingWinRate} size={90} strokeWidth={8} color={theme.primary} label="Entraînement" />
                </View>
              </View>
            </Animated.View>

            {/* Detailed Breakdown */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <Text style={styles.sectionTitle}>Détail des matchs</Text>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Tournois</Text>
                    <Text style={styles.detailValue}>{stats.tournamentMatches}</Text>
                    <View style={styles.detailSubRow}>
                      <Text style={[styles.detailSub, { color: theme.success }]}>{stats.tournamentWins}V</Text>
                      <Text style={styles.detailSubSep}>•</Text>
                      <Text style={[styles.detailSub, { color: theme.error }]}>{stats.tournamentMatches - stats.tournamentWins}D</Text>
                    </View>
                  </View>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Entraînement</Text>
                    <Text style={styles.detailValue}>{stats.trainingMatches}</Text>
                    <View style={styles.detailSubRow}>
                      <Text style={[styles.detailSub, { color: theme.success }]}>{stats.trainingWins}V</Text>
                      <Text style={styles.detailSubSep}>•</Text>
                      <Text style={[styles.detailSub, { color: theme.error }]}>{stats.trainingMatches - stats.trainingWins}D</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Evolution Chart */}
            <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
              <Text style={styles.sectionTitle}>Évolution dans le temps</Text>
              <View style={styles.chartCard}>
                <EvolutionChart data={evolutionData} height={180} color={theme.primary} />
              </View>
              {/* Evolution Stats */}
              {evolutionData.some(d => d.matches > 0) && (
                <View style={styles.evolutionStats}>
                  <View style={styles.evolutionStat}>
                    <Text style={styles.evolutionStatLabel}>Meilleure période</Text>
                    <Text style={styles.evolutionStatValue}>
                      {(() => {
                        const best = evolutionData.filter(d => d.matches > 0).sort((a, b) => b.winRate - a.winRate)[0];
                        return best ? `${best.label} (${best.winRate}%)` : '—';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.evolutionStat}>
                    <Text style={styles.evolutionStatLabel}>Matchs joués</Text>
                    <Text style={styles.evolutionStatValue}>
                      {evolutionData.reduce((sum, d) => sum + d.matches, 0)}
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Series Stats */}
            {stats.seriesPlayed > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
                <Text style={styles.sectionTitle}>Séries (Best of 3)</Text>
                <View style={styles.seriesCard}>
                  <View style={styles.seriesMain}>
                    <View style={styles.seriesRing}>
                      <ProgressRing value={stats.seriesWinRate} size={80} strokeWidth={7} color={theme.accent} />
                    </View>
                    <View style={styles.seriesInfo}>
                      <Text style={styles.seriesTotal}>{stats.seriesWon + stats.seriesLost} séries</Text>
                      <View style={styles.seriesRecord}>
                        <Text style={[styles.seriesRecordNum, { color: theme.success }]}>{stats.seriesWon}</Text>
                        <Text style={styles.seriesRecordSep}>-</Text>
                        <Text style={[styles.seriesRecordNum, { color: theme.error }]}>{stats.seriesLost}</Text>
                      </View>
                    </View>
                  </View>
                  {stats.finalesPlayed > 0 && (
                    <View style={styles.finalesRow}>
                      <MaterialIcons name="emoji-events" size={18} color={theme.carreauColor} />
                      <Text style={styles.finalesText}>
                        {stats.finalesWon}/{stats.finalesPlayed} finales gagnées ({stats.finaleWinRate}%)
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Technical Skills */}
            <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
              <Text style={styles.sectionTitle}>Technique détaillée</Text>
              <View style={styles.technicalGrid}>
                <View style={styles.technicalCard}>
                  <View style={[styles.technicalIcon, { backgroundColor: theme.tirColor + '15' }]}>
                    <MaterialIcons name="gps-fixed" size={24} color={theme.tirColor} />
                  </View>
                  <Text style={styles.technicalTitle}>Tir</Text>
                  <Text style={[styles.technicalValue, { color: theme.tirColor }]}>{stats.tirRate}%</Text>
                  <Text style={styles.technicalDetail}>{stats.matchTirsSuccess}/{stats.matchTirs}</Text>
                </View>
                <View style={styles.technicalCard}>
                  <View style={[styles.technicalIcon, { backgroundColor: theme.pointColor + '15' }]}>
                    <MaterialIcons name="adjust" size={24} color={theme.pointColor} />
                  </View>
                  <Text style={styles.technicalTitle}>Point</Text>
                  <Text style={[styles.technicalValue, { color: theme.pointColor }]}>{stats.pointRate}%</Text>
                  <Text style={styles.technicalDetail}>{stats.matchPointsSuccess}/{stats.matchPoints}</Text>
                </View>
                <View style={styles.technicalCard}>
                  <View style={[styles.technicalIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                    <MaterialIcons name="stars" size={24} color={theme.carreauColor} />
                  </View>
                  <Text style={styles.technicalTitle}>Carreau</Text>
                  <Text style={[styles.technicalValue, { color: theme.carreauColor }]}>{stats.carreauRate}%</Text>
                  <Text style={styles.technicalDetail}>{stats.matchCarreaux} réussis</Text>
                </View>
              </View>
            </Animated.View>

            {/* Points Analysis */}
            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <Text style={styles.sectionTitle}>Analyse des points</Text>
              <View style={styles.pointsCard}>
                <View style={styles.pointsRow}>
                  <View style={styles.pointsItem}>
                    <MaterialIcons name="add-circle" size={28} color={theme.success} />
                    <Text style={[styles.pointsValue, { color: theme.success }]}>{stats.totalPointsFor}</Text>
                    <Text style={styles.pointsLabel}>Marqués</Text>
                  </View>
                  <View style={styles.pointsDiff}>
                    <View style={[
                      styles.pointsDiffBadge,
                      { backgroundColor: stats.pointDiff >= 0 ? theme.success + '15' : theme.error + '15' }
                    ]}>
                      <Text style={[
                        styles.pointsDiffText,
                        { color: stats.pointDiff >= 0 ? theme.success : theme.error }
                      ]}>
                        {stats.pointDiff > 0 ? '+' : ''}{stats.pointDiff}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pointsItem}>
                    <MaterialIcons name="remove-circle" size={28} color={theme.error} />
                    <Text style={[styles.pointsValue, { color: theme.error }]}>{stats.totalPointsAgainst}</Text>
                    <Text style={styles.pointsLabel}>Encaissés</Text>
                  </View>
                </View>
                <View style={styles.pointsAvg}>
                  <Text style={styles.pointsAvgText}>
                    Moyenne: {stats.total > 0 ? (stats.totalPointsFor / stats.total).toFixed(1) : '0'} marqués • {stats.total > 0 ? (stats.totalPointsAgainst / stats.total).toFixed(1) : '0'} encaissés
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Duration Stats */}
            <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
              <Text style={styles.sectionTitle}>Temps de jeu</Text>
              <View style={styles.durationCard}>
                <View style={styles.durationMain}>
                  <MaterialIcons name="timer" size={32} color={theme.primary} />
                  <View style={styles.durationInfo}>
                    <Text style={styles.durationValue}>{stats.avgDuration} min</Text>
                    <Text style={styles.durationLabel}>Durée moyenne</Text>
                  </View>
                </View>
                <View style={styles.durationTotal}>
                  <Text style={styles.durationTotalLabel}>Temps total</Text>
                  <Text style={styles.durationTotalValue}>
                    {Math.floor(stats.totalDuration / 60)}h {stats.totalDuration % 60}m
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Terrain Performance */}
            {terrainStats.length > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
                <Text style={styles.sectionTitle}>Performance par terrain</Text>
                <View style={styles.terrainList}>
                  {terrainStats.slice(0, 4).map((terrain, index) => (
                    <View key={terrain.type} style={styles.terrainItem}>
                      <Text style={styles.terrainType}>{terrain.type}</Text>
                      <Text style={styles.terrainMatches}>{terrain.matches} matchs</Text>
                      <View style={[
                        styles.terrainWinRate,
                        { backgroundColor: terrain.winRate >= 50 ? theme.success + '15' : theme.error + '15' }
                      ]}>
                        <Text style={[
                          styles.terrainWinRateText,
                          { color: terrain.winRate >= 50 ? theme.success : theme.error }
                        ]}>
                          {terrain.winRate}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Challenges Detailed */}
            {challengeData.total > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(450)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Défis détaillés</Text>
                  <Pressable onPress={() => router.push('/challenge/new')}>
                    <MaterialIcons name="add-circle" size={24} color={theme.primary} />
                  </Pressable>
                </View>
                <View style={styles.challengeDetailList}>
                  {Object.entries(CHALLENGE_CONFIG).map(([type, config]) => {
                    const data = challengeData.byType[type as ChallengeType];
                    if (data.count === 0) return null;
                    return (
                      <View key={type} style={styles.challengeDetailItem}>
                        <View style={[styles.challengeDetailIcon, { backgroundColor: config.color + '15' }]}>
                          <MaterialIcons name={config.icon} size={20} color={config.color} />
                        </View>
                        <View style={styles.challengeDetailInfo}>
                          <Text style={styles.challengeDetailName}>{config.name}</Text>
                          <Text style={styles.challengeDetailCount}>{data.count} essais</Text>
                        </View>
                        <View style={styles.challengeDetailScores}>
                          <View style={styles.challengeDetailScore}>
                            <Text style={[styles.challengeDetailScoreValue, { color: config.color }]}>
                              {data.bestScore}{type === 'precision' ? '' : '%'}
                            </Text>
                            <Text style={styles.challengeDetailScoreLabel}>Record</Text>
                          </View>
                          <View style={styles.challengeDetailScore}>
                            <Text style={styles.challengeDetailScoreValue}>
                              {data.avgSuccess}{type === 'precision' ? '' : '%'}
                            </Text>
                            <Text style={styles.challengeDetailScoreLabel}>Moyenne</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
                
                {/* 1v1 Stats */}
                {challengeData.challenges1v1 > 0 && (
                  <View style={styles.vs1Card}>
                    <MaterialIcons name="people" size={20} color={theme.accent} />
                    <Text style={styles.vs1Text}>
                      Défis 1v1: {challengeData.won1v1}/{challengeData.challenges1v1} gagnés ({challengeData.winRate1v1}%)
                    </Text>
                  </View>
                )}
              </Animated.View>
            )}

            {/* Financial Summary */}
            {financialStats.tournamentsPlayed > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.section}>
                <Text style={styles.sectionTitle}>Bilan financier</Text>
                <View style={styles.financialCard}>
                  <View style={styles.financialMain}>
                    <View style={[
                      styles.financialBadge,
                      { backgroundColor: financialStats.balance >= 0 ? theme.success + '15' : theme.error + '15' }
                    ]}>
                      <Text style={[
                        styles.financialValue,
                        { color: financialStats.balance >= 0 ? theme.success : theme.error }
                      ]}>
                        {financialStats.balance > 0 ? '+' : ''}{financialStats.balance}€
                      </Text>
                    </View>
                    <Text style={styles.financialLabel}>sur {financialStats.tournamentsPlayed} tournois</Text>
                  </View>
                  <View style={styles.financialDetails}>
                    <View style={styles.financialDetail}>
                      <MaterialIcons name="remove-circle-outline" size={16} color={theme.error} />
                      <Text style={styles.financialDetailText}>{financialStats.totalCost}€ dépensés</Text>
                    </View>
                    <View style={styles.financialDetail}>
                      <MaterialIcons name="add-circle-outline" size={16} color={theme.success} />
                      <Text style={styles.financialDetailText}>{financialStats.totalGain}€ gagnés</Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Compare Button */}
            <Animated.View entering={FadeInDown.duration(400).delay(550)} style={styles.section}>
              <Pressable 
                style={styles.compareButton}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/player/compare'); }}
              >
                <MaterialIcons name="compare-arrows" size={22} color={theme.primary} />
                <Text style={styles.compareButtonText}>Comparer avec un autre joueur</Text>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            </Animated.View>
          </>
        )}

        {/* Empty State */}
        {stats.total === 0 && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
            <MaterialIcons name="bar-chart" size={64} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Pas encore de statistiques</Text>
            <Text style={styles.emptyText}>
              Jouez des matchs et relevez des défis pour voir vos statistiques évoluer
            </Text>
            <Pressable 
              style={styles.emptyButton}
              onPress={() => router.push('/match/new')}
            >
              <MaterialIcons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>Nouveau match</Text>
            </Pressable>
          </Animated.View>
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
  
  // Mode Toggle
  modeToggle: { flexDirection: 'row', backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.full, padding: 3 },
  modeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.borderRadius.full },
  modeButtonActive: { backgroundColor: theme.primary },
  modeButtonText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  modeButtonTextActive: { color: '#FFF' },
  
  // Filter Bar
  filterBar: { paddingHorizontal: 16, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.borderRadius.full, backgroundColor: theme.backgroundSecondary },
  filterPillActive: { backgroundColor: theme.primary },
  filterPillText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  filterPillTextActive: { color: '#FFF' },
  
  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  
  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  sectionLink: { fontSize: 13, fontWeight: '600', color: theme.primary },
  
  // Ring
  ringValue: { fontWeight: '700' },
  ringLabel: { color: theme.textSecondary, marginTop: -2 },
  
  // Hero Card
  heroCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 24, marginBottom: 20, ...theme.shadows.card },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  heroStats: { gap: 12 },
  heroStatRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroDot: { width: 10, height: 10, borderRadius: 5 },
  heroStatText: { fontSize: 15, color: theme.textPrimary, fontWeight: '500' },
  
  // Fanny
  fannySection: { marginTop: 16 },
  fannySeparator: { height: 1, backgroundColor: theme.border, marginBottom: 16 },
  fannyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fannyIconContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.carreauColor + '15', alignItems: 'center', justifyContent: 'center' },
  fannyLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  fannyStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fannyStat: { alignItems: 'center' },
  fannyValue: { fontSize: 18, fontWeight: '700' },
  fannyStatLabel: { fontSize: 10, color: theme.textMuted },
  fannySeparatorText: { fontSize: 14, color: theme.textMuted },
  
  // Quick Stats
  quickStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickStat: { width: (screenWidth - 42) / 2, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 12, ...theme.shadows.card },
  quickStatIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  quickStatContent: { flex: 1 },
  quickStatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickStatValue: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  quickStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  
  // Chart
  chartCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, ...theme.shadows.card },
  chartEmpty: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  chartEmptyText: { fontSize: 13, color: theme.textMuted },
  
  // Trend Badge
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  trendBadgeText: { fontSize: 12, fontWeight: '600' },
  
  // Skills Card
  skillsCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, gap: 16, ...theme.shadows.card },
  includeChallengesBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  includeChallengesText: { fontSize: 10, fontWeight: '600', color: theme.primary },
  skillBar: {},
  skillBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  skillBarLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  skillBarValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skillBarValue: { fontSize: 16, fontWeight: '700' },
  skillBarDetail: { fontSize: 12, color: theme.textMuted },
  skillBarTrack: { height: 8, backgroundColor: theme.backgroundSecondary, borderRadius: 4, overflow: 'hidden' },
  skillBarFill: { height: '100%', borderRadius: 4 },
  
  // Challenge Grid
  challengeGrid: { flexDirection: 'row', gap: 10 },
  challengeCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, alignItems: 'center', ...theme.shadows.card },
  challengeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  challengeName: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  challengeCount: { fontSize: 22, fontWeight: '700', color: theme.textPrimary, marginTop: 4 },
  challengeBest: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  
  // Advanced Grid
  advancedGrid: { flexDirection: 'row', gap: 10 },
  advancedCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, alignItems: 'center', ...theme.shadows.card },
  
  // Detail Card
  detailCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, ...theme.shadows.card },
  detailRow: { flexDirection: 'row' },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 12, color: theme.textMuted, marginBottom: 4 },
  detailValue: { fontSize: 32, fontWeight: '700', color: theme.textPrimary },
  detailSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  detailSub: { fontSize: 14, fontWeight: '600' },
  detailSubSep: { fontSize: 12, color: theme.textMuted, marginHorizontal: 6 },
  detailDivider: { width: 1, backgroundColor: theme.border, marginHorizontal: 16 },
  
  // Evolution Stats
  evolutionStats: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  evolutionStat: { flex: 1, alignItems: 'center' },
  evolutionStatLabel: { fontSize: 11, color: theme.textMuted, marginBottom: 2 },
  evolutionStatValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  
  // Series Card
  seriesCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, ...theme.shadows.card },
  seriesMain: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  seriesRing: {},
  seriesInfo: { flex: 1 },
  seriesTotal: { fontSize: 14, color: theme.textSecondary, marginBottom: 4 },
  seriesRecord: { flexDirection: 'row', alignItems: 'center' },
  seriesRecordNum: { fontSize: 24, fontWeight: '700' },
  seriesRecordSep: { fontSize: 18, color: theme.textMuted, marginHorizontal: 8 },
  finalesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  finalesText: { fontSize: 13, color: theme.textSecondary },
  
  // Technical Grid
  technicalGrid: { flexDirection: 'row', gap: 10 },
  technicalCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, alignItems: 'center', ...theme.shadows.card },
  technicalIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  technicalTitle: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  technicalValue: { fontSize: 22, fontWeight: '700' },
  technicalDetail: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  
  // Points Card
  pointsCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, ...theme.shadows.card },
  pointsRow: { flexDirection: 'row', alignItems: 'center' },
  pointsItem: { flex: 1, alignItems: 'center' },
  pointsValue: { fontSize: 28, fontWeight: '700', marginTop: 8 },
  pointsLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
  pointsDiff: { alignItems: 'center', paddingHorizontal: 16 },
  pointsDiffBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.borderRadius.md },
  pointsDiffText: { fontSize: 18, fontWeight: '700' },
  pointsAvg: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border, alignItems: 'center' },
  pointsAvgText: { fontSize: 12, color: theme.textMuted },
  
  // Duration Card
  durationCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...theme.shadows.card },
  durationMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  durationInfo: {},
  durationValue: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
  durationLabel: { fontSize: 12, color: theme.textSecondary },
  durationTotal: { alignItems: 'flex-end' },
  durationTotalLabel: { fontSize: 11, color: theme.textMuted },
  durationTotalValue: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
  
  // Terrain List
  terrainList: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, overflow: 'hidden', ...theme.shadows.card },
  terrainItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  terrainType: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  terrainMatches: { fontSize: 12, color: theme.textMuted, marginRight: 12 },
  terrainWinRate: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.sm },
  terrainWinRateText: { fontSize: 12, fontWeight: '600' },
  
  // Challenge Detail List
  challengeDetailList: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, overflow: 'hidden', ...theme.shadows.card },
  challengeDetailItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  challengeDetailIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  challengeDetailInfo: { flex: 1 },
  challengeDetailName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  challengeDetailCount: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  challengeDetailScores: { flexDirection: 'row', gap: 16 },
  challengeDetailScore: { alignItems: 'center' },
  challengeDetailScoreValue: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  challengeDetailScoreLabel: { fontSize: 10, color: theme.textMuted },
  vs1Card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.accent + '10', padding: 14, borderRadius: theme.borderRadius.md, marginTop: 12 },
  vs1Text: { fontSize: 13, color: theme.textSecondary },
  
  // Financial Card
  financialCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, ...theme.shadows.card },
  financialMain: { alignItems: 'center', marginBottom: 16 },
  financialBadge: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: theme.borderRadius.lg, marginBottom: 8 },
  financialValue: { fontSize: 28, fontWeight: '700' },
  financialLabel: { fontSize: 13, color: theme.textMuted },
  financialDetails: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  financialDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  financialDetailText: { fontSize: 13, color: theme.textSecondary },
  
  // Compare Button
  compareButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, borderWidth: 1, borderColor: theme.primary + '30', ...theme.shadows.card },
  compareButtonText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginLeft: 12 },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, marginBottom: 24, maxWidth: 260 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: theme.borderRadius.md },
  emptyButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
