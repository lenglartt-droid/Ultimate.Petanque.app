import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Linking,
  Dimensions,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

// ============================================
// FAQ DATA — Structured by real pétanque situations
// ============================================
interface FAQQuestion { id: string; q: string; a: string }
interface FAQCategory { id: string; category: string; icon: string; color: string; description: string; questions: FAQQuestion[] }

function getFaqData(language: string): FAQCategory[] {
  const fr = language === 'fr';
  return [
    {
      id: 'training',
      category: fr ? 'Entrainement' : 'Training',
      icon: 'fitness-center',
      color: '#2563EB',
      description: fr ? 'Ameliorer votre jeu au quotidien' : 'Improve your game daily',
      questions: [
        {
          id: 'tr1',
          q: fr ? 'Comment enregistrer un match d\'entrainement avec mes partenaires ?' : 'How do I record a training match with my partners?',
          a: fr ? 'Depuis l\'accueil, appuyez sur "Match". Selectionnez le mode "Entrainement", choisissez le format (Tete-a-tete, Doublette ou Triplette), ajoutez vos coequipiers et adversaires depuis votre annuaire, puis notez le score mene par mene. Vous pouvez aussi noter les actions detaillees de chaque joueur (tirs, points, carreaux) pour des stats completes.' : 'From home, tap "Match". Select "Training" mode, choose format (Singles, Doubles or Triples), add teammates and opponents from your directory, then record the score end by end. You can also note detailed actions per player (shots, points, carreaux) for complete stats.',
        },
        {
          id: 'tr2',
          q: fr ? 'Comment faire un defi de 10 tirs pour travailler mon tir ?' : 'How do I do a 10-shot challenge to work on my shooting?',
          a: fr ? 'Appuyez sur "Defi" depuis l\'accueil. Choisissez "10 Tirs" (tir classique) ou "10 Tirs Sautee" (tir en sautee/lob). Selectionnez le joueur et ses boules, puis notez chaque tir : reussi, rate, ou carreau. Vous verrez votre taux de reussite en temps reel. Ideal pour mesurer votre progression a l\'entrainement.' : 'Tap "Challenge" from home. Choose "10 Shots" (classic shot) or "10 Lob Shots" (sautee). Select the player and their boules, then record each shot: hit, miss, or carreau. You will see your success rate in real time. Ideal to measure your training progress.',
        },
        {
          id: 'tr3',
          q: fr ? 'Comment utiliser le defi Precision pour travailler mes ateliers ?' : 'How do I use the Precision challenge for workshop drills?',
          a: fr ? 'Le defi "Precision" simule les ateliers de concours. Choisissez parmi 5 ateliers : Boule seule, Derriere le but, Entre 2 boules, Sautee, Tir au but. Pour chaque boule, notez la distance (6-9m) et le resultat (0, 1, 3 ou 5 points). L\'app calcule vos scores par atelier et votre progression au fil des seances.' : 'The "Precision" challenge simulates competition workshops. Choose from 5 workshops: Single ball, Behind the jack, Between 2 balls, Lob, Shot at jack. For each ball, note the distance (6-9m) and result (0, 1, 3 or 5 points). The app calculates your scores per workshop and tracks progression over sessions.',
        },
        {
          id: 'tr4',
          q: fr ? 'Puis-je defier un partenaire en 1 contre 1 ?' : 'Can I challenge a partner in 1v1?',
          a: fr ? 'Oui ! En creant un defi, activez le mode "1 vs 1". Selectionnez votre adversaire, puis chacun realise le defi. L\'app compare automatiquement les resultats avec un graphique radar (taux de reussite, carreaux, regularite) et designe le vainqueur.' : 'Yes! When creating a challenge, enable "1v1" mode. Select your opponent, then each player completes the challenge. The app automatically compares results with a radar chart (success rate, carreaux, consistency) and declares the winner.',
        },
        {
          id: 'tr5',
          q: fr ? 'Comment jouer un Best of 3 (serie de matchs) ?' : 'How do I play a Best of 3 (match series)?',
          a: fr ? 'Lorsque vous creez un match d\'entrainement, activez l\'option "Serie Best of 3". L\'app chainera automatiquement les matchs, comptera les victoires de chaque equipe, et declarera le vainqueur de la serie. Chaque match reste consultable individuellement dans l\'historique.' : 'When creating a training match, enable the "Best of 3 Series" option. The app will automatically chain matches, count each team wins, and declare the series winner. Each match remains individually viewable in history.',
        },
        {
          id: 'tr6',
          q: fr ? 'Comment associer mes boules a un match ou un defi ?' : 'How do I link my boules to a match or challenge?',
          a: fr ? 'Lors de la creation d\'un match ou defi, une option "Boules" permet de selectionner un de vos equipements enregistres. Cela permet ensuite de comparer vos stats par boules : lesquelles vous conviennent le mieux au tir ? Au point ? Les stats par boules se trouvent dans la page Stats > Performance.' : 'When creating a match or challenge, a "Boules" option lets you select one of your registered sets. This then lets you compare stats per boules: which suits you best for shooting? For pointing? Per-boules stats are found in Stats > Performance.',
        },
      ],
    },
    {
      id: 'tournament',
      category: fr ? 'Tournois & Competitions' : 'Tournaments & Competitions',
      icon: 'emoji-events',
      color: '#B45309',
      description: fr ? 'Suivre vos parcours en competition' : 'Track your competition journey',
      questions: [
        {
          id: 'to1',
          q: fr ? 'Comment suivre mon parcours dans un tournoi ?' : 'How do I track my tournament journey?',
          a: fr ? 'Creez un tournoi (Accueil > Tournoi) avec le nom, la date, le lieu, le format et le type (Officiel, Amical, etc.). Ensuite, pour chaque match du tournoi, selectionnez ce tournoi comme contexte. L\'app regroupera automatiquement tous les matchs du tournoi, calculera votre parcours (victoires, points marques/encaisses) et votre resultat final (1er, 2eme, demi-finale...).' : 'Create a tournament (Home > Tournament) with name, date, location, format and type (Official, Friendly, etc.). Then for each match, select this tournament as context. The app will automatically group all tournament matches, calculate your journey (wins, points for/against) and your final result (1st, 2nd, semi-final...).',
        },
        {
          id: 'to2',
          q: fr ? 'Comment noter les phases d\'un tournoi (poules, eliminatoire, finale) ?' : 'How do I record tournament phases (pools, knockout, final)?',
          a: fr ? 'Quand vous creez un match de tournoi, vous pouvez selectionner la phase : Poules, 1/8 de finale, Quart de finale, Demi-finale ou Finale. Cette information est visible dans le detail du match et permet de retrouver facilement vos matchs de phase eliminatoire.' : 'When you create a tournament match, you can select the phase: Pool stage, Round of 16, Quarter-final, Semi-final or Final. This info is visible in match details and makes it easy to find your knockout matches.',
        },
        {
          id: 'to3',
          q: fr ? 'Ou voir mon palmares (historique de tous mes tournois) ?' : 'Where can I see my honors (all tournament history)?',
          a: fr ? 'Depuis le profil, appuyez sur "Palmares". Vous y trouverez tous vos tournois classes par resultat : podiums (1er, 2eme, 3eme), demi-finales, etc. Filtrez par periode, format ou type pour analyser votre progression en competition.' : 'From your profile, tap "Honors". You will find all your tournaments sorted by result: podiums (1st, 2nd, 3rd), semi-finals, etc. Filter by period, format or type to analyze your competition progress.',
        },
        {
          id: 'to4',
          q: fr ? 'Comment noter les frais d\'inscription et les gains d\'un tournoi ?' : 'How do I record entry fees and tournament winnings?',
          a: fr ? 'Dans la fiche du tournoi, vous pouvez renseigner le "Cout d\'inscription" et le "Gain obtenu". Ces donnees sont compilees dans la page "Bilan financier" (accessible depuis le profil), qui affiche votre rentabilite : total depense, total gagne, et solde net sur la saison.' : 'In the tournament form, you can enter the "Registration cost" and "Prize won". This data is compiled in the "Financial report" page (accessible from profile), showing your profitability: total spent, total won, and net balance for the season.',
        },
      ],
    },
    {
      id: 'travel',
      category: fr ? 'Deplacements & Carte' : 'Travel & Map',
      icon: 'map',
      color: '#10B981',
      description: fr ? 'Trouver des terrains et joueurs en voyage' : 'Find courts and players while traveling',
      questions: [
        {
          id: 'tv1',
          q: fr ? 'Comment trouver un terrain de petanque quand je suis en deplacement ?' : 'How do I find a petanque court when traveling?',
          a: fr ? 'Ouvrez l\'onglet "Carte". Tous les terrains publics de la communaute sont affiches avec leur type (gravier, sable, bitume, gazon...), leurs equipements (eclairage, couvert) et leur acces (public ou club prive). Zoomez sur la zone ou vous etes pour voir les terrains a proximite. Appuyez sur un marqueur pour voir les details et l\'ajouter a votre annuaire.' : 'Open the "Map" tab. All public community courts are displayed with their type (gravel, sand, asphalt, grass...), facilities (lighting, covered) and access (public or private club). Zoom to your area to see nearby courts. Tap a marker to see details and add it to your directory.',
        },
        {
          id: 'tv2',
          q: fr ? 'Comment trouver des joueurs ou un club pres de chez moi ?' : 'How do I find players or a club near me?',
          a: fr ? 'Sur la carte, filtrez par "Joueurs" ou "Clubs" pour voir les joueurs inscrits et clubs actifs autour de vous. Les joueurs publics affichent leur role (pointeur, tireur, milieu), leur niveau et leur club. Vous pouvez les inviter directement a un RDV ou les ajouter a votre annuaire.' : 'On the map, filter by "Players" or "Clubs" to see registered players and active clubs around you. Public players show their role (pointer, shooter, middle), level and club. You can invite them directly to a meetup or add them to your directory.',
        },
        {
          id: 'tv3',
          q: fr ? 'Comment rendre mon profil ou mon terrain visible sur la carte ?' : 'How do I make my profile or court visible on the map?',
          a: fr ? 'Appuyez sur l\'icone "Globe" en haut de la carte pour acceder au panneau de gestion. Activez/desactivez la visibilite publique de votre profil joueur, vos clubs et terrains. Attention : seuls les elements avec une localisation GPS apparaitront sur la carte. Si un element n\'est pas geolocalisee, l\'app vous proposera de le localiser.' : 'Tap the "Globe" icon at the top of the map to access the management panel. Enable/disable public visibility for your player profile, clubs and courts. Note: only items with GPS location will appear on the map. If an item is not geolocated, the app will offer to locate it.',
        },
        {
          id: 'tv4',
          q: fr ? 'Comment voir le classement des joueurs dans ma zone ?' : 'How do I see the player ranking in my area?',
          a: fr ? 'Deux options : (1) Sur la carte, appuyez sur "Classement par zone" dans le panneau inferieur pour acceder au classement de la ville visible. (2) Dans le classement communautaire (accueil ou page complete), utilisez le filtre geographique (globe) pour choisir entre Monde, Continent, Pays ou Ville.' : 'Two options: (1) On the map, tap "Zone Leaderboard" in the bottom panel to see the ranking for the visible city. (2) In the community leaderboard (home or full page), use the geographic filter (globe) to choose between World, Continent, Country or City.',
        },
      ],
    },
    {
      id: 'stats_analysis',
      category: fr ? 'Stats & Analyse' : 'Stats & Analysis',
      icon: 'bar-chart',
      color: '#7C3AED',
      description: fr ? 'Comprendre vos forces et faiblesses' : 'Understand your strengths and weaknesses',
      questions: [
        {
          id: 'sa1',
          q: fr ? 'Comment voir mon taux de reussite au tir par type de technique ?' : 'How do I see my shot success rate by technique type?',
          a: fr ? 'Allez dans Stats > Tir. Vous verrez le detail par technique : tir tendu (au fer), tir en cloche (au plomb), en rafle, court-ramasse. Chaque technique affiche le nombre de tentatives, le taux de reussite, et un tableau croise avec l\'impact (gain de point, decisif, sans effet, negatif). Utilisez ces donnees pour savoir quel type de tir travailler en priorite.' : 'Go to Stats > Shot. You will see the breakdown by technique: flat shot (au fer), lob shot (au plomb), running shot (en rafle), pick-up. Each technique shows attempts, success rate, and a cross-reference table with impact (point gained, decisive, neutral, negative). Use this data to know which shot type to practice first.',
        },
        {
          id: 'sa2',
          q: fr ? 'Comment comparer mes performances sur differents terrains ?' : 'How do I compare my performance on different courts?',
          a: fr ? 'Dans chaque categorie de stats (Performance, Tir, Point, Erreurs), un tableau "Stats par terrain" affiche vos resultats ventiles par type de surface. Vous pouvez aussi filtrer les stats par un terrain specifique via le filtre "Terrain" en haut de la page Stats.' : 'In each stats category (Performance, Shot, Point, Errors), a "Stats by terrain" table shows your results broken down by surface type. You can also filter stats for a specific court via the "Terrain" filter at the top of the Stats page.',
        },
        {
          id: 'sa3',
          q: fr ? 'Que signifient les tendances du bilan hebdomadaire ?' : 'What do the weekly summary trends mean?',
          a: fr ? 'Le bilan hebdomadaire compare votre semaine en cours avec la precedente. La fleche verte signifie amelioration, rouge signifie regression. Il affiche aussi un sparkline avec vos sessions quotidiennes (matchs en bleu, defis en jaune). Appuyez sur "Voir les stats completes" pour acceder directement a la page Stats avec le filtre "semaine" pre-selectionne.' : 'The weekly summary compares your current week with the previous one. Green arrow means improvement, red means regression. It also shows a sparkline with your daily sessions (matches in blue, challenges in yellow). Tap "View complete stats" to access the Stats page directly with the "week" filter pre-selected.',
        },
        {
          id: 'sa4',
          q: fr ? 'Comment analyser mes erreurs pour progresser ?' : 'How do I analyze my errors to improve?',
          a: fr ? 'Stats > Erreurs offre une analyse detaillee : erreurs par duree de match (fatigue), par format, entrainement vs tournoi, erreurs consecutives. Pour le tir, l\'app identifie si vous manquez court/droite, court/gauche, long ou au bouchon. Chaque type d\'erreur est accompagne d\'un conseil technique (cause probable et exercice correctif).' : 'Stats > Errors offers detailed analysis: errors by match duration (fatigue), format, training vs tournament, consecutive errors. For shots, the app identifies if you miss short/right, short/left, long or at the jack. Each error type comes with a coaching tip (probable cause and corrective exercise).',
        },
        {
          id: 'sa5',
          q: fr ? 'Comment voir ma progression sur plusieurs mois ?' : 'How do I see my progression over several months?',
          a: fr ? 'Appuyez sur le bouton "Progression" en haut de la page Stats. Choisissez la periode (4 semaines a 25 ans). Des graphiques interactifs montrent l\'evolution de votre taux de victoire, tir, point et carreaux semaine par semaine. Appuyez sur un point du graphique pour voir le detail de cette semaine.' : 'Tap the "Progression" button at the top of the Stats page. Choose the period (4 weeks to 25 years). Interactive charts show the evolution of your win rate, shot, point and carreau rates week by week. Tap a chart point to see that week details.',
        },
      ],
    },
    {
      id: 'social',
      category: fr ? 'Rendez-vous & Partage' : 'Meetups & Sharing',
      icon: 'people',
      color: '#0369A1',
      description: fr ? 'Organiser et partager avec la communaute' : 'Organize and share with the community',
      questions: [
        {
          id: 'so1',
          q: fr ? 'Comment organiser un RDV petanque avec mes amis ?' : 'How do I organize a petanque meetup with friends?',
          a: fr ? 'Depuis "A Venir" sur l\'accueil, appuyez sur "+ RDV". Choisissez le terrain, la date/heure, le nombre max de participants. Un code unique est genere (ex: RDV-ABC123). Partagez-le ou scannez le QR code pour que vos amis rejoignent le RDV. Vous pouvez aussi inviter des joueurs directement depuis l\'annuaire.' : 'From "Upcoming" on home, tap "+ Meetup". Choose the court, date/time, max participants. A unique code is generated (e.g. RDV-ABC123). Share it or scan the QR code for friends to join. You can also invite players directly from the directory.',
        },
        {
          id: 'so2',
          q: fr ? 'Comment rejoindre le RDV d\'un autre joueur ?' : 'How do I join another player meetup?',
          a: fr ? 'Trois methodes : (1) Entrez le code du RDV dans le champ "Code du RDV" visible dans la section "A Venir" de l\'accueil. (2) Scannez le QR code du RDV avec le scanner (icone en haut de l\'accueil). (3) Acceptez une invitation recue dans vos notifications.' : 'Three methods: (1) Enter the meetup code in the "Meetup Code" field visible in the "Upcoming" section on home. (2) Scan the meetup QR code with the scanner (icon at top of home). (3) Accept an invitation received in your notifications.',
        },
        {
          id: 'so3',
          q: fr ? 'Comment partager un match ou un defi avec mon partenaire ?' : 'How do I share a match or challenge with my partner?',
          a: fr ? 'Ouvrez le detail d\'un match ou defi dans l\'historique, puis appuyez sur "Partager avec les joueurs". Selectionnez les joueurs participants et choisissez le droit d\'acces : lecture seule ou modification. Ils recevront une notification push. Lorsqu\'ils acceptent, la partie apparait automatiquement dans leur historique et leurs statistiques sont mises a jour en temps reel (taux de victoire, tir, point, carreaux). Cela fonctionne pour tous les types de parties : match d\'entrainement, match de tournoi, Best of 3, et defi en 1 contre 1.' : 'Open a match or challenge detail in history, then tap "Share with players". Select participating players and choose access: read only or edit. They will receive a push notification. When they accept, the match automatically appears in their history and their statistics are updated in real time (win rate, shot, point, carreau). This works for all match types: training match, tournament match, Best of 3, and 1v1 challenge.',
        },
        {
          id: 'so3b',
          q: fr ? 'Que se passe-t-il quand je modifie un match partage ?' : 'What happens when I edit a shared match?',
          a: fr ? 'Si vous avez le droit de modification, vos changements sont appliques en temps reel et visibles par tous les joueurs partageant cette partie. L\'app detecte automatiquement les conflits : si deux joueurs modifient en meme temps, une fenetre de resolution de conflit apparait pour choisir quelle version garder (la votre ou celle du serveur). Toutes les modifications sont tracees dans un historique visible par le proprietaire (champs modifies, par qui, quand), et peuvent etre annulees dans les 24 heures.' : 'If you have edit permission, your changes are applied in real time and visible to all players sharing this match. The app automatically detects conflicts: if two players edit at the same time, a conflict resolution window appears to choose which version to keep (yours or the server). All modifications are tracked in a history visible to the owner (fields changed, by whom, when), and can be reverted within 24 hours.',
        },
        {
          id: 'so4',
          q: fr ? 'Comment fonctionne le partage QR code de mon profil ?' : 'How does QR code profile sharing work?',
          a: fr ? 'Appuyez sur l\'icone QR en haut de l\'accueil pour afficher votre QR code personnel. Les autres joueurs peuvent le scanner pour voir votre profil, vos stats et votre palmares. C\'est ideal pour echanger vos profils lors d\'un tournoi ou d\'une rencontre.' : 'Tap the QR icon at the top of home to show your personal QR code. Other players can scan it to see your profile, stats and honors. Ideal for exchanging profiles at a tournament or meetup.',
        },
      ],
    },
    {
      id: 'equipment_boules',
      category: fr ? 'Equipement & Boules' : 'Equipment & Boules',
      icon: 'sports-baseball',
      color: '#D97706',
      description: fr ? 'Gerer et comparer vos jeux de boules' : 'Manage and compare your boules sets',
      questions: [
        {
          id: 'eq1',
          q: fr ? 'Pourquoi enregistrer mes boules dans l\'app ?' : 'Why should I register my boules in the app?',
          a: fr ? 'En associant vos boules a chaque match et defi, l\'app calcule automatiquement vos stats par equipement : taux de victoire, tir, point, carreau. Vous pouvez comparer visuellement vos boules (graphique comparatif dans Stats > Performance) pour savoir lesquelles vous conviennent le mieux selon votre role et le terrain.' : 'By linking your boules to each match and challenge, the app automatically calculates per-equipment stats: win rate, shot, point, carreau. You can visually compare your boules (comparison chart in Stats > Performance) to know which suits you best for your role and court type.',
        },
        {
          id: 'eq2',
          q: fr ? 'Comment ajouter ou modifier mes boules ?' : 'How do I add or edit my boules?',
          a: fr ? 'Depuis le profil, appuyez sur "Equipement". Ajoutez vos boules avec le nom, la marque, le diametre, le poids, la durete et le numero de serie. Vous pouvez aussi ajouter une photo et le prix d\'achat. Definissez un equipement comme "principal" pour qu\'il soit pre-selectionne lors de la creation de matchs.' : 'From your profile, tap "Equipment". Add your boules with name, brand, diameter, weight, hardness and serial number. You can also add a photo and purchase price. Set one as "primary" for it to be pre-selected when creating matches.',
        },
        {
          id: 'eq3',
          q: fr ? 'Comment voir le classement des boules par marque ?' : 'How do I see the boules ranking by brand?',
          a: fr ? 'Le classement communautaire (page Classement > onglet Boules) compile les stats de tous les joueurs publics par marque et modele. Vous verrez les taux moyens de victoire, tir, carreau, et la popularite de chaque marque. Filtrez par role (tireur, pointeur, milieu) pour des comparaisons pertinentes.' : 'The community leaderboard (Leaderboard page > Boules tab) compiles stats from all public players by brand and model. You will see average win, shot, carreau rates and each brand popularity. Filter by role (shooter, pointer, middle) for relevant comparisons.',
        },
      ],
    },
    {
      id: 'events_ambassadors',
      category: fr ? 'Evenements & Ambassadeurs' : 'Events & Ambassadors',
      icon: 'campaign',
      color: '#7C3AED',
      description: fr ? 'Participer aux defis officiels' : 'Participate in official challenges',
      questions: [
        {
          id: 'ev1',
          q: fr ? 'Comment participer a un evenement sponsorise par un ambassadeur ?' : 'How do I participate in an ambassador-sponsored event?',
          a: fr ? 'Depuis la section "A Venir" sur l\'accueil ou la page "Defis", rejoignez un evenement via son code ou la liste publique. Chaque evenement est organise par un ambassadeur (joueur reconnu), avec une date/heure precise, un type de defi et un nombre maximum de participants. Realisez votre defi pendant le creneau prevu.' : 'From the "Upcoming" section on home or the "Challenges" page, join an event via its code or the public list. Each event is organized by an ambassador (recognized player), with a specific date/time, challenge type and max participants. Complete your challenge during the scheduled slot.',
        },
        {
          id: 'ev2',
          q: fr ? 'Comment fonctionne l\'attestation par temoins ?' : 'How does witness attestation work?',
          a: fr ? 'Apres avoir realise votre defi, d\'autres participants presents sur le terrain attestent de vos resultats. Chaque evenement demande un nombre minimum de temoins (generalement 2). Les attestations renforcent la fiabilite du classement et de votre score de confiance. Vous recevez une alerte sur l\'accueil quand quelqu\'un vous demande d\'attester.' : 'After completing your challenge, other participants present on the court attest your results. Each event requires a minimum number of witnesses (usually 2). Attestations strengthen ranking reliability and your trust score. You receive an alert on home when someone asks you to attest.',
        },
        {
          id: 'ev3',
          q: fr ? 'Qu\'est-ce que le programme ambassadeur ?' : 'What is the ambassador program?',
          a: fr ? 'Les ambassadeurs sont des joueurs reconnus qui organisent des evenements et representent la communaute. Leur profil affiche un badge verifie. Ils apparaissent sur le carrousel de l\'accueil avec leurs reseaux sociaux. Vous pouvez consulter leur profil, voir leurs evenements et suivre leur parcours.' : 'Ambassadors are recognized players who organize events and represent the community. Their profile shows a verified badge. They appear on the home carousel with their social media. You can view their profile, see their events and follow their journey.',
        },
      ],
    },
    {
      id: 'ranking_trust',
      category: fr ? 'Classement & Score de Confiance' : 'Ranking & Trust Score',
      icon: 'leaderboard',
      color: '#D97706',
      description: fr ? 'Votre place dans la communaute' : 'Your place in the community',
      questions: [
        {
          id: 'rt1',
          q: fr ? 'Comment apparaitre dans le classement communautaire ?' : 'How do I appear in the community leaderboard?',
          a: fr ? 'Deux conditions : (1) Activez votre profil public (Carte > Globe > Activer le profil). (2) Jouez au minimum 3 matchs publics. Votre classement est calcule sur le taux de victoire, et peut etre filtre par zone geographique (monde, continent, pays, ville), periode, et d\'autres criteres.' : 'Two conditions: (1) Enable your public profile (Map > Globe > Enable profile). (2) Play at least 3 public matches. Your ranking is based on win rate, and can be filtered by geographic zone (world, continent, country, city), period, and other criteria.',
        },
        {
          id: 'rt2',
          q: fr ? 'Comment fonctionne le classement hebdomadaire ?' : 'How does the weekly leaderboard work?',
          a: fr ? 'Chaque lundi, le classement hebdomadaire est reinitialise. Il compte uniquement les matchs joues dans la semaine en cours. Vous devez avoir joue au moins 2 matchs. Une banniere bleue sur l\'accueil affiche votre rang et son evolution (monte, descente, nouveau). Le classement complet est accessible depuis l\'accueil ou la page Classement.' : 'Every Monday, the weekly leaderboard resets. It counts only matches played in the current week. You need at least 2 matches. A blue banner on home shows your rank and evolution (up, down, new). The full leaderboard is accessible from home or the Leaderboard page.',
        },
        {
          id: 'rt3',
          q: fr ? 'Qu\'est-ce que le score de confiance et comment l\'ameliorer ?' : 'What is the trust score and how to improve it?',
          a: fr ? 'Le score de confiance (0-100) mesure la fiabilite de vos donnees. Il augmente avec : un profil complet, des matchs reguliers, des temoignages recus, un compte verifie, des stats coherentes. Il diminue en cas d\'inactivite prolongee, de stats aberrantes, ou de signalements. Un score eleve (80+) affiche le badge "Verifie" dans les classements.' : 'The trust score (0-100) measures your data reliability. It increases with: a complete profile, regular matches, received attestations, verified account, consistent stats. It decreases with prolonged inactivity, abnormal stats, or reports. A high score (80+) shows the "Verified" badge in rankings.',
        },
        {
          id: 'rt4',
          q: fr ? 'Comment voir le classement des clubs ou des boules ?' : 'How do I see the club or boules ranking?',
          a: fr ? 'Page Classement > onglet Clubs ou Boules. Le classement des clubs agregge les stats de leurs membres (taux de victoire moyen, tir, carreau, nombre de matchs). Le classement Boules compare les marques/modeles par stats moyennes des utilisateurs. Vous pouvez aussi voir le classement par evenements sponsorises.' : 'Leaderboard page > Clubs or Boules tab. Club ranking aggregates member stats (average win rate, shot, carreau, match count). Boules ranking compares brands/models by average user stats. You can also see the sponsored events ranking.',
        },
      ],
    },
    {
      id: 'directory_management',
      category: fr ? 'Annuaire & Gestion' : 'Directory & Management',
      icon: 'folder',
      color: '#6366F1',
      description: fr ? 'Organiser joueurs, clubs et terrains' : 'Organize players, clubs and courts',
      questions: [
        {
          id: 'dm1',
          q: fr ? 'Comment gerer les doublons dans mon annuaire ?' : 'How do I manage duplicates in my directory?',
          a: fr ? 'L\'app detecte automatiquement les doublons potentiels (joueurs, clubs, terrains avec noms similaires). Une banniere jaune apparait dans l\'annuaire. Appuyez dessus pour voir les paires detectees. Pour les doublons a 90%+, un bouton "Fusion rapide" fusionne automatiquement en gardant les meilleures infos. Sinon, utilisez "Fusionner" pour choisir champ par champ. Les fusions sont reversibles pendant 24h.' : 'The app automatically detects potential duplicates (players, clubs, courts with similar names). A yellow banner appears in the directory. Tap it to see detected pairs. For 90%+ duplicates, a "Quick Merge" button automatically merges keeping the best info. Otherwise, use "Merge" to choose field by field. Merges are reversible for 24 hours.',
        },
        {
          id: 'dm2',
          q: fr ? 'Comment exporter mes donnees (matchs, stats, joueurs) ?' : 'How do I export my data (matches, stats, players)?',
          a: fr ? 'Depuis le profil > Exporter les donnees. Choisissez le format (CSV ou JSON) et les donnees a exporter : matchs, defis, joueurs, clubs, terrains, tournois. Le fichier CSV est compatible avec Excel et Google Sheets pour des analyses personnalisees.' : 'From profile > Export data. Choose the format (CSV or JSON) and data to export: matches, challenges, players, clubs, courts, tournaments. The CSV file is compatible with Excel and Google Sheets for custom analysis.',
        },
        {
          id: 'dm3',
          q: fr ? 'Comment supprimer mon compte et mes donnees ?' : 'How do I delete my account and data?',
          a: fr ? 'Depuis le profil > Mot de passe et securite > Supprimer mon compte. Cette action est irreversible : toutes vos donnees (matchs, defis, joueurs, tournois, stats, partages) seront definitivement supprimees. Les elements partages avec d\'autres joueurs seront egalement retires de leur vue.' : 'From profile > Password and security > Delete my account. This action is irreversible: all your data (matches, challenges, players, tournaments, stats, shares) will be permanently deleted. Items shared with other players will also be removed from their view.',
        },
      ],
    },
    {
      id: 'account_settings',
      category: fr ? 'Compte & Parametres' : 'Account & Settings',
      icon: 'settings',
      color: '#64748B',
      description: fr ? 'Gerer votre profil et preferences' : 'Manage your profile and preferences',
      questions: [
        {
          id: 'as1',
          q: fr ? 'Comment changer la langue de l\'application ?' : 'How do I change the app language?',
          a: fr ? 'Depuis le profil, appuyez sur le drapeau (FR/EN) en haut a droite. L\'application est entierement disponible en francais et en anglais. Le changement est instantane et affecte toutes les pages.' : 'From your profile, tap the flag (FR/EN) at the top right. The app is fully available in French and English. The change is instant and affects all pages.',
        },
        {
          id: 'as2',
          q: fr ? 'Comment gerer mes notifications ?' : 'How do I manage my notifications?',
          a: fr ? 'Depuis le profil > Preferences de notifications. Activez/desactivez individuellement : invitations a des RDV, demandes de partage, evenements sponsorises, changements de classement, rappels d\'evenements. Les notifications push sont envoyees pour les actions les plus importantes.' : 'From profile > Notification preferences. Enable/disable individually: meetup invitations, share requests, sponsored events, ranking changes, event reminders. Push notifications are sent for the most important actions.',
        },
        {
          id: 'as3',
          q: fr ? 'Comment fonctionne la suppression des publicites ?' : 'How does ad removal work?',
          a: fr ? 'L\'achat "Supprimer les pubs" est un achat unique qui retire toutes les bannieres publicitaires de l\'application. Accessible depuis le profil > Supprimer les publicites. L\'achat est lie a votre compte Apple/Google et peut etre restaure sur un autre appareil.' : 'The "Remove ads" purchase is a one-time purchase that removes all ad banners from the app. Accessible from profile > Remove ads. The purchase is linked to your Apple/Google account and can be restored on another device.',
        },
        {
          id: 'as4',
          q: fr ? 'Comment utiliser le scanner QR ?' : 'How do I use the QR scanner?',
          a: fr ? 'Appuyez sur l\'icone scanner en haut de l\'accueil. Le scanner detecte automatiquement le type de QR code : profil joueur, RDV, terrain, evenement sponsorise. Pointez la camera vers un QR code et l\'app vous redirige instantanement vers la bonne page.' : 'Tap the scanner icon at the top of home. The scanner automatically detects the QR code type: player profile, meetup, court, sponsored event. Point the camera at a QR code and the app instantly redirects to the right page.',
        },
      ],
    },
  ];
}

