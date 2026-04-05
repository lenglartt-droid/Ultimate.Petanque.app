import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';

import * as Haptics from '@/services/haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import AdBanner from '@/components/ui/AdBanner';
import { useLanguage } from '@/hooks/useLanguage';
import { useAppData, useAppActions } from '@/contexts/AppContext';
import { useAuth } from '@/template';
import ShareModal from '@/components/ui/ShareModal';
import SharedBadge from '@/components/ui/SharedBadge';
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';
import { Match } from '@/types/petanque';
import Svg, { Circle, Line, G, Polygon, Text as SvgText } from 'react-native-svg';
import {
  getMatchValidationLevel,
  getValidationColor,
  getValidationIcon,
  getValidationLabel,
  getMatchValidationWeight,
} from '@/services/trustScoreService';
import { fetchAttestationsForItem } from '@/services/witnessService';
import AttestationSection from '@/components/feature/AttestationSection';
import { getEloRank, getEloColor, formatEloDelta, EloHistoryEntry } from '@/services/eloService';
import { getSupabaseClient } from '@/template';

export default function MatchDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { matches, terrains, boulesSets, tournaments, loading: appLoading } = useAppData();
  const { isSharedItem, getSharedPermission, refreshData } = useAppActions();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const fr = language === 'fr';
  const locale = fr ? 'fr-FR' : 'en-US';

  const [refreshing, setRefreshing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [goldSponsor, setGoldSponsor] = useState<Ambassador | null>(null);
  const [witnessRequests, setWitnessRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchAmbassadors().then(({ ambassadors }) => {
      const gold = ambassadors.find(a => a.badgeType === 'gold_sponsor');
      if (gold) setGoldSponsor(gold);
    });
  }, []);

  // ELO deltas for this match
  const [eloDeltas, setEloDeltas] = useState<Map<string, { delta: number; eloAfter: number }>>(new Map());

  useEffect(() => {
    if (!id) return;
    fetchAttestationsForItem('match', id).then(reqs => setWitnessRequests(reqs));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const loadEloDeltas = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('elo_history')
          .select('player_id, elo_delta, elo_after')
          .eq('match_id', id);
        if (data && data.length > 0) {
          const map = new Map<string, { delta: number; eloAfter: number }>();
          for (const row of data) {
            map.set(row.player_id, { delta: row.elo_delta, eloAfter: row.elo_after });
          }
          setEloDeltas(map);
        }
      } catch { /* silent */ }
    };
    loadEloDeltas();
  }, [id]);

  const match: Match | undefined = useMemo(() => matches.find(m => m.id === id), [matches, id]);

  const sharedPermission = id ? getSharedPermission(id) : null;
  const isShared = id ? isSharedItem(id) : false;

  // Series
  const seriesMatches = useMemo(() => {
    if (!match?.seriesInfo?.seriesId) return [];
    return matches
      .filter(m => m.seriesInfo?.seriesId === match.seriesInfo?.seriesId)
      .sort((a, b) => (a.seriesInfo?.matchNumber || 1) - (b.seriesInfo?.matchNumber || 1));
  }, [match, matches]);

  const seriesStats = useMemo(() => {
    if (seriesMatches.length <= 1) return null;
    let winsA = 0, winsB = 0;
    seriesMatches.forEach(m => { if (m.winner === 'A') winsA++; else if (m.winner === 'B') winsB++; });
    const isComplete = winsA >= 2 || winsB >= 2;
    return { winsA, winsB, isComplete, seriesWinner: isComplete ? (winsA >= 2 ? 'A' : 'B') : null };
  }, [seriesMatches]);

  const selectedTerrain = useMemo(() => match?.terrainId ? terrains.find(tr => tr.id === match.terrainId) : null, [match, terrains]);
  const matchBoulesSet = useMemo(() => match?.boulesSetId ? boulesSets.find(bs => bs.id === match.boulesSetId) : null, [match, boulesSets]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // Validation
  const validation = useMemo(() => {
    if (!match) return null;
    const pIds: string[] = (match as any)?.participantUserIds || [];
    const isWitnessed = witnessRequests.some(r => r.status === 'attested');
    const count = Array.isArray(pIds) ? pIds.length : 0;
    const vLevel = getMatchValidationLevel(count, isWitnessed);
    return {
      level: vLevel,
      color: getValidationColor(vLevel),
      icon: getValidationIcon(vLevel),
      label: getValidationLabel(vLevel, fr),
      weight: getMatchValidationWeight(count, isWitnessed),
    };
  }, [match, witnessRequests, fr]);

  if (!match) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>{fr ? 'Detail du match' : 'Match detail'}</Text>
          <View style={{ width: 40 }} />
        </View>
        {appLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
        ) : (
          <View style={s.center}>
            <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
            <Text style={s.emptyText}>{fr ? 'Match introuvable' : 'Match not found'}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const isWin = match.winner === 'A';
  const isTournament = match.mode === 'Tournoi';
  const dateStr = new Date(match.date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = new Date(match.date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const meneTotalA = match.menes?.reduce((sum, m) => sum + (m.teamAPoints || 0), 0) || 0;
  const meneTotalB = match.menes?.reduce((sum, m) => sum + (m.teamBPoints || 0), 0) || 0;

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{fr ? 'Detail du match' : 'Match detail'}</Text>
        <Pressable style={s.shareBtn} onPress={() => { Haptics.selectionAsync(); setShowShareModal(true); }}>
          <MaterialIcons name="share" size={20} color={theme.success} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Hero Card */}
        <View style={s.heroCard}>
          <View style={[s.heroAccent, { backgroundColor: isWin ? theme.success : theme.error }]} />
          <View style={s.heroContent}>
            <View style={s.heroTopRow}>
              <View style={[s.heroIconCircle, { backgroundColor: (isTournament ? theme.carreauColor : theme.primary) + '15', borderColor: (isTournament ? theme.carreauColor : theme.primary) + '35' }]}>
                <MaterialIcons name={isTournament ? 'emoji-events' : 'fitness-center'} size={32} color={isTournament ? theme.carreauColor : theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>
                  {isTournament ? (match.tournamentName || t('modes', 'tournament')) : t('modes', 'training')}
                </Text>
                <View style={s.heroTagsRow}>
                  <View style={[s.heroTag, { backgroundColor: (isTournament ? theme.carreauColor : theme.primary) + '12' }]}>
                    <MaterialIcons name={isTournament ? 'emoji-events' : 'fitness-center'} size={12} color={isTournament ? theme.carreauColor : theme.primary} />
                    <Text style={[s.heroTagText, { color: isTournament ? theme.carreauColor : theme.primary }]}>
                      {isTournament ? t('modes', 'tournament') : t('modes', 'training')}
                    </Text>
                  </View>
                  <View style={[s.heroTag, { backgroundColor: theme.backgroundSecondary }]}>
                    <MaterialIcons name="groups" size={12} color={theme.textSecondary} />
                    <Text style={[s.heroTagText, { color: theme.textSecondary }]}>{t('formats', match.format)}</Text>
                  </View>
                  {isShared ? <SharedBadge permission={sharedPermission || 'read'} size="small" /> : null}
                </View>
              </View>
            </View>

            {/* Meta pills */}
            <View style={s.metaRow}>
              <View style={s.metaPill}>
                <MaterialIcons name="event" size={13} color={theme.primary} />
                <Text style={s.metaPillText}>{dateStr}</Text>
              </View>
              <View style={s.metaPill}>
                <MaterialIcons name="schedule" size={13} color={theme.accent} />
                <Text style={s.metaPillText}>{timeStr}</Text>
              </View>
              {match.duration > 0 ? (
                <View style={s.metaPill}>
                  <MaterialIcons name="timer" size={13} color={theme.warning} />
                  <Text style={s.metaPillText}>{match.duration} min</Text>
                </View>
              ) : null}
            </View>

            {/* Extra badges */}
            <View style={s.metaRow}>
              {selectedTerrain ? (
                <View style={s.metaPill}>
                  <MaterialIcons name="place" size={13} color={theme.success} />
                  <Text style={s.metaPillText}>{selectedTerrain.name}</Text>
                </View>
              ) : null}
              {matchBoulesSet ? (
                <View style={s.metaPill}>
                  <MaterialIcons name="sports-baseball" size={13} color="#D97706" />
                  <Text style={s.metaPillText}>{matchBoulesSet.name}</Text>
                </View>
              ) : null}
              {isTournament && match.tournamentPhase ? (
                <View style={[s.metaPill, { backgroundColor: theme.carreauColor + '12' }]}>
                  <MaterialIcons name="flag" size={13} color={theme.carreauColor} />
                  <Text style={[s.metaPillText, { color: theme.carreauColor }]}>{t('tournamentPhases', match.tournamentPhase)}</Text>
                </View>
              ) : null}
            </View>

            {/* Gold Sponsor Badge */}
            {goldSponsor ? (
              <Pressable
                style={({ pressed }) => [s.sponsorRow, pressed && { opacity: 0.9 }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  trackAmbassadorEvent(goldSponsor.id, 'profile_view', undefined, { sourcePage: 'match_detail_view' });
                  router.push('/partners' as any);
                }}
              >
                <LinearGradient colors={['#FFFBEB', '#FEF3C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sponsorGradient}>
                  <View style={s.sponsorAccentLine} />
                  <View style={s.sponsorContent}>
                    {goldSponsor.photo ? (
                      <Image source={{ uri: goldSponsor.photo }} style={s.sponsorLogo} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                    ) : (
                      <LinearGradient colors={['#B45309', '#F59E0B']} style={s.sponsorLogoFallback}>
                        <MaterialIcons name="workspace-premium" size={24} color="#FFF" />
                      </LinearGradient>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.sponsorLabel}>{fr ? 'Sponsorise par' : 'Sponsored by'}</Text>
                      <Text style={s.sponsorName} numberOfLines={1}>{goldSponsor.displayName}</Text>
                    </View>
                    <LinearGradient colors={['#B45309', '#D97706']} style={s.sponsorTierIcon}>
                      <MaterialIcons name="star" size={10} color="#FFF" />
                    </LinearGradient>
                  </View>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Score Card */}
        <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: isWin ? theme.success : theme.error }]}>
          <View style={s.scoreRow}>
            <View style={s.teamCol}>
              <Text style={s.teamLabel}>{fr ? 'MON EQUIPE' : 'MY TEAM'}</Text>
              <Text style={s.teamNames} numberOfLines={2}>{match.teamA.playerNames.join(' \u2022 ')}</Text>
            </View>
            <View style={s.scoreCenter}>
              <View style={s.scoreBox}>
                <Text style={[s.scoreNum, isWin && { color: theme.success }]}>{match.teamA.score}</Text>
                <Text style={s.scoreSep}>-</Text>
                <Text style={[s.scoreNum, !isWin && { color: theme.error }]}>{match.teamB.score}</Text>
              </View>
              <View style={[s.resultBadge, { backgroundColor: (isWin ? theme.success : theme.error) + '15' }]}>
                <MaterialIcons name={isWin ? 'check-circle' : 'cancel'} size={14} color={isWin ? theme.success : theme.error} />
                <Text style={[s.resultText, { color: isWin ? theme.success : theme.error }]}>
                  {isWin ? t('history', 'victory') : t('history', 'defeat')}
                </Text>
              </View>
            </View>
            <View style={[s.teamCol, { alignItems: 'flex-end' }]}>
              <Text style={s.teamLabel}>{fr ? 'ADVERSAIRE' : 'OPPONENT'}</Text>
              <Text style={[s.teamNames, { textAlign: 'right' }]} numberOfLines={2}>{match.teamB.playerNames.join(' \u2022 ')}</Text>
            </View>
          </View>

          {/* ELO Deltas per player */}
          {eloDeltas.size > 0 ? (
            <View style={s.eloRow}>
              {[...match.teamA.players, ...match.teamB.players].map((pid, idx) => {
                const eloData = eloDeltas.get(pid);
                if (!eloData) return null;
                const isTeamA = match.teamA.players.includes(pid);
                const playerNames = isTeamA ? match.teamA.playerNames : match.teamB.playerNames;
                const playerIdx = isTeamA ? match.teamA.players.indexOf(pid) : match.teamB.players.indexOf(pid);
                const pName = playerNames[playerIdx]?.split(' ')[0] || '?';
                const eloRank = getEloRank(eloData.eloAfter);
                return (
                  <View key={pid} style={s.eloDeltaItem}>
                    <Text style={s.eloDeltaName} numberOfLines={1}>{pName}</Text>
                    <View style={[s.eloDeltaBadge, { backgroundColor: eloRank.color + '12', borderColor: eloRank.color + '30' }]}>
                      <MaterialIcons name={eloRank.icon as any} size={9} color={eloRank.color} />
                      <Text style={[s.eloDeltaElo, { color: eloRank.color }]}>{eloData.eloAfter}</Text>
                    </View>
                    <View style={[s.eloDeltaChange, { backgroundColor: eloData.delta >= 0 ? '#10B98112' : '#EF444412' }]}>
                      <MaterialIcons name={eloData.delta >= 0 ? 'arrow-upward' : 'arrow-downward'} size={10} color={eloData.delta >= 0 ? '#10B981' : '#EF4444'} />
                      <Text style={[s.eloDeltaChangeText, { color: eloData.delta >= 0 ? '#10B981' : '#EF4444' }]}>
                        {eloData.delta >= 0 ? `+${eloData.delta}` : `${eloData.delta}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Player roles */}
          {match.teamA.playerRoles && match.teamA.playerRoles.length > 0 ? (
            <View style={s.rolesRow}>
              {match.teamA.playerRoles.map((pr, idx) => {
                const cfg: Record<string, { icon: string; color: string }> = { 'Pointeur': { icon: 'radio-button-on', color: '#3B82F6' }, 'Milieu': { icon: 'swap-horiz', color: '#8B5CF6' }, 'Tireur': { icon: 'gps-fixed', color: '#F97316' } };
                const rc = cfg[pr.role] || { icon: 'person', color: theme.textMuted };
                return (
                  <View key={pr.playerId} style={[s.roleBadge, { backgroundColor: rc.color + '15' }]}>
                    <MaterialIcons name={rc.icon as any} size={11} color={rc.color} />
                    <Text style={[s.roleBadgeText, { color: rc.color }]}>{match.teamA.playerNames[idx]?.split(' ')[0]} - {t('roles', pr.role)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Validation Badge */}
        {validation ? (
          <View style={[s.card, { borderWidth: 1, borderColor: validation.color + '30', backgroundColor: validation.color + '04' }]}>
            <View style={s.validationRow}>
              <View style={[s.validationIconBg, { backgroundColor: validation.color + '15' }]}>
                <MaterialIcons name={validation.icon as any} size={20} color={validation.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.validationLabel, { color: validation.color }]}>{validation.label}</Text>
                <Text style={s.validationSub}>
                  {fr ? 'Poids classement' : 'Leaderboard weight'}: <Text style={{ fontWeight: '800', color: validation.color }}>{validation.weight}x</Text>
                </Text>
              </View>
              <View style={[s.validationCircle, { borderColor: validation.color }]}>
                <Text style={[s.validationCircleText, { color: validation.color }]}>{validation.weight}x</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Series Info */}
        {seriesMatches.length > 1 && seriesStats ? (
          <View style={[s.card, { borderWidth: 1, borderColor: theme.accent + '30' }]}>
            <View style={s.seriesHeader}>
              <MaterialIcons name="replay" size={16} color={theme.accent} />
              <Text style={s.seriesTitle}>Best of {seriesMatches.length >= 3 ? '3' : seriesMatches.length}</Text>
              <View style={[s.seriesScoreBadge, { backgroundColor: (seriesStats.winsA > seriesStats.winsB ? theme.success : seriesStats.winsB > seriesStats.winsA ? theme.error : theme.warning) + '15' }]}>
                <Text style={[s.seriesScoreText, { color: seriesStats.winsA > seriesStats.winsB ? theme.success : seriesStats.winsB > seriesStats.winsA ? theme.error : theme.warning }]}>
                  {seriesStats.winsA} - {seriesStats.winsB}
                </Text>
              </View>
            </View>
            <View style={s.seriesList}>
              {seriesMatches.map((sm, idx) => {
                const isCurrent = sm.id === match.id;
                const smWin = sm.winner === 'A';
                return (
                  <Pressable
                    key={sm.id}
                    style={[s.seriesMatch, isCurrent && s.seriesMatchCurrent]}
                    onPress={() => { if (!isCurrent) { Haptics.selectionAsync(); router.replace(`/match-detail/${sm.id}` as any); } }}
                  >
                    <View style={[s.seriesDot, { backgroundColor: smWin ? theme.success : theme.error }]} />
                    <Text style={s.seriesMatchLabel}>
                      {sm.seriesInfo?.isFinale ? (fr ? 'Finale' : 'Final') : `M${idx + 1}`}
                      {isCurrent ? ` (${fr ? 'actuel' : 'current'})` : ''}
                    </Text>
                    <Text style={[s.seriesMatchScore, { color: smWin ? theme.success : theme.error }]}>
                      {sm.teamA.score}-{sm.teamB.score}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Witness Attestation Section */}
        <AttestationSection
          itemType="match"
          itemId={match.id}
          snapshotData={{
            teamA: { playerNames: match.teamA.playerNames, score: match.teamA.score },
            teamB: { playerNames: match.teamB.playerNames, score: match.teamB.score },
            winner: match.winner,
            format: match.format,
            date: match.date,
            duration: match.duration,
          }}
          animDelay={0}
          onAttestationChange={(attested, count) => {
            if (attested) fetchAttestationsForItem('match', match.id).then(setWitnessRequests);
          }}
        />

        {/* Menes */}
        {match.menes && match.menes.length > 0 ? (
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <MaterialIcons name="format-list-numbered" size={16} color={theme.primary} />
              <Text style={s.cardTitle}>{t('match', 'menesCount')} ({match.menes.length})</Text>
            </View>

            {/* Visual mene chart */}
            <View style={s.meneChart}>
              {match.menes.map((mene, idx) => {
                const cumulA = match.menes!.slice(0, idx + 1).reduce((sum, m) => sum + (m.teamAPoints || 0), 0);
                const cumulB = match.menes!.slice(0, idx + 1).reduce((sum, m) => sum + (m.teamBPoints || 0), 0);
                const aHeight = Math.max(4, ((mene.teamAPoints || 0) / 6) * 40);
                const bHeight = Math.max(4, ((mene.teamBPoints || 0) / 6) * 40);
                return (
                  <View key={idx} style={s.meneColumn}>
                    <Text style={s.meneColNum}>#{idx + 1}</Text>
                    <View style={s.meneBarGroup}>
                      <View style={[s.meneBar, { height: aHeight, backgroundColor: theme.success }]} />
                      <View style={[s.meneBar, { height: bHeight, backgroundColor: theme.error }]} />
                    </View>
                    <Text style={s.meneColScore}>{cumulA}-{cumulB}</Text>
                  </View>
                );
              })}
            </View>

            {/* Mene list */}
            <View style={s.meneList}>
              {match.menes.map((mene, idx) => (
                <View key={idx} style={s.meneRow}>
                  <Text style={s.meneNum}>#{idx + 1}</Text>
                  <View style={s.meneScores}>
                    <Text style={[s.meneScore, (mene.teamAPoints || 0) > 0 && { color: theme.success, fontWeight: '700' }]}>{mene.teamAPoints || 0}</Text>
                    <Text style={s.meneSep}>-</Text>
                    <Text style={[s.meneScore, (mene.teamBPoints || 0) > 0 && { color: theme.error, fontWeight: '700' }]}>{mene.teamBPoints || 0}</Text>
                  </View>
                  <View style={s.meneCumul}>
                    <Text style={s.meneCumulText}>
                      {match.menes!.slice(0, idx + 1).reduce((sum, m) => sum + (m.teamAPoints || 0), 0)}-{match.menes!.slice(0, idx + 1).reduce((sum, m) => sum + (m.teamBPoints || 0), 0)}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={s.meneTotalRow}>
                <Text style={s.meneTotalLabel}>Total</Text>
                <Text style={[s.meneTotalVal, { color: theme.success }]}>{meneTotalA}</Text>
                <Text style={s.meneSep}>-</Text>
                <Text style={[s.meneTotalVal, { color: theme.error }]}>{meneTotalB}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Radar Chart - Team Performance Comparison */}
        {match.playerActions && match.playerActions.length > 0 ? (() => {
          const teamAActions = match.playerActions!.filter(pa => pa.team === 'A');
          const teamBActions = match.playerActions!.filter(pa => pa.team === 'B');
          const sumActions = (arr: typeof teamAActions) => arr.reduce((acc, pa) => ({
            tirs: acc.tirs + pa.actions.tirs,
            tirsSuccess: acc.tirsSuccess + pa.actions.tirsSuccess,
            points: acc.points + pa.actions.points,
            pointsSuccess: acc.pointsSuccess + pa.actions.pointsSuccess,
            carreaux: acc.carreaux + pa.actions.carreaux,
          }), { tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 });
          const aSum = sumActions(teamAActions);
          const bSum = sumActions(teamBActions);
          const aTirRate = aSum.tirs > 0 ? (aSum.tirsSuccess / aSum.tirs) * 100 : 0;
          const bTirRate = bSum.tirs > 0 ? (bSum.tirsSuccess / bSum.tirs) * 100 : 0;
          const aPointRate = aSum.points > 0 ? (aSum.pointsSuccess / aSum.points) * 100 : 0;
          const bPointRate = bSum.points > 0 ? (bSum.pointsSuccess / bSum.points) * 100 : 0;
          const maxCarreaux = Math.max(1, aSum.carreaux, bSum.carreaux);
          const aCarreauxNorm = (aSum.carreaux / maxCarreaux) * 100;
          const bCarreauxNorm = (bSum.carreaux / maxCarreaux) * 100;
          const meneCount = match.menes?.length || 1;
          const aAvgMene = meneTotalA / meneCount;
          const bAvgMene = meneTotalB / meneCount;
          const maxAvgMene = Math.max(1, aAvgMene, bAvgMene);
          const aAvgMeneNorm = (aAvgMene / maxAvgMene) * 100;
          const bAvgMeneNorm = (bAvgMene / maxAvgMene) * 100;

          const labels = [
            fr ? 'Taux Tir' : 'Shot Rate',
            fr ? 'Taux Point' : 'Point Rate',
            'Carreaux',
            fr ? 'Score/Mene' : 'Score/End',
          ];
          const aValues = [aTirRate, aPointRate, aCarreauxNorm, aAvgMeneNorm];
          const bValues = [bTirRate, bPointRate, bCarreauxNorm, bAvgMeneNorm];
          const aRaw = [
            aSum.tirs > 0 ? `${Math.round(aTirRate)}%` : '-',
            aSum.points > 0 ? `${Math.round(aPointRate)}%` : '-',
            `${aSum.carreaux}`,
            `${aAvgMene.toFixed(1)}`,
          ];
          const bRaw = [
            bSum.tirs > 0 ? `${Math.round(bTirRate)}%` : '-',
            bSum.points > 0 ? `${Math.round(bPointRate)}%` : '-',
            `${bSum.carreaux}`,
            `${bAvgMene.toFixed(1)}`,
          ];

          const radarSize = 220;
          const cx = radarSize / 2;
          const cy = radarSize / 2;
          const maxR = radarSize / 2 - 32;
          const numAxes = labels.length;
          const angleStep = (2 * Math.PI) / numAxes;
          const getPoint = (value: number, index: number) => {
            const angle = index * angleStep - Math.PI / 2;
            const r = (Math.min(value, 100) / 100) * maxR;
            return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
          };
          const aPoints = aValues.map((v, i) => getPoint(v, i));
          const bPoints = bValues.map((v, i) => getPoint(v, i));
          const aPolygon = aPoints.map(p => `${p.x},${p.y}`).join(' ');
          const bPolygon = bPoints.map(p => `${p.x},${p.y}`).join(' ');

          const hasData = aSum.tirs > 0 || aSum.points > 0 || bSum.tirs > 0 || bSum.points > 0;
          if (!hasData) return null;

          return (
            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <MaterialIcons name="radar" size={16} color={theme.primary} />
                <Text style={s.cardTitle}>{fr ? 'Comparaison des equipes' : 'Team comparison'}</Text>
              </View>

              <View style={s.radarCenter}>
                <Svg width={radarSize} height={radarSize}>
                  {[0.25, 0.5, 0.75, 1].map((level, i) => (
                    <Circle key={i} cx={cx} cy={cy} r={maxR * level} fill="none" stroke={theme.border} strokeWidth="0.8" strokeDasharray={i < 3 ? '3,3' : undefined} />
                  ))}
                  {labels.map((label, i) => {
                    const angle = i * angleStep - Math.PI / 2;
                    const endX = cx + maxR * Math.cos(angle);
                    const endY = cy + maxR * Math.sin(angle);
                    const labelX = cx + (maxR + 20) * Math.cos(angle);
                    const labelY = cy + (maxR + 20) * Math.sin(angle);
                    return (
                      <G key={i}>
                        <Line x1={cx} y1={cy} x2={endX} y2={endY} stroke={theme.border} strokeWidth="0.8" />
                        <SvgText x={labelX} y={labelY + 4} fontSize="9" fill={theme.textSecondary} textAnchor="middle" fontWeight="600">{label}</SvgText>
                      </G>
                    );
                  })}
                  <Polygon points={bPolygon} fill={theme.error + '18'} stroke={theme.error} strokeWidth="2" />
                  <Polygon points={aPolygon} fill={theme.success + '18'} stroke={theme.success} strokeWidth="2" />
                  {aPoints.map((p, i) => <Circle key={`a${i}`} cx={p.x} cy={p.y} r={4} fill={theme.success} />)}
                  {bPoints.map((p, i) => <Circle key={`b${i}`} cx={p.x} cy={p.y} r={4} fill={theme.error} />)}
                </Svg>
              </View>

              <View style={s.radarLegend}>
                <View style={s.radarLegendItem}>
                  <View style={[s.radarLegendDot, { backgroundColor: theme.success }]} />
                  <Text style={s.radarLegendText}>{fr ? 'Mon equipe' : 'My team'}</Text>
                </View>
                <View style={s.radarLegendItem}>
                  <View style={[s.radarLegendDot, { backgroundColor: theme.error }]} />
                  <Text style={s.radarLegendText}>{fr ? 'Adversaire' : 'Opponent'}</Text>
                </View>
              </View>

              <View style={s.radarTable}>
                <View style={s.radarTableHeader}>
                  <Text style={[s.radarTableCell, { flex: 2 }]} />
                  <Text style={[s.radarTableHeaderCell, { color: theme.success }]}>{fr ? 'Nous' : 'Us'}</Text>
                  <Text style={[s.radarTableHeaderCell, { color: theme.error }]}>{fr ? 'Eux' : 'Them'}</Text>
                </View>
                {labels.map((label, i) => {
                  const aWins = aValues[i] >= bValues[i];
                  return (
                    <View key={i} style={s.radarTableRow}>
                      <Text style={[s.radarTableLabel, { flex: 2 }]}>{label}</Text>
                      <Text style={[s.radarTableValue, aWins && { color: theme.success, fontWeight: '800' }]}>{aRaw[i]}</Text>
                      <Text style={[s.radarTableValue, !aWins && { color: theme.error, fontWeight: '800' }]}>{bRaw[i]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })() : null}

        {/* Player Actions */}
        {/* Ad Banner - natural break after menes/before actions */}
        <AdBanner position="inline" />
        {match.playerActions && match.playerActions.length > 0 ? (
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <MaterialIcons name="sports" size={16} color={theme.tirColor} />
              <Text style={s.cardTitle}>{t('match', 'playerActions')}</Text>
            </View>
            {match.playerActions.map(pa => {
              const tirRate = pa.actions.tirs > 0 ? Math.round((pa.actions.tirsSuccess / pa.actions.tirs) * 100) : 0;
              const pointRate = pa.actions.points > 0 ? Math.round((pa.actions.pointsSuccess / pa.actions.points) * 100) : 0;
              const detailedCount = pa.detailedShots?.length || 0;
              return (
                <View key={pa.playerId} style={s.actionRow}>
                  <View style={s.actionPlayerInfo}>
                    <View style={[s.actionDot, { backgroundColor: pa.team === 'A' ? theme.primary : theme.accent }]} />
                    <Text style={s.actionPlayerName} numberOfLines={1}>{pa.playerName}</Text>
                    {detailedCount > 0 ? (
                      <View style={s.detailedBadge}>
                        <MaterialIcons name="playlist-add-check" size={10} color={theme.success} />
                        <Text style={s.detailedBadgeText}>{detailedCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={s.actionStatsRow}>
                    {pa.actions.tirs > 0 ? (
                      <View style={s.actionStat}>
                        <MaterialIcons name="gps-fixed" size={12} color={theme.tirColor} />
                        <Text style={s.actionStatText}>{pa.actions.tirsSuccess}/{pa.actions.tirs}</Text>
                        <View style={[s.actionPctBadge, { backgroundColor: tirRate >= 60 ? theme.success + '15' : theme.error + '15' }]}>
                          <Text style={[s.actionPctText, { color: tirRate >= 60 ? theme.success : theme.error }]}>{tirRate}%</Text>
                        </View>
                      </View>
                    ) : null}
                    {pa.actions.points > 0 ? (
                      <View style={s.actionStat}>
                        <MaterialIcons name="adjust" size={12} color={theme.pointColor} />
                        <Text style={s.actionStatText}>{pa.actions.pointsSuccess}/{pa.actions.points}</Text>
                        <View style={[s.actionPctBadge, { backgroundColor: pointRate >= 60 ? theme.success + '15' : theme.error + '15' }]}>
                          <Text style={[s.actionPctText, { color: pointRate >= 60 ? theme.success : theme.error }]}>{pointRate}%</Text>
                        </View>
                      </View>
                    ) : null}
                    {pa.actions.carreaux > 0 ? (
                      <View style={s.actionStat}>
                        <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
                        <Text style={[s.actionStatText, { color: theme.carreauColor, fontWeight: '700' }]}>{pa.actions.carreaux} {pa.actions.carreaux > 1 ? 'carreaux' : 'carreau'}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Notes */}
        {match.notes ? (
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <MaterialIcons name="notes" size={16} color={theme.textSecondary} />
              <Text style={s.cardTitle}>Notes</Text>
            </View>
            <Text style={s.notesText}>{match.notes}</Text>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={s.actionsColumn}>
          <Pressable
            style={({ pressed }) => [s.editCta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={() => { Haptics.selectionAsync(); router.push(`/match/${match.id}` as any); }}
          >
            <MaterialIcons name="edit" size={20} color="#FFF" />
            <Text style={s.editCtaText}>{fr ? 'Modifier le match' : 'Edit match'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [s.shareCta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={() => { Haptics.selectionAsync(); setShowShareModal(true); }}
          >
            <MaterialIcons name="share" size={20} color="#FFF" />
            <Text style={s.shareCtaText}>{fr ? 'Partager ce match' : 'Share this match'}</Text>
          </Pressable>


        </View>
      </ScrollView>

      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        itemType="match"
        itemId={match.id}
        itemName={`${match.teamA.playerNames.join(', ')} vs ${match.teamB.playerNames.join(', ')}`}
        forceReadOnly
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  shareBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: theme.textMuted, marginTop: 12 },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // Hero
  heroCard: { backgroundColor: theme.surface, borderRadius: 20, marginBottom: 14, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 4 }, default: {} }) },
  heroAccent: { height: 5, width: '100%' },
  heroContent: { padding: 18 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 14 },
  heroIconCircle: { width: 60, height: 60, borderRadius: 18, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.3 },
  heroTagsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  heroTagText: { fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  metaPillText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },

  // Sponsor
  sponsorRow: { marginTop: 4, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: '#F59E0B' },
  sponsorGradient: { borderRadius: 12, position: 'relative' },
  sponsorAccentLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, backgroundColor: '#F59E0B', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  sponsorContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  sponsorLogo: { width: 64, height: 64, borderRadius: 18, overflow: 'hidden' },
  sponsorLogoFallback: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sponsorLabel: { fontSize: 9, fontWeight: '600', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 },
  sponsorName: { fontSize: 14, fontWeight: '700', color: '#78350F', marginTop: 1 },
  sponsorTierIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Card
  card: { backgroundColor: theme.surface, borderRadius: 18, padding: 18, marginBottom: 14, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 2 }, default: {} }) },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },

  // Score
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  teamCol: { flex: 1 },
  teamLabel: { fontSize: 9, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  teamNames: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, lineHeight: 18 },
  scoreCenter: { alignItems: 'center', paddingHorizontal: 12 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 8 },
  scoreNum: { fontSize: 32, fontWeight: '800', color: theme.textSecondary, minWidth: 36, textAlign: 'center' },
  scoreSep: { fontSize: 18, color: theme.textMuted, marginHorizontal: 6 },
  resultBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  resultText: { fontSize: 12, fontWeight: '700' },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: 10, fontWeight: '600' },

  // ELO deltas
  eloRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  eloDeltaItem: { alignItems: 'center', gap: 3, minWidth: 54 },
  eloDeltaName: { fontSize: 10, fontWeight: '600', color: theme.textSecondary, maxWidth: 60 },
  eloDeltaBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  eloDeltaElo: { fontSize: 10, fontWeight: '800' },
  eloDeltaChange: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8 },
  eloDeltaChangeText: { fontSize: 10, fontWeight: '800' },

  // Validation
  validationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  validationIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  validationLabel: { fontSize: 14, fontWeight: '700' },
  validationSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  validationCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  validationCircleText: { fontSize: 13, fontWeight: '900' },

  // Series
  seriesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  seriesTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.accent },
  seriesScoreBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  seriesScoreText: { fontSize: 14, fontWeight: '800' },
  seriesList: { gap: 6 },
  seriesMatch: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: theme.backgroundSecondary, borderRadius: 10 },
  seriesMatchCurrent: { borderWidth: 1.5, borderColor: theme.primary + '40', backgroundColor: theme.primary + '06' },
  seriesDot: { width: 8, height: 8, borderRadius: 4 },
  seriesMatchLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  seriesMatchScore: { fontSize: 15, fontWeight: '700' },

  // Mene chart
  meneChart: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  meneColumn: { alignItems: 'center', minWidth: 28, gap: 4 },
  meneColNum: { fontSize: 9, fontWeight: '700', color: theme.textMuted },
  meneBarGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 44 },
  meneBar: { width: 8, borderRadius: 4, minHeight: 4 },
  meneColScore: { fontSize: 9, fontWeight: '600', color: theme.textSecondary },

  // Mene list
  meneList: {},
  meneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border + '60' },
  meneNum: { width: 32, fontSize: 12, fontWeight: '600', color: theme.textMuted },
  meneScores: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meneScore: { fontSize: 16, fontWeight: '600', color: theme.textSecondary, width: 24, textAlign: 'center' },
  meneSep: { fontSize: 12, color: theme.textMuted },
  meneCumul: { marginLeft: 'auto', backgroundColor: theme.backgroundSecondary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  meneCumulText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },
  meneTotalRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, marginTop: 4 },
  meneTotalLabel: { width: 32, fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  meneTotalVal: { fontSize: 18, fontWeight: '800', width: 24, textAlign: 'center' },

  // Player actions
  actionRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border + '60' },
  actionPlayerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  actionDot: { width: 8, height: 8, borderRadius: 4 },
  actionPlayerName: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  detailedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.success + '15', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  detailedBadgeText: { fontSize: 10, fontWeight: '600', color: theme.success },
  actionStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingLeft: 16 },
  actionStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionStatText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  actionPctBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  actionPctText: { fontSize: 10, fontWeight: '700' },

  // Notes
  notesText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },

  // Witness
  witnessRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.backgroundSecondary, borderRadius: 10, padding: 10, marginBottom: 6 },
  witnessId: { flex: 1, fontSize: 13, color: theme.textPrimary, fontWeight: '500' },
  witnessStatus: { fontSize: 11, fontWeight: '700' },

  // Radar chart
  radarCenter: { alignItems: 'center', marginVertical: 8 },
  radarLegend: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 10, marginBottom: 14 },
  radarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radarLegendDot: { width: 10, height: 10, borderRadius: 5 },
  radarLegendText: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  radarTable: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 },
  radarTableHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  radarTableHeaderCell: { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  radarTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
  radarTableCell: { flex: 1 },
  radarTableLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  radarTableValue: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textSecondary, textAlign: 'center' },

  // Actions
  actionsColumn: { gap: 10, marginBottom: 8 },
  editCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 18, borderRadius: 18, ...Platform.select({ ios: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 }, android: { elevation: 4 }, default: {} }) },
  editCtaText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  shareCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.success, paddingVertical: 16, borderRadius: 18, ...Platform.select({ ios: { shadowColor: theme.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 }, android: { elevation: 3 }, default: {} }) },
  shareCtaText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

});
