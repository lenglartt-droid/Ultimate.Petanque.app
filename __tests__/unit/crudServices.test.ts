/**
 * Unit Tests for 7 Extracted CRUD Services
 *
 * Tests cover three axes per service:
 *   1. Online DB calls — correct table, payload mapping (camelCase → snake_case), and state update
 *   2. Offline queueing — enqueueOperation called with correct type/table/payload when disconnected
 *   3. No-user fallback — local-only state updates when userId is undefined
 *
 * Mocks: supabase client, offlineQueueService (enqueueOperation + build* helpers),
 *        modificationLogService (logModification), dbMappers (map*FromDb).
 */

// ─── Mock setup ───────────────────────────────────────────────

const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockOrder = jest.fn();

/** Chainable supabase query builder mock */
function chainable(terminal?: Record<string, any>) {
  const chain: any = {
    select: mockSelect.mockReturnThis(),
    single: mockSingle.mockResolvedValue(terminal ?? { data: null, error: null }),
    insert: mockInsert.mockReturnThis(),
    update: mockUpdate.mockReturnThis(),
    delete: mockDelete.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    in: mockIn.mockReturnThis(),
    order: mockOrder.mockReturnThis(),
  };
  // Make .select().single() and .eq().single() resolve terminal
  mockSelect.mockReturnValue(chain);
  mockSingle.mockResolvedValue(terminal ?? { data: null, error: null });
  mockEq.mockReturnValue(chain);
  mockIn.mockReturnValue(chain);
  mockInsert.mockReturnValue(chain);
  mockUpdate.mockReturnValue(chain);
  mockDelete.mockReturnValue(chain);
  return chain;
}

const mockFrom = jest.fn(() => chainable());

const supabase = { from: mockFrom };

// ─── Module mocks ─────────────────────────────────────────────

jest.mock('@/services/offlineQueueService', () => ({
  enqueueOperation: jest.fn(),
  buildMatchDbPayload: jest.fn((m: any) => ({ ...m, _built: 'match' })),
  buildPlayerDbPayload: jest.fn((p: any) => ({ ...p, _built: 'player' })),
  buildClubDbPayload: jest.fn((c: any) => ({ ...c, _built: 'club' })),
  buildTournamentDbPayload: jest.fn((t: any) => ({ ...t, _built: 'tournament' })),
  buildTerrainDbPayload: jest.fn((t: any) => ({ ...t, _built: 'terrain' })),
  buildChallengeDbPayload: jest.fn((c: any) => ({ ...c, _built: 'challenge' })),
  buildUpdateDbPayload: jest.fn((_table: string, u: any) => ({ ...u, _built: 'update' })),
}));

jest.mock('@/services/modificationLogService', () => ({
  logModification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/dbMappers', () => ({
  mapMatchFromDb: jest.fn((row: any) => ({ id: row.id, date: row.date, mode: row.mode, format: row.format, teamA: row.team_a, teamB: row.team_b, winner: row.winner, duration: row.duration || 0, menes: row.menes || [], playerActions: row.player_actions })),
  mapPlayerFromDb: jest.fn((row: any) => ({ id: row.id, name: row.name, role: row.role, level: row.level, stats: row.stats || {}, isPublic: row.is_public ?? false })),
  mapClubFromDb: jest.fn((row: any) => ({ id: row.id, name: row.name, city: row.city, isPublic: row.is_public ?? false })),
  mapTournamentFromDb: jest.fn((row: any) => ({ id: row.id, name: row.name, date: row.date, type: row.type, format: row.format, status: row.status })),
  mapTerrainFromDb: jest.fn((row: any) => ({ id: row.id, name: row.name, city: row.city, type: row.type, isPublic: row.is_public ?? true })),
  mapChallengeFromDb: jest.fn((row: any) => ({ id: row.id, type: row.type, date: row.date, successCount: row.success_count, totalShots: row.total_shots })),
  mapBoulesSetFromDb: jest.fn((row: any) => ({ id: row.id, name: row.name, brand: row.brand, isPrimary: row.is_primary })),
}));

jest.mock('@/template', () => ({
  getSupabaseClient: jest.fn(() => supabase),
  useAuth: jest.fn(() => ({ user: { id: 'user-1', email: 'test@example.com' } })),
}));

// ─── Imports (after mocks) ────────────────────────────────────

