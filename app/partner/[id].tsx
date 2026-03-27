import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Linking, Dimensions,
  ActivityIndicator, Platform, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme, { blurhash } from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { getSupabaseClient } from '@/template';
import { trackAmbassadorEvent, fetchAmbassadorAnalytics, AmbassadorAnalytics } from '@/services/ambassadorAnalyticsService';
import { getMySponsoredEvents, SponsoredEvent } from '@/services/sponsoredEventService';

const SOCIAL_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  youtube: { icon: 'play-arrow', color: '#FF0000', label: 'YouTube' },
  tiktok: { icon: 'music-note', color: '#010101', label: 'TikTok' },
  instagram: { icon: 'camera-alt', color: '#E4405F', label: 'Instagram' },
  twitter: { icon: 'alternate-email', color: '#1DA1F2', label: 'X / Twitter' },
  website: { icon: 'language', color: '#6366F1', label: 'Site web' },
};

export default function PartnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const fr = language === 'fr';
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<any | null>(null);
  const [analytics, setAnalytics] = useState<AmbassadorAnalytics | null>(null);
  const [events, setEvents] = useState<SponsoredEvent[]>([]);

  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width || 375);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);

  const loadPartner = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('ambassadors')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();
      setPartner(data);

      if (data) {
        // Track profile view
        trackAmbassadorEvent(data.id, 'profile_view', undefined, { sourcePage: 'partner_detail' });

        // Load analytics
        const { stats } = await fetchAmbassadorAnalytics('30d');
        const ambStats = stats.get(data.id);
        if (ambStats) setAnalytics(ambStats);

        // Load events
        const { data: evts } = await supabase
          .from('sponsored_events')
          .select('*')
          .eq('ambassador_id', data.id)
          .order('event_date', { ascending: false })
          .limit(5);
        if (evts) {
          setEvents(evts.map((e: any) => ({
            id: e.id,
            ambassadorId: e.ambassador_id,
            creatorUserId: e.creator_user_id,
            title: e.title,
            description: e.description,
            challengeType: e.challenge_type,
            challengeMode: e.challenge_mode,
            eventDate: e.event_date,
            startTime: e.start_time,
            endTime: e.end_time,
            scope: e.scope,
            terrainId: e.terrain_id,
            terrainName: e.terrain_name,
            city: e.city,
            country: e.country,
            maxParticipants: e.max_participants,
            minWitnesses: e.min_witnesses,
            status: e.status,
            shareCode: e.share_code,
            resultsPublished: e.results_published,
          })));
        }
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { loadPartner(); }, [loadPartner]);

  const handleShare = async () => {
    if (!partner) return;
    Haptics.selectionAsync();
    try {
      await Share.share({
        message: `${partner.display_name} - ${fr ? 'Partenaire' : 'Partner'} Ultimate Petanque\nhttps://ultimatepetanque.app/partners?id=${partner.id}`,
      });
    } catch { /* silent */ }
  };

  const handleSocialPress = (platform: string, url: string) => {
    if (!partner) return;
    Haptics.selectionAsync();
    trackAmbassadorEvent(partner.id, 'social_click', platform, { sourcePage: 'partner_detail' });
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.loadingWrap}><ActivityIndicator size="large" color="#D4A017" /></View>
      </SafeAreaView>
    );
  }

  if (!partner) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.headerRow}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={st.headerTitle}>{fr ? 'Partenaire' : 'Partner'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={st.loadingWrap}>
          <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
          <Text style={st.emptyText}>{fr ? 'Partenaire non trouve' : 'Partner not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isGold = partner.badge_type === 'gold_sponsor';
  const tierColor = partner.brand_color || (isGold ? '#D4A017' : partner.badge_type === 'sponsor' ? '#78909C' : '#A1887F');
  const tierLabel = isGold ? (fr ? 'Partenaire Or' : 'Gold Partner') : partner.badge_type === 'sponsor' ? (fr ? 'Partenaire Argent' : 'Silver Partner') : (fr ? 'Partenaire Bronze' : 'Bronze Partner');
  const tierGradient: [string, string] = isGold ? ['#B45309', '#F59E0B'] : partner.badge_type === 'sponsor' ? ['#475569', '#94A3B8'] : ['#78350F', '#D97706'];

  const socialLinks: { platform: string; url: string; label: string }[] = [];
  if (partner.youtube_url) socialLinks.push({ platform: 'youtube', url: partner.youtube_url, label: 'YouTube' });
  if (partner.tiktok_url) socialLinks.push({ platform: 'tiktok', url: partner.tiktok_url, label: 'TikTok' });
  if (partner.instagram_handle) {
    const h = partner.instagram_handle.replace('@', '');
    socialLinks.push({ platform: 'instagram', url: `https://instagram.com/${h}`, label: `@${h}` });
  }
  if (partner.twitter_handle) {
    const h = partner.twitter_handle.replace('@', '');
    socialLinks.push({ platform: 'twitter', url: `https://x.com/${h}`, label: partner.twitter_handle });
  }
  if (partner.website_url) {
    const url = partner.website_url.startsWith('http') ? partner.website_url : `https://${partner.website_url}`;
    socialLinks.push({ platform: 'website', url, label: fr ? 'Site web' : 'Website' });
  }

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      <View style={st.headerRow}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>{fr ? 'Partenaire' : 'Partner'}</Text>
        <Pressable style={st.shareBtn} onPress={handleShare}>
          <MaterialIcons name="share" size={20} color={tierColor} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <LinearGradient colors={tierGradient} style={st.hero}>
            <View style={st.heroDeco1} />
            <View style={st.heroDeco2} />
            <View style={st.heroContent}>
              {partner.photo ? (
                <Image source={{ uri: partner.photo }} style={st.heroAvatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <View style={[st.heroAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <MaterialIcons name={isGold ? 'workspace-premium' : 'handshake'} size={36} color="#FFF" />
                </View>
              )}
              <Text style={st.heroName}>{partner.display_name}</Text>
              <View style={st.heroBadge}>
                <MaterialIcons name={isGold ? 'star' : 'workspace-premium'} size={10} color="#FFF" />
                <Text style={st.heroBadgeText}>{tierLabel.toUpperCase()}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Bio */}
        {partner.bio ? (
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={st.card}>
            <Text style={st.cardTitle}>{fr ? 'A propos' : 'About'}</Text>
            <Text style={st.bioText}>{partner.bio}</Text>
          </Animated.View>
        ) : null}

        {/* Stats */}
        {analytics ? (
          <Animated.View entering={FadeInDown.duration(300).delay(150)} style={st.card}>
            <Text style={st.cardTitle}>{fr ? 'Visibilite (30j)' : 'Visibility (30d)'}</Text>
            <View style={st.statsRow}>
              <View style={st.statItem}>
                <MaterialIcons name="visibility" size={18} color="#3B82F6" />
                <Text style={st.statValue}>{analytics.bannerImpressions}</Text>
                <Text style={st.statLabel}>Impressions</Text>
              </View>
              <View style={st.statItem}>
                <MaterialIcons name="touch-app" size={18} color="#10B981" />
                <Text style={st.statValue}>{analytics.profileViews}</Text>
                <Text style={st.statLabel}>{fr ? 'Clics' : 'Clicks'}</Text>
              </View>
              <View style={st.statItem}>
                <MaterialIcons name="share" size={18} color="#7C3AED" />
                <Text style={st.statValue}>{analytics.socialClicks}</Text>
                <Text style={st.statLabel}>{fr ? 'Reseaux' : 'Social'}</Text>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {/* Social Links */}
        {socialLinks.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(200)} style={st.card}>
            <Text style={st.cardTitle}>{fr ? 'Reseaux sociaux' : 'Social media'}</Text>
            <View style={st.socialGrid}>
              {socialLinks.map(link => {
                const cfg = SOCIAL_CONFIG[link.platform];
                return (
                  <Pressable
                    key={link.platform}
                    style={({ pressed }) => [st.socialBtn, { borderColor: cfg.color + '20' }, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
                    onPress={() => handleSocialPress(link.platform, link.url)}
                  >
                    <View style={[st.socialIcon, { backgroundColor: cfg.color + '12' }]}>
                      <MaterialIcons name={cfg.icon as any} size={20} color={cfg.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.socialLabel}>{cfg.label}</Text>
                      <Text style={st.socialHandle} numberOfLines={1}>{link.label}</Text>
                    </View>
                    <MaterialIcons name="open-in-new" size={16} color={cfg.color} />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {/* Sponsored Events */}
        {events.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(250)} style={st.card}>
            <Text style={st.cardTitle}>{fr ? 'Evenements sponsorises' : 'Sponsored events'}</Text>
            {events.map((ev, i) => {
              const statusColor = ev.status === 'active' ? '#22C55E' : ev.status === 'completed' ? '#3B82F6' : '#F59E0B';
              return (
                <Pressable
                  key={ev.id}
                  style={({ pressed }) => [st.eventItem, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push(`/sponsored-event/${ev.id}` as any)}
                >
                  <View style={[st.eventDot, { backgroundColor: statusColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.eventTitle} numberOfLines={1}>{ev.title}</Text>
                    <Text style={st.eventDate}>
                      {new Date(ev.eventDate).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {ev.city ? ` \u2022 ${ev.city}` : ''}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}

        {/* Referral Code */}
        {partner.referral_code ? (
          <Animated.View entering={FadeInDown.duration(300).delay(300)} style={[st.card, { borderColor: tierColor + '20' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={[st.socialIcon, { backgroundColor: tierColor + '12' }]}>
                <MaterialIcons name="card-giftcard" size={20} color={tierColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.cardTitle}>{fr ? 'Code parrainage' : 'Referral code'}</Text>
              </View>
            </View>
            <View style={[st.codeBlock, { borderColor: tierColor + '30' }]}>
              <Text style={[st.codeText, { color: tierColor }]}>{partner.referral_code}</Text>
            </View>
            <Text style={st.codeHint}>
              {fr ? `${partner.referral_count || 0} parrainage(s)` : `${partner.referral_count || 0} referral(s)`}
            </Text>
          </Animated.View>
        ) : null}

        {/* CTA */}
        {partner.website_url ? (
          <Animated.View entering={FadeInDown.duration(300).delay(350)}>
            <Pressable
              style={({ pressed }) => [st.ctaBtn, { backgroundColor: tierColor }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
              onPress={() => Linking.openURL(partner.website_url.startsWith('http') ? partner.website_url : `https://${partner.website_url}`)}
            >
              <MaterialIcons name="language" size={20} color="#FFF" />
              <Text style={st.ctaBtnText}>{fr ? 'Visiter le site' : 'Visit website'}</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: theme.textMuted },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  shareBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 0, maxWidth: 640, alignSelf: 'center' as const, width: '100%' },
  // Hero
  hero: { paddingTop: 32, paddingBottom: 28, paddingHorizontal: 24, alignItems: 'center' as const, overflow: 'hidden', position: 'relative' as const, marginBottom: 16 },
  heroDeco1: { position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroDeco2: { position: 'absolute', bottom: -15, left: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroContent: { alignItems: 'center' as const, position: 'relative' as const, zIndex: 1 },
  heroAvatar: { width: 80, height: 80, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden', marginBottom: 14 },
  heroName: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 8, textAlign: 'center' },
  heroBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  heroBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  // Cards
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  bioText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 10 },
  statItem: { flex: 1, alignItems: 'center' as const, backgroundColor: '#F8FAFC', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase' as const },
  // Social
  socialGrid: { gap: 8 },
  socialBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1 },
  socialIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  socialLabel: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  socialHandle: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  // Events
  eventItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
  eventDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  // Code
  codeBlock: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, alignItems: 'center' as const, borderWidth: 1.5, borderStyle: 'dashed' as any },
  codeText: { fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  codeHint: { fontSize: 12, color: '#94A3B8', textAlign: 'center' as const, marginTop: 8 },
  // CTA
  ctaBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 10, paddingVertical: 16, borderRadius: 16, marginBottom: 14 },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
