/**
 * Admin Changelog
 * 
 * Displays app version history, release notes, and recent updates.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import AdminQuickNav from '@/components/feature/AdminQuickNav';

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  highlights: { icon: string; color: string; text: string }[];
  details: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.12.0',
    date: '2026-04-06',
    type: 'minor',
    highlights: [
      { icon: 'edit', text: 'Admin club edit/delete access', color: '#DC2626' },
      { icon: 'history', text: 'Claim history tab + admin merge undo', color: '#7C3AED' },
      { icon: 'update', text: 'Auto-updated changelog', color: '#3B82F6' },
    ],
    details: [
      'Admin can now edit or delete any club card from the management page',
      'Claim history tab shows all processed verifications/claims with status and dates',
      'Admin can view all user merge history and undo merges (no 24h limit)',
      'Changelog auto-syncs with app version from app.json',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-04-05',
    type: 'minor',
    highlights: [
      { icon: 'email', text: 'Club verification decision notifications', color: '#2563EB' },
      { icon: 'dashboard', text: 'Enhanced admin claims dashboard', color: '#10B981' },
    ],
    details: [
      'Push notification with decision summary when admin accepts/declines verification or claim',
      'Admin claims dashboard with stats banner, type filters, inline proof preview, and no-proof alert',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-04-04',
    type: 'minor',
    highlights: [
      { icon: 'checklist', text: 'Club verification checklist (6 steps)', color: '#F59E0B' },
      { icon: 'verified-user', text: 'Revised club verification/claim process', color: '#2563EB' },
      { icon: 'analytics', text: 'Analytics restricted to verified clubs', color: '#8B5CF6' },
    ],
    details: [
      'Verification checklist with 6 steps including admin proof upload as final step',
      'Claims and proofs now sent to admin team (not club owner) for validation',
      'Club creator becomes owner automatically; claim transfers ownership on admin approval',
      'Analytics page restricted to verified clubs; non-verified clubs see a locked info page',
      'Admin clubs page updated with pending verification/claim review section',
      'FAQ clubs section rewritten with new verification process and Analytics advantages',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-04-03',
    type: 'minor',
    highlights: [
      { icon: 'auto-awesome', text: '6th ELO league: Grand Master (2000+)', color: '#FFD700' },
      { icon: 'celebration', text: 'Enhanced league promotion modal', color: '#7C3AED' },
      { icon: 'sports', text: 'Match score adaptive font sizing', color: '#3B82F6' },
    ],
    details: [
      'Added Grand Master (Grand Maitre) as 6th ELO tier at 2000+ across all files',
      'League promotion modal enhanced with gold particles for Grand Master',
      'Match score box uses fixed width + adaptive font to prevent resizing at 10-13',
      'Directory ELO filter updated with 6 tiers',
      'FAQ updated with 6 leagues info in all relevant sections',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-04-02',
    type: 'minor',
    highlights: [
      { icon: 'shield', text: 'Admin Role Guard on all admin pages', color: '#DC2626' },
      { icon: 'refresh', text: 'Real-time dashboard polling (30s)', color: '#3B82F6' },
      { icon: 'merge-type', text: 'Enhanced terrain merge preview', color: '#10B981' },
      { icon: 'history', text: 'Admin changelog page', color: '#7C3AED' },
    ],
    details: [
      'Added AdminGuard component protecting all admin pages from non-admin access',
      'Dashboard auto-refreshes every 30 seconds with visual indicator',
      'Terrain merge now shows detailed impact preview (matches, tournaments, players, meetups)',
      'New changelog page accessible from the admin dashboard',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-03-28',
    type: 'minor',
    highlights: [
      { icon: 'search', text: 'Global admin search', color: '#3B82F6' },
      { icon: 'navigation', text: 'Admin quick nav bar', color: '#0F172A' },
      { icon: 'backup', text: 'Full data backup export (JSON)', color: '#7C3AED' },
      { icon: 'send', text: 'Push analytics widget', color: '#0EA5E9' },
    ],
    details: [
      'Search across users, clubs, terrains, and players from any admin page',
      'Horizontal navigation bar on all 13 admin pages',
      'One-click JSON backup of all user data from profile',
      'Push notification delivery stats and target type breakdown',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-03-22',
    type: 'minor',
    highlights: [
      { icon: 'dashboard', text: 'Consolidated admin dashboard', color: '#0F172A' },
      { icon: 'confirmation-number', text: 'Cleaned promo codes page', color: '#0EA5E9' },
      { icon: 'download', text: 'Audit log CSV export', color: '#10B981' },
    ],
    details: [
      'Removed 9 redundant admin links from profile - single dashboard entry point',
      'Promo codes page stripped of duplicate sections (sponsors, anticheat, reports)',
      'Audit log export with full/filtered modes and action type summary',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-03-15',
    type: 'minor',
    highlights: [
      { icon: 'lock', text: 'Password reset via OTP', color: '#DC2626' },
      { icon: 'notifications', text: 'Admin notification badge counter', color: '#EF4444' },
      { icon: 'map', text: 'Club map filters', color: '#7C3AED' },
      { icon: 'policy', text: 'Migrated 30 admin RLS policies', color: '#D97706' },
    ],
    details: [
      'Password reset flow with email OTP verification on login page',
      'Notification badge counter on admin dashboard',
      'Club map now supports All/Active/Verified/Inactive filters',
      'All admin policies migrated to is_admin() SECURITY DEFINER function',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-03-08',
    type: 'minor',
    highlights: [
      { icon: 'notifications-active', text: 'Admin notification center', color: '#DC2626' },
      { icon: 'compare-arrows', text: 'Club comparison with trends', color: '#0EA5E9' },
      { icon: 'assessment', text: 'Report PDF/CSV export', color: '#10B981' },
      { icon: 'map', text: 'Club map view with health colors', color: '#7C3AED' },
    ],
    details: [
      'Centralized admin notification hub with overdue appeals, pending reports, smart alerts',
      'Compare 2-3 clubs side-by-side with 6-month activity trends',
      'Weekly reports exportable as CSV with trend data and summary stats',
      'Club map with health score color-coding and verified badge markers',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-03-01',
    type: 'minor',
    highlights: [
      { icon: 'timeline', text: 'Club activity timeline', color: '#3B82F6' },
      { icon: 'warning', text: 'Smart dashboard alerts', color: '#EF4444' },
      { icon: 'trending-up', text: 'Enhanced weekly report details', color: '#10B981' },
    ],
    details: [
      'Club detail modals now show chronological timeline of matches, tournaments, member joins',
      'Auto-detect anomalies: report spikes, match drops, inactive clubs, zero signups',
      'Weekly cron generates detailed admin summary with key metrics',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-02-22',
    type: 'minor',
    highlights: [
      { icon: 'verified', text: 'Club verification flow', color: '#2563EB' },
      { icon: 'trending-up', text: 'User growth chart + export', color: '#10B981' },
      { icon: 'security', text: 'Permission audit logging', color: '#D97706' },
    ],
    details: [
      'Advanced club verification with 7 criteria, weighted completeness score, and improvement suggestions',
      'Monthly user growth chart with delta trend indicator and CSV export',
      'All co-admin permission changes logged with full audit trail',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-02-15',
    type: 'minor',
    highlights: [
      { icon: 'gavel', text: 'Full moderation system', color: '#DC2626' },
      { icon: 'rate-review', text: 'Ban appeal workflow', color: '#D97706' },
      { icon: 'sports-soccer', text: 'Terrain duplicate detection + merge', color: '#10B981' },
      { icon: 'history', text: 'Admin activity log', color: '#64748B' },
    ],
    details: [
      'Player report management with warn/suspend/ban/dismiss actions',
      'Ban appeals with 48h deadline tracking, auto-unban on accept, push reminders',
      'Duplicate terrain detection (<200m proximity + name similarity) with auto/manual merge',
      'Centralized audit trail with 20+ action types, admin attribution, and search',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-02-01',
    type: 'major',
    highlights: [
      { icon: 'rocket-launch', text: 'V1 Release', color: '#0F172A' },
      { icon: 'sports', text: 'Match tracking, ELO, badges', color: '#3B82F6' },
      { icon: 'people', text: 'Clubs, terrains, tournaments', color: '#7C3AED' },
      { icon: 'share', text: 'Social sharing + QR codes', color: '#10B981' },
    ],
    details: [
      'Complete petanque match and challenge tracking',
      '5-tier ELO ranking system with seasonal compression',
      '13+ unlockable badges with gamification',
      'Club management with ownership and co-admin system',
      'Terrain management with map integration',
      'Tournament bracket system',
      'Cross-player match sharing with QR codes',
      'FR/EN localization',
      'Offline sync with conflict resolution',
    ],
  },
];

const TYPE_CONFIG = {
  major: { color: '#0F172A', bg: '#F1F5F9', label: 'Major' },
  minor: { color: '#3B82F6', bg: '#EFF6FF', label: 'Minor' },
  patch: { color: '#10B981', bg: '#DCFCE7', label: 'Patch' },
};

export default function AdminChangelogScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';
  const [expandedVersion, setExpandedVersion] = useState<string | null>(CHANGELOG[0]?.version || null);

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{fr ? 'Journal des versions' : 'Changelog'}</Text>
      </View>

      <AdminQuickNav currentRoute="/admin-changelog" />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <View style={[s.summaryItem, { borderColor: '#0F172A20' }]}>
                <Text style={[s.summaryValue, { color: '#0F172A' }]}>{CHANGELOG.length}</Text>
                <Text style={s.summaryLabel}>{fr ? 'Versions' : 'Versions'}</Text>
              </View>
              <View style={[s.summaryItem, { borderColor: '#3B82F620' }]}>
                <Text style={[s.summaryValue, { color: '#3B82F6' }]}>{CHANGELOG.reduce((sum, e) => sum + e.highlights.length, 0)}</Text>
                <Text style={s.summaryLabel}>{fr ? 'Fonctionnalites' : 'Features'}</Text>
              </View>
              <View style={[s.summaryItem, { borderColor: '#10B98120' }]}>
                <Text style={[s.summaryValue, { color: '#10B981' }]}>{CHANGELOG[0]?.version || '-'}</Text>
                <Text style={s.summaryLabel}>{fr ? 'Derniere' : 'Latest'}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Changelog entries */}
        {CHANGELOG.map((entry, idx) => {
          const isExpanded = expandedVersion === entry.version;
          const typeCfg = TYPE_CONFIG[entry.type];
          const isLatest = idx === 0;
          return (
            <Animated.View key={entry.version} entering={FadeInDown.duration(250).delay(idx * 30)}>
              <Pressable
                style={[s.entryCard, isLatest && s.entryCardLatest]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setExpandedVersion(isExpanded ? null : entry.version);
                }}
              >
                {/* Timeline dot */}
                <View style={s.timelineDot}>
                  <View style={[s.timelineDotInner, { backgroundColor: typeCfg.color }]}>
                    {isLatest ? <MaterialIcons name="star" size={10} color="#FFF" /> : null}
                  </View>
                  {idx < CHANGELOG.length - 1 ? <View style={s.timelineLine} /> : null}
                </View>

                <View style={{ flex: 1 }}>
                  {/* Header */}
                  <View style={s.entryHeader}>
                    <View style={s.entryVersionRow}>
                      <Text style={[s.entryVersion, isLatest && { color: '#0F172A' }]}>v{entry.version}</Text>
                      <View style={[s.entryTypeBadge, { backgroundColor: typeCfg.bg }]}>
                        <Text style={[s.entryTypeText, { color: typeCfg.color }]}>{typeCfg.label}</Text>
                      </View>
                      {isLatest ? (
                        <View style={s.latestBadge}>
                          <Text style={s.latestBadgeText}>{fr ? 'ACTUELLE' : 'CURRENT'}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.entryDate}>
                      {new Date(entry.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>

                  {/* Highlights */}
                  <View style={s.highlightsRow}>
                    {entry.highlights.map((h, hIdx) => (
                      <View key={hIdx} style={[s.highlightChip, { backgroundColor: h.color + '10' }]}>
                        <MaterialIcons name={h.icon as any} size={12} color={h.color} />
                        <Text style={[s.highlightText, { color: h.color }]} numberOfLines={1}>{h.text}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Expanded details */}
                  {isExpanded ? (
                    <View style={s.detailsSection}>
                      {entry.details.map((d, dIdx) => (
                        <View key={dIdx} style={s.detailRow}>
                          <View style={s.detailBullet} />
                          <Text style={s.detailText}>{d}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Expand indicator */}
                  <View style={s.expandRow}>
                    <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={18} color="#94A3B8" />
                    <Text style={s.expandText}>
                      {isExpanded ? (fr ? 'Masquer' : 'Hide') : `${entry.details.length} ${fr ? 'details' : 'details'}`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  summaryCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryItem: { flex: 1, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 12, borderWidth: 1 },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 9, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  entryCard: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  entryCardLatest: {},

  timelineDot: { alignItems: 'center', width: 24 },
  timelineDotInner: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4 },

  entryHeader: { marginBottom: 8 },
  entryVersionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  entryVersion: { fontSize: 17, fontWeight: '800', color: '#64748B' },
  entryTypeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  entryTypeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  latestBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  latestBadgeText: { fontSize: 8, fontWeight: '900', color: '#10B981', letterSpacing: 0.5 },
  entryDate: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },

  highlightsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  highlightChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  highlightText: { fontSize: 10, fontWeight: '700', maxWidth: 180 },

  detailsSection: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, marginBottom: 8, gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailBullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#94A3B8', marginTop: 6 },
  detailText: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 18 },

  expandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 12 },
  expandText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
});
