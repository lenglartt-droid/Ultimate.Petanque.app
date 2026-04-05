import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAppData } from '@/contexts/AppContext';
import { fetchEloSeasons, fetchEloHistory, getEloRank, formatEloDelta, EloSeasonEntry, EloHistoryEntry, ELO_INITIAL, ELO_RANKS, isInPlacement, ELO_PLACEMENT_MATCHES } from '@/services/eloService';
import { LEAGUE_TIERS, getLeagueTier, getLeagueProgress } from '@/services/globalRankingService';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface SeasonAward {
  id: string;
  icon: string;
  color: string;
  label: string;
  value: string;
  subValue?: string;
  seasonYear: number;
}

export default function EloAwardsScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { selfPlayer, matches } = useAppData();
  const isFr = language === 'fr';

  const [seasons, setSeasons] = useState<EloSeasonEntry[]>([]);
  const [eloHistory, setEloHistory] = useState<EloHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selfPlayer) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const [seasonsRes, historyRes] = await Promise.all([
        fetchEloSeasons(selfPlayer.id),
        fetchEloHistory(selfPlayer.id, 100),
      ]);
      setSeasons(seasonsRes.seasons);
      setEloHistory(historyRes.history);
      setLoading(false);
    };
    load();
  }, [selfPlayer?.id]);

  const currentElo = selfPlayer?.eloRating || ELO_INITIAL;
  const currentRank = getEloRank(currentElo);
  const currentLeague = getLeagueTier(currentElo);
  const leagueProgress = getLeagueProgress(currentElo);

  // Current season stats
  const currentSeasonStats = useMemo(() => {
    const year = new Date().getFullYear();
    const yearStart = new Date(`${year}-01-01`);
    const seasonMatches = matches.filter(m => {
      const d = new Date(m.date);
      return d >= yearStart && (m.teamA.players.includes(selfPlayer?.id || '') || m.teamB.players.includes(selfPlayer?.id || ''));
    });
    const wins = seasonMatches.filter(m => {
      const inA = m.teamA.players.includes(selfPlayer?.id || '');
      return (inA && m.winner === 'A') || (!inA && m.winner === 'B');
    }).length;
    const currentYearHistory = eloHistory.filter(h => new Date(h.recordedAt).getFullYear() === year);
    const peakElo = currentYearHistory.length > 0 ? Math.max(...currentYearHistory.map(h => h.eloAfter), currentElo) : currentElo;
    const lowestElo = currentYearHistory.length > 0 ? Math.min(...currentYearHistory.map(h => h.eloAfter)) : currentElo;
    const progression = currentElo - (currentYearHistory.length > 0 ? currentYearHistory[currentYearHistory.length - 1]?.eloBefore || ELO_INITIAL : ELO_INITIAL);
    return { matchesPlayed: seasonMatches.length, wins, peakElo, lowestElo, progression, year };
  }, [matches, selfPlayer?.id, eloHistory, currentElo]);

  // Build awards from seasons
  const seasonAwards = useMemo((): SeasonAward[] => {
    if (seasons.length === 0) return [];
    const awards: SeasonAward[] = [];

    // Best progression (highest final - initial across seasons)
    const bestProg = [...seasons].sort((a, b) => (b.finalElo - ELO_INITIAL) - (a.finalElo - ELO_INITIAL))[0];
    if (bestProg && bestProg.finalElo > ELO_INITIAL) {
      awards.push({
        id: 'best_progression',
        icon: 'trending-up',
        color: '#10B981',
        label: t('leaderboard', 'eloAwardBestProgression'),
        value: `+${bestProg.finalElo - ELO_INITIAL}`,
        subValue: `${isFr ? 'Saison' : 'Season'} ${bestProg.seasonYear} (${bestProg.finalElo})`,
        seasonYear: bestProg.seasonYear,
      });
    }

    // Highest peak
    const bestPeak = [...seasons].sort((a, b) => b.peakElo - a.peakElo)[0];
    if (bestPeak && bestPeak.peakElo > ELO_INITIAL) {
      awards.push({
        id: 'highest_peak',
        icon: 'diamond',
        color: '#06B6D4',
        label: t('leaderboard', 'eloAwardHighestPeak'),
        value: String(bestPeak.peakElo),
        subValue: `${isFr ? 'Saison' : 'Season'} ${bestPeak.seasonYear} (${getEloRank(bestPeak.peakElo).label[isFr ? 'fr' : 'en']})`,
        seasonYear: bestPeak.seasonYear,
      });
    }

    // Best win ratio
    const seasonsWithMatches = seasons.filter(s => s.matchesPlayed >= 5);
    if (seasonsWithMatches.length > 0) {
      const bestWR = [...seasonsWithMatches].sort((a, b) => (b.wins / b.matchesPlayed) - (a.wins / a.matchesPlayed))[0];
      const wr = Math.round((bestWR.wins / bestWR.matchesPlayed) * 100);
      awards.push({
        id: 'best_win_ratio',
        icon: 'emoji-events',
        color: '#F59E0B',
        label: t('leaderboard', 'eloAwardBestWinRatio'),
        value: `${wr}%`,
        subValue: `${isFr ? 'Saison' : 'Season'} ${bestWR.seasonYear} (${bestWR.wins}/${bestWR.matchesPlayed})`,
        seasonYear: bestWR.seasonYear,
      });
    }

    // Most matches
    const mostMatches = [...seasons].sort((a, b) => b.matchesPlayed - a.matchesPlayed)[0];
    if (mostMatches && mostMatches.matchesPlayed > 0) {
      awards.push({
        id: 'most_matches',
        icon: 'sports',
        color: '#3B82F6',
        label: t('leaderboard', 'eloAwardMostMatches'),
        value: String(mostMatches.matchesPlayed),
        subValue: `${isFr ? 'Saison' : 'Season'} ${mostMatches.seasonYear}`,
        seasonYear: mostMatches.seasonYear,
      });
    }

    return awards;
  }, [seasons, t, isFr]);

  if (loading) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.header}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={st.headerTitle}>{t('leaderboard', 'eloAwardsTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#9333EA" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>{t('leaderboard', 'eloAwardsTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Current Season Hero — League Tier Style */}
        <Animated.View entering={FadeInDown.duration(400)}>
        <View style={st.heroCard}>
          <LinearGradient colors={currentLeague.gradient} style={st.heroGradient}>
            <View style={st.heroTop}>
              <View style={st.heroEmblemWrap}>
                <Text style={{ fontSize: 28 }}>{currentLeague.emblem}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.heroLeagueName}>{isFr ? currentLeague.name.fr : currentLeague.name.en}</Text>
                <Text style={st.heroEloValue}>{currentElo} ELO</Text>
              </View>
              <View style={st.heroSeasonBadge}>
                <Text style={st.heroSeasonYear}>{currentSeasonStats.year}</Text>
                <Text style={st.heroSeasonLabel}>{isFr ? 'Saison' : 'Season'}</Text>
              </View>
            </View>
            {/* Progress to next tier */}
            {leagueProgress.nextTier ? (
              <View style={st.heroProgressRow}>
                <View style={st.heroProgressTrack}>
                  <View style={[st.heroProgressFill, { width: `${leagueProgress.progress}%` }]} />
                </View>
                <Text style={st.heroProgressText}>{leagueProgress.eloToNext} → {leagueProgress.nextTier.emblem}</Text>
              </View>
            ) : null}
          </LinearGradient>
          <View style={st.heroStats}>
            <View style={st.heroStatItem}>
              <Text style={st.heroStatValue}>{currentSeasonStats.matchesPlayed}</Text>
              <Text style={st.heroStatLabel}>{t('leaderboard', 'eloMatchesThisSeason')}</Text>
            </View>
            <View style={st.heroStatDivider} />
            <View style={st.heroStatItem}>
              <Text style={[st.heroStatValue, { color: theme.success }]}>{currentSeasonStats.wins}</Text>
              <Text style={st.heroStatLabel}>{t('leaderboard', 'eloWinsThisSeason')}</Text>
            </View>
            <View style={st.heroStatDivider} />
            <View style={st.heroStatItem}>
              <Text style={[st.heroStatValue, { color: getEloRank(currentSeasonStats.peakElo).color }]}>{currentSeasonStats.peakElo}</Text>
              <Text style={st.heroStatLabel}>{t('leaderboard', 'eloPeakElo')}</Text>
            </View>
            <View style={st.heroStatDivider} />
            <View style={st.heroStatItem}>
              <Text style={[st.heroStatValue, { color: currentSeasonStats.progression >= 0 ? '#10B981' : '#EF4444' }]}>
                {formatEloDelta(currentSeasonStats.progression)}
              </Text>
              <Text style={st.heroStatLabel}>{t('leaderboard', 'eloAwardProgression')}</Text>
            </View>
          </View>
        </View>
        </Animated.View>

        {/* Placement Badge */}
        {isInPlacement(currentSeasonStats.matchesPlayed) ? (
          <View style={[st.heroCard, { borderColor: '#F59E0B20', marginBottom: 16 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[st.heroIconBox, { backgroundColor: '#F59E0B15' }]}>
                <MaterialIcons name="science" size={28} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#78350F' }}>{t('leaderboard', 'eloPlacementTitle')}</Text>
                <Text style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>
                  {t('leaderboard', 'eloPlacementProgress').replace('{current}', String(currentSeasonStats.matchesPlayed))}
                </Text>
                <View style={{ height: 6, backgroundColor: '#FDE68A', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                  <View style={{ height: '100%', width: `${(currentSeasonStats.matchesPlayed / ELO_PLACEMENT_MATCHES) * 100}%`, backgroundColor: '#F59E0B', borderRadius: 3 }} />
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {/* League Tiers Visualization — 6 tiers with gradients */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
        <View style={st.tiersCard}>
          <Text style={st.sectionTitle}>{t('leaderboard', 'eloRank')}</Text>
          {[...LEAGUE_TIERS].reverse().map((league, idx) => {
            const isCurrentTier = currentLeague.id === league.id;
            const nextLeague = [...LEAGUE_TIERS].reverse()[idx + 1];
            const progressInTier = nextLeague ? Math.min(100, Math.max(0, ((currentElo - league.minElo) / (nextLeague.minElo - league.minElo)) * 100)) : (isCurrentTier ? 100 : 0);
            const rangeLabel = league.maxElo === Infinity ? `${league.minElo}+` : `${league.minElo}-${league.maxElo}`;
            const isAbove = currentElo >= league.minElo;
            return (
              <Pressable
                key={league.id}
                style={[st.tierRow, isCurrentTier && { borderWidth: 1.5, borderColor: league.color + '40' }]}
                onPress={() => { router.push({ pathname: '/leaderboard', params: { tier: league.id } } as any); }}
              >
                <LinearGradient
                  colors={isCurrentTier ? league.gradient : [league.color + '08', league.color + '03']}
                  style={st.tierGradientBox}
                >
                  <Text style={{ fontSize: 18 }}>{league.emblem}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[st.tierName, isCurrentTier && { color: '#FFF', fontWeight: '800' }, !isCurrentTier && isAbove && { color: league.color }]}>
                      {isFr ? league.name.fr : league.name.en}
                    </Text>
                    <Text style={[st.tierRange, isCurrentTier && { color: 'rgba(255,255,255,0.5)' }]}>{rangeLabel}</Text>
                    {isCurrentTier ? (
                      <View style={[st.currentBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                        <Text style={st.currentBadgeText}>{isFr ? 'Actuel' : 'Current'}</Text>
                      </View>
                    ) : null}
                  </View>
                  {isCurrentTier ? (
                    <View style={st.tierProgress}>
                      <View style={[st.tierProgressFill, { width: `${Math.max(progressInTier, 5)}%`, backgroundColor: 'rgba(255,255,255,0.7)' }]} />
                    </View>
                  ) : null}
                </View>
                {isCurrentTier ? (
                  <LinearGradient colors={league.gradient} style={st.tierEloBadge}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFF' }}>{currentElo}</Text>
                  </LinearGradient>
                ) : (
                  <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
                )}
              </Pressable>
            );
          })}
        </View>
        </Animated.View>

        {/* Season Awards */}
        <View>
          <Text style={st.sectionTitleOuter}>{t('leaderboard', 'eloAwardsTitle')}</Text>
          {seasonAwards.length === 0 ? (
            <View style={st.emptyCard}>
              <MaterialIcons name="emoji-events" size={40} color={theme.textMuted} />
              <Text style={st.emptyTitle}>{t('leaderboard', 'eloAwardNoData')}</Text>
              <Text style={st.emptyDesc}>{t('leaderboard', 'eloAwardNoDataDesc')}</Text>
            </View>
          ) : (
            seasonAwards.map((award, idx) => (
              <View key={award.id}>
                <View style={[st.awardCard, { borderLeftWidth: 4, borderLeftColor: award.color }]}>
                  <View style={[st.awardIconBox, { backgroundColor: award.color + '15' }]}>
                    <MaterialIcons name={award.icon as any} size={24} color={award.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.awardLabel}>{award.label}</Text>
                    <Text style={[st.awardValue, { color: award.color }]}>{award.value}</Text>
                    {award.subValue ? <Text style={st.awardSub}>{award.subValue}</Text> : null}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Season History */}
        {seasons.length > 0 ? (
          <View>
            <Text style={st.sectionTitleOuter}>{t('leaderboard', 'eloSeasons')}</Text>
            {seasons.map((season, idx) => {
              const rank = getEloRank(season.finalElo);
              const peakRank = getEloRank(season.peakElo);
              const winRate = season.matchesPlayed > 0 ? Math.round((season.wins / season.matchesPlayed) * 100) : 0;
              return (
                <View key={season.id}>
                  <View style={[st.seasonCard, { borderLeftColor: rank.color }]}>
                    <View style={st.seasonHeader}>
                      <View style={[st.seasonYearBadge, { backgroundColor: rank.color + '15' }]}>
                        <MaterialIcons name={rank.icon as any} size={16} color={rank.color} />
                        <Text style={[st.seasonYear, { color: rank.color }]}>{season.seasonYear}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <View style={[st.seasonRankBadge, { backgroundColor: rank.color + '12', borderColor: rank.color + '30' }]}>
                        <Text style={[st.seasonRankText, { color: rank.color }]}>{rank.label[isFr ? 'fr' : 'en']}</Text>
                      </View>
                    </View>
                    <View style={st.seasonStats}>
                      <View style={st.seasonStat}>
                        <Text style={[st.seasonStatValue, { color: rank.color }]}>{season.finalElo}</Text>
                        <Text style={st.seasonStatLabel}>{t('leaderboard', 'eloFinalElo')}</Text>
                      </View>
                      <View style={st.seasonStat}>
                        <Text style={[st.seasonStatValue, { color: peakRank.color }]}>{season.peakElo}</Text>
                        <Text style={st.seasonStatLabel}>{t('leaderboard', 'eloPeakElo')}</Text>
                      </View>
                      <View style={st.seasonStat}>
                        <Text style={st.seasonStatValue}>{season.matchesPlayed}</Text>
                        <Text style={st.seasonStatLabel}>{t('palmares', 'matchs')}</Text>
                      </View>
                      <View style={st.seasonStat}>
                        <Text style={[st.seasonStatValue, { color: theme.success }]}>{winRate}%</Text>
                        <Text style={st.seasonStatLabel}>{t('palmares', 'victoires')}</Text>
                      </View>
                    </View>
                    {/* Role ELOs */}
                    {(season.eloTireur && season.eloTireur !== 1000) || (season.eloPointeur && season.eloPointeur !== 1000) || (season.eloMilieu && season.eloMilieu !== 1000) ? (
                      <View style={st.seasonRoles}>
                        {season.eloTireur && season.eloTireur !== 1000 ? (
                          <View style={[st.roleBadge, { backgroundColor: '#F9731612' }]}>
                            <MaterialIcons name="gps-fixed" size={10} color="#F97316" />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#F97316' }}>{season.eloTireur}</Text>
                          </View>
                        ) : null}
                        {season.eloPointeur && season.eloPointeur !== 1000 ? (
                          <View style={[st.roleBadge, { backgroundColor: '#3B82F612' }]}>
                            <MaterialIcons name="adjust" size={10} color="#3B82F6" />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#3B82F6' }}>{season.eloPointeur}</Text>
                          </View>
                        ) : null}
                        {season.eloMilieu && season.eloMilieu !== 1000 ? (
                          <View style={[st.roleBadge, { backgroundColor: '#8B5CF612' }]}>
                            <MaterialIcons name="swap-horiz" size={10} color="#8B5CF6" />
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#8B5CF6' }}>{season.eloMilieu}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  heroCard: { backgroundColor: theme.surface, borderRadius: 20, overflow: 'hidden' as const, marginBottom: 16, ...theme.shadows.card },
  heroGradient: { padding: 20, paddingBottom: 16 },
  heroTop: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
  heroEmblemWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  heroLeagueName: { fontSize: 18, fontWeight: '800' as const, color: '#FFF', letterSpacing: -0.3 },
  heroEloValue: { fontSize: 13, fontWeight: '600' as const, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroSeasonBadge: { alignItems: 'center' as const, backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  heroSeasonYear: { fontSize: 16, fontWeight: '900' as const, color: '#FFF' },
  heroSeasonLabel: { fontSize: 9, fontWeight: '600' as const, color: 'rgba(255,255,255,0.5)' },
  heroProgressRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 12 },
  heroProgressTrack: { flex: 1, height: 5, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 3, overflow: 'hidden' as const },
  heroProgressFill: { height: '100%' as const, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 3 },
  heroProgressText: { fontSize: 10, fontWeight: '700' as const, color: 'rgba(255,255,255,0.6)' },
  heroStats: { flexDirection: 'row' as const, backgroundColor: theme.surface, paddingVertical: 14, paddingHorizontal: 8 },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: theme.textPrimary },
  heroStatLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2, fontWeight: '600', textAlign: 'center' },
  heroStatDivider: { width: 1, height: 28, backgroundColor: theme.border },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  sectionTitleOuter: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginTop: 8, marginBottom: 12 },
  tiersCard: { backgroundColor: theme.surface, borderRadius: 18, padding: 16, marginBottom: 16, ...theme.shadows.card },
  tierRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: 'transparent' },
  tierGradientBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  tierName: { fontSize: 14, fontWeight: '600' as const, color: theme.textPrimary },
  tierRange: { fontSize: 11, color: theme.textMuted },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  currentBadgeText: { fontSize: 9, fontWeight: '800' as const, color: '#FFF' },
  tierProgress: { height: 5, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, overflow: 'hidden' as const, marginTop: 6 },
  tierProgressFill: { height: '100%' as const, borderRadius: 3 },
  tierEloBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  awardCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 10, ...theme.shadows.card },
  awardIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  awardLabel: { fontSize: 12, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  awardValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  awardSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  emptyCard: { alignItems: 'center', paddingVertical: 40, backgroundColor: theme.surface, borderRadius: 16, ...theme.shadows.card },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 24 },
  seasonCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  seasonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  seasonYearBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  seasonYear: { fontSize: 16, fontWeight: '800' },
  seasonRankBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  seasonRankText: { fontSize: 12, fontWeight: '700' },
  seasonStats: { flexDirection: 'row', gap: 8 },
  seasonStat: { flex: 1, alignItems: 'center' },
  seasonStatValue: { fontSize: 17, fontWeight: '800', color: theme.textPrimary },
  seasonStatLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2, fontWeight: '600' },
  seasonRoles: { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '40' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
