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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import theme from '@/constants/theme';
import config, { TerrainType } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

export default function EditTerrainScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getTerrainById, updateTerrain, clubs } = useApp();

  const terrain = getTerrainById(id || '');

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
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      setIsPublic(terrain.isPublic);
      setLighting(terrain.lighting);
      setCovered(terrain.covered);
      setLatitude(terrain.location.latitude);
      setLongitude(terrain.location.longitude);
      setPhotos(terrain.photos || []);
    }
  }, [terrain]);

  // Request location permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

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
        Alert.alert('Adresse non trouvée', 'Impossible de géolocaliser cette adresse. Vérifiez les informations saisies.');
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
      Alert.alert('Permission requise', "Autorisez l'accès à la localisation pour utiliser cette fonctionnalité.");
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
      Alert.alert('Erreur', 'Impossible de récupérer votre position actuelle.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Photo picker
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "L'accès à la galerie est nécessaire pour ajouter des photos.");
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
      Alert.alert('Permission requise', "L'accès à la caméra est nécessaire pour prendre des photos.");
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
        isPublic,
        courtsCount: parseInt(courtsCount) || 1,
        lighting,
        covered,
        photos,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications');
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
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
          <Text style={styles.emptyText}>Terrain non trouvé</Text>
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
        <Text style={styles.headerTitle}>Modifier le terrain</Text>
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
            <Text style={styles.sectionTitle}>PHOTOS ({photos.length}/5)</Text>
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
                    <Text style={styles.addPhotoText}>Galerie</Text>
                  </Pressable>
                  <Pressable style={styles.addPhotoButton} onPress={takePhoto}>
                    <MaterialIcons name="camera-alt" size={24} color={theme.primary} />
                    <Text style={styles.addPhotoText}>Photo</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
            <Text style={styles.sectionTitle}>NOM DU TERRAIN *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Boulodrome Municipal"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
            />
          </Animated.View>

          {/* Type */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>TYPE DE TERRAIN *</Text>
            <View style={styles.typeContainer}>
              {config.terrainTypes.map((t) => (
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
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ADRESSE *</Text>
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
                    <Text style={styles.locationButtonText}>Ma position</Text>
                  </>
                )}
              </Pressable>
            </View>
            <TextInput
              style={[styles.textInput, { marginBottom: 12 }]}
              value={address}
              onChangeText={setAddress}
              placeholder="Numéro et rue"
              placeholderTextColor={theme.textMuted}
            />
            <TextInput
              style={[styles.textInput, { marginBottom: 12 }]}
              value={city}
              onChangeText={setCity}
              placeholder="Ville *"
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
                  <Text style={styles.geocodeButtonText}>Géolocaliser cette adresse</Text>
                </>
              )}
            </Pressable>

            {/* Location Preview */}
            {(latitude !== 0 || longitude !== 0) && (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.locationPreview}>
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
                <View style={styles.locationPreviewInfo}>
                  <Text style={styles.locationPreviewTitle}>Position enregistrée</Text>
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
            )}
          </Animated.View>

          {/* Club */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
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
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
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
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
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
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
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
                <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
              </>
            )}
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
});
