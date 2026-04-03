/**
 * admin-stats Edge Function
 * 
 * Aggregates all admin dashboard statistics in a single server-side request
 * instead of 16+ parallel client-side queries. Returns counts, weekly matches,
 * ELO distribution, monthly growth, moderation stats, and smart alerts.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is admin
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin status
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run all queries in parallel using service role (bypasses RLS)
    const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      usersRes,
      playersCountRes,
      terrainsCountRes,
      clubsCountRes,
      matchesCountRes,
      reportsRes,
      announcementsCountRes,
      suspiciousRes,
      appealsRes,
      weeklyMatchesRes,
      eloPlayersRes,
      clubsFullRes,
      userGrowthRes,
      pushLogsRes,
      activityLogsRes,
      appConfigRes,
    ] = await Promise.all([
      supabaseAdmin.from('user_profiles').select('id, is_premium, created_at, consent_date'),
      supabaseAdmin.from('players').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('terrains').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('clubs').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('matches').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('player_reports').select('status'),
      supabaseAdmin.from('announcements').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('suspicious_players').select('id, status'),
      supabaseAdmin.from('ban_appeals').select('id, status, created_at').order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('matches').select('date').gte('date', eightWeeksAgo),
      supabaseAdmin.from('players').select('elo_rating'),
      supabaseAdmin.from('clubs').select('id, name, city, members_count, is_public, is_verified'),
      supabaseAdmin.from('user_profiles').select('created_at, consent_date').order('created_at', { ascending: true }),
      supabaseAdmin.from('announcements').select('push_sent_count, push_error_count, target_type, created_at').order('created_at', { ascending: false }).limit(50),
      supabaseAdmin.from('admin_activity_logs').select('id, admin_user_id, admin_name, action_type, action_detail, target_type, target_id, target_name, metadata, created_at').order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('app_config').select('maintenance_mode, scheduled_maintenance_at').eq('id', 'main').single(),
    ]);

    const users = usersRes.data || [];
    const reports = reportsRes.data || [];
    const suspicious = suspiciousRes.data || [];
    const appeals = appealsRes.data || [];
    const allClubs = clubsFullRes.data || [];

    // Process stats
    const pendingReports = reports.filter((r: any) => r.status === 'pending').length;
    const activeWarnings = reports.filter((r: any) => r.status === 'warned').length;
    const activeBans = reports.filter((r: any) => r.status === 'banned').length;
    const dismissedReports = reports.filter((r: any) => r.status === 'dismissed').length;
    const flaggedPlayers = suspicious.filter((s: any) => s.status === 'flagged').length;
    const pendingAppeals = appeals.filter((a: any) => a.status === 'pending');
    const overdueThreshold = Date.now() - 48 * 60 * 60 * 1000;
    const overdueAppeals = pendingAppeals.filter((a: any) => new Date(a.created_at).getTime() < overdueThreshold).length;

    // ELO distribution
    const eloBuckets = { bronze: 0, silver: 0, gold: 0, diamond: 0, master: 0 };
    (eloPlayersRes.data || []).forEach((p: any) => {
      const elo = p.elo_rating || 1000;
      if (elo >= 1800) eloBuckets.master++;
      else if (elo >= 1500) eloBuckets.diamond++;
      else if (elo >= 1200) eloBuckets.gold++;
      else if (elo >= 1000) eloBuckets.silver++;
      else eloBuckets.bronze++;
    });

    // Weekly match counts (last 8 weeks)
    const now = new Date();
    const weeklyMatches: { week: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const label = weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const count = (weeklyMatchesRes.data || []).filter((m: any) => {
        const d = new Date(m.date);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeklyMatches.push({ week: label, count });
    }

    // Monthly user growth (last 6 months)
    const monthlyGrowth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const label = monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const count = (userGrowthRes.data || []).filter((u: any) => {
        const uDate = u.created_at || u.consent_date;
        if (!uDate) return false;
        const ud = new Date(uDate);
        return ud >= monthStart && ud < monthEnd;
      }).length;
      monthlyGrowth.push({ month: label, count });
    }

    // Recent signups (7 days)
    const recentSignups = users.filter((u: any) => {
      const d = u.created_at || u.consent_date;
      return d && d >= sevenDaysAgo;
    }).length;

    // Unverified clubs
    const unverifiedClubs = allClubs.filter((c: any) => !c.is_verified).map((c: any) => ({
      id: c.id, name: c.name, city: c.city, membersCount: c.members_count || 0, isPublic: c.is_public || false,
    }));

    // Push analytics
    const pushData = pushLogsRes.data || [];
    const pushSent = pushData.reduce((s: number, a: any) => s + (a.push_sent_count || 0), 0);
    const pushByType: Record<string, number> = {};
    pushData.forEach((a: any) => {
      const t = a.target_type || 'all';
      pushByType[t] = (pushByType[t] || 0) + (a.push_sent_count || 0);
    });

    // Maintenance status
    const maintenanceActive = appConfigRes.data?.maintenance_mode || false;
    const maintenanceScheduled = !!appConfigRes.data?.scheduled_maintenance_at;

    // Growth delta
    let growthDelta = 0;
    if (monthlyGrowth.length >= 2) {
      const curr = monthlyGrowth[monthlyGrowth.length - 1].count;
      const prev = monthlyGrowth[monthlyGrowth.length - 2].count;
      growthDelta = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;
    }

    const result = {
      stats: {
        totalUsers: users.length,
        premiumUsers: users.filter((u: any) => u.is_premium).length,
        totalPlayers: playersCountRes.count || 0,
        totalTerrains: terrainsCountRes.count || 0,
        totalClubs: clubsCountRes.count || 0,
        verifiedClubs: allClubs.filter((c: any) => c.is_verified).length,
        totalMatches: matchesCountRes.count || 0,
        pendingReports,
        activeWarnings,
        activeBans,
        dismissedReports,
        totalAnnouncements: announcementsCountRes.count || 0,
        flaggedPlayers,
        maintenanceActive,
        maintenanceScheduled,
        pendingAppeals: pendingAppeals.length,
        overdueAppeals,
      },
      eloDistribution: eloBuckets,
      weeklyMatches,
      monthlyGrowth,
      growthDelta,
      recentSignups,
      unverifiedClubs: unverifiedClubs.slice(0, 10),
      pushAnalytics: { sent: pushSent, types: pushByType },
      activityLogs: (activityLogsRes.data || []).map((row: any) => ({
        id: row.id,
        adminUserId: row.admin_user_id,
        adminName: row.admin_name,
        actionType: row.action_type,
        actionDetail: row.action_detail,
        targetType: row.target_type,
        targetId: row.target_id,
        targetName: row.target_name,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      })),
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[admin-stats] Error:', error);
    return new Response(JSON.stringify({ error: `Server error: ${(error as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
