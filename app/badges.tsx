import React, { useMemo, useState, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
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
  BadgeDefinition,
} from '@/services/badgeService';
import { fetchTrustScore } from '@/services/trustScoreService';
import { getEloRank, ELO_INITIAL } from '@/services/eloService';
import XPBar from '@/components/ui/XPBar';
import theme from '@/constants/theme';

// ============================================
// Badge categories
// ============================================
type BadgeCategory = 'all' | 'performance' | 'community' | 'geographic' | 'elo' | 'trust';

const BADGE_CATEGORIES: { id: BadgeCategory; labelFr: string; labelEn: string; icon: string; color: string; badgeIds: string[] }[] = [
  {
    id: 'all',
    labelFr: 'Tous',
    labelEn: 'All',
    icon: 'grid-view',
    color: theme.primary,
    badgeIds: [],
  },
  {
    id: 'performance',
    labelFr: 'Performance',
    labelEn: 'Performance',
    icon: 'sports',
    color: '#3B82F6',
    badgeIds: ['premier_lancer', 'statisticien', 'oeil_de_lynx', 'roi_du_carreau', 'en_feu', 'explorateur', 'classe'],
  },
  {
    id: 'community',
    labelFr: 'Communaute',
    labelEn: 'Community',
    icon: 'people',
    color: '#EC4899',
    badgeIds: ['social_player', 'recruteur', 'ambassadeur', 'temoin_fiable', 'profil_complet'],
  },
  {
    id: 'geographic',
    labelFr: 'Geographique',
    labelEn: 'Geographic',
    icon: 'public',
    color: '#F59E0B',
    badgeIds: ['boss_de_la_ville', 'champion_du_quartier', 'heros_national', 'seigneur_des_terrains', 'maitre_universel'],
  },
  {
    id: 'elo',
    labelFr: 'ELO & Rang',
    labelEn: 'ELO & Rank',
    icon: 'diamond',
    color: '#8B5CF6',
    badgeIds: ['premier_diamant', 'maitre_petanque', 'specialiste'],
  },
  {
    id: 'trust',
    labelFr: 'Confiance',
    labelEn: 'Trust',
    icon: 'shield',
    color: '#10B981',
    badgeIds: ['fiable', 'verifie'],
  },
];

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
    profileCompleteness: number;
  },
  lang: 'fr' | 'en'
): BadgeProgress {
  switch (badgeId) {
    case 'premier_lancer':
      return { current: Math.min(ctx.matchCount, 1), target: 1, percent: ctx.matchCount >= 1 ? 100 : 0, label: `${Math.min(ctx.matchCount, 1)}/1 match` };
    case 'statisticien':
      return { current: Math.min(ctx.matchCount, 5), target: 5, percent: Math.min(100, Math.round((ctx.matchCount / 5) * 100)), label: `${Math.min(ctx.matchCount, 5)}/5 ${lang === 'fr' ? 'matchs' : 'matches'}` };
    case 'oeil_de_lynx': {
      const mp = Math.min(100, Math.round((ctx.matchCount / 10) * 100));
      const tp = Math.min(100, Math.round((ctx.tirRate / 70) * 100));
      const c = Math.round((mp + tp) / 2);
      return { current: c, target: 100, percent: ctx.matchCount >= 10 && ctx.tirRate >= 70 ? 100 : c, label: `${Math.min(ctx.matchCount, 10)}/10, ${Math.round(ctx.tirRate)}%/70%` };
    }
    case 'roi_du_carreau':
      return { current: Math.min(ctx.totalCarreaux, 10), target: 10, percent: Math.min(100, Math.round((ctx.totalCarreaux / 10) * 100)), label: `${Math.min(ctx.totalCarreaux, 10)}/10 carreaux` };
    case 'social_player':
      return { current: Math.min(ctx.sharedAcceptedCount, 1), target: 1, percent: ctx.sharedAcceptedCount >= 1 ? 100 : 0, label: `${Math.min(ctx.sharedAcceptedCount, 1)}/1 ${lang === 'fr' ? 'partage' : 'share'}` };
    case 'recruteur':
      return { current: Math.min(ctx.invitedUsersCount, 3), target: 3, percent: Math.min(100, Math.round((ctx.invitedUsersCount / 3) * 100)), label: `${Math.min(ctx.invitedUsersCount, 3)}/3` };
    case 'explorateur':
      return { current: Math.min(ctx.uniqueTerrainsPlayed, 5), target: 5, percent: Math.min(100, Math.round((ctx.uniqueTerrainsPlayed / 5) * 100)), label: `${Math.min(ctx.uniqueTerrainsPlayed, 5)}/5 ${lang === 'fr' ? 'terrains' : 'courts'}` };
    case 'classe':
      return { current: ctx.leaderboardRank !== null && ctx.leaderboardRank <= 100 ? 1 : 0, target: 1, percent: ctx.leaderboardRank !== null && ctx.leaderboardRank <= 100 ? 100 : 0, label: ctx.leaderboardRank !== null && ctx.leaderboardRank <= 100 ? `Top ${ctx.leaderboardRank}` : (lang === 'fr' ? 'Non classe' : 'Not ranked') };
    case 'en_feu':
      return { current: Math.min(ctx.consecutiveDaysPlayed, 7), target: 7, percent: Math.min(100, Math.round((ctx.consecutiveDaysPlayed / 7) * 100)), label: `${Math.min(ctx.consecutiveDaysPlayed, 7)}/7 ${lang === 'fr' ? 'jours' : 'days'}` };
    case 'ambassadeur':
      return { current: ctx.isAmbassador ? 1 : 0, target: 1, percent: ctx.isAmbassador ? 100 : 0, label: ctx.isAmbassador ? (lang === 'fr' ? 'Actif' : 'Active') : (lang === 'fr' ? 'Devenir ambassadeur' : 'Become ambassador') };
    case 'fiable':
      return { current: Math.min(ctx.trustScore ?? 0, 65), target: 65, percent: Math.min(100, Math.round(((ctx.trustScore ?? 0) / 65) * 100)), label: `${ctx.trustScore ?? 0}/65 trust` };
    case 'verifie':
      return { current: Math.min(ctx.trustScore ?? 0, 80), target: 80, percent: Math.min(100, Math.round(((ctx.trustScore ?? 0) / 80) * 100)), label: `${ctx.trustScore ?? 0}/80 trust` };
    case 'temoin_fiable':
      return { current: Math.min(ctx.witnessAttestationsGiven, 10), target: 10, percent: Math.min(100, Math.round((ctx.witnessAttestationsGiven / 10) * 100)), label: `${Math.min(ctx.witnessAttestationsGiven, 10)}/10` };
    case 'profil_complet':
      return { current: ctx.profileCompleteness, target: 100, percent: ctx.profileCompleteness, label: `${ctx.profileCompleteness}%` };
    case 'premier_diamant':
      return { current: Math.min((ctx as any).eloRating || 1000, 1500), target: 1500, percent: Math.min(100, Math.round((((ctx as any).eloRating || 1000) / 1500) * 100)), label: `${(ctx as any).eloRating || 1000}/1500 ELO` };
    case 'maitre_petanque':
      return { current: Math.min((ctx as any).eloRating || 1000, 1800), target: 1800, percent: Math.min(100, Math.round((((ctx as any).eloRating || 1000) / 1800) * 100)), label: `${(ctx as any).eloRating || 1000}/1800 ELO` };
    case 'specialiste': {
      const best = Math.max((ctx as any).eloTireur || 1000, (ctx as any).eloPointeur || 1000, (ctx as any).eloMilieu || 1000);
      return { current: Math.min(best, 1300), target: 1300, percent: Math.min(100, Math.round((best / 1300) * 100)), label: `${best}/1300 ELO` };
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
  const { matches, challenges, userStats, sharedMatchIds, selfPlayer, boulesSets } = useApp();
  const { language } = useLanguage();
  const { badges: userBadges, xp, loading, totalBadges } = useBadges();
  const isFr = language === 'fr';

  const [activeCategory, setActiveCategory] = useState<BadgeCategory>('all');

  const eloData = useMemo(() => {
    if (!selfPlayer) return { eloRating: ELO_INITIAL, eloTireur: ELO_INITIAL, eloPointeur: ELO_INITIAL, eloMilieu: ELO_INITIAL };
    return { eloRating: selfPlayer.eloRating || ELO_INITIAL, eloTireur: selfPlayer.eloTireur || ELO_INITIAL, eloPointeur: selfPlayer.eloPointeur || ELO_INITIAL, eloMilieu: selfPlayer.eloMilieu || ELO_INITIAL };
  }, [selfPlayer]);

  const badgeContext = useMemo(() => {
    if (!user?.id) return null;
    let totalCarreaux = 0;
    matches.forEach((m: any) => { if (m.playerActions) m.playerActions.forEach((pa: any) => { totalCarreaux += pa.actions?.carreaux || 0; }); });
    const terrainSet = new Set<string>();
    matches.forEach((m: any) => { if (m.terrainId) terrainSet.add(m.terrainId); });
    const matchDates = matches.map((m: any) => { const d = new Date(m.date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).sort().reverse();
    let consecutiveDays = 0;
    if (matchDates.length > 0) { consecutiveDays = 1; for (let i = 0; i < matchDates.length - 1; i++) { const diff = (new Date(matchDates[i]).getTime() - new Date(matchDates[i + 1]).getTime()) / (1000 * 60 * 60 * 24); if (Math.round(diff) === 1) consecutiveDays++; else break; } }
    return { matchCount: matches.length, tirRate: userStats.tirSuccessRate || 0, totalCarreaux, sharedAcceptedCount: sharedMatchIds.length, invitedUsersCount: 0, uniqueTerrainsPlayed: terrainSet.size, leaderboardRank: null as number | null, consecutiveDaysPlayed: consecutiveDays, isAmbassador: false, trustScore: null as number | null, witnessAttestationsGiven: 0, profileCompleteness: 0 };
  }, [matches, userStats, sharedMatchIds, user?.id]);

  const [trustScoreValue, setTrustScoreValue] = useState<number | null>(null);
  const [witnessCount, setWitnessCount] = useState(0);
  const [profileCompleteness, setProfileCompleteness] = useState(0);

  React.useEffect(() => {
    if (!user?.id) return;
    const loadExtras = async () => {
      try {
        const supabase = (await import('@/template')).getSupabaseClient();
        const { data: playerData } = await supabase.from('players').select('id').eq('user_id', user.id).eq('is_public', true).limit(1).single();
        if (playerData?.id) { const ts = await fetchTrustScore(playerData.id); if (ts) setTrustScoreValue(ts.score); }
      } catch {}
      try {
        const supabase = (await import('@/template')).getSupabaseClient();
        const { data: attestations } = await supabase.from('match_witness_requests').select('id').eq('witness_user_id', user.id).eq('status', 'attested');
        setWitnessCount(attestations?.length || 0);
      } catch {}
      try {
        const supabase = (await import('@/template')).getSupabaseClient();
        const { data: profData } = await supabase.from('user_profiles').select('avatar, club, federation_card_url').eq('id', user.id).single();
        let filled = 0; const total = 6;
        if (profData?.avatar) filled++; if (profData?.club || selfPlayer?.club) filled++; if (selfPlayer?.terrainId) filled++;
        if (selfPlayer?.location && (selfPlayer.location.latitude || selfPlayer.location.longitude)) filled++;
        if (boulesSets.length > 0 || (selfPlayer?.boules && (selfPlayer.boules.name || selfPlayer.boules.diameter || selfPlayer.boules.weight))) filled++;
        if (profData?.federation_card_url) filled++;
        setProfileCompleteness(Math.round((filled / total) * 100));
      } catch {}
    };
    loadExtras();
  }, [user?.id, selfPlayer?.id, boulesSets.length]);

  // Filter badges by category
  const filteredBadges = useMemo(() => {
    if (activeCategory === 'all') return BADGES;
    const cat = BADGE_CATEGORIES.find(c => c.id === activeCategory);
    if (!cat) return BADGES;
    return BADGES.filter(b => cat.badgeIds.includes(b.id));
  }, [activeCategory]);

  // Recently unlocked (last 30 days)
  const recentlyUnlocked = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return userBadges.filter(ub => new Date(ub.unlockedAt).getTime() > cutoff).sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime());
  }, [userBadges]);

  // Category progress
  const categoryProgress = useMemo(() => {
    return BADGE_CATEGORIES.filter(c => c.id !== 'all').map(cat => {
      const total = cat.badgeIds.length;
      const unlocked = cat.badgeIds.filter(bid => userBadges.find(ub => ub.badgeId === bid)).length;
      return { ...cat, total, unlocked, percent: total > 0 ? Math.round((unlocked / total) * 100) : 0 };
    });
  }, [userBadges]);

  const level = getLevelFromXp(xp);
  const progress = getXpProgress(xp);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingBox}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.headerBack} onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{isFr ? 'Badges & Progression' : 'Badges & Progress'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* XP Bar */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <XPBar xp={xp} language={language} />
        </Animated.View>

        {/* Overall Progress Hero */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)}>
          <LinearGradient colors={['#1E3A8A', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.progressHero}>
            <View style={s.progressHeroDecoCircle} />
            <View style={s.progressHeroTop}>
              <View style={s.progressHeroLeft}>
                <Text style={s.progressHeroCount}>{userBadges.length}</Text>
                <Text style={s.progressHeroMax}>/{totalBadges}</Text>
              </View>
              <View style={s.progressHeroRight}>
                <Text style={s.progressHeroLabel}>{isFr ? 'Badges debloques' : 'Badges unlocked'}</Text>
                <View style={s.progressHeroBarTrack}>
                  <View style={[s.progressHeroBarFill, { width: `${Math.max(4, Math.round((userBadges.length / totalBadges) * 100))}%` }]} />
                </View>
                <Text style={s.progressHeroPercent}>{Math.round((userBadges.length / totalBadges) * 100)}%</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Category Progress Cards */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catProgressScroll}>
            {categoryProgress.map(cat => (
              <Pressable
                key={cat.id}
                style={[s.catProgressCard, activeCategory === cat.id && { borderColor: cat.color, borderWidth: 2 }]}
                onPress={() => setActiveCategory(activeCategory === cat.id ? 'all' : cat.id as BadgeCategory)}
              >
                <View style={[s.catProgressIcon, { backgroundColor: cat.color + '15' }]}>
                  <MaterialIcons name={cat.icon as any} size={18} color={cat.color} />
                </View>
                <Text style={s.catProgressLabel} numberOfLines={1}>{isFr ? cat.labelFr : cat.labelEn}</Text>
                <Text style={[s.catProgressCount, { color: cat.color }]}>{cat.unlocked}/{cat.total}</Text>
                <View style={s.catProgressBarTrack}>
                  <View style={[s.catProgressBarFill, { width: `${Math.max(4, cat.percent)}%`, backgroundColor: cat.color }]} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Recently Unlocked */}
        {recentlyUnlocked.length > 0 && activeCategory === 'all' ? (
          <Animated.View entering={FadeInDown.duration(300).delay(150)} style={s.recentSection}>
            <View style={s.recentHeader}>
              <MaterialIcons name="new-releases" size={16} color="#F59E0B" />
              <Text style={s.recentTitle}>{isFr ? 'Recemment debloques' : 'Recently unlocked'}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
              {recentlyUnlocked.slice(0, 5).map(ub => {
                const badge = BADGES.find(b => b.id === ub.badgeId);
                if (!badge) return null;
                return (
                  <View key={badge.id} style={[s.recentBadge, { borderColor: badge.color + '30' }]}>
                    <View style={[s.recentBadgeIcon, { backgroundColor: badge.color + '20' }]}>
                      <MaterialIcons name={badge.icon as any} size={22} color={badge.color} />
                    </View>
                    <Text style={[s.recentBadgeName, { color: badge.color }]} numberOfLines={1}>{getBadgeName(badge.id, language)}</Text>
                    <Text style={s.recentBadgeDate}>
                      {new Date(ub.unlockedAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : null}

        {/* Category Filter Chips */}
        <View style={s.filterRow}>
          {BADGE_CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                style={[s.filterChip, isActive && { backgroundColor: cat.color, borderColor: cat.color }]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <MaterialIcons name={cat.icon as any} size={13} color={isActive ? '#FFF' : cat.color} />
                <Text style={[s.filterChipText, isActive && { color: '#FFF' }]}>{isFr ? cat.labelFr : cat.labelEn}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Badge List */}
        {filteredBadges.map((badge, index) => {
          const unlocked = userBadges.find(b => b.badgeId === badge.id);
          const ctxWithTrust = badgeContext ? { ...badgeContext, trustScore: trustScoreValue, witnessAttestationsGiven: witnessCount, profileCompleteness, ...eloData } : null;
          const prog = ctxWithTrust ? getBadgeProgress(badge.id, ctxWithTrust, language) : { current: 0, target: 1, percent: 0, label: '' };
          const isComplete = !!unlocked;

          return (
            <Animated.View
              key={badge.id}
              entering={FadeInDown.duration(250).delay(200 + index * 30)}
              style={[s.badgeCard, isComplete && { borderLeftWidth: 3, borderLeftColor: badge.color }]}
            >
              <View style={s.badgeCardTop}>
                <View style={[s.badgeCardIcon, { backgroundColor: isComplete ? badge.color + '20' : theme.backgroundSecondary }]}>
                  <MaterialIcons name={badge.icon as any} size={28} color={isComplete ? badge.color : theme.textMuted + '60'} />
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
                      <Text style={[s.badgeXpText, isComplete && { color: badge.color }]}>+{badge.xpReward}</Text>
                    </View>
                  </View>
                  <Text style={s.badgeCardDesc} numberOfLines={2}>{getBadgeDescription(badge.id, language)}</Text>

                  {isComplete ? (
                    <View style={s.badgeUnlockDate}>
                      <MaterialIcons name="check-circle" size={14} color={badge.color} />
                      <Text style={[s.badgeUnlockDateText, { color: badge.color }]}>
                        {isFr ? 'Debloque le' : 'Unlocked'}{' '}
                        {new Date(unlocked.unlockedAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  ) : (
                    <View style={s.badgeProgressSection}>
                      <View style={s.badgeProgressBarOuter}>
                        <View style={[s.badgeProgressBarInner, { width: `${Math.max(2, prog.percent)}%`, backgroundColor: prog.percent > 0 ? badge.color : badge.color + '40' }]} />
                      </View>
                      <View style={s.badgeProgressRow}>
                        <Text style={s.badgeProgressLabel}>{prog.label}</Text>
                        <Text style={[s.badgeProgressPercent, { color: prog.percent >= 75 ? badge.color : theme.textMuted }]}>{prog.percent}%</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          );
        })}

        {/* XP Breakdown */}
        <Animated.View entering={FadeInDown.duration(300).delay(400)} style={s.xpCard}>
          <View style={s.xpCardHeader}>
            <MaterialIcons name="bolt" size={18} color="#F59E0B" />
            <Text style={s.xpCardTitle}>{isFr ? 'Sources d\'XP' : 'XP Sources'}</Text>
          </View>
          <View style={s.xpGrid}>
            {[
              { icon: 'sports', color: '#3B82F6', label: isFr ? 'Matchs' : 'Matches', value: `+${XP_PER_MATCH}` },
              { icon: 'star', color: '#F59E0B', label: 'Carreaux', value: `+${XP_PER_CARREAU}` },
              { icon: 'share', color: '#EC4899', label: isFr ? 'Partages' : 'Shares', value: `+${XP_PER_SHARE_ACCEPTED}` },
              { icon: 'military-tech', color: '#10B981', label: 'Badges', value: `+${XP_PER_BADGE}` },
            ].map((item, i) => (
              <View key={i} style={s.xpGridItem}>
                <View style={[s.xpGridIcon, { backgroundColor: item.color + '15' }]}>
                  <MaterialIcons name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text style={s.xpGridLabel}>{item.label}</Text>
                <Text style={[s.xpGridValue, { color: item.color }]}>{item.value}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Level Milestones */}
        <Animated.View entering={FadeInDown.duration(300).delay(450)} style={s.milestonesCard}>
          <Text style={s.sectionLabel}>{isFr ? 'NIVEAUX' : 'LEVELS'}</Text>
          <View style={s.milestoneTrack}>
            {XP_LEVELS.map((lvl, i) => {
              const reached = xp >= lvl.minXp;
              const isCurrent = level.name === lvl.name;
              const lvlColor = lvl.name === 'Débutant' ? '#10B981' : lvl.name === 'Intermédiaire' ? '#3B82F6' : lvl.name === 'Confirmé' ? '#F59E0B' : '#EF4444';
              return (
                <View key={lvl.name} style={s.milestoneItem}>
                  {i > 0 ? <View style={[s.milestoneConnector, reached && { backgroundColor: lvlColor + '60' }]} /> : null}
                  <View style={[s.milestoneCircle, reached && { backgroundColor: lvlColor + '20', borderColor: lvlColor }, isCurrent && { backgroundColor: lvlColor, borderColor: lvlColor }]}>
                    <MaterialIcons name={lvl.icon as any} size={18} color={isCurrent ? '#FFF' : reached ? lvlColor : theme.textMuted} />
                  </View>
                  <Text style={[s.milestoneName, isCurrent && { color: lvlColor, fontWeight: '700' }, reached && !isCurrent && { color: theme.textPrimary }]}>
                    {isFr ? lvl.name : lvl.nameEn}
                  </Text>
                  <Text style={[s.milestoneXp, reached && { color: lvlColor }]}>{lvl.minXp} XP</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1, marginBottom: 14 },

  // Progress Hero
  progressHero: { borderRadius: 20, padding: 20, marginTop: 16, marginBottom: 16, overflow: 'hidden', position: 'relative' },
  progressHeroDecoCircle: { position: 'absolute', top: -20, right: -15, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
  progressHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  progressHeroLeft: { flexDirection: 'row', alignItems: 'baseline' },
  progressHeroCount: { fontSize: 48, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  progressHeroMax: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  progressHeroRight: { flex: 1 },
  progressHeroLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  progressHeroBarTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressHeroBarFill: { height: '100%', backgroundColor: '#FCD34D', borderRadius: 4 },
  progressHeroPercent: { fontSize: 11, fontWeight: '700', color: '#FCD34D' },

  // Category Progress
  catProgressScroll: { gap: 10, paddingBottom: 4, paddingRight: 4 },
  catProgressCard: { width: 110, backgroundColor: theme.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: theme.border, ...theme.shadows.card },
  catProgressIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catProgressLabel: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, textAlign: 'center' },
  catProgressCount: { fontSize: 14, fontWeight: '800' },
  catProgressBarTrack: { width: '100%', height: 4, backgroundColor: theme.backgroundSecondary, borderRadius: 2, overflow: 'hidden' },
  catProgressBarFill: { height: '100%', borderRadius: 2 },

  // Recently Unlocked
  recentSection: { marginTop: 16, marginBottom: 8 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  recentTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  recentBadge: { width: 100, backgroundColor: theme.surface, borderRadius: 14, padding: 10, alignItems: 'center', gap: 6, borderWidth: 1, ...theme.shadows.card },
  recentBadgeIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recentBadgeName: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  recentBadgeDate: { fontSize: 9, color: theme.textMuted, fontWeight: '500' },

  // Filter chips
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16, marginBottom: 14 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },

  // Badge Cards
  badgeCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 10, ...theme.shadows.card },
  badgeCardTop: { flexDirection: 'row', gap: 14 },
  badgeCardIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badgeCheckmark: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.surface },
  badgeCardInfo: { flex: 1 },
  badgeCardNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  badgeCardName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  badgeXpChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.full },
  badgeXpText: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  badgeCardDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 18, marginBottom: 10 },
  badgeUnlockDate: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeUnlockDateText: { fontSize: 12, fontWeight: '600' },
  badgeProgressSection: { gap: 6 },
  badgeProgressBarOuter: { height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  badgeProgressBarInner: { height: '100%', borderRadius: 3, minWidth: 4 },
  badgeProgressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeProgressLabel: { fontSize: 11, fontWeight: '500', color: theme.textMuted, flex: 1 },
  badgeProgressPercent: { fontSize: 11, fontWeight: '700', marginLeft: 8 },

  // XP Card
  xpCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginTop: 8, marginBottom: 16, ...theme.shadows.card },
  xpCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  xpCardTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  xpGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  xpGridItem: { alignItems: 'center', gap: 4, flex: 1 },
  xpGridIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  xpGridLabel: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },
  xpGridValue: { fontSize: 14, fontWeight: '800' },

  // Milestones
  milestonesCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, ...theme.shadows.card },
  milestoneTrack: { flexDirection: 'row', justifyContent: 'space-between' },
  milestoneItem: { alignItems: 'center', flex: 1, position: 'relative' },
  milestoneConnector: { position: 'absolute', top: 20, left: -20, right: 20, height: 2, backgroundColor: theme.border, zIndex: -1 },
  milestoneCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.backgroundSecondary, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  milestoneName: { fontSize: 11, fontWeight: '600', color: theme.textMuted, textAlign: 'center' },
  milestoneXp: { fontSize: 10, fontWeight: '500', color: theme.textMuted, marginTop: 2 },
});
