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
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';
import {
  checkDuplicatePublicClubsExcluding,
  fetchPublicClubById,
  PublicClub,
} from '@/services/publicItemsService';
import MergeComparisonModal, { MergeField } from '@/components/ui/MergeComparisonModal';

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

export default function EditClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getClubById, updateClub, terrains, loading: appLoading } = useApp();
  const { t } = useLanguage();
  const { showAlert } = useAlert();

  const club = getClubById(id || '');
  const { getTerrainById } = useApp();

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
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [membershipCost, setMembershipCost] = useState('');
  
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | undefined>();
  
  const [isSaving, setIsSaving] = useState(false);

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<(PublicClub & { matchType: 'exact' | 'city' })[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareFields, setCompareFields] = useState<MergeField[]>([]);
  const [comparePublicData, setComparePublicData] = useState<any>(null);
  const [comparePublicName, setComparePublicName] = useState('');

  // Load club data
  useEffect(() => {
    if (club) {
      setName(club.name);
      setLocation({
        address: club.address || '',
        city: club.city || '',
        country: club.country || 'France',
        latitude: club.location?.latitude || 0,
        longitude: club.location?.longitude || 0,
      });
      setDescription(club.description || '');
      setFoundedYear(club.foundedYear ? String(club.foundedYear) : '');
      setContactEmail(club.contactEmail || '');
      setContactPhone(club.contactPhone || '');
      
      // Convert facility labels back to IDs - match against both FR and EN labels
      const facilityIds = FACILITY_KEYS
        .filter(f => club.facilities?.some(label => label === t('club', f.key) || label === f.id))
        .map(f => f.id);
      setSelectedFacilities(facilityIds);
      setSelectedTerrainId(club.terrainId);
      setMembershipCost(club.membershipCost ? String(club.membershipCost) : '');
    }
  }, [club]);

  // Check for duplicates when city/name changes
  useEffect(() => {
    const trimmedCity = location.city.trim();
    if (trimmedCity.length < 2 || !club) {
      setDuplicates([]);
      setDuplicatesDismissed(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      const { duplicates: found } = await checkDuplicatePublicClubsExcluding(trimmedCity, name.trim(), club.id);
      setDuplicates(found);
      setDuplicatesDismissed(false);
      setCheckingDuplicates(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [location.city, name, club?.id]);

  const handleMergeDuplicate = useCallback(async (dup: PublicClub) => {
    setMergingId(dup.id);
    Haptics.selectionAsync();
    const { item, error } = await fetchPublicClubById(dup.id);
    setMergingId(null);
    if (error || !item) {
      showAlert(t('common', 'error'), error || 'Not found');
      return;
    }
    // Build comparison fields
    const facilityLabels = selectedFacilities.map(
      fid => FACILITY_KEYS.find(f => f.id === fid) ? t('club', FACILITY_KEYS.find(f => f.id === fid)!.key) : ''
    ).filter(Boolean).join(', ');
    const pubFacilityLabels = (item.facilities || []).join(', ');

    const fields: MergeField[] = [
      { key: 'name', label: t('modificationLogs', 'name'), myValue: name, publicValue: item.name || '', icon: 'label' },
      { key: 'address', label: t('modificationLogs', 'address'), myValue: location.address, publicValue: item.address || '', icon: 'place' },
      { key: 'city', label: t('modificationLogs', 'city'), myValue: location.city, publicValue: item.city || '', icon: 'location-city' },
      { key: 'country', label: t('directory', 'country'), myValue: location.country || 'France', publicValue: item.country || 'France', icon: 'flag' },
      { key: 'description', label: t('modificationLogs', 'description'), myValue: description, publicValue: item.description || '', icon: 'notes' },
      { key: 'foundedYear', label: t('modificationLogs', 'foundedYear'), myValue: foundedYear, publicValue: item.founded_year ? String(item.founded_year) : '', icon: 'event' },
      { key: 'contactEmail', label: t('modificationLogs', 'contactEmail'), myValue: contactEmail, publicValue: item.contact_email || '', icon: 'email' },
      { key: 'contactPhone', label: t('modificationLogs', 'contactPhone'), myValue: contactPhone, publicValue: item.contact_phone || '', icon: 'phone' },
      { key: 'membershipCost', label: t('modificationLogs', 'membershipCost'), myValue: membershipCost, publicValue: item.membership_cost ? String(item.membership_cost) : '', icon: 'euro' },
      { key: 'facilities', label: t('modificationLogs', 'facilities'), myValue: facilityLabels, publicValue: pubFacilityLabels, icon: 'sports' },
      { key: 'location', label: t('modificationLogs', 'location'), myValue: (location.latitude || location.longitude) ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : '', publicValue: item.location ? `${(item.location.latitude || 0).toFixed(4)}, ${(item.location.longitude || 0).toFixed(4)}` : '', icon: 'my-location' },
    ];
    setCompareFields(fields);
    setComparePublicData(item);
    setComparePublicName(item.name || dup.name);
    setShowCompareModal(true);
  }, [name, location, description, foundedYear, contactEmail, contactPhone, membershipCost, selectedFacilities, showAlert, t]);

  const handleApplyMerge = useCallback((selections: Record<string, 'mine' | 'public'>) => {
    if (!comparePublicData) return;
    const pub = comparePublicData;
    if (selections.name === 'public' && pub.name) setName(pub.name);
    if (selections.address === 'public' && pub.address) setLocation(prev => ({ ...prev, address: pub.address }));
    if (selections.city === 'public' && pub.city) setLocation(prev => ({ ...prev, city: pub.city }));
    if (selections.country === 'public' && pub.country) setLocation(prev => ({ ...prev, country: pub.country }));
    if (selections.description === 'public') setDescription(pub.description || '');
    if (selections.foundedYear === 'public' && pub.founded_year) setFoundedYear(String(pub.founded_year));
    if (selections.contactEmail === 'public') setContactEmail(pub.contact_email || '');
    if (selections.contactPhone === 'public') setContactPhone(pub.contact_phone || '');
    if (selections.membershipCost === 'public' && pub.membership_cost) setMembershipCost(String(pub.membership_cost));
    if (selections.facilities === 'public' && pub.facilities && pub.facilities.length > 0) {
      const facilityIds = FACILITY_KEYS
        .filter(f => pub.facilities.some((label: string) => label === t('club', f.key) || label === f.id))
        .map(f => f.id);
      if (facilityIds.length > 0) setSelectedFacilities(facilityIds);
    }
    if (selections.location === 'public' && pub.location) {
      setLocation(prev => ({
        ...prev,
        latitude: pub.location?.latitude || 0,
        longitude: pub.location?.longitude || 0,
      }));
    }
    setShowCompareModal(false);
    setDuplicatesDismissed(true);
    showAlert(t('common', 'success'), t('map', 'mergeSuccess'));
  }, [comparePublicData, showAlert, t]);

  const toggleFacility = (id: string) => {
    Haptics.selectionAsync();
    setSelectedFacilities(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!club) return;

    if (!name.trim()) {
      Alert.alert(t('common', 'error'), t('club', 'errorNameRequired'));
      return;
    }
    if (!location.city.trim()) {
      Alert.alert(t('common', 'error'), t('club', 'errorCityRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const facilityLabels = selectedFacilities.map(
        id => FACILITY_KEYS.find(f => f.id === id) ? t('club', FACILITY_KEYS.find(f => f.id === id)!.key) : ''
      ).filter(Boolean);

      const selectedTerrain = terrains.find(tr => tr.id === selectedTerrainId);

      // If club has no geolocation but selected terrain does, use terrain location
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

      await updateClub(club.id, {
        name: name.trim(),
        address: finalAddress,
        city: finalCity,
        country: location.country || 'France',
        location: { latitude: finalLat, longitude: finalLng },
        foundedYear: parseInt(foundedYear) || undefined,
        description: description.trim() || undefined,
        facilities: facilityLabels,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        membershipCost: membershipCost ? parseFloat(membershipCost) : undefined,
        terrainId: selectedTerrainId,
        terrainName: selectedTerrain?.name,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(t('common', 'error'), t('club', 'errorSave'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!club) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
        </View>
        {appLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
            <Text style={styles.emptyText}>{t('club', 'clubNotFound')}</Text>
          </View>
        )}
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
        <Text style={styles.headerTitle}>{t('club', 'editClub')}</Text>
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
            <View style={styles.clubIcon}>
              <MaterialIcons name="home" size={48} color="#FFF" />
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'clubNameRequired')}</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t('club', 'namePlaceholder')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
            />
          </Animated.View>

          {/* Location */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
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

          {duplicates.length > 0 && !duplicatesDismissed ? (
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
                    style={styles.mergeDuplicateBtn}
                    onPress={() => handleMergeDuplicate(dup)}
                    disabled={mergingId === dup.id}
                  >
                    {mergingId === dup.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="merge-type" size={16} color="#FFF" />
                        <Text style={styles.mergeDuplicateBtnText}>{t('map', 'mergeWithPublic')}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ))}

              <Pressable style={styles.continueEditBtn} onPress={() => setDuplicatesDismissed(true)}>
                <Text style={styles.continueEditBtnText}>{t('map', 'keepMine')}</Text>
                <MaterialIcons name="arrow-forward" size={16} color={theme.textSecondary} />
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'descriptionLabel')}</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('club', 'descriptionPlaceholder')}
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Founded Year */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'foundedYearLabel')}</Text>
            <TextInput
              style={styles.textInput}
              value={foundedYear}
              onChangeText={setFoundedYear}
              placeholder={t('club', 'foundedYearPlaceholder')}
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </Animated.View>

          {/* Facilities */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'facilitiesLabel')}</Text>
            <View style={styles.facilitiesGrid}>
              {FACILITY_KEYS.map(facility => (
                <Pressable
                  key={facility.id}
                  style={[
                    styles.facilityChip,
                    selectedFacilities.includes(facility.id) && styles.facilityChipActive
                  ]}
                  onPress={() => toggleFacility(facility.id)}
                >
                  <MaterialIcons 
                    name={facility.icon as any} 
                    size={20} 
                    color={selectedFacilities.includes(facility.id) ? theme.accent : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.facilityText,
                    selectedFacilities.includes(facility.id) && styles.facilityTextActive
                  ]}>
                    {t('club', facility.key)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Membership Cost */}
          <Animated.View entering={FadeInDown.duration(400).delay(270)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'membershipCostLabel')}</Text>
            <TextInput
              style={styles.textInput}
              value={membershipCost}
              onChangeText={setMembershipCost}
              placeholder="Ex: 50"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
            />
          </Animated.View>

          {/* Terrain Association */}
          <Animated.View entering={FadeInDown.duration(400).delay(290)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'mainTerrainLabel')}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.terrainsScroll}
            >
              <Pressable
                style={[
                  styles.terrainChip,
                  !selectedTerrainId && styles.terrainChipActive
                ]}
                onPress={() => {
                  setSelectedTerrainId(undefined);
                  Haptics.selectionAsync();
                }}
              >
                <MaterialIcons 
                  name="not-listed-location" 
                  size={18} 
                  color={!selectedTerrainId ? '#FFF' : theme.textSecondary} 
                />
                <Text style={[
                  styles.terrainChipText,
                  !selectedTerrainId && styles.terrainChipTextActive
                ]}>
                  {t('club', 'noneLabel')}
                </Text>
              </Pressable>
              {terrains.map(terrain => (
                <Pressable
                  key={terrain.id}
                  style={[
                    styles.terrainChip,
                    selectedTerrainId === terrain.id && styles.terrainChipActive
                  ]}
                  onPress={() => {
                    setSelectedTerrainId(terrain.id);
                    Haptics.selectionAsync();
                  }}
                >
                  <MaterialIcons 
                    name="sports-soccer" 
                    size={18} 
                    color={selectedTerrainId === terrain.id ? '#FFF' : theme.textSecondary} 
                  />
                  <View>
                    <Text style={[
                      styles.terrainChipText,
                      selectedTerrainId === terrain.id && styles.terrainChipTextActive
                    ]} numberOfLines={1}>
                      {terrain.name}
                    </Text>
                    <Text style={[
                      styles.terrainChipSubtext,
                      selectedTerrainId === terrain.id && styles.terrainChipSubtextActive
                    ]}>
                      {terrain.city} • {t('terrainTypes', terrain.type)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Contact */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'contactLabel')}</Text>
            <View style={styles.contactInputContainer}>
              <MaterialIcons name="email" size={20} color={theme.textSecondary} />
              <TextInput
                style={styles.contactInput}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder={t('club', 'emailPlaceholder')}
                placeholderTextColor={theme.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.contactInputContainer, { marginTop: 12 }]}>
              <MaterialIcons name="phone" size={20} color={theme.textSecondary} />
              <TextInput
                style={styles.contactInput}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder={t('club', 'phonePlaceholder')}
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </Animated.View>
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable 
            style={[
              styles.saveButton, 
              (!name.trim() || !location.city.trim() || isSaving) && styles.saveButtonDisabled
            ]} 
            onPress={handleSave}
            disabled={!name.trim() || !location.city.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="check" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>{t('club', 'saveChanges')}</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {/* Merge Comparison Modal */}
      <MergeComparisonModal
        visible={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        onApply={handleApplyMerge}
        fields={compareFields}
        myLabel={t('map', 'myData')}
        publicLabel={t('map', 'publicData')}
        publicItemName={comparePublicName}
        t={t}
      />
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textMuted,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  clubIcon: {
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
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  facilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  facilityChipActive: {
    borderColor: theme.accent,
    backgroundColor: theme.accent + '10',
  },
  facilityText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  facilityTextActive: {
    color: theme.accent,
    fontWeight: '600',
  },
  contactInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  contactInput: {
    flex: 1,
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
  terrainsScroll: {
    gap: 10,
  },
  terrainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  terrainChipActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary,
  },
  terrainChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  terrainChipTextActive: {
    color: '#FFF',
  },
  terrainChipSubtext: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  terrainChipSubtextActive: {
    color: 'rgba(255,255,255,0.7)',
  },
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
  mergeDuplicateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: theme.accent, paddingVertical: 10, borderRadius: theme.borderRadius.md,
  },
  mergeDuplicateBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  continueEditBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, marginTop: 4,
  },
  continueEditBtnText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
});
