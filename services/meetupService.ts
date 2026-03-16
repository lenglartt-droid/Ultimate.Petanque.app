import { getSupabaseClient } from '@/template';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export interface Meetup {
  id: string;
  creator_id: string;
  terrain_id: string;
  title: string;
  date: string;
  max_participants: number;
  status: 'active' | 'cancelled' | 'completed';
  share_code: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  terrain_name?: string;
  terrain_city?: string;
  terrain_type?: string;
  creator_name?: string;
  creator_email?: string;
  responses?: MeetupResponse[];
}

export interface MeetupResponse {
  id: string;
  meetup_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  responded_at?: string;
  created_at: string;
  // Joined data
  user_name?: string;
  user_email?: string;
}

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'RDV-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new meetup
 */
export async function createMeetup(data: {
  terrainId: string;
  title: string;
  date: string;
  maxParticipants?: number;
  notes?: string;
}): Promise<{ meetup: Meetup | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { meetup: null, error: 'Non authentifié' };

    const shareCode = generateShareCode();

    const { data: meetup, error } = await supabase
      .from('terrain_meetups')
      .insert({
        creator_id: userData.user.id,
        terrain_id: data.terrainId,
        title: data.title,
        date: data.date,
        max_participants: data.maxParticipants || 8,
        share_code: shareCode,
        notes: data.notes || null,
      })
      .select('*')
      .single();

    if (error) return { meetup: null, error: error.message };
    return { meetup, error: null };
  } catch (e: any) {
    return { meetup: null, error: e.message };
  }
}

/**
 * Get meetups created by the current user
 */
export async function getMyMeetups(): Promise<{ meetups: Meetup[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { meetups: [], error: 'Non authentifié' };

    const { data, error } = await supabase
      .from('terrain_meetups')
      .select('*')
      .eq('creator_id', userData.user.id)
      .order('date', { ascending: true });

    if (error) return { meetups: [], error: error.message };
    return { meetups: data || [], error: null };
  } catch (e: any) {
    return { meetups: [], error: e.message };
  }
}

/**
 * Get meetups for a specific terrain
 */
export async function getMeetupsForTerrain(terrainId: string): Promise<{ meetups: Meetup[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('terrain_meetups')
      .select('*')
      .eq('terrain_id', terrainId)
      .eq('status', 'active')
      .gte('date', new Date().toISOString())
      .order('date', { ascending: true });

    if (error) return { meetups: [], error: error.message };
    return { meetups: data || [], error: null };
  } catch (e: any) {
    return { meetups: [], error: e.message };
  }
}

/**
 * Get meetups the user has been invited to (responded to)
 */
export async function getInvitedMeetups(): Promise<{ meetups: Meetup[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { meetups: [], error: 'Non authentifié' };

    // Get meetup IDs from responses
    const { data: responses, error: respError } = await supabase
      .from('terrain_meetup_responses')
      .select('meetup_id')
      .eq('user_id', userData.user.id);

    if (respError) return { meetups: [], error: respError.message };
    if (!responses || responses.length === 0) return { meetups: [], error: null };

    const meetupIds = responses.map(r => r.meetup_id);

    const { data, error } = await supabase
      .from('terrain_meetups')
      .select('*')
      .in('id', meetupIds)
      .eq('status', 'active')
      .order('date', { ascending: true });

    if (error) return { meetups: [], error: error.message };
    return { meetups: data || [], error: null };
  } catch (e: any) {
    return { meetups: [], error: e.message };
  }
}

/**
 * Find a meetup by share code
 */
export async function findMeetupByCode(code: string): Promise<{ meetup: Meetup | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('terrain_meetups')
      .select('*')
      .eq('share_code', code.toUpperCase().trim())
      .eq('status', 'active')
      .single();

    if (error) return { meetup: null, error: 'Code introuvable' };
    return { meetup: data, error: null };
  } catch (e: any) {
    return { meetup: null, error: e.message };
  }
}

/**
 * Get responses for a meetup
 */
export async function getMeetupResponses(meetupId: string): Promise<{ responses: MeetupResponse[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('terrain_meetup_responses')
      .select(`
        *,
        user_profiles:user_id (username, email)
      `)
      .eq('meetup_id', meetupId);

    if (error) return { responses: [], error: error.message };

    const mapped = (data || []).map((r: any) => ({
      ...r,
      user_name: r.user_profiles?.username || r.user_profiles?.email || 'Utilisateur',
      user_email: r.user_profiles?.email,
    }));

    return { responses: mapped, error: null };
  } catch (e: any) {
    return { responses: [], error: e.message };
  }
}

/**
 * Respond to a meetup (accept/decline)
 */
