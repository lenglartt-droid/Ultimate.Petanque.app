/**
 * ShareCardStats — Personal statistics card for social sharing.
 * Shows ELO, win rate, shot rates, podiums, role, handedness, experience, boules, club, geo ranks.
 * Adapts layout to square / story / landscape formats.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme, type ShareCardFormat } from '@/services/shareCardService';

interface GeoRankInfo {
  city?: { name?: string; rank?: number };
  country?: { name?: string; rank?: number };
}

interface Props {
  playerName?: string;
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
  geoRank?: GeoRankInfo | null;
  clubName?: string;
  podiumCount?: number;
  handedness?: string;
  experience?: string;
  mostPlayedRole?: string;
  boulesSetName?: string;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
  format?: ShareCardFormat;
}

const EXP_LABELS: Record<string, { fr: string; en: string }> = {
  less_than_1: { fr: '< 1 an', en: '< 1 year' },
  '1_to_3': { fr: '1-3 ans', en: '1-3 years' },
  '3_to_10': { fr: '3-10 ans', en: '3-10 years' },
  more_than_10: { fr: '10+ ans', en: '10+ years' },
};

const HAND_LABELS: Record<string, { fr: string; en: string }> = {
  right: { fr: 'Droitier', en: 'Right-handed' },
  left: { fr: 'Gaucher', en: 'Left-handed' },
  ambidextrous: { fr: 'Ambidextre', en: 'Ambidextrous' },
};

function GeoRankBadges({ geoRank, ct, compact }: { geoRank?: GeoRankInfo | null; ct: any; compact?: boolean }) {
  if (!geoRank) return null;
  const fs = compact ? 8 : 10;
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
      {geoRank.city?.rank ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 }}>
          <MaterialIcons name="location-city" size={compact ? 8 : 10} color="#3B82F6" />
          <Text style={{ fontSize: fs, fontWeight: '600', color: '#94A3B8' }}>#{geoRank.city.rank} {geoRank.city.name}</Text>
        </View>
      ) : null}
      {geoRank.country?.rank ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 }}>
          <MaterialIcons name="flag" size={compact ? 8 : 10} color="#10B981" />
          <Text style={{ fontSize: fs, fontWeight: '600', color: '#94A3B8' }}>#{geoRank.country.rank} {geoRank.country.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

function InfoChip({ icon, label, ct, compact }: { icon: string; label: string; ct: any; compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 3 : 4, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: compact ? 5 : 7, paddingVertical: compact ? 2 : 3, borderRadius: 6 }}>
      <MaterialIcons name={icon as any} size={compact ? 9 : 11} color={ct.textSecondary} />
      <Text style={{ fontSize: compact ? 8 : 10, fontWeight: '600', color: ct.textSecondary }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function ShareCardStats({
  playerName, eloRating, eloColor, eloRankLabel,
  matchesPlayed, winRate, tirRate, pointRate, carreauRate,
  currentStreak, bestStreak,
  geoRank, clubName, podiumCount, handedness, experience, mostPlayedRole, boulesSetName,
  language = 'fr', colorTheme = 'dark', format = 'square',
}: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];
  const isStory = format === 'story';
  const isLandscape = format === 'landscape';

  const expLabel = experience ? (EXP_LABELS[experience]?.[fr ? 'fr' : 'en'] || experience) : null;
  const handLabel = handedness ? (HAND_LABELS[handedness]?.[fr ? 'fr' : 'en'] || handedness) : null;

  // === LANDSCAPE ===
  if (isLandscape) {
    return (
      <View style={s.card}>
        <LinearGradient colors={ct.gradients} style={[s.bg, { padding: 16, flex: 1 }]}>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* Left: player + ELO + geo + profile */}
            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MaterialIcons name="bar-chart" size={12} color={ct.accent} />
                <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: ct.accent }}>{fr ? 'MES STATS' : 'MY STATS'}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: ct.textPrimary, marginBottom: 6 }}>{playerName || (fr ? 'Joueur' : 'Player')}</Text>
              {eloRating ? (
                <View style={[s.eloBadge, { backgroundColor: (eloColor || ct.textSecondary) + '20', alignSelf: 'flex-start', marginBottom: 6 }]}>
                  <MaterialIcons name="diamond" size={10} color={eloColor || ct.textSecondary} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: eloColor || ct.textSecondary }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                </View>
              ) : null}
              <GeoRankBadges geoRank={geoRank} ct={ct} compact />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                {clubName ? <InfoChip icon="home" label={clubName} ct={ct} compact /> : null}
                {mostPlayedRole ? <InfoChip icon="person" label={mostPlayedRole} ct={ct} compact /> : null}
                {handLabel ? <InfoChip icon="pan-tool" label={handLabel} ct={ct} compact /> : null}
                {expLabel ? <InfoChip icon="schedule" label={expLabel} ct={ct} compact /> : null}
                {boulesSetName ? <InfoChip icon="sports" label={boulesSetName} ct={ct} compact /> : null}
                {podiumCount !== undefined && podiumCount > 0 ? <InfoChip icon="emoji-events" label={`${podiumCount} ${fr ? 'podiums' : 'podiums'}`} ct={ct} compact /> : null}
              </View>
            </View>

            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 8 }} />

            {/* Right: stats grid */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={[s.statsGrid, { gap: 5 }]}>
                <View style={s.statBox}><Text style={[s.statValue, { fontSize: 16 }]}>{matchesPlayed}</Text><Text style={[s.statLabel, { fontSize: 7 }]}>{fr ? 'Matchs' : 'Matches'}</Text></View>
                <View style={[s.statBox, { borderColor: '#22C55E20' }]}><Text style={[s.statValue, { color: '#22C55E', fontSize: 16 }]}>{winRate}%</Text><Text style={[s.statLabel, { fontSize: 7 }]}>{fr ? 'Victoires' : 'Win Rate'}</Text></View>
              </View>
              <View style={[s.statsGrid, { gap: 5, marginTop: 5 }]}>
                <View style={[s.statBox, { borderColor: '#3B82F620' }]}><Text style={[s.statValue, { color: '#3B82F6', fontSize: 16 }]}>{tirRate}%</Text><Text style={[s.statLabel, { fontSize: 7 }]}>{fr ? 'Tir' : 'Shot'}</Text></View>
                <View style={[s.statBox, { borderColor: '#F59E0B20' }]}><Text style={[s.statValue, { color: '#F59E0B', fontSize: 16 }]}>{carreauRate}%</Text><Text style={[s.statLabel, { fontSize: 7 }]}>Carreau</Text></View>
              </View>
              <View style={{ marginTop: 5 }}>
                <View style={[s.barHeader, { marginBottom: 3 }]}>
                  <MaterialIcons name="adjust" size={10} color="#10B981" />
                  <Text style={[s.barLabel, { fontSize: 9 }]}>Point</Text>
                  <Text style={[s.barValue, { color: '#10B981', fontSize: 11 }]}>{pointRate}%</Text>
                </View>
                <View style={[s.barTrack, { height: 5 }]}><View style={[s.barFill, { width: `${Math.max(4, pointRate)}%`, backgroundColor: '#10B981' }]} /></View>
              </View>
              {(currentStreak !== undefined && currentStreak > 0) ? (
                <View style={[s.streakChip, { marginTop: 5, alignSelf: 'flex-start' }]}>
                  <MaterialIcons name="local-fire-department" size={10} color="#F97316" />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#F97316' }}>{currentStreak} {fr ? 'j' : 'd'}</Text>
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
  const pad = isStory ? 28 : 22;
  const titleSize = isStory ? 24 : 20;
  const statFontSize = isStory ? 24 : 20;

  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={[s.bg, { padding: pad, flex: 1, justifyContent: isStory ? 'center' : undefined }]}>
        {/* Header */}
        <View style={[s.header, { marginBottom: isStory ? 12 : 8 }]}>
          <MaterialIcons name="bar-chart" size={isStory ? 18 : 15} color={ct.accent} />
          <Text style={{ fontSize: isStory ? 12 : 10, fontWeight: '800', letterSpacing: 1.5, color: ct.accent }}>{fr ? 'MES STATS' : 'MY STATS'}</Text>
        </View>

        {/* Player name + ELO */}
        <View style={[s.playerRow, { marginBottom: isStory ? 16 : 12 }]}>
          <Text style={[s.playerName, { color: ct.textPrimary, fontSize: titleSize }]}>{playerName || (fr ? 'Joueur' : 'Player')}</Text>
          {eloRating ? (
            <View style={[s.eloBadge, { backgroundColor: (eloColor || ct.textSecondary) + '20' }]}>
              <MaterialIcons name="diamond" size={11} color={eloColor || ct.textSecondary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: eloColor || ct.textSecondary }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
            </View>
          ) : null}
        </View>

        {/* Key stats grid */}
        <View style={[s.statsGrid, { marginBottom: isStory ? 12 : 10 }]}>
          <View style={s.statBox}><Text style={[s.statValue, { fontSize: statFontSize }]}>{matchesPlayed}</Text><Text style={s.statLabel}>{fr ? 'Matchs' : 'Matches'}</Text></View>
          <View style={[s.statBox, { borderColor: '#22C55E20' }]}><Text style={[s.statValue, { color: '#22C55E', fontSize: statFontSize }]}>{winRate}%</Text><Text style={s.statLabel}>{fr ? 'Victoires' : 'Win Rate'}</Text></View>
          <View style={[s.statBox, { borderColor: '#3B82F620' }]}><Text style={[s.statValue, { color: '#3B82F6', fontSize: statFontSize }]}>{tirRate}%</Text><Text style={s.statLabel}>{fr ? 'Tir' : 'Shot'}</Text></View>
          <View style={[s.statBox, { borderColor: '#F59E0B20' }]}><Text style={[s.statValue, { color: '#F59E0B', fontSize: statFontSize }]}>{carreauRate}%</Text><Text style={s.statLabel}>Carreau</Text></View>
        </View>

        {/* Point rate bar */}
        <View style={{ marginBottom: isStory ? 12 : 10 }}>
          <View style={[s.barHeader, { marginBottom: 4 }]}>
            <MaterialIcons name="adjust" size={13} color="#10B981" />
            <Text style={[s.barLabel, { flex: 1 }]}>{fr ? 'Point' : 'Point'}</Text>
            <Text style={[s.barValue, { color: '#10B981' }]}>{pointRate}%</Text>
          </View>
          <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.max(4, pointRate)}%`, backgroundColor: '#10B981' }]} /></View>
        </View>

        {/* Profile info chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: isStory ? 12 : 8 }}>
          {clubName ? <InfoChip icon="home" label={clubName} ct={ct} /> : null}
          {mostPlayedRole ? <InfoChip icon="person" label={mostPlayedRole} ct={ct} /> : null}
          {podiumCount !== undefined && podiumCount > 0 ? <InfoChip icon="emoji-events" label={`${podiumCount} ${fr ? 'podiums' : 'podiums'}`} ct={ct} /> : null}
          {handLabel ? <InfoChip icon="pan-tool" label={handLabel} ct={ct} /> : null}
          {expLabel ? <InfoChip icon="schedule" label={expLabel} ct={ct} /> : null}
          {boulesSetName ? <InfoChip icon="sports" label={boulesSetName} ct={ct} /> : null}
        </View>

        {/* Streak + Geo */}
        <View style={[s.bottomRow, { marginBottom: isStory ? 8 : 4 }]}>
          {(currentStreak !== undefined && currentStreak > 0) ? (
            <View style={s.streakChip}>
              <MaterialIcons name="local-fire-department" size={13} color="#F97316" />
              <Text style={s.streakText}>{currentStreak} {fr ? 'jours' : 'days'}</Text>
              {bestStreak ? <Text style={s.streakBest}>({fr ? 'record' : 'best'}: {bestStreak})</Text> : null}
            </View>
          ) : null}
          <GeoRankBadges geoRank={geoRank} ct={ct} />
        </View>
        <ShareCardWatermark variant="light" size="sm" />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  bg: { padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  playerName: { fontSize: 22, fontWeight: '800', flex: 1 },
  eloBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statsGrid: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#F8FAFC', marginBottom: 1 },
  statLabel: { fontSize: 9, fontWeight: '600', color: '#64748B', letterSpacing: 0.3 },
  barHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  barLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  barValue: { fontSize: 13, fontWeight: '800' },
  barTrack: { height: 7, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  bottomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 },
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9731615', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  streakText: { fontSize: 11, fontWeight: '700', color: '#F97316' },
  streakBest: { fontSize: 9, fontWeight: '500', color: '#64748B' },
});
