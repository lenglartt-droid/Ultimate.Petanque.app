# Developer Handoff — Change Log Since Geographic Travel Detection

This document captures all substantial work performed on the Ultimate Petanque app since the initial "impossible geographic travel detection" feature was added to the anti-cheat system. It is organized by functional area so a new developer can quickly understand scope, files touched, and architectural decisions.

---

## 1. Anti-Cheat Infrastructure Expansion (26-Factor Trust Scoring)

The anti-cheat system grew from a single geographic travel check into a comprehensive 26-factor engine covering six categories.

### 1.1 Factor Categories

| Category | Example Factors |
|----------|-----------------|
| **Geographic** | Impossible travel speed, cross-country jumps, GPS teleport |
| **Temporal** | Match density, 24h match count, suspicious hour patterns |
| **Behavioral** | Win-rate spikes, abnormal carreau rate, mene scoring patterns |
| **Statistical** | Three-tier category anomalies (per-role deviation from population) |
| **Identity** | Device fingerprint reuse, duplicate email patterns, multi-account clustering |
| **Social** | Suspicious opponent networks, repeated 1v1 opponents, isolated clusters |

### 1.2 Key Files
- `services/trustScoreService.ts` — 26-factor scoring, ban management, factor-level evidence
- `services/deviceFingerprintService.ts` — device identity hashing + registration tracking
- `services/multiAccountService.ts` — cluster detection across accounts sharing a fingerprint
- `supabase/functions/detect-suspicious/index.ts` — serverless detection pipeline (service-role)
- Database tables: `suspicious_players`, `trust_score_history`, `behavioral_digest_history`, `device_registrations`, `device_transfer_requests`

### 1.3 Alert & Digest System
- Critical alerts generate push notifications to admins when a player crosses a threshold.
- Unified weekly digest (`anticheat_digest`) replaces per-factor spam.
- Rewrote `detect-suspicious/index.ts` as a clean single-pass generator to eliminate duplicate pushes.

### 1.4 Admin Anti-Cheat Dashboard (`app/admin-anticheat.tsx`)
- **Overview Hero**: Always-visible KPI card (Flagged / Watched / Banned / OK).
- **Compressed header**: Three 40×40 icon-only action buttons (Auto-ban/tune, ELO/calculate, Scan/radar).
- **Collapsible analytics sections**: Device registrations, transfer requests, admin digest history auto-load on mount.
- **Bulk actions**: Multi-select ban/clear operations across suspicious players.
- Companion page `app/admin-anticheat-config.tsx` for per-factor threshold tuning.

### 1.5 User-Facing Trust Score Transparency
- New page: `app/trust-score-factors.tsx`.
- Displays all 26 factors grouped into 6 categories.
- Per-factor: status chip (OK / warning / problem), description, real-world example, personalized advice.
- Category filter chips with problem counters.

---

## 2. Timezone Management System

Every match, meetup, event, and reminder is now timezone-aware based on the facility (terrain) where it occurs.

### 2.1 Architecture
- IANA timezone identifiers stored at the **terrain** level (`terrains.timezone`).
- User preference model (`user_preferences.display_timezone`): `auto | terrain | custom`.
- `resolveDisplayTimezone()` prioritizes the terrain's zone when `auto` is selected and a terrain is attached.

### 2.2 Core Service — `services/timezoneService.ts`
- `getDateStringInTimezone(date, tz)` — replaces unsafe `toISOString().slice(0, 10)` (fixes UTC-midnight boundary bug).
- `formatInTimezone(date, tz, format)` — Intl.DateTimeFormat wrapper with graceful fallback.
- `estimateTimezoneFromLongitude(lon)` — longitude-based estimation when IANA zone is missing.

### 2.3 UI Component — `components/ui/TimezoneBadge.tsx`
Displays conversion pairs (e.g., "20:00 Paris (14:00 chez vous)") whenever the displayed time differs from the viewer's device time.
Rolled out across **15+ pages**: player, club, match, tournament, challenge, meetup, history cards, push notification payloads.

