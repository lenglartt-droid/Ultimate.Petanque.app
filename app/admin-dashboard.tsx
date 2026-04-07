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

import * as Haptics from '@/services/haptics';

// Animations removed for admin performance
const NoAnimView = ({ entering, ...props }: any) => <View {...props} />;
const Animated = { View: NoAnimView };
const _noop: any = () => _noop; _noop.duration = _noop; _noop.delay = _noop; _noop.springify = _noop; _noop.damping = _noop;
const FadeInDown = _noop; const FadeIn = _noop; const FadeInUp = _noop;
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { getSupabaseClient } from '@/template';
import { AdminActivityLog, ACTION_CONFIG } from '@/services/adminActivityLogService';
import { getEloRank } from '@/services/eloService';
import { logAdminAction } from '@/services/adminActivityLogService';
import { useAlert } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminQuickNav from '@/components/feature/AdminQuickNav';
import AdminSearchModal from '@/components/feature/AdminSearchModal';
import AdminGuard from '@/components/feature/AdminGuard';
import { OnboardingAnalytics, StepAnalytics } from '@/services/onboardingAnalyticsService';
import PageErrorBoundary from '@/components/ui/PageErrorBoundary';
import { DashboardSkeleton } from '@/components/ui/AdminSkeleton';


interface TransferStats {
  pending: number;
  accepted: number;
  declined: number;
  acceptanceRate: number;
  avgResponseTimeHours: number;
  weeklyEvolution: { week: string; count: number; accepted: number; declined: number }[];
  topSenders: { name: string; count: number; accepted: number }[];
  recent: { id: string; playerName: string; senderName: string; recipientName: string; status: string; matchCount: number; challengeCount: number; createdAt: string }[];
}

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
  const [pushStats, setPushStats] = useState({ sent: 0, errors: 0, types: {} as Record<string, number>, daily: [] as { date: string; sent: number; errors: number }[] });

  // Push token analytics
  const [pushTokenStats, setPushTokenStats] = useState<{ totalTokens: number; activeTokens: number; inactiveTokens: number; usersWithToken: number; coverage: number; deactivatedThisWeek: number; platforms: Record<string, number> }>({ totalTokens: 0, activeTokens: 0, inactiveTokens: 0, usersWithToken: 0, coverage: 0, deactivatedThisWeek: 0, platforms: {} });

  // Onboarding analytics
  const [onboardingStats, setOnboardingStats] = useState<{ total: number; withProfile: number; withConsent: number; withRole: number; conversionRate: number; avgDaysToProfile: number }>({ total: 0, withProfile: 0, withConsent: 0, withRole: 0, conversionRate: 0, avgDaysToProfile: 0 });

  // Onboarding step-level analytics
  const [stepAnalytics, setStepAnalytics] = useState<OnboardingAnalytics | null>(null);

  // PDF export
  const [exportingPdf, setExportingPdf] = useState(false);

  // Club health alerts
  const [decliningClubs, setDecliningClubs] = useState<{ id: string; name: string; city: string; score: number; prevScore: number; delta: number; color: string }[]>([]);

  // Search modal
  const [showSearch, setShowSearch] = useState(false);

  // Transfer stats
  const [transferStats, setTransferStats] = useState<TransferStats>({ pending: 0, accepted: 0, declined: 0, acceptanceRate: 0, avgResponseTimeHours: 0, weeklyEvolution: [], topSenders: [], recent: [] });

  // Widget order (persisted)
  const DEFAULT_ORDER = ['overview', 'smartAlerts', 'transfers', 'clubHealthAlerts', 'onboarding', 'pushAnalytics', 'pushTokenAnalytics', 'moderation', 'appeals', 'activity', 'weeklyMatches', 'userGrowth', 'clubVerification', 'eloDistribution', 'navigation'];
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

      // ── Single edge function call replaces 16+ parallel queries ──
      const { data, error } = await supabase.functions.invoke('admin-stats', { body: {} });

      if (error) {
        let errorMessage = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const textContent = await error.context?.text();
            errorMessage = textContent || error.message;
          } catch { /* silent */ }
        }
        console.log('[AdminDashboard] Edge function error:', errorMessage);
        return;
      }

      if (!data) {
        console.log('[AdminDashboard] No data returned from admin-stats');
        return;
      }

      // ── Map server response to local state ──
      const res = data as any;
      const serverStats = res.stats;

      setStats({
        totalUsers: serverStats.totalUsers || 0,
        premiumUsers: serverStats.premiumUsers || 0,
        totalPlayers: serverStats.totalPlayers || 0,
        totalTerrains: serverStats.totalTerrains || 0,
        totalClubs: serverStats.totalClubs || 0,
        verifiedClubs: serverStats.verifiedClubs || 0,
        totalMatches: serverStats.totalMatches || 0,
        pendingReports: serverStats.pendingReports || 0,
        activeWarnings: serverStats.activeWarnings || 0,
        activeBans: serverStats.activeBans || 0,
        totalAnnouncements: serverStats.totalAnnouncements || 0,
        flaggedPlayers: serverStats.flaggedPlayers || 0,
        maintenanceActive: serverStats.maintenanceActive || false,
        maintenanceScheduled: serverStats.maintenanceScheduled || false,
        pendingAppeals: serverStats.pendingAppeals || 0,
        overdueAppeals: serverStats.overdueAppeals || 0,
      });

      // Weekly matches (server returns en-US labels; re-localize if fr)
      const wm = (res.weeklyMatches || []) as { week: string; count: number }[];
      setWeeklyMatches(wm);

      // ELO distribution
      const elo = res.eloDistribution || { bronze: 0, silver: 0, gold: 0, diamond: 0, master: 0 };
      setEloDistribution([
        { tier: 'master', count: elo.master, color: '#F59E0B', label: fr ? 'Maitre' : 'Master' },
        { tier: 'diamond', count: elo.diamond, color: '#8B5CF6', label: fr ? 'Diamant' : 'Diamond' },
        { tier: 'gold', count: elo.gold, color: '#D4A017', label: fr ? 'Or' : 'Gold' },
        { tier: 'silver', count: elo.silver, color: '#94A3B8', label: fr ? 'Argent' : 'Silver' },
        { tier: 'bronze', count: elo.bronze, color: '#CD7F32', label: 'Bronze' },
      ]);

      // Monthly growth
      setMonthlyGrowth(res.monthlyGrowth || []);
      setGrowthDelta(res.growthDelta || 0);
      setRecentSignups(res.recentSignups || 0);

      // Unverified clubs
      setUnverifiedClubs((res.unverifiedClubs || []).map((c: any) => ({
        id: c.id, name: c.name, city: c.city, membersCount: c.membersCount || 0,
        description: c.description || null, address: c.address || null,
        contactEmail: c.contactEmail || null, isPublic: c.isPublic || false,
      })));

      // Push analytics
      setPushStats(res.pushAnalytics || { sent: 0, errors: 0, types: {}, daily: [] });

      // Push token analytics
      if (res.pushTokenAnalytics) setPushTokenStats(res.pushTokenAnalytics);

      // Activity logs
      setActivityLogs((res.activityLogs || []).map((l: any) => ({
        id: l.id, adminUserId: l.adminUserId, adminName: l.adminName,
        actionType: l.actionType, actionDetail: l.actionDetail,
        targetType: l.targetType, targetId: l.targetId, targetName: l.targetName,
        metadata: l.metadata || {}, createdAt: l.createdAt,
      })));

      // Declining clubs
      setDecliningClubs(res.decliningClubs || []);

      // Player transfers (client-side fetch since not in edge function)
      try {
        const { data: transferData } = await supabase.from('player_transfer_requests').select('id, player_name, sender_user_id, recipient_user_id, status, match_count, challenge_count, created_at, updated_at').order('created_at', { ascending: false }).limit(100);
        if (transferData && transferData.length > 0) {
          const pendingT = transferData.filter((t: any) => t.status === 'pending').length;
          const acceptedT = transferData.filter((t: any) => t.status === 'accepted').length;
          const declinedT = transferData.filter((t: any) => t.status === 'declined').length;
          const resolved = acceptedT + declinedT;
          const acceptanceRate = resolved > 0 ? Math.round((acceptedT / resolved) * 100) : 0;

          // Average response time (hours) for non-pending requests
          let totalResponseMs = 0;
          let responseCount = 0;
          transferData.forEach((t: any) => {
            if (t.status !== 'pending' && t.updated_at && t.created_at) {
              const diff = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
              if (diff > 0) { totalResponseMs += diff; responseCount++; }
            }
          });
          const avgResponseTimeHours = responseCount > 0 ? Math.round((totalResponseMs / responseCount / 3600000) * 10) / 10 : 0;

          // Weekly evolution (last 6 weeks)
          const weeklyMap: Record<string, { count: number; accepted: number; declined: number }> = {};
          const now = Date.now();
          transferData.forEach((t: any) => {
            const created = new Date(t.created_at);
            const weeksAgo = Math.floor((now - created.getTime()) / (7 * 86400000));
            if (weeksAgo < 6) {
              const weekStart = new Date(now - weeksAgo * 7 * 86400000);
              const label = weekStart.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
              if (!weeklyMap[label]) weeklyMap[label] = { count: 0, accepted: 0, declined: 0 };
              weeklyMap[label].count++;
              if (t.status === 'accepted') weeklyMap[label].accepted++;
              if (t.status === 'declined') weeklyMap[label].declined++;
            }
          });
          const weeklyEvolution = Object.entries(weeklyMap).map(([week, d]) => ({ week, ...d })).reverse();

          // Top senders
          const senderMap: Record<string, { count: number; accepted: number; userId: string }> = {};
          transferData.forEach((t: any) => {
            if (!senderMap[t.sender_user_id]) senderMap[t.sender_user_id] = { count: 0, accepted: 0, userId: t.sender_user_id };
            senderMap[t.sender_user_id].count++;
            if (t.status === 'accepted') senderMap[t.sender_user_id].accepted++;
          });

          const userIds = [...new Set(transferData.flatMap((t: any) => [t.sender_user_id, t.recipient_user_id]))];
          const { data: profiles } = await supabase.from('user_profiles').select('id, username, email').in('id', userIds);
          const profileMap: Record<string, string> = {};
          (profiles || []).forEach((p: any) => { profileMap[p.id] = p.username || p.email || '?'; });

          const topSenders = Object.values(senderMap)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(s2 => ({ name: profileMap[s2.userId] || '?', count: s2.count, accepted: s2.accepted }));

          setTransferStats({
            pending: pendingT, accepted: acceptedT, declined: declinedT,
            acceptanceRate, avgResponseTimeHours, weeklyEvolution, topSenders,
            recent: transferData.slice(0, 10).map((t: any) => ({
              id: t.id, playerName: t.player_name, senderName: profileMap[t.sender_user_id] || '?',
              recipientName: profileMap[t.recipient_user_id] || '?', status: t.status,
              matchCount: t.match_count || 0, challengeCount: t.challenge_count || 0, createdAt: t.created_at,
            })),
          });
        }
      } catch { /* silent - RLS may block if not admin */ }

      // Onboarding
      if (res.onboardingStats) setOnboardingStats(res.onboardingStats);
      if (res.onboardingAnalytics) setStepAnalytics(res.onboardingAnalytics);

      // ── Smart alerts (computed client-side from server data) ──
      const detectedAlerts: typeof smartAlerts = [];
      const pendingCount = serverStats.pendingReports || 0;
      if (pendingCount >= 5) detectedAlerts.push({ id: 'report_spike', severity: 'critical', title: fr ? 'Pic de signalements' : 'Report spike', message: fr ? `${pendingCount} signalements en attente. Intervention recommandee.` : `${pendingCount} pending reports. Action recommended.`, icon: 'warning', color: '#DC2626', route: '/admin-moderation' });
      else if (pendingCount >= 3) detectedAlerts.push({ id: 'reports_pending', severity: 'warning', title: fr ? 'Signalements en attente' : 'Pending reports', message: fr ? `${pendingCount} signalement(s) a traiter.` : `${pendingCount} report(s) to review.`, icon: 'gavel', color: '#D97706', route: '/admin-moderation' });

      if (wm.length >= 2) {
        const thisW = wm[wm.length - 1]?.count || 0;
        const lastW = wm[wm.length - 2]?.count || 0;
        if (lastW > 0 && thisW < lastW * 0.7) detectedAlerts.push({ id: 'match_decline', severity: 'warning', title: fr ? 'Baisse d\'activite matchs' : 'Match activity decline', message: fr ? `${thisW} matchs cette semaine vs ${lastW} la semaine derniere (-${Math.round((1 - thisW / lastW) * 100)}%)` : `${thisW} matches this week vs ${lastW} last week (-${Math.round((1 - thisW / lastW) * 100)}%)`, icon: 'trending-down', color: '#EF4444' });
      }

      const unverifiedCount = (res.unverifiedClubs || []).length;
      const totalClubsCount = serverStats.totalClubs || 1;
      const inactiveClubsPct = totalClubsCount > 0 ? Math.round((unverifiedCount / totalClubsCount) * 100) : 0;
      if (inactiveClubsPct > 50) detectedAlerts.push({ id: 'unverified_clubs', severity: 'info', title: fr ? 'Clubs non verifies' : 'Unverified clubs', message: fr ? `${inactiveClubsPct}% des clubs ne sont pas verifies.` : `${inactiveClubsPct}% of clubs are not verified.`, icon: 'pending', color: '#D97706', route: '/admin-clubs' });
      if ((res.recentSignups || 0) === 0) detectedAlerts.push({ id: 'no_signups', severity: 'info', title: fr ? 'Aucune inscription recente' : 'No recent signups', message: fr ? 'Aucun nouvel utilisateur cette semaine.' : 'No new users this week.', icon: 'person-off', color: '#94A3B8' });
      const overdueCount = serverStats.overdueAppeals || 0;
      if (overdueCount > 0) detectedAlerts.push({ id: 'overdue_appeals', severity: 'critical', title: fr ? 'Appels en retard' : 'Overdue appeals', message: fr ? `${overdueCount} appel(s) en attente depuis +48h.` : `${overdueCount} appeal(s) pending for 48h+.`, icon: 'timer-off', color: '#DC2626', route: '/admin-moderation' });
      if (unverifiedCount > 5 && inactiveClubsPct > 60) detectedAlerts.push({ id: 'declining_clubs', severity: 'warning', title: fr ? 'Clubs a risque' : 'At-risk clubs', message: fr ? `${inactiveClubsPct}% des clubs ne sont pas verifies. Examinez les tendances de sante.` : `${inactiveClubsPct}% of clubs are unverified. Review health trends.`, icon: 'trending-down', color: '#D97706', route: '/admin-clubs' });

      setSmartAlerts(detectedAlerts);
      setAdminNotifCount(detectedAlerts.filter(a => a.severity === 'critical' || a.severity === 'warning').length + (serverStats.pendingAppeals || 0) + pendingCount);

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
          <Pressable style={s.backBtn} onPress={() => router.push('/profile' as any)}>
            <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <Text style={s.headerTitle}>Admin</Text>
          <View style={{ width: 40 }} />
        </View>
        <AdminQuickNav currentRoute="/admin-dashboard" />
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <DashboardSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <PageErrorBoundary pageName="Dashboard">
    <AdminGuard language={language}>
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.push('/profile' as any)}>
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
                const PrintModule = require('expo-print');
                const { uri } = await PrintModule.printToFileAsync({ html, base64: false });
                if (uri) {
                  const SharingModule = require('expo-sharing');
                  const canShare = await SharingModule.isAvailableAsync();
                  if (canShare) await SharingModule.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fr ? 'Rapport Admin PDF' : 'Admin Report PDF' });
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
                { key: 'transfers', label: fr ? 'Transferts joueurs' : 'Player Transfers', icon: 'swap-horiz' },
                { key: 'onboarding', label: 'Onboarding', icon: 'person-add' },
                { key: 'clubHealthAlerts', label: fr ? 'Sante clubs' : 'Club Health', icon: 'favorite' },
                { key: 'pushAnalytics', label: fr ? 'Push Analytics' : 'Push Analytics', icon: 'send' },
                { key: 'pushTokenAnalytics', label: fr ? 'Tokens Push' : 'Push Tokens', icon: 'phonelink-ring' },
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

          if (wKey === 'transfers') return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <Text style={s.sectionTitle}>{fr ? 'TRANSFERTS JOUEURS' : 'PLAYER TRANSFERS'}</Text>
            <View style={s.chartCard}>
              {/* KPI row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#F59E0B08', borderRadius: 12, paddingVertical: 12, gap: 2, borderWidth: 1, borderColor: '#F59E0B20' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#F59E0B' }}>{transferStats.pending}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'En attente' : 'Pending'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#10B98108', borderRadius: 12, paddingVertical: 12, gap: 2, borderWidth: 1, borderColor: '#10B98120' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#10B981' }}>{transferStats.accepted}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'Acceptes' : 'Accepted'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#EF444408', borderRadius: 12, paddingVertical: 12, gap: 2, borderWidth: 1, borderColor: '#EF444420' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#EF4444' }}>{transferStats.declined}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'Refuses' : 'Declined'}</Text>
                </View>
              </View>

              {/* Analytics row: acceptance rate + avg response time */}
              {(transferStats.accepted + transferStats.declined) > 0 ? (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: transferStats.acceptanceRate >= 60 ? '#DCFCE7' : transferStats.acceptanceRate >= 30 ? '#FEF3C7' : '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="pie-chart" size={14} color={transferStats.acceptanceRate >= 60 ? '#10B981' : transferStats.acceptanceRate >= 30 ? '#D97706' : '#EF4444'} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: transferStats.acceptanceRate >= 60 ? '#10B981' : transferStats.acceptanceRate >= 30 ? '#D97706' : '#EF4444' }}>{transferStats.acceptanceRate}%</Text>
                      <Text style={{ fontSize: 8, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase' }}>{fr ? 'Taux accept.' : 'Accept rate'}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="timer" size={14} color="#3B82F6" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#3B82F6' }}>{transferStats.avgResponseTimeHours < 1 ? '<1' : transferStats.avgResponseTimeHours}h</Text>
                      <Text style={{ fontSize: 8, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase' }}>{fr ? 'Temps moy.' : 'Avg response'}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Weekly evolution chart */}
              {transferStats.weeklyEvolution.length > 1 ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 8 }}>{fr ? 'Evolution par semaine' : 'Weekly evolution'}</Text>
                  {(() => {
                    const maxW = Math.max(...transferStats.weeklyEvolution.map(w => w.count), 1);
                    return transferStats.weeklyEvolution.map((w, idx) => {
                      const isLast = idx === transferStats.weeklyEvolution.length - 1;
                      return (
                        <View key={w.week} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ width: 42, fontSize: 9, fontWeight: isLast ? '800' : '600', color: isLast ? '#0EA5E9' : '#94A3B8' }}>{w.week}</Text>
                          <View style={{ flex: 1, height: 16, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }}>
                            {w.accepted > 0 ? <View style={{ height: '100%' as any, width: `${Math.max(2, (w.accepted / maxW) * 100)}%`, backgroundColor: '#10B981', borderRadius: 4 }} /> : null}
                            {w.declined > 0 ? <View style={{ height: '100%' as any, width: `${Math.max(1, (w.declined / maxW) * 100)}%`, backgroundColor: '#EF4444' }} /> : null}
                            {(w.count - w.accepted - w.declined) > 0 ? <View style={{ height: '100%' as any, width: `${Math.max(1, ((w.count - w.accepted - w.declined) / maxW) * 100)}%`, backgroundColor: '#F59E0B' }} /> : null}
                          </View>
                          <Text style={{ width: 20, fontSize: 10, fontWeight: '800', color: '#0F172A', textAlign: 'right' }}>{w.count}</Text>
                        </View>
                      );
                    });
                  })()}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, justifyContent: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#10B981' }} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: '#94A3B8' }}>{fr ? 'Accepte' : 'Accepted'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#EF4444' }} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: '#94A3B8' }}>{fr ? 'Refuse' : 'Declined'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#F59E0B' }} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: '#94A3B8' }}>{fr ? 'Attente' : 'Pending'}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Top senders */}
              {transferStats.topSenders.length > 0 ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 8 }}>{fr ? 'Top expediteurs' : 'Top senders'}</Text>
                  {transferStats.topSenders.map((sender, idx) => {
                    const senderAcceptRate = sender.count > 0 ? Math.round((sender.accepted / sender.count) * 100) : 0;
                    return (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#F1F5F9' }}>
                        <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: idx === 0 ? '#0EA5E9' : '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: idx === 0 ? '#FFF' : '#94A3B8' }}>{idx + 1}</Text>
                        </View>
                        <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>{sender.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#0EA5E9' }}>{sender.count}</Text>
                          <View style={{ backgroundColor: senderAcceptRate >= 60 ? '#DCFCE7' : '#FEF3C7', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}>
                            <Text style={{ fontSize: 8, fontWeight: '700', color: senderAcceptRate >= 60 ? '#10B981' : '#D97706' }}>{senderAcceptRate}%</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {/* Recent transfers list */}
              {transferStats.recent.length > 0 ? (
                <View style={{ gap: 0 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 8 }}>{fr ? 'Recents' : 'Recent'}</Text>
                  {transferStats.recent.map((tr, idx) => {
                    const sc = tr.status === 'accepted' ? '#10B981' : tr.status === 'declined' ? '#EF4444' : '#F59E0B';
                    return (
                      <View key={tr.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#F1F5F9' }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: sc + '12', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialIcons name={tr.status === 'accepted' ? 'check-circle' : tr.status === 'declined' ? 'cancel' : 'schedule'} size={16} color={sc} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{tr.playerName}</Text>
                          <Text style={{ fontSize: 10, color: '#94A3B8' }}>{tr.senderName} → {tr.recipientName}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#0EA5E9' }}>{tr.matchCount}m</Text>
                            {tr.challengeCount > 0 ? <Text style={{ fontSize: 10, fontWeight: '700', color: '#7C3AED' }}>{tr.challengeCount}d</Text> : null}
                          </View>
                          <Text style={{ fontSize: 8, color: '#CBD5E1' }}>{new Date(tr.createdAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <MaterialIcons name="swap-horiz" size={24} color="#CBD5E1" />
                  <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>{fr ? 'Aucun transfert' : 'No transfers yet'}</Text>
                </View>
              )}
            </View>
          </Animated.View>
          );

          if (wKey === 'clubHealthAlerts' && decliningClubs.length > 0) return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <Text style={s.sectionTitle}>{fr ? 'CLUBS EN DECLIN' : 'DECLINING CLUBS'}</Text>
            <View style={s.chartCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <View style={[s.metricIcon, { backgroundColor: '#FEF2F2' }]}>
                  <MaterialIcons name="trending-down" size={18} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{decliningClubs.length} {fr ? 'club(s) en baisse' : 'declining club(s)'}</Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{fr ? 'Score de sante en baisse sur 30 jours' : 'Health score declining over 30 days'}</Text>
                </View>
              </View>
              {decliningClubs.map((club, idx) => (
                <Pressable
                  key={club.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#F1F5F9' }}
                  onPress={() => { Haptics.selectionAsync(); router.push(`/club/${club.id}` as any); }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: club.color + '12', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="home" size={16} color={club.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{club.name}</Text>
                    <Text style={{ fontSize: 10, color: '#94A3B8' }}>{club.city}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: club.color }}>{club.score}</Text>
                      <Text style={{ fontSize: 10, color: '#94A3B8' }}>/100</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <MaterialIcons name="trending-down" size={10} color="#EF4444" />
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#EF4444' }}>{club.delta}</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={16} color="#CBD5E1" />
                </Pressable>
              ))}
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}
                onPress={() => { Haptics.selectionAsync(); router.push('/admin-clubs' as any); }}
              >
                <MaterialIcons name="open-in-new" size={14} color="#3B82F6" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>{fr ? 'Voir tous les clubs' : 'View all clubs'}</Text>
              </Pressable>
            </View>
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
                      const FS = require('expo-file-system');
                      const SharingMod = require('expo-sharing');
                      const path = `${FS.cacheDirectory}growth-report-${new Date().toISOString().slice(0, 10)}.csv`;
                      await FS.writeAsStringAsync(path, csv, { encoding: FS.EncodingType.UTF8 });
                      const canShare = await SharingMod.isAvailableAsync();
                      if (canShare) await SharingMod.shareAsync(path, { mimeType: 'text/csv', dialogTitle: fr ? 'Exporter le rapport' : 'Export report' });
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
              {/* KPI row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 12, gap: 2 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#3B82F6' }}>{pushStats.sent}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'Envoyees' : 'Sent'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 12, gap: 2 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#EF4444' }}>{pushStats.errors || 0}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'Erreurs' : 'Errors'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 12, gap: 2 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#10B981' }}>
                    {pushStats.sent > 0 ? `${Math.round(((pushStats.sent - (pushStats.errors || 0)) / pushStats.sent) * 100)}%` : '-'}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'Livraison' : 'Delivery'}</Text>
                </View>
              </View>

              {/* Daily chart (last 7 days) */}
              {pushStats.daily && pushStats.daily.length > 0 ? (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 8 }}>{fr ? '7 derniers jours' : 'Last 7 days'}</Text>
                  {(() => {
                    const maxDaily = Math.max(...pushStats.daily.map(d => d.sent), 1);
                    return pushStats.daily.map((d, idx) => {
                      const dateLabel = new Date(d.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'short' });
                      const isToday = idx === pushStats.daily.length - 1;
                      return (
                        <View key={d.date} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={{ width: 32, fontSize: 9, fontWeight: isToday ? '800' : '600', color: isToday ? '#3B82F6' : '#94A3B8' }}>{dateLabel}</Text>
                          <View style={{ flex: 1, height: 16, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', flexDirection: 'row' }}>
                            <View style={{ height: '100%' as any, width: `${Math.max(2, (d.sent / maxDaily) * 100)}%`, backgroundColor: '#3B82F6', borderRadius: 4 }} />
                            {d.errors > 0 ? <View style={{ height: '100%' as any, width: `${Math.max(1, (d.errors / maxDaily) * 100)}%`, backgroundColor: '#EF4444', borderTopRightRadius: 4, borderBottomRightRadius: 4 }} /> : null}
                          </View>
                          <Text style={{ width: 24, fontSize: 10, fontWeight: '800', color: '#0F172A', textAlign: 'right' }}>{d.sent}</Text>
                          {d.errors > 0 ? <Text style={{ width: 20, fontSize: 9, fontWeight: '600', color: '#EF4444', textAlign: 'right' }}>-{d.errors}</Text> : null}
                        </View>
                      );
                    });
                  })()}
                  {/* Legend */}
                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, justifyContent: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#3B82F6' }} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: '#94A3B8' }}>{fr ? 'Envoye' : 'Sent'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#EF4444' }} />
                      <Text style={{ fontSize: 9, fontWeight: '600', color: '#94A3B8' }}>{fr ? 'Erreur' : 'Error'}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* By target type */}
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

          if (wKey === 'pushTokenAnalytics') return (
          <Animated.View key={wKey} entering={FadeInDown.duration(300).delay(wDelay)}>
            <Text style={s.sectionTitle}>{fr ? 'TOKENS PUSH' : 'PUSH TOKENS'}</Text>
            <View style={s.chartCard}>
              {/* KPI row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 12, gap: 2 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#10B981' }}>{pushTokenStats.activeTokens}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'Actifs' : 'Active'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 12, gap: 2 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#EF4444' }}>{pushTokenStats.inactiveTokens}</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'Inactifs' : 'Inactive'}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 12, gap: 2 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#3B82F6' }}>{pushTokenStats.coverage}%</Text>
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#64748B', textTransform: 'uppercase' }}>{fr ? 'Couverture' : 'Coverage'}</Text>
                </View>
              </View>

              {/* Users with token */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 }}>
                <MaterialIcons name="people" size={16} color="#3B82F6" />
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#0F172A' }}>
                  {pushTokenStats.usersWithToken} {fr ? 'utilisateurs avec token actif' : 'users with active token'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>
                  {pushTokenStats.usersWithToken}/{stats.totalUsers}
                </Text>
              </View>

              {/* Deactivated this week */}
              {pushTokenStats.deactivatedThisWeek > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10 }}>
                  <MaterialIcons name="warning-amber" size={16} color="#D97706" />
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E' }}>
                    {pushTokenStats.deactivatedThisWeek} {fr ? 'desactives cette semaine' : 'deactivated this week'}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '600' }}>DeviceNotRegistered</Text>
                </View>
              ) : null}

              {/* Platform breakdown */}
              {Object.keys(pushTokenStats.platforms).length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>{fr ? 'Par plateforme' : 'By platform'}</Text>
                  {(() => {
                    const maxPlatform = Math.max(...Object.values(pushTokenStats.platforms), 1);
                    const platformColors: Record<string, string> = { ios: '#000000', android: '#3DDC84', web: '#3B82F6', unknown: '#94A3B8' };
                    const platformIcons: Record<string, string> = { ios: 'phone-iphone', android: 'phone-android', web: 'computer', unknown: 'device-unknown' };
                    return Object.entries(pushTokenStats.platforms).sort((a, b) => b[1] - a[1]).map(([platform, count]) => (
                      <View key={platform} style={s.chartRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, width: 70 }}>
                          <MaterialIcons name={(platformIcons[platform] || 'device-unknown') as any} size={12} color={platformColors[platform] || '#94A3B8'} />
                          <Text style={[s.chartLabel, { width: 50 }]}>{platform}</Text>
                        </View>
                        <View style={s.chartBarBg}>
                          <View style={[s.chartBarFill, { width: `${Math.max(4, (count / maxPlatform) * 100)}%`, backgroundColor: platformColors[platform] || '#94A3B8' }]} />
                        </View>
                        <Text style={s.chartValue}>{count}</Text>
                      </View>
                    ));
                  })()}
                </View>
              ) : null}
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
    </PageErrorBoundary>
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
