import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeOut,
  ZoomIn,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';

const { width: screenWidth } = Dimensions.get('window');

// ============================================
// TYPES & DEFINITIONS
// ============================================

// Shot Type - Simplified to most common
export type SimpleShotType = 
  | 'au_fer'          // Direct hit
  | 'au_plomb'        // High arc
  | 'en_rafle'        // Rolling shot
  | 'autre';          // Other

// Shot Quality - Contextual
export type SimpleShotQuality = 
  | 'gain_point'      // Gained point(s)
  | 'sans_effet'      // No change
  | 'negatif'         // Lost position
  | 'decisif';        // End of mène

// Point Type - Simplified
export type SimplePointType = 
  | 'roule'           // Rolled
  | 'plombe'          // Lobbed
  | 'demi_portee'     // Half lob
  | 'autre';          // Other

// Point Quality - Distance based
export type SimplePointQuality = 
  | 'excellent'       // < 10cm
  | 'bon'             // < 30cm
  | 'moyen'           // < 50cm
  | 'rate';           // Missed target zone

// Complete Shot Record
export interface SimpleShotRecord {
  id: string;
  timestamp: string;
  playerId: string;
  playerName?: string;
  team: 'A' | 'B';
  
  // Basic result
  actionType: 'tir' | 'point';
  success: boolean;
  carreau?: boolean;
  
  // Advanced - Tir
  shotType?: SimpleShotType;
  shotQuality?: SimpleShotQuality;
  
  // Advanced - Point
  pointType?: SimplePointType;
  pointQuality?: SimplePointQuality;
}

// ============================================
// SHOT TYPE CONFIGS
// ============================================

const SHOT_TYPES = [
  { id: 'au_fer' as SimpleShotType, label: 'Au fer', icon: 'gps-fixed', desc: 'Direct, sans rebond' },
  { id: 'au_plomb' as SimpleShotType, label: 'Au plomb', icon: 'flight-takeoff', desc: 'Tir en cloche' },
  { id: 'en_rafle' as SimpleShotType, label: 'En rafle', icon: 'swap-horiz', desc: 'Tir rasant' },
  { id: 'autre' as SimpleShotType, label: 'Autre', icon: 'more-horiz', desc: 'Autre type' },
];

const SHOT_QUALITIES = [
  { id: 'gain_point' as SimpleShotQuality, label: 'Gain de point', icon: 'trending-up', color: theme.success },
  { id: 'sans_effet' as SimpleShotQuality, label: 'Sans effet', icon: 'remove', color: theme.warning },
  { id: 'negatif' as SimpleShotQuality, label: 'Négatif', icon: 'trending-down', color: theme.error },
  { id: 'decisif' as SimpleShotQuality, label: 'Décisif', icon: 'flag', color: theme.carreauColor },
];

const POINT_TYPES = [
  { id: 'roule' as SimplePointType, label: 'Roulé', icon: 'sports-baseball', desc: 'Boule roulée' },
  { id: 'plombe' as SimplePointType, label: 'Plombé', icon: 'flight-land', desc: 'Lancée en hauteur' },
  { id: 'demi_portee' as SimplePointType, label: 'Demi-portée', icon: 'height', desc: 'Entre les deux' },
  { id: 'autre' as SimplePointType, label: 'Autre', icon: 'more-horiz', desc: 'Autre type' },
];

const POINT_QUALITIES = [
  { id: 'excellent' as SimplePointQuality, label: 'Excellent', icon: 'stars', color: theme.carreauColor, desc: '< 10 cm' },
  { id: 'bon' as SimplePointQuality, label: 'Bon', icon: 'check-circle', color: theme.success, desc: '< 30 cm' },
  { id: 'moyen' as SimplePointQuality, label: 'Moyen', icon: 'radio-button-checked', color: theme.warning, desc: '< 50 cm' },
  { id: 'rate' as SimplePointQuality, label: 'Raté', icon: 'cancel', color: theme.error, desc: 'Loin du but' },
];

// ============================================
// QUICK OPTION BUTTON
// ============================================

interface QuickOptionProps {
  icon: string;
  label: string;
  sublabel?: string;
  color?: string;
  selected?: boolean;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
}

