import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import theme from '@/constants/theme';
import config, { PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { Club } from '@/services/mockData';
import { useLanguage } from '@/hooks/useLanguage';
import { Language } from '@/constants/i18n';

type Step = 0 | 1 | 2 | 3 | 4;

export default function OnboardingScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { clubs, addClub, updatePlayer, refreshData } = useApp();
  const supabase = getSupabaseClient();
  const { t, language, setLanguage } = useLanguage();

  const [step, setStep] = useState<Step>(0);
  const [selectedLang, setSelectedLang] = useState<Language>(language);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<PlayerRole | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  
  // Club fields
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubCity, setNewClubCity] = useState('');
  const [clubSearch, setClubSearch] = useState('');
  
  // Filtered clubs based on search
  const filteredClubs = clubs.filter(c => 
    c.name.toLowerCase().includes(clubSearch.toLowerCase()) ||
    c.city.toLowerCase().includes(clubSearch.toLowerCase())
  );

  const levels = useMemo(() => [
    { id: 'Débutant', icon: 'school', label: t('levels', 'debutant'), description: t('onboarding', 'beginnerDesc') },
    { id: 'Intermédiaire', icon: 'trending-up', label: t('levels', 'intermediaire'), description: t('onboarding', 'intermediateDesc') },
    { id: 'Confirmé', icon: 'stars', label: t('levels', 'confirme'), description: t('onboarding', 'advancedDesc') },
    { id: 'Expert', icon: 'emoji-events', label: t('levels', 'expert'), description: t('onboarding', 'expertDesc') },
  ], [t]);

  const roles = useMemo(() => [
    { id: 'Tireur' as PlayerRole, icon: 'gps-fixed', label: t('roles', 'tireur'), description: t('onboarding', 'shooterDesc') },
    { id: 'Pointeur' as PlayerRole, icon: 'adjust', label: t('roles', 'pointeur'), description: t('onboarding', 'pointerDesc') },
    { id: 'Milieu' as PlayerRole, icon: 'swap-horiz', label: t('roles', 'milieu'), description: t('onboarding', 'middleDesc') },
  ], [t]);

  const canProceed = () => {
    if (step === 0) return true; // Language always valid
    if (step === 1) return username.trim().length >= 2;
    if (step === 2) return role !== null;
    if (step === 3) return true; // Level is optional
    if (step === 4) {
      if (showCreateClub) {
        return newClubName.trim().length >= 2 && newClubCity.trim().length >= 2;
      }
      return true; // Club is optional
    }
    return true;
  };

  const handleNext = async () => {
    if (!canProceed()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Apply language selection at step 0
    if (step === 0) {
      await setLanguage(selectedLang);
      setStep(1);
      return;
    }
    
    // If creating a new club in step 4, create it first
    if (step === 4 && showCreateClub && newClubName.trim() && newClubCity.trim()) {
      try {
        const newClub: Omit<Club, 'id'> = {
          name: newClubName.trim(),
          city: newClubCity.trim(),
          location: { latitude: 0, longitude: 0 },
          membersCount: 1,
        };
        await addClub(newClub);
        // Set as selected club
        setSelectedClub({ ...newClub, id: 'new' } as Club);
      } catch (error) {
        console.log('Error creating club:', error);
      }
    }
    
    if (step < 4) {
      setStep((prev) => (prev + 1) as Step);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    Haptics.selectionAsync();
    if (step > 0) {
      setStep((prev) => (prev - 1) as Step);
    }
  };

  const handleComplete = async () => {
    if (!username.trim()) {
      showAlert(t('common', 'error'), t('onboarding', 'nameRequired'));
      return;
    }

    setSaving(true);
    try {
      // Determine club name and ID
      const clubName = showCreateClub ? newClubName.trim() : (selectedClub?.name || null);
      const clubId = showCreateClub ? null : (selectedClub?.id || null);
      
      // Update user profile with all info
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          username: username.trim(),
          role: role || 'Milieu',
          level: level || 'Intermédiaire',
          club: clubName,
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Update the existing player entry (created automatically on signup)
      const { error: playerError } = await supabase
        .from('players')
        .update({
          name: username.trim(),
          role: role || 'Milieu',
          level: level || 'Intermédiaire',
          club: clubName,
          club_id: clubId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id);

      if (playerError) throw playerError;

      // Update local state immediately so selfPlayer.name is correct
      if (user?.id) {
        await updatePlayer(user.id, {
          name: username.trim(),
          role: role || 'Milieu',
          level: level || 'Intermédiaire',
          club: clubName || undefined,
          clubId: clubId || undefined,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (error: any) {
      showAlert(t('common', 'error'), error.message || t('onboarding', 'unableToCreateProfile'));
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    if (step === 2) {
      setRole('Milieu'); // Default
      setStep(3);
    } else if (step === 3) {
      setLevel('Intermédiaire'); // Default
      setStep(4);
    } else if (step === 4) {
      setSelectedClub(null);
      setShowCreateClub(false);
      handleComplete();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${(step / 5) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{t('onboarding', 'stepProgress')} {step === 0 ? '—' : `${step}/4`}</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 0: Language */}
          {step === 0 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="translate" size={48} color={theme.primary} />
              </View>
              <Text style={styles.stepTitle}>{t('onboarding', 'chooseLanguage')}</Text>
              <Text style={styles.stepDescription}>
                {t('onboarding', 'languageDesc')}
              </Text>

              <View style={styles.optionsContainer}>
                {[
                  { id: 'fr' as Language, flag: '🇫🇷', label: t('onboarding', 'french'), description: t('onboarding', 'frenchDesc') },
                  { id: 'en' as Language, flag: '🇬🇧', label: t('onboarding', 'english'), description: t('onboarding', 'englishDesc') },
                ].map((langOption, index) => (
                  <Animated.View
                    key={langOption.id}
                    entering={FadeInUp.duration(300).delay(index * 100)}
                  >
                    <Pressable
                      style={[
                        styles.optionCard,
                        selectedLang === langOption.id && styles.optionCardActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedLang(langOption.id);
                      }}
                    >
                      <View
                        style={[
                          styles.optionIcon,
                          selectedLang === langOption.id && styles.optionIconActive,
                        ]}
                      >
                        <Text style={styles.langFlag}>{langOption.flag}</Text>
                      </View>
                      <View style={styles.optionContent}>
                        <Text
                          style={[
                            styles.optionTitle,
                            selectedLang === langOption.id && styles.optionTitleActive,
                          ]}
                        >
                          {langOption.label}
                        </Text>
                        <Text style={styles.optionDescription}>{langOption.description}</Text>
                      </View>
                      {selectedLang === langOption.id && (
                        <MaterialIcons name="check-circle" size={24} color={theme.primary} />
                      )}
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Step 1: Username */}
          {step === 1 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="person" size={48} color={theme.primary} />
              </View>
              <Text style={styles.stepTitle}>{t('onboarding', 'whatIsYourName')}</Text>
              <Text style={styles.stepDescription}>
                {t('onboarding', 'nameVisibleToOthers')}
              </Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.nameInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t('onboarding', 'namePlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={30}
                />
                {username.length > 0 && (
                  <View style={styles.inputCheck}>
                    <MaterialIcons
                      name={username.trim().length >= 2 ? 'check-circle' : 'error'}
                      size={24}
                      color={username.trim().length >= 2 ? theme.success : theme.textMuted}
                    />
                  </View>
                )}
              </View>
              <Text style={styles.inputHint}>{t('onboarding', 'minTwoChars')}</Text>
            </Animated.View>
          )}

          {/* Step 2: Role */}
          {step === 2 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="sports" size={48} color={theme.accent} />
              </View>
              <Text style={styles.stepTitle}>{t('onboarding', 'whatIsYourRole')}</Text>
              <Text style={styles.stepDescription}>
                {t('onboarding', 'roleHelpsStats')}
              </Text>

              <View style={styles.optionsContainer}>
                {roles.map((r, index) => (
                  <Animated.View
                    key={r.id}
                    entering={FadeInUp.duration(300).delay(index * 100)}
                  >
                    <Pressable
                      style={[
                        styles.optionCard,
                        role === r.id && styles.optionCardActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRole(r.id);
                      }}
                    >
                      <View
                        style={[
                          styles.optionIcon,
                          role === r.id && styles.optionIconActive,
                        ]}
                      >
                        <MaterialIcons
                          name={r.icon as any}
                          size={28}
                          color={role === r.id ? '#FFF' : theme.textSecondary}
                        />
                      </View>
                      <View style={styles.optionContent}>
                        <Text
                          style={[
                            styles.optionTitle,
                            role === r.id && styles.optionTitleActive,
                          ]}
                        >
                          {r.label}
                        </Text>
                        <Text style={styles.optionDescription}>{r.description}</Text>
                      </View>
                      {role === r.id && (
                        <MaterialIcons name="check-circle" size={24} color={theme.primary} />
                      )}
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Step 3: Level */}
          {step === 3 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="trending-up" size={48} color={theme.carreauColor} />
              </View>
              <Text style={styles.stepTitle}>{t('onboarding', 'whatIsYourLevel')}</Text>
              <Text style={styles.stepDescription}>
                {t('onboarding', 'noPressure')}
              </Text>

              <View style={styles.levelGrid}>
                {levels.map((l, index) => (
                  <Animated.View
                    key={l.id}
                    entering={FadeInUp.duration(300).delay(index * 80)}
                    style={styles.levelItemWrapper}
                  >
                    <Pressable
                      style={[
                        styles.levelCard,
                        level === l.id && styles.levelCardActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setLevel(l.id);
                      }}
                    >
                      <MaterialIcons
                        name={l.icon as any}
                        size={28}
                        color={level === l.id ? theme.carreauColor : theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.levelTitle,
                          level === l.id && styles.levelTitleActive,
                        ]}
                      >
                        {l.label}
                      </Text>
                      <Text style={styles.levelDescription} numberOfLines={2}>
                        {l.description}
                      </Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Step 4: Club */}
          {step === 4 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="groups" size={48} color={theme.accent} />
              </View>
              <Text style={styles.stepTitle}>{t('onboarding', 'doYouHaveClub')}</Text>
              <Text style={styles.stepDescription}>
                {t('onboarding', 'associateClub')}
              </Text>

              {!showCreateClub ? (
                <>
                  {/* Search existing clubs */}
                  <View style={styles.clubSearchContainer}>
                    <MaterialIcons name="search" size={20} color={theme.textMuted} />
                    <TextInput
                      style={styles.clubSearchInput}
                      value={clubSearch}
                      onChangeText={setClubSearch}
                      placeholder={t('onboarding', 'searchClub')}
                      placeholderTextColor={theme.textMuted}
                    />
                    {clubSearch.length > 0 && (
                      <Pressable onPress={() => setClubSearch('')}>
                        <MaterialIcons name="close" size={20} color={theme.textMuted} />
                      </Pressable>
                    )}
                  </View>

                  {/* Club list */}
                  <View style={styles.clubList}>
                    {filteredClubs.length > 0 ? (
                      filteredClubs.slice(0, 5).map((club, index) => (
                        <Animated.View
                          key={club.id}
                          entering={FadeInUp.duration(300).delay(index * 60)}
                        >
                          <Pressable
                            style={[
                              styles.clubItem,
                              selectedClub?.id === club.id && styles.clubItemActive,
                            ]}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setSelectedClub(selectedClub?.id === club.id ? null : club);
                            }}
                          >
                            <View style={[
                              styles.clubItemIcon,
                              selectedClub?.id === club.id && styles.clubItemIconActive,
                            ]}>
                              <MaterialIcons
                                name="location-city"
                                size={24}
                                color={selectedClub?.id === club.id ? '#FFF' : theme.textSecondary}
                              />
                            </View>
                            <View style={styles.clubItemInfo}>
                              <Text style={[
                                styles.clubItemName,
                                selectedClub?.id === club.id && styles.clubItemNameActive,
                              ]}>
                                {club.name}
                              </Text>
                              <Text style={styles.clubItemCity}>{club.city}</Text>
                            </View>
                            {selectedClub?.id === club.id && (
                              <MaterialIcons name="check-circle" size={24} color={theme.accent} />
                            )}
                          </Pressable>
                        </Animated.View>
                      ))
                    ) : (
                      <View style={styles.noClubsContainer}>
                        <MaterialIcons name="search-off" size={32} color={theme.textMuted} />
                        <Text style={styles.noClubsText}>
                          {clubSearch ? t('onboarding', 'noClubFound') : t('onboarding', 'noClubRegistered')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Create club button */}
                  <Pressable
                    style={styles.createClubButton}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setShowCreateClub(true);
                      setSelectedClub(null);
                    }}
                  >
                    <MaterialIcons name="add-circle-outline" size={22} color={theme.primary} />
                    <Text style={styles.createClubButtonText}>{t('onboarding', 'createNewClub')}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {/* Create new club form */}
                  <Animated.View entering={FadeInDown.duration(300)} style={styles.createClubForm}>
                    <View style={styles.createClubHeader}>
                      <MaterialIcons name="add-business" size={28} color={theme.primary} />
                      <Text style={styles.createClubTitle}>{t('onboarding', 'newClub')}</Text>
                    </View>

                    <View style={styles.createClubInputWrapper}>
                      <Text style={styles.createClubLabel}>{t('onboarding', 'clubNameRequired')}</Text>
                      <TextInput
                        style={styles.createClubInput}
                        value={newClubName}
                        onChangeText={setNewClubName}
                        placeholder={t('onboarding', 'clubNamePlaceholder')}
                        placeholderTextColor={theme.textMuted}
                        autoFocus
                      />
                    </View>

                    <View style={styles.createClubInputWrapper}>
                      <Text style={styles.createClubLabel}>{t('onboarding', 'cityRequired')}</Text>
                      <TextInput
                        style={styles.createClubInput}
                        value={newClubCity}
                        onChangeText={setNewClubCity}
                        placeholder={t('onboarding', 'cityPlaceholder')}
                        placeholderTextColor={theme.textMuted}
                      />
                    </View>

                    <Pressable
                      style={styles.cancelCreateClubBtn}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setShowCreateClub(false);
                        setNewClubName('');
                        setNewClubCity('');
                      }}
                    >
                      <MaterialIcons name="arrow-back" size={18} color={theme.textSecondary} />
                      <Text style={styles.cancelCreateClubText}>{t('onboarding', 'chooseExistingClub')}</Text>
                    </Pressable>
                  </Animated.View>
                </>
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerButtons}>
            {step > 0 && (
              <Pressable style={styles.backButton} onPress={handleBack}>
                <MaterialIcons name="arrow-back" size={20} color={theme.textSecondary} />
                <Text style={styles.backButtonText}>{t('onboarding', 'back')}</Text>
              </Pressable>
            )}

            {step > 1 && (
              <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>{t('onboarding', 'skip')}</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={[
              styles.nextButton,
              !canProceed() && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!canProceed() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {step === 4 ? t('onboarding', 'start') : t('onboarding', 'continue')}
                </Text>
                <MaterialIcons
                  name={step === 4 ? 'check' : 'arrow-forward'}
                  size={20}
                  color="#FFF"
                />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'right',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...theme.shadows.card,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputWrapper: {
    width: '100%',
    position: 'relative',
  },
  nameInput: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 20,
    paddingRight: 50,
    fontSize: 18,
    fontWeight: '500',
    color: theme.textPrimary,
    textAlign: 'center',
    ...theme.shadows.card,
  },
  inputCheck: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  inputHint: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 12,
  },
  langFlag: {
    fontSize: 28,
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  optionCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '08',
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconActive: {
    backgroundColor: theme.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  optionTitleActive: {
    color: theme.primary,
  },
  optionDescription: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap: 12,
  },
  levelItemWrapper: {
    width: '48%',
  },
  levelCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 130,
    ...theme.shadows.card,
  },
  levelCardActive: {
    borderColor: theme.carreauColor,
    backgroundColor: theme.carreauColor + '08',
  },
  levelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  levelTitleActive: {
    color: theme.carreauColor,
  },
  levelDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: theme.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 15,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipButtonText: {
    fontSize: 15,
    color: theme.textMuted,
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.md,
  },
  nextButtonDisabled: {
    backgroundColor: theme.textMuted,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  // Club step styles
  clubSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    gap: 10,
    ...theme.shadows.card,
  },
  clubSearchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    padding: 0,
  },
  clubList: {
    width: '100%',
    marginTop: 16,
    gap: 10,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  clubItemActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accent + '08',
  },
  clubItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubItemIconActive: {
    backgroundColor: theme.accent,
  },
  clubItemInfo: {
    flex: 1,
  },
  clubItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  clubItemNameActive: {
    color: theme.accent,
  },
  clubItemCity: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  noClubsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noClubsText: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 8,
  },
  createClubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary + '10',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    marginTop: 16,
    borderWidth: 2,
    borderColor: theme.primary + '30',
    borderStyle: 'dashed',
    width: '100%',
  },
  createClubButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
  },
  createClubForm: {
    width: '100%',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  createClubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  createClubTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  createClubInputWrapper: {
    marginBottom: 16,
  },
  createClubLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  createClubInput: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.textPrimary,
  },
  cancelCreateClubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  cancelCreateClubText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
});
