import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config, { PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

const levels = ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert'] as const;

export default function NewPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { addPlayer, clubs } = useApp();

  const [name, setName] = useState('');
  const [role, setRole] = useState<PlayerRole>('Milieu');
  const [level, setLevel] = useState<typeof levels[number]>('Intermédiaire');
  const [clubId, setClubId] = useState<string | undefined>();
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
      return;
    }

    const selectedClub = clubs.find(c => c.id === clubId);

    addPlayer({
      name: name.trim(),
      role,
      level,
      clubId,
      club: selectedClub?.name,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      location: city ? {
        city,
        latitude: 0,
        longitude: 0,
      } : undefined,
      stats: {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        tirRate: 0,
        pointRate: 0,
        carreauRate: 0,
        avgPointsScored: 0,
        avgPointsConceded: 0,
      },
      createdAt: new Date().toISOString(),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Nouveau joueur</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Preview */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '?'}
              </Text>
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>NOM *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Nom complet du joueur"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              autoFocus
            />
          </Animated.View>

          {/* Role */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>RÔLE</Text>
            <View style={styles.optionsContainer}>
              {config.playerRoles.map(r => (
                <Pressable
                  key={r}
                  style={[
                    styles.optionButton,
                    role === r && styles.optionButtonActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRole(r);
                  }}
                >
                  <MaterialIcons 
                    name={r === 'Tireur' ? 'gps-fixed' : r === 'Pointeur' ? 'radio-button-on' : 'swap-horiz'} 
                    size={20} 
                    color={role === r ? '#FFF' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.optionText,
                    role === r && styles.optionTextActive
                  ]}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Level */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>NIVEAU</Text>
            <View style={styles.levelContainer}>
              {levels.map(l => (
                <Pressable
                  key={l}
                  style={[
                    styles.levelChip,
                    level === l && styles.levelChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setLevel(l);
                  }}
                >
                  <Text style={[
                    styles.levelText,
                    level === l && styles.levelTextActive
                  ]}>
                    {l}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Club */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>CLUB</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.clubsScroll}
            >
              <Pressable
                style={[
                  styles.clubChip,
                  !clubId && styles.clubChipActive
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setClubId(undefined);
                }}
              >
                <Text style={[
                  styles.clubChipText,
                  !clubId && styles.clubChipTextActive
                ]}>
                  Sans club
                </Text>
              </Pressable>
              {clubs.map(club => (
                <Pressable
                  key={club.id}
                  style={[
                    styles.clubChip,
                    clubId === club.id && styles.clubChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setClubId(club.id);
                  }}
                >
                  <Text style={[
                    styles.clubChipText,
                    clubId === club.id && styles.clubChipTextActive
                  ]}>
                    {club.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {/* City */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>VILLE</Text>
            <TextInput
              style={styles.textInput}
              value={city}
              onChangeText={setCity}
              placeholder="Ex: Lyon, Marseille..."
              placeholderTextColor={theme.textMuted}
            />
          </Animated.View>

          {/* Contact Info */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>CONTACT</Text>
            <View style={styles.contactInputs}>
              <View style={styles.contactInputContainer}>
                <MaterialIcons name="phone" size={20} color={theme.textSecondary} style={styles.contactIcon} />
                <TextInput
                  style={styles.contactInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Téléphone"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.contactInputContainer}>
                <MaterialIcons name="email" size={20} color={theme.textSecondary} style={styles.contactIcon} />
                <TextInput
                  style={styles.contactInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Adresse email"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable 
            style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]} 
            onPress={handleSave}
          >
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>Créer le joueur</Text>
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
  backButton: {
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    fontSize: 16,
    color: theme.textPrimary,
    ...theme.shadows.card,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.surface,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  optionButtonActive: {
    backgroundColor: theme.primary,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  optionTextActive: {
    color: '#FFF',
  },
  levelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  levelChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  levelChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  levelTextActive: {
    color: theme.primary,
  },
  clubsScroll: {
    gap: 10,
  },
  clubChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  clubChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accent + '10',
  },
  clubChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  clubChipTextActive: {
    color: theme.accent,
  },
  contactInputs: {
    gap: 12,
  },
  contactInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    ...theme.shadows.card,
  },
  contactIcon: {
    marginRight: 10,
  },
  contactInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.textPrimary,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: theme.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.md,
  },
  saveButtonDisabled: {
    backgroundColor: theme.textMuted,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
});
