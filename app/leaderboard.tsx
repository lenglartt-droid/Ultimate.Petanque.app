import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import theme, { blurhash } from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert } from '@/template';
import { useApp } from '@/contexts/AppContext';
import { fetchLeaderboard, sortLeaderboard, LeaderboardPlayer, LeaderboardSort } from '@/services/leaderboardService';
import { fetchClubLeaderboard, sortClubLeaderboard, LeaderboardClub, ClubLeaderboardSort } from '@/services/clubLeaderboardService';
import { fetchBoulesLeaderboard, aggregateBoulesData, sortBoulesLeaderboard, LeaderboardBoulesEntry, BoulesLeaderboardSort, BoulesLeaderboardMode } from '@/services/boulesLeaderboardService';
import { getMyActiveMeetups, inviteSingleUserToMeetup, Meetup } from '@/services/meetupService';
import AdBanner from '@/components/ui/AdBanner';

type LeaderboardTab = 'players' | 'clubs' | 'boules';

const PAGE_SIZE = 30;

const MemoizedPlayerRow = React.memo(function PlayerRow({
  player,
  rank,
  isMe,
  sortBy,
  onPress,
  onInvite,
  language,
  t,
}: {
  player: LeaderboardPlayer;
  rank: number;
  isMe: boolean;
  sortBy: LeaderboardSort;
  onPress: () => void;
  onInvite: (() => void) | null;
  language: string;
  t: (s: string, k: string) => string;
}) {
  const medalColors: Record<number, string> = { 1: '#FFD700', 2: '#A8B4C0', 3: '#CD7F32' };
  const medalColor = medalColors[rank];

  return (
    <Pressable style={[s.row, isMe && s.rowMe]} onPress={onPress}>
      {/* Rank */}
      <View style={s.rankCol}>
        {medalColor ? (
          <View style={[s.medal, { backgroundColor: medalColor + '20' }]}>
            <Text style={[s.medalText, { color: medalColor }]}>{rank}</Text>
          </View>
        ) : (
          <Text style={s.rankText}>{rank}</Text>
        )}
      </View>

      {/* Player info */}
      <View style={s.playerCol}>
        <View style={s.avatarWrap}>
          {player.avatar ? (
            <Image
              source={{ uri: player.avatar }}
              style={s.avatar}
              contentFit="cover"
              transition={200}
              placeholder={{ blurhash: blurhash.avatar }}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[s.avatar, { backgroundColor: isMe ? theme.primary : theme.textMuted + '30', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: isMe ? '#FFF' : theme.textSecondary }}>{player.name.charAt(0)}</Text>
            </View>
          )}
          {isMe ? <View style={s.meBadge}><MaterialIcons name="star" size={8} color="#FFF" /></View> : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[s.playerName, isMe && { color: theme.primary }]} numberOfLines={1}>
              {player.name}{isMe ? ` (${t('leaderboard', 'you')})` : ''}
            </Text>
            {player.isPremium ? (
              <View style={s.premiumBadge}>
                <MaterialIcons name="star" size={9} color="#A8B4C0" />
              </View>
            ) : null}
          </View>
          <View style={s.playerMeta}>
            {player.club ? <Text style={s.playerClub} numberOfLines={1}>{player.club}</Text> : null}
            {player.city ? (
              <>
                {player.club ? <View style={s.metaDot} /> : null}
                <Text style={s.playerCity} numberOfLines={1}>{player.city}</Text>
              </>
            ) : null}
          </View>
          <View style={s.playerTags}>
            <View style={[s.playerTag, { backgroundColor: theme.primary + '12' }]}>
              <Text style={[s.playerTagText, { color: theme.primary }]}>{t('roles', player.role)}</Text>
            </View>
            <View style={[s.playerTag, { backgroundColor: theme.accent + '12' }]}>
              <Text style={[s.playerTagText, { color: theme.accent }]}>{t('levels', player.level)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsCol}>
        <View style={s.statBlock}>
          <Text style={[s.statValue, sortBy === 'winRate' && { color: '#D97706', fontWeight: '800' }]}>{player.stats.winRate}%</Text>
          <Text style={s.statLabel}>{t('leaderboard', 'winRate')}</Text>
        </View>
        <View style={s.statBlock}>
          <Text style={[s.statValue, sortBy === 'matches' && { color: '#D97706', fontWeight: '800' }]}>{player.stats.matchesPlayed}</Text>
          <Text style={s.statLabel}>{t('leaderboard', 'matches')}</Text>
        </View>
        <View style={s.statBlock}>
          <Text style={[s.statValue, sortBy === 'tirRate' && { color: theme.tirColor, fontWeight: '800' }]}>{player.stats.tirRate > 0 ? `${player.stats.tirRate}%` : '-'}</Text>
          <Text style={s.statLabel}>{t('leaderboard', 'shotRate')}</Text>
        </View>
        <View style={s.statBlock}>
          <Text style={[s.statValue, sortBy === 'pointRate' && { color: theme.pointColor, fontWeight: '800' }]}>{player.stats.pointRate > 0 ? `${player.stats.pointRate}%` : '-'}</Text>
          <Text style={s.statLabel}>Pt</Text>
        </View>
        <View style={s.statBlock}>
          <Text style={[s.statValue, sortBy === 'carreauRate' && { color: theme.carreauColor, fontWeight: '800' }]}>{player.stats.carreauRate > 0 ? `${player.stats.carreauRate}%` : '-'}</Text>
          <Text style={s.statLabel}>Car.</Text>
        </View>
      </View>

      {/* Invite button for non-self real users */}
      {onInvite ? (
        <Pressable
          style={s.inviteBtn}
          onPress={(e) => { e.stopPropagation?.(); onInvite(); }}
          hitSlop={6}
        >
          <MaterialIcons name="event" size={16} color={theme.primary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { selfPlayer } = useApp();

  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;

  // ============ TAB STATE ============
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('players');

  // ============ PLAYERS STATE ============
  const [allPlayers, setAllPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<LeaderboardSort>('winRate');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterClub, setFilterClub] = useState<string>('all');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [filterTerrain, setFilterTerrain] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSearchText, setFilterSearchText] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ============ CLUBS STATE ============
  const [allClubs, setAllClubs] = useState<LeaderboardClub[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const [clubSortBy, setClubSortBy] = useState<ClubLeaderboardSort>('compositeScore');
  const [clubSearch, setClubSearch] = useState('');
  const [clubsLoaded, setClubsLoaded] = useState(false);

  // ============ BOULES STATE ============
  const [boulesRawData, setBoulesRawData] = useState<any[]>([]);
  const [boulesLoading, setBoulesLoading] = useState(false);
  const [boulesError, setBoulesError] = useState<string | null>(null);
  const [boulesSortBy, setBoulesSortBy] = useState<BoulesLeaderboardSort>('avgWinRate');
  const [boulesMode, setBoulesMode] = useState<BoulesLeaderboardMode>('brand');
  const [boulesRoleFilter, setBoulesRoleFilter] = useState<string>('all');
  const [boulesSearch, setBoulesSearch] = useState('');
  const [boulesLoaded, setBoulesLoaded] = useState(false);

  // Meetup invitation
  const [showMeetupPicker, setShowMeetupPicker] = useState(false);
  const [meetupPickerUserId, setMeetupPickerUserId] = useState<string | null>(null);
  const [meetupPickerUserName, setMeetupPickerUserName] = useState('');
  const [activeMeetups, setActiveMeetups] = useState<Meetup[]>([]);
  const [loadingMeetups, setLoadingMeetups] = useState(false);
  const [invitingToMeetup, setInvitingToMeetup] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { players: lbP, error: err } = await fetchLeaderboard();
    setAllPlayers(lbP);
    setError(err);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Lazy load clubs when tab is selected
  const loadClubs = useCallback(async () => {
    if (clubsLoaded) return;
    setClubsLoading(true);
    const { clubs: c, error: err } = await fetchClubLeaderboard();
    setAllClubs(c);
    setClubsError(err);
    setClubsLoading(false);
    setClubsLoaded(true);
  }, [clubsLoaded]);

  // Lazy load boules when tab is selected
  const loadBoules = useCallback(async () => {
    if (boulesLoaded) return;
    setBoulesLoading(true);
    const { entries, error: err } = await fetchBoulesLeaderboard();
    setBoulesRawData(entries);
    setBoulesError(err);
    setBoulesLoading(false);
    setBoulesLoaded(true);
  }, [boulesLoaded]);

  useEffect(() => {
    if (activeTab === 'clubs') loadClubs();
    if (activeTab === 'boules') loadBoules();
  }, [activeTab, loadClubs, loadBoules]);

  // ============ CLUBS COMPUTED ============
  const filteredClubs = useMemo(() => {
    let result = allClubs;
    if (clubSearch.trim()) {
      const q = clubSearch.toLowerCase().trim();
      result = result.filter(c => c.name.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q));
    }
    return sortClubLeaderboard(result, clubSortBy);
  }, [allClubs, clubSearch, clubSortBy]);

  // ============ BOULES COMPUTED ============
  const boulesEntries = useMemo(() => {
    const aggregated = aggregateBoulesData(boulesRawData, boulesMode, boulesRoleFilter);
    let result = aggregated;
    if (boulesSearch.trim()) {
      const q = boulesSearch.toLowerCase().trim();
      result = result.filter(e => e.brand.toLowerCase().includes(q) || (e.model || '').toLowerCase().includes(q));
    }
    return sortBoulesLeaderboard(result, boulesSortBy);
  }, [boulesRawData, boulesMode, boulesRoleFilter, boulesSearch, boulesSortBy]);

  // Extract unique cities for filter
  const uniqueCities = useMemo(() => {
    const cities = allPlayers.map(p => p.city).filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [allPlayers]);

  const uniqueCountries = useMemo(() => {
    const countries = allPlayers.map(p => p.country).filter(Boolean) as string[];
    return [...new Set(countries)].sort();
  }, [allPlayers]);

  const uniqueClubs = useMemo(() => {
    const clubs = allPlayers.map(p => p.club).filter(Boolean) as string[];
    return [...new Set(clubs)].sort();
  }, [allPlayers]);

  const uniqueBrands = useMemo(() => {
    const brands = allPlayers.map(p => p.boulesBrand).filter(Boolean) as string[];
    return [...new Set(brands)].sort();
  }, [allPlayers]);

  const uniqueTerrains = useMemo(() => {
    const tNames = allPlayers.map(p => p.terrainName).filter(Boolean) as string[];
    return [...new Set(tNames)].sort();
  }, [allPlayers]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    return [filterRole, filterLevel, filterCity, filterCountry, filterClub, filterBrand, filterTerrain].filter(f => f !== 'all').length;
  }, [filterRole, filterLevel, filterCity, filterCountry, filterClub, filterBrand, filterTerrain]);

  // Filtered, sorted, paginated data
  const filteredSorted = useMemo(() => {
    let result = allPlayers;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.nickname || '').toLowerCase().includes(q) ||
        (p.club || '').toLowerCase().includes(q) ||
        (p.city || '').toLowerCase().includes(q)
      );
    }

    // Filters
    if (filterRole !== 'all') result = result.filter(p => p.role === filterRole);
    if (filterLevel !== 'all') result = result.filter(p => p.level === filterLevel);
    if (filterCity !== 'all') result = result.filter(p => p.city === filterCity);
    if (filterCountry !== 'all') result = result.filter(p => p.country === filterCountry);
    if (filterClub !== 'all') result = result.filter(p => p.club === filterClub);
    if (filterBrand !== 'all') result = result.filter(p => p.boulesBrand === filterBrand);
    if (filterTerrain !== 'all') result = result.filter(p => p.terrainName === filterTerrain);

    return sortLeaderboard(result, sortBy);
  }, [allPlayers, search, filterRole, filterLevel, filterCity, filterCountry, filterClub, filterBrand, filterTerrain, sortBy]);

  const paginatedData = useMemo(() => filteredSorted.slice(0, visibleCount), [filteredSorted, visibleCount]);
  const hasMore = filteredSorted.length > visibleCount;

  // Reset pagination on filter/search change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, filterRole, filterLevel, filterCity, filterCountry, filterClub, filterBrand, filterTerrain, sortBy]);

  const handleLoadMore = useCallback(() => {
    if (hasMore) setVisibleCount(prev => prev + PAGE_SIZE);
  }, [hasMore]);

  // My rank
  const myRank = useMemo(() => {
    if (!selfPlayer || !user) return null;
    const idx = filteredSorted.findIndex(p => p.userId === user.id || p.id === selfPlayer.id);
    return idx >= 0 ? idx + 1 : null;
  }, [filteredSorted, selfPlayer, user]);

  const clearFilters = () => {
    setFilterRole('all');
    setFilterLevel('all');
    setFilterCity('all');
    setFilterCountry('all');
    setFilterClub('all');
    setFilterBrand('all');
    setFilterTerrain('all');
    setSearch('');
    setFilterSearchText('');
  };

  const handleInviteToMeetup = useCallback(async (targetUserId: string, targetName: string) => {
    Haptics.selectionAsync();
    setMeetupPickerUserId(targetUserId);
    setMeetupPickerUserName(targetName);
    setLoadingMeetups(true);
    setShowMeetupPicker(true);
    const { meetups: mts } = await getMyActiveMeetups();
    setActiveMeetups(mts);
    setLoadingMeetups(false);
  }, []);

  const handleConfirmInvite = useCallback(async (meetupId: string) => {
    if (!meetupPickerUserId) return;
    setInvitingToMeetup(meetupId);
    const { error: err } = await inviteSingleUserToMeetup(meetupId, meetupPickerUserId);
    setInvitingToMeetup(null);
    if (err === 'already_participant') {
      showAlert(t('meetup', 'alreadyParticipant'));
    } else if (err) {
      showAlert(t('common', 'error'), err);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('meetup', 'inviteSentSuccess'), t('meetup', 'inviteSentSuccessDesc'));
      setShowMeetupPicker(false);
    }
  }, [meetupPickerUserId, showAlert, t]);

  const renderItem = useCallback(({ item, index }: { item: LeaderboardPlayer; index: number }) => {
    const rank = index + 1;
    const isMe = !!(user && (item.userId === user.id || (selfPlayer && item.id === selfPlayer.id)));
    const canInvite = !isMe && item.userId && item.userId !== user?.id;
    return (
      <MemoizedPlayerRow
        player={item}
        rank={rank}
        isMe={isMe}
        sortBy={sortBy}
        onPress={() => router.push(isMe ? '/player/me' : `/player/${item.id}` as any)}
        onInvite={canInvite ? () => handleInviteToMeetup(item.userId, item.name) : null}
        language={language}
        t={t}
      />
    );
  }, [user, selfPlayer, sortBy, language, t, handleInviteToMeetup]);

  const keyExtractor = useCallback((item: LeaderboardPlayer) => item.id, []);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <LinearGradient colors={['#92400E', '#D97706', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.headerGradient}>
          <View style={s.headerTop}>
            <Pressable style={s.backBtn} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>{t('leaderboard', 'title')}</Text>
              <Text style={s.headerSubtitle}>
                {activeTab === 'players'
                  ? `${filteredSorted.length} ${t('leaderboard', 'publicPlayersCount')}${myRank ? ` \u2022 #${myRank}` : ''}`
                  : activeTab === 'clubs'
                    ? `${filteredClubs.length} ${t('leaderboard', 'publicClubsCount')}`
                    : `${boulesEntries.length} ${boulesMode === 'brand' ? t('leaderboard', 'publicBoulesCount') : t('leaderboard', 'publicModelsCount')}`}
              </Text>
            </View>
          </View>

          {/* Tab switcher */}
          <View style={s.tabRow}>
            {([{ id: 'players' as LeaderboardTab, label: t('leaderboard', 'tabPlayers'), icon: 'people' },
              { id: 'clubs' as LeaderboardTab, label: t('leaderboard', 'tabClubs'), icon: 'home' },
              { id: 'boules' as LeaderboardTab, label: t('leaderboard', 'tabBoules'), icon: 'sports-baseball' },
            ]).map(tab => (
              <Pressable
                key={tab.id}
                style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.id); }}
              >
                <MaterialIcons name={tab.icon as any} size={16} color={activeTab === tab.id ? '#FFF' : 'rgba(255,255,255,0.5)'} />
                <Text style={[s.tabBtnText, activeTab === tab.id && s.tabBtnTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Search bar */}
          <View style={s.searchRow}>
            <View style={s.searchBar}>
              <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={s.searchInput}
                placeholder={t('leaderboard', 'searchPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={activeTab === 'players' ? search : activeTab === 'clubs' ? clubSearch : boulesSearch}
                onChangeText={activeTab === 'players' ? setSearch : activeTab === 'clubs' ? setClubSearch : setBoulesSearch}
              />
              {(activeTab === 'players' ? search : activeTab === 'clubs' ? clubSearch : boulesSearch).length > 0 ? (
                <Pressable onPress={() => activeTab === 'players' ? setSearch('') : activeTab === 'clubs' ? setClubSearch('') : setBoulesSearch('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </Pressable>
              ) : null}
            </View>
            {activeTab === 'players' ? (
              <Pressable
                style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setShowFilters(!showFilters); }}
              >
                <MaterialIcons name="tune" size={20} color={activeFilterCount > 0 ? '#FFF' : 'rgba(255,255,255,0.6)'} />
                {activeFilterCount > 0 ? (
                  <View style={s.filterBadge}>
                    <Text style={s.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </LinearGradient>

        {/* Sort chips - context-dependent */}
        <View style={s.sortWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow}>
            {activeTab === 'players' ? ([
              { id: 'winRate' as LeaderboardSort, label: t('leaderboard', 'sortByWinRate'), icon: 'emoji-events' },
              { id: 'matches' as LeaderboardSort, label: t('leaderboard', 'sortByMatches'), icon: 'sports' },
              { id: 'tirRate' as LeaderboardSort, label: t('leaderboard', 'sortByTirRate'), icon: 'gps-fixed' },
              { id: 'pointRate' as LeaderboardSort, label: t('leaderboard', 'sortByPointRate'), icon: 'adjust' },
              { id: 'carreauRate' as LeaderboardSort, label: t('leaderboard', 'sortByCarreauRate'), icon: 'stars' },
            ]).map(chip => (
              <Pressable
                key={chip.id}
                style={[s.sortChip, sortBy === chip.id && s.sortChipActive]}
                onPress={() => { Haptics.selectionAsync(); setSortBy(chip.id); }}
              >
                <MaterialIcons name={chip.icon as any} size={14} color={sortBy === chip.id ? '#FFF' : theme.textSecondary} />
                <Text style={[s.sortChipText, sortBy === chip.id && s.sortChipTextActive]}>{chip.label}</Text>
              </Pressable>
            )) : activeTab === 'clubs' ? ([
              { id: 'compositeScore' as ClubLeaderboardSort, label: t('leaderboard', 'sortByComposite'), icon: 'stars' },
              { id: 'avgWinRate' as ClubLeaderboardSort, label: t('leaderboard', 'sortByAvgWinRate'), icon: 'emoji-events' },
              { id: 'totalMatches' as ClubLeaderboardSort, label: t('leaderboard', 'sortByTotalMatches'), icon: 'sports' },
              { id: 'playerCount' as ClubLeaderboardSort, label: t('leaderboard', 'sortByPlayerCount'), icon: 'people' },
              { id: 'avgTirRate' as ClubLeaderboardSort, label: t('leaderboard', 'sortByAvgTirRate'), icon: 'gps-fixed' },
            ]).map(chip => (
              <Pressable
                key={chip.id}
                style={[s.sortChip, clubSortBy === chip.id && s.sortChipActive]}
                onPress={() => { Haptics.selectionAsync(); setClubSortBy(chip.id); }}
              >
                <MaterialIcons name={chip.icon as any} size={14} color={clubSortBy === chip.id ? '#FFF' : theme.textSecondary} />
                <Text style={[s.sortChipText, clubSortBy === chip.id && s.sortChipTextActive]}>{chip.label}</Text>
              </Pressable>
            )) : ([
              { id: 'avgWinRate' as BoulesLeaderboardSort, label: t('leaderboard', 'sortByAvgWinRate'), icon: 'emoji-events' },
              { id: 'userCount' as BoulesLeaderboardSort, label: t('leaderboard', 'boulesPopularity'), icon: 'people' },
              { id: 'totalMatches' as BoulesLeaderboardSort, label: t('leaderboard', 'sortByTotalMatches'), icon: 'sports' },
              { id: 'avgTirRate' as BoulesLeaderboardSort, label: t('leaderboard', 'sortByAvgTirRate'), icon: 'gps-fixed' },
              { id: 'avgCarreauRate' as BoulesLeaderboardSort, label: t('leaderboard', 'sortByAvgCarreauRate'), icon: 'stars' },
            ]).map(chip => (
              <Pressable
                key={chip.id}
                style={[s.sortChip, boulesSortBy === chip.id && s.sortChipActive]}
                onPress={() => { Haptics.selectionAsync(); setBoulesSortBy(chip.id); }}
              >
                <MaterialIcons name={chip.icon as any} size={14} color={boulesSortBy === chip.id ? '#FFF' : theme.textSecondary} />
                <Text style={[s.sortChipText, boulesSortBy === chip.id && s.sortChipTextActive]}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Boules-specific: mode toggle + role filter */}
          {activeTab === 'boules' ? (
            <View style={s.boulesExtraFilters}>
              <View style={s.boulesModePills}>
                <Pressable
                  style={[s.bModePill, boulesMode === 'brand' && s.bModePillActive]}
                  onPress={() => { Haptics.selectionAsync(); setBoulesMode('brand'); }}
                >
                  <Text style={[s.bModePillText, boulesMode === 'brand' && s.bModePillTextActive]}>{t('leaderboard', 'modeBrand')}</Text>
                </Pressable>
                <Pressable
                  style={[s.bModePill, boulesMode === 'model' && s.bModePillActive]}
                  onPress={() => { Haptics.selectionAsync(); setBoulesMode('model'); }}
                >
                  <Text style={[s.bModePillText, boulesMode === 'model' && s.bModePillTextActive]}>{t('leaderboard', 'modeModel')}</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['all', 'Tireur', 'Pointeur', 'Milieu'].map(role => (
                  <Pressable
                    key={role}
                    style={[s.sortChip, { paddingHorizontal: 10, paddingVertical: 6 }, boulesRoleFilter === role && s.sortChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setBoulesRoleFilter(role); }}
                  >
                    <Text style={[s.sortChipText, { fontSize: 11 }, boulesRoleFilter === role && s.sortChipTextActive]}>
                      {role === 'all' ? t('leaderboard', 'boulesAllRoles') : t('roles', role)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>

      {/* ============ CLUBS TAB ============ */}
      {activeTab === 'clubs' ? (
        clubsLoading ? (
          <View style={s.centerState}>
            <View style={s.loadingIconBg}><MaterialIcons name="home" size={32} color="#D97706" /></View>
            <Text style={s.loadingText}>{t('leaderboard', 'loading')}</Text>
          </View>
        ) : clubsError ? (
          <View style={s.centerState}>
            <MaterialIcons name="error-outline" size={48} color={theme.error} />
            <Text style={s.errorText}>{t('leaderboard', 'errorLoading')}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setClubsLoaded(false); loadClubs(); }}>
              <Text style={s.retryBtnText}>{t('leaderboard', 'retry')}</Text>
            </Pressable>
          </View>
        ) : filteredClubs.length === 0 ? (
          <View style={s.centerState}>
            <MaterialIcons name="home" size={56} color={theme.textMuted} />
            <Text style={s.emptyTitle}>{t('leaderboard', 'noClubs')}</Text>
            <Text style={s.emptyDesc}>{t('leaderboard', 'noClubsDesc')}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredClubs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 32 }, isTablet && s.listContentTablet]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: club, index }) => {
              const rank = index + 1;
              const medalColors: Record<number, string> = { 1: '#FFD700', 2: '#A8B4C0', 3: '#CD7F32' };
              const medalColor = medalColors[rank];
              return (
                <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 40, 400))}>
                  <Pressable style={s.clubRow} onPress={() => router.push(`/club/${club.id}` as any)}>
                    <View style={s.clubHeader}>
                      <View style={s.rankCol}>
                        {medalColor ? (
                          <View style={[s.medal, { backgroundColor: medalColor + '20' }]}>
                            <Text style={[s.medalText, { color: medalColor }]}>{rank}</Text>
                          </View>
                        ) : (
                          <Text style={s.rankText}>{rank}</Text>
                        )}
                      </View>
                      <View style={s.clubLogoWrap}>
                        {club.logo ? (
                          <Image source={{ uri: club.logo }} style={s.clubLogo} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                        ) : (
                          <View style={[s.clubLogo, { backgroundColor: '#D97706' + '15', alignItems: 'center', justifyContent: 'center' }]}>
                            <MaterialIcons name="home" size={18} color="#D97706" />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.clubName} numberOfLines={1}>{club.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          {club.city ? <Text style={s.clubCity} numberOfLines={1}>{club.city}</Text> : null}
                          <View style={s.clubMeta}>
                            <MaterialIcons name="people" size={11} color={theme.textMuted} />
                            <Text style={s.clubMetaText}>{club.playerCount}</Text>
                          </View>
                          <View style={s.clubMeta}>
                            <MaterialIcons name="sports" size={11} color={theme.textMuted} />
                            <Text style={s.clubMetaText}>{club.totalMatches}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.clubScoreBadge}>
                        <Text style={s.clubScoreValue}>{club.stats.compositeScore}</Text>
                        <Text style={s.clubScoreLabel}>{t('leaderboard', 'clubComposite')}</Text>
                      </View>
                    </View>
                    <View style={s.clubStats}>
                      <View style={s.clubStatItem}>
                        <Text style={[s.clubStatValue, clubSortBy === 'avgWinRate' && { color: '#D97706', fontWeight: '800' }]}>{club.stats.avgWinRate}%</Text>
                        <Text style={s.clubStatLabel}>{t('leaderboard', 'clubAvgWin')}</Text>
                      </View>
                      <View style={s.clubStatItem}>
                        <Text style={[s.clubStatValue, clubSortBy === 'avgTirRate' && { color: theme.tirColor, fontWeight: '800' }]}>{club.stats.avgTirRate > 0 ? `${club.stats.avgTirRate}%` : '-'}</Text>
                        <Text style={s.clubStatLabel}>{t('leaderboard', 'clubTir')}</Text>
                      </View>
                      <View style={s.clubStatItem}>
                        <Text style={[s.clubStatValue, clubSortBy === 'avgCarreauRate' && { color: theme.carreauColor, fontWeight: '800' }]}>{club.stats.avgCarreauRate > 0 ? `${club.stats.avgCarreauRate}%` : '-'}</Text>
                        <Text style={s.clubStatLabel}>{t('leaderboard', 'clubCarreau')}</Text>
                      </View>
                      <View style={s.clubStatItem}>
                        <Text style={s.clubStatValue}>{club.stats.avgPointRate > 0 ? `${club.stats.avgPointRate}%` : '-'}</Text>
                        <Text style={s.clubStatLabel}>{t('leaderboard', 'clubPoint')}</Text>
                      </View>
                    </View>
                    {club.topPlayers.length > 0 ? (
                      <View style={s.clubTopPlayers}>
                        <Text style={s.clubTopLabel}>{t('leaderboard', 'topPlayersLabel')}</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {club.topPlayers.map((tp, i) => (
                            <View key={i} style={s.clubTopPlayer}>
                              {tp.avatar ? (
                                <Image source={{ uri: tp.avatar }} style={s.clubTopAvatar} contentFit="cover" cachePolicy="memory-disk" />
                              ) : (
                                <View style={[s.clubTopAvatar, { backgroundColor: theme.primary + '20', alignItems: 'center', justifyContent: 'center' }]}>
                                  <Text style={{ fontSize: 9, fontWeight: '700', color: theme.primary }}>{tp.name.charAt(0)}</Text>
                                </View>
                              )}
                              <Text style={s.clubTopPlayerName} numberOfLines={1}>{tp.name.split(' ')[0]}</Text>
                              <Text style={s.clubTopPlayerStat}>{tp.winRate}%</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            }}
            ListFooterComponent={filteredClubs.length > 3 ? <AdBanner position="inline" /> : null}
          />
        )
      ) : activeTab === 'boules' ? (
        /* ============ BOULES TAB ============ */
        boulesLoading ? (
          <View style={s.centerState}>
            <View style={s.loadingIconBg}><MaterialIcons name="sports-baseball" size={32} color="#D97706" /></View>
            <Text style={s.loadingText}>{t('leaderboard', 'loading')}</Text>
          </View>
        ) : boulesError ? (
          <View style={s.centerState}>
            <MaterialIcons name="error-outline" size={48} color={theme.error} />
            <Text style={s.errorText}>{t('leaderboard', 'errorLoading')}</Text>
            <Pressable style={s.retryBtn} onPress={() => { setBoulesLoaded(false); loadBoules(); }}>
              <Text style={s.retryBtnText}>{t('leaderboard', 'retry')}</Text>
            </Pressable>
          </View>
        ) : boulesEntries.length === 0 ? (
          <View style={s.centerState}>
            <MaterialIcons name="sports-baseball" size={56} color={theme.textMuted} />
            <Text style={s.emptyTitle}>{t('leaderboard', 'noBoules')}</Text>
            <Text style={s.emptyDesc}>{t('leaderboard', 'noBoulesDesc')}</Text>
          </View>
        ) : (
          <FlatList
            data={boulesEntries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 32 }, isTablet && s.listContentTablet]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: entry, index }) => {
              const rank = index + 1;
              const medalColors: Record<number, string> = { 1: '#FFD700', 2: '#A8B4C0', 3: '#CD7F32' };
              const medalColor = medalColors[rank];
              return (
                <Animated.View entering={FadeIn.duration(200).delay(Math.min(index * 40, 400))}>
                  <View style={s.boulesRow}>
                    <View style={s.boulesHeader}>
                      <View style={s.rankCol}>
                        {medalColor ? (
                          <View style={[s.medal, { backgroundColor: medalColor + '20' }]}>
                            <Text style={[s.medalText, { color: medalColor }]}>{rank}</Text>
                          </View>
                        ) : (
                          <Text style={s.rankText}>{rank}</Text>
                        )}
                      </View>
                      <View style={s.boulesIconWrap}>
                        <MaterialIcons name="sports-baseball" size={20} color="#D97706" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.boulesName} numberOfLines={1}>{entry.brand}{entry.model ? ` ${entry.model}` : ''}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                          <View style={s.clubMeta}>
                            <MaterialIcons name="people" size={11} color={theme.textMuted} />
                            <Text style={s.clubMetaText}>{entry.userCount} {t('leaderboard', 'boulesUsers')}</Text>
                          </View>
                          <View style={s.clubMeta}>
                            <MaterialIcons name="sports" size={11} color={theme.textMuted} />
                            <Text style={s.clubMetaText}>{entry.totalMatches} {t('leaderboard', 'boulesMatches')}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={s.clubStats}>
                      <View style={s.clubStatItem}>
                        <Text style={[s.clubStatValue, boulesSortBy === 'avgWinRate' && { color: '#D97706', fontWeight: '800' }]}>{entry.stats.avgWinRate}%</Text>
                        <Text style={s.clubStatLabel}>{t('leaderboard', 'boulesAvgWin')}</Text>
                      </View>
                      <View style={s.clubStatItem}>
                        <Text style={[s.clubStatValue, boulesSortBy === 'avgTirRate' && { color: theme.tirColor, fontWeight: '800' }]}>{entry.stats.avgTirRate > 0 ? `${entry.stats.avgTirRate}%` : '-'}</Text>
                        <Text style={s.clubStatLabel}>{t('leaderboard', 'boulesTir')}</Text>
                      </View>
                      <View style={s.clubStatItem}>
                        <Text style={[s.clubStatValue, boulesSortBy === 'avgCarreauRate' && { color: theme.carreauColor, fontWeight: '800' }]}>{entry.stats.avgCarreauRate > 0 ? `${entry.stats.avgCarreauRate}%` : '-'}</Text>
                        <Text style={s.clubStatLabel}>{t('leaderboard', 'boulesCarreau')}</Text>
                      </View>
                      <View style={s.clubStatItem}>
                        <Text style={s.clubStatValue}>{entry.stats.avgPointRate > 0 ? `${entry.stats.avgPointRate}%` : '-'}</Text>
                        <Text style={s.clubStatLabel}>{t('leaderboard', 'boulesPoint')}</Text>
                      </View>
                    </View>
                    {entry.byRole && entry.byRole.length > 1 ? (
                      <View style={s.boulesRoleSection}>
                        <Text style={s.boulesRoleTitle}>{t('leaderboard', 'boulesRoleBreakdown')}</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {entry.byRole.map((r, ri) => (
                            <View key={ri} style={s.boulesRoleChip}>
                              <Text style={s.boulesRoleName}>{t('roles', r.role)}</Text>
                              <Text style={s.boulesRoleStat}>{r.avgWinRate}% V</Text>
                              <Text style={s.boulesRoleCount}>{r.userCount}p</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </Animated.View>
              );
            }}
            ListFooterComponent={boulesEntries.length > 3 ? <AdBanner position="inline" /> : null}
          />
        )
      ) : (
      /* ============ PLAYERS TAB ============ */
      loading ? (
        <View style={s.centerState}>
          <View style={s.loadingIconBg}>
            <MaterialIcons name="leaderboard" size={32} color="#D97706" />
          </View>
          <Text style={s.loadingText}>{t('leaderboard', 'loading')}</Text>
        </View>
      ) : error ? (
        <View style={s.centerState}>
          <MaterialIcons name="error-outline" size={48} color={theme.error} />
          <Text style={s.errorText}>{t('leaderboard', 'errorLoading')}</Text>
          <Pressable style={s.retryBtn} onPress={loadData}>
            <Text style={s.retryBtnText}>{t('leaderboard', 'retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={paginatedData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            s.listContent,
            { paddingBottom: insets.bottom + 32 },
            isTablet && s.listContentTablet,
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View>
              {/* Filters expandable — inside list so content pushes down */}
              {showFilters ? (
                <Animated.View entering={FadeIn.duration(200)} style={s.filtersPanel}>
                  {/* Panel header with title, count & close */}
                  <View style={s.fpHeader}>
                    <View style={s.fpHeaderLeft}>
                      <View style={s.fpHeaderIcon}>
                        <MaterialIcons name="tune" size={16} color="#D97706" />
                      </View>
                      <Text style={s.fpHeaderTitle}>{language === 'fr' ? 'Filtres' : 'Filters'}</Text>
                      {activeFilterCount > 0 ? (
                        <View style={s.fpCountBadge}>
                          <Text style={s.fpCountBadgeText}>{activeFilterCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={s.fpHeaderRight}>
                      {activeFilterCount > 0 ? (
                        <Pressable style={s.fpClearBtn} onPress={clearFilters} hitSlop={6}>
                          <MaterialIcons name="clear-all" size={16} color={theme.error} />
                          <Text style={s.fpClearBtnText}>{t('directory', 'clearAll')}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable style={s.fpCloseBtn} onPress={() => setShowFilters(false)} hitSlop={6}>
                        <MaterialIcons name="close" size={18} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Search within filters */}
                  <View style={s.filterSearchBar}>
                    <MaterialIcons name="search" size={16} color={theme.textMuted} />
                    <TextInput
                      style={s.filterSearchInput}
                      placeholder={language === 'fr' ? 'Rechercher dans les filtres...' : 'Search filters...'}
                      placeholderTextColor={theme.textMuted}
                      value={filterSearchText}
                      onChangeText={setFilterSearchText}
                    />
                    {filterSearchText.length > 0 ? (
                      <Pressable onPress={() => setFilterSearchText('')} hitSlop={8}>
                        <MaterialIcons name="close" size={14} color={theme.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Role filter */}
                  <View style={s.filterGroup}>
                    <View style={s.filterGroupHeader}>
                      <MaterialIcons name="person" size={14} color={theme.primary} />
                      <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByRole')}</Text>
                      {filterRole !== 'all' ? <View style={s.fgActiveDot} /> : null}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                      {['all', 'Tireur', 'Pointeur', 'Milieu'].map(opt => (
                        <Pressable
                          key={opt}
                          style={[s.filterChip, filterRole === opt && s.filterChipActive]}
                          onPress={() => { Haptics.selectionAsync(); setFilterRole(opt); }}
                        >
                          <Text style={[s.filterChipText, filterRole === opt && s.filterChipTextActive]}>
                            {opt === 'all' ? t('leaderboard', 'allRoles') : t('roles', opt)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Level filter */}
                  <View style={s.filterGroup}>
                    <View style={s.filterGroupHeader}>
                      <MaterialIcons name="signal-cellular-alt" size={14} color={theme.accent} />
                      <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByLevel')}</Text>
                      {filterLevel !== 'all' ? <View style={s.fgActiveDot} /> : null}
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                      {['all', 'D\u00e9butant', 'Interm\u00e9diaire', 'Confirm\u00e9', 'Expert'].map(opt => (
                        <Pressable
                          key={opt}
                          style={[s.filterChip, filterLevel === opt && s.filterChipActive]}
                          onPress={() => { Haptics.selectionAsync(); setFilterLevel(opt); }}
                        >
                          <Text style={[s.filterChipText, filterLevel === opt && s.filterChipTextActive]}>
                            {opt === 'all' ? t('leaderboard', 'allLevels') : t('levels', opt)}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={s.fgDivider} />

                  {/* Terrain filter */}
                  {uniqueTerrains.length > 0 ? (
                    <View style={s.filterGroup}>
                      <View style={s.filterGroupHeader}>
                        <MaterialIcons name="sports-soccer" size={14} color={theme.success} />
                        <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByTerrain')}</Text>
                        {filterTerrain !== 'all' ? <View style={s.fgActiveDot} /> : null}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                        <Pressable
                          style={[s.filterChip, filterTerrain === 'all' && s.filterChipActive]}
                          onPress={() => { Haptics.selectionAsync(); setFilterTerrain('all'); }}
                        >
                          <Text style={[s.filterChipText, filterTerrain === 'all' && s.filterChipTextActive]}>
                            {t('leaderboard', 'allTerrains')}
                          </Text>
                        </Pressable>
                        {uniqueTerrains
                          .filter(tn => !filterSearchText || tn.toLowerCase().includes(filterSearchText.toLowerCase()))
                          .map(tn => (
                          <Pressable
                            key={tn}
                            style={[s.filterChip, filterTerrain === tn && s.filterChipActive]}
                            onPress={() => { Haptics.selectionAsync(); setFilterTerrain(tn); }}
                          >
                            <Text style={[s.filterChipText, filterTerrain === tn && s.filterChipTextActive]}>{tn}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* Brand filter */}
                  {uniqueBrands.length > 0 ? (
                    <View style={s.filterGroup}>
                      <View style={s.filterGroupHeader}>
                        <MaterialIcons name="sports-baseball" size={14} color="#D97706" />
                        <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByBrand')}</Text>
                        {filterBrand !== 'all' ? <View style={s.fgActiveDot} /> : null}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                        <Pressable
                          style={[s.filterChip, filterBrand === 'all' && s.filterChipActive]}
                          onPress={() => { Haptics.selectionAsync(); setFilterBrand('all'); }}
                        >
                          <Text style={[s.filterChipText, filterBrand === 'all' && s.filterChipTextActive]}>
                            {t('leaderboard', 'allBrands')}
                          </Text>
                        </Pressable>
                        {uniqueBrands
                          .filter(b => !filterSearchText || b.toLowerCase().includes(filterSearchText.toLowerCase()))
                          .map(brand => (
                          <Pressable
                            key={brand}
                            style={[s.filterChip, filterBrand === brand && s.filterChipActive]}
                            onPress={() => { Haptics.selectionAsync(); setFilterBrand(brand); }}
                          >
                            <Text style={[s.filterChipText, filterBrand === brand && s.filterChipTextActive]}>{brand}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* Club filter */}
                  {uniqueClubs.length > 0 ? (
                    <View style={s.filterGroup}>
                      <View style={s.filterGroupHeader}>
                        <MaterialIcons name="home" size={14} color={theme.primary} />
                        <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByClub')}</Text>
                        {filterClub !== 'all' ? <View style={s.fgActiveDot} /> : null}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                        <Pressable
                          style={[s.filterChip, filterClub === 'all' && s.filterChipActive]}
                          onPress={() => { Haptics.selectionAsync(); setFilterClub('all'); }}
                        >
                          <Text style={[s.filterChipText, filterClub === 'all' && s.filterChipTextActive]}>
                            {t('leaderboard', 'allClubs')}
                          </Text>
                        </Pressable>
                        {uniqueClubs
                          .filter(c => !filterSearchText || c.toLowerCase().includes(filterSearchText.toLowerCase()))
                          .map(club => (
                          <Pressable
                            key={club}
                            style={[s.filterChip, filterClub === club && s.filterChipActive]}
                            onPress={() => { Haptics.selectionAsync(); setFilterClub(club); }}
                          >
                            <Text style={[s.filterChipText, filterClub === club && s.filterChipTextActive]}>{club}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <View style={s.fgDivider} />

                  {/* Country filter */}
                  {uniqueCountries.length > 0 ? (
                    <View style={s.filterGroup}>
                      <View style={s.filterGroupHeader}>
                        <MaterialIcons name="public" size={14} color={theme.textSecondary} />
                        <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByCountry')}</Text>
                        {filterCountry !== 'all' ? <View style={s.fgActiveDot} /> : null}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                        <Pressable
                          style={[s.filterChip, filterCountry === 'all' && s.filterChipActive]}
                          onPress={() => { Haptics.selectionAsync(); setFilterCountry('all'); }}
                        >
                          <Text style={[s.filterChipText, filterCountry === 'all' && s.filterChipTextActive]}>
                            {t('leaderboard', 'allCountries')}
                          </Text>
                        </Pressable>
                        {uniqueCountries
                          .filter(c => !filterSearchText || c.toLowerCase().includes(filterSearchText.toLowerCase()))
                          .map(country => (
                          <Pressable
                            key={country}
                            style={[s.filterChip, filterCountry === country && s.filterChipActive]}
                            onPress={() => { Haptics.selectionAsync(); setFilterCountry(country); }}
                          >
                            <Text style={[s.filterChipText, filterCountry === country && s.filterChipTextActive]}>{country}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {uniqueCities.length > 0 ? (
                    <View style={s.filterGroup}>
                      <View style={s.filterGroupHeader}>
                        <MaterialIcons name="place" size={14} color={theme.error} />
                        <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByCity')}</Text>
                        {filterCity !== 'all' ? <View style={s.fgActiveDot} /> : null}
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                        <Pressable
                          style={[s.filterChip, filterCity === 'all' && s.filterChipActive]}
                          onPress={() => { Haptics.selectionAsync(); setFilterCity('all'); }}
                        >
                          <Text style={[s.filterChipText, filterCity === 'all' && s.filterChipTextActive]}>
                            {t('leaderboard', 'allCities')}
                          </Text>
                        </Pressable>
                        {uniqueCities
                          .filter(c => !filterSearchText || c.toLowerCase().includes(filterSearchText.toLowerCase()))
                          .map(city => (
                          <Pressable
                            key={city}
                            style={[s.filterChip, filterCity === city && s.filterChipActive]}
                            onPress={() => { Haptics.selectionAsync(); setFilterCity(city); }}
                          >
                            <Text style={[s.filterChipText, filterCity === city && s.filterChipTextActive]}>{city}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* Bottom close button */}
                  <Pressable
                    style={s.fpBottomCloseBtn}
                    onPress={() => { Haptics.selectionAsync(); setShowFilters(false); }}
                  >
                    <MaterialIcons name="keyboard-arrow-up" size={18} color={theme.textSecondary} />
                    <Text style={s.fpBottomCloseBtnText}>{language === 'fr' ? 'Masquer les filtres' : 'Hide filters'}</Text>
                  </Pressable>
                </Animated.View>
              ) : null}

              {/* Active filter pills */}
              {activeFilterCount > 0 && !showFilters ? (
                <View style={s.activeFiltersRowInline}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.activeFiltersScroll}>
                    {filterRole !== 'all' ? (
                      <Pressable style={s.activeFilterPill} onPress={() => setFilterRole('all')}>
                        <Text style={s.activeFilterPillText}>{t('roles', filterRole)}</Text>
                        <MaterialIcons name="close" size={14} color="#D97706" />
                      </Pressable>
                    ) : null}
                    {filterLevel !== 'all' ? (
                      <Pressable style={s.activeFilterPill} onPress={() => setFilterLevel('all')}>
                        <Text style={s.activeFilterPillText}>{t('levels', filterLevel)}</Text>
                        <MaterialIcons name="close" size={14} color="#D97706" />
                      </Pressable>
                    ) : null}
                    {filterClub !== 'all' ? (
                      <Pressable style={s.activeFilterPill} onPress={() => setFilterClub('all')}>
                        <Text style={s.activeFilterPillText}>{filterClub}</Text>
                        <MaterialIcons name="close" size={14} color="#D97706" />
                      </Pressable>
                    ) : null}
                    {filterTerrain !== 'all' ? (
                      <Pressable style={s.activeFilterPill} onPress={() => setFilterTerrain('all')}>
                        <MaterialIcons name="sports-soccer" size={12} color="#D97706" />
                        <Text style={s.activeFilterPillText}>{filterTerrain}</Text>
                        <MaterialIcons name="close" size={14} color="#D97706" />
                      </Pressable>
                    ) : null}
                    {filterBrand !== 'all' ? (
                      <Pressable style={s.activeFilterPill} onPress={() => setFilterBrand('all')}>
                        <MaterialIcons name="sports-baseball" size={12} color="#D97706" />
                        <Text style={s.activeFilterPillText}>{filterBrand}</Text>
                        <MaterialIcons name="close" size={14} color="#D97706" />
                      </Pressable>
                    ) : null}
                    {filterCountry !== 'all' ? (
                      <Pressable style={s.activeFilterPill} onPress={() => setFilterCountry('all')}>
                        <Text style={s.activeFilterPillText}>{filterCountry}</Text>
                        <MaterialIcons name="close" size={14} color="#D97706" />
                      </Pressable>
                    ) : null}
                    {filterCity !== 'all' ? (
                      <Pressable style={s.activeFilterPill} onPress={() => setFilterCity('all')}>
                        <Text style={s.activeFilterPillText}>{filterCity}</Text>
                        <MaterialIcons name="close" size={14} color="#D97706" />
                      </Pressable>
                    ) : null}
                  </ScrollView>
                </View>
              ) : null}

              {filteredSorted.length > 0 ? (
                <View style={s.listHeader}>
                  <Text style={s.listHeaderText}>
                    {filteredSorted.length} {t('leaderboard', 'publicPlayersCount')}
                  </Text>
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <>
              {hasMore ? (
                <View style={s.loadMoreFooter}>
                  <ActivityIndicator size="small" color="#D97706" />
                </View>
              ) : filteredSorted.length > 5 ? <AdBanner position="inline" /> : null}
            </>
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <MaterialIcons name="people-outline" size={56} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{t('leaderboard', 'noPlayers')}</Text>
              <Text style={s.emptyDesc}>
                {search || activeFilterCount > 0
                  ? t('leaderboard', 'noPlayersMatchingFilters')
                  : t('leaderboard', 'noPlayersDesc')}
              </Text>
              {(search || activeFilterCount > 0) ? (
                <Pressable style={s.resetBtn} onPress={clearFilters}>
                  <MaterialIcons name="refresh" size={16} color="#D97706" />
                  <Text style={s.resetBtnText}>{t('common', 'reset')}</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      )}

      )}

      {/* My rank footer when not visible in list (players tab only) */}
      {activeTab === 'players' && myRank && myRank > visibleCount && !loading ? (() => {
        const myP = filteredSorted[myRank - 1];
        if (!myP) return null;
        return (
          <View style={[s.myRankFooter, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.myRankContent}>
              <View style={s.myRankBadge}>
                <Text style={s.myRankBadgeText}>#{myRank}</Text>
              </View>
              <View style={s.myRankAvatarWrap}>
                {myP.avatar ? (
                  <Image source={{ uri: myP.avatar }} style={s.myRankAvatar} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[s.myRankAvatar, { backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>{myP.name.charAt(0)}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.myRankName} numberOfLines={1}>{myP.name}</Text>
                <Text style={s.myRankStats}>{myP.stats.winRate}% \u2022 {myP.stats.matchesPlayed} {t('leaderboard', 'matches')}</Text>
              </View>
              <MaterialIcons name="star" size={18} color={theme.primary} />
            </View>
          </View>
        );
      })() : null}

      )}

      {/* Meetup Invitation Picker Modal */}
      <Modal visible={showMeetupPicker} animationType="slide" transparent onRequestClose={() => setShowMeetupPicker(false)}>
        <View style={s.mipOverlay}>
          <View style={s.mipContent}>
            <View style={s.mipHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.mipTitle}>{t('meetup', 'inviteToMeetup')}</Text>
                <Text style={s.mipSubtitle}>{meetupPickerUserName}</Text>
              </View>
              <Pressable style={s.mipClose} onPress={() => setShowMeetupPicker(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <Text style={s.mipDesc}>{t('meetup', 'chooseMeetup')}</Text>
            {loadingMeetups ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : activeMeetups.length > 0 ? (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {activeMeetups.map((m) => {
                  const mDate = new Date(m.date);
                  return (
                    <Pressable
                      key={m.id}
                      style={[s.mipItem, invitingToMeetup === m.id && { opacity: 0.6 }]}
                      onPress={() => handleConfirmInvite(m.id)}
                      disabled={!!invitingToMeetup}
                    >
                      <View style={s.mipItemDate}>
                        <Text style={s.mipItemDay}>{mDate.getDate()}</Text>
                        <Text style={s.mipItemMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.mipItemTitle} numberOfLines={1}>{m.title}</Text>
                        <Text style={s.mipItemTime}>{mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      {invitingToMeetup === m.id ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <View style={s.mipArrow}><MaterialIcons name="send" size={16} color={theme.primary} /></View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <MaterialIcons name="event-busy" size={40} color={theme.textMuted} />
                <Text style={s.mipEmptyText}>{t('meetup', 'noActiveMeetups')}</Text>
                <Text style={s.mipEmptyDesc}>{t('meetup', 'noActiveMeetupsDesc')}</Text>
                <Pressable style={s.mipCreateBtn} onPress={() => { setShowMeetupPicker(false); router.push('/meetup/new' as any); }}>
                  <MaterialIcons name="add" size={18} color="#FFF" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>{t('meetup', 'createMeetupFirst')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },

  // Header
  header: { backgroundColor: theme.surface },
  headerBottom: { borderBottomWidth: 1, borderBottomColor: theme.border },
  headerGradient: { paddingTop: 12, paddingBottom: 16, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabBtnActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabBtnTextActive: { color: '#FFF', fontWeight: '700' },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22, paddingHorizontal: 14, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#FFF' },
  filterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  filterBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: theme.error, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D97706' },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },

  // Sort
  sortWrapper: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 8 },

  // Boules extra filters
  boulesExtraFilters: { paddingHorizontal: 16, gap: 8 },
  boulesModePills: { flexDirection: 'row', gap: 6 },
  bModePill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  bModePillActive: { backgroundColor: '#D97706' + '15', borderColor: '#D97706' },
  bModePillText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  bModePillTextActive: { color: '#D97706' },
  sortRow: { paddingHorizontal: 16, gap: 8 },
  sortChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  sortChipActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  sortChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  sortChipTextActive: { color: '#FFF' },

  // Filters panel (inside FlatList ListHeaderComponent)
  filtersPanel: { marginBottom: 12, backgroundColor: theme.surface, borderRadius: 16, padding: 0, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' as const },
  fpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: '#D97706' + '06' },
  fpHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fpHeaderIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#D97706' + '15', alignItems: 'center', justifyContent: 'center' },
  fpHeaderTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  fpCountBadge: { backgroundColor: '#D97706', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  fpCountBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  fpHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fpClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.error + '10', borderRadius: 8 },
  fpClearBtnText: { fontSize: 12, fontWeight: '600', color: theme.error },
  fpCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  filterSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.backgroundSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 14, marginTop: 12, marginBottom: 14, borderWidth: 1, borderColor: theme.border },
  filterSearchInput: { flex: 1, fontSize: 13, color: theme.textPrimary, paddingVertical: 0 },
  filterGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  filterGroup: { marginBottom: 14, paddingHorizontal: 14 },
  filterGroupTitle: { fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 0 },
  fgActiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D97706', marginLeft: 4 },
  fgDivider: { height: 1, backgroundColor: theme.border, marginHorizontal: 14, marginBottom: 14 },
  filterChipsRow: { gap: 6, paddingRight: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.backgroundSecondary, borderWidth: 1.5, borderColor: theme.border },
  filterChipActive: { backgroundColor: '#D97706' + '15', borderColor: '#D97706' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  filterChipTextActive: { color: '#D97706' },
  fpBottomCloseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.backgroundSecondary + '80' },
  fpBottomCloseBtnText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  clearFiltersBtnText: { fontSize: 13, fontWeight: '600', color: theme.error },

  // Active filters (in header — kept for compatibility)
  activeFiltersRow: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  activeFiltersRowInline: { marginBottom: 10 },
  activeFiltersScroll: { gap: 6 },
  activeFilterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#D97706' + '10', borderRadius: 16, borderWidth: 1, borderColor: '#D97706' + '25' },
  activeFilterPillText: { fontSize: 12, fontWeight: '600', color: '#D97706' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  listContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },
  listHeader: { paddingVertical: 8 },
  listHeaderText: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  loadMoreFooter: { paddingVertical: 20, alignItems: 'center' },

  // Player row
  row: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 14, marginBottom: 10, ...theme.shadows.card },
  rowMe: { borderWidth: 2, borderColor: theme.primary, backgroundColor: theme.primary + '05' },
  rankCol: { width: 32, alignItems: 'center', marginRight: 10 },
  medal: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontSize: 15, fontWeight: '900' },
  rankText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  playerCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 42, height: 42, borderRadius: 12, overflow: 'hidden' },
  meBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.surface },
  playerName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  playerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  playerClub: { fontSize: 11, color: theme.textMuted, maxWidth: 120 },
  playerCity: { fontSize: 11, color: theme.textMuted, maxWidth: 80 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted, marginHorizontal: 5 },
  playerTags: { flexDirection: 'row', gap: 4, marginTop: 4 },
  playerTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  playerTagText: { fontSize: 10, fontWeight: '600' },
  statsCol: { flexDirection: 'row', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border + '40' },
  statBlock: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  statLabel: { fontSize: 9, color: theme.textMuted, marginTop: 1 },
  inviteBtn: { position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.primary + '25' },
  premiumBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#A8B4C0' + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A8B4C0' + '40' },

  // States
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#D97706' + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  loadingText: { fontSize: 15, color: theme.textMuted },
  errorText: { fontSize: 15, color: theme.textSecondary, marginTop: 12, textAlign: 'center' },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#D97706' + '15', borderRadius: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#D97706' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#D97706' + '12', borderRadius: 10 },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: '#D97706' },

  // My rank footer
  myRankFooter: { backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingHorizontal: 16, paddingTop: 12 },
  myRankContent: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.primary + '08', borderRadius: theme.borderRadius.lg, padding: 12, borderWidth: 1.5, borderColor: theme.primary + '30' },
  myRankBadge: { backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  myRankBadgeText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  myRankAvatarWrap: {},
  myRankAvatar: { width: 32, height: 32, borderRadius: 10, overflow: 'hidden' },
  myRankName: { fontSize: 14, fontWeight: '700', color: theme.primary },
  myRankStats: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },

  // Meetup invitation picker
  mipOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  mipContent: { backgroundColor: theme.surface, borderRadius: 24, padding: 24 },
  mipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mipTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  mipSubtitle: { fontSize: 13, color: theme.primary, fontWeight: '600', marginTop: 2 },
  mipClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  mipDesc: { fontSize: 13, color: theme.textSecondary, marginBottom: 16 },
  mipItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 14, marginBottom: 10 },
  mipItemDate: { width: 46, height: 46, borderRadius: 12, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  mipItemDay: { fontSize: 18, fontWeight: '900', color: theme.primary, lineHeight: 20 },
  mipItemMonth: { fontSize: 9, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 },
  mipItemTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  mipItemTime: { fontSize: 12, color: theme.textMuted },
  mipArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  mipEmptyText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  mipEmptyDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16, paddingHorizontal: 16 },
  mipCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },

  // Club rows
  clubRow: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 14, marginBottom: 10, ...theme.shadows.card },
  clubHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  clubLogoWrap: {},
  clubLogo: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' as const },
  clubName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  clubCity: { fontSize: 11, color: theme.textMuted },
  clubMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clubMetaText: { fontSize: 10, color: theme.textMuted },
  clubScoreBadge: { alignItems: 'center', backgroundColor: '#D97706' + '12', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  clubScoreValue: { fontSize: 18, fontWeight: '900', color: '#D97706' },
  clubScoreLabel: { fontSize: 9, fontWeight: '600', color: '#D97706', marginTop: 1 },
  clubStats: { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '40' },
  clubStatItem: { flex: 1, alignItems: 'center' },
  clubStatValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  clubStatLabel: { fontSize: 9, color: theme.textMuted, marginTop: 1 },
  clubTopPlayers: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '30' },
  clubTopLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 8 },
  clubTopPlayer: { alignItems: 'center', gap: 3, minWidth: 52 },
  clubTopAvatar: { width: 28, height: 28, borderRadius: 8, overflow: 'hidden' as const },
  clubTopPlayerName: { fontSize: 10, fontWeight: '600', color: theme.textPrimary, maxWidth: 60 },
  clubTopPlayerStat: { fontSize: 10, fontWeight: '700', color: '#D97706' },

  // Boules rows
  boulesRow: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 14, marginBottom: 10, ...theme.shadows.card },
  boulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  boulesIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#D97706' + '12', alignItems: 'center', justifyContent: 'center' },
  boulesName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  boulesRoleSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '30' },
  boulesRoleTitle: { fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 },
  boulesRoleChip: { backgroundColor: theme.backgroundSecondary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 2 },
  boulesRoleName: { fontSize: 10, fontWeight: '700', color: theme.textPrimary },
  boulesRoleStat: { fontSize: 10, fontWeight: '600', color: '#D97706' },
  boulesRoleCount: { fontSize: 9, color: theme.textMuted },
});
