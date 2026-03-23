/**
 * Share Service
 * Manages public share links (shared_items table), share code generation/redemption,
 * auto-import of shared items, and share notifications.
 */
import { getSupabaseClient } from '@/template';

// ============================================
// Types
// ============================================

export type ShareItemType = 'player' | 'club' | 'terrain' | 'tournament' | 'match' | 'challenge';
export type SharePermission = 'read' | 'write';

export interface SharedItem {
  id: string;
  ownerId: string;
  sharedWithId?: string;
  shareCode: string;
  itemType: ShareItemType;
  itemId: string;
  permission: SharePermission;
  isPublicLink: boolean;
  expiresAt?: string;
  createdAt: string;
  associatedItems?: { type: ShareItemType; id: string }[];
}

// ============================================
// Helpers
// ============================================

function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/** Map a shared_items DB row to the SharedItem interface. */
function mapSharedItemRow(s: any): SharedItem {
  return {
    id: s.id,
    ownerId: s.owner_id,
    sharedWithId: s.shared_with_id,
    shareCode: s.share_code,
    itemType: s.item_type,
    itemId: s.item_id,
    permission: s.permission,
    isPublicLink: s.is_public_link,
    expiresAt: s.expires_at,
    createdAt: s.created_at,
    associatedItems: s.associated_items,
  };
}

/** Map a share_notifications DB row to the ShareNotification interface. */
function mapNotificationRow(n: any): ShareNotification {
  return {
    id: n.id,
    ownerId: n.owner_id,
    accessorId: n.accessor_id,
    accessorName: n.accessor_name,
    accessorEmail: n.accessor_email,
    itemType: n.item_type,
    itemId: n.item_id,
    itemName: n.item_name,
    permission: n.permission,
    shareCode: n.share_code,
    isRead: n.is_read,
    createdAt: n.created_at,
  };
}

export interface AssociatedItem {
  type: ShareItemType;
  id: string;
}

// ============================================
// Share Link CRUD
// ============================================

export async function createShareLink(
  itemType: ShareItemType,
  itemId: string,
  permission: SharePermission = 'read',
  associatedItems?: AssociatedItem[],
): Promise<{ shareCode: string; shareUrl: string; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) return { shareCode: '', shareUrl: '', error: 'Not connected' };
  if (!itemId) return { shareCode: '', shareUrl: '', error: 'Item ID is required' };

  // Retry up to 3 times in case of share_code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const shareCode = generateShareCode();
    const shareUrl = `ultimatepetanque://share/${shareCode}`;
    const insertData: any = {
      owner_id: userData.user.id,
      share_code: shareCode,
      item_type: itemType,
      item_id: itemId,
      permission,
      is_public_link: true,
    };
    // Store associated items if provided
    if (associatedItems && associatedItems.length > 0) {
      insertData.associated_items = associatedItems;
    }
    const { error } = await supabase.from('shared_items').insert(insertData);
    if (!error) return { shareCode, shareUrl, error: null };
    // If it's a unique constraint violation on share_code, retry with new code
    if (error.code === '23505' && error.message?.includes('share_code')) continue;
    return { shareCode: '', shareUrl: '', error: error.message };
  }
  return { shareCode: '', shareUrl: '', error: 'Failed to generate unique share code' };
}

export interface RedeemResult {
  itemType: ShareItemType;
  itemId: string;
  permission: SharePermission;
  error: string | null;
  autoSavedItems: { type: ShareItemType; id: string; newItemId: string | null }[];
}

