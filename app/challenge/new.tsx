import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { 
  FadeInDown, 
  FadeIn, 
  ZoomIn, 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  withSequence, 
  Easing 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { SimplifiedShotNotation, SimpleShotRecord } from '@/components';
import ShareModal from '@/components/ui/ShareModal';
import { showInterstitial } from '@/services/adService';
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
  PrecisionAtelierConfig,
  PrecisionScoringOption,
  Player,
} from '@/services/mockData';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ============================================
// COUNTDOWN TIMER COMPONENT
// ============================================

interface CountdownTimerProps {
  seconds: number;
  isRunning: boolean;
  onStart: () => void;
  onTimeUp: () => void;
  startLabel: string;
}

function CountdownTimer({ seconds, isRunning, onStart, onTimeUp, startLabel }: CountdownTimerProps) {
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
      return;
    }

    setTimeLeft(seconds);
    progress.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear });
    
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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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

  const color = timeLeft <= 5 ? theme.error : timeLeft <= 10 ? theme.warning : theme.success;

  return (
    <View style={styles.countdownContainer}>
      <Animated.View style={[styles.countdownCircle, animatedStyle, { borderColor: color }]}>
        <Text style={[styles.countdownText, { color }]}>{timeLeft}</Text>
        <Text style={styles.countdownLabel}>sec</Text>
      </Animated.View>
      <View style={styles.countdownBar}>
        <Animated.View style={[styles.countdownBarFill, progressStyle, { backgroundColor: color }]} />
      </View>
      {!isRunning && (
        <Pressable style={styles.startTimerButton} onPress={onStart}>
          <MaterialIcons name="play-arrow" size={24} color="#FFF" />
          <Text style={styles.startTimerButtonText}>{startLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function NewChallengeScreen() {
  const insets = useSafeAreaInsets();
  const { addChallenge, userStats, selfPlayer, players } = useApp();
  const { t } = useLanguage();
  const { boulesSets } = useApp();

  // ============================================
  // CONFIGURATION (translated)
  // ============================================
  const CHALLENGE_CONFIG = useMemo(() => ({
    '10_tirs': {
      name: t('challenge', 'tenShots'),
      description: t('challenge', 'tenShotsDesc'),
      icon: 'gps-fixed' as const,
      totalShots: 10,
      color: theme.tirColor,
    },
    '10_tirs_sautee': {
      name: t('challenge', 'tenShotsLob'),
      description: t('challenge', 'tenShotsLobDesc'),
      icon: 'sports' as const,
      totalShots: 10,
      color: theme.primary,
    },
    'precision': {
      name: t('challenge', 'precision'),
      description: t('challenge', 'precisionDesc'),
      icon: 'stars' as const,
      totalShots: 20,
      color: theme.carreauColor,
    },
  } as const), [t]);

  // Translated precision ateliers
  const TRANSLATED_ATELIERS = useMemo(() => {
    return PRECISION_ATELIERS.map(atelier => ({
      ...atelier,
      name: t('precisionWorkshops', atelier.id),
      description: t('precisionWorkshops', atelier.id + 'Desc'),
      scoringOptions: atelier.scoringOptions.map(opt => ({
        ...opt,
        label: opt.points === 0 ? t('precisionWorkshops', 'rate') :
               opt.points === 5 ? t('precisionWorkshops', 'carreau') :
               opt.label === 'Touch\u00e9' ? t('precisionWorkshops', 'touche') :
               t('precisionWorkshops', 'sorti'),
        description: t('precisionWorkshops', `${atelier.id}_${opt.points === 0 ? 'rate' : opt.points === 5 ? 'carreau' : opt.label === 'Touch\u00e9' ? 'touche' : 'sorti'}`),
      })),
    }));
  }, [t]);

  // Navigation state
  const [selectedType, setSelectedType] = useState<ChallengeType | null>(null);
  const [challengeMode, setChallengeMode] = useState<ChallengeMode | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedBoulesSetId, setSelectedBoulesSetId] = useState<string | null>(null);
  
  // Challenge state
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTurn, setCurrentTurn] = useState<'player' | 'opponent'>('player');

  // Standard challenge (10 tirs)
  const [shots, setShots] = useState<ChallengeShot[]>([]);
  const [currentShot, setCurrentShot] = useState(1);
  const [opponentShots, setOpponentShots] = useState<ChallengeShot[]>([]);
  const [opponentCurrentShot, setOpponentCurrentShot] = useState(1);

  // Precision challenge
  const [precisionShots, setPrecisionShots] = useState<PrecisionShot[]>([]);
  const [currentAtelierIndex, setCurrentAtelierIndex] = useState(0);
  const [currentDistanceIndex, setCurrentDistanceIndex] = useState(0);
  const [opponentPrecisionShots, setOpponentPrecisionShots] = useState<PrecisionShot[]>([]);
  const [opponentAtelierIndex, setOpponentAtelierIndex] = useState(0);
  const [opponentDistanceIndex, setOpponentDistanceIndex] = useState(0);
  const [shotTimerRunning, setShotTimerRunning] = useState(false);
  const [shotStartTime, setShotStartTime] = useState(0);

  // Notation
  const [showNotation, setShowNotation] = useState(false);
  const [notationRecords, setNotationRecords] = useState<SimpleShotRecord[]>([]);
  const [pendingNotationIsOpponent, setPendingNotationIsOpponent] = useState(false);
  const [savedChallengeIdForShare, setSavedChallengeIdForShare] = useState<string | null>(null);
  const [showPostChallengeShare, setShowPostChallengeShare] = useState(false);
  const [isSavingForShare, setIsSavingForShare] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const config = selectedType ? CHALLENGE_CONFIG[selectedType] : null;

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const playerStats = useMemo(() => ({
    successCount: shots.filter(s => s.success).length,
    carreauCount: shots.filter(s => s.carreau).length,
    successRate: shots.length > 0 ? Math.round((shots.filter(s => s.success).length / shots.length) * 100) : 0,
    totalPrecisionPoints: precisionShots.reduce((sum, s) => sum + s.points, 0),
  }), [shots, precisionShots]);

  const opponentStats = useMemo(() => ({
    successCount: opponentShots.filter(s => s.success).length,
    carreauCount: opponentShots.filter(s => s.carreau).length,
    successRate: opponentShots.length > 0 ? Math.round((opponentShots.filter(s => s.success).length / opponentShots.length) * 100) : 0,
    totalPrecisionPoints: opponentPrecisionShots.reduce((sum, s) => sum + s.points, 0),
  }), [opponentShots, opponentPrecisionShots]);

  const currentAtelier = TRANSLATED_ATELIERS[currentAtelierIndex];
  const currentDistance = PRECISION_DISTANCES[currentDistanceIndex];
  const currentPrecisionShotNumber = currentAtelierIndex * 4 + currentDistanceIndex + 1;

  const opponentAtelier = TRANSLATED_ATELIERS[opponentAtelierIndex];
  const opponentDistance = PRECISION_DISTANCES[opponentDistanceIndex];
  const opponentPrecisionShotNumber = opponentAtelierIndex * 4 + opponentDistanceIndex + 1;

  const atelierScores = useMemo(() => 
    PRECISION_ATELIERS.reduce((acc, atelier) => {
      acc[atelier.id] = precisionShots.filter(s => s.atelier === atelier.id).reduce((sum, s) => sum + s.points, 0);
      return acc;
    }, {} as Record<PrecisionAtelier, number>
  ), [precisionShots]);

  const opponentAtelierScores = useMemo(() => 
    PRECISION_ATELIERS.reduce((acc, atelier) => {
      acc[atelier.id] = opponentPrecisionShots.filter(s => s.atelier === atelier.id).reduce((sum, s) => sum + s.points, 0);
      return acc;
    }, {} as Record<PrecisionAtelier, number>
  ), [opponentPrecisionShots]);

  const filteredPlayers = useMemo(() => {
    let result = players.filter(p => !selfPlayer || p.id !== selfPlayer.id);
    if (playerSearch.trim()) {
      const search = playerSearch.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.club?.toLowerCase().includes(search) ||
        p.role.toLowerCase().includes(search)
      );
    }
    return result;
  }, [players, selfPlayer, playerSearch]);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    if (isStarted && !isFinished) {
      timerRef.current = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, isFinished]);

  // ============================================
  // HANDLERS
  // ============================================

  const startChallenge = useCallback(() => {
    if (!selectedType || !challengeMode) return;
    if (challengeMode === '1v1' && !selectedOpponent) {
      Alert.alert(t('common', 'error'), t('challenge', 'selectOpponent'));
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
    setShotTimerRunning(false);
    setShotStartTime(0);
  }, [selectedType, challengeMode, selectedOpponent, t]);

  const recordShot = useCallback((success: boolean, carreau: boolean = false, isOpponent: boolean = false) => {
    if (!config || selectedType === 'precision') return;

    Haptics.impactAsync(success ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);

    const newShot: ChallengeShot = {
      number: isOpponent ? opponentCurrentShot : currentShot,
      success,
      carreau: success && carreau ? true : undefined,
      timestamp: new Date().toISOString(),
    };

    if (isOpponent) {
      if (opponentShots.length >= config.totalShots) return;
      setOpponentShots(prev => [...prev, newShot]);

      if (opponentCurrentShot >= config.totalShots) {
        if (shots.length >= config.totalShots) {
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
      if (shots.length >= config.totalShots) return;
      setShots(prev => [...prev, newShot]);

      if (currentShot >= config.totalShots) {
        if (challengeMode === 'solo' || opponentShots.length >= config.totalShots) {
          setIsFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setCurrentTurn('opponent');
        }
      } else {
        setCurrentShot(prev => prev + 1);
      }
    }
  }, [config, selectedType, currentShot, opponentCurrentShot, challengeMode, shots, opponentShots]);

  const recordPrecisionShot = useCallback((points: 0 | 1 | 3 | 5, isOpponent: boolean = false) => {
    if (!isStarted || selectedType !== 'precision') return;

    Haptics.impactAsync(points >= 3 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    setShotTimerRunning(false);
    const timeUsed = Math.min(Math.round((Date.now() - shotStartTime) / 1000), 30);

    if (isOpponent) {
      if (opponentPrecisionShots.length >= 20) return;

      const newShot: PrecisionShot = {
        atelier: opponentAtelier.id,
        distance: opponentDistance,
        points,
        timeUsed,
        timestamp: new Date().toISOString(),
      };

      setOpponentPrecisionShots(prev => [...prev, newShot]);
      const newCount = opponentPrecisionShots.length + 1;

      if (opponentDistanceIndex < 3) {
        setOpponentDistanceIndex(prev => prev + 1);
      } else if (opponentAtelierIndex < 4) {
        setOpponentAtelierIndex(prev => prev + 1);
        setOpponentDistanceIndex(0);
      }

      if (newCount >= 20 && precisionShots.length >= 20) {
        setIsFinished(true);
        if (timerRef.current) clearInterval(timerRef.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (newCount >= 20) {
        setCurrentTurn('player');
      } else if (precisionShots.length < 20) {
        setCurrentTurn('player');
      }
    } else {
      if (precisionShots.length >= 20) return;

      const newShot: PrecisionShot = {
        atelier: currentAtelier.id,
        distance: currentDistance,
        points,
        timeUsed,
        timestamp: new Date().toISOString(),
      };

      setPrecisionShots(prev => [...prev, newShot]);
      const newCount = precisionShots.length + 1;

      if (currentDistanceIndex < 3) {
        setCurrentDistanceIndex(prev => prev + 1);
      } else if (currentAtelierIndex < 4) {
        setCurrentAtelierIndex(prev => prev + 1);
        setCurrentDistanceIndex(0);
      }

      if (challengeMode === 'solo') {
        if (newCount >= 20) {
          setIsFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        if (newCount >= 20 && opponentPrecisionShots.length >= 20) {
          setIsFinished(true);
          if (timerRef.current) clearInterval(timerRef.current);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (newCount >= 20) {
          setCurrentTurn('opponent');
        } else if (opponentPrecisionShots.length < 20) {
          setCurrentTurn('opponent');
        }
      }
    }
    setShotStartTime(0);
  }, [isStarted, selectedType, currentAtelier, currentDistance, currentAtelierIndex, currentDistanceIndex,
      opponentAtelier, opponentDistance, opponentAtelierIndex, opponentDistanceIndex, shotStartTime,
      challengeMode, precisionShots, opponentPrecisionShots]);

  const handleTimeUp = useCallback(() => {
    recordPrecisionShot(0, currentTurn === 'opponent');
  }, [recordPrecisionShot, currentTurn]);

  const startShotTimer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShotTimerRunning(true);
    setShotStartTime(Date.now());
  }, []);

  const openNotationModal = useCallback((isOpponent: boolean) => {
    setPendingNotationIsOpponent(isOpponent);
    setShowNotation(true);
  }, []);

  const handleNotationSubmit = useCallback((record: SimpleShotRecord) => {
    setNotationRecords(prev => [...prev, record]);
    recordShot(record.success, record.carreau || false, pendingNotationIsOpponent);
    setShowNotation(false);
    setPendingNotationIsOpponent(false);
  }, [pendingNotationIsOpponent, recordShot]);

  const getWinner = useCallback((): 'player' | 'opponent' | 'draw' => {
    if (selectedType === 'precision') {
      if (playerStats.totalPrecisionPoints > opponentStats.totalPrecisionPoints) return 'player';
      if (opponentStats.totalPrecisionPoints > playerStats.totalPrecisionPoints) return 'opponent';
      return 'draw';
    }
    if (playerStats.successRate > opponentStats.successRate) return 'player';
    if (opponentStats.successRate > playerStats.successRate) return 'opponent';
    if (playerStats.carreauCount > opponentStats.carreauCount) return 'player';
    if (opponentStats.carreauCount > playerStats.carreauCount) return 'opponent';
    return 'draw';
  }, [selectedType, playerStats, opponentStats]);

  const buildChallengeData = useCallback(() => {
    if (!selectedType || !challengeMode) return null;
    
    const opponentResult: ChallengePlayerResult | undefined = challengeMode === '1v1' && selectedOpponent ? {
      playerId: selectedOpponent.id,
      playerName: selectedOpponent.name,
      shots: selectedType !== 'precision' ? opponentShots : undefined,
      precisionShots: selectedType === 'precision' ? opponentPrecisionShots : undefined,
      successCount: opponentStats.successCount,
      totalShots: opponentShots.length,
      carreauCount: opponentStats.carreauCount,
      successRate: opponentStats.successRate,
      totalPoints: selectedType === 'precision' ? opponentStats.totalPrecisionPoints : undefined,
      atelierScores: selectedType === 'precision' ? opponentAtelierScores : undefined,
    } : undefined;

    const winner = challengeMode === '1v1' ? getWinner() : undefined;

    const detailedShots = notationRecords.map((record, idx) => ({
      id: `shot-${idx}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actionType: record.actionType,
      success: record.success,
      carreau: record.carreau,
      shotType: record.shotType,
      shotResult: record.shotResult,
      shotQuality: record.shotQuality,
      pointType: record.pointType,
      pointQuality: record.pointQuality,
    }));

    if (selectedType === 'precision') {
      return {
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
        totalPoints: playerStats.totalPrecisionPoints,
        maxPoints: 100,
        atelierScores,
        duration: elapsedTime,
        boulesSetId: selectedBoulesSetId || undefined,
      };
    } else {
      return {
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
        successCount: playerStats.successCount,
        totalShots: shots.length,
        carreauCount: playerStats.carreauCount,
        successRate: playerStats.successRate,
        duration: elapsedTime,
        detailedShots: detailedShots.length > 0 ? detailedShots : undefined,
        boulesSetId: selectedBoulesSetId || undefined,
      };
    }
  }, [selectedType, challengeMode, selectedOpponent, opponentShots, opponentPrecisionShots,
      opponentStats, opponentAtelierScores, getWinner, notationRecords, precisionShots,
      playerStats, atelierScores, elapsedTime, shots, selfPlayer, userStats]);

  const saveChallenge = useCallback(() => {
    const data = buildChallengeData();
    if (!data) return;
    addChallenge(data);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Show interstitial ad after saving challenge
    showInterstitial().finally(() => {
      router.back();
    });
  }, [buildChallengeData, addChallenge]);

  const handleSaveAndShare = useCallback(async () => {
    const data = buildChallengeData();
    if (!data) return;
    setIsSavingForShare(true);
    const newId = await addChallenge(data);
    setIsSavingForShare(false);
    if (newId) {
      setSavedChallengeIdForShare(newId);
      setShowPostChallengeShare(true);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [buildChallengeData, addChallenge]);

  const cancelChallenge = useCallback(() => {
    Alert.alert(t('challenge', 'quitChallenge'), t('challenge', 'challengeWillBeLost'), [
      { text: t('challenge', 'continueLabel'), style: 'cancel' },
      { text: t('challenge', 'quitLabel'), style: 'destructive', onPress: () => {
        if (timerRef.current) clearInterval(timerRef.current);
        router.back();
      }},
    ]);
  }, [t]);

  const resetChallenge = useCallback(() => {
    Alert.alert(t('challenge', 'challengeFinished'), t('challenge', 'whatToDo'), [
      {
        text: t('challenge', 'restartLabel'),
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
          setCurrentTurn('player');
        },
      },
      {
        text: t('challenge', 'exitChallenges'),
        style: 'destructive',
        onPress: () => {
          if (timerRef.current) clearInterval(timerRef.current);
          router.back();
        },
      },
    ]);
  }, [t]);

  // ============================================
  // RENDER: Challenge Type Selection
  // ============================================

  if (!selectedType) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('challenge', 'newChallenge')}</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="emoji-events" size={40} color={theme.carreauColor} />
            </View>
            <Text style={styles.heroTitle}>{t('challenge', 'chooseChallenge')}</Text>
            <Text style={styles.heroSubtitle}>{t('challenge', 'trainAndProgress')}</Text>
          </Animated.View>

          {(Object.entries(CHALLENGE_CONFIG) as [ChallengeType, typeof CHALLENGE_CONFIG[ChallengeType]][]).map(([type, cfg], index) => (
            <Animated.View key={type} entering={FadeInDown.duration(400).delay(100 + index * 80)}>
              <Pressable
                style={[styles.challengeCard, { borderLeftColor: cfg.color }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedType(type);
                }}
              >
                <View style={[styles.challengeCardIcon, { backgroundColor: cfg.color + '15' }]}>
                  <MaterialIcons name={cfg.icon} size={28} color={cfg.color} />
                </View>
                <View style={styles.challengeCardContent}>
                  <Text style={styles.challengeCardTitle}>{cfg.name}</Text>
                  <Text style={styles.challengeCardDesc}>{cfg.description}</Text>
                  <View style={styles.challengeCardMeta}>
                    <View style={[styles.metaBadge, { backgroundColor: cfg.color + '10' }]}>
                      <Text style={[styles.metaBadgeText, { color: cfg.color }]}>
                        {type === 'precision' ? `5 ${t('challenge', 'workshops')}` : `${cfg.totalShots} ${t('challenge', 'shots')}`}
                      </Text>
                    </View>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER: Mode Selection
  // ============================================

  if (!challengeMode) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => setSelectedType(null)}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{config?.name}</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.modeContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.modeHeader}>
            <View style={[styles.modeHeaderIcon, { backgroundColor: config?.color + '15' }]}>
              <MaterialIcons name={config?.icon || 'sports'} size={28} color={config?.color} />
            </View>
            <Text style={styles.modeHeaderTitle}>{t('challenge', 'howToPlay')}</Text>
          </Animated.View>

          <View style={styles.modeGrid}>
            <Animated.View entering={ZoomIn.duration(400).delay(100)} style={styles.modeCardWrapper}>
              <Pressable
                style={styles.modeCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setChallengeMode('solo');
                }}
              >
                <View style={[styles.modeCardIconBg, { backgroundColor: theme.primary }]}>
                  <MaterialIcons name="person" size={36} color="#FFF" />
                </View>
                <Text style={styles.modeCardTitle}>{t('challenge', 'solo')}</Text>
                <Text style={styles.modeCardDesc}>{t('challenge', 'personalTraining')}</Text>
                <View style={[styles.modeCardBtn, { backgroundColor: theme.primary }]}>
                  <Text style={styles.modeCardBtnText}>{t('challenge', 'start')}</Text>
                </View>
              </Pressable>
            </Animated.View>

            <Animated.View entering={ZoomIn.duration(400).delay(200)} style={styles.modeCardWrapper}>
              <Pressable
                style={styles.modeCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setChallengeMode('1v1');
                }}
              >
                <View style={[styles.modeCardIconBg, { backgroundColor: theme.accent }]}>
                  <MaterialIcons name="people" size={36} color="#FFF" />
                </View>
                <Text style={styles.modeCardTitle}>{t('challenge', 'oneVsOne')}</Text>
                <Text style={styles.modeCardDesc}>{t('challenge', 'challengeOpponent')}</Text>
                <View style={[styles.modeCardBtn, { backgroundColor: theme.accent }]}>
                  <Text style={styles.modeCardBtnText}>{t('challenge', 'choose')}</Text>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER: Opponent Selection (1v1)
  // ============================================

  if (challengeMode === '1v1' && !selectedOpponent && !isStarted) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => { setChallengeMode(null); setPlayerSearch(''); }}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('challenge', 'opponentLabel')}</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.opponentSearchContainer}>
          <MaterialIcons name="search" size={20} color={theme.textMuted} />
          <TextInput
            style={styles.opponentSearchInput}
            value={playerSearch}
            onChangeText={setPlayerSearch}
            placeholder={`${t('common', 'search')}...`}
            placeholderTextColor={theme.textMuted}
          />
          {playerSearch.length > 0 ? (
            <Pressable onPress={() => setPlayerSearch('')}>
              <MaterialIcons name="close" size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.opponentBanner}>
          <View style={styles.opponentBannerPlayers}>
            <View style={styles.opponentBannerAvatar}>
              <MaterialIcons name="person" size={20} color="#FFF" />
            </View>
            <View style={styles.opponentBannerVs}>
              <Text style={styles.opponentBannerVsText}>VS</Text>
            </View>
            <View style={[styles.opponentBannerAvatar, styles.opponentBannerAvatarEmpty]}>
              <MaterialIcons name="help-outline" size={20} color={theme.accent} />
            </View>
          </View>
          <Text style={styles.opponentBannerTitle}>{t('challenge', 'whoToChallenge')}</Text>
        </View>

        <FlatList
          data={filteredPlayers}
          keyExtractor={item => item.id}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32, paddingTop: 16 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={5}
          renderItem={({ item: player }) => (
            <Pressable
              style={styles.opponentCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSelectedOpponent(player);
              }}
            >
              <View style={styles.opponentAvatar}>
                <Text style={styles.opponentAvatarText}>
                  {player.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <View style={styles.opponentInfo}>
                <Text style={styles.opponentName}>{player.name}</Text>
                <Text style={styles.opponentMeta}>{player.club || '-'} • {player.role}</Text>
              </View>
              <View style={styles.opponentBtn}>
                <Text style={styles.opponentBtnText}>{t('challenge', 'challengeBtn')}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="person-search" size={48} color={theme.textMuted} />
              <Text style={styles.emptyStateText}>{t('challenge', 'noPlayers')}</Text>
              <Pressable style={styles.emptyStateBtn} onPress={() => router.push('/player/new')}>
                <MaterialIcons name="person-add" size={18} color={theme.primary} />
                <Text style={styles.emptyStateBtnText}>{t('challenge', 'createPlayer')}</Text>
              </Pressable>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER: Ready Screen
  // ============================================

  if (!isStarted) {
    const isPrecision = selectedType === 'precision';
    
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => {
            if (challengeMode === '1v1' && selectedOpponent) setSelectedOpponent(null);
            else setChallengeMode(null);
          }}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{config?.name}</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.readyContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={ZoomIn.duration(400)} style={styles.readyHero}>
            <View style={[styles.readyHeroIcon, { backgroundColor: config?.color + '15' }]}>
              <MaterialIcons name={config?.icon || 'sports'} size={56} color={config?.color} />
            </View>
            <Text style={styles.readyHeroTitle}>{config?.name}</Text>
            <Text style={styles.readyHeroDesc}>{config?.description}</Text>
            
            <View style={[styles.modeBadge, challengeMode === '1v1' && styles.modeBadge1v1]}>
              <MaterialIcons 
                name={challengeMode === 'solo' ? 'person' : 'people'} 
                size={16} 
                color={challengeMode === 'solo' ? theme.primary : theme.accent} 
              />
              <Text style={[styles.modeBadgeText, challengeMode === '1v1' && styles.modeBadgeText1v1]}>
                {challengeMode === 'solo' ? t('challenge', 'solo') : `vs ${selectedOpponent?.name}`}
              </Text>
            </View>
          </Animated.View>

          {isPrecision && (
            <View style={styles.readySection}>
              <Text style={styles.readySectionTitle}>{t('challenge', 'theWorkshops')}</Text>
              {TRANSLATED_ATELIERS.map((atelier, index) => (
                <Animated.View key={atelier.id} entering={FadeInDown.duration(300).delay(100 + index * 60)}>
                  <View style={styles.atelierCard}>
                    <View style={[styles.atelierIcon, { backgroundColor: theme.primary + '15' }]}>
                      <MaterialIcons name={atelier.icon as any} size={20} color={theme.primary} />
                    </View>
                    <View style={styles.atelierInfo}>
                      <Text style={styles.atelierName}>{atelier.name}</Text>
                      <Text style={styles.atelierDesc}>{atelier.description}</Text>
                    </View>
                    <Text style={styles.atelierDist}>6-9m</Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          {!isPrecision && (
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.readyInfoCard}>
              <View style={styles.readyInfoRow}>
                <MaterialIcons name="timer" size={18} color={theme.textSecondary} />
                <Text style={styles.readyInfoText}>{t('challenge', 'timedAuto')}</Text>
              </View>
              <View style={styles.readyInfoRow}>
                <MaterialIcons name="stars" size={18} color={theme.carreauColor} />
                <Text style={styles.readyInfoText}>{t('challenge', 'carreauxCounted')}</Text>
              </View>
              <View style={styles.readyInfoRow}>
                <MaterialIcons name="save" size={18} color={theme.primary} />
                <Text style={styles.readyInfoText}>{t('challenge', 'resultsSaved')}</Text>
              </View>
            </Animated.View>
          )}

          {/* Boules Set Selector */}
          {boulesSets.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(400).delay(250)} style={{ width: '100%', marginTop: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5, marginBottom: 8, textAlign: 'center' }}>{t('challenge', 'boulesSet').toUpperCase()}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Pressable
                  style={[styles.atelierCard, { borderWidth: 2, borderColor: !selectedBoulesSetId ? theme.primary : 'transparent', minWidth: 80 }]}
                  onPress={() => { Haptics.selectionAsync(); setSelectedBoulesSetId(null); }}
                >
                  <View style={[styles.atelierIcon, { backgroundColor: theme.textMuted + '15' }]}>
                    <MaterialIcons name="block" size={18} color={theme.textMuted} />
                  </View>
                  <View style={styles.atelierInfo}>
                    <Text style={styles.atelierName}>-</Text>
                  </View>
                </Pressable>
                {boulesSets.map(bs => (
                  <Pressable
                    key={bs.id}
                    style={[styles.atelierCard, { borderWidth: 2, borderColor: selectedBoulesSetId === bs.id ? theme.accent : 'transparent' }]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedBoulesSetId(bs.id); }}
                  >
                    <View style={[styles.atelierIcon, { backgroundColor: theme.accent + '15' }]}>
                      <MaterialIcons name="sports-baseball" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.atelierInfo}>
                      <Text style={styles.atelierName} numberOfLines={1}>{bs.name}</Text>
                      <Text style={styles.atelierDesc}>{[bs.diameter ? `${bs.diameter}mm` : '', bs.weight ? `${bs.weight}g` : ''].filter(Boolean).join(' \u2022 ')}</Text>
                    </View>
                    {selectedBoulesSetId === bs.id ? <MaterialIcons name="check-circle" size={18} color={theme.accent} /> : null}
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}
        </ScrollView>

        <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={[styles.startBtn, { backgroundColor: config?.color }]} onPress={startChallenge}>
            <MaterialIcons name="play-arrow" size={28} color="#FFF" />
            <Text style={styles.startBtnText}>{t('challenge', 'start')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER: Results Screen
  // ============================================

  if (isFinished) {
    const winner = challengeMode === '1v1' ? getWinner() : null;
    const isPrecision = selectedType === 'precision';
    const score = isPrecision ? playerStats.totalPrecisionPoints : playerStats.successRate;
    const opScore = isPrecision ? opponentStats.totalPrecisionPoints : opponentStats.successRate;
    const scoreColor = score >= 70 ? theme.success : score >= 50 ? theme.warning : theme.error;
    
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('challenge', 'results')}</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {challengeMode === '1v1' && (
            <Animated.View entering={FadeInDown.duration(400)} style={[
              styles.winnerBanner,
              winner === 'player' && styles.winnerBannerWin,
              winner === 'opponent' && styles.winnerBannerLoss,
              winner === 'draw' && styles.winnerBannerDraw,
            ]}>
              <MaterialIcons 
                name={winner === 'draw' ? 'handshake' : winner === 'player' ? 'emoji-events' : 'sentiment-dissatisfied'} 
                size={28} 
                color="#FFF" 
              />
              <Text style={styles.winnerBannerText}>
                {winner === 'draw' ? t('challenge', 'drawResult') : winner === 'player' ? t('challenge', 'victoryResult') : `${selectedOpponent?.name} ${t('challenge', 'winsResult')}`}
              </Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.resultCard}>
            {challengeMode === '1v1' && (
              <View style={styles.resultHeader}>
                <MaterialIcons name="person" size={18} color={theme.primary} />
                <Text style={styles.resultHeaderText}>{selfPlayer?.name || userStats.playerName}</Text>
                {winner === 'player' && <MaterialIcons name="emoji-events" size={18} color={theme.carreauColor} />}
              </View>
            )}
            
            <View style={[styles.resultBadge, { backgroundColor: scoreColor }]}>
              <Text style={styles.resultBadgeText}>
                {score >= 70 ? t('challenge', 'excellent') : score >= 50 ? t('challenge', 'well') : t('challenge', 'toImprove')}
              </Text>
            </View>

            <Text style={styles.resultScore}>{score}{isPrecision ? '' : '%'}</Text>
            <Text style={styles.resultLabel}>{isPrecision ? '/ 100 points' : t('challenge', 'successRate')}</Text>

            <View style={styles.resultGrid}>
              {!isPrecision && (
                <>
                  <View style={styles.resultGridItem}>
                    <MaterialIcons name="check-circle" size={22} color={theme.success} />
                    <Text style={styles.resultGridValue}>{playerStats.successCount}</Text>
                    <Text style={styles.resultGridLabel}>{t('challenge', 'succeeded')}</Text>
                  </View>
                  <View style={styles.resultGridItem}>
                    <MaterialIcons name="cancel" size={22} color={theme.error} />
                    <Text style={styles.resultGridValue}>{shots.length - playerStats.successCount}</Text>
                    <Text style={styles.resultGridLabel}>{t('challenge', 'missed')}</Text>
                  </View>
                </>
              )}
              <View style={styles.resultGridItem}>
                <MaterialIcons name="stars" size={22} color={theme.carreauColor} />
                <Text style={styles.resultGridValue}>
                  {isPrecision ? precisionShots.filter(s => s.points === 5).length : playerStats.carreauCount}
                </Text>
                <Text style={styles.resultGridLabel}>{t('history', 'carreaux')}</Text>
              </View>
              <View style={styles.resultGridItem}>
                <MaterialIcons name="timer" size={22} color={theme.primary} />
                <Text style={styles.resultGridValue}>{formatTime(elapsedTime)}</Text>
                <Text style={styles.resultGridLabel}>{t('history', 'duration')}</Text>
              </View>
            </View>
          </Animated.View>

          {challengeMode === '1v1' && selectedOpponent && (
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <MaterialIcons name="person" size={18} color={theme.accent} />
                <Text style={[styles.resultHeaderText, { color: theme.accent }]}>{selectedOpponent.name}</Text>
                {winner === 'opponent' && <MaterialIcons name="emoji-events" size={18} color={theme.carreauColor} />}
              </View>
              
              <Text style={styles.resultScore}>{opScore}{isPrecision ? '' : '%'}</Text>
              <Text style={styles.resultLabel}>{isPrecision ? '/ 100 points' : t('challenge', 'successRate')}</Text>
            </Animated.View>
          )}

          <View style={styles.resultActions}>
            <Pressable style={styles.retryBtn} onPress={resetChallenge}>
              <MaterialIcons name="refresh" size={20} color={theme.primary} />
              <Text style={styles.retryBtnText}>{t('challenge', 'retry')}</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={saveChallenge}>
              <MaterialIcons name="save" size={20} color="#FFF" />
              <Text style={styles.saveBtnText}>{t('challenge', 'saveChallenge')}</Text>
            </Pressable>
          </View>

          <Pressable 
            style={styles.shareParticipantsBtn} 
            onPress={handleSaveAndShare}
            disabled={isSavingForShare}
          >
            {isSavingForShare ? (
              <Text style={styles.shareParticipantsBtnText}>{t('matchEdit', 'savingMatch')}</Text>
            ) : (
              <>
                <MaterialIcons name="share" size={20} color={theme.primary} />
                <Text style={styles.shareParticipantsBtnText}>{t('matchEdit', 'shareWithParticipants')}</Text>
              </>
            )}
          </Pressable>

          {savedChallengeIdForShare ? (
            <ShareModal
              visible={showPostChallengeShare}
              onClose={() => {
                setShowPostChallengeShare(false);
                router.back();
              }}
              itemType="challenge"
              itemId={savedChallengeIdForShare}
              itemName={`${config?.name || ''} - ${selfPlayer?.name || userStats.playerName}`}
              forceReadOnly
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER: In Progress - Precision
  // ============================================

  if (selectedType === 'precision') {
    const isOpponentTurn = currentTurn === 'opponent';
    const displayAtelier = isOpponentTurn ? opponentAtelier : currentAtelier;
    const displayDistance = isOpponentTurn ? opponentDistance : currentDistance;
    const displayShotNumber = isOpponentTurn ? opponentPrecisionShotNumber : currentPrecisionShotNumber;
    const displayTotalPoints = isOpponentTurn ? opponentStats.totalPrecisionPoints : playerStats.totalPrecisionPoints;
    
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.cancelHeaderBtn} onPress={cancelChallenge}>
            <Text style={styles.cancelHeaderBtnText}>{t('common', 'cancel')}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t('challenge', 'precision')}</Text>
          <View style={styles.timerBadge}>
            <MaterialIcons name="timer" size={14} color={theme.primary} />
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>

        {challengeMode === '1v1' && (
          <View style={[styles.turnIndicator, isOpponentTurn && styles.turnIndicatorOpponent]}>
            <MaterialIcons name="person" size={16} color="#FFF" />
            <Text style={styles.turnIndicatorText}>
              {isOpponentTurn ? `${t('challenge', 'turnOf')} ${selectedOpponent?.name}` : t('challenge', 'yourTurn')}
            </Text>
          </View>
        )}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.gameContent} showsVerticalScrollIndicator={false}>
          <View style={styles.atelierInfoCard}>
            <View style={[styles.atelierInfoIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name={displayAtelier.icon as any} size={24} color={theme.primary} />
            </View>
            <View style={styles.atelierInfoContent}>
              <Text style={styles.atelierInfoName}>{displayAtelier.name}</Text>
              <Text style={styles.atelierInfoDesc}>{displayAtelier.description}</Text>
            </View>
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceBadgeText}>{displayDistance}m</Text>
            </View>
          </View>

          <View style={styles.progressInfo}>
            <Text style={styles.progressInfoText}>{t('challenge', 'shots').charAt(0).toUpperCase() + t('challenge', 'shots').slice(1)} {displayShotNumber} / 20</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressBarFill, { width: `${((displayShotNumber - 1) / 20) * 100}%` }]} />
            </View>
          </View>

          <CountdownTimer seconds={30} isRunning={shotTimerRunning} onStart={startShotTimer} onTimeUp={handleTimeUp} startLabel={t('challenge', 'start')} />

          <View style={styles.scoreCard}>
            <Text style={styles.scoreCardLabel}>
              {challengeMode === '1v1' ? (isOpponentTurn ? `${t('challenge', 'scoreOf')} ${selectedOpponent?.name}` : t('challenge', 'yourScore')) : t('match', 'score')}
            </Text>
            <Text style={styles.scoreCardValue}>{displayTotalPoints}</Text>
            <Text style={styles.scoreCardMax}>/ 100 pts</Text>
          </View>

          {challengeMode === '1v1' && (
            <View style={styles.scoresCompare}>
              <View style={styles.scoreCompareSide}>
                <Text style={styles.scoreCompareName}>{t('challenge', 'youLabel')}</Text>
                <Text style={[styles.scoreCompareValue, !isOpponentTurn && styles.scoreCompareValueActive]}>
                  {playerStats.totalPrecisionPoints}
                </Text>
              </View>
              <Text style={styles.scoreCompareSep}>-</Text>
              <View style={styles.scoreCompareSide}>
                <Text style={styles.scoreCompareName}>{selectedOpponent?.name?.split(' ')[0]}</Text>
                <Text style={[styles.scoreCompareValue, isOpponentTurn && styles.scoreCompareValueActive]}>
                  {opponentStats.totalPrecisionPoints}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.scoringButtons, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.scoringButtonsTitle}>{t('challenge', 'shotResult')}</Text>
          <View style={styles.scoringButtonsGrid}>
            {displayAtelier.scoringOptions.map((option, index) => {
              const colors: Record<number, string> = { 0: theme.error, 1: theme.warning, 3: theme.success, 5: theme.carreauColor };
              const isOddCount = displayAtelier.scoringOptions.length % 2 !== 0;
              const isLastItem = index === displayAtelier.scoringOptions.length - 1;
              const isFullWidth = isOddCount && isLastItem;
              return (
                <Pressable 
                  key={index}
                  style={[styles.scoringBtn, { backgroundColor: colors[option.points] }, isFullWidth && styles.scoringBtnFullWidth]}
                  onPress={() => recordPrecisionShot(option.points, isOpponentTurn)}
                >
                  <Text style={styles.scoringBtnPoints}>{option.points}</Text>
                  <Text style={styles.scoringBtnLabel}>{option.label}</Text>
                  <Text style={styles.scoringBtnDesc} numberOfLines={2}>{option.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER: In Progress - Standard (10 tirs)
  // ============================================

  const isOpponentTurn = currentTurn === 'opponent';
  const displayCurrentShot = isOpponentTurn ? opponentCurrentShot : currentShot;
  const displayShots = isOpponentTurn ? opponentShots : shots;
  const displayStats = isOpponentTurn ? opponentStats : playerStats;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.cancelHeaderBtn} onPress={cancelChallenge}>
          <Text style={styles.cancelHeaderBtnText}>{t('common', 'cancel')}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{config?.name}</Text>
        <View style={styles.timerBadge}>
          <MaterialIcons name="timer" size={14} color={theme.primary} />
          <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
        </View>
      </View>

      {challengeMode === '1v1' && (
        <View style={[styles.turnIndicator, isOpponentTurn && styles.turnIndicatorOpponent]}>
          <MaterialIcons name="person" size={16} color="#FFF" />
          <Text style={styles.turnIndicatorText}>
            {isOpponentTurn ? `${t('challenge', 'turnOf')} ${selectedOpponent?.name}` : t('challenge', 'yourTurn')}
          </Text>
        </View>
      )}

      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressBarFill, { width: `${(displayCurrentShot / (config?.totalShots || 10)) * 100}%`, backgroundColor: config?.color }]} />
        </View>
        <Text style={styles.progressText}>{t('challenge', 'shots').charAt(0).toUpperCase() + t('challenge', 'shots').slice(1)} {displayCurrentShot} / {config?.totalShots}</Text>
      </View>

      <View style={styles.shotsIndicator}>
        {Array.from({ length: config?.totalShots || 10 }).map((_, index) => {
          const shot = displayShots[index];
          return (
            <View
              key={index}
              style={[
                styles.shotDot,
                shot?.success && { backgroundColor: shot.carreau ? theme.carreauColor : theme.success },
                shot && !shot.success && { backgroundColor: theme.error },
                index === displayCurrentShot - 1 && displayShots.length < (config?.totalShots || 10) && { backgroundColor: config?.color, transform: [{ scale: 1.2 }] },
              ]}
            >
              {shot?.carreau && <MaterialIcons name="star" size={8} color="#FFF" />}
            </View>
          );
        })}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.success }]}>{displayStats.successCount}</Text>
          <Text style={styles.statLabel}>{t('challenge', 'succeeded')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.error }]}>{displayShots.length - displayStats.successCount}</Text>
          <Text style={styles.statLabel}>{t('challenge', 'missed')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.carreauColor }]}>{displayStats.carreauCount}</Text>
          <Text style={styles.statLabel}>{t('history', 'carreaux')}</Text>
        </View>
      </View>

      {challengeMode === '1v1' && (
        <View style={styles.scoresCompare}>
          <View style={styles.scoreCompareSide}>
            <Text style={styles.scoreCompareName}>{t('challenge', 'youLabel')}</Text>
            <Text style={[styles.scoreCompareValue, !isOpponentTurn && styles.scoreCompareValueActive]}>
              {playerStats.successCount}/{shots.length}
            </Text>
          </View>
          <Text style={styles.scoreCompareSep}>vs</Text>
          <View style={styles.scoreCompareSide}>
            <Text style={styles.scoreCompareName}>{selectedOpponent?.name?.split(' ')[0]}</Text>
            <Text style={[styles.scoreCompareValue, isOpponentTurn && styles.scoreCompareValueActive]}>
              {opponentStats.successCount}/{opponentShots.length}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.shotButtonsContainer}>
        <Text style={styles.shotButtonsTitle}>
          {challengeMode === '1v1' ? (isOpponentTurn ? `${t('challenge', 'turnOf')} ${selectedOpponent?.name}` : t('challenge', 'yourTurn')) : t('challenge', 'shotResult')}
        </Text>
        
        <Pressable style={styles.mainShotBtn} onPress={() => openNotationModal(isOpponentTurn)}>
          <MaterialIcons name="gps-fixed" size={40} color="#FFF" />
          <Text style={styles.mainShotBtnText}>TIR</Text>
          <Text style={styles.mainShotBtnSub}>{t('challenge', 'detailedNotation')}</Text>
        </Pressable>

        <View style={styles.quickBtns}>
          <Pressable style={[styles.quickBtn, { backgroundColor: theme.error }]} onPress={() => recordShot(false, false, isOpponentTurn)}>
            <MaterialIcons name="close" size={22} color="#FFF" />
            <Text style={styles.quickBtnText}>{t('challenge', 'missedBtn')}</Text>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: theme.success }]} onPress={() => recordShot(true, false, isOpponentTurn)}>
            <MaterialIcons name="check" size={22} color="#FFF" />
            <Text style={styles.quickBtnText}>{t('challenge', 'succeededBtn')}</Text>
          </Pressable>
          <Pressable style={[styles.quickBtn, { backgroundColor: theme.carreauColor }]} onPress={() => recordShot(true, true, isOpponentTurn)}>
            <MaterialIcons name="stars" size={22} color="#FFF" />
            <Text style={styles.quickBtnText}>{t('challenge', 'carreauBtn')}</Text>
          </Pressable>
        </View>
      </View>

      <SimplifiedShotNotation
        visible={showNotation}
        onClose={() => { setShowNotation(false); setPendingNotationIsOpponent(false); }}
        actionType="tir"
        playerId={pendingNotationIsOpponent ? (selectedOpponent?.id || '') : (selfPlayer?.id || userStats.playerId)}
        playerName={pendingNotationIsOpponent ? (selectedOpponent?.name || t('challenge', 'opponentLabel')) : (selfPlayer?.name || userStats.playerName)}
        team={pendingNotationIsOpponent ? 'B' : 'A'}
        onSubmit={handleNotationSubmit}
      />
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  cancelHeaderBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.error + '15', borderRadius: 10 },
  cancelHeaderBtnText: { fontSize: 14, fontWeight: '600', color: theme.error },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  timerText: { fontSize: 14, fontWeight: '600', color: theme.primary, fontVariant: ['tabular-nums'] },
  
  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  
  // Hero Section (Type Selection)
  heroSection: { alignItems: 'center', paddingVertical: 24 },
  heroIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: theme.carreauColor + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  heroSubtitle: { fontSize: 14, color: theme.textSecondary },
  
  // Challenge Card
  challengeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, ...theme.shadows.card },
  challengeCardIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  challengeCardContent: { flex: 1 },
  challengeCardTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  challengeCardDesc: { fontSize: 13, color: theme.textSecondary, marginBottom: 8 },
  challengeCardMeta: { flexDirection: 'row' },
  metaBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  metaBadgeText: { fontSize: 11, fontWeight: '600' },
  
  // Mode Selection
  modeContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  modeHeader: { alignItems: 'center', marginBottom: 28 },
  modeHeaderIcon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modeHeaderTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  modeGrid: { flexDirection: 'row', gap: 12 },
  modeCardWrapper: { flex: 1 },
  modeCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 20, alignItems: 'center', ...theme.shadows.cardElevated },
  modeCardIconBg: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modeCardTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  modeCardDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginBottom: 16 },
  modeCardBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, width: '100%', alignItems: 'center' },
  modeCardBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  
  // Opponent Selection
  opponentSearchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: theme.borderRadius.md, gap: 10,
  },
  opponentSearchInput: { flex: 1, fontSize: 16, color: theme.textPrimary, padding: 0 },
  opponentBanner: { backgroundColor: theme.accent, paddingVertical: 16, alignItems: 'center' },
  opponentBannerPlayers: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  opponentBannerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  opponentBannerAvatarEmpty: { backgroundColor: theme.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.accent },
  opponentBannerVs: { backgroundColor: theme.warning, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  opponentBannerVsText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  opponentBannerTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  opponentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 10, ...theme.shadows.card },
  opponentAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  opponentAvatarText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  opponentInfo: { flex: 1 },
  opponentName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  opponentMeta: { fontSize: 12, color: theme.textMuted },
  opponentBtn: { backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  opponentBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateText: { fontSize: 15, color: theme.textMuted, marginTop: 12 },
  emptyStateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.primary + '15', borderRadius: 10 },
  emptyStateBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  
  // Ready Screen
  readyContent: { paddingHorizontal: 16, paddingTop: 32, alignItems: 'center' },
  readyHero: { alignItems: 'center', marginBottom: 28 },
  readyHeroIcon: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  readyHeroTitle: { fontSize: 26, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  readyHeroDesc: { fontSize: 15, color: theme.textSecondary, textAlign: 'center' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 14 },
  modeBadge1v1: { backgroundColor: theme.accent + '15' },
  modeBadgeText: { fontSize: 14, fontWeight: '600', color: theme.primary },
  modeBadgeText1v1: { color: theme.accent },
  readySection: { width: '100%', marginTop: 20 },
  readySectionTitle: { fontSize: 12, fontWeight: '600', color: theme.textMuted, letterSpacing: 1, marginBottom: 10 },
  atelierCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 12, padding: 12, marginBottom: 8, ...theme.shadows.card },
  atelierIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  atelierInfo: { flex: 1 },
  atelierName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  atelierDesc: { fontSize: 11, color: theme.textSecondary },
  atelierDist: { fontSize: 12, fontWeight: '600', color: theme.textMuted, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  readyInfoCard: { width: '100%', backgroundColor: theme.surface, borderRadius: 16, padding: 16, gap: 12, ...theme.shadows.card },
  readyInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readyInfoText: { fontSize: 14, color: theme.textSecondary, flex: 1 },
  bottomAction: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 14, ...theme.shadows.card },
  startBtnText: { fontSize: 17, fontWeight: '600', color: '#FFF' },
  
  // Results
  winnerBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 14, borderRadius: 14, marginBottom: 16 },
  winnerBannerWin: { backgroundColor: theme.success },
  winnerBannerLoss: { backgroundColor: theme.error },
  winnerBannerDraw: { backgroundColor: theme.warning },
  winnerBannerText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  resultCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12, ...theme.shadows.card },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border, width: '100%', justifyContent: 'center' },
  resultHeaderText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  resultBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  resultBadgeText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  resultScore: { fontSize: 56, fontWeight: '800', color: theme.textPrimary },
  resultLabel: { fontSize: 14, color: theme.textMuted, marginBottom: 20 },
  resultGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  resultGridItem: { width: '50%', alignItems: 'center', paddingVertical: 12 },
  resultGridValue: { fontSize: 22, fontWeight: '700', color: theme.textPrimary, marginTop: 6 },
  resultGridLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  resultActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  retryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.surface, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: theme.primary },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  shareParticipantsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.primary + '12', borderWidth: 1.5, borderColor: theme.primary + '35' },
  shareParticipantsBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  
  // In Progress
  turnIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 10 },
  turnIndicatorOpponent: { backgroundColor: theme.accent },
  turnIndicatorText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  progressSection: { paddingHorizontal: 16, paddingVertical: 14 },
  progressBar: { height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: theme.primary, borderRadius: 3 },
  progressText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, textAlign: 'center' },
  shotsIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 20 },
  shotDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface, marginHorizontal: 16, paddingVertical: 16, borderRadius: 14, ...theme.shadows.card },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '700' },
  statLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: theme.border },
  scoresCompare: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, marginHorizontal: 16, marginTop: 12, paddingVertical: 14, borderRadius: 14, ...theme.shadows.card },
  scoreCompareSide: { flex: 1, alignItems: 'center' },
  scoreCompareName: { fontSize: 11, color: theme.textSecondary, marginBottom: 2 },
  scoreCompareValue: { fontSize: 20, fontWeight: '700', color: theme.textMuted },
  scoreCompareValueActive: { color: theme.primary },
  scoreCompareSep: { fontSize: 14, fontWeight: '600', color: theme.textMuted, paddingHorizontal: 8 },
  shotButtonsContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 20, alignItems: 'center' },
  shotButtonsTitle: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 16 },
  mainShotBtn: { width: SCREEN_WIDTH - 64, aspectRatio: 2.2, backgroundColor: theme.tirColor, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...theme.shadows.cardElevated },
  mainShotBtnText: { fontSize: 20, fontWeight: '700', color: '#FFF', marginTop: 6 },
  mainShotBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  quickBtns: { flexDirection: 'row', gap: 10 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12 },
  quickBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  
  // Precision In Progress
  gameContent: { paddingHorizontal: 16, paddingTop: 14 },
  atelierInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 14, ...theme.shadows.card },
  atelierInfoIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  atelierInfoContent: { flex: 1 },
  atelierInfoName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  atelierInfoDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  distanceBadge: { backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  distanceBadgeText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  progressInfo: { marginBottom: 14 },
  progressInfoText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, textAlign: 'center', marginBottom: 8 },
  countdownContainer: { alignItems: 'center', marginBottom: 16 },
  countdownCircle: { width: 88, height: 88, borderRadius: 44, borderWidth: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, marginBottom: 10 },
  countdownText: { fontSize: 32, fontWeight: '700' },
  countdownLabel: { fontSize: 11, color: theme.textMuted, marginTop: -4 },
  countdownBar: { width: '100%', height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' },
  countdownBarFill: { height: '100%', borderRadius: 2 },
  startTimerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.success, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, marginTop: 12 },
  startTimerButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  scoreCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 14, ...theme.shadows.card },
  scoreCardLabel: { fontSize: 11, color: theme.textSecondary, marginBottom: 4 },
  scoreCardValue: { fontSize: 42, fontWeight: '800', color: theme.primary },
  scoreCardMax: { fontSize: 14, color: theme.textMuted },
  scoringButtons: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  scoringButtonsTitle: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, textAlign: 'center', marginBottom: 10 },
  scoringButtonsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scoringBtn: { width: (SCREEN_WIDTH - 40) / 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14, minHeight: 100, ...theme.shadows.card },
  scoringBtnPoints: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  scoringBtnLabel: { fontSize: 13, fontWeight: '700', color: '#FFF', marginTop: 4 },
  scoringBtnDesc: { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.85)', marginTop: 3, textAlign: 'center', lineHeight: 13, paddingHorizontal: 4 },
  scoringBtnFullWidth: { width: SCREEN_WIDTH - 32 },
});
