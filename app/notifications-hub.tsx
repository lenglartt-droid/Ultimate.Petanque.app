import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  Linking,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useApp } from '@/contexts/AppContext';
import {
  requestNotificationPermissions,
  areNotificationsEnabled,
  getAllScheduledNotifications,
  cancelTournamentNotifications,
  cancelAllNotifications,
} from '@/services/notificationService';
import {
  getReceivedShareRequests,
  acceptShareRequest,
  declineShareRequest,
  markShareRequestsSeen,
  MatchShareRequest,
} from '@/services/matchShareService';
import { respondToWitnessRequest } from '@/services/trustScoreService';
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '@/services/notificationPreferencesService';
import {
  getPendingInvitations,
  respondToMeetup,
  scheduleMeetupNotifications,
  cancelAllMeetupReminders,
  PendingInvitation,
  MeetupReminderSettings,
} from '@/services/meetupService';

type TabKey = 'invitations' | 'witness' | 'tournaments' | 'preferences';

const TABS: { key: TabKey; iconFr: string; labelFr: string; labelEn: string; icon: string; color: string }[] = [
  { key: 'invitations', iconFr: 'mail', labelFr: 'Invitations', labelEn: 'Invitations', icon: 'mail', color: theme.primary },
  { key: 'witness', iconFr: 'visibility', labelFr: 'Attestations', labelEn: 'Attestations', icon: 'visibility', color: '#7C3AED' },
  { key: 'tournaments', iconFr: 'emoji-events', labelFr: 'Tournois', labelEn: 'Tournaments', icon: 'emoji-events', color: theme.carreauColor },
  { key: 'preferences', iconFr: 'tune', labelFr: 'Preferences', labelEn: 'Preferences', icon: 'tune', color: theme.accent },
];

// ============ Notification Preferences items ============
const NOTIF_ITEMS: { key: keyof NotificationPreferences; icon: string; color: string; labelFr: string; labelEn: string; descFr: string; descEn: string }[] = [
  { key: 'event_created', icon: 'campaign', color: '#7C3AED', labelFr: 'Defis ambassadeurs proches', labelEn: 'Nearby ambassador challenges', descFr: 'Notification quand un ambassadeur cree un evenement dans un rayon de 200km.', descEn: 'Get notified when an ambassador creates an event within 200km.' },
  { key: 'meetup_invitation', icon: 'event', color: '#10B981', labelFr: 'Invitations RDV', labelEn: 'Meetup invitations', descFr: 'Alerte quand un joueur vous invite a un rendez-vous terrain.', descEn: 'Alert when a player invites you to a terrain meeting.' },
  { key: 'ranking_changed', icon: 'leaderboard', color: '#D97706', labelFr: 'Changements de classement', labelEn: 'Ranking changes', descFr: 'Notification quand votre position dans le classement change.', descEn: 'Notification when your leaderboard position changes.' },
  { key: 'share_request', icon: 'share', color: '#2563EB', labelFr: 'Demandes de partage', labelEn: 'Share requests', descFr: 'Alerte quand un joueur vous envoie une demande de partage.', descEn: 'Alert when a player sends you a share request.' },
  { key: 'event_reminder', icon: 'alarm', color: '#F59E0B', labelFr: 'Rappels evenements', labelEn: 'Event reminders', descFr: 'Rappels automatiques avant les evenements sponsorises.', descEn: 'Automatic reminders before sponsored events.' },
];

interface WitnessInvitation {
  id: string;
  matchId: string;
  requesterUserId: string;
  requesterName: string;
  status: string;
  createdAt: string;
  matchTeamA?: string;
  matchTeamB?: string;
  matchScoreA?: number;
  matchScoreB?: number;
  matchDate?: string;
}

