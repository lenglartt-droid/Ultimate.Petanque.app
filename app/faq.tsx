import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  Linking,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

// ============================================
// TYPES
// ============================================
interface FAQQuestion { id: string; q: string; a: string }
interface FAQCategory { id: string; category: string; icon: string; color: string; description: string; questions: FAQQuestion[] }

type AudienceTab = 'joueur' | 'ambassadeur' | 'partenaire';

// ============================================
// FAQ DATA — Organized by audience
// ============================================

function getPlayerFaq(fr: boolean): FAQCategory[] {
  return [
    {
      id: 'getting_started',
      category: fr ? 'Premiers pas' : 'Getting Started',
      icon: 'rocket-launch',
      color: '#2563EB',
      description: fr ? 'Tout ce qu\'il faut savoir pour bien demarrer' : 'Everything you need to know to get started',
      questions: [
        { id: 'gs1', q: fr ? 'Comment creer mon profil joueur ?' : 'How do I create my player profile?', a: fr ? 'Apres l\'inscription, completez votre profil avec votre pseudo, role (Pointeur, Tireur, Milieu), niveau et club. Plus votre profil est complet, plus votre score de confiance sera eleve. Activez votre profil public pour apparaitre sur la carte et les classements.' : 'After registration, complete your profile with your nickname, role (Pointer, Shooter, Middle), level and club. The more complete your profile, the higher your trust score. Enable your public profile to appear on the map and rankings.' },
        { id: 'gs2', q: fr ? 'A quoi sert le QR code personnel ?' : 'What is the personal QR code for?', a: fr ? 'Appuyez sur l\'icone QR en haut de l\'accueil pour afficher votre QR code personnel. Les autres joueurs peuvent le scanner pour voir votre profil, vos stats et votre palmares. Ideal pour echanger rapidement lors d\'un tournoi ou d\'une rencontre. Vous pouvez aussi scanner les QR des terrains, RDV et evenements sponsorises.' : 'Tap the QR icon at top of home to show your personal QR code. Other players can scan it to see your profile, stats and honors. Ideal for quick exchanges at tournaments. You can also scan QR codes for courts, meetups and sponsored events.' },
        { id: 'gs3', q: fr ? 'Comment changer la langue de l\'application ?' : 'How do I change the app language?', a: fr ? 'Depuis le profil, appuyez sur le drapeau (FR/EN) en haut a droite. L\'application est entierement disponible en francais et en anglais. Le changement est instantane.' : 'From profile, tap the flag (FR/EN) at top right. The app is fully available in French and English. The change is instant.' },
      ],
    },
    {
      id: 'training',
      category: fr ? 'Matchs & Entrainement' : 'Matches & Training',
      icon: 'fitness-center',
      color: '#059669',
      description: fr ? 'Enregistrer et analyser vos parties' : 'Record and analyze your games',
      questions: [
        { id: 'tr1', q: fr ? 'Comment enregistrer un match ?' : 'How do I record a match?', a: fr ? 'Depuis l\'accueil, appuyez sur "Match". Selectionnez le mode (Entrainement ou Tournoi), le format (Tete-a-tete, Doublette, Triplette), ajoutez les joueurs, puis notez le score mene par mene. Vous pouvez aussi noter les actions detaillees de chaque joueur (tirs, points, carreaux).' : 'From home, tap "Match". Select mode (Training or Tournament), format (Singles, Doubles, Triples), add players, then record score end by end. You can also note detailed per-player actions (shots, points, carreaux).' },
        { id: 'tr2', q: fr ? 'Comment lancer un defi (10 tirs, precision, 1v1) ?' : 'How do I start a challenge (10 shots, precision, 1v1)?', a: fr ? 'Appuyez sur "Defi" depuis l\'accueil. Choisissez le type : "10 Tirs" (classique ou sautee), "Precision" (5 ateliers : boule seule, derriere le but, entre 2 boules, sautee, tir au but), ou activez le mode "1 vs 1" pour defier un adversaire. L\'app compare automatiquement les resultats avec un graphique radar.' : 'Tap "Challenge" from home. Choose type: "10 Shots" (classic or lob), "Precision" (5 workshops), or enable "1v1" mode to challenge an opponent. The app automatically compares results with a radar chart.' },
        { id: 'tr3', q: fr ? 'Comment jouer un Best of 3 (serie de matchs) ?' : 'How do I play a Best of 3?', a: fr ? 'Lors de la creation d\'un match, activez l\'option "Serie Best of 3". L\'app chainera automatiquement les matchs, comptera les victoires et declarera le vainqueur. Chaque match reste consultable individuellement dans l\'historique.' : 'When creating a match, enable "Best of 3 Series". The app chains matches automatically, counts wins and declares the winner. Each match remains viewable in history.' },
        { id: 'tr4', q: fr ? 'Comment associer mes boules a un match ou un defi ?' : 'How do I link my boules to a match?', a: fr ? 'Lors de la creation, selectionnez vos boules dans l\'option "Boules". Cela permet ensuite de comparer vos stats par equipement dans Stats > Performance : lesquelles vous conviennent le mieux au tir ? Au point ?' : 'When creating, select your boules in the "Boules" option. This lets you compare per-equipment stats in Stats > Performance: which suits you best for shooting vs. pointing?' },
        { id: 'tr5', q: fr ? 'Comment partager un match avec mes partenaires ?' : 'How do I share a match with my partners?', a: fr ? 'Ouvrez le detail d\'un match, appuyez sur "Partager avec les joueurs". Choisissez l\'acces : lecture seule ou modification. Les joueurs acceptant verront la partie dans leur historique et leurs stats se mettent a jour automatiquement. En cas de modification simultanee, une fenetre de resolution de conflit apparait.' : 'Open match detail, tap "Share with players". Choose access: read only or edit. Players who accept see the match in their history with auto-updated stats. If two players edit simultaneously, a conflict resolution window appears.' },
      ],
    },
    {
      id: 'tournament',
      category: fr ? 'Tournois & Palmares' : 'Tournaments & Honors',
      icon: 'emoji-events',
      color: '#B45309',
      description: fr ? 'Suivre votre parcours en competition' : 'Track your competition journey',
      questions: [
        { id: 'to1', q: fr ? 'Comment suivre mon parcours dans un tournoi ?' : 'How do I track my tournament journey?', a: fr ? 'Creez un tournoi (Accueil > Tournoi) avec le nom, la date, le lieu, le format et le type. Pour chaque match, selectionnez ce tournoi comme contexte et la phase (Poules, 1/8e, Quart, Demi, Finale). L\'app compile automatiquement votre parcours et votre resultat final.' : 'Create a tournament (Home > Tournament) with name, date, location, format and type. For each match, select this tournament as context and phase (Pool, Round of 16, Quarter, Semi, Final). The app compiles your journey and final result.' },
        { id: 'to2', q: fr ? 'Ou voir mon palmares ?' : 'Where is my honors page?', a: fr ? 'Depuis le profil, appuyez sur "Palmares". Tous vos tournois sont classes par resultat : podiums (1er, 2eme, 3eme), demi-finales, etc. Filtrez par periode, format ou type pour analyser votre progression.' : 'From profile, tap "Honors". All tournaments sorted by result: podiums (1st, 2nd, 3rd), semi-finals, etc. Filter by period, format or type to analyze progress.' },
        { id: 'to3', q: fr ? 'Comment noter les frais et gains de tournois ?' : 'How do I record tournament fees and winnings?', a: fr ? 'Dans la fiche tournoi, renseignez le "Cout d\'inscription" et le "Gain obtenu". Ces donnees sont compilees dans "Bilan financier" (profil), affichant votre rentabilite : total depense, total gagne et solde net sur la saison.' : 'In the tournament form, enter "Registration cost" and "Prize won". This data is compiled in "Financial Report" (profile), showing profitability: total spent, won, and net balance.' },
      ],
    },
    {
      id: 'map_social',
      category: fr ? 'Carte, RDV & Communaute' : 'Map, Meetups & Community',
      icon: 'map',
      color: '#0369A1',
      description: fr ? 'Trouver terrains et joueurs, organiser des rencontres' : 'Find courts and players, organize meetups',
      questions: [
        { id: 'ms1', q: fr ? 'Comment trouver un terrain de petanque pres de moi ?' : 'How do I find a nearby court?', a: fr ? 'Ouvrez l\'onglet "Carte". Tous les terrains publics sont affiches avec leur type (gravier, sable, bitume...), equipements (eclairage, couvert) et acces (public ou club). Les partenaires apparaissent avec un marqueur personnalise a leur couleur de marque.' : 'Open the "Map" tab. All public courts show with type (gravel, sand, asphalt...), facilities (lighting, covered) and access (public or club). Partners appear with a custom marker in their brand color.' },
        { id: 'ms2', q: fr ? 'Comment organiser un RDV petanque ?' : 'How do I organize a petanque meetup?', a: fr ? 'Depuis "A Venir" sur l\'accueil, appuyez sur "+ RDV". Choisissez terrain, date/heure, nombre max de participants. Un code unique et un QR code sont generes. Partagez-les ou invitez directement depuis l\'annuaire. Suivez les confirmations en temps reel.' : 'From "Upcoming" on home, tap "+ Meetup". Choose court, date/time, max participants. A unique code and QR code are generated. Share them or invite from directory. Track confirmations in real time.' },
        { id: 'ms3', q: fr ? 'Comment rejoindre un RDV ou un evenement sponsorise ?' : 'How do I join a meetup or sponsored event?', a: fr ? 'Trois methodes : (1) Entrez le code dans le champ dedie. (2) Scannez le QR code avec le scanner (icone en haut de l\'accueil). (3) Acceptez une invitation recue dans vos notifications. Pour les evenements sponsorises, vous pouvez aussi les trouver dans la liste publique.' : 'Three methods: (1) Enter the code in the dedicated field. (2) Scan the QR code with the scanner (icon at top of home). (3) Accept an invitation in notifications. For sponsored events, also find them in the public list.' },
        { id: 'ms4', q: fr ? 'Comment rendre mon profil visible sur la carte ?' : 'How do I make my profile visible on the map?', a: fr ? 'Appuyez sur l\'icone "Globe" sur la carte pour acceder au panneau de gestion. Activez la visibilite publique de votre profil, clubs et terrains. Seuls les elements geolocalises apparaitront.' : 'Tap the "Globe" icon on the map to access the management panel. Enable public visibility for your profile, clubs and courts. Only geolocated items will appear.' },
      ],
    },
    {
      id: 'stats_analysis',
      category: fr ? 'Stats, Classement & Progression' : 'Stats, Ranking & Progression',
      icon: 'bar-chart',
      color: '#7C3AED',
      description: fr ? 'Comprendre vos forces et progresser' : 'Understand your strengths and improve',
      questions: [
        { id: 'sa1', q: fr ? 'Comment analyser mes stats de tir par technique ?' : 'How do I analyze my shot stats by technique?', a: fr ? 'Stats > Tir : detail par technique (tir tendu, en cloche, en rafle, court-ramasse) avec nombre de tentatives, taux de reussite, et tableau croise avec l\'impact (point gagne, decisif, sans effet, negatif).' : 'Stats > Shot: breakdown by technique (flat, lob, running, pick-up) with attempts, success rate, and cross-reference with impact (point gained, decisive, neutral, negative).' },
        { id: 'sa2', q: fr ? 'Comment voir ma progression sur plusieurs mois ?' : 'How do I see my progression over months?', a: fr ? 'Appuyez sur "Progression" en haut de la page Stats. Choisissez la periode (4 semaines a 25 ans). Des graphiques interactifs montrent l\'evolution de votre taux de victoire, tir, point et carreaux.' : 'Tap "Progression" at top of Stats page. Choose period (4 weeks to 25 years). Interactive charts show evolution of win rate, shot, point and carreau rates.' },
        { id: 'sa3', q: fr ? 'Comment apparaitre dans le classement communautaire ?' : 'How do I appear in the community leaderboard?', a: fr ? 'Activez votre profil public et jouez au minimum 3 matchs publics. Le classement peut etre filtre par zone geographique (monde, continent, pays, ville), periode et critere. Chaque lundi, le classement hebdomadaire est reinitialise.' : 'Enable your public profile and play at least 3 public matches. Rankings can be filtered by zone (world, continent, country, city), period and criteria. Weekly leaderboard resets every Monday.' },
        { id: 'sa4', q: fr ? 'Qu\'est-ce que le score de confiance ?' : 'What is the trust score?', a: fr ? 'Le score de confiance (0-100) mesure la fiabilite de vos donnees. Il augmente avec un profil complet, des matchs reguliers, des attestations de temoins et un compte verifie. Un score de 80+ affiche le badge "Verifie" dans les classements. Chaque facteur est detaille dans la page Trust Score avec des jauges et des conseils personnalises. Les matchs attestes par des temoins beneficient d\'un bonus de poids 2.0x.' : 'The trust score (0-100) measures data reliability. It increases with a complete profile, regular matches, witness attestations and verified account. 80+ shows the "Verified" badge in rankings. Each factor is detailed in the Trust Score page with gauges and personalized tips. Witness-attested matches benefit from a 2.0x weight bonus.' },
        { id: 'sa5', q: fr ? 'Comment analyser mes erreurs ?' : 'How do I analyze my errors?', a: fr ? 'Stats > Erreurs : analyse par duree de match (fatigue), format, entrainement vs tournoi, erreurs consecutives. Pour le tir, l\'app identifie si vous manquez court/droite, long, etc. Chaque type d\'erreur est accompagne d\'un conseil technique.' : 'Stats > Errors: analysis by match duration (fatigue), format, training vs tournament, consecutive errors. For shots, the app identifies miss direction. Each error type includes a coaching tip.' },
      ],
    },
    {
      id: 'events_witness',
      category: fr ? 'Evenements sponsorises & Attestation' : 'Sponsored Events & Attestation',
      icon: 'campaign',
      color: '#DC2626',
      description: fr ? 'Participer aux defis officiels de la communaute' : 'Participate in official community challenges',
      questions: [
        { id: 'ev1', q: fr ? 'Comment participer a un evenement sponsorise ?' : 'How do I join a sponsored event?', a: fr ? 'Rejoignez via le code de l\'evenement, la liste publique (page Defis), ou le QR code. Chaque evenement est organise par un ambassadeur avec une date/heure precise, un type de defi et un nombre max de participants. Realisez votre defi pendant le creneau prevu.' : 'Join via event code, public list (Challenges page), or QR code. Each event is organized by an ambassador with a specific date/time, challenge type and max participants. Complete your challenge during the scheduled slot.' },
        { id: 'ev2', q: fr ? 'Comment fonctionne l\'attestation par temoins ?' : 'How does witness attestation work?', a: fr ? 'Apres un match ou un defi, invitez un joueur present comme temoin depuis la section "Attestation par temoins" dans le detail du match ou du defi. Le temoin recoit une notification push et peut confirmer ou refuser. Maximum 2 temoins par match/defi. Une attestation fait passer le poids du match/defi a 2.0x dans le classement et ameliore votre score de confiance.' : 'After a match or challenge, invite a present player as witness from the "Witness Attestation" section in match or challenge detail. The witness receives a push notification and can confirm or decline. Maximum 2 witnesses per match/challenge. An attestation upgrades the match/challenge weight to 2.0x in the leaderboard and improves your trust score.' },
        { id: 'ev3', q: fr ? 'Puis-je demander une attestation pour un defi solo ou 1v1 ?' : 'Can I request attestation for a solo or 1v1 challenge?', a: fr ? 'Oui ! L\'attestation est disponible pour tous les matchs et defis (solo, 1v1, entrainement, tournoi). Pour les defis solo, c\'est particulierement important car il n\'y a pas d\'adversaire pour verifier. Le temoin voit un snapshot fige de vos resultats au moment de la demande.' : 'Yes! Attestation is available for all matches and challenges (solo, 1v1, training, tournament). For solo challenges, it is particularly important since there is no opponent to verify. The witness sees a frozen snapshot of your results at the time of the request.' },
        { id: 'ev4', q: fr ? 'Comment devenir temoin pour un autre joueur ?' : 'How do I become a witness for another player?', a: fr ? 'Vous recevrez une notification push quand un joueur vous invite a attester. Rendez-vous dans le Hub Notifications > onglet Temoins, ou dans la page dediee "Attestations de temoin" (Profil > Notifications). Vous verrez le snapshot du match avec 2 options : Confirmer ou Refuser.' : 'You will receive a push notification when a player invites you to attest. Go to Notification Hub > Witnesses tab, or the dedicated "Witness Attestations" page (Profile > Notifications). You will see the match snapshot with 2 options: Confirm or Decline.' },
      ],
    },
    {
      id: 'equipment_boules',
      category: fr ? 'Equipement & Boules' : 'Equipment & Boules',
      icon: 'sports-baseball',
      color: '#D97706',
      description: fr ? 'Gerer et comparer vos jeux de boules' : 'Manage and compare your boules sets',
      questions: [
        { id: 'eq1', q: fr ? 'Comment enregistrer mes boules ?' : 'How do I register my boules?', a: fr ? 'Depuis le profil > Equipement. Ajoutez nom, marque, diametre, poids, durete, numero de serie, photo et prix d\'achat. Definissez un equipement "principal" pour qu\'il soit pre-selectionne a la creation de matchs.' : 'From profile > Equipment. Add name, brand, diameter, weight, hardness, serial number, photo and purchase price. Set one as "primary" for pre-selection when creating matches.' },
        { id: 'eq2', q: fr ? 'Comment voir le classement des boules par marque ?' : 'How do I see the boules ranking by brand?', a: fr ? 'Page Classement > onglet Boules : stats de tous les joueurs publics compilees par marque et modele (taux de victoire, tir, carreau, popularite). Filtrez par role pour des comparaisons pertinentes.' : 'Leaderboard > Boules tab: all public player stats compiled by brand and model (win rate, shot, carreau, popularity). Filter by role for relevant comparisons.' },
      ],
    },
    {
      id: 'account_settings',
      category: fr ? 'Compte & Parametres' : 'Account & Settings',
      icon: 'settings',
      color: '#64748B',
      description: fr ? 'Gerer votre profil, notifications et donnees' : 'Manage your profile, notifications and data',
      questions: [
        { id: 'ac1', q: fr ? 'Comment gerer mes notifications ?' : 'How do I manage notifications?', a: fr ? 'Profil > Preferences de notifications. Activez/desactivez individuellement : invitations RDV, demandes de partage, evenements sponsorises, changements de classement, rappels d\'evenements.' : 'Profile > Notification preferences. Enable/disable individually: meetup invitations, share requests, sponsored events, ranking changes, event reminders.' },
        { id: 'ac2', q: fr ? 'Comment exporter mes donnees ?' : 'How do I export my data?', a: fr ? 'Profil > Exporter les donnees. Choisissez CSV ou JSON et les donnees a exporter (matchs, defis, joueurs, clubs, terrains, tournois). Le CSV est compatible Excel et Google Sheets.' : 'Profile > Export data. Choose CSV or JSON and data to export (matches, challenges, players, clubs, courts, tournaments). CSV is compatible with Excel and Google Sheets.' },
        { id: 'ac3', q: fr ? 'Comment supprimer les publicites ?' : 'How do I remove ads?', a: fr ? 'Profil > Supprimer les publicites. C\'est un achat unique qui retire toutes les bannieres. L\'achat est lie a votre compte Apple/Google et peut etre restaure. Une partie des revenus finance le developpement de l\'application (voir l\'option de don).' : 'Profile > Remove ads. One-time purchase removing all banners. Linked to your Apple/Google account and restorable. Part of the revenue funds app development (see donation option).' },
        { id: 'ac4', q: fr ? 'Comment supprimer mon compte et mes donnees ?' : 'How do I delete my account?', a: fr ? 'Profil > Mot de passe et securite > Supprimer mon compte. Action irreversible : toutes vos donnees (matchs, defis, joueurs, tournois, stats, partages) sont definitivement supprimees. Les elements partages sont retires de la vue des autres joueurs.' : 'Profile > Password and security > Delete my account. Irreversible: all data (matches, challenges, players, tournaments, stats, shares) permanently deleted. Shared items removed from other players view.' },
        { id: 'ac5', q: fr ? 'Comment gerer les doublons dans mon annuaire ?' : 'How do I manage duplicates?', a: fr ? 'L\'app detecte automatiquement les doublons (noms similaires). Une banniere jaune apparait dans l\'annuaire. Pour les doublons a 90%+, "Fusion rapide" fusionne automatiquement. Sinon, choisissez champ par champ. Reversible 24h.' : 'The app detects duplicates automatically (similar names). A yellow banner appears in the directory. For 90%+ duplicates, "Quick Merge" merges automatically. Otherwise, choose field by field. Reversible for 24h.' },
      ],
    },
  ];
}

