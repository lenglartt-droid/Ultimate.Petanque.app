import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme, { blurhash } from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/template';
import { useApp } from '@/contexts/AppContext';
import { fetchLeaderboard, sortLeaderboard, LeaderboardPlayer, LeaderboardSort } from '@/services/leaderboardService';

export default function CommunityLeaderboard({ onFiltersToggled }: { onFiltersToggled?: (open: boolean) => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { selfPlayer } = useApp();

  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<LeaderboardSort>('winRate');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterClub, setFilterClub] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { players: lbP, error: err } = await fetchLeaderboard();
    setPlayers(lbP);
    setError(err);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Extract unique values for filters
  const uniqueCities = useMemo(() => {
    const cities = players.map(p => p.city).filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [players]);

  const uniqueCountries = useMemo(() => {
    const countries = players.map(p => p.country).filter(Boolean) as string[];
    return [...new Set(countries)].sort();
  }, [players]);

  const uniqueClubs = useMemo(() => {
    const clubs = players.map(p => p.club).filter(Boolean) as string[];
    return [...new Set(clubs)].sort();
  }, [players]);

  const activeFilterCount = useMemo(() => {
    return [filterCity, filterCountry, filterRole, filterLevel, filterClub].filter(f => f !== 'all').length;
  }, [filterCity, filterCountry, filterRole, filterLevel, filterClub]);

  // Apply filters then sort
  const filteredSorted = useMemo(() => {
    let result = players;
    if (filterCity !== 'all') result = result.filter(p => p.city === filterCity);
    if (filterCountry !== 'all') result = result.filter(p => p.country === filterCountry);
    if (filterRole !== 'all') result = result.filter(p => p.role === filterRole);
    if (filterLevel !== 'all') result = result.filter(p => p.level === filterLevel);
    if (filterClub !== 'all') result = result.filter(p => p.club === filterClub);
    return sortLeaderboard(result, sortBy);
  }, [players, sortBy, filterCity, filterCountry, filterRole, filterLevel, filterClub]);

  const myRank = useMemo(() => {
    if (!selfPlayer || !user) return null;
    const idx = filteredSorted.findIndex(p => p.userId === user.id || p.id === selfPlayer.id);
    return idx >= 0 ? idx + 1 : null;
  }, [filteredSorted, selfPlayer, user]);

  const clearFilters = () => {
    setFilterCity('all');
    setFilterCountry('all');
    setFilterRole('all');
    setFilterLevel('all');
    setFilterClub('all');
  };

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIcon, { backgroundColor: '#D97706' + '15' }]}>
          <MaterialIcons name="leaderboard" size={18} color="#D97706" />
        </View>
        <View style={s.sectionHeaderText}>
          <Text style={s.sectionTitle}>{t('leaderboard', 'title')}</Text>
          {filteredSorted.length > 0 ? <Text style={s.sectionSubtitle}>{filteredSorted.length} {t('leaderboard', 'publicPlayersCount')}</Text> : null}
        </View>
        {/* Filter toggle */}
        <Pressable
          style={[s.filterToggle, activeFilterCount > 0 && s.filterToggleActive]}
          onPress={() => { Haptics.selectionAsync(); const next = !showFilters; setShowFilters(next); onFiltersToggled?.(next); }}
        >
          <MaterialIcons name="tune" size={16} color={activeFilterCount > 0 ? '#D97706' : theme.textMuted} />
          {activeFilterCount > 0 ? (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Sort chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow}>
        {([
          { id: 'winRate' as LeaderboardSort, label: t('leaderboard', 'sortByWinRate') },
          { id: 'matches' as LeaderboardSort, label: t('leaderboard', 'sortByMatches') },
          { id: 'tirRate' as LeaderboardSort, label: t('leaderboard', 'sortByTirRate') },
          { id: 'carreauRate' as LeaderboardSort, label: t('leaderboard', 'sortByCarreauRate') },
        ]).map(chip => (
          <Pressable
            key={chip.id}
            style={[s.sortChip, sortBy === chip.id && s.sortChipActive]}
            onPress={() => { Haptics.selectionAsync(); setSortBy(chip.id); }}
          >
            <Text style={[s.sortChipText, sortBy === chip.id && s.sortChipTextActive]}>{chip.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Expandable Filters */}
      {showFilters ? (
        <View style={s.filtersPanel}>
          {/* Role filter */}
          <View style={s.filterGroup}>
            <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByRole')}</Text>
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
            <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByLevel')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
              {['all', 'Débutant', 'Intermédiaire', 'Confirmé', 'Expert'].map(opt => (
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

          {/* Club filter */}
          {uniqueClubs.length > 0 ? (
            <View style={s.filterGroup}>
              <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByClub')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                <Pressable
                  style={[s.filterChip, filterClub === 'all' && s.filterChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setFilterClub('all'); }}
                >
                  <Text style={[s.filterChipText, filterClub === 'all' && s.filterChipTextActive]}>{t('leaderboard', 'allClubs')}</Text>
                </Pressable>
                {uniqueClubs.map(club => (
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

          {/* Country filter */}
          {uniqueCountries.length > 0 ? (
            <View style={s.filterGroup}>
              <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByCountry')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                <Pressable
                  style={[s.filterChip, filterCountry === 'all' && s.filterChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setFilterCountry('all'); }}
                >
                  <Text style={[s.filterChipText, filterCountry === 'all' && s.filterChipTextActive]}>{t('leaderboard', 'allCountries')}</Text>
                </Pressable>
                {uniqueCountries.map(country => (
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

          {/* City filter */}
          {uniqueCities.length > 0 ? (
            <View style={s.filterGroup}>
              <Text style={s.filterGroupTitle}>{t('leaderboard', 'filterByCity')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterChipsRow}>
                <Pressable
                  style={[s.filterChip, filterCity === 'all' && s.filterChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setFilterCity('all'); }}
                >
                  <Text style={[s.filterChipText, filterCity === 'all' && s.filterChipTextActive]}>{t('leaderboard', 'allCities')}</Text>
                </Pressable>
                {uniqueCities.map(city => (
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

          {/* Clear filters */}
          {activeFilterCount > 0 ? (
            <Pressable style={s.clearFiltersBtn} onPress={clearFilters}>
              <MaterialIcons name="clear-all" size={14} color={theme.error} />
              <Text style={s.clearFiltersBtnText}>{t('directory', 'clearAll')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Active filter pills (when panel is closed) */}
      {activeFilterCount > 0 && !showFilters ? (
        <View style={s.activeFiltersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.activeFiltersScroll}>
            {filterRole !== 'all' ? (
              <Pressable style={s.activeFilterPill} onPress={() => setFilterRole('all')}>
                <Text style={s.activeFilterPillText}>{t('roles', filterRole)}</Text>
                <MaterialIcons name="close" size={12} color="#D97706" />
              </Pressable>
            ) : null}
            {filterLevel !== 'all' ? (
              <Pressable style={s.activeFilterPill} onPress={() => setFilterLevel('all')}>
                <Text style={s.activeFilterPillText}>{t('levels', filterLevel)}</Text>
                <MaterialIcons name="close" size={12} color="#D97706" />
              </Pressable>
            ) : null}
            {filterClub !== 'all' ? (
              <Pressable style={s.activeFilterPill} onPress={() => setFilterClub('all')}>
                <Text style={s.activeFilterPillText}>{filterClub}</Text>
                <MaterialIcons name="close" size={12} color="#D97706" />
              </Pressable>
            ) : null}
            {filterCountry !== 'all' ? (
              <Pressable style={s.activeFilterPill} onPress={() => setFilterCountry('all')}>
                <Text style={s.activeFilterPillText}>{filterCountry}</Text>
                <MaterialIcons name="close" size={12} color="#D97706" />
              </Pressable>
            ) : null}
            {filterCity !== 'all' ? (
              <Pressable style={s.activeFilterPill} onPress={() => setFilterCity('all')}>
                <Text style={s.activeFilterPillText}>{filterCity}</Text>
                <MaterialIcons name="close" size={12} color="#D97706" />
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      <View style={s.card}>
        {loading ? (
          <View style={s.center}>
            <View style={s.loadingIconBg}>
              <MaterialIcons name="leaderboard" size={24} color="#D97706" />
            </View>
            <Text style={s.loadingText}>{t('leaderboard', 'loading')}</Text>
          </View>
        ) : error ? (
          <View style={s.center}>
            <MaterialIcons name="error-outline" size={36} color={theme.error} />
            <Text style={s.errorText}>{t('leaderboard', 'errorLoading')}</Text>
            <Pressable style={s.retryBtn} onPress={loadData}>
              <Text style={s.retryBtnText}>{t('leaderboard', 'retry')}</Text>
            </Pressable>
          </View>
        ) : filteredSorted.length === 0 ? (
          <View style={s.center}>
            <MaterialIcons name="people-outline" size={40} color={theme.textMuted} />
            <Text style={s.emptyTitle}>{t('leaderboard', 'noPlayers')}</Text>
            <Text style={s.emptyDesc}>
              {activeFilterCount > 0
                ? t('leaderboard', 'noPlayersMatchingFilters')
                : t('leaderboard', 'noPlayersDesc')}
            </Text>
            {activeFilterCount > 0 ? (
              <Pressable style={s.resetBtn} onPress={clearFilters}>
                <MaterialIcons name="refresh" size={14} color="#D97706" />
                <Text style={s.resetBtnText}>{t('common', 'reset')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={s.headerRow}>
              <Text style={[s.headerCell, { width: 28, textAlign: 'center' }]}>#</Text>
              <Text style={[s.headerCell, { flex: 1 }]}>{t('leaderboard', 'player')}</Text>
              <Text style={[s.headerCell, s.headerCellStat]}>{t('leaderboard', 'matches')}</Text>
              <Text style={[s.headerCell, s.headerCellStat, sortBy === 'winRate' && { color: '#D97706' }]}>%V</Text>
              <Text style={[s.headerCell, s.headerCellStat, sortBy === 'tirRate' && { color: theme.tirColor }]}>Tir</Text>
              <Text style={[s.headerCell, s.headerCellStat, sortBy === 'carreauRate' && { color: theme.carreauColor }]}>Car.</Text>
            </View>

            {/* Rows */}
            {filteredSorted.slice(0, 10).map((p, idx) => {
              const rank = idx + 1;
              const isMe = user && (p.userId === user.id || (selfPlayer && p.id === selfPlayer.id));
              const medalColors: Record<number, string> = { 1: '#FFD700', 2: '#A8B4C0', 3: '#CD7F32' };
              const medalColor = medalColors[rank];
              return (
                <Pressable
                  key={p.id}
                  style={[s.row, isMe && s.rowMe, idx % 2 === 0 && s.rowAlt]}
                  onPress={() => router.push(isMe ? '/player/me' : `/player/${p.id}` as any)}
                >
                  <View style={{ width: 28, alignItems: 'center' }}>
                    {medalColor ? (
                      <View style={[s.medal, { backgroundColor: medalColor + '20' }]}>
                        <Text style={[s.medalText, { color: medalColor }]}>{rank}</Text>
                      </View>
                    ) : (
                      <Text style={s.rankText}>{rank}</Text>
                    )}
                  </View>
                  <View style={s.playerCol}>
                    <View style={s.avatarWrap}>
                      {p.avatar ? (
                        <Image source={{ uri: p.avatar }} style={s.avatar} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                      ) : (
                        <View style={[s.avatar, { backgroundColor: isMe ? theme.primary : theme.textMuted + '30', alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isMe ? '#FFF' : theme.textSecondary }}>{p.name.charAt(0)}</Text>
                        </View>
                      )}
                      {isMe ? <View style={s.meBadge}><MaterialIcons name="star" size={7} color="#FFF" /></View> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.playerName, isMe && { color: theme.primary }]} numberOfLines={1}>
                        {p.name}{isMe ? ` (${t('leaderboard', 'you')})` : ''}
                      </Text>
                      {p.club ? <Text style={s.playerClub} numberOfLines={1}>{p.club}</Text> : null}
                    </View>
                  </View>
                  <Text style={s.statCell}>{p.stats.matchesPlayed}</Text>
                  <Text style={[s.statCell, sortBy === 'winRate' && { color: '#D97706', fontWeight: '700' }]}>{p.stats.winRate}%</Text>
                  <Text style={[s.statCell, sortBy === 'tirRate' && { color: theme.tirColor, fontWeight: '700' }]}>{p.stats.tirRate > 0 ? `${p.stats.tirRate}%` : '-'}</Text>
                  <Text style={[s.statCell, sortBy === 'carreauRate' && { color: theme.carreauColor, fontWeight: '700' }]}>{p.stats.carreauRate > 0 ? `${p.stats.carreauRate}%` : '-'}</Text>
                </Pressable>
              );
            })}

            {/* My rank if not in top 10 */}
            {myRank && myRank > 10 ? (() => {
              const myP = filteredSorted[myRank - 1];
              if (!myP) return null;
              return (
                <>
                  <View style={s.separator}>
                    <View style={s.separatorDot} />
                    <View style={s.separatorDot} />
                    <View style={s.separatorDot} />
                  </View>
                  <View style={[s.row, s.rowMe]}>
                    <View style={{ width: 28, alignItems: 'center' }}>
                      <Text style={[s.rankText, { color: theme.primary }]}>{myRank}</Text>
                    </View>
                    <View style={s.playerCol}>
                      <View style={s.avatarWrap}>
                        {myP.avatar ? (
                          <Image source={{ uri: myP.avatar }} style={s.avatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                        ) : (
                          <View style={[s.avatar, { backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFF' }}>{myP.name.charAt(0)}</Text>
                          </View>
                        )}
                        <View style={s.meBadge}><MaterialIcons name="star" size={7} color="#FFF" /></View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.playerName, { color: theme.primary }]} numberOfLines={1}>{myP.name} ({t('leaderboard', 'you')})</Text>
                        {myP.club ? <Text style={s.playerClub} numberOfLines={1}>{myP.club}</Text> : null}
                      </View>
                    </View>
                    <Text style={s.statCell}>{myP.stats.matchesPlayed}</Text>
                    <Text style={[s.statCell, { color: '#D97706', fontWeight: '700' }]}>{myP.stats.winRate}%</Text>
                    <Text style={s.statCell}>{myP.stats.tirRate > 0 ? `${myP.stats.tirRate}%` : '-'}</Text>
                    <Text style={s.statCell}>{myP.stats.carreauRate > 0 ? `${myP.stats.carreauRate}%` : '-'}</Text>
                  </View>
                </>
              );
            })() : null}

            {/* Make public note */}
            {!myRank && selfPlayer ? (
              <View style={s.note}>
                <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
                <Text style={s.noteText}>{t('leaderboard', 'makePublicToAppear')}</Text>
              </View>
            ) : null}

            {/* See full leaderboard link */}
            <Pressable
              style={s.seeFullBtn}
              onPress={() => { Haptics.selectionAsync(); router.push('/leaderboard' as any); }}
            >
              <Text style={s.seeFullBtnText}>{t('leaderboard', 'seeFullLeaderboard')}</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#D97706" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  sectionIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  sectionSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1 },

  // Filter toggle button
  filterToggle: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border },
  filterToggleActive: { backgroundColor: '#D97706' + '12', borderColor: '#D97706' + '30' },
  filterBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#D97706', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  filterBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },

  // Filters panel — normal flow, pushes content down
  filtersPanel: { marginBottom: 10, backgroundColor: theme.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: theme.border },
  filterGroup: { marginBottom: 10 },
  filterGroupTitle: { fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  filterChipsRow: { gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  filterChipActive: { backgroundColor: '#D97706' + '15', borderColor: '#D97706' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  filterChipTextActive: { color: '#D97706' },
  clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  clearFiltersBtnText: { fontSize: 12, fontWeight: '600', color: theme.error },

  // Active filter pills
  activeFiltersRow: { marginBottom: 8 },
  activeFiltersScroll: { gap: 6 },
  activeFilterPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#D97706' + '10', borderRadius: 14, borderWidth: 1, borderColor: '#D97706' + '25' },
  activeFilterPillText: { fontSize: 11, fontWeight: '600', color: '#D97706' },

  // Reset button in empty state
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#D97706' + '12', borderRadius: 8 },
  resetBtnText: { fontSize: 12, fontWeight: '600', color: '#D97706' },

  sortRow: { gap: 6, marginBottom: 12 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  sortChipActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  sortChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  sortChipTextActive: { color: '#FFF' },
  card: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, ...theme.shadows.card },
  center: { alignItems: 'center', paddingVertical: 28 },
  loadingIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#D97706' + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  loadingText: { fontSize: 13, color: theme.textMuted },
  errorText: { fontSize: 13, color: theme.textSecondary, marginTop: 8 },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.primary + '15', borderRadius: 8 },
  retryBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  emptyDesc: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 240 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 4 },
  headerCell: { fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerCellStat: { width: 38, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 4, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
  rowAlt: { backgroundColor: theme.backgroundSecondary + '30' },
  rowMe: { backgroundColor: theme.primary + '08', borderLeftWidth: 3, borderLeftColor: theme.primary, paddingLeft: 4 },
  medal: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontSize: 13, fontWeight: '900' },
  rankText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  playerCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 4 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 30, height: 30, borderRadius: 10, overflow: 'hidden' },
  meBadge: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.surface },
  playerName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  playerClub: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  statCell: { width: 38, fontSize: 12, fontWeight: '500', color: theme.textPrimary, textAlign: 'center' },
  separator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  separatorDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.textMuted },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  noteText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 16 },
  seeFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border },
  seeFullBtnText: { fontSize: 14, fontWeight: '700', color: '#D97706' },
});
