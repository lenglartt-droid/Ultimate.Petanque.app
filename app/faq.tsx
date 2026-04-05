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

type AudienceTab = 'joueur' | 'club' | 'ambassadeur' | 'partenaire';

// ============================================
// FAQ DATA — Joueur (Player)
// Focus: Real game situations, practical use
// ============================================
function getPlayerFaq(fr: boolean): FAQCategory[] {
  return [
    {
      id: 'on_the_terrain',
      category: fr ? 'Sur le terrain' : 'On the Court',
      icon: 'sports',
      color: '#059669',
      description: fr ? 'Enregistrer matchs, defis et series pendant que vous jouez' : 'Record matches, challenges and series while you play',
      questions: [
        {
          id: 'ot1',
          q: fr ? 'Comment enregistrer un match en cours de partie ?' : 'How do I record a match while playing?',
          a: fr
            ? 'Appuyez sur "Match" depuis l\'accueil. Choisissez le mode (Entrainement ou Tournoi), le format (Tete-a-tete, Doublette, Triplette), puis ajoutez les joueurs des deux equipes. Notez le score mene par mene en un tap. Si vous le souhaitez, detaillez les actions de chaque joueur (tir reussi, point, carreau, raté) pour alimenter vos statistiques detaillees.'
            : 'Tap "Match" from home. Choose mode (Training or Tournament), format (Singles, Doubles, Triples), then add players for both teams. Record the score end by end with a single tap. Optionally detail each player\'s actions (successful shot, point, carreau, miss) to feed your detailed statistics.',
        },
        {
          id: 'ot2',
          q: fr ? 'Comment lancer un defi de tir (10 tirs, precision, 1v1) ?' : 'How do I start a shooting challenge (10 shots, precision, 1v1)?',
          a: fr
            ? 'Depuis l\'accueil > "Defi". Trois types : "10 Tirs" (classique ou sautee) pour mesurer votre regularite, "Precision" (5 ateliers : boule seule, derriere le but, entre 2 boules, sautee, tir au but) pour travailler les situations de jeu, ou "1 vs 1" pour defier un adversaire en face-a-face. L\'app calcule les resultats et genere un graphique radar comparatif.'
            : 'From home > "Challenge". Three types: "10 Shots" (classic or lob) to measure consistency, "Precision" (5 workshops: single boule, behind jack, between 2 boules, lob, jack shot) to practice game situations, or "1v1" to challenge an opponent head-to-head. The app calculates results and generates a comparative radar chart.',
        },
        {
          id: 'ot3',
          q: fr ? 'Comment jouer un Best of 3 ?' : 'How do I play a Best of 3?',
          a: fr
            ? 'Lors de la creation du match, activez "Serie Best of 3". L\'app enchaine les matchs automatiquement, comptabilise les victoires et declare le vainqueur de la serie. Chaque match reste consultable individuellement dans l\'historique.'
            : 'When creating a match, enable "Best of 3 Series". The app chains matches automatically, counts wins and declares the series winner. Each match remains individually viewable in history.',
        },
        {
          id: 'ot4',
          q: fr ? 'Comment changer de role en plein match ?' : 'How do I change roles during a match?',
          a: fr
            ? 'Lors de la notation d\'un match, chaque joueur a un role attribue (Pointeur, Milieu, Tireur). Pour changer de role en cours de partie, appuyez sur l\'icone de role a cote du nom du joueur et selectionnez le nouveau role. L\'app cree automatiquement un "segment de role" : les actions avant et apres le changement sont comptabilisees separement. Cela permet d\'analyser precisement vos performances dans chaque role au sein d\'un meme match.'
            : 'When recording a match, each player has an assigned role (Pointer, Middle, Shooter). To change roles mid-match, tap the role icon next to the player name and select the new role. The app automatically creates a "role segment": actions before and after the switch are tracked separately. This allows precise analysis of your performance in each role within the same match.',
        },
        {
          id: 'ot4b',
          q: fr ? 'Comment associer mes boules a un match ?' : 'How do I link my boules to a match?',
          a: fr
            ? 'Lors de la creation, selectionnez vos boules dans l\'option "Boules". Cela permet ensuite de comparer vos stats par equipement dans Stats > Performance : quelles boules vous conviennent le mieux au tir ? Au point ? Au carreau ?'
            : 'When creating, select your boules in the "Boules" option. This lets you compare per-equipment stats in Stats > Performance: which boules suit you best for shooting? Pointing? Carreaux?',
        },
        {
          id: 'ot5',
          q: fr ? 'Comment faire attester un resultat par un temoin present ?' : 'How do I get a result attested by a present witness?',
          a: fr
            ? 'Apres un match ou un defi, ouvrez le detail et appuyez sur "Attestation par temoins". Invitez un joueur present (max 2 temoins). Il recoit une notification et voit un snapshot fige de vos resultats. S\'il confirme, le poids du resultat passe a 2.0x dans le classement et votre score de confiance augmente. Fonctionne pour les matchs, defis solo et 1v1.'
            : 'After a match or challenge, open the detail and tap "Witness Attestation". Invite a present player (max 2 witnesses). They receive a notification and see a frozen snapshot of your results. If they confirm, the result weight goes to 2.0x in rankings and your trust score increases. Works for matches, solo challenges and 1v1.',
        },
        {
          id: 'ot6',
          q: fr ? 'Comment partager un match avec mes partenaires de jeu ?' : 'How do I share a match with my playing partners?',
          a: fr
            ? 'Ouvrez le detail d\'un match > "Partager". Choisissez parmi 4 options : partage WhatsApp/SMS/email, copie du code, copie de l\'invitation complete ou QR code. Definissez une expiration si souhaite. Quand votre partenaire accepte, le match apparait dans son historique et ses stats se mettent a jour automatiquement. En 1v1, l\'adversaire qui accepte genere aussi une attestation automatique.'
            : 'Open match detail > "Share". Choose from 4 options: WhatsApp/SMS/email share, copy code, copy full invitation or QR code. Set an expiration if desired. When your partner accepts, the match appears in their history and stats auto-update. In 1v1, the accepting opponent also generates an automatic attestation.',
        },
      ],
    },
    {
      id: 'tournaments_honors',
      category: fr ? 'Tournois & Palmares' : 'Tournaments & Honors',
      icon: 'emoji-events',
      color: '#B45309',
      description: fr ? 'Suivre vos competitions et construire votre palmares' : 'Track your competitions and build your honors',
      questions: [
        {
          id: 'th1',
          q: fr ? 'Comment suivre mon parcours dans un tournoi ?' : 'How do I track my tournament journey?',
          a: fr
            ? 'Creez un tournoi (Accueil > Tournoi) avec nom, date, lieu, format et type. Pour chaque match du tournoi, selectionnez-le comme contexte et precisez la phase (Poules, 1/8e, Quart, Demi, Finale). L\'app compile automatiquement votre parcours, resultat final et gain eventuel.'
            : 'Create a tournament (Home > Tournament) with name, date, location, format and type. For each tournament match, select it as context and specify the phase (Pool, Round of 16, Quarter, Semi, Final). The app automatically compiles your journey, final result and prize if any.',
        },
        {
          id: 'th2',
          q: fr ? 'Ou voir tous mes podiums et resultats ?' : 'Where can I see all my podiums and results?',
          a: fr
            ? 'Profil > "Palmares". Tous vos tournois sont classes par resultat : 1er, 2eme, 3eme, demi-finale, etc. Filtrez par periode, format (Doublette, Triplette, Tete-a-tete) ou type pour analyser votre progression.'
            : 'Profile > "Honors". All tournaments sorted by result: 1st, 2nd, 3rd, semi-final, etc. Filter by period, format (Doubles, Triples, Singles) or type to analyze progress.',
        },
        {
          id: 'th3',
          q: fr ? 'Comment suivre mes frais et gains de tournois ?' : 'How do I track tournament fees and winnings?',
          a: fr
            ? 'Dans chaque fiche tournoi, renseignez le "Cout d\'inscription" et le "Gain obtenu". Le "Bilan financier" (accessible depuis le profil) compile automatiquement : total depense, total gagne, solde net sur la saison. Indispensable pour les joueurs qui enchament les concours.'
            : 'In each tournament form, enter "Registration cost" and "Prize won". The "Financial Report" (from profile) automatically compiles: total spent, total won, net balance for the season. Essential for players doing many competitions.',
        },
      ],
    },
    {
      id: 'stats_ranking',
      category: fr ? 'Stats & Classement' : 'Stats & Ranking',
      icon: 'bar-chart',
      color: '#7C3AED',
      description: fr ? 'Comprendre vos forces, corriger vos faiblesses, monter au classement' : 'Understand strengths, fix weaknesses, climb the ranking',
      questions: [
        {
          id: 'sr1',
          q: fr ? 'Comment analyser mes stats de tir par technique ?' : 'How do I analyze shot stats by technique?',
          a: fr
            ? 'Stats > Tir : detail par technique (tir tendu, en cloche, en rafle, court-ramasse) avec nombre de tentatives, taux de reussite, et tableau croise avec l\'impact (point gagne, decisif, sans effet, negatif). Vous voyez immediatement ou progresser.'
            : 'Stats > Shot: breakdown by technique (flat, lob, running, pick-up) with attempts, success rate, and cross-reference with impact (point gained, decisive, neutral, negative). You see immediately where to improve.',
        },
        {
          id: 'sr2',
          q: fr ? 'Comment voir ma progression sur plusieurs mois ?' : 'How do I track my progression over months?',
          a: fr
            ? 'Appuyez sur "Progression" en haut de la page Stats. Choisissez la periode (4 semaines a 25 ans). Des graphiques interactifs montrent l\'evolution de votre taux de victoire, tir, point et carreaux dans le temps.'
            : 'Tap "Progression" at top of Stats. Choose period (4 weeks to 25 years). Interactive charts show the evolution of your win rate, shot, point and carreau rates over time.',
        },
        {
          id: 'sr3',
          q: fr ? 'Comment analyser mes erreurs pour progresser ?' : 'How do I analyze my errors to improve?',
          a: fr
            ? 'Stats > Erreurs : analyse par duree de match (fatigue en fin de partie ?), format, entrainement vs tournoi, erreurs consecutives. Pour le tir, l\'app identifie si vous manquez plutot court, long, a droite ou a gauche. Chaque type d\'erreur est accompagne d\'un conseil technique concret.'
            : 'Stats > Errors: analysis by match duration (fatigue late in games?), format, training vs tournament, consecutive errors. For shots, the app identifies if you miss short, long, right or left. Each error type includes a concrete coaching tip.',
        },
        {
          id: 'sr4',
          q: fr ? 'Comment fonctionne le classement ELO ?' : 'How does the ELO ranking work?',
          a: fr
            ? 'Le classement repose sur un systeme inspire du ELO, utilise dans les sports competitifs. Chaque resultat est analyse en tenant compte du niveau des adversaires, de l\'ecart de score et du contexte (match atteste, nombre de participants). 6 ligues : Bronze, Argent, Or, Diamant, Maitre, Grand Maitre. L\'ELO evolue plus vite en phase de placement (10 premiers matchs). En cas d\'inactivite (30+ jours), un declin progressif s\'applique (plancher a 800). Chaque janvier, une compression saisonniere rapproche les ELO de 1000 pour relancer la competition. Quand vous changez de ligue, une modal de celebration (promotion) ou d alerte (relegation) s affiche automatiquement.'
            : 'The ranking is based on an ELO-inspired system used in competitive sports. Each result factors in opponent level, score margin and context (attested match, participant count). 6 leagues: Bronze, Silver, Gold, Diamond, Master, Grand Master. ELO moves faster in placement phase (first 10 matches). After 30+ days of inactivity, a gradual decay applies (floor at 800). Each January, a seasonal compression brings ELOs closer to 1000 to restart competition. When you change league, a celebration modal (promotion) or alert (relegation) is shown automatically.',
        },
        {
          id: 'sr4b',
          q: fr ? 'Comment fonctionne l\'ELO par role (Tireur, Pointeur, Milieu) ?' : 'How does role-specific ELO (Shooter, Pointer, Middle) work?',
          a: fr
            ? 'En plus de votre ELO global, l\'app calcule un ELO separe pour chaque role : Tireur, Pointeur et Milieu. Lorsque vous jouez un match avec un role attribue, l\'ELO de ce role est mis a jour en fonction du resultat. Si vous changez de role en cours de match (segments de role), c\'est le role dans lequel vous avez le plus joue qui est pris en compte. Les 3 ELO par role sont visibles dans la section ELO de votre profil joueur, chacun avec son propre rang (Bronze a Maitre). Cela vous permet de voir dans quel role vous etes le plus competitif.'
            : 'In addition to your global ELO, the app calculates a separate ELO for each role: Shooter, Pointer and Middle. When you play a match with an assigned role, that role\'s ELO is updated based on the result. If you switch roles mid-match (role segments), the role with the most actions is used. All 3 role ELOs are visible in the ELO section of your player profile, each with its own rank (Bronze to Master). This lets you see which role you are most competitive in.',
        },
        {
          id: 'sr5',
          q: fr ? 'Quelle difference entre Classement et Experience ?' : 'What is the difference between Ranking and Experience?',
          a: fr
            ? 'Le classement est dynamique : il monte ou baisse a chaque match selon vos performances et le niveau adverse. L\'Experience est fixe : elle reflete vos annees de pratique (moins d\'1 an, 1-3 ans, 3-10 ans, 10+ ans). L\'un mesure votre niveau actuel, l\'autre votre vecu. Les deux sont visibles sur votre profil.'
            : 'Ranking is dynamic: it goes up or down with each match based on performance and opponent level. Experience is fixed: it reflects your years of practice (under 1 year, 1-3, 3-10, 10+). One measures current skill, the other your background. Both are visible on your profile.',
        },
        {
          id: 'sr6',
          q: fr ? 'Comment apparaitre dans le classement communautaire ?' : 'How do I appear in the community leaderboard?',
          a: fr
            ? 'Activez votre profil public et jouez au minimum 3 matchs publics. Filtrez le classement par zone (monde, continent, pays, ville), periode et critere. Le classement hebdomadaire est reinitialise chaque lundi.'
            : 'Enable your public profile and play at least 3 public matches. Filter the leaderboard by zone (world, continent, country, city), period and criteria. Weekly leaderboard resets every Monday.',
        },
        {
          id: 'sr6_global',
          q: fr ? 'Comment fonctionne le classement mondial et les ligues ?' : 'How does the global ranking and league system work?',
          a: fr
            ? 'Le classement mondial classe tous les joueurs publics par ELO. Six ligues progressives : Bronze (0-1099), Argent (1100-1199), Or (1200-1499), Diamant (1500-1799), Maitre (1800-1999), Grand Maitre (2000+). Votre rang mondial #X et votre ligue sont visibles sur votre profil et dans le widget classement de la page d accueil. Une barre de progression montre les ELO restants pour la promotion. L historique des promotions/relegations par saison est affiche sur votre fiche joueur. Le classement unifie (onglet Joueurs) integre les filtres geographiques, par ligue, par club, par marque de boules et par periode.'
            : 'The global ranking ranks all public players by ELO. Six progressive leagues: Bronze (0-1099), Silver (1100-1199), Gold (1200-1499), Diamond (1500-1799), Master (1800-1999), Grand Master (2000+). Your world rank #X and league are visible on your profile and in the home page ranking widget. A progress bar shows remaining ELO for promotion. Promotion/relegation history by season is shown on your player card. The unified leaderboard (Players tab) integrates geographic, league, club, boules brand and period filters.',
        },
        {
          id: 'sr6_feed',
          q: fr ? 'Comment fonctionne le fil d activite communautaire ?' : 'How does the community activity feed work?',
          a: fr
            ? 'Le fil d activite (icone flux dynamique en haut de l accueil) agrege automatiquement les evenements de la communaute sans posts manuels : resultats de matchs publics, badges debloques, mouvements ELO significatifs, records de la semaine, meetups et evenements sponsorises. Le fil inclut un digest hebdomadaire (top 3 joueurs, plus gros mouvement ELO, badge le plus debloque), des filtres par categorie (tous, matchs, badges, evenements, records), des reactions rapides, et un systeme de polling avec banniere de nouveaux elements. Il n y a aucune moderation necessaire car tout le contenu est genere automatiquement.'
            : 'The activity feed (dynamic feed icon at top of home) automatically aggregates community events without manual posts: public match results, unlocked badges, significant ELO movements, weekly records, meetups and sponsored events. The feed includes a weekly digest (top 3 players, biggest ELO move, most unlocked badge), category filters (all, matches, badges, events, records), quick reactions, and a polling system with new items banner. No moderation needed as all content is auto-generated.',
        },
        {
          id: 'sr6b',
          q: fr ? 'Comment fonctionne le classement des clubs ?' : 'How does the club ranking work?',
          a: fr
            ? 'Le classement des clubs est base sur un score composite calcule a partir des statistiques de tous les joueurs publics du club : nombre de victoires, matchs joues, taux de tir et carreaux. Les 3 meilleurs clubs par score apparaissent dans le widget Classements (onglet Communautaire) de la page d\'accueil. Appuyez sur un club pour voir le classement complet avec tous les joueurs du club, leur ELO et leurs stats.'
            : 'The club ranking is based on a composite score calculated from all public club players stats: wins, matches played, shot rate and carreaux. The top 3 clubs by score appear in the Rankings widget (Community tab) on the home page. Tap a club to see the full ranking with all club players, their ELO and stats.',
        },
        {
          id: 'sr6c',
          q: fr ? 'Comment fonctionne le classement par marque de boules ?' : 'How does the boules brand ranking work?',
          a: fr
            ? 'Le classement par marque de boules compile les victoires de tous les joueurs publics utilisant chaque marque. Les 3 marques les plus victorieuses apparaissent dans le widget Classements (onglet Communautaire) de la page d\'accueil. Pour contribuer, enregistrez vos boules dans Profil > Equipement et associez-les a vos matchs. Le classement complet par marque et modele est accessible depuis Classement > onglet Boules.'
            : 'The boules brand ranking compiles wins from all public players using each brand. The top 3 most victorious brands appear in the Rankings widget (Community tab) on the home page. To contribute, register your boules in Profile > Equipment and link them to your matches. The full ranking by brand and model is accessible from Leaderboard > Boules tab.',
        },
        {
          id: 'sr7',
          q: fr ? 'Comment le classement est-il protege contre la triche ?' : 'How is the ranking protected from cheating?',
          a: fr
            ? 'Un systeme interne de fiabilite (Trust Score) analyse les comportements de jeu, detecte automatiquement les anomalies et ajuste l\'impact des matchs si necessaire. Les activites suspectes sont limitees ou invisibilisees. Seuls les resultats fiables influencent le classement, garantissant une progression basee sur le merite. Consultez votre score de confiance depuis Profil > Score de Confiance (sous Mon Palmares).'
            : 'An internal reliability system (Trust Score) analyzes gameplay behaviors, detects anomalies automatically and adjusts match impact if needed. Suspicious activities are limited or hidden. Only reliable results influence ranking, ensuring merit-based progression. View your trust score from Profile > Trust Score (below My Honors).',
        },
        {
          id: 'sr8',
          q: fr ? 'Comment analyser mes performances par role (Tireur, Pointeur, Milieu) ?' : 'How do I analyze my performance by role (Shooter, Pointer, Middle)?',
          a: fr
            ? 'Depuis Stats > "Performance par Role". Un graphique radar compare vos taux de reussite au tir, au point, au carreau et votre taux de victoire pour chacun des 3 roles. Filtrez par periode (3 mois, 6 mois, 1 an, tout) et par format (Doublette, Triplette). L\'app identifie automatiquement votre meilleur role. Selectionnez un role individuel pour voir son radar detaille. La repartition des matchs par role est affichee en barre de distribution en bas de page. Un bouton d\'export CSV permet de telecharger toutes les stats par role.'
            : 'From Stats > "Role Performance". A radar chart compares your shot rate, point rate, carreau rate and win rate for each of the 3 roles. Filter by period (3 months, 6 months, 1 year, all) and format (Doubles, Triples). The app automatically identifies your best role. Select an individual role to see its detailed radar. Match distribution by role is shown as a bar at the bottom. A CSV export button lets you download all role stats.',
        },
        {
          id: 'sr9',
          q: fr ? 'Comment voir l\'evolution de mon role prefere dans le temps ?' : 'How do I see how my preferred role has evolved over time?',
          a: fr
            ? 'Sur votre profil joueur, la section "Evolution du role" affiche un graphique a barres empilees montrant la repartition Tireur/Pointeur/Milieu par periode (trimestre, semestre ou annee selon la quantite de donnees). L\'app detecte automatiquement si vous avez migre d\'un role a un autre (ex: Pointeur → Milieu → Tireur) et affiche le chemin de migration. Un bouton PDF permet d\'exporter le graphique, le chemin de migration et le tableau detaille par periode pour l\'imprimer ou le partager.'
            : 'On your player profile, the "Role Evolution" section shows a stacked bar chart displaying the Shooter/Pointer/Middle distribution per period (quarter, semester or year depending on data volume). The app automatically detects if you migrated from one role to another (e.g., Pointer → Middle → Shooter) and displays the migration path. A PDF button lets you export the chart, migration path and detailed per-period table for printing or sharing.',
        },
        {
          id: 'sr10',
          q: fr ? 'Comment comparer mes stats face-a-face avec un autre joueur ?' : 'How do I compare my stats head-to-head with another player?',
          a: fr
            ? 'Ouvrez le profil d\'un joueur contre qui vous avez joue. La section "Face-a-face par role" compare automatiquement vos performances respectives sur les matchs partages : taux de tir, taux de point, carreaux, pour chaque role (Tireur, Pointeur, Milieu). Le meilleur joueur dans chaque role est mis en evidence. Une recommandation d\'alignement optimal est proposee en bas de chaque comparaison de role.'
            : 'Open the profile of a player you have played against. The "Head-to-Head by Role" section automatically compares your respective performances on shared matches: shot rate, point rate, carreaux, for each role (Shooter, Pointer, Middle). The better player in each role is highlighted. An optimal alignment recommendation is suggested at the bottom of each role comparison.',
        },
      ],
    },
    {
      id: 'geo_leaderboard',
      category: fr ? 'Classement Geographique' : 'Geographic Ranking',
      icon: 'public',
      color: '#2563EB',
      description: fr ? 'Classement par ville, pays et continent' : 'Ranking by city, country and continent',
      questions: [
        {
          id: 'geo1',
          q: fr ? 'Comment fonctionne le classement geographique ?' : 'How does the geographic ranking work?',
          a: fr
            ? 'Le classement geographique classe les zones (villes, pays, continents) en fonction des joueurs publics qui y sont actifs. Chaque zone est evaluee sur un score composite incluant l\'ELO moyen, le taux de victoire, le nombre de joueurs et le total de matchs. Accessible depuis la page d\'accueil (widget Classements > onglet Geographique) ou via la page dediee "Classement Geo".'
            : 'The geographic ranking ranks zones (cities, countries, continents) based on active public players in each area. Each zone is scored using a composite metric including average ELO, win rate, player count and total matches. Accessible from the home page (Rankings widget > Geographic tab) or the dedicated "Geo Ranking" page.',
        },
        {
          id: 'geo2',
          q: fr ? 'Comment voir les classements par ville, pays et continent ?' : 'How do I view city, country and continent rankings?',
          a: fr
            ? 'Depuis le widget Classements sur l\'accueil, selectionnez l\'onglet Geographique puis choisissez Villes, Pays ou Continents. Le top 3 est affiche avec un podium visuel. Appuyez sur "Voir le classement geo complet" pour acceder a la page complete avec recherche et 5 criteres de tri (score composite, ELO moyen, taux de victoire, nombre de joueurs, total matchs).'
            : 'From the Rankings widget on home, select the Geographic tab then choose Cities, Countries or Continents. The top 3 is displayed with a visual podium. Tap "See full geo ranking" to access the complete page with search and 5 sort criteria (composite score, average ELO, win rate, player count, total matches).',
        },
        {
          id: 'geo3',
          q: fr ? 'Comment voir mon rang dans ma ville, mon pays et mon continent ?' : 'How do I see my rank in my city, country and continent?',
          a: fr
            ? 'Votre rang geographique est affiche a 3 endroits : (1) Sur votre fiche joueur ("Ma fiche"), entre les sections ELO et Lieu. (2) Sur votre profil joueur quand un autre joueur le consulte. (3) Dans la carte de partage quand vous partagez votre fiche. Les medailles or/argent/bronze sont affichees si vous etes dans le top 3 de votre zone.'
            : 'Your geographic rank is displayed in 3 places: (1) On your player card ("My Card"), between the ELO and Location sections. (2) On your player profile when another player views it. (3) In the share card when you share your profile. Gold/silver/bronze medals are shown if you are in the top 3 of your zone.',
        },
        {
          id: 'geo4',
          q: fr ? 'Comment apparaitre dans le classement geographique ?' : 'How do I appear in the geographic ranking?',
          a: fr
            ? 'Deux conditions : (1) Votre profil doit etre public (activez "Visibilite publique" depuis votre fiche joueur). (2) Votre localisation doit etre renseignee (ville et pays). La localisation est demandee lors de l\'inscription et peut etre modifiee a tout moment depuis votre profil ou la page d\'edition du joueur. L\'app utilise le reverse geocoding pour deduire automatiquement votre ville a partir de votre position.'
            : 'Two conditions: (1) Your profile must be public (enable "Public Visibility" from your player card). (2) Your location must be set (city and country). Location is requested during registration and can be changed at any time from your profile or player edit page. The app uses reverse geocoding to automatically deduce your city from your position.',
        },
        {
          id: 'geo5',
          q: fr ? 'Quels sont les badges geographiques ?' : 'What are the geographic badges?',
          a: fr
            ? '5 badges de leadership geographique : "Boss de la Ville" (#1 ELO de sa ville), "Champion du Quartier" (#1 ELO de son club), "Heros National" (#1 ELO de son pays), "Seigneur des Terrains" (#1 ELO de son continent), "Maitre Universel" (#1 ELO au monde). Chaque badge est attribue automatiquement et se met a jour dynamiquement : si un autre joueur vous depasse, il recupere le badge.'
            : '5 geographic leadership badges: "City Boss" (#1 ELO in your city), "Club Champion" (#1 ELO in your club), "National Hero" (#1 ELO in your country), "Continental Lord" (#1 ELO in your continent), "Universal Master" (#1 ELO worldwide). Each badge is awarded automatically and updates dynamically: if another player surpasses you, they get the badge.',
        },
        {
          id: 'geo6',
          q: fr ? 'Comment explorer le classement d\'une ville, d\'un pays ou d\'un continent specifique ?' : 'How do I explore the ranking of a specific city, country or continent?',
          a: fr
            ? 'Depuis le classement geo complet ou le widget Classements, appuyez sur n\'importe quelle zone (ville, pays ou continent) pour ouvrir sa page de detail. Vous y verrez tous les joueurs classes de cette zone avec leur ELO, taux de victoire et club. Vous pouvez basculer entre vue "All time" et "Hebdomadaire", et rechercher un joueur specifique.'
            : 'From the full geo ranking or the Rankings widget, tap any zone (city, country or continent) to open its detail page. You will see all ranked players in that zone with their ELO, win rate and club. You can switch between "All time" and "Weekly" views, and search for a specific player.',
        },
        {
          id: 'geo7',
          q: fr ? 'Pourquoi la localisation est-elle obligatoire ?' : 'Why is location mandatory?',
          a: fr
            ? 'La localisation est essentielle pour le classement geographique, la carte des joueurs/terrains/clubs, et les fonctionnalites de rencontre (RDV, meetups). Sans elle, il est impossible de savoir dans quelle ville ou pays vous vous situez. L\'app ne collecte que votre ville et pays (pas d\'adresse precise). Vous pouvez modifier votre ville a tout moment.'
            : 'Location is essential for the geographic ranking, the players/courts/clubs map, and meetup features. Without it, it is impossible to know which city or country you are in. The app only collects your city and country (not a precise address). You can change your city at any time.',
        },
      ],
    },
    {
      id: 'map_meetups',
      category: fr ? 'Carte, RDV & Rencontres' : 'Map, Meetups & Encounters',
      icon: 'map',
      color: '#0369A1',
      description: fr ? 'Trouver des terrains, organiser des parties, rencontrer des joueurs' : 'Find courts, organize games, meet players',
      questions: [
        {
          id: 'mm1',
          q: fr ? 'Comment trouver un terrain pres de chez moi ?' : 'How do I find a court near me?',
          a: fr
            ? 'Ouvrez l\'onglet "Carte". Tous les terrains publics sont affiches avec leur type de surface (gravier, sable, bitume, terre battue...), equipements (eclairage, couvert) et acces. Utilisez les sous-filtres pour affiner par type de surface ou environnement (interieur/exterieur).'
            : 'Open the "Map" tab. All public courts are shown with surface type (gravel, sand, asphalt, clay...), facilities (lighting, covered) and access. Use sub-filters to refine by surface type or environment (indoor/outdoor).',
        },
        {
          id: 'mm2',
          q: fr ? 'Comment organiser un RDV petanque ?' : 'How do I organize a petanque meetup?',
          a: fr
            ? 'Depuis "A Venir" sur l\'accueil > "+ RDV". Choisissez terrain, date/heure, nombre max de participants. Un code unique et un QR code sont generes automatiquement. Partagez-les ou invitez directement depuis l\'annuaire des joueurs. Suivez les confirmations en temps reel.'
            : 'From "Upcoming" on home > "+ Meetup". Choose court, date/time, max participants. A unique code and QR code are auto-generated. Share them or invite directly from the player directory. Track confirmations in real time.',
        },
        {
          id: 'mm3',
          q: fr ? 'Comment rejoindre un RDV ou un evenement ?' : 'How do I join a meetup or event?',
          a: fr
            ? 'Trois methodes : (1) Entrez le code dans le champ dedie. (2) Scannez le QR code avec le scanner en haut de l\'accueil. (3) Acceptez l\'invitation recue dans vos notifications. Pour les evenements sponsorises, consultez aussi la liste publique.'
            : 'Three methods: (1) Enter the code in the dedicated field. (2) Scan the QR code with the scanner at top of home. (3) Accept the invitation in your notifications. For sponsored events, also check the public list.',
        },
        {
          id: 'mm4',
          q: fr ? 'Comment filtrer la carte par joueurs, rang ELO ou tournois ?' : 'How do I filter the map by players, ELO rank or tournaments?',
          a: fr
            ? 'La carte propose des sous-filtres dynamiques selon la categorie. Joueurs : filtrez par rang ELO (Bronze a Maitre) et score de confiance. Terrains : par type de surface et environnement. Tournois : par format et statut (A venir, En cours). Seuls les elements geolocalises et publics apparaissent.'
            : 'The map offers dynamic sub-filters per category. Players: filter by ELO rank (Bronze to Master) and trust score. Terrains: by surface type and environment. Tournaments: by format and status (Upcoming, In Progress). Only geolocated public items appear.',
        },
      ],
    },
    {
      id: 'badges_xp',
      category: fr ? 'Badges, XP & Progression' : 'Badges, XP & Progression',
      icon: 'military-tech',
      color: '#F59E0B',
      description: fr ? 'Debloquer des badges grace a vos performances reelles' : 'Unlock badges through your real performances',
      questions: [
        {
          id: 'bx1',
          q: fr ? 'Quels badges puis-je debloquer et comment ?' : 'What badges can I unlock and how?',
          a: fr
            ? '13 badges bases sur des actions reelles : Premier Lancer (1 match), Statisticien (5 matchs), Oeil de Lynx (70% tir sur 10+ matchs), Roi du Carreau (10 carreaux), Social Player (1 partage accepte), Recruteur (3 joueurs invites), Explorateur (5 terrains differents), Classe (top 100), En Feu (7 jours consecutifs), Ambassadeur, Fiable (trust 65+), Verifie (trust 80+), Temoin Fiable (10 attestations). Chaque badge rapporte 30 a 100 XP.'
            : '13 badges based on real actions: First Throw (1 match), Statistician (5 matches), Eagle Eye (70% shot on 10+ matches), Carreau King (10 carreaux), Social Player (1 accepted share), Recruiter (3 invited players), Explorer (5 different courts), Ranked (top 100), On Fire (7 consecutive days), Ambassador, Trusted (trust 65+), Verified (trust 80+), Trusted Witness (10 attestations). Each gives 30 to 100 XP.',
        },
        {
          id: 'bx2',
          q: fr ? 'Comment gagner des XP ?' : 'How do I earn XP?',
          a: fr
            ? '4 sources : matchs joues (+10 XP), carreaux reussis (+5 XP), partages acceptes (+15 XP), badges debloques (+50 XP). L\'XP determine votre niveau : Debutant (0), Intermediaire (50), Confirme (200), Expert (500). La page Badges affiche la progression detaillee de chaque badge.'
            : '4 sources: matches played (+10 XP), successful carreaux (+5 XP), accepted shares (+15 XP), unlocked badges (+50 XP). XP determines your level: Beginner (0), Intermediate (50), Advanced (200), Expert (500). The Badges page shows detailed progress for each badge.',
        },
      ],
    },
    {
      id: 'equipment',
      category: fr ? 'Equipement & Boules' : 'Equipment & Boules',
      icon: 'sports-baseball',
      color: '#D97706',
      description: fr ? 'Gerer vos jeux de boules et comparer les performances' : 'Manage your boules sets and compare performance',
      questions: [
        {
          id: 'eq1',
          q: fr ? 'Comment enregistrer et comparer mes boules ?' : 'How do I register and compare my boules?',
          a: fr
            ? 'Profil > Equipement. Ajoutez nom, marque, diametre, poids, durete, numero de serie, photo et prix d\'achat. Definissez un equipement "principal" (pre-selectionne a la creation de matchs). Apres plusieurs matchs avec differentes boules, comparez les stats par equipement : taux de reussite au tir, au point, au carreau.'
            : 'Profile > Equipment. Add name, brand, diameter, weight, hardness, serial number, photo and purchase price. Set one as "primary" (pre-selected when creating matches). After several matches with different boules, compare per-equipment stats: shot, point and carreau success rates.',
        },
        {
          id: 'eq2',
          q: fr ? 'Comment voir le classement des boules par marque ?' : 'How do I see boules ranking by brand?',
          a: fr
            ? 'Classement > onglet Boules : les stats de tous les joueurs publics sont compilees par marque et modele (taux de victoire, tir, carreau, popularite). Filtrez par role (Tireur, Pointeur) pour des comparaisons pertinentes avant un achat.'
            : 'Leaderboard > Boules tab: all public player stats compiled by brand and model (win rate, shot, carreau, popularity). Filter by role (Shooter, Pointer) for relevant comparisons before a purchase.',
        },
      ],
    },
    {
      id: 'profile_sharing',
      category: fr ? 'Profil, Partage & Visibilite' : 'Profile, Sharing & Visibility',
      icon: 'share',
      color: '#10B981',
      description: fr ? 'Gerer votre profil public, QR code et options de partage' : 'Manage your public profile, QR code and sharing options',
      questions: [
        {
          id: 'ps1',
          q: fr ? 'A quoi sert le QR code personnel ?' : 'What is the personal QR code for?',
          a: fr
            ? 'Appuyez sur l\'icone QR en haut de l\'accueil. Les autres joueurs le scannent pour voir votre profil, stats et palmares. Ideal pour echanger rapidement lors d\'un tournoi. Vous pouvez aussi scanner les QR des terrains, RDV et evenements sponsorises.'
            : 'Tap the QR icon at top of home. Other players scan it to see your profile, stats and honors. Ideal for quick exchanges at tournaments. You can also scan QR codes for courts, meetups and sponsored events.',
        },
        {
          id: 'ps2',
          q: fr ? 'Comment rendre mon profil visible sur la carte et les classements ?' : 'How do I make my profile visible on the map and rankings?',
          a: fr
            ? 'Depuis votre fiche joueur, activez "Visibilite publique". Vous apparaitrez sur la carte (si geolocalise) et dans les classements (apres 3 matchs publics). Vous pouvez controler la visibilite de vos contacts (email, telephone) independamment.'
            : 'From your player card, enable "Public Visibility". You will appear on the map (if geolocated) and in rankings (after 3 public matches). You can control contact visibility (email, phone) independently.',
        },
        {
          id: 'ps3',
          q: fr ? 'Comment partager une fiche (joueur, club, terrain, tournoi) ?' : 'How do I share a card (player, club, terrain, tournament)?',
          a: fr
            ? 'Appuyez sur "Partager" en haut de n\'importe quelle fiche. Une page plein ecran affiche un apercu detaille. 4 modes : partage natif (WhatsApp, SMS, email), copie du code, copie de l\'invitation ou QR code. Definissez une expiration (illimitee, 1 jour, 1 semaine, 1 mois).'
            : 'Tap "Share" at top of any card. A full-screen page shows a detailed preview. 4 modes: native share (WhatsApp, SMS, email), copy code, copy invitation or QR code. Set expiration (unlimited, 1 day, 1 week, 1 month).',
        },
        {
          id: 'ps4',
          q: fr ? 'Comment partager mes resultats sur les reseaux sociaux (Instagram, WhatsApp, etc.) ?' : 'How do I share my results on social media (Instagram, WhatsApp, etc.)?',
          a: fr
            ? 'L\'app genere des cartes visuelles partageables pour 9 types de contenu : match, badge, statistiques, defi, tournoi, face-a-face, evenement sponsorise, classement d\'evenement et palmares. Depuis le detail d\'un match, defi ou profil, appuyez sur l\'icone de partage puis selectionnez "Carte visuelle". Choisissez le format (carre pour Instagram, story 9:16 pour Instagram/TikTok, paysage pour Twitter/Facebook), le theme de couleur (sombre ou clair) et l\'app genere une image haute qualite avec vos stats, votre rang ELO, votre classement geographique et un QR code watermark. Partagez directement via WhatsApp, Instagram Stories, ou enregistrez l\'image dans votre galerie. Toutes les cartes incluent automatiquement le logo de l\'app et un QR code pour que les autres joueurs puissent scanner et voir votre profil.'
            : 'The app generates shareable visual cards for 9 content types: match, badge, stats, challenge, tournament, head-to-head, sponsored event, event leaderboard and honors. From a match, challenge or profile detail, tap the share icon then select "Visual Card". Choose format (square for Instagram, 9:16 story for Instagram/TikTok, landscape for Twitter/Facebook), color theme (dark or light) and the app generates a high-quality image with your stats, ELO rank, geographic ranking and QR watermark. Share directly via WhatsApp, Instagram Stories, or save to your gallery. All cards automatically include the app logo and a QR code so other players can scan and view your profile.',
        },
      ],
    },
    {
      id: 'account',
      category: fr ? 'Compte & Donnees' : 'Account & Data',
      icon: 'settings',
      color: '#64748B',
      description: fr ? 'Parametres, export, notifications, mode hors-ligne' : 'Settings, export, notifications, offline mode',
      questions: [
        {
          id: 'ac1',
          q: fr ? 'Comment changer la langue ?' : 'How do I change language?',
          a: fr
            ? 'Depuis le profil, appuyez sur le drapeau (FR/EN) en haut a droite. Le changement est instantane. L\'application est entierement disponible en francais et en anglais.'
            : 'From profile, tap the flag (FR/EN) at top right. Change is instant. The app is fully available in French and English.',
        },
        {
          id: 'ac2',
          q: fr ? 'Comment exporter mes donnees ?' : 'How do I export my data?',
          a: fr
            ? 'Plusieurs options d\'export : (1) Profil > Exporter les donnees : choisissez CSV ou PDF pour matchs, defis, statistiques, avec presets (tournoi, saison, comparatif, joueur). (2) Page Performance par Role : export CSV des stats detaillees par role (taux de tir, point, carreau, victoires). (3) Section Evolution du Role (profil joueur) : export PDF avec graphique de tendance saisonniere, chemin de migration et tableau detaille. Tous les CSV sont compatibles Excel et Google Sheets.'
            : 'Multiple export options: (1) Profile > Export data: choose CSV or PDF for matches, challenges, statistics, with presets (tournament, season, comparative, player). (2) Role Performance page: CSV export of detailed per-role stats (shot, point, carreau rates, wins). (3) Role Evolution section (player profile): PDF export with seasonal trend chart, migration path and detailed table. All CSVs are compatible with Excel and Google Sheets.',
        },
        {
          id: 'ac3',
          q: fr ? 'L\'application fonctionne-t-elle hors-ligne ?' : 'Does the app work offline?',
          a: fr
            ? 'Oui. L\'app dispose d\'un cache local et d\'une queue offline. Matchs et defis sont sauvegardes localement et synchronises a la reconnexion. Si un conflit est detecte entre vos donnees et le serveur, une fenetre de resolution apparait.'
            : 'Yes. The app has local cache and offline queue. Matches and challenges are saved locally and synced on reconnection. If a conflict is detected between your data and the server, a resolution window appears.',
        },
        {
          id: 'ac4',
          q: fr ? 'Comment gerer mes notifications ?' : 'How do I manage notifications?',
          a: fr
            ? 'Profil > Preferences de notifications. Activez/desactivez individuellement : invitations RDV, demandes de partage, evenements sponsorises, changements de classement, rappels.'
            : 'Profile > Notification preferences. Toggle individually: meetup invitations, share requests, sponsored events, ranking changes, reminders.',
        },
        {
          id: 'ac5',
          q: fr ? 'Comment supprimer les publicites ?' : 'How do I remove ads?',
          a: fr
            ? 'Profil > Supprimer les publicites. Achat unique qui retire toutes les bannieres. Lie a votre compte Apple/Google et restaurable.'
            : 'Profile > Remove ads. One-time purchase removing all banners. Linked to your Apple/Google account and restorable.',
        },
        {
          id: 'ac6',
          q: fr ? 'Comment supprimer mon compte ?' : 'How do I delete my account?',
          a: fr
            ? 'Profil > Mot de passe et securite > Supprimer mon compte. Action irreversible : toutes vos donnees sont definitivement supprimees. Les elements partages sont retires de la vue des autres joueurs.'
            : 'Profile > Password & security > Delete my account. Irreversible: all data permanently deleted. Shared items removed from other players\' view.',
        },
        {
          id: 'ac7',
          q: fr ? 'Comment gerer les doublons dans mon annuaire ?' : 'How do I manage duplicates in my directory?',
          a: fr
            ? 'L\'app detecte automatiquement les doublons (noms similaires). Une banniere jaune apparait. Pour les doublons a 90%+, "Fusion rapide" fusionne automatiquement. Sinon, choisissez champ par champ. Reversible pendant 24h.'
            : 'The app detects duplicates automatically (similar names). A yellow banner appears. For 90%+ duplicates, "Quick Merge" merges automatically. Otherwise, choose field by field. Reversible for 24h.',
        },
      ],
    },
    {
      id: 'roadmap',
      category: fr ? 'Roadmap V2' : 'V2 Roadmap',
      icon: 'rocket-launch',
      color: '#7C3AED',
      description: fr ? 'Fonctionnalites a venir et comment voter' : 'Upcoming features and how to vote',
      questions: [
        {
          id: 'rm1',
          q: fr ? 'Quelles fonctionnalites arrivent dans la V2 ?' : 'What features are coming in V2?',
          a: fr
            ? '8 fonctionnalites majeures : Coach IA, Mode Match Live, Feed Social, Gestion Tournois avancee, Messagerie integree, Programmes d\'entrainement, Ligues saisonnieres et Analyse video. Votez depuis la page Roadmap (Profil > A propos) pour orienter les priorites.'
            : '8 major features: AI Coach, Live Match Mode, Social Feed, Advanced Tournament Management, Messaging, Training Programs, Seasonal Leagues and Video Analysis. Vote from the Roadmap page (Profile > About) to influence priorities.',
        },
        {
          id: 'rm2',
          q: fr ? 'Quand la V2 sera-t-elle lancee ?' : 'When will V2 launch?',
          a: fr
            ? 'Le developpement debutera a partir de 1000 joueurs actifs. La jauge de progression est visible sur la page Roadmap. Plus la communaute grandit, plus vite la V2 arrivera.'
            : 'Development begins at 1000 active players. The progress gauge is visible on the Roadmap page. The faster the community grows, the sooner V2 arrives.',
        },
      ],
    },
  ];
}