function getAmbassadorFaq(fr: boolean): FAQCategory[] {
  return [
    {
      id: 'amb_program',
      category: fr ? 'Programme Ambassadeur' : 'Ambassador Program',
      icon: 'stars',
      color: '#7C3AED',
      description: fr ? 'Niveaux, criteres et avantages' : 'Levels, criteria and benefits',
      questions: [
        { id: 'ap1', q: fr ? 'Comment devenir ambassadeur ?' : 'How do I become an ambassador?', a: fr ? 'Contactez notre equipe via la page ambassadeurs ou par email. Le programme comporte 3 niveaux progressifs : Decouverte, Confirme et Elite. Chaque niveau debloquer de nouveaux avantages et une visibilite accrue.' : 'Contact our team via the ambassadors page or email. The program has 3 progressive levels: Discovery, Confirmed and Elite. Each level unlocks new benefits and increased visibility.' },
        { id: 'ap2', q: fr ? 'Quels sont les 3 niveaux ambassadeur ?' : 'What are the 3 ambassador levels?', a: fr ? 'Decouverte : profil public, code parrainage, badge ambassadeur, 2 defis sponsorises/mois. Confirme (5+ parrainages, 3+ defis, 500+ impressions) : banniere rotative accueil, dashboard analytics complet, defis illimites, badge violet. Elite (20+ parrainages, 10+ defis, 2000+ impressions) : banniere permanente, section onboarding, push illimites, analytics avances avec export, badge dore, priorite classements, acces anticipe nouvelles fonctionnalites.' : 'Discovery: public profile, referral code, badge, 2 sponsored challenges/month. Confirmed (5+ referrals, 3+ challenges, 500+ impressions): rotating home banner, full analytics dashboard, unlimited challenges, purple badge. Elite (20+ referrals, 10+ challenges, 2000+ impressions): permanent banner, onboarding section, unlimited push, advanced analytics with export, gold badge, ranking priority, early feature access.' },
        { id: 'ap3', q: fr ? 'La promotion est-elle automatique ?' : 'Is promotion automatic?', a: fr ? 'Oui ! Des que vous atteignez les criteres du niveau superieur, votre badge est automatiquement mis a jour et vous debloquez les nouveaux avantages sans interruption.' : 'Yes! As soon as you meet the criteria for the next level, your badge auto-updates and new benefits unlock seamlessly.' },
        { id: 'ap4', q: fr ? 'Quelle est la difference avec les partenaires/sponsors ?' : 'What is the difference with partners/sponsors?', a: fr ? 'Les ambassadeurs sont des joueurs passionnes qui representent benevolement la communaute. Les partenaires sont des marques ou structures beneficiant d\'une visibilite business avec des outils de communication avances (push notifications, A/B testing, heatmap, CRM).' : 'Ambassadors are passionate players voluntarily representing the community. Partners are brands or organizations with business visibility and advanced communication tools (push notifications, A/B testing, heatmap, CRM).' },
      ],
    },
    {
      id: 'amb_referral',
      category: fr ? 'Parrainage & XP' : 'Referral & XP',
      icon: 'person-add',
      color: '#10B981',
      description: fr ? 'Gagnez des XP et progressez' : 'Earn XP and level up',
      questions: [
        { id: 'ar1', q: fr ? 'Comment fonctionne le parrainage ?' : 'How does referral work?', a: fr ? 'Partagez votre code unique (visible dans le portail). Quand un nouveau joueur s\'inscrit avec votre code, vous gagnez 50 XP et votre compteur augmente. Atteignez 5 parrainages pour Confirme, 20 pour Elite.' : 'Share your unique code (visible in portal). When a new player signs up with your code, you earn 50 XP and your counter increases. Reach 5 referrals for Confirmed, 20 for Elite.' },
        { id: 'ar2', q: fr ? 'Comment gagner des XP ?' : 'How do I earn XP?', a: fr ? 'Parrainage valide : +50 XP. Defi sponsorise cree : +25 XP. 100 impressions cumulees : +10 XP. Les XP contribuent a votre progression globale et au deblocage de badges.' : 'Valid referral: +50 XP. Sponsored challenge created: +25 XP. 100 cumulative impressions: +10 XP. XP contributes to your overall progression and badge unlocks.' },
      ],
    },
    {
      id: 'amb_portal',
      category: fr ? 'Portail Ambassadeur' : 'Ambassador Portal',
      icon: 'dashboard',
      color: '#2563EB',
      description: fr ? 'Votre tableau de bord complet' : 'Your complete dashboard',
      questions: [
        { id: 'pt1', q: fr ? 'Que contient le portail ambassadeur ?' : 'What does the ambassador portal contain?', a: fr ? 'Le portail (Profil > Communaute > Portail Ambassadeurs) affiche vos stats en temps reel : impressions, clics, parrainages, evenements. Vous pouvez creer des defis sponsorises, suivre votre progression vers le niveau superieur, et voir votre code parrainage. Les niveaux Confirme et Elite ont acces au dashboard analytics complet.' : 'The portal (Profile > Community > Ambassador Portal) shows real-time stats: impressions, clicks, referrals, events. You can create sponsored challenges, track progression to next level, and see your referral code. Confirmed and Elite levels have full analytics dashboard access.' },
        { id: 'pt2', q: fr ? 'Comment creer un evenement sponsorise ?' : 'How do I create a sponsored event?', a: fr ? 'Depuis le portail ou la page Defis, creez un evenement sponsorise. Choisissez le type de defi, la date, le terrain, le nombre max de participants. Un code unique et un QR code sont generes. Les participants rejoignent via le code, la liste publique ou le QR. Les resultats sont valides par des temoins.' : 'From portal or Challenges page, create a sponsored event. Choose challenge type, date, court, max participants. A unique code and QR code are generated. Participants join via code, public list or QR. Results are validated by witnesses.' },
        { id: 'pt3', q: fr ? 'Comment acceder a mes analytics ?' : 'How do I access my analytics?', a: fr ? 'Confirme/Elite : le portail affiche un dashboard complet avec impressions, clics, CTR, portee geographique, evolution temporelle. Les Elite peuvent exporter leurs statistiques en CSV/PDF pour des rapports detailles.' : 'Confirmed/Elite: the portal shows a full dashboard with impressions, clicks, CTR, geographic reach, time evolution. Elite members can export stats as CSV/PDF for detailed reports.' },
      ],
    },
    {
      id: 'amb_visibility',
      category: fr ? 'Visibilite & Banniere' : 'Visibility & Banner',
      icon: 'visibility',
      color: '#F59E0B',
      description: fr ? 'Ou et comment vous apparaissez' : 'Where and how you appear',
      questions: [
        { id: 'av1', q: fr ? 'Comment fonctionne la banniere ambassadeur sur l\'accueil ?' : 'How does the home ambassador banner work?', a: fr ? 'Confirme : apparition dans le carrousel rotatif de l\'accueil (rotation toutes les 5 secondes). Elite : banniere permanente et prioritaire, toujours visible en premier. Votre profil, stats et reseaux sociaux sont affiches. Chaque affichage est comptabilise comme une impression.' : 'Confirmed: appears in the rotating home carousel (5s rotation). Elite: permanent priority banner, always visible first. Your profile, stats and social media are displayed. Each display counts as an impression.' },
        { id: 'av2', q: fr ? 'Ou suis-je visible dans l\'app ?' : 'Where am I visible in the app?', a: fr ? 'Page "Nos Ambassadeurs" (profil complet avec reseaux sociaux), banniere accueil (Confirme/Elite), page de parrainage, QR code du profil, liste des evenements sponsorises. Les Elite apparaissent aussi dans la section onboarding des nouveaux joueurs.' : 'Our Ambassadors page (full profile with social media), home banner (Confirmed/Elite), referral page, profile QR code, sponsored events list. Elite also appear in new player onboarding section.' },
      ],
    },
  ];
}

