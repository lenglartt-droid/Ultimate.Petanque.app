/**
 * Match/Challenge Share Service
 * Handles cross-player sharing: detecting linked accounts, creating share requests,
 * accepting/declining, and fetching shared items.
 */
import { getSupabaseClient } from '@/template';
import { sendShareRequestNotification } from '@/services/notificationService';
import { triggerServerPush } from '@/services/pushTokenService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SEEN_SHARE_REQUESTS_KEY = '@lastSeenShareRequestIds';

export interface MatchShareRequest {
  id: string;
  itemType: 'match' | 'challenge';
  itemId: string;
  senderUserId: string;
  recipientUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  permission: 'read' | 'write';
  senderName?: string;
  itemSummary?: string;
  createdAt: string;
  updatedAt: string;
}

interface PlayerWithUser {
  playerId: string;
  playerName: string;
  userId: string;
  email: string;
}

// ============================================
// Auto-detect players linked to user accounts
// ============================================

/**
 * Given a list of player IDs, find which ones are linked to a user account
 * (i.e., have a matching user_id in the players table that corresponds to an actual user_profiles entry).
 */
export async function detectLinkedPlayers(
  playerIds: string[],
  excludeUserId?: string
): Promise<{ linkedPlayers: PlayerWithUser[]; error: string | null }> {
  if (!playerIds || playerIds.length === 0) return { linkedPlayers: [], error: null };

  const supabase = getSupabaseClient();
  try {
    // Fetch players that have a user_id set (meaning they are linked to a user account)
    const { data, error } = await supabase
      .from('players')
      .select('id, name, user_id, email')
      .in('id', playerIds)
      .not('user_id', 'is', null);

    if (error) return { linkedPlayers: [], error: error.message };

    const linked: PlayerWithUser[] = (data || [])
      .filter((p: any) => p.user_id && (!excludeUserId || p.user_id !== excludeUserId))
      .map((p: any) => ({
        playerId: p.id,
        playerName: p.name,
        userId: p.user_id,
        email: p.email || '',
      }));

    return { linkedPlayers: linked, error: null };
  } catch (e: any) {
    return { linkedPlayers: [], error: e.message };
  }
}

// ============================================
// Share Request CRUD
// ============================================

/**
 * Create share requests for multiple recipients at once.
 * Also updates the match/challenge participant_user_ids array.
 */
export async function createShareRequests(params: {
  itemType: 'match' | 'challenge';
  itemId: string;
  senderUserId: string;
  senderName: string;
  recipients: { userId: string; permission: 'read' | 'write' }[];
  itemSummary?: string;
}): Promise<{ requests: MatchShareRequest[]; error: string | null }> {
  const { itemType, itemId, senderUserId, senderName, recipients, itemSummary } = params;
  if (recipients.length === 0) return { requests: [], error: null };

  const supabase = getSupabaseClient();
  try {
    // Insert share requests
    const rows = recipients.map(r => ({
      item_type: itemType,
      item_id: itemId,
      sender_user_id: senderUserId,
      recipient_user_id: r.userId,
      permission: r.permission,
      status: 'pending',
      sender_name: senderName,
      item_summary: itemSummary || null,
    }));

    const { data, error } = await supabase
      .from('match_share_requests')
      .upsert(rows, { onConflict: 'item_type,item_id,recipient_user_id' })
      .select();

    if (error) return { requests: [], error: error.message };

    // Update participant_user_ids on the match/challenge
    const allParticipantIds = [senderUserId, ...recipients.map(r => r.userId)];
    const tableName = itemType === 'match' ? 'matches' : 'challenges';
    await supabase
      .from(tableName)
      .update({ participant_user_ids: allParticipantIds })
      .eq('id', itemId);

    const requests: MatchShareRequest[] = (data || []).map(mapRow);

    // Trigger server-side push for each recipient (fire-and-forget)
    for (const r of recipients) {
      triggerServerPush('share_request', {
        recipientUserId: r.userId,
        senderName,
        itemType,
        permission: r.permission,
        itemSummary,
      }).catch(() => {});
    }

    return { requests, error: null };
  } catch (e: any) {
    return { requests: [], error: e.message };
  }
}

/**
 * Get share requests sent by the current user.
 */
