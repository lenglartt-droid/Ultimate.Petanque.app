import React, { useState, useMemo } from 'react';
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
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import theme from '@/constants/theme';
import config, { GameFormat, TournamentType, TournamentLevel, TournamentCategory, RegistrationType, TournamentScope } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';

// ============================================
// CONFIGURATION
// ============================================
const CADRAGE_ICONS: Record<TournamentType, string> = {
  'Poules': 'grid-view',
  'Élimination directe': 'call-split',
  'Mixte': 'merge-type',
  'Suisse': 'sync-alt',
  'A/B/C': 'account-tree',
  'Tirage intégral': 'shuffle',
  'Autre': 'tune',
};

const FORMAT_CONFIG: Record<string, { icon: string; players: string; boules: string }> = {
  'Tête-à-tête': { icon: 'person', players: '1 vs 1', boules: '3 boules' },
  'Doublette': { icon: 'people', players: '2 vs 2', boules: '3 boules' },
  'Triplette': { icon: 'groups', players: '3 vs 3', boules: '2 boules' },
};

const LEVEL_ICONS: Record<string, string> = {
  'Loisir / Amical': 'sentiment-satisfied',
  'Promotion': 'trending-up',
  'Honneur': 'shield',
  'Élite': 'diamond',
  'Vétérans': 'elderly',
  'Jeunes (Minimes)': 'child-care',
  'Jeunes (Cadets)': 'school',
  'Jeunes (Juniors)': 'sports',
};

// ============================================
// SUB-COMPONENTS
// ============================================
function SectionCard({ children, title, subtitle, icon, color, delay = 0, required = false }: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  delay?: number;
  required?: boolean;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(350).delay(delay)} style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View style={[styles.sectionCardIcon, { backgroundColor: color + '15' }]}>
          <MaterialIcons name={icon as any} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionCardTitle}>{title}</Text>
            {required && <View style={styles.requiredDot} />}
          </View>
          {subtitle ? <Text style={styles.sectionCardSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </Animated.View>
  );
}

function StepIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  const pct = Math.round((step / total) * 100);
  return (
    <View style={styles.stepIndicator}>
      <View style={styles.stepBarTrack}>
        <Animated.View entering={FadeIn.duration(600)} style={[styles.stepBarFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function NewTournamentScreen() {
  const insets = useSafeAreaInsets();
  const { addTournament, clubs, terrains } = useApp();
  const { t, language } = useLanguage();

  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [type, setType] = useState<TournamentType>('Mixte');
  const [format, setFormat] = useState<GameFormat>('Doublette');
  const [terrainId, setTerrainId] = useState<string | undefined>();
  const [manualLocation, setManualLocation] = useState<LocationData>({
    address: '', city: '', country: 'France', latitude: 0, longitude: 0,
  });
  const [clubId, setClubId] = useState<string | undefined>();
  const [maxParticipants, setMaxParticipants] = useState('32');
  const [prize, setPrize] = useState('');
  const [description, setDescription] = useState('');
  const [registrationCost, setRegistrationCost] = useState('');
  const [tournamentLevel, setTournamentLevel] = useState<TournamentLevel | string | undefined>();
  const [customLevel, setCustomLevel] = useState('');
  const [showCustomLevelInput, setShowCustomLevelInput] = useState(false);
  const [tournamentCategory, setTournamentCategory] = useState<TournamentCategory | undefined>();
  const [registrationType, setRegistrationType] = useState<RegistrationType | undefined>();
  const [tournamentScope, setTournamentScope] = useState<TournamentScope | undefined>();

  const selectedTerrain = terrains.find(t => t.id === terrainId);

  // Progress calculation
  const progress = useMemo(() => {
    let filled = 0;
    const total = 4; // name, date, location, format
    if (name.trim()) filled++;
    filled++; // date always filled
    if (terrainId || manualLocation.city.trim()) filled++;
    filled++; // format always filled
    return { filled, total };
  }, [name, terrainId, manualLocation.city]);

  const progressLabel = useMemo(() => {
    if (!name.trim()) return t('tournament', 'startWithName');
    if (!terrainId && !manualLocation.city.trim()) return t('tournament', 'chooseLocation');
    return t('tournament', 'readyToCreate');
  }, [name, terrainId, manualLocation.city]);

  const CADRAGE_CONFIG = useMemo(() => ({
    'Poules': { icon: 'grid-view', description: t('cadrage', 'poulesDesc'), matches: t('cadrage', 'poulesMatches'), points: t('cadrage', 'poulesPoints'), specifics: [t('cadrage', 'poulesSpec1'), t('cadrage', 'poulesSpec2'), t('cadrage', 'poulesSpec3')] },
    'Élimination directe': { icon: 'call-split', description: t('cadrage', 'elimDesc'), matches: t('cadrage', 'elimMatches'), points: t('cadrage', 'elimPoints'), specifics: [t('cadrage', 'elimSpec1'), t('cadrage', 'elimSpec2'), t('cadrage', 'elimSpec3')] },
    'Mixte': { icon: 'merge-type', description: t('cadrage', 'mixteDesc'), matches: t('cadrage', 'mixteMatches'), points: t('cadrage', 'mixtePoints'), specifics: [t('cadrage', 'mixteSpec1'), t('cadrage', 'mixteSpec2'), t('cadrage', 'mixteSpec3')] },
    'Suisse': { icon: 'sync-alt', description: t('cadrage', 'suisseDesc'), matches: t('cadrage', 'suisseMatches'), points: t('cadrage', 'suissePoints'), specifics: [t('cadrage', 'suisseSpec1'), t('cadrage', 'suisseSpec2'), t('cadrage', 'suisseSpec3')] },
    'A/B/C': { icon: 'account-tree', description: t('cadrage', 'abcDesc'), matches: t('cadrage', 'abcMatches'), points: t('cadrage', 'abcPoints'), specifics: [t('cadrage', 'abcSpec1'), t('cadrage', 'abcSpec2'), t('cadrage', 'abcSpec3')] },
    'Tirage intégral': { icon: 'shuffle', description: t('cadrage', 'tirageDesc'), matches: t('cadrage', 'tirageMatches'), points: t('cadrage', 'tiragePoints'), specifics: [t('cadrage', 'tirageSpec1'), t('cadrage', 'tirageSpec2'), t('cadrage', 'tirageSpec3')] },
    'Autre': { icon: 'tune', description: t('cadrage', 'autreDesc'), matches: t('cadrage', 'autreMatches'), points: t('cadrage', 'autrePoints'), specifics: [t('cadrage', 'autreSpec1'), t('cadrage', 'autreSpec2')] },
  } as Record<TournamentType, { icon: string; description: string; matches: string; points: string; specifics: string[] }>), [t]);

  const canSave = name.trim() && (terrainId || manualLocation.city.trim());

  // Status calculation
  const getStatusFromDate = (startDate: Date, end?: Date | null): 'À venir' | 'En cours' | 'Terminé' => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (start > today) return 'À venir';
    if (end) {
      const endD = new Date(end);
      endD.setHours(23, 59, 59, 999);
      if (endD < today) return 'Terminé';
      return 'En cours';
    }
    if (start.getTime() === today.getTime()) return 'En cours';
    return 'Terminé';
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      if (endDate && selectedDate > endDate) setEndDate(null);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) setEndDate(selectedDate);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('common', 'error'), t('tournament', 'errorNameRequired'));
      return;
    }
    if (!terrainId && !manualLocation.city.trim()) {
      Alert.alert(t('common', 'error'), t('tournament', 'errorLocationRequired'));
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
        name: terrain?.name || manualLocation.address.trim() || manualLocation.city.trim(),
        city: terrain?.city || manualLocation.city.trim(),
        latitude: terrain?.location.latitude || manualLocation.latitude,
        longitude: terrain?.location.longitude || manualLocation.longitude,
      },
      terrainId: terrain?.id,
      terrainName: terrain?.name,
      terrainType: terrain?.type,
      clubId,
      clubName: selectedClub?.name,
      status: getStatusFromDate(date, endDate),
      endDate: endDate ? endDate.toISOString() : undefined,
      participants: 0,
      maxParticipants: parseInt(maxParticipants) || 32,
      prize: prize.trim() || undefined,
      description: description.trim() || undefined,
      tournamentLevel,
      tournamentCategory,
      registrationType,
      tournamentScope,
      registrationCost: registrationCost ? parseFloat(registrationCost) : undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('tournament', 'newTournament')}</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Progress */}
      <StepIndicator step={progress.filled} total={progress.total} label={progressLabel} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* =================== ESSENTIEL =================== */}

          {/* Name */}
          <SectionCard title={t('tournament', 'tournamentName')} icon="emoji-events" color={theme.carreauColor} delay={50} required>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t('tournament', 'namePlaceholder')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              autoFocus
            />
          </SectionCard>

          {/* Date */}
          <SectionCard title={t('tournament', 'dates')} subtitle={endDate ? t('tournament', 'multiDay') : t('tournament', 'singleDay')} icon="event" color={theme.primary} delay={100} required>
            <View style={styles.dateRow}>
              <Pressable style={[styles.dateCard, styles.dateCardStart]} onPress={() => setShowDatePicker(true)}>
                <View style={styles.dateCardLabel}>
                  <MaterialIcons name="today" size={14} color={theme.primary} />
                  <Text style={styles.dateCardLabelText}>{t('tournament', 'startLabel')}</Text>
                </View>
                <Text style={styles.dateCardDay}>{date.getDate()}</Text>
                <Text style={styles.dateCardMonth}>
                  {date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: 'numeric' })}
                </Text>
                <Text style={styles.dateCardWeekday}>
                  {date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long' })}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.dateCard, endDate ? styles.dateCardEnd : styles.dateCardAdd]}
                onPress={() => setShowEndDatePicker(true)}
              >
                {endDate ? (
                  <>
                    <View style={styles.dateCardLabel}>
                      <MaterialIcons name="event" size={14} color={theme.accent} />
                      <Text style={[styles.dateCardLabelText, { color: theme.accent }]}>{t('tournament', 'endLabel')}</Text>
                      <Pressable
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={(e) => { e.stopPropagation(); Haptics.selectionAsync(); setEndDate(null); }}
                        style={styles.dateRemoveBtn}
                      >
                        <MaterialIcons name="close" size={12} color={theme.error} />
                      </Pressable>
                    </View>
                    <Text style={[styles.dateCardDay, { color: theme.accent }]}>{endDate.getDate()}</Text>
                    <Text style={styles.dateCardMonth}>
                      {endDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={styles.dateCardWeekday}>
                      {endDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long' })}
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.addEndDateIcon}>
                      <MaterialIcons name="add" size={24} color={theme.textMuted} />
                    </View>
                    <Text style={styles.addEndDateText}>{t('tournament', 'endDate')}</Text>
                    <Text style={styles.addEndDateHint}>{t('tournament', 'multiDays')}</Text>
                  </>
                )}
              </Pressable>
            </View>
            {showDatePicker && (
              <DateTimePicker value={date} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />
            )}
            {showEndDatePicker && (
              <DateTimePicker value={endDate || date} mode="date" display="default" onChange={handleEndDateChange} minimumDate={date} />
            )}
          </SectionCard>

          {/* Format */}
          <SectionCard title={t('tournament', 'gameFormat')} icon="groups" color={theme.accent} delay={150} required>
            <View style={styles.formatGrid}>
              {config.game.formats.map(f => {
                const cfg = FORMAT_CONFIG[f];
                const isActive = format === f;
                return (
                  <Pressable
                    key={f}
                    style={[styles.formatCard, isActive && styles.formatCardActive]}
                    onPress={() => { Haptics.selectionAsync(); setFormat(f); }}
                  >
                    <View style={[styles.formatCardIconBox, isActive && styles.formatCardIconBoxActive]}>
                      <MaterialIcons name={cfg.icon as any} size={22} color={isActive ? '#FFF' : theme.textSecondary} />
                    </View>
                    <Text style={[styles.formatCardName, isActive && styles.formatCardNameActive]}>{t('formats', f)}</Text>
                    <Text style={styles.formatCardMeta}>{cfg.players}</Text>
                    <Text style={styles.formatCardMeta}>{cfg.boules}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* Cadrage */}
          <SectionCard title={t('tournament', 'cadrage')} subtitle={t('tournament', 'competitionType')} icon="account-tree" color={theme.tirColor} delay={200}>
            <View style={styles.cadrageGrid}>
              {config.tournamentTypes.map(ct => {
                const cfg = CADRAGE_CONFIG[ct];
                const cadrageIcon = CADRAGE_ICONS[ct] || 'tune';
                const isActive = type === ct;
                return (
                  <Pressable
                    key={ct}
                    style={[styles.cadrageChip, isActive && styles.cadrageChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setType(ct); }}
                  >
                    <MaterialIcons name={cadrageIcon as any} size={16} color={isActive ? theme.tirColor : theme.textMuted} />
                    <Text style={[styles.cadrageChipText, isActive && styles.cadrageChipTextActive]}>{t('tournamentTypes', ct)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Cadrage Info */}
            {type && CADRAGE_CONFIG[type] && (
              <Animated.View entering={FadeIn.duration(250)} style={styles.cadrageInfo}>
                <View style={styles.cadrageInfoHeader}>
                  <MaterialIcons name="info-outline" size={16} color={theme.tirColor} />
                  <Text style={styles.cadrageInfoTitle}>{CADRAGE_CONFIG[type].description}</Text>
                </View>
                <View style={styles.cadrageInfoStats}>
                  <View style={styles.cadrageInfoStat}>
                    <MaterialIcons name="sports" size={13} color={theme.textMuted} />
                    <Text style={styles.cadrageInfoStatText}>{CADRAGE_CONFIG[type].matches}</Text>
                  </View>
                  <View style={styles.cadrageInfoStat}>
                    <MaterialIcons name="flag" size={13} color={theme.textMuted} />
                    <Text style={styles.cadrageInfoStatText}>{CADRAGE_CONFIG[type].points}</Text>
                  </View>
                </View>
                <View style={styles.cadrageInfoBullets}>
                  {CADRAGE_CONFIG[type].specifics.map((s, i) => (
                    <View key={i} style={styles.cadrageInfoBullet}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </SectionCard>

          {/* =================== LIEU =================== */}

          {/* Terrain */}
          <SectionCard title={t('tournament', 'location')} icon="place" color={theme.success} delay={250} required>
            <View style={styles.terrainHeaderRow}>
              <Text style={styles.fieldHint}>{t('tournament', 'selectTerrainOrAddress')}</Text>
              <Pressable style={styles.addTerrainBtn} onPress={() => router.push('/terrain/new')}>
                <MaterialIcons name="add" size={14} color={theme.primary} />
                <Text style={styles.addTerrainBtnText}>{t('tournament', 'terrainBtn')}</Text>
              </Pressable>
            </View>

            {terrains.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.terrainsScroll}>
                <Pressable
                  style={[styles.terrainOption, !terrainId && styles.terrainOptionActive]}
                  onPress={() => { Haptics.selectionAsync(); setTerrainId(undefined); }}
                >
                  <MaterialIcons name="edit-location" size={20} color={!terrainId ? theme.success : theme.textMuted} />
                  <Text style={[styles.terrainOptionText, !terrainId && styles.terrainOptionTextActive]}>{t('tournament', 'otherLocation')}</Text>
                </Pressable>
                {terrains.map(terrain => {
                  const tc = config.terrainTypes.find(t => t.id === terrain.type);
                  const isActive = terrainId === terrain.id;
                  return (
                    <Pressable
                      key={terrain.id}
                      style={[styles.terrainCardNew, isActive && styles.terrainCardNewActive]}
                      onPress={() => { Haptics.selectionAsync(); setTerrainId(terrain.id); }}
                    >
                      <View style={[styles.terrainCardNewIcon, isActive && styles.terrainCardNewIconActive]}>
                        <MaterialIcons name={(tc?.icon as any) || 'landscape'} size={18} color={isActive ? '#FFF' : theme.textSecondary} />
                      </View>
                      <Text style={[styles.terrainCardNewName, isActive && styles.terrainCardNewNameActive]} numberOfLines={1}>{terrain.name}</Text>
                      <Text style={styles.terrainCardNewCity}>{terrain.city}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.noTerrainsBox}>
                <MaterialIcons name="landscape" size={32} color={theme.textMuted} />
                <Text style={styles.noTerrainsText}>{t('tournament', 'noTerrainsRegistered')}</Text>
                <Pressable style={styles.createTerrainBtn} onPress={() => router.push('/terrain/new')}>
                  <MaterialIcons name="add" size={16} color={theme.primary} />
                  <Text style={styles.createTerrainBtnText}>{t('tournament', 'createTerrain')}</Text>
                </Pressable>
              </View>
            )}

            {!terrainId && (
              <Animated.View entering={FadeInDown.duration(250)} style={{ marginTop: 16 }}>
                <LocationPicker
                  label={t('tournament', 'tournamentLocation')}
                  value={manualLocation}
                  onChange={setManualLocation}
                  placeholder={t('tournament', 'searchAddress')}
                  required
                  showAddressField
                />
              </Animated.View>
            )}

            {selectedTerrain ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.selectedTerrainBanner}>
                <MaterialIcons name="check-circle" size={16} color={theme.success} />
                <Text style={styles.selectedTerrainBannerText}>
                  {selectedTerrain.name} — {selectedTerrain.address}, {selectedTerrain.city}
                </Text>
              </Animated.View>
            ) : null}
          </SectionCard>

          {/* Club */}
          <SectionCard title={t('tournament', 'organizingClub')} icon="home-work" color={theme.primaryLight} delay={300}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              <Pressable
                style={[styles.chipBtn, !clubId && styles.chipBtnActive]}
                onPress={() => { Haptics.selectionAsync(); setClubId(undefined); }}
              >
                <Text style={[styles.chipBtnText, !clubId && styles.chipBtnTextActive]}>{t('tournament', 'none')}</Text>
              </Pressable>
              {clubs.map(club => (
                <Pressable
                  key={club.id}
                  style={[styles.chipBtn, clubId === club.id && styles.chipBtnActive]}
                  onPress={() => { Haptics.selectionAsync(); setClubId(club.id); }}
                >
                  <Text style={[styles.chipBtnText, clubId === club.id && styles.chipBtnTextActive]}>{club.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </SectionCard>

          {/* =================== CLASSIFICATION =================== */}

          {/* Tournament Level */}
          <SectionCard title={t('tournament', 'levelTitle')} subtitle={t('tournament', 'levelSubtitle')} icon="signal-cellular-alt" color={theme.success} delay={350}>
            <View style={styles.levelGrid}>
              {config.tournamentLevels.map(level => {
                const isActive = tournamentLevel === level && !showCustomLevelInput;
                const ico = LEVEL_ICONS[level] || 'star';
                return (
                  <Pressable
                    key={level}
                    style={[styles.levelChip, isActive && styles.levelChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setShowCustomLevelInput(false); setCustomLevel(''); setTournamentLevel(tournamentLevel === level ? undefined : level); }}
                  >
                    <MaterialIcons name={ico as any} size={14} color={isActive ? theme.success : theme.textMuted} />
                    <Text style={[styles.levelChipText, isActive && styles.levelChipTextActive]} numberOfLines={1}>{t('tournamentLevels', level)}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.levelChip, showCustomLevelInput && styles.levelChipActive]}
                onPress={() => { Haptics.selectionAsync(); setShowCustomLevelInput(!showCustomLevelInput); if (!showCustomLevelInput) setTournamentLevel(undefined); }}
              >
                <MaterialIcons name="add" size={14} color={showCustomLevelInput ? theme.success : theme.textMuted} />
                <Text style={[styles.levelChipText, showCustomLevelInput && styles.levelChipTextActive]}>{t('tournament', 'otherLevel')}</Text>
              </Pressable>
            </View>
            {showCustomLevelInput && (
              <Animated.View entering={FadeInDown.duration(250)} style={styles.customInput}>
                <TextInput
                  style={styles.customInputField}
                  value={customLevel}
                  onChangeText={(text) => { setCustomLevel(text); setTournamentLevel(text.trim() || undefined); }}
                  placeholder={t('tournament', 'customLevelPlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  autoFocus
                />
                {customLevel.trim() ? <MaterialIcons name="check-circle" size={18} color={theme.success} /> : null}
              </Animated.View>
            )}
          </SectionCard>

          {/* Tournament Category */}
          <SectionCard title={t('tournament', 'tournamentType')} icon="verified" color={theme.warning} delay={375}>
            <View style={styles.chipGrid}>
              {config.tournamentCategories.map(cat => {
                const isActive = tournamentCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[styles.chipOutline, isActive && styles.chipOutlineActiveWarn]}
                    onPress={() => { Haptics.selectionAsync(); setTournamentCategory(tournamentCategory === cat ? undefined : cat); }}
                  >
                    <Text style={[styles.chipOutlineText, isActive && styles.chipOutlineTextWarn]}>{t('tournamentCategories', cat)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* Registration & Scope in one row */}
          <View style={styles.twoColRow}>
            <SectionCard title={t('tournament', 'registration')} icon="how-to-reg" color={theme.primary} delay={400}>
              <View style={styles.chipGrid}>
                {config.registrationTypes.map(reg => {
                  const isActive = registrationType === reg;
                  return (
                    <Pressable
                      key={reg}
                      style={[styles.chipOutline, isActive && styles.chipOutlineActivePrimary]}
                      onPress={() => { Haptics.selectionAsync(); setRegistrationType(registrationType === reg ? undefined : reg); }}
                    >
                      <Text style={[styles.chipOutlineText, isActive && styles.chipOutlineTextPrimary]}>{t('registrationTypes', reg)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>
          </View>

          <SectionCard title={t('tournament', 'scope')} subtitle={t('tournament', 'scopeSubtitle')} icon="public" color={theme.accent} delay={425}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {config.tournamentScopes.map(scope => {
                const isActive = tournamentScope === scope;
                return (
                  <Pressable
                    key={scope}
                    style={[styles.chipBtn, isActive && styles.chipBtnActiveAccent]}
                    onPress={() => { Haptics.selectionAsync(); setTournamentScope(tournamentScope === scope ? undefined : scope); }}
                  >
                    <Text style={[styles.chipBtnText, isActive && styles.chipBtnTextAccent]}>{t('tournamentScopes', scope)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </SectionCard>

          {/* =================== DÉTAILS =================== */}

          {/* Participants */}
          <SectionCard title={t('tournament', 'maxParticipants')} icon="people-outline" color={theme.carreauColor} delay={450}>
            <View style={styles.participantsRow}>
              {['8', '16', '24', '32', '48', '64', '128'].map(num => {
                const isActive = maxParticipants === num;
                return (
                  <Pressable
                    key={num}
                    style={[styles.participantPill, isActive && styles.participantPillActive]}
                    onPress={() => { Haptics.selectionAsync(); setMaxParticipants(num); }}
                  >
                    <Text style={[styles.participantPillText, isActive && styles.participantPillTextActive]}>{num}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* Financial & Prize */}
          <SectionCard title={t('tournament', 'finances')} subtitle={t('tournament', 'financesSubtitle')} icon="payments" color={theme.carreauColor} delay={475}>
            <View style={styles.financeRow}>
              <View style={styles.financeField}>
                <Text style={styles.financeLabel}>{t('tournament', 'registrationCost')}</Text>
                <TextInput
                  style={styles.financeInput}
                  value={registrationCost}
                  onChangeText={setRegistrationCost}
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.financeField}>
                <Text style={styles.financeLabel}>{t('tournament', 'prize')}</Text>
                <TextInput
                  style={styles.financeInput}
                  value={prize}
                  onChangeText={setPrize}
                  placeholder={t('tournament', 'prizePlaceholder')}
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>
          </SectionCard>

          {/* Description */}
          <SectionCard title={t('tournament', 'description')} subtitle={t('tournament', 'descriptionSubtitle')} icon="description" color={theme.textSecondary} delay={500}>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('tournament', 'descriptionPlaceholder')}
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </SectionCard>

        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [styles.saveButton, !canSave && styles.saveButtonDisabled, pressed && canSave && styles.saveButtonPressed]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <MaterialIcons name="emoji-events" size={22} color="#FFF" />
            <Text style={styles.saveButtonText}>{t('tournament', 'createTournament')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },

  // Progress
  stepIndicator: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  stepBarTrack: { height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  stepBarFill: { height: '100%', backgroundColor: theme.carreauColor, borderRadius: 2 },
  stepLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Section Card
  sectionCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 16, marginBottom: 14, ...theme.shadows.card,
  },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionCardIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionCardTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  sectionCardSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  requiredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.error },

  // Text Input
  textInput: {
    backgroundColor: theme.backgroundSecondary, paddingHorizontal: 14, paddingVertical: 13,
    borderRadius: theme.borderRadius.md, fontSize: 15, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.border,
  },
  textArea: { minHeight: 90, paddingTop: 13 },

  // Date Cards
  dateRow: { flexDirection: 'row', gap: 12 },
  dateCard: {
    flex: 1, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    padding: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  dateCardStart: { borderColor: theme.primary + '40' },
  dateCardEnd: { borderColor: theme.accent + '40' },
  dateCardAdd: { borderStyle: 'dashed' as any, borderColor: theme.textMuted + '40', justifyContent: 'center' },
  dateCardLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6, alignSelf: 'flex-start' },
  dateCardLabelText: { fontSize: 10, fontWeight: '600', color: theme.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateCardDay: { fontSize: 32, fontWeight: '800', color: theme.primary },
  dateCardMonth: { fontSize: 12, color: theme.textSecondary, fontWeight: '500', marginTop: 2, textTransform: 'capitalize' },
  dateCardWeekday: { fontSize: 11, color: theme.textMuted, textTransform: 'capitalize', marginTop: 1 },
  dateRemoveBtn: { marginLeft: 'auto', width: 20, height: 20, borderRadius: 10, backgroundColor: theme.error + '15', alignItems: 'center', justifyContent: 'center' },
  addEndDateIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.textMuted + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  addEndDateText: { fontSize: 12, fontWeight: '600', color: theme.textMuted },
  addEndDateHint: { fontSize: 10, color: theme.textMuted + 'AA', marginTop: 2 },

  // Format Cards
  formatGrid: { flexDirection: 'row', gap: 10 },
  formatCard: {
    flex: 1, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    padding: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  formatCardActive: { borderColor: theme.accent, backgroundColor: theme.accent + '08' },
  formatCardIconBox: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.textMuted + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  formatCardIconBoxActive: { backgroundColor: theme.accent },
  formatCardName: { fontSize: 13, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  formatCardNameActive: { color: theme.accent },
  formatCardMeta: { fontSize: 10, color: theme.textMuted },

  // Cadrage
  cadrageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cadrageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  cadrageChipActive: { borderColor: theme.tirColor, backgroundColor: theme.tirColor + '08' },
  cadrageChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  cadrageChipTextActive: { color: theme.tirColor },
  cadrageInfo: {
    marginTop: 12, padding: 12, backgroundColor: theme.tirColor + '06',
    borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.tirColor + '15',
  },
  cadrageInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cadrageInfoTitle: { fontSize: 13, fontWeight: '600', color: theme.tirColor, flex: 1 },
  cadrageInfoStats: { flexDirection: 'row', gap: 16, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.tirColor + '10' },
  cadrageInfoStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cadrageInfoStatText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  cadrageInfoBullets: { gap: 5 },
  cadrageInfoBullet: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bulletDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.tirColor },
  bulletText: { fontSize: 12, color: theme.textSecondary },

  // Terrain
  terrainHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  fieldHint: { flex: 1, fontSize: 11, color: theme.textMuted },
  addTerrainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: theme.primary + '12', borderRadius: theme.borderRadius.sm,
  },
  addTerrainBtnText: { fontSize: 11, fontWeight: '600', color: theme.primary },
  terrainsScroll: { gap: 10, paddingBottom: 2 },
  terrainOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  terrainOptionActive: { borderColor: theme.success, backgroundColor: theme.success + '08' },
  terrainOptionText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  terrainOptionTextActive: { color: theme.success },
  terrainCardNew: {
    width: 130, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent',
  },
  terrainCardNewActive: { borderColor: theme.success, backgroundColor: theme.success + '08' },
  terrainCardNewIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: theme.textMuted + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  terrainCardNewIconActive: { backgroundColor: theme.success },
  terrainCardNewName: { fontSize: 12, fontWeight: '600', color: theme.textPrimary, textAlign: 'center', marginBottom: 2 },
  terrainCardNewNameActive: { color: theme.success },
  terrainCardNewCity: { fontSize: 10, color: theme.textMuted },
  noTerrainsBox: {
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    padding: 20, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' as any,
  },
  noTerrainsText: { fontSize: 13, color: theme.textMuted },
  createTerrainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.primary + '15', borderRadius: theme.borderRadius.md,
  },
  createTerrainBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  selectedTerrainBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.success + '08',
    borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.success + '20',
  },
  selectedTerrainBannerText: { fontSize: 12, color: theme.success, flex: 1, fontWeight: '500' },

  // Chips (generic)
  chipScroll: { gap: 8 },
  chipBtn: {
    paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.full, borderWidth: 1.5, borderColor: 'transparent',
  },
  chipBtnActive: { borderColor: theme.primary, backgroundColor: theme.primary + '08' },
  chipBtnActiveAccent: { borderColor: theme.accent, backgroundColor: theme.accent + '08' },
  chipBtnText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  chipBtnTextActive: { color: theme.primary },
  chipBtnTextAccent: { color: theme.accent },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipOutline: {
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md, borderWidth: 1.5, borderColor: 'transparent',
  },
  chipOutlineActiveWarn: { borderColor: theme.warning, backgroundColor: theme.warning + '08' },
  chipOutlineActivePrimary: { borderColor: theme.primary, backgroundColor: theme.primary + '08' },
  chipOutlineText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  chipOutlineTextWarn: { color: theme.warning },
  chipOutlineTextPrimary: { color: theme.primary },

  // Level
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md, borderWidth: 1.5, borderColor: 'transparent',
  },
  levelChipActive: { borderColor: theme.success, backgroundColor: theme.success + '08' },
  levelChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  levelChipTextActive: { color: theme.success },
  customInput: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10,
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    borderWidth: 1.5, borderColor: theme.success, paddingRight: 12,
  },
  customInputField: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: theme.textPrimary },

  // Participants
  participantsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  participantPill: {
    minWidth: 44, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.full,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  participantPillActive: { borderColor: theme.carreauColor, backgroundColor: theme.carreauColor + '10' },
  participantPillText: { fontSize: 14, fontWeight: '700', color: theme.textSecondary },
  participantPillTextActive: { color: theme.carreauColor },

  // Finance
  financeRow: { flexDirection: 'row', gap: 12 },
  financeField: { flex: 1 },
  financeLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  financeInput: {
    backgroundColor: theme.backgroundSecondary, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: theme.borderRadius.md, fontSize: 15, color: theme.textPrimary,
    borderWidth: 1, borderColor: theme.border,
  },

  // Two col
  twoColRow: {},

  // Footer
  footer: {
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.carreauColor, paddingVertical: 16, borderRadius: theme.borderRadius.md,
    ...theme.shadows.cardElevated,
  },
  saveButtonDisabled: { backgroundColor: theme.textMuted, opacity: 0.6 },
  saveButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