import { enqueueOperation } from '@/services/offlineQueueService';
import { logModification } from '@/services/modificationLogService';

import { addMatchOp, updateMatchOp, deleteMatchOp } from '@/services/matchCrudService';
import { addPlayerOp, updatePlayerOp, deletePlayerOp } from '@/services/playerCrudService';
import { addClubOp, updateClubOp, deleteClubOp } from '@/services/clubCrudService';
import { addTournamentOp, updateTournamentOp, updateBracketMatchOp, deleteTournamentOp } from '@/services/tournamentCrudService';
import { addTerrainOp, updateTerrainOp, deleteTerrainOp } from '@/services/terrainCrudService';
import { addChallengeOp, updateChallengeOp, deleteChallengeOp } from '@/services/challengeCrudService';
import { addBoulesSetOp, updateBoulesSetOp, deleteBoulesSetOp, setPrimaryBoulesSetOp } from '@/services/boulesSetCrudService';

// ─── Helpers ──────────────────────────────────────────────────

function resetMocks() {
  jest.clearAllMocks();
  mockFrom.mockReturnValue(chainable());
}

function makeSetState<T>(): [jest.Mock, () => T[]] {
  let state: T[] = [];
  const setter = jest.fn((updater: any) => {
    state = typeof updater === 'function' ? updater(state) : updater;
  });
  return [setter, () => state];
}

// ─── Match CRUD ───────────────────────────────────────────────

describe('matchCrudService', () => {
  const matchInput: any = {
    date: '2026-03-20', mode: 'Entraînement', format: 'Doublette',
    teamA: { players: ['p1'], score: 13 }, teamB: { players: ['p2'], score: 8 },
    winner: 'A', duration: 45, menes: [], playerActions: [],
  };

  const dbRow = {
    id: 'match-1', date: '2026-03-20', mode: 'Entraînement', format: 'Doublette',
    team_a: matchInput.teamA, team_b: matchInput.teamB, winner: 'A',
    duration: 45, menes: [], player_actions: [],
  };

  describe('addMatchOp', () => {
    it('inserts into "matches" table and updates state on success', async () => {
      resetMocks();
      const [setMatches, getState] = makeSetState<any>();
      const persistPlayerStats = jest.fn();

      // Chain: from('matches').insert(...).select().single()
      mockFrom.mockReturnValue(chainable());
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      const result = await addMatchOp(matchInput, {
        supabase, userId: 'user-1', isConnected: true,
        matches: [], setMatches, persistPlayerStats,
      });

      expect(mockFrom).toHaveBeenCalledWith('matches');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1',
        mode: 'Entraînement',
        format: 'Doublette',
        team_a: matchInput.teamA,
        team_b: matchInput.teamB,
        winner: 'A',
      }));
      expect(setMatches).toHaveBeenCalled();
      expect(persistPlayerStats).toHaveBeenCalled();
      expect(result).toBe('match-1');
    });

    it('queues operation when offline', async () => {
      resetMocks();
      const [setMatches] = makeSetState<any>();
      const persistPlayerStats = jest.fn();

      const result = await addMatchOp(matchInput, {
        supabase, userId: 'user-1', isConnected: false,
        matches: [], setMatches, persistPlayerStats,
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'insert', table: 'matches',
      }));
      expect(setMatches).toHaveBeenCalled();
      expect(result).toMatch(/^temp_/);
    });

    it('uses local-only fallback when no userId', async () => {
      resetMocks();
      const [setMatches] = makeSetState<any>();
      const persistPlayerStats = jest.fn();

      const result = await addMatchOp(matchInput, {
        supabase, userId: undefined, isConnected: true,
        matches: [], setMatches, persistPlayerStats,
      });

      expect(mockFrom).not.toHaveBeenCalled();
      expect(setMatches).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });
  });

  describe('updateMatchOp', () => {
    it('calls supabase update with snake_case fields', async () => {
      resetMocks();
      const existing = { ...matchInput, id: 'match-1' };
      const [setMatches] = makeSetState<any>();
      const persistPlayerStats = jest.fn();

      await updateMatchOp('match-1', { winner: 'B', duration: 60 }, {
        supabase, userId: 'user-1', isConnected: true,
        matches: [existing], setMatches, persistPlayerStats,
      });

      expect(mockFrom).toHaveBeenCalledWith('matches');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        winner: 'B', duration: 60, updated_at: expect.any(String),
      }));
      expect(mockEq).toHaveBeenCalledWith('id', 'match-1');
    });

    it('enqueues update when offline', async () => {
      resetMocks();
      const [setMatches] = makeSetState<any>();
      const persistPlayerStats = jest.fn();

      await updateMatchOp('match-1', { winner: 'B' }, {
        supabase, userId: 'user-1', isConnected: false,
        matches: [], setMatches, persistPlayerStats,
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'update', table: 'matches', itemId: 'match-1',
      }));
    });
  });

  describe('deleteMatchOp', () => {
    it('calls supabase delete and persists stats', async () => {
      resetMocks();
      const existing = { ...matchInput, id: 'match-1' };
      const [setMatches] = makeSetState<any>();
      const persistPlayerStats = jest.fn();

      await deleteMatchOp('match-1', {
        supabase, userId: 'user-1', isConnected: true,
        matches: [existing], setMatches, persistPlayerStats,
      });

      expect(mockFrom).toHaveBeenCalledWith('matches');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'match-1');
      expect(persistPlayerStats).toHaveBeenCalled();
    });

    it('enqueues delete when offline', async () => {
      resetMocks();
      const [setMatches] = makeSetState<any>();
      const persistPlayerStats = jest.fn();

      await deleteMatchOp('match-1', {
        supabase, userId: 'user-1', isConnected: false,
        matches: [], setMatches, persistPlayerStats,
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'delete', table: 'matches', itemId: 'match-1',
      }));
    });
  });
});