// ============================================
// FAQ DATA — Club
// Focus: Managing a club, members, terrain, verification
// ============================================
function getClubFaq(fr: boolean): FAQCategory[] {
  return [
    {
      id: 'club_basics',
      category: fr ? 'Creer & Gerer un club' : 'Create & Manage a Club',
      icon: 'home',
      color: '#7C3AED',
      description: fr ? 'Creer votre fiche club, ajouter des informations et des membres' : 'Create your club card, add information and members',
      questions: [
        {
          id: 'cb1',
          q: fr ? 'Comment creer la fiche de mon club ?' : 'How do I create my club card?',
          a: fr
            ? 'Depuis l\'annuaire > onglet Clubs > "+ Club". Renseignez nom, ville, adresse, description, equipements, contact et logo. Plus la fiche est complete, plus votre score de completude sera eleve, ce qui facilite la verification.'
            : 'From directory > Clubs tab > "+ Club". Enter name, city, address, description, facilities, contact and logo. The more complete the card, the higher your completeness score, which facilitates verification.',
        },
        {
          id: 'cb2',
          q: fr ? 'Comment associer un terrain a mon club ?' : 'How do I link a terrain to my club?',
          a: fr
            ? 'Lors de la creation ou de la modification du club, selectionnez un terrain existant dans le champ "Terrain". Plusieurs clubs peuvent partager le meme terrain. Sur la page du terrain, tous les clubs qui l\'utilisent sont affiches.'
            : 'When creating or editing the club, select an existing terrain in the "Terrain" field. Multiple clubs can share the same terrain. On the terrain page, all clubs using it are displayed.',
        },
        {
          id: 'cb3',
          q: fr ? 'Comment ajouter des co-administrateurs ?' : 'How do I add co-administrators?',
          a: fr
            ? 'Sur la page de votre club > "Gerer les co-admins". Recherchez un joueur par nom ou email et ajoutez-le. Les co-admins peuvent modifier les informations du club, gerer les membres et les equipements selon les permissions que vous leur accordez.'
            : 'On your club page > "Manage co-admins". Search a player by name or email and add them. Co-admins can edit club info, manage members and facilities based on the permissions you grant.',
        },
      ],
    },
    {
      id: 'club_verification',
      category: fr ? 'Verification & Badge Verifie' : 'Verification & Verified Badge',
      icon: 'verified',
      color: '#2563EB',
      description: fr ? 'Obtenir le badge bleu pour votre club' : 'Get the blue badge for your club',
      questions: [
        {
          id: 'cv1',
          q: fr ? 'Comment obtenir le badge "Verifie" ?' : 'How do I get the "Verified" badge?',
          a: fr
            ? 'Le badge bleu est attribue de deux manieres : (1) Remplissez les criteres de completude (adresse, 2+ membres, description, contact, logo, 5+ matchs) et l\'equipe admin validera. (2) Revendiquez un club existant : si un joueur a cree votre fiche club avant vous, appuyez sur "Revendiquer ce club" en bas de la page. Le proprietaire recoit la demande et peut accepter le transfert.'
            : 'The blue badge is awarded in two ways: (1) Meet completeness criteria (address, 2+ members, description, contact, logo, 5+ matches) and the admin team will validate. (2) Claim an existing club: if a player created your club card before you, tap "Claim this club" at bottom of the page. The owner receives the request and can accept the transfer.',
        },
        {
          id: 'cv2',
          q: fr ? 'Que signifie le badge "Verifie" pour les joueurs ?' : 'What does "Verified" mean for players?',
          a: fr
            ? 'Le badge bleu garantit aux joueurs que le club est gere par son representant officiel. Les informations (horaires, contact, equipements, localisation) sont fiables et a jour. Les clubs verifies apparaissent en priorite sur la carte avec un marqueur distinctif.'
            : 'The blue badge guarantees players the club is managed by its official representative. Information (hours, contact, facilities, location) is reliable and up to date. Verified clubs appear as a priority on the map with a distinctive marker.',
        },
        {
          id: 'cv3',
          q: fr ? 'Ou voir les demandes de revendication recues ?' : 'Where do I see received claim requests?',
          a: fr
            ? 'Deux endroits : (1) Sur la page de votre club > section "Revendications en attente". (2) Dans le Hub Notifications > onglet "Clubs". Vous pouvez accepter ou refuser depuis les deux. L\'ancien proprietaire conserve un badge Contributeur.'
            : 'Two places: (1) On your club page > "Pending Claims" section. (2) In Notification Hub > "Claims" tab. You can accept or decline from both. The original owner keeps a Contributor badge.',
        },
      ],
    },
    {
      id: 'club_visibility',
      category: fr ? 'Visibilite & Carte' : 'Visibility & Map',
      icon: 'public',
      color: '#10B981',
      description: fr ? 'Rendre votre club visible et attirer des joueurs' : 'Make your club visible and attract players',
      questions: [
        {
          id: 'cvis1',
          q: fr ? 'Comment rendre mon club visible sur la carte ?' : 'How do I make my club visible on the map?',
          a: fr
            ? 'Activez "Public" dans les parametres du club et assurez-vous qu\'il est geolocalise (adresse renseignee). Les clubs publics apparaissent sur la carte avec un marqueur dont la couleur reflete le score de sante (vert = actif, orange = modere, rouge = faible). Les clubs verifies ont un badge bleu supplementaire.'
            : 'Enable "Public" in club settings and ensure it is geolocated (address filled). Public clubs appear on the map with a marker whose color reflects health score (green = active, orange = moderate, red = low). Verified clubs have an additional blue badge.',
        },
        {
          id: 'cvis2',
          q: fr ? 'Comment controler quelles informations sont visibles ?' : 'How do I control which information is visible?',
          a: fr
            ? 'Deux toggles independants : "Public" rend la fiche du club visible sur la carte et dans l\'annuaire. "Contacts visibles" controle si votre email et telephone apparaissent dans la fiche publique et les partages. Vous pouvez etre public sans exposer vos contacts.'
            : 'Two independent toggles: "Public" makes the club card visible on the map and directory. "Contacts visible" controls whether email and phone appear in the public card and shares. You can be public without exposing contacts.',
        },
        {
          id: 'cvis3',
          q: fr ? 'Comment partager la fiche de mon club ?' : 'How do I share my club card?',
          a: fr
            ? 'Depuis la fiche du club > "Partager". Une page plein ecran affiche l\'apercu (logo, nom, ville, membres, equipements). 4 modes de partage : natif (WhatsApp, SMS), code, invitation complete ou QR code. Ideal pour recruter de nouveaux membres.'
            : 'From club card > "Share". A full-screen page shows the preview (logo, name, city, members, facilities). 4 sharing modes: native (WhatsApp, SMS), code, full invitation or QR code. Ideal for recruiting new members.',
        },
      ],
    },
    {
      id: 'club_activity',
      category: fr ? 'Activite & Score de sante' : 'Activity & Health Score',
      icon: 'favorite',
      color: '#EF4444',
      description: fr ? 'Comprendre et ameliorer l\'activite de votre club' : 'Understand and improve your club\'s activity',
      questions: [
        {
          id: 'ca1',
          q: fr ? 'Qu\'est-ce que le score de sante du club ?' : 'What is the club health score?',
          a: fr
            ? 'Un indicateur de 0 a 100 calcule sur les 30 derniers jours, base sur : nombre de matchs joues par les membres, tournois organises, nombre de membres actifs et anciennete du club. Les clubs actifs (70+) apparaissent en vert sur la carte, moderes (40-69) en orange, faibles (15-39) en rouge, inactifs (-15) en gris.'
            : 'A 0-100 indicator calculated over the last 30 days, based on: matches played by members, tournaments organized, active member count and club age. Active clubs (70+) appear green on the map, moderate (40-69) orange, low (15-39) red, inactive (-15) gray.',
        },
        {
          id: 'ca2',
          q: fr ? 'Comment ameliorer le score de sante ?' : 'How do I improve the health score?',
          a: fr
            ? 'Encouragez vos membres a enregistrer leurs matchs dans l\'app (+3 points par match). Organisez des tournois (+10 points par tournoi). Augmentez le nombre de membres actifs. Plus l\'activite est reguliere, meilleur est le score.'
            : 'Encourage members to record matches in the app (+3 points per match). Organize tournaments (+10 points per tournament). Increase active member count. The more regular the activity, the better the score.',
        },
      ],
    },
  ];
}

