/**
 * Tournament CRUD Service
 * Extracted from contexts/AppContext.tsx — handles add, update, delete for tournaments.
 * No logic changes from original implementation.
 */
import { Tournament, Match, BracketMatch } from '@/types/petanque';
import { logModification } from '@/services/modificationLogService';
import { enqueueOperation, buildTournamentDbPayload, buildUpdateDbPayload } from '@/services/offlineQueueService';

interface TournamentCrudDeps {
  supabase: any;
  userId: string | undefined;
  isConnected: boolean;
  tournaments: Tournament[];
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>;
  setMatches: React.Dispatch<React.SetStateAction<Match[]>>;
  sharedItemPermissions: Record<string, 'read' | 'write'>;
}

export async function addTournamentOp(
  tournament: Omit<Tournament, 'id'>,
  deps: TournamentCrudDeps
): Promise<void> {
  const { supabase, userId, isConnected, setTournaments } = deps;

  if (!userId) {
    const newTournament: Tournament = { ...tournament, id: Date.now().toString() };
    setTournaments(prev => [...prev, newTournament]);
    return;
  }

  if (!isConnected) {
    const tempId = `temp_${Date.now()}`;
    enqueueOperation({ type: 'insert', table: 'tournaments', dbPayload: buildTournamentDbPayload(tournament), tempId });
    setTournaments(prev => [...prev, { ...tournament, id: tempId }]);
    return;
  }

  try {
    const { data, error } = await supabase.from('tournaments').insert({
      user_id: userId,
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
}

export async function updateTournamentOp(
  id: string,
  updates: Partial<Tournament>,
  deps: TournamentCrudDeps
): Promise<void> {
  const { supabase, userId, isConnected, tournaments, setTournaments, sharedItemPermissions } = deps;
  const oldTournament = tournaments.find(t => t.id === id);

  setTournaments(prev => prev.map(tournament =>
    tournament.id === id ? { ...tournament, ...updates } : tournament
  ));

  if (!userId) return;

  if (!isConnected) {
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
}

export function updateBracketMatchOp(
  tournamentId: string,
  bracketMatchId: string,
  updates: Partial<BracketMatch>,
  setTournaments: React.Dispatch<React.SetStateAction<Tournament[]>>
): void {
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
}

export async function deleteTournamentOp(
  id: string,
  deps: Pick<TournamentCrudDeps, 'supabase' | 'userId' | 'isConnected' | 'setTournaments' | 'setMatches'>
): Promise<void> {
  const { supabase, userId, isConnected, setTournaments, setMatches } = deps;
  setTournaments(prev => prev.filter(tournament => tournament.id !== id));
  setMatches(prev => prev.map(m =>
    m.tournamentId === id ? { ...m, tournamentId: undefined, tournamentName: undefined } : m
  ));

  if (!userId) return;

  if (!isConnected) {
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
}
