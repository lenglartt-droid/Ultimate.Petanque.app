import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  PanResponder,
  Vibration,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  FadeOut,
  ZoomIn,
  ZoomOut,
  SlideInRight,
  SlideOutRight,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  playerName?: string;
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
// SWIPE GESTURE BUTTON
// ============================================

interface SwipeableResultButtonProps {
  onSuccess: () => void;
  onFail: () => void;
  onCarreau?: () => void;
  isTir: boolean;
}

function SwipeableResultButton({ onSuccess, onFail, onCarreau, isTir }: SwipeableResultButtonProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const [activeDirection, setActiveDirection] = useState<'none' | 'right' | 'left' | 'up'>('none');

  const SWIPE_THRESHOLD = 80;
  const SWIPE_UP_THRESHOLD = 60;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        scale.value = withSpring(0.95);
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.value = gestureState.dx;
        translateY.value = gestureState.dy;
        
        // Determine active direction
        if (gestureState.dy < -SWIPE_UP_THRESHOLD && isTir) {
          runOnJS(setActiveDirection)('up');
        } else if (gestureState.dx > SWIPE_THRESHOLD / 2) {
          runOnJS(setActiveDirection)('right');
        } else if (gestureState.dx < -SWIPE_THRESHOLD / 2) {
          runOnJS(setActiveDirection)('left');
        } else {
          runOnJS(setActiveDirection)('none');
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        
        // Check for swipe up first (carreau)
        if (dy < -SWIPE_UP_THRESHOLD && isTir && onCarreau) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          scale.value = withSequence(
            withSpring(1.2),
            withSpring(1)
          );
          runOnJS(onCarreau)();
        }
        // Swipe right = success
        else if (dx > SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          opacity.value = withTiming(0, { duration: 200 });
          runOnJS(onSuccess)();
        }
        // Swipe left = fail
        else if (dx < -SWIPE_THRESHOLD) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          opacity.value = withTiming(0, { duration: 200 });
          runOnJS(onFail)();
        }
        
        // Reset
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
        scale.value = withSpring(1);
        runOnJS(setActiveDirection)('none');
      },
    })
  ).current;

  const animatedStyle = useAnimatedStyle(() => {
    const rotateZ = interpolate(
      translateX.value,
      [-100, 0, 100],
      [-10, 0, 10],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotateZ: `${rotateZ}deg` },
      ],
      opacity: opacity.value,
    };
  });

  const successIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0.5, 1], Extrapolation.CLAMP) }],
  }));

  const failIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0.5], Extrapolation.CLAMP) }],
  }));

  const carreauIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-SWIPE_UP_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(translateY.value, [-SWIPE_UP_THRESHOLD, 0], [1, 0.5], Extrapolation.CLAMP) }],
  }));

  return (
    <View style={styles.swipeContainer}>
      {/* Background indicators */}
      <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorRight, successIndicatorStyle]}>
        <MaterialIcons name="check-circle" size={48} color={theme.success} />
        <Text style={[styles.swipeIndicatorText, { color: theme.success }]}>RÉUSSI</Text>
      </Animated.View>
      
      <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorLeft, failIndicatorStyle]}>
        <MaterialIcons name="cancel" size={48} color={theme.error} />
        <Text style={[styles.swipeIndicatorText, { color: theme.error }]}>RATÉ</Text>
      </Animated.View>
      
      {isTir && (
        <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorTop, carreauIndicatorStyle]}>
          <MaterialIcons name="stars" size={48} color={theme.carreauColor} />
          <Text style={[styles.swipeIndicatorText, { color: theme.carreauColor }]}>CARREAU</Text>
        </Animated.View>
      )}

      {/* Swipeable card */}
      <Animated.View 
        style={[styles.swipeCard, animatedStyle]}
        {...panResponder.panHandlers}
      >
        <View style={styles.swipeCardContent}>
          <MaterialIcons 
            name={isTir ? 'gps-fixed' : 'adjust'} 
            size={64} 
            color={isTir ? theme.tirColor : theme.pointColor} 
          />
          <Text style={styles.swipeCardTitle}>
            {isTir ? 'Résultat du tir' : 'Résultat du point'}
          </Text>
          <Text style={styles.swipeCardSubtitle}>Glissez pour enregistrer</Text>
          
          <View style={styles.swipeHints}>
            <View style={styles.swipeHintItem}>
              <MaterialIcons name="arrow-back" size={16} color={theme.error} />
              <Text style={[styles.swipeHintText, { color: theme.error }]}>Raté</Text>
            </View>
            <View style={styles.swipeHintDivider} />
            <View style={styles.swipeHintItem}>
              <Text style={[styles.swipeHintText, { color: theme.success }]}>Réussi</Text>
              <MaterialIcons name="arrow-forward" size={16} color={theme.success} />
            </View>
          </View>
          
          {isTir && (
            <View style={styles.swipeHintCarreau}>
              <MaterialIcons name="arrow-upward" size={16} color={theme.carreauColor} />
              <Text style={[styles.swipeHintText, { color: theme.carreauColor }]}>Carreau</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

// ============================================
// ANIMATED OPTION CARD
// ============================================

interface AnimatedOptionCardProps {
  option: { id: string; label: string; icon: string; color: string; description: string };
  index: number;
  isSelected: boolean;
  onPress: () => void;
  width: number;
}

function AnimatedOptionCard({ option, index, isSelected, onPress, width }: AnimatedOptionCardProps) {
  const scale = useSharedValue(1);
  const borderWidth = useSharedValue(2);

  useEffect(() => {
    if (isSelected) {
      scale.value = withSequence(
        withSpring(1.05, { damping: 10 }),
        withSpring(1, { damping: 15 })
      );
      borderWidth.value = withTiming(3, { duration: 150 });
    } else {
      borderWidth.value = withTiming(2, { duration: 150 });
    }
  }, [isSelected, scale, borderWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderWidth: borderWidth.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(index * 60).springify()}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            styles.optionCard,
            { width, borderColor: option.color + '40' },
            isSelected && { borderColor: option.color },
            animatedStyle,
          ]}
        >
          <View style={[styles.optionCardIcon, { backgroundColor: option.color + '20' }]}>
            <MaterialIcons name={option.icon as any} size={28} color={option.color} />
          </View>
          <Text style={styles.optionCardLabel}>{option.label}</Text>
          <Text style={styles.optionCardDesc} numberOfLines={2}>{option.description}</Text>
          {isSelected && (
            <View style={[styles.optionSelectedBadge, { backgroundColor: option.color }]}>
              <MaterialIcons name="check" size={14} color="#FFF" />
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================
// HISTORY ITEM COMPONENT
// ============================================

interface HistoryItemProps {
  record: AdvancedShotRecord;
  index: number;
  onEdit: (record: AdvancedShotRecord) => void;
  onDelete: (id: string) => void;
}

function HistoryItem({ record, index, onEdit, onDelete }: HistoryItemProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    opacity.value = withTiming(0, { duration: 200 });
    scale.value = withTiming(0.8, { duration: 200 }, () => {
      runOnJS(onDelete)(record.id);
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const isTir = record.actionType === 'tir';
  const actionColor = isTir ? theme.tirColor : theme.pointColor;
  const resultColor = record.success ? (record.carreau ? theme.carreauColor : theme.success) : theme.error;

  const getTypeLabel = () => {
    if (isTir && record.shotType) {
      return SHOT_TYPES.find(t => t.id === record.shotType)?.label || '';
    }
    if (!isTir && record.pointType) {
      return POINT_TYPES.find(t => t.id === record.pointType)?.label || '';
    }
    return '';
  };

  const getQualityLabel = () => {
    if (isTir && record.shotQuality) {
      return SHOT_QUALITIES.find(q => q.id === record.shotQuality)?.label || '';
    }
    if (!isTir && record.pointQuality) {
      return POINT_QUALITIES.find(q => q.id === record.pointQuality)?.label || '';
    }
    return '';
  };

  return (
    <Animated.View
      entering={SlideInRight.duration(300).delay(index * 50).springify()}
      style={animatedStyle}
    >
      <View style={styles.historyItem}>
        <View style={[styles.historyItemIndicator, { backgroundColor: actionColor }]} />
        
        <View style={styles.historyItemContent}>
          <View style={styles.historyItemHeader}>
            <View style={styles.historyItemPlayerBadge}>
              <Text style={[styles.historyItemTeam, { color: record.team === 'A' ? theme.primary : theme.accent }]}>
                {record.team}
              </Text>
              <Text style={styles.historyItemPlayer} numberOfLines={1}>
                {record.playerName?.split(' ')[0] || 'Joueur'}
              </Text>
            </View>
            <View style={[styles.historyItemResult, { backgroundColor: resultColor + '20' }]}>
              <MaterialIcons 
                name={record.success ? (record.carreau ? 'stars' : 'check') : 'close'} 
                size={14} 
                color={resultColor} 
              />
              <Text style={[styles.historyItemResultText, { color: resultColor }]}>
                {record.carreau ? 'Carreau' : record.success ? 'Réussi' : 'Raté'}
              </Text>
            </View>
          </View>
          
          <View style={styles.historyItemMeta}>
            <View style={[styles.historyItemTag, { backgroundColor: actionColor + '15' }]}>
              <MaterialIcons name={isTir ? 'gps-fixed' : 'adjust'} size={12} color={actionColor} />
              <Text style={[styles.historyItemTagText, { color: actionColor }]}>
                {isTir ? 'TIR' : 'POINT'}
              </Text>
            </View>
            {getTypeLabel() ? (
              <View style={[styles.historyItemTag, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={styles.historyItemTagText}>{getTypeLabel()}</Text>
              </View>
            ) : null}
            {getQualityLabel() ? (
              <View style={[styles.historyItemTag, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={styles.historyItemTagText}>{getQualityLabel()}</Text>
              </View>
            ) : null}
          </View>
        </View>
        
        <View style={styles.historyItemActions}>
          <Pressable 
            style={styles.historyItemAction}
            onPress={() => onEdit(record)}
          >
            <MaterialIcons name="edit" size={18} color={theme.textMuted} />
          </Pressable>
          <Pressable 
            style={styles.historyItemAction}
            onPress={handleDelete}
          >
            <MaterialIcons name="delete-outline" size={18} color={theme.error} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ============================================
// SHOT HISTORY PANEL
// ============================================

interface ShotHistoryPanelProps {
  records: AdvancedShotRecord[];
  visible: boolean;
  onClose: () => void;
  onEdit: (record: AdvancedShotRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function ShotHistoryPanel({
  records,
  visible,
  onClose,
  onEdit,
  onDelete,
  onClear,
}: ShotHistoryPanelProps) {
  if (!visible) return null;

  const successCount = records.filter(r => r.success).length;
  const carreauCount = records.filter(r => r.carreau).length;
  const tirCount = records.filter(r => r.actionType === 'tir').length;
  const pointCount = records.filter(r => r.actionType === 'point').length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Pressable style={styles.historyCloseBtn} onPress={onClose}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.historyTitle}>Historique des actions</Text>
          {records.length > 0 && (
            <Pressable style={styles.historyClearBtn} onPress={onClear}>
              <MaterialIcons name="delete-sweep" size={20} color={theme.error} />
            </Pressable>
          )}
        </View>

        {/* Stats Summary */}
        <View style={styles.historyStats}>
          <View style={styles.historyStatItem}>
            <Text style={styles.historyStatValue}>{records.length}</Text>
            <Text style={styles.historyStatLabel}>Total</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.historyStatItem}>
            <Text style={[styles.historyStatValue, { color: theme.success }]}>{successCount}</Text>
            <Text style={styles.historyStatLabel}>Réussis</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.historyStatItem}>
            <Text style={[styles.historyStatValue, { color: theme.carreauColor }]}>{carreauCount}</Text>
            <Text style={styles.historyStatLabel}>Carreaux</Text>
          </View>
          <View style={styles.historyStatDivider} />
          <View style={styles.historyStatItem}>
            <View style={styles.historyStatRow}>
              <MaterialIcons name="gps-fixed" size={12} color={theme.tirColor} />
              <Text style={[styles.historyStatMini, { color: theme.tirColor }]}>{tirCount}</Text>
            </View>
            <View style={styles.historyStatRow}>
              <MaterialIcons name="adjust" size={12} color={theme.pointColor} />
              <Text style={[styles.historyStatMini, { color: theme.pointColor }]}>{pointCount}</Text>
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.historyList}
          contentContainerStyle={styles.historyListContent}
          showsVerticalScrollIndicator={false}
        >
          {records.length > 0 ? (
            records.slice().reverse().map((record, index) => (
              <HistoryItem
                key={record.id}
                record={record}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          ) : (
            <View style={styles.historyEmpty}>
              <MaterialIcons name="history" size={48} color={theme.textMuted} />
              <Text style={styles.historyEmptyText}>Aucune action enregistrée</Text>
              <Text style={styles.historyEmptySubtext}>
                Les actions apparaîtront ici en temps réel
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ============================================
// FLOATING HISTORY BUTTON
// ============================================

interface FloatingHistoryButtonProps {
  count: number;
  onPress: () => void;
  lastAction?: AdvancedShotRecord | null;
}

export function FloatingHistoryButton({ count, onPress, lastAction }: FloatingHistoryButtonProps) {
  const scale = useSharedValue(1);
  const badgeScale = useSharedValue(1);

  useEffect(() => {
    if (count > 0) {
      badgeScale.value = withSequence(
        withSpring(1.3, { damping: 8 }),
        withSpring(1, { damping: 12 })
      );
    }
  }, [count, badgeScale]);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.floatingHistoryBtn, animatedStyle]}>
        <MaterialIcons name="history" size={24} color="#FFF" />
        {count > 0 && (
          <Animated.View style={[styles.floatingHistoryBadge, badgeAnimatedStyle]}>
            <Text style={styles.floatingHistoryBadgeText}>{count > 99 ? '99+' : count}</Text>
          </Animated.View>
        )}
        {lastAction && (
          <View style={[
            styles.floatingHistoryLastAction,
            { backgroundColor: lastAction.success ? theme.success : theme.error }
          ]}>
            <MaterialIcons 
              name={lastAction.success ? 'check' : 'close'} 
              size={10} 
              color="#FFF" 
            />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface AdvancedShotNotationProps {
  visible: boolean;
  onClose: () => void;
  actionType: 'tir' | 'point';
  playerId: string;
  playerName: string;
  team: 'A' | 'B';
  onSubmit: (record: AdvancedShotRecord) => void;
  quickMode?: boolean;
  useGestures?: boolean;
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
  useGestures = true,
}: AdvancedShotNotationProps) {
  const [step, setStep] = useState<'result' | 'type' | 'quality'>('result');
  const [success, setSuccess] = useState<boolean | null>(null);
  const [carreau, setCarreau] = useState(false);
  const [shotType, setShotType] = useState<ShotType | null>(null);
  const [shotQuality, setShotQuality] = useState<ShotQuality | null>(null);
  const [pointType, setPointType] = useState<PointType | null>(null);
  const [pointQuality, setPointQuality] = useState<PointQuality | null>(null);

  const progressWidth = useSharedValue(0);
  const stepTransition = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progressWidth.value = withTiming(33.33, { duration: 400, easing: Easing.out(Easing.cubic) });
    } else {
      progressWidth.value = 0;
    }
  }, [visible, progressWidth]);

  useEffect(() => {
    const targetProgress = step === 'result' ? 33.33 : step === 'type' ? 66.66 : 100;
    progressWidth.value = withSpring(targetProgress, { damping: 15 });
    stepTransition.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 12 })
    );
  }, [step, progressWidth, stepTransition]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stepTransition.value }],
  }));

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
    Haptics.impactAsync(isSuccess ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    setSuccess(isSuccess);
    setCarreau(isCarreau);
    
    if (quickMode) {
      const record: AdvancedShotRecord = {
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
      setStep('type');
    }
  }, [quickMode, playerId, playerName, team, actionType, onSubmit, handleClose]);

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
      playerName,
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
  }, [playerId, playerName, team, actionType, success, carreau, shotType, pointType, onSubmit, handleClose]);

  const skipToSubmit = useCallback(() => {
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
  const optionCardWidth = (screenWidth - 44) / 2;

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
          {step !== 'result' ? (
            <Pressable style={styles.headerBtn} onPress={skipToSubmit}>
              <Text style={styles.skipText}>Valider</Text>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, { backgroundColor: teamColor }, progressStyle]} />
          </View>
          <View style={styles.progressStepsRow}>
            <View style={[styles.progressStepDot, step !== 'result' && styles.progressStepDotDone]}>
              {step !== 'result' ? (
                <MaterialIcons name="check" size={10} color="#FFF" />
              ) : (
                <Text style={styles.progressStepNum}>1</Text>
              )}
            </View>
            <View style={[
              styles.progressStepDot, 
              step === 'type' && styles.progressStepDotActive,
              step === 'quality' && styles.progressStepDotDone
            ]}>
              {step === 'quality' ? (
                <MaterialIcons name="check" size={10} color="#FFF" />
              ) : (
                <Text style={[styles.progressStepNum, step === 'type' && { color: teamColor }]}>2</Text>
              )}
            </View>
            <View style={[styles.progressStepDot, step === 'quality' && styles.progressStepDotActive]}>
              <Text style={[styles.progressStepNum, step === 'quality' && { color: teamColor }]}>3</Text>
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={contentStyle}>
            {/* Step 1: Result with Gestures */}
            {step === 'result' && (
              <Animated.View entering={FadeIn.duration(300)}>
                <Text style={styles.stepTitle}>Résultat du {isTir ? 'tir' : 'point'}</Text>
                
                {useGestures ? (
                  <>
                    <Text style={styles.stepSubtitle}>
                      Glissez la carte pour enregistrer rapidement
                    </Text>
                    <SwipeableResultButton
                      onSuccess={() => handleResultSelect(true, false)}
                      onFail={() => handleResultSelect(false, false)}
                      onCarreau={isTir ? () => handleResultSelect(true, true) : undefined}
                      isTir={isTir}
                    />
                    <View style={styles.orDivider}>
                      <View style={styles.orDividerLine} />
                      <Text style={styles.orDividerText}>OU</Text>
                      <View style={styles.orDividerLine} />
                    </View>
                  </>
                ) : (
                  <Text style={styles.stepSubtitle}>
                    {isTir ? 'La boule adverse a-t-elle été touchée ?' : 'Le point est-il bien placé ?'}
                  </Text>
                )}

                <View style={styles.resultButtonsContainer}>
                  <Pressable
                    style={[styles.resultButton, styles.resultButtonSuccess]}
                    onPress={() => handleResultSelect(true, false)}
                  >
                    <Animated.View entering={ZoomIn.duration(200).delay(100)}>
                      <MaterialIcons name="check" size={56} color="#FFF" />
                    </Animated.View>
                    <Text style={styles.resultButtonText}>
                      {isTir ? 'Réussi' : 'Bon point'}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.resultButton, styles.resultButtonFail]}
                    onPress={() => handleResultSelect(false, false)}
                  >
                    <Animated.View entering={ZoomIn.duration(200).delay(200)}>
                      <MaterialIcons name="close" size={56} color="#FFF" />
                    </Animated.View>
                    <Text style={styles.resultButtonText}>
                      {isTir ? 'Raté' : 'Raté'}
                    </Text>
                  </Pressable>
                </View>

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
                          Boule tirée prend la place de la cible
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
              <Animated.View entering={FadeIn.duration(300)}>
                <Text style={styles.stepTitle}>Type de {isTir ? 'tir' : 'point'}</Text>
                <Text style={styles.stepSubtitle}>
                  {isTir ? 'Comment avez-vous tiré ?' : 'Comment avez-vous pointé ?'}
                </Text>

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
                    <AnimatedOptionCard
                      key={option.id}
                      option={option}
                      index={index}
                      isSelected={(isTir ? shotType : pointType) === option.id}
                      onPress={() => handleTypeSelect(option.id)}
                      width={optionCardWidth}
                    />
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Step 3: Quality Selection */}
            {step === 'quality' && (
              <Animated.View entering={FadeIn.duration(300)}>
                <Text style={styles.stepTitle}>Qualité du {isTir ? 'tir' : 'point'}</Text>
                <Text style={styles.stepSubtitle}>
                  {isTir ? 'Impact du tir sur la mène' : 'Précision et effet du point'}
                </Text>

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
                      entering={FadeInDown.duration(250).delay(index * 40).springify()}
                    >
                      <Pressable
                        style={[styles.qualityCard, { borderLeftColor: option.color }]}
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
          </Animated.View>
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
  onLongPress?: () => void;
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
  const scale = useSharedValue(1);

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

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          styles.quickButton,
          { 
            width: button, 
            height: button, 
            backgroundColor: color,
            opacity: disabled ? 0.5 : 1,
          },
          animatedStyle,
        ]}
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
      </Animated.View>
    </Pressable>
  );
}

// ============================================
// INLINE NOTATION BAR
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
      playerName,
      team,
      actionType: actionType === 'carreau' ? 'tir' : actionType,
      success: actionType === 'carreau' ? true : success,
      carreau: actionType === 'carreau',
    });
  }, [playerId, playerName, team, onRecordShot]);

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
    fontWeight: '600',
    color: theme.primary,
  },
  // Progress Bar
  progressBarContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressStepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  progressStepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepDotActive: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  progressStepDotDone: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  progressStepNum: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
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
    marginBottom: 24,
  },
  // Swipe Container
  swipeContainer: {
    height: 220,
    marginBottom: 16,
    position: 'relative',
  },
  swipeIndicator: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeIndicatorRight: {
    right: 20,
    top: '50%',
    marginTop: -40,
  },
  swipeIndicatorLeft: {
    left: 20,
    top: '50%',
    marginTop: -40,
  },
  swipeIndicatorTop: {
    top: 10,
    left: '50%',
    marginLeft: -40,
  },
  swipeIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  swipeCard: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    bottom: 20,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.cardElevated,
  },
  swipeCardContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  swipeCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 12,
  },
  swipeCardSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  swipeHints: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 16,
  },
  swipeHintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  swipeHintDivider: {
    width: 1,
    height: 16,
    backgroundColor: theme.border,
  },
  swipeHintCarreau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  // Or Divider
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  orDividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  // Result Buttons
  resultButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 8,
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
  // Result Summary
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
  // Options Grid
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    position: 'relative',
    ...theme.shadows.card,
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
  optionSelectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Quality Grid
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
  // History Panel
  historyContainer: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  historyCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  historyClearBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.surface,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  historyStatItem: {
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  historyStatLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 2,
  },
  historyStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.border,
  },
  historyStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStatMini: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyList: {
    flex: 1,
  },
  historyListContent: {
    padding: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 10,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  historyItemIndicator: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  historyItemContent: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
  },
  historyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  historyItemPlayerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyItemTeam: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyItemPlayer: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    maxWidth: 100,
  },
  historyItemResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  historyItemResultText: {
    fontSize: 11,
    fontWeight: '600',
  },
  historyItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  historyItemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  historyItemTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  historyItemActions: {
    flexDirection: 'row',
    paddingRight: 8,
  },
  historyItemAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  historyEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textMuted,
    marginTop: 16,
  },
  historyEmptySubtext: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  // Floating History Button
  floatingHistoryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.cardElevated,
  },
  floatingHistoryBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: theme.surface,
  },
  floatingHistoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  floatingHistoryLastAction: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.surface,
  },
});
