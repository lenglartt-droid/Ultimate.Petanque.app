import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';

interface SponsorBannerProps {
  style?: any;
  page?: string;
}

export default function SponsorBanner({ style, page = 'unknown' }: SponsorBannerProps) {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const impressionTracked = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchAmbassadors().then(({ ambassadors: ambs }) => {
      // Only show sponsors and partners, not ambassadors
      const sponsorsAndPartners = ambs.filter(a => a.badgeType === 'sponsor' || a.badgeType === 'partner');
      const featured = sponsorsAndPartners.filter(a => a.isFeatured);
      setAmbassadors(featured.length > 0 ? featured : sponsorsAndPartners.slice(0, 3));
      setLoaded(true);
    });
  }, []);

  // Auto-rotate every 6 seconds
  useEffect(() => {
    if (ambassadors.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % ambassadors.length);
    }, 6000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ambassadors.length]);

  // Track impressions
  useEffect(() => {
    if (ambassadors.length === 0 || currentIndex >= ambassadors.length) return;
    const amb = ambassadors[currentIndex];
    if (!impressionTracked.current.has(amb.id)) {
      impressionTracked.current.add(amb.id);
      trackAmbassadorEvent(amb.id, 'banner_impression', undefined, { sourcePage: page });
    }
  }, [currentIndex, ambassadors]);

  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    if (ambassadors.length > 0 && currentIndex < ambassadors.length) {
      trackAmbassadorEvent(ambassadors[currentIndex].id, 'profile_view', undefined, { sourcePage: page });
    }
    router.push('/partners');
  }, [ambassadors, currentIndex]);

  if (!loaded) return <View style={[styles.container, styles.placeholder, style]} />;
  if (ambassadors.length === 0) return null;

  const amb = ambassadors[currentIndex];

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.container, style]}>
      <Pressable style={styles.banner} onPress={handlePress}>
        <View style={styles.bannerLeft}>
          {amb.photo ? (
            <Image
              source={{ uri: amb.photo }}
              style={styles.photo}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <MaterialIcons name="campaign" size={16} color="#F59E0B" />
            </View>
          )}
          <View style={styles.info}>
            <View style={styles.labelRow}>
              <MaterialIcons name="verified" size={10} color="#F59E0B" />
              <Text style={styles.label}>PARTENAIRE</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>{amb.displayName}</Text>
          </View>
        </View>
        <View style={styles.cta}>
          <MaterialIcons name="chevron-right" size={18} color="#92400E" />
        </View>
      </Pressable>
      {ambassadors.length > 1 ? (
        <View style={styles.dots}>
          {ambassadors.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  placeholder: {
    minHeight: 56,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  photo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden' as const,
  },
  photoPlaceholder: {
    backgroundColor: '#F59E0B15',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  info: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  label: {
    fontSize: 8,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.8,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
  },
  cta: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FDE68A',
  },
  dotActive: {
    backgroundColor: '#F59E0B',
    width: 14,
  },
});