### 2.4 Related Services
- `services/timezoneAutoRefreshService.ts` — refresh timezone when a terrain changes location.
- `app/admin-timezone-migration.tsx` — admin tool for bulk-fixing legacy terrains missing timezone data.

### 2.5 Bug Fixes During Rollout
- **Meetup reminders at wrong time**: `scheduleMeetupNotifications` was computing times on the device zone; fixed to use facility zone.
- **UTC-midnight boundary bug**: swapped `toISOString().slice(0, 10)` for `getDateStringInTimezone()` throughout.

---

## 3. Push Notifications (Timezone-Aware)

### 3.1 Edge Function — `supabase/functions/send-push/index.ts`
- Payload bodies now format event times in the recipient's resolved display timezone.
- Reminder scheduler uses facility timezone to compute "24h before" / "72h before" offsets.
- Deep-link routing: `app/_layout.tsx` has a central notification response listener that maps `data.type` to the proper screen (30+ notification types supported).

### 3.2 Notification Types (Non-Exhaustive)
- `share_request`, `share_request_reminder`, `share_request_expired`
- `match_mentioned`, `impersonation_alert`
- `event_created`, `event_reminder`, `meetup_invitation`
- `witness_request`, `witness_attested`
- `club_claim`, `club_invitation`, `club_invitation_reminder`
- `admin_critical_alert`, `admin_deletion_alert`, `anticheat_digest`
- `team_invitation`, `team_chat_message`, `team_deadline_reminder`
- `terrain_activity`, `ranking_changed`, `device_transfer_decision`

---

## 4. Match Sharing & Verification

Multi-player match verification with cross-player share requests, verified badges, and automated lifecycle management.

### 4.1 Core Services
- `services/matchShareService.ts` — orchestrates cross-player share requests.
- `services/shareReminderService.ts` — 24h + 72h reminders, 7-day auto-decline.
- `services/impersonationService.ts` — matches local entries against real accounts to detect impersonation.

### 4.2 Unified Share Modal — `components/ui/ShareRequestModal.tsx`
**Two-step flow**:
1. **Step 1 — Auto-detection**: Finds linked player accounts in the match; shows multi-select checkboxes with per-recipient read/write permission toggles.
2. **Step 2 — Advanced options**: Public share link, QR code, granular permissions.

For local-only (training) matches with no linked accounts, Step 1 is skipped and the modal jumps directly to Step 2.

### 4.3 Share Button Consolidation (Recent Work)
Replaced legacy dual-button patterns ("Quick Share" + "Advanced Share") with a single unified "Partager" button that opens `ShareRequestModal`. Applied across:

| File | Before | After |
|------|--------|-------|
| `app/match/new.tsx` | 2 buttons (coequipiers + participants) | 1 "Partager" button |
| `app/match-detail/[id].tsx` | Quick Share block + header icon → ShareModal | 1 "Partager" entry → ShareRequestModal |
| `app/tournament/[id].tsx` | Quick Share section + header → ShareModal | 1 "Partager" entry → ShareRequestModal |

### 4.4 Save-and-Share Auto-Detection
In `app/match/new.tsx`, the "Save & Finish" handler now:
1. Awaits the match save.
2. Calls `detectLinkedPlayers()`.
3. If linked accounts exist → auto-opens `ShareRequestModal`.
4. Otherwise → silent save + navigate home.

### 4.5 Verified / Unverified Badges
- `components/ui/SharedBadge.tsx` — renders verification state next to share counts.
- `components/ui/ShareStatusSection.tsx` — detail breakdown on the match page.

### 4.6 Match Mentioning Page
- Route: `/matches-mentioning-me` (`app/matches-mentioning-me.tsx`).
- Accessible via the purple widget card on the home tab (`app/(tabs)/index.tsx`).

---

## 5. FAQ Analytics (Lightweight)

### 5.1 Service — `services/faqAnalyticsService.ts`
- Session-based event tracking: `question_view`, `search`, `search_no_result`, `category_view`, `resolved`.
- Session ID persisted in AsyncStorage per device.
- Silent inserts into `faq_analytics` table (admin-only SELECT via RLS).