// ─── Player CRUD ──────────────────────────────────────────────

describe('playerCrudService', () => {
  const playerInput: any = {
    name: 'Jean', role: 'Tireur', level: 'Expert',
    stats: { matchesPlayed: 0, wins: 0, losses: 0 },
  };
  const dbRow = { id: 'player-1', name: 'Jean', role: 'Tireur', level: 'Expert', is_public: false, stats: playerInput.stats };

  describe('addPlayerOp', () => {
    it('inserts into "players" with correct field mapping', async () => {
      resetMocks();
      const [setPlayers] = makeSetState<any>();
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      await addPlayerOp(playerInput, {
        supabase, userId: 'user-1', isConnected: true,
        setPlayers, sharedItemPermissions: {}, players: [],
      });

      expect(mockFrom).toHaveBeenCalledWith('players');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', name: 'Jean', role: 'Tireur', level: 'Expert',
      }));
    });

    it('queues when offline', async () => {
      resetMocks();
      const [setPlayers] = makeSetState<any>();

      await addPlayerOp(playerInput, {
        supabase, userId: 'user-1', isConnected: false,
        setPlayers, sharedItemPermissions: {}, players: [],
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'insert', table: 'players',
      }));
    });
  });

  describe('updatePlayerOp', () => {
    it('maps camelCase to snake_case for DB update', async () => {
      resetMocks();
      const existing = { ...playerInput, id: 'player-1' };
      const [setPlayers] = makeSetState<any>();

      await updatePlayerOp('player-1', { name: 'Pierre', clubId: 'club-1', isPublic: true }, {
        supabase, userId: 'user-1', isConnected: true,
        setPlayers, sharedItemPermissions: {}, players: [existing],
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Pierre', club_id: 'club-1', is_public: true, updated_at: expect.any(String),
      }));
    });

    it('logs modification for shared items with write permission', async () => {
      resetMocks();
      const existing = { ...playerInput, id: 'player-1', name: 'Jean' };
      const [setPlayers] = makeSetState<any>();
      mockSingle.mockResolvedValue({ data: { user_id: 'owner-1' }, error: null });

      await updatePlayerOp('player-1', { name: 'Pierre' }, {
        supabase, userId: 'user-1', isConnected: true,
        setPlayers, sharedItemPermissions: { 'player-1': 'write' }, players: [existing],
      });

      expect(logModification).toHaveBeenCalledWith(expect.objectContaining({
        itemType: 'player', itemId: 'player-1', ownerId: 'owner-1',
      }));
    });
  });

  describe('deletePlayerOp', () => {
    it('removes from state and calls DB delete', async () => {
      resetMocks();
      const [setPlayers] = makeSetState<any>();

      await deletePlayerOp('player-1', {
        supabase, userId: 'user-1', isConnected: true, setPlayers,
      });

      expect(mockFrom).toHaveBeenCalledWith('players');
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});

// ─── Club CRUD ────────────────────────────────────────────────

describe('clubCrudService', () => {
  const clubInput: any = {
    name: 'BC Marseille', city: 'Marseille', country: 'France',
    location: { latitude: 43.3, longitude: 5.4 }, membersCount: 25,
  };
  const dbRow = {
    id: 'club-1', name: 'BC Marseille', city: 'Marseille', country: 'France',
    location: clubInput.location, members_count: 25, is_public: false,
    show_contact_public: false,
  };

  describe('addClubOp', () => {
    it('inserts with correct snake_case mapping', async () => {
      resetMocks();
      const [setClubs] = makeSetState<any>();
      const [setTerrains] = makeSetState<any>();
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      await addClubOp(clubInput, {
        supabase, userId: 'user-1', isConnected: true,
        clubs: [], setClubs, setTerrains, sharedItemPermissions: {},
      });

      expect(mockFrom).toHaveBeenCalledWith('clubs');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', name: 'BC Marseille', city: 'Marseille',
        members_count: 25, country: 'France',
      }));
    });

    it('queues when offline', async () => {
      resetMocks();
      const [setClubs] = makeSetState<any>();
      const [setTerrains] = makeSetState<any>();

      await addClubOp(clubInput, {
        supabase, userId: 'user-1', isConnected: false,
        clubs: [], setClubs, setTerrains, sharedItemPermissions: {},
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'insert', table: 'clubs',
      }));
    });
  });

  describe('updateClubOp', () => {
    it('maps membershipCost to membership_cost', async () => {
      resetMocks();
      const existing = { ...clubInput, id: 'club-1' };
      const [setClubs] = makeSetState<any>();
      const [setTerrains] = makeSetState<any>();

      await updateClubOp('club-1', { membershipCost: 120, name: 'BC Toulon' }, {
        supabase, userId: 'user-1', isConnected: true,
        clubs: [existing], setClubs, setTerrains, sharedItemPermissions: {},
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        membership_cost: 120, name: 'BC Toulon', updated_at: expect.any(String),
      }));
    });
  });

  describe('deleteClubOp', () => {
    it('unlinks terrains from deleted club', async () => {
      resetMocks();
      const [setClubs] = makeSetState<any>();
      const [setTerrains, getTerrains] = makeSetState<any>();
      // Pre-fill terrains with one linked to club-1
      setTerrains([{ id: 't1', clubId: 'club-1', clubName: 'Old' }] as any);

      await deleteClubOp('club-1', {
        supabase, userId: 'user-1', isConnected: true,
        setClubs, setTerrains,
      });

      // setTerrains should have been called to unlink
      expect(setTerrains).toHaveBeenCalledTimes(2); // initial + unlink
      const terrains = getTerrains();
      expect(terrains[0].clubId).toBeUndefined();
    });
  });
});

