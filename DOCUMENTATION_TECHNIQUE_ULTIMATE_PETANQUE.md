# ULTIMATE PETANQUE — Document Technique de Reprise

**Version :** 1.2.6  
**Date :** 28 mars 2026  
**Destinataire :** Développeur externe en charge de la finalisation et publication  

---

## 1. PRÉSENTATION GÉNÉRALE

### 1.1 Identité de l'application

| Champ | Valeur |
|---|---|
| **Nom** | Ultimate Petanque |
| **Bundle ID** | `com.ultimatepetanque.app` |
| **Scheme** | `ultimatepetanque://` |
| **Plateformes** | iOS, Android, Web (preview) |
| **Langues** | Français (défaut), Anglais |
| **Version** | 1.2.0 |

### 1.2 Objectif principal

Fournir un outil complet aux joueurs de pétanque pour enregistrer leurs parties, suivre leurs statistiques détaillées (tir, point, carreau, erreurs), organiser des tournois, gérer leurs clubs/terrains, et participer à une communauté connectée avec ambassadeurs, classements et défis.

### 1.3 Cible utilisateur

- Joueurs de pétanque amateur à expert (toute tranche d'âge)
- Clubs et associations de pétanque
- Ambassadeurs/influenceurs du monde de la pétanque
- Marques et sponsors (Obut, MS Pétanque, La Boule Bleue, etc.)

### 1.4 Proposition de valeur

- **Suivi de scores en temps réel** avec notation détaillée (type de tir, qualité, résultat)
- **Statistiques avancées** : performance, progression, analyse d'erreurs, statistiques croisées par terrain/boules/adversaire
- **Carte interactive** avec géolocalisation des terrains, clubs, joueurs et tournois
- **Partage cross-joueurs** : matchs et défis partagés entre comptes avec permissions, édition collaborative et mise à jour automatique des statistiques
- **Programme ambassadeur** avec analytiques de visibilité et défis sponsorisés
- **Programme partenaire** avec portail dédié 6 onglets (ROI, Placement, Branding, Push, Events, CRM)
- **Classements communautaires** : joueurs, clubs, marques de boules, avec filtres géographiques
- **Système de rendez-vous** entre joueurs via codes de partage et QR codes
- **Bilan hebdomadaire** avec sparkline d'activité quotidienne bicolore (matchs/défis)
- **FAQ contextuelle** structurée par audience (Joueur, Ambassadeur, Partenaire)
- **Pages légales complètes** : politique de confidentialité et CGU mises à jour couvrant tous les programmes, avec versions statiques HTML hébergeables

### 1.5 Fonctionnement global

L'utilisateur s'inscrit via OTP email + mot de passe, crée son profil joueur automatiquement, puis peut immédiatement : enregistrer des matchs (avec scoring mène par mène), lancer des défis (10 tirs, tirs sautés, précision), créer/gérer des tournois avec phases et brackets, trouver des terrains et clubs sur la carte, et rejoindre la communauté via classements et ambassadeurs.

---

## 2. FONCTIONNALITÉS DÉTAILLÉES

### 2.1 Fonctionnalités terminées

| # | Fonctionnalité | Description | Complexité |
|---|---|---|---|
| 1 | **Authentification OTP + Mot de passe** | Inscription/connexion via email OTP (4 chiffres) + mot de passe, session persistante | Moyenne |
| 2 | **Enregistrement de matchs** | Création avec format (Tête-à-tête/Doublette/Triplette), mode (Entraînement/Tournoi), scoring mène par mène, actions joueurs détaillées, séries Best of 3 | Élevée |
| 3 | **Notation avancée des tirs** | Types (au fer, au plomb, en rafle, court ramassé, carreau), résultats d'échec (court droite/gauche, long, tir bouchon), qualité d'impact (gain point, décisif, sans effet, négatif) | Élevée |
| 4 | **Notation avancée des points** | Types (roulé, plombé, demi-portée, portée), qualité (excellent, bon, moyen, au bouchon, devant boule, raté, crocheté, sorti) | Élevée |
| 5 | **Défis (Challenges)** | 3 types : 10 Tirs, 10 Tirs Sautés, Précision (5 ateliers). Modes solo et 1v1 avec comparaison graphique | Élevée |
| 6 | **Statistiques complètes** | 4 catégories (Performance, Tir, Point, Erreurs) avec filtres temporels (jour→all), filtres par item (match, tournoi, adversaire, partenaire, terrain, boules), graphiques de progression | Très élevée |
| 7 | **Statistiques croisées** | Tableaux Type×Impact (tir), Type×Qualité (point), stats par type de terrain, stats par jeu de boules avec comparaison graphique | Élevée |
| 8 | **Analyse d'erreurs** | Taux d'erreur par durée/format/contexte, types d'erreurs détaillés avec conseils coaching, séries d'erreurs consécutives | Élevée |
| 9 | **Gestion de tournois** | Création avec phases (poules, élimination, finale), brackets, résultats, palmarès, notifications de rappel, bilan financier (frais/gains) | Élevée |
| 10 | **Annuaire (Directory)** | 5 onglets (Joueurs, Clubs, Terrains, Tournois, Défis ambassadeurs) avec filtres avancés, recherche, détection de doublons, fusion avec historique et annulation | Très élevée |
| 11 | **Carte interactive** | Géolocalisation terrains/clubs/joueurs/tournois, clustering dynamique, items publics/privés, classement par zone géographique visible, mode batch pour géolocaliser | Élevée |
| 12 | **Partage cross-joueurs** | Détection auto des joueurs liés, demandes de partage (lecture/écriture), acceptation avec mise à jour automatique des statistiques du destinataire, polling 30s, notifications push | Très élevée |
| 13 | **Édition collaborative** | Détection de conflits via timestamps, diff visuel champ par champ, résolution (garder le mien / garder la version serveur / annuler), historique des modifications traçable | Élevée |
| 14 | **Historique des modifications** | Logs champ par champ avec diff coloré (rouge→vert), annulation par champ et en bloc, nettoyage automatique des logs | Élevée |
| 15 | **Programme ambassadeur 3 niveaux** | 3 niveaux progressifs (Découverte, Confirmé, Élite) avec promotion automatique. Découverte : badge, code parrainage, 2 défis/mois. Confirmé (5+ parrainages, 500+ impressions) : bannière rotative accueil, dashboard analytics complet, défis illimités. Élite (20+ parrainages, 2000+ impressions) : bannière permanente, push illimités, section onboarding, analytics avancés avec export. Système XP parrainage (+50 XP/parrainage, +25 XP/défi, +10 XP/100 impressions) | Très élevée |
| 16 | **Défis sponsorisés** | Création d'événements par ambassadeurs, inscription participants, attestation par témoins, classement | Élevée |
| 17 | **Notifications push serveur** | Edge Function `send-push` via Expo Push API avec 5 types de déclencheurs (événements ambassadeurs avec proximité 200km, invitations meetup, changements de classement, demandes de partage, rappels), table `push_tokens`, enregistrement automatique, préférences par type | Élevée |
| 17b | **Notifications locales** | Push locales (rappels tournois, demandes de partage, attestations), canaux Android dédiés, navigation par tap | Moyenne |
| 18 | **Système de rendez-vous (Meetups)** | Création de meetups, invitations par code/QR, réponses, compteur de participants confirmés, bouton "Rejoindre RDV" proéminent | Moyenne |
| 19 | **Classements communautaires** | Classement joueurs (min 5 matchs) avec filtres géographiques (monde/continent/pays/ville), classement clubs, classement marques de boules, classement hebdomadaire avec reset lundi | Moyenne |
| 20 | **Équipement (Boules)** | CRUD jeux de boules avec photo, marque, diamètre, poids, dureté, prix, jeu principal synchronisé au profil | Moyenne |
| 21 | **Profil utilisateur** | Sections accordéon (Compte, Notifications, Données, Communauté, Mentions légales), avatar, carte fédération, XP et badges | Moyenne |
| 22 | **Gestion des partages** | Section statut de partage dans les modals match/défi, révocation, historique des logs de modification | Moyenne |
| 23 | **Achats in-app** | Suppression des publicités (€5.99), codes promo avec validation serveur, receipts stockés en DB | Moyenne |
| 24 | **Anti-fraude** | Fingerprinting appareil, blocage emails jetables, détection multi-comptes, scores de confiance (0-100) avec 10 facteurs | Moyenne |
| 25 | **Offline & Sync** | Cache local AsyncStorage, queue offline avec replay, delta sync avec soft deletes, résolution de conflits, mode économie batterie | Élevée |
| 26 | **i18n FR/EN** | 700+ clés de traduction, détection langue système, persistance du choix utilisateur | Moyenne |
| 27 | **Publicités AdMob** | Bannières inline stratégiquement positionnées (12 placements optimisés, 1 par viewport max), suppression via achat premium | Faible |
| 28 | **Deep Linking** | Scheme `ultimatepetanque://`, intent filters Android, associated domains iOS, navigation depuis notifications | Moyenne |
| 29 | **Système de partage** | Codes de partage uniques, liens publics, items partagés avec permissions, notifications de partage | Moyenne |
| 30 | **Export de données** | Export CSV/PDF avec assistant 3 étapes, 7 préréglages, sélecteur de colonnes CSV, aperçu des données, graphiques SVG en PDF | Moyenne |
| 31 | **Détection changement de classement** | Snapshot des rangs avant sauvegarde de match, comparaison après, notification push serveur aux joueurs dont le rang a changé | Moyenne |
| 32 | **Préférences de notifications** | Toggles par type dans le profil (événements, meetups, classement, partages, rappels), JSONB dans `user_preferences`, respectées côté serveur | Moyenne |
| 33 | **Monitoring Sentry** | Service `sentryService.ts` intégré au lancement de l'app, capture des exceptions/messages, breadcrumbs de navigation, contexte utilisateur anonymisé | Moyenne |
| 34 | **Rate Limiting Edge Functions** | Protection anti-abus sur `validate-promo-code` (5 req/min) et `record-purchase` (3 req/min) avec réponses 429, détection de transactions dupliquées | Moyenne |
| 35 | **Bilan hebdomadaire (WeeklyStatsCard)** | Résumé hebdomadaire sur l'accueil : taux de victoire vs semaine précédente, meilleure performance, sparkline quotidienne bicolore (matchs bleu/défis jaune), série active, lien vers stats complètes avec filtre semaine | Moyenne |
| 36 | **FAQ par audience** | 3 onglets par audience : Joueur (8 catégories, 28 questions), Ambassadeur (4 catégories, 13 questions), Partenaire (5 catégories, 15 questions). 56+ questions couvrant programmes, analytics, push, QR codes, pages landing, événements sponsorisés. Actions rapides avec étapes numérotées, liens directs vers les portails, recherche intégrée | Élevée |
| 37 | **Design system harmonisé** | En-têtes solides #0F172A uniformes sur toutes les pages, cartes glassmorphiques (bordures #E8EDF2), stat chips compacts, filtres en pastilles, couleurs dynamiques par onglet dans l'annuaire | Moyenne |
| 38 | **Programme partenaire 3 niveaux** | 3 niveaux business (Bronze, Argent, Or) avec tarification sur devis. Bronze : fiche partenaire, badge, marqueur carte. Argent : + bannière rotative, 1 push/mois, dashboard analytique, templates, export CSV/PDF. Or : + bannière permanente, push illimités avec A/B testing, heatmap, calculateur ROI, objectifs mensuels, CRM, kit de marque, digest hebdomadaire, section onboarding | Très élevée |
| 39 | **Portail partenaires (6 onglets)** | ROI (KPIs temps réel, sparklines, benchmark concurrents, objectifs mensuels avec anneaux progression, calculateur ROI avec projections annuelles, suivi budget CPM/CPC), Placement (répartition par page avec CTR), Branding (upload logo, couleur de marque, aperçu bannière et marqueur carte, export kit de marque PDF), Push (compositeur avec templates 7 catégories, A/B testing 50/50, programmation avec créneaux rapides, heatmap performance, aperçu iOS/Android réaliste, segmentation audience), Events (défis sponsorisés), CRM (parrainages avec historique, export CSV). Centre de notifications intégré, checklist onboarding avec +200 XP | Très élevée |
| 40 | **Pages landing partenaire** | Page publique par partenaire (partner/[id]) avec hero section gradient couleur de marque, avatar agrandi avec badge tier, compteurs animés (impressions, clics, CTR, portée), timeline activité récente, liens sociaux, liste événements, code parrainage avec copier, QR code personnalisé aux couleurs de marque, bouton site web | Élevée |
| 41 | **Pages programme ambassadeur/partenaire** | Pages dédiées avec niveaux collapsibles, progression interactive (cercles animés, connecteurs), badges contextuels ("POPULAIRE", "RECOMMANDÉ"), résumé critères/avantages, tableau comparatif (partenaire), témoignages, FAQ collapsible, auto-scroll à l'expansion, système XP détaillé | Élevée |
| 42 | **Digest hebdomadaire sponsor** | Récapitulatif automatique chaque lundi pour partenaires Or : impressions, clics, CTR, push envoyés, comparaison semaine précédente. Aperçu email intégré au portail avec preview branded, historique des digests, export PDF | Moyenne |
| 43 | **A/B Testing push avancé** | Test A/B avec split 50/50, variantes titre+message, résultats avec taux d'ouverture par variante, historique complet des tests, dashboard Insights A/B avec analyse de significativité statistique (confiance, taille échantillon, recommandations), visualisation win/loss/tie | Élevée |
| 44 | **Analytics sponsorisé avancé** | Heatmap performance par jour/créneau horaire avec score optimal, benchmark concurrents par tier (impressions, CTR, portée, push), calendrier push avec légende (envoyé/programmé/A/B), statistiques push mensuelles avec graphique barres, distribution géographique des cibles | Élevée |
| 45 | **Pages légales mises à jour (v1.2.0)** | Politique de confidentialité : 6 nouvelles sections (programme ambassadeur, programme partenaire, score de confiance, badges/gamification, événements sponsorisés, push/crash). CGU : 3 nouvelles sections (programme ambassadeur, trust score/anti-triche, événements sponsorisés). Pages statiques HTML bilingues hébergeables (`public/privacy-policy.html`, `public/terms-of-service.html`) | Moyenne |
| 46 | **Note du créateur enrichie** | Titre "Créé par un passionné, pour la communauté", message communautaire "12 millions de joueurs", 5 nouvelles fonctionnalités (trust score, badges, ambassadeur, partenaire, push A/B), section donation intégrée, section RDV terrain mise en valeur | Faible |
| 47 | **Descriptions store** | Guide complet `STORE_ASSETS_GUIDE.md` v1.2.0 avec descriptions FR/EN (titre 30 chars, description 4000 chars, mots-clés), couvrant programme ambassadeur/partenaire, portail, événements, FAQ par audience | Faible |
| 48 | **Universal Links** | Fichiers `.well-known/apple-app-site-association` (iOS) et `.well-known/assetlinks.json` (Android) avec placeholders documentés, guide d'hébergement complet `UNIVERSAL_LINKS_SETUP.md` | Faible |

### 2.2 Fonctionnalités partiellement implémentées

| # | Fonctionnalité | État actuel | Ce qui reste |
|---|---|---|---|
| 1 | **Google OAuth** | Code client prêt (`signInWithGoogle` dans template auth) | Activer Google Provider dans OnSpace Cloud Dashboard, configurer Client ID/Secret OAuth, tester sur appareil réel |
| 2 | **AdMob** | IDs de test configurés (`ca-app-pub-3940256099942544`) | Remplacer par IDs de production, tester sur builds EAS |

---

## 3. ARCHITECTURE & STRUCTURE

### 3.1 Stack technique

| Composant | Technologie |
|---|---|
| **Framework** | React Native + Expo SDK |
| **Langage** | TypeScript |
| **Navigation** | Expo Router (file-based routing) |
| **Backend** | OnSpace Cloud (compatible Supabase) |
| **Base de données** | PostgreSQL (via OnSpace Cloud) — 24+ tables, 90+ politiques RLS |
| **Auth** | Supabase Auth (OTP email + mot de passe) |
| **Storage** | Supabase Storage (5 buckets : avatars, boules-photos, club-cards, federation-cards, terrain-photos) |
| **Edge Functions** | Deno (7 fonctions : delete-account, detect-suspicious, notify-referral, record-purchase, send-push, validate-promo-code, weekly-cron) |
| **State Management** | React Context API (AppContext + LanguageContext) + hooks extraits (useStatsComputation, useProgressionStats, useItemFilter, useFilteredStats, useAppComputed, useAppGetters) |
| **Cache** | AsyncStorage |
| **Images** | expo-image |
| **Cartes** | react-native-maps (mobile), react-leaflet (web) |
| **Notifications** | expo-notifications |
| **Publicités** | react-native-google-mobile-ads |
| **Animations** | react-native-reanimated (~3.17.5) avec plugin Babel |
| **Charts** | react-native-svg (custom) |
| **QR Codes** | react-native-qrcode-svg |

### 3.2 Structure des données (24+ tables)

```
user_profiles          → Profil utilisateur (id FK→auth.users, is_premium, is_admin, xp)
players                → Joueurs (user_id FK→user_profiles, stats JSONB, is_public)
clubs                  → Clubs (user_id, terrain_id, is_public)
terrains               → Terrains (user_id, club_id, location JSONB, public_access)
tournaments            → Tournois (user_id, phases/teams JSONB, is_public, registration_cost, prize_won)
matches                → Matchs (user_id, team_a/team_b JSONB, menes JSONB, player_actions JSONB, participant_user_ids uuid[], series_info JSONB)
challenges             → Défis (user_id, shots JSONB, precision_shots JSONB, detailed_shots JSONB, participant_user_ids uuid[], sponsor_id)
boules_sets            → Jeux de boules (user_id, is_primary, purchase_price)
ambassadors            → Ambassadeurs (user_id, player_id, badge_type, is_featured, ambassador_level, referral_code, referral_count, total_referral_xp, brand_color)
ambassador_analytics   → Analytics ambassadeurs (event_type, social_platform, source_page)
sponsored_events       → Événements sponsorisés (ambassador_id, share_code unique)
sponsored_event_participants → Participants événements
sponsored_event_witnesses    → Témoins/attestations
match_share_requests   → Demandes de partage cross-joueurs (sender/recipient, permission, status)
match_witness_requests → Demandes d'attestation de témoins
shared_items           → Items partagés (share_code unique, permission, view_count)
share_notifications    → Notifications de partage
share_access_logs      → Logs d'accès aux partages
modification_logs      → Logs de modifications (changes JSONB avec field/oldValue/newValue)
soft_deletes           → Suppressions douces (pour delta sync)
merge_logs             → Historique des fusions
terrain_meetups        → Rendez-vous sur terrains (share_code unique)
terrain_meetup_responses → Réponses aux rendez-vous
user_preferences       → Préférences (favoris JSONB, notification_preferences JSONB)
user_badges            → Badges débloqués (badge_id, unlocked_at)
weekly_leaderboard_snapshots → Snapshots classement hebdomadaire
trust_score_history    → Historique scores de confiance
push_tokens            → Jetons push Expo (user_id, token, platform, active)
device_registrations   → Enregistrements d'appareils (anti-fraude)
promo_codes / promo_code_redemptions → Codes promo
purchase_receipts      → Preuves d'achat
player_reports / suspicious_players  → Signalements et scores de confiance
event_notifications / tournament_notifications → Notifications
```

### 3.3 Organisation des écrans (Expo Router)

```
app/
├── (tabs)/               ← Navigation principale (4 onglets)
│   ├── index.tsx         ← Accueil (hero, actions rapides, bilan hebdo, timeline, classement, ambassadeurs, historique)
│   ├── stats.tsx         ← Statistiques (4 catégories, filtres, progression, charts SVG)
│   ├── directory.tsx     ← Annuaire (5 onglets, filtres avancés, doublons, fusion)
│   └── map.tsx           ← Carte (clusters, items publics, classement par zone géographique)
├── match/new.tsx         ← Création de match (Best of 3, association boules/terrain)
├── match/[id].tsx        ← Édition de match (conflit, read-only, modification logging)
├── challenge/new.tsx     ← Création de défi (solo/1v1, 3 types, sponsorisé)
├── history.tsx           ← Historique matchs/défis (filtres, partages reçus)
├── player/[id|me|new|compare|edit/[id]].tsx
├── club/[id|new|edit/[id]].tsx
├── terrain/[id|new|edit/[id]].tsx
├── tournament/[id|new|edit/[id]].tsx
├── sponsored-event/[id|new|list].tsx
├── meetup/[id|new|invitations].tsx
├── ambassadors.tsx       ← Liste ambassadeurs (communauté uniquement)
├── partners.tsx          ← Liste partenaires (sponsors/business)
├── ambassador-dashboard.tsx ← Dashboard ambassadeur (analytics, events)
├── ambassador-program.tsx ← Programme ambassadeur (3 niveaux, critères, avantages)
├── partner-program.tsx   ← Programme partenaire (3 tiers, comparaison, témoignages)
├── sponsor-portal.tsx    ← Portail partenaires (6 onglets : ROI, Placement, Branding, Push, Events, CRM)
├── sponsor-digest.tsx    ← Historique digests hebdomadaires
├── sponsor-analytics.tsx ← Analytics sponsorisé détaillé
├── partner/[id].tsx      ← Page landing publique partenaire
├── faq.tsx               ← FAQ par audience (3 onglets, 56+ questions)
├── profile.tsx           ← Mon profil (accordéons, XP, badges)
├── login.tsx             ← Authentification (OTP + mot de passe)
├── onboarding.tsx        ← Écrans d'accueil (3 étapes)
├── badges.tsx            ← Collection de badges
├── trust-score.tsx       ← Score de confiance détaillé
├── leaderboard.tsx       ← Classement communautaire complet
├── financial.tsx         ← Bilan financier (tournois)
├── palmares.tsx          ← Palmarès (résultats tournois)
├── equipment.tsx         ← Gestion des boules
├── scanner.tsx           ← Scanner QR code
├── privacy-policy.tsx    ← Politique de confidentialité (24 sections)
├── terms.tsx             ← CGU (27 sections)
├── creator-note.tsx      ← Note du créateur (16 fonctionnalités, section donation)
├── remove-ads.tsx        ← Suppression pubs / Donation
└── ... (30+ autres pages)
```

### 3.4 Architecture des hooks (12+ hooks)

```
hooks/
├── useStatsComputation.ts     ← 4 hooks stats centralisés (usePerformanceStats, useTirStats, usePointStats, useErrorStats)
├── useProgressionStats.ts     ← 7 hooks progression (useBoulesSetStats, useTerrainTypeStats, usePrecisionWorkshopStats, useProgressionData, useTrends, useChallengeProgressionData, useTournamentProgressionData)
├── useItemFilter.ts           ← Hook filtrage par item (match, défi, tournoi, adversaire, partenaire, terrain, boules) — 8 états, 3 memos, 9 callbacks
├── useFilteredStats.ts        ← Filtrage temporel (filterByTime)
├── useAppComputed.ts          ← Données calculées (selfPlayer, statistics)
├── useAppGetters.ts           ← 9 getters (getMatchesByTournament, etc.)
├── useFavorites.ts            ← Gestion des favoris
├── useBadges.ts               ← Progression des badges
├── useMeetups.ts              ← Rendez-vous
├── useLanguage.ts             ← Hook i18n
├── useResponsiveDimensions.ts ← Dimensions responsive
└── useNetworkStatus.native.ts / .web.ts ← État réseau
```

### 3.5 Architecture des composants stats

```
components/feature/stats/
├── PerformanceSection.tsx     ← Section Performance (victoires, formats, mènes, terrain, boules)
├── TirSection.tsx             ← Section Tir (taux de réussite, carreaux, tableaux croisés Type×Impact)
├── PointSection.tsx           ← Section Point (taux de réussite, qualité, tableaux croisés Type×Qualité)
├── ErrorsSection.tsx          ← Section Erreurs (taux, types, séries, coaching)
├── ProgressionModal.tsx       ← Modal progression (~300 lignes SVG charts, trend cards, summary table)
├── ItemPickerModal.tsx        ← Modal sélection d'item (~400 lignes, 7 pickers avec recherche)
├── StatsPrimitives.tsx        ← Composants partagés (ProgressRing, StatRow, SectionHeader, ProgressBar, BreakdownBar, InsightBox)
├── statsSharedStyles.ts       ← Styles partagés stats
└── index.ts                   ← Barrel export
```

### 3.6 i18n modulaire (26 fichiers)

```
constants/i18n/
├── index.ts              ← Barrel export (fusionne tous les fichiers thématiques)
├── common.ts             ← Clés communes (boutons, labels, erreurs)
├── home.ts               ← Accueil
├── stats.ts              ← Statistiques
├── match.ts              ← Matchs
├── challenge.ts          ← Défis
├── tournament.ts         ← Tournois
├── tournamentEnums.ts    ← Enums tournois (formats, types, phases)
├── player.ts             ← Joueurs
├── club.ts               ← Clubs
├── terrain.ts            ← Terrains
├── equipment.ts          ← Équipement (boules)
├── directory.ts          ← Annuaire
├── history.ts            ← Historique
├── profile.ts            ← Profil
├── map.ts                ← Carte
├── share.ts              ← Partage
├── meetup.ts             ← Rendez-vous
├── leaderboard.ts        ← Classements
├── palmares.ts           ← Palmarès
├── financial.ts          ← Financier
├── notifications.ts      ← Notifications
├── password.ts           ← Mot de passe
├── sync.ts               ← Synchronisation
├── legal.ts              ← Pages légales
├── trustAndReports.ts    ← Confiance et signalements
├── gameAndUI.ts          ← Jeu et interface
└── misc.ts               ← Divers
```

### 3.7 Suite de tests (26 fichiers, 380+ tests)

```
__tests__/
├── unit/
│   ├── useStatsComputation.test.ts    ← Tests usePerformanceStats, useTirStats, usePointStats (20+ tests)
│   ├── useErrorStats.test.ts          ← Tests useErrorStats (20 tests : erreurs par durée/format/mode, types, séries)
│   ├── useProgressionStats.test.ts    ← Tests useProgressionData, useTrends, useTournamentProgressionData, useBoulesSetStats, useTerrainTypeStats, useChallengeProgressionData, usePrecisionWorkshopStats (60+ tests)
│   ├── useItemFilter.test.ts          ← Tests filtrage par item (filteredMatches, filteredChallenges, activeFilterLabel, cas limites) (40+ tests)
│   ├── useFilteredStats.test.ts       ← Tests filterByTime
│   ├── useAppComputed.test.ts         ← Tests useAppComputed
│   ├── useAppGetters.test.ts          ← Tests useAppGetters
│   ├── useBadges.test.ts              ← Tests calcul XP, badge context, niveaux (25+ tests)
│   ├── useFavorites.test.ts           ← Tests toggle/check favoris terrains et clubs (20+ tests)
│   ├── useResponsiveDimensions.test.ts ← Tests breakpoints responsive phone/tablet/desktop (15 tests)
│   ├── useMeetups.test.ts             ← Tests déduplication meetups, tri par date, comptage acceptés, tagging source, pipeline complet (30+ tests)
│   ├── statsSections.test.ts          ← Tests d'intégration sections stats
│   ├── crudServices.test.ts           ← Tests services CRUD
│   ├── dataTypes.test.ts              ← Tests types de données
│   ├── databaseSchema.test.ts         ← Tests schéma DB
│   ├── i18n.test.ts                   ← Tests i18n
│   ├── exportService.test.ts           ← Tests export CSV/PDF (sélection colonnes, filtrage période/saison/tournoi/joueur, escapeCsv, computePeriodStats, comparatifs, préréglages, gros volumes) (50+ tests)
│   ├── streakService.test.ts           ← Tests séries consécutives (computeStreakFromDates, déduplication, bestStreak, playedToday, streakAtRisk, getStreakStatus FR/EN, getDailyActivityLast7Days, 365 jours) (40+ tests)
│   ├── trustScoreService.test.ts       ← Tests score de confiance (computeQuickTrustScore 10 facteurs, seuils niveaux, couleurs/icônes/labels FR/EN, badges descriptions, poids validation match, stacking pénalités, cas limites) (70+ tests)
│   ├── modificationLogService.test.ts ← Tests logs de modification
│   └── providerHierarchy.test.ts      ← Tests hiérarchie providers
└── e2e/
    ├── auth-flow.test.ts              ← Tests flux authentification
    ├── crossPlayerSharing.test.ts     ← Tests partage cross-joueurs (10 phases, 20+ tests)
    ├── selfplayer-verification.test.ts ← Tests vérification selfPlayer
    ├── badge-flow.test.ts             ← Tests E2E flux badges : construction contexte, évaluation conditions, calcul XP, progression niveaux, cycle d'attribution DB, badges confiance/ambassadeur, prévention doublons (50+ tests sur 8 phases)
    └── meetup-flow.test.ts            ← Tests E2E flux meetup complet : création → auto-accept créateur → recherche par code → accepter/refuser → comptage participants → invitation directe → annulation → suppression → listing → utilisateurs invitables (30+ tests sur 9 phases)
```

### 3.8 Architecture des services (50+ services)

```
services/
├── dbMappers.ts                ← 7 mappers DB→types + mergeRecords + calculatePlayerStats
├── matchCrudService.ts         ← add/update/delete matchs
├── playerCrudService.ts        ← add/update/delete joueurs
├── clubCrudService.ts          ← add/update/delete clubs
├── tournamentCrudService.ts    ← add/update/delete tournois
├── terrainCrudService.ts       ← add/update/delete terrains
├── challengeCrudService.ts     ← add/update/delete défis
├── boulesSetCrudService.ts     ← add/update/delete/setPrimary boules
├── matchShareService.ts        ← Partage cross-joueurs, polling, détection, mise à jour stats
├── collaborativeEditService.ts ← Détection conflits, calcul diffs
├── modificationLogService.ts   ← Logs modifications, revert par champ/bloc
├── shareService.ts             ← Partage par code, items partagés
├── streakService.ts            ← Séries consécutives, activité quotidienne (FR/EN)
├── weeklyLeaderboardService.ts ← Classement hebdomadaire, snapshots, reset
├── trustScoreService.ts        ← Score de confiance (10 facteurs, historique)
├── badgeService.ts             ← 10 badges, XP, progression
├── leaderboardService.ts       ← Classements communautaires (joueurs, clubs, boules)
├── rankingChangeService.ts     ← Détection changement de classement
├── sentryService.native.ts     ← Crash reporting Sentry (placeholder DSN documenté)
├── sentryService.web.ts        ← Stub Sentry pour web
├── notificationPreferencesService.ts ← Préférences notifications par type
├── pushTokenService.ts         ← Enregistrement tokens push
├── offlineQueueService.ts      ← Queue offline, replay, conflits
├── cacheService.ts             ← Cache AsyncStorage
├── ambassadorService.ts        ← CRUD ambassadeurs (3 niveaux, promotion auto)
├── ambassadorAnalyticsService.ts ← Analytics ambassadeurs et sponsors
├── pushQuotaService.ts         ← Gestion quotas push par tier partenaire
├── sponsoredEventService.ts    ← Événements sponsorisés
├── meetupService.ts            ← Rendez-vous
├── publicItemsService.ts       ← Items publics (carte)
├── exportService.ts            ← Export CSV/PDF
├── iapService.native.ts        ← In-App Purchase (natif)
├── iapService.web.ts           ← Stub IAP pour web
├── adService.native.ts         ← AdMob (natif)
├── adService.web.ts            ← Stub AdMob pour web
├── haptics.native.ts / .web.ts ← Vibrations (platform-specific)
├── location.native.ts / .web.ts ← Géolocalisation (platform-specific)
├── camera.native.ts / .web.ts  ← Caméra (platform-specific)
└── ... (autres services spécialisés)
```

### 3.9 Sécurité (RLS)

- **90+ politiques RLS** actives sur toutes les tables
- Patterns : `authenticated_*_own_*` (CRUD propre), `admin_*` (admin), `public_select_*` (lecture publique), `participant_*_shared_*` (items partagés), `shared_select_*` (items partagés via code)
- **9 triggers** DB : auto-création profil, sync metadata, soft deletes sur 7 tables
- **5 fonctions DB** : handle_new_user, sync_user_metadata, is_meetup_creator, log_soft_delete, get_premium_user_ids
- **7 Edge Functions** : delete-account, detect-suspicious, notify-referral, record-purchase, send-push, validate-promo-code, weekly-cron
- **30+ index** de performance

### 3.10 Configuration de build

#### babel.config.js
```js
module.exports = function (api) {
  api.cache(true)  // IMPORTANT: doit être true pour les builds EAS
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],  // OBLIGATOIRE pour les animations
  }
}
```

#### app.json — Points critiques
- `newArchEnabled: false` — désactivé pour compatibilité avec react-native-qrcode-svg et react-native-google-mobile-ads
- Plugin `expo-camera` déclaré pour le scanner QR
- Plugin `react-native-google-mobile-ads` avec IDs de test (à remplacer pour la production)
- `android.config.googleMaps.apiKey` — placeholder documenté (à remplir)

#### eas.json — Profils de build
- `development` : client de développement, distribution interne
- `preview` : APK Android pour tests internes
- `production` : AAB Android + iOS pour les stores

---

## 4. ÉTAT ACTUEL DU PROJET

### 4.1 Ce qui est fonctionnel (Production-ready)

- Authentification complète (OTP + mot de passe)
- CRUD complet pour toutes les entités (7 services extraits et testés)
- Statistiques avancées avec toutes les catégories et filtres
- Bilan hebdomadaire avec sparkline bicolore et lien vers stats filtrées
- Carte interactive avec clustering, items publics et classement par zone
- Partage cross-joueurs avec permissions, notifications et mise à jour automatique des stats
- Édition collaborative avec résolution de conflits et historique traçable
- Programme ambassadeur 3 niveaux (Découverte/Confirmé/Élite) avec promotion automatique et système XP
- Programme partenaire 3 niveaux (Bronze/Argent/Or) avec portail complet 6 onglets
- Portail partenaires : ROI avec benchmark/objectifs/calculateur, Branding avec kit de marque, Push avec A/B testing/templates/heatmap/programmation, CRM avec export
- Pages landing partenaire avec hero branded, compteurs animés, QR code
- Pages programme ambassadeur et partenaire avec niveaux collapsibles et comparaison
- FAQ par audience (Joueur/Ambassadeur/Partenaire, 56+ questions)
- Défis sponsorisés avec attestation par témoins
- Digest hebdomadaire automatique pour partenaires Or
- Système de rendez-vous (meetups) avec QR codes
- Offline mode avec queue, replay et delta sync
- i18n FR/EN complet (700+ clés, 26 fichiers modulaires)
- Design system harmonisé (en-têtes #0F172A, cartes glassmorphiques, 12 AdBanners optimisés)
- **Architecture stats refactorisée** : hooks centralisés, composants extraits, primitives partagées
- **Suite de tests complète** : 26 fichiers (380+ tests unitaires, intégration et E2E) couvrant hooks, services, composants, cycle de vie badges, logique meetups, export CSV/PDF, séries consécutives, score de confiance, flux meetup E2E et partage cross-joueurs
- Publicités AdMob (IDs de test)
- Deep linking fonctionnel
- Anti-fraude (fingerprinting, scores de confiance, détection multi-comptes)
- Données de démonstration optimisées (8 joueurs, 4 clubs, 5 terrains, 3 tournois, 12 matchs, 6 défis)
- **Pages légales complètes** : politique de confidentialité (24 sections) et CGU (27 sections) couvrant tous les programmes
- **Pages HTML statiques** bilingues pour hébergement public (`public/privacy-policy.html`, `public/terms-of-service.html`)
- **Note du créateur** enrichie avec 16 fonctionnalités, section donation, message communautaire
- **Guide descriptions store** v1.2.0 (`STORE_ASSETS_GUIDE.md`)
- **Fichiers Universal Links** : `.well-known/apple-app-site-association` et `.well-known/assetlinks.json`
- **Guide Universal Links** complet (`UNIVERSAL_LINKS_SETUP.md`)
- **Configuration EAS** avec profils de build documentés (`eas.json`)
- **Placeholder Sentry DSN** documenté dans `sentryService.native.ts`
- **Placeholder Google Maps API Key** documenté dans `app.json`

### 4.2 Ce qui est partiellement implémenté

- **Google OAuth** : code client prêt mais provider non activé côté serveur
- **AdMob** : fonctionne en mode test, nécessite IDs de production

### 4.3 Ce qui est manquant

- Tests sur appareils réels (IAP, notifications, deep links)
- IDs AdMob de production (remplacer les IDs de test dans `app.json`)
- Google Maps API Key réelle (remplacer le placeholder dans `app.json`)
- Sentry DSN réel (remplacer le placeholder dans `sentryService.native.ts`)
- Credentials Apple pour soumission (Apple ID, Team ID, ASC App ID dans `eas.json`)
- Service account Google Play (fichier JSON pour `eas.json`)

---

## 5. ROADMAP DE FINALISATION

### 5.1 Étapes de configuration

| # | Étape | Description | Action OnSpace | Action externe | Priorité |
|---|---|---|---|---|---|
| 1 | **Google OAuth** | Activer l'authentification Google | Dashboard OnSpace Cloud → User → Auth Settings → Enable Google Provider, renseigner Client ID & Secret | Google Cloud Console : créer projet, configurer OAuth consent screen, créer credentials (Web + iOS + Android) | Haute |
| 2 | **AdMob Production** | Remplacer IDs de test | Modifier `app.json` (androidAppId, iosAppId) avec IDs réels | Google AdMob Console : créer app iOS + Android, créer ad units (banner + interstitial) | Haute |
| 3 | **EAS Build** | Profils déjà configurés dans `eas.json` | — | Installer EAS CLI, remplir les placeholders dans `eas.json` (Apple ID, Team ID, ASC App ID, service account JSON) | Haute |
| 4 | **Certificats iOS** | Provisioning profiles et certificats | — | Apple Developer : créer App ID, Distribution Certificate, Provisioning Profile (ou laisser EAS gérer) | Haute |
| 5 | **Keystore Android** | Générer le keystore de signature | — | EAS gère automatiquement ou générer manuellement via `keytool` | Haute |
| 6 | **Notifications Push** | Configurer les credentials push | Dashboard OnSpace → Cloud → Secrets (si APNs key nécessaire) | Apple Developer : créer APNs Key (.p8) | Moyenne |
| 7 | **Deep Linking prod** | Fichiers Universal Links déjà créés (`.well-known/`) | Héberger les fichiers sur `ultimatepetanque.app` (voir `UNIVERSAL_LINKS_SETUP.md`) | Remplacer placeholders (Team ID, Bundle ID, package fingerprint) | Moyenne |
| 8 | **Google Maps API** | Placeholder dans `app.json` prêt | Remplacer `YOUR_GOOGLE_MAPS_API_KEY` dans `app.json` | Google Cloud Console : activer Maps SDK for Android/iOS, créer clé API restreinte | Haute |
| 9 | **Tests réels IAP** | Tester les achats in-app | — | App Store Connect : créer IAP (€5.99), sandbox testers ; Google Play Console : créer produit, licence testing | Haute |
| 10 | **Sentry DSN** | Placeholder dans `sentryService.native.ts` prêt | — | Sentry.io : créer projet, récupérer DSN, remplacer le placeholder | Moyenne |
| 11 | **Tests appareils** | Tester sur iOS et Android physiques | Télécharger APK via OnSpace, utiliser QR code OnSpace App pour iOS | — | Haute |
| 12 | **Assets Stores** | Guide complet dans `STORE_ASSETS_GUIDE.md` | — | Capturer screenshots, rédiger descriptions en suivant le guide | Haute |
| 13 | **Pages légales hébergées** | Fichiers HTML prêts dans `public/` | Héberger `public/privacy-policy.html` et `public/terms-of-service.html` sur une URL publique | Renseigner les URLs dans les stores | Haute |
| 14 | **QR Codes partage** | Page "Invitez vos amis !" avec QR codes dynamiques | Remplacer les URLs des QR codes par les liens de téléchargement réels (App Store + Google Play) dans les composants QR de partage | Copier les liens stores depuis App Store Connect et Google Play Console | Moyenne |

---

## 6. PUBLICATION SUR LES STORES

### 6.1 Publication sur Apple App Store

#### Prérequis

- Compte Apple Developer ($99/an)
- EAS CLI configuré avec credentials Apple (remplir `eas.json` → submit → ios)
- App Store Connect : app créée avec Bundle ID `com.ultimatepetanque.app`

#### Étapes détaillées

1. **Créer l'app dans App Store Connect**
   - Nom : "Ultimate Petanque"
   - Bundle ID : `com.ultimatepetanque.app`
   - SKU : `ultimatepetanque`
   - Catégorie principale : Sports
   - Catégorie secondaire : Utilities

2. **Configurer les métadonnées**
   - Description (FR + EN) — voir `STORE_ASSETS_GUIDE.md`
   - Mots-clés (max 100 caractères)
   - URL de support : `ultimate.petanque.app@gmail.com`
   - URL de politique de confidentialité : URL hébergée de `public/privacy-policy.html`
   - Screenshots (6.7" iPhone 15 Pro Max, 6.1" iPhone 15, 12.9" iPad Pro)

3. **Configurer les In-App Purchases**
   - Produit : "Supprimer les publicités" — €5.99 (non-consumable)
   - Localiser en FR et EN

4. **Configurer App Privacy**
   - Déclaration de confidentialité : données collectées (email, localisation, analytics)
   - App Tracking Transparency (déjà implémenté via `expo-tracking-transparency`)

5. **Build et soumission**
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios
   ```

### 6.2 Publication sur Google Play Store

#### Prérequis

- Compte Google Play Developer ($25 one-time)
- EAS CLI configuré (remplir `eas.json` → submit → android avec service account JSON)
- Google Play Console : app créée

#### Étapes détaillées

1. **Créer l'app dans Google Play Console**
   - Nom : "Ultimate Petanque"
   - Package : `com.ultimatepetanque.app`
   - Catégorie : Sports

2. **Store Listing**
   - Descriptions FR/EN — voir `STORE_ASSETS_GUIDE.md`
   - Icône (512×512 PNG)
   - Feature Graphic (1024×500 PNG)
   - Screenshots (min 2)
   - URL politique de confidentialité : URL hébergée de `public/privacy-policy.html`

3. **Build et soumission**
   ```bash
   eas build --platform android --profile production
   eas submit --platform android
   ```

---

## 7. RECOMMANDATIONS TECHNIQUES

### 7.1 Améliorations prioritaires

1. **Monitoring en production** : Sentry est intégré via `services/sentryService.native.ts` avec un placeholder DSN documenté. **Action** : créer un projet sur Sentry.io et remplacer le DSN.

2. **Rate limiting** : Les Edge Functions `validate-promo-code` (5 req/60s) et `record-purchase` (3 req/60s) disposent d'un rate limiter avec réponses 429.

3. **Validation des données** : Ajouter une validation côté serveur pour les données critiques (scores, statistiques).

4. **Tests E2E automatisés** : Compléter la suite de tests avec Detox ou Maestro.

### 7.2 Bonnes pratiques déjà en place

- Architecture Data-Logic-UI (services → hooks → components)
- Services platform-specific (.native.ts / .web.ts) pour tous les modules natifs
- RLS activé sur toutes les tables avec politiques séparées
- Delta sync avec soft deletes
- Cache local avec fallback offline
- i18n complet (700+ clés FR/EN) modularisé en 26 fichiers thématiques sous `constants/i18n/` avec barrel export
- Architecture stats refactorisée : hooks centralisés (`useStatsComputation`, `useProgressionStats`, `useItemFilter`), composants extraits (`PerformanceSection`, `TirSection`, `PointSection`, `ErrorsSection`, `ProgressionModal`, `ItemPickerModal`), primitives partagées (`StatsPrimitives`, `statsSharedStyles`)
- Suite de tests complète : 26 fichiers de tests (380+ tests unitaires + intégration + E2E) couvrant hooks stats (11 hooks), filtrage par item, badges/XP avec cycle de vie complet, favoris, responsive, déduplication/tri meetups, export CSV/PDF (colonnes, filtres, stats, préréglages), séries consécutives (streaks, activité quotidienne FR/EN), score de confiance (10 facteurs pondérés, niveaux, poids validation match), flux meetup E2E (9 phases), services, composants stats, types de données, schéma DB, partage cross-joueurs et flux d'attribution badges
- Plugin Babel Reanimated configuré
- `newArchEnabled: false` pour compatibilité maximale des librairies
- `api.cache(true)` dans babel.config.js pour optimisation des builds
- Tests unitaires et d'intégration
- Design system unifié et harmonisé
- Pages légales complètes avec versions HTML statiques hébergeables

### 7.3 Risques à anticiper

| Risque | Impact | Mitigation |
|---|---|---|
| **Rejet App Store** pour raison de paiement externe | Bloquant | S'assurer que tous les achats passent par Apple IAP |
| **Performance sur appareils bas de gamme** | Moyen | `useMemo` utilisé partout, FlatList pour les listes, clustering carte optimisé |
| **Délai de review Apple** | Planification | Prévoir 1-7 jours ouvrés, soumettre tôt dans la semaine |
| **Google OAuth rejeté** | Fonctionnel | Le système fonctionne déjà sans OAuth (OTP + mot de passe) |

### 7.4 Points d'attention pour le build

- Les **IDs AdMob dans `app.json`** sont des IDs de test (`ca-app-pub-3940256099942544`). **Ne pas publier avec ces IDs**.
- Le `newArchEnabled` est à `false` dans `app.json` — ne pas changer pour éviter des incompatibilités.
- Le plugin `react-native-reanimated/plugin` dans `babel.config.js` est **obligatoire** — son absence cause des crashs.
- `api.cache(true)` dans `babel.config.js` — ne pas changer en `false` (ralentit significativement les builds).
- Le plugin `expo-camera` doit être déclaré dans `app.json` pour que le scanner QR fonctionne.
- La **Google Maps API Key** doit être configurée pour que la carte fonctionne sur Android.

---

## 8. SUIVI POST-PUBLICATION ET ROADMAP V2

### 8.1 Actions post-publication immédiates

| # | Action | Priorité |
|---|---|---|
| 1 | Monitoring crashs Sentry quotidien, correctifs critiques sous 24h | Critique |
| 2 | Surveillance avis stores, réponses sous 48h | Haute |
| 3 | Suivi métriques : téléchargements, rétention J1/J7/J30, taux de crash | Haute |
| 4 | Vérification performances API Supabase | Haute |
| 5 | Processus hotfix EAS préparé | Moyenne |

### 8.2 Roadmap fonctionnelle V2

| # | Fonctionnalité | Complexité | Impact |
|---|---|---|---|
| 1 | **Mode sombre** | Moyenne | Élevé |
| 2 | **Chat entre joueurs** | Très élevée | Élevé |
| 3 | **Widget iOS/Android** | Moyenne | Moyen |
| 4 | **Intelligence artificielle** (analyse prédictive via OnSpace AI) | Élevée | Élevé |
| 5 | **Vidéo replay** des tirs marquants | Élevée | Moyen |
| 6 | **Marketplace sponsors** | Élevée | Business |
| 7 | **Système d'abonnement** premium mensuel/annuel | Moyenne | Business |
| 8 | **Localisation étendue** (espagnol, italien, portugais) | Moyenne | Moyen |

### 8.3 Processus de mise à jour

```bash
# Build preview pour tests
eas build --profile preview

# Build production
eas build --platform ios --profile production
eas build --platform android --profile production

# Soumission
eas submit --platform ios
eas submit --platform android

# OTA pour correctifs JS urgents
eas update --branch production --message "Fix: description"
```

---

## ANNEXES

### Annexe A — Commandes utiles

```bash
npx expo start              # Développement local
eas build --platform ios --profile production    # Build iOS
eas build --platform android --profile preview   # Build Android APK
eas build --platform android --profile production # Build Android AAB
eas submit --platform ios   # Soumission iOS
eas submit --platform android   # Soumission Android
npx jest                    # Tests
npx depcheck                # Vérifier dépendances
```

### Annexe B — Variables d'environnement

| Variable | Description | Localisation |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du backend OnSpace Cloud | `.env` (auto-généré) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase | `.env` (auto-généré) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (Edge Functions) | OnSpace Cloud Secrets |
| `SUPABASE_DB_URL` | URL directe PostgreSQL | OnSpace Cloud Secrets |

### Annexe C — Placeholders à remplir avant publication

| Fichier | Placeholder | Description |
|---|---|---|
| `app.json` | `YOUR_GOOGLE_MAPS_API_KEY` | Clé Google Maps API (Android) |
| `app.json` | AdMob IDs (`ca-app-pub-3940256099942544~*`) | Remplacer par IDs de production |
| `eas.json` | `YOUR_APPLE_ID_EMAIL` | Email du compte Apple Developer |
| `eas.json` | `YOUR_ASC_APP_ID` | App Store Connect → App → Apple ID (numérique) |
| `eas.json` | `YOUR_TEAM_ID` | Apple Developer → Membership → Team ID |
| `eas.json` | `./google-service-account.json` | Clé JSON du service account Google Play |
| `sentryService.native.ts` | DSN Sentry | Sentry.io → Project Settings → DSN |
| `.well-known/apple-app-site-association` | `TEAMID` | Apple Team ID |
| `.well-known/assetlinks.json` | SHA256 fingerprint | Fingerprint du keystore Android |

### Annexe D — Comptes de test

Créer un compte via l'écran de login avec n'importe quel email valide. Le système OTP enverra un code à 4 chiffres. Mot de passe minimum : 6 caractères.

---

*Document mis à jour le 28 mars 2026 — Ultimate Petanque v1.2.6*
