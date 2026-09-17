/**
 * Admin FAQ Analytics
 *
 * Displays aggregated FAQ engagement metrics for the admin team:
 * most consulted questions, empty search queries, resolution rate and
 * audience/category breakdowns.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import theme from '@/constants/theme';
import * as Haptics from '@/services/haptics';
import { useLanguage } from '@/hooks/useLanguage';
import AdminQuickNav from '@/components/feature/AdminQuickNav';
import PageErrorBoundary from '@/components/ui/PageErrorBoundary';
import { getFaqAnalyticsSummary, FaqAnalyticsSummary } from '@/services/faqAnalyticsService';

type PeriodOption = 7 | 30 | 90 | 365;

export default function AdminFaqAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodOption>(30);
  const [summary, setSummary] = useState<FaqAnalyticsSummary | null>(null);

  const load = useCallback(async () => {
    const data = await getFaqAnalyticsSummary(period);
    setSummary(data);
    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const periodOptions: { value: PeriodOption; label: string }[] = useMemo(() => ([
    { value: 7, label: fr ? '7 jours' : '7 days' },
    { value: 30, label: fr ? '30 jours' : '30 days' },
    { value: 90, label: fr ? '90 jours' : '90 days' },
    { value: 365, label: fr ? '1 an' : '1 year' },
  ]), [fr]);

  const emptyRate = summary?.emptySearchRate || 0;
  const resolutionRate = summary?.resolutionRate || 0;

  const emptyRateColor = emptyRate < 10 ? '#10B981' : emptyRate < 25 ? '#F59E0B' : '#EF4444';
  const resolutionColor = resolutionRate >= 80 ? '#10B981' : resolutionRate >= 60 ? '#F59E0B' : '#EF4444';

  const exportCsv = useCallback(async () => {
    if (!summary) return;
    Haptics.selectionAsync();
    try {
      const rows: string[] = [];
      rows.push(fr ? 'Question ID,Vues,Categorie,Audience' : 'Question ID,Views,Category,Audience');
      summary.topQuestions.forEach(q => {
        rows.push(`${q.questionId},${q.count},${q.categoryId || ''},${q.audienceTab || ''}`);
      });
      rows.push('');
      rows.push(fr ? 'Recherche sans resultat,Occurrences' : 'Empty search,Count');
      summary.emptySearches.forEach(x => rows.push(`"${x.query}",${x.count}`));
      const csv = rows.join('\n');
      const Platform = require('react-native').Platform;
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `faq_analytics_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const FS = require('expo-file-system');
        const Sharing = require('expo-sharing');
        const fileName = `faq_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
        const fileUri = `${FS.cacheDirectory}${fileName}`;
        await FS.writeAsStringAsync(fileUri, csv, { encoding: FS.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: fileName });
        }
      }
    } catch { /* silent */ }
  }, [summary, fr]);

  return (
    <PageErrorBoundary pageName="AdminFaqAnalytics">
      <SafeAreaView edges={['top']} style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{fr ? 'FAQ Analytique' : 'FAQ Analytics'}</Text>
            <Text style={s.headerSub}>{fr ? 'Engagement, recherches et resolution' : 'Engagement, searches and resolution'}</Text>
          </View>
          <Pressable style={s.exportBtn} onPress={exportCsv} disabled={!summary}>
            <MaterialIcons name="download" size={18} color="#10B981" />
          </Pressable>
        </View>

        <AdminQuickNav currentRoute="/admin-faq-analytics" />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
        >
          {/* Period selector */}
          <View style={s.periodRow}>
            {periodOptions.map(opt => {
              const isActive = period === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[s.periodChip, isActive && s.periodChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setPeriod(opt.value); }}
                >
                  <Text style={[s.periodChipText, isActive && s.periodChipTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <View style={s.loadingBox}><ActivityIndicator size="large" color={theme.primary} /></View>
          ) : !summary || summary.totalEvents === 0 ? (
            <Animated.View entering={FadeInDown.duration(300)} style={s.emptyBox}>
              <MaterialIcons name="analytics" size={56} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{fr ? 'Aucune donnee' : 'No data'}</Text>
              <Text style={s.emptyText}>
                {fr
                  ? 'Aucune interaction FAQ enregistree pour cette periode. Les donnees apparaitront des que les utilisateurs consulteront la FAQ.'
                  : 'No FAQ interactions recorded for this period. Data will appear as users browse the FAQ.'}
              </Text>
            </Animated.View>
          ) : (
            <>
              {/* KPI cards */}
              <View style={s.kpiRow}>
                <View style={s.kpiCard}>
                  <View style={[s.kpiIcon, { backgroundColor: '#3B82F615' }]}>
                    <MaterialIcons name="visibility" size={16} color="#3B82F6" />
                  </View>
                  <Text style={s.kpiValue}>{summary.totalQuestionViews}</Text>
                  <Text style={s.kpiLabel}>{fr ? 'Vues Q&R' : 'Q&A views'}</Text>
                </View>
                <View style={s.kpiCard}>
                  <View style={[s.kpiIcon, { backgroundColor: '#7C3AED15' }]}>
                    <MaterialIcons name="people" size={16} color="#7C3AED" />
                  </View>
                  <Text style={s.kpiValue}>{summary.totalSessions}</Text>
                  <Text style={s.kpiLabel}>{fr ? 'Sessions' : 'Sessions'}</Text>
                </View>
                <View style={s.kpiCard}>
                  <View style={[s.kpiIcon, { backgroundColor: '#F59E0B15' }]}>
                    <MaterialIcons name="search" size={16} color="#F59E0B" />
                  </View>
                  <Text style={s.kpiValue}>{summary.totalSearches + summary.totalEmptySearches}</Text>
                  <Text style={s.kpiLabel}>{fr ? 'Recherches' : 'Searches'}</Text>
                </View>
              </View>

              {/* Rates */}
              <View style={s.ratesRow}>
                <View style={s.rateCard}>
                  <View style={s.rateHeader}>
                    <Text style={s.rateLabel}>{fr ? 'Recherches sans resultat' : 'Empty searches'}</Text>
                    <Text style={[s.rateValue, { color: emptyRateColor }]}>{emptyRate.toFixed(1)}%</Text>
                  </View>
                  <View style={s.rateBar}>
                    <View style={[s.rateBarFill, { width: `${Math.min(100, emptyRate)}%`, backgroundColor: emptyRateColor }]} />
                  </View>
                  <Text style={s.rateHint}>
                    {emptyRate < 10 ? (fr ? 'Excellent : contenu tres bien couvert.' : 'Excellent: content very well covered.')
                      : emptyRate < 25 ? (fr ? 'Correct : quelques lacunes a combler.' : 'Fair: some gaps to fill.')
                      : (fr ? 'A ameliorer : ajouter du contenu sur les termes recherches.' : 'Improve: add content on searched terms.')}
                  </Text>
                </View>

                <View style={s.rateCard}>
                  <View style={s.rateHeader}>
                    <Text style={s.rateLabel}>{fr ? 'Taux de resolution' : 'Resolution rate'}</Text>
                    <Text style={[s.rateValue, { color: resolutionColor }]}>{resolutionRate.toFixed(1)}%</Text>
                  </View>
                  <View style={s.rateBar}>
                    <View style={[s.rateBarFill, { width: `${Math.min(100, resolutionRate)}%`, backgroundColor: resolutionColor }]} />
                  </View>
                  <Text style={s.rateHint}>
                    {summary.resolved} {fr ? 'utile(s)' : 'helpful'} · {summary.notResolved} {fr ? 'inutile(s)' : 'not helpful'}
                  </Text>
                </View>
              </View>

              {/* Top questions */}
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <MaterialIcons name="trending-up" size={16} color={theme.primary} />
                  <Text style={s.sectionTitle}>{fr ? 'Questions les plus consultees' : 'Most consulted questions'}</Text>
                  <View style={s.sectionBadge}><Text style={s.sectionBadgeText}>{summary.topQuestions.length}</Text></View>
                </View>
                {summary.topQuestions.length === 0 ? (
                  <Text style={s.sectionEmpty}>{fr ? 'Aucune question consultee.' : 'No questions viewed.'}</Text>
                ) : (
                  summary.topQuestions.slice(0, 10).map((q, idx) => (
                    <View key={q.questionId} style={s.listRow}>
                      <View style={s.rank}><Text style={s.rankText}>{idx + 1}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listRowTitle} numberOfLines={1}>{q.questionId}</Text>
                        <Text style={s.listRowSub}>
                          {q.categoryId ? `${q.categoryId}` : ''}{q.audienceTab ? ` · ${q.audienceTab}` : ''}
                        </Text>
                      </View>
                      <View style={s.countBadge}>
                        <MaterialIcons name="visibility" size={11} color={theme.primary} />
                        <Text style={s.countBadgeText}>{q.count}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Empty searches */}
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <MaterialIcons name="search-off" size={16} color="#EF4444" />
                  <Text style={s.sectionTitle}>{fr ? 'Recherches sans resultat' : 'Searches with no results'}</Text>
                  <View style={[s.sectionBadge, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[s.sectionBadgeText, { color: '#991B1B' }]}>{summary.emptySearches.length}</Text>
                  </View>
                </View>
                {summary.emptySearches.length === 0 ? (
                  <Text style={s.sectionEmpty}>
                    {fr ? 'Aucune recherche vide : la FAQ couvre bien les termes utilises.' : 'No empty searches: FAQ covers all searched terms.'}
                  </Text>
                ) : (
                  summary.emptySearches.slice(0, 15).map((e, idx) => (
                    <View key={`${e.query}-${idx}`} style={s.listRow}>
                      <View style={[s.rank, { backgroundColor: '#FEE2E2' }]}>
                        <MaterialIcons name="help-outline" size={12} color="#EF4444" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listRowTitle} numberOfLines={1}>"{e.query}"</Text>
                        <Text style={s.listRowSub}>{fr ? 'Aucune reponse trouvee' : 'No answer found'}</Text>
                      </View>
                      <View style={[s.countBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[s.countBadgeText, { color: '#991B1B' }]}>{e.count}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Top searches (with results) */}
              {summary.topSearches.length > 0 ? (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <MaterialIcons name="manage-search" size={16} color="#10B981" />
                    <Text style={s.sectionTitle}>{fr ? 'Recherches les plus frequentes' : 'Most frequent searches'}</Text>
                  </View>
                  {summary.topSearches.slice(0, 10).map((e, idx) => (
                    <View key={`${e.query}-${idx}`} style={s.listRow}>
                      <View style={[s.rank, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={[s.rankText, { color: '#065F46' }]}>{idx + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listRowTitle} numberOfLines={1}>"{e.query}"</Text>
                      </View>
                      <View style={[s.countBadge, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={[s.countBadgeText, { color: '#065F46' }]}>{e.count}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Audience breakdown */}
              {summary.audienceBreakdown.length > 0 ? (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <MaterialIcons name="pie-chart" size={16} color="#7C3AED" />
                    <Text style={s.sectionTitle}>{fr ? 'Repartition par audience' : 'Audience breakdown'}</Text>
                  </View>
                  {(() => {
                    const total = summary.audienceBreakdown.reduce((sum, a) => sum + a.count, 0);
                    return summary.audienceBreakdown.map(a => {
                      const pct = total > 0 ? (a.count / total) * 100 : 0;
                      return (
                        <View key={a.audienceTab} style={s.audienceRow}>
                          <Text style={s.audienceLabel}>{a.audienceTab}</Text>
                          <View style={s.audienceBar}>
                            <View style={[s.audienceBarFill, { width: `${pct}%`, backgroundColor: '#7C3AED' }]} />
                          </View>
                          <Text style={s.audienceValue}>{a.count} ({pct.toFixed(0)}%)</Text>
                        </View>
                      );
                    });
                  })()}
                </View>
              ) : null}

              {/* Top categories */}
              {summary.topCategories.length > 0 ? (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <MaterialIcons name="category" size={16} color="#F59E0B" />
                    <Text style={s.sectionTitle}>{fr ? 'Categories les plus explorees' : 'Most explored categories'}</Text>
                  </View>
                  {summary.topCategories.slice(0, 8).map((c, idx) => (
                    <View key={c.categoryId} style={s.listRow}>
                      <View style={[s.rank, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[s.rankText, { color: '#92400E' }]}>{idx + 1}</Text>
                      </View>
                      <Text style={[s.listRowTitle, { flex: 1 }]} numberOfLines={1}>{c.categoryId}</Text>
                      <View style={[s.countBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[s.countBadgeText, { color: '#92400E' }]}>{c.count}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </PageErrorBoundary>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  headerSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  exportBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#10B98115', alignItems: 'center', justifyContent: 'center' },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 16, textAlign: 'center' },
  emptyText: { fontSize: 13, color: '#64748B', marginTop: 8, textAlign: 'center', lineHeight: 18 },
  periodRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  periodChip: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  periodChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  periodChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  periodChipTextActive: { color: '#FFF' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kpiValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  kpiLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  ratesRow: { gap: 10, marginBottom: 16 },
  rateCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  rateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  rateLabel: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  rateValue: { fontSize: 20, fontWeight: '800' },
  rateBar: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  rateBarFill: { height: '100%', borderRadius: 4 },
  rateHint: { fontSize: 11, color: '#64748B', lineHeight: 15 },
  section: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0F172A' },
  sectionBadge: { paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#EFF6FF', borderRadius: 8 },
  sectionBadgeText: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },
  sectionEmpty: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F8FAFC' },
  rank: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },
  listRowTitle: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  listRowSub: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#EFF6FF', borderRadius: 8 },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: '#1D4ED8' },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  audienceLabel: { fontSize: 11, fontWeight: '600', color: '#334155', width: 80 },
  audienceBar: { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  audienceBarFill: { height: '100%', borderRadius: 3 },
  audienceValue: { fontSize: 10, fontWeight: '700', color: '#7C3AED', width: 80, textAlign: 'right' },
});
