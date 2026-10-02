# Change History

## Recent Changes

### Share Button Consolidation & Match Save Flow

#### 1. Unified Share Button in Match Victory Screen (`app/match/new.tsx`)
- **Before**: Two separate buttons — "Partager avec les coequipiers" (green quick share) and "Partager avec les participants" (outlined advanced share).
- **After**: Single "Partager" button that opens the unified 2-step `ShareRequestModal`:
  - **Step 1**: Auto-detection of linked accounts + per-recipient read/write permissions.
  - **Step 2**: Advanced options (public link, QR code, granular permissions).
- Removed unused state (`quickShareWinnerState`, `quickShareWinnerCount`) and the standalone quick-share callback.

#### 2. Auto-Open Share Modal After Save & Finish
- **Issue**: Banner "X player(s) with account detected" never appeared after saving.
- **Fix**: "Save & Finish" now calls `detectLinkedPlayers()` first; if linked accounts exist, it saves the match and automatically opens `ShareRequestModal` so the detection banner is shown.
- Fallback: no linked accounts → silent save + return to home.

#### 3. Unified Share Button for Training Matches (Local-Only)
- **Issue**: The "Partager" button was hidden when all players were locally created (no linked accounts).
- **Fix**: Button always visible. `ShareRequestModal` internally handles the empty-detection case by jumping directly to Step 2 (public link / QR code).

#### 4. "Matches Mentioning Me" Page Location
- Accessible from:
  - Home screen → purple widget "Matchs me mentionnant"
  - Direct route: `/matches-mentioning-me`
- Registered in `app/_layout.tsx` and linked from `app/(tabs)/index.tsx` (line 927).

#### 5. Merged Share Buttons in Match Detail (`app/match-detail/[id].tsx`)
- Removed the standalone "Quick Share with Teammates" block.
- Imported `ShareRequestModal` and added state (`showShareRequestModal`).
- Header share icon and in-page "Partager ce match" CTA both open `ShareRequestModal` instead of `ShareModal`.

#### 6. Merged Share Buttons in Tournament Detail (`app/tournament/[id].tsx`)
- Removed the "Partager avec les coequipiers" quick share section.
- Added `ShareRequestModal` state and rendering.
- `handleOpenShare` now opens the unified 2-step flow instead of the legacy ShareModal.

---

## Prior Context (Compressed Summary)

### FAQ Page Error Fix
- Added missing `useEffect` import in `app/faq.tsx` (ReferenceError on mount).

### Admin Anti-Cheat Dashboard Polish
- Compressed header: text buttons replaced with 40×40 icon-only squares (Auto-ban/tune, ELO/calculate, Scan/radar).
- Added always-visible "Overview Hero" KPI card (Flagged / Watched / Banned / OK).
- Auto-load device registrations, transfer requests, and admin digest history on mount.

### TurboModule Registration Error (Android AdMob)
- Root cause: `require()` triggered `TurboModuleRegistry.getEnforcing()` at module init.
- Fix: `TurboModuleRegistry.get()` (safe null return) + legacy `NativeModules` fallback in `services/googleMobileAdsModule.native.ts`.

### Duplicate Alert Push Notifications
- Rewrote `supabase/functions/detect-suspicious/index.ts` for a clean single-pass critical alert pipeline.

### UTC-Midnight Boundary Bug
- Replaced `toISOString().slice(0, 10)` with `getDateStringInTimezone()` from `timezoneService` for facility-timezone-aware "today" comparisons.

### Meetup Reminders at Wrong Time
- `scheduleMeetupNotifications` now computes reminder times in facility timezone, preventing cross-timezone users from receiving alerts at wrong local times.

### Timezone-Aware Event Scheduling
- IANA timezone stored at terrain level.
- User preference system: `auto | terrain | custom` in `user_preferences`.
- `resolveDisplayTimezone()` prioritizes terrain timezone when available in auto mode.
- `TimezoneBadge` displays conversion pairs (e.g., "20:00 Paris (14:00 chez vous)") whenever displayed time differs from device time.
- Rolled out across 15+ pages (player, club, match, tournament, challenge, meetup, history cards, push notification payloads).

### FAQ Analytics (Lightweight)
- Session-based event tracking: `question_view`, `search`, `search_no_result`, `category_view`, `resolution`.
- Session ID persisted in AsyncStorage per device.
- `trackFaqEvent()` silently inserts into `faq_analytics` (admin-only SELECT via RLS).
- `getFaqAnalyticsSummary()` aggregates events client-side for sub-second dashboard loads.
- CSV export available.

### User Trust Score Transparency
- New page `app/trust-score-factors.tsx` showing all 26 anti-cheat factors.
- Organized by 6 categories (geographic, temporal, behavioral, statistical, identity, social).
- Per-factor status (OK/warning/problem), description, real-world example, personalized advice.
- Category filter chips with problem indicators.

### Earlier Core Features
- Cross-player match sharing + ELO sync.
- Google Places integration (multi-photo, timezone extraction, reverse geocoding).
- Leaderboard anti-cheat (26-factor trust scoring, device fingerprinting, multi-account detection, three-tier category anomaly detection).
- Tournament CRUD + bracket management.
- Match sharing with verified/unverified badges and 24/72h reminders.
- Impersonation detection with local-entry matching.

---

## File Index of Recent Changes
| File | Change |
|------|--------|
| `app/match/new.tsx` | Merged victory-screen share buttons; auto-open modal after Save & Finish |
| `app/match-detail/[id].tsx` | Replaced Quick Share with unified Partager → ShareRequestModal |
| `app/tournament/[id].tsx` | Removed quick-share block; header & inline Partager open ShareRequestModal |
| `components/ui/ShareRequestModal.tsx` | 2-step flow (detection + advanced options) |
| `app/faq.tsx` | Added missing `useEffect` import |
| `app/admin-anticheat.tsx` | Compressed header, added Overview Hero + auto-load sections |
| `services/googleMobileAdsModule.native.ts` | Safe TurboModule check + NativeModules fallback |
| `supabase/functions/detect-suspicious/index.ts` | Clean single-pass alert generation |
