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
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config, { TerrainType } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

export default function NewTerrainScreen() {
  const insets = useSafeAreaInsets();
  const { addTerrain, clubs } = useApp();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<TerrainType>('Stabilisé');
  const [description, setDescription] = useState('');
  const [clubId, setClubId] = useState<string | undefined>();
  const [courtsCount, setCourtsCount] = useState('1');
  const [isPublic, setIsPublic] = useState(true);
  const [lighting, setLighting] = useState(false);
  const [covered, setCovered] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du terrain est obligatoire');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Erreur', "L'adresse est obligatoire");
      return;
    }
    if (!city.trim()) {
      Alert.alert('Erreur', 'La ville est obligatoire');
      return;
    }

    const selectedClub = clubs.find(c => c.id === clubId);

    await addTerrain({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      location: { latitude: 0, longitude: 0 },
      type,
      description: description.trim() || undefined,
      facilities: [],
      clubId,
      clubName: selectedClub?.name,
      isPublic,
      courtsCount: parseInt(courtsCount) || 1,
      lighting,
      covered,
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
        <Text style={styles.headerTitle}>Nouveau terrain</Text>
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
          {/* Icon Preview */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.iconSection}>
            <View style={styles.terrainIcon}>
              <MaterialIcons 
                name={config.terrainTypes.find(t => t.id === type)?.icon as any || 'landscape'} 
                size={48} 
                color="#FFF" 
              />
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>NOM DU TERRAIN *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Boulodrome Municipal"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              autoFocus
            />
          </Animated.View>

          {/* Type */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>TYPE DE TERRAIN *</Text>
            <View style={styles.typeContainer}>
              {config.terrainTypes.map((t, index) => (
                <Pressable
                  key={t.id}
                  style={[
                    styles.typeCard,
                    type === t.id && styles.typeCardActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setType(t.id);
                  }}
                >
                  <View style={[
                    styles.typeIconContainer,
                    type === t.id && styles.typeIconContainerActive
                  ]}>
                    <MaterialIcons 
                      name={t.icon as any} 
                      size={24} 
                      color={type === t.id ? '#FFF' : theme.textSecondary} 
                    />
                  </View>
                  <Text style={[
                    styles.typeName,
                    type === t.id && styles.typeNameActive
                  ]}>
                    {t.label}
                  </Text>
                  <Text style={styles.typeDescription} numberOfLines={2}>
                    {t.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Address */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>ADRESSE *</Text>
            <TextInput
              style={[styles.textInput, { marginBottom: 12 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Numéro et rue"
              placeholderTextColor={theme.textMuted}
            />
            <TextInput
              style={styles.textInput}
              value={city}
              onChangeText={setCity}
              placeholder="Ville *"
              placeholderTextColor={theme.textMuted}
            />
          </Animated.View>

          {/* Club */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>CLUB ASSOCIÉ</Text>
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
                  Aucun
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

          {/* Courts Count */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>NOMBRE DE TERRAINS</Text>
            <View style={styles.countsContainer}>
              {['1', '2', '4', '6', '8', '10', '12', '18'].map(num => (
                <Pressable
                  key={num}
                  style={[
                    styles.countChip,
                    courtsCount === num && styles.countChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCourtsCount(num);
                  }}
                >
                  <Text style={[
                    styles.countText,
                    courtsCount === num && styles.countTextActive
                  ]}>
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Features */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>CARACTÉRISTIQUES</Text>
            <View style={styles.featuresCard}>
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <MaterialIcons name="public" size={24} color={theme.primary} />
                  <View>
                    <Text style={styles.featureTitle}>Accès public</Text>
                    <Text style={styles.featureDescription}>Ouvert à tous les joueurs</Text>
                  </View>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: theme.border, true: theme.primary + '50' }}
                  thumbColor={isPublic ? theme.primary : theme.textMuted}
                />
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <MaterialIcons name="lightbulb" size={24} color={theme.warning} />
                  <View>
                    <Text style={styles.featureTitle}>Éclairage</Text>
                    <Text style={styles.featureDescription}>Jeu en soirée possible</Text>
                  </View>
                </View>
                <Switch
                  value={lighting}
                  onValueChange={setLighting}
                  trackColor={{ false: theme.border, true: theme.warning + '50' }}
                  thumbColor={lighting ? theme.warning : theme.textMuted}
                />
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <MaterialIcons name="roofing" size={24} color={theme.accent} />
                  <View>
                    <Text style={styles.featureTitle}>Couvert</Text>
                    <Text style={styles.featureDescription}>Protection contre intempéries</Text>
                  </View>
                </View>
                <Switch
                  value={covered}
                  onValueChange={setCovered}
                  trackColor={{ false: theme.border, true: theme.accent + '50' }}
                  thumbColor={covered ? theme.accent : theme.textMuted}
                />
              </View>
            </View>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>DESCRIPTION</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Informations complémentaires..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable 
            style={[styles.saveButton, (!name.trim() || !address.trim() || !city.trim()) && styles.saveButtonDisabled]} 
            onPress={handleSave}
          >
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>Créer le terrain</Text>
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
  iconSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  terrainIcon: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
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
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '48%',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    minHeight: 120,
    ...theme.shadows.card,
  },
  typeCardActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accent + '08',
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  typeIconContainerActive: {
    backgroundColor: theme.accent,
  },
  typeName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  typeNameActive: {
    color: theme.accent,
  },
  typeDescription: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
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
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  clubChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  clubChipTextActive: {
    color: theme.primary,
  },
  countsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  countChip: {
    minWidth: 50,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  countChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accent + '10',
  },
  countText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  countTextActive: {
    color: theme.accent,
  },
  featuresCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  featureDescription: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  featureDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 14,
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
    backgroundColor: theme.accent,
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
