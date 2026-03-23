# ULTIMATE PETANQUE — Document Technique de Reprise

**Version :** 1.0.0  
**Date :** 23 mars 2026  
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
- **Partage cross-joueurs** : matchs et défis partagés entre comptes avec permissions et édition collaborative
- **Programme ambassadeur** avec analytiques de visibilité et défis sponsorisés
- **Classements communautaires** : joueurs, clubs, marques de boules
- **Système de rendez-vous** entre joueurs via codes de partage

### 1.5 Fonctionnement global

L'utilisateur s'inscrit via OTP email + mot de passe, crée son profil joueur automatiquement, puis peut immédiatement : enregistrer des matchs (avec scoring mène par mène), lancer des défis (10 tirs, tirs sautés, précision), créer/gérer des tournois avec phases et brackets, trouver des terrains et clubs sur la carte, et rejoindre la communauté via classements et ambassadeurs.

---

## 2. FONCTIONNALITÉS DÉTAILLÉES

### 2.1 Fonctionnalités terminées

| # | Fonctionnalité | Description | Complexité |
|---|---|---|---|
| 1 | **Authentification OTP + Mot de passe** | Inscription/connexion via email OTP (4 chiffres) + mot de passe, session persistante | Moyenne |
| 2 | **Enregistrement de matchs** | Création avec format (Tête-à-tête/Doublette/Triplette), mode (Entraînement/Tournoi), scoring mène par mène, actions joueurs détaillées | Élevée |
| 3 | **Notation avancée des tirs** | Types (au fer, au plomb, en rafle, court ramassé, carreau), résultats d'échec (court droite/gauche, long, tir bouchon), qualité d'impact (gain point, décisif, sans effet, négatif) | Élevée |
| 4 | **Notation avancée des points** | Types (roulé, plombé, demi-portée, portée), qualité (excellent, bon, moyen, au bouchon, devant boule, raté, crocheté, sorti) | Élevée |
| 5 | **Défis (Challenges)** | 3 types : 10 Tirs, 10 Tirs Sautés, Précision (5 ateliers). Modes solo et 1v1 | Élevée |
| 6 | **Statistiques complètes** | 4 catégories (Performance, Tir, Point, Erreurs) avec filtres temporels (jour→all), filtres par item (match, tournoi, adversaire, partenaire, terrain, boules), graphiques de progression | Très élevée |
| 7 | **Statistiques croisées** | Tableaux Type×Impact (tir), Type×Qualité (point), stats par type de terrain, stats par jeu de boules avec comparaison graphique | Élevée |
| 8 | **Analyse d'erreurs** | Taux d'erreur par durée/format/contexte, types d'erreurs détaillés avec conseils coaching, séries d'erreurs consécutives | Élevée |
| 9 | **Gestion de tournois** | Création avec phases (poules, élimination, finale), brackets, résultats, palmarès, notifications de rappel | Élevée |
| 10 | **Annuaire (Directory)** | 5 onglets (Joueurs, Clubs, Terrains, Tournois, Défis ambassadeurs) avec filtres avancés, recherche, détection de doublons, fusion avec historique et annulation | Très élevée |
| 11 | **Carte interactive** | Géolocalisation terrains/clubs/joueurs/tournois, clustering dynamique, items publics/privés, mode batch pour géolocaliser, légende | Élevée |
| 12 | **Partage cross-joueurs** | Détection auto des joueurs liés, demandes de partage (lecture/écriture), acceptation/refus, polling 30s, notifications push locales | Très élevée |
| 13 | **Édition collaborative** | Détection de conflits via timestamps, diff visuel champ par champ, résolution (garder le mien / garder la version serveur / annuler) | Élevée |
| 14 | **Historique des modifications** | Logs champ par champ avec diff coloré (rouge→vert), annulation par champ et en bloc, nettoyage automatique des logs | Élevée |
| 15 | **Programme ambassadeur** | Profils ambassadeurs avec bio/réseaux sociaux, bannière rotative sur l'accueil, analytics (impressions, clics, CTR, sparklines 7j/30j) | Élevée |
| 16 | **Défis sponsorisés** | Création d'événements par ambassadeurs, inscription participants, attestation par témoins, classement | Élevée |
| 17 | **Notifications push serveur** | Edge Function `send-push` via Expo Push API avec 5 types de déclencheurs (événements ambassadeurs avec proximité 200km, invitations meetup, changements de classement, demandes de partage, rappels), table `push_tokens`, enregistrement automatique, préférences par type | Élevée |
| 17b | **Notifications locales** | Push locales (rappels tournois, demandes de partage, attestations), canaux Android dédiés, navigation par tap | Moyenne |
| 18 | **Système de rendez-vous (Meetups)** | Création de meetups, invitations par code, réponses, compteur de participants confirmés | Moyenne |
| 19 | **Classements communautaires** | Classement joueurs (min 5 matchs), classement clubs, classement marques de boules, taux "devant boule" | Moyenne |
| 20 | **Équipement (Boules)** | CRUD jeux de boules avec photo, marque, diamètre, poids, dureté, prix, jeu principal synchronisé au profil | Moyenne |
| 21 | **Profil utilisateur** | Sections accordéon (Compte, Notifications, Données, Communauté, Mentions légales), avatar, carte fédération | Moyenne |
| 22 | **Gestion des partages** | Section statut de partage dans les modals match/défi, révocation, historique des logs de modification | Moyenne |
| 23 | **Achats in-app** | Suppression des publicités (€5.99), codes promo avec validation serveur, receipts stockés en DB | Moyenne |
| 24 | **Anti-fraude** | Fingerprinting appareil, blocage emails jetables, détection multi-comptes, scores de confiance | Moyenne |
| 25 | **Offline & Sync** | Cache local AsyncStorage, queue offline avec replay, delta sync avec soft deletes, résolution de conflits, mode économie batterie | Élevée |
| 26 | **i18n FR/EN** | 700+ clés de traduction, détection langue système, persistance du choix utilisateur | Moyenne |
| 27 | **Publicités AdMob** | Bannières inline et interstitiels, suppression via achat premium | Faible |
| 28 | **Deep Linking** | Scheme `ultimatepetanque://`, intent filters Android, associated domains iOS, navigation depuis notifications | Moyenne |
| 29 | **Système de partage** | Codes de partage uniques, liens publics, items partagés avec permissions, notifications de partage | Moyenne |
| 30 | **Export de données** | Export CSV des matchs et défis | Faible |
| 31 | **Détection changement de classement** | Snapshot des rangs avant sauvegarde de match, comparaison après, notification push serveur aux joueurs dont le rang a changé | Moyenne |
| 32 | **Préférences de notifications** | Toggles par type dans le profil (événements, meetups, classement, partages, rappels), JSONB dans `user_preferences`, respectées côté serveur | Moyenne |
| 33 | **Monitoring Sentry** | Service `sentryService.ts` intégré au lancement de l'app, capture des exceptions/messages, breadcrumbs de navigation, contexte utilisateur anonymisé (IP supprimée) | Moyenne |
| 34 | **Rate Limiting Edge Functions** | Protection anti-abus sur `validate-promo-code` (5 req/min) et `record-purchase` (3 req/min) avec réponses 429, détection de transactions dupliquées | Moyenne |

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
| **Framework** | React Native + Expo SDK (New Architecture) |
| **Langage** | TypeScript |
| **Navigation** | Expo Router (file-based routing) |
| **Backend** | OnSpace Cloud (compatible Supabase) |
| **Base de données** | PostgreSQL (via OnSpace Cloud) |
| **Auth** | Supabase Auth (OTP email + mot de passe) |
| **Storage** | Supabase Storage (5 buckets : avatars, boules-photos, club-cards, federation-cards, terrain-photos) |
| **Edge Functions** | Deno (6 fonctions : delete-account, detect-suspicious, record-purchase, send-push, validate-promo-code, validate-receipt) |
| **State Management** | React Context API (AppContext) |
| **Cache** | AsyncStorage |
| **Images** | expo-image |
| **Cartes** | react-native-maps (mobile), react-leaflet (web) |
| **Notifications** | expo-notifications |
| **Publicités** | react-native-google-mobile-ads |
| **Animations** | react-native-reanimated |
| **Charts** | react-native-svg (custom) |

