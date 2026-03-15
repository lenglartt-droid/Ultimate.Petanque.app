
import React, { useState, useEffect, useMemo } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { uploadPlayerAvatar } from '@/services/storageService';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config, { PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import LocationPicker, { LocationData } from '@/components/ui/LocationPicker';
import { SectionCard, StepIndicator } from '@/components/ui/FormSectionCard';

const levels = ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert'] as const;

export default function EditPlayerScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getPlayerById, updatePlayer, deletePlayer, clubs, terrains, matches, loading: appLoading } = useApp();
  const { t } = useLanguage();

  const player = getPlayerById(id!);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [role, setRole] = useState<PlayerRole>('Milieu');
  const [level, setLevel] = useState<typeof levels[number]>('Intermédiaire');
  const [clubId, setClubId] = useState<string | undefined>();
  const [location, setLocation] = useState<LocationData>({
    address: '',
    city: '',
    country: 'France',
    latitude: 0,
    longitude: 0,
  });
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  // Handedness
  const [handedness, setHandedness] = useState<'right' | 'left' | 'ambidextrous' | ''>('');
  // Terrain
  const [terrainId, setTerrainId] = useState<string | undefined>();
  const [terrainName, setTerrainName] = useState('');

  // Boules info
  const [boulesName, setBoulesName] = useState('');
  const [boulesDiameter, setBoulesDiameter] = useState('');
  const [boulesWeight, setBoulesWeight] = useState('');

  useEffect(() => {
    if (player) {
      setName(player.name);
      setNickname(player.nickname || '');
      setAvatarUri(player.avatar || null);
      setRole(player.role);
      setLevel(player.level);
      setClubId(player.clubId);
      setLocation({
        address: '',
        city: player.location?.city || '',
        country: player.country || 'France',
        latitude: player.location?.latitude || 0,
        longitude: player.location?.longitude || 0,
      });
      setPhone(player.phone || '');
      setEmail(player.email || '');
      setHandedness(player.handedness || '');
      // Terrain
      setTerrainId(player.terrainId);
      setTerrainName(player.terrainName || '');
      // Boules
      setBoulesName(player.boules?.name || '');
      setBoulesDiameter(player.boules?.diameter?.toString() || '');
      setBoulesWeight(player.boules?.weight?.toString() || '');
    }
  }, [player]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('player', 'permissionRequired'), t('player', 'permissionPhotos'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
        setAvatarChanged(true);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Alert.alert(t('common', 'error'), t('player', 'errorSelectPhoto'));
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('player', 'permissionRequired'), t('player', 'permissionCamera'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarUri(result.assets[0].uri);
        setAvatarChanged(true);
      }
    } catch (error) {
      console.log('Error taking photo:', error);
      Alert.alert(t('common', 'error'), t('player', 'errorTakePhoto'));
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      t('player', 'profilePhoto'),
      t('player', 'chooseOption'),
      [
        { text: t('player', 'takePhoto'), onPress: takePhoto },
        { text: t('player', 'chooseFromGallery'), onPress: pickImage },
        ...(avatarUri ? [{ text: t('player', 'removeLabel'), style: 'destructive' as const, onPress: () => { setAvatarUri(null); setAvatarChanged(true); } }] : []),
        { text: t('common', 'cancel'), style: 'cancel' as const },
      ]
    );
  };

  const uploadAvatar = async (): Promise<string | undefined> => {
    if (!avatarChanged) return player?.avatar;
    if (!avatarUri) return undefined;
    // If it's already a URL (not changed), return it
    if (avatarUri.startsWith('http')) return avatarUri;

    try {
      setUploadingAvatar(true);
      const url = await uploadPlayerAvatar(id || 'unknown', avatarUri);
      return url || player?.avatar;
    } catch (error) {
      console.log('Error uploading avatar:', error);
      return player?.avatar;
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Preferred role analysis (read-only)
  const roleIcons: Record<string, { icon: string; color: string }> = {
    'Pointeur': { icon: 'radio-button-on', color: '#3B82F6' },
    'Milieu': { icon: 'swap-horiz', color: '#8B5CF6' },
    'Tireur': { icon: 'gps-fixed', color: '#F97316' },
  };

  const roleAnalysis = useMemo(() => {
    if (!id) return { roleCounts: {} as Record<string, number>, totalWithRoles: 0, preferredRole: '' };
    const roleCounts: Record<string, number> = { 'Pointeur': 0, 'Milieu': 0, 'Tireur': 0 };
    const allMatches = matches.filter(m =>
      m.teamA.players.includes(id) || m.teamB.players.includes(id)
    );
    allMatches.forEach(match => {
      if (match.teamA.players.includes(id) && match.teamA.playerRoles) {
        const pr = match.teamA.playerRoles.find(r => r.playerId === id);
        if (pr && roleCounts[pr.role] !== undefined) roleCounts[pr.role]++;
      }
      if (match.teamB.players.includes(id) && match.teamB.playerRoles) {
        const pr = match.teamB.playerRoles.find(r => r.playerId === id);
        if (pr && roleCounts[pr.role] !== undefined) roleCounts[pr.role]++;
      }
    });
    const totalWithRoles = Object.values(roleCounts).reduce((a, b) => a + b, 0);
    const preferredRole = totalWithRoles > 0
      ? Object.entries(roleCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0]
      : '';
    return { roleCounts, totalWithRoles, preferredRole };
  }, [matches, id]);

  // Preferred terrain analysis (read-only)
  const terrainTypeIcons: Record<string, { icon: string; color: string }> = {
    'Stabilisé': { icon: 'landscape', color: '#6B7280' },
    'Graviers': { icon: 'grain', color: '#92400E' },
    'Sable': { icon: 'beach-access', color: '#D97706' },
    'Cailloux': { icon: 'terrain', color: '#6D28D9' },
    'Terre battue': { icon: 'grass', color: '#15803D' },
  };

  const terrainAnalysis = useMemo(() => {
    if (!id) return { terrainCounts: {} as Record<string, number>, totalWithTerrain: 0, preferredTerrain: '' };
    const terrainCounts: Record<string, number> = {};
    const allMatches = matches.filter(m =>
      m.teamA.players.includes(id) || m.teamB.players.includes(id)
    );
    allMatches.forEach(match => {
      if (match.terrainType) {
        terrainCounts[match.terrainType] = (terrainCounts[match.terrainType] || 0) + 1;
      }
    });
    const totalWithTerrain = Object.values(terrainCounts).reduce((a, b) => a + b, 0);
    const preferredTerrain = totalWithTerrain > 0
      ? Object.entries(terrainCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0]
      : '';
    return { terrainCounts, totalWithTerrain, preferredTerrain };
  }, [matches, id]);

  // Preferred partner analysis (read-only)
  const partnerColors = ['#3B82F6', '#8B5CF6', '#F97316', '#10B981', '#EC4899'];

  const partnerAnalysis = useMemo(() => {
    if (!id) return { partnerCounts: {} as Record<string, { count: number; name: string }>, totalWithPartners: 0, preferredPartner: { id: '', name: '', count: 0 } };
    const partnerCounts: Record<string, { count: number; name: string }> = {};
    const allMatches = matches.filter(m =>
      m.teamA.players.includes(id) || m.teamB.players.includes(id)
    );
    allMatches.forEach(match => {
      const inTeamA = match.teamA.players.includes(id);
      const inTeamB = match.teamB.players.includes(id);
      if (inTeamA && match.teamA.players.length > 1) {
        match.teamA.players.forEach((pid, idx) => {
          if (pid !== id) {
            if (!partnerCounts[pid]) partnerCounts[pid] = { count: 0, name: match.teamA.playerNames[idx] || pid };
            partnerCounts[pid].count++;
          }
        });
      } else if (inTeamB && match.teamB.players.length > 1) {
        match.teamB.players.forEach((pid, idx) => {
          if (pid !== id) {
            if (!partnerCounts[pid]) partnerCounts[pid] = { count: 0, name: match.teamB.playerNames[idx] || pid };
            partnerCounts[pid].count++;
          }
        });
      }
    });
    const totalWithPartners = Object.values(partnerCounts).reduce((a, b) => a + b.count, 0);
    let preferredPartner = { id: '', name: '', count: 0 };
    if (totalWithPartners > 0) {
      const best = Object.entries(partnerCounts).reduce((a, b) => b[1].count > a[1].count ? b : a);
      preferredPartner = { id: best[0], name: best[1].name, count: best[1].count };
    }
    return { partnerCounts, totalWithPartners, preferredPartner };
  }, [matches, id]);

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('player', 'editPlayer')}</Text>
          <View style={{ width: 40 }} />
        </View>
        {appLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.textSecondary }}>{t('player', 'playerNotFound')}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common', 'error'), t('player', 'nameIsRequired'));
      return;
    }

    const selectedClub = clubs.find(c => c.id === clubId);

    // Upload avatar if changed
    const avatarUrl = await uploadAvatar();

    // Build boules object
    const boules = (boulesName.trim() || boulesDiameter || boulesWeight) ? {
      name: boulesName.trim() || undefined,
      diameter: boulesDiameter ? parseInt(boulesDiameter) : undefined,
      weight: boulesWeight ? parseInt(boulesWeight) : undefined,
    } : undefined;

    const selectedTerrain = terrains.find(t => t.id === terrainId);

    updatePlayer(id!, {
      name: name.trim(),
      nickname: nickname.trim() || null,
      avatar: avatarUrl,
      role,
      level,
      clubId: clubId || null,
      club: selectedClub?.name || null,
      terrainId: terrainId || null,
      terrainName: selectedTerrain?.name || terrainName || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      handedness: handedness || null,
      boules,
      location: location.city ? {
        city: location.city,
        latitude: location.latitude,
        longitude: location.longitude,
      } : undefined,
      country: location.country || 'France',
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      t('player', 'deletePlayer'),
      t('player', 'deleteIrreversibleConfirm'),
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: () => {
            deletePlayer(id!);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.replace('/(tabs)/directory');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('player', 'editPlayer')}</Text>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <MaterialIcons name="delete" size={24} color={theme.error} />
        </Pressable>
      </View>

      <StepIndicator step={name.trim() ? 3 : 1} total={3} label={name.trim() ? t('tournament', 'readyToCreate') : t('player', 'nameIsRequired')} />

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
          {/* Avatar Preview */}
          <Animated.View entering={FadeInDown.duration(400)} style={styles.avatarSection}>
            <Pressable style={styles.avatarContainer} onPress={showImageOptions} disabled={uploadingAvatar}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {name.split(' ').map(n => n[0] || '').join('').toUpperCase().slice(0, 2) || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <MaterialIcons name="camera-alt" size={16} color="#FFF" />
                )}
              </View>
            </Pressable>
            <Text style={styles.avatarHint}>{t('player', 'tapToEditPhoto')}</Text>
          </Animated.View>

          {/* Name */}
          <SectionCard title={t('player', 'nameLabel')} icon="person" color={theme.primary} delay={50} required>
            <TextInput style={styles.textInput} value={name} onChangeText={setName} placeholder={t('player', 'namePlaceholder')} placeholderTextColor={theme.textMuted} autoCapitalize="words" />
            <TextInput style={[styles.textInput, { marginTop: 10 }]} value={nickname} onChangeText={setNickname} placeholder={t('player', 'nicknamePlaceholder')} placeholderTextColor={theme.textMuted} />
          </SectionCard>

          {/* Role */}
          <SectionCard title={t('player', 'roleLabel')} icon="sports" color={theme.tirColor} delay={100} required>
            <View style={styles.optionsContainer}>
              {config.playerRoles.map(r => {
                const cfg = { 'Tireur': { icon: 'gps-fixed', color: '#EF4444' }, 'Pointeur': { icon: 'radio-button-on', color: '#10B981' }, 'Milieu': { icon: 'swap-horiz', color: '#3B82F6' } }[r] || { icon: 'sports', color: theme.primary };
                const isActive = role === r;
                return (
                  <Pressable key={r} style={[styles.optionButton, isActive && { borderColor: cfg.color, backgroundColor: cfg.color + '08' }]} onPress={() => { Haptics.selectionAsync(); setRole(r); }}>
                    <View style={[styles.optionIconBox, isActive && { backgroundColor: cfg.color }]}>
                      <MaterialIcons name={cfg.icon as any} size={22} color={isActive ? '#FFF' : theme.textSecondary} />
                    </View>
                    <Text style={[styles.optionText, isActive && { color: cfg.color }]}>{t('roles', r)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* Level */}
          <SectionCard title={t('player', 'levelLabel')} icon="signal-cellular-alt" color={theme.success} delay={150}>
            <View style={styles.levelContainer}>
              {levels.map(l => (
                <Pressable key={l} style={[styles.levelChip, level === l && styles.levelChipActive]} onPress={() => { Haptics.selectionAsync(); setLevel(l); }}>
                  <Text style={[styles.levelText, level === l && styles.levelTextActive]}>{t('levels', l)}</Text>
                </Pressable>
              ))}
            </View>
          </SectionCard>

          {/* Club */}
          <SectionCard title={t('player', 'clubLabel')} icon="home-work" color={theme.accent} delay={200}>
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
                  {t('player', 'noClub')}
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
          </SectionCard>

          {/* Terrain */}
          <SectionCard title={t('player', 'terrainLabel')} icon="place" color={theme.success} delay={250}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.clubsScroll}
            >
              <Pressable
                style={[
                  styles.terrainChip,
                  !terrainId && styles.terrainChipActive
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTerrainId(undefined);
                  setTerrainName('');
                }}
              >
                <Text style={[
                  styles.clubChipText,
                  !terrainId && styles.terrainChipTextActive
                ]}>
                  {t('player', 'noTerrain')}
                </Text>
              </Pressable>
              {terrains.map(terr => (
                <Pressable
                  key={terr.id}
                  style={[
                    styles.terrainChip,
                    terrainId === terr.id && styles.terrainChipActive
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTerrainId(terr.id);
                    setTerrainName(terr.name);
                  }}
                >
                  <MaterialIcons 
                    name="sports-soccer" 
                    size={14} 
                    color={terrainId === terr.id ? theme.success : theme.textMuted} 
                  />
                  <Text style={[
                    styles.clubChipText,
                    terrainId === terr.id && styles.terrainChipTextActive
                  ]} numberOfLines={1}>
                    {terr.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </SectionCard>

          {/* Location */}
          <SectionCard title={t('player', 'locationLabel')} icon="my-location" color={theme.primaryLight} delay={300}>
            <LocationPicker
              label={t('player', 'locationLabel')}
              value={location}
              onChange={setLocation}
              placeholder={t('player', 'searchCity')}
              showCityOnly
            />
            {/* Auto-fill location from terrain/club */}
            {(() => {
              const locationEmpty = !location.latitude && !location.longitude;
              if (!locationEmpty) return null;
              const suggestions: { label: string; icon: string; color: string; city: string; lat: number; lng: number; address?: string; country?: string }[] = [];
              if (terrainId) {
                const tr = terrains.find(te => te.id === terrainId);
                if (tr && tr.location && (tr.location.latitude || tr.location.longitude)) {
                  suggestions.push({ label: t('profile', 'useTerrainLocation'), icon: 'sports-soccer', color: theme.success, city: tr.city, lat: tr.location.latitude, lng: tr.location.longitude, address: tr.address, country: tr.country });
                }
              }
              if (clubId) {
                const cl = clubs.find(c => c.id === clubId);
                if (cl && cl.location && (cl.location.latitude || cl.location.longitude)) {
                  suggestions.push({ label: t('profile', 'useClubLocation'), icon: 'home', color: theme.accent, city: cl.city, lat: cl.location.latitude, lng: cl.location.longitude, address: cl.address, country: cl.country });
                }
              }
              if (suggestions.length === 0) return null;
              return suggestions.map((sug, idx) => (
                <Pressable
                  key={idx}
                  style={styles.autoFillLocationBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setLocation({
                      address: sug.address || '',
                      city: sug.city || '',
                      country: sug.country || 'France',
                      latitude: sug.lat,
                      longitude: sug.lng,
                    });
                  }}
                >
                  <View style={[styles.autoFillLocationIcon, { backgroundColor: sug.color + '15' }]}>
                    <MaterialIcons name={sug.icon as any} size={16} color={sug.color} />
                  </View>
                  <Text style={styles.autoFillLocationText} numberOfLines={1}>{sug.label}</Text>
                  <View style={styles.autoFillLocationArrow}>
                    <MaterialIcons name="my-location" size={16} color={theme.primary} />
                  </View>
                </Pressable>
              ));
            })()}
          </SectionCard>

          {/* Contact Info */}
          <SectionCard title={t('player', 'contactLabel')} icon="contacts" color={theme.textSecondary} delay={350}>
            <View style={styles.contactInputs}>
              <View style={styles.contactInputContainer}>
                <MaterialIcons name="phone" size={20} color={theme.textSecondary} style={styles.contactIcon} />
                <TextInput
                  style={styles.contactInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder={t('player', 'phonePlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.contactInputContainer}>
                <MaterialIcons name="email" size={20} color={theme.textSecondary} style={styles.contactIcon} />
                <TextInput
                  style={styles.contactInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('player', 'emailPlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </SectionCard>

          {/* Handedness */}
          <SectionCard title={t('player', 'handedness')} icon="front-hand" color="#6366F1" delay={360}>
            <View style={styles.optionsContainer}>
              {([{ id: 'right' as const, icon: 'back-hand', label: t('player', 'rightHanded') }, { id: 'left' as const, icon: 'front-hand', label: t('player', 'leftHanded') }, { id: 'ambidextrous' as const, icon: 'swap-horiz', label: t('player', 'ambidextrous') }]).map(h => (
                <Pressable
                  key={h.id}
                  style={[
                    styles.optionButton,
                    handedness === h.id && { backgroundColor: '#6366F1' }
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHandedness(handedness === h.id ? '' : h.id);
                  }}
                >
                  <MaterialIcons 
                    name={h.icon as any} 
                    size={20} 
                    color={handedness === h.id ? '#FFF' : theme.textSecondary} 
                  />
                  <Text style={[
                    styles.optionText,
                    handedness === h.id && styles.optionTextActive
                  ]}>
                    {h.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </SectionCard>

          {/* Boules Section */}
          <SectionCard title={t('player', 'boulesLabel')} icon="sports-baseball" color="#D97706" delay={370}>
              <TextInput
                style={[styles.textInput, { marginBottom: 12 }]}
                value={boulesName}
                onChangeText={setBoulesName}
                placeholder={t('player', 'boulesPlaceholder')}
                placeholderTextColor={theme.textMuted}
              />
              <View style={styles.boulesSpecsRow}>
                <View style={styles.boulesSpecInput}>
                  <Text style={styles.boulesSpecLabel}>{t('player', 'diameterLabel')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={boulesDiameter}
                    onChangeText={setBoulesDiameter}
                    placeholder="Ex: 74"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.boulesSpecInput}>
                  <Text style={styles.boulesSpecLabel}>{t('player', 'weightLabel')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={boulesWeight}
                    onChangeText={setBoulesWeight}
                    placeholder="Ex: 700"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>
          </SectionCard>

          {/* Preferred Role (read-only) */}
          {roleAnalysis.totalWithRoles > 0 && (
            <Animated.View entering={FadeInDown.duration(400).delay(380)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('player', 'preferredRole')}</Text>
              <View style={styles.readOnlyCard}>
                <View style={styles.readOnlyHeader}>
                  <View style={[styles.readOnlyIcon, { backgroundColor: roleIcons[roleAnalysis.preferredRole]?.color || theme.primary }]}>
                    <MaterialIcons name={(roleIcons[roleAnalysis.preferredRole]?.icon || 'person') as any} size={18} color="#FFF" />
                  </View>
                  <View style={styles.readOnlyInfo}>
                    <Text style={styles.readOnlyName}>{t('roles', roleAnalysis.preferredRole)}</Text>
                    <Text style={styles.readOnlyStats}>
                      {roleAnalysis.roleCounts[roleAnalysis.preferredRole]} {t('player', 'outOf')} {roleAnalysis.totalWithRoles} {t('player', 'matchesLabel')}
                    </Text>
                  </View>
                </View>
                <View style={styles.readOnlyBreakdown}>
                  {Object.entries(roleAnalysis.roleCounts).map(([r, count]) => {
                    const cfg = roleIcons[r];
                    const pct = roleAnalysis.totalWithRoles > 0 ? Math.round((count / roleAnalysis.totalWithRoles) * 100) : 0;
                    return (
                      <View key={r} style={styles.readOnlyBreakdownItem}>
                        <MaterialIcons name={(cfg?.icon || 'person') as any} size={12} color={cfg?.color || theme.textMuted} />
                        <Text style={styles.readOnlyBreakdownLabel}>{r.charAt(0)}</Text>
                        <View style={styles.readOnlyBarBg}>
                          <View style={[styles.readOnlyBar, { width: `${pct}%`, backgroundColor: cfg?.color || theme.primary }]} />
                        </View>
                        <Text style={styles.readOnlyBreakdownPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.readOnlyNotice}>
                  <MaterialIcons name="info-outline" size={12} color={theme.textMuted} />
                  <Text style={styles.readOnlyNoticeText}>{t('player', 'statsAutoCalculated')}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Preferred Terrain (read-only) */}
          {terrainAnalysis.totalWithTerrain > 0 && (
            <Animated.View entering={FadeInDown.duration(400).delay(390)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('player', 'preferredTerrain')}</Text>
              <View style={styles.readOnlyCard}>
                <View style={styles.readOnlyHeader}>
                  <View style={[styles.readOnlyIcon, { backgroundColor: terrainTypeIcons[terrainAnalysis.preferredTerrain]?.color || theme.primary }]}>
                    <MaterialIcons name={(terrainTypeIcons[terrainAnalysis.preferredTerrain]?.icon || 'sports-soccer') as any} size={18} color="#FFF" />
                  </View>
                  <View style={styles.readOnlyInfo}>
                    <Text style={styles.readOnlyName}>{t('terrainTypes', terrainAnalysis.preferredTerrain)}</Text>
                    <Text style={styles.readOnlyStats}>
                      {terrainAnalysis.terrainCounts[terrainAnalysis.preferredTerrain]} {t('player', 'outOf')} {terrainAnalysis.totalWithTerrain} {t('player', 'matchesLabel')}
                    </Text>
                  </View>
                </View>
                <View style={styles.readOnlyBreakdown}>
                  {Object.entries(terrainAnalysis.terrainCounts).map(([terrainType, count]) => {
                    const cfg = terrainTypeIcons[terrainType];
                    const pct = terrainAnalysis.totalWithTerrain > 0 ? Math.round((count / terrainAnalysis.totalWithTerrain) * 100) : 0;
                    return (
                      <View key={terrainType} style={styles.readOnlyBreakdownItem}>
                        <MaterialIcons name={(cfg?.icon || 'sports-soccer') as any} size={12} color={cfg?.color || theme.textMuted} />
                        <Text style={[styles.readOnlyBreakdownLabel, { width: 18 }]}>{terrainType.substring(0, 2)}</Text>
                        <View style={styles.readOnlyBarBg}>
                          <View style={[styles.readOnlyBar, { width: `${pct}%`, backgroundColor: cfg?.color || theme.primary }]} />
                        </View>
                        <Text style={styles.readOnlyBreakdownPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.readOnlyNotice}>
                  <MaterialIcons name="info-outline" size={12} color={theme.textMuted} />
                  <Text style={styles.readOnlyNoticeText}>{t('player', 'statsAutoCalculated')}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Preferred Partner (read-only) */}
          {partnerAnalysis.totalWithPartners > 0 && (
            <Animated.View entering={FadeInDown.duration(400).delay(395)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('player', 'preferredPartner')}</Text>
              <View style={styles.readOnlyCard}>
                <View style={styles.readOnlyHeader}>
                  <View style={[styles.readOnlyIcon, { backgroundColor: partnerColors[0] }]}>
                    <MaterialIcons name="people" size={18} color="#FFF" />
                  </View>
                  <View style={styles.readOnlyInfo}>
                    <Text style={styles.readOnlyName}>{partnerAnalysis.preferredPartner.name}</Text>
                    <Text style={styles.readOnlyStats}>
                      {partnerAnalysis.preferredPartner.count} {t('player', 'outOf')} {partnerAnalysis.totalWithPartners} {t('player', 'matchesLabel')}
                    </Text>
                  </View>
                </View>
                <View style={styles.readOnlyPartnerList}>
                  {Object.entries(partnerAnalysis.partnerCounts)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 5)
                    .map(([pid, info], idx) => {
                      const pct = partnerAnalysis.totalWithPartners > 0 ? Math.round((info.count / partnerAnalysis.totalWithPartners) * 100) : 0;
                      const color = partnerColors[idx % partnerColors.length];
                      return (
                        <View key={pid} style={styles.readOnlyPartnerItem}>
                          <View style={[styles.readOnlyPartnerAvatar, { backgroundColor: color + '20' }]}>
                            <Text style={[styles.readOnlyPartnerAvatarText, { color }]}>{info.name.charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={styles.readOnlyPartnerInfo}>
                            <Text style={styles.readOnlyPartnerName} numberOfLines={1}>{info.name}</Text>
                            <View style={styles.readOnlyPartnerBarRow}>
                              <View style={styles.readOnlyBarBg}>
                                <View style={[styles.readOnlyBar, { width: `${pct}%`, backgroundColor: color }]} />
                              </View>
                              <Text style={styles.readOnlyPartnerPct}>{info.count} ({pct}%)</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                </View>
                <View style={styles.readOnlyNotice}>
                  <MaterialIcons name="info-outline" size={12} color={theme.textMuted} />
                  <Text style={styles.readOnlyNoticeText}>{t('player', 'statsAutoCalculated')}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Stats Preview */}
          <SectionCard title={t('player', 'statistics')} icon="bar-chart" color={theme.primary} delay={400}>
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t('player', 'matchesPlayed')}</Text>
                <Text style={styles.statValue}>{player.stats.matchesPlayed}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t('player', 'victories')}</Text>
                <Text style={[styles.statValue, { color: theme.success }]}>{player.stats.wins}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{t('player', 'defeats')}</Text>
                <Text style={[styles.statValue, { color: theme.error }]}>{player.stats.losses}</Text>
              </View>
              <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.statLabel}>{t('player', 'winRate')}</Text>
                <Text style={[styles.statValue, { color: theme.primary }]}>{player.stats.winRate}%</Text>
              </View>
            </View>
            <Text style={styles.statsNote}>
              {t('player', 'statsAutoCalculated')}
            </Text>
          </SectionCard>
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable 
            style={[styles.saveButton, uploadingAvatar && styles.saveButtonDisabled]} 
            onPress={handleSave}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <MaterialIcons name="check" size={24} color="#FFF" />
            )}
            <Text style={styles.saveButtonText}>
              {uploadingAvatar ? t('player', 'saving') : t('player', 'savePlayer')}
            </Text>
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
  deleteButton: {
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
    paddingTop: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.backgroundSecondary,
  },
  avatarHint: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: theme.textMuted,
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
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: theme.borderRadius.md,
    fontSize: 15,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.textMuted + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  optionTextActive: {
    color: '#FFF',
  },
  levelContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  levelChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  levelChipActive: {
    borderColor: theme.success,
    backgroundColor: theme.success + '08',
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  levelTextActive: {
    color: theme.success,
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
    borderColor: theme.accent,
    backgroundColor: theme.accent + '10',
  },
  clubChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  clubChipTextActive: {
    color: theme.accent,
  },
  terrainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    maxWidth: 200,
    ...theme.shadows.card,
  },
  terrainChipActive: {
    borderColor: theme.success,
    backgroundColor: theme.success + '10',
  },
  terrainChipTextActive: {
    color: theme.success,
  },
  contactInputs: {
    gap: 12,
  },
  contactInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    ...theme.shadows.card,
  },
  contactIcon: {
    marginRight: 10,
  },
  contactInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.textPrimary,
  },
  statsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    ...theme.shadows.card,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  statLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  statsNote: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  boulesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 16,
    ...theme.shadows.card,
  },
  boulesSpecsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  boulesSpecInput: {
    flex: 1,
  },
  boulesSpecLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.cardElevated,
  },
  saveButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  // Read-only analysis cards
  readOnlyCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadows.card,
  },
  readOnlyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  readOnlyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyInfo: {
    flex: 1,
  },
  readOnlyName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  readOnlyStats: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  readOnlyBreakdown: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  readOnlyBreakdownItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.backgroundSecondary,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.md,
  },
  readOnlyBreakdownLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    width: 12,
  },
  readOnlyBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  readOnlyBar: {
    height: '100%',
    borderRadius: 2,
  },
  readOnlyBreakdownPct: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textPrimary,
    minWidth: 28,
    textAlign: 'right',
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  readOnlyNoticeText: {
    fontSize: 11,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  readOnlyPartnerList: {
    gap: 8,
    marginBottom: 10,
  },
  readOnlyPartnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.backgroundSecondary,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.md,
  },
  readOnlyPartnerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyPartnerAvatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  readOnlyPartnerInfo: {
    flex: 1,
    gap: 4,
  },
  readOnlyPartnerName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  readOnlyPartnerBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readOnlyPartnerPct: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
  autoFillLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '08',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.primary + '20',
    borderStyle: 'dashed',
    gap: 10,
  },
  autoFillLocationIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoFillLocationText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  autoFillLocationArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
