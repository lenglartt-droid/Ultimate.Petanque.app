/**
 * useTerrainActivity — Dedicated hook for terrain activity scoring.
 * Extracted from directory.tsx to:
 * 1. Fix declaration order (terrainActivityMap must be defined before getCompareValue)
 * 2. Reduce re-renders in directory by isolating async data loading
 * 3. Enable reuse across map and other screens
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppData } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { getSupabaseClient } from '@/template';

export interface TerrainActivityInfo {
  score: number;
  matchCount: number;
  peakLabel: string;
  rank: number;
  recentMatches: number;
  recentChallenges: number;
  recentTournaments: number;
}

interface GlobalTerrainStats {
  totalMatches: number;
  recentMatches: number;
  totalChallenges: number;
  recentChallenges: number;
  totalTournaments: number;
  recentTournaments: number;
  peakDow: number;
  peakHour: number;
  peakDowCount: number;
  peakHourCount: number;
}

export function useTerrainActivity(): Map<string, TerrainActivityInfo> {
  const { terrains, matches, tournaments } = useAppData();
  const { language } = useLanguage();

  // Meetups loaded from Supabase (loaded once)
  const [terrainMeetupsMap, setTerrainMeetupsMap] = useState<Map<string, { date: string }[]>>(new Map());
  const meetupLoadRef = useRef(false);

  useEffect(() => {
    if (meetupLoadRef.current) return;
    meetupLoadRef.current = true;
    const loadMeetups = async () => {
      try {
        const supabase = getSupabaseClient();
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from('terrain_meetups')
          .select('terrain_id, date')
          .eq('status', 'active')
          .gte('date', today);
        if (error) {
          console.log('[useTerrainActivity] Error loading meetups:', error.message);
          return;
        }
        if (data) {
          const map = new Map<string, { date: string }[]>();
          data.forEach((r: any) => {
            const arr = map.get(r.terrain_id) || [];
            arr.push({ date: r.date });
            map.set(r.terrain_id, arr);
          });
          setTerrainMeetupsMap(map);
        }
      } catch (e) {
        console.log('[useTerrainActivity] Error loading meetups:', e);
      }
    };
    loadMeetups();
  }, []);

  // Global terrain activity stats from ALL users (community-representative scoring)
  const [globalTerrainStats, setGlobalTerrainStats] = useState<Map<string, GlobalTerrainStats>>(new Map());
  const globalStatsLoadRef = useRef(false);

  useEffect(() => {
    if (globalStatsLoadRef.current) return;
    globalStatsLoadRef.current = true;
    const loadGlobalStats = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.rpc('get_terrain_activity_stats');
        if (error) {
          console.log('[useTerrainActivity] Error loading global stats:', error.message);
          return;
        }
        if (data) {
          const map = new Map<string, GlobalTerrainStats>();
          (data as any[]).forEach((r: any) => {
            map.set(r.terrain_id, {
              totalMatches: Number(r.total_matches) || 0,
              recentMatches: Number(r.recent_matches) || 0,
              totalChallenges: Number(r.total_challenges) || 0,
              recentChallenges: Number(r.recent_challenges) || 0,
              totalTournaments: Number(r.total_tournaments) || 0,
              recentTournaments: Number(r.recent_tournaments) || 0,
              peakDow: Number(r.peak_dow) || 0,
              peakHour: Number(r.peak_hour) || 0,
              peakDowCount: Number(r.peak_dow_count) || 0,
              peakHourCount: Number(r.peak_hour_count) || 0,
            });
          });
          setGlobalTerrainStats(map);
        }
      } catch (e) {
        console.log('[useTerrainActivity] Error loading global terrain stats:', e);
      }
    };
    setTimeout(loadGlobalStats, 600);
  }, []);

  // Activity scores — ALWAYS computed (for sort-by-activity and display)
  const terrainActivityMap = useMemo(() => {
    const scoreMap = new Map<string, TerrainActivityInfo>();
    const now = new Date();
    const currentDow = now.getDay();
    const currentHour = now.getHours();
    const todayStr = now.toISOString().slice(0, 10);

    terrains.forEach(tr => {
      const terrainMatches = matches.filter(m => m.terrainId === tr.id);
      let sameDayHourCount = 0;
      let sameDayCount = 0;
      terrainMatches.forEach(m => {
        const d = new Date(m.date);
        if (d.getDay() === currentDow) {
          sameDayCount++;
          const h = d.getHours();
          if (Math.abs(h - currentHour) <= 2) sameDayHourCount++;
        }
      });

      // Bonus: tournaments happening today at this terrain
      const todayTournaments = tournaments.filter(t =>
        t.terrainId === tr.id &&
        (t.status === 'En cours' || (t.status === 'À venir' && t.date && t.date.slice(0, 10) === todayStr))
      );
      const tournamentBonus = todayTournaments.length * 25;

      // Bonus: meetups scheduled today at this terrain
      const terrainMeetups = terrainMeetupsMap.get(tr.id) || [];
      const meetupsToday = terrainMeetups.filter(mt => mt.date.slice(0, 10) === todayStr);
      const meetupBonus = meetupsToday.length * 30;

      // Global community stats (all users)
      const gStats = globalTerrainStats.get(tr.id);
      const globalRecentBonus = gStats ? Math.min(gStats.recentMatches, 30) * 5 : 0;
      const globalTotalBonus = gStats ? Math.min(gStats.totalMatches, 100) : 0;
      const globalChallengeBonus = gStats ? Math.min(gStats.recentChallenges, 20) * 4 : 0;
      const globalChallengeTotalBonus = gStats ? Math.round(Math.min(gStats.totalChallenges, 50) * 0.5) : 0;
      const globalTournamentRecentBonus = gStats ? Math.min(gStats.recentTournaments, 10) * 8 : 0;
      const globalTournamentTotalBonus = gStats ? Math.min(gStats.totalTournaments, 30) * 2 : 0;

      // Score: weighted combination (user patterns + community stats)
      const hourScore = sameDayHourCount * 10;
      const dayScore = sameDayCount * 3;
      const totalScore = Math.min(terrainMatches.length, 10);
      const rawScore = hourScore + dayScore + totalScore + tournamentBonus + meetupBonus +
        globalRecentBonus + globalTotalBonus + globalChallengeBonus + globalChallengeTotalBonus +
        globalTournamentRecentBonus + globalTournamentTotalBonus;

      if (rawScore > 0) {
        const dayNames = language === 'fr'
          ? ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let peakLabel = '';

        if (meetupsToday.length > 0) {
          peakLabel = meetupsToday.length === 1
            ? `${language === 'fr' ? 'RDV prevu aujourd\'hui' : 'Meetup today'}`
            : `${meetupsToday.length} ${language === 'fr' ? 'RDV aujourd\'hui' : 'meetups today'}`;
        } else if (todayTournaments.length > 0) {
          peakLabel = todayTournaments.length === 1
            ? `${language === 'fr' ? 'Tournoi aujourd\'hui' : 'Tournament today'}`
            : `${todayTournaments.length} ${language === 'fr' ? 'tournois aujourd\'hui' : 'tournaments today'}`;
        } else if (gStats && gStats.peakDowCount > 0 && gStats.peakHourCount > 0) {
          const communityDayNames = language === 'fr'
            ? ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          peakLabel = `${language === 'fr' ? 'Pic' : 'Peak'}: ${communityDayNames[gStats.peakDow]} ~${gStats.peakHour}h (${gStats.peakHourCount})`;
        } else if (sameDayHourCount > 0) {
          peakLabel = `${sameDayHourCount} ${language === 'fr' ? 'partie(s)' : 'game(s)'} ${dayNames[currentDow]} ~${currentHour}h`;
        } else if (gStats && gStats.recentMatches + (gStats.recentChallenges || 0) > 0) {
          const recentTotal = gStats.recentMatches + (gStats.recentChallenges || 0);
          peakLabel = `${recentTotal} ${language === 'fr' ? 'activites ce mois' : 'activities this month'}`;
        } else if (gStats && gStats.totalMatches + (gStats.totalChallenges || 0) > 0) {
          const allTotal = gStats.totalMatches + (gStats.totalChallenges || 0);
          peakLabel = `${allTotal} ${language === 'fr' ? 'activites au total' : 'total activities'}`;
        } else if (sameDayCount > 0) {
          peakLabel = `${sameDayCount} ${language === 'fr' ? 'partie(s) le' : 'game(s) on'} ${dayNames[currentDow]}`;
        } else {
          peakLabel = language === 'fr' ? 'Terrain actif' : 'Active terrain';
        }

        const communityTotal = gStats ? gStats.totalMatches + gStats.totalChallenges : 0;
        scoreMap.set(tr.id, {
          score: rawScore,
          matchCount: communityTotal + terrainMatches.length + todayTournaments.length + meetupsToday.length,
          peakLabel,
          rank: 0,
          recentMatches: gStats?.recentMatches || 0,
          recentChallenges: gStats?.recentChallenges || 0,
          recentTournaments: gStats?.recentTournaments || 0,
        });
      }
    });

    // Compute popularity ranks
    const sorted = [...scoreMap.entries()].sort((a, b) => b[1].score - a[1].score);
    sorted.forEach(([id, data], index) => {
      scoreMap.set(id, { ...data, rank: index + 1 });
    });

    return scoreMap;
  }, [terrains, matches, tournaments, terrainMeetupsMap, language, globalTerrainStats]);

  return terrainActivityMap;
}
