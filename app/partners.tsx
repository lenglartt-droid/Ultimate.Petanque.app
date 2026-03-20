import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

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

// Placeholder partner slots - ready to be filled with real partners
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

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: any) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);

  const isTablet = screenWidth >= 600;

  const handleRefresh = async () => {
    setRefreshing(true);
    // Future: fetch partner data from backend
    await new Promise(resolve => setTimeout(resolve, 800));
    setRefreshing(false);
  };

  const goldSlots = PARTNER_SLOTS.filter(s => s.category === 'gold');
  const silverSlots = PARTNER_SLOTS.filter(s => s.category === 'silver');
  const bronzeSlots = PARTNER_SLOTS.filter(s => s.category === 'bronze');

  const renderPartnerSlot = (slot: PartnerSlot, index: number, sectionDelay: number) => {
    const cfg = CATEGORY_CONFIG[slot.category];

    if (slot.isAvailable) {
      return (
        <Animated.View
          key={slot.id}
          entering={FadeInDown.duration(350).delay(sectionDelay + index * 80)}
          style={[
            styles.partnerCard,
            styles.partnerCardAvailable,
            slot.category === 'gold' && styles.partnerCardGold,
          ]}
        >
          <View style={[styles.availableIconBg, { backgroundColor: cfg.bg + '15' }]}>
            <MaterialIcons name={cfg.icon} size={slot.category === 'gold' ? 36 : 28} color={cfg.color} />
          </View>
          <Text style={styles.availableTitle}>
            {language === 'fr' ? 'Emplacement disponible' : 'Slot available'}
          </Text>
          <Text style={styles.availableCategory}>{cfg.label[language]}</Text>
          <Pressable
            style={[styles.contactBtn, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '40' }]}
            onPress={() => {
              Haptics.selectionAsync();
              Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Partenariat%20Ultimate%20Petanque%20-%20' + encodeURIComponent(cfg.label.fr));
            }}
          >
            <MaterialIcons name="email" size={14} color={cfg.color} />
            <Text style={[styles.contactBtnText, { color: cfg.color }]}>
              {language === 'fr' ? 'Devenir partenaire' : 'Become a partner'}
            </Text>
          </Pressable>
        </Animated.View>
      );
    }

    // Active partner (for future use)
    return (
      <Animated.View
        key={slot.id}
        entering={FadeInDown.duration(350).delay(sectionDelay + index * 80)}
      >
        <Pressable
          style={[styles.partnerCard, slot.category === 'gold' && styles.partnerCardGoldFilled]}
          onPress={() => {
            if (slot.url) {
              Haptics.selectionAsync();
              Linking.openURL(slot.url);
            }
          }}
        >
          <View style={[styles.partnerLogoBg, { backgroundColor: cfg.color + '12' }]}>
            <MaterialIcons name="storefront" size={32} color={cfg.color} />
          </View>
          <Text style={styles.partnerName}>{slot.name}</Text>
          <Text style={styles.partnerDescription} numberOfLines={2}>{slot.description}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: cfg.color + '15' }]}>
            <MaterialIcons name={cfg.icon} size={12} color={cfg.color} />
            <Text style={[styles.categoryBadgeText, { color: cfg.color }]}>{cfg.label[language]}</Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {language === 'fr' ? 'Nos Partenaires' : 'Our Partners'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
          isTablet && styles.scrollContentTablet,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
          <View style={styles.heroIconBg}>
            <MaterialIcons name="handshake" size={40} color={theme.primary} />
          </View>
          <Text style={styles.heroTitle}>
            {language === 'fr' ? 'Partenaires & Sponsors' : 'Partners & Sponsors'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {language === 'fr'
              ? 'Ils soutiennent Ultimate Petanque et la communaute petanque'
              : 'They support Ultimate Petanque and the petanque community'}
          </Text>
        </Animated.View>

        {/* Gold Section */}
        <Animated.View entering={FadeIn.duration(300).delay(100)}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBg, { backgroundColor: '#FFD700' + '18' }]}>
              <MaterialIcons name="emoji-events" size={18} color="#FFD700" />
            </View>
            <Text style={styles.sectionTitle}>
              {language === 'fr' ? 'Partenaires Or' : 'Gold Partners'}
            </Text>
          </View>
          <View style={isTablet ? styles.gridTablet : undefined}>
            {goldSlots.map((slot, i) => renderPartnerSlot(slot, i, 150))}
          </View>
        </Animated.View>

        {/* Silver Section */}
        <Animated.View entering={FadeIn.duration(300).delay(300)}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBg, { backgroundColor: '#A8B4C0' + '18' }]}>
              <MaterialIcons name="workspace-premium" size={18} color="#A8B4C0" />
            </View>
            <Text style={styles.sectionTitle}>
              {language === 'fr' ? 'Partenaires Argent' : 'Silver Partners'}
            </Text>
          </View>
          <View style={isTablet ? styles.gridTablet : undefined}>
            {silverSlots.map((slot, i) => renderPartnerSlot(slot, i, 400))}
          </View>
        </Animated.View>

        {/* Bronze Section */}
        <Animated.View entering={FadeIn.duration(300).delay(500)}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconBg, { backgroundColor: '#CD7F32' + '18' }]}>
              <MaterialIcons name="military-tech" size={18} color="#CD7F32" />
            </View>
            <Text style={styles.sectionTitle}>
              {language === 'fr' ? 'Partenaires Bronze' : 'Bronze Partners'}
            </Text>
          </View>
          <View style={isTablet ? styles.gridTablet : styles.bronzeGrid}>
            {bronzeSlots.map((slot, i) => renderPartnerSlot(slot, i, 600))}
          </View>
        </Animated.View>

        {/* CTA Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(800)} style={styles.ctaCard}>
          <View style={styles.ctaIconBg}>
            <MaterialIcons name="campaign" size={32} color={theme.primary} />
          </View>
          <Text style={styles.ctaTitle}>
            {language === 'fr' ? 'Devenez partenaire' : 'Become a partner'}
          </Text>
          <Text style={styles.ctaDescription}>
            {language === 'fr'
              ? 'Rejoignez Ultimate Petanque et touchez des milliers de joueurs passionnes. Visibilite sur l\'application, association a la communaute petanque.'
              : 'Join Ultimate Petanque and reach thousands of passionate players. Visibility in the app, association with the petanque community.'}
          </Text>
          <View style={styles.ctaBenefits}>
            {[
              { icon: 'visibility', text: language === 'fr' ? 'Visibilite dans l\'app' : 'In-app visibility' },
              { icon: 'people', text: language === 'fr' ? 'Communaute engagee' : 'Engaged community' },
              { icon: 'trending-up', text: language === 'fr' ? 'Image de marque' : 'Brand image' },
            ].map((b, i) => (
              <View key={i} style={styles.ctaBenefitItem}>
                <MaterialIcons name={b.icon as any} size={16} color={theme.success} />
                <Text style={styles.ctaBenefitText}>{b.text}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={styles.ctaButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Partenariat%20Ultimate%20Petanque');
            }}
          >
            <MaterialIcons name="email" size={20} color="#FFF" />
            <Text style={styles.ctaButtonText}>
              {language === 'fr' ? 'Nous contacter' : 'Contact us'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
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
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  scrollContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },

  // Hero
  heroCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.xl,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    ...theme.shadows.cardElevated,
  },
  heroIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: theme.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary, marginBottom: 8, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 320 },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    marginTop: 8,
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },

  // Partner cards
  partnerCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  partnerCardAvailable: {
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed' as any,
    backgroundColor: theme.backgroundSecondary,
  },
  partnerCardGold: {
    borderColor: '#FFD700' + '40',
    backgroundColor: '#FFD700' + '04',
    minHeight: 160,
  },
  partnerCardGoldFilled: {
    borderWidth: 2,
    borderColor: '#FFD700' + '50',
    backgroundColor: '#FFD700' + '06',
  },
  availableIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  availableTitle: { fontSize: 15, fontWeight: '600', color: theme.textMuted, marginBottom: 4 },
  availableCategory: { fontSize: 12, color: theme.textMuted, marginBottom: 14 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
  },
  contactBtnText: { fontSize: 13, fontWeight: '600' },

  // Filled partner
  partnerLogoBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  partnerName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  partnerDescription: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 10 },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '600' },

  // Grid layouts
  gridTablet: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12 },
  bronzeGrid: {},

  // CTA
  ctaCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.xl,
    padding: 28,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: theme.primary + '20',
    ...theme.shadows.cardElevated,
  },
  ctaIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginBottom: 10, textAlign: 'center' },
  ctaDescription: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 340 },
  ctaBenefits: { gap: 8, marginBottom: 20, width: '100%' },
  ctaBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.success + '08',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  ctaBenefitText: { fontSize: 14, fontWeight: '500', color: theme.textPrimary },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    ...theme.shadows.cardElevated,
  },
  ctaButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
