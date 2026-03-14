import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getSupabaseClient } from '@/template';
import { useAuth } from '@/template';
import { logModification } from '@/services/modificationLogService';
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
  
  // Update Actions
  updateMatch: (id: string, updates: Partial<Match>) => Promise<void>;
  updatePlayer: (id: string, updates: Partial<Player>) => Promise<void>;
  updateClub: (id: string, updates: Partial<Club>) => Promise<void>;
  updateTournament: (id: string, updates: Partial<Tournament>) => Promise<void>;
  updateTerrain: (id: string, updates: Partial<Terrain>) => Promise<void>;
  updateBracketMatch: (tournamentId: string, bracketMatchId: string, updates: Partial<BracketMatch>) => void;
  
  // Delete Actions
  deleteMatch: (id: string) => Promise<void>;
  deletePlayer: (id: string) => Promise<void>;
  deleteChallenge: (id: string) => Promise<void>;
  deleteTerrain: (id: string) => Promise<void>;
  deleteClub: (id: string) => Promise<void>;
  
  // Favorites
  favoriteTerrainIds: string[];
  toggleFavoriteTerrain: (terrainId: string) => void;
  isFavoriteTerrain: (terrainId: string) => boolean;
  
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

  // Refresh
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [favoriteTerrainIds, setFavoriteTerrainIds] = useState<string[]>([]);
  const [sharedItemPermissions, setSharedItemPermissions] = useState<Record<string, 'read' | 'write'>>({});
  const [tournamentNotifications, setTournamentNotifications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Self player (current user's player card)
  const selfPlayer = React.useMemo(() => {
    if (!user?.id) return null;
    return players.find(p => p.id === user.id) || null;
  }, [players, user?.id]);

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

  // Load data from Supabase
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

    setLoading(true);
    try {
      // Fetch all user data + shared items in parallel
      const [playersRes, clubsRes, tournamentsRes, matchesRes, challengesRes, terrainsRes, profileRes, sharedWithMeRes] = await Promise.all([
        supabase.from('players').select('*').order('created_at', { ascending: false }),
        supabase.from('clubs').select('*').order('created_at', { ascending: false }),
        supabase.from('tournaments').select('*').order('date', { ascending: false }),
        supabase.from('matches').select('*').order('date', { ascending: false }),
        supabase.from('challenges').select('*').order('date', { ascending: false }),
        supabase.from('terrains').select('*').order('created_at', { ascending: false }),
        supabase.from('user_profiles').select('*').eq('id', user.id).single(),
        supabase.from('shared_items').select('item_type, item_id, permission').eq('shared_with_id', user.id),
      ]);

      // Group shared item IDs by type for batch fetching + build permissions map
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

      // Fetch shared records in parallel (RLS shared_select policies allow this)
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

      // Transform database records to app format
      let dbPlayers: Player[] = [];
      if (playersRes.data) {
        dbPlayers = playersRes.data.map(p => ({
          id: p.id,
          name: p.name,
          nickname: p.nickname,
          avatar: p.avatar,
          club: p.club,
          clubId: p.club_id,
          role: p.role,
          level: p.level,
          location: p.location,
          phone: p.phone,
          email: p.email,
          country: p.country,
          boules: p.boules,
          handedness: p.handedness,
          stats: p.stats || {
            matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
            tirRate: 0, pointRate: 0, carreauRate: 0,
            avgPointsScored: 0, avgPointsConceded: 0
          },
          createdAt: p.created_at,
        }));
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
          dbPlayers.push({
            id: newPlayerData.id,
            name: newPlayerData.name,
            avatar: newPlayerData.avatar,
            club: newPlayerData.club,
            clubId: newPlayerData.club_id,
            role: newPlayerData.role,
            level: newPlayerData.level,
            location: newPlayerData.location,
            stats: newPlayerData.stats,
            createdAt: newPlayerData.created_at,
          });
        }
      }

      // Helper to transform a raw player DB row
      const mapPlayer = (p: any): Player => ({
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        avatar: p.avatar,
        club: p.club,
        clubId: p.club_id,
        role: p.role,
        level: p.level,
        location: p.location,
        phone: p.phone,
        email: p.email,
        country: p.country,
        boules: p.boules,
        handedness: p.handedness,
        isPublic: p.is_public ?? false,
        stats: p.stats || {
          matchesPlayed: 0, wins: 0, losses: 0, winRate: 0,
          tirRate: 0, pointRate: 0, carreauRate: 0,
          avgPointsScored: 0, avgPointsConceded: 0
        },
        createdAt: p.created_at,
      });

      // Merge shared players (always fetch latest from owner)
      const ownPlayerIds = new Set(dbPlayers.map(p => p.id));
      if (sharedPlayersRes.data) {
        sharedPlayersRes.data.forEach((p: any) => {
          if (!ownPlayerIds.has(p.id)) {
            dbPlayers.push(mapPlayer(p));
          }
        });
      }
      setPlayers(dbPlayers.length > 0 ? dbPlayers : mockPlayers);

      // Helper to transform a raw club DB row
      const mapClub = (c: any): Club => ({
        id: c.id,
        name: c.name,
        logo: c.logo,
        address: c.address,
        city: c.city,
        country: c.country || 'France',
        location: c.location || { latitude: 0, longitude: 0 },
        membersCount: c.members_count || 0,
        foundedYear: c.founded_year,
        description: c.description,
        facilities: c.facilities || [],
        contactEmail: c.contact_email,
        contactPhone: c.contact_phone,
        terrainId: c.terrain_id,
        terrainName: c.terrain_name,
        membershipCost: c.membership_cost ? parseFloat(c.membership_cost) : undefined,
        isPublic: c.is_public ?? false,
      });

      if (clubsRes.data) {
        const dbClubs: Club[] = clubsRes.data.map(mapClub);
        // Merge shared clubs
        const ownClubIds = new Set(dbClubs.map(c => c.id));
        if (sharedClubsRes.data) {
          sharedClubsRes.data.forEach((c: any) => {
            if (!ownClubIds.has(c.id)) dbClubs.push(mapClub(c));
          });
        }
        setClubs(dbClubs.length > 0 ? dbClubs : mockClubs);
      }

      // Helper to transform a raw terrain DB row
      const mapTerrain = (t: any): Terrain => ({
        id: t.id,
        name: t.name,
        address: t.address,
        city: t.city,
        location: t.location || { latitude: 0, longitude: 0 },
        type: t.type,
        description: t.description,
        facilities: t.facilities || [],
        photos: t.photos || [],
        clubId: t.club_id,
        clubName: t.club_name,
        isPublic: t.is_public ?? true,
        publicAccess: t.public_access ?? true,
        courtsCount: t.courts_count || 1,
        lighting: t.lighting ?? false,
        covered: t.covered ?? false,
        createdAt: t.created_at,
      });

      if (terrainsRes.data) {
        const dbTerrains: Terrain[] = terrainsRes.data.map(mapTerrain);
        // Merge shared terrains
        const ownTerrainIds = new Set(dbTerrains.map(t => t.id));
        if (sharedTerrainsRes.data) {
          sharedTerrainsRes.data.forEach((t: any) => {
            if (!ownTerrainIds.has(t.id)) dbTerrains.push(mapTerrain(t));
          });
        }
        setTerrains(dbTerrains.length > 0 ? dbTerrains : mockTerrains);
      }

      // Helper to transform a raw tournament DB row
      const mapTournament = (t: any): Tournament => ({
        id: t.id,
        name: t.name,
        date: t.date,
        endDate: t.end_date,
        type: t.type,
        format: t.format,
        location: t.location,
        terrainId: t.terrain_id,
        terrainName: t.terrain_name,
        terrainType: t.terrain_type,
        clubId: t.club_id,
        clubName: t.club_name,
        status: t.status,
        participants: t.participants || 0,
        maxParticipants: t.max_participants || 32,
        prize: t.prize,
        description: t.description,
        teams: t.teams,
        phases: t.phases,
        currentPhaseId: t.current_phase_id,
        tournamentLevel: t.tournament_level,
        tournamentCategory: t.tournament_category,
        registrationType: t.registration_type,
        tournamentScope: t.tournament_scope,
        registrationCost: t.registration_cost ? parseFloat(t.registration_cost) : undefined,
        prizeWon: t.prize_won ? parseFloat(t.prize_won) : undefined,
        finalResult: t.final_result,
        isPublic: t.is_public ?? false,
      });

      if (tournamentsRes.data) {
        const dbTournaments: Tournament[] = tournamentsRes.data.map(mapTournament);
        // Merge shared tournaments
        const ownTournamentIds = new Set(dbTournaments.map(t => t.id));
        if (sharedTournamentsRes.data) {
          sharedTournamentsRes.data.forEach((t: any) => {
            if (!ownTournamentIds.has(t.id)) dbTournaments.push(mapTournament(t));
          });
        }
        setTournaments(dbTournaments.length > 0 ? dbTournaments : mockTournaments);
      }

      if (matchesRes.data) {
        const dbMatches: Match[] = matchesRes.data.map(m => ({
          id: m.id,
          date: m.date,
          mode: m.mode,
          format: m.format,
          tournamentId: m.tournament_id,
          tournamentName: m.tournament_name,
          tournamentPhase: m.tournament_phase,
          tournamentBracket: m.tournament_bracket,
          bracketMatchId: m.bracket_match_id,
          terrainId: m.terrain_id,
          terrainType: m.terrain_type,
          teamA: m.team_a,
          teamB: m.team_b,
          winner: m.winner,
          duration: m.duration || 0,
          menes: m.menes || [],
          playerActions: m.player_actions,
          seriesInfo: m.series_info,
        }));
        setMatches(dbMatches.length > 0 ? dbMatches : mockMatches);
      }

      if (challengesRes.data) {
        const dbChallenges: Challenge[] = challengesRes.data.map(c => ({
          id: c.id,
          type: c.type,
          mode: c.mode || 'solo',
          date: c.date,
          playerId: c.player_id,
          playerName: c.player_name,
          opponentId: c.opponent_id,
          opponentName: c.opponent_name,
          opponentResult: c.opponent_result,
          winner: c.winner,

          shots: c.shots,
          successCount: c.success_count,
          totalShots: c.total_shots,
          carreauCount: c.carreau_count,
          successRate: c.success_rate ? parseFloat(c.success_rate) : undefined,
          precisionShots: c.precision_shots,
          totalPoints: c.total_points,
          maxPoints: c.max_points,
          atelierScores: c.atelier_scores,
          duration: c.duration,
          notes: c.notes,
          detailedShots: c.detailed_shots,
        }));
        setChallenges(dbChallenges.length > 0 ? dbChallenges : mockChallenges);
      }

    } catch (error) {
      console.log('Error loading data from cloud:', error);
      // Fallback to mock data on error
      setPlayers(mockPlayers);
      setClubs(mockClubs);
      setTournaments(mockTournaments);
      setMatches(mockMatches);
      setChallenges(mockChallenges);
      setTerrains(mockTerrains);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  // Load data when user changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh every 30 seconds when user is logged in
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.id, loadData]);

  // Refresh data function
  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Add functions with cloud sync
  const addMatch = async (match: Omit<Match, 'id'>): Promise<string | null> => {
    if (!user?.id) {
      // Offline mode - just add locally with temp ID
      const tempId = Date.now().toString();
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
          teamA: data.team_a,
          teamB: data.team_b,
          winner: data.winner,
          duration: data.duration || 0,
          menes: data.menes || [],
          playerActions: data.player_actions,
          seriesInfo: data.series_info,
        };
        setMatches(prev => [newMatch, ...prev]);
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
        stats: player.stats,
      }).select().single();

      if (error) throw error;

      if (data) {
        const newPlayer: Player = {
          id: data.id,
          name: data.name,
          nickname: data.nickname,
          avatar: data.avatar,
          club: data.club,
          clubId: data.club_id,
          role: data.role,
          level: data.level,
          location: data.location,
          phone: data.phone,
          email: data.email,
          country: data.country || 'France',
          boules: data.boules,
          stats: data.stats,
          createdAt: data.created_at,
        };
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
    // Update local state immediately
    setMatches(prev => prev.map(match => 
      match.id === id ? { ...match, ...updates } : match
    ));

    if (!user?.id) return;

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

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.nickname !== undefined) dbUpdates.nickname = updates.nickname;
      if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
      if (updates.club !== undefined) dbUpdates.club = updates.club;
      if (updates.clubId !== undefined) dbUpdates.club_id = updates.clubId;
      if (updates.role !== undefined) dbUpdates.role = updates.role;
      if (updates.level !== undefined) dbUpdates.level = updates.level;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.country !== undefined) dbUpdates.country = updates.country;
      if (updates.boules !== undefined) dbUpdates.boules = updates.boules;
      if (updates.handedness !== undefined) dbUpdates.handedness = updates.handedness;
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
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.facilities !== undefined) dbUpdates.facilities = updates.facilities;
      if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail;
      if (updates.contactPhone !== undefined) dbUpdates.contact_phone = updates.contactPhone;
      if (updates.terrainId !== undefined) dbUpdates.terrain_id = updates.terrainId;
      if (updates.terrainName !== undefined) dbUpdates.terrain_name = updates.terrainName;
      if (updates.membershipCost !== undefined) dbUpdates.membership_cost = updates.membershipCost;
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
    setMatches(prev => prev.filter(match => match.id !== id));

    if (!user?.id) return;

    try {
      await supabase.from('matches').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting match:', error);
    }
  };

  const deletePlayer = async (id: string) => {
    setPlayers(prev => prev.filter(player => player.id !== id));

    if (!user?.id) return;

    try {
      await supabase.from('players').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting player:', error);
    }
  };

  const deleteChallenge = async (id: string) => {
    setChallenges(prev => prev.filter(challenge => challenge.id !== id));

    if (!user?.id) return;

    try {
      await supabase.from('challenges').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting challenge:', error);
    }
  };

  const deleteClub = async (id: string) => {
    setClubs(prev => prev.filter(club => club.id !== id));
    // Also update terrains that reference this club
    setTerrains(prev => prev.map(t => 
      t.clubId === id ? { ...t, clubId: undefined, clubName: undefined } : t
    ));

    if (!user?.id) return;

    try {
      await supabase.from('clubs').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting club:', error);
    }
  };

  const deleteTerrain = async (id: string) => {
    setTerrains(prev => prev.filter(terrain => terrain.id !== id));
    // Also remove from favorites
    setFavoriteTerrainIds(prev => prev.filter(fid => fid !== id));

    if (!user?.id) return;

    try {
      await supabase.from('terrains').delete().eq('id', id);
    } catch (error) {
      console.log('Error deleting terrain:', error);
    }
  };

  // Favorites functions
  const toggleFavoriteTerrain = (terrainId: string) => {
    setFavoriteTerrainIds(prev => {
      if (prev.includes(terrainId)) {
        return prev.filter(id => id !== terrainId);
      } else {
        return [...prev, terrainId];
      }
    });
    // TODO: Persist to user preferences in database
  };

  const isFavoriteTerrain = (terrainId: string) => {
    return favoriteTerrainIds.includes(terrainId);
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
  const getPlayerById = (id: string) => players.find(p => p.id === id);
  const getClubById = (id: string) => clubs.find(c => c.id === id);
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
        players,
        clubs,
        tournaments,
        matches,
        challenges,
        terrains,
        userStats,
        challengeStats,
        loading,
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
        updateBracketMatch,
        deleteMatch,
        deletePlayer,
        deleteChallenge,
        deleteTerrain,
        deleteClub,
        favoriteTerrainIds,
        toggleFavoriteTerrain,
        isFavoriteTerrain,
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
        refreshData,
        selfPlayer,
        setItemPublic,
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
