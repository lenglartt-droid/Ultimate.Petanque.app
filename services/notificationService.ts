import { Platform } from 'react-native';

// expo-notifications is native-only; lazy-load to avoid web bundler crash
let _Notifications: any = null;
let _notifReady = false;

async function getNotifications(): Promise<any> {
  if (Platform.OS === 'web') return null;
  if (!_notifReady) {
    try {
      _Notifications = await import('expo-notifications');
      // Configure notification behavior once
      _Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      _notifReady = true;
    } catch {
      _Notifications = null;
      _notifReady = true;
    }
  }
  return _Notifications;
}

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

// Storage for scheduled notification IDs
const scheduledNotifications: Map<string, string[]> = new Map();

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const Notif = await getNotifications();
    if (!Notif) return false;

    const { status: existingStatus } = await Notif.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notif.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notif.setNotificationChannelAsync('tournament-reminders', {
        name: 'Rappels de tournoi',
        description: 'Notifications de rappel pour les tournois à venir',
        importance: Notif.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
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
  try {
    const Notif = await getNotifications();
    if (!Notif) return false;
    const { status } = await Notif.getPermissionsAsync();
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
  const { tournamentId, tournamentName, tournamentDate, oneWeekBefore, threeDaysBefore, oneDayBefore } = settings;

  // Cancel any existing notifications for this tournament first
  await cancelTournamentNotifications(tournamentId);

  const Notif = await getNotifications();
  if (!Notif) return [];

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
      const id = await Notif.scheduleNotificationAsync({
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
          type: Notif.SchedulableTriggerInputTypes.DATE,
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
    const id = await scheduleNotification(d, '\u{1F3AF} Tournoi dans 3 jours !', `${tournamentName} approche. N'oubliez pas votre equipement !`, `tournament_${tournamentId}_3days`);
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
  try {
    const Notif = await getNotifications();
    if (!Notif) return;

    const storedIds = scheduledNotifications.get(tournamentId);
    if (storedIds) {
      for (const id of storedIds) {
        await Notif.cancelScheduledNotificationAsync(id);
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
        await Notif.cancelScheduledNotificationAsync(identifier);
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
  try {
    const Notif = await getNotifications();
    if (!Notif) return [];
    return await Notif.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.log('Error getting scheduled notifications:', error);
    return [];
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    const Notif = await getNotifications();
    if (!Notif) return;
    await Notif.cancelAllScheduledNotificationsAsync();
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
  try {
    const Notif = await getNotifications();
    if (!Notif) return;
    await Notif.scheduleNotificationAsync({
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
 * Add notification response listener
 */
export function addNotificationResponseListener(
  callback: (response: any) => void
): any {
  if (Platform.OS === 'web') return { remove: () => {} };
  // Synchronous access requires the module to be already loaded
  // This will be called after getNotifications() has been awaited elsewhere
  if (_Notifications) {
    return _Notifications.addNotificationResponseReceivedListener(callback);
  }
  // Fallback: load then subscribe
  let sub: any = null;
  getNotifications().then(Notif => {
    if (Notif) sub = Notif.addNotificationResponseReceivedListener(callback);
  });
  return { remove: () => { if (sub) sub.remove(); } };
}

/**
 * Add notification received listener (foreground)
 */
export function addNotificationReceivedListener(
  callback: (notification: any) => void
): any {
  if (Platform.OS === 'web') return { remove: () => {} };
  if (_Notifications) {
    return _Notifications.addNotificationReceivedListener(callback);
  }
  let sub: any = null;
  getNotifications().then(Notif => {
    if (Notif) sub = Notif.addNotificationReceivedListener(callback);
  });
  return { remove: () => { if (sub) sub.remove(); } };
}
