import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import { logModification } from '@/services/modificationLogService';
import { saveToCache, saveSingleToCache, loadFromCache, clearCache, getLastSyncTimestamp, setLastSyncTimestamp } from '@/services/cacheService';
import {
  enqueueOperation,
  replayOfflineQueue,
  getQueueSize,
  clearOfflineQueue,
  retryFailedOperations,
  getFailedOperations,
  buildMatchDbPayload,
  buildPlayerDbPayload,
  buildClubDbPayload,
  buildTournamentDbPayload,
  buildTerrainDbPayload,
  buildChallengeDbPayload,
  buildUpdateDbPayload,
  ConflictInfo,
  ConflictResolver,
} from '@/services/offlineQueueService';
import { addSyncHistoryEntry } from '@/services/syncHistoryService';
import { prefetchImages, startPeriodicCacheCleanup, stopPeriodicCacheCleanup, clearAllImageCache } from '@/services/imageCacheService';
import { loadSyncConfig, getSyncConfig, onSyncConfigChange, setBatterySaverMode, DELTA_SELECT, SyncConfig } from '@/services/syncConfigService';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  mockPlayers,
  mockClubs,
  mockTournaments,
  mockMatches,
  mockChallenges,
  mockTerrains,
  currentUserStats,
  Player,
  Club,
  Tournament,
  Match,
  HeadToHead,
  BracketMatch,
  Challenge,
  ChallengeType,
  ChallengeStats,
  Terrain,
  TournamentNotification,
  BoulesSet,
} from '@/services/mockData';

interface AppContextType {
  // Data
  players: Player[];
  clubs: Club[];
  tournaments: Tournament[];
  matches: Match[];
  challenges: Challenge[];
  terrains: Terrain[];
  userStats: typeof currentUserStats;
  challengeStats: ChallengeStats;
  boulesSets: BoulesSet[];
  loading: boolean;
  
  // Current user's player info
  selfPlayer: Player | null;
  
  // Add Actions
  addMatch: (match: Omit<Match, 'id'>) => Promise<string | null>;
  addPlayer: (player: Omit<Player, 'id'>) => Promise<void>;
  addClub: (club: Omit<Club, 'id'>) => Promise<void>;
  addTournament: (tournament: Omit<Tournament, 'id'>) => Promise<void>;
  addChallenge: (challenge: Omit<Challenge, 'id'>) => Promise<string | null>;
  addTerrain: (terrain: Omit<Terrain, 'id'>) => Promise<void>;
  
  // Boules Sets CRUD
  addBoulesSet: (set: Omit<BoulesSet, 'id'>) => Promise<void>;
  updateBoulesSet: (id: string, updates: Partial<BoulesSet>) => Promise<void>;
  deleteBoulesSet: (id: string) => Promise<void>;
  setPrimaryBoulesSet: (id: string) => Promise<void>;
  
  // Update Actions
  updateMatch: (id: string, updates: Partial<Match>) => Promise<void>;
  updatePlayer: (id: string, updates: Partial<Player>) => Promise<void>;
  updateClub: (id: string, updates: Partial<Club>) => Promise<void>;
  updateTournament: (id: string, updates: Partial<Tournament>) => Promise<void>;
  updateTerrain: (id: string, updates: Partial<Terrain>) => Promise<void>;
  updateChallenge: (id: string, updates: Partial<Challenge>) => Promise<void>;
  updateBracketMatch: (tournamentId: string, bracketMatchId: string, updates: Partial<BracketMatch>) => void;
  
  // Delete Actions
  deleteMatch: (id: string) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  deleteChallenge: (id: string) => Promise<void>;
  deleteTerrain: (id: string) => Promise<void>;
  deleteClub: (id: string) => Promise<void>;
  deleteTournament: (id: string) => Promise<void>;
  deleteBoulesSet: (id: string) => Promise<void>;
  
  // Favorites
  favoriteTerrainIds: string[];
  toggleFavoriteTerrain: (terrainId: string) => void;
  isFavoriteTerrain: (terrainId: string) => boolean;
  favoriteClubIds: string[];
  toggleFavoriteClub: (clubId: string) => void;
  isFavoriteClub: (clubId: string) => boolean;
  
  // Tournament Notifications
  tournamentNotifications: string[];
  toggleTournamentNotification: (tournamentId: string) => void;
  isTournamentNotificationEnabled: (tournamentId: string) => boolean;
  
  // Shared items permissions
  getSharedPermission: (itemId: string) => 'read' | 'write' | null;
  
  // Getters
  getPlayerById: (id: string) => Player | undefined;
  getClubById: (id: string) => Club | undefined;
  getTournamentById: (id: string) => Tournament | undefined;
  getMatchById: (id: string) => Match | undefined;
  getTerrainById: (id: string) => Terrain | undefined;
  getMatchesByPlayer: (playerId: string) => Match[];
  getMatchesByTournament: (tournamentId: string) => Match[];
  
  // Head-to-head comparison
  getHeadToHead: (player1Id: string, player2Id: string) => HeadToHead;
  getCommonOpponents: (player1Id: string, player2Id: string) => string[];

  // Toggle public/private
  setItemPublic: (type: 'players' | 'clubs' | 'terrains' | 'tournaments', itemId: string, isPublic: boolean) => void;

  // Offline queue replay
  isReplayingQueue: boolean;
  replayProgress: { current: number; total: number };

  // Conflict resolution
  currentConflict: ConflictInfo | null;
  conflictRemaining: number;
  resolveConflict: (choice: 'local' | 'server' | 'skip') => void;

  // Retry failed operations
  retryFailedOps: (opIds?: string[]) => Promise<void>;
  
  // Premium (ad-free)
  isPremium: boolean;
  setIsPremium: (val: boolean) => void;

  // Admin
  isAdmin: boolean;

  // Refresh
  refreshData: () => Promise<void>;

  // Battery saver
  batterySaverEnabled: boolean;
  setBatterySaver: (enabled: boolean) => Promise<void>;
}

// Module-level helper: calculate stats for a single player from matches
function calculatePlayerStatsFromMatches(allMatches: Match[], playerId: string, existingStats: any) {
  const playerMatches = allMatches.filter(m =>
    m.teamA.players.includes(playerId) || m.teamB.players.includes(playerId)
  );
  if (playerMatches.length === 0) return existingStats;

  const totalMatches = playerMatches.length;
  const wins = playerMatches.filter(m => {
    const inA = m.teamA.players.includes(playerId);
    return (inA && m.winner === 'A') || (!inA && m.winner === 'B');
  }).length;
  const losses = totalMatches - wins;

  let totalTirs = 0, totalTirsSuccess = 0, totalPoints = 0, totalPointsSuccess = 0, totalCarreaux = 0;
  let totalScoreFor = 0, totalScoreAgainst = 0;

  playerMatches.forEach(m => {
    const inA = m.teamA.players.includes(playerId);
    totalScoreFor += inA ? m.teamA.score : m.teamB.score;
    totalScoreAgainst += inA ? m.teamB.score : m.teamA.score;
    if (m.playerActions) {
      const pa = m.playerActions.find(a => a.playerId === playerId);
      if (pa) {
        totalTirs += pa.actions.tirs;
        totalTirsSuccess += pa.actions.tirsSuccess;
        totalPoints += pa.actions.points;
        totalPointsSuccess += pa.actions.pointsSuccess;
        totalCarreaux += pa.actions.carreaux;
      }
    }
  });

  return {
    ...existingStats,
    matchesPlayed: totalMatches,
    wins,
    losses,
    winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0,
    tirRate: totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 1000) / 10 : existingStats.tirRate || 0,
    pointRate: totalPoints > 0 ? Math.round((totalPointsSuccess / totalPoints) * 1000) / 10 : existingStats.pointRate || 0,
    carreauRate: totalTirsSuccess > 0 ? Math.round((totalCarreaux / totalTirsSuccess) * 1000) / 10 : existingStats.carreauRate || 0,
    avgPointsScored: totalMatches > 0 ? Math.round((totalScoreFor / totalMatches) * 10) / 10 : 0,
    avgPointsConceded: totalMatches > 0 ? Math.round((totalScoreAgainst / totalMatches) * 10) / 10 : 0,
  };
}

// Module-level DB row mappers (pure functions, reusable in full & delta sync)
function mapClubFromDb(c: any): Club {
  return {
    id: c.id, name: c.name, logo: c.logo, address: c.address, city: c.city,
    country: c.country || 'France', location: c.location || { latitude: 0, longitude: 0 },
    membersCount: c.members_count || 0, foundedYear: c.founded_year,
    description: c.description, facilities: c.facilities || [],
    contactEmail: c.contact_email, contactPhone: c.contact_phone,
    terrainId: c.terrain_id, terrainName: c.terrain_name,
    membershipCost: c.membership_cost ? parseFloat(c.membership_cost) : undefined,
    isPublic: c.is_public ?? false, showContactPublic: c.show_contact_public ?? false,
    clubCardUrl: c.club_card_url || undefined,
    website: c.website || undefined,
    facebookUrl: c.facebook_url || undefined,
    instagramHandle: c.instagram_handle || undefined,
  };
}

function mapTerrainFromDb(t: any): Terrain {
  return {
    id: t.id, name: t.name, address: t.address, city: t.city,
    location: t.location || { latitude: 0, longitude: 0 }, type: t.type,
    description: t.description, facilities: t.facilities || [], photos: t.photos || [],
    clubId: t.club_id, clubName: t.club_name, isPublic: t.is_public ?? true,
    publicAccess: t.public_access ?? true, courtsCount: t.courts_count || 1,
    lighting: t.lighting ?? false, covered: t.covered ?? false,
    environment: t.environment || 'outdoor', createdAt: t.created_at,
  };
}

function mapTournamentFromDb(t: any): Tournament {
  return {
    id: t.id, name: t.name, date: t.date, endDate: t.end_date,
    type: t.type, format: t.format, location: t.location,
    terrainId: t.terrain_id, terrainName: t.terrain_name, terrainType: t.terrain_type,
    clubId: t.club_id, clubName: t.club_name, status: t.status,
    participants: t.participants || 0, maxParticipants: t.max_participants || 32,
    prize: t.prize, description: t.description, teams: t.teams, phases: t.phases,
    currentPhaseId: t.current_phase_id, tournamentLevel: t.tournament_level,
    tournamentCategory: t.tournament_category, registrationType: t.registration_type,
    tournamentScope: t.tournament_scope,
    registrationCost: t.registration_cost ? parseFloat(t.registration_cost) : undefined,
    prizeWon: t.prize_won ? parseFloat(t.prize_won) : undefined,
    finalResult: t.final_result, isPublic: t.is_public ?? false,
  };
}

function mapMatchFromDb(m: any): Match {
  return {
    id: m.id, date: m.date, mode: m.mode, format: m.format,
    tournamentId: m.tournament_id, tournamentName: m.tournament_name,
    tournamentPhase: m.tournament_phase, tournamentBracket: m.tournament_bracket,
    bracketMatchId: m.bracket_match_id, terrainId: m.terrain_id, terrainType: m.terrain_type,
    boulesSetId: m.boules_set_id,
    teamA: m.team_a, teamB: m.team_b, winner: m.winner,
    duration: m.duration || 0, menes: m.menes || [],
    playerActions: m.player_actions, seriesInfo: m.series_info,
  };
}

