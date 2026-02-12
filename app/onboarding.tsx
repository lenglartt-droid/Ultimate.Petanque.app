import React, { useState } from 'react';
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
import themeStatic from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import config, { PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { Club } from '@/services/mockData';

type Step = 1 | 2 | 3 | 4;

export default function OnboardingScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { theme } = useTheme();
  const { clubs, addClub, updatePlayer, refreshData } = useApp();
  const supabase = getSupabaseClient();

  const [step, setStep] = useState<Step>(1);
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

  const levels = [
    { id: 'Débutant', icon: 'school', description: 'Je découvre la pétanque' },
    { id: 'Intermédiaire', icon: 'trending-up', description: 'Je joue régulièrement' },
    { id: 'Confirmé', icon: 'stars', description: 'Je participe à des compétitions' },
    { id: 'Expert', icon: 'emoji-events', description: 'Joueur confirmé en compétition' },
  ];

  const roles: { id: PlayerRole; icon: string; description: string }[] = [
    { id: 'Tireur', icon: 'gps-fixed', description: 'Spécialiste du tir' },
    { id: 'Pointeur', icon: 'adjust', description: 'Spécialiste du point' },
    { id: 'Milieu', icon: 'swap-horiz', description: 'Polyvalent tir et point' },
  ];

  const canProceed = () => {
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
    if (step > 1) {
      setStep((prev) => (prev - 1) as Step);
    }
  };

  const handleComplete = async () => {
    if (!username.trim()) {
      showAlert('Erreur', 'Le nom est requis');
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
      showAlert('Erreur', error.message || 'Impossible de créer le profil');
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
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
                { width: `${(step / 4) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>Étape {step}/4</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Username */}
          {step === 1 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="person" size={48} color={theme.primary} />
              </View>
              <Text style={styles.stepTitle}>Comment vous appelez-vous ?</Text>
              <Text style={styles.stepDescription}>
                Ce nom sera visible par les autres joueurs
              </Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.nameInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Votre prénom ou pseudo"
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
              <Text style={styles.inputHint}>Minimum 2 caractères</Text>
            </Animated.View>
          )}

          {/* Step 2: Role */}
          {step === 2 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <MaterialIcons name="sports" size={48} color={theme.accent} />
              </View>
              <Text style={styles.stepTitle}>Quel est votre rôle préféré ?</Text>
              <Text style={styles.stepDescription}>
                Cela nous aide à personnaliser vos statistiques
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
                          {r.id}
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
              <Text style={styles.stepTitle}>Quel est votre niveau ?</Text>
              <Text style={styles.stepDescription}>
                Pas de pression, vous pouvez modifier cela plus tard
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
                        {l.id}
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
              <Text style={styles.stepTitle}>Avez-vous un club ?</Text>
              <Text style={styles.stepDescription}>
                Associez votre profil à votre club de pétanque
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
                      placeholder="Rechercher un club..."
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
                          {clubSearch ? 'Aucun club trouvé' : 'Aucun club enregistré'}
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
                    <Text style={styles.createClubButtonText}>Créer un nouveau club</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {/* Create new club form */}
                  <Animated.View entering={FadeInDown.duration(300)} style={styles.createClubForm}>
                    <View style={styles.createClubHeader}>
                      <MaterialIcons name="add-business" size={28} color={theme.primary} />
                      <Text style={styles.createClubTitle}>Nouveau club</Text>
                    </View>

                    <View style={styles.createClubInputWrapper}>
                      <Text style={styles.createClubLabel}>Nom du club *</Text>
                      <TextInput
                        style={styles.createClubInput}
                        value={newClubName}
                        onChangeText={setNewClubName}
                        placeholder="Ex: Pétanque Club de Lyon"
                        placeholderTextColor={theme.textMuted}
                        autoFocus
                      />
                    </View>

                    <View style={styles.createClubInputWrapper}>
                      <Text style={styles.createClubLabel}>Ville *</Text>
                      <TextInput
                        style={styles.createClubInput}
                        value={newClubCity}
                        onChangeText={setNewClubCity}
                        placeholder="Ex: Lyon"
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
                      <Text style={styles.cancelCreateClubText}>Choisir un club existant</Text>
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
            {step > 1 && (
              <Pressable style={styles.backButton} onPress={handleBack}>
                <MaterialIcons name="arrow-back" size={20} color={theme.textSecondary} />
                <Text style={styles.backButtonText}>Retour</Text>
              </Pressable>
            )}

            {step > 1 && (
              <Pressable style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Passer</Text>
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
                  {step === 4 ? 'Commencer' : 'Continuer'}
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
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: themeStatic.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: themeStatic.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: themeStatic.textMuted,
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
    backgroundColor: themeStatic.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...themeStatic.shadows.card,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: themeStatic.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    color: themeStatic.textSecondary,
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
    backgroundColor: themeStatic.surface,
    borderRadius: themeStatic.borderRadius.lg,
    paddingVertical: 18,
    paddingHorizontal: 20,
    paddingRight: 50,
    fontSize: 18,
    fontWeight: '500',
    color: themeStatic.textPrimary,
    textAlign: 'center',
    ...themeStatic.shadows.card,
  },
  inputCheck: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  inputHint: {
    fontSize: 13,
    color: themeStatic.textMuted,
    marginTop: 12,
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeStatic.surface,
    borderRadius: themeStatic.borderRadius.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    ...themeStatic.shadows.card,
  },
  optionCardActive: {
    borderColor: themeStatic.primary,
    backgroundColor: themeStatic.primary + '08',
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: themeStatic.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconActive: {
    backgroundColor: themeStatic.primary,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: themeStatic.textPrimary,
    marginBottom: 2,
  },
  optionTitleActive: {
    color: themeStatic.primary,
  },
  optionDescription: {
    fontSize: 13,
    color: themeStatic.textSecondary,
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
    backgroundColor: themeStatic.surface,
    borderRadius: themeStatic.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 130,
    ...themeStatic.shadows.card,
  },
  levelCardActive: {
    borderColor: themeStatic.carreauColor,
    backgroundColor: themeStatic.carreauColor + '08',
  },
  levelTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: themeStatic.textPrimary,
    marginTop: 10,
    marginBottom: 4,
  },
  levelTitleActive: {
    color: themeStatic.carreauColor,
  },
  levelDescription: {
    fontSize: 12,
    color: themeStatic.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: themeStatic.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: themeStatic.border,
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
    color: themeStatic.textSecondary,
    fontWeight: '500',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipButtonText: {
    fontSize: 15,
    color: themeStatic.textMuted,
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: themeStatic.primary,
    paddingVertical: 18,
    borderRadius: themeStatic.borderRadius.md,
  },
  nextButtonDisabled: {
    backgroundColor: themeStatic.textMuted,
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
    backgroundColor: themeStatic.surface,
    borderRadius: themeStatic.borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    gap: 10,
    ...themeStatic.shadows.card,
  },
  clubSearchInput: {
    flex: 1,
    fontSize: 16,
    color: themeStatic.textPrimary,
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
    backgroundColor: themeStatic.surface,
    borderRadius: themeStatic.borderRadius.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    ...themeStatic.shadows.card,
  },
  clubItemActive: {
    borderColor: themeStatic.accent,
    backgroundColor: themeStatic.accent + '08',
  },
  clubItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: themeStatic.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubItemIconActive: {
    backgroundColor: themeStatic.accent,
  },
  clubItemInfo: {
    flex: 1,
  },
  clubItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: themeStatic.textPrimary,
    marginBottom: 2,
  },
  clubItemNameActive: {
    color: themeStatic.accent,
  },
  clubItemCity: {
    fontSize: 13,
    color: themeStatic.textSecondary,
  },
  noClubsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noClubsText: {
    fontSize: 14,
    color: themeStatic.textMuted,
    marginTop: 8,
  },
  createClubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: themeStatic.primary + '10',
    paddingVertical: 16,
    borderRadius: themeStatic.borderRadius.lg,
    marginTop: 16,
    borderWidth: 2,
    borderColor: themeStatic.primary + '30',
    borderStyle: 'dashed',
    width: '100%',
  },
  createClubButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: themeStatic.primary,
  },
  createClubForm: {
    width: '100%',
    backgroundColor: themeStatic.surface,
    borderRadius: themeStatic.borderRadius.lg,
    padding: 20,
    ...themeStatic.shadows.card,
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
    color: themeStatic.textPrimary,
  },
  createClubInputWrapper: {
    marginBottom: 16,
  },
  createClubLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: themeStatic.textSecondary,
    marginBottom: 8,
  },
  createClubInput: {
    backgroundColor: themeStatic.backgroundSecondary,
    borderRadius: themeStatic.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: themeStatic.textPrimary,
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
    color: themeStatic.textSecondary,
  },
});
