import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAppData } from '@/contexts/AppContext';
import { fetchEloSeasons, fetchEloHistory, getEloRank, formatEloDelta, EloSeasonEntry, EloHistoryEntry, ELO_INITIAL, ELO_RANKS, isInPlacement, ELO_PLACEMENT_MATCHES } from '@/services/eloService';
import { LEAGUE_TIERS, getLeagueTier, getLeagueProgress, LeagueTier } from '@/services/globalRankingService';
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

  const [chartWidth, setChartWidth] = useState(() => Math.max(1, (Dimensions.get('window').width || 375) - 64));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setChartWidth(Math.max(1, window.width - 64)));
    return () => sub?.remove();
  }, []);

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

        {/* ===== ELO HISTORY CHART ===== */}
        {eloHistory.length >= 2 ? (() => {
          const reversed = [...eloHistory].reverse(); // oldest first
          const points = reversed.map(h => h.eloAfter);
          const minElo = Math.min(...points, ...LEAGUE_TIERS.filter(t => t.minElo <= Math.max(...points) + 100).map(t => t.minElo)) - 30;
          const maxElo = Math.max(...points) + 50;
          const eloRange = Math.max(maxElo - minElo, 50);
          const cw = chartWidth;
          const ch = 180;
          const padL = 36;
          const padR = 8;
          const padT = 12;
          const padB = 24;
          const graphW = cw - padL - padR;
          const graphH = ch - padT - padB;
          const xStep = points.length > 1 ? graphW / (points.length - 1) : graphW;
          const toY = (elo: number) => padT + graphH - ((elo - minElo) / eloRange) * graphH;
          const toX = (idx: number) => padL + idx * xStep;

          // Build SVG-like path using Views
          const tierLines = LEAGUE_TIERS.filter(t => t.minElo > minElo && t.minElo < maxElo);

          // Detect promotion/relegation points
          const milestones: { idx: number; type: 'promotion' | 'relegation'; tier: LeagueTier }[] = [];
          for (let i = 1; i < reversed.length; i++) {
            const prevTier = getLeagueTier(reversed[i - 1].eloAfter);
            const curTier = getLeagueTier(reversed[i].eloAfter);
            if (prevTier.id !== curTier.id) {
              milestones.push({ idx: i, type: curTier.minElo > prevTier.minElo ? 'promotion' : 'relegation', tier: curTier });
            }
          }

          return (
            <Animated.View entering={FadeInDown.duration(400).delay(50)}>
              <View style={st.chartCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <MaterialIcons name="show-chart" size={18} color={currentLeague.color} />
                  <Text style={st.sectionTitle}>{isFr ? 'Progression ELO' : 'ELO Progression'}</Text>
                  <Text style={{ fontSize: 10, color: theme.textMuted, marginLeft: 'auto' }}>{reversed.length} {isFr ? 'matchs' : 'matches'}</Text>
                </View>

                <View style={{ width: cw, height: ch, position: 'relative' }}>
                  {/* League tier threshold lines */}
                  {tierLines.map(tier => {
                    const y = toY(tier.minElo);
                    if (y < padT || y > ch - padB) return null;
                    return (
                      <View key={tier.id} style={{ position: 'absolute', top: y, left: padL, right: padR }}>
                        <View style={{ height: 1, backgroundColor: tier.color + '25' }} />
                        <View style={{ position: 'absolute', right: 0, top: -10, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: tier.color + '15', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ fontSize: 6 }}>{tier.emblem}</Text>
                          <Text style={{ fontSize: 7, fontWeight: '700', color: tier.color }}>{tier.minElo}</Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* Y-axis labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                    const elo = Math.round(minElo + eloRange * (1 - pct));
                    const y = padT + graphH * pct;
                    return (
                      <View key={pct} style={{ position: 'absolute', top: y - 6, left: 0, width: padL - 4, alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 8, color: theme.textMuted, fontWeight: '500' }}>{elo}</Text>
                      </View>
                    );
                  })}

                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75].map(pct => (
                    <View key={`grid-${pct}`} style={{ position: 'absolute', top: padT + graphH * pct, left: padL, right: padR, height: 1, backgroundColor: theme.border + '30' }} />
                  ))}

                  {/* Line segments */}
                  {points.map((elo, i) => {
                    if (i === 0) return null;
                    const x1 = toX(i - 1);
                    const y1 = toY(points[i - 1]);
                    const x2 = toX(i);
                    const y2 = toY(elo);
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    const isWin = reversed[i].won;
                    return (
                      <View
                        key={`line-${i}`}
                        style={{
                          position: 'absolute',
                          top: y1,
                          left: x1,
                          width: len,
                          height: 2,
                          backgroundColor: isWin ? '#22C55E' : '#EF4444',
                          transform: [{ rotate: `${angle}deg` }],
                          transformOrigin: 'left center',
                          opacity: 0.7,
                        }}
                      />
                    );
                  })}

                  {/* Data points */}
                  {points.map((elo, i) => {
                    const x = toX(i);
                    const y = toY(elo);
                    const milestone = milestones.find(m => m.idx === i);
                    const isLast = i === points.length - 1;
                    const dotSize = milestone ? 10 : isLast ? 8 : 4;
                    const dotColor = milestone ? milestone.tier.color : (reversed[i].won ? '#22C55E' : '#EF4444');
                    return (
                      <View
                        key={`dot-${i}`}
                        style={{
                          position: 'absolute',
                          top: y - dotSize / 2,
                          left: x - dotSize / 2,
                          width: dotSize,
                          height: dotSize,
                          borderRadius: dotSize / 2,
                          backgroundColor: dotColor,
                          borderWidth: milestone || isLast ? 2 : 0,
                          borderColor: milestone ? '#FFF' : (isLast ? currentLeague.color : 'transparent'),
                          zIndex: milestone || isLast ? 10 : 1,
                        }}
                      >
                        {/* Milestone label */}
                        {milestone ? (
                          <View style={{ position: 'absolute', bottom: dotSize + 2, left: -20, width: 50, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1, backgroundColor: milestone.tier.color + '20', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                              <MaterialIcons name={milestone.type === 'promotion' ? 'arrow-upward' : 'arrow-downward'} size={7} color={milestone.type === 'promotion' ? '#22C55E' : '#EF4444'} />
                              <Text style={{ fontSize: 6 }}>{milestone.tier.emblem}</Text>
                            </View>
                          </View>
                        ) : null}
                        {/* Last point label */}
                        {isLast ? (
                          <View style={{ position: 'absolute', bottom: dotSize + 2, left: -16, width: 40, alignItems: 'center' }}>
                            <View style={{ backgroundColor: currentLeague.color, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontSize: 8, fontWeight: '800', color: '#FFF' }}>{elo}</Text>
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                {/* Legend */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 8, height: 3, borderRadius: 1.5, backgroundColor: '#22C55E' }} />
                    <Text style={{ fontSize: 9, color: theme.textMuted }}>{isFr ? 'Victoire' : 'Win'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 8, height: 3, borderRadius: 1.5, backgroundColor: '#EF4444' }} />
                    <Text style={{ fontSize: 9, color: theme.textMuted }}>{isFr ? 'Defaite' : 'Loss'}</Text>
                  </View>
                  {milestones.length > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: currentLeague.color, borderWidth: 1.5, borderColor: '#FFF' }} />
                      <Text style={{ fontSize: 9, color: theme.textMuted }}>{isFr ? 'Changement' : 'Tier change'}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Animated.View>
          );
        })() : null}

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
              const seasonLeague = getLeagueTier(season.finalElo);
              const peakLeague = getLeagueTier(season.peakElo);
              const winRate = season.matchesPlayed > 0 ? Math.round((season.wins / season.matchesPlayed) * 100) : 0;
              return (
                <View key={season.id}>
                  <View style={st.seasonCard}>
                    {/* League gradient header */}
                    <LinearGradient colors={[seasonLeague.gradient[0] + '18', seasonLeague.gradient[1] + '08']} style={st.seasonGradientHeader}>
                      <View style={st.seasonHeader}>
                        <View style={[st.seasonEmblemWrap, { backgroundColor: seasonLeague.color + '20', borderColor: seasonLeague.color + '30' }]}>
                          <Text style={{ fontSize: 18 }}>{seasonLeague.emblem}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[st.seasonYear, { color: seasonLeague.color }]}>{season.seasonYear}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: seasonLeague.color + '90' }}>{isFr ? seasonLeague.name.fr : seasonLeague.name.en}</Text>
                        </View>
                        <LinearGradient colors={seasonLeague.gradient} style={st.seasonEloBadge}>
                          <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFF' }}>{season.finalElo}</Text>
                          <Text style={{ fontSize: 8, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>ELO</Text>
                        </LinearGradient>
                      </View>
                    </LinearGradient>
                    <View style={st.seasonStats}>
                      <View style={st.seasonStat}>
                        <Text style={[st.seasonStatValue, { color: peakLeague.color }]}>{season.peakElo}</Text>
                        <Text style={st.seasonStatLabel}>{t('leaderboard', 'eloPeakElo')}</Text>
                        <Text style={{ fontSize: 7, marginTop: 1 }}>{peakLeague.emblem}</Text>
                      </View>
                      <View style={st.seasonStat}>
                        <Text style={st.seasonStatValue}>{season.matchesPlayed}</Text>
                        <Text style={st.seasonStatLabel}>{t('palmares', 'matchs')}</Text>
                      </View>
                      <View style={st.seasonStat}>
                        <Text style={[st.seasonStatValue, { color: theme.success }]}>{winRate}%</Text>
                        <Text style={st.seasonStatLabel}>{t('palmares', 'victoires')}</Text>
                      </View>
                      <View style={st.seasonStat}>
                        <Text style={[st.seasonStatValue, { color: season.wins > 0 ? '#22C55E' : theme.textMuted }]}>{season.wins}</Text>
                        <Text style={st.seasonStatLabel}>{isFr ? 'V' : 'W'}</Text>
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
  chartCard: { backgroundColor: theme.surface, borderRadius: 18, padding: 16, marginBottom: 16, ...theme.shadows.card, overflow: 'hidden' as const },
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
  seasonCard: { backgroundColor: theme.surface, borderRadius: 18, marginBottom: 12, overflow: 'hidden' as const, ...theme.shadows.card },
  seasonGradientHeader: { paddingHorizontal: 14, paddingVertical: 12, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  seasonHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  seasonEmblemWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1.5 },
  seasonYear: { fontSize: 18, fontWeight: '900' as const },
  seasonEloBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignItems: 'center' as const },
  seasonStats: { flexDirection: 'row' as const, gap: 8, padding: 14, paddingTop: 12 },
  seasonStat: { flex: 1, alignItems: 'center' as const },
  seasonStatValue: { fontSize: 17, fontWeight: '800', color: theme.textPrimary },
  seasonStatLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2, fontWeight: '600' },
  seasonRoles: { flexDirection: 'row', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '40' },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
