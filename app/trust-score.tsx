import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/template';
import { useApp } from '@/contexts/AppContext';
import {
  fetchTrustScore,
  computeQuickTrustScore,
  getTrustScoreColor,
  getTrustScoreIcon,
  getTrustLevelLabel,
  getTrustBadgeDescription,
  triggerTrustScoreComputation,
  TrustScoreData,
  getLevelFromScore,
} from '@/services/trustScoreService';
import { extraTranslations } from '@/constants/i18nExtra';
import Svg, { Circle } from 'react-native-svg';

const et = extraTranslations.trustScore;

function GaugeRing({ value, size = 80, color, label }: { value: number; size?: number; color: string; label: string }) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.max(0, Math.min(100, value));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color + '15'} strokeWidth={strokeWidth} fill="none"
          />
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color} strokeWidth={strokeWidth + 1}
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" fill="none"
            rotation="-90" origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: size * 0.22, fontWeight: '800', color }}>{clamped}%</Text>
        </View>
      </View>
      <Text style={st.gaugeLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function FactorBar({ label, value, maxValue, color, icon, description }: {
  label: string; value: number; maxValue: number; color: string; icon: string; description?: string;
}) {
  const pct = maxValue > 0 ? Math.min(100, Math.round((value / maxValue) * 100)) : 0;
  return (
    <View style={st.factorRow}>
      <View style={[st.factorIcon, { backgroundColor: color + '12' }]}>
        <MaterialIcons name={icon as any} size={18} color={color} />
      </View>
      <View style={st.factorContent}>
        <View style={st.factorHeader}>
          <Text style={st.factorLabel}>{label}</Text>
          <Text style={[st.factorValue, { color }]}>{value}/{maxValue}</Text>
        </View>
        <View style={st.factorBarTrack}>
          <View style={[st.factorBarFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        {description ? <Text style={st.factorDesc}>{description}</Text> : null}
      </View>
    </View>
  );
}

const FLAG_LABELS: Record<string, { fr: string; en: string; icon: string; color: string }> = {
  very_low_multiplayer: { fr: 'Tres peu de matchs multi-joueurs', en: 'Very few multi-player matches', icon: 'people-outline', color: '#F97316' },
  low_multiplayer: { fr: 'Peu de matchs multi-joueurs', en: 'Few multi-player matches', icon: 'people-outline', color: '#D97706' },
  single_opponent: { fr: 'Un seul adversaire', en: 'Single opponent', icon: 'person', color: '#EF4444' },
  low_opponent_diversity: { fr: 'Faible diversite d\'adversaires', en: 'Low opponent diversity', icon: 'groups', color: '#F97316' },
  very_inconsistent_performance: { fr: 'Performances tres instables', en: 'Very inconsistent performance', icon: 'trending-down', color: '#EF4444' },
  inconsistent_performance: { fr: 'Performances instables', en: 'Inconsistent performance', icon: 'trending-down', color: '#F97316' },
  sudden_improvement: { fr: 'Progression soudaine', en: 'Sudden improvement', icon: 'bolt', color: '#D97706' },
  many_external_modifications: { fr: 'Nombreuses modifications externes', en: 'Many external modifications', icon: 'edit', color: '#EF4444' },
  some_external_modifications: { fr: 'Quelques modifications externes', en: 'Some external modifications', icon: 'edit', color: '#D97706' },
  excessive_daily_matches: { fr: 'Trop de matchs par jour', en: 'Excessive daily matches', icon: 'speed', color: '#EF4444' },
  high_daily_matches: { fr: 'Beaucoup de matchs par jour', en: 'Many daily matches', icon: 'speed', color: '#F97316' },
  extreme_win_rate: { fr: 'Taux de victoire extreme', en: 'Extreme win rate', icon: 'warning', color: '#EF4444' },
  unrealistic_combined_rates: { fr: 'Stats combinees irrealistes', en: 'Unrealistic combined rates', icon: 'warning', color: '#EF4444' },
  extreme_carreau_rate: { fr: 'Taux de carreau extreme', en: 'Extreme carreau rate', icon: 'stars', color: '#F97316' },
  very_new_account: { fr: 'Compte tres recent', en: 'Very new account', icon: 'new-releases', color: '#D97706' },
  new_account: { fr: 'Compte recent', en: 'New account', icon: 'new-releases', color: '#D97706' },
  low_match_count: { fr: 'Peu de matchs joues', en: 'Few matches played', icon: 'sports', color: '#D97706' },
  many_very_short_matches: { fr: 'Matchs tres courts suspects', en: 'Suspicious very short matches', icon: 'timer', color: '#F97316' },
  multi_account_device: { fr: 'Multi-compte detecte', en: 'Multi-account detected', icon: 'devices', color: '#F97316' },
  multi_account_device_3plus: { fr: 'Multi-comptes detectes (3+)', en: 'Multi-accounts detected (3+)', icon: 'devices', color: '#EF4444' },
  multiple_reports: { fr: 'Signalements multiples', en: 'Multiple reports', icon: 'flag', color: '#EF4444' },
  has_reports: { fr: 'Signalement recu', en: 'Report received', icon: 'flag', color: '#D97706' },
  arranged_matches: { fr: 'Matchs arranges detectes', en: 'Arranged matches detected', icon: 'gpp-bad', color: '#EF4444' },
};

export default function TrustScoreScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { selfPlayer, matches } = useApp();
  const isFr = language === 'fr';

  const [trustData, setTrustData] = useState<TrustScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const loadTrustScore = async () => {
    if (!selfPlayer) { setLoading(false); return; }
    setLoading(true);
    const dbScore = await fetchTrustScore(selfPlayer.id);
    if (dbScore) {
      setTrustData(dbScore);
    } else {
      setTrustData(computeQuickTrustScore({ stats: selfPlayer.stats, createdAt: selfPlayer.createdAt }));
    }
    setLoading(false);
  };

  useEffect(() => { loadTrustScore(); }, [selfPlayer?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrustScore();
    setRefreshing(false);
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    await triggerTrustScoreComputation();
    // Wait a bit for the edge function to complete
    setTimeout(async () => {
      await loadTrustScore();
      setRecomputing(false);
    }, 3000);
  };

  // Extract details for gauges
  const details = trustData?.details || {};
  const multiPlayerRatio = details.multiPlayerRatio || 0;
  const uniqueOpponents = details.uniqueOpponents || 0;
  const totalMatches = details.totalMatches || details.matchesPlayed || 0;
  const performanceConsistency = details.performanceConsistency || 0;
  const modExternal = details.modificationLogs?.external || 0;
  const matchesPerWeek = details.matchesPerWeek || 0;
  const accountAgeDays = details.accountAgeDays || 0;
  const totalReports = details.totalReports || 0;

  // Compute factor scores (approximate)
  const mpScore = Math.round(multiPlayerRatio * 0.3 * 100) / 100;
  const diversityScore = totalMatches > 0 ? Math.min(20, Math.round((uniqueOpponents / totalMatches) * 20)) : 0;
  const consistencyScore = Math.round((performanceConsistency / 100) * 20);
  const historyScore = Math.max(0, 15 - modExternal * 3);
  const frequencyScore = Math.min(10, Math.round(Math.min(matchesPerWeek, 5) / 5 * 10));

  if (loading) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.header}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={st.headerTitle}>{(et.pageTitle as any)?.[language] || 'Trust Score'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const scoreColor = trustData ? getTrustScoreColor(trustData.level) : theme.textMuted;
  const scoreIcon = trustData ? getTrustScoreIcon(trustData.level) : 'shield';

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>{(et.pageTitle as any)?.[language] || 'Trust Score'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={st.scrollView}
        contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
      >
        {!trustData ? (
          <Animated.View entering={FadeInDown.duration(400)} style={st.noScoreCard}>
            <MaterialIcons name="shield" size={48} color={theme.textMuted} />
            <Text style={st.noScoreText}>{(et.noScoreYet as any)?.[language] || 'No score computed yet.'}</Text>
            <Pressable style={st.recomputeBtn} onPress={handleRecompute} disabled={recomputing}>
              {recomputing ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="refresh" size={18} color="#FFF" />}
              <Text style={st.recomputeBtnText}>{isFr ? 'Calculer mon score' : 'Compute my score'}</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* Hero Score Card */}
            <Animated.View entering={FadeInDown.duration(400)} style={[st.heroCard, { borderColor: scoreColor + '25' }]}>
              <View style={st.heroTop}>
                <View style={[st.heroIconBg, { backgroundColor: scoreColor + '15' }]}>
                  <MaterialIcons name={scoreIcon as any} size={32} color={scoreColor} />
                </View>
                <View style={st.heroScoreCol}>
                  <Text style={[st.heroScore, { color: scoreColor }]}>{trustData.score}</Text>
                  <Text style={st.heroScoreMax}>/100</Text>
                </View>
                <View style={[st.heroLevelBadge, { backgroundColor: scoreColor + '15', borderColor: scoreColor + '30' }]}>
                  <Text style={[st.heroLevelText, { color: scoreColor }]}>{getTrustLevelLabel(trustData.level, isFr)}</Text>
                </View>
              </View>
              <Text style={st.heroDesc}>{getTrustBadgeDescription(trustData.level, isFr)}</Text>

              {/* Score bar */}
              <View style={st.heroBarTrack}>
                <View style={[st.heroBarFill, { width: `${trustData.score}%`, backgroundColor: scoreColor }]} />
                {/* Level markers */}
                <View style={[st.heroBarMarker, { left: '25%' }]} />
                <View style={[st.heroBarMarker, { left: '45%' }]} />
                <View style={[st.heroBarMarker, { left: '65%' }]} />
                <View style={[st.heroBarMarker, { left: '80%' }]} />
              </View>
              <View style={st.heroBarLabels}>
                <Text style={st.heroBarLabelText}>{isFr ? 'Suspect' : 'Suspicious'}</Text>
                <Text style={st.heroBarLabelText}>{isFr ? 'A surveiller' : 'Watch'}</Text>
                <Text style={st.heroBarLabelText}>Standard</Text>
                <Text style={st.heroBarLabelText}>{isFr ? 'Fiable' : 'Trusted'}</Text>
                <Text style={st.heroBarLabelText}>{isFr ? 'Verifie' : 'Verified'}</Text>
              </View>

              {trustData.analyzedAt ? (
                <Text style={st.analyzedAt}>
                  {(et.lastAnalyzed as any)?.[language] || 'Last analyzed'}: {new Date(trustData.analyzedAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              ) : null}

              <Pressable style={[st.recomputeBtn, { marginTop: 12 }]} onPress={handleRecompute} disabled={recomputing}>
                {recomputing ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="refresh" size={16} color="#FFF" />}
                <Text style={st.recomputeBtnText}>{isFr ? 'Recalculer' : 'Recompute'}</Text>
              </Pressable>
            </Animated.View>

            {/* Factor Gauges */}
            <Animated.View entering={FadeInDown.duration(400).delay(50)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: '#3B82F6' + '15' }]}>
                  <MaterialIcons name="pie-chart" size={18} color="#3B82F6" />
                </View>
                <Text style={st.sectionTitle}>{(et.breakdownTitle as any)?.[language] || 'Score Breakdown'}</Text>
              </View>

              <View style={st.gaugesGrid}>
                <GaugeRing value={multiPlayerRatio} size={72} color="#3B82F6" label={(et.factorMultiPlayer as any)?.[language] || 'Multi-player'} />
                <GaugeRing value={totalMatches > 0 ? Math.min(100, Math.round((uniqueOpponents / totalMatches) * 100)) : 0} size={72} color="#8B5CF6" label={(et.factorDiversity as any)?.[language] || 'Diversity'} />
                <GaugeRing value={performanceConsistency} size={72} color="#10B981" label={(et.factorConsistency as any)?.[language] || 'Consistency'} />
                <GaugeRing value={Math.max(0, 100 - modExternal * 10)} size={72} color="#F97316" label={(et.factorHistory as any)?.[language] || 'History'} />
              </View>
            </Animated.View>

            {/* Detailed Factors */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: '#D97706' + '15' }]}>
                  <MaterialIcons name="analytics" size={18} color="#D97706" />
                </View>
                <Text style={st.sectionTitle}>{(et.detailsTitle as any)?.[language] || 'Factor Details'}</Text>
              </View>

              <FactorBar
                label={(et.factorMultiPlayer as any)?.[language] || 'Multi-player matches'}
                value={Math.round(mpScore * 100)}
                maxValue={30}
                color="#3B82F6"
                icon="people"
                description={((et.multiPlayerDesc as any)?.[language] || 'Proportion of matches with other app users ({value}%).').replace('{value}', String(multiPlayerRatio))}
              />
              <FactorBar
                label={(et.factorDiversity as any)?.[language] || 'Opponent diversity'}
                value={diversityScore}
                maxValue={20}
                color="#8B5CF6"
                icon="groups"
                description={((et.diversityDesc as any)?.[language] || '{value} unique opponents across {total} matches.').replace('{value}', String(uniqueOpponents)).replace('{total}', String(totalMatches))}
              />
              <FactorBar
                label={(et.factorConsistency as any)?.[language] || 'Performance consistency'}
                value={consistencyScore}
                maxValue={20}
                color="#10B981"
                icon="show-chart"
                description={((et.consistencyDesc as any)?.[language] || 'Stability of your performance over 4 weeks ({value}%).').replace('{value}', String(performanceConsistency))}
              />
              <FactorBar
                label={(et.factorHistory as any)?.[language] || 'Modification history'}
                value={historyScore}
                maxValue={15}
                color="#F97316"
                icon="history"
                description={((et.historyDesc as any)?.[language] || '{value} external modifications on your records.').replace('{value}', String(modExternal))}
              />
              <FactorBar
                label={(et.factorPlayFrequency as any)?.[language] || 'Play frequency'}
                value={frequencyScore}
                maxValue={10}
                color="#06B6D4"
                icon="schedule"
                description={((et.frequencyDesc as any)?.[language] || '{value} matches per week on average.').replace('{value}', String(matchesPerWeek))}
              />
              <FactorBar
                label={(et.factorAccountAge as any)?.[language] || 'Account age'}
                value={Math.min(5, Math.round(accountAgeDays / 36))}
                maxValue={5}
                color="#14B8A6"
                icon="calendar-today"
                description={((et.ageDesc as any)?.[language] || 'Account created {value} days ago.').replace('{value}', String(accountAgeDays))}
              />
            </Animated.View>

            {/* Flags */}
            <Animated.View entering={FadeInDown.duration(400).delay(150)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: theme.error + '15' }]}>
                  <MaterialIcons name="flag" size={18} color={theme.error} />
                </View>
                <Text style={st.sectionTitle}>{(et.flagsTitle as any)?.[language] || 'Detected Flags'}</Text>
                {trustData.flags.length > 0 ? (
                  <View style={[st.flagCountBadge, { backgroundColor: theme.error + '15' }]}>
                    <Text style={[st.flagCountText, { color: theme.error }]}>{trustData.flags.length}</Text>
                  </View>
                ) : null}
              </View>

              {trustData.flags.length === 0 ? (
                <View style={st.noFlagsRow}>
                  <MaterialIcons name="check-circle" size={24} color={theme.success} />
                  <Text style={st.noFlagsText}>{(et.noFlags as any)?.[language] || 'No flags detected. Excellent!'}</Text>
                </View>
              ) : (
                trustData.flags.map((flag, idx) => {
                  const flagInfo = FLAG_LABELS[flag] || { fr: flag, en: flag, icon: 'warning', color: '#D97706' };
                  return (
                    <View key={idx} style={[st.flagRow, { borderLeftColor: flagInfo.color }]}>
                      <View style={[st.flagIcon, { backgroundColor: flagInfo.color + '12' }]}>
                        <MaterialIcons name={flagInfo.icon as any} size={16} color={flagInfo.color} />
                      </View>
                      <Text style={st.flagText}>{isFr ? flagInfo.fr : flagInfo.en}</Text>
                    </View>
                  );
                })
              )}
            </Animated.View>

            {/* Tips */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: theme.success + '15' }]}>
                  <MaterialIcons name="lightbulb" size={18} color={theme.success} />
                </View>
                <Text style={st.sectionTitle}>{(et.tipsTitle as any)?.[language] || 'Tips to Improve'}</Text>
              </View>

              {[
                { icon: 'people', color: '#3B82F6', text: (et.tip1 as any)?.[language] || 'Play with other app users' },
                { icon: 'groups', color: '#8B5CF6', text: (et.tip2 as any)?.[language] || 'Vary your opponents' },
                { icon: 'schedule', color: '#06B6D4', text: (et.tip3 as any)?.[language] || 'Play regularly' },
                { icon: 'edit-off', color: '#F97316', text: (et.tip4 as any)?.[language] || 'Avoid excessive modifications' },
              ].map((tip, idx) => (
                <View key={idx} style={st.tipRow}>
                  <View style={[st.tipIcon, { backgroundColor: tip.color + '12' }]}>
                    <MaterialIcons name={tip.icon as any} size={16} color={tip.color} />
                  </View>
                  <Text style={st.tipText}>{tip.text}</Text>
                </View>
              ))}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // No score
  noScoreCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 32, alignItems: 'center', gap: 16, ...theme.shadows.card },
  noScoreText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Hero
  heroCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, ...theme.shadows.card },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  heroIconBg: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroScoreCol: { flexDirection: 'row', alignItems: 'baseline' },
  heroScore: { fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  heroScoreMax: { fontSize: 18, fontWeight: '600', color: theme.textMuted },
  heroLevelBadge: { marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  heroLevelText: { fontSize: 13, fontWeight: '700' },
  heroDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 16 },
  heroBarTrack: { height: 10, backgroundColor: theme.backgroundSecondary, borderRadius: 5, overflow: 'hidden', position: 'relative' as const, marginBottom: 6 },
  heroBarFill: { height: '100%', borderRadius: 5 },
  heroBarMarker: { position: 'absolute' as const, top: 0, width: 2, height: '100%', backgroundColor: theme.surface },
  heroBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  heroBarLabelText: { fontSize: 8, color: theme.textMuted, fontWeight: '600' },
  analyzedAt: { fontSize: 11, color: theme.textMuted, marginTop: 12, textAlign: 'center' },

  recomputeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  recomputeBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Section
  sectionCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 16, marginBottom: 16, ...theme.shadows.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionIconBg: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, flex: 1 },

  // Gauges
  gaugesGrid: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 },
  gaugeLabel: { fontSize: 10, fontWeight: '600', color: theme.textSecondary, marginTop: 6, textAlign: 'center', maxWidth: 80 },

  // Factor rows
  factorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
  factorIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  factorContent: { flex: 1 },
  factorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  factorLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  factorValue: { fontSize: 14, fontWeight: '800' },
  factorBarTrack: { height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  factorBarFill: { height: '100%', borderRadius: 3 },
  factorDesc: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },

  // Flags
  flagCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  flagCountText: { fontSize: 12, fontWeight: '700' },
  noFlagsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  noFlagsText: { fontSize: 14, color: theme.success, fontWeight: '600' },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderLeftWidth: 3, paddingLeft: 10, marginBottom: 6, backgroundColor: theme.backgroundSecondary + '50', borderRadius: 8 },
  flagIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  flagText: { flex: 1, fontSize: 13, fontWeight: '500', color: theme.textPrimary },

  // Tips
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border + '30' },
  tipIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontSize: 13, color: theme.textPrimary, fontWeight: '500', lineHeight: 18 },
});
