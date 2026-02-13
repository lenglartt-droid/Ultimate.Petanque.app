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
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';

// ============================================
// QUICK ACTIONS - Guides rapides
// ============================================
const QUICK_ACTIONS = [
  {
    id: 'new_match',
    title: 'Créer un match',
    icon: 'sports',
    color: theme.primary,
    steps: ['Accueil → "Match"', 'Choisir le format', 'Sélectionner les équipes', 'Commencer'],
  },
  {
    id: 'new_challenge',
    title: 'Lancer un défi',
    icon: 'track-changes',
    color: theme.carreauColor,
    steps: ['Accueil → "Défi"', 'Choisir le type', 'Solo ou 1v1', 'Tirer !'],
  },
  {
    id: 'new_tournament',
    title: 'Suivre un tournoi',
    icon: 'emoji-events',
    color: theme.success,
    steps: ['Accueil → "Tournoi"', 'Remplir les infos', 'Ajouter des matchs', 'Voir le parcours'],
  },
  {
    id: 'share_card',
    title: 'Partager une fiche',
    icon: 'share',
    color: theme.accent,
    steps: ['Ouvrir la fiche', 'Icône partage', 'Copier le code', 'Envoyer au joueur'],
  },
];

// ============================================
// FAQ DATA
// ============================================
const FAQ_DATA = [
  {
    id: 'getting_started',
    category: 'Premiers pas',
    icon: 'play-circle-filled',
    color: theme.primary,
    questions: [
      {
        id: 'gs1',
        question: "Comment bien démarrer avec Ultimate Petanque ?",
        answer: "1. Complétez votre profil (rôle, niveau, club)\n2. Ajoutez vos partenaires de jeu dans l'annuaire\n3. Lancez votre premier match ou défi\n4. Consultez vos stats après quelques parties\n\nToutes vos données sont sauvegardées automatiquement dans le cloud."
      },
      {
        id: 'gs2',
        question: "L'application fonctionne-t-elle hors connexion ?",
        answer: "Vos données sont synchronisées avec le cloud lorsque vous avez une connexion. Pour garantir la sauvegarde de vos matchs et statistiques, il est recommandé d'être connecté."
      },
      {
        id: 'gs3',
        question: "Comment personnaliser mon profil ?",
        answer: "Allez dans Profil (icône en haut à droite de l'accueil) → Modifier. Vous pouvez changer votre photo, nom, rôle préféré (Tireur/Pointeur/Milieu), niveau, club, et informations de contact."
      },
    ],
  },
  {
    id: 'matches',
    category: 'Matchs & Scoring',
    icon: 'sports',
    color: theme.accent,
    questions: [
      {
        id: 'm1',
        question: "Comment créer et scorer un match ?",
        answer: "Depuis l'accueil, appuyez sur \"Match\". Choisissez le mode (Entraînement/Tournoi), le format (Tête-à-tête, Doublette, Triplette), sélectionnez vos équipes puis démarrez.\n\nEn plein écran, utilisez les boutons + et - pour scorer chaque mène. Le chronomètre se lance automatiquement."
      },
      {
        id: 'm2',
        question: "Comment fonctionne la notation détaillée des tirs ?",
        answer: "Pendant un match, appuyez sur TIR ou POINT pour ouvrir la notation en étapes :\n\n• Tir : Résultat → Type (tendu, en cloche, en rafle) → Si raté : où est tombée la boule → Impact\n• Point : Résultat → Type (roulé, plombé, portée) → Qualité/Distance\n\nCes données alimentent vos statistiques avancées et l'analyse des erreurs."
      },
      {
        id: 'm3',
        question: "Comment fonctionne le mode série (Best of 3) ?",
        answer: "Activez \"Série\" avant de commencer. Après chaque match, vous pouvez lancer une revanche. Le premier à 2 victoires gagne la série. Si c'est 1-1, le 3ème match est la Finale.\n\nLes séries sont suivies automatiquement dans vos statistiques."
      },
      {
        id: 'm4',
        question: "Comment modifier les actions pendant un match ?",
        answer: "Appuyez sur le bouton \"Édition\" (icône crayon) pendant le match. Vous pourrez :\n• Ajuster les scores de mènes\n• Modifier le chronomètre\n• Ajouter ou corriger des actions de tir/point\n• Assigner les rôles des joueurs"
      },
    ],
  },
  {
    id: 'challenges',
    category: 'Défis',
    icon: 'track-changes',
    color: theme.carreauColor,
    questions: [
      {
        id: 'c1',
        question: "Quels types de défis puis-je faire ?",
        answer: "3 types de défis disponibles :\n\n🎯 10 Tirs — Tirs classiques, comptez vos réussites\n🎯 10 Tirs Sautée — Tirs en cloche uniquement\n🎯 Tir de Précision — 5 ateliers × 4 tirs avec notation par distance (0/1/3/5 pts)\n\nChaque défi peut être joué en solo ou en 1v1 contre un autre joueur."
      },
      {
        id: 'c2',
        question: "Comment fonctionne le défi Précision ?",
        answer: "5 ateliers : Boule seule, Derrière le but, Entre 2 boules, Sautée, Tir de but.\n\nPour chaque atelier : 4 tirs à distances croissantes (6-9m) avec un chrono de 30 secondes par tir.\n\nBarème : Raté = 0 pts, Touché = 1 pt, Sorti = 3 pts, Carreau = 5 pts.\nScore max possible : 100 points."
      },
      {
        id: 'c3',
        question: "Comment défier un autre joueur en 1v1 ?",
        answer: "Lors de la création du défi, choisissez le mode \"1 contre 1\" puis sélectionnez votre adversaire parmi vos joueurs enregistrés. Vous alternez les tirs et l'app compare automatiquement les scores."
      },
    ],
  },
  {
    id: 'tournaments',
    category: 'Tournois',
    icon: 'emoji-events',
    color: theme.success,
    questions: [
      {
        id: 't1',
        question: "Comment suivre mon parcours en tournoi ?",
        answer: "1. Créez le tournoi (Accueil → Tournoi) avec les infos (nom, date, lieu, cadrage)\n2. Depuis la page du tournoi, ajoutez chaque match joué\n3. La progression par phases s'affiche automatiquement\n4. En fin de tournoi, enregistrez votre classement final\n\nVotre parcours, statistiques et résultat sont conservés dans le palmarès."
      },
      {
        id: 't2',
        question: "Quels formats de cadrage sont supportés ?",
        answer: "6 formats disponibles :\n\n• Poules — Matchs en groupes + classement\n• Élimination directe — Un match perdu = éliminé\n• Mixte — Poules puis élimination\n• Suisse — Rondes contre adversaires de même niveau\n• A/B/C — Tableaux multiples avec repêchage\n• Tirage intégral — Tableau fixé au tirage\n\nChaque format a ses propres phases de progression."
      },
      {
        id: 't3',
        question: "Comment activer les rappels de tournoi ?",
        answer: "Sur la page du tournoi, appuyez sur l'icône cloche (🔔). Configurez vos rappels :\n\n• 1 semaine avant\n• 3 jours avant\n• La veille (à 18h)\n\nLes rappels fonctionnent en notifications push locales, même sans internet."
      },
      {
        id: 't4',
        question: "Comment enregistrer mon classement final ?",
        answer: "Sur la page du tournoi, appuyez sur le drapeau (🏁) en bas à gauche. Un assistant en 3 étapes vous guide :\n\n1. Sélectionnez votre classement (podium ou autre)\n2. Renseignez vos gains (optionnel)\n3. Confirmez — le tournoi passe en \"Terminé\"\n\nLe résultat apparaît dans votre palmarès et bilan financier."
      },
    ],
  },
  {
    id: 'stats',
    category: 'Statistiques',
    icon: 'bar-chart',
    color: theme.tirColor,
    questions: [
      {
        id: 's1',
        question: "Quelles statistiques sont disponibles ?",
        answer: "4 catégories dans l'onglet Stats :\n\n📊 Performance — Taux de victoire, scores, séries, durées\n🎯 Tir — Réussite, carreaux, types de tir × impact\n🎱 Point — Réussite, qualité, types × précision\n❌ Erreurs — Analyse par durée, format, contexte, coaching\n\nTous les filtres temporels : Aujourd'hui, 7j, 30j, 3 mois, 6 mois, 1 an, Tout."
      },
      {
        id: 's2',
        question: "Comment fonctionne la progression ?",
        answer: "Appuyez sur \"Progression\" en haut de la page Stats. Des graphiques montrent l'évolution de vos taux (victoire, tir, point, carreaux) sur la période choisie : 4 sem., 8 sem., 3 mois, 6 mois ou 1 an.\n\nLes flèches de tendance (↑↓→) indiquent si vos performances s'améliorent."
      },
      {
        id: 's3',
        question: "Comment l'analyse des erreurs m'aide ?",
        answer: "L'onglet \"Erreurs\" identifie vos faiblesses et donne des conseils personnalisés :\n\n• Où tombent vos tirs ratés (court droite/gauche, long, bouchon)\n• Si la fatigue affecte votre jeu (parties longues vs courtes)\n• La différence entraînement vs tournoi\n• Les séries d'erreurs consécutives\n\nChaque type d'erreur est accompagné d'un conseil technique pour s'améliorer."
      },
    ],
  },
  {
    id: 'directory',
    category: 'Annuaire & Partage',
    icon: 'people',
    color: theme.accent,
    questions: [
      {
        id: 'd1',
        question: "Comment gérer mes joueurs et clubs ?",
        answer: "L'onglet Annuaire regroupe :\n\n👤 Joueurs — Ajoutez des joueurs avec nom, rôle, niveau, club, boules, contact\n🏠 Clubs — Créez des clubs avec adresse, équipements, cotisation\n⛳ Terrains — Enregistrez les terrains avec type, éclairage, photos\n\nChaque fiche joueur calcule automatiquement ses statistiques à partir des matchs."
      },
      {
        id: 'd2',
        question: "Comment partager une fiche avec un autre joueur ?",
        answer: "1. Ouvrez la fiche (joueur, club, terrain ou tournoi)\n2. Appuyez sur l'icône de partage\n3. Choisissez la permission (lecture seule ou modification)\n4. Copiez et envoyez le code à votre partenaire\n\nVotre partenaire saisit le code dans Profil → Partage → Code de partage."
      },
      {
        id: 'd3',
        question: "Comment gérer les fiches partagées ?",
        answer: "Profil → Partage → Gestion des partages :\n\n• Onglet \"Mes partages\" : voir vos codes actifs, copier, basculer les permissions, révoquer\n• Onglet \"Reçus\" : voir les fiches qu'on vous a partagées, les enregistrer dans votre annuaire\n\nVous recevez une notification quand quelqu'un utilise un de vos codes."
      },
      {
        id: 'd4',
        question: "Puis-je enregistrer une fiche partagée ?",
        answer: "Oui ! Sur toute fiche reçue en partage, un bouton \"Enregistrer\" (💾) apparaît. La fiche est copiée intégralement dans votre annuaire personnel. Vous pouvez ensuite la modifier librement."
      },
    ],
  },
  {
    id: 'account',
    category: 'Compte & Profil',
    icon: 'person',
    color: '#8B5CF6',
    questions: [
      {
        id: 'a1',
        question: "Comment changer mon mot de passe ?",
        answer: "Profil → Paramètres → Mot de passe. Saisissez votre ancien mot de passe, puis le nouveau (minimum 6 caractères) et confirmez."
      },
      {
        id: 'a2',
        question: "Où trouver mon palmarès et bilan financier ?",
        answer: "Depuis votre Profil :\n\n🏆 Mon Palmarès — Tous vos résultats de tournois, badges de performance, classement par saison\n💰 Bilan financier — Résumé des gains, inscriptions, cotisations club, balance nette\n\nCes pages se mettent à jour automatiquement."
      },
      {
        id: 'a3',
        question: "Comment configurer les notifications ?",
        answer: "Profil → Paramètres → Notifications :\n\n• Notifications de partage — Alertes quand quelqu'un accède à vos fiches\n• Notifications de tournois — Rappels programmés avant vos tournois\n\nLes notifications push locales fonctionnent sans connexion internet."
      },
    ],
  },
];

