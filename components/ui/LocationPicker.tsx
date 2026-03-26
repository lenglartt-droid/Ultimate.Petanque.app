import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from '@/services/location';
import * as Haptics from '@/services/haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

export interface LocationData {
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

interface LocationPickerProps {
  value?: LocationData;
  onChange: (location: LocationData) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  showAddressField?: boolean;
  showCityOnly?: boolean;
}

interface SearchResult {
  id: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export default function LocationPicker({
  value,
  onChange,
  placeholder,
  label,
  required = false,
  showAddressField = true,
  showCityOnly = false,
}: LocationPickerProps) {
  const { t } = useLanguage();

  const resolvedPlaceholder = placeholder || t('locationPicker', 'searchAddress');
  const resolvedLabel = label !== undefined ? label : t('locationPicker', 'location');

  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);

  // Check location permission on mount
  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    return status === 'granted';
  };

  // Search addresses using geocoding
  const searchAddresses = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Add France as default country for better results
      const searchTerm = query.includes('France') ? query : `${query}, France`;
      const results = await Location.geocodeAsync(searchTerm);

      if (results && results.length > 0) {
        // Reverse geocode each result to get full address
        const detailedResults: SearchResult[] = [];
        
        for (const result of results.slice(0, 5)) {
          try {
            const reverseResults = await Location.reverseGeocodeAsync({
              latitude: result.latitude,
              longitude: result.longitude,
            });

            if (reverseResults && reverseResults.length > 0) {
              const r = reverseResults[0];
              const addressParts = [
                r.streetNumber,
                r.street,
              ].filter(Boolean);
              
              const address = addressParts.join(' ') || r.name || '';
              const city = r.city || r.subregion || r.region || '';
              const country = r.country || 'France';
              
              const formattedAddress = [address, city, country].filter(Boolean).join(', ');

              detailedResults.push({
                id: `${result.latitude}-${result.longitude}`,
                address,
                city,
                country,
                latitude: result.latitude,
                longitude: result.longitude,
                formattedAddress,
              });
            }
          } catch (e) {
            // Skip failed reverse geocode
          }
        }

        setSearchResults(detailedResults);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.log('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (modalVisible && searchQuery.trim()) {
        searchAddresses(searchQuery);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, modalVisible, searchAddresses]);

