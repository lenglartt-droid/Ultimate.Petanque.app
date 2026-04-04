/**
 * ShareCardChallenge — Challenge result card for social sharing.
 * Shows score, type, atelier results, ELO, geo ranks, opponent info.
 * Adapts layout to square / story / landscape formats without truncation.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme, type ShareCardFormat } from '@/services/shareCardService';
import type { Challenge } from '@/types/petanque';

interface GeoRankInfo {
  city?: { name?: string; rank?: number };
  country?: { name?: string; rank?: number };
}

interface PlayerInfo {
  eloRating?: number;
  club?: string;
  city?: string;
  country?: string;
}

interface Props {
  challenge: Challenge;
  playerName?: string;
  eloRating?: number;
  eloColor?: string;
  eloRankLabel?: string;
  clubName?: string;
  geoRank?: GeoRankInfo | null;
  playersData?: Record<string, PlayerInfo>;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
  format?: ShareCardFormat;
}

const TYPE_CONFIG: Record<string, { label: { fr: string; en: string }; color: string; icon: string; gradient: [string, string] }> = {
  '10_tirs': { label: { fr: '10 Tirs', en: '10 Shots' }, color: '#3B82F6', icon: 'gps-fixed', gradient: ['#1E40AF', '#2563EB'] },
  '10_tirs_sautee': { label: { fr: '10 Tirs Sautee', en: '10 Lob Shots' }, color: '#8B5CF6', icon: 'height', gradient: ['#6D28D9', '#7C3AED'] },
  precision: { label: { fr: 'Precision', en: 'Precision' }, color: '#F59E0B', icon: 'track-changes', gradient: ['#D97706', '#F59E0B'] },
};

const ATELIER_LABELS: Record<string, { fr: string; en: string; icon: string }> = {
  boule_seule: { fr: 'Boule seule', en: 'Single ball', icon: 'radio-button-checked' },
  derriere_but: { fr: 'Derriere but', en: 'Behind jack', icon: 'gps-fixed' },
  entre_2_boules: { fr: 'Entre 2 boules', en: 'Between 2', icon: 'more-horiz' },
  sautee: { fr: 'Sautee', en: 'Lob shot', icon: 'flight-takeoff' },
  tir_but: { fr: 'Tir de but', en: 'Jack shot', icon: 'stars' },
};

function AtelierScoreRow({ atelierId, score, maxScore, ct, compact }: { atelierId: string; score: number; maxScore: number; ct: any; compact?: boolean }) {
  const info = ATELIER_LABELS[atelierId];
  if (!info) return null;
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const fs = compact ? 7 : 9;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 3 : 5, paddingVertical: compact ? 0.5 : 1.5 }}>
      <MaterialIcons name={info.icon as any} size={compact ? 8 : 10} color={ct.textSecondary} />
      <Text style={{ fontSize: fs, fontWeight: '600', color: ct.textPrimary, flex: 1 }} numberOfLines={1}>{info.fr}</Text>
      <Text style={{ fontSize: fs, fontWeight: '800', color: pct >= 60 ? '#22C55E' : pct >= 30 ? '#F59E0B' : '#EF4444' }}>{score}/{maxScore}</Text>
      <Text style={{ fontSize: compact ? 6 : 8, color: ct.textSecondary }}>{pct}%</Text>
    </View>
  );
}

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

export default function ShareCardChallenge({ challenge, playerName, eloRating, eloColor, eloRankLabel, clubName, geoRank, playersData, language = 'fr', colorTheme = 'dark', format = 'square' }: Props) {
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
  const hasAteliers = isPrecision && challenge.atelierScores && Object.keys(challenge.atelierScores).length > 0;
  const pd = playersData || {};
  const opponentInfo = challenge.opponentId ? pd[challenge.opponentId] : undefined;

  const isStory = format === 'story';
  const isLandscape = format === 'landscape';

  // === LANDSCAPE ===
  if (isLandscape) {
    return (
      <View style={s.card}>
        <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
          {/* Top header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ backgroundColor: config.color + '20', width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={config.icon as any} size={11} color={config.color} />
              </View>
              <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 1, color: ct.textSecondary }}>{fr ? 'DEFI' : 'CHALLENGE'}</Text>
              <Text style={{ fontSize: 10, fontWeight: '800', color: config.color }}>{config.label[language]}</Text>
              {is1v1 ? <View style={{ backgroundColor: '#EF444420', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5 }}><Text style={{ fontSize: 8, fontWeight: '800', color: '#EF4444' }}>1v1</Text></View> : null}
            </View>
            <Text style={{ fontSize: 8, color: ct.textSecondary }}>{dateStr}</Text>
          </View>

          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* Left: score */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <LinearGradient colors={config.gradient} style={{ width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFF' }}>{isPrecision ? (challenge.totalPoints || 0) : successCount}</Text>
                <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>/{isPrecision ? (challenge.maxPoints || 75) : totalShots}</Text>
              </LinearGradient>
              {!isPrecision ? <Text style={{ fontSize: 12, fontWeight: '900', color: config.color }}>{Math.round(successRate)}%</Text> : null}
              {carreauCount > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 }}>
                  <MaterialIcons name="star" size={8} color="#F59E0B" />
                  <Text style={{ fontSize: 8, fontWeight: '700', color: '#F59E0B' }}>{carreauCount}C</Text>
                </View>
              ) : null}
              {is1v1 && challenge.opponentName ? (
                <View style={{ marginTop: 4, alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, fontWeight: '700', color: ct.textSecondary }}>VS</Text>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: ct.textPrimary }} numberOfLines={1}>{challenge.opponentName}</Text>
                  {opponentInfo?.eloRating ? <Text style={{ fontSize: 7, color: '#94A3B8' }}>ELO {opponentInfo.eloRating}</Text> : null}
                  {opponentInfo?.club ? <Text style={{ fontSize: 7, color: '#64748B' }}>{opponentInfo.club}</Text> : null}
                </View>
              ) : null}
            </View>

            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 8 }} />

            {/* Right: details */}
            <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
              {hasAteliers ? (
                <View style={{ gap: 0.5 }}>
                  <Text style={{ fontSize: 6, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.5 }}>ATELIERS</Text>
                  {Object.entries(challenge.atelierScores!).map(([aid, score]) => (
                    <AtelierScoreRow key={aid} atelierId={aid} score={score as number} maxScore={20} ct={ct} compact />
                  ))}
                </View>
              ) : null}
              {playerName ? <Text style={{ fontSize: 9, fontWeight: '700', color: ct.textPrimary }}>{playerName}</Text> : null}
              {eloRating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: (eloColor || '#94A3B8') + '20', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: eloColor || '#94A3B8' }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                </View>
              ) : null}
              <GeoRankBadges geoRank={geoRank} compact />
              {clubName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <MaterialIcons name="home" size={7} color={ct.textSecondary} />
                  <Text style={{ fontSize: 7, color: ct.textSecondary }} numberOfLines={1}>{clubName}</Text>
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
  const pad = isStory ? 24 : 18;
  const scoreBadgeSize = isStory ? 100 : 80;
  const scoreFontSize = isStory ? 42 : 34;

  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: pad, justifyContent: isStory ? 'center' : 'space-between' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isStory ? 16 : 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: config.color + '20', width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name={config.icon as any} size={15} color={config.color} />
            </View>
            <View>
              <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 1.5, color: ct.textSecondary }}>{fr ? 'DEFI' : 'CHALLENGE'}</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: config.color }}>{config.label[language]}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 3 }}>
            {is1v1 ? <View style={{ backgroundColor: '#EF444425', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }}><Text style={{ fontSize: 10, fontWeight: '800', color: '#EF4444' }}>1v1</Text></View> : null}
            <Text style={{ fontSize: 10, fontWeight: '500', color: ct.textSecondary }}>{dateStr}</Text>
          </View>
        </View>

        {/* Main score */}
        <View style={{ alignItems: 'center', marginBottom: isStory ? 16 : 10 }}>
          <LinearGradient colors={config.gradient} style={{ width: scoreBadgeSize, height: scoreBadgeSize, borderRadius: scoreBadgeSize * 0.28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 4 }}>
            <Text style={{ fontSize: scoreFontSize, fontWeight: '900', color: '#FFF' }}>{isPrecision ? (challenge.totalPoints || 0) : successCount}</Text>
            <Text style={{ fontSize: isStory ? 14 : 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: scoreFontSize * 0.3 }}>/{isPrecision ? (challenge.maxPoints || 75) : totalShots}</Text>
          </LinearGradient>
          {!isPrecision ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
              <Text style={{ fontSize: isStory ? 26 : 22, fontWeight: '900', color: config.color }}>{Math.round(successRate)}%</Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: ct.textSecondary }}>{fr ? 'reussite' : 'success'}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 10, fontWeight: '600', color: ct.textSecondary }}>{fr ? 'points totaux' : 'total points'}</Text>
          )}
        </View>

        {/* Carreaux */}
        {carreauCount > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: isStory ? 12 : 8, backgroundColor: '#F59E0B10', paddingVertical: 4, borderRadius: 8 }}>
            <MaterialIcons name="star" size={12} color="#F59E0B" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#F59E0B' }}>{carreauCount} {carreauCount > 1 ? 'carreaux' : 'carreau'}</Text>
          </View>
        ) : null}

        {/* Atelier results */}
        {hasAteliers ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: isStory ? 10 : 8, marginBottom: isStory ? 12 : 8 }}>
            <Text style={{ fontSize: 8, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>{fr ? 'RESULTATS PAR ATELIER' : 'WORKSHOP RESULTS'}</Text>
            {Object.entries(challenge.atelierScores!).map(([aid, score]) => (
              <AtelierScoreRow key={aid} atelierId={aid} score={score as number} maxScore={20} ct={ct} />
            ))}
          </View>
        ) : null}

        {/* 1v1 result */}
        {is1v1 && challenge.opponentName ? (
          <View style={{ marginBottom: isStory ? 12 : 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: ct.textPrimary, maxWidth: 100 }} numberOfLines={1}>{playerName || challenge.playerName || (fr ? 'Vous' : 'You')}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: challenge.winner === 'player' ? '#22C55E' : challenge.winner === 'draw' ? ct.textSecondary : '#EF4444' }}>
                  {isPrecision ? (challenge.totalPoints || 0) : successCount}/{isPrecision ? (challenge.maxPoints || 75) : totalShots}
                </Text>
              </View>
              <Text style={{ fontSize: 9, fontWeight: '800', color: ct.textSecondary }}>VS</Text>
              <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: ct.textPrimary, maxWidth: 100 }} numberOfLines={1}>{challenge.opponentName}</Text>
                {opponentInfo?.eloRating ? <Text style={{ fontSize: 8, color: '#94A3B8' }}>ELO {opponentInfo.eloRating}</Text> : null}
                {opponentInfo?.club ? <Text style={{ fontSize: 8, color: '#64748B' }}>{opponentInfo.club}</Text> : null}
                {opponentInfo?.city ? <Text style={{ fontSize: 7, color: '#64748B' }}>{opponentInfo.city}</Text> : null}
                <Text style={{ fontSize: 14, fontWeight: '800', color: challenge.winner === 'opponent' ? '#22C55E' : challenge.winner === 'draw' ? ct.textSecondary : '#EF4444' }}>
                  {isPrecision
                    ? (challenge.opponentResult?.totalPoints || 0) + '/' + (challenge.maxPoints || 75)
                    : (challenge.opponentResult?.successCount || 0) + '/' + (challenge.opponentResult?.totalShots || totalShots)}
                </Text>
              </View>
            </View>
            {challenge.winner ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 6, paddingVertical: 5, borderRadius: 8, backgroundColor: challenge.winner === 'draw' ? ct.textSecondary + '20' : '#22C55E20' }}>
                <MaterialIcons name={challenge.winner === 'draw' ? 'handshake' : 'emoji-events'} size={12} color={challenge.winner === 'draw' ? ct.textSecondary : '#22C55E'} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: challenge.winner === 'draw' ? ct.textSecondary : '#22C55E' }}>
                  {challenge.winner === 'draw' ? (fr ? 'Egalite' : 'Draw') : challenge.winner === 'player' ? (fr ? 'Victoire' : 'Victory') : (fr ? 'Defaite' : 'Defeat')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Footer */}
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {playerName && !is1v1 ? <Text style={{ fontSize: 11, fontWeight: '700', color: ct.textPrimary }}>{playerName}</Text> : null}
              {eloRating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: (eloColor || '#94A3B8') + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: eloColor || '#94A3B8' }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                </View>
              ) : null}
            </View>
            {challenge.duration ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <MaterialIcons name="timer" size={10} color={ct.textSecondary} />
                <Text style={{ fontSize: 9, color: ct.textSecondary }}>{Math.floor(challenge.duration / 60)}:{String(challenge.duration % 60).padStart(2, '0')}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <GeoRankBadges geoRank={geoRank} compact={!isStory} />
            {clubName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <MaterialIcons name="home" size={8} color={ct.textSecondary} />
                <Text style={{ fontSize: 8, color: ct.textSecondary }} numberOfLines={1}>{clubName}</Text>
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
});
