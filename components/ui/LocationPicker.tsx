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
import { getSupabaseClient } from '@/template';

const RECENT_SEARCHES_KEY = '@location_picker_recent_searches';
const MAX_RECENT = 8;

// const GOOGLE_API_KEY = '';
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export interface LocationData {
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  postalCode?: string;
  region?: string;
  placeName?: string;
  placeId?: string;
  /** Places API (New): `photos[0].name` (e.g. `places/ChIJ…/photos/Aw…`). Not a legacy `photo_reference`. */
  googlePhotoRef?: string;
  /** All photo references from Places API */
  googlePhotoRefs?: string[];
}

interface MyPlace {
  id: string;
  name: string;
  city: string;
  address?: string;
  latitude: number;
  longitude: number;
  type: 'terrain' | 'club' | 'tournament';
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
  placeId?: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  postalCode?: string;
  region?: string;
  placeName?: string;
  googlePhotoRef?: string;
  googlePhotoRefs?: string[];
}

// ============================================
// Places API (New) — Autocomplete
// POST https://places.googleapis.com/v1/places:autocomplete
// ============================================
async function searchGooglePlaces(query: string, types?: string, lang: string = 'fr'): Promise<SearchResult[]> {
  if (!GOOGLE_API_KEY) return searchNominatimFallback(query);
  try {
    const body: Record<string, any> = {
      input: query,
      languageCode: lang,
    };

    // Map legacy type strings to new includedPrimaryTypes format
    if (types === '(cities)') {
      body.includedPrimaryTypes = ['locality', 'administrative_area_level_3'];
    } else if (types === '(regions)') {
      body.includedPrimaryTypes = ['postal_code'];
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.log('[Google Places New] Autocomplete error:', response.status, errText);
      return [];
    }

    const data = await response.json();
    const suggestions = data.suggestions || [];

    return suggestions
      .filter((s: any) => s.placePrediction)
      .map((s: any) => {
        const p = s.placePrediction;
        return {
          id: p.placeId,
          placeId: p.placeId,
          address: p.structuredFormat?.mainText?.text || '',
          city: '',
          country: '',
          latitude: 0,
          longitude: 0,
          formattedAddress: p.text?.text || p.structuredFormat?.mainText?.text || '',
        };
      });
  } catch (e) {
    console.log('[Google Places New] Autocomplete exception:', e);
    return [];
  }
}

// ============================================
// Places API (New) — Place Details
// GET https://places.googleapis.com/v1/places/{placeId}
// ============================================
async function getGooglePlaceDetails(placeId: string, lang: string = 'fr'): Promise<SearchResult | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    const fields = [
      'id',
      'displayName',
      'formattedAddress',
      'location',
      'addressComponents',
      'photos',
    ].join(',');

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=${lang}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': fields,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.log('[Google Places New] Details error:', response.status, errText);
      return null;
    }

    const result = await response.json();
    const components: any[] = result.addressComponents || [];

    const getComponent = (type: string) =>
      components.find((c: any) => c.types?.includes(type))?.longText || '';

    const streetNumber = getComponent('street_number');
    const route = getComponent('route');
    const street = [streetNumber, route].filter(Boolean).join(' ');
    const city =
      getComponent('locality') ||
      getComponent('administrative_area_level_2') ||
      getComponent('postal_town') ||
      getComponent('sublocality_level_1') ||
      '';
    const country = getComponent('country') || '';
    const postalCode = getComponent('postal_code') || '';
    const region =
      getComponent('administrative_area_level_1') ||
      getComponent('administrative_area_level_2') ||
      '';
    const lat = result.location?.latitude || 0;
    const lng = result.location?.longitude || 0;

    // First photo reference (New API uses photo resource name)
    const photoRef = result.photos?.[0]?.name || '';
    const photoRefs: string[] = (result.photos || []).map((p: any) => p.name).filter(Boolean);

    return {
      id: placeId,
      placeId,
      address: street || result.displayName?.text || '',
      city,
      country,
      latitude: lat,
      longitude: lng,
      formattedAddress: result.formattedAddress || '',
      postalCode,
      region,
      placeName: result.displayName?.text || '',
      googlePhotoRef: photoRef || undefined,
      googlePhotoRefs: photoRefs.length > 0 ? photoRefs : undefined,
    };
  } catch (e) {
    console.log('[Google Places New] Details exception:', e);
    return null;
  }
}

