/**
 * ShareCardMatch — Visual match result card for social sharing.
 * Shows score, teams with ELO/club/geo, mene details, player actions.
 * Adapts layout to square / story / landscape formats without truncation.
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

interface PlayerInfo {
  eloRating?: number;
  club?: string;
  city?: string;
  country?: string;
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
  playersData?: Record<string, PlayerInfo>;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
  format?: ShareCardFormat;
}

function MeneBar({ menes, compact }: { menes: Mene[]; compact?: boolean }) {
  if (!menes || menes.length === 0) return null;
  const h = compact ? 3 : 5;
  const max = compact ? 13 : 18;
  return (
    <View style={{ flexDirection: 'row', gap: compact ? 1 : 2, alignItems: 'flex-end' }}>
      {menes.slice(0, max).map((m, i) => {
        const aWon = (m.teamAPoints || 0) > (m.teamBPoints || 0);
        const isNull = m.isNull;
        return (
          <View key={i} style={{
            width: compact ? 3 : 4,
            height: isNull ? h : Math.max(h, ((aWon ? m.teamAPoints : m.teamBPoints) || 1) * (compact ? 2 : 2.5)),
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
  const fs = compact ? 7 : 9;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 3 : 5, paddingVertical: compact ? 0.5 : 1.5 }}>
      <Text style={{ fontSize: fs, fontWeight: '700', color: ct.textPrimary, width: compact ? 44 : 60 }} numberOfLines={1}>{pa.playerName}</Text>
      {a.tirs > 0 ? <Text style={{ fontSize: fs, color: '#3B82F6' }}>T:{a.tirsSuccess}/{a.tirs}({tirPct}%)</Text> : null}
      {a.points > 0 ? <Text style={{ fontSize: fs, color: '#10B981' }}>P:{a.pointsSuccess}/{a.points}({ptPct}%)</Text> : null}
      {a.carreaux > 0 ? <Text style={{ fontSize: fs, color: '#F59E0B' }}>C:{a.carreaux}</Text> : null}
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

/** Inline player info (ELO + club + city) for team members */
function TeamPlayerInfo({ name, info, ct, compact }: { name: string; info?: PlayerInfo; ct: any; compact?: boolean }) {
  const fs = compact ? 7 : 9;
  if (!info) return <Text style={{ fontSize: fs, fontWeight: '600', color: ct.textPrimary }} numberOfLines={1}>{name}</Text>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: fs, fontWeight: '600', color: ct.textPrimary }} numberOfLines={1}>{name}</Text>
      {info.eloRating ? <Text style={{ fontSize: compact ? 6 : 8, fontWeight: '700', color: '#94A3B8' }}>ELO {info.eloRating}</Text> : null}
      {info.club ? <Text style={{ fontSize: compact ? 6 : 7, color: '#64748B' }} numberOfLines={1}>{info.club}</Text> : null}
      {info.city ? <Text style={{ fontSize: compact ? 6 : 7, color: '#64748B' }}>{info.city}</Text> : null}
    </View>
  );
}