// ─── Tournament CRUD ──────────────────────────────────────────

describe('tournamentCrudService', () => {
  const tournamentInput: any = {
    name: 'Grand Prix', date: '2026-04-10', type: 'Mixte', format: 'Doublette',
    location: { latitude: 43.3, longitude: 5.4 }, status: 'À venir',
  };

  describe('addTournamentOp', () => {
    it('inserts with correct field mapping', async () => {
      resetMocks();
      const [setTournaments] = makeSetState<any>();
      const [setMatches] = makeSetState<any>();
      const dbRow = {
        id: 'tourn-1', name: 'Grand Prix', date: '2026-04-10',
        type: 'Mixte', format: 'Doublette', status: 'À venir',
        location: tournamentInput.location,
      };
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      await addTournamentOp(tournamentInput, {
        supabase, userId: 'user-1', isConnected: true,
        tournaments: [], setTournaments, setMatches, sharedItemPermissions: {},
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', name: 'Grand Prix',
      }));
    });

    it('queues when offline', async () => {
      resetMocks();
      const [setTournaments] = makeSetState<any>();
      const [setMatches] = makeSetState<any>();

      await addTournamentOp(tournamentInput, {
        supabase, userId: 'user-1', isConnected: false,
        tournaments: [], setTournaments, setMatches, sharedItemPermissions: {},
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'insert', table: 'tournaments',
      }));
    });
  });

  describe('updateBracketMatchOp', () => {
    it('updates nested bracket match in phases without DB call', () => {
      resetMocks();
      const [setTournaments, getState] = makeSetState<any>();
      const tourney = {
        id: 'tourn-1', phases: [{
          id: 'phase-1', matches: [
            { id: 'bm-1', teamA: null, teamB: null, scoreA: 0, scoreB: 0 },
            { id: 'bm-2', teamA: null, teamB: null, scoreA: 0, scoreB: 0 },
          ],
        }],
      };
      setTournaments([tourney] as any);

      updateBracketMatchOp('tourn-1', 'bm-1', { scoreA: 13, scoreB: 7 }, setTournaments);

      const result = getState();
      expect(result[0].phases[0].matches[0].scoreA).toBe(13);
      expect(result[0].phases[0].matches[1].scoreA).toBe(0); // untouched
      expect(mockFrom).not.toHaveBeenCalled(); // pure local op
    });
  });

  describe('deleteTournamentOp', () => {
    it('unlinks matches from deleted tournament', async () => {
      resetMocks();
      const [setTournaments] = makeSetState<any>();
      const [setMatches, getMatches] = makeSetState<any>();
      setMatches([{ id: 'm1', tournamentId: 'tourn-1', tournamentName: 'GP' }] as any);

      await deleteTournamentOp('tourn-1', {
        supabase, userId: 'user-1', isConnected: true,
        setTournaments, setMatches,
      });

      const matches = getMatches();
      expect(matches[0].tournamentId).toBeUndefined();
      expect(matches[0].tournamentName).toBeUndefined();
    });
  });
});

