# ULTIMATE PETANQUE — Technical Handover Document

**Version:** 1.0.0  
**Date:** March 23, 2026  
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

### 1.2 Main Objective

Provide a comprehensive tool for pétanque players to record their games, track detailed statistics (shooting, pointing, carreaux, errors), organize tournaments, manage clubs/terrains, and participate in a connected community with ambassadors, leaderboards, and challenges.

### 1.3 Target Users

- Amateur to expert pétanque players (all age groups)
- Pétanque clubs and associations
- Ambassadors/influencers in the pétanque world
- Brands and sponsors (Obut, MS Pétanque, La Boule Bleue, etc.)

### 1.4 Value Proposition

- **Real-time score tracking** with detailed notation (shot type, quality, result)
- **Advanced statistics**: performance, progression, error analysis, cross-referenced stats by terrain/boules/opponent
- **Interactive map** with geolocation of terrains, clubs, players, and tournaments
- **Cross-player sharing**: matches and challenges shared between accounts with permissions and collaborative editing
- **Ambassador program** with visibility analytics and sponsored challenges
- **Community leaderboards**: players, clubs, boules brands
- **Meetup system** between players via share codes

### 1.5 How It Works

The user registers via email OTP + password, their player profile is created automatically, then they can immediately: record matches (with end-by-end scoring), launch challenges (10 shots, lob shots, precision), create/manage tournaments with phases and brackets, find terrains and clubs on the map, and join the community via leaderboards and ambassadors.

---

## 2. DETAILED FEATURES

### 2.1 Completed Features