// ============================================
// Geocoding API (New) — Reverse Geocode
// POST https://maps.googleapis.com/maps/api/geocode/json
// Note: Geocoding API has no "New" variant yet; it already works with
// projects that only have "Places API (New)" if Geocoding API is enabled.
// If you also see REQUEST_DENIED here, enable "Geocoding API" in GCP Console.
// ============================================
async function reverseGoogleGeocode(lat: number, lng: number, lang: string = 'fr'): Promise<SearchResult | null> {
  if (!GOOGLE_API_KEY) return reverseNominatimFallback(lat, lng);
  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: GOOGLE_API_KEY,
      language: lang,
    });
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log('[Geocoding API] Status:', data.status, data.error_message);
      return null;
    }

    const result = data.results[0];
    const components = result.address_components || [];
    const getComponent = (type: string) =>
      components.find((c: any) => c.types?.includes(type))?.long_name || '';

    const streetNumber = getComponent('street_number');
    const route = getComponent('route');
    const street = [streetNumber, route].filter(Boolean).join(' ');
    const city =
      getComponent('locality') ||
      getComponent('administrative_area_level_2') ||
      getComponent('postal_town') ||
      '';
    const country = getComponent('country') || '';
    const postalCode = getComponent('postal_code') || '';
    const region =
      getComponent('administrative_area_level_1') ||
      getComponent('administrative_area_level_2') ||
      '';

    return {
      id: result.place_id || `${lat}-${lng}`,
      address: street || '',
      city,
      country,
      latitude: lat,
      longitude: lng,
      formattedAddress:
        result.formatted_address ||
        [street, city, country].filter(Boolean).join(', '),
      postalCode,
      region,
    };
  } catch (e) {
    console.log('[Geocoding API] Reverse error:', e);
    return null;
  }
}

// ============================================
// Nominatim fallbacks (when no Google key)
// ============================================
async function searchNominatimFallback(query: string): Promise<SearchResult[]> {
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&addressdetails=1&limit=8&accept-language=fr,en`,
      { headers: { 'User-Agent': 'UltimatePetanque/1.0', 'Accept': 'application/json' } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((item: any) => {
        const addr = item.address || {};
        const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
        const city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.hamlet ||
          '';
        const country = addr.country || '';
        return {
          id: `${item.place_id}`,
          address: street || item.name || '',
          city,
          country,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          formattedAddress:
            [street, city, country].filter(Boolean).join(', ') ||
            item.display_name ||
            '',
        };
      })
      .filter((r: SearchResult) => !isNaN(r.latitude) && !isNaN(r.longitude));
  } catch {
    return [];
  }
}

async function reverseNominatimFallback(lat: number, lng: number): Promise<SearchResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=fr,en`,
      { headers: { 'User-Agent': 'UltimatePetanque/1.0', 'Accept': 'application/json' } }
    );
    if (!response.ok) return null;
    const item = await response.json();
    if (!item || item.error) return null;
    const addr = item.address || {};
    const street = [addr.house_number, addr.road].filter(Boolean).join(' ');
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.hamlet ||
      '';
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
  } catch {
    return null;
  }
}

