import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

interface TierConfig {
  id: 'bronze' | 'silver' | 'gold';
  nameFr: string;
  nameEn: string;
  descFr: string;
  descEn: string;
  color: string;
  icon: string;
  gradient: [string, string];
  priceFr: string;
  priceEn: string;
  criteriaFr: string[];
  criteriaEn: string[];
  benefitsFr: string[];
  benefitsEn: string[];
}

const TIERS: TierConfig[] = [
  {
    id: 'bronze',
    nameFr: 'Bronze',
    nameEn: 'Bronze',
    descFr: 'Visibilite de base pour decouvrir le programme partenaire',
    descEn: 'Basic visibility to discover the partner program',
    color: '#A1887F',
    icon: 'military-tech',
    gradient: ['#D7CCC8', '#A1887F'],
    priceFr: 'Gratuit',
    priceEn: 'Free',
    criteriaFr: [
      'Etre une marque ou structure liee a la petanque',
      'Fournir un logo et une description',
      'Accepter les conditions du programme',
    ],
    criteriaEn: [
      'Be a brand or structure related to petanque',
      'Provide a logo and description',
      'Accept the program conditions',
    ],
    benefitsFr: [
      'Fiche partenaire dans la page "Nos Partenaires"',
      'Badge Bronze sur le profil',
      'Lien vers votre site web',
      'Acces aux statistiques de base (impressions, clics)',
      'Apparition sur la carte avec marqueur personnalise',
    ],
    benefitsEn: [
      'Partner card on the "Our Partners" page',
      'Bronze badge on profile',
      'Link to your website',
      'Access to basic statistics (impressions, clicks)',
      'Map appearance with custom marker',
    ],
  },
  {
    id: 'silver',
    nameFr: 'Argent',
    nameEn: 'Silver',
    descFr: 'Visibilite renforcee avec outils de communication',
    descEn: 'Enhanced visibility with communication tools',
    color: '#78909C',
    icon: 'workspace-premium',
    gradient: ['#CFD8DC', '#78909C'],
    priceFr: 'Sur devis',
    priceEn: 'On quote',
    criteriaFr: [
      'Tous les criteres Bronze',
      'Engagement minimum de 3 mois',
      'Contenu de marque (logo HD, couleur, description)',
    ],
    criteriaEn: [
      'All Bronze criteria',
      'Minimum 3-month commitment',
      'Brand content (HD logo, color, description)',
    ],
    benefitsFr: [
      'Tous les avantages Bronze',
      'Banniere rotative sur la page d\'accueil',
      'Push notifications (1/mois) aux joueurs cibles',
      'Dashboard analytique complet (ROI, CTR, portee)',
      'Templates push pre-redigees',
      'Programmation des envois push',
      'Export CSV/PDF des statistiques',
      'Badge Argent distinctif',
    ],
    benefitsEn: [
      'All Bronze benefits',
      'Rotating banner on home page',
      'Push notifications (1/month) to targeted players',
      'Full analytics dashboard (ROI, CTR, reach)',
      'Pre-written push templates',
      'Push scheduling',
      'CSV/PDF stats export',
      'Distinctive Silver badge',
    ],
  },
  {
    id: 'gold',
    nameFr: 'Or',
    nameEn: 'Gold',
    descFr: 'Visibilite maximale et outils premium exclusifs',
    descEn: 'Maximum visibility and exclusive premium tools',
    color: '#D4A017',
    icon: 'emoji-events',
    gradient: ['#F9E547', '#D4A017'],
    priceFr: 'Sur devis',
    priceEn: 'On quote',
    criteriaFr: [
      'Tous les criteres Argent',
      'Engagement minimum de 6 mois',
      'Marque reconnue dans le milieu petanque',
    ],
    criteriaEn: [
      'All Silver criteria',
      'Minimum 6-month commitment',
      'Recognized brand in the petanque world',
    ],
    benefitsFr: [
      'Tous les avantages Argent',
      'Banniere permanente et prioritaire sur l\'accueil',
      'Section dediee dans l\'onboarding des nouveaux joueurs',
      'Push notifications illimitees avec A/B testing',
      'Heatmap de performance et benchmark concurrents',
      'Calculateur ROI integre',
      'Objectifs mensuels avec suivi de progression',
      'CRM parrainages avec export',
      'Kit de marque exportable (PDF)',
      'Badge Or exclusif et marqueur carte premium',
      'Priorite dans les classements partenaires',
      'Digest hebdomadaire automatique',
    ],
    benefitsEn: [
      'All Silver benefits',
      'Permanent priority banner on home page',
      'Dedicated section in new player onboarding',
      'Unlimited push notifications with A/B testing',
      'Performance heatmap and competitor benchmark',
      'Integrated ROI calculator',
      'Monthly goals with progress tracking',
      'Referral CRM with export',
      'Exportable brand kit (PDF)',
      'Exclusive Gold badge and premium map marker',
      'Priority in partner rankings',
      'Automatic weekly digest',
    ],
  },
];

