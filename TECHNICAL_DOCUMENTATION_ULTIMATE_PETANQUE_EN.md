# ULTIMATE PETANQUE — Technical Handover Document

**Version:** 1.2.1  
**Date:** March 27, 2026  
**Recipient:** External developer in charge of finalization and publication  

---

## 1. GENERAL OVERVIEW

### 1.1 Application Identity

| Field | Value |
|---|---|
| **Name** | Ultimate Petanque |
| **Bundle ID** | `com.ultimatepetanque.app` |
| **Scheme** | `ultimatepetanque://` |
| **Platforms** | iOS, Android, Web (preview) |
| **Languages** | French (default), English |
| **Version** | 1.2.0 |

### 1.2 Main Objective

Provide a comprehensive tool for petanque players to record their games, track detailed statistics (shooting, pointing, carreaux, errors), organize tournaments, manage clubs/terrains, and participate in a connected community with ambassadors, leaderboards, and challenges.

### 1.3 Target Users

- Amateur to expert petanque players (all age groups)
- Petanque clubs and associations
- Ambassadors/influencers in the petanque world
- Brands and sponsors (Obut, MS Petanque, La Boule Bleue, etc.)

### 1.4 Value Proposition

- **Real-time score tracking** with detailed notation (shot type, quality, result)
- **Advanced statistics**: performance, progression, error analysis, cross-referenced stats by terrain/boules/opponent
- **Interactive map** with geolocation of terrains, clubs, players, and tournaments
- **Cross-player sharing**: matches and challenges shared between accounts with permissions, collaborative editing, and automatic stats update
- **Ambassador program** with visibility analytics and sponsored challenges
- **Partner program** with dedicated 6-tab portal (ROI, Placement, Branding, Push, Events, CRM)
- **Community leaderboards**: players, clubs, boules brands, with geographic filters
- **Meetup system** between players via share codes and QR codes
- **Weekly summary** with dual-color daily activity sparkline (matches/challenges)
- **Contextual FAQ** structured by audience (Player, Ambassador, Partner)
- **Complete legal pages**: privacy policy and terms of service updated to cover all programs, with hostable static HTML versions

### 1.5 How It Works

The user registers via email OTP + password, their player profile is created automatically, then they can immediately: record matches (with end-by-end scoring), launch challenges (10 shots, lob shots, precision), create/manage tournaments with phases and brackets, find terrains and clubs on the map, and join the community via leaderboards and ambassadors.

---

## 2. DETAILED FEATURES

### 2.1 Completed Features

