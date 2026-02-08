import React, { useState, useCallback } from 'react';
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
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';

const { width: screenWidth } = Dimensions.get('window');

// ============================================
// TYPES & DEFINITIONS
// ============================================

// Shot Quality Types (Qualité du tir)
export type ShotQuality = 
  | 'gain_point'      // Tir avec gain de point
  | 'sans_effet'      // Tir sans effet
  | 'negatif'         // Tir négatif (perte de point)
  | 'decisif'         // Tir décisif (fin de mène)
  | 'sous_pression'   // Tir sous pression
  | 'equipe_menee'    // Tir quand équipe menée
  | 'equipe_mene';    // Tir quand équipe mène

// Shot Type Types (Type de tir)
export type ShotType = 
  | 'au_fer'          // Tir au fer (direct)
  | 'au_plomb'        // Tir au plomb (lobé)
  | 'en_rafle'        // Tir en rafle (rasant)
  | 'court'           // Tir court
  | 'long'            // Tir long
  | 'en_angle'        // Tir en angle
  | 'sur_boule'       // Tir sur boule adverse
  | 'sur_but';        // Tir sur but (cochonnet)

// Point Type Types (Type de point)
export type PointType = 
  | 'roule'           // Point roulé
  | 'plombe'          // Point plombé
  | 'demi_portee'     // Point demi-portée
  | 'portee_haute'    // Point portée haute
  | 'au_but'          // Point au but
  | 'securite';       // Point de sécurité

// Point Quality Types (Qualité du point)
export type PointQuality = 
  | 'gagnant'         // Point gagnant (meilleure boule)
  | 'placement'       // Point de placement
  | 'moins_50cm'      // Point à moins de 50 cm
  | 'moins_30cm'      // Point à moins de 30 cm
  | 'moins_10cm'      // Point à moins de 10 cm
  | 'rate_court'      // Point raté court
  | 'rate_long'       // Point raté long
  | 'trop_droite'     // Point trop à droite
  | 'trop_gauche';    // Point trop à gauche

// Complete Shot Record
export interface AdvancedShotRecord {
  id: string;
  timestamp: string;
  playerId: string;
  team: 'A' | 'B';
  
  // Basic result
  actionType: 'tir' | 'point';
  success: boolean;
  carreau?: boolean;  // Only for tir
  
  // Advanced - Tir
  shotType?: ShotType;
  shotQuality?: ShotQuality;
  
  // Advanced - Point
  pointType?: PointType;
  pointQuality?: PointQuality;
  distanceFromJack?: number; // in cm
}

// Config for shot qualities
const SHOT_QUALITIES: { id: ShotQuality; label: string; icon: string; color: string; description: string }[] = [
  { id: 'gain_point', label: 'Gain de point', icon: 'trending-up', color: theme.success, description: 'Tir qui rapporte un point' },
  { id: 'sans_effet', label: 'Sans effet', icon: 'remove', color: theme.warning, description: 'Tir sans impact sur le score' },
  { id: 'negatif', label: 'Négatif', icon: 'trending-down', color: theme.error, description: 'Tir qui fait perdre un point' },
  { id: 'decisif', label: 'Décisif', icon: 'flag', color: theme.carreauColor, description: 'Tir de fin de mène' },
  { id: 'sous_pression', label: 'Sous pression', icon: 'psychology', color: theme.accent, description: 'Score serré ou fin de match' },
  { id: 'equipe_menee', label: 'Équipe menée', icon: 'arrow-downward', color: '#EF4444', description: 'Score en retard' },
  { id: 'equipe_mene', label: 'Équipe mène', icon: 'arrow-upward', color: '#10B981', description: 'Score en avance' },
];

