import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  RefreshControl,
  Dimensions,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { Match, Challenge, SeriesInfo } from '@/services/mockData';
import { useLanguage } from '@/hooks/useLanguage';
import ShareModal from '@/components/ui/ShareModal';
import ShareRequestModal from '@/components/ui/ShareRequestModal';
import SharedBadge from '@/components/ui/SharedBadge';
import { getShareRequestsForItem, MatchShareRequest } from '@/services/matchShareService';
import { checkEditConflict, computeChallengeDiffs, fetchUpdatedAt, DiffEntry } from '@/services/collaborativeEditService';
import { logModification } from '@/services/modificationLogService';
import { getSupabaseClient, useAuth } from '@/template';
import EditConflictModal from '@/components/ui/EditConflictModal';
import ShareStatusSection from '@/components/ui/ShareStatusSection';
import ModificationLogsSection from '@/components/ui/ModificationLogsSection';
import AdBanner from '@/components/ui/AdBanner';
import Svg, { Circle, Line, G, Polygon, Text as SvgText } from 'react-native-svg';
import { Image } from 'expo-image';
import { getMyMeetups, getInvitedMeetups, getMeetupResponses, Meetup, MeetupResponse } from '@/services/meetupService';


// Constants
const CHALLENGE_CONFIG = {
  '10_tirs': { nameKey: 'tenShots', icon: 'gps-fixed' as const, color: '#F97316' },
  '10_tirs_sautee': { nameKey: 'tenShotsLob', icon: 'sports' as const, color: '#3B82F6' },
  'precision': { nameKey: 'precision', icon: 'stars' as const, color: '#F59E0B' },
} as const;

type ContentFilter = 'all' | 'training' | 'tournament' | 'meetups' | 'shared';
type TrainingSubFilter = 'all' | 'matches' | 'challenges' | 'series';
type PeriodOption = 'all' | 'week' | '2weeks' | 'month' | '3months' | '6months' | 'year';

const PERIOD_KEYS: Record<PeriodOption, string> = {
  all: 'allTime',
  week: 'sevenDays',
  '2weeks': 'twoWeeks',
  month: 'oneMonth',
  '3months': 'threeMonths',
  '6months': 'sixMonths',
  year: 'oneYear',
};

const PERIOD_DAYS: Record<PeriodOption, number> = {
  all: 0,
  week: 7,
  '2weeks': 14,
  month: 30,
  '3months': 90,
  '6months': 180,
  year: 365,
};

const PERIOD_IDS: PeriodOption[] = ['all', 'week', '2weeks', 'month', '3months', '6months', 'year'];

type ContentFilterDef = { id: ContentFilter; labelKey: string; icon: keyof typeof MaterialIcons.glyphMap };
const CONTENT_FILTERS: ContentFilterDef[] = [
  { id: 'all', labelKey: 'all', icon: 'layers' },
  { id: 'training', labelKey: 'trainings', icon: 'fitness-center' },
  { id: 'tournament', labelKey: 'tournaments', icon: 'emoji-events' },
  { id: 'meetups', labelKey: 'meetups', icon: 'event' },
  { id: 'shared', labelKey: 'sharedReceived', icon: 'group' },
];

type TrainingSubFilterDef = { id: TrainingSubFilter; labelKey: string; icon: keyof typeof MaterialIcons.glyphMap };
const TRAINING_SUB_FILTERS: TrainingSubFilterDef[] = [
  { id: 'all', labelKey: 'all', icon: 'layers' },
  { id: 'matches', labelKey: 'matches', icon: 'sports' },
  { id: 'challenges', labelKey: 'challenges', icon: 'track-changes' },
  { id: 'series', labelKey: 'series', icon: 'replay' },
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
  | { type: 'meetup'; data: Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number }; date: string }
  | { type: 'header'; title: string; date: string }
  | { type: 'ad'; date: string; adIndex: number };

// Utility functions
const getDateKey = (date: Date, lang: 'fr' | 'en'): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return lang === 'fr' ? "Aujourd'hui" : 'Today';
  if (date.toDateString() === yesterday.toDateString()) return lang === 'fr' ? 'Hier' : 'Yesterday';
  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
};

const filterByPeriod = <T extends { date: string }>(items: T[], days: number): T[] => {
  if (days === 0) return items;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return items.filter(item => new Date(item.date) >= cutoff);
};

// Components
const MatchCard = React.memo(({ match, onPress, compact = false, t, language, isShared, sharedPermission }: { match: Match; onPress: () => void; compact?: boolean; t: (s: string, k: string) => string; language: 'fr' | 'en'; isShared?: boolean; sharedPermission?: 'read' | 'write' | null }) => {
  const isWin = match.winner === 'A';
  const isTournament = match.mode === 'Tournoi';

  if (compact) {
    return (
      <Pressable style={styles.compactMatchCard} onPress={onPress}>
        <View style={[styles.compactIndicator, { backgroundColor: isWin ? theme.success : theme.error }]} />
        <View style={styles.compactMatchContent}>
          <Text style={styles.compactMatchLabel}>
            {match.seriesInfo?.isFinale ? t('history', 'finale') : `${t('history', 'matchN')} ${match.seriesInfo?.matchNumber}`}
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
              {isTournament ? t('modes', 'tournament') : t('modes', 'training')}
            </Text>
          </View>
          <Text style={styles.timeText}>
            {new Date(match.date).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {isTournament && match.tournamentName && (
          <Text style={styles.tournamentName} numberOfLines={1}>{match.tournamentName}</Text>
        )}

        <View style={styles.scoreRow}>
          <View style={styles.teamCol}>
            <Text style={styles.teamLabel}>{t('history', 'me')}</Text>
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
            <Text style={styles.teamLabel}>{t('history', 'opp')}</Text>
            <Text style={styles.teamNames} numberOfLines={1}>
              {match.teamB.playerNames.slice(0, 2).join(' • ')}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.resultBadge, { backgroundColor: isWin ? theme.success + '15' : theme.error + '15' }]}>
            <MaterialIcons name={isWin ? 'check-circle' : 'cancel'} size={12} color={isWin ? theme.success : theme.error} />
            <Text style={[styles.resultText, { color: isWin ? theme.success : theme.error }]}>
              {isWin ? t('history', 'victory') : t('history', 'defeat')}
            </Text>
          </View>
          {isShared ? (
            <View style={styles.sharedInlineBadge}>
              <MaterialIcons name={sharedPermission === 'write' ? 'edit' : 'visibility'} size={10} color={sharedPermission === 'write' ? theme.accent : theme.primary} />
              <Text style={[styles.sharedInlineBadgeText, { color: sharedPermission === 'write' ? theme.accent : theme.primary }]}>
                {language === 'fr' ? 'Partagé' : 'Shared'}
              </Text>
            </View>
          ) : null}
          <Text style={styles.formatText}>{t('formats', match.format)}</Text>
        </View>
      </View>
    </Pressable>
  );
});

// Series Card Component
const SeriesCard = React.memo(({ series, onMatchPress, t, language }: { series: SeriesGroup; onMatchPress: (match: Match) => void; t: (s: string, k: string) => string; language: 'fr' | 'en' }) => {
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
    if (!series.isComplete) return t('history', 'inProgress');
    return isWin ? t('history', 'seriesWon') : t('history', 'seriesLost');
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
                <Text style={[styles.badgeText, { color: theme.primary }]}>{t('formats', series.format)}</Text>
              </View>
            </View>
            <Text style={styles.timeText}>
              {new Date(series.date).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.seriesTeamsRow}>
            <View style={styles.seriesTeamCol}>
              <Text style={styles.seriesTeamLabel}>{t('history', 'me')}</Text>
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
              <Text style={styles.seriesTeamLabel}>{t('history', 'opp')}</Text>
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
              <Text style={styles.expandText}>{expanded ? t('history', 'collapse') : t('history', 'seeMatches')}</Text>
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
            <MatchCard key={match.id} match={match} onPress={() => onMatchPress(match)} compact t={t} language={language} />
          ))}
        </Animated.View>
      )}
    </View>
  );
});

