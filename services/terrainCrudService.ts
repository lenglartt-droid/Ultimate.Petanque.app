/**
 * Terrain CRUD Service
 * Extracted from contexts/AppContext.tsx — handles add, update, delete for terrains.
 * No logic changes from original implementation.
 */
import { Terrain } from '@/types/petanque';
import { logModification } from '@/services/modificationLogService';
import { enqueueOperation, buildTerrainDbPayload, buildUpdateDbPayload } from '@/services/offlineQueueService';

interface TerrainCrudDeps {
  supabase: any;
  userId: string | undefined;
  isConnected: boolean;
  terrains: Terrain[];
  setTerrains: React.Dispatch<React.SetStateAction<Terrain[]>>;
  setFavoriteTerrainIds: React.Dispatch<React.SetStateAction<string[]>>;
  sharedItemPermissions: Record<string, 'read' | 'write'>;
}

export async function addTerrainOp(
  terrain: Omit<Terrain, 'id'>,
  deps: TerrainCrudDeps
): Promise<void> {
  const { supabase, userId, isConnected, setTerrains } = deps;

  if (!userId) {
    const newTerrain: Terrain = { ...terrain, id: Date.now().toString() };
    setTerrains(prev => [...prev, newTerrain]);
    return;
  }

  if (!isConnected) {
    const tempId = `temp_${Date.now()}`;
    enqueueOperation({ type: 'insert', table: 'terrains', dbPayload: buildTerrainDbPayload(terrain), tempId });
    setTerrains(prev => [...prev, { ...terrain, id: tempId }]);
    return;
  }

  try {
    const { data, error } = await supabase.from('terrains').insert({
      user_id: userId,
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
      google_place_id: (terrain as any).googlePlaceId || null,
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
        googlePlaceId: data.google_place_id || undefined,
        createdAt: data.created_at,
      };
      setTerrains(prev => [...prev, newTerrain]);
    }
  } catch (error) {
    console.log('Error adding terrain:', error);
    const newTerrain: Terrain = { ...terrain, id: Date.now().toString() };
    setTerrains(prev => [...prev, newTerrain]);
  }
}

export async function updateTerrainOp(
  id: string,
  updates: Partial<Terrain>,
  deps: TerrainCrudDeps
): Promise<void> {
  const { supabase, userId, isConnected, terrains, setTerrains, sharedItemPermissions } = deps;
  const oldTerrain = terrains.find(t => t.id === id);

  setTerrains(prev => prev.map(terrain =>
    terrain.id === id ? { ...terrain, ...updates } : terrain
  ));

  if (!userId) return;

  if (!isConnected) {
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
    if (updates.parking !== undefined) dbUpdates.parking = updates.parking;
    if (updates.toilets !== undefined) dbUpdates.toilets = updates.toilets;
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
}

export async function deleteTerrainOp(
  id: string,
  deps: Pick<TerrainCrudDeps, 'supabase' | 'userId' | 'isConnected' | 'setTerrains' | 'setFavoriteTerrainIds'>
): Promise<void> {
  const { supabase, userId, isConnected, setTerrains, setFavoriteTerrainIds } = deps;
  setTerrains(prev => prev.filter(terrain => terrain.id !== id));
  setFavoriteTerrainIds(prev => prev.filter(fid => fid !== id));

  if (!userId) return;

  if (!isConnected) {
    enqueueOperation({ type: 'delete', table: 'terrains', itemId: id });
    return;
  }

  try {
    await supabase.from('terrains').delete().eq('id', id);
  } catch (error) {
    console.log('Error deleting terrain:', error);
  }
}
