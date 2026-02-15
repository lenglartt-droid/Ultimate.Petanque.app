import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';

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

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('club', 'newClub')}</Text>
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
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'clubNameRequired')}</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t('club', 'namePlaceholder')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              autoFocus
            />
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

          {/* Description */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
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
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
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
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
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
          <Animated.View entering={FadeInDown.duration(400).delay(325)} style={styles.section}>
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

          {/* Contact */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
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
            style={[styles.saveButton, (!name.trim() || !location.city.trim()) && styles.saveButtonDisabled]} 
            onPress={handleSave}
          >
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>{t('club', 'createClub')}</Text>
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
});
