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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    let requestingUserId: string | null = null;
    let isAdmin = false;
    if (token) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      requestingUserId = user.id;
      const { data: profile } = await supabaseClient
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      isAdmin = profile?.is_admin === true;
    } else {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const mode = body?.mode || 'full';
    const targetUserId = body?.userId || requestingUserId;
    const force = body?.force === true;

    if (!isAdmin && mode === 'full') {
      return new Response(JSON.stringify({ error: 'Admin only for full scan' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[detect-suspicious] Mode: ${mode}, Admin: ${isAdmin}, Target: ${targetUserId}`);

    // 1. Fetch players
    let players: any[] = [];
    if (mode === 'self' && targetUserId) {
      const { data } = await supabaseClient
        .from('players')
        .select('id, user_id, name, stats, created_at, is_public, city, location')
        .eq('user_id', targetUserId);
      if (data) players = data;
    } else {
      const { data } = await supabaseClient
        .from('players')
        .select('id, user_id, name, stats, created_at, is_public, city, location')
        .eq('is_public', true);
      if (data) players = data;
    }

    if (players.length === 0) {
      return new Response(JSON.stringify({ success: true, analyzed: 0, flagged: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const playerUserIds = players.map((p: any) => p.user_id).filter(Boolean);

    // 2. Fetch matches
    const { data: allMatches } = await supabaseClient
      .from('matches')
      .select('id, user_id, team_a, team_b, winner, duration, date, created_at, participant_user_ids, player_actions, terrain_id')
      .in('user_id', playerUserIds);
    const matches = allMatches || [];

    // 3. Fetch challenges
    const { data: allChallenges } = await supabaseClient
      .from('challenges')
      .select('id, user_id, type, date, success_rate, participant_user_ids')
      .in('user_id', playerUserIds);
    const challenges = allChallenges || [];

    // 4. Fetch reports
    const { data: reports } = await supabaseClient
      .from('player_reports')
      .select('reported_player_id, status');
    const reportCounts = new Map<string, number>();
    for (const r of reports || []) {
      reportCounts.set(r.reported_player_id, (reportCounts.get(r.reported_player_id) || 0) + 1);
    }

    // 5. Modification logs
    const { data: modLogs } = await supabaseClient
      .from('modification_logs')
      .select('owner_id, modifier_id, created_at')
      .in('owner_id', playerUserIds);
    const modLogsByUser = new Map<string, { total: number; external: number }>();
    for (const log of modLogs || []) {
      if (!modLogsByUser.has(log.owner_id)) modLogsByUser.set(log.owner_id, { total: 0, external: 0 });
      const entry = modLogsByUser.get(log.owner_id)!;
      entry.total++;
      if (log.modifier_id !== log.owner_id) entry.external++;
    }

    // 6. Device fingerprints
    const { data: deviceRegs } = await supabaseClient
      .from('device_registrations')
      .select('device_fingerprint, email, user_id, registered_at');
    const emailToFingerprints = new Map<string, Set<string>>();
    const fingerprintToEmails = new Map<string, Set<string>>();
    const RECENT_FP_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgoTs = Date.now() - RECENT_FP_WINDOW_MS;
    const emailToFingerprintsRecent = new Map<string, Set<string>>();
    const fingerprintToEmailsRecent = new Map<string, Set<string>>();
    const registrationsByDomain = new Map<string, Array<{ email: string; ts: number }>>();
    for (const dr of deviceRegs || []) {
      if (dr.email && dr.device_fingerprint) {
        const emailLower = dr.email.toLowerCase();
        if (!emailToFingerprints.has(emailLower)) emailToFingerprints.set(emailLower, new Set());
        emailToFingerprints.get(emailLower)!.add(dr.device_fingerprint);
        if (!fingerprintToEmails.has(dr.device_fingerprint)) fingerprintToEmails.set(dr.device_fingerprint, new Set());
        fingerprintToEmails.get(dr.device_fingerprint)!.add(emailLower);
        const regTs = dr.registered_at ? new Date(dr.registered_at).getTime() : 0;
        if (Number.isFinite(regTs) && regTs >= thirtyDaysAgoTs) {
          if (!emailToFingerprintsRecent.has(emailLower)) emailToFingerprintsRecent.set(emailLower, new Set());
          emailToFingerprintsRecent.get(emailLower)!.add(dr.device_fingerprint);
          if (!fingerprintToEmailsRecent.has(dr.device_fingerprint)) fingerprintToEmailsRecent.set(dr.device_fingerprint, new Set());
          fingerprintToEmailsRecent.get(dr.device_fingerprint)!.add(emailLower);
        }
        if (Number.isFinite(regTs) && regTs > 0) {
          const parts = emailLower.split('@');
          if (parts.length === 2) {
            const domain = parts[1];
            if (!registrationsByDomain.has(domain)) registrationsByDomain.set(domain, []);
            registrationsByDomain.get(domain)!.push({ email: emailLower, ts: regTs });
          }
        }
      }
    }

    // Email farm cluster detection
    const EMAIL_FARM_WINDOW_MS = 24 * 60 * 60 * 1000;
    const emailFarmMap = new Map<string, { domain: string; prefix: string; clusterSize: number; spanHours: number; siblings: string[] }>();
    for (const [domain, entries] of registrationsByDomain) {
      if (entries.length < 3) continue;
      entries.sort((a, b) => a.ts - b.ts);
      for (let i = 0; i < entries.length; i++) {
        let j = i;
        while (j < entries.length && (entries[j].ts - entries[i].ts) < EMAIL_FARM_WINDOW_MS) j++;
        const window = entries.slice(i, j);
        if (window.length < 3) continue;
        const byPrefix = new Map<string, Array<{ email: string; num: number; ts: number }>>();
        for (const e of window) {
          const local = e.email.split('@')[0];
          const m = local.match(/^([a-z_.\-]+?)(\d+)$/i);
          if (!m) continue;
          const prefix = m[1].toLowerCase();
          const num = parseInt(m[2], 10);
          if (!Number.isFinite(num)) continue;
          if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
          byPrefix.get(prefix)!.push({ email: e.email, num, ts: e.ts });
        }
        for (const [prefix, items] of byPrefix) {
          if (items.length < 3) continue;
          items.sort((a, b) => a.num - b.num);
          let bestStart = 0, bestLen = 1;
          let curStart = 0, curLen = 1;
          for (let k = 1; k < items.length; k++) {
            if (items[k].num - items[k - 1].num <= 2) {
              curLen++;
              if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
            } else {
              curStart = k; curLen = 1;
            }
          }
          if (bestLen < 3) continue;
          const cluster = items.slice(bestStart, bestStart + bestLen);
          const spanMs = cluster[cluster.length - 1].ts - cluster[0].ts;
          const spanHours = Math.round((spanMs / (60 * 60 * 1000)) * 10) / 10;
          const siblings = cluster.map(c => c.email);
          for (const c of cluster) {
            const existing = emailFarmMap.get(c.email);
            if (!existing || bestLen > existing.clusterSize) {
              emailFarmMap.set(c.email, { domain, prefix, clusterSize: bestLen, spanHours, siblings: siblings.slice(0, 8) });
            }
          }
        }
        i = Math.max(i, j - 1);
      }
    }

    // ELO history batch
    const playerIdsForElo = players.map((p: any) => p.id).filter(Boolean);
    const eloHistoryByPlayer = new Map<string, Array<{ delta: number; ts: number }>>();
    if (playerIdsForElo.length > 0) {
      const { data: allEloHistory } = await supabaseClient
        .from('elo_history')
        .select('player_id, elo_delta, recorded_at')
        .in('player_id', playerIdsForElo)
        .order('recorded_at', { ascending: true })
        .limit(5000);
      for (const e of allEloHistory || []) {
        if (!e.player_id) continue;
        const ts = new Date(e.recorded_at).getTime();
        if (!Number.isFinite(ts)) continue;
        if (!eloHistoryByPlayer.has(e.player_id)) eloHistoryByPlayer.set(e.player_id, []);
        eloHistoryByPlayer.get(e.player_id)!.push({ delta: Number(e.elo_delta) || 0, ts });
      }
    }

    // 7. User emails
    const { data: userProfiles } = await supabaseClient
      .from('user_profiles')
      .select('id, email')
      .in('id', playerUserIds);
    const userEmailMap = new Map<string, string>();
    for (const up of userProfiles || []) {
      if (up.email) userEmailMap.set(up.id, up.email.toLowerCase());
    }

    // 8. Terrain coordinates
    const allTerrainIds = Array.from(new Set(matches.map((m: any) => m.terrain_id).filter(Boolean))) as string[];
    const terrainCoordsMap = new Map<string, { lat: number; lng: number; name?: string; timezone?: string }>();
    if (allTerrainIds.length > 0) {
      const { data: terrainData } = await supabaseClient
        .from('terrains')
        .select('id, name, location, timezone')
        .in('id', allTerrainIds);
      for (const t of terrainData || []) {
        const lat = t.location?.latitude;
        const lng = t.location?.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng) && (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001)) {
          terrainCoordsMap.set(t.id, { lat, lng, name: t.name, timezone: t.timezone || undefined });
        }
      }
    }

    const IMPOSSIBLE_DISTANCE_KM = 500;
    const IMPOSSIBLE_TIME_HOURS = 6;
    const TELEPORT_DISTANCE_KM = 200;
    const TELEPORT_TIME_HOURS = 2;
    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // 9. Player owner + name map
    const { data: allPlayersWithOwners } = await supabaseClient
      .from('players')
      .select('id, user_id, name');
    const playerToUserMap = new Map<string, string>();
    const playerToNameMap = new Map<string, string>();
    for (const p of allPlayersWithOwners || []) {
      if (!p.id) continue;
      if (p.user_id) playerToUserMap.set(p.id, p.user_id);
      if (p.name) playerToNameMap.set(p.id, p.name);
    }

    // 10. Player -> submitters
    const playerToSubmitters = new Map<string, Set<string>>();
    for (const m of matches) {
      const pids = [...(m.team_a?.players || []), ...(m.team_b?.players || [])] as string[];
      for (const pid of pids) {
        if (!pid) continue;
        if (!playerToSubmitters.has(pid)) playerToSubmitters.set(pid, new Set());
        playerToSubmitters.get(pid)!.add(m.user_id);
      }
    }

    const results: PlayerAnalysis[] = [];
    const now = Date.now();

    for (const player of players) {
      const stats = player.stats || {};
      const matchesPlayed = stats.matchesPlayed || 0;
      const playerMatches = matches.filter((m: any) => m.user_id === player.user_id);
      const flags: string[] = [];
      const details: Record<string, any> = {};
      let score = 100;

      const winRate = stats.winRate || 0;
      const tirRate = stats.tirRate || 0;
      const pointRate = stats.pointRate || 0;
      const carreauRate = stats.carreauRate || 0;

      // Factor 1: Multi-player
      const multiPlayerMatches = playerMatches.filter((m: any) => {
        const pids = m.participant_user_ids || [];
        return Array.isArray(pids) && pids.length >= 2;
      });
      const multiPlayerRatio = playerMatches.length > 0 ? multiPlayerMatches.length / playerMatches.length : 0;
      details.multiPlayerRatio = Math.round(multiPlayerRatio * 100);
      details.totalMatches = playerMatches.length;
      score -= Math.round((1 - multiPlayerRatio) * 30);
      if (multiPlayerRatio < 0.1 && matchesPlayed >= 10) flags.push('very_low_multiplayer');
      else if (multiPlayerRatio < 0.3 && matchesPlayed >= 10) flags.push('low_multiplayer');

      // Factor 2: Diversity
      const opponents = new Set<string>();
      for (const m of playerMatches) {
        const teamA = m.team_a?.players || [];
        const teamB = m.team_b?.players || [];
        const inA = teamA.includes(player.id);
        if (inA) teamB.forEach((p: string) => opponents.add(p));
        else teamA.forEach((p: string) => opponents.add(p));
      }
      const uniqueOpponents = opponents.size;
      const diversityRatio = playerMatches.length > 0 ? uniqueOpponents / playerMatches.length : 0;
      details.uniqueOpponents = uniqueOpponents;
      if (uniqueOpponents <= 1 && matchesPlayed >= 10) { score -= 20; flags.push('single_opponent'); }
      else if (diversityRatio < 0.15 && matchesPlayed >= 15) { score -= 15; flags.push('low_opponent_diversity'); }
      else if (diversityRatio < 0.3 && matchesPlayed >= 15) score -= 10;
      else if (diversityRatio < 0.5) score -= 5;

      // Factor 3: Consistency
      const weeklyWinRates: number[] = [];
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const weekBuckets: Record<string, { wins: number; total: number }> = {};
      for (const m of playerMatches) {
        const mDate = new Date(m.date || m.created_at);
        if (mDate < fourWeeksAgo) continue;
        const weekNum = Math.floor((now - mDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const key = `w${weekNum}`;
        if (!weekBuckets[key]) weekBuckets[key] = { wins: 0, total: 0 };
        weekBuckets[key].total++;
        if (m.winner === 'A') weekBuckets[key].wins++;
      }
      const weekEntries = Object.values(weekBuckets).filter(w => w.total > 0);
      weekEntries.forEach(w => weeklyWinRates.push(w.total > 0 ? (w.wins / w.total) * 100 : 0));
      let performanceConsistency = 100;
      if (weeklyWinRates.length >= 2) {
        const mean = weeklyWinRates.reduce((a, b) => a + b, 0) / weeklyWinRates.length;
        const variance = weeklyWinRates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / weeklyWinRates.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? stdDev / mean : 0;
        performanceConsistency = Math.max(0, 100 - Math.round(cv * 100));
        if (cv > 0.8) { flags.push('very_inconsistent_performance'); score -= 15; }
        else if (cv > 0.5) { flags.push('inconsistent_performance'); score -= 10; }
        else if (cv > 0.3) score -= 5;
      }
      details.performanceConsistency = performanceConsistency;

      // Factor 4: Modifications
      const modData = modLogsByUser.get(player.user_id) || { total: 0, external: 0 };
      details.modificationLogs = { total: modData.total, external: modData.external };
      if (modData.external > 10) { score -= 12; flags.push('many_external_modifications'); }
      else if (modData.external > 5) { score -= 8; flags.push('some_external_modifications'); }
      else if (modData.external > 2) score -= 4;

      // Factor 5: Frequency
      const matchesPerWeek = playerMatches.length > 0
        ? playerMatches.length / Math.max(1, (now - new Date(player.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000))
        : 0;
      details.matchesPerWeek = Math.round(matchesPerWeek * 10) / 10;
      const dateCount = new Map<string, number>();
      for (const m of playerMatches) {
        const day = new Date(m.date || m.created_at).toISOString().split('T')[0];
        dateCount.set(day, (dateCount.get(day) || 0) + 1);
      }
      const maxMatchesPerDay = Math.max(...Array.from(dateCount.values()), 0);
      if (maxMatchesPerDay > 15) { score -= 10; flags.push('excessive_daily_matches'); }
      else if (maxMatchesPerDay > 10) { score -= 5; flags.push('high_daily_matches'); }
      if (matchesPlayed < 5) score -= 5;

      // Factor 6: Regularity
      if (winRate > 95 && matchesPlayed >= 10) { score -= 10; flags.push('extreme_win_rate'); }
      if (tirRate > 85 && pointRate > 85 && matchesPlayed >= 10) { score -= 8; flags.push('unrealistic_combined_rates'); }
      if (carreauRate > 50 && matchesPlayed >= 10) { score -= 8; flags.push('extreme_carreau_rate'); }

      // Factor 7: Age
      const ageMs = now - new Date(player.created_at).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      details.accountAgeDays = Math.round(ageDays);
      if (ageDays < 7) { score -= 5; flags.push('very_new_account'); }
      else if (ageDays < 30) score -= 3;

      // Factor 8: Short matches
      const shortMatches = playerMatches.filter((m: any) => m.duration && m.duration < 2);
      if (shortMatches.length > 5) { score -= 5; flags.push('many_very_short_matches'); }

      // Factor 9: Multi-account (all-time)
      const playerEmail = userEmailMap.get(player.user_id);
      if (playerEmail) {
        const userFingerprints = emailToFingerprints.get(playerEmail);
        if (userFingerprints) {
          const sharedDeviceAccounts = new Set<string>();
          for (const fp of userFingerprints) {
            const accountsOnDevice = fingerprintToEmails.get(fp);
            if (accountsOnDevice) {
              for (const email of accountsOnDevice) {
                if (email !== playerEmail) sharedDeviceAccounts.add(email);
              }
            }
          }
          if (sharedDeviceAccounts.size >= 3) { score -= 10; flags.push('multi_account_device_3plus'); }
          else if (sharedDeviceAccounts.size >= 1) { score -= 5; flags.push('multi_account_device'); }
        }
      }

      // Factor 24: Shared fingerprint (recent 30d)
      const recentSharedAccounts = new Set<string>();
      const recentSharedFingerprints = new Set<string>();
      if (playerEmail) {
        const userFingerprintsRecent = emailToFingerprintsRecent.get(playerEmail);
        if (userFingerprintsRecent) {
          for (const fp of userFingerprintsRecent) {
            const accountsOnDevice = fingerprintToEmailsRecent.get(fp);
            if (accountsOnDevice && accountsOnDevice.size >= 2) {
              for (const email of accountsOnDevice) {
                if (email !== playerEmail) {
                  recentSharedAccounts.add(email);
                  recentSharedFingerprints.add(fp);
                }
              }
            }
          }
        }
      }
      details.sharedFingerprintRecent = {
        sharedAccountsCount: recentSharedAccounts.size,
        sharedFingerprintsCount: recentSharedFingerprints.size,
        windowDays: 30,
        examples: Array.from(recentSharedAccounts).slice(0, 5),
      };
      if (recentSharedAccounts.size >= 2) { score -= 12; flags.push('shared_fingerprint_recent_multi'); }
      else if (recentSharedAccounts.size >= 1) { score -= 6; flags.push('shared_fingerprint_recent'); }

      // Factor 25: Email farm
      if (playerEmail) {
        const farmEntry = emailFarmMap.get(playerEmail);
        if (farmEntry) {
          details.emailFarm = {
            domain: farmEntry.domain,
            prefix: farmEntry.prefix,
            clusterSize: farmEntry.clusterSize,
            spanHours: farmEntry.spanHours,
            windowHours: 24,
            siblings: farmEntry.siblings,
          };
          if (farmEntry.clusterSize >= 5) { score -= 15; flags.push('email_farm'); }
          else { score -= 10; flags.push('email_farm'); }
        }
      }

      // Factor 10: Reports
      const totalReports = reportCounts.get(player.id) || 0;
      if (totalReports >= 3) { score -= 8; flags.push('multiple_reports'); }
      else if (totalReports >= 1) { score -= 3; flags.push('has_reports'); }
      details.totalReports = totalReports;

      // Factor 12: Witness abuse
      const { data: witnessReqsSent } = await supabaseClient
        .from('match_witness_requests')
        .select('witness_user_id, created_at, status')
        .eq('requester_user_id', player.user_id)
        .gte('created_at', new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString());
      const { data: witnessReqsReceived } = await supabaseClient
        .from('match_witness_requests')
        .select('requester_user_id, created_at, status')
        .eq('witness_user_id', player.user_id)
        .gte('created_at', new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString());
      const witnessPairCounts = new Map<string, number>();
      for (const wr of witnessReqsSent || []) witnessPairCounts.set(wr.witness_user_id, (witnessPairCounts.get(wr.witness_user_id) || 0) + 1);
      for (const wr of witnessReqsReceived || []) witnessPairCounts.set(wr.requester_user_id, (witnessPairCounts.get(wr.requester_user_id) || 0) + 1);
      const maxPairCount = Math.max(...Array.from(witnessPairCounts.values()), 0);
      details.witnessActivity = {
        sentThisWeek: witnessReqsSent?.length || 0,
        receivedThisWeek: witnessReqsReceived?.length || 0,
        maxPairCount,
      };
      if (maxPairCount > 8) { score -= 8; flags.push('witness_abuse_extreme'); }
      else if (maxPairCount > 5) { score -= 5; flags.push('witness_abuse_frequent_pair'); }

      let mutualAttestations = 0;
      for (const [partnerId, sentCount] of witnessPairCounts) {
        const reverseCount = (witnessReqsReceived || []).filter((wr: any) => wr.requester_user_id === partnerId).length;
        if (sentCount >= 2 && reverseCount >= 2) mutualAttestations += sentCount + reverseCount;
      }
      if (mutualAttestations > 6 && !flags.includes('witness_abuse_extreme')) {
        score -= 4;
        flags.push('witness_abuse_mutual_ring');
      }

      const { data: attestedItems } = await supabaseClient
        .from('match_witness_requests')
        .select('id, witness_user_id, attestation_type, created_at')
        .eq('requester_user_id', player.user_id)
        .eq('status', 'attested');
      details.witnessedMatchCount = attestedItems?.length || 0;

      // Factor 26: Witness reputation
      const witnessAttestationCounts = new Map<string, number>();
      for (const wa of attestedItems || []) {
        if (!wa.witness_user_id) continue;
        witnessAttestationCounts.set(wa.witness_user_id, (witnessAttestationCounts.get(wa.witness_user_id) || 0) + 1);
      }
      const totalAttestationsCount = (attestedItems || []).length;
      const uniqueWitnessCount = witnessAttestationCounts.size;
      let dominantWitnessCount = 0;
      let dominantWitnessId: string | null = null;
      for (const [wid, cnt] of witnessAttestationCounts) {
        if (cnt > dominantWitnessCount) { dominantWitnessCount = cnt; dominantWitnessId = wid; }
      }
      const witnessConcentrationRatio = totalAttestationsCount > 0 ? dominantWitnessCount / totalAttestationsCount : 0;
      const witnessDiversityScore = totalAttestationsCount > 0 ? Math.round((uniqueWitnessCount / totalAttestationsCount) * 100) : 100;
      details.witnessReputation = {
        totalAttestations: totalAttestationsCount,
        uniqueWitnesses: uniqueWitnessCount,
        dominantWitnessCount,
        dominantWitnessId,
        concentrationRatio: Math.round(witnessConcentrationRatio * 100),
        diversityScore: witnessDiversityScore,
      };
      if (totalAttestationsCount >= 8 && witnessConcentrationRatio > 0.8) {
        score -= 12; flags.push('witness_reputation_biased'); flags.push('witness_reputation_extreme');
      } else if (totalAttestationsCount >= 5 && witnessConcentrationRatio > 0.6) {
        score -= 8; flags.push('witness_reputation_biased');
      }

      // Factor 13: Deletion analysis
      const { data: softDeletes } = await supabaseClient
        .from('soft_deletes')
        .select('item_id, deleted_at')
        .eq('user_id', player.user_id)
        .eq('table_name', 'matches');
      const deletedMatchIds = (softDeletes || []).map((sd: any) => sd.item_id);
      let deletedLostCount = 0;
      let deletedLostEloImpact = 0;
      let recentDeletedLostCount = 0;
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      if (deletedMatchIds.length > 0) {
        const { data: eloEntries } = await supabaseClient
          .from('elo_history')
          .select('match_id, elo_delta, won, recorded_at')
          .eq('user_id', player.user_id)
          .eq('won', false)
          .in('match_id', deletedMatchIds);
        deletedLostCount = eloEntries?.length || 0;
        deletedLostEloImpact = (eloEntries || []).reduce((sum: number, e: any) => sum + Math.abs(e.elo_delta || 0), 0);
        const recentDeletes = (softDeletes || []).filter((sd: any) => sd.deleted_at >= sevenDaysAgo);
        const recentDeletedIds = recentDeletes.map((sd: any) => sd.item_id);
        if (recentDeletedIds.length > 0) {
          recentDeletedLostCount = (eloEntries || []).filter((e: any) => recentDeletedIds.includes(e.match_id)).length;
        }
      }
      details.deletionAnalysis = {
        totalDeletedMatches: deletedMatchIds.length,
        deletedLostMatches: deletedLostCount,
        avoidedEloLoss: deletedLostEloImpact,
        recentDeletedLost7d: recentDeletedLostCount,
      };
      if (deletedLostCount >= 10) { score -= 15; flags.push('mass_deletion_lost_matches'); }
      else if (deletedLostCount >= 5) { score -= 10; flags.push('frequent_deletion_lost_matches'); }
      else if (deletedLostCount >= 3) { score -= 7; flags.push('suspicious_deletion_lost_matches'); }
      else if (deletedLostCount >= 1) { score -= 3; flags.push('deletion_lost_match'); }
      if (recentDeletedLostCount >= 5) {
        score -= 8;
        if (!flags.includes('mass_deletion_lost_matches')) flags.push('burst_deletion_7d');
      } else if (recentDeletedLostCount >= 3) {
        score -= 5;
        if (!flags.includes('frequent_deletion_lost_matches') && !flags.includes('mass_deletion_lost_matches')) flags.push('burst_deletion_7d');
      }

      // Factor 14: Impossible travel
      const geoPoints = playerMatches
        .map((m: any) => {
          const coords = m.terrain_id ? terrainCoordsMap.get(m.terrain_id) : undefined;
          if (!coords) return null;
          const ts = new Date(m.date || m.created_at).getTime();
          if (!Number.isFinite(ts)) return null;
          return { matchId: m.id, ts, lat: coords.lat, lng: coords.lng, terrainName: coords.name };
        })
        .filter((p: any) => p !== null)
        .sort((a: any, b: any) => a.ts - b.ts);
      const impossiblePairs: any[] = [];
      const teleportPairs: any[] = [];
      for (let gi = 1; gi < geoPoints.length; gi++) {
        const gA = geoPoints[gi - 1];
        const gB = geoPoints[gi];
        const distKm = haversineKm(gA.lat, gA.lng, gB.lat, gB.lng);
        const hoursBetween = (gB.ts - gA.ts) / (1000 * 60 * 60);
        const pair = {
          matchAId: gA.matchId, matchBId: gB.matchId,
          matchADate: new Date(gA.ts).toISOString(), matchBDate: new Date(gB.ts).toISOString(),
          terrainA: gA.terrainName, terrainB: gB.terrainName,
          latA: gA.lat, lngA: gA.lng, latB: gB.lat, lngB: gB.lng,
          distanceKm: Math.round(distKm),
          hoursBetween: Math.round(hoursBetween * 10) / 10,
          requiredSpeedKmh: hoursBetween > 0 ? Math.round(distKm / hoursBetween) : 999999,
        };
        if (distKm > IMPOSSIBLE_DISTANCE_KM && hoursBetween < IMPOSSIBLE_TIME_HOURS) impossiblePairs.push(pair);
        else if (distKm > TELEPORT_DISTANCE_KM && hoursBetween < TELEPORT_TIME_HOURS) teleportPairs.push(pair);
      }
      details.impossibleTravel = { count: impossiblePairs.length, matchesWithGeo: geoPoints.length, pairs: impossiblePairs.slice(0, 5) };
      details.microTeleportation = { count: teleportPairs.length, matchesWithGeo: geoPoints.length, pairs: teleportPairs.slice(0, 5) };
      if (impossiblePairs.length >= 3) { score -= 20; flags.push('impossible_travel_repeated'); }
      else if (impossiblePairs.length >= 1) { score -= 15; flags.push('impossible_travel'); }
      if (teleportPairs.length >= 1) { score -= 10; flags.push('micro_teleportation'); }

      // Factor 15: Home city
      const HOME_CITY_DISTANCE_KM = 300;
      const playerHomeLat = player.location?.latitude;
      const playerHomeLng = player.location?.longitude;
      const hasHomeCoords = Number.isFinite(playerHomeLat) && Number.isFinite(playerHomeLng) &&
        (Math.abs(playerHomeLat) > 0.0001 || Math.abs(playerHomeLng) > 0.0001);
      let distantMatchesCount = 0;
      const distantMatchExamples: any[] = [];
      if (hasHomeCoords && geoPoints.length > 0) {
        for (const gp of geoPoints) {
          const distKm = haversineKm(playerHomeLat, playerHomeLng, gp.lat, gp.lng);
          if (distKm > HOME_CITY_DISTANCE_KM) {
            distantMatchesCount++;
            if (distantMatchExamples.length < 5) {
              distantMatchExamples.push({ matchId: gp.matchId, terrainName: gp.terrainName, distanceKm: Math.round(distKm), date: new Date(gp.ts).toISOString() });
            }
          }
        }
      }
      const totalGeoMatches = geoPoints.length;
      const distantRatio = totalGeoMatches > 0 ? distantMatchesCount / totalGeoMatches : 0;
      details.homeCityConsistency = {
        homeCity: player.city || null,
        hasHomeCoords, totalMatchesWithGeo: totalGeoMatches,
        distantMatchesCount, distantRatio: Math.round(distantRatio * 100),
        thresholdKm: HOME_CITY_DISTANCE_KM, examples: distantMatchExamples,
      };
      if (hasHomeCoords) {
        if (distantMatchesCount >= 6 && distantRatio >= 0.5) { score -= 10; flags.push('frequent_distant_from_home_city'); }
        else if (distantMatchesCount >= 3) { score -= 5; flags.push('distant_from_home_city'); }
      }

      // Factor 16: Unrealistic duration
      const durationMatches = playerMatches.filter((m: any) => Number.isFinite(m.duration) && m.duration > 0);
      const unrealisticDurationMatches = durationMatches.filter((m: any) => m.duration < 5 || m.duration > 240);
      details.unrealisticDuration = {
        count: unrealisticDurationMatches.length,
        totalWithDuration: durationMatches.length,
        ratio: durationMatches.length > 0 ? Math.round((unrealisticDurationMatches.length / durationMatches.length) * 100) : 0,
        examples: unrealisticDurationMatches.slice(0, 5).map((m: any) => ({
          matchId: m.id, durationMin: m.duration, date: m.date || m.created_at,
          tooShort: m.duration < 5, tooLong: m.duration > 240,
        })),
      };
      if (unrealisticDurationMatches.length >= 5) { score -= 15; flags.push('unrealistic_duration_frequent'); }
      else if (unrealisticDurationMatches.length >= 1) { score -= 8; flags.push('unrealistic_duration'); }

      // Factor 17: Nocturnal
      const computeLocalHour = (m: any): { localHour: number; utcHour: number; tzOffsetHours: number; hasTerrainTz: boolean } | null => {
        const d = new Date(m.date || m.created_at);
        if (!Number.isFinite(d.getTime())) return null;
        const coords = m.terrain_id ? terrainCoordsMap.get(m.terrain_id) : undefined;
        const utcHour = d.getUTCHours();
        if (coords?.timezone) {
          const tz = String(coords.timezone).trim();
          if (tz.includes('/')) {
            try {
              const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
              const parts = fmt.formatToParts(d);
              const hourPart = parts.find(p => p.type === 'hour');
              if (hourPart) {
                const parsedHour = parseInt(hourPart.value, 10);
                const localHour = ((parsedHour % 24) + 24) % 24;
                let offset = localHour - utcHour;
                if (offset > 12) offset -= 24;
                if (offset < -12) offset += 24;
                return { localHour, utcHour, tzOffsetHours: offset, hasTerrainTz: true };
              }
            } catch { /* fall through */ }
          }
          const offMatch = tz.match(/([+-]?\d+)/);
          if (offMatch) {
            const off = parseInt(offMatch[1], 10);
            const localHour = ((utcHour + off) % 24 + 24) % 24;
            return { localHour, utcHour, tzOffsetHours: off, hasTerrainTz: true };
          }
        }
        const tzOffsetHours = coords ? Math.round(coords.lng / 15) : 0;
        const localHour = ((utcHour + tzOffsetHours) % 24 + 24) % 24;
        return { localHour, utcHour, tzOffsetHours, hasTerrainTz: !!coords };
      };
      const nocturnalMatches = playerMatches.filter((m: any) => {
        const info = computeLocalHour(m);
        if (!info) return false;
        return info.localHour >= 3 && info.localHour < 6;
      });
      const nocturnalRatio = playerMatches.length > 0 ? nocturnalMatches.length / playerMatches.length : 0;
      const nocturnalHasTz = nocturnalMatches.some((m: any) => computeLocalHour(m)?.hasTerrainTz === true);
      details.nocturnalActivity = {
        count: nocturnalMatches.length, totalMatches: playerMatches.length,
        ratio: Math.round(nocturnalRatio * 100),
        windowStartHour: 3, windowEndHour: 6, timezoneAware: nocturnalHasTz,
        examples: nocturnalMatches.slice(0, 5).map((m: any) => {
          const info = computeLocalHour(m);
          return {
            matchId: m.id, date: m.date || m.created_at,
            hour: info ? info.localHour : 0, utcHour: info ? info.utcHour : 0,
            tzOffsetHours: info ? info.tzOffsetHours : 0, hasTerrainTz: info ? info.hasTerrainTz : false,
          };
        }),
      };
      if (nocturnalMatches.length >= 5 && nocturnalRatio > 0.3) { score -= 10; flags.push('nocturnal_pattern'); }
      else if (nocturnalMatches.length >= 3) { score -= 5; flags.push('nocturnal_pattern'); }

      // Factor 18: Mass submission
      const massSubmissionDays: Array<{ day: string; count: number }> = [];
      for (const [day, count] of dateCount) {
        if (count > 20) massSubmissionDays.push({ day, count });
      }
      massSubmissionDays.sort((a, b) => b.count - a.count);
      const massMaxDaily = massSubmissionDays.length > 0 ? massSubmissionDays[0].count : 0;
      details.massSubmission = { daysCount: massSubmissionDays.length, maxDailyCount: massMaxDaily, threshold: 20, examples: massSubmissionDays.slice(0, 5) };
      if (massSubmissionDays.length >= 3) { score -= 15; flags.push('mass_submission_repeated'); }
      else if (massSubmissionDays.length >= 1) { score -= 10; flags.push('mass_submission'); }

      // Factor 19: Self-match
      let selfMatchCount = 0;
      const selfMatchExamples: any[] = [];
      for (const m of playerMatches) {
        const teamA = (m.team_a?.players || []) as string[];
        const teamB = (m.team_b?.players || []) as string[];
        if (teamA.length === 0 || teamB.length === 0) continue;
        const teamASet = new Set<string>(teamA);
        const directOverlap = teamB.filter((p: string) => teamASet.has(p));
        const teamAOwners = new Set<string>();
        const teamBOwners = new Set<string>();
        for (const p of teamA) { const u = playerToUserMap.get(p); if (u) teamAOwners.add(u); }
        for (const p of teamB) { const u = playerToUserMap.get(p); if (u) teamBOwners.add(u); }
        const sharedOwners = Array.from(teamAOwners).filter((u: string) => teamBOwners.has(u));
        if (directOverlap.length > 0 || sharedOwners.length > 0) {
          selfMatchCount++;
          if (selfMatchExamples.length < 5) {
            selfMatchExamples.push({
              matchId: m.id, date: m.date || m.created_at,
              directOverlap: directOverlap.length > 0, sameOwner: sharedOwners.length > 0,
              overlappingPlayers: directOverlap.slice(0, 3).map((p: string) => playerToNameMap.get(p) || p.substring(0, 8)),
              sharedOwnerCount: sharedOwners.length,
            });
          }
        }
      }
      details.selfMatches = {
        count: selfMatchCount, totalMatches: playerMatches.length,
        ratio: playerMatches.length > 0 ? Math.round((selfMatchCount / playerMatches.length) * 100) : 0,
        examples: selfMatchExamples,
      };
      if (selfMatchCount >= 3) { score -= 15; flags.push('self_match_frequent'); }
      else if (selfMatchCount >= 1) { score -= 10; flags.push('self_match'); }

      // Factor 20: Symmetric score streak
      const sortedByDate = [...playerMatches].sort((a: any, b: any) => new Date(a.date || a.created_at).getTime() - new Date(b.date || b.created_at).getTime());
      let currentSymStreak = 0;
      let maxSymStreak = 0;
      let symStreakStart: string | null = null;
      let bestSymStart: string | null = null;
      let bestSymEnd: string | null = null;
      const symExamples: any[] = [];
      let totalSymCount = 0;
      for (const m of sortedByDate) {
        const sa = Number(m.team_a?.score) || 0;
        const sb = Number(m.team_b?.score) || 0;
        const isSym = (sa === 13 && sb <= 1) || (sb === 13 && sa <= 1);
        if (isSym) {
          totalSymCount++;
          if (currentSymStreak === 0) symStreakStart = m.date || m.created_at;
          currentSymStreak++;
          if (currentSymStreak > maxSymStreak) {
            maxSymStreak = currentSymStreak;
            bestSymStart = symStreakStart;
            bestSymEnd = m.date || m.created_at;
          }
          if (symExamples.length < 5) symExamples.push({ matchId: m.id, date: m.date || m.created_at, score: `${sa}-${sb}` });
        } else {
          currentSymStreak = 0;
          symStreakStart = null;
        }
      }
      details.symmetricScores = {
        maxConsecutiveStreak: maxSymStreak,
        totalSymmetricMatches: totalSymCount,
        totalMatches: sortedByDate.length,
        ratio: sortedByDate.length > 0 ? Math.round((totalSymCount / sortedByDate.length) * 100) : 0,
        streakStartDate: bestSymStart, streakEndDate: bestSymEnd,
        threshold: 5, examples: symExamples,
      };
      if (maxSymStreak >= 10) { score -= 15; flags.push('symmetric_score_streak_extreme'); }
      else if (maxSymStreak > 5) { score -= 12; flags.push('symmetric_score_streak'); }

      // Factor 21: Ghost opponents
      const opponentIds = new Set<string>();
      for (const m of playerMatches) {
        const teamA = (m.team_a?.players || []) as string[];
        const teamB = (m.team_b?.players || []) as string[];
        const inA = teamA.includes(player.id);
        const opps = inA ? teamB : teamA;
        for (const p of opps) if (p && p !== player.id) opponentIds.add(p);
      }
      const ghostOpponentIds: string[] = [];
      const ghostOpponentExamples: any[] = [];
      for (const oppId of opponentIds) {
        const submitters = playerToSubmitters.get(oppId);
        if (!submitters) continue;
        if (submitters.size === 1 && submitters.has(player.user_id)) {
          ghostOpponentIds.push(oppId);
          if (ghostOpponentExamples.length < 5) {
            const oppOwner = playerToUserMap.get(oppId);
            ghostOpponentExamples.push({
              opponentId: oppId,
              opponentName: playerToNameMap.get(oppId) || 'Unknown',
              sameOwner: oppOwner === player.user_id,
            });
          }
        }
      }
      const ghostRatio = opponentIds.size > 0 ? ghostOpponentIds.length / opponentIds.size : 0;
      details.ghostOpponents = {
        totalOpponents: opponentIds.size,
        ghostCount: ghostOpponentIds.length,
        ratio: Math.round(ghostRatio * 100),
        threshold: 0.5, examples: ghostOpponentExamples,
      };
      if (opponentIds.size >= 5 && ghostRatio > 0.7) { score -= 12; flags.push('ghost_opponents_dominant'); }
      else if (opponentIds.size >= 3 && ghostRatio > 0.5) { score -= 8; flags.push('ghost_opponents'); }

      // Factor 22: ELO variance
      const eloEntries = eloHistoryByPlayer.get(player.id) || [];
      const eloDeltas = eloEntries.map(e => e.delta).filter(d => Number.isFinite(d));
      const eloAbsDeltas = eloDeltas.map(d => Math.abs(d)).filter(d => d > 0);
      if (eloDeltas.length >= 15) {
        const cvMean = eloAbsDeltas.length > 0 ? eloAbsDeltas.reduce((a, b) => a + b, 0) / eloAbsDeltas.length : 0;
        const cvVar = eloAbsDeltas.length > 0 ? eloAbsDeltas.reduce((s, d) => s + Math.pow(d - cvMean, 2), 0) / eloAbsDeltas.length : 0;
        const cvStd = Math.sqrt(cvVar);
        const cv = cvMean > 0 ? cvStd / cvMean : 0;
        const nElo = eloDeltas.length;
        const cumulative: number[] = [];
        let running = 0;
        for (const d of eloDeltas) { running += d; cumulative.push(running); }
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let i = 0; i < nElo; i++) {
          sumX += i; sumY += cumulative[i]; sumXY += i * cumulative[i]; sumX2 += i * i;
        }
        const denom = nElo * sumX2 - sumX * sumX;
        const slope = denom !== 0 ? (nElo * sumXY - sumX * sumY) / denom : 0;
        const intercept = (sumY - slope * sumX) / nElo;
        const meanY = sumY / nElo;
        let residualSS = 0, totalSS = 0;
        for (let i = 0; i < nElo; i++) {
          const predicted = slope * i + intercept;
          residualSS += Math.pow(cumulative[i] - predicted, 2);
          totalSS += Math.pow(cumulative[i] - meanY, 2);
        }
        const r2 = totalSS > 0 ? Math.max(0, 1 - (residualSS / totalSS)) : 0;
        const positiveDeltaRatio = nElo > 0 ? eloDeltas.filter(d => d > 0).length / nElo : 0;
        details.eloVariance = {
          matchesAnalyzed: nElo,
          meanAbsDelta: Math.round(cvMean * 10) / 10,
          coefficientOfVariation: Math.round(cv * 100) / 100,
          linearityR2: Math.round(r2 * 100) / 100,
          slope: Math.round(slope * 100) / 100,
          positiveDeltaRatio: Math.round(positiveDeltaRatio * 100),
        };
        if (nElo >= 20 && cv < 0.15 && r2 > 0.95 && positiveDeltaRatio > 0.9) {
          score -= 15; flags.push('artificial_progression');
        } else if (nElo >= 15 && cv < 0.25 && r2 > 0.9 && positiveDeltaRatio > 0.8) {
          score -= 8; flags.push('suspiciously_linear_elo');
        }
      }

      // Factor 23: Benford
      const benfordExpected = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
      const digitCounts = new Array(10).fill(0);
      let benfordSample = 0;
      for (const m of playerMatches) {
        const sA = Number(m.team_a?.score) || 0;
        const sB = Number(m.team_b?.score) || 0;
        for (const s of [sA, sB]) {
          if (s > 0) {
            const leading = parseInt(String(Math.abs(s)).charAt(0), 10);
            if (leading >= 1 && leading <= 9) { digitCounts[leading]++; benfordSample++; }
          }
        }
      }
      for (const d of eloAbsDeltas) {
        const leading = parseInt(String(Math.abs(d)).charAt(0), 10);
        if (leading >= 1 && leading <= 9) { digitCounts[leading]++; benfordSample++; }
      }
      if (benfordSample >= 30) {
        let chiSquare = 0;
        const observedPct: number[] = [];
        for (let d = 1; d <= 9; d++) {
          const observed = digitCounts[d];
          const expected = benfordExpected[d] * benfordSample;
          if (expected > 0) chiSquare += Math.pow(observed - expected, 2) / expected;
          observedPct.push(Math.round((observed / benfordSample) * 1000) / 10);
        }
        details.benfordAnalysis = {
          sampleSize: benfordSample,
          chiSquare: Math.round(chiSquare * 100) / 100,
          threshold95: 15.51, threshold99: 20.09,
          digitDistribution: observedPct,
        };
        if (benfordSample >= 50 && chiSquare > 20.09) { score -= 12; flags.push('benford_deviation_severe'); }
        else if (chiSquare > 15.51) { score -= 7; flags.push('benford_deviation'); }
      }

      // Arranged matches
      const recentMatches = playerMatches.filter((m: any) => {
        const d = new Date(m.date || m.created_at);
        return (now - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
      });
      const opponentPairCounts = new Map<string, { count: number; scores: string[] }>();
      for (const m of recentMatches) {
        const teamB = m.team_b?.players?.sort().join(',') || '';
        if (!opponentPairCounts.has(teamB)) opponentPairCounts.set(teamB, { count: 0, scores: [] });
        const entry = opponentPairCounts.get(teamB)!;
        entry.count++;
        entry.scores.push(`${m.team_a?.score || 0}-${m.team_b?.score || 0}`);
      }
      for (const [, data] of opponentPairCounts) {
        if (data.count >= 5 && new Set(data.scores).size <= 2) {
          score -= 10;
          flags.push('arranged_matches');
          details.arrangedMatchDetails = { count: data.count, uniqueScores: new Set(data.scores).size };
          break;
        }
      }

      // Factor 11: Inactivity decay
      const sortedMatchDates = playerMatches.map((m: any) => new Date(m.date || m.created_at).getTime()).sort((a: number, b: number) => b - a);
      const lastPlayedTs = sortedMatchDates.length > 0 ? sortedMatchDates[0] : new Date(player.created_at).getTime();
      const daysSinceLastPlay = Math.floor((now - lastPlayedTs) / (1000 * 60 * 60 * 24));
      details.daysSinceLastPlay = daysSinceLastPlay;
      details.lastPlayedDate = new Date(lastPlayedTs).toISOString();
      if (daysSinceLastPlay >= 30) {
        const monthsInactive = Math.floor(daysSinceLastPlay / 30);
        const decayAmount = monthsInactive * 5;
        const preDecayScore = score;
        score = Math.max(30, score - decayAmount);
        details.inactivityDecay = { monthsInactive, decayApplied: preDecayScore - score };
        if (daysSinceLastPlay >= 60) flags.push('inactive_2months');
        else flags.push('inactive_1month');
      }

      score = Math.max(0, Math.min(100, score));
      details.matchesPlayed = matchesPlayed;

      results.push({ player_id: player.id, user_id: player.user_id, trust_score: score, flags, details });
    }

    console.log(`[detect-suspicious] Analyzed ${players.length} players`);

    // Fetch previous state
    const prevScoreMap = new Map<string, number>();
    const prevFlagsMap = new Map<string, string[]>();
    if (results.length > 0) {
      const pids = results.map(r => r.player_id);
      try {
        const { data: prevData } = await supabaseClient
          .from('suspicious_players')
          .select('player_id, trust_score, flags')
          .in('player_id', pids);
        (prevData || []).forEach((pd: any) => {
          prevScoreMap.set(pd.player_id, pd.trust_score);
          prevFlagsMap.set(pd.player_id, Array.isArray(pd.flags) ? pd.flags : []);
        });
      } catch { /* silent */ }
    }

    const thresholdCrossings: Array<{ userId: string; playerId: string; newScore: number; newLevel: string; previousScore: number }> = [];
    const getLevelStr = (s: number) => s >= 80 ? 'verified' : s >= 65 ? 'high' : s >= 45 ? 'medium' : s >= 25 ? 'low' : 'suspicious';
    for (const r of results) {
      const prevScore = prevScoreMap.get(r.player_id);
      const newLevel = getLevelStr(r.trust_score);
      if (prevScore !== undefined && prevScore < r.trust_score) {
        const prevLevel = getLevelStr(prevScore);
        if ((newLevel === 'high' && prevLevel !== 'high' && prevLevel !== 'verified') ||
            (newLevel === 'verified' && prevLevel !== 'verified')) {
          thresholdCrossings.push({ userId: r.user_id, playerId: r.player_id, newScore: r.trust_score, newLevel, previousScore: prevScore });
        }
      }
      const { error: upsertError } = await supabaseClient
        .from('suspicious_players')
        .upsert({
          player_id: r.player_id, user_id: r.user_id, trust_score: r.trust_score,
          flags: r.flags, details: r.details,
          status: r.trust_score < 25 ? 'flagged' : r.trust_score < 50 ? 'watch' : 'ok',
          analyzed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }, { onConflict: 'player_id' });
      if (upsertError) console.error(`[detect-suspicious] Upsert error:`, upsertError.message);
    }

    // Geo alert collection
    interface GeoAlert { userId: string; flagType: string; count: number; details: any; }
    const geoAlerts: GeoAlert[] = [];
    for (const r of results) {
      const prevFlags = prevFlagsMap.get(r.player_id) || [];
      const newFlags = r.flags;
      if (!(prevFlags.includes('impossible_travel') || prevFlags.includes('impossible_travel_repeated')) &&
          (newFlags.includes('impossible_travel') || newFlags.includes('impossible_travel_repeated'))) {
        geoAlerts.push({ userId: r.user_id, flagType: 'impossible_travel', count: r.details.impossibleTravel?.count || 0, details: r.details.impossibleTravel || {} });
      }
      if (!prevFlags.includes('micro_teleportation') && newFlags.includes('micro_teleportation')) {
        geoAlerts.push({ userId: r.user_id, flagType: 'micro_teleportation', count: r.details.microTeleportation?.count || 0, details: r.details.microTeleportation || {} });
      }
      if (!(prevFlags.includes('distant_from_home_city') || prevFlags.includes('frequent_distant_from_home_city')) &&
          (newFlags.includes('distant_from_home_city') || newFlags.includes('frequent_distant_from_home_city'))) {
        geoAlerts.push({ userId: r.user_id, flagType: 'distant_from_home_city', count: r.details.homeCityConsistency?.distantMatchesCount || 0, details: r.details.homeCityConsistency || {} });
      }
    }

    // Temporal alerts
    interface TemporalAlert { userId: string; flagType: string; count: number; details: any; }
    const temporalAlerts: TemporalAlert[] = [];
    for (const r of results) {
      const prevFlags = prevFlagsMap.get(r.player_id) || [];
      const newFlags = r.flags;
      if (!(prevFlags.includes('unrealistic_duration') || prevFlags.includes('unrealistic_duration_frequent')) &&
          (newFlags.includes('unrealistic_duration') || newFlags.includes('unrealistic_duration_frequent'))) {
        temporalAlerts.push({ userId: r.user_id, flagType: 'unrealistic_duration', count: r.details.unrealisticDuration?.count || 0, details: r.details.unrealisticDuration || {} });
      }
      if (!prevFlags.includes('nocturnal_pattern') && newFlags.includes('nocturnal_pattern')) {
        temporalAlerts.push({ userId: r.user_id, flagType: 'nocturnal_pattern', count: r.details.nocturnalActivity?.count || 0, details: r.details.nocturnalActivity || {} });
      }
      if (!(prevFlags.includes('mass_submission') || prevFlags.includes('mass_submission_repeated')) &&
          (newFlags.includes('mass_submission') || newFlags.includes('mass_submission_repeated'))) {
        temporalAlerts.push({ userId: r.user_id, flagType: 'mass_submission', count: r.details.massSubmission?.daysCount || 0, details: r.details.massSubmission || {} });
      }
    }

    // Behavioral alerts
    interface BehavioralAlert { userId: string; flagType: string; count: number; details: any; }
    const behavioralAlerts: BehavioralAlert[] = [];
    for (const r of results) {
      const prevFlags = prevFlagsMap.get(r.player_id) || [];
      const newFlags = r.flags;
      if (!(prevFlags.includes('self_match') || prevFlags.includes('self_match_frequent')) &&
          (newFlags.includes('self_match') || newFlags.includes('self_match_frequent'))) {
        behavioralAlerts.push({ userId: r.user_id, flagType: 'self_match', count: r.details.selfMatches?.count || 0, details: r.details.selfMatches || {} });
      }
      if (!(prevFlags.includes('symmetric_score_streak') || prevFlags.includes('symmetric_score_streak_extreme')) &&
          (newFlags.includes('symmetric_score_streak') || newFlags.includes('symmetric_score_streak_extreme'))) {
        behavioralAlerts.push({ userId: r.user_id, flagType: 'symmetric_score_streak', count: r.details.symmetricScores?.maxConsecutiveStreak || 0, details: r.details.symmetricScores || {} });
      }
      if (!(prevFlags.includes('ghost_opponents') || prevFlags.includes('ghost_opponents_dominant')) &&
          (newFlags.includes('ghost_opponents') || newFlags.includes('ghost_opponents_dominant'))) {
        behavioralAlerts.push({ userId: r.user_id, flagType: 'ghost_opponents', count: r.details.ghostOpponents?.ghostCount || 0, details: r.details.ghostOpponents || {} });
      }
    }

    // Resolve stale behavioral history
    try {
      const currentBehavioralFlagsByUser = new Map<string, Set<string>>();
      for (const r of results) {
        const behavSet = new Set<string>();
        for (const f of r.flags) {
          if (['self_match','self_match_frequent','symmetric_score_streak','symmetric_score_streak_extreme','ghost_opponents','ghost_opponents_dominant'].includes(f)) {
            behavSet.add(f);
          }
        }
        currentBehavioralFlagsByUser.set(r.user_id, behavSet);
      }
      const analyzedUserIds = Array.from(currentBehavioralFlagsByUser.keys());
      if (analyzedUserIds.length > 0) {
        const { data: unresolvedRows } = await supabaseClient
          .from('behavioral_digest_history')
          .select('id, user_id, flags')
          .eq('is_resolved', false)
          .in('user_id', analyzedUserIds);
        const idsToResolve: string[] = [];
        for (const row of unresolvedRows || []) {
          const currentFlags = currentBehavioralFlagsByUser.get(row.user_id) || new Set();
          const entryFlags = Array.isArray(row.flags) ? row.flags : [];
          const stillActive = entryFlags.some((ef: string) => {
            if (currentFlags.has(ef)) return true;
            if (ef === 'self_match' && (currentFlags.has('self_match') || currentFlags.has('self_match_frequent'))) return true;
            if (ef === 'symmetric_score_streak' && (currentFlags.has('symmetric_score_streak') || currentFlags.has('symmetric_score_streak_extreme'))) return true;
            if (ef === 'ghost_opponents' && (currentFlags.has('ghost_opponents') || currentFlags.has('ghost_opponents_dominant'))) return true;
            return false;
          });
          if (!stillActive) idsToResolve.push(row.id);
        }
        if (idsToResolve.length > 0) {
          await supabaseClient
            .from('behavioral_digest_history')
            .update({ is_resolved: true, resolved_at: new Date().toISOString() })
            .in('id', idsToResolve);
        }
      }
    } catch (e) {
      console.error('[detect-suspicious] Error resolving behavioral history:', (e as any)?.message || e);
    }

    // Unified digest
    interface DigestAlert { category: string; flagType: string; count: number; details: any; }
    const digestByUser = new Map<string, DigestAlert[]>();
    for (const a of geoAlerts) {
      if (!digestByUser.has(a.userId)) digestByUser.set(a.userId, []);
      digestByUser.get(a.userId)!.push({ category: 'geo', flagType: a.flagType, count: a.count, details: a.details });
    }
    for (const a of temporalAlerts) {
      if (!digestByUser.has(a.userId)) digestByUser.set(a.userId, []);
      digestByUser.get(a.userId)!.push({ category: 'temporal', flagType: a.flagType, count: a.count, details: a.details });
    }
    for (const tc of thresholdCrossings) {
      if (!digestByUser.has(tc.userId)) digestByUser.set(tc.userId, []);
      digestByUser.get(tc.userId)!.push({ category: 'trust_improved', flagType: tc.newLevel, count: tc.newScore, details: { previousScore: tc.previousScore, playerId: tc.playerId } });
    }
    if (!force && behavioralAlerts.length > 0) {
      const behavioralUserIds = Array.from(new Set(behavioralAlerts.map(a => a.userId)));
      try {
        const { data: behavPrefs } = await supabaseClient
          .from('user_preferences')
          .select('user_id, last_behavioral_digest_sent')
          .in('user_id', behavioralUserIds);
        const behavioralCooldownMs = 48 * 60 * 60 * 1000;
        const nowTs = Date.now();
        const skipIds = new Set<string>();
        for (const p of behavPrefs || []) {
          if (p.last_behavioral_digest_sent) {
            const lastSent = new Date(p.last_behavioral_digest_sent).getTime();
            if (Number.isFinite(lastSent) && (nowTs - lastSent) < behavioralCooldownMs) skipIds.add(p.user_id);
          }
        }
        if (skipIds.size > 0) {
          for (let i = behavioralAlerts.length - 1; i >= 0; i--) {
            if (skipIds.has(behavioralAlerts[i].userId)) behavioralAlerts.splice(i, 1);
          }
        }
      } catch { /* silent */ }
    }
    for (const a of behavioralAlerts) {
      if (!digestByUser.has(a.userId)) digestByUser.set(a.userId, []);
      digestByUser.get(a.userId)!.push({ category: 'behavioral', flagType: a.flagType, count: a.count, details: a.details });
    }

    if (digestByUser.size > 0) {
      try {
        if (!force) {
          const initialUserIds = Array.from(digestByUser.keys());
          const { data: prefsRows } = await supabaseClient
            .from('user_preferences')
            .select('user_id, last_anticheat_digest_sent')
            .in('user_id', initialUserIds);
          const cooldownMs = 24 * 60 * 60 * 1000;
          const nowTs = Date.now();
          for (const p of prefsRows || []) {
            if (p.last_anticheat_digest_sent) {
              const lastSent = new Date(p.last_anticheat_digest_sent).getTime();
              if (Number.isFinite(lastSent) && (nowTs - lastSent) < cooldownMs) digestByUser.delete(p.user_id);
            }
          }
        }
        const digestUserIds = Array.from(digestByUser.keys());
        const { data: allTokens } = await supabaseClient
          .from('push_tokens')
          .select('user_id, token')
          .in('user_id', digestUserIds)
          .eq('active', true);
        const tokensByUser = new Map<string, string[]>();
        (allTokens || []).forEach((t: any) => {
          if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
          tokensByUser.get(t.user_id)!.push(t.token);
        });
        const digestMessages: any[] = [];
        for (const [userId, alerts] of digestByUser) {
          const userTokens = tokensByUser.get(userId) || [];
          if (userTokens.length === 0) continue;
          let title = '';
          let bodyMsg = '';
          let notifType = 'anticheat_digest';
          if (alerts.length === 1) {
            const a = alerts[0];
            if (a.category === 'geo' && a.flagType === 'impossible_travel') {
              title = '\u26A0\uFE0F Trajet geographique impossible detecte';
              bodyMsg = `${a.count} trajet(s) impossibles (> 500 km en < 6 h).`;
              notifType = 'geo_alert';
            } else if (a.category === 'geo' && a.flagType === 'micro_teleportation') {
              title = '\u26A0\uFE0F Deplacement rapide suspect';
              bodyMsg = `${a.count} teleportation(s) detectees.`;
              notifType = 'geo_alert';
            } else if (a.category === 'geo' && a.flagType === 'distant_from_home_city') {
              title = '\u{1F4CD} Matchs eloignes de votre ville declaree';
              bodyMsg = `${a.count} match(s) a plus de 300 km de votre ville.`;
              notifType = 'geo_alert';
            } else if (a.category === 'temporal' && a.flagType === 'unrealistic_duration') {
              title = '\u23F1\uFE0F Durees de match irrealistes';
              bodyMsg = `${a.count} match(s) avec duree suspecte.`;
              notifType = 'temporal_alert';
            } else if (a.category === 'temporal' && a.flagType === 'nocturnal_pattern') {
              title = '\u{1F319} Activite nocturne suspecte';
              bodyMsg = `${a.count} match(s) entre 3 h et 6 h.`;
              notifType = 'temporal_alert';
            } else if (a.category === 'temporal' && a.flagType === 'mass_submission') {
              title = '\u26A1 Soumission massive de matchs';
              bodyMsg = `${a.count} jour(s) avec plus de 20 matchs.`;
              notifType = 'temporal_alert';
            } else if (a.category === 'behavioral' && a.flagType === 'self_match') {
              title = '\u{1F464} Auto-affrontement detecte';
              bodyMsg = `${a.count} match(s) avec le meme joueur des deux cotes.`;
              notifType = 'behavioral_alert';
            } else if (a.category === 'behavioral' && a.flagType === 'symmetric_score_streak') {
              title = '\u{1F3AF} Serie de scores extremes';
              bodyMsg = `${a.count} matchs consecutifs 13-0 ou 13-1.`;
              notifType = 'behavioral_alert';
            } else if (a.category === 'behavioral' && a.flagType === 'ghost_opponents') {
              title = '\u{1F47B} Invitez vos adversaires';
              bodyMsg = `${a.count} adversaire(s) fantome(s) detecte(s).`;
              notifType = 'ghost_invite';
            } else if (a.category === 'trust_improved') {
              title = '\u{1F6E1}\uFE0F Score de confiance ameliore !';
              bodyMsg = `Votre score est passe a ${a.count}/100. Bravo !`;
              notifType = 'trust_score_improved';
            }
          } else {
            title = `\u{1F4CB} Anti-triche : ${alerts.length} alertes actives`;
            bodyMsg = 'Consultez votre score de confiance.';
            notifType = 'anticheat_digest';
          }
          if (title && bodyMsg) {
            for (const tk of userTokens) {
              digestMessages.push({
                to: tk, title, body: bodyMsg,
                data: { type: notifType, alerts: alerts.map(a => ({ category: a.category, flagType: a.flagType, count: a.count })), totalAlerts: alerts.length, deepLink: notifType === 'ghost_invite' ? '/share-hub' : undefined },
                channelId: 'tournament-reminders', priority: 'high',
              });
            }
          }
        }
        if (digestMessages.length > 0) {
          for (let i = 0; i < digestMessages.length; i += 100) {
            const batch = digestMessages.slice(i, i + 100);
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify(batch),
            });
          }
          const notifiedIds = Array.from(digestByUser.keys());
          const behavioralNotifiedIds = new Set(behavioralAlerts.map(a => a.userId));
          const nowIso = new Date().toISOString();
          for (const uid of notifiedIds) {
            try {
              const upsertData: any = { user_id: uid, last_anticheat_digest_sent: nowIso };
              if (behavioralNotifiedIds.has(uid)) upsertData.last_behavioral_digest_sent = nowIso;
              await supabaseClient.from('user_preferences').upsert(upsertData, { onConflict: 'user_id' });
            } catch { /* silent */ }
          }
          if (behavioralAlerts.length > 0) {
            try {
              const behavByUser = new Map<string, typeof behavioralAlerts>();
              for (const a of behavioralAlerts) {
                if (!behavByUser.has(a.userId)) behavByUser.set(a.userId, [] as any);
                behavByUser.get(a.userId)!.push(a);
              }
              const historyRows: any[] = [];
              for (const [uid, alerts] of behavByUser) {
                const playerRec = players.find((p: any) => p.user_id === uid);
                historyRows.push({
                  user_id: uid, player_id: playerRec?.id || null,
                  flags: alerts.map(a => a.flagType),
                  alert_summary: alerts.map(a => `${a.flagType}(${a.count})`).join(', '),
                  sent_at: nowIso, is_resolved: false,
                });
              }
              if (historyRows.length > 0) await supabaseClient.from('behavioral_digest_history').insert(historyRows);
            } catch (e) {
              console.error('[detect-suspicious] Error persisting behavioral history:', (e as any)?.message || e);
            }
          }
        }
      } catch (e) {
        console.error('[detect-suspicious] Error sending digest:', e);
      }
    }

    // ============================================
    // ADMIN PUSH FOR DELETION ALERTS
    // ============================================
    const deletionAlertPlayers = results.filter(r => {
      const da = r.details.deletionAnalysis;
      return da && (da.recentDeletedLost7d >= 3 || da.deletedLostMatches >= 5);
    });
    if (deletionAlertPlayers.length > 0) {
      try {
        const { data: admins } = await supabaseClient.from('user_profiles').select('id').eq('is_admin', true);
        if (admins && admins.length > 0) {
          const adminIds = admins.map((a: any) => a.id);
          const { data: adminTokens } = await supabaseClient
            .from('push_tokens').select('token, user_id')
            .in('user_id', adminIds).eq('active', true);
          if (adminTokens && adminTokens.length > 0) {
            const totalAvoided = deletionAlertPlayers.reduce((sum, p) => sum + (p.details.deletionAnalysis?.avoidedEloLoss || 0), 0);
            const pushMessages = adminTokens.map((t: any) => ({
              to: t.token,
              title: `\u26A0\uFE0F ${deletionAlertPlayers.length} alerte(s) suppression de defaites`,
              body: `${totalAvoided} pts ELO evites au total. Verifiez dans Anti-triche.`,
              data: { type: 'admin_deletion_alert', count: deletionAlertPlayers.length, totalAvoided },
              channelId: 'tournament-reminders',
            }));
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify(pushMessages),
            });
          }
        }
      } catch (e) {
        console.error(`[detect-suspicious] Error sending deletion alert:`, e);
      }
    }

    // ============================================
    // ADMIN PUSH FOR CRITICAL ALERTS (email_farm, artificial_progression)
    // Fires only on absent -> present transitions. Deep-links
    // to the specific player via admin-anticheat.
    // ============================================
    const criticalAlertPlayers: Array<{ result: PlayerAnalysis; alertTypes: string[] }> = [];
    for (const r of results) {
      const prevFlags = prevFlagsMap.get(r.player_id) || [];
      const newFlags = r.flags;
      const alertTypes: string[] = [];
      if (!prevFlags.includes('email_farm') && newFlags.includes('email_farm')) alertTypes.push('email_farm');
      const wasArtificial = prevFlags.includes('artificial_progression') || prevFlags.includes('suspiciously_linear_elo');
      const nowArtificial = newFlags.includes('artificial_progression') || newFlags.includes('suspiciously_linear_elo');
      if (!wasArtificial && nowArtificial) alertTypes.push('artificial_progression');
      if (alertTypes.length > 0) criticalAlertPlayers.push({ result: r, alertTypes });
    }
    if (criticalAlertPlayers.length > 0) {
      console.log(`[detect-suspicious] ${criticalAlertPlayers.length} critical alert(s) - notifying admins`);
      try {
        const { data: admins } = await supabaseClient.from('user_profiles').select('id').eq('is_admin', true);
        if (admins && admins.length > 0) {
          const adminIds = admins.map((a: any) => a.id);
          const { data: adminTokens } = await supabaseClient
            .from('push_tokens').select('token, user_id')
            .in('user_id', adminIds).eq('active', true);
          if (adminTokens && adminTokens.length > 0) {
            const pushMessages: any[] = [];
            for (const cap of criticalAlertPlayers) {
              const playerRec = players.find((p: any) => p.id === cap.result.player_id);
              const playerName = playerRec?.name || cap.result.player_id.substring(0, 8);
              const typeLabels = cap.alertTypes.map(t => t === 'email_farm' ? 'Email farm' : 'Progression ELO artificielle').join(' + ');
              for (const t of adminTokens) {
                pushMessages.push({
                  to: t.token,
                  title: `\u{1F6A8} Alerte critique: ${typeLabels}`,
                  body: `${playerName} - score ${cap.result.trust_score}/100. Verifier immediatement.`,
                  data: {
                    type: 'admin_critical_alert',
                    playerId: cap.result.player_id,
                    alertTypes: cap.alertTypes,
                    deepLink: '/admin-anticheat',
                  },
                  channelId: 'tournament-reminders', priority: 'high',
                });
              }
            }
            if (pushMessages.length > 0) {
              for (let i = 0; i < pushMessages.length; i += 100) {
                const batch = pushMessages.slice(i, i + 100);
                await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                  body: JSON.stringify(batch),
                });
              }
              console.log(`[detect-suspicious] Sent ${pushMessages.length} critical alert push(es)`);
            }
          }
        }
      } catch (e) {
        console.error('[detect-suspicious] Error sending critical alert:', e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed: players.length,
        flagged: results.filter(r => r.trust_score < 50).length,
        results: mode === 'self' ? results.map(r => ({
          playerId: r.player_id, trustScore: r.trust_score, flags: r.flags, details: r.details,
        })) : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[detect-suspicious] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
