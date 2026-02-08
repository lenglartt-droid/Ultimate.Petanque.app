import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

const { width: screenWidth } = Dimensions.get('window');

type MarkerType = 'all' | 'terrains' | 'clubs' | 'tournaments' | 'players';

// Marker configuration
const MARKER_CONFIG: Record<Exclude<MarkerType, 'all'>, { label: string; icon: string; color: string }> = {
  terrains: { label: 'Terrains', icon: 'sports-soccer', color: theme.success },
  clubs: { label: 'Clubs', icon: 'home', color: theme.accent },
  tournaments: { label: 'Tournois', icon: 'emoji-events', color: theme.carreauColor },
  players: { label: 'Joueurs', icon: 'person', color: theme.primary },
};

// Conditionally import map components based on platform
let MapViewComponent: React.ComponentType<any> | null = null;
let MarkerComponent: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapViewComponent = Maps.default;
  MarkerComponent = Maps.Marker;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { clubs, tournaments, terrains, players } = useApp();
  const [activeFilter, setActiveFilter] = useState<MarkerType>('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showLegend, setShowLegend] = useState(false);

  // Filter items with valid locations
  const data = useMemo(() => {
    const terrainsWithLocation = terrains.filter(t => 
      t.location && (t.location.latitude !== 0 || t.location.longitude !== 0)
    );
    const clubsWithLocation = clubs.filter(c => 
      c.location && (c.location.latitude !== 0 || c.location.longitude !== 0)
    );
    const playersWithLocation = players.filter(p => 
      p.location && (p.location.latitude !== 0 || p.location.longitude !== 0)
    );
    // Show all tournaments with valid locations (not just upcoming)
    const tournamentsWithLocation = tournaments.filter(t => 
      t.location && (t.location.latitude !== 0 || t.location.longitude !== 0)
    );

    return {
      terrains: terrainsWithLocation,
      clubs: clubsWithLocation,
      players: playersWithLocation,
      tournaments: tournamentsWithLocation,
      total: terrainsWithLocation.length + clubsWithLocation.length + playersWithLocation.length + tournamentsWithLocation.length,
    };
  }, [terrains, clubs, players, tournaments]);

  // Visibility flags
  const visibility = useMemo(() => ({
    terrains: activeFilter === 'all' || activeFilter === 'terrains',
    clubs: activeFilter === 'all' || activeFilter === 'clubs',
    tournaments: activeFilter === 'all' || activeFilter === 'tournaments',
    players: activeFilter === 'all' || activeFilter === 'players',
  }), [activeFilter]);

  // All visible items for list view
  const visibleItems = useMemo(() => {
    const items: any[] = [];
    if (visibility.terrains) items.push(...data.terrains.map(t => ({ ...t, itemType: 'terrains' })));
    if (visibility.clubs) items.push(...data.clubs.map(c => ({ ...c, itemType: 'clubs' })));
    if (visibility.tournaments) items.push(...data.tournaments.map(t => ({ ...t, itemType: 'tournaments' })));
    if (visibility.players) items.push(...data.players.map(p => ({ ...p, itemType: 'players' })));
    return items;
  }, [data, visibility]);

  const handleMarkerPress = (item: any, type: string) => {
    Haptics.selectionAsync();
    setSelectedItem({ ...item, itemType: type });
  };

  const handleCardPress = () => {
    if (!selectedItem) return;
    const routes: Record<string, string> = {
      clubs: `/club/${selectedItem.id}`,
      terrains: `/terrain/${selectedItem.id}`,
      tournaments: `/tournament/${selectedItem.id}`,
      players: `/player/${selectedItem.id}`,
    };
    router.push(routes[selectedItem.itemType] as any);
    setSelectedItem(null);
  };

  const getTerrainTypeConfig = (type: string) => {
    return config.terrainTypes.find(t => t.id === type) || config.terrainTypes[0];
  };

  // Native Map Component
  const renderNativeMap = () => {
    if (!MapViewComponent || !MarkerComponent) {
      return renderWebFallback();
    }

    return (
      <MapViewComponent
        style={styles.map}
        initialRegion={config.map.defaultRegion}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={() => setSelectedItem(null)}
      >
        {/* Terrain Markers */}
        {visibility.terrains && data.terrains.map((terrain) => {
          const typeConfig = getTerrainTypeConfig(terrain.type);
          return (
            <MarkerComponent
              key={`terrain-${terrain.id}`}
              coordinate={terrain.location}
              onPress={() => handleMarkerPress(terrain, 'terrains')}
            >
              <View style={[styles.marker, { backgroundColor: MARKER_CONFIG.terrains.color }]}>
                <MaterialIcons name={typeConfig.icon as any} size={16} color="#FFF" />
              </View>
            </MarkerComponent>
          );
        })}

        {/* Club Markers */}
        {visibility.clubs && data.clubs.map((club) => (
          <MarkerComponent
            key={`club-${club.id}`}
            coordinate={club.location}
            onPress={() => handleMarkerPress(club, 'clubs')}
          >
            <View style={[styles.marker, { backgroundColor: MARKER_CONFIG.clubs.color }]}>
              <MaterialIcons name="home" size={16} color="#FFF" />
            </View>
          </MarkerComponent>
        ))}

        {/* Tournament Markers */}
        {visibility.tournaments && data.tournaments.map((tournament) => (
          <MarkerComponent
            key={`tournament-${tournament.id}`}
            coordinate={tournament.location}
            onPress={() => handleMarkerPress(tournament, 'tournaments')}
          >
            <View style={[styles.marker, { backgroundColor: MARKER_CONFIG.tournaments.color }]}>
              <MaterialIcons name="emoji-events" size={16} color="#FFF" />
            </View>
          </MarkerComponent>
        ))}

        {/* Player Markers */}
        {visibility.players && data.players.map((player) => (
          <MarkerComponent
            key={`player-${player.id}`}
            coordinate={player.location}
            onPress={() => handleMarkerPress(player, 'players')}
          >
            <View style={[styles.marker, { backgroundColor: MARKER_CONFIG.players.color }]}>
              <MaterialIcons name="person" size={16} color="#FFF" />
            </View>
          </MarkerComponent>
        ))}
      </MapViewComponent>
    );
  };

  // Web Fallback with List
  const renderWebFallback = () => (
    <View style={styles.webContainer}>
      <View style={styles.webHeader}>
        <Image
          source={require('@/assets/images/map-marker.png')}
          style={styles.webMapIcon}
          contentFit="contain"
        />
        <Text style={styles.webTitle}>Carte Interactive</Text>
        <Text style={styles.webSubtitle}>
          Disponible sur l'application mobile
        </Text>
      </View>
      
      <ScrollView 
        style={styles.webList}
        contentContainerStyle={[styles.webListContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {visibleItems.slice(0, 30).map((item, index) => {
          const markerConfig = MARKER_CONFIG[item.itemType as keyof typeof MARKER_CONFIG];
          const terrainConfig = item.itemType === 'terrains' ? getTerrainTypeConfig(item.type) : null;
          
          return (
            <Pressable 
              key={`${item.itemType}-${item.id}-${index}`}
              style={styles.webListItem}
              onPress={() => handleMarkerPress(item, item.itemType)}
            >
              <View style={[styles.webListIcon, { backgroundColor: markerConfig.color }]}>
                <MaterialIcons 
                  name={(terrainConfig?.icon || markerConfig.icon) as any} 
                  size={18} 
                  color="#FFF" 
                />
              </View>
              <View style={styles.webListItemContent}>
                <Text style={styles.webListName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.webListMeta} numberOfLines={1}>
                  {item.itemType === 'terrains' ? `${item.city} • ${item.type}` :
                   item.itemType === 'clubs' ? item.city :
                   item.itemType === 'players' ? (item.location?.city || item.club || 'Sans localisation') :
                   item.location?.city}
                </Text>
              </View>
              <View style={[styles.webListBadge, { backgroundColor: markerConfig.color + '15' }]}>
                <Text style={[styles.webListBadgeText, { color: markerConfig.color }]}>
                  {markerConfig.label.slice(0, -1)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Map */}
      {Platform.OS === 'web' ? renderWebFallback() : renderNativeMap()}

      {/* Header Overlay */}
      <SafeAreaView edges={['top']} style={styles.headerContainer}>
        {/* Stats Card */}
        <Animated.View 
          entering={FadeInDown.duration(400)}
          style={styles.statsCard}
        >
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Carte</Text>
            <Pressable 
              style={styles.legendButton}
              onPress={() => {
                Haptics.selectionAsync();
                setShowLegend(!showLegend);
              }}
            >
              <MaterialIcons 
                name={showLegend ? 'expand-less' : 'info-outline'} 
                size={20} 
                color={theme.textSecondary} 
              />
            </Pressable>
          </View>
          
          <View style={styles.statsGrid}>
            {(Object.keys(MARKER_CONFIG) as Array<keyof typeof MARKER_CONFIG>).map(key => {
              const cfg = MARKER_CONFIG[key];
              const count = data[key].length;
              const isActive = activeFilter === 'all' || activeFilter === key;
              return (
                <View key={key} style={[styles.statItem, !isActive && styles.statItemInactive]}>
                  <View style={[styles.statDot, { backgroundColor: cfg.color }]} />
                  <Text style={styles.statValue}>{count}</Text>
                  <Text style={styles.statLabel}>{cfg.label.toLowerCase()}</Text>
                </View>
              );
            })}
          </View>

          {/* Legend */}
          {showLegend && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.legendContainer}>
              <View style={styles.legendDivider} />
              {(Object.keys(MARKER_CONFIG) as Array<keyof typeof MARKER_CONFIG>).map(key => {
                const cfg = MARKER_CONFIG[key];
                return (
                  <View key={key} style={styles.legendItem}>
                    <View style={[styles.legendMarker, { backgroundColor: cfg.color }]}>
                      <MaterialIcons name={cfg.icon as any} size={12} color="#FFF" />
                    </View>
                    <Text style={styles.legendText}>{cfg.label}</Text>
                  </View>
                );
              })}
            </Animated.View>
          )}
        </Animated.View>

        {/* Filters */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.filtersContainer}
        >
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersScroll}
          >
            <Pressable
              style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveFilter('all');
                setSelectedItem(null);
              }}
            >
              <MaterialIcons 
                name="layers" 
                size={16} 
                color={activeFilter === 'all' ? '#FFF' : theme.textSecondary} 
              />
              <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
                Tout ({data.total})
              </Text>
            </Pressable>
            
            {(Object.keys(MARKER_CONFIG) as Array<keyof typeof MARKER_CONFIG>).map(key => {
              const cfg = MARKER_CONFIG[key];
              const count = data[key].length;
              const isActive = activeFilter === key;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.filterChip, 
                    isActive && styles.filterChipActive,
                    isActive && { backgroundColor: cfg.color }
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveFilter(key);
                    setSelectedItem(null);
                  }}
                >
                  <MaterialIcons 
                    name={cfg.icon as any} 
                    size={16} 
                    color={isActive ? '#FFF' : theme.textSecondary} 
                  />
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {cfg.label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>

      {/* Selected Item Card */}
      {selectedItem && (
        <Animated.View 
          entering={FadeInUp.duration(300)}
          style={[styles.selectedCard, { bottom: insets.bottom + 100 }]}
        >
          <Pressable style={styles.selectedCardInner} onPress={handleCardPress}>
            <View style={[
              styles.selectedAvatar,
              { backgroundColor: MARKER_CONFIG[selectedItem.itemType as keyof typeof MARKER_CONFIG]?.color || theme.primary }
            ]}>
              <MaterialIcons 
                name={
                  selectedItem.itemType === 'terrains' 
                    ? (getTerrainTypeConfig(selectedItem.type)?.icon as any) 
                    : (MARKER_CONFIG[selectedItem.itemType as keyof typeof MARKER_CONFIG]?.icon as any)
                } 
                size={24} 
                color="#FFF" 
              />
            </View>
            
            <View style={styles.selectedContent}>
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedTitle} numberOfLines={1}>{selectedItem.name}</Text>
                <View style={[
                  styles.selectedTypeBadge, 
                  { backgroundColor: MARKER_CONFIG[selectedItem.itemType as keyof typeof MARKER_CONFIG]?.color + '15' }
                ]}>
                  <Text style={[
                    styles.selectedTypeBadgeText,
                    { color: MARKER_CONFIG[selectedItem.itemType as keyof typeof MARKER_CONFIG]?.color }
                  ]}>
                    {MARKER_CONFIG[selectedItem.itemType as keyof typeof MARKER_CONFIG]?.label.slice(0, -1)}
                  </Text>
                </View>
              </View>
              
              {selectedItem.itemType === 'terrains' && (
                <>
                  <View style={styles.selectedMeta}>
                    <MaterialIcons name="place" size={14} color={theme.textMuted} />
                    <Text style={styles.selectedMetaText}>{selectedItem.city} • {selectedItem.type}</Text>
                  </View>
                  <View style={styles.selectedTags}>
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>
                        {selectedItem.courtsCount} terrain{selectedItem.courtsCount > 1 ? 's' : ''}
                      </Text>
                    </View>
                    {selectedItem.lighting && (
                      <View style={[styles.selectedTag, { backgroundColor: theme.warning + '15' }]}>
                        <MaterialIcons name="lightbulb" size={10} color={theme.warning} />
                        <Text style={[styles.selectedTagText, { color: theme.warning }]}>Éclairé</Text>
                      </View>
                    )}
                    {selectedItem.covered && (
                      <View style={[styles.selectedTag, { backgroundColor: theme.primary + '15' }]}>
                        <MaterialIcons name="roofing" size={10} color={theme.primary} />
                        <Text style={[styles.selectedTagText, { color: theme.primary }]}>Couvert</Text>
                      </View>
                    )}
                  </View>
                </>
              )}
              
              {selectedItem.itemType === 'clubs' && (
                <>
                  <View style={styles.selectedMeta}>
                    <MaterialIcons name="place" size={14} color={theme.textMuted} />
                    <Text style={styles.selectedMetaText}>{selectedItem.city}, {selectedItem.country || 'France'}</Text>
                  </View>
                  <View style={styles.selectedTags}>
                    <View style={styles.selectedTag}>
                      <MaterialIcons name="people" size={10} color={theme.textSecondary} />
                      <Text style={styles.selectedTagText}>{selectedItem.membersCount} membres</Text>
                    </View>
                  </View>
                </>
              )}
              
              {selectedItem.itemType === 'tournaments' && (
                <>
                  <View style={styles.selectedMeta}>
                    <MaterialIcons name="event" size={14} color={theme.textMuted} />
                    <Text style={styles.selectedMetaText}>
                      {new Date(selectedItem.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                    </Text>
                  </View>
                  <View style={styles.selectedTags}>
                    <View style={[styles.selectedTag, { backgroundColor: theme.primary + '15' }]}>
                      <Text style={[styles.selectedTagText, { color: theme.primary }]}>{selectedItem.status}</Text>
                    </View>
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>{selectedItem.format}</Text>
                    </View>
                  </View>
                </>
              )}
              
              {selectedItem.itemType === 'players' && (
                <>
                  <View style={styles.selectedMeta}>
                    <MaterialIcons name="place" size={14} color={theme.textMuted} />
                    <Text style={styles.selectedMetaText}>
                      {selectedItem.location?.city || selectedItem.club || 'Sans localisation'}
                    </Text>
                  </View>
                  <View style={styles.selectedTags}>
                    <View style={[styles.selectedTag, { backgroundColor: theme.primary + '15' }]}>
                      <Text style={[styles.selectedTagText, { color: theme.primary }]}>{selectedItem.role}</Text>
                    </View>
                    <View style={styles.selectedTag}>
                      <Text style={styles.selectedTagText}>{selectedItem.level}</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
            
            <View style={styles.selectedAction}>
              <MaterialIcons name="arrow-forward" size={20} color={theme.primary} />
            </View>
          </Pressable>
          
          {/* Close button */}
          <Pressable 
            style={styles.selectedCloseButton}
            onPress={() => setSelectedItem(null)}
          >
            <MaterialIcons name="close" size={18} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.cardElevated,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  legendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statItemInactive: {
    opacity: 0.4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  legendContainer: {
    marginTop: 12,
  },
  legendDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  legendMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  filtersContainer: {
    marginTop: 12,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.95)',
    ...theme.shadows.card,
  },
  filterChipActive: {
    backgroundColor: theme.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  marker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    ...theme.shadows.cardElevated,
  },
  selectedCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.cardElevated,
  },
  selectedCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  selectedAvatar: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  selectedContent: {
    flex: 1,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  selectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  selectedTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  selectedTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  selectedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  selectedMetaText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  selectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
  },
  selectedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  selectedAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  selectedCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Web fallback styles
  webContainer: {
    flex: 1,
    paddingTop: 180,
  },
  webHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  webMapIcon: {
    width: 80,
    height: 80,
    marginBottom: 12,
    opacity: 0.5,
  },
  webTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 6,
  },
  webSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  webList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  webListContent: {
    gap: 8,
  },
  webListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.card,
  },
  webListIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  webListItemContent: {
    flex: 1,
  },
  webListName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  webListMeta: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  webListBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  webListBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
