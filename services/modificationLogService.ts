import { getSupabaseClient } from '@/template';

export type ModLogItemType = 'player' | 'club' | 'terrain' | 'tournament' | 'match' | 'challenge';

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
