import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

type MarkerFilter = 'all' | 'clubs' | 'players' | 'tournaments';

// Conditionally import map components based on platform
let MapViewComponent: React.ComponentType<any> | null = null;
let MarkerComponent: React.ComponentType<any> | null = null;

if (Platform.OS !== 'web') {
  // Only import on native platforms
  const Maps = require('react-native-maps');
  MapViewComponent = Maps.default;
  MarkerComponent = Maps.Marker;
}

// Web Map Component using static image as fallback
function WebMapFallback({ 
  clubs, 
  players, 
  tournaments, 
  showClubs, 
  showPlayers, 
  showTournaments,
  onItemPress 
}: any) {
  const allItems = [
    ...(showClubs ? clubs.map((c: any) => ({ ...c, type: 'club' })) : []),
    ...(showPlayers ? players.filter((p: any) => p.location).map((p: any) => ({ ...p, type: 'player' })) : []),
    ...(showTournaments ? tournaments.filter((t: any) => t.status === 'À venir').map((t: any) => ({ ...t, type: 'tournament' })) : []),
  ];

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
      
      {/* List view fallback */}
      <View style={styles.webListContainer}>
        {allItems.slice(0, 10).map((item: any) => (
          <Pressable 
            key={`${item.type}-${item.id}`}
            style={styles.webListItem}
            onPress={() => onItemPress(item, item.type)}
          >
            <View style={[
              styles.webListIcon,
              { backgroundColor: item.type === 'club' 
                ? config.map.markerColors.club 
                : item.type === 'player'
                  ? config.map.markerColors.player
                  : config.map.markerColors.tournament
              }
            ]}>
              <MaterialIcons 
                name={item.type === 'club' ? 'home' : item.type === 'player' ? 'person' : 'emoji-events'} 
                size={16} 
                color="#FFF" 
              />
            </View>
            <View style={styles.webListContent}>
              <Text style={styles.webListName}>{item.name}</Text>
              <Text style={styles.webListMeta}>
                {item.type === 'club' ? item.city : item.type === 'player' ? item.location?.city : item.location?.city}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Native Map Component
function NativeMap({ 
  clubs, 
  players, 
  tournaments, 
  showClubs, 
  showPlayers, 
  showTournaments,
  onItemPress,
  onMapPress 
}: any) {
  if (!MapViewComponent || !MarkerComponent) {
    return <WebMapFallback {...{ clubs, players, tournaments, showClubs, showPlayers, showTournaments, onItemPress }} />;
  }

  return (
    <MapViewComponent
      style={styles.map}
      initialRegion={config.map.defaultRegion}
      showsUserLocation
      showsMyLocationButton={false}
      onPress={onMapPress}
    >
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

      {/* Player Markers */}
      {showPlayers && players.filter((p: any) => p.location).map((player: any) => (
        <MarkerComponent
          key={`player-${player.id}`}
          coordinate={player.location}
          onPress={() => onItemPress(player, 'player')}
        >
          <View style={[styles.marker, { backgroundColor: config.map.markerColors.player }]}>
            <MaterialIcons name="person" size={16} color="#FFF" />
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
    </MapViewComponent>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { players, clubs, tournaments } = useApp();
  const [activeFilter, setActiveFilter] = useState<MarkerFilter>('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const filters = [
    { id: 'all' as const, label: 'Tout', icon: 'layers' as const },
    { id: 'clubs' as const, label: 'Clubs', icon: 'home' as const, color: config.map.markerColors.club },
    { id: 'players' as const, label: 'Joueurs', icon: 'person' as const, color: config.map.markerColors.player },
    { id: 'tournaments' as const, label: 'Tournois', icon: 'emoji-events' as const, color: config.map.markerColors.tournament },
  ];

  const handleMarkerPress = (item: any, type: string) => {
    setSelectedItem({ ...item, type });
  };

  const handleCardPress = () => {
    if (!selectedItem) return;
    
    switch (selectedItem.type) {
      case 'club':
        router.push(`/club/${selectedItem.id}`);
        break;
      case 'player':
        router.push(`/player/${selectedItem.id}`);
        break;
      case 'tournament':
        router.push(`/tournament/${selectedItem.id}`);
        break;
    }
    setSelectedItem(null);
  };

  const showClubs = activeFilter === 'all' || activeFilter === 'clubs';
  const showPlayers = activeFilter === 'all' || activeFilter === 'players';
  const showTournaments = activeFilter === 'all' || activeFilter === 'tournaments';

  return (
    <View style={styles.container}>
      {/* Map */}
      {Platform.OS === 'web' ? (
        <WebMapFallback
          clubs={clubs}
          players={players}
          tournaments={tournaments}
          showClubs={showClubs}
          showPlayers={showPlayers}
          showTournaments={showTournaments}
          onItemPress={handleMarkerPress}
        />
      ) : (
        <NativeMap
          clubs={clubs}
          players={players}
          tournaments={tournaments}
          showClubs={showClubs}
          showPlayers={showPlayers}
          showTournaments={showTournaments}
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
              <View style={[styles.statDot, { backgroundColor: config.map.markerColors.club }]} />
              <Text style={styles.statText}>{clubs.length} clubs</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: config.map.markerColors.player }]} />
              <Text style={styles.statText}>{players.filter(p => p.location).length} joueurs</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: config.map.markerColors.tournament }]} />
              <Text style={styles.statText}>{tournaments.filter(t => t.status === 'À venir').length} tournois</Text>
            </View>
          </View>
        </Animated.View>

        {/* Filters */}
        <Animated.View 
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.filtersContainer}
        >
          {filters.map(filter => (
            <Pressable
              key={filter.id}
              style={[
                styles.filterButton,
                activeFilter === filter.id && styles.filterButtonActive,
                filter.color && activeFilter === filter.id && { backgroundColor: filter.color }
              ]}
              onPress={() => setActiveFilter(filter.id)}
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
              { backgroundColor: selectedItem.type === 'club' 
                ? config.map.markerColors.club 
                : selectedItem.type === 'player'
                  ? config.map.markerColors.player
                  : config.map.markerColors.tournament
              }
            ]}>
              <MaterialIcons 
                name={selectedItem.type === 'club' ? 'home' : selectedItem.type === 'player' ? 'person' : 'emoji-events'} 
                size={24} 
                color="#FFF" 
              />
            </View>
            <View style={styles.selectedContent}>
              <Text style={styles.selectedTitle}>
                {selectedItem.name}
              </Text>
              {selectedItem.type === 'club' && (
                <>
                  <Text style={styles.selectedMeta}>{selectedItem.city}</Text>
                  <Text style={styles.selectedMeta}>{selectedItem.membersCount} membres</Text>
                </>
              )}
              {selectedItem.type === 'player' && (
                <>
                  <Text style={styles.selectedMeta}>{selectedItem.club || 'Sans club'}</Text>
                  <Text style={styles.selectedMeta}>{selectedItem.stats.winRate}% victoires</Text>
                </>
              )}
              {selectedItem.type === 'tournament' && (
                <>
                  <Text style={styles.selectedMeta}>
                    {new Date(selectedItem.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </Text>
                  <Text style={styles.selectedMeta}>{selectedItem.format} • {selectedItem.type}</Text>
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
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
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
  // Web fallback styles
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
  webListContent: {
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