export async function redeemShareCode(shareCode: string): Promise<RedeemResult> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { itemType: 'player', itemId: '', permission: 'read', error: 'Not connected', autoSavedItems: [] };

  const { data, error } = await supabase.from('shared_items').select('*')
    .eq('share_code', shareCode).eq('is_public_link', true).single();
  if (error || !data) return { itemType: 'player', itemId: '', permission: 'read', error: 'Invalid share code', autoSavedItems: [] };
  if (data.expires_at && new Date(data.expires_at) < new Date())
    return { itemType: 'player', itemId: '', permission: 'read', error: 'This share link has expired', autoSavedItems: [] };

  // If owner is redeeming their own code, just return info
  if (data.owner_id === userData.user.id)
    return { itemType: data.item_type, itemId: data.item_id, permission: data.permission, error: null, autoSavedItems: [] };

  // Create share entry for the main item (always read-only)
  const { data: existing } = await supabase.from('shared_items').select('id')
    .eq('item_type', data.item_type).eq('item_id', data.item_id)
    .eq('shared_with_id', userData.user.id).maybeSingle();
  if (!existing) {
    await supabase.from('shared_items').insert({
      owner_id: data.owner_id, shared_with_id: userData.user.id, share_code: generateShareCode(),
      item_type: data.item_type, item_id: data.item_id, permission: 'read', is_public_link: false,
    });
  }

  // Process associated items
  const associatedItems: { type: ShareItemType; id: string }[] = data.associated_items || [];
  for (const assoc of associatedItems) {
    const { data: assocExisting } = await supabase.from('shared_items').select('id')
      .eq('item_type', assoc.type).eq('item_id', assoc.id)
      .eq('shared_with_id', userData.user.id).maybeSingle();
    if (!assocExisting) {
      await supabase.from('shared_items').insert({
        owner_id: data.owner_id, shared_with_id: userData.user.id, share_code: generateShareCode(),
        item_type: assoc.type, item_id: assoc.id, permission: 'read', is_public_link: false,
      });
    }
  }

  // Send notification to owner
  const { data: accessorProfile } = await supabase.from('user_profiles')
    .select('username, email').eq('id', userData.user.id).single();

  let itemName: string | null = null;
  try {
    if (data.item_type === 'player') {
      const { data: p } = await supabase.from('players').select('name').eq('id', data.item_id).single();
      itemName = p?.name || null;
    } else if (data.item_type === 'club') {
      const { data: c } = await supabase.from('clubs').select('name').eq('id', data.item_id).single();
      itemName = c?.name || null;
    } else if (data.item_type === 'terrain') {
      const { data: tr } = await supabase.from('terrains').select('name').eq('id', data.item_id).single();
      itemName = tr?.name || null;
    } else if (data.item_type === 'tournament') {
      const { data: to } = await supabase.from('tournaments').select('name').eq('id', data.item_id).single();
      itemName = to?.name || null;
    } else if (data.item_type === 'match') {
      const { data: m } = await supabase.from('matches').select('team_a, team_b, date').eq('id', data.item_id).single();
      if (m) {
        const d = new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        itemName = `${m.team_a?.playerNames?.[0] || 'A'} vs ${m.team_b?.playerNames?.[0] || 'B'} (${d})`;
      }
    } else if (data.item_type === 'challenge') {
      const { data: ch } = await supabase.from('challenges').select('type, date, player_name').eq('id', data.item_id).single();
      if (ch) {
        const d = new Date(ch.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        itemName = `${ch.type} - ${ch.player_name || ''} (${d})`;
      }
    }
  } catch { /* ignore */ }

  await supabase.from('share_notifications').insert({
    owner_id: data.owner_id, accessor_id: userData.user.id,
    accessor_name: accessorProfile?.username || userData.user.email?.split('@')[0] || 'User',
    accessor_email: accessorProfile?.email || userData.user.email,
    item_type: data.item_type, item_id: data.item_id, item_name: itemName,
    permission: 'read', share_code: shareCode, is_read: false,
  });

  // Auto-save all items to recipient's directory
  const autoSavedItems: { type: ShareItemType; id: string; newItemId: string | null }[] = [];

  // Save main item
  const mainSave = await saveSharedItemToMyAccount(data.item_type, data.item_id);
  autoSavedItems.push({ type: data.item_type, id: data.item_id, newItemId: mainSave.newItemId });

  // Save associated items
  for (const assoc of associatedItems) {
    const assocSave = await saveSharedItemToMyAccount(assoc.type, assoc.id);
    autoSavedItems.push({ type: assoc.type, id: assoc.id, newItemId: assocSave.newItemId });
  }

  return { itemType: data.item_type, itemId: data.item_id, permission: 'read', error: null, autoSavedItems };
}

