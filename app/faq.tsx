import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';

// FAQ Categories and Questions
const FAQ_DATA = [
  {
    id: 'general',
    category: 'Général',
    icon: 'info',
    color: theme.primary,
    questions: [
      {
        id: 'q1',
        question: "Qu'est-ce que PPSS ?",
        answer: "PPSS (Personal Pétanque Scorer & Stats) est une application complète pour suivre vos parties de pétanque, analyser vos performances, gérer vos joueurs et tournois, et améliorer votre jeu grâce à des statistiques détaillées."
      },
      {
        id: 'q2',
        question: "L'application fonctionne-t-elle hors ligne ?",
        answer: "Oui ! Vous pouvez utiliser PPSS sans connexion internet. Vos données seront synchronisées automatiquement dès que vous retrouverez une connexion."
      },
      {
        id: 'q3',
        question: "Comment sauvegarder mes données ?",
        answer: "Vos données sont automatiquement sauvegardées dans le cloud lorsque vous êtes connecté. Créez un compte pour ne jamais perdre vos statistiques et historique de matchs."
      },
    ],
  },
  {
    id: 'matches',
    category: 'Matchs',
    icon: 'sports',
    color: theme.accent,
    questions: [
      {
        id: 'q4',
        question: "Comment créer un nouveau match ?",
        answer: "Sur l'écran d'accueil, appuyez sur 'Match' pour créer un nouveau match. Sélectionnez vos équipes, choisissez le format (Tête-à-tête, Doublette, Triplette), puis appuyez sur 'Commencer le match' pour démarrer le suivi en plein écran."
      },
      {
        id: 'q5',
        question: "Qu'est-ce que le mode série (Best of 3) ?",
        answer: "Le mode série vous permet d'enchaîner jusqu'à 3 matchs contre le même adversaire. Après chaque match, vous pouvez lancer une revanche. Le premier à 2 victoires remporte la série. Une 'Finale' est jouée si les deux équipes sont à 1-1."
      },
      {
        id: 'q6',
        question: "Comment fonctionne la notation détaillée ?",
        answer: "Pendant un match, appuyez sur TIR ou POINT pour ouvrir la notation en 3 étapes : 1) Résultat (Réussi/Raté), 2) Type de tir/point, 3) Qualité/Impact. Ces données permettent une analyse approfondie de votre jeu dans les statistiques."
      },
      {
        id: 'q7',
        question: "Comment modifier les actions pendant le match ?",
        answer: "Utilisez le bouton 'Édition des actions de match' pour ajuster les mènes, le chronomètre, et les actions des joueurs. Vous pouvez ajouter des tirs ou points avec la notation détaillée depuis cet écran."
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
        id: 'q8',
        question: "Quels types de défis sont disponibles ?",
        answer: "PPSS propose 3 types de défis : '10 Tirs' (tirs classiques), '10 Tirs Sautée' (tirs en cloche), et 'Tir de Précision' (20 tirs sur 5 ateliers différents avec notation par distance)."
      },
      {
        id: 'q9',
        question: "Comment fonctionne le défi de précision ?",
        answer: "Le défi de précision comprend 5 ateliers (Boule seule, Derrière le but, Entre 2 boules, Sautée, Tir de but). Pour chaque atelier, vous effectuez 4 tirs à différentes distances (6-9m) avec un chrono de 30 secondes. Les points varient selon le résultat : 0 (raté), 1 (touché), 3 (sorti), 5 (carreau)."
      },
      {
        id: 'q10',
        question: "Puis-je défier un autre joueur ?",
        answer: "Oui ! En mode 1v1, sélectionnez un adversaire parmi vos joueurs enregistrés. Vous alternez les tirs et l'application compare automatiquement vos scores pour désigner le vainqueur."
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
        id: 'q11',
        question: "Comment suivre mon parcours en tournoi ?",
        answer: "Créez un tournoi depuis l'accueil, puis ajoutez vos matchs en les associant au tournoi. La page du tournoi affiche automatiquement votre progression à travers les différentes phases (poules, 1/8, 1/4, etc.)."
      },
      {
        id: 'q12',
        question: "Quels types de cadrage sont disponibles ?",
        answer: "PPSS supporte : Poules, Élimination directe, Mixte (poules + élimination), Système Suisse, A/B/C (tableaux multiples) et Tirage intégral. Chaque type a ses propres phases."
      },
      {
        id: 'q13',
        question: "Comment recevoir des rappels de tournoi ?",
        answer: "Activez les notifications sur la page du tournoi (icône cloche). Vous pouvez configurer des rappels 1 semaine avant, 3 jours avant, ou la veille du tournoi."
      },
    ],
  },
  {
    id: 'stats',
    category: 'Statistiques',
    icon: 'bar-chart',
    color: theme.primary,
    questions: [
      {
        id: 'q14',
        question: "Quelles statistiques sont disponibles ?",
        answer: "PPSS analyse : taux de victoire, taux de réussite au tir et au point, taux de carreaux, durée moyenne des matchs, analyse des erreurs par contexte, évolution temporelle, et comparaison entre joueurs."
      },
      {
        id: 'q15',
        question: "Comment voir l'évolution de mes performances ?",
        answer: "Dans l'onglet Stats, appuyez sur 'Progression' pour voir des graphiques de votre évolution sur 4 semaines, 3 mois, 6 mois ou 1 an. Suivez vos taux de victoire, tir et point dans le temps."
      },
      {
        id: 'q16',
        question: "Qu'est-ce que l'analyse des erreurs ?",
        answer: "L'analyse des erreurs identifie vos patterns de tirs/points ratés selon : le contexte (entraînement vs tournoi), la durée du match (court/moyen/long), le format (tête-à-tête/doublette/triplette), et les types d'erreurs les plus fréquents."
      },
    ],
  },
  {
    id: 'players',
    category: 'Joueurs & Clubs',
    icon: 'people',
    color: theme.accent,
    questions: [
      {
        id: 'q17',
        question: "Comment ajouter un joueur ?",
        answer: "Depuis l'accueil, appuyez sur 'Joueur' dans l'accès rapide, ou allez dans l'Annuaire. Renseignez le nom, rôle (Tireur/Milieu/Pointeur), niveau, club et informations de contact."
      },
      {
        id: 'q18',
        question: "Comment comparer deux joueurs ?",
        answer: "Dans l'Annuaire > Joueurs, sélectionnez un joueur puis utilisez 'Comparer' pour voir les statistiques face-à-face : historique des confrontations, taux de victoire, moyennes de points."
      },
      {
        id: 'q19',
        question: "Comment associer un terrain à un club ?",
        answer: "Créez d'abord le terrain dans l'Annuaire > Terrains, puis lors de la création ou modification d'un club, associez-le au terrain existant."
      },
    ],
  },
];

