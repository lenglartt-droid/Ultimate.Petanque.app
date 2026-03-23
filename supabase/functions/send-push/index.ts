/**
 * Edge Function: send-push
 *
 * Server-side push notification dispatcher.
 * Receives a notification trigger type + context data,
 * determines recipients, and sends via Expo Push API.
 *
 * Trigger types:
 * - event_created       : Ambassador created a sponsored event → notify nearby users
 * - meetup_created       : User created a meetup → notify invited users
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

    // ============================================================
    // EVENT_CREATED: Ambassador created a sponsored event
    // Notify users within 200km of event location or same city
    // ============================================================
    if (type === 'event_created') {
      const { eventId, eventTitle, city, country, latitude, longitude, challengeType, ambassadorName } = payload || {};
      if (!eventId || !eventTitle) {
        return new Response(JSON.stringify({ error: 'Missing eventId/eventTitle' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all users with push tokens (excluding the creator)
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

      // Get unique user IDs
      const userIds = [...new Set(tokens.map(t => t.user_id))];

      // Get player profiles with location for proximity check
      const { data: players } = await supabaseAdmin
        .from('players')
        .select('user_id, location, name')
        .in('user_id', userIds);

      const playerMap = new Map<string, any>();
      (players || []).forEach(p => {
        if (!playerMap.has(p.user_id)) playerMap.set(p.user_id, p);
      });

      // Determine recipients: city match OR within 200km
      const recipientUserIds = new Set<string>();

      for (const uid of userIds) {
        const player = playerMap.get(uid);
        if (!player?.location) {
          // No location data → include if same city name match
          if (city) {
            // Check user's terrains or clubs for city match
            const { data: userTerrains } = await supabaseAdmin
              .from('terrains')
              .select('city')
              .eq('user_id', uid)
              .limit(5);

            const { data: userClubs } = await supabaseAdmin
              .from('clubs')
              .select('city')
              .eq('user_id', uid)
              .limit(5);

            const userCities = [
              ...(userTerrains || []).map(t => t.city?.toLowerCase()),
              ...(userClubs || []).map(c => c.city?.toLowerCase()),
            ].filter(Boolean);

            if (userCities.includes(city.toLowerCase())) {
              recipientUserIds.add(uid);
            }
          }
          continue;
        }

        const playerLat = player.location.latitude;
        const playerLng = player.location.longitude;

        // City match (case-insensitive)
        if (city && player.location.city?.toLowerCase() === city.toLowerCase()) {
          recipientUserIds.add(uid);
          continue;
        }

        // Proximity check
        if (latitude && longitude && playerLat && playerLng) {
          const dist = haversineDistance(latitude, longitude, playerLat, playerLng);
          if (dist <= PROXIMITY_RADIUS_KM) {
            recipientUserIds.add(uid);
          }
        }
      }

      console.log(`[send-push] event_created: ${recipientUserIds.size} recipients within ${PROXIMITY_RADIUS_KM}km or city "${city}"`);

      // Build messages
      const challengeLabel = challengeType === '10_tirs' ? '10 Tirs' : challengeType === '10_tirs_sautee' ? '10 Tirs sautes' : 'Precision';
      const messages = tokens
        .filter(t => recipientUserIds.has(t.user_id))
        .map(t => buildPushMessage(
          t.token,
          `\u{1F3AF} Nouveau defi ambassadeur${city ? ` a ${city}` : ''} !`,
          `${ambassadorName || 'Un ambassadeur'} lance "${eventTitle}" (${challengeLabel}).${city ? ` Pres de chez vous !` : ''}`,
          { type: 'event_created', eventId },
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
      // changes: Array<{ userId, oldRank, newRank, direction: 'up'|'down' }>
      if (!changes || !Array.isArray(changes) || changes.length === 0) {
        return new Response(JSON.stringify({ sent: 0, errors: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const userIds = changes.map((c: any) => c.userId);
      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', userIds)
        .eq('active', true);

      if (tokens && tokens.length > 0) {
        const tokensByUser = new Map<string, string[]>();
        tokens.forEach(t => {
          if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
          tokensByUser.get(t.user_id)!.push(t.token);
        });

        const messages: any[] = [];
        for (const change of changes) {
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
          `${itemSummary || `Nouvelle demande de partage`} (${permLabel})`,
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

      // Get all accepted participants
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

      const participantIds = participants.map(p => p.user_id);
      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', participantIds)
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
