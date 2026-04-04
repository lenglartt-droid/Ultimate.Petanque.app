/**
 * ShareCardStats — Personal statistics card for social sharing.
 * Shows win rate, ELO, shot stats, geo rank, streak.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme } from '@/services/shareCardService';

interface Props {
  playerName?: string;
  avatar?: string;
  eloRating?: number;
  eloColor?: string;
  eloRankLabel?: string;
  matchesPlayed: number;
  winRate: number;
  tirRate: number;
  pointRate: number;
  carreauRate: number;
  currentStreak?: number;
  bestStreak?: number;
  geoCity?: string;
  geoCountry?: string;
  geoCityRank?: number;
  geoCountryRank?: number;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
}

export default function ShareCardStats({
  playerName, eloRating, eloColor, eloRankLabel,
  matchesPlayed, winRate, tirRate, pointRate, carreauRate,
  currentStreak, bestStreak,
  geoCity, geoCountry, geoCityRank, geoCountryRank,
  language = 'fr',
  colorTheme = 'dark',
}: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];

  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={s.bg}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <MaterialIcons name="bar-chart" size={16} color={ct.accent} />
            <Text style={[s.headerLabel, { color: ct.accent }]}>{fr ? 'MES STATS' : 'MY STATS'}</Text>
          </View>
        </View>

        {/* Player name + ELO */}
        <View style={s.playerRow}>
          <Text style={[s.playerName, { color: ct.textPrimary }]}>{playerName || (fr ? 'Joueur' : 'Player')}</Text>
          {eloRating ? (
            <View style={[s.eloBadge, { backgroundColor: (eloColor || ct.textSecondary) + '20' }]}>
              <MaterialIcons name="diamond" size={12} color={eloColor || ct.textSecondary} />
              <Text style={[s.eloText, { color: eloColor || ct.textSecondary }]}>ELO {eloRating}</Text>
              {eloRankLabel ? <Text style={[s.eloRank, { color: eloColor || ct.textSecondary }]}>{eloRankLabel}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Key stats grid */}
        <View style={s.statsGrid}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{matchesPlayed}</Text>
            <Text style={s.statLabel}>{fr ? 'Matchs' : 'Matches'}</Text>
          </View>
          <View style={[s.statBox, { borderColor: '#22C55E20' }]}>
            <Text style={[s.statValue, { color: '#22C55E' }]}>{winRate}%</Text>
            <Text style={s.statLabel}>{fr ? 'Victoires' : 'Win Rate'}</Text>
          </View>
          <View style={[s.statBox, { borderColor: '#3B82F620' }]}>
            <Text style={[s.statValue, { color: '#3B82F6' }]}>{tirRate}%</Text>
            <Text style={s.statLabel}>{fr ? 'Tir' : 'Shot'}</Text>
          </View>
          <View style={[s.statBox, { borderColor: '#F59E0B20' }]}>
            <Text style={[s.statValue, { color: '#F59E0B' }]}>{carreauRate}%</Text>
            <Text style={s.statLabel}>Carreau</Text>
          </View>
        </View>

        {/* Point rate bar */}
        <View style={s.barSection}>
          <View style={s.barHeader}>
            <MaterialIcons name="adjust" size={14} color="#10B981" />
            <Text style={s.barLabel}>{fr ? 'Point' : 'Point'}</Text>
            <Text style={[s.barValue, { color: '#10B981' }]}>{pointRate}%</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.max(4, pointRate)}%`, backgroundColor: '#10B981' }]} />
          </View>
        </View>

        {/* Streak + Geo row */}
        <View style={s.bottomRow}>
          {(currentStreak !== undefined && currentStreak > 0) ? (
            <View style={s.streakChip}>
              <MaterialIcons name="local-fire-department" size={14} color="#F97316" />
              <Text style={s.streakText}>{currentStreak} {fr ? 'jours' : 'days'}</Text>
              {bestStreak ? <Text style={s.streakBest}>({fr ? 'record' : 'best'}: {bestStreak})</Text> : null}
            </View>
          ) : null}
          {geoCity && geoCityRank ? (
            <View style={s.geoChip}>
              <MaterialIcons name="location-city" size={12} color="#3B82F6" />
              <Text style={s.geoText}>#{geoCityRank} {geoCity}</Text>
            </View>
          ) : null}
          {geoCountry && geoCountryRank ? (
            <View style={s.geoChip}>
              <MaterialIcons name="flag" size={12} color="#10B981" />
              <Text style={s.geoText}>#{geoCountryRank} {geoCountry}</Text>
            </View>
          ) : null}
        </View>

        <ShareCardWatermark variant="light" size="sm" />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden' },
  bg: { padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  playerName: { fontSize: 22, fontWeight: '800', flex: 1 },
  eloBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  eloText: { fontSize: 13, fontWeight: '700' },
  eloRank: { fontSize: 10, fontWeight: '600', marginLeft: 2 },
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginBottom: 2 },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#64748B', letterSpacing: 0.3 },
  barSection: { marginBottom: 16 },
  barHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  barLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  barValue: { fontSize: 14, fontWeight: '800' },
  barTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  bottomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 12 },
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9731615', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  streakText: { fontSize: 12, fontWeight: '700', color: '#F97316' },
  streakBest: { fontSize: 10, fontWeight: '500', color: '#64748B' },
  geoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  geoText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
});
