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

export async function revokeShare(shareId: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('shared_items').delete().eq('id', shareId);
  return { error: error?.message || null };
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
