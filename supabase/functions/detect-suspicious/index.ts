import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface PlayerAnalysis {
  player_id: string;
  user_id: string;
  trust_score: number;
  flags: string[];
  details: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    if (token) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        return new Response(JSON.stringify({ error: 'Admin only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[detect-suspicious] Starting analysis...');

    // 1. Fetch all public players with stats
    const { data: players, error: playersError } = await supabaseClient
      .from('players')
      .select('id, user_id, name, stats, created_at, is_public')
      .eq('is_public', true);

    if (playersError) {
      console.error('[detect-suspicious] Players fetch error:', playersError.message);
      return new Response(JSON.stringify({ error: playersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch all matches for opponent diversity analysis
    const { data: allMatches, error: matchesError } = await supabaseClient
      .from('matches')
      .select('id, user_id, team_a, team_b, winner, duration, date, created_at');

    if (matchesError) {
      console.error('[detect-suspicious] Matches fetch error:', matchesError.message);
    }

    const matches = allMatches || [];

    // 3. Fetch report counts
    const { data: reports } = await supabaseClient
      .from('player_reports')
      .select('reported_player_id, status');

    // 3b. Fetch device registrations for multi-account detection
    const { data: deviceRegs } = await supabaseClient
      .from('device_registrations')
      .select('device_fingerprint, email, user_id');

    // Build map: user email -> set of device fingerprints, and fingerprint -> set of emails
    const emailToFingerprints = new Map<string, Set<string>>();
    const fingerprintToEmails = new Map<string, Set<string>>();
    for (const dr of deviceRegs || []) {
      if (dr.email && dr.device_fingerprint) {
        if (!emailToFingerprints.has(dr.email)) emailToFingerprints.set(dr.email, new Set());
        emailToFingerprints.get(dr.email)!.add(dr.device_fingerprint);
        if (!fingerprintToEmails.has(dr.device_fingerprint)) fingerprintToEmails.set(dr.device_fingerprint, new Set());
        fingerprintToEmails.get(dr.device_fingerprint)!.add(dr.email);
      }
    }
    console.log(`[detect-suspicious] Device registrations loaded: ${(deviceRegs || []).length} entries`);

    const reportCounts = new Map<string, number>();
    const pendingReportCounts = new Map<string, number>();
    for (const r of reports || []) {
      reportCounts.set(r.reported_player_id, (reportCounts.get(r.reported_player_id) || 0) + 1);
      if (r.status === 'pending') {
        pendingReportCounts.set(r.reported_player_id, (pendingReportCounts.get(r.reported_player_id) || 0) + 1);
      }
    }

    // 4. Analyze each player
    const results: PlayerAnalysis[] = [];
    const now = Date.now();

    for (const player of players || []) {
      const stats = player.stats || {};
      const matchesPlayed = stats.matchesPlayed || 0;

      if (matchesPlayed < 10) continue; // skip below threshold

      const flags: string[] = [];
      const details: Record<string, any> = {};
      let score = 100;

      const winRate = stats.winRate || 0;
      const tirRate = stats.tirRate || 0;
      const pointRate = stats.pointRate || 0;
      const carreauRate = stats.carreauRate || 0;

      // === Stats Regularity (25 points) ===
      if (winRate > 95) {
        score -= 20;
        flags.push('extreme_win_rate');
        details.winRate = winRate;
      } else if (winRate > 90) {
        score -= 10;
      }

      if (tirRate > 85 && pointRate > 85) {
        score -= 15;
        flags.push('unrealistic_combined_rates');
        details.tirRate = tirRate;
        details.pointRate = pointRate;
      }

      if (carreauRate > 50) {
        score -= 15;
        flags.push('extreme_carreau_rate');
        details.carreauRate = carreauRate;
      }

      // === Match Volume (15 points) ===
      if (matchesPlayed < 15) {
        score -= 10;
        flags.push('low_match_count');
      } else if (matchesPlayed < 30) {
        score -= 5;
      }

      // === Account Age (15 points) ===
      const ageMs = now - new Date(player.created_at).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays < 7) {
        score -= 15;
        flags.push('very_new_account');
      } else if (ageDays < 30) {
        score -= 10;
        flags.push('new_account');
      } else if (ageDays < 90) {
        score -= 5;
      }
      details.accountAgeDays = Math.round(ageDays);

      // === Opponent Diversity (20 points) ===
      const playerMatches = matches.filter(
        (m: any) => m.user_id === player.user_id
      );
      const opponents = new Set<string>();
      for (const m of playerMatches) {
        const teamA = m.team_a?.players || [];
        const teamB = m.team_b?.players || [];
        const inA = teamA.includes(player.id);
        const inB = teamB.includes(player.id);
        if (inA) teamB.forEach((p: string) => opponents.add(p));
        if (inB) teamA.forEach((p: string) => opponents.add(p));
      }
      const uniqueOpponents = opponents.size;
      const diversityRatio = playerMatches.length > 0 ? uniqueOpponents / playerMatches.length : 0;

      if (uniqueOpponents <= 1 && matchesPlayed >= 10) {
        score -= 20;
        flags.push('single_opponent');
      } else if (diversityRatio < 0.2 && matchesPlayed >= 15) {
        score -= 15;
        flags.push('low_opponent_diversity');
      } else if (diversityRatio < 0.4 && matchesPlayed >= 15) {
        score -= 10;
      }
      details.uniqueOpponents = uniqueOpponents;
      details.diversityRatio = Math.round(diversityRatio * 100) / 100;

      // === Match Frequency (10 points) ===
      // Check for too many matches in a single day
      const dateCount = new Map<string, number>();
      for (const m of playerMatches) {
        const day = new Date(m.date || m.created_at).toISOString().split('T')[0];
        dateCount.set(day, (dateCount.get(day) || 0) + 1);
      }
      const maxMatchesPerDay = Math.max(...Array.from(dateCount.values()), 0);
      if (maxMatchesPerDay > 15) {
        score -= 15;
        flags.push('excessive_daily_matches');
        details.maxMatchesPerDay = maxMatchesPerDay;
      } else if (maxMatchesPerDay > 10) {
        score -= 8;
        flags.push('high_daily_matches');
        details.maxMatchesPerDay = maxMatchesPerDay;
      }

      // === Match Duration (10 points) ===
      const shortMatches = playerMatches.filter((m: any) => m.duration && m.duration < 2);
      if (shortMatches.length > 5) {
        score -= 10;
        flags.push('many_very_short_matches');
        details.shortMatchCount = shortMatches.length;
      } else if (shortMatches.length > 2) {
        score -= 5;
      }

      // === Multi-account Detection (15 points) ===
      // Check if this player's user has multiple accounts from same device
      const playerUserProfile = await supabaseClient
        .from('user_profiles')
        .select('email')
        .eq('id', player.user_id)
        .single();
      const playerEmail = playerUserProfile?.data?.email?.toLowerCase();
      if (playerEmail) {
        const userFingerprints = emailToFingerprints.get(playerEmail);
        if (userFingerprints) {
          let sharedDeviceAccounts = new Set<string>();
          for (const fp of userFingerprints) {
            const accountsOnDevice = fingerprintToEmails.get(fp);
            if (accountsOnDevice) {
              for (const email of accountsOnDevice) {
                if (email !== playerEmail) sharedDeviceAccounts.add(email);
              }
            }
          }
          if (sharedDeviceAccounts.size >= 3) {
            score -= 20;
            flags.push('multi_account_device_3plus');
            details.sharedDeviceAccounts = sharedDeviceAccounts.size;
          } else if (sharedDeviceAccounts.size >= 1) {
            score -= 8;
            flags.push('multi_account_device');
            details.sharedDeviceAccounts = sharedDeviceAccounts.size;
          }
        }
      }

      // === Reports (5 points) ===
      const totalReports = reportCounts.get(player.id) || 0;
      const pendingReports = pendingReportCounts.get(player.id) || 0;
      if (totalReports >= 3) {
        score -= 10;
        flags.push('multiple_reports');
      } else if (totalReports >= 1) {
        score -= 5;
        flags.push('has_reports');
      }
      details.totalReports = totalReports;
      details.pendingReports = pendingReports;

      // Clamp score
      score = Math.max(0, Math.min(100, score));
      details.matchesPlayed = matchesPlayed;

      // Only store if score < 80 or has flags
      if (score < 80 || flags.length > 0) {
        results.push({
          player_id: player.id,
          user_id: player.user_id,
          trust_score: score,
          flags,
          details,
        });
      }
    }

    console.log(`[detect-suspicious] Analyzed ${(players || []).length} players, ${results.length} flagged`);

    // 5. Upsert results
    for (const r of results) {
      const { error: upsertError } = await supabaseClient
        .from('suspicious_players')
        .upsert({
          player_id: r.player_id,
          user_id: r.user_id,
          trust_score: r.trust_score,
          flags: r.flags,
          details: r.details,
          status: r.trust_score < 25 ? 'flagged' : r.trust_score < 50 ? 'watch' : 'ok',
          analyzed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'player_id' });

      if (upsertError) {
        console.error(`[detect-suspicious] Upsert error for ${r.player_id}:`, upsertError.message);
      }
    }

    // Remove entries for players no longer flagged
    const flaggedPlayerIds = new Set(results.map(r => r.player_id));
    const { data: existing } = await supabaseClient
      .from('suspicious_players')
      .select('player_id')
      .eq('status', 'ok');

    for (const e of existing || []) {
      if (!flaggedPlayerIds.has(e.player_id)) {
        await supabaseClient.from('suspicious_players').delete().eq('player_id', e.player_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: (players || []).length,
        flagged: results.length,
        suspicious: results.filter(r => r.trust_score < 25).length,
        watch: results.filter(r => r.trust_score >= 25 && r.trust_score < 50).length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[detect-suspicious] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