// ============================================
// FAQ DATA — Ambassadeur
// ============================================
function getAmbassadorFaq(fr: boolean): FAQCategory[] {
  return [
    {
      id: 'amb_program',
      category: fr ? 'Devenir Ambassadeur' : 'Becoming an Ambassador',
      icon: 'stars',
      color: '#7C3AED',
      description: fr ? 'Representer la communaute et progresser' : 'Represent the community and progress',
      questions: [
        {
          id: 'ap1',
          q: fr ? 'Comment devenir ambassadeur ?' : 'How do I become an ambassador?',
          a: fr
            ? 'Contactez l\'equipe via la page ambassadeurs ou par email. Le programme comporte 3 niveaux progressifs : Decouverte (debut), Confirme (50+ parrainages, 3+ defis, 500+ impressions) et Elite (100+ parrainages, 10+ defis, 2000+ impressions). La promotion est automatique des que les criteres sont atteints.'
            : 'Contact the team via the ambassadors page or email. The program has 3 progressive levels: Discovery (start), Confirmed (50+ referrals, 3+ challenges, 500+ impressions) and Elite (100+ referrals, 10+ challenges, 2000+ impressions). Promotion is automatic when criteria are met.',
        },
        {
          id: 'ap2',
          q: fr ? 'Quels avantages par niveau ?' : 'What benefits per level?',
          a: fr
            ? 'Decouverte : profil public, code parrainage, badge, 2 defis sponsorises/mois. Confirme : + banniere rotative accueil, dashboard analytics complet, defis illimites, badge violet. Elite : + banniere avec accent dore, section onboarding, push illimites, analytics avances avec export, badge dore, acces anticipe aux nouveautés.'
            : 'Discovery: public profile, referral code, badge, 2 sponsored challenges/month. Confirmed: + rotating home banner, full analytics dashboard, unlimited challenges, purple badge. Elite: + gold accent banner, onboarding section, unlimited push, advanced analytics with export, gold badge, early feature access.',
        },
        {
          id: 'ap3',
          q: fr ? 'Quelle difference avec un partenaire ?' : 'What is the difference from a partner?',
          a: fr
            ? 'Les ambassadeurs sont des joueurs passionnes qui representent benevolement la communaute. Les partenaires sont des marques ou structures avec une visibilite business et des outils avances (A/B testing, CRM, heatmap).'
            : 'Ambassadors are passionate players voluntarily representing the community. Partners are brands with business visibility and advanced tools (A/B testing, CRM, heatmap).',
        },
      ],
    },
    {
      id: 'amb_actions',
      category: fr ? 'Parrainer & Organiser des defis' : 'Referral & Organizing Challenges',
      icon: 'person-add',
      color: '#10B981',
      description: fr ? 'Gagner des XP et animer la communaute' : 'Earn XP and engage the community',
      questions: [
        {
          id: 'aa1',
          q: fr ? 'Comment fonctionne le parrainage ?' : 'How does referral work?',
          a: fr
            ? 'Partagez votre code unique (visible dans le portail). Quand un joueur s\'inscrit avec votre code, vous gagnez 50 XP. Atteignez 50 parrainages pour le niveau Confirme, 100 pour Elite.'
            : 'Share your unique code (visible in portal). When a player signs up with your code, you earn 50 XP. Reach 50 referrals for Confirmed, 100 for Elite.',
        },
        {
          id: 'aa2',
          q: fr ? 'Comment creer un evenement sponsorise ?' : 'How do I create a sponsored event?',
          a: fr
            ? 'Depuis le portail ambassadeur ou la page Defis. Choisissez type de defi, date, terrain, nombre max de participants. Un code et QR code sont generes. Les participants rejoignent via code, liste publique ou QR. Les resultats sont valides par des temoins presents.'
            : 'From ambassador portal or Challenges page. Choose challenge type, date, court, max participants. A code and QR code are generated. Participants join via code, public list or QR. Results are validated by present witnesses.',
        },
        {
          id: 'aa3',
          q: fr ? 'Quelles sources d\'XP pour un ambassadeur ?' : 'What XP sources for an ambassador?',
          a: fr
            ? 'Parrainage valide : +50 XP. Defi sponsorise cree : +25 XP. 100 impressions cumulees : +10 XP. S\'ajoutent aux sources classiques (matchs, carreaux, badges).'
            : 'Valid referral: +50 XP. Sponsored challenge created: +25 XP. 100 cumulative impressions: +10 XP. Added to classic sources (matches, carreaux, badges).',
        },
      ],
    },
    {
      id: 'amb_portal',
      category: fr ? 'Portail & Analytics' : 'Portal & Analytics',
      icon: 'dashboard',
      color: '#2563EB',
      description: fr ? 'Suivre vos performances et votre visibilite' : 'Track your performance and visibility',
      questions: [
        {
          id: 'pt1',
          q: fr ? 'Que contient le portail ambassadeur ?' : 'What does the ambassador portal contain?',
          a: fr
            ? 'Stats en temps reel : impressions, clics, parrainages, evenements. Creation de defis sponsorises, progression vers le niveau superieur, code parrainage. Les niveaux Confirme et Elite ont le dashboard analytics complet avec filtres par periode.'
            : 'Real-time stats: impressions, clicks, referrals, events. Create sponsored challenges, track level progression, referral code. Confirmed and Elite levels have full analytics dashboard with period filters.',
        },
        {
          id: 'pt2',
          q: fr ? 'Ou suis-je visible dans l\'app ?' : 'Where am I visible in the app?',
          a: fr
            ? 'Page "Nos Ambassadeurs" (profil complet avec reseaux sociaux), banniere rotative accueil (Confirme/Elite), page de parrainage, QR code du profil, liste des evenements sponsorises. Les Elite apparaissent aussi dans l\'onboarding des nouveaux joueurs.'
            : '"Our Ambassadors" page (full profile with social media), rotating home banner (Confirmed/Elite), referral page, profile QR code, sponsored events list. Elite also appear in new player onboarding.',
        },
      ],
    },
  ];
}