| # | Feature | Description | Complexity |
|---|---|---|---|
| 1 | **OTP + Password Authentication** | Registration/login via email OTP (4 digits) + password, persistent session | Medium |
| 2 | **Match Recording** | Creation with format (Singles/Doubles/Triples), mode (Training/Tournament), end-by-end scoring, detailed player actions, Best of 3 series | High |
| 3 | **Advanced Shot Notation** | Types (au fer, au plomb, en rafle, court ramasse, carreau), failure results (short right/left, long, hit jack), impact quality (gain point, decisive, no effect, negative) | High |
| 4 | **Advanced Point Notation** | Types (rolled, lobbed, half-carry, carry), quality (excellent, good, average, at jack, in front of ball, missed, hooked, out) | High |
| 5 | **Challenges** | 3 types: 10 Shots, 10 Lob Shots, Precision (5 workshops). Solo and 1v1 modes with graphical comparison | High |
| 6 | **Complete Statistics** | 4 categories (Performance, Shooting, Pointing, Errors) with time filters (day→all), item filters (match, tournament, opponent, partner, terrain, boules), progression charts | Very High |
| 7 | **Cross-referenced Statistics** | Type×Impact tables (shooting), Type×Quality (pointing), stats by terrain type, stats by boules set with graphical comparison | High |
| 8 | **Error Analysis** | Error rate by duration/format/context, detailed error types with coaching tips, consecutive error streaks | High |
| 9 | **Tournament Management** | Creation with phases (pools, elimination, final), brackets, results, hall of fame, reminder notifications, financial tracking (fees/winnings) | High |
| 10 | **Directory** | 5 tabs (Players, Clubs, Terrains, Tournaments, Ambassador Challenges) with advanced filters, search, duplicate detection, merge with history and undo | Very High |
| 11 | **Interactive Map** | Geolocation of terrains/clubs/players/tournaments, dynamic clustering, public/private items, zone-based leaderboard, batch geolocation mode | High |
| 12 | **Cross-player Sharing** | Auto-detection of linked players, share requests (read/write), acceptance with automatic stats update for recipient, 30s polling, push notifications | Very High |
| 13 | **Collaborative Editing** | Conflict detection via timestamps, field-by-field visual diff, resolution (keep mine / keep server / cancel), traceable modification history | High |
| 14 | **Modification History** | Field-by-field logs with colored diff (red→green), per-field and bulk undo, automatic log cleanup | High |
| 15 | **Ambassador Program (3 Levels)** | 3 progressive levels (Discovery, Confirmed, Elite) with automatic promotion. Discovery: badge, referral code, 2 challenges/month. Confirmed (5+ referrals, 500+ impressions): rotating home banner, full analytics dashboard, unlimited challenges. Elite (20+ referrals, 2000+ impressions): permanent banner, unlimited push, onboarding section, advanced analytics with export. Referral XP system (+50 XP/referral, +25 XP/challenge, +10 XP/100 impressions) | Very High |
| 16 | **Sponsored Challenges** | Event creation by ambassadors, participant registration, witness attestation, leaderboard | High |
| 17 | **Server Push Notifications** | Edge Function `send-push` via Expo Push API with 5 trigger types (ambassador events with 200km proximity, meetup invitations, ranking changes, share requests, reminders), `push_tokens` table, auto-registration, per-type preferences | High |
| 17b | **Local Notifications** | Local push (tournament reminders, share requests, attestations), dedicated Android channels, tap navigation | Medium |
| 18 | **Meetup System** | Meetup creation, invitations by code/QR, responses, confirmed participant counter, prominent "Join Meetup" button | Medium |
| 19 | **Community Leaderboards** | Player ranking (min 5 matches) with geographic filters (world/continent/country/city), club ranking, boules brand ranking, weekly leaderboard with Monday reset | Medium |
| 20 | **Equipment (Boules)** | CRUD boules sets with photo, brand, diameter, weight, hardness, price, primary set synced to profile | Medium |
| 21 | **User Profile** | Accordion sections (Account, Notifications, Data, Community, Legal), avatar, federation card, XP and badges | Medium |
| 22 | **Share Management** | Share status section in match/challenge modals, revocation, modification log history | Medium |
| 23 | **In-App Purchases** | Ad removal (€5.99), promo codes with server-side validation, receipts stored in DB | Medium |
| 24 | **Anti-Fraud** | Device fingerprinting, disposable email blocking, multi-account detection, trust scores (0-100) with 10 factors | Medium |
| 25 | **Offline & Sync** | Local AsyncStorage cache, offline queue with replay, delta sync with soft deletes, conflict resolution, battery saver mode | High |
| 26 | **i18n FR/EN** | 700+ translation keys, system language detection, user preference persistence | Medium |
| 27 | **AdMob Ads** | Strategically positioned inline banners (12 optimized placements, max 1 per viewport), removal via premium purchase | Low |
| 28 | **Deep Linking** | `ultimatepetanque://` scheme, Android intent filters, iOS associated domains, navigation from notifications | Medium |
| 29 | **Sharing System** | Unique share codes, public links, shared items with permissions, share notifications | Medium |
| 30 | **Data Export** | CSV/PDF export with 3-step wizard, 7 presets, CSV column selector, data preview, SVG charts in PDF | Medium |
| 31 | **Ranking Change Detection** | Leaderboard rank snapshot before match save, comparison after, server push notification to affected players | Medium |
| 32 | **Notification Preferences** | Per-type toggles in profile (events, meetups, ranking, shares, reminders), JSONB in `user_preferences`, respected server-side | Medium |
| 33 | **Sentry Monitoring** | `sentryService.ts` integrated at app launch, exception/message capture, navigation breadcrumbs, anonymized user context | Medium |
| 34 | **Rate Limiting Edge Functions** | Anti-abuse protection on `validate-promo-code` (5 req/min) and `record-purchase` (3 req/min) with 429 responses, duplicate transaction detection | Medium |
| 35 | **Weekly Summary (WeeklyStatsCard)** | Weekly summary on home: win rate vs previous week, best performance, dual-color daily sparkline (matches blue/challenges yellow), active streak, link to filtered stats page | Medium |
| 36 | **Audience-Based FAQ** | 3 audience tabs: Player (8 categories, 28 questions), Ambassador (4 categories, 13 questions), Partner (5 categories, 15 questions). 56+ questions covering programs, analytics, push, QR codes, landing pages, sponsored events. Numbered quick actions, direct portal links, integrated search | High |
| 37 | **Harmonized Design System** | Solid #0F172A headers uniform across all pages, glassmorphic cards (#E8EDF2 borders), compact stat chips, pill filters, dynamic tab colors in directory | Medium |
| 38 | **Partner Program (3 Tiers)** | 3 business tiers (Bronze, Silver, Gold) with custom pricing. Bronze: partner card, badge, map marker. Silver: + rotating banner, 1 push/month, analytics dashboard, templates, CSV/PDF export. Gold: + permanent banner, unlimited push with A/B testing, heatmap, ROI calculator, monthly goals, CRM, brand kit, weekly digest, onboarding section | Very High |
| 39 | **Partner Portal (6 Tabs)** | ROI (real-time KPIs, sparklines, competitor benchmark, monthly goals with progress rings, ROI calculator with annual projections, budget tracker CPM/CPC), Placement (per-page breakdown with CTR), Branding (logo upload, brand color, banner and map marker preview, brand kit PDF export), Push (composer with 7 template categories, A/B testing 50/50, scheduling with quick slots, performance heatmap, realistic iOS/Android preview, audience segmentation), Events (sponsored challenges), CRM (referrals with history, CSV export). Integrated notification center, onboarding checklist with +200 XP | Very High |
| 40 | **Partner Landing Pages** | Public page per partner (partner/[id]) with brand color gradient hero, enlarged avatar with tier badge, animated counters (impressions, clicks, CTR, reach), recent activity timeline, social links, events list, referral code with copy, brand-colored QR code, website button | High |
| 41 | **Ambassador/Partner Program Pages** | Dedicated pages with collapsible levels, interactive progression (animated circles, connectors), contextual badges ("POPULAR", "RECOMMENDED"), criteria/benefits summaries, comparison table (partner), testimonials, collapsible FAQ, auto-scroll on expand, detailed XP system | High |
| 42 | **Sponsor Weekly Digest** | Automatic Monday recap for Gold partners: impressions, clicks, CTR, pushes sent, week-over-week comparison. Branded email preview in portal, digest history, PDF export | Medium |
| 43 | **Advanced Push A/B Testing** | A/B test with 50/50 split, title+message variants, results with open rate per variant, full test history, A/B Insights dashboard with statistical significance analysis (confidence, sample size, recommendations), win/loss/tie visualization | High |
| 44 | **Advanced Sponsor Analytics** | Performance heatmap by day/time slot with optimal score, competitor benchmark by tier (impressions, CTR, reach, push), push calendar with legend (sent/scheduled/A/B), monthly push stats with bar chart, geographic target distribution | High |
| 45 | **Updated Legal Pages (v1.2.0)** | Privacy policy: 6 new sections (ambassador program, partner program, trust score, badges/gamification, sponsored events, push/crash). Terms of service: 3 new sections (ambassador program, trust score/anti-cheat, sponsored events). Bilingual static HTML pages hostable (`public/privacy-policy.html`, `public/terms-of-service.html`) | Medium |
| 46 | **Enriched Creator Note** | Title "Created by a player, for the community", community message "12 million players", 5 new features (trust score, badges, ambassador, partner, push A/B), integrated donation section, terrain meetup highlight section | Low |
| 47 | **Store Descriptions** | Complete guide `STORE_ASSETS_GUIDE.md` v1.2.0 with FR/EN descriptions (30-char title, 4000-char description, keywords), covering ambassador/partner program, portal, events, audience-based FAQ | Low |
| 48 | **Universal Links** | `.well-known/apple-app-site-association` (iOS) and `.well-known/assetlinks.json` (Android) files with documented placeholders, complete hosting guide `UNIVERSAL_LINKS_SETUP.md` | Low |

