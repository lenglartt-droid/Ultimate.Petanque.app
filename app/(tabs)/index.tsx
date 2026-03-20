
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import theme, { blurhash } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useAuth, useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { preloadInterstitial } from '@/services/adService';
import CommunityLeaderboard from '@/components/ui/CommunityLeaderboard';
import { getMyMeetups, getInvitedMeetups, getMeetupResponses, getPendingInvitationsCount, findMeetupByCode, Meetup, MeetupResponse } from '@/services/meetupService';
import * as Clipboard from 'expo-clipboard';
import { config } from '@/constants/config';
import QRCode from 'react-native-qrcode-svg';
import { Share as RNShare } from 'react-native';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, tournaments, matches, challenges, selfPlayer, refreshData } = useApp();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'À venir' | 'En cours' | 'Terminé'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Meetups state
  const [meetups, setMeetups] = useState<(Meetup & { _source: 'created' | 'invited'; _acceptedCount?: number; _maxParticipants?: number })[]>([]);
  const [meetupsLoading, setMeetupsLoading] = useState(true);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [showJoinMeetupModal, setShowJoinMeetupModal] = useState(false);
  const [showMeetupListModal, setShowMeetupListModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
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

  // Countdown timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

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
    await Promise.all([refreshData(), loadMeetups()]);
    setRefreshing(false);
  };

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

  useEffect(() => { preloadInterstitial(); }, []);

  // --- Computed data ---

  // Last 3 results (matches + challenges, sorted by date desc)
  const recentResults = useMemo(() => {
    const items: { type: 'match' | 'challenge'; id: string; date: string; title: string; subtitle: string; result: 'win' | 'loss' | 'draw' | 'neutral'; score?: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [];

    matches.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3).forEach((m: any) => {
      const isWin = m.winner === 'A';
      const isDraw = m.winner === 'draw';
      const scoreA = m.teamA?.score ?? 0;
      const scoreB = m.teamB?.score ?? 0;
      const teamANames = m.teamA?.playerNames?.join(', ') || t('match', 'teamA');
      const teamBNames = m.teamB?.playerNames?.join(', ') || t('match', 'teamB');
      items.push({
        type: 'match',
        id: m.id,
        date: m.date,
        title: teamANames,
        subtitle: `vs ${teamBNames}`,
        result: isDraw ? 'draw' : isWin ? 'win' : 'loss',
        score: `${scoreA} - ${scoreB}`,
        icon: 'sports',
      });
    });

    challenges.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3).forEach((c: any) => {
      const rate = c.totalShots > 0 ? Math.round((c.successCount / c.totalShots) * 100) : 0;
      const challengeName = c.type === '10_tirs' ? t('challengeNames', '10_tirs') : c.type === '10_tirs_sautee' ? t('challengeNames', '10_tirs_sautee') : t('challengeNames', 'precision');
      items.push({
        type: 'challenge',
        id: c.id,
        date: c.date,
        title: challengeName,
        subtitle: c.mode === 'duel' ? `vs ${c.opponent_name || c.player_name || ''}` : t('challenge', 'solo'),
        result: rate >= 60 ? 'win' : rate >= 40 ? 'draw' : 'neutral',
        score: `${rate}%`,
        icon: 'track-changes',
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
  }, [matches, challenges, t]);

  // Next upcoming tournament
  const nextTournament = useMemo(() => {
    const upcoming = tournaments
      .filter((t: any) => t.status === 'À venir' || t.status === 'En cours')
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return upcoming[0] || null;
  }, [tournaments]);

  // Countdown for next tournament
  const countdown = useMemo(() => {
    if (!nextTournament) return null;
    const diff = new Date(nextTournament.date).getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, label: t('notifications', 'todayLabel') };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, label: null };
  }, [nextTournament, now, t]);

  // Quick stats
  const totalMatches = userStats?.matchesPlayed || matches.length;
  const totalWins = userStats?.wins || 0;
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (language === 'fr') {
      if (hour < 12) return 'Bonjour';
      if (hour < 18) return 'Bon après-midi';
      return 'Bonsoir';
    }
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, [language]);

  const resultColor = (r: string) => r === 'win' ? theme.success : r === 'loss' ? theme.error : r === 'draw' ? theme.warning : theme.textMuted;
  const resultLabel = (r: string) => r === 'win' ? t('history', 'victory') : r === 'loss' ? t('history', 'defeat') : r === 'draw' ? t('history', 'draw') : '-';

  // FlatList renderItem for tournament picker modal
  const renderTournamentPickerItem = useCallback(({ item: tournament }: { item: any }) => {
    const statusColors: Record<string, { bg: string; text: string }> = {
      'À venir': { bg: theme.primary + '15', text: theme.primary },
      'En cours': { bg: theme.warning + '15', text: theme.warning },
      'Terminé': { bg: theme.success + '15', text: theme.success },
    };
    const colors = statusColors[tournament.status as keyof typeof statusColors] || statusColors['À venir'];
    return (
      <Pressable key={tournament.id} style={styles.tPickerItem} onPress={() => { setShowTournamentPicker(false); router.push(`/tournament/${tournament.id}`); }}>
        <View style={styles.tPickerIcon}>
          <MaterialIcons name="emoji-events" size={28} color={theme.carreauColor} />
        </View>
        <View style={styles.tPickerInfo}>
          <Text style={styles.tPickerName} numberOfLines={1}>{tournament.name}</Text>
          <View style={styles.tPickerMeta}>
            <MaterialIcons name="event" size={12} color={theme.textMuted} />
            <Text style={styles.tPickerDate}>{new Date(tournament.date).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            <View style={styles.tPickerDot} />
            <Text style={styles.tPickerCity}>{tournament.location.city}</Text>
          </View>
          <View style={styles.tPickerBadges}>
            <View style={[styles.tPickerBadge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.tPickerBadgeText, { color: colors.text }]}>
                {tournament.status === 'À venir' ? t('tournamentStatus', 'upcoming') : tournament.status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'completed')}
              </Text>
            </View>
            <View style={[styles.tPickerBadge, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tPickerBadgeText, { color: theme.textSecondary }]}>{t('formats', tournament.format)}</Text>
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
      <Pressable
        style={({ pressed }) => [styles.meetupModalItem, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        onPress={() => { setShowMeetupListModal(false); router.push(`/meetup/${m.id}` as any); }}
      >
        <View style={styles.meetupDateCol}>
          <Text style={styles.meetupDateDay}>{mDate.getDate()}</Text>
          <Text style={styles.meetupDateMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
        </View>
        <View style={styles.meetupInfoCol}>
          <Text style={styles.meetupItemTitle} numberOfLines={1}>{m.title}</Text>
          <View style={styles.meetupItemMeta}>
            <MaterialIcons name="schedule" size={12} color={theme.textMuted} />
            <Text style={styles.meetupItemTime}>{mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
            {daysUntil <= 1 ? (
              <View style={styles.meetupSoonBadge}>
                <Text style={styles.meetupSoonText}>{daysUntil === 0 ? t('notifications', 'todayLabel') : t('notifications', 'tomorrowLabel')}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.meetupItemBottom}>
            <View style={styles.meetupConfirmBadge}>
              <MaterialIcons name="group" size={12} color={theme.success} />
              <Text style={styles.meetupConfirmText}>{m._acceptedCount || 0}/{m._maxParticipants || 8} {t('meetup', 'confirmedCount')}</Text>
            </View>
            {isCreator ? (
              <View style={styles.meetupCreatorBadge}>
                <MaterialIcons name="person" size={10} color={theme.primary} />
                <Text style={styles.meetupCreatorText}>{t('meetup', 'yourMeetup')}</Text>
              </View>
            ) : (
              <View style={styles.meetupInvitedBadge}>
                <MaterialIcons name="mail" size={10} color={theme.accent} />
                <Text style={styles.meetupInvitedText}>{t('meetup', 'invited')}</Text>
              </View>
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
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />
        }
      >
        {/* ========== GRADIENT HERO HEADER ========== */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <LinearGradient
            colors={['#1E3A8A', '#2563EB', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroGradient, isTablet && styles.heroGradientTablet]}
          >
            {/* Top row: greeting + notifications */}
            <View style={styles.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroGreeting}>{greeting},</Text>
                <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
              </View>
              <View style={styles.heroTopActions}>
                <Pressable style={styles.heroShareAppBtn} onPress={() => setShowQRModal(true)}>
                  <MaterialIcons name="qr-code-2" size={20} color="#FFF" />
                </Pressable>
                {pendingInviteCount > 0 ? (
                  <Pressable style={styles.heroBellBtn} onPress={() => router.push('/meetup/invitations' as any)}>
                    <MaterialIcons name="mail" size={22} color="#FFF" />
                    <View style={styles.heroBellBadge}>
                      <Text style={styles.heroBellBadgeText}>{pendingInviteCount > 9 ? '9+' : pendingInviteCount}</Text>
                    </View>
                  </Pressable>
                ) : null}
                <Pressable style={styles.heroProfileBtn} onPress={() => router.push('/profile')}>
                  {selfPlayer?.avatar ? (
                    <Image source={{ uri: selfPlayer.avatar }} style={styles.heroAvatarImg} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                  ) : (
                    <Text style={styles.heroAvatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Stats bar */}
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{totalMatches}</Text>
                <Text style={styles.heroStatLabel}>{t('stats', 'matches')}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{totalWins}</Text>
                <Text style={styles.heroStatLabel}>{t('stats', 'victories')}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{winRate}%</Text>
                <Text style={styles.heroStatLabel}>{t('stats', 'winRate')}</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{challenges.length}</Text>
                <Text style={styles.heroStatLabel}>{t('profile', 'challenges')}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ========== BRAND BANNER ========== */}
        <Animated.View entering={FadeInDown.duration(400).delay(40)} style={[styles.bannerSection, isTablet && styles.sectionTablet]}>
          <View style={styles.bannerCard}>
            <Image
              source={require('@/assets/images/banner-home.png')}
              style={styles.bannerImage}
              contentFit="cover"
              transition={200}
              placeholder={{ blurhash: blurhash.banner }}
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['transparent', 'rgba(15,23,42,0.55)']}
              style={styles.bannerOverlay}
            />
          </View>
        </Animated.View>

        {/* ========== QUICK ACTIONS ========== */}
        <Animated.View entering={FadeInDown.duration(400).delay(80)} style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={styles.sectionTitle}>{t('home', 'whatDoYouWant')}</Text>
          <View style={[styles.actionsRow, isTablet && styles.actionsRowTablet]}>
            {[
              { label: t('home', 'match'), sub: t('home', 'training'), icon: 'sports' as keyof typeof MaterialIcons.glyphMap, colors: ['#2563EB', '#3B82F6'] as [string, string], onPress: () => router.push('/match/new') },
              { label: t('home', 'challenge'), sub: t('home', 'shotsPoints'), icon: 'track-changes' as keyof typeof MaterialIcons.glyphMap, colors: ['#D97706', '#F59E0B'] as [string, string], onPress: () => router.push('/challenge/new') },
              { label: t('home', 'tournament'), sub: t('home', 'myJourney'), icon: 'emoji-events' as keyof typeof MaterialIcons.glyphMap, colors: ['#B45309', '#F59E0B'] as [string, string], onPress: () => setShowTournamentPicker(true) },
            ].map((action, idx) => (
              <Pressable key={idx} style={({ pressed }) => [styles.actionCard, isTablet && styles.actionCardTablet, pressed && styles.actionCardPressed]} onPress={action.onPress}>
                <LinearGradient colors={action.colors} style={[styles.actionIconBg, isTablet && styles.actionIconBgTablet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <MaterialIcons name={action.icon} size={isTablet ? 40 : 32} color="#FFF" />
                </LinearGradient>
                <Text style={[styles.actionLabel, isTablet && styles.actionLabelTablet]} adjustsFontSizeToFit numberOfLines={1}>{action.label}</Text>
                <Text style={styles.actionSub}>{action.sub}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ========== À VENIR (TOURNOI + RDV) - 2 COLONNES ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(140)} style={[styles.section, isTablet && styles.sectionTablet, { zIndex: 1 }]}>
          <View style={styles.upcomingHeaderRow}>
            <MaterialIcons name="event-note" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('home', 'upcoming')}</Text>
          </View>

          <View style={styles.upcomingColumnsRow}>
            {/* LEFT COLUMN: Tournament Countdown */}
            <View style={styles.upcomingCol}>
              {nextTournament ? (
                <Pressable
                  style={({ pressed }) => [styles.colTournamentCard, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}
                  onPress={() => router.push(`/tournament/${nextTournament.id}`)}
                >
                  <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.colTournamentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.colTournamentHeader}>
                      <View style={styles.colTournamentIconBg}>
                        <MaterialIcons name="emoji-events" size={20} color="#B45309" />
                      </View>
                      <Text style={styles.colTournamentLabel}>
                        {nextTournament.status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'upcoming')}
                      </Text>
                    </View>
                    <Text style={styles.colTournamentName} numberOfLines={2}>{nextTournament.name}</Text>
                    <View style={styles.colTournamentMeta}>
                      <MaterialIcons name="place" size={12} color="#92400E" />
                      <Text style={styles.colTournamentCity} numberOfLines={1}>{nextTournament.location?.city || ''}</Text>
                    </View>
                    <Text style={styles.colTournamentDate}>
                      {new Date(nextTournament.date).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                    {countdown ? (
                      <View style={styles.colCountdownRow}>
                        {countdown.label ? (
                          <View style={styles.colCountdownBadge}>
                            <MaterialIcons name="local-fire-department" size={14} color="#B45309" />
                            <Text style={styles.colCountdownBadgeText}>{countdown.label}</Text>
                          </View>
                        ) : (
                          <>
                            <View style={styles.colCountdownUnit}>
                              <Text style={styles.colCountdownValue}>{countdown.days}</Text>
                              <Text style={styles.colCountdownUnitLabel}>{language === 'fr' ? 'j' : 'd'}</Text>
                            </View>
                            <Text style={styles.colCountdownSep}>:</Text>
                            <View style={styles.colCountdownUnit}>
                              <Text style={styles.colCountdownValue}>{countdown.hours}</Text>
                              <Text style={styles.colCountdownUnitLabel}>h</Text>
                            </View>
                            <Text style={styles.colCountdownSep}>:</Text>
                            <View style={styles.colCountdownUnit}>
                              <Text style={styles.colCountdownValue}>{countdown.minutes}</Text>
                              <Text style={styles.colCountdownUnitLabel}>min</Text>
                            </View>
                          </>
                        )}
                      </View>
                    ) : null}
                  </LinearGradient>
                </Pressable>
              ) : (
                <View style={styles.colEmptyCard}>
                  <View style={styles.colEmptyIconBg}>
                    <MaterialIcons name="emoji-events" size={28} color={theme.textMuted} />
                  </View>
                  <Text style={styles.colEmptyText}>{t('home', 'noTournament')}</Text>
                  <Pressable style={styles.colEmptyBtn} onPress={() => router.push('/tournament/new')}>
                    <MaterialIcons name="add" size={14} color="#FFF" />
                  </Pressable>
                </View>
              )}
            </View>

            {/* RIGHT COLUMN: Meetups */}
            <View style={styles.upcomingCol}>
              <View style={styles.colMeetupHeader}>
                <View style={styles.colMeetupTitleLeft}>
                  <MaterialIcons name="event" size={14} color={theme.accent} />
                  <Text style={styles.colMeetupTitle}>{t('history', 'meetups')}</Text>
                </View>
                <View style={styles.colMeetupActions}>
                  {pendingInviteCount > 0 ? (
                    <Pressable style={styles.colMeetupActionBtn} onPress={() => router.push('/meetup/invitations' as any)}>
                      <MaterialIcons name="mail" size={12} color={theme.error} />
                      <View style={styles.colMeetupBadge}><Text style={styles.colMeetupBadgeText}>{pendingInviteCount > 9 ? '9+' : pendingInviteCount}</Text></View>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.colMeetupActionBtn} onPress={() => setShowJoinMeetupModal(true)}>
                    <MaterialIcons name="qr-code" size={12} color={theme.accent} />
                  </Pressable>
                  <Pressable style={[styles.colMeetupActionBtn, { backgroundColor: theme.primary }]} onPress={() => router.push('/meetup/new' as any)}>
                    <MaterialIcons name="add" size={14} color="#FFF" />
                  </Pressable>
                </View>
              </View>

              {meetups.length > 0 ? (
                <View style={styles.colMeetupList}>
                  {meetups.slice(0, 2).map((m) => {
                    const mDate = new Date(m.date);
                    const daysUntil = Math.max(0, Math.ceil((mDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    return (
                      <Pressable
                        key={m.id}
                        style={({ pressed }) => [styles.colMeetupItem, pressed && { opacity: 0.85 }]}
                        onPress={() => router.push(`/meetup/${m.id}` as any)}
                      >
                        <View style={styles.colMeetupDateBox}>
                          <Text style={styles.colMeetupDateDay}>{mDate.getDate()}</Text>
                          <Text style={styles.colMeetupDateMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                        </View>
                        <View style={styles.colMeetupInfo}>
                          <Text style={styles.colMeetupItemTitle} numberOfLines={1}>{m.title}</Text>
                          <View style={styles.colMeetupItemMeta}>
                            <Text style={styles.colMeetupItemTime}>
                              {mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {daysUntil <= 1 ? (
                              <View style={styles.colMeetupSoonBadge}>
                                <Text style={styles.colMeetupSoonText}>{daysUntil === 0 ? t('notifications', 'todayLabel') : t('notifications', 'tomorrowLabel')}</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.colMeetupItemBottom}>
                            <MaterialIcons name="group" size={11} color="#0369A1" />
                            <Text style={styles.colMeetupParticipants}>{m._acceptedCount || 0}/{m._maxParticipants || 8}</Text>
                            {m._source === 'created' ? (
                              <View style={styles.colMeetupCreatorDot}>
                                <MaterialIcons name="person" size={8} color={theme.primary} />
                              </View>
                            ) : (
                              <View style={styles.colMeetupInvitedDot}>
                                <MaterialIcons name="mail" size={8} color={theme.accent} />
                              </View>
                            )}
                          </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={16} color="#0369A1" />
                      </Pressable>
                    );
                  })}

                  {meetups.length > 2 ? (
                    <Pressable
                      style={({ pressed }) => [styles.colMeetupMoreLink, pressed && { opacity: 0.7 }]}
                      onPress={() => setShowMeetupListModal(true)}
                    >
                      <Text style={styles.colMeetupMoreText}>
                        +{meetups.length - 2} {language === 'fr' ? 'autre(s)' : 'more'}
                      </Text>
                      <MaterialIcons name="chevron-right" size={14} color={theme.accent} />
                    </Pressable>
                  ) : null}
                </View>
              ) : !meetupsLoading ? (
                <View style={styles.colMeetupEmpty}>
                  <MaterialIcons name="event-available" size={24} color={theme.textMuted} />
                  <Text style={styles.colMeetupEmptyText}>{t('meetup', 'noMeetups')}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>



        {/* ========== COMMUNITY LEADERBOARD ========== */}
        <Animated.View
          entering={FadeIn.duration(400).delay(170)}
          style={[styles.section, isTablet && styles.sectionTablet]}

        >
          <CommunityLeaderboard />
        </Animated.View>

        {/* ========== QUICK ACCESS GRID ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(190)} style={[styles.section, isTablet && styles.sectionTablet]}>
          <Text style={styles.sectionTitle}>{t('home', 'quickAccess')}</Text>
          <View style={styles.quickGrid}>
            {[
              { label: t('home', 'player'), icon: 'person-add' as keyof typeof MaterialIcons.glyphMap, bg: theme.primary, route: '/player/new' },
              { label: t('home', 'tournament'), icon: 'add-circle' as keyof typeof MaterialIcons.glyphMap, bg: theme.carreauColor, route: '/tournament/new' },
              { label: t('home', 'terrain'), icon: 'sports-soccer' as keyof typeof MaterialIcons.glyphMap, bg: theme.accent, route: '/terrain/new' },
              { label: t('home', 'club'), icon: 'add-home' as keyof typeof MaterialIcons.glyphMap, bg: theme.success, route: '/club/new' },
            ].map((q, i) => (
              <Pressable key={i} style={({ pressed }) => [styles.quickItem, pressed && styles.quickItemPressed]} onPress={() => router.push(q.route as any)}>
                <View style={[styles.quickIcon, { backgroundColor: q.bg }]}>
                  <MaterialIcons name={q.icon} size={22} color="#FFF" />
                </View>
                <Text style={styles.quickLabel}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ========== COMPACT HISTORY ========== */}
        {recentResults.length > 0 ? (
          <Animated.View entering={FadeIn.duration(400).delay(260)} style={[styles.section, isTablet && styles.sectionTablet, { zIndex: 0 }]}>
            <View style={styles.historyHeaderRow}>
              <View style={styles.historyHeaderLeft}>
                <MaterialIcons name="history" size={20} color={theme.primary} />
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>{t('history', 'history')}</Text>
              </View>
              <Pressable onPress={() => router.push('/history')} style={styles.historySeeAllBtn}>
                <Text style={styles.seeAllBtn}>{t('common', 'seeAll')}</Text>
                <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
              </Pressable>
            </View>
            <View style={styles.historyCompactList}>
              {recentResults.map((item, idx) => {
                const d = new Date(item.date);
                const isLast = idx === recentResults.length - 1;
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.hcRow, !isLast && styles.hcRowBorder, pressed && { opacity: 0.75, backgroundColor: theme.backgroundSecondary }]}
                    onPress={() => item.type === 'match' ? router.push({ pathname: '/history', params: { openMatchId: item.id } }) : router.push({ pathname: '/history', params: { openChallengeId: item.id } })}
                  >
                    <View style={[styles.hcDot, { backgroundColor: resultColor(item.result) }]} />
                    <View style={[styles.hcTypeIcon, { backgroundColor: (item.type === 'match' ? theme.primary : theme.accent) + '12' }]}>
                      <MaterialIcons name={item.icon} size={14} color={item.type === 'match' ? theme.primary : theme.accent} />
                    </View>
                    <View style={styles.hcInfo}>
                      <Text style={styles.hcTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.hcSub} numberOfLines={1}>{item.subtitle} {' \u2022 '} {d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Text>
                    </View>
                    <Text style={[styles.hcScore, { color: resultColor(item.result) }]}>{item.score}</Text>
                    <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : (matches.length === 0 && challenges.length === 0) ? (
          <Animated.View entering={FadeIn.duration(500).delay(200)} style={[styles.emptyCard, isTablet && styles.emptyCardTablet]}>
            <View style={styles.emptyIconBg}>
              <MaterialIcons name="sports" size={44} color={theme.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('home', 'welcomeTitle')}</Text>
            <Text style={styles.emptyText}>{t('home', 'welcomeText')}</Text>
            <Pressable style={styles.emptyCta} onPress={() => router.push('/match/new')}>
              <MaterialIcons name="play-arrow" size={20} color="#FFF" />
              <Text style={styles.emptyCtaText}>{t('home', 'firstMatch')}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

      </ScrollView>

      {/* ========== MEETUP LIST MODAL ========== */}
      <Modal visible={showMeetupListModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMeetupListModal(false)}>
        <SafeAreaView style={styles.meetupModalContainer}>
          <View style={styles.meetupModalHeader}>
            <View style={styles.meetupModalHeaderLeft}>
              <View style={styles.meetupModalIconBg}>
                <MaterialIcons name="event" size={20} color={theme.accent} />
              </View>
              <Text style={styles.meetupModalTitle}>{t('meetup', 'upcomingMeetups')}</Text>
            </View>
            <Pressable style={styles.meetupModalCloseBtn} onPress={() => setShowMeetupListModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <FlatList
            data={meetups}
            keyExtractor={meetupKeyExtractor}
            renderItem={renderMeetupModalItem}
            style={styles.meetupModalScroll}
            contentContainerStyle={styles.meetupModalScrollContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
          />
        </SafeAreaView>
      </Modal>

      {/* ========== JOIN MEETUP MODAL ========== */}
      <Modal visible={showJoinMeetupModal} animationType="slide" transparent onRequestClose={() => setShowJoinMeetupModal(false)}>
        <View style={styles.joinOverlay}>
          <View style={styles.joinContent}>
            <View style={styles.joinHeader}>
              <Text style={styles.joinTitle}>{t('meetup', 'joinMeetup')}</Text>
              <Pressable style={styles.joinClose} onPress={() => setShowJoinMeetupModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.joinDesc}>{t('meetup', 'enterMeetupCode')}</Text>
            <TextInput
              style={styles.joinInput}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder={t('meetup', 'enterCodePlaceholder')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
              autoFocus
            />
            <Pressable
              style={[styles.joinBtn, (!joinCode.trim() || joinLoading) && { opacity: 0.5 }]}
              disabled={!joinCode.trim() || joinLoading}
              onPress={async () => {
                setJoinLoading(true);
                const { meetup: found } = await findMeetupByCode(joinCode.trim());
                setJoinLoading(false);
                if (found) {
                  setShowJoinMeetupModal(false);
                  setJoinCode('');
                  router.push(`/meetup/${found.id}` as any);
                } else {
                  showAlert(t('common', 'error'), t('meetup', 'invalidCode'));
                }
              }}
            >
              {joinLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="search" size={20} color="#FFF" />
                  <Text style={styles.joinBtnText}>{t('meetup', 'joinMeetup')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========== QR CODE SHARE MODAL ========== */}
      <Modal visible={showQRModal} animationType="slide" transparent onRequestClose={() => setShowQRModal(false)}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrContent}>
            <View style={styles.qrHeader}>
              <Text style={styles.qrHeaderTitle}>{t('home', 'shareAppTitle')}</Text>
              <Pressable style={styles.qrCloseBtn} onPress={() => setShowQRModal(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.qrBody}>
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={config.appDownloadUrl}
                  size={200}
                  color="#1E3A8A"
                  backgroundColor="#FFF"
                />
              </View>
              <Text style={styles.qrAppName}>Ultimate Petanque</Text>
              <Text style={styles.qrDesc}>{t('home', 'shareAppDesc')}</Text>

              <View style={styles.qrNote}>
                <MaterialIcons name="people" size={18} color={theme.success} />
                <Text style={styles.qrNoteText}>{t('home', 'shareAppNote')}</Text>
              </View>
            </View>

            <View style={styles.qrActions}>
              <Pressable
                style={styles.qrCopyBtn}
                onPress={async () => {
                  await Clipboard.setStringAsync(config.appDownloadUrl);
                  showAlert(t('home', 'linkCopied'));
                }}
              >
                <MaterialIcons name="content-copy" size={18} color={theme.primary} />
                <Text style={styles.qrCopyBtnText}>{t('home', 'copyLink')}</Text>
              </Pressable>
              <Pressable style={styles.qrDoneBtn} onPress={() => setShowQRModal(false)}>
                <Text style={styles.qrDoneBtnText}>{t('common', 'close')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========== TOURNAMENT PICKER MODAL ========== */}
      <Modal visible={showTournamentPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTournamentPicker(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowTournamentPicker(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>{t('home', 'myTournaments')}</Text>
            <Pressable style={styles.modalAddBtn} onPress={() => { setShowTournamentPicker(false); router.push('/tournament/new'); }}>
              <MaterialIcons name="add" size={24} color={theme.primary} />
            </Pressable>
          </View>
          {tournaments.length > 0 ? (
            <FlatList
              data={filteredTournaments}
              keyExtractor={tournamentKeyExtractor}
              renderItem={renderTournamentPickerItem}
              style={styles.modalContent}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              ListHeaderComponent={
                <View style={styles.statusFilterRow}>
                  {(['all', 'À venir', 'En cours', 'Terminé'] as const).map((status) => {
                    const isActive = statusFilter === status;
                    const statusConfig: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
                      'all': { icon: 'layers', color: theme.textSecondary },
                      'À venir': { icon: 'event', color: theme.primary },
                      'En cours': { icon: 'play-circle-filled', color: theme.warning },
                      'Terminé': { icon: 'check-circle', color: theme.success },
                    };
                    const cfg = statusConfig[status];
                    return (
                      <Pressable key={status} style={[styles.statusChip, isActive && { backgroundColor: cfg.color, borderColor: cfg.color }]} onPress={() => setStatusFilter(status)}>
                        <MaterialIcons name={cfg.icon} size={14} color={isActive ? '#FFF' : cfg.color} />
                        <Text style={[styles.statusChipText, isActive && styles.statusChipTextActive, !isActive && { color: cfg.color }]}>
                          {status === 'all' ? t('common', 'all') : status === 'À venir' ? t('tournamentStatus', 'upcoming') : status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'completed')}
                        </Text>
                        <View style={[styles.statusChipCount, isActive && styles.statusChipCountActive]}>
                          <Text style={[styles.statusChipCountText, isActive && styles.statusChipCountTextActive]}>{statusCounts[status]}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              }
              ListEmptyComponent={
                <View style={styles.emptyFilter}>
                  <MaterialIcons name="filter-list-off" size={40} color={theme.textMuted} />
                  <Text style={styles.emptyFilterText}>{t('home', 'noTournamentFilter')}</Text>
                  <Pressable style={styles.resetFilterBtn} onPress={() => setStatusFilter('all')}>
                    <Text style={styles.resetFilterText}>{t('common', 'seeAll')}</Text>
                  </Pressable>
                </View>
              }
            />
          ) : (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.emptyTournament}>
                <View style={styles.emptyTournamentIcon}>
                  <MaterialIcons name="emoji-events" size={56} color={theme.carreauColor} />
                </View>
                <Text style={styles.emptyTournamentTitle}>{t('home', 'noTournament')}</Text>
                <Text style={styles.emptyTournamentText}>{t('home', 'noTournamentText')}</Text>
                <Pressable style={styles.createTournamentBtn} onPress={() => { setShowTournamentPicker(false); router.push('/tournament/new'); }}>
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.createTournamentBtnText}>{t('home', 'createTournament')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  scrollView: { flex: 1 },
  scrollContent: { maxWidth: 960, alignSelf: 'center' as const, width: '100%' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTablet: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  seeAllBtn: { fontSize: 13, fontWeight: '600', color: theme.primary },

  // ========== HERO GRADIENT ==========
  heroGradient: { paddingTop: 16, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 24 },
  heroGradientTablet: { paddingTop: 24, paddingBottom: 30, paddingHorizontal: 28 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  heroGreeting: { fontSize: 16, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  heroName: { fontSize: 26, fontWeight: '800', color: '#FFF', marginTop: 2 },
  heroTopActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroShareAppBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroBellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  heroBellBadge: { position: 'absolute' as const, top: -2, right: -2, backgroundColor: theme.error, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#2563EB' },
  heroBellBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  heroProfileBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  heroAvatarImg: { width: 72, height: 72, borderRadius: 36 },
  heroAvatarLetter: { fontSize: 28, fontWeight: '700', color: '#FFF' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 10 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  heroStatLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },

  // ========== ACTIONS ==========
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionsRowTablet: { gap: 20 },
  actionCard: { flex: 1, backgroundColor: theme.surface, borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: theme.border, ...theme.shadows.card },
  actionCardTablet: { padding: 26, borderRadius: 24 },
  actionCardPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  actionIconBg: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...theme.shadows.card },
  actionIconBgTablet: { width: 80, height: 80, borderRadius: 22, marginBottom: 16 },
  actionLabel: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 3 },
  actionLabelTablet: { fontSize: 18 },
  actionSub: { fontSize: 12, color: theme.textSecondary },

  // ========== 2-COLUMN À VENIR ==========
  upcomingColumnsRow: { flexDirection: 'row', gap: 10 },
  upcomingCol: { flex: 1 },

  // Tournament column card
  colTournamentCard: { borderRadius: 18, overflow: 'hidden', ...theme.shadows.cardElevated, flex: 1 },
  colTournamentGradient: { padding: 14, flex: 1 },
  colTournamentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  colTournamentIconBg: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(180,83,9,0.12)', alignItems: 'center', justifyContent: 'center' },
  colTournamentLabel: { fontSize: 9, fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  colTournamentName: { fontSize: 15, fontWeight: '800', color: '#78350F', marginBottom: 6, lineHeight: 20 },
  colTournamentMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  colTournamentCity: { fontSize: 11, fontWeight: '600', color: '#92400E', flex: 1 },
  colTournamentDate: { fontSize: 11, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  colCountdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: 'rgba(180,83,9,0.08)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 8 },
  colCountdownUnit: { alignItems: 'center' },
  colCountdownValue: { fontSize: 20, fontWeight: '900', color: '#78350F' },
  colCountdownUnitLabel: { fontSize: 8, fontWeight: '700', color: '#92400E', textTransform: 'uppercase' },
  colCountdownSep: { fontSize: 16, fontWeight: '700', color: '#92400E', marginHorizontal: 1 },
  colCountdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(180,83,9,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  colCountdownBadgeText: { fontSize: 12, fontWeight: '800', color: '#78350F' },
  colEmptyCard: { backgroundColor: theme.surface, borderRadius: 18, padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1, borderWidth: 1, borderColor: theme.border, minHeight: 160 },
  colEmptyIconBg: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.carreauColor + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  colEmptyText: { fontSize: 13, color: theme.textMuted, fontWeight: '500', textAlign: 'center', marginBottom: 10 },
  colEmptyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.carreauColor, alignItems: 'center', justifyContent: 'center' },

  // Meetup column
  colMeetupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  colMeetupTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  colMeetupTitle: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  colMeetupActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  colMeetupActionBtn: { width: 26, height: 26, borderRadius: 8, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  colMeetupBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: theme.error, minWidth: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  colMeetupBadgeText: { fontSize: 8, fontWeight: '800', color: '#FFF' },
  colMeetupList: { flex: 1, gap: 6, backgroundColor: '#F0F9FF', borderRadius: 14, padding: 8 },
  colMeetupItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', borderRadius: 12, padding: 8, gap: 8 },
  colMeetupDateBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(3,105,161,0.12)', alignItems: 'center', justifyContent: 'center' },
  colMeetupDateDay: { fontSize: 18, fontWeight: '900', color: '#0369A1', lineHeight: 20 },
  colMeetupDateMonth: { fontSize: 8, fontWeight: '700', color: '#0369A1', letterSpacing: 0.3 },
  colMeetupInfo: { flex: 1 },
  colMeetupItemTitle: { fontSize: 13, fontWeight: '700', color: '#0C4A6E', marginBottom: 3 },
  colMeetupItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  colMeetupItemTime: { fontSize: 11, fontWeight: '600', color: '#0369A1' },
  colMeetupSoonBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  colMeetupSoonText: { fontSize: 8, fontWeight: '700', color: '#B45309' },
  colMeetupItemBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  colMeetupParticipants: { fontSize: 11, fontWeight: '600', color: '#0369A1' },
  colMeetupCreatorDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' },
  colMeetupInvitedDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: theme.accent + '18', alignItems: 'center', justifyContent: 'center' },
  colMeetupMoreLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, backgroundColor: theme.accent + '08', borderRadius: 8, borderWidth: 1, borderColor: theme.accent + '18' },
  colMeetupMoreText: { fontSize: 11, fontWeight: '600', color: theme.accent },
  colMeetupEmpty: { alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, paddingVertical: 20, gap: 6, borderWidth: 1, borderColor: theme.border, flex: 1, justifyContent: 'center', minHeight: 120 },
  colMeetupEmptyText: { fontSize: 12, color: theme.textMuted, fontWeight: '500', textAlign: 'center' },

  // ========== COMPACT HISTORY ==========
  historyHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  historyHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyCompactList: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' as const },
  hcRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  hcRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.border },
  hcDot: { width: 8, height: 8, borderRadius: 4 },
  hcTypeIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  hcInfo: { flex: 1, marginRight: 4 },
  hcTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  hcSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  hcScore: { fontSize: 17, fontWeight: '900', minWidth: 44, textAlign: 'right' as const },

  // ========== EMPTY STATE ==========
  emptyCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 32, alignItems: 'center', marginHorizontal: 16, marginBottom: 24, ...theme.shadows.card },
  emptyCardTablet: { padding: 48, maxWidth: 560, alignSelf: 'center' as const, width: '100%' },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyCtaText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  // ========== QUICK ACCESS ==========
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  quickItem: { flex: 1, alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 8, ...theme.shadows.card },
  quickItemPressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...theme.shadows.card },
  quickLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, textAlign: 'center' },

  // ========== MEETUP SECTION ==========
  upcomingHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },

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

  // ========== MEETUP LIST MODAL ==========
  meetupModalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  meetupModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  meetupModalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meetupModalIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.accent + '12', alignItems: 'center', justifyContent: 'center' },
  meetupModalTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  meetupModalCloseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  meetupModalScroll: { flex: 1 },
  meetupModalScrollContent: { padding: 16 },
  meetupModalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 12, gap: 12, ...theme.shadows.card },

  // ========== QR CODE MODAL ==========
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' as const, paddingHorizontal: 24 },
  qrContent: { backgroundColor: theme.surface, borderRadius: 24, overflow: 'hidden' as const },
  qrHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  qrHeaderTitle: { fontSize: 18, fontWeight: '700' as const, color: theme.textPrimary },
  qrCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.backgroundSecondary, alignItems: 'center' as const, justifyContent: 'center' as const },
  qrBody: { alignItems: 'center' as const, paddingVertical: 28, paddingHorizontal: 24 },
  qrCodeWrapper: { backgroundColor: '#FFF', padding: 16, borderRadius: 20, borderWidth: 2, borderColor: theme.border, marginBottom: 20, ...theme.shadows.card },
  qrAppName: { fontSize: 20, fontWeight: '800' as const, color: '#1E3A8A', marginBottom: 6 },
  qrDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' as const, lineHeight: 20, marginBottom: 16 },
  qrNote: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10, backgroundColor: theme.success + '08', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.success + '15' },
  qrNoteText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  qrActions: { flexDirection: 'row' as const, gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.border },
  qrCopyBtn: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.primary + '10' },
  qrCopyBtnText: { fontSize: 15, fontWeight: '600' as const, color: theme.primary },
  qrDoneBtn: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.backgroundSecondary },
  qrDoneBtnText: { fontSize: 15, fontWeight: '600' as const, color: theme.textSecondary },

  // ========== BRAND BANNER ==========
  bannerSection: { paddingHorizontal: 16, marginBottom: 24 },
  bannerCard: { borderRadius: 20, overflow: 'hidden' as const, ...theme.shadows.cardElevated, position: 'relative' as const },
  bannerImage: { width: '100%', height: 110, borderRadius: 20 },
  bannerOverlay: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, height: 50, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  // ========== HISTORY SEE ALL ==========
  historySeeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },

  // ========== JOIN MODAL ==========
  joinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  joinContent: { backgroundColor: theme.surface, borderRadius: 24, padding: 24 },
  joinHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  joinTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  joinClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  joinDesc: { fontSize: 14, color: theme.textSecondary, marginBottom: 16, lineHeight: 20 },
  joinInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', letterSpacing: 2, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 16 },
  joinBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // ========== TOURNAMENT PICKER MODAL ==========
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalAddBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  modalContent: { flex: 1 },
  modalScrollContent: { padding: 16 },
  statusFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.surface, borderRadius: theme.borderRadius.full, borderWidth: 1.5, borderColor: theme.border },
  statusChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  statusChipTextActive: { color: '#FFF' },
  statusChipCount: { backgroundColor: theme.backgroundSecondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  statusChipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  statusChipCountText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary },
  statusChipCountTextActive: { color: '#FFF' },
  tPickerItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 12, ...theme.shadows.card },
  tPickerIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: theme.carreauColor + '15', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  tPickerInfo: { flex: 1 },
  tPickerName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 6 },
  tPickerMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  tPickerDate: { fontSize: 12, color: theme.textMuted, marginLeft: 4 },
  tPickerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted, marginHorizontal: 6 },
  tPickerCity: { fontSize: 12, color: theme.textMuted },
  tPickerBadges: { flexDirection: 'row', gap: 8 },
  tPickerBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.sm },
  tPickerBadgeText: { fontSize: 11, fontWeight: '600' },
  emptyFilter: { alignItems: 'center', paddingVertical: 40 },
  emptyFilterText: { fontSize: 14, color: theme.textMuted, marginTop: 12, marginBottom: 16 },
  resetFilterBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.primary + '15', borderRadius: theme.borderRadius.full },
  resetFilterText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  emptyTournament: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTournamentIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.carreauColor + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTournamentTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyTournamentText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  createTournamentBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.carreauColor, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  createTournamentBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
