import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withTiming, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { Language } from '@/constants/i18n';

// ============================================
// QUICK ACTIONS - Translated
// ============================================
function getQuickActions(lang: Language) {
  return [
    {
      id: 'new_match',
      title: lang === 'fr' ? 'Créer un match' : 'Create a match',
      icon: 'sports',
      color: theme.primary,
      steps: lang === 'fr'
        ? ['Accueil → "Match"', 'Choisir le format', 'Sélectionner les équipes', 'Commencer']
        : ['Home → "Match"', 'Choose the format', 'Select teams', 'Start'],
    },
    {
      id: 'new_challenge',
      title: lang === 'fr' ? 'Lancer un défi' : 'Launch a challenge',
      icon: 'track-changes',
      color: theme.carreauColor,
      steps: lang === 'fr'
        ? ['Accueil → "Défi"', 'Choisir le type', 'Solo ou 1v1', 'Tirer !']
        : ['Home → "Challenge"', 'Choose the type', 'Solo or 1v1', 'Shoot!'],
    },
    {
      id: 'new_tournament',
      title: lang === 'fr' ? 'Suivre un tournoi' : 'Track a tournament',
      icon: 'emoji-events',
      color: theme.success,
      steps: lang === 'fr'
        ? ['Accueil → "Tournoi"', 'Remplir les infos', 'Ajouter des matchs', 'Voir le parcours']
        : ['Home → "Tournament"', 'Fill in details', 'Add matches', 'View journey'],
    },
    {
      id: 'share_card',
      title: lang === 'fr' ? 'Partager une fiche' : 'Share a card',
      icon: 'share',
      color: theme.accent,
      steps: lang === 'fr'
        ? ['Ouvrir la fiche', 'Icône partage', 'Copier le code', 'Envoyer au joueur']
        : ['Open the card', 'Share icon', 'Copy the code', 'Send to the player'],
    },
  ];
}

