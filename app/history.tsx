
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn, FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { ChallengeType, Match, Challenge } from '@/services/mockData';

const CHALLENGE_CONFIG = {
  '10_tirs': { name: '10 Tirs', icon: 'gps-fixed' as const, color: '#F97316' },
  '10_tirs_sautee': { name: 'Tirs Sautée', icon: 'sports' as const, color: '#3B82F6' },
  'precision': { name: 'Précision', icon: 'stars' as const, color: '#F59E0B' },
};

type TimeFilter = 'today' | 'week' | 'month' | 'year' | 'all';
type HistoryTab = 'all' | 'matches' | 'challenges';

const TIME_FILTERS: { id: TimeFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'Tout', icon: 'all-inclusive' },
  { id: 'today', label: "Aujourd'hui", icon: 'today' },
  { id: 'week', label: 'Semaine', icon: 'date-range' },
  { id: 'month', label: 'Mois', icon: 'calendar-today' },
  { id: 'year', label: 'Année', icon: 'event' },
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

function groupByDate(items: { type: 'match' | 'challenge'; data: Match | Challenge; date: string }[]) {
  const groups: Record<string, typeof items> = {};
  
  items.forEach(item => {
    const date = new Date(item.date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = "Hier";
    } else if (date.getFullYear() === today.getFullYear()) {
      key = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    } else {
      key = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });
  
  return Object.entries(groups).map(([title, data]) => ({
    title,
    data,
    date: new Date(data[0].date),
  })).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { matches, challenges } = useApp();
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const filteredMatches = filterByTime(matches, timeFilter);
  const filteredChallenges = filterByTime(challenges, timeFilter);

  const groupedHistory = useMemo(() => {
    const matchItems = filteredMatches.map(m => ({ type: 'match' as const, data: m, date: m.date }));
    const challengeItems = filteredChallenges.map(c => ({ type: 'challenge' as const, data: c, date: c.date }));
    
    let items = [];
    if (activeTab === 'all') {
      items = [...matchItems, ...challengeItems];
    } else if (activeTab === 'matches') {
      items = matchItems;
    } else {
      items = challengeItems;
    }
    
    const sorted = items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return groupByDate(sorted);
  }, [filteredMatches, filteredChallenges, activeTab]);

  const renderMatchCard = (match: Match, index: number) => {
    const isWin = match.winner === 'A';
    
    return (
      <Pressable 
        style={styles.matchCard}
        onPress={() => {
          Haptics.selectionAsync();
          router.push(`/match/${match.id}`);
        }}
      >
        {/* Left accent */}
        <View style={[styles.matchAccent, { backgroundColor: isWin ? theme.success : theme.error }]} />
        
        <View style={styles.matchBody}>
          {/* Top row - Mode badge and time */}
          <View style={styles.matchTopRow}>
            <View style={[
              styles.modeBadge,
              { backgroundColor: match.mode === 'Tournoi' ? theme.carreauColor + '20' : theme.primary + '20' }
            ]}>
              <MaterialIcons 
                name={match.mode === 'Tournoi' ? 'emoji-events' : 'fitness-center'} 
                size={14} 
                color={match.mode === 'Tournoi' ? theme.carreauColor : theme.primary} 
              />
              <Text style={[
                styles.modeBadgeText,
                { color: match.mode === 'Tournoi' ? theme.carreauColor : theme.primary }
              ]}>
                {match.mode === 'Tournoi' ? match.tournamentName || 'Tournoi' : 'Entraînement'}
              </Text>
            </View>
            <Text style={styles.matchTime}>
              {new Date(match.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {/* Score section - Main visual element */}
          <View style={styles.scoreSection}>
            <View style={styles.teamBlock}>
              <Text style={styles.teamName} numberOfLines={1}>Mon équipe</Text>
              <Text style={styles.teamPlayers} numberOfLines={1}>
                {match.teamA.playerNames.slice(0, 2).join(', ')}
              </Text>
            </View>
            
            <View style={styles.scoreBubble}>
              <Text style={[styles.scoreNumber, isWin && styles.scoreWin]}>{match.teamA.score}</Text>
              <View style={styles.scoreDivider} />
              <Text style={[styles.scoreNumber, !isWin && styles.scoreLoss]}>{match.teamB.score}</Text>
            </View>
            
            <View style={[styles.teamBlock, styles.teamBlockRight]}>
              <Text style={styles.teamName} numberOfLines={1}>Adversaire</Text>
              <Text style={styles.teamPlayers} numberOfLines={1}>
                {match.teamB.playerNames.slice(0, 2).join(', ')}
              </Text>
            </View>
          </View>

          {/* Bottom row - Result and format */}
          <View style={styles.matchBottomRow}>
            <View style={[styles.resultChip, { backgroundColor: isWin ? theme.success + '15' : theme.error + '15' }]}>
              <MaterialIcons 
                name={isWin ? 'check-circle' : 'cancel'} 
                size={14} 
                color={isWin ? theme.success : theme.error} 
              />
              <Text style={[styles.resultChipText, { color: isWin ? theme.success : theme.error }]}>
                {isWin ? 'Victoire' : 'Défaite'}
              </Text>
            </View>
            <View style={styles.matchMeta}>
              <Text style={styles.matchMetaText}>{match.format}</Text>
              {match.duration > 0 && (
                <>
                  <View style={styles.metaDot} />
                  <Text style={styles.matchMetaText}>{match.duration} min</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderChallengeCard = (challenge: Challenge) => {
    const config = CHALLENGE_CONFIG[challenge.type];
    const score = challenge.type === 'precision' 
      ? challenge.totalPoints || 0
      : challenge.successRate || 0;
    const maxScore = challenge.type === 'precision' ? 100 : 100;
    const percentage = Math.min(100, (score / maxScore) * 100);
    const carreaux = challenge.type === 'precision'
      ? challenge.precisionShots?.filter(s => s.points === 5).length || 0
      : challenge.carreauCount || 0;
    
    return (
      <View style={styles.challengeCard}>
        {/* Icon */}
        <View style={[styles.challengeIcon, { backgroundColor: config.color + '15' }]}>
          <MaterialIcons name={config.icon} size={22} color={config.color} />
        </View>
        
        {/* Content */}
        <View style={styles.challengeContent}>
          <View style={styles.challengeTopRow}>
            <Text style={styles.challengeName}>{config.name}</Text>
            <Text style={styles.challengeTime}>
              {new Date(challenge.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          {/* Score bar */}
          <View style={styles.challengeScoreRow}>
            <View style={styles.challengeBarContainer}>
              <View 
                style={[
                  styles.challengeBar, 
                  { width: `${percentage}%`, backgroundColor: config.color }
                ]} 
              />
            </View>
            <Text style={[styles.challengeScore, { color: config.color }]}>
              {score}{challenge.type === 'precision' ? 'pts' : '%'}
            </Text>
          </View>
          
          {/* Bottom stats */}
          <View style={styles.challengeStatsRow}>
            {challenge.successCount !== undefined && (
              <View style={styles.challengeStat}>
                <MaterialIcons name="check" size={12} color={theme.success} />
                <Text style={styles.challengeStatText}>
                  {challenge.successCount}/{challenge.totalShots}
                </Text>
              </View>
            )}
            {carreaux > 0 && (
              <View style={styles.challengeStat}>
                <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
                <Text style={[styles.challengeStatText, { color: theme.carreauColor }]}>
                  {carreaux} carreau{carreaux > 1 ? 'x' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Historique</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Time Filter Pills */}
      <Animated.View 
        entering={FadeInDown.duration(300).delay(50)}
        style={styles.filterSection}
      >
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {TIME_FILTERS.map((filter, index) => (
            <Animated.View 
              key={filter.id}
              entering={FadeInRight.duration(200).delay(index * 40)}
            >
              <Pressable
                style={[
                  styles.filterPill,
                  timeFilter === filter.id && styles.filterPillActive
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTimeFilter(filter.id);
                }}
              >
                <Text style={[
                  styles.filterPillText,
                  timeFilter === filter.id && styles.filterPillTextActive
                ]}>
                  {filter.label}
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Segmented Tabs */}
      <Animated.View 
        entering={FadeInDown.duration(300).delay(100)}
        style={styles.segmentedControl}
      >
        <Pressable
          style={[styles.segment, activeTab === 'all' && styles.segmentActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('all');
          }}
        >
          <Text style={[styles.segmentText, activeTab === 'all' && styles.segmentTextActive]}>
            Tout
          </Text>
          {activeTab === 'all' && <View style={styles.segmentBadge}>
            <Text style={styles.segmentBadgeText}>{filteredMatches.length + filteredChallenges.length}</Text>
          </View>}
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'matches' && styles.segmentActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('matches');
          }}
        >
          <MaterialIcons 
            name="sports" 
            size={16} 
            color={activeTab === 'matches' ? '#FFF' : theme.textSecondary} 
          />
          <Text style={[styles.segmentText, activeTab === 'matches' && styles.segmentTextActive]}>
            Matchs
          </Text>
          {activeTab === 'matches' && <View style={styles.segmentBadge}>
            <Text style={styles.segmentBadgeText}>{filteredMatches.length}</Text>
          </View>}
        </Pressable>
        <Pressable
          style={[styles.segment, activeTab === 'challenges' && styles.segmentActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('challenges');
          }}
        >
          <MaterialIcons 
            name="gps-fixed" 
            size={16} 
            color={activeTab === 'challenges' ? '#FFF' : theme.textSecondary} 
          />
          <Text style={[styles.segmentText, activeTab === 'challenges' && styles.segmentTextActive]}>
            Défis
          </Text>
          {activeTab === 'challenges' && <View style={styles.segmentBadge}>
            <Text style={styles.segmentBadgeText}>{filteredChallenges.length}</Text>
          </View>}
        </Pressable>
      </Animated.View>

      {/* History List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {groupedHistory.length > 0 ? (
          groupedHistory.map((section, sectionIndex) => (
            <Animated.View 
              key={section.title}
              entering={FadeInDown.duration(300).delay(150 + sectionIndex * 50)}
            >
              {/* Date Header */}
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{section.title}</Text>
                <View style={styles.dateHeaderLine} />
              </View>
              
              {/* Items */}
              {section.data.map((item, index) => (
                <Animated.View
                  key={`${item.type}-${item.type === 'match' ? (item.data as Match).id : (item.data as Challenge).id}`}
                  entering={FadeIn.duration(200).delay(index * 30)}
                >
                  {item.type === 'match' 
                    ? renderMatchCard(item.data as Match, index)
                    : renderChallengeCard(item.data as Challenge)
                  }
                </Animated.View>
              ))}
            </Animated.View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="history" size={56} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Aucune activité</Text>
            <Text style={styles.emptyText}>
              {timeFilter !== 'all' 
                ? `Rien pour ${TIME_FILTERS.find(f => f.id === timeFilter)?.label.toLowerCase()}`
                : 'Vos matchs et défis apparaîtront ici'
              }
            </Text>
            {timeFilter !== 'all' && (
              <Pressable 
                style={styles.emptyButton}
                onPress={() => setTimeFilter('all')}
              >
                <Text style={styles.emptyButtonText}>Voir tout</Text>
              </Pressable>
            )}
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  // Filter pills
  filterSection: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterPillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFF',
  },
  // Segmented control
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 4,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.card,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  segmentActive: {
    backgroundColor: theme.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  segmentTextActive: {
    color: '#FFF',
  },
  segmentBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  segmentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  // Scroll
  scrollView: {
    flex: 1,
    marginTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Date header
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
    marginLeft: 12,
  },
  // Match card - redesigned
  matchCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 12,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  matchAccent: {
    width: 5,
  },
  matchBody: {
    flex: 1,
    padding: 14,
  },
  matchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchTime: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '500',
  },
  // Score section
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamBlock: {
    flex: 1,
  },
  teamBlockRight: {
    alignItems: 'flex-end',
  },
  teamName: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  teamPlayers: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  scoreBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 12,
  },
  scoreNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.textSecondary,
    minWidth: 28,
    textAlign: 'center',
  },
  scoreWin: {
    color: theme.success,
  },
  scoreLoss: {
    color: theme.error,
  },
  scoreDivider: {
    width: 2,
    height: 20,
    backgroundColor: theme.border,
    marginHorizontal: 8,
    borderRadius: 1,
  },
  // Bottom row
  matchBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  resultChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchMetaText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.textMuted,
    marginHorizontal: 6,
  },
  // Challenge card - compact
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  challengeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  challengeContent: {
    flex: 1,
  },
  challengeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  challengeName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  challengeTime: {
    fontSize: 12,
    color: theme.textMuted,
  },
  challengeScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  challengeBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  challengeBar: {
    height: '100%',
    borderRadius: 3,
  },
  challengeScore: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'right',
  },
  challengeStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  challengeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  challengeStatText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...theme.shadows.card,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.full,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
});
