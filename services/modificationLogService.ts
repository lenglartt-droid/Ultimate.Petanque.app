import { getSupabaseClient } from '@/template';

export type ModLogItemType = 'player' | 'club' | 'terrain' | 'tournament' | 'match' | 'challenge';

const TABLE_MAP: Record<ModLogItemType, string> = {
  player: 'players',
  club: 'clubs',
  terrain: 'terrains',
  tournament: 'tournaments',
  match: 'matches',
  challenge: 'challenges',
};

/** Fields that can be directly reverted (field → DB column). */
const REVERTABLE: Record<ModLogItemType, Record<string, { col: string; kind: 'direct' | 'jsonb_team_a_score' | 'jsonb_team_b_score' }>> = {
  challenge: {
    successCount: { col: 'success_count', kind: 'direct' },
    carreauCount: { col: 'carreau_count', kind: 'direct' },
    totalPoints: { col: 'total_points', kind: 'direct' },
    duration: { col: 'duration', kind: 'direct' },
    notes: { col: 'notes', kind: 'direct' },
  },
  match: {
    winner: { col: 'winner', kind: 'direct' },
    format: { col: 'format', kind: 'direct' },
    duration: { col: 'duration', kind: 'direct' },
    teamAScore: { col: 'team_a', kind: 'jsonb_team_a_score' },
    teamBScore: { col: 'team_b', kind: 'jsonb_team_b_score' },
  },
  player: {
    name: { col: 'name', kind: 'direct' },
    role: { col: 'role', kind: 'direct' },
    level: { col: 'level', kind: 'direct' },
    club: { col: 'club', kind: 'direct' },
    nickname: { col: 'nickname', kind: 'direct' },
  },
  club: {
    name: { col: 'name', kind: 'direct' },
    city: { col: 'city', kind: 'direct' },
  },
  terrain: {
    name: { col: 'name', kind: 'direct' },
    city: { col: 'city', kind: 'direct' },
  },
  tournament: {
    name: { col: 'name', kind: 'direct' },
  },
};

/** Check if a field is revertable for a given item type. */
export function isFieldRevertable(itemType: ModLogItemType, fieldName: string): boolean {
  return !!(REVERTABLE[itemType]?.[fieldName]);
}

export interface ModificationLog {
  id: string;
  itemType: ModLogItemType;
  itemId: string;
  ownerId: string;
  modifierId: string;
  modifierName: string | null;
  modifierEmail: string | null;
  changes: { field: string; oldValue?: any; newValue?: any }[];
  createdAt: string;
}

/**
 * Log a modification made by a shared user on an item.
 * Only logs when the modifier is NOT the owner.
 */
export async function logModification(params: {
  itemType: ModLogItemType;
  itemId: string;
  ownerId: string;
  changes: { field: string; oldValue?: any; newValue?: any }[];
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;

  // Don't log if modifier is the owner
  if (userData.user.id === params.ownerId) return;
  // Don't log empty changes
  if (params.changes.length === 0) return;

  // Get modifier profile info
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('username, email')
    .eq('id', userData.user.id)
    .single();

  await supabase.from('modification_logs').insert({
    item_type: params.itemType,
    item_id: params.itemId,
    owner_id: params.ownerId,
    modifier_id: userData.user.id,
    modifier_name: profile?.username || userData.user.email?.split('@')[0] || 'User',
    modifier_email: profile?.email || userData.user.email,
    changes: params.changes,
  });
}

/**
 * Revert a single field change from a modification log.
 * Updates the DB record with the old value, then cleans up the log entry.
 */
export async function revertFieldChange(params: {
  logId: string;
  itemType: ModLogItemType;
  itemId: string;
  fieldName: string;
  oldValue: any;
}): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const mapping = REVERTABLE[params.itemType]?.[params.fieldName];
  if (!mapping) return { error: 'Field not revertable' };

  const table = TABLE_MAP[params.itemType];
  const now = new Date().toISOString();

  try {
    if (mapping.kind === 'direct') {
      const { error } = await supabase
        .from(table)
        .update({ [mapping.col]: params.oldValue, updated_at: now })
        .eq('id', params.itemId);
      if (error) return { error: error.message };

      // If reverting successCount on a challenge, also recalculate successRate
      if (params.itemType === 'challenge' && params.fieldName === 'successCount') {
        const { data: row } = await supabase.from(table).select('total_shots').eq('id', params.itemId).single();
        const totalShots = row?.total_shots || 10;
        const newRate = Math.round(((params.oldValue as number) / totalShots) * 1000) / 10;
        await supabase.from(table).update({ success_rate: newRate, updated_at: now }).eq('id', params.itemId);
      }
    } else if (mapping.kind === 'jsonb_team_a_score' || mapping.kind === 'jsonb_team_b_score') {
      const col = mapping.kind === 'jsonb_team_a_score' ? 'team_a' : 'team_b';
      const { data: row, error: fetchErr } = await supabase.from(table).select(col).eq('id', params.itemId).single();
      if (fetchErr || !row) return { error: fetchErr?.message || 'Record not found' };
      const teamData = { ...(row as any)[col], score: params.oldValue };
      const { error } = await supabase.from(table).update({ [col]: teamData, updated_at: now }).eq('id', params.itemId);
      if (error) return { error: error.message };
    }

    // Clean up the log entry: remove the reverted field from changes
    const { data: log } = await supabase
      .from('modification_logs')
      .select('changes')
      .eq('id', params.logId)
      .single();

    if (log) {
      const remaining = (log.changes as any[]).filter((c: any) => c.field !== params.fieldName);
      if (remaining.length === 0) {
        await supabase.from('modification_logs').delete().eq('id', params.logId);
      } else {
        await supabase.from('modification_logs').update({ changes: remaining }).eq('id', params.logId);
      }
    }

    return { error: null };
  } catch (e: any) {
    return { error: e.message || 'Unknown error' };
  }
}

/**
 * Fetch modification logs for a specific item.
 * Only the owner can see logs (enforced by RLS).
 */
export async function getModificationLogs(
  itemType: ModLogItemType,
  itemId: string,
  limit: number = 10,
): Promise<{ logs: ModificationLog[]; error: string | null }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('modification_logs')
    .select('*')
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { logs: [], error: error.message };

  const logs: ModificationLog[] = (data || []).map((row: any) => ({
    id: row.id,
    itemType: row.item_type,
    itemId: row.item_id,
    ownerId: row.owner_id,
    modifierId: row.modifier_id,
    modifierName: row.modifier_name,
    modifierEmail: row.modifier_email,
    changes: row.changes || [],
    createdAt: row.created_at,
  }));

  return { logs, error: null };
}
