import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { AMBASSADOR_LEVELS, AmbassadorLevel } from '@/services/ambassadorService';



interface LevelConfig {
  id: AmbassadorLevel;
  nameFr: string;
  nameEn: string;
  descFr: string;
  descEn: string;
  color: string;
  icon: string;
  criteriaFr: string[];
  criteriaEn: string[];
  benefitsFr: string[];
  benefitsEn: string[];
}

const LEVELS: LevelConfig[] = [
  {
    id: 'decouverte',
    nameFr: 'Decouverte',
    nameEn: 'Discovery',
    descFr: 'Premiers pas dans le programme ambassadeur',
    descEn: 'First steps in the ambassador program',
    color: '#3B82F6',
    icon: 'explore',
    criteriaFr: [
      'Etre inscrit sur Ultimate Petanque',
      'Avoir un profil public actif',
      'Partager son code parrainage',
    ],
    criteriaEn: [
      'Be registered on Ultimate Petanque',
      'Have an active public profile',
      'Share your referral code',
    ],
    benefitsFr: [
      'Badge ambassadeur dans le profil',
      'Code de parrainage personnel',
      'Acces aux statistiques de base',
      'Creation de 2 defis sponsorises/mois',
      'Apparition dans la liste des ambassadeurs',
    ],
    benefitsEn: [
      'Ambassador badge on profile',
      'Personal referral code',
      'Access to basic statistics',
      'Create 2 sponsored challenges/month',
      'Listed in ambassadors page',
    ],
  },
  {
    id: 'confirme',
    nameFr: 'Confirme',
    nameEn: 'Confirmed',
    descFr: 'Ambassadeur actif avec une communaute engagee',
    descEn: 'Active ambassador with an engaged community',
    color: '#7C3AED',
    icon: 'trending-up',
    criteriaFr: [
      '5+ parrainages valides',
      '3+ defis sponsorises organises',
      '500+ impressions cumulees',
    ],
    criteriaEn: [
      '5+ validated referrals',
      '3+ organized sponsored challenges',
      '500+ cumulative impressions',
    ],
    benefitsFr: [
      'Tous les avantages Decouverte',
      'Banniere rotative sur la page d\'accueil',
      'Dashboard analytics personnel complet',
      'Defis sponsorises illimites',
      'Suivi des parrainages en temps reel',
      'Badge "Confirme" distinctif violet',
    ],
    benefitsEn: [
      'All Discovery benefits',
      'Rotating banner on home page',
      'Full personal analytics dashboard',
      'Unlimited sponsored challenges',
      'Real-time referral tracking',
      'Distinctive purple "Confirmed" badge',
    ],
  },
  {
    id: 'elite',
    nameFr: 'Elite',
    nameEn: 'Elite',
    descFr: 'Ambassadeur de reference, figure incontournable de la communaute',
    descEn: 'Reference ambassador, key community figure',
    color: '#F59E0B',
    icon: 'military-tech',
    criteriaFr: [
      '20+ parrainages valides',
      '10+ defis sponsorises organises',
      '2000+ impressions cumulees',
    ],
    criteriaEn: [
      '20+ validated referrals',
      '10+ organized sponsored challenges',
      '2000+ cumulative impressions',
    ],
    benefitsFr: [
      'Tous les avantages Confirme',
      'Banniere permanente sur l\'accueil',
      'Section dediee dans l\'onboarding',
      'Notifications push illimitees',
      'Analytics avances avec export',
      'Badge "Elite" dore exclusif',
      'Priorite dans les classements ambassadeurs',
      'Acces anticipate aux nouvelles fonctionnalites',
    ],
    benefitsEn: [
      'All Confirmed benefits',
      'Permanent banner on home page',
      'Dedicated section in onboarding',
      'Unlimited push notifications',
      'Advanced analytics with export',
      'Exclusive gold "Elite" badge',
      'Priority in ambassador rankings',
      'Early access to new features',
    ],
  },
];

