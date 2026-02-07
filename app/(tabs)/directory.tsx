import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
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
  
  // Player filters
  const [playerClubFilter, setPlayerClubFilter] = useState<string>('all');
  const [playerCityFilter, setPlayerCityFilter] = useState<string>('all');
  const [playerCountryFilter, setPlayerCountryFilter] = useState<string>('all');
  const [playerLevelFilter, setPlayerLevelFilter] = useState<string>('all');
  const [playerRoleFilter, setPlayerRoleFilter] = useState<string>('all');
  const [showPlayerFilters, setShowPlayerFilters] = useState(false);
  
  // Club filters
  const [clubCityFilter, setClubCityFilter] = useState<string>('all');
  const [clubCountryFilter, setClubCountryFilter] = useState<string>('all');
  const [showClubFilters, setShowClubFilters] = useState(false);
  
  // Terrain filters
  const [terrainCityFilter, setTerrainCityFilter] = useState<string>('all');
  const [terrainLightingFilter, setTerrainLightingFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [terrainCoveredFilter, setTerrainCoveredFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [showTerrainFilters, setShowTerrainFilters] = useState(false);
  
  // Tournament filters
  const [tournamentFormatFilter, setTournamentFormatFilter] = useState<string>('all');
  const [tournamentCadrageFilter, setTournamentCadrageFilter] = useState<string>('all');
  const [showTournamentFilters, setShowTournamentFilters] = useState(false);

  const tabs = useMemo(() => [
    { id: 'players' as const, label: 'Joueurs', icon: 'person' as const, count: players.length },
    { id: 'clubs' as const, label: 'Clubs', icon: 'home' as const, count: clubs.length },
    { id: 'terrains' as const, label: 'Terrains', icon: 'sports-soccer' as const, count: terrains.length },
    { id: 'tournaments' as const, label: 'Tournois', icon: 'emoji-events' as const, count: tournaments.length },
  ], [players.length, clubs.length, terrains.length, tournaments.length]);

  // Get unique values for filters
  const uniquePlayerClubs = useMemo(() => {
    const clubSet = new Set(players.map(p => p.club).filter(Boolean));
    return ['all', ...Array.from(clubSet)] as string[];
  }, [players]);

  const uniquePlayerCities = useMemo(() => {
    const citySet = new Set(players.map(p => p.location?.city).filter(Boolean));
    return ['all', ...Array.from(citySet)] as string[];
  }, [players]);

  const uniquePlayerCountries = useMemo(() => {
    const countrySet = new Set(players.map(p => p.country || 'France').filter(Boolean));
    return ['all', ...Array.from(countrySet)] as string[];
  }, [players]);

  const uniquePlayerLevels = ['all', 'Débutant', 'Intermédiaire', 'Confirmé', 'Expert'];
  const uniquePlayerRoles = ['all', 'Pointeur', 'Tireur', 'Milieu'];

  const uniqueClubCities = useMemo(() => {
    const citySet = new Set(clubs.map(c => c.city).filter(Boolean));
    return ['all', ...Array.from(citySet)] as string[];
  }, [clubs]);

  const uniqueClubCountries = useMemo(() => {
    const countrySet = new Set(clubs.map(c => c.country || 'France').filter(Boolean));
    return ['all', ...Array.from(countrySet)] as string[];
  }, [clubs]);

  // Terrain filter unique values
  const uniqueTerrainCities = useMemo(() => {
    const citySet = new Set(terrains.map(t => t.city).filter(Boolean));
    return ['all', ...Array.from(citySet)] as string[];
  }, [terrains]);

  // Tournament filter unique values
  const uniqueTournamentFormats = useMemo(() => {
    const formatSet = new Set(tournaments.map(t => t.format).filter(Boolean));
    return ['all', ...Array.from(formatSet)] as string[];
  }, [tournaments]);

  const uniqueTournamentCadrages = useMemo(() => {
    const cadrageSet = new Set(tournaments.map(t => t.type).filter(Boolean));
    return ['all', ...Array.from(cadrageSet)] as string[];
  }, [tournaments]);

  // Count active player filters
  const activePlayerFilterCount = useMemo(() => {
    let count = 0;
    if (playerClubFilter !== 'all') count++;
    if (playerCityFilter !== 'all') count++;
    if (playerCountryFilter !== 'all') count++;
    if (playerLevelFilter !== 'all') count++;
    if (playerRoleFilter !== 'all') count++;
    return count;
  }, [playerClubFilter, playerCityFilter, playerCountryFilter, playerLevelFilter, playerRoleFilter]);

  // Count active club filters
  const activeClubFilterCount = useMemo(() => {
    let count = 0;
    if (clubCityFilter !== 'all') count++;
    if (clubCountryFilter !== 'all') count++;
    return count;
  }, [clubCityFilter, clubCountryFilter]);

  // Count active terrain filters
  const activeTerrainFilterCount = useMemo(() => {
    let count = 0;
    if (terrainTypeFilter !== 'all') count++;
    if (terrainCityFilter !== 'all') count++;
    if (terrainLightingFilter !== 'all') count++;
    if (terrainCoveredFilter !== 'all') count++;
    return count;
  }, [terrainTypeFilter, terrainCityFilter, terrainLightingFilter, terrainCoveredFilter]);

  // Count active tournament filters
  const activeTournamentFilterCount = useMemo(() => {
    let count = 0;
    if (tournamentStatusFilter !== 'all') count++;
    if (tournamentFormatFilter !== 'all') count++;
    if (tournamentCadrageFilter !== 'all') count++;
    return count;
  }, [tournamentStatusFilter, tournamentFormatFilter, tournamentCadrageFilter]);

  // Filter players and put selfPlayer at the top
  const filteredPlayers = useMemo(() => {
    let filtered = players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.club?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesClub = playerClubFilter === 'all' || p.club === playerClubFilter;
      const matchesCity = playerCityFilter === 'all' || p.location?.city === playerCityFilter;
      const matchesCountry = playerCountryFilter === 'all' || (p.country || 'France') === playerCountryFilter;
      const matchesLevel = playerLevelFilter === 'all' || p.level === playerLevelFilter;
      const matchesRole = playerRoleFilter === 'all' || p.role === playerRoleFilter;
      
      return matchesSearch && matchesClub && matchesCity && matchesCountry && matchesLevel && matchesRole;
    });
    
    // If selfPlayer exists and matches filter, put it at the top
    if (selfPlayer) {
      const selfIndex = filtered.findIndex(p => p.id === selfPlayer.id);
      if (selfIndex > 0) {
        const [self] = filtered.splice(selfIndex, 1);
        filtered.unshift(self);
      }
    }
    
    return filtered;
  }, [players, searchQuery, selfPlayer, playerClubFilter, playerCityFilter, playerCountryFilter, playerLevelFilter, playerRoleFilter]);

  const filteredClubs = useMemo(() => {
    return clubs.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCity = clubCityFilter === 'all' || c.city === clubCityFilter;
      const matchesCountry = clubCountryFilter === 'all' || (c.country || 'France') === clubCountryFilter;
      
      return matchesSearch && matchesCity && matchesCountry;
    });
  }, [clubs, searchQuery, clubCityFilter, clubCountryFilter]);

  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.location.city.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = tournamentStatusFilter === 'all' || t.status === tournamentStatusFilter;
      const matchesFormat = tournamentFormatFilter === 'all' || t.format === tournamentFormatFilter;
      const matchesCadrage = tournamentCadrageFilter === 'all' || t.type === tournamentCadrageFilter;
      
      return matchesSearch && matchesStatus && matchesFormat && matchesCadrage;
    });
  }, [tournaments, searchQuery, tournamentStatusFilter, tournamentFormatFilter, tournamentCadrageFilter]);

  const filteredTerrains = useMemo(() => {
    return terrains.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = terrainTypeFilter === 'all' || t.type === terrainTypeFilter;
      const matchesCity = terrainCityFilter === 'all' || t.city === terrainCityFilter;
      const matchesLighting = terrainLightingFilter === 'all' || 
        (terrainLightingFilter === 'yes' ? t.lighting : !t.lighting);
      const matchesCovered = terrainCoveredFilter === 'all' || 
        (terrainCoveredFilter === 'yes' ? t.covered : !t.covered);
      
      return matchesSearch && matchesType && matchesCity && matchesLighting && matchesCovered;
    });
  }, [terrains, searchQuery, terrainTypeFilter, terrainCityFilter, terrainLightingFilter, terrainCoveredFilter]);

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

  const clearPlayerFilters = () => {
    setPlayerClubFilter('all');
    setPlayerCityFilter('all');
    setPlayerCountryFilter('all');
    setPlayerLevelFilter('all');
    setPlayerRoleFilter('all');
  };

  const clearClubFilters = () => {
    setClubCityFilter('all');
    setClubCountryFilter('all');
  };

  const clearTerrainFilters = () => {
    setTerrainTypeFilter('all');
    setTerrainCityFilter('all');
    setTerrainLightingFilter('all');
    setTerrainCoveredFilter('all');
  };

  const clearTournamentFilters = () => {
    setTournamentStatusFilter('all');
    setTournamentFormatFilter('all');
    setTournamentCadrageFilter('all');
  };

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
          {item.location?.city && (
            <View style={styles.cardMeta}>
              <MaterialIcons name="place" size={14} color={theme.textSecondary} />
              <Text style={styles.cardMetaText}>{item.location.city}, {item.country || 'France'}</Text>
            </View>
          )}
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
          <Text style={styles.cardMetaText}>{item.city}, {item.country || 'France'}</Text>
        </View>
        {item.terrainName && (
          <View style={styles.cardMeta}>
            <MaterialIcons name="sports-soccer" size={14} color={theme.primary} />
            <Text style={[styles.cardMetaText, { color: theme.primary }]}>{item.terrainName}</Text>
          </View>
        )}
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

  // Filter Modal for Players
  const PlayerFiltersModal = () => (
    <Modal
      visible={showPlayerFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPlayerFilters(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filtrer les joueurs</Text>
          <Pressable onPress={() => setShowPlayerFilters(false)}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
        </View>
        
        <ScrollView style={styles.modalContent}>
          {/* Club Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>CLUB</Text>
            <View style={styles.filterOptions}>
              {uniquePlayerClubs.map(club => (
                <Pressable
                  key={club}
                  style={[
                    styles.filterOption,
                    playerClubFilter === club && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setPlayerClubFilter(club);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    playerClubFilter === club && styles.filterOptionTextActive
                  ]}>
                    {club === 'all' ? 'Tous les clubs' : club}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* City Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>VILLE</Text>
            <View style={styles.filterOptions}>
              {uniquePlayerCities.map(city => (
                <Pressable
                  key={city}
                  style={[
                    styles.filterOption,
                    playerCityFilter === city && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setPlayerCityFilter(city);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    playerCityFilter === city && styles.filterOptionTextActive
                  ]}>
                    {city === 'all' ? 'Toutes les villes' : city}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Country Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>PAYS</Text>
            <View style={styles.filterOptions}>
              {uniquePlayerCountries.map(country => (
                <Pressable
                  key={country}
                  style={[
                    styles.filterOption,
                    playerCountryFilter === country && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setPlayerCountryFilter(country);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    playerCountryFilter === country && styles.filterOptionTextActive
                  ]}>
                    {country === 'all' ? 'Tous les pays' : country}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Level Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>NIVEAU</Text>
            <View style={styles.filterOptions}>
              {uniquePlayerLevels.map(level => (
                <Pressable
                  key={level}
                  style={[
                    styles.filterOption,
                    playerLevelFilter === level && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setPlayerLevelFilter(level);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    playerLevelFilter === level && styles.filterOptionTextActive
                  ]}>
                    {level === 'all' ? 'Tous les niveaux' : level}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Role Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>RÔLE</Text>
            <View style={styles.filterOptions}>
              {uniquePlayerRoles.map(role => (
                <Pressable
                  key={role}
                  style={[
                    styles.filterOption,
                    playerRoleFilter === role && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setPlayerRoleFilter(role);
                    Haptics.selectionAsync();
                  }}
                >
                  <MaterialIcons 
                    name={role === 'Tireur' ? 'gps-fixed' : role === 'Pointeur' ? 'radio-button-on' : role === 'Milieu' ? 'swap-horiz' : 'people'} 
                    size={16} 
                    color={playerRoleFilter === role ? theme.primary : theme.textSecondary} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[
                    styles.filterOptionText,
                    playerRoleFilter === role && styles.filterOptionTextActive
                  ]}>
                    {role === 'all' ? 'Tous les rôles' : role}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Pressable style={styles.clearButton} onPress={clearPlayerFilters}>
            <Text style={styles.clearButtonText}>Effacer les filtres</Text>
          </Pressable>
          <Pressable 
            style={styles.applyButton} 
            onPress={() => setShowPlayerFilters(false)}
          >
            <Text style={styles.applyButtonText}>Appliquer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Filter Modal for Clubs
  const ClubFiltersModal = () => (
    <Modal
      visible={showClubFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowClubFilters(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filtrer les clubs</Text>
          <Pressable onPress={() => setShowClubFilters(false)}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
        </View>
        
        <ScrollView style={styles.modalContent}>
          {/* City Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>VILLE</Text>
            <View style={styles.filterOptions}>
              {uniqueClubCities.map(city => (
                <Pressable
                  key={city}
                  style={[
                    styles.filterOption,
                    clubCityFilter === city && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setClubCityFilter(city);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    clubCityFilter === city && styles.filterOptionTextActive
                  ]}>
                    {city === 'all' ? 'Toutes les villes' : city}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Country Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>PAYS</Text>
            <View style={styles.filterOptions}>
              {uniqueClubCountries.map(country => (
                <Pressable
                  key={country}
                  style={[
                    styles.filterOption,
                    clubCountryFilter === country && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setClubCountryFilter(country);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    clubCountryFilter === country && styles.filterOptionTextActive
                  ]}>
                    {country === 'all' ? 'Tous les pays' : country}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Pressable style={styles.clearButton} onPress={clearClubFilters}>
            <Text style={styles.clearButtonText}>Effacer les filtres</Text>
          </Pressable>
          <Pressable 
            style={styles.applyButton} 
            onPress={() => setShowClubFilters(false)}
          >
            <Text style={styles.applyButtonText}>Appliquer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Filter Modal for Terrains
  const TerrainFiltersModal = () => (
    <Modal
      visible={showTerrainFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowTerrainFilters(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filtrer les terrains</Text>
          <Pressable onPress={() => setShowTerrainFilters(false)}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
        </View>
        
        <ScrollView style={styles.modalContent}>
          {/* Type Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>TYPE DE SURFACE</Text>
            <View style={styles.filterOptions}>
              <Pressable
                style={[
                  styles.filterOption,
                  terrainTypeFilter === 'all' && styles.filterOptionActive
                ]}
                onPress={() => {
                  setTerrainTypeFilter('all');
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[
                  styles.filterOptionText,
                  terrainTypeFilter === 'all' && styles.filterOptionTextActive
                ]}>
                  Tous les types
                </Text>
              </Pressable>
              {config.terrainTypes.map(type => (
                <Pressable
                  key={type.id}
                  style={[
                    styles.filterOption,
                    terrainTypeFilter === type.id && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setTerrainTypeFilter(type.id as TerrainType);
                    Haptics.selectionAsync();
                  }}
                >
                  <MaterialIcons name={type.icon as any} size={16} color={terrainTypeFilter === type.id ? theme.primary : theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[
                    styles.filterOptionText,
                    terrainTypeFilter === type.id && styles.filterOptionTextActive
                  ]}>
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* City Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>VILLE</Text>
            <View style={styles.filterOptions}>
              {uniqueTerrainCities.map(city => (
                <Pressable
                  key={city}
                  style={[
                    styles.filterOption,
                    terrainCityFilter === city && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setTerrainCityFilter(city);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    terrainCityFilter === city && styles.filterOptionTextActive
                  ]}>
                    {city === 'all' ? 'Toutes les villes' : city}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Lighting Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>ÉCLAIRAGE</Text>
            <View style={styles.filterOptions}>
              {[{ id: 'all', label: 'Tous' }, { id: 'yes', label: 'Avec éclairage' }, { id: 'no', label: 'Sans éclairage' }].map(option => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.filterOption,
                    terrainLightingFilter === option.id && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setTerrainLightingFilter(option.id as 'all' | 'yes' | 'no');
                    Haptics.selectionAsync();
                  }}
                >
                  {option.id !== 'all' && (
                    <MaterialIcons name="lightbulb" size={16} color={terrainLightingFilter === option.id ? theme.primary : theme.textSecondary} style={{ marginRight: 6 }} />
                  )}
                  <Text style={[
                    styles.filterOptionText,
                    terrainLightingFilter === option.id && styles.filterOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Covered Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>COUVERTURE</Text>
            <View style={styles.filterOptions}>
              {[{ id: 'all', label: 'Tous' }, { id: 'yes', label: 'Couvert' }, { id: 'no', label: 'Extérieur' }].map(option => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.filterOption,
                    terrainCoveredFilter === option.id && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setTerrainCoveredFilter(option.id as 'all' | 'yes' | 'no');
                    Haptics.selectionAsync();
                  }}
                >
                  {option.id !== 'all' && (
                    <MaterialIcons name="roofing" size={16} color={terrainCoveredFilter === option.id ? theme.primary : theme.textSecondary} style={{ marginRight: 6 }} />
                  )}
                  <Text style={[
                    styles.filterOptionText,
                    terrainCoveredFilter === option.id && styles.filterOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Pressable style={styles.clearButton} onPress={clearTerrainFilters}>
            <Text style={styles.clearButtonText}>Effacer les filtres</Text>
          </Pressable>
          <Pressable 
            style={styles.applyButton} 
            onPress={() => setShowTerrainFilters(false)}
          >
            <Text style={styles.applyButtonText}>Appliquer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Filter Modal for Tournaments
  const TournamentFiltersModal = () => (
    <Modal
      visible={showTournamentFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowTournamentFilters(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filtrer les tournois</Text>
          <Pressable onPress={() => setShowTournamentFilters(false)}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
        </View>
        
        <ScrollView style={styles.modalContent}>
          {/* Status Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>STATUT</Text>
            <View style={styles.filterOptions}>
              {[{ id: 'all', label: 'Tous les statuts', icon: 'layers' }, { id: 'À venir', label: 'À venir', icon: 'event' }, { id: 'En cours', label: 'En cours', icon: 'play-circle' }, { id: 'Terminé', label: 'Terminé', icon: 'check-circle' }].map(status => (
                <Pressable
                  key={status.id}
                  style={[
                    styles.filterOption,
                    tournamentStatusFilter === status.id && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setTournamentStatusFilter(status.id as TournamentStatus);
                    Haptics.selectionAsync();
                  }}
                >
                  <MaterialIcons name={status.icon as any} size={16} color={tournamentStatusFilter === status.id ? theme.primary : theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[
                    styles.filterOptionText,
                    tournamentStatusFilter === status.id && styles.filterOptionTextActive
                  ]}>
                    {status.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Format Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>FORMAT</Text>
            <View style={styles.filterOptions}>
              {uniqueTournamentFormats.map(format => (
                <Pressable
                  key={format}
                  style={[
                    styles.filterOption,
                    tournamentFormatFilter === format && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setTournamentFormatFilter(format);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    tournamentFormatFilter === format && styles.filterOptionTextActive
                  ]}>
                    {format === 'all' ? 'Tous les formats' : format}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Cadrage Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>CADRAGE</Text>
            <View style={styles.filterOptions}>
              {uniqueTournamentCadrages.map(cadrage => (
                <Pressable
                  key={cadrage}
                  style={[
                    styles.filterOption,
                    tournamentCadrageFilter === cadrage && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setTournamentCadrageFilter(cadrage);
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={[
                    styles.filterOptionText,
                    tournamentCadrageFilter === cadrage && styles.filterOptionTextActive
                  ]}>
                    {cadrage === 'all' ? 'Tous les cadrages' : cadrage}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Pressable style={styles.clearButton} onPress={clearTournamentFilters}>
            <Text style={styles.clearButtonText}>Effacer les filtres</Text>
          </Pressable>
          <Pressable 
            style={styles.applyButton} 
            onPress={() => setShowTournamentFilters(false)}
          >
            <Text style={styles.applyButtonText}>Appliquer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <PlayerFiltersModal />
      <ClubFiltersModal />
      <TerrainFiltersModal />
      <TournamentFiltersModal />

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

      {/* Player Filters Button */}
      {activeTab === 'players' && (
        <Animated.View 
          entering={FadeInDown.duration(400).delay(250)}
          style={styles.filterButtonContainer}
        >
          <Pressable
            style={[
              styles.filterButton,
              activePlayerFilterCount > 0 && styles.filterButtonActive
            ]}
            onPress={() => {
              setShowPlayerFilters(true);
              Haptics.selectionAsync();
            }}
          >
            <MaterialIcons 
              name="filter-list" 
              size={20} 
              color={activePlayerFilterCount > 0 ? '#FFF' : theme.textSecondary} 
            />
            <Text style={[
              styles.filterButtonText,
              activePlayerFilterCount > 0 && styles.filterButtonTextActive
            ]}>
              Filtres
            </Text>
            {activePlayerFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activePlayerFilterCount}</Text>
              </View>
            )}
          </Pressable>
          
          {/* Quick filter chips */}
          {activePlayerFilterCount > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeFiltersScroll}
            >
              {playerClubFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setPlayerClubFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{playerClubFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {playerCityFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setPlayerCityFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{playerCityFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {playerCountryFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setPlayerCountryFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{playerCountryFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {playerLevelFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setPlayerLevelFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{playerLevelFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {playerRoleFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setPlayerRoleFilter('all')}
                >
                  <MaterialIcons name={playerRoleFilter === 'Tireur' ? 'gps-fixed' : playerRoleFilter === 'Pointeur' ? 'radio-button-on' : 'swap-horiz'} size={12} color={theme.primary} />
                  <Text style={styles.activeFilterText}>{playerRoleFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
            </ScrollView>
          )}
        </Animated.View>
      )}

      {/* Club Filters Button */}
      {activeTab === 'clubs' && (
        <Animated.View 
          entering={FadeInDown.duration(400).delay(250)}
          style={styles.filterButtonContainer}
        >
          <Pressable
            style={[
              styles.filterButton,
              activeClubFilterCount > 0 && styles.filterButtonActive
            ]}
            onPress={() => {
              setShowClubFilters(true);
              Haptics.selectionAsync();
            }}
          >
            <MaterialIcons 
              name="filter-list" 
              size={20} 
              color={activeClubFilterCount > 0 ? '#FFF' : theme.textSecondary} 
            />
            <Text style={[
              styles.filterButtonText,
              activeClubFilterCount > 0 && styles.filterButtonTextActive
            ]}>
              Filtres
            </Text>
            {activeClubFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeClubFilterCount}</Text>
              </View>
            )}
          </Pressable>
          
          {/* Quick filter chips */}
          {activeClubFilterCount > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeFiltersScroll}
            >
              {clubCityFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setClubCityFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{clubCityFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {clubCountryFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setClubCountryFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{clubCountryFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
            </ScrollView>
          )}
        </Animated.View>
      )}

      {/* Tournament Filters Button */}
      {activeTab === 'tournaments' && (
        <Animated.View 
          entering={FadeInDown.duration(400).delay(250)}
          style={styles.filterButtonContainer}
        >
          <Pressable
            style={[
              styles.filterButton,
              activeTournamentFilterCount > 0 && styles.filterButtonActive
            ]}
            onPress={() => {
              setShowTournamentFilters(true);
              Haptics.selectionAsync();
            }}
          >
            <MaterialIcons 
              name="filter-list" 
              size={20} 
              color={activeTournamentFilterCount > 0 ? '#FFF' : theme.textSecondary} 
            />
            <Text style={[
              styles.filterButtonText,
              activeTournamentFilterCount > 0 && styles.filterButtonTextActive
            ]}>
              Filtres
            </Text>
            {activeTournamentFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeTournamentFilterCount}</Text>
              </View>
            )}
          </Pressable>
          
          {/* Quick filter chips */}
          {activeTournamentFilterCount > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeFiltersScroll}
            >
              {tournamentStatusFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setTournamentStatusFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{tournamentStatusFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {tournamentFormatFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setTournamentFormatFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{tournamentFormatFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {tournamentCadrageFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setTournamentCadrageFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{tournamentCadrageFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
            </ScrollView>
          )}
        </Animated.View>
      )}

      {/* Terrain Filters Button */}
      {activeTab === 'terrains' && (
        <Animated.View 
          entering={FadeInDown.duration(400).delay(250)}
          style={styles.filterButtonContainer}
        >
          <Pressable
            style={[
              styles.filterButton,
              activeTerrainFilterCount > 0 && styles.filterButtonActive
            ]}
            onPress={() => {
              setShowTerrainFilters(true);
              Haptics.selectionAsync();
            }}
          >
            <MaterialIcons 
              name="filter-list" 
              size={20} 
              color={activeTerrainFilterCount > 0 ? '#FFF' : theme.textSecondary} 
            />
            <Text style={[
              styles.filterButtonText,
              activeTerrainFilterCount > 0 && styles.filterButtonTextActive
            ]}>
              Filtres
            </Text>
            {activeTerrainFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeTerrainFilterCount}</Text>
              </View>
            )}
          </Pressable>
          
          {/* Quick filter chips */}
          {activeTerrainFilterCount > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeFiltersScroll}
            >
              {terrainTypeFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setTerrainTypeFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{terrainTypeFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {terrainCityFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setTerrainCityFilter('all')}
                >
                  <Text style={styles.activeFilterText}>{terrainCityFilter}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {terrainLightingFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setTerrainLightingFilter('all')}
                >
                  <MaterialIcons name="lightbulb" size={12} color={theme.primary} />
                  <Text style={styles.activeFilterText}>{terrainLightingFilter === 'yes' ? 'Éclairé' : 'Non éclairé'}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
              {terrainCoveredFilter !== 'all' && (
                <Pressable 
                  style={styles.activeFilterChip}
                  onPress={() => setTerrainCoveredFilter('all')}
                >
                  <MaterialIcons name="roofing" size={12} color={theme.primary} />
                  <Text style={styles.activeFilterText}>{terrainCoveredFilter === 'yes' ? 'Couvert' : 'Extérieur'}</Text>
                  <MaterialIcons name="close" size={14} color={theme.primary} />
                </Pressable>
              )}
            </ScrollView>
          )}
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
  // Filter Button
  filterButtonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.full,
    alignSelf: 'flex-start',
    ...theme.shadows.card,
  },
  filterButtonActive: {
    backgroundColor: theme.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  filterBadge: {
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.primary,
  },
  activeFiltersScroll: {
    paddingTop: 12,
    gap: 8,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  activeFilterText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.primary,
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
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
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
    letterSpacing: 1,
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterOptionActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  filterOptionTextActive: {
    color: theme.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
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
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.primary,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
