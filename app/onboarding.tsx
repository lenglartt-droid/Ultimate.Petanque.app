import React, { useState, useEffect, useMemo } from 'react';
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
import { fetchAmbassadors, Ambassador } from '@/services/ambassadorService';
import { trackAmbassadorEvent } from '@/services/ambassadorAnalyticsService';

// ============================================
// TYPES
// ============================================
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

const ONBOARDING_KEY = 'hasSeenOnboarding';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    setStep(prev => Math.min(7, prev + 1) as Step);
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

      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      router.replace('/consent');
    } catch (error: any) {
      showAlert(t('common', 'error'), error.message || 'Unable to save profile');
    } finally {
      setSaving(false);
    }
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

  // ============================================
  // STEP 1: LANGUAGE SELECTION (NEW)
  // ============================================
  if (step === 1) {
    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <ScrollView contentContainerStyle={s.langContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)} style={s.langHeader}>
              <MaterialIcons name="translate" size={48} color="#60A5FA" />
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
                    <MaterialIcons name="check" size={18} color="#FFF" />
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
                    <MaterialIcons name="check" size={18} color="#FFF" />
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={{ width: '100%', paddingHorizontal: 24 }}>
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
            <Animated.View entering={FadeInUp.duration(500).delay(400)} style={{ width: '100%', paddingHorizontal: 24 }}>
              <Pressable
                style={({ pressed }) => [s.ctaPrimary, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                onPress={goNext}
              >
                <Text style={s.ctaPrimaryText}>
                  {language === 'fr' ? 'Decouvrir l\'application' : 'Discover the app'}
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
            <ProgressDots current={1} total={5} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.sponsorContent} showsVerticalScrollIndicator={false}>
            {/* Label */}
            <Animated.View entering={FadeInDown.duration(400)} style={s.sponsorLabelRow}>
              <View style={[s.sponsorLabelLine, { backgroundColor: accentColor + '40' }]} />
              <View style={[s.sponsorLabelBadge, { backgroundColor: accentColor + '20', borderColor: accentColor + '40' }]}>
                <MaterialIcons name={badgeIcon as any} size={14} color={accentColor} />
                <Text style={[s.sponsorLabelText, { color: accentColor }]}>{labelText}</Text>
              </View>
              <View style={[s.sponsorLabelLine, { backgroundColor: accentColor + '40' }]} />
            </Animated.View>

            {/* Card */}
            <Animated.View entering={FadeInUp.duration(500).delay(150)} style={[s.sponsorCard, { borderColor: accentColor + '30' }]}>
              {/* Top area with photo + name */}
              <View style={s.sponsorCardTop}>
                <View style={[s.sponsorPhotoWrap, { borderColor: accentColor }]}>
                  {entity.photo ? (
                    <Image source={{ uri: entity.photo }} style={s.sponsorPhoto} contentFit="cover" transition={300} />
                  ) : (
                    <LinearGradient colors={isSponsor ? ['#B45309', '#F59E0B'] : ['#7C3AED', '#9333EA']} style={s.sponsorPhotoFallback}>
                      <MaterialIcons name={badgeIcon as any} size={36} color="#FFF" />
                    </LinearGradient>
                  )}
                  <View style={[s.sponsorPhotoBadge, { backgroundColor: accentColor }]}>
                    <MaterialIcons name={isSponsor ? 'star' : 'military-tech'} size={12} color="#FFF" />
                  </View>
                </View>
                <View style={s.sponsorCardNameCol}>
                  <Text style={s.sponsorCardName}>{entity.displayName}</Text>
                  {entity.bio ? (
                    <Text style={s.sponsorCardBio} numberOfLines={2}>{entity.bio}</Text>
                  ) : null}
                </View>
              </View>

              {/* Message box */}
              <LinearGradient
                colors={gradientColors as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.sponsorMsgBox}
              >
                <View style={[s.sponsorMsgAccent, { backgroundColor: accentColor }]} />
                <MaterialIcons name="format-quote" size={20} color={accentColor} style={{ opacity: 0.4 }} />
                <Text style={[s.sponsorMsgText, { color: darkAccent }]}>{messageText}</Text>
              </LinearGradient>

              {/* Social links */}
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

            {/* CTAs */}
            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={{ width: '100%', paddingHorizontal: 24 }}>
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
  // STEP 4: APP FEATURES EXPLANATION (replaces match)
  // ============================================
  if (step === 3 || step === 4) {
    // If step === 3 and no sponsor, we arrive here due to flow skip
    // But we handle that via goNext. If somehow step===3 falls through, treat as step 4.
    const features = [
      {
        icon: 'sports',
        color: '#60A5FA',
        title: language === 'fr' ? 'Enregistre tes matchs' : 'Record your matches',
        desc: language === 'fr'
          ? 'Mene par mene, avec score, tirs, carreaux et statistiques detaillees.'
          : 'End by end, with score, shots, carreaux and detailed statistics.',
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
          ? 'Tes partenaires acceptent en 1 tap, vos stats se mettent a jour.'
          : 'Your partners accept in 1 tap, stats update automatically.',
      },
      {
        icon: 'emoji-events',
        color: '#F59E0B',
        title: language === 'fr' ? 'Gagne des badges & XP' : 'Earn badges & XP',
        desc: language === 'fr'
          ? 'Debloque des badges, monte en niveau et entre dans le classement.'
          : 'Unlock badges, level up and enter the leaderboard.',
      },
    ];

    return (
      <LinearGradient colors={['#0F172A', '#1E3A8A']} style={s.fullScreen}>
        <SafeAreaView style={s.fullScreen}>
          <View style={s.screenHeader}>
            <Pressable onPress={goBack} hitSlop={12}>
              <MaterialIcons name="arrow-back" size={24} color="#94A3B8" />
            </Pressable>
            <ProgressDots current={2} total={5} />
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={s.featuresContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)}>
              <Text style={s.featuresTitle}>
                {language === 'fr' ? 'Tout pour ta petanque' : 'Everything for your game'}
              </Text>
              <Text style={s.featuresSubtitle}>
                {language === 'fr'
                  ? 'Une app complete pour suivre, progresser et partager.'
                  : 'A complete app to track, improve and share.'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(500).delay(200)} style={s.featuresList}>
              {features.map((f, i) => (
                <Animated.View
                  key={i}
                  entering={FadeInUp.duration(400).delay(300 + i * 100)}
                  style={s.featureRow}
                >
                  <View style={[s.featureIconWrap, { backgroundColor: f.color + '18' }]}>
                    <MaterialIcons name={f.icon as any} size={26} color={f.color} />
                  </View>
                  <View style={s.featureInfo}>
                    <Text style={s.featureTitle}>{f.title}</Text>
                    <Text style={s.featureDesc}>{f.desc}</Text>
                  </View>
                </Animated.View>
              ))}
            </Animated.View>

            {/* Teaser */}
            <Animated.View entering={FadeInUp.duration(400).delay(700)} style={s.featureTeaser}>
              <MaterialIcons name="auto-awesome" size={18} color="#FCD34D" />
              <Text style={s.featureTeaserText}>
                {language === 'fr'
                  ? 'Et bien plus : tournois, defis solo, score de confiance, carte federation...'
                  : 'And much more: tournaments, solo challenges, trust score, federation card...'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(800)} style={{ width: '100%' }}>
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
  // STEP 5: MAP DISCOVERY (enhanced)
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
            <ProgressDots current={3} total={5} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.mapContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)}>
              <Text style={s.mapTitle}>
                {language === 'fr' ? 'Des joueurs pres de chez toi' : 'Players near you'}
              </Text>
              <Text style={s.mapSubtitle}>
                {language === 'fr'
                  ? 'Explore la carte interactive pour trouver tout ce qu\'il te faut.'
                  : 'Explore the interactive map to find everything you need.'}
              </Text>
            </Animated.View>

            {/* Map card with features */}
            <Animated.View entering={FadeInUp.duration(400).delay(200)} style={s.mapCard}>
              <View style={s.mapCardInner}>
                <View style={s.mapIconRow}>
                  <View style={s.mapMainIcon}>
                    <MaterialIcons name="map" size={56} color="#1E3A8A" />
                  </View>
                  <View style={s.mapPinFloat1}>
                    <MaterialIcons name="place" size={22} color="#10B981" />
                  </View>
                  <View style={s.mapPinFloat2}>
                    <MaterialIcons name="person-pin" size={20} color="#3B82F6" />
                  </View>
                  <View style={s.mapPinFloat3}>
                    <MaterialIcons name="flag" size={18} color="#F59E0B" />
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Feature bullets */}
            <Animated.View entering={FadeInUp.duration(400).delay(400)} style={s.mapFeaturesList}>
              {mapFeatures.map((f, i) => (
                <Animated.View key={i} entering={FadeInUp.duration(300).delay(450 + i * 80)} style={s.mapFeatureItem}>
                  <View style={[s.mapFeatureIcon, { backgroundColor: f.color + '18' }]}>
                    <MaterialIcons name={f.icon as any} size={20} color={f.color} />
                  </View>
                  <Text style={s.mapFeatureLabel}>{f.label}</Text>
                </Animated.View>
              ))}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(700)} style={{ width: '100%' }}>
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
            <ProgressDots current={4} total={5} />
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={s.loginContent} showsVerticalScrollIndicator={false}>
            <Animated.View entering={FadeInDown.duration(500)}>
              <MaterialIcons name="rocket-launch" size={48} color="#60A5FA" style={{ alignSelf: 'center', marginBottom: 16 }} />
              <Text style={s.loginTitle}>
                {language === 'fr' ? 'Pret a jouer ?' : 'Ready to play?'}
              </Text>
              <Text style={s.loginSubtitle}>
                {language === 'fr'
                  ? 'Cree ton compte gratuit pour sauvegarder tes stats et rejoindre la communaute.'
                  : 'Create your free account to save your stats and join the community.'}
              </Text>
            </Animated.View>

            {/* Benefits */}
            <Animated.View entering={FadeInUp.duration(400).delay(200)} style={s.benefitsList}>
              {[
                { icon: 'save', text: language === 'fr' ? 'Garder ton historique de matchs' : 'Keep your match history' },
                { icon: 'leaderboard', text: language === 'fr' ? 'Apparaitre dans le classement' : 'Appear in the leaderboard' },
                { icon: 'group-add', text: language === 'fr' ? 'Recevoir les matchs partages' : 'Receive shared matches' },
                { icon: 'map', text: language === 'fr' ? 'Trouver des joueurs pres de toi' : 'Find players near you' },
                { icon: 'military-tech', text: language === 'fr' ? 'Debloquer des badges et XP' : 'Unlock badges and XP' },
              ].map((b, i) => (
                <Animated.View key={i} entering={FadeInUp.duration(300).delay(250 + i * 60)} style={s.benefitItem}>
                  <View style={s.benefitIconWrap}>
                    <MaterialIcons name={b.icon as any} size={18} color="#10B981" />
                  </View>
                  <Text style={s.benefitText}>{b.text}</Text>
                </Animated.View>
              ))}
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(400).delay(600)} style={{ width: '100%' }}>
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
              <ProgressDots current={4} total={5} />
              <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={s.expressContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeInDown.duration(500)}>
                <Text style={s.expressTitle}>
                  {language === 'fr' ? 'Derniere touche' : 'Final touch'}
                </Text>
                <Text style={s.expressSubtitle}>
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

  // --- Language picker ---
  langContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 40,
  },
  langHeader: {
    alignItems: 'center',
    marginBottom: 40,
    gap: 12,
  },
  langTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },
  langSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  langOptions: {
    width: '100%',
    gap: 14,
    marginBottom: 40,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    gap: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  langOptionActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#60A5FA10',
  },
  langFlag: {
    fontSize: 36,
  },
  langOptionInfo: {
    flex: 1,
  },
  langOptionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 2,
  },
  langOptionTitleActive: {
    color: '#FFF',
  },
  langOptionDesc: {
    fontSize: 13,
    color: '#64748B',
  },
  langCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Promise ---
  promiseContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
    paddingTop: 24,
  },
  promiseImageWrap: {
    width: Math.min(SCREEN_WIDTH * 0.45, 200),
    height: Math.min(SCREEN_WIDTH * 0.45, 200),
    marginBottom: 20,
  },
  promiseImage: {
    width: '100%',
    height: '100%',
  },
  promiseTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  promiseSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
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

  // --- Sponsor / Ambassador (improved) ---
  sponsorContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sponsorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sponsorLabelLine: {
    width: 32,
    height: 1,
  },
  sponsorLabelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  sponsorLabelText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sponsorCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
    gap: 20,
  },
  sponsorCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sponsorPhotoWrap: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2.5,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  sponsorCardNameCol: {
    flex: 1,
  },
  sponsorCardName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  sponsorCardBio: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  sponsorMsgBox: {
    borderRadius: 16,
    padding: 18,
    gap: 8,
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
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  sponsorSocialsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sponsorSocialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sponsorSocialLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#CBD5E1',
  },

  // --- Features explanation ---
  featuresContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
  },
  featuresTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  featuresSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  featuresList: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    gap: 16,
  },
  featureIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 19,
  },
  featureTeaser: {
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
  featureTeaserText: {
    fontSize: 13,
    color: '#FCD34D',
    flex: 1,
    lineHeight: 19,
  },

  // --- Map ---
  mapContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 8,
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
    borderRadius: 24,
    padding: 2,
    marginBottom: 28,
    overflow: 'hidden',
  },
  mapCardInner: {
    backgroundColor: '#0F172A20',
    borderRadius: 22,
    paddingVertical: 28,
    alignItems: 'center',
  },
  mapIconRow: {
    width: 120,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mapMainIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#60A5FA15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinFloat1: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#10B98118',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinFloat2: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#3B82F618',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinFloat3: {
    position: 'absolute',
    top: 8,
    left: 10,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#F59E0B18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFeaturesList: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  mapFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  mapFeatureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFeatureLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
    flex: 1,
  },

  // --- Login ---
  loginContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
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
    marginBottom: 28,
  },
  benefitsList: {
    width: '100%',
    marginBottom: 32,
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#10B98118',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 15,
    color: '#E2E8F0',
    fontWeight: '500',
    flex: 1,
  },

  // --- Express profile ---
  expressContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  expressTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  expressSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
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
