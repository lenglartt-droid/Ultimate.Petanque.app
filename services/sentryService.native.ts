/**
 * Sentry Crash Reporting Service
 *
 * Centralizes error capture and breadcrumb logging.
 * Wraps @sentry/react-native to provide a consistent API
 * and graceful fallback when the SDK is unavailable.
 *
 * PRODUCTION SETUP:
 *   1. Replace SENTRY_DSN below with your real DSN from https://sentry.io → Settings → Client Keys (DSN)
 *   2. Replace organization/project in app.json → @sentry/react-native/expo plugin
 *   3. (Optional) Set SENTRY_AUTH_TOKEN env var for source map uploads during EAS builds
 *
 * Usage:
 *   import { captureException, captureMessage, addBreadcrumb, setUser } from '@/services/sentryService';
 *   captureException(error);
 *   captureMessage('Something happened', 'warning');
 *   addBreadcrumb({ category: 'match', message: 'Match saved', level: 'info' });
 *   setUser({ id: userId, email });
 */

import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '@/constants/config';

let _initialized = false;

/**
 * Initialize Sentry. Call once at app startup (in _layout.tsx).
 * Requires @sentry/react-native plugin in app.json and a valid DSN.
 */
export async function initSentry(): Promise<void> {
  if (_initialized) return;
  try {
    if (!SENTRY_DSN || SENTRY_DSN === 'YOUR_SENTRY_DSN') {
      console.log('[Sentry] No DSN configured, crash reporting disabled. Set SENTRY_DSN in constants/config.ts');
      return;
    }
    Sentry.init({
      dsn: SENTRY_DSN,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      profilesSampleRate: __DEV__ ? 0 : 0.1,
      enableNative: true,
      debug: __DEV__,
      environment: __DEV__ ? 'development' : 'production',
      beforeSend(event) {
        if (event.user) {
          delete event.user.ip_address;
        }
        return event;
      },
    });
    _initialized = true;
    console.log('[Sentry] Initialized successfully');
  } catch (e) {
    console.log('[Sentry] Initialization failed:', e);
  }
}

/**
 * Capture an exception (error object).
 */
export function captureException(error: unknown, context?: Record<string, any>): void {
  if (_initialized) {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  }
  if (__DEV__) {
    console.error('[Sentry] Exception:', error);
  }
}

/**
 * Capture a message with a severity level.
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  if (_initialized) {
    Sentry.captureMessage(message, level);
  }
  if (__DEV__) {
    console.log(`[Sentry] ${level}: ${message}`);
  }
}

/**
 * Add a breadcrumb for debugging context.
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, any>;
}): void {
  if (_initialized) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}

/**
 * Set user context for error reports.
 * Call after login.
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  if (_initialized) {
    Sentry.setUser(user);
  }
}

/**
 * Set a tag for filtering in the Sentry dashboard.
 */
export function setTag(key: string, value: string): void {
  if (_initialized) {
    Sentry.setTag(key, value);
  }
}

/**
 * Wrap a component with Sentry error boundary.
 * Falls back to the component itself if Sentry is unavailable.
 */
export function wrapWithSentry<T>(component: T): T {
  if (_initialized) {
    return Sentry.wrap(component);
  }
  return component;
}

/**
 * Navigation integration — call when route changes.
 */
export function setRoute(routeName: string): void {
  if (_initialized) {
    addBreadcrumb({
      category: 'navigation',
      message: `Navigate to ${routeName}`,
      level: 'info',
    });
  }
}
