
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { ChallengeType, Match, Challenge } from '@/services/mockData';

const CHALLENGE_CONFIG = {
  '10_tirs': { name: '10 Tirs', icon: 'gps-fixed' as const, color: '#F97316' },
  '10_tirs_sautee': { name: 'Tirs Sautée', icon: 'sports' as const, color: '#3B82F6' },
  'precision': { name: 'Précision', icon: 'stars' as const, color: '#F59E0B' },
};

type ContentFilter = 'all' | 'training' | 'tournament' | 'challenges';
type PeriodOption = 'all' | 'today' | 'week' | 'month' | 'custom';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

const PERIOD_OPTIONS: { id: PeriodOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'all', label: 'Toutes les dates', icon: 'all-inclusive' },
  { id: 'today', label: "Aujourd'hui", icon: 'today' },
  { id: 'week', label: 'Cette semaine', icon: 'date-range' },
  { id: 'month', label: 'Ce mois', icon: 'calendar-today' },
];

const CONTENT_FILTERS: { id: ContentFilter; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'all', label: 'Tout', icon: 'layers' },
  { id: 'training', label: 'Entraînements', icon: 'fitness-center' },
  { id: 'tournament', label: 'Tournois', icon: 'emoji-events' },
  { id: 'challenges', label: 'Défis', icon: 'track-changes' },
];

// Helper to encode match data for rematch
function encodeTeamForRevanche(playerNames: string[]): string {
  return encodeURIComponent(playerNames.join(','));
}

function getDateRange(period: PeriodOption): DateRange {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return { start: startOfDay, end: now };
    case 'week':
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(startOfDay);
      weekStart.setDate(weekStart.getDate() - diff);
      return { start: weekStart, end: now };
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    default:
      return { start: null, end: null };
  }
}

function filterByDateRange<T extends { date: string }>(items: T[], range: DateRange): T[] {
  if (!range.start) return items;
  return items.filter(item => {
    const itemDate = new Date(item.date);
    const afterStart = range.start ? itemDate >= range.start : true;
    const beforeEnd = range.end ? itemDate <= range.end : true;
    return afterStart && beforeEnd;
  });
}

// Helper to group matches/challenges by series
interface SeriesGroup {
  seriesId: string;
  items: { type: 'match' | 'challenge'; data: Match | Challenge; date: string }[];
  seriesWinner?: 'A' | 'B' | 'player' | 'opponent';
  seriesComplete: boolean;
  totalMatches: number;
  winsA: number;
  winsB: number;
}

function groupBySeries(
  items: { type: 'match' | 'challenge'; data: Match | Challenge; date: string }[]
): { seriesGroups: Map<string, SeriesGroup>; standalone: typeof items } {
  const seriesGroups = new Map<string, SeriesGroup>();
  const standalone: typeof items = [];
  
  items.forEach(item => {
    const seriesInfo = item.type === 'match' 
      ? (item.data as Match).seriesInfo 
      : (item.data as Challenge).seriesInfo;
    
    if (seriesInfo?.seriesId) {
      const existing = seriesGroups.get(seriesInfo.seriesId);
      if (existing) {
        existing.items.push(item);
        if (seriesInfo.seriesComplete) {
          existing.seriesComplete = true;
          existing.seriesWinner = seriesInfo.seriesWinner;
        }
        existing.totalMatches = Math.max(existing.totalMatches, seriesInfo.matchNumber || 1);
      } else {
        seriesGroups.set(seriesInfo.seriesId, {
          seriesId: seriesInfo.seriesId,
          items: [item],
          seriesComplete: seriesInfo.seriesComplete || false,
          seriesWinner: seriesInfo.seriesWinner,
          totalMatches: seriesInfo.matchNumber || 1,
          winsA: 0,
          winsB: 0,
        });
      }
    } else {
      standalone.push(item);
    }
  });
  
  // Sort items within each series by matchNumber and calculate wins
  seriesGroups.forEach(group => {
    group.items.sort((a, b) => {
      const aNum = (a.type === 'match' ? (a.data as Match).seriesInfo?.matchNumber : (a.data as Challenge).seriesInfo?.matchNumber) || 1;
      const bNum = (b.type === 'match' ? (b.data as Match).seriesInfo?.matchNumber : (b.data as Challenge).seriesInfo?.matchNumber) || 1;
      return aNum - bNum;
    });
    
    // Calculate actual wins from match results
    let winsA = 0;
    let winsB = 0;
    group.items.forEach(item => {
      if (item.type === 'match') {
        const match = item.data as Match;
        if (match.winner === 'A') winsA++;
        else if (match.winner === 'B') winsB++;
      } else {
        const challenge = item.data as Challenge;
        if (challenge.winner === 'player') winsA++;
        else if (challenge.winner === 'opponent') winsB++;
        // Note: 'draw' doesn't count as a win for either side
      }
    });
    group.winsA = winsA;
    group.winsB = winsB;
    group.totalMatches = group.items.length;
    
    // Update series complete status based on actual results
    if (winsA >= 2 || winsB >= 2) {
      group.seriesComplete = true;
      group.seriesWinner = winsA >= 2 ? 'A' : 'B';
    }
  });
  
  return { seriesGroups, standalone };
}

