import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { Match, Challenge } from '@/services/mockData';

// Constants
const CHALLENGE_CONFIG = {
  '10_tirs': { name: '10 Tirs', icon: 'gps-fixed' as const, color: '#F97316' },
  '10_tirs_sautee': { name: 'Tirs Sautée', icon: 'sports' as const, color: '#3B82F6' },
  'precision': { name: 'Précision', icon: 'stars' as const, color: '#F59E0B' },
} as const;

type ContentFilter = 'all' | 'training' | 'tournament' | 'challenges';
type PeriodOption = 'all' | 'week' | '2weeks' | 'month' | '3months' | '6months' | 'year';

const PERIOD_OPTIONS: { id: PeriodOption; label: string; days: number }[] = [
  { id: 'all', label: 'Tout', days: 0 },
  { id: 'week', label: '7 jours', days: 7 },
  { id: '2weeks', label: '2 semaines', days: 14 },
  { id: 'month', label: '1 mois', days: 30 },
  { id: '3months', label: '3 mois', days: 90 },
  { id: '6months', label: '6 mois', days: 180 },
  { id: 'year', label: '1 an', days: 365 },
];

const CONTENT_FILTERS: { id: ContentFilter; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'all', label: 'Tout', icon: 'layers' },
  { id: 'training', label: 'Entraînements', icon: 'fitness-center' },
  { id: 'tournament', label: 'Tournois', icon: 'emoji-events' },
  { id: 'challenges', label: 'Défis', icon: 'track-changes' },
];

// Types
type HistoryItem = 
  | { type: 'match'; data: Match; date: string }
  | { type: 'challenge'; data: Challenge; date: string }
  | { type: 'header'; title: string; date: string };

// Utility functions
const getDateKey = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const filterByPeriod = <T extends { date: string }>(items: T[], days: number): T[] => {
  if (days === 0) return items;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter(item => new Date(item.date) >= cutoff);
};

