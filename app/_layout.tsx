import React from 'react';
import { View, Text, ScrollView, StyleSheet as RNStyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
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
import { router } from 'expo-router';

// ============================================
// Safe lazy imports — prevent module-level crash on emulators
// ============================================
let SplashScreen: any = null;
try { SplashScreen = require('expo-splash-screen'); } catch { /* silent */ }

// Prevent auto-hide so we control when splash disappears
try { SplashScreen?.preventAutoHideAsync?.(); } catch { /* silent */ }

// ============================================
// Environment Variable Validation
// ============================================
function getEnvDiagnostics(): { valid: boolean; url: string; keyPrefix: string; errors: string[] } {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  const errors: string[] = [];

  if (!url) errors.push('EXPO_PUBLIC_SUPABASE_URL is missing or empty');
  else if (!url.startsWith('http')) errors.push(`EXPO_PUBLIC_SUPABASE_URL is malformed: "${url.substring(0, 30)}..."`);

  if (!key) errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is missing or empty');
  else if (key.length < 20) errors.push(`EXPO_PUBLIC_SUPABASE_ANON_KEY looks invalid (length: ${key.length})`);

  return {
    valid: errors.length === 0,
    url: url ? `${url.substring(0, 40)}...` : '(empty)',
    keyPrefix: key ? `${key.substring(0, 12)}...` : '(empty)',
    errors,
  };
}

const ENV_DIAGNOSTICS = getEnvDiagnostics();

// ============================================
// Error Boundary — catches JS crashes on web
// ============================================
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <ScrollView contentContainerStyle={errorStyles.scroll}>
            <Text style={errorStyles.icon}>⚠️</Text>
            <Text style={errorStyles.title}>Application Error</Text>
            <Text style={errorStyles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <Text style={errorStyles.stack}>
              {this.state.error?.stack?.substring(0, 800) || ''}
            </Text>
            <Pressable
              style={errorStyles.button}
              onPress={() => this.setState({ hasError: false, error: null })}
            >
              <Text style={errorStyles.buttonText}>Retry</Text>
            </Pressable>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = RNStyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center' },
  scroll: { padding: 24, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#F8FAFC', marginBottom: 12, textAlign: 'center' },
  message: { fontSize: 16, color: '#94A3B8', marginBottom: 16, textAlign: 'center', lineHeight: 24 },
  stack: { fontSize: 12, color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 24, textAlign: 'left', width: '100%' },
  button: { backgroundColor: '#3B82F6', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});

export default function RootLayout() {
  // If env vars are missing, show diagnostic screen immediately
  // instead of crashing silently inside providers
  if (!ENV_DIAGNOSTICS.valid) {
    return (
      <AppErrorBoundary>
        <SafeAreaProvider>
          <StartupDiagnosticScreen
            reason="env"
            envDiagnostics={ENV_DIAGNOSTICS}
          />
        </SafeAreaProvider>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}

// ============================================
// Startup Diagnostic Screen
// Shows when splash is stuck or env vars are missing
// ============================================
function StartupDiagnosticScreen({ reason, envDiagnostics }: {
  reason: 'timeout' | 'env';
  envDiagnostics?: ReturnType<typeof getEnvDiagnostics>;
}) {
  // Hide splash so diagnostic screen is visible
  React.useEffect(() => {
    try { SplashScreen?.hideAsync?.(); } catch { /* silent */ }
  }, []);

  const diag = envDiagnostics || ENV_DIAGNOSTICS;

  return (
    <View style={diagStyles.container}>
      <ScrollView contentContainerStyle={diagStyles.scroll}>
        <Text style={diagStyles.icon}>{reason === 'env' ? '🔑' : '⏱️'}</Text>
        <Text style={diagStyles.title}>
          {reason === 'env' ? 'Configuration Error' : 'Startup Timeout'}
        </Text>
        <Text style={diagStyles.subtitle}>
          {reason === 'env'
            ? 'Backend environment variables are missing or invalid.'
            : 'The app took too long to initialize. This may indicate a configuration issue.'}
        </Text>

        <View style={diagStyles.card}>
          <Text style={diagStyles.cardTitle}>Environment Variables</Text>
          <View style={diagStyles.row}>
            <Text style={diagStyles.label}>SUPABASE_URL:</Text>
            <Text style={[diagStyles.value, !diag.url || diag.url === '(empty)' ? diagStyles.bad : diagStyles.good]}>
              {diag.url}
            </Text>
          </View>
          <View style={diagStyles.row}>
            <Text style={diagStyles.label}>ANON_KEY:</Text>
            <Text style={[diagStyles.value, !diag.keyPrefix || diag.keyPrefix === '(empty)' ? diagStyles.bad : diagStyles.good]}>
              {diag.keyPrefix}
            </Text>
          </View>
        </View>

        {diag.errors.length > 0 ? (
          <View style={diagStyles.card}>
            <Text style={diagStyles.cardTitle}>Issues Found</Text>
            {diag.errors.map((err, i) => (
              <Text key={i} style={diagStyles.errorItem}>• {err}</Text>
            ))}
          </View>
        ) : null}

        <View style={diagStyles.card}>
          <Text style={diagStyles.cardTitle}>Platform Info</Text>
          <Text style={diagStyles.infoItem}>OS: {Platform.OS} ({Platform.Version})</Text>
          <Text style={diagStyles.infoItem}>DEV: {__DEV__ ? 'Yes' : 'No'}</Text>
          <Text style={diagStyles.infoItem}>Hermes: {typeof HermesInternal !== 'undefined' ? 'Yes' : 'No'}</Text>
        </View>

        <View style={diagStyles.card}>
          <Text style={diagStyles.cardTitle}>How to Fix</Text>
          <Text style={diagStyles.infoItem}>
            1. Go to OnSpace Cloud panel (right side) and verify backend is connected.
          </Text>
          <Text style={diagStyles.infoItem}>
            2. Check that .env file contains EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
          </Text>
          <Text style={diagStyles.infoItem}>
            3. Rebuild the APK — env vars are baked in at build time.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const diagStyles = RNStyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  scroll: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#F8FAFC', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, color: '#64748B', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  value: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', flexShrink: 1, textAlign: 'right', maxWidth: '60%' },
  good: { color: '#22C55E' },
  bad: { color: '#EF4444' },
  errorItem: { fontSize: 14, color: '#F87171', lineHeight: 22, marginBottom: 4 },
  infoItem: { fontSize: 14, color: '#CBD5E1', lineHeight: 22, marginBottom: 4 },
});

function LayoutInner() {
  const { currentConflict, conflictRemaining, resolveConflict } = useApp();
  const [showATT, setShowATT] = React.useState(false);
  const [showDiagnostics, setShowDiagnostics] = React.useState(false);

  // Hide splash screen once layout is mounted
  React.useEffect(() => {
    const hideSplash = async () => {
      try {
        await SplashScreen?.hideAsync?.();
      } catch (e) {
        console.log('[SplashScreen] Hide error:', e);
      }
    };
    // Small delay to ensure JS bundle is fully loaded
    const timer = setTimeout(hideSplash, 300);
    return () => clearTimeout(timer);
  }, []);

  // Startup timeout: if LayoutInner stays mounted but nothing renders
  // for 8 seconds, show diagnostic overlay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowDiagnostics(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // Reset diagnostic if the app successfully loaded data
  React.useEffect(() => {
    if (showDiagnostics) {
      // If we got here, the providers mounted successfully.
      // The diagnostic screen is just a safety net — dismiss if
      // the user interacts or the app continues normally.
    }
  }, [showDiagnostics]);

  // Initialize Sentry crash reporting (lazy import)
  React.useEffect(() => {
    try {
      const { initSentry } = require('@/services/sentryService');
      initSentry();
    } catch (e) { console.log('[Sentry] Init error:', e); }
  }, []);

  // ATT prompt (lazy import)
  React.useEffect(() => {
    try {
      const { isATTPromptNeeded } = require('@/services/trackingService');
      isATTPromptNeeded().then((needed: boolean) => {
        if (needed) setShowATT(true);
      }).catch(() => {});
    } catch { /* silent */ }
  }, []);

  // Register push token for server-side notifications (lazy import)
  React.useEffect(() => {
    try {
      const { registerPushToken } = require('@/services/pushTokenService');
      registerPushToken().catch(() => {});
    } catch { /* silent */ }
  }, []);

  // Check temp data expiry for non-registered users (lazy import)
  React.useEffect(() => {
    try {
      const { checkTempDataExpiry } = require('@/services/retentionNotificationService');
      checkTempDataExpiry().then(({ expired }: { expired: boolean }) => {
        if (expired) {
          console.log('[Retention] Temporary onboarding data expired and cleaned up');
        }
      }).catch(() => {});
    } catch { /* silent */ }
  }, []);

  // Handle deep links for event QR codes (?event=CODE) — lazy import
  React.useEffect(() => {
    let Linking: any = null;
    let findEventByCode: any = null;
    try {
      Linking = require('expo-linking');
      findEventByCode = require('@/services/sponsoredEventService').findEventByCode;
    } catch {
      return; // Cannot set up deep links
    }

    const handleDeepLinkUrl = async (url: string) => {
      if (!url || !findEventByCode) return;
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

    Linking.getInitialURL().then((url: string | null) => {
      if (url) handleDeepLinkUrl(url);
    }).catch(() => {});

    const sub = Linking.addEventListener('url', ({ url }: { url: string }) => handleDeepLinkUrl(url));
    return () => sub?.remove();
  }, []);

  // Navigate to match-invitations when user taps a share request notification (lazy import)
  React.useEffect(() => {
    let addNotificationResponseListener: any = null;
    try {
      addNotificationResponseListener = require('@/services/notificationService').addNotificationResponseListener;
    } catch {
      return; // Notifications not available
    }

    const sub = addNotificationResponseListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (!data?.type) return;
      // Small delay to ensure navigation stack is ready
      setTimeout(() => {
        switch (data.type) {
          case 'retention':
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
    return () => sub?.remove();
  }, []);
  // Show diagnostic overlay if stuck
  if (showDiagnostics) {
    return (
      <View style={{ flex: 1 }}>
        <StartupDiagnosticScreen reason="timeout" />
        <Pressable
          style={{ position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
          onPress={() => setShowDiagnostics(false)}
        >
          <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Dismiss and Continue</Text>
        </Pressable>
      </View>
    );
  }

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
                name="match-detail/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
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
                name="challenge/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
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
                name="ambassador-program" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="partner-program" 
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
                name="partnerships" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="sponsor-analytics" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="admin-sponsors" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="partner/[id]" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="sponsor-portal" 
                options={{ 
                  presentation: 'card',
                  animation: 'slide_from_right',
                }} 
              />
              <Stack.Screen 
                name="sponsor-digest" 
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
