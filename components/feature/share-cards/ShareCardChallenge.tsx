/**
 * ShareCardChallenge — Challenge result card for social sharing.
 * Supports dynamic color themes.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme } from '@/services/shareCardService';
import type { Challenge } from '@/types/petanque';

interface Props {
  challenge: Challenge;
  playerName?: string;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
}

const TYPE_CONFIG: Record<string, { label: { fr: string; en: string }; color: string; icon: string; gradient: [string, string] }> = {
  '10_tirs': { label: { fr: '10 Tirs', en: '10 Shots' }, color: '#3B82F6', icon: 'gps-fixed', gradient: ['#1E40AF', '#2563EB'] },
  '10_tirs_sautee': { label: { fr: '10 Tirs Sautee', en: '10 Lob Shots' }, color: '#8B5CF6', icon: 'height', gradient: ['#6D28D9', '#7C3AED'] },
  precision: { label: { fr: 'Precision', en: 'Precision' }, color: '#F59E0B', icon: 'track-changes', gradient: ['#D97706', '#F59E0B'] },
};

export default function ShareCardChallenge({ challenge, playerName, language = 'fr', colorTheme = 'dark' }: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];
  const config = TYPE_CONFIG[challenge.type] || TYPE_CONFIG['10_tirs'];
  const is1v1 = challenge.mode === '1v1';
  const isPrecision = challenge.type === 'precision';
  const dateStr = new Date(challenge.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  const successRate = challenge.successRate ?? 0;
  const totalShots = challenge.totalShots ?? 0;
  const successCount = challenge.successCount ?? 0;
  const carreauCount = challenge.carreauCount ?? 0;

  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={s.bg}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={[s.typeIcon, { backgroundColor: config.color + '20' }]}>
              <MaterialIcons name={config.icon as any} size={16} color={config.color} />
            </View>
            <View>
              <Text style={[s.headerLabel, { color: ct.textSecondary }]}>{fr ? 'DEFI' : 'CHALLENGE'}</Text>
              <Text style={[s.headerType, { color: config.color }]}>{config.label[language]}</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            {is1v1 ? <View style={s.modeBadge}><Text style={s.modeBadgeText}>1v1</Text></View> : null}
            <Text style={[s.dateText, { color: ct.textSecondary }]}>{dateStr}</Text>
          </View>
        </View>

        {/* Main score */}
        {isPrecision ? (
          <View style={s.precisionScore}>
            <LinearGradient colors={config.gradient} style={s.bigScoreBadge}>
              <Text style={s.bigScoreNum}>{challenge.totalPoints || 0}</Text>
              <Text style={s.bigScoreMax}>/{challenge.maxPoints || 75}</Text>
            </LinearGradient>
            <Text style={[s.precisionLabel, { color: ct.textSecondary }]}>{fr ? 'points totaux' : 'total points'}</Text>
          </View>
        ) : (
          <View style={s.shotScore}>
            <LinearGradient colors={config.gradient} style={s.bigScoreBadge}>
              <Text style={s.bigScoreNum}>{successCount}</Text>
              <Text style={s.bigScoreMax}>/{totalShots}</Text>
            </LinearGradient>
            <View style={s.rateRow}>
              <Text style={[s.rateValue, { color: config.color }]}>{Math.round(successRate)}%</Text>
              <Text style={[s.rateLabel, { color: ct.textSecondary }]}>{fr ? 'reussite' : 'success'}</Text>
            </View>
          </View>
        )}

        {/* Carreaux */}
        {carreauCount > 0 ? (
          <View style={s.carreauRow}>
            <MaterialIcons name="star" size={16} color="#F59E0B" />
            <Text style={s.carreauText}>{carreauCount} {carreauCount > 1 ? 'carreaux' : 'carreau'}</Text>
          </View>
        ) : null}

        {/* 1v1 result */}
        {is1v1 && challenge.opponentName ? (
          <View style={s.duelSection}>
            <View style={s.duelRow}>
              <View style={s.duelPlayer}>
                <Text style={[s.duelName, { color: ct.textPrimary }]} numberOfLines={1}>{playerName || challenge.playerName || (fr ? 'Vous' : 'You')}</Text>
                <Text style={[s.duelScore, { color: challenge.winner === 'player' ? '#22C55E' : challenge.winner === 'draw' ? ct.textSecondary : '#EF4444' }]}>
                  {isPrecision ? (challenge.totalPoints || 0) : successCount}/{isPrecision ? (challenge.maxPoints || 75) : totalShots}
                </Text>
              </View>
              <View style={s.duelVs}>
                <Text style={[s.duelVsText, { color: ct.textSecondary }]}>VS</Text>
              </View>
              <View style={s.duelPlayer}>
                <Text style={[s.duelName, { color: ct.textPrimary }]} numberOfLines={1}>{challenge.opponentName}</Text>
                <Text style={[s.duelScore, { color: challenge.winner === 'opponent' ? '#22C55E' : challenge.winner === 'draw' ? ct.textSecondary : '#EF4444' }]}>
                  {isPrecision
                    ? (challenge.opponentResult?.totalPoints || 0) + '/' + (challenge.maxPoints || 75)
                    : (challenge.opponentResult?.successCount || 0) + '/' + (challenge.opponentResult?.totalShots || totalShots)}
                </Text>
              </View>
            </View>
            {challenge.winner ? (
              <View style={[s.winnerBadge, { backgroundColor: challenge.winner === 'draw' ? ct.textSecondary + '20' : '#22C55E20' }]}>
                <MaterialIcons name={challenge.winner === 'draw' ? 'handshake' : 'emoji-events'} size={14} color={challenge.winner === 'draw' ? ct.textSecondary : '#22C55E'} />
                <Text style={[s.winnerText, { color: challenge.winner === 'draw' ? ct.textSecondary : '#22C55E' }]}>
                  {challenge.winner === 'draw' ? (fr ? 'Egalite' : 'Draw') : challenge.winner === 'player' ? (fr ? 'Victoire' : 'Victory') : (fr ? 'Defaite' : 'Defeat')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer}>
          {playerName ? <Text style={[s.playerNameFooter, { color: ct.textPrimary }]}>{playerName}</Text> : null}
          {challenge.duration ? (
            <View style={s.durationChip}>
              <MaterialIcons name="timer" size={12} color={ct.textSecondary} />
              <Text style={[s.durationText, { color: ct.textSecondary }]}>{Math.floor(challenge.duration / 60)}:{String(challenge.duration % 60).padStart(2, '0')}</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  headerType: { fontSize: 16, fontWeight: '800' },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  modeBadge: { backgroundColor: '#EF444425', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  modeBadgeText: { fontSize: 11, fontWeight: '800', color: '#EF4444' },
  dateText: { fontSize: 11, fontWeight: '500' },
  precisionScore: { alignItems: 'center', marginBottom: 16 },
  shotScore: { alignItems: 'center', marginBottom: 16 },
  bigScoreBadge: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8, flexDirection: 'row' },
  bigScoreNum: { fontSize: 42, fontWeight: '900', color: '#FFF' },
  bigScoreMax: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 14 },
  precisionLabel: { fontSize: 12, fontWeight: '600' },
  rateRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  rateValue: { fontSize: 28, fontWeight: '900' },
  rateLabel: { fontSize: 13, fontWeight: '600' },
  carreauRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16, backgroundColor: '#F59E0B10', paddingVertical: 8, borderRadius: 12 },
  carreauText: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
  duelSection: { marginBottom: 16 },
  duelRow: { flexDirection: 'row', alignItems: 'center' },
  duelPlayer: { flex: 1, alignItems: 'center', gap: 4 },
  duelName: { fontSize: 13, fontWeight: '700', maxWidth: 120 },
  duelScore: { fontSize: 18, fontWeight: '800' },
  duelVs: { width: 40, alignItems: 'center' },
  duelVsText: { fontSize: 11, fontWeight: '800' },
  winnerBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 12 },
  winnerText: { fontSize: 13, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 4 },
  playerNameFooter: { fontSize: 14, fontWeight: '700' },
  durationChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  durationText: { fontSize: 12, fontWeight: '500' },
});
