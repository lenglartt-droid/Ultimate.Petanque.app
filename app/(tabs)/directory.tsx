import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { Terrain } from '@/services/mockData';
import { TerrainType } from '@/constants/config';

type DirectoryTab = 'players' | 'clubs' | 'tournaments' | 'terrains';
type TournamentStatus = 'all' | 'À venir' | 'En cours' | 'Terminé';

export default function DirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { players, clubs, tournaments, terrains, selfPlayer, favoriteTerrainIds } = useApp();
  const [activeTab, setActiveTab] = useState<DirectoryTab>('players');
  const [searchQuery, setSearchQuery] = useState('');
  const [terrainTypeFilter, setTerrainTypeFilter] = useState<TerrainType | 'all'>('all');
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState<TournamentStatus>('all');

  const tabs = useMemo(() => [
    { id: 'players' as const, label: 'Joueurs', icon: 'person' as const, count: players.length },
    { id: 'clubs' as const, label: 'Clubs', icon: 'home' as const, count: clubs.length },
    { id: 'terrains' as const, label: 'Terrains', icon: 'sports-soccer' as const, count: terrains.length },
    { id: 'tournaments' as const, label: 'Tournois', icon: 'emoji-events' as const, count: tournaments.length },
  ], [players.length, clubs.length, terrains.length, tournaments.length]);

  // Filter players and put selfPlayer at the top
  const filteredPlayers = useMemo(() => {
    const filtered = players.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.club?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // If selfPlayer exists and matches filter, put it at the top
    if (selfPlayer) {
      const selfIndex = filtered.findIndex(p => p.id === selfPlayer.id);
      if (selfIndex > 0) {
        const [self] = filtered.splice(selfIndex, 1);
        filtered.unshift(self);
      }
    }
    
    return filtered;
  }, [players, searchQuery, selfPlayer]);

  const filteredClubs = clubs.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.location.city.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = tournamentStatusFilter === 'all' || t.status === tournamentStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [tournaments, searchQuery, tournamentStatusFilter]);

  const filteredTerrains = useMemo(() => {
    return terrains.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = terrainTypeFilter === 'all' || t.type === terrainTypeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [terrains, searchQuery, terrainTypeFilter]);

  // Get terrain type config for display
  const getTerrainTypeConfig = (type: string) => {
    return config.terrainTypes.find(t => t.id === type) || config.terrainTypes[0];
  };

  // Terrain type filter options
  const terrainTypeFilters = [
    { id: 'all' as const, label: 'Tous', icon: 'layers' as const },
    ...config.terrainTypes.map(t => ({
      id: t.id as TerrainType,
      label: t.label,
      icon: t.icon as keyof typeof MaterialIcons.glyphMap,
    })),
  ];

  // Tournament status filter options
  const tournamentStatusFilters: { id: TournamentStatus; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
    { id: 'all', label: 'Tous', icon: 'layers' },
    { id: 'À venir', label: 'À venir', icon: 'event' },
    { id: 'En cours', label: 'En cours', icon: 'play-circle' },
    { id: 'Terminé', label: 'Terminé', icon: 'check-circle' },
  ];

  const renderPlayer = ({ item }: { item: typeof players[0] }) => {
    const isSelf = selfPlayer && item.id === selfPlayer.id;
    
    return (
      <Pressable
        style={[styles.card, isSelf && styles.selfCard]}
        onPress={() => isSelf ? router.push('/player/me') : router.push(`/player/${item.id}`)}
      >
        <View style={[styles.avatar, { backgroundColor: isSelf ? theme.primary : theme.primary }]}>
          <Text style={styles.avatarText}>
            {item.name.split(' ').map(n => n[0]).join('')}
          </Text>
          {isSelf && (
            <View style={styles.selfAvatarBadge}>
              <MaterialIcons name="verified" size={16} color={theme.primary} />
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, isSelf && styles.selfCardTitle]}>{item.name}</Text>
            {isSelf && (
              <View style={styles.moiBadge}>
                <Text style={styles.moiBadgeText}>MOI</Text>
              </View>
            )}
          </View>
          <View style={styles.cardMeta}>
            <MaterialIcons name="home" size={14} color={theme.textSecondary} />
            <Text style={styles.cardMetaText}>{item.club || 'Sans club'}</Text>
          </View>
          <View style={styles.cardBadges}>
            <View style={[styles.badge, { backgroundColor: theme.primaryLight + '30' }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>{item.role}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.successLight }]}>
              <Text style={[styles.badgeText, { color: theme.success }]}>{item.stats.winRate}% W</Text>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={isSelf ? theme.primary : theme.textMuted} />
      </Pressable>
    );
  };

  const renderClub = ({ item }: { item: typeof clubs[0] }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/club/${item.id}`)}
    >
      <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
        <MaterialIcons name="home" size={24} color="#FFF" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.cardMeta}>
          <MaterialIcons name="place" size={14} color={theme.textSecondary} />
          <Text style={styles.cardMetaText}>{item.city}</Text>
        </View>
        <View style={styles.cardBadges}>
          <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
              {item.membersCount} membres
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
              Depuis {item.foundedYear}
            </Text>
          </View>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
    </Pressable>
  );

  const renderTournament = ({ item }: { item: typeof tournaments[0] }) => {
    const statusColors = {
      'À venir': { bg: theme.primaryLight + '30', text: theme.primary },
      'En cours': { bg: theme.warningLight, text: theme.warning },
      'Terminé': { bg: theme.backgroundSecondary, text: theme.textSecondary },
    };
    const colors = statusColors[item.status];

    return (
      <Pressable
        style={styles.card}
        onPress={() => router.push(`/tournament/${item.id}`)}
      >
        <View style={[styles.avatar, { backgroundColor: theme.carreauColor }]}>
          <MaterialIcons name="emoji-events" size={24} color="#FFF" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <MaterialIcons name="event" size={14} color={theme.textSecondary} />
            <Text style={styles.cardMetaText}>
              {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </Text>
          </View>
          {item.terrainName ? (
            <View style={styles.cardMeta}>
              <MaterialIcons name="sports-soccer" size={14} color={theme.textSecondary} />
              <Text style={styles.cardMetaText}>{item.terrainName}</Text>
            </View>
          ) : (
            <View style={styles.cardMeta}>
              <MaterialIcons name="place" size={14} color={theme.textSecondary} />
              <Text style={styles.cardMetaText}>{item.location.city}</Text>
            </View>
          )}
          <View style={styles.cardBadges}>
            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>{item.status}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.badgeText, { color: theme.textSecondary }]}>{item.format}</Text>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
      </Pressable>
    );
  };

  const renderTerrain = ({ item }: { item: Terrain }) => {
    const typeConfig = getTerrainTypeConfig(item.type);
    const isFavorite = favoriteTerrainIds.includes(item.id);
    const typeColors: Record<string, { bg: string; text: string }> = {
      'Stabilisé': { bg: theme.primary + '20', text: theme.primary },
      'Graviers': { bg: theme.warning + '20', text: theme.warning },
      'Sable': { bg: '#F59E0B20', text: '#D97706' },
      'Cailloux': { bg: theme.textSecondary + '20', text: theme.textSecondary },
      'Terre battue': { bg: theme.success + '20', text: theme.success },
    };
    const colors = typeColors[item.type] || typeColors['Stabilisé'];

    return (
      <Pressable
        style={[styles.card, isFavorite && styles.favoriteCard]}
        onPress={() => router.push(`/terrain/${item.id}`)}
      >
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <MaterialIcons name={typeConfig.icon as any} size={24} color="#FFF" />
          {isFavorite && (
            <View style={styles.favoriteAvatarBadge}>
              <MaterialIcons name="favorite" size={12} color={theme.error} />
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <MaterialIcons name="place" size={14} color={theme.textSecondary} />
            <Text style={styles.cardMetaText}>{item.city}</Text>
          </View>
          {item.clubName && (
            <View style={styles.cardMeta}>
              <MaterialIcons name="home" size={14} color={theme.textSecondary} />
              <Text style={styles.cardMetaText}>{item.clubName}</Text>
            </View>
          )}
          <View style={styles.cardBadges}>
            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>{item.type}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.badgeText, { color: theme.textSecondary }]}>
                {item.courtsCount} terrain{item.courtsCount > 1 ? 's' : ''}
              </Text>
            </View>
            {item.lighting && (
              <View style={[styles.badge, { backgroundColor: theme.warningLight }]}>
                <MaterialIcons name="lightbulb" size={12} color={theme.warning} />
              </View>
            )}
            {item.covered && (
              <View style={[styles.badge, { backgroundColor: theme.primaryLight + '30' }]}>
                <MaterialIcons name="roofing" size={12} color={theme.primary} />
              </View>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <Animated.View 
        entering={FadeInDown.duration(400)}
        style={styles.header}
      >
        <Text style={styles.title}>Annuaire</Text>
      </Animated.View>

      {/* Search */}
      <Animated.View 
        entering={FadeInDown.duration(400).delay(100)}
        style={styles.searchContainer}
      >
        <MaterialIcons name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        )}
      </Animated.View>

      {/* Tabs */}
      <Animated.View 
        entering={FadeInDown.duration(400).delay(200)}
        style={styles.tabsContainer}
      >
        {tabs.map(tab => (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.tabActive
            ]}
            onPress={() => {
              setActiveTab(tab.id);
              Haptics.selectionAsync();
            }}
          >
            <MaterialIcons 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.id ? '#FFF' : theme.textSecondary} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.tabTextActive
            ]}>
              {tab.label}
            </Text>
            <View style={[
              styles.tabCount,
              activeTab === tab.id && styles.tabCountActive
            ]}>
              <Text style={[
                styles.tabCountText,
                activeTab === tab.id && styles.tabCountTextActive
              ]}>
                {tab.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </Animated.View>

      {/* Tournament Status Filters */}
      {activeTab === 'tournaments' && (
        <Animated.View 
          entering={FadeInDown.duration(400).delay(250)}
          style={styles.terrainFiltersContainer}
        >
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.terrainFiltersScroll}
          >
            {tournamentStatusFilters.map(filter => (
              <Pressable
                key={filter.id}
                style={[
                  styles.terrainFilterChip,
                  tournamentStatusFilter === filter.id && styles.tournamentFilterChipActive
                ]}
                onPress={() => {
                  setTournamentStatusFilter(filter.id);
                  Haptics.selectionAsync();
                }}
              >
                <MaterialIcons 
                  name={filter.icon} 
                  size={16} 
                  color={tournamentStatusFilter === filter.id ? '#FFF' : theme.textSecondary} 
                />
                <Text style={[
                  styles.terrainFilterText,
                  tournamentStatusFilter === filter.id && styles.terrainFilterTextActive
                ]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Terrain Type Filters */}
      {activeTab === 'terrains' && (
        <Animated.View 
          entering={FadeInDown.duration(400).delay(250)}
          style={styles.terrainFiltersContainer}
        >
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.terrainFiltersScroll}
          >
            {terrainTypeFilters.map(filter => (
              <Pressable
                key={filter.id}
                style={[
                  styles.terrainFilterChip,
                  terrainTypeFilter === filter.id && styles.terrainFilterChipActive
                ]}
                onPress={() => {
                  setTerrainTypeFilter(filter.id);
                  Haptics.selectionAsync();
                }}
              >
                <MaterialIcons 
                  name={filter.icon} 
                  size={16} 
                  color={terrainTypeFilter === filter.id ? '#FFF' : theme.textSecondary} 
                />
                <Text style={[
                  styles.terrainFilterText,
                  terrainTypeFilter === filter.id && styles.terrainFilterTextActive
                ]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* List */}
      <View style={styles.listContainer}>
        {activeTab === 'players' && (
          <FlashList
            data={filteredPlayers}
            renderItem={renderPlayer}
            estimatedItemSize={100}
            contentContainerStyle={{ 
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 100,
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
        {activeTab === 'clubs' && (
          <FlashList
            data={filteredClubs}
            renderItem={renderClub}
            estimatedItemSize={100}
            contentContainerStyle={{ 
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 100,
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
        {activeTab === 'tournaments' && (
          <FlashList
            data={filteredTournaments}
            renderItem={renderTournament}
            estimatedItemSize={120}
            contentContainerStyle={{ 
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 100,
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
        {activeTab === 'terrains' && (
          <FlashList
            data={filteredTerrains}
            renderItem={renderTerrain}
            estimatedItemSize={100}
            contentContainerStyle={{ 
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 100,
            }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    gap: 12,
    ...theme.shadows.card,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    gap: 4,
    minHeight: 60,
  },
  tabActive: {
    backgroundColor: theme.primary,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#FFF',
  },
  tabCount: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  tabCountTextActive: {
    color: '#FFF',
  },
  // Terrain Type Filters
  terrainFiltersContainer: {
    paddingBottom: 8,
  },
  terrainFiltersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  terrainFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.card,
  },
  terrainFilterChipActive: {
    backgroundColor: theme.accent,
  },
  terrainFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  terrainFilterTextActive: {
    color: '#FFF',
  },
  tournamentFilterChipActive: {
    backgroundColor: theme.carreauColor,
  },
  // Favorite terrain styles
  favoriteCard: {
    borderWidth: 2,
    borderColor: theme.error + '50',
    backgroundColor: theme.error + '05',
  },
  favoriteAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  cardMetaText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Self player card styles
  selfCard: {
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.primary + '08',
  },
  selfCardTitle: {
    color: theme.primary,
  },
  selfAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  moiBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  moiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
