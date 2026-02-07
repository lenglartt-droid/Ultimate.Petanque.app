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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';

const facilities = [
  { id: 'terrains', label: 'Terrains extérieurs', icon: 'sports' },
  { id: 'covered', label: 'Terrain couvert', icon: 'roofing' },
  { id: 'clubhouse', label: 'Club house', icon: 'house' },
  { id: 'bar', label: 'Bar / Restaurant', icon: 'local-bar' },
  { id: 'parking', label: 'Parking', icon: 'local-parking' },
  { id: 'vestiaires', label: 'Vestiaires', icon: 'checkroom' },
  { id: 'eclairage', label: 'Éclairage nocturne', icon: 'lightbulb' },
  { id: 'ecole', label: 'École de pétanque', icon: 'school' },
] as const;

export default function EditClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getClubById, updateClub, terrains } = useApp();

  const club = getClubById(id || '');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | undefined>();
  const [country, setCountry] = useState('France');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  // Load club data
  useEffect(() => {
    if (club) {
      setName(club.name);
      setAddress(club.address);
      setCity(club.city);
      setDescription(club.description || '');
      setFoundedYear(club.foundedYear ? String(club.foundedYear) : '');
      setContactEmail(club.contactEmail || '');
      setContactPhone(club.contactPhone || '');
      setLatitude(club.location?.latitude || 0);
      setLongitude(club.location?.longitude || 0);
      
      // Convert facility labels back to IDs
      const facilityIds = facilities
        .filter(f => club.facilities?.includes(f.label))
        .map(f => f.id);
      setSelectedFacilities(facilityIds);
      setSelectedTerrainId(club.terrainId);
      setCountry(club.country || 'France');
    }
  }, [club]);

  // Request location permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  const toggleFacility = (id: string) => {
    Haptics.selectionAsync();
    setSelectedFacilities(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  // Geocode address
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
        Alert.alert('Adresse non trouvée', 'Impossible de géolocaliser cette adresse.');
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
      Alert.alert('Permission requise', "Autorisez l'accès à la localisation.");
      return;
    }

    setIsGeocoding(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

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
      Alert.alert('Erreur', 'Impossible de récupérer votre position.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!club) return;

    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du club est obligatoire');
      return;
    }
    if (!city.trim()) {
      Alert.alert('Erreur', 'La ville est obligatoire');
      return;
    }

    setIsSaving(true);
    try {
      const facilityLabels = selectedFacilities.map(
        id => facilities.find(f => f.id === id)?.label || ''
      ).filter(Boolean);

      const selectedTerrain = terrains.find(t => t.id === selectedTerrainId);

      await updateClub(club.id, {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim() || 'France',
        location: { latitude, longitude },
        foundedYear: parseInt(foundedYear) || undefined,
        description: description.trim() || undefined,
        facilities: facilityLabels,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        terrainId: selectedTerrainId,
        terrainName: selectedTerrain?.name,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications');
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
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
          <Text style={styles.emptyText}>Club non trouvé</Text>
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
        <Text style={styles.headerTitle}>Modifier le club</Text>
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
            <Text style={styles.sectionTitle}>NOM DU CLUB *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Ex: La Boule Lyonnaise"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
            />
          </Animated.View>

          {/* Location */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>LOCALISATION *</Text>
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
              placeholder="Adresse"
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
              </Animated.View>
            )}
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>DESCRIPTION</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Décrivez votre club..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Founded Year */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>ANNÉE DE CRÉATION</Text>
            <TextInput
              style={styles.textInput}
              value={foundedYear}
              onChangeText={setFoundedYear}
              placeholder="Ex: 1985"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={4}
            />
          </Animated.View>

          {/* Facilities */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>ÉQUIPEMENTS</Text>
            <View style={styles.facilitiesGrid}>
              {facilities.map(facility => (
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
                    {facility.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Country */}
          <Animated.View entering={FadeInDown.duration(400).delay(275)} style={styles.section}>
            <Text style={styles.sectionTitle}>PAYS</Text>
            <TextInput
              style={styles.textInput}
              value={country}
              onChangeText={setCountry}
              placeholder="Ex: France, Belgique, Suisse..."
              placeholderTextColor={theme.textMuted}
            />
          </Animated.View>

          {/* Terrain Association */}
          <Animated.View entering={FadeInDown.duration(400).delay(290)} style={styles.section}>
            <Text style={styles.sectionTitle}>TERRAIN PRINCIPAL</Text>
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
                  Aucun
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
                      {terrain.city} • {terrain.type}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Contact */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>CONTACT</Text>
            <View style={styles.contactInputContainer}>
              <MaterialIcons name="email" size={20} color={theme.textSecondary} />
              <TextInput
                style={styles.contactInput}
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="Email"
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
                placeholder="Téléphone"
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
              (!name.trim() || !city.trim() || isSaving) && styles.saveButtonDisabled
            ]} 
            onPress={handleSave}
            disabled={!name.trim() || !city.trim() || isSaving}
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
