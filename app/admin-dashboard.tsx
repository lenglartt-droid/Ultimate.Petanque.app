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
  Modal,
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
import { getEloRank } from '@/services/eloService';
import { logAdminAction } from '@/services/adminActivityLogService';
import { useAlert } from '@/template';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminQuickNav from '@/components/feature/AdminQuickNav';
import AdminSearchModal from '@/components/feature/AdminSearchModal';
import AdminGuard from '@/components/feature/AdminGuard';
import { getOnboardingStepAnalytics, OnboardingAnalytics, StepAnalytics } from '@/services/onboardingAnalyticsService';
import * as Print from 'expo-print';

interface DashboardStats {
  totalUsers: number;
  premiumUsers: number;
  totalPlayers: number;
  totalTerrains: number;
  totalClubs: number;
  verifiedClubs: number;
  totalMatches: number;
  pendingReports: number;
  activeWarnings: number;
  activeBans: number;
  totalAnnouncements: number;
  flaggedPlayers: number;
  maintenanceActive: boolean;
  maintenanceScheduled: boolean;
  pendingAppeals: number;
  overdueAppeals: number;
}

interface UnverifiedClub {
  id: string;
  name: string;
  city: string;
  membersCount: number;
  description: string | null;
  address: string | null;
  contactEmail: string | null;
  isPublic: boolean;
}

const INITIAL_STATS: DashboardStats = {
  totalUsers: 0, premiumUsers: 0, totalPlayers: 0, totalTerrains: 0,
  totalClubs: 0, verifiedClubs: 0, totalMatches: 0, pendingReports: 0, activeWarnings: 0,
  activeBans: 0, totalAnnouncements: 0, flaggedPlayers: 0,
  maintenanceActive: false, maintenanceScheduled: false, pendingAppeals: 0, overdueAppeals: 0,
};