// ─── Terrain CRUD ─────────────────────────────────────────────

describe('terrainCrudService', () => {
  const terrainInput: any = {
    name: 'Boulodrome Central', address: '1 rue Boule', city: 'Lyon',
    location: { latitude: 45.7, longitude: 4.8 }, type: 'Sable',
    isPublic: true, publicAccess: true, courtsCount: 4,
    lighting: true, covered: false, environment: 'outdoor',
  };
  const dbRow = {
    id: 'terrain-1', name: 'Boulodrome Central', address: '1 rue Boule',
    city: 'Lyon', location: terrainInput.location, type: 'Sable',
    is_public: true, public_access: true, courts_count: 4,
    lighting: true, covered: false, environment: 'outdoor',
  };

  describe('addTerrainOp', () => {
    it('inserts with correct snake_case mapping', async () => {
      resetMocks();
      const [setTerrains] = makeSetState<any>();
      const [setFavIds] = makeSetState<any>();
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      await addTerrainOp(terrainInput, {
        supabase, userId: 'user-1', isConnected: true,
        terrains: [], setTerrains, setFavoriteTerrainIds: setFavIds, sharedItemPermissions: {},
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', name: 'Boulodrome Central',
        courts_count: 4, public_access: true,
      }));
    });

    it('queues when offline', async () => {
      resetMocks();
      const [setTerrains] = makeSetState<any>();
      const [setFavIds] = makeSetState<any>();

      await addTerrainOp(terrainInput, {
        supabase, userId: 'user-1', isConnected: false,
        terrains: [], setTerrains, setFavoriteTerrainIds: setFavIds, sharedItemPermissions: {},
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'insert', table: 'terrains',
      }));
    });
  });

  describe('updateTerrainOp', () => {
    it('maps courtsCount → courts_count and lighting → lighting', async () => {
      resetMocks();
      const existing = { ...terrainInput, id: 'terrain-1' };
      const [setTerrains] = makeSetState<any>();
      const [setFavIds] = makeSetState<any>();

      await updateTerrainOp('terrain-1', { courtsCount: 6, lighting: false }, {
        supabase, userId: 'user-1', isConnected: true,
        terrains: [existing], setTerrains, setFavoriteTerrainIds: setFavIds, sharedItemPermissions: {},
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        courts_count: 6, lighting: false, updated_at: expect.any(String),
      }));
    });

    it('logs modification when shared with write permission', async () => {
      resetMocks();
      const existing = { ...terrainInput, id: 'terrain-1', name: 'Old Name' };
      const [setTerrains] = makeSetState<any>();
      const [setFavIds] = makeSetState<any>();
      mockSingle.mockResolvedValue({ data: { user_id: 'owner-1' }, error: null });

      await updateTerrainOp('terrain-1', { name: 'New Name' }, {
        supabase, userId: 'user-1', isConnected: true,
        terrains: [existing], setTerrains, setFavoriteTerrainIds: setFavIds,
        sharedItemPermissions: { 'terrain-1': 'write' },
      });

      expect(logModification).toHaveBeenCalledWith(expect.objectContaining({
        itemType: 'terrain', itemId: 'terrain-1', ownerId: 'owner-1',
      }));
    });
  });

  describe('deleteTerrainOp', () => {
    it('removes terrain from favorites on delete', async () => {
      resetMocks();
      const [setTerrains] = makeSetState<any>();
      const [setFavIds, getFavIds] = makeSetState<any>();
      setFavIds(['terrain-1', 'terrain-2'] as any);

      await deleteTerrainOp('terrain-1', {
        supabase, userId: 'user-1', isConnected: true,
        setTerrains, setFavoriteTerrainIds: setFavIds,
      });

      const favs = getFavIds();
      expect(favs).not.toContain('terrain-1');
      expect(favs).toContain('terrain-2');
    });
  });
});

