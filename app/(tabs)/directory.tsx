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
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { Terrain, Player, Club, Tournament } from '@/services/mockData';
import { TerrainType } from '@/constants/config';
import { useLanguage } from '@/hooks/useLanguage';
import { SharedOverlayBadge } from '@/components/ui/SharedBadge';
import AdBanner from '@/components/ui/AdBanner';
import MergePickerModal from '@/components/ui/MergePickerModal';
import { Player, Club, Terrain, Tournament } from '@/services/mockData';

const { width: screenWidth } = Dimensions.get('window');

type DirectoryTab = 'players' | 'clubs' | 'terrains' | 'tournaments';
type TournamentStatus = 'all' | 'À venir' | 'En cours' | 'Terminé';

export default function DirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { players, clubs, tournaments, terrains, selfPlayer, favoriteTerrainIds, favoriteClubIds, getSharedPermission, refreshData, updatePlayer, updateClub, updateTerrain, updateTournament } = useApp();
  const { t, language } = useLanguage();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<DirectoryTab>('players');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDuplicateBanner, setShowDuplicateBanner] = useState(true);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<{ type: 'player' | 'club' | 'terrain' | 'tournament'; id: string } | null>(null);
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [quickMerging, setQuickMerging] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // Tab configuration (uses t() for labels)
  const TABS: { id: DirectoryTab; label: string; icon: string; color: string }[] = useMemo(() => [
    { id: 'players', label: t('directory', 'players'), icon: 'person', color: theme.primary },
    { id: 'clubs', label: t('directory', 'clubs'), icon: 'home', color: theme.accent },
    { id: 'terrains', label: t('directory', 'terrains'), icon: 'sports-soccer', color: theme.success },
    { id: 'tournaments', label: t('directory', 'tournaments'), icon: 'emoji-events', color: theme.carreauColor },
  ], [language]);
  
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
    terrainEnvironment: 'all' as 'all' | 'indoor' | 'outdoor',
    terrainAccess: 'all' as 'all' | 'public' | 'private',
    // Tournament filters
    tournamentStatus: 'all' as TournamentStatus,
    tournamentFormat: 'all',
    tournamentLevel: 'all',
    tournamentCategory: 'all',
    tournamentRegistration: 'all',
    tournamentScope: 'all',
    tournamentCity: 'all',
  });

  // Levenshtein-based duplicate detection
  const duplicates = useMemo(() => {
    const normalize = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const levenshtein = (a: string, b: string): number => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix: number[][] = [];
      for (let i = 0; i <= b.length; i++) matrix[i] = [i];
      for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          const cost = b[i - 1] === a[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
      }
      return matrix[b.length][a.length];
    };
    const similarity = (a: string, b: string): number => {
      const na = normalize(a);
      const nb = normalize(b);
      if (na === nb) return 100;
      if (na.includes(nb) || nb.includes(na)) return 85;
      const maxLen = Math.max(na.length, nb.length);
      if (maxLen === 0) return 0;
      return Math.round((1 - levenshtein(na, nb) / maxLen) * 100);
    };
    const findDuplicates = <T extends { id: string; name: string }>(items: T[], type: string) => {
      const pairs: { itemA: T; itemB: T; score: number; type: string; pairKey: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const score = similarity(items[i].name, items[j].name);
          if (score >= 70) {
            const pairKey = `${type}-${[items[i].id, items[j].id].sort().join('-')}`;
            if (!dismissedPairs.has(pairKey)) {
              pairs.push({ itemA: items[i], itemB: items[j], score, type, pairKey });
            }
          }
        }
      }
      return pairs;
    };
    return [
      ...findDuplicates(players, 'player'),
      ...findDuplicates(clubs, 'club'),
      ...findDuplicates(terrains, 'terrain'),
      ...findDuplicates(tournaments, 'tournament'),
    ].sort((a, b) => b.score - a.score);
  }, [players, clubs, terrains, tournaments, dismissedPairs]);

  // Set active tab from navigation param
  React.useEffect(() => {
    if (tabParam && ['players', 'clubs', 'terrains', 'tournaments'].includes(tabParam)) {
      setActiveTab(tabParam as DirectoryTab);
    }
  }, [tabParam]);

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
    tournamentLevels: ['all', ...new Set(tournaments.map(t => t.tournamentLevel).filter(Boolean))] as string[],
    tournamentCategories: ['all', ...new Set(tournaments.map(t => t.tournamentCategory).filter(Boolean))] as string[],
    tournamentRegistrations: ['all', ...new Set(tournaments.map(t => t.registrationType).filter(Boolean))] as string[],
    tournamentScopes: ['all', ...new Set(tournaments.map(t => t.tournamentScope).filter(Boolean))] as string[],
    tournamentCities: ['all', ...new Set(tournaments.map(t => t.location?.city || t.terrainName).filter(Boolean))] as string[],
  }), [players, clubs, terrains, tournaments]);

  // Active filter counts
  const activeFilterCounts = useMemo(() => ({
    players: [filters.playerClub, filters.playerCity, filters.playerCountry, filters.playerLevel, filters.playerRole].filter(f => f !== 'all').length,
    clubs: [filters.clubCity, filters.clubCountry].filter(f => f !== 'all').length,
    terrains: [filters.terrainType, filters.terrainCity, filters.terrainLighting, filters.terrainCovered, filters.terrainEnvironment, filters.terrainAccess].filter(f => f !== 'all').length,
    tournaments: [filters.tournamentStatus, filters.tournamentFormat, filters.tournamentLevel, filters.tournamentCategory, filters.tournamentRegistration, filters.tournamentScope, filters.tournamentCity].filter(f => f !== 'all').length,
  }), [filters]);

  const currentFilterCount = activeFilterCounts[activeTab];

  // Singular label for current tab
  const getTabSingular = (tab: DirectoryTab) => {
    const map: Record<DirectoryTab, string> = {
      players: t('directory', 'player'),
      clubs: t('directory', 'club'),
      terrains: t('directory', 'terrain'),
      tournaments: t('directory', 'tournament'),
    };
    return map[tab];
  };

  const getTabPlural = (tab: DirectoryTab) => {
    const map: Record<DirectoryTab, string> = {
      players: t('directory', 'playersLabel'),
      clubs: t('directory', 'clubsLabel'),
      terrains: t('directory', 'terrainsLabel'),
      tournaments: t('directory', 'tournamentsLabel'),
    };
    return map[tab];
  };

  // Search placeholders
  const getSearchPlaceholder = () => {
    const map: Record<DirectoryTab, string> = {
      players: t('directory', 'searchPlayer'),
      clubs: t('directory', 'searchClub'),
      terrains: t('directory', 'searchTerrain'),
      tournaments: t('directory', 'searchTournament'),
    };
    return map[activeTab];
  };

  // Filtered data
  const filteredPlayers = useMemo(() => {
    let result = players.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    return terrains.filter(tr => {
      const matchesSearch = tr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tr.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filters.terrainType === 'all' || tr.type === filters.terrainType;
      const matchesCity = filters.terrainCity === 'all' || tr.city === filters.terrainCity;
      const matchesLighting = filters.terrainLighting === 'all' || 
        (filters.terrainLighting === 'yes' ? tr.lighting : !tr.lighting);
      const matchesCovered = filters.terrainCovered === 'all' || 
        (filters.terrainCovered === 'yes' ? tr.covered : !tr.covered);
      const matchesEnvironment = filters.terrainEnvironment === 'all' || 
        (tr.environment || 'outdoor') === filters.terrainEnvironment;
      const matchesAccess = filters.terrainAccess === 'all' ||
        (filters.terrainAccess === 'public' ? (tr.publicAccess !== false) : (tr.publicAccess === false));
      return matchesSearch && matchesType && matchesCity && matchesLighting && matchesCovered && matchesEnvironment && matchesAccess;
    });
  }, [terrains, searchQuery, filters]);

  const filteredTournaments = useMemo(() => {
    const statusOrder: Record<string, number> = { 'En cours': 0, 'À venir': 1, 'Terminé': 2 };
    return tournaments.filter(tr => {
      const matchesSearch = tr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tr.location.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filters.tournamentStatus === 'all' || tr.status === filters.tournamentStatus;
      const matchesFormat = filters.tournamentFormat === 'all' || tr.format === filters.tournamentFormat;
      const matchesLevel = filters.tournamentLevel === 'all' || tr.tournamentLevel === filters.tournamentLevel;
      const matchesCategory = filters.tournamentCategory === 'all' || tr.tournamentCategory === filters.tournamentCategory;
      const matchesRegistration = filters.tournamentRegistration === 'all' || tr.registrationType === filters.tournamentRegistration;
      const matchesScope = filters.tournamentScope === 'all' || tr.tournamentScope === filters.tournamentScope;
      const matchesCity = filters.tournamentCity === 'all' || (tr.location?.city || tr.terrainName) === filters.tournamentCity;
      return matchesSearch && matchesStatus && matchesFormat && matchesLevel && matchesCategory && matchesRegistration && matchesScope && matchesCity;
    }).sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  }, [tournaments, searchQuery, filters]);

  const clearFilters = useCallback(() => {
    if (activeTab === 'players') {
      setFilters(f => ({ ...f, playerClub: 'all', playerCity: 'all', playerCountry: 'all', playerLevel: 'all', playerRole: 'all' }));
    } else if (activeTab === 'clubs') {
      setFilters(f => ({ ...f, clubCity: 'all', clubCountry: 'all' }));
    } else if (activeTab === 'terrains') {
      setFilters(f => ({ ...f, terrainType: 'all', terrainCity: 'all', terrainLighting: 'all', terrainCovered: 'all', terrainEnvironment: 'all', terrainAccess: 'all' }));
    } else if (activeTab === 'tournaments') {
      setFilters(f => ({ ...f, tournamentStatus: 'all', tournamentFormat: 'all', tournamentLevel: 'all', tournamentCategory: 'all', tournamentRegistration: 'all', tournamentScope: 'all', tournamentCity: 'all' }));
    }
  }, [activeTab]);

  const getTerrainTypeConfig = (type: string) => {
    return config.terrainTypes.find(tc => tc.id === type) || config.terrainTypes[0];
  };

  // Translate tournament status for display
  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      'À venir': t('tournamentStatus', 'upcoming'),
      'En cours': t('tournamentStatus', 'inProgress'),
      'Terminé': t('tournamentStatus', 'completed'),
    };
    return map[status] || status;
  };

  // Render functions
  const renderPlayer = ({ item }: { item: Player }) => {
    const isSelf = selfPlayer && item.id === selfPlayer.id;
    const sharedPerm = getSharedPermission(item.id);
    const isPublicItem = (item as any).isPublic;
    return (
      <Pressable
        style={[styles.itemCard, isSelf && styles.selfCard]}
        onPress={() => isSelf ? router.push('/player/me') : router.push(`/player/${item.id}`)}
      >
        <View style={[styles.itemAvatar, isSelf && styles.selfAvatar]}>
          {item.avatar ? (
            <Image
              source={{ uri: item.avatar }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <Text style={styles.avatarText}>
              {item.name.split(' ').map(n => n[0]).join('')}
            </Text>
          )}
          {isSelf ? (
            <View style={styles.selfBadge}>
              <MaterialIcons name="star" size={10} color="#FFF" />
            </View>
          ) : isPublicItem ? (
            <View style={styles.publicOverlay}>
              <MaterialIcons name="public" size={10} color={theme.success} />
            </View>
          ) : sharedPerm ? (
            <SharedOverlayBadge permission={sharedPerm} />
          ) : null}
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, isSelf && { color: theme.primary }]} numberOfLines={1}>
              {item.name}
            </Text>
            {isSelf && (
              <View style={styles.moiBadge}>
                <Text style={styles.moiBadgeText}>{t('directory', 'me')}</Text>
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
              <Text style={[styles.tagText, { color: theme.primary }]}>{t('roles', item.role)}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.success + '15' }]}>
              <Text style={[styles.tagText, { color: theme.success }]}>{item.stats.winRate}%</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{t('levels', item.level)}</Text>
            </View>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
      </Pressable>
    );
  };

  const renderClub = ({ item }: { item: Club }) => {
    const sharedPerm = getSharedPermission(item.id);
    const isPublicItem = (item as any).isPublic;
    const isFavorite = favoriteClubIds.includes(item.id);
    return (
      <Pressable
        style={[styles.itemCard, isFavorite && styles.favoriteCard]}
        onPress={() => router.push(`/club/${item.id}`)}
      >
        <View style={[styles.itemAvatar, { backgroundColor: theme.accent }]}>
          <MaterialIcons name="home" size={24} color="#FFF" />
          {isFavorite ? (
            <View style={styles.favoriteBadge}>
              <MaterialIcons name="favorite" size={10} color={theme.error} />
            </View>
          ) : isPublicItem ? (
            <View style={styles.publicOverlay}>
              <MaterialIcons name="public" size={10} color={theme.success} />
            </View>
          ) : sharedPerm ? <SharedOverlayBadge permission={sharedPerm} /> : null}
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
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{t('directory', 'since')} {item.foundedYear}</Text>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
      </Pressable>
    );
  };

  const renderTerrain = ({ item }: { item: Terrain }) => {
    const typeConfig = getTerrainTypeConfig(item.type);
    const isFavorite = favoriteTerrainIds.includes(item.id);
    const sharedPerm = getSharedPermission(item.id);
    const isPublicItem = (item as any).isPublic;
    return (
      <Pressable
        style={[styles.itemCard, isFavorite && styles.favoriteCard]}
        onPress={() => router.push(`/terrain/${item.id}`)}
      >
        <View style={[styles.itemAvatar, { backgroundColor: theme.success }]}>
          {item.photos && item.photos.length > 0 ? (
            <Image
              source={{ uri: item.photos[0] }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <MaterialIcons name={typeConfig.icon as any} size={24} color="#FFF" />
          )}
          {isFavorite ? (
            <View style={styles.favoriteBadge}>
              <MaterialIcons name="favorite" size={10} color={theme.error} />
            </View>
          ) : isPublicItem ? (
            <View style={styles.publicOverlay}>
              <MaterialIcons name="public" size={10} color={theme.success} />
            </View>
          ) : sharedPerm ? (
            <SharedOverlayBadge permission={sharedPerm} />
          ) : null}
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
              <Text style={[styles.tagText, { color: theme.success }]}>{t('terrainTypes', item.type)}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>
                {item.courtsCount} {item.courtsCount > 1 ? t('directory', 'terrainCountPlural') : t('directory', 'terrainCount')}
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
            {item.publicAccess === false ? (
              <View style={[styles.tag, { backgroundColor: theme.error + '15' }]}>
                <MaterialIcons name="lock" size={10} color={theme.error} />
                <Text style={[styles.tagText, { color: theme.error }]}>{t('directory', 'privateAccessShort')}</Text>
              </View>
            ) : null}
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
    const sharedPerm = getSharedPermission(item.id);
    const isPublicItem = (item as any).isPublic;
    
    return (
      <Pressable
        style={styles.itemCard}
        onPress={() => router.push(`/tournament/${item.id}`)}
      >
        <View style={[styles.itemAvatar, { backgroundColor: theme.carreauColor }]}>
          <MaterialIcons name="emoji-events" size={24} color="#FFF" />
          {isPublicItem ? (
            <View style={styles.publicOverlay}>
              <MaterialIcons name="public" size={10} color={theme.success} />
            </View>
          ) : sharedPerm ? <SharedOverlayBadge permission={sharedPerm} /> : null}
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.itemMeta}>
            <View style={styles.metaItem}>
              <MaterialIcons name="event" size={12} color={theme.textMuted} />
              <Text style={styles.metaText}>
                {new Date(item.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="place" size={12} color={theme.textMuted} />
              <Text style={styles.metaText}>{item.terrainName || item.location.city}</Text>
            </View>
          </View>
          <View style={styles.itemTags}>
            <View style={[styles.tag, { backgroundColor: status.bg }]}>
              <Text style={[styles.tagText, { color: status.color }]}>{getStatusLabel(item.status)}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{t('formats', item.format)}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.tagText, { color: theme.textSecondary }]}>{t('tournamentTypes', item.type)}</Text>
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
              title={t('directory', 'role')}
              options={uniqueValues.playerRoles}
              value={filters.playerRole}
              onChange={(v) => setFilters(f => ({ ...f, playerRole: v }))}
              icons={{ 'Pointeur': 'radio-button-on', 'Tireur': 'gps-fixed', 'Milieu': 'swap-horiz' }}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'level')}
              options={uniqueValues.playerLevels}
              value={filters.playerLevel}
              onChange={(v) => setFilters(f => ({ ...f, playerLevel: v }))}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'clubs')}
              options={uniqueValues.playerClubs}
              value={filters.playerClub}
              onChange={(v) => setFilters(f => ({ ...f, playerClub: v }))}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'city')}
              options={uniqueValues.playerCities}
              value={filters.playerCity}
              onChange={(v) => setFilters(f => ({ ...f, playerCity: v }))}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'country')}
              options={uniqueValues.playerCountries}
              value={filters.playerCountry}
              onChange={(v) => setFilters(f => ({ ...f, playerCountry: v }))}
              allLabel={t('directory', 'allLabel')}
            />
          </>
        );
      case 'clubs':
        return (
          <>
            <FilterSection
              title={t('directory', 'city')}
              options={uniqueValues.clubCities}
              value={filters.clubCity}
              onChange={(v) => setFilters(f => ({ ...f, clubCity: v }))}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'country')}
              options={uniqueValues.clubCountries}
              value={filters.clubCountry}
              onChange={(v) => setFilters(f => ({ ...f, clubCountry: v }))}
              allLabel={t('directory', 'allLabel')}
            />
          </>
        );
      case 'terrains':
        return (
          <>
            <FilterSection
              title={t('directory', 'environmentLabel')}
              options={['all', 'indoor', 'outdoor']}
              labels={{ all: t('directory', 'allLabel'), indoor: t('directory', 'indoorLabel'), outdoor: t('directory', 'outdoorLabel') }}
              value={filters.terrainEnvironment}
              onChange={(v) => setFilters(f => ({ ...f, terrainEnvironment: v as 'all' | 'indoor' | 'outdoor' }))}
              icons={{ indoor: 'domain', outdoor: 'park' }}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'surfaceType')}
              options={['all', ...config.terrainTypes.map(tc => tc.id)]}
              labels={{ all: t('directory', 'allLabel'), ...Object.fromEntries(config.terrainTypes.map(tc => [tc.id, t('terrainTypes', tc.id)])) }}
              value={filters.terrainType}
              onChange={(v) => setFilters(f => ({ ...f, terrainType: v as TerrainType | 'all' }))}
              icons={Object.fromEntries(config.terrainTypes.map(tc => [tc.id, tc.icon]))}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'city')}
              options={uniqueValues.terrainCities}
              value={filters.terrainCity}
              onChange={(v) => setFilters(f => ({ ...f, terrainCity: v }))}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'lightingLabel')}
              options={['all', 'yes', 'no']}
              labels={{ all: t('directory', 'allLabel'), yes: t('directory', 'withLighting'), no: t('directory', 'withoutLighting') }}
              value={filters.terrainLighting}
              onChange={(v) => setFilters(f => ({ ...f, terrainLighting: v as 'all' | 'yes' | 'no' }))}
              icons={{ yes: 'lightbulb', no: 'lightbulb-outline' }}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'coverLabel')}
              options={['all', 'yes', 'no']}
              labels={{ all: t('directory', 'allLabel'), yes: t('directory', 'coveredLabel'), no: t('directory', 'outdoorCover') }}
              value={filters.terrainCovered}
              onChange={(v) => setFilters(f => ({ ...f, terrainCovered: v as 'all' | 'yes' | 'no' }))}
              icons={{ yes: 'roofing', no: 'wb-sunny' }}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'accessFilterLabel')}
              options={['all', 'public', 'private']}
              labels={{ all: t('directory', 'allLabel'), public: t('directory', 'publicAccessLabel'), private: t('directory', 'privateAccessLabel') }}
              value={filters.terrainAccess}
              onChange={(v) => setFilters(f => ({ ...f, terrainAccess: v as 'all' | 'public' | 'private' }))}
              icons={{ public: 'public', private: 'lock' }}
              allLabel={t('directory', 'allLabel')}
            />
          </>
        );
      case 'tournaments':
        return (
          <>
            <FilterSection
              title={t('directory', 'status')}
              options={['all', 'À venir', 'En cours', 'Terminé']}
              labels={{ all: t('directory', 'allLabel'), 'À venir': t('tournamentStatus', 'upcoming'), 'En cours': t('tournamentStatus', 'inProgress'), 'Terminé': t('tournamentStatus', 'completed') }}
              value={filters.tournamentStatus}
              onChange={(v) => setFilters(f => ({ ...f, tournamentStatus: v as TournamentStatus }))}
              icons={{ 'À venir': 'event', 'En cours': 'play-circle', 'Terminé': 'check-circle' }}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'locationLabel')}
              options={uniqueValues.tournamentCities}
              value={filters.tournamentCity}
              onChange={(v) => setFilters(f => ({ ...f, tournamentCity: v }))}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={t('directory', 'format')}
              options={uniqueValues.tournamentFormats}
              value={filters.tournamentFormat}
              onChange={(v) => setFilters(f => ({ ...f, tournamentFormat: v }))}
              allLabel={t('directory', 'allLabel')}
            />
            {uniqueValues.tournamentLevels.length > 1 && (
              <FilterSection
                title={t('directory', 'level')}
                options={uniqueValues.tournamentLevels}
                value={filters.tournamentLevel}
                onChange={(v) => setFilters(f => ({ ...f, tournamentLevel: v }))}
                icons={{ 'Loisir / Amical': 'mood', 'Promotion': 'trending-up', 'Honneur': 'star', 'Élite': 'emoji-events' }}
                labels={Object.fromEntries(uniqueValues.tournamentLevels.map(l => [l, l === 'all' ? t('directory', 'allLabel') : t('tournamentLevels', l)]))}
                allLabel={t('directory', 'allLabel')}
              />
            )}
            {uniqueValues.tournamentCategories.length > 1 && (
              <FilterSection
                title={t('directory', 'tournamentType')}
                options={uniqueValues.tournamentCategories}
                labels={Object.fromEntries(uniqueValues.tournamentCategories.map(c => [c, c === 'all' ? t('directory', 'allLabel') : t('tournamentCategories', c)]))}
                value={filters.tournamentCategory}
                onChange={(v) => setFilters(f => ({ ...f, tournamentCategory: v }))}
                allLabel={t('directory', 'allLabel')}
              />
            )}
            {uniqueValues.tournamentRegistrations.length > 1 && (
              <FilterSection
                title={t('directory', 'registrationType')}
                options={uniqueValues.tournamentRegistrations}
                value={filters.tournamentRegistration}
                onChange={(v) => setFilters(f => ({ ...f, tournamentRegistration: v }))}
                labels={Object.fromEntries(uniqueValues.tournamentRegistrations.map(r => [r, r === 'all' ? t('directory', 'allLabel') : t('registrationTypes', r)]))}
                icons={{ 'Inscription libre': 'lock-open', 'Sur invitation': 'mail', 'Réservé aux licenciés': 'verified', 'Ouvert': 'public' }}
                allLabel={t('directory', 'allLabel')}
              />
            )}
            {uniqueValues.tournamentScopes.length > 1 && (
              <FilterSection
                title={t('directory', 'scopeLabel')}
                options={uniqueValues.tournamentScopes}
                value={filters.tournamentScope}
                onChange={(v) => setFilters(f => ({ ...f, tournamentScope: v }))}
                labels={Object.fromEntries(uniqueValues.tournamentScopes.map(s => [s, s === 'all' ? t('directory', 'allLabel') : t('tournamentScopes', s)]))}
                icons={{ 'Tournoi de club': 'home', 'Championnat départemental': 'place', 'Championnat régional': 'map', 'Championnat national': 'flag', 'Championnat international': 'public' }}
                allLabel={t('directory', 'allLabel')}
              />
            )}
          </>
        );
    }
  };

  const tabConfig = TABS.find(tc => tc.id === activeTab);
  const currentData = getCurrentData();
  const dataCount = currentData.length;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{t('directory', 'directory')}</Text>
          <View style={styles.headerStats}>
            <Text style={styles.headerStatsText}>
              {counts.players + counts.clubs + counts.terrains + counts.tournaments} {t('directory', 'items')}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={getSearchPlaceholder()}
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
              <Text style={styles.clearAllText}>{t('directory', 'clearLabel')}</Text>
            </Pressable>
            {activeTab === 'players' && (
              <>
                {filters.playerRole !== 'all' && <ActiveFilterChip label={t('roles', filters.playerRole)} onRemove={() => setFilters(f => ({ ...f, playerRole: 'all' }))} />}
                {filters.playerLevel !== 'all' && <ActiveFilterChip label={t('levels', filters.playerLevel)} onRemove={() => setFilters(f => ({ ...f, playerLevel: 'all' }))} />}
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
                {filters.terrainEnvironment !== 'all' && <ActiveFilterChip label={filters.terrainEnvironment === 'indoor' ? t('directory', 'indoorShort') : t('directory', 'outdoorShort')} onRemove={() => setFilters(f => ({ ...f, terrainEnvironment: 'all' }))} icon={filters.terrainEnvironment === 'indoor' ? 'domain' : 'park'} />}
                {filters.terrainType !== 'all' && <ActiveFilterChip label={t('terrainTypes', filters.terrainType)} onRemove={() => setFilters(f => ({ ...f, terrainType: 'all' }))} />}
                {filters.terrainCity !== 'all' && <ActiveFilterChip label={filters.terrainCity} onRemove={() => setFilters(f => ({ ...f, terrainCity: 'all' }))} />}
                {filters.terrainLighting !== 'all' && <ActiveFilterChip label={filters.terrainLighting === 'yes' ? t('directory', 'litLabel') : t('directory', 'notLitLabel')} onRemove={() => setFilters(f => ({ ...f, terrainLighting: 'all' }))} icon="lightbulb" />}
                {filters.terrainCovered !== 'all' && <ActiveFilterChip label={filters.terrainCovered === 'yes' ? t('directory', 'coveredLabel') : t('directory', 'outdoorShort')} onRemove={() => setFilters(f => ({ ...f, terrainCovered: 'all' }))} icon="roofing" />}
                {filters.terrainAccess !== 'all' && <ActiveFilterChip label={filters.terrainAccess === 'public' ? t('directory', 'publicAccessShort') : t('directory', 'privateAccessShort')} onRemove={() => setFilters(f => ({ ...f, terrainAccess: 'all' }))} icon={filters.terrainAccess === 'public' ? 'public' : 'lock'} />}
              </>
            )}
            {activeTab === 'tournaments' && (
              <>
                {filters.tournamentStatus !== 'all' && <ActiveFilterChip label={getStatusLabel(filters.tournamentStatus)} onRemove={() => setFilters(f => ({ ...f, tournamentStatus: 'all' }))} icon="event" />}
                {filters.tournamentCity !== 'all' && <ActiveFilterChip label={filters.tournamentCity} onRemove={() => setFilters(f => ({ ...f, tournamentCity: 'all' }))} icon="place" />}
                {filters.tournamentFormat !== 'all' && <ActiveFilterChip label={t('formats', filters.tournamentFormat)} onRemove={() => setFilters(f => ({ ...f, tournamentFormat: 'all' }))} />}
                {filters.tournamentLevel !== 'all' && <ActiveFilterChip label={t('tournamentLevels', filters.tournamentLevel)} onRemove={() => setFilters(f => ({ ...f, tournamentLevel: 'all' }))} icon="star" />}
                {filters.tournamentCategory !== 'all' && <ActiveFilterChip label={t('tournamentCategories', filters.tournamentCategory)} onRemove={() => setFilters(f => ({ ...f, tournamentCategory: 'all' }))} />}
                {filters.tournamentRegistration !== 'all' && <ActiveFilterChip label={t('registrationTypes', filters.tournamentRegistration)} onRemove={() => setFilters(f => ({ ...f, tournamentRegistration: 'all' }))} />}
                {filters.tournamentScope !== 'all' && <ActiveFilterChip label={t('tournamentScopes', filters.tournamentScope)} onRemove={() => setFilters(f => ({ ...f, tournamentScope: 'all' }))} icon="flag" />}
              </>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {dataCount} {dataCount !== 1 ? getTabPlural(activeTab) : getTabSingular(activeTab)}
        </Text>
        {searchQuery ? (
          <Text style={styles.searchingFor}>{t('directory', 'forSearch')} "{searchQuery}"</Text>
        ) : null}
      </View>

      {/* Duplicate Detection Banner */}
      {duplicates.length > 0 && showDuplicateBanner ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.duplicateBanner}>
          <View style={styles.duplicateBannerIcon}>
            <MaterialIcons name="content-copy" size={18} color={theme.warning} />
          </View>
          <View style={styles.duplicateBannerContent}>
            <Text style={styles.duplicateBannerTitle}>{t('directory', 'duplicateBannerTitle')}</Text>
            <Text style={styles.duplicateBannerDesc}>{duplicates.length} {t('directory', 'duplicateBannerDesc')}</Text>
          </View>
          <Pressable
            style={styles.duplicateBannerBtn}
            onPress={() => { Haptics.selectionAsync(); setShowDuplicateModal(true); }}
          >
            <Text style={styles.duplicateBannerBtnText}>{t('directory', 'duplicateBannerAction')}</Text>
          </Pressable>
          <Pressable style={styles.duplicateBannerClose} onPress={() => setShowDuplicateBanner(false)} hitSlop={8}>
            <MaterialIcons name="close" size={14} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Ad Banner */}
      <AdBanner position="inline" />

      {/* List */}
      <View style={styles.listContainer}>
        <FlashList
          data={currentData}
          renderItem={getCurrentRenderItem() as any}
          estimatedItemSize={110}
          contentContainerStyle={{ 
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name={tabConfig?.icon as any || 'search'} size={48} color={theme.textMuted} />
              <Text style={styles.emptyTitle}>{t('directory', 'noResultsFound')}</Text>
              <Text style={styles.emptyText}>
                {searchQuery 
                  ? `${language === 'fr' ? 'Aucun' : 'No'} ${getTabSingular(activeTab)} ${t('directory', 'noMatchSearch')} "${searchQuery}"`
                  : currentFilterCount > 0 
                    ? t('directory', 'tryModifyFilters')
                    : `${language === 'fr' ? 'Aucun' : 'No'} ${getTabSingular(activeTab)} ${t('directory', 'noRegistered')}`
                }
              </Text>
            </View>
          }
        />
      </View>

      {/* Duplicate Detection Modal */}
      <Modal
        visible={showDuplicateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.modalIcon, { backgroundColor: theme.warning + '15' }]}>
                <MaterialIcons name="content-copy" size={20} color={theme.warning} />
              </View>
              <Text style={styles.modalTitle}>{t('directory', 'duplicateModalTitle')}</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={() => setShowDuplicateModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {duplicates.map((dup, idx) => {
              const typeIcons: Record<string, { icon: string; color: string }> = {
                player: { icon: 'person', color: theme.primary },
                club: { icon: 'home', color: theme.accent },
                terrain: { icon: 'sports-soccer', color: theme.success },
                tournament: { icon: 'emoji-events', color: theme.carreauColor },
              };
              const cfg = typeIcons[dup.type] || typeIcons.player;
              return (
                <View key={dup.pairKey} style={styles.duplicateCard}>
                  <View style={styles.duplicateCardHeader}>
                    <View style={[styles.duplicateTypeIcon, { backgroundColor: cfg.color + '15' }]}>
                      <MaterialIcons name={cfg.icon as any} size={16} color={cfg.color} />
                    </View>
                    <View style={styles.duplicateScoreBadge}>
                      <Text style={styles.duplicateScoreText}>{dup.score}%</Text>
                    </View>
                  </View>
                  <View style={styles.duplicateNames}>
                    <View style={styles.duplicateNameItem}>
                      <Text style={styles.duplicateNameText} numberOfLines={1}>{dup.itemA.name}</Text>
                    </View>
                    <MaterialIcons name="compare-arrows" size={18} color={theme.textMuted} />
                    <View style={styles.duplicateNameItem}>
                      <Text style={styles.duplicateNameText} numberOfLines={1}>{dup.itemB.name}</Text>
                    </View>
                  </View>
                  {/* Quick merge for >90% */}
                  {dup.score >= 90 ? (
                    <Pressable
                      style={styles.quickMergeBtn}
                      onPress={async () => {
                        Haptics.selectionAsync();
                        setQuickMerging(dup.pairKey);
                        try {
                          const a = dup.itemA as any;
                          const b = dup.itemB as any;
                          const pick = (va: any, vb: any) => {
                            const sa = typeof va === 'string' ? va.trim() : '';
                            const sb = typeof vb === 'string' ? vb.trim() : '';
                            if (!sa && !sb) return undefined;
                            if (!sa) return vb;
                            if (!sb) return va;
                            return sa.length >= sb.length ? va : vb;
                          };
                          const pickNum = (va: any, vb: any) => {
                            if (va && !vb) return va;
                            if (!va && vb) return vb;
                            if (va && vb) return Math.max(Number(va), Number(vb));
                            return undefined;
                          };
                          const pickObj = (va: any, vb: any) => {
                            if (va && !vb) return va;
                            if (!va && vb) return vb;
                            if (va && vb) return JSON.stringify(va).length >= JSON.stringify(vb).length ? va : vb;
                            return undefined;
                          };
                          const pickArr = (va: any, vb: any) => {
                            const aa = Array.isArray(va) ? va : [];
                            const ab = Array.isArray(vb) ? vb : [];
                            return aa.length >= ab.length ? (aa.length > 0 ? va : undefined) : (ab.length > 0 ? vb : undefined);
                          };
                          let updates: Record<string, any> = {};
                          let count = 0;
                          const fields = Object.keys(b).filter(k => !['id', 'userId', 'user_id', 'createdAt', 'created_at', 'updatedAt', 'updated_at', 'stats'].includes(k));
                          for (const k of fields) {
                            const va = a[k];
                            const vb = b[k];
                            let best;
                            if (typeof va === 'object' && !Array.isArray(va) && va !== null) best = pickObj(va, vb);
                            else if (Array.isArray(va) || Array.isArray(vb)) best = pickArr(va, vb);
                            else if (typeof va === 'number' || typeof vb === 'number') best = pickNum(va, vb);
                            else best = pick(va, vb);
                            if (best !== undefined && JSON.stringify(best) !== JSON.stringify(va)) {
                              updates[k] = best;
                              count++;
                            }
                          }
                          if (count > 0) {
                            const updaters: Record<string, (id: string, u: any) => Promise<void>> = {
                              player: updatePlayer, club: updateClub, terrain: updateTerrain, tournament: updateTournament,
                            };
                            const updater = updaters[dup.type];
                            if (updater) await updater(a.id, updates);
                          }
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          setDismissedPairs(prev => new Set([...prev, dup.pairKey]));
                        } catch (e) { /* silent */ }
                        setQuickMerging(null);
                      }}
                      disabled={quickMerging === dup.pairKey}
                    >
                      <MaterialIcons name="auto-fix-high" size={14} color="#FFF" />
                      <Text style={styles.quickMergeBtnText}>
                        {quickMerging === dup.pairKey ? '...' : t('directory', 'duplicateQuickMerge')}
                      </Text>
                    </Pressable>
                  ) : null}
                  <View style={styles.duplicateActions}>
                    <Pressable
                      style={styles.duplicateMergeBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setShowDuplicateModal(false);
                        setMergeTarget({ type: dup.type as any, id: dup.itemA.id });
                      }}
                    >
                      <MaterialIcons name="merge-type" size={16} color="#FFF" />
                      <Text style={styles.duplicateMergeBtnText}>{t('directory', 'duplicateMerge')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.duplicateDismissBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setDismissedPairs(prev => new Set([...prev, dup.pairKey]));
                      }}
                    >
                      <MaterialIcons name="visibility-off" size={16} color={theme.textSecondary} />
                      <Text style={styles.duplicateDismissBtnText}>{t('directory', 'duplicateDismiss')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {duplicates.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="check-circle" size={48} color={theme.success} />
                <Text style={[styles.emptyTitle, { color: theme.success }]}>{t('common', 'noResults')}</Text>
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Merge Picker Modal */}
      {mergeTarget ? (
        <MergePickerModal
          visible={!!mergeTarget}
          onClose={() => setMergeTarget(null)}
          itemType={mergeTarget.type}
          currentItemId={mergeTarget.id}
        />
      ) : null}

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
              <Text style={styles.modalTitle}>
                {activeTab === 'players' ? t('directory', 'filterPlayers') :
                 activeTab === 'clubs' ? t('directory', 'filterClubs') :
                 activeTab === 'terrains' ? t('directory', 'filterTerrains') :
                 t('directory', 'filterTournaments')}
              </Text>
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
              <Text style={styles.clearButtonText}>{t('directory', 'clearAll')}</Text>
            </Pressable>
            <Pressable 
              style={[styles.applyButton, { backgroundColor: tabConfig?.color }]}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>
                {t('directory', 'seeResults')} {dataCount} {dataCount !== 1 ? t('directory', 'resultCountPlural') : t('directory', 'resultCount')}
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
  icons = {},
  allLabel = 'Tous',
}: { 
  title: string; 
  options: string[]; 
  value: string; 
  onChange: (v: string) => void;
  labels?: Record<string, string>;
  icons?: Record<string, string>;
  allLabel?: string;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <View style={styles.filterOptions}>
        {options.map(option => {
          const isActive = value === option;
          const label = labels[option] || (option === 'all' ? allLabel : option);
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
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 14,
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
  publicOverlay: {
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
  // Duplicate Banner
  duplicateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: theme.warning + '08',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.warning + '25',
  },
  duplicateBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.warning + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  duplicateBannerContent: { flex: 1 },
  duplicateBannerTitle: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  duplicateBannerDesc: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  duplicateBannerBtn: {
    backgroundColor: theme.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 8,
  },
  duplicateBannerBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  duplicateBannerClose: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Duplicate Modal Cards
  duplicateCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  duplicateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  duplicateTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateScoreBadge: {
    backgroundColor: theme.warning + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  duplicateScoreText: { fontSize: 13, fontWeight: '700', color: theme.warning },
  duplicateNames: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  duplicateNameItem: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
  },
  duplicateNameText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, textAlign: 'center' },
  duplicateActions: {
    flexDirection: 'row',
    gap: 10,
  },
  duplicateMergeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  duplicateMergeBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  duplicateDismissBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.backgroundSecondary,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  duplicateDismissBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  quickMergeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.success,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
  },
  quickMergeBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
