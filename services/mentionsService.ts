/**
 * Match Mentions Service
 *
 * Handles matches that mention the current user (their linked player id
 * appears in a match's participant list) but where they have not accepted a
 * share request, so they can review, accept, decline, or report as fake.
 * Also handles fake-match reporting with trust score penalty on the sender.
 */
import { getSupabaseClient } from '@/template';
import { triggerServerPush } from '@/services/pushTokenService';

export interface MatchMention {
  matchId: string;
  senderUserId: string;
  senderName?: string;
  senderEmail?: string;
  matchDate: string;
  teamANames: string[];
  teamBNames: string[];
  teamAScore: number;
  teamBScore: number;
  winner: 'A' | 'B';
  format: string;
  mode: string;
  hasPendingRequest: boolean;
  pendingRequestId?: string;
  createdAt: string;
}

/**
 * Find all matches where the current user's linked player_id appears in either
 * team but where the user has NOT yet accepted a share request. Includes both:
 *   - Matches with a pending share request awaiting response
 *   - Matches that mention the user but for which no share request was sent
 *     (silent mention — the user should be notified)
 */
export async function getMatchesMentioningUser(): Promise<{ mentions: MatchMention[]; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { mentions: [], error: null };
    const uid = userData.user.id;

    // Fetch matches where user's id is in participant_user_ids but they are NOT the owner
    // and where they haven't already accepted a share request.
    const { data: mentionMatches, error: matchErr } = await supabase
      .from('matches')
      .select('id, user_id, date, team_a, team_b, winner, format, mode, participant_user_ids, created_at')
      .neq('user_id', uid)
      .contains('participant_user_ids', [uid])
      .order('date', { ascending: false })
      .limit(100);

    if (matchErr) return { mentions: [], error: matchErr.message };
    if (!mentionMatches || mentionMatches.length === 0) return { mentions: [], error: null };

    // Load related share requests
    const matchIds = mentionMatches.map((m: any) => m.id);
    const { data: requests } = await supabase
      .from('match_share_requests')
      .select('id, item_id, status, sender_user_id, sender_name')
      .eq('item_type', 'match')
      .eq('recipient_user_id', uid)
      .in('item_id', matchIds);

    // Filter out matches where the user already accepted
    const acceptedIds = new Set(
      (requests || []).filter((r: any) => r.status === 'accepted').map((r: any) => r.item_id)
    );
    const pendingByMatchId = new Map(
      (requests || []).filter((r: any) => r.status === 'pending').map((r: any) => [r.item_id, r])
    );

    const filteredMatches = mentionMatches.filter((m: any) => !acceptedIds.has(m.id));
    if (filteredMatches.length === 0) return { mentions: [], error: null };

    // Enrich with sender profiles
    const senderIds = [...new Set(filteredMatches.map((m: any) => m.user_id))];
    let senderMap: Record<string, { username?: string; email?: string }> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, email')
        .in('id', senderIds);
      (profiles || []).forEach((p: any) => {
        senderMap[p.id] = { username: p.username, email: p.email };
      });
    }

    const mentions: MatchMention[] = filteredMatches.map((m: any) => {
      const teamA = typeof m.team_a === 'string' ? JSON.parse(m.team_a) : m.team_a;
      const teamB = typeof m.team_b === 'string' ? JSON.parse(m.team_b) : m.team_b;
      const sender = senderMap[m.user_id] || {};
      const pending = pendingByMatchId.get(m.id) as any;

      return {
        matchId: m.id,
        senderUserId: m.user_id,
        senderName: sender.username || pending?.sender_name || sender.email?.split('@')[0],
        senderEmail: sender.email,
        matchDate: m.date,
        teamANames: teamA?.playerNames || [],
        teamBNames: teamB?.playerNames || [],
        teamAScore: teamA?.score || 0,
        teamBScore: teamB?.score || 0,
        winner: m.winner,
        format: m.format,
        mode: m.mode,
        hasPendingRequest: !!pending,
        pendingRequestId: pending?.id,
        createdAt: m.created_at,
      };
    });

    return { mentions, error: null };
  } catch (e: any) {
    return { mentions: [], error: e.message };
  }
}

/**
 * Send a push notification when a user is "mentioned" in a match created by
 * another user without an explicit share request. Called after saving a match
 * that includes linked players who did NOT receive an explicit share request.
 */
export async function notifyMentionedUser(params: {
  matchId: string;
  mentionedUserId: string;
  creatorName: string;
  matchSummary: string;
}): Promise<void> {
  try {
    await triggerServerPush('match_mentioned', {
      recipientUserId: params.mentionedUserId,
      matchId: params.matchId,
      creatorName: params.creatorName,
      matchSummary: params.matchSummary,
    }).catch(() => {});
  } catch { /* silent */ }
}

/**
 * Report a match as fake ("This match never happened"). Creates a player_reports
 * entry with reason 'fake_match' targeting the match creator and lowers their
 * trust score. Admin moderation team can then review.
 */
export async function reportFakeMatch(params: {
  matchId: string;
  senderUserId: string;
  details?: string;
}): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Not authenticated' };
    if (userData.user.id === params.senderUserId) {
      return { error: 'Cannot report your own match' };
    }

    // Find the sender's public player record (if any) so we can attach the report
    const { data: senderPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', params.senderUserId)
      .limit(1)
      .maybeSingle();

    const reportedPlayerId = senderPlayer?.id || params.senderUserId;

    const { error: insertError } = await supabase.from('player_reports').insert({
      reporter_id: userData.user.id,
      reported_player_id: reportedPlayerId,
      reported_user_id: params.senderUserId,
      reason: 'fake_match',
      details: params.details || `Le match ${params.matchId} n'a jamais eu lieu selon le joueur concerne.`,
      status: 'pending',
    });

    if (insertError) {
      if (insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
        return { error: 'already_reported' };
      }
      return { error: insertError.message };
    }

    // Flag the sender's trust score for review
    const { data: existing } = await supabase
      .from('suspicious_players')
      .select('id, trust_score, flags')
      .eq('player_id', reportedPlayerId)
      .maybeSingle();

    const newFlag = {
      type: 'fake_match_report',
      matchId: params.matchId,
      reporterId: userData.user.id,
      reportedAt: new Date().toISOString(),
    };

    if (existing) {
      const currentFlags = Array.isArray(existing.flags) ? existing.flags : [];
      const newScore = Math.max(0, (existing.trust_score || 50) - 10);
      await supabase
        .from('suspicious_players')
        .update({
          flags: [...currentFlags, newFlag],
          trust_score: newScore,
          status: newScore < 20 ? 'banned' : newScore < 40 ? 'flagged' : 'watch',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('suspicious_players').insert({
        player_id: reportedPlayerId,
        user_id: params.senderUserId,
        trust_score: 40,
        flags: [newFlag],
        details: { firstFakeMatchReport: newFlag },
        status: 'flagged',
        analyzed_at: new Date().toISOString(),
      });
    }

    // Notify admin moderation team
    triggerServerPush('admin_critical_alert', {
      alertType: 'fake_match_report',
      matchId: params.matchId,
      reportedUserId: params.senderUserId,
      reporterId: userData.user.id,
    }).catch(() => {});

    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Check whether the current user has any unread match mentions (used for
 * badge count on the notifications hub).
 */
export async function getUnreadMentionCount(): Promise<number> {
  try {
    const { mentions } = await getMatchesMentioningUser();
    return mentions.length;
  } catch {
    return 0;
  }
}
