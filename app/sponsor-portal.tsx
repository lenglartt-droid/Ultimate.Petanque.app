import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  RefreshControl, Platform, Dimensions, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme, { blurhash } from '@/constants/theme';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { invalidateAmbassadorCache, AMBASSADOR_LEVELS, AmbassadorLevel } from '@/services/ambassadorService';
import { fetchAmbassadorAnalytics, AmbassadorAnalytics, fetchDetailedBannerAnalytics, BannerDetailedAnalytics } from '@/services/ambassadorAnalyticsService';
import { getMySponsoredEvents, SponsoredEvent } from '@/services/sponsoredEventService';
import Svg, { Polyline, Circle as SvgCircle } from 'react-native-svg';

function Sparkline({ data, width, height, color }: { data: number[]; width: number; height: number; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = data.map((v, i) => `${pad + (i / (data.length - 1)) * w},${pad + h - (v / max) * h}`).join(' ');
  const lastIdx = data.length - 1;
  const lastX = pad + (lastIdx / (data.length - 1)) * w;
  const lastY = pad + h - (data[lastIdx] / max) * h;
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <SvgCircle cx={lastX} cy={lastY} r={4} fill={color} />
    </Svg>
  );
}

const PAGE_LABELS: Record<string, { label: { fr: string; en: string }; icon: string; color: string }> = {
  home: { label: { fr: 'Accueil', en: 'Home' }, icon: 'home', color: '#3B82F6' },
  stats: { label: { fr: 'Stats', en: 'Stats' }, icon: 'bar-chart', color: '#7C3AED' },
  directory: { label: { fr: 'Annuaire', en: 'Directory' }, icon: 'people', color: '#10B981' },
  map: { label: { fr: 'Carte', en: 'Map' }, icon: 'map', color: '#F59E0B' },
  onboarding: { label: { fr: 'Onboarding', en: 'Onboarding' }, icon: 'rocket-launch', color: '#EC4899' },
  partners: { label: { fr: 'Partenaires', en: 'Partners' }, icon: 'handshake', color: '#6366F1' },
  unknown: { label: { fr: 'Autre', en: 'Other' }, icon: 'help-outline', color: '#94A3B8' },
};

