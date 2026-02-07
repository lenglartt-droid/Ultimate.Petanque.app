import React, { useState } from 'react';
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { ChallengeType } from '@/services/mockData';

const CHALLENGE_CONFIG = {
  '10_tirs': { name: '10 Tirs', icon: 'gps-fixed' as const, color: '#F97316' },
  '10_tirs_sautee': { name: 'Tirs Sautée', icon: 'sports' as const, color: '#3B82F6' },
  'precision': { name: 'Précision', icon: 'stars' as const, color: '#F59E0B' },
};
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { router } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 64;

// Simple Bar Chart Component
function WeeklyChart({ data }: { data: { day: string; matches: number; wins: number }[] }) {
  const maxValue = Math.max(...data.map(d => d.matches), 1);
  const barWidth = (chartWidth - 60) / 7;

  return (
    <View style={styles.chartContainer}>
      <Svg width={chartWidth} height={160}>
        {/* Grid lines */}
        {[0, 1, 2, 3, 4].map(i => (
          <Line
            key={i}
            x1={30}
            y1={20 + i * 30}
            x2={chartWidth}
            y2={20 + i * 30}
            stroke={theme.border}
            strokeWidth={1}
          />
        ))}
        
        {/* Bars */}
        {data.map((item, index) => {
          const barHeight = (item.matches / maxValue) * 100;
          const winHeight = (item.wins / maxValue) * 100;
          const x = 40 + index * barWidth;
          
          return (
            <React.Fragment key={item.day}>
              {/* Total matches bar */}
              <Rect
                x={x}
                y={120 - barHeight}
                width={barWidth - 8}
                height={barHeight}
                fill={theme.border}
                rx={4}
              />
              {/* Wins bar */}
              <Rect
                x={x}
                y={120 - winHeight}
                width={barWidth - 8}
                height={winHeight}
                fill={theme.primary}
                rx={4}
              />
            </React.Fragment>
          );
        })}
      </Svg>
      
      {/* X-axis labels */}
      <View style={styles.chartLabels}>
        {data.map(item => (
          <Text key={item.day} style={styles.chartLabel}>{item.day}</Text>
        ))}
      </View>
      
      {/* Legend */}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
          <Text style={styles.legendText}>Victoires</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.border }]} />
          <Text style={styles.legendText}>Total matchs</Text>
        </View>
      </View>
    </View>
  );
}

// Progress Ring Component
function StatRing({ 
  value, 
  label, 
  color, 
  size = 100 
}: { 
  value: number; 
  label: string; 
  color: string; 
  size?: number;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <View style={styles.statRingContainer}>
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
      <View style={[styles.statRingCenter, { width: size, height: size }]}>
        <Text style={[styles.statRingValue, { color }]}>{value}%</Text>
        <Text style={styles.statRingLabel}>{label}</Text>
      </View>
    </View>
  );
}

type TimeFilter = 'today' | 'week' | 'month' | 'year' | 'all';

