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
  PendingInvitation,
} from '@/services/meetupService';

type TabKey = 'invitations' | 'witness' | 'tournaments' | 'preferences';

const TABS: { key: TabKey; labelFr: string; labelEn: string; icon: string; color: string }[] = [
  { key: 'invitations', labelFr: 'Invitations', labelEn: 'Invitations', icon: 'mail', color: theme.primary },
  { key: 'witness', labelFr: 'Attestations', labelEn: 'Witness', icon: 'visibility', color: '#7C3AED' },
  { key: 'tournaments', labelFr: 'Tournois', labelEn: 'Tournaments', icon: 'emoji-events', color: theme.carreauColor },
  { key: 'preferences', labelFr: 'Réglages', labelEn: 'Settings', icon: 'tune', color: '#64748B' },
];

const NOTIF_ITEMS: { key: keyof NotificationPreferences; icon: string; color: string; labelFr: string; labelEn: string; descFr: string; descEn: string }[] = [
  { key: 'event_created', icon: 'campaign', color: '#7C3AED', labelFr: 'Defis ambassadeurs', labelEn: 'Ambassador challenges', descFr: 'Evenements dans un rayon de 200km', descEn: 'Events within 200km radius' },
  { key: 'meetup_invitation', icon: 'event', color: '#10B981', labelFr: 'Invitations RDV', labelEn: 'Meetup invitations', descFr: 'Rendez-vous terrain', descEn: 'Terrain meetup alerts' },
  { key: 'ranking_changed', icon: 'leaderboard', color: '#D97706', labelFr: 'Classement', labelEn: 'Rankings', descFr: 'Changements de position', descEn: 'Position changes' },
  { key: 'share_request', icon: 'share', color: '#2563EB', labelFr: 'Partage', labelEn: 'Sharing', descFr: 'Demandes de partage recues', descEn: 'Received share requests' },
  { key: 'event_reminder', icon: 'alarm', color: '#F59E0B', labelFr: 'Rappels', labelEn: 'Reminders', descFr: 'Rappels avant evenements', descEn: 'Pre-event reminders' },
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
  const { language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const params = useLocalSearchParams<{ tab?: string }>();
  const fr = language === 'fr';
  const { tournaments, toggleTournamentNotification, isTournamentNotificationEnabled } = useApp();

  const [activeTab, setActiveTab] = useState<TabKey>((params.tab as TabKey) || 'invitations');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [matchRequests, setMatchRequests] = useState<MatchShareRequest[]>([]);
  const [meetupInvitations, setMeetupInvitations] = useState<PendingInvitation[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const [witnessInvitations, setWitnessInvitations] = useState<WitnessInvitation[]>([]);
  const [respondingWitnessId, setRespondingWitnessId] = useState<string | null>(null);

  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied'>('denied');
  const [scheduledCount, setScheduledCount] = useState(0);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({ ...DEFAULT_NOTIFICATION_PREFERENCES });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Filter state
  const [invFilter, setInvFilter] = useState('all');
  const [witnessFilter, setWitnessFilter] = useState('all');
  const [tournamentFilter, setTournamentFilter] = useState('all');

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

  const handleTabChange = useCallback((key: TabKey) => {
    Haptics.selectionAsync();
    setActiveTab(key);
    setInvFilter('all');
    setWitnessFilter('all');
    setTournamentFilter('all');
  }, []);

  const isWithinDays = useCallback((dateStr: string, days: number) => {
    const diffMs = Math.abs(new Date(dateStr).getTime() - Date.now());
    return diffMs <= days * 86400000;
  }, []);

  // Filtered data
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

  const filteredWitnessInvitations = useMemo(() => {
    let items = witnessInvitations;
    if (witnessFilter === 'pending') items = items.filter(i => i.status === 'pending');
    if (witnessFilter === 'attested') items = items.filter(i => i.status === 'attested');
    if (witnessFilter === 'declined') items = items.filter(i => i.status === 'declined');
    if (witnessFilter === 'thisWeek') items = items.filter(i => isWithinDays(i.createdAt, 7));
    return items;
  }, [witnessInvitations, witnessFilter, isWithinDays]);

  const tournamentsWithNotifs = useMemo(() => tournaments.filter(t => isTournamentNotificationEnabled(t.id)), [tournaments, isTournamentNotificationEnabled]);

  // Load all data
  const loadAllData = useCallback(async () => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    try {
      const { requests } = await getReceivedShareRequests();
      setMatchRequests(requests);
      if (requests.length > 0) markShareRequestsSeen(requests.map(r => r.id));

      const { invitations: meetups } = await getPendingInvitations();
      setMeetupInvitations(meetups);

      const { data: wData } = await supabase.from('match_witness_requests').select('*').eq('witness_user_id', user.id).order('created_at', { ascending: false });
      const enriched: WitnessInvitation[] = [];
      for (const row of wData || []) {
        let requesterName = row.witness_name || '';
        let matchTeamA = '', matchTeamB = '', matchScoreA = 0, matchScoreB = 0, matchDate = '';
        try { const { data: p } = await supabase.from('user_profiles').select('username').eq('id', row.requester_user_id).single(); if (p?.username) requesterName = p.username; } catch {}
        try {
          const { data: m } = await supabase.from('matches').select('date, team_a, team_b').eq('id', row.match_id).single();
          if (m) {
            matchDate = m.date;
            const ta = typeof m.team_a === 'string' ? JSON.parse(m.team_a) : m.team_a;
            const tb = typeof m.team_b === 'string' ? JSON.parse(m.team_b) : m.team_b;
            matchTeamA = (ta?.playerNames || []).join(', ') || 'Team A';
            matchTeamB = (tb?.playerNames || []).join(', ') || 'Team B';
            matchScoreA = ta?.score || 0; matchScoreB = tb?.score || 0;
          }
        } catch {}
        enriched.push({ id: row.id, matchId: row.match_id, requesterUserId: row.requester_user_id, requesterName, status: row.status, createdAt: row.created_at, matchTeamA, matchTeamB, matchScoreA, matchScoreB, matchDate });
      }
      setWitnessInvitations(enriched);

      const enabled = await areNotificationsEnabled();
      setPermissionStatus(enabled ? 'granted' : 'denied');
      const scheduled = await getAllScheduledNotifications();
      setScheduledCount(scheduled.length);

      const prefs = await loadNotificationPreferences();
      setNotifPrefs(prefs);
      setPrefsLoaded(true);
    } catch (e) { console.log('Error loading notifications hub:', e); }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const handleRefresh = useCallback(async () => { setRefreshing(true); await loadAllData(); setRefreshing(false); }, [loadAllData]);

  // Handlers
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

  const handleRespondMeetup = useCallback(async (inv: PendingInvitation, status: 'accepted' | 'declined') => {
    setProcessingIds(prev => new Set(prev).add(inv.meetupId));
    const { error } = await respondToMeetup(inv.meetupId, status);
    setProcessingIds(prev => { const n = new Set(prev); n.delete(inv.meetupId); return n; });
    if (error) { showAlert(fr ? 'Erreur' : 'Error', error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMeetupInvitations(prev => prev.filter(i => i.meetupId !== inv.meetupId));
  }, [fr, showAlert]);

  const handleRespondWitness = useCallback(async (invitationId: string, response: 'attested' | 'declined') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRespondingWitnessId(invitationId);
    const { error } = await respondToWitnessRequest(invitationId, response);
    setRespondingWitnessId(null);
    if (error) { showAlert(fr ? 'Erreur' : 'Error', error); return; }
    setWitnessInvitations(prev => prev.map(inv => inv.id === invitationId ? { ...inv, status: response } : inv));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(fr ? 'Succes' : 'Success', response === 'attested' ? (fr ? 'Match atteste (2.0x)' : 'Match attested (2.0x)') : (fr ? 'Demande refusee' : 'Request declined'));
  }, [showAlert, fr]);

  const getDaysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  const handleDisableTournamentNotif = useCallback(async (tid: string, name: string) => {
    Alert.alert(fr ? 'Desactiver ?' : 'Disable?', `"${name}"`, [
      { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
      { text: fr ? 'Desactiver' : 'Disable', style: 'destructive', onPress: async () => {
        await cancelTournamentNotifications(tid);
        toggleTournamentNotification(tid);
        const scheduled = await getAllScheduledNotifications();
        setScheduledCount(scheduled.length);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }},
    ]);
  }, [fr, toggleTournamentNotification]);

  const handleTogglePref = useCallback((key: keyof NotificationPreferences) => {
    Haptics.selectionAsync();
    setNotifPrefs(prev => { const u = { ...prev, [key]: !prev[key] }; saveNotificationPreferences(u).catch(() => {}); return u; });
  }, []);

  const enabledPrefCount = Object.values(notifPrefs).filter(Boolean).length;

  // ============ RENDER HELPERS ============
  const renderFilterChips = (filters: { key: string; labelFr: string; labelEn: string; icon: string }[], active: string, setActive: (k: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipBar}>
      {filters.map(f => {
        const isActive = active === f.key;
        return (
          <Pressable key={f.key} style={[s.chip, isActive && s.chipActive]} onPress={() => { Haptics.selectionAsync(); setActive(f.key); }}>
            <MaterialIcons name={f.icon as any} size={14} color={isActive ? '#FFF' : theme.textSecondary} />
            <Text style={[s.chipText, isActive && s.chipTextActive]}>{fr ? f.labelFr : f.labelEn}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const renderEmpty = (icon: string, filtered: boolean) => (
    <View style={s.emptyWrap}>
      <View style={s.emptyIconBg}><MaterialIcons name={filtered ? 'filter-list-off' as any : icon as any} size={40} color={theme.textMuted} /></View>
      <Text style={s.emptyTitle}>{filtered ? (fr ? 'Aucun resultat' : 'No results') : (fr ? 'Rien ici pour le moment' : 'Nothing here yet')}</Text>
      <Text style={s.emptyDesc}>{filtered ? (fr ? 'Essayez un autre filtre' : 'Try a different filter') : (fr ? 'Les nouvelles notifications apparaitront ici' : 'New notifications will appear here')}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}><Pressable style={s.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} /></Pressable><Text style={s.headerTitle}>{fr ? 'Notifications' : 'Notifications'}</Text><View style={{ width: 40 }} /></View>
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} /></Pressable>
        <Text style={s.headerTitle}>{fr ? 'Notifications' : 'Notifications'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Segmented Tabs */}
      <View style={s.segmentWrap}>
        <View style={s.segmentBar}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const badge = tabBadges[tab.key];
            return (
              <Pressable key={tab.key} style={[s.segmentItem, isActive && s.segmentItemActive]} onPress={() => handleTabChange(tab.key)}>
                <MaterialIcons name={tab.icon as any} size={16} color={isActive ? '#FFF' : theme.textMuted} />
                <Text style={[s.segmentLabel, isActive && s.segmentLabelActive]} numberOfLines={1}>{fr ? tab.labelFr : tab.labelEn}</Text>
                {badge > 0 ? <View style={[s.segmentBadge, isActive && s.segmentBadgeActive]}><Text style={[s.segmentBadgeText, isActive && { color: theme.primary }]}>{badge > 9 ? '9+' : badge}</Text></View> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >

        {/* ========== INVITATIONS TAB ========== */}
        {activeTab === 'invitations' ? (
          <View>
            {renderFilterChips([
              { key: 'all', labelFr: 'Tout', labelEn: 'All', icon: 'list' },
              { key: 'pending', labelFr: 'En attente', labelEn: 'Pending', icon: 'schedule' },
              { key: 'matches', labelFr: 'Matchs', labelEn: 'Matches', icon: 'sports' },
              { key: 'meetups', labelFr: 'RDV', labelEn: 'Meetups', icon: 'event' },
              { key: 'thisWeek', labelFr: 'Cette semaine', labelEn: 'This week', icon: 'date-range' },
            ], invFilter, setInvFilter)}

            {/* Match invitations */}
            {filteredMatchRequests.length > 0 ? (
              <View style={s.section}>
                <View style={s.sectionRow}>
                  <View style={[s.sectionDot, { backgroundColor: theme.primary }]} />
                  <Text style={s.sectionLabel}>{fr ? 'Matchs & Defis' : 'Matches & Challenges'}</Text>
                  <Text style={s.sectionCount}>{filteredMatchRequests.length}</Text>
                </View>
                {filteredMatchRequests.map((req, i) => {
                  const isPending = req.status === 'pending';
                  const isProcessing = processingIds.has(req.id);
                  const isMatch = req.itemType === 'match';
                  return (
                    <Animated.View key={req.id} entering={FadeInDown.duration(250).delay(i * 30)}>
                      <View style={[s.card, !isPending && { opacity: 0.7 }]}>
                        <View style={s.cardRow}>
                          <View style={[s.cardIconBg, { backgroundColor: (isMatch ? theme.primary : theme.accent) + '12' }]}>
                            <MaterialIcons name={isMatch ? 'sports' : 'gps-fixed'} size={20} color={isMatch ? theme.primary : theme.accent} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.cardTitle}>{isMatch ? (fr ? 'Match partage' : 'Shared match') : (fr ? 'Defi partage' : 'Shared challenge')}</Text>
                            <Text style={s.cardMeta}>{req.senderName || (fr ? 'Joueur' : 'Player')} {req.itemSummary ? `\u2022 ${req.itemSummary}` : ''}</Text>
                          </View>
                          <View style={[s.permChip, { backgroundColor: (req.permission === 'write' ? theme.accent : theme.primary) + '12' }]}>
                            <MaterialIcons name={req.permission === 'write' ? 'edit' : 'visibility'} size={10} color={req.permission === 'write' ? theme.accent : theme.primary} />
                            <Text style={[s.permChipText, { color: req.permission === 'write' ? theme.accent : theme.primary }]}>{req.permission === 'write' ? (fr ? 'Modif.' : 'Edit') : (fr ? 'Lect.' : 'Read')}</Text>
                          </View>
                        </View>
                        {isPending ? (
                          <View style={s.actionRow}>
                            <Pressable style={s.declineBtn} onPress={() => handleDeclineMatch(req.id)} disabled={isProcessing}><MaterialIcons name="close" size={16} color={theme.error} /><Text style={s.declineBtnText}>{fr ? 'Refuser' : 'Decline'}</Text></Pressable>
                            <Pressable style={s.acceptBtn} onPress={() => handleAcceptMatch(req.id)} disabled={isProcessing}>
                              {isProcessing ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="check" size={16} color="#FFF" /><Text style={s.acceptBtnText}>{fr ? 'Accepter' : 'Accept'}</Text></>}
                            </Pressable>
                          </View>
                        ) : (
                          <View style={s.statusRow}>
                            <MaterialIcons name={req.status === 'accepted' ? 'check-circle' : 'cancel'} size={14} color={req.status === 'accepted' ? theme.success : theme.textMuted} />
                            <Text style={[s.statusText, { color: req.status === 'accepted' ? theme.success : theme.textMuted }]}>{req.status === 'accepted' ? (fr ? 'Accepte' : 'Accepted') : (fr ? 'Refuse' : 'Declined')}</Text>
                            <Text style={s.statusDate}>{new Date(req.createdAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Text>
                          </View>
                        )}
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}

            {/* Meetup invitations */}
            {filteredMeetupInvitations.length > 0 ? (
              <View style={s.section}>
                <View style={s.sectionRow}>
                  <View style={[s.sectionDot, { backgroundColor: theme.success }]} />
                  <Text style={s.sectionLabel}>{fr ? 'Rendez-vous terrain' : 'Meetup Invitations'}</Text>
                  <Text style={s.sectionCount}>{filteredMeetupInvitations.length}</Text>
                </View>
                {filteredMeetupInvitations.map((inv, i) => {
                  const mDate = new Date(inv.date);
                  const isPast = mDate < new Date();
                  const isProcessing = processingIds.has(inv.meetupId);
                  return (
                    <Animated.View key={inv.meetupId} entering={FadeInDown.duration(250).delay(i * 30)}>
                      <View style={[s.card, isPast && { opacity: 0.6 }]}>
                        <Pressable style={s.cardRow} onPress={() => router.push(`/meetup/${inv.meetupId}` as any)}>
                          <View style={s.dateBlock}>
                            <Text style={s.dateBlockDay}>{mDate.getDate()}</Text>
                            <Text style={s.dateBlockMonth}>{mDate.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.cardTitle} numberOfLines={1}>{inv.title}</Text>
                            <Text style={s.cardMeta}>{mDate.toLocaleTimeString(fr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })} {inv.terrainName ? `\u2022 ${inv.terrainName}` : ''}</Text>
                            <Text style={s.cardMetaSub}>{fr ? 'Par' : 'By'} {inv.creatorName || '?'} \u2022 {inv.acceptedCount}/{inv.maxParticipants}</Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                        </Pressable>
                        {!isPast ? (
                          <View style={s.actionRow}>
                            <Pressable style={s.declineBtn} onPress={() => handleRespondMeetup(inv, 'declined')} disabled={isProcessing}><MaterialIcons name="close" size={16} color={theme.error} /><Text style={s.declineBtnText}>{fr ? 'Refuser' : 'Decline'}</Text></Pressable>
                            <Pressable style={s.acceptBtn} onPress={() => handleRespondMeetup(inv, 'accepted')} disabled={isProcessing}>
                              {isProcessing ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="check" size={16} color="#FFF" /><Text style={s.acceptBtnText}>{fr ? 'Accepter' : 'Accept'}</Text></>}
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}

            {filteredMatchRequests.length === 0 && filteredMeetupInvitations.length === 0 ? renderEmpty('mail-outline', invFilter !== 'all') : null}
          </View>
        ) : null}

        {/* ========== WITNESS TAB ========== */}
        {activeTab === 'witness' ? (
          <View>
            {renderFilterChips([
              { key: 'all', labelFr: 'Tout', labelEn: 'All', icon: 'list' },
              { key: 'pending', labelFr: 'En attente', labelEn: 'Pending', icon: 'schedule' },
              { key: 'attested', labelFr: 'Attestees', labelEn: 'Attested', icon: 'check-circle' },
              { key: 'declined', labelFr: 'Refusees', labelEn: 'Declined', icon: 'cancel' },
              { key: 'thisWeek', labelFr: 'Cette semaine', labelEn: 'This week', icon: 'date-range' },
            ], witnessFilter, setWitnessFilter)}

            <View style={s.tipBanner}>
              <View style={s.tipIcon}><MaterialIcons name="info-outline" size={16} color="#7C3AED" /></View>
              <Text style={s.tipText}>{fr ? 'Attestez les matchs auxquels vous avez assiste. Poids x2.0 dans le classement.' : 'Attest matches you witnessed. Weight upgrades to 2.0x in leaderboard.'}</Text>
            </View>

            {filteredWitnessInvitations.filter(i => i.status === 'pending').length > 0 ? (
              <View style={s.section}>
                <View style={s.sectionRow}><View style={[s.sectionDot, { backgroundColor: '#D97706' }]} /><Text style={s.sectionLabel}>{fr ? 'En attente' : 'Pending'}</Text><Text style={s.sectionCount}>{filteredWitnessInvitations.filter(i => i.status === 'pending').length}</Text></View>
                {filteredWitnessInvitations.filter(i => i.status === 'pending').map((inv, idx) => (
                  <Animated.View key={inv.id} entering={FadeInDown.duration(250).delay(idx * 40)}>
                    <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: '#D97706' }]}>
                      <Pressable style={s.cardRow} onPress={() => router.push(`/match/${inv.matchId}` as any)}>
                        <View style={[s.cardIconBg, { backgroundColor: '#D9770610' }]}><MaterialIcons name="sports" size={20} color="#D97706" /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cardTitle} numberOfLines={1}>{inv.matchTeamA} vs {inv.matchTeamB}</Text>
                          <Text style={s.cardMeta}>{inv.matchScoreA} - {inv.matchScoreB} {inv.matchDate ? `\u2022 ${new Date(inv.matchDate).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}` : ''}</Text>
                          <Text style={s.cardMetaSub}>{fr ? 'Demande par' : 'By'} {inv.requesterName}</Text>
                        </View>
                        <MaterialIcons name="open-in-new" size={16} color={theme.primary} />
                      </Pressable>
                      <View style={s.actionRow}>
                        <Pressable style={s.declineBtn} onPress={() => handleRespondWitness(inv.id, 'declined')} disabled={respondingWitnessId === inv.id}><MaterialIcons name="close" size={16} color={theme.error} /><Text style={s.declineBtnText}>{fr ? 'Refuser' : 'Decline'}</Text></Pressable>
                        <Pressable style={[s.acceptBtn, { backgroundColor: '#7C3AED' }]} onPress={() => handleRespondWitness(inv.id, 'attested')} disabled={respondingWitnessId === inv.id}>
                          {respondingWitnessId === inv.id ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="check" size={16} color="#FFF" /><Text style={s.acceptBtnText}>{fr ? 'Attester (2.0x)' : 'Attest (2.0x)'}</Text></>}
                        </Pressable>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {filteredWitnessInvitations.filter(i => i.status !== 'pending').length > 0 ? (
              <View style={s.section}>
                <View style={s.sectionRow}><View style={[s.sectionDot, { backgroundColor: theme.textMuted }]} /><Text style={s.sectionLabel}>{fr ? 'Historique' : 'History'}</Text></View>
                {filteredWitnessInvitations.filter(i => i.status !== 'pending').map((inv, idx) => {
                  const c = inv.status === 'attested' ? '#22C55E' : '#EF4444';
                  return (
                    <Animated.View key={inv.id} entering={FadeIn.duration(200).delay(idx * 25)}>
                      <Pressable style={[s.card, { borderLeftWidth: 3, borderLeftColor: c, opacity: 0.75 }]} onPress={() => router.push(`/match/${inv.matchId}` as any)}>
                        <View style={s.cardRow}>
                          <View style={[s.cardIconBg, { backgroundColor: c + '10' }]}><MaterialIcons name={inv.status === 'attested' ? 'check-circle' : 'cancel'} size={20} color={c} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.cardTitle} numberOfLines={1}>{inv.matchTeamA} vs {inv.matchTeamB}</Text>
                            <Text style={s.cardMeta}>{inv.matchScoreA} - {inv.matchScoreB} \u2022 {inv.requesterName}</Text>
                          </View>
                          <View style={[s.statusChip, { backgroundColor: c + '12' }]}><Text style={[s.statusChipText, { color: c }]}>{inv.status === 'attested' ? (fr ? 'Atteste' : 'Attested') : (fr ? 'Refuse' : 'Declined')}</Text></View>
                        </View>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}

            {filteredWitnessInvitations.length === 0 ? renderEmpty('visibility-off', witnessFilter !== 'all') : null}
          </View>
        ) : null}

        {/* ========== TOURNAMENTS TAB ========== */}
        {activeTab === 'tournaments' ? (
          <View>
            {renderFilterChips([
              { key: 'all', labelFr: 'Tout', labelEn: 'All', icon: 'list' },
              { key: 'thisWeek', labelFr: 'Cette semaine', labelEn: 'This week', icon: 'date-range' },
              { key: 'thisMonth', labelFr: 'Ce mois', labelEn: 'This month', icon: 'calendar-month' },
              { key: 'past', labelFr: 'Passes', labelEn: 'Past', icon: 'history' },
            ], tournamentFilter, setTournamentFilter)}

            {/* Permission status */}
            <View style={[s.statusCard, { borderColor: permissionStatus === 'granted' ? theme.success + '30' : theme.warning + '30' }]}>
              <View style={[s.statusCardIcon, { backgroundColor: (permissionStatus === 'granted' ? theme.success : theme.warning) + '15' }]}>
                <MaterialIcons name={permissionStatus === 'granted' ? 'notifications-active' : 'notifications-off'} size={22} color={permissionStatus === 'granted' ? theme.success : theme.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.statusCardTitle, { color: permissionStatus === 'granted' ? theme.success : theme.warning }]}>{permissionStatus === 'granted' ? (fr ? 'Notifications actives' : 'Notifications active') : (fr ? 'Notifications desactivees' : 'Notifications disabled')}</Text>
                <Text style={s.statusCardSub}>{permissionStatus === 'granted' ? `${scheduledCount} ${fr ? 'rappels' : 'reminders'}` : (fr ? 'Activez pour recevoir les rappels' : 'Enable to receive reminders')}</Text>
              </View>
              {permissionStatus !== 'granted' ? <Pressable style={s.enableBtn} onPress={async () => { const g = await requestNotificationPermissions(); setPermissionStatus(g ? 'granted' : 'denied'); }}><Text style={s.enableBtnText}>{fr ? 'Activer' : 'Enable'}</Text></Pressable> : null}
            </View>

            {(() => {
              let filtered = tournamentsWithNotifs;
              if (tournamentFilter === 'thisWeek') filtered = filtered.filter(t => { const d = getDaysUntil(t.date); return d >= 0 && d <= 7; });
              if (tournamentFilter === 'thisMonth') filtered = filtered.filter(t => { const d = getDaysUntil(t.date); return d >= 0 && d <= 30; });
              if (tournamentFilter === 'past') filtered = filtered.filter(t => getDaysUntil(t.date) < 0);
              return filtered.length > 0 ? (
                <View style={s.section}>
                  <View style={s.sectionRow}><View style={[s.sectionDot, { backgroundColor: theme.carreauColor }]} /><Text style={s.sectionLabel}>{fr ? 'Rappels actifs' : 'Active reminders'}</Text><Text style={s.sectionCount}>{filtered.length}</Text></View>
                  {filtered.map((tournament, i) => {
                    const daysUntil = getDaysUntil(tournament.date);
                    const isPast = daysUntil < 0;
                    return (
                      <Animated.View key={tournament.id} entering={FadeIn.duration(200).delay(i * 30)}>
                        <View style={[s.card, isPast && { opacity: 0.55 }]}>
                          <Pressable style={s.cardRow} onPress={() => router.push(`/tournament/${tournament.id}`)}>
                            <View style={[s.cardIconBg, { backgroundColor: theme.carreauColor + '12' }]}><MaterialIcons name="emoji-events" size={20} color={isPast ? theme.textMuted : theme.carreauColor} /></View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.cardTitle} numberOfLines={1}>{tournament.name}</Text>
                              <Text style={s.cardMeta}>{new Date(tournament.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })} {!isPast ? `\u2022 ${daysUntil === 0 ? (fr ? "Aujourd'hui" : 'Today') : `${daysUntil}${fr ? 'j' : 'd'}`}` : ''}</Text>
                            </View>
                            <Pressable style={s.iconBtn} onPress={() => handleDisableTournamentNotif(tournament.id, tournament.name)} hitSlop={8}>
                              <MaterialIcons name="notifications-off" size={16} color={theme.error} />
                            </Pressable>
                          </Pressable>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              ) : renderEmpty('notifications-none', tournamentFilter !== 'all');
            })()}
          </View>
        ) : null}

        {/* ========== PREFERENCES TAB ========== */}
        {activeTab === 'preferences' ? (
          <View>
            <View style={s.prefHero}>
              <View style={s.prefHeroIcon}><MaterialIcons name="notifications-active" size={24} color={theme.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.prefHeroTitle}>{fr ? 'Notifications push' : 'Push Notifications'}</Text>
                <Text style={s.prefHeroSub}>{enabledPrefCount}/{NOTIF_ITEMS.length} {fr ? 'actives' : 'active'}</Text>
              </View>
            </View>

            {!prefsLoaded ? <ActivityIndicator size="large" color={theme.primary} style={{ paddingVertical: 40 }} /> : (
              <View style={s.prefList}>
                {NOTIF_ITEMS.map((item, idx) => (
                  <Animated.View key={item.key} entering={FadeInDown.duration(200).delay(idx * 25)}>
                    <View style={[s.prefCard, notifPrefs[item.key] && { borderColor: item.color + '25' }]}>
                      <View style={s.prefCardRow}>
                        <View style={[s.prefCardIcon, { backgroundColor: item.color + '12' }]}><MaterialIcons name={item.icon as any} size={18} color={item.color} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.prefCardLabel}>{fr ? item.labelFr : item.labelEn}</Text>
                          <Text style={s.prefCardDesc}>{fr ? item.descFr : item.descEn}</Text>
                        </View>
                        <Switch value={notifPrefs[item.key]} onValueChange={() => handleTogglePref(item.key)} trackColor={{ false: theme.border, true: item.color + '50' }} thumbColor={notifPrefs[item.key] ? item.color : theme.textMuted} />
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}

            <View style={s.footnote}><MaterialIcons name="info-outline" size={14} color={theme.textMuted} /><Text style={s.footnoteText}>{fr ? 'Les tokens push sont desactives a la deconnexion.' : 'Push tokens are deactivated on logout.'}</Text></View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Segmented tabs
  segmentWrap: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  segmentBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 3 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 12 },
  segmentItemActive: { backgroundColor: '#0F172A' },
  segmentLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  segmentLabelActive: { color: '#FFF' },
  segmentBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentBadgeActive: { backgroundColor: '#FFF' },
  segmentBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },

  // Filter chips
  chipBar: { paddingBottom: 14, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#FFF' },

  // Section
  section: { marginBottom: 24 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 4 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', letterSpacing: 0.3, flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '700', color: '#94A3B8', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },

  // Card
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  cardIconBg: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', lineHeight: 20 },
  cardMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  cardMetaSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  permChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  permChipText: { fontSize: 10, fontWeight: '700' },

  // Date block
  dateBlock: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  dateBlockDay: { fontSize: 17, fontWeight: '800', color: '#2563EB', lineHeight: 19 },
  dateBlockMonth: { fontSize: 8, fontWeight: '700', color: '#2563EB', letterSpacing: 0.5 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  declineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  declineBtnText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  acceptBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 12, backgroundColor: '#0F172A' },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // Status
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusDate: { fontSize: 11, color: '#94A3B8', marginLeft: 'auto' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusChipText: { fontSize: 10, fontWeight: '700' },

  // Tip
  tipBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#EDE9FE' },
  tipIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontSize: 12, color: '#6D28D9', lineHeight: 17, fontWeight: '500' },

  // Status card
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 16, gap: 12, borderWidth: 1 },
  statusCardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusCardTitle: { fontSize: 14, fontWeight: '700' },
  statusCardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  enableBtn: { backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  enableBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },

  // Preferences
  prefHero: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, gap: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  prefHeroIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  prefHeroTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  prefHeroSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  prefList: { gap: 6 },
  prefCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#F1F5F9' },
  prefCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prefCardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prefCardLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  prefCardDesc: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIconBg: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },

  // Footnote
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginTop: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  footnoteText: { flex: 1, fontSize: 11, color: '#94A3B8', lineHeight: 16 },
});
