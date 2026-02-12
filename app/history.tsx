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
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/contexts/AppContext';
import { Match, Challenge, SeriesInfo } from '@/services/mockData';

// Constants
const CHALLENGE_CONFIG = {
  '10_tirs': { name: '10 Tirs', icon: 'gps-fixed' as const, color: '#F97316' },
  '10_tirs_sautee': { name: 'Tirs Sautée', icon: 'sports' as const, color: '#3B82F6' },
  'precision': { name: 'Précision', icon: 'stars' as const, color: '#F59E0B' },
} as const;

type ContentFilter = 'all' | 'training' | 'tournament' | 'challenges';
type TrainingSubFilter = 'all' | 'matches' | 'challenges' | 'series';
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

const TRAINING_SUB_FILTERS: { id: TrainingSubFilter; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'all', label: 'Tout', icon: 'layers' },
  { id: 'matches', label: 'Matchs', icon: 'sports' },
  { id: 'challenges', label: 'Défis', icon: 'track-changes' },
  { id: 'series', label: 'Best of 3', icon: 'replay' },
];

// Types
interface SeriesGroup {
  seriesId: string;
  matches: Match[];
  teamAWins: number;
  teamBWins: number;
  seriesWinner: 'A' | 'B' | null;
  isComplete: boolean;
  format: string;
  teamANames: string[];
  teamBNames: string[];
  date: string;
}