// ============================================
// Shared Items Queries
// ============================================

export async function getMySharedItems(): Promise<{ items: SharedItem[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { items: [], error: 'Not connected' };
  const { data, error } = await supabase.from('shared_items').select('*')
    .eq('owner_id', userData.user.id).eq('is_public_link', true).order('created_at', { ascending: false });
  if (error) return { items: [], error: error.message };
  return { items: (data || []).map(mapSharedItemRow), error: null };
}

export async function getSharedWithMe(): Promise<{ items: SharedItem[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { items: [], error: 'Not connected' };
  const { data, error } = await supabase.from('shared_items').select('*')
    .eq('shared_with_id', userData.user.id).order('created_at', { ascending: false });
  if (error) return { items: [], error: error.message };
  return { items: (data || []).map(mapSharedItemRow), error: null };
}

// ============================================
// Share Notifications
// ============================================

export interface ShareNotification {
  id: string;
  ownerId: string;
  accessorId: string;
  accessorName: string | null;
  accessorEmail: string | null;
  itemType: ShareItemType;
  itemId: string;
  itemName: string | null;
  permission: SharePermission;
  shareCode: string | null;
  isRead: boolean;
  createdAt: string;
}

export async function getShareNotifications(): Promise<{ notifications: ShareNotification[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { notifications: [], error: 'Not connected' };
  const { data, error } = await supabase.from('share_notifications').select('*')
    .eq('owner_id', userData.user.id).order('created_at', { ascending: false });
  if (error) return { notifications: [], error: error.message };
  return { notifications: (data || []).map(mapNotificationRow), error: null };
}

export async function getUnreadShareNotificationCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return 0;
  const { count, error } = await supabase.from('share_notifications')
    .select('*', { count: 'exact', head: true }).eq('owner_id', userData.user.id).eq('is_read', false);
  if (error) return 0;
  return count || 0;
}

export async function markShareNotificationsRead(ids?: string[]): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { error: 'Not connected' };
  let query = supabase.from('share_notifications').update({ is_read: true }).eq('owner_id', userData.user.id);
  if (ids && ids.length > 0) { query = query.in('id', ids); } else { query = query.eq('is_read', false); }
  const { error } = await query;
  return { error: error?.message || null };
}

export async function deleteShareNotification(id: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('share_notifications').delete().eq('id', id);
  return { error: error?.message || null };
}

export async function revokeShare(shareId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('shared_items').delete().eq('id', shareId);
  return { error: error?.message || null };
}

export async function updateSharePermission(shareId: string, permission: SharePermission): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('shared_items')
    .update({ permission, updated_at: new Date().toISOString() }).eq('id', shareId);
  return { error: error?.message || null };
}

// ============================================
// Item Name Resolution
// ============================================

export async function fetchItemName(itemType: ShareItemType, itemId: string): Promise<string> {
  const supabase = getSupabaseClient();
  try {
    if (itemType === 'player') { const { data } = await supabase.from('players').select('name').eq('id', itemId).single(); return data?.name || 'Unknown player'; }
    if (itemType === 'club') { const { data } = await supabase.from('clubs').select('name').eq('id', itemId).single(); return data?.name || 'Unknown club'; }
    if (itemType === 'terrain') { const { data } = await supabase.from('terrains').select('name').eq('id', itemId).single(); return data?.name || 'Unknown terrain'; }
    if (itemType === 'tournament') { const { data } = await supabase.from('tournaments').select('name').eq('id', itemId).single(); return data?.name || 'Unknown tournament'; }
    if (itemType === 'match') {
      const { data } = await supabase.from('matches').select('team_a, team_b').eq('id', itemId).single();
      if (data) return `${data.team_a?.playerNames?.[0] || '?'} vs ${data.team_b?.playerNames?.[0] || '?'}`;
    }
    if (itemType === 'challenge') {
      const { data } = await supabase.from('challenges').select('type, player_name').eq('id', itemId).single();
      if (data) return `${data.type} - ${data.player_name || '?'}`;
    }
  } catch { /* ignore */ }
  return 'Unknown';
}