export default function AmbassadorProgramScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';
  const [expandedLevel, setExpandedLevel] = useState<AmbassadorLevel | null>('decouverte');
  const scrollViewRef = useRef<ScrollView>(null);
  const cardPositions = useRef<Map<string, number>>(new Map());

  const toggleLevel = useCallback((id: AmbassadorLevel) => {
    Haptics.selectionAsync();
    const isExpanding = expandedLevel !== id;
    setExpandedLevel(prev => prev === id ? null : id);
    if (isExpanding) {
      setTimeout(() => {
        const y = cardPositions.current.get(id);
        if (y !== undefined && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: Math.max(0, y - 80), animated: true });
        }
      }, 100);
    }
  }, [expandedLevel]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerGradient, { backgroundColor: '#0F172A' }]}>
          <View style={styles.headerDeco1} />
          <View style={styles.headerDeco2} />
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={22} color="#FFF" />
          </Pressable>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleRow}>
              <MaterialIcons name="stars" size={28} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>
                  {fr ? 'Programme Ambassadeurs' : 'Ambassador Program'}
                </Text>
                <Text style={styles.headerSub}>
                  {fr ? '3 niveaux de visibilite et avantages' : '3 levels of visibility and benefits'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.introCard}>
          <MaterialIcons name="campaign" size={22} color="#7C3AED" />
          <Text style={styles.introText}>
            {fr
              ? 'Devenez ambassadeur et representez la communaute petanque. Progressez dans les niveaux en parrainant de nouveaux joueurs et en organisant des defis.'
              : 'Become an ambassador and represent the petanque community. Progress through levels by referring new players and organizing challenges.'}
          </Text>
        </Animated.View>

        {/* Progression visual */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.progressionCard}>
          <Text style={styles.progressionTitle}>
            {fr ? 'Votre progression' : 'Your progression'}
          </Text>
          <View style={styles.progressionTrack}>
            {LEVELS.map((level, idx) => (
              <React.Fragment key={level.id}>
                {idx > 0 ? <View style={styles.progressionConnector} /> : null}
                <View style={styles.progressionStep}>
                  <View style={[styles.progressionCircle, { backgroundColor: level.color + '20', borderColor: level.color }]}>
                    <MaterialIcons name={level.icon as any} size={20} color={level.color} />
                  </View>
                  <Text style={[styles.progressionLabel, { color: level.color }]}>
                    {fr ? level.nameFr : level.nameEn}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </Animated.View>

        {/* Level Cards */}
        {LEVELS.map((level, idx) => {
          const isExpanded = expandedLevel === level.id;
          const criteria = fr ? level.criteriaFr : level.criteriaEn;
          const benefits = fr ? level.benefitsFr : level.benefitsEn;
          const levelConf = AMBASSADOR_LEVELS[level.id];

          return (
            <Animated.View
              key={level.id}
              entering={FadeInDown.duration(300).delay(100 + idx * 80)}
              onLayout={(e) => { cardPositions.current.set(level.id, e.nativeEvent.layout.y + 200); }}
            >
              <View style={[styles.levelCard, isExpanded && { borderColor: level.color + '50' }]}>
                {/* Level Header */}
                <Pressable style={styles.levelHeader} onPress={() => toggleLevel(level.id)}>
                  <LinearGradient
                    colors={[level.color, level.color + 'CC']}
                    style={styles.levelIconBg}
                  >
                    <MaterialIcons name={level.icon as any} size={24} color="#FFF" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View style={styles.levelNameRow}>
                      <Text style={[styles.levelName, { color: level.color }]}>
                        {fr ? level.nameFr : level.nameEn}
                      </Text>
                      <View style={[styles.levelBadge, { backgroundColor: level.color }]}>
                        <Text style={styles.levelBadgeText}>
                          {fr ? `Niveau ${idx + 1}` : `Level ${idx + 1}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.levelDesc}>
                      {fr ? level.descFr : level.descEn}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={level.color}
                  />
                </Pressable>

                {/* Expanded Content */}
                {isExpanded ? (
                  <Animated.View entering={FadeIn.duration(250)} style={styles.levelExpanded}>
                    {/* Criteria */}
                    <View style={styles.levelSection}>
                      <View style={styles.levelSectionHeader}>
                        <MaterialIcons name="checklist" size={16} color={theme.textSecondary} />
                        <Text style={styles.levelSectionTitle}>
                          {fr ? 'Criteres requis' : 'Required criteria'}
                        </Text>
                      </View>
                      {criteria.map((c, i) => (
                        <View key={i} style={styles.criteriaRow}>
                          <View style={[styles.criteriaCircle, { borderColor: level.color }]}>
                            {idx === 0 ? (
                              <MaterialIcons name="check" size={10} color={level.color} />
                            ) : (
                              <Text style={[styles.criteriaNumber, { color: level.color }]}>{i + 1}</Text>
                            )}
                          </View>
                          <Text style={styles.criteriaText}>{c}</Text>
                        </View>
                      ))}
                      {/* Threshold summary for Confirme/Elite */}
                      {idx > 0 ? (
                        <View style={[styles.thresholdCard, { backgroundColor: level.color + '08', borderColor: level.color + '20' }]}>
                          <View style={styles.thresholdRow}>
                            <MaterialIcons name="people" size={14} color={level.color} />
                            <Text style={styles.thresholdText}>
                              {levelConf.minReferrals} {fr ? 'parrainages' : 'referrals'}
                            </Text>
                          </View>
                          <View style={styles.thresholdRow}>
                            <MaterialIcons name="campaign" size={14} color={level.color} />
                            <Text style={styles.thresholdText}>
                              {levelConf.minEvents} {fr ? 'evenements' : 'events'}
                            </Text>
                          </View>
                          <View style={styles.thresholdRow}>
                            <MaterialIcons name="visibility" size={14} color={level.color} />
                            <Text style={styles.thresholdText}>
                              {levelConf.minImpressions.toLocaleString()} impressions
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>

                    {/* Benefits */}
                    <View style={styles.levelSection}>
                      <View style={styles.levelSectionHeader}>
                        <MaterialIcons name="card-giftcard" size={16} color={level.color} />
                        <Text style={[styles.levelSectionTitle, { color: level.color }]}>
                          {fr ? 'Avantages' : 'Benefits'}
                        </Text>
                      </View>
                      {benefits.map((b, i) => (
                        <View key={i} style={styles.benefitRow}>
                          <MaterialIcons name="check-circle" size={16} color={level.color} />
                          <Text style={styles.benefitText}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  </Animated.View>
                ) : null}
              </View>
            </Animated.View>
          );
        })}

        {/* XP System Info */}
        <Animated.View entering={FadeInDown.duration(300).delay(350)} style={styles.xpCard}>
          <View style={styles.xpHeader}>
            <MaterialIcons name="bolt" size={22} color="#F59E0B" />
            <Text style={styles.xpTitle}>{fr ? 'Systeme XP Parrainage' : 'Referral XP System'}</Text>
          </View>
          <Text style={styles.xpDesc}>
            {fr
              ? 'Chaque parrainage valide vous rapporte 50 XP. Accumulez des XP pour debloquer les niveaux superieurs et obtenir plus de visibilite dans l\'application.'
              : 'Each validated referral earns you 50 XP. Accumulate XP to unlock higher levels and get more visibility in the app.'}
          </Text>
          <View style={styles.xpTable}>
            {[
              { action: fr ? 'Parrainage valide' : 'Valid referral', xp: '+50 XP' },
              { action: fr ? 'Defi sponsorise cree' : 'Sponsored challenge created', xp: '+25 XP' },
              { action: fr ? '100 impressions' : '100 impressions', xp: '+10 XP' },
            ].map((item, i) => (
              <View key={i} style={styles.xpTableRow}>
                <Text style={styles.xpTableAction}>{item.action}</Text>
                <View style={styles.xpTableBadge}>
                  <Text style={styles.xpTableValue}>{item.xp}</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInDown.duration(300).delay(400)}>
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && { transform: [{ scale: 0.98 }] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/ambassador-dashboard' as any);
            }}
          >
            <LinearGradient
              colors={['#7C3AED', '#9333EA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <MaterialIcons name="dashboard" size={22} color="#FFF" />
              <Text style={styles.ctaText}>
                {fr ? 'Acceder au portail ambassadeur' : 'Access ambassador portal'}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* FAQ Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(450)} style={styles.faqCard}>
          <Text style={styles.faqTitle}>{fr ? 'Questions frequentes' : 'FAQ'}</Text>
          {[
            {
              q: fr ? 'Comment devenir ambassadeur ?' : 'How to become an ambassador?',
              a: fr
                ? 'Contactez notre equipe via la page partenaires ou utilisez le formulaire de candidature dans l\'application.'
                : 'Contact our team via the partners page or use the application form in the app.',
            },
            {
              q: fr ? 'Comment fonctionne le parrainage ?' : 'How does referral work?',
              a: fr
                ? 'Partagez votre code unique. Quand un nouveau joueur s\'inscrit avec votre code, vous gagnez 50 XP et votre compteur augmente.'
                : 'Share your unique code. When a new player signs up with your code, you earn 50 XP and your counter increases.',
            },
            {
              q: fr ? 'Quelle est la difference avec les sponsors ?' : 'What is the difference with sponsors?',
              a: fr
                ? 'Les ambassadeurs sont des joueurs passionnes qui representent la communaute. Les sponsors sont des partenaires commerciaux avec des offres de visibilite business (Bronze/Argent/Or).'
                : 'Ambassadors are passionate players representing the community. Sponsors are business partners with commercial visibility offers (Bronze/Silver/Gold).',
            },
          ].map((faq, i) => (
            <View key={i} style={styles.faqItem}>
              <View style={styles.faqQRow}>
                <MaterialIcons name="help-outline" size={16} color="#7C3AED" />
                <Text style={styles.faqQ}>{faq.q}</Text>
              </View>
              <Text style={styles.faqA}>{faq.a}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  // Header
  header: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerGradient: {
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  headerDeco1: { position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.04)' },
  headerDeco2: { position: 'absolute', bottom: -15, left: -15, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  headerContent: {},
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, maxWidth: 640, alignSelf: 'center' as const, width: '100%' },
  // Intro
  introCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#7C3AED08',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7C3AED15',
  },
  introText: { flex: 1, fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  // Progression
  progressionCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 }, default: {} }),
  },
  progressionTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  progressionTrack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressionStep: { alignItems: 'center', gap: 8 },
  progressionConnector: { width: 40, height: 3, backgroundColor: '#E2E8F0', borderRadius: 2, marginHorizontal: 4, marginBottom: 24 },
  progressionCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  progressionLabel: { fontSize: 12, fontWeight: '700' },
  // Level Cards
  levelCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#E8EDF2',
    overflow: 'hidden' as const,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 }, default: {} }),
  },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  levelIconBg: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  levelNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelName: { fontSize: 18, fontWeight: '800' },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  levelBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  levelDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 3 },
  levelExpanded: { paddingHorizontal: 16, paddingBottom: 18, paddingTop: 2, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  levelSection: { marginTop: 16 },
  levelSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  levelSectionTitle: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  // Criteria
  criteriaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  criteriaCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  criteriaNumber: { fontSize: 10, fontWeight: '800' },
  criteriaText: { flex: 1, fontSize: 14, color: theme.textPrimary, lineHeight: 19 },
  thresholdCard: { borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thresholdText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  // Benefits
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  benefitText: { flex: 1, fontSize: 14, color: theme.textPrimary, lineHeight: 19 },
  // XP Card
  xpCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 }, default: {} }),
  },
  xpHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  xpTitle: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
  xpDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 14 },
  xpTable: { gap: 8 },
  xpTableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  xpTableAction: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  xpTableBadge: { backgroundColor: '#F59E0B15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  xpTableValue: { fontSize: 13, fontWeight: '800', color: '#F59E0B' },
  // CTA
  ctaBtn: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
  ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 16 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // FAQ
  faqCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  faqTitle: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginBottom: 14 },
  faqItem: { marginBottom: 16 },
  faqQRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  faqA: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, paddingLeft: 24 },
});