const TIME_FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'year', label: 'Année' },
  { id: 'all', label: 'Tout' },
];

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
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday as first day
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

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, matches, challengeStats, challenges, tournaments, terrains } = useApp();
  const [activeTab, setActiveTab] = useState<'global' | 'tournois' | 'entrainement' | 'tir' | 'point' | 'challenges' | 'matchups' | 'terrains'>('global');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [showTimeFilterModal, setShowTimeFilterModal] = useState(false);
  const [includeChallengesInTirStats, setIncludeChallengesInTirStats] = useState(false);

  // Filter data by time
  const filteredMatches = filterByTime(matches, timeFilter);
  const filteredChallenges = filterByTime(challenges, timeFilter);

  // Calculate filtered stats
  const filteredStats = React.useMemo(() => {
    const wins = filteredMatches.filter(m => m.winner === 'A').length;
    const losses = filteredMatches.length - wins;
    const winRate = filteredMatches.length > 0 ? Math.round((wins / filteredMatches.length) * 100) : 0;
    
    return {
      totalMatches: filteredMatches.length,
      wins,
      losses,
      winRate,
    };
  }, [filteredMatches]);

  // Calculate filtered challenge stats
  const filteredChallengeStats = React.useMemo(() => {
    const byType = {
      '10_tirs': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
      '10_tirs_sautee': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
      'precision': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
    };

    let totalShots = 0;
    let totalSuccess = 0;

    filteredChallenges.forEach(c => {
      const type = byType[c.type];
      type.count++;
      
      if (c.type === 'precision') {
        const score = c.totalPoints || 0;
        type.totalSuccess += score;
        type.bestScore = Math.max(type.bestScore, score);
        totalShots += 20;
        totalSuccess += (c.precisionShots?.filter(s => s.points >= 3).length || 0);
      } else {
        type.totalSuccess += (c.successRate || 0);
        type.bestScore = Math.max(type.bestScore, c.successRate || 0);
        totalShots += (c.totalShots || 0);
        totalSuccess += (c.successCount || 0);
      }
    });

    Object.keys(byType).forEach(key => {
      const t = byType[key as ChallengeType];
      t.avgSuccess = t.count > 0 ? Math.round(t.totalSuccess / t.count) : 0;
    });

    return {
      totalChallenges: filteredChallenges.length,
      byType: {
        '10_tirs': { count: byType['10_tirs'].count, avgSuccess: byType['10_tirs'].avgSuccess, bestScore: byType['10_tirs'].bestScore },
        '10_tirs_sautee': { count: byType['10_tirs_sautee'].count, avgSuccess: byType['10_tirs_sautee'].avgSuccess, bestScore: byType['10_tirs_sautee'].bestScore },
        'precision': { count: byType['precision'].count, avgSuccess: byType['precision'].avgSuccess, bestScore: byType['precision'].bestScore },
      },
      recentChallenges: [...filteredChallenges].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
      totalShots,
      totalSuccess,
      overallSuccessRate: totalShots > 0 ? Math.round((totalSuccess / totalShots) * 100) : 0,
    };
  }, [filteredChallenges]);

  // Filter matches by mode
  const tournamentMatches = filteredMatches.filter(m => m.mode === 'Tournoi');
  const trainingMatches = filteredMatches.filter(m => m.mode === 'Entraînement');

  // Tournament stats
  const tournamentStats = React.useMemo(() => {
    const wins = tournamentMatches.filter(m => m.winner === 'A').length;
    const losses = tournamentMatches.length - wins;
    const winRate = tournamentMatches.length > 0 ? Math.round((wins / tournamentMatches.length) * 100) : 0;
    
    // Calculate action stats
    let totalTirs = 0, totalTirsSuccess = 0, totalCarreaux = 0;
    let totalPoints = 0, totalPointsSuccess = 0;
    let totalPointsFor = 0, totalPointsAgainst = 0;
    
    tournamentMatches.forEach(match => {
      totalPointsFor += match.teamA.score;
      totalPointsAgainst += match.teamB.score;
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          totalTirs += pa.actions.tirs;
          totalTirsSuccess += pa.actions.tirsSuccess;
          totalCarreaux += pa.actions.carreaux;
          totalPoints += pa.actions.points;
          totalPointsSuccess += pa.actions.pointsSuccess;
        });
      }
    });

    const tirRate = totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : null;
    const pointRate = totalPoints > 0 ? Math.round((totalPointsSuccess / totalPoints) * 100) : null;
    const carreauRate = totalTirs > 0 ? Math.round((totalCarreaux / totalTirs) * 100) : 0;

    // Get unique tournaments played
    const uniqueTournaments = new Set(tournamentMatches.map(m => m.tournamentId).filter(Boolean));
    
    // Phase stats
    const phaseStats: Record<string, { played: number; wins: number }> = {};
    tournamentMatches.forEach(match => {
      const phase = match.tournamentPhase || 'Autre';
      if (!phaseStats[phase]) {
        phaseStats[phase] = { played: 0, wins: 0 };
      }
      phaseStats[phase].played++;
      if (match.winner === 'A') phaseStats[phase].wins++;
    });

    return {
      totalMatches: tournamentMatches.length,
      wins,
      losses,
      winRate,
      totalPointsFor,
      totalPointsAgainst,
      pointDiff: totalPointsFor - totalPointsAgainst,
      tirRate,
      pointRate,
      carreauRate,
      totalTirs,
      totalTirsSuccess,
      totalCarreaux,
      totalPoints,
      totalPointsSuccess,
      tournamentsPlayed: uniqueTournaments.size,
      phaseStats,
    };
  }, [tournamentMatches]);

  // Training stats
  const trainingStats = React.useMemo(() => {
    const wins = trainingMatches.filter(m => m.winner === 'A').length;
    const losses = trainingMatches.length - wins;
    const winRate = trainingMatches.length > 0 ? Math.round((wins / trainingMatches.length) * 100) : 0;
    
    // Calculate action stats
    let totalTirs = 0, totalTirsSuccess = 0, totalCarreaux = 0;
    let totalPoints = 0, totalPointsSuccess = 0;
    let totalPointsFor = 0, totalPointsAgainst = 0;
    let totalDuration = 0;
    
    trainingMatches.forEach(match => {
      totalPointsFor += match.teamA.score;
      totalPointsAgainst += match.teamB.score;
      totalDuration += match.duration || 0;
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          totalTirs += pa.actions.tirs;
          totalTirsSuccess += pa.actions.tirsSuccess;
          totalCarreaux += pa.actions.carreaux;
          totalPoints += pa.actions.points;
          totalPointsSuccess += pa.actions.pointsSuccess;
        });
      }
    });

    const tirRate = totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : null;
    const pointRate = totalPoints > 0 ? Math.round((totalPointsSuccess / totalPoints) * 100) : null;
    const carreauRate = totalTirs > 0 ? Math.round((totalCarreaux / totalTirs) * 100) : 0;
    const avgDuration = trainingMatches.length > 0 ? Math.round(totalDuration / trainingMatches.length) : 0;

    return {
      totalMatches: trainingMatches.length,
      wins,
      losses,
      winRate,
      totalPointsFor,
      totalPointsAgainst,
      pointDiff: totalPointsFor - totalPointsAgainst,
      tirRate,
      pointRate,
      carreauRate,
      totalTirs,
      totalTirsSuccess,
      totalCarreaux,
      totalPoints,
      totalPointsSuccess,
      avgDuration,
    };
  }, [trainingMatches]);

  // Calculate stats by terrain type
  const terrainTypeStats = React.useMemo(() => {
    const statsByType: Record<string, { matches: number; wins: number; losses: number; winRate: number; pointsFor: number; pointsAgainst: number }> = {};
    
    // Initialize all terrain types
    ['Stabilisé', 'Graviers', 'Sable', 'Cailloux', 'Terre battue'].forEach(type => {
      statsByType[type] = { matches: 0, wins: 0, losses: 0, winRate: 0, pointsFor: 0, pointsAgainst: 0 };
    });
    
    // Calculate stats for each match based on tournament terrain
    filteredMatches.forEach(match => {
      if (match.tournamentId) {
        const tournament = tournaments.find(t => t.id === match.tournamentId);
        if (tournament?.terrainType) {
          const type = tournament.terrainType;
          if (statsByType[type]) {
            statsByType[type].matches++;
            statsByType[type].pointsFor += match.teamA.score;
            statsByType[type].pointsAgainst += match.teamB.score;
            if (match.winner === 'A') {
              statsByType[type].wins++;
            } else {
              statsByType[type].losses++;
            }
          }
        }
      }
    });
    
    // Calculate win rates
    Object.keys(statsByType).forEach(type => {
      const stats = statsByType[type];
      stats.winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
    });
    
    return statsByType;
  }, [filteredMatches, tournaments]);

  const tabs = [
    { id: 'global', label: 'Global' },
    { id: 'tournois', label: 'Tournois' },
    { id: 'entrainement', label: 'Entraînement' },
    { id: 'terrains', label: 'Terrains' },
    { id: 'tir', label: 'Tir' },
    { id: 'point', label: 'Point' },
    { id: 'challenges', label: 'Défis' },
    { id: 'matchups', label: 'Adversaires' },
  ] as const;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View 
          entering={FadeInDown.duration(400)}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Statistiques</Text>
              <Text style={styles.subtitle}>
                {timeFilter === 'all' 
                  ? `${userStats.totalMatches} matchs joués`
                  : `${filteredStats.totalMatches} matchs (${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()})`
                }
              </Text>
            </View>
            <Pressable 
              style={styles.compareButton}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/player/compare');
              }}
            >
              <MaterialIcons name="compare-arrows" size={22} color={theme.primary} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Time Filter Button */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(50)}
          style={styles.timeFilterWrapper}
        >
          <Pressable
            style={styles.timeFilterButtonSingle}
            onPress={() => setShowTimeFilterModal(true)}
          >
            <MaterialIcons name="date-range" size={20} color={theme.primary} />
            <Text style={styles.timeFilterButtonText}>
              {TIME_FILTERS.find(f => f.id === timeFilter)?.label || 'Tout'}
            </Text>
            <MaterialIcons name="expand-more" size={20} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Time Filter Modal */}
        <Modal
          visible={showTimeFilterModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimeFilterModal(false)}
        >
          <Pressable 
            style={styles.modalOverlay}
            onPress={() => setShowTimeFilterModal(false)}
          >
            <Pressable style={styles.timeFilterModalContent} onPress={() => {}}>
              <View style={styles.timeFilterModalHeader}>
                <Text style={styles.timeFilterModalTitle}>Période</Text>
                <Pressable onPress={() => setShowTimeFilterModal(false)}>
                  <MaterialIcons name="close" size={24} color={theme.textSecondary} />
                </Pressable>
              </View>
              <View style={styles.timeFilterModalOptions}>
                {TIME_FILTERS.map(filter => (
                  <Pressable
                    key={filter.id}
                    style={[
                      styles.timeFilterModalOption,
                      timeFilter === filter.id && styles.timeFilterModalOptionActive
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTimeFilter(filter.id);
                      setShowTimeFilterModal(false);
                    }}
                  >
                    <Text style={[
                      styles.timeFilterModalOptionText,
                      timeFilter === filter.id && styles.timeFilterModalOptionTextActive
                    ]}>
                      {filter.label}
                    </Text>
                    {timeFilter === filter.id && (
                      <MaterialIcons name="check" size={20} color={theme.primary} />
                    )}
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Tabs */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(100)}
        >
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {tabs.map(tab => (
              <Pressable
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && styles.tabActive
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === tab.id && styles.tabTextActive
                ]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {activeTab === 'global' && (
          <>
            {/* Weekly Progress Chart */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>CETTE SEMAINE</Text>
              <View style={styles.chartCard}>
                <WeeklyChart data={userStats.weeklyProgress} />
              </View>
            </Animated.View>

            {/* Win Rate Hero Card */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(300)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>TAUX DE VICTOIRE</Text>
              <View style={styles.winRateCard}>
                <StatRing 
                  value={timeFilter === 'all' ? userStats.winRate : filteredStats.winRate} 
                  label="Victoires" 
                  color={theme.primary}
                  size={160}
                />
                <View style={styles.winRateStats}>
                  <View style={styles.winRateStatItem}>
                    <Text style={[styles.winRateStatValue, { color: theme.success }]}>
                      {timeFilter === 'all' ? userStats.wins : filteredStats.wins}
                    </Text>
                    <Text style={styles.winRateStatLabel}>Gagnés</Text>
                  </View>
                  <View style={styles.winRateStatItem}>
                    <Text style={[styles.winRateStatValue, { color: theme.error }]}>
                      {timeFilter === 'all' ? userStats.losses : filteredStats.losses}
                    </Text>
                    <Text style={styles.winRateStatLabel}>Perdus</Text>
                  </View>
                  <View style={styles.winRateStatItem}>
                    <Text style={[styles.winRateStatValue, { color: theme.accent }]}>{userStats.currentStreak}</Text>
                    <Text style={styles.winRateStatLabel}>Série en cours</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Performance Grid */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(400)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>PERFORMANCE</Text>
              <View style={styles.performanceGrid}>
                <View style={[styles.perfCard, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialIcons name="gps-fixed" size={24} color={theme.tirColor} />
                  <Text style={[styles.perfValue, { color: theme.tirColor }]}>
                    {userStats.tirSuccessRate}%
                  </Text>
                  <Text style={styles.perfLabel}>Tir</Text>
                </View>
                <View style={[styles.perfCard, { backgroundColor: '#F0FDF4' }]}>
                  <MaterialIcons name="radio-button-on" size={24} color={theme.pointColor} />
                  <Text style={[styles.perfValue, { color: theme.pointColor }]}>
                    {userStats.pointSuccessRate}%
                  </Text>
                  <Text style={styles.perfLabel}>Point</Text>
                </View>
                <View style={[styles.perfCard, { backgroundColor: '#FFFBEB' }]}>
                  <MaterialIcons name="star" size={24} color={theme.carreauColor} />
                  <Text style={[styles.perfValue, { color: theme.carreauColor }]}>
                    {userStats.carreauRate}%
                  </Text>
                  <Text style={styles.perfLabel}>Carreau</Text>
                </View>
                <View style={[styles.perfCard, { backgroundColor: '#FDF2F8' }]}>
                  <MaterialIcons name="emoji-events" size={24} color="#EC4899" />
                  <Text style={[styles.perfValue, { color: '#EC4899' }]}>
                    {userStats.tournamentsWon}
                  </Text>
                  <Text style={styles.perfLabel}>Tournois gagnés</Text>
                </View>
              </View>
            </Animated.View>

            {/* Summary Stats */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(500)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>RÉSUMÉ</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <MaterialIcons name="whatshot" size={28} color={theme.error} />
                  <Text style={styles.summaryValue}>{userStats.longestStreak}</Text>
                  <Text style={styles.summaryLabel}>Meilleure série</Text>
                </View>
                <View style={styles.summaryCard}>
                  <MaterialIcons name="timer" size={28} color={theme.primary} />
                  <Text style={styles.summaryValue}>{userStats.avgMatchDuration}</Text>
                  <Text style={styles.summaryLabel}>Min / match</Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}

        {activeTab === 'tir' && (
          <>
            {/* Include Challenges Toggle */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(150)}
              style={styles.section}
            >
              <Pressable
                style={[
                  styles.includeChallengesToggle,
                  includeChallengesInTirStats && styles.includeChallengesToggleActive
                ]}
                onPress={() => setIncludeChallengesInTirStats(!includeChallengesInTirStats)}
              >
                <MaterialIcons 
                  name={includeChallengesInTirStats ? 'check-box' : 'check-box-outline-blank'} 
                  size={24} 
                  color={includeChallengesInTirStats ? theme.primary : theme.textSecondary} 
                />
                <View style={styles.includeChallengesInfo}>
                  <Text style={[
                    styles.includeChallengesTitle,
                    includeChallengesInTirStats && styles.includeChallengesTitleActive
                  ]}>
                    Inclure les défis
                  </Text>
                  <Text style={styles.includeChallengesSubtitle}>
                    Ajouter les tirs des défis aux statistiques
                  </Text>
                </View>
                {includeChallengesInTirStats && (
                  <View style={styles.includeChallengesBadge}>
                    <Text style={styles.includeChallengesBadgeText}>+{filteredChallengeStats.totalShots} tirs</Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>

            <Animated.View 
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>PERFORMANCE AU TIR</Text>
              <View style={styles.performanceCard}>
                {(() => {
                  // Calculate combined stats
                  const matchTirs = userStats.totalMatches * 15;
                  const matchTirsSuccess = Math.round(matchTirs * userStats.tirSuccessRate / 100);
                  const matchCarreaux = Math.round(matchTirs * userStats.carreauRate / 100);
                  
                  // Challenge tirs (10_tirs and 10_tirs_sautee)
                  const challengeTirs = filteredChallenges
                    .filter(c => c.type !== 'precision')
                    .reduce((acc, c) => acc + (c.totalShots || 0), 0);
                  const challengeTirsSuccess = filteredChallenges
                    .filter(c => c.type !== 'precision')
                    .reduce((acc, c) => acc + (c.successCount || 0), 0);
                  const challengeCarreaux = filteredChallenges
                    .filter(c => c.type !== 'precision')
                    .reduce((acc, c) => acc + (c.carreauCount || 0), 0);

                  const totalTirs = includeChallengesInTirStats ? matchTirs + challengeTirs : matchTirs;
                  const totalTirsSuccess = includeChallengesInTirStats ? matchTirsSuccess + challengeTirsSuccess : matchTirsSuccess;
                  const totalCarreaux = includeChallengesInTirStats ? matchCarreaux + challengeCarreaux : matchCarreaux;
                  const tirRate = totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : 0;
                  const carreauRate = totalTirs > 0 ? Math.round((totalCarreaux / totalTirs) * 100) : 0;

                  return (
                    <>
                      <StatRing 
                        value={tirRate} 
                        label="Tir" 
                        color={theme.tirColor}
                        size={160}
                      />
                      <View style={styles.performanceDetails}>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Tirs réussis</Text>
                          <Text style={styles.detailValue}>{totalTirsSuccess}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Tirs tentés</Text>
                          <Text style={styles.detailValue}>{totalTirs}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Carreaux</Text>
                          <Text style={[styles.detailValue, { color: theme.carreauColor }]}>
                            {carreauRate}%
                          </Text>
                        </View>
                        {includeChallengesInTirStats && (
                          <>
                            <View style={styles.detailDivider} />
                            <View style={styles.detailRow}>
                              <Text style={[styles.detailLabel, { color: theme.primary }]}>Dont défis</Text>
                              <Text style={[styles.detailValue, { color: theme.primary }]}>
                                {challengeTirsSuccess}/{challengeTirs}
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </>
                  );
                })()}
              </View>
            </Animated.View>
          </>
        )}

        {activeTab === 'point' && (
          <Animated.View 
            entering={FadeInDown.duration(400).delay(200)}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>PERFORMANCE AU POINT</Text>
            <View style={styles.performanceCard}>
              <StatRing 
                value={userStats.pointSuccessRate} 
                label="Point" 
                color={theme.pointColor}
                size={160}
              />
              <View style={styles.performanceDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Points réussis</Text>
                  <Text style={styles.detailValue}>{Math.round(userStats.totalMatches * 12 * userStats.pointSuccessRate / 100)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Points tentés</Text>
                  <Text style={styles.detailValue}>{userStats.totalMatches * 12}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bouchons</Text>
                  <Text style={[styles.detailValue, { color: theme.accent }]}>
                    23
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {activeTab === 'challenges' && (
          <>
            {/* Challenge Stats Overview */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>STATISTIQUES DÉFIS</Text>
              <View style={styles.challengeOverallCard}>
                <View style={styles.challengeOverallStat}>
                  <Text style={styles.challengeOverallValue}>
                    {timeFilter === 'all' ? challengeStats.totalChallenges : filteredChallengeStats.totalChallenges}
                  </Text>
                  <Text style={styles.challengeOverallLabel}>Défis</Text>
                </View>
                <View style={styles.challengeOverallDivider} />
                <View style={styles.challengeOverallStat}>
                  <Text style={styles.challengeOverallValue}>
                    {timeFilter === 'all' ? challengeStats.totalShots : filteredChallengeStats.totalShots}
                  </Text>
                  <Text style={styles.challengeOverallLabel}>Tirs</Text>
                </View>
                <View style={styles.challengeOverallDivider} />
                <View style={styles.challengeOverallStat}>
                  <Text style={[styles.challengeOverallValue, { color: theme.success }]}>
                    {timeFilter === 'all' ? challengeStats.overallSuccessRate : filteredChallengeStats.overallSuccessRate}%
                  </Text>
                  <Text style={styles.challengeOverallLabel}>Réussite</Text>
                </View>
              </View>
            </Animated.View>

            {/* Challenge Types */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(300)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>PAR TYPE DE DÉFI</Text>
              <View style={styles.challengeTypesGrid}>
                {Object.entries(CHALLENGE_CONFIG).map(([type, config]) => {
                  const stats = timeFilter === 'all' 
                    ? challengeStats.byType[type as ChallengeType]
                    : filteredChallengeStats.byType[type as ChallengeType];
                  return (
                    <View key={type} style={styles.challengeTypeCard}>
                      <View style={[styles.challengeTypeIcon, { backgroundColor: config.color + '20' }]}>
                        <MaterialIcons name={config.icon} size={28} color={config.color} />
                      </View>
                      <Text style={styles.challengeTypeName}>{config.name}</Text>
                      <View style={styles.challengeTypeStats}>
                        <View style={styles.challengeTypeStat}>
                          <Text style={[styles.challengeTypeBest, { color: config.color }]}>
                            {stats.bestScore > 0 ? `${stats.bestScore}%` : '-'}
                          </Text>
                          <Text style={styles.challengeTypeStatLabel}>Meilleur</Text>
                        </View>
                        <View style={styles.challengeTypeStat}>
                          <Text style={styles.challengeTypeAvg}>
                            {stats.avgSuccess > 0 ? `${stats.avgSuccess}%` : '-'}
                          </Text>
                          <Text style={styles.challengeTypeStatLabel}>Moyenne</Text>
                        </View>
                      </View>
                      <View style={styles.challengeTypeCountBadge}>
                        <Text style={styles.challengeTypeCount}>{stats.count} essais</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Recent Challenges */}
            {(timeFilter === 'all' ? challengeStats.recentChallenges : filteredChallengeStats.recentChallenges).length > 0 && (
              <Animated.View 
                entering={FadeInDown.duration(400).delay(400)}
                style={styles.section}
              >
                <Text style={styles.sectionTitle}>DÉFIS RÉCENTS</Text>
                {(timeFilter === 'all' ? challengeStats.recentChallenges : filteredChallengeStats.recentChallenges).map((challenge, index) => {
                  const config = CHALLENGE_CONFIG[challenge.type];
                  const score = challenge.type === 'precision' 
                    ? `${challenge.totalPoints || 0}/100` 
                    : `${challenge.successRate || 0}%`;
                  return (
                    <View key={challenge.id} style={styles.recentChallengeCard}>
                      <View style={[styles.recentChallengeIcon, { backgroundColor: config.color + '20' }]}>
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
                      <Text style={[styles.recentChallengeScore, { color: config.color }]}>
                        {score}
                      </Text>
                    </View>
                  );
                })}
              </Animated.View>
            )}

            {/* Empty State */}
            {(timeFilter === 'all' ? challengeStats.totalChallenges : filteredChallengeStats.totalChallenges) === 0 && (
              <Animated.View 
                entering={FadeInDown.duration(400).delay(300)}
                style={styles.emptyChallengesCard}
              >
                <MaterialIcons name="emoji-events" size={64} color={theme.textMuted} />
                <Text style={styles.emptyChallengesTitle}>Aucun défi réalisé</Text>
                <Text style={styles.emptyChallengesText}>
                  Commencez un défi pour voir vos statistiques ici
                </Text>
                <Pressable
                  style={styles.startChallengeButton}
                  onPress={() => router.push('/challenge/new')}
                >
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.startChallengeButtonText}>Nouveau défi</Text>
                </Pressable>
              </Animated.View>
            )}
          </>
        )}

        {activeTab === 'tournois' && (
          <>
            {/* Tournament Overview */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>VUE D'ENSEMBLE TOURNOIS</Text>
              <View style={styles.tournamentOverviewCard}>
                <View style={styles.tournamentOverviewMain}>
                  <View style={styles.tournamentOverviewIcon}>
                    <MaterialIcons name="emoji-events" size={32} color={theme.carreauColor} />
                  </View>
                  <View style={styles.tournamentOverviewStats}>
                    <Text style={styles.tournamentOverviewValue}>{tournamentStats.tournamentsPlayed}</Text>
                    <Text style={styles.tournamentOverviewLabel}>Tournois joués</Text>
                  </View>
                </View>
                <View style={styles.tournamentOverviewDivider} />
                <View style={styles.tournamentOverviewRow}>
                  <View style={styles.tournamentOverviewStat}>
                    <Text style={styles.tournamentStatValue}>{tournamentStats.totalMatches}</Text>
                    <Text style={styles.tournamentStatLabel}>Matchs</Text>
                  </View>
                  <View style={styles.tournamentOverviewStat}>
                    <Text style={[styles.tournamentStatValue, { color: theme.success }]}>{tournamentStats.wins}</Text>
                    <Text style={styles.tournamentStatLabel}>Victoires</Text>
                  </View>
                  <View style={styles.tournamentOverviewStat}>
                    <Text style={[styles.tournamentStatValue, { color: theme.error }]}>{tournamentStats.losses}</Text>
                    <Text style={styles.tournamentStatLabel}>Défaites</Text>
                  </View>
                  <View style={styles.tournamentOverviewStat}>
                    <Text style={[styles.tournamentStatValue, { color: theme.primary }]}>{tournamentStats.winRate}%</Text>
                    <Text style={styles.tournamentStatLabel}>Victoires</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Points Stats */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(300)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>POINTS</Text>
              <View style={styles.pointsStatsCard}>
                <View style={styles.pointsStatsRow}>
                  <View style={styles.pointsStatItem}>
                    <Text style={[styles.pointsStatValue, { color: theme.success }]}>{tournamentStats.totalPointsFor}</Text>
                    <Text style={styles.pointsStatLabel}>Marqués</Text>
                  </View>
                  <View style={styles.pointsStatDivider}>
                    <Text style={styles.pointsDiffValue}>
                      {tournamentStats.pointDiff > 0 ? '+' : ''}{tournamentStats.pointDiff}
                    </Text>
                    <Text style={styles.pointsDiffLabel}>Diff.</Text>
                  </View>
                  <View style={styles.pointsStatItem}>
                    <Text style={[styles.pointsStatValue, { color: theme.error }]}>{tournamentStats.totalPointsAgainst}</Text>
                    <Text style={styles.pointsStatLabel}>Encaissés</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Tir/Point Performance */}
            {(tournamentStats.tirRate !== null || tournamentStats.pointRate !== null) && (
              <Animated.View 
                entering={FadeInDown.duration(400).delay(400)}
                style={styles.section}
              >
                <Text style={styles.sectionTitle}>PERFORMANCE ACTIONS</Text>
                <View style={styles.actionStatsGrid}>
                  {tournamentStats.tirRate !== null && (
                    <View style={[styles.actionStatCard, { backgroundColor: theme.tirColor + '10' }]}>
                      <MaterialIcons name="gps-fixed" size={28} color={theme.tirColor} />
                      <Text style={[styles.actionStatValue, { color: theme.tirColor }]}>{tournamentStats.tirRate}%</Text>
                      <Text style={styles.actionStatLabel}>Tir</Text>
                      <Text style={styles.actionStatDetail}>
                        {tournamentStats.totalTirsSuccess}/{tournamentStats.totalTirs}
                      </Text>
                    </View>
                  )}
                  {tournamentStats.pointRate !== null && (
                    <View style={[styles.actionStatCard, { backgroundColor: theme.pointColor + '10' }]}>
                      <MaterialIcons name="adjust" size={28} color={theme.pointColor} />
                      <Text style={[styles.actionStatValue, { color: theme.pointColor }]}>{tournamentStats.pointRate}%</Text>
                      <Text style={styles.actionStatLabel}>Point</Text>
                      <Text style={styles.actionStatDetail}>
                        {tournamentStats.totalPointsSuccess}/{tournamentStats.totalPoints}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.actionStatCard, { backgroundColor: theme.carreauColor + '10' }]}>
                    <MaterialIcons name="stars" size={28} color={theme.carreauColor} />
                    <Text style={[styles.actionStatValue, { color: theme.carreauColor }]}>{tournamentStats.carreauRate}%</Text>
                    <Text style={styles.actionStatLabel}>Carreau</Text>
                    <Text style={styles.actionStatDetail}>{tournamentStats.totalCarreaux} réussis</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Phase Stats */}
            {Object.keys(tournamentStats.phaseStats).length > 0 && (
              <Animated.View 
                entering={FadeInDown.duration(400).delay(500)}
                style={styles.section}
              >
                <Text style={styles.sectionTitle}>PAR PHASE</Text>
                <View style={styles.phaseStatsCard}>
                  {Object.entries(tournamentStats.phaseStats).map(([phase, stats]) => {
                    const phaseWinRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
                    return (
                      <View key={phase} style={styles.phaseStatRow}>
                        <Text style={styles.phaseName}>{phase}</Text>
                        <View style={styles.phaseStatValues}>
                          <Text style={styles.phaseRecord}>
                            <Text style={{ color: theme.success }}>{stats.wins}</Text>
                            <Text style={{ color: theme.textMuted }}> - </Text>
                            <Text style={{ color: theme.error }}>{stats.played - stats.wins}</Text>
                          </Text>
                          <View style={[
                            styles.phaseWinRateBadge,
                            { backgroundColor: phaseWinRate >= 50 ? theme.success + '15' : theme.error + '15' }
                          ]}>
                            <Text style={[
                              styles.phaseWinRateText,
                              { color: phaseWinRate >= 50 ? theme.success : theme.error }
                            ]}>
                              {phaseWinRate}%
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {/* Empty State */}
            {tournamentStats.totalMatches === 0 && (
              <Animated.View 
                entering={FadeInDown.duration(400).delay(300)}
                style={styles.emptyStateCard}
              >
                <MaterialIcons name="emoji-events" size={64} color={theme.textMuted} />
                <Text style={styles.emptyStateTitle}>Aucun match de tournoi</Text>
                <Text style={styles.emptyStateText}>
                  Créez un tournoi et enregistrez vos matchs pour voir vos statistiques
                </Text>
              </Animated.View>
            )}
          </>
        )}

        {activeTab === 'entrainement' && (
          <>
            {/* Training Overview */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>VUE D'ENSEMBLE ENTRAÎNEMENT</Text>
              <View style={styles.trainingOverviewCard}>
                <View style={styles.trainingOverviewMain}>
                  <View style={styles.trainingOverviewIcon}>
                    <MaterialIcons name="fitness-center" size={32} color={theme.primary} />
                  </View>
                  <View style={styles.trainingOverviewStats}>
                    <Text style={styles.trainingOverviewValue}>{trainingStats.totalMatches}</Text>
                    <Text style={styles.trainingOverviewLabel}>Matchs d'entraînement</Text>
                  </View>
                </View>
                <View style={styles.trainingOverviewDivider} />
                <View style={styles.trainingOverviewRow}>
                  <View style={styles.trainingOverviewStat}>
                    <Text style={[styles.trainingStatValue, { color: theme.success }]}>{trainingStats.wins}</Text>
                    <Text style={styles.trainingStatLabel}>Victoires</Text>
                  </View>
                  <View style={styles.trainingOverviewStat}>
                    <Text style={[styles.trainingStatValue, { color: theme.error }]}>{trainingStats.losses}</Text>
                    <Text style={styles.trainingStatLabel}>Défaites</Text>
                  </View>
                  <View style={styles.trainingOverviewStat}>
                    <Text style={[styles.trainingStatValue, { color: theme.primary }]}>{trainingStats.winRate}%</Text>
                    <Text style={styles.trainingStatLabel}>Taux</Text>
                  </View>
                  <View style={styles.trainingOverviewStat}>
                    <Text style={styles.trainingStatValue}>{trainingStats.avgDuration}</Text>
                    <Text style={styles.trainingStatLabel}>Min/match</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Win Rate Ring */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(300)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>TAUX DE VICTOIRE</Text>
              <View style={styles.winRateCard}>
                <StatRing 
                  value={trainingStats.winRate} 
                  label="Victoires" 
                  color={theme.primary}
                  size={140}
                />
                <View style={styles.winRateStats}>
                  <View style={styles.winRateStatItem}>
                    <Text style={[styles.winRateStatValue, { color: theme.success }]}>
                      {trainingStats.totalPointsFor}
                    </Text>
                    <Text style={styles.winRateStatLabel}>Points marqués</Text>
                  </View>
                  <View style={styles.winRateStatItem}>
                    <Text style={[styles.winRateStatValue, { color: theme.error }]}>
                      {trainingStats.totalPointsAgainst}
                    </Text>
                    <Text style={styles.winRateStatLabel}>Points encaissés</Text>
                  </View>
                  <View style={styles.winRateStatItem}>
                    <Text style={[styles.winRateStatValue, { color: trainingStats.pointDiff >= 0 ? theme.success : theme.error }]}>
                      {trainingStats.pointDiff > 0 ? '+' : ''}{trainingStats.pointDiff}
                    </Text>
                    <Text style={styles.winRateStatLabel}>Différence</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Tir/Point Performance */}
            {(trainingStats.tirRate !== null || trainingStats.pointRate !== null) && (
              <Animated.View 
                entering={FadeInDown.duration(400).delay(400)}
                style={styles.section}
              >
                <Text style={styles.sectionTitle}>PERFORMANCE ACTIONS</Text>
                <View style={styles.actionStatsGrid}>
                  {trainingStats.tirRate !== null && (
                    <View style={[styles.actionStatCard, { backgroundColor: theme.tirColor + '10' }]}>
                      <MaterialIcons name="gps-fixed" size={28} color={theme.tirColor} />
                      <Text style={[styles.actionStatValue, { color: theme.tirColor }]}>{trainingStats.tirRate}%</Text>
                      <Text style={styles.actionStatLabel}>Tir</Text>
                      <Text style={styles.actionStatDetail}>
                        {trainingStats.totalTirsSuccess}/{trainingStats.totalTirs}
                      </Text>
                    </View>
                  )}
                  {trainingStats.pointRate !== null && (
                    <View style={[styles.actionStatCard, { backgroundColor: theme.pointColor + '10' }]}>
                      <MaterialIcons name="adjust" size={28} color={theme.pointColor} />
                      <Text style={[styles.actionStatValue, { color: theme.pointColor }]}>{trainingStats.pointRate}%</Text>
                      <Text style={styles.actionStatLabel}>Point</Text>
                      <Text style={styles.actionStatDetail}>
                        {trainingStats.totalPointsSuccess}/{trainingStats.totalPoints}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.actionStatCard, { backgroundColor: theme.carreauColor + '10' }]}>
                    <MaterialIcons name="stars" size={28} color={theme.carreauColor} />
                    <Text style={[styles.actionStatValue, { color: theme.carreauColor }]}>{trainingStats.carreauRate}%</Text>
                    <Text style={styles.actionStatLabel}>Carreau</Text>
                    <Text style={styles.actionStatDetail}>{trainingStats.totalCarreaux} réussis</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Empty State */}
            {trainingStats.totalMatches === 0 && (
              <Animated.View 
                entering={FadeInDown.duration(400).delay(300)}
                style={styles.emptyStateCard}
              >
                <MaterialIcons name="fitness-center" size={64} color={theme.textMuted} />
                <Text style={styles.emptyStateTitle}>Aucun match d'entraînement</Text>
                <Text style={styles.emptyStateText}>
                  Enregistrez vos matchs d'entraînement pour suivre votre progression
                </Text>
                <Pressable
                  style={styles.emptyStateButton}
                  onPress={() => router.push('/match/new')}
                >
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.emptyStateButtonText}>Nouveau match</Text>
                </Pressable>
              </Animated.View>
            )}
          </>
        )}

        {activeTab === 'terrains' && (
          <>
            {/* Terrain Stats Overview */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(200)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>RÉSULTATS PAR TYPE DE TERRAIN</Text>
              <Text style={styles.terrainStatsSubtitle}>
                Statistiques basées sur vos matchs de tournoi
              </Text>
            </Animated.View>

            {/* Terrain Type Cards */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(300)}
              style={styles.section}
            >
              {Object.entries(terrainTypeStats).map(([type, stats], index) => {
                const typeColors: Record<string, { bg: string; icon: string }> = {
                  'Stabilisé': { bg: theme.primary, icon: 'landscape' },
                  'Graviers': { bg: theme.warning, icon: 'grain' },
                  'Sable': { bg: '#F59E0B', icon: 'beach-access' },
                  'Cailloux': { bg: theme.textSecondary, icon: 'terrain' },
                  'Terre battue': { bg: theme.success, icon: 'grass' },
                };
                const color = typeColors[type] || typeColors['Stabilisé'];
                
                return (
                  <Animated.View
                    key={type}
                    entering={FadeInDown.duration(400).delay(300 + index * 50)}
                    style={styles.terrainTypeCard}
                  >
                    <View style={styles.terrainTypeHeader}>
                      <View style={[styles.terrainTypeIcon, { backgroundColor: color.bg + '20' }]}>
                        <MaterialIcons name={color.icon as any} size={28} color={color.bg} />
                      </View>
                      <View style={styles.terrainTypeInfo}>
                        <Text style={styles.terrainTypeName}>{type}</Text>
                        <Text style={styles.terrainTypeMatches}>
                          {stats.matches} match{stats.matches !== 1 ? 's' : ''} joué{stats.matches !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {stats.matches > 0 && (
                        <View style={[
                          styles.terrainWinRateBadge,
                          { backgroundColor: stats.winRate >= 50 ? theme.success + '15' : theme.error + '15' }
                        ]}>
                          <Text style={[
                            styles.terrainWinRateText,
                            { color: stats.winRate >= 50 ? theme.success : theme.error }
                          ]}>
                            {stats.winRate}%
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    {stats.matches > 0 ? (
                      <View style={styles.terrainTypeStats}>
                        <View style={styles.terrainTypeStat}>
                          <Text style={[styles.terrainTypeStatValue, { color: theme.success }]}>
                            {stats.wins}
                          </Text>
                          <Text style={styles.terrainTypeStatLabel}>Victoires</Text>
                        </View>
                        <View style={styles.terrainTypeStatDivider} />
                        <View style={styles.terrainTypeStat}>
                          <Text style={[styles.terrainTypeStatValue, { color: theme.error }]}>
                            {stats.losses}
                          </Text>
                          <Text style={styles.terrainTypeStatLabel}>Défaites</Text>
                        </View>
                        <View style={styles.terrainTypeStatDivider} />
                        <View style={styles.terrainTypeStat}>
                          <Text style={styles.terrainTypeStatValue}>
                            {stats.pointsFor}
                          </Text>
                          <Text style={styles.terrainTypeStatLabel}>Pts marqués</Text>
                        </View>
                        <View style={styles.terrainTypeStatDivider} />
                        <View style={styles.terrainTypeStat}>
                          <Text style={styles.terrainTypeStatValue}>
                            {stats.pointsAgainst}
                          </Text>
                          <Text style={styles.terrainTypeStatLabel}>Pts encaissés</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.terrainNoMatchesContainer}>
                        <Text style={styles.terrainNoMatchesText}>
                          Aucun match sur ce type de terrain
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </Animated.View>

            {/* Terrain Tips */}
            <Animated.View 
              entering={FadeInDown.duration(400).delay(600)}
              style={styles.section}
            >
              <View style={styles.terrainTipsCard}>
                <MaterialIcons name="lightbulb" size={24} color={theme.warning} />
                <View style={styles.terrainTipsContent}>
                  <Text style={styles.terrainTipsTitle}>Conseil</Text>
                  <Text style={styles.terrainTipsText}>
                    Analysez vos performances par type de terrain pour identifier vos points forts et adapter votre jeu.
                  </Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}

        {activeTab === 'matchups' && (
          <Animated.View 
            entering={FadeInDown.duration(400).delay(200)}
            style={styles.section}
          >
            <Text style={styles.sectionTitle}>FACE À FACE</Text>
            {userStats.recentOpponents.map((opponent, index) => {
              const total = opponent.wins + opponent.losses;
              const winRate = Math.round((opponent.wins / total) * 100);
              
              return (
                <View key={opponent.id} style={styles.opponentCard}>
                  <View style={styles.opponentInfo}>
                    <View style={styles.opponentAvatar}>
                      <Text style={styles.opponentInitials}>
                        {opponent.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.opponentName}>{opponent.name}</Text>
                      <Text style={styles.opponentMeta}>
                        {total} confrontations
                      </Text>
                    </View>
                  </View>
                  <View style={styles.opponentStats}>
                    <View style={styles.opponentRecord}>
                      <Text style={[styles.recordValue, { color: theme.success }]}>
                        {opponent.wins}
                      </Text>
                      <Text style={styles.recordSeparator}>-</Text>
                      <Text style={[styles.recordValue, { color: theme.error }]}>
                        {opponent.losses}
                      </Text>
                    </View>
                    <View style={[
                      styles.winRateBadge,
                      { backgroundColor: winRate >= 50 ? theme.successLight : theme.errorLight }
                    ]}>
                      <Text style={[
                        styles.winRateText,
                        { color: winRate >= 50 ? theme.success : theme.error }
                      ]}>
                        {winRate}%
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            
            {/* Empty state hint */}
            <View style={styles.hintCard}>
              <Image
                source={require('@/assets/images/empty-stats.png')}
                style={styles.hintImage}
                contentFit="contain"
              />
              <Text style={styles.hintText}>
                Jouez plus de matchs pour enrichir vos statistiques adversaires
              </Text>
            </View>
          </Animated.View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  compareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    marginTop: 4,
  },
  tabsContainer: {
    paddingBottom: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.surface,
  },
  tabActive: {
    backgroundColor: theme.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
  },
  // Time filter styles
  timeFilterWrapper: {
    marginBottom: 16,
  },
  timeFilterButtonSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
    ...theme.shadows.card,
  },
  timeFilterButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
  },
  // Time Filter Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  timeFilterModalContent: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  timeFilterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  timeFilterModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  timeFilterModalOptions: {
    padding: 8,
  },
  timeFilterModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
  },
  timeFilterModalOptionActive: {
    backgroundColor: theme.primary + '15',
  },
  timeFilterModalOptionText: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  timeFilterModalOptionTextActive: {
    fontWeight: '600',
    color: theme.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 30,
    marginTop: 8,
  },
  chartLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    width: (chartWidth - 60) / 7,
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '47%',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  // Win Rate Card
  winRateCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.cardElevated,
  },
  winRateStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  winRateStatItem: {
    alignItems: 'center',
  },
  winRateStatValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  winRateStatLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  // Performance Grid
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  perfCard: {
    width: '47%',
    padding: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  perfValue: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  perfLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  performanceCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  statRingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRingValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  statRingLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
  performanceDetails: {
    width: '100%',
    marginTop: 24,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  detailLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  opponentCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    ...theme.shadows.card,
  },
  opponentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  opponentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opponentInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  opponentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  opponentMeta: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  opponentStats: {
    alignItems: 'flex-end',
  },
  opponentRecord: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  recordSeparator: {
    fontSize: 18,
    color: theme.textMuted,
  },
  winRateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginTop: 4,
  },
  winRateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hintCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 24,
    alignItems: 'center',
    marginTop: 12,
    ...theme.shadows.card,
  },
  hintImage: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  hintText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  historyCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    ...theme.shadows.card,
  },
  historyDate: {
    width: 50,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.border,
    paddingRight: 12,
    marginRight: 12,
  },
  historyDay: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  historyMonth: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  historyContent: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  historyFormat: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  historyTeams: {
    fontSize: 13,
    color: theme.textPrimary,
  },
  historyScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  historyScoreText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  historyScoreWin: {
    color: theme.success,
  },
  historyScoreSeparator: {
    fontSize: 14,
    color: theme.textMuted,
  },
  // Challenge stats styles
  challengeOverallCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  challengeOverallStat: {
    flex: 1,
    alignItems: 'center',
  },
  challengeOverallValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  challengeOverallLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  challengeOverallDivider: {
    width: 1,
    backgroundColor: theme.border,
    marginHorizontal: 12,
  },
  challengeTypesGrid: {
    gap: 12,
  },
  challengeTypeCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  challengeTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  challengeTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  challengeTypeStats: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 12,
  },
  challengeTypeStat: {
    alignItems: 'center',
  },
  challengeTypeBest: {
    fontSize: 24,
    fontWeight: '700',
  },
  challengeTypeAvg: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  challengeTypeStatLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  challengeTypeCountBadge: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  challengeTypeCount: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  recentChallengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  recentChallengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentChallengeInfo: {
    flex: 1,
  },
  recentChallengeName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  recentChallengeDate: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  recentChallengeScore: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyChallengesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    marginTop: 24,
    ...theme.shadows.card,
  },
  emptyChallengesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyChallengesText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  startChallengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  startChallengeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  // Challenge history styles
  challengeHistoryCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    ...theme.shadows.card,
  },
  challengeHistoryDate: {
    width: 50,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.border,
    paddingRight: 12,
    marginRight: 12,
  },
  challengeHistoryDay: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  challengeHistoryMonth: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  challengeHistoryContent: {
    flex: 1,
  },
  challengeHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  challengeHistoryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeHistoryType: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  challengeHistoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  challengeHistoryTime: {
    fontSize: 12,
    color: theme.textMuted,
  },
  challengeHistoryCarreaux: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  challengeHistoryCarreauxText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.carreauColor,
  },
  challengeHistoryScore: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 12,
  },
  emptyChallengeHistory: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 32,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyChallengeHistoryText: {
    fontSize: 15,
    color: theme.textMuted,
    marginTop: 12,
  },
  emptyHistoryCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 32,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyHistoryText: {
    fontSize: 15,
    color: theme.textMuted,
    marginTop: 12,
  },
  // Terrain stats styles
  terrainStatsSubtitle: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: -8,
    marginBottom: 8,
  },
  terrainTypeCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  terrainTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  terrainTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  terrainTypeInfo: {
    flex: 1,
  },
  terrainTypeName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  terrainTypeMatches: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  terrainWinRateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  terrainWinRateText: {
    fontSize: 15,
    fontWeight: '700',
  },
  terrainTypeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  terrainTypeStat: {
    alignItems: 'center',
    flex: 1,
  },
  terrainTypeStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  terrainTypeStatLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  terrainTypeStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.border,
  },
  terrainNoMatchesContainer: {
    paddingVertical: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    alignItems: 'center',
  },
  terrainNoMatchesText: {
    fontSize: 13,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  terrainTipsCard: {
    flexDirection: 'row',
    backgroundColor: theme.warning + '10',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.warning + '30',
  },
  terrainTipsContent: {
    flex: 1,
  },
  terrainTipsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.warning,
    marginBottom: 4,
  },
  terrainTipsText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  // Include challenges toggle
  includeChallengesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  includeChallengesToggleActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '08',
  },
  includeChallengesInfo: {
    flex: 1,
    marginLeft: 12,
  },
  includeChallengesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  includeChallengesTitleActive: {
    color: theme.primary,
  },
  includeChallengesSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  includeChallengesBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  includeChallengesBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  detailDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 8,
  },
  // Tournament stats styles
  tournamentOverviewCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  tournamentOverviewMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tournamentOverviewIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: theme.carreauColor + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  tournamentOverviewStats: {
    flex: 1,
  },
  tournamentOverviewValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  tournamentOverviewLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  tournamentOverviewDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 12,
  },
  tournamentOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tournamentOverviewStat: {
    alignItems: 'center',
  },
  tournamentStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  tournamentStatLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  // Points stats
  pointsStatsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  pointsStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  pointsStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  pointsStatValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  pointsStatLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  pointsStatDivider: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  pointsDiffValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  pointsDiffLabel: {
    fontSize: 11,
    color: theme.textMuted,
  },
  // Action stats grid
  actionStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionStatCard: {
    flex: 1,
    minWidth: '30%',
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  actionStatValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  actionStatLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  actionStatDetail: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 4,
  },
  // Phase stats
  phaseStatsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  phaseStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  phaseName: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  phaseStatValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phaseRecord: {
    fontSize: 15,
    fontWeight: '600',
  },
  phaseWinRateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  phaseWinRateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Empty state
  emptyStateCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 40,
    alignItems: 'center',
    marginTop: 24,
    ...theme.shadows.card,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  // Training stats styles
  trainingOverviewCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  trainingOverviewMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  trainingOverviewIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  trainingOverviewStats: {
    flex: 1,
  },
  trainingOverviewValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  trainingOverviewLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  trainingOverviewDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 12,
  },
  trainingOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  trainingOverviewStat: {
    alignItems: 'center',
  },
  trainingStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  trainingStatLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
});