// Config for shot types
const SHOT_TYPES: { id: ShotType; label: string; icon: string; color: string; description: string }[] = [
  { id: 'au_fer', label: 'Au fer', icon: 'gps-fixed', color: theme.tirColor, description: 'Tir direct sans rebond' },
  { id: 'au_plomb', label: 'Au plomb', icon: 'flight-takeoff', color: theme.pointColor, description: 'Tir en cloche' },
  { id: 'en_rafle', label: 'En rafle', icon: 'swap-horiz', color: theme.accent, description: 'Tir rasant le sol' },
  { id: 'court', label: 'Court', icon: 'vertical-align-bottom', color: '#F59E0B', description: 'Tir avant la cible' },
  { id: 'long', label: 'Long', icon: 'vertical-align-top', color: '#8B5CF6', description: 'Tir après la cible' },
  { id: 'en_angle', label: 'En angle', icon: 'turn-right', color: '#06B6D4', description: 'Tir avec angle' },
  { id: 'sur_boule', label: 'Sur boule', icon: 'sports-baseball', color: theme.primary, description: 'Cible : boule adverse' },
  { id: 'sur_but', label: 'Sur but', icon: 'adjust', color: theme.carreauColor, description: 'Cible : cochonnet' },
];

// Config for point types
const POINT_TYPES: { id: PointType; label: string; icon: string; color: string; description: string }[] = [
  { id: 'roule', label: 'Roulé', icon: 'sports-baseball', color: theme.pointColor, description: 'Boule roulée au sol' },
  { id: 'plombe', label: 'Plombé', icon: 'flight-land', color: theme.tirColor, description: 'Boule lancée en hauteur' },
  { id: 'demi_portee', label: 'Demi-portée', icon: 'height', color: theme.accent, description: 'Entre roulé et plombé' },
  { id: 'portee_haute', label: 'Portée haute', icon: 'flight', color: theme.carreauColor, description: 'Lancer très haut' },
  { id: 'au_but', label: 'Au but', icon: 'adjust', color: theme.primary, description: 'Viser le cochonnet' },
  { id: 'securite', label: 'Sécurité', icon: 'security', color: theme.success, description: 'Point défensif' },
];

// Config for point qualities
const POINT_QUALITIES: { id: PointQuality; label: string; icon: string; color: string; description: string }[] = [
  { id: 'gagnant', label: 'Gagnant', icon: 'emoji-events', color: theme.carreauColor, description: 'Meilleure boule du jeu' },
  { id: 'placement', label: 'Placement', icon: 'shield', color: theme.primary, description: 'Protection ou blocage' },
  { id: 'moins_50cm', label: '< 50 cm', icon: 'looks-one', color: theme.success, description: 'Proche du but' },
  { id: 'moins_30cm', label: '< 30 cm', icon: 'looks-two', color: theme.pointColor, description: 'Très proche' },
  { id: 'moins_10cm', label: '< 10 cm', icon: 'looks-3', color: theme.carreauColor, description: 'Excellent point' },
  { id: 'rate_court', label: 'Raté court', icon: 'vertical-align-bottom', color: theme.error, description: 'Trop court' },
  { id: 'rate_long', label: 'Raté long', icon: 'vertical-align-top', color: theme.error, description: 'Trop long' },
  { id: 'trop_droite', label: 'Trop à droite', icon: 'chevron-right', color: theme.warning, description: 'Dévié à droite' },
  { id: 'trop_gauche', label: 'Trop à gauche', icon: 'chevron-left', color: theme.warning, description: 'Dévié à gauche' },
];

// ============================================
// COMPONENTS
// ============================================

interface AdvancedShotNotationProps {
  visible: boolean;
  onClose: () => void;
  actionType: 'tir' | 'point';
  playerId: string;
  playerName: string;
  team: 'A' | 'B';
  onSubmit: (record: AdvancedShotRecord) => void;
  quickMode?: boolean; // Skip to result selection
}

