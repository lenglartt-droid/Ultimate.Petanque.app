/**
 * MiniGeoRankingWidget — compact geographic ranking widget for home page.
 * Shows top city, country, and continent by composite score.
 */
import React, { useState, useEffect, memo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { fetchGeoLeaderboard, GeoEntry } from '@/services/geoLeaderboardService';
import { getCountryFlag, getContinentFlag } from '@/constants/geoData';
import { Skeleton } from '@/components/ui/SkeletonLoader';

function MiniGeoRankingWidget() {
  const { language } = useLanguage();
  const fr = language === 'fr';
  const [topCity, setTopCity] = useState<GeoEntry | null>(null);
  const [topCountry, setTopCountry] = useState<GeoEntry | null>(null);
  const [topContinent, setTopContinent] = useState<GeoEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGeoLeaderboard().then(({ cities, countries, continents }) => {
      if (cities.length > 0) setTopCity(cities[0]);
      if (countries.length > 0) setTopCountry(countries[0]);
      if (continents.length > 0) setTopContinent(continents[0]);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Skeleton width={160} height={16} borderRadius={8} />
          <Skeleton width={80} height={14} borderRadius={8} />
        </View>
        <View style={s.row}>
          {[1, 2, 3].map(i => (
            <View key={i} style={s.cardSkeleton}>
              <Skeleton height={80} borderRadius={14} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Always show navigation buttons even if no qualified players yet
  if (!topCity && !topCountry && !topContinent) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <MaterialIcons name="public" size={18} color="#3B82F6" />
            <Text style={s.headerTitle}>{fr ? 'Classement Geographique' : 'Geographic Ranking'}</Text>
          </View>
        </View>
        <View style={s.row}>
          {[
            { label: fr ? 'Top Ville' : 'Top City', icon: 'location-city', color: '#3B82F6', gradient: ['#1E40AF', '#3B82F6'] as [string, string], tab: 'cities' },
            { label: fr ? 'Top Pays' : 'Top Country', icon: 'flag', color: '#10B981', gradient: ['#047857', '#10B981'] as [string, string], tab: 'countries' },
            { label: fr ? 'Top Continent' : 'Top Continent', icon: 'public', color: '#F59E0B', gradient: ['#B45309', '#F59E0B'] as [string, string], tab: 'continents' },
          ].map((item, idx) => (
            <Pressable
              key={idx}
              style={({ pressed }) => [s.card, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
              onPress={() => router.push({ pathname: '/leaderboard-geo', params: { tab: item.tab } } as any)}
            >
              <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardGradient}>
                <Text style={s.cardLabel}>{item.label}</Text>
                <View style={[s.cardIconWrap, { marginBottom: 8 }]}>
                  <MaterialIcons name={item.icon as any} size={16} color="#FFF" />
                </View>
                <Text style={s.cardEmptyText}>{fr ? 'A venir' : 'Coming'}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const items: { label: string; entry: GeoEntry; icon: string; color: string; gradient: [string, string]; flag?: string }[] = [];

  if (topCity) {
    items.push({
      label: fr ? 'Top Ville' : 'Top City',
      entry: topCity,
      icon: 'location-city',
      color: '#3B82F6',
      gradient: ['#1E40AF', '#3B82F6'],
    });
  }
  if (topCountry) {
    items.push({
      label: fr ? 'Top Pays' : 'Top Country',
      entry: topCountry,
      icon: 'flag',
      color: '#10B981',
      gradient: ['#047857', '#10B981'],
      flag: getCountryFlag(topCountry.label),
    });
  }
  if (topContinent) {
    items.push({
      label: fr ? 'Top Continent' : 'Top Continent',
      entry: topContinent,
      icon: 'public',
      color: '#F59E0B',
      gradient: ['#B45309', '#F59E0B'],
      flag: getContinentFlag(topContinent.label),
    });
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <MaterialIcons name="public" size={18} color="#3B82F6" />
          <Text style={s.headerTitle}>{fr ? 'Classement' : 'Ranking'}</Text>
        </View>
      </View>

      <View style={s.row}>
        {items.map((item, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [s.card, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
            onPress={() => {
              const tabParam = idx === 0 ? 'cities' : idx === 1 ? 'countries' : 'continents';
              router.push({ pathname: '/leaderboard-geo', params: { tab: tabParam } } as any);
            }}
          >
            <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardGradient}>
              <Text style={s.cardLabel}>{item.label}</Text>
              <View style={s.cardMainRow}>
                {item.flag ? (
                  <Text style={s.cardFlag}>{item.flag}</Text>
                ) : (
                  <View style={s.cardIconWrap}>
                    <MaterialIcons name={item.icon as any} size={16} color="#FFF" />
                  </View>
                )}
                <Text style={s.cardName} numberOfLines={1}>{item.entry.label}</Text>
              </View>
              <View style={s.cardStats}>
                <View style={s.cardStat}>
                  <Text style={s.cardStatValue}>{item.entry.avgElo}</Text>
                  <Text style={s.cardStatLabel}>ELO</Text>
                </View>
                <View style={s.cardStatDivider} />
                <View style={s.cardStat}>
                  <Text style={s.cardStatValue}>{item.entry.playerCount}</Text>
                  <Text style={s.cardStatLabel}>{fr ? 'Joueurs' : 'Players'}</Text>
                </View>
              </View>
              {item.entry.topPlayer ? (
                <View style={s.cardTop}>
                  <MaterialIcons name="emoji-events" size={10} color="rgba(255,255,255,0.7)" />
                  <Text style={s.cardTopText} numberOfLines={1}>{item.entry.topPlayer.name}</Text>
                </View>
              ) : null}
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default memo(MiniGeoRankingWidget);

const s = StyleSheet.create({
  container: { marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerLink: { fontSize: 12, fontWeight: '600', color: '#3B82F6' },
  row: { flexDirection: 'row', gap: 8 },
  card: { flex: 1, borderRadius: 16, overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 3 }, default: {} }) },
  cardSkeleton: { flex: 1 },
  cardGradient: { padding: 12, borderRadius: 16, minHeight: 120 },
  cardLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  cardMainRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardFlag: { fontSize: 18 },
  cardIconWrap: { width: 24, height: 24, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 13, fontWeight: '800', color: '#FFF', flex: 1 },
  cardStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 6, marginBottom: 6 },
  cardStat: { flex: 1, alignItems: 'center' },
  cardStatValue: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  cardStatLabel: { fontSize: 8, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  cardStatDivider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.2)' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTopText: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', flex: 1 },
  cardEmptyText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
});