export async function getSentShareRequests(
  status?: 'pending' | 'accepted' | 'declined'
): Promise<{ requests: MatchShareRequest[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    let query = supabase
      .from('match_share_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // The RLS policy sender_select_share_requests handles filtering by sender_user_id
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return { requests: [], error: error.message };
    return { requests: (data || []).map(mapRow), error: null };
  } catch (e: any) {
    return { requests: [], error: e.message };
  }
}

/**
 * Get share requests received by the current user.
 */
export async function getReceivedShareRequests(
  status?: 'pending' | 'accepted' | 'declined'
): Promise<{ requests: MatchShareRequest[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    let query = supabase
      .from('match_share_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return { requests: [], error: error.message };

    // Filter to only received requests (RLS returns both sent and received)
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;
    const received = (data || []).filter((r: any) => r.recipient_user_id === uid);

    return { requests: received.map(mapRow), error: null };
  } catch (e: any) {
    return { requests: [], error: e.message };
  }
}

/**
 * Get pending share request count for the current user.
 */
export async function getPendingShareRequestCount(): Promise<number> {
  const { requests } = await getReceivedShareRequests('pending');
  return requests.length;
}

/**
 * Accept a share request.
 */
export async function acceptShareRequest(
  requestId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('match_share_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Decline a share request.
 */
export async function declineShareRequest(
  requestId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('match_share_requests')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Update permission on an existing share request (sender only).
 */
export async function updateSharePermission(
  requestId: string,
  permission: 'read' | 'write'
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('match_share_requests')
      .update({ permission, updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Delete (revoke) a share request (sender only).
 */
export async function revokeShareRequest(
  requestId: string
): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('match_share_requests')
      .delete()
      .eq('id', requestId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ============================================
// Fetch shared matches/challenges
// ============================================

/**
 * Get all match IDs shared with the current user (accepted only).
 */
export async function getSharedMatchIds(): Promise<{ matchIds: string[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { matchIds: [], error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('match_share_requests')
      .select('item_id')
      .eq('item_type', 'match')
      .eq('recipient_user_id', user.id)
      .eq('status', 'accepted');

    if (error) return { matchIds: [], error: error.message };
    return { matchIds: (data || []).map((r: any) => r.item_id), error: null };
  } catch (e: any) {
    return { matchIds: [], error: e.message };
  }
}

/**
 * Get all challenge IDs shared with the current user (accepted only).
 */
export async function getSharedChallengeIds(): Promise<{ challengeIds: string[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { challengeIds: [], error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('match_share_requests')
      .select('item_id')
      .eq('item_type', 'challenge')
      .eq('recipient_user_id', user.id)
      .eq('status', 'accepted');

    if (error) return { challengeIds: [], error: error.message };
    return { challengeIds: (data || []).map((r: any) => r.item_id), error: null };
  } catch (e: any) {
    return { challengeIds: [], error: e.message };
  }
}

/**
 * Get share requests for a specific item (match or challenge).
 * Returns all requests where the current user is the sender.
 */
export async function getShareRequestsForItem(
  itemType: 'match' | 'challenge',
  itemId: string
): Promise<{ requests: MatchShareRequest[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('match_share_requests')
      .select('*')
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (error) return { requests: [], error: error.message };
    return { requests: (data || []).map(mapRow), error: null };
  } catch (e: any) {
    return { requests: [], error: e.message };
  }
}

// ============================================
// Background polling: detect new requests & notify
// ============================================

let _pollingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling for new share requests and fire local push notifications.
 * Call once after login; stops automatically on cleanup.
 */
export function startShareRequestPolling(intervalMs: number = 30000): void {
  stopShareRequestPolling();
  // Initial check immediately
  _checkForNewShareRequests();
  _pollingInterval = setInterval(_checkForNewShareRequests, intervalMs);
}

export function stopShareRequestPolling(): void {
  if (_pollingInterval) {
    clearInterval(_pollingInterval);
    _pollingInterval = null;
  }
}

async function _checkForNewShareRequests(): Promise<void> {
  try {
    const { requests } = await getReceivedShareRequests('pending');
    if (requests.length === 0) return;

    // Load previously seen request IDs
    const raw = await AsyncStorage.getItem(LAST_SEEN_SHARE_REQUESTS_KEY);
    const seenIds: Set<string> = new Set(raw ? JSON.parse(raw) : []);

    const newRequests = requests.filter(r => !seenIds.has(r.id));
    if (newRequests.length === 0) return;

    // Fire a local notification for each new request
    for (const req of newRequests) {
      await sendShareRequestNotification({
        senderName: req.senderName || 'Un joueur',
        itemType: req.itemType,
        permission: req.permission as 'read' | 'write',
        itemSummary: req.itemSummary,
        requestId: req.id,
      });
      seenIds.add(req.id);
    }

    // Persist updated seen set (keep last 200 to avoid unbounded growth)
    const trimmed = [...seenIds].slice(-200);
    await AsyncStorage.setItem(LAST_SEEN_SHARE_REQUESTS_KEY, JSON.stringify(trimmed));
    console.log(`Notified ${newRequests.length} new share request(s)`);
  } catch (e) {
    // Silent — background task
    console.log('Share request polling error:', e);
  }
}

/**
 * Mark a list of request IDs as already seen (e.g., after user views invitations page).
 */
export async function markShareRequestsSeen(ids: string[]): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_SHARE_REQUESTS_KEY);
    const seenIds: Set<string> = new Set(raw ? JSON.parse(raw) : []);
    ids.forEach(id => seenIds.add(id));
    const trimmed = [...seenIds].slice(-200);
    await AsyncStorage.setItem(LAST_SEEN_SHARE_REQUESTS_KEY, JSON.stringify(trimmed));
  } catch { /* silent */ }
}

// ============================================
// Helper: map DB row to MatchShareRequest
// ============================================
function mapRow(row: any): MatchShareRequest {
  return {
    id: row.id,
    itemType: row.item_type,
    itemId: row.item_id,
    senderUserId: row.sender_user_id,
    recipientUserId: row.recipient_user_id,
    status: row.status,
    permission: row.permission,
    senderName: row.sender_name || undefined,
    itemSummary: row.item_summary || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
