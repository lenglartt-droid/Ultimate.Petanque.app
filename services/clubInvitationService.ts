/**
 * Club Member Invitation Service
 * Allows club owners to invite players to join their club via the app.
 * Uses push notifications when the player has a linked user account.
 */
import { getSupabaseClient } from '@/template';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_INVITATIONS_KEY = 'club_pending_invitations';

export interface ClubInvitation {
  id: string;
  clubId: string;
  clubName: string;
  clubLogo?: string;
  invitedPlayerId: string;
  invitedPlayerName: string;
  invitedUserId?: string;
  inviterUserId: string;
  inviterName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

/**
 * Send an invitation to a player to join a club.
 * Saves locally and attempts push notification if player has userId.
 */
export async function sendClubInvitation(params: {
  clubId: string;
  clubName: string;
  clubLogo?: string;
  playerId: string;
  playerName: string;
  playerUserId?: string;
  inviterUserId: string;
  inviterName: string;
}): Promise<{ invitation: ClubInvitation | null; error: string | null }> {
  try {
    const invitation: ClubInvitation = {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      clubId: params.clubId,
      clubName: params.clubName,
      clubLogo: params.clubLogo,
      invitedPlayerId: params.playerId,
      invitedPlayerName: params.playerName,
      invitedUserId: params.playerUserId,
      inviterUserId: params.inviterUserId,
      inviterName: params.inviterName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // Save to local storage
    const existing = await getStoredInvitations();
    const updated = [invitation, ...existing.filter(i => !(i.clubId === params.clubId && i.invitedPlayerId === params.playerId))];
    await AsyncStorage.setItem(PENDING_INVITATIONS_KEY, JSON.stringify(updated));

    // If player has a user account, send push notification
    if (params.playerUserId) {
      try {
        const supabase = getSupabaseClient();
        await supabase.functions.invoke('send-push', {
          body: {
            type: 'club_invitation',
            payload: {
              targetUserId: params.playerUserId,
              title: `Invitation: ${params.clubName}`,
              body: `${params.inviterName} vous invite a rejoindre le club ${params.clubName}`,
              data: {
                type: 'club_invitation',
                clubId: params.clubId,
                invitationId: invitation.id,
              },
            },
          },
        });
      } catch (pushError) {
        console.log('[ClubInvitation] Push notification failed:', pushError);
        // Non-blocking: invitation is still saved locally
      }
    }

    return { invitation, error: null };
  } catch (e: any) {
    return { invitation: null, error: e.message || 'Failed to send invitation' };
  }
}

/**
 * Get all stored invitations (sent by current user).
 */
export async function getStoredInvitations(): Promise<ClubInvitation[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_INVITATIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Get invitations for a specific club.
 */
export async function getClubInvitations(clubId: string): Promise<ClubInvitation[]> {
  const all = await getStoredInvitations();
  return all.filter(i => i.clubId === clubId);
}

/**
 * Update invitation status.
 */
export async function updateInvitationStatus(invitationId: string, status: 'accepted' | 'declined'): Promise<{ error: string | null }> {
  try {
    const all = await getStoredInvitations();
    const updated = all.map(i => i.id === invitationId ? { ...i, status } : i);
    await AsyncStorage.setItem(PENDING_INVITATIONS_KEY, JSON.stringify(updated));
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Remove an invitation.
 */
export async function removeInvitation(invitationId: string): Promise<{ error: string | null }> {
  try {
    const all = await getStoredInvitations();
    const updated = all.filter(i => i.id !== invitationId);
    await AsyncStorage.setItem(PENDING_INVITATIONS_KEY, JSON.stringify(updated));
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Check if a player has already been invited to a club.
 */
export async function hasBeenInvited(clubId: string, playerId: string): Promise<boolean> {
  const all = await getStoredInvitations();
  return all.some(i => i.clubId === clubId && i.invitedPlayerId === playerId && i.status === 'pending');
}
