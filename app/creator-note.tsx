import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

const CONTACT_EMAIL = 'ultimate.petanque.app@gmail.com';

export default function CreatorNoteScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('creatorNote', 'title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient
            colors={['#0F172A', '#1E3A5F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroIconWrap}>
              <MaterialIcons name="favorite" size={36} color="#F87171" />
            </View>
            <Text style={styles.heroTitle}>{t('creatorNote', 'heroTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('creatorNote', 'heroSubtitle')}</Text>
          </LinearGradient>
        </Animated.View>

        {/* Main Message */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="edit" size={22} color={theme.primary} />
            </View>
            <Text style={styles.cardTitle}>{t('creatorNote', 'whyTitle')}</Text>
          </View>
          <Text style={styles.cardText}>{t('creatorNote', 'whyContent')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.carreauColor + '15' }]}>
              <MaterialIcons name="sports" size={22} color={theme.carreauColor} />
            </View>
            <Text style={styles.cardTitle}>{t('creatorNote', 'forWhomTitle')}</Text>
          </View>
          <Text style={styles.cardText}>{t('creatorNote', 'forWhomContent')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.success + '15' }]}>
              <MaterialIcons name="lightbulb" size={22} color={theme.success} />
            </View>
            <Text style={styles.cardTitle}>{t('creatorNote', 'visionTitle')}</Text>
          </View>
          <Text style={styles.cardText}>{t('creatorNote', 'visionContent')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.accent + '15' }]}>
              <MaterialIcons name="volunteer-activism" size={22} color={theme.accent} />
            </View>
            <Text style={styles.cardTitle}>{t('creatorNote', 'thanksTitle')}</Text>
          </View>
          <Text style={styles.cardText}>{t('creatorNote', 'thanksContent')}</Text>
        </Animated.View>

        {/* Features Highlight */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>{t('creatorNote', 'featuresTitle')}</Text>
          {[
            { icon: 'sports', color: theme.primary, label: t('creatorNote', 'featureMatches') },
            { icon: 'emoji-events', color: theme.carreauColor, label: t('creatorNote', 'featureTournaments') },
            { icon: 'track-changes', color: theme.accent, label: t('creatorNote', 'featureChallenges') },
            { icon: 'bar-chart', color: theme.tirColor, label: t('creatorNote', 'featureStats') },
            { icon: 'people', color: theme.success, label: t('creatorNote', 'featureDirectory') },
            { icon: 'map', color: '#8B5CF6', label: t('creatorNote', 'featureMap') },
            { icon: 'event', color: theme.warning, label: t('creatorNote', 'featureMeetups') },
            { icon: 'share', color: theme.primary, label: t('creatorNote', 'featureSharing') },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: f.color + '12' }]}>
                <MaterialIcons name={f.icon as any} size={18} color={f.color} />
              </View>
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Contact */}
        <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.contactCard}>
          <View style={styles.contactIconWrap}>
            <MaterialIcons name="forum" size={28} color={theme.primary} />
          </View>
          <Text style={styles.contactTitle}>{t('creatorNote', 'contactTitle')}</Text>
          <Text style={styles.contactText}>{t('creatorNote', 'contactContent')}</Text>
          <Pressable
            style={styles.contactBtn}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Ultimate%20Petanque%20-%20Feedback`)}
          >
            <MaterialIcons name="email" size={20} color="#FFF" />
            <Text style={styles.contactBtnText}>{t('creatorNote', 'writeToUs')}</Text>
          </Pressable>
        </Animated.View>

        {/* Signature */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.signature}>
          <MaterialIcons name="favorite" size={16} color={theme.error} />
          <Text style={styles.signatureText}>{t('creatorNote', 'signature')}</Text>
        </Animated.View>

        <Text style={styles.versionText}>{t('common', 'version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0 },
  // Hero
  hero: { borderRadius: 24, padding: 28, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  heroIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(248,113,113,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(248,113,113,0.25)' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  // Cards
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  cardText: { fontSize: 15, color: theme.textSecondary, lineHeight: 24 },
  // Features
  featuresCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  featuresTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 14, color: theme.textSecondary, fontWeight: '500' },
  // Contact
  contactCard: { backgroundColor: theme.primary + '06', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: theme.primary + '15' },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  contactTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  contactText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 16 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  contactBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  // Signature
  signature: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  signatureText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, fontStyle: 'italic' },
  versionText: { fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: 8 },
});
