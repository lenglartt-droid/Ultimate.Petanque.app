import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Linking,
  Dimensions,
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
// Quick Actions
// ============================================
function getQuickActions(t: (s: string, k: string) => string) {
  return [
    { id: 'match', title: t('faq', 'createMatch'), icon: 'sports', color: theme.primary, steps: t('faq', 'qaMatchSteps').split('|'), route: '/match/new' },
    { id: 'challenge', title: t('faq', 'launchChallenge'), icon: 'track-changes', color: theme.carreauColor, steps: t('faq', 'qaChallengeSteps').split('|'), route: '/challenge/new' },
    { id: 'tournament', title: t('faq', 'trackTournament'), icon: 'emoji-events', color: theme.success, steps: t('faq', 'qaTournamentSteps').split('|'), route: '/tournament/new' },
    { id: 'share', title: t('faq', 'shareCard'), icon: 'share', color: theme.accent, steps: t('faq', 'qaShareSteps').split('|') },
    { id: 'publish', title: t('faq', 'publishOnMap'), icon: 'public', color: '#8B5CF6', steps: t('faq', 'qaPublishSteps').split('|') },
    { id: 'meetup', title: t('faq', 'organizeMeetup'), icon: 'event', color: theme.warning, steps: t('faq', 'qaMeetupSteps').split('|'), route: '/meetup/new' },
  ];
}

