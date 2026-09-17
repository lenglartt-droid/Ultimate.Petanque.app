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
  PROXIMITY_RADIUS_OPTIONS,
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/services/notificationPreferencesService';
import {
  DisplayTimezoneMode,
  DisplayTimezonePrefs,
  loadDisplayTimezonePrefs,
  saveDisplayTimezonePrefs,
  getDeviceTimezone,
  shortTimezoneLabel,
  COMMON_TIMEZONES,
} from '@/services/timezoneService';
import { Modal, FlatList, TextInput } from 'react-native';

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
  hasRadiusSetting?: boolean;
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
    titleFr: 'Communaute et Evenements',
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
        key: 'event_reminder',
        icon: 'alarm',
        color: '#F59E0B',
        labelFr: 'Rappels evenements',
        labelEn: 'Event reminders',
        descFr: 'Rappels automatiques avant les evenements sponsorises auxquels vous participez.',
        descEn: 'Automatic reminders before sponsored events you participate in.',
      },
      {
        key: 'meetup_invitation',
        icon: 'event',
        color: '#10B981',
        labelFr: 'Invitations RDV terrain',
        labelEn: 'Terrain meetup invitations',
        descFr: 'Soyez alerte quand un joueur vous invite a un rendez-vous terrain.',
        descEn: 'Get alerted when a player invites you to a terrain meeting.',
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
  {
    titleFr: 'Carte & Proximite',
    titleEn: 'Map & Proximity',
    hasRadiusSetting: true,
    items: [
      {
        key: 'terrain_proximity',
        icon: 'near-me',
        color: '#22C55E',
        labelFr: 'Alerte terrain a proximite',
        labelEn: 'Nearby terrain alert',
        descFr: 'Alerte quand vous etes a proximite d\'un terrain ou des joueurs jouent habituellement a cette heure.',
        descEn: 'Alert when you are near a terrain where players usually play at this time.',
      },
      {
        key: 'terrain_activity',
        icon: 'local-fire-department',
        color: '#EF4444',
        labelFr: 'Terrains favoris actifs',
        labelEn: 'Favorite terrains active',
        descFr: 'Notification quand un de vos terrains favoris a un RDV, tournoi ou partie en cours.',
        descEn: 'Notification when one of your favorite terrains has an ongoing meetup, tournament, or game.',
      },
    ],
  },
  {
    titleFr: 'Club',
    titleEn: 'Club',
    items: [
      {
        key: 'club_invitation',
        icon: 'mail',
        color: '#7C3AED',
        labelFr: 'Invitations club',
        labelEn: 'Club invitations',
        descFr: 'Notification quand un club vous invite a le rejoindre.',
        descEn: 'Notification when a club invites you to join.',
      },
      {
        key: 'club_invitation_reminder',
        icon: 'notifications',
        color: '#F59E0B',
        labelFr: 'Rappels d\'invitation',
        labelEn: 'Invitation reminders',
        descFr: 'Rappels automatiques a 7 et 21 jours pour les invitations club en attente.',
        descEn: 'Automatic reminders at 7 and 21 days for pending club invitations.',
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

  // Display timezone preferences (facility TZ reference for schedule display)
  const [tzPrefs, setTzPrefs] = useState<DisplayTimezonePrefs>({ mode: 'auto', customTimezone: null });
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [tzSearch, setTzSearch] = useState('');
  const deviceTz = getDeviceTimezone();

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
    loadDisplayTimezonePrefs().then(setTzPrefs);
  }, [user?.id]);

  const handleTzModeChange = (mode: DisplayTimezoneMode) => {
    Haptics.selectionAsync();
    const updated: DisplayTimezonePrefs = {
      mode,
      customTimezone: mode === 'custom' ? (tzPrefs.customTimezone || deviceTz) : null,
    };
    setTzPrefs(updated);
    saveDisplayTimezonePrefs(updated).catch(() => {});
    if (mode === 'custom' && !tzPrefs.customTimezone) {
      setShowTzPicker(true);
    }
  };

  const handlePickCustomTz = (tz: string) => {
    Haptics.selectionAsync();
    const updated: DisplayTimezonePrefs = { mode: 'custom', customTimezone: tz };
    setTzPrefs(updated);
    saveDisplayTimezonePrefs(updated).catch(() => {});
    setShowTzPicker(false);
    setTzSearch('');
  };

  const filteredTzList = React.useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return COMMON_TIMEZONES;
    return COMMON_TIMEZONES
      .map(group => ({ ...group, zones: group.zones.filter(z => z.toLowerCase().includes(q)) }))
      .filter(group => group.zones.length > 0);
  }, [tzSearch]);

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
      if (typeof DEFAULT_NOTIFICATION_PREFERENCES[key] === 'boolean') {
        (updated as any)[key] = enabled;
      }
    }
    // Preserve non-boolean settings
    updated.terrain_proximity_radius = prefs.terrain_proximity_radius;
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

        {/* Timezone display settings */}
        {loaded ? (
          <Animated.View entering={FadeInDown.duration(250)} style={s.tzSection}>
            <View style={s.tzHeader}>
              <View style={s.tzHeaderIcon}>
                <MaterialIcons name="public" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.tzTitle}>{fr ? 'Fuseau horaire de reference' : 'Reference timezone'}</Text>
                <Text style={s.tzSub}>
                  {fr
                    ? 'Comment afficher les horaires (RDV, tournois, evenements) lorsque le terrain est dans un autre fuseau'
                    : 'How to display schedules (meetups, tournaments, events) when the venue is in a different timezone'}
                </Text>
              </View>
            </View>
            <View style={s.tzModes}>
              {([
                { id: 'auto' as const, icon: 'auto-mode', labelFr: 'Automatique', labelEn: 'Automatic', descFr: 'Utilise le fuseau du terrain, sinon celui du telephone', descEn: 'Use venue timezone, else device timezone' },
                { id: 'terrain' as const, icon: 'place', labelFr: 'Terrain', labelEn: 'Venue', descFr: 'Toujours utiliser le fuseau du terrain', descEn: 'Always use the venue timezone' },
                { id: 'custom' as const, icon: 'tune', labelFr: 'Personnalise', labelEn: 'Custom', descFr: 'Choisir un fuseau IANA precis', descEn: 'Pick a specific IANA timezone' },
              ]).map(opt => {
                const isActive = tzPrefs.mode === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[s.tzMode, isActive && s.tzModeActive]}
                    onPress={() => handleTzModeChange(opt.id)}
                  >
                    <View style={[s.tzModeIcon, isActive && { backgroundColor: '#7C3AED' }]}>
                      <MaterialIcons name={opt.icon as any} size={16} color={isActive ? '#FFF' : '#7C3AED'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.tzModeLabel, isActive && { color: '#7C3AED' }]}>{fr ? opt.labelFr : opt.labelEn}</Text>
                      <Text style={s.tzModeDesc}>{fr ? opt.descFr : opt.descEn}</Text>
                    </View>
                    {isActive ? <MaterialIcons name="check-circle" size={18} color="#7C3AED" /> : <View style={s.tzModeRadio} />}
                  </Pressable>
                );
              })}
            </View>
            {tzPrefs.mode === 'custom' ? (
              <Pressable style={s.tzCustomRow} onPress={() => setShowTzPicker(true)}>
                <MaterialIcons name="schedule" size={16} color="#7C3AED" />
                <View style={{ flex: 1 }}>
                  <Text style={s.tzCustomLabel}>{fr ? 'Fuseau selectionne' : 'Selected timezone'}</Text>
                  <Text style={s.tzCustomValue} numberOfLines={1}>
                    {tzPrefs.customTimezone || (fr ? 'Non defini' : 'Not set')}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color="#7C3AED" />
              </Pressable>
            ) : null}
            <View style={s.tzHint}>
              <MaterialIcons name="info-outline" size={12} color={theme.textMuted} />
              <Text style={s.tzHintText}>
                {fr
                  ? `Fuseau de l'appareil actuel : ${shortTimezoneLabel(deviceTz)} (${deviceTz})`
                  : `Current device timezone: ${shortTimezoneLabel(deviceTz)} (${deviceTz})`}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Display timezone preferences per surface (chat / match cards) */}
        {loaded ? (
          <Animated.View entering={FadeInDown.duration(250).delay(30)} style={s.displaySection}>
            <View style={s.displayHeader}>
              <View style={s.displayHeaderIcon}>
                <MaterialIcons name="visibility" size={20} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.displayTitle}>{fr ? 'Affichage des horaires' : 'Time display'}</Text>
                <Text style={s.displaySub}>
                  {fr
                    ? 'Basculer certaines surfaces sur l\'heure de votre appareil au lieu du terrain'
                    : 'Switch certain surfaces to your device time instead of the venue timezone'}
                </Text>
              </View>
            </View>
            <View style={s.displayRow}>
              <View style={s.displayRowIcon}>
                <MaterialIcons name="chat-bubble-outline" size={18} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.displayRowLabel}>{fr ? 'Chat des RDV' : 'Meetup chat'}</Text>
                <Text style={s.displayRowDesc}>
                  {prefs.chat_display_device_time
                    ? (fr ? 'Timestamps affiches en heure locale de votre appareil' : 'Timestamps shown in your device local time')
                    : (fr ? 'Timestamps affiches dans le fuseau du terrain' : 'Timestamps shown in the venue timezone')}
                </Text>
              </View>
              <Switch
                value={prefs.chat_display_device_time}
                onValueChange={() => handleToggle('chat_display_device_time')}
                trackColor={{ false: theme.border, true: theme.primary + '60' }}
                thumbColor={prefs.chat_display_device_time ? theme.primary : theme.textMuted}
              />
            </View>
            <View style={s.displayRowBorder} />
            <View style={s.displayRow}>
              <View style={[s.displayRowIcon, { backgroundColor: theme.accent + '12' }]}>
                <MaterialIcons name="sports" size={18} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.displayRowLabel}>{fr ? 'Cartes matchs (Historique)' : 'Match cards (History)'}</Text>
                <Text style={s.displayRowDesc}>
                  {prefs.match_card_display_device_time
                    ? (fr ? 'Heure de fin de match dans le fuseau de votre appareil' : 'Match time in your device timezone')
                    : (fr ? 'Heure de fin de match dans le fuseau du terrain' : 'Match time in the venue timezone')}
                </Text>
              </View>
              <Switch
                value={prefs.match_card_display_device_time}
                onValueChange={() => handleToggle('match_card_display_device_time')}
                trackColor={{ false: theme.border, true: theme.accent + '60' }}
                thumbColor={prefs.match_card_display_device_time ? theme.accent : theme.textMuted}
              />
            </View>
          </Animated.View>
        ) : null}

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
                        value={prefs[item.key] as boolean}
                        onValueChange={() => handleToggle(item.key)}
                        trackColor={{ false: theme.border, true: item.color + '60' }}
                        thumbColor={prefs[item.key] ? item.color : theme.textMuted}
                      />
                    </View>
                    <Text style={s.cardDesc}>{fr ? item.descFr : item.descEn}</Text>
                  </View>
                ))}
                {/* Radius setting for Map & Proximity */}
                {cat.hasRadiusSetting && prefs.terrain_proximity ? (
                  <View style={[s.card, { borderColor: '#22C55E30' }]}>
                    <View style={s.cardTop}>
                      <View style={[s.cardIcon, { backgroundColor: '#22C55E15' }]}>
                        <MaterialIcons name="radar" size={20} color="#22C55E" />
                      </View>
                      <View style={s.cardInfo}>
                        <Text style={s.cardLabel}>{fr ? 'Rayon de detection' : 'Detection radius'}</Text>
                      </View>
                    </View>
                    <Text style={s.cardDesc}>{fr ? 'Distance maximale pour detecter les terrains actifs a proximite.' : 'Maximum distance to detect nearby active terrains.'}</Text>
                    <View style={s.radiusRow}>
                      {PROXIMITY_RADIUS_OPTIONS.map(opt => {
                        const isActive = prefs.terrain_proximity_radius === opt.value;
                        return (
                          <Pressable
                            key={opt.value}
                            style={[s.radiusChip, isActive && s.radiusChipActive]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              const updated = { ...prefs, terrain_proximity_radius: opt.value };
                              setPrefs(updated);
                              saveNotificationPreferences(updated).catch(() => {});
                            }}
                          >
                            <Text style={[s.radiusChipText, isActive && s.radiusChipTextActive]}>
                              {fr ? opt.labelFr : opt.labelEn}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
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

      {/* Custom timezone picker modal */}
      <Modal visible={showTzPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTzPicker(false)}>
        <SafeAreaView edges={['top']} style={s.tzModal}>
          <View style={s.tzModalHeader}>
            <Text style={s.tzModalTitle}>{fr ? 'Choisir un fuseau' : 'Choose a timezone'}</Text>
            <Pressable style={s.tzModalClose} onPress={() => { setShowTzPicker(false); setTzSearch(''); }}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <View style={s.tzSearchBar}>
            <MaterialIcons name="search" size={18} color={theme.textMuted} />
            <TextInput
              style={s.tzSearchInput}
              value={tzSearch}
              onChangeText={setTzSearch}
              placeholder={fr ? 'Rechercher (Paris, Tokyo...)' : 'Search (Paris, Tokyo...)'}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {tzSearch.length > 0 ? (
              <Pressable onPress={() => setTzSearch('')} hitSlop={8}>
                <MaterialIcons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <FlatList
            data={filteredTzList}
            keyExtractor={(g) => g.region}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <MaterialIcons name="search-off" size={40} color={theme.textMuted} />
                <Text style={{ fontSize: 14, color: theme.textMuted, marginTop: 8 }}>
                  {fr ? 'Aucun fuseau trouve' : 'No timezone found'}
                </Text>
              </View>
            }
            renderItem={({ item: group }) => (
              <View style={{ marginBottom: 16 }}>
                <Text style={s.tzGroupTitle}>{group.region}</Text>
                {group.zones.map(tz => {
                  const isActive = tzPrefs.customTimezone === tz;
                  return (
                    <Pressable
                      key={tz}
                      style={[s.tzOption, isActive && s.tzOptionActive]}
                      onPress={() => handlePickCustomTz(tz)}
                    >
                      <View style={s.tzOptionMain}>
                        <Text style={[s.tzOptionName, isActive && { color: '#7C3AED' }]}>{shortTimezoneLabel(tz)}</Text>
                        <Text style={s.tzOptionZone}>{tz}</Text>
                      </View>
                      {isActive ? <MaterialIcons name="check-circle" size={20} color="#7C3AED" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
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

  // Radius setting
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginLeft: 52,
  },
  radiusChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  radiusChipActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  radiusChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  radiusChipTextActive: {
    color: '#FFF',
  },

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

  // Timezone section
  tzSection: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#7C3AED20',
  },
  tzHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  tzHeaderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#7C3AED12', alignItems: 'center', justifyContent: 'center' },
  tzTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  tzSub: { fontSize: 12, color: theme.textMuted, marginTop: 3, lineHeight: 16 },
  tzModes: { gap: 8 },
  tzMode: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: 'transparent' },
  tzModeActive: { borderColor: '#7C3AED', backgroundColor: '#7C3AED06' },
  tzModeIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#7C3AED15', alignItems: 'center', justifyContent: 'center' },
  tzModeLabel: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  tzModeDesc: { fontSize: 11, color: theme.textMuted, marginTop: 2, lineHeight: 15 },
  tzModeRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.border },
  tzCustomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: '#7C3AED08', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#7C3AED25' },
  tzCustomLabel: { fontSize: 10, fontWeight: '700', color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 0.5 },
  tzCustomValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginTop: 1 },
  tzHint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  tzHintText: { fontSize: 10, color: theme.textMuted, fontStyle: 'italic', flex: 1 },

  // Timezone picker modal
  tzModal: { flex: 1, backgroundColor: theme.backgroundSecondary },
  tzModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  tzModalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  tzModalClose: { padding: 8 },
  tzSearchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  tzSearchInput: { flex: 1, fontSize: 14, color: theme.textPrimary, padding: 0 },
  tzGroupTitle: { fontSize: 11, fontWeight: '800', color: theme.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  tzOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: 'transparent' },
  tzOptionActive: { borderColor: '#7C3AED', backgroundColor: '#7C3AED06' },
  tzOptionMain: { flex: 1 },
  tzOptionName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  tzOptionZone: { fontSize: 11, color: theme.textMuted, marginTop: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Display preferences (chat / match cards)
  displaySection: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#3B82F620' },
  displayHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  displayHeaderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#3B82F612', alignItems: 'center', justifyContent: 'center' },
  displayTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  displaySub: { fontSize: 12, color: theme.textMuted, marginTop: 3, lineHeight: 16 },
  displayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  displayRowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' },
  displayRowLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  displayRowDesc: { fontSize: 11, color: theme.textMuted, marginTop: 2, lineHeight: 15 },
  displayRowBorder: { height: 1, backgroundColor: theme.border, marginHorizontal: -4, marginVertical: 4 },
});
