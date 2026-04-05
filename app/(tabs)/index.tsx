import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
  RefreshControl,
  FlatList,
  SectionList,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import theme, { blurhash } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useAuth, getSupabaseClient } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { preloadInterstitial } from '@/services/adService';
import CommunityLeaderboard from '@/components/ui/CommunityLeaderboard';
import LeaderboardHub from '@/components/feature/LeaderboardHub';
import AdBanner from '@/components/ui/AdBanner';
import { Skeleton, LeaderboardSkeleton, TimelineSkeleton, HistorySkeleton } from '@/components/ui/SkeletonLoader';
import WeeklyStatsCard from '@/components/ui/WeeklyStatsCard';
import SponsorBanner from '@/components/ui/SponsorBanner';
import GoldSponsorBanner from '@/components/ui/GoldSponsorBanner';
import UpcomingTimeline from '@/components/feature/UpcomingTimeline';
import CompactHistory from '@/components/feature/CompactHistory';
import AmbassadorBanner from '@/components/feature/AmbassadorBanner';
import TournamentPickerModal from '@/components/feature/TournamentPickerModal';

import QRShareModal from '@/components/feature/QRShareModal';
import { getFeaturedAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';
import { getMyMeetups, getInvitedMeetups, getMeetupResponses, getPendingInvitationsCount, Meetup, MeetupResponse } from '@/services/meetupService';
import { LEADERBOARD_MIN_MATCHES } from '@/services/leaderboardService';
import { getEloRank, ELO_INACTIVITY_THRESHOLD_DAYS, ELO_INACTIVITY_DECAY_PER_MONTH, isInPlacement, ELO_PLACEMENT_MATCHES } from '@/services/eloService';
import { fetchWeeklyLeaderboard } from '@/services/weeklyLeaderboardService';
import { extraTranslations } from '@/constants/i18nExtra';
import { getPendingWitnessRequests, getUnreadEventNotificationCount, markEventNotificationRead, EventNotification } from '@/services/eventNotificationService';
import { getSponsoredEvents, SponsoredEvent } from '@/services/sponsoredEventService';

// ============================================================
// FULL PAGE SKELETON — single unified skeleton for initial load
// ============================================================
function FullPageSkeleton() {
  return (
    <View style={sk.root}>
      {/* Hero skeleton */}
      <View style={sk.hero}>
        <View style={sk.heroTop}>
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width={100} height={14} borderRadius={8} style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            <Skeleton width={170} height={24} borderRadius={8} style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>
          <Skeleton width={56} height={56} borderRadius={18} style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ flex: 1 }}>
              <Skeleton height={52} borderRadius={14} style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            </View>
          ))}
        </View>
      </View>
      {/* Actions skeleton */}
      <View style={sk.actions}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flex: 1 }}>
            <Skeleton height={110} borderRadius={18} />
          </View>
        ))}
      </View>
      {/* Leaderboard skeleton */}
      <View style={sk.block}><LeaderboardSkeleton /></View>
      {/* Timeline skeleton */}
      <View style={sk.block}><TimelineSkeleton items={3} /></View>
      {/* History skeleton */}
      <View style={sk.block}><HistorySkeleton /></View>
    </View>
  );
}

const sk = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  hero: { backgroundColor: '#0F172A', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 20 },
  block: { paddingHorizontal: 16, marginTop: 20 },
});

// ============================================================
// SECTION TYPES
// ============================================================
type SectionKey = 'hero' | 'actions' | 'leaderboardHub' | 'witness' | 'eloDecay' | 'weekly' | 'sponsor' | 'progress' | 'leaderboard' | 'divider1' | 'weeklyStats' | 'adBanner1' | 'adBanner2' | 'timeline' | 'divider2' | 'ambassadors' | 'divider3' | 'history';
interface HomeSection { key: SectionKey; data: SectionKey[] }

