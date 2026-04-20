import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from '@/services/location';
import * as Haptics from '@/services/haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';

const RECENT_SEARCHES_KEY = '@location_picker_recent_searches';
const MAX_RECENT = 8;

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

// ============================================
// Nominatim (OpenStreetMap) geocoding
// ============================================
async function searchNominatim(query: string): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&addressdetails=1&limit=8&accept-language=fr,en`,
      {
        headers: {
          'User-Agent': 'UltimatePetanque/1.0',
          'Accept': 'application/json',
        },
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const addr = item.address || {};
      const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || '';
      const country = addr.country || '';
      const displayParts = [street, city, country].filter(Boolean);

      return {
        id: `${item.place_id}`,
        address: street || item.name || '',
        city,
        country,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        formattedAddress: displayParts.join(', ') || item.display_name || '',
      };
    }).filter((r: SearchResult) => !isNaN(r.latitude) && !isNaN(r.longitude));
  } catch (e) {
    console.log('[Nominatim] Search error:', e);
    return [];
  }
}

// City-specific search using Nominatim featuretype filter
async function searchCitiesNominatim(query: string): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&addressdetails=1&limit=10&featuretype=settlement&accept-language=fr,en`,
      {
        headers: {
          'User-Agent': 'UltimatePetanque/1.0',
          'Accept': 'application/json',
        },
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((item: any) => {
        const addr = item.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || item.name || '';
        const state = addr.state || addr.region || '';
        const country = addr.country || '';
        const displayParts = [city, state, country].filter(Boolean);

        return {
          id: `city-${item.place_id}`,
          address: '',
          city,
          country,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          formattedAddress: displayParts.join(', ') || item.display_name || '',
        };
      })
      .filter((r: SearchResult) => !isNaN(r.latitude) && !isNaN(r.longitude) && r.city);
  } catch (e) {
    console.log('[Nominatim] City search error:', e);
    return [];
  }
}

// Postal code search using Nominatim postalcode parameter
async function searchByPostalCode(postalCode: string, countryCode?: string): Promise<SearchResult[]> {
  try {
    // Build query with postalcode parameter for precise results
    const params = new URLSearchParams({
      postalcode: postalCode.trim(),
      format: 'json',
      addressdetails: '1',
      limit: '10',
      'accept-language': 'fr,en',
    });
    // Add country code bias if provided (e.g. 'fr' for France)
    if (countryCode) {
      params.set('countrycodes', countryCode);
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'UltimatePetanque/1.0',
          'Accept': 'application/json',
        },
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((item: any) => {
        const addr = item.address || {};
        const postcode = addr.postcode || postalCode;
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || '';
        const state = addr.state || addr.region || '';
        const country = addr.country || '';
        const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
        const displayParts = [postcode, city, state, country].filter(Boolean);

        return {
          id: `postal-${item.place_id}`,
          address: street || '',
          city,
          country,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          formattedAddress: displayParts.join(', ') || item.display_name || '',
        };
      })
      .filter((r: SearchResult) => !isNaN(r.latitude) && !isNaN(r.longitude) && r.city);
  } catch (e) {
    console.log('[Nominatim] Postal code search error:', e);
    return [];
  }
}

// Detect if a query looks like a postal code (digits only, 3-10 chars)
function isPostalCodeQuery(query: string): boolean {
  const trimmed = query.trim();
  // Pure digits: 75001, 13000, 8000, etc.
  if (/^\d{3,10}$/.test(trimmed)) return true;
  // Common formats: UK (SW1A 1AA), Canada (K1A 0B1), etc.
  if (/^[A-Z0-9]{2,4}\s?[A-Z0-9]{2,4}$/i.test(trimmed) && /\d/.test(trimmed)) return true;
  return false;
}

