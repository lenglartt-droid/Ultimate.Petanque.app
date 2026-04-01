import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';

import * as Haptics from '@/services/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import theme, { blurhash } from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { Terrain, Player, Club, Tournament } from '@/types/petanque';
import { TerrainType } from '@/constants/config';
import { useLanguage } from '@/hooks/useLanguage';
import { SharedOverlayBadge } from '@/components/ui/SharedBadge';
import AdBanner from '@/components/ui/AdBanner';
import SponsorBanner from '@/components/ui/SponsorBanner';
import { getSponsoredEvents, SponsoredEvent } from '@/services/sponsoredEventService';
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';

import MergePickerModal from '@/components/ui/MergePickerModal';
import { getEloRank, getEloColor, ELO_INITIAL, ELO_RANKS } from '@/services/eloService';
import { saveMergeLog, getMergeLogs, undoMerge, isUndoable, getUndoTimeRemaining, deleteMergeLog, MergeLog, ReassignedRelation } from '@/services/mergeHistoryService';
import { getMyActiveMeetups, inviteSingleUserToMeetup, Meetup } from '@/services/meetupService';
import { useAuth, useAlert } from '@/template';

type DirectoryTab = 'players' | 'clubs' | 'terrains' | 'tournaments' | 'events';
type TournamentStatus = 'all' | 'À venir' | 'En cours' | 'Terminé';

