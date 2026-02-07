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
import DateTimePicker from '@react-native-community/datetimepicker';
import theme from '@/constants/theme';
import config, { GameFormat, TournamentType, TerrainType } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

// Cadrage rules configuration
const CADRAGE_RULES: Record<TournamentType, { description: string; matches: string; points: string; specifics: string[] }> = {
  'Poules': {
    description: 'Phase de qualification en groupes',
    matches: '2-3 matchs par équipe',
    points: '13 points',
    specifics: ['3-4 équipes par poule', 'Tous contre tous', 'Top 1-2 qualifiés'],
  },
  'Élimination directe': {
    description: 'Tableau à élimination simple',
    matches: '1 match = 1 chance',
    points: '13 points',
    specifics: ['Perdant éliminé', 'Pas de repêchage', 'Avancement direct'],
  },
  'Mixte': {
    description: 'Poules + Élimination directe',
    matches: '3-5 matchs minimum',
    points: '13 points',
    specifics: ['Phase poules puis tableau', 'Qualifiés selon classement', 'Format le plus courant'],
  },
  'Suisse': {
    description: 'Système suisse par rondes',
    matches: '5-7 rondes fixes',
    points: '13 points',
    specifics: ['Adversaires de niveau similaire', 'Pas d\'élimination', 'Classement par points'],
  },
  'A/B/C': {
    description: 'Tableaux multiples avec repêchage',
    matches: '4-6 matchs garantis',
    points: '13 points',
    specifics: ['Tableau A (principal)', 'Tableaux B/C (consolante)', 'Perdants repêchés'],
  },
  'Tirage intégral': {
    description: 'Tirage au sort complet dès le départ',
    matches: 'Variable selon place',
    points: '13 points',
    specifics: ['Tableau fixé au départ', 'Parcours aléatoire', 'Format rapide'],
  },
  'Autre': {
    description: 'Format personnalisé',
    matches: 'À définir',
    points: 'À définir',
    specifics: ['Règles libres', 'Adaptable selon besoin'],
  },
};
import { useApp } from '@/contexts/AppContext';

