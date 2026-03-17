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
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/template';
import { useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import {
  fetchPublicPlayers, fetchPublicClubs, fetchPublicTerrains, fetchPublicTournaments,
  toggleItemPublic, importPublicItemToDirectory, getMyPublicableItems,
} from '@/services/publicItemsService';
import { getMyActiveMeetups, inviteSingleUserToMeetup, Meetup as MeetupType } from '@/services/meetupService';
import AdBanner from '@/components/ui/AdBanner';
import { useToast } from '@/components/ui/Toast';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';

type MarkerType = 'all' | 'terrains' | 'clubs' | 'tournaments' | 'players';
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

function clusterMarkers(items: ClusterItem[], region: { latitudeDelta: number; longitudeDelta: number } | null): Cluster[] {
  if (!region || items.length === 0) return items.filter(item => {
    const lat = item.location?.latitude;
    const lng = item.location?.longitude;
    return (lat !== undefined && lat !== null && lat !== 0) || (lng !== undefined && lng !== null && lng !== 0);
  }).map(item => ({
    id: `single-${item.itemType}-${item.id}`,
    latitude: item.location?.latitude || 0,
    longitude: item.location?.longitude || 0,
    items: [item],
    isCluster: false,
  }));

  // Grid cell size based on zoom level
  const cellLat = region.latitudeDelta * 0.08;
  const cellLng = region.longitudeDelta * 0.08;

  // If zoomed in enough, don't cluster
  if (region.latitudeDelta < 0.05) {
    return items.filter(item => {
      const lat = item.location?.latitude;
      const lng = item.location?.longitude;
      return (lat !== undefined && lat !== null && lat !== 0) || (lng !== undefined && lng !== null && lng !== 0);
    }).map(item => ({
      id: `single-${item.itemType}-${item.id}`,
      latitude: item.location?.latitude || 0,
      longitude: item.location?.longitude || 0,
      items: [item],
      isCluster: false,
    }));
  }

  const grid: Record<string, ClusterItem[]> = {};

  items.forEach(item => {
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
// CLUSTER MARKER COMPONENT
// ============================================
const SingleMarkerView = React.memo(({ color, icon, isPublic, accessIndicator, fallbackSource }: { color: string; icon: string; isPublic: boolean; accessIndicator?: 'public' | 'private' | null; fallbackSource?: 'terrain' | 'club' | null }) => (
  <View style={styles.markerWrapper}>
    <View style={[styles.marker, { backgroundColor: color }, isPublic && styles.markerPublic, fallbackSource && styles.markerFallback]}>
      <MaterialIcons name={icon as any} size={14} color="#FFF" />
    </View>
    {fallbackSource ? (
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

const ClusterMarkerView = React.memo(({ count, typeCounts }: { count: number; typeCounts: Record<string, number> }) => {
  // Determine dominant type color
  const colorMap: Record<string, string> = {
    terrains: theme.success,
    clubs: theme.accent,
    tournaments: theme.carreauColor,
    players: theme.primary,
  };
  
  const dominantType = Object.entries(typeCounts).reduce((a, b) => b[1] > a[1] ? b : a, ['', 0] as [string, number]);
  const dominantColor = colorMap[dominantType[0]] || theme.primary;
  const typeCount = Object.keys(typeCounts).filter(k => typeCounts[k] > 0).length;
  
  // Size based on count
  const size = count <= 5 ? 44 : count <= 15 ? 52 : 60;
  const fontSize = count <= 5 ? 15 : count <= 15 ? 17 : 19;

  return (
    <View style={[styles.clusterOuter, { width: size + 12, height: size + 12, borderRadius: (size + 12) / 2, backgroundColor: dominantColor + '20' }]}>
      <View style={[styles.clusterInner, { width: size, height: size, borderRadius: size / 2, backgroundColor: dominantColor }]}>
        <Text style={[styles.clusterCount, { fontSize }]}>{count}</Text>
      </View>
      {/* Type indicator dots */}
      {typeCount > 1 ? (
        <View style={styles.clusterDots}>
          {Object.entries(typeCounts).filter(([, c]) => c > 0).map(([type]) => (
            <View key={type} style={[styles.clusterDot, { backgroundColor: colorMap[type] || theme.textMuted }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
});

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
  const { clubs, tournaments, terrains, players, refreshData, updatePlayer, updateClub, updateTerrain, updateTournament, setItemPublic } = useApp();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState<MarkerType>('all');
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
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
  const [showLegend, setShowLegend] = useState(false);

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

  const MARKER_CONFIG = useMemo(() => ({
    terrains: { label: t('map', 'terrains'), singular: t('map', 'terrainSingular'), icon: 'sports-soccer', color: theme.success },
    clubs: { label: t('map', 'clubs'), singular: t('map', 'clubSingular'), icon: 'home', color: theme.accent },
    tournaments: { label: t('map', 'tournaments'), singular: t('map', 'tournamentSingular'), icon: 'emoji-events', color: theme.carreauColor },
    players: { label: t('map', 'players'), singular: t('map', 'playerSingular'), icon: 'person', color: theme.primary },
  }), [language]);

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

    const items: any[] = [];
    const addItems = (data: any, type: string, isPublic: boolean) => {
      const filtered = data.filter((it: any) => matchSearch(it, type));
      filtered.forEach((it: any) => items.push({ ...it, itemType: type, _isPublic: isPublic }));
    };

    const showOwn = mapMode === 'all';
    const showPublic = true;

    if (filter === 'all' || filter === 'terrains') {
      if (showOwn) addItems(ownData.terrains, 'terrains', false);
      if (showPublic) addItems(pubData.terrains, 'terrains', true);
    }
    if (filter === 'all' || filter === 'clubs') {
      if (showOwn) addItems(ownData.clubs, 'clubs', false);
      if (showPublic) addItems(pubData.clubs, 'clubs', true);
    }
    if (filter === 'all' || filter === 'tournaments') {
      if (showOwn) addItems(ownData.tournaments, 'tournaments', false);
      if (showPublic) addItems(pubData.tournaments, 'tournaments', true);
    }
    if (filter === 'all' || filter === 'players') {
      if (showOwn) addItems(ownData.players, 'players', false);
      if (showPublic) addItems(pubData.players, 'players', true);
    }

    // Deduplicate by id
    const seen = new Set<string>();
    return items.filter(it => {
      const key = `${it.itemType}-${it.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [ownData, pubData, filter, search, mapMode]);

  // Compute clusters
  const clusters = useMemo(() => {
    return clusterMarkers(results, currentRegion);
  }, [results, currentRegion]);

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
  }, []);

  const handleRegionChange = useCallback((region: any) => {
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      setCurrentRegion(region);
    }, 500);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    };
  }, []);

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
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
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
        onPress={() => setSelected(null)}
        onRegionChangeComplete={handleRegionChange}
      >
        {clusters.map(cluster => {
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
                <SingleMarkerView color={cfg.color} icon={tc?.icon || cfg.icon} isPublic={item._isPublic} accessIndicator={item.itemType === 'terrains' ? (item.publicAccess !== false ? 'public' : 'private') : null} fallbackSource={item.itemType === 'players' ? (item._locationFallback || null) : null} />
              </MarkerComponent>
            );
          }
        })}
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
      <AdBanner position="inline" />
      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.listScroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15} maxToRenderPerBatch={10}
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

      {/* ========== GRADIENT HERO HEADER ========== */}
      <View style={[styles.heroHeader, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#1E3A8A', '#2563EB', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
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
          <View style={styles.heroStatsRow}>
            {(Object.keys(MARKER_CONFIG) as (keyof typeof MARKER_CONFIG)[]).map((k, i) => (
              <React.Fragment key={k}>
                {i > 0 ? <View style={styles.heroStatDivider} /> : null}
                <Pressable style={styles.heroStatItem} onPress={() => handleFilterPress(k)}>
                  <Text style={styles.heroStatValue}>{counts[k]}</Text>
                  <Text style={styles.heroStatLabel}>{MARKER_CONFIG[k].label}</Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </LinearGradient>
      </View>

      {/* Legend */}
      {Platform.OS !== 'web' ? (
        <View style={[styles.legendContainer, { top: insets.top + 130 }]}>
          <Pressable
            style={styles.legendToggle}
            onPress={() => { Haptics.selectionAsync(); setShowLegend(!showLegend); }}
            hitSlop={8}
          >
            <MaterialIcons name={showLegend ? 'close' : 'info-outline'} size={18} color={theme.textSecondary} />
          </Pressable>
          {showLegend ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.legendPanel}>
              <Text style={styles.legendTitle}>{t('map', 'legendTitle')}</Text>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: theme.success }]}>
                  <MaterialIcons name="lock-open" size={7} color="#FFF" />
                </View>
                <Text style={styles.legendLabel}>{t('map', 'legendPublicAccess')}</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]}>
                  <MaterialIcons name="lock" size={7} color="#FFF" />
                </View>
                <Text style={styles.legendLabel}>{t('map', 'legendMembersOnly')}</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendBorderSample} />
                <Text style={styles.legendLabel}>{t('map', 'legendPublicItem')}</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: theme.success }]}>
                  <MaterialIcons name="sports-soccer" size={7} color="#FFF" />
                </View>
                <Text style={styles.legendLabel}>{t('map', 'legendFallbackTerrain')}</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: theme.accent }]}>
                  <MaterialIcons name="home" size={7} color="#FFF" />
                </View>
                <Text style={styles.legendLabel}>{t('map', 'legendFallbackClub')}</Text>
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {/* No-Geo Banner */}
      {noGeoCount > 0 && showNoGeoBanner && Platform.OS !== 'web' ? (
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.noGeoBanner, { bottom: 175 }]}>
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
              <TextInput style={styles.searchInput} placeholder={t('map', 'search')} placeholderTextColor={theme.textMuted} value={search} onChangeText={setSearch} autoFocus />
              {search.length > 0 ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}><MaterialIcons name="close" size={16} color={theme.textMuted} /></Pressable>
              ) : null}
            </View>
            {search.trim() ? <Text style={styles.searchCount}>{counts.total} {counts.total !== 1 ? t('map', 'results') : t('map', 'result')}</Text> : null}
          </Animated.View>
        ) : null}

        {/* Category filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Pressable style={[styles.chip, filter === 'all' && styles.chipActive]} onPress={() => handleFilterPress('all')}>
            <MaterialIcons name="layers" size={14} color={filter === 'all' ? '#FFF' : theme.textSecondary} />
            <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>{t('map', 'all')}</Text>
          </Pressable>
          {(Object.keys(MARKER_CONFIG) as (keyof typeof MARKER_CONFIG)[]).map(k => (
            <Pressable key={k} style={[styles.chip, filter === k && { backgroundColor: MARKER_CONFIG[k].color }]} onPress={() => handleFilterPress(k)}>
              <MaterialIcons name={MARKER_CONFIG[k].icon as any} size={14} color={filter === k ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.chipText, filter === k && styles.chipTextActive]}>{MARKER_CONFIG[k].label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Selected Card */}
      {selected ? (
        <Animated.View entering={FadeInUp.duration(250)} style={[styles.selectedCard, { bottom: 190 }]}>
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
                {selected.itemType === 'tournaments' ? (
                  <View style={styles.tag}><Text style={styles.tagText}>{t('formats', selected.format)}</Text></View>
                ) : null}
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              {selected._isPublic ? (
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
                {renderManageSection('players', myItems.players, 'person', theme.primary, t('map', 'players'))}
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
  heroGradient: { paddingTop: 16, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' as const, justifyContent: 'center' as const },
  heroActionBtnActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8 },
  heroStatItem: { flex: 1, alignItems: 'center' as const },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  heroStatLabel: { fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginTop: 2, textTransform: 'uppercase' as const },
  heroStatDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)' },
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.select({ ios: 8, default: 8 }), ...theme.shadows.cardElevated,
  },

  searchRowOuter: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md, paddingHorizontal: 12, height: 42, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.textPrimary },
  searchCount: { fontSize: 11, color: theme.textSecondary, marginTop: 6, textAlign: 'center' },
  filters: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.borderRadius.full, backgroundColor: theme.backgroundSecondary },
  chipActive: { backgroundColor: theme.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  chipTextActive: { color: '#FFF' },

  // Single markers
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF', ...theme.shadows.card },
  markerPublic: { borderColor: theme.success, borderWidth: 3 },
  markerWrapper: { alignItems: 'center', justifyContent: 'center' },
  accessBadge: { position: 'absolute', bottom: -3, right: -3, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF', ...theme.shadows.card },
  accessBadgePublic: { backgroundColor: theme.success },
  accessBadgePrivate: { backgroundColor: '#F59E0B' },
  // Fallback badge for players with terrain/club location
  fallbackBadge: { position: 'absolute', bottom: -3, right: -3, width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF', ...theme.shadows.card },
  markerFallback: { opacity: 0.85, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.6)' },
  // Cluster markers
  clusterOuter: {
    alignItems: 'center', justifyContent: 'center',
  },
  clusterInner: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFF',
    ...theme.shadows.cardElevated,
  },
  clusterCount: {
    fontWeight: '800', color: '#FFF',
  },
  clusterDots: {
    position: 'absolute', bottom: -2,
    flexDirection: 'row', gap: 3,
  },
  clusterDot: {
    width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.5, borderColor: '#FFF',
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
  // Legend
  legendContainer: { position: 'absolute', left: 12, zIndex: 10 },
  legendToggle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    ...theme.shadows.card,
  },
  legendPanel: {
    marginTop: 6, backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: theme.borderRadius.md, padding: 10,
    ...theme.shadows.card, minWidth: 160,
  },
  legendTitle: { fontSize: 11, fontWeight: '700', color: theme.textPrimary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FFF' },
  legendLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  legendBorderSample: { width: 14, height: 14, borderRadius: 7, backgroundColor: theme.textMuted + '30', borderWidth: 2.5, borderColor: theme.success },
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
});
