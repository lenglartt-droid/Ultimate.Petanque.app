import React, { useState, useEffect, useCallback } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config, { TerrainType } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';
import {
  checkDuplicatePublicTerrains,
  importPublicItemToDirectory,
  PublicTerrain,
} from '@/services/publicItemsService';

export default function NewTerrainScreen() {
  const insets = useSafeAreaInsets();
  const { addTerrain, clubs } = useApp();
  const { t } = useLanguage();
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [type, setType] = useState<TerrainType>('Stabilisé');
  const [description, setDescription] = useState('');
  const [clubId, setClubId] = useState<string | undefined>();
  const [courtsCount, setCourtsCount] = useState('1');
  const [publicAccess, setPublicAccess] = useState(true);
  const [lighting, setLighting] = useState(false);
  const [covered, setCovered] = useState(false);
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor'>('outdoor');
  const [location, setLocation] = useState<LocationData>({
    address: '', city: '', country: 'France', latitude: 0, longitude: 0,
  });

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<(PublicTerrain & { matchType: 'exact' | 'city' })[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Check for duplicates when city changes
  useEffect(() => {
    const trimmedCity = location.city.trim();
    if (trimmedCity.length < 2) {
      setDuplicates([]);
      setDuplicatesDismissed(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      const { duplicates: found } = await checkDuplicatePublicTerrains(trimmedCity, location.address.trim());
      setDuplicates(found);
      setDuplicatesDismissed(false);
      setCheckingDuplicates(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [location.city, location.address]);

  const handleImportDuplicate = useCallback(async (item: PublicTerrain) => {
    setImportingId(item.id);
    Haptics.selectionAsync();
    const { newItemId, error } = await importPublicItemToDirectory('terrains', item.id);
    setImportingId(null);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('common', 'success'), t('map', 'importSuccess'));
      router.back();
    }
  }, [showAlert, t]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common', 'error'), t('terrain', 'errorNameRequired'));
      return;
    }
    if (!location.address.trim()) {
      Alert.alert(t('common', 'error'), t('terrain', 'errorAddressRequired'));
      return;
    }
    if (!location.city.trim()) {
      Alert.alert(t('common', 'error'), t('terrain', 'errorCityRequired'));
      return;
    }
    const selectedClub = clubs.find(c => c.id === clubId);
    await addTerrain({
      name: name.trim(),
      address: location.address.trim(),
      city: location.city.trim(),
      location: { latitude: location.latitude, longitude: location.longitude },
      type,
      description: description.trim() || undefined,
      facilities: [],
      clubId,
      clubName: selectedClub?.name,
      isPublic: false,
      publicAccess,
      courtsCount: parseInt(courtsCount) || 1,
      lighting,
      covered,
      environment,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const showDuplicates = duplicates.length > 0 && !duplicatesDismissed;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('terrain', 'newTerrain')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon Preview */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.iconSection}>
            <View style={styles.terrainIcon}>
              <MaterialIcons name={config.terrainTypes.find(tt => tt.id === type)?.icon as any || 'landscape'} size={48} color="#FFF" />
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'terrainNameRequired')}</Text>
            <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder={t('terrain', 'namePlaceholder')} placeholderTextColor={theme.textMuted} autoCapitalize="words" autoFocus />
          </Animated.View>

          {/* Type */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'terrainTypeRequired')}</Text>
            <View style={styles.typeContainer}>
              {config.terrainTypes.map((tt) => (
                <Pressable key={tt.id} style={[styles.typeCard, type === tt.id && styles.typeCardActive]} onPress={() => { Haptics.selectionAsync(); setType(tt.id); }}>
                  <View style={[styles.typeIconContainer, type === tt.id && styles.typeIconContainerActive]}>
                    <MaterialIcons name={tt.icon as any} size={24} color={type === tt.id ? '#FFF' : theme.textSecondary} />
                  </View>
                  <Text style={[styles.typeName, type === tt.id && styles.typeNameActive]}>{t('terrainTypes', tt.id)}</Text>
                  <Text style={styles.typeDescription} numberOfLines={2}>{t('terrainTypeDescs', tt.id)}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Address - using LocationPicker */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <LocationPicker
              label={t('terrain', 'addressRequired')}
              value={location}
              onChange={setLocation}
              placeholder={t('terrain', 'streetNumber')}
              required
              showAddressField
            />
          </Animated.View>

          {/* Duplicate Detection Banner */}
          {checkingDuplicates ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.duplicateCheckingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.duplicateCheckingText}>{t('map', 'checkingDuplicates')}</Text>
            </Animated.View>
          ) : null}

          {showDuplicates ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.duplicateSection}>
              <View style={styles.duplicateHeader}>
                <View style={styles.duplicateHeaderLeft}>
                  <MaterialIcons name="info" size={20} color={theme.warning} />
                  <Text style={styles.duplicateTitle}>
                    {duplicates.length === 1 ? t('map', 'duplicateFound') : t('map', 'duplicatesFound')}
                  </Text>
                </View>
                <Pressable onPress={() => setDuplicatesDismissed(true)} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={theme.textMuted} />
                </Pressable>
              </View>
              <Text style={styles.duplicateDesc}>{t('map', 'duplicateTerrainDesc')}</Text>

              {duplicates.slice(0, 3).map((dup) => (
                <View key={dup.id} style={styles.duplicateCard}>
                  <View style={styles.duplicateCardTop}>
                    <View style={[styles.duplicateIcon, { backgroundColor: theme.success }]}>
                      <MaterialIcons name="sports-soccer" size={16} color="#FFF" />
                    </View>
                    <View style={styles.duplicateCardInfo}>
                      <Text style={styles.duplicateCardName} numberOfLines={1}>{dup.name}</Text>
                      <Text style={styles.duplicateCardMeta} numberOfLines={1}>
                        {dup.city} {dup.address ? `\u2022 ${dup.address}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.matchBadge, dup.matchType === 'exact' ? styles.matchBadgeExact : styles.matchBadgeCity]}>
                      <Text style={[styles.matchBadgeText, dup.matchType === 'exact' ? styles.matchBadgeTextExact : styles.matchBadgeTextCity]}>
                        {dup.matchType === 'exact' ? t('map', 'exactMatch') : t('map', 'cityMatch')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.duplicateCardDetails}>
                    <View style={styles.duplicateDetailChip}>
                      <MaterialIcons name={config.terrainTypes.find(tt => tt.id === dup.type)?.icon as any || 'landscape'} size={12} color={theme.textSecondary} />
                      <Text style={styles.duplicateDetailText}>{t('terrainTypes', dup.type)}</Text>
                    </View>
                    <View style={styles.duplicateDetailChip}>
                      <Text style={styles.duplicateDetailText}>{dup.courtsCount} {dup.courtsCount > 1 ? t('map', 'courts') : t('map', 'court')}</Text>
                    </View>
                    {dup.lighting ? (
                      <View style={styles.duplicateDetailChip}>
                        <MaterialIcons name="lightbulb" size={12} color={theme.warning} />
                      </View>
                    ) : null}
                    {dup.clubName ? (
                      <View style={styles.duplicateDetailChip}>
                        <MaterialIcons name="home" size={12} color={theme.accent} />
                        <Text style={styles.duplicateDetailText} numberOfLines={1}>{dup.clubName}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.importDuplicateBtn}
                    onPress={() => handleImportDuplicate(dup)}
                    disabled={importingId === dup.id}
                  >
                    {importingId === dup.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="add-circle" size={16} color="#FFF" />
                        <Text style={styles.importDuplicateBtnText}>{t('map', 'importInstead')}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ))}

              <Pressable style={styles.continueCreateBtn} onPress={() => setDuplicatesDismissed(true)}>
                <Text style={styles.continueCreateBtnText}>{t('map', 'continueCreation')}</Text>
                <MaterialIcons name="arrow-forward" size={16} color={theme.textSecondary} />
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Club */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'associatedClub')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubsScroll}>
              <Pressable style={[styles.clubChip, !clubId && styles.clubChipActive]} onPress={() => { Haptics.selectionAsync(); setClubId(undefined); }}>
                <Text style={[styles.clubChipText, !clubId && styles.clubChipTextActive]}>{t('terrain', 'noneLabel')}</Text>
              </Pressable>
              {clubs.map(club => (
                <Pressable key={club.id} style={[styles.clubChip, clubId === club.id && styles.clubChipActive]} onPress={() => { Haptics.selectionAsync(); setClubId(club.id); }}>
                  <Text style={[styles.clubChipText, clubId === club.id && styles.clubChipTextActive]}>{club.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Courts Count */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'courtsCount')}</Text>
            <View style={styles.countsContainer}>
              {['1', '2', '4', '6', '8', '10', '12', '18'].map(num => (
                <Pressable key={num} style={[styles.countChip, courtsCount === num && styles.countChipActive]} onPress={() => { Haptics.selectionAsync(); setCourtsCount(num); }}>
                  <Text style={[styles.countText, courtsCount === num && styles.countTextActive]}>{num}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Features */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'features')}</Text>
            <View style={styles.featuresCard}>
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <MaterialIcons name="public" size={24} color={theme.primary} />
                  <View>
                    <Text style={styles.featureTitle}>{t('terrain', 'publicAccess')}</Text>
                    <Text style={styles.featureDescription}>{t('terrain', 'openToAll')}</Text>
                  </View>
                </View>
                <Switch value={publicAccess} onValueChange={setPublicAccess} trackColor={{ false: theme.border, true: theme.primary + '50' }} thumbColor={publicAccess ? theme.primary : theme.textMuted} />
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <MaterialIcons name="lightbulb" size={24} color={theme.warning} />
                  <View>
                    <Text style={styles.featureTitle}>{t('terrain', 'lighting')}</Text>
                    <Text style={styles.featureDescription}>{t('terrain', 'eveningPlay')}</Text>
                  </View>
                </View>
                <Switch value={lighting} onValueChange={setLighting} trackColor={{ false: theme.border, true: theme.warning + '50' }} thumbColor={lighting ? theme.warning : theme.textMuted} />
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.featureRow}>
                <View style={styles.featureInfo}>
                  <MaterialIcons name="roofing" size={24} color={theme.accent} />
                  <View>
                    <Text style={styles.featureTitle}>{t('terrain', 'covered')}</Text>
                    <Text style={styles.featureDescription}>{t('terrain', 'weatherProtection')}</Text>
                  </View>
                </View>
                <Switch value={covered} onValueChange={setCovered} trackColor={{ false: theme.border, true: theme.accent + '50' }} thumbColor={covered ? theme.accent : theme.textMuted} />
              </View>
            </View>
          </Animated.View>

          {/* Environment */}
          <Animated.View entering={FadeInDown.duration(400).delay(375)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'environment')}</Text>
            <View style={styles.environmentContainer}>
              {config.terrainEnvironments.map((env) => (
                <Pressable key={env.id} style={[styles.environmentCard, environment === env.id && styles.environmentCardActive]} onPress={() => { Haptics.selectionAsync(); setEnvironment(env.id as 'indoor' | 'outdoor'); }}>
                  <View style={[styles.environmentIconContainer, environment === env.id && styles.environmentIconContainerActive]}>
                    <MaterialIcons name={env.icon as any} size={28} color={environment === env.id ? '#FFF' : theme.textSecondary} />
                  </View>
                  <Text style={[styles.environmentName, environment === env.id && styles.environmentNameActive]}>{t('terrainEnv', env.id + 'Label')}</Text>
                  <Text style={styles.environmentDescription}>{t('terrainEnv', env.id + 'Desc')}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'descriptionLabel')}</Text>
            <TextInput style={[styles.textInput, styles.textArea]} value={description} onChangeText={setDescription} placeholder={t('terrain', 'descriptionPlaceholder')} placeholderTextColor={theme.textMuted} multiline numberOfLines={4} textAlignVertical="top" />
          </Animated.View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={[styles.saveButton, (!name.trim() || !location.address.trim() || !location.city.trim()) && styles.saveButtonDisabled]} onPress={handleSave}>
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>{t('terrain', 'createTerrain')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24 },
  iconSection: { alignItems: 'center', marginBottom: 24 },
  terrainIcon: { width: 100, height: 100, borderRadius: 20, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1, marginBottom: 12 },
  textInput: { backgroundColor: theme.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: theme.borderRadius.md, fontSize: 16, color: theme.textPrimary, ...theme.shadows.card },
  textArea: { minHeight: 100, paddingTop: 14 },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { width: '48%', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 14, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', minHeight: 120, ...theme.shadows.card },
  typeCardActive: { borderColor: theme.accent, backgroundColor: theme.accent + '08' },
  typeIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  typeIconContainerActive: { backgroundColor: theme.accent },
  typeName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 4, textAlign: 'center' },
  typeNameActive: { color: theme.accent },
  typeDescription: { fontSize: 11, color: theme.textSecondary, textAlign: 'center', lineHeight: 14 },
  clubsScroll: { gap: 10 },
  clubChip: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card },
  clubChipActive: { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
  clubChipText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  clubChipTextActive: { color: theme.primary },
  countsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  countChip: { minWidth: 50, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card },
  countChipActive: { borderColor: theme.accent, backgroundColor: theme.accent + '10' },
  countText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  countTextActive: { color: theme.accent },
  featuresCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, ...theme.shadows.card },
  featureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featureInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  featureDescription: { fontSize: 12, color: theme.textSecondary },
  featureDivider: { height: 1, backgroundColor: theme.border, marginVertical: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: theme.backgroundSecondary, borderTopWidth: 1, borderTopColor: theme.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.accent, paddingVertical: 18, borderRadius: theme.borderRadius.md },
  saveButtonDisabled: { backgroundColor: theme.textMuted },
  saveButtonText: { fontSize: 17, fontWeight: '600', color: '#FFF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  locationButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '15', borderRadius: theme.borderRadius.sm },
  locationButtonText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  geocodeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 14, borderRadius: theme.borderRadius.md },
  geocodeButtonDisabled: { backgroundColor: theme.textMuted },
  geocodeButtonText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  environmentContainer: { flexDirection: 'row', gap: 12 },
  environmentCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', ...theme.shadows.card },
  environmentCardActive: { borderColor: theme.primary, backgroundColor: theme.primary + '08' },
  environmentIconContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  environmentIconContainerActive: { backgroundColor: theme.primary },
  environmentName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, textAlign: 'center', marginBottom: 4 },
  environmentNameActive: { color: theme.primary },
  environmentDescription: { fontSize: 11, color: theme.textSecondary, textAlign: 'center', lineHeight: 14 },
  locationPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.success + '10', paddingHorizontal: 14, paddingVertical: 12, borderRadius: theme.borderRadius.md, marginTop: 12, borderWidth: 1, borderColor: theme.success + '30' },
  locationPreviewInfo: { flex: 1 },
  locationPreviewTitle: { fontSize: 14, fontWeight: '600', color: theme.success },
  locationPreviewCoords: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  // Duplicate detection styles
  duplicateCheckingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  duplicateCheckingText: { fontSize: 13, color: theme.textMuted },
  duplicateSection: {
    backgroundColor: theme.warning + '08', borderRadius: theme.borderRadius.lg, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: theme.warning + '30',
  },
  duplicateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  duplicateHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  duplicateTitle: { fontSize: 15, fontWeight: '700', color: theme.warning },
  duplicateDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 18, marginBottom: 14 },
  duplicateCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14,
    marginBottom: 10, ...theme.shadows.card,
  },
  duplicateCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  duplicateIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  duplicateCardInfo: { flex: 1, marginRight: 8 },
  duplicateCardName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  duplicateCardMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  matchBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.full },
  matchBadgeExact: { backgroundColor: theme.warning + '20' },
  matchBadgeCity: { backgroundColor: theme.primary + '15' },
  matchBadgeText: { fontSize: 10, fontWeight: '600' },
  matchBadgeTextExact: { color: theme.warning },
  matchBadgeTextCity: { color: theme.primary },
  duplicateCardDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  duplicateDetailChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.sm },
  duplicateDetailText: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  importDuplicateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.primary, paddingVertical: 10, borderRadius: theme.borderRadius.md,
  },
  importDuplicateBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  continueCreateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: 4,
  },
  continueCreateBtnText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
});
