import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  FlatList,
  Modal,
  Switch,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking } from 'react-native';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useAppData, useAppActions } from '@/contexts/AppContext';
import { useAuth } from '@/template';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { getEloRank, ELO_RANKS, EloRankTier } from '@/services/eloService';
import { getTrustScoreColor, getTrustScoreIcon, getTrustLevelLabel, TrustScoreData } from '@/services/trustScoreService';
import {
  fetchPublicPlayers, fetchPublicClubs, fetchPublicTerrains, fetchPublicTournaments,
  toggleItemPublic, importPublicItemToDirectory, getMyPublicableItems,
} from '@/services/publicItemsService';
import { getSponsoredEvents, SponsoredEvent } from '@/services/sponsoredEventService';
import { getMyActiveMeetups, inviteSingleUserToMeetup, Meetup as MeetupType } from '@/services/meetupService';
import AdBanner from '@/components/ui/AdBanner';
import SponsorBanner from '@/components/ui/SponsorBanner';
import { useToast } from '@/components/ui/Toast';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';
import { Image } from 'expo-image';
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';

type MarkerType = 'all' | 'terrains' | 'clubs' | 'tournaments' | 'players' | 'events' | 'partners';
type MapMode = 'all' | 'public';

let MapViewComponent: React.ComponentType<any> | null = null;
let MarkerComponent: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapViewComponent = Maps.default;
  MarkerComponent = Maps.Marker;
}

// ============================================
// CLUSTERING LOGIC
// ============================================
interface ClusterItem {
  id: string;
  latitude: number;
  longitude: number;
  itemType: string;
  _isPublic: boolean;
  [key: string]: any;
}

interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  items: ClusterItem[];
  isCluster: boolean;
}

const MAX_VISIBLE_MARKERS = 200;
const ELO_RANKS_REVERSED = [...ELO_RANKS].reverse();

function clusterMarkers(items: ClusterItem[], region: { latitudeDelta: number; longitudeDelta: number; latitude?: number; longitude?: number } | null): Cluster[] {
  // Filter items with valid locations first
  const validItems = items.filter(item => {
    const lat = item.location?.latitude;
    const lng = item.location?.longitude;
    return (lat !== undefined && lat !== null && lat !== 0) || (lng !== undefined && lng !== null && lng !== 0);
  });

  if (!region || validItems.length === 0) return validItems.slice(0, MAX_VISIBLE_MARKERS).map(item => ({
    id: `single-${item.itemType}-${item.id}`,
    latitude: item.location?.latitude || 0,
    longitude: item.location?.longitude || 0,
    items: [item],
    isCluster: false,
  }));

  // Viewport filtering: only process items within the visible region (with padding)
  const latPad = region.latitudeDelta * 0.3;
  const lngPad = region.longitudeDelta * 0.3;
  const regionLat = region.latitude ?? 46.6;
  const regionLng = region.longitude ?? 2.3;
  const minLat = regionLat - region.latitudeDelta / 2 - latPad;
  const maxLat = regionLat + region.latitudeDelta / 2 + latPad;
  const minLng = regionLng - region.longitudeDelta / 2 - lngPad;
  const maxLng = regionLng + region.longitudeDelta / 2 + lngPad;

  const viewportItems = validItems.filter(item => {
    const lat = item.location?.latitude || 0;
    const lng = item.location?.longitude || 0;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });

  // Cap at MAX_VISIBLE_MARKERS to prevent memory issues
  const cappedItems = viewportItems.length > MAX_VISIBLE_MARKERS ? viewportItems.slice(0, MAX_VISIBLE_MARKERS) : viewportItems;

  // Grid cell size based on zoom level
  const cellLat = region.latitudeDelta * 0.08;
  const cellLng = region.longitudeDelta * 0.08;

  // If zoomed in enough, don't cluster
  if (region.latitudeDelta < 0.05) {
    return cappedItems.map(item => ({
      id: `single-${item.itemType}-${item.id}`,
      latitude: item.location?.latitude || 0,
      longitude: item.location?.longitude || 0,
      items: [item],
      isCluster: false,
    }));
  }

  const grid: Record<string, ClusterItem[]> = {};

  cappedItems.forEach(item => {
    const lat = item.location?.latitude;
    const lng = item.location?.longitude;
    if (lat === undefined || lat === null || lng === undefined || lng === null) return;
    if (lat === 0 && lng === 0) return;
    const cellKey = `${Math.floor(lat / cellLat)}_${Math.floor(lng / cellLng)}`;
    if (!grid[cellKey]) grid[cellKey] = [];
    grid[cellKey].push(item);
  });

  const clusters: Cluster[] = [];

  Object.entries(grid).forEach(([key, cellItems]) => {
    if (cellItems.length === 1) {
      const item = cellItems[0];
      clusters.push({
        id: `single-${item.itemType}-${item.id}`,
        latitude: item.location?.latitude || 0,
        longitude: item.location?.longitude || 0,
        items: [item],
        isCluster: false,
      });
    } else {
      // Calculate centroid
      let sumLat = 0, sumLng = 0;
      cellItems.forEach(item => {
        sumLat += item.location?.latitude || 0;
        sumLng += item.location?.longitude || 0;
      });
      clusters.push({
        id: `cluster-${key}`,
        latitude: sumLat / cellItems.length,
        longitude: sumLng / cellItems.length,
        items: cellItems,
        isCluster: true,
      });
    }
  });

  return clusters;
}

// ============================================
// PARTNER MARKER COMPONENT (Gold/Silver)
// ============================================
const TIER_COLORS: Record<string, { primary: string; bg: string; border: string }> = {
  gold_sponsor: { primary: '#D4A017', bg: '#FFFBEB', border: '#F59E0B' },
  sponsor: { primary: '#78909C', bg: '#ECEFF1', border: '#90A4AE' },
};

interface PartnerMarkerData extends Ambassador {
  _tier: string;
}

const PartnerMarkerView = React.memo(({ partner }: { partner: PartnerMarkerData }) => {
  const customColor = partner.brandColor;
  const tier = customColor
    ? { primary: customColor, bg: customColor + '15', border: customColor }
    : (TIER_COLORS[partner._tier] || TIER_COLORS.sponsor);
  const isGold = partner._tier === 'gold_sponsor';
  const size = isGold ? 44 : 38;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={[
        pMarkerStyles.container,
        { width: size, height: size, borderRadius: size / 2, borderColor: tier.border, backgroundColor: tier.bg },
        isGold && pMarkerStyles.containerGold,
      ]}>
        {partner.photo ? (
          <Image
            source={{ uri: partner.photo }}
            style={{ width: size - 6, height: size - 6, borderRadius: (size - 6) / 2 }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <MaterialIcons name={isGold ? 'workspace-premium' : 'handshake'} size={isGold ? 20 : 16} color={tier.primary} />
        )}
      </View>
      <View style={[pMarkerStyles.badge, { backgroundColor: tier.primary }]}>
        <MaterialIcons name={isGold ? 'star' : 'workspace-premium'} size={7} color="#FFF" />
      </View>
    </View>
  );
});

const pMarkerStyles = StyleSheet.create({
  container: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2.5,
    overflow: 'hidden' as const,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  containerGold: {
    borderWidth: 3,
    ...Platform.select({
      ios: { shadowColor: '#B45309', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 6 },
      default: {},
    }),
  },
  badge: {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#FFF',
  },
});

// ============================================
// CLUSTER MARKER COMPONENT
// ============================================
// Animated pulse ring for active-now markers
const ActiveNowPulse = React.memo(() => {
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);

  React.useEffect(() => {
    pulse1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
    // Staggered second ring
    const timer = setTimeout(() => {
      pulse2.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
    }, 750);
    return () => clearTimeout(timer);
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse1.value * 0.8 }],
    opacity: 1 - pulse1.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse2.value * 0.8 }],
    opacity: 1 - pulse2.value,
  }));

  return (
    <>
      <Animated.View style={[styles.activeNowPulseRing, ring1Style]} />
      <Animated.View style={[styles.activeNowPulseRing, ring2Style]} />
    </>
  );
});

const SingleMarkerView = React.memo(({ color, icon, isPublic, accessIndicator, fallbackSource, isVerified, isActiveNow }: { color: string; icon: string; isPublic: boolean; accessIndicator?: 'public' | 'private' | null; fallbackSource?: 'terrain' | 'club' | null; isVerified?: boolean; isActiveNow?: boolean }) => (
  <View style={styles.markerWrapper}>
    {isActiveNow ? <ActiveNowPulse /> : null}
    <View style={[styles.marker, { backgroundColor: color }, isPublic && styles.markerPublic, fallbackSource && styles.markerFallback, isActiveNow && { borderColor: '#22C55E', borderWidth: 3, width: 36, height: 36, borderRadius: 18 }]}>
      <MaterialIcons name={icon as any} size={isActiveNow ? 16 : 14} color="#FFF" />
    </View>
    {isVerified ? (
      <View style={styles.verifiedBadge}>
        <MaterialIcons name="verified" size={9} color="#FFF" />
      </View>
    ) : fallbackSource ? (
      <View style={[styles.fallbackBadge, { backgroundColor: fallbackSource === 'terrain' ? theme.success : theme.accent }]}>
        <MaterialIcons name={fallbackSource === 'terrain' ? 'sports-soccer' : 'home'} size={7} color="#FFF" />
      </View>
    ) : accessIndicator ? (
      <View style={[styles.accessBadge, accessIndicator === 'public' ? styles.accessBadgePublic : styles.accessBadgePrivate]}>
        <MaterialIcons name={accessIndicator === 'public' ? 'lock-open' : 'lock'} size={7} color="#FFF" />
      </View>
    ) : null}
  </View>
));

const CLUSTER_COLOR_MAP: Record<string, string> = {
  terrains: theme.success,
  clubs: theme.accent,
  tournaments: theme.carreauColor,
  players: theme.primary,
};
const CLUSTER_ICON_MAP: Record<string, string> = {
  terrains: 'sports-soccer',
  clubs: 'home',
  tournaments: 'emoji-events',
  players: 'person',
};

