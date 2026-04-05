/**
 * ShareCardStats — Personal statistics card for social sharing.
 * Shows ELO, win rate, shot rates, podiums, role, handedness, experience, boules, club, geo ranks.
 * Adapts layout to square / story / landscape formats without truncation.
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
  right: { fr: 'Droitier', en: 'Right' },
  left: { fr: 'Gaucher', en: 'Left' },
  ambidextrous: { fr: 'Ambidextre', en: 'Ambidextrous' },
};

function GeoRankBadges({ geoRank, compact }: { geoRank?: GeoRankInfo | null; compact?: boolean }) {
  if (!geoRank) return null;
  const fs = compact ? 7 : 9;
  return (
    <View style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
      {geoRank.city?.rank ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 5 }}>
          <MaterialIcons name="location-city" size={compact ? 7 : 9} color="#3B82F6" />
          <Text style={{ fontSize: fs, fontWeight: '600', color: '#94A3B8' }}>#{geoRank.city.rank} {geoRank.city.name}</Text>
        </View>
      ) : null}
      {geoRank.country?.rank ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 5 }}>
          <MaterialIcons name="flag" size={compact ? 7 : 9} color="#10B981" />
          <Text style={{ fontSize: fs, fontWeight: '600', color: '#94A3B8' }}>#{geoRank.country.rank} {geoRank.country.name}</Text>
        </View>
      ) : null}
    </View>
  );
}

function InfoChip({ icon, label, ct, compact }: { icon: string; label: string; ct: any; compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 2 : 3, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: compact ? 4 : 6, paddingVertical: compact ? 1.5 : 2.5, borderRadius: 5 }}>
      <MaterialIcons name={icon as any} size={compact ? 8 : 10} color={ct.textSecondary} />
      <Text style={{ fontSize: compact ? 7 : 9, fontWeight: '600', color: ct.textSecondary }} numberOfLines={1}>{label}</Text>
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
        <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
          {/* Top: header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <MaterialIcons name="bar-chart" size={10} color={ct.accent} />
            <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 1, color: ct.accent }}>{fr ? 'MES STATS' : 'MY STATS'}</Text>
          </View>

          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* Left: player + profile */}
            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: ct.textPrimary, marginBottom: 4 }}>{playerName || (fr ? 'Joueur' : 'Player')}</Text>
              {eloRating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: (eloColor || '#94A3B8') + '20', paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 }}>
                  <MaterialIcons name="diamond" size={9} color={eloColor || '#94A3B8'} />
                  <Text style={{ fontSize: 9, fontWeight: '700', color: eloColor || '#94A3B8' }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                </View>
              ) : null}
              <GeoRankBadges geoRank={geoRank} compact />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
                {clubName ? <InfoChip icon="home" label={clubName} ct={ct} compact /> : null}
                {mostPlayedRole ? <InfoChip icon="person" label={mostPlayedRole} ct={ct} compact /> : null}
                {handLabel ? <InfoChip icon="pan-tool" label={handLabel} ct={ct} compact /> : null}
                {expLabel ? <InfoChip icon="schedule" label={expLabel} ct={ct} compact /> : null}
                {boulesSetName ? <InfoChip icon="sports" label={boulesSetName} ct={ct} compact /> : null}
                {podiumCount !== undefined && podiumCount > 0 ? <InfoChip icon="emoji-events" label={`${podiumCount} pod.`} ct={ct} compact /> : null}
              </View>
            </View>

            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 6 }} />

            {/* Right: stats grid */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                <View style={s.statBoxSm}><Text style={{ fontSize: 14, fontWeight: '900', color: '#F8FAFC' }}>{matchesPlayed}</Text><Text style={{ fontSize: 6, fontWeight: '600', color: '#64748B' }}>{fr ? 'Matchs' : 'Matches'}</Text></View>
                <View style={[s.statBoxSm, { borderColor: '#22C55E20' }]}><Text style={{ fontSize: 14, fontWeight: '900', color: '#22C55E' }}>{winRate}%</Text><Text style={{ fontSize: 6, fontWeight: '600', color: '#64748B' }}>{fr ? 'Victoires' : 'Win'}</Text></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                <View style={[s.statBoxSm, { borderColor: '#3B82F620' }]}><Text style={{ fontSize: 14, fontWeight: '900', color: '#3B82F6' }}>{tirRate}%</Text><Text style={{ fontSize: 6, fontWeight: '600', color: '#64748B' }}>{fr ? 'Tir' : 'Shot'}</Text></View>
                <View style={[s.statBoxSm, { borderColor: '#F59E0B20' }]}><Text style={{ fontSize: 14, fontWeight: '900', color: '#F59E0B' }}>{carreauRate}%</Text><Text style={{ fontSize: 6, fontWeight: '600', color: '#64748B' }}>Carreau</Text></View>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                  <MaterialIcons name="adjust" size={8} color="#10B981" />
                  <Text style={{ fontSize: 8, fontWeight: '600', color: '#94A3B8', flex: 1 }}>Point</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981' }}>{pointRate}%</Text>
                </View>
                <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.max(4, pointRate)}%`, backgroundColor: '#10B981', borderRadius: 2 }} /></View>
              </View>
              {(currentStreak !== undefined && currentStreak > 0) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, backgroundColor: '#F9731610', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, alignSelf: 'flex-start' }}>
                  <MaterialIcons name="local-fire-department" size={9} color="#F97316" />
                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#F97316' }}>{currentStreak} {fr ? 'j' : 'd'}</Text>
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
  const pad = isStory ? 24 : 14;
  const titleSize = isStory ? 22 : 16;
  const statFontSize = isStory ? 22 : 16;

  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: pad, justifyContent: isStory ? 'center' : 'space-between' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: isStory ? 10 : 6 }}>
          <MaterialIcons name="bar-chart" size={isStory ? 16 : 13} color={ct.accent} />
          <Text style={{ fontSize: isStory ? 11 : 9, fontWeight: '800', letterSpacing: 1.5, color: ct.accent }}>{fr ? 'MES STATS' : 'MY STATS'}</Text>
        </View>

        {/* Player name + ELO */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: isStory ? 14 : 10 }}>
          <Text style={{ fontSize: titleSize, fontWeight: '800', color: ct.textPrimary, flex: 1 }}>{playerName || (fr ? 'Joueur' : 'Player')}</Text>
          {eloRating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: (eloColor || '#94A3B8') + '20', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 }}>
              <MaterialIcons name="diamond" size={10} color={eloColor || '#94A3B8'} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: eloColor || '#94A3B8' }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats grid */}
        <View style={{ flexDirection: 'row', gap: 5, marginBottom: isStory ? 10 : 8 }}>
          <View style={s.statBox}><Text style={{ fontSize: statFontSize, fontWeight: '900', color: '#F8FAFC' }}>{matchesPlayed}</Text><Text style={s.statLabel}>{fr ? 'Matchs' : 'Matches'}</Text></View>
          <View style={[s.statBox, { borderColor: '#22C55E20' }]}><Text style={{ fontSize: statFontSize, fontWeight: '900', color: '#22C55E' }}>{winRate}%</Text><Text style={s.statLabel}>{fr ? 'Victoires' : 'Win Rate'}</Text></View>
          <View style={[s.statBox, { borderColor: '#3B82F620' }]}><Text style={{ fontSize: statFontSize, fontWeight: '900', color: '#3B82F6' }}>{tirRate}%</Text><Text style={s.statLabel}>{fr ? 'Tir' : 'Shot'}</Text></View>
          <View style={[s.statBox, { borderColor: '#F59E0B20' }]}><Text style={{ fontSize: statFontSize, fontWeight: '900', color: '#F59E0B' }}>{carreauRate}%</Text><Text style={s.statLabel}>Carreau</Text></View>
        </View>

        {/* Point rate bar */}
        <View style={{ marginBottom: isStory ? 10 : 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <MaterialIcons name="adjust" size={11} color="#10B981" />
            <Text style={{ fontSize: 10, fontWeight: '600', color: '#94A3B8', flex: 1 }}>Point</Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981' }}>{pointRate}%</Text>
          </View>
          <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.max(4, pointRate)}%`, backgroundColor: '#10B981', borderRadius: 3 }} /></View>
        </View>

        {/* Profile info chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: isStory ? 10 : 6 }}>
          {clubName ? <InfoChip icon="home" label={clubName} ct={ct} /> : null}
          {mostPlayedRole ? <InfoChip icon="person" label={mostPlayedRole} ct={ct} /> : null}
          {podiumCount !== undefined && podiumCount > 0 ? <InfoChip icon="emoji-events" label={`${podiumCount} ${fr ? 'podiums' : 'podiums'}`} ct={ct} /> : null}
          {handLabel ? <InfoChip icon="pan-tool" label={handLabel} ct={ct} /> : null}
          {expLabel ? <InfoChip icon="schedule" label={expLabel} ct={ct} /> : null}
          {boulesSetName ? <InfoChip icon="sports" label={boulesSetName} ct={ct} /> : null}
        </View>

        {/* Streak + Geo */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8 }}>
          {(currentStreak !== undefined && currentStreak > 0) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F9731615', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 }}>
              <MaterialIcons name="local-fire-department" size={12} color="#F97316" />
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#F97316' }}>{currentStreak} {fr ? 'jours' : 'days'}</Text>
              {bestStreak ? <Text style={{ fontSize: 8, fontWeight: '500', color: '#64748B' }}>({fr ? 'record' : 'best'}: {bestStreak})</Text> : null}
            </View>
          ) : null}
          <GeoRankBadges geoRank={geoRank} compact={!isStory} />
        </View>
        <ShareCardWatermark variant="light" size={isStory ? 'sm' : 'xs'} />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statBoxSm: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statLabel: { fontSize: 8, fontWeight: '600', color: '#64748B', letterSpacing: 0.3 },
});