// Quick Actions — contextualized for pétanque situations
function getQuickActions(language: string) {
  const fr = language === 'fr';
  return [
    { id: 'match', title: fr ? 'Enregistrer un match' : 'Record a match', icon: 'sports', color: '#2563EB', route: '/match/new',
      steps: fr ? ['Choisissez Entrainement ou Tournoi|Selectionnez le format (Tete-a-tete, Doublette, Triplette)|Ajoutez joueurs et adversaires|Notez le score mene par mene|Optionnel : actions detaillees par joueur'] : ['Choose Training or Tournament|Select format (Singles, Doubles, Triples)|Add players and opponents|Record score end by end|Optional: detailed actions per player'] },
    { id: 'challenge', title: fr ? 'Lancer un defi' : 'Start a challenge', icon: 'track-changes', color: '#D97706', route: '/challenge/new',
      steps: fr ? ['Choisissez 10 Tirs, Sautee ou Precision|Selectionnez le joueur et ses boules|Notez chaque tir (reussi, rate, carreau)|Mode 1v1 : defier un adversaire|Resultats et comparaison instantanes'] : ['Choose 10 Shots, Lob or Precision|Select player and their boules|Record each shot (hit, miss, carreau)|1v1 mode: challenge an opponent|Instant results and comparison'] },
    { id: 'meetup', title: fr ? 'Organiser un RDV' : 'Organize a meetup', icon: 'event', color: '#0369A1', route: '/meetup/new',
      steps: fr ? ['Choisissez le terrain et la date|Definissez le nombre max de participants|Partagez le code ou le QR|Invitez directement depuis l\'annuaire|Suivez les confirmations en temps reel'] : ['Choose court and date|Set max participants|Share code or QR|Invite directly from directory|Track confirmations in real time'] },
    { id: 'tournament', title: fr ? 'Suivre un tournoi' : 'Track a tournament', icon: 'emoji-events', color: '#B45309', route: '/tournament/new',
      steps: fr ? ['Creez le tournoi avec nom et lieu|Enregistrez chaque match du parcours|L\'app compile automatiquement votre bilan|Notez votre resultat final (1er, 2e...)|Retrouvez tout dans votre palmares'] : ['Create tournament with name and location|Record each match of your journey|App automatically compiles your record|Note your final result (1st, 2nd...)|Find everything in your honors'] },
  ];
}

