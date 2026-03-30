import React, { useState, useEffect, useCallback } from 'react';
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
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import theme from '@/constants/theme';
import config, { PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { fetchAmbassadors, Ambassador, generateReferralCode } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';

// ============================================
// TYPES
// ============================================
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const ONBOARDING_KEY = 'hasSeenOnboarding';

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
  const { updatePlayer } = useApp();
  const supabase = getSupabaseClient();
  const { t, language, setLanguage } = useLanguage();

  const [step, setStep] = useState<Step>(0);
  const [saving, setSaving] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // Profile state (post-login)
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<PlayerRole | null>(null);

  // Gold sponsor for onboarding
  const [goldSponsor, setGoldSponsor] = useState<Ambassador | null>(null);
  const [eliteAmbassador, setEliteAmbassador] = useState<Ambassador | null>(null);
  const [sponsorLoaded, setSponsorLoaded] = useState(false);

  // Referral state
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  useEffect(() => {
    fetchAmbassadors().then(({ ambassadors }) => {
      const gold = ambassadors.find(a => a.badgeType === 'gold_sponsor');
      if (gold) setGoldSponsor(gold);
      else {
        const sp = ambassadors.find(a => a.badgeType === 'sponsor' && a.isFeatured);
        if (sp) setGoldSponsor(sp);
      }
      const elite = ambassadors.find(a => a.badgeType === 'ambassador' && a.ambassadorLevel === 'elite' && a.isFeatured);
      if (elite) setEliteAmbassador(elite);
      setSponsorLoaded(true);
    }).catch(() => setSponsorLoaded(true));
  }, []);

  // Splash timer
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-advance from splash to language picker
  useEffect(() => {
    if (splashDone && step === 0) {
      setStep(1);
    }
  }, [splashDone]);

  // If user is already logged in (returned from /login after account creation),
  // skip directly to Express Profile (step 7)
  useEffect(() => {
    if (user && step >= 1 && step < 7) {
      setStep(7 as Step);
    }
  }, [user]);

  // Load referral code when reaching step 8
  useEffect(() => {
    if (step === 8 && user?.id && !referralCode) {
      loadOrCreateReferralCode();
    }
  }, [step, user?.id]);

  const loadOrCreateReferralCode = useCallback(async () => {
    if (!user?.id) return;
    setReferralLoading(true);
    try {
      // Check if user has an ambassador entry with a referral code
      const { data: amb } = await supabase
        .from('ambassadors')
        .select('id, referral_code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (amb?.referral_code) {
        setReferralCode(amb.referral_code);
      } else {
        // Generate a simple personal referral code from username
        const initials = (username || 'UP').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'UP';
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let suffix = '';
        for (let i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        const code = `${initials}-${suffix}`;
        setReferralCode(code);

        // If user is an ambassador, save to DB
        if (amb?.id) {
          await generateReferralCode(amb.id, username || 'User');
        }
      }
    } catch {
      // Generate a fallback code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = 'UP-';
      for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      setReferralCode(code);
    } finally {
      setReferralLoading(false);
    }
  }, [user?.id, username]);

  const handleShareReferral = useCallback(async () => {
    const code = referralCode || 'UP-APP';
    const shareUrl = `https://ultimatepetanque.app/?ref=${code}`;
    const message = language === 'fr'
      ? `Rejoins-moi sur Ultimate Petanque ! Suis tes matchs, progresse et trouve des joueurs. Utilise mon code : ${code}\n${shareUrl}`
      : `Join me on Ultimate Petanque! Track your matches, improve and find players. Use my code: ${code}\n${shareUrl}`;

    try {
      await Share.share({ message, url: shareUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { /* cancelled */ }
  }, [referralCode, language]);

  // ============================================
  // NAVIGATION
  // ============================================
  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 2 && !goldSponsor && !eliteAmbassador) {
      // Skip sponsor/ambassador step
      setStep(4 as Step);
      return;
    }
    setStep(prev => Math.min(8, prev + 1) as Step);
  };

  const goBack = () => {
    Haptics.selectionAsync();
    if (step === 4 && !goldSponsor && !eliteAmbassador) {
      setStep(2 as Step);
      return;
    }
    setStep(prev => Math.max(1, prev - 1) as Step);
  };

  // ============================================
  // HANDLE COMPLETE (POST-LOGIN PROFILE SAVE)
  // ============================================
  const handleComplete = async () => {
    if (!username.trim()) {
      showAlert(t('common', 'error'), language === 'fr' ? 'Le nom est requis' : 'Name is required');
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Go to referral step instead of finishing
      setStep(8 as Step);
    } catch (error: any) {
      showAlert(t('common', 'error'), error.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Final completion (after referral step)
  const handleFinalComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/consent');
  };

  // Determine the featured entity for step 3
  const featuredEntity = goldSponsor || eliteAmbassador;
  const entityType: 'sponsor' | 'ambassador' = goldSponsor ? 'sponsor' : 'ambassador';

  // ============================================
  // STEP 0: ANIMATED SPLASH
  // ============================================
  if (step === 0) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.splashContainer}>
            <Animated.View entering={FadeIn.duration(800)}>
              <Image
                source={require('@/assets/images/app-logo.png')}
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

  // ============================================
  // STEP 1: LANGUAGE SELECTION
  // ============================================
  if (step === 1) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <ScrollView contentContainerStyle={s.langContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)} style={s.langHeader}>
              <MaterialIcons name="translate" size={44} color="#60A5FA" />
              <Text style={s.langTitle}>Choose your language</Text>
              <Text style={s.langSubtitle}>Choisissez votre langue</Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(200)} style={s.langOptions}>
              <Pressable
                style={({ pressed }) => [
                  s.langOption,
                  language === 'fr' && s.langOptionActive,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => { Haptics.selectionAsync(); setLanguage('fr'); }}
              >
                <Text style={s.langFlag}>🇫🇷</Text>
                <View style={s.langOptionInfo}>
                  <Text style={[s.langOptionTitle, language === 'fr' && s.langOptionTitleActive]}>Français</Text>
                  <Text style={s.langOptionDesc}>Langue de Moliere et de la petanque</Text>
                </View>
                {language === 'fr' ? (
                  <View style={s.langCheck}>
                    <MaterialIcons name="check" size={16} color="#FFF" />
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  s.langOption,
                  language === 'en' && s.langOptionActive,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => { Haptics.selectionAsync(); setLanguage('en'); }}
              >
                <Text style={s.langFlag}>🇬🇧</Text>
                <View style={s.langOptionInfo}>
                  <Text style={[s.langOptionTitle, language === 'en' && s.langOptionTitleActive]}>English</Text>
                  <Text style={s.langOptionDesc}>For the international community</Text>
                </View>
                {language === 'en' ? (
                  <View style={s.langCheck}>
                    <MaterialIcons name="check" size={16} color="#FFF" />
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={goNext}
              >
                <Text style={s.ctaPrimaryText}>
                  {language === 'fr' ? 'Continuer' : 'Continue'}
                </Text>
                <MaterialIcons name="arrow-forward" size={20} color="#0F172A" />
              </Pressable>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ============================================
  // STEP 2: PROMISE
  // ============================================
  if (step === 2) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <ScrollView contentContainerStyle={s.promiseContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)} style={s.promiseImageWrap}>
              <Image
                source={require('@/assets/images/app-logo.png')}
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
            <Animated.View entering={FadeInUp.duration(500).delay(400)} style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={goNext}
              >
                <Text style={s.ctaPrimaryText}>
                  {language === 'fr' ? "Decouvrir l'application" : 'Discover the app'}
                </Text>
                <MaterialIcons name="arrow-forward" size={22} color="#0F172A" />
              </Pressable>
              {user ? null : (
                <Pressable style={s.ctaSecondary} onPress={async () => {
                  await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
                  router.replace('/login');
                }}>
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

  // ============================================
  // STEP 3: SPONSOR / AMBASSADOR (IMPROVED UI)
  // ============================================
  if (step === 3 && featuredEntity) {
    const entity = featuredEntity;
    const isSponsor = entityType === 'sponsor';
    const accentColor = isSponsor ? '#F59E0B' : '#A78BFA';
    const gradientColors = isSponsor ? ['#FFFBEB', '#FEF3C7'] : ['#EDE9FE', '#DDD6FE'];
    const darkAccent = isSponsor ? '#78350F' : '#4C1D95';
    const labelText = isSponsor
      ? (language === 'fr' ? 'PARTENAIRE OFFICIEL' : 'OFFICIAL PARTNER')
      : (language === 'fr' ? 'AMBASSADEUR ELITE' : 'ELITE AMBASSADOR');
    const badgeIcon = isSponsor ? 'workspace-premium' : 'military-tech';
    const messageText = isSponsor
      ? (language === 'fr'
        ? `${entity.displayName} soutient la communaute des joueurs de petanque et rend cette application possible. Merci !`
        : `${entity.displayName} supports the petanque community and makes this app possible. Thank you!`)
      : (language === 'fr'
        ? `${entity.displayName} est un ambassadeur Elite de la communaute. Suivez-le pour des defis, conseils et contenus exclusifs !`
        : `${entity.displayName} is an Elite ambassador of the community. Follow for challenges, tips and exclusive content!`);

    const socials: { icon: string; color: string; label: string; url: string; platform: string }[] = [];
    if (entity.websiteUrl) socials.push({ icon: 'language', color: '#60A5FA', label: language === 'fr' ? 'Site web' : 'Website', url: entity.websiteUrl, platform: 'website' });
    if (entity.youtubeUrl) socials.push({ icon: 'play-circle-filled', color: '#FF0000', label: 'YouTube', url: entity.youtubeUrl, platform: 'youtube' });
    if (entity.instagramHandle) socials.push({ icon: 'camera-alt', color: '#E4405F', label: 'Instagram', url: `https://instagram.com/${entity.instagramHandle}`, platform: 'instagram' });
    if (entity.tiktokUrl) socials.push({ icon: 'music-note', color: '#000', label: 'TikTok', url: entity.tiktokUrl, platform: 'tiktok' });

    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={goBack} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <ProgressDots current={1} total={6} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.sponsorContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(400)} style={s.sponsorLabelRow}>
              <View style={[s.sponsorLabelLine, { backgroundColor: accentColor + '40' }]} />
              <View style={[s.sponsorLabelBadge, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
                <MaterialIcons name={badgeIcon as any} size={14} color={accentColor} />
                <Text style={[s.sponsorLabelText, { color: accentColor }]}>{labelText}</Text>
              </View>
              <View style={[s.sponsorLabelLine, { backgroundColor: accentColor + '40' }]} />
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(500).delay(150)} style={[s.sponsorCard, { borderColor: accentColor + '30' }]}>
              <View style={s.sponsorCardTop}>
                <View style={[s.sponsorPhotoWrap, { borderColor: accentColor }]}>
                  {entity.photo ? (
                    <Image source={{ uri: entity.photo }} style={s.sponsorPhoto} contentFit="cover" transition={300} />
                  ) : (
                    <LinearGradient colors={isSponsor ? ['#B45309', '#F59E0B'] : ['#7C3AED', '#9333EA']} style={s.sponsorPhotoFallback}>
                      <MaterialIcons name={badgeIcon as any} size={32} color="#FFF" />
                    </LinearGradient>
                  )}
                  <View style={[s.sponsorPhotoBadge, { backgroundColor: accentColor }]}>
                    <MaterialIcons name={isSponsor ? 'star' : 'military-tech'} size={10} color="#FFF" />
                  </View>
                </View>
                <View style={s.sponsorCardNameCol}>
                  <Text style={s.sponsorCardName}>{entity.displayName}</Text>
                  {entity.bio ? (
                    <Text style={s.sponsorCardBio} numberOfLines={2}>{entity.bio}</Text>
                  ) : null}
                </View>
              </View>

              <LinearGradient
                colors={gradientColors as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.sponsorMsgBox}
              >
                <View style={[s.sponsorMsgAccent, { backgroundColor: accentColor }]} />
                <MaterialIcons name="format-quote" size={18} color={accentColor} style={{ opacity: 0.4 }} />
                <Text style={[s.sponsorMsgText, { color: darkAccent }]}>{messageText}</Text>
              </LinearGradient>

              {socials.length > 0 ? (
                <View style={s.sponsorSocialsRow}>
                  {socials.map((sc, i) => (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [s.sponsorSocialBtn, pressed && { opacity: 0.8 }]}
                      onPress={() => {
                        trackAmbassadorEvent(entity.id, 'social_click', sc.platform, { sourcePage: 'onboarding' });
                        Linking.openURL(sc.url);
                      }}
                    >
                      <MaterialIcons name={sc.icon as any} size={16} color={sc.color} />
                      <Text style={s.sponsorSocialLabel}>{sc.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => {
                  trackAmbassadorEvent(entity.id, 'banner_impression', undefined, { sourcePage: 'onboarding' });
                  goNext();
                }}
              >
                <Text style={s.ctaPrimaryText}>{language === 'fr' ? 'Continuer' : 'Continue'}</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#0F172A" />
              </Pressable>
              <Pressable style={s.ctaSecondary} onPress={goNext}>
                <Text style={s.ctaSecondaryText}>{language === 'fr' ? 'Passer' : 'Skip'}</Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ============================================
  // STEP 4: APP FEATURES EXPLANATION
  // ============================================
  if (step === 3 || step === 4) {
    const features = [
      {
        icon: 'sports',
        color: '#60A5FA',
        title: language === 'fr' ? 'Enregistre tes matchs' : 'Record your matches',
        desc: language === 'fr'
          ? 'Score, tirs, carreaux et stats detaillees.'
          : 'Score, shots, carreaux and detailed stats.',
      },
      {
        icon: 'bar-chart',
        color: '#10B981',
        title: language === 'fr' ? 'Analyse ta progression' : 'Track your progress',
        desc: language === 'fr'
          ? 'Taux de tir, win rate, evolution semaine par semaine.'
          : 'Shot rate, win rate, weekly evolution.',
      },
      {
        icon: 'share',
        color: '#EC4899',
        title: language === 'fr' ? 'Partage avec tes equipiers' : 'Share with teammates',
        desc: language === 'fr'
          ? 'Tes partenaires acceptent en 1 tap.'
          : 'Your partners accept in 1 tap.',
      },
      {
        icon: 'emoji-events',
        color: '#F59E0B',
        title: language === 'fr' ? 'Gagne des badges & XP' : 'Earn badges & XP',
        desc: language === 'fr'
          ? 'Debloque des badges et entre dans le classement.'
          : 'Unlock badges and enter the leaderboard.',
      },
    ];

    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={goBack} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <ProgressDots current={2} total={6} />
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)}>
              <Text style={s.pageTitle}>
                {language === 'fr' ? 'Tout pour ta petanque' : 'Everything for your game'}
              </Text>
              <Text style={s.pageSubtitle}>
                {language === 'fr'
                  ? 'Une app complete pour suivre, progresser et partager.'
                  : 'A complete app to track, improve and share.'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(500).delay(200)} style={s.featuresList}>
              {features.map((f, i) => (
                <Animated.View
                  key={i}
                  entering={FadeInUp.duration(400).delay(300 + i * 80)}
                  style={s.featureRow}
                >
                  <View style={[s.featureIconWrap, { backgroundColor: f.color + '18' }]}>
                    <MaterialIcons name={f.icon as any} size={22} color={f.color} />
                  </View>
                  <View style={s.featureInfo}>
                    <Text style={s.featureTitle}>{f.title}</Text>
                    <Text style={s.featureDesc}>{f.desc}</Text>
                  </View>
                </Animated.View>
              ))}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(700)} style={s.featureTeaser}>
              <MaterialIcons name="auto-awesome" size={16} color="#FCD34D" />
              <Text style={s.featureTeaserText}>
                {language === 'fr'
                  ? 'Et bien plus : tournois, defis solo, score de confiance...'
                  : 'And much more: tournaments, solo challenges, trust score...'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(800)} style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => setStep(5 as Step)}
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

  // ============================================
  // STEP 5: MAP DISCOVERY
  // ============================================
  if (step === 5) {
    const mapFeatures = [
      { icon: 'place', color: '#10B981', label: language === 'fr' ? 'Terrains pres de toi' : 'Courts near you' },
      { icon: 'people', color: '#3B82F6', label: language === 'fr' ? 'Joueurs a proximite' : 'Nearby players' },
      { icon: 'location-city', color: '#F59E0B', label: language === 'fr' ? 'Clubs de ta region' : 'Local clubs' },
      { icon: 'event', color: '#EC4899', label: language === 'fr' ? 'Rencontres & meetups' : 'Meetups & events' },
    ];

    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={() => setStep(4 as Step)} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <ProgressDots current={3} total={6} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)}>
              <Text style={s.pageTitle}>
                {language === 'fr' ? 'Des joueurs pres de chez toi' : 'Players near you'}
              </Text>
              <Text style={s.pageSubtitle}>
                {language === 'fr'
                  ? 'Explore la carte interactive pour trouver tout ce qu\'il te faut.'
                  : 'Explore the interactive map to find everything you need.'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(200)} style={s.mapCard}>
              <View style={s.mapCardInner}>
                <View style={s.mapIconRow}>
                  <View style={s.mapMainIcon}>
                    <MaterialIcons name="map" size={48} color="#1E3A8A" />
                  </View>
                  <View style={s.mapPinFloat1}>
                    <MaterialIcons name="place" size={18} color="#10B981" />
                  </View>
                  <View style={s.mapPinFloat2}>
                    <MaterialIcons name="person-pin" size={16} color="#3B82F6" />
                  </View>
                  <View style={s.mapPinFloat3}>
                    <MaterialIcons name="flag" size={14} color="#F59E0B" />
                  </View>
                </View>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={s.mapFeaturesList}>
              {mapFeatures.map((f, i) => (
                <Animated.View key={i} entering={FadeInUp.duration(300).delay(450 + i * 60)} style={s.mapFeatureItem}>
                  <View style={[s.mapFeatureIcon, { backgroundColor: f.color + '18' }]}>
                    <MaterialIcons name={f.icon as any} size={18} color={f.color} />
                  </View>
                  <Text style={s.mapFeatureLabel}>{f.label}</Text>
                </Animated.View>
              ))}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(700)} style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => setStep(6 as Step)}
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

  // ============================================
  // STEP 6: DEFERRED LOGIN
  // ============================================
  if (step === 6) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={() => setStep(5 as Step)} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <ProgressDots current={4} total={6} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center' }}>
              <MaterialIcons name="rocket-launch" size={40} color="#60A5FA" style={{ marginBottom: 12 }} />
              <Text style={s.pageTitle}>
                {language === 'fr' ? 'Pret a jouer ?' : 'Ready to play?'}
              </Text>
              <Text style={s.pageSubtitle}>
                {language === 'fr'
                  ? 'Cree ton compte gratuit pour sauvegarder tes stats et rejoindre la communaute.'
                  : 'Create your free account to save your stats and join the community.'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(200)} style={s.benefitsList}>
              {[
                { icon: 'save', text: language === 'fr' ? 'Garder ton historique de matchs' : 'Keep your match history' },
                { icon: 'leaderboard', text: language === 'fr' ? 'Apparaitre dans le classement' : 'Appear in the leaderboard' },
                { icon: 'group-add', text: language === 'fr' ? 'Recevoir les matchs partages' : 'Receive shared matches' },
                { icon: 'map', text: language === 'fr' ? 'Trouver des joueurs pres de toi' : 'Find players near you' },
                { icon: 'military-tech', text: language === 'fr' ? 'Debloquer des badges et XP' : 'Unlock badges and XP' },
              ].map((b, i) => (
                <Animated.View key={i} entering={FadeInUp.duration(300).delay(250 + i * 50)} style={s.benefitItem}>
                  <View style={s.benefitIconWrap}>
                    <MaterialIcons name={b.icon as any} size={16} color="#10B981" />
                  </View>
                  <Text style={s.benefitText}>{b.text}</Text>
                </Animated.View>
              ))}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(600)} style={s.ctaContainer}>
              {user ? (
                <Pressable
                  style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                  onPress={() => setStep(7 as Step)}
                >
                  <MaterialIcons name="person" size={20} color="#0F172A" />
                  <Text style={s.ctaPrimaryText}>
                    {language === 'fr' ? 'Terminer mon profil' : 'Complete my profile'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                  onPress={() => {
                    router.replace('/login');
                  }}
                >
                  <MaterialIcons name="email" size={20} color="#0F172A" />
                  <Text style={s.ctaPrimaryText}>
                    {language === 'fr' ? 'Creer mon compte' : 'Create my account'}
                  </Text>
                </Pressable>
              )}

              <Pressable style={s.ctaSecondary} onPress={async () => {
                await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
                showAlert(
                  language === 'fr' ? 'Bienvenue !' : 'Welcome!',
                  language === 'fr'
                    ? 'Vous pouvez creer un compte plus tard depuis votre profil.'
                    : 'You can create an account later from your profile.'
                );
                router.replace('/(tabs)');
              }}>
                <Text style={s.ctaSecondaryText}>
                  {language === 'fr' ? 'Pas maintenant' : 'Not now'}
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ============================================
  // STEP 7: EXPRESS PROFILE ("Dernière Touche")
  // ============================================
  if (step === 7) {
    const roles = [
      { id: 'Tireur' as PlayerRole, icon: 'gps-fixed', label: language === 'fr' ? 'Tireur' : 'Shooter' },
      { id: 'Pointeur' as PlayerRole, icon: 'adjust', label: language === 'fr' ? 'Pointeur' : 'Pointer' },
      { id: 'Milieu' as PlayerRole, icon: 'swap-horiz', label: language === 'fr' ? 'Milieu' : 'Middle' },
    ];

    const emailName = user?.email ? user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '';
    if (!username && emailName) {
      setUsername(emailName);
    }

    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.screenHeader}>
              <Pressable onPress={() => setStep(6 as Step)} hitSlop={12}>
                <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
              </Pressable>
              <ProgressDots current={5} total={6} />
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeInDown.duration(500)}>
                <Text style={s.pageTitle}>
                  {language === 'fr' ? 'Derniere touche' : 'Final touch'}
                </Text>
                <Text style={s.pageSubtitle}>
                  {language === 'fr'
                    ? 'Ton nom et ton poste de jeu. Tu pourras completer ton profil plus tard.'
                    : 'Your name and play position. You can complete your profile later.'}
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
                      <MaterialIcons name={r.icon as any} size={26} color={role === r.id ? '#FFF' : '#94A3B8'} />
                      <Text style={[s.roleBtnText, role === r.id && s.roleBtnTextActive]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>

              <Animated.View entering={FadeInUp.duration(400).delay(400)} style={s.ctaContainer}>
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
                      <MaterialIcons name="arrow-forward" size={20} color="#0F172A" />
                      <Text style={s.ctaPrimaryText}>
                        {language === 'fr' ? 'Continuer' : 'Continue'}
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

  // ============================================
  // STEP 8: INVITE FRIENDS (REFERRAL)
  // ============================================
  if (step === 8) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={() => setStep(7 as Step)} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <ProgressDots current={5} total={6} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center' }}>
              <View style={s.referralIconWrap}>
                <MaterialIcons name="group-add" size={40} color="#EC4899" />
              </View>
              <Text style={s.pageTitle}>
                {language === 'fr' ? 'Invite tes amis !' : 'Invite your friends!'}
              </Text>
              <Text style={s.pageSubtitle}>
                {language === 'fr'
                  ? 'Partage ton code de parrainage et gagne des XP pour chaque ami qui rejoint la communaute.'
                  : 'Share your referral code and earn XP for every friend who joins the community.'}
              </Text>
            </Animated.View>

            {/* Referral code card */}
            <Animated.View entering={FadeInUp.duration(500).delay(200)} style={s.referralCard}>
              <Text style={s.referralCardLabel}>
                {language === 'fr' ? 'TON CODE DE PARRAINAGE' : 'YOUR REFERRAL CODE'}
              </Text>
              {referralLoading ? (
                <ActivityIndicator color="#EC4899" style={{ marginVertical: 16 }} />
              ) : (
                <View style={s.referralCodeBox}>
                  <Text style={s.referralCodeText}>{referralCode || '...'}</Text>
                </View>
              )}
              <View style={s.referralRewards}>
                {[
                  { icon: 'star', color: '#F59E0B', text: language === 'fr' ? '+50 XP par ami invite' : '+50 XP per invited friend' },
                  { icon: 'emoji-events', color: '#7C3AED', text: language === 'fr' ? 'Debloquer le badge Parrain' : 'Unlock the Referrer badge' },
                  { icon: 'trending-up', color: '#10B981', text: language === 'fr' ? 'Monter dans le classement' : 'Climb the leaderboard' },
                ].map((r, i) => (
                  <Animated.View key={i} entering={FadeInUp.duration(300).delay(350 + i * 60)} style={s.referralRewardItem}>
                    <MaterialIcons name={r.icon as any} size={16} color={r.color} />
                    <Text style={s.referralRewardText}>{r.text}</Text>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>

            {/* Share button */}
            <Animated.View entering={FadeInUp.duration(400).delay(600)} style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.referralShareBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={handleShareReferral}
              >
                <MaterialIcons name="share" size={20} color="#FFF" />
                <Text style={s.referralShareBtnText}>
                  {language === 'fr' ? 'Partager mon code' : 'Share my code'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [s.ctaPrimary, { marginTop: 8 }, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={handleFinalComplete}
              >
                <MaterialIcons name="rocket-launch" size={20} color="#0F172A" />
                <Text style={s.ctaPrimaryText}>
                  {language === 'fr' ? "C'est parti !" : "Let's go!"}
                </Text>
              </Pressable>

              <Pressable style={s.ctaSecondary} onPress={handleFinalComplete}>
                <Text style={s.ctaSecondaryText}>
                  {language === 'fr' ? 'Plus tard' : 'Later'}
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
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
    width: 180,
    height: 180,
  },
  splashTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 20,
    letterSpacing: 1,
  },

  // --- Progress dots ---
  progressDots: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#334155',
  },
  progressDotActive: {
    backgroundColor: '#F59E0B',
    width: 20,
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
    paddingVertical: 10,
  },

  // --- Shared scrollable content (no centering — allows proper scroll on small screens) ---
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },

  // --- Shared page title ---
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },

  // --- Shared CTA container ---
  ctaContainer: {
    width: '100%',
    marginTop: 'auto' as any,
    paddingTop: 16,
  },

  // --- Language picker ---
  langContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 32,
  },
  langHeader: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  langTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  langSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
  },
  langOptions: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langOptionActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#60A5FA10',
  },
  langFlag: {
    fontSize: 32,
  },
  langOptionInfo: {
    flex: 1,
  },
  langOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 2,
  },
  langOptionTitleActive: {
    color: '#FFF',
  },
  langOptionDesc: {
    fontSize: 12,
    color: '#64748B',
  },
  langCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Promise ---
  promiseContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 32,
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  promiseImageWrap: {
    width: 150,
    height: 150,
    marginBottom: 16,
  },
  promiseImage: {
    width: '100%',
    height: '100%',
  },
  promiseTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  promiseSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },

  // --- CTAs ---
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 8,
  },
  ctaPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  ctaSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // --- Sponsor / Ambassador ---
  sponsorContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  sponsorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sponsorLabelLine: {
    width: 28,
    height: 1,
  },
  sponsorLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  sponsorLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sponsorCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
    gap: 16,
  },
  sponsorCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sponsorPhotoWrap: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  sponsorPhoto: {
    width: '100%',
    height: '100%',
  },
  sponsorPhotoFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorPhotoBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  sponsorCardNameCol: {
    flex: 1,
  },
  sponsorCardName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 3,
  },
  sponsorCardBio: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  sponsorMsgBox: {
    borderRadius: 14,
    padding: 14,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  sponsorMsgAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  sponsorMsgText: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  sponsorSocialsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sponsorSocialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sponsorSocialLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },

  // --- Features explanation ---
  featuresList: {
    width: '100%',
    gap: 10,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  featureTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B10',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  featureTeaserText: {
    fontSize: 12,
    color: '#FCD34D',
    flex: 1,
    lineHeight: 17,
  },

  // --- Map ---
  mapCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  mapCardInner: {
    backgroundColor: '#0F172A20',
    borderRadius: 18,
    paddingVertical: 24,
    alignItems: 'center',
  },
  mapIconRow: {
    width: 100,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mapMainIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#60A5FA15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinFloat1: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#10B98118',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinFloat2: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#3B82F618',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinFloat3: {
    position: 'absolute',
    top: 6,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#F59E0B18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFeaturesList: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  mapFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  mapFeatureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFeatureLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    flex: 1,
  },

  // --- Benefits (login step) ---
  benefitsList: {
    width: '100%',
    marginBottom: 16,
    gap: 8,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  benefitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#10B98118',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '500',
    flex: 1,
  },

  // --- Express profile ---
  expressSection: {
    width: '100%',
    marginBottom: 20,
  },
  expressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8,
  },
  expressInput: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '500',
    color: '#E2E8F0',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleBtnActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#60A5FA15',
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  roleBtnTextActive: {
    color: '#60A5FA',
  },

  // --- Referral step ---
  referralIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#EC489918',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  referralCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EC489930',
  },
  referralCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  referralCodeBox: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1.5,
    borderColor: '#EC489940',
    borderStyle: 'dashed' as any,
    marginBottom: 16,
  },
  referralCodeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#EC4899',
    letterSpacing: 2,
  },
  referralRewards: {
    width: '100%',
    gap: 8,
  },
  referralRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  referralRewardText: {
    fontSize: 13,
    color: '#CBD5E1',
    fontWeight: '500',
    flex: 1,
  },
  referralShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#EC4899',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 4,
  },
  referralShareBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
