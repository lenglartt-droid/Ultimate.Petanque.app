import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider, AuthProvider } from '@/template';
import { AppProvider } from '@/contexts/AppContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/components/ui/Toast';
import OfflineBanner from '@/components/ui/OfflineBanner';
import ConflictResolutionModal from '@/components/ui/ConflictResolutionModal';
import { useApp } from '@/contexts/AppContext';
import TrackingConsentModal from '@/components/ui/TrackingConsentModal';
import { isATTPromptNeeded } from '@/services/trackingService';
import { initSentry, setUser as setSentryUser, setRoute as setSentryRoute } from '@/services/sentryService';
import { addNotificationResponseListener } from '@/services/notificationService';
import { registerPushToken } from '@/services/pushTokenService';
import { router } from 'expo-router';
import { checkTempDataExpiry } from '@/services/retentionNotificationService';
import { updateRetentionForRegisteredUser } from '@/services/retentionNotificationService';
import { checkAndTriggerWeeklyReset } from '@/services/weeklyLeaderboardService';
import * as Linking from 'expo-linking';
import { findEventByCode } from '@/services/sponsoredEventService';

export default function RootLayout() {
  return (
    <AlertProvider>
      <AuthProvider>
        <SafeAreaProvider>
          <LanguageProvider>
          <ToastProvider>
          <AppProvider>
            <LayoutInner />
          </AppProvider>
          </ToastProvider>
          </LanguageProvider>
        </SafeAreaProvider>
      </AuthProvider>
    </AlertProvider>
  );
}

function LayoutInner() {
  const { currentConflict, conflictRemaining, resolveConflict } = useApp();
  const [showATT, setShowATT] = React.useState(false);

  // Initialize Sentry crash reporting
  React.useEffect(() => {
    initSentry();
  }, []);

  React.useEffect(() => {
    isATTPromptNeeded().then(needed => {
      if (needed) setShowATT(true);
    });
  }, []);

  // Register push token for server-side notifications
  React.useEffect(() => {
    registerPushToken();
  }, []);

  // Check temp data expiry for non-registered users & update retention on login
  React.useEffect(() => {
    checkTempDataExpiry().then(({ expired }) => {
      if (expired) {
        console.log('[Retention] Temporary onboarding data expired and cleaned up');
      }
    });
  }, []);

  // Handle deep links for event QR codes (?event=CODE)
  React.useEffect(() => {
    const handleDeepLinkUrl = async (url: string) => {
      if (!url) return;
      const eventMatch = url.match(/[?&]event=([A-Z0-9-]+)/i);
      if (eventMatch) {
        const code = eventMatch[1].toUpperCase();
        setTimeout(async () => {
          try {
            const { event } = await findEventByCode(code);
            if (event) {
              router.push(`/sponsored-event/${event.id}` as any);
            } else {
              router.push({ pathname: '/sponsored-event/list', params: { joinCode: code } } as any);
            }
          } catch {
            router.push({ pathname: '/sponsored-event/list', params: { joinCode: code } } as any);
          }
        }, 500);
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleDeepLinkUrl(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLinkUrl(url));
    return () => sub.remove();
  }, []);

  // Navigate to match-invitations when user taps a share request notification
  React.useEffect(() => {
    const sub = addNotificationResponseListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (!data?.type) return;
      // Small delay to ensure navigation stack is ready
      setTimeout(() => {
        switch (data.type) {
          case 'retention':
            // Handle retention notification taps
            if (data.action === 'play_match') {
              router.push('/match/new' as any);
            } else if (data.action === 'register' || data.action === 'register_urgent') {
              router.push('/login' as any);
            } else if (data.action === 'view_stats') {
              router.push('/(tabs)/stats' as any);
            } else if (data.action === 'invite_partner') {
              router.push('/share-hub' as any);
            }
            break;
          case 'share_request':
            router.push({ pathname: '/notifications-hub', params: { tab: 'invitations' } } as any);
            break;
          case 'event_created':
          case 'event_reminder':
            if (data.eventId) router.push(`/sponsored-event/${data.eventId}` as any);
            else router.push('/sponsored-event/list' as any);
            break;
          case 'meetup_invitation':
            if (data.meetupId) router.push(`/meetup/${data.meetupId}` as any);
            else router.push('/meetup/invitations' as any);
            break;
          case 'ranking_changed':
            router.push('/leaderboard' as any);
            break;
          case 'witness_request':
            router.push({ pathname: '/notifications-hub', params: { tab: 'witness' } } as any);
            break;
          case 'witness_attested':
            if (data.matchId) router.push(`/match/${data.matchId}` as any);
            break;
          default:
            break;
        }
      }, 300);
    });
    return () => sub.remove();
  }, []);
  return (
            <View style={{ flex: 1 }}>
            <StatusBar style="dark" />
            <OfflineBanner />
            <TrackingConsentModal
              visible={showATT}
              onComplete={() => setShowATT(false)}
            />
            <ConflictResolutionModal
              visible={currentConflict !== null}
              conflict={currentConflict}
              onResolve={resolveConflict}
              remaining={conflictRemaining}
            />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen 
                name="player/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="club/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="tournament/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="match/new" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="match/[id]" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="player/edit/[id]" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="player/new" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="player/compare" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="player/me" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="club/new" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="club/edit/[id]" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="tournament/new" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="tournament/edit/[id]" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="challenge/new" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="sponsored-event/new" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="sponsored-event/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="sponsored-event/list" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="terrain/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="terrain/new" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="terrain/edit/[id]" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="meetup/new" 
                options={{ 
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
              <Stack.Screen 
                name="meetup/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="meetup/invitations" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="history" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="profile" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="login" 
                options={{ 
                  headerShown: false,
                  animation: 'fade',
                }} 
              />
              <Stack.Screen 
                name="onboarding" 
                options={{ 
                  headerShown: false,
                  animation: 'slide_from_right',
                  gestureEnabled: false,
                }} 
              />
              <Stack.Screen 
                name="faq" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="notifications" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="palmares" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="equipment" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="password" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="financial" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="merge-history" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="privacy-policy" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="terms" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="consent" 
                options={{ 
                  headerShown: false,
                  animation: 'fade',
                  gestureEnabled: false,
                }} 
              />
              <Stack.Screen 
                name="share" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="notifications-hub" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="share-hub" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="share-notifications" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="shared-items" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="match-invitations" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="sync-history" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="creator-note" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="leaderboard" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="export" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="remove-ads" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="partners" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="ambassadors" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="admin-promos" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="ambassador-dashboard" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="club-ranking/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="boules-ranking/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="notification-preferences" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="badges" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="city-leaderboard" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="trust-score" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="admin-anticheat" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="witness-invitations" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="scanner" 
                options={{ 
                  headerShown: false,
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }} 
              />
            </Stack>
            </View>
  );
}