// Components
const MatchCard = React.memo(({ match, onPress }: { match: Match; onPress: () => void }) => {
  const isWin = match.winner === 'A';
  const isTournament = match.mode === 'Tournoi';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.cardIndicator, { backgroundColor: isWin ? theme.success : theme.error }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: isTournament ? theme.carreauColor + '15' : theme.primary + '15' }]}>
            <MaterialIcons 
              name={isTournament ? 'emoji-events' : 'fitness-center'} 
              size={12} 
              color={isTournament ? theme.carreauColor : theme.primary} 
            />
            <Text style={[styles.badgeText, { color: isTournament ? theme.carreauColor : theme.primary }]}>
              {isTournament ? 'Tournoi' : 'Entraînement'}
            </Text>
          </View>
          <Text style={styles.timeText}>
            {new Date(match.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {isTournament && match.tournamentName && (
          <Text style={styles.tournamentName} numberOfLines={1}>{match.tournamentName}</Text>
        )}

        <View style={styles.scoreRow}>
          <View style={styles.teamCol}>
            <Text style={styles.teamLabel}>MOI</Text>
            <Text style={styles.teamNames} numberOfLines={1}>
              {match.teamA.playerNames.slice(0, 2).join(' • ')}
            </Text>
          </View>
          
          <View style={styles.scoreBox}>
            <Text style={[styles.scoreNum, isWin && styles.scoreWin]}>{match.teamA.score}</Text>
            <Text style={styles.scoreSep}>-</Text>
            <Text style={[styles.scoreNum, !isWin && styles.scoreLoss]}>{match.teamB.score}</Text>
          </View>
          
          <View style={[styles.teamCol, styles.teamRight]}>
            <Text style={styles.teamLabel}>ADV</Text>
            <Text style={styles.teamNames} numberOfLines={1}>
              {match.teamB.playerNames.slice(0, 2).join(' • ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.resultBadge, { backgroundColor: isWin ? theme.success + '15' : theme.error + '15' }]}>
            <MaterialIcons name={isWin ? 'check-circle' : 'cancel'} size={12} color={isWin ? theme.success : theme.error} />
            <Text style={[styles.resultText, { color: isWin ? theme.success : theme.error }]}>
              {isWin ? 'Victoire' : 'Défaite'}
            </Text>
          </View>
          <Text style={styles.formatText}>{match.format}</Text>
        </View>
      </View>
    </Pressable>
  );
});

const ChallengeCard = React.memo(({ challenge, onPress }: { challenge: Challenge; onPress: () => void }) => {
  const config = CHALLENGE_CONFIG[challenge.type];
  const score = challenge.type === 'precision' ? challenge.totalPoints || 0 : challenge.successRate || 0;
  const percentage = Math.min(100, score);
  const is1v1 = challenge.mode === '1v1';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.cardIndicator, { backgroundColor: config.color }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: config.color + '15' }]}>
              <MaterialIcons name={config.icon} size={12} color={config.color} />
              <Text style={[styles.badgeText, { color: config.color }]}>Défi</Text>
            </View>
            {is1v1 && (
              <View style={[styles.badge, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="people" size={12} color={theme.accent} />
                <Text style={[styles.badgeText, { color: theme.accent }]}>1v1</Text>
              </View>
            )}
          </View>
          <Text style={styles.timeText}>
            {new Date(challenge.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <View style={styles.challengeRow}>
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeName}>{config.name}</Text>
            {challenge.playerName && (
              <Text style={styles.challengePlayer}>
                {is1v1 ? `${challenge.playerName} vs ${challenge.opponentName}` : challenge.playerName}
              </Text>
            )}
          </View>
          <View style={styles.challengeScoreCol}>
            <Text style={[styles.challengeScoreNum, { color: config.color }]}>
              {score}{challenge.type === 'precision' ? '' : '%'}
            </Text>
            <Text style={styles.challengeScoreLabel}>
              {challenge.type === 'precision' ? 'pts' : 'réussite'}
            </Text>
          </View>
        </View>

        {is1v1 && challenge.winner && (
          <View style={[
            styles.winnerBadge,
            { backgroundColor: challenge.winner === 'player' ? theme.success : challenge.winner === 'opponent' ? theme.error : theme.warning }
          ]}>
            <MaterialIcons 
              name={challenge.winner === 'draw' ? 'handshake' : challenge.winner === 'player' ? 'emoji-events' : 'sentiment-dissatisfied'} 
              size={14} 
              color="#FFF" 
            />
            <Text style={styles.winnerText}>
              {challenge.winner === 'draw' ? 'Égalité' : challenge.winner === 'player' ? 'Victoire' : 'Défaite'}
            </Text>
          </View>
        )}

        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: config.color }]} />
          </View>
          {challenge.successCount !== undefined && (
            <Text style={styles.progressLabel}>{challenge.successCount}/{challenge.totalShots}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

const SectionHeader = React.memo(({ title }: { title: string }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionDot} />
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionLine} />
  </View>
));

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { matches, challenges, deleteChallenge } = useApp();
  
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('all');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

  // Filtered and grouped data
  const { listData, stats } = useMemo(() => {
    const periodDays = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.days || 0;
    const filteredMatches = filterByPeriod(matches, periodDays);
    const filteredChallenges = filterByPeriod(challenges, periodDays);

    // Calculate stats
    const trainingCount = filteredMatches.filter(m => m.mode === 'Entraînement').length;
    const tournamentCount = filteredMatches.filter(m => m.mode === 'Tournoi').length;
    const challengeCount = filteredChallenges.length;

    // Build items based on filter
    let items: { type: 'match' | 'challenge'; data: Match | Challenge; date: string }[] = [];
    
    if (contentFilter === 'all' || contentFilter === 'training') {
      const training = filteredMatches.filter(m => m.mode === 'Entraînement');
      items.push(...training.map(m => ({ type: 'match' as const, data: m, date: m.date })));
    }
    if (contentFilter === 'all' || contentFilter === 'tournament') {
      const tournaments = filteredMatches.filter(m => m.mode === 'Tournoi');
      items.push(...tournaments.map(m => ({ type: 'match' as const, data: m, date: m.date })));
    }
    if (contentFilter === 'all' || contentFilter === 'challenges') {
      items.push(...filteredChallenges.map(c => ({ type: 'challenge' as const, data: c, date: c.date })));
    }

    // Remove duplicates and sort
    const uniqueIds = new Set<string>();
    items = items.filter(item => {
      const id = item.type === 'match' ? (item.data as Match).id : (item.data as Challenge).id;
      if (uniqueIds.has(id)) return false;
      uniqueIds.add(id);
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group by date with headers
    const listData: HistoryItem[] = [];
    let currentDateKey = '';
    
    items.forEach(item => {
      const dateKey = getDateKey(new Date(item.date));
      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        listData.push({ type: 'header', title: dateKey, date: item.date });
      }
      listData.push(item);
    });

    return {
      listData,
      stats: { trainingCount, tournamentCount, challengeCount, total: trainingCount + tournamentCount + challengeCount }
    };
  }, [matches, challenges, contentFilter, selectedPeriod]);

  // Handlers
  const handleMatchPress = useCallback((match: Match) => {
    Haptics.selectionAsync();
    router.push(`/match/${match.id}`);
  }, []);

  const handleChallengePress = useCallback((challenge: Challenge) => {
    Haptics.selectionAsync();
    setEditingChallenge(challenge);
  }, []);

  const handleDeleteChallenge = useCallback(() => {
    if (!editingChallenge) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteChallenge(editingChallenge.id);
    setEditingChallenge(null);
  }, [editingChallenge, deleteChallenge]);

  const handleFilterPress = useCallback((filter: ContentFilter) => {
    Haptics.selectionAsync();
    setContentFilter(filter);
  }, []);

  const handlePeriodPress = useCallback((period: PeriodOption) => {
    Haptics.selectionAsync();
    setSelectedPeriod(period);
    setShowPeriodModal(false);
  }, []);

  // Render functions
  const renderItem = useCallback(({ item, index }: { item: HistoryItem; index: number }) => {
    if (item.type === 'header') {
      return (
        <Animated.View entering={FadeInDown.duration(200).delay(Math.min(index * 30, 150))}>
          <SectionHeader title={item.title} />
        </Animated.View>
      );
    }
    
    if (item.type === 'match') {
      return (
        <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 20, 100))}>
          <MatchCard match={item.data as Match} onPress={() => handleMatchPress(item.data as Match)} />
        </Animated.View>
      );
    }
    
    return (
      <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 20, 100))}>
        <ChallengeCard challenge={item.data as Challenge} onPress={() => handleChallengePress(item.data as Challenge)} />
      </Animated.View>
    );
  }, [handleMatchPress, handleChallengePress]);

  const keyExtractor = useCallback((item: HistoryItem) => {
    if (item.type === 'header') return `header-${item.title}`;
    if (item.type === 'match') return `match-${(item.data as Match).id}`;
    return `challenge-${(item.data as Challenge).id}`;
  }, []);

  const selectedPeriodLabel = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label || 'Tout';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Historique</Text>
        <Pressable 
          style={styles.periodBtn}
          onPress={() => {
            Haptics.selectionAsync();
            setShowPeriodModal(true);
          }}
        >
          <MaterialIcons name="event" size={18} color={theme.primary} />
          <Text style={styles.periodBtnText}>{selectedPeriodLabel}</Text>
        </Pressable>
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersRow}>
        {CONTENT_FILTERS.map((filter) => {
          const isActive = contentFilter === filter.id;
          const count = filter.id === 'all' ? stats.total
            : filter.id === 'training' ? stats.trainingCount
            : filter.id === 'tournament' ? stats.tournamentCount
            : stats.challengeCount;

          return (
            <Pressable
              key={filter.id}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => handleFilterPress(filter.id)}
            >
              <MaterialIcons name={filter.icon} size={14} color={isActive ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{filter.label}</Text>
              <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="search-off" size={40} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyText}>Aucune activité ne correspond à vos filtres</Text>
            <Pressable 
              style={styles.resetBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setContentFilter('all');
                setSelectedPeriod('all');
              }}
            >
              <MaterialIcons name="refresh" size={16} color="#FFF" />
              <Text style={styles.resetBtnText}>Réinitialiser</Text>
            </Pressable>
          </View>
        }
      />

      {/* Period Modal */}
      <Modal
        visible={showPeriodModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPeriodModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Période</Text>
            <Pressable style={styles.modalClose} onPress={() => setShowPeriodModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.modalContent}>
            {PERIOD_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[styles.periodOption, selectedPeriod === option.id && styles.periodOptionActive]}
                onPress={() => handlePeriodPress(option.id)}
              >
                <Text style={[styles.periodOptionText, selectedPeriod === option.id && styles.periodOptionTextActive]}>
                  {option.label}
                </Text>
                {selectedPeriod === option.id && (
                  <MaterialIcons name="check-circle" size={20} color={theme.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Challenge Detail Modal */}
      <Modal
        visible={!!editingChallenge}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingChallenge(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Détails du défi</Text>
            <Pressable style={styles.modalClose} onPress={() => setEditingChallenge(null)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          
          {editingChallenge && (
            <View style={styles.modalContent}>
              {/* Challenge Header */}
              <View style={styles.detailHeader}>
                <View style={[styles.detailIcon, { backgroundColor: CHALLENGE_CONFIG[editingChallenge.type].color + '20' }]}>
                  <MaterialIcons 
                    name={CHALLENGE_CONFIG[editingChallenge.type].icon} 
                    size={28} 
                    color={CHALLENGE_CONFIG[editingChallenge.type].color} 
                  />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailName}>{CHALLENGE_CONFIG[editingChallenge.type].name}</Text>
                  <Text style={styles.detailDate}>
                    {new Date(editingChallenge.date).toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>

              {/* Score */}
              <View style={styles.detailScoreCard}>
                <Text style={styles.detailScoreLabel}>SCORE</Text>
                <Text style={[styles.detailScoreValue, { color: CHALLENGE_CONFIG[editingChallenge.type].color }]}>
                  {editingChallenge.type === 'precision' 
                    ? `${editingChallenge.totalPoints || 0}/100`
                    : `${editingChallenge.successRate || 0}%`
                  }
                </Text>
                {editingChallenge.type !== 'precision' && (
                  <Text style={styles.detailScoreSub}>
                    {editingChallenge.successCount || 0}/{editingChallenge.totalShots || 0} tirs réussis
                  </Text>
                )}
              </View>

              {/* Stats Grid */}
              <View style={styles.detailStatsRow}>
                {editingChallenge.carreauCount !== undefined && editingChallenge.carreauCount > 0 && (
                  <View style={styles.detailStatItem}>
                    <MaterialIcons name="stars" size={20} color={theme.carreauColor} />
                    <Text style={styles.detailStatValue}>{editingChallenge.carreauCount}</Text>
                    <Text style={styles.detailStatLabel}>Carreaux</Text>
                  </View>
                )}
                {editingChallenge.duration && (
                  <View style={styles.detailStatItem}>
                    <MaterialIcons name="timer" size={20} color={theme.primary} />
                    <Text style={styles.detailStatValue}>
                      {Math.floor(editingChallenge.duration / 60)}:{(editingChallenge.duration % 60).toString().padStart(2, '0')}
                    </Text>
                    <Text style={styles.detailStatLabel}>Durée</Text>
                  </View>
                )}
              </View>

              {/* 1v1 Result */}
              {editingChallenge.mode === '1v1' && editingChallenge.opponentResult && (
                <View style={styles.detailOpponent}>
                  <View style={styles.detailOpponentRow}>
                    <Text style={styles.detailOpponentName}>{editingChallenge.opponentName}</Text>
                    <Text style={styles.detailOpponentScore}>
                      {editingChallenge.type === 'precision'
                        ? `${editingChallenge.opponentResult.totalPoints || 0} pts`
                        : `${editingChallenge.opponentResult.successRate || 0}%`
                      }
                    </Text>
                  </View>
                  {editingChallenge.winner && (
                    <View style={[
                      styles.detailWinner,
                      { backgroundColor: editingChallenge.winner === 'player' ? theme.success : editingChallenge.winner === 'opponent' ? theme.error : theme.warning }
                    ]}>
                      <Text style={styles.detailWinnerText}>
                        {editingChallenge.winner === 'draw' ? 'Égalité' : editingChallenge.winner === 'player' ? 'Victoire !' : 'Défaite'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Shots Grid */}
              {editingChallenge.shots && editingChallenge.shots.length > 0 && (
                <View style={styles.detailShots}>
                  <Text style={styles.detailShotsTitle}>Détail des tirs</Text>
                  <View style={styles.detailShotsGrid}>
                    {editingChallenge.shots.map((shot, idx) => (
                      <View 
                        key={idx} 
                        style={[
                          styles.shotDot,
                          { backgroundColor: shot.carreau ? theme.carreauColor : shot.success ? theme.success : theme.error }
                        ]}
                      >
                        <Text style={styles.shotDotText}>{idx + 1}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Actions */}
              <View style={styles.detailActions}>
                <Pressable style={styles.deleteBtn} onPress={handleDeleteChallenge}>
                  <MaterialIcons name="delete" size={18} color={theme.error} />
                  <Text style={styles.deleteBtnText}>Supprimer</Text>
                </Pressable>
                <Pressable style={styles.closeBtn} onPress={() => setEditingChallenge(null)}>
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </Pressable>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  
  // Header
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.full,
  },
  periodBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  
  // Filters
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.full,
  },
  filterChipActive: { backgroundColor: theme.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  filterChipTextActive: { color: '#FFF' },
  filterCount: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: theme.surface,
    borderRadius: 8,
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary },
  filterCountTextActive: { color: '#FFF' },
  
  // List
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary, marginRight: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, textTransform: 'capitalize' },
  sectionLine: { flex: 1, height: 1, backgroundColor: theme.border, marginLeft: 10 },
  
  // Card Base
  card: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 10,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  cardIndicator: { width: 4 },
  cardContent: { flex: 1, padding: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  timeText: { fontSize: 11, color: theme.textMuted },
  
  // Match Card
  tournamentName: { fontSize: 12, color: theme.textSecondary, marginBottom: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  teamCol: { flex: 1 },
  teamRight: { alignItems: 'flex-end' },
  teamLabel: { fontSize: 9, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, marginBottom: 2 },
  teamNames: { fontSize: 12, fontWeight: '500', color: theme.textPrimary },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 8,
  },
  scoreNum: { fontSize: 18, fontWeight: '800', color: theme.textSecondary, minWidth: 20, textAlign: 'center' },
  scoreWin: { color: theme.success },
  scoreLoss: { color: theme.error },
  scoreSep: { fontSize: 14, color: theme.textMuted, marginHorizontal: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  resultText: { fontSize: 11, fontWeight: '600' },
  formatText: { fontSize: 11, color: theme.textMuted },
  
  // Challenge Card
  challengeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  challengeInfo: { flex: 1 },
  challengeName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  challengePlayer: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  challengeScoreCol: { alignItems: 'flex-end' },
  challengeScoreNum: { fontSize: 20, fontWeight: '800' },
  challengeScoreLabel: { fontSize: 10, color: theme.textMuted },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 10,
  },
  winnerText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 5, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 13, color: theme.textSecondary, marginBottom: 20 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.full,
  },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  
  // Modal
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  modalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalContent: { flex: 1, padding: 16 },
  
  // Period Options
  periodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 8,
  },
  periodOptionActive: { borderWidth: 2, borderColor: theme.primary },
  periodOptionText: { fontSize: 15, fontWeight: '500', color: theme.textPrimary },
  periodOptionTextActive: { fontWeight: '600', color: theme.primary },
  
  // Detail Modal
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  detailIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detailInfo: { flex: 1 },
  detailName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  detailDate: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  detailScoreCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  detailScoreLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, letterSpacing: 1, marginBottom: 6 },
  detailScoreValue: { fontSize: 40, fontWeight: '800' },
  detailScoreSub: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  detailStatsRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginBottom: 20 },
  detailStatItem: { alignItems: 'center' },
  detailStatValue: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 6 },
  detailStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  detailOpponent: {
    backgroundColor: theme.accent + '10',
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 20,
  },
  detailOpponentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  detailOpponentName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  detailOpponentScore: { fontSize: 16, fontWeight: '700', color: theme.accent },
  detailWinner: { alignItems: 'center', paddingVertical: 8, borderRadius: theme.borderRadius.sm },
  detailWinnerText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  detailShots: { marginBottom: 20 },
  detailShotsTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 10 },
  detailShotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shotDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  shotDotText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  detailActions: { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: theme.error + '15',
    borderRadius: theme.borderRadius.md,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: theme.error },
  closeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.md,
  },
  closeBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
