import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
    // Check current status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    let finalStatus = existingStatus;
    
    // Request if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('tournament-reminders', {
        name: 'Rappels de tournoi',
        description: 'Notifications de rappel pour les tournois à venir',
        importance: Notifications.AndroidImportance.HIGH,
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
  const { tournamentId, tournamentName, tournamentDate, oneWeekBefore, threeDaysBefore, oneDayBefore } = settings;
  
  // Cancel any existing notifications for this tournament first
  await cancelTournamentNotifications(tournamentId);
  
  const notificationIds: string[] = [];
  const now = new Date();
  
  // Helper to schedule a notification
  const scheduleNotification = async (
    triggerDate: Date,
    title: string,
    body: string,
    identifier: string
  ): Promise<string | null> => {
    // Only schedule if the trigger date is in the future
    if (triggerDate <= now) {
      console.log(`Skipping notification ${identifier} - date already passed`);
      return null;
    }
    
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
  
  // Format tournament date for display
  const formattedDate = tournamentDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  
  // 1 week before (7 days)
  if (oneWeekBefore) {
    const oneWeekDate = new Date(tournamentDate);
    oneWeekDate.setDate(oneWeekDate.getDate() - 7);
    oneWeekDate.setHours(9, 0, 0, 0); // 9:00 AM
    
    const id = await scheduleNotification(
      oneWeekDate,
      '🏆 Tournoi dans 1 semaine !',
      `${tournamentName} - ${formattedDate}. Préparez-vous !`,
      `tournament_${tournamentId}_1week`
    );
    if (id) notificationIds.push(id);
  }
  
  // 3 days before
  if (threeDaysBefore) {
    const threeDaysDate = new Date(tournamentDate);
    threeDaysDate.setDate(threeDaysDate.getDate() - 3);
    threeDaysDate.setHours(9, 0, 0, 0); // 9:00 AM
    
    const id = await scheduleNotification(
      threeDaysDate,
      '🎯 Tournoi dans 3 jours !',
      `${tournamentName} approche. N'oubliez pas votre équipement !`,
      `tournament_${tournamentId}_3days`
    );
    if (id) notificationIds.push(id);
  }
  
  // 1 day before (eve)
  if (oneDayBefore) {
    const oneDayDate = new Date(tournamentDate);
    oneDayDate.setDate(oneDayDate.getDate() - 1);
    oneDayDate.setHours(18, 0, 0, 0); // 6:00 PM
    
    const id = await scheduleNotification(
      oneDayDate,
      '⚡ Tournoi demain !',
      `${tournamentName} c'est demain ! Reposez-vous bien ce soir.`,
      `tournament_${tournamentId}_1day`
    );
    if (id) notificationIds.push(id);
  }
  
  // Store notification IDs
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
    // Cancel by stored IDs
    const storedIds = scheduledNotifications.get(tournamentId);
    if (storedIds) {
      for (const id of storedIds) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
      scheduledNotifications.delete(tournamentId);
    }
    
    // Also try to cancel by identifier pattern (backup)
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
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
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
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 Test Ultimate Petanque',
        body: 'Les notifications fonctionnent correctement !',
        data: { type: 'test' },
        sound: 'default',
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.log('Error sending test notification:', error);
  }
}

/**
 * Add notification response listener
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (foreground)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}
