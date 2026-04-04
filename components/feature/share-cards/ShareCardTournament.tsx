/**
 * ShareCardTournament — Tournament result card for social sharing.
 * Shows name, result, format, type, ELO, geo ranks, club.
 * Adapts layout to square / story / landscape formats.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme, type ShareCardFormat } from '@/services/shareCardService';
import type { Tournament } from '@/types/petanque';

interface GeoRankInfo {
  city?: { name?: string; rank?: number };
  country?: { name?: string; rank?: number };
}

interface Props {
  tournament: Tournament;
  playerName?: string;
  eloRating?: number;
  eloColor?: string;
  eloRankLabel?: string;
  clubName?: string;
  geoRank?: GeoRankInfo | null;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
  format?: ShareCardFormat;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  'Terminé': { color: '#22C55E', icon: 'check-circle' },
  'En cours': { color: '#F59E0B', icon: 'play-circle-filled' },
  'À venir': { color: '#3B82F6', icon: 'schedule' },
};

const RESULT_LABELS: Record<string, { fr: string; en: string; color: string; icon: string }> = {
  '1er': { fr: '1er - Champion', en: '1st - Champion', color: '#FFD700', icon: 'emoji-events' },
  '2ème': { fr: '2eme - Finaliste', en: '2nd - Finalist', color: '#C0C0C0', icon: 'workspace-premium' },
  '3ème': { fr: '3eme', en: '3rd', color: '#CD7F32', icon: 'military-tech' },
  'Demi-finale': { fr: 'Demi-finale', en: 'Semi-final', color: '#8B5CF6', icon: 'trending-up' },
  'Quart de finale': { fr: 'Quart de finale', en: 'Quarter-final', color: '#3B82F6', icon: 'format-list-numbered' },
};

function getResultConfig(result: string | undefined, fr: boolean): { label: string; color: string; icon: string } | null {
  if (!result) return null;
  const cfg = RESULT_LABELS[result];
  if (cfg) return { label: fr ? cfg.fr : cfg.en, color: cfg.color, icon: cfg.icon };
  return { label: result, color: '#94A3B8', icon: 'info' };
}

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

export default function ShareCardTournament({ tournament, playerName, eloRating, eloColor, eloRankLabel, clubName, geoRank, language = 'fr', colorTheme = 'dark', format = 'square' }: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];
  const status = STATUS_CONFIG[tournament.status] || STATUS_CONFIG['À venir'];
  const resultCfg = getResultConfig(tournament.finalResult, fr);
  const dateStr = new Date(tournament.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const hasEndDate = tournament.endDate && tournament.endDate !== tournament.date;
  const endDateStr = hasEndDate ? new Date(tournament.endDate!).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : null;

  const isStory = format === 'story';
  const isLandscape = format === 'landscape';

  // === LANDSCAPE ===
  if (isLandscape) {
    return (
      <View style={s.card}>
        <LinearGradient colors={ct.gradients} style={[s.bg, { padding: 16, flex: 1 }]}>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* Left: name + result */}
            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <MaterialIcons name="emoji-events" size={12} color="#F59E0B" />
                <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: ct.accent }}>{fr ? 'TOURNOI' : 'TOURNAMENT'}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '900', color: ct.textPrimary, marginBottom: 6, lineHeight: 19 }} numberOfLines={2}>{tournament.name}</Text>
              {resultCfg ? (
                <View style={[s.resultBadge, { borderColor: resultCfg.color + '30', paddingVertical: 6, paddingHorizontal: 8, marginBottom: 6 }]}>
                  <MaterialIcons name={resultCfg.icon as any} size={16} color={resultCfg.color} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: resultCfg.color }}>{resultCfg.label}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {playerName ? <Text style={{ fontSize: 10, fontWeight: '700', color: ct.textPrimary }}>{playerName}</Text> : null}
                {eloRating ? (
                  <View style={[s.eloBadge, { backgroundColor: (eloColor || '#94A3B8') + '20' }]}>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: eloColor || '#94A3B8' }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ marginTop: 4, gap: 3 }}>
                <GeoRankBadges geoRank={geoRank} ct={ct} compact />
                {clubName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <MaterialIcons name="home" size={8} color={ct.textSecondary} />
                    <Text style={{ fontSize: 8, color: ct.textSecondary }} numberOfLines={1}>{clubName}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 10 }} />

            {/* Right: meta */}
            <View style={{ width: '30%', justifyContent: 'center', gap: 5 }}>
              <Text style={{ fontSize: 9, color: ct.textSecondary }}>{dateStr}{endDateStr ? ` - ${endDateStr}` : ''}</Text>
              <View style={[s.metaItem, { paddingVertical: 3, paddingHorizontal: 6 }]}>
                <MaterialIcons name="groups" size={10} color="#94A3B8" />
                <Text style={{ fontSize: 9, fontWeight: '600', color: '#CBD5E1CC' }}>{tournament.format}</Text>
              </View>
              <View style={[s.metaItem, { paddingVertical: 3, paddingHorizontal: 6 }]}>
                <MaterialIcons name="category" size={10} color="#94A3B8" />
                <Text style={{ fontSize: 9, fontWeight: '600', color: '#CBD5E1CC' }}>{tournament.type}</Text>
              </View>
              {tournament.participants > 0 ? (
                <View style={[s.metaItem, { paddingVertical: 3, paddingHorizontal: 6 }]}>
                  <MaterialIcons name="people" size={10} color="#94A3B8" />
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#CBD5E1CC' }}>{tournament.participants}/{tournament.maxParticipants}</Text>
                </View>
              ) : null}
              {tournament.location?.city ? (
                <View style={[s.metaItem, { paddingVertical: 3, paddingHorizontal: 6 }]}>
                  <MaterialIcons name="place" size={10} color="#94A3B8" />
                  <Text style={{ fontSize: 9, fontWeight: '600', color: '#CBD5E1CC' }} numberOfLines={1}>{tournament.location.city}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <MaterialIcons name={status.icon as any} size={9} color={status.color} />
                <Text style={{ fontSize: 8, fontWeight: '700', color: status.color }}>{tournament.status}</Text>
              </View>
            </View>
          </View>
          <ShareCardWatermark variant="light" size="sm" />
        </LinearGradient>
      </View>
    );
  }

  // === STORY / SQUARE ===
  const pad = isStory ? 28 : 22;
  const nameSize = isStory ? 24 : 20;

  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={[s.bg, { padding: pad, flex: 1, justifyContent: isStory ? 'center' : undefined }]}>
        <View style={s.decoCircle1} />
        <View style={s.decoCircle2} />

        {/* Header */}
        <View style={[s.header, { marginBottom: isStory ? 14 : 10 }]}>
          <View style={[s.typeIcon, { backgroundColor: '#F59E0B20' }]}>
            <MaterialIcons name="emoji-events" size={isStory ? 22 : 18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: ct.accent }}>{fr ? 'TOURNOI' : 'TOURNAMENT'}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', marginTop: 1, color: status.color }}>
              <MaterialIcons name={status.icon as any} size={10} color={status.color} />{' '}{tournament.status}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, fontWeight: '500', color: '#64748B' }}>{dateStr}</Text>
            {endDateStr ? <Text style={{ fontSize: 10, fontWeight: '500', color: '#64748B' }}>{fr ? 'au' : 'to'} {endDateStr}</Text> : null}
          </View>
        </View>

        {/* Tournament Name */}
        <Text style={{ fontSize: nameSize, fontWeight: '900', color: ct.textPrimary, marginBottom: isStory ? 16 : 12, letterSpacing: -0.3, lineHeight: nameSize * 1.25 }} numberOfLines={2}>{tournament.name}</Text>

        {/* Result Badge */}
        {resultCfg ? (
          <LinearGradient
            colors={[resultCfg.color + '18', resultCfg.color + '08']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[s.resultBadge, { borderColor: resultCfg.color + '30', marginBottom: isStory ? 16 : 12, paddingVertical: isStory ? 12 : 10, paddingHorizontal: 14 }]}
          >
            <MaterialIcons name={resultCfg.icon as any} size={isStory ? 30 : 24} color={resultCfg.color} />
            <View>
              <Text style={{ fontSize: isStory ? 20 : 16, fontWeight: '800', color: resultCfg.color }}>{resultCfg.label}</Text>
              {tournament.prizeWon ? <Text style={{ fontSize: 12, fontWeight: '600', color: '#94A3B8', marginTop: 1 }}>{tournament.prizeWon > 0 ? `+${tournament.prizeWon} \u20AC` : ''}</Text> : null}
            </View>
          </LinearGradient>
        ) : null}

        {/* Meta Grid */}
        <View style={[s.metaGrid, { marginBottom: isStory ? 12 : 8 }]}>
          <View style={s.metaItem}><MaterialIcons name="groups" size={12} color="#94A3B8" /><Text style={s.metaValue}>{tournament.format}</Text></View>
          <View style={s.metaItem}><MaterialIcons name="category" size={12} color="#94A3B8" /><Text style={s.metaValue}>{tournament.type}</Text></View>
          {tournament.participants > 0 ? <View style={s.metaItem}><MaterialIcons name="people" size={12} color="#94A3B8" /><Text style={s.metaValue}>{tournament.participants}/{tournament.maxParticipants}</Text></View> : null}
          {tournament.location?.city ? <View style={s.metaItem}><MaterialIcons name="place" size={12} color="#94A3B8" /><Text style={s.metaValue} numberOfLines={1}>{tournament.location.city}</Text></View> : null}
        </View>

        {/* Tags */}
        {(tournament.tournamentLevel || tournament.tournamentScope || tournament.prize) ? (
          <View style={[s.tagRow, { marginBottom: isStory ? 14 : 10 }]}>
            {tournament.tournamentLevel ? <View style={[s.tagChip, { backgroundColor: '#8B5CF615' }]}><Text style={[s.tagText, { color: '#8B5CF6' }]}>{tournament.tournamentLevel}</Text></View> : null}
            {tournament.tournamentScope ? <View style={[s.tagChip, { backgroundColor: '#3B82F615' }]}><Text style={[s.tagText, { color: '#3B82F6' }]}>{tournament.tournamentScope}</Text></View> : null}
            {tournament.prize ? <View style={[s.tagChip, { backgroundColor: '#F59E0B15' }]}><MaterialIcons name="card-giftcard" size={10} color="#F59E0B" /><Text style={[s.tagText, { color: '#F59E0B' }]}>{tournament.prize}</Text></View> : null}
          </View>
        ) : null}

        {/* Footer */}
        <View style={[s.footer, { gap: 6 }]}>
          <View style={{ gap: 4, flex: 1 }}>
            <View style={s.footerLeft}>
              {playerName ? <Text style={{ fontSize: 12, fontWeight: '700', color: ct.textPrimary }}>{playerName}</Text> : null}
              {eloRating ? (
                <View style={[s.eloBadge, { backgroundColor: (eloColor || '#94A3B8') + '20' }]}>
                  <MaterialIcons name="diamond" size={10} color={eloColor || '#94A3B8'} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: eloColor || '#94A3B8' }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                </View>
              ) : null}
            </View>
            <GeoRankBadges geoRank={geoRank} ct={ct} compact />
            {clubName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MaterialIcons name="home" size={9} color="#64748B" />
                <Text style={{ fontSize: 9, fontWeight: '500', color: '#64748B' }} numberOfLines={1}>{clubName}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <ShareCardWatermark variant="light" size="sm" />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  bg: { padding: 24, position: 'relative' },
  decoCircle1: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(245,158,11,0.04)' },
  decoCircle2: { position: 'absolute', bottom: 40, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59,130,246,0.03)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  typeIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  resultBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 16 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  metaValue: { fontSize: 11, fontWeight: '600', color: '#CBD5E1CC', maxWidth: 90 },
  tagRow: { flexDirection: 'row', gap: 5, marginBottom: 14, flexWrap: 'wrap' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10, marginBottom: 4 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eloBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
});
