import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withTiming, withSequence, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { AdvancedShotNotation, AdvancedShotRecord, SHOT_TYPES, SHOT_QUALITIES } from '@/components';
import { 
  ChallengeType, 
  ChallengeShot,
  ChallengeMode,
  ChallengePlayerResult,
  PrecisionAtelier,
  PrecisionDistance,
  PrecisionShot,
  PRECISION_ATELIERS,
  PRECISION_DISTANCES,
  Player,
} from '@/services/mockData';

const { width: screenWidth } = Dimensions.get('window');

const CHALLENGE_CONFIG = {
  '10_tirs': {
    name: '10 Tirs',
    description: 'Réalisez 10 tirs sur cible',
    icon: 'gps-fixed' as const,
    totalShots: 10,
    color: theme.accent,
  },
  '10_tirs_sautee': {
    name: '10 Tirs à la Sautée',
    description: 'Réalisez 10 tirs à la sautée',
    icon: 'sports' as const,
    totalShots: 10,
    color: theme.primary,
  },
  'precision': {
    name: 'Tir de Précision',
    description: '20 tirs sur 5 ateliers - Max 100 points',
    icon: 'stars' as const,
    totalShots: 20,
    color: theme.carreauColor,
  },
};

// Timer countdown component for precision challenge
function CountdownTimer({ 
  seconds, 
  isRunning,
  onStart,
  onTimeUp 
}: { 
  seconds: number; 
  isRunning: boolean;
  onStart: () => void;
  onTimeUp: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  
  const progress = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(seconds);
      progress.value = 1;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRunning, seconds, progress]);

  useEffect(() => {
    if (isRunning) {
      setTimeLeft(seconds);
      progress.value = 1;
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            onTimeUpRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      progress.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear });
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, seconds, progress]);

  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && isRunning) {
      pulseScale.value = withSequence(
        withTiming(1.1, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [timeLeft, isRunning, pulseScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const getColor = () => {
    if (timeLeft <= 5) return theme.error;
    if (timeLeft <= 10) return theme.warning;
    return theme.success;
  };

  return (
    <View style={styles.countdownContainer}>
      <Animated.View style={[styles.countdownCircle, animatedStyle, { borderColor: getColor() }]}>
        <Text style={[styles.countdownText, { color: getColor() }]}>{timeLeft}</Text>
        <Text style={styles.countdownLabel}>sec</Text>
      </Animated.View>
      <View style={styles.countdownBar}>
        <Animated.View style={[styles.countdownBarFill, progressStyle, { backgroundColor: getColor() }]} />
      </View>
      {!isRunning && (
        <Pressable style={styles.startTimerButton} onPress={onStart}>
          <MaterialIcons name="play-arrow" size={24} color="#FFF" />
          <Text style={styles.startTimerButtonText}>Démarrer le chrono</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function NewChallengeScreen() {
  const insets = useSafeAreaInsets();
  const { addChallenge, userStats, selfPlayer, players } = useApp();

  const [selectedType, setSelectedType] = useState<ChallengeType | null>(null);
  const [challengeMode, setChallengeMode] = useState<ChallengeMode | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [showOpponentModal, setShowOpponentModal] = useState(false);
  const [opponentSearch, setOpponentSearch] = useState('');
  
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Current turn in 1v1 mode ('player' or 'opponent')
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');

  // Standard challenge state (10 tirs) - Player
  const [shots, setShots] = useState<ChallengeShot[]>([]);
  const [currentShot, setCurrentShot] = useState(1);
  const [editingShotIndex, setEditingShotIndex] = useState<number | null>(null);

  // Standard challenge state (10 tirs) - Opponent (1v1)
  const [opponentShots, setOpponentShots] = useState<ChallengeShot[]>([]);
  const [opponentCurrentShot, setOpponentCurrentShot] = useState(1);
  const [editingOpponentShotIndex, setEditingOpponentShotIndex] = useState<number | null>(null);

  // Precision challenge state - Player
  const [precisionShots, setPrecisionShots] = useState<PrecisionShot[]>([]);
  const [currentAtelierIndex, setCurrentAtelierIndex] = useState(0);
  const [currentDistanceIndex, setCurrentDistanceIndex] = useState(0);
  const [shotTimerRunning, setShotTimerRunning] = useState(false);
  const [shotStartTime, setShotStartTime] = useState(0);
  const [editingPrecisionIndex, setEditingPrecisionIndex] = useState<number | null>(null);

  // Precision challenge state - Opponent (1v1)
  const [opponentPrecisionShots, setOpponentPrecisionShots] = useState<PrecisionShot[]>([]);
  const [opponentAtelierIndex, setOpponentAtelierIndex] = useState(0);
  const [opponentDistanceIndex, setOpponentDistanceIndex] = useState(0);

  // Advanced notation state
  const [showAdvancedNotation, setShowAdvancedNotation] = useState(false);
  const [advancedShotRecords, setAdvancedShotRecords] = useState<AdvancedShotRecord[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = selectedType ? CHALLENGE_CONFIG[selectedType] : null;
  
  // Player stats
  const successCount = shots.filter(s => s.success).length;
  const carreauCount = shots.filter(s => s.carreau).length;
  const successRate = shots.length > 0 ? Math.round((successCount / shots.length) * 100) : 0;
  const totalPrecisionPoints = precisionShots.reduce((sum, s) => sum + s.points, 0);

  // Opponent stats (1v1)
  const opponentSuccessCount = opponentShots.filter(s => s.success).length;
  const opponentCarreauCount = opponentShots.filter(s => s.carreau).length;
  const opponentSuccessRate = opponentShots.length > 0 ? Math.round((opponentSuccessCount / opponentShots.length) * 100) : 0;
  const opponentTotalPrecisionPoints = opponentPrecisionShots.reduce((sum, s) => sum + s.points, 0);

  const currentAtelier = PRECISION_ATELIERS[currentAtelierIndex];
  const currentDistance = PRECISION_DISTANCES[currentDistanceIndex];
  const currentPrecisionShotNumber = currentAtelierIndex * 4 + currentDistanceIndex + 1;

  const opponentAtelier = PRECISION_ATELIERS[opponentAtelierIndex];
  const opponentDistance = PRECISION_DISTANCES[opponentDistanceIndex];
  const opponentPrecisionShotNumber = opponentAtelierIndex * 4 + opponentDistanceIndex + 1;

  // Calculate atelier scores
  const atelierScores = PRECISION_ATELIERS.reduce((acc, atelier) => {
    const atelierShots = precisionShots.filter(s => s.atelier === atelier.id);
    acc[atelier.id] = atelierShots.reduce((sum, s) => sum + s.points, 0);
    return acc;
  }, {} as { [key in PrecisionAtelier]: number });

  const opponentAtelierScores = PRECISION_ATELIERS.reduce((acc, atelier) => {
    const atelierShots = opponentPrecisionShots.filter(s => s.atelier === atelier.id);
    acc[atelier.id] = atelierShots.reduce((sum, s) => sum + s.points, 0);
    return acc;
  }, {} as { [key in PrecisionAtelier]: number });

  // Filter players for opponent selection
  const filteredPlayers = players.filter(p => {
    if (selfPlayer && p.id === selfPlayer.id) return false;
    if (!opponentSearch) return true;
    return p.name.toLowerCase().includes(opponentSearch.toLowerCase());
  });

  // Timer effect
  useEffect(() => {
    if (isStarted && !isFinished) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isStarted, isFinished]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startChallenge = () => {
    if (!selectedType || !challengeMode) return;
    if (challengeMode === '1v1' && !selectedOpponent) {
      Alert.alert('Erreur', 'Sélectionnez un adversaire pour le mode 1v1');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsStarted(true);
    setShots([]);
    setOpponentShots([]);
    setPrecisionShots([]);
    setOpponentPrecisionShots([]);
    setCurrentShot(1);
    setOpponentCurrentShot(1);
    setCurrentAtelierIndex(0);
    setCurrentDistanceIndex(0);
    setOpponentAtelierIndex(0);
    setOpponentDistanceIndex(0);
    setElapsedTime(0);
    setIsFinished(false);
    setCurrentTurn('player');
    
    if (selectedType === 'precision') {
      setShotTimerRunning(false);
      setShotStartTime(0);
    }
  };

  const startShotTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShotTimerRunning(true);
    setShotStartTime(Date.now());
  }, []);

  // Check if challenge is complete
  const checkChallengeComplete = useCallback(() => {
    if (!config) return false;
    
    if (challengeMode === 'solo') {
      if (selectedType === 'precision') {
        return precisionShots.length >= 20;
      }
      return shots.length >= config.totalShots;
    } else {
      // 1v1 mode - both players must complete
      if (selectedType === 'precision') {
        return precisionShots.length >= 20 && opponentPrecisionShots.length >= 20;
      }
      return shots.length >= config.totalShots && opponentShots.length >= config.totalShots;
    }
  }, [challengeMode, config, selectedType, shots, opponentShots, precisionShots, opponentPrecisionShots]);

  // Standard challenge shot recording
  const recordShot = useCallback((success: boolean, carreau: boolean = false, isOpponent: boolean = false) => {
    if (!config || selectedType === 'precision') return;

    Haptics.impactAsync(success ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    if (isOpponent) {
      // Opponent shot
      if (editingOpponentShotIndex !== null) {
        setOpponentShots(prev => prev.map((shot, idx) => 
          idx === editingOpponentShotIndex 
            ? { ...shot, success, carreau: success && carreau ? true : undefined }
            : shot
        ));
        setEditingOpponentShotIndex(null);
        return;
      }

      if (opponentShots.length >= config.totalShots) return;

      const newShot: ChallengeShot = {
        number: opponentCurrentShot,
        success,
        carreau: success && carreau ? true : undefined,
        timestamp: new Date().toISOString(),
      };

      setOpponentShots(prev => [...prev, newShot]);

      if (opponentCurrentShot >= config.totalShots) {
        // Opponent finished
        if (shots.length >= config.totalShots) {
          // Both finished
          setIsFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setCurrentTurn('player');
        }
      } else {
        setOpponentCurrentShot(prev => prev + 1);
      }
    } else {
      // Player shot
      if (editingShotIndex !== null) {
        setShots(prev => prev.map((shot, idx) => 
          idx === editingShotIndex 
            ? { ...shot, success, carreau: success && carreau ? true : undefined }
            : shot
        ));
        setEditingShotIndex(null);
        return;
      }

      if (shots.length >= config.totalShots) return;

      const newShot: ChallengeShot = {
        number: currentShot,
        success,
        carreau: success && carreau ? true : undefined,
        timestamp: new Date().toISOString(),
      };

      setShots(prev => [...prev, newShot]);

      if (currentShot >= config.totalShots) {
        if (challengeMode === 'solo') {
          setIsFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          // 1v1: check if opponent is done
          if (opponentShots.length >= config.totalShots) {
            setIsFinished(true);
            if (timerRef.current) clearInterval(timerRef.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            setCurrentTurn('opponent');
          }
        }
      } else {
        setCurrentShot(prev => prev + 1);
      }
    }
  }, [config, currentShot, opponentCurrentShot, selectedType, editingShotIndex, editingOpponentShotIndex, challengeMode, shots, opponentShots]);

  // Precision challenge shot recording
  const recordPrecisionShot = useCallback((points: 0 | 1 | 3 | 5, isOpponent: boolean = false) => {
    if (!isStarted || selectedType !== 'precision') return;

    Haptics.impactAsync(points >= 3 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    if (isOpponent) {
      if (editingPrecisionIndex !== null) {
        setOpponentPrecisionShots(prev => prev.map((shot, idx) => 
          idx === editingPrecisionIndex ? { ...shot, points } : shot
        ));
        setEditingPrecisionIndex(null);
        return;
      }

      if (opponentPrecisionShots.length >= 20) return;

      setShotTimerRunning(false);
      const timeUsed = Math.round((Date.now() - shotStartTime) / 1000);

      const newShot: PrecisionShot = {
        atelier: opponentAtelier.id,
        distance: opponentDistance,
        points,
        timeUsed: Math.min(timeUsed, 30),
        timestamp: new Date().toISOString(),
      };

      setOpponentPrecisionShots(prev => [...prev, newShot]);

      // Advance opponent position
      const newOpponentShotCount = opponentPrecisionShots.length + 1;
      if (opponentDistanceIndex < 3) {
        setOpponentDistanceIndex(prev => prev + 1);
      } else if (opponentAtelierIndex < 4) {
        setOpponentAtelierIndex(prev => prev + 1);
        setOpponentDistanceIndex(0);
      }
      
      // Check if both finished
      if (newOpponentShotCount >= 20 && precisionShots.length >= 20) {
        setIsFinished(true);
        if (timerRef.current) clearInterval(timerRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (newOpponentShotCount >= 20) {
        // Opponent finished but player hasn't - switch to player
        setCurrentTurn('player');
      } else if (precisionShots.length < 20) {
        // In 1v1 mode, alternate shot by shot
        setCurrentTurn('player');
      }
      
      setShotTimerRunning(false);
      setShotStartTime(0);
    } else {
      if (editingPrecisionIndex !== null) {
        setPrecisionShots(prev => prev.map((shot, idx) => 
          idx === editingPrecisionIndex ? { ...shot, points } : shot
        ));
        setEditingPrecisionIndex(null);
        return;
      }

      if (precisionShots.length >= 20) return;

      setShotTimerRunning(false);
      const timeUsed = Math.round((Date.now() - shotStartTime) / 1000);

      const newShot: PrecisionShot = {
        atelier: currentAtelier.id,
        distance: currentDistance,
        points,
        timeUsed: Math.min(timeUsed, 30),
        timestamp: new Date().toISOString(),
      };

      setPrecisionShots(prev => [...prev, newShot]);

      // Advance player position
      const newPlayerShotCount = precisionShots.length + 1;
      if (currentDistanceIndex < 3) {
        setCurrentDistanceIndex(prev => prev + 1);
      } else if (currentAtelierIndex < 4) {
        setCurrentAtelierIndex(prev => prev + 1);
        setCurrentDistanceIndex(0);
      }
      
      // Check completion and turn switching
      if (challengeMode === 'solo') {
        if (newPlayerShotCount >= 20) {
          setIsFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        // 1v1 mode - alternate shot by shot
        if (newPlayerShotCount >= 20 && opponentPrecisionShots.length >= 20) {
          setIsFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (newPlayerShotCount >= 20) {
          // Player finished but opponent hasn't - switch to opponent
          setCurrentTurn('opponent');
        } else if (opponentPrecisionShots.length < 20) {
          // Alternate to opponent's turn
          setCurrentTurn('opponent');
        }
      }
      
      setShotTimerRunning(false);
      setShotStartTime(0);
    }
  }, [isStarted, selectedType, currentAtelier, currentDistance, currentAtelierIndex, currentDistanceIndex, 
      opponentAtelier, opponentDistance, opponentAtelierIndex, opponentDistanceIndex, shotStartTime, 
      editingPrecisionIndex, challengeMode, precisionShots, opponentPrecisionShots]);

  const handleTimeUp = useCallback(() => {
    recordPrecisionShot(0, currentTurn === 'opponent');
  }, [recordPrecisionShot, currentTurn]);

  // Handle advanced notation for 10 tirs challenge
  const handleAdvancedShotSubmit = useCallback((record: AdvancedShotRecord) => {
    setAdvancedShotRecords(prev => [...prev, record]);
    
    // Record the shot in the normal flow
    const isOpponent = currentTurn === 'opponent';
    recordShot(record.success, record.carreau || false, isOpponent);
    
    setShowAdvancedNotation(false);
  }, [currentTurn, recordShot]);

  // Determine winner for 1v1
  const getWinner = (): 'player' | 'opponent' | 'draw' => {
    if (selectedType === 'precision') {
      if (totalPrecisionPoints > opponentTotalPrecisionPoints) return 'player';
      if (opponentTotalPrecisionPoints > totalPrecisionPoints) return 'opponent';
      return 'draw';
    } else {
      if (successRate > opponentSuccessRate) return 'player';
      if (opponentSuccessRate > successRate) return 'opponent';
      // Tiebreaker: carreaux
      if (carreauCount > opponentCarreauCount) return 'player';
      if (opponentCarreauCount > carreauCount) return 'opponent';
      return 'draw';
    }
  };

  const saveChallenge = () => {
    if (!selectedType || !challengeMode) return;
    
    const opponentResult: ChallengePlayerResult | undefined = challengeMode === '1v1' && selectedOpponent ? {
      playerId: selectedOpponent.id,
      playerName: selectedOpponent.name,
      shots: selectedType !== 'precision' ? opponentShots : undefined,
      precisionShots: selectedType === 'precision' ? opponentPrecisionShots : undefined,
      successCount: opponentSuccessCount,
      totalShots: opponentShots.length,
      carreauCount: opponentCarreauCount,
      successRate: opponentSuccessRate,
      totalPoints: selectedType === 'precision' ? opponentTotalPrecisionPoints : undefined,
      atelierScores: selectedType === 'precision' ? opponentAtelierScores : undefined,
    } : undefined;

    const winner = challengeMode === '1v1' ? getWinner() : undefined;

    if (selectedType === 'precision') {
      addChallenge({
        type: selectedType,
        mode: challengeMode,
        date: new Date().toISOString(),
        playerId: selfPlayer?.id || userStats.playerId,
        playerName: selfPlayer?.name || userStats.playerName,
        opponentId: selectedOpponent?.id,
        opponentName: selectedOpponent?.name,
        opponentResult,
        winner,
        precisionShots,
        totalPoints: totalPrecisionPoints,
        maxPoints: 100,
        atelierScores,
        duration: elapsedTime,
      });
    } else {
      addChallenge({
        type: selectedType,
        mode: challengeMode,
        date: new Date().toISOString(),
        playerId: selfPlayer?.id || userStats.playerId,
        playerName: selfPlayer?.name || userStats.playerName,
        opponentId: selectedOpponent?.id,
        opponentName: selectedOpponent?.name,
        opponentResult,
        winner,
        shots,
        successCount,
        totalShots: shots.length,
        carreauCount,
        successRate,
        duration: elapsedTime,
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const resetChallenge = () => {
    Alert.alert(
      'Recommencer',
      'Voulez-vous recommencer ce défi ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Recommencer',
          onPress: () => {
            setIsStarted(false);
            setShots([]);
            setOpponentShots([]);
            setPrecisionShots([]);
            setOpponentPrecisionShots([]);
            setCurrentShot(1);
            setOpponentCurrentShot(1);
            setCurrentAtelierIndex(0);
            setCurrentDistanceIndex(0);
            setOpponentAtelierIndex(0);
            setOpponentDistanceIndex(0);
            setElapsedTime(0);
            setIsFinished(false);
            setShotTimerRunning(false);
            setEditingShotIndex(null);
            setEditingOpponentShotIndex(null);
            setEditingPrecisionIndex(null);
            setCurrentTurn('player');
          },
        },
      ]
    );
  };

  // Challenge Type Selection Screen
  if (!selectedType) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Nouveau Défi</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400)} style={styles.introSection}>
            <MaterialIcons name="emoji-events" size={48} color={theme.primary} />
            <Text style={styles.introTitle}>Choisissez votre défi</Text>
            <Text style={styles.introText}>
              Entraînez-vous et suivez votre progression avec nos défis de tir
            </Text>
          </Animated.View>

          {Object.entries(CHALLENGE_CONFIG).map(([type, config], index) => (
            <Animated.View
              key={type}
              entering={FadeInDown.duration(400).delay(100 + index * 100)}
            >
              <Pressable
                style={styles.challengeTypeCard}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedType(type as ChallengeType);
                }}
              >
                <View style={[styles.challengeTypeIcon, { backgroundColor: config.color + '20' }]}>
                  <MaterialIcons name={config.icon} size={32} color={config.color} />
                </View>
                <View style={styles.challengeTypeInfo}>
                  <Text style={styles.challengeTypeName}>{config.name}</Text>
                  <Text style={styles.challengeTypeDesc}>{config.description}</Text>
                  <View style={styles.challengeTypeMeta}>
                    <MaterialIcons name="sports" size={14} color={theme.textMuted} />
                    <Text style={styles.challengeTypeMetaText}>
                      {type === 'precision' ? '5 ateliers • 4 distances' : `${config.totalShots} tirs`}
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
              </Pressable>
            </Animated.View>
          ))}

          <Animated.View 
            entering={FadeInDown.duration(400).delay(400)}
            style={styles.rulesCard}
          >
            <View style={styles.rulesHeader}>
              <MaterialIcons name="info-outline" size={20} color={theme.primary} />
              <Text style={styles.rulesTitle}>Règles Tir de Précision</Text>
            </View>
            <Text style={styles.rulesText}>
              • 5 ateliers différents avec règles spécifiques{'\n'}
              • 4 tirs par atelier (6m, 7m, 8m, 9m){'\n'}
              • 30 secondes par tir{'\n'}
              • Points selon le résultat (0, 1, 3 ou 5 pts){'\n'}
              • Maximum 100 points
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Mode Selection Screen (Solo / 1v1)
  if (!challengeMode) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => setSelectedType(null)}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{config?.name}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.modeSelectionContainer}>
          {/* Challenge type badge */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.modeHeaderBadge}>
            <View style={[styles.modeHeaderIcon, { backgroundColor: config?.color + '20' }]}>
              <MaterialIcons name={config?.icon || 'sports'} size={24} color={config?.color} />
            </View>
            <Text style={styles.modeHeaderText}>{config?.name}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(100)}>
            <Text style={styles.modeSelectionTitle}>Comment voulez-vous jouer ?</Text>
          </Animated.View>

          {/* Mode Cards - Large and prominent */}
          <View style={styles.modeCardsGrid}>
            {/* Solo Mode Card */}
            <Animated.View entering={ZoomIn.duration(400).delay(200)} style={styles.modeCardWrapper}>
              <Pressable
                style={[styles.modeCardLarge, styles.modeCardSolo]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setChallengeMode('solo');
                }}
              >
                <View style={styles.modeCardLargeIconContainer}>
                  <View style={[styles.modeCardLargeIcon, { backgroundColor: theme.primary }]}>
                    <MaterialIcons name="person" size={48} color="#FFF" />
                  </View>
                </View>
                <Text style={styles.modeCardLargeName}>Solo</Text>
                <Text style={styles.modeCardLargeDesc}>Entraînement personnel</Text>
                <View style={styles.modeCardLargeFeatures}>
                  <View style={styles.modeCardFeature}>
                    <MaterialIcons name="timer" size={14} color={theme.textSecondary} />
                    <Text style={styles.modeCardFeatureText}>Chronométré</Text>
                  </View>
                  <View style={styles.modeCardFeature}>
                    <MaterialIcons name="trending-up" size={14} color={theme.textSecondary} />
                    <Text style={styles.modeCardFeatureText}>Battez vos records</Text>
                  </View>
                </View>
                <View style={[styles.modeCardStartButton, { backgroundColor: theme.primary }]}>
                  <Text style={styles.modeCardStartText}>Commencer</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
                </View>
              </Pressable>
            </Animated.View>

            {/* 1v1 Mode Card */}
            <Animated.View entering={ZoomIn.duration(400).delay(300)} style={styles.modeCardWrapper}>
              <Pressable
                style={[styles.modeCardLarge, styles.modeCard1v1]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setChallengeMode('1v1');
                }}
              >
                <View style={styles.modeCardLargeIconContainer}>
                  <View style={[styles.modeCardLargeIcon, { backgroundColor: theme.accent }]}>
                    <MaterialIcons name="people" size={48} color="#FFF" />
                  </View>
                  <View style={styles.vsIndicator}>
                    <Text style={styles.vsText}>VS</Text>
                  </View>
                </View>
                <Text style={styles.modeCardLargeName}>1 contre 1</Text>
                <Text style={styles.modeCardLargeDesc}>Défiez un adversaire</Text>
                <View style={styles.modeCardLargeFeatures}>
                  <View style={styles.modeCardFeature}>
                    <MaterialIcons name="swap-horiz" size={14} color={theme.textSecondary} />
                    <Text style={styles.modeCardFeatureText}>Tour par tour</Text>
                  </View>
                  <View style={styles.modeCardFeature}>
                    <MaterialIcons name="emoji-events" size={14} color={theme.textSecondary} />
                    <Text style={styles.modeCardFeatureText}>Gagnant déclaré</Text>
                  </View>
                </View>
                <View style={[styles.modeCardStartButton, { backgroundColor: theme.accent }]}>
                  <Text style={styles.modeCardStartText}>Choisir adversaire</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
                </View>
              </Pressable>
            </Animated.View>
          </View>

          {/* Quick tip */}
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.modeTipCard}>
            <MaterialIcons name="lightbulb" size={18} color={theme.warning} />
            <Text style={styles.modeTipText}>
              Les scores sont enregistrés et comptabilisés dans vos statistiques
            </Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // Opponent Selection for 1v1
  if (challengeMode === '1v1' && !selectedOpponent && !isStarted) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => setChallengeMode(null)}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Choisir adversaire</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* 1v1 Header Banner */}
        <View style={styles.opponent1v1Banner}>
          <View style={styles.opponent1v1BannerContent}>
            <View style={styles.opponent1v1Players}>
              <View style={styles.opponent1v1PlayerBadge}>
                <MaterialIcons name="person" size={20} color="#FFF" />
              </View>
              <View style={styles.opponent1v1VsBadge}>
                <Text style={styles.opponent1v1VsText}>VS</Text>
              </View>
              <View style={[styles.opponent1v1PlayerBadge, styles.opponent1v1PlayerBadgeEmpty]}>
                <MaterialIcons name="help-outline" size={20} color={theme.accent} />
              </View>
            </View>
            <Text style={styles.opponent1v1BannerTitle}>Qui sera votre adversaire ?</Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={opponentSearch}
            onChangeText={setOpponentSearch}
            placeholder="Rechercher un joueur..."
            placeholderTextColor={theme.textMuted}
          />
          {opponentSearch.length > 0 && (
            <Pressable onPress={() => setOpponentSearch('')}>
              <MaterialIcons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32, paddingTop: 8 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredPlayers.length > 0 ? (
            filteredPlayers.map((player, index) => (
              <Animated.View
                key={player.id}
                entering={FadeInDown.duration(300).delay(index * 50)}
              >
                <Pressable
                  style={styles.opponentPlayerCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedOpponent(player);
                  }}
                >
                  <View style={styles.opponentPlayerAvatar}>
                    <Text style={styles.opponentPlayerInitials}>
                      {player.name.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View style={styles.opponentPlayerInfo}>
                    <Text style={styles.opponentPlayerName}>{player.name}</Text>
                    <View style={styles.opponentPlayerMeta}>
                      <View style={styles.opponentPlayerMetaItem}>
                        <MaterialIcons name="location-city" size={12} color={theme.textMuted} />
                        <Text style={styles.opponentPlayerMetaText}>
                          {player.club || 'Sans club'}
                        </Text>
                      </View>
                      <View style={styles.opponentPlayerMetaDot} />
                      <View style={styles.opponentPlayerMetaItem}>
                        <MaterialIcons name="sports" size={12} color={theme.textMuted} />
                        <Text style={styles.opponentPlayerMetaText}>{player.role}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.opponentSelectButton}>
                    <Text style={styles.opponentSelectText}>Défier</Text>
                  </View>
                </Pressable>
              </Animated.View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="person-search" size={48} color={theme.textMuted} />
              <Text style={styles.emptyStateText}>
                {opponentSearch ? 'Aucun joueur trouvé' : 'Aucun joueur disponible'}
              </Text>
              <Pressable 
                style={styles.createPlayerButton}
                onPress={() => router.push('/player/new')}
              >
                <MaterialIcons name="person-add" size={18} color={theme.primary} />
                <Text style={styles.createPlayerButtonText}>Créer un joueur</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Precision Challenge Ready Screen
  if (selectedType === 'precision' && !isStarted) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => {
            if (challengeMode === '1v1') setSelectedOpponent(null);
            else setChallengeMode(null);
          }}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Tir de Précision</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={ZoomIn.duration(400)} style={styles.precisionReadyHeader}>
            <View style={[styles.readyIcon, { backgroundColor: theme.carreauColor + '20' }]}>
              <MaterialIcons name="stars" size={64} color={theme.carreauColor} />
            </View>
            <Text style={styles.readyTitle}>Tir de Précision</Text>
            <Text style={styles.readyDescription}>
              Épreuve officielle FFPJP{'\n'}20 tirs • 5 ateliers • Max 100 points
            </Text>
            
            {/* Mode badge */}
            <View style={[styles.modeBadge, challengeMode === '1v1' && styles.modeBadge1v1]}>
              <MaterialIcons 
                name={challengeMode === 'solo' ? 'person' : 'people'} 
                size={16} 
                color={challengeMode === 'solo' ? theme.primary : theme.accent} 
              />
              <Text style={[styles.modeBadgeText, challengeMode === '1v1' && styles.modeBadgeText1v1]}>
                {challengeMode === 'solo' ? 'Solo' : `vs ${selectedOpponent?.name}`}
              </Text>
            </View>
          </Animated.View>

          <Text style={styles.sectionTitle}>LES 5 ATELIERS</Text>
          {PRECISION_ATELIERS.map((atelier, index) => (
            <Animated.View 
              key={atelier.id}
              entering={FadeInDown.duration(400).delay(100 + index * 80)}
            >
              <View style={styles.atelierPreviewCard}>
                <View style={[styles.atelierPreviewIcon, { backgroundColor: theme.primary + '15' }]}>
                  <MaterialIcons name={atelier.icon as any} size={24} color={theme.primary} />
                </View>
                <View style={styles.atelierPreviewInfo}>
                  <Text style={styles.atelierPreviewName}>{atelier.name}</Text>
                  <Text style={styles.atelierPreviewDesc}>{atelier.description}</Text>
                </View>
                <View style={styles.atelierPreviewDistances}>
                  <Text style={styles.atelierPreviewDistText}>6-9m</Text>
                </View>
              </View>
            </Animated.View>
          ))}

          <Animated.View 
            entering={FadeInDown.duration(400).delay(500)}
            style={styles.scoringCard}
          >
            <Text style={styles.scoringTitle}>BARÈME DE POINTS</Text>
            <Text style={styles.scoringSubtitle}>
              Le pointage varie selon l'atelier. Consultez les règles spécifiques pendant le défi.
            </Text>
            <View style={styles.scoringGrid}>
              <View style={styles.scoringItem}>
                <View style={[styles.scoringBadge, { backgroundColor: theme.carreauColor }]}>
                  <Text style={styles.scoringPoints}>5</Text>
                </View>
                <Text style={styles.scoringLabel}>Carreau/Sorti</Text>
              </View>
              <View style={styles.scoringItem}>
                <View style={[styles.scoringBadge, { backgroundColor: theme.success }]}>
                  <Text style={styles.scoringPoints}>3</Text>
                </View>
                <Text style={styles.scoringLabel}>Sorti/Touché</Text>
              </View>
              <View style={styles.scoringItem}>
                <View style={[styles.scoringBadge, { backgroundColor: theme.warning }]}>
                  <Text style={styles.scoringPoints}>1</Text>
                </View>
                <Text style={styles.scoringLabel}>Touché</Text>
              </View>
              <View style={styles.scoringItem}>
                <View style={[styles.scoringBadge, { backgroundColor: theme.error }]}>
                  <Text style={styles.scoringPoints}>0</Text>
                </View>
                <Text style={styles.scoringLabel}>Raté</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.startButton} onPress={startChallenge}>
            <MaterialIcons name="play-arrow" size={28} color="#FFF" />
            <Text style={styles.startButtonText}>Commencer le défi</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Standard Challenge Ready Screen (10 tirs)
  if (selectedType !== 'precision' && !isStarted) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => {
            if (challengeMode === '1v1') setSelectedOpponent(null);
            else setChallengeMode(null);
          }}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{config?.name}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.readyContainer}>
          <Animated.View entering={ZoomIn.duration(400)} style={styles.readyContent}>
            <View style={[styles.readyIcon, { backgroundColor: config?.color + '20' }]}>
              <MaterialIcons name={config?.icon || 'sports'} size={64} color={config?.color} />
            </View>
            <Text style={styles.readyTitle}>{config?.name}</Text>
            <Text style={styles.readyDescription}>{config?.description}</Text>
            
            {/* Mode badge */}
            <View style={[styles.modeBadge, challengeMode === '1v1' && styles.modeBadge1v1]}>
              <MaterialIcons 
                name={challengeMode === 'solo' ? 'person' : 'people'} 
                size={16} 
                color={challengeMode === 'solo' ? theme.primary : theme.accent} 
              />
              <Text style={[styles.modeBadgeText, challengeMode === '1v1' && styles.modeBadgeText1v1]}>
                {challengeMode === 'solo' ? 'Solo' : `vs ${selectedOpponent?.name}`}
              </Text>
            </View>
            
            <View style={styles.readyStats}>
              <View style={styles.readyStatItem}>
                <Text style={styles.readyStatValue}>{config?.totalShots}</Text>
                <Text style={styles.readyStatLabel}>Tirs</Text>
              </View>
              {challengeMode === '1v1' && (
                <View style={styles.readyStatItem}>
                  <Text style={styles.readyStatValue}>2</Text>
                  <Text style={styles.readyStatLabel}>Joueurs</Text>
                </View>
              )}
            </View>
          </Animated.View>

          <Pressable style={styles.startButton} onPress={startChallenge}>
            <MaterialIcons name="play-arrow" size={28} color="#FFF" />
            <Text style={styles.startButtonText}>Commencer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Results Screen - Standard Challenge
  if (selectedType !== 'precision' && isFinished) {
    const winner = challengeMode === '1v1' ? getWinner() : null;
    
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Résultats</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* 1v1 Winner Banner */}
          {challengeMode === '1v1' && (
            <Animated.View entering={FadeInDown.duration(400)} style={[
              styles.winnerBanner,
              winner === 'player' && styles.winnerBannerWin,
              winner === 'opponent' && styles.winnerBannerLose,
              winner === 'draw' && styles.winnerBannerDraw,
            ]}>
              <MaterialIcons 
                name={winner === 'draw' ? 'handshake' : winner === 'player' ? 'emoji-events' : 'sentiment-dissatisfied'} 
                size={32} 
                color="#FFF" 
              />
              <Text style={styles.winnerBannerText}>
                {winner === 'draw' ? 'Égalité !' : winner === 'player' ? 'Victoire !' : `${selectedOpponent?.name} gagne !`}
              </Text>
            </Animated.View>
          )}

          {/* Player Results */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.resultsCard}>
            {challengeMode === '1v1' && (
              <View style={styles.resultsPlayerHeader}>
                <MaterialIcons name="person" size={20} color={theme.primary} />
                <Text style={styles.resultsPlayerName}>{selfPlayer?.name || userStats.playerName}</Text>
                {winner === 'player' && <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />}
              </View>
            )}
            
            <View style={[
              styles.resultsBadge, 
              { backgroundColor: successRate >= 70 ? theme.success : successRate >= 50 ? theme.warning : theme.error }
            ]}>
              <Text style={styles.resultsBadgeText}>
                {successRate >= 70 ? 'Excellent !' : successRate >= 50 ? 'Bien !' : 'À améliorer'}
              </Text>
            </View>

            <Text style={styles.resultsScore}>{successRate}%</Text>
            <Text style={styles.resultsLabel}>Taux de réussite</Text>

            <View style={styles.resultsGrid}>
              <View style={styles.resultsGridItem}>
                <MaterialIcons name="check-circle" size={24} color={theme.success} />
                <Text style={styles.resultsGridValue}>{successCount}</Text>
                <Text style={styles.resultsGridLabel}>Réussis</Text>
              </View>
              <View style={styles.resultsGridItem}>
                <MaterialIcons name="cancel" size={24} color={theme.error} />
                <Text style={styles.resultsGridValue}>{shots.length - successCount}</Text>
                <Text style={styles.resultsGridLabel}>Ratés</Text>
              </View>
              <View style={styles.resultsGridItem}>
                <MaterialIcons name="stars" size={24} color={theme.carreauColor} />
                <Text style={styles.resultsGridValue}>{carreauCount}</Text>
                <Text style={styles.resultsGridLabel}>Carreaux</Text>
              </View>
              <View style={styles.resultsGridItem}>
                <MaterialIcons name="timer" size={24} color={theme.primary} />
                <Text style={styles.resultsGridValue}>{formatTime(elapsedTime)}</Text>
                <Text style={styles.resultsGridLabel}>Durée</Text>
              </View>
            </View>
          </Animated.View>

          {/* Opponent Results (1v1) */}
          {challengeMode === '1v1' && selectedOpponent && (
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.resultsCard}>
              <View style={styles.resultsPlayerHeader}>
                <MaterialIcons name="person" size={20} color={theme.accent} />
                <Text style={[styles.resultsPlayerName, { color: theme.accent }]}>{selectedOpponent.name}</Text>
                {winner === 'opponent' && <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />}
              </View>
              
              <View style={[
                styles.resultsBadge, 
                { backgroundColor: opponentSuccessRate >= 70 ? theme.success : opponentSuccessRate >= 50 ? theme.warning : theme.error }
              ]}>
                <Text style={styles.resultsBadgeText}>
                  {opponentSuccessRate >= 70 ? 'Excellent !' : opponentSuccessRate >= 50 ? 'Bien !' : 'À améliorer'}
                </Text>
              </View>

              <Text style={styles.resultsScore}>{opponentSuccessRate}%</Text>
              <Text style={styles.resultsLabel}>Taux de réussite</Text>

              <View style={styles.resultsGrid}>
                <View style={styles.resultsGridItem}>
                  <MaterialIcons name="check-circle" size={24} color={theme.success} />
                  <Text style={styles.resultsGridValue}>{opponentSuccessCount}</Text>
                  <Text style={styles.resultsGridLabel}>Réussis</Text>
                </View>
                <View style={styles.resultsGridItem}>
                  <MaterialIcons name="cancel" size={24} color={theme.error} />
                  <Text style={styles.resultsGridValue}>{opponentShots.length - opponentSuccessCount}</Text>
                  <Text style={styles.resultsGridLabel}>Ratés</Text>
                </View>
                <View style={styles.resultsGridItem}>
                  <MaterialIcons name="stars" size={24} color={theme.carreauColor} />
                  <Text style={styles.resultsGridValue}>{opponentCarreauCount}</Text>
                  <Text style={styles.resultsGridLabel}>Carreaux</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Actions */}
          <View style={styles.resultsActions}>
            <Pressable style={styles.retryButton} onPress={resetChallenge}>
              <MaterialIcons name="refresh" size={20} color={theme.primary} />
              <Text style={styles.retryButtonText}>Recommencer</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={saveChallenge}>
              <MaterialIcons name="save" size={20} color="#FFF" />
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Results Screen - Precision Challenge
  if (selectedType === 'precision' && isFinished) {
    const winner = challengeMode === '1v1' ? getWinner() : null;
    const percentage = Math.round((totalPrecisionPoints / 100) * 100);
    const opponentPercentage = Math.round((opponentTotalPrecisionPoints / 100) * 100);
    
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Résultats</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* 1v1 Winner Banner */}
          {challengeMode === '1v1' && (
            <Animated.View entering={FadeInDown.duration(400)} style={[
              styles.winnerBanner,
              winner === 'player' && styles.winnerBannerWin,
              winner === 'opponent' && styles.winnerBannerLose,
              winner === 'draw' && styles.winnerBannerDraw,
            ]}>
              <MaterialIcons 
                name={winner === 'draw' ? 'handshake' : winner === 'player' ? 'emoji-events' : 'sentiment-dissatisfied'} 
                size={32} 
                color="#FFF" 
              />
              <Text style={styles.winnerBannerText}>
                {winner === 'draw' ? 'Égalité !' : winner === 'player' ? 'Victoire !' : `${selectedOpponent?.name} gagne !`}
              </Text>
            </Animated.View>
          )}

          {/* Player Results */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.resultsCard}>
            {challengeMode === '1v1' && (
              <View style={styles.resultsPlayerHeader}>
                <MaterialIcons name="person" size={20} color={theme.primary} />
                <Text style={styles.resultsPlayerName}>{selfPlayer?.name || userStats.playerName}</Text>
                {winner === 'player' && <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />}
              </View>
            )}
            
            <View style={[
              styles.resultsBadge, 
              { backgroundColor: percentage >= 70 ? theme.success : percentage >= 50 ? theme.warning : theme.error }
            ]}>
              <Text style={styles.resultsBadgeText}>
                {percentage >= 70 ? 'Excellent !' : percentage >= 50 ? 'Bien !' : 'À améliorer'}
              </Text>
            </View>

            <Text style={styles.resultsScore}>{totalPrecisionPoints}</Text>
            <Text style={styles.resultsScoreMax}>/ 100 points</Text>

            <View style={styles.resultsGrid}>
              <View style={styles.resultsGridItem}>
                <MaterialIcons name="timer" size={24} color={theme.primary} />
                <Text style={styles.resultsGridValue}>{formatTime(elapsedTime)}</Text>
                <Text style={styles.resultsGridLabel}>Durée totale</Text>
              </View>
              <View style={styles.resultsGridItem}>
                <MaterialIcons name="stars" size={24} color={theme.carreauColor} />
                <Text style={styles.resultsGridValue}>
                  {precisionShots.filter(s => s.points === 5).length}
                </Text>
                <Text style={styles.resultsGridLabel}>Carreaux</Text>
              </View>
            </View>
          </Animated.View>

          {/* Opponent Results (1v1) */}
          {challengeMode === '1v1' && selectedOpponent && (
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.resultsCard}>
              <View style={styles.resultsPlayerHeader}>
                <MaterialIcons name="person" size={20} color={theme.accent} />
                <Text style={[styles.resultsPlayerName, { color: theme.accent }]}>{selectedOpponent.name}</Text>
                {winner === 'opponent' && <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />}
              </View>
              
              <View style={[
                styles.resultsBadge, 
                { backgroundColor: opponentPercentage >= 70 ? theme.success : opponentPercentage >= 50 ? theme.warning : theme.error }
              ]}>
                <Text style={styles.resultsBadgeText}>
                  {opponentPercentage >= 70 ? 'Excellent !' : opponentPercentage >= 50 ? 'Bien !' : 'À améliorer'}
                </Text>
              </View>

              <Text style={styles.resultsScore}>{opponentTotalPrecisionPoints}</Text>
              <Text style={styles.resultsScoreMax}>/ 100 points</Text>

              <View style={styles.resultsGrid}>
                <View style={styles.resultsGridItem}>
                  <MaterialIcons name="stars" size={24} color={theme.carreauColor} />
                  <Text style={styles.resultsGridValue}>
                    {opponentPrecisionShots.filter(s => s.points === 5).length}
                  </Text>
                  <Text style={styles.resultsGridLabel}>Carreaux</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Actions */}
          <View style={styles.resultsActions}>
            <Pressable style={styles.retryButton} onPress={resetChallenge}>
              <MaterialIcons name="refresh" size={20} color={theme.primary} />
              <Text style={styles.retryButtonText}>Recommencer</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={saveChallenge}>
              <MaterialIcons name="save" size={20} color="#FFF" />
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // In Progress - Precision Challenge
  if (selectedType === 'precision' && isStarted && !isFinished) {
    const isOpponentTurn = currentTurn === 'opponent';
    const displayAtelier = isOpponentTurn ? opponentAtelier : currentAtelier;
    const displayDistance = isOpponentTurn ? opponentDistance : currentDistance;
    const displayShotNumber = isOpponentTurn ? opponentPrecisionShotNumber : currentPrecisionShotNumber;
    const displayTotalPoints = isOpponentTurn ? opponentTotalPrecisionPoints : totalPrecisionPoints;
    
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={resetChallenge}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Tir de Précision</Text>
          <View style={styles.timerBadge}>
            <MaterialIcons name="timer" size={16} color={theme.primary} />
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>

        {/* Turn indicator for 1v1 */}
        {challengeMode === '1v1' && (
          <View style={[styles.turnIndicator, isOpponentTurn && styles.turnIndicatorOpponent]}>
            <MaterialIcons name="person" size={18} color="#FFF" />
            <Text style={styles.turnIndicatorText}>
              {isOpponentTurn ? `Tour de ${selectedOpponent?.name}` : 'Votre tour'}
            </Text>
          </View>
        )}

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.precisionGameContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(300)} style={styles.currentAtelierCard}>
            <View style={styles.currentAtelierHeader}>
              <View style={[styles.currentAtelierIcon, { backgroundColor: theme.primary + '20' }]}>
                <MaterialIcons name={displayAtelier.icon as any} size={28} color={theme.primary} />
              </View>
              <View style={styles.currentAtelierInfo}>
                <Text style={styles.currentAtelierName}>{displayAtelier.name}</Text>
                <Text style={styles.currentAtelierDesc}>{displayAtelier.description}</Text>
              </View>
            </View>
            <View style={styles.currentDistanceBadge}>
              <Text style={styles.currentDistanceText}>{displayDistance}m</Text>
            </View>
          </Animated.View>

          <View style={styles.precisionProgress}>
            <Text style={styles.precisionProgressText}>
              Tir {displayShotNumber} / 20
            </Text>
            <View style={styles.precisionProgressBar}>
              <View 
                style={[
                  styles.precisionProgressFill, 
                  { width: `${((displayShotNumber - 1) / 20) * 100}%` }
                ]} 
              />
            </View>
          </View>

          <CountdownTimer 
            seconds={30} 
            isRunning={shotTimerRunning}
            onStart={startShotTimer}
            onTimeUp={handleTimeUp}
          />

          <View style={styles.currentScoreCard}>
            <Text style={styles.currentScoreLabel}>
              {challengeMode === '1v1' ? (isOpponentTurn ? `Score ${selectedOpponent?.name}` : 'Votre score') : 'Score actuel'}
            </Text>
            <Text style={styles.currentScoreValue}>{displayTotalPoints}</Text>
            <Text style={styles.currentScoreMax}>/ 100 pts</Text>
          </View>

          {/* Scores comparison for 1v1 */}
          {challengeMode === '1v1' && (
            <View style={styles.scoresComparison}>
              <View style={styles.scoreCompareItem}>
                <Text style={styles.scoreCompareName}>Vous</Text>
                <Text style={[styles.scoreCompareValue, !isOpponentTurn && styles.scoreCompareValueActive]}>
                  {totalPrecisionPoints}
                </Text>
              </View>
              <Text style={styles.scoreCompareSeparator}>-</Text>
              <View style={styles.scoreCompareItem}>
                <Text style={styles.scoreCompareName}>{selectedOpponent?.name?.split(' ')[0]}</Text>
                <Text style={[styles.scoreCompareValue, isOpponentTurn && styles.scoreCompareValueActive]}>
                  {opponentTotalPrecisionPoints}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.precisionButtonsContainer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.scoringButtonsTitle}>Résultat du tir</Text>
          <View style={styles.scoringButtonsGrid}>
            {displayAtelier.scoringOptions.map((option, index) => {
              const bgColors: { [key: number]: string } = {
                0: theme.error,
                1: theme.warning,
                3: theme.success,
                5: theme.carreauColor,
              };
              return (
                <Pressable 
                  key={index}
                  style={[styles.scoringButtonLarge, { backgroundColor: bgColors[option.points] }]}
                  onPress={() => recordPrecisionShot(option.points, isOpponentTurn)}
                >
                  <Text style={styles.scoringButtonPointsLarge}>{option.points}</Text>
                  <Text style={styles.scoringButtonLabelLarge}>{option.label}</Text>
                  <Text style={styles.scoringButtonDesc} numberOfLines={2}>{option.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // In Progress - Standard Challenge (10 tirs)
  const isOpponentTurn = currentTurn === 'opponent';
  const displayCurrentShot = isOpponentTurn ? opponentCurrentShot : currentShot;
  const displayShots = isOpponentTurn ? opponentShots : shots;
  const displaySuccessCount = isOpponentTurn ? opponentSuccessCount : successCount;
  const displayCarreauCount = isOpponentTurn ? opponentCarreauCount : carreauCount;
  
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={resetChallenge}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{config?.name}</Text>
        <View style={styles.timerBadge}>
          <MaterialIcons name="timer" size={16} color={theme.primary} />
          <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
        </View>
      </View>

      {/* Turn indicator for 1v1 */}
      {challengeMode === '1v1' && (
        <View style={[styles.turnIndicator, isOpponentTurn && styles.turnIndicatorOpponent]}>
          <MaterialIcons name="person" size={18} color="#FFF" />
          <Text style={styles.turnIndicatorText}>
            {isOpponentTurn ? `Tour de ${selectedOpponent?.name}` : 'Votre tour'}
          </Text>
        </View>
      )}

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${(displayCurrentShot / (config?.totalShots || 10)) * 100}%`, backgroundColor: config?.color }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Tir {displayCurrentShot} / {config?.totalShots}
        </Text>
      </View>

      {/* Shot indicators */}
      <View style={styles.shotsIndicator}>
        {Array.from({ length: config?.totalShots || 10 }).map((_, index) => {
          const shot = displayShots[index];
          return (
            <View
              key={index}
              style={[
                styles.shotIndicatorDot,
                index < displayShots.length && shot?.success && { backgroundColor: shot.carreau ? theme.carreauColor : theme.success },
                index < displayShots.length && !shot?.success && { backgroundColor: theme.error },
                index === displayCurrentShot - 1 && displayShots.length < (config?.totalShots || 10) && { backgroundColor: config?.color, transform: [{ scale: 1.2 }] },
              ]}
            >
              {shot?.carreau && (
                <MaterialIcons name="star" size={8} color="#FFF" />
              )}
            </View>
          );
        })}
      </View>

      {/* Current stats */}
      <View style={styles.currentStats}>
        <View style={styles.currentStatItem}>
          <Text style={[styles.currentStatValue, { color: theme.success }]}>{displaySuccessCount}</Text>
          <Text style={styles.currentStatLabel}>Réussis</Text>
        </View>
        <View style={styles.currentStatDivider} />
        <View style={styles.currentStatItem}>
          <Text style={[styles.currentStatValue, { color: theme.error }]}>{displayShots.length - displaySuccessCount}</Text>
          <Text style={styles.currentStatLabel}>Ratés</Text>
        </View>
        <View style={styles.currentStatDivider} />
        <View style={styles.currentStatItem}>
          <Text style={[styles.currentStatValue, { color: theme.carreauColor }]}>{displayCarreauCount}</Text>
          <Text style={styles.currentStatLabel}>Carreaux</Text>
        </View>
      </View>

      {/* Scores comparison for 1v1 */}
      {challengeMode === '1v1' && (
        <View style={styles.scoresComparison}>
          <View style={styles.scoreCompareItem}>
            <Text style={styles.scoreCompareName}>Vous</Text>
            <Text style={[styles.scoreCompareValue, !isOpponentTurn && styles.scoreCompareValueActive]}>
              {successCount}/{shots.length}
            </Text>
          </View>
          <Text style={styles.scoreCompareSeparator}>vs</Text>
          <View style={styles.scoreCompareItem}>
            <Text style={styles.scoreCompareName}>{selectedOpponent?.name?.split(' ')[0]}</Text>
            <Text style={[styles.scoreCompareValue, isOpponentTurn && styles.scoreCompareValueActive]}>
              {opponentSuccessCount}/{opponentShots.length}
            </Text>
          </View>
        </View>
      )}

      {/* Shot buttons */}
      <View style={styles.shotButtonsContainer}>
        <Text style={styles.shotButtonsTitle}>
          {challengeMode === '1v1' ? (isOpponentTurn ? `Tir de ${selectedOpponent?.name}` : 'Votre tir') : 'Ce tir est...'}
        </Text>
        
        <View style={styles.shotButtonsRow}>
          <Pressable
            style={[styles.shotButton, styles.shotButtonFail]}
            onPress={() => recordShot(false, false, isOpponentTurn)}
          >
            <MaterialIcons name="close" size={48} color="#FFF" />
            <Text style={styles.shotButtonText}>Raté</Text>
          </Pressable>

          <Pressable
            style={[styles.shotButton, styles.shotButtonSuccess]}
            onPress={() => recordShot(true, false, isOpponentTurn)}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setShowAdvancedNotation(true);
            }}
          >
            <MaterialIcons name="check" size={48} color="#FFF" />
            <Text style={styles.shotButtonText}>Réussi</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.carreauButton]}
          onPress={() => recordShot(true, true, isOpponentTurn)}
        >
          <MaterialIcons name="stars" size={24} color={theme.carreauColor} />
          <Text style={styles.carreauButtonText}>Carreau !</Text>
        </Pressable>

        {/* Hint for advanced notation */}
        <Text style={styles.advancedHintText}>Appui long sur "Réussi" = notation détaillée</Text>
      </View>

      {/* Advanced Shot Notation Modal */}
      <AdvancedShotNotation
        visible={showAdvancedNotation}
        onClose={() => setShowAdvancedNotation(false)}
        actionType="tir"
        playerId={isOpponentTurn ? (selectedOpponent?.id || '') : (selfPlayer?.id || userStats.playerId)}
        playerName={isOpponentTurn ? (selectedOpponent?.name || 'Adversaire') : (selfPlayer?.name || userStats.playerName)}
        team={isOpponentTurn ? 'B' : 'A'}
        onSubmit={handleAdvancedShotSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.borderRadius.full },
  timerText: { fontSize: 14, fontWeight: '600', color: theme.primary, fontVariant: ['tabular-nums'] },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24 },
  introSection: { alignItems: 'center', paddingVertical: 32 },
  introTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginTop: 16, marginBottom: 8 },
  introText: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', paddingHorizontal: 24 },
  challengeTypeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 12, ...theme.shadows.card },
  challengeTypeIcon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  challengeTypeInfo: { flex: 1 },
  challengeTypeName: { fontSize: 17, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  challengeTypeDesc: { fontSize: 13, color: theme.textSecondary, marginBottom: 8 },
  challengeTypeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  challengeTypeMetaText: { fontSize: 12, color: theme.textMuted },
  rulesCard: { backgroundColor: theme.primary + '10', borderRadius: theme.borderRadius.lg, padding: 16, marginTop: 12, borderWidth: 1, borderColor: theme.primary + '30' },
  rulesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  rulesTitle: { fontSize: 14, fontWeight: '600', color: theme.primary },
  rulesText: { fontSize: 13, color: theme.textSecondary, lineHeight: 22 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.borderRadius.full, marginTop: 16 },
  modeBadge1v1: { backgroundColor: theme.accent + '15' },
  modeBadgeText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  modeBadgeText1v1: { color: theme.accent },
  modeSelectionContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  modeHeaderBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 10, backgroundColor: theme.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.borderRadius.full, marginBottom: 20, ...theme.shadows.card },
  modeHeaderIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modeHeaderText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  modeSelectionTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', marginBottom: 24 },
  modeCardsGrid: { flexDirection: 'row', gap: 12 },
  modeCardWrapper: { flex: 1 },
  modeCardLarge: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', ...theme.shadows.cardElevated },
  modeCardSolo: { borderColor: theme.primary + '30' },
  modeCard1v1: { borderColor: theme.accent + '30' },
  modeCardLargeIconContainer: { position: 'relative', marginBottom: 12 },
  modeCardLargeIcon: { width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  vsIndicator: { position: 'absolute', bottom: -4, right: -4, backgroundColor: theme.warning, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.surface },
  vsText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  modeCardLargeName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  modeCardLargeDesc: { fontSize: 13, color: theme.textSecondary, marginBottom: 12 },
  modeCardLargeFeatures: { width: '100%', gap: 6, marginBottom: 14 },
  modeCardFeature: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeCardFeatureText: { fontSize: 12, color: theme.textSecondary },
  modeCardStartButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', paddingVertical: 12, borderRadius: theme.borderRadius.md },
  modeCardStartText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  modeTipCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.warning + '15', paddingHorizontal: 14, paddingVertical: 12, borderRadius: theme.borderRadius.md, marginTop: 20 },
  modeTipText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 18 },
  opponent1v1Banner: { backgroundColor: theme.accent, paddingVertical: 16, paddingHorizontal: 16 },
  opponent1v1BannerContent: { alignItems: 'center' },
  opponent1v1Players: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  opponent1v1PlayerBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  opponent1v1PlayerBadgeEmpty: { backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.accent },
  opponent1v1VsBadge: { backgroundColor: theme.warning, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.sm },
  opponent1v1VsText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  opponent1v1BannerTitle: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, marginHorizontal: 16, marginTop: 16, paddingHorizontal: 14, borderRadius: theme.borderRadius.md, gap: 10, ...theme.shadows.card },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: theme.textPrimary },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { fontSize: 15, color: theme.textMuted, marginTop: 12 },
  opponentPlayerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border, ...theme.shadows.card },
  opponentPlayerAvatar: { width: 52, height: 52, borderRadius: 14, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  opponentPlayerInitials: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  opponentPlayerInfo: { flex: 1 },
  opponentPlayerName: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  opponentPlayerMeta: { flexDirection: 'row', alignItems: 'center' },
  opponentPlayerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  opponentPlayerMetaText: { fontSize: 12, color: theme.textMuted },
  opponentPlayerMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted, marginHorizontal: 8 },
  opponentSelectButton: { backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.borderRadius.md },
  opponentSelectText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  createPlayerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: theme.primary + '15', borderRadius: theme.borderRadius.md },
  createPlayerButtonText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  turnIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 10 },
  turnIndicatorOpponent: { backgroundColor: theme.accent },
  turnIndicatorText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  winnerBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16, borderRadius: theme.borderRadius.lg, marginBottom: 16 },
  winnerBannerWin: { backgroundColor: theme.success },
  winnerBannerLose: { backgroundColor: theme.error },
  winnerBannerDraw: { backgroundColor: theme.warning },
  winnerBannerText: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  resultsPlayerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  resultsPlayerName: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.primary },
  scoresComparison: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, marginHorizontal: 16, marginVertical: 12, paddingVertical: 16, borderRadius: theme.borderRadius.lg, ...theme.shadows.card },
  scoreCompareItem: { alignItems: 'center', paddingHorizontal: 24 },
  scoreCompareName: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  scoreCompareValue: { fontSize: 24, fontWeight: '700', color: theme.textMuted },
  scoreCompareValueActive: { color: theme.primary },
  scoreCompareSeparator: { fontSize: 18, fontWeight: '600', color: theme.textMuted, paddingHorizontal: 8 },
  durationCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.surface, paddingVertical: 14, borderRadius: theme.borderRadius.md, marginTop: 8, ...theme.shadows.card },
  durationText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  precisionReadyHeader: { alignItems: 'center', paddingVertical: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1, marginBottom: 12, marginTop: 24 },
  atelierPreviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 8, ...theme.shadows.card },
  atelierPreviewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  atelierPreviewInfo: { flex: 1 },
  atelierPreviewName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  atelierPreviewDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  atelierPreviewDistances: { backgroundColor: theme.backgroundSecondary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.borderRadius.sm },
  atelierPreviewDistText: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  scoringCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginTop: 24, ...theme.shadows.card },
  scoringTitle: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  scoringSubtitle: { fontSize: 12, color: theme.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  scoringGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  scoringItem: { alignItems: 'center' },
  scoringBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  scoringPoints: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  scoringLabel: { fontSize: 12, color: theme.textSecondary },
  bottomAction: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  readyContainer: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 32 },
  readyContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  readyIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  readyTitle: { fontSize: 28, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  readyDescription: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 24 },
  readyStats: { flexDirection: 'row', gap: 32 },
  readyStatItem: { alignItems: 'center' },
  readyStatValue: { fontSize: 36, fontWeight: '700', color: theme.primary },
  readyStatLabel: { fontSize: 14, color: theme.textSecondary },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 18, borderRadius: theme.borderRadius.md, ...theme.shadows.card },
  startButtonText: { fontSize: 18, fontWeight: '600', color: '#FFF' },
  progressContainer: { paddingHorizontal: 16, paddingVertical: 16 },
  progressBar: { height: 8, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, textAlign: 'center' },
  shotsIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 24 },
  shotIndicatorDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  currentStats: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface, marginHorizontal: 16, paddingVertical: 16, borderRadius: theme.borderRadius.lg, ...theme.shadows.card },
  currentStatItem: { flex: 1, alignItems: 'center' },
  currentStatValue: { fontSize: 28, fontWeight: '700' },
  currentStatLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 4 },
  currentStatDivider: { width: 1, height: 40, backgroundColor: theme.border },
  shotButtonsContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 24, justifyContent: 'center' },
  shotButtonsTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, textAlign: 'center', marginBottom: 20 },
  shotButtonsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  shotButton: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: theme.borderRadius.lg, ...theme.shadows.cardElevated },
  shotButtonFail: { backgroundColor: theme.error },
  shotButtonSuccess: { backgroundColor: theme.success },
  shotButtonText: { fontSize: 18, fontWeight: '600', color: '#FFF', marginTop: 8 },
  carreauButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.carreauColor + '15', paddingVertical: 16, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: theme.carreauColor },
  carreauButtonText: { fontSize: 16, fontWeight: '600', color: theme.carreauColor },
  advancedHintText: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
  precisionGameContent: { paddingHorizontal: 16, paddingTop: 16 },
  currentAtelierCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16, ...theme.shadows.card },
  currentAtelierHeader: { flexDirection: 'row', alignItems: 'center' },
  currentAtelierIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  currentAtelierInfo: { flex: 1 },
  currentAtelierName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  currentAtelierDesc: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  currentDistanceBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: theme.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.borderRadius.md },
  currentDistanceText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  precisionProgress: { marginBottom: 16 },
  precisionProgressText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, textAlign: 'center', marginBottom: 8 },
  precisionProgressBar: { height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden' },
  precisionProgressFill: { height: '100%', backgroundColor: theme.primary, borderRadius: 3 },
  countdownContainer: { alignItems: 'center', marginBottom: 20 },
  countdownCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, marginBottom: 12 },
  countdownText: { fontSize: 36, fontWeight: '700' },
  countdownLabel: { fontSize: 12, color: theme.textMuted, marginTop: -4 },
  countdownBar: { width: '100%', height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' },
  countdownBarFill: { height: '100%', borderRadius: 2 },
  startTimerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.success, paddingVertical: 14, paddingHorizontal: 24, borderRadius: theme.borderRadius.md, marginTop: 16 },
  startTimerButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  currentScoreCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 20, alignItems: 'center', marginBottom: 20, ...theme.shadows.card },
  currentScoreLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  currentScoreValue: { fontSize: 48, fontWeight: '700', color: theme.primary },
  currentScoreMax: { fontSize: 16, color: theme.textMuted },
  precisionButtonsContainer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  scoringButtonsTitle: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, textAlign: 'center', marginBottom: 12 },
  scoringButtonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  scoringButtonLarge: { width: '48%', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 10, borderRadius: theme.borderRadius.md, minHeight: 100, ...theme.shadows.card },
  scoringButtonPointsLarge: { fontSize: 28, fontWeight: '700', color: '#FFF' },
  scoringButtonLabelLarge: { fontSize: 13, fontWeight: '700', color: '#FFF', marginTop: 2 },
  scoringButtonDesc: { fontSize: 10, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 4, lineHeight: 13 },
  resultsCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 24, alignItems: 'center', marginBottom: 12, ...theme.shadows.cardElevated },
  resultsBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.borderRadius.full, marginBottom: 16 },
  resultsBadgeText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  resultsScore: { fontSize: 72, fontWeight: '700', color: theme.textPrimary },
  resultsScoreMax: { fontSize: 18, color: theme.textMuted, marginTop: -8 },
  resultsLabel: { fontSize: 16, color: theme.textSecondary, marginBottom: 24 },
  resultsGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  resultsGridItem: { width: '50%', alignItems: 'center', paddingVertical: 16 },
  resultsGridValue: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginTop: 8 },
  resultsGridLabel: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
  resultsActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  retryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.surface, paddingVertical: 16, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: theme.primary },
  retryButtonText: { fontSize: 16, fontWeight: '600', color: theme.primary },
  saveButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: theme.borderRadius.md },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
});
