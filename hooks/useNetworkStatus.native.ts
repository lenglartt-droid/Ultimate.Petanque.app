import { useState, useEffect, useRef, useCallback } from 'react';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  /** True when device just came back online after being offline */
  justReconnected: boolean;
}

/**
 * Hook to monitor network connectivity status.
 * Provides `justReconnected` flag that flips to true once when the device
 * transitions from offline → online, then resets after the callback fires.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    let NetInfo: any = null;
    try {
      NetInfo = require('@react-native-community/netinfo').default;
    } catch (e) {
      console.log('[useNetworkStatus] NetInfo not available, assuming online');
      return;
    }

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = NetInfo.addEventListener((state: any) => {
        const connected = state?.isConnected ?? true;
        const reachable = state?.isInternetReachable;

        setIsConnected(connected);
        setIsInternetReachable(reachable);

        // Detect offline → online transition
        if (connected && (reachable === true || reachable === null) && wasOffline.current) {
          setJustReconnected(true);
          setTimeout(() => setJustReconnected(false), 500);
        }

        wasOffline.current = !connected;
      });
    } catch (e) {
      console.log('[useNetworkStatus] addEventListener error:', e);
    }

    // Initial check
    try {
      NetInfo.fetch().then((state: any) => {
        const connected = state?.isConnected ?? true;
        setIsConnected(connected);
        setIsInternetReachable(state?.isInternetReachable);
        wasOffline.current = !connected;
      }).catch(() => {});
    } catch { /* silent */ }

    return () => { try { unsubscribe?.(); } catch { /* silent */ } };
  }, []);

  return { isConnected, isInternetReachable, justReconnected };
}