### 2.2 Partially Implemented Features

| # | Feature | Current State | What Remains |
|---|---|---|---|
| 1 | **Google OAuth** | Client code ready (`signInWithGoogle` in template auth) | Enable Google Provider in OnSpace Cloud Dashboard, configure OAuth Client ID/Secret, test on real device |
| 2 | **AdMob** | Test IDs configured (`ca-app-pub-3940256099942544`) | Replace with production IDs, test on EAS builds |

---

## 3. ARCHITECTURE & STRUCTURE

### 3.1 Tech Stack

| Component | Technology |
|---|---|
| **Framework** | React Native + Expo SDK |
| **Language** | TypeScript |
| **Navigation** | Expo Router (file-based routing) |
| **Backend** | OnSpace Cloud (Supabase-compatible) |
| **Database** | PostgreSQL (via OnSpace Cloud) — 24+ tables, 90+ RLS policies |
| **Auth** | Supabase Auth (email OTP + password) |
| **Storage** | Supabase Storage (5 buckets: avatars, boules-photos, club-cards, federation-cards, terrain-photos) |
| **Edge Functions** | Deno (7 functions: delete-account, detect-suspicious, notify-referral, record-purchase, send-push, validate-promo-code, weekly-cron) |
| **State Management** | React Context API (AppContext + LanguageContext) |
| **Cache** | AsyncStorage |
| **Images** | expo-image |
| **Maps** | react-native-maps (mobile), react-leaflet (web) |
| **Notifications** | expo-notifications |
| **Ads** | react-native-google-mobile-ads |
| **Animations** | react-native-reanimated (~3.17.5) with Babel plugin |
| **Charts** | react-native-svg (custom) |
| **QR Codes** | react-native-qrcode-svg |

