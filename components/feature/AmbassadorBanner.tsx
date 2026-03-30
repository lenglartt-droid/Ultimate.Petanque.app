import React, { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import theme, { blurhash } from '@/constants/theme';
import { Ambassador, AmbassadorLevel } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';

interface Props {
  ambassadors: Ambassador[];
  language: string;
  t: (ns: string, key: string) => string;
  screenWidth: number;
  userId?: string;
}

// ===== ELITE PERMANENT CARD =====
const EliteCard = memo(({ amb, language, t, screenWidth, userId }: { amb: Ambassador; language: string; t: (ns: string, key: string) => string; screenWidth: number; userId?: string }) => {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackAmbassadorEvent(amb.id, 'banner_impression', undefined, { sourcePage: 'home_elite', viewerId: userId });
    }
  }, [amb.id, userId]);

  return (
    <Pressable
      style={s.eliteSlide}
      onPress={() => amb.playerId ? router.push(`/player/${amb.playerId}` as any) : router.push({ pathname: '/ambassadors', params: { scrollTo: amb.id } } as any)}
    >
      <LinearGradient colors={['#1E1B4B', '#312E81', '#4338CA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.eliteGradient}>
        {/* Elite crown accent */}
        <View style={s.eliteAccentBar} />

        <View style={s.eliteTagRow}>
          <View style={s.eliteTag}>
            <MaterialIcons name="military-tech" size={11} color="#F59E0B" />
            <Text style={s.eliteTagText}>{language === 'fr' ? 'AMBASSADEUR ELITE' : 'ELITE AMBASSADOR'}</Text>
          </View>
          <View style={s.elitePinned}>
            <MaterialIcons name="push-pin" size={10} color="rgba(255,255,255,0.5)" />
          </View>
        </View>

        <View style={s.eliteContent}>
          <View style={s.eliteAvatarWrap}>
            {amb.photo ? (
              <Image source={{ uri: amb.photo }} style={s.eliteAvatar} contentFit="cover" transition={300} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
            ) : (
              <View style={[s.eliteAvatar, { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFF' }}>{amb.displayName.charAt(0)}</Text>
              </View>
            )}
            <LinearGradient colors={['#F59E0B', '#D97706']} style={s.eliteVerifiedIcon}>
              <MaterialIcons name="military-tech" size={14} color="#FFF" />
            </LinearGradient>
          </View>
          <View style={s.eliteInfo}>
            <Text style={s.eliteName} numberOfLines={1}>{amb.displayName}</Text>
            {amb.bio ? <Text style={s.eliteBio} numberOfLines={2}>{amb.bio}</Text> : amb.role ? <Text style={s.eliteBio} numberOfLines={1}>{t('roles', amb.role)}{amb.club ? ` \u2022 ${amb.club}` : ''}</Text> : null}
            {amb.stats ? (
              <View style={s.eliteStatsRow}>
                <View style={s.eliteStatItem}><Text style={s.eliteStatVal}>{amb.stats.winRate}%</Text><Text style={s.eliteStatLbl}>{language === 'fr' ? 'Vict.' : 'Win'}</Text></View>
                <View style={s.eliteStatDivider} />
                <View style={s.eliteStatItem}><Text style={s.eliteStatVal}>{amb.stats.matchesPlayed}</Text><Text style={s.eliteStatLbl}>{language === 'fr' ? 'Matchs' : 'Matches'}</Text></View>
                {amb.stats.tirRate > 0 ? (<><View style={s.eliteStatDivider} /><View style={s.eliteStatItem}><Text style={s.eliteStatVal}>{amb.stats.tirRate}%</Text><Text style={s.eliteStatLbl}>Tir</Text></View></>) : null}
              </View>
            ) : null}
            <View style={s.eliteSocialsRow}>
              {amb.youtubeUrl ? <View style={s.eliteSocialChip}><MaterialIcons name="play-arrow" size={11} color="#F59E0B" /><Text style={s.eliteSocialChipText}>YouTube</Text></View> : null}
              {amb.instagramHandle ? <View style={s.eliteSocialChip}><MaterialIcons name="camera-alt" size={11} color="#F59E0B" /><Text style={s.eliteSocialChipText}>@{amb.instagramHandle.replace('@', '').substring(0, 10)}</Text></View> : null}
              {amb.tiktokUrl ? <View style={s.eliteSocialChip}><MaterialIcons name="music-note" size={11} color="#F59E0B" /><Text style={s.eliteSocialChipText}>TikTok</Text></View> : null}
            </View>
          </View>
        </View>
        <View style={s.eliteCta}>
          <Text style={s.eliteCtaText}>{language === 'fr' ? 'Voir le profil' : 'View profile'}</Text>
          <MaterialIcons name="arrow-forward" size={14} color="#F59E0B" />
        </View>
      </LinearGradient>
    </Pressable>
  );
});

// ===== Helper: get card gradient & tag for ambassador or partner =====
function getCardStyle(amb: Ambassador) {
  const isPartner = amb.badgeType === 'gold_sponsor' || amb.badgeType === 'sponsor' || amb.badgeType === 'partner';
  if (isPartner && amb.brandColor) {
    // Use partner's brand color for gradient
    const bc = amb.brandColor;
    return {
      gradient: [bc + 'DD', bc, bc + 'AA'] as [string, string, string],
      tagBg: 'rgba(255,255,255,0.15)',
      tagIcon: 'handshake' as const,
      tagLabel: (lang: string) => {
        if (amb.badgeType === 'gold_sponsor') return lang === 'fr' ? 'PARTENAIRE OR' : 'GOLD PARTNER';
        if (amb.badgeType === 'sponsor') return lang === 'fr' ? 'PARTENAIRE ARGENT' : 'SILVER PARTNER';
        return lang === 'fr' ? 'PARTENAIRE BRONZE' : 'BRONZE PARTNER';
      },
      dotColor: bc,
      verifiedBg: bc,
      verifiedBorder: bc + 'CC',
    };
  }
  if (isPartner) {
    const tierColor = amb.badgeType === 'gold_sponsor' ? '#D4A017' : amb.badgeType === 'sponsor' ? '#78909C' : '#A1887F';
    return {
      gradient: [tierColor + 'DD', tierColor, tierColor + 'AA'] as [string, string, string],
      tagBg: 'rgba(255,255,255,0.15)',
      tagIcon: 'handshake' as const,
      tagLabel: (lang: string) => {
        if (amb.badgeType === 'gold_sponsor') return lang === 'fr' ? 'PARTENAIRE OR' : 'GOLD PARTNER';
        if (amb.badgeType === 'sponsor') return lang === 'fr' ? 'PARTENAIRE ARGENT' : 'SILVER PARTNER';
        return lang === 'fr' ? 'PARTENAIRE BRONZE' : 'BRONZE PARTNER';
      },
      dotColor: tierColor,
      verifiedBg: tierColor,
      verifiedBorder: tierColor + 'CC',
    };
  }
  // Ambassador
  return {
    gradient: ['#7C3AED', '#9333EA', '#A855F7'] as [string, string, string],
    tagBg: 'rgba(255,255,255,0.12)',
    tagIcon: 'campaign' as const,
    tagLabel: (lang: string) => lang === 'fr' ? 'AMBASSADEUR' : 'AMBASSADOR',
    dotColor: '#7C3AED',
    verifiedBg: '#7C3AED',
    verifiedBorder: '#9333EA',
  };
}

// ===== ROTATING CAROUSEL (Confirmé + sponsors/partners) =====
function RotatingCarousel({ ambassadors, language, t, screenWidth, userId }: { ambassadors: Ambassador[]; language: string; t: (ns: string, key: string) => string; screenWidth: number; userId?: string }) {
  const [bannerIndex, setBannerIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedImpressions = useRef(new Set<string>());
  const cardWidth = screenWidth - 32;

  const startAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    if (ambassadors.length <= 1) return;
    autoplayRef.current = setInterval(() => {
      setBannerIndex(prev => {
        const next = (prev + 1) % ambassadors.length;
        scrollRef.current?.scrollTo({ x: next * cardWidth, animated: true });
        return next;
      });
    }, 5000);
  }, [ambassadors.length, cardWidth]);

  useEffect(() => {
    startAutoplay();
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
  }, [startAutoplay]);

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
      startAutoplay();
    }
  }, [bannerIndex, ambassadors.length, cardWidth, startAutoplay]);

  const goToIndex = useCallback((i: number) => {
    setBannerIndex(i);
    scrollRef.current?.scrollTo({ x: i * cardWidth, animated: true });
    startAutoplay();
  }, [cardWidth, startAutoplay]);

  if (ambassadors.length === 0) return null;

  return (
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
        {ambassadors.map((amb) => {
          const cs = getCardStyle(amb);
          return (
          <Pressable
            key={amb.id}
            style={[s.slide, { width: cardWidth }]}
            onPress={() => amb.playerId ? router.push(`/player/${amb.playerId}` as any) : router.push({ pathname: '/ambassadors', params: { scrollTo: amb.id } } as any)}
          >
            <LinearGradient colors={cs.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gradient}>
              <View style={s.sponsorTag}><MaterialIcons name={cs.tagIcon} size={10} color="rgba(255,255,255,0.7)" /><Text style={s.sponsorText}>{cs.tagLabel(language)}</Text></View>
              <View style={s.bannerContent}>
                <View style={s.avatarWrap}>
                  {amb.photo ? (
                    <Image source={{ uri: amb.photo }} style={s.avatar} contentFit="cover" transition={300} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                  ) : (
                    <View style={[s.avatar, { backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFF' }}>{amb.displayName.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={[s.verifiedIcon, { backgroundColor: cs.verifiedBg, borderColor: cs.verifiedBorder }]}><MaterialIcons name="verified" size={14} color="#FFF" /></View>
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
          );
        })}
      </ScrollView>
      {ambassadors.length > 1 ? (
        <View style={s.dots}>
          {ambassadors.map((amb, i) => {
            const dc = getCardStyle(amb).dotColor;
            return (
              <Pressable key={i} style={[s.dot, { backgroundColor: dc + '25' }, i === bannerIndex && { width: 24, backgroundColor: dc, borderRadius: 4 }]} onPress={() => goToIndex(i)} hitSlop={8} />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ===== MAIN COMPONENT =====
function AmbassadorBanner({ ambassadors, language, t, screenWidth, userId }: Props) {
  // Split into Elite (permanent) and Rotating (Confirmé + sponsors/partners)
  const { eliteAmbassadors, rotatingAmbassadors } = useMemo(() => {
    const elite: Ambassador[] = [];
    const rotating: Ambassador[] = [];

    ambassadors.forEach(amb => {
      // Sponsors and partners always go to rotating
      if (amb.badgeType === 'gold_sponsor' || amb.badgeType === 'sponsor' || amb.badgeType === 'partner') {
        rotating.push(amb);
        return;
      }
      // For ambassadors, check level
      const level = amb.ambassadorLevel || 'decouverte';
      if (level === 'elite') {
        elite.push(amb);
      } else if (level === 'confirme') {
        rotating.push(amb);
      }
      // Découverte excluded from both
    });

    return { eliteAmbassadors: elite, rotatingAmbassadors: rotating };
  }, [ambassadors]);

  if (eliteAmbassadors.length === 0 && rotatingAmbassadors.length === 0) return null;

  return (
    <View>
      <View style={s.headerRow}>
        <View style={s.ambassadorIcon}><MaterialIcons name="verified" size={16} color="#7C3AED" /></View>
        <Text style={s.headerTitle} numberOfLines={1} adjustsFontSizeToFit>{language === 'fr' ? 'Ambassadeurs & Partenaires' : 'Ambassadors & Partners'}</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={s.seeAllBtn} onPress={() => router.push('/ambassadors' as any)}>
          <Text style={[s.seeAllText, { color: '#7C3AED' }]}>{t('common', 'seeAll')}</Text>
          <MaterialIcons name="chevron-right" size={16} color="#7C3AED" />
        </Pressable>
      </View>

      {/* Elite permanent cards — always visible, no rotation */}
      {eliteAmbassadors.map(amb => (
        <EliteCard key={amb.id} amb={amb} language={language} t={t} screenWidth={screenWidth} userId={userId} />
      ))}

      {/* Spacing between elite and rotating */}
      {eliteAmbassadors.length > 0 && rotatingAmbassadors.length > 0 ? (
        <View style={{ height: 12 }} />
      ) : null}

      {/* Rotating carousel for Confirmé + sponsors/partners */}
      <RotatingCarousel ambassadors={rotatingAmbassadors} language={language} t={t} screenWidth={screenWidth} userId={userId} />
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

  // ===== ELITE PERMANENT =====
  eliteSlide: { borderRadius: 20, overflow: 'hidden', marginBottom: 0 },
  eliteGradient: { borderRadius: 20, padding: 16, position: 'relative' },
  eliteAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#F59E0B' },
  eliteTagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  eliteTag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F59E0B20', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#F59E0B40' },
  eliteTagText: { fontSize: 9, fontWeight: '800', color: '#F59E0B', letterSpacing: 1 },
  elitePinned: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  eliteContent: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  eliteAvatarWrap: { position: 'relative' },
  eliteAvatar: { width: 68, height: 68, borderRadius: 22, overflow: 'hidden', borderWidth: 2.5, borderColor: '#F59E0B60' },
  eliteVerifiedIcon: { position: 'absolute', bottom: -3, right: -3, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#312E81' },
  eliteInfo: { flex: 1, justifyContent: 'center' },
  eliteName: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 3 },
  eliteBio: { fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 16, marginBottom: 8 },
  eliteStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  eliteStatItem: { alignItems: 'center', paddingHorizontal: 8 },
  eliteStatVal: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  eliteStatLbl: { fontSize: 7, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' },
  eliteStatDivider: { width: 1, height: 16, backgroundColor: 'rgba(245,158,11,0.25)' },
  eliteSocialsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  eliteSocialChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  eliteSocialChipText: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  eliteCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  eliteCtaText: { fontSize: 11, fontWeight: '600', color: '#F59E0B' },

  // ===== ROTATING CAROUSEL =====
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
  dotActive: { width: 24, borderRadius: 4 },
});
