import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { Terrain, Player, Club, Tournament } from '@/services/mockData';
import { TerrainType } from '@/constants/config';

const { width: screenWidth } = Dimensions.get('window');

type DirectoryTab = 'players' | 'clubs' | 'terrains' | 'tournaments';
type TournamentStatus = 'all' | 'À venir' | 'En cours' | 'Terminé';

// Tab configuration
const TABS: { id: DirectoryTab; label: string; icon: string; color: string }[] = [
  { id: 'players', label: 'Joueurs', icon: 'person', color: theme.primary },
  { id: 'clubs', label: 'Clubs', icon: 'home', color: theme.accent },
  { id: 'terrains', label: 'Terrains', icon: 'sports-soccer', color: theme.success },
  { id: 'tournaments', label: 'Tournois', icon: 'emoji-events', color: theme.carreauColor },
];

export default function DirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { players, clubs, tournaments, terrains, selfPlayer, favoriteTerrainIds } = useApp();
  const [activeTab, setActiveTab] = useState<DirectoryTab>('players');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // All filters state
  const [filters, setFilters] = useState({
    // Player filters
    playerClub: 'all',
    playerCity: 'all',
    playerCountry: 'all',
    playerLevel: 'all',
    playerRole: 'all',
    // Club filters
    clubCity: 'all',
    clubCountry: 'all',
    // Terrain filters
    terrainType: 'all' as TerrainType | 'all',
    terrainCity: 'all',
    terrainLighting: 'all' as 'all' | 'yes' | 'no',
    terrainCovered: 'all' as 'all' | 'yes' | 'no',
    // Tournament filters
    tournamentStatus: 'all' as TournamentStatus,
    tournamentFormat: 'all',
    tournamentCadrage: 'all',
  });

  // Counts for tabs
  const counts = useMemo(() => ({
    players: players.length,
    clubs: clubs.length,
    terrains: terrains.length,
    tournaments: tournaments.length,
  }), [players.length, clubs.length, terrains.length, tournaments.length]);

  // Unique values for filters
  const uniqueValues = useMemo(() => ({
    playerClubs: ['all', ...new Set(players.map(p => p.club).filter(Boolean))] as string[],
    playerCities: ['all', ...new Set(players.map(p => p.location?.city).filter(Boolean))] as string[],
    playerCountries: ['all', ...new Set(players.map(p => p.country || 'France'))] as string[],
    playerLevels: ['all', 'Débutant', 'Intermédiaire', 'Confirmé', 'Expert'],
    playerRoles: ['all', 'Pointeur', 'Tireur', 'Milieu'],
    clubCities: ['all', ...new Set(clubs.map(c => c.city).filter(Boolean))] as string[],
    clubCountries: ['all', ...new Set(clubs.map(c => c.country || 'France'))] as string[],
    terrainCities: ['all', ...new Set(terrains.map(t => t.city).filter(Boolean))] as string[],
    tournamentFormats: ['all', ...new Set(tournaments.map(t => t.format).filter(Boolean))] as string[],
    tournamentCadrages: ['all', ...new Set(tournaments.map(t => t.type).filter(Boolean))] as string[],
  }), [players, clubs, terrains, tournaments]);

  // Active filter counts
  const activeFilterCounts = useMemo(() => ({
    players: [filters.playerClub, filters.playerCity, filters.playerCountry, filters.playerLevel, filters.playerRole].filter(f => f !== 'all').length,
    clubs: [filters.clubCity, filters.clubCountry].filter(f => f !== 'all').length,
    terrains: [filters.terrainType, filters.terrainCity, filters.terrainLighting, filters.terrainCovered].filter(f => f !== 'all').length,
    tournaments: [filters.tournamentStatus, filters.tournamentFormat, filters.tournamentCadrage].filter(f => f !== 'all').length,
  }), [filters]);

  const currentFilterCount = activeFilterCounts[activeTab];

  // Filtered data
  const filteredPlayers = useMemo(() => {
    let result = players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.club?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClub = filters.playerClub === 'all' || p.club === filters.playerClub;
      const matchesCity = filters.playerCity === 'all' || p.location?.city === filters.playerCity;
      const matchesCountry = filters.playerCountry === 'all' || (p.country || 'France') === filters.playerCountry;
      const matchesLevel = filters.playerLevel === 'all' || p.level === filters.playerLevel;
      const matchesRole = filters.playerRole === 'all' || p.role === filters.playerRole;
      return matchesSearch && matchesClub && matchesCity && matchesCountry && matchesLevel && matchesRole;
    });
    
    // Put selfPlayer at top
    if (selfPlayer) {
      const selfIndex = result.findIndex(p => p.id === selfPlayer.id);
      if (selfIndex > 0) {
        const [self] = result.splice(selfIndex, 1);
        result.unshift(self);
      }
    }
    return result;
  }, [players, searchQuery, filters, selfPlayer]);

  const filteredClubs = useMemo(() => {
    return clubs.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = filters.clubCity === 'all' || c.city === filters.clubCity;
      const matchesCountry = filters.clubCountry === 'all' || (c.country || 'France') === filters.clubCountry;
      return matchesSearch && matchesCity && matchesCountry;
    });
  }, [clubs, searchQuery, filters]);

  const filteredTerrains = useMemo(() => {
    return terrains.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filters.terrainType === 'all' || t.type === filters.terrainType;
      const matchesCity = filters.terrainCity === 'all' || t.city === filters.terrainCity;
      const matchesLighting = filters.terrainLighting === 'all' || 
        (filters.terrainLighting === 'yes' ? t.lighting : !t.lighting);
      const matchesCovered = filters.terrainCovered === 'all' || 
        (filters.terrainCovered === 'yes' ? t.covered : !t.covered);
      return matchesSearch && matchesType && matchesCity && matchesLighting && matchesCovered;
    });
  }, [terrains, searchQuery, filters]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.location.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filters.tournamentStatus === 'all' || t.status === filters.tournamentStatus;
      const matchesFormat = filters.tournamentFormat === 'all' || t.format === filters.tournamentFormat;
      const matchesCadrage = filters.tournamentCadrage === 'all' || t.type === filters.tournamentCadrage;
      return matchesSearch && matchesStatus && matchesFormat && matchesCadrage;
    });
  }, [tournaments, searchQuery, filters]);

  const clearFilters = useCallback(() => {
    if (activeTab === 'players') {
      setFilters(f => ({ ...f, playerClub: 'all', playerCity: 'all', playerCountry: 'all', playerLevel: 'all', playerRole: 'all' }));
    } else if (activeTab === 'clubs') {
      setFilters(f => ({ ...f, clubCity: 'all', clubCountry: 'all' }));
    } else if (activeTab === 'terrains') {
      setFilters(f => ({ ...f, terrainType: 'all', terrainCity: 'all', terrainLighting: 'all', terrainCovered: 'all' }));
    } else if (activeTab === 'tournaments') {
      setFilters(f => ({ ...f, tournamentStatus: 'all', tournamentFormat: 'all', tournamentCadrage: 'all' }));
    }
  }, [activeTab]);

  const getTerrainTypeConfig = (type: string) => {
    return config.terrainTypes.find(t => t.id === type) || config.terrainTypes[0];
  };

  // Render functions
  const renderPlayer = ({ item }: { item: Player }) => {
    const isSelf = selfPlayer && item.id === selfPlayer.id;
    return (
      <Pressable
        style={[styles.itemCard, isSelf && styles.selfCard]}
        onPress={() => isSelf ? router.push('/player/me') : router.push(`/player/${item.id}`)}
      >
        <View style={[styles.itemAvatar, isSelf && styles.selfAvatar]}>
          <Text style={styles.avatarText}>
            {item.name.split(' ').map(n => n[0]).join('')}
          </Text>
          {isSelf && (
            <View style={styles.selfBadge}>
              <MaterialIcons name="star" size={10} color="#FFF" />
            </View>
          )}
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, isSelf && { color: theme.primary }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isSelf && (
              <View style={styles.moiBadge}>
                <Text style={styles.moiBadgeText}>MOI</Text>
              </View>
            )}
          </View>
          <View style={styles.itemMeta}>
            {item.club && (
              <View style={styles.metaItem}>
                <MaterialIcons name="home" size={12} color={theme.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>{item.club}</Text>
              </View>
            )}
            {item.location?.city && (
              <View style={styles.metaItem}>
                <MaterialIcons name="place" size={12} color={theme.textMuted} />
                <Text style={styles.metaText}>{item.location.city}</Text>
              </View>
            )}
          </View>
          <View style={styles.itemTags}>
            <View style={[styles.tag, { backgroundColor: theme.primary + '15' }]}>
              <Text style={[styles.tagText, { color: theme.primary }]}>{item.role}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.success + '15' }]}>
              <Text style={[styles.tagText, { color: theme.success }]}>{item.stats.winRate}%</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{item.level}</Text>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
      </Pressable>
    );
  };

  const renderClub = ({ item }: { item: Club }) => (
    <Pressable
      style={styles.itemCard}
      onPress={() => router.push(`/club/${item.id}`)}
    >
      <View style={[styles.itemAvatar, { backgroundColor: theme.accent }]}>
        <MaterialIcons name="home" size={24} color="#FFF" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <View style={styles.metaItem}>
            <MaterialIcons name="place" size={12} color={theme.textMuted} />
            <Text style={styles.metaText}>{item.city}, {item.country || 'France'}</Text>
          </View>
          {item.terrainName && (
            <View style={styles.metaItem}>
              <MaterialIcons name="sports-soccer" size={12} color={theme.success} />
              <Text style={[styles.metaText, { color: theme.success }]}>{item.terrainName}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemTags}>
          <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
            <MaterialIcons name="people" size={10} color={theme.textSecondary} />
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>{item.membersCount}</Text>
          </View>
          {item.foundedYear && (
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>Depuis {item.foundedYear}</Text>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
    </Pressable>
  );

  const renderTerrain = ({ item }: { item: Terrain }) => {
    const typeConfig = getTerrainTypeConfig(item.type);
    const isFavorite = favoriteTerrainIds.includes(item.id);
    return (
      <Pressable
        style={[styles.itemCard, isFavorite && styles.favoriteCard]}
        onPress={() => router.push(`/terrain/${item.id}`)}
      >
        <View style={[styles.itemAvatar, { backgroundColor: theme.success }]}>
          <MaterialIcons name={typeConfig.icon as any} size={24} color="#FFF" />
          {isFavorite && (
            <View style={styles.favoriteBadge}>
              <MaterialIcons name="favorite" size={10} color={theme.error} />
            </View>
          )}
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.itemMeta}>
            <View style={styles.metaItem}>
              <MaterialIcons name="place" size={12} color={theme.textMuted} />
              <Text style={styles.metaText}>{item.city}</Text>
            </View>
            {item.clubName && (
              <View style={styles.metaItem}>
                <MaterialIcons name="home" size={12} color={theme.textMuted} />
                <Text style={styles.metaText}>{item.clubName}</Text>
              </View>
            )}
          </View>
          <View style={styles.itemTags}>
            <View style={[styles.tag, { backgroundColor: theme.success + '15' }]}>
              <Text style={[styles.tagText, { color: theme.success }]}>{item.type}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>
                {item.courtsCount} terrain{item.courtsCount > 1 ? 's' : ''}
              </Text>
            </View>
            {item.lighting && (
              <View style={[styles.tag, { backgroundColor: theme.warning + '15' }]}>
                <MaterialIcons name="lightbulb" size={10} color={theme.warning} />
              </View>
            )}
            {item.covered && (
              <View style={[styles.tag, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="roofing" size={10} color={theme.primary} />
              </View>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
      </Pressable>
    );
  };

  const renderTournament = ({ item }: { item: Tournament }) => {
    const statusConfig: Record<string, { bg: string; color: string }> = {
      'À venir': { bg: theme.primary + '15', color: theme.primary },
      'En cours': { bg: theme.warning + '15', color: theme.warning },
      'Terminé': { bg: theme.backgroundSecondary, color: theme.textSecondary },
    };
    const status = statusConfig[item.status] || statusConfig['Terminé'];
    
    return (
      <Pressable
        style={styles.itemCard}
        onPress={() => router.push(`/tournament/${item.id}`)}
      >
        <View style={[styles.itemAvatar, { backgroundColor: theme.carreauColor }]}>
          <MaterialIcons name="emoji-events" size={24} color="#FFF" />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.itemMeta}>
            <View style={styles.metaItem}>
              <MaterialIcons name="event" size={12} color={theme.textMuted} />
              <Text style={styles.metaText}>
                {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="place" size={12} color={theme.textMuted} />
              <Text style={styles.metaText}>{item.terrainName || item.location.city}</Text>
            </View>
          </View>
          <View style={styles.itemTags}>
            <View style={[styles.tag, { backgroundColor: status.bg }]}>
              <Text style={[styles.tagText, { color: status.color }]}>{item.status}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{item.format}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{item.type}</Text>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
      </Pressable>
    );
  };

  // Get current filtered data
  const getCurrentData = () => {
    switch (activeTab) {
      case 'players': return filteredPlayers;
      case 'clubs': return filteredClubs;
      case 'terrains': return filteredTerrains;
      case 'tournaments': return filteredTournaments;
    }
  };

  const getCurrentRenderItem = () => {
    switch (activeTab) {
      case 'players': return renderPlayer;
      case 'clubs': return renderClub;
      case 'terrains': return renderTerrain;
      case 'tournaments': return renderTournament;
    }
  };

  // Filter Modal Content
  const renderFilterContent = () => {
    switch (activeTab) {
      case 'players':
        return (
          <>
            <FilterSection
              title="Rôle"
              options={uniqueValues.playerRoles}
              value={filters.playerRole}
              onChange={(v) => setFilters(f => ({ ...f, playerRole: v }))}
              icons={{ 'Pointeur': 'radio-button-on', 'Tireur': 'gps-fixed', 'Milieu': 'swap-horiz' }}
            />
            <FilterSection
              title="Niveau"
              options={uniqueValues.playerLevels}
              value={filters.playerLevel}
              onChange={(v) => setFilters(f => ({ ...f, playerLevel: v }))}
            />
            <FilterSection
              title="Club"
              options={uniqueValues.playerClubs}
              value={filters.playerClub}
              onChange={(v) => setFilters(f => ({ ...f, playerClub: v }))}
            />
            <FilterSection
              title="Ville"
              options={uniqueValues.playerCities}
              value={filters.playerCity}
              onChange={(v) => setFilters(f => ({ ...f, playerCity: v }))}
            />
            <FilterSection
              title="Pays"
              options={uniqueValues.playerCountries}
              value={filters.playerCountry}
              onChange={(v) => setFilters(f => ({ ...f, playerCountry: v }))}
            />
          </>
        );
      case 'clubs':
        return (
          <>
            <FilterSection
              title="Ville"
              options={uniqueValues.clubCities}
              value={filters.clubCity}
              onChange={(v) => setFilters(f => ({ ...f, clubCity: v }))}
            />
            <FilterSection
              title="Pays"
              options={uniqueValues.clubCountries}
              value={filters.clubCountry}
              onChange={(v) => setFilters(f => ({ ...f, clubCountry: v }))}
            />
          </>
        );
      case 'terrains':
        return (
          <>
            <FilterSection
              title="Type de surface"
              options={['all', ...config.terrainTypes.map(t => t.id)]}
              labels={{ all: 'Tous', ...Object.fromEntries(config.terrainTypes.map(t => [t.id, t.label])) }}
              value={filters.terrainType}
              onChange={(v) => setFilters(f => ({ ...f, terrainType: v as TerrainType | 'all' }))}
              icons={Object.fromEntries(config.terrainTypes.map(t => [t.id, t.icon]))}
            />
            <FilterSection
              title="Ville"
              options={uniqueValues.terrainCities}
              value={filters.terrainCity}
              onChange={(v) => setFilters(f => ({ ...f, terrainCity: v }))}
            />
            <FilterSection
              title="Éclairage"
              options={['all', 'yes', 'no']}
              labels={{ all: 'Tous', yes: 'Avec éclairage', no: 'Sans éclairage' }}
              value={filters.terrainLighting}
              onChange={(v) => setFilters(f => ({ ...f, terrainLighting: v as 'all' | 'yes' | 'no' }))}
              icons={{ yes: 'lightbulb', no: 'lightbulb-outline' }}
            />
            <FilterSection
              title="Couverture"
              options={['all', 'yes', 'no']}
              labels={{ all: 'Tous', yes: 'Couvert', no: 'Extérieur' }}
              value={filters.terrainCovered}
              onChange={(v) => setFilters(f => ({ ...f, terrainCovered: v as 'all' | 'yes' | 'no' }))}
              icons={{ yes: 'roofing', no: 'wb-sunny' }}
            />
          </>
        );
      case 'tournaments':
        return (
          <>
            <FilterSection
              title="Statut"
              options={['all', 'À venir', 'En cours', 'Terminé']}
              labels={{ all: 'Tous' }}
              value={filters.tournamentStatus}
              onChange={(v) => setFilters(f => ({ ...f, tournamentStatus: v as TournamentStatus }))}
              icons={{ 'À venir': 'event', 'En cours': 'play-circle', 'Terminé': 'check-circle' }}
            />
            <FilterSection
              title="Format"
              options={uniqueValues.tournamentFormats}
              value={filters.tournamentFormat}
              onChange={(v) => setFilters(f => ({ ...f, tournamentFormat: v }))}
            />
            <FilterSection
              title="Cadrage"
              options={uniqueValues.tournamentCadrages}
              value={filters.tournamentCadrage}
              onChange={(v) => setFilters(f => ({ ...f, tournamentCadrage: v }))}
            />
          </>
        );
    }
  };

  const tabConfig = TABS.find(t => t.id === activeTab);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Annuaire</Text>
          <View style={styles.headerStats}>
            <Text style={styles.headerStatsText}>
              {counts.players + counts.clubs + counts.terrains + counts.tournaments} éléments
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Rechercher un ${activeTab === 'players' ? 'joueur' : activeTab === 'clubs' ? 'club' : activeTab === 'terrains' ? 'terrain' : 'tournoi'}...`}
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <MaterialIcons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </View>
          <Pressable
            style={[styles.filterButton, currentFilterCount > 0 && styles.filterButtonActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setShowFilters(true);
            }}
          >
            <MaterialIcons 
              name="tune" 
              size={20} 
              color={currentFilterCount > 0 ? '#FFF' : theme.textSecondary} 
            />
            {currentFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{currentFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabsWrapper}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.tab, isActive && { backgroundColor: tab.color }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveTab(tab.id);
                    setSearchQuery('');
                  }}
                >
                  <MaterialIcons 
                    name={tab.icon as any} 
                    size={18} 
                    color={isActive ? '#FFF' : theme.textSecondary} 
                  />
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                      {counts[tab.id]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* Active Filters Display */}
      {currentFilterCount > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.activeFiltersContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersScroll}
          >
            <Pressable style={styles.clearAllButton} onPress={clearFilters}>
              <MaterialIcons name="clear-all" size={16} color={theme.error} />
              <Text style={styles.clearAllText}>Effacer</Text>
            </Pressable>
            {activeTab === 'players' && (
              <>
                {filters.playerRole !== 'all' && <ActiveFilterChip label={filters.playerRole} onRemove={() => setFilters(f => ({ ...f, playerRole: 'all' }))} />}
                {filters.playerLevel !== 'all' && <ActiveFilterChip label={filters.playerLevel} onRemove={() => setFilters(f => ({ ...f, playerLevel: 'all' }))} />}
                {filters.playerClub !== 'all' && <ActiveFilterChip label={filters.playerClub} onRemove={() => setFilters(f => ({ ...f, playerClub: 'all' }))} />}
                {filters.playerCity !== 'all' && <ActiveFilterChip label={filters.playerCity} onRemove={() => setFilters(f => ({ ...f, playerCity: 'all' }))} />}
                {filters.playerCountry !== 'all' && <ActiveFilterChip label={filters.playerCountry} onRemove={() => setFilters(f => ({ ...f, playerCountry: 'all' }))} />}
              </>
            )}
            {activeTab === 'clubs' && (
              <>
                {filters.clubCity !== 'all' && <ActiveFilterChip label={filters.clubCity} onRemove={() => setFilters(f => ({ ...f, clubCity: 'all' }))} />}
                {filters.clubCountry !== 'all' && <ActiveFilterChip label={filters.clubCountry} onRemove={() => setFilters(f => ({ ...f, clubCountry: 'all' }))} />}
              </>
            )}
            {activeTab === 'terrains' && (
              <>
                {filters.terrainType !== 'all' && <ActiveFilterChip label={config.terrainTypes.find(t => t.id === filters.terrainType)?.label || filters.terrainType} onRemove={() => setFilters(f => ({ ...f, terrainType: 'all' }))} />}
                {filters.terrainCity !== 'all' && <ActiveFilterChip label={filters.terrainCity} onRemove={() => setFilters(f => ({ ...f, terrainCity: 'all' }))} />}
                {filters.terrainLighting !== 'all' && <ActiveFilterChip label={filters.terrainLighting === 'yes' ? 'Éclairé' : 'Non éclairé'} onRemove={() => setFilters(f => ({ ...f, terrainLighting: 'all' }))} icon="lightbulb" />}
                {filters.terrainCovered !== 'all' && <ActiveFilterChip label={filters.terrainCovered === 'yes' ? 'Couvert' : 'Extérieur'} onRemove={() => setFilters(f => ({ ...f, terrainCovered: 'all' }))} icon="roofing" />}
              </>
            )}
            {activeTab === 'tournaments' && (
              <>
                {filters.tournamentStatus !== 'all' && <ActiveFilterChip label={filters.tournamentStatus} onRemove={() => setFilters(f => ({ ...f, tournamentStatus: 'all' }))} />}
                {filters.tournamentFormat !== 'all' && <ActiveFilterChip label={filters.tournamentFormat} onRemove={() => setFilters(f => ({ ...f, tournamentFormat: 'all' }))} />}
                {filters.tournamentCadrage !== 'all' && <ActiveFilterChip label={filters.tournamentCadrage} onRemove={() => setFilters(f => ({ ...f, tournamentCadrage: 'all' }))} />}
              </>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {getCurrentData().length} {activeTab === 'players' ? 'joueur' : activeTab === 'clubs' ? 'club' : activeTab === 'terrains' ? 'terrain' : 'tournoi'}{getCurrentData().length !== 1 ? 's' : ''}
        </Text>
        {searchQuery && (
          <Text style={styles.searchingFor}>pour "{searchQuery}"</Text>
        )}
      </View>

      {/* List */}
      <View style={styles.listContainer}>
        <FlashList
          data={getCurrentData()}
          renderItem={getCurrentRenderItem() as any}
          estimatedItemSize={110}
          contentContainerStyle={{ 
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name={tabConfig?.icon as any || 'search'} size={48} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>Aucun résultat</Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? `Aucun ${activeTab === 'players' ? 'joueur' : activeTab === 'clubs' ? 'club' : activeTab === 'terrains' ? 'terrain' : 'tournoi'} ne correspond à "${searchQuery}"`
                  : currentFilterCount > 0 
                    ? 'Essayez de modifier vos filtres'
                    : `Aucun ${activeTab === 'players' ? 'joueur' : activeTab === 'clubs' ? 'club' : activeTab === 'terrains' ? 'terrain' : 'tournoi'} enregistré`
                }
              </Text>
            </View>
          }
        />
      </View>

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.modalIcon, { backgroundColor: tabConfig?.color + '15' }]}>
                <MaterialIcons name={tabConfig?.icon as any} size={20} color={tabConfig?.color} />
              </View>
              <Text style={styles.modalTitle}>Filtrer les {tabConfig?.label.toLowerCase()}</Text>
            </View>
            <Pressable 
              style={styles.modalCloseButton}
              onPress={() => setShowFilters(false)}
            >
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          
          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {renderFilterContent()}
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + 16 }]}>
            <Pressable style={styles.clearButton} onPress={clearFilters}>
              <MaterialIcons name="clear-all" size={20} color={theme.textSecondary} />
              <Text style={styles.clearButtonText}>Effacer tout</Text>
            </Pressable>
            <Pressable 
              style={[styles.applyButton, { backgroundColor: tabConfig?.color }]}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>
                Voir {getCurrentData().length} résultat{getCurrentData().length !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Filter Section Component
function FilterSection({ 
  title, 
  options, 
  value, 
  onChange, 
  labels = {}, 
  icons = {} 
}: { 
  title: string; 
  options: string[]; 
  value: string; 
  onChange: (v: string) => void;
  labels?: Record<string, string>;
  icons?: Record<string, string>;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <View style={styles.filterOptions}>
        {options.map(option => {
          const isActive = value === option;
          const label = labels[option] || (option === 'all' ? 'Tous' : option);
          const icon = icons[option];
          return (
            <Pressable
              key={option}
              style={[styles.filterOption, isActive && styles.filterOptionActive]}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(option);
              }}
            >
              {icon && (
                <MaterialIcons 
                  name={icon as any} 
                  size={16} 
                  color={isActive ? theme.primary : theme.textSecondary} 
                />
              )}
              <Text style={[styles.filterOptionText, isActive && styles.filterOptionTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Active Filter Chip Component
function ActiveFilterChip({ label, onRemove, icon }: { label: string; onRemove: () => void; icon?: string }) {
  return (
    <Pressable style={styles.activeFilterChip} onPress={onRemove}>
      {icon && <MaterialIcons name={icon as any} size={12} color={theme.primary} />}
      <Text style={styles.activeFilterChipText}>{label}</Text>
      <MaterialIcons name="close" size={14} color={theme.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  header: {
    backgroundColor: theme.surface,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  headerStats: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  headerStatsText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.textPrimary,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: theme.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFF',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.primary,
  },
  tabsWrapper: {
    paddingLeft: 16,
  },
  tabsContainer: {
    gap: 8,
    paddingRight: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.backgroundSecondary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  tabLabelActive: {
    color: '#FFF',
  },
  tabCount: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  tabCountTextActive: {
    color: '#FFF',
  },
  activeFiltersContainer: {
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  activeFiltersScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.error + '10',
    borderWidth: 1,
    borderColor: theme.error + '30',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.error,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.primary + '25',
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.primary,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  searchingFor: {
    fontSize: 13,
    color: theme.textMuted,
  },
  listContainer: {
    flex: 1,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 10,
    ...theme.shadows.card,
  },
  selfCard: {
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.primary + '05',
  },
  favoriteCard: {
    borderWidth: 2,
    borderColor: theme.error + '50',
    backgroundColor: theme.error + '03',
  },
  itemAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selfAvatar: {
    backgroundColor: theme.primary,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  selfBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.carreauColor,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.surface,
  },
  favoriteBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.surface,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  moiBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  moiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  itemMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  itemTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterOptionActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '08',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  filterOptionTextActive: {
    color: theme.primary,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.backgroundSecondary,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  applyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.primary,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
