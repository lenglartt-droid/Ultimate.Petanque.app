import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

type MarkerFilter = 'all' | 'terrains' | 'clubs' | 'tournaments' | 'players';

// Conditionally import map components based on platform
let MapViewComponent: React.ComponentType<any> | null = null;
let MarkerComponent: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapViewComponent = Maps.default;
  MarkerComponent = Maps.Marker;
}

// Web Map Component using static image as fallback
function WebMapFallback({ 
  clubs, 
  tournaments,
  terrains,
  players,
  showClubs, 
  showTournaments,
  showTerrains,
  showPlayers,
  onItemPress 
}: any) {
  const allItems = [
    ...(showTerrains ? terrains.map((t: any) => ({ ...t, itemType: 'terrain' })) : []),
    ...(showClubs ? clubs.map((c: any) => ({ ...c, itemType: 'club' })) : []),
    ...(showTournaments ? tournaments.filter((t: any) => t.status === 'À venir').map((t: any) => ({ ...t, itemType: 'tournament' })) : []),
    ...(showPlayers ? players.filter((p: any) => p.location).map((p: any) => ({ ...p, itemType: 'player' })) : []),
  ];

  const getTerrainTypeConfig = (type: string) => {
    return config.terrainTypes.find(t => t.id === type) || config.terrainTypes[0];
  };

  return (
    <View style={styles.webMapContainer}>
      <Image
        source={require('@/assets/images/map-marker.png')}
        style={styles.webMapImage}
        contentFit="contain"
      />
      <Text style={styles.webMapTitle}>Carte Interactive</Text>
      <Text style={styles.webMapSubtitle}>
        La carte est disponible sur l'application mobile
      </Text>
      
      <ScrollView 
        style={styles.webListContainer}
        contentContainerStyle={styles.webListContent}
        showsVerticalScrollIndicator={false}
      >
        {allItems.slice(0, 20).map((item: any, index: number) => {
          const typeConfig = item.itemType === 'terrain' ? getTerrainTypeConfig(item.type) : null;
          return (
            <Pressable 
              key={`${item.itemType}-${item.id}-${index}`}
              style={styles.webListItem}
              onPress={() => onItemPress(item, item.itemType)}
            >
              <View style={[
                styles.webListIcon,
                { backgroundColor: 
                  item.itemType === 'terrain' ? theme.accent :
                  item.itemType === 'club' ? config.map.markerColors.club :
                  item.itemType === 'player' ? theme.primary :
                  config.map.markerColors.tournament
                }
              ]}>
                <MaterialIcons 
                  name={
                    item.itemType === 'terrain' ? (typeConfig?.icon as any || 'sports-soccer') :
                    item.itemType === 'club' ? 'home' :
                    item.itemType === 'player' ? 'person' :
                    'emoji-events'
                  } 
                  size={16} 
                  color="#FFF" 
                />
              </View>
              <View style={styles.webListContentInner}>
                <Text style={styles.webListName}>{item.name}</Text>
                <Text style={styles.webListMeta}>
                  {item.itemType === 'terrain' ? `${item.city} • ${item.type}` :
                   item.itemType === 'club' ? item.city :
                   item.itemType === 'player' ? (item.location?.city || item.club || 'Sans lieu') :
                   item.location?.city}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Native Map Component
function NativeMap({ 
  clubs, 
  tournaments,
  terrains,
  players,
  showClubs, 
  showTournaments,
  showTerrains,
  showPlayers,
  onItemPress,
  onMapPress 
}: any) {
  if (!MapViewComponent || !MarkerComponent) {
    return <WebMapFallback {...{ clubs, tournaments, terrains, players, showClubs, showTournaments, showTerrains, showPlayers, onItemPress }} />;
  }

  const getTerrainTypeConfig = (type: string) => {
    return config.terrainTypes.find(t => t.id === type) || config.terrainTypes[0];
  };

  return (
    <MapViewComponent
      style={styles.map}
      initialRegion={config.map.defaultRegion}
      showsUserLocation
      showsMyLocationButton={false}
      onPress={onMapPress}
    >
      {/* Terrain Markers */}
      {showTerrains && terrains.map((terrain: any) => {
        const typeConfig = getTerrainTypeConfig(terrain.type);
        return (
          <MarkerComponent
            key={`terrain-${terrain.id}`}
            coordinate={terrain.location}
            onPress={() => onItemPress(terrain, 'terrain')}
          >
            <View style={[styles.marker, { backgroundColor: theme.accent }]}>
              <MaterialIcons name={typeConfig.icon as any} size={16} color="#FFF" />
            </View>
          </MarkerComponent>
        );
      })}

      {/* Club Markers */}
      {showClubs && clubs.map((club: any) => (
        <MarkerComponent
          key={`club-${club.id}`}
          coordinate={club.location}
          onPress={() => onItemPress(club, 'club')}
        >
          <View style={[styles.marker, { backgroundColor: config.map.markerColors.club }]}>
            <MaterialIcons name="home" size={16} color="#FFF" />
          </View>
        </MarkerComponent>
      ))}

      {/* Tournament Markers */}
      {showTournaments && tournaments.filter((t: any) => t.status === 'À venir').map((tournament: any) => (
        <MarkerComponent
          key={`tournament-${tournament.id}`}
          coordinate={tournament.location}
          onPress={() => onItemPress(tournament, 'tournament')}
        >
          <View style={[styles.marker, { backgroundColor: config.map.markerColors.tournament }]}>
            <MaterialIcons name="emoji-events" size={16} color="#FFF" />
          </View>
        </MarkerComponent>
      ))}

      {/* Player Markers */}
      {showPlayers && players.filter((p: any) => p.location).map((player: any) => (
        <MarkerComponent
          key={`player-${player.id}`}
          coordinate={player.location}
          onPress={() => onItemPress(player, 'player')}
        >
          <View style={[styles.marker, { backgroundColor: theme.primary }]}>
            <MaterialIcons name="person" size={16} color="#FFF" />
          </View>
        </MarkerComponent>
      ))}
    </MapViewComponent>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { clubs, tournaments, terrains, players } = useApp();
  const [activeFilter, setActiveFilter] = useState<MarkerFilter>('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Filter items with valid locations
  const terrainsWithLocation = terrains.filter(t => 
    t.location && (t.location.latitude !== 0 || t.location.longitude !== 0)
  );
  const clubsWithLocation = clubs.filter(c => 
    c.location && (c.location.latitude !== 0 || c.location.longitude !== 0)
  );
  const playersWithLocation = players.filter(p => 
    p.location && (p.location.latitude !== 0 || p.location.longitude !== 0)
  );
  const upcomingTournaments = tournaments.filter(t => t.status === 'À venir');

  const filters = [
    { id: 'all' as const, label: 'Tout', icon: 'layers' as const },
    { id: 'terrains' as const, label: 'Terrains', icon: 'sports-soccer' as const, color: theme.accent },
    { id: 'clubs' as const, label: 'Clubs', icon: 'home' as const, color: config.map.markerColors.club },
    { id: 'tournaments' as const, label: 'Tournois', icon: 'emoji-events' as const, color: config.map.markerColors.tournament },
    { id: 'players' as const, label: 'Joueurs', icon: 'person' as const, color: theme.primary },
  ];

  const handleMarkerPress = (item: any, type: string) => {
    setSelectedItem({ ...item, itemType: type });
  };

  const handleCardPress = () => {
    if (!selectedItem) return;
    
    switch (selectedItem.itemType) {
      case 'club':
        router.push(`/club/${selectedItem.id}`);
        break;
      case 'terrain':
        router.push(`/terrain/${selectedItem.id}`);
        break;
      case 'tournament':
        router.push(`/tournament/${selectedItem.id}`);
        break;
      case 'player':
        router.push(`/player/${selectedItem.id}`);
        break;
    }
    setSelectedItem(null);
  };

  const showClubs = activeFilter === 'all' || activeFilter === 'clubs';
  const showTournaments = activeFilter === 'all' || activeFilter === 'tournaments';
  const showTerrains = activeFilter === 'all' || activeFilter === 'terrains';
  const showPlayers = activeFilter === 'all' || activeFilter === 'players';

  const getTerrainTypeConfig = (type: string) => {
    return config.terrainTypes.find(t => t.id === type) || config.terrainTypes[0];
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      {Platform.OS === 'web' ? (
        <WebMapFallback
          clubs={clubsWithLocation}
          tournaments={upcomingTournaments}
          terrains={terrainsWithLocation}
          players={playersWithLocation}
          showClubs={showClubs}
          showTournaments={showTournaments}
          showTerrains={showTerrains}
          showPlayers={showPlayers}
          onItemPress={handleMarkerPress}
        />
      ) : (
        <NativeMap
          clubs={clubsWithLocation}
          tournaments={upcomingTournaments}
          terrains={terrainsWithLocation}
          players={playersWithLocation}
          showClubs={showClubs}
          showTournaments={showTournaments}
          showTerrains={showTerrains}
          showPlayers={showPlayers}
          onItemPress={handleMarkerPress}
          onMapPress={() => setSelectedItem(null)}
        />
      )}

      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.headerContainer}>
        <Animated.View 
          entering={FadeInDown.duration(400)}
          style={styles.header}
        >
          <Text style={styles.title}>Carte</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: theme.accent }]} />
              <Text style={styles.statText}>{terrainsWithLocation.length} terrains</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: config.map.markerColors.club }]} />
              <Text style={styles.statText}>{clubsWithLocation.length} clubs</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: config.map.markerColors.tournament }]} />
              <Text style={styles.statText}>{upcomingTournaments.length} tournois</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: theme.primary }]} />
              <Text style={styles.statText}>{playersWithLocation.length} joueurs</Text>
            </View>
          </View>
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
            {filters.map(filter => (
              <Pressable
                key={filter.id}
                style={[
                  styles.filterButton,
                  activeFilter === filter.id && styles.filterButtonActive,
                  filter.color && activeFilter === filter.id && { backgroundColor: filter.color }
                ]}
                onPress={() => {
                  setActiveFilter(filter.id);
                  Haptics.selectionAsync();
                }}
              >
                <MaterialIcons 
                  name={filter.icon} 
                  size={18} 
                  color={activeFilter === filter.id ? '#FFF' : theme.textSecondary} 
                />
                <Text style={[
                  styles.filterText,
                  activeFilter === filter.id && styles.filterTextActive
                ]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </SafeAreaView>

      {/* Selected Item Card */}
      {selectedItem && (
        <Animated.View 
          entering={FadeIn.duration(200)}
          style={[styles.selectedCard, { bottom: insets.bottom + 100 }]}
        >
          <Pressable style={styles.selectedCardInner} onPress={handleCardPress}>
            <View style={[
              styles.selectedAvatar,
              { backgroundColor: 
                selectedItem.itemType === 'terrain' ? theme.accent :
                selectedItem.itemType === 'club' ? config.map.markerColors.club :
                selectedItem.itemType === 'player' ? theme.primary :
                config.map.markerColors.tournament
              }
            ]}>
              <MaterialIcons 
                name={
                  selectedItem.itemType === 'terrain' ? (getTerrainTypeConfig(selectedItem.type)?.icon as any || 'sports-soccer') :
                  selectedItem.itemType === 'club' ? 'home' :
                  selectedItem.itemType === 'player' ? 'person' :
                  'emoji-events'
                } 
                size={24} 
                color="#FFF" 
              />
            </View>
            <View style={styles.selectedContent}>
              <Text style={styles.selectedTitle}>{selectedItem.name}</Text>
              {selectedItem.itemType === 'terrain' && (
                <>
                  <Text style={styles.selectedMeta}>{selectedItem.city} • {selectedItem.type}</Text>
                  <Text style={styles.selectedMeta}>
                    {selectedItem.courtsCount} terrain{selectedItem.courtsCount > 1 ? 's' : ''}
                    {selectedItem.lighting ? ' • Éclairage' : ''}
                    {selectedItem.covered ? ' • Couvert' : ''}
                  </Text>
                </>
              )}
              {selectedItem.itemType === 'club' && (
                <>
                  <Text style={styles.selectedMeta}>{selectedItem.city}</Text>
                  <Text style={styles.selectedMeta}>{selectedItem.membersCount} membres</Text>
                </>
              )}
              {selectedItem.itemType === 'tournament' && (
                <>
                  <Text style={styles.selectedMeta}>
                    {new Date(selectedItem.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </Text>
                  <Text style={styles.selectedMeta}>{selectedItem.format} • {selectedItem.location?.city}</Text>
                </>
              )}
              {selectedItem.itemType === 'player' && (
                <>
                  <Text style={styles.selectedMeta}>{selectedItem.location?.city || selectedItem.club || 'Sans lieu'}</Text>
                  <Text style={styles.selectedMeta}>{selectedItem.role} • {selectedItem.level}</Text>
                </>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
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
  header: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.cardElevated,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  filtersContainer: {
    paddingTop: 12,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.95)',
    gap: 6,
    ...theme.shadows.card,
  },
  filterButtonActive: {
    backgroundColor: theme.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterTextActive: {
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
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedContent: {
    flex: 1,
  },
  selectedTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  selectedMeta: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  webMapContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 180,
    paddingHorizontal: 16,
  },
  webMapImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
    opacity: 0.6,
  },
  webMapTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  webMapSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  webListContainer: {
    width: '100%',
    maxWidth: 500,
    flex: 1,
  },
  webListContent: {
    paddingBottom: 100,
  },
  webListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  webListIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  webListContentInner: {
    flex: 1,
  },
  webListName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  webListMeta: {
    fontSize: 13,
    color: theme.textSecondary,
  },
});
