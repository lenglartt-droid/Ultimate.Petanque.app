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
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { ChallengeType } from '@/services/mockData';
import { GameFormat } from '@/constants/config';
import Svg, { Circle, Line, Rect, Path, G, Text as SvgText } from 'react-native-svg';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

// Evolution chart helper
function getEvolutionData(matches: any[], timeFilter: TimeFilter): { label: string; winRate: number; matches: number }[] {
  return getTimeBasedEvolutionData(matches, timeFilter, (periodMatches) => {
    const wins = periodMatches.filter(m => m.winner === 'A').length;
    return periodMatches.length > 0 ? Math.round((wins / periodMatches.length) * 100) : 0;
  });
}

// Shooting evolution helper
function getShootingEvolutionData(
  matches: any[], 
  challenges: any[], 
  timeFilter: TimeFilter,
  includeChallenges: boolean
): { label: string; tirRate: number; count: number }[] {
  return getTimeBasedEvolutionData(
    [...matches, ...challenges.map(c => ({ ...c, isChallenge: true }))],
    timeFilter,
    (periodItems) => {
      let totalTirs = 0;
      let totalSuccess = 0;
      
      periodItems.forEach(item => {
        if (item.isChallenge) {
          // Challenge data
          if (includeChallenges && item.type !== 'precision') {
            totalTirs += item.totalShots || 0;
            totalSuccess += item.successCount || 0;
          }
        } else {
          // Match data
          if (item.playerActions) {
            item.playerActions.filter((pa: any) => pa.team === 'A').forEach((pa: any) => {
              totalTirs += pa.actions.tirs;
              totalSuccess += pa.actions.tirsSuccess;
            });
          }
        }
      });
      
      return totalTirs > 0 ? Math.round((totalSuccess / totalTirs) * 100) : 0;
    },
    (periodItems) => {
      let count = 0;
      periodItems.forEach(item => {
        if (item.isChallenge) {
          if (includeChallenges && item.type !== 'precision') count++;
        } else {
          if (item.playerActions?.some((pa: any) => pa.team === 'A' && pa.actions.tirs > 0)) count++;
        }
      });
      return count;
    }
  );
}

// Generic time-based evolution helper
function getTimeBasedEvolutionData<T>(
  items: any[], 
  timeFilter: TimeFilter,
  valueCalculator: (periodItems: any[]) => number,
  countCalculator?: (periodItems: any[]) => number
): T[] {
  if (items.length === 0) return [];
  
  const now = new Date();
  let periods: { start: Date; end: Date; label: string }[] = [];
  
  switch (timeFilter) {
    case 'today':
      // Show by hour for today
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now);
        start.setHours(now.getHours() - i * 4, 0, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + 4);
        periods.push({
          start,
          end,
          label: `${start.getHours()}h`,
        });
      }
      break;
    case 'week':
      // Show by day for week
      for (let i = 6; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - i);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        periods.push({
          start,
          end,
          label: start.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3),
        });
      }
      break;
    case 'month':
      // Show by week for month
      for (let i = 3; i >= 0; i--) {
        const start = new Date(now);
        start.setDate(now.getDate() - i * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        periods.push({
          start,
          end,
          label: `S${4 - i}`,
        });
      }
      break;
    case 'year':
      // Show by month for year
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
    default: // all
      // Show by month for all time (last 6 months)
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        periods.push({
          start,
          end,
          label: start.toLocaleDateString('fr-FR', { month: 'short' }).slice(0, 3),
        });
      }
  }
  
  return periods.map(period => {
    const periodItems = items.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= period.start && itemDate < period.end;
    });
    const value = valueCalculator(periodItems);
    const count = countCalculator ? countCalculator(periodItems) : periodItems.length;
    return {
      label: period.label,
      winRate: value,
      tirRate: value,
      matches: count,
      count,
    } as T;
  });
}

// Challenge configuration
const CHALLENGE_CONFIG = {
  '10_tirs': { name: '10 Tirs', icon: 'gps-fixed' as const, color: '#F97316' },
  '10_tirs_sautee': { name: 'Tirs Sautée', icon: 'sports' as const, color: '#3B82F6' },
  'precision': { name: 'Précision', icon: 'stars' as const, color: '#F59E0B' },
};

// Time filter types
type TimeFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type TabType = 'overview' | 'matches' | 'skills' | 'duration' | 'challenges' | 'financial';

const TIME_FILTERS: { id: TimeFilter; label: string; icon: string }[] = [
  { id: 'today', label: "Aujourd'hui", icon: 'today' },
  { id: 'week', label: 'Semaine', icon: 'date-range' },
  { id: 'month', label: 'Mois', icon: 'calendar-today' },
  { id: 'year', label: 'Année', icon: 'event' },
  { id: 'all', label: 'Tout', icon: 'all-inclusive' },
];

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'overview', label: 'Aperçu', icon: 'dashboard' },
  { id: 'matches', label: 'Matchs', icon: 'sports' },
  { id: 'skills', label: 'Technique', icon: 'gps-fixed' },
  { id: 'duration', label: 'Durée', icon: 'timer' },
  { id: 'challenges', label: 'Défis', icon: 'emoji-events' },
  { id: 'financial', label: 'Finance', icon: 'account-balance-wallet' },
];

// Helper function to filter by time
function filterByTime<T extends { date: string }>(items: T[], filter: TimeFilter): T[] {
  if (filter === 'all') return items;
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let startDate: Date;
  switch (filter) {
    case 'today':
      startDate = startOfDay;
      break;
    case 'week':
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(startOfDay);
      startDate.setDate(startDate.getDate() - diff);
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

// Progress Ring Component
function ProgressRing({ 
  value, 
  size = 80,
  strokeWidth = 6,
  color = theme.primary,
  backgroundColor = theme.border,
}: { 
  value: number; 
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={backgroundColor}
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
  );
}

// Stat Card Component
function StatCard({ 
  icon, 
  iconColor, 
  label, 
  value, 
  subValue,
  trend,
}: { 
  icon: string; 
  iconColor: string; 
  label: string; 
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statCardIcon, { backgroundColor: iconColor + '15' }]}>
        <MaterialIcons name={icon as any} size={20} color={iconColor} />
      </View>
      <Text style={styles.statCardLabel}>{label}</Text>
      <View style={styles.statCardValueRow}>
        <Text style={styles.statCardValue}>{value}</Text>
        {trend && (
          <MaterialIcons 
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'trending-flat'} 
            size={16} 
            color={trend === 'up' ? theme.success : trend === 'down' ? theme.error : theme.textMuted} 
          />
        )}
      </View>
      {subValue && <Text style={styles.statCardSubValue}>{subValue}</Text>}
    </View>
  );
}

// Mini Bar Chart
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <View style={styles.miniBarChart}>
      {data.map((value, index) => (
        <View 
          key={index} 
          style={[
            styles.miniBar, 
            { 
              height: Math.max((value / max) * 40, 2),
              backgroundColor: color,
              opacity: 0.3 + (index / data.length) * 0.7,
            }
          ]} 
        />
      ))}
    </View>
  );
}

