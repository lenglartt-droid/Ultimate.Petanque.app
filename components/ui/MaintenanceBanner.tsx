/**
 * MaintenanceBanner
 *
 * Displays a prominent banner at the top of the app when maintenance mode is active.
 * Features a live countdown timer to estimated end time.
 * Polls app_config every 60s and auto-dismisses when maintenance ends.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useLanguage } from '@/hooks/useLanguage';
import { getMaintenanceStatus, MaintenanceStatus } from '@/services/maintenanceService';

const POLL_INTERVAL_MS = 60_000; // Check every 60s

export default function MaintenanceBanner() {
  const { language } = useLanguage();
  const fr = language === 'fr';
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [countdown, setCountdown] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    const result = await getMaintenanceStatus();
    setStatus(result);
    if (!result.isActive) {
      setDismissed(false); // Reset dismiss when maintenance ends
    }
  }, []);

  // Poll maintenance status
  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchStatus]);

  // Countdown timer
  useEffect(() => {
    if (!status?.isActive || !status.endTime) {
      setCountdown('');
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    const updateCountdown = () => {
      const end = new Date(status.endTime!).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setCountdown(fr ? 'Bientot termine' : 'Ending soon');
        // Re-fetch to check if maintenance ended
        fetchStatus();
        return;
      }

      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1_000);

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds.toString().padStart(2, '0')}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [status?.isActive, status?.endTime, fr, fetchStatus]);

  // Don't render if not active or dismissed
  if (!status?.isActive || dismissed) return null;

  const message = fr ? status.messageFr : status.messageEn;
  const fallbackMessage = fr
    ? 'Maintenance en cours. Certains services peuvent etre temporairement indisponibles.'
    : 'Maintenance in progress. Some services may be temporarily unavailable.';

  return (
    <Animated.View entering={FadeInDown.duration(400)} exiting={FadeOutUp.duration(300)} style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <MaterialIcons name="construction" size={20} color="#FFF" />
        </View>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{fr ? 'Maintenance' : 'Maintenance'}</Text>
            {countdown ? (
              <View style={styles.countdownBadge}>
                <MaterialIcons name="timer" size={12} color="#FFF" />
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.message} numberOfLines={3}>
            {message || fallbackMessage}
          </Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => setDismissed(true)} hitSlop={8}>
          <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 100,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  message: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 17,
    fontWeight: '500',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
