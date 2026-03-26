import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';
import {
  fetchAmbassadorAnalytics,
  AmbassadorAnalytics,
  fetchDetailedBannerAnalytics,
  BannerDetailedAnalytics,
} from '@/services/ambassadorAnalyticsService';

type Period = 'today' | '7d' | '30d' | 'all';

const PERIODS: { key: Period; fr: string; en: string }[] = [
  { key: 'today', fr: "Aujourd'hui", en: 'Today' },
  { key: '7d', fr: '7 jours', en: '7 days' },
  { key: '30d', fr: '30 jours', en: '30 days' },
  { key: 'all', fr: 'Tout', en: 'All time' },
];

interface SponsorData {
  ambassador: Ambassador;
  analytics: AmbassadorAnalytics;
  detailed?: BannerDetailedAnalytics;
}

export default function SponsorAnalyticsScreen() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('30d');
  const [sponsors, setSponsors] = useState<SponsorData[]>([]);
  const [selectedSponsor, setSelectedSponsor] = useState<string | null>(null);
  const [detailedLoading, setDetailedLoading] = useState(false);

  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);

  const loadData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const [{ ambassadors }, { stats }] = await Promise.all([
        fetchAmbassadors(),
        fetchAmbassadorAnalytics(p),
      ]);

      const sponsorAmbs = ambassadors.filter(a =>
        a.badgeType === 'gold_sponsor' || a.badgeType === 'sponsor' || a.badgeType === 'partner'
      );

      const data: SponsorData[] = sponsorAmbs.map(amb => ({
        ambassador: amb,
        analytics: stats.get(amb.id) || { profileViews: 0, socialClicks: 0, bannerImpressions: 0, socialBreakdown: {} },
      }));

      // Sort by total impressions desc
      data.sort((a, b) => (b.analytics.bannerImpressions + b.analytics.profileViews) - (a.analytics.bannerImpressions + a.analytics.profileViews));

      setSponsors(data);
      if (data.length > 0 && !selectedSponsor) {
        setSelectedSponsor(data[0].ambassador.id);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [selectedSponsor]);

  useEffect(() => { loadData(period); }, [period]);

  // Load detailed analytics for selected sponsor
  useEffect(() => {
    if (!selectedSponsor) return;
    setDetailedLoading(true);
    const days = period === 'today' ? 1 : period === '7d' ? 7 : 30;
    fetchDetailedBannerAnalytics(selectedSponsor, days).then(({ data }) => {
      setSponsors(prev => prev.map(s => s.ambassador.id === selectedSponsor ? { ...s, detailed: data } : s));
      setDetailedLoading(false);
    }).catch(() => setDetailedLoading(false));
  }, [selectedSponsor, period]);

  const selectedData = useMemo(() => sponsors.find(s => s.ambassador.id === selectedSponsor), [sponsors, selectedSponsor]);

  // Totals
  const totals = useMemo(() => {
    let impressions = 0, clicks = 0, unique = 0;
    sponsors.forEach(s => {
      impressions += s.analytics.bannerImpressions;
      clicks += s.analytics.profileViews + s.analytics.socialClicks;
      unique += s.detailed?.uniqueViewers || 0;
    });
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0;
    return { impressions, clicks, ctr, unique };
  }, [sponsors]);

  // Sparkline renderer
  const renderSparkline = (data: number[], color: string, maxH: number = 40) => {
    const max = Math.max(...data, 1);
    const barW = Math.max(2, Math.min(8, (screenWidth - 120) / data.length - 1));
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1, height: maxH }}>
        {data.map((val, i) => (
          <View key={i} style={{ width: barW, height: Math.max(2, (val / max) * maxH), backgroundColor: color, borderRadius: 1 }} />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{language === 'fr' ? 'Analytics Sponsors' : 'Sponsor Analytics'}</Text>
          <Text style={styles.headerSub}>{language === 'fr' ? 'Performances et visibilite' : 'Performance & visibility'}</Text>
        </View>
        <Pressable style={styles.headerIcon} onPress={() => loadData(period)}>
          <MaterialIcons name="refresh" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      {/* Period Pills */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <Pressable key={p.key} style={[styles.periodPill, period === p.key && styles.periodPillActive]} onPress={() => setPeriod(p.key)}>
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p[language]}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Summary Cards */}
          <Animated.View entering={FadeIn.duration(300)} style={styles.summaryRow}>
            {[
              { value: totals.impressions.toLocaleString(), label: 'Impressions', icon: 'visibility' as const, color: '#2563EB' },
              { value: totals.clicks.toLocaleString(), label: language === 'fr' ? 'Clics' : 'Clicks', icon: 'touch-app' as const, color: '#10B981' },
              { value: `${totals.ctr}%`, label: 'CTR', icon: 'trending-up' as const, color: '#F59E0B' },
            ].map((card, i) => (
              <View key={i} style={styles.summaryCard}>
                <View style={[styles.summaryIconBg, { backgroundColor: card.color + '15' }]}>
                  <MaterialIcons name={card.icon} size={18} color={card.color} />
                </View>
                <Text style={[styles.summaryValue, { color: card.color }]}>{card.value}</Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Sponsor Selector */}
          {sponsors.length > 1 ? (
            <View style={styles.selectorRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {sponsors.map(s => {
                  const isSelected = s.ambassador.id === selectedSponsor;
                  const tierColor = s.ambassador.badgeType === 'gold_sponsor' ? '#F59E0B' : s.ambassador.badgeType === 'sponsor' ? '#94A3B8' : '#D97706';
                  return (
                    <Pressable key={s.ambassador.id} style={[styles.selectorChip, isSelected && { borderColor: tierColor, backgroundColor: tierColor + '12' }]} onPress={() => setSelectedSponsor(s.ambassador.id)}>
                      <Text style={[styles.selectorText, isSelected && { color: tierColor, fontWeight: '700' }]} numberOfLines={1}>{s.ambassador.displayName}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Selected Sponsor Detail */}
          {selectedData ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              {/* Impressions & Clicks */}
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitle}>{selectedData.ambassador.displayName}</Text>
                  <View style={[styles.tierBadge, { backgroundColor: selectedData.ambassador.badgeType === 'gold_sponsor' ? '#F59E0B' : '#94A3B8' }]}>
                    <Text style={styles.tierBadgeText}>
                      {selectedData.ambassador.badgeType === 'gold_sponsor' ? 'OR' : selectedData.ambassador.badgeType === 'sponsor' ? 'ARGENT' : 'BRONZE'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailStatsRow}>
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatValue}>{selectedData.analytics.bannerImpressions.toLocaleString()}</Text>
                    <Text style={styles.detailStatLabel}>Impressions</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatValue}>{selectedData.analytics.profileViews}</Text>
                    <Text style={styles.detailStatLabel}>{language === 'fr' ? 'Profil' : 'Profile'}</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStat}>
                    <Text style={styles.detailStatValue}>{selectedData.analytics.socialClicks}</Text>
                    <Text style={styles.detailStatLabel}>{language === 'fr' ? 'Reseaux' : 'Social'}</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStat}>
                    <Text style={[styles.detailStatValue, { color: theme.success }]}>
                      {selectedData.detailed?.clickThroughRate || 0}%
                    </Text>
                    <Text style={styles.detailStatLabel}>CTR</Text>
                  </View>
                </View>
              </View>

              {/* Sparkline Chart */}
              {selectedData.detailed && selectedData.detailed.dailyImpressions.length > 0 ? (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>{language === 'fr' ? 'Impressions quotidiennes' : 'Daily impressions'}</Text>
                  {detailedLoading ? (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
                  ) : (
                    <View style={styles.sparklineWrap}>
                      {renderSparkline(selectedData.detailed.dailyImpressions, '#2563EB', 50)}
                      <View style={styles.sparklineLegend}>
                        <Text style={styles.sparklineLegendText}>
                          {selectedData.detailed.dailyDates[0]?.slice(5)}
                        </Text>
                        <Text style={styles.sparklineLegendText}>
                          {selectedData.detailed.dailyDates[selectedData.detailed.dailyDates.length - 1]?.slice(5)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Clicks sparkline */}
                  {selectedData.detailed.dailyClicks.some(v => v > 0) ? (
                    <>
                      <Text style={[styles.chartTitle, { marginTop: 16 }]}>{language === 'fr' ? 'Clics quotidiens' : 'Daily clicks'}</Text>
                      <View style={styles.sparklineWrap}>
                        {renderSparkline(selectedData.detailed.dailyClicks, '#10B981', 35)}
                      </View>
                    </>
                  ) : null}
                </View>
              ) : null}

              {/* Page Breakdown */}
              {selectedData.detailed && Object.keys(selectedData.detailed.impressionsByPage).length > 0 ? (
                <View style={styles.breakdownCard}>
                  <Text style={styles.chartTitle}>{language === 'fr' ? 'Impressions par page' : 'Impressions by page'}</Text>
                  {Object.entries(selectedData.detailed.impressionsByPage)
                    .sort(([, a], [, b]) => b - a)
                    .map(([page, count]) => {
                      const clicks = selectedData.detailed?.clicksByPage[page] || 0;
                      const pct = selectedData.detailed ? Math.round((count / Math.max(selectedData.detailed.totalImpressions, 1)) * 100) : 0;
                      return (
                        <View key={page} style={styles.breakdownRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.breakdownPage}>{page}</Text>
                            <View style={styles.breakdownBar}>
                              <View style={[styles.breakdownBarFill, { width: `${pct}%` }]} />
                            </View>
                          </View>
                          <View style={styles.breakdownValues}>
                            <Text style={styles.breakdownCount}>{count}</Text>
                            <Text style={styles.breakdownClicks}>{clicks} {language === 'fr' ? 'clics' : 'clicks'}</Text>
                          </View>
                        </View>
                      );
                    })}
                </View>
              ) : null}

              {/* Social Breakdown */}
              {Object.keys(selectedData.analytics.socialBreakdown).length > 0 ? (
                <View style={styles.breakdownCard}>
                  <Text style={styles.chartTitle}>{language === 'fr' ? 'Clics reseaux sociaux' : 'Social media clicks'}</Text>
                  {Object.entries(selectedData.analytics.socialBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([platform, count]) => {
                      const iconMap: Record<string, keyof typeof MaterialIcons.glyphMap> = {
                        youtube: 'play-circle-filled',
                        tiktok: 'music-note',
                        instagram: 'camera-alt',
                        twitter: 'alternate-email',
                        website: 'language',
                      };
                      return (
                        <View key={platform} style={styles.socialRow}>
                          <MaterialIcons name={iconMap[platform] || 'link'} size={18} color={theme.primary} />
                          <Text style={styles.socialPlatform}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</Text>
                          <Text style={styles.socialCount}>{count}</Text>
                        </View>
                      );
                    })}
                </View>
              ) : null}

              {/* Unique Viewers */}
              {selectedData.detailed ? (
                <View style={styles.reachCard}>
                  <MaterialIcons name="people" size={22} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reachLabel}>{language === 'fr' ? 'Portee unique' : 'Unique reach'}</Text>
                    <Text style={styles.reachValue}>{selectedData.detailed.uniqueViewers} {language === 'fr' ? 'utilisateurs' : 'users'}</Text>
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : (
            <View style={styles.emptyCard}>
              <MaterialIcons name="analytics" size={48} color={theme.textMuted} />
              <Text style={styles.emptyText}>{language === 'fr' ? 'Aucun sponsor configure' : 'No sponsors configured'}</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

  // Period
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  periodPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  periodPillActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  periodText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  periodTextActive: { color: '#FFF' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, maxWidth: 700, alignSelf: 'center' as const, width: '100%' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF2',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 1 }, default: {} }),
  },
  summaryIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 10, fontWeight: '600', color: theme.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Selector
  selectorRow: { marginBottom: 16 },
  selectorChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0' },
  selectorText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  // Detail
  detailCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 }, default: {} }),
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  detailTitle: { fontSize: 17, fontWeight: '800', color: theme.textPrimary },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  detailStatsRow: { flexDirection: 'row', alignItems: 'center' },
  detailStat: { flex: 1, alignItems: 'center' },
  detailStatValue: { fontSize: 20, fontWeight: '900', color: theme.textPrimary },
  detailStatLabel: { fontSize: 10, fontWeight: '600', color: theme.textMuted, marginTop: 2, textTransform: 'uppercase' },
  detailStatDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },

  // Chart
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  chartTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  sparklineWrap: { paddingVertical: 4 },
  sparklineLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sparklineLegendText: { fontSize: 10, color: theme.textMuted },

  // Breakdown
  breakdownCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  breakdownPage: { fontSize: 13, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  breakdownBar: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden' as const },
  breakdownBarFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 2 },
  breakdownValues: { alignItems: 'flex-end' },
  breakdownCount: { fontSize: 15, fontWeight: '800', color: theme.textPrimary },
  breakdownClicks: { fontSize: 10, color: theme.textMuted },

  // Social
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  socialPlatform: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  socialCount: { fontSize: 16, fontWeight: '800', color: theme.primary },

  // Reach
  reachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  reachLabel: { fontSize: 12, fontWeight: '600', color: '#1E40AF' },
  reachValue: { fontSize: 18, fontWeight: '900', color: '#1E3A8A' },

  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: theme.textMuted, marginTop: 12 },
});