  // Get current GPS location
  const getCurrentLocation = async () => {
    setIsGeolocating(true);
    
    try {
      // Request permission if not granted
      if (!locationPermission) {
        const granted = await requestLocationPermission();
        if (!granted) {
          Alert.alert(
            t('locationPicker', 'permissionRequired'),
            t('locationPicker', 'permissionMessage')
          );
          setIsGeolocating(false);
          return;
        }
      }

      // Get current position
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get address
      const reverseResults = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseResults && reverseResults.length > 0) {
        const r = reverseResults[0];
        const addressParts = [r.streetNumber, r.street].filter(Boolean);
        const address = addressParts.join(' ') || r.name || '';
        const city = r.city || r.subregion || r.region || '';
        const country = r.country || 'France';
        const formattedAddress = [address, city, country].filter(Boolean).join(', ');

        const newLocation: LocationData = {
          address,
          city,
          country,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          formattedAddress,
        };

        onChange(newLocation);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModalVisible(false);
      } else {
        Alert.alert(t('common', 'error'), t('locationPicker', 'errorAddress'));
      }
    } catch (error) {
      console.log('Geolocation error:', error);
      Alert.alert(t('common', 'error'), t('locationPicker', 'errorPosition'));
    } finally {
      setIsGeolocating(false);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    Haptics.selectionAsync();
    
    const newLocation: LocationData = {
      address: result.address,
      city: result.city,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
      formattedAddress: result.formattedAddress,
    };

    onChange(newLocation);
    
    // Add to recent searches (keep max 5)
    setRecentSearches(prev => {
      const filtered = prev.filter(r => r.id !== result.id);
      return [result, ...filtered].slice(0, 5);
    });

    setModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const openModal = () => {
    Haptics.selectionAsync();
    setModalVisible(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const clearLocation = () => {
    Haptics.selectionAsync();
    onChange({
      address: '',
      city: '',
      country: 'France',
      latitude: 0,
      longitude: 0,
      formattedAddress: '',
    });
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <Pressable
      style={styles.resultItem}
      onPress={() => handleSelectResult(item)}
    >
      <View style={styles.resultIcon}>
        <MaterialIcons name="place" size={22} color={theme.primary} />
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.resultAddress} numberOfLines={1}>
          {item.address || item.city}
        </Text>
        <Text style={styles.resultCity} numberOfLines={1}>
          {item.city}{item.country && item.country !== 'France' ? `, ${item.country}` : ''}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {resolvedLabel ? (
        <Text style={styles.label}>
          {resolvedLabel} {required ? '*' : ''}
        </Text>
      ) : null}

      <Pressable style={styles.inputContainer} onPress={openModal}>
        <MaterialIcons 
          name="place" 
          size={22} 
          color={value?.city ? theme.primary : theme.textMuted} 
        />
        <View style={styles.inputContent}>
          {value?.city || value?.address ? (
            <>
              {showCityOnly ? (
                <Text style={styles.inputValue}>{value.city}</Text>
              ) : (
                <>
                  {showAddressField && value.address ? (
                    <Text style={styles.inputValue}>{value.address}</Text>
                  ) : null}
                  <Text style={[styles.inputCity, !value.address && styles.inputValue]}>
                    {value.city}
                  </Text>
                </>
              )}
            </>
          ) : (
            <Text style={styles.placeholder}>{resolvedPlaceholder}</Text>
          )}
        </View>
        {value?.city ? (
          <Pressable style={styles.clearButton} onPress={clearLocation} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={theme.textMuted} />
          </Pressable>
        ) : (
          <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
        )}
      </Pressable>

      {/* Location confirmed indicator */}
      {value?.latitude !== 0 && value?.longitude !== 0 ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.confirmedBadge}>
          <MaterialIcons name="check-circle" size={14} color={theme.success} />
          <Text style={styles.confirmedText}>{t('locationPicker', 'gpsPositionSaved')}</Text>
        </Animated.View>
      ) : null}

      {/* Search Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalCloseBtn} onPress={closeModal}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>{t('locationPicker', 'searchPlace')}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* GPS Button */}
          <Pressable
            style={styles.gpsButton}
            onPress={getCurrentLocation}
            disabled={isGeolocating}
          >
            {isGeolocating ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <MaterialIcons name="my-location" size={20} color="#FFF" />
            )}
            <Text style={styles.gpsButtonText}>
              {isGeolocating ? t('locationPicker', 'locating') : t('locationPicker', 'useCurrentPosition')}
            </Text>
          </Pressable>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={22} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('locationPicker', 'enterAddress')}
              placeholderTextColor={theme.textMuted}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <MaterialIcons name="close" size={18} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Search Results / Recent / Loading */}
          <View style={styles.resultsContainer}>
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>{t('locationPicker', 'searching')}</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchResult}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.resultsList}
              />
            ) : searchQuery.length >= 3 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="location-off" size={48} color={theme.textMuted} />
                <Text style={styles.emptyText}>{t('locationPicker', 'noResultFound')}</Text>
                <Text style={styles.emptyHint}>{t('locationPicker', 'tryDifferentAddress')}</Text>
              </View>
            ) : (
              <View style={styles.hintsContainer}>
                {/* Recent searches */}
                {recentSearches.length > 0 ? (
                  <Animated.View entering={FadeInDown.duration(300)}>
                    <Text style={styles.hintsSectionTitle}>{t('locationPicker', 'recentSearches')}</Text>
                    {recentSearches.map((result) => (
                      <Pressable
                        key={result.id}
                        style={styles.recentItem}
                        onPress={() => handleSelectResult(result)}
                      >
                        <MaterialIcons name="history" size={20} color={theme.textMuted} />
                        <View style={styles.recentContent}>
                          <Text style={styles.recentAddress}>{result.address || result.city}</Text>
                          <Text style={styles.recentCity}>{result.city}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </Animated.View>
                ) : null}

                {/* Hints */}
                <View style={styles.hintsCard}>
                  <MaterialIcons name="lightbulb" size={20} color={theme.warning} />
                  <View style={styles.hintsContent}>
                    <Text style={styles.hintsTitle}>{t('locationPicker', 'searchTips')}</Text>
                    <Text style={styles.hintsText}>
                      {`\u2022 ${t('locationPicker', 'tipMinChars')}\n\u2022 ${t('locationPicker', 'tipIncludeCity')}\n\u2022 ${t('locationPicker', 'tipExample')}`}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    gap: 12,
    ...theme.shadows.card,
  },
  inputContent: {
    flex: 1,
  },
  inputValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  inputCity: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  placeholder: {
    fontSize: 16,
    color: theme.textMuted,
  },
  clearButton: {
    padding: 4,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.success + '10',
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  confirmedText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.success,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  gpsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.md,
    gap: 10,
    ...theme.shadows.card,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.textPrimary,
  },
  resultsContainer: {
    flex: 1,
    marginTop: 16,
  },
  resultsList: {
    paddingHorizontal: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    marginBottom: 10,
    gap: 12,
    ...theme.shadows.card,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContent: {
    flex: 1,
  },
  resultAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  resultCity: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  hintsContainer: {
    paddingHorizontal: 16,
  },
  hintsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
    gap: 12,
  },
  recentContent: {
    flex: 1,
  },
  recentAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  recentCity: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  hintsCard: {
    flexDirection: 'row',
    backgroundColor: theme.warning + '10',
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.warning + '30',
  },
  hintsContent: {
    flex: 1,
  },
  hintsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.warning,
    marginBottom: 6,
  },
  hintsText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 20,
  },
});