export default function ShareCardMatch({ match, playerName, eloRating, eloRankLabel, eloColor, terrainName, clubName, geoRank, playersData, language = 'fr', colorTheme = 'dark', format = 'square' }: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];
  const isWinnerA = match.winner === 'A';
  const winGrad: [string, string] = ['#22C55E', '#16A34A'];
  const loseGrad: [string, string] = ['#EF4444', '#DC2626'];
  const dateStr = new Date(match.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  const durationStr = match.duration ? `${Math.floor(match.duration / 60)}h${String(match.duration % 60).padStart(2, '0')}` : '';
  const hasActions = match.playerActions && match.playerActions.length > 0;
  const hasMenes = match.menes && match.menes.length > 0;
  const pd = playersData || {};

  const isStory = format === 'story';
  const isLandscape = format === 'landscape';

  // === LANDSCAPE ===
  if (isLandscape) {
    return (
      <View style={s.card}>
        <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
          {/* Top row: header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="sports" size={10} color={ct.accent} />
              <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 1, color: ct.accent }}>MATCH</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4 }}>
                <Text style={{ fontSize: 8, color: ct.textSecondary }}>{match.format}</Text>
                <Text style={{ fontSize: 8, color: ct.textSecondary }}>{match.mode}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 8, color: ct.textSecondary }}>{dateStr}</Text>
              {durationStr ? <Text style={{ fontSize: 8, color: ct.textSecondary }}>{durationStr}</Text> : null}
            </View>
          </View>

          {/* Main content */}
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* Left: scores + teams */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <LinearGradient colors={isWinnerA ? winGrad : loseGrad} style={{ width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>{match.teamA.score}</Text>
                  </LinearGradient>
                  <Text style={{ fontSize: 6, fontWeight: '700', color: ct.textSecondary, marginTop: 2, letterSpacing: 0.5 }}>{fr ? 'EQ. A' : 'TM A'}</Text>
                  {match.teamA.playerNames.map((n, i) => (
                    <TeamPlayerInfo key={i} name={n} info={pd[match.teamA.players?.[i]]} ct={ct} compact />
                  ))}
                </View>
                <View style={{ width: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, fontWeight: '800', color: ct.textSecondary }}>VS</Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <LinearGradient colors={!isWinnerA ? winGrad : loseGrad} style={{ width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>{match.teamB.score}</Text>
                  </LinearGradient>
                  <Text style={{ fontSize: 6, fontWeight: '700', color: ct.textSecondary, marginTop: 2, letterSpacing: 0.5 }}>{fr ? 'EQ. B' : 'TM B'}</Text>
                  {match.teamB.playerNames.map((n, i) => (
                    <TeamPlayerInfo key={i} name={n} info={pd[match.teamB.players?.[i]]} ct={ct} compact />
                  ))}
                </View>
              </View>
              {hasMenes ? <View style={{ alignItems: 'center' }}><MeneBar menes={match.menes} compact /></View> : null}
            </View>

            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 8 }} />

            {/* Right: actions + info */}
            <View style={{ width: '32%', justifyContent: 'center', gap: 3 }}>
              {match.tournamentName ? <Text style={{ fontSize: 8, fontWeight: '600', color: ct.accent }} numberOfLines={1}>{match.tournamentName}</Text> : null}
              {hasActions ? (
                <View style={{ gap: 0.5 }}>
                  <Text style={{ fontSize: 6, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.5 }}>ACTIONS</Text>
                  {match.playerActions!.slice(0, 3).map((pa, i) => <PlayerActionRow key={i} pa={pa} ct={ct} compact />)}
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
              {terrainName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <MaterialIcons name="place" size={7} color={ct.textSecondary} />
                  <Text style={{ fontSize: 7, color: ct.textSecondary }} numberOfLines={1}>{terrainName}</Text>
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
        <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="sports" size={16} color={ct.accent} />
              <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: ct.accent }}>MATCH</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: ct.textSecondary }}>{dateStr}</Text>
              {durationStr ? <Text style={{ fontSize: 10, color: ct.textSecondary }}>{durationStr}</Text> : null}
            </View>
          </View>

          {/* Meta */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
            <View style={s.metaChip}><MaterialIcons name="group" size={11} color={ct.textSecondary} /><Text style={{ fontSize: 10, fontWeight: '600', color: ct.textSecondary }}>{match.format}</Text></View>
            <View style={[s.metaChip, match.mode === 'Tournoi' ? { backgroundColor: ct.accent + '20' } : null]}>
              <MaterialIcons name={match.mode === 'Tournoi' ? 'emoji-events' : 'fitness-center'} size={11} color={match.mode === 'Tournoi' ? ct.accent : ct.textSecondary} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: match.mode === 'Tournoi' ? ct.accent : ct.textSecondary }}>{match.mode}</Text>
            </View>
            {match.tournamentName ? <View style={[s.metaChip, { backgroundColor: ct.accent + '15' }]}><Text style={{ fontSize: 10, fontWeight: '600', color: ct.accent }} numberOfLines={1}>{match.tournamentName}</Text></View> : null}
          </View>

          {/* Score */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <LinearGradient colors={isWinnerA ? winGrad : loseGrad} style={{ width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 36, fontWeight: '900', color: '#FFF' }}>{match.teamA.score}</Text>
              </LinearGradient>
              <Text style={{ fontSize: 8, fontWeight: '700', color: ct.textSecondary, letterSpacing: 1 }}>{fr ? 'EQUIPE A' : 'TEAM A'}</Text>
              {match.teamA.playerNames.map((n, i) => (
                <TeamPlayerInfo key={i} name={n} info={pd[match.teamA.players?.[i]]} ct={ct} />
              ))}
            </View>
            <View style={{ width: 36, alignItems: 'center', gap: 4 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: ct.textSecondary }}>VS</Text>
              </View>
              <MaterialIcons name={isWinnerA ? 'arrow-back' : 'arrow-forward'} size={12} color="#22C55E" />
            </View>
            <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <LinearGradient colors={!isWinnerA ? winGrad : loseGrad} style={{ width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 36, fontWeight: '900', color: '#FFF' }}>{match.teamB.score}</Text>
              </LinearGradient>
              <Text style={{ fontSize: 8, fontWeight: '700', color: ct.textSecondary, letterSpacing: 1 }}>{fr ? 'EQUIPE B' : 'TEAM B'}</Text>
              {match.teamB.playerNames.map((n, i) => (
                <TeamPlayerInfo key={i} name={n} info={pd[match.teamB.players?.[i]]} ct={ct} />
              ))}
            </View>
          </View>

          {/* Mene bar + detail */}
          {hasMenes ? (
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 8, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>{match.menes.length} {fr ? 'MENES' : 'ENDS'}</Text>
              <MeneBar menes={match.menes} />
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {match.menes.slice(0, 10).map((m, i) => (
                  <View key={i} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 6, color: ct.textSecondary }}>{i + 1}</Text>
                    <Text style={{ fontSize: 7, fontWeight: '700', color: (m.teamAPoints || 0) > (m.teamBPoints || 0) ? '#22C55E' : '#EF4444' }}>
                      {m.teamAPoints}-{m.teamBPoints}
                    </Text>
                  </View>
                ))}
                {match.menes.length > 10 ? <Text style={{ fontSize: 7, color: ct.textSecondary, alignSelf: 'center' }}>+{match.menes.length - 10}</Text> : null}
              </View>
            </View>
          ) : null}

          {/* Actions */}
          {hasActions ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 8, marginBottom: 14 }}>
              <Text style={{ fontSize: 8, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.8, marginBottom: 4 }}>{fr ? 'ACTIONS JOUEURS' : 'PLAYER ACTIONS'}</Text>
              {match.playerActions!.slice(0, 5).map((pa, i) => <PlayerActionRow key={i} pa={pa} ct={ct} />)}
            </View>
          ) : null}

          {/* Footer */}
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {playerName ? <Text style={{ fontSize: 11, fontWeight: '700', color: ct.textPrimary }}>{playerName}</Text> : null}
              {eloRating ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: (eloColor || '#94A3B8') + '20', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }}>
                  <MaterialIcons name="diamond" size={9} color={eloColor || '#94A3B8'} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: eloColor || '#94A3B8' }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 3 }}>
                <GeoRankBadges geoRank={geoRank} />
                {clubName ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <MaterialIcons name="home" size={9} color={ct.textSecondary} />
                    <Text style={{ fontSize: 9, color: ct.textSecondary }} numberOfLines={1}>{clubName}</Text>
                  </View>
                ) : null}
              </View>
              {terrainName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <MaterialIcons name="place" size={9} color={ct.textSecondary} />
                  <Text style={{ fontSize: 9, color: ct.textSecondary }} numberOfLines={1}>{terrainName}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <ShareCardWatermark variant="light" size="sm" />
        </LinearGradient>
      </View>
    );
  }

  // === SQUARE (default) ===
  return (
    <View style={s.card}>
      <LinearGradient colors={ct.gradients} style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <MaterialIcons name="sports" size={13} color={ct.accent} />
            <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: ct.accent }}>MATCH</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: ct.textSecondary }}>{dateStr}</Text>
            {durationStr ? <Text style={{ fontSize: 9, color: ct.textSecondary }}>{durationStr}</Text> : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          <View style={s.metaChip}><MaterialIcons name="group" size={10} color={ct.textSecondary} /><Text style={{ fontSize: 9, fontWeight: '600', color: ct.textSecondary }}>{match.format}</Text></View>
          <View style={[s.metaChip, match.mode === 'Tournoi' ? { backgroundColor: ct.accent + '20' } : null]}>
            <MaterialIcons name={match.mode === 'Tournoi' ? 'emoji-events' : 'fitness-center'} size={10} color={match.mode === 'Tournoi' ? ct.accent : ct.textSecondary} />
            <Text style={{ fontSize: 9, fontWeight: '600', color: match.mode === 'Tournoi' ? ct.accent : ct.textSecondary }}>{match.mode}</Text>
          </View>
          {match.tournamentName ? <View style={[s.metaChip, { backgroundColor: ct.accent + '15' }]}><Text style={{ fontSize: 9, fontWeight: '600', color: ct.accent }} numberOfLines={1}>{match.tournamentName}</Text></View> : null}
        </View>

        {/* Score */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <LinearGradient colors={isWinnerA ? winGrad : loseGrad} style={{ width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#FFF' }}>{match.teamA.score}</Text>
            </LinearGradient>
            <Text style={{ fontSize: 7, fontWeight: '700', color: ct.textSecondary, letterSpacing: 1 }}>{fr ? 'EQUIPE A' : 'TEAM A'}</Text>
            {match.teamA.playerNames.map((n, i) => (
              <TeamPlayerInfo key={i} name={n} info={pd[match.teamA.players?.[i]]} ct={ct} compact />
            ))}
          </View>
          <View style={{ width: 28, alignItems: 'center', gap: 3 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: ct.textSecondary }}>VS</Text>
            </View>
            <MaterialIcons name={isWinnerA ? 'arrow-back' : 'arrow-forward'} size={10} color="#22C55E" />
          </View>
          <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <LinearGradient colors={!isWinnerA ? winGrad : loseGrad} style={{ width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#FFF' }}>{match.teamB.score}</Text>
            </LinearGradient>
            <Text style={{ fontSize: 7, fontWeight: '700', color: ct.textSecondary, letterSpacing: 1 }}>{fr ? 'EQUIPE B' : 'TEAM B'}</Text>
            {match.teamB.playerNames.map((n, i) => (
              <TeamPlayerInfo key={i} name={n} info={pd[match.teamB.players?.[i]]} ct={ct} compact />
            ))}
          </View>
        </View>

        {/* Mene bar */}
        {hasMenes ? (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <MeneBar menes={match.menes} />
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
              {match.menes.slice(0, 8).map((m, i) => (
                <View key={i} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 6, color: ct.textSecondary }}>{i + 1}</Text>
                  <Text style={{ fontSize: 7, fontWeight: '700', color: (m.teamAPoints || 0) > (m.teamBPoints || 0) ? '#22C55E' : '#EF4444' }}>
                    {m.teamAPoints}-{m.teamBPoints}
                  </Text>
                </View>
              ))}
              {match.menes.length > 8 ? <Text style={{ fontSize: 7, color: ct.textSecondary, alignSelf: 'center' }}>+{match.menes.length - 8}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* Actions (compact) */}
        {hasActions ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 6, marginBottom: 8 }}>
            <Text style={{ fontSize: 7, fontWeight: '700', color: ct.textSecondary, letterSpacing: 0.8, marginBottom: 3 }}>ACTIONS</Text>
            {match.playerActions!.slice(0, 4).map((pa, i) => <PlayerActionRow key={i} pa={pa} ct={ct} compact />)}
          </View>
        ) : null}

        {/* Footer */}
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {playerName ? <Text style={{ fontSize: 10, fontWeight: '700', color: ct.textPrimary }}>{playerName}</Text> : null}
            {eloRating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: (eloColor || '#94A3B8') + '20', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}>
                <Text style={{ fontSize: 9, fontWeight: '700', color: eloColor || '#94A3B8' }}>ELO {eloRating}{eloRankLabel ? ` ${eloRankLabel}` : ''}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 2 }}>
              <GeoRankBadges geoRank={geoRank} compact />
              {clubName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <MaterialIcons name="home" size={8} color={ct.textSecondary} />
                  <Text style={{ fontSize: 8, color: ct.textSecondary }} numberOfLines={1}>{clubName}</Text>
                </View>
              ) : null}
            </View>
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

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
});
