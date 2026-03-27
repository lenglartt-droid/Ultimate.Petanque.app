/**
 * Player CRUD Service
 * Extracted from contexts/AppContext.tsx — handles add, update, delete for players.
 * No logic changes from original implementation.
 */
import { Player } from '@/types/petanque';
import { logModification } from '@/services/modificationLogService';
import { enqueueOperation, buildPlayerDbPayload, buildUpdateDbPayload } from '@/services/offlineQueueService';
import { mapPlayerFromDb } from '@/services/dbMappers';

interface PlayerCrudDeps {
  supabase: any;
  userId: string | undefined;
  isConnected: boolean;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  sharedItemPermissions: Record<string, 'read' | 'write'>;
  players: Player[];
}

export async function addPlayerOp(
  player: Omit<Player, 'id'>,
  deps: PlayerCrudDeps
): Promise<void> {
  const { supabase, userId, isConnected, setPlayers } = deps;

  if (!userId) {
    const newPlayer: Player = { ...player, id: Date.now().toString() };
    setPlayers(prev => [...prev, newPlayer]);
    return;
  }

  if (!isConnected) {
    const tempId = `temp_${Date.now()}`;
    enqueueOperation({ type: 'insert', table: 'players', dbPayload: buildPlayerDbPayload(player), tempId });
    setPlayers(prev => [...prev, { ...player, id: tempId } as Player]);
    return;
  }

  try {
    const { data, error } = await supabase.from('players').insert({
      user_id: userId,
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
      const newPlayer: Player = mapPlayerFromDb(data);
      setPlayers(prev => [...prev, newPlayer]);
    }
  } catch (error) {
    console.log('Error adding player:', error);
    const newPlayer: Player = { ...player, id: Date.now().toString() };
    setPlayers(prev => [...prev, newPlayer]);
  }
}

export async function updatePlayerOp(
  id: string,
  updates: Partial<Player>,
  deps: PlayerCrudDeps
): Promise<void> {
  const { supabase, userId, isConnected, setPlayers, sharedItemPermissions, players } = deps;
  const oldPlayer = players.find(p => p.id === id);

  setPlayers(prev => prev.map(player =>
    player.id === id ? { ...player, ...updates } : player
  ));

  if (!userId) return;

  if (!isConnected) {
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
}

export async function deletePlayerOp(
  id: string,
  deps: Pick<PlayerCrudDeps, 'supabase' | 'userId' | 'isConnected' | 'setPlayers'>
): Promise<void> {
  const { supabase, userId, isConnected, setPlayers } = deps;
  setPlayers(prev => prev.filter(player => player.id !== id));

  if (!userId) return;

  if (!isConnected) {
    enqueueOperation({ type: 'delete', table: 'players', itemId: id });
    return;
  }

  try {
    await supabase.from('players').delete().eq('id', id);
  } catch (error) {
    console.log('Error deleting player:', error);
  }
}
