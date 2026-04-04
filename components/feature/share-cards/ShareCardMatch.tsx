/**
 * ShareCardMatch — Visual match result card for social sharing.
 * Shows score, teams, ELO, format, date, terrain, mene details, player actions, geo ranks.
 * Adapts layout to square / story / landscape formats.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme, type ShareCardFormat } from '@/services/shareCardService';
import type { Match, PlayerAction, Mene } from '@/types/petanque';

interface GeoRankInfo {
  city?: { name?: string; rank?: number };
  country?: { name?: string; rank?: number };
}

interface Props {
  match: Match;
  playerName?: string;
  eloRating?: number;
  eloRankLabel?: string;
  eloColor?: string;
  terrainName?: string;
  clubName?: string;
  geoRank?: GeoRankInfo | null;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
  format?: ShareCardFormat;
}

function MeneBar({ menes, ct, compact }: { menes: Mene[]; ct: any; compact?: boolean }) {
  if (!menes || menes.length === 0) return null;
  const h = compact ? 4 : 6;
  return (
    <View style={{ flexDirection: 'row', gap: compact ? 1 : 2, alignItems: 'flex-end' }}>
      {menes.slice(0, compact ? 15 : 20).map((m, i) => {
        const aWon = (m.teamAPoints || 0) > (m.teamBPoints || 0);
        const bWon = (m.teamBPoints || 0) > (m.teamAPoints || 0);
        const isNull = m.isNull;
        return (
          <View key={i} style={{
            width: compact ? 3 : 5,
            height: isNull ? h : Math.max(h, ((aWon ? m.teamAPoints : m.teamBPoints) || 1) * (compact ? 2 : 3)),
            backgroundColor: isNull ? '#64748B40' : aWon ? '#22C55E80' : '#EF444480',
            borderRadius: 1,
          }} />
        );
      })}
    </View>
  );
}

function PlayerActionRow({ pa, ct, compact }: { pa: PlayerAction; ct: any; compact?: boolean }) {
  const a = pa.actions;
  const tirPct = a.tirs > 0 ? Math.round((a.tirsSuccess / a.tirs) * 100) : 0;
  const ptPct = a.points > 0 ? Math.round((a.pointsSuccess / a.points) * 100) : 0;
  const fs = compact ? 8 : 10;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 4 : 6, paddingVertical: compact ? 1 : 2 }}>
      <Text style={{ fontSize: fs, fontWeight: '700', color: ct.textPrimary, width: compact ? 50 : 70 }} numberOfLines={1}>{pa.playerName}</Text>
      {a.tirs > 0 ? <Text style={{ fontSize: fs, color: '#3B82F6' }}>T:{a.tirsSuccess}/{a.tirs} ({tirPct}%)</Text> : null}
      {a.points > 0 ? <Text style={{ fontSize: fs, color: '#10B981' }}>P:{a.pointsSuccess}/{a.points} ({ptPct}%)</Text> : null}
      {a.carreaux > 0 ? <Text style={{ fontSize: fs, color: '#F59E0B' }}>C:{a.carreaux}</Text> : null}
    </View>
  );
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

export default function ShareCardMatch({ match, playerName, eloRating, eloRankLabel, eloColor, terrainName, clubName, geoRank, language = 'fr', colorTheme = 'dark', format = 'square' }: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];
  const isWinnerA = match.winner === 'A';
  const winGrad: [string, string] = ['#22C55E', '#16A34A'];
  const loseGrad: [string, string] = ['#EF4444', '#DC2626'];
  const dateStr = new Date(match.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const durationStr = match.duration ? `${Math.floor(match.duration / 60)}h${String(match.duration % 60).padStart(2, '0')}` : '';
  const hasActions = match.playerActions && match.playerActions.length > 0;
  const hasMenes = match.menes && match.menes.length > 0;

  const isStory = format === 'story';
  const isLandscape = format === 'landscape';

  // === LANDSCAPE ===
  if (isLandscape) {
    return (
      <View style={s.card}>
        <LinearGradient colors={ct.gradients} style={[s.bg, { padding: 16, flex: 1 }]}>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* Left: header + score */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={[s.header, { marginBottom: 6 }]}>
                <View style={s.headerLeft}>
                  <MaterialIcons name="sports" size={12} color={ct.accent} />
                  <Text style={[s.headerLabel, { color: ct.accent, fontSize: 9 }]}>MATCH</Text>
                </View>
                <Text style={{ fontSize: 9, color: ct.textSecondary }}>{dateStr}</Text>
              </View>
              <View style={[s.metaRow, { marginBottom: 6 }]}>
                <View style={s.metaChip}><Text style={[s.metaText, { color: ct.textSecondary, fontSize: 9 }]}>{match.format}</Text></View>
                <View style={s.metaChip}><Text style={[s.metaText, { color: ct.textSecondary, fontSize: 9 }]}>{match.mode}</Text></View>
                {durationStr ? <Text style={{ fontSize: 9, color: ct.textSecondary }}>{durationStr}</Text> : null}
              </View>
              <View style={[s.scoreContainer, { marginBottom: 6 }]}>
                <View style={[s.teamCol, { gap: 2 }]}>
                  <LinearGradient colors={isWinnerA ? winGrad : loseGrad} style={[s.scoreBadge, { width: 44, height: 44, borderRadius: 12 }]}>
                    <Text style={[s.scoreNum, { fontSize: 22 }]}>{match.teamA.score}</Text>
                  </LinearGradient>
                  <Text style={[s.teamLabel, { color: ct.textSecondary, fontSize: 7 }]}>{fr ? 'EQ. A' : 'TM A'}</Text>
                  <Text style={[s.teamNames, { color: ct.textPrimary, fontSize: 8, maxWidth: 80 }]} numberOfLines={1}>{match.teamA.playerNames.join(', ')}</Text>
                </View>
                <View style={[s.vsCol, { width: 24 }]}>
                  <Text style={[s.vsText, { color: ct.textSecondary, fontSize: 9 }]}>VS</Text>
                </View>
                <View style={[s.teamCol, { gap: 2 }]}>
                  <LinearGradient colors={!isWinnerA ? winGrad : loseGrad} style={[s.scoreBadge, { width: 44, height: 44, borderRadius: 12 }]}>
                    <Text style={[s.scoreNum, { fontSize: 22 }]}>{match.teamB.score}</Text>
                  </LinearGradient>
                  <Text style={[s.teamLabel, { color: ct.textSecondary, fontSize: 7 }]}>{fr ? 'EQ. B' : 'TM B'}</Text>
                  <Text style={[s.teamNames, { color: ct.textPrimary, fontSize: 8, maxWidth: 80 }]} numberOfLines={1}>{match.teamB.playerNames.join(', ')}</Text>
                </View>
              </View>
              {hasMenes ? <MeneBar menes={match.menes} ct={ct} compact /> : null}
            </View>

            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 10 }} />

            {/* Right: details */}
            <View style={{ width: '35%', justifyContent: 'center', gap: 4 }}>
              {match.tournamentName ? <Text style={{ fontSize: 9, fontWeight: '600', color: ct.accent }} numberOfLines={1}>{match.tournamentName}</Text> : null}
              {hasActions ? (
                <View style={{ gap: 1 }}>
                  <Text style={{ fontSize: 7, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.5 }}>{fr ? 'ACTIONS' : 'ACTIONS'}</Text>
                  {match.playerActions!.slice(0, 3).map((pa, i) => <PlayerActionRow key={i} pa={pa} ct={ct} compact />)}
                </View>
              ) : null}
              {playerName ? <Text style={[s.playerName, { color: ct.textPrimary, fontSize: 10 }]}>{playerName}</Text> : null}
              {eloRating ? (
                <View style={[s.eloBadge, { backgroundColor: (eloColor || ct.textSecondary) + '20' }]}>
                  <Text style={[s.eloText, { color: eloColor || ct.textSecondary, fontSize: 9 }]}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                </View>
              ) : null}
              <GeoRankBadges geoRank={geoRank} ct={ct} compact />
              {clubName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <MaterialIcons name="home" size={8} color={ct.textSecondary} />
                  <Text style={{ fontSize: 8, color: ct.textSecondary }} numberOfLines={1}>{clubName}</Text>
                </View>
              ) : null}
              {terrainName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <MaterialIcons name="place" size={8} color={ct.textSecondary} />
                  <Text style={{ fontSize: 8, color: ct.textSecondary }} numberOfLines={1}>{terrainName}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <ShareCardWatermark variant="light" size="sm" />
        </LinearGradient>
      </View>
    );
  }

  // === STORY ===
  if (isStory) {
    return (
      <View style={s.card}>
        <LinearGradient colors={ct.gradients} style={[s.bg, { padding: 28, flex: 1, justifyContent: 'center' }]}>
          {/* Header */}
          <View style={[s.header, { marginBottom: 16 }]}>
            <View style={s.headerLeft}>
              <MaterialIcons name="sports" size={18} color={ct.accent} />
              <Text style={[s.headerLabel, { color: ct.accent, fontSize: 12 }]}>MATCH</Text>
            </View>
            <View style={s.headerRight}>
              <Text style={[s.dateText, { color: ct.textSecondary, fontSize: 12 }]}>{dateStr}</Text>
              {durationStr ? <Text style={[s.durationText, { color: ct.textSecondary }]}>{durationStr}</Text> : null}
            </View>
          </View>

          {/* Meta */}
          <View style={[s.metaRow, { marginBottom: 20 }]}>
            <View style={s.metaChip}><MaterialIcons name="group" size={12} color={ct.textSecondary} /><Text style={[s.metaText, { color: ct.textSecondary }]}>{match.format}</Text></View>
            <View style={[s.metaChip, match.mode === 'Tournoi' ? { backgroundColor: ct.accent + '20' } : null]}>
              <MaterialIcons name={match.mode === 'Tournoi' ? 'emoji-events' : 'fitness-center'} size={12} color={match.mode === 'Tournoi' ? ct.accent : ct.textSecondary} />
              <Text style={[s.metaText, match.mode === 'Tournoi' ? { color: ct.accent } : { color: ct.textSecondary }]}>{match.mode}</Text>
            </View>
            {match.tournamentName ? <View style={[s.metaChip, { backgroundColor: ct.accent + '15' }]}><Text style={[s.metaText, { color: ct.accent }]} numberOfLines={1}>{match.tournamentName}</Text></View> : null}
          </View>

          {/* Score */}
          <View style={[s.scoreContainer, { marginBottom: 20 }]}>
            <View style={s.teamCol}>
              <LinearGradient colors={isWinnerA ? winGrad : loseGrad} style={[s.scoreBadge, { width: 80, height: 80, borderRadius: 22 }]}>
                <Text style={[s.scoreNum, { fontSize: 40 }]}>{match.teamA.score}</Text>
              </LinearGradient>
              <Text style={[s.teamLabel, { color: ct.textSecondary }]}>{fr ? 'EQUIPE A' : 'TEAM A'}</Text>
              <Text style={[s.teamNames, { color: ct.textPrimary, fontSize: 12 }]} numberOfLines={2}>{match.teamA.playerNames.join(', ')}</Text>
            </View>
            <View style={s.vsCol}>
              <View style={[s.vsCircle, { width: 38, height: 38, borderRadius: 19 }]}>
                <Text style={[s.vsText, { color: ct.textSecondary }]}>VS</Text>
              </View>
              <MaterialIcons name={isWinnerA ? 'arrow-back' : 'arrow-forward'} size={14} color="#22C55E" />
            </View>
            <View style={s.teamCol}>
              <LinearGradient colors={!isWinnerA ? winGrad : loseGrad} style={[s.scoreBadge, { width: 80, height: 80, borderRadius: 22 }]}>
                <Text style={[s.scoreNum, { fontSize: 40 }]}>{match.teamB.score}</Text>
              </LinearGradient>
              <Text style={[s.teamLabel, { color: ct.textSecondary }]}>{fr ? 'EQUIPE B' : 'TEAM B'}</Text>
              <Text style={[s.teamNames, { color: ct.textPrimary, fontSize: 12 }]} numberOfLines={2}>{match.teamB.playerNames.join(', ')}</Text>
            </View>
          </View>

          {/* Mene visual bar */}
          {hasMenes ? (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.8, marginBottom: 6 }}>{match.menes.length} {fr ? 'MENES' : 'ENDS'}</Text>
              <MeneBar menes={match.menes} ct={ct} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                {match.menes.slice(0, 10).map((m, i) => (
                  <View key={i} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 7, color: ct.textSecondary }}>{i + 1}</Text>
                    <Text style={{ fontSize: 8, fontWeight: '700', color: (m.teamAPoints || 0) > (m.teamBPoints || 0) ? '#22C55E' : '#EF4444' }}>
                      {m.teamAPoints}-{m.teamBPoints}
                    </Text>
                  </View>
                ))}
                {match.menes.length > 10 ? <Text style={{ fontSize: 8, color: ct.textSecondary, alignSelf: 'center' }}>+{match.menes.length - 10}</Text> : null}
              </View>
            </View>
          ) : null}

          {/* Player actions */}
          {hasActions ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 10, marginBottom: 16 }}>
              <Text style={{ fontSize: 9, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.8, marginBottom: 6 }}>{fr ? 'ACTIONS JOUEURS' : 'PLAYER ACTIONS'}</Text>
              {match.playerActions!.slice(0, 6).map((pa, i) => <PlayerActionRow key={i} pa={pa} ct={ct} />)}
            </View>
          ) : null}

          {/* Footer: player + ELO + geo */}
          <View style={[s.footer, { gap: 8 }]}>
            <View style={{ gap: 6, flex: 1 }}>
              <View style={s.footerLeft}>
                {playerName ? <Text style={[s.playerName, { color: ct.textPrimary }]}>{playerName}</Text> : null}
                {eloRating ? (
                  <View style={[s.eloBadge, { backgroundColor: (eloColor || ct.textSecondary) + '20' }]}>
                    <Text style={[s.eloText, { color: eloColor || ct.textSecondary }]}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                  </View>
                ) : null}
              </View>
              <GeoRankBadges geoRank={geoRank} ct={ct} />
              {clubName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <MaterialIcons name="home" size={10} color={ct.textSecondary} />
                  <Text style={{ fontSize: 10, color: ct.textSecondary }} numberOfLines={1}>{clubName}</Text>
                </View>
              ) : null}
            </View>
            {terrainName ? (
              <View style={s.terrainChip}>
                <MaterialIcons name="place" size={10} color={ct.textSecondary} />
                <Text style={[s.terrainText, { color: ct.textSecondary }]} numberOfLines={1}>{terrainName}</Text>
              </View>
            ) : null}
          </View>
          <ShareCardWatermark variant="light" size="sm" />
        </LinearGradient>
      </View>
    );
  }

  // === SQUARE (default) ===
  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={[s.bg, { padding: 22, flex: 1 }]}>
        {/* Header */}
        <View style={[s.header, { marginBottom: 10 }]}>
          <View style={s.headerLeft}>
            <MaterialIcons name="sports" size={15} color={ct.accent} />
            <Text style={[s.headerLabel, { color: ct.accent, fontSize: 10 }]}>MATCH</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={[s.dateText, { color: ct.textSecondary, fontSize: 11 }]}>{dateStr}</Text>
            {durationStr ? <Text style={[s.durationText, { color: ct.textSecondary, fontSize: 10 }]}>{durationStr}</Text> : null}
          </View>
        </View>

        <View style={[s.metaRow, { marginBottom: 14 }]}>
          <View style={s.metaChip}><MaterialIcons name="group" size={11} color={ct.textSecondary} /><Text style={[s.metaText, { color: ct.textSecondary }]}>{match.format}</Text></View>
          <View style={[s.metaChip, match.mode === 'Tournoi' ? { backgroundColor: ct.accent + '20' } : null]}>
            <MaterialIcons name={match.mode === 'Tournoi' ? 'emoji-events' : 'fitness-center'} size={11} color={match.mode === 'Tournoi' ? ct.accent : ct.textSecondary} />
            <Text style={[s.metaText, match.mode === 'Tournoi' ? { color: ct.accent } : { color: ct.textSecondary }]}>{match.mode}</Text>
          </View>
          {match.tournamentName ? <View style={[s.metaChip, { backgroundColor: ct.accent + '15' }]}><Text style={[s.metaText, { color: ct.accent }]} numberOfLines={1}>{match.tournamentName}</Text></View> : null}
        </View>

        {/* Score */}
        <View style={[s.scoreContainer, { marginBottom: 14 }]}>
          <View style={s.teamCol}>
            <LinearGradient colors={isWinnerA ? winGrad : loseGrad} style={[s.scoreBadge, { width: 64, height: 64, borderRadius: 18 }]}>
              <Text style={[s.scoreNum, { fontSize: 32 }]}>{match.teamA.score}</Text>
            </LinearGradient>
            <Text style={[s.teamLabel, { color: ct.textSecondary }]}>{fr ? 'EQUIPE A' : 'TEAM A'}</Text>
            <Text style={[s.teamNames, { color: ct.textPrimary, fontSize: 11 }]} numberOfLines={2}>{match.teamA.playerNames.join(', ')}</Text>
          </View>
          <View style={s.vsCol}>
            <View style={[s.vsCircle, { width: 32, height: 32, borderRadius: 16 }]}>
              <Text style={[s.vsText, { color: ct.textSecondary, fontSize: 10 }]}>VS</Text>
            </View>
            <MaterialIcons name={isWinnerA ? 'arrow-back' : 'arrow-forward'} size={12} color="#22C55E" />
          </View>
          <View style={s.teamCol}>
            <LinearGradient colors={!isWinnerA ? winGrad : loseGrad} style={[s.scoreBadge, { width: 64, height: 64, borderRadius: 18 }]}>
              <Text style={[s.scoreNum, { fontSize: 32 }]}>{match.teamB.score}</Text>
            </LinearGradient>
            <Text style={[s.teamLabel, { color: ct.textSecondary }]}>{fr ? 'EQUIPE B' : 'TEAM B'}</Text>
            <Text style={[s.teamNames, { color: ct.textPrimary, fontSize: 11 }]} numberOfLines={2}>{match.teamB.playerNames.join(', ')}</Text>
          </View>
        </View>

        {/* Mene bar + scores */}
        {hasMenes ? (
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <MeneBar menes={match.menes} ct={ct} />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              {match.menes.slice(0, 8).map((m, i) => (
                <View key={i} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, color: ct.textSecondary }}>{i + 1}</Text>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: (m.teamAPoints || 0) > (m.teamBPoints || 0) ? '#22C55E' : '#EF4444' }}>
                    {m.teamAPoints}-{m.teamBPoints}
                  </Text>
                </View>
              ))}
              {match.menes.length > 8 ? <Text style={{ fontSize: 8, color: ct.textSecondary, alignSelf: 'center' }}>+{match.menes.length - 8}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* Player actions (compact) */}
        {hasActions ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 8, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>{fr ? 'ACTIONS' : 'ACTIONS'}</Text>
            {match.playerActions!.slice(0, 4).map((pa, i) => <PlayerActionRow key={i} pa={pa} ct={ct} compact />)}
          </View>
        ) : null}

        {/* Footer */}
        <View style={[s.footer, { gap: 6 }]}>
          <View style={{ gap: 4, flex: 1 }}>
            <View style={s.footerLeft}>
              {playerName ? <Text style={[s.playerName, { color: ct.textPrimary, fontSize: 12 }]}>{playerName}</Text> : null}
              {eloRating ? (
                <View style={[s.eloBadge, { backgroundColor: (eloColor || ct.textSecondary) + '20' }]}>
                  <Text style={[s.eloText, { color: eloColor || ct.textSecondary, fontSize: 10 }]}>ELO {eloRating}</Text>
                </View>
              ) : null}
            </View>
            <GeoRankBadges geoRank={geoRank} ct={ct} compact />
            {clubName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <MaterialIcons name="home" size={9} color={ct.textSecondary} />
                <Text style={{ fontSize: 9, color: ct.textSecondary }} numberOfLines={1}>{clubName}</Text>
              </View>
            ) : null}
          </View>
          {terrainName ? (
            <View style={s.terrainChip}>
              <MaterialIcons name="place" size={10} color={ct.textSecondary} />
              <Text style={[s.terrainText, { color: ct.textSecondary }]} numberOfLines={1}>{terrainName}</Text>
            </View>
          ) : null}
        </View>
        <ShareCardWatermark variant="light" size="sm" />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  bg: { padding: 24, flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontSize: 12, fontWeight: '600' },
  durationText: { fontSize: 11, fontWeight: '500' },
  metaRow: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  metaText: { fontSize: 10, fontWeight: '600' },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  teamCol: { flex: 1, alignItems: 'center', gap: 4 },
  scoreBadge: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 36, fontWeight: '900', color: '#FFF' },
  teamLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  teamNames: { fontSize: 11, fontWeight: '600', textAlign: 'center', maxWidth: 120 },
  vsCol: { width: 40, alignItems: 'center', gap: 4 },
  vsCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: 11, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10, marginBottom: 4 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { fontSize: 13, fontWeight: '700' },
  eloBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  eloText: { fontSize: 10, fontWeight: '700' },
  terrainChip: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: 120 },
  terrainText: { fontSize: 10, fontWeight: '500' },
});