type HistoryItem = 
  | { type: 'match'; data: Match; date: string }
  | { type: 'series'; data: SeriesGroup; date: string }
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
const MatchCard = React.memo(({ match, onPress, compact = false }: { match: Match; onPress: () => void; compact?: boolean }) => {
  const isWin = match.winner === 'A';
  const isTournament = match.mode === 'Tournoi';

  if (compact) {
    return (
      <Pressable style={styles.compactMatchCard} onPress={onPress}>
        <View style={[styles.compactIndicator, { backgroundColor: isWin ? theme.success : theme.error }]} />
        <View style={styles.compactMatchContent}>
          <Text style={styles.compactMatchLabel}>
            {match.seriesInfo?.isFinale ? 'Finale' : `Match ${match.seriesInfo?.matchNumber}`}
          </Text>
          <View style={styles.compactScoreRow}>
            <Text style={[styles.compactScore, isWin && styles.compactScoreWin]}>{match.teamA.score}</Text>
            <Text style={styles.compactScoreSep}>-</Text>
            <Text style={[styles.compactScore, !isWin && styles.compactScoreLoss]}>{match.teamB.score}</Text>
          </View>
        </View>
        <MaterialIcons 
          name={isWin ? 'check-circle' : 'cancel'} 
          size={16} 
          color={isWin ? theme.success : theme.error} 
        />
      </Pressable>
    );
  }

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

// Series Card Component
const SeriesCard = React.memo(({ series, onMatchPress }: { series: SeriesGroup; onMatchPress: (match: Match) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useSharedValue(0);
  
  const isWin = series.seriesWinner === 'A';
  const seriesScore = `${series.teamAWins}-${series.teamBWins}`;
  
  const handleToggle = useCallback(() => {
    Haptics.selectionAsync();
    rotateAnim.value = withTiming(expanded ? 0 : 1, { duration: 200 });
    setExpanded(!expanded);
  }, [expanded, rotateAnim]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateAnim.value * 180}deg` }],
  }));

  const getResultText = () => {
    if (!series.isComplete) return 'En cours';
    return isWin ? 'Série gagnée' : 'Série perdue';
  };

  return (
    <View style={styles.seriesCard}>
      <Pressable style={styles.seriesHeader} onPress={handleToggle}>
        <View style={[styles.seriesIndicator, { backgroundColor: isWin ? theme.success : series.isComplete ? theme.error : theme.warning }]} />
        
        <View style={styles.seriesHeaderContent}>
          <View style={styles.seriesHeaderTop}>
            <View style={styles.seriesBadgeContainer}>
              <View style={[styles.seriesBadge, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="replay" size={12} color={theme.accent} />
                <Text style={[styles.badgeText, { color: theme.accent }]}>Best of 3</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="fitness-center" size={12} color={theme.primary} />
                <Text style={[styles.badgeText, { color: theme.primary }]}>{series.format}</Text>
              </View>
            </View>
            <Text style={styles.timeText}>
              {new Date(series.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.seriesTeamsRow}>
            <View style={styles.seriesTeamCol}>
              <Text style={styles.seriesTeamLabel}>MOI</Text>
              <Text style={styles.seriesTeamNames} numberOfLines={1}>
                {series.teamANames.slice(0, 2).join(' • ')}
              </Text>
            </View>
            
            <View style={styles.seriesScoreContainer}>
              <View style={[
                styles.seriesScoreBadge,
                { backgroundColor: isWin ? theme.success : series.isComplete ? theme.error : theme.warning }
              ]}>
                <Text style={styles.seriesScoreText}>{seriesScore}</Text>
              </View>
              <Text style={[
                styles.seriesResultLabel,
                { color: isWin ? theme.success : series.isComplete ? theme.error : theme.warning }
              ]}>
                {getResultText()}
              </Text>
            </View>
            
            <View style={[styles.seriesTeamCol, styles.teamRight]}>
              <Text style={styles.seriesTeamLabel}>ADV</Text>
              <Text style={styles.seriesTeamNames} numberOfLines={1}>
                {series.teamBNames.slice(0, 2).join(' • ')}
              </Text>
            </View>
          </View>

          <View style={styles.seriesFooter}>
            <View style={styles.matchCountRow}>
              {series.matches.map((match, idx) => (
                <View
                  key={match.id}
                  style={[
                    styles.matchDot,
                    { backgroundColor: match.winner === 'A' ? theme.success : theme.error }
                  ]}
                />
              ))}
            </View>
            <View style={styles.expandButton}>
              <Text style={styles.expandText}>{expanded ? 'Réduire' : 'Voir les matchs'}</Text>
              <Animated.View style={chevronStyle}>
                <MaterialIcons name="expand-more" size={18} color={theme.primary} />
              </Animated.View>
            </View>
          </View>
        </View>
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.seriesMatchList}>
          {series.matches.map((match) => (
            <MatchCard key={match.id} match={match} onPress={() => onMatchPress(match)} compact />
          ))}
        </Animated.View>
      )}
    </View>
  );
});

// Challenge Card Component - Improved design
const ChallengeCard = React.memo(({ challenge, onPress }: { challenge: Challenge; onPress: () => void }) => {
  const config = CHALLENGE_CONFIG[challenge.type];
  const score = challenge.type === 'precision' ? challenge.totalPoints || 0 : challenge.successRate || 0;
  const percentage = Math.min(100, score);
  const is1v1 = challenge.mode === '1v1';

  return (
    <Pressable style={styles.challengeCard} onPress={onPress}>
      <View style={[styles.challengeIndicator, { backgroundColor: config.color }]} />
      <View style={styles.challengeContent}>
        <View style={styles.challengeHeader}>
          <View style={[styles.challengeIconBox, { backgroundColor: config.color + '15' }]}>
            <MaterialIcons name={config.icon} size={20} color={config.color} />
          </View>
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeName}>{config.name}</Text>
            {challenge.playerName && (
              <Text style={styles.challengePlayer} numberOfLines={1}>
                {is1v1 ? `${challenge.playerName} vs ${challenge.opponentName}` : challenge.playerName}
              </Text>
            )}
          </View>
          <View style={styles.challengeScoreBox}>
            <Text style={[styles.challengeScoreValue, { color: config.color }]}>
              {score}{challenge.type === 'precision' ? '' : '%'}
            </Text>
            <Text style={styles.challengeScoreLabel}>
              {challenge.type === 'precision' ? 'pts' : 'réussite'}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.challengeProgress}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: config.color }]} />
          </View>
          {challenge.successCount !== undefined && (
            <Text style={styles.progressLabel}>{challenge.successCount}/{challenge.totalShots}</Text>
          )}
        </View>

        {/* Footer with badges */}
        <View style={styles.challengeFooter}>
          {is1v1 && challenge.winner && (
            <View style={[
              styles.challengeWinnerBadge,
              { backgroundColor: challenge.winner === 'player' ? theme.success : challenge.winner === 'opponent' ? theme.error : theme.warning }
            ]}>
              <MaterialIcons 
                name={challenge.winner === 'draw' ? 'handshake' : challenge.winner === 'player' ? 'emoji-events' : 'sentiment-dissatisfied'} 
                size={12} 
                color="#FFF" 
              />
              <Text style={styles.challengeWinnerText}>
                {challenge.winner === 'draw' ? 'Égalité' : challenge.winner === 'player' ? 'Victoire' : 'Défaite'}
              </Text>
            </View>
          )}
          {is1v1 && (
            <View style={[styles.modeBadge, { backgroundColor: theme.accent + '15' }]}>
              <MaterialIcons name="people" size={10} color={theme.accent} />
              <Text style={[styles.modeBadgeText, { color: theme.accent }]}>1v1</Text>
            </View>
          )}
          {challenge.carreauCount && challenge.carreauCount > 0 ? (
            <View style={[styles.modeBadge, { backgroundColor: theme.carreauColor + '15' }]}>
              <MaterialIcons name="stars" size={10} color={theme.carreauColor} />
              <Text style={[styles.modeBadgeText, { color: theme.carreauColor }]}>{challenge.carreauCount} carreau{challenge.carreauCount > 1 ? 'x' : ''}</Text>
            </View>
          ) : null}
          <Text style={styles.challengeTime}>
            {new Date(challenge.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
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

// Challenge Stats Summary
const ChallengeStatsSummary = React.memo(({ challenges }: { challenges: Challenge[] }) => {
  const stats = useMemo(() => {
    const byType = {
      '10_tirs': challenges.filter(c => c.type === '10_tirs'),
      '10_tirs_sautee': challenges.filter(c => c.type === '10_tirs_sautee'),
      'precision': challenges.filter(c => c.type === 'precision'),
    };
    
    const avgRate = (arr: Challenge[]) => {
      if (arr.length === 0) return 0;
      return Math.round(arr.reduce((sum, c) => sum + (c.successRate || c.totalPoints || 0), 0) / arr.length);
    };

    return {
      total: challenges.length,
      byType: {
        '10_tirs': { count: byType['10_tirs'].length, avg: avgRate(byType['10_tirs']) },
        '10_tirs_sautee': { count: byType['10_tirs_sautee'].length, avg: avgRate(byType['10_tirs_sautee']) },
        'precision': { count: byType['precision'].length, avg: avgRate(byType['precision']) },
      },
    };
  }, [challenges]);

  if (challenges.length === 0) return null;

  return (
    <View style={styles.challengeStatsCard}>
      <View style={styles.challengeStatsHeader}>
        <MaterialIcons name="track-changes" size={18} color={theme.primary} />
        <Text style={styles.challengeStatsTitle}>Résumé des défis</Text>
        <View style={styles.challengeStatsCount}>
          <Text style={styles.challengeStatsCountText}>{stats.total}</Text>
        </View>
      </View>
      <View style={styles.challengeStatsGrid}>
        {(Object.keys(CHALLENGE_CONFIG) as (keyof typeof CHALLENGE_CONFIG)[]).map(type => {
          const cfg = CHALLENGE_CONFIG[type];
          const data = stats.byType[type];
          if (data.count === 0) return null;
          return (
            <View key={type} style={styles.challengeStatItem}>
              <View style={[styles.challengeStatIcon, { backgroundColor: cfg.color + '15' }]}>
                <MaterialIcons name={cfg.icon} size={16} color={cfg.color} />
              </View>
              <View style={styles.challengeStatInfo}>
                <Text style={styles.challengeStatName}>{cfg.name}</Text>
                <Text style={styles.challengeStatMeta}>{data.count} défi{data.count > 1 ? 's' : ''} • {data.avg}{type === 'precision' ? ' pts' : '%'} moy.</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { theme: t } = useTheme();
  const { matches, challenges, deleteChallenge } = useApp();
  
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [trainingSubFilter, setTrainingSubFilter] = useState<TrainingSubFilter>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('all');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

  // Group matches by series
  const groupMatchesBySeries = useCallback((matchList: Match[]): (Match | SeriesGroup)[] => {
    const seriesMap = new Map<string, Match[]>();
    const standaloneMatches: Match[] = [];
    
    matchList.forEach(match => {
      if (match.seriesInfo?.seriesId) {
        const existing = seriesMap.get(match.seriesInfo.seriesId) || [];
        existing.push(match);
        seriesMap.set(match.seriesInfo.seriesId, existing);
      } else {
        standaloneMatches.push(match);
      }
    });

    const result: (Match | SeriesGroup)[] = [...standaloneMatches];

    seriesMap.forEach((seriesMatches, seriesId) => {
      seriesMatches.sort((a, b) => (a.seriesInfo?.matchNumber || 0) - (b.seriesInfo?.matchNumber || 0));
      
      const lastMatch = seriesMatches[seriesMatches.length - 1];
      const teamAWins = seriesMatches.filter(m => m.winner === 'A').length;
      const teamBWins = seriesMatches.filter(m => m.winner === 'B').length;
      
      result.push({
        seriesId,
        matches: seriesMatches,
        teamAWins,
        teamBWins,
        seriesWinner: lastMatch.seriesInfo?.seriesWinner || null,
        isComplete: lastMatch.seriesInfo?.seriesComplete || false,
        format: lastMatch.format,
        teamANames: lastMatch.teamA.playerNames,
        teamBNames: lastMatch.teamB.playerNames,
        date: seriesMatches[0].date,
      });
    });

    return result;
  }, []);

  // Filtered and grouped data
  const { listData, stats, filteredChallenges, trainingStats } = useMemo(() => {
    const periodDays = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.days || 0;
    const filteredMatches = filterByPeriod(matches, periodDays);
    const filteredChallengesData = filterByPeriod(challenges, periodDays);

    const trainingMatches = filteredMatches.filter(m => m.mode === 'Entraînement');
    const tournamentMatches = filteredMatches.filter(m => m.mode === 'Tournoi');
    
    // Separate training matches into standalone and series
    const standaloneTraining = trainingMatches.filter(m => !m.seriesInfo?.seriesId);
    const seriesTraining = trainingMatches.filter(m => m.seriesInfo?.seriesId);
    
    // Group series matches
    const groupedSeries = groupMatchesBySeries(seriesTraining);
    const seriesGroups = groupedSeries.filter(item => 'seriesId' in item) as SeriesGroup[];

    let items: { type: 'match' | 'series' | 'challenge'; data: Match | SeriesGroup | Challenge; date: string }[] = [];
    
    if (contentFilter === 'all') {
      // Show everything
      const groupedTraining = groupMatchesBySeries(trainingMatches);
      groupedTraining.forEach(item => {
        if ('seriesId' in item) {
          items.push({ type: 'series', data: item as SeriesGroup, date: item.date });
        } else {
          items.push({ type: 'match', data: item as Match, date: item.date });
        }
      });
      tournamentMatches.forEach(m => {
        items.push({ type: 'match', data: m, date: m.date });
      });
      filteredChallengesData.forEach(c => {
        items.push({ type: 'challenge', data: c, date: c.date });
      });
    } else if (contentFilter === 'training') {
      // Apply training sub-filter
      if (trainingSubFilter === 'all') {
        standaloneTraining.forEach(m => {
          items.push({ type: 'match', data: m, date: m.date });
        });
        seriesGroups.forEach(s => {
          items.push({ type: 'series', data: s, date: s.date });
        });
        filteredChallengesData.forEach(c => {
          items.push({ type: 'challenge', data: c, date: c.date });
        });
      } else if (trainingSubFilter === 'matches') {
        standaloneTraining.forEach(m => {
          items.push({ type: 'match', data: m, date: m.date });
        });
      } else if (trainingSubFilter === 'series') {
        seriesGroups.forEach(s => {
          items.push({ type: 'series', data: s, date: s.date });
        });
      } else if (trainingSubFilter === 'challenges') {
        filteredChallengesData.forEach(c => {
          items.push({ type: 'challenge', data: c, date: c.date });
        });
      }
    } else if (contentFilter === 'tournament') {
      tournamentMatches.forEach(m => {
        items.push({ type: 'match', data: m, date: m.date });
      });
    } else if (contentFilter === 'challenges') {
      filteredChallengesData.forEach(c => {
        items.push({ type: 'challenge', data: c, date: c.date });
      });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Remove duplicates
    const uniqueIds = new Set<string>();
    items = items.filter(item => {
      const id = item.type === 'series' ? `series-${(item.data as SeriesGroup).seriesId}` :
                 item.type === 'match' ? `match-${(item.data as Match).id}` :
                 `challenge-${(item.data as Challenge).id}`;
      if (uniqueIds.has(id)) return false;
      uniqueIds.add(id);
      return true;
    });

    // Group by date with headers
    const listData: HistoryItem[] = [];
    let currentDateKey = '';
    
    items.forEach(item => {
      const dateKey = getDateKey(new Date(item.date));
      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        listData.push({ type: 'header', title: dateKey, date: item.date });
      }
      listData.push(item as HistoryItem);
    });

    return {
      listData,
      stats: {
        trainingCount: trainingMatches.length,
        tournamentCount: tournamentMatches.length,
        challengeCount: filteredChallengesData.length,
        total: trainingMatches.length + tournamentMatches.length + filteredChallengesData.length
      },
      filteredChallenges: filteredChallengesData,
      trainingStats: {
        matchesCount: standaloneTraining.length,
        seriesCount: seriesGroups.length,
        challengesCount: filteredChallengesData.length,
      },
    };
  }, [matches, challenges, contentFilter, trainingSubFilter, selectedPeriod, groupMatchesBySeries]);

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
    if (filter !== 'training') {
      setTrainingSubFilter('all');
    }
  }, []);

  const handleTrainingSubFilterPress = useCallback((filter: TrainingSubFilter) => {
    Haptics.selectionAsync();
    setTrainingSubFilter(filter);
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
    
    if (item.type === 'series') {
      return (
        <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 20, 100))}>
          <SeriesCard series={item.data as SeriesGroup} onMatchPress={handleMatchPress} />
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
    if (item.type === 'series') return `series-${(item.data as SeriesGroup).seriesId}`;
    if (item.type === 'match') return `match-${(item.data as Match).id}`;
    return `challenge-${(item.data as Challenge).id}`;
  }, []);

  const selectedPeriodLabel = PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label || 'Tout';

  // List header with challenge stats
  const ListHeader = useCallback(() => {
    if (contentFilter === 'challenges' && filteredChallenges.length > 0) {
      return <ChallengeStatsSummary challenges={filteredChallenges} />;
    }
    if (contentFilter === 'training' && trainingSubFilter === 'challenges' && filteredChallenges.length > 0) {
      return <ChallengeStatsSummary challenges={filteredChallenges} />;
    }
    return null;
  }, [contentFilter, trainingSubFilter, filteredChallenges]);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: t.backgroundSecondary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
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
      <View style={[styles.filtersRow, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
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

      {/* Training Sub-Filters */}
      {contentFilter === 'training' && (
        <Animated.View entering={FadeInDown.duration(200)} style={[styles.subFiltersRow, { backgroundColor: t.backgroundSecondary, borderBottomColor: t.border }]}>
          {TRAINING_SUB_FILTERS.map((filter) => {
            const isActive = trainingSubFilter === filter.id;
            const count = filter.id === 'all' ? (trainingStats.matchesCount + trainingStats.seriesCount + trainingStats.challengesCount)
              : filter.id === 'matches' ? trainingStats.matchesCount
              : filter.id === 'series' ? trainingStats.seriesCount
              : trainingStats.challengesCount;

            return (
              <Pressable
                key={filter.id}
                style={[styles.subFilterChip, isActive && styles.subFilterChipActive]}
                onPress={() => handleTrainingSubFilterPress(filter.id)}
              >
                <MaterialIcons name={filter.icon} size={12} color={isActive ? theme.primary : theme.textMuted} />
                <Text style={[styles.subFilterChipText, isActive && styles.subFilterChipTextActive]}>{filter.label}</Text>
                <Text style={[styles.subFilterCount, isActive && styles.subFilterCountActive]}>{count}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      )}

      {/* List */}
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
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
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: t.backgroundSecondary }]}>
          <View style={[styles.modalHeader, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
            <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Période</Text>
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
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: t.backgroundSecondary }]}>
          <View style={[styles.modalHeader, { backgroundColor: t.surface, borderBottomColor: t.border }]}>
            <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Détails du défi</Text>
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
  
  // Series Card
  seriesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 10,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  seriesHeader: { flexDirection: 'row' },
  seriesIndicator: { width: 4 },
  seriesHeaderContent: { flex: 1, padding: 12 },
  seriesHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  seriesBadgeContainer: { flexDirection: 'row', gap: 6 },
  seriesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  seriesTeamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  seriesTeamCol: { flex: 1 },
  seriesTeamLabel: { fontSize: 9, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, marginBottom: 2 },
  seriesTeamNames: { fontSize: 12, fontWeight: '500', color: theme.textPrimary },
  seriesScoreContainer: { alignItems: 'center', paddingHorizontal: 12 },
  seriesScoreBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.borderRadius.md, marginBottom: 4 },
  seriesScoreText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  seriesResultLabel: { fontSize: 10, fontWeight: '600' },
  seriesFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  matchCountRow: { flexDirection: 'row', gap: 6 },
  matchDot: { width: 10, height: 10, borderRadius: 5 },
  expandButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expandText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  seriesMatchList: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 },
  
  // Compact Match Card
  compactMatchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.sm, padding: 10, gap: 10 },
  compactIndicator: { width: 3, height: 28, borderRadius: 2 },
  compactMatchContent: { flex: 1 },
  compactMatchLabel: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, marginBottom: 2 },
  compactScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactScore: { fontSize: 16, fontWeight: '700', color: theme.textSecondary },
  compactScoreWin: { color: theme.success },
  compactScoreLoss: { color: theme.error },
  compactScoreSep: { fontSize: 12, color: theme.textMuted },
  
  // Challenge Card - New improved design
  challengeCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 10,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  challengeIndicator: { width: 4 },
  challengeContent: { flex: 1, padding: 12 },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  challengeIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  challengeInfo: { flex: 1 },
  challengeName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  challengePlayer: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  challengeScoreBox: { alignItems: 'flex-end' },
  challengeScoreValue: { fontSize: 22, fontWeight: '800' },
  challengeScoreLabel: { fontSize: 10, color: theme.textMuted },
  challengeProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  progressTrack: { flex: 1, height: 5, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  challengeFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  challengeWinnerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  challengeWinnerText: { fontSize: 10, fontWeight: '600', color: '#FFF' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: theme.borderRadius.sm },
  modeBadgeText: { fontSize: 10, fontWeight: '600' },
  challengeTime: { fontSize: 10, color: theme.textMuted, marginLeft: 'auto' },
  
  // Challenge Stats Summary Card
  challengeStatsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  challengeStatsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  challengeStatsTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  challengeStatsCount: { backgroundColor: theme.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.full },
  challengeStatsCountText: { fontSize: 12, fontWeight: '700', color: theme.primary },
  challengeStatsGrid: { gap: 8 },
  challengeStatItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  challengeStatIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  challengeStatInfo: { flex: 1 },
  challengeStatName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  challengeStatMeta: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  
  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  emptyText: { fontSize: 13, color: theme.textSecondary, marginBottom: 20 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: theme.primary, borderRadius: theme.borderRadius.full },
  resetBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  
  // Sub-filters
  subFiltersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: theme.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  subFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  subFilterChipActive: {
    backgroundColor: theme.primary + '15',
    borderColor: theme.primary,
  },
  subFilterChipText: { fontSize: 11, fontWeight: '500', color: theme.textMuted },
  subFilterChipTextActive: { color: theme.primary, fontWeight: '600' },
  subFilterCount: { fontSize: 10, fontWeight: '600', color: theme.textMuted, marginLeft: 2 },
  subFilterCountActive: { color: theme.primary },
  
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
  detailOpponent: { backgroundColor: theme.accent + '10', borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 20 },
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