// ============================================
// FAQ DATA — Partenaire (Partner)
// ============================================
function getPartnerFaq(fr: boolean): FAQCategory[] {
  return [
    {
      id: 'par_program',
      category: fr ? 'Devenir Partenaire' : 'Becoming a Partner',
      icon: 'handshake',
      color: '#D4A017',
      description: fr ? 'Niveaux, avantages et mise en place' : 'Levels, benefits and setup',
      questions: [
        {
          id: 'pp1',
          q: fr ? 'Comment devenir partenaire ?' : 'How do I become a partner?',
          a: fr
            ? 'Consultez la page "Programme Partenaire" (Nos Partenaires > lien en haut). Contactez-nous par email avec votre projet. Nous repondons sous 48h avec une proposition personnalisee.'
            : 'Check "Partner Program" page (Our Partners > top link). Contact us by email with your project. We respond within 48h with a personalized proposal.',
        },
        {
          id: 'pp2',
          q: fr ? 'Quels sont les 3 niveaux ?' : 'What are the 3 levels?',
          a: fr
            ? 'Bronze (sur devis) : fiche partenaire, badge, lien site, stats de base, marqueur carte a votre couleur de marque. Argent : + banniere rotative accueil, 1 push/mois, dashboard analytics, templates push, export CSV/PDF. Or : + banniere permanente, section onboarding, push illimites avec A/B testing, heatmap, calculateur ROI, CRM, kit de marque, digest hebdomadaire.'
            : 'Bronze (on quote): partner card, badge, website link, basic stats, map marker in your brand color. Silver: + rotating home banner, 1 push/month, analytics dashboard, push templates, CSV/PDF export. Gold: + permanent banner, onboarding section, unlimited push with A/B testing, heatmap, ROI calculator, CRM, brand kit, weekly digest.',
        },
      ],
    },
    {
      id: 'par_portal',
      category: fr ? 'Portail & Outils Business' : 'Portal & Business Tools',
      icon: 'dashboard',
      color: '#2563EB',
      description: fr ? 'ROI, branding, push, CRM' : 'ROI, branding, push, CRM',
      questions: [
        {
          id: 'po1',
          q: fr ? 'Que contient le portail partenaires ?' : 'What does the partner portal contain?',
          a: fr
            ? '6 onglets : ROI (impressions, clics, CTR, benchmark, objectifs, calculateur), Placement (vos emplacements dans l\'app), Branding (logo, couleur de marque, apercu banniere et carte), Push (composer, templates, A/B test, programmer), Events (defis sponsorises), CRM (parrainages avec suivi et export).'
            : '6 tabs: ROI (impressions, clicks, CTR, benchmark, goals, calculator), Placement (your app placements), Branding (logo, brand color, banner and map preview), Push (compose, templates, A/B test, schedule), Events (sponsored challenges), CRM (referrals with tracking and export).',
        },
        {
          id: 'po2',
          q: fr ? 'Comment personnaliser mon branding ?' : 'How do I customize my branding?',
          a: fr
            ? 'Onglet Branding : uploadez votre logo (80-96px selon le tier), choisissez votre couleur de marque. Apercu en temps reel de votre banniere et marqueur carte. Votre page partenaire publique utilise votre couleur en gradient.'
            : 'Branding tab: upload your logo (80-96px by tier), choose your brand color. Real-time preview of your banner and map marker. Your public partner page uses your color as gradient.',
        },
        {
          id: 'po3',
          q: fr ? 'Comment suivre mon ROI ?' : 'How do I track my ROI?',
          a: fr
            ? 'Onglet ROI : KPIs en temps reel. Definissez des objectifs mensuels avec anneaux de progression. Renseignez votre budget pour calculer CPM, CPC et ROI. Le benchmark compare vos performances avec les partenaires de votre tier.'
            : 'ROI tab: real-time KPIs. Set monthly goals with progress rings. Enter budget to calculate CPM, CPC and ROI. Benchmark compares performance with same-tier partners.',
        },
      ],
    },
    {
      id: 'par_push',
      category: fr ? 'Push & Communication' : 'Push & Communication',
      icon: 'notifications-active',
      color: '#DC2626',
      description: fr ? 'Envoyer des messages cibles aux joueurs' : 'Send targeted messages to players',
      questions: [
        {
          id: 'pn1',
          q: fr ? 'Comment envoyer une push notification ?' : 'How do I send a push notification?',
          a: fr
            ? 'Onglet Push. Composez titre + message, choisissez la cible (tous ou filtre geographique). Programmez avec creneaux predefinis (matin, midi, soir) ou date personnalisee. Apercu iOS/Android realiste. Argent : 1 push/mois. Or : illimite.'
            : 'Push tab. Compose title + message, choose target (all or geographic filter). Schedule with predefined slots (morning, noon, evening) or custom date. Realistic iOS/Android preview. Silver: 1 push/month. Gold: unlimited.',
        },
        {
          id: 'pn2',
          q: fr ? 'Comment fonctionne le A/B testing ?' : 'How does A/B testing work?',
          a: fr
            ? 'Or uniquement. Redigez 2 variantes du meme message. 50% des destinataires recoit chaque variante. Les resultats montrent le taux d\'ouverture par variante, le niveau de confiance statistique et l\'historique complet. Optimisez vos futures campagnes.'
            : 'Gold only. Write 2 variants of the same message. 50% of recipients get each. Results show open rate per variant, statistical confidence and full history. Optimize future campaigns.',
        },
        {
          id: 'pn3',
          q: fr ? 'Quels templates push sont disponibles ?' : 'What push templates are available?',
          a: fr
            ? '7 categories de templates en FR/EN : Promo, Evenement, Rappel, Saisonnier, Partenariat, Lancement produit, Communaute. Chacune contient 2+ messages prets a personnaliser.'
            : '7 template categories in FR/EN: Promo, Event, Reminder, Seasonal, Partnership, Product Launch, Community. Each has 2+ ready-to-customize messages.',
        },
      ],
    },
    {
      id: 'par_page',
      category: fr ? 'Page Partenaire & Marketing' : 'Partner Page & Marketing',
      icon: 'qr-code',
      color: '#059669',
      description: fr ? 'Votre vitrine publique et QR code marketing' : 'Your public showcase and marketing QR code',
      questions: [
        {
          id: 'pl1',
          q: fr ? 'A quoi ressemble ma page partenaire publique ?' : 'What does my public partner page look like?',
          a: fr
            ? 'Hero section avec avatar agrandi et couleur de marque, compteurs animes (impressions, clics, CTR, portee), timeline d\'activite, evenements, code parrainage, liens sociaux et lien vers votre site. Les joueurs y accedent via "Nos Partenaires" ou en scannant votre QR.'
            : 'Hero section with enlarged avatar and brand color, animated counters (impressions, clicks, CTR, reach), activity timeline, events, referral code, social links and website link. Players access via "Our Partners" or scanning your QR.',
        },
        {
          id: 'pl2',
          q: fr ? 'Comment utiliser le QR code pour le marketing ?' : 'How do I use QR code for marketing?',
          a: fr
            ? 'Votre page partenaire inclut un QR code personnalise aux couleurs de votre marque. Imprimez-le sur flyers, cartes de visite ou stands de tournois pour diriger les joueurs vers votre profil. Boutons "Partager" et "Copier le lien" disponibles.'
            : 'Your partner page includes a QR code in your brand colors. Print it on flyers, business cards or tournament stands to direct players to your profile. "Share" and "Copy Link" buttons available.',
        },
        {
          id: 'pl3',
          q: fr ? 'Qu\'est-ce que le digest hebdomadaire ?' : 'What is the weekly digest?',
          a: fr
            ? 'Or uniquement. Chaque lundi, un recap resume vos performances : impressions, clics, CTR, push envoyes, comparaison avec la semaine precedente. Exportable en PDF.'
            : 'Gold only. Every Monday, a recap summarizes performance: impressions, clicks, CTR, pushes sent, comparison with previous week. Exportable as PDF.',
        },
      ],
    },
  ];
}

