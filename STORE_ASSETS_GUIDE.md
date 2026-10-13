# Ultimate Petanque — App Store & Play Store Assets Guide

---

## 1. APP ICON

### Specifications
- **Size**: 1024×1024 PNG (no transparency for iOS)
- **Design**: App logo with pétanque ball motif on solid background
- **Existing asset**: `assets/images/app-logo.png` (to be exported at 1024×1024)

---

## 2. SCREENSHOTS

### 2.1 Required Sizes

#### Apple App Store
| Device | Resolution | Required |
|---|---|---|
| iPhone 15 Pro Max (6.7") | 1290×2796 | **Yes** (mandatory) |
| iPhone 15 (6.1") | 1179×2556 | Recommended |
| iPad Pro 12.9" | 2048×2732 | Recommended |

#### Google Play Store
| Device | Resolution | Required |
|---|---|---|
| Phone | 1080×1920 (min) | **Yes** (min 2, max 8) |
| Tablet 7" | 1200×1920 | Recommended |
| Tablet 10" | 1600×2560 | Recommended |

### 2.2 Screenshot Plan (10 screens per platform)

Each screenshot should have a short marketing tagline at the top and show the actual app UI below.

| # | Screen | FR Tagline | EN Tagline | Page to capture |
|---|---|---|---|---|
| 1 | **Accueil** | Votre tableau de bord pétanque | Your pétanque dashboard | `(tabs)/index.tsx` — Hero section with stats chips, quick actions, geo ranking widget, upcoming timeline |
| 2 | **Match mène par mène** | Notation détaillée mène par mène | Detailed end-by-end scoring | `match/new.tsx` — Match creation with advanced shot notation (fer, plomb, rafle, carreau) |
| 3 | **Statistiques avancées** | Analysez chaque aspect de votre jeu | Analyze every aspect of your game | `(tabs)/stats.tsx` — Stats page with 4 categories, cross-filters, progression chart up to 25 years |
| 4 | **Classement ELO** | Votre vrai niveau, par rôle | Your true level, by role | `global-ranking.tsx` or `leaderboard-geo.tsx` — ELO ranks (Bronze → Grand Master), role-specific ratings |
| 5 | **Défis d'entraînement** | 5 défis pour progresser | 5 training challenges | `challenge/new.tsx` — 10 Tirs / Précision 5 ateliers / mode 1v1 with radar comparison |
| 6 | **Carte interactive** | Terrains actifs près de vous | Active courts near you | `(tabs)/map.tsx` — Map with LIVE/habitual terrain markers, clustering, partner markers |
| 7 | **Rendez-vous terrain** | Jouez avec vos amis, en direct | Play with your friends, live | `meetup/[id].tsx` — Meetup with chat, participant list, QR share |
| 8 | **Annuaire & recherche** | Joueurs, clubs, terrains, tournois | Players, clubs, courts, tournaments | `(tabs)/directory.tsx` — 5-tab directory with cascading filters and multi-criteria sort |
| 9 | **Score de confiance** | Système anti-triche à 26 facteurs | 26-factor anti-cheat system | `trust-score.tsx` — Trust score breakdown, witness attestations, verified badge |
| 10 | **Partage de match** | Partagez vos parties entre joueurs | Share your matches between players | Match detail → `ShareRequestModal` — Auto-detect linked players, public link, QR code, permissions |

### 2.3 Optional Additional Screens (for A/B testing)

| # | Screen | Content |
|---|---|---|
| 11 | **Palmarès & tournois** | `palmares.tsx` — Full tournament history with filters |
| 12 | **Badges & XP** | `badges.tsx` — 13 badges, XP bar, league tier |
| 13 | **Équipement** | `equipment.tsx` — Multi-boules sets, brand leaderboard |
| 14 | **Portail ambassadeur** | `ambassador-dashboard.tsx` — Analytics and promotion program |

### 2.4 Screenshot Capture Instructions

1. **Use Xcode Simulator** (iPhone 15 Pro Max) and **Android Studio Emulator** (Pixel 7 Pro)
2. **Populate with demo data** — The app's seed data covers all features
3. **Language** — Capture in French first, then switch to English via profile settings
4. **Status bar** — Use clean status bar (full signal, full battery, specific time like 9:41 for iOS)
5. **Add marketing frames** — Use tools like Hotpot.ai, AppMockUp, or Screenshots Pro to add device frames and taglines
6. **Highlight new elements** — For screens 4, 7, 9: add callout arrows pointing to key features (ELO rank badge, chat bubble, trust score)

---

## 3. FEATURE GRAPHIC (Google Play only)

### Specifications
- **Size**: 1024×500 PNG or JPEG
- **Content**: App name "Ultimate Petanque" + tagline + visual elements (pétanque balls, terrain, ELO rank, stats icons)
- **Style**: Match the app's design system (#0F172A dark background, #2563EB primary blue accents, glassmorphic elements)

### Suggested Design
```
Background: Dark gradient (#0F172A → #1E3A5F)
Left side: App icon + "Ultimate Petanque" title in white
Right side: 3 overlapping phone mockups showing Home, ELO Ranking, and Map screens
Bottom: Tagline "L'app complète pour les joueurs de pétanque"
Visual accents: ELO rank badges (Gold, Diamond), LIVE court pulse ring, trust score shield
```

---

## 4. APP STORE DESCRIPTIONS

### 4.1 App Store (iOS) — French

**Titre**: Ultimate Petanque  
**Sous-titre** (30 car.): ELO, Stats & Rendez-vous  
**Mots-clés** (100 car.): petanque,boules,score,elo,classement,match,tournoi,terrain,club,defi,stats,carte,rdv,badge  

**Description** (4000 car. max):

```
Ultimate Petanque est l'application la plus complète pour les joueurs de pétanque. Suivez chaque partie mène par mène, mesurez votre niveau avec un classement ELO mondial, organisez des rendez-vous sur les terrains près de chez vous et progressez grâce à 5 défis d'entraînement et des statistiques avancées.

CLASSEMENT ELO MONDIAL
• Rating ELO par rôle (Tireur, Pointeur, Milieu)
• 6 rangs : Bronze, Argent, Or, Diamant, Maître, Grand Maître
• 10 matchs de placement pour calibrer votre niveau
• Reset saisonnier annuel (compression vers 1000)
• Classement par ville, pays, continent et monde
• Promotion/relégation de ligue avec notifications

ENREGISTREMENT DE MATCHS
• Notation mène par mène en Tête-à-tête, Doublette, Triplette
• Notation avancée : type de tir (fer, plomb, rafle, carreau), qualité de point
• Mode Best of 3 pour les séries
• Lien avec terrain, boules, partenaire et adversaire pour statistiques croisées

5 DÉFIS D'ENTRAÎNEMENT
• 10 Tirs : taux de réussite classique
• 10 Tirs Sautés : lobe par-dessus un obstacle
• Précision 5 ateliers : boule seule, derrière le but, entre 2 boules, sautée, tir au but
• Mode 1 contre 1 avec comparaison radar
• Mode Solo pour l'entraînement à domicile

RENDEZ-VOUS TERRAIN
• Créez un RDV avec date, heure, participants
• Invitez par code, QR code ou depuis l'annuaire
• Rappels automatiques : veille, 3h et 1h avant
• Chat de groupe avec réactions et accusés de lecture
• Confirmations temps réel avant de vous déplacer

SCORE DE CONFIANCE (26 FACTEURS)
• Analyse comportementale, géographique, temporelle et statistique
• Attestation par témoin (poids x2 dans le classement)
• Détection de voyage impossible, téléportation GPS, multi-comptes
• Alertes d'usurpation d'identité
• Niveaux affichés : Vérifié, Fiable, Neutre, À surveiller
• Insigne vérifié pour les joueurs les plus fiables

STATISTIQUES AVANCÉES
• 4 catégories : Performance, Tir, Point, Erreurs
• Filtres croisés : terrain, boules, adversaire, partenaire, tournoi
• Progression de 4 semaines à 25 ans (9 périodes)
• Analyse par rôle, comparaison radar entre joueurs
• Bilan hebdomadaire avec activité quotidienne

CARTE INTERACTIVE MONDIALE
• Terrains publics avec sol, éclairage, abri, parking, toilettes
• Clubs géolocalisés avec marqueurs partenaires
• Mode "actifs maintenant" : LIVE (rouge) ou habituel (vert)
• Clustering intelligent, alerte de proximité
• Défis sponsorisés en cours

ANNUAIRE AVANCÉ
• 5 onglets : Joueurs, Clubs, Terrains, Tournois, Défis
• Filtres cascading et tri multi-critères
• Filtre distance (5 à 100 km) avec géolocalisation
• Détection de doublons avec fusion annulable

CLUBS & TOURNOIS
• Rejoignez un club public ou privé
• Tournois avec phases automatiques (poules → finale)
• Team Builder : trouvez vos coéquipiers
• Chat d'équipe et bracket interactif
• Palmarès automatique, bilan financier (frais vs gains)

COMMUNAUTÉ
• Programme ambassadeur 3 niveaux (Découverte, Confirmé, Élite)
• Programme partenaire 3 tiers (Bronze, Argent, Or)
• Défis sponsorisés avec témoins officiels
• 18+ types de cartes partageables (match, saison, podium, head-to-head)
• Partage auto-détecté des partenaires liés à un compte

ÉQUIPEMENT
• Multi-jeux de boules (marque, diamètre, poids, dureté, photo)
• 9 marques répertoriées : Obut, MS Pétanque, La Boule Bleue, KTK, La Franc, Boulenciel, Marathon, Oddeka, Geologic
• Classement mondial par marque
• Statistiques par équipement

PROGRESSION & MOTIVATION
• 13 badges à débloquer avec barres de progression
• XP et niveaux : Débutant → Expert
• Série quotidienne avec alerte de rupture
• Animations de déblocage et montée de ligue

PLUS DE FONCTIONNALITÉS
• 30+ types de notifications push personnalisables
• Mode hors-ligne complet avec file de synchronisation
• Export CSV / PDF et sauvegarde JSON complète
• Transfert de compte entre appareils par code
• Français et Anglais (700+ traductions)
• RGPD conforme : suppression définitive avec OTP

Rejoignez la communauté Ultimate Petanque et faites passer votre jeu au niveau supérieur !
```

**Texte promotionnel** (170 car.):
```
L'app complète pour la pétanque : ELO par rôle, stats avancées, carte des terrains actifs, rendez-vous entre joueurs, 5 défis et anti-triche. Gratuit !
```

### 4.2 App Store (iOS) — English

**Title**: Ultimate Petanque  
**Subtitle** (30 char.): ELO, Stats & Meetups  
**Keywords** (100 char.): petanque,boules,score,elo,ranking,match,tournament,court,club,challenge,stats,map,meetup,badge  

**Description** (4000 char. max):

```
Ultimate Petanque is the most complete app for pétanque players. Record every match end by end, measure your level with a worldwide ELO ranking, organize meetups on nearby courts, and improve through 5 training challenges and advanced statistics.

WORLDWIDE ELO RANKING
• ELO rating by role (Shooter, Pointer, Middle)
• 6 ranks: Bronze, Silver, Gold, Diamond, Master, Grand Master
• 10 placement matches to calibrate your level
• Annual seasonal reset (compression toward 1000)
• Ranking by city, country, continent and world
• League promotion/relegation with notifications

MATCH RECORDING
• End-by-end scoring in Singles, Doubles and Triples
• Advanced notation: shot type (flat, lob, running, carreau), point quality
• Best of 3 mode for training series
• Link to court, boules, partner and opponent for cross-stats

5 TRAINING CHALLENGES
• 10 Shots: classic success rate
• 10 Lob Shots: shoot over an obstacle
• Precision 5 workshops: single ball, behind jack, between 2 balls, lob, jack shot
• 1v1 mode with radar comparison
• Solo mode for training at home

COURT MEETUPS
• Create meetups with date, time, participants
• Invite via code, QR code or from the directory
• Automatic reminders: day before, 3h and 1h before
• Group chat with reactions and read receipts
• Real-time confirmations before heading out

TRUST SCORE (26 FACTORS)
• Behavioral, geographic, temporal and statistical analysis
• Witness attestation (x2 weight in rankings)
• Impossible travel, GPS teleportation, multi-account detection
• Impersonation alerts
• Trust levels: Verified, Trusted, Neutral, To Watch
• Verified badge for the most trustworthy players

ADVANCED STATISTICS
• 4 categories: Performance, Shooting, Pointing, Errors
• Cross-filters: court, boules, opponent, partner, tournament
• Progression from 4 weeks to 25 years (9 periods)
• Per-role analysis, radar comparison between players
• Weekly summary with daily activity

WORLDWIDE INTERACTIVE MAP
• Public courts with surface, lighting, cover, parking, restrooms
• Geolocated clubs with partner markers
• "Active now" mode: LIVE (red) or habitual (green)
• Smart clustering, proximity alerts
• Ongoing sponsored challenges

ADVANCED DIRECTORY
• 5 tabs: Players, Clubs, Courts, Tournaments, Challenges
• Cascading filters and multi-criteria sort
• Distance filter (5 to 100 km) with geolocation
• Duplicate detection with undo-able merge

CLUBS & TOURNAMENTS
• Join a public or private club
• Tournaments with automatic phases (pools → final)
• Team Builder: find your teammates
• Team chat and interactive bracket
• Automatic hall of fame, financial summary (fees vs winnings)

COMMUNITY
• 3-level ambassador program (Discovery, Confirmed, Elite)
• 3-tier partner program (Bronze, Silver, Gold)
• Sponsored challenges with official witnesses
• 18+ shareable card types (match, season, podium, head-to-head)
• Auto-detected sharing with linked partner accounts

EQUIPMENT
• Multi-boules sets (brand, diameter, weight, hardness, photo)
• 9 brands cataloged: Obut, MS Pétanque, La Boule Bleue, KTK, La Franc, Boulenciel, Marathon, Oddeka, Geologic
• Worldwide ranking by brand
• Per-equipment statistics

PROGRESSION & MOTIVATION
• 13 badges to unlock with progress bars
• XP and levels: Beginner → Expert
• Daily streak with break alerts
• Unlock animations and league promotion modals

MORE FEATURES
• 30+ customizable push notification types
• Full offline mode with sync queue
• CSV / PDF export and full JSON backup
• Account transfer between devices via code
• French and English (700+ translations)
• GDPR compliant: definitive deletion with OTP

Join the Ultimate Petanque community and take your game to the next level!
```

**Promotional Text** (170 char.):
```
The complete app for pétanque: role-based ELO, advanced stats, active court map, player meetups, 5 challenges and anti-cheat. Free!
```

### 4.3 Google Play Store — French

**Titre** (30 car.): Ultimate Petanque  
**Description courte** (80 car.): ELO par rôle, stats, carte des terrains actifs et rendez-vous joueurs  

**Description complète**: (Same as App Store French description above)

### 4.4 Google Play Store — English

**Title** (30 char.): Ultimate Petanque  
**Short Description** (80 char.): Role-based ELO, stats, active court map and player meetups for pétanque  

**Full Description**: (Same as App Store English description above)

---

## 5. PRIVACY POLICY & TERMS

- **Privacy Policy URL**: Must be hosted publicly (required by both stores)
- **Terms of Service URL**: Recommended
- **Content**: Already written in the app (`app/privacy-policy.tsx` and `app/terms-of-service.tsx`) — export to hosted web pages
- **Consent date**: Stored at account creation for GDPR audit trail
- **Right to be forgotten**: In-app account deletion with email OTP verification

---

## 6. APP STORE CATEGORIES

### Apple App Store
- **Primary**: Sports
- **Secondary**: Social Networking

### Google Play Store
- **Category**: Sports
- **Content Rating**: Everyone (PEGI 3 / ESRB Everyone)
- **Tags**: Sports, Social, Statistics, Community

---

## 7. IN-APP PURCHASE CONFIGURATION

### Product Details

| Field | Value |
|---|---|
| **Product ID** | `remove_ads` |
| **Type** | Non-consumable |
| **Price** | €5.99 |
| **FR Name** | Supprimer les publicités |
| **EN Name** | Remove Ads |
| **FR Description** | Supprimez définitivement toutes les bannières publicitaires de l'application. |
| **EN Description** | Permanently remove all ad banners from the application. |

**Note**: All features are free. Only ad removal is a paid option.

---

## 8. DATA SAFETY / APP PRIVACY

### Data Collected

| Data Type | Purpose | Shared | Required |
|---|---|---|---|
| Email address | Account creation, authentication, OTP delivery | No | Yes |
| Username / display name | Public profile, leaderboards | No | Yes |
| Approximate location | Map features, nearby courts, geo ranking | No | No (optional) |
| Precise location | Court check-ins, meetup location pin | No | No (optional) |
| Match & challenge data | Statistics, ELO ranking, trust score | No | Yes |
| Device fingerprint | Anti-fraud, multi-account detection | No | Yes |
| App interactions | Analytics, feature usage | No | No |
| Crash logs | Bug fixing via Sentry | No | No |
| Push token | Notifications (invitations, reminders, alerts) | No | No (optional) |
| Purchase history | In-app purchase verification | No | No |
| Photos (avatar, boules, terrain, federation card) | Profile and content display | No | No (optional) |

### Security Measures
- Data encrypted in transit (HTTPS)
- Row Level Security (RLS) on all database tables (90+ policies)
- 26-factor anti-cheat and multi-account detection
- No data sold to third parties
- Users can request account deletion (in-app with email OTP)
- Full data export available (CSV/PDF/JSON)
- Consent date stored for GDPR audit

### Compliance
- **GDPR** (EU)
- **CCPA** (California)
- **Apple App Tracking Transparency** (ATT) prompt
- **Android 13+ notification permission**

---

## 9. SCREENSHOT CHECKLIST

Use this checklist to ensure all screenshots are captured:

- [ ] **iPhone 15 Pro Max (6.7")** — 10 screenshots FR
- [ ] **iPhone 15 Pro Max (6.7")** — 10 screenshots EN
- [ ] **iPhone 15 (6.1")** — 10 screenshots FR (optional, can reuse 6.7")
- [ ] **iPad Pro 12.9"** — 10 screenshots FR (recommended)
- [ ] **Android Phone** — 10 screenshots FR
- [ ] **Android Phone** — 10 screenshots EN
- [ ] **Android Tablet** — 5 screenshots FR (recommended)
- [ ] **Feature Graphic** — 1024×500 PNG (Google Play)
- [ ] **App Icon** — 1024×1024 PNG (both stores)

---

## 10. KEY SELLING POINTS (for ASO & reviews)

Use these when responding to reviews or writing promotional copy:

1. **Only pétanque app with role-based ELO ranking** (Shooter, Pointer, Middle)
2. **26-factor anti-cheat system** with witness attestation (unique in the category)
3. **Live court activity map** with LIVE/habitual indicators
4. **Court meetups with group chat** and automatic reminders
5. **5 training challenges** including the official 5-workshop precision challenge
6. **Full tournament management** with brackets, pools, team builder and chat
7. **100% free** with full feature parity on iOS and Android
8. **GDPR-compliant** with transparent trust score and full data export
9. **9 boules brands cataloged** with worldwide performance ranking
10. **Multi-language** (French + English, 700+ translations)

---

## 11. VERSION HISTORY FOR RELEASE NOTES

### v1.3.0 — Current (recommended release notes)

**FR**:
```
Nouveautés :
- Classement ELO mondial par rôle (Tireur, Pointeur, Milieu)
- Rendez-vous terrain avec chat de groupe et rappels automatiques
- Carte "actifs maintenant" avec terrains LIVE
- Score de confiance à 26 facteurs avec attestation par témoin
- Team Builder pour composer vos équipes de tournoi
- 13 badges à débloquer et système XP
- 18+ types de cartes partageables
Améliorations :
- Annuaire avec filtres cascading et tri multi-critères
- Statistiques avec analyse par rôle
- Alerte de proximité pour les terrains favoris
- Détection de doublons avec fusion annulable
```

**EN**:
```
What's new:
- Worldwide ELO ranking by role (Shooter, Pointer, Middle)
- Court meetups with group chat and automatic reminders
- "Active now" map with LIVE court indicators
- 26-factor trust score with witness attestation
- Team Builder for tournament lineups
- 13 unlockable badges and XP system
- 18+ shareable card types
Improvements:
- Directory with cascading filters and multi-criteria sort
- Statistics with per-role analysis
- Proximity alerts for favorite courts
- Duplicate detection with undo-able merge
```

---

## 12. CONTACT INFORMATION

- **Support email**: ultimate.petanque.app@gmail.com
- **Website**: (to be published alongside privacy policy and terms)
- **Universal links**: configured in `UNIVERSAL_LINKS_SETUP.md`

---

*Guide mis à jour le 13 octobre 2026 — Ultimate Petanque v1.3.0*
