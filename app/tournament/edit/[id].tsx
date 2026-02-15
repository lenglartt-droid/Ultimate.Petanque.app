import React, { useState, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import theme from '@/constants/theme';
import config, { GameFormat, TournamentType, TournamentLevel, TournamentCategory, RegistrationType, TournamentScope } from '@/constants/config';

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
import { useLanguage } from '@/hooks/useLanguage';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';

type TournamentStatus = 'À venir' | 'En cours' | 'Terminé';

export default function EditTournamentScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTournamentById, updateTournament, clubs } = useApp();
  const { t, language } = useLanguage();

  const tournament = getTournamentById(id!);

  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [type, setType] = useState<TournamentType>('Poules');
  const [format, setFormat] = useState<GameFormat>('Doublette');
  const [status, setStatus] = useState<TournamentStatus>('À venir');
  const [location, setLocation] = useState<LocationData>({
    address: '',
    city: '',
    country: 'France',
    latitude: 0,
    longitude: 0,
  });
  const [clubId, setClubId] = useState<string | undefined>();
  const [maxParticipants, setMaxParticipants] = useState('32');
  const [prize, setPrize] = useState('');
  const [description, setDescription] = useState('');
  const [registrationCost, setRegistrationCost] = useState('');
  const [prizeWon, setPrizeWon] = useState('');
  const [finalResult, setFinalResult] = useState<string | undefined>();
  // Tournament classification fields
  const [tournamentLevel, setTournamentLevel] = useState<TournamentLevel | string | undefined>();
  const [customLevel, setCustomLevel] = useState('');
  const [showCustomLevelInput, setShowCustomLevelInput] = useState(false);
  const [tournamentCategory, setTournamentCategory] = useState<TournamentCategory | undefined>();
  const [registrationType, setRegistrationType] = useState<RegistrationType | undefined>();
  const [tournamentScope, setTournamentScope] = useState<TournamentScope | undefined>();

  // Load tournament data
  useEffect(() => {
    if (tournament) {
      setName(tournament.name);
      setDate(new Date(tournament.date));
      setType(tournament.type);
      setFormat(tournament.format);
      setStatus(tournament.status);
      setLocation({
        address: tournament.location.name || '',
        city: tournament.location.city || '',
        country: 'France',
        latitude: tournament.location.latitude || 0,
        longitude: tournament.location.longitude || 0,
      });
      setClubId(tournament.clubId);
      setMaxParticipants(tournament.maxParticipants?.toString() || '32');
      setPrize(tournament.prize || '');
      setDescription(tournament.description || '');
      // Load financial fields
      setRegistrationCost(tournament.registrationCost?.toString() || '');
      setPrizeWon(tournament.prizeWon?.toString() || '');
      setFinalResult(tournament.finalResult);
      // Load classification fields
      if (tournament.tournamentLevel) {
        const isCustom = !config.tournamentLevels.includes(tournament.tournamentLevel as TournamentLevel);
        if (isCustom) {
          setShowCustomLevelInput(true);
          setCustomLevel(tournament.tournamentLevel);
        }
        setTournamentLevel(tournament.tournamentLevel);
      }
      setTournamentCategory(tournament.tournamentCategory);
      setRegistrationType(tournament.registrationType);
      setTournamentScope(tournament.tournamentScope);
      // Load end date
      if (tournament.endDate) {
        setEndDate(new Date(tournament.endDate));
      }
    }
  }, [tournament]);

  // Helper function to determine status based on date
  const getStatusFromDate = (selectedDate: Date, endDate?: Date): TournamentStatus => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    
    // If start date is in the future → "À venir"
    if (startDate > today) {
      return 'À venir';
    }
    
    // If end date exists and is in the past → "Terminé"
    // If no end date and start date is in the past → "Terminé"
    if (end) {
      if (end < today) {
        return 'Terminé';
      }
      // Start date is today or past, end date is today or future → "En cours"
      return 'En cours';
    }
    
    // No end date: if start date is today → "En cours", if past → "Terminé"
    if (startDate.getTime() === today.getTime()) {
      return 'En cours';
    }
    
    return 'Terminé';
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      if (endDate && selectedDate > endDate) setEndDate(null);
      const newStatus = getStatusFromDate(selectedDate, endDate && selectedDate <= endDate ? endDate : undefined);
      setStatus(newStatus);
      Haptics.selectionAsync();
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
      const newStatus = getStatusFromDate(date, selectedDate);
      setStatus(newStatus);
      Haptics.selectionAsync();
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('common', 'error'), t('tournament', 'errorNameRequired'));
      return;
    }
    if (!location.city.trim()) {
      Alert.alert(t('common', 'error'), t('tournament', 'errorCityRequired'));
      return;
    }

    const selectedClub = clubs.find(c => c.id === clubId);

    updateTournament(id!, {
      name: name.trim(),
      date: date.toISOString(),
      endDate: endDate ? endDate.toISOString() : undefined,
      type,
      format,
      status,
      location: {
        name: location.address.trim() || location.city.trim(),
        city: location.city.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
      },
      clubId,
      clubName: selectedClub?.name,
      maxParticipants: parseInt(maxParticipants) || 32,
      prize: prize.trim() || undefined,
      description: description.trim() || undefined,
      tournamentLevel,
      tournamentCategory,
      registrationType,
      tournamentScope,
      registrationCost: registrationCost ? parseFloat(registrationCost) : undefined,
      prizeWon: prizeWon ? parseFloat(prizeWon) : undefined,
      finalResult,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (!tournament) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('tournament', 'editTournament')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
          <Text style={styles.emptyText}>{t('tournament', 'tournamentNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('tournament', 'editTournament')}</Text>
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
            <Text style={styles.sectionTitle}>{t('tournament', 'tournamentNameRequired')}</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t('tournament', 'namePlaceholder')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
            />
          </Animated.View>

          {/* Status */}
          <Animated.View entering={FadeInDown.duration(400).delay(125)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'statusLabel')}</Text>
            <View style={styles.statusContainer}>
              {(['À venir', 'En cours', 'Terminé'] as TournamentStatus[]).map(s => {
                const statusConfig = {
                  'À venir': { icon: 'schedule', color: theme.primary },
                  'En cours': { icon: 'play-circle', color: theme.warning },
                  'Terminé': { icon: 'check-circle', color: theme.success },
                };
                const config = statusConfig[s];
                return (
                  <Pressable
                    key={s}
                    style={[
                      styles.statusChip,
                      status === s && [styles.statusChipActive, { borderColor: config.color }]
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setStatus(s);
                    }}
                  >
                    <MaterialIcons 
                      name={config.icon as any} 
                      size={18} 
                      color={status === s ? config.color : theme.textSecondary} 
                    />
                    <Text style={[
                      styles.statusText,
                      status === s && { color: config.color }
                    ]}>
                      {t('tournamentStatus', s)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Date */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'dateRequired')}</Text>
            <Pressable 
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialIcons name="event" size={20} color={theme.primary} />
              <Text style={styles.dateText}>
                {date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { 
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
              />
            )}

            {/* End Date */}
            <View style={{ marginTop: 12 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>{t('tournament', 'endDateOptional')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable
                  style={[styles.dateButton, { flex: 1 }]}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <MaterialIcons name="event" size={20} color={endDate ? theme.accent : theme.textMuted} />
                  <Text style={[styles.dateText, !endDate && { color: theme.textMuted }]}>
                    {endDate
                      ? endDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                      : t('tournament', 'singleDayOnly')
                    }
                  </Text>
                </Pressable>
                {endDate && (
                  <Pressable
                    style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.error + '15', borderRadius: theme.borderRadius.md }}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEndDate(null);
                      const newStatus = getStatusFromDate(date);
                      setStatus(newStatus);
                    }}
                  >
                    <MaterialIcons name="close" size={18} color={theme.error} />
                  </Pressable>
                )}
              </View>
              {showEndDatePicker && (
                <DateTimePicker
                  value={endDate || date}
                  mode="date"
                  display="default"
                  onChange={handleEndDateChange}
                  minimumDate={date}
                />
              )}
            </View>
          </Animated.View>

          {/* Type */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'cadrageUpper')}</Text>
            <View style={styles.typeContainer}>
              {config.tournamentTypes.map(ct => (
                <Pressable
                  key={ct}
                  style={[
                    styles.typeChip,
                    type === ct && styles.typeChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setType(ct);
                  }}
                >
                  <Text style={[
                    styles.typeText,
                    type === ct && styles.typeTextActive
                  ]}>
                    {t('tournamentTypes', ct)}
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

          {/* Tournament Level */}
          <Animated.View entering={FadeInDown.duration(400).delay(225)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'tournamentLevelUpper')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {config.tournamentLevels.map(level => (
                <Pressable
                  key={level}
                  style={[
                    styles.levelChip,
                    tournamentLevel === level && !showCustomLevelInput && styles.levelChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowCustomLevelInput(false);
                    setCustomLevel('');
                    setTournamentLevel(tournamentLevel === level ? undefined : level);
                  }}
                >
                  <Text style={[
                    styles.levelChipText,
                    tournamentLevel === level && !showCustomLevelInput && styles.levelChipTextActive
                  ]}>
                    {level}
                  </Text>
                </Pressable>
              ))}
              {/* Custom Level Option */}
              <Pressable
                style={[
                  styles.levelChip,
                  styles.customLevelChip,
                  showCustomLevelInput && styles.levelChipActive
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setShowCustomLevelInput(!showCustomLevelInput);
                  if (!showCustomLevelInput) {
                    setTournamentLevel(undefined);
                  }
                }}
              >
                <MaterialIcons 
                  name="add" 
                  size={16} 
                  color={showCustomLevelInput ? theme.success : theme.textSecondary} 
                />
                <Text style={[
                  styles.levelChipText,
                  showCustomLevelInput && styles.levelChipTextActive
                ]}>
                  {t('tournament', 'otherLevel')}
                </Text>
              </Pressable>
            </ScrollView>
            
            {/* Custom Level Input */}
            {showCustomLevelInput && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.customLevelInputContainer}>
                <TextInput
                  style={styles.customLevelInput}
                  value={customLevel}
                  onChangeText={(text) => {
                    setCustomLevel(text);
                    setTournamentLevel(text.trim() || undefined);
                  }}
                  placeholder={t('tournament', 'customLevelPlaceholderLong')}
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                />
                {customLevel.trim() && (
                  <View style={styles.customLevelBadge}>
                    <MaterialIcons name="check" size={14} color={theme.success} />
                  </View>
                )}
              </Animated.View>
            )}
          </Animated.View>

          {/* Tournament Category */}
          <Animated.View entering={FadeInDown.duration(400).delay(235)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'tournamentTypeUpper')}</Text>
            <View style={styles.categoryContainer}>
              {config.tournamentCategories.map(cat => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryChip,
                    tournamentCategory === cat && styles.categoryChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTournamentCategory(tournamentCategory === cat ? undefined : cat);
                  }}
                >
                  <Text style={[
                    styles.categoryChipText,
                    tournamentCategory === cat && styles.categoryChipTextActive
                  ]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Registration Type */}
          <Animated.View entering={FadeInDown.duration(400).delay(245)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'registrationTypeUpper')}</Text>
            <View style={styles.registrationContainer}>
              {config.registrationTypes.map(reg => (
                <Pressable
                  key={reg}
                  style={[
                    styles.registrationChip,
                    registrationType === reg && styles.registrationChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRegistrationType(registrationType === reg ? undefined : reg);
                  }}
                >
                  <Text style={[
                    styles.registrationChipText,
                    registrationType === reg && styles.registrationChipTextActive
                  ]}>
                    {reg}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Tournament Scope */}
          <Animated.View entering={FadeInDown.duration(400).delay(248)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'scopeUpper')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {config.tournamentScopes.map(scope => (
                <Pressable
                  key={scope}
                  style={[
                    styles.scopeChip,
                    tournamentScope === scope && styles.scopeChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTournamentScope(tournamentScope === scope ? undefined : scope);
                  }}
                >
                  <Text style={[
                    styles.scopeChipText,
                    tournamentScope === scope && styles.scopeChipTextActive
                  ]}>
                    {scope}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Format */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'formatUpper')}</Text>
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
                    {t('formats', f)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Location */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <LocationPicker
              label={t('tournament', 'tournamentLocation')}
              value={location}
              onChange={setLocation}
              placeholder={t('tournament', 'searchAddress')}
              required
              showAddressField
            />
          </Animated.View>

          {/* Organizing Club */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'organizingClubUpper')}</Text>
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
                  {t('tournament', 'none')}
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
            <Text style={styles.sectionTitle}>{t('tournament', 'maxParticipantsUpper')}</Text>
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

          {/* Registration Cost */}
          <Animated.View entering={FadeInDown.duration(400).delay(450)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'registrationCostUpper')}</Text>
            <TextInput
              style={styles.textInput}
              value={registrationCost}
              onChangeText={setRegistrationCost}
              placeholder="Ex: 15"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
            />
          </Animated.View>

          {/* Prize */}
          <Animated.View entering={FadeInDown.duration(400).delay(475)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'prizeUpper')}</Text>
            <TextInput
              style={styles.textInput}
              value={prize}
              onChangeText={setPrize}
              placeholder={t('tournament', 'prizePlaceholderLong')}
              placeholderTextColor={theme.textMuted}
            />
          </Animated.View>

          {/* Final Result & Prize Won (only for finished tournaments) */}
          {status === 'Terminé' && (
            <>
              <Animated.View entering={FadeInDown.duration(400).delay(488)} style={styles.section}>
                <Text style={styles.sectionTitle}>{t('tournament', 'finalResultUpper')}</Text>
                <View style={styles.finalResultContainer}>
                  {['1er', '2ème', '3ème', 'Demi-finale', 'Quart de finale', '1/8 finale', 'Poules', 'Autre'].map(result => {
                    const resultConfig: Record<string, { icon: string; color: string }> = {
                      '1er': { icon: 'emoji-events', color: theme.carreauColor },
                      '2ème': { icon: 'workspace-premium', color: theme.accent },
                      '3ème': { icon: 'military-tech', color: '#CD7F32' },
                      'Demi-finale': { icon: 'trending-up', color: theme.primary },
                      'Quart de finale': { icon: 'trending-flat', color: theme.warning },
                      '1/8 finale': { icon: 'sports', color: theme.textSecondary },
                      'Poules': { icon: 'group', color: theme.textSecondary },
                      'Autre': { icon: 'more-horiz', color: theme.textMuted },
                    };
                    const cfg = resultConfig[result] || { icon: 'help', color: theme.textMuted };
                    const isSelected = finalResult === result;
                    return (
                      <Pressable
                        key={result}
                        style={[
                          styles.finalResultChip,
                          isSelected && [styles.finalResultChipActive, { borderColor: cfg.color }]
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setFinalResult(finalResult === result ? undefined : result);
                        }}
                      >
                        <MaterialIcons name={cfg.icon as any} size={18} color={isSelected ? cfg.color : theme.textSecondary} />
                        <Text style={[styles.finalResultText, isSelected && { color: cfg.color }]}>{result}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
              <Animated.View entering={FadeInDown.duration(400).delay(490)} style={styles.section}>
                <Text style={styles.sectionTitle}>{t('tournament', 'prizeWonUpper')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={prizeWon}
                  onChangeText={setPrizeWon}
                  placeholder="Ex: 50"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
              </Animated.View>
            </>
          )}

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(525)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('tournament', 'description').toUpperCase()}</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('tournament', 'descriptionPlaceholderLong')}
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
            style={[styles.saveButton, (!name.trim() || !location.city.trim()) && styles.saveButtonDisabled]} 
            onPress={handleSave}
          >
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>{t('tournament', 'saveChanges')}</Text>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.textMuted,
    marginTop: 12,
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
  // Status styles
  statusContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  statusChipActive: {
    backgroundColor: theme.surface,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
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
  // Tournament classification styles
  horizontalScroll: {
    gap: 10,
    paddingRight: 16,
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
    borderColor: theme.success,
    backgroundColor: theme.success + '10',
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  levelChipTextActive: {
    color: theme.success,
  },
  customLevelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customLevelInputContainer: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.success,
    ...theme.shadows.card,
  },
  customLevelInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.textPrimary,
  },
  customLevelBadge: {
    marginRight: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.success + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  categoryChipActive: {
    borderColor: theme.warning,
    backgroundColor: theme.warning + '10',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  categoryChipTextActive: {
    color: theme.warning,
  },
  registrationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  registrationChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  registrationChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  registrationChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  registrationChipTextActive: {
    color: theme.primary,
  },
  scopeChip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  scopeChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accent + '10',
  },
  scopeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  scopeChipTextActive: {
    color: theme.accent,
  },
  finalResultContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  finalResultChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  finalResultChipActive: {
    backgroundColor: theme.surface,
  },
  finalResultText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
});
