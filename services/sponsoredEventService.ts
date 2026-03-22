import { getSupabaseClient } from '@/template';

export interface SponsoredEvent {
  id: string;
  ambassadorId: string;
  creatorUserId: string;
  title: string;
  description?: string;
  challengeType: string;
  challengeMode: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  scope: 'terrain' | 'city' | 'country' | 'world';
  terrainId?: string;
  terrainName?: string;
  city?: string;
  country?: string;
  maxParticipants: number;
  minWitnesses: number;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  shareCode: string;
  resultsPublished: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined
  ambassadorName?: string;
  ambassadorPhoto?: string;
  ambassadorBadgeType?: string;
}

export interface SponsoredEventParticipant {
  id: string;
  eventId: string;
  userId: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  challengeId?: string;
  rank?: number;
  scoreValue?: number;
  respondedAt?: string;
  completedAt?: string;
  createdAt: string;
  // Joined
  userName?: string;
  userAvatar?: string;
  witnessCount?: number;
  witnessesAttested?: number;
}

export interface SponsoredEventWitness {
  id: string;
  eventId: string;
  participantId: string;
  witnessUserId: string;
  attested: boolean;
  attestedAt?: string;
  notes?: string;
  createdAt: string;
  // Joined
  witnessName?: string;
}

function generateEventCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EVT-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Get the ambassador record for the current user */
export async function getMyAmbassadorRecord(): Promise<{ ambassador: any | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { ambassador: null, error: 'Non authentifie' };

    const { data, error } = await supabase
      .from('ambassadors')
      .select('*')
      .eq('user_id', userData.user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) return { ambassador: null, error: error.message };
    return { ambassador: data, error: null };
  } catch (e: any) {
    return { ambassador: null, error: e.message };
  }
}

/** Create a sponsored event */
export async function createSponsoredEvent(data: {
  ambassadorId: string;
  title: string;
  description?: string;
  challengeType: string;
  challengeMode?: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  scope: 'terrain' | 'city' | 'country' | 'world';
  terrainId?: string;
  terrainName?: string;
  city?: string;
  country?: string;
  maxParticipants?: number;
  minWitnesses?: number;
}): Promise<{ event: SponsoredEvent | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { event: null, error: 'Non authentifie' };

    const shareCode = generateEventCode();

    const { data: event, error } = await supabase
      .from('sponsored_events')
      .insert({
        ambassador_id: data.ambassadorId,
        creator_user_id: userData.user.id,
        title: data.title,
        description: data.description || null,
        challenge_type: data.challengeType,
        challenge_mode: data.challengeMode || 'solo',
        event_date: data.eventDate,
        start_time: data.startTime,
        end_time: data.endTime,
        scope: data.scope,
        terrain_id: data.terrainId || null,
        terrain_name: data.terrainName || null,
        city: data.city || null,
        country: data.country || 'France',
        max_participants: data.maxParticipants || 50,
        min_witnesses: data.minWitnesses || 2,
        share_code: shareCode,
      })
      .select('*')
      .single();

    if (error) return { event: null, error: error.message };
    return { event: mapEvent(event), error: null };
  } catch (e: any) {
    return { event: null, error: e.message };
  }
}

/** Get all sponsored events (upcoming/active) */
export async function getSponsoredEvents(status?: string): Promise<{ events: SponsoredEvent[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('sponsored_events')
      .select('*, ambassadors(display_name, photo, badge_type)')
      .order('event_date', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['upcoming', 'active']);
    }

    const { data, error } = await query;
    if (error) return { events: [], error: error.message };

    const events = (data || []).map((e: any) => ({
      ...mapEvent(e),
      ambassadorName: e.ambassadors?.display_name,
      ambassadorPhoto: e.ambassadors?.photo,
      ambassadorBadgeType: e.ambassadors?.badge_type,
    }));

    return { events, error: null };
  } catch (e: any) {
    return { events: [], error: e.message };
  }
}

/** Get my created sponsored events */
export async function getMySponsoredEvents(): Promise<{ events: SponsoredEvent[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { events: [], error: 'Non authentifie' };

    const { data, error } = await supabase
      .from('sponsored_events')
      .select('*, ambassadors(display_name, photo, badge_type)')
      .eq('creator_user_id', userData.user.id)
      .order('event_date', { ascending: false });

    if (error) return { events: [], error: error.message };

    const events = (data || []).map((e: any) => ({
      ...mapEvent(e),
      ambassadorName: e.ambassadors?.display_name,
      ambassadorPhoto: e.ambassadors?.photo,
      ambassadorBadgeType: e.ambassadors?.badge_type,
    }));

    return { events, error: null };
  } catch (e: any) {
    return { events: [], error: e.message };
  }
}

