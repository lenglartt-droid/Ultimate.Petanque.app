/**
 * Edge Function: send-push
 *
 * Server-side push notification dispatcher.
 * Receives a notification trigger type + context data,
 * determines recipients, and sends via Expo Push API.
 * Respects user notification preferences stored in user_preferences.notification_preferences.
 *
 * Trigger types:
 * - event_created       : Ambassador created a sponsored event → notify nearby users
 * - meetup_invitation    : User invited to a meetup → notify that user
 * - ranking_changed      : Leaderboard ranking changed → notify affected users
 * - share_request        : Match/challenge share request → notify recipient
 * - event_reminder       : Upcoming event reminder → notify participants
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendPushNotifications, buildPushMessage, haversineDistance } from '../_shared/push.ts';

const PROXIMITY_RADIUS_KM = 200;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { type, payload } = body;

    if (!type) {
      return new Response(JSON.stringify({ error: 'Missing type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-push] Trigger: ${type}, sender: ${user.id}`);

    let sent = 0;
    let errors = 0;

    // ---- Helper: check if a user has a specific notification type enabled ----
    // Caches results for the duration of this request to avoid repeated queries
    const _prefCache = new Map<string, Record<string, boolean>>();
    const isNotifEnabled = async (userId: string, notifType: string): Promise<boolean> => {
      if (_prefCache.has(userId)) {
        const prefs = _prefCache.get(userId)!;
        return prefs[notifType] !== false;
      }
      try {
        const { data } = await supabaseAdmin
          .from('user_preferences')
          .select('notification_preferences')
          .eq('user_id', userId)
          .single();
        const prefs = data?.notification_preferences || {};
        _prefCache.set(userId, prefs);
        return prefs[notifType] !== false; // Default: enabled
      } catch {
        return true;
      }
    };

    // Batch check: filter a set of user IDs by notification preference
    const filterByNotifPref = async (userIds: Set<string>, notifType: string): Promise<Set<string>> => {
      // Batch fetch all preferences at once for efficiency
      const uidArray = [...userIds];
      if (uidArray.length === 0) return new Set();
      const { data: prefsData } = await supabaseAdmin
        .from('user_preferences')
        .select('user_id, notification_preferences')
        .in('user_id', uidArray);

      const prefMap = new Map<string, Record<string, boolean>>();
      (prefsData || []).forEach((p: any) => {
        prefMap.set(p.user_id, p.notification_preferences || {});
        _prefCache.set(p.user_id, p.notification_preferences || {});
      });

      const filtered = new Set<string>();
      for (const uid of uidArray) {
        const prefs = prefMap.get(uid);
        // If no preferences row exists, default is all enabled
        if (!prefs || prefs[notifType] !== false) {
          filtered.add(uid);
        }
      }
      return filtered;
    };

    // ============================================================
    // EVENT_CREATED: Ambassador created a sponsored event
    // Supports targeted user IDs via `targetUserIds` array.
    // If `targetUserIds` is provided, only those users get notified.
    // Otherwise, falls back to geo-proximity (200km / same city).
    // ============================================================
    if (type === 'event_created') {
      const { eventId, eventTitle, city, country, latitude, longitude, challengeType, ambassadorName, targetUserIds } = payload || {};
      if (!eventId || !eventTitle) {
        return new Response(JSON.stringify({ error: 'Missing eventId/eventTitle' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let matchedUserIds = new Set<string>();

      if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
        // ---- TARGETED MODE: only send to specified users ----
        console.log(`[send-push] event_created: targeted mode, ${targetUserIds.length} user(s)`);
        targetUserIds.forEach((uid: string) => {
          if (uid !== user.id) matchedUserIds.add(uid);
        });
      } else {
        // ---- BROADCAST MODE: geo-proximity based ----
        const { data: tokens } = await supabaseAdmin
          .from('push_tokens')
          .select('user_id, token')
          .eq('active', true)
          .neq('user_id', user.id);

        if (!tokens || tokens.length === 0) {
          return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'no_tokens' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const userIds = [...new Set(tokens.map(t => t.user_id))];

        const { data: players } = await supabaseAdmin
          .from('players')
          .select('user_id, location, name')
          .in('user_id', userIds);

        const playerMap = new Map<string, any>();
        (players || []).forEach(p => {
          if (!playerMap.has(p.user_id)) playerMap.set(p.user_id, p);
        });

        for (const uid of userIds) {
          const player = playerMap.get(uid);
          if (!player?.location) {
            if (city) {
              const { data: userTerrains } = await supabaseAdmin
                .from('terrains').select('city').eq('user_id', uid).limit(5);
              const { data: userClubs } = await supabaseAdmin
                .from('clubs').select('city').eq('user_id', uid).limit(5);
              const userCities = [
                ...(userTerrains || []).map(t => t.city?.toLowerCase()),
                ...(userClubs || []).map(c => c.city?.toLowerCase()),
              ].filter(Boolean);
              if (userCities.includes(city.toLowerCase())) {
                matchedUserIds.add(uid);
              }
            }
            continue;
          }

          const playerLat = player.location.latitude;
          const playerLng = player.location.longitude;

          if (city && player.location.city?.toLowerCase() === city.toLowerCase()) {
            matchedUserIds.add(uid);
            continue;
          }

          if (latitude && longitude && playerLat && playerLng) {
            const dist = haversineDistance(latitude, longitude, playerLat, playerLng);
            if (dist <= PROXIMITY_RADIUS_KM) {
              matchedUserIds.add(uid);
            }
          }
        }
      }

      // Filter by notification preference
      const recipientUserIds = await filterByNotifPref(matchedUserIds, 'event_created');
      console.log(`[send-push] event_created: ${recipientUserIds.size} recipients (${matchedUserIds.size} matched, filtered by prefs)`);

      // Fetch tokens for recipients
      const { data: recipientTokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', [...recipientUserIds])
        .eq('active', true);

      if (!recipientTokens || recipientTokens.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'no_tokens' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const challengeLabel = challengeType === '10_tirs' ? '10 Tirs' : challengeType === '10_tirs_sautee' ? '10 Tirs sautes' : 'Precision';
      const messages = recipientTokens.map(t => buildPushMessage(
        t.token,
        `\u{1F3AF} Nouveau defi ambassadeur${city ? ` a ${city}` : ''} !`,
        `${ambassadorName || 'Un ambassadeur'} lance "${eventTitle}" (${challengeLabel}).${city ? ` Pres de chez vous !` : ''}`,
        { type: 'event_created', eventId },
        { channelId: 'tournament-reminders', priority: 'high' }
      ));

      const tickets = await sendPushNotifications(messages);
      sent = tickets.filter(t => t.status === 'ok').length;
      errors = tickets.filter(t => t.status === 'error').length;

      for (let i = 0; i < tickets.length; i++) {
        if (tickets[i].details?.error === 'DeviceNotRegistered') {
          const invalidToken = messages[i]?.to;
          if (invalidToken) {
            await supabaseAdmin.from('push_tokens').update({ active: false }).eq('token', invalidToken);
            console.log(`[send-push] Deactivated invalid token: ${invalidToken.substring(0, 30)}...`);
          }
        }
      }
    }

    // ============================================================
    // MEETUP_INVITATION: User invited to a meetup
    // ============================================================
    else if (type === 'meetup_invitation') {
      const { meetupId, meetupTitle, invitedUserId, inviterName, meetupDate, terrainName } = payload || {};
      if (!meetupId || !invitedUserId) {
        return new Response(JSON.stringify({ error: 'Missing meetupId/invitedUserId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check notification preference
      const enabled = await isNotifEnabled(invitedUserId, 'meetup_invitation');
      if (!enabled) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'user_disabled' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', invitedUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const dateStr = meetupDate ? new Date(meetupDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
        const messages = tokens.map(t => buildPushMessage(
          t.token,
          `\u{1F3AF} Invitation a un RDV petanque !`,
          `${inviterName || 'Un joueur'} vous invite a "${meetupTitle || 'RDV'}"${terrainName ? ` a ${terrainName}` : ''}${dateStr ? ` le ${dateStr}` : ''}.`,
          { type: 'meetup_invitation', meetupId },
          { channelId: 'share-requests', priority: 'high' }
        ));

        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter(t => t.status === 'ok').length;
        errors = tickets.filter(t => t.status === 'error').length;
      }
    }

    // ============================================================
    // RANKING_CHANGED: Notify users whose ranking has changed
    // ============================================================
    else if (type === 'ranking_changed') {
      const { changes } = payload || {};
      if (!changes || !Array.isArray(changes) || changes.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter by notification preference in batch
      const allUserIds = new Set<string>(changes.map((c: any) => c.userId));
      const enabledUserIds = await filterByNotifPref(allUserIds, 'ranking_changed');

      const filteredChanges = changes.filter((c: any) => enabledUserIds.has(c.userId));
      if (filteredChanges.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'all_disabled' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userIdsList = filteredChanges.map((c: any) => c.userId);
      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', userIdsList)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const tokensByUser = new Map<string, string[]>();
        tokens.forEach(t => {
          if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
          tokensByUser.get(t.user_id)!.push(t.token);
        });

        const messages: any[] = [];
        for (const change of filteredChanges) {
          const userTokens = tokensByUser.get(change.userId) || [];
          const isUp = change.direction === 'up';
          const icon = isUp ? '\u{1F4C8}' : '\u{1F4C9}';
          const verb = isUp ? 'monte' : 'descendu';
          const diff = Math.abs(change.newRank - change.oldRank);

          for (const tk of userTokens) {
            messages.push(buildPushMessage(
              tk,
              `${icon} Classement mis a jour !`,
              `Vous etes ${verb} de ${diff} place(s) : #${change.oldRank} \u2192 #${change.newRank}.`,
              { type: 'ranking_changed', newRank: change.newRank, oldRank: change.oldRank },
              { channelId: 'tournament-reminders' }
            ));
          }
        }

        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter(t => t.status === 'ok').length;
        errors = tickets.filter(t => t.status === 'error').length;
      }
    }

    // ============================================================
    // SHARE_REQUEST: Match/challenge share request
    // ============================================================
    else if (type === 'share_request') {
      const { recipientUserId, senderName, itemType, permission, itemSummary } = payload || {};
      if (!recipientUserId) {
        return new Response(JSON.stringify({ error: 'Missing recipientUserId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check notification preference
      const enabled = await isNotifEnabled(recipientUserId, 'share_request');
      if (!enabled) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'user_disabled' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', recipientUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const typeLabel = itemType === 'match' ? 'match' : 'defi';
        const permLabel = permission === 'write' ? 'modification' : 'lecture seule';
        const messages = tokens.map(t => buildPushMessage(
          t.token,
          `\u{1F3AF} ${senderName || 'Un joueur'} vous partage un ${typeLabel}`,
          `${itemSummary || 'Nouvelle demande de partage'} (${permLabel})`,
          { type: 'share_request', itemType },
          { channelId: 'share-requests', priority: 'high' }
        ));

        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter(t => t.status === 'ok').length;
        errors = tickets.filter(t => t.status === 'error').length;
      }
    }

    // ============================================================
    // EVENT_REMINDER: Remind participants of an upcoming event
    // ============================================================
    else if (type === 'event_reminder') {
      const { eventId, eventTitle, startTime } = payload || {};
      if (!eventId) {
        return new Response(JSON.stringify({ error: 'Missing eventId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: participants } = await supabaseAdmin
        .from('sponsored_event_participants')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('status', 'accepted');

      if (!participants || participants.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter by notification preference in batch
      const participantIds = new Set<string>(participants.map(p => p.user_id));
      const enabledIds = await filterByNotifPref(participantIds, 'event_reminder');

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', [...enabledIds])
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const dateStr = startTime ? new Date(startTime).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const messages = tokens.map(t => buildPushMessage(
          t.token,
          `\u26A1 Defi ambassadeur bientot !`,
          `"${eventTitle || 'Evenement'}" commence ${dateStr ? `le ${dateStr}` : 'bientot'}. Preparez-vous !`,
          { type: 'event_reminder', eventId },
          { channelId: 'tournament-reminders' }
        ));

        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter(t => t.status === 'ok').length;
        errors = tickets.filter(t => t.status === 'error').length;
      }
    }

    // ============================================================
    // WEEKLY_SUMMARY: Monday morning summary notification
    // ============================================================
    else if (type === 'weekly_summary') {
      const { summaries } = payload || {};
      // summaries: Array<{ userId, rank, matchesPlayed, wins, winRate, rankChange, rankDiff, previousRank }>
      if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter by notification preference
      const allUserIds = new Set<string>(summaries.map((s: any) => s.userId));
      const enabledUserIds = await filterByNotifPref(allUserIds, 'ranking_changed');

      const filteredSummaries = summaries.filter((s: any) => enabledUserIds.has(s.userId));
      if (filteredSummaries.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'all_disabled' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userIdsList = filteredSummaries.map((s: any) => s.userId);
      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', userIdsList)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const tokensByUser = new Map<string, string[]>();
        tokens.forEach(t => {
          if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
          tokensByUser.get(t.user_id)!.push(t.token);
        });

        const messages: any[] = [];
        for (const summary of filteredSummaries) {
          const userTokens = tokensByUser.get(summary.userId) || [];
          if (userTokens.length === 0) continue;

          const rankIcon = summary.rankChange === 'up' ? '\u{1F4C8}' : summary.rankChange === 'down' ? '\u{1F4C9}' : '\u{1F3C6}';
          let body = `${summary.matchesPlayed} matchs, ${summary.wins} victoires (${summary.winRate}%). `;
          if (summary.rankChange === 'up') {
            body += `Tu as gagne ${summary.rankDiff} place(s) : #${summary.rank} !`;
          } else if (summary.rankChange === 'down') {
            body += `Tu as perdu ${summary.rankDiff} place(s) : #${summary.rank}.`;
          } else if (summary.rankChange === 'same') {
            body += `Position stable : #${summary.rank}.`;
          } else {
            body += `Premiere apparition au classement : #${summary.rank} !`;
          }

          for (const tk of userTokens) {
            messages.push(buildPushMessage(
              tk,
              `${rankIcon} Resume de ta semaine`,
              body,
              { type: 'ranking_changed', newRank: summary.rank, weeklyReset: true },
              { channelId: 'tournament-reminders' }
            ));
          }
        }

        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter(t => t.status === 'ok').length;
        errors = tickets.filter(t => t.status === 'error').length;
      }
    }

    // ============================================================
    // TRUST_SCORE_IMPROVED: Notify user when trust score improves past threshold
    // ============================================================
    else if (type === 'trust_score_improved') {
      const { targetUserId, newScore, newLevel, previousScore } = payload || {};
      if (!targetUserId || newScore === undefined) {
        return new Response(JSON.stringify({ error: 'Missing targetUserId/newScore' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', targetUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const levelLabels: Record<string, { fr: string; en: string }> = {
          verified: { fr: 'Verifie', en: 'Verified' },
          high: { fr: 'Fiable', en: 'Trusted' },
          medium: { fr: 'Standard', en: 'Standard' },
        };
        const levelLabel = levelLabels[newLevel]?.fr || newLevel;
        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          `\u{1F6E1} Score de confiance ameliore !`,
          `Votre score est passe a ${newScore}/100 (${levelLabel}). Continuez a jouer avec d'autres joueurs !`,
          { type: 'trust_score_improved', newScore, newLevel },
          { channelId: 'tournament-reminders' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // TRUST_WEEKLY_TIP: Weekly tip for users with low trust score
    // ============================================================
    else if (type === 'trust_weekly_tip') {
      const { targets } = payload || {};
      // targets: Array<{ userId: string; score: number }>
      if (!targets || !Array.isArray(targets) || targets.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userIdsList = targets.map((t: any) => t.userId);
      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', userIdsList)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const tokensByUser = new Map<string, string[]>();
        tokens.forEach((t: any) => {
          if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
          tokensByUser.get(t.user_id)!.push(t.token);
        });

        const messages: any[] = [];
        for (const target of targets) {
          const userTokens = tokensByUser.get(target.userId) || [];
          for (const tk of userTokens) {
            messages.push(buildPushMessage(
              tk,
              `\u{1F4AA} Ameliorez votre fiabilite`,
              `Jouez des matchs avec d'autres utilisateurs pour augmenter votre score (${target.score}/100).`,
              { type: 'trust_score_improved' },
              { channelId: 'tournament-reminders' }
            ));
          }
        }

        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // WITNESS_REQUEST: Notify witness user about attestation request
    // ============================================================
    else if (type === 'witness_request') {
      const { witnessUserId, requesterName, matchId, matchSummary } = payload || {};
      if (!witnessUserId || !matchId) {
        return new Response(JSON.stringify({ error: 'Missing witnessUserId/matchId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', witnessUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          `\u{1F441} Demande d'attestation de match`,
          `${requesterName || 'Un joueur'} vous demande d'attester un match${matchSummary ? ` (${matchSummary})` : ''}. Acceptez pour valider le match a 2x.`,
          { type: 'witness_request', matchId, action: 'view' },
          { channelId: 'share-requests', priority: 'high' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // WITNESS_ATTESTED: Notify requester that witness attested match
    // ============================================================
    else if (type === 'witness_attested') {
      const { requesterUserId, witnessName, matchId } = payload || {};
      if (!requesterUserId || !matchId) {
        return new Response(JSON.stringify({ error: 'Missing requesterUserId/matchId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', requesterUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          `\u2705 Match atteste !`,
          `${witnessName || 'Un temoin'} a atteste votre match. Le poids de validation passe a 2.0x dans le classement.`,
          { type: 'witness_attested', matchId },
          { channelId: 'share-requests' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // SPONSOR_PUSH: Sponsor/partner sends push to nearby players
    // Gold: unlimited, Silver: 1/month (enforced client-side + DB tracking)
    // ============================================================
    else if (type === 'sponsor_push') {
      const { ambassadorId, ambassadorName, title: pushTitle, body: pushBody, radiusKm, city: sponsorCity } = payload || {};
      if (!ambassadorId || !pushTitle || !pushBody) {
        return new Response(JSON.stringify({ error: 'Missing ambassadorId/title/body' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify caller is the ambassador owner
      const { data: ambRecord } = await supabaseAdmin
        .from('ambassadors')
        .select('id, user_id, badge_type, ambassador_level')
        .eq('id', ambassadorId)
        .single();

      if (!ambRecord || ambRecord.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized: not ambassador owner' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check monthly limit for Silver (sponsor badge)
      if (ambRecord.badge_type === 'sponsor') {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { data: usageData } = await supabaseAdmin
          .from('ambassador_analytics')
          .select('id')
          .eq('ambassador_id', ambassadorId)
          .eq('event_type', 'sponsor_push')
          .gte('created_at', startOfMonth.toISOString());
        if (usageData && usageData.length >= 1) {
          return new Response(JSON.stringify({ error: 'Monthly push limit reached', sent: 0, errors: 0 }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else if (ambRecord.badge_type === 'ambassador') {
        // Ambassador push: Elite = unlimited, Confirmé = 1/month, Découverte = not allowed
        const ambLevel = ambRecord.ambassador_level || 'decouverte';
        if (ambLevel === 'decouverte') {
          return new Response(JSON.stringify({ error: 'Decouverte ambassadors cannot send push notifications. Upgrade to Confirme level.' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (ambLevel === 'confirme') {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          const { data: usageData } = await supabaseAdmin
            .from('ambassador_analytics')
            .select('id')
            .eq('ambassador_id', ambassadorId)
            .eq('event_type', 'sponsor_push')
            .gte('created_at', startOfMonth.toISOString());
          if (usageData && usageData.length >= 1) {
            return new Response(JSON.stringify({ error: 'Monthly push limit reached for Confirme level. Upgrade to Elite for unlimited.', sent: 0, errors: 0 }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        // Elite = unlimited, fall through
      } else if (ambRecord.badge_type !== 'gold_sponsor') {
        return new Response(JSON.stringify({ error: 'Bronze partners cannot send push notifications' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const targetRadius = radiusKm || 200;

      // Get all active push tokens (exclude sender)
      const { data: allTokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .eq('active', true)
        .neq('user_id', user.id);

      if (!allTokens || allTokens.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'no_tokens' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const allUserIds = [...new Set(allTokens.map(t => t.user_id))];

      // Get player locations for geo-filtering
      const { data: playerLocations } = await supabaseAdmin
        .from('players')
        .select('user_id, location')
        .in('user_id', allUserIds);

      const playerLocMap = new Map<string, any>();
      (playerLocations || []).forEach(p => {
        if (!playerLocMap.has(p.user_id) && p.location) playerLocMap.set(p.user_id, p.location);
      });

      // Also check terrains/clubs for users without direct location
      const usersWithoutLoc = allUserIds.filter(uid => !playerLocMap.has(uid));
      if (usersWithoutLoc.length > 0 && sponsorCity) {
        const { data: terrainCities } = await supabaseAdmin
          .from('terrains').select('user_id, city').in('user_id', usersWithoutLoc);
        const { data: clubCities } = await supabaseAdmin
          .from('clubs').select('user_id, city').in('user_id', usersWithoutLoc);
        const cityMap = new Map<string, Set<string>>();
        [...(terrainCities || []), ...(clubCities || [])].forEach((r: any) => {
          if (!cityMap.has(r.user_id)) cityMap.set(r.user_id, new Set());
          if (r.city) cityMap.get(r.user_id)!.add(r.city.toLowerCase());
        });
        // Mark city-matched users
        cityMap.forEach((cities, uid) => {
          if (cities.has(sponsorCity.toLowerCase())) {
            playerLocMap.set(uid, { city: sponsorCity });
          }
        });
      }

      // Get ambassador location for distance calc
      let ambLat: number | null = null;
      let ambLng: number | null = null;
      if (ambRecord) {
        const { data: ambPlayer } = await supabaseAdmin
          .from('players')
          .select('location')
          .eq('user_id', ambRecord.user_id)
          .limit(1)
          .maybeSingle();
        if (ambPlayer?.location?.latitude) {
          ambLat = ambPlayer.location.latitude;
          ambLng = ambPlayer.location.longitude;
        }
      }

      // Filter by geographic proximity
      const matchedUserIds = new Set<string>();
      for (const uid of allUserIds) {
        const loc = playerLocMap.get(uid);
        if (!loc) continue;

        // City match
        if (sponsorCity && loc.city?.toLowerCase() === sponsorCity.toLowerCase()) {
          matchedUserIds.add(uid);
          continue;
        }

        // Distance match
        if (ambLat && ambLng && loc.latitude && loc.longitude) {
          const dist = haversineDistance(ambLat, ambLng, loc.latitude, loc.longitude);
          if (dist <= targetRadius) {
            matchedUserIds.add(uid);
          }
        }
      }

      // Filter by notification preference
      const enabledUserIds = await filterByNotifPref(matchedUserIds, 'event_created');
      console.log(`[send-push] sponsor_push: ${enabledUserIds.size} recipients (${matchedUserIds.size} matched)`);

      // Build and send messages
      const { data: recipientTokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', [...enabledUserIds])
        .eq('active', true);

      if (!recipientTokens || recipientTokens.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'no_matching_tokens' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const messages = recipientTokens.map(t => buildPushMessage(
        t.token,
        pushTitle,
        pushBody,
        { type: 'sponsor_push', ambassadorId },
        { channelId: 'tournament-reminders', priority: 'high' }
      ));

      const tickets = await sendPushNotifications(messages);
      sent = tickets.filter(t => t.status === 'ok').length;
      errors = tickets.filter(t => t.status === 'error').length;

      // Deactivate invalid tokens
      for (let i = 0; i < tickets.length; i++) {
        if (tickets[i].details?.error === 'DeviceNotRegistered') {
          const invalidToken = messages[i]?.to;
          if (invalidToken) {
            await supabaseAdmin.from('push_tokens').update({ active: false }).eq('token', invalidToken);
          }
        }
      }
    }

    // ============================================================
    // AMBASSADOR_PROMOTION: Notify ambassador when promoted to next level
    // ============================================================
    else if (type === 'ambassador_promotion') {
      const { targetUserId, ambassadorName, newLevel, newLevelLabel } = payload || {};
      if (!targetUserId || !newLevel) {
        return new Response(JSON.stringify({ error: 'Missing targetUserId/newLevel' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', targetUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const levelEmoji = newLevel === 'elite' ? '\u{1F451}' : '\u{1F680}';
        const levelName = newLevelLabel || (newLevel === 'elite' ? 'Elite' : 'Confirme');
        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          `${levelEmoji} Niveau superieur atteint !`,
          `Felicitations ${ambassadorName || 'Ambassadeur'} ! Vous etes desormais ambassadeur ${levelName}. De nouveaux avantages vous attendent.`,
          { type: 'ambassador_promotion', newLevel },
          { channelId: 'tournament-reminders', priority: 'high' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // ELO_RANK_CHANGED: Notify user when ELO rank tier changes
    // ============================================================
    else if (type === 'elo_rank_changed') {
      const { targetUserId, playerName, oldRank, newRank, oldElo, newElo, direction } = payload || {};
      if (!targetUserId || !newRank) {
        return new Response(JSON.stringify({ error: 'Missing targetUserId/newRank' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check notification preference
      const enabled = await isNotifEnabled(targetUserId, 'ranking_changed');
      if (!enabled) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'user_disabled' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', targetUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const rankLabels: Record<string, { fr: string; en: string; emoji: string }> = {
          bronze: { fr: 'Bronze', en: 'Bronze', emoji: '\u{1F94E}' },
          silver: { fr: 'Argent', en: 'Silver', emoji: '\u{1FA99}' },
          gold: { fr: 'Or', en: 'Gold', emoji: '\u{1F3C5}' },
          diamond: { fr: 'Diamant', en: 'Diamond', emoji: '\u{1F48E}' },
          master: { fr: 'Maitre', en: 'Master', emoji: '\u{1F451}' },
        };
        const isPromotion = direction === 'up';
        const rankInfo = rankLabels[newRank] || rankLabels.bronze;
        const emoji = isPromotion ? rankInfo.emoji : '\u{1F4C9}';
        const title = isPromotion
          ? `${emoji} Nouveau rang ELO : ${rankInfo.fr} !`
          : `${emoji} Changement de rang ELO`;
        const body = isPromotion
          ? `Felicitations ! Votre ELO est passe a ${newElo} et vous atteignez le rang ${rankInfo.fr}. Continuez comme ca !`
          : `Votre ELO est descendu a ${newElo} (rang ${rankInfo.fr}). Rejouez pour remonter !`;

        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          title,
          body,
          { type: 'elo_rank_changed', newRank, newElo, oldRank, oldElo, direction },
          { channelId: 'tournament-reminders', priority: isPromotion ? 'high' : 'default' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // MAINTENANCE: Notify ALL users about upcoming/active maintenance
    // ============================================================
    else if (type === 'maintenance') {
      const { messageFr, messageEn, endTime } = payload || {};
      if (!messageFr && !messageEn) {
        return new Response(JSON.stringify({ error: 'Missing messageFr or messageEn' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify caller is admin
      const { data: adminProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!adminProfile?.is_admin) {
        return new Response(JSON.stringify({ error: 'Only admins can send maintenance notifications' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get ALL active push tokens
      const { data: allTokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .eq('active', true);

      if (!allTokens || allTokens.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'no_tokens' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[send-push] maintenance: sending to ${allTokens.length} tokens`);

      const endTimeStr = endTime
        ? new Date(endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';

      const messages = allTokens.map((t: any) => buildPushMessage(
        t.token,
        `\u{1F6A7} Maintenance programmee`,
        `${messageFr || messageEn}${endTimeStr ? ` Fin estimee : ${endTimeStr}.` : ''}`,
        { type: 'maintenance' },
        { channelId: 'tournament-reminders', priority: 'high' }
      ));

      // Send in batches of 100 to avoid Expo API limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        const tickets = await sendPushNotifications(batch);
        sent += tickets.filter((t: any) => t.status === 'ok').length;
        errors += tickets.filter((t: any) => t.status === 'error').length;

        // Deactivate invalid tokens
        for (let j = 0; j < tickets.length; j++) {
          if (tickets[j].details?.error === 'DeviceNotRegistered') {
            const invalidToken = batch[j]?.to;
            if (invalidToken) {
              await supabaseAdmin.from('push_tokens').update({ active: false }).eq('token', invalidToken);
            }
          }
        }
      }
    }

    // ============================================================
    // ANNOUNCEMENT: Admin sends targeted announcement push
    // ============================================================
    else if (type === 'announcement') {
      const { titleFr, titleEn, messageFr, messageEn, targetType, targetValue } = payload || {};
      if (!titleFr && !titleEn) {
        return new Response(JSON.stringify({ error: 'Missing title' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify caller is admin
      const { data: adminAnn } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!adminAnn?.is_admin) {
        return new Response(JSON.stringify({ error: 'Only admins can send announcements' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get ALL active push tokens first
      const { data: allAnnTokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .eq('active', true);

      if (!allAnnTokens || allAnnTokens.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'no_tokens' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let targetTokens = allAnnTokens;

      // Apply targeting filter
      if (targetType && targetType !== 'all' && targetValue) {
        const allUserIds = [...new Set(allAnnTokens.map((t: any) => t.user_id))];
        let matchedUserIds = new Set<string>();

        if (targetType === 'level') {
          // Filter by player level
          const { data: levelPlayers } = await supabaseAdmin
            .from('players')
            .select('user_id')
            .eq('level', targetValue)
            .in('user_id', allUserIds);
          (levelPlayers || []).forEach((p: any) => matchedUserIds.add(p.user_id));
        } else if (targetType === 'city') {
          // Filter by city from players location, terrains, or clubs
          const cityLower = targetValue.toLowerCase();
          for (const uid of allUserIds) {
            // Check player location
            const { data: pLoc } = await supabaseAdmin
              .from('players')
              .select('location')
              .eq('user_id', uid)
              .limit(1)
              .maybeSingle();
            if (pLoc?.location?.city?.toLowerCase() === cityLower) {
              matchedUserIds.add(uid);
              continue;
            }
            // Check terrains
            const { data: tCities } = await supabaseAdmin
              .from('terrains')
              .select('city')
              .eq('user_id', uid)
              .limit(5);
            if ((tCities || []).some((t: any) => t.city?.toLowerCase() === cityLower)) {
              matchedUserIds.add(uid);
              continue;
            }
            // Check clubs
            const { data: cCities } = await supabaseAdmin
              .from('clubs')
              .select('city')
              .eq('user_id', uid)
              .limit(5);
            if ((cCities || []).some((c: any) => c.city?.toLowerCase() === cityLower)) {
              matchedUserIds.add(uid);
            }
          }
        } else if (targetType === 'club') {
          // Filter by club name
          const clubLower = targetValue.toLowerCase();
          const { data: clubPlayers } = await supabaseAdmin
            .from('players')
            .select('user_id, club')
            .in('user_id', allUserIds);
          (clubPlayers || []).forEach((p: any) => {
            if (p.club?.toLowerCase() === clubLower) matchedUserIds.add(p.user_id);
          });
        }

        console.log(`[send-push] announcement: ${targetType}=${targetValue}, matched ${matchedUserIds.size} users`);
        targetTokens = allAnnTokens.filter((t: any) => matchedUserIds.has(t.user_id));
      }

      if (targetTokens.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'no_matching_users' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[send-push] announcement: sending to ${targetTokens.length} tokens`);

      const annTitle = titleFr || titleEn;
      const annBody = messageFr || messageEn;

      const BATCH_SIZE = 100;
      for (let i = 0; i < targetTokens.length; i += BATCH_SIZE) {
        const batch = targetTokens.slice(i, i + BATCH_SIZE).map((t: any) => buildPushMessage(
          t.token,
          `\u{1F4E2} ${annTitle}`,
          annBody,
          { type: 'announcement' },
          { channelId: 'tournament-reminders', priority: 'high' }
        ));
        const tickets = await sendPushNotifications(batch);
        sent += tickets.filter((t: any) => t.status === 'ok').length;
        errors += tickets.filter((t: any) => t.status === 'error').length;

        for (let j = 0; j < tickets.length; j++) {
          if (tickets[j].details?.error === 'DeviceNotRegistered') {
            const invalidToken = batch[j]?.to;
            if (invalidToken) {
              await supabaseAdmin.from('push_tokens').update({ active: false }).eq('token', invalidToken);
            }
          }
        }
      }
    }

    // ============================================================
    // MODERATION_ACTION: Notify reported player of admin action
    // ============================================================
    else if (type === 'moderation_action') {
      const { targetUserId, action, reason } = payload || {};
      if (!targetUserId || !action) {
        return new Response(JSON.stringify({ error: 'Missing targetUserId/action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify caller is admin
      const { data: adminMod } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!adminMod?.is_admin) {
        return new Response(JSON.stringify({ error: 'Only admins can send moderation notifications' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', targetUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const actionLabels: Record<string, { title: string; body: string }> = {
          warned: {
            title: '\u26A0\uFE0F Avertissement de moderation',
            body: 'Votre compte a recu un avertissement suite a un signalement. Veuillez respecter les regles de la communaute.',
          },
          suspended: {
            title: '\u{1F6D1} Compte suspendu',
            body: 'Votre compte a ete temporairement suspendu suite a un signalement. Contactez le support si necessaire.',
          },
          banned: {
            title: '\u{274C} Compte banni',
            body: 'Votre compte a ete banni pour non-respect des regles de la communaute.',
          },
        };
        const labels = actionLabels[action] || actionLabels.warned;

        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          labels.title,
          labels.body,
          { type: 'moderation_action', action, reason },
          { channelId: 'tournament-reminders', priority: 'high' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // MAINTENANCE_END: Notify ALL users that maintenance is over
    // ============================================================
    else if (type === 'maintenance_end') {
      const { messageFr, messageEn } = payload || {};

      // Verify caller is admin
      const { data: adminProfileEnd } = await supabaseAdmin
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!adminProfileEnd?.is_admin) {
        return new Response(JSON.stringify({ error: 'Only admins can send maintenance_end notifications' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get ALL active push tokens
      const { data: allEndTokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .eq('active', true);

      if (!allEndTokens || allEndTokens.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0, reason: 'no_tokens' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`[send-push] maintenance_end: sending to ${allEndTokens.length} tokens`);

      const endMsgFr = messageFr || 'L\'application est de nouveau operationnelle. Merci de votre patience !';
      const endMsgEn = messageEn || 'The application is back online. Thank you for your patience!';

      const messages = allEndTokens.map((t: any) => buildPushMessage(
        t.token,
        `\u2705 Maintenance terminee`,
        endMsgFr,
        { type: 'maintenance' },
        { channelId: 'tournament-reminders', priority: 'high' }
      ));

      const BATCH_SIZE = 100;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        const tickets = await sendPushNotifications(batch);
        sent += tickets.filter((t: any) => t.status === 'ok').length;
        errors += tickets.filter((t: any) => t.status === 'error').length;

        for (let j = 0; j < tickets.length; j++) {
          if (tickets[j].details?.error === 'DeviceNotRegistered') {
            const invalidToken = batch[j]?.to;
            if (invalidToken) {
              await supabaseAdmin.from('push_tokens').update({ active: false }).eq('token', invalidToken);
            }
          }
        }
      }
    }

    // ============================================================
    // CLUB_CLAIM: Notify club owner about a new ownership claim
    // ============================================================
    else if (type === 'club_claim') {
      const { ownerUserId, requesterName, clubName, clubId } = payload || {};
      if (!ownerUserId || !clubId) {
        return new Response(JSON.stringify({ error: 'Missing ownerUserId/clubId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', ownerUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          `\u{1F3E2} Revendication de club`,
          `${requesterName || 'Un utilisateur'} souhaite revendiquer la propriete de "${clubName || 'votre club'}". Consultez la demande.`,
          { type: 'club_claim', clubId },
          { channelId: 'share-requests', priority: 'high' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // CO_ADMIN: Notify user when added/removed as club co-admin
    // ============================================================
    else if (type === 'co_admin') {
      const { targetUserId, clubName, clubId, action: coAction, adderName } = payload || {};
      if (!targetUserId || !clubId) {
        return new Response(JSON.stringify({ error: 'Missing targetUserId/clubId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', targetUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const isAdded = coAction === 'added';
        const title = isAdded
          ? `\u{1F3E2} Vous etes co-admin !`
          : `\u{1F3E2} Co-admin retire`;
        const body = isAdded
          ? `${adderName || 'Le proprietaire'} vous a ajoute comme co-administrateur de "${clubName || 'un club'}".`
          : `Vous avez ete retire comme co-administrateur de "${clubName || 'un club'}".`;

        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          title,
          body,
          { type: 'club_claim', clubId },
          { channelId: 'share-requests', priority: 'high' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    // ============================================================
    // BAN_APPEAL_RESPONSE: Notify banned user about appeal decision
    // ============================================================
    else if (type === 'ban_appeal_response') {
      const { targetUserId, appealStatus, adminResponse: appealMsg } = payload || {};
      if (!targetUserId || !appealStatus) {
        return new Response(JSON.stringify({ error: 'Missing targetUserId/appealStatus' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', targetUserId)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const isAccepted = appealStatus === 'accepted';
        const title = isAccepted
          ? `\u2705 Appel accepte - Compte reactif !`
          : `\u274C Appel rejete`;
        const body = isAccepted
          ? `Votre appel de ban a ete accepte. Votre compte est de nouveau actif.${appealMsg ? ` Message: ${appealMsg}` : ''}`
          : `Votre appel de ban a ete rejete.${appealMsg ? ` Raison: ${appealMsg}` : ' Contactez le support pour plus d\'informations.'}`;

        const messages = tokens.map((t: any) => buildPushMessage(
          t.token,
          title,
          body,
          { type: 'moderation_action', action: isAccepted ? 'unbanned' : 'appeal_rejected' },
          { channelId: 'tournament-reminders', priority: 'high' }
        ));
        const tickets = await sendPushNotifications(messages);
        sent = tickets.filter((t: any) => t.status === 'ok').length;
        errors = tickets.filter((t: any) => t.status === 'error').length;
      }
    }

    else {
      return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-push] Done: ${sent} sent, ${errors} errors`);

    return new Response(
      JSON.stringify({ sent, errors }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[send-push] Fatal error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