export default function DirectoryScreen() {
  const insets = useSafeAreaInsets();
  const { players, clubs, tournaments, terrains, selfPlayer, favoriteTerrainIds, favoriteClubIds, getSharedPermission, refreshData, updatePlayer, updateClub, updateTerrain, updateTournament, deletePlayer, deleteClub, deleteTerrain, deleteTournament } = useApp();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // Meetup invitation state
  const [showMeetupPicker, setShowMeetupPicker] = useState(false);
  const [meetupPickerUserId, setMeetupPickerUserId] = useState<string | null>(null);
  const [meetupPickerUserName, setMeetupPickerUserName] = useState('');
  const [activeMeetups, setActiveMeetups] = useState<Meetup[]>([]);
  const [loadingMeetups, setLoadingMeetups] = useState(false);
  const [invitingToMeetup, setInvitingToMeetup] = useState<string | null>(null);

  const handleInviteToMeetup = useCallback(async (targetUserId: string, targetName: string) => {
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

  const handleConfirmInvite = useCallback(async (meetupId: string) => {
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
      showAlert(t('meetup', 'inviteSentSuccess'), t('meetup', 'inviteSentSuccessDesc'));
      setShowMeetupPicker(false);
    }
  }, [meetupPickerUserId, showAlert, t]);
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<DirectoryTab>('players');

  // Responsive dimensions for tablet
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width || 375);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;
  const numColumns = isTablet ? 2 : 1;
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRealUsersOnly, setShowRealUsersOnly] = useState(false);
  // Pagination state
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showDuplicateBanner, setShowDuplicateBanner] = useState(true);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<{ type: 'player' | 'club' | 'terrain' | 'tournament'; id: string } | null>(null);
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [quickMerging, setQuickMerging] = useState<string | null>(null);
  const [showMergeHistory, setShowMergeHistory] = useState(false);
  const [mergeLogs, setMergeLogs] = useState<MergeLog[]>([]);
  const [loadingMergeLogs, setLoadingMergeLogs] = useState(false);
  const [undoingMerge, setUndoingMerge] = useState<string | null>(null);

  const loadMergeLogs = useCallback(async () => {
    setLoadingMergeLogs(true);
    const { logs } = await getMergeLogs();
    setMergeLogs(logs);
    setLoadingMergeLogs(false);
  }, []);

  const handleUndoMerge = useCallback(async (log: MergeLog) => {
    setUndoingMerge(log.id);
    const { error } = await undoMerge(log);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshData();
    }
    setMergeLogs(prev => prev.filter(l => l.id !== log.id));
    setUndoingMerge(null);
  }, [refreshData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // Events state
  const [sponsoredEvents, setSponsoredEvents] = useState<SponsoredEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Partner data for tier badges in directory — lazy loaded
  const [partnerUserIds, setPartnerUserIds] = useState<Map<string, { tier: string; name: string }>>(new Map());
  const partnerLoaded = useRef(false);
  useEffect(() => {
    // Defer partner badge loading to avoid blocking initial render
    const timer = setTimeout(() => {
      if (partnerLoaded.current) return;
      partnerLoaded.current = true;
      fetchAmbassadors().then(({ ambassadors }) => {
        const map = new Map<string, { tier: string; name: string }>();
        ambassadors.forEach(a => {
          if (a.badgeType === 'gold_sponsor' || a.badgeType === 'sponsor' || a.badgeType === 'partner') {
            map.set(a.userId, { tier: a.badgeType, name: a.displayName });
          }
        });
        setPartnerUserIds(map);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, []);
  const loadSponsoredEvents = useCallback(async () => {
    setEventsLoading(true);
    const [r1, r2, r3] = await Promise.all([getSponsoredEvents(), getSponsoredEvents('completed'), getSponsoredEvents('cancelled')]);
    const all = [...r1.events];
    r2.events.forEach(e => { if (!all.find(x => x.id === e.id)) all.push(e); });
    r3.events.forEach(e => { if (!all.find(x => x.id === e.id)) all.push(e); });
    all.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    setSponsoredEvents(all);
    setEventsLoading(false);
  }, []);
  useEffect(() => { loadSponsoredEvents(); }, [loadSponsoredEvents]);

  // Tab configuration (uses t() for labels)
  const TABS: { id: DirectoryTab; label: string; icon: string; color: string }[] = useMemo(() => [
    { id: 'players', label: t('directory', 'players'), icon: 'person', color: theme.primary },
    { id: 'clubs', label: t('directory', 'clubs'), icon: 'home', color: theme.accent },
    { id: 'terrains', label: t('directory', 'terrains'), icon: 'sports-soccer', color: theme.success },
    { id: 'tournaments', label: t('directory', 'tournaments'), icon: 'emoji-events', color: theme.carreauColor },
    { id: 'events', label: language === 'fr' ? 'Defis' : 'Challenges', icon: 'campaign', color: '#7C3AED' },
  ], [language]);

  // Dynamic gradient colors per tab
  const activeGradient: [string, string, string] = useMemo(() => {
    const gradients: Record<DirectoryTab, [string, string, string]> = {
      players: ['#0F172A', '#1E3A8A', '#2563EB'],
      clubs: ['#451A03', '#92400E', '#D97706'],
      terrains: ['#022C22', '#064E3B', '#10B981'],
      tournaments: ['#451A03', '#78350F', '#B45309'],
      events: ['#4C1D95', '#6D28D9', '#7C3AED'],
    };
    return gradients[activeTab];
  }, [activeTab]);

  const activeTabColor = useMemo(() => {
    const colors: Record<DirectoryTab, string> = {
      players: theme.primary,
      clubs: theme.accent,
      terrains: theme.success,
      tournaments: theme.carreauColor,
      events: '#7C3AED',
    };
    return colors[activeTab];
  }, [activeTab]);

  // All filters state
  const [filters, setFilters] = useState<{
    playerClub: string; playerCity: string; playerCountry: string; playerLevel: string; playerRole: string; playerEloRank: string;
    clubCity: string; clubCountry: string;
    terrainType: string; terrainCity: string; terrainLighting: string; terrainCovered: string; terrainEnvironment: string; terrainAccess: string;
    tournamentStatus: string; tournamentFormat: string; tournamentLevel: string; tournamentCategory: string; tournamentRegistration: string; tournamentScope: string; tournamentCity: string;
    eventStatus: string; eventType: string; eventAmbassador: string;
  }>({
    // Player filters
    playerClub: 'all',
    playerCity: 'all',
    playerCountry: 'all',
    playerLevel: 'all',
    playerRole: 'all',
    playerEloRank: 'all',
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
    // Event filters
    eventStatus: 'all',
    eventType: 'all',
    eventAmbassador: 'all',
  });

  // Reset pagination when tab or filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchQuery, filters, showRealUsersOnly]);

  // Levenshtein-based duplicate detection — debounced for performance
  // Stable fingerprint to avoid recalculating when data hasn't changed
  const dataFingerprint = useMemo(() => {
    return `${players.length}-${clubs.length}-${terrains.length}-${tournaments.length}-${dismissedPairs.size}`;
  }, [players.length, clubs.length, terrains.length, tournaments.length, dismissedPairs.size]);

  const [duplicates, setDuplicates] = useState<{ itemA: any; itemB: any; score: number; type: string; pairKey: string }[]>([]);
  const duplicateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Debounce duplicate calculation by 500ms to avoid blocking UI
    if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current);
    duplicateTimerRef.current = setTimeout(() => {
      const normalize = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const levenshtein = (a: string, b: string): number => {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        // Optimized: early exit if length difference makes threshold impossible
        const maxLen = Math.max(a.length, b.length);
        if (Math.abs(a.length - b.length) > maxLen * 0.3) return maxLen;
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
        // Cap comparison to first 100 items to avoid O(n^2) explosion
        const capped = items.slice(0, 100);
        for (let i = 0; i < capped.length; i++) {
          for (let j = i + 1; j < capped.length; j++) {
            const score = similarity(capped[i].name, capped[j].name);
            if (score >= 70) {
              const pairKey = `${type}-${[capped[i].id, capped[j].id].sort().join('-')}`;
              if (!dismissedPairs.has(pairKey)) {
                pairs.push({ itemA: capped[i], itemB: capped[j], score, type, pairKey });
              }
            }
          }
        }
        return pairs;
      };
      const result = [
        ...findDuplicates(players, 'player'),
        ...findDuplicates(clubs, 'club'),
        ...findDuplicates(terrains, 'terrain'),
        ...findDuplicates(tournaments, 'tournament'),
      ].sort((a, b) => b.score - a.score);
      setDuplicates(result);
    }, 500);
    return () => { if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current); };
  }, [dataFingerprint, players, clubs, terrains, tournaments, dismissedPairs]);

  // Set active tab from navigation param
  React.useEffect(() => {
    if (tabParam && ['players', 'clubs', 'terrains', 'tournaments', 'events'].includes(tabParam)) {
      setActiveTab(tabParam as DirectoryTab);
    }
  }, [tabParam]);

  // Counts for tabs
  const counts = useMemo(() => ({
    players: players.length,
    clubs: clubs.length,
    terrains: terrains.length,
    tournaments: tournaments.length,
    events: sponsoredEvents.length,
  }), [players.length, clubs.length, terrains.length, tournaments.length, sponsoredEvents.length]);

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
    players: [filters.playerClub, filters.playerCity, filters.playerCountry, filters.playerLevel, filters.playerRole, filters.playerEloRank].filter(f => f !== 'all').length,
    clubs: [filters.clubCity, filters.clubCountry].filter(f => f !== 'all').length,
    terrains: [filters.terrainType, filters.terrainCity, filters.terrainLighting, filters.terrainCovered, filters.terrainEnvironment, filters.terrainAccess].filter(f => f !== 'all').length,
    tournaments: [filters.tournamentStatus, filters.tournamentFormat, filters.tournamentLevel, filters.tournamentCategory, filters.tournamentRegistration, filters.tournamentScope, filters.tournamentCity].filter(f => f !== 'all').length,
    events: [filters.eventStatus, filters.eventType, filters.eventAmbassador].filter(f => f !== 'all').length,
  }), [filters]);

  const currentFilterCount = activeFilterCounts[activeTab];

  // Singular label for current tab
  const getTabSingular = (tab: DirectoryTab) => {
    const map: Record<DirectoryTab, string> = {
      players: t('directory', 'player'),
      clubs: t('directory', 'club'),
      terrains: t('directory', 'terrain'),
      tournaments: t('directory', 'tournament'),
      events: language === 'fr' ? 'defi' : 'challenge',
    };
    return map[tab];
  };

  const getTabPlural = (tab: DirectoryTab) => {
    const map: Record<DirectoryTab, string> = {
      players: t('directory', 'playersLabel'),
      clubs: t('directory', 'clubsLabel'),
      terrains: t('directory', 'terrainsLabel'),
      tournaments: t('directory', 'tournamentsLabel'),
      events: language === 'fr' ? 'defis ambassadeurs' : 'ambassador challenges',
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
      events: language === 'fr' ? 'Rechercher un defi...' : 'Search a challenge...',
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
      const matchesEloRank = filters.playerEloRank === 'all' || (() => {
        const elo = p.eloRating || ELO_INITIAL;
        switch (filters.playerEloRank) {
          case 'bronze': return elo < 1000;
          case 'silver': return elo >= 1000 && elo < 1200;
          case 'gold': return elo >= 1200 && elo < 1500;
          case 'diamond': return elo >= 1500 && elo < 1800;
          case 'master': return elo >= 1800;
          default: return true;
        }
      })();
      const matchesRealUser = !showRealUsersOnly || (selfPlayer && p.id === selfPlayer.id) || (p.isPublic === true);
      return matchesSearch && matchesClub && matchesCity && matchesCountry && matchesLevel && matchesRole && matchesEloRank && matchesRealUser;
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
  }, [players, searchQuery, filters, selfPlayer, showRealUsersOnly, user?.id]);

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

  // Filtered events for events tab
  const filteredEvents = useMemo(() => {
    return sponsoredEvents.filter(e => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || e.title.toLowerCase().includes(q) || (e.ambassadorName || '').toLowerCase().includes(q) || (e.city || '').toLowerCase().includes(q);
      const matchesStatus = filters.eventStatus === 'all' || e.status === filters.eventStatus;
      const matchesType = filters.eventType === 'all' || e.challengeType === filters.eventType;
      const matchesAmbassador = filters.eventAmbassador === 'all' || e.ambassadorId === filters.eventAmbassador;
      return matchesSearch && matchesStatus && matchesType && matchesAmbassador;
    });
  }, [sponsoredEvents, searchQuery, filters.eventStatus, filters.eventType, filters.eventAmbassador]);

  // Get current filtered data (after all filtered arrays are defined)
  const getCurrentData = useCallback(() => {
    switch (activeTab) {
      case 'players': return filteredPlayers;
      case 'clubs': return filteredClubs;
      case 'terrains': return filteredTerrains;
      case 'tournaments': return filteredTournaments;
      case 'events': return filteredEvents as any[];
      default: return filteredPlayers;
    }
  }, [activeTab, filteredPlayers, filteredClubs, filteredTerrains, filteredTournaments, filteredEvents]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const data = getCurrentData();
    return data.slice(0, visibleCount);
  }, [visibleCount, getCurrentData]);

  const hasMore = useMemo(() => {
    return getCurrentData().length > visibleCount;
  }, [visibleCount, getCurrentData]);

  const handleLoadMore = useCallback(() => {
    if (hasMore) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  const clearFilters = useCallback(() => {
    if (activeTab === 'players') {
      setFilters(f => ({ ...f, playerClub: 'all', playerCity: 'all', playerCountry: 'all', playerLevel: 'all', playerRole: 'all', playerEloRank: 'all' }));
    } else if (activeTab === 'clubs') {
      setFilters(f => ({ ...f, clubCity: 'all', clubCountry: 'all' }));
    } else if (activeTab === 'terrains') {
      setFilters(f => ({ ...f, terrainType: 'all', terrainCity: 'all', terrainLighting: 'all', terrainCovered: 'all', terrainEnvironment: 'all', terrainAccess: 'all' }));
    } else if (activeTab === 'tournaments') {
      setFilters(f => ({ ...f, tournamentStatus: 'all', tournamentFormat: 'all', tournamentLevel: 'all', tournamentCategory: 'all', tournamentRegistration: 'all', tournamentScope: 'all', tournamentCity: 'all' }));
    } else if (activeTab === 'events') {
      setFilters(f => ({ ...f, eventStatus: 'all', eventType: 'all', eventAmbassador: 'all' }));
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

  // Render functions — use memoized components
  const renderPlayer = useCallback(({ item }: { item: Player }) => {
    return <MemoizedPlayerCard item={item} selfPlayer={selfPlayer} getSharedPermission={getSharedPermission} partnerUserIds={partnerUserIds} t={t} language={language} handleInviteToMeetup={handleInviteToMeetup} user={user} />;
  }, [selfPlayer, getSharedPermission, partnerUserIds, t, language, handleInviteToMeetup, user]);

  const renderClub = useCallback(({ item }: { item: Club }) => {
    return <MemoizedClubCard item={item} favoriteClubIds={favoriteClubIds} getSharedPermission={getSharedPermission} partnerUserIds={partnerUserIds} t={t} language={language} />;
  }, [favoriteClubIds, getSharedPermission, partnerUserIds, t, language]);

  const renderTerrain = useCallback(({ item }: { item: Terrain }) => {
    return <MemoizedTerrainCard item={item} favoriteTerrainIds={favoriteTerrainIds} getSharedPermission={getSharedPermission} partnerUserIds={partnerUserIds} t={t} language={language} getTerrainTypeConfig={getTerrainTypeConfig} />;
  }, [favoriteTerrainIds, getSharedPermission, partnerUserIds, t, language]);

  const renderTournament = useCallback(({ item }: { item: Tournament }) => {
    return <MemoizedTournamentCard item={item} getSharedPermission={getSharedPermission} t={t} language={language} getStatusLabel={getStatusLabel} />;
  }, [getSharedPermission, t, language]);

  const renderEvent = useCallback(({ item }: { item: any }) => {
    return <MemoizedEventCard item={item} language={language} />;
  }, [language]);

  const getCurrentRenderItem = () => {
    switch (activeTab) {
      case 'players': return renderPlayer;
      case 'clubs': return renderClub;
      case 'terrains': return renderTerrain;
      case 'tournaments': return renderTournament;
      case 'events': return renderEvent;
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
              title={language === 'fr' ? 'Rang ELO' : 'ELO Rank'}
              options={['all', 'bronze', 'silver', 'gold', 'diamond', 'master']}
              labels={{ all: t('directory', 'allLabel'), bronze: 'Bronze (<1000)', silver: language === 'fr' ? 'Argent (1000+)' : 'Silver (1000+)', gold: language === 'fr' ? 'Or (1200+)' : 'Gold (1200+)', diamond: language === 'fr' ? 'Diamant (1500+)' : 'Diamond (1500+)', master: language === 'fr' ? 'Maitre (1800+)' : 'Master (1800+)' }}
              value={filters.playerEloRank}
              onChange={(v) => setFilters(f => ({ ...f, playerEloRank: v }))}
              icons={{ bronze: 'shield', silver: 'workspace-premium', gold: 'emoji-events', diamond: 'diamond', master: 'auto-awesome' }}
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
      case 'events':
        return (
          <>
            <FilterSection
              title={language === 'fr' ? 'Statut' : 'Status'}
              options={['all', 'upcoming', 'active', 'completed', 'cancelled']}
              labels={{ all: t('directory', 'allLabel'), upcoming: language === 'fr' ? 'A venir' : 'Upcoming', active: language === 'fr' ? 'En cours' : 'Active', completed: language === 'fr' ? 'Termine' : 'Completed', cancelled: language === 'fr' ? 'Annule' : 'Cancelled' }}
              value={filters.eventStatus}
              onChange={(v) => setFilters(f => ({ ...f, eventStatus: v }))}
              icons={{ upcoming: 'event', active: 'play-circle', completed: 'check-circle', cancelled: 'cancel' }}
              allLabel={t('directory', 'allLabel')}
            />
            <FilterSection
              title={language === 'fr' ? 'Type de defi' : 'Challenge type'}
              options={['all', '10_tirs', '10_tirs_sautee', 'precision']}
              labels={{ all: t('directory', 'allLabel'), '10_tirs': '10 Tirs', '10_tirs_sautee': language === 'fr' ? '10 Tirs sautee' : '10 Lob Shots', precision: language === 'fr' ? 'Precision' : 'Precision' }}
              value={filters.eventType}
              onChange={(v) => setFilters(f => ({ ...f, eventType: v }))}
              icons={{ '10_tirs': 'gps-fixed', '10_tirs_sautee': 'flight-takeoff', precision: 'stars' }}
              allLabel={t('directory', 'allLabel')}
            />
            {(() => {
              const ambOptions = ['all', ...new Set(sponsoredEvents.map(e => e.ambassadorId).filter(Boolean))] as string[];
              const ambLabels: Record<string, string> = { all: t('directory', 'allLabel') };
              sponsoredEvents.forEach(e => { if (e.ambassadorId && e.ambassadorName) ambLabels[e.ambassadorId] = e.ambassadorName; });
              return ambOptions.length > 2 ? (
                <FilterSection
                  title={language === 'fr' ? 'Ambassadeur' : 'Ambassador'}
                  options={ambOptions}
                  labels={ambLabels}
                  value={filters.eventAmbassador}
                  onChange={(v) => setFilters(f => ({ ...f, eventAmbassador: v }))}
                  icons={{}}
                  allLabel={t('directory', 'allLabel')}
                />
              ) : null;
            })()}
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
      {/* Header - Gradient Hero */}
      <View style={styles.header}>
        <View style={[styles.headerGradient, { backgroundColor: '#0F172A' }]}>
          {/* Decorative circles for glassmorphism depth */}
          <View style={styles.headerDecoCircle1} />
          <View style={styles.headerDecoCircle2} />
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('directory', 'directory')}</Text>
              <Text style={styles.headerSubtitleText}>
                {dataCount} {getTabPlural(activeTab)}{searchQuery ? ` ${t('directory', 'forSearch')} "${searchQuery}"` : ''}
              </Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput
                style={styles.searchInput}
                placeholder={getSearchPlaceholder()}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </Pressable>
              ) : null}
            </View>
            {activeTab === 'players' ? (
              <Pressable
                style={[styles.headerRealUserBtn, showRealUsersOnly && styles.headerRealUserBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setShowRealUsersOnly(!showRealUsersOnly); }}
              >
                <MaterialIcons name="verified" size={16} color={showRealUsersOnly ? '#FFF' : 'rgba(255,255,255,0.7)'} />
              </Pressable>
            ) : null}
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
                color={currentFilterCount > 0 ? '#FFF' : 'rgba(255,255,255,0.6)'} 
              />
              {currentFilterCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{currentFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {/* Header Stats Summary */}
          <View style={styles.headerStatsSummary}>
            {TABS.map((tab, i) => (
              <React.Fragment key={tab.id}>
                {i > 0 ? <View style={styles.headerStatsDivider} /> : null}
                <Pressable style={styles.headerStatsItem} onPress={() => { setActiveTab(tab.id); setSearchQuery(''); }}>
                  <Text style={[styles.headerStatsValue, activeTab === tab.id && { color: '#FFF', fontSize: 19 }]}>{counts[tab.id]}</Text>
                  <Text style={[styles.headerStatsLabel, activeTab === tab.id && { color: 'rgba(255,255,255,0.7)' }]}>{tab.label}</Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
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
                  style={[styles.tab, isActive && { backgroundColor: tab.color, ...theme.shadows.card }]}
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

          {/* Quick Add Button for current tab */}
          <Pressable
            style={({ pressed }) => [styles.quickAddBtn, { backgroundColor: activeTabColor }, pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const routes: Record<DirectoryTab, string> = {
                players: '/player/new',
                clubs: '/club/new',
                terrains: '/terrain/new',
                tournaments: '/tournament/new',
                events: '/sponsored-event/new',
              };
              router.push(routes[activeTab] as any);
            }}
          >
            <MaterialIcons name="add" size={22} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* Duplicate Detection Banner */}
      {duplicates.length > 0 && showDuplicateBanner ? (
        <View style={styles.duplicateBanner}>
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
        </View>
      ) : null}

      {/* Active Filters Display */}
      {currentFilterCount > 0 ? (
        <View style={styles.activeFiltersContainer}>
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
                {filters.playerEloRank !== 'all' && (() => { const eloLabels: Record<string, string> = { bronze: 'Bronze', silver: language === 'fr' ? 'Argent' : 'Silver', gold: language === 'fr' ? 'Or' : 'Gold', diamond: language === 'fr' ? 'Diamant' : 'Diamond', master: language === 'fr' ? 'Maitre' : 'Master' }; return <ActiveFilterChip label={eloLabels[filters.playerEloRank] || filters.playerEloRank} onRemove={() => setFilters(f => ({ ...f, playerEloRank: 'all' }))} icon="diamond" />; })()}
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
            {activeTab === 'events' && (
              <>
                {filters.eventStatus !== 'all' && <ActiveFilterChip label={filters.eventStatus === 'upcoming' ? (language === 'fr' ? 'A venir' : 'Upcoming') : filters.eventStatus === 'active' ? (language === 'fr' ? 'En cours' : 'Active') : filters.eventStatus === 'completed' ? (language === 'fr' ? 'Termine' : 'Done') : (language === 'fr' ? 'Annule' : 'Cancelled')} onRemove={() => setFilters(f => ({ ...f, eventStatus: 'all' }))} icon="event" />}
                {filters.eventType !== 'all' && <ActiveFilterChip label={filters.eventType === '10_tirs' ? '10 Tirs' : filters.eventType === '10_tirs_sautee' ? (language === 'fr' ? '10 Tirs sautee' : '10 Lob Shots') : 'Precision'} onRemove={() => setFilters(f => ({ ...f, eventType: 'all' }))} icon="track-changes" />}
                {filters.eventAmbassador !== 'all' && (() => { const amb = sponsoredEvents.find(e => e.ambassadorId === filters.eventAmbassador); return <ActiveFilterChip label={amb?.ambassadorName || filters.eventAmbassador} onRemove={() => setFilters(f => ({ ...f, eventAmbassador: 'all' }))} icon="verified" />; })()}
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
        </View>
      ) : null}

      <SponsorBanner style={{ marginTop: 10 }} page="directory" />

      {/* Results Count - only when searching */}
      {searchQuery ? (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {dataCount} {dataCount !== 1 ? getTabPlural(activeTab) : getTabSingular(activeTab)}
          </Text>
          <Text style={styles.searchingFor}>{t('directory', 'forSearch')} "{searchQuery}"</Text>
        </View>
      ) : null}



      {/* List */}
      <View style={styles.listContainer}>
        {isTablet ? (
          <FlatList
            key={`tablet-${activeTab}-${numColumns}`}
            data={paginatedData as any[]}
            renderItem={getCurrentRenderItem() as any}
            keyExtractor={(item: any) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.tabletRow}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 100,
              maxWidth: 960,
              alignSelf: 'center' as const,
              width: '100%',
            }}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            removeClippedSubviews={true}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={10}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            ListFooterComponent={
              hasMore ? (
                <View style={styles.loadMoreFooter}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name={tabConfig?.icon as any || 'search'} size={48} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>{t('directory', 'noResultsFound')}</Text>
                <Text style={styles.emptyText}>
                  {searchQuery 
                    ? `${t('directoryExtra', 'noPrefix')} ${getTabSingular(activeTab)} ${t('directory', 'noMatchSearch')} "${searchQuery}"`
                    : currentFilterCount > 0 
                      ? t('directory', 'tryModifyFilters')
                      : `${t('directoryExtra', 'noPrefix')} ${getTabSingular(activeTab)} ${t('directory', 'noRegistered')}`
                  }
                </Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={paginatedData as any[]}
            renderItem={getCurrentRenderItem() as any}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ 
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 100,
            }}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            removeClippedSubviews={true}
            windowSize={5}
            maxToRenderPerBatch={10}
            initialNumToRender={15}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            ListFooterComponent={
              <>
                {hasMore ? (
                  <View style={styles.loadMoreFooter}>
                    <ActivityIndicator size="small" color={theme.primary} />
                  </View>
                ) : dataCount > 3 ? <AdBanner position="inline" /> : null}
              </>
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name={tabConfig?.icon as any || 'search'} size={48} color={theme.textMuted} />
                <Text style={styles.emptyTitle}>{t('directory', 'noResultsFound')}</Text>
                <Text style={styles.emptyText}>
                  {searchQuery 
                    ? `${t('directoryExtra', 'noPrefix')} ${getTabSingular(activeTab)} ${t('directory', 'noMatchSearch')} "${searchQuery}"`
                    : currentFilterCount > 0 
                      ? t('directory', 'tryModifyFilters')
                      : `${t('directoryExtra', 'noPrefix')} ${getTabSingular(activeTab)} ${t('directory', 'noRegistered')}`
                  }
                </Text>
              </View>
            }
          />
        )}
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
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={[styles.modalCloseButton, { backgroundColor: theme.primary + '15' }]}
                onPress={() => { setShowDuplicateModal(false); loadMergeLogs(); setShowMergeHistory(true); }}
              >
                <MaterialIcons name="history" size={20} color={theme.primary} />
              </Pressable>
              <Pressable style={styles.modalCloseButton} onPress={() => setShowDuplicateModal(false)}>
                <MaterialIcons name="close" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>
          </View>
          <FlatList
            data={duplicates}
            keyExtractor={(item) => item.pairKey}
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="check-circle" size={48} color={theme.success} />
                <Text style={[styles.emptyTitle, { color: theme.success }]}>{t('common', 'noResults')}</Text>
              </View>
            }
            renderItem={({ item: dup }) => {
              const typeIcons: Record<string, { icon: string; color: string }> = {
                player: { icon: 'person', color: theme.primary },
                club: { icon: 'home', color: theme.accent },
                terrain: { icon: 'sports-soccer', color: theme.success },
                tournament: { icon: 'emoji-events', color: theme.carreauColor },
              };
              const cfg = typeIcons[dup.type] || typeIcons.player;
              return (
                <View style={styles.duplicateCard}>
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
                          // Determine which item is "more complete" (target) and which is the duplicate (source)
                          const scoreCompleteness = (item: any) => {
                            let score = 0;
                            const fields = Object.keys(item).filter(k => !['id', 'userId', 'user_id', 'createdAt', 'created_at', 'updatedAt', 'updated_at', 'stats', 'isPublic', 'showContactPublic'].includes(k));
                            for (const k of fields) {
                              const v = item[k];
                              if (v === null || v === undefined || v === '' || v === 0 || v === false) continue;
                              if (typeof v === 'string') score += v.trim().length;
                              else if (Array.isArray(v)) score += v.length * 5;
                              else if (typeof v === 'object') score += JSON.stringify(v).length;
                              else score += 3;
                            }
                            return score;
                          };
                          const scoreA = scoreCompleteness(a);
                          const scoreB = scoreCompleteness(b);
                          // Target = the more complete one, Source = the less complete one to delete
                          const target = scoreA >= scoreB ? a : b;
                          const source = scoreA >= scoreB ? b : a;
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
                          const fields = Object.keys(source).filter(k => !['id', 'userId', 'user_id', 'createdAt', 'created_at', 'updatedAt', 'updated_at', 'stats'].includes(k));
                          for (const k of fields) {
                            const vTarget = target[k];
                            const vSource = source[k];
                            let best;
                            if (typeof vTarget === 'object' && !Array.isArray(vTarget) && vTarget !== null) best = pickObj(vTarget, vSource);
                            else if (Array.isArray(vTarget) || Array.isArray(vSource)) best = pickArr(vTarget, vSource);
                            else if (typeof vTarget === 'number' || typeof vSource === 'number') best = pickNum(vTarget, vSource);
                            else best = pick(vTarget, vSource);
                            if (best !== undefined && JSON.stringify(best) !== JSON.stringify(vTarget)) {
                              updates[k] = best;
                            }
                          }
                          // Update the target with best fields from both
                          const updaters: Record<string, (id: string, u: any) => Promise<void>> = {
                            player: updatePlayer, club: updateClub, terrain: updateTerrain, tournament: updateTournament,
                          };
                          const updater = updaters[dup.type];
                          if (updater && Object.keys(updates).length > 0) {
                            await updater(target.id, updates);
                          }
                          const mergedTarget = { ...target, ...updates };
                          // Reassign relations from source to target, then delete source
                          // Build reassigned relations log for undo
                          const reassigned: ReassignedRelation[] = [];
                          if (dup.type === 'club') {
                            const linkedPlayers = players.filter(p => p.clubId === source.id);
                            for (const p of linkedPlayers) {
                              reassigned.push({ type: 'player', id: p.id, field: 'club_id', oldValue: source.id, newValue: target.id });
                              reassigned.push({ type: 'player', id: p.id, field: 'club', oldValue: source.name, newValue: mergedTarget.name });
                              await updatePlayer(p.id, { club: mergedTarget.name, clubId: target.id });
                            }
                            const linkedTournaments = tournaments.filter(t => t.clubId === source.id);
                            for (const lt of linkedTournaments) {
                              reassigned.push({ type: 'tournament', id: lt.id, field: 'club_id', oldValue: source.id, newValue: target.id });
                              await updateTournament(lt.id, { clubId: target.id, clubName: mergedTarget.name });
                            }
                            const linkedTerrains = terrains.filter(t => t.clubId === source.id);
                            for (const lt of linkedTerrains) {
                              reassigned.push({ type: 'terrain', id: lt.id, field: 'club_id', oldValue: source.id, newValue: target.id });
                              await updateTerrain(lt.id, { clubId: target.id, clubName: mergedTarget.name } as any);
                            }
                            // Save merge log before delete
                            await saveMergeLog({ mergeType: 'club', targetId: target.id, targetName: mergedTarget.name, sourceId: source.id, sourceName: source.name, sourceSnapshot: source, reassignedRelations: reassigned });
                            await deleteClub(source.id);
                          } else if (dup.type === 'terrain') {
                            const linkedClubs = clubs.filter(c => c.terrainId === source.id);
                            for (const c of linkedClubs) {
                              reassigned.push({ type: 'club', id: c.id, field: 'terrain_id', oldValue: source.id, newValue: target.id });
                              await updateClub(c.id, { terrainId: target.id, terrainName: mergedTarget.name } as any);
                            }
                            const linkedPlayers = players.filter(p => p.terrainId === source.id);
                            for (const p of linkedPlayers) {
                              reassigned.push({ type: 'player', id: p.id, field: 'terrain_id', oldValue: source.id, newValue: target.id });
                              await updatePlayer(p.id, { terrainId: target.id, terrainName: mergedTarget.name });
                            }
                            const linkedTournaments = tournaments.filter(t => t.terrainId === source.id);
                            for (const lt of linkedTournaments) {
                              reassigned.push({ type: 'tournament', id: lt.id, field: 'terrain_id', oldValue: source.id, newValue: target.id });
                              await updateTournament(lt.id, { terrainId: target.id, terrainName: mergedTarget.name } as any);
                            }
                            await saveMergeLog({ mergeType: 'terrain', targetId: target.id, targetName: mergedTarget.name, sourceId: source.id, sourceName: source.name, sourceSnapshot: source, reassignedRelations: reassigned });
                            await deleteTerrain(source.id);
                          } else if (dup.type === 'player') {
                            await saveMergeLog({ mergeType: 'player', targetId: target.id, targetName: mergedTarget.name, sourceId: source.id, sourceName: source.name, sourceSnapshot: source, reassignedRelations: [] });
                            await deletePlayer(source.id);
                          } else if (dup.type === 'tournament') {
                            await saveMergeLog({ mergeType: 'tournament', targetId: target.id, targetName: mergedTarget.name, sourceId: source.id, sourceName: source.name, sourceSnapshot: source, reassignedRelations: [] });
                            await deleteTournament(source.id);
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
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* Merge History Modal */}
      <Modal
        visible={showMergeHistory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMergeHistory(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={[styles.modalIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="history" size={20} color={theme.primary} />
              </View>
              <Text style={styles.modalTitle}>{t('directory', 'mergeHistoryTitle')}</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={() => setShowMergeHistory(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          {loadingMergeLogs ? (
            <View style={[styles.emptyState, { flex: 1 }]}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.emptyTitle}>{t('common', 'loading')}</Text>
            </View>
          ) : (
            <FlatList
              data={mergeLogs}
              keyExtractor={(item) => item.id}
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="check-circle" size={48} color={theme.success} />
                  <Text style={styles.emptyTitle}>{t('directory', 'mergeHistoryEmpty')}</Text>
                  <Text style={styles.emptyText}>{t('directory', 'mergeHistoryEmptyDesc')}</Text>
                </View>
              }
              renderItem={({ item: log }) => {
                const typeIcons: Record<string, { icon: string; color: string }> = {
                  player: { icon: 'person', color: theme.primary },
                  club: { icon: 'home', color: theme.accent },
                  terrain: { icon: 'sports-soccer', color: theme.success },
                  tournament: { icon: 'emoji-events', color: theme.carreauColor },
                };
                const cfg = typeIcons[log.mergeType] || typeIcons.player;
                const canUndo = isUndoable(log);
                const timeLeft = getUndoTimeRemaining(log, language as 'fr' | 'en');
                return (
                  <View style={styles.mergeHistoryCard}>
                    <View style={styles.duplicateCardHeader}>
                      <View style={[styles.duplicateTypeIcon, { backgroundColor: cfg.color + '15' }]}>
                        <MaterialIcons name={cfg.icon as any} size={16} color={cfg.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.mergeHistorySource} numberOfLines={1}>
                          {log.sourceName} <Text style={{ color: theme.textMuted, fontWeight: '400' }}>{t('directory', 'mergedInto')}</Text> {log.targetName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <Text style={{ fontSize: 11, color: theme.textMuted }}>
                            {new Date(log.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          {log.reassignedRelations.length > 0 ? (
                            <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                              {log.reassignedRelations.length} {t('directory', 'mergeRelationsCount')}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                    {canUndo ? (
                      <View style={styles.mergeHistoryActions}>
                        <View style={styles.mergeHistoryTimer}>
                          <MaterialIcons name="timer" size={12} color={theme.warning} />
                          <Text style={styles.mergeHistoryTimerText}>{timeLeft}</Text>
                        </View>
                        <Pressable
                          style={styles.mergeUndoBtn}
                          disabled={undoingMerge === log.id}
                          onPress={() => handleUndoMerge(log)}
                        >
                          <MaterialIcons name="undo" size={14} color="#FFF" />
                          <Text style={styles.mergeUndoBtnText}>
                            {undoingMerge === log.id ? '...' : t('directory', 'mergeUndoBtn')}
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.mergeHistoryExpired}>
                        <MaterialIcons name="lock-clock" size={14} color={theme.textMuted} />
                        <Text style={styles.mergeHistoryExpiredText}>{t('directory', 'mergeUndoExpired')}</Text>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
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

      {/* Meetup Invitation Picker Modal */}
      <Modal
        visible={showMeetupPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMeetupPicker(false)}
      >
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
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : activeMeetups.length > 0 ? (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {activeMeetups.map((m) => {
                  const mDate = new Date(m.date);
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.meetupPickerItem, invitingToMeetup === m.id && { opacity: 0.6 }]}
                      onPress={() => handleConfirmInvite(m.id)}
                      disabled={!!invitingToMeetup}
                    >
                      <View style={styles.meetupPickerItemDate}>
                        <Text style={styles.meetupPickerItemDay}>{mDate.getDate()}</Text>
                        <Text style={styles.meetupPickerItemMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.meetupPickerItemTitle} numberOfLines={1}>{m.title}</Text>
                        <Text style={styles.meetupPickerItemTime}>
                          {mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      {invitingToMeetup === m.id ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <View style={styles.meetupPickerItemArrow}>
                          <MaterialIcons name="send" size={16} color={theme.primary} />
                        </View>
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
                <Pressable
                  style={styles.meetupPickerCreateBtn}
                  onPress={() => { setShowMeetupPicker(false); router.push('/meetup/new' as any); }}
                >
                  <MaterialIcons name="add" size={18} color="#FFF" />
                  <Text style={styles.meetupPickerCreateBtnText}>{t('meetup', 'createMeetupFirst')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

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
                 activeTab === 'events' ? (language === 'fr' ? 'Filtrer les defis' : 'Filter challenges') :
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

// ============================================
// MEMOIZED CARD COMPONENTS
// ============================================
const MemoizedPlayerCard = React.memo(({ item, selfPlayer, getSharedPermission, partnerUserIds, t, language, handleInviteToMeetup, user }: {
  item: Player; selfPlayer: Player | null; getSharedPermission: (id: string) => string | null;
  partnerUserIds: Map<string, { tier: string; name: string }>; t: (s: string, k: string) => string;
  language: string; handleInviteToMeetup: (id: string, name: string) => void; user: any;
}) => {
  const isSelf = selfPlayer && item.id === selfPlayer.id;
  const sharedPerm = getSharedPermission(item.id);
  const isPublicItem = (item as any).isPublic;
  const isRealUser = item.isPublic === true && (!selfPlayer || item.id !== selfPlayer.id);
  const partnerInfo = partnerUserIds.get(item.id);
  return (
    <Pressable
      style={[styles.itemCard, isSelf && styles.selfCard]}
      onPress={() => isSelf ? router.push('/player/me') : router.push(`/player/${item.id}`)}
    >
      <View style={[styles.itemAvatarOuter, isSelf && styles.selfAvatarOuter]}>
        <View style={[styles.itemAvatar, isSelf && styles.selfAvatar]}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" recyclingKey={item.id} />
          ) : (
            <Text style={styles.avatarText}>{item.name.split(' ').map(n => n[0]).join('')}</Text>
          )}
        </View>
        {isSelf ? (
          <>
            <View style={styles.selfBadge}><MaterialIcons name="star" size={10} color="#FFF" /></View>
            <View style={styles.selfVerifiedBadge}><MaterialIcons name="verified" size={12} color="#FFF" /></View>
          </>
        ) : isRealUser ? (
          <View style={styles.verifiedBadge}><MaterialIcons name="verified" size={11} color="#FFF" /></View>
        ) : isPublicItem ? (
          <View style={styles.publicOverlay}><MaterialIcons name="public" size={10} color={theme.success} /></View>
        ) : sharedPerm ? <SharedOverlayBadge permission={sharedPerm} /> : null}
      </View>
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemTitle, isSelf && { color: theme.primary }]} numberOfLines={1}>{item.name}</Text>
          {isSelf ? (
            <>
              <View style={styles.moiBadge}><Text style={styles.moiBadgeText}>{t('directory', 'me')}</Text></View>
              <View style={styles.realUserBadge}><MaterialIcons name="verified" size={10} color={theme.primary} /><Text style={styles.realUserBadgeText}>{t('meetup', 'registeredUser')}</Text></View>
            </>
          ) : isRealUser ? (
            <View style={styles.realUserBadge}><MaterialIcons name="verified" size={10} color={theme.primary} /><Text style={styles.realUserBadgeText}>{t('meetup', 'registeredUser')}</Text></View>
          ) : null}
        </View>
        <View style={styles.itemMeta}>
          {item.club ? <View style={styles.metaItem}><MaterialIcons name="home" size={12} color={theme.textMuted} /><Text style={styles.metaText} numberOfLines={1}>{item.club}</Text></View> : null}
          {item.location?.city ? <View style={styles.metaItem}><MaterialIcons name="place" size={12} color={theme.textMuted} /><Text style={styles.metaText}>{item.location.city}</Text></View> : null}
        </View>
        <View style={styles.itemTags}>
          {partnerInfo ? (
            <View style={[styles.tag, { backgroundColor: partnerInfo.tier === 'gold_sponsor' ? '#F59E0B15' : partnerInfo.tier === 'sponsor' ? '#90A4AE15' : '#A1887F15' }]}>
              <MaterialIcons name={partnerInfo.tier === 'gold_sponsor' ? 'star' : 'workspace-premium'} size={10} color={partnerInfo.tier === 'gold_sponsor' ? '#D4A017' : partnerInfo.tier === 'sponsor' ? '#78909C' : '#A1887F'} />
              <Text style={[styles.tagText, { color: partnerInfo.tier === 'gold_sponsor' ? '#D4A017' : partnerInfo.tier === 'sponsor' ? '#78909C' : '#A1887F' }]}>
                {partnerInfo.tier === 'gold_sponsor' ? 'Or' : partnerInfo.tier === 'sponsor' ? 'Argent' : 'Bronze'}
              </Text>
            </View>
          ) : null}
          {item.eloRating ? (() => { const eloRank = getEloRank(item.eloRating); return (
            <View style={[styles.tag, { backgroundColor: eloRank.color + '12', borderWidth: 1, borderColor: eloRank.color + '25' }]}>
              <MaterialIcons name={eloRank.icon as any} size={10} color={eloRank.color} />
              <Text style={[styles.tagText, { color: eloRank.color }]}>{item.eloRating}</Text>
            </View>
          ); })() : null}
          <View style={[styles.tag, { backgroundColor: theme.primary + '15' }]}><Text style={[styles.tagText, { color: theme.primary }]}>{t('roles', item.role)}</Text></View>
          <View style={[styles.tag, { backgroundColor: theme.success + '15' }]}><Text style={[styles.tagText, { color: theme.success }]}>{item.stats.winRate}%</Text></View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}><Text style={[styles.tagText, { color: theme.textSecondary }]}>{t('levels', item.level)}</Text></View>
        </View>
        {isRealUser ? (
          <Pressable style={styles.inviteMeetupBtn} onPress={(e) => { e.stopPropagation?.(); handleInviteToMeetup(item.id, item.name); }} hitSlop={4}>
            <MaterialIcons name="event" size={13} color={theme.primary} />
            <Text style={styles.inviteMeetupBtnText}>{t('meetup', 'inviteToMeetup')}</Text>
          </Pressable>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
    </Pressable>
  );
});

const MemoizedClubCard = React.memo(({ item, favoriteClubIds, getSharedPermission, partnerUserIds, t, language }: {
  item: Club; favoriteClubIds: string[]; getSharedPermission: (id: string) => string | null;
  partnerUserIds: Map<string, { tier: string; name: string }>; t: (s: string, k: string) => string; language: string;
}) => {
  const sharedPerm = getSharedPermission(item.id);
  const isPublicItem = (item as any).isPublic;
  const isFavorite = favoriteClubIds.includes(item.id);
  const clubPartnerInfo = partnerUserIds.get((item as any).userId || '');
  return (
    <Pressable style={[styles.itemCard, isFavorite && styles.favoriteCard]} onPress={() => router.push(`/club/${item.id}`)}>
      <View style={[styles.itemAvatar, { backgroundColor: theme.accent }]}>
        <MaterialIcons name="home" size={24} color="#FFF" />
        {isFavorite ? <View style={styles.favoriteBadge}><MaterialIcons name="favorite" size={10} color={theme.error} /></View>
        : isPublicItem ? <View style={styles.publicOverlay}><MaterialIcons name="public" size={10} color={theme.success} /></View>
        : sharedPerm ? <SharedOverlayBadge permission={sharedPerm} /> : null}
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <View style={styles.metaItem}><MaterialIcons name="place" size={12} color={theme.textMuted} /><Text style={styles.metaText}>{item.city}, {item.country || 'France'}</Text></View>
          {item.terrainName ? <View style={styles.metaItem}><MaterialIcons name="sports-soccer" size={12} color={theme.success} /><Text style={[styles.metaText, { color: theme.success }]}>{item.terrainName}</Text></View> : null}
        </View>
        <View style={styles.itemTags}>
          {clubPartnerInfo ? (
            <View style={[styles.tag, { backgroundColor: clubPartnerInfo.tier === 'gold_sponsor' ? '#F59E0B15' : clubPartnerInfo.tier === 'sponsor' ? '#90A4AE15' : '#A1887F15' }]}>
              <MaterialIcons name={clubPartnerInfo.tier === 'gold_sponsor' ? 'star' : 'workspace-premium'} size={10} color={clubPartnerInfo.tier === 'gold_sponsor' ? '#D4A017' : clubPartnerInfo.tier === 'sponsor' ? '#78909C' : '#A1887F'} />
              <Text style={[styles.tagText, { color: clubPartnerInfo.tier === 'gold_sponsor' ? '#D4A017' : clubPartnerInfo.tier === 'sponsor' ? '#78909C' : '#A1887F' }]}>
                {clubPartnerInfo.tier === 'gold_sponsor' ? 'Or' : clubPartnerInfo.tier === 'sponsor' ? 'Argent' : 'Bronze'}
              </Text>
            </View>
          ) : null}
          <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}><MaterialIcons name="people" size={10} color={theme.textSecondary} /><Text style={[styles.tagText, { color: theme.textSecondary }]}>{item.membersCount}</Text></View>
          {item.foundedYear ? <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}><Text style={[styles.tagText, { color: theme.textSecondary }]}>{t('directory', 'since')} {item.foundedYear}</Text></View> : null}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
    </Pressable>
  );
});

const MemoizedTerrainCard = React.memo(({ item, favoriteTerrainIds, getSharedPermission, partnerUserIds, t, language, getTerrainTypeConfig }: {
  item: Terrain; favoriteTerrainIds: string[]; getSharedPermission: (id: string) => string | null;
  partnerUserIds: Map<string, { tier: string; name: string }>; t: (s: string, k: string) => string;
  language: string; getTerrainTypeConfig: (type: string) => any;
}) => {
  const typeConfig = getTerrainTypeConfig(item.type);
  const isFavorite = favoriteTerrainIds.includes(item.id);
  const sharedPerm = getSharedPermission(item.id);
  const isPublicItem = (item as any).isPublic;
  const terrainPartnerInfo = partnerUserIds.get((item as any).userId || '');
  return (
    <Pressable style={[styles.itemCard, isFavorite && styles.favoriteCard]} onPress={() => router.push(`/terrain/${item.id}`)}>
      <View style={[styles.itemAvatar, { backgroundColor: theme.success }]}>
        {item.photos && item.photos.length > 0 ? (
          <Image source={{ uri: item.photos[0] }} style={styles.avatarImage} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.terrain }} cachePolicy="memory-disk" recyclingKey={item.id} />
        ) : <MaterialIcons name={typeConfig.icon as any} size={24} color="#FFF" />}
        {isFavorite ? <View style={styles.favoriteBadge}><MaterialIcons name="favorite" size={10} color={theme.error} /></View>
        : isPublicItem ? <View style={styles.publicOverlay}><MaterialIcons name="public" size={10} color={theme.success} /></View>
        : sharedPerm ? <SharedOverlayBadge permission={sharedPerm} /> : null}
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <View style={styles.metaItem}><MaterialIcons name="place" size={12} color={theme.textMuted} /><Text style={styles.metaText}>{item.city}</Text></View>
          {item.clubName ? <View style={styles.metaItem}><MaterialIcons name="home" size={12} color={theme.textMuted} /><Text style={styles.metaText}>{item.clubName}</Text></View> : null}
        </View>
        <View style={styles.itemTags}>
          {terrainPartnerInfo ? (
            <View style={[styles.tag, { backgroundColor: terrainPartnerInfo.tier === 'gold_sponsor' ? '#F59E0B15' : terrainPartnerInfo.tier === 'sponsor' ? '#90A4AE15' : '#A1887F15' }]}>
              <MaterialIcons name={terrainPartnerInfo.tier === 'gold_sponsor' ? 'star' : 'workspace-premium'} size={10} color={terrainPartnerInfo.tier === 'gold_sponsor' ? '#D4A017' : terrainPartnerInfo.tier === 'sponsor' ? '#78909C' : '#A1887F'} />
              <Text style={[styles.tagText, { color: terrainPartnerInfo.tier === 'gold_sponsor' ? '#D4A017' : terrainPartnerInfo.tier === 'sponsor' ? '#78909C' : '#A1887F' }]}>
                {terrainPartnerInfo.tier === 'gold_sponsor' ? 'Or' : terrainPartnerInfo.tier === 'sponsor' ? 'Argent' : 'Bronze'}
              </Text>
            </View>
          ) : null}
          <View style={[styles.tag, { backgroundColor: theme.success + '15' }]}><Text style={[styles.tagText, { color: theme.success }]}>{t('terrainTypes', item.type)}</Text></View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}><Text style={[styles.tagText, { color: theme.textSecondary }]}>{item.courtsCount} {item.courtsCount > 1 ? t('directory', 'terrainCountPlural') : t('directory', 'terrainCount')}</Text></View>
          {item.lighting ? <View style={[styles.tag, { backgroundColor: theme.warning + '15' }]}><MaterialIcons name="lightbulb" size={10} color={theme.warning} /></View> : null}
          {item.covered ? <View style={[styles.tag, { backgroundColor: theme.primary + '15' }]}><MaterialIcons name="roofing" size={10} color={theme.primary} /></View> : null}
          {item.publicAccess === false ? <View style={[styles.tag, { backgroundColor: theme.error + '15' }]}><MaterialIcons name="lock" size={10} color={theme.error} /><Text style={[styles.tagText, { color: theme.error }]}>{t('directory', 'privateAccessShort')}</Text></View> : null}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
    </Pressable>
  );
});

const MemoizedTournamentCard = React.memo(({ item, getSharedPermission, t, language, getStatusLabel }: {
  item: Tournament; getSharedPermission: (id: string) => string | null;
  t: (s: string, k: string) => string; language: string; getStatusLabel: (s: string) => string;
}) => {
  const statusConfig: Record<string, { bg: string; color: string }> = {
    'À venir': { bg: theme.primary + '15', color: theme.primary },
    'En cours': { bg: theme.warning + '15', color: theme.warning },
    'Terminé': { bg: theme.backgroundSecondary, color: theme.textSecondary },
  };
  const status = statusConfig[item.status] || statusConfig['Terminé'];
  const sharedPerm = getSharedPermission(item.id);
  const isPublicItem = (item as any).isPublic;
  return (
    <Pressable style={styles.itemCard} onPress={() => router.push(`/tournament/${item.id}`)}>
      <View style={[styles.itemAvatar, { backgroundColor: theme.carreauColor }]}>
        <MaterialIcons name="emoji-events" size={24} color="#FFF" />
        {isPublicItem ? <View style={styles.publicOverlay}><MaterialIcons name="public" size={10} color={theme.success} /></View>
        : sharedPerm ? <SharedOverlayBadge permission={sharedPerm} /> : null}
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <View style={styles.metaItem}><MaterialIcons name="event" size={12} color={theme.textMuted} /><Text style={styles.metaText}>{new Date(item.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Text></View>
          <View style={styles.metaItem}><MaterialIcons name="place" size={12} color={theme.textMuted} /><Text style={styles.metaText}>{item.terrainName || item.location.city}</Text></View>
        </View>
        <View style={styles.itemTags}>
          <View style={[styles.tag, { backgroundColor: status.bg }]}><Text style={[styles.tagText, { color: status.color }]}>{getStatusLabel(item.status)}</Text></View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}><Text style={[styles.tagText, { color: theme.textSecondary }]}>{t('formats', item.format)}</Text></View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}><Text style={[styles.tagText, { color: theme.textSecondary }]}>{t('tournamentTypes', item.type)}</Text></View>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
    </Pressable>
  );
});

const MemoizedEventCard = React.memo(({ item, language }: { item: any; language: string }) => {
  const ev = item as SponsoredEvent;
  const evDate = new Date(ev.startTime);
  const endDate = new Date(ev.endTime);
  const isActive = ev.status === 'active' || (ev.status === 'upcoming' && new Date() >= evDate && new Date() <= endDate);
  const sc = isActive ? '#22C55E' : ev.status === 'completed' ? '#3B82F6' : ev.status === 'cancelled' ? '#EF4444' : '#F59E0B';
  const typeColor: Record<string, string> = { '10_tirs': '#2563EB', '10_tirs_sautee': '#D97706', precision: '#7C3AED' };
  const tc = typeColor[ev.challengeType] || '#7C3AED';
  const challengeLabel = ev.challengeType === '10_tirs' ? '10 Tirs' : ev.challengeType === '10_tirs_sautee' ? (language === 'fr' ? '10 Tirs sautee' : '10 Lob Shots') : (language === 'fr' ? 'Precision' : 'Precision');
  return (
    <Pressable style={[styles.itemCard, { borderLeftWidth: 3, borderLeftColor: sc }]} onPress={() => router.push(`/sponsored-event/${ev.id}` as any)}>
      <View style={[styles.itemAvatar, { backgroundColor: tc + '15' }]}>
        <MaterialIcons name={ev.challengeType === '10_tirs' ? 'gps-fixed' : ev.challengeType === 'precision' ? 'stars' : 'flight-takeoff'} size={24} color={tc} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{ev.title}</Text>
        <View style={styles.itemMeta}>
          <View style={styles.metaItem}><MaterialIcons name="event" size={12} color={theme.textMuted} /><Text style={styles.metaText}>{evDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Text></View>
          {ev.ambassadorName ? <View style={styles.metaItem}><MaterialIcons name="verified" size={12} color="#7C3AED" /><Text style={[styles.metaText, { color: '#7C3AED' }]}>{ev.ambassadorName}</Text></View> : null}
        </View>
        <View style={styles.itemTags}>
          <View style={[styles.tag, { backgroundColor: sc + '15' }]}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sc }} /><Text style={[styles.tagText, { color: sc }]}>{isActive ? (language === 'fr' ? 'En cours' : 'Active') : ev.status === 'upcoming' ? (language === 'fr' ? 'A venir' : 'Upcoming') : ev.status === 'completed' ? (language === 'fr' ? 'Termine' : 'Done') : (language === 'fr' ? 'Annule' : 'Cancelled')}</Text></View>
          <View style={[styles.tag, { backgroundColor: tc + '12' }]}><Text style={[styles.tagText, { color: tc }]}>{challengeLabel}</Text></View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}><MaterialIcons name="group" size={10} color={theme.textSecondary} /><Text style={[styles.tagText, { color: theme.textSecondary }]}>{ev.maxParticipants}</Text></View>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
    </Pressable>
  );
});

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
  headerGradient: {
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  headerDecoCircle1: {
    position: 'absolute' as const,
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerDecoCircle2: {
    position: 'absolute' as const,
    bottom: -20,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerStatsSummary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerStatsDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerStatsItem: {
    flex: 1,
    alignItems: 'center' as const,
  },
  headerStatsValue: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: 'rgba(255,255,255,0.5)',
    transition: 'color 0.2s',
  } as any,
  headerStatsLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  headerSubtitleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
    fontWeight: '500',
  },
  headerTablet: {
    maxWidth: 960,
    alignSelf: 'center' as const,
    width: '100%',
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
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  headerRealUserBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRealUserBtnActive: {
    backgroundColor: theme.primary,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: theme.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  tabsWrapper: {
    paddingLeft: 16,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginLeft: 4,
    ...theme.shadows.cardElevated,
  },
  tabsContainer: {
    gap: 8,
    paddingRight: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.error + '08',
    borderWidth: 1.5,
    borderColor: theme.error + '25',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.error,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.primary + '30',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.primary,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  searchingFor: {
    fontSize: 13,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  listContainer: {
    flex: 1,
  },
  tabletRow: {
    gap: 12,
  },
  itemCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  selfCard: {
    borderWidth: 2,
    borderColor: theme.primary,
    backgroundColor: theme.primary + '04',
  },
  favoriteCard: {
    borderWidth: 2,
    borderColor: theme.error + '40',
    backgroundColor: theme.error + '03',
  },
  itemAvatarOuter: {
    position: 'relative' as const,
    width: 52,
    height: 52,
    marginRight: 12,
  },
  selfAvatarOuter: {
    width: 58,
    height: 58,
    marginRight: 10,
  },
  itemAvatar: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden' as const,
  },
  selfAvatar: {
    backgroundColor: theme.primary,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 15,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  selfBadge: {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.carreauColor,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: theme.surface,
    zIndex: 3,
  },
  selfVerifiedBadge: {
    position: 'absolute' as const,
    top: -3,
    left: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2.5,
    borderColor: theme.surface,
    zIndex: 4,
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
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: theme.surface,
    zIndex: 3,
  },
  verifiedBadge: {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: theme.surface,
    zIndex: 3,
  },
  realUserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.primary + '12',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  realUserBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.primary,
  },
  inviteMeetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.primary + '25',
  },
  inviteMeetupBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.primary,
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
    fontWeight: '700',
    color: theme.textPrimary,
    flex: 1,
    letterSpacing: -0.1,
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
    marginBottom: 10,
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
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
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
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
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
  // Merge History
  mergeHistoryCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  mergeHistorySource: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  mergeHistoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  mergeHistoryTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.warning + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  mergeHistoryTimerText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.warning,
  },
  mergeUndoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.error,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  mergeUndoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  mergeHistoryExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  mergeHistoryExpiredText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  loadMoreFooter: {
    paddingVertical: 20,
    alignItems: 'center' as const,
  },
  // Meetup Invitation Picker
  meetupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  meetupPickerContent: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 24,
  },
  meetupPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  meetupPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  meetupPickerSubtitle: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  meetupPickerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetupPickerDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  meetupPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  meetupPickerItemDate: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetupPickerItemDay: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.primary,
    lineHeight: 20,
  },
  meetupPickerItemMonth: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.primary,
    letterSpacing: 0.5,
  },
  meetupPickerItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  meetupPickerItemTime: {
    fontSize: 12,
    color: theme.textMuted,
  },
  meetupPickerItemArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetupPickerEmptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 12,
  },
  meetupPickerEmptyDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  meetupPickerCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  meetupPickerCreateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  // Real Users Filter
  realUserFilterRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  realUserFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
    borderColor: theme.primary + '30',
  },
  realUserFilterChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  realUserFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  realUserFilterTextActive: {
    color: '#FFF',
  },
});