export async function isSharedWithMe(itemType: ShareItemType, itemId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return false;
  const { data } = await supabase.from('shared_items').select('id')
    .eq('item_type', itemType).eq('item_id', itemId).eq('shared_with_id', userData.user.id).maybeSingle();
  return !!data;
}

// ============================================
// Shared Item Import (auto-save to recipient)
// ============================================

/** Import a shared match with team perspective swapped for the recipient. */
async function importSharedMatch(userId: string, matchId: string): Promise<{ newItemId: string | null; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: source, error: fetchErr } = await supabase.from('matches').select('*').eq('id', matchId).single();
    if (fetchErr || !source) return { newItemId: null, error: 'Match not found' };

    const { data: profile } = await supabase.from('user_profiles').select('username').eq('id', userId).single();
    const recipientName = (profile?.username || '').toLowerCase();

    const isInTeamB = source.team_b?.players?.includes(userId) ||
      (recipientName && source.team_b?.playerNames?.some((n: string) => n.toLowerCase().includes(recipientName)));
    const isInTeamA = source.team_a?.players?.includes(userId) ||
      (recipientName && source.team_a?.playerNames?.some((n: string) => n.toLowerCase().includes(recipientName)));
    const shouldSwap = isInTeamB || (!isInTeamA && !isInTeamB);

    const teamA = shouldSwap ? source.team_b : source.team_a;
    const teamB = shouldSwap ? source.team_a : source.team_b;
    const winner = shouldSwap ? (source.winner === 'A' ? 'B' : 'A') : source.winner;

    let playerActions = source.player_actions;
    if (playerActions && shouldSwap) {
      playerActions = playerActions.map((pa: any) => ({ ...pa, team: pa.team === 'A' ? 'B' : 'A' }));
    }
    let menes = source.menes;
    if (menes && shouldSwap) {
      menes = menes.map((m: any) => ({ ...m, teamAPoints: m.teamBPoints || 0, teamBPoints: m.teamAPoints || 0 }));
    }
    let seriesInfo = source.series_info;
    if (seriesInfo && shouldSwap) {
      seriesInfo = { ...seriesInfo,
        winsBeforeThisMatch: { teamA: seriesInfo.winsBeforeThisMatch?.teamB || 0, teamB: seriesInfo.winsBeforeThisMatch?.teamA || 0 },
        seriesWinner: seriesInfo.seriesWinner === 'A' ? 'B' : seriesInfo.seriesWinner === 'B' ? 'A' : seriesInfo.seriesWinner,
      };
    }

    const { data: newItem, error: insertErr } = await supabase.from('matches').insert({
      user_id: userId, date: source.date, mode: source.mode, format: source.format,
      tournament_name: source.tournament_name, tournament_phase: source.tournament_phase,
      tournament_bracket: source.tournament_bracket, terrain_type: source.terrain_type,
      team_a: teamA, team_b: teamB, winner, duration: source.duration,
      menes, player_actions: playerActions, series_info: seriesInfo,
    }).select('id').single();
    if (insertErr) return { newItemId: null, error: insertErr.message };
    return { newItemId: newItem?.id || null, error: null };
  } catch (e: any) { return { newItemId: null, error: e.message || 'Error importing match' }; }
}