### 3.2 Structure des données (24 tables)

```
user_profiles          → Profil utilisateur (id FK→auth.users, is_premium, is_admin)
players                → Joueurs (user_id FK→user_profiles, stats JSONB, is_public)
clubs                  → Clubs (user_id, terrain_id, is_public)
terrains               → Terrains (user_id, club_id, location JSONB, public_access)
tournaments            → Tournois (user_id, phases/teams JSONB, is_public)
matches                → Matchs (user_id, team_a/team_b JSONB, menes JSONB, player_actions JSONB, participant_user_ids uuid[])
challenges             → Défis (user_id, shots JSONB, precision_shots JSONB, detailed_shots JSONB, participant_user_ids uuid[])
boules_sets            → Jeux de boules (user_id, is_primary)
ambassadors            → Ambassadeurs (user_id, player_id, badge_type, is_featured)
ambassador_analytics   → Analytics ambassadeurs (event_type, social_platform, source_page)
sponsored_events       → Événements sponsorisés (ambassador_id, share_code unique)
sponsored_event_participants → Participants événements
sponsored_event_witnesses    → Témoins/attestations
match_share_requests   → Demandes de partage cross-joueurs (sender/recipient, permission, status)
shared_items           → Items partagés (share_code unique, permission)
share_notifications    → Notifications de partage
modification_logs      → Logs de modifications (changes JSONB avec field/oldValue/newValue)
soft_deletes           → Suppressions douces (pour delta sync)
merge_logs             → Historique des fusions
terrain_meetups        → Rendez-vous sur terrains (share_code unique)
terrain_meetup_responses → Réponses aux rendez-vous
user_preferences       → Préférences (favoris terrains/clubs JSONB, notification_preferences JSONB)
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
│   ├── index.tsx         ← Accueil (hero, actions rapides, tournoi/meetups, historique, classement, ambassadeurs)
│   ├── stats.tsx         ← Statistiques (4 catégories, filtres, progression, charts SVG)
│   ├── directory.tsx     ← Annuaire (5 onglets, filtres avancés, doublons, fusion)
│   └── map.tsx           ← Carte (clusters, items publics, gestion visibilité)
├── match/new.tsx         ← Création de match
├── match/[id].tsx        ← Édition de match (avec conflit, read-only, modification logging)
├── challenge/new.tsx     ← Création de défi
├── history.tsx           ← Historique matchs/défis (filtres, partages reçus, modals détail)
├── player/[id|me|new|compare|edit/[id]].tsx
├── club/[id|new|edit/[id]].tsx
├── terrain/[id|new|edit/[id]].tsx
├── tournament/[id|new|edit/[id]].tsx
├── sponsored-event/[id|new|list].tsx
├── meetup/[id|new|invitations].tsx
├── ambassadors.tsx       ← Liste ambassadeurs
├── ambassador-dashboard.tsx ← Dashboard ambassadeur (analytics, events, profil)
├── match-invitations.tsx ← Demandes de partage reçues
├── profile.tsx           ← Mon profil (accordéons)
├── login.tsx             ← Authentification
├── onboarding.tsx        ← Écrans d'accueil
└── ... (19 autres pages)
```

