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
    const tasks = body.tasks || ['cleanup_tokens', 'cleanup_shares', 'engagement_reminders', 'cleanup_analytics', 'sponsor_digest', 'process_scheduled_pushes'];

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
    // TASK 4: Sponsor Weekly Digest Email
    // ============================================================
    if (tasks.includes('sponsor_digest')) {
      console.log('[weekly-cron] Sending sponsor weekly digests...');

      try {
        // Get all active sponsors/partners
        const { data: sponsors } = await supabaseAdmin
          .from('ambassadors')
          .select('id, user_id, display_name, badge_type, ambassador_level, photo, brand_color')
          .eq('is_active', true)
          .in('badge_type', ['gold_sponsor', 'sponsor', 'partner']);

        if (sponsors && sponsors.length > 0) {
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          let digestsSent = 0;

          for (const sp of sponsors) {
            try {
              // Get this week's analytics for the sponsor
              const { data: weekEvents } = await supabaseAdmin
                .from('ambassador_analytics')
                .select('event_type, source_page')
                .eq('ambassador_id', sp.id)
                .gte('created_at', weekAgo.toISOString());

              if (!weekEvents || weekEvents.length === 0) continue;

              // Compute KPIs
              const impressions = weekEvents.filter(e => e.event_type === 'banner_impression').length;
              const clicks = weekEvents.filter(e => e.event_type === 'profile_view').length;
              const socialClicks = weekEvents.filter(e => e.event_type === 'social_click').length;
              const pushes = weekEvents.filter(e => e.event_type === 'sponsor_push').length;
              const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0';

              // Get previous week for comparison
              const twoWeeksAgo = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
              const { data: prevWeekEvents } = await supabaseAdmin
                .from('ambassador_analytics')
                .select('event_type')
                .eq('ambassador_id', sp.id)
                .gte('created_at', twoWeeksAgo.toISOString())
                .lt('created_at', weekAgo.toISOString());

              const prevImpressions = prevWeekEvents?.filter(e => e.event_type === 'banner_impression').length || 0;
              const prevClicks = prevWeekEvents?.filter(e => e.event_type === 'profile_view').length || 0;

              const impChange = prevImpressions > 0 ? Math.round(((impressions - prevImpressions) / prevImpressions) * 100) : 0;
              const clkChange = prevClicks > 0 ? Math.round(((clicks - prevClicks) / prevClicks) * 100) : 0;

              const impArrow = impChange > 0 ? '▲' : impChange < 0 ? '▼' : '→';
              const clkArrow = clkChange > 0 ? '▲' : clkChange < 0 ? '▼' : '→';
              const impColor = impChange > 0 ? '#10B981' : impChange < 0 ? '#EF4444' : '#94A3B8';
              const clkColor = clkChange > 0 ? '#10B981' : clkChange < 0 ? '#EF4444' : '#94A3B8';

              const tierColor = sp.brand_color || (sp.badge_type === 'gold_sponsor' ? '#D4A017' : '#78909C');
              const tierLabel = sp.badge_type === 'gold_sponsor' ? 'GOLD PARTNER' : sp.badge_type === 'sponsor' ? 'SILVER PARTNER' : 'PARTNER';

              // Build push notification with digest summary
              const { data: tokens } = await supabaseAdmin
                .from('push_tokens')
                .select('token')
                .eq('user_id', sp.user_id)
                .eq('active', true);

              if (tokens && tokens.length > 0) {
                // Build rich digest content
                const weekLabel = `${weekAgo.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
                const title = `\u{1F4CA} Recap hebdo | ${sp.display_name}`;
                const bodyLines = [
                  `${impressions} impressions ${impArrow}${Math.abs(impChange)}%`,
                  `${clicks} clics ${clkArrow}${Math.abs(clkChange)}%`,
                  `CTR: ${ctr}% | Push: ${pushes}`,
                ].join(' \u2022 ');
                const body = bodyLines;

                const messages = tokens.map(t => buildPushMessage(
                  t.token,
                  title,
                  body,
                  { type: 'sponsor_digest', sponsorId: sp.id },
                  { channelId: 'sponsor-updates' }
                ));

                await sendPushNotifications(messages);
                digestsSent++;

                // ---- Build HTML Digest Email Template ----
                const profileUrl = `https://ultimatepetanque.app/partners?id=${sp.id}`;
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(profileUrl)}&color=${(tierColor).replace('#', '')}`;
                const impChangeAbs = Math.abs(impChange);
                const clkChangeAbs = Math.abs(clkChange);
                const digestHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;color:#0F172A;}
  .wrapper{max-width:600px;margin:0 auto;background:#FFF;border-radius:16px;overflow:hidden;}
  .hero{background:linear-gradient(135deg,${tierColor},${tierColor}CC);padding:32px 24px;text-align:center;}
  .hero-logo{width:64px;height:64px;border-radius:18px;border:3px solid rgba(255,255,255,0.3);object-fit:cover;display:inline-block;}
  .hero-fallback{width:64px;height:64px;border-radius:18px;background:rgba(255,255,255,0.2);display:inline-flex;align-items:center;justify-content:center;color:#FFF;font-size:28px;font-weight:900;}
  .hero h1{color:#FFF;font-size:22px;font-weight:800;margin:12px 0 4px;}
  .hero p{color:rgba(255,255,255,0.8);font-size:13px;margin:0;}
  .badge{display:inline-block;background:rgba(255,255,255,0.2);color:#FFF;font-size:9px;font-weight:800;padding:3px 10px;border-radius:8px;letter-spacing:0.5px;margin-top:8px;}
  .kpi-row{display:flex;gap:8px;padding:24px 20px 8px;}
  .kpi{flex:1;background:#F8FAFC;border-radius:14px;padding:16px 8px;text-align:center;border:1px solid #E2E8F0;}
  .kpi-val{font-size:26px;font-weight:900;color:#0F172A;line-height:1.2;}
  .kpi-label{font-size:9px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;}
  .kpi-change{font-size:10px;font-weight:800;margin-top:4px;}
  .section{padding:16px 20px;}
  .section-title{font-size:14px;font-weight:700;color:#0F172A;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #E2E8F0;}
  .trend-row{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
  .trend-label{font-size:12px;color:#64748B;flex:1;}
  .trend-val{font-size:14px;font-weight:800;}
  .bar-track{flex:2;height:8px;background:#F1F5F9;border-radius:4px;overflow:hidden;}
  .bar-fill{height:100%;border-radius:4px;}
  .cta-section{padding:20px;text-align:center;background:#F8FAFC;}
  .cta-btn{display:inline-block;background:${tierColor};color:#FFF;font-size:14px;font-weight:700;padding:14px 32px;border-radius:14px;text-decoration:none;}
  .footer{padding:16px 20px;text-align:center;border-top:1px solid #E2E8F0;}
  .footer p{font-size:11px;color:#94A3B8;margin:4px 0;}
  .qr-block{display:inline-block;padding:12px;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;margin-top:8px;}
</style>
</head>
<body>
<div class="wrapper">
  <div class="hero">
    ${sp.photo ? `<img src="${sp.photo}" class="hero-logo" alt="${sp.display_name}" />` : `<div class="hero-fallback">${(sp.display_name||'S').charAt(0)}</div>`}
    <h1>Recap Hebdomadaire</h1>
    <p>${weekLabel}</p>
    <div class="badge">${tierLabel}</div>
  </div>
  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-val">${impressions}</div>
      <div class="kpi-label">Impressions</div>
      <div class="kpi-change" style="color:${impColor}">${impArrow} ${impChangeAbs}%</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">${clicks}</div>
      <div class="kpi-label">Clics</div>
      <div class="kpi-change" style="color:${clkColor}">${clkArrow} ${clkChangeAbs}%</div>
    </div>
    <div class="kpi">
      <div class="kpi-val" style="color:${tierColor}">${ctr}%</div>
      <div class="kpi-label">CTR</div>
    </div>
    <div class="kpi">
      <div class="kpi-val" style="color:#7C3AED">${pushes}</div>
      <div class="kpi-label">Push</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Performance vs semaine precedente</div>
    <div class="trend-row">
      <span class="trend-label">Impressions</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(5,impressions/(prevImpressions||1)*50))}%;background:#3B82F6"></div></div>
      <span class="trend-val" style="color:#3B82F6">${impressions}</span>
    </div>
    <div class="trend-row">
      <span class="trend-label">Clics</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(5,clicks/(prevClicks||1)*50))}%;background:#10B981"></div></div>
      <span class="trend-val" style="color:#10B981">${clicks}</span>
    </div>
    <div class="trend-row">
      <span class="trend-label">Social</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Math.max(5,socialClicks*10))}%;background:#7C3AED"></div></div>
      <span class="trend-val" style="color:#7C3AED">${socialClicks}</span>
    </div>
  </div>
  <div class="cta-section">
    <a href="${profileUrl}" class="cta-btn">Voir le portail sponsor &rarr;</a>
    <div class="qr-block">
      <img src="${qrUrl}" width="80" height="80" alt="QR" style="display:block;margin:0 auto 4px" />
      <p style="font-size:9px;color:#94A3B8;margin:0">Scannez pour ouvrir</p>
    </div>
  </div>
  <div class="footer">
    <p><strong>Ultimate Petanque</strong> &middot; Digest automatique</p>
    <p>Genere le ${now.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</p>
  </div>
</div>
</body>
</html>`;

                // Store the HTML template for later retrieval
                await supabaseAdmin.from('ambassador_analytics').insert({
                  ambassador_id: sp.id,
                  event_type: 'digest_email_html',
                  source_page: digestHtml.substring(0, 10000),
                  viewer_id: sp.user_id,
                }).catch(() => {});
              }

              // Log digest event
              await supabaseAdmin.from('ambassador_analytics').insert({
                ambassador_id: sp.id,
                event_type: 'weekly_digest',
                source_page: `imp:${impressions}|clk:${clicks}|ctr:${ctr}|push:${pushes}`,
                viewer_id: sp.user_id,
              }).catch(() => {});

            } catch (spErr) {
              console.error(`[weekly-cron] Digest error for ${sp.display_name}:`, spErr);
            }
          }

          console.log(`[weekly-cron] Sponsor digests sent: ${digestsSent}/${sponsors.length}`);
          results.sponsor_digest = { sent: digestsSent, total_sponsors: sponsors.length };
        } else {
          results.sponsor_digest = { sent: 0, reason: 'no_active_sponsors' };
        }
      } catch (digestErr: any) {
        console.error('[weekly-cron] Sponsor digest task error:', digestErr.message);
        results.sponsor_digest = { error: digestErr.message };
      }
    }

    // ============================================================
    // TASK 5: Process Scheduled Push Notifications
    // ============================================================
    if (tasks.includes('process_scheduled_pushes')) {
      console.log('[weekly-cron] Processing scheduled push notifications...');
      try {
        const now = new Date().toISOString();

        // Find all scheduled pushes that are due (event_type = 'scheduled_push')
        const { data: scheduledPushes } = await supabaseAdmin
          .from('ambassador_analytics')
          .select('id, ambassador_id, source_page, social_platform')
          .eq('event_type', 'scheduled_push')
          .limit(50);

        let processed = 0;
        if (scheduledPushes && scheduledPushes.length > 0) {
          for (const sp of scheduledPushes) {
            try {
              // Parse source_page: title|body|scheduledIso|city|radius
              const parts = (sp.source_page || '').split('|');
              const title = parts[0] || 'Push';
              const body = parts[1] || '';
              const scheduledFor = parts[2] || '';
              const city = parts[3] || '';
              const radius = parseInt(parts[4]) || 200;

              // Check if it's time to send
              if (!scheduledFor || new Date(scheduledFor) > new Date()) continue;

              // Get ambassador info
              const { data: amb } = await supabaseAdmin
                .from('ambassadors')
                .select('id, display_name, user_id')
                .eq('id', sp.ambassador_id)
                .maybeSingle();

              if (!amb) continue;

              // Get push tokens to send to
              const { data: tokens } = await supabaseAdmin
                .from('push_tokens')
                .select('token')
                .eq('active', true)
                .limit(500);

              if (tokens && tokens.length > 0) {
                // For A/B tests, only send to half the audience per variant
                const isVariant = sp.social_platform === 'variant_a' || sp.social_platform === 'variant_b';
                const targetTokens = isVariant
                  ? tokens.filter((_, idx) => sp.social_platform === 'variant_a' ? idx % 2 === 0 : idx % 2 === 1)
                  : tokens;

                const messages = targetTokens.map(t => buildPushMessage(
                  t.token,
                  title,
                  body,
                  { type: 'sponsor_push', ambassadorId: amb.id, ambassadorName: amb.display_name },
                  { channelId: 'sponsor-updates' }
                ));

                if (messages.length > 0) {
                  const tickets = await sendPushNotifications(messages);
                  const sent = tickets.filter(t => t.status === 'ok').length;
                  console.log(`[weekly-cron] Scheduled push sent: ${sent}/${messages.length} for ${amb.display_name}`);
                }
              }

              // Mark as sent by converting event_type to sponsor_push
              await supabaseAdmin
                .from('ambassador_analytics')
                .update({ event_type: 'sponsor_push' })
                .eq('id', sp.id);

              processed++;
            } catch (spErr) {
              console.error(`[weekly-cron] Error processing scheduled push ${sp.id}:`, spErr);
            }
          }
        }

        console.log(`[weekly-cron] Processed ${processed} scheduled pushes`);
        results.process_scheduled_pushes = { processed };
      } catch (schedErr: any) {
        console.error('[weekly-cron] Scheduled push task error:', schedErr.message);
        results.process_scheduled_pushes = { error: schedErr.message };
      }
    }

    // ============================================================
    // TASK 6: Clean up old analytics (older than 365 days)
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