// Generate static map URL from OpenStreetMap
function getStaticMapUrl(lat: number, lng: number, zoom: number = 14, width: number = 600, height: number = 200): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&maptype=mapnik&markers=${lat},${lng},red-pushpin`;
}

async function reverseNominatim(lat: number, lng: number): Promise<SearchResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=fr,en`,
      {
        headers: {
          'User-Agent': 'UltimatePetanque/1.0',
          'Accept': 'application/json',
        },
      }
    );
    if (!response.ok) return null;
    const item = await response.json();
    if (!item || item.error) return null;

    const addr = item.address || {};
    const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || '';
    const country = addr.country || '';

    return {
      id: `${item.place_id || Date.now()}`,
      address: street || '',
      city,
      country,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      formattedAddress: [street, city, country].filter(Boolean).join(', '),
    };
  } catch (e) {
    console.log('[Nominatim] Reverse error:', e);
    return null;
  }
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
  const recentLoadedRef = useRef(false);

  // Manual GPS state
  const [showManualGps, setShowManualGps] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [isApplyingManual, setIsApplyingManual] = useState(false);

  // Debounce ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check location permission on mount
  useEffect(() => {
    checkLocationPermission();
  }, []);

  // Load recent searches from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then(raw => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setRecentSearches(parsed.slice(0, MAX_RECENT));
            }
          } catch { /* ignore */ }
        }
        recentLoadedRef.current = true;
      })
      .catch(() => { recentLoadedRef.current = true; });
  }, []);

  // Persist recent searches to AsyncStorage when they change
  useEffect(() => {
    if (!recentLoadedRef.current) return; // Skip initial load
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches)).catch(() => {});
  }, [recentSearches]);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');
    return status === 'granted';
  };

  // Search addresses using Nominatim (OSM) with Expo geocoding fallback
  const searchAddresses = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Postal code detection: auto-route to postal code search
      if (isPostalCodeQuery(query)) {
        const postalResults = await searchByPostalCode(query);
        if (postalResults.length > 0) {
          // Deduplicate by city+country
          const seen = new Set<string>();
          const unique = postalResults.filter(r => {
            const key = `${r.city.toLowerCase()}-${r.country.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setSearchResults(unique);
          return;
        }
        // If no postal results, fall through to normal search
      }

      // City-only mode: use settlement-filtered Nominatim search
      if (showCityOnly) {
        const cityResults = await searchCitiesNominatim(query);
        if (cityResults.length > 0) {
          // Deduplicate by city+country
          const seen = new Set<string>();
          const unique = cityResults.filter(r => {
            const key = `${r.city.toLowerCase()}-${r.country.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setSearchResults(unique);
        } else {
          // Fallback to general search filtered for cities
          const generalResults = await searchNominatim(query);
          const cityFiltered = generalResults.filter(r => r.city);
          setSearchResults(cityFiltered.length > 0 ? cityFiltered : generalResults);
        }
        return;
      }

      // Primary: Nominatim (OpenStreetMap)
      const nominatimResults = await searchNominatim(query);

      if (nominatimResults.length > 0) {
        setSearchResults(nominatimResults);
        return;
      }

      // Fallback: Expo Location geocoding
      const searchTerm = query.includes('France') ? query : `${query}, France`;
      const results = await Location.geocodeAsync(searchTerm);

      if (results && results.length > 0) {
        const detailedResults: SearchResult[] = [];

        for (const result of results.slice(0, 5)) {
          try {
            const reverseResults = await Location.reverseGeocodeAsync({
              latitude: result.latitude,
              longitude: result.longitude,
            });

            if (reverseResults && reverseResults.length > 0) {
              const r = reverseResults[0];
              const addressParts = [r.streetNumber, r.street].filter(Boolean);
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
  }, [showCityOnly]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      if (modalVisible && searchQuery.trim()) {
        searchAddresses(searchQuery);
      }
    }, 400);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, modalVisible, searchAddresses]);

  // Get current GPS location
  const getCurrentLocation = async () => {
    setIsGeolocating(true);

    try {
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

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Use Nominatim reverse geocoding for better results
      const nominatimResult = await reverseNominatim(
        location.coords.latitude,
        location.coords.longitude
      );

      if (nominatimResult) {
        const newLocation: LocationData = {
          address: nominatimResult.address,
          city: nominatimResult.city,
          country: nominatimResult.country || 'France',
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          formattedAddress: nominatimResult.formattedAddress,
        };

        onChange(newLocation);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModalVisible(false);
        return;
      }

      // Fallback to Expo reverse geocoding
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

  // Apply manual GPS coordinates
  const handleApplyManualGps = async () => {
    const lat = parseFloat(manualLat.replace(',', '.'));
    const lng = parseFloat(manualLng.replace(',', '.'));

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert(
        t('locationPicker', 'invalidCoordinates'),
        `${t('locationPicker', 'latRange')}\n${t('locationPicker', 'lngRange')}`
      );
      return;
    }

    setIsApplyingManual(true);
    Keyboard.dismiss();

    try {
      // Reverse geocode to get address from coordinates
      const nominatimResult = await reverseNominatim(lat, lng);

      const newLocation: LocationData = {
        address: nominatimResult?.address || '',
        city: nominatimResult?.city || '',
        country: nominatimResult?.country || 'France',
        latitude: lat,
        longitude: lng,
        formattedAddress: nominatimResult?.formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      };

      onChange(newLocation);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      setManualLat('');
      setManualLng('');
      setShowManualGps(false);
    } catch (error) {
      console.log('Manual GPS error:', error);
      // Still apply even if reverse geocoding fails
      onChange({
        address: '',
        city: '',
        country: 'France',
        latitude: lat,
        longitude: lng,
        formattedAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      setManualLat('');
      setManualLng('');
      setShowManualGps(false);
    } finally {
      setIsApplyingManual(false);
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

    // Add to recent searches (keep max)
    setRecentSearches(prev => {
      const filtered = prev.filter(r => r.id !== result.id);
      return [result, ...filtered].slice(0, MAX_RECENT);
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
    setShowManualGps(false);
    setManualLat('');
    setManualLng('');
  };

  const closeModal = () => {
    setModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    setShowManualGps(false);
    setManualLat('');
    setManualLng('');
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
          {item.formattedAddress || `${item.city}${item.country && item.country !== 'France' ? `, ${item.country}` : ''}`}
        </Text>
        {item.latitude ? (
          <Text style={styles.resultCoords}>
            {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
          </Text>
        ) : null}
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
          <Text style={styles.confirmedCoords}>
            {value?.latitude?.toFixed(5)}, {value?.longitude?.toFixed(5)}
          </Text>
        </Animated.View>
      ) : null}

      {/* Miniature Map Preview */}
      {value?.latitude && value?.longitude && value.latitude !== 0 && value.longitude !== 0 ? (
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.miniMapContainer}>
          <Image
            source={{ uri: getStaticMapUrl(value.latitude, value.longitude) }}
            style={styles.miniMapImage}
            contentFit="cover"
            transition={300}
            placeholder={undefined}
          />
          <View style={styles.miniMapOverlay}>
            <View style={styles.miniMapPin}>
              <MaterialIcons name="place" size={16} color="#FFF" />
            </View>
            <View style={styles.miniMapLabel}>
              <Text style={styles.miniMapLabelText} numberOfLines={1}>
                {value.formattedAddress || value.city || `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}`}
              </Text>
            </View>
          </View>
          <View style={styles.miniMapAttribution}>
            <MaterialIcons name="public" size={10} color={theme.textMuted} />
            <Text style={styles.miniMapAttributionText}>{t('locationPicker', 'poweredByOSM')}</Text>
          </View>
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

          {/* City mode indicator */}
          {showCityOnly ? (
            <View style={styles.cityModeIndicator}>
              <MaterialIcons name="location-city" size={14} color={theme.primary} />
              <Text style={styles.cityModeText}>{t('locationPicker', 'citySearchMode')}</Text>
            </View>
          ) : null}

          {/* Postal code detection indicator */}
          {searchQuery.trim().length >= 3 && isPostalCodeQuery(searchQuery) ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.postalCodeIndicator}>
              <MaterialIcons name="local-post-office" size={14} color="#0EA5E9" />
              <Text style={styles.postalCodeText}>{t('locationPicker', 'postalCodeDetected')}</Text>
            </Animated.View>
          ) : null}

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={22} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={showCityOnly ? t('locationPicker', 'enterCity') : t('locationPicker', 'enterAddress')}
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
              <>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={renderSearchResult}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.resultsList}
                  keyboardShouldPersistTaps="handled"
                  ListFooterComponent={
                    <View style={styles.osmBadge}>
                      <MaterialIcons name="public" size={12} color={theme.textMuted} />
                      <Text style={styles.osmBadgeText}>{t('locationPicker', 'poweredByOSM')}</Text>
                    </View>
                  }
                />
              </>
            ) : searchQuery.length >= 3 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="location-off" size={48} color={theme.textMuted} />
                <Text style={styles.emptyText}>{t('locationPicker', 'noResultFound')}</Text>
                <Text style={styles.emptyHint}>{t('locationPicker', 'tryDifferentAddress')}</Text>
              </View>
            ) : (
              <ScrollView style={styles.hintsScrollView} contentContainerStyle={styles.hintsContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Manual GPS Toggle */}
                <Pressable
                  style={styles.manualGpsToggle}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowManualGps(!showManualGps);
                  }}
                >
                  <MaterialIcons
                    name={showManualGps ? 'keyboard-arrow-up' : 'pin-drop'}
                    size={18}
                    color={showManualGps ? theme.primary : theme.textSecondary}
                  />
                  <Text style={[styles.manualGpsToggleText, showManualGps && { color: theme.primary }]}>
                    {t('locationPicker', showManualGps ? 'manualGps' : 'orManualGps')}
                  </Text>
                  {!showManualGps ? (
                    <MaterialIcons name="keyboard-arrow-down" size={18} color={theme.textMuted} />
                  ) : null}
                </Pressable>

                {/* Manual GPS Input */}
                {showManualGps ? (
                  <Animated.View entering={FadeInDown.duration(250)} style={styles.manualGpsContainer}>
                    <View style={styles.manualGpsRow}>
                      <View style={styles.manualGpsField}>
                        <Text style={styles.manualGpsLabel}>{t('locationPicker', 'latitude')}</Text>
                        <TextInput
                          style={styles.manualGpsInput}
                          value={manualLat}
                          onChangeText={setManualLat}
                          placeholder="48.8566"
                          placeholderTextColor={theme.textMuted}
                          keyboardType="numeric"
                          returnKeyType="next"
                        />
                        <Text style={styles.manualGpsHint}>-90 ... 90</Text>
                      </View>
                      <View style={styles.manualGpsField}>
                        <Text style={styles.manualGpsLabel}>{t('locationPicker', 'longitude')}</Text>
                        <TextInput
                          style={styles.manualGpsInput}
                          value={manualLng}
                          onChangeText={setManualLng}
                          placeholder="2.3522"
                          placeholderTextColor={theme.textMuted}
                          keyboardType="numeric"
                          returnKeyType="done"
                        />
                        <Text style={styles.manualGpsHint}>-180 ... 180</Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.manualGpsApplyBtn,
                        (!manualLat.trim() || !manualLng.trim()) && styles.manualGpsApplyBtnDisabled,
                      ]}
                      onPress={handleApplyManualGps}
                      disabled={!manualLat.trim() || !manualLng.trim() || isApplyingManual}
                    >
                      {isApplyingManual ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <MaterialIcons name="check-circle" size={18} color="#FFF" />
                          <Text style={styles.manualGpsApplyText}>{t('locationPicker', 'applyCoordinates')}</Text>
                        </>
                      )}
                    </Pressable>
                  </Animated.View>
                ) : null}

                {/* Recent searches */}
                {recentSearches.length > 0 ? (
                  <View style={styles.recentSection}>
                    <View style={styles.recentHeader}>
                      <Text style={styles.hintsSectionTitle}>{t('locationPicker', 'recentSearches')}</Text>
                      <Pressable
                        style={styles.clearAllBtn}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setRecentSearches([]);
                        }}
                        hitSlop={8}
                      >
                        <MaterialIcons name="delete-sweep" size={14} color={theme.textMuted} />
                        <Text style={styles.clearAllText}>{t('locationPicker', 'clearAll')}</Text>
                      </Pressable>
                    </View>
                    {recentSearches.map((result, index) => (
                      <Pressable
                        key={result.id}
                        style={[styles.recentItem, index < recentSearches.length - 1 && styles.recentItemBorder]}
                        onPress={() => handleSelectResult(result)}
                      >
                        <MaterialIcons name="history" size={16} color={theme.textMuted} />
                        <View style={styles.recentContent}>
                          <Text style={styles.recentAddress} numberOfLines={1}>{result.address || result.city}</Text>
                          <Text style={styles.recentCity} numberOfLines={1}>{result.formattedAddress || result.city}</Text>
                        </View>
                        <Pressable
                          style={styles.recentDeleteBtn}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setRecentSearches(prev => prev.filter(r => r.id !== result.id));
                          }}
                          hitSlop={8}
                        >
                          <MaterialIcons name="close" size={14} color={theme.textMuted} />
                        </Pressable>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {/* Hints */}
                <View style={styles.hintsCard}>
                  <MaterialIcons name="lightbulb" size={20} color={theme.warning} />
                  <View style={styles.hintsContent}>
                    <Text style={styles.hintsTitle}>{t('locationPicker', 'searchTips')}</Text>
                    <Text style={styles.hintsText}>
                      {`\u2022 ${t('locationPicker', 'tipMinChars')}\n\u2022 ${t('locationPicker', 'tipIncludeCity')}\n\u2022 ${t('locationPicker', 'tipPostalCode')}\n\u2022 ${t('locationPicker', 'tipExample')}`}
                    </Text>
                  </View>
                </View>
              </ScrollView>
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
    flexWrap: 'wrap',
  },
  confirmedText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.success,
  },
  confirmedCoords: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.success + 'AA',
    fontFamily: undefined,
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
  // Manual GPS
  manualGpsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
  },
  manualGpsToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  manualGpsContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    gap: 12,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  manualGpsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  manualGpsField: {
    flex: 1,
  },
  manualGpsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  manualGpsInput: {
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  manualGpsHint: {
    fontSize: 10,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  manualGpsApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.success,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  manualGpsApplyBtnDisabled: {
    backgroundColor: theme.textMuted,
    opacity: 0.5,
  },
  manualGpsApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  // Results
  resultsContainer: {
    flex: 1,
    marginTop: 12,
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  resultCoords: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  osmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    opacity: 0.6,
  },
  osmBadgeText: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '500',
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
  hintsScrollView: {
    flex: 1,
  },
  hintsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  hintsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  recentSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 12,
    overflow: 'hidden',
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.error,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  recentItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  recentDeleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  recentContent: {
    flex: 1,
  },
  recentAddress: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  recentCity: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 1,
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
  // Mini Map
  miniMapContainer: {
    marginTop: 10,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: theme.surface,
    ...theme.shadows.card,
  },
  miniMapImage: {
    width: '100%',
    height: 120,
  },
  miniMapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: 8,
  },
  miniMapPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.error,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  miniMapLabel: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  miniMapLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  miniMapAttribution: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.surface,
  },
  miniMapAttributionText: {
    fontSize: 9,
    color: theme.textMuted,
    fontWeight: '500',
  },
  // City mode indicator
  cityModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.full,
    alignSelf: 'center',
  },
  cityModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
  // Postal code indicator
  postalCodeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#0EA5E9' + '10',
    borderRadius: theme.borderRadius.full,
    alignSelf: 'center',
  },
  postalCodeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0EA5E9',
  },
});
