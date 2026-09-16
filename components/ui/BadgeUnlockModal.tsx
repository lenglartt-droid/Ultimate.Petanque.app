/**
 * BadgeUnlockModal — Fullscreen badge unlock celebration.
 *
 * Keep the CTA outside the scrolling body. Nested ScrollView + centered content
 * was overlapping the description with Super ! and swallowing taps on iOS.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '@/services/haptics';
import {
  BADGES,
  getBadgeCategoryLabel,
  getBadgeDescription,
  getBadgeName,
} from '@/services/badgeService';

interface Props {
  visible: boolean;
  badgeId: string | null;
  language: 'fr' | 'en';
  onClose: () => void;
}

export default function BadgeUnlockModal({ visible, badgeId, language, onClose }: Props) {
  const badge = BADGES.find(b => b.id === badgeId);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const hapticBadgeRef = useRef<string | null>(null);
  const compact = windowHeight < 720;

  useEffect(() => {
    if (!visible || !badgeId || hapticBadgeRef.current === badgeId) return;
    hapticBadgeRef.current = badgeId;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [visible, badgeId]);

  const handleClose = useCallback(() => {
    hapticBadgeRef.current = null;
    onClose();
  }, [onClose]);

  if (!visible) return null;

  const isFr = language === 'fr';
  const accent = badge?.color || '#14B8A6';
  const badgeName = badgeId ? getBadgeName(badgeId, language) : '';
  const badgeDescription = badgeId ? getBadgeDescription(badgeId, language) : '';
  const categoryLabel = badge ? getBadgeCategoryLabel(badge.category, language) : '';
  const iconSize = compact ? 32 : 40;
  const ring = compact ? 96 : 118;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(15,23,42,0.97)', accent + '28', 'rgba(15,23,42,0.98)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradient}
        >
          <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                compact ? styles.scrollContentCompact : null,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces
            >
              <View style={styles.content}>
                <View style={styles.unlockPill}>
                  <Text style={styles.unlockText}>{isFr ? 'BADGE DEBLOQUE !' : 'BADGE UNLOCKED!'}</Text>
                </View>

                <View style={[styles.iconArea, { width: ring + 8, height: ring + 8, marginBottom: compact ? 16 : 22 }]}>
                  <View style={[styles.outerRing, { width: ring + 6, height: ring + 6, borderRadius: (ring + 6) / 2, borderColor: accent + '75' }]} />
                  <View style={[styles.middleRing, { width: ring - 16, height: ring - 16, borderRadius: (ring - 16) / 2, borderColor: accent + '45', backgroundColor: accent + '18' }]}>
                    <View style={[styles.iconCircle, { backgroundColor: accent, width: ring - 44, height: ring - 44, borderRadius: (ring - 44) / 2 }]}>
                      <MaterialIcons name={(badge?.icon || 'military-tech') as any} size={iconSize} color="#FFF" />
                    </View>
                  </View>
                </View>

                <Text
                  style={[styles.badgeName, { color: accent, fontSize: compact ? 22 : 25, lineHeight: compact ? 28 : 32 }]}
                >
                  {badgeName}
                </Text>

                {categoryLabel ? (
                  <View style={[styles.categoryChip, { backgroundColor: accent + '18', borderColor: accent + '38' }]}>
                    <Text style={[styles.categoryText, { color: accent }]}>
                      {categoryLabel}
                    </Text>
                  </View>
                ) : null}

                {badgeDescription ? (
                  <Text style={styles.description}>{badgeDescription}</Text>
                ) : null}

                {badge ? (
                  <View style={[styles.xpChip, { borderColor: accent + '30' }]}>
                    <MaterialIcons name="bolt" size={20} color="#FCD34D" />
                    <Text style={styles.xpText}>+{badge.xpReward} XP</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isFr ? 'Super' : 'Awesome'}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: accent },
                  pressed && styles.closeButtonPressed,
                ]}
                onPress={handleClose}
                hitSlop={8}
              >
                <MaterialIcons name="celebration" size={20} color="#FFF" />
                <Text style={styles.closeText}>{isFr ? 'Super !' : 'Awesome!'}</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.96)',
  },
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  scrollContentCompact: {
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  unlockPill: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.30)',
    marginBottom: 20,
  },
  unlockText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textAlign: 'center',
  },
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.82,
  },
  middleRing: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 14 },
      android: { elevation: 0 },
      default: {},
    }),
  },
  badgeName: {
    width: '100%',
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  categoryChip: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    width: '100%',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(245,158,11,0.14)',
  },
  xpText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FCD34D',
  },
  footer: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  closeButton: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 18,
  },
  closeButtonPressed: {
    opacity: 0.86,
  },
  closeText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
});
