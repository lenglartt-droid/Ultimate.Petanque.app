import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import theme from '@/constants/theme';
import config, { PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { Language } from '@/constants/i18n';

// ============================================
// TYPES
// ============================================
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface OnboardingMatch {
  format: 'Tete-a-tete' | 'Doublette' | 'Triplette';
  teamA: string[];
  teamB: string[];
  menes: Array<{ teamAScore: number; teamBScore: number; action?: string; player?: string }>;
  scoreA: number;
  scoreB: number;
  finished: boolean;
  duration: number;
  stats: {
    totalShots: number;
    successfulShots: number;
    carreaux: number;
    successRate: number;
  };
}

const STORAGE_KEY = 'onboarding_temp_data';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// ANIMATED COUNTER
// ============================================
function AnimatedCounter({ value, suffix, duration = 1500 }: { value: number; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const animValue = useSharedValue(0);

  useEffect(() => {
    animValue.value = 0;
    const step = Math.max(1, Math.floor(duration / 60));
    let current = 0;
    const increment = value / (duration / 16);
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        current = value;
        clearInterval(timer);
      }
      setDisplay(Math.round(current));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <Text style={s.counterValue}>
      {display}{suffix || ''}
    </Text>
  );
}

// ============================================
// PROGRESS DOTS
// ============================================
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={s.progressDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            s.progressDot,
            i === current ? s.progressDotActive : null,
            i < current ? s.progressDotDone : null,
          ]}
        />
      ))}
    </View>
  );
}