export default function NotificationsHubScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ tab?: string }>();
  const fr = language === 'fr';
  const { tournaments, tournamentNotifications, toggleTournamentNotification, isTournamentNotificationEnabled } = useApp();

  const [activeTab, setActiveTab] = useState<TabKey>((params.tab as TabKey) || 'invitations');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- INVITATIONS (match share requests + meetup invitations) ----
  const [matchRequests, setMatchRequests] = useState<MatchShareRequest[]>([]);
  const [meetupInvitations, setMeetupInvitations] = useState<PendingInvitation[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // ---- WITNESS ----
  const [witnessInvitations, setWitnessInvitations] = useState<WitnessInvitation[]>([]);
  const [respondingWitnessId, setRespondingWitnessId] = useState<string | null>(null);

  // ---- TOURNAMENTS ----
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied'>('denied');
  const [scheduledCount, setScheduledCount] = useState(0);

  // ---- PREFERENCES ----
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Badge counts
  const pendingMatchCount = matchRequests.filter(r => r.status === 'pending').length;
  const pendingMeetupCount = meetupInvitations.length;
  const pendingWitnessCount = witnessInvitations.filter(i => i.status === 'pending').length;

  const tabBadges: Record<TabKey, number> = {
    invitations: pendingMatchCount + pendingMeetupCount,
    witness: pendingWitnessCount,
    tournaments: 0,
    preferences: 0,
  };

  // ============ FILTER STATE ============
  const [invFilter, setInvFilter] = useState('all');
  const [witnessFilter, setWitnessFilter] = useState('all');
  const [tournamentFilter, setTournamentFilter] = useState('all');

  // Reset filters when switching tabs
  const handleTabChange = useCallback((key: TabKey) => {
    Haptics.selectionAsync();
    setActiveTab(key);
    setInvFilter('all');
    setWitnessFilter('all');
    setTournamentFilter('all');
  }, []);

  const isWithinDays = useCallback((dateStr: string, days: number) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = Math.abs(d.getTime() - now.getTime());
    return diffMs <= days * 86400000;
  }, []);

  // Filtered invitations
  const filteredMatchRequests = useMemo(() => {
    if (invFilter === 'meetups') return [];
    let items = matchRequests;
    if (invFilter === 'pending') items = items.filter(r => r.status === 'pending');
    if (invFilter === 'thisWeek') items = items.filter(r => isWithinDays(r.createdAt, 7));
    return items;
  }, [matchRequests, invFilter, isWithinDays]);

  const filteredMeetupInvitations = useMemo(() => {
    if (invFilter === 'matches') return [];
    let items = meetupInvitations;
    if (invFilter === 'thisWeek') items = items.filter(i => isWithinDays(i.date, 7));
    return items;
  }, [meetupInvitations, invFilter, isWithinDays]);

  // Filtered witness
  const filteredWitnessInvitations = useMemo(() => {
    let items = witnessInvitations;
    if (witnessFilter === 'pending') items = items.filter(i => i.status === 'pending');
    if (witnessFilter === 'attested') items = items.filter(i => i.status === 'attested');
    if (witnessFilter === 'declined') items = items.filter(i => i.status === 'declined');
    if (witnessFilter === 'thisWeek') items = items.filter(i => isWithinDays(i.createdAt, 7));
    return items;
  }, [witnessInvitations, witnessFilter, isWithinDays]);

  // ============ LOAD DATA ============
  const loadAllData = useCallback(async () => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();

    try {
      // Match invitations
      const { requests } = await getReceivedShareRequests();
      setMatchRequests(requests);
      if (requests.length > 0) markShareRequestsSeen(requests.map(r => r.id));

      // Meetup invitations
      const { invitations: meetups } = await getPendingInvitations();
      setMeetupInvitations(meetups);

      // Witness invitations
      const { data: wData } = await supabase
        .from('match_witness_requests')
        .select('*')
        .eq('witness_user_id', user.id)
        .order('created_at', { ascending: false });

      const enriched: WitnessInvitation[] = [];
      for (const row of wData || []) {
        let requesterName = row.witness_name || '';
        let matchTeamA = '', matchTeamB = '', matchScoreA = 0, matchScoreB = 0, matchDate = '';
        try {
          const { data: profile } = await supabase.from('user_profiles').select('username').eq('id', row.requester_user_id).single();
          if (profile?.username) requesterName = profile.username;
        } catch {}
        try {
          const { data: match } = await supabase.from('matches').select('date, team_a, team_b').eq('id', row.match_id).single();
          if (match) {
            matchDate = match.date;
            const ta = typeof match.team_a === 'string' ? JSON.parse(match.team_a) : match.team_a;
            const tb = typeof match.team_b === 'string' ? JSON.parse(match.team_b) : match.team_b;
            matchTeamA = (ta?.playerNames || []).join(', ') || 'Team A';
            matchTeamB = (tb?.playerNames || []).join(', ') || 'Team B';
            matchScoreA = ta?.score || 0;
            matchScoreB = tb?.score || 0;
          }
        } catch {}
        enriched.push({ id: row.id, matchId: row.match_id, requesterUserId: row.requester_user_id, requesterName, status: row.status, createdAt: row.created_at, matchTeamA, matchTeamB, matchScoreA, matchScoreB, matchDate });
      }
      setWitnessInvitations(enriched);

      // Tournament notification status
      const enabled = await areNotificationsEnabled();
      setPermissionStatus(enabled ? 'granted' : 'denied');
      const scheduled = await getAllScheduledNotifications();
      setScheduledCount(scheduled.length);

      // Preferences
      const prefs = await loadNotificationPreferences();
      setNotifPrefs(prefs);
      setPrefsLoaded(true);
    } catch (e) {
      console.log('Error loading notifications hub:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  // ============ MATCH INVITATION HANDLERS ============
  const handleAcceptMatch = useCallback(async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProcessingIds(prev => new Set(prev).add(id));
    const { error } = await acceptShareRequest(id);
    if (!error) setMatchRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'accepted' } : r));
    setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  const handleDeclineMatch = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessingIds(prev => new Set(prev).add(id));
    const { error } = await declineShareRequest(id);
    if (!error) setMatchRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'declined' } : r));
    setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }, []);

  // ============ MEETUP HANDLERS ============
  const handleRespondMeetup = useCallback(async (inv: PendingInvitation, status: 'accepted' | 'declined') => {
    setProcessingIds(prev => new Set(prev).add(inv.meetupId));
    const { error } = await respondToMeetup(inv.meetupId, status);
    setProcessingIds(prev => { const n = new Set(prev); n.delete(inv.meetupId); return n; });
    if (error) { showAlert(t('common', 'error'), error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMeetupInvitations(prev => prev.filter(i => i.meetupId !== inv.meetupId));
  }, [t, showAlert]);

  // ============ WITNESS HANDLERS ============
  const handleRespondWitness = useCallback(async (invitationId: string, response: 'attested' | 'declined') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRespondingWitnessId(invitationId);
    const { error } = await respondToWitnessRequest(invitationId, response);
    setRespondingWitnessId(null);
    if (error) { showAlert(t('common', 'error'), error); return; }
    setWitnessInvitations(prev => prev.map(inv => inv.id === invitationId ? { ...inv, status: response } : inv));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(t('common', 'success'), response === 'attested' ? (fr ? 'Match atteste (2.0x)' : 'Match attested (2.0x)') : (fr ? 'Demande refusee' : 'Request declined'));
  }, [showAlert, t, fr]);

  // ============ TOURNAMENT HANDLERS ============
  const tournamentsWithNotifs = useMemo(() => tournaments.filter(t => isTournamentNotificationEnabled(t.id)), [tournaments, tournamentNotifications]);
  const handleDisableTournamentNotif = useCallback(async (tid: string, name: string) => {
    Alert.alert(fr ? 'Desactiver les rappels ?' : 'Disable reminders?', `"${name}"`, [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: fr ? 'Desactiver' : 'Disable', style: 'destructive', onPress: async () => {
        await cancelTournamentNotifications(tid);
        toggleTournamentNotification(tid);
        const scheduled = await getAllScheduledNotifications();
        setScheduledCount(scheduled.length);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }},
    ]);
  }, [fr, t, toggleTournamentNotification]);

  // ============ PREFERENCE HANDLERS ============
  const handleTogglePref = useCallback((key: keyof NotificationPreferences) => {
    Haptics.selectionAsync();
    setNotifPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      saveNotificationPreferences(updated).catch(() => {});
      return updated;
    });
  }, []);

  const enabledPrefCount = Object.values(notifPrefs).filter(Boolean).length;

  const getDaysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} /></Pressable>
          <Text style={s.headerTitle}>{fr ? 'Notifications' : 'Notifications'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} /></Pressable>
        <Text style={s.headerTitle}>{fr ? 'Notifications' : 'Notifications'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const badge = tabBadges[tab.key];
          return (
            <Pressable key={tab.key} style={[s.tab, isActive && { borderBottomColor: tab.color, backgroundColor: tab.color + '08' }]} onPress={() => handleTabChange(tab.key)}>
              <MaterialIcons name={tab.icon as any} size={18} color={isActive ? tab.color : theme.textMuted} />
              <Text style={[s.tabLabel, isActive && { color: tab.color, fontWeight: '700' }]}>{fr ? tab.labelFr : tab.labelEn}</Text>
              {badge > 0 ? <View style={[s.tabBadge, { backgroundColor: tab.color }]}><Text style={s.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >

        {/* ============ TAB: INVITATIONS ============ */}
        {activeTab === 'invitations' ? (
          <View>
            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBar}>
              {[
                { key: 'all', labelFr: 'Tout', labelEn: 'All', icon: 'list' },
                { key: 'pending', labelFr: 'En attente', labelEn: 'Pending', icon: 'schedule' },
                { key: 'matches', labelFr: 'Matchs', labelEn: 'Matches', icon: 'sports' },
                { key: 'meetups', labelFr: 'RDV', labelEn: 'Meetups', icon: 'event' },
                { key: 'thisWeek', labelFr: 'Cette semaine', labelEn: 'This week', icon: 'date-range' },
              ].map(f => (
                <Pressable key={f.key} style={[s.filterChip, invFilter === f.key && s.filterChipActive]} onPress={() => { Haptics.selectionAsync(); setInvFilter(f.key); }}>
                  <MaterialIcons name={f.icon as any} size={13} color={invFilter === f.key ? '#FFF' : theme.textSecondary} />
                  <Text style={[s.filterChipText, invFilter === f.key && s.filterChipTextActive]}>{fr ? f.labelFr : f.labelEn}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Match Invitations */}
            {filteredMatchRequests.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{fr ? 'MATCHS & DEFIS' : 'MATCHES & CHALLENGES'}</Text>
                {filteredMatchRequests.map((req, i) => {
                  const isPending = req.status === 'pending';
                  const isProcessing = processingIds.has(req.id);
                  const isMatch = req.itemType === 'match';
                  return (
                    <Animated.View key={req.id} entering={FadeInDown.duration(300).delay(i * 40)}>
                      <View style={[s.invCard, req.status === 'accepted' && { borderColor: theme.success + '30' }, req.status === 'declined' && { opacity: 0.6 }]}>
                        <View style={s.invCardHeader}>
                          <View style={[s.invCardIcon, { backgroundColor: (isMatch ? theme.primary : theme.accent) + '15' }]}>
                            <MaterialIcons name={isMatch ? 'sports' : 'gps-fixed'} size={20} color={isMatch ? theme.primary : theme.accent} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.invCardType}>{isMatch ? (fr ? 'Match partage' : 'Shared match') : (fr ? 'Defi partage' : 'Shared challenge')}</Text>
                            <Text style={s.invCardDate}>{new Date(req.createdAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                          <View style={[s.invPermBadge, { backgroundColor: (req.permission === 'write' ? theme.accent : theme.primary) + '15' }]}>
                            <MaterialIcons name={req.permission === 'write' ? 'edit' : 'visibility'} size={10} color={req.permission === 'write' ? theme.accent : theme.primary} />
                            <Text style={[s.invPermText, { color: req.permission === 'write' ? theme.accent : theme.primary }]}>{req.permission === 'write' ? (fr ? 'Modif.' : 'Edit') : (fr ? 'Lecture' : 'Read')}</Text>
                          </View>
                        </View>
                        <View style={s.invSenderRow}>
                          <View style={s.invSenderAvatar}><Text style={s.invSenderAvatarText}>{(req.senderName || '?').charAt(0).toUpperCase()}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.invSenderName}>{req.senderName || (fr ? 'Joueur' : 'Player')}</Text>
                            {req.itemSummary ? <Text style={s.invSummary} numberOfLines={1}>{req.itemSummary}</Text> : null}
                          </View>
                        </View>
                        {isPending ? (
                          <View style={s.invActions}>
                            <Pressable style={s.invDeclineBtn} onPress={() => handleDeclineMatch(req.id)} disabled={isProcessing}>
                              <MaterialIcons name="close" size={16} color={theme.error} />
                              <Text style={[s.invActionText, { color: theme.error }]}>{fr ? 'Refuser' : 'Decline'}</Text>
                            </Pressable>
                            <Pressable style={s.invAcceptBtn} onPress={() => handleAcceptMatch(req.id)} disabled={isProcessing}>
                              {isProcessing ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="check" size={16} color="#FFF" /><Text style={s.invAcceptText}>{fr ? 'Accepter' : 'Accept'}</Text></>}
                            </Pressable>
                          </View>
                        ) : (
                          <View style={s.invStatusRow}>
                            <MaterialIcons name={req.status === 'accepted' ? 'check-circle' : 'cancel'} size={14} color={req.status === 'accepted' ? theme.success : theme.textMuted} />
                            <Text style={[s.invStatusText, { color: req.status === 'accepted' ? theme.success : theme.textMuted }]}>{req.status === 'accepted' ? (fr ? 'Accepte' : 'Accepted') : (fr ? 'Refuse' : 'Declined')}</Text>
                          </View>
                        )}
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}

            {/* Meetup Invitations */}
            {filteredMeetupInvitations.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{fr ? 'RENDEZ-VOUS TERRAIN' : 'MEETUP INVITATIONS'}</Text>
                {filteredMeetupInvitations.map((inv, i) => {
                  const mDate = new Date(inv.date);
                  const isPast = mDate < new Date();
                  const isProcessing = processingIds.has(inv.meetupId);
                  return (
                    <Animated.View key={inv.meetupId} entering={FadeInDown.duration(300).delay(i * 40)}>
                      <View style={s.invCard}>
                        <Pressable style={s.meetupCardTop} onPress={() => router.push(`/meetup/${inv.meetupId}` as any)}>
                          <View style={s.meetupDateCol}>
                            <Text style={s.meetupDateDay}>{mDate.getDate()}</Text>
                            <Text style={s.meetupDateMonth}>{mDate.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.invCardType} numberOfLines={1}>{inv.title}</Text>
                            <Text style={s.invCardDate}>{mDate.toLocaleTimeString(fr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })} {inv.terrainName ? `\u2022 ${inv.terrainName}` : ''}</Text>
                            <Text style={s.invSummary}>{fr ? 'Par' : 'By'} {inv.creatorName || '?'} \u2022 {inv.acceptedCount}/{inv.maxParticipants}</Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                        </Pressable>
                        {!isPast ? (
                          <View style={s.invActions}>
                            <Pressable style={s.invDeclineBtn} onPress={() => handleRespondMeetup(inv, 'declined')} disabled={isProcessing}>
                              <MaterialIcons name="close" size={16} color={theme.error} />
                              <Text style={[s.invActionText, { color: theme.error }]}>{fr ? 'Refuser' : 'Decline'}</Text>
                            </Pressable>
                            <Pressable style={s.invAcceptBtn} onPress={() => handleRespondMeetup(inv, 'accepted')} disabled={isProcessing}>
                              {isProcessing ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="check" size={16} color="#FFF" /><Text style={s.invAcceptText}>{fr ? 'Accepter' : 'Accept'}</Text></>}
                            </Pressable>
                          </View>
                        ) : <View style={s.invPastRow}><MaterialIcons name="history" size={12} color={theme.textMuted} /><Text style={s.invPastText}>{fr ? 'Passe' : 'Passed'}</Text></View>}
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}

            {filteredMatchRequests.length === 0 && filteredMeetupInvitations.length === 0 ? (
              <View style={s.emptyState}><MaterialIcons name={invFilter !== 'all' ? 'filter-list-off' : 'mail-outline'} size={56} color={theme.textMuted} /><Text style={s.emptyTitle}>{invFilter !== 'all' ? (fr ? 'Aucun resultat' : 'No results') : (fr ? 'Aucune invitation' : 'No invitations')}</Text><Text style={s.emptyDesc}>{invFilter !== 'all' ? (fr ? 'Aucune invitation ne correspond a ce filtre.' : 'No invitations match this filter.') : (fr ? 'Les invitations de matchs, defis et rendez-vous apparaitront ici.' : 'Match, challenge and meetup invitations will appear here.')}</Text></View>
            ) : null}
          </View>
        ) : null}

        {/* ============ TAB: WITNESS ============ */}
        {activeTab === 'witness' ? (
          <View>
            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBar}>
              {[
                { key: 'all', labelFr: 'Tout', labelEn: 'All', icon: 'list' },
                { key: 'pending', labelFr: 'En attente', labelEn: 'Pending', icon: 'schedule' },
                { key: 'attested', labelFr: 'Attestees', labelEn: 'Attested', icon: 'check-circle' },
                { key: 'declined', labelFr: 'Refusees', labelEn: 'Declined', icon: 'cancel' },
                { key: 'thisWeek', labelFr: 'Cette semaine', labelEn: 'This week', icon: 'date-range' },
              ].map(f => (
                <Pressable key={f.key} style={[s.filterChip, witnessFilter === f.key && s.filterChipActive]} onPress={() => { Haptics.selectionAsync(); setWitnessFilter(f.key); }}>
                  <MaterialIcons name={f.icon as any} size={13} color={witnessFilter === f.key ? '#FFF' : theme.textSecondary} />
                  <Text style={[s.filterChipText, witnessFilter === f.key && s.filterChipTextActive]}>{fr ? f.labelFr : f.labelEn}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={s.infoBanner}>
              <MaterialIcons name="info-outline" size={14} color="#7C3AED" />
              <Text style={s.infoBannerText}>{fr ? 'Attestez les matchs auxquels vous avez assiste. Le poids passe a 2.0x dans le classement.' : 'Attest matches you witnessed. Weight upgrades to 2.0x in the leaderboard.'}</Text>
            </View>
            {filteredWitnessInvitations.filter(i => i.status === 'pending').length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{fr ? 'EN ATTENTE' : 'PENDING'}</Text>
                {filteredWitnessInvitations.filter(i => i.status === 'pending').map((inv, idx) => (
                  <Animated.View key={inv.id} entering={FadeInDown.duration(300).delay(idx * 50)}>
                    <View style={[s.invCard, { borderLeftWidth: 4, borderLeftColor: '#D97706' }]}>
                      <Pressable style={s.meetupCardTop} onPress={() => router.push(`/match/${inv.matchId}` as any)}>
                        <View style={[s.invCardIcon, { backgroundColor: '#D9770612' }]}><MaterialIcons name="sports" size={20} color="#D97706" /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.invCardType} numberOfLines={1}>{inv.matchTeamA} vs {inv.matchTeamB}</Text>
                          <Text style={s.invCardDate}>{inv.matchScoreA} - {inv.matchScoreB} {inv.matchDate ? `\u2022 ${new Date(inv.matchDate).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}` : ''}</Text>
                          <Text style={s.invSummary}>{fr ? 'Demande par' : 'Requested by'} {inv.requesterName}</Text>
                        </View>
                        <MaterialIcons name="open-in-new" size={16} color={theme.primary} />
                      </Pressable>
                      <View style={s.invActions}>
                        <Pressable style={s.invDeclineBtn} onPress={() => handleRespondWitness(inv.id, 'declined')} disabled={respondingWitnessId === inv.id}>
                          <MaterialIcons name="close" size={16} color={theme.error} />
                          <Text style={[s.invActionText, { color: theme.error }]}>{fr ? 'Refuser' : 'Decline'}</Text>
                        </Pressable>
                        <Pressable style={[s.invAcceptBtn, { backgroundColor: '#7C3AED' }]} onPress={() => handleRespondWitness(inv.id, 'attested')} disabled={respondingWitnessId === inv.id}>
                          {respondingWitnessId === inv.id ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="check" size={16} color="#FFF" /><Text style={s.invAcceptText}>{fr ? 'Attester (2.0x)' : 'Attest (2.0x)'}</Text></>}
                        </Pressable>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : null}
            {filteredWitnessInvitations.filter(i => i.status !== 'pending').length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{fr ? 'HISTORIQUE' : 'HISTORY'}</Text>
                {filteredWitnessInvitations.filter(i => i.status !== 'pending').map((inv, idx) => {
                  const sc = inv.status === 'attested' ? '#22C55E' : '#EF4444';
                  return (
                    <Animated.View key={inv.id} entering={FadeInDown.duration(200).delay(idx * 30)}>
                      <Pressable style={[s.invCard, { borderLeftWidth: 4, borderLeftColor: sc, opacity: 0.8 }]} onPress={() => router.push(`/match/${inv.matchId}` as any)}>
                        <View style={s.meetupCardTop}>
                          <View style={[s.invCardIcon, { backgroundColor: sc + '12' }]}><MaterialIcons name={inv.status === 'attested' ? 'check-circle' : 'cancel'} size={20} color={sc} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.invCardType} numberOfLines={1}>{inv.matchTeamA} vs {inv.matchTeamB}</Text>
                            <Text style={s.invCardDate}>{inv.matchScoreA} - {inv.matchScoreB} \u2022 {inv.requesterName}</Text>
                          </View>
                          <View style={[s.statusBadge, { backgroundColor: sc + '15', borderColor: sc + '30' }]}><Text style={[s.statusBadgeText, { color: sc }]}>{inv.status === 'attested' ? (fr ? 'Atteste' : 'Attested') : (fr ? 'Refuse' : 'Declined')}</Text></View>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}
            {filteredWitnessInvitations.length === 0 ? (
              <View style={s.emptyState}><MaterialIcons name={witnessFilter !== 'all' ? 'filter-list-off' : 'visibility-off'} size={48} color={theme.textMuted} /><Text style={s.emptyTitle}>{witnessFilter !== 'all' ? (fr ? 'Aucun resultat' : 'No results') : (fr ? 'Aucune demande' : 'No requests')}</Text><Text style={s.emptyDesc}>{witnessFilter !== 'all' ? (fr ? 'Aucune attestation ne correspond a ce filtre.' : 'No attestations match this filter.') : (fr ? 'Les demandes d\'attestation de matchs apparaitront ici.' : 'Match attestation requests will appear here.')}</Text></View>
            ) : null}
          </View>
        ) : null}

        {/* ============ TAB: TOURNAMENTS ============ */}
        {activeTab === 'tournaments' ? (
          <View>
            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBar}>
              {[
                { key: 'all', labelFr: 'Tout', labelEn: 'All', icon: 'list' },
                { key: 'thisWeek', labelFr: 'Cette semaine', labelEn: 'This week', icon: 'date-range' },
                { key: 'thisMonth', labelFr: 'Ce mois', labelEn: 'This month', icon: 'calendar-month' },
                { key: 'past', labelFr: 'Passes', labelEn: 'Past', icon: 'history' },
              ].map(f => (
                <Pressable key={f.key} style={[s.filterChip, tournamentFilter === f.key && s.filterChipActive]} onPress={() => { Haptics.selectionAsync(); setTournamentFilter(f.key); }}>
                  <MaterialIcons name={f.icon as any} size={13} color={tournamentFilter === f.key ? '#FFF' : theme.textSecondary} />
                  <Text style={[s.filterChipText, tournamentFilter === f.key && s.filterChipTextActive]}>{fr ? f.labelFr : f.labelEn}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={[s.statusCard, { borderColor: permissionStatus === 'granted' ? theme.success + '30' : theme.warning + '30' }]}>
              <View style={[s.statusIconBox, { backgroundColor: (permissionStatus === 'granted' ? theme.success : theme.warning) + '20' }]}>
                <MaterialIcons name={permissionStatus === 'granted' ? 'notifications-active' : 'notifications-off'} size={28} color={permissionStatus === 'granted' ? theme.success : theme.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.statusTitle, { color: permissionStatus === 'granted' ? theme.success : theme.warning }]}>{permissionStatus === 'granted' ? (fr ? 'Notifications actives' : 'Notifications active') : (fr ? 'Notifications desactivees' : 'Notifications disabled')}</Text>
                <Text style={s.statusSub}>{permissionStatus === 'granted' ? `${scheduledCount} ${fr ? 'rappels programmes' : 'scheduled reminders'}` : (fr ? 'Activez les notifications pour recevoir les rappels' : 'Enable notifications to receive reminders')}</Text>
              </View>
              {permissionStatus !== 'granted' ? (
                <Pressable style={s.enableBtn} onPress={async () => { const granted = await requestNotificationPermissions(); setPermissionStatus(granted ? 'granted' : 'denied'); }}>
                  <Text style={s.enableBtnText}>{fr ? 'Activer' : 'Enable'}</Text>
                </Pressable>
              ) : null}
            </View>

            {(() => {
              let filtered = tournamentsWithNotifs;
              if (tournamentFilter === 'thisWeek') filtered = filtered.filter(t => { const d = getDaysUntil(t.date); return d >= 0 && d <= 7; });
              if (tournamentFilter === 'thisMonth') filtered = filtered.filter(t => { const d = getDaysUntil(t.date); return d >= 0 && d <= 30; });
              if (tournamentFilter === 'past') filtered = filtered.filter(t => getDaysUntil(t.date) < 0);
              return filtered.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>{fr ? 'RAPPELS ACTIFS' : 'ACTIVE REMINDERS'} ({filtered.length})</Text>
                {filtered.map((tournament, i) => {
                  const daysUntil = getDaysUntil(tournament.date);
                  const isPast = daysUntil < 0;
                  return (
                    <Animated.View key={tournament.id} entering={FadeIn.duration(200).delay(i * 40)}>
                      <View style={[s.invCard, isPast && { opacity: 0.6 }]}>
                        <Pressable style={s.meetupCardTop} onPress={() => router.push(`/tournament/${tournament.id}`)}>
                          <View style={[s.invCardIcon, { backgroundColor: theme.carreauColor + '15' }]}><MaterialIcons name="emoji-events" size={22} color={isPast ? theme.textMuted : theme.carreauColor} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.invCardType} numberOfLines={1}>{tournament.name}</Text>
                            <Text style={s.invCardDate}>{new Date(tournament.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })} {!isPast ? `\u2022 ${daysUntil === 0 ? (fr ? "Aujourd'hui" : 'Today') : `${daysUntil}${fr ? 'j' : 'd'}`}` : ''}</Text>
                          </View>
                          <Pressable style={s.disableNotifBtn} onPress={() => handleDisableTournamentNotif(tournament.id, tournament.name)} hitSlop={8}>
                            <MaterialIcons name="notifications-off" size={18} color={theme.error} />
                          </Pressable>
                        </Pressable>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            ) : (
              <View style={s.emptyState}><MaterialIcons name={tournamentFilter !== 'all' ? 'filter-list-off' : 'notifications-none'} size={48} color={theme.textMuted} /><Text style={s.emptyTitle}>{tournamentFilter !== 'all' ? (fr ? 'Aucun resultat' : 'No results') : (fr ? 'Aucun rappel actif' : 'No active reminders')}</Text><Text style={s.emptyDesc}>{tournamentFilter !== 'all' ? (fr ? 'Aucun rappel ne correspond a ce filtre.' : 'No reminders match this filter.') : (fr ? 'Activez les rappels depuis la page d\'un tournoi a venir.' : 'Enable reminders from an upcoming tournament page.')}</Text></View>
            );
            })()}
          </View>
        ) : null}

        {/* ============ TAB: PREFERENCES ============ */}
        {activeTab === 'preferences' ? (
          <View>
            <View style={s.prefHero}>
              <View style={s.prefHeroIconBg}><MaterialIcons name="notifications-active" size={28} color={theme.primary} /></View>
              <Text style={s.prefHeroTitle}>{fr ? 'Notifications push' : 'Push Notifications'}</Text>
              <Text style={s.prefHeroSub}>{fr ? 'Choisissez quels types de notifications vous souhaitez recevoir.' : 'Choose which notification types you want to receive.'}</Text>
              <View style={s.prefHeroBadge}><MaterialIcons name="check-circle" size={12} color={enabledPrefCount > 0 ? theme.success : theme.textMuted} /><Text style={[s.prefHeroBadgeText, { color: enabledPrefCount > 0 ? theme.success : theme.textMuted }]}>{enabledPrefCount}/{NOTIF_ITEMS.length} {fr ? 'actives' : 'active'}</Text></View>
            </View>
            {!prefsLoaded ? <ActivityIndicator size="large" color={theme.primary} style={{ paddingVertical: 40 }} /> : (
              <View style={s.prefList}>
                {NOTIF_ITEMS.map((item, idx) => (
                  <Animated.View key={item.key} entering={FadeInDown.duration(200).delay(idx * 30)}>
                    <View style={[s.prefCard, notifPrefs[item.key] && { borderColor: item.color + '30' }]}>
                      <View style={s.prefCardTop}>
                        <View style={[s.prefCardIcon, { backgroundColor: item.color + '15' }]}><MaterialIcons name={item.icon as any} size={20} color={item.color} /></View>
                        <Text style={s.prefCardLabel}>{fr ? item.labelFr : item.labelEn}</Text>
                        <Switch value={notifPrefs[item.key]} onValueChange={() => handleTogglePref(item.key)} trackColor={{ false: theme.border, true: item.color + '60' }} thumbColor={notifPrefs[item.key] ? item.color : theme.textMuted} />
                      </View>
                      <Text style={s.prefCardDesc}>{fr ? item.descFr : item.descEn}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
            <View style={s.infoNote}><MaterialIcons name="info-outline" size={16} color={theme.textMuted} /><Text style={s.infoNoteText}>{fr ? 'Les tokens push sont desactives a la deconnexion.' : 'Push tokens are deactivated on logout.'}</Text></View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabBar: { backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: theme.border },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: theme.textMuted },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 1, marginBottom: 10 },

  // Invitation card
  invCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border, ...theme.shadows.card },
  invCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  invCardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  invCardType: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  invCardDate: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  invPermBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  invPermText: { fontSize: 10, fontWeight: '700' },
  invSenderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  invSenderAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  invSenderAvatarText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  invSenderName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  invSummary: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  invActions: { flexDirection: 'row', gap: 8 },
  invDeclineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 12, backgroundColor: theme.error + '08', borderWidth: 1, borderColor: theme.error + '20' },
  invAcceptBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 12, backgroundColor: theme.success },
  invActionText: { fontSize: 13, fontWeight: '700' },
  invAcceptText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  invStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  invStatusText: { fontSize: 12, fontWeight: '600' },
  invPastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border },
  invPastText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },

  // Meetup card top
  meetupCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  meetupDateCol: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' },
  meetupDateDay: { fontSize: 18, fontWeight: '900', color: theme.primary, lineHeight: 20 },
  meetupDateMonth: { fontSize: 9, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 },

  // Info banner
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#7C3AED08', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#7C3AED18' },
  infoBannerText: { flex: 1, fontSize: 12, color: '#7C3AED', lineHeight: 17, fontWeight: '500' },

  // Status badge
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  // Tournament status card
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 16, gap: 12, borderWidth: 1, ...theme.shadows.card },
  statusIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 15, fontWeight: '700' },
  statusSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  enableBtn: { backgroundColor: theme.warning, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  enableBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  disableNotifBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.error + '10', alignItems: 'center', justifyContent: 'center' },

  // Preferences
  prefHero: { backgroundColor: theme.surface, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 16, ...theme.shadows.card },
  prefHeroIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  prefHeroTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  prefHeroSub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 12 },
  prefHeroBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  prefHeroBadgeText: { fontSize: 12, fontWeight: '600' },
  prefList: { gap: 8, marginBottom: 16 },
  prefCard: { backgroundColor: theme.surface, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: theme.border },
  prefCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  prefCardIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prefCardLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  prefCardDesc: { fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginLeft: 48 },

  // Info note
  infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: theme.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border },
  infoNoteText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 16 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginTop: 12, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },

  // Filter chips
  filterBar: { paddingBottom: 14, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  filterChipTextActive: { color: '#FFF' },
});