// Evolution Line Chart
function EvolutionChart({ 
  data, 
  width = screenWidth - 64, 
  height = 180,
  valueKey = 'winRate',
  countKey = 'matches',
  color = theme.primary,
  label = 'Taux de victoire',
}: { 
  data: { label: string; winRate?: number; tirRate?: number; matches?: number; count?: number }[];
  valueKey?: 'winRate' | 'tirRate';
  countKey?: 'matches' | 'count';
  color?: string;
  label?: string;
  width?: number;
  height?: number;
}) {
  if (data.length === 0 || data.every(d => (d[countKey] || 0) === 0)) {
    return (
      <View style={[styles.evolutionChartEmpty, { height }]}>
        <MaterialIcons name="show-chart" size={40} color={theme.textMuted} />
        <Text style={styles.evolutionChartEmptyText}>Pas assez de données</Text>
      </View>
    );
  }

  const padding = { top: 20, right: 16, bottom: 30, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const maxValue = 100;
  const minValue = 0;
  
  // Calculate points
  const points = data.map((d, i) => {
    const value = d[valueKey] || 0;
    const count = d[countKey] || 0;
    return {
      x: padding.left + (i / (data.length - 1 || 1)) * chartWidth,
      y: padding.top + chartHeight - ((value - minValue) / (maxValue - minValue)) * chartHeight,
      value,
      matches: count,
      label: d.label,
    };
  });
  
  // Create smooth path
  const createSmoothPath = () => {
    if (points.length < 2) {
      const p = points[0];
      return `M ${p.x} ${p.y}`;
    }
    
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
  
  // Create area path
  const createAreaPath = () => {
    const linePath = createSmoothPath();
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    return `${linePath} L ${lastPoint.x} ${padding.top + chartHeight} L ${firstPoint.x} ${padding.top + chartHeight} Z`;
  };
  
  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];
  
  return (
    <View style={styles.evolutionChart}>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {yLabels.map((val, i) => {
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
                strokeDasharray={val === 50 ? "0" : "4,4"}
                opacity={val === 50 ? 0.8 : 0.4}
              />
              <SvgText
                x={padding.left - 8}
                y={y + 4}
                fontSize={10}
                fill={theme.textMuted}
                textAnchor="end"
              >
                {val}%
              </SvgText>
            </G>
          );
        })}
        
        {/* Area fill */}
        <Path
          d={createAreaPath()}
          fill={color}
          opacity={0.1}
        />
        
        {/* Line */}
        <Path
          d={createSmoothPath()}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Data points */}
        {points.map((point, i) => (
          <G key={i}>
            {/* Outer circle */}
            <Circle
              cx={point.x}
              cy={point.y}
              r={point.matches > 0 ? 6 : 4}
              fill={theme.surface}
              stroke={point.matches > 0 ? color : theme.textMuted}
              strokeWidth={2}
            />
            {/* Inner circle for active points */}
            {point.matches > 0 && (
              <Circle
                cx={point.x}
                cy={point.y}
                r={3}
                fill={color}
              />
            )}
            {/* X-axis labels */}
            <SvgText
              x={point.x}
              y={height - 8}
              fontSize={10}
              fill={theme.textSecondary}
              textAnchor="middle"
              fontWeight="500"
            >
              {point.label}
            </SvgText>
          </G>
        ))}
      </Svg>
      
      {/* Legend */}
      <View style={styles.evolutionLegend}>
        <View style={styles.evolutionLegendItem}>
          <View style={[styles.evolutionLegendDot, { backgroundColor: color }]} />
          <Text style={styles.evolutionLegendText}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, matches, challengeStats, challenges, tournaments } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showTimeFilterModal, setShowTimeFilterModal] = useState(false);
  const [includeChallengesInStats, setIncludeChallengesInStats] = useState(false);

  // Filter data by time
  const filteredMatches = filterByTime(matches, timeFilter);
  
  // Evolution data
  const evolutionData = useMemo(() => {
    return getEvolutionData(matches, timeFilter);
  }, [matches, timeFilter]);
  
  // Shooting evolution data
  const shootingEvolutionData = useMemo(() => {
    return getShootingEvolutionData(matches, challenges, timeFilter, includeChallengesInStats);
  }, [matches, challenges, timeFilter, includeChallengesInStats]);
  const filteredChallenges = filterByTime(challenges, timeFilter);
  const tournamentMatches = filteredMatches.filter(m => m.mode === 'Tournoi');
  const trainingMatches = filteredMatches.filter(m => m.mode === 'Entraînement');

  // Calculate filtered stats
  const stats = useMemo(() => {
    const wins = filteredMatches.filter(m => m.winner === 'A').length;
    const total = filteredMatches.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    
    const tournamentWins = tournamentMatches.filter(m => m.winner === 'A').length;
    const trainingWins = trainingMatches.filter(m => m.winner === 'A').length;
    
    // Points
    let totalPointsFor = 0, totalPointsAgainst = 0;
    filteredMatches.forEach(match => {
      totalPointsFor += match.teamA.score;
      totalPointsAgainst += match.teamB.score;
    });

    // Actions from matches
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

    // Challenge shots
    const challengeTirs = filteredChallenges
      .filter(c => c.type !== 'precision')
      .reduce((acc, c) => acc + (c.totalShots || 0), 0);
    const challengeTirsSuccess = filteredChallenges
      .filter(c => c.type !== 'precision')
      .reduce((acc, c) => acc + (c.successCount || 0), 0);
    const challengeCarreaux = filteredChallenges
      .filter(c => c.type !== 'precision')
      .reduce((acc, c) => acc + (c.carreauCount || 0), 0);

    const totalTirs = includeChallengesInStats ? matchTirs + challengeTirs : matchTirs;
    const totalTirsSuccess = includeChallengesInStats ? matchTirsSuccess + challengeTirsSuccess : matchTirsSuccess;
    const totalCarreaux = includeChallengesInStats ? matchCarreaux + challengeCarreaux : matchCarreaux;

    const tirRate = totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : 0;
    const pointRate = matchPoints > 0 ? Math.round((matchPointsSuccess / matchPoints) * 100) : 0;
    const carreauRate = totalTirs > 0 ? Math.round((totalCarreaux / totalTirs) * 100) : 0;

    return {
      total,
      wins,
      losses: total - wins,
      winRate,
      tournamentMatches: tournamentMatches.length,
      tournamentWins,
      tournamentWinRate: tournamentMatches.length > 0 ? Math.round((tournamentWins / tournamentMatches.length) * 100) : 0,
      trainingMatches: trainingMatches.length,
      trainingWins,
      trainingWinRate: trainingMatches.length > 0 ? Math.round((trainingWins / trainingMatches.length) * 100) : 0,
      totalPointsFor,
      totalPointsAgainst,
      pointDiff: totalPointsFor - totalPointsAgainst,
      tirRate,
      pointRate,
      carreauRate,
      totalTirs,
      totalTirsSuccess,
      totalCarreaux,
      matchPoints,
      matchPointsSuccess,
      challengeTirs,
      challengeTirsSuccess,
    };
  }, [filteredMatches, filteredChallenges, includeChallengesInStats]);

  // Challenge stats
  const challengeData = useMemo(() => {
    const byType: Record<ChallengeType, { count: number; avgSuccess: number; bestScore: number; totalSuccess: number }> = {
      '10_tirs': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
      '10_tirs_sautee': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
      'precision': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
    };

    filteredChallenges.forEach(c => {
      const type = byType[c.type];
      type.count++;
      
      if (c.type === 'precision') {
        const score = c.totalPoints || 0;
        type.totalSuccess += score;
        type.bestScore = Math.max(type.bestScore, score);
      } else {
        type.totalSuccess += (c.successRate || 0);
        type.bestScore = Math.max(type.bestScore, c.successRate || 0);
      }
    });

    Object.keys(byType).forEach(key => {
      const t = byType[key as ChallengeType];
      t.avgSuccess = t.count > 0 ? Math.round(t.totalSuccess / t.count) : 0;
    });

    // 1v1 stats
    const opponent1v1: Record<string, { name: string; wins: number; losses: number; draws: number; total: number }> = {};
    filteredChallenges
      .filter(c => c.mode === '1v1' && c.opponentId && c.opponentName)
      .forEach(c => {
        const oppId = c.opponentId!;
        if (!opponent1v1[oppId]) {
          opponent1v1[oppId] = { name: c.opponentName!, wins: 0, losses: 0, draws: 0, total: 0 };
        }
        opponent1v1[oppId].total++;
        if (c.winner === 'player') opponent1v1[oppId].wins++;
        else if (c.winner === 'opponent') opponent1v1[oppId].losses++;
        else opponent1v1[oppId].draws++;
      });

    return {
      total: filteredChallenges.length,
      byType,
      opponents: Object.entries(opponent1v1)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total - a.total),
      recent: [...filteredChallenges].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    };
  }, [filteredChallenges]);

  // Duration stats
  const durationStats = useMemo(() => {
    // Match duration stats
    const matchesWithDuration = filteredMatches.filter(m => m.duration && m.duration > 0);
    const totalMatchDuration = matchesWithDuration.reduce((sum, m) => sum + m.duration, 0);
    const avgMatchDuration = matchesWithDuration.length > 0 ? Math.round(totalMatchDuration / matchesWithDuration.length) : 0;
    
    // Find longest and shortest matches
    let longestMatch = { duration: 0, id: '', format: '' as GameFormat };
    let shortestMatch = { duration: Infinity, id: '', format: '' as GameFormat };
    matchesWithDuration.forEach(m => {
      if (m.duration > longestMatch.duration) {
        longestMatch = { duration: m.duration, id: m.id, format: m.format };
      }
      if (m.duration < shortestMatch.duration) {
        shortestMatch = { duration: m.duration, id: m.id, format: m.format };
      }
    });
    if (shortestMatch.duration === Infinity) shortestMatch.duration = 0;
    
    // Duration by format
    const durationByFormat: Record<string, { count: number; total: number; avg: number }> = {
      'Tête-à-tête': { count: 0, total: 0, avg: 0 },
      'Doublette': { count: 0, total: 0, avg: 0 },
      'Triplette': { count: 0, total: 0, avg: 0 },
    };
    matchesWithDuration.forEach(m => {
      if (durationByFormat[m.format]) {
        durationByFormat[m.format].count++;
        durationByFormat[m.format].total += m.duration;
      }
    });
    Object.keys(durationByFormat).forEach(format => {
      const data = durationByFormat[format];
      data.avg = data.count > 0 ? Math.round(data.total / data.count) : 0;
    });
    
    // Duration by mode
    const trainingWithDuration = matchesWithDuration.filter(m => m.mode === 'Entraînement');
    const tournamentWithDuration = matchesWithDuration.filter(m => m.mode === 'Tournoi');
    const avgTrainingDuration = trainingWithDuration.length > 0 
      ? Math.round(trainingWithDuration.reduce((sum, m) => sum + m.duration, 0) / trainingWithDuration.length) : 0;
    const avgTournamentDuration = tournamentWithDuration.length > 0 
      ? Math.round(tournamentWithDuration.reduce((sum, m) => sum + m.duration, 0) / tournamentWithDuration.length) : 0;
    
    // Mène duration stats
    const allMenes: { duration: number; matchId: string; meneNum: number }[] = [];
    filteredMatches.forEach(m => {
      if (m.menes) {
        m.menes.forEach((mene, idx) => {
          if (mene.duration && mene.duration > 0) {
            allMenes.push({ duration: mene.duration, matchId: m.id, meneNum: idx + 1 });
          }
        });
      }
    });
    const totalMeneDuration = allMenes.reduce((sum, m) => sum + m.duration, 0);
    const avgMeneDuration = allMenes.length > 0 ? Math.round(totalMeneDuration / allMenes.length) : 0;
    const longestMene = allMenes.length > 0 
      ? allMenes.reduce((a, b) => a.duration > b.duration ? a : b) 
      : { duration: 0, matchId: '', meneNum: 0 };
    const shortestMene = allMenes.length > 0 
      ? allMenes.reduce((a, b) => a.duration < b.duration ? a : b) 
      : { duration: 0, matchId: '', meneNum: 0 };
    
    // Mènes over 1 minute count
    const menesOver1Min = allMenes.filter(m => m.duration > 60).length;
    const menesOver1MinPercent = allMenes.length > 0 ? Math.round((menesOver1Min / allMenes.length) * 100) : 0;
    
    return {
      totalMatches: matchesWithDuration.length,
      avgMatchDuration,
      totalMatchDuration,
      longestMatch,
      shortestMatch,
      durationByFormat,
      avgTrainingDuration,
      avgTournamentDuration,
      totalMenes: allMenes.length,
      avgMeneDuration,
      longestMene,
      shortestMene,
      menesOver1Min,
      menesOver1MinPercent,
    };
  }, [filteredMatches]);

  // Financial stats
  const financialData = useMemo(() => {
    const completed = tournaments.filter(t => t.status === 'Terminé');
    const totalCost = completed.reduce((sum, t) => sum + (t.registrationCost || 0), 0);
    const totalGain = completed.reduce((sum, t) => sum + (t.prizeWon || 0), 0);
    return {
      totalCost,
      totalGain,
      balance: totalGain - totalCost,
      tournamentsWithGain: completed.filter(t => t.prizeWon && t.prizeWon > 0).length,
      completedCount: completed.length,
    };
  }, [tournaments]);

  // Terrain stats
  const terrainStats = useMemo(() => {
    const byType: Record<string, { matches: number; wins: number; winRate: number }> = {};
    ['Stabilisé', 'Graviers', 'Sable', 'Cailloux', 'Terre battue'].forEach(type => {
      byType[type] = { matches: 0, wins: 0, winRate: 0 };
    });
    
    filteredMatches.forEach(match => {
      if (match.tournamentId) {
        const tournament = tournaments.find(t => t.id === match.tournamentId);
        if (tournament?.terrainType && byType[tournament.terrainType]) {
          byType[tournament.terrainType].matches++;
          if (match.winner === 'A') byType[tournament.terrainType].wins++;
        }
      }
    });
    
    Object.keys(byType).forEach(type => {
      const s = byType[type];
      s.winRate = s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0;
    });
    
    return byType;
  }, [filteredMatches, tournaments]);

  const currentTimeFilter = TIME_FILTERS.find(f => f.id === timeFilter);

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
          <View style={styles.headerActions}>
            <Pressable 
              style={styles.headerButton}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/player/compare');
              }}
            >
              <MaterialIcons name="compare-arrows" size={22} color={theme.primary} />
            </Pressable>
            <Pressable 
              style={styles.timeFilterButton}
              onPress={() => setShowTimeFilterModal(true)}
            >
              <MaterialIcons name={currentTimeFilter?.icon as any || 'date-range'} size={18} color={theme.primary} />
              <Text style={styles.timeFilterButtonText}>{currentTimeFilter?.label}</Text>
              <MaterialIcons name="expand-more" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Tab Bar */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map(tab => (
            <Pressable
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab.id);
              }}
            >
              <MaterialIcons 
                name={tab.icon as any} 
                size={18} 
                color={activeTab === tab.id ? '#FFF' : theme.textSecondary} 
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Time Filter Modal */}
      <Modal
        visible={showTimeFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeFilterModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTimeFilterModal(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Période</Text>
            {TIME_FILTERS.map(filter => (
              <Pressable
                key={filter.id}
                style={[styles.modalOption, timeFilter === filter.id && styles.modalOptionActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTimeFilter(filter.id);
                  setShowTimeFilterModal(false);
                }}
              >
                <MaterialIcons 
                  name={filter.icon as any} 
                  size={20} 
                  color={timeFilter === filter.id ? theme.primary : theme.textSecondary} 
                />
                <Text style={[styles.modalOptionText, timeFilter === filter.id && styles.modalOptionTextActive]}>
                  {filter.label}
                </Text>
                {timeFilter === filter.id && (
                  <MaterialIcons name="check" size={20} color={theme.primary} />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Quick Stats Grid */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <View style={styles.quickStatsGrid}>
                <View style={styles.mainStatCard}>
                  <View style={styles.mainStatRing}>
                    <ProgressRing value={stats.winRate} size={100} strokeWidth={8} color={theme.primary} />
                    <View style={styles.mainStatRingCenter}>
                      <Text style={styles.mainStatValue}>{stats.winRate}%</Text>
                      <Text style={styles.mainStatLabel}>Victoires</Text>
                    </View>
                  </View>
                  <View style={styles.mainStatDetails}>
                    <View style={styles.mainStatRow}>
                      <View style={[styles.mainStatDot, { backgroundColor: theme.success }]} />
                      <Text style={styles.mainStatDetailText}>{stats.wins} gagnés</Text>
                    </View>
                    <View style={styles.mainStatRow}>
                      <View style={[styles.mainStatDot, { backgroundColor: theme.error }]} />
                      <Text style={styles.mainStatDetailText}>{stats.losses} perdus</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.sideStats}>
                  <StatCard 
                    icon="emoji-events" 
                    iconColor={theme.carreauColor} 
                    label="Tournois" 
                    value={stats.tournamentMatches}
                    subValue={`${stats.tournamentWinRate}% victoires`}
                  />
                  <StatCard 
                    icon="fitness-center" 
                    iconColor={theme.primary} 
                    label="Entraînement" 
                    value={stats.trainingMatches}
                    subValue={`${stats.trainingWinRate}% victoires`}
                  />
                </View>
              </View>
            </Animated.View>

            {/* Skills Summary */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <Text style={styles.sectionTitle}>Performance technique</Text>
              <View style={styles.skillsGrid}>
                <View style={[styles.skillCard, { borderLeftColor: theme.tirColor }]}>
                  <View style={styles.skillHeader}>
                    <MaterialIcons name="gps-fixed" size={20} color={theme.tirColor} />
                    <Text style={styles.skillLabel}>Tir</Text>
                  </View>
                  <Text style={[styles.skillValue, { color: theme.tirColor }]}>{stats.tirRate}%</Text>
                  <Text style={styles.skillDetail}>{stats.totalTirsSuccess}/{stats.totalTirs}</Text>
                </View>
                <View style={[styles.skillCard, { borderLeftColor: theme.pointColor }]}>
                  <View style={styles.skillHeader}>
                    <MaterialIcons name="adjust" size={20} color={theme.pointColor} />
                    <Text style={styles.skillLabel}>Point</Text>
                  </View>
                  <Text style={[styles.skillValue, { color: theme.pointColor }]}>{stats.pointRate}%</Text>
                  <Text style={styles.skillDetail}>{stats.matchPointsSuccess}/{stats.matchPoints}</Text>
                </View>
                <View style={[styles.skillCard, { borderLeftColor: theme.carreauColor }]}>
                  <View style={styles.skillHeader}>
                    <MaterialIcons name="stars" size={20} color={theme.carreauColor} />
                    <Text style={styles.skillLabel}>Carreau</Text>
                  </View>
                  <Text style={[styles.skillValue, { color: theme.carreauColor }]}>{stats.carreauRate}%</Text>
                  <Text style={styles.skillDetail}>{stats.totalCarreaux} réussis</Text>
                </View>
              </View>
            </Animated.View>

            {/* Evolution Chart */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
              <Text style={styles.sectionTitle}>Évolution des performances</Text>
              <View style={styles.evolutionChartCard}>
                <EvolutionChart data={evolutionData} />
                {/* Stats summary under chart */}
                {evolutionData.some(d => d.matches > 0) && (
                  <View style={styles.evolutionSummary}>
                    {evolutionData.filter(d => d.matches > 0).length > 1 && (
                      <>
                        <View style={styles.evolutionSummaryStat}>
                          <Text style={styles.evolutionSummaryLabel}>Tendance</Text>
                          {(() => {
                            const validData = evolutionData.filter(d => d.matches > 0);
                            if (validData.length < 2) return <Text style={styles.evolutionSummaryValue}>—</Text>;
                            const first = validData[0].winRate;
                            const last = validData[validData.length - 1].winRate;
                            const diff = last - first;
                            return (
                              <View style={styles.evolutionTrend}>
                                <MaterialIcons 
                                  name={diff > 0 ? 'trending-up' : diff < 0 ? 'trending-down' : 'trending-flat'} 
                                  size={18} 
                                  color={diff > 0 ? theme.success : diff < 0 ? theme.error : theme.textMuted} 
                                />
                                <Text style={[
                                  styles.evolutionSummaryValue,
                                  { color: diff > 0 ? theme.success : diff < 0 ? theme.error : theme.textMuted }
                                ]}>
                                  {diff > 0 ? '+' : ''}{diff}%
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                        <View style={styles.evolutionSummaryDivider} />
                      </>
                    )}
                    <View style={styles.evolutionSummaryStat}>
                      <Text style={styles.evolutionSummaryLabel}>Meilleure période</Text>
                      <Text style={styles.evolutionSummaryValue}>
                        {(() => {
                          const validData = evolutionData.filter(d => d.matches > 0);
                          if (validData.length === 0) return '—';
                          const best = validData.reduce((a, b) => a.winRate > b.winRate ? a : b);
                          return `${best.label} (${best.winRate}%)`;
                        })()}
                      </Text>
                    </View>
                    <View style={styles.evolutionSummaryDivider} />
                    <View style={styles.evolutionSummaryStat}>
                      <Text style={styles.evolutionSummaryLabel}>Matchs joués</Text>
                      <Text style={styles.evolutionSummaryValue}>
                        {evolutionData.reduce((sum, d) => sum + d.matches, 0)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Points Balance */}
            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <Text style={styles.sectionTitle}>Balance des points</Text>
              <View style={styles.pointsBalanceCard}>
                <View style={styles.pointsBalanceItem}>
                  <MaterialIcons name="add-circle" size={24} color={theme.success} />
                  <Text style={[styles.pointsBalanceValue, { color: theme.success }]}>{stats.totalPointsFor}</Text>
                  <Text style={styles.pointsBalanceLabel}>Marqués</Text>
                </View>
                <View style={styles.pointsBalanceDivider}>
                  <View style={[
                    styles.pointsBalanceBadge,
                    { backgroundColor: stats.pointDiff >= 0 ? theme.success + '15' : theme.error + '15' }
                  ]}>
                    <Text style={[
                      styles.pointsBalanceDiffText,
                      { color: stats.pointDiff >= 0 ? theme.success : theme.error }
                    ]}>
                      {stats.pointDiff > 0 ? '+' : ''}{stats.pointDiff}
                    </Text>
                  </View>
                </View>
                <View style={styles.pointsBalanceItem}>
                  <MaterialIcons name="remove-circle" size={24} color={theme.error} />
                  <Text style={[styles.pointsBalanceValue, { color: theme.error }]}>{stats.totalPointsAgainst}</Text>
                  <Text style={styles.pointsBalanceLabel}>Encaissés</Text>
                </View>
              </View>
            </Animated.View>

            {/* Challenges Preview */}
            {challengeData.total > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Défis récents</Text>
                  <Pressable onPress={() => setActiveTab('challenges')}>
                    <Text style={styles.sectionLink}>Voir tout</Text>
                  </Pressable>
                </View>
                <View style={styles.challengePreviewCard}>
                  {challengeData.recent.slice(0, 3).map((challenge, index) => {
                    const config = CHALLENGE_CONFIG[challenge.type];
                    const score = challenge.type === 'precision' 
                      ? `${challenge.totalPoints || 0}/100` 
                      : `${challenge.successRate || 0}%`;
                    return (
                      <View key={challenge.id} style={[
                        styles.challengePreviewItem,
                        index < 2 && styles.challengePreviewItemBorder
                      ]}>
                        <View style={[styles.challengePreviewIcon, { backgroundColor: config.color + '15' }]}>
                          <MaterialIcons name={config.icon} size={18} color={config.color} />
                        </View>
                        <View style={styles.challengePreviewInfo}>
                          <Text style={styles.challengePreviewName}>{config.name}</Text>
                          <Text style={styles.challengePreviewDate}>
                            {new Date(challenge.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </Text>
                        </View>
                        <Text style={[styles.challengePreviewScore, { color: config.color }]}>{score}</Text>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            )}
          </>
        )}

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <>
            {/* Match Types */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <View style={styles.matchTypesGrid}>
                {/* Tournaments */}
                <View style={styles.matchTypeCard}>
                  <View style={[styles.matchTypeHeader, { backgroundColor: theme.carreauColor + '10' }]}>
                    <MaterialIcons name="emoji-events" size={28} color={theme.carreauColor} />
                    <Text style={styles.matchTypeTitle}>Tournois</Text>
                  </View>
                  <View style={styles.matchTypeBody}>
                    <View style={styles.matchTypeMainStat}>
                      <Text style={styles.matchTypeValue}>{stats.tournamentMatches}</Text>
                      <Text style={styles.matchTypeLabel}>matchs</Text>
                    </View>
                    <View style={styles.matchTypeStats}>
                      <View style={styles.matchTypeStatRow}>
                        <Text style={[styles.matchTypeStatValue, { color: theme.success }]}>{stats.tournamentWins}</Text>
                        <Text style={styles.matchTypeStatLabel}>V</Text>
                      </View>
                      <View style={styles.matchTypeStatRow}>
                        <Text style={[styles.matchTypeStatValue, { color: theme.error }]}>{stats.tournamentMatches - stats.tournamentWins}</Text>
                        <Text style={styles.matchTypeStatLabel}>D</Text>
                      </View>
                      <View style={[
                        styles.matchTypeWinRate,
                        { backgroundColor: stats.tournamentWinRate >= 50 ? theme.success + '15' : theme.error + '15' }
                      ]}>
                        <Text style={[
                          styles.matchTypeWinRateText,
                          { color: stats.tournamentWinRate >= 50 ? theme.success : theme.error }
                        ]}>{stats.tournamentWinRate}%</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Training */}
                <View style={styles.matchTypeCard}>
                  <View style={[styles.matchTypeHeader, { backgroundColor: theme.primary + '10' }]}>
                    <MaterialIcons name="fitness-center" size={28} color={theme.primary} />
                    <Text style={styles.matchTypeTitle}>Entraînement</Text>
                  </View>
                  <View style={styles.matchTypeBody}>
                    <View style={styles.matchTypeMainStat}>
                      <Text style={styles.matchTypeValue}>{stats.trainingMatches}</Text>
                      <Text style={styles.matchTypeLabel}>matchs</Text>
                    </View>
                    <View style={styles.matchTypeStats}>
                      <View style={styles.matchTypeStatRow}>
                        <Text style={[styles.matchTypeStatValue, { color: theme.success }]}>{stats.trainingWins}</Text>
                        <Text style={styles.matchTypeStatLabel}>V</Text>
                      </View>
                      <View style={styles.matchTypeStatRow}>
                        <Text style={[styles.matchTypeStatValue, { color: theme.error }]}>{stats.trainingMatches - stats.trainingWins}</Text>
                        <Text style={styles.matchTypeStatLabel}>D</Text>
                      </View>
                      <View style={[
                        styles.matchTypeWinRate,
                        { backgroundColor: stats.trainingWinRate >= 50 ? theme.success + '15' : theme.error + '15' }
                      ]}>
                        <Text style={[
                          styles.matchTypeWinRateText,
                          { color: stats.trainingWinRate >= 50 ? theme.success : theme.error }
                        ]}>{stats.trainingWinRate}%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Terrain Performance */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <Text style={styles.sectionTitle}>Performance par terrain</Text>
              <View style={styles.terrainList}>
                {Object.entries(terrainStats).map(([type, data], index) => {
                  const terrainIcons: Record<string, { icon: string; color: string }> = {
                    'Stabilisé': { icon: 'landscape', color: theme.primary },
                    'Graviers': { icon: 'grain', color: theme.warning },
                    'Sable': { icon: 'beach-access', color: '#F59E0B' },
                    'Cailloux': { icon: 'terrain', color: theme.textSecondary },
                    'Terre battue': { icon: 'grass', color: theme.success },
                  };
                  const config = terrainIcons[type] || terrainIcons['Stabilisé'];
                  
                  return (
                    <View key={type} style={styles.terrainItem}>
                      <View style={[styles.terrainIcon, { backgroundColor: config.color + '15' }]}>
                        <MaterialIcons name={config.icon as any} size={20} color={config.color} />
                      </View>
                      <View style={styles.terrainInfo}>
                        <Text style={styles.terrainName}>{type}</Text>
                        <Text style={styles.terrainMatches}>{data.matches} match{data.matches !== 1 ? 's' : ''}</Text>
                      </View>
                      {data.matches > 0 ? (
                        <View style={styles.terrainStats}>
                          <Text style={styles.terrainRecord}>
                            <Text style={{ color: theme.success }}>{data.wins}</Text>
                            <Text style={{ color: theme.textMuted }}> - </Text>
                            <Text style={{ color: theme.error }}>{data.matches - data.wins}</Text>
                          </Text>
                          <View style={[
                            styles.terrainWinRate,
                            { backgroundColor: data.winRate >= 50 ? theme.success + '15' : theme.error + '15' }
                          ]}>
                            <Text style={[
                              styles.terrainWinRateText,
                              { color: data.winRate >= 50 ? theme.success : theme.error }
                            ]}>{data.winRate}%</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.terrainNoData}>—</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Opponents */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
              <Text style={styles.sectionTitle}>Adversaires fréquents</Text>
              {userStats.recentOpponents.length > 0 ? (
                <View style={styles.opponentsList}>
                  {userStats.recentOpponents.slice(0, 5).map((opponent, index) => {
                    const total = opponent.wins + opponent.losses;
                    const winRate = Math.round((opponent.wins / total) * 100);
                    return (
                      <View key={opponent.id} style={styles.opponentItem}>
                        <View style={styles.opponentAvatar}>
                          <Text style={styles.opponentInitials}>
                            {opponent.name.split(' ').map(n => n[0]).join('')}
                          </Text>
                        </View>
                        <View style={styles.opponentInfo}>
                          <Text style={styles.opponentName}>{opponent.name}</Text>
                          <Text style={styles.opponentMatches}>{total} confrontations</Text>
                        </View>
                        <View style={styles.opponentStats}>
                          <Text style={styles.opponentRecord}>
                            <Text style={{ color: theme.success }}>{opponent.wins}</Text>
                            <Text style={{ color: theme.textMuted }}> - </Text>
                            <Text style={{ color: theme.error }}>{opponent.losses}</Text>
                          </Text>
                          <View style={[
                            styles.opponentWinRate,
                            { backgroundColor: winRate >= 50 ? theme.success + '15' : theme.error + '15' }
                          ]}>
                            <Text style={[
                              styles.opponentWinRateText,
                              { color: winRate >= 50 ? theme.success : theme.error }
                            ]}>{winRate}%</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="people" size={40} color={theme.textMuted} />
                  <Text style={styles.emptyText}>Jouez plus de matchs pour voir vos adversaires</Text>
                </View>
              )}
            </Animated.View>
          </>
        )}

        {/* SKILLS TAB */}
        {activeTab === 'skills' && (
          <>
            {/* Include Challenges Toggle */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <Pressable
                style={[styles.toggleCard, includeChallengesInStats && styles.toggleCardActive]}
                onPress={() => setIncludeChallengesInStats(!includeChallengesInStats)}
              >
                <MaterialIcons 
                  name={includeChallengesInStats ? 'check-box' : 'check-box-outline-blank'} 
                  size={24} 
                  color={includeChallengesInStats ? theme.primary : theme.textSecondary} 
                />
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleTitle, includeChallengesInStats && { color: theme.primary }]}>
                    Inclure les défis
                  </Text>
                  <Text style={styles.toggleSubtitle}>
                    {includeChallengesInStats 
                      ? `+${stats.challengeTirs} tirs ajoutés des défis`
                      : 'Statistiques des matchs uniquement'}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Skills Cards */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              {/* Tir */}
              <View style={styles.bigSkillCard}>
                <View style={styles.bigSkillHeader}>
                  <View style={[styles.bigSkillIcon, { backgroundColor: theme.tirColor + '15' }]}>
                    <MaterialIcons name="gps-fixed" size={28} color={theme.tirColor} />
                  </View>
                  <View style={styles.bigSkillTitleArea}>
                    <Text style={styles.bigSkillTitle}>Tir</Text>
                    <Text style={styles.bigSkillSubtitle}>Réussite au tir</Text>
                  </View>
                  <View style={styles.bigSkillRing}>
                    <ProgressRing value={stats.tirRate} size={70} strokeWidth={6} color={theme.tirColor} />
                    <Text style={[styles.bigSkillRingValue, { color: theme.tirColor }]}>{stats.tirRate}%</Text>
                  </View>
                </View>
                <View style={styles.bigSkillStats}>
                  <View style={styles.bigSkillStat}>
                    <Text style={styles.bigSkillStatValue}>{stats.totalTirsSuccess}</Text>
                    <Text style={styles.bigSkillStatLabel}>Réussis</Text>
                  </View>
                  <View style={styles.bigSkillStatDivider} />
                  <View style={styles.bigSkillStat}>
                    <Text style={styles.bigSkillStatValue}>{stats.totalTirs}</Text>
                    <Text style={styles.bigSkillStatLabel}>Tentés</Text>
                  </View>
                  <View style={styles.bigSkillStatDivider} />
                  <View style={styles.bigSkillStat}>
                    <Text style={[styles.bigSkillStatValue, { color: theme.carreauColor }]}>{stats.carreauRate}%</Text>
                    <Text style={styles.bigSkillStatLabel}>Carreaux</Text>
                  </View>
                </View>
              </View>

              {/* Point */}
              <View style={[styles.bigSkillCard, { marginTop: 12 }]}>
                <View style={styles.bigSkillHeader}>
                  <View style={[styles.bigSkillIcon, { backgroundColor: theme.pointColor + '15' }]}>
                    <MaterialIcons name="adjust" size={28} color={theme.pointColor} />
                  </View>
                  <View style={styles.bigSkillTitleArea}>
                    <Text style={styles.bigSkillTitle}>Point</Text>
                    <Text style={styles.bigSkillSubtitle}>Réussite au point</Text>
                  </View>
                  <View style={styles.bigSkillRing}>
                    <ProgressRing value={stats.pointRate} size={70} strokeWidth={6} color={theme.pointColor} />
                    <Text style={[styles.bigSkillRingValue, { color: theme.pointColor }]}>{stats.pointRate}%</Text>
                  </View>
                </View>
                <View style={styles.bigSkillStats}>
                  <View style={styles.bigSkillStat}>
                    <Text style={styles.bigSkillStatValue}>{stats.matchPointsSuccess}</Text>
                    <Text style={styles.bigSkillStatLabel}>Réussis</Text>
                  </View>
                  <View style={styles.bigSkillStatDivider} />
                  <View style={styles.bigSkillStat}>
                    <Text style={styles.bigSkillStatValue}>{stats.matchPoints}</Text>
                    <Text style={styles.bigSkillStatLabel}>Tentés</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Shooting Evolution Chart */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
              <Text style={styles.sectionTitle}>Évolution du tir</Text>
              <View style={styles.evolutionChartCard}>
                <EvolutionChart 
                  data={shootingEvolutionData} 
                  valueKey="tirRate"
                  countKey="count"
                  color={theme.tirColor}
                  label="Taux de réussite au tir"
                />
                {/* Stats summary under chart */}
                {shootingEvolutionData.some(d => (d.count || 0) > 0) && (
                  <View style={styles.evolutionSummary}>
                    {shootingEvolutionData.filter(d => (d.count || 0) > 0).length > 1 && (
                      <>
                        <View style={styles.evolutionSummaryStat}>
                          <Text style={styles.evolutionSummaryLabel}>Tendance</Text>
                          {(() => {
                            const validData = shootingEvolutionData.filter(d => (d.count || 0) > 0);
                            if (validData.length < 2) return <Text style={styles.evolutionSummaryValue}>—</Text>;
                            const first = validData[0].tirRate || 0;
                            const last = validData[validData.length - 1].tirRate || 0;
                            const diff = last - first;
                            return (
                              <View style={styles.evolutionTrend}>
                                <MaterialIcons 
                                  name={diff > 0 ? 'trending-up' : diff < 0 ? 'trending-down' : 'trending-flat'} 
                                  size={18} 
                                  color={diff > 0 ? theme.success : diff < 0 ? theme.error : theme.textMuted} 
                                />
                                <Text style={[
                                  styles.evolutionSummaryValue,
                                  { color: diff > 0 ? theme.success : diff < 0 ? theme.error : theme.textMuted }
                                ]}>
                                  {diff > 0 ? '+' : ''}{diff}%
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                        <View style={styles.evolutionSummaryDivider} />
                      </>
                    )}
                    <View style={styles.evolutionSummaryStat}>
                      <Text style={styles.evolutionSummaryLabel}>Meilleure période</Text>
                      <Text style={styles.evolutionSummaryValue}>
                        {(() => {
                          const validData = shootingEvolutionData.filter(d => (d.count || 0) > 0);
                          if (validData.length === 0) return '—';
                          const best = validData.reduce((a, b) => (a.tirRate || 0) > (b.tirRate || 0) ? a : b);
                          return `${best.label} (${best.tirRate}%)`;
                        })()}
                      </Text>
                    </View>
                    <View style={styles.evolutionSummaryDivider} />
                    <View style={styles.evolutionSummaryStat}>
                      <Text style={styles.evolutionSummaryLabel}>Sessions</Text>
                      <Text style={styles.evolutionSummaryValue}>
                        {shootingEvolutionData.reduce((sum, d) => sum + (d.count || 0), 0)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Stats by Role */}
            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <Text style={styles.sectionTitle}>Performance par rôle</Text>
              <View style={styles.roleStatsCard}>
                {(() => {
                  // Calculate stats by role
                  const roleStats: Record<string, { matches: number; wins: number; tirs: number; tirsSuccess: number }> = {
                    'Pointeur': { matches: 0, wins: 0, tirs: 0, tirsSuccess: 0 },
                    'Milieu': { matches: 0, wins: 0, tirs: 0, tirsSuccess: 0 },
                    'Tireur': { matches: 0, wins: 0, tirs: 0, tirsSuccess: 0 },
                  };
                  
                  filteredMatches.forEach(match => {
                    // Check team A player roles
                    if (match.teamA.playerRoles) {
                      match.teamA.playerRoles.forEach(pr => {
                        if (roleStats[pr.role]) {
                          roleStats[pr.role].matches++;
                          if (match.winner === 'A') roleStats[pr.role].wins++;
                          // Get player actions if available
                          if (match.playerActions) {
                            const playerAction = match.playerActions.find(pa => pa.playerId === pr.playerId);
                            if (playerAction) {
                              roleStats[pr.role].tirs += playerAction.actions.tirs;
                              roleStats[pr.role].tirsSuccess += playerAction.actions.tirsSuccess;
                            }
                          }
                        }
                      });
                    }
                  });
                  
                  const roleIcons = {
                    'Pointeur': { icon: 'radio-button-on', color: '#3B82F6' },
                    'Milieu': { icon: 'swap-horiz', color: '#8B5CF6' },
                    'Tireur': { icon: 'gps-fixed', color: '#F97316' },
                  };
                  
                  const hasData = Object.values(roleStats).some(r => r.matches > 0);
                  
                  if (!hasData) {
                    return (
                      <View style={styles.roleStatsEmpty}>
                        <MaterialIcons name="person" size={32} color={theme.textMuted} />
                        <Text style={styles.roleStatsEmptyText}>Jouez des matchs avec des rôles attribués pour voir vos stats par position</Text>
                      </View>
                    );
                  }
                  
                  return Object.entries(roleStats).map(([role, data]) => {
                    const config = roleIcons[role as keyof typeof roleIcons];
                    const winRate = data.matches > 0 ? Math.round((data.wins / data.matches) * 100) : 0;
                    const tirRate = data.tirs > 0 ? Math.round((data.tirsSuccess / data.tirs) * 100) : 0;
                    
                    return (
                      <View key={role} style={styles.roleStatRow}>
                        <View style={[styles.roleStatIcon, { backgroundColor: config.color + '15' }]}>
                          <MaterialIcons name={config.icon as any} size={20} color={config.color} />
                        </View>
                        <View style={styles.roleStatInfo}>
                          <Text style={styles.roleStatName}>{role}</Text>
                          <Text style={styles.roleStatMatches}>{data.matches} match{data.matches !== 1 ? 's' : ''}</Text>
                        </View>
                        {data.matches > 0 ? (
                          <View style={styles.roleStatValues}>
                            <View style={styles.roleStatValue}>
                              <Text style={[styles.roleStatValueText, { color: winRate >= 50 ? theme.success : theme.error }]}>{winRate}%</Text>
                              <Text style={styles.roleStatValueLabel}>Victoires</Text>
                            </View>
                            {data.tirs > 0 && (
                              <View style={styles.roleStatValue}>
                                <Text style={[styles.roleStatValueText, { color: config.color }]}>{tirRate}%</Text>
                                <Text style={styles.roleStatValueLabel}>Tirs</Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          <Text style={styles.roleStatNoData}>—</Text>
                        )}
                      </View>
                    );
                  });
                })()}
              </View>
            </Animated.View>

            {/* Carreau Detail */}
            <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>Carreaux</Text>
              <View style={styles.carreauCard}>
                <View style={styles.carreauMain}>
                  <MaterialIcons name="stars" size={40} color={theme.carreauColor} />
                  <Text style={styles.carreauValue}>{stats.totalCarreaux}</Text>
                  <Text style={styles.carreauLabel}>carreaux réussis</Text>
                </View>
                <View style={styles.carreauRate}>
                  <Text style={styles.carreauRateValue}>{stats.carreauRate}%</Text>
                  <Text style={styles.carreauRateLabel}>des tirs</Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}

        {/* DURATION TAB */}
        {activeTab === 'duration' && (
          <>
            {/* Overview Card */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <View style={styles.durationOverviewCard}>
                <View style={styles.durationOverviewMain}>
                  <MaterialIcons name="timer" size={32} color={theme.primary} />
                  <View style={styles.durationOverviewInfo}>
                    <Text style={styles.durationOverviewValue}>{durationStats.avgMatchDuration} min</Text>
                    <Text style={styles.durationOverviewLabel}>Durée moyenne par match</Text>
                  </View>
                </View>
                <View style={styles.durationOverviewStats}>
                  <View style={styles.durationOverviewStat}>
                    <Text style={styles.durationOverviewStatValue}>{durationStats.totalMatches}</Text>
                    <Text style={styles.durationOverviewStatLabel}>Matchs analysés</Text>
                  </View>
                  <View style={styles.durationOverviewStatDivider} />
                  <View style={styles.durationOverviewStat}>
                    <Text style={styles.durationOverviewStatValue}>
                      {Math.floor(durationStats.totalMatchDuration / 60)}h{durationStats.totalMatchDuration % 60}m
                    </Text>
                    <Text style={styles.durationOverviewStatLabel}>Temps total</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Match Duration by Format */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <Text style={styles.sectionTitle}>Durée par format</Text>
              <View style={styles.durationByFormatCard}>
                {Object.entries(durationStats.durationByFormat).map(([format, data], index) => {
                  const formatIcons: Record<string, { icon: string; color: string }> = {
                    'Tête-à-tête': { icon: 'person', color: theme.primary },
                    'Doublette': { icon: 'people', color: theme.accent },
                    'Triplette': { icon: 'groups', color: theme.carreauColor },
                  };
                  const config = formatIcons[format] || { icon: 'sports', color: theme.textSecondary };
                  const maxAvg = Math.max(...Object.values(durationStats.durationByFormat).map(d => d.avg), 1);
                  const barWidth = (data.avg / maxAvg) * 100;
                  
                  return (
                    <View key={format} style={styles.durationFormatRow}>
                      <View style={styles.durationFormatInfo}>
                        <View style={[styles.durationFormatIcon, { backgroundColor: config.color + '15' }]}>
                          <MaterialIcons name={config.icon as any} size={18} color={config.color} />
                        </View>
                        <View>
                          <Text style={styles.durationFormatName}>{format}</Text>
                          <Text style={styles.durationFormatCount}>{data.count} match{data.count !== 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                      <View style={styles.durationFormatBarContainer}>
                        <View style={[styles.durationFormatBar, { width: `${barWidth}%`, backgroundColor: config.color }]} />
                      </View>
                      <Text style={[styles.durationFormatValue, { color: config.color }]}>
                        {data.avg > 0 ? `${data.avg} min` : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Duration by Mode */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
              <Text style={styles.sectionTitle}>Durée par mode</Text>
              <View style={styles.durationModeGrid}>
                <View style={styles.durationModeCard}>
                  <View style={[styles.durationModeIcon, { backgroundColor: theme.primary + '15' }]}>
                    <MaterialIcons name="fitness-center" size={24} color={theme.primary} />
                  </View>
                  <Text style={styles.durationModeLabel}>Entraînement</Text>
                  <Text style={[styles.durationModeValue, { color: theme.primary }]}>
                    {durationStats.avgTrainingDuration > 0 ? `${durationStats.avgTrainingDuration} min` : '—'}
                  </Text>
                  <Text style={styles.durationModeSubtext}>moyenne</Text>
                </View>
                <View style={styles.durationModeCard}>
                  <View style={[styles.durationModeIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                    <MaterialIcons name="emoji-events" size={24} color={theme.carreauColor} />
                  </View>
                  <Text style={styles.durationModeLabel}>Tournoi</Text>
                  <Text style={[styles.durationModeValue, { color: theme.carreauColor }]}>
                    {durationStats.avgTournamentDuration > 0 ? `${durationStats.avgTournamentDuration} min` : '—'}
                  </Text>
                  <Text style={styles.durationModeSubtext}>moyenne</Text>
                </View>
              </View>
            </Animated.View>

            {/* Extremes */}
            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <Text style={styles.sectionTitle}>Extrêmes</Text>
              <View style={styles.durationExtremesCard}>
                <View style={styles.durationExtremeRow}>
                  <View style={[styles.durationExtremeIcon, { backgroundColor: theme.error + '15' }]}>
                    <MaterialIcons name="arrow-upward" size={20} color={theme.error} />
                  </View>
                  <View style={styles.durationExtremeInfo}>
                    <Text style={styles.durationExtremeLabel}>Match le plus long</Text>
                    <Text style={styles.durationExtremeFormat}>
                      {durationStats.longestMatch.format || '—'}
                    </Text>
                  </View>
                  <Text style={[styles.durationExtremeValue, { color: theme.error }]}>
                    {durationStats.longestMatch.duration > 0 ? `${durationStats.longestMatch.duration} min` : '—'}
                  </Text>
                </View>
                <View style={styles.durationExtremeDivider} />
                <View style={styles.durationExtremeRow}>
                  <View style={[styles.durationExtremeIcon, { backgroundColor: theme.success + '15' }]}>
                    <MaterialIcons name="arrow-downward" size={20} color={theme.success} />
                  </View>
                  <View style={styles.durationExtremeInfo}>
                    <Text style={styles.durationExtremeLabel}>Match le plus court</Text>
                    <Text style={styles.durationExtremeFormat}>
                      {durationStats.shortestMatch.format || '—'}
                    </Text>
                  </View>
                  <Text style={[styles.durationExtremeValue, { color: theme.success }]}>
                    {durationStats.shortestMatch.duration > 0 ? `${durationStats.shortestMatch.duration} min` : '—'}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Mène Duration Stats */}
            <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>Durée des mènes</Text>
              <View style={styles.meneDurationCard}>
                <View style={styles.meneDurationMain}>
                  <View style={styles.meneDurationMainItem}>
                    <MaterialIcons name="sports" size={28} color={theme.primary} />
                    <Text style={styles.meneDurationMainValue}>{durationStats.avgMeneDuration}s</Text>
                    <Text style={styles.meneDurationMainLabel}>Durée moyenne</Text>
                  </View>
                  <View style={styles.meneDurationMainDivider} />
                  <View style={styles.meneDurationMainItem}>
                    <MaterialIcons name="numbers" size={28} color={theme.accent} />
                    <Text style={styles.meneDurationMainValue}>{durationStats.totalMenes}</Text>
                    <Text style={styles.meneDurationMainLabel}>Mènes analysées</Text>
                  </View>
                </View>
                
                {durationStats.totalMenes > 0 && (
                  <View style={styles.meneDurationDetails}>
                    <View style={styles.meneDurationDetailRow}>
                      <Text style={styles.meneDurationDetailLabel}>Mène la plus longue</Text>
                      <Text style={styles.meneDurationDetailValue}>
                        {durationStats.longestMene.duration}s
                      </Text>
                    </View>
                    <View style={styles.meneDurationDetailRow}>
                      <Text style={styles.meneDurationDetailLabel}>Mène la plus courte</Text>
                      <Text style={styles.meneDurationDetailValue}>
                        {durationStats.shortestMene.duration}s
                      </Text>
                    </View>
                    <View style={styles.meneDurationDetailRow}>
                      <Text style={styles.meneDurationDetailLabel}>Mènes &gt; 1 minute</Text>
                      <View style={styles.meneDurationOver1Min}>
                        <Text style={[styles.meneDurationDetailValue, { color: theme.warning }]}>
                          {durationStats.menesOver1Min}
                        </Text>
                        <Text style={styles.meneDurationOver1MinPercent}>({durationStats.menesOver1MinPercent}%)</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Empty State */}
            {durationStats.totalMatches === 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                <View style={styles.emptyStateCard}>
                  <MaterialIcons name="timer-off" size={60} color={theme.textMuted} />
                  <Text style={styles.emptyStateTitle}>Pas de données de durée</Text>
                  <Text style={styles.emptyStateText}>
                    Jouez des matchs avec le chrono activé pour voir vos statistiques de durée
                  </Text>
                </View>
              </Animated.View>
            )}
          </>
        )}

        {/* CHALLENGES TAB */}
        {activeTab === 'challenges' && (
          <>
            {/* Challenge Overview */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <View style={styles.challengeOverview}>
                <View style={styles.challengeOverviewMain}>
                  <Text style={styles.challengeOverviewValue}>{challengeData.total}</Text>
                  <Text style={styles.challengeOverviewLabel}>défis réalisés</Text>
                </View>
                <Pressable 
                  style={styles.newChallengeButton}
                  onPress={() => router.push('/challenge/new')}
                >
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.newChallengeButtonText}>Nouveau</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Challenge Types */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <Text style={styles.sectionTitle}>Par type de défi</Text>
              <View style={styles.challengeTypesGrid}>
                {Object.entries(CHALLENGE_CONFIG).map(([type, config]) => {
                  const data = challengeData.byType[type as ChallengeType];
                  return (
                    <View key={type} style={styles.challengeTypeCard}>
                      <View style={[styles.challengeTypeIcon, { backgroundColor: config.color + '15' }]}>
                        <MaterialIcons name={config.icon} size={24} color={config.color} />
                      </View>
                      <Text style={styles.challengeTypeName}>{config.name}</Text>
                      <Text style={styles.challengeTypeCount}>{data.count} essai{data.count !== 1 ? 's' : ''}</Text>
                      {data.count > 0 && (
                        <View style={styles.challengeTypeScores}>
                          <View style={styles.challengeTypeScore}>
                            <Text style={[styles.challengeTypeScoreValue, { color: config.color }]}>
                              {data.bestScore}{type === 'precision' ? '' : '%'}
                            </Text>
                            <Text style={styles.challengeTypeScoreLabel}>Meilleur</Text>
                          </View>
                          <View style={styles.challengeTypeScore}>
                            <Text style={styles.challengeTypeScoreValue}>
                              {data.avgSuccess}{type === 'precision' ? '' : '%'}
                            </Text>
                            <Text style={styles.challengeTypeScoreLabel}>Moyenne</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </Animated.View>

            {/* 1v1 Opponents */}
            {challengeData.opponents.length > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
                <Text style={styles.sectionTitle}>Bilan 1v1</Text>
                <View style={styles.opponents1v1List}>
                  {challengeData.opponents.map((opponent, index) => {
                    const winRate = opponent.total > 0 ? Math.round((opponent.wins / opponent.total) * 100) : 0;
                    return (
                      <View key={opponent.id} style={styles.opponent1v1Item}>
                        <View style={styles.opponent1v1Avatar}>
                          <Text style={styles.opponent1v1Initials}>
                            {opponent.name.split(' ').map(n => n[0]).join('')}
                          </Text>
                        </View>
                        <View style={styles.opponent1v1Info}>
                          <Text style={styles.opponent1v1Name}>{opponent.name}</Text>
                          <Text style={styles.opponent1v1Total}>{opponent.total} défi{opponent.total > 1 ? 's' : ''}</Text>
                        </View>
                        <View style={styles.opponent1v1Record}>
                          <Text style={[styles.opponent1v1RecordValue, { color: theme.success }]}>{opponent.wins}</Text>
                          <Text style={styles.opponent1v1RecordSep}>-</Text>
                          <Text style={[styles.opponent1v1RecordValue, { color: theme.textMuted }]}>{opponent.draws}</Text>
                          <Text style={styles.opponent1v1RecordSep}>-</Text>
                          <Text style={[styles.opponent1v1RecordValue, { color: theme.error }]}>{opponent.losses}</Text>
                        </View>
                        <View style={[
                          styles.opponent1v1WinRate,
                          { backgroundColor: winRate >= 50 ? theme.success + '15' : theme.error + '15' }
                        ]}>
                          <Text style={[
                            styles.opponent1v1WinRateText,
                            { color: winRate >= 50 ? theme.success : theme.error }
                          ]}>{winRate}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {/* Recent Challenges */}
            {challengeData.recent.length > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
                <Text style={styles.sectionTitle}>Historique récent</Text>
                <View style={styles.recentChallengesList}>
                  {challengeData.recent.map((challenge, index) => {
                    const config = CHALLENGE_CONFIG[challenge.type];
                    const score = challenge.type === 'precision' 
                      ? `${challenge.totalPoints || 0}/100` 
                      : `${challenge.successRate || 0}%`;
                    return (
                      <View key={challenge.id} style={styles.recentChallengeItem}>
                        <View style={[styles.recentChallengeIcon, { backgroundColor: config.color + '15' }]}>
                          <MaterialIcons name={config.icon} size={20} color={config.color} />
                        </View>
                        <View style={styles.recentChallengeInfo}>
                          <Text style={styles.recentChallengeName}>{config.name}</Text>
                          <Text style={styles.recentChallengeDate}>
                            {new Date(challenge.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        </View>
                        {challenge.mode === '1v1' && (
                          <View style={styles.recentChallenge1v1Badge}>
                            <Text style={styles.recentChallenge1v1Text}>1v1</Text>
                          </View>
                        )}
                        <Text style={[styles.recentChallengeScore, { color: config.color }]}>{score}</Text>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {/* Empty State */}
            {challengeData.total === 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                <View style={styles.emptyStateCard}>
                  <MaterialIcons name="emoji-events" size={60} color={theme.textMuted} />
                  <Text style={styles.emptyStateTitle}>Aucun défi réalisé</Text>
                  <Text style={styles.emptyStateText}>
                    Commencez un défi pour améliorer vos compétences et suivre votre progression
                  </Text>
                  <Pressable
                    style={styles.emptyStateButton}
                    onPress={() => router.push('/challenge/new')}
                  >
                    <MaterialIcons name="add" size={20} color="#FFF" />
                    <Text style={styles.emptyStateButtonText}>Nouveau défi</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </>
        )}

        {/* FINANCIAL TAB */}
        {activeTab === 'financial' && (
          <>
            {/* Balance Card */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <View style={styles.balanceCard}>
                <Text style={styles.balanceTitle}>Bilan financier</Text>
                <View style={[
                  styles.balanceBadge,
                  { backgroundColor: financialData.balance >= 0 ? theme.success + '15' : theme.error + '15' }
                ]}>
                  <Text style={[
                    styles.balanceValue,
                    { color: financialData.balance >= 0 ? theme.success : theme.error }
                  ]}>
                    {financialData.balance > 0 ? '+' : ''}{financialData.balance}€
                  </Text>
                </View>
                <Text style={styles.balanceSubtitle}>
                  Sur {financialData.completedCount} tournoi{financialData.completedCount > 1 ? 's' : ''} terminé{financialData.completedCount > 1 ? 's' : ''}
                </Text>
              </View>
            </Animated.View>

            {/* Cost vs Gain */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <View style={styles.financialGrid}>
                <View style={[styles.financialCard, { borderTopColor: theme.error }]}>
                  <MaterialIcons name="remove-circle-outline" size={28} color={theme.error} />
                  <Text style={[styles.financialValue, { color: theme.error }]}>{financialData.totalCost}€</Text>
                  <Text style={styles.financialLabel}>Dépensé</Text>
                  <Text style={styles.financialDetail}>en inscriptions</Text>
                </View>
                <View style={[styles.financialCard, { borderTopColor: theme.success }]}>
                  <MaterialIcons name="add-circle-outline" size={28} color={theme.success} />
                  <Text style={[styles.financialValue, { color: theme.success }]}>{financialData.totalGain}€</Text>
                  <Text style={styles.financialLabel}>Gagné</Text>
                  <Text style={styles.financialDetail}>{financialData.tournamentsWithGain} tournoi{financialData.tournamentsWithGain > 1 ? 's' : ''}</Text>
                </View>
              </View>
            </Animated.View>

            {/* Tip */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
              <View style={styles.tipCard}>
                <MaterialIcons name="lightbulb" size={24} color={theme.warning} />
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>Conseil</Text>
                  <Text style={styles.tipText}>
                    Renseignez le coût d'inscription et vos gains lors de la création ou modification de vos tournois pour suivre votre bilan financier.
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Empty State */}
            {financialData.completedCount === 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
                <View style={styles.emptyStateCard}>
                  <MaterialIcons name="account-balance-wallet" size={60} color={theme.textMuted} />
                  <Text style={styles.emptyStateTitle}>Aucun tournoi terminé</Text>
                  <Text style={styles.emptyStateText}>
                    Terminez des tournois avec coûts et gains pour voir votre bilan financier
                  </Text>
                </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  header: {
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  timeFilterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.backgroundSecondary,
  },
  tabActive: {
    backgroundColor: theme.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 320,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 4,
  },
  modalOptionActive: {
    backgroundColor: theme.primary + '10',
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: theme.textPrimary,
  },
  modalOptionTextActive: {
    fontWeight: '600',
    color: theme.primary,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  // Quick Stats Grid
  quickStatsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  mainStatCard: {
    flex: 1.2,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  mainStatRing: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainStatRingCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  mainStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.primary,
  },
  mainStatLabel: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  mainStatDetails: {
    marginTop: 12,
    gap: 6,
  },
  mainStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mainStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mainStatDetailText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  sideStats: {
    flex: 1,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    ...theme.shadows.card,
  },
  statCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statCardLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  statCardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statCardSubValue: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  // Skills Grid
  skillsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  skillCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderLeftWidth: 3,
    ...theme.shadows.card,
  },
  skillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  skillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  skillValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  skillDetail: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  // Points Balance
  pointsBalanceCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  pointsBalanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  pointsBalanceValue: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  pointsBalanceLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  pointsBalanceDivider: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pointsBalanceBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  pointsBalanceDiffText: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Challenge Preview
  challengePreviewCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  challengePreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  challengePreviewItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  challengePreviewIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  challengePreviewInfo: {
    flex: 1,
  },
  challengePreviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  challengePreviewDate: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  challengePreviewScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Match Types
  matchTypesGrid: {
    gap: 12,
  },
  matchTypeCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  matchTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  matchTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  matchTypeBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  matchTypeMainStat: {
    alignItems: 'center',
    marginRight: 24,
  },
  matchTypeValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  matchTypeLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  matchTypeStats: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  matchTypeStatRow: {
    alignItems: 'center',
  },
  matchTypeStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  matchTypeStatLabel: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: '600',
  },
  matchTypeWinRate: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  matchTypeWinRateText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Terrain List
  terrainList: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  terrainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  terrainIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  terrainInfo: {
    flex: 1,
  },
  terrainName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  terrainMatches: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  terrainStats: {
    alignItems: 'flex-end',
  },
  terrainRecord: {
    fontSize: 14,
    fontWeight: '600',
  },
  terrainWinRate: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginTop: 4,
  },
  terrainWinRateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  terrainNoData: {
    fontSize: 16,
    color: theme.textMuted,
  },
  // Opponents List
  opponentsList: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  opponentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  opponentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  opponentInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  opponentInfo: {
    flex: 1,
  },
  opponentName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  opponentMatches: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  opponentStats: {
    alignItems: 'flex-end',
  },
  opponentRecord: {
    fontSize: 14,
    fontWeight: '600',
  },
  opponentWinRate: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginTop: 4,
  },
  opponentWinRateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Empty Card
  emptyCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  // Toggle Card
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  toggleCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '05',
  },
  toggleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  // Big Skill Card
  bigSkillCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  bigSkillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bigSkillIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bigSkillTitleArea: {
    flex: 1,
  },
  bigSkillTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  bigSkillSubtitle: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  bigSkillRing: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigSkillRingValue: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '700',
  },
  bigSkillStats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  bigSkillStat: {
    flex: 1,
    alignItems: 'center',
  },
  bigSkillStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  bigSkillStatLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  bigSkillStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.border,
  },
  // Carreau Card
  carreauCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  carreauMain: {
    flex: 1,
    alignItems: 'center',
  },
  carreauValue: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.carreauColor,
    marginTop: 8,
  },
  carreauLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  carreauRate: {
    paddingLeft: 20,
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
    alignItems: 'center',
  },
  carreauRateValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  carreauRateLabel: {
    fontSize: 12,
    color: theme.textMuted,
  },
  // Role Stats styles
  roleStatsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  roleStatsEmpty: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  roleStatsEmptyText: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
    maxWidth: 240,
  },
  roleStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  roleStatIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleStatInfo: {
    flex: 1,
  },
  roleStatName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  roleStatMatches: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  roleStatValues: {
    flexDirection: 'row',
    gap: 16,
  },
  roleStatValue: {
    alignItems: 'center',
  },
  roleStatValueText: {
    fontSize: 18,
    fontWeight: '700',
  },
  roleStatValueLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 2,
  },
  roleStatNoData: {
    fontSize: 18,
    color: theme.textMuted,
  },
  // Challenge Overview
  challengeOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  challengeOverviewMain: {},
  challengeOverviewValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  challengeOverviewLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  newChallengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  newChallengeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Challenge Types Grid
  challengeTypesGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  challengeTypeCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  challengeTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  challengeTypeName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  challengeTypeCount: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  challengeTypeScores: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  challengeTypeScore: {
    alignItems: 'center',
  },
  challengeTypeScoreValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  challengeTypeScoreLabel: {
    fontSize: 10,
    color: theme.textMuted,
  },
  // 1v1 Opponents
  opponents1v1List: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  opponent1v1Item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  opponent1v1Avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  opponent1v1Initials: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  opponent1v1Info: {
    flex: 1,
  },
  opponent1v1Name: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  opponent1v1Total: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  opponent1v1Record: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  opponent1v1RecordValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  opponent1v1RecordSep: {
    fontSize: 12,
    color: theme.textMuted,
    marginHorizontal: 2,
  },
  opponent1v1WinRate: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  opponent1v1WinRateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Recent Challenges
  recentChallengesList: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  recentChallengeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  recentChallengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentChallengeInfo: {
    flex: 1,
  },
  recentChallengeName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  recentChallengeDate: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  recentChallenge1v1Badge: {
    backgroundColor: theme.accent + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
    marginRight: 10,
  },
  recentChallenge1v1Text: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.accent,
  },
  recentChallengeScore: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Empty State
  emptyStateCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 40,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 20,
    maxWidth: 260,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  // Balance Card
  balanceCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  balanceTitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  balanceBadge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 12,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  balanceSubtitle: {
    fontSize: 13,
    color: theme.textMuted,
  },
  // Financial Grid
  financialGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  financialCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    borderTopWidth: 3,
    ...theme.shadows.card,
  },
  financialValue: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 12,
  },
  financialLabel: {
    fontSize: 14,
    color: theme.textPrimary,
    fontWeight: '600',
    marginTop: 4,
  },
  financialDetail: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  // Tip Card
  tipCard: {
    flexDirection: 'row',
    backgroundColor: theme.warning + '10',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.warning + '30',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.warning,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  // Duration Tab Styles
  durationOverviewCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  durationOverviewMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  durationOverviewInfo: {
    flex: 1,
  },
  durationOverviewValue: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  durationOverviewLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  durationOverviewStats: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 16,
  },
  durationOverviewStat: {
    flex: 1,
    alignItems: 'center',
  },
  durationOverviewStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  durationOverviewStatLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  durationOverviewStatDivider: {
    width: 1,
    backgroundColor: theme.border,
    marginHorizontal: 16,
  },
  durationByFormatCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  durationFormatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  durationFormatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 130,
  },
  durationFormatIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationFormatName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  durationFormatCount: {
    fontSize: 11,
    color: theme.textMuted,
  },
  durationFormatBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 4,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  durationFormatBar: {
    height: '100%',
    borderRadius: 4,
  },
  durationFormatValue: {
    fontSize: 14,
    fontWeight: '700',
    width: 60,
    textAlign: 'right',
  },
  durationModeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  durationModeCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  durationModeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  durationModeLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  durationModeValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  durationModeSubtext: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  durationExtremesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  durationExtremeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  durationExtremeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  durationExtremeInfo: {
    flex: 1,
  },
  durationExtremeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  durationExtremeFormat: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  durationExtremeValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  durationExtremeDivider: {
    height: 1,
    backgroundColor: theme.border,
  },
  meneDurationCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  meneDurationMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  meneDurationMainItem: {
    flex: 1,
    alignItems: 'center',
  },
  meneDurationMainValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 8,
  },
  meneDurationMainLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  meneDurationMainDivider: {
    width: 1,
    height: 60,
    backgroundColor: theme.border,
    marginHorizontal: 16,
  },
  meneDurationDetails: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 16,
  },
  meneDurationDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  meneDurationDetailLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  meneDurationDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  meneDurationOver1Min: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meneDurationOver1MinPercent: {
    fontSize: 13,
    color: theme.textMuted,
  },
  // Mini Bar Chart
  miniBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 40,
  },
  miniBar: {
    width: 6,
    borderRadius: 3,
  },
  // Evolution Chart
  evolutionChart: {
    alignItems: 'center',
  },
  evolutionChartCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  evolutionChartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  evolutionChartEmptyText: {
    fontSize: 13,
    color: theme.textMuted,
  },
  evolutionLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 20,
  },
  evolutionLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  evolutionLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  evolutionLegendText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  evolutionSummary: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  evolutionSummaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  evolutionSummaryLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 4,
  },
  evolutionSummaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  evolutionSummaryDivider: {
    width: 1,
    backgroundColor: theme.border,
    marginHorizontal: 8,
  },
  evolutionTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