| # | Feature | Description | Complexity |
|---|---|---|---|
| 1 | **OTP + Password Authentication** | Registration/login via email OTP (4 digits) + password, persistent session | Medium |
| 2 | **Match Recording** | Creation with format (Singles/Doubles/Triples), mode (Training/Tournament), end-by-end scoring, detailed player actions | High |
| 3 | **Advanced Shot Notation** | Types (au fer, au plomb, en rafle, court ramassé, carreau), failure results (short right/left, long, hit jack), impact quality (gain point, decisive, no effect, negative) | High |
| 4 | **Advanced Point Notation** | Types (rolled, lobbed, half-carry, carry), quality (excellent, good, average, at jack, in front of ball, missed, hooked, out) | High |
| 5 | **Challenges** | 3 types: 10 Shots, 10 Lob Shots, Precision (5 workshops). Solo and 1v1 modes | High |
| 6 | **Complete Statistics** | 4 categories (Performance, Shooting, Pointing, Errors) with time filters (day→all), item filters (match, tournament, opponent, partner, terrain, boules), progression charts | Very High |
| 7 | **Cross-referenced Statistics** | Type×Impact tables (shooting), Type×Quality (pointing), stats by terrain type, stats by boules set with graphical comparison | High |
| 8 | **Error Analysis** | Error rate by duration/format/context, detailed error types with coaching tips, consecutive error streaks | High |
| 9 | **Tournament Management** | Creation with phases (pools, elimination, final), brackets, results, hall of fame, reminder notifications | High |
| 10 | **Directory** | 5 tabs (Players, Clubs, Terrains, Tournaments, Ambassador Challenges) with advanced filters, search, duplicate detection, merge with history and undo | Very High |
| 11 | **Interactive Map** | Geolocation of terrains/clubs/players/tournaments, dynamic clustering, public/private items, batch geolocation mode, legend | High |
| 12 | **Cross-player Sharing** | Auto-detection of linked players, share requests (read/write), accept/decline, 30s polling, local push notifications | Very High |
| 13 | **Collaborative Editing** | Conflict detection via timestamps, field-by-field visual diff, resolution (keep mine / keep server version / cancel) | High |
| 14 | **Modification History** | Field-by-field logs with colored diff (red→green), per-field and bulk undo, automatic log cleanup | High |
| 15 | **Ambassador Program** | Ambassador profiles with bio/social media, rotating banner on home, analytics (impressions, clicks, CTR, 7d/30d sparklines) | High |
| 16 | **Sponsored Challenges** | Event creation by ambassadors, participant registration, witness attestation, leaderboard | High |
| 17 | **Server Push Notifications** | Edge Function `send-push` via Expo Push API with 5 trigger types (ambassador events with 200km proximity, meetup invitations, ranking changes, share requests, reminders), `push_tokens` table, auto-registration, per-type preferences | High |
| 17b | **Local Notifications** | Local push (tournament reminders, share requests, attestations), dedicated Android channels, tap navigation | Medium |
| 18 | **Meetup System** | Meetup creation, invitations by code, responses, confirmed participant counter | Medium |
| 19 | **Community Leaderboards** | Player ranking (min 5 matches), club ranking, boules brand ranking, "in front of ball" rate | Medium |
| 20 | **Equipment (Boules)** | CRUD boules sets with photo, brand, diameter, weight, hardness, price, primary set synced to profile | Medium |
| 21 | **User Profile** | Accordion sections (Account, Notifications, Data, Community, Legal), avatar, federation card | Medium |
| 22 | **Share Management** | Share status section in match/challenge modals, revocation, modification log history | Medium |
| 23 | **In-App Purchases** | Ad removal (€5.99), promo codes with server-side validation, receipts stored in DB | Medium |
| 24 | **Anti-Fraud** | Device fingerprinting, disposable email blocking, multi-account detection, trust scores | Medium |
| 25 | **Offline & Sync** | Local AsyncStorage cache, offline queue with replay, delta sync with soft deletes, conflict resolution, battery saver mode | High |
| 26 | **i18n FR/EN** | 700+ translation keys, system language detection, user preference persistence | Medium |
| 27 | **AdMob Ads** | Inline banners and interstitials, removal via premium purchase | Low |
| 28 | **Deep Linking** | `ultimatepetanque://` scheme, Android intent filters, iOS associated domains, navigation from notifications | Medium |
| 29 | **Sharing System** | Unique share codes, public links, shared items with permissions, share notifications | Medium |
| 30 | **Data Export** | CSV/PDF export with 3-step wizard, 7 presets (standard, by match, challenge, player, tournament, season, comparative), **CSV column selector**, data preview, SVG charts in PDF | Medium |
| 31 | **Ranking Change Detection** | Leaderboard rank snapshot before match save, comparison after, server push notification to players whose rank changed | Medium |
| 32 | **Notification Preferences** | Per-type toggles in profile (events, meetups, ranking, shares, reminders), JSONB in `user_preferences`, respected server-side | Medium |
| 33 | **Sentry Monitoring** | `sentryService.ts` integrated at app launch, exception/message capture, navigation breadcrumbs, anonymized user context (IP stripped) | Medium |
| 34 | **Rate Limiting Edge Functions** | Anti-abuse protection on `validate-promo-code` (5 req/min) and `record-purchase` (3 req/min) with 429 responses, duplicate transaction detection | Medium |
| 35 | **Notification Preferences Page** | Dedicated page extracted from profile with detailed descriptions, active count badge, per-type push notification toggles | Low |
| 36 | **i18n Extraction (Legal Pages)** | 30+ hardcoded strings extracted from faq.tsx, terms.tsx and privacy-policy.tsx into i18nExtra.ts (pushNotifs section), new FAQ categories (Ambassadors, Cross-player sharing) | Low |
| 37 | **Advanced CSV Export** | Column selector in CSV export wizard, select all/default toggle, selected column counter, default vs optional columns | Low |

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
| **Framework** | React Native + Expo SDK (New Architecture) |
| **Language** | TypeScript |
| **Navigation** | Expo Router (file-based routing) |
| **Backend** | OnSpace Cloud (Supabase-compatible) |
| **Database** | PostgreSQL (via OnSpace Cloud) |
| **Auth** | Supabase Auth (email OTP + password) |
| **Storage** | Supabase Storage (5 buckets: avatars, boules-photos, club-cards, federation-cards, terrain-photos) |
| **Edge Functions** | Deno (6 functions: delete-account, detect-suspicious, record-purchase, send-push, validate-promo-code, validate-receipt) |
| **State Management** | React Context API (AppContext) |
| **Cache** | AsyncStorage |
| **Images** | expo-image |
| **Maps** | react-native-maps (mobile), react-leaflet (web) |
| **Notifications** | expo-notifications |
| **Ads** | react-native-google-mobile-ads |
| **Animations** | react-native-reanimated |
| **Charts** | react-native-svg (custom) |

