
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
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import theme from '@/constants/theme';
import config, { TerrainType } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import {
  checkDuplicatePublicTerrainsExcluding,
  fetchPublicTerrainById,
  PublicTerrain,
} from '@/services/publicItemsService';
import MergeComparisonModal, { MergeField } from '@/components/ui/MergeComparisonModal';

export default function EditTerrainScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getTerrainById, updateTerrain, clubs, loading: appLoading } = useApp();
  const { t } = useLanguage();
  const { showAlert } = useAlert();

  const terrain = getTerrainById(id || '');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<TerrainType>('Stabilisé');
  const [description, setDescription] = useState('');
  const [clubId, setClubId] = useState<string | undefined>();
  const [courtsCount, setCourtsCount] = useState('1');
  const [publicAccess, setPublicAccess] = useState(true);
  const [lighting, setLighting] = useState(false);
  const [covered, setCovered] = useState(false);
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor'>('outdoor');
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<(PublicTerrain & { matchType: 'exact' | 'city' })[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareFields, setCompareFields] = useState<MergeField[]>([]);
  const [comparePublicData, setComparePublicData] = useState<any>(null);
  const [comparePublicName, setComparePublicName] = useState('');

  // Load terrain data
  useEffect(() => {
    if (terrain) {
      setName(terrain.name);
      setAddress(terrain.address);
      setCity(terrain.city);
      setType(terrain.type);
      setDescription(terrain.description || '');
      setClubId(terrain.clubId);
      setCourtsCount(String(terrain.courtsCount));
      setPublicAccess(terrain.publicAccess ?? true);
      setLighting(terrain.lighting);
      setCovered(terrain.covered);
      setLatitude(terrain.location.latitude);
      setLongitude(terrain.location.longitude);
      setPhotos(terrain.photos || []);
      setEnvironment(terrain.environment || 'outdoor');
    }
  }, [terrain]);

  // Request location permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  // Check for duplicates when city/address changes
  useEffect(() => {
    const trimmedCity = city.trim();
    if (trimmedCity.length < 2 || !terrain) {
      setDuplicates([]);
      setDuplicatesDismissed(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicates(true);
      const { duplicates: found } = await checkDuplicatePublicTerrainsExcluding(trimmedCity, address.trim(), terrain.id);
      setDuplicates(found);
      setDuplicatesDismissed(false);
      setCheckingDuplicates(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [city, address, terrain?.id]);

  const handleMergeDuplicate = useCallback(async (dup: PublicTerrain) => {
    setMergingId(dup.id);
    Haptics.selectionAsync();
    const { item, error } = await fetchPublicTerrainById(dup.id);
    setMergingId(null);
    if (error || !item) {
      showAlert(t('common', 'error'), error || 'Not found');
      return;
    }
    // Build comparison fields
    const selectedClubName = clubs.find(c => c.id === clubId)?.name || '';
    const fields: MergeField[] = [
      { key: 'name', label: t('modificationLogs', 'name'), myValue: name, publicValue: item.name || '', icon: 'label' },
      { key: 'address', label: t('modificationLogs', 'address'), myValue: address, publicValue: item.address || '', icon: 'place' },
      { key: 'city', label: t('modificationLogs', 'city'), myValue: city, publicValue: item.city || '', icon: 'location-city' },
      { key: 'type', label: t('modificationLogs', 'type'), myValue: t('terrainTypes', type), publicValue: item.type ? t('terrainTypes', item.type) : '', icon: 'landscape' },
      { key: 'description', label: t('modificationLogs', 'description'), myValue: description, publicValue: item.description || '', icon: 'notes' },
      { key: 'courtsCount', label: t('modificationLogs', 'courtsCount'), myValue: courtsCount, publicValue: item.courts_count ? String(item.courts_count) : '', icon: 'grid-view' },
      { key: 'lighting', label: t('modificationLogs', 'lighting'), myValue: String(lighting), publicValue: String(item.lighting ?? false), icon: 'lightbulb' },
      { key: 'covered', label: t('modificationLogs', 'covered'), myValue: String(covered), publicValue: String(item.covered ?? false), icon: 'roofing' },
      { key: 'clubName', label: t('club', 'clubLabel'), myValue: selectedClubName, publicValue: item.club_name || '', icon: 'home' },
      { key: 'location', label: t('modificationLogs', 'location'), myValue: (latitude || longitude) ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : '', publicValue: item.location ? `${(item.location.latitude || 0).toFixed(4)}, ${(item.location.longitude || 0).toFixed(4)}` : '', icon: 'my-location' },
    ];
    setCompareFields(fields);
    setComparePublicData(item);
    setComparePublicName(item.name || dup.name);
    setShowCompareModal(true);
  }, [name, address, city, description, latitude, longitude, courtsCount, clubId, clubs, type, lighting, covered, showAlert, t]);

  const handleApplyMerge = useCallback((selections: Record<string, 'mine' | 'public'>) => {
    if (!comparePublicData) return;
    const pub = comparePublicData;
    if (selections.name === 'public' && pub.name) setName(pub.name);
    if (selections.address === 'public' && pub.address) setAddress(pub.address);
    if (selections.city === 'public' && pub.city) setCity(pub.city);
    if (selections.type === 'public' && pub.type) setType(pub.type);
    if (selections.description === 'public') setDescription(pub.description || '');
    if (selections.courtsCount === 'public' && pub.courts_count) setCourtsCount(String(pub.courts_count));
    if (selections.lighting === 'public') setLighting(pub.lighting ?? false);
    if (selections.covered === 'public') setCovered(pub.covered ?? false);
    if (selections.clubName === 'public' && pub.club_name) {
      const matchedClub = clubs.find(c => c.name === pub.club_name);
      if (matchedClub) setClubId(matchedClub.id);
    }
    if (selections.location === 'public' && pub.location) {
      setLatitude(pub.location.latitude || 0);
      setLongitude(pub.location.longitude || 0);
    }
    setShowCompareModal(false);
    setDuplicatesDismissed(true);
    showAlert(t('common', 'success'), t('map', 'mergeSuccess'));
  }, [comparePublicData, clubs, showAlert, t]);

  // Geocode address when city and address change
  const geocodeAddress = async () => {
    if (!address.trim() || !city.trim()) return;
    
    setIsGeocoding(true);
    try {
      const fullAddress = `${address.trim()}, ${city.trim()}, France`;
      const results = await Location.geocodeAsync(fullAddress);
      
      if (results && results.length > 0) {
        setLatitude(results[0].latitude);
        setLongitude(results[0].longitude);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(t('terrain', 'addressNotFound'), t('terrain', 'addressNotFoundMsg'));
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Get current location
  const getCurrentLocation = async () => {
    if (!locationPermission) {
      Alert.alert(t('terrain', 'permissionRequired'), t('terrain', 'locationPermissionMsg'));
      return;
    }

    setIsGeocoding(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

      // Reverse geocode to get address
      const reverseResults = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseResults && reverseResults.length > 0) {
        const result = reverseResults[0];
        if (result.street) setAddress(`${result.streetNumber || ''} ${result.street}`.trim());
        if (result.city) setCity(result.city);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Alert.alert(t('common', 'error'), t('terrain', 'errorGetPosition'));
    } finally {
      setIsGeocoding(false);
    }
  };

  // Photo picker
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('terrain', 'permissionRequired'), t('terrain', 'galleryPermissionMsg'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - photos.length,
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 5));
      Haptics.selectionAsync();
    }
  };

  // Take photo
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('terrain', 'permissionRequired'), t('terrain', 'cameraPermissionMsg'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri].slice(0, 5));
      Haptics.selectionAsync();
    }
  };

  // Remove photo
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    Haptics.selectionAsync();
  };

  const handleSave = async () => {
    if (!terrain) return;
    
    if (!name.trim()) {
      Alert.alert(t('common', 'error'), t('terrain', 'errorNameRequired'));
      return;
    }
    if (!address.trim()) {
      Alert.alert(t('common', 'error'), t('terrain', 'errorAddressRequired'));
      return;
    }
    if (!city.trim()) {
      Alert.alert(t('common', 'error'), t('terrain', 'errorCityRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const selectedClub = clubs.find(c => c.id === clubId);

      await updateTerrain(terrain.id, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        location: { latitude, longitude },
        type,
        description: description.trim() || undefined,
        clubId,
        clubName: selectedClub?.name,
        publicAccess,
        courtsCount: parseInt(courtsCount) || 1,
        lighting,
        covered,
        environment,
        photos,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(t('common', 'error'), t('terrain', 'errorSave'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!terrain) {
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
            <Text style={styles.emptyText}>{t('terrain', 'terrainNotFound')}</Text>
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
        <Text style={styles.headerTitle}>{t('terrain', 'editTerrain')}</Text>
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
          {/* Photos Section */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'photosLabel')} ({photos.length}/5)</Text>
            <View style={styles.photosContainer}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoItem}>
                  <Image source={{ uri: photo }} style={styles.photoImage} contentFit="cover" />
                  <Pressable 
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <MaterialIcons name="close" size={16} color="#FFF" />
                  </Pressable>
                </View>
              ))}
              {photos.length < 5 && (
                <View style={styles.addPhotoButtons}>
                  <Pressable style={styles.addPhotoButton} onPress={pickImage}>
                    <MaterialIcons name="photo-library" size={24} color={theme.primary} />
                    <Text style={styles.addPhotoText}>{t('terrain', 'gallery')}</Text>
                  </Pressable>
                  <Pressable style={styles.addPhotoButton} onPress={takePhoto}>
                    <MaterialIcons name="camera-alt" size={24} color={theme.primary} />
                    <Text style={styles.addPhotoText}>{t('terrain', 'photo')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'terrainNameRequired')}</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t('terrain', 'namePlaceholder')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
            />
          </Animated.View>

          {/* Type */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'terrainTypeRequired')}</Text>
            <View style={styles.typeContainer}>
              {config.terrainTypes.map((tt) => (
                <Pressable
                  key={tt.id}
                  style={[
                    styles.typeCard,
                    type === tt.id && styles.typeCardActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setType(tt.id);
                  }}
                >
                  <View style={[
                    styles.typeIconContainer,
                    type === tt.id && styles.typeIconContainerActive
                  ]}>
                    <MaterialIcons 
                      name={tt.icon as any} 
                      size={24} 
                      color={type === tt.id ? '#FFF' : theme.textSecondary} 
                    />
                  </View>
                  <Text style={[
                    styles.typeName,
                    type === tt.id && styles.typeNameActive
                  ]}>
                    {t('terrainTypes', tt.id)}
                  </Text>
                  <Text style={styles.typeDescription} numberOfLines={2}>
                    {t('terrainTypeDescs', tt.id)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Address */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('terrain', 'addressRequired')}</Text>
              <Pressable 
                style={styles.locationButton}
                onPress={getCurrentLocation}
                disabled={isGeocoding}
              >
                {isGeocoding ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <MaterialIcons name="my-location" size={16} color={theme.primary} />
                    <Text style={styles.locationButtonText}>{t('terrain', 'myLocation')}</Text>
                  </>
                )}
              </Pressable>
            </View>
            <TextInput
              style={[styles.textInput, { marginBottom: 12 }]}
              value={address}
              onChangeText={setAddress}
              placeholder={t('terrain', 'streetNumber')}
              placeholderTextColor={theme.textMuted}
            />
            <TextInput
              style={[styles.textInput, { marginBottom: 12 }]}
              value={city}
              onChangeText={setCity}
              placeholder={t('terrain', 'cityRequired')}
              placeholderTextColor={theme.textMuted}
            />
            
            {/* Geocode Button */}
            <Pressable 
              style={[
                styles.geocodeButton, 
                (!address.trim() || !city.trim()) && styles.geocodeButtonDisabled
              ]}
              onPress={geocodeAddress}
              disabled={!address.trim() || !city.trim() || isGeocoding}
            >
              {isGeocoding ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="place" size={18} color="#FFF" />
                  <Text style={styles.geocodeButtonText}>{t('terrain', 'geocodeAddress')}</Text>
                </>
              )}
            </Pressable>

            {/* Location Preview */}
            {(latitude !== 0 || longitude !== 0) ? (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.locationPreview}>
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
                <View style={styles.locationPreviewInfo}>
                  <Text style={styles.locationPreviewTitle}>{t('terrain', 'positionSaved')}</Text>
                  <Text style={styles.locationPreviewCoords}>
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </Text>
                </View>
                <Pressable 
                  style={styles.resetLocationBtn}
                  onPress={() => {
                    setLatitude(0);
                    setLongitude(0);
                    Haptics.selectionAsync();
                  }}
                >
                  <MaterialIcons name="close" size={18} color={theme.error} />
                </Pressable>
              </Animated.View>
            ) : null}
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

          {/* Club */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'associatedClub')}</Text>
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
                  {t('terrain', 'noneLabel')}
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
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'courtsCount')}</Text>
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
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
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
                <Switch
                  value={publicAccess}
                  onValueChange={setPublicAccess}
                  trackColor={{ false: theme.border, true: theme.primary + '50' }}
                  thumbColor={publicAccess ? theme.primary : theme.textMuted}
                />
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
                    <Text style={styles.featureTitle}>{t('terrain', 'covered')}</Text>
                    <Text style={styles.featureDescription}>{t('terrain', 'weatherProtection')}</Text>
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

          {/* Environment */}
          <Animated.View entering={FadeInDown.duration(400).delay(325)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'environment')}</Text>
            <View style={styles.environmentContainer}>
              {config.terrainEnvironments.map((env) => (
                <Pressable
                  key={env.id}
                  style={[
                    styles.environmentCard,
                    environment === env.id && styles.environmentCardActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setEnvironment(env.id as 'indoor' | 'outdoor');
                  }}
                >
                  <View style={[
                    styles.environmentIconContainer,
                    environment === env.id && styles.environmentIconContainerActive
                  ]}>
                    <MaterialIcons 
                      name={env.icon as any} 
                      size={28} 
                      color={environment === env.id ? '#FFF' : theme.textSecondary} 
                    />
                  </View>
                  <Text style={[
                    styles.environmentName,
                    environment === env.id && styles.environmentNameActive
                  ]}>
                    {t('terrainEnv', env.id + 'Label')}
                  </Text>
                  <Text style={styles.environmentDescription}>
                    {t('terrainEnv', env.id + 'Desc')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'descriptionLabel')}</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('terrain', 'descriptionPlaceholder')}
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
            style={[
              styles.saveButton, 
              (!name.trim() || !address.trim() || !city.trim() || isSaving) && styles.saveButtonDisabled
            ]} 
            onPress={handleSave}
            disabled={!name.trim() || !address.trim() || !city.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="check" size={24} color="#FFF" />
                <Text style={styles.saveButtonText}>{t('terrain', 'saveChanges')}</Text>
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
  // Photos Section
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '500',
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
  // Section header styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.sm,
  },
  locationButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
  geocodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  geocodeButtonDisabled: {
    backgroundColor: theme.textMuted,
  },
  geocodeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  locationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.success + '10',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.success + '30',
  },
  locationPreviewInfo: {
    flex: 1,
  },
  locationPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.success,
  },
  locationPreviewCoords: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  resetLocationBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Environment styles
  environmentContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  environmentCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    ...theme.shadows.card,
  },
  environmentCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '08',
  },
  environmentIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  environmentIconContainerActive: {
    backgroundColor: theme.primary,
  },
  environmentName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  environmentNameActive: {
    color: theme.primary,
  },
  environmentDescription: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
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