// ============================================
// FAQ DATA - Translated
// ============================================
function getFaqData(lang: Language) {
  return [
    {
      id: 'getting_started',
      category: lang === 'fr' ? 'Premiers pas' : 'Getting started',
      icon: 'play-circle-filled',
      color: theme.primary,
      questions: [
        {
          id: 'gs1',
          question: lang === 'fr'
            ? "Comment bien démarrer avec Ultimate Petanque ?"
            : "How to get started with Ultimate Petanque?",
          answer: lang === 'fr'
            ? "1. Complétez votre profil (rôle, niveau, club)\n2. Ajoutez vos partenaires de jeu dans l'annuaire\n3. Lancez votre premier match ou défi\n4. Consultez vos stats après quelques parties\n\nToutes vos données sont sauvegardées automatiquement dans le cloud."
            : "1. Complete your profile (role, level, club)\n2. Add your playing partners in the directory\n3. Start your first match or challenge\n4. Check your stats after a few games\n\nAll your data is automatically saved to the cloud.",
        },
        {
          id: 'gs2',
          question: lang === 'fr'
            ? "L'application fonctionne-t-elle hors connexion ?"
            : "Does the app work offline?",
          answer: lang === 'fr'
            ? "Vos données sont synchronisées avec le cloud lorsque vous avez une connexion. Pour garantir la sauvegarde de vos matchs et statistiques, il est recommandé d'être connecté."
            : "Your data is synced with the cloud when you have a connection. To ensure your matches and statistics are saved, it is recommended to be connected.",
        },
        {
          id: 'gs3',
          question: lang === 'fr'
            ? "Comment personnaliser mon profil ?"
            : "How to customize my profile?",
          answer: lang === 'fr'
            ? "Allez dans Profil (icône en haut à droite de l'accueil) → Modifier. Vous pouvez changer votre photo, nom, rôle préféré (Tireur/Pointeur/Milieu), niveau, club, et informations de contact."
            : "Go to Profile (icon at the top right of the home screen) → Edit. You can change your photo, name, preferred role (Shooter/Pointer/Middle), level, club, and contact information.",
        },
      ],
    },
    {
      id: 'matches',
      category: lang === 'fr' ? 'Matchs & Scoring' : 'Matches & Scoring',
      icon: 'sports',
      color: theme.accent,
      questions: [
        {
          id: 'm1',
          question: lang === 'fr'
            ? "Comment créer et scorer un match ?"
            : "How to create and score a match?",
          answer: lang === 'fr'
            ? "Depuis l'accueil, appuyez sur \"Match\". Choisissez le mode (Entraînement/Tournoi), le format (Tête-à-tête, Doublette, Triplette), sélectionnez vos équipes puis démarrez.\n\nEn plein écran, utilisez les boutons + et - pour scorer chaque mène. Le chronomètre se lance automatiquement."
            : "From the home screen, tap \"Match\". Choose the mode (Training/Tournament), format (Singles, Doubles, Triples), select your teams then start.\n\nIn fullscreen, use the + and - buttons to score each end. The timer starts automatically.",
        },
        {
          id: 'm2',
          question: lang === 'fr'
            ? "Comment fonctionne la notation détaillée des tirs ?"
            : "How does detailed shot notation work?",
          answer: lang === 'fr'
            ? "Pendant un match, appuyez sur TIR ou POINT pour ouvrir la notation en étapes :\n\n• Tir : Résultat → Type (tendu, en cloche, en rafle) → Si raté : où est tombée la boule → Impact\n• Point : Résultat → Type (roulé, plombé, portée) → Qualité/Distance\n\nCes données alimentent vos statistiques avancées et l'analyse des erreurs."
            : "During a match, tap SHOT or POINT to open step-by-step notation:\n\n• Shot: Result → Type (direct, lob, rolling) → If missed: where the ball landed → Impact\n• Point: Result → Type (rolled, dropped, carried) → Quality/Distance\n\nThis data feeds your advanced statistics and error analysis.",
        },
        {
          id: 'm3',
          question: lang === 'fr'
            ? "Comment fonctionne le mode série (Best of 3) ?"
            : "How does the series mode (Best of 3) work?",
          answer: lang === 'fr'
            ? "Activez \"Série\" avant de commencer. Après chaque match, vous pouvez lancer une revanche. Le premier à 2 victoires gagne la série. Si c'est 1-1, le 3ème match est la Finale.\n\nLes séries sont suivies automatiquement dans vos statistiques."
            : "Enable \"Series\" before starting. After each match, you can launch a rematch. The first to 2 wins takes the series. If it is 1-1, the 3rd match is the Final.\n\nSeries are automatically tracked in your statistics.",
        },
        {
          id: 'm4',
          question: lang === 'fr'
            ? "Comment modifier les actions pendant un match ?"
            : "How to edit actions during a match?",
          answer: lang === 'fr'
            ? "Appuyez sur le bouton \"Édition\" (icône crayon) pendant le match. Vous pourrez :\n• Ajuster les scores de mènes\n• Modifier le chronomètre\n• Ajouter ou corriger des actions de tir/point\n• Assigner les rôles des joueurs"
            : "Tap the \"Edit\" button (pencil icon) during the match. You can:\n• Adjust end scores\n• Modify the timer\n• Add or correct shot/point actions\n• Assign player roles",
        },
      ],
    },
    {
      id: 'challenges',
      category: lang === 'fr' ? 'Défis' : 'Challenges',
      icon: 'track-changes',
      color: theme.carreauColor,
      questions: [
        {
          id: 'c1',
          question: lang === 'fr'
            ? "Quels types de défis puis-je faire ?"
            : "What types of challenges can I do?",
          answer: lang === 'fr'
            ? "3 types de défis disponibles :\n\n🎯 10 Tirs — Tirs classiques, comptez vos réussites\n🎯 10 Tirs Sautée — Tirs en cloche uniquement\n🎯 Tir de Précision — 5 ateliers × 4 tirs avec notation par distance (0/1/3/5 pts)\n\nChaque défi peut être joué en solo ou en 1v1 contre un autre joueur."
            : "3 types of challenges available:\n\n🎯 10 Shots — Classic shots, count your successes\n🎯 10 Lob Shots — Lob shots only\n🎯 Precision Shot — 5 workshops × 4 shots with distance scoring (0/1/3/5 pts)\n\nEach challenge can be played solo or 1v1 against another player.",
        },
        {
          id: 'c2',
          question: lang === 'fr'
            ? "Comment fonctionne le défi Précision ?"
            : "How does the Precision challenge work?",
          answer: lang === 'fr'
            ? "5 ateliers : Boule seule, Derrière le but, Entre 2 boules, Sautée, Tir de but.\n\nPour chaque atelier : 4 tirs à distances croissantes (6-9m) avec un chrono de 30 secondes par tir.\n\nBarème : Raté = 0 pts, Touché = 1 pt, Sorti = 3 pts, Carreau = 5 pts.\nScore max possible : 100 points."
            : "5 workshops: Single ball, Behind the jack, Between 2 balls, Lob, Jack shot.\n\nFor each workshop: 4 shots at increasing distances (6-9m) with a 30-second timer per shot.\n\nScoring: Missed = 0 pts, Hit = 1 pt, Knocked out = 3 pts, Carreau = 5 pts.\nMax possible score: 100 points.",
        },
        {
          id: 'c3',
          question: lang === 'fr'
            ? "Comment défier un autre joueur en 1v1 ?"
            : "How to challenge another player in 1v1?",
          answer: lang === 'fr'
            ? "Lors de la création du défi, choisissez le mode \"1 contre 1\" puis sélectionnez votre adversaire parmi vos joueurs enregistrés. Vous alternez les tirs et l'app compare automatiquement les scores."
            : "When creating the challenge, choose the \"1 vs 1\" mode then select your opponent from your registered players. You alternate shots and the app automatically compares the scores.",
        },
      ],
    },
    {
      id: 'tournaments',
      category: lang === 'fr' ? 'Tournois' : 'Tournaments',
      icon: 'emoji-events',
      color: theme.success,
      questions: [
        {
          id: 't1',
          question: lang === 'fr'
            ? "Comment suivre mon parcours en tournoi ?"
            : "How to track my tournament journey?",
          answer: lang === 'fr'
            ? "1. Créez le tournoi (Accueil → Tournoi) avec les infos (nom, date, lieu, cadrage)\n2. Depuis la page du tournoi, ajoutez chaque match joué\n3. La progression par phases s'affiche automatiquement\n4. En fin de tournoi, enregistrez votre classement final\n\nVotre parcours, statistiques et résultat sont conservés dans le palmarès."
            : "1. Create the tournament (Home → Tournament) with details (name, date, location, bracket)\n2. From the tournament page, add each match played\n3. Phase progression is displayed automatically\n4. At the end of the tournament, record your final ranking\n\nYour journey, statistics and result are kept in your achievements.",
        },
        {
          id: 't2',
          question: lang === 'fr'
            ? "Quels formats de cadrage sont supportés ?"
            : "What bracket formats are supported?",
          answer: lang === 'fr'
            ? "6 formats disponibles :\n\n• Poules — Matchs en groupes + classement\n• Élimination directe — Un match perdu = éliminé\n• Mixte — Poules puis élimination\n• Suisse — Rondes contre adversaires de même niveau\n• A/B/C — Tableaux multiples avec repêchage\n• Tirage intégral — Tableau fixé au tirage\n\nChaque format a ses propres phases de progression."
            : "6 formats available:\n\n• Pools — Group matches + standings\n• Single elimination — One loss = eliminated\n• Mixed — Pools then elimination\n• Swiss — Rounds against same-level opponents\n• A/B/C — Multiple brackets with repechage\n• Full draw — Fixed bracket from the draw\n\nEach format has its own progression phases.",
        },
        {
          id: 't3',
          question: lang === 'fr'
            ? "Comment activer les rappels de tournoi ?"
            : "How to enable tournament reminders?",
          answer: lang === 'fr'
            ? "Sur la page du tournoi, appuyez sur l'icône cloche (🔔). Configurez vos rappels :\n\n• 1 semaine avant\n• 3 jours avant\n• La veille (à 18h)\n\nLes rappels fonctionnent en notifications push locales, même sans internet."
            : "On the tournament page, tap the bell icon (🔔). Configure your reminders:\n\n• 1 week before\n• 3 days before\n• The day before (at 6 PM)\n\nReminders work as local push notifications, even without internet.",
        },
        {
          id: 't4',
          question: lang === 'fr'
            ? "Comment enregistrer mon classement final ?"
            : "How to record my final ranking?",
          answer: lang === 'fr'
            ? "Sur la page du tournoi, appuyez sur le drapeau (🏁) en bas à gauche. Un assistant en 3 étapes vous guide :\n\n1. Sélectionnez votre classement (podium ou autre)\n2. Renseignez vos gains (optionnel)\n3. Confirmez — le tournoi passe en \"Terminé\"\n\nLe résultat apparaît dans votre palmarès et bilan financier."
            : "On the tournament page, tap the flag (🏁) at the bottom left. A 3-step wizard guides you:\n\n1. Select your ranking (podium or other)\n2. Enter your winnings (optional)\n3. Confirm — the tournament changes to \"Completed\"\n\nThe result appears in your achievements and financial summary.",
        },
      ],
    },
    {
      id: 'stats',
      category: lang === 'fr' ? 'Statistiques' : 'Statistics',
      icon: 'bar-chart',
      color: theme.tirColor,
      questions: [
        {
          id: 's1',
          question: lang === 'fr'
            ? "Quelles statistiques sont disponibles ?"
            : "What statistics are available?",
          answer: lang === 'fr'
            ? "4 catégories dans l'onglet Stats :\n\n📊 Performance — Taux de victoire, scores, séries, durées\n🎯 Tir — Réussite, carreaux, types de tir × impact\n🎱 Point — Réussite, qualité, types × précision\n❌ Erreurs — Analyse par durée, format, contexte, coaching\n\nTous les filtres temporels : Aujourd'hui, 7j, 30j, 3 mois, 6 mois, 1 an, Tout."
            : "4 categories in the Stats tab:\n\n📊 Performance — Win rate, scores, series, durations\n🎯 Shot — Success, carreaux, shot types × impact\n🎱 Point — Success, quality, types × precision\n❌ Errors — Analysis by duration, format, context, coaching\n\nAll time filters: Today, 7d, 30d, 3 months, 6 months, 1 year, All.",
        },
        {
          id: 's2',
          question: lang === 'fr'
            ? "Comment fonctionne la progression ?"
            : "How does progression work?",
          answer: lang === 'fr'
            ? "Appuyez sur \"Progression\" en haut de la page Stats. Des graphiques montrent l'évolution de vos taux (victoire, tir, point, carreaux) sur la période choisie : 4 sem., 8 sem., 3 mois, 6 mois ou 1 an.\n\nLes flèches de tendance (↑↓→) indiquent si vos performances s'améliorent."
            : "Tap \"Progression\" at the top of the Stats page. Charts show the evolution of your rates (win, shot, point, carreaux) over the selected period: 4 wks, 8 wks, 3 months, 6 months or 1 year.\n\nTrend arrows (↑↓→) indicate whether your performance is improving.",
        },
        {
          id: 's3',
          question: lang === 'fr'
            ? "Comment l'analyse des erreurs m'aide ?"
            : "How does error analysis help me?",
          answer: lang === 'fr'
            ? "L'onglet \"Erreurs\" identifie vos faiblesses et donne des conseils personnalisés :\n\n• Où tombent vos tirs ratés (court droite/gauche, long, bouchon)\n• Si la fatigue affecte votre jeu (parties longues vs courtes)\n• La différence entraînement vs tournoi\n• Les séries d'erreurs consécutives\n\nChaque type d'erreur est accompagné d'un conseil technique pour s'améliorer."
            : "The \"Errors\" tab identifies your weaknesses and provides personalized advice:\n\n• Where your missed shots land (short right/left, long, jack)\n• Whether fatigue affects your game (long vs short games)\n• The difference between training and tournament\n• Consecutive error streaks\n\nEach error type comes with a technical tip for improvement.",
        },
      ],
    },
    {
      id: 'directory',
      category: lang === 'fr' ? 'Annuaire & Partage' : 'Directory & Sharing',
      icon: 'people',
      color: theme.accent,
      questions: [
        {
          id: 'd1',
          question: lang === 'fr'
            ? "Comment gérer mes joueurs et clubs ?"
            : "How to manage my players and clubs?",
          answer: lang === 'fr'
            ? "L'onglet Annuaire regroupe :\n\n👤 Joueurs — Ajoutez des joueurs avec nom, rôle, niveau, club, boules, contact\n🏠 Clubs — Créez des clubs avec adresse, équipements, cotisation\n⛳ Terrains — Enregistrez les terrains avec type, éclairage, photos\n\nChaque fiche joueur calcule automatiquement ses statistiques à partir des matchs."
            : "The Directory tab groups:\n\n👤 Players — Add players with name, role, level, club, balls, contact\n🏠 Clubs — Create clubs with address, facilities, membership fee\n⛳ Terrains — Register terrains with type, lighting, photos\n\nEach player card automatically calculates statistics from matches.",
        },
        {
          id: 'd2',
          question: lang === 'fr'
            ? "Comment partager une fiche avec un autre joueur ?"
            : "How to share a card with another player?",
          answer: lang === 'fr'
            ? "1. Ouvrez la fiche (joueur, club, terrain ou tournoi)\n2. Appuyez sur l'icône de partage\n3. Choisissez la permission (lecture seule ou modification)\n4. Copiez et envoyez le code à votre partenaire\n\nVotre partenaire saisit le code dans Profil → Partage → Code de partage."
            : "1. Open the card (player, club, terrain or tournament)\n2. Tap the share icon\n3. Choose the permission (read-only or edit)\n4. Copy and send the code to your partner\n\nYour partner enters the code in Profile → Sharing → Share code.",
        },
        {
          id: 'd3',
          question: lang === 'fr'
            ? "Comment gérer les fiches partagées ?"
            : "How to manage shared cards?",
          answer: lang === 'fr'
            ? "Profil → Partage → Gestion des partages :\n\n• Onglet \"Mes partages\" : voir vos codes actifs, copier, basculer les permissions, révoquer\n• Onglet \"Reçus\" : voir les fiches qu'on vous a partagées, les enregistrer dans votre annuaire\n\nVous recevez une notification quand quelqu'un utilise un de vos codes."
            : "Profile → Sharing → Share management:\n\n• \"My shares\" tab: view your active codes, copy, toggle permissions, revoke\n• \"Received\" tab: view cards shared with you, save them to your directory\n\nYou receive a notification when someone uses one of your codes.",
        },
        {
          id: 'd4',
          question: lang === 'fr'
            ? "Puis-je enregistrer une fiche partagée ?"
            : "Can I save a shared card?",
          answer: lang === 'fr'
            ? "Oui ! Sur toute fiche reçue en partage, un bouton \"Enregistrer\" (💾) apparaît. La fiche est copiée intégralement dans votre annuaire personnel. Vous pouvez ensuite la modifier librement."
            : "Yes! On any card received through sharing, a \"Save\" button (💾) appears. The card is fully copied into your personal directory. You can then edit it freely.",
        },
      ],
    },
    {
      id: 'account',
      category: lang === 'fr' ? 'Compte & Profil' : 'Account & Profile',
      icon: 'person',
      color: '#8B5CF6',
      questions: [
        {
          id: 'a1',
          question: lang === 'fr'
            ? "Comment changer mon mot de passe ?"
            : "How to change my password?",
          answer: lang === 'fr'
            ? "Profil → Paramètres → Mot de passe. Saisissez votre ancien mot de passe, puis le nouveau (minimum 6 caractères) et confirmez."
            : "Profile → Settings → Password. Enter your old password, then the new one (minimum 6 characters) and confirm.",
        },
        {
          id: 'a2',
          question: lang === 'fr'
            ? "Où trouver mon palmarès et bilan financier ?"
            : "Where to find my achievements and financial summary?",
          answer: lang === 'fr'
            ? "Depuis votre Profil :\n\n🏆 Mon Palmarès — Tous vos résultats de tournois, badges de performance, classement par saison\n💰 Bilan financier — Résumé des gains, inscriptions, cotisations club, balance nette\n\nCes pages se mettent à jour automatiquement."
            : "From your Profile:\n\n🏆 My Achievements — All your tournament results, performance badges, season rankings\n💰 Financial summary — Summary of winnings, registrations, club fees, net balance\n\nThese pages update automatically.",
        },
        {
          id: 'a3',
          question: lang === 'fr'
            ? "Comment configurer les notifications ?"
            : "How to configure notifications?",
          answer: lang === 'fr'
            ? "Profil → Paramètres → Notifications :\n\n• Notifications de partage — Alertes quand quelqu'un accède à vos fiches\n• Notifications de tournois — Rappels programmés avant vos tournois\n\nLes notifications push locales fonctionnent sans connexion internet."
            : "Profile → Settings → Notifications:\n\n• Sharing notifications — Alerts when someone accesses your cards\n• Tournament notifications — Scheduled reminders before your tournaments\n\nLocal push notifications work without internet connection.",
        },
      ],
    },
  ];
}