function QuickOption({ icon, label, sublabel, color, selected, onPress, size = 'medium' }: QuickOptionProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const buttonColor = color || theme.primary;
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          styles.quickOption,
          isSmall && styles.quickOptionSmall,
          isLarge && styles.quickOptionLarge,
          selected && { backgroundColor: buttonColor, borderColor: buttonColor },
          animatedStyle,
        ]}
      >
        <View style={[
          styles.quickOptionIcon,
          isSmall && styles.quickOptionIconSmall,
          isLarge && styles.quickOptionIconLarge,
          { backgroundColor: selected ? 'rgba(255,255,255,0.25)' : buttonColor + '15' },
        ]}>
          <MaterialIcons 
            name={icon as any} 
            size={isSmall ? 18 : isLarge ? 28 : 22} 
            color={selected ? '#FFF' : buttonColor} 
          />
        </View>
        <Text style={[
          styles.quickOptionLabel, 
          isSmall && styles.quickOptionLabelSmall,
          selected && styles.quickOptionLabelSelected
        ]}>
          {label}
        </Text>
        {sublabel && (
          <Text style={[styles.quickOptionSublabel, selected && styles.quickOptionSublabelSelected]}>
            {sublabel}
          </Text>
        )}
        {selected && (
          <View style={styles.quickOptionCheck}>
            <MaterialIcons name="check" size={14} color="#FFF" />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ============================================
// SIMPLIFIED SHOT NOTATION COMPONENT
// ============================================

interface SimplifiedShotNotationProps {
  visible: boolean;
  onClose: () => void;
  actionType: 'tir' | 'point';
  playerId: string;
  playerName: string;
  team: 'A' | 'B';
  onSubmit: (record: SimpleShotRecord) => void;
  quickMode?: boolean;
}

export function SimplifiedShotNotation({
  visible,
  onClose,
  actionType,
  playerId,
  playerName,
  team,
  onSubmit,
  quickMode = false,
}: SimplifiedShotNotationProps) {
  // State
  const [success, setSuccess] = useState<boolean | null>(null);
  const [carreau, setCarreau] = useState(false);
  const [shotType, setShotType] = useState<SimpleShotType | null>(null);
  const [shotQuality, setShotQuality] = useState<SimpleShotQuality | null>(null);
  const [pointType, setPointType] = useState<SimplePointType | null>(null);
  const [pointQuality, setPointQuality] = useState<SimplePointQuality | null>(null);

  // Animation
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progressWidth.value = withTiming(0, { duration: 0 });
    }
  }, [visible, progressWidth]);

  useEffect(() => {
    let progress = 0;
    if (success !== null) progress = 33;
    if (shotType || pointType) progress = 66;
    if (shotQuality || pointQuality) progress = 100;
    progressWidth.value = withTiming(progress, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [success, shotType, pointType, shotQuality, pointQuality, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // Reset on close
  const resetState = useCallback(() => {
    setSuccess(null);
    setCarreau(false);
    setShotType(null);
    setShotQuality(null);
    setPointType(null);
    setPointQuality(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // Quick result (Réussi / Raté)
  const handleQuickResult = useCallback((isSuccess: boolean, isCarreau: boolean = false) => {
    Haptics.impactAsync(isSuccess ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    
    if (quickMode) {
      // Immediately submit in quick mode
      const record: SimpleShotRecord = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        playerId,
        playerName,
        team,
        actionType,
        success: isSuccess,
        carreau: isCarreau,
      };
      onSubmit(record);
      handleClose();
    } else {
      setSuccess(isSuccess);
      setCarreau(isCarreau);
    }
  }, [quickMode, playerId, playerName, team, actionType, onSubmit, handleClose]);

  // Select type
  const handleTypeSelect = useCallback((type: SimpleShotType | SimplePointType) => {
    Haptics.selectionAsync();
    if (actionType === 'tir') {
      setShotType(type as SimpleShotType);
    } else {
      setPointType(type as SimplePointType);
    }
  }, [actionType]);

  // Select quality and submit
  const handleQualitySelect = useCallback((quality: SimpleShotQuality | SimplePointQuality | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const record: SimpleShotRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      playerId,
      playerName,
      team,
      actionType,
      success: success!,
      carreau: actionType === 'tir' ? carreau : undefined,
      shotType: actionType === 'tir' ? shotType || undefined : undefined,
      shotQuality: actionType === 'tir' ? (quality as SimpleShotQuality) || undefined : undefined,
      pointType: actionType === 'point' ? pointType || undefined : undefined,
      pointQuality: actionType === 'point' ? (quality as SimplePointQuality) || undefined : undefined,
    };
    
    onSubmit(record);
    handleClose();
  }, [playerId, playerName, team, actionType, success, carreau, shotType, pointType, onSubmit, handleClose]);

  // Skip detailed selection
  const handleSkip = useCallback(() => {
    if (success !== null) {
      handleQualitySelect(null);
    }
  }, [success, handleQualitySelect]);

  // Go back
  const handleBack = useCallback(() => {
    Haptics.selectionAsync();
    if (shotQuality || pointQuality) {
      setShotQuality(null);
      setPointQuality(null);
    } else if (shotType || pointType) {
      setShotType(null);
      setPointType(null);
    } else if (success !== null) {
      setSuccess(null);
      setCarreau(false);
    }
  }, [shotQuality, pointQuality, shotType, pointType, success]);

  const isTir = actionType === 'tir';
  const teamColor = team === 'A' ? theme.primary : theme.accent;
  const currentStep = success === null ? 1 : (shotType || pointType) ? 3 : 2;
  const canGoBack = success !== null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={canGoBack ? handleBack : handleClose}>
            <MaterialIcons 
              name={canGoBack ? 'arrow-back' : 'close'} 
              size={24} 
              color={theme.textPrimary} 
            />
          </Pressable>
          
          <View style={styles.headerCenter}>
            <View style={[styles.headerBadge, { backgroundColor: teamColor + '20' }]}>
              <MaterialIcons 
                name={isTir ? 'gps-fixed' : 'adjust'} 
                size={16} 
                color={teamColor} 
              />
              <Text style={[styles.headerBadgeText, { color: teamColor }]}>
                {isTir ? 'TIR' : 'POINT'}
              </Text>
            </View>
            <Text style={styles.headerPlayer}>{playerName}</Text>
          </View>
          
          {success !== null ? (
            <Pressable style={styles.headerBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>Terminer</Text>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { backgroundColor: teamColor }, progressStyle]} />
          </View>
          <View style={styles.progressSteps}>
            {['Résultat', 'Type', 'Qualité'].map((label, i) => (
              <View key={label} style={styles.progressStep}>
                <View style={[
                  styles.progressDot,
                  currentStep > i + 1 && styles.progressDotDone,
                  currentStep === i + 1 && [styles.progressDotActive, { borderColor: teamColor }],
                ]}>
                  {currentStep > i + 1 ? (
                    <MaterialIcons name="check" size={10} color="#FFF" />
                  ) : (
                    <Text style={[
                      styles.progressDotText,
                      currentStep === i + 1 && { color: teamColor }
                    ]}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.progressLabel,
                  currentStep === i + 1 && { color: teamColor, fontWeight: '600' }
                ]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          showsVerticalScrollIndicator={false}
        >
          {/* STEP 1: Result */}
          {success === null && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text style={styles.stepTitle}>
                {isTir ? 'Résultat du tir' : 'Résultat du point'}
              </Text>
              <Text style={styles.stepSubtitle}>
                {isTir ? 'La boule adverse a-t-elle été touchée ?' : 'Le point est-il réussi ?'}
              </Text>

              <View style={styles.resultGrid}>
                <Pressable
                  style={[styles.resultCard, styles.resultCardSuccess]}
                  onPress={() => handleQuickResult(true, false)}
                >
                  <Animated.View entering={ZoomIn.duration(200).delay(100)}>
                    <MaterialIcons name="check" size={48} color="#FFF" />
                  </Animated.View>
                  <Text style={styles.resultCardLabel}>Réussi</Text>
                </Pressable>

                <Pressable
                  style={[styles.resultCard, styles.resultCardFail]}
                  onPress={() => handleQuickResult(false, false)}
                >
                  <Animated.View entering={ZoomIn.duration(200).delay(150)}>
                    <MaterialIcons name="close" size={48} color="#FFF" />
                  </Animated.View>
                  <Text style={styles.resultCardLabel}>Raté</Text>
                </Pressable>
              </View>

              {isTir && (
                <Animated.View entering={FadeInDown.duration(200).delay(200)}>
                  <Pressable
                    style={styles.carreauBtn}
                    onPress={() => handleQuickResult(true, true)}
                  >
                    <View style={styles.carreauBtnIcon}>
                      <MaterialIcons name="stars" size={28} color={theme.carreauColor} />
                    </View>
                    <View style={styles.carreauBtnContent}>
                      <Text style={styles.carreauBtnTitle}>CARREAU</Text>
                      <Text style={styles.carreauBtnDesc}>La boule tirée prend la place</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={theme.carreauColor} />
                  </Pressable>
                </Animated.View>
              )}

              <View style={styles.quickModeHint}>
                <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
                <Text style={styles.quickModeHintText}>
                  Optionnel : continuez pour préciser le type et la qualité
                </Text>
              </View>
            </Animated.View>
          )}

          {/* STEP 2: Type */}
          {success !== null && !shotType && !pointType && (
            <Animated.View entering={FadeIn.duration(200)}>
              <View style={styles.resultSummary}>
                <MaterialIcons 
                  name={success ? (carreau ? 'stars' : 'check-circle') : 'cancel'} 
                  size={20} 
                  color={success ? (carreau ? theme.carreauColor : theme.success) : theme.error} 
                />
                <Text style={styles.resultSummaryText}>
                  {success ? (carreau ? 'Carreau' : 'Réussi') : 'Raté'}
                </Text>
              </View>

              <Text style={styles.stepTitle}>
                Type de {isTir ? 'tir' : 'point'}
              </Text>
              <Text style={styles.stepSubtitle}>
                {isTir ? 'Comment avez-vous tiré ?' : 'Comment avez-vous pointé ?'}
              </Text>

              <View style={styles.typeGrid}>
                {(isTir ? SHOT_TYPES : POINT_TYPES).map((type, index) => (
                  <Animated.View key={type.id} entering={FadeInDown.duration(200).delay(index * 50)}>
                    <QuickOption
                      icon={type.icon}
                      label={type.label}
                      sublabel={type.desc}
                      color={isTir ? theme.tirColor : theme.pointColor}
                      onPress={() => handleTypeSelect(type.id)}
                      size="medium"
                    />
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* STEP 3: Quality */}
          {(shotType || pointType) && (
            <Animated.View entering={FadeIn.duration(200)}>
              <View style={styles.resultSummary}>
                <MaterialIcons 
                  name={success ? (carreau ? 'stars' : 'check-circle') : 'cancel'} 
                  size={18} 
                  color={success ? (carreau ? theme.carreauColor : theme.success) : theme.error} 
                />
                <Text style={styles.resultSummaryText}>
                  {success ? (carreau ? 'Carreau' : 'Réussi') : 'Raté'}
                </Text>
                <View style={styles.resultSummaryDivider} />
                <MaterialIcons 
                  name={(isTir ? SHOT_TYPES : POINT_TYPES).find(t => t.id === (shotType || pointType))?.icon as any} 
                  size={18} 
                  color={theme.textSecondary} 
                />
                <Text style={styles.resultSummaryText}>
                  {(isTir ? SHOT_TYPES : POINT_TYPES).find(t => t.id === (shotType || pointType))?.label}
                </Text>
              </View>

              <Text style={styles.stepTitle}>
                {isTir ? 'Impact du tir' : 'Qualité du point'}
              </Text>
              <Text style={styles.stepSubtitle}>
                {isTir ? 'Effet sur la mène' : 'Précision par rapport au but'}
              </Text>

              <View style={styles.qualityList}>
                {(isTir ? SHOT_QUALITIES : POINT_QUALITIES).map((quality, index) => (
                  <Animated.View key={quality.id} entering={FadeInDown.duration(200).delay(index * 40)}>
                    <Pressable
                      style={[styles.qualityItem, { borderLeftColor: quality.color }]}
                      onPress={() => handleQualitySelect(quality.id)}
                    >
                      <View style={[styles.qualityItemIcon, { backgroundColor: quality.color + '15' }]}>
                        <MaterialIcons name={quality.icon as any} size={22} color={quality.color} />
                      </View>
                      <View style={styles.qualityItemContent}>
                        <Text style={styles.qualityItemLabel}>{quality.label}</Text>
                        {'desc' in quality && (
                          <Text style={styles.qualityItemDesc}>{quality.desc}</Text>
                        )}
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================
// QUICK SHOT BAR (Inline component for match)
// ============================================

interface QuickShotBarProps {
  playerId: string;
  playerName: string;
  team: 'A' | 'B';
  onQuickShot: (actionType: 'tir' | 'point' | 'carreau', success: boolean) => void;
  onDetailedShot: (actionType: 'tir' | 'point') => void;
  stats?: { tirs: number; tirsSuccess: number; points: number; pointsSuccess: number; carreaux: number };
  compact?: boolean;
}

export function QuickShotBar({
  playerId,
  playerName,
  team,
  onQuickShot,
  onDetailedShot,
  stats,
  compact = false,
}: QuickShotBarProps) {
  const teamColor = team === 'A' ? theme.primary : theme.accent;

  if (compact) {
    return (
      <View style={[styles.quickBarCompact, { borderLeftColor: teamColor }]}>
        <Text style={styles.quickBarName} numberOfLines={1}>{playerName.split(' ')[0]}</Text>
        <View style={styles.quickBarActions}>
          <Pressable
            style={[styles.quickBarBtn, { backgroundColor: theme.tirColor }]}
            onPress={() => onQuickShot('tir', true)}
            onLongPress={() => onDetailedShot('tir')}
          >
            <MaterialIcons name="gps-fixed" size={16} color="#FFF" />
          </Pressable>
          <Pressable
            style={[styles.quickBarBtn, { backgroundColor: theme.pointColor }]}
            onPress={() => onQuickShot('point', true)}
            onLongPress={() => onDetailedShot('point')}
          >
            <MaterialIcons name="adjust" size={16} color="#FFF" />
          </Pressable>
          <Pressable
            style={[styles.quickBarBtn, { backgroundColor: theme.carreauColor }]}
            onPress={() => onQuickShot('carreau', true)}
          >
            <MaterialIcons name="stars" size={16} color="#FFF" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.quickBar, { borderColor: teamColor + '30' }]}>
      <View style={styles.quickBarHeader}>
        <View style={[styles.quickBarDot, { backgroundColor: teamColor }]} />
        <Text style={styles.quickBarNameFull}>{playerName}</Text>
        {stats && (
          <Text style={styles.quickBarStats}>
            T:{stats.tirsSuccess}/{stats.tirs} P:{stats.pointsSuccess}/{stats.points} C:{stats.carreaux}
          </Text>
        )}
      </View>
      
      <View style={styles.quickBarRow}>
        {/* TIR Section */}
        <View style={styles.quickBarSection}>
          <Text style={styles.quickBarSectionLabel}>TIR</Text>
          <View style={styles.quickBarSectionBtns}>
            <Pressable
              style={[styles.quickBarActionBtn, { backgroundColor: theme.success }]}
              onPress={() => onQuickShot('tir', true)}
              onLongPress={() => onDetailedShot('tir')}
            >
              <MaterialIcons name="check" size={18} color="#FFF" />
            </Pressable>
            <Pressable
              style={[styles.quickBarActionBtn, { backgroundColor: theme.error }]}
              onPress={() => onQuickShot('tir', false)}
            >
              <MaterialIcons name="close" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* POINT Section */}
        <View style={styles.quickBarSection}>
          <Text style={styles.quickBarSectionLabel}>POINT</Text>
          <View style={styles.quickBarSectionBtns}>
            <Pressable
              style={[styles.quickBarActionBtn, { backgroundColor: theme.success }]}
              onPress={() => onQuickShot('point', true)}
              onLongPress={() => onDetailedShot('point')}
            >
              <MaterialIcons name="check" size={18} color="#FFF" />
            </Pressable>
            <Pressable
              style={[styles.quickBarActionBtn, { backgroundColor: theme.error }]}
              onPress={() => onQuickShot('point', false)}
            >
              <MaterialIcons name="close" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* CARREAU Button */}
        <Pressable
          style={styles.quickBarCarreauBtn}
          onPress={() => onQuickShot('carreau', true)}
        >
          <MaterialIcons name="stars" size={22} color={theme.carreauColor} />
          <Text style={styles.quickBarCarreauText}>CARREAU</Text>
        </Pressable>
      </View>

      <Text style={styles.quickBarHint}>
        Appui long = notation détaillée
      </Text>
    </View>
  );
}

// ============================================
// EXPORTS
// ============================================

export { SHOT_TYPES, SHOT_QUALITIES, POINT_TYPES, POINT_QUALITIES };

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerBtn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 4,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerPlayer: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  // Progress
  progressContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  progressTrack: {
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  progressDotActive: {
    backgroundColor: 'transparent',
  },
  progressDotDone: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  progressDotText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textMuted,
  },
  progressLabel: {
    fontSize: 11,
    color: theme.textMuted,
  },
  // Content
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  // Result Summary
  resultSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    marginBottom: 20,
    gap: 8,
  },
  resultSummaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  resultSummaryDivider: {
    width: 1,
    height: 16,
    backgroundColor: theme.border,
    marginHorizontal: 6,
  },
  // Result Grid
  resultGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  resultCard: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.xl,
    ...theme.shadows.cardElevated,
  },
  resultCardSuccess: {
    backgroundColor: theme.success,
  },
  resultCardFail: {
    backgroundColor: theme.error,
  },
  resultCardLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 10,
  },
  // Carreau Button
  carreauBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.carreauColor + '12',
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.carreauColor + '40',
    gap: 14,
  },
  carreauBtnIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.carreauColor + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carreauBtnContent: {
    flex: 1,
  },
  carreauBtnTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.carreauColor,
    marginBottom: 2,
  },
  carreauBtnDesc: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  // Quick Mode Hint
  quickModeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
  },
  quickModeHintText: {
    fontSize: 12,
    color: theme.textMuted,
    flex: 1,
  },
  // Type Grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  // Quick Option
  quickOption: {
    width: (screenWidth - 52) / 2,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    position: 'relative',
    ...theme.shadows.card,
  },
  quickOptionSmall: {
    width: (screenWidth - 64) / 3,
    padding: 12,
  },
  quickOptionLarge: {
    width: screenWidth - 40,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 14,
  },
  quickOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickOptionIconSmall: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
  quickOptionIconLarge: {
    marginBottom: 0,
  },
  quickOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  quickOptionLabelSmall: {
    fontSize: 12,
  },
  quickOptionLabelSelected: {
    color: '#FFF',
  },
  quickOptionSublabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  quickOptionSublabelSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  quickOptionCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Quality List
  qualityList: {
    gap: 10,
  },
  qualityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    gap: 12,
    ...theme.shadows.card,
  },
  qualityItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityItemContent: {
    flex: 1,
  },
  qualityItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  qualityItemDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  // Quick Bar Styles
  quickBarCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    gap: 10,
  },
  quickBarName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  quickBarActions: {
    flexDirection: 'row',
    gap: 6,
  },
  quickBarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Full Quick Bar
  quickBar: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 2,
    marginBottom: 10,
  },
  quickBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  quickBarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  quickBarNameFull: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  quickBarStats: {
    fontSize: 10,
    color: theme.textMuted,
    fontVariant: ['tabular-nums'],
  },
  quickBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickBarSection: {
    alignItems: 'center',
  },
  quickBarSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  quickBarSectionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  quickBarActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBarCarreauBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: theme.carreauColor + '15',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.carreauColor + '40',
  },
  quickBarCarreauText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.carreauColor,
  },
  quickBarHint: {
    fontSize: 10,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
