/**
 * ShareCardLeague — League Rank shareable card for social media.
 * Shows league emblem, world rank #X, ELO progression mini-chart (30 days),
 * league progress bar, and QR watermark.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme, type ShareCardFormat } from '@/services/shareCardService';
import { LeagueTier } from '@/services/globalRankingService';

interface EloPoint {
  elo: number;
  won: boolean;
}

interface GeoRankInfo {
  city?: { name?: string; rank?: number };
  country?: { name?: string; rank?: number };
}

interface Props {
  playerName: string;
  elo: number;
  leagueTier: LeagueTier;
  worldRank?: number | null;
  worldTotal?: number;
  progress: number; // 0-100 to next tier
  eloToNext: number;
  nextTierEmblem?: string;
  eloHistory: EloPoint[];
  matchesPlayed: number;
  wins: number;
  winRate: number;
  clubName?: string;
  geoRank?: GeoRankInfo | null;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
  format?: ShareCardFormat;
}

function MiniEloChart({ data, width, height, tierColor }: { data: EloPoint[]; width: number; height: number; tierColor: string }) {
  if (data.length < 2) return null;
  const elos = data.map(d => d.elo);
  const minElo = Math.min(...elos) - 20;
  const maxElo = Math.max(...elos) + 20;
  const range = Math.max(maxElo - minElo, 30);
  const padL = 2;
  const padR = 2;
  const padT = 4;
  const padB = 4;
  const gW = width - padL - padR;
  const gH = height - padT - padB;
  const step = data.length > 1 ? gW / (data.length - 1) : gW;

  const toX = (i: number) => padL + i * step;
  const toY = (elo: number) => padT + gH - ((elo - minElo) / range) * gH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.elo)}`).join(' ');
  const lastIdx = data.length - 1;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(pct => (
        <Line key={pct} x1={padL} y1={padT + gH * pct} x2={width - padR} y2={padT + gH * pct} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      ))}
      {/* Line */}
      <Polyline points={points} fill="none" stroke={tierColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
      {/* Last point */}
      <Circle cx={toX(lastIdx)} cy={toY(data[lastIdx].elo)} r={4} fill={tierColor} stroke="#FFF" strokeWidth={1.5} />
      {/* First point */}
      <Circle cx={toX(0)} cy={toY(data[0].elo)} r={2.5} fill="rgba(255,255,255,0.4)" />
    </Svg>
  );
}