// ============================================
// AUDIENCE TABS
// ============================================
const AUDIENCE_TABS: { id: AudienceTab; iconFr: string; iconEn: string; icon: string; color: string; gradientColors: [string, string] }[] = [
  { id: 'joueur', iconFr: 'Joueur', iconEn: 'Player', icon: 'sports', color: '#2563EB', gradientColors: ['#2563EB', '#1D4ED8'] },
  { id: 'club', iconFr: 'Club', iconEn: 'Club', icon: 'home', color: '#7C3AED', gradientColors: ['#7C3AED', '#6D28D9'] },
  { id: 'ambassadeur', iconFr: 'Ambassadeur', iconEn: 'Ambassador', icon: 'stars', color: '#10B981', gradientColors: ['#059669', '#047857'] },
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
      steps: fr ? ['Choisissez 10 Tirs, Sautee ou Precision', 'Selectionnez joueur et boules', 'Notez chaque tir', 'Mode 1v1 : defier un adversaire'] : ['Choose 10 Shots, Lob or Precision', 'Select player and boules', 'Record each shot', '1v1 mode: challenge an opponent'] },
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
      case 'club': return getClubFaq(fr);
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
                <MaterialIcons name={tab.icon as any} size={15} color={isActive ? '#FFF' : tab.color} />
                <Text style={[st.audienceTabText, isActive && { color: '#FFF' }]} numberOfLines={1}>
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

        {/* Club quick links */}
        {activeTab === 'club' && !isSearching ? (
          <View style={{ gap: 8, marginBottom: 16 }}>
            <Pressable style={[st.quickLink, { borderColor: '#7C3AED30' }]} onPress={() => router.push('/club/new' as any)}>
              <LinearGradient colors={['#7C3AED10', '#7C3AED05']} style={st.quickLinkInner}>
                <View style={[st.quickLinkIcon, { backgroundColor: '#7C3AED15' }]}>
                  <MaterialIcons name="add-home" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.quickLinkTitle}>{fr ? 'Creer un club' : 'Create a club'}</Text>
                  <Text style={st.quickLinkSub}>{fr ? 'Commencer a gerer votre association' : 'Start managing your association'}</Text>
                </View>
                <MaterialIcons name="arrow-forward-ios" size={14} color="#7C3AED" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {/* Ambassador quick links */}
        {activeTab === 'ambassadeur' && !isSearching ? (
          <View style={{ gap: 8, marginBottom: 16 }}>
            <Pressable style={[st.quickLink, { borderColor: '#10B98130' }]} onPress={() => router.push('/ambassador-program' as any)}>
              <LinearGradient colors={['#10B98110', '#10B98105']} style={st.quickLinkInner}>
                <View style={[st.quickLinkIcon, { backgroundColor: '#10B98115' }]}>
                  <MaterialIcons name="stars" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.quickLinkTitle}>{fr ? 'Programme Ambassadeur' : 'Ambassador Program'}</Text>
                  <Text style={st.quickLinkSub}>{fr ? 'Niveaux et avantages complets' : 'Full levels and benefits'}</Text>
                </View>
                <MaterialIcons name="arrow-forward-ios" size={14} color="#10B981" />
              </LinearGradient>
            </Pressable>
            <Pressable style={[st.quickLink, { borderColor: '#10B98130' }]} onPress={() => router.push('/ambassador-dashboard' as any)}>
              <LinearGradient colors={['#10B98110', '#10B98105']} style={st.quickLinkInner}>
                <View style={[st.quickLinkIcon, { backgroundColor: '#10B98115' }]}>
                  <MaterialIcons name="dashboard" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.quickLinkTitle}>{fr ? 'Portail Ambassadeur' : 'Ambassador Portal'}</Text>
                  <Text style={st.quickLinkSub}>{fr ? 'Dashboard, stats, defis et parrainages' : 'Dashboard, stats, challenges and referrals'}</Text>
                </View>
                <MaterialIcons name="arrow-forward-ios" size={14} color="#10B981" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {/* Partner quick links */}
        {activeTab === 'partenaire' && !isSearching ? (
          <View style={{ gap: 8, marginBottom: 16 }}>
            <Pressable style={[st.quickLink, { borderColor: '#D4A01730' }]} onPress={() => router.push('/partner-program' as any)}>
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
            <Pressable style={[st.quickLink, { borderColor: '#2563EB30' }]} onPress={() => router.push('/sponsor-portal' as any)}>
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
            <Text style={st.contactSub}>{fr ? 'Je ferai mon possible pour vous repondre au plus vite' : 'I will do my best to respond as quickly as possible'}</Text>

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
  audienceTabsContainer: { flexDirection: 'row', gap: 6, marginBottom: 16, paddingHorizontal: 4 },
  audienceTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  audienceTabText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  // Quick links
  quickLink: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, marginBottom: 0 },
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
