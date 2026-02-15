import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';

type MarkerType = 'all' | 'terrains' | 'clubs' | 'tournaments' | 'players';

// Conditionally import map components
let MapViewComponent: React.ComponentType<any> | null = null;
let MarkerComponent: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapViewComponent = Maps.default;
  MarkerComponent = Maps.Marker;
}

// Memoized list item component
const ListItem = React.memo(({ item, onPress, singularLabel }: { item: any; onPress: () => void; singularLabel: string }) => {
  const MARKER_COLORS: Record<string, string> = {
    terrains: theme.success,
    clubs: theme.accent,
    tournaments: theme.carreauColor,
    players: theme.primary,
  };
  const MARKER_ICONS: Record<string, string> = {
    terrains: 'sports-soccer',
    clubs: 'home',
    tournaments: 'emoji-events',
    players: 'person',
  };

  const color = MARKER_COLORS[item.itemType] || theme.primary;
  const icon = MARKER_ICONS[item.itemType] || 'place';
  const terrainConfig = item.itemType === 'terrains'
    ? config.terrainTypes.find(t => t.id === item.type)
    : null;

  return (
    <Pressable style={styles.listItem} onPress={onPress}>
      <View style={[styles.listIcon, { backgroundColor: color }]}>
        <MaterialIcons name={(terrainConfig?.icon || icon) as any} size={18} color="#FFF" />
      </View>
      <View style={styles.listContent}>
        <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.listMeta} numberOfLines={1}>
          {item.itemType === 'terrains' ? `${item.city} • ${item.type}` :
           item.itemType === 'clubs' ? item.city :
           item.itemType === 'players' ? (item.location?.city || item.club || '-') :
           item.location?.city}
        </Text>
      </View>
      <View style={[styles.listBadge, { backgroundColor: color + '15' }]}>
        <Text style={[styles.listBadgeText, { color }]}>
          {singularLabel}
        </Text>
      </View>
    </Pressable>
  );
});

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { clubs, tournaments, terrains, players } = useApp();
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState<MarkerType>('all');
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Marker config with translated labels
  const MARKER_CONFIG = useMemo(() => ({
    terrains: { label: t('map', 'terrains'), singular: t('map', 'terrainSingular'), icon: 'sports-soccer', color: theme.success },
    clubs: { label: t('map', 'clubs'), singular: t('map', 'clubSingular'), icon: 'home', color: theme.accent },
    tournaments: { label: t('map', 'tournaments'), singular: t('map', 'tournamentSingular'), icon: 'emoji-events', color: theme.carreauColor },
    players: { label: t('map', 'players'), singular: t('map', 'playerSingular'), icon: 'person', color: theme.primary },
  }), [language]);

  // Filtered data with valid locations
  const data = useMemo(() => ({
    terrains: terrains.filter(t => t.location?.latitude || t.location?.longitude),
    clubs: clubs.filter(c => c.location?.latitude || c.location?.longitude),
    players: players.filter(p => p.location?.latitude || p.location?.longitude),
    tournaments: tournaments.filter(t => t.location?.latitude || t.location?.longitude),
  }), [terrains, clubs, players, tournaments]);

  // Search + filter results
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
    if (filter === 'all' || filter === 'terrains') {
      items.push(...data.terrains.filter(t => matchSearch(t, 'terrains')).map(t => ({ ...t, itemType: 'terrains' })));
    }
    if (filter === 'all' || filter === 'clubs') {
      items.push(...data.clubs.filter(c => matchSearch(c, 'clubs')).map(c => ({ ...c, itemType: 'clubs' })));
    }
    if (filter === 'all' || filter === 'tournaments') {
      items.push(...data.tournaments.filter(t => matchSearch(t, 'tournaments')).map(t => ({ ...t, itemType: 'tournaments' })));
    }
    if (filter === 'all' || filter === 'players') {
      items.push(...data.players.filter(p => matchSearch(p, 'players')).map(p => ({ ...p, itemType: 'players' })));
    }
    return items;
  }, [data, filter, search]);

  // Counts
  const counts = useMemo(() => {
    const q = search.toLowerCase().trim();
    const count = (arr: any[], type: string) => {
      if (!q) return arr.length;
      return arr.filter(item => {
        const fields = type === 'terrains' ? [item.name, item.city, item.type] :
                       type === 'clubs' ? [item.name, item.city] :
                       type === 'players' ? [item.name, item.location?.city, item.club] :
                       [item.name, item.location?.city];
        return fields.some((f: string | undefined) => f?.toLowerCase().includes(q));
      }).length;
    };
    return {
      terrains: count(data.terrains, 'terrains'),
      clubs: count(data.clubs, 'clubs'),
      players: count(data.players, 'players'),
      tournaments: count(data.tournaments, 'tournaments'),
      total: results.length,
    };
  }, [data, results, search]);

  const handleSelect = useCallback((item: any, type: string) => {
    Haptics.selectionAsync();
    setSelected({ ...item, itemType: type });
  }, []);

  const handleNavigate = useCallback(() => {
    if (!selected) return;
    const routes: Record<string, string> = {
      clubs: `/club/${selected.id}`,
      terrains: `/terrain/${selected.id}`,
      tournaments: `/tournament/${selected.id}`,
      players: `/player/${selected.id}`,
    };
    router.push(routes[selected.itemType] as any);
    setSelected(null);
  }, [selected]);

  const handleFilterPress = useCallback((f: MarkerType) => {
    Haptics.selectionAsync();
    setFilter(f);
    setSelected(null);
  }, []);

  const getSingularLabel = useCallback((itemType: string) => {
    return MARKER_CONFIG[itemType as keyof typeof MARKER_CONFIG]?.singular || itemType;
  }, [MARKER_CONFIG]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <ListItem
      item={item}
      onPress={() => handleSelect(item, item.itemType)}
      singularLabel={getSingularLabel(item.itemType)}
    />
  ), [handleSelect, getSingularLabel]);

  const keyExtractor = useCallback((item: any) => `${item.itemType}-${item.id}`, []);

  // Native map renderer
  const renderMap = () => {
    if (!MapViewComponent || !MarkerComponent) return renderList();

    return (
      <MapViewComponent
        style={StyleSheet.absoluteFillObject}
        initialRegion={config.map.defaultRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={() => setSelected(null)}
      >
        {(filter === 'all' || filter === 'terrains') && results.filter(i => i.itemType === 'terrains').map(t => (
          <MarkerComponent key={`t-${t.id}`} coordinate={t.location} onPress={() => handleSelect(t, 'terrains')}>
            <View style={[styles.marker, { backgroundColor: MARKER_CONFIG.terrains.color }]}>
              <MaterialIcons name={(config.terrainTypes.find(tt => tt.id === t.type)?.icon || 'sports-soccer') as any} size={14} color="#FFF" />
            </View>
          </MarkerComponent>
        ))}
        {(filter === 'all' || filter === 'clubs') && results.filter(i => i.itemType === 'clubs').map(c => (
          <MarkerComponent key={`c-${c.id}`} coordinate={c.location} onPress={() => handleSelect(c, 'clubs')}>
            <View style={[styles.marker, { backgroundColor: MARKER_CONFIG.clubs.color }]}>
              <MaterialIcons name="home" size={14} color="#FFF" />
            </View>
          </MarkerComponent>
        ))}
        {(filter === 'all' || filter === 'tournaments') && results.filter(i => i.itemType === 'tournaments').map(t => (
          <MarkerComponent key={`to-${t.id}`} coordinate={t.location} onPress={() => handleSelect(t, 'tournaments')}>
            <View style={[styles.marker, { backgroundColor: MARKER_CONFIG.tournaments.color }]}>
              <MaterialIcons name="emoji-events" size={14} color="#FFF" />
            </View>
          </MarkerComponent>
        ))}
        {(filter === 'all' || filter === 'players') && results.filter(i => i.itemType === 'players').map(p => (
          <MarkerComponent key={`p-${p.id}`} coordinate={p.location} onPress={() => handleSelect(p, 'players')}>
            <View style={[styles.marker, { backgroundColor: MARKER_CONFIG.players.color }]}>
              <MaterialIcons name="person" size={14} color="#FFF" />
            </View>
          </MarkerComponent>
        ))}
      </MapViewComponent>
    );
  };

  // List fallback for web
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
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' ? renderList() : renderMap()}

      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.header}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('map', 'map')}</Text>
            <Pressable
              style={[styles.searchBtn, showSearch && styles.searchBtnActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setShowSearch(!showSearch);
                if (showSearch) setSearch('');
              }}
            >
              <MaterialIcons name={showSearch ? 'close' : 'search'} size={20} color={showSearch ? '#FFF' : theme.textSecondary} />
            </Pressable>
          </View>

          {showSearch && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.searchRow}>
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={18} color={theme.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('map', 'search')}
                  placeholderTextColor={theme.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <MaterialIcons name="close" size={16} color={theme.textMuted} />
                  </Pressable>
                )}
              </View>
              {search.trim() ? (
                <Text style={styles.searchCount}>
                  {counts.total} {counts.total !== 1 ? t('map', 'results') : t('map', 'result')}
                </Text>
              ) : null}
            </Animated.View>
          )}

          <View style={styles.statsRow}>
            {(Object.keys(MARKER_CONFIG) as (keyof typeof MARKER_CONFIG)[]).map(k => (
              <View key={k} style={[styles.statItem, filter !== 'all' && filter !== k && styles.statItemDim]}>
                <View style={[styles.statDot, { backgroundColor: MARKER_CONFIG[k].color }]} />
                <Text style={styles.statValue}>{counts[k]}</Text>
                <Text style={styles.statLabel}>{MARKER_CONFIG[k].label.toLowerCase()}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Filters */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Pressable
              style={[styles.chip, filter === 'all' && styles.chipActive]}
              onPress={() => handleFilterPress('all')}
            >
              <MaterialIcons name="layers" size={14} color={filter === 'all' ? '#FFF' : theme.textSecondary} />
              <Text style={[styles.chipText, filter === 'all' && styles.chipTextActive]}>
                {t('map', 'all')} ({counts.total})
              </Text>
            </Pressable>
            {(Object.keys(MARKER_CONFIG) as (keyof typeof MARKER_CONFIG)[]).map(k => (
              <Pressable
                key={k}
                style={[styles.chip, filter === k && { backgroundColor: MARKER_CONFIG[k].color }]}
                onPress={() => handleFilterPress(k)}
              >
                <MaterialIcons name={MARKER_CONFIG[k].icon as any} size={14} color={filter === k ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.chipText, filter === k && styles.chipTextActive]}>{MARKER_CONFIG[k].label} ({counts[k]})</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>

      {/* Selected Card */}
      {selected && (
        <Animated.View entering={FadeInUp.duration(250)} style={[styles.selectedCard, { bottom: insets.bottom + 100 }]}>
          <Pressable style={styles.selectedInner} onPress={handleNavigate}>
            <View style={[styles.selectedIcon, { backgroundColor: MARKER_CONFIG[selected.itemType as keyof typeof MARKER_CONFIG]?.color }]}>
              <MaterialIcons
                name={(selected.itemType === 'terrains'
                  ? config.terrainTypes.find(t => t.id === selected.type)?.icon
                  : MARKER_CONFIG[selected.itemType as keyof typeof MARKER_CONFIG]?.icon) as any}
                size={22}
                color="#FFF"
              />
            </View>
            <View style={styles.selectedContent}>
              <Text style={styles.selectedTitle} numberOfLines={1}>{selected.name}</Text>
              <View style={styles.selectedMeta}>
                <MaterialIcons name="place" size={12} color={theme.textMuted} />
                <Text style={styles.selectedMetaText}>
                  {selected.itemType === 'terrains' ? `${selected.city} • ${selected.type}` :
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
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      {selected.courtsCount} {selected.courtsCount > 1 ? t('map', 'courts') : t('map', 'court')}
                    </Text>
                  </View>
                ) : null}
                {selected.itemType === 'players' ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{selected.role}</Text>
                  </View>
                ) : null}
                {selected.itemType === 'tournaments' ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{t('formats', selected.format)}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.selectedArrow}>
              <MaterialIcons name="arrow-forward" size={18} color={theme.primary} />
            </View>
          </Pressable>
          <Pressable style={styles.selectedClose} onPress={() => setSelected(null)}>
            <MaterialIcons name="close" size={16} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    ...theme.shadows.card,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  searchBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  searchBtnActive: { backgroundColor: theme.primary },
  searchRow: { marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, paddingHorizontal: 10, height: 40, gap: 6 },
  searchInput: { flex: 1, fontSize: 14, color: theme.textPrimary },
  searchCount: { fontSize: 11, color: theme.textSecondary, marginTop: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statItemDim: { opacity: 0.35 },
  statDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 3 },
  statValue: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 10, color: theme.textSecondary },
  filters: { paddingHorizontal: 16, paddingTop: 10, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.borderRadius.full, backgroundColor: 'rgba(255,255,255,0.95)', ...theme.shadows.card },
  chipActive: { backgroundColor: theme.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  chipTextActive: { color: '#FFF' },
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF', ...theme.shadows.card },
  // Selected card
  selectedCard: { position: 'absolute', left: 16, right: 16, backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, ...theme.shadows.cardElevated },
  selectedInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  selectedIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  selectedContent: { flex: 1 },
  selectedTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  selectedMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  selectedMetaText: { fontSize: 12, color: theme.textSecondary },
  selectedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: theme.backgroundSecondary, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: '600', color: theme.textSecondary },
  selectedArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  selectedClose: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  // List fallback
  listContainer: { flex: 1, paddingTop: 170 },
  listHeader: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 },
  listTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 8 },
  listSubtitle: { fontSize: 13, color: theme.textSecondary },
  listScroll: { paddingHorizontal: 16, gap: 8 },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, padding: 12, borderRadius: theme.borderRadius.md, ...theme.shadows.card },
  listIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  listContent: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  listMeta: { fontSize: 12, color: theme.textSecondary },
  listBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  listBadgeText: { fontSize: 10, fontWeight: '600' },
});