### 3.4 Architecture des services (Data-Logic-UI)

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
├── matchShareService.ts        ← Partage cross-joueurs, polling, détection
├── collaborativeEditService.ts ← Détection conflits, calcul diffs
├── modificationLogService.ts   ← Logs modifications, revert par champ/bloc
├── shareService.ts             ← Partage par code, items partagés
├── sentryService.ts             ← Crash reporting Sentry (init, capture, breadcrumbs, user context)
├── rankingChangeService.ts     ← Détection changement de classement, snapshot/comparaison
├── notificationPreferencesService.ts ← Préférences notifications push par type
├── pushTokenService.ts         ← Enregistrement tokens push, déclenchement push serveur
├── offlineQueueService.ts      ← Queue offline, replay, conflits
├── cacheService.ts             ← Cache AsyncStorage
├── syncConfigService.ts        ← Configuration sync, mode batterie
├── ambassadorService.ts        ← CRUD ambassadeurs
├── ambassadorAnalyticsService.ts ← Analytics ambassadeurs
├── sponsoredEventService.ts    ← Événements sponsorisés
├── notificationService.ts      ← Notifications push locales
├── leaderboardService.ts       ← Classements communautaires
├── meetupService.ts            ← Rendez-vous
├── publicItemsService.ts       ← Items publics (carte)
├── iapService.native.ts        ← In-App Purchase (natif)
├── adService.native.ts         ← AdMob (natif)
└── ... (15 autres services)
```

### 3.5 Sécurité (RLS)

- **90+ politiques RLS** actives sur toutes les 24 tables
- Patterns : `authenticated_*_own_*` (CRUD propre), `admin_*` (admin), `public_select_*` (lecture publique), `participant_*_shared_*` (items partagés), `shared_select_*` (items partagés via code)
- **9 triggers** DB : auto-création profil, sync metadata, soft deletes sur 7 tables
- **5 fonctions DB** : handle_new_user, sync_user_metadata, is_meetup_creator, log_soft_delete, get_premium_user_ids
- **30+ index** de performance

---

## 4. ÉTAT ACTUEL DU PROJET

### 4.1 Ce qui est fonctionnel (Production-ready)

- Authentification complète (OTP + mot de passe)
- CRUD complet pour toutes les entités (7 services extraits et testés)
- Statistiques avancées avec toutes les catégories et filtres
- Carte interactive avec clustering et items publics
- Partage cross-joueurs avec permissions et notifications
- Édition collaborative avec résolution de conflits
- Programme ambassadeur avec analytics
- Défis sponsorisés avec attestation par témoins
- Système de rendez-vous (meetups)
- Offline mode avec queue, replay et delta sync
- i18n FR/EN complet (700+ clés)
- Tests unitaires (7 services CRUD) et intégration (flux complet cross-player sharing)
- Publicités AdMob (IDs de test)
- Deep linking fonctionnel
- Anti-fraude (fingerprinting, détection multi-comptes)

### 4.2 Ce qui est partiellement implémenté

- **Google OAuth** : code client prêt mais provider non activé côté serveur
- **AdMob** : fonctionne en mode test, nécessite IDs de production
- **Export CSV** : fonctionnel mais limité (pas de sélection de colonnes)

### 4.3 Ce qui est manquant

- Tests sur appareils réels (IAP, notifications, deep links)
- Configuration EAS Build pour production
- Configuration Google Maps API Key pour la carte (Android)
- Assets App Store / Play Store (screenshots, descriptions)
- IDs AdMob de production

---

## 5. ROADMAP DE FINALISATION

### 5.1 Étapes de configuration

| # | Étape | Description | Action OnSpace | Action externe | Priorité | Temps (h) |
|---|---|---|---|---|---|---|
| 1 | **Google OAuth** | Activer l'authentification Google | Dashboard OnSpace Cloud → User → Auth Settings → Enable Google Provider, renseigner Client ID & Secret | Google Cloud Console : créer projet, configurer OAuth consent screen, créer credentials (Web + iOS + Android) | Haute | 4-6h |
| 2 | **AdMob Production** | Remplacer IDs de test | Modifier `app.json` (androidAppId, iosAppId) avec IDs réels | Google AdMob Console : créer app iOS + Android, créer ad units (banner + interstitial), configurer médiation | Haute | 2-3h |
| 3 | **EAS Build** | Configurer les builds de production | — | Installer EAS CLI (`npm install -g eas-cli`), `eas build:configure`, créer `eas.json` avec profils dev/preview/production | Haute | 3-4h |
| 4 | **Certificats iOS** | Provisioning profiles et certificats | — | Apple Developer : créer App ID, Distribution Certificate, Provisioning Profile (ou laisser EAS gérer automatiquement) | Haute | 2-3h |
| 5 | **Keystore Android** | Générer le keystore de signature | — | EAS gère automatiquement ou générer manuellement via `keytool` | Haute | 1h |
| 6 | **Notifications Push** | Configurer les credentials push | Dashboard OnSpace → Cloud → Secrets (si APNs key nécessaire) | Apple Developer : créer APNs Key (.p8), Google : Firebase Cloud Messaging (optionnel avec Expo) | Moyenne | 2-3h |
| 7 | **Deep Linking prod** | Configurer les associated domains | — | Apple Developer : configurer Associated Domains, héberger `apple-app-site-association` ; Google : Digital Asset Links | Moyenne | 2-3h |
| 8 | **Google Maps API (Carte)** | Configurer la clé API Google Maps pour la carte interactive Android | Ajouter la clé dans `app.json` sous `android.config.googleMaps.apiKey` | Google Cloud Console : activer "Maps SDK for Android" et "Maps SDK for iOS", créer une clé API restreinte par plateforme, ajouter restrictions de bundle/package | Haute | 2-3h |
| 9 | **Tests réels IAP** | Tester les achats in-app | — | App Store Connect : créer In-App Purchase (€5.99), configurer sandbox testers ; Google Play Console : créer produit, licence testing | Haute | 4-6h |
| 10 | **Tests appareils** | Tester sur iOS et Android physiques | Télécharger APK via bouton Download d'OnSpace, utiliser QR code OnSpace App pour iOS | — | Haute | 8-12h |
| 11 | **Performance** | Profiler et optimiser | — | React DevTools, Flipper, analyser bundle size | Basse | 4-6h |
| 12 | **Monitoring** | Configurer Sentry/Crashlytics | Ajouter clé API dans Secrets si nécessaire | Sentry : créer projet, installer `@sentry/react-native` | Moyenne | 3-4h |

### 5.2 Estimation résumée

| Phase | Heures estimées |
|---|---|
| Configuration (OAuth, AdMob, EAS, certificats, carte) | 14-20h |
| Tests sur appareils réels | 8-12h |
| Préparation publication (assets, descriptions, screenshots) | 8-12h |
| Publication App Store + Play Store | 4-8h |
| Bug fixes et polish post-tests | 4-8h |
| **TOTAL** | **38-60h** |

---

## 6. PUBLICATION SUR LES STORES

### 6.1 Publication sur Apple App Store

#### Prérequis

- Compte Apple Developer ($99/an)
- EAS CLI configuré avec credentials Apple
- App Store Connect : app créée avec Bundle ID `com.ultimatepetanque.app`

#### Étapes détaillées

1. **Créer l'app dans App Store Connect**
   - Nom : "Ultimate Petanque"
   - Bundle ID : `com.ultimatepetanque.app`
   - SKU : `ultimatepetanque`
   - Catégorie principale : Sports
   - Catégorie secondaire : Utilities

2. **Configurer les métadonnées**
   - Description (FR + EN, max 4000 caractères)
   - Mots-clés (max 100 caractères)
   - URL de support : `https://ultimatepetanque.app/support`
   - URL de politique de confidentialité (obligatoire)
   - Screenshots (6.7" iPhone 15 Pro Max, 6.1" iPhone 15, 12.9" iPad Pro)
   - App Preview vidéo (optionnel mais recommandé)

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

6. **Review Apple** (délai : 1-3 jours ouvrés)
   - Points de vigilance :
     - L'app doit fonctionner sans connexion (✅ mode offline implémenté)
     - Les IAP doivent utiliser le système Apple (✅ `expo-in-app-purchases`)
     - Le tracking ATT doit être implémenté (✅ `expo-tracking-transparency`)
     - Les liens vers des systèmes de paiement externes sont interdits

#### Estimation : 4-6h (hors délai de review)

### 6.2 Publication sur Google Play Store

#### Prérequis

- Compte Google Play Developer ($25 one-time)
- EAS CLI configuré
- Google Play Console : app créée

#### Étapes détaillées

1. **Créer l'app dans Google Play Console**
   - Nom : "Ultimate Petanque"
   - Package : `com.ultimatepetanque.app`
   - Catégorie : Sports
   - Type de contenu : Tout public

2. **Store Listing**
   - Titre court (30 caractères) + Description complète (4000 caractères)
   - Icône (512×512 PNG)
   - Feature Graphic (1024×500 PNG)
   - Screenshots (min 2, phone + tablet recommandé)
   - Politique de confidentialité URL

3. **Configurer les produits in-app**
   - Google Play Console → Monetize → Products → In-app products
   - Produit : `remove_ads` — €5.99

4. **Data Safety**
   - Remplir la déclaration de sécurité des données
   - Types de données : email, localisation approximative, données d'utilisation

5. **Build et soumission**
   ```bash
   eas build --platform android --profile production
   eas submit --platform android
   ```

6. **Review Google** (délai : heures à 7 jours)
   - Points de vigilance :
     - Target API level doit être récent (≥34)
     - Permissions sensibles (localisation, caméra) doivent être justifiées
     - Les edge-to-edge adaptations Android 15+ (✅ `edgeToEdgeEnabled: true`)

#### Estimation : 3-5h (hors délai de review)

---

## 7. ESTIMATION GLOBALE

### 7.1 Répartition par type de tâche

| Catégorie | Heures |
|---|---|
| Configuration infrastructure (OAuth, AdMob, EAS, certificats, push, carte) | 14-20h |
| Tests complets sur appareils | 8-12h |
| Préparation assets stores (screenshots, descriptions, vidéo) | 8-12h |
| Publication et soumission (iOS + Android) | 4-8h |
| Bug fixes et polish post-tests | 4-8h |
| **TOTAL ESTIMÉ** | **38-60h** |

### 7.2 Calendrier suggéré

| Semaine | Activité |
|---|---|
| S1 | Configuration EAS, certificats, OAuth Google, AdMob production, Google Maps API |
| S2 | Tests IAP sandbox, tests appareils (iOS + Android) |
| S3 | Bug fixes, préparation assets stores, screenshots |
| S4 | Soumission iOS + Android, monitoring post-launch |

### 7.3 Niveau de difficulté global

**Moyen** — L'application est fonctionnellement très complète (30+ features majeures). Le code est bien structuré (services extraits, tests en place, i18n complet). Le travail restant est principalement de la **configuration d'infrastructure** et du **polish pour production**. Aucun développement de fonctionnalité majeure n'est requis.

---

## 8. RECOMMANDATIONS TECHNIQUES

### 8.1 Améliorations prioritaires

1. **Monitoring en production** : Sentry est intégré via `services/sentryService.ts` avec initialisation au lancement, capture d'exceptions, breadcrumbs et contexte utilisateur. **Action restante** : configurer le DSN Sentry dans `sentryService.ts` et installer `@sentry/react-native` (`npx expo install @sentry/react-native`).

2. **Rate limiting** : Les Edge Functions `validate-promo-code` (5 req/60s) et `record-purchase` (3 req/60s) disposent maintenant d'un rate limiter en mémoire avec réponses 429 et header `Retry-After`. `record-purchase` détecte aussi les transactions dupliquées (409 Conflict). Pour un rate limiting persistant cross-invocations, envisager une table `rate_limits` en DB.

3. **Validation des données** : Ajouter une validation côté serveur (Edge Functions) pour les données critiques (scores, statistiques). Actuellement, la validation est principalement côté client.

4. **Tests E2E automatisés** : Compléter la suite de tests avec Detox ou Maestro pour des tests E2E sur simulateurs.

### 8.2 Bonnes pratiques déjà en place

- Architecture Data-Logic-UI bien respectée (services → hooks → components)
- RLS activé sur toutes les tables avec politiques séparées par opération/rôle
- Delta sync avec soft deletes pour la synchronisation efficace
- Cache local avec fallback en mode offline
- i18n complet avec 700+ clés FR/EN
- Tests unitaires et d'intégration pour les services critiques

### 8.3 Risques à anticiper

| Risque | Impact | Mitigation |
|---|---|---|
| **Rejet App Store** pour raison de paiement externe | Bloquant | S'assurer que tous les achats passent par Apple IAP ; aucun lien vers des paiements web |
| **Performance sur appareils bas de gamme** | Moyen | Le composant Stats utilise beaucoup de `useMemo` — tester sur Android d'entrée de gamme ; le clustering de la carte est déjà optimisé (MAX_VISIBLE_MARKERS = 200) |
| **Taille du bundle** | Moyen | Le fichier `mockData.ts` contient des données de démonstration volumineuses (50 matchs, 20 joueurs) — s'assurer qu'elles ne sont chargées qu'en fallback (c'est le cas) |
| **Délai de review Apple** | Planification | Prévoir 1-7 jours ouvrés ; soumettre tôt dans la semaine ; préparer les réponses aux questions potentielles de la review team |
| **Google OAuth rejeté** | Fonctionnel | Le système fonctionne déjà sans OAuth (OTP + mot de passe). L'OAuth est un "nice to have" pour la V1 |
| **Coût AdMob faible au lancement** | Business | Le système premium (€5.99) est indépendant des revenus pub. Diversifier les revenus via ambassadeurs/sponsors |