function mapChallengeFromDb(c: any): Challenge {
  return {
    id: c.id, type: c.type, mode: c.mode || 'solo', date: c.date,
    boulesSetId: c.boules_set_id, terrainId: c.terrain_id,
    playerId: c.player_id, playerName: c.player_name,
    opponentId: c.opponent_id, opponentName: c.opponent_name,
    opponentResult: c.opponent_result, winner: c.winner,
    shots: c.shots, successCount: c.success_count, totalShots: c.total_shots,
    carreauCount: c.carreau_count,
    successRate: c.success_rate ? parseFloat(c.success_rate) : undefined,
    precisionShots: c.precision_shots, totalPoints: c.total_points,
    maxPoints: c.max_points, atelierScores: c.atelier_scores,
    duration: c.duration, notes: c.notes, detailedShots: c.detailed_shots,
  };
}

function mapPlayerFromDb(p: any): Player {
  return {
    id: p.id, name: p.name, nickname: p.nickname, avatar: p.avatar,
    club: p.club, clubId: p.club_id, role: p.role, level: p.level,
    location: p.location, phone: p.phone, email: p.email, country: p.country,
    boules: p.boules, handedness: p.handedness, terrainId: p.terrain_id,
    terrainName: p.terrain_name, isPublic: p.is_public ?? false,
    showContactPublic: p.show_contact_public ?? false,
    stats: p.stats || {
      matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
      tirRate: 0, pointRate: 0, carreauRate: 0,
      avgPointsScored: 0, avgPointsConceded: 0,
    },
    createdAt: p.created_at,
  };
}

