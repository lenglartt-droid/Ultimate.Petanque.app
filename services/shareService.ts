import { getSupabaseClient } from '@/template';
import * as Linking from 'expo-linking';

export type ShareItemType = 'player' | 'club' | 'terrain' | 'tournament';
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
}

function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createShareLink(
  itemType: ShareItemType,
  itemId: string,
  permission: SharePermission = 'read',
): Promise<{ shareCode: string; shareUrl: string; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { shareCode: '', shareUrl: '', error: 'Non connecté' };

  const shareCode = generateShareCode();
  const shareUrl = Linking.createURL(`share/${shareCode}`);

  const { error } = await supabase.from('shared_items').insert({
    owner_id: userData.user.id,
    share_code: shareCode,
    item_type: itemType,
    item_id: itemId,
    permission,
    is_public_link: true,
  });

  if (error) return { shareCode: '', shareUrl: '', error: error.message };

  return { shareCode, shareUrl, error: null };
}

export async function redeemShareCode(
  shareCode: string,
): Promise<{ itemType: ShareItemType; itemId: string; permission: SharePermission; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { itemType: 'player', itemId: '', permission: 'read', error: 'Non connecté' };

  // Look up the share
  const { data, error } = await supabase
    .from('shared_items')
    .select('*')
    .eq('share_code', shareCode)
    .eq('is_public_link', true)
    .single();

  if (error || !data) return { itemType: 'player', itemId: '', permission: 'read', error: 'Code de partage invalide' };

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { itemType: 'player', itemId: '', permission: 'read', error: 'Ce lien de partage a expiré' };
  }

  // Don't share with yourself
  if (data.owner_id === userData.user.id) {
    return { itemType: data.item_type, itemId: data.item_id, permission: data.permission, error: null };
  }

  // Check if already shared with this user
  const { data: existing } = await supabase
    .from('shared_items')
    .select('id')
    .eq('item_type', data.item_type)
    .eq('item_id', data.item_id)
    .eq('shared_with_id', userData.user.id)
    .maybeSingle();

  if (!existing) {
    // Create personal share entry
    await supabase.from('shared_items').insert({
      owner_id: data.owner_id,
      shared_with_id: userData.user.id,
      share_code: generateShareCode(),
      item_type: data.item_type,
      item_id: data.item_id,
      permission: data.permission,
      is_public_link: false,
    });
  }

  // Create a notification for the owner (regardless of existing share)
  // Fetch accessor info
  const { data: accessorProfile } = await supabase
    .from('user_profiles')
    .select('username, email')
    .eq('id', userData.user.id)
    .single();

  // Fetch item name based on type
  let itemName: string | null = null;
  try {
    if (data.item_type === 'player') {
      const { data: p } = await supabase.from('players').select('name').eq('id', data.item_id).single();
      itemName = p?.name || null;
    } else if (data.item_type === 'club') {
      const { data: c } = await supabase.from('clubs').select('name').eq('id', data.item_id).single();
      itemName = c?.name || null;
    } else if (data.item_type === 'terrain') {
      const { data: t } = await supabase.from('terrains').select('name').eq('id', data.item_id).single();
      itemName = t?.name || null;
    } else if (data.item_type === 'tournament') {
      const { data: t } = await supabase.from('tournaments').select('name').eq('id', data.item_id).single();
      itemName = t?.name || null;
    }
  } catch { /* ignore */ }

  // Insert notification for owner
  await supabase.from('share_notifications').insert({
    owner_id: data.owner_id,
    accessor_id: userData.user.id,
    accessor_name: accessorProfile?.username || userData.user.email?.split('@')[0] || 'Utilisateur',
    accessor_email: accessorProfile?.email || userData.user.email,
    item_type: data.item_type,
    item_id: data.item_id,
    item_name: itemName,
    permission: data.permission,
    share_code: shareCode,
    is_read: false,
  });

  return { itemType: data.item_type, itemId: data.item_id, permission: data.permission, error: null };
}

export async function getMySharedItems(): Promise<{ items: SharedItem[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { items: [], error: 'Non connecté' };

  const { data, error } = await supabase
    .from('shared_items')
    .select('*')
    .eq('owner_id', userData.user.id)
    .eq('is_public_link', true)
    .order('created_at', { ascending: false });

  if (error) return { items: [], error: error.message };

  const items: SharedItem[] = (data || []).map((s: any) => ({
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
  }));

  return { items, error: null };
}

// Share notifications
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
  if (!userData?.user) return { notifications: [], error: 'Non connecté' };

  const { data, error } = await supabase
    .from('share_notifications')
    .select('*')
    .eq('owner_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) return { notifications: [], error: error.message };

  const notifications: ShareNotification[] = (data || []).map((n: any) => ({
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
  }));

  return { notifications, error: null };
}

export async function getUnreadShareNotificationCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return 0;

  const { count, error } = await supabase
    .from('share_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userData.user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}

export async function markShareNotificationsRead(ids?: string[]): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { error: 'Non connecté' };

  let query = supabase
    .from('share_notifications')
    .update({ is_read: true })
    .eq('owner_id', userData.user.id);

  if (ids && ids.length > 0) {
    query = query.in('id', ids);
  } else {
    query = query.eq('is_read', false);
  }

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
  const { error } = await supabase
    .from('shared_items')
    .update({ permission, updated_at: new Date().toISOString() })
    .eq('id', shareId);
  return { error: error?.message || null };
}

export async function fetchItemName(itemType: ShareItemType, itemId: string): Promise<string> {
  const supabase = getSupabaseClient();
  try {
    if (itemType === 'player') {
      const { data } = await supabase.from('players').select('name').eq('id', itemId).single();
      return data?.name || 'Joueur inconnu';
    } else if (itemType === 'club') {
      const { data } = await supabase.from('clubs').select('name').eq('id', itemId).single();
      return data?.name || 'Club inconnu';
    } else if (itemType === 'terrain') {
      const { data } = await supabase.from('terrains').select('name').eq('id', itemId).single();
      return data?.name || 'Terrain inconnu';
    } else if (itemType === 'tournament') {
      const { data } = await supabase.from('tournaments').select('name').eq('id', itemId).single();
      return data?.name || 'Tournoi inconnu';
    }
  } catch { /* ignore */ }
  return 'Inconnu';
}

export async function getSharedWithMe(): Promise<{ items: SharedItem[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { items: [], error: 'Non connecté' };

  const { data, error } = await supabase
    .from('shared_items')
    .select('*')
    .eq('shared_with_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) return { items: [], error: error.message };

  const items: SharedItem[] = (data || []).map((s: any) => ({
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
  }));

  return { items, error: null };
}