### 3.2 Data Structure (24 tables)

```
user_profiles          → User profile (id FK→auth.users, is_premium, is_admin)
players                → Players (user_id FK→user_profiles, stats JSONB, is_public)
clubs                  → Clubs (user_id, terrain_id, is_public)
terrains               → Terrains (user_id, club_id, location JSONB, public_access)
tournaments            → Tournaments (user_id, phases/teams JSONB, is_public)
matches                → Matches (user_id, team_a/team_b JSONB, menes JSONB, player_actions JSONB, participant_user_ids uuid[])
challenges             → Challenges (user_id, shots JSONB, precision_shots JSONB, detailed_shots JSONB, participant_user_ids uuid[])
boules_sets            → Boules sets (user_id, is_primary)
ambassadors            → Ambassadors (user_id, player_id, badge_type, is_featured)
ambassador_analytics   → Ambassador analytics (event_type, social_platform, source_page)
sponsored_events       → Sponsored events (ambassador_id, share_code unique)
sponsored_event_participants → Event participants
sponsored_event_witnesses    → Witnesses/attestations
match_share_requests   → Cross-player share requests (sender/recipient, permission, status)
shared_items           → Shared items (share_code unique, permission)
share_notifications    → Share notifications
modification_logs      → Modification logs (changes JSONB with field/oldValue/newValue)
soft_deletes           → Soft deletes (for delta sync)
merge_logs             → Merge history
terrain_meetups        → Terrain meetups (share_code unique)
terrain_meetup_responses → Meetup responses
user_preferences       → Preferences (favorite terrains/clubs JSONB, notification_preferences JSONB)
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
│   ├── index.tsx         ← Home (hero, quick actions, tournament/meetups, history, leaderboard, ambassadors)
│   ├── stats.tsx         ← Statistics (4 categories, filters, progression, SVG charts)
│   ├── directory.tsx     ← Directory (5 tabs, advanced filters, duplicates, merge)
│   └── map.tsx           ← Map (clusters, public items, visibility management)
├── match/new.tsx         ← Match creation
├── match/[id].tsx        ← Match editing (with conflict, read-only, modification logging)
├── challenge/new.tsx     ← Challenge creation
├── history.tsx           ← Match/challenge history (filters, received shares, detail modals)
├── player/[id|me|new|compare|edit/[id]].tsx
├── club/[id|new|edit/[id]].tsx
├── terrain/[id|new|edit/[id]].tsx
├── tournament/[id|new|edit/[id]].tsx
├── sponsored-event/[id|new|list].tsx
├── meetup/[id|new|invitations].tsx
├── ambassadors.tsx       ← Ambassador list
├── ambassador-dashboard.tsx ← Ambassador dashboard (analytics, events, profile)
├── match-invitations.tsx ← Received share requests
├── profile.tsx           ← My profile (accordions)
├── login.tsx             ← Authentication
├── onboarding.tsx        ← Welcome screens
└── ... (19 other pages)
```

