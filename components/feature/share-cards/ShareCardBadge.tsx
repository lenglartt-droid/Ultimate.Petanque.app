/**
 * ShareCardBadge — Visual badge unlock card for social sharing.
 * Adapts layout to square / story / landscape formats.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import { CARD_COLOR_THEMES, type CardColorTheme, type ShareCardFormat } from '@/services/shareCardService';
import { BADGES, getBadgeName, getBadgeDescription } from '@/services/badgeService';

interface Props {
  badgeId: string;
  playerName?: string;
  unlockedAt?: string;
  xpReward?: number;
  language?: 'fr' | 'en';
  colorTheme?: CardColorTheme;
  format?: ShareCardFormat;
}

export default function ShareCardBadge({ badgeId, playerName, unlockedAt, xpReward, language = 'fr', colorTheme = 'dark', format = 'square' }: Props) {
  const fr = language === 'fr';
  const ct = CARD_COLOR_THEMES[colorTheme];
  const badge = BADGES.find(b => b.id === badgeId);
  if (!badge) return null;

  const dateStr = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const isStory = format === 'story';
  const isLandscape = format === 'landscape';

  // Landscape: horizontal two-column layout
  if (isLandscape) {
    return (
      <View style={s.card}>
        <LinearGradient colors={[badge.color + '25', ct.gradients[0], ct.gradients[1]]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[s.bg, { padding: 20, flex: 1 }]}>
          <View style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
            {/* Left: icon */}
            <View style={{ alignItems: 'center', marginRight: 20 }}>
              <View style={[s.iconOuter, { backgroundColor: badge.color + '20', width: 90, height: 90, borderRadius: 28 }]}>
                <View style={[s.iconInner, { backgroundColor: badge.color, width: 66, height: 66, borderRadius: 22 }]}>
                  <MaterialIcons name={badge.icon as any} size={38} color="#FFF" />
                </View>
              </View>
            </View>
            {/* Right: info */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={[s.celebrationRow, { marginBottom: 8, justifyContent: 'flex-start' }]}>
                <MaterialIcons name="celebration" size={12} color={ct.accent} />
                <Text style={[s.celebrationText, { color: ct.accent, fontSize: 10 }]}>{fr ? 'BADGE DEBLOQUE' : 'BADGE UNLOCKED'}</Text>
              </View>
              <Text style={[s.badgeName, { color: badge.color, fontSize: 20, textAlign: 'left', marginBottom: 4 }]}>{getBadgeName(badgeId, language)}</Text>
              <Text style={[s.badgeDesc, { color: ct.textSecondary, fontSize: 12, textAlign: 'left', paddingHorizontal: 0, marginBottom: 10, lineHeight: 17 }]}>{getBadgeDescription(badgeId, language)}</Text>
              {(xpReward || badge.xpReward) ? (
                <View style={[s.xpRow, { alignSelf: 'flex-start', marginBottom: 8, paddingHorizontal: 12, paddingVertical: 5 }]}>
                  <MaterialIcons name="bolt" size={14} color={ct.accent} />
                  <Text style={[s.xpText, { color: ct.accent, fontSize: 14 }]}>+{xpReward || badge.xpReward} XP</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {playerName ? <Text style={[s.playerName, { color: ct.textPrimary, fontSize: 12 }]}>{playerName}</Text> : null}
                {dateStr ? <Text style={[s.dateText, { color: ct.textSecondary, fontSize: 10 }]}>{dateStr}</Text> : null}
              </View>
            </View>
          </View>
          <ShareCardWatermark variant="light" size="sm" />
        </LinearGradient>
      </View>
    );
  }

  // Story/Square: vertical centered layout
  const iconOuterSize = isStory ? 150 : 120;
  const iconInnerSize = isStory ? 110 : 88;
  const nameSize = isStory ? 28 : 24;
  const descSize = isStory ? 16 : 14;
  const pad = isStory ? 36 : 28;

  return (
    <View style={s.card}>
      <LinearGradient colors={[badge.color + '25', ct.gradients[0], ct.gradients[1]]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[s.bg, { padding: pad, flex: 1, justifyContent: 'center' }]}>
        {/* Celebration label */}
        <View style={[s.celebrationRow, { marginBottom: isStory ? 28 : 20 }]}>
          <MaterialIcons name="celebration" size={isStory ? 18 : 14} color={ct.accent} />
          <Text style={[s.celebrationText, { color: ct.accent, fontSize: isStory ? 14 : 12 }]}>{fr ? 'BADGE DEBLOQUE' : 'BADGE UNLOCKED'}</Text>
          <MaterialIcons name="celebration" size={isStory ? 18 : 14} color={ct.accent} />
        </View>

        {/* Badge Icon */}
        <View style={[s.iconOuter, { backgroundColor: badge.color + '20', width: iconOuterSize, height: iconOuterSize, borderRadius: iconOuterSize * 0.3 }]}>
          <View style={[s.iconInner, { backgroundColor: badge.color, width: iconInnerSize, height: iconInnerSize, borderRadius: iconInnerSize * 0.32 }]}>
            <MaterialIcons name={badge.icon as any} size={isStory ? 64 : 52} color="#FFF" />
          </View>
        </View>

        {/* Badge Name */}
        <Text style={[s.badgeName, { color: badge.color, fontSize: nameSize, marginBottom: isStory ? 12 : 8 }]}>{getBadgeName(badgeId, language)}</Text>

        {/* Description */}
        <Text style={[s.badgeDesc, { color: ct.textSecondary, fontSize: descSize, marginBottom: isStory ? 24 : 16, lineHeight: descSize * 1.5 }]}>{getBadgeDescription(badgeId, language)}</Text>

        {/* XP Reward */}
        {(xpReward || badge.xpReward) ? (
          <View style={[s.xpRow, { marginBottom: isStory ? 28 : 20 }]}>
            <MaterialIcons name="bolt" size={isStory ? 22 : 18} color={ct.accent} />
            <Text style={[s.xpText, { color: ct.accent, fontSize: isStory ? 22 : 18 }]}>+{xpReward || badge.xpReward} XP</Text>
          </View>
        ) : null}

        {/* Player + Date */}
        <View style={s.footer}>
          {playerName ? <Text style={[s.playerName, { color: ct.textPrimary }]}>{playerName}</Text> : null}
          {dateStr ? <Text style={[s.dateText, { color: ct.textSecondary }]}>{dateStr}</Text> : null}
        </View>

        <ShareCardWatermark variant="light" size="sm" />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  bg: { padding: 28, alignItems: 'center' },
  celebrationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20, justifyContent: 'center' },
  celebrationText: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  iconOuter: { width: 120, height: 120, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconInner: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  badgeName: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  badgeDesc: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20, paddingHorizontal: 12, marginBottom: 16 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(252,211,77,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginBottom: 20 },
  xpText: { fontSize: 18, fontWeight: '800' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 4 },
  playerName: { fontSize: 14, fontWeight: '700' },
  dateText: { fontSize: 12, fontWeight: '500' },
});