### 8.4 Points d'attention spécifiques

- Les **IDs AdMob dans `app.json`** sont actuellement des IDs de test Google. **Ne pas publier avec ces IDs** — ils ne génèreront aucun revenu.
- Le **scheme de deep linking** (`ultimatepetanque://`) fonctionne mais les **Universal Links iOS** nécessitent un serveur hébergeant `apple-app-site-association`.
- Le **système de notifications push** combine notifications locales (rappels tournois) et notifications serveur via l'Edge Function `send-push` (5 types : événements ambassadeur avec proximité 200km, invitations meetup, changements de classement, partages, rappels). Les préférences utilisateur par type sont respectées côté serveur via `user_preferences.notification_preferences`.
- La **politique de confidentialité** et les **conditions d'utilisation** ont été mises à jour avec les sections sur les notifications push, le monitoring Sentry et la protection rate limiting.
- La **FAQ** inclut désormais 2 nouvelles catégories : "Notifications Push" (4 questions) et "Sécurité & Confidentialité" (2 questions).
- Les **6 Edge Functions** existantes sont déployées avec rate limiting sur les fonctions sensibles (validate-promo-code : 5 req/min, record-purchase : 3 req/min avec détection de transactions dupliquées). Le fichier `validate-receipt` n'est pas référencé dans le projet — vérifier qu'il est fonctionnel ou le retirer.

