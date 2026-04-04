/**
 * ShareCardMatch — Visual match result card for social sharing.
 * Shows score, teams, ELO, format, date, terrain.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import theme from '@/constants/theme';
import type { Match } from '@/types/petanque';

interface Props {
  match: Match;
  playerName?: string;
  eloRating?: number;
  eloRankLabel?: string;
  eloColor?: string;
  terrainName?: string;
  language?: 'fr' | 'en';
}

export default function ShareCardMatch({ match, playerName, eloRating, eloRankLabel, eloColor, terrainName, language = 'fr' }: Props) {
  const fr = language === 'fr';
  const isWinnerA = match.winner === 'A';
  const winGrad: [string, string] = ['#22C55E', '#16A34A'];
  const loseGrad: [string, string] = ['#EF4444', '#DC2626'];
  const dateStr = new Date(match.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const durationStr = match.duration ? `${Math.floor(match.duration / 60)}h${String(match.duration % 60).padStart(2, '0')}` : '';

  return (
    <View style={s.card}>
      <LinearGradient colors={['#0F172A', '#1E293B']} style={s.bg}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <MaterialIcons name="sports" size={16} color="#F59E0B" />
            <Text style={s.headerLabel}>MATCH</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.dateText}>{dateStr}</Text>
            {durationStr ? <Text style={s.durationText}>{durationStr}</Text> : null}
          </View>
        </View>

        {/* Format + Mode */}
        <View style={s.metaRow}>
          <View style={s.metaChip}>
            <MaterialIcons name="group" size={12} color="#94A3B8" />
            <Text style={s.metaText}>{match.format}</Text>
          </View>
          <View style={[s.metaChip, match.mode === 'Tournoi' ? { backgroundColor: '#F59E0B20' } : null]}>
            <MaterialIcons name={match.mode === 'Tournoi' ? 'emoji-events' : 'fitness-center'} size={12} color={match.mode === 'Tournoi' ? '#F59E0B' : '#94A3B8'} />
            <Text style={[s.metaText, match.mode === 'Tournoi' ? { color: '#F59E0B' } : null]}>{match.mode}</Text>
          </View>
          {match.tournamentName ? (
            <View style={[s.metaChip, { backgroundColor: '#F59E0B15' }]}>
              <Text style={[s.metaText, { color: '#F59E0B' }]} numberOfLines={1}>{match.tournamentName}</Text>
            </View>
          ) : null}
        </View>

        {/* Score */}
        <View style={s.scoreContainer}>
          <View style={s.teamCol}>
            <LinearGradient colors={isWinnerA ? winGrad : loseGrad} style={s.scoreBadge}>
              <Text style={s.scoreNum}>{match.teamA.score}</Text>
            </LinearGradient>
            <Text style={s.teamLabel}>{fr ? 'EQUIPE A' : 'TEAM A'}</Text>
            <Text style={s.teamNames} numberOfLines={2}>{match.teamA.playerNames.join(', ')}</Text>
          </View>

          <View style={s.vsCol}>
            <View style={s.vsCircle}>
              <Text style={s.vsText}>VS</Text>
            </View>
            {isWinnerA ? (
              <View style={s.winArrow}><MaterialIcons name="arrow-back" size={14} color="#22C55E" /></View>
            ) : (
              <View style={s.winArrow}><MaterialIcons name="arrow-forward" size={14} color="#22C55E" /></View>
            )}
          </View>

          <View style={s.teamCol}>
            <LinearGradient colors={!isWinnerA ? winGrad : loseGrad} style={s.scoreBadge}>
              <Text style={s.scoreNum}>{match.teamB.score}</Text>
            </LinearGradient>
            <Text style={s.teamLabel}>{fr ? 'EQUIPE B' : 'TEAM B'}</Text>
            <Text style={s.teamNames} numberOfLines={2}>{match.teamB.playerNames.join(', ')}</Text>
          </View>
        </View>

        {/* Menes count */}
        {match.menes.length > 0 ? (
          <View style={s.menesRow}>
            <MaterialIcons name="format-list-numbered" size={14} color="#64748B" />
            <Text style={s.menesText}>{match.menes.length} {fr ? 'menes' : 'ends'}</Text>
          </View>
        ) : null}

        {/* Player info footer */}
        <View style={s.footer}>
          <View style={s.footerLeft}>
            {playerName ? <Text style={s.playerName}>{playerName}</Text> : null}
            {eloRating ? (
              <View style={[s.eloBadge, { backgroundColor: (eloColor || '#94A3B8') + '20' }]}>
                <Text style={[s.eloText, { color: eloColor || '#94A3B8' }]}>ELO {eloRating}</Text>
              </View>
            ) : null}
          </View>
          {terrainName ? (
            <View style={s.terrainChip}>
              <MaterialIcons name="place" size={12} color="#64748B" />
              <Text style={s.terrainText} numberOfLines={1}>{terrainName}</Text>
            </View>
          ) : null}
        </View>

        {/* Watermark */}
        <ShareCardWatermark variant="light" size="sm" />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden' },
  bg: { padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 11, fontWeight: '800', color: '#F59E0B', letterSpacing: 1.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  durationText: { fontSize: 11, fontWeight: '500', color: '#64748B' },
  metaRow: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  metaText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  teamCol: { flex: 1, alignItems: 'center', gap: 6 },
  scoreBadge: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 36, fontWeight: '900', color: '#FFF' },
  teamLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 1 },
  teamNames: { fontSize: 12, fontWeight: '600', color: '#CBD5E1', textAlign: 'center', maxWidth: 130 },
  vsCol: { width: 50, alignItems: 'center', gap: 4 },
  vsCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 12, fontWeight: '800', color: '#64748B' },
  winArrow: {},
  menesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  menesText: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 4 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerName: { fontSize: 14, fontWeight: '700', color: '#F8FAFC' },
  eloBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  eloText: { fontSize: 11, fontWeight: '700' },
  terrainChip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 140 },
  terrainText: { fontSize: 11, fontWeight: '500', color: '#64748B' },
});
