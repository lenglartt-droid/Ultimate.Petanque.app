import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import theme, { blurhash } from '@/constants/theme';
import { Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';

interface Props {
  ambassadors: Ambassador[];
  language: string;
  t: (ns: string, key: string) => string;
  screenWidth: number;
  userId?: string;
}

function AmbassadorBanner({ ambassadors, language, t, screenWidth, userId }: Props) {
  const [bannerIndex, setBannerIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedImpressions = useRef(new Set<string>());
  const cardWidth = screenWidth - 32;

  // Auto-rotate
  useEffect(() => {
    if (ambassadors.length <= 1) return;
    autoplayRef.current = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % ambassadors.length;
        scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
        return next;
      });
    }, 5000);
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
  }, [ambassadors.length, cardWidth]);

  // Track impressions
  useEffect(() => {
    if (ambassadors.length > 0 && bannerIndex >= 0 && bannerIndex < ambassadors.length) {
      const amb = ambassadors[bannerIndex];
      if (amb && !trackedImpressions.current.has(amb.id)) {
        trackedImpressions.current.add(amb.id);
        trackAmbassadorEvent(amb.id, 'banner_impression', undefined, { sourcePage: 'home', viewerId: userId });
      }
    }
  }, [bannerIndex, ambassadors, userId]);

  const handleScroll = useCallback((e: any) => {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / cardWidth);
    if (idx !== bannerIndex && idx >= 0 && idx < ambassadors.length) {
      setBannerIndex(idx);
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      autoplayRef.current = setInterval(() => {
        setBannerIndex(prev => {
          const next = (prev + 1) % ambassadors.length;
          scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
          return next;
        });
      }, 5000);
    }
  }, [bannerIndex, ambassadors.length, cardWidth]);

  const goToIndex = useCallback((i: number) => {
    setBannerIndex(i);
    scrollRef.current?.scrollTo({ x: i * cardWidth, animated: true });
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    autoplayRef.current = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % ambassadors.length;
        scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
        return next;
      });
    }, 5000);
  }, [ambassadors.length, cardWidth]);

  if (ambassadors.length === 0) return null;

  return (
    <View>
      <View style={s.headerRow}>
        <View style={s.ambassadorIcon}><MaterialIcons name="verified" size={16} color="#7C3AED" /></View>
        <Text style={s.headerTitle}>{language === 'fr' ? 'Ambassadeurs' : 'Ambassadors'}</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={s.seeAllBtn} onPress={() => router.push('/ambassadors' as any)}>
          <Text style={[s.seeAllText, { color: '#7C3AED' }]}>{t('common', 'seeAll')}</Text>
          <MaterialIcons name="chevron-right" size={16} color="#7C3AED" />
        </Pressable>
      </View>

      <View style={s.carousel}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={cardWidth}
          snapToAlignment="start"
        >
          {ambassadors.map((amb) => (
            <Pressable
              key={amb.id}
              style={[s.slide, { width: cardWidth }]}
              onPress={() => amb.playerId ? router.push(`/player/${amb.playerId}` as any) : router.push({ pathname: '/ambassadors', params: { scrollTo: amb.id } } as any)}
            >
              <LinearGradient colors={['#7C3AED', '#9333EA', '#A855F7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gradient}>
                <View style={s.sponsorTag}><MaterialIcons name="campaign" size={10} color="rgba(255,255,255,0.7)" /><Text style={s.sponsorText}>{language === 'fr' ? 'Ambassadeur' : 'Ambassador'}</Text></View>
                <View style={s.bannerContent}>
                  <View style={s.avatarWrap}>
                    {amb.photo ? (
                      <Image source={{ uri: amb.photo }} style={s.avatar} contentFit="cover" transition={300} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                    ) : (
                      <View style={[s.avatar, { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFF' }}>{amb.displayName.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={s.verifiedIcon}><MaterialIcons name="verified" size={14} color="#FFF" /></View>
                  </View>
                  <View style={s.info}>
                    <Text style={s.name} numberOfLines={1}>{amb.displayName}</Text>
                    {amb.bio ? <Text style={s.bio} numberOfLines={2}>{amb.bio}</Text> : amb.role ? <Text style={s.bio} numberOfLines={1}>{t('roles', amb.role)}{amb.club ? ` \u2022 ${amb.club}` : ''}</Text> : null}
                    {amb.stats ? (
                      <View style={s.statsRow}>
                        <View style={s.statItem}><Text style={s.statVal}>{amb.stats.winRate}%</Text><Text style={s.statLbl}>{language === 'fr' ? 'Vict.' : 'Win'}</Text></View>
                        <View style={s.statDivider} />
                        <View style={s.statItem}><Text style={s.statVal}>{amb.stats.matchesPlayed}</Text><Text style={s.statLbl}>{language === 'fr' ? 'Matchs' : 'Matches'}</Text></View>
                        {amb.stats.tirRate > 0 ? (<><View style={s.statDivider} /><View style={s.statItem}><Text style={s.statVal}>{amb.stats.tirRate}%</Text><Text style={s.statLbl}>Tir</Text></View></>) : null}
                      </View>
                    ) : null}
                    <View style={s.socialsRow}>
                      {amb.youtubeUrl ? <View style={s.socialChip}><MaterialIcons name="play-arrow" size={11} color="#FFF" /><Text style={s.socialChipText}>YouTube</Text></View> : null}
                      {amb.instagramHandle ? <View style={s.socialChip}><MaterialIcons name="camera-alt" size={11} color="#FFF" /><Text style={s.socialChipText}>@{amb.instagramHandle.replace('@', '').substring(0, 10)}</Text></View> : null}
                      {amb.tiktokUrl ? <View style={s.socialChip}><MaterialIcons name="music-note" size={11} color="#FFF" /><Text style={s.socialChipText}>TikTok</Text></View> : null}
                    </View>
                  </View>
                </View>
                <View style={s.cta}><Text style={s.ctaText}>{language === 'fr' ? 'Voir le profil' : 'View profile'}</Text><MaterialIcons name="arrow-forward" size={14} color="rgba(255,255,255,0.8)" /></View>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>
        {ambassadors.length > 1 ? (
          <View style={s.dots}>
            {ambassadors.map((_, i) => (
              <Pressable key={i} style={[s.dot, i === bannerIndex && s.dotActive]} onPress={() => goToIndex(i)} hitSlop={8} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(AmbassadorBanner);

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  ambassadorIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#7C3AED12', alignItems: 'center', justifyContent: 'center' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, fontWeight: '600' },
  carousel: { overflow: 'hidden', borderRadius: 20 },
  slide: { borderRadius: 20, overflow: 'hidden' },
  gradient: { borderRadius: 20, padding: 16, position: 'relative' },
  sponsorTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 10 },
  sponsorText: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerContent: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  verifiedIcon: { position: 'absolute', bottom: -3, right: -3, width: 24, height: 24, borderRadius: 12, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#9333EA' },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: '#FFF', marginBottom: 3 },
  bio: { fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 16, marginBottom: 8 },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 8, alignSelf: 'flex-start' },
  statItem: { alignItems: 'center', paddingHorizontal: 8 },
  statVal: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  statLbl: { fontSize: 7, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' },
  statDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.15)' },
  socialsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  socialChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  socialChipText: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  ctaText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED25' },
  dotActive: { width: 24, backgroundColor: '#7C3AED', borderRadius: 4 },
});