---

## ANNEXE A — COMMANDES UTILES

```bash
# Développement local
npx expo start

# Build iOS production
eas build --platform ios --profile production

# Build Android APK
eas build --platform android --profile preview

# Soumission stores
eas submit --platform ios
eas submit --platform android

# Lancer les tests
npx jest

# Vérifier les dépendances
npx depcheck
```

## ANNEXE B — VARIABLES D'ENVIRONNEMENT

| Variable | Description | Localisation |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du backend OnSpace Cloud | `.env` (auto-généré) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase | `.env` (auto-généré) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (Edge Functions) | OnSpace Cloud Secrets |
| `SUPABASE_DB_URL` | URL directe PostgreSQL (Edge Functions) | OnSpace Cloud Secrets |

## ANNEXE C — COMPTES DE TEST

Pour tester l'application en développement, créer un compte via l'écran de login avec n'importe quel email valide. Le système OTP enverra un code à 4 chiffres. Mot de passe minimum : 6 caractères.

---

## 9. SUIVI POST-PUBLICATION ET ROADMAP V2

### 9.1 Actions post-publication immédiates (Semaine 1-2)

| # | Action | Description | Priorité |
|---|---|---|---|
| 1 | **Monitoring crashs** | Vérifier quotidiennement Sentry/Crashlytics, corriger les crashs critiques dans les 24h | Critique |
| 2 | **Feedback utilisateurs** | Surveiller les avis App Store/Play Store, répondre sous 48h, identifier les patterns récurrents | Haute |
| 3 | **Métriques de lancement** | Suivre : téléchargements, rétention J1/J7/J30, taux de crash, temps de session moyen | Haute |
| 4 | **Performance API** | Vérifier les temps de réponse Supabase, identifier les requêtes lentes via les logs | Haute |
| 5 | **Hotfix process** | Préparer un profil EAS `hotfix` pour déployer des correctifs urgents rapidement | Moyenne |

