/**
 * Announcement Service
 *
 * Manages admin announcements: create, send push, and fetch history.
 */

import { getSupabaseClient } from '@/template';
import { triggerServerPush } from '@/services/pushTokenService';

export interface Announcement {
  id: string;
  adminUserId: string;
  adminName: string | null;
  titleFr: string;
  titleEn: string;
  messageFr: string;
  messageEn: string;
  targetType: 'all' | 'city' | 'club' | 'level';
  targetValue: string | null;
  pushSentCount: number;
  pushErrorCount: number;
  createdAt: string;
}

/**
 * Send an announcement push notification and log it.
 */
export async function sendAnnouncement(params: {
  titleFr: string;
  titleEn: string;
  messageFr: string;
  messageEn: string;
  targetType: 'all' | 'city' | 'club' | 'level';
  targetValue?: string;
  adminName?: string;
}): Promise<{ error: string | null; pushSent?: number; pushErrors?: number }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Not authenticated' };

    // Send push via edge function
    const pushResult = await triggerServerPush('announcement', {
      titleFr: params.titleFr,
      titleEn: params.titleEn,
      messageFr: params.messageFr,
      messageEn: params.messageEn,
      targetType: params.targetType,
      targetValue: params.targetValue || null,
    }).catch(() => ({ sent: 0, errors: 0 }));

    // Log to announcements table
    const { error: logError } = await supabase.from('announcements').insert({
      admin_user_id: userData.user.id,
      admin_name: params.adminName || null,
      title_fr: params.titleFr,
      title_en: params.titleEn,
      message_fr: params.messageFr,
      message_en: params.messageEn,
      target_type: params.targetType,
      target_value: params.targetValue || null,
      push_sent_count: pushResult.sent || 0,
      push_error_count: pushResult.errors || 0,
    });

    if (logError) console.log('Error logging announcement:', logError.message);

    return { error: null, pushSent: pushResult.sent, pushErrors: pushResult.errors };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Fetch announcement history (admin only).
 */
export async function getAnnouncementHistory(limit = 30): Promise<{ announcements: Announcement[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { announcements: [], error: error.message };

    const announcements: Announcement[] = (data || []).map((row: any) => ({
      id: row.id,
      adminUserId: row.admin_user_id,
      adminName: row.admin_name,
      titleFr: row.title_fr,
      titleEn: row.title_en,
      messageFr: row.message_fr,
      messageEn: row.message_en,
      targetType: row.target_type,
      targetValue: row.target_value,
      pushSentCount: row.push_sent_count || 0,
      pushErrorCount: row.push_error_count || 0,
      createdAt: row.created_at,
    }));

    return { announcements, error: null };
  } catch (e: any) {
    return { announcements: [], error: e.message };
  }
}

/**
 * Get distinct cities from players, terrains, and clubs for targeting.
 */
export async function getTargetCities(): Promise<string[]> {
  try {
    const supabase = getSupabaseClient();
    const cities = new Set<string>();

    const { data: players } = await supabase.from('players').select('location').eq('user_id', (await supabase.auth.getUser()).data.user?.id || '');
    // Get from terrains
    const { data: terrains } = await supabase.from('terrains').select('city');
    (terrains || []).forEach((t: any) => { if (t.city) cities.add(t.city); });

    // Get from clubs
    const { data: clubs } = await supabase.from('clubs').select('city');
    (clubs || []).forEach((c: any) => { if (c.city) cities.add(c.city); });

    return [...cities].sort();
  } catch {
    return [];
  }
}

/**
 * Get distinct club names for targeting.
 */
export async function getTargetClubs(): Promise<{ id: string; name: string; city: string }[]> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('clubs').select('id, name, city').order('name');
    return (data || []).map((c: any) => ({ id: c.id, name: c.name, city: c.city }));
  } catch {
    return [];
  }
}