function getPartnerFaq(fr: boolean): FAQCategory[] {
  return [
    {
      id: 'par_program',
      category: fr ? 'Programme Partenaire' : 'Partner Program',
      icon: 'handshake',
      color: '#D4A017',
      description: fr ? 'Niveaux, tarifs et avantages business' : 'Levels, pricing and business benefits',
      questions: [
        { id: 'pp1', q: fr ? 'Comment devenir partenaire ?' : 'How do I become a partner?', a: fr ? 'Consultez la page "Programme Partenaire" (Nos Partenaires > lien en haut). Contactez-nous par email avec votre projet et le niveau souhaite. Nous repondons sous 48h avec une proposition personnalisee.' : 'Check the "Partner Program" page (Our Partners > top link). Contact us by email with your project and desired level. We respond within 48h with a personalized proposal.' },
        { id: 'pp2', q: fr ? 'Quels sont les 3 niveaux partenaire ?' : 'What are the 3 partner levels?', a: fr ? 'Bronze (sur devis) : fiche partenaire, badge, lien site web, stats de base, marqueur carte. Argent (sur devis) : + banniere rotative accueil, 1 push/mois, dashboard analytics complet, templates push, programmation envois, export CSV/PDF. Or (sur devis) : + banniere permanente, section onboarding, push illimites avec A/B testing, heatmap, calculateur ROI, objectifs mensuels, CRM, kit de marque, digest hebdomadaire.' : 'Bronze (on quote): partner card, badge, website link, basic stats, map marker. Silver (on quote): + rotating home banner, 1 push/month, full analytics dashboard, push templates, scheduling, CSV/PDF export. Gold (on quote): + permanent banner, onboarding section, unlimited push with A/B testing, heatmap, ROI calculator, monthly goals, CRM, brand kit, weekly digest.' },
        { id: 'pp3', q: fr ? 'Puis-je changer de niveau ?' : 'Can I change my level?', a: fr ? 'Oui, passage au niveau superieur a tout moment, sans interruption de service. Vous conservez tout votre historique et vos donnees analytiques.' : 'Yes, upgrade at any time with no service interruption. You keep all history and analytics data.' },
        { id: 'pp4', q: fr ? 'Ma page partenaire publique, c\'est quoi ?' : 'What is my public partner page?', a: fr ? 'Chaque partenaire a une page dediee (partner/[id]) avec votre logo agrandi, badge de niveau, couleur de marque en gradient, compteurs animes (impressions, clics, CTR, portee), timeline d\'activite recente, liens sociaux, liste d\'evenements, code parrainage avec bouton copier, QR code pour marketing, et lien vers votre site web.' : 'Each partner has a dedicated page (partner/[id]) with enlarged logo, tier badge, brand color gradient, animated counters (impressions, clicks, CTR, reach), recent activity timeline, social links, events list, referral code with copy button, marketing QR code, and website link.' },
      ],
    },
    {
      id: 'par_portal',
      category: fr ? 'Portail Partenaires' : 'Partner Portal',
      icon: 'dashboard',
      color: '#2563EB',
      description: fr ? 'Votre centre de controle business' : 'Your business control center',
      questions: [
        { id: 'po1', q: fr ? 'Que contient le portail partenaires ?' : 'What does the partner portal contain?', a: fr ? 'Le portail (Profil > Communaute > Portail Partenaires) offre 6 onglets : ROI (impressions, clics, CTR, benchmark, objectifs, calculateur), Placement (vos emplacements dans l\'app), Branding (logo, couleur de marque, apercu banniere et carte), Push (composer, templates, A/B test, programmer), Events (defis sponsorises), CRM (parrainages avec suivi et export CSV).' : 'The portal (Profile > Community > Partner Portal) has 6 tabs: ROI (impressions, clicks, CTR, benchmark, goals, calculator), Placement (your app placements), Branding (logo, brand color, banner and map preview), Push (compose, templates, A/B test, schedule), Events (sponsored challenges), CRM (referrals with tracking and CSV export).' },
        { id: 'po2', q: fr ? 'Comment suivre mon ROI et mes objectifs ?' : 'How do I track my ROI and goals?', a: fr ? 'Onglet ROI : KPIs en temps reel. Definissez des objectifs mensuels (impressions, clics, CTR) avec des anneaux de progression et notifications d\'atteinte. Renseignez votre budget pour calculer CPM, CPC et ROI. Le benchmark compare vos performances avec les partenaires de votre tier.' : 'ROI tab: real-time KPIs. Set monthly goals (impressions, clicks, CTR) with progress rings and achievement notifications. Enter budget to calculate CPM, CPC and ROI. Benchmark compares your performance with same-tier partners.' },
        { id: 'po3', q: fr ? 'Comment personnaliser mon branding dans l\'app ?' : 'How do I customize my branding?', a: fr ? 'Onglet Branding : uploadez votre logo (affiche en 80-96px selon le tier), choisissez votre couleur de marque. L\'apercu en temps reel montre votre banniere et votre marqueur carte. Votre page partenaire publique utilise votre couleur en gradient hero.' : 'Branding tab: upload your logo (displayed at 80-96px by tier), choose your brand color. Real-time preview shows your banner and map marker. Your public partner page uses your color as hero gradient.' },
      ],
    },
    {
      id: 'par_push',
      category: fr ? 'Push Notifications & A/B Testing' : 'Push Notifications & A/B Testing',
      icon: 'notifications-active',
      color: '#DC2626',
      description: fr ? 'Communiquer directement avec les joueurs' : 'Communicate directly with players',
      questions: [
        { id: 'pn1', q: fr ? 'Comment envoyer une push notification ?' : 'How do I send a push notification?', a: fr ? 'Onglet Push du portail. Composez votre message (titre + corps), choisissez la cible (tous les joueurs ou filtre geographique). Argent : 1 push/mois. Or : illimite. Vous pouvez programmer l\'envoi avec des creneaux predefinis (matin, midi, soir) ou une date/heure personnalisee. Un apercu iOS/Android realiste est affiche.' : 'Push tab in portal. Compose your message (title + body), choose target (all players or geographic filter). Silver: 1 push/month. Gold: unlimited. Schedule with predefined slots (morning, noon, evening) or custom date/time. A realistic iOS/Android preview is shown.' },
        { id: 'pn2', q: fr ? 'Comment fonctionne le A/B testing des push ?' : 'How does push A/B testing work?', a: fr ? 'Or uniquement. Activez le toggle A/B, redigez 2 variantes (titre + message). 50% recoit chaque variante. Les resultats apparaissent dans "Insights A/B" : taux d\'ouverture par variante, niveau de confiance statistique, taille d\'echantillon recommandee, et historique complet des tests. Identifiez quel message fonctionne le mieux pour optimiser vos futures campagnes.' : 'Gold only. Enable A/B toggle, write 2 variants (title + message). 50% receives each. Results in "A/B Insights": open rate per variant, statistical confidence, recommended sample size, and full test history. Identify which message works best to optimize future campaigns.' },
        { id: 'pn3', q: fr ? 'Quels templates push sont disponibles ?' : 'What push templates are available?', a: fr ? '7 categories de templates pre-redigees en FR/EN : Promo, Evenement, Rappel, Saisonnier, Partenariat, Lancement produit, Communaute. Chaque categorie contient 2+ messages prets a l\'emploi que vous pouvez personnaliser avant envoi.' : '7 pre-written template categories in FR/EN: Promo, Event, Reminder, Seasonal, Partnership, Product Launch, Community. Each category has 2+ ready-to-use messages you can customize before sending.' },
        { id: 'pn4', q: fr ? 'Comment programmer l\'envoi d\'un push ?' : 'How do I schedule a push?', a: fr ? 'Lors de la composition, activez "Programmer". Choisissez une date avec les boutons rapides (Aujourd\'hui, Demain, Vendredi, Lundi), puis un creneau horaire (Matin 9h, Midi 12h, Apres-midi 14h, Soir 18h, Nuit 21h) ou une heure personnalisee. Une heatmap des heures optimales est affichee pour maximiser les ouvertures.' : 'When composing, enable "Schedule". Choose date with quick buttons (Today, Tomorrow, Friday, Monday), then time slot (Morning 9am, Noon 12pm, Afternoon 2pm, Evening 6pm, Night 9pm) or custom time. An optimal hours heatmap is shown to maximize opens.' },
      ],
    },
    {
      id: 'par_analytics',
      category: fr ? 'Analytics & Digest' : 'Analytics & Digest',
      icon: 'insights',
      color: '#7C3AED',
      description: fr ? 'Mesurer et exporter vos performances' : 'Measure and export your performance',
      questions: [
        { id: 'pa1', q: fr ? 'Comment sont mesurees les impressions et les clics ?' : 'How are impressions and clicks measured?', a: fr ? 'Chaque affichage de votre banniere, marqueur carte ou fiche partenaire compte comme une impression. Les clics sur votre profil ou lien sont traces. Tout est visible dans le dashboard en temps reel avec filtres par periode.' : 'Each display of your banner, map marker or partner card counts as an impression. Clicks on your profile or link are tracked. Everything visible in real-time dashboard with period filters.' },
        { id: 'pa2', q: fr ? 'Qu\'est-ce que le digest hebdomadaire ?' : 'What is the weekly digest?', a: fr ? 'Or uniquement. Chaque lundi, un recap automatique resume vos performances : impressions, clics, CTR, push envoyes, comparaison avec la semaine precedente. Accessible dans le portail > ROI. Exportable en PDF et partageable par email.' : 'Gold only. Every Monday, an automatic recap summarizes performance: impressions, clicks, CTR, pushes sent, comparison with previous week. Accessible in portal > ROI. Exportable as PDF and shareable by email.' },
        { id: 'pa3', q: fr ? 'Comment exporter mes statistiques ?' : 'How do I export my statistics?', a: fr ? 'Argent/Or : export CSV/PDF depuis le portail. Le PDF inclut logo, impressions, clics, CTR et portee. L\'export est egalement disponible depuis la page partenaire publique (page landing) pour generer un rapport marketing rapide.' : 'Silver/Gold: CSV/PDF export from portal. PDF includes logo, impressions, clicks, CTR and reach. Export also available from public partner page (landing page) to generate a quick marketing report.' },
        { id: 'pa4', q: fr ? 'Comment fonctionne le calculateur ROI ?' : 'How does the ROI calculator work?', a: fr ? 'Or uniquement. Renseignez votre investissement mensuel et le portail calcule automatiquement : CPM (cout pour 1000 impressions), CPC (cout par clic), ROI avec projections annuelles basees sur vos tendances actuelles.' : 'Gold only. Enter your monthly investment and the portal calculates: CPM (cost per 1000 impressions), CPC (cost per click), ROI with annual projections based on current trends.' },
      ],
    },
    {
      id: 'par_landing_qr',
      category: fr ? 'Page Partenaire & QR Code' : 'Partner Page & QR Code',
      icon: 'qr-code',
      color: '#059669',
      description: fr ? 'Votre vitrine publique et outils marketing' : 'Your public showcase and marketing tools',
      questions: [
        { id: 'pl1', q: fr ? 'A quoi sert ma page partenaire publique ?' : 'What is my public partner page for?', a: fr ? 'C\'est votre vitrine dans l\'app : hero section avec avatar agrandi et couleur de marque, compteurs animes, timeline d\'activite, evenements, code parrainage, liens sociaux et bouton vers votre site. Les joueurs y accedent via la page "Nos Partenaires" ou en scannant votre QR code.' : 'It is your showcase in the app: hero section with enlarged avatar and brand color, animated counters, activity timeline, events, referral code, social links and website button. Players access it via "Our Partners" page or by scanning your QR code.' },
        { id: 'pl2', q: fr ? 'Comment utiliser le QR code pour le marketing ?' : 'How do I use the QR code for marketing?', a: fr ? 'Votre page partenaire inclut un QR code personnalise aux couleurs de votre marque. Les boutons "Partager" et "Copier le lien" permettent de l\'integrer a vos supports marketing. Imprimez-le sur vos flyers, cartes de visite ou stands de tournois pour diriger les joueurs vers votre profil dans l\'app.' : 'Your partner page includes a QR code in your brand colors. "Share" and "Copy Link" buttons let you integrate it into marketing materials. Print it on flyers, business cards or tournament stands to direct players to your app profile.' },
      ],
    },
  ];
}