// ============================================
// FAQ Data
// ============================================
function getFaqData(t: (s: string, k: string) => string) {
  return [
    { id: 'getting_started', category: t('faq', 'gettingStarted'), icon: 'play-circle-filled', color: theme.primary, questions: [
      { id: 'gs1', q: t('faq', 'gs1Q'), a: t('faq', 'gs1A') },
      { id: 'gs2', q: t('faq', 'gs2Q'), a: t('faq', 'gs2A') },
      { id: 'gs3', q: t('faq', 'gs3Q'), a: t('faq', 'gs3A') },
    ]},
    { id: 'matches', category: t('faq', 'matchesScoring'), icon: 'sports', color: theme.accent, questions: [
      { id: 'm1', q: t('faq', 'm1Q'), a: t('faq', 'm1A') },
      { id: 'm2', q: t('faq', 'm2Q'), a: t('faq', 'm2A') },
      { id: 'm3', q: t('faq', 'm3Q'), a: t('faq', 'm3A') },
      { id: 'm4', q: t('faq', 'm4Q'), a: t('faq', 'm4A') },
    ]},
    { id: 'challenges', category: t('faq', 'challengesCat'), icon: 'track-changes', color: theme.carreauColor, questions: [
      { id: 'c1', q: t('faq', 'c1Q'), a: t('faq', 'c1A') },
      { id: 'c2', q: t('faq', 'c2Q'), a: t('faq', 'c2A') },
      { id: 'c3', q: t('faq', 'c3Q'), a: t('faq', 'c3A') },
    ]},
    { id: 'tournaments', category: t('faq', 'tournamentsCat'), icon: 'emoji-events', color: theme.success, questions: [
      { id: 't1', q: t('faq', 't1Q'), a: t('faq', 't1A') },
      { id: 't2', q: t('faq', 't2Q'), a: t('faq', 't2A') },
      { id: 't3', q: t('faq', 't3Q'), a: t('faq', 't3A') },
      { id: 't4', q: t('faq', 't4Q'), a: t('faq', 't4A') },
    ]},
    { id: 'stats', category: t('faq', 'statisticsCat'), icon: 'bar-chart', color: theme.tirColor, questions: [
      { id: 's1', q: t('faq', 's1Q'), a: t('faq', 's1A') },
      { id: 's2', q: t('faq', 's2Q'), a: t('faq', 's2A') },
      { id: 's3', q: t('faq', 's3Q'), a: t('faq', 's3A') },
    ]},
    { id: 'equipment', category: t('faq', 'equipmentCat'), icon: 'sports-baseball', color: '#D97706', questions: [
      { id: 'eq1', q: t('faq', 'eq1Q'), a: t('faq', 'eq1A') },
      { id: 'eq2', q: t('faq', 'eq2Q'), a: t('faq', 'eq2A') },
      { id: 'eq3', q: t('faq', 'eq3Q'), a: t('faq', 'eq3A') },
    ]},
    { id: 'directory', category: t('faq', 'directorySharing'), icon: 'people', color: theme.accent, questions: [
      { id: 'd1', q: t('faq', 'd1Q'), a: t('faq', 'd1A') },
      { id: 'd2', q: t('faq', 'd2Q'), a: t('faq', 'd2A') },
      { id: 'd3', q: t('faq', 'd3Q'), a: t('faq', 'd3A') },
      { id: 'd4', q: t('faq', 'd4Q'), a: t('faq', 'd4A') },
      { id: 'd5', q: t('faq', 'd5Q'), a: t('faq', 'd5A') },
      { id: 'd6', q: t('faq', 'd6Q'), a: t('faq', 'd6A') },
      { id: 'd7', q: t('faq', 'd7Q'), a: t('faq', 'd7A') },
    ]},
    { id: 'preview', category: t('faq', 'previewCat'), icon: 'visibility', color: '#8B5CF6', questions: [
      { id: 'pv1', q: t('faq', 'pv1Q'), a: t('faq', 'pv1A') },
      { id: 'pv2', q: t('faq', 'pv2Q'), a: t('faq', 'pv2A') },
    ]},
    { id: 'map_public', category: t('faq', 'mapPublicItems'), icon: 'public', color: theme.success, questions: [
      { id: 'mp1', q: t('faq', 'mp1Q'), a: t('faq', 'mp1A') },
      { id: 'mp2', q: t('faq', 'mp2Q'), a: t('faq', 'mp2A') },
      { id: 'mp3', q: t('faq', 'mp3Q'), a: t('faq', 'mp3A') },
      { id: 'mp4', q: t('faq', 'mp4Q'), a: t('faq', 'mp4A') },
      { id: 'mp5', q: t('faq', 'mp5Q'), a: t('faq', 'mp5A') },
    ]},
    { id: 'meetups', category: t('faq', 'meetupsCat'), icon: 'event', color: theme.warning, questions: [
      { id: 'mu1', q: t('faq', 'mu1Q'), a: t('faq', 'mu1A') },
      { id: 'mu2', q: t('faq', 'mu2Q'), a: t('faq', 'mu2A') },
      { id: 'mu3', q: t('faq', 'mu3Q'), a: t('faq', 'mu3A') },
      { id: 'mu4', q: t('faq', 'mu4Q'), a: t('faq', 'mu4A') },
      { id: 'mu5', q: t('faq', 'mu5Q'), a: t('faq', 'mu5A') },
    ]},
    { id: 'financial', category: t('faq', 'financialCat'), icon: 'savings', color: '#10B981', questions: [
      { id: 'fin1', q: t('faq', 'fin1Q'), a: t('faq', 'fin1A') },
    ]},
    { id: 'account', category: t('faq', 'accountProfile'), icon: 'person', color: '#8B5CF6', questions: [
      { id: 'a1', q: t('faq', 'a1Q'), a: t('faq', 'a1A') },
      { id: 'a2', q: t('faq', 'a2Q'), a: t('faq', 'a2A') },
      { id: 'a3', q: t('faq', 'a3Q'), a: t('faq', 'a3A') },
      { id: 'a4', q: t('faq', 'a4Q'), a: t('faq', 'a4A') },
    ]},
  ];
}

function getTips(t: (s: string, k: string) => string) {
  return [
    { icon: 'lightbulb', text: t('faq', 'tip1'), color: theme.carreauColor },
    { icon: 'timer', text: t('faq', 'tip2'), color: theme.primary },
    { icon: 'trending-up', text: t('faq', 'tip3'), color: theme.success },
    { icon: 'share', text: t('faq', 'tip4'), color: theme.accent },
    { icon: 'public', text: t('faq', 'tip5'), color: theme.success },
    { icon: 'content-copy', text: t('faq', 'tip6'), color: theme.warning },
    { icon: 'phone-disabled', text: t('faq', 'tip7'), color: theme.error },
  ];
}

// Accordion
function AccordionItem({ question, answer, isOpen, onToggle, color }: {
  question: string; answer: string; isOpen: boolean; onToggle: () => void; color: string;
}) {
  const rotation = useSharedValue(0);
  React.useEffect(() => { rotation.value = withTiming(isOpen ? 180 : 0, { duration: 200 }); }, [isOpen]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Pressable style={[s.faqItem, isOpen && { borderLeftWidth: 3, borderLeftColor: color }]} onPress={() => { Haptics.selectionAsync(); onToggle(); }}>
      <View style={s.faqQuestion}>
        <Text style={[s.faqQuestionText, isOpen && { color }]}>{question}</Text>
        <Animated.View style={[iconStyle, s.faqChevron]}>
          <MaterialIcons name="expand-more" size={22} color={isOpen ? color : theme.textMuted} />
        </Animated.View>
      </View>
      {isOpen ? <View style={s.faqAnswerContainer}><Text style={s.faqAnswerText}>{answer}</Text></View> : null}
    </Pressable>
  );
}

