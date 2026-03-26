import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
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

const NOTIF_ITEMS: {
  key: keyof NotificationPreferences;
  icon: string;
  color: string;
  labelFr: string;
  labelEn: string;
  descFr: string;
  descEn: string;
}[] = [
  {
    key: 'event_created',
    icon: 'campaign',
    color: '#7C3AED',
    labelFr: 'Defis ambassadeurs proches',
    labelEn: 'Nearby ambassador challenges',
    descFr: 'Recevez une notification quand un ambassadeur cree un evenement dans un rayon de 200km.',
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
    key: 'ranking_changed',
    icon: 'leaderboard',
    color: '#D97706',
    labelFr: 'Changements de classement',
    labelEn: 'Ranking changes',
    descFr: 'Notification quand votre position dans le classement communautaire change.',
    descEn: 'Notification when your position in the community leaderboard changes.',
  },
  {
    key: 'share_request',
    icon: 'share',
    color: '#2563EB',
    labelFr: 'Demandes de partage',
    labelEn: 'Share requests',
    descFr: 'Alerte quand un joueur vous envoie une demande de partage de match ou defi.',
    descEn: 'Alert when a player sends you a match or challenge share request.',
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
];

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadNotificationPreferences().then((p) => {
      setPrefs(p);
      setLoaded(true);
    });
  }, [user?.id]);

  const handleToggle = (key: keyof NotificationPreferences) => {
    Haptics.selectionAsync();
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    saveNotificationPreferences(updated).catch(() => {});
  };

  const enabledCount = Object.values(prefs).filter(Boolean).length;

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>
          {language === 'fr' ? 'Preferences de notifications' : 'Notification Preferences'}
        </Text>
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
          <Text style={s.heroTitle}>
            {language === 'fr' ? 'Notifications push' : 'Push Notifications'}
          </Text>
          <Text style={s.heroSub}>
            {language === 'fr'
              ? 'Choisissez quels types de notifications vous souhaitez recevoir. Vos preferences sont respectees cote serveur.'
              : 'Choose which notification types you want to receive. Your preferences are respected server-side.'}
          </Text>
          <View style={s.heroBadge}>
            <MaterialIcons name="check-circle" size={14} color={enabledCount > 0 ? theme.success : theme.textMuted} />
            <Text style={[s.heroBadgeText, enabledCount > 0 ? { color: theme.success } : { color: theme.textMuted }]}>
              {enabledCount}/{NOTIF_ITEMS.length} {language === 'fr' ? 'actives' : 'active'}
            </Text>
          </View>
        </Animated.View>

        {/* Loading */}
        {!loaded ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={s.list}>
            {NOTIF_ITEMS.map((item, idx) => (
              <Animated.View
                key={item.key}
                entering={FadeInDown.duration(250).delay(50 + idx * 40)}
              >
                <View style={[s.card, prefs[item.key] && { borderColor: item.color + '30' }]}>
                  <View style={s.cardTop}>
                    <View style={[s.cardIcon, { backgroundColor: item.color + '15' }]}>
                      <MaterialIcons name={item.icon as any} size={22} color={item.color} />
                    </View>
                    <View style={s.cardInfo}>
                      <Text style={s.cardLabel}>
                        {language === 'fr' ? item.labelFr : item.labelEn}
                      </Text>
                    </View>
                    <Switch
                      value={prefs[item.key]}
                      onValueChange={() => handleToggle(item.key)}
                      trackColor={{ false: theme.border, true: item.color + '60' }}
                      thumbColor={prefs[item.key] ? item.color : theme.textMuted}
                    />
                  </View>
                  <Text style={s.cardDesc}>
                    {language === 'fr' ? item.descFr : item.descEn}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Info note */}
        <View style={s.infoBox}>
          <MaterialIcons name="info-outline" size={18} color={theme.textMuted} />
          <Text style={s.infoText}>
            {language === 'fr'
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
    borderRadius: theme.borderRadius.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadows.card,
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
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  heroBadgeText: { fontSize: 13, fontWeight: '600' },

  // Loading
  loadingBox: { paddingVertical: 48, alignItems: 'center' },

  // List
  list: { gap: 10, marginBottom: 20 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  cardIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  cardDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginLeft: 54 },

  // Info
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 18 },
});