### 5.2 Admin Dashboard — `app/admin-faq-analytics.tsx`
- Client-side aggregation for sub-second load times.
- CSV export of raw events.
- KPI cards (total views, no-result rate, top questions, top searches).

### 5.3 Bug Fix
- **Missing `useEffect` import in `app/faq.tsx`** — caused ReferenceError on mount; added to React import.

---

## 6. Admin Features

### 6.1 Dashboards
- `app/admin-dashboard.tsx` — overall KPIs with lazy-loaded sections.
- `app/admin-anticheat.tsx` — anti-cheat command center (see §1.4).
- `app/admin-faq-analytics.tsx` — FAQ engagement metrics.
- `app/admin-ab-tests.tsx` — A/B test tracking.
- `app/admin-changelog.tsx` — in-app changelog viewer.

### 6.2 Content Management
- `app/admin-announcements.tsx` — multi-language announcements with push targeting.
- `app/admin-maintenance.tsx` — maintenance mode toggle, scheduled maintenance, email farm auto-ban config.
- `app/admin-moderation.tsx` — review and ban appeal management.
- `app/admin-reports.tsx` — player reports queue.

### 6.3 Entities
- `app/admin-users.tsx`, `app/admin-clubs.tsx`, `app/admin-terrains.tsx`.
- `app/admin-sponsors.tsx`, `app/admin-partners.tsx`, `app/admin-promos.tsx`.
- `app/admin-notifications.tsx` — push notification composer.

### 6.4 Activity Log
- `app/admin-activity-log.tsx` + `services/adminActivityLogService.ts`.
- Every destructive admin action is logged with `admin_user_id`, `action_type`, `target_type`, `target_id`, metadata.

---

## 7. Platform & Build Fixes

### 7.1 TurboModule Registration Error (Android AdMob)
- **Error**: `TurboModuleRegistry.getEnforcing(...): 'RNGoogleMobileAdsModule' could not be found`.
- **Root cause**: `require()` triggered `TurboModuleRegistry.getEnforcing()` at module init time, failing at the native layer before JS try/catch could intercept.
- **Fix**: `services/googleMobileAdsModule.native.ts` now uses `TurboModuleRegistry.get()` (safe null return) + legacy `NativeModules` fallback → graceful degradation on builds without native AdMob support.

### 7.2 Gold Sponsor ↔ AdMob Sync
- `services/goldSponsorAdReplacement.ts` + `bindGoldSponsorSyncOnAppResume()` registered in `app/_layout.tsx`.
- When a gold sponsor is active for the current user, ads are suppressed and replaced with sponsor banners.

### 7.3 Device Transfer
- `services/deviceTransferService.ts` + `app/device-transfer.tsx`.
- Admin-approved transfer codes allow legitimate users to migrate accounts to new devices without being auto-banned by fingerprint reuse detection.

### 7.4 Ban Lifecycle
- `services/banCheckService.ts` + `components/ui/BanScreen.tsx` + `app/_layout.tsx`.
- Checks ban status on mount and every 60 seconds; blocks the entire app with the BanScreen if banned.
- `services/banAppealService.ts` + `ban_appeals` table for appeal workflow.

---

## 8. Social / Community Features

### 8.1 Terrain Meetups
- `app/meetup/*.tsx` + `services/meetupService.ts` + `services/meetupChatService.ts`.
- Create ad-hoc gatherings at a terrain, invite friends, chat in real time (polling-based), typing indicators, read receipts, message reactions.

### 8.2 Tournament Teams & Chat
- `app/team-chat/[id].tsx` + `services/teamChatService.ts` + `services/teamInvitationService.ts`.
- Full chat system with reactions, read receipts, typing status, deadline reminders.

### 8.3 Sponsored Events
- `app/sponsored-event/*.tsx` + `services/sponsoredEventService.ts`.
- Ambassador-created events with participant tracking, witness attestation, and leaderboards.

