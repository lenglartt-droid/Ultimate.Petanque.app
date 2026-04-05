/**
 * Club Member Role Service
 * Manages club member roles: president, secretary, treasurer, captain, player.
 */
import { getSupabaseClient } from '@/template';

export type ClubMemberRole = 'president' | 'secretary' | 'treasurer' | 'captain' | 'player';

export interface ClubMemberRoleEntry {
  id: string;
  clubId: string;
  playerId: string;
  userId: string;
  role: ClubMemberRole;
  assignedBy?: string;
  createdAt: string;
}

export const CLUB_ROLES: { id: ClubMemberRole; icon: string; color: string; labelFr: string; labelEn: string }[] = [
  { id: 'president', icon: 'star', color: '#F59E0B', labelFr: 'President', labelEn: 'President' },
  { id: 'secretary', icon: 'edit-note', color: '#3B82F6', labelFr: 'Secretaire', labelEn: 'Secretary' },
  { id: 'treasurer', icon: 'account-balance-wallet', color: '#10B981', labelFr: 'Tresorier', labelEn: 'Treasurer' },
  { id: 'captain', icon: 'military-tech', color: '#8B5CF6', labelFr: 'Capitaine', labelEn: 'Captain' },
  { id: 'player', icon: 'person', color: '#64748B', labelFr: 'Joueur', labelEn: 'Player' },
];

export function getRoleConfig(role: ClubMemberRole) {
  return CLUB_ROLES.find(r => r.id === role) || CLUB_ROLES[4];
}

export function getRoleLabel(role: ClubMemberRole, fr: boolean): string {
  const cfg = getRoleConfig(role);
  return fr ? cfg.labelFr : cfg.labelEn;
}

/**
 * Fetch all member roles for a club.
 */
export async function fetchClubMemberRoles(clubId: string): Promise<{ roles: ClubMemberRoleEntry[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('club_member_roles')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const roles: ClubMemberRoleEntry[] = (data || []).map((r: any) => ({
      id: r.id,
      clubId: r.club_id,
      playerId: r.player_id,
      userId: r.user_id,
      role: r.role as ClubMemberRole,
      assignedBy: r.assigned_by,
      createdAt: r.created_at,
    }));

    return { roles, error: null };
  } catch (e: any) {
    return { roles: [], error: e.message || 'Failed to fetch roles' };
  }
}

/**
 * Assign or update a member role.
 */
export async function assignMemberRole(params: {
  clubId: string;
  playerId: string;
  userId: string;
  role: ClubMemberRole;
  assignedBy: string;
}): Promise<{ entry: ClubMemberRoleEntry | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('club_member_roles')
      .upsert({
        club_id: params.clubId,
        player_id: params.playerId,
        user_id: params.userId,
        role: params.role,
        assigned_by: params.assignedBy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'club_id,player_id' })
      .select()
      .single();

    if (error) throw error;

    const entry: ClubMemberRoleEntry = {
      id: data.id,
      clubId: data.club_id,
      playerId: data.player_id,
      userId: data.user_id,
      role: data.role as ClubMemberRole,
      assignedBy: data.assigned_by,
      createdAt: data.created_at,
    };

    return { entry, error: null };
  } catch (e: any) {
    return { entry: null, error: e.message || 'Failed to assign role' };
  }
}

/**
 * Remove a member role.
 */
export async function removeMemberRole(roleId: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('club_member_roles')
      .delete()
      .eq('id', roleId);
    if (error) throw error;
    return { error: null };
  } catch (e: any) {
    return { error: e.message || 'Failed to remove role' };
  }
}

/**
 * Get a player's role in a specific club.
 */
export async function getPlayerClubRole(clubId: string, playerId: string): Promise<ClubMemberRole | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('club_member_roles')
      .select('role')
      .eq('club_id', clubId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (error || !data) return null;
    return data.role as ClubMemberRole;
  } catch {
    return null;
  }
}
