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
import { trackOnboardingStep } from '@/services/onboardingAnalyticsService';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';

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
  const [profileLocation, setProfileLocation] = useState<LocationData>({
    address: '', city: '', country: 'France', latitude: 0, longitude: 0,
  });

  // Gold sponsor for onboarding
  const [goldSponsor, setGoldSponsor] = useState<Ambassador | null>(null);
  const [eliteAmbassador, setEliteAmbassador] = useState<Ambassador | null>(null);
  const [sponsorLoaded, setSponsorLoaded] = useState(false);

  // Referral state
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  // Onboarding tracking session
  const [trackingSessionId] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

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

  // Splash timer — skip splash if user is already logged in (returning from login)
  useEffect(() => {
    if (user) {
      setSplashDone(true);
      return;
    }
    const timer = setTimeout(() => setSplashDone(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-advance from splash to language picker (or to step 7 if user is logged in)
  useEffect(() => {
    if (splashDone && step === 0) {
      if (user) {
        setStep(7 as Step);
      } else {
        setStep(1);
      }
    }
  }, [splashDone, user]);

  // If user logs in while on an earlier step, skip directly to Express Profile (step 7)
  useEffect(() => {
    if (user && step >= 1 && step < 7) {
      setStep(7 as Step);
    }
  }, [user]);

  // Track step transitions for analytics
  useEffect(() => {
    const names: Record<number, string> = {
      0: 'splash', 1: 'language', 2: 'promise', 3: 'sponsor',
      4: 'features', 5: 'map', 6: 'login_cta', 7: 'profile', 8: 'referral',
    };
    trackOnboardingStep({
      sessionId: trackingSessionId,
      userId: user?.id,
      stepNumber: step,
      stepName: names[step] || `step_${step}`,
      action: 'enter',
    });
  }, [step, trackingSessionId]);

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
      const { data: amb } = await supabase
        .from('ambassadors')
        .select('id, referral_code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (amb?.referral_code) {
        setReferralCode(amb.referral_code);
      } else {
        const initials = (username || 'UP').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'UP';
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let suffix = '';
        for (let i = 0; i < 4; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        const code = `${initials}-${suffix}`;
        setReferralCode(code);

        if (amb?.id) {
          await generateReferralCode(amb.id, username || 'User');
        }
      }
    } catch {
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
    // Track step completion
    const names: Record<number, string> = {
      0: 'splash', 1: 'language', 2: 'promise', 3: 'sponsor',
      4: 'features', 5: 'map', 6: 'login_cta', 7: 'profile', 8: 'referral',
    };
    trackOnboardingStep({
      sessionId: trackingSessionId,
      userId: user?.id,
      stepNumber: step,
      stepName: names[step] || `step_${step}`,
      action: 'complete',
    });
    if (step === 2 && !goldSponsor && !eliteAmbassador) {
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

      // Update player row (created by handle_new_user trigger)
      const playerUpdate: any = {
        name: username.trim(),
        role: role || 'Milieu',
        level: 'Intermédiaire',
        updated_at: new Date().toISOString(),
      };
      if (profileLocation.city) {
        playerUpdate.city = profileLocation.city;
        playerUpdate.country = profileLocation.country || 'France';
        playerUpdate.location = {
          city: profileLocation.city,
          latitude: profileLocation.latitude,
          longitude: profileLocation.longitude,
        };
      }
      const { error: playerError } = await supabase
        .from('players')
        .update(playerUpdate)
        .eq('id', user?.id);
      // Player update is non-blocking — may fail if context not yet loaded
      if (playerError) console.log('[Onboarding] Player update warning:', playerError.message);

      // Update local context (non-blocking, context may not have loaded player data yet)
      try {
        if (user?.id) {
          const localUpdate: any = {
            name: username.trim(),
            role: role || 'Milieu',
            level: 'Intermédiaire',
          };
          if (profileLocation.city) {
            localUpdate.city = profileLocation.city;
            localUpdate.country = profileLocation.country || 'France';
            localUpdate.location = {
              city: profileLocation.city,
              latitude: profileLocation.latitude,
              longitude: profileLocation.longitude,
            };
          }
          await updatePlayer(user.id, localUpdate);
        }
      } catch (ctxErr) {
        console.log('[Onboarding] Context update skipped:', ctxErr);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            <View>
              <Image
                source={require('@/assets/images/app-logo.png')}
                style={s.splashImage}
                contentFit="contain"
                transition={300}
              />
            </View>
            <View>
              <Text style={s.splashTitle}>Ultimate Petanque</Text>
            </View>
            <View>
              <ActivityIndicator color="#60A5FA" size="small" style={{ marginTop: 24 }} />
            </View>
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
            <View style={s.langHeader}>
              <MaterialIcons name="translate" size={44} color="#60A5FA" />
              <Text style={s.langTitle}>Choose your language</Text>
              <Text style={s.langSubtitle}>Choisissez votre langue</Text>
            </View>

            <View style={s.langOptions}>
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
            </View>

            <View style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={goNext}
              >
                <Text style={s.ctaPrimaryText}>
                  {language === 'fr' ? 'Continuer' : 'Continue'}
                </Text>
                <MaterialIcons name="arrow-forward" size={20} color="#0F172A" />
              </Pressable>
            </View>
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
            <View style={s.promiseImageWrap}>
              <Image
                source={require('@/assets/images/app-logo.png')}
                style={s.promiseImage}
                contentFit="contain"
                transition={200}
              />
            </View>
            <View>
              <Text style={s.promiseTitle}>
                {language === 'fr' ? 'Chaque tir compte.' : 'Every shot counts.'}
              </Text>
              <Text style={s.promiseSubtitle}>
                {language === 'fr'
                  ? 'Suis tes matchs. Mesure ta progression. Trouve des joueurs.'
                  : 'Track your matches. Measure your progress. Find players.'}
              </Text>
            </View>
            <View style={s.ctaContainer}>
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
            </View>
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
            <View style={s.sponsorLabelRow}>
              <View style={[s.sponsorLabelLine, { backgroundColor: accentColor + '40' }]} />
              <View style={[s.sponsorLabelBadge, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
                <MaterialIcons name={badgeIcon as any} size={14} color={accentColor} />
                <Text style={[s.sponsorLabelText, { color: accentColor }]}>{labelText}</Text>
              </View>
              <View style={[s.sponsorLabelLine, { backgroundColor: accentColor + '40' }]} />
            </View>

            <View style={[s.sponsorCard, { borderColor: accentColor + '30' }]}>
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
            </View>

            <View style={s.ctaContainer}>
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
            </View>
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
      {
        icon: 'diamond',
        color: '#9333EA',
        title: language === 'fr' ? 'Classement ELO dynamique' : 'Dynamic ELO ranking',
        desc: language === 'fr'
          ? 'Ton rang evolue a chaque match : Bronze, Argent, Or, Diamant, Maitre.'
          : 'Your rank evolves with every match: Bronze, Silver, Gold, Diamond, Master.',
      },
      {
        icon: 'verified-user',
        color: '#DC2626',
        title: language === 'fr' ? 'Score de Confiance (TrustScore)' : 'Trust Score (TrustScore)',
        desc: language === 'fr'
          ? 'Un systeme anti-triche avance qui analyse, detecte les anomalies et garantit un classement fiable et equitable.'
          : 'An advanced anti-cheat system that analyzes, detects anomalies and ensures a reliable and fair ranking.',
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
            <View>
              <Text style={s.pageTitle}>
                {language === 'fr' ? 'Tout pour ta petanque' : 'Everything for your game'}
              </Text>
              <Text style={s.pageSubtitle}>
                {language === 'fr'
                  ? 'Une app complete pour suivre, progresser et partager.'
                  : 'A complete app to track, improve and share.'}
              </Text>
            </View>

            <View style={s.featuresList}>
              {features.map((f, i) => (
                <View key={i} style={s.featureRow}>
                  <View style={[s.featureIconWrap, { backgroundColor: f.color + '18' }]}>
                    <MaterialIcons name={f.icon as any} size={22} color={f.color} />
                  </View>
                  <View style={s.featureInfo}>
                    <Text style={s.featureTitle}>{f.title}</Text>
                    <Text style={s.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={s.featureTeaser}>
              <MaterialIcons name="auto-awesome" size={16} color="#FCD34D" />
              <Text style={s.featureTeaserText}>
                {language === 'fr'
                  ? 'La fiabilite du classement repose sur 2 piliers : un classement ELO dynamique et un systeme anti-triche (Score de Confiance).'
                  : 'Ranking reliability is built on 2 pillars: a dynamic ELO ranking and an anti-cheat system (Trust Score).'}
              </Text>
            </View>

            <View style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => setStep(5 as Step)}
              >
                <Text style={s.ctaPrimaryText}>{language === 'fr' ? 'Continuer' : 'Continue'}</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#0F172A" />
              </Pressable>
            </View>
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

    const communityTips = [
      { icon: 'person', color: '#3B82F6', text: language === 'fr' ? 'Rends ta fiche joueur publique' : 'Make your player card public' },
      { icon: 'place', color: '#10B981', text: language === 'fr' ? 'Partage tes terrains preferes avec adresse precise' : 'Share your favorite courts with exact address' },
      { icon: 'groups', color: '#F59E0B', text: language === 'fr' ? 'Ajoute ton club avec toutes les infos' : 'Add your club with all details' },
      { icon: 'emoji-events', color: '#9333EA', text: language === 'fr' ? 'Annonce tes tournois avec lieu et date' : 'Post your tournaments with location and date' },
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
            <View>
              <Text style={s.pageTitle}>
                {language === 'fr' ? 'Des joueurs pres de chez toi' : 'Players near you'}
              </Text>
              <Text style={s.pageSubtitle}>
                {language === 'fr'
                  ? 'L\'application a besoin de sa communaute pour fonctionner ! Plus tu partages, plus tu trouves.'
                  : 'The app needs its community to work! The more you share, the more you find.'}
              </Text>
            </View>

            <View style={s.mapCard}>
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
            </View>

            <View style={s.mapFeaturesList}>
              {mapFeatures.map((f, i) => (
                <View key={i} style={s.mapFeatureItem}>
                  <View style={[s.mapFeatureIcon, { backgroundColor: f.color + '18' }]}>
                    <MaterialIcons name={f.icon as any} size={18} color={f.color} />
                  </View>
                  <Text style={s.mapFeatureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>

            {/* Community call-to-action */}
            <View style={s.communityCallCard}>
              <View style={s.communityCallHeader}>
                <MaterialIcons name="volunteer-activism" size={18} color="#F59E0B" />
                <Text style={s.communityCallTitle}>
                  {language === 'fr' ? 'Aide la communaute a grandir' : 'Help the community grow'}
                </Text>
              </View>
              <Text style={s.communityCallDesc}>
                {language === 'fr'
                  ? 'Pour que chacun puisse trouver des joueurs, terrains et tournois, il est fortement conseille de :'
                  : 'So everyone can find players, courts and tournaments, it is strongly recommended to:'}
              </Text>
              <View style={s.communityTipsList}>
                {communityTips.map((tip, i) => (
                  <View key={i} style={s.communityTipRow}>
                    <View style={[s.communityTipIcon, { backgroundColor: tip.color + '18' }]}>
                      <MaterialIcons name={tip.icon as any} size={15} color={tip.color} />
                    </View>
                    <Text style={s.communityTipText}>{tip.text}</Text>
                  </View>
                ))}
              </View>
              <View style={s.communityCallNote}>
                <MaterialIcons name="info-outline" size={14} color="#94A3B8" />
                <Text style={s.communityCallNoteText}>
                  {language === 'fr'
                    ? 'Pensez a bien renseigner les adresses pour apparaitre sur la carte !'
                    : 'Make sure to fill in addresses properly to appear on the map!'}
                </Text>
              </View>
            </View>

            <View style={s.ctaContainer}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={() => setStep(6 as Step)}
              >
                <Text style={s.ctaPrimaryText}>{language === 'fr' ? 'Continuer' : 'Continue'}</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#0F172A" />
              </Pressable>
            </View>
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
            <View style={{ alignItems: 'center' }}>
              <MaterialIcons name="rocket-launch" size={40} color="#60A5FA" style={{ marginBottom: 12 }} />
              <Text style={s.pageTitle}>
                {language === 'fr' ? 'Pret a jouer ?' : 'Ready to play?'}
              </Text>
              <Text style={s.pageSubtitle}>
                {language === 'fr'
                  ? 'Cree ton compte gratuit pour sauvegarder tes stats et rejoindre la communaute.'
                  : 'Create your free account to save your stats and join the community.'}
              </Text>
            </View>

            <View style={s.benefitsList}>
              {[
                { icon: 'save', text: language === 'fr' ? 'Garder ton historique de matchs' : 'Keep your match history' },
                { icon: 'leaderboard', text: language === 'fr' ? 'Apparaitre dans le classement' : 'Appear in the leaderboard' },
                { icon: 'group-add', text: language === 'fr' ? 'Recevoir les matchs partages' : 'Receive shared matches' },
                { icon: 'map', text: language === 'fr' ? 'Trouver des joueurs pres de toi' : 'Find players near you' },
                { icon: 'military-tech', text: language === 'fr' ? 'Debloquer des badges et XP' : 'Unlock badges and XP' },
              ].map((b, i) => (
                <View key={i} style={s.benefitItem}>
                  <View style={s.benefitIconWrap}>
                    <MaterialIcons name={b.icon as any} size={16} color="#10B981" />
                  </View>
                  <Text style={s.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>

            <View style={s.ctaContainer}>
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
            </View>
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
              <View>
                <Text style={s.pageTitle}>
                  {language === 'fr' ? 'Derniere touche' : 'Final touch'}
                </Text>
                <Text style={s.pageSubtitle}>
                  {language === 'fr'
                    ? 'Ton nom et ton poste de jeu. Tu pourras completer ton profil plus tard.'
                    : 'Your name and play position. You can complete your profile later.'}
                </Text>
              </View>

              <View style={s.expressSection}>
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
              </View>

              <View style={s.expressSection}>
                <Text style={s.expressLabel}>{language === 'fr' ? 'TA VILLE' : 'YOUR CITY'}</Text>
                <View style={s.locationPickerWrap}>
                  <LocationPicker
                    label=""
                    value={profileLocation}
                    onChange={setProfileLocation}
                    placeholder={language === 'fr' ? 'Rechercher ta ville...' : 'Search your city...'}
                    showCityOnly
                  />
                </View>
                {profileLocation.city ? (
                  <View style={s.locationConfirm}>
                    <MaterialIcons name="check-circle" size={14} color="#10B981" />
                    <Text style={s.locationConfirmText}>{profileLocation.city}{profileLocation.country && profileLocation.country !== 'France' ? `, ${profileLocation.country}` : ''}</Text>
                  </View>
                ) : (
                  <Text style={s.locationHint}>
                    {language === 'fr' ? 'Recommande pour apparaitre sur la carte et le classement geo' : 'Recommended to appear on the map and geo ranking'}
                  </Text>
                )}
              </View>

              <View style={s.expressSection}>
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
              </View>

              <View style={s.ctaContainer}>
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
              </View>
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
            <View style={{ alignItems: 'center' }}>
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
            </View>

            {/* Referral code card */}
            <View style={s.referralCard}>
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
                  <View key={i} style={s.referralRewardItem}>
                    <MaterialIcons name={r.icon as any} size={16} color={r.color} />
                    <Text style={s.referralRewardText}>{r.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Share button */}
            <View style={s.ctaContainer}>
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
            </View>
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

  // --- Shared scrollable content ---
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

  // --- Community call ---
  communityCallCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F59E0B30',
  },
  communityCallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  communityCallTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FCD34D',
  },
  communityCallDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 12,
  },
  communityTipsList: {
    gap: 8,
    marginBottom: 10,
  },
  communityTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  communityTipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityTipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
    flex: 1,
  },
  communityCallNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A40',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  communityCallNoteText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 16,
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

  // Location picker in onboarding
  locationPickerWrap: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  locationConfirm: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
  },
  locationConfirmText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  locationHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
});
