/**
 * Impersonation Detection Service
 *
 * Detects when a user creates a local player entry with the same name as an
 * existing public profile owned by another user. When detected, notifies the
 * real profile owner so they can review and block the potentially fraudulent
 * entry.
 */
import { getSupabaseClient } from '@/template';
import { triggerServerPush } from '@/services/pushTokenService';

export interface ImpersonationMatch {
  publicPlayerId: string;
  publicPlayerName: string;
  publicOwnerUserId: string;
  publicOwnerEmail?: string;
  createdAt: string;
}

export interface ImpersonationAlert {
  localPlayerId: string;
  localPlayerName: string;
  creatorUserId: string;
  creatorName: string;
  originalPlayerId: string;
  originalPlayerName: string;
  createdAt: string;
}

/**
 * Normalize a player name for fuzzy comparison (lowercase, trim, remove diacritics).
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Given a player being created/edited (by playerName), find any existing public
 * player profiles owned by a DIFFERENT user with a matching normalized name.
 */
export async function detectImpersonation(
  playerName: string,
  currentUserId: string
): Promise<{ matches: ImpersonationMatch[]; error: string | null }> {
  if (!playerName || !currentUserId) return { matches: [], error: null };

  const supabase = getSupabaseClient();
  try {
    const normalized = normalizeName(playerName);
    if (normalized.length < 2) return { matches: [], error: null };

    // Fetch all public players
    const { data, error } = await supabase
      .from('players')
      .select('id, name, user_id, created_at')
      .eq('is_public', true)
      .not('user_id', 'is', null);

    if (error) return { matches: [], error: error.message };

    // Filter by normalized name match, excluding current user
    const collisions = (data || []).filter(
      (p: any) => p.user_id !== currentUserId && normalizeName(p.name) === normalized
    );

    if (collisions.length === 0) return { matches: [], error: null };

    // Enrich with owner email for admin visibility
    const ownerIds = [...new Set(collisions.map((c: any) => c.user_id))];
    let ownersMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, email')
        .in('id', ownerIds);
      (profiles || []).forEach((p: any) => {
        ownersMap[p.id] = p.email || '';
      });
    }

    const matches: ImpersonationMatch[] = collisions.map((c: any) => ({
      publicPlayerId: c.id,
      publicPlayerName: c.name,
      publicOwnerUserId: c.user_id,
      publicOwnerEmail: ownersMap[c.user_id],
      createdAt: c.created_at,
    }));

    return { matches, error: null };
  } catch (e: any) {
    return { matches: [], error: e.message };
  }
}

/**
 * Notify the owner of a public profile that someone created a local entry with
 * a matching name. Fires a server-side push to inform the real user.
 */
export async function notifyImpersonation(params: {
  publicOwnerUserId: string;
  publicPlayerName: string;
  newPlayerId: string;
  createdByUserId: string;
  createdByName?: string;
}): Promise<{ error: string | null }> {
  try {
    // Fire-and-forget push to the real profile owner
    await triggerServerPush('impersonation_alert', {
      recipientUserId: params.publicOwnerUserId,
      publicPlayerName: params.publicPlayerName,
      newPlayerId: params.newPlayerId,
      createdByUserId: params.createdByUserId,
      createdByName: params.createdByName || 'Un utilisateur',
    }).catch(() => {});

    // Log the event in admin_activity_logs for audit trail
    const supabase = getSupabaseClient();
    await supabase.from('admin_activity_logs').insert({
      admin_user_id: params.createdByUserId,
      admin_name: params.createdByName || null,
      action_type: 'impersonation_detected',
      action_detail: `Local player "${params.publicPlayerName}" created — matches public profile owned by another user`,
      target_type: 'players',
      target_id: params.newPlayerId,
      target_name: params.publicPlayerName,
      metadata: {
        publicOwnerUserId: params.publicOwnerUserId,
        newPlayerId: params.newPlayerId,
      },
    });

    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Fetch impersonation alerts for the current user: local player entries created
 * by OTHER users with a name matching one of the current user's public player
 * profiles. Used by the /impersonation-alerts page.
 */
export async function getImpersonationAlertsForUser(): Promise<{ alerts: ImpersonationAlert[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { alerts: [], error: 'Not authenticated' };
    const uid = userData.user.id;

    // Fetch all of my public players
    const { data: myPublicPlayers, error: myErr } = await supabase
      .from('players')
      .select('id, name')
      .eq('user_id', uid)
      .eq('is_public', true);

    if (myErr) return { alerts: [], error: myErr.message };
    if (!myPublicPlayers || myPublicPlayers.length === 0) return { alerts: [], error: null };

    const nameMap = new Map<string, { id: string; name: string }>();
    myPublicPlayers.forEach((p: any) => {
      const n = normalizeName(p.name);
      if (n.length >= 2) nameMap.set(n, { id: p.id, name: p.name });
    });

    if (nameMap.size === 0) return { alerts: [], error: null };

    // Fetch recent player entries owned by other users
    const { data: candidates, error: candErr } = await supabase
      .from('players')
      .select('id, name, user_id, created_at')
      .neq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(500);

    if (candErr) return { alerts: [], error: candErr.message };

    const alerts: ImpersonationAlert[] = [];
    for (const c of candidates || []) {
      const normalized = normalizeName(c.name);
      const original = nameMap.get(normalized);
      if (!original) continue;
      alerts.push({
        localPlayerId: c.id,
        localPlayerName: c.name,
        creatorUserId: c.user_id,
        creatorName: '',
        originalPlayerId: original.id,
        originalPlayerName: original.name,
        createdAt: c.created_at,
      });
    }

    if (alerts.length > 0) {
      const creatorIds = [...new Set(alerts.map(a => a.creatorUserId))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, email')
        .in('id', creatorIds);
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = p.username || (p.email ? p.email.split('@')[0] : '') || 'Utilisateur';
      });
      alerts.forEach(a => { a.creatorName = profileMap[a.creatorUserId] || 'Utilisateur'; });
    }

    return { alerts, error: null };
  } catch (e: any) {
    return { alerts: [], error: e.message };
  }
}

/**
 * Full impersonation check + notification pipeline. Call after creating any
 * local player entry.
 */
export async function checkAndNotifyImpersonation(params: {
  playerName: string;
  newPlayerId: string;
  currentUserId: string;
  currentUserName?: string;
}): Promise<{ detected: boolean; matches: ImpersonationMatch[] }> {
  const { matches } = await detectImpersonation(params.playerName, params.currentUserId);
  if (matches.length === 0) return { detected: false, matches: [] };

  for (const m of matches) {
    await notifyImpersonation({
      publicOwnerUserId: m.publicOwnerUserId,
      publicPlayerName: m.publicPlayerName,
      newPlayerId: params.newPlayerId,
      createdByUserId: params.currentUserId,
      createdByName: params.currentUserName,
    });
  }

  return { detected: true, matches };
}
