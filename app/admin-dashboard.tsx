/**
 * Admin Dashboard
 *
 * Unified admin home page with key stats from all admin sections:
 * - Pending reports, active bans
 * - Total terrains, users
 * - Announcements sent
 * - Maintenance status
 * - Quick navigation to each admin section
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { getSupabaseClient } from '@/template';
import { getMaintenanceStatus } from '@/services/maintenanceService';
import { getRecentActivityLogs, AdminActivityLog, ACTION_CONFIG } from '@/services/adminActivityLogService';
import { getAllAppeals, BanAppeal } from '@/services/banAppealService';

interface DashboardStats {
  totalUsers: number;
  premiumUsers: number;
  totalPlayers: number;
  totalTerrains: number;
  totalClubs: number;
  totalMatches: number;
  pendingReports: number;
  activeWarnings: number;
  activeBans: number;
  totalAnnouncements: number;
  flaggedPlayers: number;
  maintenanceActive: boolean;
  maintenanceScheduled: boolean;
  pendingAppeals: number;
}

const INITIAL_STATS: DashboardStats = {
  totalUsers: 0, premiumUsers: 0, totalPlayers: 0, totalTerrains: 0,
  totalClubs: 0, totalMatches: 0, pendingReports: 0, activeWarnings: 0,
  activeBans: 0, totalAnnouncements: 0, flaggedPlayers: 0,
  maintenanceActive: false, maintenanceScheduled: false, pendingAppeals: 0,
};

const ADMIN_SECTIONS: { key: string; route: string; icon: string; color: string; labelFr: string; labelEn: string; descFr: string; descEn: string; statKey?: keyof DashboardStats; badgeColor?: string }[] = [
  { key: 'moderation', route: '/admin-moderation', icon: 'gavel', color: '#DC2626', labelFr: 'Moderation', labelEn: 'Moderation', descFr: 'Signalements et actions', descEn: 'Reports and actions', statKey: 'pendingReports', badgeColor: '#F59E0B' },
  { key: 'announcements', route: '/admin-announcements', icon: 'campaign', color: '#7C3AED', labelFr: 'Annonces', labelEn: 'Announcements', descFr: 'Push cibles aux joueurs', descEn: 'Targeted push to players', statKey: 'totalAnnouncements' },
  { key: 'terrains', route: '/admin-terrains', icon: 'sports-soccer', color: '#10B981', labelFr: 'Terrains', labelEn: 'Terrains', descFr: 'Gestion et doublons', descEn: 'Management and duplicates', statKey: 'totalTerrains' },
  { key: 'anticheat', route: '/admin-anticheat', icon: 'security', color: '#EF4444', labelFr: 'Anti-triche', labelEn: 'Anti-cheat', descFr: 'Trust score et detection', descEn: 'Trust score and detection', statKey: 'flaggedPlayers' },
  { key: 'sponsors', route: '/admin-sponsors', icon: 'handshake', color: '#7C3AED', labelFr: 'Sponsors', labelEn: 'Sponsors', descFr: 'Ambassadeurs et partenaires', descEn: 'Ambassadors and partners' },
  { key: 'promos', route: '/admin-promos', icon: 'admin-panel-settings', color: '#0EA5E9', labelFr: 'Codes promo', labelEn: 'Promo codes', descFr: 'Gestion des promotions', descEn: 'Promotion management' },
  { key: 'maintenance', route: '/admin-maintenance', icon: 'construction', color: '#D97706', labelFr: 'Maintenance', labelEn: 'Maintenance', descFr: 'Mode maintenance et push', descEn: 'Maintenance mode and push' },
];

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();

      const [
        usersRes, playersRes, terrainsRes, clubsRes, matchesRes,
        reportsRes, announcementsRes, suspiciousRes, maintenanceRes,
        activityRes, appealsRes,
      ] = await Promise.all([
        supabase.from('user_profiles').select('id, is_premium', { count: 'exact', head: false }),
        supabase.from('players').select('id', { count: 'exact', head: true }),
        supabase.from('terrains').select('id', { count: 'exact', head: true }),
        supabase.from('clubs').select('id', { count: 'exact', head: true }),
        supabase.from('matches').select('id', { count: 'exact', head: true }),
        supabase.from('player_reports').select('status'),
        supabase.from('announcements').select('id', { count: 'exact', head: true }),
        supabase.from('suspicious_players').select('id, status'),
        getMaintenanceStatus(),
        getRecentActivityLogs(20),
        getAllAppeals(50),
      ]);

      setActivityLogs(activityRes.logs || []);

      const users = usersRes.data || [];
      const reports = reportsRes.data || [];
      const suspicious = suspiciousRes.data || [];

      setStats({
        totalUsers: usersRes.count || users.length,
        premiumUsers: users.filter((u: any) => u.is_premium).length,
        totalPlayers: playersRes.count || 0,
        totalTerrains: terrainsRes.count || 0,
        totalClubs: clubsRes.count || 0,
        totalMatches: matchesRes.count || 0,
        pendingReports: reports.filter((r: any) => r.status === 'pending').length,
        activeWarnings: reports.filter((r: any) => r.status === 'warned').length,
        activeBans: reports.filter((r: any) => r.status === 'banned').length,
        totalAnnouncements: announcementsRes.count || 0,
        flaggedPlayers: suspicious.filter((s: any) => s.status === 'flagged').length,
        maintenanceActive: maintenanceRes.isActive,
        maintenanceScheduled: maintenanceRes.isScheduled,
        pendingAppeals: (appealsRes.appeals || []).filter((a: any) => a.status === 'pending').length,
      });
    } catch (e) {
      console.log('[AdminDashboard] Error loading stats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <Text style={s.headerTitle}>Admin</Text>
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
        <Text style={s.headerTitle}>{fr ? 'Tableau de bord Admin' : 'Admin Dashboard'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Maintenance Alert */}
        {(stats.maintenanceActive || stats.maintenanceScheduled) ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable
              style={[s.alertCard, { backgroundColor: stats.maintenanceActive ? '#FEF3C7' : '#EFF6FF', borderColor: stats.maintenanceActive ? '#FDE68A' : '#BFDBFE' }]}
              onPress={() => { Haptics.selectionAsync(); router.push('/admin-maintenance' as any); }}
            >
              <View style={[s.alertIcon, { backgroundColor: stats.maintenanceActive ? '#F59E0B20' : '#3B82F620' }]}>
                <MaterialIcons name="construction" size={20} color={stats.maintenanceActive ? '#D97706' : '#2563EB'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.alertTitle, { color: stats.maintenanceActive ? '#92400E' : '#1E40AF' }]}>
                  {stats.maintenanceActive ? (fr ? 'Maintenance active' : 'Maintenance active') : (fr ? 'Maintenance planifiee' : 'Maintenance scheduled')}
                </Text>
                <Text style={[s.alertDesc, { color: stats.maintenanceActive ? '#B45309' : '#3B82F6' }]}>
                  {fr ? 'Cliquez pour gerer' : 'Click to manage'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={stats.maintenanceActive ? '#D97706' : '#3B82F6'} />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Key Metrics */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)}>
          <Text style={s.sectionTitle}>{fr ? 'VUE D\'ENSEMBLE' : 'OVERVIEW'}</Text>
          <View style={s.metricsGrid}>
            <View style={[s.metricCard, { borderColor: '#3B82F620' }]}>
              <View style={[s.metricIcon, { backgroundColor: '#DBEAFE' }]}>
                <MaterialIcons name="people" size={18} color="#3B82F6" />
              </View>
              <Text style={[s.metricValue, { color: '#3B82F6' }]}>{stats.totalUsers}</Text>
              <Text style={s.metricLabel}>{fr ? 'Utilisateurs' : 'Users'}</Text>
            </View>
            <View style={[s.metricCard, { borderColor: '#10B98120' }]}>
              <View style={[s.metricIcon, { backgroundColor: '#DCFCE7' }]}>
                <MaterialIcons name="sports-soccer" size={18} color="#10B981" />
              </View>
              <Text style={[s.metricValue, { color: '#10B981' }]}>{stats.totalTerrains}</Text>
              <Text style={s.metricLabel}>{fr ? 'Terrains' : 'Terrains'}</Text>
            </View>
            <View style={[s.metricCard, { borderColor: '#7C3AED20' }]}>
              <View style={[s.metricIcon, { backgroundColor: '#EDE9FE' }]}>
                <MaterialIcons name="home" size={18} color="#7C3AED" />
              </View>
              <Text style={[s.metricValue, { color: '#7C3AED' }]}>{stats.totalClubs}</Text>
              <Text style={s.metricLabel}>Clubs</Text>
            </View>
            <View style={[s.metricCard, { borderColor: '#D9770620' }]}>
              <View style={[s.metricIcon, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="sports" size={18} color="#D97706" />
              </View>
              <Text style={[s.metricValue, { color: '#D97706' }]}>{stats.totalMatches}</Text>
              <Text style={s.metricLabel}>{fr ? 'Matchs' : 'Matches'}</Text>
            </View>
          </View>

          {/* Secondary stats row */}
          <View style={s.secondaryRow}>
            <View style={s.secondaryItem}>
              <MaterialIcons name="person" size={14} color="#64748B" />
              <Text style={s.secondaryText}>{stats.totalPlayers} {fr ? 'joueurs' : 'players'}</Text>
            </View>
            <View style={s.secondaryDot} />
            <View style={s.secondaryItem}>
              <MaterialIcons name="star" size={14} color="#C0C0C0" />
              <Text style={s.secondaryText}>{stats.premiumUsers} premium</Text>
            </View>
          </View>
        </Animated.View>

        {/* Moderation Summary */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)}>
          <Text style={s.sectionTitle}>{fr ? 'MODERATION' : 'MODERATION'}</Text>
          <View style={s.moderationGrid}>
            <Pressable
              style={[s.modCard, { borderColor: '#F59E0B30' }]}
              onPress={() => { Haptics.selectionAsync(); router.push('/admin-moderation' as any); }}
            >
              <View style={[s.modIcon, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="schedule" size={16} color="#F59E0B" />
              </View>
              <Text style={[s.modValue, { color: '#F59E0B' }]}>{stats.pendingReports}</Text>
              <Text style={s.modLabel}>{fr ? 'En attente' : 'Pending'}</Text>
            </Pressable>
            <View style={[s.modCard, { borderColor: '#D9770630' }]}>
              <View style={[s.modIcon, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="warning-amber" size={16} color="#D97706" />
              </View>
              <Text style={[s.modValue, { color: '#D97706' }]}>{stats.activeWarnings}</Text>
              <Text style={s.modLabel}>{fr ? 'Avertis' : 'Warned'}</Text>
            </View>
            <View style={[s.modCard, { borderColor: '#DC262630' }]}>
              <View style={[s.modIcon, { backgroundColor: '#FEF2F2' }]}>
                <MaterialIcons name="block" size={16} color="#DC2626" />
              </View>
              <Text style={[s.modValue, { color: '#DC2626' }]}>{stats.activeBans}</Text>
              <Text style={s.modLabel}>{fr ? 'Bannis' : 'Banned'}</Text>
            </View>
            <View style={[s.modCard, { borderColor: '#EF444430' }]}>
              <View style={[s.modIcon, { backgroundColor: '#FEF2F2' }]}>
                <MaterialIcons name="flag" size={16} color="#EF4444" />
              </View>
              <Text style={[s.modValue, { color: '#EF4444' }]}>{stats.flaggedPlayers}</Text>
              <Text style={s.modLabel}>{fr ? 'Suspects' : 'Flagged'}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Pending Appeals Alert */}
        {stats.pendingAppeals > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(120)}>
            <Pressable
              style={[s.alertCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
              onPress={() => { Haptics.selectionAsync(); router.push('/admin-moderation' as any); }}
            >
              <View style={[s.alertIcon, { backgroundColor: '#D9770620' }]}>
                <MaterialIcons name="rate-review" size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.alertTitle, { color: '#92400E' }]}>
                  {stats.pendingAppeals} {fr ? 'appel(s) de ban en attente' : 'pending ban appeal(s)'}
                </Text>
                <Text style={[s.alertDesc, { color: '#B45309' }]}>
                  {fr ? 'Cliquez pour examiner' : 'Click to review'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#D97706" />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Activity Log */}
        {activityLogs.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(130)}>
            <Text style={s.sectionTitle}>{fr ? 'ACTIVITE RECENTE' : 'RECENT ACTIVITY'}</Text>
            <View style={s.activityCard}>
              {activityLogs.slice(0, 10).map((log, idx) => {
                const cfg = ACTION_CONFIG[log.actionType] || { iconFr: log.actionType, iconEn: log.actionType, color: '#64748B', icon: 'info' };
                const timeAgo = getTimeAgo(log.createdAt, fr);
                return (
                  <View key={log.id} style={[s.activityItem, idx > 0 && s.activityItemBorder]}>
                    <View style={[s.activityIcon, { backgroundColor: cfg.color + '12' }]}>
                      <MaterialIcons name={cfg.icon as any} size={14} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.activityText} numberOfLines={1}>
                        {fr ? cfg.iconFr : cfg.iconEn}
                        {log.targetName ? ` — ${log.targetName}` : ''}
                      </Text>
                      <Text style={s.activityMeta}>
                        {log.adminName || 'Admin'} {"\u2022"} {timeAgo}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {/* Quick Navigation */}
        <Animated.View entering={FadeInDown.duration(300).delay(150)}>
          <Text style={s.sectionTitle}>{fr ? 'NAVIGATION RAPIDE' : 'QUICK NAVIGATION'}</Text>
          {ADMIN_SECTIONS.map((section, idx) => {
            const statValue = section.statKey ? (stats as any)[section.statKey] : null;
            const isMaintenance = section.key === 'maintenance';
            const maintBadge = isMaintenance && (stats.maintenanceActive || stats.maintenanceScheduled);
            return (
              <Animated.View key={section.key} entering={FadeInDown.duration(200).delay(180 + idx * 25)}>
                <Pressable
                  style={({ pressed }) => [s.navCard, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
                  onPress={() => { Haptics.selectionAsync(); router.push(section.route as any); }}
                >
                  <View style={[s.navIcon, { backgroundColor: section.color + '12' }]}>
                    <MaterialIcons name={section.icon as any} size={22} color={section.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.navLabel}>{fr ? section.labelFr : section.labelEn}</Text>
                    <Text style={s.navDesc}>{fr ? section.descFr : section.descEn}</Text>
                  </View>
                  {statValue !== null && statValue > 0 ? (
                    <View style={[s.navBadge, { backgroundColor: (section.badgeColor || section.color) + '15' }]}>
                      <Text style={[s.navBadgeText, { color: section.badgeColor || section.color }]}>{statValue}</Text>
                    </View>
                  ) : null}
                  {maintBadge ? (
                    <View style={[s.navBadge, { backgroundColor: stats.maintenanceActive ? '#FEF3C7' : '#EFF6FF' }]}>
                      <View style={[s.maintDot, { backgroundColor: stats.maintenanceActive ? '#D97706' : '#3B82F6' }]} />
                      <Text style={[s.navBadgeText, { color: stats.maintenanceActive ? '#92400E' : '#1E40AF' }]}>
                        {stats.maintenanceActive ? 'ON' : (fr ? 'PLANIFIE' : 'SCHEDULED')}
                      </Text>
                    </View>
                  ) : null}
                  <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>
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

  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 10, marginTop: 8, paddingHorizontal: 4 },

  // Alert
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5 },
  alertIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 14, fontWeight: '700' },
  alertDesc: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Metrics
  metricsGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  metricCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  metricIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 9, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  secondaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16, paddingVertical: 6 },
  secondaryItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  secondaryText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  secondaryDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },

  // Moderation
  moderationGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  modIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  modValue: { fontSize: 18, fontWeight: '800' },
  modLabel: { fontSize: 8, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Navigation
  navCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  navIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  navDesc: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  navBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  navBadgeText: { fontSize: 11, fontWeight: '800' },
  maintDot: { width: 6, height: 6, borderRadius: 3 },

  // Activity Log
  activityCard: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16 },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14 },
  activityItemBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  activityIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activityText: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  activityMeta: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
});

function getTimeAgo(dateStr: string, fr: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return fr ? 'A l\'instant' : 'Just now';
  if (mins < 60) return `${mins}${fr ? ' min' : 'm'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}${fr ? 'j' : 'd'}`;
  return new Date(dateStr).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
}