// Detect postal codes
function isPostalCodeQuery(query: string): boolean {
  const trimmed = query.trim();
  if (/^\d{3,10}$/.test(trimmed)) return true;
  if (/^[A-Z0-9]{2,4}\s?[A-Z0-9]{2,4}$/i.test(trimmed) && /\d/.test(trimmed)) return true;
  return false;
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
  const { t, language } = useLanguage();
  const lang = language === 'fr' ? 'fr' : 'en';

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
  const [resolvingPlace, setResolvingPlace] = useState(false);

  // My Places from user's existing data
  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([]);
  const [myPlacesLoading, setMyPlacesLoading] = useState(false);
  const myPlacesLoadedRef = useRef(false);

  // Manual GPS state
  const [showManualGps, setShowManualGps] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [isApplyingManual, setIsApplyingManual] = useState(false);

  // Debounce ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then(raw => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, MAX_RECENT));
          } catch { /* ignore */ }
        }
        recentLoadedRef.current = true;
      })
      .catch(() => { recentLoadedRef.current = true; });
  }, []);

  useEffect(() => {
    if (!recentLoadedRef.current) return;
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

  // Search addresses using Places API (New)
  const searchAddresses = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (GOOGLE_API_KEY) {
        let types: string | undefined;
        if (showCityOnly) {
          types = '(cities)';
        } else if (isPostalCodeQuery(query)) {
          types = '(regions)';
        }

        const results = await searchGooglePlaces(query, types, lang);
        console.log(results);
        setSearchResults(results);
        console.log(results);
      } else {
        // Fallback to Nominatim
        const results = await searchNominatimFallback(query);
        if (showCityOnly) {
          const cityFiltered = results.filter(r => r.city);
          setSearchResults(cityFiltered.length > 0 ? cityFiltered : results);
        } else {
          setSearchResults(results);
        }
      }
    } catch (error) {
      console.log('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [showCityOnly, lang]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    searchTimerRef.current = setTimeout(() => {
      if (modalVisible && searchQuery.trim()) {
        searchAddresses(searchQuery);
      }
    }, 350);

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

      const geocodeResult = await reverseGoogleGeocode(
        location.coords.latitude,
        location.coords.longitude,
        lang
      );

      if (geocodeResult) {
        const newLocation: LocationData = {
          address: geocodeResult.address,
          city: geocodeResult.city,
          country: geocodeResult.country || 'France',
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          formattedAddress: geocodeResult.formattedAddress,
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

        onChange({ address, city, country, latitude: location.coords.latitude, longitude: location.coords.longitude, formattedAddress });
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
      const geocodeResult = await reverseGoogleGeocode(lat, lng, lang);

      const newLocation: LocationData = {
        address: geocodeResult?.address || '',
        city: geocodeResult?.city || '',
        country: geocodeResult?.country || 'France',
        latitude: lat,
        longitude: lng,
        formattedAddress: geocodeResult?.formattedAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      };

      onChange(newLocation);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      setManualLat('');
      setManualLng('');
      setShowManualGps(false);
    } catch (error) {
      console.log('Manual GPS error:', error);
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

  const handleSelectResult = async (result: SearchResult) => {
    Haptics.selectionAsync();

    // If Google place (no lat/lng yet), resolve details first
    if (result.placeId && result.latitude === 0 && result.longitude === 0) {
      setResolvingPlace(true);
      const details = await getGooglePlaceDetails(result.placeId, lang);
      setResolvingPlace(false);

      if (details) {
        const newLocation: LocationData = {
          address: details.address,
          city: details.city,
          country: details.country,
          latitude: details.latitude,
          longitude: details.longitude,
          formattedAddress: details.formattedAddress,
          postalCode: details.postalCode,
          region: details.region,
          placeName: details.placeName,
          placeId: details.placeId,
          googlePhotoRef: details.googlePhotoRef,
          googlePhotoRefs: details.googlePhotoRefs,
        };
        onChange(newLocation);

        const resolvedResult: SearchResult = { ...result, ...details };
        setRecentSearches(prev => {
          const filtered = prev.filter(r => r.id !== resolvedResult.id);
          return [resolvedResult, ...filtered].slice(0, MAX_RECENT);
        });
      } else {
        onChange({
          address: result.address,
          city: result.city,
          country: result.country,
          latitude: result.latitude,
          longitude: result.longitude,
          formattedAddress: result.formattedAddress,
        });
      }
    } else {
      onChange({
        address: result.address,
        city: result.city,
        country: result.country,
        latitude: result.latitude,
        longitude: result.longitude,
        formattedAddress: result.formattedAddress,
      });

      setRecentSearches(prev => {
        const filtered = prev.filter(r => r.id !== result.id);
        return [result, ...filtered].slice(0, MAX_RECENT);
      });
    }

    setModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Load My Places from user's terrains, clubs, tournaments
  const loadMyPlaces = useCallback(async () => {
    if (myPlacesLoadedRef.current) return;
    setMyPlacesLoading(true);
    try {
      const sb = getSupabaseClient();
      const { data: userData } = await sb.auth.getUser();
      if (!userData?.user) { setMyPlacesLoading(false); return; }
      const uid = userData.user.id;
      const [tRes, cRes, toRes] = await Promise.all([
        sb.from('terrains').select('id, name, city, address, location').eq('user_id', uid).limit(10),
        sb.from('clubs').select('id, name, city, address, location').eq('user_id', uid).limit(10),
        sb.from('tournaments').select('id, name, location').eq('user_id', uid).limit(10),
      ]);
      const places: MyPlace[] = [];
      const seen = new Set<string>();
      (tRes.data || []).forEach((t: any) => {
        const key = `${t.city}-${t.name}`.toLowerCase();
        if (seen.has(key) || !t.city) return;
        seen.add(key);
        places.push({ id: t.id, name: t.name, city: t.city, address: t.address, latitude: t.location?.latitude || 0, longitude: t.location?.longitude || 0, type: 'terrain' });
      });
      (cRes.data || []).forEach((c: any) => {
        const key = `${c.city}-${c.name}`.toLowerCase();
        if (seen.has(key) || !c.city) return;
        seen.add(key);
        places.push({ id: c.id, name: c.name, city: c.city, address: c.address, latitude: c.location?.latitude || 0, longitude: c.location?.longitude || 0, type: 'club' });
      });
      (toRes.data || []).forEach((to: any) => {
        const loc = to.location;
        const city = loc?.city || '';
        const key = `${city}-${to.name}`.toLowerCase();
        if (seen.has(key) || !city) return;
        seen.add(key);
        places.push({ id: to.id, name: to.name, city, address: loc?.name, latitude: loc?.latitude || 0, longitude: loc?.longitude || 0, type: 'tournament' });
      });
      setMyPlaces(places.slice(0, 15));
      myPlacesLoadedRef.current = true;
    } catch { /* silent */ }
    setMyPlacesLoading(false);
  }, []);

  const handleSelectMyPlace = useCallback((place: MyPlace) => {
    Haptics.selectionAsync();
    onChange({
      address: place.address || '',
      city: place.city,
      country: 'France',
      latitude: place.latitude,
      longitude: place.longitude,
      formattedAddress: [place.address, place.city].filter(Boolean).join(', '),
    });
    setModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  }, [onChange]);

  const openModal = () => {
    Haptics.selectionAsync();
    setModalVisible(true);
    setSearchQuery('');
    setSearchResults([]);
    setShowManualGps(false);
    setManualLat('');
    setManualLng('');
    loadMyPlaces();
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
    onChange({ address: '', city: '', country: 'France', latitude: 0, longitude: 0, formattedAddress: '' });
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => (
    <Pressable
      style={styles.resultItem}
      onPress={() => handleSelectResult(item)}
      disabled={resolvingPlace}
    >
      <View style={styles.resultIcon}>
        <MaterialIcons name="place" size={22} color={theme.primary} />
      </View>
      <View style={styles.resultContent}>
        <Text style={styles.resultAddress} numberOfLines={1}>
          {item.address || item.formattedAddress?.split(',')[0] || item.city}
        </Text>
        <Text style={styles.resultCity} numberOfLines={1}>
          {item.formattedAddress || `${item.city}${item.country && item.country !== 'France' ? `, ${item.country}` : ''}`}
        </Text>
        {item.latitude && item.latitude !== 0 ? (
          <Text style={styles.resultCoords}>
            {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
          </Text>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
    </Pressable>
  );

  const isGoogleEnabled = !!GOOGLE_API_KEY;
  const providerLabel = isGoogleEnabled ? 'Google Maps' : 'OpenStreetMap';

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

          {/* Resolving place overlay */}
          {resolvingPlace ? (
            <View style={styles.resolvingOverlay}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.resolvingText}>{language === 'fr' ? 'Chargement...' : 'Loading...'}</Text>
            </View>
          ) : null}

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
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={
                  <View style={styles.osmBadge}>
                    <MaterialIcons name={isGoogleEnabled ? 'map' : 'public'} size={12} color={theme.textMuted} />
                    <Text style={styles.osmBadgeText}>{providerLabel}</Text>
                  </View>
                }
              />
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

                {/* My Places */}
                {myPlaces.length > 0 ? (
                  <View style={styles.myPlacesSection}>
                    <View style={styles.myPlacesHeader}>
                      <MaterialIcons name="bookmark" size={14} color="#7C3AED" />
                      <Text style={styles.myPlacesTitle}>{language === 'fr' ? 'Mes lieux' : 'My Places'}</Text>
                    </View>
                    {myPlaces.map((place) => {
                      const typeIcon = place.type === 'terrain' ? 'sports-soccer' : place.type === 'club' ? 'home-work' : 'emoji-events';
                      const typeColor = place.type === 'terrain' ? '#22C55E' : place.type === 'club' ? '#3B82F6' : '#F59E0B';
                      return (
                        <Pressable
                          key={`${place.type}-${place.id}`}
                          style={styles.myPlaceItem}
                          onPress={() => handleSelectMyPlace(place)}
                        >
                          <View style={[styles.myPlaceIcon, { backgroundColor: typeColor + '15' }]}>
                            <MaterialIcons name={typeIcon as any} size={16} color={typeColor} />
                          </View>
                          <View style={styles.myPlaceContent}>
                            <Text style={styles.myPlaceName} numberOfLines={1}>{place.name}</Text>
                            <Text style={styles.myPlaceCity} numberOfLines={1}>{[place.address, place.city].filter(Boolean).join(', ')}</Text>
                          </View>
                          <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : myPlacesLoading ? (
                  <View style={styles.myPlacesLoadingRow}>
                    <ActivityIndicator size="small" color="#7C3AED" />
                    <Text style={styles.myPlacesLoadingText}>{language === 'fr' ? 'Chargement...' : 'Loading...'}</Text>
                  </View>
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
  container: { marginBottom: 16, flex: 1 },
  label: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1, marginBottom: 10 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, paddingHorizontal: 14, paddingVertical: 14, borderRadius: theme.borderRadius.md, gap: 12, ...theme.shadows.card },
  inputContent: { flex: 1 },
  inputValue: { fontSize: 16, fontWeight: '500', color: theme.textPrimary },
  inputCity: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  placeholder: { fontSize: 16, color: theme.textMuted },
  clearButton: { padding: 4 },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.success + '10', borderRadius: theme.borderRadius.sm, alignSelf: 'flex-start', flexWrap: 'wrap' },
  confirmedText: { fontSize: 12, fontWeight: '500', color: theme.success },
  confirmedCoords: { fontSize: 11, fontWeight: '600', color: theme.success + 'AA' },
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  gpsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, marginHorizontal: 16, marginTop: 16, paddingVertical: 16, borderRadius: theme.borderRadius.md, ...theme.shadows.card },
  gpsButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, marginHorizontal: 16, marginTop: 16, paddingHorizontal: 14, borderRadius: theme.borderRadius.md, gap: 10, ...theme.shadows.card },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: theme.textPrimary },
  manualGpsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginBottom: 4 },
  manualGpsToggleText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  manualGpsContainer: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, gap: 12, marginBottom: 12, ...theme.shadows.card },
  manualGpsRow: { flexDirection: 'row', gap: 12 },
  manualGpsField: { flex: 1 },
  manualGpsLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  manualGpsInput: { backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.sm, paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, fontWeight: '600', color: theme.textPrimary, textAlign: 'center', borderWidth: 1, borderColor: theme.border },
  manualGpsHint: { fontSize: 10, color: theme.textMuted, textAlign: 'center', marginTop: 4 },
  manualGpsApplyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.success, paddingVertical: 14, borderRadius: theme.borderRadius.md },
  manualGpsApplyBtnDisabled: { backgroundColor: theme.textMuted, opacity: 0.5 },
  manualGpsApplyText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  resultsContainer: { flex: 1, marginTop: 12 },
  resultsList: { paddingHorizontal: 16, paddingBottom: 16 },
  resultItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, paddingHorizontal: 14, paddingVertical: 14, borderRadius: theme.borderRadius.md, marginBottom: 10, gap: 12, ...theme.shadows.card },
  resultIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  resultContent: { flex: 1 },
  resultAddress: { fontSize: 15, fontWeight: '500', color: theme.textPrimary },
  resultCity: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  resultCoords: { fontSize: 11, color: theme.textMuted, marginTop: 2, fontWeight: '500' },
  osmBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, opacity: 0.6 },
  osmBadgeText: { fontSize: 11, color: theme.textMuted, fontWeight: '500' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: theme.textSecondary },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyText: { fontSize: 17, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  emptyHint: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8 },
  hintsScrollView: { flex: 1 },
  hintsContainer: { paddingHorizontal: 16, paddingBottom: 24 },
  hintsSectionTitle: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  recentSection: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, marginBottom: 12, overflow: 'hidden' },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 3, paddingHorizontal: 6 },
  clearAllText: { fontSize: 11, fontWeight: '600', color: theme.error },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 10 },
  recentItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  recentDeleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  recentContent: { flex: 1 },
  recentAddress: { fontSize: 13, fontWeight: '500', color: theme.textPrimary },
  recentCity: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  hintsCard: { flexDirection: 'row', backgroundColor: theme.warning + '10', borderRadius: theme.borderRadius.md, padding: 14, marginTop: 16, gap: 12, borderWidth: 1, borderColor: theme.warning + '30' },
  hintsContent: { flex: 1 },
  hintsTitle: { fontSize: 14, fontWeight: '600', color: theme.warning, marginBottom: 6 },
  hintsText: { fontSize: 13, color: theme.textSecondary, lineHeight: 20 },
  cityModeIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: theme.primary + '10', borderRadius: theme.borderRadius.full, alignSelf: 'center' },
  cityModeText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  postalCodeIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#0EA5E9' + '10', borderRadius: theme.borderRadius.full, alignSelf: 'center' },
  postalCodeText: { fontSize: 12, fontWeight: '600', color: '#0EA5E9' },
  myPlacesSection: { backgroundColor: '#7C3AED08', borderRadius: theme.borderRadius.md, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#7C3AED15' },
  myPlacesHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  myPlacesTitle: { fontSize: 11, fontWeight: '700' as const, color: '#7C3AED', letterSpacing: 0.5, textTransform: 'uppercase' as const },
  myPlaceItem: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#7C3AED15' },
  myPlaceIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  myPlaceContent: { flex: 1 },
  myPlaceName: { fontSize: 13, fontWeight: '600' as const, color: theme.textPrimary },
  myPlaceCity: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  myPlacesLoadingRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 12, marginBottom: 8 },
  myPlacesLoadingText: { fontSize: 12, color: '#7C3AED', fontWeight: '500' as const },
  resolvingOverlay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, backgroundColor: theme.primary + '08' },
  resolvingText: { fontSize: 13, color: theme.primary, fontWeight: '500' },
});
