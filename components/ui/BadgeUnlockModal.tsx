/**
 * BadgeUnlockModal — Animated modal shown when a new badge is unlocked.
 */
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  SlideInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import { BADGES, getBadgeName, getBadgeDescription } from '@/services/badgeService';
import theme from '@/constants/theme';

interface Props {
  visible: boolean;
  badgeId: string | null;
  language: 'fr' | 'en';
  onClose: () => void;
}

export default function BadgeUnlockModal({ visible, badgeId, language, onClose }: Props) {
  const badge = BADGES.find(b => b.id === badgeId);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible && badge) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glowOpacity.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 800 }),
            withTiming(0.2, { duration: 800 })
          ),
          -1,
          true
        )
      );
    }
  }, [visible, badge]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  if (!badge || !badgeId) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(300)} style={s.overlay}>
        <Animated.View entering={ZoomIn.duration(500).springify()} style={s.card}>
          {/* Glow ring */}
          <Animated.View style={[s.glowRing, { borderColor: badge.color }, glowStyle]} />

          {/* Badge icon */}
          <Animated.View style={[s.iconContainer, { backgroundColor: badge.color + '20' }, pulseStyle]}>
            <View style={[s.iconInner, { backgroundColor: badge.color }]}>
              <MaterialIcons name={badge.icon as any} size={40} color="#FFF" />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={SlideInUp.duration(400).delay(200)}>
            <Text style={s.unlockLabel}>
              {language === 'fr' ? '🏆 BADGE DEBLOQUE !' : '🏆 BADGE UNLOCKED!'}
            </Text>
            <Text style={[s.badgeName, { color: badge.color }]}>
              {getBadgeName(badgeId, language)}
            </Text>
            <Text style={s.badgeDesc}>
              {getBadgeDescription(badgeId, language)}
            </Text>
          </Animated.View>

          {/* XP reward */}
          <Animated.View entering={FadeIn.duration(300).delay(400)} style={s.xpReward}>
            <MaterialIcons name="bolt" size={18} color="#F59E0B" />
            <Text style={s.xpRewardText}>+{badge.xpReward} XP</Text>
          </Animated.View>

          {/* Close */}
          <Pressable
            style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
            onPress={onClose}
          >
            <Text style={s.closeBtnText}>{language === 'fr' ? 'Super !' : 'Awesome!'}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 48,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    position: 'relative',
    alignSelf: 'center',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
  },
  glowRing: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 38,
    borderWidth: 3,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  unlockLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#78350F',
    letterSpacing: 2.5,
    textAlign: 'center',
    marginBottom: 14,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
    overflow: 'hidden',
  },
  badgeName: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 30,
    paddingHorizontal: 4,
  },
  badgeDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 4,
    maxWidth: 280,
  },
  xpReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 22,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  xpRewardText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#D97706',
  },
  closeBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 52,
    borderRadius: 18,
    width: '100%',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