export default function NewTournamentScreen() {
  const insets = useSafeAreaInsets();
  const { addTournament, clubs, terrains } = useApp();

  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [type, setType] = useState<TournamentType>('Poules');
  const [format, setFormat] = useState<GameFormat>('Doublette');
  const [terrainId, setTerrainId] = useState<string | undefined>();
  const [locationName, setLocationName] = useState('');
  const [city, setCity] = useState('');
  const [clubId, setClubId] = useState<string | undefined>();
  const [maxParticipants, setMaxParticipants] = useState('32');
  const [prize, setPrize] = useState('');
  const [description, setDescription] = useState('');

  // Get selected terrain for display
  const selectedTerrain = terrains.find(t => t.id === terrainId);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du tournoi est obligatoire');
      return;
    }
    if (!terrainId && !city.trim()) {
      Alert.alert('Erreur', 'Sélectionnez un terrain ou indiquez une ville');
      return;
    }

    const selectedClub = clubs.find(c => c.id === clubId);
    const terrain = terrains.find(t => t.id === terrainId);

    addTournament({
      name: name.trim(),
      date: date.toISOString(),
      type,
      format,
      location: {
        name: terrain?.name || locationName.trim() || city.trim(),
        city: terrain?.city || city.trim(),
        latitude: terrain?.location.latitude || 0,
        longitude: terrain?.location.longitude || 0,
      },
      terrainId: terrain?.id,
      terrainName: terrain?.name,
      terrainType: terrain?.type,
      clubId,
      clubName: selectedClub?.name,
      status: 'À venir',
      participants: 0,
      maxParticipants: parseInt(maxParticipants) || 32,
      prize: prize.trim() || undefined,
      description: description.trim() || undefined,
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
        <Text style={styles.headerTitle}>Nouveau tournoi</Text>
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
            <View style={styles.tournamentIcon}>
              <MaterialIcons name="emoji-events" size={48} color="#FFF" />
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>NOM DU TOURNOI *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Tournoi de Printemps"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              autoFocus
            />
          </Animated.View>

          {/* Date */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>DATE *</Text>
            <Pressable 
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialIcons name="event" size={20} color={theme.primary} />
              <Text style={styles.dateText}>
                {date.toLocaleDateString('fr-FR', { 
                  weekday: 'long',
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}
          </Animated.View>

          {/* Type */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>CADRAGE</Text>
            <View style={styles.typeContainer}>
              {config.tournamentTypes.map(t => (
                <Pressable
                  key={t}
                  style={[
                    styles.typeChip,
                    type === t && styles.typeChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setType(t);
                  }}
                >
                  <Text style={[
                    styles.typeText,
                    type === t && styles.typeTextActive
                  ]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Cadrage Rules Info */}
            {type && CADRAGE_RULES[type] && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.cadrageRulesCard}>
                <View style={styles.cadrageRulesHeader}>
                  <MaterialIcons name="info-outline" size={20} color={theme.primary} />
                  <Text style={styles.cadrageRulesTitle}>{CADRAGE_RULES[type].description}</Text>
                </View>
                <View style={styles.cadrageRulesStats}>
                  <View style={styles.cadrageRulesStat}>
                    <MaterialIcons name="sports" size={16} color={theme.textSecondary} />
                    <Text style={styles.cadrageRulesStatText}>{CADRAGE_RULES[type].matches}</Text>
                  </View>
                  <View style={styles.cadrageRulesStat}>
                    <MaterialIcons name="flag" size={16} color={theme.textSecondary} />
                    <Text style={styles.cadrageRulesStatText}>{CADRAGE_RULES[type].points}</Text>
                  </View>
                </View>
                <View style={styles.cadrageRulesSpecifics}>
                  {CADRAGE_RULES[type].specifics.map((spec, index) => (
                    <View key={index} style={styles.cadrageRulesSpecificItem}>
                      <View style={styles.cadrageRulesSpecificDot} />
                      <Text style={styles.cadrageRulesSpecificText}>{spec}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </Animated.View>

          {/* Format */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>FORMAT</Text>
            <View style={styles.formatContainer}>
              {config.game.formats.map(f => (
                <Pressable
                  key={f}
                  style={[
                    styles.formatChip,
                    format === f && styles.formatChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFormat(f);
                  }}
                >
                  <Text style={[
                    styles.formatText,
                    format === f && styles.formatTextActive
                  ]}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Terrain */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TERRAIN *</Text>
              <Pressable 
                style={styles.addTerrainButton}
                onPress={() => router.push('/terrain/new')}
              >
                <MaterialIcons name="add" size={16} color={theme.primary} />
                <Text style={styles.addTerrainText}>Ajouter</Text>
              </Pressable>
            </View>
            
            {terrains.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.terrainsScroll}
              >
                <Pressable
                  style={[
                    styles.terrainChip,
                    !terrainId && styles.terrainChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTerrainId(undefined);
                  }}
                >
                  <MaterialIcons 
                    name="edit-location" 
                    size={18} 
                    color={!terrainId ? theme.primary : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.terrainChipText,
                    !terrainId && styles.terrainChipTextActive
                  ]}>
                    Autre lieu
                  </Text>
                </Pressable>
                {terrains.map(terrain => {
                  const typeConfig = config.terrainTypes.find(t => t.id === terrain.type);
                  return (
                    <Pressable
                      key={terrain.id}
                      style={[
                        styles.terrainCard,
                        terrainId === terrain.id && styles.terrainCardActive
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setTerrainId(terrain.id);
                        setCity(terrain.city);
                      }}
                    >
                      <View style={[
                        styles.terrainCardIcon,
                        terrainId === terrain.id && styles.terrainCardIconActive
                      ]}>
                        <MaterialIcons 
                          name={typeConfig?.icon as any || 'landscape'} 
                          size={20} 
                          color={terrainId === terrain.id ? '#FFF' : theme.textSecondary} 
                        />
                      </View>
                      <Text style={[
                        styles.terrainCardName,
                        terrainId === terrain.id && styles.terrainCardNameActive
                      ]} numberOfLines={1}>
                        {terrain.name}
                      </Text>
                      <Text style={styles.terrainCardCity}>{terrain.city}</Text>
                      <View style={styles.terrainCardType}>
                        <Text style={styles.terrainCardTypeText}>{terrain.type}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.noTerrainsContainer}>
                <MaterialIcons name="sports-soccer" size={40} color={theme.textMuted} />
                <Text style={styles.noTerrainsText}>Aucun terrain enregistré</Text>
                <Pressable 
                  style={styles.createTerrainButton}
                  onPress={() => router.push('/terrain/new')}
                >
                  <MaterialIcons name="add" size={18} color={theme.primary} />
                  <Text style={styles.createTerrainButtonText}>Créer un terrain</Text>
                </Pressable>
              </View>
            )}

            {/* Show manual location fields only if no terrain selected */}
            {!terrainId && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.manualLocationContainer}>
                <TextInput
                  style={[styles.textInput, { marginBottom: 12 }]}
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="Nom du lieu (ex: Parc de la Tête d'Or)"
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
            )}

            {/* Show selected terrain info */}
            {selectedTerrain && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.selectedTerrainInfo}>
                <MaterialIcons name="place" size={18} color={theme.success} />
                <Text style={styles.selectedTerrainText}>
                  {selectedTerrain.address}, {selectedTerrain.city}
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Organizing Club */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>CLUB ORGANISATEUR</Text>
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

          {/* Max Participants */}
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>NOMBRE MAX DE PARTICIPANTS</Text>
            <View style={styles.participantsContainer}>
              {['16', '24', '32', '48', '64'].map(num => (
                <Pressable
                  key={num}
                  style={[
                    styles.participantChip,
                    maxParticipants === num && styles.participantChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setMaxParticipants(num);
                  }}
                >
                  <Text style={[
                    styles.participantText,
                    maxParticipants === num && styles.participantTextActive
                  ]}>
                    {num}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Prize */}
          <Animated.View entering={FadeInDown.duration(400).delay(450)} style={styles.section}>
            <Text style={styles.sectionTitle}>DOTATION</Text>
            <TextInput
              style={styles.textInput}
              value={prize}
              onChangeText={setPrize}
              placeholder="Ex: 500€, Trophées..."
              placeholderTextColor={theme.textMuted}
            />
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.section}>
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
            style={[styles.saveButton, (!name.trim() || (!terrainId && !city.trim())) && styles.saveButtonDisabled]} 
            onPress={handleSave}
          >
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>Créer le tournoi</Text>
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
  tournamentIcon: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: theme.carreauColor,
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  dateText: {
    fontSize: 16,
    color: theme.textPrimary,
    textTransform: 'capitalize',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeChip: {
    minWidth: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  typeChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  typeTextActive: {
    color: theme.primary,
  },
  formatContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  formatChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  formatChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accent + '10',
  },
  formatText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  formatTextActive: {
    color: theme.accent,
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
  participantsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  participantChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  participantChipActive: {
    borderColor: theme.carreauColor,
    backgroundColor: theme.carreauColor + '10',
  },
  participantText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  participantTextActive: {
    color: theme.carreauColor,
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
    backgroundColor: theme.carreauColor,
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
  // Cadrage rules styles
  cadrageRulesCard: {
    backgroundColor: theme.primary + '08',
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.primary + '20',
  },
  cadrageRulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cadrageRulesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
    flex: 1,
  },
  cadrageRulesStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.primary + '15',
  },
  cadrageRulesStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cadrageRulesStatText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  cadrageRulesSpecifics: {
    gap: 6,
  },
  cadrageRulesSpecificItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cadrageRulesSpecificDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.primary,
  },
  cadrageRulesSpecificText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  // Terrain selection styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addTerrainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.sm,
  },
  addTerrainText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
  terrainsScroll: {
    gap: 12,
    paddingBottom: 4,
  },
  terrainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  terrainChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  terrainChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  terrainChipTextActive: {
    color: theme.primary,
  },
  terrainCard: {
    width: 140,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    ...theme.shadows.card,
  },
  terrainCardActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accent + '08',
  },
  terrainCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  terrainCardIconActive: {
    backgroundColor: theme.accent,
  },
  terrainCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  terrainCardNameActive: {
    color: theme.accent,
  },
  terrainCardCity: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 6,
  },
  terrainCardType: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  terrainCardTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  noTerrainsContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    ...theme.shadows.card,
  },
  noTerrainsText: {
    fontSize: 14,
    color: theme.textMuted,
  },
  createTerrainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.md,
  },
  createTerrainButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  manualLocationContainer: {
    marginTop: 16,
  },
  selectedTerrainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.success + '10',
    borderRadius: theme.borderRadius.md,
  },
  selectedTerrainText: {
    fontSize: 13,
    color: theme.success,
    flex: 1,
  },
});