// ============================================
// MAIN ONBOARDING SCREEN
// ============================================
export default function OnboardingScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { updatePlayer, refreshData } = useApp();
  const supabase = getSupabaseClient();
  const { t, language, setLanguage } = useLanguage();

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // Match state
  const [match, setMatch] = useState<OnboardingMatch>({
    format: 'Doublette',
    teamA: [language === 'fr' ? 'Moi' : 'Me', language === 'fr' ? 'Equipier' : 'Teammate'],
    teamB: [language === 'fr' ? 'Adversaire 1' : 'Opponent 1', language === 'fr' ? 'Adversaire 2' : 'Opponent 2'],
    menes: [],
    scoreA: 0,
    scoreB: 0,
    finished: false,
    duration: 0,
    stats: { totalShots: 0, successfulShots: 0, carreaux: 0, successRate: 0 },
  });

  // Mene recording state
  const [currentMeneTeam, setCurrentMeneTeam] = useState<'A' | 'B' | null>(null);
  const [currentMenePoints, setCurrentMenePoints] = useState(1);
  const [currentAction, setCurrentAction] = useState<'point' | 'tir' | 'carreau'>('point');

  // Profile state (post-login)
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<PlayerRole | null>(null);

  // Splash timer
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-advance from splash
  useEffect(() => {
    if (splashDone && step === 0) {
      setStep(1);
    }
  }, [splashDone]);

  // ============================================
  // SAVE TEMP DATA
  // ============================================
  const saveTempData = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        match,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.log('Error saving temp onboarding data:', e);
    }
  };

  // ============================================
  // NAVIGATION
  // ============================================
  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(prev => Math.min(8, prev + 1) as Step);
  };

  const goBack = () => {
    Haptics.selectionAsync();
    setStep(prev => Math.max(1, prev - 1) as Step);
  };

  // ============================================
  // MENE ACTIONS
  // ============================================
  const addMene = () => {
    if (!currentMeneTeam) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newMene = {
      teamAScore: currentMeneTeam === 'A' ? currentMenePoints : 0,
      teamBScore: currentMeneTeam === 'B' ? currentMenePoints : 0,
      action: currentAction,
      player: match.teamA[0],
    };

    const newScoreA = match.scoreA + newMene.teamAScore;
    const newScoreB = match.scoreB + newMene.teamBScore;
    const isCarreau = currentAction === 'carreau';
    const isSuccess = currentAction === 'tir' || currentAction === 'carreau';

    const newStats = {
      totalShots: match.stats.totalShots + 1,
      successfulShots: match.stats.successfulShots + (isSuccess ? 1 : 0),
      carreaux: match.stats.carreaux + (isCarreau ? 1 : 0),
      successRate: 0,
    };
    newStats.successRate = newStats.totalShots > 0
      ? Math.round((newStats.successfulShots / newStats.totalShots) * 100)
      : 0;

    const finished = newScoreA >= 13 || newScoreB >= 13;

    setMatch(prev => ({
      ...prev,
      menes: [...prev.menes, newMene],
      scoreA: newScoreA,
      scoreB: newScoreB,
      finished,
      duration: prev.menes.length * 3 + 5,
      stats: newStats,
    }));

    setCurrentMeneTeam(null);
    setCurrentMenePoints(1);
    setCurrentAction('point');

    if (finished) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      saveTempData();
      setTimeout(() => setStep(4), 800);
    }
  };

  const simulateFinish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const fakeMenes: OnboardingMatch['menes'] = [];
    let sA = match.scoreA;
    let sB = match.scoreB;
    let shots = match.stats.totalShots;
    let success = match.stats.successfulShots;
    let carreaux = match.stats.carreaux;

    while (sA < 13 && sB < 13) {
      const team = Math.random() > 0.45 ? 'A' : 'B';
      const pts = Math.floor(Math.random() * 3) + 1;
      const action = Math.random() > 0.7 ? (Math.random() > 0.5 ? 'carreau' : 'tir') : 'point';
      fakeMenes.push({
        teamAScore: team === 'A' ? pts : 0,
        teamBScore: team === 'B' ? pts : 0,
        action,
      });
      if (team === 'A') sA += pts; else sB += pts;
      shots++;
      if (action === 'tir' || action === 'carreau') success++;
      if (action === 'carreau') carreaux++;
    }

    const rate = shots > 0 ? Math.round((success / shots) * 100) : 0;
    setMatch(prev => ({
      ...prev,
      menes: [...prev.menes, ...fakeMenes],
      scoreA: Math.min(sA, 13),
      scoreB: Math.min(sB, 13),
      finished: true,
      duration: (prev.menes.length + fakeMenes.length) * 3 + 5,
      stats: { totalShots: shots, successfulShots: success, carreaux, successRate: rate },
    }));
    saveTempData();
    setTimeout(() => setStep(4), 600);
  };

  // ============================================
  // HANDLE COMPLETE (POST-LOGIN PROFILE SAVE)
  // ============================================
  const handleComplete = async () => {
    if (!username.trim()) {
      showAlert(t('common', 'error'), t('onboarding', 'nameRequired'));
      return;
    }
    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          username: username.trim(),
          role: role || 'Milieu',
          level: 'Intermédiaire',
        })
        .eq('id', user?.id);
      if (profileError) throw profileError;

      const { error: playerError } = await supabase
        .from('players')
        .update({
          name: username.trim(),
          role: role || 'Milieu',
          level: 'Intermédiaire',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);
      if (playerError) throw playerError;

      if (user?.id) {
        await updatePlayer(user.id, {
          name: username.trim(),
          role: role || 'Milieu',
          level: 'Intermédiaire',
        });
      }

      await AsyncStorage.removeItem(STORAGE_KEY);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/consent');
    } catch (error: any) {
      showAlert(t('common', 'error'), error.message || t('onboarding', 'unableToCreateProfile'));
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // HANDLE SKIP LOGIN
  // ============================================
  const handleSkipLogin = async () => {
    Haptics.selectionAsync();
    // Data stays in AsyncStorage for 7 days
    showAlert(
      language === 'fr' ? 'Données temporaires' : 'Temporary data',
      language === 'fr'
        ? 'Vos données resteront sur cet appareil pendant 7 jours.'
        : 'Your data will remain on this device for 7 days.'
    );
    // If user is authenticated, go to profile express
    if (user?.id) {
      setStep(8);
    }
    // Otherwise they need to log in first - go to login
  };

  const isMatchWon = match.scoreA >= 13;

  // ============================================
  // RENDER SCREENS
  // ============================================

  // --- SCREEN 0: ANIMATED SPLASH ---
  if (step === 0) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.splashContainer}>
            <Animated.View entering={FadeIn.duration(800)}>
              <Image
                source={require('@/assets/images/onboarding-splash.png')}
                style={s.splashImage}
                contentFit="contain"
                transition={300}
              />
            </Animated.View>
            <Animated.View entering={FadeInUp.duration(600).delay(1200)}>
              <Text style={s.splashTitle}>Ultimate Petanque</Text>
            </Animated.View>
            <Animated.View entering={FadeInUp.duration(600).delay(1800)}>
              <ActivityIndicator color="#60A5FA" size="small" style={{ marginTop: 24 }} />
            </Animated.View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- SCREEN 1: PROMISE ---
  if (step === 1) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <ScrollView contentContainerStyle={s.promiseContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)} style={s.promiseImageWrap}>
              <Image
                source={require('@/assets/images/onboarding-promise.png')}
                style={s.promiseImage}
                contentFit="contain"
                transition={200}
              />
            </Animated.View>
            <Animated.View entering={FadeInUp.duration(500).delay(200)}>
              <Text style={s.promiseTitle}>
                {language === 'fr' ? 'Chaque tir compte.' : 'Every shot counts.'}
              </Text>
              <Text style={s.promiseSubtitle}>
                {language === 'fr'
                  ? 'Suis tes matchs. Mesure ta progression. Trouve des joueurs.'
                  : 'Track your matches. Measure your progress. Find players.'}
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInUp.duration(500).delay(400)} style={{ width: '100%', paddingHorizontal: 24 }}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={goNext}
              >
                <Text style={s.ctaPrimaryText}>
                  {language === 'fr' ? 'Jouer mon premier match' : 'Play my first match'}
                </Text>
                <MaterialIcons name="sports" size={22} color="#0F172A" />
              </Pressable>
              {user ? null : (
                <Pressable style={s.ctaSecondary} onPress={() => router.replace('/login')}>
                  <Text style={s.ctaSecondaryText}>
                    {language === 'fr' ? "J'ai deja un compte" : 'I already have an account'}
                  </Text>
                </Pressable>
              )}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- SCREEN 2: EXPRESS MATCH SETUP ---
  if (step === 2) {
    const formats = [
      { id: 'Tete-a-tete' as const, label: language === 'fr' ? 'Tete-a-tete' : 'Singles', players: 1 },
      { id: 'Doublette' as const, label: language === 'fr' ? 'Doublette' : 'Doubles', players: 2 },
      { id: 'Triplette' as const, label: language === 'fr' ? 'Triplette' : 'Triples', players: 3 },
    ];

    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.screenHeader}>
              <Pressable onPress={goBack} hitSlop={12}>
                <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
              </Pressable>
              <ProgressDots current={0} total={3} />
              <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={s.setupContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeInDown.duration(400)}>
                <Text style={s.setupTitle}>
                  {language === 'fr' ? 'Ton match en 3 taps' : 'Your match in 3 taps'}
                </Text>
                <Text style={s.setupSubtitle}>
                  {language === 'fr' ? 'Tout est pre-rempli. Modifie si tu veux.' : 'Everything is pre-filled. Edit if you want.'}
                </Text>
              </Animated.View>

              {/* Format selector */}
              <Animated.View entering={FadeInUp.duration(300).delay(100)} style={s.setupSection}>
                <Text style={s.setupLabel}>{language === 'fr' ? 'FORMAT' : 'FORMAT'}</Text>
                <View style={s.formatRow}>
                  {formats.map(f => (
                    <Pressable
                      key={f.id}
                      style={[s.formatChip, match.format === f.id && s.formatChipActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        const pCount = f.players;
                        const moi = language === 'fr' ? 'Moi' : 'Me';
                        const eq = language === 'fr' ? 'Equipier' : 'Teammate';
                        const eq2 = language === 'fr' ? 'Equipier 2' : 'Teammate 2';
                        const a1 = language === 'fr' ? 'Adversaire 1' : 'Opponent 1';
                        const a2 = language === 'fr' ? 'Adversaire 2' : 'Opponent 2';
                        const a3 = language === 'fr' ? 'Adversaire 3' : 'Opponent 3';
                        setMatch(prev => ({
                          ...prev,
                          format: f.id,
                          teamA: pCount === 1 ? [moi] : pCount === 2 ? [moi, eq] : [moi, eq, eq2],
                          teamB: pCount === 1 ? [a1] : pCount === 2 ? [a1, a2] : [a1, a2, a3],
                        }));
                      }}
                    >
                      <Text style={[s.formatChipText, match.format === f.id && s.formatChipTextActive]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>

              {/* Team A */}
              <Animated.View entering={FadeInUp.duration(300).delay(200)} style={s.setupSection}>
                <Text style={s.setupLabel}>{language === 'fr' ? 'MON EQUIPE' : 'MY TEAM'}</Text>
                {match.teamA.map((p, i) => (
                  <View key={`a-${i}`} style={s.playerInputRow}>
                    <View style={[s.playerDot, { backgroundColor: '#60A5FA' }]} />
                    <TextInput
                      style={s.playerInput}
                      value={p}
                      onChangeText={text => {
                        const updated = [...match.teamA];
                        updated[i] = text;
                        setMatch(prev => ({ ...prev, teamA: updated }));
                      }}
                      placeholderTextColor="#475569"
                    />
                  </View>
                ))}
              </Animated.View>

              {/* Team B */}
              <Animated.View entering={FadeInUp.duration(300).delay(300)} style={s.setupSection}>
                <Text style={s.setupLabel}>{language === 'fr' ? 'ADVERSAIRE' : 'OPPONENT'}</Text>
                {match.teamB.map((p, i) => (
                  <View key={`b-${i}`} style={s.playerInputRow}>
                    <View style={[s.playerDot, { backgroundColor: '#F59E0B' }]} />
                    <TextInput
                      style={s.playerInput}
                      value={p}
                      onChangeText={text => {
                        const updated = [...match.teamB];
                        updated[i] = text;
                        setMatch(prev => ({ ...prev, teamB: updated }));
                      }}
                      placeholderTextColor="#475569"
                    />
                  </View>
                ))}
              </Animated.View>
            </ScrollView>

            <View style={s.setupFooter}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={goNext}
              >
                <Text style={s.ctaPrimaryText}>
                  {language === 'fr' ? "C'est parti !" : "Let's go!"}
                </Text>
                <MaterialIcons name="play-arrow" size={22} color="#0F172A" />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- SCREEN 3: LIVE MENE SCORING ---
  if (step === 3) {
    return (
      <LinearGradient colors={['#0F172A', '#1E293B']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={goBack} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <ProgressDots current={1} total={3} />
            <View style={{ width: 24 }} />
          </View>

          {/* Score header */}
          <Animated.View entering={FadeIn.duration(300)} style={s.scoreHeader}>
            <View style={s.scoreTeam}>
              <Text style={s.scoreTeamName} numberOfLines={1}>{match.teamA[0]}</Text>
              <Text style={[s.scoreValue, { color: '#60A5FA' }]}>{match.scoreA}</Text>
            </View>
            <View style={s.scoreSeparator}>
              <Text style={s.scoreSepText}>-</Text>
              <Text style={s.meneCountText}>
                {language === 'fr' ? 'Mene' : 'End'} {match.menes.length + 1}
              </Text>
            </View>
            <View style={s.scoreTeam}>
              <Text style={s.scoreTeamName} numberOfLines={1}>{match.teamB[0]}</Text>
              <Text style={[s.scoreValue, { color: '#F59E0B' }]}>{match.scoreB}</Text>
            </View>
          </Animated.View>

          {/* First mene tooltip */}
          {match.menes.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(400)} style={s.tooltip}>
              <MaterialIcons name="info-outline" size={16} color="#60A5FA" />
              <Text style={s.tooltipText}>
                {language === 'fr'
                  ? 'Choisis qui marque, le nombre de points et l\'action.'
                  : 'Pick who scores, the points and the action.'}
              </Text>
            </Animated.View>
          ) : null}

          <ScrollView contentContainerStyle={s.meneContent} showsVerticalScrollIndicator={false}>
            {/* Team selector */}
            <View style={s.teamSelectorRow}>
              <Pressable
                style={[s.teamSelectBtn, currentMeneTeam === 'A' && s.teamSelectBtnActiveA]}
                onPress={() => { Haptics.selectionAsync(); setCurrentMeneTeam('A'); }}
              >
                <Text style={[s.teamSelectText, currentMeneTeam === 'A' && s.teamSelectTextActive]}>
                  {match.teamA[0]}
                </Text>
              </Pressable>
              <Pressable
                style={[s.teamSelectBtn, currentMeneTeam === 'B' && s.teamSelectBtnActiveB]}
                onPress={() => { Haptics.selectionAsync(); setCurrentMeneTeam('B'); }}
              >
                <Text style={[s.teamSelectText, currentMeneTeam === 'B' && s.teamSelectTextActive]}>
                  {match.teamB[0]}
                </Text>
              </Pressable>
            </View>

            {/* Points selector */}
            <View style={s.pointsRow}>
              {[1, 2, 3, 4, 5].map(p => (
                <Pressable
                  key={p}
                  style={[s.pointBtn, currentMenePoints === p && s.pointBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setCurrentMenePoints(p); }}
                >
                  <Text style={[s.pointBtnText, currentMenePoints === p && s.pointBtnTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            {/* Action selector */}
            <View style={s.actionRow}>
              {[
                { id: 'point' as const, icon: 'adjust', label: 'Point', color: '#10B981' },
                { id: 'tir' as const, icon: 'gps-fixed', label: language === 'fr' ? 'Tir' : 'Shot', color: '#3B82F6' },
                { id: 'carreau' as const, icon: 'star', label: 'Carreau', color: '#F59E0B' },
              ].map(a => (
                <Pressable
                  key={a.id}
                  style={[s.actionBtn, currentAction === a.id && { borderColor: a.color, backgroundColor: a.color + '20' }]}
                  onPress={() => { Haptics.selectionAsync(); setCurrentAction(a.id); }}
                >
                  <MaterialIcons name={a.icon as any} size={24} color={currentAction === a.id ? a.color : '#64748B'} />
                  <Text style={[s.actionBtnText, currentAction === a.id && { color: a.color }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Validate mene */}
            <Pressable
              style={[s.validateBtn, !currentMeneTeam && { opacity: 0.4 }]}
              onPress={addMene}
              disabled={!currentMeneTeam}
            >
              <MaterialIcons name="check" size={22} color="#FFF" />
              <Text style={s.validateBtnText}>
                {language === 'fr' ? 'Valider la mene' : 'Validate end'}
              </Text>
            </Pressable>

            {/* Mene history mini */}
            {match.menes.length > 0 ? (
              <View style={s.meneHistory}>
                {match.menes.slice(-5).map((m, i) => (
                  <View key={i} style={s.meneHistoryItem}>
                    <Text style={s.meneHistoryText}>
                      {m.teamAScore > 0 ? `${match.teamA[0]} +${m.teamAScore}` : `${match.teamB[0]} +${m.teamBScore}`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          {/* Simulate finish */}
          {match.menes.length >= 2 && !match.finished ? (
            <View style={s.simFooter}>
              <Pressable style={s.simBtn} onPress={simulateFinish}>
                <MaterialIcons name="fast-forward" size={18} color="#94A3B8" />
                <Text style={s.simBtnText}>
                  {language === 'fr' ? 'Simuler la fin' : 'Simulate finish'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- SCREEN 4: WOW STATS ---
  if (step === 4) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <ScrollView contentContainerStyle={s.statsContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(600)}>
              <Text style={s.statsEmoji}>{isMatchWon ? '🏆' : '💪'}</Text>
              <Text style={s.statsTitle}>
                {isMatchWon
                  ? (language === 'fr' ? 'MATCH GAGNE !' : 'MATCH WON!')
                  : (language === 'fr' ? 'MATCH TERMINE !' : 'MATCH FINISHED!')}
              </Text>
              <Text style={s.statsScore}>{match.scoreA} - {match.scoreB}</Text>
            </Animated.View>

            {/* Stats cards */}
            <Animated.View entering={FadeInUp.duration(500).delay(300)} style={s.statsCardsRow}>
              <View style={s.statsCard}>
                <AnimatedCounter value={match.stats.successRate} suffix="%" />
                <Text style={s.statsCardLabel}>{language === 'fr' ? 'Reussite' : 'Success'}</Text>
              </View>
              <View style={s.statsCard}>
                <AnimatedCounter value={match.stats.successfulShots} suffix={`/${match.stats.totalShots}`} />
                <Text style={s.statsCardLabel}>{language === 'fr' ? 'Tirs' : 'Shots'}</Text>
              </View>
              <View style={s.statsCard}>
                <AnimatedCounter value={match.stats.carreaux} />
                <Text style={s.statsCardLabel}>{match.stats.carreaux === 1 ? 'Carreau' : 'Carreaux'}</Text>
              </View>
            </Animated.View>

            {/* Teaser message */}
            <Animated.View entering={FadeInUp.duration(500).delay(600)} style={s.teaserBox}>
              <MaterialIcons name="emoji-events" size={20} color="#F59E0B" />
              <Text style={s.teaserText}>
                {language === 'fr'
                  ? '4 matchs de plus et tu debloqueras ton classement communautaire 🏅'
                  : '4 more matches and you will unlock the community leaderboard 🏅'}
              </Text>
            </Animated.View>

            {/* CTAs */}
            <Animated.View entering={FadeInUp.duration(500).delay(800)} style={{ width: '100%' }}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={goNext}
              >
                <MaterialIcons name="share" size={20} color="#0F172A" />
                <Text style={s.ctaPrimaryText}>
                  {language === 'fr' ? 'Partager ce match' : 'Share this match'}
                </Text>
              </Pressable>
              <Pressable style={s.ctaOutline} onPress={() => setStep(6)}>
                <Text style={s.ctaOutlineText}>
                  {language === 'fr' ? 'Voir le detail' : 'See details'}
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- SCREEN 5: CROSS-PLAYER SHARING ---
  if (step === 5) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={goBack} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <ProgressDots current={2} total={3} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.shareContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)} style={s.shareImageWrap}>
              <Image
                source={require('@/assets/images/onboarding-share.png')}
                style={s.shareImage}
                contentFit="contain"
                transition={200}
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(500).delay(200)}>
              <Text style={s.shareTitle}>
                {language === 'fr' ? 'Tes equipiers utilisent l\'app ?' : 'Your teammates use the app?'}
              </Text>
              <Text style={s.shareSubtitle}>
                {language === 'fr'
                  ? 'Partage ce match — il apparaitra automatiquement dans leurs stats.'
                  : 'Share this match — it will automatically appear in their stats.'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={s.howItWorks}>
              {[
                { num: '1', text: language === 'fr' ? 'Tu partages le match' : 'You share the match' },
                { num: '2', text: language === 'fr' ? 'Ils acceptent en 1 tap' : 'They accept in 1 tap' },
                { num: '3', text: language === 'fr' ? 'Vos stats se mettent a jour' : 'Your stats update automatically' },
              ].map((s2, i) => (
                <View key={i} style={s.howItWorksItem}>
                  <View style={s.howItWorksNum}>
                    <Text style={s.howItWorksNumText}>{s2.num}</Text>
                  </View>
                  <Text style={s.howItWorksText}>{s2.text}</Text>
                </View>
              ))}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(600)} style={{ width: '100%' }}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={goNext}
              >
                <Text style={s.ctaPrimaryText}>{language === 'fr' ? 'Continuer' : 'Continue'}</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#0F172A" />
              </Pressable>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- SCREEN 6: MAP DISCOVERY ---
  if (step === 6) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={() => setStep(5)} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <View style={{ width: 24 }} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.mapContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)}>
              <Text style={s.mapTitle}>
                {language === 'fr' ? 'Des joueurs pres de chez toi' : 'Players near you'}
              </Text>
              <Text style={s.mapSubtitle}>
                {language === 'fr'
                  ? 'Trouve des terrains, des clubs et des partenaires de jeu.'
                  : 'Find courts, clubs and playing partners.'}
              </Text>
            </Animated.View>

            {/* Mock map card */}
            <Animated.View entering={FadeInUp.duration(400).delay(200)} style={s.mapCard}>
              <View style={s.mapCardInner}>
                <MaterialIcons name="map" size={64} color="#1E3A8A" />
                <View style={s.mapStatsRow}>
                  <View style={s.mapStatItem}>
                    <MaterialIcons name="place" size={20} color="#10B981" />
                    <Text style={s.mapStatText}>
                      {language === 'fr' ? '3 terrains' : '3 courts'}
                    </Text>
                  </View>
                  <View style={s.mapStatItem}>
                    <MaterialIcons name="people" size={20} color="#3B82F6" />
                    <Text style={s.mapStatText}>
                      {language === 'fr' ? '12 joueurs' : '12 players'}
                    </Text>
                  </View>
                  <View style={s.mapStatItem}>
                    <MaterialIcons name="location-city" size={20} color="#F59E0B" />
                    <Text style={s.mapStatText}>
                      {language === 'fr' ? '2 clubs' : '2 clubs'}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={{ width: '100%' }}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => setStep(7)}
              >
                <Text style={s.ctaPrimaryText}>{language === 'fr' ? 'Continuer' : 'Continue'}</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#0F172A" />
              </Pressable>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- SCREEN 7: DEFERRED LOGIN ---
  if (step === 7) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <ScrollView contentContainerStyle={s.loginContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)}>
              <MaterialIcons name="save" size={48} color="#60A5FA" style={{ alignSelf: 'center', marginBottom: 16 }} />
              <Text style={s.loginTitle}>
                {language === 'fr' ? 'Sauvegarde ta progression' : 'Save your progress'}
              </Text>
              <Text style={s.loginSubtitle}>
                {language === 'fr'
                  ? 'Sans compte, tes stats seront perdues.'
                  : 'Without an account, your stats will be lost.'}
              </Text>
            </Animated.View>

            {/* Show user stats */}
            <Animated.View entering={FadeInUp.duration(400).delay(200)} style={s.loginStatsBox}>
              <View style={s.loginStatRow}>
                <MaterialIcons name="bar-chart" size={18} color="#60A5FA" />
                <Text style={s.loginStatText}>1 {language === 'fr' ? 'match enregistre' : 'match recorded'}</Text>
              </View>
              <View style={s.loginStatRow}>
                <MaterialIcons name="gps-fixed" size={18} color="#10B981" />
                <Text style={s.loginStatText}>{match.stats.successRate}% {language === 'fr' ? 'de reussite au tir' : 'shot success'}</Text>
              </View>
              <View style={s.loginStatRow}>
                <MaterialIcons name="star" size={18} color="#F59E0B" />
                <Text style={s.loginStatText}>{match.stats.carreaux} {match.stats.carreaux === 1 ? 'carreau' : 'carreaux'}</Text>
              </View>
            </Animated.View>

            {/* Benefits */}
            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={s.benefitsList}>
              {[
                language === 'fr' ? 'Garder ton historique' : 'Keep your history',
                language === 'fr' ? 'Apparaitre dans le classement' : 'Appear in the leaderboard',
                language === 'fr' ? 'Recevoir les matchs partages' : 'Receive shared matches',
                language === 'fr' ? 'Trouver des joueurs pres de toi' : 'Find players near you',
              ].map((b, i) => (
                <View key={i} style={s.benefitItem}>
                  <MaterialIcons name="check-circle" size={18} color="#10B981" />
                  <Text style={s.benefitText}>{b}</Text>
                </View>
              ))}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(600)} style={{ width: '100%' }}>
              {user ? (
                // User already logged in -> go to profile express
                <Pressable
                  style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                  onPress={() => setStep(8)}
                >
                  <MaterialIcons name="person" size={20} color="#0F172A" />
                  <Text style={s.ctaPrimaryText}>
                    {language === 'fr' ? 'Terminer mon profil' : 'Complete my profile'}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={() => router.push('/login')}
                  >
                    <MaterialIcons name="email" size={20} color="#0F172A" />
                    <Text style={s.ctaPrimaryText}>
                      {language === 'fr' ? 'Continuer avec email' : 'Continue with email'}
                    </Text>
                  </Pressable>
                </>
              )}

              <Pressable style={s.ctaSecondary} onPress={handleSkipLogin}>
                <Text style={s.ctaSecondaryText}>
                  {language === 'fr' ? 'Pas maintenant' : 'Not now'}
                </Text>
              </Pressable>
              <Text style={s.skipNote}>
                {language === 'fr'
                  ? 'Tes donnees restent sur cet appareil pendant 7 jours'
                  : 'Your data stays on this device for 7 days'}
              </Text>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // --- SCREEN 8: EXPRESS PROFILE (POST-LOGIN) ---
  if (step === 8) {
    const roles = [
      { id: 'Tireur' as PlayerRole, icon: 'gps-fixed', label: language === 'fr' ? 'Tireur' : 'Shooter' },
      { id: 'Pointeur' as PlayerRole, icon: 'adjust', label: language === 'fr' ? 'Pointeur' : 'Pointer' },
      { id: 'Milieu' as PlayerRole, icon: 'swap-horiz', label: language === 'fr' ? 'Milieu' : 'Middle' },
    ];

    // Pre-fill name from email
    const emailName = user?.email ? user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
    if (!username && emailName) {
      setUsername(emailName);
    }

    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={s.expressContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeInDown.duration(500)}>
                <Text style={s.expressTitle}>
                  {language === 'fr' ? 'Derniere touche ✨' : 'Final touch ✨'}
                </Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.duration(400).delay(200)} style={s.expressSection}>
                <Text style={s.expressLabel}>{language === 'fr' ? 'TON NOM' : 'YOUR NAME'}</Text>
                <TextInput
                  style={s.expressInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={language === 'fr' ? 'Ton nom ou pseudo' : 'Your name or nickname'}
                  placeholderTextColor="#475569"
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={30}
                />
              </Animated.View>

              <Animated.View entering={FadeInUp.duration(400).delay(300)} style={s.expressSection}>
                <Text style={s.expressLabel}>{language === 'fr' ? 'TU ES PLUTOT' : 'YOU ARE'}</Text>
                <View style={s.roleRow}>
                  {roles.map(r => (
                    <Pressable
                      key={r.id}
                      style={[s.roleBtn, role === r.id && s.roleBtnActive]}
                      onPress={() => { Haptics.selectionAsync(); setRole(r.id); }}
                    >
                      <MaterialIcons name={r.icon as any} size={28} color={role === r.id ? '#FFF' : '#94A3B8'} />
                      <Text style={[s.roleBtnText, role === r.id && s.roleBtnTextActive]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>

              <Animated.View entering={FadeInUp.duration(400).delay(400)} style={{ width: '100%' }}>
                <Pressable
                  style={[
                    s.ctaPrimary,
                    (!username.trim() || username.trim().length < 2) && { opacity: 0.4 },
                  ]}
                  onPress={handleComplete}
                  disabled={!username.trim() || username.trim().length < 2 || saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#0F172A" />
                  ) : (
                    <>
                      <MaterialIcons name="rocket-launch" size={20} color="#0F172A" />
                      <Text style={s.ctaPrimaryText}>
                        {language === 'fr' ? "C'est parti !" : "Let's go!"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return null;
}

// ============================================
// STYLES
// ============================================
const s = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },

  // --- Splash ---
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  splashImage: {
    width: 200,
    height: 200,
  },
  splashTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 24,
    letterSpacing: 1,
  },

  // --- Progress dots ---
  progressDots: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  progressDotActive: {
    backgroundColor: '#F59E0B',
    width: 24,
  },
  progressDotDone: {
    backgroundColor: '#60A5FA',
  },

  // --- Screen header ---
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  // --- Promise ---
  promiseContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  promiseImageWrap: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.7,
    marginBottom: 24,
  },
  promiseImage: {
    width: '100%',
    height: '100%',
  },
  promiseTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  promiseSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 32,
  },

  // --- CTAs ---
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F59E0B',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 12,
  },
  ctaPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  ctaSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  ctaOutline: {
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaOutlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // --- Setup ---
  setupContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  setupTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 6,
  },
  setupSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  setupSection: {
    marginBottom: 20,
  },
  setupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatChipActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#60A5FA15',
  },
  formatChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  formatChipTextActive: {
    color: '#60A5FA',
  },
  playerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 10,
  },
  playerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  playerInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  setupFooter: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // --- Mene scoring ---
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  scoreTeam: {
    flex: 1,
    alignItems: 'center',
  },
  scoreTeamName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  scoreSeparator: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  scoreSepText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#475569',
  },
  meneCountText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#60A5FA10',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  tooltipText: {
    fontSize: 13,
    color: '#60A5FA',
    flex: 1,
  },
  meneContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  teamSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  teamSelectBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  teamSelectBtnActiveA: {
    borderColor: '#60A5FA',
    backgroundColor: '#60A5FA15',
  },
  teamSelectBtnActiveB: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B15',
  },
  teamSelectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  teamSelectTextActive: {
    color: '#FFF',
  },
  pointsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  pointBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pointBtnActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B20',
  },
  pointBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#64748B',
  },
  pointBtnTextActive: {
    color: '#F59E0B',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  validateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  meneHistory: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  meneHistoryItem: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  meneHistoryText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  simFooter: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  simBtnText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // --- Stats wow ---
  statsContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  statsEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  statsScore: {
    fontSize: 48,
    fontWeight: '800',
    color: '#F59E0B',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 2,
  },
  statsCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  statsCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  teaserBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B10',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 32,
    gap: 10,
    width: '100%',
  },
  teaserText: {
    fontSize: 14,
    color: '#FCD34D',
    flex: 1,
    lineHeight: 20,
  },

  // --- Share ---
  shareContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  shareImageWrap: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.5,
    marginBottom: 20,
  },
  shareImage: {
    width: '100%',
    height: '100%',
  },
  shareTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  shareSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  howItWorks: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 32,
  },
  howItWorksItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  howItWorksNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#60A5FA20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howItWorksNumText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#60A5FA',
  },
  howItWorksText: {
    fontSize: 15,
    color: '#E2E8F0',
    flex: 1,
  },

  // --- Map ---
  mapContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  mapTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  mapSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  mapCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 2,
    marginBottom: 32,
    overflow: 'hidden',
  },
  mapCardInner: {
    backgroundColor: '#0F172A20',
    borderRadius: 18,
    paddingVertical: 40,
    alignItems: 'center',
  },
  mapStatsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
  },
  mapStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapStatText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // --- Login ---
  loginContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  loginTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loginStatsBox: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  loginStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginStatText: {
    fontSize: 15,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  benefitsList: {
    width: '100%',
    marginBottom: 32,
    gap: 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 15,
    color: '#CBD5E1',
  },
  skipNote: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 4,
  },

  // --- Express profile ---
  expressContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  expressTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 32,
  },
  expressSection: {
    width: '100%',
    marginBottom: 24,
  },
  expressLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
  },
  expressInput: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 18,
    fontWeight: '500',
    color: '#E2E8F0',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleBtnActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#60A5FA15',
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  roleBtnTextActive: {
    color: '#60A5FA',
  },
});