// ============================================
// TIPS - Astuces rapides
// ============================================
const TIPS = [
  { icon: 'lightbulb', text: "Utilisez la notation détaillée pour des statistiques d'erreurs personnalisées", color: theme.carreauColor },
  { icon: 'timer', text: "Le chronomètre se met en pause automatiquement entre les mènes", color: theme.primary },
  { icon: 'trending-up', text: "Jouez régulièrement pour voir votre courbe de progression évoluer", color: theme.success },
  { icon: 'share', text: "Partagez votre fiche joueur pour que vos coéquipiers voient vos stats", color: theme.accent },
];

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
  const height = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 });
    height.value = withTiming(isOpen ? 1 : 0, { duration: 250 });
  }, [isOpen, rotation, height]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: height.value,
    maxHeight: height.value === 0 ? 0 : 600,
  }));

  return (
    <Pressable
      style={[styles.faqItem, isOpen && [styles.faqItemOpen, { borderLeftColor: accentColor }]]}
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
      <Animated.View style={[styles.faqAnswerContainer, contentStyle]}>
        <Text style={styles.faqAnswerText}>{answer}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ============================================
// QuickActionCard Component
// ============================================
function QuickActionCard({ action, index }: { action: typeof QUICK_ACTIONS[0]; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Animated.View entering={FadeInDown.duration(250).delay(100 + index * 60)}>
      <Pressable
        style={[styles.quickActionCard, expanded && { borderColor: action.color + '40' }]}
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
        <Animated.View entering={FadeIn.duration(200)} style={styles.quickActionSteps}>
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
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function FAQScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());
  const [showAllTips, setShowAllTips] = useState(false);

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
  }, [searchQuery, selectedCategory]);

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
        <Text style={styles.headerTitle}>Centre d'aide</Text>
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
          <Text style={styles.heroTitle}>Comment pouvons-nous vous aider ?</Text>
          <Text style={styles.heroSubtitle}>
            {totalQuestions} réponses • 4 guides rapides
          </Text>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.searchContainer}>
          <MaterialIcons name="search" size={22} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une question..."
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
          <Animated.View entering={FadeInDown.duration(300).delay(80)} style={styles.quickActionsSection}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="flash-on" size={18} color={theme.carreauColor} />
              <Text style={styles.sectionHeaderText}>Guides rapides</Text>
            </View>
            <View style={styles.quickActionsGrid}>
              {QUICK_ACTIONS.map((action, index) => (
                <QuickActionCard key={action.id} action={action} index={index} />
              ))}
            </View>
          </Animated.View>
        )}

        {/* Category Chips */}
        <Animated.View entering={FadeInDown.duration(300).delay(isSearching ? 80 : 120)}>
          <View style={styles.sectionHeaderRow}>
            <MaterialIcons name="category" size={18} color={theme.primary} />
            <Text style={styles.sectionHeaderText}>Catégories</Text>
            {selectedCategory && (
              <Pressable
                style={styles.clearFilterBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategory(null);
                }}
              >
                <MaterialIcons name="close" size={14} color={theme.primary} />
                <Text style={styles.clearFilterText}>Tout voir</Text>
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
        </Animated.View>

        {/* Search results count */}
        {isSearching && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.searchResultInfo}>
            <MaterialIcons name="search" size={16} color={theme.textMuted} />
            <Text style={styles.searchResultText}>
              {filteredData.reduce((sum, c) => sum + c.questions.length, 0)} résultat(s) pour "{searchQuery}"
            </Text>
          </Animated.View>
        )}

        {/* FAQ Sections */}
        {filteredData.length > 0 ? (
          filteredData.map((category, catIndex) => (
            <Animated.View
              key={category.id}
              entering={FadeInDown.duration(300).delay(150 + catIndex * 40)}
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
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
            </View>
            <Text style={styles.emptyStateTitle}>Aucun résultat</Text>
            <Text style={styles.emptyStateText}>
              Essayez un autre terme ou parcourez les catégories
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
              <Text style={styles.emptyStateButtonText}>Réinitialiser</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Tips Section - only when not searching */}
        {!isSearching && (
          <Animated.View entering={FadeInDown.duration(300).delay(300)} style={styles.tipsSection}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="lightbulb" size={18} color={theme.warning} />
              <Text style={styles.sectionHeaderText}>Astuces</Text>
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
                <Text style={styles.showMoreText}>Voir toutes les astuces</Text>
                <MaterialIcons name="expand-more" size={18} color={theme.primary} />
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Contact Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(350)} style={styles.contactSection}>
          <View style={styles.contactHeader}>
            <View style={styles.contactHeaderIcon}>
              <MaterialIcons name="forum" size={28} color={theme.primary} />
            </View>
            <Text style={styles.contactTitle}>Besoin d'aide supplémentaire ?</Text>
            <Text style={styles.contactSubtitle}>Notre équipe est là pour vous</Text>
          </View>

          <Pressable
            style={styles.contactButton}
            onPress={() => Linking.openURL('mailto:contact@onspace.ai?subject=Ultimate%20Petanque%20-%20Aide')}
          >
            <View style={[styles.contactButtonIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="email" size={22} color={theme.primary} />
            </View>
            <View style={styles.contactButtonInfo}>
              <Text style={styles.contactButtonTitle}>Envoyer un email</Text>
              <Text style={styles.contactButtonSubtitle}>contact@onspace.ai</Text>
            </View>
            <View style={styles.contactButtonArrow}>
              <MaterialIcons name="arrow-forward" size={18} color={theme.primary} />
            </View>
          </Pressable>
        </Animated.View>

        {/* Version */}
        <Text style={styles.versionText}>Ultimate Petanque v1.0.0</Text>
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
    marginTop: -8,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderWidth: 1,
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  faqItemOpen: {
    borderLeftWidth: 3,
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
    overflow: 'hidden',
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