### 9.2 Actions post-publication à moyen terme (Mois 1-3)

| # | Action | Description | Priorité |
|---|---|---|---|
| 1 | **ASO (App Store Optimization)** | Optimiser titre, mots-clés, screenshots basé sur les données réelles de recherche | Haute |
| 2 | **Analyse de rétention** | Identifier les points de décrochage (onboarding, première partie, etc.) et optimiser | Haute |
| 3 | **A/B testing store** | Tester différentes icônes, screenshots, descriptions pour améliorer le taux de conversion | Moyenne |
| 4 | **Backup DB** | Mettre en place un export régulier des données critiques (hebdomadaire minimum) | Haute |
| 5 | **Localisation étendue** | Analyser la demande pour d'autres langues (espagnol, italien, portugais — pays de pétanque) | Basse |

### 9.3 Roadmap fonctionnelle V2 (suggestions)

Basé sur l'architecture actuelle et les tendances du marché :

| # | Fonctionnalité V2 | Description | Complexité | Impact utilisateur |
|---|---|---|---|---|
| 1 | **Mode sombre** | Détection système + toggle manuel, palettes complètes light/dark dans un ThemeContext | Moyenne | Élevé (demande fréquente) |
| 2 | **Calendrier événements** | Vue mensuel dans l'onglet Défis de l'annuaire avec pastilles couleur par type d'événement | Moyenne | Moyen |
| 3 | **Export CSV avancé** | Sélection des colonnes à exporter, formatage dates FR/EN, partage via Share API natif | Faible | Moyen |
| 4 | ~~**Notifications push serveur**~~ | **IMPLÉMENTÉ** : Edge Function `send-push` avec 5 triggers, détection de classement, préférences par type | — | — |
| 5 | **Chat entre joueurs** | Messagerie intégrée entre joueurs connectés, canaux par meetup/tournoi | Très élevée | Élevé |
| 6 | **Vidéo replay** | Enregistrement court (15s) des tirs marquants, stockage Supabase Storage | Élevée | Moyen |
| 7 | **Widget iOS/Android** | Widget affichant les prochains matchs/meetups et le classement actuel | Moyenne | Moyen |
| 8 | **Système d'abonnement** | Plan premium mensuel/annuel (au lieu du one-time) avec fonctionnalités exclusives | Moyenne | Business |
| 9 | **Intelligence artificielle** | Analyse prédictive des performances, suggestions d'entraînement personnalisées via OnSpace AI | Élevée | Élevé |
| 10 | **Marketplace sponsors** | Espace pour les marques de boules avec offres spéciales, codes promo, et tracking des conversions | Élevée | Business |

