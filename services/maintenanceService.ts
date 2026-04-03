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