### 8.4 Ambassadors / Partners
- `app/ambassadors.tsx`, `app/ambassador-dashboard.tsx`, `app/ambassador-program.tsx`.
- `app/partners.tsx`, `app/partner-program.tsx`, `app/partner-analytics.tsx`, `app/partner/[id].tsx`.
- Tiered badge system (`constants/partnerTiers.ts`), referral codes, analytics, expiration alerts.

### 8.5 Activity Feed
- `app/activity-feed.tsx` + `services/activityFeedService.ts` + `services/feedReactionService.ts`.
- Public feed of recent matches, badges, rankings; reactions supported.

---

## 9. Leaderboards & Rankings

### 9.1 Core Services
- `services/leaderboardService.ts` — base leaderboard queries.
- `services/weeklyLeaderboardService.ts` — snapshot-based weekly rankings (`weekly_leaderboard_snapshots`).
- `services/clubLeaderboardService.ts`, `services/boulesLeaderboardService.ts` — specialized leaderboards.
- `services/geoLeaderboardService.ts` — city / country rankings.
- `services/globalRankingService.ts`, `services/rankingChangeService.ts` — ranking delta notifications.

### 9.2 UI Pages
- `app/leaderboard.tsx`, `app/leaderboard-geo.tsx`, `app/global-ranking.tsx`.
- `app/club-leaderboard.tsx`, `app/club-city-ranking.tsx`, `app/city-leaderboard.tsx`.
- `app/boules-ranking/[id].tsx`, `app/club-ranking/[id].tsx`.
- `app/role-performance.tsx` — per-role (Tireur / Pointeur / Milieu) analysis.

### 9.3 ELO System
- `services/eloService.ts` + `elo_history`, `elo_seasons` tables.
- Separate ELO per role (tireur / pointeur / milieu).
- `app/elo-awards.tsx` — seasonal awards page.

---

## 10. Share Cards (Social Media Export)

`components/feature/share-cards/` contains 15+ ready-to-render card formats:
- Match, Challenge, H2H, Team Synergy, Tournament
- Season, Season Comparison, Palmares, League, Milestone
- Club, Stats, Weekly Digest, Badge, Event Leaderboard, Sponsored Event

Each card supports multiple visual themes and a shared `ShareCardWatermark`.

---

## 11. State Management Architecture

### 11.1 Context Split
`contexts/AppContext.tsx` is split into three sub-contexts to avoid full-tree re-renders:
- **Data** — Map-based caches with O(1) lookups.
- **UI** — modal visibility, toasts, loading states.
- **Actions** — mutation handlers, conflict resolution.

### 11.2 Related Hooks
- `hooks/useAppComputed.ts` — memoized derived data.
- `hooks/useAppGetters.ts` — stable getter functions.
- `hooks/useSelectors.ts` — Zustand-style selector pattern.

### 11.3 Conflict Resolution
- `services/collaborativeEditService.ts` + `components/ui/ConflictResolutionModal.tsx`.
- When two users edit a shared item concurrently, the modal prompts for conflict resolution.

---

## 12. Testing

### 12.1 Unit Tests (`__tests__/unit/`)
80+ test files covering services, hooks, and components. Highlights:
- `trustScoreService.test.ts`, `multiAccountService.test.ts`, `deviceFingerprintService.test.ts`
- `matchShareService.test.ts`, `shareService.test.ts`, `witnessService.test.ts`
- `edgeFunctions-*.test.ts` — mocked Deno edge function logic.
- `useAppComputed.test.ts`, `useAppGetters.test.ts`, `useFavorites.test.ts`.

### 12.2 E2E (`__tests__/e2e/` + `.maestro/flows/`)
- `01-login-flow.yaml` → `05-iap-flow.yaml` — Maestro flows for critical user journeys.
- Jest-based e2e scaffolding for auth, badges, cross-player sharing, exports, IAP, meetups, tournament lifecycle.

---

## 13. Database Schema Snapshot

**Total tables**: 50+ (see `Backend Context` in system info).

