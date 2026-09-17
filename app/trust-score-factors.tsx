/**
 * User Trust Score Factors Page
 *
 * User-facing page listing the 26 anti-cheat factors organized by category
 * with a personalized status (OK / warning / problem) computed from the
 * user's own suspicious_players flags and match/challenge patterns, plus
 * concrete corrective advice for each factor.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import theme from '@/constants/theme';
import * as Haptics from '@/services/haptics';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, getSupabaseClient } from '@/template';
import PageErrorBoundary from '@/components/ui/PageErrorBoundary';

type FactorCategory = 'geographic' | 'temporal' | 'behavioral' | 'statistical' | 'identity' | 'social';
type FactorStatus = 'ok' | 'warning' | 'problem' | 'unknown';

interface FactorDef {
  id: string;
  category: FactorCategory;
  number: number;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  adviceFr: string;
  adviceEn: string;
  flagKeys: string[];
}

const FACTORS: FactorDef[] = [
  // Geographic (1-5)
  { id: 'impossible_travel', category: 'geographic', number: 1, titleFr: 'Voyage impossible', titleEn: 'Impossible travel', descFr: 'Matchs enregistres a plus de 500 km d\'ecart en moins de 6 heures.', descEn: 'Matches recorded more than 500 km apart within 6 hours.', adviceFr: 'Ne pas enregistrer un match si vous n\'y avez pas physiquement participe. Utiliser le bon terrain pour chaque match.', adviceEn: 'Do not record matches you did not physically attend. Use the correct terrain for each match.', flagKeys: ['impossible_travel'] },
  { id: 'teleportation', category: 'geographic', number: 2, titleFr: 'Micro-teleportation', titleEn: 'Micro-teleportation', descFr: 'Matchs a plus de 200 km d\'ecart en moins de 2 heures.', descEn: 'Matches more than 200 km apart within 2 hours.', adviceFr: 'Verifier les fuseaux horaires des terrains et laisser un delai raisonnable entre matchs distants.', adviceEn: 'Verify terrain time zones and leave a reasonable gap between distant matches.', flagKeys: ['teleportation'] },
  { id: 'home_city_mismatch', category: 'geographic', number: 3, titleFr: 'Ville de residence incoherente', titleEn: 'Home city mismatch', descFr: 'Majorite de vos matchs a plus de 300 km de votre ville declaree.', descEn: 'Majority of your matches over 300 km from your declared city.', adviceFr: 'Mettre a jour votre ville dans votre profil pour refleter votre localisation reelle.', adviceEn: 'Update your city in your profile to reflect your actual location.', flagKeys: ['home_city_mismatch'] },
  { id: 'terrain_diversity_low', category: 'geographic', number: 4, titleFr: 'Diversite de terrains', titleEn: 'Terrain diversity', descFr: 'Tous vos matchs sont enregistres sur un unique terrain (peut etre normal).', descEn: 'All your matches are on a single terrain (may be legitimate).', adviceFr: 'Varier les terrains si vous jouez ailleurs, cela renforce la credibilite.', adviceEn: 'Vary terrains when you play elsewhere to reinforce credibility.', flagKeys: ['terrain_monoculture'] },
  { id: 'gps_coherence', category: 'geographic', number: 5, titleFr: 'Coherence GPS', titleEn: 'GPS coherence', descFr: 'Coordonnees GPS des matchs alignees avec les terrains enregistres.', descEn: 'Match GPS coordinates aligned with registered terrains.', adviceFr: 'Autoriser la localisation lors des matchs pour valider les coordonnees.', adviceEn: 'Allow location on matches so coordinates can be validated.', flagKeys: ['gps_mismatch'] },

  // Temporal (6-10)
  { id: 'match_too_short', category: 'temporal', number: 6, titleFr: 'Duree trop courte', titleEn: 'Duration too short', descFr: 'Plusieurs matchs enregistres avec une duree inferieure a 5 minutes.', descEn: 'Multiple matches recorded with duration under 5 minutes.', adviceFr: 'Renseigner la duree reelle du match, pas une valeur symbolique.', adviceEn: 'Record the real match duration, not a symbolic value.', flagKeys: ['duration_too_short'] },
  { id: 'match_too_long', category: 'temporal', number: 7, titleFr: 'Duree trop longue', titleEn: 'Duration too long', descFr: 'Matchs de plus de 4 heures signales comme suspects.', descEn: 'Matches longer than 4 hours flagged as suspicious.', adviceFr: 'Verifier la duree si elle depasse 4h, cela concerne rarement une partie unique.', adviceEn: 'Verify duration if it exceeds 4h, that rarely fits a single match.', flagKeys: ['duration_too_long'] },
  { id: 'nocturnal_pattern', category: 'temporal', number: 8, titleFr: 'Activite nocturne', titleEn: 'Nocturnal pattern', descFr: 'Nombreux matchs entre 3h et 6h du matin (heure du terrain).', descEn: 'Many matches between 3am and 6am (terrain time).', adviceFr: 'Verifier le fuseau horaire du terrain, ou justifier via un temoin.', adviceEn: 'Verify terrain time zone or justify with a witness.', flagKeys: ['nocturnal_activity'] },
  { id: 'mass_submission', category: 'temporal', number: 9, titleFr: 'Soumission de masse', titleEn: 'Mass submission', descFr: 'Plus de 20 matchs enregistres sur les dernieres 24 heures.', descEn: 'More than 20 matches recorded in the last 24 hours.', adviceFr: 'Etaler l\'enregistrement des matchs et privilegier l\'attestation temoin.', adviceEn: 'Spread out match logging and prefer witness attestation.', flagKeys: ['mass_submission'] },
  { id: 'time_regularity', category: 'temporal', number: 10, titleFr: 'Regularite horaire', titleEn: 'Time regularity', descFr: 'Matchs enregistres a des horaires suspicieusement identiques.', descEn: 'Matches recorded at suspiciously identical times.', adviceFr: 'Varier les horaires de jeu pour un profil temporel naturel.', adviceEn: 'Vary playing hours for a natural temporal profile.', flagKeys: ['time_pattern'] },

  // Behavioral (11-16)
  { id: 'self_match', category: 'behavioral', number: 11, titleFr: 'Auto-match', titleEn: 'Self match', descFr: 'Meme joueur present dans les deux equipes du meme match.', descEn: 'Same player on both teams of the same match.', adviceFr: 'Un joueur ne peut pas jouer contre lui-meme. Supprimer les matchs concernes.', adviceEn: 'A player cannot play against themselves. Delete the concerned matches.', flagKeys: ['self_match'] },
  { id: 'symmetric_scores', category: 'behavioral', number: 12, titleFr: 'Scores symetriques', titleEn: 'Symmetric scores', descFr: 'Series de 5+ matchs avec scores 13-0 ou 13-1 recurrents.', descEn: 'Streaks of 5+ matches with recurring 13-0 or 13-1 scores.', adviceFr: 'Enregistrer les scores reels y compris les defaites serrees.', adviceEn: 'Record real scores including close defeats.', flagKeys: ['symmetric_score_streak'] },
  { id: 'ghost_opponents', category: 'behavioral', number: 13, titleFr: 'Adversaires fantomes', titleEn: 'Ghost opponents', descFr: 'Adversaires apparaissant uniquement dans vos matchs et jamais ailleurs.', descEn: 'Opponents appearing only in your matches and nowhere else.', adviceFr: 'Encourager vos adversaires a creer un compte et partager les matchs.', adviceEn: 'Encourage your opponents to create an account and share matches.', flagKeys: ['ghost_opponents'] },
  { id: 'win_ratio_extreme', category: 'behavioral', number: 14, titleFr: 'Taux de victoire extreme', titleEn: 'Extreme win ratio', descFr: 'Taux de victoire superieur a 95% sur plus de 30 matchs.', descEn: 'Win rate above 95% over more than 30 matches.', adviceFr: 'Jouer contre des adversaires plus varies pour une progression naturelle.', adviceEn: 'Play against more varied opponents for natural progression.', flagKeys: ['extreme_win_rate'] },
  { id: 'opponent_diversity', category: 'behavioral', number: 15, titleFr: 'Diversite adversaires', titleEn: 'Opponent diversity', descFr: 'Nombre d\'adversaires uniques rencontres dans les 90 derniers jours.', descEn: 'Unique opponents faced in the last 90 days.', adviceFr: 'Rencontrer au moins 5 adversaires differents chaque trimestre.', adviceEn: 'Meet at least 5 different opponents each quarter.', flagKeys: ['low_opponent_diversity'] },
  { id: 'action_consistency', category: 'behavioral', number: 16, titleFr: 'Coherence des actions', titleEn: 'Action consistency', descFr: 'Repartition tir/point/carreau coherente sur l\'ensemble de vos matchs.', descEn: 'Consistent shot/point/carreau distribution across matches.', adviceFr: 'Enregistrer honnetement chaque type d\'action, meme les moins reussies.', adviceEn: 'Honestly log each action type, even less successful ones.', flagKeys: ['action_pattern'] },

  // Statistical (17-20)
  { id: 'artificial_progression', category: 'statistical', number: 17, titleFr: 'Progression lineaire ELO', titleEn: 'Linear ELO progression', descFr: 'Courbe ELO trop reguliere (R2 > 0.9) signalant une progression artificielle.', descEn: 'Overly regular ELO curve (R2 > 0.9) indicating artificial progression.', adviceFr: 'Une progression naturelle contient des fluctuations. Laisser les defaites impacter votre ELO.', adviceEn: 'Natural progression includes fluctuations. Let defeats impact your ELO.', flagKeys: ['artificial_progression'] },
  { id: 'benford_deviation', category: 'statistical', number: 18, titleFr: 'Deviation Benford', titleEn: 'Benford deviation', descFr: 'Distribution des deltas ELO ne respecte pas la loi de Benford.', descEn: 'ELO delta distribution violates Benford\'s law.', adviceFr: 'Aucune action manuelle : evolue naturellement avec le nombre de matchs reels.', adviceEn: 'No manual action: evolves naturally with the number of real matches.', flagKeys: ['benford_deviation'] },
  { id: 'variance_low', category: 'statistical', number: 19, titleFr: 'Variance trop faible', titleEn: 'Variance too low', descFr: 'Coefficient de variation des scores trop bas.', descEn: 'Score coefficient of variation too low.', adviceFr: 'Enregistrer les vrais scores, y compris les defaites serrees.', adviceEn: 'Record real scores, including close defeats.', flagKeys: ['low_variance'] },
  { id: 'delta_ratio_skew', category: 'statistical', number: 20, titleFr: 'Asymetrie des deltas', titleEn: 'Delta ratio skew', descFr: 'Ratio delta ELO positif / negatif fortement asymetrique.', descEn: 'Positive/negative ELO delta ratio strongly skewed.', adviceFr: 'Accepter les defaites : elles renforcent la credibilite de votre progression.', adviceEn: 'Accept losses: they strengthen the credibility of your progression.', flagKeys: ['delta_skew'] },

  // Identity (21-24)
  { id: 'shared_fingerprint', category: 'identity', number: 21, titleFr: 'Empreinte partagee', titleEn: 'Shared fingerprint', descFr: 'Plusieurs comptes actifs partagent la meme empreinte d\'appareil (30j).', descEn: 'Multiple active accounts share the same device fingerprint (30d).', adviceFr: 'Un utilisateur = un compte. Utiliser un appareil different pour chaque compte legitime.', adviceEn: 'One user = one account. Use a different device for each legitimate account.', flagKeys: ['shared_fingerprint'] },
  { id: 'email_farm', category: 'identity', number: 22, titleFr: 'Ferme d\'emails', titleEn: 'Email farm', descFr: 'Plusieurs comptes crees avec emails sequentiels sur 24h (user1@, user2@).', descEn: 'Multiple accounts created with sequential emails within 24h.', adviceFr: 'Ne pas creer de faux comptes. Depasser 5 comptes / 6h declenche un bannissement automatique.', adviceEn: 'Do not create fake accounts. Over 5 accounts / 6h triggers auto-ban.', flagKeys: ['email_farm'] },
  { id: 'ip_clustering', category: 'identity', number: 23, titleFr: 'Regroupement IP', titleEn: 'IP clustering', descFr: 'Comptes multiples avec origine reseau similaire (indicatif seulement).', descEn: 'Multiple accounts with similar network origin (indicative only).', adviceFr: 'Signaler si votre club ou ecole partage le meme reseau pour eviter les faux positifs.', adviceEn: 'Flag if your club or school shares the network to avoid false positives.', flagKeys: ['ip_cluster'] },
  { id: 'account_age', category: 'identity', number: 24, titleFr: 'Anciennete du compte', titleEn: 'Account age', descFr: 'Comptes tres recents avec une activite disproportionnee.', descEn: 'Very recent accounts with disproportionate activity.', adviceFr: 'Enregistrer les matchs progressivement les premieres semaines.', adviceEn: 'Log matches gradually during the first weeks.', flagKeys: ['recent_account_activity'] },

  // Social (25-26)
  { id: 'witness_concentration', category: 'social', number: 25, titleFr: 'Concentration temoin', titleEn: 'Witness concentration', descFr: 'Un meme temoin atteste plus de 60% de vos matchs.', descEn: 'A single witness attests over 60% of your matches.', adviceFr: 'Diversifier les temoins : inviter au moins 3 attestataires differents.', adviceEn: 'Diversify witnesses: invite at least 3 different attestors.', flagKeys: ['witness_concentration'] },
  { id: 'share_acceptance', category: 'social', number: 26, titleFr: 'Acceptation des partages', titleEn: 'Share acceptance', descFr: 'Taux d\'acceptation de vos demandes de partage.', descEn: 'Acceptance rate of your share requests.', adviceFr: 'Partager avec les vrais participants et notifier avant l\'envoi.', adviceEn: 'Share with real participants and notify before sending.', flagKeys: ['low_share_acceptance'] },
];

const CATEGORY_CONFIG: Record<FactorCategory, { titleFr: string; titleEn: string; icon: string; color: string; descFr: string; descEn: string }> = {
  geographic: { titleFr: 'Geographique', titleEn: 'Geographic', icon: 'public', color: '#3B82F6', descFr: 'Coherence de vos localisations et deplacements.', descEn: 'Consistency of your locations and movements.' },
  temporal: { titleFr: 'Temporel', titleEn: 'Temporal', icon: 'schedule', color: '#F59E0B', descFr: 'Coherence de vos horaires et cadences.', descEn: 'Consistency of your times and rhythms.' },
  behavioral: { titleFr: 'Comportemental', titleEn: 'Behavioral', icon: 'psychology', color: '#7C3AED', descFr: 'Coherence de votre style de jeu.', descEn: 'Consistency of your playing style.' },
  statistical: { titleFr: 'Statistique', titleEn: 'Statistical', icon: 'bar-chart', color: '#0EA5E9', descFr: 'Distribution mathematique de vos resultats.', descEn: 'Mathematical distribution of your results.' },
  identity: { titleFr: 'Identite', titleEn: 'Identity', icon: 'fingerprint', color: '#EF4444', descFr: 'Unicite et anciennete de votre compte.', descEn: 'Uniqueness and age of your account.' },
  social: { titleFr: 'Social', titleEn: 'Social', icon: 'group', color: '#10B981', descFr: 'Validation par la communaute (temoins, partages).', descEn: 'Community validation (witnesses, shares).' },
};

const STATUS_CONFIG: Record<FactorStatus, { color: string; bg: string; icon: string; labelFr: string; labelEn: string }> = {
  ok: { color: '#10B981', bg: '#D1FAE5', icon: 'check-circle', labelFr: 'OK', labelEn: 'OK' },
  warning: { color: '#F59E0B', bg: '#FEF3C7', icon: 'warning', labelFr: 'Attention', labelEn: 'Warning' },
  problem: { color: '#EF4444', bg: '#FEE2E2', icon: 'error', labelFr: 'Probleme', labelEn: 'Problem' },
  unknown: { color: '#94A3B8', bg: '#F1F5F9', icon: 'help', labelFr: 'Non evalue', labelEn: 'Not evaluated' },
};

export default function TrustScoreFactorsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuth();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userFlags, setUserFlags] = useState<any[]>([]);
  const [trustScore, setTrustScore] = useState<number>(50);
  const [selectedCategory, setSelectedCategory] = useState<FactorCategory | 'all'>('all');
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const sb = getSupabaseClient();
      const { data: playerRows } = await sb
        .from('players')
        .select('id')
        .eq('user_id', user.id);
      const playerIds = (playerRows || []).map((p: any) => p.id);
      if (playerIds.length === 0) {
        setUserFlags([]);
        setTrustScore(50);
      } else {
        const { data: rows } = await sb
          .from('suspicious_players')
          .select('flags, trust_score')
          .in('player_id', playerIds);
        const allFlags: any[] = [];
        let minScore = 100;
        (rows || []).forEach((r: any) => {
          if (Array.isArray(r.flags)) allFlags.push(...r.flags);
          if (typeof r.trust_score === 'number') minScore = Math.min(minScore, r.trust_score);
        });
        setUserFlags(allFlags);
        setTrustScore(minScore === 100 ? 85 : minScore);
      }
    } catch { /* silent */ }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const factorStatuses = useMemo<Map<string, FactorStatus>>(() => {
    const map = new Map<string, FactorStatus>();
    for (const f of FACTORS) {
      const flagCount = userFlags.filter((fl: any) => f.flagKeys.some(k => (fl?.type || '').includes(k))).length;
      let status: FactorStatus;
      if (flagCount === 0) status = 'ok';
      else if (flagCount === 1) status = 'warning';
      else status = 'problem';
      map.set(f.id, status);
    }
    return map;
  }, [userFlags]);

  const categorySummary = useMemo(() => {
    const summary = new Map<FactorCategory, { total: number; ok: number; warning: number; problem: number }>();
    for (const cat of Object.keys(CATEGORY_CONFIG) as FactorCategory[]) {
      summary.set(cat, { total: 0, ok: 0, warning: 0, problem: 0 });
    }
    for (const f of FACTORS) {
      const s = factorStatuses.get(f.id) || 'ok';
      const cs = summary.get(f.category)!;
      cs.total++;
      if (s === 'ok') cs.ok++;
      else if (s === 'warning') cs.warning++;
      else if (s === 'problem') cs.problem++;
    }
    return summary;
  }, [factorStatuses]);

  const overallStats = useMemo(() => {
    let ok = 0, warning = 0, problem = 0;
    factorStatuses.forEach(s => {
      if (s === 'ok') ok++;
      else if (s === 'warning') warning++;
      else if (s === 'problem') problem++;
    });
    return { ok, warning, problem, total: FACTORS.length };
  }, [factorStatuses]);

  const filteredFactors = useMemo(() => {
    if (selectedCategory === 'all') return FACTORS;
    return FACTORS.filter(f => f.category === selectedCategory);
  }, [selectedCategory]);

  const scoreColor = trustScore >= 80 ? '#10B981' : trustScore >= 60 ? '#3B82F6' : trustScore >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <PageErrorBoundary pageName="TrustScoreFactors">
      <SafeAreaView edges={['top']} style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{fr ? 'Mon Score de Confiance' : 'My Trust Score'}</Text>
            <Text style={s.headerSub}>{fr ? '26 facteurs anti-triche detailles' : '26 anti-cheat factors detailed'}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
        >
          {loading ? (
            <View style={s.loadingBox}><ActivityIndicator size="large" color={theme.primary} /></View>
          ) : (
            <>
              {/* Score card */}
              <Animated.View entering={FadeInDown.duration(300)} style={s.scoreCard}>
                <View style={s.scoreCardHeader}>
                  <View>
                    <Text style={s.scoreLabel}>{fr ? 'Score global' : 'Overall score'}</Text>
                    <View style={s.scoreRow}>
                      <Text style={[s.scoreValue, { color: scoreColor }]}>{trustScore}</Text>
                      <Text style={s.scoreMax}>/100</Text>
                    </View>
                  </View>
                  <View style={[s.scoreCircle, { borderColor: scoreColor + '30' }]}>
                    <MaterialIcons
                      name={trustScore >= 80 ? 'verified' : trustScore >= 60 ? 'thumb-up' : 'warning'}
                      size={28}
                      color={scoreColor}
                    />
                  </View>
                </View>
                <View style={s.summaryPills}>
                  <View style={[s.summaryPill, { backgroundColor: '#D1FAE5' }]}>
                    <MaterialIcons name="check-circle" size={12} color="#10B981" />
                    <Text style={[s.summaryPillText, { color: '#065F46' }]}>{overallStats.ok} OK</Text>
                  </View>
                  <View style={[s.summaryPill, { backgroundColor: '#FEF3C7' }]}>
                    <MaterialIcons name="warning" size={12} color="#F59E0B" />
                    <Text style={[s.summaryPillText, { color: '#92400E' }]}>{overallStats.warning} {fr ? 'attention' : 'warning'}</Text>
                  </View>
                  <View style={[s.summaryPill, { backgroundColor: '#FEE2E2' }]}>
                    <MaterialIcons name="error" size={12} color="#EF4444" />
                    <Text style={[s.summaryPillText, { color: '#991B1B' }]}>{overallStats.problem} {fr ? 'probleme(s)' : 'problem(s)'}</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Category filter chips */}
              <View style={s.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Pressable
                    style={[s.categoryChip, selectedCategory === 'all' && s.categoryChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedCategory('all'); }}
                  >
                    <MaterialIcons name="layers" size={14} color={selectedCategory === 'all' ? '#FFF' : theme.textSecondary} />
                    <Text style={[s.categoryChipText, selectedCategory === 'all' && s.categoryChipTextActive]}>{fr ? 'Toutes' : 'All'}</Text>
                    <View style={[s.categoryCount, selectedCategory === 'all' && s.categoryCountActive]}>
                      <Text style={[s.categoryCountText, selectedCategory === 'all' && s.categoryCountTextActive]}>{FACTORS.length}</Text>
                    </View>
                  </Pressable>
                  {(Object.keys(CATEGORY_CONFIG) as FactorCategory[]).map(cat => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const sum = categorySummary.get(cat)!;
                    const isActive = selectedCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        style={[s.categoryChip, isActive && { backgroundColor: cfg.color, borderColor: cfg.color }]}
                        onPress={() => { Haptics.selectionAsync(); setSelectedCategory(cat); }}
                      >
                        <MaterialIcons name={cfg.icon as any} size={14} color={isActive ? '#FFF' : cfg.color} />
                        <Text style={[s.categoryChipText, isActive && { color: '#FFF' }]}>{fr ? cfg.titleFr : cfg.titleEn}</Text>
                        <View style={[s.categoryCount, isActive && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                          <Text style={[s.categoryCountText, isActive && { color: '#FFF' }]}>{sum.total}</Text>
                        </View>
                        {sum.problem > 0 ? <View style={s.problemDot} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Factor list */}
              {filteredFactors.map((f, idx) => {
                const catCfg = CATEGORY_CONFIG[f.category];
                const status = factorStatuses.get(f.id) || 'unknown';
                const statCfg = STATUS_CONFIG[status];
                const isExpanded = expandedFactor === f.id;

                return (
                  <Animated.View key={f.id} entering={FadeInDown.duration(250).delay(Math.min(idx * 30, 200))}>
                    <Pressable
                      style={[s.factorCard, isExpanded && { borderColor: catCfg.color + '40', borderWidth: 1.5 }]}
                      onPress={() => { Haptics.selectionAsync(); setExpandedFactor(isExpanded ? null : f.id); }}
                    >
                      <View style={s.factorHeader}>
                        <View style={[s.factorNumBox, { backgroundColor: catCfg.color + '15' }]}>
                          <Text style={[s.factorNumText, { color: catCfg.color }]}>{f.number}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.factorTitle}>{fr ? f.titleFr : f.titleEn}</Text>
                          <View style={s.factorMetaRow}>
                            <MaterialIcons name={catCfg.icon as any} size={11} color={catCfg.color} />
                            <Text style={[s.factorMetaText, { color: catCfg.color }]}>{fr ? catCfg.titleFr : catCfg.titleEn}</Text>
                          </View>
                        </View>
                        <View style={[s.statusBadge, { backgroundColor: statCfg.bg }]}>
                          <MaterialIcons name={statCfg.icon as any} size={12} color={statCfg.color} />
                          <Text style={[s.statusText, { color: statCfg.color }]}>{fr ? statCfg.labelFr : statCfg.labelEn}</Text>
                        </View>
                        <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
                      </View>

                      {isExpanded ? (
                        <View style={s.factorDetails}>
                          <View style={s.factorSection}>
                            <View style={s.factorSectionHeader}>
                              <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
                              <Text style={s.factorSectionLabel}>{fr ? 'Description' : 'Description'}</Text>
                            </View>
                            <Text style={s.factorDescText}>{fr ? f.descFr : f.descEn}</Text>
                          </View>
                          <View style={[s.factorSection, { backgroundColor: statCfg.bg + '80', borderRadius: 10, padding: 10, marginTop: 8 }]}>
                            <View style={s.factorSectionHeader}>
                              <MaterialIcons name="lightbulb-outline" size={14} color={statCfg.color} />
                              <Text style={[s.factorSectionLabel, { color: statCfg.color }]}>{fr ? 'Conseil' : 'Advice'}</Text>
                            </View>
                            <Text style={[s.factorDescText, { color: '#334155' }]}>{fr ? f.adviceFr : f.adviceEn}</Text>
                          </View>
                        </View>
                      ) : null}
                    </Pressable>
                  </Animated.View>
                );
              })}

              <Pressable style={s.faqLink} onPress={() => router.push('/faq' as any)}>
                <MaterialIcons name="help-outline" size={16} color={theme.primary} />
                <Text style={s.faqLinkText}>{fr ? 'En savoir plus sur l\'anti-triche' : 'Learn more about anti-cheat'}</Text>
                <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </PageErrorBoundary>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  headerSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  scoreCard: { backgroundColor: theme.surface, borderRadius: 18, padding: 18, marginBottom: 16, ...theme.shadows.card },
  scoreCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  scoreLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  scoreValue: { fontSize: 42, fontWeight: '800' },
  scoreMax: { fontSize: 18, fontWeight: '700', color: theme.textMuted, marginLeft: 4 },
  scoreCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  summaryPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  summaryPillText: { fontSize: 11, fontWeight: '700' },
  filterContainer: { marginBottom: 12 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.surface, borderRadius: 20, borderWidth: 1.5, borderColor: theme.border, position: 'relative' },
  categoryChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  categoryChipTextActive: { color: '#FFF' },
  categoryCount: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: theme.backgroundSecondary, borderRadius: 8, alignItems: 'center' },
  categoryCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  categoryCountText: { fontSize: 10, fontWeight: '700', color: theme.textMuted },
  categoryCountTextActive: { color: '#FFF' },
  problemDot: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' },
  factorCard: { backgroundColor: theme.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
  factorHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factorNumBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  factorNumText: { fontSize: 13, fontWeight: '800' },
  factorTitle: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  factorMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  factorMetaText: { fontSize: 10, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  factorDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  factorSection: { gap: 5 },
  factorSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  factorSectionLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  factorDescText: { fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  faqLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, paddingVertical: 14, backgroundColor: theme.primary + '10', borderRadius: 14, borderWidth: 1, borderColor: theme.primary + '30' },
  faqLinkText: { fontSize: 13, fontWeight: '700', color: theme.primary },
});
