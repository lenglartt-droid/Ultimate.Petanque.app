import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme, { blurhash } from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/template';
import { useApp } from '@/contexts/AppContext';
import { fetchLeaderboard, sortLeaderboard, LeaderboardPlayer, LeaderboardSort } from '@/services/leaderboardService';
import { fetchClubLeaderboard, sortClubLeaderboard, LeaderboardClub } from '@/services/clubLeaderboardService';
import { fetchBoulesLeaderboard, aggregateBoulesData, sortBoulesLeaderboard, LeaderboardBoulesEntry } from '@/services/boulesLeaderboardService';
import { getBrandVisual, getBrandImage } from '@/constants/boulesDatabase';

type WidgetTab = 'players' | 'clubs' | 'boules';

export default function CommunityLeaderboard({ onFiltersToggled }: { onFiltersToggled?: (open: boolean) => void }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { selfPlayer } = useApp();

  const [activeTab, setActiveTab] = useState<WidgetTab>('players');

  // Players
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<LeaderboardSort>('winRate');

  // Clubs
  const [clubs, setClubs] = useState<LeaderboardClub[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const [clubsLoaded, setClubsLoaded] = useState(false);

  // Boules
  const [boulesRaw, setBoulesRaw] = useState<any[]>([]);
  const [boulesLoading, setBoulesLoading] = useState(false);
  const [boulesError, setBoulesError] = useState<string | null>(null);
  const [boulesLoaded, setBoulesLoaded] = useState(false);

  // Load players
  const loadPlayers = useCallback(async () => {
    setPlayersLoading(true);
    const { players: lbP, error: err } = await fetchLeaderboard();
    setPlayers(lbP);
    setPlayersError(err);
    setPlayersLoading(false);
  }, []);

  useEffect(() => { loadPlayers(); }, [loadPlayers]);

  // Lazy load clubs
  const loadClubs = useCallback(async () => {
    if (clubsLoaded) return;
    setClubsLoading(true);
    const { clubs: c, error: err } = await fetchClubLeaderboard();
    setClubs(c);
    setClubsError(err);
    setClubsLoading(false);
    setClubsLoaded(true);
  }, [clubsLoaded]);

  // Lazy load boules
  const loadBoules = useCallback(async () => {
    if (boulesLoaded) return;
    setBoulesLoading(true);
    const { entries, error: err } = await fetchBoulesLeaderboard();
    setBoulesRaw(entries);
    setBoulesError(err);
    setBoulesLoading(false);
    setBoulesLoaded(true);
  }, [boulesLoaded]);

  useEffect(() => {
    if (activeTab === 'clubs') loadClubs();
    if (activeTab === 'boules') loadBoules();
  }, [activeTab, loadClubs, loadBoules]);

  // Computed
  const filteredSorted = useMemo(() => sortLeaderboard(players, sortBy), [players, sortBy]);
  const sortedClubs = useMemo(() => sortClubLeaderboard(clubs, 'compositeScore'), [clubs]);
  const boulesEntries = useMemo(() => {
    const agg = aggregateBoulesData(boulesRaw, 'brand', 'all');
    return sortBoulesLeaderboard(agg, 'userCount');
  }, [boulesRaw]);

  const myRank = useMemo(() => {
    if (!selfPlayer || !user) return null;
    const idx = filteredSorted.findIndex(p => p.userId === user.id || p.id === selfPlayer.id);
    return idx >= 0 ? idx + 1 : null;
  }, [filteredSorted, selfPlayer, user]);

  const isLoading = activeTab === 'players' ? playersLoading : activeTab === 'clubs' ? clubsLoading : boulesLoading;
  const hasError = activeTab === 'players' ? playersError : activeTab === 'clubs' ? clubsError : boulesError;

  const retryFn = useCallback(() => {
    if (activeTab === 'players') loadPlayers();
    else if (activeTab === 'clubs') { setClubsLoaded(false); loadClubs(); }
    else { setBoulesLoaded(false); loadBoules(); }
  }, [activeTab, loadPlayers, loadClubs, loadBoules]);

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIcon, { backgroundColor: '#D97706' + '15' }]}>
          <MaterialIcons name="leaderboard" size={18} color="#D97706" />
        </View>
        <View style={s.sectionHeaderText}>
          <Text style={s.sectionTitle}>{t('leaderboard', 'title')}</Text>
          {activeTab === 'players' && filteredSorted.length > 0 ? (
            <Text style={s.sectionSubtitle}>{filteredSorted.length} {t('leaderboard', 'publicPlayersCount')} (≥10 {t('leaderboard', 'matches')})</Text>
          ) : activeTab === 'clubs' && sortedClubs.length > 0 ? (
            <Text style={s.sectionSubtitle}>{sortedClubs.length} {t('leaderboard', 'publicClubsCount')}</Text>
          ) : activeTab === 'boules' && boulesEntries.length > 0 ? (
            <Text style={s.sectionSubtitle}>{boulesEntries.length} {t('leaderboard', 'publicBoulesCount')}</Text>
          ) : null}
        </View>
      </View>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        {([
          { id: 'players' as WidgetTab, label: t('leaderboard', 'tabPlayers'), icon: 'people' },
          { id: 'clubs' as WidgetTab, label: t('leaderboard', 'tabClubs'), icon: 'home' },
          { id: 'boules' as WidgetTab, label: t('leaderboard', 'tabBoules'), icon: 'sports-baseball' },
        ]).map(tab => (
          <Pressable
            key={tab.id}
            style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
            onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.id); }}
          >
            <MaterialIcons name={tab.icon as any} size={14} color={activeTab === tab.id ? '#FFF' : theme.textSecondary} />
            <Text style={[s.tabBtnText, activeTab === tab.id && s.tabBtnTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Sort chips - players only */}
      {activeTab === 'players' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortRow}>
          {([
            { id: 'winRate' as LeaderboardSort, label: t('leaderboard', 'sortByWinRate') },
            { id: 'matches' as LeaderboardSort, label: t('leaderboard', 'sortByMatches') },
            { id: 'tirRate' as LeaderboardSort, label: t('leaderboard', 'sortByTirRate') },
            { id: 'pointRate' as LeaderboardSort, label: t('leaderboard', 'sortByPointRate') },
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
      ) : null}

      <View style={s.card}>
        {isLoading ? (
          <View style={s.center}>
            <View style={s.loadingIconBg}>
              <MaterialIcons name={activeTab === 'players' ? 'leaderboard' : activeTab === 'clubs' ? 'home' : 'sports-baseball'} size={24} color="#D97706" />
            </View>
            <Text style={s.loadingText}>{t('leaderboard', 'loading')}</Text>
          </View>
        ) : hasError ? (
          <View style={s.center}>
            <MaterialIcons name="error-outline" size={36} color={theme.error} />
            <Text style={s.errorText}>{t('leaderboard', 'errorLoading')}</Text>
            <Pressable style={s.retryBtn} onPress={retryFn}>
              <Text style={s.retryBtnText}>{t('leaderboard', 'retry')}</Text>
            </Pressable>
          </View>
        ) : activeTab === 'players' ? (
          /* ============ PLAYERS TAB ============ */
          filteredSorted.length === 0 ? (
            <View style={s.center}>
              <MaterialIcons name="people-outline" size={40} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{t('leaderboard', 'noPlayers')}</Text>
              <Text style={s.emptyDesc}>{t('leaderboard', 'noPlayersDesc')}</Text>
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
                <Text style={[s.headerCell, s.headerCellStat, sortBy === 'pointRate' && { color: theme.pointColor }]}>Pt</Text>
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={[s.playerName, isMe && { color: theme.primary }]} numberOfLines={1}>
                            {p.name}{isMe ? ` (${t('leaderboard', 'you')})` : ''}
                          </Text>
                          {p.isPremium ? (
                            <View style={s.premiumBadge}>
                              <MaterialIcons name="star" size={8} color="#A8B4C0" />
                            </View>
                          ) : null}
                        </View>
                        {p.club ? <Text style={s.playerClub} numberOfLines={1}>{p.club}</Text> : null}
                      </View>
                    </View>
                    <Text style={s.statCell}>{p.stats.matchesPlayed}</Text>
                    <Text style={[s.statCell, sortBy === 'winRate' && { color: '#D97706', fontWeight: '700' }]}>{p.stats.winRate}%</Text>
                    <Text style={[s.statCell, sortBy === 'tirRate' && { color: theme.tirColor, fontWeight: '700' }]}>{p.stats.tirRate > 0 ? `${p.stats.tirRate}%` : '-'}</Text>
                    <Text style={[s.statCell, sortBy === 'pointRate' && { color: theme.pointColor, fontWeight: '700' }]}>{p.stats.pointRate > 0 ? `${p.stats.pointRate}%` : '-'}</Text>
                    <Text style={[s.statCell, sortBy === 'carreauRate' && { color: theme.carreauColor, fontWeight: '700' }]}>{p.stats.carreauRate > 0 ? `${p.stats.carreauRate}%` : '-'}</Text>
                  </Pressable>
                );
              })}

              {/* My rank if not in top 10 */}
              {myRank && myRank > 10 ? (() => {
                const myP = filteredSorted[myRank - 1];
                if (!myP) return null;
                return (
                  <React.Fragment key="my-rank-footer">
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={[s.playerName, { color: theme.primary }]} numberOfLines={1}>{myP.name} ({t('leaderboard', 'you')})</Text>
                            {myP.isPremium ? (
                              <View style={s.premiumBadge}>
                                <MaterialIcons name="star" size={8} color="#A8B4C0" />
                              </View>
                            ) : null}
                          </View>
                          {myP.club ? <Text style={s.playerClub} numberOfLines={1}>{myP.club}</Text> : null}
                        </View>
                      </View>
                      <Text style={s.statCell}>{myP.stats.matchesPlayed}</Text>
                      <Text style={[s.statCell, { color: '#D97706', fontWeight: '700' }]}>{myP.stats.winRate}%</Text>
                      <Text style={s.statCell}>{myP.stats.tirRate > 0 ? `${myP.stats.tirRate}%` : '-'}</Text>
                      <Text style={s.statCell}>{myP.stats.pointRate > 0 ? `${myP.stats.pointRate}%` : '-'}</Text>
                      <Text style={s.statCell}>{myP.stats.carreauRate > 0 ? `${myP.stats.carreauRate}%` : '-'}</Text>
                    </View>
                  </React.Fragment>
                );
              })() : null}

              {/* Make public note */}
              {!myRank && selfPlayer ? (
                <View style={s.note}>
                  <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
                  <Text style={s.noteText}>{t('leaderboard', 'makePublicToAppear')}</Text>
                </View>
              ) : null}
            </>
          )
        ) : activeTab === 'clubs' ? (
          /* ============ CLUBS TAB ============ */
          sortedClubs.length === 0 ? (
            <View style={s.center}>
              <MaterialIcons name="home" size={40} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{t('leaderboard', 'noClubs')}</Text>
              <Text style={s.emptyDesc}>{t('leaderboard', 'noClubsDesc')}</Text>
            </View>
          ) : (
            <>
              {sortedClubs.slice(0, 3).map((club, idx) => {
                const rank = idx + 1;
                const medalColors: Record<number, string> = { 1: '#FFD700', 2: '#A8B4C0', 3: '#CD7F32' };
                const medalColor = medalColors[rank];
                return (
                  <Animated.View key={club.id} entering={FadeIn.duration(200).delay(idx * 60)}>
                    <Pressable
                      style={[s.clubRow, idx < 2 && { borderBottomWidth: 1, borderBottomColor: theme.border + '40' }]}
                      onPress={() => router.push({ pathname: `/club-ranking/${club.id}`, params: { name: club.name } } as any)}
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
                      <View style={s.clubLogoWrap}>
                        {club.logo ? (
                          <Image source={{ uri: club.logo }} style={s.clubLogo} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                        ) : (
                          <View style={[s.clubLogo, { backgroundColor: '#D97706' + '15', alignItems: 'center', justifyContent: 'center' }]}>
                            <MaterialIcons name="home" size={16} color="#D97706" />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.clubName} numberOfLines={1}>{club.name}</Text>
                        <View style={s.clubMeta}>
                          {club.city ? <Text style={s.clubCity} numberOfLines={1}>{club.city}</Text> : null}
                          <View style={s.clubMetaChip}>
                            <MaterialIcons name="people" size={10} color={theme.textMuted} />
                            <Text style={s.clubMetaText}>{club.playerCount}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.clubScoreCol}>
                        <Text style={s.clubScoreValue}>{club.stats.compositeScore}</Text>
                        <Text style={s.clubScoreLabel}>{t('leaderboard', 'clubComposite')}</Text>
                      </View>
                      <View style={s.clubWinCol}>
                        <Text style={s.clubWinValue}>{club.stats.avgWinRate}%</Text>
                        <Text style={s.clubWinLabel}>{t('leaderboard', 'clubAvgWin')}</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </>
          )
        ) : (
          /* ============ BOULES TAB ============ */
          boulesEntries.length === 0 ? (
            <View style={s.center}>
              <MaterialIcons name="sports-baseball" size={40} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{t('leaderboard', 'noBoules')}</Text>
              <Text style={s.emptyDesc}>{t('leaderboard', 'noBoulesDesc')}</Text>
            </View>
          ) : (
            <>
              {boulesEntries.slice(0, 3).map((entry, idx) => {
                const rank = idx + 1;
                const medalColors: Record<number, string> = { 1: '#FFD700', 2: '#A8B4C0', 3: '#CD7F32' };
                const medalColor = medalColors[rank];
                return (
                  <Animated.View key={entry.id} entering={FadeIn.duration(200).delay(idx * 60)}>
                    <Pressable style={[s.boulesRow, idx < 2 && { borderBottomWidth: 1, borderBottomColor: theme.border + '40' }]} onPress={() => router.push({ pathname: `/boules-ranking/${encodeURIComponent(entry.id)}`, params: { brand: entry.brand, model: entry.model || '', mode: 'brand' } } as any)}>
                      <View style={{ width: 28, alignItems: 'center' }}>
                        {medalColor ? (
                          <View style={[s.medal, { backgroundColor: medalColor + '20' }]}>
                            <Text style={[s.medalText, { color: medalColor }]}>{rank}</Text>
                          </View>
                        ) : (
                          <Text style={s.rankText}>{rank}</Text>
                        )}
                      </View>
                      {(() => { const bv = getBrandVisual(entry.brand); const bImg = getBrandImage(entry.brand); return (
                      <View style={[s.boulesIconWrap, { backgroundColor: bv.bg, alignItems: 'center', justifyContent: 'center' }]}>
                        {bImg ? (
                          <Image source={bImg} style={{ width: '65%', height: '65%' }} contentFit="contain" transition={200} />
                        ) : (
                          <Text style={{ fontSize: 10, fontWeight: '900', color: bv.text, letterSpacing: -0.5 }}>{bv.abbr}</Text>
                        )}
                      </View>
                      ); })()}
                      <View style={{ flex: 1 }}>
                        <Text style={s.boulesName} numberOfLines={1}>{entry.brand}</Text>
                        <View style={s.boulesMeta}>
                          <View style={s.clubMetaChip}>
                            <MaterialIcons name="people" size={10} color={theme.textMuted} />
                            <Text style={s.clubMetaText}>{entry.userCount}</Text>
                          </View>
                          <View style={s.clubMetaChip}>
                            <MaterialIcons name="sports" size={10} color={theme.textMuted} />
                            <Text style={s.clubMetaText}>{entry.totalMatches}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.boulesStatCol}>
                        <Text style={s.boulesStatValue}>{entry.stats.avgWinRate}%</Text>
                        <Text style={s.boulesStatLabel}>{t('leaderboard', 'boulesAvgWin')}</Text>
                      </View>
                      <View style={s.boulesStatCol}>
                        <Text style={s.boulesStatValue}>{entry.stats.avgTirRate > 0 ? `${entry.stats.avgTirRate}%` : '-'}</Text>
                        <Text style={s.boulesStatLabel}>{t('leaderboard', 'boulesTir')}</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </>
          )
        )}

        {/* See full leaderboard link — always present */}
        <Pressable
          style={s.seeFullBtn}
          onPress={() => { Haptics.selectionAsync(); router.push('/leaderboard' as any); }}
        >
          <Text style={s.seeFullBtnText}>{t('leaderboard', 'seeFullLeaderboard')}</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#D97706" />
        </Pressable>
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

  // Tabs
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  tabBtnActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  tabBtnText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  tabBtnTextActive: { color: '#FFF', fontWeight: '700' },

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

  // Players table
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 4 },
  headerCell: { fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerCellStat: { width: 34, textAlign: 'center' },
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
  premiumBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#A8B4C0' + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A8B4C0' + '40' },
  statCell: { width: 34, fontSize: 12, fontWeight: '500', color: theme.textPrimary, textAlign: 'center' },
  separator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  separatorDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.textMuted },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  noteText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 16 },

  // Club rows
  clubRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  clubLogoWrap: {},
  clubLogo: { width: 34, height: 34, borderRadius: 10, overflow: 'hidden' as const },
  clubName: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  clubMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  clubCity: { fontSize: 10, color: theme.textMuted },
  clubMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clubMetaText: { fontSize: 10, color: theme.textMuted },
  clubScoreCol: { alignItems: 'center', minWidth: 40 },
  clubScoreValue: { fontSize: 16, fontWeight: '900', color: '#D97706' },
  clubScoreLabel: { fontSize: 8, fontWeight: '600', color: '#D97706' },
  clubWinCol: { alignItems: 'center', minWidth: 36 },
  clubWinValue: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  clubWinLabel: { fontSize: 8, color: theme.textMuted },

  // Boules rows
  boulesRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  boulesIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#D97706' + '12', overflow: 'hidden' as const },
  boulesName: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  boulesMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  boulesStatCol: { alignItems: 'center', minWidth: 36 },
  boulesStatValue: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  boulesStatLabel: { fontSize: 8, color: theme.textMuted },

  seeFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border },
  seeFullBtnText: { fontSize: 14, fontWeight: '700', color: '#D97706' },
});
