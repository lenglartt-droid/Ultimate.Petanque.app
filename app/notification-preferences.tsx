import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/template';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/services/notificationPreferencesService';

interface NotifCategory {
  titleFr: string;
  titleEn: string;
  items: {
    key: keyof NotificationPreferences;
    icon: string;
    color: string;
    labelFr: string;
    labelEn: string;
    descFr: string;
    descEn: string;
  }[];
}

const NOTIF_CATEGORIES: NotifCategory[] = [
  {
    titleFr: 'Competitif & Classement',
    titleEn: 'Competitive & Ranking',
    items: [
      {
        key: 'ranking_changed',
        icon: 'leaderboard',
        color: '#D97706',
        labelFr: 'Changements de classement',
        labelEn: 'Ranking changes',
        descFr: 'Notification quand votre position dans le classement communautaire change.',
        descEn: 'Notification when your position in the community leaderboard changes.',
      },
      {
        key: 'league_promotion',
        icon: 'military-tech',
        color: '#9333EA',
        labelFr: 'Promotions de ligue',
        labelEn: 'League promotions',
        descFr: 'Soyez alerte quand vous montez ou descendez de ligue ELO (Bronze, Argent, Or...).',
        descEn: 'Get alerted when you are promoted or relegated in ELO leagues (Bronze, Silver, Gold...).',
      },
      {
        key: 'weekly_digest',
        icon: 'summarize',
        color: '#2563EB',
        labelFr: 'Bilan hebdomadaire',
        labelEn: 'Weekly digest',
        descFr: 'Resume de la semaine chaque lundi : matchs, ELO, position au classement.',
        descEn: 'Weekly summary every Monday: matches, ELO, leaderboard position.',
      },
      {
        key: 'inactivity_warning',
        icon: 'schedule',
        color: '#EF4444',
        labelFr: 'Avertissement d\'inactivite',
        labelEn: 'Inactivity warning',
        descFr: 'Alerte avant la penalite ELO d\'inactivite (perte d\'ELO apres 30 jours sans match).',
        descEn: 'Alert before ELO inactivity penalty (ELO loss after 30 days without a match).',
      },
    ],
  },
  {
    titleFr: 'Communaute & Evenements',
    titleEn: 'Community & Events',
    items: [
      {
        key: 'event_created',
        icon: 'campaign',
        color: '#7C3AED',
        labelFr: 'Defis ambassadeurs proches',
        labelEn: 'Nearby ambassador challenges',
        descFr: 'Notification quand un ambassadeur cree un evenement dans un rayon de 200km.',
        descEn: 'Get notified when an ambassador creates an event within 200km radius.',
      },
      {
        key: 'meetup_invitation',
        icon: 'event',
        color: '#10B981',
        labelFr: 'Invitations RDV',
        labelEn: 'Meetup invitations',
        descFr: 'Soyez alerte quand un joueur vous invite a un rendez-vous terrain.',
        descEn: 'Get alerted when a player invites you to a terrain meeting.',
      },
      {
        key: 'event_reminder',
        icon: 'alarm',
        color: '#F59E0B',
        labelFr: 'Rappels evenements',
        labelEn: 'Event reminders',
        descFr: 'Rappels automatiques avant les evenements sponsorises auxquels vous participez.',
        descEn: 'Automatic reminders before sponsored events you participate in.',
      },
    ],
  },
  {
    titleFr: 'Partage & Interactions',
    titleEn: 'Sharing & Interactions',
    items: [
      {
        key: 'share_request',
        icon: 'share',
        color: '#3B82F6',
        labelFr: 'Demandes de partage',
        labelEn: 'Share requests',
        descFr: 'Alerte quand un joueur vous envoie une demande de partage de match ou defi.',
        descEn: 'Alert when a player sends you a match or challenge share request.',
      },
      {
        key: 'witness_request',
        icon: 'visibility',
        color: '#F97316',
        labelFr: 'Demandes d\'attestation',
        labelEn: 'Witness requests',
        descFr: 'Notification quand un joueur vous demande d\'attester un match ou defi.',
        descEn: 'Notification when a player asks you to witness a match or challenge.',
      },
      {
        key: 'badge_unlock',
        icon: 'workspace-premium',
        color: '#EC4899',
        labelFr: 'Badges debloques',
        labelEn: 'Badge unlocks',
        descFr: 'Celebration quand vous debloquez un nouveau badge ou montez de niveau XP.',
        descEn: 'Celebration when you unlock a new badge or level up in XP.',
      },
      {
        key: 'new_follower',
        icon: 'person-add',
        color: '#EC4899',
        labelFr: 'Nouveaux abonnes',
        labelEn: 'New followers',
        descFr: 'Notification quand un joueur commence a vous suivre, avec votre nombre total d\'abonnes.',
        descEn: 'Notification when a player starts following you, with your total follower count.',
      },
    ],
  },
];

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuth();
  const fr = language === 'fr';
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadNotificationPreferences().then((p) => {
      // Strip any unknown keys from loaded prefs to prevent stale DB data
      const cleaned: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
      for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES) as (keyof NotificationPreferences)[]) {
        cleaned[key] = p[key] ?? DEFAULT_NOTIFICATION_PREFERENCES[key];
      }
      setPrefs(cleaned);
      setLoaded(true);
    });
  }, [user?.id]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    Haptics.selectionAsync();
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotificationPreferences(updated).catch(() => {});
  };

  const handleToggleAll = (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES) as (keyof NotificationPreferences)[]) {
      updated[key] = enabled;
    }
    setPrefs(updated);
    saveNotificationPreferences(updated).catch(() => {});
  };

  // Derive counts strictly from NOTIF_CATEGORIES UI items to avoid stale DB keys
  const allCategoryKeys = NOTIF_CATEGORIES.flatMap(cat => cat.items.map(i => i.key));
  const totalItems = allCategoryKeys.length;
  const enabledCount = allCategoryKeys.filter(k => prefs[k]).length;

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{fr ? 'Notifications' : 'Notifications'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(300)} style={s.hero}>
          <View style={s.heroIcon}>
            <MaterialIcons name="notifications-active" size={32} color={theme.primary} />
          </View>
          <Text style={s.heroTitle}>{fr ? 'Preferences de notifications' : 'Notification Preferences'}</Text>
          <Text style={s.heroSub}>
            {fr
              ? 'Choisissez quels types de notifications vous souhaitez recevoir. Vos preferences sont respectees cote serveur.'
              : 'Choose which notification types you want to receive. Your preferences are respected server-side.'}
          </Text>
          <View style={s.heroActions}>
            <View style={s.heroBadge}>
              <MaterialIcons name="check-circle" size={14} color={enabledCount > 0 ? theme.success : theme.textMuted} />
              <Text style={[s.heroBadgeText, enabledCount > 0 ? { color: theme.success } : { color: theme.textMuted }]}>
                {enabledCount}/{totalItems} {fr ? 'actives' : 'active'}
              </Text>
            </View>
            <Pressable
              style={[s.heroToggleAll, enabledCount === totalItems ? s.heroToggleAllDisable : s.heroToggleAllEnable]}
              onPress={() => handleToggleAll(enabledCount < totalItems)}
            >
              <MaterialIcons
                name={enabledCount === totalItems ? 'notifications-off' : 'notifications-active'}
                size={14}
                color={enabledCount === totalItems ? '#EF4444' : theme.success}
              />
              <Text style={[s.heroToggleAllText, { color: enabledCount === totalItems ? '#EF4444' : theme.success }]}>
                {enabledCount === totalItems
                  ? (fr ? 'Tout desactiver' : 'Disable all')
                  : (fr ? 'Tout activer' : 'Enable all')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Loading */}
        {!loaded ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          NOTIF_CATEGORIES.map((cat, catIdx) => (
            <Animated.View key={catIdx} entering={FadeInDown.duration(250).delay(50 + catIdx * 60)}>
              <View style={s.categoryHeader}>
                <Text style={s.categoryTitle}>{fr ? cat.titleFr : cat.titleEn}</Text>
                <View style={s.categoryCount}>
                  <Text style={s.categoryCountText}>
                    {cat.items.filter(i => prefs[i.key]).length}/{cat.items.length}
                  </Text>
                </View>
              </View>
              <View style={s.list}>
                {cat.items.map((item, idx) => (
                  <View key={item.key} style={[s.card, prefs[item.key] && { borderColor: item.color + '30' }]}>
                    <View style={s.cardTop}>
                      <View style={[s.cardIcon, { backgroundColor: item.color + '15' }]}>
                        <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                      </View>
                      <View style={s.cardInfo}>
                        <Text style={s.cardLabel}>{fr ? item.labelFr : item.labelEn}</Text>
                      </View>
                      <Switch
                        value={prefs[item.key]}
                        onValueChange={() => handleToggle(item.key)}
                        trackColor={{ false: theme.border, true: item.color + '60' }}
                        thumbColor={prefs[item.key] ? item.color : theme.textMuted}
                      />
                    </View>
                    <Text style={s.cardDesc}>{fr ? item.descFr : item.descEn}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          ))
        )}

        {/* Info note */}
        <View style={s.infoBox}>
          <MaterialIcons name="info-outline" size={18} color={theme.textMuted} />
          <Text style={s.infoText}>
            {fr
              ? 'Vos tokens push sont automatiquement desactives lors de la deconnexion. Les notifications ne seront plus envoyees jusqu\'a la prochaine connexion.'
              : 'Your push tokens are automatically deactivated on logout. Notifications will not be sent until your next login.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Hero
  hero: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 }, default: {} }),
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  heroSub: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 14 },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroBadgeText: { fontSize: 13, fontWeight: '600' },
  heroToggleAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  heroToggleAllEnable: {
    backgroundColor: theme.success + '08',
    borderColor: theme.success + '30',
  },
  heroToggleAllDisable: {
    backgroundColor: '#EF444408',
    borderColor: '#EF444430',
  },
  heroToggleAllText: { fontSize: 12, fontWeight: '600' },

  // Category
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: 0.3,
  },
  categoryCount: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
  },

  // Loading
  loadingBox: { paddingVertical: 48, alignItems: 'center' },

  // List
  list: { gap: 8, marginBottom: 20 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  cardDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginLeft: 52 },

  // Info
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 18 },
});