// Merge delta records into existing array (upsert by id)
function mergeRecords<T extends { id: string }>(existing: T[], delta: T[]): T[] {
  if (delta.length === 0) return existing;
  const deltaMap = new Map(delta.map(item => [item.id, item]));
  const merged = existing.map(item => deltaMap.has(item.id) ? deltaMap.get(item.id)! : item);
  const existingIds = new Set(existing.map(item => item.id));
  delta.forEach(item => {
    if (!existingIds.has(item.id)) merged.push(item);
  });
  return merged;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  const { isConnected, justReconnected } = useNetworkStatus();
  const isConnectedRef = useRef(isConnected);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const initialLoadDone = useRef(false);
  const secondaryLoadDone = useRef(false);
  const secondaryLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncCountRef = useRef(0);
  const [syncConfig, setSyncConfigState] = useState<SyncConfig>(getSyncConfig());
  const syncConfigRef = useRef(syncConfig);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [boulesSets, setBoulesSets] = useState<BoulesSet[]>([]);
  const [favoriteTerrainIds, setFavoriteTerrainIds] = useState<string[]>([]);
  const [favoriteClubIds, setFavoriteClubIds] = useState<string[]>([]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [sharedItemPermissions, setSharedItemPermissions] = useState<Record<string, 'read' | 'write'>>({});
  const [tournamentNotifications, setTournamentNotifications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremiumState] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReplayingQueue, setIsReplayingQueue] = useState(false);
  const [replayProgress, setReplayProgress] = useState({ current: 0, total: 0 });
  const [currentConflict, setCurrentConflict] = useState<ConflictInfo | null>(null);
  const [conflictRemaining, setConflictRemaining] = useState(0);
  const conflictResolverRef = useRef<((choice: 'local' | 'server' | 'skip') => void) | null>(null);

  // Premium setter that also persists to DB
  const setIsPremium = useCallback((val: boolean) => {
    setIsPremiumState(val);
    if (user?.id) {
      supabase.from('user_profiles').update({ is_premium: val }).eq('id', user.id).then(() => {});
    }
  }, [user?.id, supabase]);

  // Resolve conflict from UI
  const resolveConflict = useCallback((choice: 'local' | 'server' | 'skip') => {
    if (conflictResolverRef.current) {
      conflictResolverRef.current(choice);
      conflictResolverRef.current = null;
      setCurrentConflict(null);
    }
  }, []);

  // Conflict handler that pauses replay and waits for user decision
  const handleConflict: ConflictResolver = useCallback(async (conflict: ConflictInfo) => {
    return new Promise<'local' | 'server' | 'skip'>((resolve) => {
      conflictResolverRef.current = resolve;
      setCurrentConflict(conflict);
      // remaining is calculated from replayProgress
    });
  }, []);
  
  // Recalculate player stats from actual match data
  const playersWithStats = React.useMemo(() => {
    if (matches.length === 0) return players;
    return players.map(player => {
      const newStats = calculatePlayerStatsFromMatches(matches, player.id, player.stats);
      if (newStats === player.stats) return player;
      return { ...player, stats: newStats };
    });
  }, [players, matches]);

  // Self player (current user's player card) - use recalculated stats
  const selfPlayer = React.useMemo(() => {
    if (!user?.id) return null;
    return playersWithStats.find(p => p.id === user.id) || null;
  }, [playersWithStats, user?.id]);

  // Recalculate club membersCount from players referencing each club
  const clubsWithMemberCount = React.useMemo(() => {
    return clubs.map(club => {
      const memberCount = playersWithStats.filter(p => p.clubId === club.id).length;
      return { ...club, membersCount: Math.max(memberCount, club.membersCount || 0) };
    });
  }, [clubs, playersWithStats]);

  // Calculate user stats from actual data
  const userStats = React.useMemo(() => {
    const userMatches = matches.filter(m => m.teamA.players.includes('self') || m.winner);
    const totalMatches = matches.length;
    const wins = matches.filter(m => m.winner === 'A').length;
    const losses = totalMatches - wins;
    
    // Calculate shot stats from player actions
    let totalTirs = 0;
    let totalTirsSuccess = 0;
    let totalPoints = 0;
    let totalPointsSuccess = 0;
    let totalCarreaux = 0;

    matches.forEach(m => {
      if (m.playerActions) {
        m.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          totalTirs += pa.actions.tirs;
          totalTirsSuccess += pa.actions.tirsSuccess;
          totalPoints += pa.actions.points;
          totalPointsSuccess += pa.actions.pointsSuccess;
          totalCarreaux += pa.actions.carreaux;
        });
      }
    });

    const tournamentMatches = matches.filter(m => m.mode === 'Tournoi');
    const tournamentWins = tournamentMatches.filter(m => m.winner === 'A').length;

    return {
      playerId: user?.id || '1',
      playerName: user?.username || 'Utilisateur',
      totalMatches,
      wins,
      losses,
      winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100 * 10) / 10 : 0,
      currentStreak: 0,
      longestStreak: 0,
      tirSuccessRate: totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100 * 10) / 10 : 0,
      pointSuccessRate: totalPoints > 0 ? Math.round((totalPointsSuccess / totalPoints) * 100 * 10) / 10 : 0,
      carreauRate: totalTirsSuccess > 0 ? Math.round((totalCarreaux / totalTirsSuccess) * 100 * 10) / 10 : 0,
      avgMatchDuration: totalMatches > 0 ? Math.round(matches.reduce((sum, m) => sum + m.duration, 0) / totalMatches) : 0,
      tournamentsWon: 0,
      tournamentsPlayed: new Set(tournamentMatches.map(m => m.tournamentId)).size,
      weeklyProgress: [],
      recentOpponents: [],
    };
  }, [matches, user]);

  // Calculate challenge stats
  const challengeStats: ChallengeStats = React.useMemo(() => {
    const byType = {
      '10_tirs': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
      '10_tirs_sautee': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
      'precision': { count: 0, avgSuccess: 0, bestScore: 0, totalSuccess: 0 },
    };

    let totalShots = 0;
    let totalSuccess = 0;

    challenges.forEach(c => {
      const type = byType[c.type];
      type.count++;
      
      if (c.type === 'precision') {
        const score = c.totalPoints || 0;
        type.totalSuccess += score;
        type.bestScore = Math.max(type.bestScore, score);
        totalShots += 20;
        totalSuccess += (c.precisionShots?.filter(s => s.points >= 3).length || 0);
      } else {
        type.totalSuccess += (c.successRate || 0);
        type.bestScore = Math.max(type.bestScore, c.successRate || 0);
        totalShots += (c.totalShots || 0);
        totalSuccess += (c.successCount || 0);
      }
    });

    Object.keys(byType).forEach(key => {
      const type = byType[key as ChallengeType];
      type.avgSuccess = type.count > 0 ? Math.round(type.totalSuccess / type.count) : 0;
    });

    return {
      totalChallenges: challenges.length,
      byType: {
        '10_tirs': { count: byType['10_tirs'].count, avgSuccess: byType['10_tirs'].avgSuccess, bestScore: byType['10_tirs'].bestScore },
        '10_tirs_sautee': { count: byType['10_tirs_sautee'].count, avgSuccess: byType['10_tirs_sautee'].avgSuccess, bestScore: byType['10_tirs_sautee'].bestScore },
        'precision': { count: byType['precision'].count, avgSuccess: byType['precision'].avgSuccess, bestScore: byType['precision'].bestScore },
      },
      recentChallenges: [...challenges].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
      totalShots,
      totalSuccess,
      overallSuccessRate: totalShots > 0 ? Math.round((totalSuccess / totalShots) * 100) : 0,
    };
  }, [challenges]);

  // Helper to transform a raw player DB row (reusable across loadData and addPlayer)
  const mapPlayer = useCallback((p: any): Player => mapPlayerFromDb(p), []);

  // Load sync config on mount
  useEffect(() => {
    loadSyncConfig().then(cfg => {
      setSyncConfigState(cfg);
      syncConfigRef.current = cfg;
    });
    const unsub = onSyncConfigChange(cfg => {
      setSyncConfigState(cfg);
      syncConfigRef.current = cfg;
    });
    return unsub;
  }, []);

  // Battery saver toggle
  const setBatterySaver = useCallback(async (enabled: boolean) => {
    const cfg = await setBatterySaverMode(enabled);
    setSyncConfigState(cfg);
    syncConfigRef.current = cfg;
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    isConnectedRef.current = isConnected;
    if (!isConnected) {
      setIsOfflineMode(true);
    }
  }, [isConnected]);

  // Load from local cache on first mount (before network fetch)
  useEffect(() => {
    if (!user?.id || cacheLoaded) return;
    const loadCache = async () => {
      try {
        const cached = await loadFromCache();
        if (cached) {
          // Only apply cache if we have not yet loaded from network
          if (!initialLoadDone.current) {
            if (cached.players.length > 0) setPlayers(cached.players);
            if (cached.clubs.length > 0) setClubs(cached.clubs);
            if (cached.tournaments.length > 0) setTournaments(cached.tournaments);
            if (cached.matches.length > 0) setMatches(cached.matches);
            if (cached.challenges.length > 0) setChallenges(cached.challenges);
            if (cached.terrains.length > 0) setTerrains(cached.terrains);
            console.log('Loaded data from local cache');
          }
        }
      } catch (e) {
        console.log('Error loading cache:', e);
      } finally {
        setCacheLoaded(true);
      }
    };
    loadCache();
  }, [user?.id, cacheLoaded]);

  // Replay offline queue then delta sync when network returns
  // Note: loadDeltaData is declared later but referenced here via loadDeltaDataRef
  const loadDeltaDataRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    if (justReconnected && user?.id) {
      console.log('Network restored - replaying offline queue then syncing...');
      setIsOfflineMode(false);
      (async () => {
        const queueSizeVal = await getQueueSize();
        if (queueSizeVal > 0) {
          console.log(`Replaying ${queueSizeVal} queued operations...`);
          setIsReplayingQueue(true);
          setReplayProgress({ current: 0, total: queueSizeVal });
          const startTime = Date.now();
          const result = await replayOfflineQueue(supabase, user.id, (current, total) => {
            setReplayProgress({ current, total });
            setConflictRemaining(Math.max(0, total - current));
          }, handleConflict);
          const duration = Date.now() - startTime;
          setIsReplayingQueue(false);
          setReplayProgress({ current: 0, total: 0 });
          setCurrentConflict(null);
          // Log sync history
          await addSyncHistoryEntry({
            date: new Date().toISOString(),
            total: result.total,
            succeeded: result.succeeded,
            failed: result.failed,
            conflictsDetected: result.conflictsDetected,
            conflictsResolved: result.conflictsResolved,
            errors: result.errors,
            duration,
          });
          // After replay, do a full sync to reconcile temp IDs with real ones
          await loadData();
        } else {
          await loadDeltaDataRef.current();
        }
      })();
    }
  }, [justReconnected, user?.id, loadData, supabase, handleConflict]);

  // ===== SECONDARY DATA LOADER (shared items, boules sets, preferences) =====
  // Deferred after primary load to reduce startup time
  const loadSecondaryData = useCallback(async () => {
    if (!user?.id || !isConnectedRef.current) return;
    console.log('Loading secondary data (shared items, boules sets, preferences)...');
    try {
      const [sharedWithMeRes, boulesSetsRes] = await Promise.all([
        supabase.from('shared_items').select('item_type, item_id, permission').eq('shared_with_id', user.id),
        supabase.from('boules_sets').select('*').order('created_at', { ascending: false }),
      ]);

      // Build permissions map and group shared IDs
      const sharedIds: Record<string, string[]> = { player: [], club: [], terrain: [], tournament: [] };
      const permissionsMap: Record<string, 'read' | 'write'> = {};
      if (sharedWithMeRes.data) {
        sharedWithMeRes.data.forEach((si: any) => {
          if (sharedIds[si.item_type]) {
            sharedIds[si.item_type].push(si.item_id);
          }
          permissionsMap[si.item_id] = si.permission as 'read' | 'write';
        });
      }
      setSharedItemPermissions(permissionsMap);

      // Fetch shared records in parallel
      const [sharedPlayersRes, sharedClubsRes, sharedTerrainsRes, sharedTournamentsRes] = await Promise.all([
        sharedIds.player.length > 0
          ? supabase.from('players').select('*').in('id', sharedIds.player)
          : Promise.resolve({ data: [] as any[] }),
        sharedIds.club.length > 0
          ? supabase.from('clubs').select('*').in('id', sharedIds.club)
          : Promise.resolve({ data: [] as any[] }),
        sharedIds.terrain.length > 0
          ? supabase.from('terrains').select('*').in('id', sharedIds.terrain)
          : Promise.resolve({ data: [] as any[] }),
        sharedIds.tournament.length > 0
          ? supabase.from('tournaments').select('*').in('id', sharedIds.tournament)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // Merge shared players into existing state (append only new ones)
      if (sharedPlayersRes.data && sharedPlayersRes.data.length > 0) {
        const sharedPlayers = sharedPlayersRes.data.map(mapPlayerFromDb);
        setPlayers(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newShared = sharedPlayers.filter(p => !existingIds.has(p.id));
          return newShared.length > 0 ? [...prev, ...newShared] : prev;
        });
      }
      if (sharedClubsRes.data && sharedClubsRes.data.length > 0) {
        const sharedClubs = sharedClubsRes.data.map(mapClubFromDb);
        setClubs(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newShared = sharedClubs.filter(c => !existingIds.has(c.id));
          return newShared.length > 0 ? [...prev, ...newShared] : prev;
        });
      }
      if (sharedTerrainsRes.data && sharedTerrainsRes.data.length > 0) {
        const sharedTerrains = sharedTerrainsRes.data.map(mapTerrainFromDb);
        setTerrains(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newShared = sharedTerrains.filter(t => !existingIds.has(t.id));
          return newShared.length > 0 ? [...prev, ...newShared] : prev;
        });
      }
      if (sharedTournamentsRes.data && sharedTournamentsRes.data.length > 0) {
        const sharedTournaments = sharedTournamentsRes.data.map(mapTournamentFromDb);
        setTournaments(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newShared = sharedTournaments.filter(t => !existingIds.has(t.id));
          return newShared.length > 0 ? [...prev, ...newShared] : prev;
        });
      }

      // Boules sets
      if (boulesSetsRes.data) {
        const dbSets: BoulesSet[] = boulesSetsRes.data.map((s: any) => ({
          id: s.id, name: s.name, brand: s.brand,
          diameter: s.diameter ? parseFloat(s.diameter) : undefined,
          weight: s.weight || undefined, serialNumber: s.serial_number,
          hardness: s.hardness, isPrimary: s.is_primary, notes: s.notes, photo: s.photo,
          purchasePrice: s.purchase_price ? parseFloat(s.purchase_price) : undefined,
        }));
        setBoulesSets(dbSets);
      }

      secondaryLoadDone.current = true;
      console.log('Secondary data loaded successfully');

      // Prefetch boules set photos after secondary load
      if (boulesSetsRes.data) {
        const dbSetsForPrefetch = boulesSetsRes.data.filter((s: any) => s.photo).map((s: any) => ({ photo: s.photo }));
        if (dbSetsForPrefetch.length > 0) {
          prefetchImages({ boulesSets: dbSetsForPrefetch });
        }
      }

      // Cleanup soft_deletes older than 30 days (non-blocking)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      supabase.from('soft_deletes').delete().lt('deleted_at', thirtyDaysAgo.toISOString()).then(() => {
        console.log('Cleaned up old soft_deletes entries');
      }).catch(() => { /* silent */ });
    } catch (error) {
      console.log('Error loading secondary data:', error);
    }
  }, [user?.id, supabase]);

  // Schedule secondary data loading after primary load completes
  const scheduleSecondaryLoad = useCallback(() => {
    if (secondaryLoadTimerRef.current) clearTimeout(secondaryLoadTimerRef.current);
    const delay = syncConfigRef.current.secondaryLoadDelayMs;
    secondaryLoadTimerRef.current = setTimeout(() => {
      loadSecondaryData();
    }, delay);
  }, [loadSecondaryData]);

  // Cleanup secondary load timer on unmount
  useEffect(() => {
    return () => {
      if (secondaryLoadTimerRef.current) clearTimeout(secondaryLoadTimerRef.current);
    };
  }, []);

  // Load data from Supabase - Phase 1: Core data only (fast startup)
  const loadData = useCallback(async () => {
    if (!user?.id) {
      // Not logged in - use mock data for demo
      setPlayers(mockPlayers);
      setClubs(mockClubs);
      setTournaments(mockTournaments);
      setMatches(mockMatches);
      setChallenges(mockChallenges);
      setTerrains(mockTerrains);
      setLoading(false);
      return;
    }

    // If offline, skip network fetch (use cached data)
    if (!isConnectedRef.current) {
      setIsOfflineMode(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Phase 1: Fetch only core user data (no shared items, no boules sets)
      const [playersRes, clubsRes, tournamentsRes, matchesRes, challengesRes, terrainsRes, profileRes] = await Promise.all([
        supabase.from('players').select('*').order('created_at', { ascending: false }),
        supabase.from('clubs').select('*').order('created_at', { ascending: false }),
        supabase.from('tournaments').select('*').order('date', { ascending: false }),
        supabase.from('matches').select('*').order('date', { ascending: false }),
        supabase.from('challenges').select('*').order('date', { ascending: false }),
        supabase.from('terrains').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
      ]);

      // Load premium & admin status from profile
      if (profileRes.data) {
        setIsPremiumState(profileRes.data.is_premium ?? false);
        setIsAdmin(profileRes.data.is_admin ?? false);
      }

      let dbPlayers: Player[] = [];
      if (playersRes.data) {
        dbPlayers = playersRes.data.map(mapPlayer);
      }

      // Check if selfPlayer exists, if not create it from user_profiles
      const selfPlayerExists = dbPlayers.some(p => p.id === user.id);
      if (!selfPlayerExists && profileRes.data) {
        // Create player entry for current user
        const profile = profileRes.data;
        const { data: newPlayerData, error: createError } = await supabase.from('players').insert({
          id: user.id,
          user_id: user.id,
          name: profile.username || user.email?.split('@')[0] || 'Joueur',
          role: profile.role || 'Milieu',
          level: profile.level || 'Intermédiaire',
          club: profile.club,
          avatar: profile.avatar,
          stats: {
            matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
            tirRate: 0, pointRate: 0, carreauRate: 0,
            avgPointsScored: 0, avgPointsConceded: 0
          },
        }).select().single();

        if (!createError && newPlayerData) {
          dbPlayers.push(mapPlayer(newPlayerData));
        }
      }

      setPlayers(dbPlayers.length > 0 ? dbPlayers : mockPlayers);

      if (clubsRes.data) {
        const dbClubs: Club[] = clubsRes.data.map(mapClubFromDb);
        setClubs(dbClubs.length > 0 ? dbClubs : mockClubs);
      }

      if (terrainsRes.data) {
        const dbTerrains: Terrain[] = terrainsRes.data.map(mapTerrainFromDb);
        setTerrains(dbTerrains.length > 0 ? dbTerrains : mockTerrains);
      }

      if (tournamentsRes.data) {
        const dbTournaments: Tournament[] = tournamentsRes.data.map(mapTournamentFromDb);
        setTournaments(dbTournaments.length > 0 ? dbTournaments : mockTournaments);
      }

      if (matchesRes.data) {
        const dbMatches: Match[] = matchesRes.data.map(mapMatchFromDb);
        setMatches(dbMatches.length > 0 ? dbMatches : mockMatches);
      }

      if (challengesRes.data) {
        const dbChallenges: Challenge[] = challengesRes.data.map(mapChallengeFromDb);
        setChallenges(dbChallenges.length > 0 ? dbChallenges : mockChallenges);
      }

      // Mark primary load as complete and save sync timestamp
      initialLoadDone.current = true;
      setIsOfflineMode(false);
      await setLastSyncTimestamp(new Date().toISOString());

      // Phase 2: Schedule secondary data loading (shared items, boules sets)
      // This runs after the UI has rendered with core data
      scheduleSecondaryLoad();

      // Phase 2b: Prefetch critical images (avatars, terrain photos) in background
      if (!syncConfigRef.current.skipImagePrefetch) {
        setTimeout(() => {
          prefetchImages({
            players: dbPlayers,
            terrains: terrainsRes.data ? terrainsRes.data.map(mapTerrainFromDb) : [],
          });
        }, 1200);
      }

    } catch (error) {
      console.log('Error loading data from cloud:', error);
      // If we have cached data, keep using it instead of mock data
      if (!initialLoadDone.current) {
        const cached = await loadFromCache();
        if (cached && (cached.players.length > 0 || cached.matches.length > 0)) {
          if (cached.players.length > 0) setPlayers(cached.players);
          if (cached.clubs.length > 0) setClubs(cached.clubs);
          if (cached.tournaments.length > 0) setTournaments(cached.tournaments);
          if (cached.matches.length > 0) setMatches(cached.matches);
          if (cached.challenges.length > 0) setChallenges(cached.challenges);
          if (cached.terrains.length > 0) setTerrains(cached.terrains);
          setIsOfflineMode(true);
        } else {
          setPlayers(mockPlayers);
          setClubs(mockClubs);
          setTournaments(mockTournaments);
          setMatches(mockMatches);
          setChallenges(mockChallenges);
          setTerrains(mockTerrains);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase, mapPlayer, scheduleSecondaryLoad]);

  // Delta sync: only fetch records changed since last sync timestamp
  // Keep ref in sync for reconnection effect
  const loadDeltaData = useCallback(async () => {
    if (!user?.id || !isConnectedRef.current || !initialLoadDone.current) return;

    const lastSync = await getLastSyncTimestamp();
    if (!lastSync) {
      // No previous sync timestamp, fall back to full sync
      return loadData();
    }

    const syncTimestamp = new Date().toISOString();

    try {
      // Fetch updated records AND soft_deletes since last sync in parallel
      // Use selective columns to reduce payload size
      const [playersRes, clubsRes, tournamentsRes, matchesRes, challengesRes, terrainsRes, softDeletesRes] = await Promise.all([
        supabase.from('players').select(DELTA_SELECT.players).gt('updated_at', lastSync),
        supabase.from('clubs').select(DELTA_SELECT.clubs).gt('updated_at', lastSync),
        supabase.from('tournaments').select(DELTA_SELECT.tournaments).gt('updated_at', lastSync),
        supabase.from('matches').select(DELTA_SELECT.matches).gt('updated_at', lastSync),
        supabase.from('challenges').select(DELTA_SELECT.challenges).gt('updated_at', lastSync),
        supabase.from('terrains').select(DELTA_SELECT.terrains).gt('updated_at', lastSync),
        supabase.from('soft_deletes').select('table_name, item_id').gt('deleted_at', lastSync),
      ]);

      const totalChanges =
        (playersRes.data?.length || 0) +
        (clubsRes.data?.length || 0) +
        (tournamentsRes.data?.length || 0) +
        (matchesRes.data?.length || 0) +
        (challengesRes.data?.length || 0) +
        (terrainsRes.data?.length || 0);
      const totalDeletions = softDeletesRes.data?.length || 0;

      if (totalChanges === 0 && totalDeletions === 0) {
        // No changes since last sync
        await setLastSyncTimestamp(syncTimestamp);
        return;
      }

      console.log(`Delta sync: ${totalChanges} records changed, ${totalDeletions} deletions since last sync`);

      // Process deletions first: group by table, then remove from local state
      if (softDeletesRes.data && softDeletesRes.data.length > 0) {
        const deletedByTable: Record<string, Set<string>> = {};
        softDeletesRes.data.forEach((sd: any) => {
          if (!deletedByTable[sd.table_name]) deletedByTable[sd.table_name] = new Set();
          deletedByTable[sd.table_name].add(sd.item_id);
        });
        if (deletedByTable['players']) setPlayers(prev => prev.filter(p => !deletedByTable['players']!.has(p.id)));
        if (deletedByTable['clubs']) setClubs(prev => prev.filter(c => !deletedByTable['clubs']!.has(c.id)));
        if (deletedByTable['terrains']) setTerrains(prev => prev.filter(t => !deletedByTable['terrains']!.has(t.id)));
        if (deletedByTable['tournaments']) setTournaments(prev => prev.filter(t => !deletedByTable['tournaments']!.has(t.id)));
        if (deletedByTable['matches']) setMatches(prev => prev.filter(m => !deletedByTable['matches']!.has(m.id)));
        if (deletedByTable['challenges']) setChallenges(prev => prev.filter(c => !deletedByTable['challenges']!.has(c.id)));
        if (deletedByTable['boules_sets']) setBoulesSets(prev => prev.filter(b => !deletedByTable['boules_sets']!.has(b.id)));
      }

      // Merge updated records into existing state
      if (playersRes.data && playersRes.data.length > 0) {
        const deltaPlayers = playersRes.data.map(mapPlayerFromDb);
        setPlayers(prev => mergeRecords(prev, deltaPlayers));
      }
      if (clubsRes.data && clubsRes.data.length > 0) {
        const deltaClubs = clubsRes.data.map(mapClubFromDb);
        setClubs(prev => mergeRecords(prev, deltaClubs));
      }
      if (terrainsRes.data && terrainsRes.data.length > 0) {
        const deltaTerrains = terrainsRes.data.map(mapTerrainFromDb);
        setTerrains(prev => mergeRecords(prev, deltaTerrains));
      }
      if (tournamentsRes.data && tournamentsRes.data.length > 0) {
        const deltaTournaments = tournamentsRes.data.map(mapTournamentFromDb);
        setTournaments(prev => mergeRecords(prev, deltaTournaments));
      }
      if (matchesRes.data && matchesRes.data.length > 0) {
        const deltaMatches = matchesRes.data.map(mapMatchFromDb);
        setMatches(prev => mergeRecords(prev, deltaMatches));
      }
      if (challengesRes.data && challengesRes.data.length > 0) {
        const deltaChallenges = challengesRes.data.map(mapChallengeFromDb);
        setChallenges(prev => mergeRecords(prev, deltaChallenges));
      }

      await setLastSyncTimestamp(syncTimestamp);
    } catch (error) {
      console.log('Delta sync error, falling back to full sync:', error);
      return loadData();
    }
  }, [user?.id, supabase, loadData]);

  // Keep delta ref in sync
  useEffect(() => {
    loadDeltaDataRef.current = loadDeltaData;
  }, [loadDeltaData]);

  // Persist data to cache whenever critical state changes (debounced)
  useEffect(() => {
    if (!user?.id || !initialLoadDone.current) return;
    const timeout = setTimeout(() => {
      saveToCache({ players, clubs, tournaments, matches, challenges, terrains });
    }, 2000);
    return () => clearTimeout(timeout);
  }, [players, clubs, tournaments, matches, challenges, terrains, user?.id]);

  // Load user preferences (favorites) from database
  const loadPreferences = useCallback(async () => {
    if (!user?.id) {
      setFavoriteTerrainIds([]);
      setFavoriteClubIds([]);
      setPreferencesLoaded(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('favorite_terrain_ids, favorite_club_ids')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine for new users
        console.log('Error loading preferences:', error);
      }

      if (data) {
        setFavoriteTerrainIds(Array.isArray(data.favorite_terrain_ids) ? data.favorite_terrain_ids : []);
        setFavoriteClubIds(Array.isArray(data.favorite_club_ids) ? data.favorite_club_ids : []);
      }
      setPreferencesLoaded(true);
    } catch (e) {
      console.log('Error loading preferences:', e);
      setPreferencesLoaded(true);
    }
  }, [user?.id, supabase]);

  // Save preferences to database (debounced via caller)
  const savePreferences = useCallback(async (terrainIds: string[], clubIds: string[]) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          favorite_terrain_ids: terrainIds,
          favorite_club_ids: clubIds,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) console.log('Error saving preferences:', error);
    } catch (e) {
      console.log('Error saving preferences:', e);
    }
  }, [user?.id, supabase]);

  // Defer preferences loading until after primary data is loaded
  useEffect(() => {
    if (!user?.id) {
      loadPreferences();
      return;
    }
    // Delay preferences by 800ms so core UI renders first
    const timer = setTimeout(() => {
      loadPreferences();
    }, 800);
    return () => clearTimeout(timer);
  }, [loadPreferences, user?.id]);

  // Load data when user changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clear cache on logout
  useEffect(() => {
    if (!user?.id) {
      initialLoadDone.current = false;
      secondaryLoadDone.current = false;
      setCacheLoaded(false);
      setIsOfflineMode(false);
      if (secondaryLoadTimerRef.current) {
        clearTimeout(secondaryLoadTimerRef.current);
        secondaryLoadTimerRef.current = null;
      }
      stopPeriodicCacheCleanup();
      clearAllImageCache();
    }
  }, [user?.id]);

  // Start periodic image memory cache cleanup
  useEffect(() => {
    if (!user?.id) return;
    startPeriodicCacheCleanup();
    return () => stopPeriodicCacheCleanup();
  }, [user?.id]);

  // Auto-refresh: delta sync normally, full sync every Nth cycle
  // Interval controlled by syncConfig (0 = disabled for battery saver)
  useEffect(() => {
    if (!user?.id) return;
    const intervalMs = syncConfigRef.current.syncIntervalMs;
    if (intervalMs <= 0) {
      // Battery saver mode: no automatic sync
      console.log('Battery saver mode: automatic sync disabled');
      return;
    }
    const fullEveryN = syncConfigRef.current.fullSyncEveryN;
    console.log(`Sync interval: ${intervalMs / 1000}s, full every ${fullEveryN} cycles`);
    const interval = setInterval(() => {
      syncCountRef.current += 1;
      if (syncCountRef.current % fullEveryN === 0) {
        console.log('Periodic full sync (cycle', syncCountRef.current, ')');
        loadData();
      } else {
        loadDeltaData();
      }
    }, intervalMs);
    return () => clearInterval(interval);
  }, [user?.id, loadData, loadDeltaData, syncConfig]);

  // Retry failed operations
  const retryFailedOps = useCallback(async (opIds?: string[]) => {
    if (!user?.id || !isConnectedRef.current) return;
    const failedOps = await getFailedOperations();
    const toRetry = opIds ? failedOps.filter(op => opIds.includes(op.id)) : failedOps;
    if (toRetry.length === 0) return;

    setIsReplayingQueue(true);
    setReplayProgress({ current: 0, total: toRetry.length });
    const startTime = Date.now();

    const result = await retryFailedOperations(supabase, user.id, opIds, (current, total) => {
      setReplayProgress({ current, total });
    });

    const duration = Date.now() - startTime;
    setIsReplayingQueue(false);
    setReplayProgress({ current: 0, total: 0 });

    await addSyncHistoryEntry({
      date: new Date().toISOString(),
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      conflictsDetected: 0,
      conflictsResolved: 0,
      errors: result.errors,
      duration,
    });

    if (result.succeeded > 0) {
      await loadData();
    }
  }, [user?.id, supabase, loadData]);

  // Refresh data function (manual pull-to-refresh always does full sync)
  const refreshData = useCallback(async () => {
    syncCountRef.current = 0;
    await loadData();
  }, [loadData]);

  // Persist recalculated stats for affected players to the database
  const persistPlayerStats = useCallback(async (allMatches: Match[], playerIds: string[]) => {
    if (!user?.id) return;
    const uniqueIds = [...new Set(playerIds)];
    for (const playerId of uniqueIds) {
      const player = players.find(p => p.id === playerId);
      const baseStats = player?.stats || {
        matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
        tirRate: 0, pointRate: 0, carreauRate: 0,
        avgPointsScored: 0, avgPointsConceded: 0,
      };
      const newStats = calculatePlayerStatsFromMatches(allMatches, playerId, baseStats);
      try {
        await supabase.from('players').update({
          stats: newStats,
          updated_at: new Date().toISOString(),
        }).eq('id', playerId);
      } catch (e) {
        console.log('Error persisting stats for player:', playerId, e);
      }
    }
  }, [user?.id, supabase, players]);

  // Add functions with cloud sync
  const addMatch = async (match: Omit<Match, 'id'>): Promise<string | null> => {
    if (!user?.id) {
      const tempId = Date.now().toString();
      const newMatch: Match = { ...match, id: tempId };
      setMatches(prev => [newMatch, ...prev]);
      return tempId;
    }

    // Queue if offline
    if (!isConnectedRef.current) {
      const tempId = `temp_${Date.now()}`;
      enqueueOperation({ type: 'insert', table: 'matches', dbPayload: buildMatchDbPayload(match), tempId });
      const newMatch: Match = { ...match, id: tempId };
      setMatches(prev => [newMatch, ...prev]);
      return tempId;
    }

    try {
      const { data, error } = await supabase.from('matches').insert({
        user_id: user.id,
        date: match.date,
        mode: match.mode,
        format: match.format,
        tournament_id: match.tournamentId,
        tournament_name: match.tournamentName,
        tournament_phase: match.tournamentPhase,
        tournament_bracket: match.tournamentBracket,
        bracket_match_id: match.bracketMatchId,
        terrain_id: match.terrainId,
        terrain_type: match.terrainType,
        boules_set_id: match.boulesSetId || null,
        team_a: match.teamA,
        team_b: match.teamB,
        winner: match.winner,
        duration: match.duration,
        menes: match.menes,
        player_actions: match.playerActions,
        series_info: match.seriesInfo,
      }).select().single();

      if (error) throw error;

      if (data) {
        const newMatch: Match = {
          id: data.id,
          date: data.date,
          mode: data.mode,
          format: data.format,
          tournamentId: data.tournament_id,
          tournamentName: data.tournament_name,
          tournamentPhase: data.tournament_phase,
          tournamentBracket: data.tournament_bracket,
          bracketMatchId: data.bracket_match_id,
          terrainId: data.terrain_id,
          terrainType: data.terrain_type,
          boulesSetId: data.boules_set_id,
          teamA: data.team_a,
          teamB: data.team_b,
          winner: data.winner,
          duration: data.duration || 0,
          menes: data.menes || [],
          playerActions: data.player_actions,
          seriesInfo: data.series_info,
        };
        setMatches(prev => [newMatch, ...prev]);
        // Persist recalculated stats for all players in this match
        const updatedMatches = [newMatch, ...matches];
        const affectedPlayers = [...new Set([...newMatch.teamA.players, ...newMatch.teamB.players])];
        persistPlayerStats(updatedMatches, affectedPlayers);
        return data.id;
      }
      return null;
    } catch (error) {
      console.log('Error adding match:', error);
      // Fallback to local
      const tempId = Date.now().toString();
      const newMatch: Match = { ...match, id: tempId };
      setMatches(prev => [newMatch, ...prev]);
      return tempId;
    }
  };

  const addPlayer = async (player: Omit<Player, 'id'>) => {
    if (!user?.id) {
      const newPlayer: Player = { ...player, id: Date.now().toString() };
      setPlayers(prev => [...prev, newPlayer]);
      return;
    }

    if (!isConnectedRef.current) {
      const tempId = `temp_${Date.now()}`;
      enqueueOperation({ type: 'insert', table: 'players', dbPayload: buildPlayerDbPayload(player), tempId });
      setPlayers(prev => [...prev, { ...player, id: tempId } as Player]);
      return;
    }

    try {
      const { data, error } = await supabase.from('players').insert({
        user_id: user.id,
        name: player.name,
        nickname: player.nickname,
        avatar: player.avatar,
        club: player.club,
        club_id: player.clubId,
        role: player.role,
        level: player.level,
        location: player.location,
        phone: player.phone,
        email: player.email,
        country: player.country,
        boules: player.boules,
        handedness: player.handedness,
        terrain_id: player.terrainId,
        terrain_name: player.terrainName,
        is_public: player.isPublic ?? false,
        show_contact_public: player.showContactPublic ?? false,
        stats: player.stats,
      }).select().single();

      if (error) throw error;

      if (data) {
        const newPlayer: Player = mapPlayer(data);
        setPlayers(prev => [...prev, newPlayer]);
      }
    } catch (error) {
      console.log('Error adding player:', error);
      const newPlayer: Player = { ...player, id: Date.now().toString() };
      setPlayers(prev => [...prev, newPlayer]);
    }
  };

  const addClub = async (club: Omit<Club, 'id'>) => {
    if (!user?.id) {
      const newClub: Club = { ...club, id: Date.now().toString() };
      setClubs(prev => [...prev, newClub]);
      return;
    }

    if (!isConnectedRef.current) {
      const tempId = `temp_${Date.now()}`;
      enqueueOperation({ type: 'insert', table: 'clubs', dbPayload: buildClubDbPayload(club), tempId });
      setClubs(prev => [...prev, { ...club, id: tempId }]);
      return;
    }

    try {
      const { data, error } = await supabase.from('clubs').insert({
        user_id: user.id,
        name: club.name,
        logo: club.logo,
        address: club.address,
        city: club.city,
        country: club.country || 'France',
        location: club.location,
        members_count: club.membersCount,
        founded_year: club.foundedYear,
        description: club.description,
        facilities: club.facilities,
        contact_email: club.contactEmail,
        contact_phone: club.contactPhone,
        terrain_id: club.terrainId,
        terrain_name: club.terrainName,
        membership_cost: club.membershipCost,
        club_card_url: club.clubCardUrl || null,
        website: club.website || null,
        facebook_url: club.facebookUrl || null,
        instagram_handle: club.instagramHandle || null,
      }).select().single();

      if (error) throw error;

      if (data) {
        const newClub: Club = {
          id: data.id,
          name: data.name,
          logo: data.logo,
          address: data.address,
          city: data.city,
          country: data.country || 'France',
          location: data.location,
          membersCount: data.members_count,
          foundedYear: data.founded_year,
          description: data.description,
          facilities: data.facilities,
          contactEmail: data.contact_email,
          contactPhone: data.contact_phone,
          terrainId: data.terrain_id,
          terrainName: data.terrain_name,
          membershipCost: data.membership_cost ? parseFloat(data.membership_cost) : undefined,
          isPublic: data.is_public ?? false,
          showContactPublic: data.show_contact_public ?? false,
          clubCardUrl: data.club_card_url || undefined,
          website: data.website || undefined,
          facebookUrl: data.facebook_url || undefined,
          instagramHandle: data.instagram_handle || undefined,
        };
        setClubs(prev => [...prev, newClub]);
      }
    } catch (error) {
      console.log('Error adding club:', error);
      const newClub: Club = { ...club, id: Date.now().toString() };
      setClubs(prev => [...prev, newClub]);
    }
  };

  const addTournament = async (tournament: Omit<Tournament, 'id'>) => {
    if (!user?.id) {
      const newTournament: Tournament = { ...tournament, id: Date.now().toString() };
      setTournaments(prev => [...prev, newTournament]);
      return;
    }

    if (!isConnectedRef.current) {
      const tempId = `temp_${Date.now()}`;
      enqueueOperation({ type: 'insert', table: 'tournaments', dbPayload: buildTournamentDbPayload(tournament), tempId });
      setTournaments(prev => [...prev, { ...tournament, id: tempId }]);
      return;
    }

    try {
      const { data, error } = await supabase.from('tournaments').insert({
        user_id: user.id,
        name: tournament.name,
        date: tournament.date,
        end_date: tournament.endDate,
        type: tournament.type,
        format: tournament.format,
        location: tournament.location,
        terrain_id: tournament.terrainId,
        terrain_name: tournament.terrainName,
        terrain_type: tournament.terrainType,
        club_id: tournament.clubId,
        club_name: tournament.clubName,
        status: tournament.status,
        participants: tournament.participants,
        max_participants: tournament.maxParticipants,
        prize: tournament.prize,
        description: tournament.description,
        teams: tournament.teams,
        phases: tournament.phases,
        current_phase_id: tournament.currentPhaseId,
        tournament_level: tournament.tournamentLevel,
        tournament_category: tournament.tournamentCategory,
        registration_type: tournament.registrationType,
        tournament_scope: tournament.tournamentScope,
        registration_cost: tournament.registrationCost,
        prize_won: tournament.prizeWon,
      }).select().single();

      if (error) throw error;

      if (data) {
        const newTournament: Tournament = {
          id: data.id,
          name: data.name,
          date: data.date,
          endDate: data.end_date,
          type: data.type,
          format: data.format,
          location: data.location,
          terrainId: data.terrain_id,
          terrainName: data.terrain_name,
          terrainType: data.terrain_type,
          clubId: data.club_id,
          clubName: data.club_name,
          status: data.status,
          participants: data.participants,
          maxParticipants: data.max_participants,
          prize: data.prize,
          description: data.description,
          teams: data.teams,
          phases: data.phases,
          currentPhaseId: data.current_phase_id,
          tournamentLevel: data.tournament_level,
          tournamentCategory: data.tournament_category,
          registrationType: data.registration_type,
          tournamentScope: data.tournament_scope,
          registrationCost: data.registration_cost ? parseFloat(data.registration_cost) : tournament.registrationCost,
          prizeWon: data.prize_won ? parseFloat(data.prize_won) : tournament.prizeWon,
        };
        setTournaments(prev => [...prev, newTournament]);
      }
    } catch (error) {
      console.log('Error adding tournament:', error);
      const newTournament: Tournament = { ...tournament, id: Date.now().toString() };
      setTournaments(prev => [...prev, newTournament]);
    }
  };

  const addTerrain = async (terrain: Omit<Terrain, 'id'>) => {
    if (!user?.id) {
      const newTerrain: Terrain = { ...terrain, id: Date.now().toString() };
      setTerrains(prev => [...prev, newTerrain]);
      return;
    }

    if (!isConnectedRef.current) {
      const tempId = `temp_${Date.now()}`;
      enqueueOperation({ type: 'insert', table: 'terrains', dbPayload: buildTerrainDbPayload(terrain), tempId });
      setTerrains(prev => [...prev, { ...terrain, id: tempId }]);
      return;
    }

    try {
      const { data, error } = await supabase.from('terrains').insert({
        user_id: user.id,
        name: terrain.name,
        address: terrain.address,
        city: terrain.city,
        location: terrain.location,
        type: terrain.type,
        description: terrain.description,
        facilities: terrain.facilities,
        photos: terrain.photos,
        club_id: terrain.clubId,
        club_name: terrain.clubName,
        is_public: terrain.isPublic,
        public_access: terrain.publicAccess ?? true,
        courts_count: terrain.courtsCount,
        lighting: terrain.lighting,
        covered: terrain.covered,
        environment: terrain.environment || 'outdoor',
      }).select().single();

      if (error) throw error;

      if (data) {
        const newTerrain: Terrain = {
          id: data.id,
          name: data.name,
          address: data.address,
          city: data.city,
          location: data.location,
          type: data.type,
          description: data.description,
          facilities: data.facilities,
          photos: data.photos,
          clubId: data.club_id,
          clubName: data.club_name,
          isPublic: data.is_public,
          publicAccess: data.public_access ?? true,
          courtsCount: data.courts_count,
          lighting: data.lighting,
          covered: data.covered,
          environment: data.environment || 'outdoor',
          createdAt: data.created_at,
        };
        setTerrains(prev => [...prev, newTerrain]);
      }
    } catch (error) {
      console.log('Error adding terrain:', error);
      const newTerrain: Terrain = { ...terrain, id: Date.now().toString() };
      setTerrains(prev => [...prev, newTerrain]);
    }
  };

  const addChallenge = async (challenge: Omit<Challenge, 'id'>): Promise<string | null> => {
    if (!user?.id) {
      const tempId = Date.now().toString();
      const newChallenge: Challenge = { ...challenge, id: tempId };
      setChallenges(prev => [newChallenge, ...prev]);
      return tempId;
    }

    if (!isConnectedRef.current) {
      const tempId = `temp_${Date.now()}`;
      enqueueOperation({ type: 'insert', table: 'challenges', dbPayload: buildChallengeDbPayload(challenge), tempId });
      setChallenges(prev => [{ ...challenge, id: tempId }, ...prev]);
      return tempId;
    }

    try {
      const { data, error } = await supabase.from('challenges').insert({
        user_id: user.id,
        type: challenge.type,
        mode: challenge.mode,
        date: challenge.date,
        player_id: challenge.playerId,
        player_name: challenge.playerName,
        opponent_id: challenge.opponentId,
        opponent_name: challenge.opponentName,
        opponent_result: challenge.opponentResult,
        winner: challenge.winner,
        shots: challenge.shots,
        success_count: challenge.successCount,
        total_shots: challenge.totalShots,
        carreau_count: challenge.carreauCount,
        success_rate: challenge.successRate,
        precision_shots: challenge.precisionShots,
        total_points: challenge.totalPoints,
        max_points: challenge.maxPoints,
        atelier_scores: challenge.atelierScores,
        duration: challenge.duration,
        notes: challenge.notes,
        detailed_shots: challenge.detailedShots,
        boules_set_id: challenge.boulesSetId || null,
        terrain_id: challenge.terrainId || null,
      }).select().single();

      if (error) throw error;

      if (data) {
        const newChallenge: Challenge = {
          id: data.id,
          type: data.type,
          mode: data.mode || challenge.mode,
          date: data.date,
          playerId: data.player_id,
          playerName: data.player_name,
          opponentId: data.opponent_id || challenge.opponentId,
          opponentName: data.opponent_name || challenge.opponentName,
          opponentResult: data.opponent_result || challenge.opponentResult,
          winner: data.winner || challenge.winner,
          shots: data.shots,
          successCount: data.success_count,
          totalShots: data.total_shots,
          carreauCount: data.carreau_count,
          successRate: data.success_rate ? parseFloat(data.success_rate) : undefined,
          precisionShots: data.precision_shots,
          totalPoints: data.total_points,
          maxPoints: data.max_points,
          atelierScores: data.atelier_scores,
          duration: data.duration,
          notes: data.notes,
          detailedShots: data.detailed_shots,
          boulesSetId: data.boules_set_id,
          terrainId: data.terrain_id,
        };
        setChallenges(prev => [newChallenge, ...prev]);
        return data.id;
      }
      return null;
    } catch (error) {
      console.log('Error adding challenge:', error);
      const tempId = Date.now().toString();
      const newChallenge: Challenge = { ...challenge, id: tempId };
      setChallenges(prev => [newChallenge, ...prev]);
      return tempId;
    }
  };

  // Update functions with cloud sync
  const updateMatch = async (id: string, updates: Partial<Match>) => {
    const existingMatch = matches.find(m => m.id === id);
    // Update local state immediately
    setMatches(prev => prev.map(match => 
      match.id === id ? { ...match, ...updates } : match
    ));

    // Persist recalculated stats if score/winner/actions changed
    if (user?.id && existingMatch && (updates.winner !== undefined || updates.playerActions !== undefined || updates.teamA !== undefined || updates.teamB !== undefined)) {
      const updatedMatch = { ...existingMatch, ...updates } as Match;
      const updatedMatches = matches.map(m => m.id === id ? updatedMatch : m);
      const affectedPlayers = [...new Set([
        ...updatedMatch.teamA.players,
        ...updatedMatch.teamB.players,
        ...(existingMatch.teamA.players || []),
        ...(existingMatch.teamB.players || []),
      ])];
      persistPlayerStats(updatedMatches, affectedPlayers);
    }

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'update', table: 'matches', itemId: id, dbPayload: buildUpdateDbPayload('matches', updates) });
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.mode !== undefined) dbUpdates.mode = updates.mode;
      if (updates.format !== undefined) dbUpdates.format = updates.format;
      if (updates.tournamentId !== undefined) dbUpdates.tournament_id = updates.tournamentId;
      if (updates.tournamentName !== undefined) dbUpdates.tournament_name = updates.tournamentName;
      if (updates.tournamentPhase !== undefined) dbUpdates.tournament_phase = updates.tournamentPhase;
      if (updates.tournamentBracket !== undefined) dbUpdates.tournament_bracket = updates.tournamentBracket;
      if (updates.teamA !== undefined) dbUpdates.team_a = updates.teamA;
      if (updates.teamB !== undefined) dbUpdates.team_b = updates.teamB;
      if (updates.winner !== undefined) dbUpdates.winner = updates.winner;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.menes !== undefined) dbUpdates.menes = updates.menes;
      if (updates.playerActions !== undefined) dbUpdates.player_actions = updates.playerActions;
      if (updates.terrainId !== undefined) dbUpdates.terrain_id = updates.terrainId;
      if (updates.terrainType !== undefined) dbUpdates.terrain_type = updates.terrainType;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from('matches').update(dbUpdates).eq('id', id);
    } catch (error) {
      console.log('Error updating match:', error);
    }
  };

  const updatePlayer = async (id: string, updates: Partial<Player>) => {
    const oldPlayer = players.find(p => p.id === id);
    setPlayers(prev => prev.map(player => 
      player.id === id ? { ...player, ...updates } : player
    ));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'update', table: 'players', itemId: id, dbPayload: buildUpdateDbPayload('players', updates) });
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.nickname !== undefined) dbUpdates.nickname = updates.nickname;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.club !== undefined) dbUpdates.club = updates.club || null;
      if (updates.clubId !== undefined) dbUpdates.club_id = updates.clubId || null;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.level !== undefined) dbUpdates.level = updates.level;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.country !== undefined) dbUpdates.country = updates.country;
      if (updates.boules !== undefined) dbUpdates.boules = updates.boules;
      if (updates.handedness !== undefined) dbUpdates.handedness = updates.handedness || null;
      if (updates.terrainId !== undefined) dbUpdates.terrain_id = updates.terrainId || null;
      if (updates.terrainName !== undefined) dbUpdates.terrain_name = updates.terrainName || null;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
      if (updates.email !== undefined) dbUpdates.email = updates.email || null;
      if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
      if (updates.showContactPublic !== undefined) dbUpdates.show_contact_public = updates.showContactPublic;
      if (updates.stats !== undefined) dbUpdates.stats = updates.stats;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from('players').update(dbUpdates).eq('id', id);

      // Log modification for shared items
      if (sharedItemPermissions[id] === 'write' && oldPlayer) {
        const { data: row } = await supabase.from('players').select('user_id').eq('id', id).single();
        if (row?.user_id) {
          const changes = Object.keys(updates).filter(k => k !== 'stats' && (oldPlayer as any)[k] !== (updates as any)[k]).map(k => ({ field: k, oldValue: (oldPlayer as any)[k], newValue: (updates as any)[k] }));
          logModification({ itemType: 'player', itemId: id, ownerId: row.user_id, changes }).catch(() => {});
        }
      }
    } catch (error) {
      console.log('Error updating player:', error);
    }
  };

  const updateClub = async (id: string, updates: Partial<Club>) => {
    const oldClub = clubs.find(c => c.id === id);
    setClubs(prev => prev.map(club => 
      club.id === id ? { ...club, ...updates } : club
    ));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'update', table: 'clubs', itemId: id, dbPayload: buildUpdateDbPayload('clubs', updates) });
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.logo !== undefined) dbUpdates.logo = updates.logo;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.country !== undefined) dbUpdates.country = updates.country;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.membersCount !== undefined) dbUpdates.members_count = updates.membersCount;
      if (updates.foundedYear !== undefined) dbUpdates.founded_year = updates.foundedYear;
      if (updates.description !== undefined) dbUpdates.description = updates.description || null;
      if (updates.facilities !== undefined) dbUpdates.facilities = updates.facilities;
      if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail || null;
      if (updates.contactPhone !== undefined) dbUpdates.contact_phone = updates.contactPhone || null;
      if (updates.terrainId !== undefined) dbUpdates.terrain_id = updates.terrainId;
      if (updates.terrainName !== undefined) dbUpdates.terrain_name = updates.terrainName;
      if (updates.membershipCost !== undefined) dbUpdates.membership_cost = updates.membershipCost;
      if (updates.showContactPublic !== undefined) dbUpdates.show_contact_public = updates.showContactPublic;
      if ((updates as any).clubCardUrl !== undefined) dbUpdates.club_card_url = (updates as any).clubCardUrl || null;
      if (updates.website !== undefined) dbUpdates.website = updates.website || null;
      if (updates.facebookUrl !== undefined) dbUpdates.facebook_url = updates.facebookUrl || null;
      if (updates.instagramHandle !== undefined) dbUpdates.instagram_handle = updates.instagramHandle || null;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from('clubs').update(dbUpdates).eq('id', id);

      // Log modification for shared items
      if (sharedItemPermissions[id] === 'write' && oldClub) {
        const { data: row } = await supabase.from('clubs').select('user_id').eq('id', id).single();
        if (row?.user_id) {
          const changes = Object.keys(updates).filter(k => (oldClub as any)[k] !== (updates as any)[k]).map(k => ({ field: k, oldValue: (oldClub as any)[k], newValue: (updates as any)[k] }));
          logModification({ itemType: 'club', itemId: id, ownerId: row.user_id, changes }).catch(() => {});
        }
      }
    } catch (error) {
      console.log('Error updating club:', error);
    }
  };

  const updateTournament = async (id: string, updates: Partial<Tournament>) => {
    const oldTournament = tournaments.find(t => t.id === id);
    setTournaments(prev => prev.map(tournament => 
      tournament.id === id ? { ...tournament, ...updates } : tournament
    ));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'update', table: 'tournaments', itemId: id, dbPayload: buildUpdateDbPayload('tournaments', updates) });
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.format !== undefined) dbUpdates.format = updates.format;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.terrainId !== undefined) dbUpdates.terrain_id = updates.terrainId;
      if (updates.terrainName !== undefined) dbUpdates.terrain_name = updates.terrainName;
      if (updates.terrainType !== undefined) dbUpdates.terrain_type = updates.terrainType;
      if (updates.clubId !== undefined) dbUpdates.club_id = updates.clubId;
      if (updates.clubName !== undefined) dbUpdates.club_name = updates.clubName;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.participants !== undefined) dbUpdates.participants = updates.participants;
      if (updates.maxParticipants !== undefined) dbUpdates.max_participants = updates.maxParticipants;
      if (updates.prize !== undefined) dbUpdates.prize = updates.prize;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.teams !== undefined) dbUpdates.teams = updates.teams;
      if (updates.phases !== undefined) dbUpdates.phases = updates.phases;
      if (updates.currentPhaseId !== undefined) dbUpdates.current_phase_id = updates.currentPhaseId;
      if (updates.tournamentLevel !== undefined) dbUpdates.tournament_level = updates.tournamentLevel;
      if (updates.tournamentCategory !== undefined) dbUpdates.tournament_category = updates.tournamentCategory;
      if (updates.registrationType !== undefined) dbUpdates.registration_type = updates.registrationType;
      if (updates.tournamentScope !== undefined) dbUpdates.tournament_scope = updates.tournamentScope;
      if (updates.registrationCost !== undefined) dbUpdates.registration_cost = updates.registrationCost;
      if (updates.prizeWon !== undefined) dbUpdates.prize_won = updates.prizeWon;
      if (updates.finalResult !== undefined) dbUpdates.final_result = updates.finalResult;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from('tournaments').update(dbUpdates).eq('id', id);

      // Log modification for shared items
      if (sharedItemPermissions[id] === 'write' && oldTournament) {
        const { data: row } = await supabase.from('tournaments').select('user_id').eq('id', id).single();
        if (row?.user_id) {
          const ignoreFields = ['teams', 'phases', 'currentPhaseId'];
          const changes = Object.keys(updates).filter(k => !ignoreFields.includes(k) && (oldTournament as any)[k] !== (updates as any)[k]).map(k => ({ field: k, oldValue: (oldTournament as any)[k], newValue: (updates as any)[k] }));
          logModification({ itemType: 'tournament', itemId: id, ownerId: row.user_id, changes }).catch(() => {});
        }
      }
    } catch (error) {
      console.log('Error updating tournament:', error);
    }
  };

  const updateTerrain = async (id: string, updates: Partial<Terrain>) => {
    const oldTerrain = terrains.find(t => t.id === id);
    setTerrains(prev => prev.map(terrain => 
      terrain.id === id ? { ...terrain, ...updates } : terrain
    ));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'update', table: 'terrains', itemId: id, dbPayload: buildUpdateDbPayload('terrains', updates) });
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.city !== undefined) dbUpdates.city = updates.city;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.facilities !== undefined) dbUpdates.facilities = updates.facilities;
      if (updates.photos !== undefined) dbUpdates.photos = updates.photos;
      if (updates.clubId !== undefined) dbUpdates.club_id = updates.clubId;
      if (updates.clubName !== undefined) dbUpdates.club_name = updates.clubName;
      if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;
      if (updates.publicAccess !== undefined) dbUpdates.public_access = updates.publicAccess;
      if (updates.courtsCount !== undefined) dbUpdates.courts_count = updates.courtsCount;
      if (updates.lighting !== undefined) dbUpdates.lighting = updates.lighting;
      if (updates.covered !== undefined) dbUpdates.covered = updates.covered;
      if (updates.environment !== undefined) dbUpdates.environment = updates.environment;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from('terrains').update(dbUpdates).eq('id', id);

      // Log modification for shared items
      if (sharedItemPermissions[id] === 'write' && oldTerrain) {
        const { data: row } = await supabase.from('terrains').select('user_id').eq('id', id).single();
        if (row?.user_id) {
          const changes = Object.keys(updates).filter(k => k !== 'location' && (oldTerrain as any)[k] !== (updates as any)[k]).map(k => ({ field: k, oldValue: (oldTerrain as any)[k], newValue: (updates as any)[k] }));
          logModification({ itemType: 'terrain', itemId: id, ownerId: row.user_id, changes }).catch(() => {});
        }
      }
    } catch (error) {
      console.log('Error updating terrain:', error);
    }
  };

  const updateChallenge = async (id: string, updates: Partial<Challenge>) => {
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'update', table: 'challenges', itemId: id, dbPayload: buildUpdateDbPayload('challenges', updates) });
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.mode !== undefined) dbUpdates.mode = updates.mode;
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.playerId !== undefined) dbUpdates.player_id = updates.playerId;
      if (updates.playerName !== undefined) dbUpdates.player_name = updates.playerName;
      if (updates.opponentId !== undefined) dbUpdates.opponent_id = updates.opponentId;
      if (updates.opponentName !== undefined) dbUpdates.opponent_name = updates.opponentName;
      if (updates.opponentResult !== undefined) dbUpdates.opponent_result = updates.opponentResult;
      if (updates.winner !== undefined) dbUpdates.winner = updates.winner;
      if (updates.shots !== undefined) dbUpdates.shots = updates.shots;
      if (updates.successCount !== undefined) dbUpdates.success_count = updates.successCount;
      if (updates.totalShots !== undefined) dbUpdates.total_shots = updates.totalShots;
      if (updates.carreauCount !== undefined) dbUpdates.carreau_count = updates.carreauCount;
      if (updates.successRate !== undefined) dbUpdates.success_rate = updates.successRate;
      if (updates.precisionShots !== undefined) dbUpdates.precision_shots = updates.precisionShots;
      if (updates.totalPoints !== undefined) dbUpdates.total_points = updates.totalPoints;
      if (updates.maxPoints !== undefined) dbUpdates.max_points = updates.maxPoints;
      if (updates.atelierScores !== undefined) dbUpdates.atelier_scores = updates.atelierScores;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.detailedShots !== undefined) dbUpdates.detailed_shots = updates.detailedShots;
      if (updates.terrainId !== undefined) dbUpdates.terrain_id = updates.terrainId || null;
      dbUpdates.updated_at = new Date().toISOString();

      await supabase.from('challenges').update(dbUpdates).eq('id', id);
    } catch (error) {
      console.log('Error updating challenge:', error);
    }
  };

  const updateBracketMatch = (tournamentId: string, bracketMatchId: string, updates: Partial<BracketMatch>) => {
    setTournaments(prev => prev.map(tournament => {
      if (tournament.id !== tournamentId || !tournament.phases) return tournament;
      
      const updatedPhases = tournament.phases.map(phase => ({
        ...phase,
        matches: phase.matches.map(match => 
          match.id === bracketMatchId ? { ...match, ...updates } : match
        ),
      }));

      return { ...tournament, phases: updatedPhases };
    }));
  };

  // Delete functions with cloud sync
  const deleteMatch = async (id: string) => {
    const matchToDelete = matches.find(m => m.id === id);
    setMatches(prev => prev.filter(match => match.id !== id));

    if (matchToDelete && user?.id) {
      const updatedMatches = matches.filter(m => m.id !== id);
      const affectedPlayers = [...new Set([...matchToDelete.teamA.players, ...matchToDelete.teamB.players])];
      persistPlayerStats(updatedMatches, affectedPlayers);
    }

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'delete', table: 'matches', itemId: id });
      return;
    }

    try {
      await supabase.from('matches').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting match:', error);
    }
  };

  const deletePlayer = async (id: string) => {
    setPlayers(prev => prev.filter(player => player.id !== id));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'delete', table: 'players', itemId: id });
      return;
    }

    try {
      await supabase.from('players').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting player:', error);
    }
  };

  const deleteChallenge = async (id: string) => {
    setChallenges(prev => prev.filter(challenge => challenge.id !== id));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'delete', table: 'challenges', itemId: id });
      return;
    }

    try {
      await supabase.from('challenges').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting challenge:', error);
    }
  };

  const deleteClub = async (id: string) => {
    setClubs(prev => prev.filter(club => club.id !== id));
    setTerrains(prev => prev.map(t => 
      t.clubId === id ? { ...t, clubId: undefined, clubName: undefined } : t
    ));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'delete', table: 'clubs', itemId: id });
      return;
    }

    try {
      await supabase.from('clubs').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting club:', error);
    }
  };

  const deleteTournament = async (id: string) => {
    const tournamentToDelete = tournaments.find(t => t.id === id);
    setTournaments(prev => prev.filter(tournament => tournament.id !== id));
    setMatches(prev => prev.map(m =>
      m.tournamentId === id ? { ...m, tournamentId: undefined, tournamentName: undefined } : m
    ));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'delete', table: 'tournaments', itemId: id });
      return;
    }

    try {
      // Unlink matches from this tournament in DB
      await supabase.from('matches').update({
        tournament_id: null,
        tournament_name: null,
        updated_at: new Date().toISOString(),
      }).eq('tournament_id', id);
      // Delete the tournament
      await supabase.from('tournaments').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting tournament:', error);
    }
  };

  const deleteTerrain = async (id: string) => {
    setTerrains(prev => prev.filter(terrain => terrain.id !== id));
    setFavoriteTerrainIds(prev => prev.filter(fid => fid !== id));

    if (!user?.id) return;

    if (!isConnectedRef.current) {
      enqueueOperation({ type: 'delete', table: 'terrains', itemId: id });
      return;
    }

    try {
      await supabase.from('terrains').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting terrain:', error);
    }
  };

  // Boules Sets CRUD
  const addBoulesSet = async (set: Omit<BoulesSet, 'id'>) => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.from('boules_sets').insert({
        user_id: user.id,
        name: set.name,
        brand: set.brand || null,
        diameter: set.diameter || null,
        weight: set.weight || null,
        serial_number: set.serialNumber || null,
        hardness: set.hardness || null,
        is_primary: set.isPrimary || false,
        notes: set.notes || null,
        photo: set.photo || null,
        purchase_price: set.purchasePrice || null,
      }).select().single();
      if (error) throw error;
      if (data) {
        const newSet: BoulesSet = {
          id: data.id, name: data.name, brand: data.brand,
          diameter: data.diameter ? parseFloat(data.diameter) : undefined,
          weight: data.weight || undefined, serialNumber: data.serial_number,
          hardness: data.hardness, isPrimary: data.is_primary, notes: data.notes,
          purchasePrice: data.purchase_price ? parseFloat(data.purchase_price) : undefined,
        };
        // If this is primary, unset others
        if (newSet.isPrimary) {
          setBoulesSets(prev => [...prev.map(s => ({ ...s, isPrimary: false })), newSet]);
          // Sync primary boules to selfPlayer
          syncPrimaryBoulesToPlayer(newSet);
        } else {
          setBoulesSets(prev => [...prev, newSet]);
        }
      }
    } catch (error) {
      console.log('Error adding boules set:', error);
    }
  };

  const updateBoulesSet = async (id: string, updates: Partial<BoulesSet>) => {
    if (!user?.id) return;
    setBoulesSets(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.brand !== undefined) dbUpdates.brand = updates.brand || null;
      if (updates.diameter !== undefined) dbUpdates.diameter = updates.diameter || null;
      if (updates.weight !== undefined) dbUpdates.weight = updates.weight || null;
      if (updates.serialNumber !== undefined) dbUpdates.serial_number = updates.serialNumber || null;
      if (updates.hardness !== undefined) dbUpdates.hardness = updates.hardness || null;
      if (updates.isPrimary !== undefined) dbUpdates.is_primary = updates.isPrimary;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes || null;
      if (updates.photo !== undefined) dbUpdates.photo = updates.photo || null;
      if (updates.purchasePrice !== undefined) dbUpdates.purchase_price = updates.purchasePrice || null;
      dbUpdates.updated_at = new Date().toISOString();
      await supabase.from('boules_sets').update(dbUpdates).eq('id', id);
      // If updated set is primary, sync to player
      const updatedSet = boulesSets.find(s => s.id === id);
      if (updatedSet && (updatedSet.isPrimary || updates.isPrimary)) {
        syncPrimaryBoulesToPlayer({ ...updatedSet, ...updates });
      }
    } catch (error) {
      console.log('Error updating boules set:', error);
    }
  };

  const deleteBoulesSet = async (id: string) => {
    setBoulesSets(prev => prev.filter(s => s.id !== id));
    if (!user?.id) return;
    try {
      await supabase.from('boules_sets').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting boules set:', error);
    }
  };

  const setPrimaryBoulesSet = async (id: string) => {
    if (!user?.id) return;
    // Unset all, set the chosen one
    setBoulesSets(prev => prev.map(s => ({ ...s, isPrimary: s.id === id })));
    try {
      // Unset all primary
      await supabase.from('boules_sets').update({ is_primary: false, updated_at: new Date().toISOString() }).eq('user_id', user.id);
      // Set new primary
      await supabase.from('boules_sets').update({ is_primary: true, updated_at: new Date().toISOString() }).eq('id', id);
      // Sync to player profile
      const primarySet = boulesSets.find(s => s.id === id);
      if (primarySet) syncPrimaryBoulesToPlayer(primarySet);
    } catch (error) {
      console.log('Error setting primary boules set:', error);
    }
  };

  // Sync primary boules set data to selfPlayer.boules
  const syncPrimaryBoulesToPlayer = useCallback((set: Partial<BoulesSet>) => {
    if (!user?.id) return;
    const boulesData = {
      name: set.name || undefined,
      brand: set.brand || undefined,
      diameter: set.diameter || undefined,
      weight: set.weight || undefined,
      serialNumber: set.serialNumber || undefined,
      hardness: set.hardness || undefined,
    };
    updatePlayer(user.id, { boules: boulesData });
  }, [user?.id, updatePlayer]);

  // Favorites functions
  const toggleFavoriteTerrain = (terrainId: string) => {
    setFavoriteTerrainIds(prev => {
      const updated = prev.includes(terrainId)
        ? prev.filter(id => id !== terrainId)
        : [...prev, terrainId];
      // Persist to database
      savePreferences(updated, favoriteClubIds);
      return updated;
    });
  };

  const isFavoriteTerrain = (terrainId: string) => {
    return favoriteTerrainIds.includes(terrainId);
  };

  // Club favorites
  const toggleFavoriteClub = (clubId: string) => {
    setFavoriteClubIds(prev => {
      const updated = prev.includes(clubId)
        ? prev.filter(id => id !== clubId)
        : [...prev, clubId];
      // Persist to database
      savePreferences(favoriteTerrainIds, updated);
      return updated;
    });
  };

  const isFavoriteClub = (clubId: string) => {
    return favoriteClubIds.includes(clubId);
  };

  // Tournament notification functions
  const toggleTournamentNotification = (tournamentId: string) => {
    setTournamentNotifications(prev => {
      if (prev.includes(tournamentId)) {
        return prev.filter(id => id !== tournamentId);
      } else {
        return [...prev, tournamentId];
      }
    });
    // TODO: Persist to user preferences in database and schedule notifications
  };

  const isTournamentNotificationEnabled = (tournamentId: string) => {
    return tournamentNotifications.includes(tournamentId);
  };

  // Shared permission getter
  const getSharedPermission = useCallback((itemId: string): 'read' | 'write' | null => {
    return sharedItemPermissions[itemId] || null;
  }, [sharedItemPermissions]);

  // Toggle public/private in local state (DB is already updated by the caller)
  const setItemPublic = useCallback((type: 'players' | 'clubs' | 'terrains' | 'tournaments', itemId: string, isPublic: boolean) => {
    switch (type) {
      case 'players':
        setPlayers(prev => prev.map(p => p.id === itemId ? { ...p, isPublic } : p));
        break;
      case 'clubs':
        setClubs(prev => prev.map(c => c.id === itemId ? { ...c, isPublic } : c));
        break;
      case 'terrains':
        setTerrains(prev => prev.map(t => t.id === itemId ? { ...t, isPublic } : t));
        break;
      case 'tournaments':
        setTournaments(prev => prev.map(t => t.id === itemId ? { ...t, isPublic } : t));
        break;
    }
  }, []);

  // Getters
  const getPlayerById = (id: string) => playersWithStats.find(p => p.id === id);
  const getClubById = (id: string) => clubsWithMemberCount.find(c => c.id === id);
  const getTournamentById = (id: string) => tournaments.find(t => t.id === id);
  const getMatchById = (id: string) => matches.find(m => m.id === id);
  const getTerrainById = (id: string) => terrains.find(t => t.id === id);
  
  const getMatchesByPlayer = (playerId: string) => 
    matches.filter(m => 
      m.teamA.players.includes(playerId) || m.teamB.players.includes(playerId)
    );
  
  const getMatchesByTournament = (tournamentId: string) =>
    matches.filter(m => m.tournamentId === tournamentId);

  // Head-to-head comparison function
  const getHeadToHead = (player1Id: string, player2Id: string): HeadToHead => {
    const h2hMatches = matches.filter(m => {
      const player1InA = m.teamA.players.includes(player1Id);
      const player1InB = m.teamB.players.includes(player1Id);
      const player2InA = m.teamA.players.includes(player2Id);
      const player2InB = m.teamB.players.includes(player2Id);
      
      return (player1InA && player2InB) || (player1InB && player2InA);
    });

    const matchDetails = h2hMatches.map(m => {
      const player1InA = m.teamA.players.includes(player1Id);
      const player1Team: 'A' | 'B' = player1InA ? 'A' : 'B';
      const player1Won = m.winner === player1Team;
      
      return {
        id: m.id,
        date: m.date,
        player1Team,
        player1Won,
        scoreFor: player1InA ? m.teamA.score : m.teamB.score,
        scoreAgainst: player1InA ? m.teamB.score : m.teamA.score,
        format: m.format,
        mode: m.mode,
      };
    });

    const totalMatches = matchDetails.length;
    const player1Wins = matchDetails.filter(m => m.player1Won).length;
    const player2Wins = totalMatches - player1Wins;
    const player1AvgScore = totalMatches > 0 
      ? matchDetails.reduce((sum, m) => sum + m.scoreFor, 0) / totalMatches 
      : 0;
    const player2AvgScore = totalMatches > 0 
      ? matchDetails.reduce((sum, m) => sum + m.scoreAgainst, 0) / totalMatches 
      : 0;

    return {
      player1Id,
      player2Id,
      matches: matchDetails,
      stats: {
        totalMatches,
        player1Wins,
        player2Wins,
        player1WinRate: totalMatches > 0 ? (player1Wins / totalMatches) * 100 : 0,
        player1AvgScore: Math.round(player1AvgScore * 10) / 10,
        player2AvgScore: Math.round(player2AvgScore * 10) / 10,
        lastMatch: matchDetails.length > 0 
          ? matchDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date 
          : undefined,
      },
    };
  };

  // Get common opponents between two players
  const getCommonOpponents = (player1Id: string, player2Id: string): string[] => {
    const player1Opponents = new Set<string>();
    const player2Opponents = new Set<string>();

    matches.forEach(m => {
      if (m.teamA.players.includes(player1Id)) {
        m.teamB.players.forEach(p => player1Opponents.add(p));
      } else if (m.teamB.players.includes(player1Id)) {
        m.teamA.players.forEach(p => player1Opponents.add(p));
      }

      if (m.teamA.players.includes(player2Id)) {
        m.teamB.players.forEach(p => player2Opponents.add(p));
      } else if (m.teamB.players.includes(player2Id)) {
        m.teamA.players.forEach(p => player2Opponents.add(p));
      }
    });

    const common: string[] = [];
    player1Opponents.forEach(id => {
      if (player2Opponents.has(id) && id !== player1Id && id !== player2Id) {
        common.push(id);
      }
    });

    return common;
  };

  return (
    <AppContext.Provider
      value={{
        players: playersWithStats,
        clubs: clubsWithMemberCount,
        tournaments,
        matches,
        challenges,
        terrains,
        userStats,
        challengeStats,
        boulesSets,
        loading,
        addBoulesSet,
        updateBoulesSet,
        deleteBoulesSet,
        setPrimaryBoulesSet,
        addMatch,
        addPlayer,
        addClub,
        addTournament,
        addChallenge,
        addTerrain,
        updateMatch,
        updatePlayer,
        updateClub,
        updateTournament,
        updateTerrain,
        updateChallenge,
        updateBracketMatch,
        deleteMatch,
        deletePlayer,
        deleteChallenge,
        deleteTerrain,
        deleteClub,
        deleteTournament,
        favoriteTerrainIds,
        toggleFavoriteTerrain,
        isFavoriteTerrain,
        favoriteClubIds,
        toggleFavoriteClub,
        isFavoriteClub,
        tournamentNotifications,
        toggleTournamentNotification,
        isTournamentNotificationEnabled,
        getSharedPermission,
        getPlayerById,
        getClubById,
        getTournamentById,
        getMatchById,
        getTerrainById,
        getMatchesByPlayer,
        getMatchesByTournament,
        getHeadToHead,
        getCommonOpponents,
        retryFailedOps,
        refreshData,
        selfPlayer,
        isPremium,
        setIsPremium,
        isAdmin,
        batterySaverEnabled: syncConfig.batterySaverEnabled,
        setBatterySaver,
        setItemPublic,
        isReplayingQueue,
        replayProgress,
        currentConflict,
        conflictRemaining,
        resolveConflict,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
