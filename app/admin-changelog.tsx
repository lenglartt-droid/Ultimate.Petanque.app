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

import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import AdminQuickNav from '@/components/feature/AdminQuickNav';
import { APP_VERSION } from '@/constants/appVersion';

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  highlights: { icon: string; color: string; text: string }[];
  details: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.49.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'grid-on', text: 'Daily transfer heatmap calendar (90 days) in admin transfers widget', color: '#10B981' },
      { icon: 'local-fire-department', text: 'Peak day indicator and active days summary', color: '#EF4444' },
    ],
    details: [
      'New heatmap calendar in transfers widget showing daily transfer activity over the last 90 days',
      'Grid layout: 7 rows (Mon-Sun) x ~13 columns (weeks) with colored squares per day',
      'Color intensity by transfer count: gray (0), green (1), yellow (2-3), red (4+)',
      'Today highlighted with blue border for quick orientation',
      'Day-of-week labels (Mon/Wed/Fri) on the left side of the grid',
      'Horizontal scroll for the grid on narrow screens',
      'Peak day badge showing the date and count of the most active day in the period',
      'Summary row: total transfers and active days count over 90 days',
      'Color legend (Less → More) with matching green/yellow/red squares',
      'Computed via useMemo from raw transfer data for real-time updates',
      'Positioned between monthly history chart and recent transfers list',
      'Changelog updated with v1.49.0',
    ],
  },
  {
    version: '1.48.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'delete-sweep', text: 'Purge archives older than 2 years with admin confirmation', color: '#DC2626' },
      { icon: 'history', text: 'Admin activity log entry on every purge action', color: '#7C3AED' },
    ],
    details: [
      'New purge button in transfer archives modal for archives older than 2 years',
      'Red warning banner shows count of purgeable archives with delete-sweep icon',
      'Confirmation dialog with destructive button warns about irreversible deletion',
      'Purge deletes matching records from player_transfer_archives via Supabase client',
      'DELETE RLS policy added on player_transfer_archives for admin role (is_admin())',
      'Archive count and local data updated immediately after successful purge',
      'Admin activity logged via adminActivityLogService with purged count and cutoff date',
      'Haptic feedback on successful purge completion',
      'Button disabled during purge operation with loading indicator',
      'Purge section only visible when purgeable archives exist (computed via useMemo)',
      'Changelog updated with v1.48.0',
    ],
  },
  {
    version: '1.47.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'date-range', text: 'Date range filter in transfer archives modal (creation & archive date)', color: '#0EA5E9' },
      { icon: 'calendar-today', text: 'Quick presets (7d/30d/3m/6m/1y) and manual YYYY-MM-DD input', color: '#3B82F6' },
    ],
    details: [
      'New date range filter in transfer archives modal with two modes: filter by creation date or archive date',
      'Toggle between "Date creation" and "Date archivage" with colored chip selectors (blue/purple)',
      'Quick preset buttons: All, 7j, 30j, 3m, 6m, 1an — auto-set the From date with one tap',
      'Manual From/To date inputs (YYYY-MM-DD format) with calendar icons and clear buttons',
      'Active preset highlighted in cyan; active date inputs show cyan border',
      'Date filtering applied in filteredArchiveData useMemo alongside existing search and status filters',
      'From date uses start of day (00:00:00), To date uses end of day (23:59:59) for inclusive range',
      'Result count indicator updated to show when date filters are active',
      'CSV export reflects current date-filtered view',
      'Changelog updated with v1.47.0',
    ],
  },
  {
    version: '1.46.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'search', text: 'Archive search and filter by status in transfer archives modal', color: '#7C3AED' },
      { icon: 'insights', text: 'Transfer trend alerts from monthly history (volume, rate, response time)', color: '#D97706' },
    ],
    details: [
      'New search bar in transfer archives modal: search by player name, sender, or recipient with real-time filtering',
      'Status filter chips (All/Accepted/Declined/Expired) in archives modal for quick filtering',
      'Filtered result count indicator (e.g. 3/15 results) when filters active',
      'CSV export reflects current filtered view (exports only visible results)',
      'Clear button on search input for quick reset',
      'New trend alerts section in transfers widget: MONTHLY TRENDS header with dedicated styling',
      'Alert 1: Continuous volume decline — detects 3 consecutive months of decreasing transfer volume with percentage drop',
      'Alert 2: Acceptance rate dropping — triggers when current month rate drops 10+ points vs previous month',
      'Alert 3: Response time increasing — triggers when avg response time rises 20%+ and exceeds 24h threshold',
      'Trend alerts computed via useMemo from monthly transfer history for real-time responsiveness',
      'Trend alerts display between smart alerts and overdue reminder sections for visibility hierarchy',
      'Changelog updated with v1.46.0',
    ],
  },
  {
    version: '1.45.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'file-download', text: 'CSV export for transfer archives with all columns', color: '#7C3AED' },
      { icon: 'timeline', text: 'Monthly transfer statistics history (6 months) with trend deltas', color: '#3B82F6' },
    ],
    details: [
      'New CSV export button (purple download icon) in transfer archives modal header',
      'Exports all archived transfers with player name, sender, recipient, status, match/challenge counts, creation date, and archive date',
      'Export uses expo-file-system + expo-sharing on mobile, Blob download on web',
      'Button disabled when no archive data is loaded',
      'New monthly transfer history chart in transfers widget showing last 6 months',
      'Stacked bars per month: accepted (green), declined (red), expired (gray), pending (yellow)',
      'Acceptance rate badge per month with color-coded health (green 60+%, orange 30-60%, red <30%)',
      'Month-over-month delta indicators: volume change %, acceptance rate delta (pts), response time delta %',
      'Computed via useMemo from raw transfer data for real-time filter responsiveness',
      'Legend row with all 4 status colors for readability',
      'Changelog updated with v1.45.0',
    ],
  },
  {
    version: '1.44.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'inventory-2', text: 'Auto-archive resolved transfers after 90 days into separate table', color: '#7C3AED' },
      { icon: 'visibility', text: 'Archive consultation modal in admin transfer widget', color: '#3B82F6' },
    ],
    details: [
      'New database table: player_transfer_archives with RLS for admin-only access',
      'New weekly-cron task: transfer_archive — moves accepted/declined/expired transfers older than 90 days to archive table',
      'Original records deleted from player_transfer_requests after successful archival to keep table lean',
      'Batch insert/delete in chunks of 50 for performance',
      'Weekly dedup via ambassador_analytics (event_type: transfer_archive_cron)',
      'Logs archived count by status (accepted/declined/expired) for audit trail',
      'Admin dashboard: new archive button (purple box icon) in transfer widget header with badge counter',
      'Archive modal: displays archived transfers with player name, sender/recipient, status, match/challenge counts, original date, and archive date',
      'Archive modal: info banner explaining 90-day auto-archive policy',
      'Archive count fetched during dashboard loadStats for real-time badge display',
      'User profiles resolved for readable sender/recipient names in archive view',
      'Changelog updated with v1.44.0',
    ],
  },
  {
    version: '1.43.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'picture-as-pdf', text: 'PDF export for transfer statistics with charts, KPIs, alerts and reminder history', color: '#DC2626' },
      { icon: 'analytics', text: 'Comprehensive transfer report with weekly evolution, top senders, badges', color: '#3B82F6' },
    ],
    details: [
      'New PDF export button (red icon) in transfer widget header alongside existing CSV export',
      'PDF report includes: title, date, and active filter state (status/period/sender)',
      'KPI section: pending, accepted, declined, expired counts + acceptance rate + avg response time',
      'Weekly evolution stacked bar chart with accepted/declined/pending breakdown and color legend',
      'Top senders table with rank, name, total transfers, accepted count, and acceptance rate percentage',
      'Active transfer alerts section rendered with severity color-coding (critical/warning/info)',
      'Reminder summary box: overdue count, not-yet-reminded count, approaching expiration count, last reminder timestamp',
      'Recent transfers table with player name, sender, recipient, status, data counts, date, and status badges (EXPIRED/EXPIRING/ESCALATED/OVERDUE)',
      'PDF generated via expo-print and shared via expo-sharing with proper MIME type',
      'Filter state reflected in report header so exported data matches current dashboard view',
      'Changelog updated with v1.43.0',
    ],
  },
  {
    version: '1.42.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'schedule-send', text: 'Auto urgent reminders via weekly cron for transfers expiring in 0-5 days', color: '#DC2626' },
      { icon: 'group', text: 'Smart grouping: one push per recipient with days remaining', color: '#3B82F6' },
    ],
    details: [
      'New weekly-cron task: transfer_urgent_reminders — automatically sends urgent push reminders to recipients of pending transfers aged 25-30 days (expiring within 0-5 days)',
      'Smart grouping: multiple expiring transfers for the same recipient consolidated into a single push notification with count and player names',
      'Each push includes days remaining before automatic cancellation for urgency context',
      'Weekly dedup via ambassador_analytics (event_type: transfer_urgent_reminder_cron) to avoid duplicate processing',
      'Respects user notification preferences (share_request toggle) — skips recipients who disabled transfer notifications',
      'Deactivates invalid push tokens (DeviceNotRegistered) encountered during sending',
      'Logs detailed metrics: sent count, error count, expiring transfer count, unique recipient count, transfer IDs',
      'Complements the existing manual "Urgent remind" button in admin dashboard for fully automated coverage',
      'Task added to default cron task list — runs automatically alongside existing weekly tasks',
      'Changelog updated with v1.42.0',
    ],
  },
  {
    version: '1.41.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'timer', text: 'Alert for transfers approaching expiration (25-30 days)', color: '#DC2626' },
      { icon: 'priority-high', text: 'Urgent reminder button to notify recipients before auto-cancel', color: '#991B1B' },
    ],
    details: [
      'New intelligent alert in transfer widget: detects transfers pending 25-30 days (expiring within 0-5 days)',
      'Alert displays with critical severity and recommends sending an urgent reminder',
      'New "Urgent remind" button in transfer widget sends push notifications to recipients of expiring transfers',
      'Each push includes days remaining before automatic cancellation for urgency context',
      'New edge function type: player_transfer_urgent_reminder with admin-only access and high priority',
      'New EXPIRING badge (dark red) on transfers 25-30 days old in recent transfers list',
      'Badge hierarchy updated: EXPIRING (25-30d) > ESCALATED (21-25d) > OVERDUE (7-21d)',
      'Admin action logged via adminActivityLogService for audit trail',
      'Changelog updated with v1.41.0',
    ],
  },
  {
    version: '1.40.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'timer-off', text: 'Auto-cancel transfers pending 30+ days with expired status', color: '#94A3B8' },
      { icon: 'notifications-active', text: 'Push notification to sender and recipient on expiration', color: '#D97706' },
    ],
    details: [
      'New weekly-cron task: transfer_expiration — automatically detects and cancels pending transfers older than 30 days',
      'Updates transfer status from pending to expired with timestamp',
      'Sends consolidated push notification to each sender listing expired player names',
      'Sends push notification to each recipient respecting notification preferences (share_request toggle)',
      'Smart grouping: one push per sender/recipient even with multiple expired transfers',
      'Weekly dedup via ambassador_analytics (event_type: transfer_expiration_cron) to avoid duplicate processing',
      'Stores expired transfer IDs and push delivery metrics in analytics for audit trail',
      'Deactivates invalid push tokens (DeviceNotRegistered) encountered during sending',
      'Admin dashboard: new expired filter chip (gray) in transfer widget status filters',
      'Admin dashboard: expired KPI card appears when expired transfers exist',
      'Admin dashboard: gray EXPIRED badge on expired transfers in recent list',
      'Admin dashboard: expired status handled with timer-off icon and neutral gray color',
      'TransferStats interface extended with expired count for all computation paths',
      'Changelog updated with v1.40.0',
    ],
  },
  {
    version: '1.39.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'priority-high', text: 'Auto-escalation: transfers pending 21+ days flagged and admins notified', color: '#DC2626' },
      { icon: 'notifications-active', text: 'ESCALATED badge on overdue transfers in admin dashboard', color: '#F59E0B' },
    ],
    details: [
      'New weekly-cron task: transfer_escalation — automatically detects pending transfers older than 21 days',
      'Sends push notification to all admin users with escalated transfer count, player names, and oldest transfer age',
      'Weekly dedup via ambassador_analytics (event_type: transfer_escalation_cron) to avoid duplicate alerts',
      'Stores escalated transfer IDs in analytics source_page for audit trail',
      'Admin dashboard: new critical alert in transfer widget when escalated transfers detected',
      'Admin dashboard: red ESCALATED badge on transfers pending 21+ days in recent list',
      'Admin dashboard: orange OVERDUE badge on transfers pending 7-21 days in recent list',
      'Escalation alert includes count and recommendation for manual intervention',
      'Changelog updated with v1.39.0',
    ],
  },
  {
    version: '1.38.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'schedule-send', text: 'Auto transfer reminders via weekly cron (no admin action needed)', color: '#10B981' },
      { icon: 'group', text: 'Smart grouping: one push per recipient with all pending transfers', color: '#3B82F6' },
    ],
    details: [
      'New weekly-cron task: transfer_reminders — automatically sends push reminders to recipients of pending transfers older than 7 days',
      'Smart grouping: multiple pending transfers for the same recipient are consolidated into a single push notification with count and player names',
      'Weekly dedup: reminders only sent once per week per cron cycle via ambassador_analytics tracking (event_type: transfer_reminder_cron)',
      'Respects user notification preferences (share_request toggle) — skips recipients who disabled transfer notifications',
      'Deactivates invalid push tokens (DeviceNotRegistered) encountered during sending',
      'Logs detailed metrics: sent count, error count, overdue transfer count, unique recipient count',
      'Task added to default cron task list — runs automatically alongside existing weekly tasks',
      'Changelog updated with v1.38.0',
    ],
  },
  {
    version: '1.37.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'notifications-active', text: 'Transfer reminder push for pending >7 days with tracking', color: '#D97706' },
      { icon: 'send', text: 'Edge function: player_transfer_reminder type', color: '#3B82F6' },
    ],
    details: [
      'New reminder button in admin transfers widget for pending transfers older than 7 days',
      'Button shows count of overdue transfers and how many have not yet been reminded',
      'Each reminder sends a push notification to the transfer recipient via send-push edge function',
      'New push type: player_transfer_reminder with admin-only access, targeting recipient with player name and sender info',
      'Reminded transfer IDs persisted to AsyncStorage to avoid duplicate reminders across sessions',
      'Last reminder timestamp displayed with date/time for audit trail',
      'Button disabled when all overdue transfers have already been reminded',
      'Admin action logged via adminActivityLogService for audit',
      'Changelog updated with v1.37.0',
    ],
  },
  {
    version: '1.36.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'notifications-active', text: 'Transfer smart alerts: decline spike, slow response, at-risk senders', color: '#DC2626' },
      { icon: 'filter-list', text: 'Transfers widget: status, period and sender filters', color: '#3B82F6' },
      { icon: 'file-download', text: 'Transfer CSV export with summary', color: '#0EA5E9' },
    ],
    details: [
      'Transfer smart alerts: 5 proactive detections — decline spike (>50% decline rate), slow response time (>48h avg), at-risk senders (<25% acceptance on 3+ transfers), transfer backlog (pending > resolved), rising decline trend (week-over-week)',
      'Alerts display inline in the transfers widget with severity indicators (critical red dot, warning, info)',
      'Alerts recompute in real-time when filters change (status, period, sender)',
      'Transfer filters: status chips (all/pending/accepted/declined), period chips (all/7d/30d/3m), sender filter via top senders tap',
      'KPI cards are interactive: tap to toggle status filter',
      'Filter reset button with active count indicator',
      'Transfer CSV export with full history and summary KPIs',
      'Quick Navigation section removed from admin dashboard',
      'Admin changelog updated with v1.36.0',
    ],
  },
  {
    version: '1.35.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'swap-horiz', text: 'Admin: Player transfers dashboard widget with KPIs and recent list', color: '#0EA5E9' },
      { icon: 'archive', text: 'Meetup archival indicator with end time display and disabled chat/invitations', color: '#64748B' },
      { icon: 'rocket-launch', text: 'FAQ V2 Roadmap cleaned: removed "Already in V1" section', color: '#7C3AED' },
    ],
    details: [
      'Admin dashboard: new "Player Transfers" widget with pending/accepted/declined KPI cards and recent transfers list (player name, sender, recipient, match/challenge counts, date)',
      'Admin dashboard: transfers widget added to widget settings modal with toggle and reorder support',
      'Meetup detail page: archived meetups show "Archive" badge with end time in status banner',
      'Meetup detail page: end time displayed in hero card time row (e.g. "14:00 → 16:00")',
      'Meetup detail page: chat, invitations, reminders, and response buttons disabled for archived/expired meetups',
      'FAQ V2 Roadmap: updated to show 7 planned features only, removed redundant "Already in V1" list',
      'FAQ V2 launch timeline answer simplified',
      'Admin changelog updated with v1.35.0 entry',
    ],
  },
  {
    version: '1.34.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'fact-check', text: 'FAQ full audit: V2 roadmap updated, transfer/follow/notification descriptions corrected', color: '#10B981' },
      { icon: 'person-add', text: 'Profile: "Joueurs suivis" renamed and moved to top of Community section', color: '#EC4899' },
      { icon: 'tune', text: 'Notification hub: Settings tab redirects to full preferences page', color: '#64748B' },
    ],
    details: [
      'FAQ V2 Roadmap section updated: added player transfer, QR claim, mini-chat, meetup end time, heatmap, geographic ranking, club invitations to "Already in V1" list',
      'FAQ Player Transfer answer corrected: "Link to user" button is now via header icon (swap), not "..." menu',
      'FAQ Follow player answer clarified: Follow button only appears on registered public players, not local directory players',
      'FAQ Notifications answer updated: reflects 13 categories in 5 sections with full preferences page redirect',
      'FAQ Delete account answer corrected: actual flow is bottom of Profile page with OTP confirmation',
      'FAQ Language change answer corrected: uses Account section toggle, not flag at top-right',
      'Profile: "Mes abonnements" renamed to "Joueurs suivis" and moved above "Nos Ambassadeurs" in Community section',
      'Notification hub: Settings tab now navigates directly to full notification-preferences page (removes redundant inline toggles)',
      'Tournament notifications: auto-cleanup of past tournaments on hub load, count excludes meetup reminders',
    ],
  },
  {
    version: '1.33.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'schedule', text: 'Meetup end time: automatic archival when end time passes', color: '#EF4444' },
      { icon: 'design-services', text: 'Notification hub tabs redesigned with scrollable colored pills', color: '#3B82F6' },
      { icon: 'notifications', text: 'Meetup reminders use dedicated channel (no longer counted as tournaments)', color: '#10B981' },
    ],
    details: [
      'Meetup creation form: new end time picker with default +2h from start, auto-adjusts if start changes',
      'Database: end_time column added to terrain_meetups table',
      'Meetup service: createMeetup accepts endTime param, auto-archive past meetups by end_time',
      'Notification hub tabs: redesigned from cramped segmented control to horizontal scrollable pill buttons with icons, colors, and badges',
      'Meetup reminders now use dedicated Android channel meetup-reminders (separated from tournament-reminders)',
      'Transfer button (swap icon) moved from advanced actions menu to visible header button on player detail page',
      'Meetup notifications category moved back into "Communaute et Evenements" in notification preferences',
    ],
  },
  {
    version: '1.32.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'swap-horiz', text: 'Player transfer system: link local players to registered accounts', color: '#3B82F6' },
      { icon: 'qr-code', text: 'QR claim: scan to detect and link local player copies', color: '#7C3AED' },
      { icon: 'help-outline', text: 'FAQ and changelog updated with transfer feature', color: '#10B981' },
    ],
    details: [
      'New player transfer system: owners of local players can send transfer requests to registered users',
      'Transfer modal with user search by name/email, match/challenge count preview, and optional message',
      'Recipient receives transfer request in Notifications Hub > new Transfers tab',
      'On acceptance: matches and challenges are reassigned to recipient player profile with stats update',
      'QR claim feature: when scanning a registered user QR, app detects local players with similar names and proposes linking',
      'New database table: player_transfer_requests with RLS policies for sender/recipient',
      'New service: playerTransferService.ts with send, accept, decline, cancel, search functions',
      'Notifications Hub: new Transfers tab with pending/history sections and accept/decline actions',
      'Player detail page: new "Link to registered user" button for local (non-public) players',
      'FAQ updated with player transfer and QR claim documentation for all audience tabs',
    ],
  },
  {
    version: '1.31.0',
    date: '2026-04-07',
    type: 'minor',
    highlights: [
      { icon: 'wc', text: 'Restrooms/Toilets service added to terrains', color: '#EC4899' },
      { icon: 'tune', text: 'Filters updated: directory, map, creation, edit', color: '#3B82F6' },
      { icon: 'help-outline', text: 'FAQ and changelog updated', color: '#10B981' },
    ],
    details: [
      'New "Toilettes" (Restrooms) boolean field added to terrain data model and database',
      'Terrain detail page: new restrooms icon in quick info grid between parking and public access',
      'Terrain creation page: new toggle in Features section to indicate restroom availability',
      'Terrain edit page: restroom toggle persisted and editable alongside other features',
      'Directory terrain cards: pink WC icon tag displayed when terrain has restrooms',
      'Map terrain sub-filters: new "Toilettes/Restrooms" chip to filter terrains with restrooms',
      'Database: added toilets boolean column to terrains table (default false)',
      'FAQ updated: map filter description now includes restrooms in terrain sub-filters',
      'i18n: FR "Toilettes" / EN "Restrooms" labels and descriptions added',
    ],
  },
  { version: '1.30.0', date: '2026-04-06', type: 'patch', highlights: [{ icon: 'attach-money', text: 'Ad removal price updated to 8.99 $CAD', color: '#22C55E' }], details: ['Ad removal price updated from 5.99 EUR to 8.99 $CAD across the app, FAQ and changelog', 'Default product price shown before IAP store response now reflects the new CAD pricing'] },
  { version: '1.29.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'add-reaction', text: 'Emoji reactions on meetup chat messages', color: '#F59E0B' }, { icon: 'animation', text: 'Animated bounce on reaction toggle', color: '#7C3AED' }, { icon: 'thumb-up', text: 'Thumbs up, laugh, fire with counters', color: '#3B82F6' }], details: ['New emoji reactions on every message in meetup mini-chat: thumbs up, laugh, fire', 'Reaction picker appears via smiley button below each message bubble', 'Reaction pills show emoji + count below the bubble; own reactions highlighted in primary color', 'Tapping an existing reaction pill toggles your own reaction (add/remove)', 'Animated spring bounce (scale 1.35x) on reaction toggle via Reanimated for tactile feedback', 'Optimistic UI update: reaction appears instantly, server sync in background with consistency refresh at 500ms', 'Reactions polled every 8 seconds alongside message polling for near real-time updates', 'Database: new meetup_message_reactions table with unique constraint on (message_id, user_id, reaction_type) and RLS for participant-only access', 'Service: fetchMessageReactions returns grouped Map by messageId, toggleReaction handles insert/delete toggle', 'FAQ updated with emoji reaction feature in meetup chat section'] },
  { version: '1.28.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'done-all', text: 'Read receipts (blue double check) in meetup chat', color: '#3B82F6' }, { icon: 'visibility', text: 'Know when participants have seen your messages', color: '#22C55E' }, { icon: 'sync', text: 'Auto-polling read status every 5 seconds', color: '#7C3AED' }], details: ['New read receipts in meetup mini-chat: blue double check icon on own messages when read by at least one other participant', 'Gray double check (done-all) shown on sent messages that have not been read yet', 'Blue double check (done-all) appears when any other participant has scrolled past the message', 'Read status polled every 5 seconds (independent of message polling at 8s and typing at 3s)', 'Messages automatically marked as read when chat is expanded and user views them', 'Read receipt upserted on send to immediately mark own messages as read by self', 'Read status computed by comparing message order against other participants last_read_message_id', 'Database: new meetup_read_receipts table with unique constraint on (meetup_id, user_id) and RLS for participant-only access', 'Service: markMessagesAsRead (upsert) and fetchReadReceipts functions added to meetupChatService', 'Message bubble footer redesigned: time + read status icon aligned on same row', 'FAQ updated with read receipt feature description in meetup chat section'] },
  { version: '1.27.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'edit', text: 'Typing indicator in meetup chat', color: '#7C3AED' }, { icon: 'animation', text: 'Animated bouncing dots for active typists', color: '#3B82F6' }, { icon: 'sync', text: 'Fast 3s polling for near-instant feedback', color: '#22C55E' }], details: ['New typing indicator in meetup mini-chat: shows "X is typing..." when another participant types a message', 'Animated bouncing dots (3 dots with staggered vertical animation via Reanimated) next to the typer name', 'Typing status polled every 3 seconds for near real-time feedback, independent of message polling (8s)', 'Debounced typing report (1s) to avoid flooding the server on every keystroke', 'Auto-clear after 6 seconds of inactivity: if the user stops typing, the indicator disappears for others', 'Typing status cleared immediately when a message is sent or the chat is collapsed', 'Supports multiple simultaneous typists: "X and Y are typing...", "X and 2 others are typing..."', 'Green dot indicator in collapsed chat header when someone is typing (visible without expanding)', 'Database: new meetup_typing table with upsert on (meetup_id, user_id) and RLS for participant-only access', 'FAQ updated with typing indicator details in meetup organization answer'] },
  { version: '1.26.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'chat-bubble-outline', text: 'Mini-chat in meetup detail page', color: '#3B82F6' }, { icon: 'flash-on', text: 'Quick message chips for fast coordination', color: '#F59E0B' }, { icon: 'sync', text: 'Auto-refresh messages via polling (8s)', color: '#22C55E' }], details: ['New mini-chat section in meetup detail page for participant coordination before the game', 'Messages auto-refresh every 8 seconds via polling for near real-time updates', 'Collapsible chat card with message count badge and expand/collapse toggle', 'Message bubbles with user avatars (colored initials), timestamps, and date separators', "Own messages styled in primary color on the right, others on the left with user name", "Quick message chips: 4 pre-defined messages in FR/EN", 'Long-press on own messages reveals delete button for message removal', 'Only accepted participants and meetup creator can send messages (RLS enforced)', 'Non-participants see a lock message prompting them to accept the meetup first', 'Database: new meetup_messages table with RLS policies for participant-only access', 'FAQ updated with mini-chat feature description in meetup organization section'] },
  { version: '1.25.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'group-add', text: 'Quick Meetup button on map terrain card', color: '#22C55E' }, { icon: 'map', text: 'Pre-filled terrain + current time', color: '#3B82F6' }, { icon: 'help-outline', text: 'FAQ updated with map meetup shortcut', color: '#7C3AED' }], details: ['New green "Create Meetup" button appears in the selected terrain card on the map', 'Tapping the button navigates to meetup creation with the terrain pre-filled via terrainId param', 'Current date/time is used as default, letting users organize a game in seconds', 'Button uses group-add icon with success color styling, positioned below the navigation arrow', 'FAQ updated: meetup organization answer now describes the map shortcut for quick meetup creation'] },
  { version: '1.24.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'stacked-bar-chart', text: 'Cumulative heatmap animation mode', color: '#7C3AED' }, { icon: 'trending-up', text: 'Progressive density build-up visualization', color: '#3B82F6' }, { icon: 'help-outline', text: 'FAQ updated with cumulative mode', color: '#10B981' }], details: ['New cumulative toggle in heatmap animation controls', 'Cumulative mode: each animation step includes all players from period start up to the current slice end', 'Isolated mode (default): unchanged behavior', 'Toggle chip styled with stacked-bar-chart icon, primary color when active', 'Progress dots fill progressively in cumulative mode', 'Date label uses arrow notation in cumulative mode vs dash in isolated mode', 'FAQ heatmap section updated with cumulative mode explanation'] },
  { version: '1.23.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'schedule', text: 'Heatmap temporal filter (7d/30d/3m)', color: '#3B82F6' }, { icon: 'play-arrow', text: 'Animated density evolution mode', color: '#7C3AED' }, { icon: 'help-outline', text: 'FAQ updated with time filter and animation', color: '#10B981' }], details: ['New temporal period filter on player density heatmap: All, 7 days, 30 days, 3 months', 'Players filtered by last_match_date', 'Animated Evolution mode: divides selected period into 4 time slices, auto-cycles every 1.5s', 'Play/pause button and step indicator with date range label', 'FAQ updated with temporal filter and animated evolution mode documentation'] },
  { version: '1.22.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'blur-on', text: 'Player density heatmap on map', color: '#3B82F6' }, { icon: 'map', text: 'Colored zones by player concentration', color: '#22C55E' }, { icon: 'help-outline', text: 'FAQ updated with heatmap documentation', color: '#7C3AED' }], details: ['New player density heatmap layer on the map', 'Heatmap divides visible viewport into 10x10 grid', 'Four intensity levels with floating legend card', 'FAQ updated with heatmap usage instructions'] },
  { version: '1.21.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'blur-on', text: 'Enhanced cluster markers with gradient and category counters', color: '#7C3AED' }, { icon: 'animation', text: 'Burst animation on cluster tap', color: '#3B82F6' }, { icon: 'help-outline', text: 'FAQ updated with cluster visual details', color: '#10B981' }], details: ['Cluster markers redesigned with diagonal LinearGradient', 'Per-category mini-pills inside clusters', 'Burst animation on cluster tap with 3 concentric rings', 'FAQ updated with cluster enhancement description'] },
  { version: '1.20.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'animation', text: 'Animated pulse markers for active terrains on map', color: '#22C55E' }, { icon: 'help-outline', text: 'FAQ updated with pulse marker details', color: '#3B82F6' }], details: ['Active Now terrains on the map show animated green pulse markers with Reanimated', 'Pulse animation: two staggered rings scale from 1x to 1.8x while fading out', 'FAQ updated with animated pulse markers description'] },
  { version: '1.19.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'radar', text: 'Configurable proximity radius (1/3/5/10 km)', color: '#22C55E' }, { icon: 'calendar-month', text: 'Terrain activity history with monthly calendar', color: '#6366F1' }, { icon: 'insights', text: 'FAQ and roadmap updated', color: '#3B82F6' }], details: ['New proximity radius setting in Notification Preferences', 'New terrain activity history page with monthly calendar view', 'FAQ updated with both features'] },
  { version: '1.18.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'near-me', text: 'Terrain proximity alert on home page', color: '#22C55E' }, { icon: 'insights', text: 'Enhanced activity scoring with meetups from server', color: '#6366F1' }, { icon: 'notifications-active', text: 'Proximity notification preference toggle', color: '#3B82F6' }], details: ['New proximity alert on app open', 'Activity scoring enhanced with server meetups', 'New notification preference toggle for proximity'] },
  { version: '1.17.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'local-fire-department', text: 'Active Now terrain filter in directory', color: '#22C55E' }, { icon: 'map', text: 'Active terrains on map with green pulse markers', color: '#3B82F6' }, { icon: 'insights', text: 'Redesigned terrain peak hours section', color: '#6366F1' }], details: ['New Active Now filter button in directory Terrains tab', 'Terrain peak hours section redesigned', 'FAQ and onboarding updated'] },
  { version: '1.16.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'mail', text: 'Club invitation notification toggles', color: '#7C3AED' }, { icon: 'person-add', text: 'New follower push notification', color: '#EC4899' }, { icon: 'schedule', text: 'Terrain peak hours seasonal filter fix', color: '#6366F1' }], details: ['Club invitation and invitation reminder toggles added', 'New follower push notification implemented', 'Terrain detail crash fixed'] },
  { version: '1.15.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'notifications-off', text: 'Admin granular push type management', color: '#EF4444' }, { icon: 'history', text: 'Push disable/enable audit history', color: '#7C3AED' }, { icon: 'image', text: 'App logo on onboarding language page', color: '#3B82F6' }], details: ['Admin can disable/enable each of the 27 push notification types individually', 'Push disable/enable history log', 'App logo on onboarding language selection page'] },
  { version: '1.14.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'show-chart', text: 'Match momentum & heatmap in share cards', color: '#7C3AED' }, { icon: 'timer', text: 'Invitation reminder UI with countdown', color: '#F59E0B' }, { icon: 'bug-report', text: 'Tournament reminder auto-cleanup fix', color: '#EF4444' }], details: ['Share card match: added momentum chart and action heatmap', 'Club invitations: reminder status indicators and countdown', 'Tournament notifications: auto-disable for past tournaments'] },
  { version: '1.13.0', date: '2026-04-06', type: 'minor', highlights: [{ icon: 'alarm', text: 'Automatic invitation reminders (7d + 21d)', color: '#3B82F6' }, { icon: 'analytics', text: 'Club invitation analytics', color: '#10B981' }, { icon: 'dynamic-feed', text: 'Feed notification badge + digest', color: '#7C3AED' }], details: ['Push reminders for unanswered club invitations', 'Club analytics with invitation stats', 'Activity feed unread counter and weekly digest'] },
  { version: '1.12.0', date: '2026-04-05', type: 'minor', highlights: [{ icon: 'edit', text: 'Admin club edit/delete access', color: '#DC2626' }, { icon: 'history', text: 'Claim history tab + admin merge undo', color: '#7C3AED' }, { icon: 'update', text: 'Auto-updated changelog', color: '#3B82F6' }], details: ['Admin can edit or delete any club card', 'Claim history tab and admin merge undo', 'Changelog auto-syncs with app version'] },
  { version: '1.11.0', date: '2026-04-05', type: 'minor', highlights: [{ icon: 'email', text: 'Club verification decision notifications', color: '#2563EB' }, { icon: 'dashboard', text: 'Enhanced admin claims dashboard', color: '#10B981' }], details: ['Push notification with decision summary', 'Admin claims dashboard with stats and filters'] },
  { version: '1.10.0', date: '2026-04-04', type: 'minor', highlights: [{ icon: 'checklist', text: 'Club verification checklist (6 steps)', color: '#F59E0B' }, { icon: 'verified-user', text: 'Revised club verification/claim process', color: '#2563EB' }, { icon: 'analytics', text: 'Analytics restricted to verified clubs', color: '#8B5CF6' }], details: ['Verification checklist with 6 steps', 'Claims sent to admin team for validation', 'Analytics restricted to verified clubs'] },
  { version: '1.9.0', date: '2026-04-03', type: 'minor', highlights: [{ icon: 'auto-awesome', text: '6th ELO league: Grand Master (2000+)', color: '#FFD700' }, { icon: 'celebration', text: 'Enhanced league promotion modal', color: '#7C3AED' }, { icon: 'sports', text: 'Match score adaptive font sizing', color: '#3B82F6' }], details: ['Added Grand Master as 6th ELO tier at 2000+', 'League promotion modal enhanced', 'Match score box uses adaptive font'] },
  { version: '1.8.0', date: '2026-04-02', type: 'minor', highlights: [{ icon: 'shield', text: 'Admin Role Guard on all admin pages', color: '#DC2626' }, { icon: 'refresh', text: 'Real-time dashboard polling (30s)', color: '#3B82F6' }, { icon: 'merge-type', text: 'Enhanced terrain merge preview', color: '#10B981' }, { icon: 'history', text: 'Admin changelog page', color: '#7C3AED' }], details: ['AdminGuard component protecting all admin pages', 'Dashboard auto-refreshes every 30 seconds', 'Terrain merge with detailed impact preview', 'Changelog page accessible from admin dashboard'] },
  { version: '1.7.0', date: '2026-03-28', type: 'minor', highlights: [{ icon: 'search', text: 'Global admin search', color: '#3B82F6' }, { icon: 'navigation', text: 'Admin quick nav bar', color: '#0F172A' }, { icon: 'backup', text: 'Full data backup export (JSON)', color: '#7C3AED' }, { icon: 'send', text: 'Push analytics widget', color: '#0EA5E9' }], details: ['Search across users, clubs, terrains, and players', 'Horizontal navigation bar on all 13 admin pages', 'One-click JSON backup', 'Push notification delivery stats'] },
  { version: '1.6.0', date: '2026-03-22', type: 'minor', highlights: [{ icon: 'dashboard', text: 'Consolidated admin dashboard', color: '#0F172A' }, { icon: 'confirmation-number', text: 'Cleaned promo codes page', color: '#0EA5E9' }, { icon: 'download', text: 'Audit log CSV export', color: '#10B981' }], details: ['Removed 9 redundant admin links', 'Promo codes page cleaned', 'Audit log export with filters'] },
  { version: '1.5.0', date: '2026-03-15', type: 'minor', highlights: [{ icon: 'lock', text: 'Password reset via OTP', color: '#DC2626' }, { icon: 'notifications', text: 'Admin notification badge counter', color: '#EF4444' }, { icon: 'map', text: 'Club map filters', color: '#7C3AED' }, { icon: 'policy', text: 'Migrated 30 admin RLS policies', color: '#D97706' }], details: ['Password reset flow with email OTP', 'Notification badge counter on admin dashboard', 'Club map with filters', 'All admin policies migrated to is_admin()'] },
  { version: '1.4.0', date: '2026-03-08', type: 'minor', highlights: [{ icon: 'notifications-active', text: 'Admin notification center', color: '#DC2626' }, { icon: 'compare-arrows', text: 'Club comparison with trends', color: '#0EA5E9' }, { icon: 'assessment', text: 'Report PDF/CSV export', color: '#10B981' }, { icon: 'map', text: 'Club map view with health colors', color: '#7C3AED' }], details: ['Centralized admin notification hub', 'Compare 2-3 clubs side-by-side', 'Weekly reports exportable as CSV', 'Club map with health score color-coding'] },
  { version: '1.3.0', date: '2026-03-01', type: 'minor', highlights: [{ icon: 'timeline', text: 'Club activity timeline', color: '#3B82F6' }, { icon: 'warning', text: 'Smart dashboard alerts', color: '#EF4444' }, { icon: 'trending-up', text: 'Enhanced weekly report details', color: '#10B981' }], details: ['Club detail with chronological timeline', 'Auto-detect anomalies', 'Weekly cron generates detailed admin summary'] },
  { version: '1.2.0', date: '2026-02-22', type: 'minor', highlights: [{ icon: 'verified', text: 'Club verification flow', color: '#2563EB' }, { icon: 'trending-up', text: 'User growth chart + export', color: '#10B981' }, { icon: 'security', text: 'Permission audit logging', color: '#D97706' }], details: ['Advanced club verification with 7 criteria', 'Monthly user growth chart with export', 'All co-admin permission changes logged'] },
  { version: '1.1.0', date: '2026-02-15', type: 'minor', highlights: [{ icon: 'gavel', text: 'Full moderation system', color: '#DC2626' }, { icon: 'rate-review', text: 'Ban appeal workflow', color: '#D97706' }, { icon: 'sports-soccer', text: 'Terrain duplicate detection + merge', color: '#10B981' }, { icon: 'history', text: 'Admin activity log', color: '#64748B' }], details: ['Player report management', 'Ban appeals with 48h deadline tracking', 'Duplicate terrain detection and merge', 'Centralized audit trail'] },
  { version: '1.0.0', date: '2026-02-01', type: 'major', highlights: [{ icon: 'rocket-launch', text: 'V1 Release', color: '#0F172A' }, { icon: 'sports', text: 'Match tracking, ELO, badges', color: '#3B82F6' }, { icon: 'people', text: 'Clubs, terrains, tournaments', color: '#7C3AED' }, { icon: 'share', text: 'Social sharing + QR codes', color: '#10B981' }], details: ['Complete petanque match and challenge tracking', '5-tier ELO ranking system with seasonal compression', '13+ unlockable badges with gamification', 'Club management with ownership and co-admin system', 'Terrain management with map integration', 'Tournament bracket system', 'Cross-player match sharing with QR codes', 'FR/EN localization', 'Offline sync with conflict resolution'] },
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
        <View>
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
                <Text style={[s.summaryValue, { color: '#10B981' }]}>{APP_VERSION}</Text>
                <Text style={s.summaryLabel}>{fr ? 'Derniere' : 'Latest'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Changelog entries */}
        {CHANGELOG.map((entry, idx) => {
          const isExpanded = expandedVersion === entry.version;
          const typeCfg = TYPE_CONFIG[entry.type];
          const isLatest = idx === 0;
          return (
            <View key={entry.version}>
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
            </View>
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