### 3.2 Data Structure (24+ tables)

```
user_profiles          → User profile (id FK→auth.users, is_premium, is_admin, xp)
players                → Players (user_id FK→user_profiles, stats JSONB, is_public)
clubs                  → Clubs (user_id, terrain_id, is_public)
terrains               → Terrains (user_id, club_id, location JSONB, public_access)
tournaments            → Tournaments (user_id, phases/teams JSONB, is_public, registration_cost, prize_won)
matches                → Matches (user_id, team_a/team_b JSONB, menes JSONB, player_actions JSONB, participant_user_ids uuid[], series_info JSONB)
challenges             → Challenges (user_id, shots JSONB, precision_shots JSONB, detailed_shots JSONB, participant_user_ids uuid[], sponsor_id)
boules_sets            → Boules sets (user_id, is_primary, purchase_price)
ambassadors            → Ambassadors (user_id, player_id, badge_type, is_featured, ambassador_level, referral_code, referral_count, total_referral_xp, brand_color)
ambassador_analytics   → Ambassador analytics (event_type, social_platform, source_page)
sponsored_events       → Sponsored events (ambassador_id, share_code unique)
sponsored_event_participants → Event participants
sponsored_event_witnesses    → Witnesses/attestations
match_share_requests   → Cross-player share requests (sender/recipient, permission, status)
match_witness_requests → Witness attestation requests
shared_items           → Shared items (share_code unique, permission, view_count)
share_notifications    → Share notifications
share_access_logs      → Share access logs
modification_logs      → Modification logs (changes JSONB with field/oldValue/newValue)
soft_deletes           → Soft deletes (for delta sync)
merge_logs             → Merge history
terrain_meetups        → Terrain meetups (share_code unique)
terrain_meetup_responses → Meetup responses
user_preferences       → Preferences (favorites JSONB, notification_preferences JSONB)
user_badges            → Unlocked badges (badge_id, unlocked_at)
weekly_leaderboard_snapshots → Weekly leaderboard snapshots
trust_score_history    → Trust score history
push_tokens            → Expo push tokens (user_id, token, platform, active)
device_registrations   → Device registrations (anti-fraud)
promo_codes / promo_code_redemptions → Promo codes
purchase_receipts      → Purchase receipts
player_reports / suspicious_players  → Reports and trust scores
event_notifications / tournament_notifications → Notifications
```

### 3.3 Screen Organization (Expo Router)

```
app/
├── (tabs)/               ← Main navigation (4 tabs)
│   ├── index.tsx         ← Home (hero, quick actions, weekly summary, timeline, leaderboard, ambassadors, history)
│   ├── stats.tsx         ← Statistics (4 categories, filters, progression, SVG charts)
│   ├── directory.tsx     ← Directory (5 tabs, advanced filters, duplicates, merge)
│   └── map.tsx           ← Map (clusters, public items, zone-based leaderboard)
├── match/new.tsx         ← Match creation (Best of 3, boules/terrain linking)
├── match/[id].tsx        ← Match editing (conflict, read-only, modification logging)
├── challenge/new.tsx     ← Challenge creation (solo/1v1, 3 types, sponsored)
├── history.tsx           ← Match/challenge history (filters, received shares)
├── player/[id|me|new|compare|edit/[id]].tsx
├── club/[id|new|edit/[id]].tsx
├── terrain/[id|new|edit/[id]].tsx
├── tournament/[id|new|edit/[id]].tsx
├── sponsored-event/[id|new|list].tsx
├── meetup/[id|new|invitations].tsx
├── ambassadors.tsx       ← Ambassador list (community only)
├── partners.tsx          ← Partner list (sponsors/business)
├── ambassador-dashboard.tsx ← Ambassador dashboard (analytics, events)
├── ambassador-program.tsx ← Ambassador program (3 levels, criteria, benefits)
├── partner-program.tsx   ← Partner program (3 tiers, comparison, testimonials)
├── sponsor-portal.tsx    ← Partner portal (6 tabs: ROI, Placement, Branding, Push, Events, CRM)
├── sponsor-digest.tsx    ← Weekly digest history
├── sponsor-analytics.tsx ← Detailed sponsor analytics
├── partner/[id].tsx      ← Public partner landing page
├── faq.tsx               ← Audience-based FAQ (3 tabs, 56+ questions)
├── profile.tsx           ← My profile (accordions, XP, badges)
├── login.tsx             ← Authentication (OTP + password)
├── onboarding.tsx        ← Welcome screens (3 steps)
├── badges.tsx            ← Badge collection
├── trust-score.tsx       ← Detailed trust score
├── leaderboard.tsx       ← Full community leaderboard
├── financial.tsx         ← Financial summary (tournaments)
├── palmares.tsx          ← Hall of fame (tournament results)
├── equipment.tsx         ← Boules management
├── scanner.tsx           ← QR code scanner
├── privacy-policy.tsx    ← Privacy policy (24 sections)
├── terms.tsx             ← Terms of service (27 sections)
├── creator-note.tsx      ← Creator note (16 features, donation section)
├── remove-ads.tsx        ← Ad removal / Donation
└── ... (30+ other pages)
```

