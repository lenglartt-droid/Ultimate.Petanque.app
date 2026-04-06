/**
 * activityFeedService — Aggregates community activity from public data sources.
 *
 * No manual posts — everything is auto-generated from:
 *   - ELO history (match results + rating changes)
 *   - User badges (unlocked achievements)
 *   - Weekly leaderboard snapshots (records & milestones)
 *   - Sponsored events (created/completed)
 *   - Terrain meetups (upcoming community gatherings)
 */
import { getSupabaseClient } from '@/template';
import { getEloRank } from '@/services/eloService';

// ============================================
// Types
// ============================================

export type FeedItemType =
  | 'match_result'
  | 'badge_unlock'
  | 'elo_milestone'
  | 'weekly_record'
  | 'event_created'
  | 'event_completed'
  | 'meetup_created'
  | 'club_invitation_sent'
  | 'club_invitation_accepted'
  | 'club_invitation_declined'
  | 'club_invitation_expired';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  timestamp: string;
  data: any;
}

export interface FeedMatchResult {
  playerName: string;
  playerId: string;
  playerAvatar?: string;
  playerCity?: string;
  eloBefore: number;
  eloAfter: number;
  eloDelta: number;
  opponentName?: string;
  opponentElo?: number;
  won: boolean;
}

export interface FeedBadgeUnlock {
  userId: string;
  username: string;
  avatar?: string;
  badgeId: string;
  unlockedAt: string;
}

export interface FeedEloMilestone {
  playerName: string;
  playerId: string;
  playerAvatar?: string;
  eloRating: number;
  rankName: string;
  rankColor: string;
  rankIcon: string;
}

export interface FeedWeeklyRecord {
  userId: string;
  username?: string;
  avatar?: string;
  rank: number;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  eloRating: number;
  city?: string;
  club?: string;
}

export interface FeedEventCreated {
  eventId: string;
  title: string;
  challengeType: string;
  ambassadorName?: string;
  eventDate: string;
  city?: string;
  maxParticipants: number;
}

export interface FeedMeetupCreated {
  meetupId: string;
  title: string;
  date: string;
  terrainName?: string;
  maxParticipants: number;
  shareCode: string;
}

export interface FeedClubInvitation {
  invitationId: string;
  clubId: string;
  clubName: string;
  clubLogo?: string;
  inviterName: string;
  inviterUserId: string;
  invitedPlayerName: string;
  invitedUserId?: string;
  status: 'pending' | 'accepted' | 'declined';
  declineReason?: string;
  message?: string;
}

// ============================================
// Fetch functions
// ============================================

/**
 * Fetches the activity feed — merges all sources and returns sorted by timestamp.
 * @param limit Max items per source
 */
