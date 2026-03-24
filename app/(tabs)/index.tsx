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
  TextInput,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import theme, { blurhash } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { preloadInterstitial } from '@/services/adService';
import CommunityLeaderboard from '@/components/ui/CommunityLeaderboard';
import SponsorBanner from '@/components/ui/SponsorBanner';
import { getFeaturedAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';
import { getMyMeetups, getInvitedMeetups, getMeetupResponses, getPendingInvitationsCount, findMeetupByCode, Meetup, MeetupResponse } from '@/services/meetupService';
import { config } from '@/constants/config';
import { Share as RNShare } from 'react-native';
import { LEADERBOARD_MIN_MATCHES } from '@/services/leaderboardService';
import { getMatchValidationLevel, getValidationColor, getValidationIcon, getValidationLabel } from '@/services/trustScoreService';
import { fetchWeeklyLeaderboard, getCurrentWeekStart, formatDateISO } from '@/services/weeklyLeaderboardService';
import { extraTranslations } from '@/constants/i18nExtra';
import { getPendingWitnessRequests, getUnreadEventNotificationCount, markEventNotificationRead, EventNotification } from '@/services/eventNotificationService';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, tournaments, matches, challenges, selfPlayer, refreshData } = useApp();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'À venir' | 'En cours' | 'Terminé'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Ambassadors state
  const [featuredAmbassadors, setFeaturedAmbassadors] = useState<Ambassador[]>([]);
  const [ambassadorsLoaded, setAmbassadorsLoaded] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerScrollRef = useRef<ScrollView>(null);
  const bannerAutoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Meetups state
  const [meetups, setMeetups] = useState<(Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number; _maxParticipants?: number })[]>([]);
  const [meetupsLoading, setMeetupsLoading] = useState(true);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [showJoinMeetupModal, setShowJoinMeetupModal] = useState(false);
  const [showMeetupListModal, setShowMeetupListModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Witness attestation alerts
  const [witnessRequests, setWitnessRequests] = useState<EventNotification[]>([]);
  const [eventNotifCount, setEventNotifCount] = useState(0);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const { showAlert } = useAlert();

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

  // Load pending witness requests
  // Pending witness count from match_witness_requests table
  const [pendingWitnessMatchCount, setPendingWitnessMatchCount] = useState(0);

  const loadWitnessRequests = useCallback(async () => {
    const [{ requests }, count] = await Promise.all([
      getPendingWitnessRequests(),
      getUnreadEventNotificationCount(),
    ]);
    setWitnessRequests(requests);
    setEventNotifCount(count);
    // Also count match witness requests
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

  useEffect(() => {
    const loadPending = () => { getPendingInvitationsCount().then(setPendingInviteCount); };
    loadPending();
    const interval = setInterval(loadPending, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshData(), loadMeetups(), loadWitnessRequests()]);
    setRefreshing(false);
  };

  // Load featured ambassadors
  useEffect(() => {
    getFeaturedAmbassadors().then((ambassadors) => {
      setFeaturedAmbassadors(ambassadors);
      setAmbassadorsLoaded(true);
    });
  }, []);

  // Auto-rotate ambassador banner
  useEffect(() => {
    if (featuredAmbassadors.length <= 1) return;
    bannerAutoplayRef.current = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % featuredAmbassadors.length;
        bannerScrollRef.current?.scrollTo({ x: next * (screenWidth - 32), animated: true });
        return next;
      });
    }, 5000);
    return () => { if (bannerAutoplayRef.current) clearInterval(bannerAutoplayRef.current); };
  }, [featuredAmbassadors.length, screenWidth]);

  const handleBannerScroll = useCallback((e: any) => {
    const offset = e.nativeEvent.contentOffset.x;
    const cardW = screenWidth - 32;
    const idx = Math.round(offset / cardW);
    if (idx !== bannerIndex && idx >= 0 && idx < featuredAmbassadors.length) {
      setBannerIndex(idx);
      if (bannerAutoplayRef.current) clearInterval(bannerAutoplayRef.current);
      bannerAutoplayRef.current = setInterval(() => {
        setBannerIndex(prev => {
          const next = (prev + 1) % featuredAmbassadors.length;
          bannerScrollRef.current?.scrollTo({ x: next * (screenWidth - 32), animated: true });
          return next;
        });
      }, 5000);
    }
  }, [bannerIndex, featuredAmbassadors.length, screenWidth]);

  // Track banner impressions (deduplicated per session)
  const trackedBannerImpressions = useRef(new Set<string>());
  useEffect(() => {
    if (featuredAmbassadors.length > 0 && bannerIndex >= 0 && bannerIndex < featuredAmbassadors.length) {
      const amb = featuredAmbassadors[bannerIndex];
      if (amb && !trackedBannerImpressions.current.has(amb.id)) {
        trackedBannerImpressions.current.add(amb.id);
        trackAmbassadorEvent(amb.id, 'banner_impression', undefined, { sourcePage: 'home', viewerId: user?.id });
      }
    }
  }, [bannerIndex, featuredAmbassadors]);

  // Status priority
  const statusOrder: Record<string, number> = { 'En cours': 0, 'À venir': 1, 'Terminé': 2 };
  const filteredTournaments = useMemo(() => {
    const list = statusFilter === 'all' ? [...tournaments] : tournaments.filter(t => t.status === statusFilter);
    return list.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  }, [tournaments, statusFilter]);
  const statusCounts = useMemo(() => ({
    all: tournaments.length,
    'À venir': tournaments.filter(t => t.status === 'À venir').length,
    'En cours': tournaments.filter(t => t.status === 'En cours').length,
    'Terminé': tournaments.filter(t => t.status === 'Terminé').length,
  }), [tournaments]);

  const displayName = user?.username || selfPlayer?.name || user?.email?.split('@')[0] || (language === 'en' ? 'Player' : 'Joueur');

  // Load weekly leaderboard rank for banner
  useEffect(() => {
    if (!user?.id) return;
    const loadWeeklyRank = async () => {
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
        }
      } catch { /* silent */ }
      setWeeklyBannerLoaded(true);
    };
    const timer = setTimeout(loadWeeklyRank, 1500);
    return () => clearTimeout(timer);
  }, [user?.id]);

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

  const nextTournament = useMemo(() => {
    const upcoming = tournaments
      .filter((t: any) => t.status === 'À venir' || t.status === 'En cours')
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] || null;
  }, [tournaments]);

  const countdown = useMemo(() => {
    if (!nextTournament) return null;
    const diff = new Date(nextTournament.date).getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, label: t('notifications', 'todayLabel') };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, label: null };
  }, [nextTournament, now, t]);

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

  const resultColor = (r: string) => r === 'win' ? theme.success : r === 'loss' ? theme.error : r === 'draw' ? theme.warning : theme.textMuted;

  // FlatList renderItem for tournament picker modal
  const renderTournamentPickerItem = useCallback(({ item: tournament }: { item: any }) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      'À venir': { bg: theme.primary + '15', text: theme.primary },
      'En cours': { bg: theme.warning + '15', text: theme.warning },
      'Terminé': { bg: theme.success + '15', text: theme.success },
    };
    const colors = statusColors[tournament.status as keyof typeof statusColors] || statusColors['À venir'];
    return (
      <Pressable key={tournament.id} style={s.tPickerItem} onPress={() => { setShowTournamentPicker(false); router.push(`/tournament/${tournament.id}`); }}>
        <View style={s.tPickerIcon}><MaterialIcons name="emoji-events" size={28} color={theme.carreauColor} /></View>
        <View style={s.tPickerInfo}>
          <Text style={s.tPickerName} numberOfLines={1}>{tournament.name}</Text>
          <View style={s.tPickerMeta}>
            <MaterialIcons name="event" size={12} color={theme.textMuted} />
            <Text style={s.tPickerDate}>{new Date(tournament.date).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            <View style={s.tPickerDot} />
            <Text style={s.tPickerCity}>{tournament.location.city}</Text>
          </View>
          <View style={s.tPickerBadges}>
            <View style={[s.tPickerBadge, { backgroundColor: colors.bg }]}>
              <Text style={[s.tPickerBadgeText, { color: colors.text }]}>
                {tournament.status === 'À venir' ? t('tournamentStatus', 'upcoming') : tournament.status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'completed')}
              </Text>
            </View>
            <View style={[s.tPickerBadge, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[s.tPickerBadgeText, { color: theme.textSecondary }]}>{t('formats', tournament.format)}</Text>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
      </Pressable>
    );
  }, [t, language]);

  // FlatList renderItem for meetup list modal
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
  const tournamentKeyExtractor = useCallback((item: any) => item.id, []);
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
        <Animated.View entering={FadeInDown.duration(450)}>
          <View style={[s.heroWrap, isTablet && s.heroWrapTablet]}>
            {/* Top row */}
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

            {/* Stats chips row */}
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
        <Animated.View entering={FadeInDown.duration(400).delay(60)} style={[s.section, isTablet && s.sectionTablet]}>
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
          <Animated.View entering={FadeInDown.duration(400).delay(70)} style={[s.section, isTablet && s.sectionTablet]}>
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
        {weeklyBannerLoaded && weeklyRank ? (
          <Animated.View entering={FadeInDown.duration(400).delay(75)} style={[s.section, isTablet && s.sectionTablet]}>
            <Pressable
              style={s.weeklyBanner}
              onPress={() => router.push('/leaderboard' as any)}
            >
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
                    <View style={s.weeklyBannerChange}>
                      <MaterialIcons name="arrow-upward" size={14} color="#34D399" />
                      <Text style={[s.weeklyBannerChangeText, { color: '#34D399' }]}>+{weeklyRank.diff}</Text>
                    </View>
                  ) : weeklyRank.direction === 'down' ? (
                    <View style={s.weeklyBannerChange}>
                      <MaterialIcons name="arrow-downward" size={14} color="#F87171" />
                      <Text style={[s.weeklyBannerChangeText, { color: '#F87171' }]}>-{weeklyRank.diff}</Text>
                    </View>
                  ) : weeklyRank.direction === 'new' ? (
                    <View style={[s.weeklyBannerChange, { backgroundColor: 'rgba(96,165,250,0.2)' }]}>
                      <Text style={[s.weeklyBannerChangeText, { color: '#60A5FA', fontSize: 10 }]}>NEW</Text>
                    </View>
                  ) : (
                    <View style={s.weeklyBannerChange}>
                      <Text style={[s.weeklyBannerChangeText, { color: 'rgba(255,255,255,0.5)' }]}>=</Text>
                    </View>
                  )}
                  <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.5)" />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ========== SPONSOR BANNER ========== */}
        <SponsorBanner style={{ marginBottom: 8 }} page="home" />

        {/* ========== LEADERBOARD PROGRESS ========== */}
        {selfPlayer?.isPublic && totalMatches < LEADERBOARD_MIN_MATCHES ? (
          <Animated.View entering={FadeInDown.duration(400).delay(90)} style={[s.section, isTablet && s.sectionTablet]}>
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

        {/* ========== UPCOMING (TOURNAMENT + MEETUPS) ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(120)} style={[s.section, isTablet && s.sectionTablet]}>
          <View style={s.sectionHeaderRow}>
            <MaterialIcons name="event-note" size={18} color={theme.primary} />
            <Text style={s.sectionTitle}>{t('home', 'upcoming')}</Text>
          </View>

          <View style={s.upcomingColumnsRow}>
            {/* Tournament Column */}
            <View style={s.upcomingCol}>
              {nextTournament ? (
                <Pressable style={({ pressed }) => [s.tournamentCard, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]} onPress={() => router.push(`/tournament/${nextTournament.id}`)}>
                  <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={s.tournamentCardInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={s.tournamentHeader}>
                      <View style={s.tournamentIconBg}><MaterialIcons name="emoji-events" size={18} color="#B45309" /></View>
                      <Text style={s.tournamentBadge}>{nextTournament.status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'upcoming')}</Text>
                    </View>
                    <Text style={s.tournamentName} numberOfLines={2}>{nextTournament.name}</Text>
                    <View style={s.tournamentMeta}>
                      <MaterialIcons name="place" size={11} color="#92400E" />
                      <Text style={s.tournamentCity} numberOfLines={1}>{nextTournament.location?.city || ''}</Text>
                    </View>
                    <Text style={s.tournamentDate}>{new Date(nextTournament.date).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}</Text>
                    {countdown ? (
                      <View style={s.countdownRow}>
                        {countdown.label ? (
                          <View style={s.countdownTodayBadge}><MaterialIcons name="local-fire-department" size={13} color="#B45309" /><Text style={s.countdownTodayText}>{countdown.label}</Text></View>
                        ) : (
                          <>
                            <View style={s.countdownUnit}><Text style={s.countdownValue}>{countdown.days}</Text><Text style={s.countdownUnitLabel}>{language === 'fr' ? 'j' : 'd'}</Text></View>
                            <Text style={s.countdownSep}>:</Text>
                            <View style={s.countdownUnit}><Text style={s.countdownValue}>{countdown.hours}</Text><Text style={s.countdownUnitLabel}>h</Text></View>
                            <Text style={s.countdownSep}>:</Text>
                            <View style={s.countdownUnit}><Text style={s.countdownValue}>{countdown.minutes}</Text><Text style={s.countdownUnitLabel}>min</Text></View>
                          </>
                        )}
                      </View>
                    ) : null}
                  </LinearGradient>
                </Pressable>
              ) : (
                <View style={s.emptyColCard}>
                  <View style={s.emptyColIconBg}><MaterialIcons name="emoji-events" size={26} color={theme.textMuted} /></View>
                  <Text style={s.emptyColText}>{t('home', 'noTournament')}</Text>
                  <Pressable style={s.emptyColBtn} onPress={() => router.push('/tournament/new')}><MaterialIcons name="add" size={14} color="#FFF" /></Pressable>
                </View>
              )}
            </View>

            {/* Meetups Column */}
            <View style={s.upcomingCol}>
              <View style={s.meetupColHeader}>
                <View style={s.meetupColTitleRow}><MaterialIcons name="event" size={13} color={theme.accent} /><Text style={s.meetupColTitle}>{t('history', 'meetups')}</Text></View>
                <View style={s.meetupColActions}>
                  {pendingInviteCount > 0 ? (
                    <Pressable style={s.meetupColActionBtn} onPress={() => router.push('/meetup/invitations' as any)}>
                      <MaterialIcons name="mail" size={12} color={theme.error} />
                      <View style={s.meetupColBadge}><Text style={s.meetupColBadgeText}>{pendingInviteCount > 9 ? '9+' : pendingInviteCount}</Text></View>
                    </Pressable>
                  ) : null}
                  <Pressable style={[s.meetupColActionBtn, { backgroundColor: theme.accent }]} onPress={() => setShowJoinMeetupModal(true)}><MaterialIcons name="qr-code" size={14} color="#FFF" /></Pressable>
                  <Pressable style={[s.meetupColActionBtn, { backgroundColor: theme.primary }]} onPress={() => router.push('/meetup/new' as any)}><MaterialIcons name="add" size={14} color="#FFF" /></Pressable>
                </View>
              </View>
              {meetups.length > 0 ? (
                <View style={s.meetupColList}>
                  {meetups.slice(0, 2).map((m) => {
                    const mDate = new Date(m.date);
                    const daysUntil = Math.max(0, Math.ceil((mDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    return (
                      <Pressable key={m.id} style={({ pressed }) => [s.meetupColItem, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/meetup/${m.id}` as any)}>
                        <View style={s.meetupColDateBox}>
                          <Text style={s.meetupColDateDay}>{mDate.getDate()}</Text>
                          <Text style={s.meetupColDateMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                        </View>
                        <View style={s.meetupColInfo}>
                          <Text style={s.meetupColItemTitle} numberOfLines={1}>{m.title}</Text>
                          <View style={s.meetupColItemMeta}>
                            <Text style={s.meetupColItemTime}>{mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                            {daysUntil <= 1 ? <View style={s.meetupColSoonBadge}><Text style={s.meetupColSoonText}>{daysUntil === 0 ? t('notifications', 'todayLabel') : t('notifications', 'tomorrowLabel')}</Text></View> : null}
                          </View>
                          <View style={s.meetupColItemBottom}>
                            <MaterialIcons name="group" size={11} color="#0369A1" />
                            <Text style={s.meetupColParticipants}>{m._acceptedCount || 0}/{m._maxParticipants || 8}</Text>
                            {m._source === 'created' ? <View style={s.meetupColCreatorDot}><MaterialIcons name="person" size={8} color={theme.primary} /></View> : <View style={s.meetupColInvitedDot}><MaterialIcons name="mail" size={8} color={theme.accent} /></View>}
                          </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={16} color="#0369A1" />
                      </Pressable>
                    );
                  })}
                  {meetups.length > 2 ? (
                    <Pressable style={({ pressed }) => [s.meetupColMoreLink, pressed && { opacity: 0.7 }]} onPress={() => setShowMeetupListModal(true)}>
                      <Text style={s.meetupColMoreText}>+{meetups.length - 2} {language === 'fr' ? 'autre(s)' : 'more'}</Text>
                      <MaterialIcons name="chevron-right" size={14} color={theme.accent} />
                    </Pressable>
                  ) : null}
                </View>
              ) : !meetupsLoading ? (
                <View style={s.meetupColEmpty}>
                  <MaterialIcons name="event-available" size={22} color={theme.textMuted} />
                  <Text style={s.meetupColEmptyText}>{t('meetup', 'noMeetups')}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>

        {/* ========== COMPACT HISTORY ========== */}
        {recentResults.length > 0 ? (
          <Animated.View entering={FadeIn.duration(400).delay(180)} style={[s.section, isTablet && s.sectionTablet]}>
            <View style={s.sectionHeaderRow}>
              <MaterialIcons name="history" size={18} color={theme.primary} />
              <Text style={s.sectionTitle}>{t('history', 'history')}</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => router.push('/history')} style={s.seeAllBtn}>
                <Text style={s.seeAllText}>{t('common', 'seeAll')}</Text>
                <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
              </Pressable>
            </View>
            <View style={s.historyList}>
              {recentResults.map((item, idx) => {
                const d = new Date(item.date);
                const isLast = idx === recentResults.length - 1;
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [s.hcRow, !isLast && s.hcRowBorder, pressed && { opacity: 0.75, backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => item.type === 'match' ? router.push({ pathname: '/history', params: { openMatchId: item.id } }) : router.push({ pathname: '/history', params: { openChallengeId: item.id } })}
                  >
                    <View style={[s.hcDot, { backgroundColor: resultColor(item.result) }]} />
                    <View style={[s.hcTypeIcon, { backgroundColor: (item.type === 'match' ? theme.primary : theme.accent) + '12' }]}>
                      <MaterialIcons name={item.icon} size={14} color={item.type === 'match' ? theme.primary : theme.accent} />
                    </View>
                    <View style={s.hcInfo}>
                      <Text style={s.hcTitle} numberOfLines={1}>{item.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Text style={s.hcSub} numberOfLines={1}>{item.subtitle} {' \u2022 '} {d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Text>
                        {item.type === 'match' ? (() => {
                          const match = matches.find((m: any) => m.id === item.id);
                          const pIds = (match as any)?.participantUserIds || [];
                          const vLevel = getMatchValidationLevel(Array.isArray(pIds) ? pIds.length : 0);
                          const vColor = getValidationColor(vLevel);
                          return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: vColor + '12', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                              <MaterialIcons name={getValidationIcon(vLevel) as any} size={9} color={vColor} />
                              <Text style={{ fontSize: 8, fontWeight: '700', color: vColor }}>{vLevel === 'solo' ? '0.3x' : vLevel === 'shared_2' ? '1x' : vLevel === 'shared_3plus' ? '1.5x' : '2x'}</Text>
                            </View>
                          );
                        })() : null}
                      </View>
                    </View>
                    <Text style={[s.hcScore, { color: resultColor(item.result) }]}>{item.score}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : (matches.length === 0 && challenges.length === 0) ? (
          <Animated.View entering={FadeIn.duration(500).delay(180)} style={[s.emptyCard, isTablet && s.emptyCardTablet]}>
            <View style={s.emptyIconBg}><MaterialIcons name="sports" size={44} color={theme.primary} /></View>
            <Text style={s.emptyTitle}>{t('home', 'welcomeTitle')}</Text>
            <Text style={s.emptyText}>{t('home', 'welcomeText')}</Text>
            <Pressable style={s.emptyCta} onPress={() => router.push('/match/new')}>
              <MaterialIcons name="play-arrow" size={20} color="#FFF" />
              <Text style={s.emptyCtaText}>{t('home', 'firstMatch')}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ========== COMMUNITY LEADERBOARD ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(220)} style={[s.section, isTablet && s.sectionTablet]}>
          <CommunityLeaderboard />
        </Animated.View>

        {/* ========== AMBASSADORS ROTATING BANNER ========== */}
        {ambassadorsLoaded && featuredAmbassadors.length > 0 ? (
          <Animated.View entering={FadeIn.duration(400).delay(300)} style={[s.section, isTablet && s.sectionTablet, { marginTop: 20 }]}>
            <View style={s.sectionHeaderRow}>
              <View style={s.ambassadorIcon}><MaterialIcons name="verified" size={16} color="#7C3AED" /></View>
              <Text style={s.sectionTitle}>{language === 'fr' ? 'Ambassadeurs' : 'Ambassadors'}</Text>
              <View style={{ flex: 1 }} />
              <Pressable style={s.seeAllBtn} onPress={() => router.push('/ambassadors' as any)}>
                <Text style={[s.seeAllText, { color: '#7C3AED' }]}>{t('common', 'seeAll')}</Text>
                <MaterialIcons name="chevron-right" size={16} color="#7C3AED" />
              </Pressable>
            </View>

            <View style={s.bannerCarousel}>
              <ScrollView
                ref={bannerScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleBannerScroll}
                scrollEventThrottle={16}
                decelerationRate="fast"
                snapToInterval={screenWidth - 32}
                snapToAlignment="start"
              >
                {featuredAmbassadors.map((amb) => (
                  <Pressable
                    key={amb.id}
                    style={[s.bannerSlide, { width: screenWidth - 32 }]}
                    onPress={() => amb.playerId ? router.push(`/player/${amb.playerId}` as any) : router.push({ pathname: '/ambassadors', params: { scrollTo: amb.id } } as any)}
                  >
                    <LinearGradient colors={['#7C3AED', '#9333EA', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bannerGradient}>
                      <View style={s.bannerSponsorTag}><MaterialIcons name="campaign" size={10} color="rgba(255,255,255,0.7)" /><Text style={s.bannerSponsorText}>{language === 'fr' ? 'Ambassadeur' : 'Ambassador'}</Text></View>
                      <View style={s.bannerContent}>
                        <View style={s.bannerAvatarWrap}>
                          {amb.photo ? (
                            <Image source={{ uri: amb.photo }} style={s.bannerAvatar} contentFit="cover" transition={300} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                          ) : (
                            <View style={[s.bannerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                              <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFF' }}>{amb.displayName.charAt(0)}</Text>
                            </View>
                          )}
                          <View style={s.bannerVerifiedIcon}><MaterialIcons name="verified" size={14} color="#FFF" /></View>
                        </View>
                        <View style={s.bannerInfo}>
                          <Text style={s.bannerName} numberOfLines={1}>{amb.displayName}</Text>
                          {amb.bio ? <Text style={s.bannerBio} numberOfLines={2}>{amb.bio}</Text> : amb.role ? <Text style={s.bannerBio} numberOfLines={1}>{t('roles', amb.role)}{amb.club ? ` \u2022 ${amb.club}` : ''}</Text> : null}
                          {amb.stats ? (
                            <View style={s.bannerStatsRow}>
                              <View style={s.bannerStatItem}><Text style={s.bannerStatVal}>{amb.stats.winRate}%</Text><Text style={s.bannerStatLbl}>{language === 'fr' ? 'Vict.' : 'Win'}</Text></View>
                              <View style={s.bannerStatDivider} />
                              <View style={s.bannerStatItem}><Text style={s.bannerStatVal}>{amb.stats.matchesPlayed}</Text><Text style={s.bannerStatLbl}>{language === 'fr' ? 'Matchs' : 'Matches'}</Text></View>
                              {amb.stats.tirRate > 0 ? (<><View style={s.bannerStatDivider} /><View style={s.bannerStatItem}><Text style={s.bannerStatVal}>{amb.stats.tirRate}%</Text><Text style={s.bannerStatLbl}>Tir</Text></View></>) : null}
                            </View>
                          ) : null}
                          <View style={s.bannerSocialsRow}>
                            {amb.youtubeUrl ? <View style={s.bannerSocialChip}><MaterialIcons name="play-arrow" size={11} color="#FFF" /><Text style={s.bannerSocialChipText}>YouTube</Text></View> : null}
                            {amb.instagramHandle ? <View style={s.bannerSocialChip}><MaterialIcons name="camera-alt" size={11} color="#FFF" /><Text style={s.bannerSocialChipText}>@{amb.instagramHandle.replace('@', '').substring(0, 10)}</Text></View> : null}
                            {amb.tiktokUrl ? <View style={s.bannerSocialChip}><MaterialIcons name="music-note" size={11} color="#FFF" /><Text style={s.bannerSocialChipText}>TikTok</Text></View> : null}
                          </View>
                        </View>
                      </View>
                      <View style={s.bannerCta}><Text style={s.bannerCtaText}>{language === 'fr' ? 'Voir le profil' : 'View profile'}</Text><MaterialIcons name="arrow-forward" size={14} color="rgba(255,255,255,0.8)" /></View>
                    </LinearGradient>
                  </Pressable>
                ))}
              </ScrollView>
              {featuredAmbassadors.length > 1 ? (
                <View style={s.bannerDots}>
                  {featuredAmbassadors.map((_, i) => (
                    <Pressable key={i} style={[s.bannerDot, i === bannerIndex && s.bannerDotActive]} onPress={() => { setBannerIndex(i); bannerScrollRef.current?.scrollTo({ x: i * (screenWidth - 32), animated: true }); if (bannerAutoplayRef.current) clearInterval(bannerAutoplayRef.current); bannerAutoplayRef.current = setInterval(() => { setBannerIndex(prev => { const next = (prev + 1) % featuredAmbassadors.length; bannerScrollRef.current?.scrollTo({ x: next * (screenWidth - 32), animated: true }); return next; }); }, 5000); }} hitSlop={8} />
                  ))}
                </View>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

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
      <Modal visible={showJoinMeetupModal} animationType="slide" transparent onRequestClose={() => setShowJoinMeetupModal(false)}>
        <View style={s.joinOverlay}>
          <View style={s.joinContent}>
            <View style={s.joinHeader}><Text style={s.joinTitle}>{t('meetup', 'joinMeetup')}</Text><Pressable style={s.joinClose} onPress={() => setShowJoinMeetupModal(false)}><MaterialIcons name="close" size={22} color={theme.textSecondary} /></Pressable></View>
            <Text style={s.joinDesc}>{t('meetup', 'enterMeetupCode')}</Text>
            <TextInput style={s.joinInput} value={joinCode} onChangeText={setJoinCode} placeholder={t('meetup', 'enterCodePlaceholder')} placeholderTextColor={theme.textMuted} autoCapitalize="characters" autoFocus />
            <Pressable style={[s.joinBtn, (!joinCode.trim() || joinLoading) && { opacity: 0.5 }]} disabled={!joinCode.trim() || joinLoading} onPress={async () => { setJoinLoading(true); const { meetup: found } = await findMeetupByCode(joinCode.trim()); setJoinLoading(false); if (found) { setShowJoinMeetupModal(false); setJoinCode(''); router.push(`/meetup/${found.id}` as any); } else { showAlert(t('common', 'error'), t('meetup', 'invalidCode')); } }}>
              {joinLoading ? <ActivityIndicator size="small" color="#FFF" /> : (<><MaterialIcons name="search" size={20} color="#FFF" /><Text style={s.joinBtnText}>{t('meetup', 'joinMeetup')}</Text></>)}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========== QR CODE SHARE MODAL ========== */}
      <Modal visible={showQRModal} animationType="slide" transparent onRequestClose={() => setShowQRModal(false)}>
        <View style={s.qrOverlay}>
          <View style={s.qrContent}>
            <View style={s.qrHeader}><Text style={s.qrHeaderTitle}>{t('home', 'shareAppTitle')}</Text><Pressable style={s.qrCloseBtn} onPress={() => setShowQRModal(false)}><MaterialIcons name="close" size={22} color={theme.textSecondary} /></Pressable></View>
            <View style={s.qrBody}>
              <View style={s.qrCodeWrapper}><View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 12 }}><MaterialIcons name="qr-code-2" size={80} color="#1E3A8A" /><Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 12 }} numberOfLines={2}>{config.appDownloadUrl}</Text></View></View>
              <Text style={s.qrAppName}>Ultimate Petanque</Text>
              <Text style={s.qrDesc}>{t('home', 'shareAppDesc')}</Text>
              <View style={s.qrNote}><MaterialIcons name="people" size={18} color={theme.success} /><Text style={s.qrNoteText}>{t('home', 'shareAppNote')}</Text></View>
            </View>
            <View style={s.qrActions}>
              <Pressable style={s.qrCopyBtn} onPress={async () => { try { const Clipboard = require('expo-clipboard'); await Clipboard.setStringAsync(config.appDownloadUrl); } catch { try { await RNShare.share({ message: config.appDownloadUrl }); } catch {} } showAlert(t('home', 'linkCopied')); }}>
                <MaterialIcons name="content-copy" size={18} color={theme.primary} /><Text style={s.qrCopyBtnText}>{t('home', 'copyLink')}</Text>
              </Pressable>
              <Pressable style={s.qrDoneBtn} onPress={() => setShowQRModal(false)}><Text style={s.qrDoneBtnText}>{t('common', 'close')}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========== TOURNAMENT PICKER MODAL ========== */}
      <Modal visible={showTournamentPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTournamentPicker(false)}>
        <SafeAreaView style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Pressable style={s.modalCloseBtn} onPress={() => setShowTournamentPicker(false)}><MaterialIcons name="close" size={24} color={theme.textPrimary} /></Pressable>
            <Text style={s.modalTitle}>{t('home', 'myTournaments')}</Text>
            <Pressable style={s.modalAddBtn} onPress={() => { setShowTournamentPicker(false); router.push('/tournament/new'); }}><MaterialIcons name="add" size={24} color={theme.primary} /></Pressable>
          </View>
          {tournaments.length > 0 ? (
            <FlatList
              data={filteredTournaments}
              keyExtractor={tournamentKeyExtractor}
              renderItem={renderTournamentPickerItem}
              style={s.modalContent}
              contentContainerStyle={s.modalScrollContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              ListHeaderComponent={
                <View style={s.statusFilterRow}>
                  {(['all', 'À venir', 'En cours', 'Terminé'] as const).map((status) => {
                    const isActive = statusFilter === status;
                    const statusConfig: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = { 'all': { icon: 'layers', color: theme.textSecondary }, 'À venir': { icon: 'event', color: theme.primary }, 'En cours': { icon: 'play-circle-filled', color: theme.warning }, 'Terminé': { icon: 'check-circle', color: theme.success } };
                    const cfg = statusConfig[status];
                    return (
                      <Pressable key={status} style={[s.statusChip, isActive && { backgroundColor: cfg.color, borderColor: cfg.color }]} onPress={() => setStatusFilter(status)}>
                        <MaterialIcons name={cfg.icon} size={14} color={isActive ? '#FFF' : cfg.color} />
                        <Text style={[s.statusChipText, isActive && { color: '#FFF' }, !isActive && { color: cfg.color }]}>{status === 'all' ? t('common', 'all') : status === 'À venir' ? t('tournamentStatus', 'upcoming') : status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'completed')}</Text>
                        <View style={[s.statusChipCount, isActive && { backgroundColor: 'rgba(255,255,255,0.25)' }]}><Text style={[s.statusChipCountText, isActive && { color: '#FFF' }]}>{statusCounts[status]}</Text></View>
                      </Pressable>
                    );
                  })}
                </View>
              }
              ListEmptyComponent={<View style={s.emptyFilter}><MaterialIcons name="filter-list-off" size={40} color={theme.textMuted} /><Text style={s.emptyFilterText}>{t('home', 'noTournamentFilter')}</Text><Pressable style={s.resetFilterBtn} onPress={() => setStatusFilter('all')}><Text style={s.resetFilterText}>{t('common', 'seeAll')}</Text></Pressable></View>}
            />
          ) : (
            <ScrollView style={s.modalContent} contentContainerStyle={s.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={s.emptyTournament}>
                <View style={s.emptyTournamentIcon}><MaterialIcons name="emoji-events" size={56} color={theme.carreauColor} /></View>
                <Text style={s.emptyTournamentTitle}>{t('home', 'noTournament')}</Text>
                <Text style={s.emptyTournamentText}>{t('home', 'noTournamentText')}</Text>
                <Pressable style={s.createTournamentBtn} onPress={() => { setShowTournamentPicker(false); router.push('/tournament/new'); }}>
                  <MaterialIcons name="add" size={20} color="#FFF" /><Text style={s.createTournamentBtnText}>{t('home', 'createTournament')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollView: { flex: 1 },
  scrollContent: { maxWidth: 960, alignSelf: 'center' as const, width: '100%' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTablet: { marginBottom: 32 },

  // ===== SECTION HEADER =====
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, fontWeight: '600', color: theme.primary },

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

  // Stats chips
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

  // ===== UPCOMING 2-COL =====
  upcomingColumnsRow: { flexDirection: 'row', gap: 10 },
  upcomingCol: { flex: 1 },

  // Tournament card
  tournamentCard: { borderRadius: 18, overflow: 'hidden', ...theme.shadows.cardElevated, flex: 1 },
  tournamentCardInner: { padding: 14, flex: 1 },
  tournamentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  tournamentIconBg: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(180,83,9,0.1)', alignItems: 'center', justifyContent: 'center' },
  tournamentBadge: { fontSize: 9, fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  tournamentName: { fontSize: 14, fontWeight: '800', color: '#78350F', marginBottom: 5, lineHeight: 19 },
  tournamentMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  tournamentCity: { fontSize: 11, fontWeight: '600', color: '#92400E', flex: 1 },
  tournamentDate: { fontSize: 11, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(180,83,9,0.06)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 8 },
  countdownUnit: { alignItems: 'center' },
  countdownValue: { fontSize: 18, fontWeight: '900', color: '#78350F' },
  countdownUnitLabel: { fontSize: 8, fontWeight: '700', color: '#92400E', textTransform: 'uppercase' },
  countdownSep: { fontSize: 15, fontWeight: '700', color: '#92400E', marginHorizontal: 1 },
  countdownTodayBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(180,83,9,0.12)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  countdownTodayText: { fontSize: 12, fontWeight: '800', color: '#78350F' },
  emptyColCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1, borderWidth: 1, borderColor: '#E2E8F0', minHeight: 160 },
  emptyColIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.carreauColor + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyColText: { fontSize: 12, color: theme.textMuted, fontWeight: '500', textAlign: 'center', marginBottom: 10 },
  emptyColBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.carreauColor, alignItems: 'center', justifyContent: 'center' },

  // Meetup column
  meetupColHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  meetupColTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meetupColTitle: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  meetupColActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meetupColActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  meetupColBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: theme.error, minWidth: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  meetupColBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFF' },
  meetupColList: { flex: 1, gap: 6, backgroundColor: '#F0F9FF', borderRadius: 14, padding: 8 },
  meetupColItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', borderRadius: 12, padding: 8, gap: 8 },
  meetupColDateBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(3,105,161,0.1)', alignItems: 'center', justifyContent: 'center' },
  meetupColDateDay: { fontSize: 16, fontWeight: '900', color: '#0369A1', lineHeight: 18 },
  meetupColDateMonth: { fontSize: 7, fontWeight: '700', color: '#0369A1', letterSpacing: 0.3 },
  meetupColInfo: { flex: 1 },
  meetupColItemTitle: { fontSize: 12, fontWeight: '700', color: '#0C4A6E', marginBottom: 2 },
  meetupColItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  meetupColItemTime: { fontSize: 10, fontWeight: '600', color: '#0369A1' },
  meetupColSoonBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  meetupColSoonText: { fontSize: 7, fontWeight: '700', color: '#B45309' },
  meetupColItemBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meetupColParticipants: { fontSize: 10, fontWeight: '600', color: '#0369A1' },
  meetupColCreatorDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' },
  meetupColInvitedDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: theme.accent + '18', alignItems: 'center', justifyContent: 'center' },
  meetupColMoreLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, backgroundColor: theme.accent + '08', borderRadius: 8, borderWidth: 1, borderColor: theme.accent + '18' },
  meetupColMoreText: { fontSize: 11, fontWeight: '600', color: theme.accent },
  meetupColEmpty: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 20, gap: 6, borderWidth: 1, borderColor: '#E2E8F0', flex: 1, justifyContent: 'center', minHeight: 120 },
  meetupColEmptyText: { fontSize: 11, color: theme.textMuted, fontWeight: '500', textAlign: 'center' },

  // ===== HISTORY =====
  historyList: { backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' as const },
  hcRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  hcRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  hcDot: { width: 8, height: 8, borderRadius: 4 },
  hcTypeIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  hcInfo: { flex: 1, marginRight: 4 },
  hcTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  hcSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  hcScore: { fontSize: 16, fontWeight: '900', minWidth: 44, textAlign: 'right' as const },

  // ===== EMPTY STATE =====
  emptyCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 32, alignItems: 'center', marginHorizontal: 16, marginBottom: 24, ...theme.shadows.card },
  emptyCardTablet: { padding: 48, maxWidth: 560, alignSelf: 'center' as const, width: '100%' },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyCtaText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // ===== AMBASSADORS =====
  ambassadorIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#7C3AED' + '12', alignItems: 'center', justifyContent: 'center' },
  bannerCarousel: { overflow: 'hidden' as const, borderRadius: 20 },
  bannerSlide: { borderRadius: 20, overflow: 'hidden' as const },
  bannerGradient: { borderRadius: 20, padding: 16, position: 'relative' as const },
  bannerSponsorTag: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'flex-start' as const, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  bannerSponsorText: { fontSize: 9, fontWeight: '700' as const, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  bannerContent: { flexDirection: 'row' as const, gap: 12, marginBottom: 10 },
  bannerAvatarWrap: { position: 'relative' as const },
  bannerAvatar: { width: 64, height: 64, borderRadius: 20, overflow: 'hidden' as const, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  bannerVerifiedIcon: { position: 'absolute' as const, bottom: -3, right: -3, width: 24, height: 24, borderRadius: 12, backgroundColor: '#7C3AED', alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 2, borderColor: '#9333EA' },
  bannerInfo: { flex: 1, justifyContent: 'center' as const },
  bannerName: { fontSize: 17, fontWeight: '800' as const, color: '#FFF', marginBottom: 3 },
  bannerBio: { fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 16, marginBottom: 8 },
  bannerStatsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 8, alignSelf: 'flex-start' as const },
  bannerStatItem: { alignItems: 'center' as const, paddingHorizontal: 8 },
  bannerStatVal: { fontSize: 13, fontWeight: '800' as const, color: '#FFF' },
  bannerStatLbl: { fontSize: 7, fontWeight: '600' as const, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' as const },
  bannerStatDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.15)' },
  bannerSocialsRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 5 },
  bannerSocialChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  bannerSocialChipText: { fontSize: 9, fontWeight: '600' as const, color: 'rgba(255,255,255,0.85)' },
  bannerCta: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'flex-end' as const, gap: 4 },
  bannerCtaText: { fontSize: 11, fontWeight: '600' as const, color: 'rgba(255,255,255,0.8)' },
  bannerDots: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingTop: 12 },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' + '25' },
  bannerDotActive: { width: 24, backgroundColor: '#7C3AED', borderRadius: 4 },

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
  // Meetup list
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

  // Join modal
  joinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  joinContent: { backgroundColor: '#FFF', borderRadius: 24, padding: 24 },
  joinHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  joinTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  joinClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  joinDesc: { fontSize: 14, color: theme.textSecondary, marginBottom: 16, lineHeight: 20 },
  joinInput: { backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', letterSpacing: 2, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 16 },
  joinBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // QR modal
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, paddingHorizontal: 24 },
  qrContent: { backgroundColor: '#FFF', borderRadius: 24, overflow: 'hidden' as const },
  qrHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  qrHeaderTitle: { fontSize: 18, fontWeight: '700' as const, color: theme.textPrimary },
  qrCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center' as const, justifyContent: 'center' as const },
  qrBody: { alignItems: 'center' as const, paddingVertical: 28, paddingHorizontal: 24 },
  qrCodeWrapper: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, borderWidth: 2, borderColor: '#E2E8F0', marginBottom: 20 },
  qrAppName: { fontSize: 20, fontWeight: '800' as const, color: '#1E3A8A', marginBottom: 6 },
  qrDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' as const, lineHeight: 20, marginBottom: 16 },
  qrNote: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10, backgroundColor: theme.success + '08', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.success + '15' },
  qrNoteText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  qrActions: { flexDirection: 'row' as const, gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  qrCopyBtn: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.primary + '10' },
  qrCopyBtnText: { fontSize: 15, fontWeight: '600' as const, color: theme.primary },
  qrDoneBtn: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9' },
  qrDoneBtnText: { fontSize: 15, fontWeight: '600' as const, color: theme.textSecondary },

  // Tournament picker modal
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalAddBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  modalContent: { flex: 1 },
  modalScrollContent: { padding: 16 },
  statusFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FFF', borderRadius: 9999, borderWidth: 1.5, borderColor: '#E2E8F0' },
  statusChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  statusChipCount: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  statusChipCountText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary },
  tPickerItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12, ...theme.shadows.card },
  tPickerIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: theme.carreauColor + '15', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  tPickerInfo: { flex: 1 },
  tPickerName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 6 },
  tPickerMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tPickerDate: { fontSize: 12, color: theme.textMuted, marginLeft: 4 },
  tPickerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted, marginHorizontal: 6 },
  tPickerCity: { fontSize: 12, color: theme.textMuted },
  tPickerBadges: { flexDirection: 'row', gap: 8 },
  tPickerBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tPickerBadgeText: { fontSize: 11, fontWeight: '600' },
  emptyFilter: { alignItems: 'center', paddingVertical: 40 },
  emptyFilterText: { fontSize: 14, color: theme.textMuted, marginTop: 12, marginBottom: 16 },
  resetFilterBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.primary + '15', borderRadius: 9999 },
  resetFilterText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  emptyTournament: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTournamentIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.carreauColor + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTournamentTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyTournamentText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  createTournamentBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.carreauColor, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  createTournamentBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
