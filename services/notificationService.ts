import { Platform } from 'react-native';
import * as Notifications from './nativeNotifications';

export interface TournamentNotificationSettings {
  tournamentId: string;
  tournamentName: string;
  tournamentDate: Date;
  oneWeekBefore: boolean;
  threeDaysBefore: boolean;
  oneDayBefore: boolean;
}

export interface ScheduledNotification {
  tournamentId: string;
  notificationIds: string[];
}

// Configure notification behavior (no-op on web via stub)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Storage for scheduled notification IDs
const scheduledNotifications: Map<string, string[]> = new Map();

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('tournament-reminders', {
        name: 'Rappels de tournoi',
        description: 'Notifications de rappel pour les tournois à venir',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('share-requests', {
        name: 'Partages de matchs',
        description: 'Notifications de demandes de partage de matchs et defis',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#3B82F6',
        sound: 'default',
      });
    }

    return true;
  } catch (error) {
    console.log('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.log('Error checking notification status:', error);
    return false;
  }
}

/**
 * Schedule tournament reminder notifications
 */
export async function scheduleTournamentNotifications(
  settings: TournamentNotificationSettings
): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const { tournamentId, tournamentName, tournamentDate, oneWeekBefore, threeDaysBefore, oneDayBefore } = settings;

  await cancelTournamentNotifications(tournamentId);

  const notificationIds: string[] = [];
  const now = new Date();

  const scheduleNotification = async (
    triggerDate: Date,
    title: string,
    body: string,
    identifier: string
  ): Promise<string | null> => {
    if (triggerDate <= now) return null;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { tournamentId, type: 'tournament_reminder' },
          sound: 'default',
          badge: 1,
          ...(Platform.OS === 'android' && { channelId: 'tournament-reminders' }),
        },
        trigger: {
          date: triggerDate,
          type: Notifications.SchedulableTriggerInputTypes.DATE,
        },
        identifier,
      });

      console.log(`Scheduled notification ${identifier} for ${triggerDate.toISOString()}`);
      return id;
    } catch (error) {
      console.log(`Error scheduling notification ${identifier}:`, error);
      return null;
    }
  };

  const formattedDate = tournamentDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (oneWeekBefore) {
    const d = new Date(tournamentDate);
    d.setDate(d.getDate() - 7);
    d.setHours(9, 0, 0, 0);
    const id = await scheduleNotification(d, '\u{1F3C6} Tournoi dans 1 semaine !', `${tournamentName} - ${formattedDate}. Preparez-vous !`, `tournament_${tournamentId}_1week`);
    if (id) notificationIds.push(id);
  }

  if (threeDaysBefore) {
    const d = new Date(tournamentDate);
    d.setDate(d.getDate() - 3);
    d.setHours(9, 0, 0, 0);
    const id = await scheduleNotification(d, '\u{1F3AF} Tournoi dans 3 jours !', `${tournamentName} approche. Preparez votre equipement !`, `tournament_${tournamentId}_3days`);
    if (id) notificationIds.push(id);
  }

  if (oneDayBefore) {
    const d = new Date(tournamentDate);
    d.setDate(d.getDate() - 1);
    d.setHours(18, 0, 0, 0);
    const id = await scheduleNotification(d, '\u26A1 Tournoi demain !', `${tournamentName} c'est demain ! Reposez-vous bien ce soir.`, `tournament_${tournamentId}_1day`);
    if (id) notificationIds.push(id);
  }

  if (notificationIds.length > 0) {
    scheduledNotifications.set(tournamentId, notificationIds);
  }

  return notificationIds;
}

/**
 * Cancel all notifications for a tournament
 */
export async function cancelTournamentNotifications(tournamentId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const storedIds = scheduledNotifications.get(tournamentId);
    if (storedIds) {
      for (const id of storedIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
      scheduledNotifications.delete(tournamentId);
    }

    const identifiers = [
      `tournament_${tournamentId}_1week`,
      `tournament_${tournamentId}_3days`,
      `tournament_${tournamentId}_1day`,
    ];

    for (const identifier of identifiers) {
      try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      } catch {
        // Ignore if not found
      }
    }

    console.log(`Cancelled notifications for tournament ${tournamentId}`);
  } catch (error) {
    console.log('Error cancelling notifications:', error);
  }
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications(): Promise<any[]> {
  if (Platform.OS === 'web') return [];
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.log('Error getting scheduled notifications:', error);
    return [];
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    scheduledNotifications.clear();
    console.log('All notifications cancelled');
  } catch (error) {
    console.log('Error cancelling all notifications:', error);
  }
}

/**
 * Send immediate test notification
 */
export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '\u{1F3AF} Test Ultimate Petanque',
        body: 'Les notifications fonctionnent correctement !',
        data: { type: 'test' },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    console.log('Error sending test notification:', error);
  }
}

/**
 * Send immediate notification for a new match/challenge share request.
 */
export async function sendShareRequestNotification(params: {
  senderName: string;
  itemType: 'match' | 'challenge';
  permission: 'read' | 'write';
  itemSummary?: string;
  requestId: string;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { senderName, itemType, permission, itemSummary, requestId } = params;
    const isMatch = itemType === 'match';
    const icon = isMatch ? '\u{1F3AF}' : '\u{1F3C6}';
    const typeLabel = isMatch ? 'match' : 'defi';
    const permLabel = permission === 'write' ? 'modification' : 'lecture seule';
    const title = `${icon} ${senderName} vous partage un ${typeLabel}`;
    const body = itemSummary
      ? `${itemSummary} (${permLabel})`
      : `Nouvelle demande de partage en ${permLabel}`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'share_request', requestId, itemType },
        sound: 'default',
        badge: 1,
        ...(Platform.OS === 'android' && { channelId: 'share-requests' }),
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.log('Error sending share request notification:', error);
  }
}

/**
 * Add notification response listener
 */
export function addNotificationResponseListener(
  callback: (response: any) => void
): { remove: () => void } {
  if (Platform.OS === 'web') return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (foreground)
 */
export function addNotificationReceivedListener(
  callback: (notification: any) => void
): { remove: () => void } {
  if (Platform.OS === 'web') return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(callback);
}