const ADMIN_SECTIONS: { key: string; route: string; icon: string; color: string; labelFr: string; labelEn: string; descFr: string; descEn: string; statKey?: keyof DashboardStats; badgeColor?: string }[] = [
  { key: 'moderation', route: '/admin-moderation', icon: 'gavel', color: '#DC2626', labelFr: 'Moderation', labelEn: 'Moderation', descFr: 'Signalements et actions', descEn: 'Reports and actions', statKey: 'pendingReports', badgeColor: '#F59E0B' },
  { key: 'announcements', route: '/admin-announcements', icon: 'campaign', color: '#7C3AED', labelFr: 'Annonces', labelEn: 'Announcements', descFr: 'Push cibles aux joueurs', descEn: 'Targeted push to players', statKey: 'totalAnnouncements' },
  { key: 'terrains', route: '/admin-terrains', icon: 'sports-soccer', color: '#10B981', labelFr: 'Terrains', labelEn: 'Terrains', descFr: 'Gestion et doublons', descEn: 'Management and duplicates', statKey: 'totalTerrains' },
  { key: 'anticheat', route: '/admin-anticheat', icon: 'security', color: '#EF4444', labelFr: 'Anti-triche', labelEn: 'Anti-cheat', descFr: 'Trust score et detection', descEn: 'Trust score and detection', statKey: 'flaggedPlayers' },
  { key: 'sponsors', route: '/admin-sponsors', icon: 'handshake', color: '#7C3AED', labelFr: 'Sponsors', labelEn: 'Sponsors', descFr: 'Ambassadeurs et partenaires', descEn: 'Ambassadors and partners' },
  { key: 'promos', route: '/admin-promos', icon: 'admin-panel-settings', color: '#0EA5E9', labelFr: 'Codes promo', labelEn: 'Promo codes', descFr: 'Gestion des promotions', descEn: 'Promotion management' },
  { key: 'maintenance', route: '/admin-maintenance', icon: 'construction', color: '#D97706', labelFr: 'Maintenance', labelEn: 'Maintenance', descFr: 'Mode maintenance et push', descEn: 'Maintenance mode and push' },
  { key: 'users', route: '/admin-users', icon: 'people', color: '#3B82F6', labelFr: 'Utilisateurs', labelEn: 'Users', descFr: 'Gestion des comptes', descEn: 'Account management', statKey: 'totalUsers' },
  { key: 'clubs', route: '/admin-clubs', icon: 'home', color: '#7C3AED', labelFr: 'Clubs', labelEn: 'Clubs', descFr: 'Verification et gestion', descEn: 'Verification and management', statKey: 'totalClubs' },
  { key: 'reports', route: '/admin-reports', icon: 'assessment', color: '#0EA5E9', labelFr: 'Rapports', labelEn: 'Reports', descFr: 'Historique hebdomadaire', descEn: 'Weekly history' },
  { key: 'notifications', route: '/admin-notifications', icon: 'notifications-active', color: '#DC2626', labelFr: 'Centre alertes', labelEn: 'Alert Center', descFr: 'Alertes et notifications admin', descEn: 'Admin alerts and notifications', statKey: 'pendingReports' as keyof DashboardStats },
  { key: 'changelog', route: '/admin-changelog', icon: 'update', color: '#0EA5E9', labelFr: 'Changelog', labelEn: 'Changelog', descFr: 'Historique des versions', descEn: 'Version history' },
];

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { showAlert } = useAlert();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);

  // Statistics data
  const [weeklyMatches, setWeeklyMatches] = useState<{ week: string; count: number }[]>([]);
  const [eloDistribution, setEloDistribution] = useState<{ tier: string; count: number; color: string; label: string }[]>([]);
  const [recentSignups, setRecentSignups] = useState<number>(0);
  const [monthlyGrowth, setMonthlyGrowth] = useState<{ month: string; count: number }[]>([]);
  const [growthDelta, setGrowthDelta] = useState<number>(0);

  // Club verification
  const [unverifiedClubs, setUnverifiedClubs] = useState<UnverifiedClub[]>([]);
  const [verifyingClubId, setVerifyingClubId] = useState<string | null>(null);
  const [showClubVerification, setShowClubVerification] = useState(false);
  const [exportingGrowth, setExportingGrowth] = useState(false);
  const [sendingAppealPush, setSendingAppealPush] = useState(false);

  // Widget visibility (persisted)
  const [widgetVisibility, setWidgetVisibility] = useState<Record<string, boolean>>({
    overview: true, moderation: true, appeals: true, activity: true,
    weeklyMatches: true, userGrowth: true, clubVerification: true, eloDistribution: true, navigation: true,
  });
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  // Smart alerts
  const [smartAlerts, setSmartAlerts] = useState<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; message: string; icon: string; color: string; route?: string }[]>([]);
  const [adminNotifCount, setAdminNotifCount] = useState(0);

  // Push analytics
  const [pushStats, setPushStats] = useState({ sent: 0, types: {} as Record<string, number> });

  // Onboarding analytics
  const [onboardingStats, setOnboardingStats] = useState<{ total: number; withProfile: number; withConsent: number; withRole: number; conversionRate: number; avgDaysToProfile: number }>({ total: 0, withProfile: 0, withConsent: 0, withRole: 0, conversionRate: 0, avgDaysToProfile: 0 });

  // Onboarding step-level analytics
  const [stepAnalytics, setStepAnalytics] = useState<OnboardingAnalytics | null>(null);

  // PDF export
  const [exportingPdf, setExportingPdf] = useState(false);

  // Search modal
  const [showSearch, setShowSearch] = useState(false);

  // Widget order (persisted)
  const DEFAULT_ORDER = ['overview', 'smartAlerts', 'onboarding', 'pushAnalytics', 'moderation', 'appeals', 'activity', 'weeklyMatches', 'userGrowth', 'clubVerification', 'eloDistribution', 'navigation'];
  const [widgetOrder, setWidgetOrder] = useState<string[]>(DEFAULT_ORDER);

  // Load widget preferences + order
  useEffect(() => {
    AsyncStorage.getItem('admin_widget_prefs').then(val => {
      if (val) try { setWidgetVisibility(JSON.parse(val)); } catch { /* silent */ }
    }).catch(() => {});
    AsyncStorage.getItem('admin_widget_order').then(val => {
      if (val) try {
        const parsed = JSON.parse(val);
        // Accept saved order even if length differs (new widgets added)
        const merged = [...parsed, ...DEFAULT_ORDER.filter(k => !parsed.includes(k))];
        setWidgetOrder(merged);
      } catch { /* silent */ }
    }).catch(() => {});
  }, []);

  const toggleWidget = useCallback((key: string) => {
    Haptics.selectionAsync();
    setWidgetVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem('admin_widget_prefs', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const moveWidget = useCallback((key: string, direction: 'up' | 'down') => {
    Haptics.selectionAsync();
    setWidgetOrder(prev => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      AsyncStorage.setItem('admin_widget_order', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const sendAppealDeadlinePush = useCallback(async () => {
    if (sendingAppealPush || stats.overdueAppeals === 0) return;
    setSendingAppealPush(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.functions.invoke('send-push', {
        body: {
          type: 'appeal_deadline',
          payload: {
            overdueCount: stats.overdueAppeals,
            oldestAppealDays: 2,
          },
        },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(fr ? 'Rappel envoye' : 'Reminder sent', fr ? 'Notification envoyee a tous les admins' : 'Notification sent to all admins');
    } catch (e) {
      console.log('[Dashboard] Appeal push error:', e);
    }
    setSendingAppealPush(false);
  }, [sendingAppealPush, stats.overdueAppeals, fr, showAlert]);

  const loadStats = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();

      const [
        usersRes, playersRes, terrainsRes, clubsRes, matchesRes,
        reportsRes, announcementsRes, suspiciousRes, maintenanceRes,
        activityRes, appealsRes, weeklyMatchesRes, eloPlayersRes,
        clubsFullRes, userGrowthRes, pushLogsRes,
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
        // Weekly matches for last 8 weeks
        supabase.from('matches').select('date').gte('date', new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()),
        // ELO distribution
        supabase.from('players').select('elo_rating'),
        // Clubs with verification status
        supabase.from('clubs').select('id, name, city, members_count, description, address, contact_email, is_public, is_verified'),
        // User growth - monthly registrations (last 6 months)
        supabase.from('user_profiles').select('created_at, consent_date').order('created_at', { ascending: true }),
        // Push notification logs from announcements
        supabase.from('announcements').select('push_sent_count, push_error_count, target_type, created_at').order('created_at', { ascending: false }).limit(50),
      ]);

      // Process weekly matches
      const weekMap = new Map<string, number>();
      const now = new Date();
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const key = `S${52 - i}`;
        weekMap.set(key, 0);
      }
      (weeklyMatchesRes.data || []).forEach((m: any) => {
        const d = new Date(m.date);
        const weeksAgo = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksAgo >= 0 && weeksAgo <= 7) {
          const key = `S${52 - (7 - weeksAgo)}`;
          // Find matching key by index
          const keys = [...weekMap.keys()];
          const idx = 7 - weeksAgo;
          if (idx >= 0 && idx < keys.length) {
            const k = keys[idx];
            weekMap.set(k, (weekMap.get(k) || 0) + 1);
          }
        }
      });
      const wkLabels = [...weekMap.keys()].map((_, i) => {
        const d = new Date(now.getTime() - (7 - i) * 7 * 24 * 60 * 60 * 1000);
        return d.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
      });
      setWeeklyMatches([...weekMap.entries()].map(([k, v], i) => ({ week: wkLabels[i] || k, count: v })));

      // Process ELO distribution
      const eloBuckets = { bronze: 0, silver: 0, gold: 0, diamond: 0, master: 0 };
      (eloPlayersRes.data || []).forEach((p: any) => {
        const elo = p.elo_rating || 1000;
        if (elo >= 1800) eloBuckets.master++;
        else if (elo >= 1500) eloBuckets.diamond++;
        else if (elo >= 1200) eloBuckets.gold++;
        else if (elo >= 1000) eloBuckets.silver++;
        else eloBuckets.bronze++;
      });
      // Process monthly user growth (last 6 months)
      const monthMap = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' });
        monthMap.set(key, 0);
      }
      (userGrowthRes.data || []).forEach((u: any) => {
        const dateStr = u.created_at || u.consent_date;
        if (!dateStr) return;
        const d = new Date(dateStr);
        const key = d.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' });
        if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1);
      });
      const monthlyArr = [...monthMap.entries()].map(([month, count]) => ({ month, count }));
      setMonthlyGrowth(monthlyArr);
      if (monthlyArr.length >= 2) {
        const curr = monthlyArr[monthlyArr.length - 1].count;
        const prev = monthlyArr[monthlyArr.length - 2].count;
        setGrowthDelta(prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0);
      }

      // Process clubs for verification
      const allClubs = clubsFullRes.data || [];
      const unverified = allClubs.filter((c: any) => !c.is_verified).map((c: any) => ({
        id: c.id, name: c.name, city: c.city, membersCount: c.members_count || 0,
        description: c.description, address: c.address, contactEmail: c.contact_email,
        isPublic: c.is_public || false,
      }));
      setUnverifiedClubs(unverified);

      // Process push analytics
      const pushData = pushLogsRes.data || [];
      const totalPushSent = pushData.reduce((s: number, a: any) => s + (a.push_sent_count || 0), 0);
      const totalPushErrors = pushData.reduce((s: number, a: any) => s + (a.push_error_count || 0), 0);
      const pushByType: Record<string, number> = {};
      pushData.forEach((a: any) => {
        const t = a.target_type || 'all';
        pushByType[t] = (pushByType[t] || 0) + (a.push_sent_count || 0);
      });
      setPushStats({ sent: totalPushSent, types: pushByType });

      // Process onboarding analytics
      const allUsers = userGrowthRes.data || [];
      const totalUsersCount = allUsers.length;
      const usersWithProfile = allUsers.filter((u: any) => u.consent_date).length;
      const usersWithConsent = allUsers.filter((u: any) => u.consent_date).length;
      const profileCompletion = totalUsersCount > 0 ? Math.round((usersWithConsent / totalUsersCount) * 100) : 0;
      setOnboardingStats({
        total: totalUsersCount,
        withProfile: usersWithProfile,
        withConsent: usersWithConsent,
        withRole: 0,
        conversionRate: profileCompletion,
        avgDaysToProfile: 0,
      });

      // Load step-level onboarding analytics
      try {
        const stepData = await getOnboardingStepAnalytics();
        setStepAnalytics(stepData);
      } catch { /* silent */ }

      setEloDistribution([
        { tier: 'master', count: eloBuckets.master, color: '#F59E0B', label: fr ? 'Maitre' : 'Master' },
        { tier: 'diamond', count: eloBuckets.diamond, color: '#8B5CF6', label: fr ? 'Diamant' : 'Diamond' },
        { tier: 'gold', count: eloBuckets.gold, color: '#D4A017', label: fr ? 'Or' : 'Gold' },
        { tier: 'silver', count: eloBuckets.silver, color: '#94A3B8', label: fr ? 'Argent' : 'Silver' },
        { tier: 'bronze', count: eloBuckets.bronze, color: '#CD7F32', label: 'Bronze' },
      ]);

      // Recent signups (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const recentUsers = (userGrowthRes.data || []).filter((u: any) => {
        const d = u.created_at || u.consent_date;
        return d && d >= sevenDaysAgo;
      });
      setRecentSignups(recentUsers.length);

      setActivityLogs(activityRes.logs || []);

      const users = usersRes.data || [];
      const reports = reportsRes.data || [];
      const suspicious = suspiciousRes.data || [];

      const pendingAppealsList = (appealsRes.appeals || []).filter((a: any) => a.status === 'pending');
      const overdueThreshold = Date.now() - 48 * 60 * 60 * 1000;
      const overdueCount = pendingAppealsList.filter((a: any) => new Date(a.createdAt || a.created_at).getTime() < overdueThreshold).length;

      // Smart alert detection
      const detectedAlerts: typeof smartAlerts = [];
      const pendingCount = reports.filter((r: any) => r.status === 'pending').length;
      if (pendingCount >= 5) detectedAlerts.push({ id: 'report_spike', severity: 'critical', title: fr ? 'Pic de signalements' : 'Report spike', message: fr ? `${pendingCount} signalements en attente. Intervention recommandee.` : `${pendingCount} pending reports. Action recommended.`, icon: 'warning', color: '#DC2626', route: '/admin-moderation' });
      else if (pendingCount >= 3) detectedAlerts.push({ id: 'reports_pending', severity: 'warning', title: fr ? 'Signalements en attente' : 'Pending reports', message: fr ? `${pendingCount} signalement(s) a traiter.` : `${pendingCount} report(s) to review.`, icon: 'gavel', color: '#D97706', route: '/admin-moderation' });
      const weeklyArr2 = [...weekMap.values()];
      if (weeklyArr2.length >= 2) {
        const thisW = weeklyArr2[weeklyArr2.length - 1] || 0;
        const lastW = weeklyArr2[weeklyArr2.length - 2] || 0;
        if (lastW > 0 && thisW < lastW * 0.7) detectedAlerts.push({ id: 'match_decline', severity: 'warning', title: fr ? 'Baisse d\'activite matchs' : 'Match activity decline', message: fr ? `${thisW} matchs cette semaine vs ${lastW} la semaine derniere (-${Math.round((1 - thisW / lastW) * 100)}%)` : `${thisW} matches this week vs ${lastW} last week (-${Math.round((1 - thisW / lastW) * 100)}%)`, icon: 'trending-down', color: '#EF4444' });
      }
      const inactiveClubsPct = unverified.length > 0 && allClubs.length > 0 ? Math.round((unverified.length / allClubs.length) * 100) : 0;
      if (inactiveClubsPct > 50) detectedAlerts.push({ id: 'unverified_clubs', severity: 'info', title: fr ? 'Clubs non verifies' : 'Unverified clubs', message: fr ? `${inactiveClubsPct}% des clubs ne sont pas verifies.` : `${inactiveClubsPct}% of clubs are not verified.`, icon: 'pending', color: '#D97706', route: '/admin-clubs' });
      if (recentUsers.length === 0) detectedAlerts.push({ id: 'no_signups', severity: 'info', title: fr ? 'Aucune inscription recente' : 'No recent signups', message: fr ? 'Aucun nouvel utilisateur cette semaine.' : 'No new users this week.', icon: 'person-off', color: '#94A3B8' });
      if (overdueCount > 0) detectedAlerts.push({ id: 'overdue_appeals', severity: 'critical', title: fr ? 'Appels en retard' : 'Overdue appeals', message: fr ? `${overdueCount} appel(s) en attente depuis +48h.` : `${overdueCount} appeal(s) pending for 48h+.`, icon: 'timer-off', color: '#DC2626', route: '/admin-moderation' });
      setSmartAlerts(detectedAlerts);
      setAdminNotifCount(detectedAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length + pendingAppealsList.length + pendingCount);

      setStats({
        totalUsers: usersRes.count || users.length,
        premiumUsers: users.filter((u: any) => u.is_premium).length,
        totalPlayers: playersRes.count || 0,
        totalTerrains: terrainsRes.count || 0,
        totalClubs: clubsRes.count || 0,
        verifiedClubs: (clubsFullRes.data || []).filter((c: any) => c.is_verified).length,
        totalMatches: matchesRes.count || 0,
        pendingReports: reports.filter((r: any) => r.status === 'pending').length,
        activeWarnings: reports.filter((r: any) => r.status === 'warned').length,
        activeBans: reports.filter((r: any) => r.status === 'banned').length,
        totalAnnouncements: announcementsRes.count || 0,
        flaggedPlayers: suspicious.filter((s: any) => s.status === 'flagged').length,
        maintenanceActive: maintenanceRes.isActive,
        maintenanceScheduled: maintenanceRes.isScheduled,
        pendingAppeals: pendingAppealsList.length,
        overdueAppeals: overdueCount,
      });
    } catch (e) {
      console.log('[AdminDashboard] Error loading stats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Real-time polling every 30 seconds
  const [pollingActive, setPollingActive] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date>(new Date());
  useEffect(() => {
    if (!pollingActive || loading) return;
    const interval = setInterval(async () => {
      try {
        await loadStats();
        setLastPoll(new Date());
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [pollingActive, loading, loadStats]);

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
    <AdminGuard language={language}>
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={s.headerTitle}>{fr ? 'Tableau de bord' : 'Dashboard'}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            style={s.backBtn}
            onPress={() => { Haptics.selectionAsync(); setShowSearch(true); }}
          >
            <MaterialIcons name="search" size={20} color="#64748B" />
          </Pressable>
          <Pressable
            style={[s.backBtn, exportingPdf && { opacity: 0.5 }]}
            onPress={async () => {
              if (exportingPdf) return;
              setExportingPdf(true);
              Haptics.selectionAsync();
              try {
                const now = new Date();
                const dateStr = now.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;padding:24px;color:#0F172A;background:#F8FAFC}h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;color:#64748B;margin:24px 0 12px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E2E8F0;padding-bottom:6px}.sub{font-size:12px;color:#94A3B8;margin-bottom:20px}.grid{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}.card{flex:1;min-width:120px;background:#FFF;border-radius:12px;padding:16px;text-align:center;border:1px solid #E2E8F0}.card .val{font-size:28px;font-weight:800}.card .lbl{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px}.alert{background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px;margin-bottom:8px;font-size:12px;color:#991B1B}.alert.warn{background:#FFFBEB;border-color:#FDE68A;color:#92400E}.alert.info{background:#EFF6FF;border-color:#BFDBFE;color:#1E40AF}.bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px}.bar-row .label{width:80px;color:#64748B;font-weight:600}.bar-row .bar{flex:1;height:14px;background:#F1F5F9;border-radius:4px;overflow:hidden}.bar-row .fill{height:100%;border-radius:4px}.bar-row .num{width:30px;text-align:right;font-weight:800;font-size:12px}footer{margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:10px;color:#94A3B8;text-align:center}</style></head><body><h1>Ultimate Petanque - ${fr ? 'Rapport Admin' : 'Admin Report'}</h1><p class="sub">${dateStr}</p><h2>${fr ? 'Vue d\'ensemble' : 'Overview'}</h2><div class="grid"><div class="card"><div class="val" style="color:#3B82F6">${stats.totalUsers}</div><div class="lbl">${fr ? 'Utilisateurs' : 'Users'}</div></div><div class="card"><div class="val" style="color:#10B981">${stats.totalTerrains}</div><div class="lbl">Terrains</div></div><div class="card"><div class="val" style="color:#7C3AED">${stats.totalClubs}</div><div class="lbl">Clubs</div></div><div class="card"><div class="val" style="color:#D97706">${stats.totalMatches}</div><div class="lbl">${fr ? 'Matchs' : 'Matches'}</div></div></div><div class="grid"><div class="card"><div class="val" style="color:#0EA5E9">${stats.totalPlayers}</div><div class="lbl">${fr ? 'Joueurs' : 'Players'}</div></div><div class="card"><div class="val" style="color:#C0C0C0">${stats.premiumUsers}</div><div class="lbl">Premium</div></div><div class="card"><div class="val" style="color:#2563EB">${stats.verifiedClubs}</div><div class="lbl">${fr ? 'Clubs verifies' : 'Verified Clubs'}</div></div><div class="card"><div class="val" style="color:#F59E0B">${pushStats.sent}</div><div class="lbl">Push</div></div></div><h2>${fr ? 'Moderation' : 'Moderation'}</h2><div class="grid"><div class="card"><div class="val" style="color:#F59E0B">${stats.pendingReports}</div><div class="lbl">${fr ? 'En attente' : 'Pending'}</div></div><div class="card"><div class="val" style="color:#D97706">${stats.activeWarnings}</div><div class="lbl">${fr ? 'Avertis' : 'Warned'}</div></div><div class="card"><div class="val" style="color:#DC2626">${stats.activeBans}</div><div class="lbl">${fr ? 'Bannis' : 'Banned'}</div></div><div class="card"><div class="val" style="color:#EF4444">${stats.flaggedPlayers}</div><div class="lbl">${fr ? 'Suspects' : 'Flagged'}</div></div></div>${smartAlerts.length > 0 ? `<h2>${fr ? 'Alertes' : 'Alerts'}</h2>${smartAlerts.map(a => `<div class="alert ${a.severity === 'warning' ? 'warn' : a.severity === 'info' ? 'info' : ''}">${a.title}: ${a.message}</div>`).join('')}` : ''}<h2>${fr ? 'Croissance utilisateurs' : 'User Growth'}</h2>${monthlyGrowth.map(m => `<div class="bar-row"><span class="label">${m.month}</span><div class="bar"><div class="fill" style="width:${Math.max(3, (m.count / Math.max(...monthlyGrowth.map(x => x.count), 1)) * 100)}%;background:#3B82F6"></div></div><span class="num">${m.count}</span></div>`).join('')}<h2>${fr ? 'Matchs par semaine' : 'Matches per Week'}</h2>${weeklyMatches.map(w => `<div class="bar-row"><span class="label">${w.week}</span><div class="bar"><div class="fill" style="width:${Math.max(3, (w.count / Math.max(...weeklyMatches.map(x => x.count), 1)) * 100)}%;background:#10B981"></div></div><span class="num">${w.count}</span></div>`).join('')}<h2>ELO</h2>${eloDistribution.map(e => `<div class="bar-row"><span class="label" style="color:${e.color}">${e.label}</span><div class="bar"><div class="fill" style="width:${Math.max(3, (e.count / Math.max(...eloDistribution.map(x => x.count), 1)) * 100)}%;background:${e.color}"></div></div><span class="num">${e.count}</span></div>`).join('')}<footer>Ultimate Petanque Admin Report - ${dateStr}</footer></body></html>`;
                const { uri } = await Print.printToFileAsync({ html, base64: false });
                if (uri) {
                  const canShare = await Sharing.isAvailableAsync();
                  if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fr ? 'Rapport Admin PDF' : 'Admin Report PDF' });
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (e) { console.log('[Dashboard] PDF export error:', e); }
              setExportingPdf(false);
            }}
            disabled={exportingPdf}
          >
            {exportingPdf ? <ActivityIndicator size="small" color="#64748B" /> : <MaterialIcons name="picture-as-pdf" size={20} color="#DC2626" />}
          </Pressable>
          <Pressable
            style={[s.backBtn, showWidgetSettings && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
            onPress={() => { Haptics.selectionAsync(); setShowWidgetSettings(!showWidgetSettings); }}
          >
            <MaterialIcons name="tune" size={20} color={showWidgetSettings ? '#FFF' : '#64748B'} />
          </Pressable>
        </View>
      </View>

      <AdminQuickNav currentRoute="/admin-dashboard" />

      {/* Widget Settings Modal */}
      <Modal visible={showWidgetSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowWidgetSettings(false)}>
        <SafeAreaView style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Pressable style={s.backBtn} onPress={() => setShowWidgetSettings(false)}>
              <MaterialIcons name="close" size={24} color="#0F172A" />
            </Pressable>
            <Text style={s.modalTitle}>{fr ? 'Widgets du tableau de bord' : 'Dashboard Widgets'}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12 }}>
              <MaterialIcons name="info-outline" size={16} color="#3B82F6" />
              <Text style={{ flex: 1, fontSize: 12, color: '#3B82F6', lineHeight: 18 }}>{fr ? 'Activez ou desactivez les widgets et reorganisez-les avec les fleches.' : 'Toggle widgets on/off and reorder them with the arrows.'}</Text>
            </View>
            {(() => {
              const items = [
                { key: 'overview', label: fr ? 'Vue d\'ensemble' : 'Overview', icon: 'analytics' },
                { key: 'smartAlerts', label: fr ? 'Alertes' : 'Alerts', icon: 'notifications-active' },
                { key: 'onboarding', label: 'Onboarding', icon: 'person-add' },
                { key: 'pushAnalytics', label: fr ? 'Push Analytics' : 'Push Analytics', icon: 'send' },
                { key: 'moderation', label: fr ? 'Moderation' : 'Moderation', icon: 'gavel' },
                { key: 'appeals', label: fr ? 'Appels de ban' : 'Ban Appeals', icon: 'rate-review' },
                { key: 'activity', label: fr ? 'Activite recente' : 'Recent Activity', icon: 'history' },
                { key: 'weeklyMatches', label: fr ? 'Matchs/semaine' : 'Matches/week', icon: 'sports' },
                { key: 'userGrowth', label: fr ? 'Croissance' : 'Growth', icon: 'trending-up' },
                { key: 'clubVerification', label: fr ? 'Verification clubs' : 'Club Verification', icon: 'verified' },
                { key: 'eloDistribution', label: 'ELO', icon: 'leaderboard' },
                { key: 'navigation', label: fr ? 'Navigation rapide' : 'Quick Nav', icon: 'menu' },
              ];
              const sorted = [...items].sort((a, b) => widgetOrder.indexOf(a.key) - widgetOrder.indexOf(b.key));
              return sorted.map((w, idx) => (
                <View key={w.key} style={s.widgetToggle}>
                  <Pressable style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }} onPress={() => toggleWidget(w.key)}>
                    <MaterialIcons name={w.icon as any} size={16} color={widgetVisibility[w.key] !== false ? '#3B82F6' : '#CBD5E1'} />
                    <Text style={[s.widgetToggleText, widgetVisibility[w.key] === false && { color: '#CBD5E1' }]}>{w.label}</Text>
                  </Pressable>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Pressable onPress={() => moveWidget(w.key, 'up')} disabled={idx === 0} hitSlop={6}>
                      <MaterialIcons name="keyboard-arrow-up" size={18} color={idx === 0 ? '#E2E8F0' : '#64748B'} />
                    </Pressable>
                    <Pressable onPress={() => moveWidget(w.key, 'down')} disabled={idx === sorted.length - 1} hitSlop={6}>
                      <MaterialIcons name="keyboard-arrow-down" size={18} color={idx === sorted.length - 1 ? '#E2E8F0' : '#64748B'} />
                    </Pressable>
                    <View style={[s.widgetDot, widgetVisibility[w.key] !== false ? { backgroundColor: '#10B981' } : { backgroundColor: '#E2E8F0' }]} />
                  </View>
                </View>
              ));
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Polling Indicator */}
        {pollingActive && !loading ? (
          <Pressable
            style={s.pollingIndicator}
            onPress={() => { Haptics.selectionAsync(); setPollingActive(!pollingActive); }}
          >
            <View style={s.pollingDot} />
            <Text style={s.pollingText}>
              {fr ? 'Actualisation auto' : 'Auto-refresh'} • {lastPoll.toLocaleTimeString(fr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Pressable>
        ) : null}

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

        {/* Ordered Widget Rendering */}
        {widgetOrder.map((wKey, wIdx) => {
          if (widgetVisibility[wKey] === false) return null;
          const wDelay = 50 + wIdx * 20;

          if (wKey === 'overview') return (
        <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
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

          );

          if (wKey === 'smartAlerts' && smartAlerts.length > 0) return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <Text style={s.sectionTitle}>{fr ? 'ALERTES INTELLIGENTES' : 'SMART ALERTS'}</Text>
            {smartAlerts.map((alert, aIdx) => (
              <Pressable
                key={alert.id}
                style={[s.alertCard, { backgroundColor: alert.severity === 'critical' ? '#FEF2F2' : alert.severity === 'warning' ? '#FFFBEB' : '#F0F9FF', borderColor: alert.severity === 'critical' ? '#FECACA' : alert.severity === 'warning' ? '#FDE68A' : '#BAE6FD', marginBottom: 8 }]}
                onPress={() => { if (alert.route) { Haptics.selectionAsync(); router.push(alert.route as any); } }}
              >
                <View style={[s.alertIcon, { backgroundColor: alert.color + '15' }]}>
                  <MaterialIcons name={alert.icon as any} size={18} color={alert.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.alertTitle, { color: alert.color }]}>{alert.title}</Text>
                    {alert.severity === 'critical' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' }} /> : null}
                  </View>
                  <Text style={[s.alertDesc, { color: alert.color + 'CC' }]}>{alert.message}</Text>
                </View>
                {alert.route ? <MaterialIcons name="chevron-right" size={18} color={alert.color} /> : null}
              </Pressable>
            ))}
          </Animated.View>
          );

          if (wKey === 'moderation') return (
        <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
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

          );

          if (wKey === 'appeals' && stats.pendingAppeals > 0) return (
          <Animated.View entering={FadeInDown.duration(300).delay(120)}>
            <Pressable
              style={[s.alertCard, { backgroundColor: stats.overdueAppeals > 0 ? '#FEF2F2' : '#FFFBEB', borderColor: stats.overdueAppeals > 0 ? '#FECACA' : '#FDE68A' }]}
              onPress={() => { Haptics.selectionAsync(); router.push('/admin-moderation' as any); }}
            >
              <View style={[s.alertIcon, { backgroundColor: stats.overdueAppeals > 0 ? '#DC262620' : '#D9770620' }]}>
                <MaterialIcons name={stats.overdueAppeals > 0 ? 'warning' : 'rate-review'} size={20} color={stats.overdueAppeals > 0 ? '#DC2626' : '#D97706'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.alertTitle, { color: stats.overdueAppeals > 0 ? '#991B1B' : '#92400E' }]}>
                  {stats.pendingAppeals} {fr ? 'appel(s) de ban en attente' : 'pending ban appeal(s)'}
                </Text>
                {stats.overdueAppeals > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MaterialIcons name="timer-off" size={12} color="#DC2626" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>
                      {stats.overdueAppeals} {fr ? 'en retard (+48h)' : 'overdue (+48h)'}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.alertDesc, { color: '#B45309' }]}>
                    {fr ? 'Cliquez pour examiner' : 'Click to review'}
                  </Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={20} color={stats.overdueAppeals > 0 ? '#DC2626' : '#D97706'} />
            </Pressable>
            {stats.overdueAppeals > 0 ? (
              <Pressable
                style={[s.appealPushBtn, sendingAppealPush && { opacity: 0.5 }]}
                onPress={sendAppealDeadlinePush}
                disabled={sendingAppealPush}
              >
                {sendingAppealPush ? <ActivityIndicator size="small" color="#DC2626" /> : (
                  <><MaterialIcons name="notifications-active" size={14} color="#DC2626" /><Text style={s.appealPushText}>{fr ? 'Rappeler les admins' : 'Remind admins'}</Text></>
                )}
              </Pressable>
            ) : null}
          </Animated.View>
          );

          if (wKey === 'activity' && activityLogs.length > 0) return (
          <Animated.View entering={FadeInDown.duration(300).delay(130)}>
            <View style={s.activityHeader}>
              <Text style={s.sectionTitle}>{fr ? 'ACTIVITE RECENTE' : 'RECENT ACTIVITY'}</Text>
              <Pressable
                style={s.activityViewAllBtn}
                onPress={() => { Haptics.selectionAsync(); router.push('/admin-activity-log' as any); }}
              >
                <Text style={s.activityViewAllText}>{fr ? 'Voir tout' : 'View all'}</Text>
                <MaterialIcons name="chevron-right" size={16} color="#3B82F6" />
              </Pressable>
            </View>
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
          );

          if (wKey === 'weeklyMatches' && weeklyMatches.length > 0) return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <Text style={s.sectionTitle}>{fr ? 'MATCHS PAR SEMAINE' : 'MATCHES PER WEEK'}</Text>
            <View style={s.chartCard}>
              {(() => {
                const maxVal = Math.max(...weeklyMatches.map(w => w.count), 1);
                return weeklyMatches.map((w, idx) => (
                  <View key={idx} style={s.chartRow}>
                    <Text style={s.chartLabel} numberOfLines={1}>{w.week}</Text>
                    <View style={s.chartBarBg}>
                      <View style={[s.chartBarFill, { width: `${Math.max(2, (w.count / maxVal) * 100)}%`, backgroundColor: '#3B82F6' }]} />
                    </View>
                    <Text style={s.chartValue}>{w.count}</Text>
                  </View>
                ));
              })()}
              {recentSignups > 0 ? (
                <View style={s.chartFooter}>
                  <MaterialIcons name="person-add" size={12} color="#10B981" />
                  <Text style={s.chartFooterText}>+{recentSignups} {fr ? 'inscriptions cette semaine' : 'signups this week'}</Text>
                </View>
              ) : null}
            </View>
          </Animated.View>
          );

          if (wKey === 'userGrowth' && monthlyGrowth.length > 0) return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <View style={s.growthHeader}>
              <Text style={s.sectionTitle}>{fr ? 'CROISSANCE UTILISATEURS' : 'USER GROWTH'}</Text>
              <Pressable
                style={[s.growthExportBtn, exportingGrowth && { opacity: 0.5 }]}
                onPress={async () => {
                  if (exportingGrowth || monthlyGrowth.length === 0) return;
                  setExportingGrowth(true);
                  try {
                    const headers = 'Month,New Users';
                    const rows = monthlyGrowth.map(m => `${m.month},${m.count}`);
                    const summary = `\nTotal Users,${stats.totalUsers}\nPremium Users,${stats.premiumUsers}\nTotal Matches,${stats.totalMatches}\nTotal Clubs,${stats.totalClubs}\nVerified Clubs,${stats.verifiedClubs}\nTotal Terrains,${stats.totalTerrains}\nGrowth Delta,${growthDelta}%`;
                    const csv = [headers, ...rows, '', '--- Summary ---', summary].join('\n');
                    if (typeof document !== 'undefined') {
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `growth-report-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } else {
                      const path = `${FileSystem.cacheDirectory}growth-report-${new Date().toISOString().slice(0, 10)}.csv`;
                      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
                      const canShare = await Sharing.isAvailableAsync();
                      if (canShare) await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: fr ? 'Exporter le rapport' : 'Export report' });
                    }
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch (e) { console.log('[Dashboard] Export error:', e); }
                  setExportingGrowth(false);
                }}
                disabled={exportingGrowth}
              >
                {exportingGrowth ? <ActivityIndicator size="small" color="#2563EB" /> : <MaterialIcons name="file-download" size={16} color="#2563EB" />}
              </Pressable>
              {growthDelta !== 0 ? (
                <View style={[s.growthDelta, { backgroundColor: growthDelta > 0 ? '#DCFCE7' : '#FEF2F2' }]}>
                  <MaterialIcons name={growthDelta > 0 ? 'trending-up' : 'trending-down'} size={12} color={growthDelta > 0 ? '#10B981' : '#EF4444'} />
                  <Text style={[s.growthDeltaText, { color: growthDelta > 0 ? '#10B981' : '#EF4444' }]}>{growthDelta > 0 ? '+' : ''}{growthDelta}%</Text>
                </View>
              ) : null}
            </View>
            <View style={s.chartCard}>
              {(() => {
                const maxVal = Math.max(...monthlyGrowth.map(m => m.count), 1);
                return monthlyGrowth.map((m, idx) => {
                  const isLast = idx === monthlyGrowth.length - 1;
                  return (
                    <View key={idx} style={s.chartRow}>
                      <Text style={[s.chartLabel, isLast && { color: '#3B82F6', fontWeight: '700' as any }]}>{m.month}</Text>
                      <View style={s.chartBarBg}>
                        <View style={[s.chartBarFill, { width: `${Math.max(2, (m.count / maxVal) * 100)}%`, backgroundColor: isLast ? '#3B82F6' : '#93C5FD' }]} />
                      </View>
                      <Text style={[s.chartValue, isLast && { color: '#3B82F6' }]}>{m.count}</Text>
                    </View>
                  );
                });
              })()}
              <View style={s.chartFooter}>
                <MaterialIcons name="people" size={12} color="#3B82F6" />
                <Text style={[s.chartFooterText, { color: '#3B82F6' }]}>{stats.totalUsers} {fr ? 'utilisateurs au total' : 'total users'}</Text>
              </View>
            </View>
          </Animated.View>
          );

          if (wKey === 'clubVerification') return (
        <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
          <Pressable style={s.verifyHeader} onPress={() => { Haptics.selectionAsync(); setShowClubVerification(!showClubVerification); }}>
            <Text style={s.sectionTitle}>{fr ? 'VERIFICATION CLUBS' : 'CLUB VERIFICATION'}</Text>
            <View style={s.verifyStats}>
              <View style={[s.verifyStatPill, { backgroundColor: '#DCFCE7' }]}>
                <MaterialIcons name="verified" size={10} color="#10B981" />
                <Text style={[s.verifyStatText, { color: '#10B981' }]}>{stats.verifiedClubs}</Text>
              </View>
              <View style={[s.verifyStatPill, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="pending" size={10} color="#D97706" />
                <Text style={[s.verifyStatText, { color: '#D97706' }]}>{unverifiedClubs.length}</Text>
              </View>
              <MaterialIcons name={showClubVerification ? 'expand-less' : 'expand-more'} size={18} color="#94A3B8" />
            </View>
          </Pressable>
          {showClubVerification ? (
            <View style={s.verifySection}>
              {unverifiedClubs.length === 0 ? (
                <View style={s.verifyEmpty}>
                  <MaterialIcons name="verified" size={32} color="#CBD5E1" />
                  <Text style={s.verifyEmptyText}>{fr ? 'Tous les clubs sont verifies' : 'All clubs are verified'}</Text>
                </View>
              ) : (
                unverifiedClubs.slice(0, 8).map(club => {
                  const criteria = [
                    { key: 'address', met: !!club.address, label: fr ? 'Adresse' : 'Address', icon: 'place' },
                    { key: 'members', met: club.membersCount >= 2, label: fr ? '2+ membres' : '2+ members', icon: 'people' },
                    { key: 'desc', met: !!club.description, label: 'Description', icon: 'description' },
                    { key: 'public', met: club.isPublic, label: fr ? 'Public' : 'Public', icon: 'public' },
                  ];
                  const metCount = criteria.filter(c => c.met).length;
                  const canVerify = metCount >= 3;
                  return (
                    <View key={club.id} style={s.verifyCard}>
                      <View style={s.verifyCardHeader}>
                        <View style={s.verifyClubIcon}>
                          <MaterialIcons name="home" size={18} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.verifyClubName} numberOfLines={1}>{club.name}</Text>
                          <Text style={s.verifyClubCity}>{club.city} {"\u2022"} {club.membersCount} {fr ? 'membres' : 'members'}</Text>
                        </View>
                        <Pressable
                          style={[s.verifyBtn, canVerify ? { backgroundColor: '#2563EB' } : { backgroundColor: '#E2E8F0' }]}
                          onPress={async () => {
                            if (!canVerify) {
                              showAlert(fr ? 'Criteres insuffisants' : 'Insufficient criteria', fr ? 'Le club doit remplir au moins 3 criteres sur 4.' : 'Club must meet at least 3 of 4 criteria.');
                              return;
                            }
                            setVerifyingClubId(club.id);
                            Haptics.selectionAsync();
                            const supabase = getSupabaseClient();
                            const { error } = await supabase.from('clubs').update({ is_verified: true, updated_at: new Date().toISOString() }).eq('id', club.id);
                            setVerifyingClubId(null);
                            if (!error) {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              setUnverifiedClubs(prev => prev.filter(c => c.id !== club.id));
                              setStats(prev => ({ ...prev, verifiedClubs: prev.verifiedClubs + 1 }));
                              logAdminAction({ actionType: 'club_verify', targetType: 'club', targetId: club.id, targetName: club.name, actionDetail: `Verified club: ${club.name} (${club.city})`, metadata: { criteria: criteria.map(c => ({ ...c })) } });
                              // Send push notification to club owner
                              try {
                                const { data: clubOwner } = await supabase.from('clubs').select('user_id').eq('id', club.id).single();
                                if (clubOwner?.user_id) {
                                  supabase.functions.invoke('send-push', { body: { type: 'club_verification', payload: { targetUserId: clubOwner.user_id, clubName: club.name, clubId: club.id } } });
                                }
                              } catch { /* silent */ }
                            }
                          }}
                          disabled={verifyingClubId === club.id}
                        >
                          {verifyingClubId === club.id ? <ActivityIndicator size="small" color="#FFF" /> : (
                            <><MaterialIcons name="verified" size={14} color={canVerify ? '#FFF' : '#94A3B8'} /><Text style={[s.verifyBtnText, !canVerify && { color: '#94A3B8' }]}>{fr ? 'Verifier' : 'Verify'}</Text></>
                          )}
                        </Pressable>
                      </View>
                      <View style={s.criteriaRow}>
                        {criteria.map(c => (
                          <View key={c.key} style={[s.criteriaChip, c.met ? { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' } : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                            <MaterialIcons name={c.met ? 'check-circle' : 'cancel'} size={10} color={c.met ? '#10B981' : '#EF4444'} />
                            <Text style={[s.criteriaText, { color: c.met ? '#10B981' : '#EF4444' }]}>{c.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })
              )}
              {unverifiedClubs.length > 8 ? (
                <Text style={s.verifyMore}>+{unverifiedClubs.length - 8} {fr ? 'clubs restants' : 'more clubs'}</Text>
              ) : null}
            </View>
          ) : null}
        </Animated.View>

          );

          if (wKey === 'eloDistribution' && eloDistribution.length > 0) return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <Text style={s.sectionTitle}>{fr ? 'DISTRIBUTION ELO' : 'ELO DISTRIBUTION'}</Text>
            <View style={s.chartCard}>
              {(() => {
                const totalElo = eloDistribution.reduce((sum, e) => sum + e.count, 0) || 1;
                return eloDistribution.map((e, idx) => (
                  <View key={idx} style={s.chartRow}>
                    <View style={[s.eloTierDot, { backgroundColor: e.color }]} />
                    <Text style={[s.chartLabel, { width: 64 }]}>{e.label}</Text>
                    <View style={s.chartBarBg}>
                      <View style={[s.chartBarFill, { width: `${Math.max(2, (e.count / totalElo) * 100)}%`, backgroundColor: e.color }]} />
                    </View>
                    <Text style={s.chartValue}>{e.count}</Text>
                    <Text style={s.chartPercent}>{Math.round((e.count / totalElo) * 100)}%</Text>
                  </View>
                ));
              })()}
            </View>
          </Animated.View>
          );

          if (wKey === 'onboarding') return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <Text style={s.sectionTitle}>ONBOARDING</Text>
            <View style={s.chartCard}>
              {/* Step-level funnel (from tracking table) */}
              {stepAnalytics && stepAnalytics.steps.length > 0 ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="funnel-chart" size={16} color="#3B82F6" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{fr ? 'Entonnoir par etape' : 'Step Funnel'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '600' }}>{stepAnalytics.totalSessions} sessions</Text>
                      <View style={{ backgroundColor: stepAnalytics.completionRate >= 50 ? '#DCFCE7' : '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: stepAnalytics.completionRate >= 50 ? '#10B981' : '#D97706' }}>{stepAnalytics.completionRate}%</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ gap: 4 }}>
                    {stepAnalytics.steps.filter(st => st.step >= 1).map((st, idx) => {
                      const maxEntered = Math.max(...stepAnalytics.steps.filter(s => s.step >= 1).map(s => s.entered), 1);
                      const pct = maxEntered > 0 ? Math.round((st.entered / maxEntered) * 100) : 0;
                      const stepColors = ['#3B82F6', '#10B981', '#F59E0B', '#7C3AED', '#0EA5E9', '#EC4899', '#D97706', '#EF4444'];
                      const color = stepColors[idx % stepColors.length];
                      return (
                        <View key={st.step}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <Text style={{ width: 18, fontSize: 9, fontWeight: '800', color: '#94A3B8', textAlign: 'center' }}>{st.step}</Text>
                            <Text style={{ flex: 1, fontSize: 10, fontWeight: '600', color: '#0F172A' }}>{st.name}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '800', color }}>{st.entered}</Text>
                            {st.avgDurationSec > 0 ? <Text style={{ fontSize: 8, color: '#94A3B8', width: 28, textAlign: 'right' }}>{st.avgDurationSec}s</Text> : null}
                            {st.dropoffRate > 20 ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} /> : null}
                          </View>
                          <View style={{ height: 5, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginLeft: 24, marginBottom: 3 }}>
                            <View style={{ height: '100%' as any, width: `${Math.max(3, pct)}%`, backgroundColor: color, borderRadius: 3 }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  {/* Summary row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8 }}>
                    {stepAnalytics.avgTotalDurationSec > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialIcons name="timer" size={12} color="#3B82F6" />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748B' }}>{fr ? 'Duree moy.' : 'Avg duration'}: {Math.floor(stepAnalytics.avgTotalDurationSec / 60)}m{stepAnalytics.avgTotalDurationSec % 60}s</Text>
                      </View>
                    ) : null}
                    {stepAnalytics.topDropoffStep ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#EF4444' }} />
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#DC2626' }}>{fr ? 'Abandon' : 'Dropoff'}: {stepAnalytics.topDropoffStep}</Text>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  {/* Fallback: user_profiles-based funnel */}
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {[
                      { label: fr ? 'Inscrits' : 'Registered', count: onboardingStats.total, color: '#3B82F6', icon: 'person-add' },
                      { label: fr ? 'Profil complete' : 'Profile completed', count: onboardingStats.withProfile, color: '#10B981', icon: 'badge' },
                      { label: fr ? 'Consentement donne' : 'Consent given', count: onboardingStats.withConsent, color: '#7C3AED', icon: 'verified-user' },
                    ].map((step, idx) => {
                      const pct = onboardingStats.total > 0 ? Math.round((step.count / onboardingStats.total) * 100) : 0;
                      return (
                        <View key={idx}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: step.color + '12', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name={step.icon as any} size={14} color={step.color} />
                            </View>
                            <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#0F172A' }}>{step.label}</Text>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: step.color }}>{step.count}</Text>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: '#94A3B8', width: 32, textAlign: 'right' }}>{pct}%</Text>
                          </View>
                          <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginLeft: 36 }}>
                            <View style={{ height: '100%' as any, width: `${Math.max(3, pct)}%`, backgroundColor: step.color, borderRadius: 3 }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="funnel-chart" size={14} color="#3B82F6" />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B' }}>{fr ? 'Taux de completion' : 'Completion rate'}</Text>
                    </View>
                    <View style={{ backgroundColor: onboardingStats.conversionRate >= 70 ? '#DCFCE7' : onboardingStats.conversionRate >= 40 ? '#FEF3C7' : '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: onboardingStats.conversionRate >= 70 ? '#10B981' : onboardingStats.conversionRate >= 40 ? '#D97706' : '#EF4444' }}>{onboardingStats.conversionRate}%</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8 }}>
                    <MaterialIcons name="info-outline" size={14} color="#3B82F6" />
                    <Text style={{ flex: 1, fontSize: 10, color: '#3B82F6', lineHeight: 14 }}>
                      {fr ? 'Le tracking detaille par etape sera disponible quand des utilisateurs passeront l\'onboarding.' : 'Detailed step tracking will appear once users go through onboarding.'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </Animated.View>
          );

          if (wKey === 'pushAnalytics') return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <Text style={s.sectionTitle}>PUSH ANALYTICS</Text>
            <View style={s.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={[s.metricIcon, { backgroundColor: '#DBEAFE' }]}>
                  <MaterialIcons name="send" size={18} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#3B82F6' }}>{pushStats.sent}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.3 }}>{fr ? 'Notifications envoyees' : 'Notifications sent'}</Text>
                </View>
              </View>
              {Object.keys(pushStats.types).length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>{fr ? 'Par type de cible' : 'By target type'}</Text>
                  {(() => {
                    const maxPush = Math.max(...Object.values(pushStats.types), 1);
                    const typeColors: Record<string, string> = { all: '#3B82F6', city: '#10B981', club: '#7C3AED', level: '#D97706' };
                    return Object.entries(pushStats.types).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <View key={type} style={s.chartRow}>
                        <Text style={[s.chartLabel, { width: 56 }]}>{type === 'all' ? (fr ? 'Tous' : 'All') : type}</Text>
                        <View style={s.chartBarBg}>
                          <View style={[s.chartBarFill, { width: `${Math.max(4, (count / maxPush) * 100)}%`, backgroundColor: typeColors[type] || '#94A3B8' }]} />
                        </View>
                        <Text style={s.chartValue}>{count}</Text>
                      </View>
                    ));
                  })()}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <MaterialIcons name="notifications-off" size={24} color="#CBD5E1" />
                  <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{fr ? 'Aucune notification envoyee' : 'No notifications sent yet'}</Text>
                </View>
              )}
            </View>
          </Animated.View>
          );

          if (wKey === 'navigation') return (
        <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
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
                  {section.key === 'notifications' && adminNotifCount > 0 ? (
                    <View style={[s.navBadge, { backgroundColor: '#FEF2F2' }]}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#DC2626' }} />
                      <Text style={[s.navBadgeText, { color: '#DC2626' }]}>{adminNotifCount}</Text>
                    </View>
                  ) : null}
                  <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>
          );

          return null;
        })}
      </ScrollView>
      <AdminSearchModal visible={showSearch} onClose={() => setShowSearch(false)} language={language} />
    </SafeAreaView>
    </AdminGuard>
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

  // Polling indicator
  pollingIndicator: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, alignSelf: 'flex-end' as const, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#DCFCE7', marginBottom: 8 },
  pollingDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10B981' },
  pollingText: { fontSize: 10, fontWeight: '600' as const, color: '#10B981' },

  // Chart styles
  chartCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  chartRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 8 },
  chartLabel: { fontSize: 10, fontWeight: '600' as const, color: '#94A3B8', width: 48 },
  chartBarBg: { flex: 1, height: 18, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden' as const },
  chartBarFill: { height: '100%' as any, borderRadius: 5 },
  chartValue: { fontSize: 12, fontWeight: '800' as const, color: '#0F172A', width: 28, textAlign: 'right' as const },
  chartPercent: { fontSize: 10, fontWeight: '600' as const, color: '#94A3B8', width: 28, textAlign: 'right' as const },
  chartFooter: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  chartFooterText: { fontSize: 11, fontWeight: '600' as const, color: '#10B981' },
  eloTierDot: { width: 10, height: 10, borderRadius: 5 },

  // Growth header
  growthHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 0 },
  growthDelta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  growthDeltaText: { fontSize: 11, fontWeight: '800' as const },
  growthExportBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: '#DBEAFE' },

  // Appeal push button
  appealPushBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginTop: 8 },
  appealPushText: { fontSize: 11, fontWeight: '700' as const, color: '#DC2626' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: '#0F172A' },

  // Widget settings
  widgetToggle: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'space-between' as const, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#F1F5F9' },
  widgetToggleText: { flex: 1, fontSize: 13, fontWeight: '600' as const, color: '#0F172A' },
  widgetDot: { width: 10, height: 10, borderRadius: 5 },

  // Club verification
  verifyHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 6, marginTop: 8 },
  verifyStats: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  verifyStatPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  verifyStatText: { fontSize: 11, fontWeight: '800' as const },
  verifySection: { marginBottom: 16 },
  verifyEmpty: { alignItems: 'center' as const, paddingVertical: 28, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 8 },
  verifyEmptyText: { fontSize: 13, fontWeight: '600' as const, color: '#94A3B8' },
  verifyCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  verifyCardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 8 },
  verifyClubIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#7C3AED12', alignItems: 'center' as const, justifyContent: 'center' as const },
  verifyClubName: { fontSize: 14, fontWeight: '700' as const, color: '#0F172A' },
  verifyClubCity: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  verifyBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  verifyBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#FFF' },
  criteriaRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 4 },
  criteriaChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  criteriaText: { fontSize: 9, fontWeight: '700' as const },
  verifyMore: { fontSize: 12, fontWeight: '600' as const, color: '#94A3B8', textAlign: 'center' as const, marginTop: 4 },

  // Activity Log
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  activityViewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#EFF6FF' },
  activityViewAllText: { fontSize: 11, fontWeight: '700', color: '#3B82F6' },
  activityCard: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 16, marginTop: 10 },
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
