import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  Modal,
  Switch,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Linking2 from 'expo-linking';
import { decode } from 'base64-arraybuffer';
import { getSupabaseClient } from '@/template';
import theme, { blurhash } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import ShareModal from '@/components/ui/ShareModal';
import ModificationLogsSection from '@/components/ui/ModificationLogsSection';
import SharedBadge from '@/components/ui/SharedBadge';
import MergePickerModal from '@/components/ui/MergePickerModal';
import { isSharedWithMe, saveSharedItemToMyAccount } from '@/services/shareService';
import { toggleItemPublic } from '@/services/publicItemsService';
import { useAlert } from '@/template';
import { useAuth } from '@/template';

export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getClubById, players, tournaments, deleteClub, updateClub, getSharedPermission, setItemPublic, isFavoriteClub, toggleFavoriteClub, refreshData, loading: appLoading } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);
  const [screenWidth, setScreenWidth] = React.useState(() => Dimensions.get('window').width);
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: any) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const { terrains: allTerrains } = useApp();
  const club = getClubById(id!);
  const clubPlayers = players.filter(p => p.clubId === id);
  const clubTournaments = tournaments.filter(tr => tr.clubId === id);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [isShared, setIsShared] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPublicState, setIsPublicState] = React.useState(false);
  const [togglingPublic, setTogglingPublic] = React.useState(false);
  const { showAlert } = useAlert();
  const [showMergePicker, setShowMergePicker] = React.useState(false);
  const [showPublicPreview, setShowPublicPreview] = React.useState(false);
  const [showSharePreview, setShowSharePreview] = React.useState(false);
  const [previewShowContacts, setPreviewShowContacts] = React.useState(false);
  const sharedPermission = getSharedPermission(id!);
  const isSharedItem = sharedPermission !== null;
  const isReadOnly = sharedPermission === 'read';
  const canEdit = !isReadOnly;
  const supabase = getSupabaseClient();

  // Club card state
  const [clubCardUrl, setClubCardUrl] = React.useState<string | null>(null);
  const [clubCardType, setClubCardType] = React.useState<'image' | 'pdf'>('image');
  const [uploadingCard, setUploadingCard] = React.useState(false);
  const [showCardFullscreen, setShowCardFullscreen] = React.useState(false);
  const [screenWidth2, setScreenWidth2] = React.useState(() => Dimensions.get('window').width);

  const isFavorite = id ? isFavoriteClub(id) : false;

  const handleToggleFavorite = () => {
    if (id) {
      toggleFavoriteClub(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  React.useEffect(() => {
    if (id) {
      isSharedWithMe('club', id).then(setIsShared);
    }
  }, [id]);

  React.useEffect(() => {
    if (club) setIsPublicState(club.isPublic ?? false);
  }, [club?.id, club?.isPublic]);

  // Load club card URL
  React.useEffect(() => {
    if (club?.clubCardUrl) {
      setClubCardUrl(club.clubCardUrl);
      setClubCardType(club.clubCardUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
    } else {
      setClubCardUrl(null);
    }
  }, [club?.clubCardUrl]);

  // Club card upload helpers
  const uploadClubCardFile = React.useCallback(async (fileUri: string, fileName: string, mimeType: string) => {
    if (!club || !user) return;
    setUploadingCard(true);
    try {
      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `${user.id}/${club.id}_card_${Date.now()}.${fileExt}`;
      let base64Data: string;
      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => { const result = reader.result as string; resolve(result.split(',')[1]); };
          reader.readAsDataURL(blob);
        });
      } else {
        base64Data = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
      }
      const { error: uploadError } = await supabase.storage.from('club-cards').upload(storagePath, decode(base64Data), { contentType: mimeType, upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('club-cards').getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;
      await updateClub(club.id, { clubCardUrl: publicUrl } as any);
      setClubCardUrl(publicUrl);
      setClubCardType(fileExt === 'pdf' ? 'pdf' : 'image');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('common', 'success'), t('club', 'clubCardUpdated'));
    } catch (error: any) {
      console.log('Error uploading club card:', error);
      showAlert(t('common', 'error'), error.message || t('club', 'errorUploadClubCard'));
    } finally {
      setUploadingCard(false);
    }
  }, [club, user, supabase, updateClub, showAlert, t]);

  const showClubCardUploadOptions = React.useCallback(() => {
    Alert.alert(
      t('club', 'clubCardLabel'), t('club', 'clubCardDesc'),
      [
        { text: t('player', 'fromCamera'), onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { showAlert(t('profile', 'permissionRequired'), t('profile', 'cameraPermission')); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
          if (!result.canceled && result.assets[0]) {
            const ext = result.assets[0].uri.split('.').pop()?.toLowerCase() || 'jpg';
            await uploadClubCardFile(result.assets[0].uri, `club_card.${ext}`, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
          }
        }},
        { text: t('player', 'fromGallery'), onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { showAlert(t('profile', 'permissionRequired'), t('profile', 'galleryPermission')); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
          if (!result.canceled && result.assets[0]) {
            const ext = result.assets[0].uri.split('.').pop()?.toLowerCase() || 'jpg';
            await uploadClubCardFile(result.assets[0].uri, `club_card.${ext}`, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
          }
        }},
        { text: t('player', 'fromFiles'), onPress: async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
            if (!result.canceled && result.assets && result.assets[0]) {
              await uploadClubCardFile(result.assets[0].uri, result.assets[0].name || 'club_card.pdf', result.assets[0].mimeType || 'application/pdf');
            }
          } catch (e) { console.log('Error picking document:', e); }
        }},
        { text: t('common', 'cancel'), style: 'cancel' },
      ]
    );
  }, [t, uploadClubCardFile, showAlert]);

  const handleRemoveClubCard = React.useCallback(() => {
    Alert.alert(t('club', 'removeClubCard'), '', [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('common', 'delete'), style: 'destructive', onPress: async () => {
        if (!club) return;
        try {
          await updateClub(club.id, { clubCardUrl: undefined } as any);
          setClubCardUrl(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showAlert(t('common', 'success'), t('club', 'clubCardRemoved'));
        } catch (e: any) { showAlert(t('common', 'error'), e.message); }
      }},
    ]);
  }, [club, updateClub, showAlert, t]);

  const handleOpenPublicPreview = React.useCallback(() => {
    if (!club || togglingPublic || isSharedItem) return;
    Haptics.selectionAsync();
    setPreviewShowContacts(club.showContactPublic ?? false);
    setShowPublicPreview(true);
  }, [club, togglingPublic, isSharedItem]);

  const handleConfirmPublic = React.useCallback(async () => {
    if (!club) return;
    setTogglingPublic(true);
    Haptics.selectionAsync();
    const newVal = !isPublicState;
    const { error } = await toggleItemPublic('clubs', club.id, newVal);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      setIsPublicState(newVal);
      setItemPublic('clubs', club.id, newVal);
      await updateClub(club.id, { showContactPublic: previewShowContacts } as any);
    }
    setTogglingPublic(false);
    setShowPublicPreview(false);
  }, [club, isPublicState, togglingPublic, previewShowContacts, showAlert, t, updateClub]);

  const handleOpenSharePreview = React.useCallback(() => {
    if (!club) return;
    Haptics.selectionAsync();
    setPreviewShowContacts(club.showContactPublic ?? false);
    setShowSharePreview(true);
  }, [club]);

  const handleConfirmShare = React.useCallback(async () => {
    if (!club) return;
    await updateClub(club.id, { showContactPublic: previewShowContacts } as any);
    setShowSharePreview(false);
    setShowShareModal(true);
  }, [club, previewShowContacts, updateClub]);

  const handleDelete = () => {
    Alert.alert(
      t('club', 'deleteClub'),
      `${t('club', 'deleteConfirm')} "${club?.name}" ? ${t('club', 'deleteLinkedTerrains')}`,
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: async () => {
            if (club) {
              await deleteClub(club.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (!club) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('club', 'clubLabel')}</Text>
          <View style={{ width: 40 }} />
        </View>
        {appLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.textSecondary }}>{t('club', 'clubNotFound')}</Text>
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
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('club', 'clubLabel')}</Text>
        <View style={styles.headerActions}>
          {isShared && (
            <Pressable
              style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
              onPress={async () => {
                setIsSaving(true);
                const { newItemId, error } = await saveSharedItemToMyAccount('club', id!);
                setIsSaving(false);
                if (error) {
                  showAlert(t('common', 'error'), error);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showAlert(t('club', 'savedLabel'), t('club', 'clubCopied'));
                  if (newItemId) router.replace(`/club/${newItemId}` as any);
                }
              }}
              disabled={isSaving}
            >
              <MaterialIcons name="save-alt" size={22} color={theme.accent} />
            </Pressable>
          )}
          <Pressable style={styles.shareButton} onPress={handleOpenSharePreview}>
            <MaterialIcons name="share" size={22} color={theme.success} />
          </Pressable>
          {canEdit && (
            <Pressable style={styles.editButton} onPress={() => setShowMergePicker(true)}>
              <MaterialIcons name="compare-arrows" size={22} color={theme.accent} />
            </Pressable>
          )}
          <Pressable 
            style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]} 
            onPress={handleToggleFavorite}
          >
            <MaterialIcons 
              name={isFavorite ? 'favorite' : 'favorite-border'} 
              size={22} 
              color={isFavorite ? theme.error : theme.textSecondary} 
            />
          </Pressable>
          {canEdit && (
            <Pressable 
              style={styles.editButton} 
              onPress={() => router.push(`/club/edit/${id}`)}
            >
              <MaterialIcons name="edit" size={22} color={theme.primary} />
            </Pressable>
          )}
          {canEdit && !isSharedItem && (
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <MaterialIcons name="delete" size={22} color={theme.error} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }, isTablet && styles.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Club Card */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.clubCard, isTablet && styles.clubCardTablet]}>
          <View style={styles.clubIcon}>
            <MaterialIcons name="home" size={48} color="#FFF" />
          </View>
          <Text style={styles.clubName}>{club.name}</Text>
          {sharedPermission ? (
            <View style={{ marginBottom: 8 }}>
              <SharedBadge permission={sharedPermission} />
            </View>
          ) : null}
          <View style={styles.clubMeta}>
            <MaterialIcons name="place" size={16} color={theme.textSecondary} />
            <Text style={styles.clubMetaText}>{club.address ? `${club.address}, ` : ''}{club.city}</Text>
          </View>
          {club.description ? <Text style={styles.clubDescription}>{club.description}</Text> : null}

          {/* Facilities inline */}
          {club.facilities && club.facilities.length > 0 ? (
            <View style={styles.inlineFacilitiesSection}>
              <View style={styles.facilitiesGridInline}>
                {club.facilities.map((facility, index) => (
                  <View key={index} style={styles.facilityTagInline}>
                    <MaterialIcons name="check-circle" size={14} color={theme.success} />
                    <Text style={styles.facilityTextInline}>{t('facilityLabels', facility) || facility}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Contact inline */}
          {(club.contactEmail || club.contactPhone) && !isSharedItem && (club.showContactPublic !== false || !club.isPublic) ? (
            <View style={styles.inlineContactSection}>
              {club.contactEmail ? (
                <Pressable style={styles.contactRowInline} onPress={() => Linking.openURL(`mailto:${club.contactEmail}`)}>
                  <MaterialIcons name="email" size={18} color={theme.primary} />
                  <Text style={styles.contactTextInline}>{club.contactEmail}</Text>
                </Pressable>
              ) : null}
              {club.contactPhone ? (
                <Pressable style={styles.contactRowInline} onPress={() => Linking.openURL(`tel:${club.contactPhone}`)}>
                  <MaterialIcons name="phone" size={18} color={theme.primary} />
                  <Text style={styles.contactTextInline}>{club.contactPhone}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Animated.View>

        {/* Club Card - right after main card */}
        {clubCardUrl ? (
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'clubCardLabel')}</Text>
            <View style={{ backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, overflow: 'hidden', ...theme.shadows.card }}>
              <Pressable style={{ position: 'relative', minHeight: 180 }} onPress={() => clubCardType === 'pdf' ? Linking.openURL(clubCardUrl) : setShowCardFullscreen(true)}>
                {clubCardType === 'image' ? (
                  <Image source={{ uri: clubCardUrl }} style={{ width: '100%', height: 200 }} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.default }} />
                ) : (
                  <View style={{ width: '100%', height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSecondary, gap: 8 }}>
                    <MaterialIcons name="picture-as-pdf" size={48} color={theme.error} />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textPrimary }}>{t('player', 'pdfDocument')}</Text>
                    <Text style={{ fontSize: 13, color: theme.textSecondary }}>{t('player', 'tapToView')}</Text>
                  </View>
                )}
              </Pressable>
              {canEdit && !isSharedItem ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: theme.primary + '10', borderRadius: theme.borderRadius.md }} onPress={showClubCardUploadOptions}>
                    <MaterialIcons name="refresh" size={18} color={theme.primary} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.primary }}>{t('club', 'replaceClubCard')}</Text>
                  </Pressable>
                  <Pressable style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.error + '10', borderRadius: theme.borderRadius.md }} onPress={handleRemoveClubCard}>
                    <MaterialIcons name="delete-outline" size={18} color={theme.error} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </Animated.View>
        ) : canEdit && !isSharedItem ? (
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'clubCardLabel')}</Text>
            <Pressable style={{ backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 32, alignItems: 'center', borderWidth: 2, borderColor: theme.primary + '25', borderStyle: 'dashed', ...theme.shadows.card }} onPress={showClubCardUploadOptions}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <MaterialIcons name="badge" size={32} color={theme.primary} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.primary, marginBottom: 6 }}>{t('club', 'addClubCard')}</Text>
              <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center' }}>{t('club', 'clubCardDesc')}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{club.membersCount}</Text>
            <Text style={styles.quickStatLabel}>{t('club', 'members')}</Text>
          </View>
          <View style={[styles.quickStatItem, styles.quickStatBorder]}>
            <Text style={styles.quickStatValue}>{club.foundedYear}</Text>
            <Text style={styles.quickStatLabel}>{t('club', 'founded')}</Text>
          </View>
          <View style={[styles.quickStatItem, styles.quickStatBorder]}>
            <Text style={styles.quickStatValue}>{clubTournaments.length}</Text>
            <Text style={styles.quickStatLabel}>{t('club', 'tournamentsLabel')}</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{club.membershipCost ? `${club.membershipCost}€` : '-'}</Text>
            <Text style={styles.quickStatLabel}>{t('club', 'membership')}</Text>
          </View>
        </Animated.View>

        <View style={isTablet ? styles.tabletRow : undefined}>
        {/* Location */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={[styles.section, isTablet && styles.tabletHalf]}>
          <Text style={styles.sectionTitle}>{t('club', 'locationLabel')}</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationInfo}>
              <Text style={styles.locationAddress}>{club.address}</Text>
              <Text style={styles.locationCity}>{club.city}</Text>
            </View>
            <Pressable 
              style={styles.mapButton}
              onPress={() => router.push('/(tabs)/map')}
            >
              <MaterialIcons name="map" size={20} color={theme.primary} />
              <Text style={styles.mapButtonText}>{t('club', 'viewOnMap')}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Main Terrain */}
        {club.terrainId ? (() => {
          const mainTerrain = allTerrains.find(t => t.id === club.terrainId);
          if (!mainTerrain) return null;
          return (
            <Animated.View entering={FadeInDown.duration(400).delay(250)} style={[styles.section, isTablet && styles.tabletHalf]}>
              <Text style={styles.sectionTitle}>{t('club', 'mainTerrainLabel')}</Text>
              <Pressable
                style={styles.locationCard}
                onPress={() => router.push(`/terrain/${mainTerrain.id}`)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.success + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="sports-soccer" size={22} color={theme.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locationAddress}>{mainTerrain.name}</Text>
                    <Text style={styles.locationCity}>{t('terrainTypes', mainTerrain.type)} \u2022 {mainTerrain.city}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </View>
              </Pressable>
            </Animated.View>
          );
        })() : null}

        </View>

        <View style={isTablet ? styles.tabletRow : undefined}>
        {/* Members */}
        {clubPlayers.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(500)} style={[styles.section, isTablet && styles.tabletHalf]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('club', 'membersCount')} ({clubPlayers.length})</Text>
            </View>
            {clubPlayers.slice(0, 5).map(player => (
              <Pressable 
                key={player.id} 
                style={styles.memberCard}
                onPress={() => router.push(`/player/${player.id}`)}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitials}>
                    {player.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{player.name}</Text>
                  <Text style={styles.memberRole}>{player.role} • {player.level}</Text>
                </View>
                <View style={styles.memberStats}>
                  <Text style={styles.memberWinRate}>{player.stats.winRate}%</Text>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </View>
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* Tournaments */}
        {clubTournaments.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(600)} style={[styles.section, isTablet && styles.tabletHalf]}>
            <Text style={styles.sectionTitle}>{t('club', 'organizedTournaments')}</Text>
            {clubTournaments.map(tournament => (
              <Pressable 
                key={tournament.id}
                style={styles.tournamentCard}
                onPress={() => router.push(`/tournament/${tournament.id}`)}
              >
                <View style={styles.tournamentDate}>
                  <Text style={styles.tournamentDay}>
                    {new Date(tournament.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric' })}
                  </Text>
                  <Text style={styles.tournamentMonth}>
                    {new Date(tournament.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.tournamentInfo}>
                  <Text style={styles.tournamentName}>{tournament.name}</Text>
                  <Text style={styles.tournamentFormat}>
                    {t('formats', tournament.format)} • {t('tournamentTypes', tournament.type)}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: tournament.status === 'À venir' ? theme.primaryLight + '30' : theme.backgroundSecondary }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: tournament.status === 'À venir' ? theme.primary : theme.textSecondary }
                  ]}>
                    {t('tournamentStatus', tournament.status)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Animated.View>
        )}
        </View>

        {/* Upload in progress overlay */}
        {uploadingCard ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
            <View style={{ backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 40, alignItems: 'center', gap: 12, ...theme.shadows.card }}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={{ fontSize: 14, color: theme.textSecondary }}>{t('club', 'uploadingClubCard')}</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Contact Visibility Toggle - only when public */}
        {canEdit && !isSharedItem && (club.isPublic ?? false) && (club.contactEmail || club.contactPhone) && (
          <Animated.View entering={FadeInDown.duration(400).delay(640)} style={styles.section}>
            <Pressable
              style={styles.visibilityCard}
              onPress={() => {
                Haptics.selectionAsync();
                const newVal = !(club.showContactPublic ?? false);
                updateClub(club.id, { showContactPublic: newVal });
              }}
            >
              <View style={[styles.visibilityIcon, { backgroundColor: (club.showContactPublic ? theme.success : theme.textMuted) + '15' }]}>
                <MaterialIcons name={club.showContactPublic ? 'contact-phone' : 'phone-disabled'} size={22} color={club.showContactPublic ? theme.success : theme.textMuted} />
              </View>
              <View style={styles.visibilityInfo}>
                <Text style={styles.visibilityTitle}>{t('map', 'showContactPublic')}</Text>
                <Text style={styles.visibilityDesc}>
                  {club.showContactPublic ? t('map', 'contactVisibleDesc') : t('map', 'contactHiddenDesc')}
                </Text>
              </View>
              <View style={[styles.visibilityBadge, { backgroundColor: (club.showContactPublic ? theme.success : theme.textMuted) + '15' }]}>
                <Text style={[styles.visibilityBadgeText, { color: club.showContactPublic ? theme.success : theme.textMuted }]}>
                  {club.showContactPublic ? t('map', 'visibleLabel') : t('map', 'hiddenLabel')}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Visibility Toggle - only for owner */}
        {canEdit && !isSharedItem && (
          <Animated.View entering={FadeInDown.duration(400).delay(650)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('map', 'visibility').toUpperCase()}</Text>
            <Pressable
              style={styles.visibilityCard}
              onPress={handleOpenPublicPreview}
              disabled={togglingPublic}
            >
              <View style={[styles.visibilityIcon, { backgroundColor: isPublicState ? theme.success + '15' : theme.textMuted + '15' }]}>
                <MaterialIcons name={isPublicState ? 'public' : 'lock'} size={22} color={isPublicState ? theme.success : theme.textMuted} />
              </View>
              <View style={styles.visibilityInfo}>
                <Text style={styles.visibilityTitle}>{t('map', 'visibilityToggle')}</Text>
                <Text style={styles.visibilityDesc}>
                  {isPublicState ? t('map', 'publicItemsDesc') : t('map', 'makePublic')}
                </Text>
              </View>
              <View style={[styles.visibilityBadge, { backgroundColor: isPublicState ? theme.success + '20' : theme.textMuted + '15' }]}>
                <Text style={[styles.visibilityBadgeText, { color: isPublicState ? theme.success : theme.textMuted }]}>
                  {isPublicState ? t('map', 'publicLabel') : t('map', 'privateLabel')}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Modification Logs - only visible to owner */}
        <ModificationLogsSection
          itemType="club"
          itemId={id!}
          isOwner={!isSharedItem && !!user?.id}
        />
      </ScrollView>

      {/* ===== PUBLIC PREVIEW MODAL ===== */}
      <Modal visible={showPublicPreview} animationType="slide" transparent>
        <View style={styles.pvOverlay}>
          <View style={styles.pvModal}>
            <View style={styles.pvHeader}>
              <View style={[styles.pvHeaderIcon, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="public" size={22} color={theme.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pvHeaderTitle}>{t('preview', 'publicClubTitle')}</Text>
                <Text style={styles.pvHeaderSub}>{t('preview', 'publicClubDesc')}</Text>
              </View>
              <Pressable style={styles.pvCloseBtn} onPress={() => setShowPublicPreview(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.pvScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={styles.pvCard}>
                <View style={styles.pvAvatarRow}>
                  <View style={styles.pvAvatarClub}>
                    <MaterialIcons name="home" size={28} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pvName}>{club.name}</Text>
                    {club.foundedYear ? <Text style={styles.pvNickname}>{t('preview', 'foundedIn')} {club.foundedYear}</Text> : null}
                  </View>
                </View>

                <View style={styles.pvLocationRow}>
                  <MaterialIcons name="place" size={14} color={theme.textSecondary} />
                  <Text style={styles.pvLocationText}>{club.address ? `${club.address}, ` : ''}{club.city}</Text>
                </View>

                {club.facilities && club.facilities.length > 0 ? (
                  <View style={styles.pvInfoRow}>
                    {club.facilities.slice(0, 4).map((f, i) => (
                      <View key={i} style={styles.pvInfoPill}>
                        <MaterialIcons name="check-circle" size={12} color={theme.success} />
                        <Text style={[styles.pvInfoText, { color: theme.success }]}>{t('facilityLabels', f) || f}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {previewShowContacts && (club.contactEmail || club.contactPhone) ? (
                  <View style={styles.pvContactRow}>
                    {club.contactPhone ? (
                      <View style={styles.pvContactPill}>
                        <MaterialIcons name="phone" size={12} color={theme.primary} />
                        <Text style={styles.pvContactText}>{club.contactPhone}</Text>
                      </View>
                    ) : null}
                    {club.contactEmail ? (
                      <View style={styles.pvContactPill}>
                        <MaterialIcons name="email" size={12} color={theme.primary} />
                        <Text style={styles.pvContactText}>{club.contactEmail}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.pvStatsRow}>
                  <View style={styles.pvStatItem}>
                    <Text style={styles.pvStatValue}>{club.membersCount}</Text>
                    <Text style={styles.pvStatLabel}>{t('club', 'members')}</Text>
                  </View>
                  <View style={styles.pvStatDivider} />
                  <View style={styles.pvStatItem}>
                    <Text style={styles.pvStatValue}>{clubTournaments.length}</Text>
                    <Text style={styles.pvStatLabel}>{t('club', 'tournamentsLabel')}</Text>
                  </View>
                  <View style={styles.pvStatDivider} />
                  <View style={styles.pvStatItem}>
                    <Text style={styles.pvStatValue}>{club.membershipCost ? `${club.membershipCost}€` : '-'}</Text>
                    <Text style={styles.pvStatLabel}>{t('club', 'membership')}</Text>
                  </View>
                </View>
              </View>

              {/* Contact Toggle */}
              {(club.contactEmail || club.contactPhone) ? (
                <View style={styles.pvToggleCard}>
                  <View style={styles.pvToggleRow}>
                    <View style={[styles.pvToggleIcon, { backgroundColor: (previewShowContacts ? theme.success : theme.textMuted) + '15' }]}>
                      <MaterialIcons name={previewShowContacts ? 'contact-phone' : 'phone-disabled'} size={18} color={previewShowContacts ? theme.success : theme.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pvToggleTitle}>{t('preview', 'showContacts')}</Text>
                      <Text style={styles.pvToggleDesc}>{previewShowContacts
                        ? t('preview', 'contactsVisibleClub')
                        : t('preview', 'contactsHiddenClub')
                      }</Text>
                    </View>
                    <Switch
                      value={previewShowContacts}
                      onValueChange={(val) => {
                        setPreviewShowContacts(val);
                        if (club) updateClub(club.id, { showContactPublic: val } as any);
                      }}
                      trackColor={{ false: theme.border, true: theme.success + '60' }}
                      thumbColor={previewShowContacts ? theme.success : theme.textMuted}
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.pvNote}>
                <MaterialIcons name="map" size={16} color={theme.primary} />
                <Text style={styles.pvNoteText}>{t('preview', 'geoNoteClub')}</Text>
              </View>
            </ScrollView>

            <View style={styles.pvActions}>
              <Pressable style={styles.pvCancelBtn} onPress={() => setShowPublicPreview(false)}>
                <Text style={styles.pvCancelText}>{t('common', 'cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.pvConfirmBtn, { backgroundColor: isPublicState ? theme.error : theme.success }]} onPress={handleConfirmPublic} disabled={togglingPublic}>
                {togglingPublic ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name={isPublicState ? 'lock' : 'public'} size={18} color="#FFF" />
                    <Text style={styles.pvConfirmText}>{isPublicState
                      ? t('preview', 'makePrivate')
                      : t('preview', 'makePublic')
                    }</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== SHARE PREVIEW MODAL ===== */}
      <Modal visible={showSharePreview} animationType="slide" transparent>
        <View style={styles.pvOverlay}>
          <View style={styles.pvModal}>
            <View style={styles.pvHeader}>
              <View style={[styles.pvHeaderIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="share" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pvHeaderTitle}>{t('preview', 'shareTitle')}</Text>
                <Text style={styles.pvHeaderSub}>{t('preview', 'shareDesc')}</Text>
              </View>
              <Pressable style={styles.pvCloseBtn} onPress={() => setShowSharePreview(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.pvScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={styles.pvReadOnlyBadge}>
                <MaterialIcons name="lock" size={14} color={theme.warning} />
                <Text style={styles.pvReadOnlyText}>{t('preview', 'readOnlyClub')}</Text>
              </View>

              <View style={styles.pvCard}>
                <View style={styles.pvAvatarRow}>
                  <View style={styles.pvAvatarClub}>
                    <MaterialIcons name="home" size={28} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pvName}>{club.name}</Text>
                    {club.foundedYear ? <Text style={styles.pvNickname}>{t('preview', 'foundedIn')} {club.foundedYear}</Text> : null}
                  </View>
                </View>

                <View style={styles.pvLocationRow}>
                  <MaterialIcons name="place" size={14} color={theme.textSecondary} />
                  <Text style={styles.pvLocationText}>{club.address ? `${club.address}, ` : ''}{club.city}</Text>
                </View>

                {club.facilities && club.facilities.length > 0 ? (
                  <View style={styles.pvInfoRow}>
                    {club.facilities.slice(0, 4).map((f, i) => (
                      <View key={i} style={styles.pvInfoPill}>
                        <MaterialIcons name="check-circle" size={12} color={theme.success} />
                        <Text style={[styles.pvInfoText, { color: theme.success }]}>{t('facilityLabels', f) || f}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {previewShowContacts && (club.contactEmail || club.contactPhone) ? (
                  <View style={styles.pvContactRow}>
                    {club.contactPhone ? (
                      <View style={styles.pvContactPill}>
                        <MaterialIcons name="phone" size={12} color={theme.primary} />
                        <Text style={styles.pvContactText}>{club.contactPhone}</Text>
                      </View>
                    ) : null}
                    {club.contactEmail ? (
                      <View style={styles.pvContactPill}>
                        <MaterialIcons name="email" size={12} color={theme.primary} />
                        <Text style={styles.pvContactText}>{club.contactEmail}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.pvStatsRow}>
                  <View style={styles.pvStatItem}>
                    <Text style={styles.pvStatValue}>{club.membersCount}</Text>
                    <Text style={styles.pvStatLabel}>{t('club', 'members')}</Text>
                  </View>
                  <View style={styles.pvStatDivider} />
                  <View style={styles.pvStatItem}>
                    <Text style={styles.pvStatValue}>{clubTournaments.length}</Text>
                    <Text style={styles.pvStatLabel}>{t('club', 'tournamentsLabel')}</Text>
                  </View>
                  <View style={styles.pvStatDivider} />
                  <View style={styles.pvStatItem}>
                    <Text style={styles.pvStatValue}>{club.membershipCost ? `${club.membershipCost}€` : '-'}</Text>
                    <Text style={styles.pvStatLabel}>{t('club', 'membership')}</Text>
                  </View>
                </View>
              </View>

              {/* Contact Toggle */}
              {(club.contactEmail || club.contactPhone) ? (
                <View style={styles.pvToggleCard}>
                  <View style={styles.pvToggleRow}>
                    <View style={[styles.pvToggleIcon, { backgroundColor: (previewShowContacts ? theme.success : theme.textMuted) + '15' }]}>
                      <MaterialIcons name={previewShowContacts ? 'contact-phone' : 'phone-disabled'} size={18} color={previewShowContacts ? theme.success : theme.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pvToggleTitle}>{t('preview', 'showContacts')}</Text>
                      <Text style={styles.pvToggleDesc}>{previewShowContacts
                        ? t('preview', 'contactsVisibleClub')
                        : t('preview', 'contactsHiddenClub')
                      }</Text>
                    </View>
                    <Switch
                      value={previewShowContacts}
                      onValueChange={(val) => {
                        setPreviewShowContacts(val);
                        if (club) updateClub(club.id, { showContactPublic: val } as any);
                      }}
                      trackColor={{ false: theme.border, true: theme.success + '60' }}
                      thumbColor={previewShowContacts ? theme.success : theme.textMuted}
                    />
                  </View>
                </View>
              ) : null}

              <View style={styles.pvNote}>
                <MaterialIcons name="visibility" size={16} color={theme.primary} />
                <Text style={styles.pvNoteText}>{t('preview', 'shareNoteClub')}</Text>
              </View>
            </ScrollView>

            <View style={styles.pvActions}>
              <Pressable style={styles.pvCancelBtn} onPress={() => setShowSharePreview(false)}>
                <Text style={styles.pvCancelText}>{t('common', 'cancel')}</Text>
              </Pressable>
              <Pressable style={[styles.pvConfirmBtn, { backgroundColor: theme.primary }]} onPress={handleConfirmShare}>
                <MaterialIcons name="share" size={18} color="#FFF" />
                <Text style={styles.pvConfirmText}>{t('preview', 'shareBtn')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        itemType="club"
        itemId={id!}
        itemName={club.name}
      />

      <MergePickerModal
        visible={showMergePicker}
        onClose={() => setShowMergePicker(false)}
        itemType="club"
        currentItemId={id!}
      />

      {/* Club Card Fullscreen Modal */}
      <Modal visible={showCardFullscreen} animationType="fade" transparent onRequestClose={() => setShowCardFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }} onPress={() => setShowCardFullscreen(false)}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="close" size={28} color="#FFF" />
            </View>
          </Pressable>
          {clubCardUrl ? <Image source={{ uri: clubCardUrl }} style={{ width: screenWidth, height: screenWidth * 1.4 }} contentFit="contain" transition={200} /> : null}
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  saveButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent + '15',
    borderRadius: 20,
  },
  shareButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: theme.error + '15',
    borderRadius: 20,
  },
  editButton: {
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
  scrollContentTablet: {
    maxWidth: 960,
    alignSelf: 'center' as const,
    width: '100%',
    paddingHorizontal: 24,
  },
  clubCardTablet: {
    padding: 32,
  },
  tabletRow: {
    flexDirection: 'row' as const,
    gap: 16,
  },
  tabletHalf: {
    flex: 1,
  },
  clubCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  clubIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  clubName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  clubMetaText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  clubDescription: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inlineFacilitiesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  facilitiesGridInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  facilityTagInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.success + '10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  facilityTextInline: {
    fontSize: 12,
    color: theme.success,
    fontWeight: '500',
  },
  inlineContactSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 8,
  },
  contactRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactTextInline: {
    fontSize: 14,
    color: theme.primary,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    marginTop: 16,
    ...theme.shadows.card,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  quickStatBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.border,
  },
  quickStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  quickStatLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  locationCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  locationInfo: {
    marginBottom: 16,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  locationCity: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primaryLight + '20',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  mapButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
  },
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facilityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  facilityText: {
    fontSize: 14,
    color: theme.textPrimary,
  },
  contactCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  contactText: {
    flex: 1,
    fontSize: 15,
    color: theme.textPrimary,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  memberRole: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  memberStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberWinRate: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.success,
  },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  tournamentDate: {
    width: 50,
    alignItems: 'center',
    marginRight: 12,
  },
  tournamentDay: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  tournamentMonth: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  tournamentFormat: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  visibilityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  visibilityInfo: {
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  visibilityDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  visibilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  visibilityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ===== Preview Modal =====
  pvOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' as const },
  pvModal: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 0 },
  pvHeader: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12, padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  pvHeaderIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  pvHeaderTitle: { fontSize: 17, fontWeight: '700' as const, color: theme.textPrimary },
  pvHeaderSub: { fontSize: 13, color: theme.textSecondary, marginTop: 2, lineHeight: 18 },
  pvCloseBtn: { width: 36, height: 36, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 18, backgroundColor: theme.backgroundSecondary },
  pvScroll: { paddingHorizontal: 20, paddingTop: 16 },
  pvCard: { backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 12 },
  pvAvatarRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, marginBottom: 12 },
  pvAvatarClub: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.accent, alignItems: 'center' as const, justifyContent: 'center' as const },
  pvName: { fontSize: 18, fontWeight: '700' as const, color: theme.textPrimary },
  pvNickname: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  pvLocationRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginBottom: 8 },
  pvLocationText: { fontSize: 12, color: theme.textSecondary },
  pvInfoRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 10 },
  pvInfoPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.surface, borderRadius: 12 },
  pvInfoText: { fontSize: 12, fontWeight: '600' as const },
  pvContactRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 10 },
  pvContactPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: theme.primary + '10', borderRadius: 14 },
  pvContactText: { fontSize: 12, fontWeight: '500' as const, color: theme.primary },
  pvStatsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, paddingVertical: 10, paddingHorizontal: 12 },
  pvStatItem: { alignItems: 'center' as const, flex: 1 },
  pvStatValue: { fontSize: 16, fontWeight: '700' as const, color: theme.textPrimary },
  pvStatLabel: { fontSize: 9, color: theme.textSecondary, marginTop: 1, textTransform: 'uppercase' as const },
  pvStatDivider: { width: 1, height: 24, backgroundColor: theme.border, marginHorizontal: 6 },
  pvToggleCard: { backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.lg, padding: 14, marginBottom: 12 },
  pvToggleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  pvToggleIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  pvToggleTitle: { fontSize: 14, fontWeight: '600' as const, color: theme.textPrimary },
  pvToggleDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  pvNote: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10, backgroundColor: theme.primary + '08', borderRadius: theme.borderRadius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.primary + '15' },
  pvNoteText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  pvReadOnlyBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, backgroundColor: theme.warning + '10', borderRadius: theme.borderRadius.md, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.warning + '20' },
  pvReadOnlyText: { flex: 1, fontSize: 12, fontWeight: '600' as const, color: theme.warning, lineHeight: 17 },
  pvActions: { flexDirection: 'row' as const, gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.border },
  pvCancelBtn: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 14, borderRadius: theme.borderRadius.md, backgroundColor: theme.backgroundSecondary },
  pvCancelText: { fontSize: 15, fontWeight: '600' as const, color: theme.textSecondary },
  pvConfirmBtn: { flex: 2, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 14, borderRadius: theme.borderRadius.md },
  pvConfirmText: { fontSize: 15, fontWeight: '700' as const, color: '#FFF' },
});
