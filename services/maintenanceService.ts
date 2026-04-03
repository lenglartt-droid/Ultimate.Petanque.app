/**
 * Maintenance Service
 *
 * Fetches maintenance status from app_config table.
 * Used by MaintenanceBanner to display maintenance warnings/countdown.
 * Admins can trigger maintenance mode + push notifications.
 */

import { getSupabaseClient } from '@/template';
import { triggerServerPush } from '@/services/pushTokenService';

export interface MaintenanceStatus {
  isActive: boolean;
  messageFr: string | null;
  messageEn: string | null;
  endTime: string | null;
  startedAt: string | null;
}

/**
 * Fetch current maintenance status from app_config.
 * Uses anon-accessible RLS policy so it works for all users.
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('app_config')
      .select('maintenance_mode, maintenance_message_fr, maintenance_message_en, maintenance_end_time, maintenance_started_at')
      .eq('id', 'main')
      .single();

    if (error || !data) {
      return { isActive: false, messageFr: null, messageEn: null, endTime: null, startedAt: null };
    }

    return {
      isActive: data.maintenance_mode === true,
      messageFr: data.maintenance_message_fr,
      messageEn: data.maintenance_message_en,
      endTime: data.maintenance_end_time,
      startedAt: data.maintenance_started_at,
    };
  } catch {
    return { isActive: false, messageFr: null, messageEn: null, endTime: null, startedAt: null };
  }
}

/**
 * Enable maintenance mode (admin only).
 * Optionally sends push notification to all users.
 */
export async function enableMaintenance(params: {
  messageFr: string;
  messageEn: string;
  endTime?: string;
  sendPush?: boolean;
}): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('app_config')
      .update({
        maintenance_mode: true,
        maintenance_message_fr: params.messageFr,
        maintenance_message_en: params.messageEn,
        maintenance_end_time: params.endTime || null,
        maintenance_started_at: now,
        updated_at: now,
      })
      .eq('id', 'main');

    if (error) return { error: error.message };

    // Send push notification to all users
    if (params.sendPush) {
      await triggerServerPush('maintenance', {
        messageFr: params.messageFr,
        messageEn: params.messageEn,
        endTime: params.endTime || null,
      }).catch(() => {});
    }

    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Disable maintenance mode (admin only).
 */
export async function disableMaintenance(): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('app_config')
      .update({
        maintenance_mode: false,
        maintenance_message_fr: null,
        maintenance_message_en: null,
        maintenance_end_time: null,
        maintenance_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'main');

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ============================================================
// Maintenance History (maintenance_logs table)
// ============================================================

export interface MaintenanceLogEntry {
  id: string;
  adminUserId: string;
  adminName: string | null;
  action: 'enabled' | 'disabled';
  messageFr: string | null;
  messageEn: string | null;
  endTime: string | null;
  pushSent: boolean;
  createdAt: string;
}

/**
 * Log a maintenance action to maintenance_logs (admin only).
 */
export async function logMaintenanceAction(params: {
  action: 'enabled' | 'disabled';
  adminName?: string;
  messageFr?: string;
  messageEn?: string;
  endTime?: string;
  pushSent?: boolean;
}): Promise<{ error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { error: 'Not authenticated' };

    const { error } = await supabase.from('maintenance_logs').insert({
      admin_user_id: userData.user.id,
      admin_name: params.adminName || null,
      action: params.action,
      message_fr: params.messageFr || null,
      message_en: params.messageEn || null,
      end_time: params.endTime || null,
      push_sent: params.pushSent ?? false,
    });

    if (error) return { error: error.message };
    return { error: null };
  } catch (e: any) {
    return { error: e.message };
  }
}

/**
 * Fetch maintenance history from maintenance_logs (admin only).
 */
export async function getMaintenanceHistory(limit = 20): Promise<{ logs: MaintenanceLogEntry[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return { logs: [], error: error.message };

    const logs: MaintenanceLogEntry[] = (data || []).map((row: any) => ({
      id: row.id,
      adminUserId: row.admin_user_id,
      adminName: row.admin_name,
      action: row.action,
      messageFr: row.message_fr,
      messageEn: row.message_en,
      endTime: row.end_time,
      pushSent: row.push_sent,
      createdAt: row.created_at,
    }));

    return { logs, error: null };
  } catch (e: any) {
    return { logs: [], error: e.message };
  }
}