/** Get a single sponsored event by ID */
export async function getSponsoredEvent(id: string): Promise<{ event: SponsoredEvent | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sponsored_events')
      .select('*, ambassadors(display_name, photo, badge_type)')
      .eq('id', id)
      .single();

    if (error) return { event: null, error: error.message };

    return {
      event: {
        ...mapEvent(data),
        ambassadorName: data.ambassadors?.display_name,
        ambassadorPhoto: data.ambassadors?.photo,
        ambassadorBadgeType: data.ambassadors?.badge_type,
      },
      error: null,
    };
  } catch (e: any) {
    return { event: null, error: e.message };
  }
}

/** Find event by share code */
export async function findEventByCode(code: string): Promise<{ event: SponsoredEvent | null; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sponsored_events')
      .select('*, ambassadors(display_name, photo, badge_type)')
      .eq('share_code', code.toUpperCase().trim())
      .maybeSingle();

    if (error || !data) return { event: null, error: 'Code introuvable' };

    return {
      event: {
        ...mapEvent(data),
        ambassadorName: data.ambassadors?.display_name,
        ambassadorPhoto: data.ambassadors?.photo,
        ambassadorBadgeType: data.ambassadors?.badge_type,
      },
      error: null,
    };
  } catch (e: any) {
    return { event: null, error: e.message };
  }
}