// Quick Action Card
function QuickActionCard({ action }: { action: ReturnType<typeof getQuickActions>[0] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <Pressable style={[s.qaCard, expanded && { borderColor: action.color + '40', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 }]}
        onPress={() => { Haptics.selectionAsync(); setExpanded(!expanded); }}>
        <View style={[s.qaIcon, { backgroundColor: action.color + '15' }]}>
          <MaterialIcons name={action.icon as any} size={22} color={action.color} />
        </View>
        <Text style={s.qaTitle}>{action.title}</Text>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color={theme.textMuted} />
      </Pressable>
      {expanded ? (
        <View style={[s.qaSteps, { borderColor: action.color + '40' }]}>
          {action.steps.map((step, i) => (
            <View key={i} style={s.qaStep}>
              <View style={[s.qaStepNum, { backgroundColor: action.color }]}><Text style={s.qaStepNumText}>{i + 1}</Text></View>
              <Text style={s.qaStepText}>{step}</Text>
              {i < action.steps.length - 1 ? <View style={[s.qaStepConnector, { backgroundColor: action.color + '30' }]} /> : null}
            </View>
          ))}
          {action.route ? (
            <Pressable style={[s.qaGoBtn, { backgroundColor: action.color + '12' }]} onPress={() => router.push(action.route as any)}>
              <MaterialIcons name="arrow-forward" size={16} color={action.color} />
              <Text style={[s.qaGoBtnText, { color: action.color }]}>{action.title}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ============================================
// MAIN
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

  const QUICK_ACTIONS = useMemo(() => getQuickActions(t), [t]);
  const FAQ_DATA = useMemo(() => getFaqData(t), [t]);
  const TIPS = useMemo(() => getTips(t), [t]);

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
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{t('faq', 'helpCenter')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scrollView} contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }, isTablet && s.scrollContentTablet]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <LinearGradient colors={['#0F172A', '#1E3A5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <View style={s.heroIconWrap}>
              <MaterialIcons name="support-agent" size={36} color="#60A5FA" />
            </View>
            <Text style={s.heroTitle}>{t('faq', 'howCanWeHelp')}</Text>
            <Text style={s.heroSub}>{totalQs} {t('faq', 'answersAndGuides')} {"\u2022"} {FAQ_DATA.length} {t('faq', 'categories').toLowerCase()}</Text>

            {/* Search in hero */}
            <View style={s.heroSearch}>
              <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput style={s.heroSearchInput} placeholder={t('faq', 'searchQuestion')} placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
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
          <View style={s.searchBanner}>
            <MaterialIcons name="search" size={16} color={theme.textMuted} />
            <Text style={s.searchBannerText}>{totalResults} {t('faq', 'resultsFor')} "{search}"</Text>
            {totalResults === 0 ? (
              <Pressable style={s.searchBannerReset} onPress={() => { setSearch(''); setSelectedCat(null); }}>
                <Text style={s.searchBannerResetText}>{t('faq', 'resetSearch')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Quick Actions */}
        {!isSearching && !selectedCat ? (
          <Animated.View entering={FadeInDown.duration(300).delay(50)} style={s.section}>
            <View style={s.sectionHeaderRow}>
              <View style={[s.sectionHeaderIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="flash-on" size={16} color={theme.carreauColor} />
              </View>
              <Text style={s.sectionTitle}>{t('faq', 'quickGuidesTitle')}</Text>
            </View>
            <View style={s.qaGrid}>{QUICK_ACTIONS.map(a => <QuickActionCard key={a.id} action={a} />)}</View>
          </Animated.View>
        ) : null}

        {/* Category Chips */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <View style={[s.sectionHeaderIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="category" size={16} color={theme.primary} />
            </View>
            <Text style={s.sectionTitle}>{t('faq', 'categories')}</Text>
            {selectedCat ? (
              <Pressable style={s.clearBtn} onPress={() => { Haptics.selectionAsync(); setSelectedCat(null); }}>
                <MaterialIcons name="close" size={14} color={theme.primary} />
                <Text style={s.clearBtnText}>{t('faq', 'seeAll')}</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
            {FAQ_DATA.map(cat => {
              const active = selectedCat === cat.id;
              return (
                <Pressable key={cat.id} style={[s.catChip, active && { backgroundColor: cat.color, borderColor: cat.color }]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedCat(active ? null : cat.id); }}>
                  <MaterialIcons name={cat.icon as any} size={14} color={active ? '#FFF' : cat.color} />
                  <Text style={[s.catChipText, active && { color: '#FFF' }]}>{cat.category}</Text>
                  <View style={[s.catChipBadge, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                    <Text style={[s.catChipBadgeText, active && { color: '#FFF' }]}>{cat.questions.length}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* FAQ Sections */}
        {filtered.length > 0 ? (
          <View style={isTablet ? s.tabletFaqGrid : undefined}>
            {filtered.map(cat => (
              <View key={cat.id} style={[s.catSection, isTablet && s.tabletCatSection]}>
                <View style={s.catSectionHeader}>
                  <View style={[s.catSectionIcon, { backgroundColor: cat.color + '15' }]}>
                    <MaterialIcons name={cat.icon as any} size={20} color={cat.color} />
                  </View>
                  <Text style={s.catSectionTitle}>{cat.category}</Text>
                  <View style={[s.catSectionCount, { backgroundColor: cat.color + '12' }]}>
                    <Text style={[s.catSectionCountText, { color: cat.color }]}>{cat.questions.length}</Text>
                  </View>
                </View>
                <View style={s.faqList}>
                  {cat.questions.map(q => (
                    <AccordionItem key={q.id} question={q.q} answer={q.a} isOpen={openQs.has(q.id)} onToggle={() => toggleQ(q.id)} color={cat.color} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}><MaterialIcons name="search-off" size={48} color={theme.textMuted} /></View>
            <Text style={s.emptyTitle}>{t('faq', 'noResults')}</Text>
            <Text style={s.emptyText}>{t('faq', 'noResultsText')}</Text>
            <Pressable style={s.emptyBtn} onPress={() => { Haptics.selectionAsync(); setSearch(''); setSelectedCat(null); }}>
              <MaterialIcons name="refresh" size={18} color={theme.primary} />
              <Text style={s.emptyBtnText}>{t('faq', 'resetSearch')}</Text>
            </Pressable>
          </View>
        )}

        {/* Tips */}
        {!isSearching ? (
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={s.section}>
            <View style={s.sectionHeaderRow}>
              <View style={[s.sectionHeaderIcon, { backgroundColor: theme.warning + '15' }]}>
                <MaterialIcons name="lightbulb" size={16} color={theme.warning} />
              </View>
              <Text style={s.sectionTitle}>{t('faq', 'tips')}</Text>
            </View>
            <View style={[s.tipsList, isTablet && s.tipsListTablet]}>
              {(showAllTips ? TIPS : TIPS.slice(0, 3)).map((tip, i) => (
                <View key={i} style={[s.tipCard, isTablet && s.tipCardTablet]}>
                  <View style={[s.tipIcon, { backgroundColor: tip.color + '15' }]}>
                    <MaterialIcons name={tip.icon as any} size={18} color={tip.color} />
                  </View>
                  <Text style={s.tipText}>{tip.text}</Text>
                </View>
              ))}
            </View>
            {!showAllTips && TIPS.length > 3 ? (
              <Pressable style={s.showMoreBtn} onPress={() => { Haptics.selectionAsync(); setShowAllTips(true); }}>
                <Text style={s.showMoreText}>{t('faq', 'seeAllTips')} ({TIPS.length - 3})</Text>
                <MaterialIcons name="expand-more" size={18} color={theme.primary} />
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}

        {/* Contact */}
        <View style={s.contactCard}>
          <LinearGradient colors={[theme.primary + '08', theme.primary + '03']} style={s.contactInner}>
            <View style={s.contactIconWrap}>
              <MaterialIcons name="forum" size={28} color={theme.primary} />
            </View>
            <Text style={s.contactTitle}>{t('faq', 'needMoreHelp')}</Text>
            <Text style={s.contactSub}>{t('faq', 'teamHere')}</Text>

            <Pressable style={s.contactBtn} onPress={() => Linking.openURL('mailto:ultimate.petanque.app@gmail.com?subject=Ultimate%20Petanque%20-%20Aide')}>
              <View style={s.contactBtnIcon}>
                <MaterialIcons name="email" size={22} color={theme.primary} />
              </View>
              <View style={s.contactBtnInfo}>
                <Text style={s.contactBtnTitle}>{t('faq', 'sendEmail')}</Text>
                <Text style={s.contactBtnEmail}>ultimate.petanque.app@gmail.com</Text>
              </View>
              <View style={s.contactBtnArrow}>
                <MaterialIcons name="arrow-forward" size={18} color={theme.primary} />
              </View>
            </Pressable>
          </LinearGradient>
        </View>

        <Text style={s.version}>{t('common', 'version')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0 },
  scrollContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },

  // Hero
  hero: { borderRadius: theme.borderRadius.xl, padding: 28, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  heroIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(96,165,250,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: 'rgba(96,165,250,0.25)' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 20 },
  heroSearch: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: theme.borderRadius.lg, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroSearchInput: { flex: 1, fontSize: 15, color: '#FFF', padding: 0 },

  // Search banner
  searchBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  searchBannerText: { flex: 1, fontSize: 13, color: theme.textMuted, fontStyle: 'italic' },
  searchBannerReset: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '12', borderRadius: theme.borderRadius.full },
  searchBannerResetText: { fontSize: 12, fontWeight: '600', color: theme.primary },

  // Section
  section: { marginBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionHeaderIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.textPrimary, letterSpacing: 0.3 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.primary + '12', borderRadius: theme.borderRadius.full },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: theme.primary },

  // Quick Actions
  qaGrid: { gap: 8 },
  qaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, gap: 12, borderWidth: 1.5, borderColor: theme.border },
  qaIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qaTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  qaSteps: { backgroundColor: theme.surface, borderBottomLeftRadius: theme.borderRadius.md, borderBottomRightRadius: theme.borderRadius.md, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 14, borderWidth: 1.5, borderTopWidth: 0 },
  qaStep: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, position: 'relative' as const },
  qaStepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  qaStepNumText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  qaStepText: { fontSize: 14, color: theme.textPrimary, fontWeight: '500' },
  qaStepConnector: { position: 'absolute' as const, left: 11, top: 32, width: 2, height: 16 },
  qaGoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, paddingVertical: 10, borderRadius: theme.borderRadius.md },
  qaGoBtnText: { fontSize: 13, fontWeight: '600' },

  // Categories
  catScroll: { paddingBottom: 4, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.surface, borderRadius: theme.borderRadius.full, borderWidth: 1.5, borderColor: theme.border },
  catChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  catChipBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  catChipBadgeText: { fontSize: 10, fontWeight: '700', color: theme.textMuted },

  // FAQ sections
  tabletFaqGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 16 },
  tabletCatSection: { width: '48%' as any },
  catSection: { marginBottom: 20 },
  catSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  catSectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catSectionTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  catSectionCount: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  catSectionCountText: { fontSize: 12, fontWeight: '700' },

  // FAQ Items
  faqList: { gap: 8 },
  faqItem: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  faqQuestionText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary, lineHeight: 22 },
  faqChevron: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  faqAnswerContainer: { overflow: 'hidden' },
  faqAnswerText: { fontSize: 14, color: theme.textSecondary, lineHeight: 22, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, marginBottom: 20, ...theme.shadows.card },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20, paddingHorizontal: 24 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: theme.primary + '15', borderRadius: theme.borderRadius.full },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },

  // Tips
  tipsList: { gap: 8 },
  tipsListTablet: { flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, borderWidth: 1, borderColor: theme.border },
  tipCardTablet: { width: '48%' as any },
  tipIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginTop: 4 },
  showMoreText: { fontSize: 13, fontWeight: '600', color: theme.primary },

  // Contact
  contactCard: { borderRadius: theme.borderRadius.xl, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: theme.primary + '15' },
  contactInner: { padding: 24, alignItems: 'center' },
  contactIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  contactTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', marginBottom: 4 },
  contactSub: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginBottom: 20 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', width: '100%', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 14, gap: 12, borderWidth: 1, borderColor: theme.primary + '20' },
  contactBtnIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  contactBtnInfo: { flex: 1 },
  contactBtnTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  contactBtnEmail: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  contactBtnArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },

  version: { fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: 8 },
});
