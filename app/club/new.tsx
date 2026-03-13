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

    addClub({
      name: name.trim(),
      address: location.address.trim(),
      city: location.city.trim(),
      country: location.country || 'France',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      membersCount: 0,
      foundedYear: parseInt(foundedYear) || new Date().getFullYear(),
      description: description.trim(),
      facilities: facilityLabels,
      contactEmail: contactEmail.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      membershipCost: membershipCost ? parseFloat(membershipCost) : undefined,
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
        <Text style={styles.headerTitle}>{t('club', 'newClub')}</Text>
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
            <View style={styles.clubIcon}>
              <MaterialIcons name="home" size={48} color="#FFF" />
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'clubNameRequired')}</Text>
            <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder={t('club', 'namePlaceholder')} placeholderTextColor={theme.textMuted} autoCapitalize="words" autoFocus />
          </Animated.View>

          {/* Location */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <LocationPicker
              label={t('club', 'locationLabel')}
              value={location}
              onChange={setLocation}
              placeholder={t('club', 'searchAddress')}
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

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'descriptionLabel')}</Text>
            <TextInput style={[styles.textInput, styles.textArea]} value={description} onChangeText={setDescription} placeholder={t('club', 'descriptionPlaceholder')} placeholderTextColor={theme.textMuted} multiline numberOfLines={4} textAlignVertical="top" />
          </Animated.View>

          {/* Founded Year */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'foundedYearLabel')}</Text>
            <TextInput style={styles.textInput} value={foundedYear} onChangeText={setFoundedYear} placeholder={t('club', 'foundedYearPlaceholder')} placeholderTextColor={theme.textMuted} keyboardType="number-pad" maxLength={4} />
          </Animated.View>

          {/* Facilities */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'facilitiesLabel')}</Text>
            <View style={styles.facilitiesGrid}>
              {FACILITY_KEYS.map(facility => (
                <Pressable key={facility.id} style={[styles.facilityChip, selectedFacilities.includes(facility.id) && styles.facilityChipActive]} onPress={() => toggleFacility(facility.id)}>
                  <MaterialIcons name={facility.icon as any} size={20} color={selectedFacilities.includes(facility.id) ? theme.accent : theme.textSecondary} />
                  <Text style={[styles.facilityText, selectedFacilities.includes(facility.id) && styles.facilityTextActive]}>{t('club', facility.key)}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Membership Cost */}
          <Animated.View entering={FadeInDown.duration(400).delay(325)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'membershipCostLabel')}</Text>
            <TextInput style={styles.textInput} value={membershipCost} onChangeText={setMembershipCost} placeholder="Ex: 50" placeholderTextColor={theme.textMuted} keyboardType="numeric" />
          </Animated.View>

          {/* Contact */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'contactLabel')}</Text>
            <View style={styles.contactInputContainer}>
              <MaterialIcons name="email" size={20} color={theme.textSecondary} />
              <TextInput style={styles.contactInput} value={contactEmail} onChangeText={setContactEmail} placeholder={t('club', 'emailPlaceholder')} placeholderTextColor={theme.textMuted} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={[styles.contactInputContainer, { marginTop: 12 }]}>
              <MaterialIcons name="phone" size={20} color={theme.textSecondary} />
              <TextInput style={styles.contactInput} value={contactPhone} onChangeText={setContactPhone} placeholder={t('club', 'phonePlaceholder')} placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />
            </View>
          </Animated.View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={[styles.saveButton, (!name.trim() || !location.city.trim()) && styles.saveButtonDisabled]} onPress={handleSave}>
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>{t('club', 'createClub')}</Text>
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
  clubIcon: { width: 100, height: 100, borderRadius: 20, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1, marginBottom: 12 },
  textInput: { backgroundColor: theme.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: theme.borderRadius.md, fontSize: 16, color: theme.textPrimary, ...theme.shadows.card },
  textArea: { minHeight: 100, paddingTop: 14 },
  facilitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  facilityChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card },
  facilityChipActive: { borderColor: theme.accent, backgroundColor: theme.accent + '10' },
  facilityText: { fontSize: 13, fontWeight: '500', color: theme.textSecondary },
  facilityTextActive: { color: theme.accent, fontWeight: '600' },
  contactInputContainer: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: theme.borderRadius.md, ...theme.shadows.card },
  contactInput: { flex: 1, fontSize: 16, color: theme.textPrimary },
  footer: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: theme.backgroundSecondary, borderTopWidth: 1, borderTopColor: theme.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.accent, paddingVertical: 18, borderRadius: theme.borderRadius.md },
  saveButtonDisabled: { backgroundColor: theme.textMuted },
  saveButtonText: { fontSize: 17, fontWeight: '600', color: '#FFF' },
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