/** Import a shared challenge with perspective adapted for the recipient. */
async function importSharedChallenge(userId: string, challengeId: string): Promise<{ newItemId: string | null; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: source, error: fetchErr } = await supabase.from('challenges').select('*').eq('id', challengeId).single();
    if (fetchErr || !source) return { newItemId: null, error: 'Challenge not found' };

    const { data: profile } = await supabase.from('user_profiles').select('username').eq('id', userId).single();
    const recipientName = (profile?.username || '').toLowerCase();
    const isOpponent = source.opponent_id === userId ||
      (recipientName && source.opponent_name?.toLowerCase().includes(recipientName));

    if (isOpponent && source.mode === '1v1') {
      const swappedWinner = source.winner === 'player' ? 'opponent' : source.winner === 'opponent' ? 'player' : source.winner;
      const opponentResult = {
        playerId: source.player_id, playerName: source.player_name, shots: source.shots,
        precisionShots: source.precision_shots, successCount: source.success_count,
        totalShots: source.total_shots, carreauCount: source.carreau_count,
        successRate: source.success_rate, totalPoints: source.total_points, atelierScores: source.atelier_scores,
      };
      const { data: newItem, error: insertErr } = await supabase.from('challenges').insert({
        user_id: userId, type: source.type, mode: source.mode, date: source.date,
        player_id: source.opponent_id || userId, player_name: source.opponent_name || profile?.username || '',
        opponent_id: source.player_id, opponent_name: source.player_name, opponent_result: opponentResult,
        winner: swappedWinner, shots: source.opponent_result?.shots || null,
        success_count: source.opponent_result?.successCount || 0,
        total_shots: source.opponent_result?.totalShots || source.total_shots,
        carreau_count: source.opponent_result?.carreauCount || 0,
        success_rate: source.opponent_result?.successRate || 0,
        precision_shots: source.opponent_result?.precisionShots || null,
        total_points: source.opponent_result?.totalPoints || null,
        max_points: source.max_points, atelier_scores: source.opponent_result?.atelierScores || null,
        duration: source.duration, detailed_shots: source.detailed_shots,
      }).select('id').single();
      if (insertErr) return { newItemId: null, error: insertErr.message };
      return { newItemId: newItem?.id || null, error: null };
    } else {
      const { data: newItem, error: insertErr } = await supabase.from('challenges').insert({
        user_id: userId, type: source.type, mode: source.mode, date: source.date,
        player_id: source.player_id, player_name: source.player_name,
        opponent_id: source.opponent_id, opponent_name: source.opponent_name,
        opponent_result: source.opponent_result, winner: source.winner, shots: source.shots,
        success_count: source.success_count, total_shots: source.total_shots,
        carreau_count: source.carreau_count, success_rate: source.success_rate,
        precision_shots: source.precision_shots, total_points: source.total_points,
        max_points: source.max_points, atelier_scores: source.atelier_scores,
        duration: source.duration, detailed_shots: source.detailed_shots,
      }).select('id').single();
      if (insertErr) return { newItemId: null, error: insertErr.message };
      return { newItemId: newItem?.id || null, error: null };
    }
  } catch (e: any) { return { newItemId: null, error: e.message || 'Error importing challenge' }; }
}

