/**
 * Sentry Crash Reporting Service — Web no-op stub
 * Prevents the web bundler from resolving @sentry/react-native
 */

export async function initSentry(): Promise<void> {}

export function captureException(error: unknown, _context?: Record<string, any>): void {
  if (__DEV__) console.error('[Sentry-web] Exception:', error);
}

export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info'
): void {
  if (__DEV__) console.log(`[Sentry-web] ${level}: ${message}`);
}

export function addBreadcrumb(_breadcrumb: {
  category?: string;
  message?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, any>;
}): void {}

export function setUser(_user: { id: string; email?: string; username?: string } | null): void {}

export function setTag(_key: string, _value: string): void {}

export function wrapWithSentry<T>(component: T): T {
  return component;
}

export function setRoute(_routeName: string): void {}