// ============================================
// TIPS - Translated
// ============================================
function getTips(lang: Language) {
  return [
    { icon: 'lightbulb', text: lang === 'fr' ? "Utilisez la notation détaillée pour des statistiques d'erreurs personnalisées" : 'Use detailed notation for personalized error statistics', color: theme.carreauColor },
    { icon: 'timer', text: lang === 'fr' ? 'Le chronomètre se met en pause automatiquement entre les mènes' : 'The timer pauses automatically between ends', color: theme.primary },
    { icon: 'trending-up', text: lang === 'fr' ? 'Jouez régulièrement pour voir votre courbe de progression évoluer' : 'Play regularly to see your progression curve evolve', color: theme.success },
    { icon: 'share', text: lang === 'fr' ? 'Partagez votre fiche joueur pour que vos coéquipiers voient vos stats' : 'Share your player card so your teammates can see your stats', color: theme.accent },
  ];
}

// ============================================
// AccordionItem Component
// ============================================
function AccordionItem({ question, answer, isOpen, onToggle, accentColor }: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 });
  }, [isOpen, rotation]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Pressable
      style={[styles.faqItem, isOpen && { borderLeftWidth: 3, borderLeftColor: accentColor }]}
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
    >
      <View style={styles.faqQuestion}>
        <Text style={[styles.faqQuestionText, isOpen && { color: accentColor }]}>{question}</Text>
        <Animated.View style={[iconStyle, styles.faqChevron]}>
          <MaterialIcons name="expand-more" size={22} color={isOpen ? accentColor : theme.textMuted} />
        </Animated.View>
      </View>
      {isOpen && (
        <View style={styles.faqAnswerContainer}>
          <Text style={styles.faqAnswerText}>{answer}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ============================================
// QuickActionCard Component
// ============================================
function QuickActionCard({ action, index }: { action: ReturnType<typeof getQuickActions>[0]; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <Pressable
        style={[styles.quickActionCard, expanded && { borderColor: action.color + '40', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}
        onPress={() => {
          Haptics.selectionAsync();
          setExpanded(!expanded);
        }}
      >
        <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
          <MaterialIcons name={action.icon as any} size={22} color={action.color} />
        </View>
        <Text style={styles.quickActionTitle}>{action.title}</Text>
        <MaterialIcons
          name={expanded ? 'expand-less' : 'expand-more'}
          size={20}
          color={theme.textMuted}
        />
      </Pressable>
      {expanded && (
        <View style={[styles.quickActionSteps, { borderColor: action.color + '40' }]}>
          {action.steps.map((step, i) => (
            <View key={i} style={styles.quickActionStep}>
              <View style={[styles.quickActionStepNumber, { backgroundColor: action.color }]}>
                <Text style={styles.quickActionStepNumberText}>{i + 1}</Text>
              </View>
              <Text style={styles.quickActionStepText}>{step}</Text>
              {i < action.steps.length - 1 && (
                <View style={[styles.quickActionStepConnector, { backgroundColor: action.color + '30' }]} />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function FAQScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
  const [showAllTips, setShowAllTips] = useState(false);

  const QUICK_ACTIONS = useMemo(() => getQuickActions(language), [language]);
  const FAQ_DATA = useMemo(() => getFaqData(language), [language]);
  const TIPS = useMemo(() => getTips(language), [language]);

  // Filter questions
  const filteredData = useMemo(() => {
    return FAQ_DATA.map(cat => ({
      ...cat,
      questions: cat.questions.filter(q => {
        const matchesSearch = !searchQuery ||
          q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = !selectedCategory || cat.id === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    })).filter(cat => cat.questions.length > 0);
  }, [searchQuery, selectedCategory, FAQ_DATA]);

  const toggleQuestion = useCallback((questionId: string) => {
    setOpenQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }, []);

  const totalQuestions = FAQ_DATA.reduce((sum, cat) => sum + cat.questions.length, 0);
  const isSearching = searchQuery.length > 0;
  const visibleTips = showAllTips ? TIPS : TIPS.slice(0, 2);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('faq', 'helpCenter')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Section */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.heroSection}>
          <View style={styles.heroIconContainer}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="support-agent" size={36} color={theme.primary} />
            </View>
            <View style={styles.heroDecoCircle1} />
            <View style={styles.heroDecoCircle2} />
          </View>
          <Text style={styles.heroTitle}>{t('faq', 'howCanWeHelp')}</Text>
          <Text style={styles.heroSubtitle}>
            {totalQuestions} {t('faq', 'answersAndGuides')} • 4 {t('faq', 'quickGuides')}
          </Text>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.searchContainer}>
          <MaterialIcons name="search" size={22} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('faq', 'searchQuestion')}
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <MaterialIcons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          )}
        </Animated.View>

        {/* Quick Actions - only when not searching */}
        {!isSearching && !selectedCategory && (
          <View style={styles.quickActionsSection}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="flash-on" size={18} color={theme.carreauColor} />
              <Text style={styles.sectionHeaderText}>{t('faq', 'quickGuidesTitle')}</Text>
            </View>
            <View style={styles.quickActionsGrid}>
              {QUICK_ACTIONS.map((action, index) => (
                <QuickActionCard key={action.id} action={action} index={index} />
              ))}
            </View>
          </View>
        )}

        {/* Category Chips */}
        <View>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="category" size={18} color={theme.primary} />
            <Text style={styles.sectionHeaderText}>{t('faq', 'categories')}</Text>
            {selectedCategory && (
              <Pressable
                style={styles.clearFilterBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategory(null);
                }}
              >
                <MaterialIcons name="close" size={14} color={theme.primary} />
                <Text style={styles.clearFilterText}>{t('faq', 'seeAll')}</Text>
              </Pressable>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {FAQ_DATA.map(cat => {
              const isActive = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    isActive && [styles.categoryChipActive, { backgroundColor: cat.color, borderColor: cat.color }],
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategory(isActive ? null : cat.id);
                  }}
                >
                  <MaterialIcons
                    name={cat.icon as any}
                    size={15}
                    color={isActive ? '#FFF' : cat.color}
                  />
                  <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                    {cat.category}
                  </Text>
                  <View style={[styles.categoryChipBadge, isActive && { backgroundColor: '#FFFFFF30' }]}>
                    <Text style={[styles.categoryChipBadgeText, isActive && { color: '#FFF' }]}>
                      {cat.questions.length}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Search results count */}
        {isSearching && (
          <View style={styles.searchResultInfo}>
            <MaterialIcons name="search" size={16} color={theme.textMuted} />
            <Text style={styles.searchResultText}>
              {filteredData.reduce((sum, c) => sum + c.questions.length, 0)} {t('faq', 'resultsFor')} "{searchQuery}"
            </Text>
          </View>
        )}

        {/* FAQ Sections */}
        {filteredData.length > 0 ? (
          filteredData.map((category, catIndex) => (
            <View
              key={category.id}
              style={styles.categorySection}
            >
              <View style={styles.categorySectionHeader}>
                <View style={[styles.categorySectionIcon, { backgroundColor: category.color + '15' }]}>
                  <MaterialIcons name={category.icon as any} size={20} color={category.color} />
                </View>
                <Text style={styles.categorySectionTitle}>{category.category}</Text>
                <View style={[styles.categorySectionCount, { backgroundColor: category.color + '12' }]}>
                  <Text style={[styles.categorySectionCountText, { color: category.color }]}>
                    {category.questions.length}
                  </Text>
                </View>
              </View>

              <View style={styles.faqList}>
                {category.questions.map((q) => (
                  <AccordionItem
                    key={q.id}
                    question={q.question}
                    answer={q.answer}
                    isOpen={openQuestions.has(q.id)}
                    onToggle={() => toggleQuestion(q.id)}
                    accentColor={category.color}
                  />
                ))}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyStateTitle}>{t('faq', 'noResults')}</Text>
            <Text style={styles.emptyStateText}>
              {t('faq', 'noResultsText')}
            </Text>
            <Pressable
              style={styles.emptyStateButton}
              onPress={() => {
                Haptics.selectionAsync();
                setSearchQuery('');
                setSelectedCategory(null);
              }}
            >
              <MaterialIcons name="refresh" size={18} color={theme.primary} />
              <Text style={styles.emptyStateButtonText}>{t('faq', 'resetSearch')}</Text>
            </Pressable>
          </View>
        )}

        {/* Tips Section - only when not searching */}
        {!isSearching && (
          <View style={styles.tipsSection}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="lightbulb" size={18} color={theme.warning} />
              <Text style={styles.sectionHeaderText}>{t('faq', 'tips')}</Text>
            </View>
            <View style={styles.tipsList}>
              {visibleTips.map((tip, index) => (
                <View key={index} style={styles.tipCard}>
                  <View style={[styles.tipIcon, { backgroundColor: tip.color + '15' }]}>
                    <MaterialIcons name={tip.icon as any} size={18} color={tip.color} />
                  </View>
                  <Text style={styles.tipText}>{tip.text}</Text>
                </View>
              ))}
            </View>
            {!showAllTips && TIPS.length > 2 && (
              <Pressable
                style={styles.showMoreBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowAllTips(true);
                }}
              >
                <Text style={styles.showMoreText}>{t('faq', 'seeAllTips')}</Text>
                <MaterialIcons name="expand-more" size={18} color={theme.primary} />
              </Pressable>
            )}
          </View>
        )}

        {/* Contact Section */}
        <View style={styles.contactSection}>
          <View style={styles.contactHeader}>
            <View style={styles.contactHeaderIcon}>
              <MaterialIcons name="forum" size={28} color={theme.primary} />
            </View>
            <Text style={styles.contactTitle}>{t('faq', 'needMoreHelp')}</Text>
            <Text style={styles.contactSubtitle}>{t('faq', 'teamHere')}</Text>
          </View>

          <Pressable
            style={styles.contactButton}
            onPress={() => Linking.openURL('mailto:contact@onspace.ai?subject=Ultimate%20Petanque%20-%20Aide')}
          >
            <View style={[styles.contactButtonIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="email" size={22} color={theme.primary} />
            </View>
            <View style={styles.contactButtonInfo}>
              <Text style={styles.contactButtonTitle}>{t('faq', 'sendEmail')}</Text>
              <Text style={styles.contactButtonSubtitle}>contact@onspace.ai</Text>
            </View>
            <View style={styles.contactButtonArrow}>
              <MaterialIcons name="arrow-forward" size={18} color={theme.primary} />
            </View>
          </Pressable>
        </View>

        {/* Version */}
        <Text style={styles.versionText}>{t('common', 'version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroIconContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  heroDecoCircle1: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.carreauColor + '20',
  },
  heroDecoCircle2: {
    position: 'absolute',
    bottom: -4,
    left: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.success + '20',
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    padding: 0,
  },
  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.primary + '12',
    borderRadius: theme.borderRadius.full,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
  // Quick Actions
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    gap: 8,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  quickActionSteps: {
    backgroundColor: theme.surface,
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
    marginTop: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: theme.border,
    gap: 0,
  },
  quickActionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    position: 'relative',
  },
  quickActionStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  quickActionStepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  quickActionStepText: {
    fontSize: 14,
    color: theme.textPrimary,
    fontWeight: '500',
  },
  quickActionStepConnector: {
    position: 'absolute',
    left: 11,
    top: 32,
    width: 2,
    height: 16,
  },
  // Categories
  categoriesScroll: {
    paddingBottom: 20,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  categoryChipActive: {
    borderColor: 'transparent',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  categoryChipBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  categoryChipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textMuted,
  },
  // Search result info
  searchResultInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  searchResultText: {
    fontSize: 13,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  // Category Section
  categorySection: {
    marginBottom: 24,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  categorySectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorySectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  categorySectionCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categorySectionCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // FAQ List
  faqList: {
    gap: 8,
  },
  faqItem: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    lineHeight: 22,
  },
  faqChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqAnswerContainer: {
  },
  faqAnswerText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 20,
    ...theme.shadows.card,
  },
  emptyStateIcon: {
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.full,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  // Tips
  tipsSection: {
    marginBottom: 24,
  },
  tipsList: {
    gap: 8,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  // Contact Section
  contactSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 16,
  },
  contactHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  contactHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '08',
    borderRadius: theme.borderRadius.md,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.primary + '20',
  },
  contactButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactButtonInfo: {
    flex: 1,
  },
  contactButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  contactButtonSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  contactButtonArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionText: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
});