// ─── Challenge CRUD ───────────────────────────────────────────

describe('challengeCrudService', () => {
  const challengeInput: any = {
    type: '10_tirs', mode: 'solo', date: '2026-03-20',
    successCount: 7, totalShots: 10, successRate: 70,
    notes: 'Bon entraînement',
  };

  describe('addChallengeOp', () => {
    it('inserts with correct snake_case mapping', async () => {
      resetMocks();
      const [setChallenges] = makeSetState<any>();
      const dbRow = {
        id: 'ch-1', type: '10_tirs', mode: 'solo', date: '2026-03-20',
        success_count: 7, total_shots: 10, success_rate: '70',
      };
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      const result = await addChallengeOp(challengeInput, {
        supabase, userId: 'user-1', isConnected: true, setChallenges,
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', type: '10_tirs', mode: 'solo',
        success_count: 7, total_shots: 10, success_rate: 70,
      }));
      expect(result).toBe('ch-1');
    });

    it('queues when offline', async () => {
      resetMocks();
      const [setChallenges] = makeSetState<any>();

      const result = await addChallengeOp(challengeInput, {
        supabase, userId: 'user-1', isConnected: false, setChallenges,
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'insert', table: 'challenges',
      }));
      expect(result).toMatch(/^temp_/);
    });
  });

  describe('updateChallengeOp', () => {
    it('maps successCount → success_count, notes → notes', async () => {
      resetMocks();
      const [setChallenges] = makeSetState<any>();

      await updateChallengeOp('ch-1', { successCount: 8, notes: 'Updated' }, {
        supabase, userId: 'user-1', isConnected: true, setChallenges,
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        success_count: 8, notes: 'Updated', updated_at: expect.any(String),
      }));
    });

    it('enqueues when offline', async () => {
      resetMocks();
      const [setChallenges] = makeSetState<any>();

      await updateChallengeOp('ch-1', { notes: 'Offline note' }, {
        supabase, userId: 'user-1', isConnected: false, setChallenges,
      });

      expect(enqueueOperation).toHaveBeenCalledWith(expect.objectContaining({
        type: 'update', table: 'challenges', itemId: 'ch-1',
      }));
    });
  });

  describe('deleteChallengeOp', () => {
    it('calls DB delete on "challenges" table', async () => {
      resetMocks();
      const [setChallenges] = makeSetState<any>();

      await deleteChallengeOp('ch-1', {
        supabase, userId: 'user-1', isConnected: true, setChallenges,
      });

      expect(mockFrom).toHaveBeenCalledWith('challenges');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'ch-1');
    });
  });
});

// ─── Boules Set CRUD ──────────────────────────────────────────

