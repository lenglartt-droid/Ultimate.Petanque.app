import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
  RefreshControl,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import theme, { blurhash } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { preloadInterstitial } from '@/services/adService';
import CommunityLeaderboard from '@/components/ui/CommunityLeaderboard';
import { BannerSkeleton, TimelineSkeleton, LeaderboardSkeleton, HistorySkeleton, SponsorSkeleton } from '@/components/ui/SkeletonLoader';
import SponsorBanner from '@/components/ui/SponsorBanner';
import UpcomingTimeline from '@/components/feature/UpcomingTimeline';
import CompactHistory from '@/components/feature/CompactHistory';
import AmbassadorBanner from '@/components/feature/AmbassadorBanner';
import TournamentPickerModal from '@/components/feature/TournamentPickerModal';
import JoinMeetupModal from '@/components/feature/JoinMeetupModal';
import QRShareModal from '@/components/feature/QRShareModal';
import { getFeaturedAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';
import { getMyMeetups, getInvitedMeetups, getMeetupResponses, getPendingInvitationsCount, Meetup, MeetupResponse } from '@/services/meetupService';

import { LEADERBOARD_MIN_MATCHES } from '@/services/leaderboardService';
import { fetchWeeklyLeaderboard } from '@/services/weeklyLeaderboardService';
import { extraTranslations } from '@/constants/i18nExtra';
import { getPendingWitnessRequests, getUnreadEventNotificationCount, markEventNotificationRead, EventNotification } from '@/services/eventNotificationService';
import { getSponsoredEvents, SponsoredEvent } from '@/services/sponsoredEventService';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, tournaments, matches, challenges, selfPlayer, refreshData } = useApp();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Ambassadors state
  const [featuredAmbassadors, setFeaturedAmbassadors] = useState<Ambassador[]>([]);
  const [ambassadorsLoaded, setAmbassadorsLoaded] = useState(false);

  // Meetups state
  const [meetups, setMeetups] = useState<(Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number; _maxParticipants?: number })[]>([]);
  const [meetupsLoading, setMeetupsLoading] = useState(true);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [showJoinMeetupModal, setShowJoinMeetupModal] = useState(false);
  const [showMeetupListModal, setShowMeetupListModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Sponsored events state

  const [upcomingEvents, setUpcomingEvents] = useState<SponsoredEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Witness attestation alerts
  const [witnessRequests, setWitnessRequests] = useState<EventNotification[]>([]);
  const [eventNotifCount, setEventNotifCount] = useState(0);


  // Responsive
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;

  // Weekly leaderboard banner state
  const [weeklyRank, setWeeklyRank] = useState<{ rank: number; direction: string; diff: number; matchesThisWeek: number } | null>(null);
  const [weeklyBannerLoaded, setWeeklyBannerLoaded] = useState(false);

  // Countdown timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Pending witness count from match_witness_requests table
  const [pendingWitnessMatchCount, setPendingWitnessMatchCount] = useState(0);

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
        const { data: wData } = await sb
          .from('match_witness_requests')
          .select('id')
          .eq('witness_user_id', uid.user.id)
          .eq('status', 'pending');
        setPendingWitnessMatchCount(wData?.length || 0);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadWitnessRequests();
    const interval = setInterval(loadWitnessRequests, 30000);
    return () => clearInterval(interval);
  }, [loadWitnessRequests]);

  const loadMeetups = useCallback(async () => {
    setMeetupsLoading(true);
    try {
      const [{ meetups: created }, { meetups: invited }] = await Promise.all([
        getMyMeetups(),
        getInvitedMeetups(),
      ]);
      const nowDate = new Date();
      const allMap = new Map<string, Meetup & { _source: 'created' | 'invited' }>();
      created.filter(m => m.status === 'active' && new Date(m.date) > nowDate).forEach(m => allMap.set(m.id, { ...m, _source: 'created' }));
      invited.filter(m => m.status === 'active' && new Date(m.date) > nowDate).forEach(m => {
        if (!allMap.has(m.id)) allMap.set(m.id, { ...m, _source: 'invited' });
      });
      const sorted = Array.from(allMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const withCounts = await Promise.all(
        sorted.slice(0, 5).map(async (m) => {
          const { responses } = await getMeetupResponses(m.id);
          const acceptedCount = responses.filter((r: MeetupResponse) => r.status === 'accepted').length;
          return { ...m, _acceptedCount: acceptedCount, _maxParticipants: m.max_participants };
        })
      );
      setMeetups(withCounts);
    } catch { /* silent */ } finally {
      setMeetupsLoading(false);
    }
  }, []);

  useEffect(() => { loadMeetups(); }, [loadMeetups]);

  // Load upcoming sponsored events
  const loadUpcomingEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const { events } = await getSponsoredEvents();
      const nowDate = new Date();
      const upcoming = events.filter(e => (e.status === 'upcoming' || e.status === 'active') && new Date(e.eventDate) >= new Date(nowDate.toISOString().split('T')[0])).sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()).slice(0, 5);
      setUpcomingEvents(upcoming);
    } catch { /* silent */ } finally { setEventsLoading(false); }
  }, []);

  useEffect(() => { loadUpcomingEvents(); }, [loadUpcomingEvents]);

  useEffect(() => {
    const loadPending = () => { getPendingInvitationsCount().then(setPendingInviteCount); };
    loadPending();
    const interval = setInterval(loadPending, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load featured ambassadors
  const loadAmbassadors = useCallback(async () => {
    const ambassadors = await getFeaturedAmbassadors();
    setFeaturedAmbassadors(ambassadors);
    setAmbassadorsLoaded(true);
  }, []);

  useEffect(() => { loadAmbassadors(); }, [loadAmbassadors]);

  // Load weekly leaderboard rank
  const loadWeeklyRank = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { players } = await fetchWeeklyLeaderboard();
      const me = players.find((p: any) => p.userId === user.id);
      if (me) {
        setWeeklyRank({
          rank: me.rankChange.currentRank,
          direction: me.rankChange.direction,
          diff: me.rankChange.diff,
          matchesThisWeek: me.weeklyMatches,
        });
      } else {
        setWeeklyRank(null);
      }
    } catch { /* silent */ }
    setWeeklyBannerLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    const timer = setTimeout(loadWeeklyRank, 1500);
    return () => clearTimeout(timer);
  }, [loadWeeklyRank]);

  // Pull-to-refresh: reset loaded states to show skeletons, then reload all data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setWeeklyBannerLoaded(false);
    setMeetupsLoading(true);
    setEventsLoading(true);
    setAmbassadorsLoaded(false);
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

  useEffect(() => { preloadInterstitial(); }, []);

  // --- Computed data ---
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

  const displayName = user?.username || selfPlayer?.name || user?.email?.split('@')[0] || (language === 'en' ? 'Player' : 'Joueur');
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





  const renderMeetupModalItem = useCallback(({ item: m }: { item: any }) => {
    const mDate = new Date(m.date);
    const isCreator = m._source === 'created';
    const daysUntil = Math.max(0, Math.ceil((mDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return (
      <Pressable style={({ pressed }) => [s.meetupModalItem, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]} onPress={() => { setShowMeetupListModal(false); router.push(`/meetup/${m.id}` as any); }}>
        <View style={s.meetupDateCol}>
          <Text style={s.meetupDateDay}>{mDate.getDate()}</Text>
          <Text style={s.meetupDateMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
        </View>
        <View style={s.meetupInfoCol}>
          <Text style={s.meetupItemTitle} numberOfLines={1}>{m.title}</Text>
          <View style={s.meetupItemMeta}>
            <MaterialIcons name="schedule" size={12} color={theme.textMuted} />
            <Text style={s.meetupItemTime}>{mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
            {daysUntil <= 1 ? <View style={s.meetupSoonBadge}><Text style={s.meetupSoonText}>{daysUntil === 0 ? t('notifications', 'todayLabel') : t('notifications', 'tomorrowLabel')}</Text></View> : null}
          </View>
          <View style={s.meetupItemBottom}>
            <View style={s.meetupConfirmBadge}>
              <MaterialIcons name="group" size={12} color={theme.success} />
              <Text style={s.meetupConfirmText}>{m._acceptedCount || 0}/{m._maxParticipants || 8} {t('meetup', 'confirmedCount')}</Text>
            </View>
            {isCreator ? (
              <View style={s.meetupCreatorBadge}><MaterialIcons name="person" size={10} color={theme.primary} /><Text style={s.meetupCreatorText}>{t('meetup', 'yourMeetup')}</Text></View>
            ) : (
              <View style={s.meetupInvitedBadge}><MaterialIcons name="mail" size={10} color={theme.accent} /><Text style={s.meetupInvitedText}>{t('meetup', 'invited')}</Text></View>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
      </Pressable>
    );
  }, [t, language]);

  const meetupKeyExtractor = useCallback((item: any) => item.id, []);
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <ScrollView
        ref={scrollViewRef}
        style={s.scrollView}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
      >
        {/* ========== HERO HEADER ========== */}
        <Animated.View entering={FadeIn.duration(450)}>
          <View style={[s.heroWrap, isTablet && s.heroWrapTablet]}>
            <View style={s.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.heroGreeting}>{greeting},</Text>
                <Text style={s.heroName} numberOfLines={1}>{displayName}</Text>
              </View>
              <View style={s.heroTopActions}>
                <Pressable style={s.heroIconBtn} onPress={() => router.push('/scanner' as any)}>
                  <MaterialIcons name="qr-code-scanner" size={20} color="rgba(255,255,255,0.7)" />
                </Pressable>
                <Pressable style={s.heroIconBtn} onPress={() => setShowQRModal(true)}>
                  <MaterialIcons name="qr-code-2" size={20} color="rgba(255,255,255,0.7)" />
                </Pressable>
                {pendingInviteCount > 0 ? (
                  <Pressable style={s.heroIconBtn} onPress={() => router.push('/meetup/invitations' as any)}>
                    <MaterialIcons name="mail" size={20} color="#60A5FA" />
                    <View style={s.heroBadge}><Text style={s.heroBadgeText}>{pendingInviteCount > 9 ? '9+' : pendingInviteCount}</Text></View>
                  </Pressable>
                ) : null}
                <Pressable style={s.heroAvatarBtn} onPress={() => router.push('/profile')}>
                  {selfPlayer?.avatar ? (
                    <Image source={{ uri: selfPlayer.avatar }} style={s.heroAvatarImg} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                  ) : (
                    <LinearGradient colors={['#3B82F6', '#60A5FA']} style={s.heroAvatarFallback}>
                      <Text style={s.heroAvatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  {(eventNotifCount + pendingWitnessMatchCount) > 0 ? (
                    <View style={s.avatarNotifBadge}><Text style={s.avatarNotifBadgeText}>{(eventNotifCount + pendingWitnessMatchCount) > 9 ? '9+' : (eventNotifCount + pendingWitnessMatchCount)}</Text></View>
                  ) : null}
                </Pressable>
              </View>
            </View>
            <View style={s.statsChipRow}>
              {[
                { value: totalMatches, label: t('stats', 'matches'), color: theme.primary },
                { value: totalWins, label: t('stats', 'victories'), color: theme.success },
                { value: `${winRate}%`, label: t('stats', 'winRate'), color: theme.accent },
                { value: challenges.length, label: t('profile', 'challenges'), color: theme.tirColor },
              ].map((stat, idx) => (
                <View key={idx} style={s.statsChip}>
                  <Text style={[s.statsChipValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={s.statsChipLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ========== QUICK ACTIONS ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(100)} style={[s.section, isTablet && s.sectionTablet]}>
          <View style={[s.actionsRow, isTablet && s.actionsRowTablet]}>
            {[
              { label: t('home', 'match'), sub: t('home', 'training'), icon: 'sports' as const, gradient: ['#2563EB', '#60A5FA'] as [string, string], onPress: () => router.push('/match/new') },
              { label: t('home', 'challenge'), sub: t('home', 'shotsPoints'), icon: 'track-changes' as const, gradient: ['#D97706', '#FBBF24'] as [string, string], onPress: () => router.push('/challenge/new') },
              { label: t('home', 'tournament'), sub: t('home', 'myJourney'), icon: 'emoji-events' as const, gradient: ['#B45309', '#F59E0B'] as [string, string], onPress: () => setShowTournamentPicker(true) },
            ].map((action, idx) => (
              <Pressable key={idx} style={({ pressed }) => [s.actionCard, isTablet && s.actionCardTablet, pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 }]} onPress={action.onPress}>
                <LinearGradient colors={action.gradient} style={s.actionIconBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <MaterialIcons name={action.icon} size={isTablet ? 36 : 28} color="#FFF" />
                </LinearGradient>
                <Text style={[s.actionLabel, isTablet && { fontSize: 17 }]} adjustsFontSizeToFit numberOfLines={1}>{action.label}</Text>
                <Text style={s.actionSub}>{action.sub}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ========== WITNESS ATTESTATION ALERTS ========== */}
        {witnessRequests.length > 0 ? (
          <Animated.View entering={FadeIn.duration(400).delay(140)} style={[s.section, isTablet && s.sectionTablet]}>
            <View style={s.witnessAlertCard}>
              <View style={s.witnessAlertHeader}>
                <View style={s.witnessAlertIconBg}>
                  <MaterialIcons name="visibility" size={18} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.witnessAlertTitle}>{language === 'fr' ? 'Attestations en attente' : 'Pending attestations'}</Text>
                  <Text style={s.witnessAlertCount}>{witnessRequests.length} {language === 'fr' ? 'demande(s)' : 'request(s)'}</Text>
                </View>
              </View>
              {witnessRequests.slice(0, 3).map((req) => (
                <Pressable
                  key={req.id}
                  style={({ pressed }) => [s.witnessReqRow, pressed && { opacity: 0.85 }]}
                  onPress={() => {
                    markEventNotificationRead(req.id);
                    setWitnessRequests(prev => prev.filter(r => r.id !== req.id));
                    router.push(`/sponsored-event/${req.eventId}` as any);
                  }}
                >
                  <View style={s.witnessReqDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.witnessReqTitle} numberOfLines={1}>{req.eventTitle || req.title}</Text>
                    <Text style={s.witnessReqMsg} numberOfLines={1}>{req.message}</Text>
                  </View>
                  <View style={s.witnessReqBtn}>
                    <MaterialIcons name="verified" size={14} color="#FFF" />
                    <Text style={s.witnessReqBtnText}>{language === 'fr' ? 'Attester' : 'Attest'}</Text>
                  </View>
                </Pressable>
              ))}
              {witnessRequests.length > 3 ? (
                <Pressable style={s.witnessMoreLink} onPress={() => router.push('/sponsored-event/list' as any)}>
                  <Text style={s.witnessMoreText}>+{witnessRequests.length - 3} {language === 'fr' ? 'autre(s)' : 'more'}</Text>
                  <MaterialIcons name="chevron-right" size={14} color="#F59E0B" />
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {/* ========== WEEKLY LEADERBOARD BANNER ========== */}
        {!weeklyBannerLoaded ? (
          <Animated.View entering={FadeIn.duration(300)} style={[s.section, s.weeklyBannerWrap, isTablet && s.sectionTablet]}>
            <BannerSkeleton />
          </Animated.View>
        ) : weeklyRank ? (
          <Animated.View entering={FadeIn.duration(400).delay(180)} style={[s.section, s.weeklyBannerWrap, isTablet && s.sectionTablet]}>
            <Pressable style={s.weeklyBanner} onPress={() => router.push('/leaderboard' as any)}>
              <LinearGradient colors={['#1E3A8A', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.weeklyBannerGradient}>
                <View style={s.weeklyBannerLeft}>
                  <View style={s.weeklyBannerIconBg}>
                    <MaterialIcons name="leaderboard" size={20} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.weeklyBannerTitle}>
                      {(extraTranslations.weeklyLeaderboard?.weeklyLeaderboard as any)?.[language] || 'Weekly Leaderboard'}
                    </Text>
                    <Text style={s.weeklyBannerSub}>
                      {weeklyRank.matchesThisWeek} {t('leaderboard', 'matches')} {language === 'fr' ? 'cette semaine' : 'this week'}
                    </Text>
                  </View>
                </View>
                <View style={s.weeklyBannerRight}>
                  <Text style={s.weeklyBannerRank}>#{weeklyRank.rank}</Text>
                  {weeklyRank.direction === 'up' ? (
                    <View style={s.weeklyBannerChange}><MaterialIcons name="arrow-upward" size={14} color="#34D399" /><Text style={[s.weeklyBannerChangeText, { color: '#34D399' }]}>+{weeklyRank.diff}</Text></View>
                  ) : weeklyRank.direction === 'down' ? (
                    <View style={s.weeklyBannerChange}><MaterialIcons name="arrow-downward" size={14} color="#F87171" /><Text style={[s.weeklyBannerChangeText, { color: '#F87171' }]}>-{weeklyRank.diff}</Text></View>
                  ) : weeklyRank.direction === 'new' ? (
                    <View style={[s.weeklyBannerChange, { backgroundColor: 'rgba(96,165,250,0.2)' }]}><Text style={[s.weeklyBannerChangeText, { color: '#60A5FA', fontSize: 10 }]}>NEW</Text></View>
                  ) : (
                    <View style={s.weeklyBannerChange}><Text style={[s.weeklyBannerChangeText, { color: 'rgba(255,255,255,0.5)' }]}>=</Text></View>
                  )}
                  <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ========== SPONSOR BANNER ========== */}
        {!ambassadorsLoaded ? (
          <View style={[s.section, s.sponsorWrap, isTablet && s.sectionTablet]}><SponsorSkeleton /></View>
        ) : null}
        <View style={s.sponsorWrap}>
          <SponsorBanner style={{ marginHorizontal: 16, marginBottom: 20 }} page="home" />
        </View>

        {/* ========== LEADERBOARD PROGRESS ========== */}
        {selfPlayer?.isPublic && totalMatches < LEADERBOARD_MIN_MATCHES ? (
          <Animated.View entering={FadeIn.duration(400).delay(220)} style={[s.section, isTablet && s.sectionTablet]}>
            <Pressable style={s.progressCard} onPress={() => router.push('/leaderboard' as any)}>
              <View style={s.progressHeader}>
                <View style={s.progressIconBg}><MaterialIcons name="leaderboard" size={16} color="#D97706" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.progressTitle}>{t('leaderboard', 'progressTitle')}</Text>
                  <Text style={s.progressCount}>{totalMatches}/{LEADERBOARD_MIN_MATCHES} {t('leaderboard', 'matches')}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#D97706" />
              </View>
              <View style={s.progressBarTrack}>
                <View style={[s.progressBarFill, { width: `${Math.min((totalMatches / LEADERBOARD_MIN_MATCHES) * 100, 100)}%` }]} />
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ========== COMMUNITY LEADERBOARD ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(260)} style={[s.section, s.leaderboardWrap, isTablet && s.sectionTablet]}>
          <CommunityLeaderboard />
        </Animated.View>

        <View style={s.divider}><View style={s.dividerLine} /><View style={s.dividerDot} /><View style={s.dividerLine} /></View>

        {/* ========== UNIFIED UPCOMING TIMELINE ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(300)} style={[s.section, s.timelineWrap, isTablet && s.sectionTablet]}>
          <UpcomingTimeline
            tournaments={tournaments}
            meetups={meetups}
            upcomingEvents={upcomingEvents}
            meetupsLoading={meetupsLoading}
            eventsLoading={eventsLoading}
            pendingInviteCount={pendingInviteCount}
            language={language}
            t={t}
            now={now}
            onShowJoinMeetup={() => setShowJoinMeetupModal(true)}
            onShowMeetupList={() => setShowMeetupListModal(true)}
          />
        </Animated.View>

        <View style={s.divider}><View style={s.dividerLine} /><View style={s.dividerDot} /><View style={s.dividerLine} /></View>

        {/* ========== AMBASSADORS ROTATING BANNER ========== */}
        {ambassadorsLoaded && featuredAmbassadors.length > 0 ? (
          <Animated.View entering={FadeIn.duration(400).delay(340)} style={[s.section, isTablet && s.sectionTablet]}>
            <AmbassadorBanner
              ambassadors={featuredAmbassadors}
              language={language}
              t={t}
              screenWidth={screenWidth}
              userId={user?.id}
            />
          </Animated.View>
        ) : null}

        <View style={s.divider}><View style={s.dividerLine} /><View style={s.dividerDot} /><View style={s.dividerLine} /></View>

        {/* ========== COMPACT HISTORY ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(380)} style={[s.section, isTablet && s.sectionTablet]}>
          {(matches.length === 0 && challenges.length === 0) ? (
            <View style={s.emptyCard}>
              <View style={s.emptyIconBg}><MaterialIcons name="sports" size={44} color={theme.primary} /></View>
              <Text style={s.emptyTitle}>{t('home', 'welcomeTitle')}</Text>
              <Text style={s.emptyText}>{t('home', 'welcomeText')}</Text>
              <Pressable style={s.emptyCta} onPress={() => router.push('/match/new')}>
                <MaterialIcons name="play-arrow" size={20} color="#FFF" />
                <Text style={s.emptyCtaText}>{t('home', 'firstMatch')}</Text>
              </Pressable>
            </View>
          ) : (
            <CompactHistory
              recentResults={recentResults}
              matches={matches}
              hasData={matches.length > 0 || challenges.length > 0}
              language={language}
              t={t}
            />
          )}
        </Animated.View>

      </ScrollView>

      {/* ========== MEETUP LIST MODAL ========== */}
      <Modal visible={showMeetupListModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMeetupListModal(false)}>
        <SafeAreaView style={s.meetupModalContainer}>
          <View style={s.meetupModalHeader}>
            <View style={s.meetupModalHeaderLeft}><View style={s.meetupModalIconBg}><MaterialIcons name="event" size={20} color={theme.accent} /></View><Text style={s.meetupModalTitle}>{t('meetup', 'upcomingMeetups')}</Text></View>
            <Pressable style={s.meetupModalCloseBtn} onPress={() => setShowMeetupListModal(false)}><MaterialIcons name="close" size={24} color={theme.textPrimary} /></Pressable>
          </View>
          <FlatList data={meetups} keyExtractor={meetupKeyExtractor} renderItem={renderMeetupModalItem} style={s.meetupModalScroll} contentContainerStyle={s.meetupModalScrollContent} showsVerticalScrollIndicator={false} initialNumToRender={10} />
        </SafeAreaView>
      </Modal>

      {/* ========== JOIN MEETUP MODAL ========== */}
      <JoinMeetupModal visible={showJoinMeetupModal} onClose={() => setShowJoinMeetupModal(false)} />

      {/* ========== QR CODE SHARE MODAL ========== */}
      <QRShareModal visible={showQRModal} onClose={() => setShowQRModal(false)} />

      {/* ========== TOURNAMENT PICKER MODAL ========== */}
      <TournamentPickerModal visible={showTournamentPicker} onClose={() => setShowTournamentPicker(false)} tournaments={tournaments} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollView: { flex: 1 },
  scrollContent: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', gap: 0 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTablet: { marginBottom: 28 },

  // ===== HERO =====
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

  // ===== ACTIONS =====
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionsRowTablet: { gap: 16 },
  actionCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 18, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', ...Platform.select({ ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 }, default: {} }) },
  actionCardTablet: { padding: 24, borderRadius: 22 },
  actionIconBg: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  actionLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  actionSub: { fontSize: 11, color: theme.textSecondary },

  // ===== WEEKLY BANNER =====
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

  // ===== PROGRESS =====
  progressCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#D97706' + '20', ...theme.shadows.card },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  progressIconBg: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#D97706' + '12', alignItems: 'center', justifyContent: 'center' },
  progressTitle: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  progressCount: { fontSize: 11, fontWeight: '600', color: '#D97706', marginTop: 1 },
  progressBarTrack: { height: 6, backgroundColor: '#D97706' + '12', borderRadius: 3, overflow: 'hidden' as const },
  progressBarFill: { height: '100%', backgroundColor: '#D97706', borderRadius: 3 },

  // ===== EMPTY STATE =====
  emptyCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 32, alignItems: 'center', ...theme.shadows.card },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyCtaText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // ===== WITNESS ALERTS =====
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

  // ===== MODALS =====
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

  // ===== ASYNC SECTION WRAPPERS (fixed minHeight to prevent layout shift) =====
  weeklyBannerWrap: { minHeight: 68 },
  sponsorWrap: { minHeight: 60 },
  leaderboardWrap: { minHeight: 380 },
  timelineWrap: { minHeight: 230 },

  // ===== SECTION DIVIDERS =====
  divider: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1', marginHorizontal: 12 },
});
