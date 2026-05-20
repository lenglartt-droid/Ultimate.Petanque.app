import type { SupabaseClient } from '@supabase/supabase-js';

export type AmbassadorAdminPatch = Record<string, string | number | boolean | null>;

const RLS_HINT =
  'Database security policy blocked this save. In Supabase SQL Editor, run database/migrations/20260519_ambassadors_admin_patch.sql';

/**
 * Admin-only update for sponsors/partners (ambassadors table).
 * Uses security-definer RPC when available; falls back to direct update.
 */
export async function patchAmbassadorForAdmin(
  supabase: SupabaseClient,
  id: string,
  patch: AmbassadorAdminPatch
): Promise<{ error: string | null }> {
  const payload = { ...patch, updated_at: new Date().toISOString() };

  const { error: rpcError } = await supabase.rpc('admin_patch_ambassador', {
    p_id: id,
    p_patch: payload,
  });

  if (!rpcError) {
    return { error: null };
  }

  const rpcMissing =
    rpcError.message.includes('admin_patch_ambassador') ||
    rpcError.message.includes('Could not find the function');

  if (!rpcMissing) {
    return { error: rpcError.message };
  }

  const { error: updateError } = await supabase.from('ambassadors').update(payload).eq('id', id);

  if (!updateError) {
    return { error: null };
  }

  if (updateError.message.includes('row-level security')) {
    return { error: RLS_HINT };
  }

  return { error: updateError.message };
}