describe('boulesSetCrudService', () => {
  const setInput: any = {
    name: 'Obut ATX', brand: 'Obut', diameter: 72.5, weight: 700,
    serialNumber: 'SN-123', hardness: 'Tendre', isPrimary: false,
  };

  describe('addBoulesSetOp', () => {
    it('inserts with correct snake_case mapping', async () => {
      resetMocks();
      const [setBoulesSets] = makeSetState<any>();
      const syncFn = jest.fn();
      const dbRow = {
        id: 'bs-1', name: 'Obut ATX', brand: 'Obut',
        diameter: '72.5', weight: 700, serial_number: 'SN-123',
        hardness: 'Tendre', is_primary: false,
      };
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      await addBoulesSetOp(setInput, {
        supabase, userId: 'user-1', boulesSets: [],
        setBoulesSets, syncPrimaryBoulesToPlayer: syncFn,
      });

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1', name: 'Obut ATX', brand: 'Obut',
        serial_number: 'SN-123', is_primary: false,
      }));
      expect(syncFn).not.toHaveBeenCalled(); // not primary
    });

    it('syncs to player when adding a primary set', async () => {
      resetMocks();
      const [setBoulesSets] = makeSetState<any>();
      const syncFn = jest.fn();
      const dbRow = {
        id: 'bs-2', name: 'Obut ATX', brand: 'Obut',
        diameter: '72.5', weight: 700, serial_number: 'SN-123',
        hardness: 'Tendre', is_primary: true,
      };
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      await addBoulesSetOp({ ...setInput, isPrimary: true }, {
        supabase, userId: 'user-1', boulesSets: [],
        setBoulesSets, syncPrimaryBoulesToPlayer: syncFn,
      });

      expect(syncFn).toHaveBeenCalled();
    });
  });

  describe('updateBoulesSetOp', () => {
    it('maps serialNumber → serial_number, purchasePrice → purchase_price', async () => {
      resetMocks();
      const existing = { ...setInput, id: 'bs-1' };
      const [setBoulesSets] = makeSetState<any>();
      const syncFn = jest.fn();

      await updateBoulesSetOp('bs-1', { serialNumber: 'SN-456', purchasePrice: 350 }, {
        supabase, userId: 'user-1', boulesSets: [existing],
        setBoulesSets, syncPrimaryBoulesToPlayer: syncFn,
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        serial_number: 'SN-456', purchase_price: 350, updated_at: expect.any(String),
      }));
    });
  });

  describe('setPrimaryBoulesSetOp', () => {
    it('unsets all then sets chosen set as primary', async () => {
      resetMocks();
      const sets = [
        { id: 'bs-1', name: 'Set A', isPrimary: true },
        { id: 'bs-2', name: 'Set B', isPrimary: false },
      ];
      const [setBoulesSets, getState] = makeSetState<any>();
      setBoulesSets(sets as any);
      const syncFn = jest.fn();

      await setPrimaryBoulesSetOp('bs-2', {
        supabase, userId: 'user-1', boulesSets: sets as any,
        setBoulesSets, syncPrimaryBoulesToPlayer: syncFn,
      });

      // State setter should make bs-2 primary and bs-1 not
      expect(setBoulesSets).toHaveBeenCalled();
      // DB: first update (unset all), then update (set new primary)
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      expect(syncFn).toHaveBeenCalled();
    });
  });

  describe('deleteBoulesSetOp', () => {
    it('removes from state and calls DB delete', async () => {
      resetMocks();
      const [setBoulesSets] = makeSetState<any>();

      await deleteBoulesSetOp('bs-1', {
        supabase, userId: 'user-1', setBoulesSets,
      });

      expect(mockFrom).toHaveBeenCalledWith('boules_sets');
      expect(mockDelete).toHaveBeenCalled();
    });
  });
});

// ─── Cross-cutting: no-user fallback ──────────────────────────

describe('cross-cutting: no-user fallback', () => {
  it.each([
    ['addPlayerOp', () => addPlayerOp({ name: 'X' } as any, { supabase, userId: undefined, isConnected: true, setPlayers: jest.fn(), sharedItemPermissions: {}, players: [] })],
    ['addClubOp', () => addClubOp({ name: 'X', city: 'Y' } as any, { supabase, userId: undefined, isConnected: true, clubs: [], setClubs: jest.fn(), setTerrains: jest.fn(), sharedItemPermissions: {} })],
    ['addTournamentOp', () => addTournamentOp({ name: 'X', date: '2026-01-01' } as any, { supabase, userId: undefined, isConnected: true, tournaments: [], setTournaments: jest.fn(), setMatches: jest.fn(), sharedItemPermissions: {} })],
    ['addTerrainOp', () => addTerrainOp({ name: 'X', city: 'Y', address: 'Z', location: {}, type: 'Sable' } as any, { supabase, userId: undefined, isConnected: true, terrains: [], setTerrains: jest.fn(), setFavoriteTerrainIds: jest.fn(), sharedItemPermissions: {} })],
  ])('%s does not call supabase when userId is undefined', async (_name, fn) => {
    resetMocks();
    await fn();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