### 3.4 Service Architecture (50+ services)

```
services/
├── dbMappers.ts                ← 7 DB→types mappers + mergeRecords + calculatePlayerStats
├── matchCrudService.ts         ← add/update/delete matches
├── playerCrudService.ts        ← add/update/delete players
├── clubCrudService.ts          ← add/update/delete clubs
├── tournamentCrudService.ts    ← add/update/delete tournaments
├── terrainCrudService.ts       ← add/update/delete terrains
├── challengeCrudService.ts     ← add/update/delete challenges
├── boulesSetCrudService.ts     ← add/update/delete/setPrimary boules
├── matchShareService.ts        ← Cross-player sharing, polling, detection, stats update
├── collaborativeEditService.ts ← Conflict detection, diff calculation
├── modificationLogService.ts   ← Modification logs, per-field/bulk revert
├── shareService.ts             ← Code sharing, shared items
├── streakService.ts            ← Consecutive streaks, daily activity (FR/EN)
├── weeklyLeaderboardService.ts ← Weekly leaderboard, snapshots, reset
├── trustScoreService.ts        ← Trust score (10 factors, history)
├── badgeService.ts             ← 10 badges, XP, progression
├── leaderboardService.ts       ← Community leaderboards (players, clubs, boules)
├── rankingChangeService.ts     ← Ranking change detection
├── sentryService.native.ts     ← Sentry crash reporting (documented DSN placeholder)
├── sentryService.web.ts        ← Sentry web stub
├── notificationPreferencesService.ts ← Per-type notification preferences
├── pushTokenService.ts         ← Push token registration
├── offlineQueueService.ts      ← Offline queue, replay, conflicts
├── cacheService.ts             ← AsyncStorage cache
├── ambassadorService.ts        ← Ambassador CRUD (3 levels, auto-promotion)
├── ambassadorAnalyticsService.ts ← Ambassador and sponsor analytics
├── pushQuotaService.ts         ← Push quota management by partner tier
├── sponsoredEventService.ts    ← Sponsored events
├── meetupService.ts            ← Meetups
├── publicItemsService.ts       ← Public items (map)
├── exportService.ts            ← CSV/PDF export
├── iapService.native.ts        ← In-App Purchase (native)
├── iapService.web.ts           ← IAP web stub
├── adService.native.ts         ← AdMob (native)
├── adService.web.ts            ← AdMob web stub
├── haptics.native.ts / .web.ts ← Haptics (platform-specific)
├── location.native.ts / .web.ts ← Geolocation (platform-specific)
├── camera.native.ts / .web.ts  ← Camera (platform-specific)
└── ... (other specialized services)
```

### 3.5 Security (RLS)

- **90+ RLS policies** active on all tables
- Patterns: `authenticated_*_own_*` (own CRUD), `admin_*` (admin), `public_select_*` (public read), `participant_*_shared_*` (shared items), `shared_select_*` (items shared via code)
- **9 DB triggers**: auto profile creation, metadata sync, soft deletes on 7 tables
- **5 DB functions**: handle_new_user, sync_user_metadata, is_meetup_creator, log_soft_delete, get_premium_user_ids
- **7 Edge Functions**: delete-account, detect-suspicious, notify-referral, record-purchase, send-push, validate-promo-code, weekly-cron
- **30+ performance indexes**

### 3.6 Build Configuration

#### babel.config.js
```js
module.exports = function (api) {
  api.cache(true)  // IMPORTANT: must be true for EAS builds
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],  // REQUIRED for animations
  }
}
```