// Render item type for grouping
type HistoryItem = { type: 'match' | 'challenge'; data: Match | Challenge; date: string };
type SeriesGroupItem = { type: 'series'; seriesGroup: SeriesGroup; date: string };
type GroupedItem = HistoryItem | SeriesGroupItem;

function groupByDate(items: HistoryItem[], seriesGroups: Map<string, SeriesGroup>): { title: string; data: GroupedItem[]; date: Date }[] {
  const groups: Record<string, GroupedItem[]> = {};
  const processedSeriesIds = new Set<string>();
  
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
      key = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    } else {
      key = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    
    // Check if this item is part of a series
    const seriesInfo = item.type === 'match' 
      ? (item.data as Match).seriesInfo 
      : (item.data as Challenge).seriesInfo;
    
    if (seriesInfo?.seriesId && !processedSeriesIds.has(seriesInfo.seriesId)) {
      const seriesGroup = seriesGroups.get(seriesInfo.seriesId);
      if (seriesGroup && seriesGroup.items.length > 1) {
        // Add the entire series as a grouped item
        processedSeriesIds.add(seriesInfo.seriesId);
        groups[key].push({ type: 'series', seriesGroup, date: seriesGroup.items[0].date });
        return;
      }
    }
    
    // Skip if already processed as part of a series
    if (seriesInfo?.seriesId && processedSeriesIds.has(seriesInfo.seriesId)) {
      return;
    }
    
    // Add standalone item
    groups[key].push(item);
  });
  
  return Object.entries(groups).map(([title, data]) => ({
    title,
    data,
    date: new Date(data[0]?.date || new Date()),
  })).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { matches, challenges } = useApp();
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('all');
  const [showPeriodModal, setShowPeriodModal] = useState(false);

  const dateRange = useMemo(() => getDateRange(selectedPeriod), [selectedPeriod]);

  // Group data by series first
  const { seriesGroups, allItems: allItemsRaw } = useMemo(() => {
    const dateFilteredMatches = filterByDateRange(matches, dateRange);
    const dateFilteredChallenges = filterByDateRange(challenges, dateRange);

    let matchItems: HistoryItem[] = [];
    let challengeItems: HistoryItem[] = [];

    if (contentFilter === 'all' || contentFilter === 'training') {
      matchItems = [
        ...matchItems,
        ...dateFilteredMatches
          .filter(m => contentFilter === 'all' || m.mode === 'Entraînement')
          .map(m => ({ type: 'match' as const, data: m, date: m.date })),
      ];
    }

    if (contentFilter === 'all' || contentFilter === 'tournament') {
      matchItems = [
        ...matchItems,
        ...dateFilteredMatches
          .filter(m => contentFilter === 'all' || m.mode === 'Tournoi')
          .map(m => ({ type: 'match' as const, data: m, date: m.date })),
      ];
    }

    if (contentFilter === 'all') {
      const uniqueMatchIds = new Set<string>();
      matchItems = matchItems.filter(item => {
        if (uniqueMatchIds.has((item.data as Match).id)) return false;
        uniqueMatchIds.add((item.data as Match).id);
        return true;
      });
    }

    if (contentFilter === 'all' || contentFilter === 'challenges') {
      challengeItems = dateFilteredChallenges.map(c => ({ type: 'challenge' as const, data: c, date: c.date }));
    }

    const allItems = [...matchItems, ...challengeItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const { seriesGroups } = groupBySeries(allItems);
    return { seriesGroups, allItems };
  }, [matches, challenges, contentFilter, dateRange]);

  // Filter data based on selections
  const filteredData = useMemo(() => {
    return groupByDate(allItemsRaw, seriesGroups);
  }, [allItemsRaw, seriesGroups]);

  // Stats for current filter
  const stats = useMemo(() => {
    const dateFilteredMatches = filterByDateRange(matches, dateRange);
    const dateFilteredChallenges = filterByDateRange(challenges, dateRange);
    
    const trainingCount = dateFilteredMatches.filter(m => m.mode === 'Entraînement').length;
    const tournamentCount = dateFilteredMatches.filter(m => m.mode === 'Tournoi').length;
    const challengeCount = dateFilteredChallenges.length;
    
    return { trainingCount, tournamentCount, challengeCount, total: trainingCount + tournamentCount + challengeCount };
  }, [matches, challenges, dateRange]);

  const selectedPeriodLabel = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label || 'Sélectionner';

  // Render a series group card (sub-layer of training matches)
  const renderSeriesCard = (seriesGroup: SeriesGroup) => {
    const firstItem = seriesGroup.items[0];
    const isMatch = firstItem.type === 'match';
    
    // Use pre-calculated wins from groupBySeries
    const winsA = seriesGroup.winsA;
    const winsB = seriesGroup.winsB;
    
    // isSeriesWon = true when user's team (A/player) has won the series (2 wins)
    const isSeriesWon = winsA >= 2;
    const isSeriesLost = winsB >= 2;
    const isComplete = seriesGroup.seriesComplete || winsA >= 2 || winsB >= 2;
    const hasFinale = seriesGroup.items.some(item => {
      const info = item.type === 'match' 
        ? (item.data as Match).seriesInfo 
        : (item.data as Challenge).seriesInfo;
      return info?.isFinale;
    });
    const matchCount = seriesGroup.items.length;
    
    // Get team names from first match
    const firstMatch = isMatch ? firstItem.data as Match : null;
    const teamANames = firstMatch?.teamA.playerNames || ['Mon équipe'];
    const teamBNames = firstMatch?.teamB.playerNames || ['Adversaire'];
    
    return (
      <View style={styles.seriesCard}>
        {/* Series Header - Styled as sub-section of training */}
        <View style={[styles.seriesCardHeader, isComplete ? (isSeriesWon ? styles.seriesCardHeaderWin : styles.seriesCardHeaderLoss) : styles.seriesCardHeaderInProgress]}>
          <View style={styles.seriesCardHeaderLeft}>
            <View style={[
              styles.seriesCardIcon, 
              isComplete && isSeriesWon && styles.seriesCardIconWin,
              isComplete && isSeriesLost && styles.seriesCardIconLoss,
              !isComplete && styles.seriesCardIconInProgress
            ]}>
              <MaterialIcons 
                name={hasFinale ? 'emoji-events' : 'repeat'} 
                size={20} 
                color="#FFF" 
              />
            </View>
            <View>
              <View style={styles.seriesCardTitleRow}>
                <Text style={styles.seriesCardTitle}>Série d'entraînement</Text>
                <View style={styles.seriesBadge}>
                  <Text style={styles.seriesBadgeText}>{matchCount}/3</Text>
                </View>
              </View>
              <Text style={styles.seriesCardDate}>
                {new Date(firstItem.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {hasFinale && ' • Avec finale'}
              </Text>
            </View>
          </View>
          
          {/* Series Result or Status */}
          {isComplete ? (
            <View style={[styles.seriesResultBadge, isSeriesWon ? styles.seriesResultBadgeWin : styles.seriesResultBadgeLoss]}>
              <MaterialIcons 
                name={isSeriesWon ? 'check-circle' : 'cancel'} 
                size={16} 
                color={isSeriesWon ? theme.success : theme.error} 
              />
              <Text style={[styles.seriesResultText, { color: isSeriesWon ? theme.success : theme.error }]}>
                {isSeriesWon ? 'Gagnée' : 'Perdue'} ({winsA}-{winsB})
              </Text>
            </View>
          ) : (
            <View style={styles.seriesInProgressBadge}>
              <MaterialIcons name="schedule" size={14} color={theme.warning} />
              <Text style={styles.seriesInProgressText}>En cours ({winsA}-{winsB})</Text>
            </View>
          )}
        </View>
        
        {/* Teams Display */}
        <View style={styles.seriesTeamsRow}>
          <View style={styles.seriesTeam}>
            <Text style={styles.seriesTeamLabel}>Mon équipe</Text>
            <Text style={styles.seriesTeamNames} numberOfLines={1}>
              {teamANames.slice(0, 2).join(' • ')}
            </Text>
          </View>
          <View style={styles.seriesVs}>
            <Text style={styles.seriesVsText}>VS</Text>
          </View>
          <View style={[styles.seriesTeam, styles.seriesTeamRight]}>
            <Text style={styles.seriesTeamLabel}>Adversaire</Text>
            <Text style={styles.seriesTeamNames} numberOfLines={1}>
              {teamBNames.slice(0, 2).join(' • ')}
            </Text>
          </View>
        </View>
        
        {/* Series Score & Timeline */}
        <View style={styles.seriesScoreRow}>
          <Text style={[
            styles.seriesFinalScore,
            isSeriesWon ? styles.seriesFinalScoreWin : (winsA > winsB && !isSeriesLost ? styles.seriesFinalScoreWin : styles.seriesFinalScoreNeutral)
          ]}>
            {winsA}
          </Text>
          <View style={styles.seriesTimelineContainer}>
            {seriesGroup.items.map((item, idx) => {
              // Handle both matches and challenges
              const isMatchItem = item.type === 'match';
              const match = isMatchItem ? item.data as Match : null;
              const challenge = !isMatchItem ? item.data as Challenge : null;
              
              // Determine if this game was won by the user
              const isWin = isMatchItem 
                ? match?.winner === 'A' 
                : challenge?.winner === 'player';
              
              const seriesInfo = isMatchItem 
                ? match?.seriesInfo 
                : challenge?.seriesInfo;
              const isFinaleMatch = seriesInfo?.isFinale;
              
              // Get scores for display
              const scoreA = match?.teamA.score ?? (challenge?.successRate ?? 0);
              const scoreB = match?.teamB.score ?? (challenge?.opponentResult?.successRate ?? 0);
              
              return (
                <View key={match?.id || challenge?.id || idx} style={styles.seriesTimelineItem}>
                  <View style={[
                    styles.seriesTimelineDot,
                    isWin ? styles.seriesTimelineDotWin : styles.seriesTimelineDotLoss,
                    isFinaleMatch && styles.seriesTimelineDotFinale,
                  ]}>
                    <Text style={styles.seriesTimelineDotText}>
                      {isFinaleMatch ? 'F' : idx + 1}
                    </Text>
                  </View>
                  <Text style={styles.seriesTimelineScore}>
                    {match ? `${scoreA}-${scoreB}` : `${scoreA}%`}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={[
            styles.seriesFinalScore,
            isSeriesLost ? styles.seriesFinalScoreLoss : (winsB > winsA && !isSeriesWon ? styles.seriesFinalScoreLoss : styles.seriesFinalScoreNeutral)
          ]}>
            {winsB}
          </Text>
        </View>
        
        {/* Action buttons */}
        <View style={styles.seriesActionsRow}>
          {/* View details */}
          <Pressable 
            style={styles.seriesExpandBtn}
            onPress={() => {
              Haptics.selectionAsync();
              if (firstMatch) {
                router.push(`/match/${firstMatch.id}`);
              }
            }}
          >
            <MaterialIcons name="visibility" size={16} color={theme.primary} />
            <Text style={styles.seriesExpandText}>Voir les matchs</Text>
          </Pressable>
          
          {/* Continue series if not complete, or new series if complete */}
          {firstMatch && (
            isComplete ? (
              <Pressable 
                style={styles.seriesNewBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // Start a completely new series with same teams
                  router.push({
                    pathname: '/match/new',
                    params: {
                      revanche: 'true',
                      format: firstMatch.format,
                      teamA: encodeTeamForRevanche(teamANames),
                      teamB: encodeTeamForRevanche(teamBNames),
                      seriesWinsA: '0',
                      seriesWinsB: '0',
                      seriesId: `series-${Date.now()}`,
                    }
                  });
                }}
              >
                <MaterialIcons name="replay" size={16} color={theme.accent} />
                <Text style={styles.seriesNewBtnText}>Rejouer</Text>
              </Pressable>
            ) : (
              <Pressable 
                style={styles.seriesContinueBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  // Continue the series
                  const willBeFinale = winsA === 1 && winsB === 1;
                  router.push({
                    pathname: '/match/new',
                    params: {
                      revanche: 'true',
                      format: firstMatch.format,
                      teamA: encodeTeamForRevanche(teamANames),
                      teamB: encodeTeamForRevanche(teamBNames),
                      seriesWinsA: String(winsA),
                      seriesWinsB: String(winsB),
                      seriesId: seriesGroup.seriesId,
                    }
                  });
                }}
              >
                <MaterialIcons 
                  name={winsA === 1 && winsB === 1 ? 'emoji-events' : 'sports-mma'} 
                  size={16} 
                  color={theme.carreauColor} 
                />
                <Text style={styles.seriesContinueBtnText}>
                  {winsA === 1 && winsB === 1 ? 'Jouer la finale' : 'Continuer'}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>
    );
  };

  const renderMatchCard = (match: Match, isInSeries: boolean = false) => {
    const isWin = match.winner === 'A';
    const isTournament = match.mode === 'Tournoi';

    return (
      <Pressable 
        style={styles.card}
        onPress={() => {
          Haptics.selectionAsync();
          router.push(`/match/${match.id}`);
        }}
      >
        <View style={[styles.cardIndicator, { backgroundColor: isWin ? theme.success : theme.error }]} />
        
        <View style={styles.cardContent}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[
                styles.typeBadge,
                { backgroundColor: isTournament ? theme.carreauColor + '15' : theme.primary + '15' }
              ]}>
                <MaterialIcons 
                  name={isTournament ? 'emoji-events' : 'fitness-center'} 
                  size={14} 
                  color={isTournament ? theme.carreauColor : theme.primary} 
                />
                <Text style={[
                  styles.typeBadgeText,
                  { color: isTournament ? theme.carreauColor : theme.primary }
                ]}>
                  {isTournament ? 'Tournoi' : 'Entraînement'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTime}>
              {new Date(match.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {/* Tournament name if applicable */}
          {isTournament && match.tournamentName && (
            <Text style={styles.tournamentName} numberOfLines={1}>{match.tournamentName}</Text>
          )}

          {/* Score display */}
          <View style={styles.scoreContainer}>
            <View style={styles.teamInfo}>
              <Text style={styles.teamLabel}>Mon équipe</Text>
              <Text style={styles.teamPlayers} numberOfLines={1}>
                {match.teamA.playerNames.slice(0, 2).join(' • ')}
              </Text>
            </View>
            
            <View style={styles.scoreBox}>
              <Text style={[styles.score, isWin && styles.scoreWin]}>{match.teamA.score}</Text>
              <Text style={styles.scoreSeparator}>-</Text>
              <Text style={[styles.score, !isWin && styles.scoreLoss]}>{match.teamB.score}</Text>
            </View>
            
            <View style={[styles.teamInfo, styles.teamInfoRight]}>
              <Text style={styles.teamLabel}>Adversaire</Text>
              <Text style={styles.teamPlayers} numberOfLines={1}>
                {match.teamB.playerNames.slice(0, 2).join(' • ')}
              </Text>
            </View>
          </View>

          {/* Player Roles */}
          {match.teamA.playerRoles && match.teamA.playerRoles.length > 0 && (
            <View style={styles.rolesContainer}>
              <View style={styles.rolesTeam}>
                {match.teamA.playerRoles.map((pr, idx) => {
                  const playerName = match.teamA.playerNames[idx]?.split(' ')[0] || 'Joueur';
                  return (
                    <View key={pr.playerId} style={styles.roleChip}>
                      <MaterialIcons 
                        name={pr.role === 'Tireur' ? 'gps-fixed' : pr.role === 'Pointeur' ? 'radio-button-on' : 'swap-horiz'} 
                        size={12} 
                        color={pr.role === 'Tireur' ? '#F97316' : pr.role === 'Pointeur' ? '#3B82F6' : '#8B5CF6'} 
                      />
                      <Text style={styles.roleChipText}>{playerName}</Text>
                    </View>
                  );
                })}
              </View>
              {match.teamB.playerRoles && match.teamB.playerRoles.length > 0 && (
                <View style={[styles.rolesTeam, styles.rolesTeamB]}>
                  {match.teamB.playerRoles.map((pr, idx) => {
                    const playerName = match.teamB.playerNames[idx]?.split(' ')[0] || 'Joueur';
                    return (
                      <View key={pr.playerId} style={[styles.roleChip, styles.roleChipB]}>
                        <MaterialIcons 
                          name={pr.role === 'Tireur' ? 'gps-fixed' : pr.role === 'Pointeur' ? 'radio-button-on' : 'swap-horiz'} 
                          size={12} 
                          color={pr.role === 'Tireur' ? '#F97316' : pr.role === 'Pointeur' ? '#3B82F6' : '#8B5CF6'} 
                        />
                        <Text style={styles.roleChipText}>{playerName}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={[styles.resultBadge, { backgroundColor: isWin ? theme.success + '15' : theme.error + '15' }]}>
              <MaterialIcons 
                name={isWin ? 'check-circle' : 'cancel'} 
                size={14} 
                color={isWin ? theme.success : theme.error} 
              />
              <Text style={[styles.resultBadgeText, { color: isWin ? theme.success : theme.error }]}>
                {isWin ? 'Victoire' : 'Défaite'}
              </Text>
            </View>
            <Text style={styles.formatText}>{match.format}</Text>
          </View>

          {/* Revanche button for training matches - Only show if series not complete */}
          {!isTournament && !match.seriesInfo?.seriesComplete && (
            <Pressable 
              style={styles.revancheCardButton}
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                // Calculate new series score based on this match result
                // The current match counts as the first match in the series
                const existingSeriesInfo = match.seriesInfo;
                let newSeriesWinsA = 0;
                let newSeriesWinsB = 0;
                
                if (existingSeriesInfo && existingSeriesInfo.matchNumber > 0) {
                  // This match was already part of a series - include its result
                  // winsBeforeThisMatch + this match's result = total wins before next match
                  newSeriesWinsA = (existingSeriesInfo.winsBeforeThisMatch?.teamA || 0) + (isWin ? 1 : 0);
                  newSeriesWinsB = (existingSeriesInfo.winsBeforeThisMatch?.teamB || 0) + (isWin ? 0 : 1);
                } else {
                  // This is the first match - it becomes match 1 of a new series
                  // Its result counts: winner has 1 win, loser has 0
                  newSeriesWinsA = isWin ? 1 : 0;
                  newSeriesWinsB = isWin ? 0 : 1;
                }
                
                // Use existing seriesId if available, otherwise use match's seriesId or generate new
                const seriesIdForRevanche = existingSeriesInfo?.seriesId || match.seriesInfo?.seriesId || `series-${Date.now()}`;
                
                router.push({
                  pathname: '/match/new',
                  params: {
                    revanche: 'true',
                    format: match.format,
                    teamA: encodeTeamForRevanche(match.teamA.playerNames),
                    teamB: encodeTeamForRevanche(match.teamB.playerNames),
                    seriesWinsA: String(newSeriesWinsA),
                    seriesWinsB: String(newSeriesWinsB),
                    seriesId: seriesIdForRevanche,
                  }
                });
              }}
            >
              <MaterialIcons name="sports-mma" size={16} color={theme.accent} />
              <Text style={styles.revancheCardButtonText}>Revanche</Text>
            </Pressable>
          )}
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
    
    return (
      <Pressable style={styles.card}>
        <View style={[styles.cardIndicator, { backgroundColor: config.color }]} />
        
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={[styles.typeBadge, { backgroundColor: config.color + '15' }]}>
              <MaterialIcons name={config.icon} size={14} color={config.color} />
              <Text style={[styles.typeBadgeText, { color: config.color }]}>Défi</Text>
            </View>
            <Text style={styles.cardTime}>
              {new Date(challenge.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.challengeBody}>
            <View style={styles.challengeInfo}>
              <Text style={styles.challengeName}>{config.name}</Text>
              {challenge.playerName && (
                <Text style={styles.challengePlayer}>{challenge.playerName}</Text>
              )}
            </View>
            
            <View style={styles.challengeScore}>
              <Text style={[styles.challengeScoreValue, { color: config.color }]}>
                {score}{challenge.type === 'precision' ? '' : '%'}
              </Text>
              <Text style={styles.challengeScoreLabel}>
                {challenge.type === 'precision' ? 'points' : 'réussite'}
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: config.color }]} 
              />
            </View>
            {challenge.successCount !== undefined && (
              <Text style={styles.progressText}>
                {challenge.successCount}/{challenge.totalShots} tirs
              </Text>
            )}
          </View>
        </View>
      </Pressable>
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

      {/* Filters Section */}
      <View style={styles.filtersContainer}>
        {/* Period Selector */}
        <Pressable 
          style={styles.periodSelector}
          onPress={() => {
            Haptics.selectionAsync();
            setShowPeriodModal(true);
          }}
        >
          <MaterialIcons name="event" size={20} color={theme.primary} />
          <Text style={styles.periodSelectorText}>{selectedPeriodLabel}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color={theme.textSecondary} />
        </Pressable>

        {/* Content Filter Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
        >
          {CONTENT_FILTERS.map((filter) => {
            const isActive = contentFilter === filter.id;
            let count = 0;
            if (filter.id === 'all') count = stats.total;
            else if (filter.id === 'training') count = stats.trainingCount;
            else if (filter.id === 'tournament') count = stats.tournamentCount;
            else if (filter.id === 'challenges') count = stats.challengeCount;

            return (
              <Pressable
                key={filter.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setContentFilter(filter.id);
                }}
              >
                <MaterialIcons 
                  name={filter.icon} 
                  size={16} 
                  color={isActive ? '#FFF' : theme.textSecondary} 
                />
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {filter.label}
                </Text>
                <View style={[styles.filterChipCount, isActive && styles.filterChipCountActive]}>
                  <Text style={[styles.filterChipCountText, isActive && styles.filterChipCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* History List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredData.length > 0 ? (
          filteredData.map((section, sectionIndex) => (
            <Animated.View 
              key={section.title}
              entering={FadeInDown.duration(300).delay(sectionIndex * 50)}
            >
              {/* Date Section Header */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionLine} />
              </View>
              
              {/* Items */}
              {section.data.map((item, index) => (
                <Animated.View
                  key={item.type === 'series' 
                    ? `series-${item.seriesGroup.seriesId}`
                    : `${item.type}-${item.type === 'match' ? (item.data as Match).id : (item.data as Challenge).id}`}
                  entering={FadeIn.duration(200).delay(index * 30)}
                >
                  {item.type === 'series' ? (
                    renderSeriesCard(item.seriesGroup)
                  ) : item.type === 'match' ? (
                    renderMatchCard(item.data as Match, false)
                  ) : (
                    renderChallengeCard(item.data as Challenge)
                  )}
                </Animated.View>
              ))}
            </Animated.View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptyText}>
              Aucune activité ne correspond à vos filtres
            </Text>
            <Pressable 
              style={styles.resetButton}
              onPress={() => {
                Haptics.selectionAsync(); // Added Haptics feedback here
                setContentFilter('all');
                setSelectedPeriod('all');
              }}
            >
              <MaterialIcons name="refresh" size={18} color="#FFF" />
              <Text style={styles.resetButtonText}>Réinitialiser</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Period Selection Modal */}
      <Modal
        visible={showPeriodModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPeriodModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sélectionner une période</Text>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => {
                Haptics.selectionAsync(); // Added Haptics feedback here
                setShowPeriodModal(false);
              }}
            >
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {PERIOD_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.periodOption,
                  selectedPeriod === option.id && styles.periodOptionActive
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPeriod(option.id);
                  setShowPeriodModal(false);
                }}
              >
                <View style={[
                  styles.periodOptionIcon,
                  selectedPeriod === option.id && styles.periodOptionIconActive
                ]}>
                  <MaterialIcons 
                    name={option.icon} 
                    size={22} 
                    color={selectedPeriod === option.id ? '#FFF' : theme.textSecondary} 
                  />
                </View>
                <Text style={[
                  styles.periodOptionText,
                  selectedPeriod === option.id && styles.periodOptionTextActive
                ]}>
                  {option.label}
                </Text>
                {selectedPeriod === option.id && (
                  <MaterialIcons name="check-circle" size={22} color={theme.primary} />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  // Filters
  filtersContainer: {
    backgroundColor: theme.surface,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  periodSelectorText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
  },
  filterChipsContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  filterChipCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: theme.surface,
    borderRadius: 10,
  },
  filterChipCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterChipCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  filterChipCountTextActive: {
    color: '#FFF',
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    textTransform: 'capitalize',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
    marginLeft: 12,
  },
  // Series Card Styles
  seriesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.xl,
    marginBottom: 16,
    overflow: 'hidden',
    ...theme.shadows.card,
    borderWidth: 2,
    borderColor: theme.primary + '30',
  },
  seriesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: theme.primary + '08',
  },
  seriesCardHeaderWin: {
    backgroundColor: theme.success + '10',
    borderBottomWidth: 1,
    borderBottomColor: theme.success + '20',
  },
  seriesCardHeaderLoss: {
    backgroundColor: theme.error + '10',
    borderBottomWidth: 1,
    borderBottomColor: theme.error + '20',
  },
  seriesCardHeaderInProgress: {
    backgroundColor: theme.warning + '08',
    borderBottomWidth: 1,
    borderBottomColor: theme.warning + '20',
  },
  seriesCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seriesCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seriesCardIconWin: {
    backgroundColor: theme.success,
  },
  seriesCardIconLoss: {
    backgroundColor: theme.error,
  },
  seriesCardIconInProgress: {
    backgroundColor: theme.warning,
  },
  seriesCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seriesCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  seriesBadge: {
    backgroundColor: theme.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  seriesBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.primary,
  },
  seriesCardDate: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  seriesResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  seriesResultBadgeWin: {
    backgroundColor: theme.success + '15',
  },
  seriesResultBadgeLoss: {
    backgroundColor: theme.error + '15',
  },
  seriesResultText: {
    fontSize: 13,
    fontWeight: '700',
  },
  seriesInProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.warning + '15',
    borderRadius: theme.borderRadius.full,
  },
  seriesInProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.warning,
  },
  seriesTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  seriesTeam: {
    flex: 1,
  },
  seriesTeamRight: {
    alignItems: 'flex-end',
  },
  seriesTeamLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  seriesTeamNames: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  seriesVs: {
    paddingHorizontal: 12,
  },
  seriesVsText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  seriesScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 16,
  },
  seriesFinalScore: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.textMuted,
    width: 44,
    textAlign: 'center',
  },
  seriesFinalScoreWin: {
    color: theme.success,
  },
  seriesFinalScoreLoss: {
    color: theme.error,
  },
  seriesFinalScoreNeutral: {
    color: theme.textMuted,
  },
  seriesTimelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seriesTimelineItem: {
    alignItems: 'center',
  },
  seriesTimelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  seriesTimelineDotWin: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  seriesTimelineDotLoss: {
    backgroundColor: theme.error,
    borderColor: theme.error,
  },
  seriesTimelineDotFinale: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.carreauColor,
    borderColor: theme.carreauColor,
  },
  seriesTimelineDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  seriesTimelineScore: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  seriesActionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  seriesExpandBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: theme.backgroundSecondary,
  },
  seriesExpandText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  seriesNewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: theme.accent + '10',
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
  },
  seriesNewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accent,
  },
  seriesContinueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: theme.carreauColor + '10',
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
  },
  seriesContinueBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.carreauColor,
  },
  // Card base
  card: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 12,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  cardIndicator: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardTime: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '500',
  },
  // Match specific
  tournamentName: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
    marginBottom: 10,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamInfoRight: {
    alignItems: 'flex-end',
  },
  teamLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  teamPlayers: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 10,
  },
  score: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textSecondary,
    minWidth: 24,
    textAlign: 'center',
  },
  scoreWin: {
    color: theme.success,
  },
  scoreLoss: {
    color: theme.error,
  },
  scoreSeparator: {
    fontSize: 18,
    fontWeight: '300',
    color: theme.textMuted,
    marginHorizontal: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  resultBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    // color: isWin ? theme.success : theme.error, // Removed as it causes a syntax error if `isWin` is not defined here
  },
  formatText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  // Roles display
  rolesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  rolesTeam: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  rolesTeamB: {
    justifyContent: 'flex-end',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  roleChipB: {
    backgroundColor: theme.accent + '10',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  // Challenge specific
  challengeBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  challengePlayer: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  challengeScore: {
    alignItems: 'flex-end',
  },
  challengeScoreValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  challengeScoreLabel: {
    fontSize: 11,
    color: theme.textMuted,
    textTransform: 'uppercase',
  },
  // Revanche card button
  revancheCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: theme.accent + '10',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.accent + '30',
  },
  revancheCardButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.accent,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
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
    marginBottom: 20,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.full,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  periodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 10,
    ...theme.shadows.card,
  },
  periodOptionActive: {
    borderWidth: 2,
    borderColor: theme.primary,
  },
  periodOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  periodOptionIconActive: {
    backgroundColor: theme.primary,
  },
  periodOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  periodOptionTextActive: {
    fontWeight: '600',
    color: theme.primary,
  },
});
