/**
 * Sentry Crash Reporting Service
 *
 * Centralizes error capture and breadcrumb logging.
 * Wraps @sentry/react-native to provide a consistent API
 * and graceful fallback when the SDK is unavailable.
 *
 * Usage:
 *   import { captureException, captureMessage, addBreadcrumb, setUser } from '@/services/sentryService';
 *   captureException(error);
 *   captureMessage('Something happened', 'warning');
 *   addBreadcrumb({ category: 'match', message: 'Match saved', level: 'info' });
 *   setUser({ id: userId, email });
 */

let Sentry: any = null;
let _initialized = false;

/**
 * Initialize Sentry. Call once at app startup (in _layout.tsx).
 * If @sentry/react-native is not installed, logs a warning and continues.
 */
export async function initSentry(): Promise<void> {
  if (_initialized) return;
  try {
    // Use string indirection to prevent depcheck from auto-installing this optional dependency
    // @sentry/react-native requires a native plugin config — auto-install breaks EAS builds
    const sentryPackage = ['@sentry', 'react-native'].join('/');
    Sentry = await import(/* webpackIgnore: true */ sentryPackage);
    Sentry.init({
      dsn: 'YOUR_SENTRY_DSN — Sentry.io > Project Settings > Client Keys (DSN) > Copy DSN string (format: https://xxxxx@o00000.ingest.sentry.io/00000)',
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      tracesSampleRate: 0.2,
      enableNative: true,
      debug: __DEV__,
      beforeSend(event: any) {
        // Strip sensitive data
        if (event.user) {
          delete event.user.ip_address;
        }
        return event;
      },
    });
    _initialized = true;
    console.log('[Sentry] Initialized successfully');
  } catch (e) {
    // SDK not installed — silent degradation
    console.log('[Sentry] SDK not available, crash reporting disabled. Install @sentry/react-native to enable.');
    Sentry = null;
  }
}

/**
 * Capture an exception (error object).
 */
export function captureException(error: unknown, context?: Record<string, any>): void {
  if (Sentry) {
    if (context) {
      Sentry.withScope((scope: any) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  }
  // Always log to console in dev
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
  if (Sentry) {
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
  if (Sentry) {
    Sentry.addBreadcrumb(breadcrumb);
  }
}

/**
 * Set user context for error reports.
 * Call after login.
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  if (Sentry) {
    Sentry.setUser(user);
  }
}

/**
 * Set a tag for filtering in the Sentry dashboard.
 */
export function setTag(key: string, value: string): void {
  if (Sentry) {
    Sentry.setTag(key, value);
  }
}

/**
 * Wrap a component with Sentry error boundary.
 * Falls back to the component itself if Sentry is unavailable.
 */
export function wrapWithSentry<T>(component: T): T {
  if (Sentry?.wrap) {
    return Sentry.wrap(component);
  }
  return component;
}

/**
 * Navigation integration — call when route changes.
 */
export function setRoute(routeName: string): void {
  if (Sentry) {
    addBreadcrumb({
      category: 'navigation',
      message: `Navigate to ${routeName}`,
      level: 'info',
    });
  }
}