### 3.4 Service Architecture (Data-Logic-UI)

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
├── matchShareService.ts        ← Cross-player sharing, polling, detection
├── collaborativeEditService.ts ← Conflict detection, diff calculation
├── modificationLogService.ts   ← Modification logs, per-field/bulk revert
├── shareService.ts             ← Code sharing, shared items
├── sentryService.ts             ← Sentry crash reporting (init, capture, breadcrumbs, user context)
├── rankingChangeService.ts     ← Ranking change detection, snapshot/comparison
├── notificationPreferencesService.ts ← Push notification preferences per type
├── pushTokenService.ts         ← Push token registration, server push triggering
├── offlineQueueService.ts      ← Offline queue, replay, conflicts
├── cacheService.ts             ← AsyncStorage cache
├── syncConfigService.ts        ← Sync configuration, battery mode
├── ambassadorService.ts        ← Ambassador CRUD
├── ambassadorAnalyticsService.ts ← Ambassador analytics
├── sponsoredEventService.ts    ← Sponsored events
├── notificationService.ts      ← Local push notifications
├── leaderboardService.ts       ← Community leaderboards
├── meetupService.ts            ← Meetups
├── publicItemsService.ts       ← Public items (map)
├── iapService.native.ts        ← In-App Purchase (native)
├── adService.native.ts         ← AdMob (native)
└── ... (15 other services)
```

### 3.5 Security (RLS)

- **90+ RLS policies** active on all 24 tables
- Patterns: `authenticated_*_own_*` (own CRUD), `admin_*` (admin), `public_select_*` (public read), `participant_*_shared_*` (shared items), `shared_select_*` (items shared via code)
- **9 DB triggers**: auto profile creation, metadata sync, soft deletes on 7 tables
- **5 DB functions**: handle_new_user, sync_user_metadata, is_meetup_creator, log_soft_delete, get_premium_user_ids
- **30+ performance indexes**

---

## 4. CURRENT PROJECT STATE

### 4.1 What Is Functional (Production-ready)

- Complete authentication (OTP + password)
- Full CRUD for all entities (7 extracted and tested services)
- Advanced statistics with all categories and filters
- Interactive map with clustering and public items
- Cross-player sharing with permissions and notifications
- Collaborative editing with conflict resolution
- Ambassador program with analytics
- Sponsored challenges with witness attestation
- Meetup system
- Offline mode with queue, replay, and delta sync
- Complete FR/EN i18n (700+ keys)
- Unit tests (7 CRUD services) and integration tests (complete cross-player sharing flow)
- AdMob ads (test IDs)
- Working deep linking
- Anti-fraud (fingerprinting, multi-account detection)

### 4.2 Partially Implemented

- **Google OAuth**: client code ready but provider not enabled server-side
- **AdMob**: works in test mode, requires production IDs
- **CSV Export**: functional with column selector, 7 presets, PDF charts

### 4.3 What Is Missing

- Real device testing (IAP, notifications, deep links)
- EAS Build configuration for production
- Google Maps API Key for the map (Android)
- App Store / Play Store assets (screenshots, descriptions)
- Production AdMob IDs

---

## 5. FINALIZATION ROADMAP

### 5.1 Configuration Steps

| # | Step | Description | OnSpace Action | External Action | Priority | Time (h) |
|---|---|---|---|---|---|---|
| 1 | **Google OAuth** | Enable Google authentication | OnSpace Cloud Dashboard → User → Auth Settings → Enable Google Provider, enter Client ID & Secret | Google Cloud Console: create project, configure OAuth consent screen, create credentials (Web + iOS + Android) | High | 4-6h |
| 2 | **AdMob Production** | Replace test IDs | Modify `app.json` (androidAppId, iosAppId) with real IDs | Google AdMob Console: create iOS + Android app, create ad units (banner + interstitial), configure mediation | High | 2-3h |
| 3 | **EAS Build** | Configure production builds | — | Install EAS CLI (`npm install -g eas-cli`), `eas build:configure`, create `eas.json` with dev/preview/production profiles | High | 3-4h |
| 4 | **iOS Certificates** | Provisioning profiles and certificates | — | Apple Developer: create App ID, Distribution Certificate, Provisioning Profile (or let EAS handle automatically) | High | 2-3h |
| 5 | **Android Keystore** | Generate signing keystore | — | EAS handles automatically or generate manually via `keytool` | High | 1h |
| 6 | **Push Notifications** | Configure push credentials | OnSpace Dashboard → Cloud → Secrets (if APNs key needed) | Apple Developer: create APNs Key (.p8), Google: Firebase Cloud Messaging (optional with Expo) | Medium | 2-3h |
| 7 | **Deep Linking prod** | Configure associated domains | — | Apple Developer: configure Associated Domains, host `apple-app-site-association`; Google: Digital Asset Links | Medium | 2-3h |
| 8 | **Google Maps API (Map)** | Configure Google Maps API key for Android interactive map | Add key in `app.json` under `android.config.googleMaps.apiKey` | Google Cloud Console: enable "Maps SDK for Android" and "Maps SDK for iOS", create API key restricted by platform, add bundle/package restrictions | High | 2-3h |
| 9 | **IAP Real Testing** | Test in-app purchases | — | App Store Connect: create In-App Purchase (€5.99), configure sandbox testers; Google Play Console: create product, license testing | High | 4-6h |
| 10 | **QR Code & Download Links** | Configure QR Code links to download and install the application | Generate QR codes pointing to App Store / Play Store, integrate in marketing materials, website, social media | Create a redirect page (smart link) that detects iOS/Android and redirects to the correct store | Medium | 1-2h |
| 11 | **Device Testing** | Test on physical iOS and Android | Download APK via OnSpace Download button, use OnSpace App QR code for iOS | — | High | 8-12h |
| 11 | **Performance** | Profile and optimize | — | React DevTools, Flipper, analyze bundle size | Low | 4-6h |
| 12 | **Monitoring** | Configure Sentry/Crashlytics | Add API key in Secrets if needed | Sentry: create project, install `@sentry/react-native` | Medium | 3-4h |

### 5.2 Summary Estimate

| Phase | Estimated Hours |
|---|---|
| Configuration (OAuth, AdMob, EAS, certificates, map) | 14-20h |
| Real device testing | 8-12h |
| Publication preparation (assets, descriptions, screenshots) | 8-12h |
| App Store + Play Store publication | 4-8h |
| Bug fixes and polish post-testing | 4-8h |
| **TOTAL** | **38-60h** |

---

## 6. STORE PUBLICATION

### 6.1 Apple App Store Publication

#### Prerequisites

- Apple Developer Account ($99/year)
- EAS CLI configured with Apple credentials
- App Store Connect: app created with Bundle ID `com.ultimatepetanque.app`

#### Detailed Steps

1. **Create the app in App Store Connect**
   - Name: "Ultimate Petanque"
   - Bundle ID: `com.ultimatepetanque.app`
   - SKU: `ultimatepetanque`
   - Primary Category: Sports
   - Secondary Category: Utilities

2. **Configure metadata**
   - Description (FR + EN, max 4000 characters)
   - Keywords (max 100 characters)
   - Support URL: `https://ultimatepetanque.app/support`
   - Privacy policy URL (mandatory)
   - Screenshots (6.7" iPhone 15 Pro Max, 6.1" iPhone 15, 12.9" iPad Pro)
   - App Preview video (optional but recommended)

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

6. **Apple Review** (timeline: 1-3 business days)
   - Key considerations:
     - App must work without connection (✅ offline mode implemented)
     - IAP must use Apple's system (✅ `expo-in-app-purchases`)
     - ATT tracking must be implemented (✅ `expo-tracking-transparency`)
     - Links to external payment systems are forbidden

#### Estimate: 4-6h (excluding review time)

### 6.2 Google Play Store Publication

#### Prerequisites

- Google Play Developer Account ($25 one-time)
- EAS CLI configured
- Google Play Console: app created

#### Detailed Steps

1. **Create the app in Google Play Console**
   - Name: "Ultimate Petanque"
   - Package: `com.ultimatepetanque.app`
   - Category: Sports
   - Content type: Everyone

2. **Store Listing**
   - Short title (30 characters) + Full description (4000 characters)
   - Icon (512×512 PNG)
   - Feature Graphic (1024×500 PNG)
   - Screenshots (min 2, phone + tablet recommended)
   - Privacy policy URL

3. **Configure in-app products**
   - Google Play Console → Monetize → Products → In-app products
   - Product: `remove_ads` — €5.99

4. **Data Safety**
   - Complete the data safety declaration
   - Data types: email, approximate location, usage data

5. **Build and submission**
   ```bash
   eas build --platform android --profile production
   eas submit --platform android
   ```

6. **Google Review** (timeline: hours to 7 days)
   - Key considerations:
     - Target API level must be recent (≥34)
     - Sensitive permissions (location, camera) must be justified
     - Edge-to-edge adaptations for Android 15+ (✅ `edgeToEdgeEnabled: true`)

#### Estimate: 3-5h (excluding review time)

---

## 7. GLOBAL ESTIMATE

### 7.1 Breakdown by Task Type

| Category | Hours |
|---|---|
| Infrastructure configuration (OAuth, AdMob, EAS, certificates, push, map) | 14-20h |
| Complete device testing | 8-12h |
| Store assets preparation (screenshots, descriptions, video) | 8-12h |
| Publication and submission (iOS + Android) | 4-8h |
| Bug fixes and polish post-testing | 4-8h |
| **ESTIMATED TOTAL** | **38-60h** |

### 7.2 Suggested Timeline

| Week | Activity |
|---|---|
| W1 | Configure EAS, certificates, Google OAuth, AdMob production, Google Maps API |
| W2 | IAP sandbox testing, device testing (iOS + Android) |
| W3 | Bug fixes, store assets preparation, screenshots |
| W4 | iOS + Android submission, post-launch monitoring |

### 7.3 Overall Difficulty Level

**Medium** — The application is functionally very complete (30+ major features). The code is well-structured (extracted services, tests in place, complete i18n). The remaining work is primarily **infrastructure configuration** and **production polish**. No major feature development is required.

---

## 8. TECHNICAL RECOMMENDATIONS

### 8.1 Priority Improvements

1. **Production Monitoring**: Sentry is integrated via `services/sentryService.ts` with initialization at launch, exception capture, breadcrumbs, and user context. **Remaining action**: configure the Sentry DSN in `sentryService.ts` and install `@sentry/react-native` (`npx expo install @sentry/react-native`).

2. **Rate Limiting**: Edge Functions `validate-promo-code` (5 req/60s) and `record-purchase` (3 req/60s) now have in-memory rate limiters with 429 responses and `Retry-After` headers. `record-purchase` also detects duplicate transactions (409 Conflict). For persistent cross-invocation rate limiting, consider a `rate_limits` DB table.

3. **Data Validation**: Add server-side validation (Edge Functions) for critical data (scores, statistics). Currently, validation is primarily client-side.

4. **Automated E2E Tests**: Complete the test suite with Detox or Maestro for E2E tests on simulators.

### 8.2 Best Practices Already in Place

- Data-Logic-UI architecture well respected (services → hooks → components)
- RLS enabled on all tables with separate policies per operation/role
- Delta sync with soft deletes for efficient synchronization
- Local cache with offline fallback
- Complete i18n with 700+ FR/EN keys
- Unit and integration tests for critical services

### 8.3 Risks to Anticipate

| Risk | Impact | Mitigation |
|---|---|---|
| **App Store rejection** for external payment | Blocking | Ensure all purchases go through Apple IAP; no links to web payments |
| **Performance on low-end devices** | Medium | Stats component uses many `useMemo` — test on entry-level Android; map clustering is already optimized (MAX_VISIBLE_MARKERS = 200) |
| **Bundle size** | Medium | `mockData.ts` file contains large demo data (50 matches, 20 players) — ensure they are only loaded as fallback (this is the case) |
| **Apple review delay** | Planning | Allow 1-7 business days; submit early in the week; prepare answers to potential review team questions |
| **Google OAuth rejected** | Functional | The system already works without OAuth (OTP + password). OAuth is a "nice to have" for V1 |
| **Low AdMob revenue at launch** | Business | The premium system (€5.99) is independent of ad revenue. Diversify revenue via ambassadors/sponsors |

### 8.4 Specific Points of Attention

- The **AdMob IDs in `app.json`** are currently Google test IDs. **Do not publish with these IDs** — they will generate no revenue.
- The **deep linking scheme** (`ultimatepetanque://`) works but **iOS Universal Links** require a server hosting `apple-app-site-association`.
- The **push notification system** combines local notifications (tournament reminders) and server-side notifications via the `send-push` Edge Function (5 types: ambassador events with 200km proximity, meetup invitations, ranking changes, shares, reminders). User per-type preferences are respected server-side via `user_preferences.notification_preferences`.
- The **privacy policy** and **terms of service** have been updated with sections on push notifications, Sentry monitoring, and rate limiting protection.
- The **FAQ** now includes 4 new categories: "Push Notifications" (4 questions), "Security & Privacy" (2 questions), "Ambassadors & Partners" (3 questions), "Cross-Player Sharing" (3 questions).
- The **CSV export** offers a column selector allowing users to choose which fields to export (default vs optional columns like Ends, Terrain, Points, Duration).
- The **Notification Preferences** page is a dedicated page extracted from the profile with detailed descriptions and an active count badge.
- The **6 existing Edge Functions** are deployed with rate limiting on sensitive functions (validate-promo-code: 5 req/min, record-purchase: 3 req/min with duplicate transaction detection). The `validate-receipt` file is not referenced in the project — verify it is functional or remove it.
- The **interactive map** uses `react-native-maps` which requires a **Google Maps API Key** for Android. Without it, the map will not render on Android devices. iOS uses Apple Maps by default and works without additional configuration.

---

## 9. POST-PUBLICATION FOLLOW-UP AND V2 ROADMAP

### 9.1 Immediate Post-Publication Actions (Week 1-2)

| # | Action | Description | Priority |
|---|---|---|---|
| 1 | **Crash Monitoring** | Check Sentry/Crashlytics daily, fix critical crashes within 24h | Critical |
| 2 | **User Feedback** | Monitor App Store/Play Store reviews, respond within 48h, identify recurring patterns | High |
| 3 | **Launch Metrics** | Track: downloads, D1/D7/D30 retention, crash rate, average session time | High |
| 4 | **API Performance** | Verify Supabase response times, identify slow queries via logs | High |
| 5 | **Hotfix Process** | Prepare an EAS `hotfix` profile to deploy urgent fixes quickly | Medium |

### 9.2 Medium-Term Post-Publication Actions (Month 1-3)

| # | Action | Description | Priority |
|---|---|---|---|
| 1 | **ASO (App Store Optimization)** | Optimize title, keywords, screenshots based on real search data | High |
| 2 | **Retention Analysis** | Identify drop-off points (onboarding, first match, etc.) and optimize | High |
| 3 | **A/B Testing Store** | Test different icons, screenshots, descriptions to improve conversion rate | Medium |
| 4 | **DB Backup** | Set up regular export of critical data (weekly minimum) | High |
| 5 | **Extended Localization** | Analyze demand for other languages (Spanish, Italian, Portuguese — pétanque countries) | Low |

### 9.3 V2 Feature Roadmap (Suggestions)

Based on current architecture and market trends:

| # | V2 Feature | Description | Complexity | User Impact |
|---|---|---|---|---|
| 1 | **Dark Mode** | System detection + manual toggle, complete light/dark palettes in ThemeContext | Medium | High (frequent request) |
| 2 | **Event Calendar** | Monthly view in the Directory Challenges tab with color-coded event dots | Medium | Medium |
| 3 | **Advanced CSV Export** | Column selection for export, FR/EN date formatting, sharing via native Share API | Low | Medium |
| 4 | ~~**Server Push Notifications**~~ | **IMPLEMENTED**: Edge Function `send-push` with 5 triggers, ranking detection, per-type preferences | — | — |
| 5 | **Player Chat** | Built-in messaging between connected players, channels per meetup/tournament | Very High | High |
| 6 | **Video Replay** | Short recording (15s) of notable shots, Supabase Storage | High | Medium |
| 7 | **iOS/Android Widget** | Widget displaying upcoming matches/meetups and current ranking | Medium | Medium |
| 8 | **Subscription System** | Monthly/yearly premium plan (instead of one-time) with exclusive features | Medium | Business |
| 9 | **Artificial Intelligence** | Predictive performance analysis, personalized training suggestions via OnSpace AI | High | High |
| 10 | **Sponsor Marketplace** | Space for boules brands with special offers, promo codes, and conversion tracking | High | Business |

### 9.4 Update Process (V1.x → V2)

#### Release Workflow

1. **Branch**: Create a `release/vX.Y.Z` branch from `main`
2. **Version**: Update `app.json` (`version` and `buildNumber`/`versionCode`)
3. **Test**: Preview build (`eas build --profile preview`), test on real devices
4. **Build**: Production build (`eas build --profile production`)
5. **Submit**: `eas submit --platform ios` and `eas submit --platform android`
6. **Document**: Write release notes (changelog) for each store

#### Recommended Versioning

| Type | Format | Example | When |
|---|---|---|---|
| Patch | `1.0.X` | 1.0.1 → 1.0.2 | Bug fixes, minor corrections |
| Minor | `1.X.0` | 1.1.0 → 1.2.0 | New features, UX improvements |
| Major | `X.0.0` | 1.x → 2.0.0 | Major redesign, breaking changes |

#### Over-The-Air Updates (OTA)

For urgent fixes that don't modify native code:
```bash
# JS update without going through stores
eas update --branch production --message "Fix: stats calculation correction"
```
⚠️ OTA updates cannot modify `app.json`, native plugins, or binary assets.

#### Checklist Before Each Release

- [ ] Unit tests pass (`npx jest`)
- [ ] Manual testing on iOS (simulator + real device)
- [ ] Manual testing on Android (emulator + real device)
- [ ] Verify bundle size (< 50MB recommended)
- [ ] Update store screenshots if UI has changed
- [ ] Write release notes in FR and EN
- [ ] Increment `buildNumber` (iOS) and `versionCode` (Android)
- [ ] Verify AdMob IDs are production ones
- [ ] Verify Edge Functions are up to date
- [ ] Test complete flow: registration → match → stats → sharing

### 9.5 KPIs to Monitor

| KPI | V1 Target (3 months) | Measurement Tool |
|---|---|---|
| Downloads | 1000+ | App Store Connect / Google Play Console |
| D7 Retention | > 30% | Built-in analytics |
| D30 Retention | > 15% | Built-in analytics |
| Crash Rate | < 1% | Sentry |
| Average Store Rating | > 4.0/5 | App Store / Play Store |
| Matches Created/Day | 50+ | SQL query on `matches` table |
| Premium Conversion Rate | > 3% | Supabase `user_profiles.is_premium` |
| Active Ambassadors | 5+ | `ambassadors` table |

---

## APPENDIX A — USEFUL COMMANDS

```bash
# Local development
npx expo start

# iOS production build
eas build --platform ios --profile production

# Android APK build
eas build --platform android --profile preview

# Store submission
eas submit --platform ios
eas submit --platform android

# Run tests
npx jest

# Check dependencies
npx depcheck
```

## APPENDIX B — ENVIRONMENT VARIABLES

| Variable | Description | Location |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | OnSpace Cloud backend URL | `.env` (auto-generated) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `.env` (auto-generated) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (Edge Functions) | OnSpace Cloud Secrets |
| `SUPABASE_DB_URL` | Direct PostgreSQL URL (Edge Functions) | OnSpace Cloud Secrets |

## APPENDIX C — TEST ACCOUNTS

To test the application in development, create an account via the login screen with any valid email. The OTP system will send a 4-digit code. Minimum password: 6 characters.

---

*Document generated on March 23, 2026 — Ultimate Petanque v1.0.0*
