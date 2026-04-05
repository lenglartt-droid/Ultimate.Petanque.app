/**
 * LeaguePromotionModal — Celebration modal when a player is promoted or relegated in league tier.
 */
import React, { useEffect, useRef, memo } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { LeagueTier } from '@/services/globalRankingService';

interface Props {
  visible: boolean;
  onClose: () => void;
  type: 'promotion' | 'relegation';
  newTier: LeagueTier;
  previousTier: LeagueTier;
  elo: number;
  language: string;
}

function LeaguePromotionModal({ visible, onClose, type, newTier, previousTier, elo, language }: Props) {
  const fr = language === 'fr';
  const isPromotion = type === 'promotion';

  useEffect(() => {
    if (visible && isPromotion) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [visible, isPromotion]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View entering={ZoomIn.duration(400).springify()} style={s.card}>
          {/* Gradient header */}
          <LinearGradient
            colors={isPromotion ? newTier.gradient : ['#374151', '#4B5563']}
            style={s.header}
          >
            {/* Confetti dots for promotion */}
            {isPromotion ? (
              <>
                {[...Array(8)].map((_, i) => (
                  <Animated.View
                    key={i}
                    entering={FadeIn.duration(300).delay(200 + i * 80)}
                    style={[s.confettiDot, {
                      top: 10 + (i % 3) * 20,
                      left: 15 + (i * 40) % 280,
                      backgroundColor: ['#FCD34D', '#FFF', '#A78BFA', '#34D399', '#F87171', '#60A5FA', '#FBBF24', '#FFF'][i],
                      width: 4 + (i % 3) * 2,
                      height: 4 + (i % 3) * 2,
                    }]}
                  />
                ))}
              </>
            ) : null}

            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={s.emblemContainer}>
              <Text style={s.emblem}>{newTier.emblem}</Text>
            </Animated.View>

            <Animated.Text entering={FadeInDown.duration(400).delay(200)} style={s.typeLabel}>
              {isPromotion
                ? (fr ? 'PROMOTION !' : 'PROMOTION!')
                : (fr ? 'RELEGATION' : 'RELEGATION')}
            </Animated.Text>

            <Animated.Text entering={FadeInDown.duration(400).delay(300)} style={s.tierName}>
              {fr ? newTier.name.fr : newTier.name.en}
            </Animated.Text>
          </LinearGradient>

          {/* Body */}
          <View style={s.body}>
            {/* Transition arrow */}
            <Animated.View entering={FadeInUp.duration(300).delay(400)} style={s.transitionRow}>
              <View style={[s.tierPill, { backgroundColor: previousTier.color + '15', borderColor: previousTier.color + '30' }]}>
                <Text style={{ fontSize: 14 }}>{previousTier.emblem}</Text>
                <Text style={[s.tierPillText, { color: previousTier.color }]}>
                  {fr ? previousTier.name.fr : previousTier.name.en}
                </Text>
              </View>
              <MaterialIcons
                name={isPromotion ? 'arrow-forward' : 'arrow-forward'}
                size={20}
                color={isPromotion ? '#10B981' : '#EF4444'}
              />
              <View style={[s.tierPill, { backgroundColor: newTier.color + '15', borderColor: newTier.color + '30' }]}>
                <Text style={{ fontSize: 14 }}>{newTier.emblem}</Text>
                <Text style={[s.tierPillText, { color: newTier.color }]}>
                  {fr ? newTier.name.fr : newTier.name.en}
                </Text>
              </View>
            </Animated.View>

            {/* ELO */}
            <Animated.View entering={FadeIn.duration(300).delay(500)} style={s.eloRow}>
              <MaterialIcons name={newTier.icon as any} size={16} color={newTier.color} />
              <Text style={[s.eloText, { color: newTier.color }]}>{elo} ELO</Text>
            </Animated.View>

            {/* Message */}
            <Animated.Text entering={FadeIn.duration(300).delay(600)} style={s.message}>
              {isPromotion
                ? (fr
                  ? `Felicitations ! Vous avez atteint la ligue ${newTier.name.fr}. Continuez a jouer pour monter encore plus haut !`
                  : `Congratulations! You have reached the ${newTier.name.en} league. Keep playing to climb even higher!`)
                : (fr
                  ? `Vous etes descendu en ligue ${newTier.name.fr}. Jouez des matchs pour remonter !`
                  : `You have been relegated to the ${newTier.name.en} league. Play matches to climb back up!`)}
            </Animated.Text>

            {/* CTA */}
            <Pressable style={[s.cta, { backgroundColor: isPromotion ? newTier.color : theme.primary }]} onPress={onClose}>
              <MaterialIcons name={isPromotion ? 'celebration' : 'sports'} size={18} color="#FFF" />
              <Text style={s.ctaText}>
                {isPromotion
                  ? (fr ? 'Continuer' : 'Continue')
                  : (fr ? 'Jouer un match' : 'Play a match')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default memo(LeaguePromotionModal);

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24 },
      android: { elevation: 12 },
      default: {},
    }),
  },
  header: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  confettiDot: {
    position: 'absolute',
    borderRadius: 10,
  },
  emblemContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  emblem: { fontSize: 36 },
  typeLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 3,
    marginBottom: 4,
  },
  tierName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  body: {
    padding: 24,
    alignItems: 'center',
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  tierPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  eloRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  eloText: {
    fontSize: 18,
    fontWeight: '900',
  },
  message: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