// AccordionItem Component
function AccordionItem({ question, answer, isOpen, onToggle }: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const height = useSharedValue(0);
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 });
    height.value = withTiming(isOpen ? 1 : 0, { duration: 250 });
  }, [isOpen, rotation, height]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: height.value,
    maxHeight: height.value === 0 ? 0 : 500,
  }));

  return (
    <Pressable 
      style={[styles.faqItem, isOpen && styles.faqItemOpen]} 
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
    >
      <View style={styles.faqQuestion}>
        <Text style={styles.faqQuestionText}>{question}</Text>
        <Animated.View style={iconStyle}>
          <MaterialIcons name="expand-more" size={24} color={theme.textSecondary} />
        </Animated.View>
      </View>
      <Animated.View style={[styles.faqAnswerContainer, contentStyle]}>
        <Text style={styles.faqAnswerText}>{answer}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function FAQScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  // Filter questions by search and category
  const filteredData = React.useMemo(() => {
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
          <View style={styles.heroIcon}>
            <MaterialIcons name="help-outline" size={40} color={theme.primary} />
          </View>
          <Text style={styles.heroTitle}>Comment pouvons-nous vous aider ?</Text>
          <Text style={styles.heroSubtitle}>{totalQuestions} questions fréquentes</Text>
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

        {/* Category Chips */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            <Pressable
              style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedCategory(null);
              }}
            >
              <MaterialIcons name="apps" size={16} color={!selectedCategory ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                Tout
              </Text>
            </Pressable>
            {FAQ_DATA.map(cat => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip, 
                  selectedCategory === cat.id && [styles.categoryChipActive, { backgroundColor: cat.color }]
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategory(selectedCategory === cat.id ? null : cat.id);
                }}
              >
                <MaterialIcons 
                  name={cat.icon as any} 
                  size={16} 
                  color={selectedCategory === cat.id ? '#FFF' : theme.textSecondary} 
                />
                <Text style={[
                  styles.categoryChipText, 
                  selectedCategory === cat.id && styles.categoryChipTextActive
                ]}>
                  {cat.category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* FAQ Sections */}
        {filteredData.length > 0 ? (
          filteredData.map((category, catIndex) => (
            <Animated.View 
              key={category.id} 
              entering={FadeInDown.duration(300).delay(150 + catIndex * 50)}
              style={styles.categorySection}
            >
              <View style={styles.categorySectionHeader}>
                <View style={[styles.categorySectionIcon, { backgroundColor: category.color + '15' }]}>
                  <MaterialIcons name={category.icon as any} size={20} color={category.color} />
                </View>
                <Text style={styles.categorySectionTitle}>{category.category}</Text>
                <View style={styles.categorySectionCount}>
                  <Text style={styles.categorySectionCountText}>{category.questions.length}</Text>
                </View>
              </View>

              <View style={styles.faqList}>
                {category.questions.map((q, index) => (
                  <AccordionItem
                    key={q.id}
                    question={q.question}
                    answer={q.answer}
                    isOpen={openQuestions.has(q.id)}
                    onToggle={() => toggleQuestion(q.id)}
                  />
                ))}
              </View>
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.emptyState}>
            <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
            <Text style={styles.emptyStateTitle}>Aucun résultat</Text>
            <Text style={styles.emptyStateText}>
              Essayez un autre terme de recherche ou parcourez les catégories
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

        {/* Contact Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(300)} style={styles.contactSection}>
          <Text style={styles.contactTitle}>Besoin d'aide supplémentaire ?</Text>
          <Text style={styles.contactSubtitle}>Contactez-nous directement</Text>
          
          <Pressable style={styles.contactButton}>
            <View style={[styles.contactButtonIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="email" size={22} color={theme.primary} />
            </View>
            <View style={styles.contactButtonInfo}>
              <Text style={styles.contactButtonTitle}>Email</Text>
              <Text style={styles.contactButtonSubtitle}>contact@onspace.ai</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
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
    marginBottom: 16,
    gap: 12,
    ...theme.shadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    padding: 0,
  },
  // Categories
  categoriesScroll: {
    paddingBottom: 16,
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
    borderWidth: 1,
    borderColor: theme.border,
  },
  categoryChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFF',
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
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categorySectionCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  // FAQ List
  faqList: {
    gap: 10,
  },
  faqItem: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  faqItemOpen: {
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
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
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
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
  // Contact Section
  contactSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginTop: 8,
    ...theme.shadows.card,
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
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    gap: 12,
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
});
