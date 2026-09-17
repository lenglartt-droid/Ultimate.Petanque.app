/**
 * Share Request Reminder Service
 *
 * Handles automatic reminders (24h + 72h) for pending share requests, and
 * notifies the sender when a request is auto-declined after 7 days with a
 * "Resend" option.
 */
import { getSupabaseClient } from '@/template';
import { triggerServerPush } from '@/services/pushTokenService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_STORAGE_KEY = '@shareReminderState';

interface ReminderState {
  /** requestId -> { sent24h: boolean; sent72h: boolean } */
  requests: Record<string, { sent24h: boolean; sent72h: boolean }>;
}

async function loadReminderState(): Promise<ReminderState> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* silent */ }
  return { requests: {} };
}

async function saveReminderState(state: ReminderState): Promise<void> {
  try {
    // Keep only the last 500 tracked requests to avoid unbounded growth
    const entries = Object.entries(state.requests);
    if (entries.length > 500) {
      state.requests = Object.fromEntries(entries.slice(-500));
    }
    await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(state));
  } catch { /* silent */ }
}

/**
 * Send push reminders for share requests that are pending 24 hours or 72 hours.
 * Uses AsyncStorage to track which reminders have already been sent per request.
 */
export async function sendPendingShareReminders(): Promise<{ sent24h: number; sent72h: number }> {
  const supabase = getSupabaseClient();
  let sent24h = 0;
  let sent72h = 0;

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { sent24h, sent72h };
    const senderId = userData.user.id;

    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch pending requests sent by current user, still within the 7-day window
    const { data: pending } = await supabase
      .from('match_share_requests')
      .select('id, recipient_user_id, item_type, item_id, sender_name, item_summary, created_at, permission')
      .eq('sender_user_id', senderId)
      .eq('status', 'pending')
      .gte('created_at', cutoff7d.toISOString());

    if (!pending || pending.length === 0) return { sent24h, sent72h };

    const state = await loadReminderState();

    for (const req of pending) {
      const createdAt = new Date(req.created_at);
      const tracked = state.requests[req.id] || { sent24h: false, sent72h: false };

      // 72h reminder (fires when request is 72h+ old and 72h reminder not sent)
      if (createdAt <= cutoff72h && !tracked.sent72h) {
        triggerServerPush('share_request_reminder', {
          recipientUserId: req.recipient_user_id,
          senderName: req.sender_name || 'Un joueur',
          itemType: req.item_type,
          permission: req.permission,
          itemSummary: req.item_summary,
          reminderLevel: '72h',
          hoursOverdue: Math.floor((now.getTime() - createdAt.getTime()) / (60 * 60 * 1000)),
        }).catch(() => {});
        tracked.sent72h = true;
        tracked.sent24h = true; // Consider 24h as already covered
        sent72h++;
      } else if (createdAt <= cutoff24h && !tracked.sent24h) {
        // 24h reminder
        triggerServerPush('share_request_reminder', {
          recipientUserId: req.recipient_user_id,
          senderName: req.sender_name || 'Un joueur',
          itemType: req.item_type,
          permission: req.permission,
          itemSummary: req.item_summary,
          reminderLevel: '24h',
          hoursOverdue: 24,
        }).catch(() => {});
        tracked.sent24h = true;
        sent24h++;
      }

      state.requests[req.id] = tracked;
    }

    await saveReminderState(state);
    return { sent24h, sent72h };
  } catch (e) {
    console.log('[ShareReminder] Error:', e);
    return { sent24h, sent72h };
  }
}

/**
 * Auto-decline all pending share requests older than 7 days and notify the
 * sender with a "Resend" option. Returns the list of auto-declined requests.
 */
export async function autoDeclineAndNotifyExpired(): Promise<{
  declined: { id: string; itemType: string; itemId: string; recipientUserId: string; senderUserId: string; senderName?: string; itemSummary?: string; permission: 'read' | 'write' }[];
}> {
  const supabase = getSupabaseClient();
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch expired requests first so we can push notifications
    const { data: expired } = await supabase
      .from('match_share_requests')
      .select('id, item_type, item_id, sender_user_id, recipient_user_id, sender_name, item_summary, permission')
      .eq('status', 'pending')
      .lt('created_at', sevenDaysAgo.toISOString());

    if (!expired || expired.length === 0) return { declined: [] };

    // Auto-decline
    for (const req of expired) {
      await supabase
        .from('match_share_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', req.id);

      // Notify the SENDER that the request expired, offering a Resend option
      triggerServerPush('share_request_expired', {
        recipientUserId: req.sender_user_id,
        originalRequestId: req.id,
        itemType: req.item_type,
        itemId: req.item_id,
        itemSummary: req.item_summary,
        permission: req.permission,
        targetRecipientUserId: req.recipient_user_id,
      }).catch(() => {});
    }

    return {
      declined: expired.map((r: any) => ({
        id: r.id,
        itemType: r.item_type,
        itemId: r.item_id,
        recipientUserId: r.recipient_user_id,
        senderUserId: r.sender_user_id,
        senderName: r.sender_name,
        itemSummary: r.item_summary,
        permission: r.permission,
      })),
    };
  } catch (e) {
    console.log('[ShareReminder] Auto-decline error:', e);
    return { declined: [] };
  }
}

/**
 * Resend a share request that was previously declined or expired. Creates a
 * new pending request with fresh timestamps.
 */
export async function resendShareRequest(params: {
  itemType: 'match' | 'challenge';
  itemId: string;
  recipientUserId: string;
  senderName?: string;
  itemSummary?: string;
  permission?: 'read' | 'write';
}): Promise<{ requestId: string | null; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return { requestId: null, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('match_share_requests')
      .upsert({
        item_type: params.itemType,
        item_id: params.itemId,
        sender_user_id: userData.user.id,
        recipient_user_id: params.recipientUserId,
        permission: params.permission || 'read',
        status: 'pending',
        sender_name: params.senderName || null,
        item_summary: params.itemSummary || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'item_type,item_id,recipient_user_id' })
      .select()
      .single();

    if (error) return { requestId: null, error: error.message };

    // Reset reminder tracking for this request so it can accrue fresh reminders
    if (data?.id) {
      try {
        const state = await loadReminderState();
        delete state.requests[data.id];
        await saveReminderState(state);
      } catch { /* silent */ }
    }

    triggerServerPush('share_request', {
      recipientUserId: params.recipientUserId,
      senderName: params.senderName || 'Un joueur',
      itemType: params.itemType,
      permission: params.permission || 'read',
      itemSummary: params.itemSummary,
    }).catch(() => {});

    return { requestId: data?.id || null, error: null };
  } catch (e: any) {
    return { requestId: null, error: e.message };
  }
}

/**
 * Full reminder pipeline: sends 24h/72h reminders, auto-declines 7-day-old
 * requests, and notifies senders with resend options. Intended to be called
 * on app foreground or via a periodic background task.
 */
export async function runShareReminderPipeline(): Promise<{
  reminders24h: number;
  reminders72h: number;
  autoDeclined: number;
}> {
  const [reminders, expired] = await Promise.all([
    sendPendingShareReminders(),
    autoDeclineAndNotifyExpired(),
  ]);

  return {
    reminders24h: reminders.sent24h,
    reminders72h: reminders.sent72h,
    autoDeclined: expired.declined.length,
  };
}