const ClusterMarkerView = React.memo(({ count, typeCounts }: { count: number; typeCounts: Record<string, number> }) => {
  const sorted = Object.entries(typeCounts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  const dominantType = sorted[0]?.[0] || 'players';
  const dominantColor = CLUSTER_COLOR_MAP[dominantType] || theme.primary;
  const secondaryType = sorted[1]?.[0];
  const secondaryColor = secondaryType ? (CLUSTER_COLOR_MAP[secondaryType] || theme.textMuted) : dominantColor;

  const size = count <= 5 ? 48 : count <= 15 ? 56 : 64;
  const fontSize = count <= 5 ? 15 : count <= 15 ? 17 : 19;
  const outerSize = size + 14;
  const showCategoryPills = sorted.length > 1;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer glow ring */}
      <View style={[styles.clusterOuter, { width: outerSize, height: outerSize, borderRadius: outerSize / 2, backgroundColor: dominantColor + '18', borderColor: dominantColor + '30' }]} />
      {/* Gradient core */}
      <LinearGradient
        colors={[dominantColor, secondaryColor, dominantColor + 'DD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.clusterInner, { width: size, height: size, borderRadius: size / 2, position: 'absolute' }]}
      >
        <Text style={[styles.clusterCount, { fontSize }]}>{count}</Text>
        {/* Category mini-pills inside circle */}
        {showCategoryPills ? (
          <View style={styles.clusterPillRow}>
            {sorted.slice(0, 3).map(([type, cnt]) => (
              <View key={type} style={styles.clusterPill}>
                <MaterialIcons name={(CLUSTER_ICON_MAP[type] || 'place') as any} size={7} color="#FFF" />
                <Text style={styles.clusterPillText}>{cnt}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </LinearGradient>
      {/* Bottom type dots */}
      {sorted.length > 1 ? (
        <View style={[styles.clusterDots, { bottom: -4 }]}>
          {sorted.map(([type]) => (
            <View key={type} style={[styles.clusterDot, { backgroundColor: CLUSTER_COLOR_MAP[type] || theme.textMuted }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
});

// ============================================
// MEMOIZED FILTER CHIP
// ============================================
const FilterChip = React.memo(({ label, icon, isActive, activeColor, onPress }: { label: string; icon: string; isActive: boolean; activeColor?: string; onPress: () => void }) => (
  <Pressable style={[styles.chip, isActive && (activeColor ? { backgroundColor: activeColor } : styles.chipActive)]} onPress={onPress}>
    <MaterialIcons name={icon as any} size={14} color={isActive ? '#FFF' : theme.textSecondary} />
    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{label}</Text>
  </Pressable>
));

// ============================================
// MEMOIZED SUB-FILTER CHIP
// ============================================
const SubFilterChip = React.memo(({ label, icon, isActive, color, onPress }: { label: string; icon?: string; isActive: boolean; color: string; onPress: () => void }) => (
  <Pressable
    style={[styles.subChip, isActive && { backgroundColor: color, borderColor: color }]}
    onPress={onPress}
  >
    {icon ? <MaterialIcons name={icon as any} size={11} color={isActive ? '#FFF' : color} /> : null}
    <Text style={[styles.subChipText, isActive ? { color: '#FFF' } : { color }]}>{label}</Text>
  </Pressable>
));

// ============================================
// MEMOIZED SUB-FILTER SECTIONS
// ============================================
interface TerrainSubFiltersProps {
  terrainTypeFilter: string | null;
  terrainEnvFilter: 'indoor' | 'outdoor' | null;
  terrainLightingFilter: boolean | null;
  terrainCoveredFilter: boolean | null;
  terrainParkingFilter: boolean | null;
  terrainPublicAccessFilter: boolean | null;
  terrainMembersOnlyFilter: boolean | null;
  terrainMultiCourtsFilter: boolean | null;
  onTerrainTypePress: (id: string) => void;
  onTerrainEnvPress: (id: 'indoor' | 'outdoor') => void;
  onTerrainCharPress: (key: 'lighting' | 'covered' | 'parking' | 'public_access' | 'members_only' | 'multi_courts') => void;
  onClear: () => void;
  count: number;
  language: string;
}
const TerrainSubFilters = React.memo(({ terrainTypeFilter, terrainEnvFilter, terrainLightingFilter, terrainCoveredFilter, terrainParkingFilter, terrainPublicAccessFilter, terrainMembersOnlyFilter, terrainMultiCourtsFilter, onTerrainTypePress, onTerrainEnvPress, onTerrainCharPress, onClear, count, language }: TerrainSubFiltersProps) => (
  <View style={styles.subFiltersContainer}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
      <View style={styles.subFilterLabel}>
        <MaterialIcons name="landscape" size={12} color={theme.textMuted} />
        <Text style={styles.subFilterLabelText}>Surface</Text>
      </View>
      {config.terrainTypes.map(tt => (
        <SubFilterChip key={tt.id} label={tt.label} icon={tt.icon} isActive={terrainTypeFilter === tt.id} color={theme.success} onPress={() => onTerrainTypePress(tt.id)} />
      ))}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
      <View style={styles.subFilterLabel}>
        <MaterialIcons name="wb-sunny" size={12} color={theme.textMuted} />
        <Text style={styles.subFilterLabelText}>{language === 'fr' ? 'Environnement' : 'Environment'}</Text>
      </View>
      {config.terrainEnvironments.map(env => {
        const envColor = env.id === 'indoor' ? '#3B82F6' : '#F59E0B';
        return <SubFilterChip key={env.id} label={env.label} icon={env.icon} isActive={terrainEnvFilter === env.id} color={envColor} onPress={() => onTerrainEnvPress(env.id as 'indoor' | 'outdoor')} />;
      })}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
      <View style={styles.subFilterLabel}>
        <MaterialIcons name="tune" size={12} color={theme.textMuted} />
        <Text style={styles.subFilterLabelText}>{language === 'fr' ? 'Caracteristiques' : 'Features'}</Text>
      </View>
      <SubFilterChip label={language === 'fr' ? 'Eclairage' : 'Lighting'} icon="lightbulb" isActive={terrainLightingFilter === true} color="#EAB308" onPress={() => onTerrainCharPress('lighting')} />
      <SubFilterChip label={language === 'fr' ? 'Couvert' : 'Covered'} icon="roofing" isActive={terrainCoveredFilter === true} color="#6366F1" onPress={() => onTerrainCharPress('covered')} />
      <SubFilterChip label="Parking" icon="local-parking" isActive={terrainParkingFilter === true} color="#0EA5E9" onPress={() => onTerrainCharPress('parking')} />
      <SubFilterChip label={language === 'fr' ? 'Acces public' : 'Public access'} icon="lock-open" isActive={terrainPublicAccessFilter === true} color="#22C55E" onPress={() => onTerrainCharPress('public_access')} />
      <SubFilterChip label={language === 'fr' ? 'Reserve membres' : 'Members only'} icon="lock" isActive={terrainMembersOnlyFilter === true} color="#EF4444" onPress={() => onTerrainCharPress('members_only')} />
      <SubFilterChip label={language === 'fr' ? '2+ terrains' : '2+ courts'} icon="grid-view" isActive={terrainMultiCourtsFilter === true} color="#8B5CF6" onPress={() => onTerrainCharPress('multi_courts')} />
    </ScrollView>
    {(terrainTypeFilter || terrainEnvFilter || terrainLightingFilter || terrainCoveredFilter || terrainParkingFilter || terrainPublicAccessFilter || terrainMembersOnlyFilter || terrainMultiCourtsFilter) ? (
      <View style={styles.subFilterActiveBar}>
        <Text style={styles.subFilterActiveText}>{count} {language === 'fr' ? 'terrain(s) filtre(s)' : 'terrain(s) filtered'}</Text>
        <Pressable style={styles.subFilterClearBtn} onPress={onClear}>
          <MaterialIcons name="close" size={12} color={theme.primary} />
          <Text style={styles.subFilterClearText}>{language === 'fr' ? 'Effacer' : 'Clear'}</Text>
        </Pressable>
      </View>
    ) : null}
  </View>
));

interface TournamentSubFiltersProps {
  tournamentFormatFilter: string | null;
  tournamentStatusFilter: string | null;
  onFormatPress: (fmt: string) => void;
  onStatusPress: (key: string) => void;
  onClear: () => void;
  count: number;
  language: string;
}
const TournamentSubFilters = React.memo(({ tournamentFormatFilter, tournamentStatusFilter, onFormatPress, onStatusPress, onClear, count, language }: TournamentSubFiltersProps) => (
  <View style={styles.subFiltersContainer}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
      <View style={styles.subFilterLabel}>
        <MaterialIcons name="sports" size={12} color={theme.textMuted} />
        <Text style={styles.subFilterLabelText}>Format</Text>
      </View>
      {(['Doublette', 'Triplette', 'Tete-a-tete'] as const).map(fmt => (
        <SubFilterChip key={fmt} label={fmt} isActive={tournamentFormatFilter === fmt} color={theme.carreauColor} onPress={() => onFormatPress(fmt)} />
      ))}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
      <View style={styles.subFilterLabel}>
        <MaterialIcons name="event" size={12} color={theme.textMuted} />
        <Text style={styles.subFilterLabelText}>{language === 'fr' ? 'Statut' : 'Status'}</Text>
      </View>
      {([{ key: 'À venir', label: language === 'fr' ? 'A venir' : 'Upcoming', icon: 'event', color: theme.primary }, { key: 'En cours', label: language === 'fr' ? 'En cours' : 'In progress', icon: 'play-circle-filled', color: theme.warning }] as const).map(st => (
        <SubFilterChip key={st.key} label={st.label} icon={st.icon} isActive={tournamentStatusFilter === st.key} color={st.color} onPress={() => onStatusPress(st.key)} />
      ))}
    </ScrollView>
    {(tournamentFormatFilter || tournamentStatusFilter) ? (
      <View style={styles.subFilterActiveBar}>
        <Text style={styles.subFilterActiveText}>{count} {language === 'fr' ? 'tournoi(s) filtre(s)' : 'tournament(s) filtered'}</Text>
        <Pressable style={styles.subFilterClearBtn} onPress={onClear}>
          <MaterialIcons name="close" size={12} color={theme.primary} />
          <Text style={styles.subFilterClearText}>{language === 'fr' ? 'Effacer' : 'Clear'}</Text>
        </Pressable>
      </View>
    ) : null}
  </View>
));

interface PlayerSubFiltersProps {
  eloRankFilter: EloRankTier | null;
  eloRangeFilter: 'placement' | null;
  trustFilter: 'verified' | 'high' | 'medium_low' | null;
  roleFilter: string | null;
  onEloRankPress: (tier: EloRankTier) => void;
  onEloRangePress: (key: 'placement') => void;
  onTrustPress: (key: 'verified' | 'high' | 'medium_low') => void;
  onRolePress: (role: string) => void;
  onClear: () => void;
  count: number;
  language: string;
}
const PlayerSubFilters = React.memo(({ eloRankFilter, eloRangeFilter, trustFilter, roleFilter, onEloRankPress, onEloRangePress, onTrustPress, onRolePress, onClear, count, language }: PlayerSubFiltersProps) => (
  <View style={styles.subFiltersContainer}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
      <View style={styles.subFilterLabel}>
        <MaterialIcons name="emoji-events" size={12} color={theme.textMuted} />
        <Text style={styles.subFilterLabelText}>ELO</Text>
      </View>
      {ELO_RANKS_REVERSED.map(rank => (
        <SubFilterChip key={rank.tier} label={language === 'fr' ? rank.label.fr : rank.label.en} icon={rank.icon} isActive={eloRankFilter === rank.tier} color={rank.color} onPress={() => onEloRankPress(rank.tier)} />
      ))}
      <SubFilterChip label={language === 'fr' ? 'Placement' : 'Placement'} icon="hourglass-empty" isActive={eloRangeFilter === 'placement'} color="#A855F7" onPress={() => onEloRangePress('placement')} />
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
      <View style={styles.subFilterLabel}>
        <MaterialIcons name="sports" size={12} color={theme.textMuted} />
        <Text style={styles.subFilterLabelText}>{language === 'fr' ? 'Role' : 'Role'}</Text>
      </View>
      {(['Tireur', 'Pointeur', 'Milieu'] as const).map(role => {
        const roleColor = role === 'Tireur' ? '#F97316' : role === 'Pointeur' ? '#3B82F6' : '#8B5CF6';
        const roleIcon = role === 'Tireur' ? 'gps-fixed' : role === 'Pointeur' ? 'radio-button-on' : 'swap-horiz';
        return <SubFilterChip key={role} label={role} icon={roleIcon} isActive={roleFilter === role} color={roleColor} onPress={() => onRolePress(role)} />;
      })}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
      <View style={styles.subFilterLabel}>
        <MaterialIcons name="verified-user" size={12} color={theme.textMuted} />
        <Text style={styles.subFilterLabelText}>{language === 'fr' ? 'Confiance' : 'Trust'}</Text>
      </View>
      {([{ key: 'verified' as const, label: language === 'fr' ? 'Verifie' : 'Verified', icon: 'verified-user', color: '#22C55E' }, { key: 'high' as const, label: language === 'fr' ? 'Fiable' : 'Trusted', icon: 'shield', color: '#3B82F6' }, { key: 'medium_low' as const, label: language === 'fr' ? '< Fiable' : '< Trusted', icon: 'warning', color: '#F97316' }]).map(opt => (
        <SubFilterChip key={opt.key} label={opt.label} icon={opt.icon} isActive={trustFilter === opt.key} color={opt.color} onPress={() => onTrustPress(opt.key)} />
      ))}
    </ScrollView>
    {(eloRankFilter || eloRangeFilter || trustFilter || roleFilter) ? (
      <View style={styles.subFilterActiveBar}>
        <Text style={styles.subFilterActiveText}>{count} {language === 'fr' ? 'joueur(s) filtre(s)' : 'player(s) filtered'}</Text>
        <Pressable style={styles.subFilterClearBtn} onPress={onClear}>
          <MaterialIcons name="close" size={12} color={theme.primary} />
          <Text style={styles.subFilterClearText}>{language === 'fr' ? 'Effacer' : 'Clear'}</Text>
        </Pressable>
      </View>
    ) : null}
  </View>
));

// ============================================
// LIST ITEM COMPONENT
// ============================================
const ListItem = React.memo(({ item, onPress, singularLabel, terrainTypeLabel, isPublicItem, onImport, t }: any) => {
  const MARKER_COLORS: Record<string, string> = { terrains: theme.success, clubs: theme.accent, tournaments: theme.carreauColor, players: theme.primary };
  const MARKER_ICONS: Record<string, string> = { terrains: 'sports-soccer', clubs: 'home', tournaments: 'emoji-events', players: 'person' };
  const color = MARKER_COLORS[item.itemType] || theme.primary;
  const icon = MARKER_ICONS[item.itemType] || 'place';
  const terrainConfig = item.itemType === 'terrains' ? config.terrainTypes.find(tc => tc.id === item.type) : null;

  return (
    <Pressable style={styles.listItem} onPress={onPress}>
      <View style={[styles.listIcon, { backgroundColor: color }]}>
        <MaterialIcons name={(terrainConfig?.icon || icon) as any} size={18} color="#FFF" />
      </View>
      <View style={styles.listContent}>
        <View style={styles.listNameRow}>
          <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
          {isPublicItem && item.itemType === 'players' && item.isPremium ? (
            <View style={styles.premiumBadgeListMap}>
              <MaterialIcons name="star" size={7} color="#A8B4C0" />
            </View>
          ) : null}
          {isPublicItem ? (
            <View style={styles.publicBadgeSmall}>
              <MaterialIcons name="public" size={10} color={theme.success} />
            </View>
          ) : null}
        </View>
        <Text style={styles.listMeta} numberOfLines={1}>
          {item.itemType === 'terrains' ? `${item.city} \u2022 ${terrainTypeLabel || item.type}` :
           item.itemType === 'clubs' ? item.city :
           item.itemType === 'players' ? (item.location?.city || item.club || '-') :
           item.location?.city}
        </Text>
      </View>
      {isPublicItem && onImport ? (
        <Pressable style={styles.importBtnSmall} onPress={(e) => { e.stopPropagation?.(); onImport(); }} hitSlop={6}>
          <MaterialIcons name="add-circle" size={22} color={theme.primary} />
        </Pressable>
      ) : (
        <View style={[styles.listBadge, { backgroundColor: color + '15' }]}>
          <Text style={[styles.listBadgeText, { color }]}>{singularLabel}</Text>
        </View>
      )}
    </Pressable>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { clubs, tournaments, terrains, players } = useAppData();
   const { refreshData, updatePlayer, updateClub, updateTerrain, updateTournament, setItemPublic } = useAppActions();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const { lat: paramLat, lng: paramLng, name: paramName, filter: paramFilter, activeNow: paramActiveNow } = useLocalSearchParams<{ lat?: string; lng?: string; name?: string; filter?: string; activeNow?: string }>();
  const [filter, setFilter] = useState<MarkerType>('all');
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<{ label: string; type: string; count?: number; lat?: number; lng?: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('all');
  const [showManageModal, setShowManageModal] = useState(false);
  const [currentRegion, setCurrentRegion] = useState(config.map.defaultRegion);

  const mapRef = useRef<any>(null);
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Public items state
  const [publicPlayers, setPublicPlayers] = useState<any[]>([]);
  const [publicClubs, setPublicClubs] = useState<any[]>([]);
  const [publicTerrains, setPublicTerrains] = useState<any[]>([]);
  const [publicTournaments, setPublicTournaments] = useState<any[]>([]);
  const [myItems, setMyItems] = useState<any>({ players: [], clubs: [], terrains: [], tournaments: [] });
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [loadingManage, setLoadingManage] = useState(false);


  // Player sub-filters (ELO rank & trust score)
  const [eloRankFilter, setEloRankFilter] = useState<EloRankTier | null>(null);
  const [trustFilter, setTrustFilter] = useState<'verified' | 'high' | 'medium_low' | null>(null);

  // Terrain sub-filters (type & environment & characteristics)
  const [terrainTypeFilter, setTerrainTypeFilter] = useState<string | null>(null);
  const [terrainEnvFilter, setTerrainEnvFilter] = useState<'indoor' | 'outdoor' | null>(null);
  const [terrainLightingFilter, setTerrainLightingFilter] = useState<boolean | null>(null);
  const [terrainCoveredFilter, setTerrainCoveredFilter] = useState<boolean | null>(null);
  const [terrainParkingFilter, setTerrainParkingFilter] = useState<boolean | null>(null);
  const [terrainPublicAccessFilter, setTerrainPublicAccessFilter] = useState<boolean | null>(null);
  const [terrainMembersOnlyFilter, setTerrainMembersOnlyFilter] = useState<boolean | null>(null);
  const [terrainMultiCourtsFilter, setTerrainMultiCourtsFilter] = useState<boolean | null>(null);

  // Club sub-filters (facilities)
  const [clubFacilityFilter, setClubFacilityFilter] = useState<string | null>(null);

  // Player extra sub-filters
  const [playerRoleFilter, setPlayerRoleFilter] = useState<string | null>(null);
  const [eloRangeFilter, setEloRangeFilter] = useState<'placement' | null>(null);

  // Tournament sub-filters (format & status)
  const [tournamentFormatFilter, setTournamentFormatFilter] = useState<string | null>(null);
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState<string | null>(null);

  // Meetup invitation state
  const [showMeetupPicker, setShowMeetupPicker] = useState(false);
  const [meetupPickerUserId, setMeetupPickerUserId] = useState<string | null>(null);
  const [meetupPickerUserName, setMeetupPickerUserName] = useState('');
  const [activeMeetups, setActiveMeetups] = useState<MeetupType[]>([]);
  const [loadingMeetups, setLoadingMeetups] = useState(false);
  const [invitingToMeetup, setInvitingToMeetup] = useState<string | null>(null);

  const handleInviteToMeetupMap = useCallback(async (targetUserId: string, targetName: string) => {
    if (!targetUserId || targetUserId === user?.id) return;
    Haptics.selectionAsync();
    setMeetupPickerUserId(targetUserId);
    setMeetupPickerUserName(targetName);
    setLoadingMeetups(true);
    setShowMeetupPicker(true);
    const { meetups: mts } = await getMyActiveMeetups();
    setActiveMeetups(mts);
    setLoadingMeetups(false);
  }, [user?.id]);

  const handleConfirmInviteMap = useCallback(async (meetupId: string) => {
    if (!meetupPickerUserId) return;
    setInvitingToMeetup(meetupId);
    const { error } = await inviteSingleUserToMeetup(meetupId, meetupPickerUserId);
    setInvitingToMeetup(null);
    if (error === 'already_participant') {
      showAlert(t('meetup', 'alreadyParticipant'));
    } else if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ message: t('meetup', 'inviteSentSuccess'), icon: 'check-circle', iconColor: theme.success });
      setShowMeetupPicker(false);
      setSelected(null);
    }
  }, [meetupPickerUserId, showAlert, showToast, t]);

  // Sponsored events state
  const [sponsoredEvents, setSponsoredEvents] = useState<SponsoredEvent[]>([]);
  const [sponsoredEventsLoaded, setSponsoredEventsLoaded] = useState(false);

  // Partner markers state (Gold/Silver ambassadors linked to terrains/clubs)
  const [partnerMarkers, setPartnerMarkers] = useState<(Ambassador & { _tier: string; _itemType: string; _itemId: string; location: any })[]>([]);
  const [partnerMarkersLoaded, setPartnerMarkersLoaded] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<(typeof partnerMarkers)[0] | null>(null);

  // Compute top 3 most frequent cities from user data for quick search chips
  const topCities = useMemo(() => {
    const cityMap = new Map<string, { count: number; lat?: number; lng?: number }>();
    const addCity = (item: any) => {
      const city = item.city || item.location?.city;
      if (!city || typeof city !== 'string') return;
      const existing = cityMap.get(city) || { count: 0 };
      existing.count++;
      if (!existing.lat && item.location?.latitude) {
        existing.lat = item.location.latitude;
        existing.lng = item.location.longitude;
      }
      cityMap.set(city, existing);
    };
    terrains.forEach(addCity);
    clubs.forEach(addCity);
    players.forEach(addCity);
    tournaments.forEach(addCity);
    publicTerrains.forEach(addCity);
    publicClubs.forEach(addCity);
    publicPlayers.forEach(addCity);
    const sorted = Array.from(cityMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([name, data]) => ({ name, lat: data.lat, lng: data.lng }));
    return sorted;
  }, [terrains, clubs, players, tournaments, publicTerrains, publicClubs, publicPlayers]);

  const MARKER_CONFIG = useMemo(() => ({
    terrains: { label: t('map', 'terrains'), singular: t('map', 'terrainSingular'), icon: 'sports-soccer', color: theme.success },
    clubs: { label: t('map', 'clubs'), singular: t('map', 'clubSingular'), icon: 'home', color: theme.accent },
    tournaments: { label: t('map', 'tournaments'), singular: t('map', 'tournamentSingular'), icon: 'emoji-events', color: theme.carreauColor },
    players: { label: t('map', 'players'), singular: t('map', 'playerSingular'), icon: 'person', color: theme.primary },
    events: { label: language === 'fr' ? 'Defis' : 'Challenges', singular: language === 'fr' ? 'Defi' : 'Challenge', icon: 'campaign', color: '#7C3AED' },
    partners: { label: language === 'fr' ? 'Partenaires' : 'Partners', singular: language === 'fr' ? 'Partenaire' : 'Partner', icon: 'handshake', color: '#D4A017' },
  }), [language]);

  // Dynamic gradient based on active filter
  const activeGradient: [string, string, string] = useMemo(() => {
    const gradients: Record<MarkerType, [string, string, string]> = {
      all: ['#0F172A', '#1E3A8A', '#2563EB'],
      terrains: ['#022C22', '#064E3B', '#10B981'],
      clubs: ['#451A03', '#92400E', '#D97706'],
      tournaments: ['#451A03', '#78350F', '#B45309'],
      players: ['#0F172A', '#1E3A8A', '#2563EB'],
      events: ['#2E1065', '#5B21B6', '#7C3AED'],
      partners: ['#451A03', '#78350F', '#D4A017'],
    };
    return gradients[filter];
  }, [filter]);

  const activeFilterColor = useMemo(() => {
    const colors: Record<MarkerType, string> = {
      all: theme.primary,
      terrains: theme.success,
      clubs: theme.accent,
      tournaments: theme.carreauColor,
      players: theme.primary,
      events: '#7C3AED',
      partners: '#D4A017',
    };
    return colors[filter];
  }, [filter]);

  const [publicLoaded, setPublicLoaded] = useState(false);

  // Lazy-load public items only when needed (first filter interaction or on demand)
  const loadPublicItems = useCallback(async () => {
    if (publicLoaded || !user?.id) return;
    setLoadingPublic(true);
    const [pRes, cRes, tRes, toRes] = await Promise.all([
      fetchPublicPlayers(), fetchPublicClubs(), fetchPublicTerrains(), fetchPublicTournaments(),
    ]);
    if (!pRes.error) setPublicPlayers(pRes.items);
    if (!cRes.error) setPublicClubs(cRes.items);
    if (!tRes.error) setPublicTerrains(tRes.items);
    if (!toRes.error) setPublicTournaments(toRes.items);
    setLoadingPublic(false);
    setPublicLoaded(true);
  }, [publicLoaded, user?.id]);

  // Load public items on mount (deferred to avoid blocking initial render)
  useEffect(() => {
    if (!user?.id) return;
    const timer = setTimeout(loadPublicItems, 800);
    return () => clearTimeout(timer);
  }, [user?.id]);

  // Load sponsored events for map markers
  useEffect(() => {
    if (sponsoredEventsLoaded) return;
    getSponsoredEvents().then(({ events }) => {
      setSponsoredEvents(events);
      setSponsoredEventsLoaded(true);
    });
  }, [sponsoredEventsLoaded]);

  // Load partner markers (Gold/Silver ambassadors -> terrains & clubs)
  useEffect(() => {
    if (partnerMarkersLoaded) return;
    const loadPartnerMarkers = async () => {
      try {
        const { ambassadors } = await fetchAmbassadors();
        const goldSilver = ambassadors.filter(a => a.badgeType === 'gold_sponsor' || a.badgeType === 'sponsor');
        if (goldSilver.length === 0) { setPartnerMarkersLoaded(true); return; }

        const partnerUserIds = goldSilver.map(a => a.userId);
        const supabase = getSupabaseClient();

        // Fetch terrains owned by partners
        const { data: partnerTerrains } = await supabase
          .from('terrains')
          .select('id, user_id, name, city, location, type')
          .in('user_id', partnerUserIds);

        // Fetch clubs owned by partners
        const { data: partnerClubs } = await supabase
          .from('clubs')
          .select('id, user_id, name, city, location')
          .in('user_id', partnerUserIds);

        const markers: (Ambassador & { _tier: string; _itemType: string; _itemId: string; location: any })[] = [];
        const ambByUserId = new Map(goldSilver.map(a => [a.userId, a]));

        (partnerTerrains || []).forEach((t: any) => {
          if (!t.location?.latitude && !t.location?.longitude) return;
          const amb = ambByUserId.get(t.user_id);
          if (!amb) return;
          markers.push({ ...amb, _tier: amb.badgeType, _itemType: 'terrains', _itemId: t.id, location: t.location });
        });

        (partnerClubs || []).forEach((c: any) => {
          if (!c.location?.latitude && !c.location?.longitude) return;
          const amb = ambByUserId.get(c.user_id);
          if (!amb) return;
          markers.push({ ...amb, _tier: amb.badgeType, _itemType: 'clubs', _itemId: c.id, location: c.location });
        });

        setPartnerMarkers(markers);
      } catch (e) {
        console.log('[Map] Error loading partner markers:', e);
      }
      setPartnerMarkersLoaded(true);
    };
    const timer = setTimeout(loadPartnerMarkers, 1200);
    return () => clearTimeout(timer);
  }, [partnerMarkersLoaded]);

  // Helper: check if a location has valid coordinates (not 0,0)
  const hasValidLocation = useCallback((item: any) => {
    const lat = item.location?.latitude;
    const lng = item.location?.longitude;
    return (lat !== undefined && lat !== null && lat !== 0) || (lng !== undefined && lng !== null && lng !== 0);
  }, []);

  // Enrich players with fallback location from associated terrain or club
  const enrichedPlayers = useMemo(() => {
    return players.map(player => {
      if (hasValidLocation(player)) return player;
      // Try terrain first
      if (player.terrainId) {
        const terrain = terrains.find(t => t.id === player.terrainId);
        if (terrain && hasValidLocation(terrain)) {
          return { ...player, location: { ...terrain.location, city: terrain.city }, _locationFallback: 'terrain' };
        }
      }
      // Try club
      if (player.clubId) {
        const club = clubs.find(c => c.id === player.clubId);
        if (club && hasValidLocation(club)) {
          return { ...player, location: { ...club.location, city: club.city }, _locationFallback: 'club' };
        }
      }
      return player;
    });
  }, [players, terrains, clubs, hasValidLocation]);

  // Own data with locations
  const ownData = useMemo(() => ({
    terrains: terrains.filter(hasValidLocation),
    clubs: clubs.filter(hasValidLocation),
    players: enrichedPlayers.filter(hasValidLocation),
    tournaments: tournaments.filter(hasValidLocation),
  }), [terrains, clubs, enrichedPlayers, tournaments, hasValidLocation]);

  // Public data with locations
  const pubData = useMemo(() => ({
    terrains: publicTerrains.filter(hasValidLocation),
    clubs: publicClubs.filter(hasValidLocation),
    players: publicPlayers.filter(hasValidLocation),
    tournaments: publicTournaments.filter(hasValidLocation),
  }), [publicTerrains, publicClubs, publicPlayers, publicTournaments, hasValidLocation]);

  // Combined results
  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    const matchSearch = (item: any, type: string) => {
      if (!q) return true;
      const fields = type === 'terrains' ? [item.name, item.city, item.type] :
                     type === 'clubs' ? [item.name, item.city] :
                     type === 'players' ? [item.name, item.location?.city, item.club] :
                     [item.name, item.location?.city];
      return fields.some((f: string | undefined) => f?.toLowerCase().includes(q));
    };

    // Player sub-filter matching
    const matchPlayerSubFilters = (item: any) => {
      if (eloRankFilter) {
        const elo = item.eloRating || item.elo_rating || 1000;
        const rank = getEloRank(elo);
        if (rank.tier !== eloRankFilter) return false;
      }
      if (eloRangeFilter === 'placement') {
        const mp = item.matchesPlayed ?? item.stats?.matchesPlayed ?? 0;
        if (mp >= 10) return false;
      }
      if (trustFilter) {
        const trustScore = item.trustScore ?? item.trust_score ?? 75;
        if (trustFilter === 'verified' && trustScore < 80) return false;
        if (trustFilter === 'high' && (trustScore < 65 || trustScore >= 80)) return false;
        if (trustFilter === 'medium_low' && trustScore >= 65) return false;
      }
      if (playerRoleFilter) {
        const role = item.role || '';
        if (role !== playerRoleFilter) return false;
      }
      return true;
    };

    // Terrain sub-filter matching
    const matchTerrainSubFilters = (item: any) => {
      if (terrainTypeFilter) {
        if (item.type !== terrainTypeFilter) return false;
      }
      if (terrainEnvFilter) {
        const env = item.environment || 'outdoor';
        if (env !== terrainEnvFilter) return false;
      }
      if (terrainLightingFilter === true && !item.lighting) return false;
      if (terrainCoveredFilter === true && !item.covered) return false;
      if (terrainParkingFilter === true && !item.parking) return false;
      if (terrainPublicAccessFilter === true && item.publicAccess === false) return false;
      if (terrainMembersOnlyFilter === true && item.publicAccess !== false) return false;
      if (terrainMultiCourtsFilter === true && (item.courtsCount || item.courts_count || 1) < 2) return false;
      return true;
    };

    // Club sub-filter matching
    const matchClubSubFilters = (item: any) => {
      if (clubFacilityFilter) {
        const facilities = item.facilities || [];
        if (!facilities.includes(clubFacilityFilter)) return false;
      }
      return true;
    };

    const items: any[] = [];
    const addItems = (data: any, type: string, isPublic: boolean) => {
      const filtered = data.filter((it: any) => matchSearch(it, type));
      filtered.forEach((it: any) => items.push({ ...it, itemType: type, _isPublic: isPublic }));
    };

    const showOwn = mapMode === 'all';
    const showPublic = true;

    if (filter === 'all' || filter === 'terrains') {
      const filterTerrains = (arr: any[]) => (terrainTypeFilter || terrainEnvFilter) ? arr.filter(matchTerrainSubFilters) : arr;
      if (showOwn) addItems(filterTerrains(ownData.terrains), 'terrains', false);
      if (showPublic) addItems(filterTerrains(pubData.terrains), 'terrains', true);
    }
    if (filter === 'all' || filter === 'clubs') {
      const filterClubs = (arr: any[]) => clubFacilityFilter ? arr.filter(matchClubSubFilters) : arr;
      if (showOwn) addItems(filterClubs(ownData.clubs), 'clubs', false);
      if (showPublic) addItems(filterClubs(pubData.clubs), 'clubs', true);
    }
    if (filter === 'all' || filter === 'tournaments') {
      // Only show upcoming/in-progress tournaments on map (exclude Terminé)
      const filterTournaments = (arr: any[]) => {
        let filtered = arr.filter(t => t.status !== 'Terminé');
        if (tournamentFormatFilter) filtered = filtered.filter(t => t.format === tournamentFormatFilter);
        if (tournamentStatusFilter) filtered = filtered.filter(t => t.status === tournamentStatusFilter);
        return filtered;
      };
      if (showOwn) addItems(filterTournaments(ownData.tournaments), 'tournaments', false);
      if (showPublic) addItems(filterTournaments(pubData.tournaments), 'tournaments', true);
    }
    if (filter === 'all' || filter === 'players') {
      const filterPlayers = (arr: any[]) => (eloRankFilter || eloRangeFilter || trustFilter || playerRoleFilter) ? arr.filter(matchPlayerSubFilters) : arr;
      if (showOwn) addItems(filterPlayers(ownData.players), 'players', false);
      if (showPublic) addItems(filterPlayers(pubData.players), 'players', true);
    }
    if (filter === 'all' || filter === 'events') {
      // Skip events when partner filter active
      if (filter !== 'partners') sponsoredEvents.forEach(evt => {
        const terrain = terrains.find(tr => tr.id === evt.terrainId);
        const loc = terrain?.location;
        if (loc && (loc.latitude || loc.longitude)) {
          items.push({ ...evt, name: evt.title, location: loc, itemType: 'events', _isPublic: true });
        }
      });
    }

    // Partner filter: add partner markers as results for list view
    if (filter === 'partners') {
      partnerMarkers.forEach(pm => {
        if (pm.location && (pm.location.latitude || pm.location.longitude)) {
          items.push({ ...pm, name: pm.displayName, itemType: 'partners', _isPublic: true });
        }
      });
    }

    // Deduplicate by id
    const seen = new Set<string>();
    return items.filter(it => {
      const key = `${it.itemType}-${it.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [ownData, pubData, filter, search, mapMode, eloRankFilter, eloRangeFilter, trustFilter, playerRoleFilter, terrainTypeFilter, terrainEnvFilter, terrainLightingFilter, terrainCoveredFilter, terrainParkingFilter, terrainPublicAccessFilter, terrainMembersOnlyFilter, terrainMultiCourtsFilter, tournamentFormatFilter, tournamentStatusFilter, clubFacilityFilter]);

  // Compute clusters with debounced region to avoid expensive re-clustering on every pan
  const clusterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedClusterInput, setDebouncedClusterInput] = useState({ results, region: currentRegion });

  useEffect(() => {
    if (clusterDebounceRef.current) clearTimeout(clusterDebounceRef.current);
    clusterDebounceRef.current = setTimeout(() => {
      setDebouncedClusterInput({ results, region: currentRegion });
    }, 120);
    return () => { if (clusterDebounceRef.current) clearTimeout(clusterDebounceRef.current); };
  }, [results, currentRegion]);

  const clusters = useMemo(() => {
    return clusterMarkers(debouncedClusterInput.results, debouncedClusterInput.region);
  }, [debouncedClusterInput]);

  // Total items in directory (regardless of location)
  const totalCounts = useMemo(() => ({
    terrains: terrains.length,
    clubs: clubs.length,
    players: players.length,
    tournaments: tournaments.length,
  }), [terrains.length, clubs.length, players.length, tournaments.length]);

  // Non-geolocated items count
  const noGeoCount = useMemo(() => {
    const noGeoTerrains = terrains.filter(i => !hasValidLocation(i)).length;
    const noGeoClubs = clubs.filter(i => !hasValidLocation(i)).length;
    const noGeoPlayers = enrichedPlayers.filter(i => !hasValidLocation(i)).length;
    const noGeoTournaments = tournaments.filter(i => !hasValidLocation(i)).length;
    return noGeoTerrains + noGeoClubs + noGeoPlayers + noGeoTournaments;
  }, [terrains, clubs, enrichedPlayers, tournaments, hasValidLocation]);

  const [showNoGeoBanner, setShowNoGeoBanner] = useState(true);
  const [showNoGeoModal, setShowNoGeoModal] = useState(false);
  const [batchGeoMode, setBatchGeoMode] = useState(false);
  const [geoSaving, setGeoSaving] = useState<string | null>(null);
  const [geolocatedIds, setGeolocatedIds] = useState<Set<string>>(new Set());

  const noGeoItems = useMemo(() => {
    const items: { id: string; name: string; type: string; icon: string; color: string; route: string }[] = [];
    terrains.filter(i => !hasValidLocation(i)).forEach(i => items.push({ id: i.id, name: i.name, type: t('map', 'terrainSingular'), icon: 'sports-soccer', color: theme.success, route: `/terrain/edit/${i.id}` }));
    clubs.filter(i => !hasValidLocation(i)).forEach(i => items.push({ id: i.id, name: i.name, type: t('map', 'clubSingular'), icon: 'home', color: theme.accent, route: `/club/edit/${i.id}` }));
    enrichedPlayers.filter(i => !hasValidLocation(i)).forEach(i => items.push({ id: i.id, name: i.name, type: t('map', 'playerSingular'), icon: 'person', color: theme.primary, route: `/player/edit/${i.id}` }));
    tournaments.filter(i => !hasValidLocation(i)).forEach(i => items.push({ id: i.id, name: i.name, type: t('map', 'tournamentSingular'), icon: 'emoji-events', color: theme.carreauColor, route: `/tournament/edit/${i.id}` }));
    return items;
  }, [terrains, clubs, enrichedPlayers, tournaments, hasValidLocation, t]);

  const counts = useMemo(() => {
    const countType = (type: string) => results.filter(r => r.itemType === type).length;
    return {
      terrains: countType('terrains'),
      clubs: countType('clubs'),
      players: countType('players'),
      tournaments: countType('tournaments'),
      events: countType('events'),
      total: results.length,
      publicTotal: results.filter(r => r._isPublic).length,
    };
  }, [results]);

  const handleSelect = useCallback((item: any, type: string) => {
    Haptics.selectionAsync();
    setSelected({ ...item, itemType: type });
  }, []);

  const handleClusterPress = useCallback((cluster: Cluster) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!mapRef.current) return;

    // Trigger burst animation with dominant cluster color
    const typeCounts: Record<string, number> = {};
    cluster.items.forEach(item => { typeCounts[item.itemType] = (typeCounts[item.itemType] || 0) + 1; });
    const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const burstC = dominant ? (CLUSTER_COLOR_MAP[dominant[0]] || theme.primary) : theme.primary;
    triggerBurst(burstC);

    // Calculate bounding region for cluster items
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    cluster.items.forEach(item => {
      const lat = item.location?.latitude || 0;
      const lng = item.location?.longitude || 0;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    const padLat = Math.max((maxLat - minLat) * 0.4, 0.01);
    const padLng = Math.max((maxLng - minLng) * 0.4, 0.01);

    mapRef.current.animateToRegion({
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) + padLat,
      longitudeDelta: (maxLng - minLng) + padLng,
    }, 400);
  }, []);

  const handleNavigate = useCallback(() => {
    if (!selected) return;
    if (selected.itemType === 'events') {
      router.push(`/sponsored-event/${selected.id}` as any);
      setSelected(null);
      return;
    }
    if (selected._isPublic) return;
    const routes: Record<string, string> = {
      clubs: `/club/${selected.id}`, terrains: `/terrain/${selected.id}`,
      tournaments: `/tournament/${selected.id}`, players: `/player/${selected.id}`,
    };
    router.push(routes[selected.itemType] as any);
    setSelected(null);
  }, [selected]);

  const handleImportPublicItem = useCallback(async (item: any) => {
    if (!item) return;
    Haptics.selectionAsync();
    const tableMap: Record<string, any> = { players: 'players', clubs: 'clubs', terrains: 'terrains', tournaments: 'tournaments' };
    const table = tableMap[item.itemType];
    if (!table) return;

    const { newItemId, error } = await importPublicItemToDirectory(table, item.id);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelected(null);
      // Refresh context so the imported item appears in directory immediately
      refreshData();
      // Show toast with directory tab navigation
      const tabMap: Record<string, { tab: string; labelKey: string; icon: string; color: string }> = {
        players: { tab: 'players', labelKey: 'playersTab', icon: 'person', color: '#4F46E5' },
        clubs: { tab: 'clubs', labelKey: 'clubsTab', icon: 'home', color: '#F97316' },
        terrains: { tab: 'terrains', labelKey: 'terrainsTab', icon: 'sports-soccer', color: '#22C55E' },
        tournaments: { tab: 'tournaments', labelKey: 'tournamentsTab', icon: 'emoji-events', color: '#EAB308' },
      };
      const tabInfo = tabMap[item.itemType];
      if (tabInfo) {
        showToast({
          message: `${t('toast', 'addedToTab')} ${t('toast', tabInfo.labelKey)}`,
          icon: tabInfo.icon,
          iconColor: tabInfo.color,
          action: {
            label: t('toast', 'viewTab'),
            onPress: () => router.push({ pathname: '/(tabs)/directory', params: { tab: tabInfo.tab } } as any),
          },
        });
      }
    }
  }, [showAlert, showToast, t]);

  const handleFilterPress = useCallback((f: MarkerType) => {
    Haptics.selectionAsync();
    setFilter(f);
    setSelected(null);
    // Reset sub-filters when switching categories
    if (f !== 'players') {
      setEloRankFilter(null);
      setTrustFilter(null);
      setPlayerRoleFilter(null);
      setEloRangeFilter(null);
    }
    if (f !== 'terrains') {
      setTerrainTypeFilter(null);
      setTerrainEnvFilter(null);
      setTerrainLightingFilter(null);
      setTerrainCoveredFilter(null);
      setTerrainParkingFilter(null);
      setTerrainPublicAccessFilter(null);
      setTerrainMembersOnlyFilter(null);
      setTerrainMultiCourtsFilter(null);
    }
    if (f !== 'clubs') {
      setClubFacilityFilter(null);
    }
    if (f !== 'tournaments') {
      setTournamentFormatFilter(null);
      setTournamentStatusFilter(null);
    }
  }, []);

  // Stable sub-filter toggle handlers (avoid inline closures in JSX)
  const handleEloRankToggle = useCallback((tier: EloRankTier) => {
    Haptics.selectionAsync();
    setEloRankFilter(prev => prev === tier ? null : tier);
  }, []);

  const handleTrustToggle = useCallback((key: 'verified' | 'high' | 'medium_low') => {
    Haptics.selectionAsync();
    setTrustFilter(prev => prev === key ? null : key);
  }, []);

  const handleTerrainTypeToggle = useCallback((id: string) => {
    Haptics.selectionAsync();
    setTerrainTypeFilter(prev => prev === id ? null : id);
  }, []);

  const handleTerrainEnvToggle = useCallback((id: 'indoor' | 'outdoor') => {
    Haptics.selectionAsync();
    setTerrainEnvFilter(prev => prev === id ? null : id);
  }, []);

  const handleTournamentFormatToggle = useCallback((fmt: string) => {
    Haptics.selectionAsync();
    setTournamentFormatFilter(prev => prev === fmt ? null : fmt);
  }, []);

  const handleTournamentStatusToggle = useCallback((key: string) => {
    Haptics.selectionAsync();
    setTournamentStatusFilter(prev => prev === key ? null : key);
  }, []);

  const handlePlayerRoleToggle = useCallback((role: string) => {
    Haptics.selectionAsync();
    setPlayerRoleFilter(prev => prev === role ? null : role);
  }, []);

  const handleEloRangeToggle = useCallback((key: 'placement') => {
    Haptics.selectionAsync();
    setEloRangeFilter(prev => prev === key ? null : key);
  }, []);

  const handleClearPlayerSubFilters = useCallback(() => {
    Haptics.selectionAsync();
    setEloRankFilter(null);
    setTrustFilter(null);
    setPlayerRoleFilter(null);
    setEloRangeFilter(null);
  }, []);

  const handleTerrainCharToggle = useCallback((key: 'lighting' | 'covered' | 'parking' | 'public_access' | 'members_only' | 'multi_courts') => {
    Haptics.selectionAsync();
    if (key === 'lighting') setTerrainLightingFilter(prev => prev === true ? null : true);
    else if (key === 'covered') setTerrainCoveredFilter(prev => prev === true ? null : true);
    else if (key === 'parking') setTerrainParkingFilter(prev => prev === true ? null : true);
    else if (key === 'public_access') { setTerrainPublicAccessFilter(prev => prev === true ? null : true); setTerrainMembersOnlyFilter(null); }
    else if (key === 'members_only') { setTerrainMembersOnlyFilter(prev => prev === true ? null : true); setTerrainPublicAccessFilter(null); }
    else if (key === 'multi_courts') setTerrainMultiCourtsFilter(prev => prev === true ? null : true);
  }, []);

  const handleClubFacilityToggle = useCallback((facility: string) => {
    Haptics.selectionAsync();
    setClubFacilityFilter(prev => prev === facility ? null : facility);
  }, []);

  const handleClearClubSubFilters = useCallback(() => {
    Haptics.selectionAsync();
    setClubFacilityFilter(null);
  }, []);

  const handleClearTerrainSubFilters = useCallback(() => {
    Haptics.selectionAsync();
    setTerrainTypeFilter(null);
    setTerrainEnvFilter(null);
    setTerrainLightingFilter(null);
    setTerrainCoveredFilter(null);
    setTerrainParkingFilter(null);
    setTerrainPublicAccessFilter(null);
    setTerrainMembersOnlyFilter(null);
    setTerrainMultiCourtsFilter(null);
  }, []);

  const handleClearTournamentSubFilters = useCallback(() => {
    Haptics.selectionAsync();
    setTournamentFormatFilter(null);
    setTournamentStatusFilter(null);
  }, []);

  const handleRegionChange = useCallback((region: any) => {
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      setCurrentRegion({
        latitude: region.latitude,
        longitude: region.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      });
    }, 650);
  }, []);

  // Cleanup debounces on unmount
  useEffect(() => {
    return () => {
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
      if (clusterDebounceRef.current) clearTimeout(clusterDebounceRef.current);
    };
  }, []);

  // Active now mode from directory
  const [activeNowMode, setActiveNowMode] = useState(false);
  const [activeNowTerrainIds, setActiveNowTerrainIds] = useState<Set<string>>(new Set());

  // Cluster burst animation
  const [burstVisible, setBurstVisible] = useState(false);
  const [burstColor, setBurstColor] = useState(theme.primary);
  const burstRing1 = useSharedValue(0);
  const burstRing2 = useSharedValue(0);
  const burstRing3 = useSharedValue(0);

  const burstRing1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + burstRing1.value * 2.5 }],
    opacity: 1 - burstRing1.value,
  }));
  const burstRing2Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + burstRing2.value * 2 }],
    opacity: 1 - burstRing2.value,
  }));
  const burstRing3Style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + burstRing3.value * 1.5 }],
    opacity: 1 - burstRing3.value,
  }));

  const triggerBurst = useCallback((color: string) => {
    setBurstColor(color);
    setBurstVisible(true);
    burstRing1.value = 0;
    burstRing2.value = 0;
    burstRing3.value = 0;
    burstRing1.value = withTiming(1, { duration: 500 });
    burstRing2.value = withSequence(withTiming(0, { duration: 80 }), withTiming(1, { duration: 420 }));
    burstRing3.value = withSequence(withTiming(0, { duration: 160 }), withTiming(1, { duration: 340 }));
    setTimeout(() => setBurstVisible(false), 550);
  }, []);

  // Handle filter param from directory
  useEffect(() => {
    if (paramFilter === 'terrains') {
      setFilter('terrains');
    }
    if (paramActiveNow === 'true') {
      setActiveNowMode(true);
      setFilter('terrains');
      // Compute active terrain IDs from match history
      const now = new Date();
      const currentDow = now.getDay();
      const currentHour = now.getHours();
      const todayStr = now.toISOString().slice(0, 10);
      const activeIds = new Set<string>();
      terrains.forEach(tr => {
        const terrainMatches = (allMatches || []).filter((m: any) => m.terrainId === tr.id);
        let score = 0;
        terrainMatches.forEach((m: any) => {
          const d = new Date(m.date);
          if (d.getDay() === currentDow) {
            score += 3;
            if (Math.abs(d.getHours() - currentHour) <= 2) score += 10;
          }
        });
        // Tournaments today bonus
        const todayTournaments = tournaments.filter(t => t.terrainId === tr.id && (t.status === 'En cours' || (t.status === '\u00c0 venir' && t.date && t.date.slice(0, 10) === todayStr)));
        score += todayTournaments.length * 25;
        if (score > 0) activeIds.add(tr.id);
      });
      setActiveNowTerrainIds(activeIds);
    }
  }, [paramFilter, paramActiveNow]);

  // Access matches for active-now computation
  const { matches: allMatches } = useAppData();

  // Handle navigation params: zoom to specific location from directory
  const handledParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!paramLat || !paramLng) return;
    const lat = parseFloat(paramLat);
    const lng = parseFloat(paramLng);
    if (isNaN(lat) || isNaN(lng)) return;
    const paramKey = `${paramLat}-${paramLng}-${paramName}`;
    if (handledParamRef.current === paramKey) return;
    handledParamRef.current = paramKey;
    // Small delay to ensure map is mounted
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 600);
      }
      // Try to find and select the matching item
      if (paramName) {
        showToast({ message: paramName, icon: 'place', iconColor: theme.success });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [paramLat, paramLng, paramName]);

  const loadManageData = useCallback(async () => {
    setLoadingManage(true);
    const data = await getMyPublicableItems();
    setMyItems(data);
    setLoadingManage(false);
  }, []);

  const handleTogglePublic = useCallback(async (table: 'players' | 'clubs' | 'terrains' | 'tournaments', id: string, current: boolean) => {
    Haptics.selectionAsync();
    const { error } = await toggleItemPublic(table, id, !current);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      setMyItems((prev: any) => ({
        ...prev,
        [table]: prev[table].map((it: any) => it.id === id ? { ...it, isPublic: !current } : it),
      }));
      // Sync with AppContext so player card and other pages reflect the change
      setItemPublic(table, id, !current);
      const refreshers: Record<string, () => Promise<any>> = {
        players: fetchPublicPlayers, clubs: fetchPublicClubs,
        terrains: fetchPublicTerrains, tournaments: fetchPublicTournaments,
      };
      const res = await refreshers[table]();
      if (!res.error) {
        const setters: Record<string, any> = {
          players: setPublicPlayers, clubs: setPublicClubs,
          terrains: setPublicTerrains, tournaments: setPublicTournaments,
        };
        setters[table](res.items);
      }
    }
  }, [showAlert, t]);

  const getSingularLabel = useCallback((itemType: string) => {
    return MARKER_CONFIG[itemType as keyof typeof MARKER_CONFIG]?.singular || itemType;
  }, [MARKER_CONFIG]);

  // Responsive
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width || 375);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;

  const renderItem = useCallback(({ item }: { item: any }) => (
    <ListItem
      item={item}
      onPress={() => handleSelect(item, item.itemType)}
      singularLabel={getSingularLabel(item.itemType)}
      terrainTypeLabel={item.itemType === 'terrains' ? t('terrainTypes', item.type) : undefined}
      isPublicItem={item._isPublic}
      onImport={item._isPublic ? () => handleImportPublicItem(item) : undefined}
      t={t}
    />
  ), [handleSelect, getSingularLabel, t, handleImportPublicItem]);

  const keyExtractor = useCallback((item: any) => `${item.itemType}-${item.id}-${item._isPublic ? 'p' : 'o'}`, []);

  const renderMap = () => {
    if (!MapViewComponent || !MarkerComponent) return renderList();
    return (
      <MapViewComponent
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={config.map.defaultRegion}
        showsUserLocation showsMyLocationButton={false}
        onPress={() => { setSelected(null); setSelectedPartner(null); }}
        onRegionChangeComplete={handleRegionChange}
      >
        {/* Partner markers (Gold/Silver) — rendered with higher zIndex, always visible or when partners filter active */}
        {(filter === 'all' || filter === 'partners') ? partnerMarkers.map((pm, idx) => (
          <MarkerComponent
            key={`partner-${pm.id}-${pm._itemType}-${pm._itemId}-${idx}`}
            coordinate={{ latitude: pm.location.latitude, longitude: pm.location.longitude }}
            onPress={() => {
              Haptics.selectionAsync();
              trackAmbassadorEvent(pm.id, 'profile_view', undefined, { sourcePage: 'map' });
              setSelected(null);
              setSelectedPartner(pm);
            }}
            tracksViewChanges={false}
            zIndex={100}
          >
            <PartnerMarkerView partner={{ ...pm, _tier: pm._tier }} />
          </MarkerComponent>
        )) : null}
        {filter !== 'partners' ? clusters.map(cluster => {
          if (cluster.isCluster) {
            // Cluster marker
            const typeCounts: Record<string, number> = {};
            cluster.items.forEach(item => {
              typeCounts[item.itemType] = (typeCounts[item.itemType] || 0) + 1;
            });
            return (
              <MarkerComponent
                key={cluster.id}
                coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                onPress={() => handleClusterPress(cluster)}
                tracksViewChanges={false}
              >
                <ClusterMarkerView count={cluster.items.length} typeCounts={typeCounts} />
              </MarkerComponent>
            );
          } else {
            // Single marker
            const item = cluster.items[0];
            const cfg = MARKER_CONFIG[item.itemType as keyof typeof MARKER_CONFIG];
            if (!cfg) return null;
            const tc = item.itemType === 'terrains' ? config.terrainTypes.find(tt => tt.id === item.type) : null;
            return (
              <MarkerComponent
                key={cluster.id}
                coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                onPress={() => handleSelect(item, item.itemType)}
                tracksViewChanges={false}
              >
                <SingleMarkerView color={activeNowMode && item.itemType === 'terrains' && activeNowTerrainIds.has(item.id) ? '#22C55E' : cfg.color} icon={tc?.icon || cfg.icon} isPublic={item._isPublic} accessIndicator={item.itemType === 'terrains' ? (item.publicAccess !== false ? 'public' : 'private') : null} fallbackSource={item.itemType === 'players' ? (item._locationFallback || null) : null} isVerified={item.itemType === 'clubs' && item.isVerified} isActiveNow={activeNowMode && item.itemType === 'terrains' && activeNowTerrainIds.has(item.id)} />
              </MarkerComponent>
            );
          }
        }) : null}
      </MapViewComponent>
    );
  };

  const renderList = () => (
    <View style={styles.listContainer}>
      <View style={styles.listHeader}>
        <MaterialIcons name="map" size={48} color={theme.textMuted} />
        <Text style={styles.listTitle}>{t('map', 'interactiveMap')}</Text>
        <Text style={styles.listSubtitle}>{t('map', 'availableOnMobile')}</Text>
      </View>
      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(_data, index) => ({ length: 64, offset: 64 * index, index })}
      />
    </View>
  );

  // Manage modal section renderer
  const renderManageSection = (table: 'players' | 'clubs' | 'terrains' | 'tournaments', items: any[], icon: string, color: string, label: string) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.manageSection}>
        <View style={styles.manageSectionHeader}>
          <View style={[styles.manageSectionIcon, { backgroundColor: color + '15' }]}>
            <MaterialIcons name={icon as any} size={16} color={color} />
          </View>
          <Text style={styles.manageSectionTitle}>{label}</Text>
          <Text style={styles.manageSectionCount}>
            {items.filter((i: any) => i.isPublic).length}/{items.length}
          </Text>
        </View>
        {items.map((item: any) => (
          <View key={item.id} style={styles.manageItem}>
            <Text style={styles.manageItemName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.manageItemRight}>
              {item.isPublic ? (
                <View style={styles.publicBadgeManage}>
                  <MaterialIcons name="public" size={12} color={theme.success} />
                  <Text style={styles.publicBadgeManageText}>{t('map', 'publicLabel')}</Text>
                </View>
              ) : (
                <View style={styles.privateBadgeManage}>
                  <MaterialIcons name="lock" size={12} color={theme.textMuted} />
                  <Text style={styles.privateBadgeManageText}>{t('map', 'privateLabel')}</Text>
                </View>
              )}
              <Switch
                value={item.isPublic}
                onValueChange={() => handleTogglePublic(table, item.id, item.isPublic)}
                trackColor={{ false: theme.border, true: theme.success + '60' }}
                thumbColor={item.isPublic ? theme.success : theme.textMuted}
              />
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? renderList() : renderMap()}

      {/* Cluster burst animation overlay */}
      {burstVisible ? (
        <View style={styles.burstOverlay} pointerEvents="none">
          <Animated.View style={[styles.burstRing, { borderColor: burstColor }, burstRing1Style]} />
          <Animated.View style={[styles.burstRing, { borderColor: burstColor, width: 48, height: 48, borderRadius: 24 }, burstRing2Style]} />
          <Animated.View style={[styles.burstRing, { borderColor: burstColor, width: 36, height: 36, borderRadius: 18, borderWidth: 3 }, burstRing3Style]} />
        </View>
      ) : null}

      {/* ========== GRADIENT HERO HEADER ========== */}
      <View style={[styles.heroHeader, { paddingTop: insets.top }]}>
        <View style={[styles.heroGradient, { backgroundColor: '#0F172A' }]}>
          {/* Decorative circles for glassmorphism depth */}
          <View style={styles.heroDecoCircle1} />
          <View style={styles.heroDecoCircle2} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{t('map', 'map')}</Text>
              <Text style={styles.heroSubtitle}>
                {counts.total} {t('map', 'results')} {counts.publicTotal > 0 ? `\u2022 ${counts.publicTotal} ${t('map', 'publicLabel')}` : ''}
              </Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                style={styles.heroActionBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  loadManageData();
                  setShowManageModal(true);
                }}
              >
                <MaterialIcons name="public" size={18} color="#FFF" />
              </Pressable>
              <Pressable
                style={[styles.heroActionBtn, showSearch && styles.heroActionBtnActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowSearch(!showSearch);
                  if (showSearch) setSearch('');
                }}
              >
                <MaterialIcons name={showSearch ? 'close' : 'search'} size={20} color="#FFF" />
              </Pressable>
            </View>
          </View>

          {/* Inline Stats Summary */}
          <View style={styles.heroStatsSummary}>
            {(Object.keys(MARKER_CONFIG) as (keyof typeof MARKER_CONFIG)[]).map((k, i) => {
              const isActive = filter === k;
              return (
                <React.Fragment key={k}>
                  {i > 0 ? <View style={styles.heroStatDivider} /> : null}
                  <Pressable style={styles.heroStatItem} onPress={() => handleFilterPress(k)}>
                    <Text style={[styles.heroStatValue, isActive && { color: '#FFF', fontSize: 19 }]}>{counts[k]}</Text>
                    <Text style={[styles.heroStatLabel, isActive && { color: 'rgba(255,255,255,0.7)' }]}>{MARKER_CONFIG[k].label}</Text>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>


        </View>
      </View>



      {/* Ad Banner - floating at top-center below hero header */}
      {Platform.OS !== 'web' ? (
        <View style={[styles.floatingAdBanner, { bottom: undefined, top: insets.top + 130 }]}>
          <AdBanner position="inline" />
        </View>
      ) : null}

      {/* No-Geo Banner */}
      {noGeoCount > 0 && showNoGeoBanner && Platform.OS !== 'web' ? (
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.noGeoBanner, { bottom: 145 }]}>
          <View style={styles.noGeoBannerIcon}>
            <MaterialIcons name="location-off" size={20} color={theme.warning} />
          </View>
          <View style={styles.noGeoBannerContent}>
            <Text style={styles.noGeoBannerTitle}>{t('map', 'noGeoBannerTitle')}</Text>
            <Text style={styles.noGeoBannerDesc}>{noGeoCount} {t('map', 'noGeoBannerDesc')}</Text>
          </View>
          <Pressable style={styles.noGeoBannerBtn} onPress={() => { Haptics.selectionAsync(); setShowNoGeoModal(true); }}>
            <Text style={styles.noGeoBannerBtnText}>{t('map', 'noGeoBannerAction')}</Text>
          </Pressable>
          <Pressable style={styles.noGeoBannerClose} onPress={() => setShowNoGeoBanner(false)} hitSlop={8}>
            <MaterialIcons name="close" size={14} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Bottom Panel */}
      <View style={styles.bottomPanel}>
        {/* Search bar (expandable) */}
        {showSearch ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.searchRowOuter}>
            <View style={styles.searchBar}>
              <MaterialIcons name="search" size={18} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={language === 'fr' ? 'Ville, terrain, club, joueur...' : 'City, terrain, club, player...'}
                placeholderTextColor={theme.textMuted}
                value={search}
                onChangeText={(text) => {
                  setSearch(text);
                  // Debounced suggestions
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  if (text.trim().length < 2) { setSearchSuggestions([]); setShowSuggestions(false); return; }
                  searchDebounceRef.current = setTimeout(() => {
                    const q = text.toLowerCase().trim();
                    const suggestions: { label: string; type: string; count?: number; lat?: number; lng?: number; icon?: string; color?: string }[] = [];
                    // City suggestions
                    const cityMap = new Map<string, { count: number; lat?: number; lng?: number }>();
                    [...ownData.terrains, ...ownData.clubs, ...ownData.players, ...pubData.terrains, ...pubData.clubs, ...pubData.players].forEach(item => {
                      const city = item.city || item.location?.city;
                      if (city && city.toLowerCase().includes(q)) {
                        const existing = cityMap.get(city) || { count: 0 };
                        existing.count++;
                        if (!existing.lat && item.location?.latitude) { existing.lat = item.location.latitude; existing.lng = item.location.longitude; }
                        cityMap.set(city, existing);
                      }
                    });
                    cityMap.forEach((v, city) => {
                      suggestions.push({ label: city, type: language === 'fr' ? 'Ville' : 'City', count: v.count, lat: v.lat, lng: v.lng, icon: 'location-city', color: '#3B82F6' });
                    });
                    // Item name suggestions (top 5)
                    const nameMatches: typeof suggestions = [];
                    const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
                      terrains: { label: language === 'fr' ? 'Terrain' : 'Terrain', icon: 'sports-soccer', color: theme.success },
                      clubs: { label: 'Club', icon: 'home', color: theme.accent },
                      players: { label: language === 'fr' ? 'Joueur' : 'Player', icon: 'person', color: theme.primary },
                    };
                    const addNameMatches = (items: any[], itemType: string) => {
                      items.filter(it => it.name?.toLowerCase().includes(q)).slice(0, 3).forEach(it => {
                        const tl = typeLabels[itemType];
                        if (tl) nameMatches.push({ label: it.name, type: tl.label, lat: it.location?.latitude, lng: it.location?.longitude, icon: tl.icon, color: tl.color });
                      });
                    };
                    addNameMatches([...ownData.terrains, ...pubData.terrains], 'terrains');
                    addNameMatches([...ownData.clubs, ...pubData.clubs], 'clubs');
                    addNameMatches([...ownData.players, ...pubData.players], 'players');
                    suggestions.push(...nameMatches.slice(0, 5));
                    // Dedup
                    const seen = new Set<string>();
                    const deduped = suggestions.filter(s => { const key = `${s.label}-${s.type}`; if (seen.has(key)) return false; seen.add(key); return true; });
                    setSearchSuggestions(deduped.slice(0, 8));
                    setShowSuggestions(deduped.length > 0);
                  }, 200);
                }}
                autoFocus
              />
              {search.length > 0 ? (
                <Pressable onPress={() => { setSearch(''); setSearchSuggestions([]); setShowSuggestions(false); }} hitSlop={8}><MaterialIcons name="close" size={16} color={theme.textMuted} /></Pressable>
              ) : null}
            </View>
            {/* Quick filter chips */}
            {!search.trim() ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionChipsRow}>
                {[{ label: language === 'fr' ? 'Pres de moi' : 'Near me', icon: 'my-location', onPress: () => {
                  if (mapRef.current) {
                    mapRef.current.animateToRegion({ ...currentRegion, latitudeDelta: 0.1, longitudeDelta: 0.1 }, 400);
                  }
                }},
                ...topCities.map(tc => ({
                  label: tc.name, icon: 'location-city' as const,
                  onPress: () => { setSearch(tc.name); if (tc.lat && tc.lng && mapRef.current) mapRef.current.animateToRegion({ latitude: tc.lat, longitude: tc.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }, 500); },
                })),
                ].map((chip, i) => (
                  <Pressable key={i} style={styles.suggestionChip} onPress={() => { Haptics.selectionAsync(); chip.onPress(); }}>
                    <MaterialIcons name={chip.icon as any} size={13} color={theme.textSecondary} />
                    <Text style={styles.suggestionChipText}>{chip.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {/* Suggestions dropdown */}
            {showSuggestions && searchSuggestions.length > 0 ? (
              <ScrollView style={styles.suggestionsContainer} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {searchSuggestions.map((sug, idx) => (
                  <Pressable
                    key={`${sug.label}-${sug.type}-${idx}`}
                    style={styles.suggestionItem}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSearch(sug.label);
                      setShowSuggestions(false);
                      // Zoom to suggestion location if available
                      if (sug.lat && sug.lng && mapRef.current) {
                        mapRef.current.animateToRegion({
                          latitude: sug.lat,
                          longitude: sug.lng,
                          latitudeDelta: sug.type === (language === 'fr' ? 'Ville' : 'City') ? 0.08 : 0.02,
                          longitudeDelta: sug.type === (language === 'fr' ? 'Ville' : 'City') ? 0.08 : 0.02,
                        }, 500);
                      }
                    }}
                  >
                    <View style={[styles.suggestionIcon, { backgroundColor: ((sug as any).color || theme.primary) + '12' }]}>
                      <MaterialIcons name={((sug as any).icon || 'place') as any} size={16} color={(sug as any).color || theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionLabel} numberOfLines={1}>{sug.label}</Text>
                      <Text style={styles.suggestionMeta}>{sug.type}{sug.count ? ` \u2022 ${sug.count} ${language === 'fr' ? 'elements' : 'items'}` : ''}</Text>
                    </View>
                    {sug.lat ? <MaterialIcons name="near-me" size={14} color={theme.textMuted} /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {search.trim() && !showSuggestions ? <Text style={styles.searchCount}>{counts.total} {counts.total !== 1 ? t('map', 'results') : t('map', 'result')}</Text> : null}
          </Animated.View>
        ) : null}

        <SponsorBanner style={{ marginHorizontal: 12, marginTop: 4, marginBottom: 0 }} page="map" />

        {/* Category filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <FilterChip label={t('map', 'all')} icon="layers" isActive={filter === 'all'} onPress={() => handleFilterPress('all')} />
          {(Object.keys(MARKER_CONFIG) as (keyof typeof MARKER_CONFIG)[]).map(k => (
            <FilterChip key={k} label={MARKER_CONFIG[k].label} icon={MARKER_CONFIG[k].icon} isActive={filter === k} activeColor={MARKER_CONFIG[k].color} onPress={() => handleFilterPress(k)} />
          ))}
        </ScrollView>

        {/* Terrain sub-filters: type & environment & characteristics */}
        {filter === 'terrains' ? (
          <TerrainSubFilters
            terrainTypeFilter={terrainTypeFilter}
            terrainEnvFilter={terrainEnvFilter}
            terrainLightingFilter={terrainLightingFilter}
            terrainCoveredFilter={terrainCoveredFilter}
            terrainParkingFilter={terrainParkingFilter}
            terrainPublicAccessFilter={terrainPublicAccessFilter}
            terrainMembersOnlyFilter={terrainMembersOnlyFilter}
            terrainMultiCourtsFilter={terrainMultiCourtsFilter}
            onTerrainTypePress={handleTerrainTypeToggle}
            onTerrainEnvPress={handleTerrainEnvToggle}
            onTerrainCharPress={handleTerrainCharToggle}
            onClear={handleClearTerrainSubFilters}
            count={counts.terrains}
            language={language}
          />
        ) : null}

        {/* Club sub-filters: facilities/equipment */}
        {filter === 'clubs' ? (
          <View style={styles.subFiltersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subFiltersRow}>
              <View style={styles.subFilterLabel}>
                <MaterialIcons name="build" size={12} color={theme.textMuted} />
                <Text style={styles.subFilterLabelText}>{language === 'fr' ? 'Equipements' : 'Facilities'}</Text>
              </View>
              {(['Parking', 'Buvette', 'Toilettes', 'Eclairage', 'Boulodrome couvert', 'Vestiaires', 'Location de boules', 'Wi-Fi', 'Restaurant'] as const).map(fac => (
                <SubFilterChip key={fac} label={fac} isActive={clubFacilityFilter === fac} color={theme.accent} onPress={() => handleClubFacilityToggle(fac)} />
              ))}
            </ScrollView>
            {clubFacilityFilter ? (
              <View style={styles.subFilterActiveBar}>
                <Text style={styles.subFilterActiveText}>{counts.clubs} {language === 'fr' ? 'club(s) filtre(s)' : 'club(s) filtered'}</Text>
                <Pressable style={styles.subFilterClearBtn} onPress={handleClearClubSubFilters}>
                  <MaterialIcons name="close" size={12} color={theme.primary} />
                  <Text style={styles.subFilterClearText}>{language === 'fr' ? 'Effacer' : 'Clear'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Tournament sub-filters: format & status */}
        {filter === 'tournaments' ? (
          <TournamentSubFilters
            tournamentFormatFilter={tournamentFormatFilter}
            tournamentStatusFilter={tournamentStatusFilter}
            onFormatPress={handleTournamentFormatToggle}
            onStatusPress={handleTournamentStatusToggle}
            onClear={handleClearTournamentSubFilters}
            count={counts.tournaments}
            language={language}
          />
        ) : null}

        {/* Player sub-filters: ELO rank, role & trust score */}
        {filter === 'players' ? (
          <PlayerSubFilters
            eloRankFilter={eloRankFilter}
            eloRangeFilter={eloRangeFilter}
            trustFilter={trustFilter}
            roleFilter={playerRoleFilter}
            onEloRankPress={handleEloRankToggle}
            onEloRangePress={handleEloRangeToggle}
            onTrustPress={handleTrustToggle}
            onRolePress={handlePlayerRoleToggle}
            onClear={handleClearPlayerSubFilters}
            count={counts.players}
            language={language}
          />
        ) : null}
      </View>

      {/* Selected Card */}
      {selected ? (
        <Animated.View entering={FadeInUp.duration(250)} style={[styles.selectedCard, { bottom: 155 }]}>
          <Pressable style={styles.selectedInner} onPress={selected._isPublic ? undefined : handleNavigate}>
            <View style={[styles.selectedIcon, { backgroundColor: MARKER_CONFIG[selected.itemType as keyof typeof MARKER_CONFIG]?.color }]}>
              <MaterialIcons
                name={(selected.itemType === 'terrains'
                  ? config.terrainTypes.find(tc => tc.id === selected.type)?.icon
                  : MARKER_CONFIG[selected.itemType as keyof typeof MARKER_CONFIG]?.icon) as any}
                size={22} color="#FFF" />
            </View>
            <View style={styles.selectedContent}>
              <View style={styles.selectedTitleRow}>
                <Text style={styles.selectedTitle} numberOfLines={1}>{selected.name}</Text>
                {selected._isPublic && selected.itemType === 'players' && selected.isPremium ? (
                  <View style={styles.premiumBadgeMap}>
                    <MaterialIcons name="star" size={8} color="#A8B4C0" />
                  </View>
                ) : null}
                {selected._isPublic ? (
                  <View style={styles.publicBadgeSelected}>
                    <MaterialIcons name="public" size={10} color={theme.success} />
                    <Text style={styles.publicBadgeSelectedText}>{t('map', 'publicLabel')}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.selectedMeta}>
                <MaterialIcons name="place" size={12} color={theme.textMuted} />
                <Text style={styles.selectedMetaText}>
                  {selected.itemType === 'terrains' ? `${selected.city} \u2022 ${t('terrainTypes', selected.type)}` :
                   selected.itemType === 'clubs' ? selected.city :
                   selected.itemType === 'players' ? (selected.location?.city || selected.club || '-') :
                   selected.location?.city}
                </Text>
              </View>
              <View style={styles.selectedTags}>
                <View style={[styles.tag, { backgroundColor: MARKER_CONFIG[selected.itemType as keyof typeof MARKER_CONFIG]?.color + '15' }]}>
                  <Text style={[styles.tagText, { color: MARKER_CONFIG[selected.itemType as keyof typeof MARKER_CONFIG]?.color }]}>
                    {MARKER_CONFIG[selected.itemType as keyof typeof MARKER_CONFIG]?.singular}
                  </Text>
                </View>
                {selected.itemType === 'terrains' && selected.courtsCount ? (
                  <View style={styles.tag}><Text style={styles.tagText}>{selected.courtsCount} {selected.courtsCount > 1 ? t('map', 'courts') : t('map', 'court')}</Text></View>
                ) : null}
                {selected.itemType === 'players' ? (
                  <View style={styles.tag}><Text style={styles.tagText}>{selected.role}</Text></View>
                ) : null}
                {selected.itemType === 'players' && (selected.eloRating || selected.elo_rating) ? (() => {
                  const elo = selected.eloRating || selected.elo_rating || 1000;
                  const rank = getEloRank(elo);
                  return <View style={[styles.tag, { backgroundColor: rank.color + '15' }]}><MaterialIcons name={rank.icon as any} size={8} color={rank.color} /><Text style={[styles.tagText, { color: rank.color }]}>{elo}</Text></View>;
                })() : null}
                {selected.itemType === 'tournaments' ? (
                  <View style={styles.tag}><Text style={styles.tagText}>{t('formats', selected.format)}</Text></View>
                ) : null}
                {selected.itemType === 'events' ? (
                  <View style={styles.tag}><Text style={styles.tagText}>{selected.challengeType === '10_tirs' ? '10 Tirs' : selected.challengeType === '10_tirs_sautee' ? '10 Tirs sautee' : 'Precision'}</Text></View>
                ) : null}
                {selected.itemType === 'events' && selected.status ? (
                  <View style={[styles.tag, { backgroundColor: selected.status === 'active' ? '#22C55E15' : '#F59E0B15' }]}><Text style={[styles.tagText, { color: selected.status === 'active' ? '#22C55E' : '#F59E0B' }]}>{selected.status === 'active' ? (language === 'fr' ? 'En cours' : 'Active') : (language === 'fr' ? 'A venir' : 'Upcoming')}</Text></View>
                ) : null}
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              {selected.itemType === 'events' ? (
                <Pressable style={[styles.selectedArrow, { backgroundColor: '#7C3AED15' }]} onPress={handleNavigate}>
                  <MaterialIcons name="arrow-forward" size={18} color="#7C3AED" />
                </Pressable>
              ) : selected._isPublic ? (
                <Pressable style={styles.importBtn} onPress={() => handleImportPublicItem(selected)}>
                  <MaterialIcons name="add-circle" size={24} color={theme.primary} />
                </Pressable>
              ) : (
                <View style={styles.selectedArrow}>
                  <MaterialIcons name="arrow-forward" size={18} color={theme.primary} />
                </View>
              )}
              {selected._isPublic && selected.itemType === 'players' && selected.userId && selected.userId !== user?.id ? (
                <Pressable style={styles.selectedInviteBtn} onPress={() => handleInviteToMeetupMap(selected.userId, selected.name)}>
                  <MaterialIcons name="event" size={14} color={theme.primary} />
                </Pressable>
              ) : null}
            </View>
          </Pressable>
          <Pressable style={styles.selectedClose} onPress={() => setSelected(null)}>
            <MaterialIcons name="close" size={16} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Partner Detail Popup */}
      {selectedPartner ? (() => {
        const tierCfg = TIER_COLORS[selectedPartner._tier] || TIER_COLORS.sponsor;
        const isGold = selectedPartner._tier === 'gold_sponsor';
        const tierLabel = isGold ? (language === 'fr' ? 'Partenaire Or' : 'Gold Partner') : (language === 'fr' ? 'Partenaire Argent' : 'Silver Partner');
        return (
          <Animated.View entering={FadeInUp.duration(250)} style={[styles.partnerPopup, { bottom: 155 }]}>
            <Pressable style={styles.partnerPopupClose} onPress={() => setSelectedPartner(null)} hitSlop={8}>
              <MaterialIcons name="close" size={16} color={theme.textMuted} />
            </Pressable>
            {/* Header */}
            <View style={styles.partnerPopupHeader}>
              {selectedPartner.photo ? (
                <Image source={{ uri: selectedPartner.photo }} style={[styles.partnerPopupAvatar, { borderColor: tierCfg.border }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.partnerPopupAvatarFallback, { backgroundColor: tierCfg.bg, borderColor: tierCfg.border }]}>
                  <MaterialIcons name={isGold ? 'workspace-premium' : 'handshake'} size={24} color={tierCfg.primary} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.partnerPopupName} numberOfLines={1}>{selectedPartner.displayName}</Text>
                <View style={[styles.partnerPopupBadge, { backgroundColor: tierCfg.primary }]}>
                  <MaterialIcons name={isGold ? 'star' : 'workspace-premium'} size={9} color="#FFF" />
                  <Text style={styles.partnerPopupBadgeText}>{tierLabel.toUpperCase()}</Text>
                </View>
              </View>
            </View>
            {/* Bio */}
            {selectedPartner.bio ? (
              <Text style={styles.partnerPopupBio} numberOfLines={3}>{selectedPartner.bio}</Text>
            ) : null}
            {/* Social links */}
            {(selectedPartner.youtubeUrl || selectedPartner.instagramHandle || selectedPartner.twitterHandle || selectedPartner.tiktokUrl) ? (
              <View style={styles.partnerPopupSocials}>
                {selectedPartner.youtubeUrl ? (
                  <Pressable style={[styles.partnerPopupSocialChip, { backgroundColor: '#FF000010', borderColor: '#FF000020' }]} onPress={() => { trackAmbassadorEvent(selectedPartner.id, 'social_click', 'youtube', { sourcePage: 'map' }); Linking.openURL(selectedPartner.youtubeUrl!); }}>
                    <MaterialIcons name="play-arrow" size={14} color="#FF0000" />
                    <Text style={[styles.partnerPopupSocialText, { color: '#FF0000' }]}>YouTube</Text>
                  </Pressable>
                ) : null}
                {selectedPartner.instagramHandle ? (
                  <Pressable style={[styles.partnerPopupSocialChip, { backgroundColor: '#E4405F10', borderColor: '#E4405F20' }]} onPress={() => { trackAmbassadorEvent(selectedPartner.id, 'social_click', 'instagram', { sourcePage: 'map' }); Linking.openURL(`https://instagram.com/${selectedPartner.instagramHandle}`); }}>
                    <MaterialIcons name="camera-alt" size={14} color="#E4405F" />
                    <Text style={[styles.partnerPopupSocialText, { color: '#E4405F' }]}>Instagram</Text>
                  </Pressable>
                ) : null}
                {selectedPartner.twitterHandle ? (
                  <Pressable style={[styles.partnerPopupSocialChip, { backgroundColor: '#1DA1F210', borderColor: '#1DA1F220' }]} onPress={() => { trackAmbassadorEvent(selectedPartner.id, 'social_click', 'twitter', { sourcePage: 'map' }); Linking.openURL(`https://x.com/${selectedPartner.twitterHandle}`); }}>
                    <MaterialIcons name="alternate-email" size={14} color="#1DA1F2" />
                    <Text style={[styles.partnerPopupSocialText, { color: '#1DA1F2' }]}>X</Text>
                  </Pressable>
                ) : null}
                {selectedPartner.tiktokUrl ? (
                  <Pressable style={[styles.partnerPopupSocialChip, { backgroundColor: '#01010108', borderColor: '#01010112' }]} onPress={() => { trackAmbassadorEvent(selectedPartner.id, 'social_click', 'tiktok', { sourcePage: 'map' }); Linking.openURL(selectedPartner.tiktokUrl!); }}>
                    <MaterialIcons name="music-note" size={14} color="#010101" />
                    <Text style={[styles.partnerPopupSocialText, { color: '#333' }]}>TikTok</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {/* Actions */}
            <View style={styles.partnerPopupActions}>
              {selectedPartner.websiteUrl ? (
                <Pressable
                  style={({ pressed }) => [styles.partnerPopupVisitBtn, { borderColor: tierCfg.primary }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                  onPress={() => { trackAmbassadorEvent(selectedPartner.id, 'social_click', 'website', { sourcePage: 'map' }); Linking.openURL(selectedPartner.websiteUrl!); }}
                >
                  <MaterialIcons name="open-in-new" size={16} color={tierCfg.primary} />
                  <Text style={[styles.partnerPopupVisitText, { color: tierCfg.primary }]}>{language === 'fr' ? 'Visiter le site' : 'Visit website'}</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={({ pressed }) => [styles.partnerPopupProfileBtn, pressed && { opacity: 0.85 }]}
                onPress={() => { setSelectedPartner(null); router.push('/partners' as any); }}
              >
                <MaterialIcons name="arrow-forward" size={16} color={theme.primary} />
              </Pressable>
            </View>
          </Animated.View>
        );
      })() : null}

      {/* No-Geo Items Modal */}
      <Modal visible={showNoGeoModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowNoGeoModal(false); setBatchGeoMode(false); }}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('map', 'noGeoModalTitle')}</Text>
            <Pressable style={styles.modalClose} onPress={() => { setShowNoGeoModal(false); setBatchGeoMode(false); }}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.manageInfo}>
            <MaterialIcons name="location-off" size={18} color={theme.warning} />
            <Text style={styles.manageInfoText}>{noGeoCount} {t('map', 'noGeoBannerDesc')}</Text>
          </View>
          {/* Batch mode toggle */}
          <View style={styles.batchToggleRow}>
            <Pressable
              style={[styles.batchToggleBtn, !batchGeoMode && styles.batchToggleBtnActive]}
              onPress={() => setBatchGeoMode(false)}
            >
              <MaterialIcons name="edit" size={16} color={!batchGeoMode ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.batchToggleText, !batchGeoMode && styles.batchToggleTextActive]}>{t('map', 'noGeoEditBtn')}</Text>
            </Pressable>
            <Pressable
              style={[styles.batchToggleBtn, batchGeoMode && styles.batchToggleBtnActive]}
              onPress={() => setBatchGeoMode(true)}
            >
              <MaterialIcons name="my-location" size={16} color={batchGeoMode ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.batchToggleText, batchGeoMode && styles.batchToggleTextActive]}>{t('map', 'noGeoBatchMode')}</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
            {noGeoItems.filter(item => !geolocatedIds.has(item.id)).map(item => (
              <View key={`${item.type}-${item.id}`} style={styles.noGeoItemBatch}>
                <Pressable
                  style={styles.noGeoItem}
                  onPress={() => {
                    if (!batchGeoMode) {
                      setShowNoGeoModal(false);
                      setBatchGeoMode(false);
                      router.push(item.route as any);
                    }
                  }}
                >
                  <View style={[styles.noGeoItemIcon, { backgroundColor: item.color + '15' }]}>
                    <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <View style={styles.noGeoItemInfo}>
                    <Text style={styles.noGeoItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.noGeoItemType}>{item.type}</Text>
                  </View>
                  {!batchGeoMode ? (
                    <View style={styles.noGeoItemBtn}>
                      <MaterialIcons name="edit-location-alt" size={18} color={theme.primary} />
                      <Text style={styles.noGeoItemBtnText}>{t('map', 'noGeoEditBtn')}</Text>
                    </View>
                  ) : geoSaving === item.id ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : null}
                </Pressable>
                {batchGeoMode ? (
                  <View style={styles.batchLocationPicker}>
                    <LocationPicker
                      label=""
                      showCityOnly
                      placeholder={t('map', 'noGeoSetLocation')}
                      onChange={async (loc: LocationData) => {
                        if (!loc.latitude && !loc.longitude) return;
                        setGeoSaving(item.id);
                        try {
                          const locationUpdate = { location: { address: loc.address, city: loc.city, country: loc.country, latitude: loc.latitude, longitude: loc.longitude } };
                          const typeTable = item.icon === 'sports-soccer' ? 'terrain' : item.icon === 'home' ? 'club' : item.icon === 'person' ? 'player' : 'tournament';
                          if (typeTable === 'terrain') await updateTerrain(item.id, { ...locationUpdate, city: loc.city, address: loc.address } as any);
                          else if (typeTable === 'club') await updateClub(item.id, { ...locationUpdate, city: loc.city, address: loc.address } as any);
                          else if (typeTable === 'player') await updatePlayer(item.id, locationUpdate as any);
                          else await updateTournament(item.id, locationUpdate as any);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          setGeolocatedIds(prev => new Set([...prev, item.id]));
                          showToast({ message: `${item.name} — ${t('map', 'noGeoLocationSaved')}`, icon: 'check-circle', iconColor: theme.success });
                        } catch (e) { /* silent */ }
                        setGeoSaving(null);
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ))}
            {noGeoItems.filter(item => !geolocatedIds.has(item.id)).length === 0 ? (
              <View style={styles.manageEmpty}>
                <MaterialIcons name="check-circle" size={48} color={theme.success} />
                <Text style={styles.manageEmptyText}>{t('common', 'success')}</Text>
                <Text style={styles.manageEmptyDesc}>{t('map', 'noGeoLocationSaved')}</Text>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Manage Public Items Modal */}
      <Modal visible={showManageModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowManageModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('map', 'managePublic')}</Text>
            <Pressable style={styles.modalClose} onPress={() => setShowManageModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
            {/* Info */}
            <View style={styles.manageInfo}>
              <MaterialIcons name="info-outline" size={18} color={theme.primary} />
              <Text style={styles.manageInfoText}>{t('map', 'publicItemsDesc')}</Text>
            </View>

            {loadingManage ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
            ) : (
              <>
                {renderManageSection('players', myItems.players.filter((p: any) => p.id === user?.id), 'person', theme.primary, t('map', 'players'))}
                {renderManageSection('clubs', myItems.clubs, 'home', theme.accent, t('map', 'clubs'))}
                {renderManageSection('terrains', myItems.terrains, 'sports-soccer', theme.success, t('map', 'terrains'))}
                {renderManageSection('tournaments', myItems.tournaments, 'emoji-events', theme.carreauColor, t('map', 'tournaments'))}

                {myItems.players.length === 0 && myItems.clubs.length === 0 && myItems.terrains.length === 0 && myItems.tournaments.length === 0 ? (
                  <View style={styles.manageEmpty}>
                    <MaterialIcons name="folder-off" size={48} color={theme.textMuted} />
                    <Text style={styles.manageEmptyText}>{t('map', 'noPublicItems')}</Text>
                    <Text style={styles.manageEmptyDesc}>{t('map', 'noPublicItemsDesc')}</Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Meetup Invitation Picker Modal (Map) */}
      <Modal visible={showMeetupPicker} animationType="slide" transparent onRequestClose={() => setShowMeetupPicker(false)}>
        <View style={styles.meetupOverlay}>
          <View style={styles.meetupPickerContent}>
            <View style={styles.meetupPickerHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.meetupPickerTitle}>{t('meetup', 'inviteToMeetup')}</Text>
                <Text style={styles.meetupPickerSubtitle}>{meetupPickerUserName}</Text>
              </View>
              <Pressable style={styles.meetupPickerClose} onPress={() => setShowMeetupPicker(false)}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.meetupPickerDesc}>{t('meetup', 'chooseMeetup')}</Text>
            {loadingMeetups ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : activeMeetups.length > 0 ? (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {activeMeetups.map((m) => {
                  const mDate = new Date(m.date);
                  return (
                    <Pressable key={m.id} style={[styles.meetupPickerItem, invitingToMeetup === m.id && { opacity: 0.6 }]} onPress={() => handleConfirmInviteMap(m.id)} disabled={!!invitingToMeetup}>
                      <View style={styles.meetupPickerItemDate}>
                        <Text style={styles.meetupPickerItemDay}>{mDate.getDate()}</Text>
                        <Text style={styles.meetupPickerItemMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.meetupPickerItemTitle} numberOfLines={1}>{m.title}</Text>
                        <Text style={styles.meetupPickerItemTime}>{mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      {invitingToMeetup === m.id ? <ActivityIndicator size="small" color={theme.primary} /> : (
                        <View style={styles.meetupPickerItemArrow}><MaterialIcons name="send" size={16} color={theme.primary} /></View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <MaterialIcons name="event-busy" size={40} color={theme.textMuted} />
                <Text style={styles.meetupPickerEmptyText}>{t('meetup', 'noActiveMeetups')}</Text>
                <Text style={styles.meetupPickerEmptyDesc}>{t('meetup', 'noActiveMeetupsDesc')}</Text>
                <Pressable style={styles.meetupPickerCreateBtn} onPress={() => { setShowMeetupPicker(false); router.push('/meetup/new' as any); }}>
                  <MaterialIcons name="add" size={18} color="#FFF" />
                  <Text style={styles.meetupPickerCreateBtnText}>{t('meetup', 'createMeetupFirst')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  // ========== GRADIENT HERO HEADER ==========
  heroHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  heroGradient: { paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, overflow: 'hidden' as const, position: 'relative' as const },
  heroDecoCircle1: { position: 'absolute' as const, top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroDecoCircle2: { position: 'absolute' as const, bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.03)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroActionBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  heroStatsSummary: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  heroStatItem: { flex: 1, alignItems: 'center' as const },
  heroStatValue: { fontSize: 13, fontWeight: '800' as const, color: 'rgba(255,255,255,0.5)' },
  heroStatLabel: { fontSize: 7, fontWeight: '700' as const, color: 'rgba(255,255,255,0.3)', marginTop: 1, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  heroStatDivider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.08)' },

  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.select({ ios: 4, default: 4 }),
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8,
    borderTopWidth: 1, borderTopColor: '#E8EDF2',
  },

  // Player sub-filters
  subFiltersContainer: { paddingTop: 2, paddingBottom: 2, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  subFiltersRow: { paddingHorizontal: 10, paddingVertical: 3, gap: 4, alignItems: 'center' as const },
  subFilterLabel: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, marginRight: 4 },
  subFilterLabelText: { fontSize: 9, fontWeight: '700' as const, color: theme.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  subChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  subChipText: { fontSize: 11, fontWeight: '600' as const },
  subFilterActiveBar: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 5 },
  subFilterActiveText: { fontSize: 11, fontWeight: '600' as const, color: theme.textSecondary },
  subFilterClearBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.primary + '10' },
  subFilterClearText: { fontSize: 11, fontWeight: '600' as const, color: theme.primary },

  searchRowOuter: {
    paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9',
    borderRadius: 12, paddingHorizontal: 12, height: 38, gap: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.textPrimary },
  searchCount: { fontSize: 11, color: theme.textSecondary, marginTop: 6, textAlign: 'center' },
  suggestionsContainer: { backgroundColor: '#FFF', borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0', maxHeight: 220, overflow: 'hidden' as const },
  suggestionItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  suggestionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  suggestionLabel: { fontSize: 13, fontWeight: '600' as const, color: theme.textPrimary },
  suggestionMeta: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  suggestionChipsRow: { flexDirection: 'row' as const, gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  suggestionChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  suggestionChipText: { fontSize: 11, fontWeight: '600' as const, color: theme.textSecondary },
  filters: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4, gap: 5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: 11, fontWeight: '600', color: theme.textSecondary },
  chipTextActive: { color: '#FFF' },

  panelLeaderboardCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginHorizontal: 12, marginTop: 6, marginBottom: 4, backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E8EDF2' },
  panelLeaderboardIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.primary, alignItems: 'center' as const, justifyContent: 'center' as const },
  panelLeaderboardTitle: { fontSize: 13, fontWeight: '700' as const, color: theme.textPrimary },
  panelLeaderboardSub: { fontSize: 10, color: theme.textMuted, marginTop: 1 },

  // Single markers
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF', ...theme.shadows.card },
  markerPublic: { borderColor: theme.success, borderWidth: 3 },
  markerWrapper: { alignItems: 'center', justifyContent: 'center' },
  accessBadge: { position: 'absolute', bottom: -3, right: -3, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF', ...theme.shadows.card },
  accessBadgePublic: { backgroundColor: theme.success },
  accessBadgePrivate: { backgroundColor: '#F59E0B' },
  verifiedBadge: { position: 'absolute', bottom: -3, right: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF', ...theme.shadows.card },
  // Fallback badge for players with terrain/club location
  fallbackBadge: { position: 'absolute', bottom: -3, right: -3, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF', ...theme.shadows.card },
  markerFallback: { opacity: 0.85, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.6)' },
  activeNowPulseRing: { position: 'absolute' as const, width: 44, height: 44, borderRadius: 22, backgroundColor: 'transparent', borderWidth: 2.5, borderColor: '#22C55E' },
  // Cluster markers
  clusterOuter: {
    position: 'absolute' as const,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  clusterInner: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
    ...theme.shadows.cardElevated,
  },
  clusterCount: {
    fontWeight: '800', color: '#FFF',
  },
  clusterPillRow: {
    flexDirection: 'row' as const, gap: 3, marginTop: 1,
  },
  clusterPill: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 1,
    backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 6,
    paddingHorizontal: 3, paddingVertical: 1,
  },
  clusterPillText: {
    fontSize: 7, fontWeight: '800' as const, color: '#FFF',
  },
  clusterDots: {
    position: 'absolute' as const,
    flexDirection: 'row', gap: 3,
  },
  clusterDot: {
    width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5, borderColor: '#FFF',
  },
  burstOverlay: {
    position: 'absolute' as const,
    top: '50%' as any,
    left: '50%' as any,
    marginTop: -30,
    marginLeft: -30,
    width: 60,
    height: 60,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 50,
  },
  burstRing: {
    position: 'absolute' as const,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  // Selected card
  selectedCard: { position: 'absolute', left: 16, right: 16, backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, ...theme.shadows.cardElevated },
  selectedInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  selectedIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  selectedContent: { flex: 1 },
  selectedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  selectedTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  selectedMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  selectedMetaText: { fontSize: 12, color: theme.textSecondary },
  selectedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: theme.backgroundSecondary, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: '600', color: theme.textSecondary },
  selectedArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  importBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  selectedClose: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  publicBadgeSelected: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.success + '15',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.borderRadius.full,
  },
  publicBadgeSelectedText: { fontSize: 9, fontWeight: '600', color: theme.success },
  premiumBadgeMap: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#A8B4C0' + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A8B4C0' + '40' },
  // List fallback
  listContainer: { flex: 1, paddingBottom: 200 },
  listHeader: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  listTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 8 },
  listSubtitle: { fontSize: 13, color: theme.textSecondary },
  listScroll: { paddingHorizontal: 16, gap: 8 },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, padding: 12, borderRadius: theme.borderRadius.md, ...theme.shadows.card },
  listIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  listContent: { flex: 1 },
  listNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 2, flex: 1 },
  listMeta: { fontSize: 12, color: theme.textSecondary },
  listBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  listBadgeText: { fontSize: 10, fontWeight: '600' },
  publicBadgeSmall: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: theme.success + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  importBtnSmall: { padding: 4 },
  premiumBadgeListMap: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#A8B4C0' + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A8B4C0' + '40' },
  selectedInviteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '10', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.primary + '25' },
  // Meetup Picker (Map)
  meetupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  meetupPickerContent: { backgroundColor: theme.surface, borderRadius: 24, padding: 24 },
  meetupPickerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  meetupPickerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  meetupPickerSubtitle: { fontSize: 13, color: theme.primary, fontWeight: '600', marginTop: 2 },
  meetupPickerClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  meetupPickerDesc: { fontSize: 13, color: theme.textSecondary, marginBottom: 16 },
  meetupPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 14, marginBottom: 10 },
  meetupPickerItemDate: { width: 46, height: 46, borderRadius: 12, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  meetupPickerItemDay: { fontSize: 18, fontWeight: '900', color: theme.primary, lineHeight: 20 },
  meetupPickerItemMonth: { fontSize: 9, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 },
  meetupPickerItemTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  meetupPickerItemTime: { fontSize: 12, color: theme.textMuted },
  meetupPickerItemArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  meetupPickerEmptyText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginTop: 12 },
  meetupPickerEmptyDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16, paddingHorizontal: 16 },
  meetupPickerCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  meetupPickerCreateBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  // Manage Modal
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  modalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 16 },
  manageInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: theme.primary + '06',
    padding: 16, borderRadius: 16, marginBottom: 20,
    borderWidth: 1.5, borderColor: theme.primary + '15',
  },
  manageInfoText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
  manageSection: { marginBottom: 24 },
  manageSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  manageSectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  manageSectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  manageSectionCount: { fontSize: 13, fontWeight: '700', color: theme.textMuted, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  manageItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.surface, padding: 16, borderRadius: 14,
    marginBottom: 10, ...theme.shadows.card, borderWidth: 1, borderColor: theme.border,
  },
  manageItemName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginRight: 12 },
  manageItemRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  publicBadgeManage: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.success + '12',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: theme.success + '25',
  },
  publicBadgeManageText: { fontSize: 11, fontWeight: '700', color: theme.success },
  privateBadgeManage: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: theme.border,
  },
  privateBadgeManageText: { fontSize: 11, fontWeight: '600', color: theme.textMuted },
  manageEmpty: { alignItems: 'center', paddingVertical: 48 },
  manageEmptyText: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginTop: 16 },
  manageEmptyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 300, lineHeight: 20 },

  // Floating ad banner - repositioned to top area to not block filters
  floatingAdBanner: {
    position: 'absolute' as const, left: 12, right: 12,
    opacity: 0.92, zIndex: 15,
  },
  // No-Geo Banner
  noGeoBanner: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: theme.borderRadius.md, padding: 12,
    ...theme.shadows.cardElevated, borderLeftWidth: 3, borderLeftColor: theme.warning,
  },
  noGeoBannerIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.warning + '15',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  noGeoBannerContent: { flex: 1 },
  noGeoBannerTitle: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  noGeoBannerDesc: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  noGeoBannerBtn: {
    backgroundColor: theme.warning, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.borderRadius.sm, marginLeft: 8,
  },
  noGeoBannerBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  noGeoBannerClose: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  // No-Geo Modal items
  noGeoItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 8, gap: 12,
    ...theme.shadows.card,
  },
  noGeoItemIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  noGeoItemInfo: { flex: 1 },
  noGeoItemName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  noGeoItemType: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  noGeoItemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.primary + '15', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  noGeoItemBtnText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  noGeoItemBatch: { marginBottom: 4 },
  batchLocationPicker: {
    paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: theme.surface, borderBottomLeftRadius: theme.borderRadius.md, borderBottomRightRadius: theme.borderRadius.md,
    marginTop: -8, marginBottom: 4,
  },
  batchToggleRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
  },
  batchToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: theme.borderRadius.md, backgroundColor: theme.backgroundSecondary,
  },
  batchToggleBtnActive: { backgroundColor: theme.primary },
  batchToggleText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  batchToggleTextActive: { color: '#FFF' },
  // Partner popup
  partnerPopup: {
    position: 'absolute' as const, left: 16, right: 16,
    backgroundColor: theme.surface, borderRadius: 20,
    padding: 16, ...theme.shadows.cardElevated,
    borderWidth: 1, borderColor: '#E8EDF2',
  },
  partnerPopupClose: {
    position: 'absolute' as const, top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.backgroundSecondary, alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 10,
  },
  partnerPopupHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, marginBottom: 10,
  },
  partnerPopupAvatar: {
    width: 52, height: 52, borderRadius: 16, borderWidth: 2.5, overflow: 'hidden' as const,
  },
  partnerPopupAvatarFallback: {
    width: 52, height: 52, borderRadius: 16, borderWidth: 2.5,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  partnerPopupName: {
    fontSize: 17, fontWeight: '700' as const, color: theme.textPrimary, marginBottom: 4,
  },
  partnerPopupBadge: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    alignSelf: 'flex-start' as const, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  partnerPopupBadgeText: {
    fontSize: 8, fontWeight: '900' as const, color: '#FFF', letterSpacing: 0.5,
  },
  partnerPopupBio: {
    fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 10,
  },
  partnerPopupSocials: {
    flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 12,
  },
  partnerPopupSocialChip: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1,
  },
  partnerPopupSocialText: {
    fontSize: 11, fontWeight: '600' as const,
  },
  partnerPopupActions: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
  },
  partnerPopupVisitBtn: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8,
    paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, backgroundColor: '#FFF',
  },
  partnerPopupVisitText: {
    fontSize: 13, fontWeight: '700' as const,
  },
  partnerPopupProfileBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.primary + '12', alignItems: 'center' as const, justifyContent: 'center' as const,
    borderWidth: 1, borderColor: theme.primary + '20',
  },
});