// Pro Tips
function getTips(language: string) {
  const fr = language === 'fr';
  return [
    { icon: 'lightbulb', text: fr ? 'Associez toujours vos boules aux matchs pour comparer vos stats par equipement.' : 'Always link your boules to matches to compare stats per equipment.', color: '#D97706' },
    { icon: 'timer', text: fr ? 'Faites un defi de 10 tirs avant chaque entrainement pour mesurer votre "temperature" du jour.' : 'Do a 10-shot challenge before each training to measure your daily "temperature".', color: '#2563EB' },
    { icon: 'trending-up', text: fr ? 'Consultez la page Erreurs apres un tournoi : elle revele vos points faibles sous pression.' : 'Check the Errors page after a tournament: it reveals your weak points under pressure.', color: '#EF4444' },
    { icon: 'event', text: fr ? 'Creez un RDV hebdomadaire pour vos entrainements reguliers : les joueurs s\'inscrivent seuls.' : 'Create a weekly meetup for regular training: players sign up on their own.', color: '#0369A1' },
    { icon: 'public', text: fr ? 'Activez votre profil public pour apparaitre sur la carte et dans les classements.' : 'Enable your public profile to appear on the map and in rankings.', color: '#10B981' },
    { icon: 'bar-chart', text: fr ? 'Filtrez vos stats par adversaire pour preparer un match contre un joueur specifique.' : 'Filter your stats by opponent to prepare a match against a specific player.', color: '#7C3AED' },
    { icon: 'sports-baseball', text: fr ? 'En tournoi, notez le terrain : vos stats par type de surface vous aideront a adapter votre jeu.' : 'In tournaments, note the court: your stats per surface type will help adapt your game.', color: '#B45309' },
    { icon: 'group', text: fr ? 'Partagez vos matchs avec vos partenaires : leurs stats se mettent a jour automatiquement a l\'acceptation.' : 'Share your matches with your partners: their stats update automatically upon acceptance.', color: '#2563EB' },
    { icon: 'savings', text: fr ? 'Renseignez les frais d\'inscription et gains de tournois pour suivre votre bilan financier annuel.' : 'Enter tournament fees and winnings to track your annual financial balance.', color: '#10B981' },
  ];
}