### 13.1 Critical Tables
- `user_profiles` (RLS: own only + admin)
- `players`, `matches`, `challenges`, `tournaments`, `tournament_teams`
- `clubs`, `terrains`, `boules_sets`
- `shared_items`, `match_share_requests`, `match_witness_requests`
- `suspicious_players`, `trust_score_history`, `behavioral_digest_history`
- `device_registrations`, `device_transfer_requests`, `ban_appeals`
- `ambassadors`, `ambassador_analytics`, `partner_goals`, `sponsored_events`, `sponsor_proposals`
- `faq_analytics`, `admin_activity_logs`, `maintenance_logs`, `onboarding_step_logs`

### 13.2 RLS Policy Count
**90+ policies** — each table has separate policies per role (anon, authenticated, admin) and per operation (SELECT, INSERT, UPDATE, DELETE). Pattern:
```
{role}_{operation}_{description}
```

### 13.3 Storage Buckets
`avatars`, `boules-photos`, `club-cards`, `federation-cards`, `partner-gallery`, `terrain-photos` — all public read, authenticated write.

### 13.4 Edge Functions
`admin-stats`, `delete-account`, `detect-suspicious`, `notify-referral`, `record-purchase`, `send-push`, `validate-promo-code`, `validate-receipt`, `weekly-cron`.

---

## 14. Known Follow-Up Opportunities

- **Realtime via polling**: OnSpace Cloud does not support Supabase Realtime; all "live" features (meetup chat, team chat, typing indicators) use polling. Consider interval tuning if active user counts grow.
- **Share request expiry UX**: 7-day auto-decline is silent; consider showing an in-app banner the day before.
- **Timezone fallback**: longitude-based estimation is approximate (±1 hour at best); encourage terrain owners to confirm IANA zones via the admin migration tool.
- **AdMob stub**: Current fallback silently disables ads if the native module is missing. Consider surfacing a "Monetization unavailable on this build" indicator for QA.

---

## 15. File Index — Recently Modified

| File | Purpose |
|------|---------|
| `app/_layout.tsx` | Root providers, notification routing, ban check, Sentry init |
| `app/(tabs)/_layout.tsx` | Tab bar with Home / Stats / Directory / Map |
| `app/match/new.tsx` | Match creation + unified share button + auto-detect on save |
| `app/match-detail/[id].tsx` | Match viewer + unified "Partager" entry point |
| `app/tournament/[id].tsx` | Tournament detail + unified share flow |
| `app/matches-mentioning-me.tsx` | Dedicated view of matches where user is mentioned |
| `app/admin-anticheat.tsx` | Compressed admin anti-cheat dashboard |
| `app/admin-anticheat-config.tsx` | Per-factor threshold tuning |
| `app/admin-faq-analytics.tsx` | FAQ engagement dashboard |
| `app/admin-timezone-migration.tsx` | Bulk timezone fix tool |
| `app/trust-score-factors.tsx` | User-facing 26-factor transparency page |
| `app/faq.tsx` | FAQ page (fixed missing `useEffect` import) |
| `components/ui/ShareRequestModal.tsx` | Unified 2-step share flow |
| `components/ui/TimezoneBadge.tsx` | Conversion-pair display across the app |
| `components/ui/BanScreen.tsx` | Full-screen ban UI |
| `services/trustScoreService.ts` | 26-factor scoring engine |
| `services/timezoneService.ts` | IANA zone utilities |
| `services/matchShareService.ts` | Cross-player share orchestration |
| `services/shareReminderService.ts` | 24h/72h reminders + 7-day auto-decline |
| `services/impersonationService.ts` | Local-vs-account impersonation detection |
| `services/faqAnalyticsService.ts` | FAQ event tracking |
| `services/googleMobileAdsModule.native.ts` | Safe TurboModule probe |
| `supabase/functions/detect-suspicious/index.ts` | Single-pass critical alert generator |
| `supabase/functions/send-push/index.ts` | Timezone-aware push payloads |

---

*End of handoff document. For deeper context on any section, see the files referenced in the "File Index" or the source summary in `docs/CHANGE_HISTORY.md`.*
