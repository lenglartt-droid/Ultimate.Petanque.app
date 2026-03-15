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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { uploadPlayerAvatar } from '@/services/storageService';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config, { PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';

const levels = ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert'] as const;

const ROLE_CONFIG: Record<string, { icon: string; color: string }> = {
  'Tireur': { icon: 'gps-fixed', color: '#EF4444' },
  'Pointeur': { icon: 'radio-button-on', color: '#10B981' },
  'Milieu': { icon: 'swap-horiz', color: '#3B82F6' },
};

const LEVEL_CONFIG: Record<string, { icon: string }> = {
  'Débutant': { icon: 'sentiment-satisfied' },
  'Intermédiaire': { icon: 'trending-up' },
  'Confirmé': { icon: 'shield' },
  'Expert': { icon: 'diamond' },
};

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

export default function NewPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { addPlayer, clubs, terrains } = useApp();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [role, setRole] = useState<PlayerRole>('Milieu');
  const [level, setLevel] = useState<typeof levels[number]>('Intermédiaire');
  const [clubId, setClubId] = useState<string | undefined>();
  const [terrainId, setTerrainId] = useState<string | undefined>();
  const [location, setLocation] = useState<LocationData>({
    address: '', city: '', country: 'France', latitude: 0, longitude: 0,
  });
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [boulesName, setBoulesName] = useState('');
  const [boulesDiameter, setBoulesDiameter] = useState('');
  const [boulesWeight, setBoulesWeight] = useState('');

  // Progress
  const progressFilled = [name.trim(), true, true].filter(Boolean).length;
  const progressTotal = 3;
  const progressLabel = !name.trim()
    ? (t('player', 'nameIsRequired'))
    : (t('tournament', 'readyToCreate'));

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('player', 'permissionRequired'), t('player', 'permissionPhotos')); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
    } catch (error) { console.log('Error picking image:', error); Alert.alert(t('common', 'error'), t('player', 'errorSelectPhoto')); }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('player', 'permissionRequired'), t('player', 'permissionCamera')); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
    } catch (error) { console.log('Error taking photo:', error); Alert.alert(t('common', 'error'), t('player', 'errorTakePhoto')); }
  };

  const showImageOptions = () => {
    Alert.alert(t('player', 'profilePhoto'), t('player', 'chooseOption'), [
      { text: t('player', 'takePhoto'), onPress: takePhoto },
      { text: t('player', 'chooseFromGallery'), onPress: pickImage },
      ...(avatarUri ? [{ text: t('player', 'removeLabel'), style: 'destructive' as const, onPress: () => setAvatarUri(null) }] : []),
      { text: t('common', 'cancel'), style: 'cancel' as const },
    ]);
  };

  const uploadAvatar = async (): Promise<string | undefined> => {
    if (!avatarUri) return undefined;
    if (avatarUri.startsWith('http://') || avatarUri.startsWith('https://')) return avatarUri;
    try {
      setUploadingAvatar(true);
      const url = await uploadPlayerAvatar('new_player', avatarUri);
      return url || undefined;
    } catch (error) { console.log('Error uploading avatar:', error); return undefined; } finally { setUploadingAvatar(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert(t('common', 'error'), t('player', 'nameIsRequired')); return; }
    const selectedClub = clubs.find(c => c.id === clubId);
    const selectedTerrain = terrains.find(t => t.id === terrainId);
    const avatarUrl = await uploadAvatar();
    const boules = (boulesName.trim() || boulesDiameter || boulesWeight) ? {
      name: boulesName.trim() || undefined,
      diameter: boulesDiameter ? parseInt(boulesDiameter) : undefined,
      weight: boulesWeight ? parseInt(boulesWeight) : undefined,
    } : undefined;
    addPlayer({
      name: name.trim(), nickname: nickname.trim() || undefined, avatar: avatarUrl, role, level,
      clubId, club: selectedClub?.name, terrainId, terrainName: selectedTerrain?.name,
      phone: phone.trim() || undefined, email: email.trim() || undefined, boules,
      location: location.city ? { city: location.city, latitude: location.latitude, longitude: location.longitude } : undefined,
      country: location.country || 'France',
      stats: { matchesPlayed: 0, wins: 0, losses: 0, winRate: 0, tirRate: 0, pointRate: 0, carreauRate: 0, avgPointsScored: 0, avgPointsConceded: 0 },
      createdAt: new Date().toISOString(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('player', 'newPlayer')}</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <StepIndicator step={progressFilled} total={progressTotal} label={progressLabel} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
            <Pressable style={styles.avatarContainer} onPress={showImageOptions} disabled={uploadingAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" transition={200} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                {uploadingAvatar ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="camera-alt" size={16} color="#FFF" />}
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>{t('player', 'tapToAddPhoto')}</Text>
          </Animated.View>

          {/* Name */}
          <SectionCard title={t('player', 'nameLabel')} icon="person" color={theme.primary} delay={50} required>
            <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder={t('player', 'namePlaceholder')} placeholderTextColor={theme.textMuted} autoCapitalize="words" autoFocus />
            <TextInput style={[styles.textInput, { marginTop: 10 }]} value={nickname} onChangeText={setNickname} placeholder={t('player', 'nicknamePlaceholder')} placeholderTextColor={theme.textMuted} />
          </SectionCard>

          {/* Role */}
          <SectionCard title={t('player', 'roleLabel')} icon="sports" color={theme.tirColor} delay={100} required>
            <View style={styles.roleGrid}>
              {config.playerRoles.map(r => {
                const cfg = ROLE_CONFIG[r] || { icon: 'sports', color: theme.primary };
                const isActive = role === r;
                return (
                  <Pressable key={r} style={[styles.roleCard, isActive && { borderColor: cfg.color, backgroundColor: cfg.color + '08' }]} onPress={() => { Haptics.selectionAsync(); setRole(r); }}>
                    <View style={[styles.roleCardIconBox, isActive && { backgroundColor: cfg.color }]}>
                      <MaterialIcons name={cfg.icon as any} size={22} color={isActive ? '#FFF' : theme.textSecondary} />
                    </View>
                    <Text style={[styles.roleCardName, isActive && { color: cfg.color }]}>{t('roles', r)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* Level */}
          <SectionCard title={t('player', 'levelLabel')} icon="signal-cellular-alt" color={theme.success} delay={150}>
            <View style={styles.levelGrid}>
              {levels.map(l => {
                const isActive = level === l;
                const ico = LEVEL_CONFIG[l]?.icon || 'star';
                return (
                  <Pressable key={l} style={[styles.levelChip, isActive && styles.levelChipActive]} onPress={() => { Haptics.selectionAsync(); setLevel(l); }}>
                    <MaterialIcons name={ico as any} size={14} color={isActive ? theme.success : theme.textMuted} />
                    <Text style={[styles.levelChipText, isActive && styles.levelChipTextActive]}>{t('levels', l)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* Club */}
          <SectionCard title={t('player', 'clubLabel')} icon="home-work" color={theme.accent} delay={200}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              <Pressable style={[styles.chipBtn, !clubId && styles.chipBtnActive]} onPress={() => { Haptics.selectionAsync(); setClubId(undefined); }}>
                <Text style={[styles.chipBtnText, !clubId && styles.chipBtnTextActive]}>{t('player', 'noClub')}</Text>
              </Pressable>
              {clubs.map(club => (
                <Pressable key={club.id} style={[styles.chipBtn, clubId === club.id && styles.chipBtnActive]} onPress={() => { Haptics.selectionAsync(); setClubId(club.id); }}>
                  <Text style={[styles.chipBtnText, clubId === club.id && styles.chipBtnTextActive]}>{club.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </SectionCard>

          {/* Terrain */}
          <SectionCard title={t('player', 'practiceTerrain')} icon="place" color={theme.success} delay={250}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              <Pressable style={[styles.terrainChip, !terrainId && styles.terrainChipActive]} onPress={() => { Haptics.selectionAsync(); setTerrainId(undefined); }}>
                <MaterialIcons name="not-listed-location" size={18} color={!terrainId ? '#FFF' : theme.textSecondary} />
                <Text style={[styles.terrainChipText, !terrainId && styles.terrainChipTextActive]}>{t('player', 'undefined')}</Text>
              </Pressable>
              {terrains.map(terrain => (
                <Pressable key={terrain.id} style={[styles.terrainChip, terrainId === terrain.id && styles.terrainChipActive]} onPress={() => { Haptics.selectionAsync(); setTerrainId(terrain.id); }}>
                  <MaterialIcons name="sports-soccer" size={18} color={terrainId === terrain.id ? '#FFF' : theme.textSecondary} />
                  <View style={{ maxWidth: 120 }}>
                    <Text style={[styles.terrainChipText, terrainId === terrain.id && styles.terrainChipTextActive]} numberOfLines={1}>{terrain.name}</Text>
                    <Text style={[styles.terrainChipSubtext, terrainId === terrain.id && styles.terrainChipSubtextActive]}>{terrain.city} {'\u2022'} {t('terrainTypes', terrain.type)}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </SectionCard>

          {/* Location */}
          <SectionCard title={t('player', 'locationLabel')} icon="my-location" color={theme.primaryLight} delay={300}>
            <LocationPicker label="" value={location} onChange={setLocation} placeholder={t('player', 'searchCity')} showCityOnly />
            {/* Auto-fill suggestions */}
            {(() => {
              const empty = !location.latitude && !location.longitude;
              if (!empty) return null;
              const suggestions: { label: string; icon: string; color: string; city: string; lat: number; lng: number; address?: string; country?: string }[] = [];
              if (terrainId) { const tr = terrains.find(te => te.id === terrainId); if (tr?.location?.latitude || tr?.location?.longitude) suggestions.push({ label: t('profile', 'useTerrainLocation'), icon: 'sports-soccer', color: theme.success, city: tr.city, lat: tr.location.latitude, lng: tr.location.longitude, address: tr.address, country: tr.country }); }
              if (clubId) { const cl = clubs.find(c => c.id === clubId); if (cl?.location?.latitude || cl?.location?.longitude) suggestions.push({ label: t('profile', 'useClubLocation'), icon: 'home', color: theme.accent, city: cl.city, lat: cl.location.latitude, lng: cl.location.longitude, address: cl.address, country: cl.country }); }
              return suggestions.map((sug, idx) => (
                <Pressable key={idx} style={styles.autoFillBtn} onPress={() => { Haptics.selectionAsync(); setLocation({ address: sug.address || '', city: sug.city || '', country: sug.country || 'France', latitude: sug.lat, longitude: sug.lng }); }}>
                  <View style={[styles.autoFillIcon, { backgroundColor: sug.color + '15' }]}><MaterialIcons name={sug.icon as any} size={16} color={sug.color} /></View>
                  <Text style={styles.autoFillText} numberOfLines={1}>{sug.label}</Text>
                  <MaterialIcons name="my-location" size={16} color={theme.primary} />
                </Pressable>
              ));
            })()}
          </SectionCard>

          {/* Boules */}
          <SectionCard title={t('player', 'boulesLabel')} icon="sports-baseball" color="#D97706" delay={350}>
            <TextInput style={styles.textInput} value={boulesName} onChangeText={setBoulesName} placeholder={t('player', 'boulesPlaceholder')} placeholderTextColor={theme.textMuted} />
            <View style={styles.specsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.specLabel}>{t('player', 'diameterLabel')}</Text>
                <TextInput style={styles.textInput} value={boulesDiameter} onChangeText={setBoulesDiameter} placeholder="Ex: 74" placeholderTextColor={theme.textMuted} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.specLabel}>{t('player', 'weightLabel')}</Text>
                <TextInput style={styles.textInput} value={boulesWeight} onChangeText={setBoulesWeight} placeholder="Ex: 700" placeholderTextColor={theme.textMuted} keyboardType="number-pad" />
              </View>
            </View>
          </SectionCard>

          {/* Contact */}
          <SectionCard title={t('player', 'contactLabel')} icon="contacts" color={theme.textSecondary} delay={400}>
            <View style={styles.contactRow}>
              <MaterialIcons name="phone" size={20} color={theme.textSecondary} />
              <TextInput style={styles.contactInput} value={phone} onChangeText={setPhone} placeholder={t('player', 'phonePlaceholder')} placeholderTextColor={theme.textMuted} keyboardType="phone-pad" />
            </View>
            <View style={[styles.contactRow, { marginTop: 10 }]}>
              <MaterialIcons name="email" size={20} color={theme.textSecondary} />
              <TextInput style={styles.contactInput} value={email} onChangeText={setEmail} placeholder={t('player', 'emailPlaceholder')} placeholderTextColor={theme.textMuted} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </SectionCard>
        </ScrollView>

        {/* Save */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [styles.saveButton, (!name.trim() || uploadingAvatar) && styles.saveButtonDisabled, pressed && name.trim() && !uploadingAvatar && styles.saveButtonPressed]}
            onPress={handleSave}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? <ActivityIndicator color="#FFF" /> : <MaterialIcons name="person-add" size={22} color="#FFF" />}
            <Text style={styles.saveButtonText}>{uploadingAvatar ? t('player', 'saving') : t('player', 'createPlayer')}</Text>
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
  stepBarFill: { height: '100%', backgroundColor: theme.primary, borderRadius: 2 },
  stepLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 14 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { fontSize: 34, fontWeight: '700', color: '#FFF' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.backgroundSecondary },
  avatarHint: { fontSize: 11, color: theme.textMuted, marginTop: 6 },

  // SectionCard
  sectionCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 14, ...theme.shadows.card },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionCardIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionCardTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  sectionCardSubtitle: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  requiredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.error },

  // Inputs
  textInput: { backgroundColor: theme.backgroundSecondary, paddingHorizontal: 14, paddingVertical: 13, borderRadius: theme.borderRadius.md, fontSize: 15, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border },

  // Role
  roleGrid: { flexDirection: 'row', gap: 10 },
  roleCard: { flex: 1, alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, padding: 14, borderWidth: 2, borderColor: 'transparent' },
  roleCardIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.textMuted + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  roleCardName: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },

  // Level
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  levelChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, borderWidth: 1.5, borderColor: 'transparent' },
  levelChipActive: { borderColor: theme.success, backgroundColor: theme.success + '08' },
  levelChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  levelChipTextActive: { color: theme.success },

  // Chips
  chipScroll: { gap: 8 },
  chipBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.full, borderWidth: 1.5, borderColor: 'transparent' },
  chipBtnActive: { borderColor: theme.accent, backgroundColor: theme.accent + '08' },
  chipBtnText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  chipBtnTextActive: { color: theme.accent },

  // Terrain chips
  terrainChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, borderWidth: 1.5, borderColor: 'transparent' },
  terrainChipActive: { borderColor: theme.success, backgroundColor: theme.success },
  terrainChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  terrainChipTextActive: { color: '#FFF' },
  terrainChipSubtext: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  terrainChipSubtextActive: { color: 'rgba(255,255,255,0.7)' },

  // Auto-fill
  autoFillBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.primary + '08', borderRadius: theme.borderRadius.md, padding: 12, marginTop: 10, borderWidth: 1, borderColor: theme.primary + '20', borderStyle: 'dashed' as any },
  autoFillIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  autoFillText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.primary },

  // Boules
  specsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  specLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Contact
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border },
  contactInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: theme.textPrimary },

  // Footer
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: theme.borderRadius.md, ...theme.shadows.cardElevated },
  saveButtonDisabled: { backgroundColor: theme.textMuted, opacity: 0.6 },
  saveButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