// ============================================
// COMPONENTS
// ============================================
function AccordionItem({ question, answer, isOpen, onToggle, color }: {
  question: string; answer: string; isOpen: boolean; onToggle: () => void; color: string;
}) {
  const rotation = useSharedValue(0);
  React.useEffect(() => { rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 }); }, [isOpen]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Pressable style={[st.faqItem, isOpen && { borderLeftWidth: 3, borderLeftColor: color }]} onPress={() => { Haptics.selectionAsync(); onToggle(); }}>
      <View style={st.faqQuestion}>
        <Text style={[st.faqQuestionText, isOpen && { color }]}>{question}</Text>
        <Animated.View style={[iconStyle, st.faqChevron]}>
          <MaterialIcons name="expand-more" size={22} color={isOpen ? color : theme.textMuted} />
        </Animated.View>
      </View>
      {isOpen ? <View style={st.faqAnswerContainer}><Text style={st.faqAnswerText}>{answer}</Text></View> : null}
    </Pressable>
  );
}

function QuickActionCard({ action, language }: { action: ReturnType<typeof getQuickActions>[0]; language: string }) {
  const [expanded, setExpanded] = useState(false);
  const steps = action.steps[0].split('|');
  return (
    <View>
      <Pressable style={[st.qaCard, expanded && { borderColor: action.color + '40', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 }]}
        onPress={() => { Haptics.selectionAsync(); setExpanded(!expanded); }}>
        <View style={[st.qaIcon, { backgroundColor: action.color + '15' }]}>
          <MaterialIcons name={action.icon as any} size={22} color={action.color} />
        </View>
        <Text style={st.qaTitle}>{action.title}</Text>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
      </Pressable>
      {expanded ? (
        <View style={[st.qaSteps, { borderColor: action.color + '40' }]}>
          {steps.map((step: string, i: number) => (
            <View key={i} style={st.qaStep}>
              <View style={[st.qaStepNum, { backgroundColor: action.color }]}><Text style={st.qaStepNumText}>{i + 1}</Text></View>
              <Text style={st.qaStepText}>{step}</Text>
              {i < steps.length - 1 ? <View style={[st.qaStepConnector, { backgroundColor: action.color + '30' }]} /> : null}
            </View>
          ))}
          {action.route ? (
            <Pressable style={[st.qaGoBtn, { backgroundColor: action.color + '12' }]} onPress={() => router.push(action.route as any)}>
              <MaterialIcons name="arrow-forward" size={16} color={action.color} />
              <Text style={[st.qaGoBtnText, { color: action.color }]}>{action.title}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ============================================
// MAIN SCREEN
// ============================================
export default function FAQScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [openQs, setOpenQs] = useState<Set<string>>(new Set());
  const [showAllTips, setShowAllTips] = useState(false);
  const [screenW, setScreenW] = useState(() => Dimensions.get('window').width);
  React.useEffect(() => { const sub = Dimensions.addEventListener('change', ({ window }) => setScreenW(window.width)); return () => sub?.remove(); }, []);
  const isTablet = screenW >= 600;

  const QUICK_ACTIONS = useMemo(() => getQuickActions(language), [language]);
  const FAQ_DATA = useMemo(() => getFaqData(language), [language]);
  const TIPS = useMemo(() => getTips(language), [language]);

  const filtered = useMemo(() => {
    return FAQ_DATA.map(cat => ({
      ...cat,
      questions: cat.questions.filter(q => {
        const ms = !search || q.q.toLowerCase().includes(search.toLowerCase()) || q.a.toLowerCase().includes(search.toLowerCase());
        const mc = !selectedCat || cat.id === selectedCat;
        return ms && mc;
      }),
    })).filter(cat => cat.questions.length > 0);
  }, [search, selectedCat, FAQ_DATA]);

  const toggleQ = useCallback((id: string) => {
    setOpenQs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const totalQs = FAQ_DATA.reduce((sum, cat) => sum + cat.questions.length, 0);
  const isSearching = search.length > 0;
  const totalResults = filtered.reduce((sum, c) => sum + c.questions.length, 0);

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>{language === 'fr' ? 'Aide & Guide' : 'Help & Guide'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={st.scrollView} contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }, isTablet && st.scrollContentTablet]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <LinearGradient colors={['#0F172A', '#1E3A5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
            <View style={st.heroIconWrap}>
              <MaterialIcons name="sports" size={36} color="#60A5FA" />
            </View>
            <Text style={st.heroTitle}>{language === 'fr' ? 'Guide du joueur' : 'Player Guide'}</Text>
            <Text style={st.heroSub}>{totalQs} {language === 'fr' ? 'reponses' : 'answers'} {"\u2022"} {FAQ_DATA.length} {language === 'fr' ? 'themes' : 'topics'}</Text>

            <View style={st.heroSearch}>
              <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput style={st.heroSearchInput} placeholder={language === 'fr' ? 'Rechercher une question...' : 'Search a question...'} placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </Pressable>
              ) : null}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Search result banner */}
        {isSearching ? (
          <View style={st.searchBanner}>
            <MaterialIcons name="search" size={16} color={theme.textMuted} />
            <Text style={st.searchBannerText}>{totalResults} {language === 'fr' ? 'resultat(s) pour' : 'result(s) for'} "{search}"</Text>
            {totalResults === 0 ? (
              <Pressable style={st.searchBannerReset} onPress={() => { setSearch(''); setSelectedCat(null); }}>
                <Text style={st.searchBannerResetText}>{language === 'fr' ? 'Reinitialiser' : 'Reset'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Quick Actions */}
        {!isSearching && !selectedCat ? (
          <Animated.View entering={FadeInDown.duration(300).delay(50)} style={st.section}>
            <View style={st.sectionHeaderRow}>
              <View style={[st.sectionHeaderIcon, { backgroundColor: '#2563EB15' }]}>
                <MaterialIcons name="flash-on" size={16} color="#2563EB" />
              </View>
              <Text style={st.sectionTitle}>{language === 'fr' ? 'Actions rapides' : 'Quick Start'}</Text>
            </View>
            <View style={st.qaGrid}>{QUICK_ACTIONS.map(a => <QuickActionCard key={a.id} action={a} language={language} />)}</View>
          </Animated.View>
        ) : null}

        {/* Category Chips */}
        <View style={st.section}>
          <View style={st.sectionHeaderRow}>
            <View style={[st.sectionHeaderIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="category" size={16} color={theme.primary} />
            </View>
            <Text style={st.sectionTitle}>{language === 'fr' ? 'Themes' : 'Topics'}</Text>
            {selectedCat ? (
              <Pressable style={st.clearBtn} onPress={() => { Haptics.selectionAsync(); setSelectedCat(null); }}>
                <MaterialIcons name="close" size={14} color={theme.primary} />
                <Text style={st.clearBtnText}>{language === 'fr' ? 'Voir tout' : 'See all'}</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.catScroll}>
            {FAQ_DATA.map(cat => {
              const active = selectedCat === cat.id;
              return (
                <Pressable key={cat.id} style={[st.catChip, active && { backgroundColor: cat.color, borderColor: cat.color }]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedCat(active ? null : cat.id); }}>
                  <MaterialIcons name={cat.icon as any} size={14} color={active ? '#FFF' : cat.color} />
                  <Text style={[st.catChipText, active && { color: '#FFF' }]}>{cat.category}</Text>
                  <View style={[st.catChipBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <Text style={[st.catChipBadgeText, active && { color: '#FFF' }]}>{cat.questions.length}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* FAQ Sections */}
        {filtered.length > 0 ? (
          <View style={isTablet ? st.tabletFaqGrid : undefined}>
            {filtered.map(cat => (
              <View key={cat.id} style={[st.catSection, isTablet && st.tabletCatSection]}>
                <View style={st.catSectionHeader}>
                  <View style={[st.catSectionIcon, { backgroundColor: cat.color + '15' }]}>
                    <MaterialIcons name={cat.icon as any} size={20} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.catSectionTitle}>{cat.category}</Text>
                    <Text style={st.catSectionDesc}>{cat.description}</Text>
                  </View>
                  <View style={[st.catSectionCount, { backgroundColor: cat.color + '12' }]}>
                    <Text style={[st.catSectionCountText, { color: cat.color }]}>{cat.questions.length}</Text>
                  </View>
                </View>
                <View style={st.faqList}>
                  {cat.questions.map(q => (
                    <AccordionItem key={q.id} question={q.q} answer={q.a} isOpen={openQs.has(q.id)} onToggle={() => toggleQ(q.id)} color={cat.color} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={st.emptyState}>
            <View style={st.emptyIcon}><MaterialIcons name="search-off" size={48} color={theme.textMuted} /></View>
            <Text style={st.emptyTitle}>{language === 'fr' ? 'Aucun resultat' : 'No results'}</Text>
            <Text style={st.emptyText}>{language === 'fr' ? 'Essayez un autre terme ou changez de categorie.' : 'Try another term or change category.'}</Text>
            <Pressable style={st.emptyBtn} onPress={() => { Haptics.selectionAsync(); setSearch(''); setSelectedCat(null); }}>
              <MaterialIcons name="refresh" size={18} color={theme.primary} />
              <Text style={st.emptyBtnText}>{language === 'fr' ? 'Reinitialiser' : 'Reset'}</Text>
            </Pressable>
          </View>
        )}

        {/* Tips */}
        {!isSearching ? (
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={st.section}>
            <View style={st.sectionHeaderRow}>
              <View style={[st.sectionHeaderIcon, { backgroundColor: '#F59E0B15' }]}>
                <MaterialIcons name="lightbulb" size={16} color="#F59E0B" />
              </View>
              <Text style={st.sectionTitle}>{language === 'fr' ? 'Astuces de joueur' : 'Player Tips'}</Text>
            </View>
            <View style={[st.tipsList, isTablet && st.tipsListTablet]}>
              {(showAllTips ? TIPS : TIPS.slice(0, 4)).map((tip, i) => (
                <View key={i} style={[st.tipCard, isTablet && st.tipCardTablet]}>
                  <View style={[st.tipIcon, { backgroundColor: tip.color + '15' }]}>
                    <MaterialIcons name={tip.icon as any} size={18} color={tip.color} />
                  </View>
                  <Text style={st.tipText}>{tip.text}</Text>
                </View>
              ))}
            </View>
            {!showAllTips && TIPS.length > 4 ? (
              <Pressable style={st.showMoreBtn} onPress={() => { Haptics.selectionAsync(); setShowAllTips(true); }}>
                <Text style={st.showMoreText}>{language === 'fr' ? 'Voir toutes les astuces' : 'See all tips'} (+{TIPS.length - 4})</Text>
                <MaterialIcons name="expand-more" size={18} color={theme.primary} />
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Contact */}
        <View style={st.contactCard}>
          <LinearGradient colors={[theme.primary + '08', theme.primary + '03']} style={st.contactInner}>
            <View style={st.contactIconWrap}>
              <MaterialIcons name="forum" size={28} color={theme.primary} />
            </View>
            <Text style={st.contactTitle}>{language === 'fr' ? 'Besoin d\'aide ?' : 'Need help?'}</Text>
            <Text style={st.contactSub}>{language === 'fr' ? 'Notre equipe repond sous 24h' : 'Our team responds within 24h'}</Text>

            <Pressable style={st.contactBtn} onPress={() => Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Ultimate%20Petanque%20-%20Aide')}>
              <View style={st.contactBtnIcon}>
                <MaterialIcons name="email" size={22} color={theme.primary} />
              </View>
              <View style={st.contactBtnInfo}>
                <Text style={st.contactBtnTitle}>{language === 'fr' ? 'Envoyer un email' : 'Send an email'}</Text>
                <Text style={st.contactBtnEmail}>ultimate.petanque.app@gmail.com</Text>
              </View>
              <View style={st.contactBtnArrow}>
                <MaterialIcons name="arrow-forward" size={18} color={theme.primary} />
              </View>
            </Pressable>
          </LinearGradient>
        </View>

        <Text style={st.version}>{t('common', 'version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0 },
  scrollContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },
  hero: { borderRadius: 20, padding: 28, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  heroIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(96,165,250,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(96,165,250,0.25)' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },
  heroSearch: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroSearchInput: { flex: 1, fontSize: 15, color: '#FFF', padding: 0 },
  searchBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  searchBannerText: { flex: 1, fontSize: 13, color: theme.textMuted, fontStyle: 'italic' },
  searchBannerReset: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '12', borderRadius: 20 },
  searchBannerResetText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  section: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionHeaderIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.textPrimary, letterSpacing: 0.3 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.primary + '12', borderRadius: 20 },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  qaGrid: { gap: 8 },
  qaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1.5, borderColor: theme.border },
  qaIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qaTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  qaSteps: { backgroundColor: theme.surface, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, borderWidth: 1.5, borderTopWidth: 0 },
  qaStep: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, position: 'relative' as const },
  qaStepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  qaStepNumText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  qaStepText: { fontSize: 14, color: theme.textPrimary, fontWeight: '500', flex: 1 },
  qaStepConnector: { position: 'absolute' as const, left: 11, top: 32, width: 2, height: 16 },
  qaGoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, paddingVertical: 10, borderRadius: 12 },
  qaGoBtnText: { fontSize: 13, fontWeight: '600' },
  catScroll: { paddingBottom: 4, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.surface, borderRadius: 20, borderWidth: 1.5, borderColor: theme.border },
  catChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  catChipBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  catChipBadgeText: { fontSize: 10, fontWeight: '700', color: theme.textMuted },
  tabletFaqGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 16 },
  tabletCatSection: { width: '48%' as any },
  catSection: { marginBottom: 20 },
  catSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  catSectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catSectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  catSectionDesc: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  catSectionCount: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  catSectionCountText: { fontSize: 12, fontWeight: '700' },
  faqList: { gap: 8 },
  faqItem: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  faqQuestionText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary, lineHeight: 22 },
  faqChevron: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  faqAnswerContainer: { overflow: 'hidden' },
  faqAnswerText: { fontSize: 14, color: theme.textSecondary, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 48, backgroundColor: theme.surface, borderRadius: 16, marginBottom: 20, ...theme.shadows.card },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20, paddingHorizontal: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.primary + '15', borderRadius: 20 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  tipsList: { gap: 8 },
  tipsListTablet: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border },
  tipCardTablet: { width: '48%' as any },
  tipIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginTop: 4 },
  showMoreText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  contactCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: theme.primary + '15' },
  contactInner: { padding: 24, alignItems: 'center' },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  contactTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', marginBottom: 4 },
  contactSub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginBottom: 20 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: theme.primary + '20' },
  contactBtnIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  contactBtnInfo: { flex: 1 },
  contactBtnTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  contactBtnEmail: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  contactBtnArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  version: { fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: 8 },
});
