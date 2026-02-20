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
// QUICK ACTIONS - i18n
// ============================================
function getQuickActions(tFn: (s: string, k: string) => string) {
  return [
    {
      id: 'new_match',
      title: tFn('faq', 'createMatch'),
      icon: 'sports',
      color: theme.primary,
      steps: tFn('faq', 'qaMatchSteps').split('|'),
    },
    {
      id: 'new_challenge',
      title: tFn('faq', 'launchChallenge'),
      icon: 'track-changes',
      color: theme.carreauColor,
      steps: tFn('faq', 'qaChallengeSteps').split('|'),
    },
    {
      id: 'new_tournament',
      title: tFn('faq', 'trackTournament'),
      icon: 'emoji-events',
      color: theme.success,
      steps: tFn('faq', 'qaTournamentSteps').split('|'),
    },
    {
      id: 'share_card',
      title: tFn('faq', 'shareCard'),
      icon: 'share',
      color: theme.accent,
      steps: tFn('faq', 'qaShareSteps').split('|'),
    },
  ];
}

// ============================================
// FAQ DATA - i18n
// ============================================
function getFaqData(tFn: (s: string, k: string) => string) {
  return [
    {
      id: 'getting_started',
      category: tFn('faq', 'gettingStarted'),
      icon: 'play-circle-filled',
      color: theme.primary,
      questions: [
        { id: 'gs1', question: tFn('faq', 'gs1Q'), answer: tFn('faq', 'gs1A') },
        { id: 'gs2', question: tFn('faq', 'gs2Q'), answer: tFn('faq', 'gs2A') },
        { id: 'gs3', question: tFn('faq', 'gs3Q'), answer: tFn('faq', 'gs3A') },
      ],
    },
    {
      id: 'matches',
      category: tFn('faq', 'matchesScoring'),
      icon: 'sports',
      color: theme.accent,
      questions: [
        { id: 'm1', question: tFn('faq', 'm1Q'), answer: tFn('faq', 'm1A') },
        { id: 'm2', question: tFn('faq', 'm2Q'), answer: tFn('faq', 'm2A') },
        { id: 'm3', question: tFn('faq', 'm3Q'), answer: tFn('faq', 'm3A') },
        { id: 'm4', question: tFn('faq', 'm4Q'), answer: tFn('faq', 'm4A') },
      ],
    },
    {
      id: 'challenges',
      category: tFn('faq', 'challengesCat'),
      icon: 'track-changes',
      color: theme.carreauColor,
      questions: [
        { id: 'c1', question: tFn('faq', 'c1Q'), answer: tFn('faq', 'c1A') },
        { id: 'c2', question: tFn('faq', 'c2Q'), answer: tFn('faq', 'c2A') },
        { id: 'c3', question: tFn('faq', 'c3Q'), answer: tFn('faq', 'c3A') },
      ],
    },
    {
      id: 'tournaments',
      category: tFn('faq', 'tournamentsCat'),
      icon: 'emoji-events',
      color: theme.success,
      questions: [
        { id: 't1', question: tFn('faq', 't1Q'), answer: tFn('faq', 't1A') },
        { id: 't2', question: tFn('faq', 't2Q'), answer: tFn('faq', 't2A') },
        { id: 't3', question: tFn('faq', 't3Q'), answer: tFn('faq', 't3A') },
        { id: 't4', question: tFn('faq', 't4Q'), answer: tFn('faq', 't4A') },
      ],
    },
    {
      id: 'stats',
      category: tFn('faq', 'statisticsCat'),
      icon: 'bar-chart',
      color: theme.tirColor,
      questions: [
        { id: 's1', question: tFn('faq', 's1Q'), answer: tFn('faq', 's1A') },
        { id: 's2', question: tFn('faq', 's2Q'), answer: tFn('faq', 's2A') },
        { id: 's3', question: tFn('faq', 's3Q'), answer: tFn('faq', 's3A') },
      ],
    },
    {
      id: 'directory',
      category: tFn('faq', 'directorySharing'),
      icon: 'people',
      color: theme.accent,
      questions: [
        { id: 'd1', question: tFn('faq', 'd1Q'), answer: tFn('faq', 'd1A') },
        { id: 'd2', question: tFn('faq', 'd2Q'), answer: tFn('faq', 'd2A') },
        { id: 'd3', question: tFn('faq', 'd3Q'), answer: tFn('faq', 'd3A') },
        { id: 'd4', question: tFn('faq', 'd4Q'), answer: tFn('faq', 'd4A') },
      ],
    },
    {
      id: 'account',
      category: tFn('faq', 'accountProfile'),
      icon: 'person',
      color: '#8B5CF6',
      questions: [
        { id: 'a1', question: tFn('faq', 'a1Q'), answer: tFn('faq', 'a1A') },
        { id: 'a2', question: tFn('faq', 'a2Q'), answer: tFn('faq', 'a2A') },
        { id: 'a3', question: tFn('faq', 'a3Q'), answer: tFn('faq', 'a3A') },
      ],
    },
  ];
}

// ============================================
// TIPS - i18n
// ============================================
function getTips(tFn: (s: string, k: string) => string) {
  return [
    { icon: 'lightbulb', text: tFn('faq', 'tip1'), color: theme.carreauColor },
    { icon: 'timer', text: tFn('faq', 'tip2'), color: theme.primary },
    { icon: 'trending-up', text: tFn('faq', 'tip3'), color: theme.success },
    { icon: 'share', text: tFn('faq', 'tip4'), color: theme.accent },
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

  const QUICK_ACTIONS = useMemo(() => getQuickActions(t), [t]);
  const FAQ_DATA = useMemo(() => getFaqData(t), [t]);
  const TIPS = useMemo(() => getTips(t), [t]);

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
