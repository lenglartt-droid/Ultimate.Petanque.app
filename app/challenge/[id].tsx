import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/template';
import { useAlert } from '@/template';
import ShareModal from '@/components/ui/ShareModal';
import SharedBadge from '@/components/ui/SharedBadge';
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';
import { Challenge, ChallengeType, PRECISION_ATELIERS, PrecisionAtelier } from '@/services/mockData';

const CHALLENGE_LABELS: Record<string, Record<ChallengeType, string>> = {
  fr: { '10_tirs': '10 Tirs', '10_tirs_sautee': '10 Tirs Sautee', precision: 'Precision' },
  en: { '10_tirs': '10 Shots', '10_tirs_sautee': '10 Lob Shots', precision: 'Precision' },
};

const CHALLENGE_ICONS: Record<ChallengeType, { icon: string; color: string }> = {
  '10_tirs': { icon: 'track-changes', color: '#2563EB' },
  '10_tirs_sautee': { icon: 'flight-takeoff', color: '#D97706' },
  precision: { icon: 'stars', color: '#7C3AED' },
};

export default function ChallengeDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { challenges, getSharedPermission, refreshData, loading: appLoading } = useApp();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { t, language } = useLanguage();
  const fr = language === 'fr';

  const [refreshing, setRefreshing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [goldSponsor, setGoldSponsor] = useState<Ambassador | null>(null);
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    fetchAmbassadors().then(({ ambassadors }) => {
      const gold = ambassadors.find(a => a.badgeType === 'gold_sponsor');
      if (gold) setGoldSponsor(gold);
    });
  }, []);

  const challenge: Challenge | undefined = useMemo(() => {
    return challenges.find(c => c.id === id);
  }, [challenges, id]);

  const sharedPermission = getSharedPermission(id!);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  if (!challenge) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>{fr ? 'Detail du defi' : 'Challenge detail'}</Text>
          <View style={{ width: 40 }} />
        </View>
        {appLoading ? (
          <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
        ) : (
          <View style={s.center}>
            <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
            <Text style={s.emptyText}>{fr ? 'Defi introuvable' : 'Challenge not found'}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const cfg = CHALLENGE_ICONS[challenge.type] || CHALLENGE_ICONS['10_tirs'];
  const typeLabel = CHALLENGE_LABELS[fr ? 'fr' : 'en'][challenge.type];
  const is1v1 = challenge.mode === '1v1';
  const isPrecision = challenge.type === 'precision';
  const dateStr = new Date(challenge.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = new Date(challenge.date).toLocaleTimeString(fr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const durationMin = challenge.duration ? Math.floor(challenge.duration / 60) : 0;
  const durationSec = challenge.duration ? challenge.duration % 60 : 0;

  // Winner display
  const winnerLabel = is1v1
    ? challenge.winner === 'player'
      ? (fr ? 'Victoire' : 'Victory')
      : challenge.winner === 'opponent'
        ? (fr ? 'Defaite' : 'Defeat')
        : (fr ? 'Egalite' : 'Draw')
    : null;
  const winnerColor = challenge.winner === 'player' ? theme.success : challenge.winner === 'opponent' ? theme.error : '#F59E0B';

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{fr ? 'Detail du defi' : 'Challenge detail'}</Text>
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
        <Animated.View entering={FadeInDown.duration(400)} style={s.heroCard}>
          <View style={[s.heroAccent, { backgroundColor: cfg.color }]} />
          <View style={s.heroContent}>
            <View style={s.heroTopRow}>
              <View style={[s.heroIconCircle, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '35' }]}>
                <MaterialIcons name={cfg.icon as any} size={32} color={cfg.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heroTitle}>{typeLabel}</Text>
                <View style={s.heroTagsRow}>
                  <View style={[s.heroTag, { backgroundColor: is1v1 ? '#EF444415' : '#10B98115' }]}>
                    <MaterialIcons name={is1v1 ? 'people' : 'person'} size={12} color={is1v1 ? '#EF4444' : '#10B981'} />
                    <Text style={[s.heroTagText, { color: is1v1 ? '#EF4444' : '#10B981' }]}>{is1v1 ? '1 vs 1' : 'Solo'}</Text>
                  </View>
                  {sharedPermission ? <SharedBadge permission={sharedPermission} size="small" /> : null}
                </View>
              </View>
            </View>

            {/* Date & Duration */}
            <View style={s.metaRow}>
              <View style={s.metaPill}>
                <MaterialIcons name="event" size={13} color={theme.primary} />
                <Text style={s.metaPillText}>{dateStr}</Text>
              </View>
              <View style={s.metaPill}>
                <MaterialIcons name="schedule" size={13} color={theme.accent} />
                <Text style={s.metaPillText}>{timeStr}</Text>
              </View>
              {challenge.duration ? (
                <View style={s.metaPill}>
                  <MaterialIcons name="timer" size={13} color={theme.warning} />
                  <Text style={s.metaPillText}>{durationMin}:{durationSec.toString().padStart(2, '0')}</Text>
                </View>
              ) : null}
            </View>

            {/* 1v1 Winner Banner */}
            {is1v1 && winnerLabel ? (
              <View style={[s.winnerBanner, { backgroundColor: winnerColor + '12', borderColor: winnerColor + '30' }]}>
                <MaterialIcons
                  name={challenge.winner === 'player' ? 'emoji-events' : challenge.winner === 'draw' ? 'handshake' : 'close'}
                  size={24}
                  color={winnerColor}
                />
                <Text style={[s.winnerText, { color: winnerColor }]}>{winnerLabel}</Text>
              </View>
            ) : null}

            {/* Sponsor badge (challenge-level) */}
            {challenge.sponsorName ? (
              <View style={s.challengeSponsorRow}>
                {challenge.sponsorPhoto ? (
                  <Image source={{ uri: challenge.sponsorPhoto }} style={s.challengeSponsorPhoto} contentFit="cover" transition={200} />
                ) : (
                  <View style={[s.challengeSponsorPhoto, { backgroundColor: '#7C3AED20', alignItems: 'center', justifyContent: 'center' }]}>
                    <MaterialIcons name="campaign" size={14} color="#7C3AED" />
                  </View>
                )}
                <Text style={s.challengeSponsorText}>{fr ? 'Defi par' : 'Challenge by'} <Text style={{ fontWeight: '700' }}>{challenge.sponsorName}</Text></Text>
              </View>
            ) : null}

            {/* Gold Sponsor Badge */}
            {goldSponsor ? (
              <Pressable
                style={({ pressed }) => [s.sponsorBadgeRow, pressed && { opacity: 0.9 }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  trackAmbassadorEvent(goldSponsor.id, 'profile_view', undefined, { sourcePage: 'challenge_detail' });
                  router.push('/partners' as any);
                }}
              >
                <LinearGradient colors={['#FFFBEB', '#FEF3C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.sponsorBadgeGradient}>
                  <View style={s.sponsorBadgeAccentLine} />
                  <View style={s.sponsorBadgeContent}>
                    {goldSponsor.photo ? (
                      <Image source={{ uri: goldSponsor.photo }} style={s.sponsorBadgeLogo} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                    ) : (
                      <LinearGradient colors={['#B45309', '#F59E0B']} style={s.sponsorBadgeLogoFallback}>
                        <MaterialIcons name="workspace-premium" size={12} color="#FFF" />
                      </LinearGradient>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.sponsorBadgeLabel}>{fr ? 'Sponsorise par' : 'Sponsored by'}</Text>
                      <Text style={s.sponsorBadgeName} numberOfLines={1}>{goldSponsor.displayName}</Text>
                    </View>
                    <LinearGradient colors={['#B45309', '#D97706']} style={s.sponsorBadgeTier}>
                      <MaterialIcons name="star" size={8} color="#FFF" />
                    </LinearGradient>
                  </View>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>

        {/* Player Info */}
        <Animated.View entering={FadeInDown.duration(300).delay(60)} style={s.card}>
          <Text style={s.cardLabel}>{fr ? 'JOUEUR' : 'PLAYER'}</Text>
          <View style={s.playerRow}>
            <View style={[s.playerDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={s.playerName}>{challenge.playerName || (fr ? 'Moi' : 'Me')}</Text>
          </View>
          {is1v1 && challenge.opponentName ? (
            <>
              <Text style={s.vsText}>VS</Text>
              <View style={s.playerRow}>
                <View style={[s.playerDot, { backgroundColor: '#EF4444' }]} />
                <Text style={s.playerName}>{challenge.opponentName}</Text>
              </View>
            </>
          ) : null}
        </Animated.View>

        {/* Main Stats */}
        <Animated.View entering={FadeInDown.duration(300).delay(120)}>
          {isPrecision ? (
            /* Precision Stats */
            <View style={s.card}>
              <Text style={s.cardLabel}>{fr ? 'RESULTATS PRECISION' : 'PRECISION RESULTS'}</Text>
              <View style={s.scoreHero}>
                <Text style={[s.scoreHeroValue, { color: cfg.color }]}>{challenge.totalPoints || 0}</Text>
                <Text style={s.scoreHeroSep}>/</Text>
                <Text style={s.scoreHeroMax}>{challenge.maxPoints || 0}</Text>
                <Text style={s.scoreHeroUnit}>pts</Text>
              </View>

              {/* Atelier breakdown */}
              {challenge.atelierScores ? (
                <View style={s.atelierList}>
                  {Object.entries(challenge.atelierScores).map(([atelierId, score]) => {
                    const atelierCfg = PRECISION_ATELIERS.find(a => a.id === atelierId);
                    if (!atelierCfg) return null;
                    const maxForAtelier = atelierCfg.id === 'tir_but' ? 10 : 10;
                    return (
                      <View key={atelierId} style={s.atelierRow}>
                        <View style={[s.atelierIcon, { backgroundColor: cfg.color + '12' }]}>
                          <MaterialIcons name={atelierCfg.icon as any} size={18} color={cfg.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.atelierName}>{atelierCfg.name}</Text>
                          <View style={s.atelierBarTrack}>
                            <View style={[s.atelierBarFill, { width: `${Math.min(100, ((score as number) / maxForAtelier) * 100)}%`, backgroundColor: cfg.color }]} />
                          </View>
                        </View>
                        <Text style={[s.atelierScore, { color: cfg.color }]}>{score}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Precision shots detail */}
              {challenge.precisionShots && challenge.precisionShots.length > 0 ? (
                <View style={s.shotsGrid}>
                  <Text style={s.shotsGridTitle}>{fr ? 'Detail des tirs' : 'Shot details'}</Text>
                  {challenge.precisionShots.map((shot, i) => {
                    const aCfg = PRECISION_ATELIERS.find(a => a.id === shot.atelier);
                    const pointColor = shot.points >= 5 ? '#F59E0B' : shot.points >= 3 ? theme.success : shot.points >= 1 ? theme.primary : theme.textMuted;
                    return (
                      <View key={i} style={s.precisionShotRow}>
                        <Text style={s.precisionShotIdx}>{i + 1}</Text>
                        <MaterialIcons name={(aCfg?.icon || 'radio-button-checked') as any} size={14} color={theme.textSecondary} />
                        <Text style={s.precisionShotAtelier} numberOfLines={1}>{aCfg?.name || shot.atelier}</Text>
                        <Text style={s.precisionShotDist}>{shot.distance}m</Text>
                        <View style={[s.precisionShotPts, { backgroundColor: pointColor + '15' }]}>
                          <Text style={[s.precisionShotPtsText, { color: pointColor }]}>{shot.points}pts</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Opponent precision result */}
              {is1v1 && challenge.opponentResult ? (
                <View style={s.opponentCard}>
                  <View style={s.opponentHeader}>
                    <View style={[s.playerDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={s.opponentName}>{challenge.opponentResult.playerName}</Text>
                  </View>
                  <View style={s.opponentStatsRow}>
                    <View style={s.opponentStat}>
                      <Text style={s.opponentStatValue}>{challenge.opponentResult.totalPoints || 0}</Text>
                      <Text style={s.opponentStatLabel}>pts</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            /* 10 Tirs / 10 Tirs Sautee Stats */
            <View style={s.card}>
              <Text style={s.cardLabel}>{fr ? 'RESULTATS' : 'RESULTS'}</Text>
              <View style={s.statsGrid}>
                <View style={s.statCard}>
                  <Text style={[s.statValue, { color: theme.success }]}>{challenge.successCount || 0}</Text>
                  <Text style={s.statLabel}>{fr ? 'Reussis' : 'Success'}</Text>
                </View>
                <View style={s.statCard}>
                  <Text style={s.statValue}>{challenge.totalShots || 0}</Text>
                  <Text style={s.statLabel}>{fr ? 'Total' : 'Total'}</Text>
                </View>
                <View style={s.statCard}>
                  <Text style={[s.statValue, { color: cfg.color }]}>{challenge.successRate != null ? `${Math.round(challenge.successRate)}%` : '-'}</Text>
                  <Text style={s.statLabel}>{fr ? 'Reussite' : 'Rate'}</Text>
                </View>
                <View style={s.statCard}>
                  <Text style={[s.statValue, { color: '#F59E0B' }]}>{challenge.carreauCount || 0}</Text>
                  <Text style={s.statLabel}>Carreaux</Text>
                </View>
              </View>

              {/* Success rate bar */}
              {challenge.successRate != null ? (
                <View style={s.rateBarWrap}>
                  <View style={s.rateBarTrack}>
                    <View style={[s.rateBarFill, { width: `${Math.min(100, challenge.successRate)}%`, backgroundColor: cfg.color }]} />
                  </View>
                  <View style={s.rateBarLabels}>
                    <Text style={[s.rateBarLabel, { color: cfg.color }]}>{challenge.successCount || 0} {fr ? 'reussis' : 'hits'}</Text>
                    <Text style={[s.rateBarLabel, { color: theme.error }]}>{(challenge.totalShots || 0) - (challenge.successCount || 0)} {fr ? 'rates' : 'missed'}</Text>
                  </View>
                </View>
              ) : null}

              {/* Shot-by-shot grid */}
              {challenge.shots && challenge.shots.length > 0 ? (
                <View style={s.shotGrid}>
                  <Text style={s.shotsGridTitle}>{fr ? 'Tir par tir' : 'Shot by shot'}</Text>
                  <View style={s.shotDotsRow}>
                    {challenge.shots.map((shot, i) => (
                      <View key={i} style={[
                        s.shotDot,
                        shot.success
                          ? shot.carreau
                            ? { backgroundColor: '#F59E0B' }
                            : { backgroundColor: theme.success }
                          : { backgroundColor: theme.error },
                      ]}>
                        <Text style={s.shotDotText}>{i + 1}</Text>
                        {shot.carreau ? <MaterialIcons name="star" size={8} color="#FFF" style={s.shotDotStar} /> : null}
                      </View>
                    ))}
                  </View>
                  <View style={s.shotLegend}>
                    <View style={s.shotLegendItem}>
                      <View style={[s.shotLegendDot, { backgroundColor: theme.success }]} />
                      <Text style={s.shotLegendText}>{fr ? 'Reussi' : 'Hit'}</Text>
                    </View>
                    <View style={s.shotLegendItem}>
                      <View style={[s.shotLegendDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={s.shotLegendText}>Carreau</Text>
                    </View>
                    <View style={s.shotLegendItem}>
                      <View style={[s.shotLegendDot, { backgroundColor: theme.error }]} />
                      <Text style={s.shotLegendText}>{fr ? 'Rate' : 'Missed'}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Opponent result (1v1 tirs) */}
              {is1v1 && challenge.opponentResult ? (
                <View style={s.opponentCard}>
                  <View style={s.opponentHeader}>
                    <View style={[s.playerDot, { backgroundColor: '#EF4444' }]} />
                    <Text style={s.opponentName}>{challenge.opponentResult.playerName}</Text>
                  </View>
                  <View style={s.opponentStatsRow}>
                    <View style={s.opponentStat}>
                      <Text style={s.opponentStatValue}>{challenge.opponentResult.successCount || 0}/{challenge.opponentResult.totalShots || 0}</Text>
                      <Text style={s.opponentStatLabel}>{fr ? 'Reussis' : 'Hits'}</Text>
                    </View>
                    <View style={s.opponentStatDivider} />
                    <View style={s.opponentStat}>
                      <Text style={s.opponentStatValue}>{challenge.opponentResult.successRate != null ? `${Math.round(challenge.opponentResult.successRate)}%` : '-'}</Text>
                      <Text style={s.opponentStatLabel}>{fr ? 'Taux' : 'Rate'}</Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </Animated.View>

        {/* Notes */}
        {challenge.notes ? (
          <Animated.View entering={FadeInDown.duration(300).delay(180)} style={s.card}>
            <Text style={s.cardLabel}>{fr ? 'NOTES' : 'NOTES'}</Text>
            <View style={s.notesBox}>
              <MaterialIcons name="notes" size={16} color={theme.textMuted} />
              <Text style={s.notesText}>{challenge.notes}</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Share CTA */}
        <Animated.View entering={FadeInDown.duration(300).delay(240)}>
          <Pressable
            style={({ pressed }) => [s.shareCta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={() => { Haptics.selectionAsync(); setShowShareModal(true); }}
          >
            <MaterialIcons name="share" size={20} color="#FFF" />
            <Text style={s.shareCtaText}>{fr ? 'Partager ce defi' : 'Share this challenge'}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        itemType="challenge"
        itemId={challenge.id}
        itemName={`${typeLabel} - ${challenge.playerName || ''}`}
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
  heroTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary, letterSpacing: -0.3 },
  heroTagsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  heroTagText: { fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  metaPillText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },

  // Winner banner
  winnerBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 14 },
  winnerText: { fontSize: 18, fontWeight: '800' },

  // Challenge-level sponsor
  challengeSponsorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#7C3AED08', borderRadius: 12, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#7C3AED15' },
  challengeSponsorPhoto: { width: 28, height: 28, borderRadius: 8, overflow: 'hidden' },
  challengeSponsorText: { flex: 1, fontSize: 12, color: theme.textSecondary },

  // Gold Sponsor Badge
  sponsorBadgeRow: { marginBottom: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1.5, borderColor: '#F59E0B' },
  sponsorBadgeGradient: { borderRadius: 12, position: 'relative' },
  sponsorBadgeAccentLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, backgroundColor: '#F59E0B', borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  sponsorBadgeContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  sponsorBadgeLogo: { width: 32, height: 32, borderRadius: 10, overflow: 'hidden' },
  sponsorBadgeLogoFallback: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sponsorBadgeLabel: { fontSize: 9, fontWeight: '600', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 },
  sponsorBadgeName: { fontSize: 14, fontWeight: '700', color: '#78350F', marginTop: 1 },
  sponsorBadgeTier: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Card
  card: { backgroundColor: theme.surface, borderRadius: 18, padding: 18, marginBottom: 14, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }, android: { elevation: 2 }, default: {} }) },
  cardLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 1, marginBottom: 12 },

  // Player
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  playerDot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary },
  vsText: { fontSize: 13, fontWeight: '800', color: theme.textMuted, textAlign: 'center', marginVertical: 6 },

  // Stats grid (10 tirs)
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: theme.backgroundSecondary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', color: theme.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: theme.textMuted, marginTop: 2, textTransform: 'uppercase' },

  // Rate bar
  rateBarWrap: { marginBottom: 14 },
  rateBarTrack: { height: 8, backgroundColor: theme.error + '25', borderRadius: 4, overflow: 'hidden' },
  rateBarFill: { height: '100%', borderRadius: 4 },
  rateBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  rateBarLabel: { fontSize: 11, fontWeight: '600' },

  // Shot dots
  shotGrid: { marginBottom: 4 },
  shotsGridTitle: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 10 },
  shotDotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  shotDot: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  shotDotText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  shotDotStar: { position: 'absolute', top: -2, right: -2 },
  shotLegend: { flexDirection: 'row', gap: 16, paddingTop: 4 },
  shotLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  shotLegendDot: { width: 10, height: 10, borderRadius: 5 },
  shotLegendText: { fontSize: 11, color: theme.textMuted, fontWeight: '500' },

  // Precision
  scoreHero: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 18, gap: 2 },
  scoreHeroValue: { fontSize: 48, fontWeight: '900' },
  scoreHeroSep: { fontSize: 28, fontWeight: '300', color: theme.textMuted },
  scoreHeroMax: { fontSize: 28, fontWeight: '600', color: theme.textSecondary },
  scoreHeroUnit: { fontSize: 14, fontWeight: '600', color: theme.textMuted, marginLeft: 4 },

  atelierList: { gap: 12, marginBottom: 16 },
  atelierRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  atelierIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  atelierName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  atelierBarTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  atelierBarFill: { height: '100%', borderRadius: 3 },
  atelierScore: { fontSize: 18, fontWeight: '800', minWidth: 30, textAlign: 'right' },

  shotsGrid: { marginTop: 4 },
  precisionShotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  precisionShotIdx: { width: 22, fontSize: 12, fontWeight: '700', color: theme.textMuted, textAlign: 'center' },
  precisionShotAtelier: { flex: 1, fontSize: 12, fontWeight: '500', color: theme.textSecondary },
  precisionShotDist: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  precisionShotPts: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  precisionShotPtsText: { fontSize: 12, fontWeight: '800' },

  // Opponent
  opponentCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 14, marginTop: 14 },
  opponentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  opponentName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  opponentStatsRow: { flexDirection: 'row', alignItems: 'center' },
  opponentStat: { flex: 1, alignItems: 'center' },
  opponentStatValue: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  opponentStatLabel: { fontSize: 10, fontWeight: '600', color: theme.textMuted, marginTop: 2 },
  opponentStatDivider: { width: 1, height: 24, backgroundColor: theme.border },

  // Notes
  notesBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 14 },
  notesText: { flex: 1, fontSize: 14, color: theme.textSecondary, lineHeight: 20 },

  // Share CTA
  shareCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.success, paddingVertical: 18, borderRadius: 18, marginBottom: 8, ...Platform.select({ ios: { shadowColor: theme.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 }, android: { elevation: 4 }, default: {} }) },
  shareCtaText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
