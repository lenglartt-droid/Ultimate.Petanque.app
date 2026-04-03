/**
 * Admin Notification Center
 *
 * Groups all admin alerts, overdue appeals, pending reports,
 * and weekly reports with read/unread tracking and quick actions.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { getAllAppeals, BanAppeal, respondToAppeal } from '@/services/banAppealService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logAdminAction } from '@/services/adminActivityLogService';
import AdminQuickNav from '@/components/feature/AdminQuickNav';

interface AdminNotification {
  id: string;
  type: 'alert' | 'appeal' | 'report' | 'weekly' | 'club';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  icon: string;
  color: string;
  route?: string;
  timestamp: string;
  isRead: boolean;
  metadata?: Record<string, any>;
}

const READ_KEY = 'admin_notif_read_ids';

export default function AdminNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'critical' | 'appeals' | 'reports'>('all');
  const { showAlert } = useAlert();
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Load read IDs from storage
  useEffect(() => {
    AsyncStorage.getItem(READ_KEY).then(val => {
      if (val) try { setReadIds(new Set(JSON.parse(val))); } catch { /* silent */ }
    }).catch(() => {});
  }, []);

  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(READ_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    Haptics.selectionAsync();
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => {
      const next = new Set([...prev, ...allIds]);
      AsyncStorage.setItem(READ_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [notifications]);

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const notifs: AdminNotification[] = [];
      const now = new Date();

      // 1. Overdue ban appeals
      const { appeals } = await getAllAppeals(50);
      const pendingAppeals = appeals.filter(a => a.status === 'pending');
      const threshold48h = Date.now() - 48 * 60 * 60 * 1000;
      const overdueAppeals = pendingAppeals.filter(a => new Date(a.createdAt).getTime() < threshold48h);

      overdueAppeals.forEach(a => {
        const hoursAgo = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / (60 * 60 * 1000));
        const daysAgo = Math.floor(hoursAgo / 24);
        notifs.push({
          id: `appeal-${a.id}`,
          type: 'appeal',
          severity: 'critical',
          title: fr ? `Appel en retard (${daysAgo}j)` : `Overdue appeal (${daysAgo}d)`,
          message: `${(a as any).userName || (a as any).userEmail || 'User'}: ${a.message.substring(0, 80)}${a.message.length > 80 ? '...' : ''}`,
          icon: 'timer-off',
          color: '#DC2626',
          route: '/admin-moderation',
          timestamp: a.createdAt,
          isRead: false,
        });
      });

      // Non-overdue pending appeals
      pendingAppeals.filter(a => !overdueAppeals.includes(a)).forEach(a => {
        notifs.push({
          id: `appeal-pending-${a.id}`,
          type: 'appeal',
          severity: 'warning',
          title: fr ? 'Appel de ban en attente' : 'Pending ban appeal',
          message: `${(a as any).userName || (a as any).userEmail || 'User'}: ${a.message.substring(0, 80)}`,
          icon: 'rate-review',
          color: '#D97706',
          route: '/admin-moderation',
          timestamp: a.createdAt,
          isRead: false,
        });
      });

      // 2. Pending reports
      const { data: reports } = await supabase.from('player_reports').select('id, status, reason, details, created_at, reported_user_id').eq('status', 'pending').order('created_at', { ascending: false }).limit(20);
      (reports || []).forEach((r: any) => {
        notifs.push({
          id: `report-${r.id}`,
          type: 'report',
          severity: (reports || []).length >= 5 ? 'critical' : 'warning',
          title: fr ? 'Signalement en attente' : 'Pending report',
          message: `${r.reason || 'Unknown'}: ${(r.details || '').substring(0, 60)}`,
          icon: 'flag',
          color: '#EF4444',
          route: '/admin-moderation',
          timestamp: r.created_at,
          isRead: false,
        });
      });

      // 3. Unverified clubs (info)
      const { data: unverifiedClubs } = await supabase.from('clubs').select('id, name, city, created_at').eq('is_verified', false).order('created_at', { ascending: false }).limit(10);
      if (unverifiedClubs && unverifiedClubs.length >= 3) {
        notifs.push({
          id: `clubs-unverified-${now.toISOString().slice(0, 10)}`,
          type: 'club',
          severity: 'info',
          title: fr ? `${unverifiedClubs.length} clubs non verifies` : `${unverifiedClubs.length} unverified clubs`,
          message: unverifiedClubs.slice(0, 3).map((c: any) => c.name).join(', ') + (unverifiedClubs.length > 3 ? '...' : ''),
          icon: 'pending',
          color: '#D97706',
          route: '/admin-clubs',
          timestamp: now.toISOString(),
          isRead: false,
        });
      }

      // 4. Smart alerts — match activity decline
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { count: thisWeekMatches } = await supabase.from('matches').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo);
      const { count: lastWeekMatches } = await supabase.from('matches').select('id', { count: 'exact', head: true }).gte('created_at', twoWeeksAgo).lt('created_at', weekAgo);
      const tw = thisWeekMatches || 0;
      const lw = lastWeekMatches || 0;
      if (lw > 0 && tw < lw * 0.7) {
        const decline = Math.round((1 - tw / lw) * 100);
        notifs.push({
          id: `alert-match-decline-${now.toISOString().slice(0, 10)}`,
          type: 'alert',
          severity: 'warning',
          title: fr ? 'Baisse des matchs' : 'Match decline',
          message: fr ? `${tw} matchs cette semaine vs ${lw} la semaine derniere (-${decline}%)` : `${tw} matches this week vs ${lw} last week (-${decline}%)`,
          icon: 'trending-down',
          color: '#EF4444',
          timestamp: now.toISOString(),
          isRead: false,
        });
      }

      // 5. No signups this week
      const { count: newUsers } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo);
      if ((newUsers || 0) === 0) {
        notifs.push({
          id: `alert-no-signups-${now.toISOString().slice(0, 10)}`,
          type: 'alert',
          severity: 'info',
          title: fr ? 'Aucune inscription' : 'No signups',
          message: fr ? 'Aucun nouvel utilisateur cette semaine.' : 'No new users this week.',
          icon: 'person-off',
          color: '#94A3B8',
          timestamp: now.toISOString(),
          isRead: false,
        });
      }

      // Sort by severity then timestamp
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      notifs.sort((a, b) => {
        const so = severityOrder[a.severity] - severityOrder[b.severity];
        if (so !== 0) return so;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setNotifications(notifs);
    } catch (e) {
      console.log('[AdminNotifications] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [fr]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const enrichedNotifs = useMemo(() => {
    return notifications.map(n => ({ ...n, isRead: readIds.has(n.id) }));
  }, [notifications, readIds]);

  const filtered = useMemo(() => {
    let items = enrichedNotifs;
    if (filterType === 'unread') items = items.filter(n => !n.isRead);
    else if (filterType === 'critical') items = items.filter(n => n.severity === 'critical');
    else if (filterType === 'appeals') items = items.filter(n => n.type === 'appeal');
    else if (filterType === 'reports') items = items.filter(n => n.type === 'report');
    return items;
  }, [enrichedNotifs, filterType]);

  const unreadCount = useMemo(() => enrichedNotifs.filter(n => !n.isRead).length, [enrichedNotifs]);
  const criticalCount = useMemo(() => enrichedNotifs.filter(n => n.severity === 'critical').length, [enrichedNotifs]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return fr ? 'A l\'instant' : 'Just now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}${fr ? 'j' : 'd'}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color="#0F172A" /></Pressable>
          <Text style={s.headerTitle}>{fr ? 'Notifications admin' : 'Admin Notifications'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color="#0F172A" /></Pressable>
        <Text style={s.headerTitle}>{fr ? 'Notifications' : 'Notifications'}</Text>
        {unreadCount > 0 ? (
          <Pressable style={s.markAllBtn} onPress={markAllAsRead}>
            <MaterialIcons name="done-all" size={18} color="#3B82F6" />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <AdminQuickNav currentRoute="/admin-notifications" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderColor: '#DC262620' }]}>
            <Text style={[s.summaryValue, { color: '#DC2626' }]}>{criticalCount}</Text>
            <Text style={s.summaryLabel}>{fr ? 'Critiques' : 'Critical'}</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: '#D9770620' }]}>
            <Text style={[s.summaryValue, { color: '#D97706' }]}>{enrichedNotifs.filter(n => n.severity === 'warning').length}</Text>
            <Text style={s.summaryLabel}>{fr ? 'Attention' : 'Warning'}</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: '#3B82F620' }]}>
            <Text style={[s.summaryValue, { color: '#3B82F6' }]}>{unreadCount}</Text>
            <Text style={s.summaryLabel}>{fr ? 'Non lues' : 'Unread'}</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: '#10B98120' }]}>
            <Text style={[s.summaryValue, { color: '#10B981' }]}>{enrichedNotifs.length}</Text>
            <Text style={s.summaryLabel}>Total</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={s.filterRow}>
          {([
            { key: 'all' as const, label: fr ? 'Tout' : 'All', icon: 'notifications' },
            { key: 'unread' as const, label: fr ? 'Non lues' : 'Unread', icon: 'mark-email-unread' },
            { key: 'critical' as const, label: fr ? 'Critiques' : 'Critical', icon: 'error' },
            { key: 'appeals' as const, label: fr ? 'Appels' : 'Appeals', icon: 'rate-review' },
            { key: 'reports' as const, label: fr ? 'Signalements' : 'Reports', icon: 'flag' },
          ]).map(f => {
            const isActive = filterType === f.key;
            return (
              <Pressable key={f.key} style={[s.filterChip, isActive && s.filterChipActive]} onPress={() => { Haptics.selectionAsync(); setFilterType(f.key); }}>
                <MaterialIcons name={f.icon as any} size={13} color={isActive ? '#FFF' : '#64748B'} />
                <Text style={[s.filterChipText, isActive && { color: '#FFF' }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Notifications list */}
        {filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}><MaterialIcons name="notifications-none" size={40} color="#CBD5E1" /></View>
            <Text style={s.emptyTitle}>{fr ? 'Aucune notification' : 'No notifications'}</Text>
            <Text style={s.emptyDesc}>{fr ? 'Tout est en ordre.' : 'Everything looks good.'}</Text>
          </View>
        ) : (
          filtered.map((notif, idx) => {
            const bgColor = notif.severity === 'critical' ? '#FEF2F2' : notif.severity === 'warning' ? '#FFFBEB' : '#F0F9FF';
            const borderColor = notif.severity === 'critical' ? '#FECACA' : notif.severity === 'warning' ? '#FDE68A' : '#BAE6FD';
            return (
              <Animated.View key={notif.id} entering={FadeInDown.duration(200).delay(Math.min(idx * 20, 200))}>
                <Pressable
                  style={[s.notifCard, { backgroundColor: notif.isRead ? '#FFF' : bgColor, borderColor: notif.isRead ? '#F1F5F9' : borderColor }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    markAsRead(notif.id);
                    if (notif.route) router.push(notif.route as any);
                  }}
                >
                  <View style={[s.notifIcon, { backgroundColor: notif.color + '15' }]}>
                    <MaterialIcons name={notif.icon as any} size={18} color={notif.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.notifTitle, notif.isRead && { color: '#94A3B8' }]} numberOfLines={1}>{notif.title}</Text>
                      {!notif.isRead ? <View style={[s.unreadDot, { backgroundColor: notif.color }]} /> : null}
                      {notif.severity === 'critical' ? (
                        <View style={s.criticalBadge}><Text style={s.criticalBadgeText}>{fr ? 'URGENT' : 'URGENT'}</Text></View>
                      ) : null}
                    </View>
                    <Text style={[s.notifMessage, notif.isRead && { color: '#CBD5E1' }]} numberOfLines={2}>{notif.message}</Text>
                    <Text style={s.notifTime}>{getTimeAgo(notif.timestamp)}</Text>
                  </View>
                  {notif.route ? <MaterialIcons name="chevron-right" size={18} color={notif.isRead ? '#CBD5E1' : notif.color} /> : null}
                </Pressable>
                {/* Quick Actions */}
                {notif.type === 'appeal' && notif.severity === 'critical' ? (
                  <View style={s.quickActions}>
                    <Pressable
                      style={[s.quickActionBtn, { backgroundColor: '#DCFCE7' }]}
                      disabled={processingAction === notif.id}
                      onPress={async () => {
                        const appealId = notif.id.replace('appeal-', '');
                        setProcessingAction(notif.id);
                        try {
                          await respondToAppeal(appealId, 'accepted', fr ? 'Approuve depuis le centre de notifications' : 'Approved from notification center');
                          markAsRead(notif.id);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          showAlert(fr ? 'Appel accepte' : 'Appeal accepted', fr ? 'Le joueur a ete debanni.' : 'Player has been unbanned.');
                          logAdminAction({ actionType: 'appeal_accept', targetType: 'appeal', targetId: appealId, actionDetail: 'Quick accept from notification center' });
                          loadNotifications();
                        } catch { /* silent */ }
                        setProcessingAction(null);
                      }}
                    >
                      {processingAction === notif.id ? <ActivityIndicator size="small" color="#10B981" /> : (
                        <><MaterialIcons name="check" size={14} color="#10B981" /><Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>{fr ? 'Accepter' : 'Accept'}</Text></>
                      )}
                    </Pressable>
                    <Pressable
                      style={[s.quickActionBtn, { backgroundColor: '#FEF2F2' }]}
                      disabled={processingAction === notif.id}
                      onPress={async () => {
                        const appealId = notif.id.replace('appeal-', '');
                        setProcessingAction(notif.id);
                        try {
                          await respondToAppeal(appealId, 'rejected', fr ? 'Rejete depuis le centre de notifications' : 'Rejected from notification center');
                          markAsRead(notif.id);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                          logAdminAction({ actionType: 'appeal_reject', targetType: 'appeal', targetId: appealId, actionDetail: 'Quick reject from notification center' });
                          loadNotifications();
                        } catch { /* silent */ }
                        setProcessingAction(null);
                      }}
                    >
                      <MaterialIcons name="close" size={14} color="#EF4444" /><Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>{fr ? 'Rejeter' : 'Reject'}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {notif.type === 'report' ? (
                  <View style={s.quickActions}>
                    <Pressable
                      style={[s.quickActionBtn, { backgroundColor: '#FEF3C7' }]}
                      disabled={processingAction === notif.id}
                      onPress={async () => {
                        const reportId = notif.id.replace('report-', '');
                        setProcessingAction(notif.id);
                        try {
                          const supabase = getSupabaseClient();
                          await supabase.from('player_reports').update({ status: 'dismissed', updated_at: new Date().toISOString() }).eq('id', reportId);
                          markAsRead(notif.id);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          logAdminAction({ actionType: 'moderation_dismiss', targetType: 'report', targetId: reportId, actionDetail: 'Quick dismiss from notification center' });
                          loadNotifications();
                        } catch { /* silent */ }
                        setProcessingAction(null);
                      }}
                    >
                      {processingAction === notif.id ? <ActivityIndicator size="small" color="#D97706" /> : (
                        <><MaterialIcons name="remove-circle-outline" size={14} color="#D97706" /><Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706' }}>{fr ? 'Rejeter' : 'Dismiss'}</Text></>
                      )}
                    </Pressable>
                  </View>
                ) : null}
                {notif.type === 'club' ? (
                  <View style={s.quickActions}>
                    <Pressable
                      style={[s.quickActionBtn, { backgroundColor: '#DBEAFE' }]}
                      onPress={() => { Haptics.selectionAsync(); markAsRead(notif.id); router.push('/admin-clubs' as any); }}
                    >
                      <MaterialIcons name="verified" size={14} color="#2563EB" /><Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>{fr ? 'Verifier' : 'Verify'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  markAllBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DBEAFE' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1 },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 8, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterChipText: { fontSize: 11, fontWeight: '600', color: '#64748B' },

  notifCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1.5 },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1 },
  notifMessage: { fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 16 },
  notifTime: { fontSize: 9, color: '#94A3B8', marginTop: 3, fontWeight: '600' },

  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  criticalBadge: { backgroundColor: '#DC2626', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  criticalBadgeText: { fontSize: 7, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },

  quickActions: { flexDirection: 'row', gap: 6, marginLeft: 52, marginTop: -4, marginBottom: 8 },
  quickActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },

  emptyWrap: { alignItems: 'center', paddingVertical: 56 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
});