export async function respondToMeetup(meetupId: string, status: 'accepted' | 'declined'): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Non authentifié' };

    // Upsert the response
    const { error } = await supabase
      .from('terrain_meetup_responses')
      .upsert({
        meetup_id: meetupId,
        user_id: userData.user.id,
        status,
        responded_at: new Date().toISOString(),
      }, { onConflict: 'meetup_id,user_id' });

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Cancel a meetup (creator only)
 */
export async function cancelMeetup(meetupId: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('terrain_meetups')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', meetupId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Delete a meetup
 */
export async function deleteMeetup(meetupId: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('terrain_meetups')
      .delete()
      .eq('id', meetupId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Get user's current response status for a meetup
 */
export async function getMyResponseStatus(meetupId: string): Promise<'accepted' | 'declined' | 'pending' | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return null;

    const { data, error } = await supabase
      .from('terrain_meetup_responses')
      .select('status')
      .eq('meetup_id', meetupId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error || !data) return null;
    return data.status as any;
  } catch {
    return null;
  }
}

/**
 * Schedule a local reminder notification for a meetup
 */
export async function scheduleMeetupReminder(meetup: Meetup, terrainName: string): Promise<string | null> {
  try {
    const meetupDate = new Date(meetup.date);
    const reminderDate = new Date(meetupDate);
    reminderDate.setHours(reminderDate.getHours() - 1); // 1 hour before

    if (reminderDate <= new Date()) return null;

    const formattedTime = meetupDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🎯 RDV Pétanque dans 1h !`,
        body: `${meetup.title} à ${terrainName} - ${formattedTime}`,
        data: { meetupId: meetup.id, type: 'meetup_reminder' },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'tournament-reminders' }),
      },
      trigger: {
        date: reminderDate,
        type: Notifications.SchedulableTriggerInputTypes.DATE,
      },
      identifier: `meetup_${meetup.id}_reminder`,
    });

    return id;
  } catch (e) {
    console.log('Error scheduling meetup reminder:', e);
    return null;
  }
}

/**
 * Cancel meetup reminder
 */
export async function cancelMeetupReminder(meetupId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`meetup_${meetupId}_reminder`);
  } catch {
    // Ignore if not found
  }
}

/**
 * Invite users directly to a meetup by creating pending responses
 * Works for public players and shared players whose user_id we know
 */
export async function inviteUsersToMeetup(
  meetupId: string,
  userIds: string[]
): Promise<{ invited: number; error: string | null }> {
  try {
    if (userIds.length === 0) return { invited: 0, error: null };

    const supabase = getSupabaseClient();

    // Filter out users who already have a response
    const { data: existing } = await supabase
      .from('terrain_meetup_responses')
      .select('user_id')
      .eq('meetup_id', meetupId)
      .in('user_id', userIds);

    const existingIds = new Set((existing || []).map((r: any) => r.user_id));
    const newUserIds = userIds.filter(uid => !existingIds.has(uid));

    if (newUserIds.length === 0) return { invited: 0, error: null };

    const rows = newUserIds.map(uid => ({
      meetup_id: meetupId,
      user_id: uid,
      status: 'pending',
    }));

    const { error } = await supabase
      .from('terrain_meetup_responses')
      .insert(rows);

    if (error) return { invited: 0, error: error.message };
    return { invited: newUserIds.length, error: null };
  } catch (e: any) {
    return { invited: 0, error: e.message };
  }
}

/**
 * Get invitable users: public players + players shared with me
 * Returns user_id and display info for selection
 */
export async function getInvitableUsers(): Promise<{ users: InvitableUser[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { users: [], error: null };

    const myId = userData.user.id;
    const usersMap = new Map<string, InvitableUser>();

    // 1. Public players (their user_id is the owner)
    const { data: publicPlayers } = await supabase
      .from('players')
      .select('user_id, name, club, role, avatar')
      .eq('is_public', true)
      .neq('user_id', myId);

    (publicPlayers || []).forEach((p: any) => {
      if (p.user_id && !usersMap.has(p.user_id)) {
        usersMap.set(p.user_id, {
          userId: p.user_id,
          name: p.name,
          club: p.club || '',
          role: p.role || '',
          avatar: p.avatar || '',
          source: 'public',
        });
      }
    });

    // 2. Players shared with me (owner_id is the player owner)
    const { data: sharedItems } = await supabase
      .from('shared_items')
      .select('owner_id, item_type')
      .eq('shared_with_id', myId)
      .eq('item_type', 'player');

    if (sharedItems && sharedItems.length > 0) {
      const ownerIds = [...new Set(sharedItems.map((s: any) => s.owner_id).filter((id: string) => id !== myId && !usersMap.has(id)))];
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, email')
          .in('id', ownerIds);

        (profiles || []).forEach((p: any) => {
          if (!usersMap.has(p.id)) {
            usersMap.set(p.id, {
              userId: p.id,
              name: p.username || p.email || 'Utilisateur',
              club: '',
              role: '',
              avatar: '',
              source: 'shared',
            });
          }
        });
      }
    }

    // 3. Users who shared items with me (shared_with_id = me, so owner is known)
    const { data: itemsSharedWithMe } = await supabase
      .from('shared_items')
      .select('owner_id')
      .eq('shared_with_id', myId)
      .neq('item_type', 'player');

    if (itemsSharedWithMe && itemsSharedWithMe.length > 0) {
      const moreOwnerIds = [...new Set(itemsSharedWithMe.map((s: any) => s.owner_id).filter((id: string) => id !== myId && !usersMap.has(id)))];
      if (moreOwnerIds.length > 0) {
        const { data: moreProfiles } = await supabase
          .from('user_profiles')
          .select('id, username, email')
          .in('id', moreOwnerIds);

        (moreProfiles || []).forEach((p: any) => {
          if (!usersMap.has(p.id)) {
            usersMap.set(p.id, {
              userId: p.id,
              name: p.username || p.email || 'Utilisateur',
              club: '',
              role: '',
              avatar: '',
              source: 'shared',
            });
          }
        });
      }
    }

    return { users: Array.from(usersMap.values()), error: null };
  } catch (e: any) {
    return { users: [], error: e.message };
  }
}

/**
 * Get count of pending meetup invitations for current user
 */
export async function getPendingInvitationsCount(): Promise<number> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return 0;

    const { count, error } = await supabase
      .from('terrain_meetup_responses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userData.user.id)
      .eq('status', 'pending');

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Get all pending invitations for the current user with full meetup details
 */
export async function getPendingInvitations(): Promise<{ invitations: PendingInvitation[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { invitations: [], error: null };

    const { data: responses, error: respError } = await supabase
      .from('terrain_meetup_responses')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('status', 'pending');

    if (respError) return { invitations: [], error: respError.message };
    if (!responses || responses.length === 0) return { invitations: [], error: null };

    const meetupIds = responses.map(r => r.meetup_id);

    const { data: meetups, error: meetupError } = await supabase
      .from('terrain_meetups')
      .select('*')
      .in('id', meetupIds)
      .eq('status', 'active')
      .order('date', { ascending: true });

    if (meetupError) return { invitations: [], error: meetupError.message };

    // Get creator profiles
    const creatorIds = [...new Set((meetups || []).map((m: any) => m.creator_id))];
    let creatorsMap: Record<string, { username: string; email: string }> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, email')
        .in('id', creatorIds);
      (profiles || []).forEach((p: any) => {
        creatorsMap[p.id] = { username: p.username || '', email: p.email || '' };
      });
    }

    // Get terrain names
    const terrainIds = [...new Set((meetups || []).map((m: any) => m.terrain_id))];
    let terrainsMap: Record<string, { name: string; city: string }> = {};
    if (terrainIds.length > 0) {
      const { data: terrains } = await supabase
        .from('terrains')
        .select('id, name, city')
        .in('id', terrainIds);
      (terrains || []).forEach((t: any) => {
        terrainsMap[t.id] = { name: t.name, city: t.city };
      });
    }

    // Get response counts per meetup
    const invitations: PendingInvitation[] = [];
    for (const m of (meetups || [])) {
      const resp = responses.find(r => r.meetup_id === m.id);
      if (!resp) continue;
      const { count } = await supabase
        .from('terrain_meetup_responses')
        .select('id', { count: 'exact', head: true })
        .eq('meetup_id', m.id)
        .eq('status', 'accepted');

      const creator = creatorsMap[m.creator_id];
      const terrain = terrainsMap[m.terrain_id];

      invitations.push({
        responseId: resp.id,
        meetupId: m.id,
        title: m.title,
        date: m.date,
        maxParticipants: m.max_participants,
        acceptedCount: count || 0,
        shareCode: m.share_code,
        notes: m.notes,
        creatorName: creator?.username || creator?.email || '',
        terrainName: terrain?.name || '',
        terrainCity: terrain?.city || '',
      });
    }

    return { invitations, error: null };
  } catch (e: any) {
    return { invitations: [], error: e.message };
  }
}

export interface PendingInvitation {
  responseId: string;
  meetupId: string;
  title: string;
  date: string;
  maxParticipants: number;
  acceptedCount: number;
  shareCode: string;
  notes?: string;
  creatorName: string;
  terrainName: string;
  terrainCity: string;
}

export interface InvitableUser {
  userId: string;
  name: string;
  club: string;
  role: string;
  avatar: string;
  source: 'public' | 'shared';
}
