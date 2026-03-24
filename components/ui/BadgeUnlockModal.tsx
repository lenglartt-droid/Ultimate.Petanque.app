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
import * as Haptics from 'expo-haptics';
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 44,
    borderWidth: 3,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.textSecondary,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  badgeDesc: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  xpReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
    marginBottom: 24,
  },
  xpRewardText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D97706',
  },
  closeBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
  },
  closeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
