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
  TextInput,
} from 'react-native';
import * as Haptics from '@/services/haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
// expo-document-picker and expo-file-system loaded dynamically to avoid web bundler issues
import * as Linking2 from 'expo-linking';
import { decode } from '@/services/base64';
import { getSupabaseClient } from '@/template';
import { uploadImageToStorage } from '@/services/storageService';
import theme, { blurhash } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import ShareModal from '@/components/ui/ShareModal';
import ModificationLogsSection from '@/components/ui/ModificationLogsSection';
import SharedBadge from '@/components/ui/SharedBadge';
import MergePickerModal from '@/components/ui/MergePickerModal';
import { isSharedWithMe, saveSharedItemToMyAccount, recordShareView } from '@/services/shareService';
import { toggleItemPublic } from '@/services/publicItemsService';
import { useAlert } from '@/template';
import { useAuth } from '@/template';
import { submitClubClaim, hasExistingClaim, getReceivedClaims, acceptClubClaim, declineClubClaim, ClubClaimRequest } from '@/services/clubClaimService';
import { getClubCoAdmins, addClubCoAdmin, removeClubCoAdmin, updateCoAdminPermission, CoAdmin, CoAdminPermission } from '@/services/clubCoManagementService';


export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getClubById, players, tournaments, deleteClub, updateClub, getSharedPermission, setItemPublic, isFavoriteClub, toggleFavoriteClub, refreshData, loading: appLoading } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);
  const [screenWidth, setScreenWidth] = React.useState(() => Dimensions.get('window').width || 375);
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
  const [previewShowContacts, setPreviewShowContacts] = React.useState(false);

  // Claim system state
  const [showClaimModal, setShowClaimModal] = React.useState(false);
  const [claimMessage, setClaimMessage] = React.useState('');
  const [claimStatus, setClaimStatus] = React.useState<string | null>(null);
  const [submittingClaim, setSubmittingClaim] = React.useState(false);
  const [claimProofUri, setClaimProofUri] = React.useState<string | null>(null);
  const [claimProofUrl, setClaimProofUrl] = React.useState<string | null>(null);
  const [claimProofType, setClaimProofType] = React.useState<'image' | 'pdf'>('image');
  const [uploadingProof, setUploadingProof] = React.useState(false);
  const [showProofFullscreen, setShowProofFullscreen] = React.useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = React.useState<ClubClaimRequest[]>([]);
  const [processingClaimId, setProcessingClaimId] = React.useState<string | null>(null);

  // Co-management state
  const [coAdmins, setCoAdmins] = React.useState<CoAdmin[]>([]);
  const [showCoAdminModal, setShowCoAdminModal] = React.useState(false);
  const [coAdminEmail, setCoAdminEmail] = React.useState('');
  const [addingCoAdmin, setAddingCoAdmin] = React.useState(false);
  const [isCoAdmin, setIsCoAdmin] = React.useState(false);
  const [newCoAdminPerm, setNewCoAdminPerm] = React.useState<CoAdminPermission>('edit');
  const [updatingPermId, setUpdatingPermId] = React.useState<string | null>(null);

  const sharedPermission = getSharedPermission(id!);
  const isSharedItem = sharedPermission !== null;
  const isReadOnly = sharedPermission === 'read';
  const canEdit = !isReadOnly;
  const supabase = getSupabaseClient();

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = React.useState(false);

  // Club card state
  const [clubCardUrl, setClubCardUrl] = React.useState<string | null>(null);
  const [clubCardType, setClubCardType] = React.useState<'image' | 'pdf'>('image');
  const [uploadingCard, setUploadingCard] = React.useState(false);
  const [showCardFullscreen, setShowCardFullscreen] = React.useState(false);
  const [screenWidth2, setScreenWidth2] = React.useState(() => Dimensions.get('window').width || 375);

  const isFavorite = id ? isFavoriteClub(id) : false;

  const handleToggleFavorite = () => {
    if (id) {
      toggleFavoriteClub(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleUploadLogo = React.useCallback(() => {
    if (!club || !canEdit || isSharedItem) return;
    Alert.alert(
      t('club', 'clubLabel'),
      language === 'fr' ? 'Logo du club' : 'Club logo',
      [
        { text: t('player', 'fromCamera'), onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { showAlert(t('profile', 'permissionRequired'), t('profile', 'cameraPermission')); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled && result.assets[0]) {
            setUploadingLogo(true);
            const url = await uploadImageToStorage('avatars', `avatars/clubs/${user?.id}`, result.assets[0].uri);
            setUploadingLogo(false);
            if (url) { await updateClub(club.id, { logo: url }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
            else { showAlert(t('common', 'error'), t('profile', 'errorUploadPhoto')); }
          }
        }},
        { text: t('player', 'fromGallery'), onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { showAlert(t('profile', 'permissionRequired'), t('profile', 'galleryPermission')); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled && result.assets[0]) {
            setUploadingLogo(true);
            const url = await uploadImageToStorage('avatars', `avatars/clubs/${user?.id}`, result.assets[0].uri);
            setUploadingLogo(false);
            if (url) { await updateClub(club.id, { logo: url }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
            else { showAlert(t('common', 'error'), t('profile', 'errorUploadPhoto')); }
          }
        }},
        ...(club.logo ? [{ text: language === 'fr' ? 'Supprimer le logo' : 'Remove logo', style: 'destructive' as const, onPress: async () => {
          await updateClub(club.id, { logo: undefined });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}] : []),
        { text: t('common', 'cancel'), style: 'cancel' },
      ]
    );
  }, [club, canEdit, isSharedItem, user?.id, updateClub, showAlert, t, language]);

  React.useEffect(() => {
    if (id) {
      isSharedWithMe('club', id).then(shared => { setIsShared(shared); if (shared) recordShareView('club', id, 'club-detail'); });
    }
  }, [id]);

  React.useEffect(() => {
    if (club) setIsPublicState(club.isPublic ?? false);
  }, [club?.id, club?.isPublic]);

  // Check claim status & load pending claims & co-admins
  React.useEffect(() => {
    if (!id || !user?.id) return;
    // Check if I have a claim
    hasExistingClaim(id, user.id).then(({ hasClaim, status }) => {
      if (hasClaim) setClaimStatus(status);
    }).catch(() => {});
    // If I own this club, load pending claims and co-admins
    if (club?.userId === user.id) {
      getReceivedClaims().then(({ claims }) => {
        setPendingClaims(claims.filter(c => c.clubId === id && c.status === 'pending'));
      }).catch(() => {});
      getClubCoAdmins(id).then(({ coAdmins: admins }) => {
        setCoAdmins(admins);
      }).catch(() => {});
    } else {
      // Check if I am a co-admin
      getClubCoAdmins(id).then(({ coAdmins: admins }) => {
        setCoAdmins(admins);
        setIsCoAdmin(admins.some(a => a.id === user.id));
      }).catch(() => {});
    }
  }, [id, user?.id, club?.userId]);

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
        const FileSystem = require('expo-file-system');
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
            const DocumentPicker = require('expo-document-picker');
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
    setShowShareModal(true);
  }, [club]);

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
          {/* Pending claims notification badge for owner */}
          {canEdit && !isSharedItem && pendingClaims.length > 0 ? (
            <Pressable
              style={styles.claimNotifBtn}
              onPress={() => router.push({ pathname: '/notifications-hub', params: { tab: 'claims' } } as any)}
            >
              <MaterialIcons name="verified-user" size={20} color="#F59E0B" />
              <View style={styles.claimNotifBadge}>
                <Text style={styles.claimNotifBadgeText}>{pendingClaims.length > 9 ? '9+' : pendingClaims.length}</Text>
              </View>
            </Pressable>
          ) : null}
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
          <Pressable style={styles.clubIconPressable} onPress={handleUploadLogo} disabled={!canEdit || isSharedItem || uploadingLogo}>
            {uploadingLogo ? (
              <View style={styles.clubIcon}>
                <ActivityIndicator size="large" color="#FFF" />
              </View>
            ) : club.logo ? (
              <View style={styles.clubLogoWrap}>
                <Image source={{ uri: club.logo }} style={styles.clubLogoImage} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.avatar }} cachePolicy="memory-disk" />
                {canEdit && !isSharedItem ? (
                  <View style={styles.clubLogoEditBadge}>
                    <MaterialIcons name="camera-alt" size={14} color="#FFF" />
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.clubIcon}>
                <MaterialIcons name="home" size={48} color="#FFF" />
                {canEdit && !isSharedItem ? (
                  <View style={styles.clubLogoEditBadge}>
                    <MaterialIcons name="camera-alt" size={14} color="#FFF" />
                  </View>
                ) : null}
              </View>
            )}
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={[styles.clubName, { marginBottom: 0 }]}>{club.name}</Text>
            {club.isVerified ? (
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={18} color="#2563EB" />
              </View>
            ) : null}
          </View>
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

          {/* Social / Web links */}
          {(club.website || club.facebookUrl || club.instagramHandle) ? (
            <View style={styles.inlineContactSection}>
              {club.website ? (
                <Pressable style={styles.contactRowInline} onPress={() => { const url = club.website!.startsWith('http') ? club.website! : `https://${club.website}`; Linking.openURL(url); }}>
                  <MaterialIcons name="language" size={18} color={theme.accent} />
                  <Text style={styles.contactTextInline} numberOfLines={1}>{club.website}</Text>
                </Pressable>
              ) : null}
              {club.facebookUrl ? (
                <Pressable style={styles.contactRowInline} onPress={() => { const url = club.facebookUrl!.startsWith('http') ? club.facebookUrl! : `https://${club.facebookUrl}`; Linking.openURL(url); }}>
                  <MaterialIcons name="facebook" size={18} color="#1877F2" />
                  <Text style={[styles.contactTextInline, { color: '#1877F2' }]} numberOfLines={1}>{club.facebookUrl}</Text>
                </Pressable>
              ) : null}
              {club.instagramHandle ? (
                <Pressable style={styles.contactRowInline} onPress={() => { const handle = club.instagramHandle!.replace('@', ''); Linking.openURL(`https://instagram.com/${handle}`); }}>
                  <MaterialIcons name="camera-alt" size={18} color="#E4405F" />
                  <Text style={[styles.contactTextInline, { color: '#E4405F' }]} numberOfLines={1}>@{club.instagramHandle!.replace('@', '')}</Text>
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
                  <Image source={{ uri: clubCardUrl }} style={{ width: '100%', height: 200 }} contentFit="cover" transition={200} placeholder={{ blurhash: blurhash.default }} cachePolicy="memory-disk" />
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
              onPress={() => {
                const lat = club.location?.latitude;
                const lng = club.location?.longitude;
                if (lat || lng) {
                  router.push({ pathname: '/(tabs)/map', params: { lat: String(lat || 0), lng: String(lng || 0), name: club.name } } as any);
                } else {
                  router.push('/(tabs)/map');
                }
              }}
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
                    <Text style={styles.locationCity}>{t('terrainTypes', mainTerrain.type)} {"\u2022"} {mainTerrain.city}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </View>
              </Pressable>
            </Animated.View>
          );
        })() : null}

        </View>

        <View style={isTablet ? styles.tabletRow : undefined}>
        {clubPlayers.length > 0 && (
          <Animated.View entering={FadeIn.duration(400).delay(400)} style={[styles.section, isTablet && styles.tabletHalf]}>
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
                  <Text style={styles.memberRole}>{player.role}</Text>
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
          <Animated.View entering={FadeIn.duration(400).delay(450)} style={[styles.section, isTablet && styles.tabletHalf]}>
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
          <Animated.View entering={FadeIn.duration(400).delay(500)} style={styles.section}>
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
          <Animated.View entering={FadeIn.duration(400).delay(550)} style={styles.section}>
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

        {/* Pending Claims - only for owner */}
        {canEdit && !isSharedItem && pendingClaims.length > 0 ? (
          <Animated.View entering={FadeIn.duration(400).delay(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'pendingClaims').toUpperCase()}</Text>
            {pendingClaims.map(claim => (
              <View key={claim.id} style={styles.claimCard}>
                <View style={styles.claimCardHeader}>
                  <View style={styles.claimAvatar}>
                    <MaterialIcons name="person" size={20} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.claimName}>{claim.requesterName || claim.requesterEmail || (language === 'fr' ? 'Utilisateur' : 'User')}</Text>
                    {claim.requesterEmail ? <Text style={styles.claimEmail}>{claim.requesterEmail}</Text> : null}
                    <Text style={styles.claimDate}>{new Date(claim.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </View>
                </View>
                {claim.message ? (
                  <View style={styles.claimMessageBox}>
                    <MaterialIcons name="format-quote" size={14} color={theme.textMuted} />
                    <Text style={styles.claimMessageText}>{claim.message}</Text>
                  </View>
                ) : null}
                {claim.proofUrl ? (
                  <Pressable
                    style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#2563EB25' }}
                    onPress={() => claim.proofUrl!.toLowerCase().endsWith('.pdf') ? Linking.openURL(claim.proofUrl!) : setShowProofFullscreen(claim.proofUrl!)}
                  >
                    {claim.proofUrl.toLowerCase().endsWith('.pdf') ? (
                      <View style={{ width: '100%', height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', gap: 4 }}>
                        <MaterialIcons name="picture-as-pdf" size={32} color={theme.error} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textPrimary }}>{t('club', 'claimProofPdf')}</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: claim.proofUrl }} style={{ width: '100%', height: 120 }} contentFit="cover" transition={200} />
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#EFF6FF' }}>
                      <MaterialIcons name={claim.proofUrl.toLowerCase().endsWith('.pdf') ? 'open-in-new' : 'photo'} size={14} color="#2563EB" />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#2563EB' }}>{t('club', 'claimProofView')}</Text>
                    </View>
                  </Pressable>
                ) : null}
                <View style={styles.claimActions}>
                  <Pressable
                    style={styles.claimDeclineBtn}
                    onPress={() => {
                      Alert.alert(
                        t('club', 'declineClaim'),
                        t('club', 'declineClaimConfirm'),
                        [
                          { text: t('common', 'cancel'), style: 'cancel' },
                          { text: t('club', 'declineClaim'), style: 'destructive', onPress: async () => {
                            setProcessingClaimId(claim.id);
                            const { error } = await declineClubClaim(claim.id);
                            setProcessingClaimId(null);
                            if (!error) {
                              setPendingClaims(prev => prev.filter(c => c.id !== claim.id));
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            } else {
                              showAlert(t('common', 'error'), error);
                            }
                          }},
                        ]
                      );
                    }}
                    disabled={processingClaimId === claim.id}
                  >
                    <MaterialIcons name="close" size={16} color={theme.error} />
                    <Text style={styles.claimDeclineText}>{t('club', 'declineClaim')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.claimAcceptBtn}
                    onPress={() => {
                      Alert.alert(
                        t('club', 'acceptClaim'),
                        t('club', 'acceptClaimConfirm'),
                        [
                          { text: t('common', 'cancel'), style: 'cancel' },
                          { text: t('club', 'acceptClaim'), onPress: async () => {
                            setProcessingClaimId(claim.id);
                            const { error } = await acceptClubClaim(claim.id);
                            setProcessingClaimId(null);
                            if (!error) {
                              setPendingClaims(prev => prev.filter(c => c.id !== claim.id));
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              showAlert(t('common', 'success'), t('club', 'claimTransferred') + '\n' + t('club', 'contributorBadge'));
                            } else {
                              showAlert(t('common', 'error'), error);
                            }
                          }},
                        ]
                      );
                    }}
                    disabled={processingClaimId === claim.id}
                  >
                    {processingClaimId === claim.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="check" size={16} color="#FFF" />
                        <Text style={styles.claimAcceptText}>{t('club', 'acceptClaim')}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            ))}
          </Animated.View>
        ) : null}

        {/* Claim Club Button - for non-owners */}
        {user?.id && club.userId && club.userId !== user.id && !isSharedItem ? (
          <Animated.View entering={FadeIn.duration(400).delay(600)} style={styles.section}>
            {claimStatus === 'pending' ? (
              <View style={styles.claimStatusCard}>
                <View style={[styles.claimStatusIcon, { backgroundColor: '#F59E0B15' }]}>
                  <MaterialIcons name="schedule" size={22} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.claimStatusTitle}>{t('club', 'claimPending')}</Text>
                  <Text style={styles.claimStatusDesc}>{t('club', 'claimPendingDesc')}</Text>
                </View>
              </View>
            ) : claimStatus === 'accepted' ? (
              <View style={styles.claimStatusCard}>
                <View style={[styles.claimStatusIcon, { backgroundColor: '#10B98115' }]}>
                  <MaterialIcons name="check-circle" size={22} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.claimStatusTitle, { color: '#10B981' }]}>{t('club', 'claimAccepted')}</Text>
                </View>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.claimButton, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
                onPress={() => setShowClaimModal(true)}
              >
                <View style={styles.claimButtonIcon}>
                  <MaterialIcons name="verified-user" size={22} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.claimButtonTitle}>{t('club', 'claimThisClub')}</Text>
                  <Text style={styles.claimButtonDesc}>{t('club', 'claimDesc')}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            )}
          </Animated.View>
        ) : null}

        {/* Co-Admin Management - only for owner */}
        {canEdit && !isSharedItem && club.userId === user?.id ? (
          <Animated.View entering={FadeIn.duration(400).delay(580)} style={styles.section}>
            <Text style={styles.sectionTitle}>{language === 'fr' ? 'CO-GESTION' : 'CO-MANAGEMENT'}</Text>
            <View style={styles.coAdminCard}>
              <View style={styles.coAdminHeader}>
                <View style={styles.coAdminHeaderIcon}>
                  <MaterialIcons name="group-add" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coAdminHeaderTitle}>{language === 'fr' ? 'Administrateurs du club' : 'Club administrators'}</Text>
                  <Text style={styles.coAdminHeaderDesc}>{language === 'fr' ? 'Ajoutez des co-admins pour gerer ce club' : 'Add co-admins to manage this club'}</Text>
                </View>
                <Pressable
                  style={styles.coAdminAddBtn}
                  onPress={() => { Haptics.selectionAsync(); setShowCoAdminModal(true); setCoAdminEmail(''); }}
                >
                  <MaterialIcons name="person-add" size={18} color="#7C3AED" />
                </Pressable>
              </View>
              {coAdmins.length === 0 ? (
                <Text style={styles.coAdminEmpty}>{language === 'fr' ? 'Aucun co-admin. Vous etes le seul gestionnaire.' : 'No co-admins. You are the sole manager.'}</Text>
              ) : (
                coAdmins.map(ca => {
                  const permColors: Record<string, { bg: string; color: string; label: string }> = {
                    read: { bg: '#94A3B815', color: '#94A3B8', label: language === 'fr' ? 'Lecture' : 'Read' },
                    edit: { bg: '#3B82F615', color: '#3B82F6', label: language === 'fr' ? 'Edition' : 'Edit' },
                    full: { bg: '#10B98115', color: '#10B981', label: language === 'fr' ? 'Complet' : 'Full' },
                  };
                  const pc = permColors[ca.permission] || permColors.edit;
                  return (
                    <View key={ca.id} style={styles.coAdminItem}>
                      <View style={styles.coAdminAvatar}>
                        <Text style={styles.coAdminAvatarText}>{(ca.username || ca.email).charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.coAdminName}>{ca.username || ca.email}</Text>
                        <Text style={styles.coAdminEmail}>{ca.email}</Text>
                      </View>
                      <Pressable
                        style={[styles.coAdminPermBadge, { backgroundColor: pc.bg }]}
                        onPress={async () => {
                          const nextPerm: CoAdminPermission = ca.permission === 'read' ? 'edit' : ca.permission === 'edit' ? 'full' : 'read';
                          setUpdatingPermId(ca.id);
                          Haptics.selectionAsync();
                          const { error } = await updateCoAdminPermission(club.id, ca.id, nextPerm);
                          setUpdatingPermId(null);
                          if (!error) {
                            setCoAdmins(prev => prev.map(a => a.id === ca.id ? { ...a, permission: nextPerm } : a));
                          }
                        }}
                        disabled={updatingPermId === ca.id}
                      >
                        {updatingPermId === ca.id ? <ActivityIndicator size="small" color={pc.color} /> : (
                          <Text style={[styles.coAdminPermText, { color: pc.color }]}>{pc.label}</Text>
                        )}
                      </Pressable>
                      <Pressable
                        style={styles.coAdminRemoveBtn}
                        onPress={() => {
                          Alert.alert(
                            language === 'fr' ? 'Retirer ce co-admin ?' : 'Remove co-admin?',
                            `${ca.username || ca.email}`,
                            [
                              { text: t('common', 'cancel'), style: 'cancel' },
                              { text: language === 'fr' ? 'Retirer' : 'Remove', style: 'destructive', onPress: async () => {
                                const { error } = await removeClubCoAdmin(club.id, ca.id);
                                if (error) showAlert(t('common', 'error'), error);
                                else {
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  setCoAdmins(prev => prev.filter(a => a.id !== ca.id));
                                }
                              }},
                            ]
                          );
                        }}
                      >
                        <MaterialIcons name="close" size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </Animated.View>
        ) : isCoAdmin ? (
          <Animated.View entering={FadeIn.duration(400).delay(580)} style={styles.section}>
            <View style={styles.coAdminBadgeCard}>
              <MaterialIcons name="admin-panel-settings" size={20} color="#7C3AED" />
              <Text style={styles.coAdminBadgeText}>{language === 'fr' ? 'Vous etes co-administrateur de ce club' : 'You are a co-admin of this club'}</Text>
            </View>
          </Animated.View>
        ) : null}

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

      {/* ShareModal handles the full share flow including contact toggle */}

      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        itemType="club"
        itemId={id!}
        itemName={club.name}
      />

      {/* Co-Admin Add Modal */}
      <Modal visible={showCoAdminModal} animationType="slide" transparent onRequestClose={() => setShowCoAdminModal(false)}>
        <View style={styles.pvOverlay}>
          <View style={[styles.pvModal, { maxHeight: '50%' }]}>
            <View style={styles.pvHeader}>
              <View style={[styles.pvHeaderIcon, { backgroundColor: '#7C3AED15' }]}>
                <MaterialIcons name="person-add" size={22} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pvHeaderTitle}>{language === 'fr' ? 'Ajouter un co-admin' : 'Add co-admin'}</Text>
                <Text style={styles.pvHeaderSub}>{language === 'fr' ? 'Entrez l\'email du co-administrateur' : 'Enter the co-admin email address'}</Text>
              </View>
              <Pressable style={styles.pvCloseBtn} onPress={() => setShowCoAdminModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={{ padding: 20 }}>
              <View style={[styles.claimInput, { marginBottom: 12 }]}>
                <MaterialIcons name="email" size={18} color={theme.textMuted} />
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={[styles.claimInputField, { minHeight: 20 }]}
                    placeholder="email@example.com"
                    placeholderTextColor={theme.textMuted}
                    value={coAdminEmail}
                    onChangeText={setCoAdminEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>{language === 'fr' ? 'Niveau de permission' : 'Permission level'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {([{ key: 'read' as CoAdminPermission, icon: 'visibility', label: language === 'fr' ? 'Lecture seule' : 'Read only', desc: language === 'fr' ? 'Voir le club' : 'View club', color: '#94A3B8' }, { key: 'edit' as CoAdminPermission, icon: 'edit', label: language === 'fr' ? 'Edition' : 'Edit', desc: language === 'fr' ? 'Modifier infos' : 'Edit info', color: '#3B82F6' }, { key: 'full' as CoAdminPermission, icon: 'admin-panel-settings', label: language === 'fr' ? 'Complet' : 'Full', desc: language === 'fr' ? 'Gestion totale' : 'Full control', color: '#10B981' }]).map(p => {
                  const isActive = newCoAdminPerm === p.key;
                  return (
                    <Pressable key={p.key} style={[{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: isActive ? p.color : theme.border, backgroundColor: isActive ? p.color + '10' : theme.backgroundSecondary }]} onPress={() => { Haptics.selectionAsync(); setNewCoAdminPerm(p.key); }}>
                      <MaterialIcons name={p.icon as any} size={20} color={isActive ? p.color : theme.textMuted} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? p.color : theme.textSecondary, marginTop: 4 }}>{p.label}</Text>
                      <Text style={{ fontSize: 9, color: theme.textMuted, marginTop: 2 }}>{p.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={styles.pvActions}>
              <Pressable style={styles.pvCancelBtn} onPress={() => setShowCoAdminModal(false)}>
                <Text style={styles.pvCancelText}>{t('common', 'cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.pvConfirmBtn, { backgroundColor: '#7C3AED' }, (!coAdminEmail.trim() || addingCoAdmin) && { opacity: 0.5 }]}
                onPress={async () => {
                  if (!coAdminEmail.trim() || addingCoAdmin) return;
                  setAddingCoAdmin(true);
                  const { coAdmin, error } = await addClubCoAdmin(club.id, coAdminEmail.trim(), newCoAdminPerm);
                  setAddingCoAdmin(false);
                  if (error === 'user_not_found') {
                    showAlert(t('common', 'error'), language === 'fr' ? 'Utilisateur introuvable avec cet email.' : 'No user found with this email.');
                  } else if (error === 'is_owner') {
                    showAlert(t('common', 'error'), language === 'fr' ? 'Cet utilisateur est deja proprietaire.' : 'This user is already the owner.');
                  } else if (error === 'already_coadmin') {
                    showAlert(t('common', 'error'), language === 'fr' ? 'Deja co-admin de ce club.' : 'Already a co-admin of this club.');
                  } else if (error) {
                    showAlert(t('common', 'error'), error);
                  } else if (coAdmin) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setCoAdmins(prev => [...prev, coAdmin]);
                    setShowCoAdminModal(false);
                    setCoAdminEmail('');
                    setNewCoAdminPerm('edit');
                  }
                }}
                disabled={!coAdminEmail.trim() || addingCoAdmin}
              >
                {addingCoAdmin ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <><MaterialIcons name="person-add" size={18} color="#FFF" /><Text style={styles.pvConfirmText}>{language === 'fr' ? 'Ajouter' : 'Add'}</Text></>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <MergePickerModal
        visible={showMergePicker}
        onClose={() => setShowMergePicker(false)}
        itemType="club"
        currentItemId={id!}
      />

      {/* Claim Modal */}
      <Modal visible={showClaimModal} animationType="slide" transparent>
        <View style={styles.pvOverlay}>
          <View style={styles.pvModal}>
            <View style={styles.pvHeader}>
              <View style={[styles.pvHeaderIcon, { backgroundColor: '#2563EB15' }]}>
                <MaterialIcons name="verified-user" size={22} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pvHeaderTitle}>{t('club', 'claimThisClub')}</Text>
                <Text style={styles.pvHeaderSub}>{t('club', 'claimDesc')}</Text>
              </View>
              <Pressable style={styles.pvCloseBtn} onPress={() => setShowClaimModal(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.pvScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={styles.pvCard}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 }}>{t('club', 'claimMessage')}</Text>
                <View style={styles.claimInput}>
                  <MaterialIcons name="message" size={18} color={theme.textMuted} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.claimInputField}
                      placeholder={t('club', 'claimMessagePlaceholder')}
                      placeholderTextColor={theme.textMuted}
                      multiline
                      numberOfLines={4}
                      value={claimMessage}
                      onChangeText={setClaimMessage}
                      maxLength={500}
                    />
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: theme.textMuted, textAlign: 'right', marginTop: 4 }}>{claimMessage.length}/500</Text>
              </View>

              {/* Proof upload section */}
              <View style={styles.pvCard}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 }}>{t('club', 'claimProofLabel')}</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>{t('club', 'claimProofDesc')}</Text>
                {claimProofUri ? (
                  <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
                    <Pressable onPress={() => claimProofType === 'pdf' ? Linking.openURL(claimProofUrl || claimProofUri) : setShowProofFullscreen(claimProofUri)}>
                      {claimProofType === 'pdf' ? (
                        <View style={{ width: '100%', height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSecondary, gap: 6 }}>
                          <MaterialIcons name="picture-as-pdf" size={40} color={theme.error} />
                          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>{t('club', 'claimProofPdf')}</Text>
                          <Text style={{ fontSize: 11, color: theme.textSecondary }}>{t('club', 'claimProofTapToOpen')}</Text>
                        </View>
                      ) : (
                        <Image source={{ uri: claimProofUri }} style={{ width: '100%', height: 160 }} contentFit="cover" transition={200} />
                      )}
                    </Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8, backgroundColor: '#F0FDF4', borderTopWidth: 1, borderTopColor: theme.border }}>
                      <MaterialIcons name="check-circle" size={16} color={theme.success} />
                      <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: theme.success }}>{t('club', 'claimProofUploaded')}</Text>
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.error + '10', borderRadius: 8 }}
                        onPress={() => { setClaimProofUri(null); setClaimProofUrl(null); setClaimProofType('image'); }}
                      >
                        <MaterialIcons name="close" size={14} color={theme.error} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.error }}>{t('club', 'claimProofRemove')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : uploadingProof ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: theme.backgroundSecondary, borderRadius: 12 }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>{t('club', 'claimProofUploading')}</Text>
                  </View>
                ) : (
                  <Pressable
                    style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: theme.backgroundSecondary, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2563EB30', gap: 8 }}
                    onPress={() => {
                      Alert.alert(
                        t('club', 'claimProofLabel'),
                        t('club', 'claimProofDesc'),
                        [
                          { text: t('player', 'fromCamera'), onPress: async () => {
                            const { status } = await ImagePicker.requestCameraPermissionsAsync();
                            if (status !== 'granted') { showAlert(t('profile', 'permissionRequired'), t('profile', 'cameraPermission')); return; }
                            const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
                            if (!result.canceled && result.assets[0]) {
                              setUploadingProof(true);
                              const uri = result.assets[0].uri;
                              const url = await uploadImageToStorage('club-cards', `claims/${user?.id}/${Date.now()}`, uri);
                              setUploadingProof(false);
                              if (url) { setClaimProofUri(uri); setClaimProofUrl(url); setClaimProofType('image'); }
                              else { showAlert(t('common', 'error'), t('club', 'errorUploadClubCard')); }
                            }
                          }},
                          { text: t('player', 'fromGallery'), onPress: async () => {
                            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                            if (status !== 'granted') { showAlert(t('profile', 'permissionRequired'), t('profile', 'galleryPermission')); return; }
                            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
                            if (!result.canceled && result.assets[0]) {
                              setUploadingProof(true);
                              const uri = result.assets[0].uri;
                              const url = await uploadImageToStorage('club-cards', `claims/${user?.id}/${Date.now()}`, uri);
                              setUploadingProof(false);
                              if (url) { setClaimProofUri(uri); setClaimProofUrl(url); setClaimProofType('image'); }
                              else { showAlert(t('common', 'error'), t('club', 'errorUploadClubCard')); }
                            }
                          }},
                          { text: t('player', 'fromFiles'), onPress: async () => {
                            try {
                              const DocumentPicker = require('expo-document-picker');
                              const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
                              if (!result.canceled && result.assets && result.assets[0]) {
                                setUploadingProof(true);
                                const asset = result.assets[0];
                                const isPdf = asset.mimeType === 'application/pdf' || asset.name?.toLowerCase().endsWith('.pdf');
                                const ext = isPdf ? 'pdf' : (asset.name?.split('.').pop()?.toLowerCase() || 'jpg');
                                const storagePath = `claims/${user?.id}/${Date.now()}.${ext}`;
                                let base64Data: string;
                                if (Platform.OS === 'web') {
                                  const response = await fetch(asset.uri);
                                  const blob = await response.blob();
                                  base64Data = await new Promise<string>((resolve) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => { const r = reader.result as string; resolve(r.split(',')[1]); };
                                    reader.readAsDataURL(blob);
                                  });
                                } else {
                                  const FileSystem = require('expo-file-system');
                                  base64Data = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
                                }
                                const { error: uploadError } = await supabase.storage.from('club-cards').upload(storagePath, decode(base64Data), { contentType: asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'), upsert: true });
                                if (uploadError) throw uploadError;
                                const { data: urlData } = supabase.storage.from('club-cards').getPublicUrl(storagePath);
                                setUploadingProof(false);
                                if (urlData?.publicUrl) {
                                  setClaimProofUri(asset.uri);
                                  setClaimProofUrl(urlData.publicUrl);
                                  setClaimProofType(isPdf ? 'pdf' : 'image');
                                } else {
                                  showAlert(t('common', 'error'), t('club', 'errorUploadClubCard'));
                                }
                              }
                            } catch (e: any) {
                              setUploadingProof(false);
                              console.log('Error picking document for claim proof:', e);
                              showAlert(t('common', 'error'), e.message || t('club', 'errorUploadClubCard'));
                            }
                          }},
                          { text: t('common', 'cancel'), style: 'cancel' },
                        ]
                      );
                    }}
                  >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563EB12', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name="add-a-photo" size={24} color="#2563EB" />
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563EB' }}>{t('club', 'claimAddProof')}</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.pvNote}>
                <MaterialIcons name="info-outline" size={16} color={theme.primary} />
                <Text style={styles.pvNoteText}>
                  {language === 'fr'
                    ? 'Le proprietaire actuel recevra votre demande et pourra accepter ou refuser le transfert. En cas de transfert, il conservera un badge Contributeur.'
                    : 'The current owner will receive your request and can accept or decline the transfer. If accepted, they will keep a Contributor badge.'}
                </Text>
              </View>
            </ScrollView>
            <View style={styles.pvActions}>
              <Pressable style={styles.pvCancelBtn} onPress={() => setShowClaimModal(false)}>
                <Text style={styles.pvCancelText}>{t('common', 'cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.pvConfirmBtn, { backgroundColor: '#2563EB' }]}
                onPress={async () => {
                  if (!club || !user?.id || !club.userId) return;
                  setSubmittingClaim(true);
                  const { error } = await submitClubClaim({
                    clubId: club.id,
                    currentOwnerId: club.userId,
                    requesterUserId: user.id,
                    requesterName: user.username || user.email,
                    requesterEmail: user.email,
                    message: claimMessage.trim() || undefined,
                    proofUrl: claimProofUrl || undefined,
                  });
                  setSubmittingClaim(false);
                  if (error === 'claim_already_pending') {
                    showAlert(t('common', 'error'), t('club', 'claimAlreadyPending'));
                  } else if (error) {
                    showAlert(t('common', 'error'), error);
                  } else {
                    setClaimStatus('pending');
                    setShowClaimModal(false);
                    setClaimMessage('');
                    setClaimProofUri(null);
                    setClaimProofUrl(null);
                    setClaimProofType('image');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    showAlert(t('club', 'claimSent'), t('club', 'claimSentDesc'));
                  }
                }}
                disabled={submittingClaim}
              >
                {submittingClaim ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={18} color="#FFF" />
                    <Text style={styles.pvConfirmText}>{t('club', 'claimSubmit')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Proof Fullscreen Modal */}
      <Modal visible={!!showProofFullscreen} animationType="fade" transparent onRequestClose={() => setShowProofFullscreen(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}>
          <Pressable style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }} onPress={() => setShowProofFullscreen(null)}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="close" size={28} color="#FFF" />
            </View>
          </Pressable>
          {showProofFullscreen ? <Image source={{ uri: showProofFullscreen }} style={{ width: screenWidth, height: screenWidth * 1.4 }} contentFit="contain" transition={200} /> : null}
        </View>
      </Modal>

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
  claimNotifBtn: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'relative' as const,
  },
  claimNotifBadge: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: theme.surface,
  },
  claimNotifBadgeText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: '#FFF',
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
  clubIconPressable: {
    marginBottom: 16,
  },
  clubIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubLogoWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
  },
  clubLogoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  clubLogoEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
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

  // Verified badge
  verifiedBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB12',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // Claim styles
  claimButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#2563EB25',
    ...theme.shadows.card,
  },
  claimButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB12',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  claimButtonTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  claimButtonDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  claimStatusCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 14,
    ...theme.shadows.card,
  },
  claimStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  claimStatusTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#F59E0B',
  },
  claimStatusDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  claimCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#F59E0B30',
    ...theme.shadows.card,
  },
  claimCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 10,
  },
  claimAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  claimName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: theme.textPrimary,
  },
  claimEmail: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 1,
  },
  claimDate: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  claimMessageBox: {
    flexDirection: 'row' as const,
    gap: 8,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 12,
  },
  claimMessageText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
    fontStyle: 'italic' as const,
  },
  claimActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  claimDeclineBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  claimDeclineText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: theme.error,
  },
  claimAcceptBtn: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#10B981',
  },
  claimAcceptText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  claimInput: {
    flexDirection: 'row' as const,
    gap: 10,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  claimInputField: {
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: 'top' as const,
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
  pvActions: { flexDirection: 'row' as const, gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.border },
  pvCancelBtn: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 14, borderRadius: theme.borderRadius.md, backgroundColor: theme.backgroundSecondary },
  pvCancelText: { fontSize: 15, fontWeight: '600' as const, color: theme.textSecondary },
  pvConfirmBtn: { flex: 2, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, paddingVertical: 14, borderRadius: theme.borderRadius.md },
  pvConfirmText: { fontSize: 15, fontWeight: '700' as const, color: '#FFF' },

  // Co-Management
  coAdminCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, ...theme.shadows.card, borderWidth: 1, borderColor: '#7C3AED20' },
  coAdminHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  coAdminHeaderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#7C3AED12', alignItems: 'center' as const, justifyContent: 'center' as const },
  coAdminHeaderTitle: { fontSize: 15, fontWeight: '700' as const, color: theme.textPrimary },
  coAdminHeaderDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  coAdminAddBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#7C3AED12', alignItems: 'center' as const, justifyContent: 'center' as const },
  coAdminEmpty: { fontSize: 13, color: theme.textMuted, fontStyle: 'italic' as const, textAlign: 'center' as const, paddingVertical: 8 },
  coAdminItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.border },
  coAdminAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#7C3AED15', alignItems: 'center' as const, justifyContent: 'center' as const },
  coAdminAvatarText: { fontSize: 14, fontWeight: '700' as const, color: '#7C3AED' },
  coAdminName: { fontSize: 14, fontWeight: '600' as const, color: theme.textPrimary },
  coAdminEmail: { fontSize: 11, color: theme.textSecondary, marginTop: 1 },
  coAdminPermBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 6 },
  coAdminPermText: { fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  coAdminRemoveBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: '#FECACA' },
  coAdminBadgeCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: '#7C3AED08', borderRadius: theme.borderRadius.lg, padding: 14, borderWidth: 1, borderColor: '#7C3AED15' },
  coAdminBadgeText: { fontSize: 13, fontWeight: '600' as const, color: '#7C3AED', flex: 1 },
});