// Challenge Card Component - Improved design
const ChallengeCard = React.memo(({ challenge, onPress, t, language, isShared, sharedPermission }: { challenge: Challenge; onPress: () => void; t: (s: string, k: string) => string; language: 'fr' | 'en'; isShared?: boolean; sharedPermission?: 'read' | 'write' | null }) => {
  const config = CHALLENGE_CONFIG[challenge.type];
  const challengeName = t('challenge', config.nameKey);
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
            <Text style={styles.challengeName}>{challengeName}</Text>
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
              {challenge.type === 'precision' ? 'pts' : t('history', 'success')}
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
        {/* Sponsored badge */}
        {challenge.sponsorId ? (
          <View style={styles.challengeSponsorRow}>
            {challenge.sponsorPhoto ? (
              <Image source={{ uri: challenge.sponsorPhoto }} style={styles.challengeSponsorPhoto} contentFit="cover" transition={200} />
            ) : null}
            <Text style={styles.challengeSponsorName} numberOfLines={1}>{challenge.sponsorName}</Text>
            <View style={styles.challengeSponsorBadge}>
              <MaterialIcons name="verified" size={9} color="#FFF" />
              <Text style={styles.challengeSponsorBadgeText}>{t('challenge', 'sponsoredBadge')}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.challengeFooter}>
          {isShared ? (
            <View style={styles.sharedInlineBadge}>
              <MaterialIcons name={sharedPermission === 'write' ? 'edit' : 'visibility'} size={10} color={sharedPermission === 'write' ? theme.accent : theme.primary} />
              <Text style={[styles.sharedInlineBadgeText, { color: sharedPermission === 'write' ? theme.accent : theme.primary }]}>
                {language === 'fr' ? 'Partagé' : 'Shared'}
              </Text>
            </View>
          ) : null}
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
                {challenge.winner === 'draw' ? t('history', 'draw') : challenge.winner === 'player' ? t('history', 'victory') : t('history', 'defeat')}
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
              <Text style={[styles.modeBadgeText, { color: theme.carreauColor }]}>{challenge.carreauCount} {challenge.carreauCount > 1 ? t('history', 'carreauxPlural') : t('history', 'carreauSingular')}</Text>
            </View>
          ) : null}
          <Text style={styles.challengeTime}>
            {new Date(challenge.date).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
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
const ChallengeStatsSummary = React.memo(({ challenges, t }: { challenges: Challenge[]; t: (s: string, k: string) => string }) => {
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
        <Text style={styles.challengeStatsTitle}>{t('history', 'challengeSummary')}</Text>
        <View style={styles.challengeStatsCount}>
          <Text style={styles.challengeStatsCountText}>{stats.total}</Text>
        </View>
      </View>
      <View style={styles.challengeStatsGrid}>
        {(Object.keys(CHALLENGE_CONFIG) as (keyof typeof CHALLENGE_CONFIG)[]).map(type => {
          const cfg = CHALLENGE_CONFIG[type];
          const challengeName = t('challenge', cfg.nameKey);
          const data = stats.byType[type];
          if (data.count === 0) return null;
          return (
            <View key={type} style={styles.challengeStatItem}>
              <View style={[styles.challengeStatIcon, { backgroundColor: cfg.color + '15' }]}>
                <MaterialIcons name={cfg.icon} size={16} color={cfg.color} />
              </View>
              <View style={styles.challengeStatInfo}>
                <Text style={styles.challengeStatName}>{challengeName}</Text>
                <Text style={styles.challengeStatMeta}>{data.count} {data.count > 1 ? t('history', 'challenges').toLowerCase() : t('history', 'challenges').toLowerCase()} • {data.avg}{type === 'precision' ? ' pts' : '%'} {t('history', 'avg')}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

// Meetup Card Component
const MeetupCard = React.memo(({ meetup, onPress, t, language }: { meetup: Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number }; onPress: () => void; t: (s: string, k: string) => string; language: 'fr' | 'en' }) => {
  const mDate = new Date(meetup.date);
  const isCreator = meetup._source === 'created';
  const isPast = mDate < new Date();
  const daysUntil = Math.max(0, Math.ceil((mDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <Pressable style={styles.meetupCard} onPress={onPress}>
      <View style={[styles.meetupCardIndicator, { backgroundColor: isPast ? theme.textMuted : theme.accent }]} />
      <View style={styles.meetupCardContent}>
        <View style={styles.meetupCardHeader}>
          <View style={[styles.badge, { backgroundColor: isCreator ? theme.primary + '15' : theme.accent + '15' }]}>
            <MaterialIcons
              name={isCreator ? 'person' : 'mail'}
              size={12}
              color={isCreator ? theme.primary : theme.accent}
            />
            <Text style={[styles.badgeText, { color: isCreator ? theme.primary : theme.accent }]}>
              {isCreator ? t('history', 'meetupCreator') : t('history', 'meetupInvited')}
            </Text>
          </View>
          {!isPast && daysUntil <= 1 ? (
            <View style={[styles.badge, { backgroundColor: theme.warning + '15' }]}>
              <MaterialIcons name="local-fire-department" size={12} color={theme.warning} />
              <Text style={[styles.badgeText, { color: theme.warning }]}>
                {daysUntil === 0 ? t('notifications', 'todayLabel') : t('notifications', 'tomorrowLabel')}
              </Text>
            </View>
          ) : isPast ? (
            <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.badgeText, { color: theme.textMuted }]}>{t('history', 'meetupPast')}</Text>
            </View>
          ) : null}
          <Text style={styles.timeText}>
            {mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        <Text style={styles.meetupCardTitle} numberOfLines={1}>{meetup.title}</Text>

        <View style={styles.meetupCardMeta}>
          {meetup.terrain_name ? (
            <View style={styles.meetupMetaItem}>
              <MaterialIcons name="place" size={12} color={theme.textMuted} />
              <Text style={styles.meetupMetaText} numberOfLines={1}>{meetup.terrain_name}{meetup.terrain_city ? ` - ${meetup.terrain_city}` : ''}</Text>
            </View>
          ) : null}
          <View style={styles.meetupMetaItem}>
            <MaterialIcons name="event" size={12} color={theme.textMuted} />
            <Text style={styles.meetupMetaText}>
              {mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>

        <View style={styles.meetupCardFooter}>
          <View style={[styles.meetupParticipantsBadge, { backgroundColor: theme.success + '12' }]}>
            <MaterialIcons name="group" size={12} color={theme.success} />
            <Text style={[styles.meetupParticipantsText, { color: theme.success }]}>
              {meetup._acceptedCount || 0}/{meetup.max_participants} {t('history', 'meetupParticipants')}
            </Text>
          </View>
          {meetup.share_code ? (
            <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
              <MaterialIcons name="qr-code" size={10} color={theme.textMuted} />
              <Text style={[styles.badgeText, { color: theme.textMuted }]}>{meetup.share_code}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { matches, challenges, deleteChallenge, updateChallenge, deleteMatch, refreshData, boulesSets, terrains, isSharedItem, getSharedPermission, sharedMatchIds, sharedChallengeIds } = useApp();
  // refreshData is used for conflict resolution (keep theirs → reload)
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ openChallengeId?: string; openMatchId?: string }>();
  
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [trainingSubFilter, setTrainingSubFilter] = useState<TrainingSubFilter>('all');
  const [meetupStatusFilter, setMeetupStatusFilter] = useState<'all' | 'active' | 'past'>('all');
  const [meetupRoleFilter, setMeetupRoleFilter] = useState<'all' | 'creator' | 'invited'>('all');
  const [meetupTerrainFilter, setMeetupTerrainFilter] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('all');
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [viewingMatch, setViewingMatch] = useState<Match | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [showChallengeShareRequest, setShowChallengeShareRequest] = useState(false);
  const [isEditingChallengeFields, setIsEditingChallengeFields] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editSuccessCount, setEditSuccessCount] = useState('');
  const [editCarreauCount, setEditCarreauCount] = useState('');
  const [editTotalPoints, setEditTotalPoints] = useState('');
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showMatchShareRequest, setShowMatchShareRequest] = useState(false);
  const [initialOpenHandled, setInitialOpenHandled] = useState(false);
  const [challengeShareRequests, setChallengeShareRequests] = useState<MatchShareRequest[]>([]);

  // Collaborative conflict detection for challenges
  const [challengeServerUpdatedAt, setChallengeServerUpdatedAt] = useState<string | null>(null);
  const [showChallengeConflict, setShowChallengeConflict] = useState(false);
  const [challengeConflictDiffs, setChallengeConflictDiffs] = useState<DiffEntry[]>([]);
  const [pendingChallengeSave, setPendingChallengeSave] = useState<Partial<Challenge> | null>(null);

  // Meetup state
  const [allMeetups, setAllMeetups] = useState<(Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number })[]>([]);
  const [meetupsLoading, setMeetupsLoading] = useState(true);

  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: any) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;

  // Load meetups
  const loadMeetups = useCallback(async () => {
    try {
      const [{ meetups: created }, { meetups: invited }] = await Promise.all([
        getMyMeetups(),
        getInvitedMeetups(),
      ]);
      const allMap = new Map<string, Meetup & { _source: 'created' | 'invited' }>();
      created.forEach(m => allMap.set(m.id, { ...m, _source: 'created' }));
      invited.forEach(m => {
        if (!allMap.has(m.id)) allMap.set(m.id, { ...m, _source: 'invited' });
      });
      const sorted = Array.from(allMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      // Fetch participant counts
      const withCounts = await Promise.all(
        sorted.map(async (m) => {
          const { responses } = await getMeetupResponses(m.id);
          const acceptedCount = responses.filter((r: MeetupResponse) => r.status === 'accepted').length;
          return { ...m, _acceptedCount: acceptedCount };
        })
      );
      setAllMeetups(withCounts);
    } catch { /* silent */ } finally {
      setMeetupsLoading(false);
    }
  }, []);

  useEffect(() => { loadMeetups(); }, [loadMeetups]);

  // Auto-open challenge or match from deep link / home page navigation
  useEffect(() => {
    if (initialOpenHandled) return;
    if (params.openChallengeId && challenges.length > 0) {
      const challenge = challenges.find(c => c.id === params.openChallengeId);
      if (challenge) {
        setEditingChallenge(challenge);
        setIsEditingChallengeFields(false);
        setEditNotes(challenge.notes || '');
        setEditDuration(challenge.duration ? String(challenge.duration) : '');
        setEditSuccessCount(challenge.successCount !== undefined ? String(challenge.successCount) : '');
        setEditCarreauCount(challenge.carreauCount !== undefined ? String(challenge.carreauCount) : '');
        setEditTotalPoints(challenge.totalPoints !== undefined ? String(challenge.totalPoints) : '');
      }
      setInitialOpenHandled(true);
    } else if (params.openMatchId && matches.length > 0) {
      const match = matches.find(m => m.id === params.openMatchId);
      if (match) {
        setViewingMatch(match);
      }
      setInitialOpenHandled(true);
    }
  }, [params.openChallengeId, params.openMatchId, challenges, matches, initialOpenHandled]);

  // Load share request info and updated_at for edited challenge
  useEffect(() => {
    if (!editingChallenge) {
      setChallengeShareRequests([]);
      setChallengeServerUpdatedAt(null);
      return;
    }
    getShareRequestsForItem('challenge', editingChallenge.id).then(({ requests }) => {
      setChallengeShareRequests(requests);
    });
    // Fetch updated_at for conflict detection on shared writable challenges
    if (isSharedItem(editingChallenge.id) && getSharedPermission(editingChallenge.id) === 'write') {
      fetchUpdatedAt('challenges', editingChallenge.id).then(ts => {
        if (ts) setChallengeServerUpdatedAt(ts);
      });
    }
  }, [editingChallenge?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), loadMeetups()]);
    setRefreshing(false);
  }, [refreshData, loadMeetups]);

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
    const periodDays = PERIOD_DAYS[selectedPeriod] || 0;
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

    // Period-filter meetups
    const periodFilteredMeetups = periodDays > 0
      ? allMeetups.filter(m => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - periodDays);
          return new Date(m.date) >= cutoff;
        })
      : allMeetups;

    let items: { type: 'match' | 'series' | 'challenge' | 'meetup'; data: Match | SeriesGroup | Challenge | (Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number }); date: string }[] = [];
    
    if (contentFilter === 'all') {
      // Show everything including meetups
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
      periodFilteredMeetups.forEach(m => {
        items.push({ type: 'meetup', data: m, date: m.date });
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
    } else if (contentFilter === 'shared') {
      // Show only shared matches and challenges
      const sharedMatchSet = new Set(sharedMatchIds);
      const sharedChallengeSet = new Set(sharedChallengeIds);
      const sharedMatches = filteredMatches.filter(m => sharedMatchSet.has(m.id));
      const sharedChallengesData = filteredChallengesData.filter(c => sharedChallengeSet.has(c.id));
      sharedMatches.forEach(m => {
        items.push({ type: 'match', data: m, date: m.date });
      });
      sharedChallengesData.forEach(c => {
        items.push({ type: 'challenge', data: c, date: c.date });
      });
    } else if (contentFilter === 'meetups') {
      // Meetups are handled separately below
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Remove duplicates
    const uniqueIds = new Set<string>();
    items = items.filter(item => {
      const id = item.type === 'series' ? `series-${(item.data as SeriesGroup).seriesId}` :
                 item.type === 'match' ? `match-${(item.data as Match).id}` :
                 item.type === 'meetup' ? `meetup-${(item.data as any).id}` :
                 `challenge-${(item.data as Challenge).id}`;
      if (uniqueIds.has(id)) return false;
      uniqueIds.add(id);
      return true;
    });

    // Group by date with headers and inject ads
    const listData: HistoryItem[] = [];
    let currentDateKey = '';
    let contentCount = 0;
    const AD_INTERVAL = 8;
    
    items.forEach(item => {
      const dateKey = getDateKey(new Date(item.date), language);
      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        listData.push({ type: 'header', title: dateKey, date: item.date });
      }
      listData.push(item as HistoryItem);
      contentCount++;
      if (contentCount % AD_INTERVAL === 0) {
        listData.push({ type: 'ad', date: item.date, adIndex: contentCount });
      }
    });

    // Count shared items
    const sharedMatchSet = new Set(sharedMatchIds);
    const sharedChallengeSet = new Set(sharedChallengeIds);
    const sharedCount = filteredMatches.filter(m => sharedMatchSet.has(m.id)).length + filteredChallengesData.filter(c => sharedChallengeSet.has(c.id)).length;

    return {
      listData,
      stats: {
        trainingCount: trainingMatches.length + filteredChallengesData.length,
        tournamentCount: tournamentMatches.length,
        meetupCount: periodFilteredMeetups.length,
        sharedCount,
        total: trainingMatches.length + tournamentMatches.length + filteredChallengesData.length + periodFilteredMeetups.length
      },
      filteredChallenges: filteredChallengesData,
      trainingStats: {
        matchesCount: standaloneTraining.length,
        seriesCount: seriesGroups.length,
        challengesCount: filteredChallengesData.length,
      },
    };
  }, [matches, challenges, contentFilter, trainingSubFilter, selectedPeriod, groupMatchesBySeries, language, allMeetups, sharedMatchIds, sharedChallengeIds]);

  // Meetup sub-filter stats
  const meetupSubStats = useMemo(() => {
    const periodDays = PERIOD_DAYS[selectedPeriod] || 0;
    const periodFiltered = periodDays > 0
      ? allMeetups.filter(m => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - periodDays);
          return new Date(m.date) >= cutoff;
        })
      : allMeetups;
    const now = new Date();
    return {
      all: periodFiltered.length,
      activeCount: periodFiltered.filter(m => new Date(m.date) >= now).length,
      pastCount: periodFiltered.filter(m => new Date(m.date) < now).length,
      creatorCount: periodFiltered.filter(m => m._source === 'created').length,
      invitedCount: periodFiltered.filter(m => m._source === 'invited').length,
      terrains: [...new Set(periodFiltered.map(m => m.terrain_name).filter(Boolean))] as string[],
    };
  }, [allMeetups, selectedPeriod]);

  // Meetup list data (separate because meetups come from API, not local state)
  const meetupListData = useMemo((): HistoryItem[] => {
    if (contentFilter !== 'meetups') return [];
    const periodDays = PERIOD_DAYS[selectedPeriod] || 0;
    let filtered = periodDays > 0
      ? allMeetups.filter(m => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - periodDays);
          return new Date(m.date) >= cutoff;
        })
      : [...allMeetups];

    // Apply status filter
    const now = new Date();
    if (meetupStatusFilter === 'active') {
      filtered = filtered.filter(m => new Date(m.date) >= now);
    } else if (meetupStatusFilter === 'past') {
      filtered = filtered.filter(m => new Date(m.date) < now);
    }

    // Apply role filter
    if (meetupRoleFilter === 'creator') {
      filtered = filtered.filter(m => m._source === 'created');
    } else if (meetupRoleFilter === 'invited') {
      filtered = filtered.filter(m => m._source === 'invited');
    }

    // Apply terrain filter
    if (meetupTerrainFilter !== 'all') {
      filtered = filtered.filter(m => m.terrain_name === meetupTerrainFilter);
    }

    const result: HistoryItem[] = [];
    let currentDateKey = '';
    filtered.forEach(m => {
      const dateKey = getDateKey(new Date(m.date), language);
      if (dateKey !== currentDateKey) {
        currentDateKey = dateKey;
        result.push({ type: 'header', title: dateKey, date: m.date });
      }
      result.push({ type: 'meetup', data: m, date: m.date });
    });
    return result;
  }, [contentFilter, allMeetups, selectedPeriod, language, meetupStatusFilter, meetupRoleFilter, meetupTerrainFilter]);

  // Final combined list
  const finalListData = contentFilter === 'meetups' ? meetupListData : listData;

  // Handlers
  const handleMatchPress = useCallback((match: Match) => {
    Haptics.selectionAsync();
    setViewingMatch(match);
  }, []);

  const handleChallengePress = useCallback((challenge: Challenge) => {
    Haptics.selectionAsync();
    setEditingChallenge(challenge);
    setIsEditingChallengeFields(false);
    setEditNotes(challenge.notes || '');
    setEditDuration(challenge.duration ? String(challenge.duration) : '');
    setEditSuccessCount(challenge.successCount !== undefined ? String(challenge.successCount) : '');
    setEditCarreauCount(challenge.carreauCount !== undefined ? String(challenge.carreauCount) : '');
    setEditTotalPoints(challenge.totalPoints !== undefined ? String(challenge.totalPoints) : '');
  }, []);

  const handleDeleteChallenge = useCallback(() => {
    if (!editingChallenge) return;
    Alert.alert(
      t('common', 'delete'),
      t('historyExtra', 'deleteChallenge'),
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteChallenge(editingChallenge.id);
            setEditingChallenge(null);
          },
        },
      ]
    );
  }, [editingChallenge, deleteChallenge, t, language]);

  const buildChallengeUpdates = useCallback((): Partial<Challenge> => {
    if (!editingChallenge) return {};
    const updates: Partial<Challenge> = {
      notes: editNotes.trim() || undefined,
    };
    const parsedDuration = parseInt(editDuration, 10);
    if (!isNaN(parsedDuration) && parsedDuration >= 0) {
      updates.duration = parsedDuration;
    }
    if (editingChallenge.type !== 'precision') {
      const sc = parseInt(editSuccessCount, 10);
      const cc = parseInt(editCarreauCount, 10);
      const totalShots = editingChallenge.totalShots || 10;
      if (!isNaN(sc) && sc >= 0 && sc <= totalShots) {
        updates.successCount = sc;
        updates.successRate = Math.round((sc / totalShots) * 1000) / 10;
      }
      if (!isNaN(cc) && cc >= 0) {
        updates.carreauCount = cc;
      }
    } else {
      const tp = parseInt(editTotalPoints, 10);
      if (!isNaN(tp) && tp >= 0) {
        updates.totalPoints = tp;
      }
    }
    return updates;
  }, [editingChallenge, editNotes, editDuration, editSuccessCount, editCarreauCount, editTotalPoints]);

  const performChallengeSave = useCallback(async (updates: Partial<Challenge>) => {
    if (!editingChallenge) return;

    // Log modification if this is a shared item
    if (isSharedItem(editingChallenge.id) && getSharedPermission(editingChallenge.id) === 'write') {
      const changes: { field: string; oldValue?: any; newValue?: any }[] = [];
      if (updates.successCount !== undefined && updates.successCount !== editingChallenge.successCount) changes.push({ field: 'successCount', oldValue: editingChallenge.successCount, newValue: updates.successCount });
      if (updates.successRate !== undefined && updates.successRate !== editingChallenge.successRate) changes.push({ field: 'successRate', oldValue: `${editingChallenge.successRate}%`, newValue: `${updates.successRate}%` });
      if (updates.carreauCount !== undefined && updates.carreauCount !== editingChallenge.carreauCount) changes.push({ field: 'carreauCount', oldValue: editingChallenge.carreauCount, newValue: updates.carreauCount });
      if (updates.totalPoints !== undefined && updates.totalPoints !== editingChallenge.totalPoints) changes.push({ field: 'totalPoints', oldValue: editingChallenge.totalPoints, newValue: updates.totalPoints });
      if (updates.duration !== undefined && updates.duration !== editingChallenge.duration) changes.push({ field: 'duration', oldValue: editingChallenge.duration, newValue: updates.duration });
      if (updates.notes !== undefined && updates.notes !== (editingChallenge.notes || undefined)) changes.push({ field: 'notes', oldValue: editingChallenge.notes || '', newValue: updates.notes || '' });
      if (changes.length > 0) {
        try {
          const sb = getSupabaseClient();
          const { data: row } = await sb.from('challenges').select('user_id').eq('id', editingChallenge.id).single();
          if (row?.user_id) {
            await logModification({ itemType: 'challenge', itemId: editingChallenge.id, ownerId: row.user_id, changes });
          }
        } catch { /* silent */ }
      }
    }

    await updateChallenge(editingChallenge.id, updates);
    setEditingChallenge(prev => prev ? { ...prev, ...updates } : null);
    setIsEditingChallengeFields(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [editingChallenge, updateChallenge, isSharedItem, getSharedPermission]);

  const handleSaveChallenge = useCallback(async () => {
    if (!editingChallenge) return;
    setSavingChallenge(true);
    try {
      const updates = buildChallengeUpdates();

      // Check for collaborative conflicts on shared writable challenges
      if (isSharedItem(editingChallenge.id) && getSharedPermission(editingChallenge.id) === 'write' && challengeServerUpdatedAt) {
        try {
          const conflict = await checkEditConflict('challenges', editingChallenge.id, challengeServerUpdatedAt);
          if (conflict.hasConflict && conflict.serverRecord) {
            const diffs = computeChallengeDiffs(updates as Record<string, any>, conflict.serverRecord, language);
            if (diffs.length > 0) {
              setChallengeConflictDiffs(diffs);
              setPendingChallengeSave(updates);
              setShowChallengeConflict(true);
              setSavingChallenge(false);
              return;
            }
          }
        } catch (e) {
          console.log('Challenge conflict check error, saving anyway:', e);
        }
      }

      await performChallengeSave(updates);
    } catch (e) {
      console.log('Error saving challenge:', e);
    } finally {
      setSavingChallenge(false);
    }
  }, [editingChallenge, buildChallengeUpdates, performChallengeSave, isSharedItem, getSharedPermission, challengeServerUpdatedAt, language]);

  const handleChallengeConflictKeepMine = useCallback(async () => {
    setShowChallengeConflict(false);
    if (pendingChallengeSave) {
      setSavingChallenge(true);
      try {
        await performChallengeSave(pendingChallengeSave);
      } finally {
        setSavingChallenge(false);
        setPendingChallengeSave(null);
      }
    }
  }, [pendingChallengeSave, performChallengeSave]);

  const handleChallengeConflictKeepTheirs = useCallback(async () => {
    setShowChallengeConflict(false);
    setPendingChallengeSave(null);
    // Reload data and close editing
    await refreshData();
    setEditingChallenge(null);
    setIsEditingChallengeFields(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [refreshData]);

  const handleChallengeConflictCancel = useCallback(() => {
    setShowChallengeConflict(false);
    setPendingChallengeSave(null);
    setChallengeConflictDiffs([]);
  }, []);

  const handleToggleChallengeShot = useCallback(async (shotIndex: number) => {
    if (!editingChallenge || !editingChallenge.shots) return;
    const updatedShots = editingChallenge.shots.map((s, i) => {
      if (i !== shotIndex) return s;
      return { ...s, success: !s.success, carreau: !s.success ? s.carreau : false };
    });
    const successCount = updatedShots.filter(s => s.success).length;
    const carreauCount = updatedShots.filter(s => s.carreau).length;
    const totalShots = updatedShots.length;
    const successRate = Math.round((successCount / totalShots) * 1000) / 10;
    const updates: Partial<Challenge> = { shots: updatedShots, successCount, carreauCount, successRate };
    await updateChallenge(editingChallenge.id, updates);
    setEditingChallenge(prev => prev ? { ...prev, ...updates } : null);
    setEditSuccessCount(String(successCount));
    setEditCarreauCount(String(carreauCount));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [editingChallenge, updateChallenge]);

  const handleToggleChallengeCarreau = useCallback(async (shotIndex: number) => {
    if (!editingChallenge || !editingChallenge.shots) return;
    const shot = editingChallenge.shots[shotIndex];
    if (!shot.success) return; // Only successful shots can be carreaux
    const updatedShots = editingChallenge.shots.map((s, i) => {
      if (i !== shotIndex) return s;
      return { ...s, carreau: !s.carreau };
    });
    const carreauCount = updatedShots.filter(s => s.carreau).length;
    const updates: Partial<Challenge> = { shots: updatedShots, carreauCount };
    await updateChallenge(editingChallenge.id, updates);
    setEditingChallenge(prev => prev ? { ...prev, ...updates } : null);
    setEditCarreauCount(String(carreauCount));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [editingChallenge, updateChallenge]);

  const handleFilterPress = useCallback((filter: ContentFilter) => {
    Haptics.selectionAsync();
    setContentFilter(filter);
    if (filter !== 'training') {
      setTrainingSubFilter('all');
    }
    if (filter !== 'meetups') {
      setMeetupStatusFilter('all');
      setMeetupRoleFilter('all');
      setMeetupTerrainFilter('all');
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

    if (item.type === 'ad') {
      return <AdBanner position="inline" />;
    }

    if (item.type === 'meetup') {
      return (
        <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 20, 100))}>
          <MeetupCard
            meetup={item.data as Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number }}
            onPress={() => {
              Haptics.selectionAsync();
              router.push(`/meetup/${(item.data as Meetup).id}` as any);
            }}
            t={t}
            language={language}
          />
        </Animated.View>
      );
    }
    
    if (item.type === 'series') {
      return (
        <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 20, 100))}>
          <SeriesCard series={item.data as SeriesGroup} onMatchPress={handleMatchPress} t={t} language={language} />
        </Animated.View>
      );
    }
    
    if (item.type === 'match') {
      const matchData = item.data as Match;
      const matchIsShared = isSharedItem(matchData.id);
      const matchPerm = getSharedPermission(matchData.id);
      return (
        <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 20, 100))}>
          <MatchCard match={matchData} onPress={() => handleMatchPress(matchData)} t={t} language={language} isShared={matchIsShared} sharedPermission={matchPerm} />
        </Animated.View>
      );
    }
    
    const challengeData = item.data as Challenge;
    const challIsShared = isSharedItem(challengeData.id);
    const challPerm = getSharedPermission(challengeData.id);
    return (
      <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 20, 100))}>
        <ChallengeCard challenge={challengeData} onPress={() => handleChallengePress(challengeData)} t={t} language={language} isShared={challIsShared} sharedPermission={challPerm} />
      </Animated.View>
    );
  }, [handleMatchPress, handleChallengePress, t]);

  const keyExtractor = useCallback((item: HistoryItem) => {
    if (item.type === 'header') return `header-${item.title}`;
    if (item.type === 'ad') return `ad-${(item as any).adIndex}`;
    if (item.type === 'series') return `series-${(item.data as SeriesGroup).seriesId}`;
    if (item.type === 'match') return `match-${(item.data as Match).id}`;
    if (item.type === 'meetup') return `meetup-${(item.data as Meetup).id}`;
    return `challenge-${(item.data as Challenge).id}`;
  }, []);

  const selectedPeriodLabel = t('history', PERIOD_KEYS[selectedPeriod]);

  // List header with challenge stats
  const ListHeader = useCallback(() => {
    if (contentFilter === 'challenges' && filteredChallenges.length > 0) {
      return <ChallengeStatsSummary challenges={filteredChallenges} t={t} />;
    }
    if (contentFilter === 'training' && trainingSubFilter === 'challenges' && filteredChallenges.length > 0) {
      return <ChallengeStatsSummary challenges={filteredChallenges} t={t} />;
    }
    return null;
  }, [contentFilter, trainingSubFilter, filteredChallenges, t]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('history', 'history')}</Text>
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
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
          {CONTENT_FILTERS.map((filter) => {
            const isActive = contentFilter === filter.id;
            const count = filter.id === 'all' ? stats.total
              : filter.id === 'training' ? stats.trainingCount
              : filter.id === 'tournament' ? stats.tournamentCount
              : filter.id === 'shared' ? stats.sharedCount
              : stats.meetupCount;

            return (
              <Pressable
                key={filter.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => handleFilterPress(filter.id)}
              >
                <MaterialIcons name={filter.icon} size={14} color={isActive ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{t('history', filter.labelKey)}</Text>
                <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Training Sub-Filters */}
      {contentFilter === 'training' && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.subFiltersRow}>
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
                <Text style={[styles.subFilterChipText, isActive && styles.subFilterChipTextActive]}>{t('history', filter.labelKey)}</Text>
                <Text style={[styles.subFilterCount, isActive && styles.subFilterCountActive]}>{count}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
      )}

      {/* Meetup Sub-Filters */}
      {contentFilter === 'meetups' && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.meetupSubFiltersContainer}>
          {/* Status row */}
          <View style={styles.meetupSubFilterRow}>
            <Text style={styles.meetupSubFilterLabel}>{t('history', 'meetupFilterStatus')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.meetupSubFilterChips}>
              {([{ id: 'all', labelKey: 'all', icon: 'layers' as const, count: meetupSubStats.all }, { id: 'active', labelKey: 'meetupActive', icon: 'event-available' as const, count: meetupSubStats.activeCount }, { id: 'past', labelKey: 'meetupPast', icon: 'history' as const, count: meetupSubStats.pastCount }] as const).map((f) => {
                const isActive = meetupStatusFilter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    style={[styles.subFilterChip, isActive && styles.meetupSubFilterChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setMeetupStatusFilter(f.id); }}
                  >
                    <MaterialIcons name={f.icon} size={12} color={isActive ? theme.accent : theme.textMuted} />
                    <Text style={[styles.subFilterChipText, isActive && styles.meetupSubFilterChipTextActive]}>{t('history', f.labelKey)}</Text>
                    <Text style={[styles.subFilterCount, isActive && styles.meetupSubFilterCountActive]}>{f.count}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          {/* Role row */}
          <View style={styles.meetupSubFilterRow}>
            <Text style={styles.meetupSubFilterLabel}>{t('history', 'meetupFilterRole')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.meetupSubFilterChips}>
              {([{ id: 'all', labelKey: 'all', icon: 'layers' as const, count: meetupSubStats.all }, { id: 'creator', labelKey: 'meetupCreator', icon: 'person' as const, count: meetupSubStats.creatorCount }, { id: 'invited', labelKey: 'meetupInvited', icon: 'mail' as const, count: meetupSubStats.invitedCount }] as const).map((f) => {
                const isActive = meetupRoleFilter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    style={[styles.subFilterChip, isActive && styles.meetupSubFilterChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setMeetupRoleFilter(f.id); }}
                  >
                    <MaterialIcons name={f.icon} size={12} color={isActive ? theme.accent : theme.textMuted} />
                    <Text style={[styles.subFilterChipText, isActive && styles.meetupSubFilterChipTextActive]}>{t('history', f.labelKey)}</Text>
                    <Text style={[styles.subFilterCount, isActive && styles.meetupSubFilterCountActive]}>{f.count}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          {/* Terrain row */}
          {meetupSubStats.terrains.length > 0 && (
            <View style={styles.meetupSubFilterRow}>
              <Text style={styles.meetupSubFilterLabel}>{t('history', 'meetupFilterTerrain')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.meetupSubFilterChips}>
                <Pressable
                  style={[styles.subFilterChip, meetupTerrainFilter === 'all' && styles.meetupSubFilterChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setMeetupTerrainFilter('all'); }}
                >
                  <MaterialIcons name="place" size={12} color={meetupTerrainFilter === 'all' ? theme.accent : theme.textMuted} />
                  <Text style={[styles.subFilterChipText, meetupTerrainFilter === 'all' && styles.meetupSubFilterChipTextActive]}>{t('history', 'all')}</Text>
                </Pressable>
                {meetupSubStats.terrains.map((terrain) => {
                  const isActive = meetupTerrainFilter === terrain;
                  return (
                    <Pressable
                      key={terrain}
                      style={[styles.subFilterChip, isActive && styles.meetupSubFilterChipActive]}
                      onPress={() => { Haptics.selectionAsync(); setMeetupTerrainFilter(terrain); }}
                    >
                      <MaterialIcons name="place" size={12} color={isActive ? theme.accent : theme.textMuted} />
                      <Text style={[styles.subFilterChipText, isActive && styles.meetupSubFilterChipTextActive]} numberOfLines={1}>{terrain}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </Animated.View>
      )}

      {/* List */}
      <FlatList
        data={finalListData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }, isTablet && styles.listContentTablet]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons name="search-off" size={40} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{t('history', 'noResults')}</Text>
            <Text style={styles.emptyText}>{t('history', 'noActivity')}</Text>
            <Pressable 
              style={styles.resetBtn}
              onPress={() => {
                Haptics.selectionAsync();
                setContentFilter('all');
                setSelectedPeriod('all');
              }}
            >
              <MaterialIcons name="refresh" size={16} color="#FFF" />
              <Text style={styles.resetBtnText}>{t('history', 'resetFilters')}</Text>
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
            <Text style={styles.modalTitle}>{t('history', 'period')}</Text>
            <Pressable style={styles.modalClose} onPress={() => setShowPeriodModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.modalContent}>
            {PERIOD_IDS.map((id) => (
              <Pressable
                key={id}
                style={[styles.periodOption, selectedPeriod === id && styles.periodOptionActive]}
                onPress={() => handlePeriodPress(id)}
              >
                <Text style={[styles.periodOptionText, selectedPeriod === id && styles.periodOptionTextActive]}>
                  {t('history', PERIOD_KEYS[id])}
                </Text>
                {selectedPeriod === id && (
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
        onRequestClose={() => { setEditingChallenge(null); setIsEditingChallengeFields(false); }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            {isEditingChallengeFields ? (
              <Pressable style={styles.modalClose} onPress={() => setIsEditingChallengeFields(false)}>
                <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
              </Pressable>
            ) : (
              <View style={{ width: 36 }} />
            )}
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.modalTitle}>{t('history', 'challengeDetails')}</Text>
              {editingChallenge && isSharedItem(editingChallenge.id) ? (
                <View style={{ marginTop: 2 }}>
                  <SharedBadge permission={getSharedPermission(editingChallenge.id) || 'read'} size="small" />
                </View>
              ) : null}
            </View>
            {isEditingChallengeFields ? (
              editingChallenge && isSharedItem(editingChallenge.id) && getSharedPermission(editingChallenge.id) === 'read' ? (
                <View style={{ width: 36 }} />
              ) : (
                <Pressable
                  style={styles.cdSaveHeaderBtn}
                  onPress={handleSaveChallenge}
                  disabled={savingChallenge}
                >
                  <Text style={styles.cdSaveHeaderBtnText}>{savingChallenge ? '...' : t('common', 'save')}</Text>
                </Pressable>
              )
            ) : (
              <Pressable style={styles.modalClose} onPress={() => { setEditingChallenge(null); setIsEditingChallengeFields(false); }}>
                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
              </Pressable>
            )}
          </View>

          {/* Shared challenge banner */}
          {editingChallenge && isSharedItem(editingChallenge.id) ? (
            <View style={styles.sharedChallBanner}>
              <View style={styles.sharedChallBannerIcon}>
                <MaterialIcons name="group" size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sharedChallBannerTitle}>
                  {language === 'fr' ? 'Defi partage' : 'Shared challenge'}
                </Text>
                <Text style={styles.sharedChallBannerSub}>
                  {(() => {
                    const senderReq = challengeShareRequests.find(r => r.recipientUserId === user?.id);
                    if (senderReq?.senderName) {
                      return (language === 'fr' ? `Partage par ${senderReq.senderName}` : `Shared by ${senderReq.senderName}`);
                    }
                    return (language === 'fr' ? 'Partage avec vous' : 'Shared with you');
                  })()}
                </Text>
              </View>
              <View style={[styles.sharedChallPermBadge, { backgroundColor: (getSharedPermission(editingChallenge.id) === 'write' ? theme.accent : theme.primary) + '15' }]}>
                <MaterialIcons name={getSharedPermission(editingChallenge.id) === 'write' ? 'edit' : 'visibility'} size={12} color={getSharedPermission(editingChallenge.id) === 'write' ? theme.accent : theme.primary} />
                <Text style={[styles.sharedChallPermText, { color: getSharedPermission(editingChallenge.id) === 'write' ? theme.accent : theme.primary }]}>
                  {getSharedPermission(editingChallenge.id) === 'write' ? (language === 'fr' ? 'Modification' : 'Edit') : (language === 'fr' ? 'Lecture' : 'Read only')}
                </Text>
              </View>
            </View>
          ) : null}
          
          {editingChallenge && (() => {
            const scrollContent = (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={true}>
              {/* Challenge Header Card */}
              <View style={styles.detailHeaderCard}>
                <View style={styles.detailHeaderTop}>
                  <View style={[styles.detailIcon, { backgroundColor: CHALLENGE_CONFIG[editingChallenge.type].color + '18' }]}>
                    <MaterialIcons 
                      name={CHALLENGE_CONFIG[editingChallenge.type].icon} 
                      size={30} 
                      color={CHALLENGE_CONFIG[editingChallenge.type].color} 
                    />
                  </View>
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailName}>{t('challenge', CHALLENGE_CONFIG[editingChallenge.type].nameKey)}</Text>
                    <Text style={styles.detailDate}>
                      {new Date(editingChallenge.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                        weekday: 'long', day: 'numeric', month: 'long'
                      })}
                    </Text>
                    <Text style={styles.detailTime}>
                      {new Date(editingChallenge.date).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                  </View>

                </View>
                {/* Sponsor banner in detail */}
                {editingChallenge.sponsorId ? (
                  <Pressable
                    style={styles.detailSponsorBanner}
                    onPress={() => { setEditingChallenge(null); router.push('/partners'); }}
                  >
                    <View style={styles.detailSponsorBannerInner}>
                      {editingChallenge.sponsorPhoto ? (
                        <Image source={{ uri: editingChallenge.sponsorPhoto }} style={styles.detailSponsorPhoto} contentFit="cover" transition={200} />
                      ) : (
                        <View style={[styles.detailSponsorPhoto, { backgroundColor: '#F59E0B15', alignItems: 'center', justifyContent: 'center' }]}>
                          <MaterialIcons name="campaign" size={18} color="#F59E0B" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailSponsorLabel}>{t('challenge', 'sponsoredBy')}</Text>
                        <Text style={styles.detailSponsorName}>{editingChallenge.sponsorName}</Text>
                      </View>
                      <View style={styles.detailSponsorBadge}>
                        <MaterialIcons name="verified" size={12} color="#FFF" />
                        <Text style={styles.detailSponsorBadgeText}>{t('challenge', 'sponsoredBadge')}</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={18} color="#92400E" />
                    </View>
                  </Pressable>
                ) : null}

                {/* Mode badges */}
                <View style={styles.detailHeaderBadges}>
                  {editingChallenge.mode === '1v1' ? (
                    <View style={[styles.detailModeBadge, { backgroundColor: theme.accent + '15' }]}>
                      <MaterialIcons name="people" size={13} color={theme.accent} />
                      <Text style={[styles.detailModeBadgeText, { color: theme.accent }]}>1 vs 1</Text>
                    </View>
                  ) : (
                    <View style={[styles.detailModeBadge, { backgroundColor: theme.primary + '15' }]}>
                      <MaterialIcons name="person" size={13} color={theme.primary} />
                      <Text style={[styles.detailModeBadgeText, { color: theme.primary }]}>Solo</Text>
                    </View>
                  )}
                  {editingChallenge.playerName ? (
                    <View style={[styles.detailModeBadge, { backgroundColor: theme.backgroundSecondary }]}>
                      <MaterialIcons name="sports" size={13} color={theme.textSecondary} />
                      <Text style={[styles.detailModeBadgeText, { color: theme.textSecondary }]} numberOfLines={1}>{editingChallenge.playerName}</Text>
                    </View>
                  ) : null}
                  {(() => {
                    const bs = editingChallenge.boulesSetId ? boulesSets.find(b => b.id === editingChallenge.boulesSetId) : null;
                    if (!bs) return null;
                    return (
                      <View style={[styles.detailModeBadge, { backgroundColor: '#D97706' + '15' }]}>
                        <MaterialIcons name="sports-baseball" size={13} color={'#D97706'} />
                        <Text style={[styles.detailModeBadgeText, { color: '#D97706' }]} numberOfLines={1}>
                          {bs.name}{bs.diameter ? ` \u2022 ${bs.diameter}mm` : ''}{bs.weight ? ` \u2022 ${bs.weight}g` : ''}
                        </Text>
                      </View>
                    );
                  })()}
                  {(() => {
                    if (!editingChallenge.terrainId) return null;
                    const terrain = terrains.find(tr => tr.id === editingChallenge.terrainId);
                    if (!terrain) return null;
                    return (
                      <View style={[styles.detailModeBadge, { backgroundColor: theme.success + '15' }]}>
                        <MaterialIcons name="place" size={13} color={theme.success} />
                        <Text style={[styles.detailModeBadgeText, { color: theme.success }]} numberOfLines={1}>
                          {terrain.name}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Score Card */}
              <View style={[styles.detailScoreCard, { borderLeftWidth: 4, borderLeftColor: CHALLENGE_CONFIG[editingChallenge.type].color }]}>
                <View style={styles.detailScoreHeader}>
                  <MaterialIcons name="emoji-events" size={16} color={CHALLENGE_CONFIG[editingChallenge.type].color} />
                  <Text style={[styles.detailScoreLabel, { color: CHALLENGE_CONFIG[editingChallenge.type].color }]}>SCORE</Text>
                </View>
                {isEditingChallengeFields ? (
                  editingChallenge.type === 'precision' ? (
                    <View style={styles.cdEditFieldRow}>
                      <TextInput
                        style={[styles.cdEditFieldInput, styles.cdEditFieldLarge]}
                        value={editTotalPoints}
                        onChangeText={setEditTotalPoints}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                      />
                      <Text style={styles.cdEditFieldUnit}> / {editingChallenge.maxPoints || 100} pts</Text>
                    </View>
                  ) : (
                    <View style={styles.cdEditFieldRow}>
                      <TextInput
                        style={[styles.cdEditFieldInput, styles.cdEditFieldLarge]}
                        value={editSuccessCount}
                        onChangeText={setEditSuccessCount}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                      />
                      <Text style={styles.cdEditFieldUnit}> / {editingChallenge.totalShots || 10} {t('history', 'successfulShots')}</Text>
                    </View>
                  )
                ) : (
                  <>
                    <Text style={[styles.detailScoreValue, { color: CHALLENGE_CONFIG[editingChallenge.type].color }]}>
                      {editingChallenge.type === 'precision' 
                        ? `${editingChallenge.totalPoints || 0}/${editingChallenge.maxPoints || 100}`
                        : `${editingChallenge.successRate || 0}%`
                      }
                    </Text>
                    {editingChallenge.type !== 'precision' ? (
                      <Text style={styles.detailScoreSub}>
                        {editingChallenge.successCount || 0}/{editingChallenge.totalShots || 0} {t('history', 'successfulShots')}
                      </Text>
                    ) : null}
                    {/* Progress ring visual */}
                    {(() => {
                      const pct = editingChallenge.type === 'precision'
                        ? ((editingChallenge.totalPoints || 0) / Math.max(1, editingChallenge.maxPoints || 100)) * 100
                        : editingChallenge.successRate || 0;
                      return (
                        <View style={styles.detailScoreBar}>
                          <View style={styles.detailScoreBarTrack}>
                            <View style={[styles.detailScoreBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: CHALLENGE_CONFIG[editingChallenge.type].color }]} />
                          </View>
                        </View>
                      );
                    })()}
                  </>
                )}
              </View>

              {/* Stats Cards */}
              <View style={styles.detailStatsRow}>
                {editingChallenge.type !== 'precision' ? (
                  <View style={styles.detailStatCard}>
                    <View style={[styles.detailStatIconBg, { backgroundColor: theme.carreauColor + '15' }]}>
                      <MaterialIcons name="stars" size={20} color={theme.carreauColor} />
                    </View>
                    {isEditingChallengeFields ? (
                      <TextInput
                        style={[styles.cdEditFieldInput, { marginTop: 6, textAlign: 'center', minWidth: 48 }]}
                        value={editCarreauCount}
                        onChangeText={setEditCarreauCount}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={theme.textMuted}
                      />
                    ) : (
                      <Text style={[styles.detailStatValue, { color: theme.carreauColor }]}>{editingChallenge.carreauCount || 0}</Text>
                    )}
                    <Text style={styles.detailStatLabel}>{t('history', 'carreaux')}</Text>
                  </View>
                ) : null}
                <View style={styles.detailStatCard}>
                  <View style={[styles.detailStatIconBg, { backgroundColor: theme.primary + '15' }]}>
                    <MaterialIcons name="timer" size={20} color={theme.primary} />
                  </View>
                  {isEditingChallengeFields ? (
                    <TextInput
                      style={[styles.cdEditFieldInput, { marginTop: 6, textAlign: 'center', minWidth: 48 }]}
                      value={editDuration}
                      onChangeText={setEditDuration}
                      keyboardType="number-pad"
                      placeholder="sec"
                      placeholderTextColor={theme.textMuted}
                    />
                  ) : (
                    <Text style={[styles.detailStatValue, { color: theme.primary }]}>
                      {editingChallenge.duration ? `${Math.floor(editingChallenge.duration / 60)}:${(editingChallenge.duration % 60).toString().padStart(2, '0')}` : '--'}
                    </Text>
                  )}
                  <Text style={styles.detailStatLabel}>{t('history', 'duration')}{isEditingChallengeFields ? ' (sec)' : ''}</Text>
                </View>
                {editingChallenge.type !== 'precision' && !isEditingChallengeFields ? (
                  <View style={styles.detailStatCard}>
                    <View style={[styles.detailStatIconBg, { backgroundColor: theme.success + '15' }]}>
                      <MaterialIcons name="check-circle" size={20} color={theme.success} />
                    </View>
                    <Text style={[styles.detailStatValue, { color: theme.success }]}>{editingChallenge.successCount || 0}/{editingChallenge.totalShots || 0}</Text>
                    <Text style={styles.detailStatLabel}>{t('history', 'success')}</Text>
                  </View>
                ) : null}
              </View>

              {/* 1v1 Result + Radar Chart */}
              {editingChallenge.mode === '1v1' && editingChallenge.opponentResult ? (
                <View style={styles.detailOpponent}>
                  {/* 1v1 Score Comparison */}
                  <View style={styles.detail1v1Header}>
                    <MaterialIcons name="people" size={16} color={theme.accent} />
                    <Text style={styles.detail1v1Title}>{t('historyExtra', 'confrontation')}</Text>
                  </View>
                  <View style={styles.detail1v1ScoreRow}>
                    <View style={styles.detail1v1Player}>
                      <Text style={styles.detail1v1PlayerName} numberOfLines={1}>{editingChallenge.playerName || 'Moi'}</Text>
                      <Text style={[styles.detail1v1PlayerScore, { color: editingChallenge.winner === 'player' ? theme.success : theme.textPrimary }]}>
                        {editingChallenge.type === 'precision'
                          ? `${editingChallenge.totalPoints || 0} pts`
                          : `${editingChallenge.successRate || 0}%`
                        }
                      </Text>
                    </View>
                    <View style={styles.detail1v1Vs}>
                      {editingChallenge.winner ? (
                        <View style={[
                          styles.detail1v1WinnerBadge,
                          { backgroundColor: editingChallenge.winner === 'player' ? theme.success : editingChallenge.winner === 'opponent' ? theme.error : theme.warning }
                        ]}>
                          <MaterialIcons 
                            name={editingChallenge.winner === 'draw' ? 'handshake' : editingChallenge.winner === 'player' ? 'emoji-events' : 'sentiment-dissatisfied'} 
                            size={16} 
                            color="#FFF" 
                          />
                        </View>
                      ) : (
                        <Text style={styles.detail1v1VsText}>VS</Text>
                      )}
                    </View>
                    <View style={[styles.detail1v1Player, { alignItems: 'flex-end' }]}>
                      <Text style={styles.detail1v1PlayerName} numberOfLines={1}>{editingChallenge.opponentName}</Text>
                      <Text style={[styles.detail1v1PlayerScore, { color: editingChallenge.winner === 'opponent' ? theme.error : theme.textPrimary }]}>
                        {editingChallenge.type === 'precision'
                          ? `${editingChallenge.opponentResult.totalPoints || 0} pts`
                          : `${editingChallenge.opponentResult.successRate || 0}%`
                        }
                      </Text>
                    </View>
                  </View>
                  {editingChallenge.winner ? (
                    <Text style={[styles.detail1v1ResultLabel, { color: editingChallenge.winner === 'player' ? theme.success : editingChallenge.winner === 'opponent' ? theme.error : theme.warning }]}>
                      {editingChallenge.winner === 'draw' ? t('history', 'draw') : editingChallenge.winner === 'player' ? `${t('history', 'victory')} !` : t('history', 'defeat')}
                    </Text>
                  ) : null}

                  {/* Radar Chart Comparison */}
                  {(() => {
                    const radarSize = 200;
                    const cx = radarSize / 2;
                    const cy = radarSize / 2;
                    const maxR = radarSize / 2 - 30;
                    const isPrecision = editingChallenge.type === 'precision';
                    const playerSuccessRate = isPrecision
                      ? ((editingChallenge.totalPoints || 0) / Math.max(1, editingChallenge.maxPoints || 100)) * 100
                      : editingChallenge.successRate || 0;
                    const playerCarreauRate = editingChallenge.type !== 'precision' && (editingChallenge.totalShots || 0) > 0
                      ? ((editingChallenge.carreauCount || 0) / (editingChallenge.totalShots || 10)) * 100
                      : isPrecision ? ((editingChallenge.precisionShots?.filter(s => s.points === 5).length || 0) / Math.max(1, editingChallenge.precisionShots?.length || 1)) * 100 : 0;
                    const playerConsistency = editingChallenge.shots
                      ? (editingChallenge.shots.filter(s => s.success).length / Math.max(1, editingChallenge.shots.length)) * 100
                      : playerSuccessRate;
                    const oppResult = editingChallenge.opponentResult!;
                    const oppSuccessRate = isPrecision
                      ? ((oppResult.totalPoints || 0) / Math.max(1, editingChallenge.maxPoints || 100)) * 100
                      : oppResult.successRate || 0;
                    const oppCarreauRate = editingChallenge.type !== 'precision' && (oppResult.totalShots || 0) > 0
                      ? ((oppResult.carreauCount || 0) / Math.max(1, oppResult.totalShots || 10)) * 100
                      : isPrecision ? ((oppResult.precisionShots?.filter(s => s.points === 5).length || 0) / Math.max(1, oppResult.precisionShots?.length || 1)) * 100 : 0;
                    const oppConsistency = oppResult.shots
                      ? (oppResult.shots.filter(s => s.success).length / Math.max(1, oppResult.shots.length)) * 100
                      : oppSuccessRate;
                    const labels = [t('history', 'radarSuccessRate'), t('history', 'radarCarreaux'), t('history', 'radarConsistency')];
                    const playerValues = [playerSuccessRate, playerCarreauRate, playerConsistency];
                    const oppValues = [oppSuccessRate, oppCarreauRate, oppConsistency];
                    const numAxes = labels.length;
                    const angleStep = (2 * Math.PI) / numAxes;
                    const getPoint = (value: number, index: number) => {
                      const angle = index * angleStep - Math.PI / 2;
                      const r = (Math.min(value, 100) / 100) * maxR;
                      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
                    };
                    const playerPoints = playerValues.map((v, i) => getPoint(v, i));
                    const oppPoints = oppValues.map((v, i) => getPoint(v, i));
                    const playerPolygon = playerPoints.map(p => `${p.x},${p.y}`).join(' ');
                    const oppPolygon = oppPoints.map(p => `${p.x},${p.y}`).join(' ');
                    return (
                      <View style={styles.radarContainer}>
                        <Text style={styles.radarTitle}>{t('history', 'radarComparison')}</Text>
                        <Svg width={radarSize} height={radarSize}>
                          {[0.25, 0.5, 0.75, 1].map((level, i) => (
                            <Circle key={i} cx={cx} cy={cy} r={maxR * level} fill="none" stroke={theme.border} strokeWidth="0.8" strokeDasharray={i < 3 ? '3,3' : undefined} />
                          ))}
                          {labels.map((label, i) => {
                            const angle = i * angleStep - Math.PI / 2;
                            const endX = cx + maxR * Math.cos(angle);
                            const endY = cy + maxR * Math.sin(angle);
                            const labelX = cx + (maxR + 18) * Math.cos(angle);
                            const labelY = cy + (maxR + 18) * Math.sin(angle);
                            return (
                              <G key={i}>
                                <Line x1={cx} y1={cy} x2={endX} y2={endY} stroke={theme.border} strokeWidth="0.8" />
                                <SvgText x={labelX} y={labelY + 4} fontSize="9" fill={theme.textSecondary} textAnchor="middle" fontWeight="600">{label}</SvgText>
                              </G>
                            );
                          })}
                          <Polygon points={oppPolygon} fill={theme.error + '20'} stroke={theme.error} strokeWidth="2" />
                          <Polygon points={playerPolygon} fill={theme.success + '20'} stroke={theme.success} strokeWidth="2" />
                          {playerPoints.map((p, i) => <Circle key={`p${i}`} cx={p.x} cy={p.y} r={4} fill={theme.success} />)}
                          {oppPoints.map((p, i) => <Circle key={`o${i}`} cx={p.x} cy={p.y} r={4} fill={theme.error} />)}
                        </Svg>
                        <View style={styles.radarLegend}>
                          <View style={styles.radarLegendItem}><View style={[styles.radarLegendDot, { backgroundColor: theme.success }]} /><Text style={styles.radarLegendText}>{editingChallenge.playerName || 'Moi'}</Text></View>
                          <View style={styles.radarLegendItem}><View style={[styles.radarLegendDot, { backgroundColor: theme.error }]} /><Text style={styles.radarLegendText}>{editingChallenge.opponentName}</Text></View>
                        </View>
                        <View style={styles.radarValuesTable}>
                          {labels.map((label, i) => (
                            <View key={i} style={styles.radarValueRow}>
                              <Text style={styles.radarValueLabel}>{label}</Text>
                              <Text style={[styles.radarValueNum, { color: playerValues[i] >= oppValues[i] ? theme.success : theme.textSecondary }]}>{Math.round(playerValues[i])}%</Text>
                              <Text style={styles.radarValueVs}>vs</Text>
                              <Text style={[styles.radarValueNum, { color: oppValues[i] >= playerValues[i] ? theme.error : theme.textSecondary }]}>{Math.round(oppValues[i])}%</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })()}
                </View>
              ) : null}

              {/* Precision Shots Editing */}
              {editingChallenge.type === 'precision' && editingChallenge.precisionShots && editingChallenge.precisionShots.length > 0 ? (
                <View style={styles.detailShotsSection}>
                  <View style={styles.cdShotsTitleRow}>
                    <View style={styles.detailShotsTitleRow}>
                      <MaterialIcons name="gps-fixed" size={16} color={CHALLENGE_CONFIG.precision.color} />
                      <Text style={styles.detailShotsTitle}>{t('history', 'editPrecisionShots')}</Text>
                    </View>
                    {isEditingChallengeFields ? (
                      <Text style={styles.cdShotsEditHint}>
                        {t('historyExtra', 'editWorkshopDistScore')}
                      </Text>
                    ) : null}
                  </View>
                  {/* Atelier scores summary */}
                  {!isEditingChallengeFields && editingChallenge.atelierScores ? (
                    <View style={styles.detailAtelierSummary}>
                      {Object.entries(editingChallenge.atelierScores).map(([atelier, score]) => (
                        <View key={atelier} style={styles.detailAtelierSummaryItem}>
                          <Text style={styles.detailAtelierSummaryLabel} numberOfLines={1}>{t('precisionWorkshops', atelier).split(' ').slice(0, 2).join(' ')}</Text>
                          <Text style={[styles.detailAtelierSummaryValue, { color: CHALLENGE_CONFIG.precision.color }]}>{score as number}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {editingChallenge.precisionShots.map((ps, idx) => {
                    const atelierLabels: Record<string, string> = {
                      boule_seule: t('precisionWorkshops', 'boule_seule'),
                      derriere_but: t('precisionWorkshops', 'derriere_but'),
                      entre_2_boules: t('precisionWorkshops', 'entre_2_boules'),
                      sautee: t('precisionWorkshops', 'sautee'),
                      tir_but: t('precisionWorkshops', 'tir_but'),
                    };
                    const pointColors: Record<number, string> = { 0: theme.error, 1: theme.warning, 3: theme.success, 5: theme.carreauColor };
                    const pointLabels: Record<number, string> = {
                      0: t('precisionWorkshops', 'rate'),
                      1: t('precisionWorkshops', 'touche'),
                      3: t('precisionWorkshops', 'sorti'),
                      5: t('precisionWorkshops', 'carreau'),
                    };
                    return (
                      <View key={idx} style={styles.cdPrecisionShotRow}>
                        <View style={styles.cdPrecisionShotNum}>
                          <Text style={styles.cdPrecisionShotNumText}>{idx + 1}</Text>
                        </View>
                        {isEditingChallengeFields ? (
                          <View style={styles.cdPrecisionShotEditable}>
                            {/* Atelier picker */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cdPrecisionPickerScroll}>
                              {(['boule_seule', 'derriere_but', 'entre_2_boules', 'sautee', 'tir_but'] as const).map(at => (
                                <Pressable
                                  key={at}
                                  style={[styles.cdPrecisionChip, ps.atelier === at && styles.cdPrecisionChipActive]}
                                  onPress={() => {
                                    if (!editingChallenge.precisionShots) return;
                                    const updated = [...editingChallenge.precisionShots];
                                    updated[idx] = { ...updated[idx], atelier: at };
                                    const newAtelierScores: Record<string, number> = {};
                                    updated.forEach(s => {
                                      if (!newAtelierScores[s.atelier]) newAtelierScores[s.atelier] = 0;
                                      newAtelierScores[s.atelier] += s.points;
                                    });
                                    const tp = updated.reduce((sum, s) => sum + s.points, 0);
                                    const updates = { precisionShots: updated, totalPoints: tp, atelierScores: newAtelierScores };
                                    updateChallenge(editingChallenge.id, updates);
                                    setEditingChallenge(prev => prev ? { ...prev, ...updates } : null);
                                    Haptics.selectionAsync();
                                  }}
                                >
                                  <Text style={[styles.cdPrecisionChipText, ps.atelier === at && styles.cdPrecisionChipTextActive]} numberOfLines={1}>
                                    {(atelierLabels[at] || at).split(' ').slice(0, 2).join(' ')}
                                  </Text>
                                </Pressable>
                              ))}
                            </ScrollView>
                            {/* Distance */}
                            <View style={styles.cdPrecisionDistanceRow}>
                              <Text style={styles.cdPrecisionLabel}>{t('history', 'distance')}:</Text>
                              {([6, 7, 8, 9] as const).map(d => (
                                <Pressable
                                  key={d}
                                  style={[styles.cdPrecisionDistChip, ps.distance === d && styles.cdPrecisionDistChipActive]}
                                  onPress={() => {
                                    if (!editingChallenge.precisionShots) return;
                                    const updated = [...editingChallenge.precisionShots];
                                    updated[idx] = { ...updated[idx], distance: d };
                                    const updates = { precisionShots: updated };
                                    updateChallenge(editingChallenge.id, updates);
                                    setEditingChallenge(prev => prev ? { ...prev, ...updates } : null);
                                    Haptics.selectionAsync();
                                  }}
                                >
                                  <Text style={[styles.cdPrecisionDistChipText, ps.distance === d && styles.cdPrecisionDistChipTextActive]}>{d}m</Text>
                                </Pressable>
                              ))}
                            </View>
                            {/* Points */}
                            <View style={styles.cdPrecisionPointsRow}>
                              <Text style={styles.cdPrecisionLabel}>{t('history', 'points')}:</Text>
                              {([0, 1, 3, 5] as const).map(p => (
                                <Pressable
                                  key={p}
                                  style={[styles.cdPrecisionPointChip, { borderColor: pointColors[p] + '40' }, ps.points === p && { backgroundColor: pointColors[p], borderColor: pointColors[p] }]}
                                  onPress={() => {
                                    if (!editingChallenge.precisionShots) return;
                                    const updated = [...editingChallenge.precisionShots];
                                    updated[idx] = { ...updated[idx], points: p };
                                    const tp = updated.reduce((sum, s) => sum + s.points, 0);
                                    const newAtelierScores: Record<string, number> = {};
                                    updated.forEach(s => {
                                      if (!newAtelierScores[s.atelier]) newAtelierScores[s.atelier] = 0;
                                      newAtelierScores[s.atelier] += s.points;
                                    });
                                    const updates = { precisionShots: updated, totalPoints: tp, atelierScores: newAtelierScores };
                                    updateChallenge(editingChallenge.id, updates);
                                    setEditingChallenge(prev => prev ? { ...prev, ...updates } : null);
                                    setEditTotalPoints(String(tp));
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }}
                                >
                                  <Text style={[styles.cdPrecisionPointChipText, ps.points === p && { color: '#FFF' }]}>{p}</Text>
                                  <Text style={[styles.cdPrecisionPointChipLabel, ps.points === p && { color: '#FFF' }]}>{pointLabels[p]}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        ) : (
                          <View style={styles.cdPrecisionShotDisplay}>
                            <View style={styles.cdPrecisionShotInfoRow}>
                              <Text style={styles.cdPrecisionShotAtelier} numberOfLines={1}>{atelierLabels[ps.atelier] || ps.atelier}</Text>
                              <Text style={styles.cdPrecisionShotDist}>{ps.distance}m</Text>
                            </View>
                            <View style={[styles.cdPrecisionShotPointBadge, { backgroundColor: (pointColors[ps.points] || theme.textMuted) + '20' }]}>
                              <Text style={[styles.cdPrecisionShotPointValue, { color: pointColors[ps.points] || theme.textMuted }]}>{ps.points} pts</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Shots Grid - Interactive in edit mode */}
              {editingChallenge.shots && editingChallenge.shots.length > 0 ? (
                <View style={styles.detailShotsSection}>
                  <View style={styles.cdShotsTitleRow}>
                    <View style={styles.detailShotsTitleRow}>
                      <MaterialIcons name="gps-fixed" size={16} color={CHALLENGE_CONFIG[editingChallenge.type].color} />
                      <Text style={styles.detailShotsTitle}>{t('history', 'shotDetail')}</Text>
                    </View>
                    {isEditingChallengeFields ? (
                      <Text style={styles.cdShotsEditHint}>
                        {t('historyExtra', 'tapToggleLongCarreau')}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.detailShotsGrid}>
                    {editingChallenge.shots.map((shot, idx) => (
                      <Pressable
                        key={idx}
                        style={[
                          styles.shotDot,
                          { backgroundColor: shot.carreau ? theme.carreauColor : shot.success ? theme.success : theme.error },
                          isEditingChallengeFields && styles.cdShotDotEditable,
                        ]}
                        onPress={isEditingChallengeFields ? () => handleToggleChallengeShot(idx) : undefined}
                        onLongPress={isEditingChallengeFields ? () => handleToggleChallengeCarreau(idx) : undefined}
                        disabled={!isEditingChallengeFields}
                      >
                        <Text style={styles.shotDotText}>{idx + 1}</Text>
                        {shot.carreau ? <View style={styles.shotDotCarreauIndicator} /> : null}
                      </Pressable>
                    ))}
                  </View>
                  {/* Always show legend */}
                  <View style={styles.cdShotLegend}>
                    <View style={styles.cdShotLegendItem}>
                      <View style={[styles.cdShotLegendDot, { backgroundColor: theme.success }]} />
                      <Text style={styles.cdShotLegendText}>{t('historyExtra', 'successLabel')}</Text>
                    </View>
                    <View style={styles.cdShotLegendItem}>
                      <View style={[styles.cdShotLegendDot, { backgroundColor: theme.error }]} />
                      <Text style={styles.cdShotLegendText}>{t('historyExtra', 'missLabel')}</Text>
                    </View>
                    <View style={styles.cdShotLegendItem}>
                      <View style={[styles.cdShotLegendDot, { backgroundColor: theme.carreauColor }]} />
                      <Text style={styles.cdShotLegendText}>Carreau</Text>
                    </View>
                  </View>
                  {isEditingChallengeFields ? (
                    <View style={styles.cdShotEditHintRow}>
                      <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
                      <Text style={styles.cdShotsEditHint}>
                        {t('historyExtra', 'tapToggleLongCarreau')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

                {/* Share Status Section (shows shared players for challenges) */}
                {editingChallenge && !isEditingChallengeFields ? (
                  <ShareStatusSection
                    itemType="challenge"
                    itemId={editingChallenge.id}
                    isOwner={!isSharedItem(editingChallenge.id)}
                  />
                ) : null}

                {/* Modification History */}
                {editingChallenge && !isEditingChallengeFields ? (
                  <ModificationLogsSection
                    itemType="challenge"
                    itemId={editingChallenge.id}
                    isOwner={!isSharedItem(editingChallenge.id)}
                    onReverted={async () => {
                      await refreshData();
                      const updated = challenges.find(c => c.id === editingChallenge?.id);
                      if (updated) setEditingChallenge(updated);
                    }}
                  />
                ) : null}

                {/* Notes */}
              <View style={styles.cdNotesSection}>
                <View style={styles.cdNotesTitleRow}>
                  <MaterialIcons name="notes" size={16} color={theme.textSecondary} />
                  <Text style={styles.cdNotesTitle}>Notes</Text>
                </View>
                {isEditingChallengeFields ? (
                  <TextInput
                    style={styles.cdNotesInput}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder={t('historyExtra', 'addNotes')}
                    placeholderTextColor={theme.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                ) : (
                  <Text style={styles.cdNotesText}>
                    {editingChallenge.notes || t('historyExtra', 'noNotes')}
                  </Text>
                )}
              </View>

              {/* Actions */}
              {(() => {
                const challShared = isSharedItem(editingChallenge.id);
                const challPerm = getSharedPermission(editingChallenge.id);
                const isReadOnly = challShared && challPerm === 'read';

                if (isEditingChallengeFields) {
                  if (isReadOnly) {
                    return (
                      <View style={styles.challReadOnlyBanner}>
                        <MaterialIcons name="lock" size={18} color={theme.textMuted} />
                        <Text style={styles.challReadOnlyBannerText}>
                          {language === 'fr' ? 'Lecture seule — vous ne pouvez pas modifier ce defi' : 'Read only — you cannot modify this challenge'}
                        </Text>
                      </View>
                    );
                  }
                  return (
                    <View style={styles.detailActions}>
                      <Pressable
                        style={[styles.closeBtn, { flex: 1 }]}
                        onPress={handleSaveChallenge}
                        disabled={savingChallenge}
                      >
                        <Text style={styles.closeBtnText}>
                          {savingChallenge ? '...' : t('common', 'save')}
                        </Text>
                      </Pressable>
                    </View>
                  );
                }

                return (
                  <>
                    <Pressable
                      style={styles.shareParticipantsBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setShowChallengeShareRequest(true);
                      }}
                    >
                      <MaterialIcons name="group-add" size={18} color={theme.primary} />
                      <Text style={styles.shareParticipantsBtnText}>{language === 'fr' ? 'Partager avec les joueurs' : 'Share with players'}</Text>
                    </Pressable>
                    {isReadOnly ? (
                      <View style={styles.challReadOnlyBanner}>
                        <MaterialIcons name="lock" size={18} color={theme.textMuted} />
                        <Text style={styles.challReadOnlyBannerText}>
                          {language === 'fr' ? 'Lecture seule — vous ne pouvez pas modifier ce defi' : 'Read only — you cannot modify this challenge'}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.detailActions}>
                        <Pressable style={styles.deleteBtn} onPress={handleDeleteChallenge}>
                          <MaterialIcons name="delete" size={18} color={theme.error} />
                          <Text style={styles.deleteBtnText}>{t('common', 'delete')}</Text>
                        </Pressable>
                        <Pressable style={styles.closeBtn} onPress={() => {
                          Haptics.selectionAsync();
                          setIsEditingChallengeFields(true);
                        }}>
                          <MaterialIcons name="edit" size={18} color="#FFF" />
                          <Text style={styles.closeBtnText}>{t('match', 'editMatch')}</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                );
              })()}
            </ScrollView>
            );

            if (isEditingChallengeFields) {
              return (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                  {scrollContent}
                </KeyboardAvoidingView>
              );
            }
            return scrollContent;
          })()}
        </SafeAreaView>
      </Modal>

      {/* Match Detail Modal */}
      <Modal
        visible={!!viewingMatch}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setViewingMatch(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ width: 36 }} />
            <Text style={styles.modalTitle}>{t('history', 'matchDetails')}</Text>
            <Pressable style={styles.modalClose} onPress={() => setViewingMatch(null)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          
          {viewingMatch && (() => {
            const m = viewingMatch;
            const isWin = m.winner === 'A';
            const isTournament = m.mode === 'Tournoi';
            const matchTerrain = m.terrainId ? terrains.find(tr => tr.id === m.terrainId) : null;
            const matchBoules = m.boulesSetId ? boulesSets.find(bs => bs.id === m.boulesSetId) : null;
            const meneTotalA = m.menes?.reduce((s, me) => s + (me.teamAPoints || 0), 0) || 0;
            const meneTotalB = m.menes?.reduce((s, me) => s + (me.teamBPoints || 0), 0) || 0;

            // Series info
            const sMatches = m.seriesInfo?.seriesId ? matches.filter(sm => sm.seriesInfo?.seriesId === m.seriesInfo?.seriesId).sort((a, b) => (a.seriesInfo?.matchNumber || 0) - (b.seriesInfo?.matchNumber || 0)) : [];
            const sWinsA = sMatches.filter(sm => sm.winner === 'A').length;
            const sWinsB = sMatches.filter(sm => sm.winner === 'B').length;

            return (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
                {/* Header Card */}
                <View style={styles.detailHeaderCard}>
                  <View style={styles.detailHeaderTop}>
                    <View style={[styles.detailIcon, { backgroundColor: isTournament ? theme.carreauColor + '18' : theme.primary + '18' }]}>
                      <MaterialIcons name={isTournament ? 'emoji-events' : 'fitness-center'} size={30} color={isTournament ? theme.carreauColor : theme.primary} />
                    </View>
                    <View style={styles.detailInfo}>
                      <Text style={styles.detailName}>
                        {isTournament ? (m.tournamentName || t('modes', 'tournament')) : t('modes', 'training')}
                      </Text>
                      <Text style={styles.detailDate}>
                        {new Date(m.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </Text>
                      <Text style={styles.detailTime}>
                        {new Date(m.date).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  {/* Badges */}
                  <View style={styles.detailHeaderBadges}>
                    <View style={[styles.detailModeBadge, { backgroundColor: (isTournament ? theme.carreauColor : theme.primary) + '15' }]}>
                      <MaterialIcons name={isTournament ? 'emoji-events' : 'fitness-center'} size={13} color={isTournament ? theme.carreauColor : theme.primary} />
                      <Text style={[styles.detailModeBadgeText, { color: isTournament ? theme.carreauColor : theme.primary }]}>
                        {isTournament ? t('modes', 'tournament') : t('modes', 'training')}
                      </Text>
                    </View>
                    <View style={[styles.detailModeBadge, { backgroundColor: theme.backgroundSecondary }]}>
                      <MaterialIcons name="groups" size={13} color={theme.textSecondary} />
                      <Text style={[styles.detailModeBadgeText, { color: theme.textSecondary }]}>{t('formats', m.format)}</Text>
                    </View>
                    {matchTerrain ? (
                      <View style={[styles.detailModeBadge, { backgroundColor: theme.success + '15' }]}>
                        <MaterialIcons name="place" size={13} color={theme.success} />
                        <Text style={[styles.detailModeBadgeText, { color: theme.success }]} numberOfLines={1}>{matchTerrain.name}</Text>
                      </View>
                    ) : null}
                    {matchBoules ? (
                      <View style={[styles.detailModeBadge, { backgroundColor: '#D97706' + '15' }]}>
                        <MaterialIcons name="sports-baseball" size={13} color={'#D97706'} />
                        <Text style={[styles.detailModeBadgeText, { color: '#D97706' }]} numberOfLines={1}>
                          {matchBoules.name}{matchBoules.diameter ? ` \u2022 ${matchBoules.diameter}mm` : ''}
                        </Text>
                      </View>
                    ) : null}
                    {m.duration > 0 ? (
                      <View style={[styles.detailModeBadge, { backgroundColor: theme.backgroundSecondary }]}>
                        <MaterialIcons name="timer" size={13} color={theme.textSecondary} />
                        <Text style={[styles.detailModeBadgeText, { color: theme.textSecondary }]}>{m.duration} min</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Score Card */}
                <View style={[styles.detailScoreCard, { borderLeftWidth: 4, borderLeftColor: isWin ? theme.success : theme.error }]}>
                  <View style={styles.mdScoreRow}>
                    <View style={styles.mdTeamCol}>
                      <Text style={styles.mdTeamLabel}>{t('history', 'me')}</Text>
                      <Text style={styles.mdTeamNames} numberOfLines={2}>{m.teamA.playerNames.join(' \u2022 ')}</Text>
                    </View>
                    <View style={styles.mdScoreCenter}>
                      <View style={styles.mdScoreBox}>
                        <Text style={[styles.mdScoreNum, isWin && { color: theme.success }]}>{m.teamA.score}</Text>
                        <Text style={styles.mdScoreSep}>-</Text>
                        <Text style={[styles.mdScoreNum, !isWin && { color: theme.error }]}>{m.teamB.score}</Text>
                      </View>
                      <View style={[styles.mdResultBadge, { backgroundColor: isWin ? theme.success + '15' : theme.error + '15' }]}>
                        <MaterialIcons name={isWin ? 'check-circle' : 'cancel'} size={14} color={isWin ? theme.success : theme.error} />
                        <Text style={[styles.mdResultText, { color: isWin ? theme.success : theme.error }]}>
                          {isWin ? t('history', 'victory') : t('history', 'defeat')}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.mdTeamCol, { alignItems: 'flex-end' }]}>
                      <Text style={styles.mdTeamLabel}>{t('history', 'opp')}</Text>
                      <Text style={[styles.mdTeamNames, { textAlign: 'right' }]} numberOfLines={2}>{m.teamB.playerNames.join(' \u2022 ')}</Text>
                    </View>
                  </View>
                  {/* Player roles */}
                  {m.teamA.playerRoles && m.teamA.playerRoles.length > 0 ? (
                    <View style={styles.mdRolesRow}>
                      {m.teamA.playerRoles.map((pr, idx) => {
                        const rc: Record<string, { icon: string; color: string }> = { 'Pointeur': { icon: 'radio-button-on', color: '#3B82F6' }, 'Milieu': { icon: 'swap-horiz', color: '#8B5CF6' }, 'Tireur': { icon: 'gps-fixed', color: '#F97316' } };
                        const cfg = rc[pr.role] || { icon: 'person', color: theme.textMuted };
                        return (
                          <View key={pr.playerId} style={[styles.mdRoleBadge, { backgroundColor: cfg.color + '15' }]}>
                            <MaterialIcons name={cfg.icon as any} size={11} color={cfg.color} />
                            <Text style={[styles.mdRoleBadgeText, { color: cfg.color }]}>{m.teamA.playerNames[idx]?.split(' ')[0]} - {t('roles', pr.role)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>

                {/* Series Info */}
                {sMatches.length > 1 ? (
                  <View style={styles.mdSeriesCard}>
                    <View style={styles.mdSeriesHeader}>
                      <MaterialIcons name="replay" size={16} color={theme.accent} />
                      <Text style={styles.mdSeriesTitle}>Best of {sMatches.length >= 3 ? '3' : sMatches.length}</Text>
                      <View style={[styles.mdSeriesScoreBadge, { backgroundColor: sWinsA > sWinsB ? theme.success + '15' : sWinsB > sWinsA ? theme.error + '15' : theme.warning + '15' }]}>
                        <Text style={[styles.mdSeriesScoreText, { color: sWinsA > sWinsB ? theme.success : sWinsB > sWinsA ? theme.error : theme.warning }]}>{sWinsA} - {sWinsB}</Text>
                      </View>
                    </View>
                    <View style={styles.mdSeriesList}>
                      {sMatches.map((sm, idx) => {
                        const sCurrent = sm.id === m.id;
                        const sWin = sm.winner === 'A';
                        return (
                          <Pressable
                            key={sm.id}
                            style={[styles.mdSeriesMatch, sCurrent && styles.mdSeriesMatchCurrent]}
                            onPress={() => { if (!sCurrent) { setViewingMatch(sm); Haptics.selectionAsync(); } }}
                          >
                            <View style={[styles.mdSeriesDot, { backgroundColor: sWin ? theme.success : theme.error }]} />
                            <Text style={styles.mdSeriesMatchLabel}>
                              {sm.seriesInfo?.isFinale ? t('historyExtra', 'finale') : `M${idx + 1}`}
                            </Text>
                            <Text style={[styles.mdSeriesMatchScore, sWin && { color: theme.success }, !sWin && { color: theme.error }]}>
                              {sm.teamA.score}-{sm.teamB.score}
                            </Text>
                            {sCurrent ? <MaterialIcons name="chevron-right" size={14} color={theme.primary} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Menes */}
                {m.menes && m.menes.length > 0 ? (
                  <View style={styles.mdMenesCard}>
                    <View style={styles.mdMenesHeader}>
                      <MaterialIcons name="format-list-numbered" size={16} color={theme.primary} />
                      <Text style={styles.mdMenesTitle}>{t('match', 'menesCount')} ({m.menes.length})</Text>
                    </View>
                    {m.menes.map((mene, idx) => (
                      <View key={idx} style={styles.mdMeneRow}>
                        <Text style={styles.mdMeneNum}>#{idx + 1}</Text>
                        <View style={styles.mdMeneScores}>
                          <Text style={[styles.mdMeneScore, (mene.teamAPoints || 0) > 0 && { color: theme.success, fontWeight: '700' }]}>{mene.teamAPoints || 0}</Text>
                          <Text style={styles.mdMeneSep}>-</Text>
                          <Text style={[styles.mdMeneScore, (mene.teamBPoints || 0) > 0 && { color: theme.error, fontWeight: '700' }]}>{mene.teamBPoints || 0}</Text>
                        </View>
                        <View style={styles.mdMeneCumul}>
                          <Text style={styles.mdMeneCumulText}>
                            {m.menes!.slice(0, idx + 1).reduce((s, me) => s + (me.teamAPoints || 0), 0)}-{m.menes!.slice(0, idx + 1).reduce((s, me) => s + (me.teamBPoints || 0), 0)}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <View style={styles.mdMeneTotalRow}>
                      <Text style={styles.mdMeneTotalLabel}>Total</Text>
                      <Text style={[styles.mdMeneTotalVal, { color: theme.success }]}>{meneTotalA}</Text>
                      <Text style={styles.mdMeneSep}>-</Text>
                      <Text style={[styles.mdMeneTotalVal, { color: theme.error }]}>{meneTotalB}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Player Actions Summary */}
                {m.playerActions && m.playerActions.length > 0 ? (
                  <View style={styles.mdActionsCard}>
                    <View style={styles.mdActionsHeader}>
                      <MaterialIcons name="sports" size={16} color={theme.tirColor} />
                      <Text style={styles.mdActionsTitle}>{t('match', 'playerActions')}</Text>
                    </View>
                    {m.playerActions.map(pa => {
                      const tirRate = pa.actions.tirs > 0 ? Math.round((pa.actions.tirsSuccess / pa.actions.tirs) * 100) : 0;
                      const pointRate = pa.actions.points > 0 ? Math.round((pa.actions.pointsSuccess / pa.actions.points) * 100) : 0;
                      return (
                        <View key={pa.playerId} style={styles.mdActionRow}>
                          <View style={styles.mdActionPlayerInfo}>
                            <View style={[styles.mdActionDot, { backgroundColor: pa.team === 'A' ? theme.primary : theme.accent }]} />
                            <Text style={styles.mdActionPlayerName} numberOfLines={1}>{pa.playerName}</Text>
                          </View>
                          <View style={styles.mdActionStatsRow}>
                            {pa.actions.tirs > 0 ? (
                              <View style={styles.mdActionStat}>
                                <MaterialIcons name="gps-fixed" size={12} color={theme.tirColor} />
                                <Text style={styles.mdActionStatText}>{pa.actions.tirsSuccess}/{pa.actions.tirs} ({tirRate}%)</Text>
                              </View>
                            ) : null}
                            {pa.actions.points > 0 ? (
                              <View style={styles.mdActionStat}>
                                <MaterialIcons name="adjust" size={12} color={theme.pointColor} />
                                <Text style={styles.mdActionStatText}>{pa.actions.pointsSuccess}/{pa.actions.points} ({pointRate}%)</Text>
                              </View>
                            ) : null}
                            {pa.actions.carreaux > 0 ? (
                              <View style={styles.mdActionStat}>
                                <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
                                <Text style={[styles.mdActionStatText, { color: theme.carreauColor }]}>{pa.actions.carreaux}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Tournament phase info */}
                {isTournament && m.tournamentPhase ? (
                  <View style={styles.mdPhaseCard}>
                    <MaterialIcons name="flag" size={16} color={theme.carreauColor} />
                    <Text style={styles.mdPhaseText}>{t('tournamentPhases', m.tournamentPhase)}</Text>
                  </View>
                ) : null}

                {/* Share Status Section (shows shared players for matches) */}
                <ShareStatusSection
                  itemType="match"
                  itemId={m.id}
                  isOwner={!isSharedItem(m.id)}
                />

                {/* Modification History */}
                <ModificationLogsSection
                  itemType="match"
                  itemId={m.id}
                  isOwner={!isSharedItem(m.id)}
                  onReverted={async () => {
                    await refreshData();
                  }}
                />

                {/* Share with players button */}
                <Pressable
                  style={styles.shareParticipantsBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowMatchShareRequest(true);
                  }}
                >
                  <MaterialIcons name="group-add" size={18} color={theme.primary} />
                  <Text style={styles.shareParticipantsBtnText}>{language === 'fr' ? 'Partager avec les joueurs' : 'Share with players'}</Text>
                </Pressable>

                {/* Actions */}
                <View style={styles.detailActions}>
                  <Pressable style={styles.deleteBtn} onPress={() => {
                    Alert.alert(t('match', 'deleteMatch'), t('match', 'deleteMatchConfirm'), [
                      { text: t('common', 'cancel'), style: 'cancel' },
                      { text: t('common', 'delete'), style: 'destructive', onPress: () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        deleteMatch(m.id);
                        setViewingMatch(null);
                      }},
                    ]);
                  }}>
                    <MaterialIcons name="delete" size={18} color={theme.error} />
                    <Text style={styles.deleteBtnText}>{t('common', 'delete')}</Text>
                  </Pressable>
                  <Pressable style={styles.closeBtn} onPress={() => {
                    Haptics.selectionAsync();
                    setViewingMatch(null);
                    router.push(`/match/${m.id}`);
                  }}>
                    <MaterialIcons name="edit" size={18} color="#FFF" />
                    <Text style={styles.closeBtnText}>{t('match', 'editMatch')}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            );
          })()}
        </SafeAreaView>
      </Modal>

      {/* Challenge Collaborative Conflict Modal */}
      <EditConflictModal
        visible={showChallengeConflict}
        diffs={challengeConflictDiffs}
        language={language}
        onKeepMine={handleChallengeConflictKeepMine}
        onKeepTheirs={handleChallengeConflictKeepTheirs}
        onCancel={handleChallengeConflictCancel}
      />

      {/* Challenge Share Request Modal (cross-player sharing) */}
      {editingChallenge ? (
        <ShareRequestModal
          visible={showChallengeShareRequest}
          onClose={() => setShowChallengeShareRequest(false)}
          itemType="challenge"
          itemId={editingChallenge.id}
          playerIds={[
            ...(editingChallenge.playerId ? [editingChallenge.playerId] : []),
            ...(editingChallenge.opponentId ? [editingChallenge.opponentId] : []),
          ]}
          senderName={user?.username || user?.email || 'Joueur'}
          itemSummary={`${t('challenge', CHALLENGE_CONFIG[editingChallenge.type].nameKey)} - ${editingChallenge.playerName || ''}`}
          language={language}
        />
      ) : null}

      {/* Match Share Request Modal (cross-player sharing) */}
      {viewingMatch ? (
        <ShareRequestModal
          visible={showMatchShareRequest}
          onClose={() => setShowMatchShareRequest(false)}
          itemType="match"
          itemId={viewingMatch.id}
          playerIds={[...viewingMatch.teamA.players, ...viewingMatch.teamB.players]}
          senderName={user?.username || user?.email || 'Joueur'}
          itemSummary={`${viewingMatch.teamA.playerNames.join(', ')} vs ${viewingMatch.teamB.playerNames.join(', ')}`}
          language={language}
        />
      ) : null}
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
  filtersContainer: {
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
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
  listContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },
  
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
  // Shared badge inline
  sharedInlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.primary + '10',
    borderWidth: 1,
    borderColor: theme.primary + '20',
  },
  sharedInlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Shared challenge banner in detail modal
  sharedChallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.primary + '08',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.primary + '20',
  },
  sharedChallBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedChallBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.primary,
  },
  sharedChallBannerSub: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 1,
  },
  sharedChallPermBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  sharedChallPermText: {
    fontSize: 11,
    fontWeight: '700',
  },
  challReadOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 12,
  },
  challReadOnlyBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textMuted,
  },
  
  // Match Detail Modal
  mdScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  mdTeamCol: { flex: 1 },
  mdTeamLabel: { fontSize: 9, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  mdTeamNames: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, lineHeight: 18 },
  mdScoreCenter: { alignItems: 'center', paddingHorizontal: 12 },
  mdScoreBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 8 },
  mdScoreNum: { fontSize: 32, fontWeight: '800', color: theme.textSecondary, minWidth: 36, textAlign: 'center' },
  mdScoreSep: { fontSize: 18, color: theme.textMuted, marginHorizontal: 6 },
  mdResultBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.borderRadius.full },
  mdResultText: { fontSize: 12, fontWeight: '700' },
  mdRolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  mdRoleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  mdRoleBadgeText: { fontSize: 10, fontWeight: '600' },
  // Series in match detail
  mdSeriesCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: theme.accent + '30', ...theme.shadows.card },
  mdSeriesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  mdSeriesTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.accent },
  mdSeriesScoreBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: theme.borderRadius.full },
  mdSeriesScoreText: { fontSize: 14, fontWeight: '800' },
  mdSeriesList: { gap: 6 },
  mdSeriesMatch: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.sm },
  mdSeriesMatchCurrent: { borderWidth: 1.5, borderColor: theme.primary + '40', backgroundColor: theme.primary + '06' },
  mdSeriesDot: { width: 8, height: 8, borderRadius: 4 },
  mdSeriesMatchLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  mdSeriesMatchScore: { fontSize: 15, fontWeight: '700', color: theme.textSecondary },
  // Menes in match detail
  mdMenesCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, ...theme.shadows.card },
  mdMenesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  mdMenesTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  mdMeneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border + '60' },
  mdMeneNum: { width: 32, fontSize: 12, fontWeight: '600', color: theme.textMuted },
  mdMeneScores: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mdMeneScore: { fontSize: 16, fontWeight: '600', color: theme.textSecondary, width: 24, textAlign: 'center' },
  mdMeneSep: { fontSize: 12, color: theme.textMuted },
  mdMeneCumul: { marginLeft: 'auto', backgroundColor: theme.backgroundSecondary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.borderRadius.sm },
  mdMeneCumulText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },
  mdMeneTotalRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, marginTop: 4 },
  mdMeneTotalLabel: { width: 32, fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  mdMeneTotalVal: { fontSize: 18, fontWeight: '800', width: 24, textAlign: 'center' },
  // Player Actions in match detail
  mdActionsCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, ...theme.shadows.card },
  mdActionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  mdActionsTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  mdActionRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border + '60' },
  mdActionPlayerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  mdActionDot: { width: 8, height: 8, borderRadius: 4 },
  mdActionPlayerName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  mdActionStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingLeft: 16 },
  mdActionStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mdActionStatText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  // Phase badge in match detail
  mdPhaseCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.carreauColor + '10', borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: theme.carreauColor + '25' },
  mdPhaseText: { fontSize: 14, fontWeight: '600', color: theme.carreauColor },
  
  // Series Card
  seriesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 10,
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
  seriesMatchList: { paddingHorizontal: 12, paddingBottom: 12, gap: 8, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, backgroundColor: theme.surface, borderBottomLeftRadius: theme.borderRadius.md, borderBottomRightRadius: theme.borderRadius.md },
  
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
  // Sponsored badge in challenge card
  challengeSponsorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  challengeSponsorPhoto: { width: 20, height: 20, borderRadius: 6, overflow: 'hidden' as const },
  challengeSponsorName: { flex: 1, fontSize: 11, fontWeight: '600', color: '#92400E' },
  challengeSponsorBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F59E0B', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  challengeSponsorBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  
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
  
  // Meetup Sub-Filters
  meetupSubFiltersContainer: {
    backgroundColor: theme.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingVertical: 8,
    gap: 6,
  },
  meetupSubFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  meetupSubFilterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 48,
  },
  meetupSubFilterChips: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 16,
  },
  meetupSubFilterChipActive: {
    backgroundColor: theme.accent + '15',
    borderColor: theme.accent,
  },
  meetupSubFilterChipTextActive: {
    color: theme.accent,
    fontWeight: '600',
  },
  meetupSubFilterCountActive: {
    color: theme.accent,
  },
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
  
  // Challenge detail edit styles
  cdEditBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cdSaveHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.md,
  },
  cdSaveHeaderBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  cdEditFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  cdEditFieldInput: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 56,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cdEditFieldLarge: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 80,
  },
  cdEditFieldUnit: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  cdShotDotEditable: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  cdShotsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cdShotsEditHint: {
    fontSize: 10,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  cdShotLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  cdShotLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cdShotLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cdShotLegendText: {
    fontSize: 10,
    color: theme.textMuted,
  },
  // Precision shot editing styles
  cdPrecisionShotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  cdPrecisionShotNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cdPrecisionShotNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  cdPrecisionShotEditable: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    gap: 8,
  },
  cdPrecisionPickerScroll: {
    flexGrow: 0,
  },
  cdPrecisionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 6,
  },
  cdPrecisionChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  cdPrecisionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  cdPrecisionChipTextActive: {
    color: '#FFF',
  },
  cdPrecisionDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cdPrecisionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    width: 56,
  },
  cdPrecisionDistChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cdPrecisionDistChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  cdPrecisionDistChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  cdPrecisionDistChipTextActive: {
    color: '#FFF',
  },
  cdPrecisionPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cdPrecisionPointChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
  },
  cdPrecisionPointChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  cdPrecisionPointChipLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: theme.textMuted,
    marginTop: 1,
  },
  cdPrecisionShotDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  cdPrecisionShotInfoRow: {
    flex: 1,
    gap: 2,
  },
  cdPrecisionShotAtelier: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  cdPrecisionShotDist: {
    fontSize: 11,
    color: theme.textMuted,
  },
  cdPrecisionShotPointBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  cdPrecisionShotPointValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  cdNotesSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cdNotesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cdNotesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  cdNotesInput: {
    fontSize: 14,
    color: theme.textPrimary,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
    padding: 12,
    minHeight: 80,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cdNotesText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },

  // Detail Modal - Header
  detailHeaderCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, ...theme.shadows.card },
  detailHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  detailIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  detailInfo: { flex: 1 },
  detailName: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  detailDate: { fontSize: 13, color: theme.textSecondary, marginTop: 3 },
  detailTime: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  // Sponsor banner in challenge detail
  detailSponsorBanner: { marginTop: 14 },
  detailSponsorBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: '#FDE68A' },
  detailSponsorPhoto: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' as const },
  detailSponsorLabel: { fontSize: 9, color: '#92400E', fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' as const },
  detailSponsorName: { fontSize: 15, fontWeight: '700', color: '#78350F', marginTop: 1 },
  detailSponsorBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  detailSponsorBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  detailHeaderBadges: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  detailModeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.borderRadius.full },
  detailModeBadgeText: { fontSize: 12, fontWeight: '600' },
  // Detail Modal - Score
  detailScoreCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    ...theme.shadows.card,
  },
  detailScoreHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  detailScoreLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  detailScoreValue: { fontSize: 44, fontWeight: '800' },
  detailScoreSub: { fontSize: 14, color: theme.textSecondary, marginTop: 4, fontWeight: '500' },
  detailScoreBar: { width: '80%', marginTop: 12 },
  detailScoreBarTrack: { height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  detailScoreBarFill: { height: '100%', borderRadius: 3 },
  // Detail Modal - Stats
  detailStatsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 16 },
  detailStatCard: { flex: 1, alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, ...theme.shadows.card },
  detailStatIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  detailStatValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginTop: 2 },
  detailStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 3, textAlign: 'center' },
  // Detail Modal - 1v1
  detailOpponent: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, ...theme.shadows.card, borderWidth: 1, borderColor: theme.accent + '30' },
  detail1v1Header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  detail1v1Title: { fontSize: 14, fontWeight: '700', color: theme.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
  detail1v1ScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detail1v1Player: { flex: 1 },
  detail1v1PlayerName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  detail1v1PlayerScore: { fontSize: 26, fontWeight: '800' },
  detail1v1Vs: { paddingHorizontal: 16, alignItems: 'center' },
  detail1v1VsText: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  detail1v1WinnerBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detail1v1ResultLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4, marginBottom: 4 },
  // Radar chart styles
  radarContainer: { alignItems: 'center' as const, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border + '40' },
  radarTitle: { fontSize: 13, fontWeight: '600' as const, color: theme.textSecondary, marginBottom: 12, textAlign: 'center' as const },
  radarLegend: { flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 20, marginTop: 10 },
  radarLegendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  radarLegendDot: { width: 10, height: 10, borderRadius: 5 },
  radarLegendText: { fontSize: 12, fontWeight: '600' as const, color: theme.textPrimary },
  radarValuesTable: { width: '100%' as const, marginTop: 12, gap: 6 },
  radarValueRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 },
  radarValueLabel: { fontSize: 11, color: theme.textMuted, width: 70, textAlign: 'right' as const },
  radarValueNum: { fontSize: 13, fontWeight: '700' as const, minWidth: 36, textAlign: 'center' as const },
  radarValueVs: { fontSize: 10, color: theme.textMuted },
  // Detail Modal - Shots
  detailShotsSection: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, ...theme.shadows.card },
  detailShotsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailShotsTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  detailShotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shotDot: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  shotDotText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  shotDotCarreauIndicator: { position: 'absolute', top: -1, right: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: theme.carreauColor },
  detailAtelierSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  detailAtelierSummaryItem: { flex: 1, minWidth: 60, alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.sm, paddingVertical: 8, paddingHorizontal: 6 },
  detailAtelierSummaryLabel: { fontSize: 10, color: theme.textMuted, fontWeight: '600', marginBottom: 2, textAlign: 'center' },
  detailAtelierSummaryValue: { fontSize: 16, fontWeight: '700' },
  cdShotEditHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border },
  detailActions: { flexDirection: 'row', gap: 12, marginTop: 'auto' },
  shareParticipantsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: theme.primary + '12',
    borderRadius: theme.borderRadius.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  shareParticipantsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  // Meetup Card
  meetupCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 10,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  meetupCardIndicator: { width: 4 },
  meetupCardContent: { flex: 1, padding: 12 },
  meetupCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 6, flexWrap: 'wrap' },
  meetupCardTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  meetupCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  meetupMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meetupMetaText: { fontSize: 12, color: theme.textSecondary },
  meetupCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meetupParticipantsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  meetupParticipantsText: { fontSize: 11, fontWeight: '600' },

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