// ============================================
// AUDIENCE TABS CONFIG
// ============================================
const AUDIENCE_TABS: { id: AudienceTab; iconFr: string; iconEn: string; icon: string; color: string; gradientColors: [string, string] }[] = [
  { id: 'joueur', iconFr: 'Joueur', iconEn: 'Player', icon: 'sports', color: '#2563EB', gradientColors: ['#2563EB', '#1D4ED8'] },
  { id: 'ambassadeur', iconFr: 'Ambassadeur', iconEn: 'Ambassador', icon: 'stars', color: '#7C3AED', gradientColors: ['#7C3AED', '#6D28D9'] },
  { id: 'partenaire', iconFr: 'Partenaire', iconEn: 'Partner', icon: 'handshake', color: '#D4A017', gradientColors: ['#D4A017', '#B8860B'] },
];

// ============================================
// QUICK ACTIONS
// ============================================
function getQuickActions(language: string) {
  const fr = language === 'fr';
  return [
    { id: 'match', title: fr ? 'Enregistrer un match' : 'Record a match', icon: 'sports', color: '#2563EB', route: '/match/new',
      steps: fr ? ['Choisissez Entrainement ou Tournoi', 'Selectionnez le format', 'Ajoutez joueurs et adversaires', 'Notez le score mene par mene'] : ['Choose Training or Tournament', 'Select format', 'Add players and opponents', 'Record score end by end'] },
    { id: 'challenge', title: fr ? 'Lancer un defi' : 'Start a challenge', icon: 'track-changes', color: '#D97706', route: '/challenge/new',
      steps: fr ? ['Choisissez 10 Tirs, Sautee ou Precision', 'Selectionnez le joueur et ses boules', 'Notez chaque tir', 'Mode 1v1 : defier un adversaire'] : ['Choose 10 Shots, Lob or Precision', 'Select player and their boules', 'Record each shot', '1v1 mode: challenge an opponent'] },
    { id: 'meetup', title: fr ? 'Organiser un RDV' : 'Organize a meetup', icon: 'event', color: '#0369A1', route: '/meetup/new',
      steps: fr ? ['Choisissez terrain et date', 'Definissez le nombre max', 'Partagez le code ou QR', 'Suivez les confirmations'] : ['Choose court and date', 'Set max participants', 'Share code or QR', 'Track confirmations'] },
    { id: 'tournament', title: fr ? 'Suivre un tournoi' : 'Track a tournament', icon: 'emoji-events', color: '#B45309', route: '/tournament/new',
      steps: fr ? ['Creez le tournoi', 'Enregistrez chaque match', 'Notez votre resultat final', 'Retrouvez tout dans le palmares'] : ['Create tournament', 'Record each match', 'Note final result', 'Find everything in honors'] },
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

function QuickActionCard({ action }: { action: ReturnType<typeof getQuickActions>[0] }) {
  const [expanded, setExpanded] = useState(false);
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
          {action.steps.map((step: string, i: number) => (
            <View key={i} style={st.qaStep}>
              <View style={[st.qaStepNum, { backgroundColor: action.color }]}><Text style={st.qaStepNumText}>{i + 1}</Text></View>
              <Text style={st.qaStepText}>{step}</Text>
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
  const fr = language === 'fr';
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AudienceTab>('joueur');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [openQs, setOpenQs] = useState<Set<string>>(new Set());
  const [screenW, setScreenW] = useState(() => Dimensions.get('window').width || 375);
  React.useEffect(() => { const sub = Dimensions.addEventListener('change', ({ window }) => setScreenW(window.width)); return () => sub?.remove(); }, []);
  const isTablet = screenW >= 600;

  const QUICK_ACTIONS = useMemo(() => getQuickActions(language), [language]);

  const faqData = useMemo(() => {
    switch (activeTab) {
      case 'joueur': return getPlayerFaq(fr);
      case 'ambassadeur': return getAmbassadorFaq(fr);
      case 'partenaire': return getPartnerFaq(fr);
    }
  }, [activeTab, fr]);

  const filtered = useMemo(() => {
    return faqData.map(cat => ({
      ...cat,
      questions: cat.questions.filter(q => {
        const ms = !search || q.q.toLowerCase().includes(search.toLowerCase()) || q.a.toLowerCase().includes(search.toLowerCase());
        const mc = !selectedCat || cat.id === selectedCat;
        return ms && mc;
      }),
    })).filter(cat => cat.questions.length > 0);
  }, [search, selectedCat, faqData]);

  const toggleQ = useCallback((id: string) => {
    setOpenQs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  const handleTabChange = useCallback((tab: AudienceTab) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
    setSelectedCat(null);
    setOpenQs(new Set());
    setSearch('');
  }, []);

  const totalQs = faqData.reduce((sum, cat) => sum + cat.questions.length, 0);
  const isSearching = search.length > 0;
  const totalResults = filtered.reduce((sum, c) => sum + c.questions.length, 0);
  const activeTabConfig = AUDIENCE_TABS.find(t => t.id === activeTab)!;

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      {/* Header */}
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>{fr ? 'Aide & Guide' : 'Help & Guide'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={st.scrollView} contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }, isTablet && st.scrollContentTablet]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <LinearGradient colors={activeTabConfig.gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
            <View style={st.heroDecoCircle1} />
            <View style={st.heroDecoCircle2} />
            <View style={st.heroIconWrap}>
              <MaterialIcons name={activeTabConfig.icon as any} size={32} color="#FFF" />
            </View>
            <Text style={st.heroTitle}>{fr ? 'Guide' : 'Guide'} {fr ? activeTabConfig.iconFr : activeTabConfig.iconEn}</Text>
            <Text style={st.heroSub}>{totalQs} {fr ? 'reponses' : 'answers'} {"\u2022"} {faqData.length} {fr ? 'themes' : 'topics'}</Text>

            <View style={st.heroSearch}>
              <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput style={st.heroSearchInput} placeholder={fr ? 'Rechercher une question...' : 'Search a question...'} placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </Pressable>
              ) : null}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Audience Tabs */}
        <View style={st.audienceTabsContainer}>
          {AUDIENCE_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[st.audienceTab, isActive && { backgroundColor: tab.color, borderColor: tab.color }]}
                onPress={() => handleTabChange(tab.id)}
              >
                <MaterialIcons name={tab.icon as any} size={16} color={isActive ? '#FFF' : tab.color} />
                <Text style={[st.audienceTabText, isActive && { color: '#FFF' }]}>
                  {fr ? tab.iconFr : tab.iconEn}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Search result banner */}
        {isSearching ? (
          <View style={st.searchBanner}>
            <MaterialIcons name="search" size={16} color={theme.textMuted} />
            <Text style={st.searchBannerText}>{totalResults} {fr ? 'resultat(s) pour' : 'result(s) for'} "{search}"</Text>
            {totalResults === 0 ? (
              <Pressable style={st.searchBannerReset} onPress={() => { setSearch(''); setSelectedCat(null); }}>
                <Text style={st.searchBannerResetText}>{fr ? 'Reinitialiser' : 'Reset'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Quick Actions — only for Player tab, non-searching */}
        {activeTab === 'joueur' && !isSearching && !selectedCat ? (
          <Animated.View entering={FadeInDown.duration(300).delay(50)} style={st.section}>
            <View style={st.sectionHeaderRow}>
              <View style={[st.sectionHeaderIcon, { backgroundColor: '#2563EB15' }]}>
                <MaterialIcons name="flash-on" size={16} color="#2563EB" />
              </View>
              <Text style={st.sectionTitle}>{fr ? 'Actions rapides' : 'Quick Start'}</Text>
            </View>
            <View style={st.qaGrid}>{QUICK_ACTIONS.map(a => <QuickActionCard key={a.id} action={a} />)}</View>
          </Animated.View>
        ) : null}

        {/* Ambassador quick link */}
        {activeTab === 'ambassadeur' && !isSearching ? (
          <Pressable
            style={[st.quickLink, { borderColor: '#7C3AED30' }]}
            onPress={() => router.push('/ambassador-program' as any)}
          >
            <LinearGradient colors={['#7C3AED10', '#7C3AED05']} style={st.quickLinkInner}>
              <View style={[st.quickLinkIcon, { backgroundColor: '#7C3AED15' }]}>
                <MaterialIcons name="stars" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.quickLinkTitle}>{fr ? 'Programme Ambassadeur' : 'Ambassador Program'}</Text>
                <Text style={st.quickLinkSub}>{fr ? 'Voir les niveaux et avantages complets' : 'See full levels and benefits'}</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color="#7C3AED" />
            </LinearGradient>
          </Pressable>
        ) : null}

        {/* Partner quick links */}
        {activeTab === 'partenaire' && !isSearching ? (
          <View style={{ gap: 8, marginBottom: 16 }}>
            <Pressable
              style={[st.quickLink, { borderColor: '#D4A01730' }]}
              onPress={() => router.push('/partner-program' as any)}
            >
              <LinearGradient colors={['#D4A01710', '#D4A01705']} style={st.quickLinkInner}>
                <View style={[st.quickLinkIcon, { backgroundColor: '#D4A01715' }]}>
                  <MaterialIcons name="handshake" size={20} color="#D4A017" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.quickLinkTitle}>{fr ? 'Programme Partenaire' : 'Partner Program'}</Text>
                  <Text style={st.quickLinkSub}>{fr ? 'Niveaux, tarifs et comparaison' : 'Levels, pricing and comparison'}</Text>
                </View>
                <MaterialIcons name="arrow-forward-ios" size={14} color="#D4A017" />
              </LinearGradient>
            </Pressable>
            <Pressable
              style={[st.quickLink, { borderColor: '#2563EB30' }]}
              onPress={() => router.push('/sponsor-portal' as any)}
            >
              <LinearGradient colors={['#2563EB10', '#2563EB05']} style={st.quickLinkInner}>
                <View style={[st.quickLinkIcon, { backgroundColor: '#2563EB15' }]}>
                  <MaterialIcons name="dashboard" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.quickLinkTitle}>{fr ? 'Portail Partenaires' : 'Partner Portal'}</Text>
                  <Text style={st.quickLinkSub}>{fr ? 'Dashboard, analytics, push, CRM' : 'Dashboard, analytics, push, CRM'}</Text>
                </View>
                <MaterialIcons name="arrow-forward-ios" size={14} color="#2563EB" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {/* Category Chips */}
        <View style={st.section}>
          <View style={st.sectionHeaderRow}>
            <View style={[st.sectionHeaderIcon, { backgroundColor: activeTabConfig.color + '15' }]}>
              <MaterialIcons name="category" size={16} color={activeTabConfig.color} />
            </View>
            <Text style={st.sectionTitle}>{fr ? 'Themes' : 'Topics'}</Text>
            {selectedCat ? (
              <Pressable style={st.clearBtn} onPress={() => { Haptics.selectionAsync(); setSelectedCat(null); }}>
                <MaterialIcons name="close" size={14} color={activeTabConfig.color} />
                <Text style={[st.clearBtnText, { color: activeTabConfig.color }]}>{fr ? 'Voir tout' : 'See all'}</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.catScroll}>
            {faqData.map(cat => {
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
            <Text style={st.emptyTitle}>{fr ? 'Aucun resultat' : 'No results'}</Text>
            <Text style={st.emptyText}>{fr ? 'Essayez un autre terme ou changez de categorie.' : 'Try another term or change category.'}</Text>
            <Pressable style={st.emptyBtn} onPress={() => { Haptics.selectionAsync(); setSearch(''); setSelectedCat(null); }}>
              <MaterialIcons name="refresh" size={18} color={activeTabConfig.color} />
              <Text style={[st.emptyBtnText, { color: activeTabConfig.color }]}>{fr ? 'Reinitialiser' : 'Reset'}</Text>
            </Pressable>
          </View>
        )}

        {/* Contact */}
        <View style={st.contactCard}>
          <LinearGradient colors={[activeTabConfig.color + '08', activeTabConfig.color + '03']} style={st.contactInner}>
            <View style={[st.contactIconWrap, { backgroundColor: activeTabConfig.color + '12' }]}>
              <MaterialIcons name="forum" size={28} color={activeTabConfig.color} />
            </View>
            <Text style={st.contactTitle}>{fr ? 'Besoin d\'aide ?' : 'Need help?'}</Text>
            <Text style={st.contactSub}>{fr ? 'Notre equipe repond sous 24h' : 'Our team responds within 24h'}</Text>

            <Pressable style={[st.contactBtn, { borderColor: activeTabConfig.color + '20' }]} onPress={() => Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Ultimate%20Petanque%20-%20Aide')}>
              <View style={[st.contactBtnIcon, { backgroundColor: activeTabConfig.color + '15' }]}>
                <MaterialIcons name="email" size={22} color={activeTabConfig.color} />
              </View>
              <View style={st.contactBtnInfo}>
                <Text style={st.contactBtnTitle}>{fr ? 'Envoyer un email' : 'Send an email'}</Text>
                <Text style={st.contactBtnEmail}>ultimate.petanque.app@gmail.com</Text>
              </View>
              <View style={[st.contactBtnArrow, { backgroundColor: activeTabConfig.color + '15' }]}>
                <MaterialIcons name="arrow-forward" size={18} color={activeTabConfig.color} />
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
  // Hero
  hero: { borderRadius: 20, padding: 28, alignItems: 'center', marginTop: 16, marginBottom: 16, overflow: 'hidden', position: 'relative' },
  heroDecoCircle1: { position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroDecoCircle2: { position: 'absolute', bottom: -20, left: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },
  heroSearch: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroSearchInput: { flex: 1, fontSize: 15, color: '#FFF', padding: 0 },
  // Audience Tabs
  audienceTabsContainer: { flexDirection: 'row', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  audienceTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  audienceTabText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  // Quick links
  quickLink: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, marginBottom: 8 },
  quickLinkInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  quickLinkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLinkTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  quickLinkSub: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  // Search
  searchBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  searchBannerText: { flex: 1, fontSize: 13, color: theme.textMuted, fontStyle: 'italic' },
  searchBannerReset: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '12', borderRadius: 20 },
  searchBannerResetText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  // Sections
  section: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionHeaderIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.textPrimary, letterSpacing: 0.3 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.primary + '12', borderRadius: 20 },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  // Quick Actions
  qaGrid: { gap: 8 },
  qaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1.5, borderColor: theme.border },
  qaIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qaTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  qaSteps: { backgroundColor: theme.surface, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, borderWidth: 1.5, borderTopWidth: 0 },
  qaStep: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  qaStepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaStepNumText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  qaStepText: { fontSize: 14, color: theme.textPrimary, fontWeight: '500', flex: 1 },
  qaGoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, paddingVertical: 10, borderRadius: 12 },
  qaGoBtnText: { fontSize: 13, fontWeight: '600' },
  // Category chips
  catScroll: { paddingBottom: 4, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.surface, borderRadius: 20, borderWidth: 1.5, borderColor: theme.border },
  catChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  catChipBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  catChipBadgeText: { fontSize: 10, fontWeight: '700', color: theme.textMuted },
  // FAQ sections
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
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, backgroundColor: theme.surface, borderRadius: 16, marginBottom: 20 },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20, paddingHorizontal: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.primary + '15', borderRadius: 20 },
  emptyBtnText: { fontSize: 14, fontWeight: '600' },
  // Contact
  contactCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: theme.primary + '15' },
  contactInner: { padding: 24, alignItems: 'center' },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  contactTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', marginBottom: 4 },
  contactSub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginBottom: 20 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 12, borderWidth: 1 },
  contactBtnIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactBtnInfo: { flex: 1 },
  contactBtnTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  contactBtnEmail: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  contactBtnArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  version: { fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: 8 },
});