### 9.4 Processus de mise à jour (V1.x → V2)

#### Workflow de release

1. **Brancher** : Créer une branche `release/vX.Y.Z` depuis `main`
2. **Versionner** : Mettre à jour `app.json` (`version` et `buildNumber`/`versionCode`)
3. **Tester** : Build de preview (`eas build --profile preview`), tester sur appareils réels
4. **Builder** : Build de production (`eas build --profile production`)
5. **Soumettre** : `eas submit --platform ios` et `eas submit --platform android`
6. **Documenter** : Rédiger les release notes (changelog) pour chaque store

#### Versioning recommandé

| Type | Format | Exemple | Quand |
|---|---|---|---|
| Patch | `1.0.X` | 1.0.1 → 1.0.2 | Bug fixes, correctifs mineurs |
| Mineur | `1.X.0` | 1.1.0 → 1.2.0 | Nouvelles fonctionnalités, améliorations UX |
| Majeur | `X.0.0` | 1.x → 2.0.0 | Refonte majeure, breaking changes |

#### Over-The-Air Updates (OTA)

Pour les correctifs urgents qui ne modifient pas le code natif :
```bash
# Mise à jour JS sans passer par les stores
eas update --branch production --message "Fix: correction du calcul de stats"
```
⚠️ Les OTA ne peuvent pas modifier `app.json`, les plugins natifs, ou les assets binaires.

