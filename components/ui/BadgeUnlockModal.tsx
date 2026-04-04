/**
 * BadgeUnlockModal — Fullscreen animated celebration when a new badge is unlocked.
 */
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Dimensions, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
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
import { LinearGradient } from 'expo-linear-gradient';
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
  const particleRotation = useSharedValue(0);

  useEffect(() => {
    if (visible && badge) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      glowOpacity.value = withDelay(
        200,
        withRepeat(
          withSequence(
            withTiming(0.7, { duration: 900 }),
            withTiming(0.2, { duration: 900 })
          ),
          -1,
          true
        )
      );
      particleRotation.value = withRepeat(
        withTiming(360, { duration: 8000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      pulseScale.value = 1;
      glowOpacity.value = 0;
      particleRotation.value = 0;
    }
  }, [visible, badge]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const particleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${particleRotation.value}deg` }],
  }));

  if (!badge || !badgeId) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.fullScreen}>
        <LinearGradient
          colors={['#0F172A', badge.color + '25', '#0F172A']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.fullScreen}
        >
          {/* Decorative particles */}
          <Animated.View style={[s.particleRing, particleStyle]}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
              <View
                key={i}
                style={[
                  s.particle,
                  {
                    transform: [{ rotate: `${deg}deg` }, { translateY: -140 }],
                    backgroundColor: i % 2 === 0 ? badge.color + '50' : '#F59E0B40',
                  },
                ]}
              />
            ))}
          </Animated.View>

          {/* Main content card */}
          <Animated.View entering={ZoomIn.duration(600).springify()} style={s.contentWrapper}>
            {/* Glow ring behind icon */}
            <Animated.View style={[s.glowRing, { borderColor: badge.color, shadowColor: badge.color }, glowStyle]} />

            {/* Badge icon */}
            <Animated.View style={[s.iconContainer, { backgroundColor: badge.color + '18' }, pulseStyle]}>
              <View style={[s.iconRing, { borderColor: badge.color + '40' }]}>
                <View style={[s.iconInner, { backgroundColor: badge.color }]}>
                  <MaterialIcons name={badge.icon as any} size={52} color="#FFF" />
                </View>
              </View>
            </Animated.View>

            {/* Label */}
            <Animated.View entering={SlideInUp.duration(500).delay(200)} style={s.textContainer}>
              <View style={s.unlockLabelWrap}>
                <Text style={s.unlockLabel}>
                  {language === 'fr' ? '🏆 BADGE DEBLOQUE !' : '🏆 BADGE UNLOCKED!'}
                </Text>
              </View>

              <Text style={[s.badgeName, { color: badge.color }]}>
                {getBadgeName(badgeId, language)}
              </Text>

              <Text style={s.badgeDesc}>
                {getBadgeDescription(badgeId, language)}
              </Text>
            </Animated.View>

            {/* XP reward */}
            <Animated.View entering={FadeIn.duration(400).delay(500)} style={[s.xpReward, { borderColor: badge.color + '30' }]}>
              <MaterialIcons name="bolt" size={22} color="#F59E0B" />
              <Text style={s.xpRewardText}>+{badge.xpReward} XP</Text>
            </Animated.View>

            {/* Close button */}
            <Animated.View entering={FadeIn.duration(400).delay(600)} style={s.closeBtnWrap}>
              <Pressable
                style={({ pressed }) => [
                  s.closeBtn,
                  { backgroundColor: badge.color },
                  pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                ]}
                onPress={onClose}
              >
                <Text style={s.closeBtnText}>{language === 'fr' ? 'Super !' : 'Awesome!'}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const { width: SCREEN_W } = Dimensions.get('window');

const s = StyleSheet.create({
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  contentWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 380,
  },
  glowRing: {
    position: 'absolute',
    top: -10,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    alignSelf: 'center',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 30 },
      android: { elevation: 8 },
    }),
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  iconRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20 },
      android: { elevation: 16 },
    }),
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  unlockLabelWrap: {
    marginBottom: 18,
  },
  unlockLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FCD34D',
    letterSpacing: 2.5,
    textAlign: 'center',
    backgroundColor: '#F59E0B18',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F59E0B30',
  },
  badgeName: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  badgeDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 8,
    maxWidth: 300,
  },
  xpReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F59E0B12',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 24,
    marginBottom: 32,
    borderWidth: 1,
  },
  xpRewardText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FCD34D',
  },
  closeBtnWrap: {
    width: '100%',
  },
  closeBtn: {
    paddingVertical: 18,
    borderRadius: 18,
    width: '100%',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
});
