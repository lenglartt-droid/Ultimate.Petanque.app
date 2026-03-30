import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/template';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useBadges } from '@/hooks/useBadges';
import {
  BADGES,
  getBadgeName,
  getBadgeDescription,
  XP_LEVELS,
  getLevelFromXp,
  getXpProgress,
  getNextLevel,
  XP_PER_MATCH,
  XP_PER_CARREAU,
  XP_PER_SHARE_ACCEPTED,
  XP_PER_BADGE,
  buildBadgeContext,
} from '@/services/badgeService';
import { isUserAmbassador } from '@/services/ambassadorService';
import { fetchTrustScore } from '@/services/trustScoreService';
import XPBar from '@/components/ui/XPBar';
import theme from '@/constants/theme';

// ============================================
// Progress calculation per badge
// ============================================
interface BadgeProgress {
  current: number;
  target: number;
  percent: number;
  label: string;
}

function getBadgeProgress(
  badgeId: string,
  ctx: {
    matchCount: number;
    tirRate: number;
    totalCarreaux: number;
    sharedAcceptedCount: number;
    invitedUsersCount: number;
    uniqueTerrainsPlayed: number;
    leaderboardRank: number | null;
    consecutiveDaysPlayed: number;
    isAmbassador: boolean;
    trustScore: number | null;
    witnessAttestationsGiven: number;
  },
  lang: 'fr' | 'en'
): BadgeProgress {
  switch (badgeId) {
    case 'premier_lancer':
      return {
        current: Math.min(ctx.matchCount, 1),
        target: 1,
        percent: ctx.matchCount >= 1 ? 100 : 0,
        label: lang === 'fr' ? `${Math.min(ctx.matchCount, 1)}/1 match` : `${Math.min(ctx.matchCount, 1)}/1 match`,
      };
    case 'statisticien':
      return {
        current: Math.min(ctx.matchCount, 5),
        target: 5,
        percent: Math.min(100, Math.round((ctx.matchCount / 5) * 100)),
        label: `${Math.min(ctx.matchCount, 5)}/5 ${lang === 'fr' ? 'matchs' : 'matches'}`,
      };
    case 'oeil_de_lynx': {
      const matchProgress = Math.min(100, Math.round((ctx.matchCount / 10) * 100));
      const tirProgress = Math.min(100, Math.round((ctx.tirRate / 70) * 100));
      const combined = Math.round((matchProgress + tirProgress) / 2);
      return {
        current: combined,
        target: 100,
        percent: ctx.matchCount >= 10 && ctx.tirRate >= 70 ? 100 : combined,
        label: lang === 'fr'
          ? `${Math.min(ctx.matchCount, 10)}/10 matchs, ${Math.round(ctx.tirRate)}%/70% tir`
          : `${Math.min(ctx.matchCount, 10)}/10 matches, ${Math.round(ctx.tirRate)}%/70% shot`,
      };
    }
    case 'roi_du_carreau':
      return {
        current: Math.min(ctx.totalCarreaux, 10),
        target: 10,
        percent: Math.min(100, Math.round((ctx.totalCarreaux / 10) * 100)),
        label: `${Math.min(ctx.totalCarreaux, 10)}/10 carreaux`,
      };
    case 'social_player':
      return {
        current: Math.min(ctx.sharedAcceptedCount, 1),
        target: 1,
        percent: ctx.sharedAcceptedCount >= 1 ? 100 : 0,
        label: lang === 'fr'
          ? `${Math.min(ctx.sharedAcceptedCount, 1)}/1 partage accepte`
          : `${Math.min(ctx.sharedAcceptedCount, 1)}/1 share accepted`,
      };
    case 'recruteur':
      return {
        current: Math.min(ctx.invitedUsersCount, 3),
        target: 3,
        percent: Math.min(100, Math.round((ctx.invitedUsersCount / 3) * 100)),
        label: lang === 'fr'
          ? `${Math.min(ctx.invitedUsersCount, 3)}/3 joueurs invites`
          : `${Math.min(ctx.invitedUsersCount, 3)}/3 invited players`,
      };
    case 'explorateur':
      return {
        current: Math.min(ctx.uniqueTerrainsPlayed, 5),
        target: 5,
        percent: Math.min(100, Math.round((ctx.uniqueTerrainsPlayed / 5) * 100)),
        label: `${Math.min(ctx.uniqueTerrainsPlayed, 5)}/5 ${lang === 'fr' ? 'terrains' : 'courts'}`,
      };
    case 'classe': {
      const ranked = ctx.leaderboardRank !== null && ctx.leaderboardRank <= 100;
      return {
        current: ranked ? 1 : 0,
        target: 1,
        percent: ranked ? 100 : 0,
        label: ranked
          ? (lang === 'fr' ? `Top ${ctx.leaderboardRank}` : `Top ${ctx.leaderboardRank}`)
          : (lang === 'fr' ? 'Non classe' : 'Not ranked'),
      };
    }
    case 'en_feu':
      return {
        current: Math.min(ctx.consecutiveDaysPlayed, 7),
        target: 7,
        percent: Math.min(100, Math.round((ctx.consecutiveDaysPlayed / 7) * 100)),
        label: `${Math.min(ctx.consecutiveDaysPlayed, 7)}/7 ${lang === 'fr' ? 'jours consecutifs' : 'consecutive days'}`,
      };
    case 'ambassadeur':
      return {
        current: ctx.isAmbassador ? 1 : 0,
        target: 1,
        percent: ctx.isAmbassador ? 100 : 0,
        label: ctx.isAmbassador
          ? (lang === 'fr' ? 'Ambassadeur actif' : 'Active ambassador')
          : (lang === 'fr' ? 'Devenir ambassadeur' : 'Become ambassador'),
      };
    case 'fiable': {
      const ts = ctx.trustScore ?? 0;
      return {
        current: Math.min(ts, 65),
        target: 65,
        percent: Math.min(100, Math.round((ts / 65) * 100)),
        label: `${ts}/65 ${lang === 'fr' ? 'score de confiance' : 'trust score'}`,
      };
    }
    case 'verifie': {
      const ts2 = ctx.trustScore ?? 0;
      return {
        current: Math.min(ts2, 80),
        target: 80,
        percent: Math.min(100, Math.round((ts2 / 80) * 100)),
        label: `${ts2}/80 ${lang === 'fr' ? 'score de confiance' : 'trust score'}`,
      };
    }
    case 'temoin_fiable': {
      const wa = ctx.witnessAttestationsGiven ?? 0;
      return {
        current: Math.min(wa, 10),
        target: 10,
        percent: Math.min(100, Math.round((wa / 10) * 100)),
        label: `${Math.min(wa, 10)}/10 ${lang === 'fr' ? 'attestations donnees' : 'attestations given'}`,
      };
    }
    default:
      return { current: 0, target: 1, percent: 0, label: '' };
  }
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function BadgesScreen() {
  const { user } = useAuth();
  const { matches, challenges, userStats, sharedMatchIds } = useApp();
  const { language } = useLanguage();
  const { badges: userBadges, xp, loading, totalBadges } = useBadges();

  // Build badge context for progress calculation
  const badgeContext = useMemo(() => {
    if (!user?.id) return null;
    // Count total carreaux
    let totalCarreaux = 0;
    matches.forEach((m: any) => {
      if (m.playerActions) {
        m.playerActions.forEach((pa: any) => {
          totalCarreaux += pa.actions?.carreaux || 0;
        });
      }
    });

    // Count unique terrains
    const terrainSet = new Set<string>();
    matches.forEach((m: any) => { if (m.terrainId) terrainSet.add(m.terrainId); });

    // Consecutive days
    const matchDates = matches
      .map((m: any) => {
        const d = new Date(m.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
      .sort()
      .reverse();

    let consecutiveDays = 0;
    if (matchDates.length > 0) {
      consecutiveDays = 1;
      for (let i = 0; i < matchDates.length - 1; i++) {
        const current = new Date(matchDates[i]);
        const prev = new Date(matchDates[i + 1]);
        const diff = (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        if (Math.round(diff) === 1) consecutiveDays++;
        else break;
      }
    }

    return {
      matchCount: matches.length,
      tirRate: userStats.tirSuccessRate || 0,
      totalCarreaux,
      sharedAcceptedCount: sharedMatchIds.length,
      invitedUsersCount: 0,
      uniqueTerrainsPlayed: terrainSet.size,
      leaderboardRank: null as number | null,
      consecutiveDaysPlayed: consecutiveDays,
      isAmbassador: false,
      trustScore: null as number | null,
      witnessAttestationsGiven: 0,
    };
  }, [matches, userStats, sharedMatchIds, user?.id]);

  // Load trust score and witness attestation count for badge progress
  const [trustScoreValue, setTrustScoreValue] = React.useState<number | null>(null);
  const [witnessCount, setWitnessCount] = React.useState(0);
  React.useEffect(() => {
    if (!user?.id) return;
    const loadExtras = async () => {
      try {
        const supabase = (await import('@/template')).getSupabaseClient();
        const { data: playerData } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_public', true)
          .limit(1)
          .single();
        if (playerData?.id) {
          const ts = await fetchTrustScore(playerData.id);
          if (ts) setTrustScoreValue(ts.score);
        }
      } catch { /* silent */ }
      try {
        const supabase = (await import('@/template')).getSupabaseClient();
        const { data: attestations } = await supabase
          .from('match_witness_requests')
          .select('id')
          .eq('witness_user_id', user.id)
          .eq('status', 'attested');
        setWitnessCount(attestations?.length || 0);
      } catch { /* silent */ }
    };
    loadExtras();
  }, [user?.id]);

  // XP breakdown
  const xpBreakdown = useMemo(() => {
    if (!badgeContext) return [];
    const items = [
      {
        icon: 'sports' as const,
        color: '#3B82F6',
        label: language === 'fr' ? 'Matchs' : 'Matches',
        value: badgeContext.matchCount * XP_PER_MATCH,
        detail: `${badgeContext.matchCount} x ${XP_PER_MATCH} XP`,
      },
      {
        icon: 'star' as const,
        color: '#F59E0B',
        label: 'Carreaux',
        value: badgeContext.totalCarreaux * XP_PER_CARREAU,
        detail: `${badgeContext.totalCarreaux} x ${XP_PER_CARREAU} XP`,
      },
      {
        icon: 'share' as const,
        color: '#EC4899',
        label: language === 'fr' ? 'Partages' : 'Shares',
        value: badgeContext.sharedAcceptedCount * XP_PER_SHARE_ACCEPTED,
        detail: `${badgeContext.sharedAcceptedCount} x ${XP_PER_SHARE_ACCEPTED} XP`,
      },
      {
        icon: 'military-tech' as const,
        color: '#10B981',
        label: 'Badges',
        value: userBadges.length * XP_PER_BADGE,
        detail: `${userBadges.length} x ${XP_PER_BADGE} XP`,
      },
    ];
    return items;
  }, [badgeContext, userBadges, language]);

  const level = getLevelFromXp(xp);
  const progress = getXpProgress(xp);
  const nextLevel = getNextLevel(xp);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.headerBack} onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>
          {language === 'fr' ? 'Badges & Progression' : 'Badges & Progress'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* XP Bar */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <XPBar xp={xp} language={language} />
        </Animated.View>

        {/* Level Milestones */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={s.milestonesCard}>
          <Text style={s.sectionLabel}>
            {language === 'fr' ? 'PROGRESSION DES NIVEAUX' : 'LEVEL MILESTONES'}
          </Text>
          <View style={s.milestoneTrack}>
            {XP_LEVELS.map((lvl, i) => {
              const reached = xp >= lvl.minXp;
              const isCurrent = level.name === lvl.name;
              const lvlColor = (() => {
                switch (lvl.name) {
                  case 'Débutant': return '#10B981';
                  case 'Intermédiaire': return '#3B82F6';
                  case 'Confirmé': return '#F59E0B';
                  case 'Expert': return '#EF4444';
                  default: return theme.primary;
                }
              })();
              return (
                <View key={lvl.name} style={s.milestoneItem}>
                  {i > 0 && (
                    <View style={[s.milestoneConnector, reached && { backgroundColor: lvlColor + '60' }]} />
                  )}
                  <View style={[
                    s.milestoneCircle,
                    reached && { backgroundColor: lvlColor + '20', borderColor: lvlColor },
                    isCurrent && { backgroundColor: lvlColor, borderColor: lvlColor },
                  ]}>
                    <MaterialIcons
                      name={lvl.icon as any}
                      size={18}
                      color={isCurrent ? '#FFF' : reached ? lvlColor : theme.textMuted}
                    />
                  </View>
                  <Text style={[
                    s.milestoneName,
                    isCurrent && { color: lvlColor, fontWeight: '700' },
                    reached && !isCurrent && { color: theme.textPrimary },
                  ]}>
                    {language === 'fr' ? lvl.name : lvl.nameEn}
                  </Text>
                  <Text style={[s.milestoneXp, reached && { color: lvlColor }]}>
                    {lvl.minXp} XP
                  </Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* XP Breakdown */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={s.breakdownCard}>
          <Text style={s.sectionLabel}>
            {language === 'fr' ? 'DETAIL DES XP' : 'XP BREAKDOWN'}
          </Text>
          <View style={s.breakdownList}>
            {xpBreakdown.map((item, i) => (
              <View key={i} style={s.breakdownRow}>
                <View style={[s.breakdownIcon, { backgroundColor: item.color + '15' }]}>
                  <MaterialIcons name={item.icon as any} size={18} color={item.color} />
                </View>
                <View style={s.breakdownInfo}>
                  <Text style={s.breakdownLabel}>{item.label}</Text>
                  <Text style={s.breakdownDetail}>{item.detail}</Text>
                </View>
                <Text style={[s.breakdownValue, { color: item.color }]}>
                  +{item.value}
                </Text>
              </View>
            ))}
            <View style={s.breakdownTotalRow}>
              <MaterialIcons name="bolt" size={18} color="#F59E0B" />
              <Text style={s.breakdownTotalLabel}>Total</Text>
              <Text style={s.breakdownTotalValue}>{xp} XP</Text>
            </View>
          </View>
        </Animated.View>

        {/* Badges List */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <View style={s.badgesHeader}>
            <Text style={s.sectionLabel}>
              {language === 'fr' ? 'TOUS LES BADGES' : 'ALL BADGES'}
            </Text>
            <View style={s.badgesCounter}>
              <MaterialIcons name="military-tech" size={14} color={theme.primary} />
              <Text style={s.badgesCounterText}>{userBadges.length}/{totalBadges}</Text>
            </View>
          </View>

          {BADGES.map((badge, index) => {
            const unlocked = userBadges.find(b => b.badgeId === badge.id);
            const ctxWithTrust = badgeContext ? { ...badgeContext, trustScore: trustScoreValue, witnessAttestationsGiven: witnessCount } : null;
            const prog = ctxWithTrust
              ? getBadgeProgress(badge.id, ctxWithTrust, language)
              : { current: 0, target: 1, percent: 0, label: '' };
            const isComplete = !!unlocked;

            return (
              <Animated.View
                key={badge.id}
                entering={FadeInDown.duration(300).delay(350 + index * 50)}
                style={[s.badgeCard, isComplete && { borderLeftWidth: 3, borderLeftColor: badge.color }]}
              >
                <View style={s.badgeCardTop}>
                  <View style={[
                    s.badgeCardIcon,
                    { backgroundColor: isComplete ? badge.color + '20' : theme.backgroundSecondary },
                  ]}>
                    <MaterialIcons
                      name={badge.icon as any}
                      size={28}
                      color={isComplete ? badge.color : theme.textMuted + '60'}
                    />
                    {isComplete ? (
                      <View style={[s.badgeCheckmark, { backgroundColor: badge.color }]}>
                        <MaterialIcons name="check" size={10} color="#FFF" />
                      </View>
                    ) : null}
                  </View>

                  <View style={s.badgeCardInfo}>
                    <View style={s.badgeCardNameRow}>
                      <Text style={[s.badgeCardName, !isComplete && { color: theme.textSecondary }]}>
                        {getBadgeName(badge.id, language)}
                      </Text>
                      <View style={[s.badgeXpChip, isComplete && { backgroundColor: badge.color + '15' }]}>
                        <MaterialIcons name="bolt" size={12} color={isComplete ? badge.color : theme.textMuted} />
                        <Text style={[s.badgeXpText, isComplete && { color: badge.color }]}>
                          +{badge.xpReward} XP
                        </Text>
                      </View>
                    </View>
                    <Text style={s.badgeCardDesc}>
                      {getBadgeDescription(badge.id, language)}
                    </Text>

                    {/* Unlock date or progress */}
                    {isComplete ? (
                      <View style={s.badgeUnlockDate}>
                        <MaterialIcons name="check-circle" size={14} color={badge.color} />
                        <Text style={[s.badgeUnlockDateText, { color: badge.color }]}>
                          {language === 'fr' ? 'Debloque le' : 'Unlocked on'}{' '}
                          {new Date(unlocked.unlockedAt).toLocaleDateString(
                            language === 'fr' ? 'fr-FR' : 'en-US',
                            { day: 'numeric', month: 'short', year: 'numeric' }
                          )}
                        </Text>
                      </View>
                    ) : (
                      <View style={s.badgeProgressSection}>
                        <View style={s.badgeProgressBarOuter}>
                          <View
                            style={[
                              s.badgeProgressBarInner,
                              { width: `${Math.max(2, prog.percent)}%`, backgroundColor: prog.percent > 0 ? badge.color : badge.color + '40' },
                            ]}
                          />
                        </View>
                        <View style={s.badgeProgressRow}>
                          <Text style={s.badgeProgressLabel}>{prog.label}</Text>
                          <Text style={[s.badgeProgressPercent, { color: prog.percent >= 75 ? badge.color : theme.textMuted }]}>
                            {prog.percent}%
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Tips */}
        <Animated.View entering={FadeInDown.duration(400).delay(600)} style={s.tipsCard}>
          <MaterialIcons name="lightbulb" size={20} color="#F59E0B" />
          <View style={s.tipsContent}>
            <Text style={s.tipsTitle}>
              {language === 'fr' ? 'Comment gagner des XP ?' : 'How to earn XP?'}
            </Text>
            <Text style={s.tipsText}>
              {language === 'fr'
                ? `Joue des matchs (+${XP_PER_MATCH} XP), reussis des carreaux (+${XP_PER_CARREAU} XP), partage tes matchs (+${XP_PER_SHARE_ACCEPTED} XP) et debloque des badges (+${XP_PER_BADGE} XP).`
                : `Play matches (+${XP_PER_MATCH} XP), score carreaux (+${XP_PER_CARREAU} XP), share matches (+${XP_PER_SHARE_ACCEPTED} XP) and unlock badges (+${XP_PER_BADGE} XP).`}
            </Text>
          </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 14,
  },

  // Milestones
  milestonesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginTop: 16,
    ...theme.shadows.card,
  },
  milestoneTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  milestoneItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  milestoneConnector: {
    position: 'absolute',
    top: 20,
    left: -20,
    right: 20,
    height: 2,
    backgroundColor: theme.border,
    zIndex: -1,
  },
  milestoneCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  milestoneName: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textAlign: 'center',
  },
  milestoneXp: {
    fontSize: 10,
    fontWeight: '500',
    color: theme.textMuted,
    marginTop: 2,
  },

  // XP Breakdown
  breakdownCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginTop: 16,
    ...theme.shadows.card,
  },
  breakdownList: {
    gap: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  breakdownDetail: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 1,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  breakdownTotalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  breakdownTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D97706',
  },

  // Badges
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 2,
  },
  badgesCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  badgesCounterText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.primary,
  },

  badgeCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 10,
    ...theme.shadows.card,
  },
  badgeCardTop: {
    flexDirection: 'row',
    gap: 14,
  },
  badgeCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeCheckmark: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.surface,
  },
  badgeCardInfo: {
    flex: 1,
  },
  badgeCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgeCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    flex: 1,
  },
  badgeXpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  badgeXpText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  badgeCardDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  badgeUnlockDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeUnlockDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeProgressSection: {
    gap: 6,
  },
  badgeProgressBarOuter: {
    height: 6,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  badgeProgressBarInner: {
    height: '100%',
    borderRadius: 3,
    minWidth: 4,
  },
  badgeProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeProgressLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.textMuted,
    flex: 1,
  },
  badgeProgressPercent: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Tips
  tipsCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F59E0B' + '10',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F59E0B' + '25',
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
  },
});