export async function saveSharedItemToMyAccount(itemType: ShareItemType, itemId: string): Promise<{ newItemId: string | null; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { newItemId: null, error: 'Not connected' };

  if (itemType === 'match') return importSharedMatch(userData.user.id, itemId);
  if (itemType === 'challenge') return importSharedChallenge(userData.user.id, itemId);

  try {
    if (itemType === 'player') {
      const { data: source, error: fetchErr } = await supabase.from('players').select('*').eq('id', itemId).single();
      if (fetchErr || !source) return { newItemId: null, error: 'Player not found' };
      // Check if already exists (by name) to avoid duplicates
      const { data: existing } = await supabase.from('players').select('id').eq('user_id', userData.user.id).eq('name', source.name).maybeSingle();
      if (existing) return { newItemId: existing.id, error: null }; // Already saved
      const { data: newItem, error: insertErr } = await supabase.from('players').insert({
        user_id: userData.user.id, name: source.name, nickname: source.nickname, avatar: source.avatar,
        club: source.club, club_id: null, role: source.role, level: source.level, location: source.location,
        phone: null, email: null, country: source.country, boules: source.boules,
        handedness: source.handedness, terrain_id: null, terrain_name: source.terrain_name,
        is_public: false, stats: source.stats,
      }).select('id').single();
      if (insertErr) return { newItemId: null, error: insertErr.message };
      return { newItemId: newItem?.id || null, error: null };
    } else if (itemType === 'club') {
      const { data: source, error: fetchErr } = await supabase.from('clubs').select('*').eq('id', itemId).single();
      if (fetchErr || !source) return { newItemId: null, error: 'Club not found' };
      const { data: existing } = await supabase.from('clubs').select('id').eq('user_id', userData.user.id).eq('name', source.name).maybeSingle();
      if (existing) return { newItemId: existing.id, error: null };
      const { data: newItem, error: insertErr } = await supabase.from('clubs').insert({
        user_id: userData.user.id, name: source.name, logo: source.logo, address: source.address,
        city: source.city, country: source.country, location: source.location, members_count: source.members_count,
        founded_year: source.founded_year, description: source.description, facilities: source.facilities,
        contact_email: null, contact_phone: null, terrain_id: null,
        terrain_name: source.terrain_name, membership_cost: source.membership_cost,
      }).select('id').single();
      if (insertErr) return { newItemId: null, error: insertErr.message };
      return { newItemId: newItem?.id || null, error: null };
    } else if (itemType === 'terrain') {
      const { data: source, error: fetchErr } = await supabase.from('terrains').select('*').eq('id', itemId).single();
      if (fetchErr || !source) return { newItemId: null, error: 'Terrain not found' };
      const { data: existing } = await supabase.from('terrains').select('id').eq('user_id', userData.user.id).eq('name', source.name).maybeSingle();
      if (existing) return { newItemId: existing.id, error: null };
      const { data: newItem, error: insertErr } = await supabase.from('terrains').insert({
        user_id: userData.user.id, name: source.name, address: source.address, city: source.city,
        location: source.location, type: source.type, description: source.description, facilities: source.facilities,
        photos: source.photos, club_id: null, club_name: source.club_name, is_public: false,
        courts_count: source.courts_count, lighting: source.lighting, covered: source.covered,
      }).select('id').single();
      if (insertErr) return { newItemId: null, error: insertErr.message };
      return { newItemId: newItem?.id || null, error: null };
    } else if (itemType === 'tournament') {
      const { data: source, error: fetchErr } = await supabase.from('tournaments').select('*').eq('id', itemId).single();
      if (fetchErr || !source) return { newItemId: null, error: 'Tournament not found' };
      const { data: existing } = await supabase.from('tournaments').select('id').eq('user_id', userData.user.id).eq('name', source.name).maybeSingle();
      if (existing) return { newItemId: existing.id, error: null };
      const { data: newItem, error: insertErr } = await supabase.from('tournaments').insert({
        user_id: userData.user.id, name: source.name, date: source.date, end_date: source.end_date,
        type: source.type, format: source.format, location: source.location, terrain_id: null,
        terrain_name: source.terrain_name, terrain_type: source.terrain_type, club_id: null,
        club_name: source.club_name, status: source.status, participants: source.participants,
        max_participants: source.max_participants, prize: source.prize, description: source.description,
        tournament_level: source.tournament_level, tournament_category: source.tournament_category,
        registration_type: source.registration_type, tournament_scope: source.tournament_scope,
        registration_cost: source.registration_cost,
      }).select('id').single();
      if (insertErr) return { newItemId: null, error: insertErr.message };
      return { newItemId: newItem?.id || null, error: null };
    }
    return { newItemId: null, error: 'Unsupported type' };
  } catch (e: any) { return { newItemId: null, error: e.message || 'Error during copy' }; }
}