/** Register as participant */
export async function registerForEvent(eventId: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Non authentifie' };

    const { error } = await supabase
      .from('sponsored_event_participants')
      .upsert({
        event_id: eventId,
        user_id: userData.user.id,
        status: 'accepted',
        responded_at: new Date().toISOString(),
      }, { onConflict: 'event_id,user_id' });

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Decline participation */
export async function declineEvent(eventId: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Non authentifie' };

    const { error } = await supabase
      .from('sponsored_event_participants')
      .upsert({
        event_id: eventId,
        user_id: userData.user.id,
        status: 'declined',
        responded_at: new Date().toISOString(),
      }, { onConflict: 'event_id,user_id' });

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Get participants for an event */
export async function getEventParticipants(eventId: string): Promise<{ participants: SponsoredEventParticipant[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sponsored_event_participants')
      .select('*, user_profiles:user_id(username, avatar)')
      .eq('event_id', eventId)
      .order('rank', { ascending: true, nullsFirst: false });

    if (error) return { participants: [], error: error.message };

    // Get witness counts per participant
    const participantIds = (data || []).map((p: any) => p.id);
    let witnessMap = new Map<string, { total: number; attested: number }>();
    if (participantIds.length > 0) {
      const { data: witnesses } = await supabase
        .from('sponsored_event_witnesses')
        .select('participant_id, attested')
        .in('participant_id', participantIds);

      if (witnesses) {
        witnesses.forEach((w: any) => {
          const current = witnessMap.get(w.participant_id) || { total: 0, attested: 0 };
          current.total++;
          if (w.attested) current.attested++;
          witnessMap.set(w.participant_id, current);
        });
      }
    }

    const participants: SponsoredEventParticipant[] = (data || []).map((p: any) => {
      const wc = witnessMap.get(p.id);
      return {
        id: p.id,
        eventId: p.event_id,
        userId: p.user_id,
        status: p.status,
        challengeId: p.challenge_id,
        rank: p.rank,
        scoreValue: p.score_value ? parseFloat(p.score_value) : undefined,
        respondedAt: p.responded_at,
        completedAt: p.completed_at,
        createdAt: p.created_at,
        userName: p.user_profiles?.username || 'Utilisateur',
        userAvatar: p.user_profiles?.avatar,
        witnessCount: wc?.total || 0,
        witnessesAttested: wc?.attested || 0,
      };
    });

    return { participants, error: null };
  } catch (e: any) {
    return { participants: [], error: e.message };
  }
}

/** Submit challenge result for the event */
export async function submitEventResult(eventId: string, challengeId: string, scoreValue: number): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Non authentifie' };

    const { error } = await supabase
      .from('sponsored_event_participants')
      .update({
        challenge_id: challengeId,
        score_value: scoreValue,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .eq('user_id', userData.user.id);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Attest as witness for a participant */
export async function attestAsWitness(eventId: string, participantId: string, notes?: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Non authentifie' };

    const { error } = await supabase
      .from('sponsored_event_witnesses')
      .upsert({
        event_id: eventId,
        participant_id: participantId,
        witness_user_id: userData.user.id,
        attested: true,
        attested_at: new Date().toISOString(),
        notes: notes || null,
      }, { onConflict: 'event_id,witness_user_id,participant_id' });

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Get witnesses for a participant */
export async function getParticipantWitnesses(participantId: string): Promise<{ witnesses: SponsoredEventWitness[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sponsored_event_witnesses')
      .select('*, user_profiles:witness_user_id(username)')
      .eq('participant_id', participantId);

    if (error) return { witnesses: [], error: error.message };

    const witnesses: SponsoredEventWitness[] = (data || []).map((w: any) => ({
      id: w.id,
      eventId: w.event_id,
      participantId: w.participant_id,
      witnessUserId: w.witness_user_id,
      attested: w.attested,
      attestedAt: w.attested_at,
      notes: w.notes,
      createdAt: w.created_at,
      witnessName: w.user_profiles?.username || 'Utilisateur',
    }));

    return { witnesses, error: null };
  } catch (e: any) {
    return { witnesses: [], error: e.message };
  }
}

/** Publish results and compute rankings */
export async function publishResults(eventId: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();

    // Get all completed participants
    const { data: participants, error: pErr } = await supabase
      .from('sponsored_event_participants')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'completed')
      .not('score_value', 'is', null)
      .order('score_value', { ascending: false });

    if (pErr) return { error: pErr.message };

    // Assign ranks
    for (let i = 0; i < (participants || []).length; i++) {
      await supabase
        .from('sponsored_event_participants')
        .update({ rank: i + 1 })
        .eq('id', participants![i].id);
    }

    // Mark event as completed with results
    const { error } = await supabase
      .from('sponsored_events')
      .update({
        results_published: true,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Update event status */
export async function updateEventStatus(eventId: string, status: string): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('sponsored_events')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', eventId);

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** Cancel an event */
export async function cancelSponsoredEvent(eventId: string): Promise<{ error: string | null }> {
  return updateEventStatus(eventId, 'cancelled');
}

/** Get my participation status for an event */
export async function getMyParticipationStatus(eventId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return null;

    const { data, error } = await supabase
      .from('sponsored_event_participants')
      .select('status')
      .eq('event_id', eventId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error || !data) return null;
    return data.status;
  } catch {
    return null;
  }
}

/** Invite users to the event */
export async function inviteUsersToEvent(eventId: string, userIds: string[]): Promise<{ invited: number; error: string | null }> {
  try {
    if (userIds.length === 0) return { invited: 0, error: null };
    const supabase = getSupabaseClient();

    const { data: existing } = await supabase
      .from('sponsored_event_participants')
      .select('user_id')
      .eq('event_id', eventId)
      .in('user_id', userIds);

    const existingIds = new Set((existing || []).map((r: any) => r.user_id));
    const newIds = userIds.filter(uid => !existingIds.has(uid));
    if (newIds.length === 0) return { invited: 0, error: null };

    const rows = newIds.map(uid => ({
      event_id: eventId,
      user_id: uid,
      status: 'pending',
    }));

    const { error } = await supabase
      .from('sponsored_event_participants')
      .insert(rows);

    if (error) return { invited: 0, error: error.message };
    return { invited: newIds.length, error: null };
  } catch (e: any) {
    return { invited: 0, error: e.message };
  }
}

// ============ HELPERS ============

function mapEvent(e: any): SponsoredEvent {
  return {
    id: e.id,
    ambassadorId: e.ambassador_id,
    creatorUserId: e.creator_user_id,
    title: e.title,
    description: e.description,
    challengeType: e.challenge_type,
    challengeMode: e.challenge_mode || 'solo',
    eventDate: e.event_date,
    startTime: e.start_time,
    endTime: e.end_time,
    scope: e.scope,
    terrainId: e.terrain_id,
    terrainName: e.terrain_name,
    city: e.city,
    country: e.country,
    maxParticipants: e.max_participants,
    minWitnesses: e.min_witnesses,
    status: e.status,
    shareCode: e.share_code,
    resultsPublished: e.results_published,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}
