import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getLastSyncTimestamp } from '@/services/cacheService';
import { getQueueSize } from '@/services/offlineQueueService';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import theme from '@/constants/theme';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isConnected } = useNetworkStatus();
  const { refreshData } = useApp();
  const { language } = useLanguage();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [, setTick] = useState(0);

  // Load last sync timestamp + queue size and refresh display every 30s
  useEffect(() => {
    const load = async () => {
      const ts = await getLastSyncTimestamp();
      setLastSync(ts);
      const qs = await getQueueSize();
      setQueueCount(qs);
    };
    load();
    const interval = setInterval(() => {
      load();
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTimeSinceSync = useCallback((): string => {
    if (!lastSync) {
      return language === 'fr' ? 'jamais synchronise' : 'never synced';
    }
    const diff = Date.now() - new Date(lastSync).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return language === 'fr' ? 'il y a moins d\'1 min' : 'less than 1 min ago';
    if (minutes < 60) return language === 'fr' ? `il y a ${minutes} min` : `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return language === 'fr' ? `il y a ${hours}h` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return language === 'fr' ? `il y a ${days}j` : `${days}d ago`;
  }, [lastSync, language]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
      const ts = await getLastSyncTimestamp();
      setLastSync(ts);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);

  if (isConnected) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.banner, { paddingTop: insets.top + 6 }]}
    >
      <View style={styles.iconContainer}>
        <MaterialIcons name="cloud-off" size={16} color="#FFF" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {language === 'fr' ? 'Mode hors-ligne' : 'Offline mode'}
        </Text>
        <Text style={styles.subtitle}>
          {language === 'fr' ? 'Derniere sync ' : 'Last sync '}
          {getTimeSinceSync()}
          {queueCount > 0 ? ` · ${queueCount} ${language === 'fr' ? 'en attente' : 'pending'}` : ''}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.refreshBtn, pressed && styles.refreshBtnPressed]}
        onPress={handleRefresh}
        disabled={refreshing}
        hitSlop={8}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <MaterialIcons name="refresh" size={20} color="#FFF" />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#B91C1C',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
