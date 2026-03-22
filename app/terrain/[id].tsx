import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import ShareModal from '@/components/ui/ShareModal';
import ModificationLogsSection from '@/components/ui/ModificationLogsSection';
import SharedBadge from '@/components/ui/SharedBadge';
import MergePickerModal from '@/components/ui/MergePickerModal';
import { isSharedWithMe, saveSharedItemToMyAccount } from '@/services/shareService';
import { toggleItemPublic } from '@/services/publicItemsService';
import { getMeetupsForTerrain, Meetup } from '@/services/meetupService';
import { useAlert } from '@/template';
import { useAuth } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';

export default function TerrainDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getTerrainById, tournaments, deleteTerrain, isFavoriteTerrain, toggleFavoriteTerrain, getSharedPermission, setItemPublic, refreshData, loading: appLoading } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: any) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublicState, setIsPublicState] = useState(false);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [showAllTournaments, setShowAllTournaments] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [showPublicPreview, setShowPublicPreview] = useState(false);
  const [showSharePreview, setShowSharePreview] = useState(false);
  const { showAlert } = useAlert();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const sharedPermission = getSharedPermission(id || '');
  const isSharedItem = sharedPermission !== null;
  const isReadOnly = sharedPermission === 'read';
  const canEdit = !isReadOnly;

  const terrain = getTerrainById(id || '');

  useEffect(() => {
    if (id) {
      isSharedWithMe('terrain', id).then(setIsShared);
    }
  }, [id]);

  useEffect(() => {
    if (terrain) setIsPublicState(terrain.isPublic ?? false);
  }, [terrain?.id, terrain?.isPublic]);

  const handleOpenPublicPreview = () => {
    if (!terrain || togglingPublic || isSharedItem) return;
    Haptics.selectionAsync();
    setShowPublicPreview(true);
  };

  const handleConfirmPublic = async () => {
    if (!terrain) return;
    setTogglingPublic(true);
    Haptics.selectionAsync();
    const newVal = !isPublicState;
    const { error } = await toggleItemPublic('terrains', terrain.id, newVal);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      setIsPublicState(newVal);
      setItemPublic('terrains', terrain.id, newVal);
    }
    setTogglingPublic(false);
    setShowPublicPreview(false);
  };

  const handleOpenSharePreview = () => {
    if (!terrain) return;
    Haptics.selectionAsync();
    setShowSharePreview(true);
  };

  const handleConfirmShare = () => {
    setShowSharePreview(false);
    setShowShareModal(true);
  };
  
  const isFavorite = id ? isFavoriteTerrain(id) : false;

  const handleToggleFavorite = () => {
    if (id) {
      toggleFavoriteTerrain(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('terrain', 'deleteTerrain'),
      `${t('terrain', 'deleteConfirm')} "${terrain?.name}" ? ${t('terrain', 'deleteIrreversible')}`,
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: async () => {
            if (terrain) {
              await deleteTerrain(terrain.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (!terrain) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('terrain', 'terrainDetails')}</Text>
          <View style={{ width: 40 }} />
        </View>
        {appLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
            <Text style={styles.emptyText}>{t('terrain', 'terrainNotFound')}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const typeConfig = config.terrainTypes.find(tc => tc.id === terrain.type) || config.terrainTypes[0];
  
  const typeColors: Record<string, { bg: string; text: string; light: string }> = {
    'Stabilisé': { bg: theme.primary, text: '#FFF', light: theme.primary + '15' },
    'Graviers': { bg: theme.warning, text: '#FFF', light: theme.warning + '15' },
    'Sable': { bg: '#F59E0B', text: '#FFF', light: '#F59E0B15' },
    'Cailloux': { bg: theme.textSecondary, text: '#FFF', light: theme.textSecondary + '15' },
    'Terre battue': { bg: theme.success, text: '#FFF', light: theme.success + '15' },
  };
  const colors = typeColors[terrain.type] || typeColors['Stabilisé'];

  // Get tournaments at this terrain, sorted by status then date
  const terrainTournaments = React.useMemo(() => {
    const statusOrder: Record<string, number> = { 'En cours': 0, 'À venir': 1, 'Terminé': 2 };
    return tournaments
      .filter(t => t.terrainId === terrain.id)
      .sort((a, b) => {
        const sa = statusOrder[a.status] ?? 3;
        const sb = statusOrder[b.status] ?? 3;
        if (sa !== sb) return sa - sb;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [tournaments, terrain.id]);

  // Meetups state
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [meetupsLoading, setMeetupsLoading] = useState(false);

  useEffect(() => {
    if (terrain?.id) {
      setMeetupsLoading(true);
      getMeetupsForTerrain(terrain.id).then(({ meetups: m }) => {
        setMeetups(m);
        setMeetupsLoading(false);
      });
    }
  }, [terrain?.id]);

  // Check if terrain has photos
  const hasPhotos = terrain.photos && terrain.photos.length > 0;

  const openMaps = () => {
    const { latitude, longitude } = terrain.location;
    const label = encodeURIComponent(terrain.name);
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('terrain', 'terrainDetails')}</Text>
        <View style={styles.headerActions}>
          {isShared && (
            <Pressable
              style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
              onPress={async () => {
                setIsSaving(true);
                const { newItemId, error } = await saveSharedItemToMyAccount('terrain', id!);
                setIsSaving(false);
                if (error) {
                  showAlert(t('common', 'error'), error);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showAlert(t('terrain', 'savedLabel'), t('terrain', 'terrainCopied'));
                  if (newItemId) router.replace(`/terrain/${newItemId}` as any);
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
              onPress={() => router.push(`/terrain/edit/${terrain.id}`)}
            >
              <MaterialIcons name="edit" size={22} color={theme.primary} />
            </Pressable>
          )}
          {canEdit && !isSharedItem && (
            <Pressable 
              style={styles.deleteButton} 
              onPress={handleDelete}
            >
              <MaterialIcons name="delete" size={22} color={theme.error} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }, isTablet && styles.scrollContentTablet]}
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
        {/* Photo Gallery */}
        {hasPhotos ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.photoSection}>
            <Image
              source={{ uri: terrain.photos![currentPhotoIndex] }}
              style={styles.mainPhoto}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            {terrain.photos!.length > 1 && (
              <View style={styles.photoIndicators}>
                {terrain.photos!.map((_, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.photoIndicator,
                      index === currentPhotoIndex && styles.photoIndicatorActive
                    ]}
                    onPress={() => setCurrentPhotoIndex(index)}
                  />
                ))}
              </View>
            )}
            {terrain.photos!.length > 1 && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoThumbnails}
              >
                {terrain.photos!.map((photo, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.thumbnail,
                      index === currentPhotoIndex && styles.thumbnailActive
                    ]}
                    onPress={() => setCurrentPhotoIndex(index)}
                  >
                    <Image
                      source={{ uri: photo }}
                      style={styles.thumbnailImage}
                      contentFit="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
            <View style={[styles.terrainIcon, { backgroundColor: colors.bg }]}>
              <MaterialIcons name={typeConfig.icon as any} size={56} color="#FFF" />
            </View>
            <Text style={styles.terrainName}>{terrain.name}</Text>
            {sharedPermission ? (
              <View style={{ marginBottom: 8 }}>
                <SharedBadge permission={sharedPermission} />
              </View>
            ) : null}
            <View style={[styles.typeBadge, { backgroundColor: colors.light }]}>
              <MaterialIcons name={typeConfig.icon as any} size={16} color={colors.bg} />
              <Text style={[styles.typeBadgeText, { color: colors.bg }]}>{t('terrainTypes', terrain.type)}</Text>
            </View>
            <Text style={styles.typeDescription}>{t('terrainTypeDescs', terrain.type)}</Text>
          </Animated.View>
        )}

        {/* Name and Type (when photos are shown) */}
        {hasPhotos && (
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.nameSection}>
            <Text style={styles.terrainNameLarge}>{terrain.name}</Text>
            {sharedPermission ? (
              <View style={{ marginBottom: 8 }}>
                <SharedBadge permission={sharedPermission} />
              </View>
            ) : null}
            <View style={[styles.typeBadge, { backgroundColor: colors.light }]}>
              <MaterialIcons name={typeConfig.icon as any} size={16} color={colors.bg} />
              <Text style={[styles.typeBadgeText, { color: colors.bg }]}>{t('terrainTypes', terrain.type)}</Text>
            </View>
            <Text style={styles.typeDescription}>{t('terrainTypeDescs', terrain.type)}</Text>
          </Animated.View>
        )}

        {/* Quick Info */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.quickInfoGrid}>
          <View style={styles.quickInfoItem}>
            <View style={[styles.quickInfoIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="sports-soccer" size={20} color={theme.primary} />
            </View>
            <Text style={styles.quickInfoValue}>{terrain.courtsCount}</Text>
            <Text style={styles.quickInfoLabel}>{terrain.courtsCount > 1 ? t('terrain', 'courtsLabelPlural') : t('terrain', 'courtsLabel')}</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <View style={[styles.quickInfoIcon, { backgroundColor: terrain.lighting ? theme.warning + '15' : theme.textMuted + '15' }]}>
              <MaterialIcons name="lightbulb" size={20} color={terrain.lighting ? theme.warning : theme.textMuted} />
            </View>
            <Text style={styles.quickInfoValue}>{terrain.lighting ? t('terrain', 'yesLabel') : t('terrain', 'noLabel')}</Text>
            <Text style={styles.quickInfoLabel}>{t('terrain', 'lighting')}</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <View style={[styles.quickInfoIcon, { backgroundColor: terrain.covered ? theme.accent + '15' : theme.textMuted + '15' }]}>
              <MaterialIcons name="roofing" size={20} color={terrain.covered ? theme.accent : theme.textMuted} />
            </View>
            <Text style={styles.quickInfoValue}>{terrain.covered ? t('terrain', 'yesLabel') : t('terrain', 'noLabel')}</Text>
            <Text style={styles.quickInfoLabel}>{t('terrain', 'covered')}</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <View style={[styles.quickInfoIcon, { backgroundColor: terrain.publicAccess ? theme.success + '15' : theme.error + '15' }]}>
              <MaterialIcons name={terrain.publicAccess ? 'public' : 'lock'} size={20} color={terrain.publicAccess ? theme.success : theme.error} />
            </View>
            <Text style={styles.quickInfoValue}>{terrain.publicAccess ? t('terrain', 'publicLabel') : t('terrain', 'privateLabel')}</Text>
            <Text style={styles.quickInfoLabel}>{t('terrain', 'accessLabel')}</Text>
          </View>
        </Animated.View>

        <View style={isTablet ? styles.tabletRow : undefined}>
        {/* Location */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={[styles.section, isTablet && styles.tabletHalf]}>
          <Text style={styles.sectionTitle}>{t('terrain', 'addressSection')}</Text>
          <Pressable style={styles.locationCard} onPress={openMaps}>
            <View style={styles.locationIcon}>
              <MaterialIcons name="place" size={24} color={theme.primary} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationAddress}>{terrain.address}</Text>
              <Text style={styles.locationCity}>{terrain.city}</Text>
            </View>
            <MaterialIcons name="directions" size={24} color={theme.primary} />
          </Pressable>
        </Animated.View>

        {/* Club */}
        {terrain.clubName && (
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={[styles.section, isTablet && styles.tabletHalf]}>
            <Text style={styles.sectionTitle}>{t('terrain', 'clubSection')}</Text>
            <Pressable 
              style={styles.clubCard}
              onPress={() => terrain.clubId && router.push(`/club/${terrain.clubId}`)}
            >
              <View style={styles.clubIcon}>
                <MaterialIcons name="home" size={24} color={theme.accent} />
              </View>
              <View style={styles.clubInfo}>
                <Text style={styles.clubName}>{terrain.clubName}</Text>
                <Text style={styles.clubSubtitle}>{t('terrain', 'organizingClub')}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
            </Pressable>
          </Animated.View>
        )}

        </View>

        {/* Description */}
        {terrain.description && (
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('terrain', 'descriptionLabel')}</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{terrain.description}</Text>
            </View>
          </Animated.View>
        )}

        <View style={isTablet ? styles.tabletRow : undefined}>
        {/* Facilities */}
        {terrain.facilities && terrain.facilities.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={[styles.section, isTablet && styles.tabletHalf]}>
            <Text style={styles.sectionTitle}>{t('terrain', 'facilitiesSection')}</Text>
            <View style={styles.facilitiesGrid}>
              {terrain.facilities.map((facility, index) => (
                <View key={index} style={styles.facilityItem}>
                  <MaterialIcons name="check-circle" size={18} color={theme.success} />
                  <Text style={styles.facilityText}>{facility}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Terrain Type Tips */}
        <Animated.View entering={FadeInDown.duration(400).delay(350)} style={[styles.section, isTablet && styles.tabletHalf]}>
          <Text style={styles.sectionTitle}>{t('terrain', 'playingTips')}</Text>
          <View style={[styles.tipsCard, { backgroundColor: colors.light, borderColor: colors.bg + '30' }]}>
            <View style={styles.tipsHeader}>
              <MaterialIcons name="tips-and-updates" size={24} color={colors.bg} />
              <Text style={[styles.tipsTitle, { color: colors.bg }]}>{t('terrain', 'terrainType')} {t('terrainTypes', terrain.type)}</Text>
            </View>
            <View style={styles.tipsList}>
              {terrain.type === 'Stabilisé' && (
                <>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipStabilise1')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipStabilise2')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipStabilise3')}</Text>
                </>
              )}
              {terrain.type === 'Graviers' && (
                <>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipGraviers1')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipGraviers2')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipGraviers3')}</Text>
                </>
              )}
              {terrain.type === 'Sable' && (
                <>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipSable1')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipSable2')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipSable3')}</Text>
                </>
              )}
              {terrain.type === 'Cailloux' && (
                <>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipCailloux1')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipCailloux2')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipCailloux3')}</Text>
                </>
              )}
              {terrain.type === 'Terre battue' && (
                <>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipTerreBattue1')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipTerreBattue2')}</Text>
                  <Text style={styles.tipItem}>• {t('terrain', 'tipTerreBattue3')}</Text>
                </>
              )}
            </View>
          </View>
        </Animated.View>

        </View>

        {/* Upcoming Meetups */}
        <Animated.View entering={FadeInDown.duration(400).delay(370)} style={styles.section}>
          <View style={styles.meetupSectionHeader}>
            <Text style={styles.sectionTitle}>{t('meetup', 'upcomingMeetups').toUpperCase()}</Text>
            <Pressable
              style={styles.meetupAddBtn}
              onPress={() => router.push({ pathname: '/meetup/new', params: { terrainId: terrain.id } } as any)}
            >
              <MaterialIcons name="add" size={18} color={theme.primary} />
              <Text style={styles.meetupAddBtnText}>{t('meetup', 'createMeetupShort')}</Text>
            </Pressable>
          </View>
          {meetups.length > 0 ? (
            meetups.slice(0, 5).map((m, idx) => {
              const mDate = new Date(m.date);
              const isOwner = user && m.creator_id === user.id;
              return (
                <Pressable
                  key={m.id}
                  style={styles.meetupCard}
                  onPress={() => router.push(`/meetup/${m.id}` as any)}
                >
                  <View style={styles.meetupDateBadge}>
                    <Text style={styles.meetupDateDay}>{mDate.getDate()}</Text>
                    <Text style={styles.meetupDateMonth}>{mDate.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                  </View>
                  <View style={styles.meetupCardContent}>
                    <Text style={styles.meetupCardTitle} numberOfLines={1}>{m.title}</Text>
                    <Text style={styles.meetupCardTime}>
                      {mDate.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  {isOwner ? (
                    <View style={styles.meetupOwnerBadge}>
                      <MaterialIcons name="person" size={12} color={theme.primary} />
                    </View>
                  ) : null}
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </Pressable>
              );
            })
          ) : (
            <View style={styles.meetupEmptyCard}>
              <MaterialIcons name="event" size={32} color={theme.textMuted} />
              <Text style={styles.meetupEmptyText}>{t('meetup', 'noMeetups')}</Text>
            </View>
          )}
        </Animated.View>

        {/* Associated Tournaments */}
        <Animated.View entering={FadeInUp.duration(400).delay(400)} style={styles.section}>
          <View style={styles.tournamentSectionHeader}>
            <Text style={styles.sectionTitle}>{t('terrain', 'associatedTournaments').toUpperCase()}</Text>
            {terrainTournaments.length > 0 ? (
              <View style={styles.tournamentCountBadge}>
                <Text style={styles.tournamentCountText}>{terrainTournaments.length}</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }} />
            <Pressable
              style={styles.tournamentAddBtn}
              onPress={() => router.push({ pathname: '/tournament/new', params: { terrainId: terrain.id, terrainName: terrain.name } } as any)}
            >
              <MaterialIcons name="add" size={16} color={theme.carreauColor} />
              <Text style={styles.tournamentAddBtnText}>{t('terrain', 'addTournamentHere')}</Text>
            </Pressable>
          </View>

          {terrainTournaments.length > 0 ? (
            <>
              {(showAllTournaments ? terrainTournaments : terrainTournaments.slice(0, 3)).map((tournament) => {
                const statusConfig: Record<string, { bg: string; color: string; icon: string }> = {
                  'À venir': { bg: theme.primary + '15', color: theme.primary, icon: 'event' },
                  'En cours': { bg: theme.warning + '15', color: theme.warning, icon: 'play-circle-filled' },
                  'Terminé': { bg: theme.success + '15', color: theme.success, icon: 'check-circle' },
                };
                const sc = statusConfig[tournament.status] || statusConfig['À venir'];
                return (
                  <Pressable
                    key={tournament.id}
                    style={({ pressed }) => [styles.tournamentCard, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
                    onPress={() => router.push(`/tournament/${tournament.id}`)}
                  >
                    <View style={[styles.tournamentIcon, { backgroundColor: sc.bg }]}>
                      <MaterialIcons name="emoji-events" size={20} color={sc.color} />
                    </View>
                    <View style={styles.tournamentInfo}>
                      <Text style={styles.tournamentName} numberOfLines={1}>{tournament.name}</Text>
                      <View style={styles.tournamentMetaRow}>
                        <MaterialIcons name="event" size={11} color={theme.textMuted} />
                        <Text style={styles.tournamentDate}>
                          {new Date(tournament.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                        <View style={styles.tournamentDot} />
                        <Text style={styles.tournamentFormat}>{tournament.format}</Text>
                      </View>
                      <View style={[styles.tournamentStatusBadge, { backgroundColor: sc.bg }]}>
                        <MaterialIcons name={sc.icon as any} size={10} color={sc.color} />
                        <Text style={[styles.tournamentStatusText, { color: sc.color }]}>
                          {tournament.status === 'À venir' ? t('tournamentStatus', 'upcoming') : tournament.status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'completed')}
                        </Text>
                      </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                  </Pressable>
                );
              })}
              {terrainTournaments.length > 3 && !showAllTournaments ? (
                <Pressable
                  style={({ pressed }) => [styles.showAllTournamentsBtn, pressed && { opacity: 0.75 }]}
                  onPress={() => setShowAllTournaments(true)}
                >
                  <Text style={styles.showAllTournamentsText}>
                    {t('terrain', 'showAllTournaments')} ({terrainTournaments.length - 3} {language === 'fr' ? 'de plus' : 'more'})
                  </Text>
                  <MaterialIcons name="expand-more" size={18} color={theme.carreauColor} />
                </Pressable>
              ) : null}
              {showAllTournaments && terrainTournaments.length > 3 ? (
                <Pressable
                  style={({ pressed }) => [styles.showAllTournamentsBtn, pressed && { opacity: 0.75 }]}
                  onPress={() => setShowAllTournaments(false)}
                >
                  <Text style={styles.showAllTournamentsText}>{language === 'fr' ? 'Voir moins' : 'Show less'}</Text>
                  <MaterialIcons name="expand-less" size={18} color={theme.carreauColor} />
                </Pressable>
              ) : null}
            </>
          ) : (
            <View style={styles.tournamentEmptyCard}>
              <View style={styles.tournamentEmptyIconBg}>
                <MaterialIcons name="emoji-events" size={32} color={theme.textMuted} />
              </View>
              <Text style={styles.tournamentEmptyText}>{t('terrain', 'noAssociatedTournaments')}</Text>
              <Pressable
                style={({ pressed }) => [styles.tournamentEmptyBtn, pressed && { opacity: 0.85 }]}
                onPress={() => router.push({ pathname: '/tournament/new', params: { terrainId: terrain.id, terrainName: terrain.name } } as any)}
              >
                <MaterialIcons name="add" size={16} color="#FFF" />
                <Text style={styles.tournamentEmptyBtnText}>{t('terrain', 'addTournamentHere')}</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
        {/* Visibility Toggle - only for owner */}
        {canEdit && !isSharedItem && (
          <Animated.View entering={FadeInDown.duration(400).delay(420)} style={styles.section}>
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
          itemType="terrain"
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
                <Text style={styles.pvHeaderTitle}>{t('preview', 'publicTerrainTitle')}</Text>
                <Text style={styles.pvHeaderSub}>{t('preview', 'publicTerrainDesc')}</Text>
              </View>
              <Pressable style={styles.pvCloseBtn} onPress={() => setShowPublicPreview(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.pvScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={styles.pvCard}>
                <View style={styles.pvAvatarRow}>
                  <View style={[styles.pvAvatar, { backgroundColor: colors.bg }]}>
                    <MaterialIcons name={typeConfig.icon as any} size={28} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pvName}>{terrain.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <MaterialIcons name={typeConfig.icon as any} size={14} color={colors.bg} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.bg }}>{t('terrainTypes', terrain.type)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.pvLocationRow}>
                  <MaterialIcons name="place" size={14} color={theme.textSecondary} />
                  <Text style={styles.pvLocationText}>{terrain.address}, {terrain.city}</Text>
                </View>

                {terrain.clubName ? (
                  <View style={styles.pvInfoRow}>
                    <View style={styles.pvInfoPill}>
                      <MaterialIcons name="home" size={12} color={theme.accent} />
                      <Text style={[styles.pvInfoText, { color: theme.accent }]}>{terrain.clubName}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.pvStatsRow}>
                  <View style={styles.pvStatItem}>
                    <Text style={styles.pvStatValue}>{terrain.courtsCount}</Text>
                    <Text style={styles.pvStatLabel}>{terrain.courtsCount > 1 ? t('terrain', 'courtsLabelPlural') : t('terrain', 'courtsLabel')}</Text>
                  </View>
                  <View style={styles.pvStatDivider} />
                  <View style={styles.pvStatItem}>
                    <Text style={[styles.pvStatValue, { color: terrain.lighting ? theme.warning : theme.textMuted }]}>{terrain.lighting ? t('terrain', 'yesLabel') : t('terrain', 'noLabel')}</Text>
                    <Text style={styles.pvStatLabel}>{t('terrain', 'lighting')}</Text>
                  </View>
                  <View style={styles.pvStatDivider} />
                  <View style={styles.pvStatItem}>
                    <Text style={[styles.pvStatValue, { color: terrain.covered ? theme.accent : theme.textMuted }]}>{terrain.covered ? t('terrain', 'yesLabel') : t('terrain', 'noLabel')}</Text>
                    <Text style={styles.pvStatLabel}>{t('terrain', 'covered')}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.pvNote}>
                <MaterialIcons name="map" size={16} color={theme.primary} />
                <Text style={styles.pvNoteText}>{t('preview', 'geoNoteTerrain')}</Text>
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
                <Text style={styles.pvReadOnlyText}>{t('preview', 'readOnlyTerrain')}</Text>
              </View>

              <View style={styles.pvCard}>
                <View style={styles.pvAvatarRow}>
                  <View style={[styles.pvAvatar, { backgroundColor: colors.bg }]}>
                    <MaterialIcons name={typeConfig.icon as any} size={28} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pvName}>{terrain.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <MaterialIcons name={typeConfig.icon as any} size={14} color={colors.bg} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.bg }}>{t('terrainTypes', terrain.type)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.pvLocationRow}>
                  <MaterialIcons name="place" size={14} color={theme.textSecondary} />
                  <Text style={styles.pvLocationText}>{terrain.address}, {terrain.city}</Text>
                </View>

                {terrain.clubName ? (
                  <View style={styles.pvInfoRow}>
                    <View style={styles.pvInfoPill}>
                      <MaterialIcons name="home" size={12} color={theme.accent} />
                      <Text style={[styles.pvInfoText, { color: theme.accent }]}>{terrain.clubName}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.pvStatsRow}>
                  <View style={styles.pvStatItem}>
                    <Text style={styles.pvStatValue}>{terrain.courtsCount}</Text>
                    <Text style={styles.pvStatLabel}>{terrain.courtsCount > 1 ? t('terrain', 'courtsLabelPlural') : t('terrain', 'courtsLabel')}</Text>
                  </View>
                  <View style={styles.pvStatDivider} />
                  <View style={styles.pvStatItem}>
                    <Text style={[styles.pvStatValue, { color: terrain.lighting ? theme.warning : theme.textMuted }]}>{terrain.lighting ? t('terrain', 'yesLabel') : t('terrain', 'noLabel')}</Text>
                    <Text style={styles.pvStatLabel}>{t('terrain', 'lighting')}</Text>
                  </View>
                  <View style={styles.pvStatDivider} />
                  <View style={styles.pvStatItem}>
                    <Text style={[styles.pvStatValue, { color: terrain.covered ? theme.accent : theme.textMuted }]}>{terrain.covered ? t('terrain', 'yesLabel') : t('terrain', 'noLabel')}</Text>
                    <Text style={styles.pvStatLabel}>{t('terrain', 'covered')}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.pvNote}>
                <MaterialIcons name="visibility" size={16} color={theme.primary} />
                <Text style={styles.pvNoteText}>{t('preview', 'shareNoteTerrain')}</Text>
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

      {terrain && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          itemType="terrain"
          itemId={terrain.id}
          itemName={terrain.name}
        />
      )}

      <MergePickerModal
        visible={showMergePicker}
        onClose={() => setShowMergePicker(false)}
        itemType="terrain"
        currentItemId={id!}
      />
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
  tabletRow: {
    flexDirection: 'row' as const,
    gap: 16,
  },
  tabletHalf: {
    flex: 1,
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
  // Photo Section
  photoSection: {
    marginBottom: 16,
  },
  mainPhoto: {
    width: '100%',
    height: 220,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.backgroundSecondary,
  },
  photoIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  photoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.border,
  },
  photoIndicatorActive: {
    backgroundColor: theme.primary,
    width: 24,
  },
  photoThumbnails: {
    gap: 8,
    paddingTop: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: theme.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  // Name Section (when photos are shown)
  nameSection: {
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  terrainNameLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  // Hero Section (when no photos)
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  terrainIcon: {
    width: 120,
    height: 120,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...theme.shadows.cardElevated,
  },
  terrainName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    marginBottom: 8,
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  typeDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  quickInfoGrid: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 24,
    ...theme.shadows.card,
  },
  quickInfoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  quickInfoLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
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
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 12,
    ...theme.shadows.card,
  },
  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  locationCity: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 12,
    ...theme.shadows.card,
  },
  clubIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  clubSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  descriptionCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  descriptionText: {
    fontSize: 15,
    color: theme.textPrimary,
    lineHeight: 22,
  },
  facilitiesGrid: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 12,
    ...theme.shadows.card,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  facilityText: {
    fontSize: 15,
    color: theme.textPrimary,
  },
  tipsCard: {
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  tournamentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tournamentCountBadge: {
    backgroundColor: theme.carreauColor + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tournamentCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.carreauColor,
  },
  tournamentAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.carreauColor + '12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tournamentAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.carreauColor,
  },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...theme.shadows.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tournamentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.carreauColor + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  tournamentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  tournamentDate: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  tournamentDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.textMuted,
    marginHorizontal: 2,
  },
  tournamentFormat: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  tournamentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start' as const,
  },
  tournamentStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  showAllTournamentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    backgroundColor: theme.carreauColor + '08',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.carreauColor + '18',
    marginTop: 4,
  },
  showAllTournamentsText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.carreauColor,
  },
  tournamentEmptyCard: {
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
    ...theme.shadows.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tournamentEmptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.carreauColor + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tournamentEmptyText: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
  },
  tournamentEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.carreauColor,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  tournamentEmptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
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

  // Meetup section
  meetupSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  meetupAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '12', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  meetupAddBtnText: { fontSize: 12, fontWeight: '700', color: theme.primary },
  meetupCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, ...theme.shadows.card, borderWidth: 1, borderColor: theme.border },
  meetupDateBadge: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center' },
  meetupDateDay: { fontSize: 18, fontWeight: '900', color: theme.primary, lineHeight: 20 },
  meetupDateMonth: { fontSize: 9, fontWeight: '700', color: theme.primary, letterSpacing: 0.5 },
  meetupCardContent: { flex: 1 },
  meetupCardTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  meetupCardTime: { fontSize: 13, color: theme.textSecondary },
  meetupOwnerBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  meetupEmptyCard: { alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, paddingVertical: 24, gap: 8, ...theme.shadows.card, borderWidth: 1, borderColor: theme.border },
  meetupEmptyText: { fontSize: 14, color: theme.textMuted },

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
  pvAvatar: { width: 56, height: 56, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
  pvName: { fontSize: 18, fontWeight: '700' as const, color: theme.textPrimary },
  pvLocationRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginBottom: 8 },
  pvLocationText: { fontSize: 12, color: theme.textSecondary },
  pvInfoRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 10 },
  pvInfoPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.surface, borderRadius: 12 },
  pvInfoText: { fontSize: 12, fontWeight: '600' as const },
  pvStatsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, paddingVertical: 10, paddingHorizontal: 12 },
  pvStatItem: { alignItems: 'center' as const, flex: 1 },
  pvStatValue: { fontSize: 16, fontWeight: '700' as const, color: theme.textPrimary },
  pvStatLabel: { fontSize: 9, color: theme.textSecondary, marginTop: 1, textTransform: 'uppercase' as const },
  pvStatDivider: { width: 1, height: 24, backgroundColor: theme.border, marginHorizontal: 6 },
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
