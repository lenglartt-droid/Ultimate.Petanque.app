/**
 * Admin Activity Log Page
 *
 * Full activity log with filters by action type, admin, and pagination.
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
import { AdminActivityLog, ACTION_CONFIG } from '@/services/adminActivityLogService';

const PAGE_SIZE = 30;

const ACTION_TYPE_GROUPS: { key: string; labelFr: string; labelEn: string; icon: string; color: string; types: string[] }[] = [
  { key: 'moderation', labelFr: 'Moderation', labelEn: 'Moderation', icon: 'gavel', color: '#DC2626', types: ['moderation_warn', 'moderation_suspend', 'moderation_ban', 'moderation_dismiss', 'moderation_delete'] },
  { key: 'terrain', labelFr: 'Terrains', labelEn: 'Terrains', icon: 'sports-soccer', color: '#10B981', types: ['terrain_edit', 'terrain_delete', 'terrain_merge', 'terrain_visibility'] },
  { key: 'announcement', labelFr: 'Annonces', labelEn: 'Announcements', icon: 'campaign', color: '#7C3AED', types: ['announcement_sent'] },
  { key: 'maintenance', labelFr: 'Maintenance', labelEn: 'Maintenance', icon: 'construction', color: '#D97706', types: ['maintenance_enable', 'maintenance_disable', 'maintenance_schedule', 'maintenance_cancel'] },
];

export default function AdminActivityLogScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [filterAdmin, setFilterAdmin] = useState<string | null>(null);

  // Unique admins from data
  const uniqueAdmins = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(l => {
      if (l.adminUserId && l.adminName) map.set(l.adminUserId, l.adminName);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [logs]);

  const loadLogs = useCallback(async (pageNum = 0, append = false) => {
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      const { data, error } = await query;
      if (error) { console.log('[ActivityLog] Error:', error); return; }

      const mapped: AdminActivityLog[] = (data || []).map((row: any) => ({
        id: row.id,
        adminUserId: row.admin_user_id,
        adminName: row.admin_name,
        actionType: row.action_type,
        actionDetail: row.action_detail,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      }));

      if (append) {
        setLogs(prev => [...prev, ...mapped]);
      } else {
        setLogs(mapped);
      }
      setHasMore(mapped.length === PAGE_SIZE);
    } catch (e) {
      console.log('[ActivityLog] Load error:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadLogs(0); }, [loadLogs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    await loadLogs(0);
    setRefreshing(false);
  }, [loadLogs]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadLogs(nextPage, true);
  }, [page, loadingMore, hasMore, loadLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let items = logs;
    if (filterGroup) {
      const group = ACTION_TYPE_GROUPS.find(g => g.key === filterGroup);
      if (group) items = items.filter(l => group.types.includes(l.actionType));
    }
    if (filterAdmin) {
      items = items.filter(l => l.adminUserId === filterAdmin);
    }
    return items;
  }, [logs, filterGroup, filterAdmin]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return fr ? 'A l\'instant' : 'Just now';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}${fr ? 'j' : 'd'}`;
    return date.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatFullDate = (d: string) =>
    new Date(d).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <Text style={s.headerTitle}>{fr ? 'Journal d\'activite' : 'Activity Log'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={s.headerTitle}>{fr ? 'Journal d\'activite' : 'Activity Log'}</Text>
        <View style={s.headerRight}>
          <Text style={s.headerCount}>{filteredLogs.length} {fr ? 'actions' : 'actions'}</Text>
        </View>
      </View>

      {/* Action Type Filters */}
      <View style={s.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          <Pressable
            style={[s.filterChip, !filterGroup && s.filterChipActive]}
            onPress={() => { Haptics.selectionAsync(); setFilterGroup(null); }}
          >
            <MaterialIcons name="list" size={13} color={!filterGroup ? '#FFF' : '#64748B'} />
            <Text style={[s.filterChipText, !filterGroup && { color: '#FFF' }]}>{fr ? 'Tout' : 'All'}</Text>
          </Pressable>
          {ACTION_TYPE_GROUPS.map(g => {
            const isActive = filterGroup === g.key;
            const count = logs.filter(l => g.types.includes(l.actionType)).length;
            return (
              <Pressable
                key={g.key}
                style={[s.filterChip, isActive && { backgroundColor: g.color, borderColor: g.color }]}
                onPress={() => { Haptics.selectionAsync(); setFilterGroup(isActive ? null : g.key); }}
              >
                <MaterialIcons name={g.icon as any} size={13} color={isActive ? '#FFF' : g.color} />
                <Text style={[s.filterChipText, isActive && { color: '#FFF' }]}>{fr ? g.labelFr : g.labelEn}</Text>
                {count > 0 ? (
                  <View style={[s.filterChipBadge, isActive && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <Text style={[s.filterChipBadgeText, isActive && { color: '#FFF' }]}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Admin Filter */}
        {uniqueAdmins.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            <View style={s.filterLabel}>
              <MaterialIcons name="person" size={12} color="#94A3B8" />
              <Text style={s.filterLabelText}>Admin</Text>
            </View>
            <Pressable
              style={[s.adminChip, !filterAdmin && s.adminChipActive]}
              onPress={() => { Haptics.selectionAsync(); setFilterAdmin(null); }}
            >
              <Text style={[s.adminChipText, !filterAdmin && { color: '#FFF' }]}>{fr ? 'Tous' : 'All'}</Text>
            </Pressable>
            {uniqueAdmins.map(a => {
              const isActive = filterAdmin === a.id;
              return (
                <Pressable
                  key={a.id}
                  style={[s.adminChip, isActive && s.adminChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setFilterAdmin(isActive ? null : a.id); }}
                >
                  <Text style={[s.adminChipText, isActive && { color: '#FFF' }]} numberOfLines={1}>{a.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {filteredLogs.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}><MaterialIcons name="history" size={40} color="#CBD5E1" /></View>
            <Text style={s.emptyTitle}>{fr ? 'Aucune activite' : 'No activity'}</Text>
            <Text style={s.emptyDesc}>{fr ? 'Les actions admin apparaitront ici' : 'Admin actions will appear here'}</Text>
          </View>
        ) : (
          filteredLogs.map((log, idx) => {
            const cfg = ACTION_CONFIG[log.actionType] || { iconFr: log.actionType, iconEn: log.actionType, color: '#64748B', icon: 'info' };
            return (
              <Animated.View key={log.id} entering={FadeInDown.duration(200).delay(Math.min(idx * 15, 300))}>
                <View style={s.logCard}>
                  <View style={[s.logIcon, { backgroundColor: cfg.color + '12' }]}>
                    <MaterialIcons name={cfg.icon as any} size={18} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logAction}>{fr ? cfg.iconFr : cfg.iconEn}</Text>
                    {log.targetName ? (
                      <Text style={s.logTarget} numberOfLines={1}>{log.targetName}</Text>
                    ) : null}
                    {log.actionDetail ? (
                      <Text style={s.logDetail} numberOfLines={2}>{log.actionDetail}</Text>
                    ) : null}
                    <View style={s.logMeta}>
                      <MaterialIcons name="person-outline" size={11} color="#94A3B8" />
                      <Text style={s.logMetaText}>{log.adminName || 'Admin'}</Text>
                      <Text style={s.logMetaDot}>{"\u2022"}</Text>
                      <Text style={s.logMetaText}>{formatFullDate(log.createdAt)}</Text>
                    </View>
                  </View>
                  <Text style={s.logTimeAgo}>{formatDate(log.createdAt)}</Text>
                </View>
              </Animated.View>
            );
          })
        )}

        {/* Load more */}
        {hasMore && filteredLogs.length > 0 && !filterGroup && !filterAdmin ? (
          <Pressable
            style={s.loadMoreBtn}
            onPress={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <MaterialIcons name="expand-more" size={18} color={theme.primary} />
                <Text style={s.loadMoreText}>{fr ? 'Charger plus' : 'Load more'}</Text>
              </>
            )}
          </Pressable>
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
  headerRight: { minWidth: 40, alignItems: 'flex-end' },
  headerCount: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Filters
  filtersSection: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8 },
  filterRow: { paddingHorizontal: 16, paddingTop: 8, gap: 6, alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterChipBadge: { minWidth: 18, height: 16, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterChipBadgeText: { fontSize: 9, fontWeight: '800', color: '#94A3B8' },
  filterLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
  filterLabelText: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  adminChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  adminChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  adminChipText: { fontSize: 12, fontWeight: '600', color: '#64748B', maxWidth: 100 },

  // Log card
  logCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  logIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  logAction: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  logTarget: { fontSize: 13, fontWeight: '600', color: '#3B82F6', marginBottom: 2 },
  logDetail: { fontSize: 12, color: '#64748B', lineHeight: 17, marginBottom: 4 },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  logMetaText: { fontSize: 10, color: '#94A3B8', fontWeight: '500' },
  logMetaDot: { fontSize: 8, color: '#CBD5E1' },
  logTimeAgo: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 2 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 56 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 13, color: '#94A3B8', marginTop: 4 },

  // Load more
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', marginTop: 8 },
  loadMoreText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
});
