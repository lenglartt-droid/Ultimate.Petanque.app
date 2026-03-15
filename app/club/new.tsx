import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';
import {
  checkDuplicatePublicClubs,
  importPublicItemToDirectory,
  PublicClub,
} from '@/services/publicItemsService';

const FACILITY_KEYS: { id: string; key: string; icon: string }[] = [
  { id: 'terrains', key: 'facilityOutdoor', icon: 'sports' },
  { id: 'covered', key: 'facilityCovered', icon: 'roofing' },
  { id: 'clubhouse', key: 'facilityClubhouse', icon: 'house' },
  { id: 'bar', key: 'facilityBar', icon: 'local-bar' },
  { id: 'parking', key: 'facilityParking', icon: 'local-parking' },
  { id: 'vestiaires', key: 'facilityChanging', icon: 'checkroom' },
  { id: 'eclairage', key: 'facilityLighting', icon: 'lightbulb' },
  { id: 'ecole', key: 'facilitySchool', icon: 'school' },
];

// ============================================
// SectionCard - Shared visual pattern
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
            {required ? <View style={styles.requiredDot} /> : null}
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

export default function NewClubScreen() {
  const insets = useSafeAreaInsets();
  const { addClub } = useApp();
  const { t } = useLanguage();
  const { showAlert } = useAlert();

  const [name, setName] = useState('');
  const [location, setLocation] = useState<LocationData>({
    address: '',
    city: '',
    country: 'France',
    latitude: 0,
    longitude: 0,
  });
  const [description, setDescription] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [membershipCost, setMembershipCost] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | undefined>();
  const { terrains } = useApp();

  // Progress
  const progress = useMemo(() => {
    let filled = 0; const total = 3;
    if (name.trim()) filled++;
    if (location.city.trim()) filled++;
    filled++; // always 1 bonus
    return { filled, total };
  }, [name, location.city]);
  const progressLabel = useMemo(() => {
    if (!name.trim()) return t('tournament', 'startWithName');
    if (!location.city.trim()) return t('tournament', 'chooseLocation');
    return t('tournament', 'readyToCreate');
  }, [name, location.city, t]);

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<(PublicClub & { matchType: 'exact' | 'city' })[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Check for duplicates when city or name changes
  useEffect(() => {
    const trimmedCity = location.city.trim();
    if (trimmedCity.length < 2) {
      setDuplicates([]);
      setDuplicatesDismissed(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      const { duplicates: found } = await checkDuplicatePublicClubs(trimmedCity, name.trim());
      setDuplicates(found);
      setDuplicatesDismissed(false);
      setCheckingDuplicates(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [location.city, name]);

  const handleImportDuplicate = useCallback(async (item: PublicClub) => {
    setImportingId(item.id);
    Haptics.selectionAsync();
    const { newItemId, error } = await importPublicItemToDirectory('clubs', item.id);
    setImportingId(null);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('common', 'success'), t('map', 'importSuccess'));
      router.back();
    }
  }, [showAlert, t]);

  const toggleFacility = (id: string) => {
    Haptics.selectionAsync();
    setSelectedFacilities(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('common', 'error'), t('club', 'errorNameRequired'));
      return;
    }
    if (!location.city.trim()) {
      Alert.alert(t('common', 'error'), t('club', 'errorCityRequired'));
      return;
    }

    const facilityLabels = selectedFacilities.map(
      id => FACILITY_KEYS.find(f => f.id === id) ? t('club', FACILITY_KEYS.find(f => f.id === id)!.key) : ''
    ).filter(Boolean);

    // If no geolocation but selected terrain has one, use terrain location
    let finalLat = location.latitude;
    let finalLng = location.longitude;
    let finalAddress = location.address.trim();
    let finalCity = location.city.trim();
    if ((!finalLat && !finalLng) && selectedTerrainId) {
      const linkedTerrain = terrains.find(tr => tr.id === selectedTerrainId);
      if (linkedTerrain && (linkedTerrain.location.latitude || linkedTerrain.location.longitude)) {
        finalLat = linkedTerrain.location.latitude;
        finalLng = linkedTerrain.location.longitude;
        if (!finalAddress) finalAddress = linkedTerrain.address || '';
        if (!finalCity) finalCity = linkedTerrain.city || finalCity;
      }
    }

    const selectedTerrain = terrains.find(tr => tr.id === selectedTerrainId);

    addClub({
      name: name.trim(),
      address: finalAddress,
      city: finalCity,
      country: location.country || 'France',
      location: {
        latitude: finalLat,
        longitude: finalLng,
      },
      membersCount: 0,
      foundedYear: parseInt(foundedYear) || new Date().getFullYear(),
      description: description.trim() || null,
      facilities: facilityLabels,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      membershipCost: membershipCost ? parseFloat(membershipCost) : undefined,
      terrainId: selectedTerrainId,
      terrainName: selectedTerrain?.name,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const showDuplicates = duplicates.length > 0 && !duplicatesDismissed;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('club', 'newClub')}</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <StepIndicator step={progress.filled} total={progress.total} label={progressLabel} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon Preview */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.iconSection}>
            <View style={styles.clubIcon}>
              <MaterialIcons name="home" size={48} color="#FFF" />
            </View>
          </Animated.View>

          {/* Name */}
          <SectionCard title={t('club', 'clubNameRequired').replace(' *', '')} icon="home-work" color={theme.accent} delay={50} required>
            <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder={t('club', 'namePlaceholder')} placeholderTextColor={theme.textMuted} autoCapitalize="words" autoFocus />
          </SectionCard>

          {/* Location */}
          <SectionCard title={t('club', 'locationLabel')} icon="place" color={theme.success} delay={100} required>
            <LocationPicker
              label=""
              value={location}
              onChange={setLocation}
              placeholder={t('club', 'searchAddress')}
              required
              showAddressField
            />
          </SectionCard>

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
              <Text style={styles.duplicateDesc}>{t('map', 'duplicateClubDesc')}</Text>

              {duplicates.slice(0, 3).map((dup) => (
                <View key={dup.id} style={styles.duplicateCard}>
                  <View style={styles.duplicateCardTop}>
                    <View style={[styles.duplicateIcon, { backgroundColor: theme.accent }]}>
                      <MaterialIcons name="home" size={16} color="#FFF" />
                    </View>
                    <View style={styles.duplicateCardInfo}>
                      <Text style={styles.duplicateCardName} numberOfLines={1}>{dup.name}</Text>
                      <Text style={styles.duplicateCardMeta} numberOfLines={1}>
                        {dup.city}{dup.country ? `, ${dup.country}` : ''} {dup.address ? `\u2022 ${dup.address}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.matchBadge, dup.matchType === 'exact' ? styles.matchBadgeExact : styles.matchBadgeCity]}>
                      <Text style={[styles.matchBadgeText, dup.matchType === 'exact' ? styles.matchBadgeTextExact : styles.matchBadgeTextCity]}>
                        {dup.matchType === 'exact' ? t('map', 'nameMatch') : t('map', 'cityMatch')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.duplicateCardDetails}>
                    {dup.membersCount > 0 ? (
                      <View style={styles.duplicateDetailChip}>
                        <MaterialIcons name="people" size={12} color={theme.textSecondary} />
                        <Text style={styles.duplicateDetailText}>{dup.membersCount}</Text>
                      </View>
                    ) : null}
                    {dup.foundedYear ? (
                      <View style={styles.duplicateDetailChip}>
                        <Text style={styles.duplicateDetailText}>{t('common', 'since')} {dup.foundedYear}</Text>
                      </View>
                    ) : null}
                    {dup.terrainName ? (
                      <View style={styles.duplicateDetailChip}>
                        <MaterialIcons name="sports-soccer" size={12} color={theme.success} />
                        <Text style={styles.duplicateDetailText} numberOfLines={1}>{dup.terrainName}</Text>
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

          {/* Terrain Association */}
          <SectionCard title={t('club', 'mainTerrainLabel')} icon="sports-soccer" color={theme.primary} delay={200}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.terrainsScroll}
            >
              <Pressable
                style={[styles.terrainChip, !selectedTerrainId && styles.terrainChipActive]}
                onPress={() => { setSelectedTerrainId(undefined); Haptics.selectionAsync(); }}
              >
                <MaterialIcons name="not-listed-location" size={18} color={!selectedTerrainId ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.terrainChipText, !selectedTerrainId && styles.terrainChipTextActive]}>{t('club', 'noneLabel')}</Text>
              </Pressable>
              {terrains.map(terrain => (
                <Pressable
                  key={terrain.id}
                  style={[styles.terrainChip, selectedTerrainId === terrain.id && styles.terrainChipActive]}
                  onPress={() => { setSelectedTerrainId(terrain.id); Haptics.selectionAsync(); }}
                >
                  <MaterialIcons name="sports-soccer" size={18} color={selectedTerrainId === terrain.id ? '#FFF' : theme.textSecondary} />
                  <View>
                    <Text style={[styles.terrainChipText, selectedTerrainId === terrain.id && styles.terrainChipTextActive]} numberOfLines={1}>{terrain.name}</Text>
                    <Text style={[styles.terrainChipSubtext, selectedTerrainId === terrain.id && styles.terrainChipSubtextActive]}>{terrain.city} \u2022 {t('terrainTypes', terrain.type)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </SectionCard>

          {/* Facilities */}
          <SectionCard title={t('club', 'facilitiesLabel')} icon="sports" color={theme.tirColor} delay={250}>
            <View style={styles.facilitiesGrid}>
              {FACILITY_KEYS.map(facility => (
                <Pressable key={facility.id} style={[styles.facilityChip, selectedFacilities.includes(facility.id) && styles.facilityChipActive]} onPress={() => toggleFacility(facility.id)}>
                  <MaterialIcons name={facility.icon as any} size={20} color={selectedFacilities.includes(facility.id) ? theme.accent : theme.textSecondary} />
                  <Text style={[styles.facilityText, selectedFacilities.includes(facility.id) && styles.facilityTextActive]}>{t('club', facility.key)}</Text>
                </Pressable>
              ))}
            </View>
          </SectionCard>

          {/* Membership Cost */}
          <SectionCard title={t('club', 'membershipCostLabel')} icon="payments" color={theme.carreauColor} delay={300}>
            <TextInput style={styles.textInput} value={membershipCost} onChangeText={setMembershipCost} placeholder="Ex: 50" placeholderTextColor={theme.textMuted} keyboardType="numeric" />
          </SectionCard>

          {/* Description */}
          <SectionCard title={t('club', 'descriptionLabel')} icon="description" color={theme.textSecondary} delay={325}>
            <TextInput style={[styles.textInput, styles.textArea]} value={description} onChangeText={setDescription} placeholder={t('club', 'descriptionPlaceholder')} placeholderTextColor={theme.textMuted} multiline numberOfLines={4} textAlignVertical="top" />
          </SectionCard>

          {/* Founded Year */}
          <SectionCard title={t('club', 'foundedYearLabel')} icon="event" color={theme.primaryLight} delay={350}>
            <TextInput style={styles.textInput} value={foundedYear} onChangeText={setFoundedYear} placeholder={t('club', 'foundedYearPlaceholder')} placeholderTextColor={theme.textMuted} keyboardType="number-pad" maxLength={4} />
          </SectionCard>

          {/* Contact */}
          <SectionCard title={t('club', 'contactLabel')} icon="contacts" color={theme.textSecondary} delay={375}>
            <View style={styles.contactInputContainer}>
              <MaterialIcons name="email" size={20} color={theme.textSecondary} />
              <TextInput style={styles.contactInput} value={contactEmail} onChangeText={setContactEmail} placeholder={t('club', 'emailPlaceholder')} placeholderTextColor={theme.textMuted} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={[styles.contactInputContainer, { marginTop: 10 }]}>
              <MaterialIcons name="phone" size={20} color={theme.textSecondary} />
              <TextInput style={styles.contactInput} value={contactPhone} onChangeText={setContactPhone} placeholder={t('club', 'phonePlaceholder')} placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />
            </View>
          </SectionCard>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [styles.saveButton, (!name.trim() || !location.city.trim()) && styles.saveButtonDisabled, pressed && name.trim() && location.city.trim() && styles.saveButtonPressed]}
            onPress={handleSave}
          >
            <MaterialIcons name="home" size={22} color="#FFF" />
            <Text style={styles.saveButtonText}>{t('club', 'createClub')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  stepIndicator: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  stepBarTrack: { height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  stepBarFill: { height: '100%', backgroundColor: theme.accent, borderRadius: 2 },
  stepLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  iconSection: { alignItems: 'center', marginBottom: 14 },
  clubIcon: { width: 96, height: 96, borderRadius: 20, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  // SectionCard
  sectionCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 14, ...theme.shadows.card },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionCardIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionCardTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  sectionCardSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  requiredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.error },
  textInput: { backgroundColor: theme.backgroundSecondary, paddingHorizontal: 14, paddingVertical: 13, borderRadius: theme.borderRadius.md, fontSize: 15, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border },
  textArea: { minHeight: 90, paddingTop: 13 },
  facilitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  facilityChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, borderWidth: 1.5, borderColor: 'transparent' },
  facilityChipActive: { borderColor: theme.accent, backgroundColor: theme.accent + '10' },
  facilityText: { fontSize: 13, fontWeight: '500', color: theme.textSecondary },
  facilityTextActive: { color: theme.accent, fontWeight: '600' },
  contactInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 14, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.border },
  contactInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: theme.textPrimary },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.accent, paddingVertical: 16, borderRadius: theme.borderRadius.md, ...theme.shadows.cardElevated },
  saveButtonDisabled: { backgroundColor: theme.textMuted, opacity: 0.6 },
  saveButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // Terrain association styles
  terrainsScroll: { gap: 10 },
  terrainChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, borderWidth: 1.5, borderColor: 'transparent' },
  terrainChipActive: { borderColor: theme.primary, backgroundColor: theme.primary },
  terrainChipText: { fontSize: 14, fontWeight: '600' as const, color: theme.textSecondary },
  terrainChipTextActive: { color: '#FFF' },
  terrainChipSubtext: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  terrainChipSubtextActive: { color: 'rgba(255,255,255,0.7)' },
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