#### Checklist avant chaque release

- [ ] Tests unitaires passent (`npx jest`)
- [ ] Test manuel sur iOS (simulateur + appareil réel)
- [ ] Test manuel sur Android (émulateur + appareil réel)
- [ ] Vérifier la taille du bundle (< 50MB recommandé)
- [ ] Mettre à jour les screenshots store si l'UI a changé
- [ ] Rédiger les release notes en FR et EN
- [ ] Incrémenter `buildNumber` (iOS) et `versionCode` (Android)
- [ ] Vérifier que les IDs AdMob sont ceux de production
- [ ] Vérifier que les Edge Functions sont à jour
- [ ] Tester le flux complet : inscription → match → stats → partage

### 9.5 KPIs à surveiller

| KPI | Objectif V1 (3 mois) | Outil de mesure |
|---|---|---|
| Téléchargements | 1000+ | App Store Connect / Google Play Console |
| Rétention J7 | > 30% | Analytics intégrées |
| Rétention J30 | > 15% | Analytics intégrées |
| Taux de crash | < 1% | Sentry |
| Note moyenne store | > 4.0/5 | App Store / Play Store |
| Matchs créés/jour | 50+ | Requête SQL sur table `matches` |
| Taux conversion premium | > 3% | Supabase `user_profiles.is_premium` |
| Ambassadeurs actifs | 5+ | Table `ambassadors` |

---

*Document généré le 23 mars 2026 — Ultimate Petanque v1.0.0*