export async function fetchActivityFeed(limit: number = 30): Promise<{ items: FeedItem[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const items: FeedItem[] = [];

  try {
    // Parallel fetch all sources
    const [eloRes, badgesRes, weeklyRes, eventsRes, meetupsRes, invitationsRes] = await Promise.all([
      // 1. Significant ELO changes (|delta| >= 15 for interesting moves)
      supabase
        .from('elo_history')
        .select('id, user_id, player_id, elo_before, elo_after, elo_delta, opponent_name, opponent_elo, won, recorded_at')
        .or('elo_delta.gte.15,elo_delta.lte.-15')
        .order('recorded_at', { ascending: false })
        .limit(limit),

      // 2. Recent badge unlocks
      supabase
        .from('user_badges')
        .select('id, user_id, badge_id, unlocked_at')
        .order('unlocked_at', { ascending: false })
        .limit(limit),

      // 3. Weekly leaderboard top performers (top 5 of current week)
      supabase
        .from('weekly_leaderboard_snapshots')
        .select('id, user_id, week_start, rank, matches_played, wins, win_rate, elo_rating, city, club')
        .lte('rank', 5)
        .order('week_start', { ascending: false })
        .limit(15),

      // 4. Sponsored events (recent)
      supabase
        .from('sponsored_events')
        .select('id, title, challenge_type, event_date, city, max_participants, status, created_at')
        .in('status', ['upcoming', 'active', 'completed'])
        .order('created_at', { ascending: false })
        .limit(limit),

      // 5. Recent meetups
      supabase
        .from('terrain_meetups')
        .select('id, title, date, terrain_name, max_participants, share_code, created_at, status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit),

      // 6. Club invitations (all statuses for activity feed)
      supabase
        .from('club_invitations')
        .select('id, club_id, club_name, club_logo, inviter_user_id, inviter_name, invited_player_name, invited_user_id, status, decline_reason, message, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit),
    ]);

    // Collect user IDs for name resolution
    const userIds = new Set<string>();
    const playerIds = new Set<string>();

    if (eloRes.data) {
      eloRes.data.forEach((r: any) => {
        userIds.add(r.user_id);
        playerIds.add(r.player_id);
      });
    }
    if (badgesRes.data) {
      badgesRes.data.forEach((r: any) => userIds.add(r.user_id));
    }
    if (weeklyRes.data) {
      weeklyRes.data.forEach((r: any) => userIds.add(r.user_id));
    }

    // Resolve player names + avatars in batch
    const playerMap = new Map<string, { name: string; avatar?: string; city?: string; eloRating?: number }>();
    const userMap = new Map<string, { username?: string; avatar?: string }>();

    if (playerIds.size > 0) {
      const { data: playersData } = await supabase
        .from('players')
        .select('id, name, avatar, city, elo_rating, is_public')
        .in('id', Array.from(playerIds))
        .eq('is_public', true);

      if (playersData) {
        playersData.forEach((p: any) => {
          playerMap.set(p.id, { name: p.name, avatar: p.avatar, city: p.city, eloRating: p.elo_rating });
        });
      }
    }

    if (userIds.size > 0) {
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('id, username, avatar, is_public_profile')
        .in('id', Array.from(userIds));

      if (profilesData) {
        profilesData.forEach((p: any) => {
          userMap.set(p.id, { username: p.username, avatar: p.avatar });
        });
      }
    }

    // Process ELO history → match_result + elo_milestone
    if (eloRes.data) {
      for (const row of eloRes.data) {
        const player = playerMap.get(row.player_id);
        if (!player) continue; // Skip non-public players

        items.push({
          id: `elo-${row.id}`,
          type: 'match_result',
          timestamp: row.recorded_at,
          data: {
            playerName: player.name,
            playerId: row.player_id,
            playerAvatar: player.avatar,
            playerCity: player.city,
            eloBefore: row.elo_before,
            eloAfter: row.elo_after,
            eloDelta: row.elo_delta,
            opponentName: row.opponent_name,
            opponentElo: row.opponent_elo,
            won: row.won,
          } as FeedMatchResult,
        });

        // Check for rank milestone (rank changed)
        const rankBefore = getEloRank(row.elo_before);
        const rankAfter = getEloRank(row.elo_after);
        if (rankBefore.name !== rankAfter.name && row.elo_delta > 0) {
          items.push({
            id: `milestone-${row.id}`,
            type: 'elo_milestone',
            timestamp: row.recorded_at,
            data: {
              playerName: player.name,
              playerId: row.player_id,
              playerAvatar: player.avatar,
              eloRating: row.elo_after,
              rankName: rankAfter.name,
              rankColor: rankAfter.color,
              rankIcon: rankAfter.icon,
            } as FeedEloMilestone,
          });
        }
      }
    }

    // Process badges
    if (badgesRes.data) {
      for (const row of badgesRes.data) {
        const profile = userMap.get(row.user_id);
        items.push({
          id: `badge-${row.id}`,
          type: 'badge_unlock',
          timestamp: row.unlocked_at,
          data: {
            userId: row.user_id,
            username: profile?.username || '???',
            avatar: profile?.avatar,
            badgeId: row.badge_id,
            unlockedAt: row.unlocked_at,
          } as FeedBadgeUnlock,
        });
      }
    }

    // Process weekly records
    if (weeklyRes.data) {
      for (const row of weeklyRes.data) {
        const profile = userMap.get(row.user_id);
        items.push({
          id: `weekly-${row.id}`,
          type: 'weekly_record',
          timestamp: row.week_start,
          data: {
            userId: row.user_id,
            username: profile?.username,
            avatar: profile?.avatar,
            rank: row.rank,
            matchesPlayed: row.matches_played,
            wins: row.wins,
            winRate: row.win_rate,
            eloRating: row.elo_rating,
            city: row.city,
            club: row.club,
          } as FeedWeeklyRecord,
        });
      }
    }

    // Process sponsored events
    if (eventsRes.data) {
      for (const row of eventsRes.data) {
        const isCompleted = row.status === 'completed';
        items.push({
          id: `event-${row.id}`,
          type: isCompleted ? 'event_completed' : 'event_created',
          timestamp: row.created_at,
          data: {
            eventId: row.id,
            title: row.title,
            challengeType: row.challenge_type,
            eventDate: row.event_date,
            city: row.city,
            maxParticipants: row.max_participants,
          } as FeedEventCreated,
        });
      }
    }

    // Process meetups
    if (meetupsRes.data) {
      for (const row of meetupsRes.data) {
        items.push({
          id: `meetup-${row.id}`,
          type: 'meetup_created',
          timestamp: row.created_at,
          data: {
            meetupId: row.id,
            title: row.title,
            date: row.date,
            terrainName: row.terrain_name,
            maxParticipants: row.max_participants,
            shareCode: row.share_code,
          } as FeedMeetupCreated,
        });
      }
    }

    // Process club invitations
    if (invitationsRes.data) {
      for (const row of invitationsRes.data) {
        const invData: FeedClubInvitation = {
          invitationId: row.id,
          clubId: row.club_id,
          clubName: row.club_name,
          clubLogo: row.club_logo || undefined,
          inviterName: row.inviter_name,
          inviterUserId: row.inviter_user_id,
          invitedPlayerName: row.invited_player_name,
          invitedUserId: row.invited_user_id || undefined,
          status: row.status,
          declineReason: row.decline_reason || undefined,
          message: row.message || undefined,
        };

        if (row.status === 'accepted') {
          items.push({
            id: `inv-accepted-${row.id}`,
            type: 'club_invitation_accepted',
            timestamp: row.updated_at || row.created_at,
            data: invData,
          });
        } else if (row.status === 'declined') {
          // Check if expired (decline_reason contains 'Expired')
          const isExpired = row.decline_reason && row.decline_reason.includes('Expired');
          items.push({
            id: `inv-${isExpired ? 'expired' : 'declined'}-${row.id}`,
            type: isExpired ? 'club_invitation_expired' : 'club_invitation_declined',
            timestamp: row.updated_at || row.created_at,
            data: invData,
          });
        } else {
          // pending = sent
          items.push({
            id: `inv-sent-${row.id}`,
            type: 'club_invitation_sent',
            timestamp: row.created_at,
            data: invData,
          });
        }
      }
    }

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return { items: unique.slice(0, 80), error: null };
  } catch (error: any) {
    console.error('[ActivityFeed] Error:', error);
    return { items: [], error: error.message || 'Failed to load feed' };
  }
}

/**
 * Fetches featured ambassadors and upcoming events for the header carousel.
 */
export async function fetchFeedCarouselData(): Promise<{
  ambassadors: any[];
  events: any[];
}> {
  const supabase = getSupabaseClient();
  try {
    const [ambRes, evtRes] = await Promise.all([
      supabase
        .from('ambassadors')
        .select('id, display_name, photo, badge_type, ambassador_level, bio, youtube_url, instagram_handle, tiktok_url, brand_color')
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('sort_order', { ascending: true })
        .limit(10),
      supabase
        .from('sponsored_events')
        .select('id, title, challenge_type, event_date, start_time, city, status, max_participants')
        .in('status', ['upcoming', 'active'])
        .order('event_date', { ascending: true })
        .limit(5),
    ]);

    return {
      ambassadors: ambRes.data || [],
      events: evtRes.data || [],
    };
  } catch {
    return { ambassadors: [], events: [] };
  }
}

// ============================================
// Weekly Digest
// ============================================

export interface WeeklyDigest {
  weekStart: string;
  topPlayers: { userId: string; username: string; avatar?: string; matchesPlayed: number; wins: number; winRate: number; eloRating: number }[];
  totalMatches: number;
  totalBadgesUnlocked: number;
  biggestEloMove: { playerName: string; playerId: string; delta: number; eloAfter: number } | null;
  mostUnlockedBadgeId: string | null;
  mostUnlockedBadgeCount: number;
}

/**
 * Fetches a weekly digest — aggregated stats for the current week (since Monday).
 * Top 3 players, most unlocked badge, biggest ELO move, total matches.
 */
export async function fetchWeeklyDigest(): Promise<{ digest: WeeklyDigest | null }> {
  const supabase = getSupabaseClient();
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString().split('T')[0];

    const [weeklyRes, badgesRes, eloRes] = await Promise.all([
      supabase
        .from('weekly_leaderboard_snapshots')
        .select('user_id, rank, matches_played, wins, win_rate, elo_rating')
        .eq('week_start', weekStart)
        .order('rank', { ascending: true })
        .limit(5),
      supabase
        .from('user_badges')
        .select('badge_id')
        .gte('unlocked_at', monday.toISOString()),
      supabase
        .from('elo_history')
        .select('player_id, elo_delta, elo_after')
        .gte('recorded_at', monday.toISOString())
        .order('elo_delta', { ascending: false })
        .limit(1),
    ]);

    // Resolve user names
    const userIds = new Set<string>();
    weeklyRes.data?.forEach((r: any) => userIds.add(r.user_id));
    const userMap = new Map<string, { username?: string; avatar?: string }>();
    if (userIds.size > 0) {
      const { data: profiles } = await supabase.from('user_profiles').select('id, username, avatar').in('id', Array.from(userIds));
      profiles?.forEach((p: any) => userMap.set(p.id, { username: p.username, avatar: p.avatar }));
    }

    // Resolve player name for biggest ELO move
    let biggestEloMove: WeeklyDigest['biggestEloMove'] = null;
    if (eloRes.data?.[0]) {
      const row = eloRes.data[0];
      const { data: playerData } = await supabase.from('players').select('name').eq('id', row.player_id).eq('is_public', true).single();
      if (playerData) {
        biggestEloMove = { playerName: playerData.name, playerId: row.player_id, delta: row.elo_delta, eloAfter: row.elo_after };
      }
    }

    // Most unlocked badge
    const badgeCounts = new Map<string, number>();
    badgesRes.data?.forEach((r: any) => {
      badgeCounts.set(r.badge_id, (badgeCounts.get(r.badge_id) || 0) + 1);
    });
    let mostUnlockedBadgeId: string | null = null;
    let mostUnlockedBadgeCount = 0;
    badgeCounts.forEach((count, id) => {
      if (count > mostUnlockedBadgeCount) {
        mostUnlockedBadgeCount = count;
        mostUnlockedBadgeId = id;
      }
    });

    const topPlayers = (weeklyRes.data || []).slice(0, 3).map((r: any) => {
      const profile = userMap.get(r.user_id);
      return {
        userId: r.user_id,
        username: profile?.username || '???',
        avatar: profile?.avatar,
        matchesPlayed: r.matches_played,
        wins: r.wins,
        winRate: r.win_rate,
        eloRating: r.elo_rating,
      };
    });

    const totalMatches = (weeklyRes.data || []).reduce((s: number, r: any) => s + (r.matches_played || 0), 0);

    return {
      digest: {
        weekStart,
        topPlayers,
        totalMatches,
        totalBadgesUnlocked: badgesRes.data?.length || 0,
        biggestEloMove,
        mostUnlockedBadgeId,
        mostUnlockedBadgeCount,
      },
    };
  } catch (e) {
    console.error('[WeeklyDigest] Error:', e);
    return { digest: null };
  }
}
