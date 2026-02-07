import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withTiming, withSequence, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { 
  ChallengeType, 
  ChallengeShot,
  PrecisionAtelier,
  PrecisionDistance,
  PrecisionShot,
  PRECISION_ATELIERS,
  PRECISION_DISTANCES,
  PrecisionAtelierConfig,
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

  // Keep callback ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Reset timer when not running (after recording a shot)
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
            // Use ref to avoid stale closure
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
  const { type: initialType } = useLocalSearchParams<{ type?: ChallengeType }>();
  const { addChallenge, userStats, selfPlayer } = useApp();

  const [selectedType, setSelectedType] = useState<ChallengeType | null>(initialType || null);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Standard challenge state (10 tirs)
  const [shots, setShots] = useState<ChallengeShot[]>([]);
  const [currentShot, setCurrentShot] = useState(1);
  const [editingShotIndex, setEditingShotIndex] = useState<number | null>(null);

  // Precision challenge state
  const [precisionShots, setPrecisionShots] = useState<PrecisionShot[]>([]);
  const [currentAtelierIndex, setCurrentAtelierIndex] = useState(0);
  const [currentDistanceIndex, setCurrentDistanceIndex] = useState(0);
  const [shotTimerRunning, setShotTimerRunning] = useState(false);
  const [shotStartTime, setShotStartTime] = useState(0);
  const [editingPrecisionIndex, setEditingPrecisionIndex] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const config = selectedType ? CHALLENGE_CONFIG[selectedType] : null;
  
  // Standard challenge stats
  const successCount = shots.filter(s => s.success).length;
  const carreauCount = shots.filter(s => s.carreau).length;
  const successRate = shots.length > 0 ? Math.round((successCount / shots.length) * 100) : 0;

  // Precision challenge stats
  const totalPrecisionPoints = precisionShots.reduce((sum, s) => sum + s.points, 0);
  const currentAtelier = PRECISION_ATELIERS[currentAtelierIndex];
  const currentDistance = PRECISION_DISTANCES[currentDistanceIndex];
  const currentPrecisionShotNumber = currentAtelierIndex * 4 + currentDistanceIndex + 1;

  // Calculate atelier scores
  const atelierScores = PRECISION_ATELIERS.reduce((acc, atelier) => {
    const atelierShots = precisionShots.filter(s => s.atelier === atelier.id);
    acc[atelier.id] = atelierShots.reduce((sum, s) => sum + s.points, 0);
    return acc;
  }, {} as { [key in PrecisionAtelier]: number });

  // Timer effect for total duration
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
    if (!selectedType) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsStarted(true);
    setShots([]);
    setPrecisionShots([]);
    setCurrentShot(1);
    setCurrentAtelierIndex(0);
    setCurrentDistanceIndex(0);
    setElapsedTime(0);
    setIsFinished(false);
    
    if (selectedType === 'precision') {
      // Don't auto-start timer - user will start manually
      setShotTimerRunning(false);
      setShotStartTime(0);
    }
  };

  // Manual start of shot timer for precision challenge
  const startShotTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShotTimerRunning(true);
    setShotStartTime(Date.now());
  }, []);

  // Standard challenge shot recording
  const recordShot = useCallback((success: boolean, carreau: boolean = false) => {
    if (!config || selectedType === 'precision') return;

    Haptics.impactAsync(success ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    // If editing an existing shot
    if (editingShotIndex !== null) {
      setShots(prev => prev.map((shot, idx) => 
        idx === editingShotIndex 
          ? { ...shot, success, carreau: success && carreau ? true : undefined }
          : shot
      ));
      setEditingShotIndex(null);
      return;
    }

    if (isFinished) return;

    const newShot: ChallengeShot = {
      number: currentShot,
      success,
      carreau: success && carreau ? true : undefined,
      timestamp: new Date().toISOString(),
    };

    setShots(prev => [...prev, newShot]);

    if (currentShot >= config.totalShots) {
      setIsFinished(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setCurrentShot(prev => prev + 1);
    }
  }, [config, currentShot, isFinished, selectedType, editingShotIndex]);

  // Precision challenge shot recording
  const recordPrecisionShot = useCallback((points: 0 | 1 | 3 | 5) => {
    if (!isStarted || selectedType !== 'precision') return;

    Haptics.impactAsync(points >= 3 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    // If editing an existing shot
    if (editingPrecisionIndex !== null) {
      setPrecisionShots(prev => prev.map((shot, idx) => 
        idx === editingPrecisionIndex 
          ? { ...shot, points }
          : shot
      ));
      setEditingPrecisionIndex(null);
      return;
    }

    if (isFinished) return;

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

    // Move to next shot - don't auto-start timer, user will start manually
    if (currentDistanceIndex < 3) {
      // Next distance in same atelier
      setCurrentDistanceIndex(prev => prev + 1);
      setShotTimerRunning(false);
      setShotStartTime(0);
    } else if (currentAtelierIndex < 4) {
      // Next atelier
      setCurrentAtelierIndex(prev => prev + 1);
      setCurrentDistanceIndex(0);
      setShotTimerRunning(false);
      setShotStartTime(0);
    } else {
      // Challenge finished
      setIsFinished(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isStarted, isFinished, selectedType, currentAtelier, currentDistance, currentAtelierIndex, currentDistanceIndex, shotStartTime, editingPrecisionIndex]);

  const handleTimeUp = useCallback(() => {
    // Auto-record 0 points when time runs out
    recordPrecisionShot(0);
  }, [recordPrecisionShot]);

  const saveChallenge = () => {
    if (!selectedType) return;

    if (selectedType === 'precision') {
      addChallenge({
        type: selectedType,
        date: new Date().toISOString(),
        playerId: selfPlayer?.id || userStats.playerId,
        playerName: selfPlayer?.name || userStats.playerName,
        precisionShots,
        totalPoints: totalPrecisionPoints,
        maxPoints: 100,
        atelierScores,
        duration: elapsedTime,
      });
    } else {
      addChallenge({
        type: selectedType,
        date: new Date().toISOString(),
        playerId: selfPlayer?.id || userStats.playerId,
        playerName: selfPlayer?.name || userStats.playerName,
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
            setPrecisionShots([]);
            setCurrentShot(1);
            setCurrentAtelierIndex(0);
            setCurrentDistanceIndex(0);
            setElapsedTime(0);
            setIsFinished(false);
            setShotTimerRunning(false);
            setEditingShotIndex(null);
            setEditingPrecisionIndex(null);
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

          {/* Precision rules info */}
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

  // Precision Challenge Ready Screen
  if (selectedType === 'precision' && !isStarted) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => setSelectedType(null)}>
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
          </Animated.View>

          {/* Ateliers list */}
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

          {/* Scoring info */}
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
          <Pressable style={styles.closeButton} onPress={() => setSelectedType(null)}>
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
            <View style={styles.readyStats}>
              <View style={styles.readyStatItem}>
                <Text style={styles.readyStatValue}>{config?.totalShots}</Text>
                <Text style={styles.readyStatLabel}>Tirs</Text>
              </View>
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

  // Precision Challenge Results Screen
  if (selectedType === 'precision' && isFinished) {
    const percentage = Math.round((totalPrecisionPoints / 100) * 100);
    
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
          <Animated.View entering={FadeInDown.duration(400)} style={styles.resultsCard}>
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

          {/* Atelier scores breakdown */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>DÉTAIL PAR ATELIER</Text>
            {PRECISION_ATELIERS.map((atelier, index) => {
              const score = atelierScores[atelier.id] || 0;
              const maxScore = 20;
              const atelierShotsList = precisionShots.filter(s => s.atelier === atelier.id);
              
              return (
                <Animated.View 
                  key={atelier.id}
                  entering={FadeInDown.duration(300).delay(250 + index * 50)}
                >
                  <View style={styles.atelierResultCard}>
                    <View style={styles.atelierResultHeader}>
                      <View style={[styles.atelierResultIcon, { backgroundColor: theme.primary + '15' }]}>
                        <MaterialIcons name={atelier.icon as any} size={20} color={theme.primary} />
                      </View>
                      <Text style={styles.atelierResultName}>{atelier.name}</Text>
                      <Text style={styles.atelierResultScore}>
                        <Text style={{ fontWeight: '700', color: theme.primary }}>{score}</Text>
                        <Text style={{ color: theme.textMuted }}>/20</Text>
                      </Text>
                    </View>
                    <View style={styles.atelierShotsRow}>
                      {atelierShotsList.map((shot, i) => (
                        <View 
                          key={i}
                          style={[
                            styles.atelierShotDot,
                            { backgroundColor: 
                              shot.points === 5 ? theme.carreauColor :
                              shot.points === 3 ? theme.success :
                              shot.points === 1 ? theme.warning : theme.error
                            }
                          ]}
                        >
                          <Text style={styles.atelierShotPoints}>{shot.points}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.atelierDistanceLabels}>
                      {PRECISION_DISTANCES.map(d => (
                        <Text key={d} style={styles.atelierDistanceLabel}>{d}m</Text>
                      ))}
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </Animated.View>

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

  // Standard Challenge Results Screen (10 tirs)
  if (selectedType !== 'precision' && isFinished) {
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
          <Animated.View entering={FadeInDown.duration(400)} style={styles.resultsCard}>
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

          {/* Shot history */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>DÉTAIL DES TIRS</Text>
            <View style={styles.shotsHistoryCard}>
              <View style={styles.shotsGrid}>
                {shots.map((shot, index) => (
                  <Animated.View
                    key={index}
                    entering={FadeIn.duration(200).delay(index * 50)}
                    style={[
                      styles.shotDot,
                      { backgroundColor: shot.success ? (shot.carreau ? theme.carreauColor : theme.success) : theme.error }
                    ]}
                  >
                    {shot.carreau && (
                      <MaterialIcons name="star" size={12} color="#FFF" />
                    )}
                  </Animated.View>
                ))}
              </View>
            </View>
          </Animated.View>

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

  // Precision Challenge In Progress
  if (selectedType === 'precision' && isStarted && !isFinished) {
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

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.precisionGameContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current atelier info */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.currentAtelierCard}>
            <View style={styles.currentAtelierHeader}>
              <View style={[styles.currentAtelierIcon, { backgroundColor: theme.primary + '20' }]}>
                <MaterialIcons name={currentAtelier.icon as any} size={28} color={theme.primary} />
              </View>
              <View style={styles.currentAtelierInfo}>
                <Text style={styles.currentAtelierName}>{currentAtelier.name}</Text>
                <Text style={styles.currentAtelierDesc}>{currentAtelier.description}</Text>
              </View>
            </View>
            <View style={styles.currentDistanceBadge}>
              <Text style={styles.currentDistanceText}>{currentDistance}m</Text>
            </View>
          </Animated.View>

          {/* Progress indicator */}
          <View style={styles.precisionProgress}>
            <Text style={styles.precisionProgressText}>
              Tir {currentPrecisionShotNumber} / 20
            </Text>
            <View style={styles.precisionProgressBar}>
              <View 
                style={[
                  styles.precisionProgressFill, 
                  { width: `${((currentPrecisionShotNumber - 1) / 20) * 100}%` }
                ]} 
              />
            </View>
          </View>

          {/* Shot timer countdown */}
          <CountdownTimer 
            seconds={30} 
            isRunning={shotTimerRunning}
            onStart={startShotTimer}
            onTimeUp={handleTimeUp}
          />

          {/* Current score */}
          <View style={styles.currentScoreCard}>
            <Text style={styles.currentScoreLabel}>Score actuel</Text>
            <Text style={styles.currentScoreValue}>{totalPrecisionPoints}</Text>
            <Text style={styles.currentScoreMax}>/ 100 pts</Text>
          </View>

          {/* Atelier progress dots - tap to edit */}
          <View style={styles.atelierProgressContainer}>
            {PRECISION_ATELIERS.map((atelier, aIndex) => (
              <View key={atelier.id} style={styles.atelierProgressItem}>
                <View style={[
                  styles.atelierProgressIcon,
                  aIndex === currentAtelierIndex && editingPrecisionIndex === null && styles.atelierProgressIconActive,
                  aIndex < currentAtelierIndex && styles.atelierProgressIconDone
                ]}>
                  {aIndex < currentAtelierIndex ? (
                    <MaterialIcons name="check" size={12} color="#FFF" />
                  ) : (
                    <Text style={[
                      styles.atelierProgressNumber,
                      aIndex === currentAtelierIndex && editingPrecisionIndex === null && styles.atelierProgressNumberActive
                    ]}>
                      {aIndex + 1}
                    </Text>
                  )}
                </View>
                <View style={styles.atelierProgressDots}>
                  {PRECISION_DISTANCES.map((dist, dIndex) => {
                    const shotIndex = aIndex * 4 + dIndex;
                    const shot = precisionShots[shotIndex];
                    const isCurrent = aIndex === currentAtelierIndex && dIndex === currentDistanceIndex && editingPrecisionIndex === null;
                    const isEditing = editingPrecisionIndex === shotIndex;
                    const canEdit = shotIndex < precisionShots.length;
                    
                    return (
                      <Pressable 
                        key={dist}
                        onPress={() => {
                          if (canEdit) {
                            Haptics.selectionAsync();
                            setEditingPrecisionIndex(isEditing ? null : shotIndex);
                          }
                        }}
                        style={[
                          styles.atelierProgressDot,
                          isCurrent && styles.atelierProgressDotCurrent,
                          isEditing && styles.atelierProgressDotEditing,
                          shot && { 
                            backgroundColor: 
                              shot.points === 5 ? theme.carreauColor :
                              shot.points === 3 ? theme.success :
                              shot.points === 1 ? theme.warning : theme.error
                          }
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* Editing indicator for precision */}
          {editingPrecisionIndex !== null && (
            <View style={styles.editingBanner}>
              <MaterialIcons name="edit" size={16} color={theme.warning} />
              <Text style={styles.editingBannerText}>
                Modification : {PRECISION_ATELIERS[Math.floor(editingPrecisionIndex / 4)].name} - {PRECISION_DISTANCES[editingPrecisionIndex % 4]}m
              </Text>
              <Pressable onPress={() => setEditingPrecisionIndex(null)}>
                <MaterialIcons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Scoring buttons - Dynamic based on atelier */}
        <View style={[styles.precisionButtonsContainer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.scoringButtonsTitle}>
            {editingPrecisionIndex !== null 
              ? `Modifier : ${PRECISION_ATELIERS[Math.floor(editingPrecisionIndex / 4)].name} - ${PRECISION_DISTANCES[editingPrecisionIndex % 4]}m`
              : 'Résultat du tir'
            }
          </Text>
          <View style={styles.scoringButtonsGrid}>
            {(editingPrecisionIndex !== null 
              ? PRECISION_ATELIERS[Math.floor(editingPrecisionIndex / 4)].scoringOptions
              : currentAtelier.scoringOptions
            ).map((option, index) => {
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
                  onPress={() => recordPrecisionShot(option.points)}
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

  // Standard Challenge In Progress (10 tirs)
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

      <View style={styles.progressContainer}>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: `${(currentShot / (config?.totalShots || 10)) * 100}%`, backgroundColor: config?.color }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Tir {currentShot} / {config?.totalShots}
        </Text>
      </View>

      {/* Shot indicators - tap to edit */}
      <View style={styles.shotsIndicator}>
        {Array.from({ length: config?.totalShots || 10 }).map((_, index) => {
          const shot = shots[index];
          const isEditing = editingShotIndex === index;
          const canEdit = index < shots.length;
          return (
            <Pressable
              key={index}
              onPress={() => {
                if (canEdit) {
                  Haptics.selectionAsync();
                  setEditingShotIndex(isEditing ? null : index);
                }
              }}
              style={[
                styles.shotIndicatorDot,
                index < currentShot - 1 && shot?.success && { backgroundColor: shot.carreau ? theme.carreauColor : theme.success },
                index < currentShot - 1 && !shot?.success && { backgroundColor: theme.error },
                index === currentShot - 1 && !isFinished && { backgroundColor: config?.color, transform: [{ scale: 1.2 }] },
                isEditing && styles.shotIndicatorEditing,
              ]}
            >
              {shot?.carreau && (
                <MaterialIcons name="star" size={8} color="#FFF" />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Editing indicator */}
      {editingShotIndex !== null && (
        <View style={styles.editingBanner}>
          <MaterialIcons name="edit" size={16} color={theme.warning} />
          <Text style={styles.editingBannerText}>Modification du tir #{editingShotIndex + 1}</Text>
          <Pressable onPress={() => setEditingShotIndex(null)}>
            <MaterialIcons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Current stats */}
      <View style={styles.currentStats}>
        <View style={styles.currentStatItem}>
          <Text style={[styles.currentStatValue, { color: theme.success }]}>{successCount}</Text>
          <Text style={styles.currentStatLabel}>Réussis</Text>
        </View>
        <View style={styles.currentStatDivider} />
        <View style={styles.currentStatItem}>
          <Text style={[styles.currentStatValue, { color: theme.error }]}>{shots.length - successCount}</Text>
          <Text style={styles.currentStatLabel}>Ratés</Text>
        </View>
        <View style={styles.currentStatDivider} />
        <View style={styles.currentStatItem}>
          <Text style={[styles.currentStatValue, { color: theme.carreauColor }]}>{carreauCount}</Text>
          <Text style={styles.currentStatLabel}>Carreaux</Text>
        </View>
      </View>

      {/* Shot buttons */}
      <View style={styles.shotButtonsContainer}>
        <Text style={styles.shotButtonsTitle}>
          {editingShotIndex !== null ? `Modifier le tir #${editingShotIndex + 1}` : 'Ce tir est...'}
        </Text>
        
        <View style={styles.shotButtonsRow}>
          <Pressable
            style={[styles.shotButton, styles.shotButtonFail]}
            onPress={() => recordShot(false)}
          >
            <MaterialIcons name="close" size={48} color="#FFF" />
            <Text style={styles.shotButtonText}>Raté</Text>
          </Pressable>

          <Pressable
            style={[styles.shotButton, styles.shotButtonSuccess]}
            onPress={() => recordShot(true)}
          >
            <MaterialIcons name="check" size={48} color="#FFF" />
            <Text style={styles.shotButtonText}>Réussi</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.carreauButton]}
          onPress={() => recordShot(true, true)}
        >
          <MaterialIcons name="stars" size={24} color={theme.carreauColor} />
          <Text style={styles.carreauButtonText}>Carreau !</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

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
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
    fontVariant: ['tabular-nums'],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  // Type selection
  introSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  introText: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  challengeTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  challengeTypeIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  challengeTypeInfo: {
    flex: 1,
  },
  challengeTypeName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  challengeTypeDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  challengeTypeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  challengeTypeMetaText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  rulesCard: {
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  rulesText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  // Precision ready screen
  precisionReadyHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
  },
  atelierPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  atelierPreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  atelierPreviewInfo: {
    flex: 1,
  },
  atelierPreviewName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  atelierPreviewDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  atelierPreviewDistances: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  atelierPreviewDistText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  scoringCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginTop: 24,
    ...theme.shadows.card,
  },
  scoringTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  scoringSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  scoringGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoringItem: {
    alignItems: 'center',
  },
  scoringBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scoringPoints: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  scoringLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  bottomAction: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  // Ready screen
  readyContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  readyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  readyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  readyDescription: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  readyStats: {
    flexDirection: 'row',
    gap: 32,
  },
  readyStatItem: {
    alignItems: 'center',
  },
  readyStatValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.primary,
  },
  readyStatLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  // Progress
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
  },
  // Shot indicators
  shotsIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  shotIndicatorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shotIndicatorEditing: {
    borderWidth: 3,
    borderColor: theme.warning,
    transform: [{ scale: 1.3 }],
  },
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.warning + '20',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: theme.borderRadius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.warning,
  },
  editingBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.warning,
  },
  // Current stats
  currentStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.card,
  },
  currentStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  currentStatValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  currentStatLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  currentStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: theme.border,
  },
  // Shot buttons
  shotButtonsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    justifyContent: 'center',
  },
  shotButtonsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  shotButtonsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  shotButton: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.cardElevated,
  },
  shotButtonFail: {
    backgroundColor: theme.error,
  },
  shotButtonSuccess: {
    backgroundColor: theme.success,
  },
  shotButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 8,
  },
  carreauButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.carreauColor + '15',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.carreauColor,
  },
  carreauButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.carreauColor,
  },
  // Precision game
  precisionGameContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  currentAtelierCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  currentAtelierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentAtelierIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  currentAtelierInfo: {
    flex: 1,
  },
  currentAtelierName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  currentAtelierDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  currentDistanceBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: theme.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  currentDistanceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  precisionProgress: {
    marginBottom: 16,
  },
  precisionProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  precisionProgressBar: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  precisionProgressFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 3,
  },
  // Countdown timer
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  countdownCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    marginBottom: 12,
  },
  countdownText: {
    fontSize: 36,
    fontWeight: '700',
  },
  countdownLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: -4,
  },
  countdownBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  startTimerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.success,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.borderRadius.md,
    marginTop: 16,
  },
  startTimerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Current score
  currentScoreCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadows.card,
  },
  currentScoreLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  currentScoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.primary,
  },
  currentScoreMax: {
    fontSize: 16,
    color: theme.textMuted,
  },
  // Atelier progress
  atelierProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    marginBottom: 20,
    ...theme.shadows.card,
  },
  atelierProgressItem: {
    alignItems: 'center',
    flex: 1,
  },
  atelierProgressIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  atelierProgressIconActive: {
    backgroundColor: theme.primary,
  },
  atelierProgressIconDone: {
    backgroundColor: theme.success,
  },
  atelierProgressNumber: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
  },
  atelierProgressNumberActive: {
    color: '#FFF',
  },
  atelierProgressDots: {
    flexDirection: 'row',
    gap: 4,
  },
  atelierProgressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.border,
  },
  atelierProgressDotCurrent: {
    backgroundColor: theme.primary,
    transform: [{ scale: 1.2 }],
  },
  atelierProgressDotEditing: {
    borderWidth: 2,
    borderColor: theme.warning,
    transform: [{ scale: 1.4 }],
  },
  // Precision buttons
  precisionButtonsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  scoringButtonsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  scoringButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scoringButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scoringButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  scoringButtonLarge: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.md,
    minHeight: 100,
    ...theme.shadows.card,
  },
  scoringButtonPoints: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  scoringButtonPointsLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
  },
  scoringButtonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 2,
  },
  scoringButtonLabelLarge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 2,
  },
  scoringButtonDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 13,
  },
  // Results
  resultsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.cardElevated,
  },
  resultsBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    marginBottom: 16,
  },
  resultsBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  resultsScore: {
    fontSize: 72,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  resultsScoreMax: {
    fontSize: 18,
    color: theme.textMuted,
    marginTop: -8,
  },
  resultsLabel: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 24,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  resultsGridItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  resultsGridValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginTop: 8,
  },
  resultsGridLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
  },
  // Atelier results
  atelierResultCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  atelierResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  atelierResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  atelierResultName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  atelierResultScore: {
    fontSize: 16,
  },
  atelierShotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  atelierShotDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atelierShotPoints: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  atelierDistanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  atelierDistanceLabel: {
    fontSize: 10,
    color: theme.textMuted,
    width: 36,
    textAlign: 'center',
  },
  // Shot history
  shotsHistoryCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  shotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  shotDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.surface,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
