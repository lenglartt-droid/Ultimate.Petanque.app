/**
 * Edge Function: weekly-cron
 *
 * Scheduled maintenance tasks (call weekly or daily):
 * 1. Clean up inactive/expired push tokens (older than 90 days with no update)
 * 2. Send weekly engagement reminders to inactive users
 * 3. Clean up expired shared items
 * 4. Clean up old ambassador analytics (older than 1 year)
 *
 * This function uses the service role key and does NOT require user auth.
 * Trigger via: scheduled cron, admin button, or manual invocation.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { sendPushNotifications, buildPushMessage } from '../_shared/push.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Optional: verify caller via auth header or secret key
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    let isAdmin = false;

    if (token) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        isAdmin = profile?.is_admin === true;
      }
    }

    // Parse body for specific tasks
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const tasks = body.tasks || ['cleanup_tokens', 'cleanup_shares', 'engagement_reminders', 'cleanup_analytics'];

    const results: Record<string, any> = {};

    // ============================================================
    // TASK 1: Clean up stale push tokens (no update for 90+ days)
    // ============================================================
    if (tasks.includes('cleanup_tokens')) {
      console.log('[weekly-cron] Cleaning up stale push tokens...');
      const threshold90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      // Deactivate tokens not updated in 90 days
      const { data: staleTokens, error: staleErr } = await supabaseAdmin
        .from('push_tokens')
        .select('id, token')
        .eq('active', true)
        .lt('updated_at', threshold90d);

      if (!staleErr && staleTokens && staleTokens.length > 0) {
        const ids = staleTokens.map(t => t.id);
        await supabaseAdmin
          .from('push_tokens')
          .update({ active: false, updated_at: new Date().toISOString() })
          .in('id', ids);
        console.log(`[weekly-cron] Deactivated ${ids.length} stale push tokens`);
        results.cleanup_tokens = { deactivated: ids.length };
      } else {
        results.cleanup_tokens = { deactivated: 0 };
      }

      // Also remove tokens that have been inactive for 180+ days (hard delete)
      const threshold180d = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const { data: veryOld } = await supabaseAdmin
        .from('push_tokens')
        .select('id')
        .eq('active', false)
        .lt('updated_at', threshold180d);

      if (veryOld && veryOld.length > 0) {
        // Note: We don't hard delete user data, just log
        console.log(`[weekly-cron] Found ${veryOld.length} tokens inactive for 180+ days (not deleted per policy)`);
        results.cleanup_tokens.very_old_count = veryOld.length;
      }
    }

    // ============================================================
    // TASK 2: Clean up expired shared items
    // ============================================================
    if (tasks.includes('cleanup_shares')) {
      console.log('[weekly-cron] Cleaning up expired shared items...');
      const now = new Date().toISOString();

      const { data: expired } = await supabaseAdmin
        .from('shared_items')
        .select('id')
        .not('expires_at', 'is', null)
        .lt('expires_at', now);

      if (expired && expired.length > 0) {
        // Deactivate by setting is_public_link to false (soft approach)
        const ids = expired.map(s => s.id);
        await supabaseAdmin
          .from('shared_items')
          .update({ is_public_link: false })
          .in('id', ids);
        console.log(`[weekly-cron] Expired ${ids.length} shared items`);
        results.cleanup_shares = { expired: ids.length };
      } else {
        results.cleanup_shares = { expired: 0 };
      }
    }

    // ============================================================
    // TASK 3: Send engagement reminders to inactive users
    // (Users who haven't played in 7+ days but have active tokens)
    // ============================================================
    if (tasks.includes('engagement_reminders')) {
      console.log('[weekly-cron] Sending engagement reminders...');

      const threshold7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const threshold30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get users with active push tokens
      const { data: activeTokenUsers } = await supabaseAdmin
        .from('push_tokens')
        .select('user_id, token')
        .eq('active', true);

      if (!activeTokenUsers || activeTokenUsers.length === 0) {
        results.engagement_reminders = { sent: 0, reason: 'no_active_tokens' };
      } else {
        const userIds = [...new Set(activeTokenUsers.map(t => t.user_id))];
        const tokensByUser = new Map<string, string[]>();
        activeTokenUsers.forEach(t => {
          if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
          tokensByUser.get(t.user_id)!.push(t.token);
        });

        // Find users who had no matches or challenges in the last 7 days
        const { data: recentMatches } = await supabaseAdmin
          .from('matches')
          .select('user_id')
          .in('user_id', userIds)
          .gte('created_at', threshold7d);

        const { data: recentChallenges } = await supabaseAdmin
          .from('challenges')
          .select('user_id')
          .in('user_id', userIds)
          .gte('created_at', threshold7d);

        const activeUserIds = new Set<string>();
        (recentMatches || []).forEach(m => activeUserIds.add(m.user_id));
        (recentChallenges || []).forEach(c => activeUserIds.add(c.user_id));

        // Inactive = has token but no recent activity
        const inactiveUserIds = userIds.filter(uid => !activeUserIds.has(uid));

        // Don't spam: only users who haven't received this in 7 days
        // We use the analytics table to track last engagement reminder
        const { data: recentReminders } = await supabaseAdmin
          .from('ambassador_analytics')
          .select('viewer_id')
          .eq('event_type', 'engagement_reminder')
          .gte('created_at', threshold7d);

        const recentlyRemindedIds = new Set<string>((recentReminders || []).map((r: any) => r.viewer_id).filter(Boolean));
        const eligibleUserIds = inactiveUserIds.filter(uid => !recentlyRemindedIds.has(uid));

        // Check notification preferences
        const { data: prefData } = await supabaseAdmin
          .from('user_preferences')
          .select('user_id, notification_preferences')
          .in('user_id', eligibleUserIds);

        const prefMap = new Map<string, any>();
        (prefData || []).forEach((p: any) => prefMap.set(p.user_id, p.notification_preferences || {}));

        const finalUserIds = eligibleUserIds.filter(uid => {
          const prefs = prefMap.get(uid);
          return !prefs || prefs.event_reminder !== false;
        });

        // Limit to 100 users per cron run to avoid Expo push limits
        const batch = finalUserIds.slice(0, 100);

        if (batch.length > 0) {
          const messages: any[] = [];
          const reminderMessages = [
            { title: '\u{1F3AF} Vos boules attendent !', body: 'Pas de partie depuis 7 jours. Lancez un match ou un defi pour maintenir votre classement !' },
            { title: '\u{1F4AA} Revenez sur le terrain !', body: 'Votre streak est en danger ! Jouez une partie pour ne pas perdre votre serie.' },
            { title: '\u{1F3C6} Le classement evolue sans vous', body: 'Vos rivaux jouent sans relache. Revenez defendre votre position !' },
          ];
          const msgIdx = Math.floor(Math.random() * reminderMessages.length);
          const msg = reminderMessages[msgIdx];

          for (const uid of batch) {
            const tokens = tokensByUser.get(uid) || [];
            for (const tk of tokens) {
              messages.push(buildPushMessage(
                tk,
                msg.title,
                msg.body,
                { type: 'retention', action: 'play_match' },
                { channelId: 'tournament-reminders' }
              ));
            }
          }

          const tickets = await sendPushNotifications(messages);
          const sent = tickets.filter(t => t.status === 'ok').length;
          const errors = tickets.filter(t => t.status === 'error').length;

          // Track reminders sent (for dedup next week)
          const reminderRows = batch.map(uid => ({
            ambassador_id: '00000000-0000-0000-0000-000000000000', // system placeholder
            event_type: 'engagement_reminder',
            viewer_id: uid,
            source_page: 'weekly_cron',
          }));

          // Insert in chunks of 50
          for (let i = 0; i < reminderRows.length; i += 50) {
            await supabaseAdmin.from('ambassador_analytics').insert(reminderRows.slice(i, i + 50)).catch(() => {});
          }

          // Deactivate invalid tokens
          for (let i = 0; i < tickets.length; i++) {
            if (tickets[i].details?.error === 'DeviceNotRegistered') {
              const invalidToken = messages[i]?.to;
              if (invalidToken) {
                await supabaseAdmin.from('push_tokens').update({ active: false }).eq('token', invalidToken);
              }
            }
          }

          console.log(`[weekly-cron] Engagement reminders: ${sent} sent, ${errors} errors, ${batch.length} users`);
          results.engagement_reminders = { sent, errors, eligible: batch.length, total_inactive: inactiveUserIds.length };
        } else {
          results.engagement_reminders = { sent: 0, reason: 'no_eligible_users', total_inactive: inactiveUserIds.length };
        }
      }
    }

    // ============================================================
    // TASK 4: Clean up old analytics (older than 365 days)
    // ============================================================
    if (tasks.includes('cleanup_analytics')) {
      console.log('[weekly-cron] Cleaning up old analytics...');
      const threshold365d = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

      // Count old records (we don't delete user data, but we can count)
      const { data: oldAnalytics } = await supabaseAdmin
        .from('ambassador_analytics')
        .select('id')
        .lt('created_at', threshold365d)
        .limit(1000);

      const count = oldAnalytics?.length || 0;
      console.log(`[weekly-cron] Found ${count} analytics records older than 1 year (retention notice only)`);
      results.cleanup_analytics = { old_records: count, action: 'logged_only' };
    }

    console.log('[weekly-cron] All tasks completed:', JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[weekly-cron] Fatal error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