#### app.json — Critical Points
- `newArchEnabled: false` — disabled for compatibility with react-native-qrcode-svg and react-native-google-mobile-ads
- `expo-camera` plugin declared for QR scanner
- `react-native-google-mobile-ads` plugin with test IDs (replace for production)
- `android.config.googleMaps.apiKey` — documented placeholder (fill in)

#### eas.json — Build Profiles
- `development`: development client, internal distribution
- `preview`: Android APK for internal testing
- `production`: Android AAB + iOS for store submission

---

## 4. CURRENT PROJECT STATE

### 4.1 What Is Functional (Production-ready)

- Complete authentication (OTP + password)
- Full CRUD for all entities (7 extracted and tested services)
- Advanced statistics with all categories and filters
- Weekly summary with dual-color sparkline and filtered stats link
- Interactive map with clustering, public items, and zone-based leaderboard
- Cross-player sharing with permissions, notifications, and automatic stats update
- Collaborative editing with conflict resolution and traceable history
- Ambassador program with 3 levels (Discovery/Confirmed/Elite) with automatic promotion and XP system
- Partner program with 3 tiers (Bronze/Silver/Gold) with full 6-tab portal
- Partner portal: ROI with benchmark/goals/calculator, Branding with brand kit, Push with A/B testing/templates/heatmap/scheduling, CRM with export
- Partner landing pages with branded hero, animated counters, QR code
- Ambassador and partner program pages with collapsible levels and comparison
- Audience-based FAQ (Player/Ambassador/Partner, 56+ questions)
- Sponsored challenges with witness attestation
- Automatic weekly digest for Gold partners
- Meetup system with QR codes
- Offline mode with queue, replay, and delta sync
- Complete FR/EN i18n (700+ keys)
- Harmonized design system (#0F172A headers, glassmorphic cards, 12 optimized AdBanners)
- Unit and integration tests
- AdMob ads (test IDs)
- Working deep linking
- Anti-fraud (fingerprinting, trust scores, multi-account detection)
- Optimized demo data (8 players, 4 clubs, 5 terrains, 3 tournaments, 12 matches, 6 challenges)
- **Complete legal pages**: privacy policy (24 sections) and terms of service (27 sections) covering all programs
- **Static HTML pages** bilingual for public hosting (`public/privacy-policy.html`, `public/terms-of-service.html`)
- **Enriched creator note** with 16 features, donation section, community message
- **Store descriptions guide** v1.2.0 (`STORE_ASSETS_GUIDE.md`)
- **Universal Links files**: `.well-known/apple-app-site-association` and `.well-known/assetlinks.json`
- **Universal Links guide** (`UNIVERSAL_LINKS_SETUP.md`)
- **EAS configuration** with documented build profiles (`eas.json`)
- **Sentry DSN placeholder** documented in `sentryService.native.ts`
- **Google Maps API Key placeholder** documented in `app.json`

### 4.2 Partially Implemented

- **Google OAuth**: client code ready but provider not enabled server-side
- **AdMob**: works in test mode, requires production IDs

### 4.3 What Is Missing

- Real device testing (IAP, notifications, deep links)
- Production AdMob IDs (replace test IDs in `app.json`)
- Real Google Maps API Key (replace placeholder in `app.json`)
- Real Sentry DSN (replace placeholder in `sentryService.native.ts`)
- Apple credentials for submission (Apple ID, Team ID, ASC App ID in `eas.json`)
- Google Play service account (JSON file for `eas.json`)

---

## 5. FINALIZATION ROADMAP

### 5.1 Configuration Steps

| # | Step | Description | OnSpace Action | External Action | Priority |
|---|---|---|---|---|---|
| 1 | **Google OAuth** | Enable Google authentication | OnSpace Cloud Dashboard → User → Auth Settings → Enable Google Provider, enter Client ID & Secret | Google Cloud Console: create project, configure OAuth consent screen, create credentials (Web + iOS + Android) | High |
| 2 | **AdMob Production** | Replace test IDs | Modify `app.json` (androidAppId, iosAppId) with real IDs | Google AdMob Console: create iOS + Android app, create ad units (banner + interstitial) | High |
| 3 | **EAS Build** | Profiles already configured in `eas.json` | — | Install EAS CLI, fill in placeholders in `eas.json` (Apple ID, Team ID, ASC App ID, service account JSON) | High |
| 4 | **iOS Certificates** | Provisioning profiles and certificates | — | Apple Developer: create App ID, Distribution Certificate, Provisioning Profile (or let EAS handle) | High |
| 5 | **Android Keystore** | Generate signing keystore | — | EAS handles automatically or generate manually via `keytool` | High |
| 6 | **Push Notifications** | Configure push credentials | OnSpace Dashboard → Cloud → Secrets (if APNs key needed) | Apple Developer: create APNs Key (.p8) | Medium |
| 7 | **Deep Linking prod** | Universal Links files already created (`.well-known/`) | Host files on `ultimatepetanque.app` (see `UNIVERSAL_LINKS_SETUP.md`) | Replace placeholders (Team ID, Bundle ID, package fingerprint) | Medium |
| 8 | **Google Maps API** | Placeholder in `app.json` ready | Replace `YOUR_GOOGLE_MAPS_API_KEY` in `app.json` | Google Cloud Console: enable Maps SDK for Android/iOS, create restricted API key | High |
| 9 | **IAP Real Testing** | Test in-app purchases | — | App Store Connect: create IAP (€5.99), sandbox testers; Google Play Console: create product, license testing | High |
| 10 | **Sentry DSN** | Placeholder in `sentryService.native.ts` ready | — | Sentry.io: create project, retrieve DSN, replace placeholder | Medium |
| 11 | **Device Testing** | Test on physical iOS and Android | Download APK via OnSpace, use OnSpace App QR code for iOS | — | High |
| 12 | **Store Assets** | Complete guide in `STORE_ASSETS_GUIDE.md` | — | Capture screenshots, write descriptions following the guide | High |
| 13 | **Hosted Legal Pages** | HTML files ready in `public/` | Host `public/privacy-policy.html` and `public/terms-of-service.html` on a public URL | Enter URLs in store listings | High |

---

## 6. STORE PUBLICATION

### 6.1 Apple App Store Publication

#### Prerequisites

- Apple Developer Account ($99/year)
- EAS CLI configured with Apple credentials (fill `eas.json` → submit → ios)
- App Store Connect: app created with Bundle ID `com.ultimatepetanque.app`

#### Detailed Steps

1. **Create the app in App Store Connect**
   - Name: "Ultimate Petanque"
   - Bundle ID: `com.ultimatepetanque.app`
   - SKU: `ultimatepetanque`
   - Primary Category: Sports
   - Secondary Category: Utilities

2. **Configure metadata**
   - Description (FR + EN) — see `STORE_ASSETS_GUIDE.md`
   - Keywords (max 100 characters)
   - Support URL: `ultimate.petanque.app@gmail.com`
   - Privacy policy URL: hosted URL of `public/privacy-policy.html`
   - Screenshots (6.7" iPhone 15 Pro Max, 6.1" iPhone 15, 12.9" iPad Pro)

3. **Configure In-App Purchases**
   - Product: "Remove ads" — €5.99 (non-consumable)
   - Localize in FR and EN

4. **Configure App Privacy**
   - Privacy declaration: collected data (email, location, analytics)
   - App Tracking Transparency (already implemented via `expo-tracking-transparency`)

5. **Build and submission**
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios
   ```

### 6.2 Google Play Store Publication

#### Prerequisites

- Google Play Developer Account ($25 one-time)
- EAS CLI configured (fill `eas.json` → submit → android with service account JSON)
- Google Play Console: app created

#### Detailed Steps

1. **Create the app in Google Play Console**
   - Name: "Ultimate Petanque"
   - Package: `com.ultimatepetanque.app`
   - Category: Sports

2. **Store Listing**
   - FR/EN descriptions — see `STORE_ASSETS_GUIDE.md`
   - Icon (512×512 PNG)
   - Feature Graphic (1024×500 PNG)
   - Screenshots (min 2)
   - Privacy policy URL: hosted URL of `public/privacy-policy.html`

3. **Build and submission**
   ```bash
   eas build --platform android --profile production
   eas submit --platform android
   ```

---

## 7. TECHNICAL RECOMMENDATIONS

### 7.1 Priority Improvements

1. **Production Monitoring**: Sentry is integrated via `services/sentryService.native.ts` with a documented DSN placeholder. **Action**: create a project on Sentry.io and replace the DSN.

2. **Rate Limiting**: Edge Functions `validate-promo-code` (5 req/60s) and `record-purchase` (3 req/60s) have rate limiters with 429 responses.

3. **Data Validation**: Add server-side validation for critical data (scores, statistics).

4. **Automated E2E Tests**: Complete the test suite with Detox or Maestro.

### 7.2 Best Practices Already in Place

- Data-Logic-UI architecture (services → hooks → components)
- Platform-specific services (.native.ts / .web.ts) for all native modules
- RLS enabled on all tables with separate policies
- Delta sync with soft deletes
- Local cache with offline fallback
- Complete i18n (700+ FR/EN keys) split across 2 files (i18n.ts + i18nExtra.ts)
- Reanimated Babel plugin configured
- `newArchEnabled: false` for maximum library compatibility
- `api.cache(true)` in babel.config.js for build optimization
- Unit and integration tests
- Unified and harmonized design system
- Complete legal pages with hostable static HTML versions

### 7.3 Risks to Anticipate

| Risk | Impact | Mitigation |
|---|---|---|
| **App Store rejection** for external payment | Blocking | Ensure all purchases go through Apple IAP |
| **Performance on low-end devices** | Medium | `useMemo` used throughout, FlatList for lists, optimized map clustering |
| **Apple review delay** | Planning | Allow 1-7 business days, submit early in the week |
| **Google OAuth rejected** | Functional | System already works without OAuth (OTP + password) |

### 7.4 Build-Specific Points of Attention

- **AdMob IDs in `app.json`** are test IDs (`ca-app-pub-3940256099942544`). **Do not publish with these IDs**.
- `newArchEnabled` is `false` in `app.json` — do not change to avoid incompatibilities.
- The `react-native-reanimated/plugin` in `babel.config.js` is **required** — its absence causes crashes.
- `api.cache(true)` in `babel.config.js` — do not change to `false` (significantly slows builds).
- The `expo-camera` plugin must be declared in `app.json` for the QR scanner to work.
- The **Google Maps API Key** must be configured for the map to work on Android.

---

## 8. POST-PUBLICATION FOLLOW-UP AND V2 ROADMAP

### 8.1 Immediate Post-Publication Actions

| # | Action | Priority |
|---|---|---|
| 1 | Daily Sentry crash monitoring, critical fixes within 24h | Critical |
| 2 | Monitor store reviews, respond within 48h | High |
| 3 | Track metrics: downloads, D1/D7/D30 retention, crash rate | High |
| 4 | Verify Supabase API performance | High |
| 5 | EAS hotfix process prepared | Medium |

### 8.2 V2 Feature Roadmap

| # | Feature | Complexity | Impact |
|---|---|---|---|
| 1 | **Dark Mode** | Medium | High |
| 2 | **Player Chat** | Very High | High |
| 3 | **iOS/Android Widget** | Medium | Medium |
| 4 | **Artificial Intelligence** (predictive analysis via OnSpace AI) | High | High |
| 5 | **Video Replay** of notable shots | High | Medium |
| 6 | **Sponsor Marketplace** | High | Business |
| 7 | **Subscription System** monthly/yearly premium | Medium | Business |
| 8 | **Extended Localization** (Spanish, Italian, Portuguese) | Medium | Medium |

### 8.3 Update Process

```bash
# Preview build for testing
eas build --profile preview

# Production build
eas build --platform ios --profile production
eas build --platform android --profile production

# Submission
eas submit --platform ios
eas submit --platform android

# OTA for urgent JS fixes
eas update --branch production --message "Fix: description"
```

---

## APPENDICES

### Appendix A — Useful Commands

```bash
npx expo start              # Local development
eas build --platform ios --profile production    # iOS build
eas build --platform android --profile preview   # Android APK build
eas build --platform android --profile production # Android AAB build
eas submit --platform ios   # iOS submission
eas submit --platform android   # Android submission
npx jest                    # Tests
npx depcheck                # Check dependencies
```

### Appendix B — Environment Variables

| Variable | Description | Location |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | OnSpace Cloud backend URL | `.env` (auto-generated) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `.env` (auto-generated) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (Edge Functions) | OnSpace Cloud Secrets |
| `SUPABASE_DB_URL` | Direct PostgreSQL URL | OnSpace Cloud Secrets |

### Appendix C — Placeholders to Fill Before Publication

| File | Placeholder | Description |
|---|---|---|
| `app.json` | `YOUR_GOOGLE_MAPS_API_KEY` | Google Maps API key (Android) |
| `app.json` | AdMob IDs (`ca-app-pub-3940256099942544~*`) | Replace with production IDs |
| `eas.json` | `YOUR_APPLE_ID_EMAIL` | Apple Developer account email |
| `eas.json` | `YOUR_ASC_APP_ID` | App Store Connect → App → Apple ID (numeric) |
| `eas.json` | `YOUR_TEAM_ID` | Apple Developer → Membership → Team ID |
| `eas.json` | `./google-service-account.json` | Google Play service account JSON key |
| `sentryService.native.ts` | Sentry DSN | Sentry.io → Project Settings → DSN |
| `.well-known/apple-app-site-association` | `TEAMID` | Apple Team ID |
| `.well-known/assetlinks.json` | SHA256 fingerprint | Android keystore fingerprint |

### Appendix D — Test Accounts

Create an account via the login screen with any valid email. The OTP system will send a 4-digit code. Minimum password: 6 characters.

---

*Document updated on March 27, 2026 — Ultimate Petanque v1.2.1*
