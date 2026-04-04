/**
 * ShareCardTournament — Tournament result card for social sharing.
 * Shows tournament name, final result, phase reached, format, teams, ELO.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme } from '@/services/shareCardService';
import type { Tournament } from '@/types/petanque';

interface Props {
  tournament: Tournament;
  playerName?: string;
  eloRating?: number;
  eloColor?: string;
  eloRankLabel?: string;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string; gradients: [string, string] }> = {
  'Terminé': { color: '#22C55E', icon: 'check-circle', gradients: ['#0F172A', '#1A2E1A'] },
  'En cours': { color: '#F59E0B', icon: 'play-circle-filled', gradients: ['#0F172A', '#2A2010'] },
  'À venir': { color: '#3B82F6', icon: 'schedule', gradients: ['#0F172A', '#0F1A2E'] },
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

export default function ShareCardTournament({ tournament, playerName, eloRating, eloColor, eloRankLabel, language = 'fr', colorTheme = 'dark' }: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];
  const status = STATUS_CONFIG[tournament.status] || STATUS_CONFIG['À venir'];
  const resultCfg = getResultConfig(tournament.finalResult, fr);
  const dateStr = new Date(tournament.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const hasEndDate = tournament.endDate && tournament.endDate !== tournament.date;
  const endDateStr = hasEndDate ? new Date(tournament.endDate!).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : null;

  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={s.bg}>
        {/* Deco */}
        <View style={s.decoCircle1} />
        <View style={s.decoCircle2} />

        {/* Header */}
        <View style={s.header}>
          <View style={[s.typeIcon, { backgroundColor: '#F59E0B20' }]}>
            <MaterialIcons name="emoji-events" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerLabel, { color: ct.accent }]}>{fr ? 'TOURNOI' : 'TOURNAMENT'}</Text>
            <Text style={[s.statusText, { color: status.color }]}>
              <MaterialIcons name={status.icon as any} size={11} color={status.color} />{' '}
              {tournament.status}
            </Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.dateText}>{dateStr}</Text>
            {endDateStr ? <Text style={s.dateText}>{fr ? 'au' : 'to'} {endDateStr}</Text> : null}
          </View>
        </View>

        {/* Tournament Name */}
        <Text style={[s.tournamentName, { color: ct.textPrimary }]} numberOfLines={2}>{tournament.name}</Text>

        {/* Result Badge (if finished) */}
        {resultCfg ? (
          <LinearGradient
            colors={[resultCfg.color + '18', resultCfg.color + '08']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.resultBadge, { borderColor: resultCfg.color + '30' }]}
          >
            <MaterialIcons name={resultCfg.icon as any} size={28} color={resultCfg.color} />
            <View>
              <Text style={[s.resultLabel, { color: resultCfg.color }]}>{resultCfg.label}</Text>
              {tournament.prizeWon ? (
                <Text style={s.prizeText}>{tournament.prizeWon > 0 ? `+${tournament.prizeWon} \u20AC` : ''}</Text>
              ) : null}
            </View>
          </LinearGradient>
        ) : null}

        {/* Meta Grid */}
        <View style={s.metaGrid}>
          <View style={s.metaItem}>
            <MaterialIcons name="groups" size={14} color="#94A3B8" />
            <Text style={s.metaValue}>{tournament.format}</Text>
          </View>
          <View style={s.metaItem}>
            <MaterialIcons name="category" size={14} color="#94A3B8" />
            <Text style={s.metaValue}>{tournament.type}</Text>
          </View>
          {tournament.participants > 0 ? (
            <View style={s.metaItem}>
              <MaterialIcons name="people" size={14} color="#94A3B8" />
              <Text style={s.metaValue}>{tournament.participants}/{tournament.maxParticipants}</Text>
            </View>
          ) : null}
          {tournament.location?.city ? (
            <View style={s.metaItem}>
              <MaterialIcons name="place" size={14} color="#94A3B8" />
              <Text style={s.metaValue} numberOfLines={1}>{tournament.location.city}</Text>
            </View>
          ) : null}
        </View>

        {/* Level & Scope badges */}
        {(tournament.tournamentLevel || tournament.tournamentScope) ? (
          <View style={s.tagRow}>
            {tournament.tournamentLevel ? (
              <View style={[s.tagChip, { backgroundColor: '#8B5CF615' }]}>
                <Text style={[s.tagText, { color: '#8B5CF6' }]}>{tournament.tournamentLevel}</Text>
              </View>
            ) : null}
            {tournament.tournamentScope ? (
              <View style={[s.tagChip, { backgroundColor: '#3B82F615' }]}>
                <Text style={[s.tagText, { color: '#3B82F6' }]}>{tournament.tournamentScope}</Text>
              </View>
            ) : null}
            {tournament.prize ? (
              <View style={[s.tagChip, { backgroundColor: '#F59E0B15' }]}>
                <MaterialIcons name="card-giftcard" size={11} color="#F59E0B" />
                <Text style={[s.tagText, { color: '#F59E0B' }]}>{tournament.prize}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerLeft}>
            {playerName ? <Text style={[s.playerName, { color: ct.textPrimary }]}>{playerName}</Text> : null}
            {eloRating ? (
              <View style={[s.eloBadge, { backgroundColor: (eloColor || '#94A3B8') + '20' }]}>
                <MaterialIcons name="diamond" size={11} color={eloColor || '#94A3B8'} />
                <Text style={[s.eloText, { color: eloColor || '#94A3B8' }]}>ELO {eloRating}</Text>
              </View>
            ) : null}
          </View>
          {tournament.clubName ? (
            <View style={s.clubChip}>
              <MaterialIcons name="home" size={12} color="#64748B" />
              <Text style={s.clubText} numberOfLines={1}>{tournament.clubName}</Text>
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
  bg: { padding: 24, position: 'relative' },
  decoCircle1: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(245,158,11,0.04)' },
  decoCircle2: { position: 'absolute', bottom: 40, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59,130,246,0.03)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  typeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  statusText: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  dateText: { fontSize: 11, fontWeight: '500', color: '#64748B' },
  tournamentName: { fontSize: 22, fontWeight: '900', marginBottom: 16, letterSpacing: -0.3, lineHeight: 28 },
  resultBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 16 },
  resultLabel: { fontSize: 18, fontWeight: '800' },
  prizeText: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  metaValue: { fontSize: 12, fontWeight: '600', color: '#CBD5E1CC', maxWidth: 100 },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  tagText: { fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 4 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerName: { fontSize: 14, fontWeight: '700' },
  eloBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  eloText: { fontSize: 11, fontWeight: '700' },
  clubChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 130 },
  clubText: { fontSize: 11, fontWeight: '500', color: '#64748B' },
});
