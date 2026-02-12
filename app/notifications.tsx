import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import {
  requestNotificationPermissions,
  areNotificationsEnabled,
  getAllScheduledNotifications,
  cancelTournamentNotifications,
  sendTestNotification,
  cancelAllNotifications,
} from '@/services/notificationService';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { tournaments, tournamentNotifications, toggleTournamentNotification, isTournamentNotificationEnabled } = useApp();
  
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [loading, setLoading] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);

  // Get tournaments with notifications enabled
  const tournamentsWithNotifications = useMemo(() => {
    return tournaments.filter(t => isTournamentNotificationEnabled(t.id));
  }, [tournaments, tournamentNotifications, isTournamentNotificationEnabled]);

  // Get upcoming tournaments (can enable notifications)
  const upcomingTournaments = useMemo(() => {
    const now = new Date();
    return tournaments.filter(t => {
      const tournamentDate = new Date(t.date);
      return tournamentDate > now && !isTournamentNotificationEnabled(t.id);
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [tournaments, tournamentNotifications, isTournamentNotificationEnabled]);

  // Check permission and scheduled notifications on mount
  useEffect(() => {
    const checkStatus = async () => {
      setLoading(true);
      try {
        const enabled = await areNotificationsEnabled();
        setPermissionStatus(enabled ? 'granted' : 'denied');
        
        const scheduled = await getAllScheduledNotifications();
        setScheduledCount(scheduled.length);
      } catch (error) {
        console.log('Error checking notification status:', error);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  // Request permission
  const handleRequestPermission = useCallback(async () => {
    Haptics.selectionAsync();
    const granted = await requestNotificationPermissions();
    setPermissionStatus(granted ? 'granted' : 'denied');
    
    if (!granted) {
      Alert.alert(
        'Autorisation requise',
        'Pour recevoir des rappels, activez les notifications dans les paramètres de votre téléphone.',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Ouvrir Paramètres', 
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          },
        ]
      );
    }
  }, []);

  // Disable notification for a tournament
  const handleDisableNotification = useCallback(async (tournamentId: string, tournamentName: string) => {
    Alert.alert(
      'Désactiver les rappels',
      `Voulez-vous désactiver les rappels pour "${tournamentName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await cancelTournamentNotifications(tournamentId);
            toggleTournamentNotification(tournamentId);
            
            // Refresh count
            const scheduled = await getAllScheduledNotifications();
            setScheduledCount(scheduled.length);
          }
        }
      ]
    );
  }, [toggleTournamentNotification]);

  // Navigate to tournament to enable notifications
  const handleEnableNotification = useCallback((tournamentId: string) => {
    Haptics.selectionAsync();
    router.push(`/tournament/${tournamentId}`);
  }, []);

  // Send test notification
  const handleTestNotification = useCallback(async () => {
    Haptics.selectionAsync();
    await sendTestNotification();
    Alert.alert('Test envoyé', 'Vous devriez recevoir une notification de test.');
  }, []);

  // Disable all notifications
  const handleDisableAll = useCallback(() => {
    if (tournamentsWithNotifications.length === 0) return;
    
    Alert.alert(
      'Tout désactiver',
      `Voulez-vous désactiver les rappels pour ${tournamentsWithNotifications.length} tournoi(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout désactiver',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await cancelAllNotifications();
            
            // Disable all in context
            for (const t of tournamentsWithNotifications) {
              toggleTournamentNotification(t.id);
            }
            
            setScheduledCount(0);
          }
        }
      ]
    );
  }, [tournamentsWithNotifications, toggleTournamentNotification]);

  // Calculate days until tournament
  const getDaysUntil = (date: string) => {
    const tournamentDate = new Date(date);
    const now = new Date();
    return Math.ceil((tournamentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.statusCard}>
          <View style={[
            styles.statusIconBox,
            { backgroundColor: permissionStatus === 'granted' ? theme.success + '20' : theme.warning + '20' }
          ]}>
            <MaterialIcons 
              name={permissionStatus === 'granted' ? 'notifications-active' : 'notifications-off'} 
              size={32} 
              color={permissionStatus === 'granted' ? theme.success : theme.warning} 
            />
          </View>
          <View style={styles.statusInfo}>
            <Text style={[
              styles.statusTitle,
              { color: permissionStatus === 'granted' ? theme.success : theme.warning }
            ]}>
              {permissionStatus === 'granted' ? 'Notifications activées' : 'Notifications désactivées'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {permissionStatus === 'granted' 
                ? `${scheduledCount} rappel(s) programmé(s)`
                : 'Activez pour recevoir des rappels'
              }
            </Text>
          </View>
          {permissionStatus !== 'granted' && (
            <Pressable style={styles.enableButton} onPress={handleRequestPermission}>
              <Text style={styles.enableButtonText}>Activer</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Test Notification */}
        {permissionStatus === 'granted' && (
          <Animated.View entering={FadeInDown.duration(300).delay(50)}>
            <Pressable style={styles.testButton} onPress={handleTestNotification}>
              <MaterialIcons name="send" size={20} color={theme.primary} />
              <Text style={styles.testButtonText}>Envoyer une notification test</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Active Notifications Section */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>RAPPELS ACTIFS</Text>
            {tournamentsWithNotifications.length > 0 && (
              <Pressable onPress={handleDisableAll}>
                <Text style={styles.disableAllText}>Tout désactiver</Text>
              </Pressable>
            )}
          </View>

          {tournamentsWithNotifications.length > 0 ? (
            <View style={styles.tournamentList}>
              {tournamentsWithNotifications.map((tournament, index) => {
                const daysUntil = getDaysUntil(tournament.date);
                const isPast = daysUntil < 0;
                
                return (
                  <Animated.View
                    key={tournament.id}
                    entering={FadeIn.duration(200).delay(index * 50)}
                  >
                    <Pressable 
                      style={[styles.tournamentCard, isPast && styles.tournamentCardPast]}
                      onPress={() => router.push(`/tournament/${tournament.id}`)}
                    >
                      <View style={styles.tournamentIconBox}>
                        <MaterialIcons 
                          name="emoji-events" 
                          size={24} 
                          color={isPast ? theme.textMuted : theme.carreauColor} 
                        />
                      </View>
                      <View style={styles.tournamentInfo}>
                        <Text style={[styles.tournamentName, isPast && styles.tournamentNamePast]} numberOfLines={1}>
                          {tournament.name}
                        </Text>
                        <View style={styles.tournamentMeta}>
                          <MaterialIcons name="event" size={12} color={theme.textMuted} />
                          <Text style={styles.tournamentMetaText}>
                            {new Date(tournament.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </Text>
                          {!isPast && (
                            <>
                              <View style={styles.dot} />
                              <Text style={[
                                styles.tournamentMetaText,
                                daysUntil <= 3 && { color: theme.warning, fontWeight: '600' }
                              ]}>
                                {daysUntil === 0 ? "Aujourd'hui" : daysUntil === 1 ? 'Demain' : `Dans ${daysUntil}j`}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      <Pressable
                        style={styles.disableButton}
                        onPress={() => handleDisableNotification(tournament.id, tournament.name)}
                        hitSlop={8}
                      >
                        <MaterialIcons name="notifications-off" size={20} color={theme.error} />
                      </Pressable>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="notifications-none" size={48} color={theme.textMuted} />
              <Text style={styles.emptyStateText}>Aucun rappel actif</Text>
              <Text style={styles.emptyStateHint}>
                Activez les rappels depuis la page d'un tournoi
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Upcoming Tournaments Section */}
        {upcomingTournaments.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TOURNOIS À VENIR</Text>
              <Text style={styles.sectionCount}>{upcomingTournaments.length}</Text>
            </View>

            <View style={styles.tournamentList}>
              {upcomingTournaments.slice(0, 5).map((tournament, index) => {
                const daysUntil = getDaysUntil(tournament.date);
                
                return (
                  <Animated.View
                    key={tournament.id}
                    entering={FadeIn.duration(200).delay(index * 50)}
                  >
                    <Pressable 
                      style={styles.upcomingCard}
                      onPress={() => handleEnableNotification(tournament.id)}
                    >
                      <View style={[styles.tournamentIconBox, { backgroundColor: theme.backgroundSecondary }]}>
                        <MaterialIcons name="emoji-events" size={24} color={theme.textSecondary} />
                      </View>
                      <View style={styles.tournamentInfo}>
                        <Text style={styles.upcomingName} numberOfLines={1}>
                          {tournament.name}
                        </Text>
                        <View style={styles.tournamentMeta}>
                          <MaterialIcons name="event" size={12} color={theme.textMuted} />
                          <Text style={styles.tournamentMetaText}>
                            {new Date(tournament.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </Text>
                          <View style={styles.dot} />
                          <Text style={styles.tournamentMetaText}>
                            Dans {daysUntil}j
                          </Text>
                        </View>
                      </View>
                      <View style={styles.addNotificationButton}>
                        <MaterialIcons name="add-alert" size={20} color={theme.primary} />
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {upcomingTournaments.length > 5 && (
              <Pressable 
                style={styles.viewAllButton}
                onPress={() => router.push('/(tabs)/directory')}
              >
                <Text style={styles.viewAllButtonText}>
                  Voir tous les tournois ({upcomingTournaments.length})
                </Text>
                <MaterialIcons name="chevron-right" size={18} color={theme.primary} />
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Info Card */}
        <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={20} color={theme.textMuted} />
          <Text style={styles.infoText}>
            Les rappels sont envoyés sous forme de notifications push locales. Ils fonctionnent même sans connexion internet. Vous pouvez configurer les horaires (1 semaine, 3 jours, veille) depuis la page de chaque tournoi.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  // Status Card
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  statusIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  enableButton: {
    backgroundColor: theme.warning,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Test Button
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary + '15',
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 24,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  disableAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.error,
  },
  // Tournament List
  tournamentList: {
    gap: 10,
  },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: theme.success,
    ...theme.shadows.card,
  },
  tournamentCardPast: {
    borderLeftColor: theme.textMuted,
    opacity: 0.7,
  },
  tournamentIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.carreauColor + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  tournamentNamePast: {
    color: theme.textSecondary,
  },
  tournamentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tournamentMetaText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.textMuted,
  },
  disableButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.error + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Upcoming Card
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    ...theme.shadows.card,
  },
  upcomingName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 4,
  },
  addNotificationButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  // Empty State
  emptyState: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 12,
  },
  emptyStateHint: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    gap: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 18,
  },
});
