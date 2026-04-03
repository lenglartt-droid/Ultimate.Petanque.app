/**
 * Club Co-Management Service
 *
 * Manages co-admin relationships for clubs.
 * Allows club owners to add/remove co-admins who can edit the club.
 */

import { getSupabaseClient } from '@/template';

export interface CoAdmin {
  id: string;
  username: string | null;
  email: string;
  avatar: string | null;
  addedAt?: string;
}

/**
 * Get club's co-admin list with profile info.
 */
export async function getClubCoAdmins(clubId: string): Promise<{ coAdmins: CoAdmin[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: club, error: clubErr } = await supabase
      .from('clubs')
      .select('admin_user_ids')
      .eq('id', clubId)
      .single();

    if (clubErr || !club) return { coAdmins: [], error: clubErr?.message || 'Club not found' };

    const adminIds: string[] = club.admin_user_ids || [];
    if (adminIds.length === 0) return { coAdmins: [], error: null };

    const { data: profiles, error: profileErr } = await supabase
      .from('user_profiles')
      .select('id, username, email, avatar')
      .in('id', adminIds);

    if (profileErr) return { coAdmins: [], error: profileErr.message };

    return {
      coAdmins: (profiles || []).map((p: any) => ({
        id: p.id,
        username: p.username,
        email: p.email,
        avatar: p.avatar,
      })),
      error: null,
    };
  } catch (e: any) {
    return { coAdmins: [], error: e.message };
  }
}

/**
 * Add a co-admin to a club by email.
 */
export async function addClubCoAdmin(clubId: string, email: string): Promise<{ coAdmin: CoAdmin | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();

    // Find user by email
    const { data: profile, error: findErr } = await supabase
      .from('user_profiles')
      .select('id, username, email, avatar')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (findErr || !profile) return { coAdmin: null, error: 'user_not_found' };

    // Get current club
    const { data: club, error: clubErr } = await supabase
      .from('clubs')
      .select('user_id, admin_user_ids')
      .eq('id', clubId)
      .single();

    if (clubErr || !club) return { coAdmin: null, error: clubErr?.message || 'Club not found' };

    // Check if user is already owner
    if (profile.id === club.user_id) return { coAdmin: null, error: 'is_owner' };

    // Check if already co-admin
    const currentAdmins: string[] = club.admin_user_ids || [];
    if (currentAdmins.includes(profile.id)) return { coAdmin: null, error: 'already_coadmin' };

    // Add to admin_user_ids
    const newAdmins = [...currentAdmins, profile.id];
    const { error: updateErr } = await supabase
      .from('clubs')
      .update({ admin_user_ids: newAdmins, updated_at: new Date().toISOString() })
      .eq('id', clubId);

    if (updateErr) return { coAdmin: null, error: updateErr.message };

    return {
      coAdmin: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        avatar: profile.avatar,
      },
      error: null,
    };
  } catch (e: any) {
    return { coAdmin: null, error: e.message };
  }
}

/**
 * Remove a co-admin from a club.
 */
export async function removeClubCoAdmin(clubId: string, userId: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();

    const { data: club, error: clubErr } = await supabase
      .from('clubs')
      .select('admin_user_ids')
      .eq('id', clubId)
      .single();

    if (clubErr || !club) return { error: clubErr?.message || 'Club not found' };

    const currentAdmins: string[] = club.admin_user_ids || [];
    const newAdmins = currentAdmins.filter(id => id !== userId);

    const { error: updateErr } = await supabase
      .from('clubs')
      .update({ admin_user_ids: newAdmins, updated_at: new Date().toISOString() })
      .eq('id', clubId);

    if (updateErr) return { error: updateErr.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Check if current user is a co-admin of a club.
 */
export async function isClubCoAdmin(clubId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return false;

    const { data: club } = await supabase
      .from('clubs')
      .select('admin_user_ids')
      .eq('id', clubId)
      .single();

    if (!club) return false;
    const adminIds: string[] = club.admin_user_ids || [];
    return adminIds.includes(userData.user.id);
  } catch {
    return false;
  }
}
