
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
  RefreshControl,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useAuth, useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import AdBanner from '@/components/ui/AdBanner';
import { preloadInterstitial } from '@/services/adService';
import { getMyMeetups, getInvitedMeetups, getMeetupResponses, getPendingInvitationsCount, findMeetupByCode, Meetup, MeetupResponse } from '@/services/meetupService';

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
      const scoreA = m.team_a?.score ?? 0;
      const scoreB = m.team_b?.score ?? 0;
      items.push({
        type: 'match',
        id: m.id,
        date: m.date,
        title: `${m.team_a?.players?.map((p: any) => p.name).join(', ') || t('match', 'teamA')}`,
        subtitle: `vs ${m.team_b?.players?.map((p: any) => p.name).join(', ') || t('match', 'teamB')}`,
        result: isDraw ? 'draw' : isWin ? 'win' : 'loss',
        score: `${scoreA} - ${scoreB}`,
        icon: 'sports',
      });
    });

    challenges.slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3).forEach((c: any) => {
      const rate = c.total_shots > 0 ? Math.round((c.success_count / c.total_shots) * 100) : 0;
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

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
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
                    <Image source={{ uri: selfPlayer.avatar }} style={styles.heroAvatarImg} contentFit="cover" transition={200} />
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

        {/* ========== NEXT TOURNAMENT COUNTDOWN ========== */}
        {nextTournament ? (
          <Animated.View entering={FadeInDown.duration(400).delay(140)} style={[styles.section, isTablet && styles.sectionTablet]}>
            <Pressable
              style={({ pressed }) => [styles.tournamentCountdownCard, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}
              onPress={() => router.push(`/tournament/${nextTournament.id}`)}
            >
              <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.tournamentCountdownGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.tournamentCountdownTop}>
                  <View style={styles.tournamentCountdownIcon}>
                    <MaterialIcons name="emoji-events" size={28} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tournamentCountdownLabel}>
                      {nextTournament.status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'upcoming')}
                    </Text>
                    <Text style={styles.tournamentCountdownName} numberOfLines={1}>{nextTournament.name}</Text>
                    <View style={styles.tournamentCountdownMeta}>
                      <MaterialIcons name="place" size={13} color="#92400E" />
                      <Text style={styles.tournamentCountdownCity}>{nextTournament.location?.city || ''}</Text>
                      <Text style={styles.tournamentCountdownDot}>{'\u2022'}</Text>
                      <Text style={styles.tournamentCountdownDate}>
                        {new Date(nextTournament.date).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color="#92400E" />
                </View>

                {countdown ? (
                  <View style={styles.countdownRow}>
                    {countdown.label ? (
                      <View style={styles.countdownBadgeToday}>
                        <MaterialIcons name="local-fire-department" size={16} color="#B45309" />
                        <Text style={styles.countdownBadgeTodayText}>{countdown.label}</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.countdownUnit}>
                          <Text style={styles.countdownValue}>{countdown.days}</Text>
                          <Text style={styles.countdownUnitLabel}>{language === 'fr' ? 'j' : 'd'}</Text>
                        </View>
                        <Text style={styles.countdownSep}>:</Text>
                        <View style={styles.countdownUnit}>
                          <Text style={styles.countdownValue}>{countdown.hours}</Text>
                          <Text style={styles.countdownUnitLabel}>h</Text>
                        </View>
                        <Text style={styles.countdownSep}>:</Text>
                        <View style={styles.countdownUnit}>
                          <Text style={styles.countdownValue}>{countdown.minutes}</Text>
                          <Text style={styles.countdownUnitLabel}>min</Text>
                        </View>
                      </>
                    )}
                  </View>
                ) : null}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ========== MEETUPS SECTION ========== */}
        <Animated.View entering={FadeIn.duration(400).delay(260)} style={[styles.section, isTablet && styles.sectionTablet]}>
          <View style={styles.meetupTitleRow}>
            <View style={styles.meetupTitleLeft}>
              <MaterialIcons name="event" size={20} color={theme.accent} />
              <Text style={styles.sectionTitle}>{t('meetup', 'upcomingMeetups')}</Text>
            </View>
            <View style={styles.meetupTitleBtns}>
              {pendingInviteCount > 0 ? (
                <Pressable style={styles.mBtnInvite} onPress={() => router.push('/meetup/invitations' as any)}>
                  <MaterialIcons name="mail" size={14} color={theme.error} />
                  <Text style={styles.mBtnInviteText}>{pendingInviteCount}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.mBtnJoin} onPress={() => setShowJoinMeetupModal(true)}>
                <MaterialIcons name="qr-code" size={14} color={theme.accent} />
              </Pressable>
              <Pressable style={styles.mBtnCreate} onPress={() => router.push('/meetup/new' as any)}>
                <MaterialIcons name="add" size={16} color="#FFF" />
              </Pressable>
            </View>
          </View>

          {meetups.length > 0 ? (
            <View style={styles.meetupCards}>
              {/* Next meetup - prominent card */}
              {(() => {
                const m = meetups[0];
                const mDate = new Date(m.date);
                const daysUntil = Math.max(0, Math.ceil((mDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                return (
                  <Pressable
                    style={({ pressed }) => [styles.meetupNextCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => router.push(`/meetup/${m.id}` as any)}
                  >
                    <LinearGradient colors={['#E0F2FE', '#BAE6FD']} style={styles.meetupNextGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <View style={styles.meetupNextTop}>
                        <View style={styles.meetupNextDateBox}>
                          <Text style={styles.meetupNextDateDay}>{mDate.getDate()}</Text>
                          <Text style={styles.meetupNextDateMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                        </View>
                        <View style={styles.meetupNextInfo}>
                          <Text style={styles.meetupNextTitle} numberOfLines={1}>{m.title}</Text>
                          <View style={styles.meetupNextMeta}>
                            <MaterialIcons name="schedule" size={13} color="#0369A1" />
                            <Text style={styles.meetupNextTime}>
                              {mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {daysUntil <= 1 ? (
                              <View style={styles.meetupNextSoonBadge}>
                                <Text style={styles.meetupNextSoonText}>{daysUntil === 0 ? t('notifications', 'todayLabel') : t('notifications', 'tomorrowLabel')}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color="#0369A1" />
                      </View>
                      <View style={styles.meetupNextBottom}>
                        <View style={styles.meetupNextParticipants}>
                          <MaterialIcons name="group" size={14} color="#0369A1" />
                          <Text style={styles.meetupNextParticipantsText}>{m._acceptedCount || 0}/{m._maxParticipants || 8} {t('meetup', 'confirmedCount')}</Text>
                        </View>
                        {m._source === 'created' ? (
                          <View style={styles.meetupNextCreatorTag}>
                            <MaterialIcons name="person" size={11} color={theme.primary} />
                            <Text style={styles.meetupNextCreatorText}>{t('meetup', 'yourMeetup')}</Text>
                          </View>
                        ) : (
                          <View style={styles.meetupNextInvitedTag}>
                            <MaterialIcons name="mail" size={11} color={theme.accent} />
                            <Text style={styles.meetupNextInvitedText}>{t('meetup', 'invited')}</Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </Pressable>
                );
              })()}

              {/* Additional meetups link */}
              {meetups.length > 1 ? (
                <Pressable
                  style={({ pressed }) => [styles.meetupMoreLink, pressed && { opacity: 0.7 }]}
                  onPress={() => setShowMeetupListModal(true)}
                >
                  <MaterialIcons name="date-range" size={16} color={theme.accent} />
                  <Text style={styles.meetupMoreText}>
                    +{meetups.length - 1} {language === 'fr' ? 'autre(s) RDV' : 'more meetup(s)'}
                  </Text>
                  <MaterialIcons name="chevron-right" size={18} color={theme.accent} />
                </Pressable>
              ) : null}
            </View>
          ) : !meetupsLoading ? (
            <View style={styles.meetupEmptyBlock}>
              <MaterialIcons name="event-available" size={28} color={theme.textMuted} />
              <Text style={styles.meetupEmptyText}>{t('meetup', 'noMeetups')}</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* ========== QUICK ACCESS GRID ========== */}
        <Animated.View entering={FadeInDown.duration(400).delay(320)} style={[styles.section, isTablet && styles.sectionTablet]}>
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

        {/* ========== LAST 3 RESULTS TIMELINE ========== */}
        {recentResults.length > 0 ? (
          <Animated.View entering={FadeIn.duration(400).delay(380)} style={[styles.historySection, isTablet && styles.sectionTablet]}>
            <View style={styles.historySectionHeader}>
              <View style={styles.historySectionHeaderLeft}>
                <View style={styles.historySectionIcon}>
                  <MaterialIcons name="history" size={18} color={theme.primary} />
                </View>
                <Text style={styles.historySectionTitle}>{t('history', 'history')}</Text>
              </View>
              <Pressable onPress={() => router.push('/history')} style={styles.historySeeAllBtn}>
                <Text style={styles.seeAllBtn}>{t('common', 'seeAll')}</Text>
                <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
              </Pressable>
            </View>
            <View style={styles.timeline}>
              {recentResults.map((item, idx) => {
                const d = new Date(item.date);
                const isLast = idx === recentResults.length - 1;
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.timelineItem, pressed && { opacity: 0.85 }]}
                    onPress={() => item.type === 'match' ? router.push(`/match/${item.id}`) : router.push('/history')}
                  >
                    <View style={styles.timelineLine}>
                      <View style={[styles.timelineDot, { backgroundColor: resultColor(item.result) }]}>
                        <MaterialIcons
                          name={item.result === 'win' ? 'check' : item.result === 'loss' ? 'close' : 'remove'}
                          size={12}
                          color="#FFF"
                        />
                      </View>
                      {!isLast ? <View style={styles.timelineConnector} /> : null}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineContentTop}>
                        <View style={[styles.timelineTypeIcon, { backgroundColor: (item.type === 'match' ? theme.primary : theme.accent) + '12' }]}>
                          <MaterialIcons name={item.icon} size={16} color={item.type === 'match' ? theme.primary : theme.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.timelineTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.timelineSub} numberOfLines={1}>{item.subtitle}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.timelineScore, { color: resultColor(item.result) }]}>{item.score}</Text>
                          <Text style={[styles.timelineResult, { color: resultColor(item.result) }]}>{resultLabel(item.result)}</Text>
                        </View>
                      </View>
                      <Text style={styles.timelineDate}>
                        {d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : (matches.length === 0 && challenges.length === 0) ? (
          <Animated.View entering={FadeIn.duration(500).delay(380)} style={[styles.emptyCard, isTablet && styles.emptyCardTablet]}>
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

        {/* Ad Banner */}
        <AdBanner position="inline" />
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
          <ScrollView style={styles.meetupModalScroll} contentContainerStyle={styles.meetupModalScrollContent} showsVerticalScrollIndicator={false}>
            {meetups.map((m) => {
              const mDate = new Date(m.date);
              const isCreator = m._source === 'created';
              const daysUntil = Math.max(0, Math.ceil((mDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              return (
                <Pressable
                  key={m.id}
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
            })}
          </ScrollView>
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
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
            {tournaments.length > 0 ? (
              <>
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
                {filteredTournaments.length > 0 ? (
                  filteredTournaments.map((tournament) => {
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
                  })
                ) : (
                  <View style={styles.emptyFilter}>
                    <MaterialIcons name="filter-list-off" size={40} color={theme.textMuted} />
                    <Text style={styles.emptyFilterText}>{t('home', 'noTournamentFilter')}</Text>
                    <Pressable style={styles.resetFilterBtn} onPress={() => setStatusFilter('all')}>
                      <Text style={styles.resetFilterText}>{t('common', 'seeAll')}</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : (
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
            )}
          </ScrollView>
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  seeAllBtn: { fontSize: 13, fontWeight: '600', color: theme.primary },

  // ========== HERO GRADIENT ==========
  heroGradient: { paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 24 },
  heroGradientTablet: { paddingTop: 32, paddingBottom: 36, paddingHorizontal: 28 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  heroGreeting: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  heroName: { fontSize: 24, fontWeight: '800', color: '#FFF', marginTop: 2 },
  heroTopActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroBellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  heroBellBadge: { position: 'absolute' as const, top: -2, right: -2, backgroundColor: theme.error, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#2563EB' },
  heroBellBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  heroProfileBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.45)' },
  heroAvatarImg: { width: 56, height: 56, borderRadius: 28 },
  heroAvatarLetter: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  heroStatLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)' },

  // ========== ACTIONS ==========
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionsRowTablet: { gap: 20 },
  actionCard: { flex: 1, backgroundColor: theme.surface, borderRadius: 20, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: theme.border, ...theme.shadows.card },
  actionCardTablet: { padding: 26, borderRadius: 24 },
  actionCardPressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  actionIconBg: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...theme.shadows.card },
  actionIconBgTablet: { width: 80, height: 80, borderRadius: 22, marginBottom: 16 },
  actionLabel: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  actionLabelTablet: { fontSize: 18 },
  actionSub: { fontSize: 11, color: theme.textSecondary },

  // ========== TOURNAMENT COUNTDOWN ==========
  tournamentCountdownCard: { borderRadius: 20, overflow: 'hidden', ...theme.shadows.cardElevated },
  tournamentCountdownGradient: { padding: 18 },
  tournamentCountdownTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tournamentCountdownIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(180,83,9,0.12)', alignItems: 'center', justifyContent: 'center' },
  tournamentCountdownLabel: { fontSize: 10, fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 },
  tournamentCountdownName: { fontSize: 17, fontWeight: '800', color: '#78350F', marginTop: 2 },
  tournamentCountdownMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  tournamentCountdownCity: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  tournamentCountdownDot: { fontSize: 12, color: '#92400E' },
  tournamentCountdownDate: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, backgroundColor: 'rgba(180,83,9,0.08)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20 },
  countdownUnit: { alignItems: 'center' },
  countdownValue: { fontSize: 26, fontWeight: '900', color: '#78350F' },
  countdownUnitLabel: { fontSize: 10, fontWeight: '700', color: '#92400E', textTransform: 'uppercase' },
  countdownSep: { fontSize: 22, fontWeight: '700', color: '#92400E', marginHorizontal: 4 },
  countdownBadgeToday: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(180,83,9,0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  countdownBadgeTodayText: { fontSize: 15, fontWeight: '800', color: '#78350F' },

  // ========== TIMELINE ==========
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', gap: 14 },
  timelineLine: { width: 28, alignItems: 'center' },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: theme.border, marginVertical: 4 },
  timelineContent: { flex: 1, backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border, ...theme.shadows.card },
  timelineContentTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineTypeIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  timelineTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  timelineSub: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  timelineScore: { fontSize: 16, fontWeight: '900' },
  timelineResult: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  timelineDate: { fontSize: 11, color: theme.textMuted, marginTop: 8 },

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
  quickItem: { flex: 1, alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8, ...theme.shadows.card },
  quickItemPressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },
  quickIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10, ...theme.shadows.card },
  quickLabel: { fontSize: 11, fontWeight: '600', color: theme.textPrimary, textAlign: 'center' },

  // ========== MEETUP SECTION ==========
  meetupTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  meetupTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meetupTitleBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mBtnInvite: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.error + '12', width: 36, height: 32, borderRadius: 10, justifyContent: 'center' },
  mBtnInviteText: { fontSize: 11, fontWeight: '800', color: theme.error },
  mBtnJoin: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.accent + '12', alignItems: 'center', justifyContent: 'center' },
  mBtnCreate: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  meetupCards: { gap: 10 },
  meetupNextCard: { borderRadius: 18, overflow: 'hidden' as const, ...theme.shadows.cardElevated },
  meetupNextGradient: { padding: 16 },
  meetupNextTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  meetupNextDateBox: { width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(3,105,161,0.12)', alignItems: 'center', justifyContent: 'center' },
  meetupNextDateDay: { fontSize: 22, fontWeight: '900', color: '#0369A1', lineHeight: 24 },
  meetupNextDateMonth: { fontSize: 9, fontWeight: '700', color: '#0369A1', letterSpacing: 0.5 },
  meetupNextInfo: { flex: 1 },
  meetupNextTitle: { fontSize: 16, fontWeight: '800', color: '#0C4A6E', marginBottom: 4 },
  meetupNextMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meetupNextTime: { fontSize: 13, fontWeight: '600', color: '#0369A1' },
  meetupNextSoonBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  meetupNextSoonText: { fontSize: 10, fontWeight: '700', color: '#B45309' },
  meetupNextBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(3,105,161,0.12)' },
  meetupNextParticipants: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meetupNextParticipantsText: { fontSize: 12, fontWeight: '600', color: '#0369A1' },
  meetupNextCreatorTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  meetupNextCreatorText: { fontSize: 10, fontWeight: '700', color: theme.primary },
  meetupNextInvitedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.accent + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  meetupNextInvitedText: { fontSize: 10, fontWeight: '700', color: theme.accent },
  meetupMoreLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.accent + '08', borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.accent + '18' },
  meetupMoreText: { fontSize: 13, fontWeight: '600', color: theme.accent },
  meetupEmptyBlock: { alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, paddingVertical: 24, gap: 8, borderWidth: 1, borderColor: theme.border },
  meetupEmptyText: { fontSize: 13, color: theme.textMuted, fontWeight: '500' },

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

  // ========== BRAND BANNER ==========
  bannerSection: { paddingHorizontal: 16, marginBottom: 24 },
  bannerCard: { borderRadius: 20, overflow: 'hidden' as const, ...theme.shadows.cardElevated, position: 'relative' as const },
  bannerImage: { width: '100%', height: 110, borderRadius: 20 },
  bannerOverlay: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, height: 50, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  // ========== HISTORY SECTION ==========
  historySection: { marginTop: 0, marginBottom: 24, backgroundColor: theme.surface, marginHorizontal: 16, borderRadius: 20, padding: 16, ...theme.shadows.card, borderWidth: 1, borderColor: theme.border, zIndex: 1 },
  historySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  historySectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historySectionIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' },
  historySectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
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