export default function PartnerProgramScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';
  const [expandedTier, setExpandedTier] = useState<string | null>('bronze');

  const toggleTier = useCallback((id: string) => {
    Haptics.selectionAsync();
    setExpandedTier(prev => prev === id ? null : id);
  }, []);

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
              <MaterialIcons name="handshake" size={28} color="#D4A017" />
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>
                  {fr ? 'Programme Partenaires' : 'Partner Program'}
                </Text>
                <Text style={styles.headerSub}>
                  {fr ? '3 niveaux de visibilite et avantages business' : '3 levels of visibility and business benefits'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.introCard}>
          <MaterialIcons name="campaign" size={22} color="#2563EB" />
          <Text style={styles.introText}>
            {fr
              ? 'Rejoignez le programme partenaire et touchez des milliers de joueurs passionnes. Choisissez le niveau de visibilite adapte a vos objectifs.'
              : 'Join the partner program and reach thousands of passionate players. Choose the visibility level that fits your goals.'}
          </Text>
        </Animated.View>

        {/* Progression visual */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.progressionCard}>
          <Text style={styles.progressionTitle}>
            {fr ? 'Niveaux partenaire' : 'Partner levels'}
          </Text>
          <View style={styles.progressionTrack}>
            {TIERS.map((tier, idx) => (
              <React.Fragment key={tier.id}>
                {idx > 0 ? <View style={styles.progressionConnector} /> : null}
                <View style={styles.progressionStep}>
                  <View style={[styles.progressionCircle, { backgroundColor: tier.color + '20', borderColor: tier.color }]}>
                    <MaterialIcons name={tier.icon as any} size={20} color={tier.color} />
                  </View>
                  <Text style={[styles.progressionLabel, { color: tier.color }]}>
                    {fr ? tier.nameFr : tier.nameEn}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </Animated.View>

        {/* Tier Cards */}
        {TIERS.map((tier, idx) => {
          const isExpanded = expandedTier === tier.id;
          const criteria = fr ? tier.criteriaFr : tier.criteriaEn;
          const benefits = fr ? tier.benefitsFr : tier.benefitsEn;

          return (
            <Animated.View
              key={tier.id}
              entering={FadeInDown.duration(300).delay(100 + idx * 80)}
            >
              <View style={[styles.tierCard, isExpanded && { borderColor: tier.color + '50' }]}>
                {/* Tier Header */}
                <Pressable style={styles.tierHeader} onPress={() => toggleTier(tier.id)}>
                  <LinearGradient
                    colors={tier.gradient}
                    style={styles.tierIconBg}
                  >
                    <MaterialIcons name={tier.icon as any} size={24} color="#FFF" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View style={styles.tierNameRow}>
                      <Text style={[styles.tierName, { color: tier.color }]}>
                        {fr ? tier.nameFr : tier.nameEn}
                      </Text>
                      <View style={[styles.tierPriceBadge, { backgroundColor: tier.color }]}>
                        <Text style={styles.tierPriceBadgeText}>
                          {fr ? tier.priceFr : tier.priceEn}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.tierDesc}>
                      {fr ? tier.descFr : tier.descEn}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={tier.color}
                  />
                </Pressable>

                {/* Expanded Content */}
                {isExpanded ? (
                  <View style={styles.tierExpanded}>
                    {/* Criteria */}
                    <View style={styles.tierSection}>
                      <View style={styles.tierSectionHeader}>
                        <MaterialIcons name="checklist" size={16} color={theme.textSecondary} />
                        <Text style={styles.tierSectionTitle}>
                          {fr ? 'Criteres' : 'Criteria'}
                        </Text>
                      </View>
                      {criteria.map((c, i) => (
                        <View key={i} style={styles.criteriaRow}>
                          <View style={[styles.criteriaCircle, { borderColor: tier.color }]}>
                            <Text style={[styles.criteriaNumber, { color: tier.color }]}>{i + 1}</Text>
                          </View>
                          <Text style={styles.criteriaText}>{c}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Benefits */}
                    <View style={styles.tierSection}>
                      <View style={styles.tierSectionHeader}>
                        <MaterialIcons name="card-giftcard" size={16} color={tier.color} />
                        <Text style={[styles.tierSectionTitle, { color: tier.color }]}>
                          {fr ? 'Avantages' : 'Benefits'}
                        </Text>
                      </View>
                      {benefits.map((b, i) => (
                        <View key={i} style={styles.benefitRow}>
                          <MaterialIcons name="check-circle" size={16} color={tier.color} />
                          <Text style={styles.benefitText}>{b}</Text>
                        </View>
                      ))}
                    </View>

                    {/* CTA per tier */}
                    <Pressable
                      style={({ pressed }) => [styles.tierCta, { backgroundColor: tier.color }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        Linking.openURL(`mailto:ultimate.petanque.app@gmail.com?subject=Partenariat%20${tier.nameFr}%20-%20Ultimate%20Petanque`);
                      }}
                    >
                      <MaterialIcons name="email" size={18} color="#FFF" />
                      <Text style={styles.tierCtaText}>
                        {fr ? `Devenir partenaire ${tier.nameFr}` : `Become ${tier.nameEn} partner`}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          );
        })}

        {/* Comparison Table */}
        <Animated.View entering={FadeInDown.duration(300).delay(350)} style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>{fr ? 'Comparaison rapide' : 'Quick comparison'}</Text>
          {[
            { feature: fr ? 'Fiche partenaire' : 'Partner card', bronze: true, silver: true, gold: true },
            { feature: fr ? 'Marqueur carte' : 'Map marker', bronze: true, silver: true, gold: true },
            { feature: fr ? 'Banniere accueil' : 'Home banner', bronze: false, silver: true, gold: true },
            { feature: fr ? 'Push notifications' : 'Push notifications', bronze: false, silver: true, gold: true },
            { feature: 'A/B Testing', bronze: false, silver: false, gold: true },
            { feature: fr ? 'Push illimites' : 'Unlimited push', bronze: false, silver: false, gold: true },
            { feature: fr ? 'Heatmap & Benchmark' : 'Heatmap & Benchmark', bronze: false, silver: false, gold: true },
            { feature: fr ? 'Calculateur ROI' : 'ROI Calculator', bronze: false, silver: false, gold: true },
            { feature: fr ? 'Objectifs mensuels' : 'Monthly goals', bronze: false, silver: false, gold: true },
            { feature: 'CRM & Export', bronze: false, silver: false, gold: true },
            { feature: fr ? 'Digest hebdo' : 'Weekly digest', bronze: false, silver: false, gold: true },
            { feature: fr ? 'Section onboarding' : 'Onboarding section', bronze: false, silver: false, gold: true },
          ].map((row, i) => (
            <View key={i} style={[styles.compRow, i % 2 === 0 && { backgroundColor: '#F8FAFC' }]}>
              <Text style={styles.compFeature}>{row.feature}</Text>
              {[row.bronze, row.silver, row.gold].map((val, ti) => (
                <View key={ti} style={styles.compCell}>
                  <MaterialIcons
                    name={val ? 'check-circle' : 'remove-circle-outline'}
                    size={16}
                    color={val ? TIERS[ti].color : '#CBD5E1'}
                  />
                </View>
              ))}
            </View>
          ))}
          {/* Header labels */}
          <View style={styles.compHeaderRow}>
            <View style={{ flex: 2 }} />
            {TIERS.map(t => (
              <View key={t.id} style={styles.compHeaderCell}>
                <View style={[styles.compHeaderDot, { backgroundColor: t.color }]} />
                <Text style={[styles.compHeaderLabel, { color: t.color }]}>{fr ? t.nameFr : t.nameEn}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Global CTA */}
        <Animated.View entering={FadeInDown.duration(300).delay(400)}>
          <Pressable
            style={({ pressed }) => [styles.globalCta, pressed && { transform: [{ scale: 0.98 }] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Partenariat%20Ultimate%20Petanque');
            }}
          >
            <LinearGradient
              colors={['#1E3A8A', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.globalCtaGradient}
            >
              <MaterialIcons name="handshake" size={22} color="#FFF" />
              <Text style={styles.globalCtaText}>
                {fr ? 'Contactez-nous pour en savoir plus' : 'Contact us to learn more'}
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
              q: fr ? 'Comment devenir partenaire ?' : 'How to become a partner?',
              a: fr
                ? 'Contactez notre equipe via email avec votre projet et le niveau souhaite. Nous repondons sous 48h avec une proposition personnalisee.'
                : 'Contact our team via email with your project and desired level. We respond within 48h with a personalized proposal.',
            },
            {
              q: fr ? 'Quelle est la difference avec le programme ambassadeur ?' : 'What is the difference with the ambassador program?',
              a: fr
                ? 'Les ambassadeurs sont des joueurs passionnes qui representent la communaute benevolement. Les partenaires sont des marques ou structures qui beneficient d\'une visibilite business avec des outils de communication et d\'analyse avances.'
                : 'Ambassadors are passionate players who represent the community voluntarily. Partners are brands or organizations that benefit from business visibility with advanced communication and analytics tools.',
            },
            {
              q: fr ? 'Puis-je changer de niveau ?' : 'Can I change my level?',
              a: fr
                ? 'Oui, vous pouvez passer au niveau superieur a tout moment. Le passage se fait sans interruption de service et vous conservez tout votre historique et vos donnees analytiques.'
                : 'Yes, you can upgrade at any time. The upgrade is seamless with no service interruption and you keep all your history and analytics data.',
            },
            {
              q: fr ? 'Comment sont mesurees les impressions ?' : 'How are impressions measured?',
              a: fr
                ? 'Chaque affichage de votre banniere, marqueur carte ou fiche partenaire est comptabilise comme une impression. Les clics sur votre profil ou lien sont egalement traces. Tout est visible dans votre dashboard analytique en temps reel.'
                : 'Each display of your banner, map marker or partner card counts as an impression. Clicks on your profile or link are also tracked. Everything is visible in your real-time analytics dashboard.',
            },
          ].map((faq, i) => (
            <View key={i} style={styles.faqItem}>
              <View style={styles.faqQRow}>
                <MaterialIcons name="help-outline" size={16} color="#2563EB" />
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
  header: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerGradient: { paddingTop: 12, paddingBottom: 20, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', position: 'relative' },
  headerDeco1: { position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.04)' },
  headerDeco2: { position: 'absolute', bottom: -15, left: -15, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  headerContent: {},
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, maxWidth: 640, alignSelf: 'center' as const, width: '100%' },
  introCard: { flexDirection: 'row', gap: 12, backgroundColor: '#2563EB08', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2563EB15' },
  introText: { flex: 1, fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  progressionCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#E8EDF2', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 }, default: {} }) },
  progressionTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  progressionTrack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressionStep: { alignItems: 'center', gap: 8 },
  progressionConnector: { width: 40, height: 3, backgroundColor: '#E2E8F0', borderRadius: 2, marginHorizontal: 4, marginBottom: 24 },
  progressionCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  progressionLabel: { fontSize: 12, fontWeight: '700' },
  tierCard: { backgroundColor: '#FFF', borderRadius: 18, marginBottom: 14, borderWidth: 1.5, borderColor: '#E8EDF2', overflow: 'hidden' as const, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 }, default: {} }) },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  tierIconBg: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tierNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierName: { fontSize: 18, fontWeight: '800' },
  tierPriceBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  tierPriceBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  tierDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 3 },
  tierExpanded: { paddingHorizontal: 16, paddingBottom: 18, paddingTop: 2, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  tierSection: { marginTop: 16 },
  tierSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  tierSectionTitle: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  criteriaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  criteriaCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  criteriaNumber: { fontSize: 10, fontWeight: '800' },
  criteriaText: { flex: 1, fontSize: 14, color: theme.textPrimary, lineHeight: 19 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  benefitText: { flex: 1, fontSize: 14, color: theme.textPrimary, lineHeight: 19 },
  tierCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: 14, marginTop: 16 },
  tierCtaText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  comparisonCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E8EDF2' },
  comparisonTitle: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginBottom: 14 },
  compHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: '#E2E8F0', marginBottom: 4 },
  compHeaderCell: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  compHeaderDot: { width: 8, height: 8, borderRadius: 4 },
  compHeaderLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  compRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  compFeature: { flex: 2, fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  compCell: { flex: 1, alignItems: 'center' },
  globalCta: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
  globalCtaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, borderRadius: 16 },
  globalCtaText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  faqCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E8EDF2' },
  faqTitle: { fontSize: 16, fontWeight: '800', color: theme.textPrimary, marginBottom: 14 },
  faqItem: { marginBottom: 16 },
  faqQRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  faqA: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, paddingLeft: 24 },
});
