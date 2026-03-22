import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme, { blurhash } from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';

// Partner slot types
interface PartnerSlot {
  id: string;
  name: string;
  description: string;
  logo?: string;
  url?: string;
  category: 'gold' | 'silver' | 'bronze';
  isAvailable: boolean;
}

const PARTNER_SLOTS: PartnerSlot[] = [
  { id: 'gold-1', name: '', description: '', category: 'gold', isAvailable: true },
  { id: 'gold-2', name: '', description: '', category: 'gold', isAvailable: true },
  { id: 'silver-1', name: '', description: '', category: 'silver', isAvailable: true },
  { id: 'silver-2', name: '', description: '', category: 'silver', isAvailable: true },
  { id: 'silver-3', name: '', description: '', category: 'silver', isAvailable: true },
  { id: 'bronze-1', name: '', description: '', category: 'bronze', isAvailable: true },
  { id: 'bronze-2', name: '', description: '', category: 'bronze', isAvailable: true },
  { id: 'bronze-3', name: '', description: '', category: 'bronze', isAvailable: true },
  { id: 'bronze-4', name: '', description: '', category: 'bronze', isAvailable: true },
];

const CATEGORY_CONFIG = {
  gold: { icon: 'emoji-events' as const, color: '#FFD700', bg: '#FFD700', label: { fr: 'Partenaire Or', en: 'Gold Partner' } },
  silver: { icon: 'workspace-premium' as const, color: '#A8B4C0', bg: '#A8B4C0', label: { fr: 'Partenaire Argent', en: 'Silver Partner' } },
  bronze: { icon: 'military-tech' as const, color: '#CD7F32', bg: '#CD7F32', label: { fr: 'Partenaire Bronze', en: 'Bronze Partner' } },
};