export function AdvancedShotNotation({
  visible,
  onClose,
  actionType,
  playerId,
  playerName,
  team,
  onSubmit,
  quickMode = false,
}: AdvancedShotNotationProps) {
  const [step, setStep] = useState<'result' | 'type' | 'quality'>('result');
  const [success, setSuccess] = useState<boolean | null>(null);
  const [carreau, setCarreau] = useState(false);
  const [shotType, setShotType] = useState<ShotType | null>(null);
  const [shotQuality, setShotQuality] = useState<ShotQuality | null>(null);
  const [pointType, setPointType] = useState<PointType | null>(null);
  const [pointQuality, setPointQuality] = useState<PointQuality | null>(null);

  const resetState = useCallback(() => {
    setStep('result');
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

  const handleResultSelect = useCallback((isSuccess: boolean, isCarreau: boolean = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSuccess(isSuccess);
    setCarreau(isCarreau);
    
    if (quickMode) {
      // Quick mode - submit immediately with basic info
      const record: AdvancedShotRecord = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        playerId,
        team,
        actionType,
        success: isSuccess,
        carreau: isCarreau,
      };
      onSubmit(record);
      handleClose();
    } else {
      setStep('type');
    }
  }, [quickMode, playerId, team, actionType, onSubmit, handleClose]);

  const handleTypeSelect = useCallback((type: ShotType | PointType) => {
    Haptics.selectionAsync();
    if (actionType === 'tir') {
      setShotType(type as ShotType);
    } else {
      setPointType(type as PointType);
    }
    setStep('quality');
  }, [actionType]);

  const handleQualitySelect = useCallback((quality: ShotQuality | PointQuality | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const record: AdvancedShotRecord = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      playerId,
      team,
      actionType,
      success: success!,
      carreau: actionType === 'tir' ? carreau : undefined,
      shotType: actionType === 'tir' ? shotType || undefined : undefined,
      shotQuality: actionType === 'tir' ? (quality as ShotQuality) || undefined : undefined,
      pointType: actionType === 'point' ? pointType || undefined : undefined,
      pointQuality: actionType === 'point' ? (quality as PointQuality) || undefined : undefined,
    };
    
    onSubmit(record);
    handleClose();
  }, [playerId, team, actionType, success, carreau, shotType, pointType, onSubmit, handleClose]);

  const skipQuality = useCallback(() => {
    handleQualitySelect(null);
  }, [handleQualitySelect]);

  const goBack = useCallback(() => {
    Haptics.selectionAsync();
    if (step === 'quality') {
      setStep('type');
      if (actionType === 'tir') {
        setShotQuality(null);
      } else {
        setPointQuality(null);
      }
    } else if (step === 'type') {
      setStep('result');
      setSuccess(null);
      setCarreau(false);
      setShotType(null);
      setPointType(null);
    }
  }, [step, actionType]);

  const isTir = actionType === 'tir';
  const teamColor = team === 'A' ? theme.primary : theme.accent;

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
          <Pressable style={styles.headerBtn} onPress={step === 'result' ? handleClose : goBack}>
            <MaterialIcons 
              name={step === 'result' ? 'close' : 'arrow-back'} 
              size={24} 
              color={theme.textPrimary} 
            />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={[styles.headerBadge, { backgroundColor: teamColor + '20' }]}>
              <MaterialIcons 
                name={isTir ? 'gps-fixed' : 'adjust'} 
                size={18} 
                color={teamColor} 
              />
              <Text style={[styles.headerBadgeText, { color: teamColor }]}>
                {isTir ? 'TIR' : 'POINT'}
              </Text>
            </View>
            <Text style={styles.headerTitle}>{playerName}</Text>
          </View>
          {step !== 'result' && (
            <Pressable style={styles.headerBtn} onPress={skipQuality}>
              <Text style={styles.skipText}>Passer</Text>
            </Pressable>
          )}
          {step === 'result' && <View style={{ width: 60 }} />}
        </View>

        {/* Progress Steps */}
        <View style={styles.progressSteps}>
          <View style={[styles.progressStep, step === 'result' && styles.progressStepActive]}>
            <View style={[styles.progressDot, step !== 'result' && styles.progressDotDone]}>
              {step !== 'result' ? (
                <MaterialIcons name="check" size={12} color="#FFF" />
              ) : (
                <Text style={styles.progressDotText}>1</Text>
              )}
            </View>
            <Text style={[styles.progressLabel, step === 'result' && styles.progressLabelActive]}>Résultat</Text>
          </View>
          <View style={[styles.progressLine, step !== 'result' && styles.progressLineDone]} />
          <View style={[styles.progressStep, step === 'type' && styles.progressStepActive]}>
            <View style={[
              styles.progressDot, 
              step === 'type' && styles.progressDotActive,
              step === 'quality' && styles.progressDotDone
            ]}>
              {step === 'quality' ? (
                <MaterialIcons name="check" size={12} color="#FFF" />
              ) : (
                <Text style={[styles.progressDotText, step === 'type' && styles.progressDotTextActive]}>2</Text>
              )}
            </View>
            <Text style={[styles.progressLabel, step === 'type' && styles.progressLabelActive]}>Type</Text>
          </View>
          <View style={[styles.progressLine, step === 'quality' && styles.progressLineDone]} />
          <View style={[styles.progressStep, step === 'quality' && styles.progressStepActive]}>
            <View style={[styles.progressDot, step === 'quality' && styles.progressDotActive]}>
              <Text style={[styles.progressDotText, step === 'quality' && styles.progressDotTextActive]}>3</Text>
            </View>
            <Text style={[styles.progressLabel, step === 'quality' && styles.progressLabelActive]}>Qualité</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1: Result */}
          {step === 'result' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={styles.stepTitle}>Résultat du {isTir ? 'tir' : 'point'}</Text>
              <Text style={styles.stepSubtitle}>
                {isTir ? 'La boule adverse a-t-elle été touchée ?' : 'Le point est-il bien placé ?'}
              </Text>

              <View style={styles.resultButtonsContainer}>
                {/* Success Button */}
                <Pressable
                  style={[styles.resultButton, styles.resultButtonSuccess]}
                  onPress={() => handleResultSelect(true, false)}
                >
                  <Animated.View entering={ZoomIn.duration(200).delay(100)}>
                    <MaterialIcons name="check" size={64} color="#FFF" />
                  </Animated.View>
                  <Text style={styles.resultButtonText}>
                    {isTir ? 'Réussi' : 'Bon point'}
                  </Text>
                  <Text style={styles.resultButtonDesc}>
                    {isTir ? 'Boule touchée' : 'Proche du but'}
                  </Text>
                </Pressable>

                {/* Fail Button */}
                <Pressable
                  style={[styles.resultButton, styles.resultButtonFail]}
                  onPress={() => handleResultSelect(false, false)}
                >
                  <Animated.View entering={ZoomIn.duration(200).delay(200)}>
                    <MaterialIcons name="close" size={64} color="#FFF" />
                  </Animated.View>
                  <Text style={styles.resultButtonText}>
                    {isTir ? 'Raté' : 'Raté'}
                  </Text>
                  <Text style={styles.resultButtonDesc}>
                    {isTir ? 'Aucun contact' : 'Loin du but'}
                  </Text>
                </Pressable>
              </View>

              {/* Carreau Option - Only for Tir */}
              {isTir && (
                <Animated.View entering={FadeInUp.duration(300).delay(300)}>
                  <Pressable
                    style={styles.carreauButton}
                    onPress={() => handleResultSelect(true, true)}
                  >
                    <View style={styles.carreauButtonIcon}>
                      <MaterialIcons name="stars" size={32} color={theme.carreauColor} />
                    </View>
                    <View style={styles.carreauButtonContent}>
                      <Text style={styles.carreauButtonTitle}>CARREAU !</Text>
                      <Text style={styles.carreauButtonDesc}>
                        La boule tirée prend la place exacte de la boule touchée
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={theme.carreauColor} />
                  </Pressable>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* Step 2: Type Selection */}
          {step === 'type' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={styles.stepTitle}>Type de {isTir ? 'tir' : 'point'}</Text>
              <Text style={styles.stepSubtitle}>
                {isTir ? 'Comment avez-vous tiré ?' : 'Comment avez-vous pointé ?'}
              </Text>

              {/* Result Summary */}
              <View style={styles.resultSummary}>
                <MaterialIcons 
                  name={success ? (carreau ? 'stars' : 'check-circle') : 'cancel'} 
                  size={24} 
                  color={success ? (carreau ? theme.carreauColor : theme.success) : theme.error} 
                />
                <Text style={styles.resultSummaryText}>
                  {success ? (carreau ? 'Carreau' : (isTir ? 'Tir réussi' : 'Bon point')) : 'Raté'}
                </Text>
              </View>

              <View style={styles.optionsGrid}>
                {(isTir ? SHOT_TYPES : POINT_TYPES).map((option, index) => (
                  <Animated.View 
                    key={option.id}
                    entering={FadeInDown.duration(200).delay(index * 50)}
                  >
                    <Pressable
                      style={[
                        styles.optionCard,
                        (isTir ? shotType : pointType) === option.id && styles.optionCardSelected,
                        { borderColor: option.color + '40' }
                      ]}
                      onPress={() => handleTypeSelect(option.id)}
                    >
                      <View style={[styles.optionCardIcon, { backgroundColor: option.color + '20' }]}>
                        <MaterialIcons name={option.icon as any} size={28} color={option.color} />
                      </View>
                      <Text style={styles.optionCardLabel}>{option.label}</Text>
                      <Text style={styles.optionCardDesc} numberOfLines={2}>{option.description}</Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Step 3: Quality Selection */}
          {step === 'quality' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={styles.stepTitle}>Qualité du {isTir ? 'tir' : 'point'}</Text>
              <Text style={styles.stepSubtitle}>
                {isTir ? 'Impact du tir sur la mène' : 'Précision et effet du point'}
              </Text>

              {/* Type Summary */}
              <View style={styles.resultSummary}>
                <MaterialIcons 
                  name={success ? (carreau ? 'stars' : 'check-circle') : 'cancel'} 
                  size={20} 
                  color={success ? (carreau ? theme.carreauColor : theme.success) : theme.error} 
                />
                <Text style={styles.resultSummaryText}>
                  {success ? (carreau ? 'Carreau' : (isTir ? 'Réussi' : 'Bon')) : 'Raté'}
                </Text>
                <View style={styles.resultSummaryDivider} />
                <MaterialIcons 
                  name={(isTir ? SHOT_TYPES : POINT_TYPES).find(t => t.id === (isTir ? shotType : pointType))?.icon as any || 'help'} 
                  size={20} 
                  color={theme.textSecondary} 
                />
                <Text style={styles.resultSummaryText}>
                  {(isTir ? SHOT_TYPES : POINT_TYPES).find(t => t.id === (isTir ? shotType : pointType))?.label || 'Type'}
                </Text>
              </View>

              <View style={styles.qualityGrid}>
                {(isTir ? SHOT_QUALITIES : POINT_QUALITIES).map((option, index) => (
                  <Animated.View 
                    key={option.id}
                    entering={FadeInDown.duration(200).delay(index * 40)}
                  >
                    <Pressable
                      style={[
                        styles.qualityCard,
                        { borderLeftColor: option.color }
                      ]}
                      onPress={() => handleQualitySelect(option.id)}
                    >
                      <View style={[styles.qualityCardIcon, { backgroundColor: option.color + '15' }]}>
                        <MaterialIcons name={option.icon as any} size={22} color={option.color} />
                      </View>
                      <View style={styles.qualityCardContent}>
                        <Text style={styles.qualityCardLabel}>{option.label}</Text>
                        <Text style={styles.qualityCardDesc} numberOfLines={1}>{option.description}</Text>
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
// QUICK NOTATION BUTTON
// ============================================

interface QuickNotationButtonProps {
  actionType: 'tir' | 'point' | 'carreau';
  onPress: () => void;
  onLongPress?: () => void; // For detailed notation
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  disabled?: boolean;
  stats?: { success: number; total: number; carreaux?: number };
}

export function QuickNotationButton({
  actionType,
  onPress,
  onLongPress,
  size = 'medium',
  showLabel = true,
  disabled = false,
  stats,
}: QuickNotationButtonProps) {
  const config = {
    tir: { icon: 'gps-fixed', label: 'TIR', color: theme.tirColor },
    point: { icon: 'adjust', label: 'POINT', color: theme.pointColor },
    carreau: { icon: 'stars', label: 'CARREAU', color: theme.carreauColor },
  };

  const { icon, label, color } = config[actionType];

  const sizeConfig = {
    small: { button: 40, icon: 20, fontSize: 10 },
    medium: { button: 56, icon: 26, fontSize: 11 },
    large: { button: 72, icon: 32, fontSize: 12 },
  };

  const { button, icon: iconSize, fontSize } = sizeConfig[size];

  return (
    <Pressable
      style={[
        styles.quickButton,
        { 
          width: button, 
          height: button, 
          backgroundColor: color,
          opacity: disabled ? 0.5 : 1,
        }
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
    >
      <MaterialIcons name={icon as any} size={iconSize} color="#FFF" />
      {showLabel && (
        <Text style={[styles.quickButtonLabel, { fontSize }]}>{label}</Text>
      )}
      {stats && (
        <View style={styles.quickButtonStats}>
          <Text style={styles.quickButtonStatsText}>
            {stats.success}/{stats.total}
            {stats.carreaux !== undefined && stats.carreaux > 0 ? ` (${stats.carreaux}C)` : ''}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ============================================
// INLINE NOTATION BAR (for fullscreen mode)
// ============================================

interface InlineNotationBarProps {
  playerId: string;
  playerName: string;
  team: 'A' | 'B';
  onRecordShot: (record: Partial<AdvancedShotRecord>) => void;
  showAdvanced?: boolean;
  compact?: boolean;
}

export function InlineNotationBar({
  playerId,
  playerName,
  team,
  onRecordShot,
  showAdvanced = false,
  compact = false,
}: InlineNotationBarProps) {
  const [showModal, setShowModal] = useState(false);
  const [modalActionType, setModalActionType] = useState<'tir' | 'point'>('tir');

  const handleQuickRecord = useCallback((actionType: 'tir' | 'point' | 'carreau', success: boolean) => {
    Haptics.impactAsync(success ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    
    onRecordShot({
      playerId,
      team,
      actionType: actionType === 'carreau' ? 'tir' : actionType,
      success: actionType === 'carreau' ? true : success,
      carreau: actionType === 'carreau',
    });
  }, [playerId, team, onRecordShot]);

  const handleLongPress = useCallback((actionType: 'tir' | 'point') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setModalActionType(actionType);
    setShowModal(true);
  }, []);

  const handleAdvancedSubmit = useCallback((record: AdvancedShotRecord) => {
    onRecordShot(record);
  }, [onRecordShot]);

  const teamColor = team === 'A' ? theme.primary : theme.accent;

  if (compact) {
    return (
      <View style={[styles.inlineBarCompact, { borderLeftColor: teamColor }]}>
        <Text style={styles.inlineBarPlayerName} numberOfLines={1}>{playerName.split(' ')[0]}</Text>
        <View style={styles.inlineBarButtons}>
          <Pressable
            style={[styles.inlineBarBtn, { backgroundColor: theme.tirColor }]}
            onPress={() => handleQuickRecord('tir', true)}
            onLongPress={() => showAdvanced && handleLongPress('tir')}
          >
            <MaterialIcons name="gps-fixed" size={18} color="#FFF" />
          </Pressable>
          <Pressable
            style={[styles.inlineBarBtn, { backgroundColor: theme.pointColor }]}
            onPress={() => handleQuickRecord('point', true)}
            onLongPress={() => showAdvanced && handleLongPress('point')}
          >
            <MaterialIcons name="adjust" size={18} color="#FFF" />
          </Pressable>
          <Pressable
            style={[styles.inlineBarBtn, { backgroundColor: theme.carreauColor }]}
            onPress={() => handleQuickRecord('carreau', true)}
          >
            <MaterialIcons name="stars" size={18} color="#FFF" />
          </Pressable>
        </View>
        
        {showAdvanced && (
          <AdvancedShotNotation
            visible={showModal}
            onClose={() => setShowModal(false)}
            actionType={modalActionType}
            playerId={playerId}
            playerName={playerName}
            team={team}
            onSubmit={handleAdvancedSubmit}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.inlineBar, { borderColor: teamColor + '30' }]}>
      <View style={styles.inlineBarHeader}>
        <View style={[styles.inlineBarDot, { backgroundColor: teamColor }]} />
        <Text style={styles.inlineBarPlayerNameFull}>{playerName}</Text>
      </View>
      
      <View style={styles.inlineBarActionsRow}>
        {/* Tir Buttons */}
        <View style={styles.inlineBarActionGroup}>
          <Text style={styles.inlineBarGroupLabel}>TIR</Text>
          <View style={styles.inlineBarGroupButtons}>
            <Pressable
              style={[styles.inlineBarActionBtn, { backgroundColor: theme.success }]}
              onPress={() => handleQuickRecord('tir', true)}
              onLongPress={() => showAdvanced && handleLongPress('tir')}
            >
              <MaterialIcons name="check" size={20} color="#FFF" />
            </Pressable>
            <Pressable
              style={[styles.inlineBarActionBtn, { backgroundColor: theme.error }]}
              onPress={() => handleQuickRecord('tir', false)}
              onLongPress={() => showAdvanced && handleLongPress('tir')}
            >
              <MaterialIcons name="close" size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* Point Buttons */}
        <View style={styles.inlineBarActionGroup}>
          <Text style={styles.inlineBarGroupLabel}>POINT</Text>
          <View style={styles.inlineBarGroupButtons}>
            <Pressable
              style={[styles.inlineBarActionBtn, { backgroundColor: theme.success }]}
              onPress={() => handleQuickRecord('point', true)}
              onLongPress={() => showAdvanced && handleLongPress('point')}
            >
              <MaterialIcons name="check" size={20} color="#FFF" />
            </Pressable>
            <Pressable
              style={[styles.inlineBarActionBtn, { backgroundColor: theme.error }]}
              onPress={() => handleQuickRecord('point', false)}
              onLongPress={() => showAdvanced && handleLongPress('point')}
            >
              <MaterialIcons name="close" size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* Carreau Button */}
        <Pressable
          style={styles.inlineBarCarreauBtn}
          onPress={() => handleQuickRecord('carreau', true)}
        >
          <MaterialIcons name="stars" size={24} color={theme.carreauColor} />
          <Text style={styles.inlineBarCarreauText}>CARREAU</Text>
        </Pressable>
      </View>

      {showAdvanced && (
        <Text style={styles.inlineBarHint}>Appui long = notation détaillée</Text>
      )}

      {showAdvanced && (
        <AdvancedShotNotation
          visible={showModal}
          onClose={() => setShowModal(false)}
          actionType={modalActionType}
          playerId={playerId}
          playerName={playerName}
          team={team}
          onSubmit={handleAdvancedSubmit}
        />
      )}
    </View>
  );
}

// Export configuration for use in stats
export { SHOT_TYPES, SHOT_QUALITIES, POINT_TYPES, POINT_QUALITIES };

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
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
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    marginBottom: 4,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.primary,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressStepActive: {},
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  progressDotActive: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  progressDotDone: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  progressDotText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  progressDotTextActive: {
    color: theme.primary,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.textMuted,
  },
  progressLabelActive: {
    color: theme.primary,
    fontWeight: '600',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: theme.border,
    marginHorizontal: 8,
    marginBottom: 20,
  },
  progressLineDone: {
    backgroundColor: theme.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  resultButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  resultButton: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.cardElevated,
  },
  resultButtonSuccess: {
    backgroundColor: theme.success,
  },
  resultButtonFail: {
    backgroundColor: theme.error,
  },
  resultButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
  },
  resultButtonDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  carreauButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.carreauColor + '15',
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.carreauColor,
    gap: 12,
  },
  carreauButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.carreauColor + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carreauButtonContent: {
    flex: 1,
  },
  carreauButtonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.carreauColor,
    marginBottom: 4,
  },
  carreauButtonDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  resultSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.md,
    marginBottom: 24,
    gap: 8,
  },
  resultSummaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  resultSummaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: theme.border,
    marginHorizontal: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    width: (screenWidth - 44) / 2,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    ...theme.shadows.card,
  },
  optionCardSelected: {
    borderWidth: 3,
  },
  optionCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionCardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  optionCardDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  qualityGrid: {
    gap: 10,
  },
  qualityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    gap: 12,
    ...theme.shadows.card,
  },
  qualityCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityCardContent: {
    flex: 1,
  },
  qualityCardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  qualityCardDesc: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  // Quick Button
  quickButton: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  quickButtonLabel: {
    fontWeight: '700',
    color: '#FFF',
    marginTop: 4,
  },
  quickButtonStats: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: theme.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  quickButtonStatsText: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  // Inline Bar
  inlineBar: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 2,
    marginBottom: 10,
  },
  inlineBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  inlineBarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  inlineBarPlayerNameFull: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  inlineBarActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inlineBarActionGroup: {
    alignItems: 'center',
  },
  inlineBarGroupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textMuted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inlineBarGroupButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  inlineBarActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBarCarreauBtn: {
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
  inlineBarCarreauText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.carreauColor,
  },
  inlineBarHint: {
    fontSize: 10,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  // Compact Inline Bar
  inlineBarCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,
    gap: 10,
  },
  inlineBarPlayerName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  inlineBarButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  inlineBarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