// ============================================================
// HOME SCREEN
// ============================================================
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, tournaments, matches, challenges, selfPlayer, refreshData } = useApp();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Initial load
  const [initialLoading, setInitialLoading] = useState(true);

  // Ambassadors
  const [featuredAmbassadors, setFeaturedAmbassadors] = useState<Ambassador[]>([]);

  // Meetups
  const [meetups, setMeetups] = useState<(Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number; _maxParticipants?: number })[]>([]);
  const [meetupsLoading, setMeetupsLoading] = useState(true);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  const [showMeetupListModal, setShowMeetupListModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Sponsored events
  const [upcomingEvents, setUpcomingEvents] = useState<SponsoredEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Witness alerts
  const [witnessRequests, setWitnessRequests] = useState<EventNotification[]>([]);
  const [eventNotifCount, setEventNotifCount] = useState(0);

  // Responsive
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width || 375);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;

  // Weekly leaderboard
  const [weeklyRank, setWeeklyRank] = useState<{ rank: number; direction: string; diff: number; matchesThisWeek: number } | null>(null);

  // Countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Pending match witnesses
  const [pendingWitnessMatchCount, setPendingWitnessMatchCount] = useState(0);

  // ELO Decay Warning
  const eloDecayWarning = useMemo(() => {
    if (!selfPlayer?.lastMatchDate) return null;
    const lastMatch = new Date(selfPlayer.lastMatchDate);
    const nowDate = new Date();
    const daysSince = Math.floor((nowDate.getTime() - lastMatch.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 20) return null; // Only warn from 20 days
    const daysUntilDecay = Math.max(0, ELO_INACTIVITY_THRESHOLD_DAYS - daysSince);
    const isDecaying = daysSince >= ELO_INACTIVITY_THRESHOLD_DAYS;
    const monthsDecayed = isDecaying ? Math.floor((daysSince - ELO_INACTIVITY_THRESHOLD_DAYS) / 30) + 1 : 0;
    return { daysSince, daysUntilDecay, isDecaying, decayAmount: isDecaying ? monthsDecayed * ELO_INACTIVITY_DECAY_PER_MONTH : ELO_INACTIVITY_DECAY_PER_MONTH };
  }, [selfPlayer?.lastMatchDate]);

  // Placement matches info
  const placementInfo = useMemo(() => {
    const mp = userStats?.matchesPlayed || matches.length;
    if (mp >= ELO_PLACEMENT_MATCHES) return null;
    return { current: mp, remaining: ELO_PLACEMENT_MATCHES - mp };
  }, [userStats?.matchesPlayed, matches.length]);

  // === LOAD FUNCTIONS ===

  const loadWitnessRequests = useCallback(async () => {
    const [{ requests }, count] = await Promise.all([
      getPendingWitnessRequests(),
      getUnreadEventNotificationCount(),
    ]);
    setWitnessRequests(requests);
    setEventNotifCount(count);
    try {
      const sb = getSupabaseClient();
      const { data: uid } = await sb.auth.getUser();
      if (uid?.user?.id) {
        const { data: wData } = await sb.from('match_witness_requests').select('id').eq('witness_user_id', uid.user.id).eq('status', 'pending');
        setPendingWitnessMatchCount(wData?.length || 0);
      }
    } catch { /* silent */ }
  }, []);

  const loadMeetups = useCallback(async () => {
    try {
      const [{ meetups: created }, { meetups: invited }] = await Promise.all([getMyMeetups(), getInvitedMeetups()]);
      const nowDate = new Date();
      const allMap = new Map<string, Meetup & { _source: 'created' | 'invited' }>();
      created.filter(m => m.status === 'active' && new Date(m.date) > nowDate).forEach(m => allMap.set(m.id, { ...m, _source: 'created' }));
      invited.filter(m => m.status === 'active' && new Date(m.date) > nowDate).forEach(m => { if (!allMap.has(m.id)) allMap.set(m.id, { ...m, _source: 'invited' }); });
      const sorted = Array.from(allMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const withCounts = await Promise.all(
        sorted.slice(0, 5).map(async (m) => {
          const { responses } = await getMeetupResponses(m.id);
          const acceptedCount = responses.filter((r: MeetupResponse) => r.status === 'accepted').length;
          return { ...m, _acceptedCount: acceptedCount, _maxParticipants: m.max_participants };
        })
      );
      setMeetups(withCounts);
    } catch { /* silent */ } finally { setMeetupsLoading(false); }
  }, []);

  const loadUpcomingEvents = useCallback(async () => {
    try {
      const { events } = await getSponsoredEvents();
      const nowDate = new Date();
      const upcoming = events.filter(e => (e.status === 'upcoming' || e.status === 'active') && new Date(e.eventDate) >= new Date(nowDate.toISOString().split('T')[0])).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()).slice(0, 5);
      setUpcomingEvents(upcoming);
    } catch { /* silent */ } finally { setEventsLoading(false); }
  }, []);

  const loadAmbassadors = useCallback(async () => {
    const ambassadors = await getFeaturedAmbassadors();
    setFeaturedAmbassadors(ambassadors);
  }, []);

  const loadWeeklyRank = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { players } = await fetchWeeklyLeaderboard();
      const me = players.find((p: any) => p.userId === user.id);
      if (me) {
        setWeeklyRank({ rank: me.rankChange.currentRank, direction: me.rankChange.direction, diff: me.rankChange.diff, matchesThisWeek: me.weeklyMatches });
      } else { setWeeklyRank(null); }
    } catch { /* silent */ }
  }, [user?.id]);

  // === INITIAL LOAD — Phased: critical first, deferred second ===
  useEffect(() => {
    const loadCritical = async () => {
      // Phase 1: Load only what's needed for above-the-fold content
      await Promise.all([
        loadWeeklyRank(),
        loadWitnessRequests(),
      ]);
      setInitialLoading(false);

      // Phase 2: Defer non-critical data (below-fold) by 1.5s
      setTimeout(async () => {
        await Promise.all([
          loadAmbassadors(),
          loadMeetups(),
          loadUpcomingEvents(),
        ]);
      }, 1500);
    };
    loadCritical();
  }, [loadWeeklyRank, loadAmbassadors, loadMeetups, loadUpcomingEvents, loadWitnessRequests]);

  // Polling — unified into single interval to reduce timer overhead
  useEffect(() => {
    const pollAll = () => {
      loadWitnessRequests();
      getPendingInvitationsCount().then(setPendingInviteCount);
    };
    // Initial load of pending invites
    getPendingInvitationsCount().then(setPendingInviteCount);
    const interval = setInterval(pollAll, 30000);
    return () => clearInterval(interval);
  }, [loadWitnessRequests]);

  useEffect(() => { preloadInterstitial(); }, []);

  // === PULL-TO-REFRESH (no skeletons, just spinner) ===
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshData(),
      loadMeetups(),
      loadWitnessRequests(),
      loadUpcomingEvents(),
      loadWeeklyRank(),
      loadAmbassadors(),
    ]);
    setRefreshing(false);
  }, [refreshData, loadMeetups, loadWitnessRequests, loadUpcomingEvents, loadWeeklyRank, loadAmbassadors]);

  // === COMPUTED DATA ===
  const recentResults = useMemo(() => {
    const items: { type: 'match' | 'challenge'; id: string; date: string; title: string; subtitle: string; result: 'win' | 'loss' | 'draw' | 'neutral'; score?: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [];
    matches.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3).forEach((m: any) => {
      const isWin = m.winner === 'A';
      const isDraw = m.winner === 'draw';
      const scoreA = m.teamA?.score ?? 0;
      const scoreB = m.teamB?.score ?? 0;
      const teamANames = m.teamA?.playerNames?.join(', ') || t('match', 'teamA');
      const teamBNames = m.teamB?.playerNames?.join(', ') || t('match', 'teamB');
      items.push({ type: 'match', id: m.id, date: m.date, title: teamANames, subtitle: `vs ${teamBNames}`, result: isDraw ? 'draw' : isWin ? 'win' : 'loss', score: `${scoreA} - ${scoreB}`, icon: 'sports' });
    });
    challenges.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3).forEach((c: any) => {
      const rate = c.type === 'precision'
        ? (c.maxPoints > 0 ? Math.round(((c.totalPoints || 0) / c.maxPoints) * 100) : 0)
        : (c.successRate !== undefined && c.successRate !== null)
          ? Math.round(c.successRate)
          : (c.totalShots > 0 ? Math.round(((c.successCount || 0) / c.totalShots) * 100) : 0);
      const challengeName = c.type === '10_tirs' ? t('challengeNames', '10_tirs') : c.type === '10_tirs_sautee' ? t('challengeNames', '10_tirs_sautee') : t('challengeNames', 'precision');
      items.push({ type: 'challenge', id: c.id, date: c.date, title: challengeName, subtitle: c.mode === 'duel' ? `vs ${c.opponent_name || c.player_name || ''}` : t('challenge', 'solo'), result: rate >= 60 ? 'win' : rate >= 40 ? 'draw' : 'neutral', score: `${rate}%`, icon: 'track-changes' });
    });
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
  }, [matches, challenges, t]);

  const displayName = selfPlayer?.name || user?.username || user?.email?.split('@')[0] || (language === 'en' ? 'Player' : 'Joueur');
  const totalMatches = userStats?.matchesPlayed || matches.length;
  const totalWins = userStats?.wins || 0;
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (language === 'fr') {
      if (hour < 12) return 'Bonjour';
      if (hour < 18) return 'Bon apres-midi';
      return 'Bonsoir';
    }
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, [language]);

  // === SECTION LIST SECTIONS ===
  const sections = useMemo<HomeSection[]>(() => {
    const s: HomeSection[] = [];
    s.push({ key: 'hero', data: ['hero'] });
    s.push({ key: 'actions', data: ['actions'] });
    // Leaderboard Hub — prominent position right after actions
    s.push({ key: 'leaderboardHub', data: ['leaderboardHub'] });
    if (witnessRequests.length > 0) s.push({ key: 'witness', data: ['witness'] });
    if (eloDecayWarning) s.push({ key: 'eloDecay' as SectionKey, data: ['eloDecay' as SectionKey] });
    if (weeklyRank) s.push({ key: 'weekly', data: ['weekly'] });
    s.push({ key: 'sponsor', data: ['sponsor'] });
    if (selfPlayer?.isPublic && totalMatches < LEADERBOARD_MIN_MATCHES) s.push({ key: 'progress', data: ['progress'] });
    s.push({ key: 'timeline', data: ['timeline'] });
    if (matches.length > 0 || challenges.length > 0) s.push({ key: 'weeklyStats', data: ['weeklyStats'] });
    s.push({ key: 'adBanner1', data: ['adBanner1'] });
    s.push({ key: 'divider1', data: ['divider1'] });
    if (featuredAmbassadors.length > 0) {
      s.push({ key: 'ambassadors', data: ['ambassadors'] });
      s.push({ key: 'divider2', data: ['divider2'] });
    }
    s.push({ key: 'adBanner2', data: ['adBanner2'] });
    s.push({ key: 'history', data: ['history'] });
    return s;
  }, [witnessRequests.length, weeklyRank, selfPlayer?.isPublic, totalMatches, featuredAmbassadors.length, matches.length, challenges.length]);

  // === RENDER SECTION ITEM ===
  const renderSectionItem = useCallback(({ item }: { item: SectionKey }) => {
    switch (item) {
      // ===== HERO =====
      case 'hero':
        return (
          <View style={[st.heroWrap, isTablet && st.heroWrapTablet]}>
            <View style={st.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.heroGreeting}>{greeting},</Text>
                <Text style={st.heroName} numberOfLines={1}>{displayName}</Text>
              </View>
              <View style={st.heroTopActions}>
                <Pressable style={st.heroIconBtn} onPress={() => router.push('/scanner' as any)}>
                  <MaterialIcons name="qr-code-scanner" size={20} color="rgba(255,255,255,0.7)" />
                </Pressable>
                <Pressable style={st.heroIconBtn} onPress={() => setShowQRModal(true)}>
                  <MaterialIcons name="qr-code-2" size={20} color="rgba(255,255,255,0.7)" />
                </Pressable>
                {pendingInviteCount > 0 ? (
                  <Pressable style={st.heroIconBtn} onPress={() => router.push('/meetup/invitations' as any)}>
                    <MaterialIcons name="mail" size={20} color="#60A5FA" />
                    <View style={st.heroBadge}><Text style={st.heroBadgeText}>{pendingInviteCount > 9 ? '9+' : pendingInviteCount}</Text></View>
                  </Pressable>
                ) : null}
                <Pressable testID="profile-avatar" style={st.heroAvatarBtn} onPress={() => router.push('/profile')}>
                  {selfPlayer?.avatar ? (
                    <Image source={{ uri: selfPlayer.avatar }} style={st.heroAvatarImg} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                  ) : (
                    <LinearGradient colors={['#3B82F6', '#60A5FA']} style={st.heroAvatarFallback}>
                      <Text style={st.heroAvatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  {(eventNotifCount + pendingWitnessMatchCount) > 0 ? (
                    <View style={st.avatarNotifBadge}><Text style={st.avatarNotifBadgeText}>{(eventNotifCount + pendingWitnessMatchCount) > 9 ? '9+' : (eventNotifCount + pendingWitnessMatchCount)}</Text></View>
                  ) : null}
                </Pressable>
              </View>
            </View>
            <View style={st.statsChipRow}>
              {[
                { value: totalMatches, label: t('stats', 'matches'), color: theme.primary },
                { value: totalWins, label: t('stats', 'victories'), color: theme.success },
                { value: `${winRate}%`, label: t('stats', 'winRate'), color: theme.accent },
                { value: challenges.length, label: t('profile', 'challenges'), color: theme.tirColor },
              ].map((stat, idx) => (
                <View key={idx} style={st.statsChip}>
                  <Text style={[st.statsChipValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={st.statsChipLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        );

      // ===== LEADERBOARD HUB =====
      case 'leaderboardHub':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <LeaderboardHub />
          </View>
        );

      // ===== QUICK ACTIONS =====
      case 'actions':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <View style={[st.actionsRow, isTablet && st.actionsRowTablet]}>
              {[
                { label: t('home', 'match'), sub: t('home', 'training'), icon: 'sports' as const, gradient: ['#2563EB', '#60A5FA'] as [string, string], onPress: () => router.push('/match/new'), testID: 'action-new-match' },
                { label: t('home', 'challenge'), sub: t('home', 'shotsPoints'), icon: 'track-changes' as const, gradient: ['#D97706', '#FBBF24'] as [string, string], onPress: () => router.push('/challenge/new'), testID: 'action-new-challenge' },
                { label: t('home', 'tournament'), sub: t('home', 'myJourney'), icon: 'emoji-events' as const, gradient: ['#B45309', '#F59E0B'] as [string, string], onPress: () => setShowTournamentPicker(true), testID: 'action-tournament' },
              ].map((action, idx) => (
                <Pressable key={idx} testID={(action as any).testID} style={({ pressed }) => [st.actionCard, isTablet && st.actionCardTablet, pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 }]} onPress={action.onPress}>
                  <LinearGradient colors={action.gradient} style={st.actionIconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <MaterialIcons name={action.icon} size={isTablet ? 36 : 28} color="#FFF" />
                  </LinearGradient>
                  <Text style={[st.actionLabel, isTablet && { fontSize: 17 }]} adjustsFontSizeToFit numberOfLines={1}>{action.label}</Text>
                  <Text style={st.actionSub}>{action.sub}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );

      // ===== ELO DECAY WARNING =====
      case 'eloDecay':
        return eloDecayWarning ? (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <View style={st.eloDecayCard}>
              <View style={st.eloDecayHeader}>
                <View style={st.eloDecayIconBg}>
                  <MaterialIcons name={eloDecayWarning.isDecaying ? 'warning' : 'schedule'} size={18} color={eloDecayWarning.isDecaying ? '#EF4444' : '#F59E0B'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.eloDecayTitle}>{t('leaderboard', 'eloDecayWarningTitle')}</Text>
                  <Text style={st.eloDecayDesc}>
                    {eloDecayWarning.isDecaying
                      ? t('leaderboard', 'eloInactivityWarning').replace('{days}', String(eloDecayWarning.daysSince)).replace('{decay}', String(eloDecayWarning.decayAmount))
                      : t('leaderboard', 'eloDecayWarningDesc').replace('{days}', String(eloDecayWarning.daysUntilDecay)).replace('{decay}', String(ELO_INACTIVITY_DECAY_PER_MONTH))
                    }
                  </Text>
                </View>
              </View>
              <View style={st.eloDecayProgressTrack}>
                <View style={[st.eloDecayProgressFill, { width: `${Math.min((eloDecayWarning.daysSince / ELO_INACTIVITY_THRESHOLD_DAYS) * 100, 100)}%`, backgroundColor: eloDecayWarning.isDecaying ? '#EF4444' : '#F59E0B' }]} />
              </View>
              <Pressable style={st.eloDecayCta} onPress={() => router.push('/match/new')}>
                <MaterialIcons name="sports" size={16} color="#FFF" />
                <Text style={st.eloDecayCtaText}>{t('leaderboard', 'eloDecayWarningCta')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null;

      // ===== WITNESS ALERTS =====
      case 'witness':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <View style={st.witnessAlertCard}>
              <View style={st.witnessAlertHeader}>
                <View style={st.witnessAlertIconBg}><MaterialIcons name="visibility" size={18} color="#F59E0B" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.witnessAlertTitle}>{language === 'fr' ? 'Attestations en attente' : 'Pending attestations'}</Text>
                  <Text style={st.witnessAlertCount}>{witnessRequests.length} {language === 'fr' ? 'demande(s)' : 'request(s)'}</Text>
                </View>
              </View>
              {witnessRequests.slice(0, 3).map((req) => (
                <Pressable key={req.id} style={({ pressed }) => [st.witnessReqRow, pressed && { opacity: 0.85 }]} onPress={() => { markEventNotificationRead(req.id); setWitnessRequests(prev => prev.filter(r => r.id !== req.id)); router.push(`/sponsored-event/${req.eventId}` as any); }}>
                  <View style={st.witnessReqDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.witnessReqTitle} numberOfLines={1}>{req.eventTitle || req.title}</Text>
                    <Text style={st.witnessReqMsg} numberOfLines={1}>{req.message}</Text>
                  </View>
                  <View style={st.witnessReqBtn}><MaterialIcons name="verified" size={14} color="#FFF" /><Text style={st.witnessReqBtnText}>{language === 'fr' ? 'Attester' : 'Attest'}</Text></View>
                </Pressable>
              ))}
              {witnessRequests.length > 3 ? (
                <Pressable style={st.witnessMoreLink} onPress={() => router.push('/sponsored-event/list' as any)}>
                  <Text style={st.witnessMoreText}>+{witnessRequests.length - 3} {language === 'fr' ? 'autre(s)' : 'more'}</Text>
                  <MaterialIcons name="chevron-right" size={14} color="#F59E0B" />
                </Pressable>
              ) : null}
            </View>
          </View>
        );

      // ===== WEEKLY BANNER =====
      case 'weekly':
        return weeklyRank ? (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <Pressable style={st.weeklyBanner} onPress={() => router.push('/leaderboard' as any)}>
              <LinearGradient colors={['#1E3A8A', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.weeklyBannerGradient}>
                <View style={st.weeklyBannerLeft}>
                  <View style={st.weeklyBannerIconBg}><MaterialIcons name="leaderboard" size={20} color="#FFF" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.weeklyBannerTitle}>{(extraTranslations.weeklyLeaderboard?.title as any)?.[language] || 'Weekly Leaderboard'}</Text>
                    <Text style={st.weeklyBannerSub}>{weeklyRank.matchesThisWeek} {t('leaderboard', 'matches')} {language === 'fr' ? 'cette semaine' : 'this week'}</Text>
                  </View>
                </View>
                <View style={st.weeklyBannerRight}>
                  <Text style={st.weeklyBannerRank}>#{weeklyRank.rank}</Text>
                  {weeklyRank.direction === 'up' ? (
                    <View style={st.weeklyBannerChange}><MaterialIcons name="arrow-upward" size={14} color="#34D399" /><Text style={[st.weeklyBannerChangeText, { color: '#34D399' }]}>+{weeklyRank.diff}</Text></View>
                  ) : weeklyRank.direction === 'down' ? (
                    <View style={st.weeklyBannerChange}><MaterialIcons name="arrow-downward" size={14} color="#F87171" /><Text style={[st.weeklyBannerChangeText, { color: '#F87171' }]}>-{weeklyRank.diff}</Text></View>
                  ) : weeklyRank.direction === 'new' ? (
                    <View style={[st.weeklyBannerChange, { backgroundColor: 'rgba(96,165,250,0.2)' }]}><Text style={[st.weeklyBannerChangeText, { color: '#60A5FA', fontSize: 10 }]}>NEW</Text></View>
                  ) : (
                    <View style={st.weeklyBannerChange}><Text style={[st.weeklyBannerChangeText, { color: 'rgba(255,255,255,0.5)' }]}>=</Text></View>
                  )}
                  <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null;

      // ===== SPONSOR BANNER =====
      case 'sponsor':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <GoldSponsorBanner style={{ marginBottom: 12 }} page="home" userId={user?.id} />
            <SponsorBanner style={{}} page="home" />
          </View>
        );

      // ===== LEADERBOARD PROGRESS =====
      case 'progress':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <Pressable style={st.progressCard} onPress={() => router.push('/leaderboard' as any)}>
              <View style={st.progressHeader}>
                <View style={st.progressIconBg}><MaterialIcons name="leaderboard" size={16} color="#D97706" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={st.progressTitle}>{t('leaderboard', 'progressTitle')}</Text>
                  <Text style={st.progressCount}>{totalMatches}/{LEADERBOARD_MIN_MATCHES} {t('leaderboard', 'matches')}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#D97706" />
              </View>
              <View style={st.progressBarTrack}>
                <View style={[st.progressBarFill, { width: `${Math.min((totalMatches / LEADERBOARD_MIN_MATCHES) * 100, 100)}%` }]} />
              </View>
            </Pressable>
          </View>
        );



      // ===== DIVIDERS =====
      case 'divider1':
      case 'divider2':
      case 'divider3':
        return <View style={st.divider}><View style={st.dividerLine} /><View style={st.dividerDot} /><View style={st.dividerLine} /></View>;

      // ===== WEEKLY STATS CARD =====
      case 'weeklyStats':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <WeeklyStatsCard />
          </View>
        );

      // ===== AD BANNERS =====
      case 'adBanner1':
      case 'adBanner2':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <AdBanner position="inline" />
          </View>
        );

      // ===== UPCOMING TIMELINE =====
      case 'timeline':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <UpcomingTimeline
              tournaments={tournaments}
              meetups={meetups}
              upcomingEvents={upcomingEvents}
              meetupsLoading={false}
              eventsLoading={false}
              pendingInviteCount={pendingInviteCount}
              language={language}
              t={t}
              now={now}
              onShowMeetupList={() => setShowMeetupListModal(true)}
            />
          </View>
        );

      // ===== AMBASSADORS =====
      case 'ambassadors':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            <AmbassadorBanner ambassadors={featuredAmbassadors} language={language} t={t} screenWidth={screenWidth} userId={user?.id} />
          </View>
        );

      // ===== HISTORY =====
      case 'history':
        return (
          <View style={[st.section, isTablet && st.sectionTablet]}>
            {(matches.length === 0 && challenges.length === 0) ? (
              <View style={st.emptyCard}>
                <Image source={require('@/assets/images/empty-home.png')} style={st.emptyImage} contentFit="contain" transition={300} />
                <Text style={st.emptyTitle}>{t('home', 'welcomeTitle')}</Text>
                <Text style={st.emptyText}>{t('home', 'welcomeText')}</Text>
                <View style={st.emptyActionsRow}>
                  <Pressable style={st.emptyCta} onPress={() => router.push('/match/new')}>
                    <MaterialIcons name="sports" size={18} color="#FFF" />
                    <Text style={st.emptyCtaText}>{t('home', 'match')}</Text>
                  </Pressable>
                  <Pressable style={st.emptyCtaSecondary} onPress={() => router.push('/challenge/new')}>
                    <MaterialIcons name="track-changes" size={18} color={theme.primary} />
                    <Text style={st.emptyCtaSecondaryText}>{t('home', 'challenge')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <CompactHistory recentResults={recentResults} matches={matches} hasData={matches.length > 0 || challenges.length > 0} language={language} t={t} />
            )}
          </View>
        );

      default:
        return null;
    }
  }, [
    isTablet, greeting, displayName, selfPlayer, pendingInviteCount, eventNotifCount, pendingWitnessMatchCount,
    totalMatches, totalWins, winRate, challenges.length, weeklyRank, language, t, eloDecayWarning, placementInfo,
    witnessRequests, tournaments, meetups, upcomingEvents, featuredAmbassadors,
    now, screenWidth, user?.id, matches, recentResults,
  ]);

  const keyExtractor = useCallback((item: SectionKey) => item, []);

  // === MEETUP LIST MODAL RENDERER ===
  const renderMeetupModalItem = useCallback(({ item: m }: { item: any }) => {
    const mDate = new Date(m.date);
    const isCreator = m._source === 'created';
    const daysUntil = Math.max(0, Math.ceil((mDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return (
      <Pressable style={({ pressed }) => [st.meetupModalItem, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]} onPress={() => { setShowMeetupListModal(false); router.push(`/meetup/${m.id}` as any); }}>
        <View style={st.meetupDateCol}>
          <Text style={st.meetupDateDay}>{mDate.getDate()}</Text>
          <Text style={st.meetupDateMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
        </View>
        <View style={st.meetupInfoCol}>
          <Text style={st.meetupItemTitle} numberOfLines={1}>{m.title}</Text>
          <View style={st.meetupItemMeta}>
            <MaterialIcons name="schedule" size={12} color={theme.textMuted} />
            <Text style={st.meetupItemTime}>{mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
            {daysUntil <= 1 ? <View style={st.meetupSoonBadge}><Text style={st.meetupSoonText}>{daysUntil === 0 ? t('notifications', 'todayLabel') : t('notifications', 'tomorrowLabel')}</Text></View> : null}
          </View>
          <View style={st.meetupItemBottom}>
            <View style={st.meetupConfirmBadge}><MaterialIcons name="group" size={12} color={theme.success} /><Text style={st.meetupConfirmText}>{m._acceptedCount || 0}/{m._maxParticipants || 8} {t('meetup', 'confirmedCount')}</Text></View>
            {isCreator ? (
              <View style={st.meetupCreatorBadge}><MaterialIcons name="person" size={10} color={theme.primary} /><Text style={st.meetupCreatorText}>{t('meetup', 'yourMeetup')}</Text></View>
            ) : (
              <View style={st.meetupInvitedBadge}><MaterialIcons name="mail" size={10} color={theme.accent} /><Text style={st.meetupInvitedText}>{t('meetup', 'invited')}</Text></View>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
      </Pressable>
    );
  }, [t, language]);

  const meetupKeyExtractor = useCallback((item: any) => item.id, []);

  // === RENDER ===
  if (initialLoading) {
    return (
      <SafeAreaView edges={['top']} style={st.container}>
        <FullPageSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderSectionItem}
        renderSectionHeader={() => null}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={true}
      />

      {/* ===== MODALS ===== */}
      <Modal visible={showMeetupListModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMeetupListModal(false)}>
        <SafeAreaView style={st.meetupModalContainer}>
          <View style={st.meetupModalHeader}>
            <View style={st.meetupModalHeaderLeft}><View style={st.meetupModalIconBg}><MaterialIcons name="event" size={20} color={theme.accent} /></View><Text style={st.meetupModalTitle}>{t('meetup', 'upcomingMeetups')}</Text></View>
            <Pressable style={st.meetupModalCloseBtn} onPress={() => setShowMeetupListModal(false)}><MaterialIcons name="close" size={24} color={theme.textPrimary} /></Pressable>
          </View>
          <FlatList data={meetups} keyExtractor={meetupKeyExtractor} renderItem={renderMeetupModalItem} style={st.meetupModalScroll} contentContainerStyle={st.meetupModalScrollContent} showsVerticalScrollIndicator={false} initialNumToRender={10} />
        </SafeAreaView>
      </Modal>


      <QRShareModal visible={showQRModal} onClose={() => setShowQRModal(false)} />
      <TournamentPickerModal visible={showTournamentPicker} onClose={() => setShowTournamentPicker(false)} tournaments={tournaments} />
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { maxWidth: 960, alignSelf: 'center' as const, width: '100%' },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTablet: { marginBottom: 28 },

  // HERO
  heroWrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, marginBottom: 20, backgroundColor: '#0F172A', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, ...Platform.select({ ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16 }, android: { elevation: 4 }, default: {} }) },
  heroWrapTablet: { paddingTop: 16, paddingBottom: 24, paddingHorizontal: 28 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  heroGreeting: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  heroName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  heroTopActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroIconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  heroBadge: { position: 'absolute' as const, top: -3, right: -3, backgroundColor: theme.error, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#0F172A' },
  heroBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  heroAvatarBtn: { width: 56, height: 56, borderRadius: 18, overflow: 'hidden', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)' },
  heroAvatarImg: { width: 56, height: 56, borderRadius: 18 },
  heroAvatarFallback: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroAvatarLetter: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  avatarNotifBadge: { position: 'absolute' as const, top: -4, right: -4, backgroundColor: '#7C3AED', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 4, borderWidth: 2.5, borderColor: '#0F172A' },
  avatarNotifBadgeText: { fontSize: 10, fontWeight: '800' as const, color: '#FFF' },
  statsChipRow: { flexDirection: 'row', gap: 8 },
  statsChip: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statsChipValue: { fontSize: 20, fontWeight: '800' },
  statsChipLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // ACTIONS
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionsRowTablet: { gap: 16 },
  actionCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 18, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', ...Platform.select({ ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 }, default: {} }) },
  actionCardTablet: { padding: 24, borderRadius: 22 },
  actionIconBg: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  actionLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  actionSub: { fontSize: 11, color: theme.textSecondary },

  // WEEKLY BANNER
  weeklyBanner: { borderRadius: 16, overflow: 'hidden' as const, ...Platform.select({ ios: { shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 }, android: { elevation: 3 }, default: {} }) },
  weeklyBannerGradient: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16 },
  weeklyBannerLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, flex: 1 },
  weeklyBannerIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' as const, justifyContent: 'center' as const },
  weeklyBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: '#FFF' },
  weeklyBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  weeklyBannerRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  weeklyBannerRank: { fontSize: 24, fontWeight: '900' as const, color: '#FFF' },
  weeklyBannerChange: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 2, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  weeklyBannerChangeText: { fontSize: 12, fontWeight: '800' as const },

  // PROGRESS
  progressCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#D97706' + '20', ...theme.shadows.card },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressIconBg: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#D97706' + '12', alignItems: 'center', justifyContent: 'center' },
  progressTitle: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  progressCount: { fontSize: 11, fontWeight: '600', color: '#D97706', marginTop: 1 },
  progressBarTrack: { height: 6, backgroundColor: '#D97706' + '12', borderRadius: 3, overflow: 'hidden' as const },
  progressBarFill: { height: '100%', backgroundColor: '#D97706', borderRadius: 3 },

  // EMPTY STATE
  emptyCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 32, alignItems: 'center', ...theme.shadows.card },
  emptyImage: { width: 160, height: 160, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyActionsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  emptyCtaText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  emptyCtaSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary + '12', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.primary + '30' },
  emptyCtaSecondaryText: { fontSize: 14, fontWeight: '600', color: theme.primary },

  // WITNESS
  witnessAlertCard: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#FDE68A' },
  witnessAlertHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 12 },
  witnessAlertIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F59E0B18', alignItems: 'center' as const, justifyContent: 'center' as const },
  witnessAlertTitle: { fontSize: 15, fontWeight: '700' as const, color: '#78350F' },
  witnessAlertCount: { fontSize: 11, fontWeight: '600' as const, color: '#92400E', marginTop: 1 },
  witnessReqRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 6 },
  witnessReqDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  witnessReqTitle: { fontSize: 13, fontWeight: '700' as const, color: '#78350F' },
  witnessReqMsg: { fontSize: 11, color: '#92400E', marginTop: 2 },
  witnessReqBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: '#F59E0B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  witnessReqBtnText: { fontSize: 11, fontWeight: '700' as const, color: '#FFF' },
  witnessMoreLink: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  witnessMoreText: { fontSize: 12, fontWeight: '600' as const, color: '#F59E0B' },

  // MODALS
  meetupModalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  meetupModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  meetupModalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meetupModalIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.accent + '12', alignItems: 'center', justifyContent: 'center' },
  meetupModalTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  meetupModalCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  meetupModalScroll: { flex: 1 },
  meetupModalScrollContent: { padding: 16 },
  meetupModalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12, gap: 12, ...theme.shadows.card },
  meetupDateCol: { width: 50, height: 50, borderRadius: 14, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' },
  meetupDateDay: { fontSize: 20, fontWeight: '900', color: theme.primary, lineHeight: 22 },
  meetupDateMonth: { fontSize: 9, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 },
  meetupInfoCol: { flex: 1 },
  meetupItemTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  meetupItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  meetupItemTime: { fontSize: 12, color: theme.textMuted },
  meetupSoonBadge: { backgroundColor: theme.warning + '18', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginLeft: 6 },
  meetupSoonText: { fontSize: 10, fontWeight: '700', color: theme.warning },
  meetupItemBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meetupConfirmBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.success + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  meetupConfirmText: { fontSize: 11, fontWeight: '600', color: theme.success },
  meetupCreatorBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.primary + '12', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  meetupCreatorText: { fontSize: 10, fontWeight: '700', color: theme.primary },
  meetupInvitedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.accent + '12', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  meetupInvitedText: { fontSize: 10, fontWeight: '700', color: theme.accent },

  // DIVIDERS
  divider: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1', marginHorizontal: 12 },

  // ELO DECAY WARNING
  eloDecayCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#FDE68A', ...Platform.select({ ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 2 }, default: {} }) },
  eloDecayHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, marginBottom: 12 },
  eloDecayIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F59E0B18', alignItems: 'center' as const, justifyContent: 'center' as const },
  eloDecayTitle: { fontSize: 14, fontWeight: '700' as const, color: '#78350F' },
  eloDecayDesc: { fontSize: 12, color: '#92400E', marginTop: 2, lineHeight: 17 },
  eloDecayProgressTrack: { height: 6, backgroundColor: '#FDE68A', borderRadius: 3, overflow: 'hidden' as const, marginBottom: 12 },
  eloDecayProgressFill: { height: '100%' as const, borderRadius: 3 },
  eloDecayCta: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 12 },
  eloDecayCtaText: { fontSize: 14, fontWeight: '700' as const, color: '#FFF' },
});