export default function SponsorPortalScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { language } = useLanguage();
  const fr = language === 'fr';
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sponsor, setSponsor] = useState<any | null>(null);
  const [analytics, setAnalytics] = useState<AmbassadorAnalytics | null>(null);
  const [bannerData, setBannerData] = useState<BannerDetailedAnalytics | null>(null);
  const [events, setEvents] = useState<SponsoredEvent[]>([]);
  const [period, setPeriod] = useState<7 | 30>(30);
  const [activeSection, setActiveSection] = useState<'roi' | 'placement' | 'events'>('roi');

  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width || 375);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const chartW = Math.min(screenWidth - 100, 480);

  const loadSponsor = useCallback(async () => {
    if (!user?.id) return null;
    const { data } = await supabase
      .from('ambassadors')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    setSponsor(data);
    return data;
  }, [user?.id, supabase]);

  const loadAnalytics = useCallback(async (ambId: string) => {
    const [{ stats }, bannerRes] = await Promise.all([
      fetchAmbassadorAnalytics('30d'),
      fetchDetailedBannerAnalytics(ambId, period),
    ]);
    setAnalytics(stats.get(ambId) || { profileViews: 0, socialClicks: 0, bannerImpressions: 0, socialBreakdown: {} });
    setBannerData(bannerRes.data);
  }, [period]);

  const loadEvents = useCallback(async () => {
    const { events: evts } = await getMySponsoredEvents();
    setEvents(evts.slice(0, 10));
  }, []);

  const loadAll = useCallback(async () => {
    const sp = await loadSponsor();
    if (sp) {
      await Promise.all([loadAnalytics(sp.id), loadEvents()]);
    }
    setLoading(false);
  }, [loadSponsor, loadAnalytics, loadEvents]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    if (sponsor?.id) loadAnalytics(sponsor.id);
  }, [period, sponsor?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.loadingWrap}><ActivityIndicator size="large" color="#D4A017" /></View>
      </SafeAreaView>
    );
  }

  if (!sponsor) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.headerRow}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={st.headerTitle}>{fr ? 'Portail Sponsor' : 'Sponsor Portal'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={st.loadingWrap}>
          <MaterialIcons name="lock" size={48} color={theme.textMuted} />
          <Text style={st.emptyText}>
            {fr ? "Vous n'etes pas enregistre comme sponsor/partenaire." : 'You are not registered as a sponsor/partner.'}
          </Text>
          <Pressable style={st.emptyBtn} onPress={() => router.push('/partnerships' as any)}>
            <MaterialIcons name="handshake" size={18} color="#FFF" />
            <Text style={st.emptyBtnText}>{fr ? 'Devenir partenaire' : 'Become a partner'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isGold = sponsor.badge_type === 'gold_sponsor';
  const tierColor = isGold ? '#D4A017' : sponsor.badge_type === 'sponsor' ? '#78909C' : '#A1887F';
  const tierLabel = isGold ? (fr ? 'Partenaire Or' : 'Gold Partner') : sponsor.badge_type === 'sponsor' ? (fr ? 'Partenaire Argent' : 'Silver Partner') : (fr ? 'Partenaire Bronze' : 'Bronze Partner');
  const tierGradient: [string, string] = isGold ? ['#B45309', '#F59E0B'] : sponsor.badge_type === 'sponsor' ? ['#475569', '#94A3B8'] : ['#78350F', '#D97706'];

  const dailyImp = bannerData ? bannerData.dailyImpressions.slice(-period) : [];
  const dailyClk = bannerData ? bannerData.dailyClicks.slice(-period) : [];
  const dailyDates = bannerData ? bannerData.dailyDates.slice(-period) : [];
  const totalImp = dailyImp.reduce((s, v) => s + v, 0);
  const totalClk = dailyClk.reduce((s, v) => s + v, 0);
  const ctr = totalImp > 0 ? Math.round((totalClk / totalImp) * 1000) / 10 : 0;

  const sections = [
    { id: 'roi' as const, icon: 'insights', label: fr ? 'ROI' : 'ROI' },
    { id: 'placement' as const, icon: 'place', label: fr ? 'Placements' : 'Placements' },
    { id: 'events' as const, icon: 'event', label: fr ? 'Evenements' : 'Events' },
  ];

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      {/* Header */}
      <View style={st.headerRow}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>{fr ? 'Portail Sponsor' : 'Sponsor Portal'}</Text>
        <Pressable style={st.headerAction} onPress={() => router.push('/ambassador-dashboard' as any)}>
          <MaterialIcons name="dashboard" size={20} color={tierColor} />
        </Pressable>
      </View>

      {/* Hero */}
      <LinearGradient colors={tierGradient} style={st.hero}>
        <View style={st.heroDeco1} />
        <View style={st.heroDeco2} />
        <View style={st.heroContent}>
          {sponsor.photo ? (
            <Image source={{ uri: sponsor.photo }} style={st.heroAvatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={[st.heroAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <MaterialIcons name={isGold ? 'workspace-premium' : 'handshake'} size={32} color="#FFF" />
            </View>
          )}
          <View style={st.heroInfo}>
            <Text style={st.heroName} numberOfLines={1}>{sponsor.display_name}</Text>
            <View style={st.heroBadge}>
              <MaterialIcons name={isGold ? 'star' : 'workspace-premium'} size={10} color="#FFF" />
              <Text style={st.heroBadgeText}>{tierLabel.toUpperCase()}</Text>
            </View>
          </View>
        </View>
        {/* Quick KPIs */}
        <View style={st.heroKpis}>
          {[
            { value: totalImp, label: fr ? 'Impressions' : 'Impressions', icon: 'visibility' },
            { value: totalClk, label: fr ? 'Clics' : 'Clicks', icon: 'touch-app' },
            { value: `${ctr}%`, label: 'CTR', icon: 'percent' },
            { value: bannerData?.uniqueViewers || 0, label: fr ? 'Portee' : 'Reach', icon: 'people' },
          ].map((kpi, i) => (
            <View key={i} style={st.heroKpi}>
              <Text style={st.heroKpiValue}>{kpi.value}</Text>
              <Text style={st.heroKpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Period Toggle */}
      <View style={st.periodRow}>
        {([7, 30] as const).map(p => (
          <Pressable key={p} style={[st.periodChip, period === p && { backgroundColor: tierColor, borderColor: tierColor }]} onPress={() => { Haptics.selectionAsync(); setPeriod(p); }}>
            <Text style={[st.periodText, period === p && { color: '#FFF' }]}>{p}{fr ? 'j' : 'd'}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        {sections.map(sec => (
          <Pressable key={sec.id} style={[st.sectionTab, activeSection === sec.id && { backgroundColor: tierColor + '15', borderColor: tierColor + '30' }]} onPress={() => { Haptics.selectionAsync(); setActiveSection(sec.id); }}>
            <MaterialIcons name={sec.icon as any} size={16} color={activeSection === sec.id ? tierColor : theme.textMuted} />
            <Text style={[st.sectionTabText, activeSection === sec.id && { color: tierColor }]}>{sec.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tierColor} />}
      >
        {/* ====== ROI SECTION ====== */}
        {activeSection === 'roi' ? (
          <>
            {/* KPI Cards */}
            <Animated.View entering={FadeInDown.duration(300)} style={st.kpiGrid}>
              {[
                { value: totalImp, label: fr ? 'Impressions' : 'Impressions', icon: 'visibility', color: '#3B82F6' },
                { value: totalClk, label: fr ? 'Clics' : 'Clicks', icon: 'touch-app', color: '#10B981' },
                { value: `${ctr}%`, label: 'CTR', icon: 'trending-up', color: '#F59E0B' },
                { value: bannerData?.uniqueViewers || 0, label: fr ? 'Portee unique' : 'Unique reach', icon: 'people', color: '#7C3AED' },
              ].map((kpi, i) => (
                <View key={i} style={st.kpiCard}>
                  <View style={[st.kpiIcon, { backgroundColor: kpi.color + '12' }]}>
                    <MaterialIcons name={kpi.icon as any} size={20} color={kpi.color} />
                  </View>
                  <Text style={st.kpiValue}>{kpi.value}</Text>
                  <Text style={st.kpiLabel}>{kpi.label}</Text>
                </View>
              ))}
            </Animated.View>

            {/* Sparkline Charts */}
            <Animated.View entering={FadeInDown.duration(300).delay(100)} style={st.chartCard}>
              <Text style={st.chartTitle}>{fr ? `Tendance ${period}j` : `${period}d Trend`}</Text>
              {/* Impressions */}
              <View style={st.chartBlock}>
                <View style={st.chartHeader}>
                  <View style={[st.chartDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={st.chartLabel}>{fr ? 'Impressions' : 'Impressions'}</Text>
                  <Text style={[st.chartTotal, { color: '#3B82F6' }]}>{totalImp}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Sparkline data={dailyImp} width={chartW} height={52} color="#3B82F6" />
                </View>
              </View>
              {/* Clicks */}
              <View style={[st.chartBlock, { marginTop: 16 }]}>
                <View style={st.chartHeader}>
                  <View style={[st.chartDot, { backgroundColor: '#10B981' }]} />
                  <Text style={st.chartLabel}>{fr ? 'Clics' : 'Clicks'}</Text>
                  <Text style={[st.chartTotal, { color: '#10B981' }]}>{totalClk}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Sparkline data={dailyClk} width={chartW} height={52} color="#10B981" />
                </View>
              </View>
              {/* Date range */}
              <View style={st.chartDates}>
                <Text style={st.chartDateText}>{dailyDates[0]?.slice(5) || ''}</Text>
                <Text style={st.chartDateText}>{dailyDates[dailyDates.length - 1]?.slice(5) || ''}</Text>
              </View>
            </Animated.View>

            {/* CTR Card */}
            <Animated.View entering={FadeInDown.duration(300).delay(150)} style={st.ctrCard}>
              <View style={st.ctrHeader}>
                <MaterialIcons name="trending-up" size={20} color="#F59E0B" />
                <Text style={st.ctrTitle}>{fr ? 'Taux de conversion' : 'Conversion rate'}</Text>
              </View>
              <Text style={st.ctrValue}>{ctr}%</Text>
              <Text style={st.ctrDesc}>
                {fr
                  ? `${totalClk} clic(s) pour ${totalImp} impression(s) sur ${period} jours`
                  : `${totalClk} click(s) from ${totalImp} impression(s) over ${period} days`}
              </Text>
            </Animated.View>
          </>
        ) : null}

        {/* ====== PLACEMENT SECTION ====== */}
        {activeSection === 'placement' ? (
          <>
            {/* Impressions by Page */}
            <Animated.View entering={FadeInDown.duration(300)} style={st.placementCard}>
              <Text style={st.placementTitle}>{fr ? 'Vos emplacements' : 'Your placements'}</Text>
              <Text style={st.placementDesc}>
                {fr
                  ? 'Repartition de votre visibilite dans l\'application'
                  : 'Distribution of your visibility in the app'}
              </Text>
              {bannerData && Object.keys(bannerData.impressionsByPage).length > 0 ? (
                Object.entries(bannerData.impressionsByPage)
                  .sort((a, b) => b[1] - a[1])
                  .map(([page, count]) => {
                    const cfg = PAGE_LABELS[page] || PAGE_LABELS.unknown;
                    const pct = bannerData.totalImpressions > 0 ? Math.round((count / bannerData.totalImpressions) * 100) : 0;
                    const clicks = bannerData.clicksByPage[page] || 0;
                    const pageCtr = count > 0 ? Math.round((clicks / count) * 1000) / 10 : 0;
                    return (
                      <View key={page} style={st.pageRow}>
                        <View style={[st.pageIcon, { backgroundColor: cfg.color + '12' }]}>
                          <MaterialIcons name={cfg.icon as any} size={18} color={cfg.color} />
                        </View>
                        <View style={st.pageInfo}>
                          <View style={st.pageNameRow}>
                            <Text style={st.pageName}>{cfg.label[language] || cfg.label.en}</Text>
                            <Text style={st.pagePct}>{pct}%</Text>
                          </View>
                          <View style={st.pageBarTrack}>
                            <View style={[st.pageBarFill, { width: `${pct}%`, backgroundColor: cfg.color }]} />
                          </View>
                          <View style={st.pageMetaRow}>
                            <Text style={st.pageMeta}>{count} imp.</Text>
                            <Text style={st.pageMeta}>{clicks} {fr ? 'clics' : 'clicks'}</Text>
                            <Text style={[st.pageMeta, { color: cfg.color, fontWeight: '700' }]}>{pageCtr}% CTR</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
              ) : (
                <View style={st.emptyPlacement}>
                  <MaterialIcons name="visibility-off" size={36} color={theme.textMuted} />
                  <Text style={st.emptyText}>{fr ? 'Aucune impression enregistree' : 'No impressions recorded'}</Text>
                </View>
              )}
            </Animated.View>

            {/* Visibility Perks */}
            <Animated.View entering={FadeInDown.duration(300).delay(100)} style={st.perksCard}>
              <Text style={st.perksTitle}>{fr ? 'Vos avantages visibilite' : 'Your visibility perks'}</Text>
              {[
                isGold && { icon: 'star', text: fr ? 'Banniere dediee sur l\'accueil' : 'Dedicated home banner', active: true },
                isGold && { icon: 'phone-android', text: fr ? 'Section onboarding dediee' : 'Dedicated onboarding section', active: true },
                { icon: 'map', text: fr ? 'Marqueurs personnalises sur la carte' : 'Custom markers on map', active: true },
                { icon: 'campaign', text: fr ? 'Defis sponsorises' : 'Sponsored challenges', active: true },
                isGold && { icon: 'notifications-active', text: fr ? 'Push notifications illimitees' : 'Unlimited push notifications', active: true },
                !isGold && { icon: 'notifications', text: fr ? '1 push notification/mois' : '1 push notification/month', active: sponsor.badge_type === 'sponsor' },
              ].filter(Boolean).map((perk: any, i) => (
                <View key={i} style={st.perkRow}>
                  <View style={[st.perkIcon, { backgroundColor: perk.active ? tierColor + '12' : '#F1F5F9' }]}>
                    <MaterialIcons name={perk.icon} size={16} color={perk.active ? tierColor : theme.textMuted} />
                  </View>
                  <Text style={[st.perkText, !perk.active && { color: theme.textMuted }]}>{perk.text}</Text>
                  <MaterialIcons name={perk.active ? 'check-circle' : 'radio-button-unchecked'} size={18} color={perk.active ? '#10B981' : theme.textMuted} />
                </View>
              ))}
            </Animated.View>
          </>
        ) : null}

        {/* ====== EVENTS SECTION ====== */}
        {activeSection === 'events' ? (
          <>
            <View style={st.eventsHeader}>
              <Text style={st.eventsCount}>{events.length} {fr ? 'evenement(s)' : 'event(s)'}</Text>
              <Pressable style={[st.newEventBtn, { backgroundColor: tierColor }]} onPress={() => router.push('/sponsored-event/new' as any)}>
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={st.newEventBtnText}>{fr ? 'Nouveau' : 'New'}</Text>
              </Pressable>
            </View>
            {events.length === 0 ? (
              <View style={st.emptyEvents}>
                <MaterialIcons name="event-busy" size={48} color={theme.textMuted} />
                <Text style={st.emptyText}>{fr ? 'Aucun evenement sponsorise' : 'No sponsored events'}</Text>
                <Pressable style={[st.emptyBtn, { backgroundColor: tierColor }]} onPress={() => router.push('/sponsored-event/new' as any)}>
                  <MaterialIcons name="add" size={18} color="#FFF" />
                  <Text style={st.emptyBtnText}>{fr ? 'Creer un evenement' : 'Create event'}</Text>
                </Pressable>
              </View>
            ) : (
              events.map((ev, idx) => {
                const statusColor = ev.status === 'active' ? '#22C55E' : ev.status === 'completed' ? '#3B82F6' : '#F59E0B';
                return (
                  <Animated.View key={ev.id} entering={FadeInDown.duration(250).delay(idx * 50)}>
                    <Pressable style={st.eventCard} onPress={() => router.push(`/sponsored-event/${ev.id}` as any)}>
                      <View style={st.eventHeader}>
                        <View style={[st.eventDot, { backgroundColor: statusColor }]} />
                        <Text style={[st.eventStatus, { color: statusColor }]}>
                          {ev.status === 'upcoming' ? (fr ? 'A venir' : 'Upcoming') : ev.status === 'active' ? (fr ? 'En cours' : 'Active') : (fr ? 'Termine' : 'Done')}
                        </Text>
                        <View style={{ flex: 1 }} />
                        <Text style={st.eventDate}>
                          {new Date(ev.eventDate).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      <Text style={st.eventTitle} numberOfLines={1}>{ev.title}</Text>
                      <View style={st.eventMeta}>
                        <MaterialIcons name="track-changes" size={14} color={theme.textMuted} />
                        <Text style={st.eventMetaText}>
                          {ev.challengeType === '10_tirs' ? '10 Tirs' : ev.challengeType === '10_tirs_sautee' ? '10 Tirs sautee' : 'Precision'}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} style={{ position: 'absolute', right: 14, top: '50%' }} />
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </>
        ) : null}

        {/* Quick Actions */}
        <Animated.View entering={FadeIn.duration(300).delay(200)} style={st.actionsCard}>
          <Text style={st.actionsTitle}>{fr ? 'Actions rapides' : 'Quick actions'}</Text>
          <View style={st.actionsGrid}>
            <Pressable style={({ pressed }) => [st.actionBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]} onPress={() => router.push('/ambassador-dashboard' as any)}>
              <View style={[st.actionIcon, { backgroundColor: '#7C3AED12' }]}>
                <MaterialIcons name="dashboard" size={22} color="#7C3AED" />
              </View>
              <Text style={st.actionLabel}>{fr ? 'Portail complet' : 'Full portal'}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [st.actionBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]} onPress={() => router.push('/sponsored-event/new' as any)}>
              <View style={[st.actionIcon, { backgroundColor: '#10B98112' }]}>
                <MaterialIcons name="add-circle" size={22} color="#10B981" />
              </View>
              <Text style={st.actionLabel}>{fr ? 'Defi sponsor' : 'Sponsor challenge'}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [st.actionBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]} onPress={() => router.push('/partners' as any)}>
              <View style={[st.actionIcon, { backgroundColor: '#3B82F612' }]}>
                <MaterialIcons name="storefront" size={22} color="#3B82F6" />
              </View>
              <Text style={st.actionLabel}>{fr ? 'Page partenaires' : 'Partners page'}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [st.actionBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]} onPress={() => { if (sponsor.website_url) Linking.openURL(sponsor.website_url); }}>
              <View style={[st.actionIcon, { backgroundColor: tierColor + '12' }]}>
                <MaterialIcons name="language" size={22} color={tierColor} />
              </View>
              <Text style={st.actionLabel}>{fr ? 'Mon site' : 'My site'}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  headerAction: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  // Hero
  hero: { paddingTop: 20, paddingBottom: 18, paddingHorizontal: 20, overflow: 'hidden', position: 'relative' },
  heroDeco1: { position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroDeco2: { position: 'absolute', bottom: -15, left: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  heroAvatar: { width: 56, height: 56, borderRadius: 18, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 6 },
  heroBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  heroKpis: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroKpi: { flex: 1, alignItems: 'center' },
  heroKpiValue: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  heroKpiLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 2, textTransform: 'uppercase' },
  // Period
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  periodChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0' },
  periodText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  sectionTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  sectionTabText: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, maxWidth: 640, alignSelf: 'center' as const, width: '100%' },
  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpiCard: { width: '47%', flexGrow: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 1 }, default: {} }) },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  kpiLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase' },
  // Chart
  chartCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  chartBlock: {},
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  chartDot: { width: 10, height: 10, borderRadius: 5 },
  chartLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#334155' },
  chartTotal: { fontSize: 16, fontWeight: '800' },
  chartDates: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 4 },
  chartDateText: { fontSize: 10, fontWeight: '500', color: '#94A3B8' },
  // CTR Card
  ctrCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  ctrHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  ctrTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  ctrValue: { fontSize: 36, fontWeight: '900', color: '#F59E0B', marginBottom: 4 },
  ctrDesc: { fontSize: 13, color: '#94A3B8', lineHeight: 18 },
  // Placement
  placementCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  placementTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  placementDesc: { fontSize: 12, color: '#94A3B8', marginBottom: 16 },
  pageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  pageIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pageInfo: { flex: 1, gap: 4 },
  pageNameRow: { flexDirection: 'row', justifyContent: 'space-between' },
  pageName: { fontSize: 14, fontWeight: '600', color: '#334155' },
  pagePct: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  pageBarTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  pageBarFill: { height: '100%', borderRadius: 3 },
  pageMetaRow: { flexDirection: 'row', gap: 12 },
  pageMeta: { fontSize: 11, fontWeight: '500', color: '#94A3B8' },
  emptyPlacement: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  // Perks
  perksCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  perksTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  perkIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  perkText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#334155' },
  // Events
  eventsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  eventsCount: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  newEventBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  newEventBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  emptyEvents: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  eventCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingRight: 36, position: 'relative' },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventStatus: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventDate: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  eventTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventMetaText: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  // Actions
  actionsCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  actionsTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { width: '47%', flexGrow: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#334155', textAlign: 'center' },
});
