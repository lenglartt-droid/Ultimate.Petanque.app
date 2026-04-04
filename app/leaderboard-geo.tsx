import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { fetchGeoLeaderboard, GeoEntry } from '@/services/geoLeaderboardService';
import { getCountryFlag, getContinentFlag, getContinentLabel } from '@/constants/geoData';

type GeoTab = 'cities' | 'countries' | 'continents';

const TAB_CONFIG: { id: GeoTab; icon: string; color: string }[] = [
  { id: 'cities', icon: 'location-city', color: '#3B82F6' },
  { id: 'countries', icon: 'flag', color: '#10B981' },
  { id: 'continents', icon: 'public', color: '#F59E0B' },
];

function MedalBadge({ rank }: { rank: number }) {
  if (rank > 3) return null;
  const colors = ['#F59E0B', '#94A3B8', '#CD7F32'];
  const icons = ['emoji-events', 'emoji-events', 'emoji-events'];
  return (
    <View style={[styles.medalBadge, { backgroundColor: colors[rank - 1] + '20' }]}>
      <MaterialIcons name={icons[rank - 1] as any} size={14} color={colors[rank - 1]} />
    </View>
  );
}

function GeoCard({ entry, rank, tab, isFr }: { entry: GeoEntry; rank: number; tab: GeoTab; isFr: boolean }) {
  const isTop3 = rank <= 3;
  const borderColors = ['#F59E0B', '#94A3B8', '#CD7F32'];

  const flag = tab === 'countries'
    ? getCountryFlag(entry.key)
    : tab === 'continents'
      ? getContinentFlag(entry.key)
      : null;

  const displayLabel = tab === 'continents'
    ? getContinentLabel(entry.key, isFr)
    : entry.label;

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(rank * 40, 400))}>
      <View style={[
        styles.card,
        isTop3 && { borderLeftWidth: 3, borderLeftColor: borderColors[rank - 1] },
      ]}>
        <View style={styles.cardLeft}>
          <View style={styles.rankBox}>
            {isTop3 ? <MedalBadge rank={rank} /> : (
              <Text style={styles.rankText}>{rank}</Text>
            )}
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              {flag ? <Text style={styles.cardFlag}>{flag}</Text> : null}
              <Text style={styles.cardName} numberOfLines={1}>{displayLabel}</Text>
            </View>
            <View style={styles.cardMetaRow}>
              <View style={styles.cardMetaItem}>
                <MaterialIcons name="people" size={12} color={theme.textMuted} />
                <Text style={styles.cardMetaText}>
                  {entry.playerCount} {isFr ? 'joueur' : 'player'}{entry.playerCount > 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.cardMetaDot} />
              <View style={styles.cardMetaItem}>
                <MaterialIcons name="sports" size={12} color={theme.textMuted} />
                <Text style={styles.cardMetaText}>{entry.totalMatches} {isFr ? 'matchs' : 'games'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardRight}>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>ELO</Text>
            <Text style={[styles.statPillValue, { color: '#8B5CF6' }]}>{entry.avgElo}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillLabel}>{isFr ? 'Vict.' : 'Win'}</Text>
            <Text style={[styles.statPillValue, { color: theme.success }]}>{entry.avgWinRate}%</Text>
          </View>
        </View>
      </View>
      {entry.topPlayer ? (
        <View style={styles.topPlayerRow}>
          <MaterialIcons name="star" size={12} color="#F59E0B" />
          <Text style={styles.topPlayerText}>
            {isFr ? 'Meilleur' : 'Best'}: {entry.topPlayer.name} ({entry.topPlayer.elo} ELO)
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function GeoLeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const [tab, setTab] = useState<GeoTab>('cities');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cities, setCities] = useState<GeoEntry[]>([]);
  const [countries, setCountries] = useState<GeoEntry[]>([]);
  const [continents, setContinents] = useState<GeoEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await fetchGeoLeaderboard();
      if (result.error) {
        setError(result.error);
      } else {
        setCities(result.cities);
        setCountries(result.countries);
        setContinents(result.continents);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const currentData = useMemo(() => {
    switch (tab) {
      case 'cities': return cities;
      case 'countries': return countries;
      case 'continents': return continents;
    }
  }, [tab, cities, countries, continents]);

  const totalPlayers = useMemo(() => {
    return countries.reduce((sum, c) => sum + c.playerCount, 0);
  }, [countries]);

  const tabLabels: Record<GeoTab, string> = {
    cities: isFr ? 'Villes' : 'Cities',
    countries: isFr ? 'Pays' : 'Countries',
    continents: isFr ? 'Continents' : 'Continents',
  };

  const renderItem = useCallback(({ item, index }: { item: GeoEntry; index: number }) => (
    <GeoCard entry={item} rank={index + 1} tab={tab} isFr={isFr} />
  ), [tab, isFr]);

  const keyExtractor = useCallback((item: GeoEntry) => `${tab}-${item.key}`, [tab]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isFr ? 'Classement Geographique' : 'Geographic Ranking'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {totalPlayers} {isFr ? 'joueurs publics' : 'public players'}
          </Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TAB_CONFIG.map(t => {
          const isActive = tab === t.id;
          return (
            <Pressable
              key={t.id}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setTab(t.id)}
            >
              <MaterialIcons
                name={t.icon as any}
                size={18}
                color={isActive ? t.color : theme.textMuted}
              />
              <Text style={[
                styles.tabLabel,
                isActive && { color: t.color, fontWeight: '700' },
              ]}>
                {tabLabels[t.id]}
              </Text>
              {isActive ? <View style={[styles.tabIndicator, { backgroundColor: t.color }]} /> : null}
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{isFr ? 'Chargement...' : 'Loading...'}</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={48} color={theme.error} />
          <Text style={styles.emptyTitle}>{isFr ? 'Erreur' : 'Error'}</Text>
          <Text style={styles.emptyDesc}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => loadData()}>
            <Text style={styles.retryBtnText}>{isFr ? 'Reessayer' : 'Retry'}</Text>
          </Pressable>
        </View>
      ) : currentData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="public" size={56} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>
            {isFr ? 'Aucune donnee' : 'No data'}
          </Text>
          <Text style={styles.emptyDesc}>
            {tab === 'cities'
              ? (isFr ? 'Les joueurs publics avec une localisation apparaitront ici' : 'Public players with a location will appear here')
              : (isFr ? 'Les joueurs publics apparaitront ici' : 'Public players will appear here')
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.primary} />
          }
          ListHeaderComponent={
            <Animated.View entering={FadeIn.duration(300)} style={styles.listHeader}>
              <View style={styles.listHeaderIcon}>
                <MaterialIcons
                  name={TAB_CONFIG.find(t => t.id === tab)?.icon as any || 'public'}
                  size={16}
                  color={TAB_CONFIG.find(t => t.id === tab)?.color || theme.primary}
                />
              </View>
              <Text style={styles.listHeaderText}>
                {currentData.length} {tabLabels[tab].toLowerCase()} {isFr ? 'classees' : 'ranked'}
              </Text>
            </Animated.View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  headerSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 2 },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border, paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4, position: 'relative',
  },
  tabItemActive: {},
  tabLabel: { fontSize: 12, fontWeight: '500', color: theme.textMuted },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: '20%', right: '20%',
    height: 3, borderRadius: 1.5,
  },

  // Content
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: theme.textMuted },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  emptyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: theme.borderRadius.md, marginTop: 8,
  },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 4,
  },
  listHeaderIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center',
  },
  listHeaderText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 14, marginBottom: 2, ...theme.shadows.card,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardRight: { flexDirection: 'row', gap: 8 },
  rankBox: { width: 32, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 15, fontWeight: '700', color: theme.textSecondary },
  medalBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 4 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardFlag: { fontSize: 16 },
  cardName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardMetaText: { fontSize: 11, color: theme.textMuted },
  cardMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted },

  // Stat pills
  statPill: { alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statPillLabel: { fontSize: 9, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5 },
  statPillValue: { fontSize: 13, fontWeight: '700' },

  // Top player
  topPlayerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 58, paddingBottom: 10,
  },
  topPlayerText: { fontSize: 11, color: theme.textMuted, fontStyle: 'italic' },
});
