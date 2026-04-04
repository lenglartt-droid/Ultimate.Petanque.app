/**
 * ShareCardBadge — Visual badge unlock card for social sharing.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ShareCardWatermark from './ShareCardWatermark';
import theme from '@/constants/theme';
import { BADGES, getBadgeName, getBadgeDescription, type BadgeDefinition } from '@/services/badgeService';

interface Props {
  badgeId: string;
  playerName?: string;
  unlockedAt?: string;
  xpReward?: number;
  language?: 'fr' | 'en';
}

export default function ShareCardBadge({ badgeId, playerName, unlockedAt, xpReward, language = 'fr' }: Props) {
  const fr = language === 'fr';
  const badge = BADGES.find(b => b.id === badgeId);
  if (!badge) return null;

  const dateStr = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <View style={s.card}>
      <LinearGradient colors={[badge.color + '25', '#0F172A', '#1E293B']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={s.bg}>
        {/* Celebration label */}
        <View style={s.celebrationRow}>
          <MaterialIcons name="celebration" size={14} color="#FCD34D" />
          <Text style={s.celebrationText}>{fr ? 'BADGE DEBLOQUE' : 'BADGE UNLOCKED'}</Text>
          <MaterialIcons name="celebration" size={14} color="#FCD34D" />
        </View>

        {/* Badge Icon */}
        <View style={[s.iconOuter, { backgroundColor: badge.color + '20' }]}>
          <View style={[s.iconInner, { backgroundColor: badge.color }]}>
            <MaterialIcons name={badge.icon as any} size={52} color="#FFF" />
          </View>
        </View>

        {/* Badge Name */}
        <Text style={[s.badgeName, { color: badge.color }]}>{getBadgeName(badgeId, language)}</Text>

        {/* Description */}
        <Text style={s.badgeDesc}>{getBadgeDescription(badgeId, language)}</Text>

        {/* XP Reward */}
        {xpReward || badge.xpReward ? (
          <View style={s.xpRow}>
            <MaterialIcons name="bolt" size={18} color="#FCD34D" />
            <Text style={s.xpText}>+{xpReward || badge.xpReward} XP</Text>
          </View>
        ) : null}

        {/* Player + Date */}
        <View style={s.footer}>
          {playerName ? <Text style={s.playerName}>{playerName}</Text> : null}
          {dateStr ? <Text style={s.dateText}>{dateStr}</Text> : null}
        </View>

        <ShareCardWatermark variant="light" size="sm" />
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden' },
  bg: { padding: 28, alignItems: 'center' },
  celebrationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  celebrationText: { fontSize: 12, fontWeight: '800', color: '#FCD34D', letterSpacing: 2 },
  iconOuter: { width: 120, height: 120, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconInner: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  badgeName: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  badgeDesc: { fontSize: 14, fontWeight: '500', color: '#94A3B8', textAlign: 'center', lineHeight: 20, paddingHorizontal: 12, marginBottom: 16 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(252,211,77,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginBottom: 20 },
  xpText: { fontSize: 18, fontWeight: '800', color: '#FCD34D' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 4 },
  playerName: { fontSize: 14, fontWeight: '700', color: '#F8FAFC' },
  dateText: { fontSize: 12, fontWeight: '500', color: '#64748B' },
});