export default function ShareCardLeague({
  playerName, elo, leagueTier, worldRank, worldTotal,
  progress, eloToNext, nextTierEmblem,
  eloHistory, matchesPlayed, wins, winRate,
  clubName, geoRank,
  language = 'fr', colorTheme = 'dark', format = 'square',
}: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];
  const isStory = format === 'story';
  const isLandscape = format === 'landscape';
  const tierGrad = leagueTier.gradient;

  const eloDelta = eloHistory.length >= 2 ? eloHistory[eloHistory.length - 1].elo - eloHistory[0].elo : 0;

  // === LANDSCAPE ===
  if (isLandscape) {
    return (
      <View style={s.card}>
        <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <MaterialIcons name="leaderboard" size={10} color={leagueTier.color} />
            <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 1, color: leagueTier.color }}>{fr ? 'CLASSEMENT LIGUE' : 'LEAGUE RANKING'}</Text>
          </View>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* Left: league info */}
            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <LinearGradient colors={tierGrad} style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>{leagueTier.emblem}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: ct.textPrimary }}>{fr ? leagueTier.name.fr : leagueTier.name.en}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: ct.textSecondary }}>{playerName}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                <View style={[s.statChip, { borderColor: leagueTier.color + '25' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: leagueTier.color }}>{elo}</Text>
                  <Text style={{ fontSize: 6, color: ct.textSecondary }}>ELO</Text>
                </View>
                {worldRank ? (
                  <View style={[s.statChip, { borderColor: 'rgba(255,255,255,0.08)' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: ct.textPrimary }}>#{worldRank}</Text>
                    <Text style={{ fontSize: 6, color: ct.textSecondary }}>{fr ? 'Mondial' : 'World'}</Text>
                  </View>
                ) : null}
                <View style={[s.statChip, { borderColor: '#22C55E25' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#22C55E' }}>{winRate}%</Text>
                  <Text style={{ fontSize: 6, color: ct.textSecondary }}>{fr ? 'Victoires' : 'Win'}</Text>
                </View>
              </View>
              {/* Geo */}
              {geoRank ? (
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {geoRank.city?.rank ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 4 }}>
                      <MaterialIcons name="place" size={7} color="#3B82F6" />
                      <Text style={{ fontSize: 7, fontWeight: '600', color: ct.textSecondary }}>#{geoRank.city.rank} {geoRank.city.name}</Text>
                    </View>
                  ) : null}
                  {geoRank.country?.rank ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 4 }}>
                      <MaterialIcons name="flag" size={7} color="#10B981" />
                      <Text style={{ fontSize: 7, fontWeight: '600', color: ct.textSecondary }}>#{geoRank.country.rank} {geoRank.country.name}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 6 }} />
            {/* Right: chart */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <MiniEloChart data={eloHistory.slice(-20)} width={160} height={70} tierColor={leagueTier.color} />
              {eloDelta !== 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                  <MaterialIcons name={eloDelta > 0 ? 'trending-up' : 'trending-down'} size={10} color={eloDelta > 0 ? '#22C55E' : '#EF4444'} />
                  <Text style={{ fontSize: 9, fontWeight: '800', color: eloDelta > 0 ? '#22C55E' : '#EF4444' }}>{eloDelta > 0 ? '+' : ''}{eloDelta} ELO</Text>
                  <Text style={{ fontSize: 7, color: ct.textSecondary }}>{fr ? 'recent' : 'recent'}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <ShareCardWatermark variant="light" size="sm" />
        </LinearGradient>
      </View>
    );
  }

  // === STORY / SQUARE ===
  const pad = isStory ? 24 : 16;
  const emblemSize = isStory ? 56 : 44;
  const chartW = isStory ? 260 : 220;
  const chartH = isStory ? 100 : 70;

  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: pad, justifyContent: isStory ? 'center' : 'space-between' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: isStory ? 14 : 8 }}>
          <MaterialIcons name="leaderboard" size={isStory ? 14 : 12} color={leagueTier.color} />
          <Text style={{ fontSize: isStory ? 10 : 8, fontWeight: '800', letterSpacing: 1.5, color: leagueTier.color }}>{fr ? 'CLASSEMENT LIGUE' : 'LEAGUE RANKING'}</Text>
        </View>

        {/* League emblem + tier name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: isStory ? 14 : 10, marginBottom: isStory ? 16 : 10 }}>
          <LinearGradient colors={tierGrad} style={{ width: emblemSize, height: emblemSize, borderRadius: emblemSize / 3, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ fontSize: emblemSize * 0.5 }}>{leagueTier.emblem}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: isStory ? 22 : 17, fontWeight: '900', color: ct.textPrimary, letterSpacing: -0.3 }}>{fr ? leagueTier.name.fr : leagueTier.name.en}</Text>
            <Text style={{ fontSize: isStory ? 14 : 12, fontWeight: '600', color: ct.textSecondary, marginTop: 2 }}>{playerName}</Text>
            {clubName ? <Text style={{ fontSize: isStory ? 11 : 9, fontWeight: '500', color: ct.textSecondary, marginTop: 1 }}>{clubName}</Text> : null}
          </View>
        </View>

        {/* ELO + World Rank row */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: isStory ? 14 : 10 }}>
          <LinearGradient colors={tierGrad} style={[s.eloBadge, isStory && { paddingVertical: 10, paddingHorizontal: 16 }]}>
            <Text style={{ fontSize: isStory ? 26 : 20, fontWeight: '900', color: '#FFF' }}>{elo}</Text>
            <Text style={{ fontSize: isStory ? 9 : 7, fontWeight: '600', color: 'rgba(255,255,255,0.6)' }}>ELO</Text>
          </LinearGradient>
          {worldRank ? (
            <View style={[s.rankBadge, isStory && { paddingVertical: 10, paddingHorizontal: 16 }]}>
              <Text style={{ fontSize: isStory ? 9 : 7, fontWeight: '600', color: ct.textSecondary }}>{fr ? 'Rang mondial' : 'World Rank'}</Text>
              <Text style={{ fontSize: isStory ? 24 : 18, fontWeight: '900', color: ct.textPrimary }}>#{worldRank.toLocaleString()}</Text>
              {worldTotal ? <Text style={{ fontSize: isStory ? 8 : 6, fontWeight: '500', color: ct.textSecondary }}>{fr ? 'sur' : 'of'} {worldTotal.toLocaleString()}</Text> : null}
            </View>
          ) : null}
          <View style={[s.rankBadge, isStory && { paddingVertical: 10, paddingHorizontal: 16 }]}>
            <Text style={{ fontSize: isStory ? 9 : 7, fontWeight: '600', color: ct.textSecondary }}>{fr ? 'Victoires' : 'Win Rate'}</Text>
            <Text style={{ fontSize: isStory ? 24 : 18, fontWeight: '900', color: '#22C55E' }}>{winRate}%</Text>
            <Text style={{ fontSize: isStory ? 8 : 6, fontWeight: '500', color: ct.textSecondary }}>{matchesPlayed} {fr ? 'matchs' : 'matches'}</Text>
          </View>
        </View>

        {/* Progress to next tier */}
        {eloToNext > 0 && nextTierEmblem ? (
          <View style={{ marginBottom: isStory ? 14 : 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Text style={{ fontSize: isStory ? 10 : 8, fontWeight: '600', color: ct.textSecondary, flex: 1 }}>{fr ? 'Prochaine ligue' : 'Next league'}</Text>
              <Text style={{ fontSize: isStory ? 10 : 8, fontWeight: '700', color: leagueTier.color }}>{eloToNext} → {nextTierEmblem}</Text>
            </View>
            <View style={{ height: isStory ? 6 : 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <LinearGradient colors={tierGrad} style={{ height: '100%', width: `${Math.max(progress, 3)}%`, borderRadius: 3 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            </View>
          </View>
        ) : null}

        {/* ELO Mini Chart */}
        {eloHistory.length >= 2 ? (
          <View style={{ alignItems: 'center', marginBottom: isStory ? 14 : 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: isStory ? 10 : 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, alignSelf: 'flex-start' }}>
              <MaterialIcons name="show-chart" size={isStory ? 12 : 10} color={leagueTier.color} />
              <Text style={{ fontSize: isStory ? 9 : 7, fontWeight: '700', color: ct.textSecondary }}>{fr ? 'PROGRESSION' : 'PROGRESSION'}</Text>
              {eloDelta !== 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 }}>
                  <MaterialIcons name={eloDelta > 0 ? 'arrow-upward' : 'arrow-downward'} size={isStory ? 10 : 8} color={eloDelta > 0 ? '#22C55E' : '#EF4444'} />
                  <Text style={{ fontSize: isStory ? 9 : 7, fontWeight: '800', color: eloDelta > 0 ? '#22C55E' : '#EF4444' }}>{eloDelta > 0 ? '+' : ''}{eloDelta}</Text>
                </View>
              ) : null}
            </View>
            <MiniEloChart data={eloHistory.slice(-30)} width={chartW} height={chartH} tierColor={leagueTier.color} />
          </View>
        ) : null}

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: isStory ? 10 : 6 }}>
          <View style={s.miniStat}><Text style={{ fontSize: isStory ? 14 : 11, fontWeight: '900', color: ct.textPrimary }}>{matchesPlayed}</Text><Text style={{ fontSize: isStory ? 7 : 6, color: ct.textSecondary }}>{fr ? 'Matchs' : 'Matches'}</Text></View>
          <View style={s.miniStat}><Text style={{ fontSize: isStory ? 14 : 11, fontWeight: '900', color: '#22C55E' }}>{wins}</Text><Text style={{ fontSize: isStory ? 7 : 6, color: ct.textSecondary }}>{fr ? 'Victoires' : 'Wins'}</Text></View>
        </View>

        {/* Geo ranks */}
        {geoRank ? (
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: isStory ? 6 : 4 }}>
            {geoRank.city?.rank ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}>
                <MaterialIcons name="place" size={isStory ? 9 : 7} color="#3B82F6" />
                <Text style={{ fontSize: isStory ? 9 : 7, fontWeight: '600', color: ct.textSecondary }}>#{geoRank.city.rank} {geoRank.city.name}</Text>
              </View>
            ) : null}
            {geoRank.country?.rank ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}>
                <MaterialIcons name="flag" size={isStory ? 9 : 7} color="#10B981" />
                <Text style={{ fontSize: isStory ? 9 : 7, fontWeight: '600', color: ct.textSecondary }}>#{geoRank.country.rank} {geoRank.country.name}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <ShareCardWatermark variant="light" size={isStory ? 'sm' : 'xs'} />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  eloBadge: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14 },
  rankBadge: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statChip: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 6, borderWidth: 1 },
  miniStat: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
});
