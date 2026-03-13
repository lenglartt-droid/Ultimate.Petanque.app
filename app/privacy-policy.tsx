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
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

const CONTACT_EMAIL = 'ultimate.petanque.app@gmail.com';
const EFFECTIVE_DATE = '2026-03-01';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();

  const sections = [
    {
      icon: 'info-outline',
      color: theme.primary,
      title: t('privacy', 'introTitle'),
      content: t('privacy', 'introContent'),
    },
    {
      icon: 'storage',
      color: theme.accent,
      title: t('privacy', 'dataCollectedTitle'),
      content: t('privacy', 'dataCollectedContent'),
    },
    {
      icon: 'settings',
      color: theme.success,
      title: t('privacy', 'dataUsageTitle'),
      content: t('privacy', 'dataUsageContent'),
    },
    {
      icon: 'share',
      color: theme.carreauColor,
      title: t('privacy', 'dataSharingTitle'),
      content: t('privacy', 'dataSharingContent'),
    },
    {
      icon: 'cloud',
      color: '#6366F1',
      title: t('privacy', 'dataStorageTitle'),
      content: t('privacy', 'dataStorageContent'),
    },
    {
      icon: 'security',
      color: theme.warning,
      title: t('privacy', 'dataSecurityTitle'),
      content: t('privacy', 'dataSecurityContent'),
    },
    {
      icon: 'person',
      color: theme.primary,
      title: t('privacy', 'userRightsTitle'),
      content: t('privacy', 'userRightsContent'),
    },
    {
      icon: 'people',
      color: theme.accent,
      title: t('privacy', 'sharingFeatureTitle'),
      content: t('privacy', 'sharingFeatureContent'),
    },
    {
      icon: 'public',
      color: theme.success,
      title: t('privacy', 'publicItemsTitle'),
      content: t('privacy', 'publicItemsContent'),
    },
    {
      icon: 'child-care',
      color: theme.success,
      title: t('privacy', 'childrenTitle'),
      content: t('privacy', 'childrenContent'),
    },
    {
      icon: 'update',
      color: theme.carreauColor,
      title: t('privacy', 'changesTitle'),
      content: t('privacy', 'changesContent'),
    },
    {
      icon: 'email',
      color: theme.primary,
      title: t('privacy', 'contactTitle'),
      content: t('privacy', 'contactContent'),
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('privacy', 'title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="policy" size={36} color={theme.primary} />
          </View>
          <Text style={styles.heroTitle}>{t('privacy', 'title')}</Text>
          <Text style={styles.heroSubtitle}>Ultimate Petanque</Text>
          <View style={styles.dateBadge}>
            <MaterialIcons name="event" size={14} color={theme.textSecondary} />
            <Text style={styles.dateText}>
              {t('privacy', 'effectiveDate')}: {EFFECTIVE_DATE}
            </Text>
          </View>
        </Animated.View>

        {/* Sections */}
        {sections.map((section, index) => (
          <Animated.View
            key={index}
            entering={FadeInDown.duration(300).delay(50 + index * 30)}
            style={styles.sectionCard}
          >
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: section.color + '15' }]}>
                <MaterialIcons name={section.icon as any} size={20} color={section.color} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionContent}>{section.content}</Text>
          </Animated.View>
        ))}

        {/* Contact CTA */}
        <View style={styles.contactSection}>
          <Text style={styles.contactLabel}>{t('privacy', 'questionsLabel')}</Text>
          <Pressable
            style={styles.contactButton}
            onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Privacy%20-%20Ultimate%20Petanque`)}
          >
            <View style={[styles.contactButtonIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="email" size={22} color={theme.primary} />
            </View>
            <View style={styles.contactButtonInfo}>
              <Text style={styles.contactButtonTitle}>{t('privacy', 'contactUs')}</Text>
              <Text style={styles.contactButtonSubtitle}>{CONTACT_EMAIL}</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={18} color={theme.primary} />
          </Pressable>
        </View>

        <Text style={styles.versionText}>{t('common', 'version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
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
  backButton: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dateText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  // Sections
  sectionCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  sectionContent: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  // Contact
  contactSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 8,
    marginBottom: 16,
  },
  contactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '08',
    borderRadius: theme.borderRadius.md,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.primary + '20',
  },
  contactButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactButtonInfo: {
    flex: 1,
  },
  contactButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  contactButtonSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  versionText: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
