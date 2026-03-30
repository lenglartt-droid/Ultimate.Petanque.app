import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';

interface GoldSponsorBannerProps {
  style?: any;
  page?: string;
  userId?: string;
}

/**
 * Exclusive Gold Sponsor Banner – non-rotating, dedicated slot.
 * Only shows ambassadors with badgeType === 'gold_sponsor'.
 * Falls back to first sponsor/partner if no gold sponsor exists.
 */
export default function GoldSponsorBanner({ style, page = 'home', userId }: GoldSponsorBannerProps) {
  const [sponsor, setSponsor] = useState<Ambassador | null>(null);
  const [loaded, setLoaded] = useState(false);
  const impressionTracked = useRef(false);

  useEffect(() => {
    fetchAmbassadors().then(({ ambassadors }) => {
      // Gold sponsors first, then sponsors, then featured partners
      const gold = ambassadors.find(a => a.badgeType === 'gold_sponsor');
      if (gold) { setSponsor(gold); setLoaded(true); return; }
      const sp = ambassadors.find(a => a.badgeType === 'sponsor' && a.isFeatured);
      if (sp) { setSponsor(sp); setLoaded(true); return; }
      const any = ambassadors.find(a => a.badgeType === 'sponsor' || a.badgeType === 'partner');
      if (any) { setSponsor(any); }
      setLoaded(true);
    });
  }, []);

  // Track impression once
  useEffect(() => {
    if (!sponsor || impressionTracked.current) return;
    impressionTracked.current = true;
    trackAmbassadorEvent(sponsor.id, 'banner_impression', undefined, { sourcePage: page, viewerId: userId });
  }, [sponsor, page, userId]);

  const handlePress = useCallback(() => {
    if (!sponsor) return;
    trackAmbassadorEvent(sponsor.id, 'profile_view', undefined, { sourcePage: page, viewerId: userId });
    router.push('/partners');
  }, [sponsor, page, userId]);

  // Dynamic brand color
  const brandColor = sponsor?.brandColor || '#F59E0B';
  const brandColorDark = sponsor?.brandColor ? sponsor.brandColor : '#B45309';

  if (!loaded || !sponsor) return null;

  return (
    <Animated.View entering={FadeIn.duration(500)} style={[styles.container, style]}>
      <Pressable style={({ pressed }) => [styles.banner, pressed && { transform: [{ scale: 0.98 }], opacity: 0.95 }]} onPress={handlePress}>
        <LinearGradient
          colors={[brandColor, brandColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { borderWidth: 1.5, borderColor: brandColor }]}
        >
          {/* Gold border accent */}
          <View style={[styles.goldAccent, { backgroundColor: brandColor }]} />

          <View style={styles.content}>
            {/* Photo */}
            <View style={styles.photoWrap}>
              {sponsor.photo ? (
                <Image source={{ uri: sponsor.photo }} style={styles.photo} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <LinearGradient colors={[brandColorDark, brandColor]} style={styles.photoFallback}>
                  <MaterialIcons name="workspace-premium" size={36} color="#FFF" />
                </LinearGradient>
              )}
              <View style={[styles.goldBadge, { backgroundColor: brandColor, borderColor: brandColor + '12' }]}>
                <MaterialIcons name="star" size={12} color="#FFF" />
              </View>
            </View>

            {/* Info */}
            <View style={styles.info}>
              <View style={styles.labelRow}>
                <LinearGradient colors={[brandColorDark, brandColor]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.goldLabel}>
                  <MaterialIcons name="workspace-premium" size={9} color="#FFF" />
                  <Text style={styles.goldLabelText}>PARTENAIRE OR</Text>
                </LinearGradient>
              </View>
              <Text style={styles.name} numberOfLines={1}>{sponsor.displayName}</Text>
              {sponsor.bio ? <Text style={styles.bio} numberOfLines={1}>{sponsor.bio}</Text> : null}
            </View>

            {/* CTA */}
            <View style={styles.ctaWrap}>
              <LinearGradient colors={[brandColorDark, brandColor]} style={styles.ctaBtn}>
                <MaterialIcons name="open-in-new" size={14} color="#FFF" />
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 0 },
  banner: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#B45309', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  gradient: { borderRadius: 16, position: 'relative' as const },
  goldAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  content: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  photoWrap: { position: 'relative' as const },
  photo: { width: 96, height: 96, borderRadius: 22, overflow: 'hidden' as const },
  photoFallback: { width: 96, height: 96, borderRadius: 22, alignItems: 'center' as const, justifyContent: 'center' as const },
  goldBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  info: { flex: 1 },
  labelRow: { flexDirection: 'row', marginBottom: 4 },
  goldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  goldLabelText: { fontSize: 8, fontWeight: '900', color: '#FFF', letterSpacing: 0.8 },
  name: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  bio: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  ctaWrap: {},
  ctaBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
