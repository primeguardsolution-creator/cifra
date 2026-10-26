import * as Sentry from '@sentry/react';
import { Platform } from 'react-native';

/**
 * Error reports (Sentry, free plan). The DSN is public by design: it only lets the app send errors in. Web only (the PWA).
 * Privacy: no personal data is attached (only the account id), no performance tracing, no session replay, and noisy network errors are ignored.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? 'https://037676b1ec8f3fa9af78358948d918fd@o4512324229595136.ingest.de.sentry.io/4512324278812752';

let on = false;
export function initMonitoring() {
  if (on || Platform.OS !== 'web' || typeof window === 'undefined' || !DSN || __DEV__) return;
  on = true;
  Sentry.init({
    dsn: DSN,
    environment: 'production',
    release: process.env.EXPO_PUBLIC_BUILD_ID || undefined,
    tracesSampleRate: 0,
    ignoreErrors: [/ResizeObserver loop/i, /Failed to fetch|Load failed|NetworkError|Network request failed/i, /AbortError/i, /The operation was aborted/i, /Non-Error promise rejection/i],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i, /^safari-(web-)?extension:/i],
    beforeBreadcrumb: (b) => (b.category === 'ui.input' ? null : b), // never keep what people type
  });
}

/** Ties reports to the account id (never the phone, name or messages). */
export function setMonitoringUser(id: string | null) {
  if (!on) return;
  Sentry.setUser(id ? { id } : null);
}

export function reportError(error: unknown, where?: string) {
  if (!on) return;
  Sentry.captureException(error, where ? { tags: { where } } : undefined);
}
