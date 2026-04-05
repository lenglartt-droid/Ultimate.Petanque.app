/**
 * Global ELO Ranking — World leaderboard with league tiers, geographic filters,
 * and promotion/relegation zones.
 *
 * Features:
 * - Global rank for every public player
 * - Filter by league tier, country, city
 * - League tier overview with player distribution
 * - Promotion zone indicator
 * - Your rank highlight
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import theme, { blurhash } from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAppData } from '@/contexts/AppContext';
import * as Haptics from '@/services/haptics';
import { getEloRank } from '@/services/eloService';
import {
  fetchGlobalRankings,
  fetchPlayerGlobalRank,
  fetchLeagueTierStats,
  fetchAvailableCountries,
  fetchAvailableCities,
  getLeagueTier,
  getLeagueProgress,
  LEAGUE_TIERS,
  LeagueTier,
  LeagueTierStats,
  RankedPlayer,
} from '@/services/globalRankingService';

// ============================================
// i18n
// ============================================
const T = {
  title: { fr: 'Classement Mondial', en: 'World Ranking' },
  subtitle: { fr: 'ELO Global', en: 'Global ELO' },
  yourRank: { fr: 'Votre rang mondial', en: 'Your world rank' },
  outOf: { fr: 'sur', en: 'of' },
  players: { fr: 'joueurs', en: 'players' },
  matches: { fr: 'matchs', en: 'matches' },
  wins: { fr: 'V', en: 'W' },
  winRate: { fr: '% Victoires', en: 'Win %' },
  league: { fr: 'Ligue', en: 'League' },
  leagueOverview: { fr: 'Ligues', en: 'Leagues' },
  promotion: { fr: 'Promotion', en: 'Promotion' },
  eloToNext: { fr: 'ELO pour promotion', en: 'ELO to promote' },
  allLeagues: { fr: 'Toutes les ligues', en: 'All leagues' },
  allCountries: { fr: 'Tous les pays', en: 'All countries' },
  allCities: { fr: 'Toutes les villes', en: 'All cities' },
  noPlayers: { fr: 'Aucun joueur dans ce filtre', en: 'No players in this filter' },
  noPlayersDesc: { fr: 'Essayez un autre filtre ou pays.', en: 'Try a different filter or country.' },
  loadMore: { fr: 'Charger plus', en: 'Load more' },
  notRanked: { fr: 'Non classe', en: 'Not ranked' },
  notRankedDesc: { fr: 'Rendez votre profil public pour apparaitre dans le classement mondial.', en: 'Make your profile public to appear in the world ranking.' },
  distribution: { fr: 'Distribution', en: 'Distribution' },
};

function tt(key: keyof typeof T, lang: string): string {
  return (T[key] as any)[lang] || (T[key] as any).fr;
}

// ============================================
// LEAGUE TIER CARD
// ============================================
const LeagueTierCard = React.memo(({ tier, count, isActive, isMyTier, onPress, lang }: {
  tier: LeagueTier; count: number; isActive: boolean; isMyTier: boolean; onPress: () => void; lang: string;
}) => {
  const name = lang === 'fr' ? tier.name.fr : tier.name.en;
  return (
    <Pressable
      style={[ls.tierCard, isActive && { borderColor: tier.color, borderWidth: 2 }]}
      onPress={onPress}
    >
      <LinearGradient colors={tier.gradient} style={ls.tierGradient}>
        <Text style={ls.tierEmblem}>{tier.emblem}</Text>
      </LinearGradient>
      <Text style={[ls.tierName, { color: tier.color }]} numberOfLines={1}>{name}</Text>
      <Text style={ls.tierCount}>{count} {tt('players', lang)}</Text>
      <Text style={ls.tierRange}>{tier.minElo}{tier.maxElo === Infinity ? '+' : `-${tier.maxElo}`}</Text>
      {isMyTier ? (
        <View style={[ls.tierMyBadge, { backgroundColor: tier.color + '20' }]}>
          <MaterialIcons name="person" size={9} color={tier.color} />
        </View>
      ) : null}
    </Pressable>
  );
});

// ============================================
// PLAYER ROW
// ============================================
const PlayerRow = React.memo(({ player, isSelf, lang, index }: {
  player: RankedPlayer; isSelf: boolean; lang: string; index: number;
}) => {
  const rankMedals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const medal = rankMedals[player.globalRank];
  const tier = player.leagueTier;

  return (
    <Animated.View entering={index < 20 ? FadeInDown.duration(150).delay(Math.min(index * 20, 300)) : undefined}>
      <Pressable
        style={[rs.row, isSelf && { backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderWidth: 1.5 }]}
        onPress={() => { Haptics.selectionAsync(); router.push(`/player/${player.id}` as any); }}
      >
        {/* Rank */}
        <View style={rs.rankCol}>
          {medal ? (
            <Text style={rs.rankMedal}>{medal}</Text>
          ) : (
            <Text style={[rs.rankNumber, player.globalRank <= 10 && { color: tier.color, fontWeight: '900' }]}>
              {player.globalRank}
            </Text>
          )}
        </View>

        {/* Avatar */}
        {player.avatar ? (
          <Image source={{ uri: player.avatar }} style={rs.avatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={[rs.avatarFallback, { backgroundColor: tier.color + '18' }]}>
            <Text style={[rs.avatarLetter, { color: tier.color }]}>{player.name.charAt(0)}</Text>
          </View>
        )}

        {/* Info */}
        <View style={rs.infoCol}>
          <View style={rs.nameRow}>
            <Text style={[rs.name, isSelf && { color: '#2563EB' }]} numberOfLines={1}>{player.name}</Text>
            {isSelf ? <View style={rs.selfBadge}><Text style={rs.selfBadgeText}>{lang === 'fr' ? 'Vous' : 'You'}</Text></View> : null}
          </View>
          <View style={rs.metaRow}>
            {player.city ? <Text style={rs.metaText} numberOfLines={1}>{player.city}</Text> : null}
            {player.club ? <Text style={rs.metaText} numberOfLines={1}>· {player.club}</Text> : null}
          </View>
        </View>

        {/* Stats */}
        <View style={rs.statsCol}>
          <View style={[rs.eloBadge, { backgroundColor: tier.color + '15' }]}>
            <MaterialIcons name={tier.icon as any} size={12} color={tier.color} />
            <Text style={[rs.eloText, { color: tier.color }]}>{player.eloRating}</Text>
          </View>
          <Text style={rs.winRateText}>{player.winRate}% · {player.matchesPlayed}M</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ============================================
// MAIN PAGE
// ============================================
export default function GlobalRankingPage() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const lang = language;
  const { selfPlayer } = useAppData();

  // State
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [myRank, setMyRank] = useState<{ rank: number | null; total: number } | null>(null);
  const [tierStats, setTierStats] = useState<LeagueTierStats[]>([]);

  // Filters
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const offsetRef = useRef(0);
  const PAGE_SIZE = 50;

  // My league progress
  const myProgress = useMemo(() => {
    if (!selfPlayer) return null;
    const elo = selfPlayer.eloRating || 1000;
    return getLeagueProgress(elo);
  }, [selfPlayer]);

  // Load data
  const loadRankings = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    }

    const [rankResult, tierResult] = await Promise.all([
      fetchGlobalRankings({
        limit: PAGE_SIZE,
        offset: reset ? 0 : offsetRef.current,
        leagueTierId: selectedTier || undefined,
        country: selectedCountry || undefined,
        city: selectedCity || undefined,
      }),
      reset ? fetchLeagueTierStats() : Promise.resolve({ stats: tierStats, error: null }),
    ]);

    if (reset) {
      setPlayers(rankResult.players);
    } else {
      setPlayers(prev => [...prev, ...rankResult.players]);
    }
    setTotal(rankResult.total);
    offsetRef.current += rankResult.players.length;

    if (reset && tierResult.stats.length > 0) {
      setTierStats(tierResult.stats);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [selectedTier, selectedCountry, selectedCity]);

  const loadMyRank = useCallback(async () => {
    if (!selfPlayer?.id) return;
    const result = await fetchPlayerGlobalRank(selfPlayer.id);
    setMyRank({ rank: result.rank, total: result.total });
  }, [selfPlayer?.id]);

  const loadCountries = useCallback(async () => {
    const c = await fetchAvailableCountries();
    setCountries(c);
  }, []);

  useEffect(() => {
    Promise.all([loadRankings(true), loadMyRank(), loadCountries()]);
  }, []);

  // Reload on filter change
  useEffect(() => {
    loadRankings(true);
  }, [selectedTier, selectedCountry, selectedCity]);

  // Load cities when country changes
  useEffect(() => {
    if (selectedCountry) {
      fetchAvailableCities(selectedCountry).then(setCities);
    } else {
      setCities([]);
      setSelectedCity(null);
    }
  }, [selectedCountry]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadRankings(true), loadMyRank()]);
    setRefreshing(false);
  }, [loadRankings, loadMyRank]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || players.length >= total) return;
    setLoadingMore(true);
    loadRankings(false);
  }, [loadingMore, players.length, total, loadRankings]);

  const handleTierPress = useCallback((tierId: string) => {
    Haptics.selectionAsync();
    setSelectedTier(prev => prev === tierId ? null : tierId);
  }, []);

  const renderItem = useCallback(({ item, index }: { item: RankedPlayer; index: number }) => {
    const isSelf = selfPlayer?.id === item.id;
    return <PlayerRow player={item} isSelf={isSelf} lang={lang} index={index} />;
  }, [selfPlayer?.id, lang]);

  const keyExtractor = useCallback((item: RankedPlayer) => item.id, []);

  // List header
  const ListHeader = useMemo(() => (
    <View>
      {/* My Rank Card */}
      {myProgress ? (
        <View style={ms.card}>
          <LinearGradient colors={myProgress.tier.gradient} style={ms.gradient}>
            <View style={ms.topRow}>
              <View style={ms.emblemCircle}>
                <Text style={ms.emblem}>{myProgress.tier.emblem}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ms.tierName}>
                  {lang === 'fr' ? myProgress.tier.name.fr : myProgress.tier.name.en}
                </Text>
                <Text style={ms.eloLabel}>{selfPlayer?.eloRating || 1000} ELO</Text>
              </View>
              {myRank?.rank ? (
                <View style={ms.rankBadge}>
                  <Text style={ms.rankHash}>#</Text>
                  <Text style={ms.rankValue}>{myRank.rank.toLocaleString()}</Text>
                  <Text style={ms.rankTotal}>
                    {tt('outOf', lang)} {myRank.total.toLocaleString()}
                  </Text>
                </View>
              ) : (
                <View style={ms.rankBadge}>
                  <MaterialIcons name="visibility-off" size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={ms.rankTotal}>{tt('notRanked', lang)}</Text>
                </View>
              )}
            </View>

            {/* Progress to next tier */}
            {myProgress.nextTier ? (
              <View style={ms.progressSection}>
                <View style={ms.progressRow}>
                  <Text style={ms.progressLabel}>{tt('promotion', lang)}</Text>
                  <Text style={ms.progressValue}>
                    {myProgress.eloToNext} ELO → {lang === 'fr' ? myProgress.nextTier.name.fr : myProgress.nextTier.name.en} {myProgress.nextTier.emblem}
                  </Text>
                </View>
                <View style={ms.progressTrack}>
                  <View style={[ms.progressFill, { width: `${myProgress.progress}%` }]} />
                </View>
              </View>
            ) : (
              <View style={ms.progressSection}>
                <Text style={ms.maxRankText}>{lang === 'fr' ? 'Rang maximum atteint !' : 'Maximum rank reached!'}</Text>
              </View>
            )}
          </LinearGradient>
        </View>
      ) : null}

      {/* League Tier Overview */}
      {tierStats.length > 0 ? (
        <View style={ls.section}>
          <View style={ls.sectionHeader}>
            <MaterialIcons name="military-tech" size={16} color={theme.textPrimary} />
            <Text style={ls.sectionTitle}>{tt('leagueOverview', lang)}</Text>
            <Text style={ls.sectionCount}>{tt('distribution', lang)}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ls.tierScroll}>
            {tierStats.map(ts => {
              const isActive = selectedTier === ts.tier.id;
              const isMyTier = myProgress?.tier.id === ts.tier.id;
              return (
                <LeagueTierCard
                  key={ts.tier.id}
                  tier={ts.tier}
                  count={ts.playerCount}
                  isActive={isActive}
                  isMyTier={isMyTier}
                  onPress={() => handleTierPress(ts.tier.id)}
                  lang={lang}
                />
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Filters */}
      <View style={fs.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fs.filterScroll}>
          {/* Country filter */}
          <Pressable
            style={[fs.filterChip, selectedCountry && fs.filterChipActive]}
            onPress={() => {
              Haptics.selectionAsync();
              if (selectedCountry) {
                setSelectedCountry(null);
              } else {
                setShowFilters(!showFilters);
              }
            }}
          >
            <MaterialIcons name="flag" size={13} color={selectedCountry ? '#FFF' : theme.textSecondary} />
            <Text style={[fs.filterText, selectedCountry && fs.filterTextActive]}>
              {selectedCountry || tt('allCountries', lang)}
            </Text>
            {selectedCountry ? <MaterialIcons name="close" size={12} color="#FFF" /> : null}
          </Pressable>

          {/* City filter (if country selected) */}
          {selectedCountry && cities.length > 0 ? (
            <Pressable
              style={[fs.filterChip, selectedCity && fs.filterChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                if (selectedCity) {
                  setSelectedCity(null);
                } else {
                  setShowFilters(!showFilters);
                }
              }}
            >
              <MaterialIcons name="place" size={13} color={selectedCity ? '#FFF' : theme.textSecondary} />
              <Text style={[fs.filterText, selectedCity && fs.filterTextActive]}>
                {selectedCity || tt('allCities', lang)}
              </Text>
              {selectedCity ? <MaterialIcons name="close" size={12} color="#FFF" /> : null}
            </Pressable>
          ) : null}

          {/* Total count */}
          <View style={fs.totalBadge}>
            <Text style={fs.totalText}>{total.toLocaleString()} {tt('players', lang)}</Text>
          </View>
        </ScrollView>
      </View>

      {/* Dropdown picker for country/city */}
      {showFilters ? (
        <View style={fs.dropdown}>
          <Text style={fs.dropdownTitle}>{lang === 'fr' ? 'Filtrer par pays' : 'Filter by country'}</Text>
          <ScrollView style={fs.dropdownList} nestedScrollEnabled>
            <Pressable
              style={[fs.dropdownItem, !selectedCountry && fs.dropdownItemActive]}
              onPress={() => { setSelectedCountry(null); setShowFilters(false); }}
            >
              <Text style={[fs.dropdownItemText, !selectedCountry && fs.dropdownItemTextActive]}>{tt('allCountries', lang)}</Text>
            </Pressable>
            {countries.map(c => (
              <Pressable
                key={c}
                style={[fs.dropdownItem, selectedCountry === c && fs.dropdownItemActive]}
                onPress={() => { setSelectedCountry(c); setShowFilters(false); }}
              >
                <Text style={[fs.dropdownItemText, selectedCountry === c && fs.dropdownItemTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {selectedCountry && cities.length > 0 ? (
            <>
              <Text style={[fs.dropdownTitle, { marginTop: 12 }]}>{lang === 'fr' ? 'Filtrer par ville' : 'Filter by city'}</Text>
              <ScrollView style={fs.dropdownList} nestedScrollEnabled>
                <Pressable
                  style={[fs.dropdownItem, !selectedCity && fs.dropdownItemActive]}
                  onPress={() => { setSelectedCity(null); setShowFilters(false); }}
                >
                  <Text style={[fs.dropdownItemText, !selectedCity && fs.dropdownItemTextActive]}>{tt('allCities', lang)}</Text>
                </Pressable>
                {cities.map(c => (
                  <Pressable
                    key={c}
                    style={[fs.dropdownItem, selectedCity === c && fs.dropdownItemActive]}
                    onPress={() => { setSelectedCity(c); setShowFilters(false); }}
                  >
                    <Text style={[fs.dropdownItemText, selectedCity === c && fs.dropdownItemTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  ), [myProgress, myRank, tierStats, selectedTier, selectedCountry, selectedCity, showFilters, countries, cities, total, lang, selfPlayer?.eloRating]);

  if (loading && players.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={ps.container}>
        <View style={ps.header}>
          <Pressable style={ps.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={ps.headerTitle}>{tt('title', lang)}</Text>
            <Text style={ps.headerSubtitle}>{tt('subtitle', lang)}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={ps.container}>
      {/* Header */}
      <View style={ps.header}>
        <Pressable style={ps.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={ps.headerTitle}>{tt('title', lang)}</Text>
          <Text style={ps.headerSubtitle}>{tt('subtitle', lang)}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={players}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : players.length < total ? (
            <Pressable style={ps.loadMoreBtn} onPress={handleLoadMore}>
              <Text style={ps.loadMoreText}>{tt('loadMore', lang)}</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={ps.emptyState}>
              <MaterialIcons name="leaderboard" size={48} color={theme.textMuted} />
              <Text style={ps.emptyTitle}>{tt('noPlayers', lang)}</Text>
              <Text style={ps.emptyText}>{tt('noPlayersDesc', lang)}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ============================================
// STYLES — Page
// ============================================
const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  headerSubtitle: { fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 6 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: 16 },
  loadMoreText: { fontSize: 14, fontWeight: '700', color: theme.primary },
});

// ============================================
// STYLES — My Rank Card
// ============================================
const ms = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }, android: { elevation: 6 }, default: {} }) },
  gradient: { padding: 20, borderRadius: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  emblemCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  emblem: { fontSize: 26 },
  tierName: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  eloLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  rankBadge: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  rankHash: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  rankValue: { fontSize: 22, fontWeight: '900', color: '#FFF', lineHeight: 24 },
  rankTotal: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  progressSection: { marginTop: 16 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressValue: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  progressTrack: { height: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 4 },
  maxRankText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textAlign: 'center', paddingVertical: 4 },
});

// ============================================
// STYLES — League Tiers
// ============================================
const ls = StyleSheet.create({
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  sectionCount: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  tierScroll: { paddingHorizontal: 16, gap: 10 },
  tierCard: {
    width: 100, backgroundColor: '#FFF', borderRadius: 16, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#E8EDF2',
    ...Platform.select({ ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 1 }, default: {} }),
  },
  tierGradient: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tierEmblem: { fontSize: 20 },
  tierName: { fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  tierCount: { fontSize: 10, fontWeight: '600', color: theme.textMuted },
  tierRange: { fontSize: 9, fontWeight: '600', color: theme.textMuted, marginTop: 2 },
  tierMyBadge: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

// ============================================
// STYLES — Filters
// ============================================
const fs = StyleSheet.create({
  filterBar: { marginTop: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: '#F1F5F9', borderRadius: 20,
  },
  filterChipActive: { backgroundColor: theme.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  filterTextActive: { color: '#FFF' },
  totalBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  totalText: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  dropdown: {
    marginHorizontal: 16, marginTop: 8, backgroundColor: '#FFF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0', maxHeight: 300,
    ...Platform.select({ ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 }, android: { elevation: 4 }, default: {} }),
  },
  dropdownTitle: { fontSize: 12, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  dropdownList: { maxHeight: 120 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2 },
  dropdownItemActive: { backgroundColor: theme.primary + '12' },
  dropdownItemText: { fontSize: 14, fontWeight: '500', color: theme.textPrimary },
  dropdownItemTextActive: { color: theme.primary, fontWeight: '700' },
});

// ============================================
// STYLES — Ranking Rows
// ============================================
const rs = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 6,
    backgroundColor: '#FFF', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#E8EDF2',
  },
  rankCol: { width: 36, alignItems: 'center' },
  rankMedal: { fontSize: 20 },
  rankNumber: { fontSize: 15, fontWeight: '700', color: theme.textSecondary },
  avatar: { width: 40, height: 40, borderRadius: 13 },
  avatarFallback: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 16, fontWeight: '700' },
  infoCol: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, flexShrink: 1 },
  selfBadge: { backgroundColor: '#2563EB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  selfBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11, color: theme.textMuted },
  statsCol: { alignItems: 'flex-end' },
  eloBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  eloText: { fontSize: 14, fontWeight: '800' },
  winRateText: { fontSize: 10, fontWeight: '600', color: theme.textMuted, marginTop: 3 },
});