export default function PartnersScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [ambassadorsLoading, setAmbassadorsLoading] = useState(true);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: any) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;

  const loadAmbassadors = useCallback(async () => {
    const { ambassadors: data } = await fetchAmbassadors();
    setAmbassadors(data);
    setAmbassadorsLoading(false);
  }, []);

  useEffect(() => { loadAmbassadors(); }, [loadAmbassadors]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAmbassadors();
    setRefreshing(false);
  };

  const goldSlots = PARTNER_SLOTS.filter(s => s.category === 'gold');
  const silverSlots = PARTNER_SLOTS.filter(s => s.category === 'silver');
  const bronzeSlots = PARTNER_SLOTS.filter(s => s.category === 'bronze');

  const renderPartnerSlot = (slot: PartnerSlot, index: number, sectionDelay: number) => {
    const cfg = CATEGORY_CONFIG[slot.category];
    if (slot.isAvailable) {
      return (
        <Animated.View key={slot.id} entering={FadeInDown.duration(350).delay(sectionDelay + index * 80)} style={[styles.partnerCard, styles.partnerCardAvailable, slot.category === 'gold' && styles.partnerCardGold]}>
          <View style={[styles.availableIconBg, { backgroundColor: cfg.bg + '15' }]}>
            <MaterialIcons name={cfg.icon} size={slot.category === 'gold' ? 36 : 28} color={cfg.color} />
          </View>
          <Text style={styles.availableTitle}>{language === 'fr' ? 'Emplacement disponible' : 'Slot available'}</Text>
          <Text style={styles.availableCategory}>{cfg.label[language]}</Text>
          <Pressable style={[styles.contactBtn, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]} onPress={() => { Haptics.selectionAsync(); Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Partenariat%20Ultimate%20Petanque%20-%20' + encodeURIComponent(cfg.label.fr)); }}>
            <MaterialIcons name="email" size={14} color={cfg.color} />
            <Text style={[styles.contactBtnText, { color: cfg.color }]}>{language === 'fr' ? 'Devenir partenaire' : 'Become a partner'}</Text>
          </Pressable>
        </Animated.View>
      );
    }
    return null;
  };

  const renderAmbassadorCard = (amb: Ambassador, index: number) => (
    <Animated.View key={amb.id} entering={FadeInDown.duration(400).delay(100 + index * 80)}>
      <Pressable
        style={({ pressed }) => [styles.ambCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        onPress={() => amb.playerId ? router.push(`/player/${amb.playerId}` as any) : undefined}
      >
        {/* Header with photo and info */}
        <View style={styles.ambHeader}>
          <View style={styles.ambAvatarWrap}>
            {amb.photo ? (
              <Image source={{ uri: amb.photo }} style={styles.ambAvatar} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.ambAvatar, { backgroundColor: '#7C3AED' + '20', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#7C3AED' }}>{amb.displayName.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.ambVerifiedBadge}>
              <MaterialIcons name="verified" size={16} color="#FFF" />
            </View>
          </View>
          <View style={styles.ambInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.ambName} numberOfLines={1}>{amb.displayName}</Text>
              <View style={styles.ambBadge}>
                <MaterialIcons name="verified" size={11} color="#7C3AED" />
                <Text style={styles.ambBadgeText}>{language === 'fr' ? 'Ambassadeur' : 'Ambassador'}</Text>
              </View>
            </View>
            {(amb.role || amb.club || amb.city) ? (
              <Text style={styles.ambMeta} numberOfLines={1}>
                {[amb.role ? t('roles', amb.role) : null, amb.club, amb.city].filter(Boolean).join(' \u2022 ')}
              </Text>
            ) : null}
            {amb.bio ? <Text style={styles.ambBio} numberOfLines={3}>{amb.bio}</Text> : null}
          </View>
        </View>

        {/* Stats row */}
        {amb.stats ? (
          <View style={styles.ambStatsRow}>
            <View style={styles.ambStatItem}>
              <Text style={[styles.ambStatValue, { color: theme.success }]}>{amb.stats.winRate}%</Text>
              <Text style={styles.ambStatLabel}>{language === 'fr' ? 'Victoires' : 'Win rate'}</Text>
            </View>
            <View style={styles.ambStatDivider} />
            <View style={styles.ambStatItem}>
              <Text style={styles.ambStatValue}>{amb.stats.matchesPlayed}</Text>
              <Text style={styles.ambStatLabel}>{t('leaderboard', 'matches')}</Text>
            </View>
            <View style={styles.ambStatDivider} />
            <View style={styles.ambStatItem}>
              <Text style={[styles.ambStatValue, { color: theme.tirColor }]}>{amb.stats.tirRate > 0 ? `${amb.stats.tirRate}%` : '-'}</Text>
              <Text style={styles.ambStatLabel}>Tir</Text>
            </View>
            <View style={styles.ambStatDivider} />
            <View style={styles.ambStatItem}>
              <Text style={[styles.ambStatValue, { color: theme.carreauColor }]}>{amb.stats.carreauRate > 0 ? `${amb.stats.carreauRate}%` : '-'}</Text>
              <Text style={styles.ambStatLabel}>Car.</Text>
            </View>
          </View>
        ) : null}

        {/* Social links */}
        <View style={styles.ambSocialRow}>
          {amb.youtubeUrl ? (
            <Pressable style={[styles.ambSocialBtn, { backgroundColor: '#FF0000' + '12' }]} onPress={() => Linking.openURL(amb.youtubeUrl!)}>
              <MaterialIcons name="play-arrow" size={16} color="#FF0000" />
              <Text style={[styles.ambSocialText, { color: '#FF0000' }]}>YouTube</Text>
            </Pressable>
          ) : null}
          {amb.tiktokUrl ? (
            <Pressable style={[styles.ambSocialBtn, { backgroundColor: '#000' + '08' }]} onPress={() => Linking.openURL(amb.tiktokUrl!)}>
              <MaterialIcons name="music-note" size={16} color="#000" />
              <Text style={[styles.ambSocialText, { color: '#000' }]}>TikTok</Text>
            </Pressable>
          ) : null}
          {amb.instagramHandle ? (
            <Pressable style={[styles.ambSocialBtn, { backgroundColor: '#E4405F' + '12' }]} onPress={() => { const handle = amb.instagramHandle!.replace('@', ''); Linking.openURL(`https://instagram.com/${handle}`); }}>
              <MaterialIcons name="camera-alt" size={16} color="#E4405F" />
              <Text style={[styles.ambSocialText, { color: '#E4405F' }]}>@{amb.instagramHandle!.replace('@', '')}</Text>
            </Pressable>
          ) : null}
          {amb.twitterHandle ? (
            <Pressable style={[styles.ambSocialBtn, { backgroundColor: '#1DA1F2' + '12' }]} onPress={() => { const handle = amb.twitterHandle!.replace('@', ''); Linking.openURL(`https://x.com/${handle}`); }}>
              <MaterialIcons name="alternate-email" size={16} color="#1DA1F2" />
              <Text style={[styles.ambSocialText, { color: '#1DA1F2' }]}>{amb.twitterHandle}</Text>
            </Pressable>
          ) : null}
          {amb.websiteUrl ? (
            <Pressable style={[styles.ambSocialBtn, { backgroundColor: theme.primary + '10' }]} onPress={() => { const url = amb.websiteUrl!.startsWith('http') ? amb.websiteUrl! : `https://${amb.websiteUrl}`; Linking.openURL(url); }}>
              <MaterialIcons name="language" size={16} color={theme.primary} />
              <Text style={[styles.ambSocialText, { color: theme.primary }]}>Web</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{language === 'fr' ? 'Ambassadeurs & Partenaires' : 'Ambassadors & Partners'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }, isTablet && styles.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
      >
        {/* ====== AMBASSADORS SECTION ====== */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient colors={['#7C3AED', '#A78BFA', '#C4B5FD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ambHero}>
            <View style={styles.ambHeroIcon}>
              <MaterialIcons name="verified" size={40} color="#FFF" />
            </View>
            <Text style={styles.ambHeroTitle}>{language === 'fr' ? 'Nos Ambassadeurs' : 'Our Ambassadors'}</Text>
            <Text style={styles.ambHeroSubtitle}>
              {language === 'fr'
                ? 'Les influenceurs et passionnes qui representent Ultimate Petanque'
                : 'The influencers and enthusiasts who represent Ultimate Petanque'}
            </Text>
          </LinearGradient>
        </Animated.View>

        {ambassadorsLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>{language === 'fr' ? 'Chargement...' : 'Loading...'}</Text>
          </View>
        ) : ambassadors.length > 0 ? (
          <View style={styles.ambList}>
            {ambassadors.map((amb, idx) => renderAmbassadorCard(amb, idx))}
          </View>
        ) : (
          <View style={styles.ambEmptyState}>
            <View style={styles.ambEmptyIcon}>
              <MaterialIcons name="verified" size={48} color={theme.textMuted} />
            </View>
            <Text style={styles.ambEmptyTitle}>{language === 'fr' ? 'Bientot disponible' : 'Coming soon'}</Text>
            <Text style={styles.ambEmptyDesc}>
              {language === 'fr'
                ? 'Notre programme ambassadeur est en cours de lancement. Contactez-nous pour en faire partie !'
                : 'Our ambassador program is launching. Contact us to be part of it!'}
            </Text>
            <Pressable style={styles.ambEmptyBtn} onPress={() => { Haptics.selectionAsync(); Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Programme%20Ambassadeur%20Ultimate%20Petanque'); }}>
              <MaterialIcons name="email" size={18} color="#FFF" />
              <Text style={styles.ambEmptyBtnText}>{language === 'fr' ? 'Devenir ambassadeur' : 'Become an ambassador'}</Text>
            </Pressable>
          </View>
        )}

        {/* ====== PARTNERS SECTION ====== */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.partnersSection}>
          <View style={styles.partnersSectionHeader}>
            <View style={styles.partnersSectionIcon}>
              <MaterialIcons name="handshake" size={22} color={theme.primary} />
            </View>
            <View>
              <Text style={styles.partnersSectionTitle}>{language === 'fr' ? 'Partenaires & Sponsors' : 'Partners & Sponsors'}</Text>
              <Text style={styles.partnersSectionSub}>
                {language === 'fr' ? 'Ils soutiennent la communaute petanque' : 'They support the petanque community'}
              </Text>
            </View>
          </View>

          {/* Gold */}
          <View style={styles.partnerGroupHeader}>
            <View style={[styles.partnerGroupIcon, { backgroundColor: '#FFD700' + '18' }]}>
              <MaterialIcons name="emoji-events" size={16} color="#FFD700" />
            </View>
            <Text style={styles.partnerGroupTitle}>{language === 'fr' ? 'Partenaires Or' : 'Gold Partners'}</Text>
          </View>
          {goldSlots.map((slot, i) => renderPartnerSlot(slot, i, 300))}

          {/* Silver */}
          <View style={styles.partnerGroupHeader}>
            <View style={[styles.partnerGroupIcon, { backgroundColor: '#A8B4C0' + '18' }]}>
              <MaterialIcons name="workspace-premium" size={16} color="#A8B4C0" />
            </View>
            <Text style={styles.partnerGroupTitle}>{language === 'fr' ? 'Partenaires Argent' : 'Silver Partners'}</Text>
          </View>
          {silverSlots.map((slot, i) => renderPartnerSlot(slot, i, 450))}

          {/* Bronze */}
          <View style={styles.partnerGroupHeader}>
            <View style={[styles.partnerGroupIcon, { backgroundColor: '#CD7F32' + '18' }]}>
              <MaterialIcons name="military-tech" size={16} color="#CD7F32" />
            </View>
            <Text style={styles.partnerGroupTitle}>{language === 'fr' ? 'Partenaires Bronze' : 'Bronze Partners'}</Text>
          </View>
          {bronzeSlots.map((slot, i) => renderPartnerSlot(slot, i, 600))}
        </Animated.View>

        {/* ====== CTA ====== */}
        <Animated.View entering={FadeInDown.duration(400).delay(800)} style={styles.ctaCard}>
          <View style={styles.ctaIconBg}>
            <MaterialIcons name="campaign" size={32} color={theme.primary} />
          </View>
          <Text style={styles.ctaTitle}>{language === 'fr' ? 'Devenez partenaire ou ambassadeur' : 'Become a partner or ambassador'}</Text>
          <Text style={styles.ctaDescription}>
            {language === 'fr'
              ? 'Rejoignez Ultimate Petanque et touchez des milliers de joueurs passionnes.'
              : 'Join Ultimate Petanque and reach thousands of passionate players.'}
          </Text>
          <View style={styles.ctaBenefits}>
            {[
              { icon: 'visibility', text: language === 'fr' ? 'Visibilite dans l\'app' : 'In-app visibility' },
              { icon: 'people', text: language === 'fr' ? 'Communaute engagee' : 'Engaged community' },
              { icon: 'verified', text: language === 'fr' ? 'Badge Ambassadeur verifie' : 'Verified Ambassador badge' },
            ].map((b, i) => (
              <View key={i} style={styles.ctaBenefitItem}>
                <MaterialIcons name={b.icon as any} size={16} color={theme.success} />
                <Text style={styles.ctaBenefitText}>{b.text}</Text>
              </View>
            ))}
          </View>
          <Pressable style={styles.ctaButton} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Partenariat%20Ultimate%20Petanque'); }}>
            <MaterialIcons name="email" size={20} color="#FFF" />
            <Text style={styles.ctaButtonText}>{language === 'fr' ? 'Nous contacter' : 'Contact us'}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  scrollContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },

  // Ambassador Hero
  ambHero: { borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 20 },
  ambHeroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  ambHeroTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 8, textAlign: 'center' },
  ambHeroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20, maxWidth: 320 },

  // Ambassador list
  ambList: { marginBottom: 24 },
  ambCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1.5, borderColor: '#7C3AED' + '20', ...theme.shadows.card },
  ambHeader: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  ambAvatarWrap: { position: 'relative' as const },
  ambAvatar: { width: 64, height: 64, borderRadius: 20, overflow: 'hidden' as const },
  ambVerifiedBadge: { position: 'absolute' as const, bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#7C3AED', alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 2.5, borderColor: theme.surface },
  ambInfo: { flex: 1 },
  ambName: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  ambBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#7C3AED' + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  ambBadgeText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  ambMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
  ambBio: { fontSize: 13, color: theme.textSecondary, marginTop: 6, lineHeight: 19 },

  // Ambassador stats
  ambStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, marginBottom: 14 },
  ambStatItem: { flex: 1, alignItems: 'center' },
  ambStatValue: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
  ambStatLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2, textTransform: 'uppercase' as const },
  ambStatDivider: { width: 1, height: 24, backgroundColor: theme.border },

  // Ambassador social
  ambSocialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ambSocialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  ambSocialText: { fontSize: 12, fontWeight: '600' },

  // Loading / Empty
  loadingState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { fontSize: 14, color: theme.textMuted },
  ambEmptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, backgroundColor: theme.surface, borderRadius: 20, marginBottom: 24, ...theme.shadows.card },
  ambEmptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#7C3AED' + '10', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  ambEmptyTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  ambEmptyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 300 },
  ambEmptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7C3AED', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  ambEmptyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Partners section
  partnersSection: { marginBottom: 24 },
  partnersSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  partnersSectionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' },
  partnersSectionTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  partnersSectionSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  partnerGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 8 },
  partnerGroupIcon: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  partnerGroupTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },

  // Partner cards
  partnerCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, marginBottom: 12, alignItems: 'center', ...theme.shadows.card },
  partnerCardAvailable: { borderWidth: 2, borderColor: theme.border, borderStyle: 'dashed' as any, backgroundColor: theme.backgroundSecondary },
  partnerCardGold: { borderColor: '#FFD700' + '40', backgroundColor: '#FFD700' + '04', minHeight: 140 },
  availableIconBg: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  availableTitle: { fontSize: 14, fontWeight: '600', color: theme.textMuted, marginBottom: 3 },
  availableCategory: { fontSize: 11, color: theme.textMuted, marginBottom: 12 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.borderRadius.full, borderWidth: 1.5 },
  contactBtnText: { fontSize: 12, fontWeight: '600' },

  // CTA
  ctaCard: { backgroundColor: theme.surface, borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: theme.primary + '20', ...theme.shadows.cardElevated },
  ctaIconBg: { width: 64, height: 64, borderRadius: 20, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ctaTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginBottom: 10, textAlign: 'center' },
  ctaDescription: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 340 },
  ctaBenefits: { gap: 8, marginBottom: 20, width: '100%' },
  ctaBenefitItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.success + '08', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  ctaBenefitText: { fontSize: 14, fontWeight: '500', color: theme.textPrimary },
  ctaButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14, width: '100%', ...theme.shadows.cardElevated },
  ctaButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
