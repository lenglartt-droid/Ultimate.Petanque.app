import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  Alert,
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
import { isSharedWithMe, saveSharedItemToMyAccount } from '@/services/shareService';
import { useAlert } from '@/template';

export default function TerrainDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { getTerrainById, tournaments, deleteTerrain, isFavoriteTerrain, toggleFavoriteTerrain } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    if (id) {
      isSharedWithMe('terrain', id).then(setIsShared);
    }
  }, [id]);
  
  const isFavorite = id ? isFavoriteTerrain(id) : false;

  const handleToggleFavorite = () => {
    if (id) {
      toggleFavoriteTerrain(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const terrain = getTerrainById(id || '');

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le terrain',
      `Êtes-vous sûr de vouloir supprimer "${terrain?.name}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
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
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
          <Text style={styles.emptyText}>Terrain non trouvé</Text>
        </View>
      </SafeAreaView>
    );
  }

  const typeConfig = config.terrainTypes.find(t => t.id === terrain.type) || config.terrainTypes[0];
  
  const typeColors: Record<string, { bg: string; text: string; light: string }> = {
    'Stabilisé': { bg: theme.primary, text: '#FFF', light: theme.primary + '15' },
    'Graviers': { bg: theme.warning, text: '#FFF', light: theme.warning + '15' },
    'Sable': { bg: '#F59E0B', text: '#FFF', light: '#F59E0B15' },
    'Cailloux': { bg: theme.textSecondary, text: '#FFF', light: theme.textSecondary + '15' },
    'Terre battue': { bg: theme.success, text: '#FFF', light: theme.success + '15' },
  };
  const colors = typeColors[terrain.type] || typeColors['Stabilisé'];

  // Get tournaments at this terrain
  const terrainTournaments = tournaments.filter(t => t.terrainId === terrain.id);

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
        <Text style={styles.headerTitle}>Détails du terrain</Text>
        <View style={styles.headerActions}>
          {isShared && (
            <Pressable
              style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
              onPress={async () => {
                setIsSaving(true);
                const { newItemId, error } = await saveSharedItemToMyAccount('terrain', id!);
                setIsSaving(false);
                if (error) {
                  showAlert('Erreur', error);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showAlert('Enregistre', 'Ce terrain a ete copie dans votre annuaire');
                  if (newItemId) router.replace(`/terrain/${newItemId}` as any);
                }
              }}
              disabled={isSaving}
            >
              <MaterialIcons name="save-alt" size={22} color={theme.accent} />
            </Pressable>
          )}
          <Pressable style={styles.shareButton} onPress={() => setShowShareModal(true)}>
            <MaterialIcons name="share" size={22} color={theme.success} />
          </Pressable>
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
          <Pressable 
            style={styles.editButton} 
            onPress={() => router.push(`/terrain/edit/${terrain.id}`)}
          >
            <MaterialIcons name="edit" size={22} color={theme.primary} />
          </Pressable>
          <Pressable 
            style={styles.deleteButton} 
            onPress={handleDelete}
          >
            <MaterialIcons name="delete" size={22} color={theme.error} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Gallery */}
        {hasPhotos ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.photoSection}>
            <Image
              source={{ uri: terrain.photos![currentPhotoIndex] }}
              style={styles.mainPhoto}
              contentFit="cover"
              transition={200}
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
            <View style={[styles.typeBadge, { backgroundColor: colors.light }]}>
              <MaterialIcons name={typeConfig.icon as any} size={16} color={colors.bg} />
              <Text style={[styles.typeBadgeText, { color: colors.bg }]}>{terrain.type}</Text>
            </View>
            <Text style={styles.typeDescription}>{typeConfig.description}</Text>
          </Animated.View>
        )}

        {/* Name and Type (when photos are shown) */}
        {hasPhotos && (
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.nameSection}>
            <Text style={styles.terrainNameLarge}>{terrain.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: colors.light }]}>
              <MaterialIcons name={typeConfig.icon as any} size={16} color={colors.bg} />
              <Text style={[styles.typeBadgeText, { color: colors.bg }]}>{terrain.type}</Text>
            </View>
            <Text style={styles.typeDescription}>{typeConfig.description}</Text>
          </Animated.View>
        )}

        {/* Quick Info */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.quickInfoGrid}>
          <View style={styles.quickInfoItem}>
            <View style={[styles.quickInfoIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="sports-soccer" size={20} color={theme.primary} />
            </View>
            <Text style={styles.quickInfoValue}>{terrain.courtsCount}</Text>
            <Text style={styles.quickInfoLabel}>Terrain{terrain.courtsCount > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <View style={[styles.quickInfoIcon, { backgroundColor: terrain.lighting ? theme.warning + '15' : theme.textMuted + '15' }]}>
              <MaterialIcons name="lightbulb" size={20} color={terrain.lighting ? theme.warning : theme.textMuted} />
            </View>
            <Text style={styles.quickInfoValue}>{terrain.lighting ? 'Oui' : 'Non'}</Text>
            <Text style={styles.quickInfoLabel}>Éclairage</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <View style={[styles.quickInfoIcon, { backgroundColor: terrain.covered ? theme.accent + '15' : theme.textMuted + '15' }]}>
              <MaterialIcons name="roofing" size={20} color={terrain.covered ? theme.accent : theme.textMuted} />
            </View>
            <Text style={styles.quickInfoValue}>{terrain.covered ? 'Oui' : 'Non'}</Text>
            <Text style={styles.quickInfoLabel}>Couvert</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <View style={[styles.quickInfoIcon, { backgroundColor: terrain.isPublic ? theme.success + '15' : theme.error + '15' }]}>
              <MaterialIcons name={terrain.isPublic ? 'public' : 'lock'} size={20} color={terrain.isPublic ? theme.success : theme.error} />
            </View>
            <Text style={styles.quickInfoValue}>{terrain.isPublic ? 'Public' : 'Privé'}</Text>
            <Text style={styles.quickInfoLabel}>Accès</Text>
          </View>
        </Animated.View>

        {/* Location */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
          <Text style={styles.sectionTitle}>ADRESSE</Text>
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
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>CLUB</Text>
            <Pressable 
              style={styles.clubCard}
              onPress={() => terrain.clubId && router.push(`/club/${terrain.clubId}`)}
            >
              <View style={styles.clubIcon}>
                <MaterialIcons name="home" size={24} color={theme.accent} />
              </View>
              <View style={styles.clubInfo}>
                <Text style={styles.clubName}>{terrain.clubName}</Text>
                <Text style={styles.clubSubtitle}>Club organisateur</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
            </Pressable>
          </Animated.View>
        )}

        {/* Description */}
        {terrain.description && (
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>DESCRIPTION</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{terrain.description}</Text>
            </View>
          </Animated.View>
        )}

        {/* Facilities */}
        {terrain.facilities && terrain.facilities.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>ÉQUIPEMENTS</Text>
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
        <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
          <Text style={styles.sectionTitle}>CONSEILS DE JEU</Text>
          <View style={[styles.tipsCard, { backgroundColor: colors.light, borderColor: colors.bg + '30' }]}>
            <View style={styles.tipsHeader}>
              <MaterialIcons name="tips-and-updates" size={24} color={colors.bg} />
              <Text style={[styles.tipsTitle, { color: colors.bg }]}>Terrain {terrain.type}</Text>
            </View>
            <View style={styles.tipsList}>
              {terrain.type === 'Stabilisé' && (
                <>
                  <Text style={styles.tipItem}>• Idéal pour le point roulé et tir régulier</Text>
                  <Text style={styles.tipItem}>• Sol dur et compact avec bon roulement</Text>
                  <Text style={styles.tipItem}>• Peu de trous, jeu précis possible</Text>
                </>
              )}
              {terrain.type === 'Graviers' && (
                <>
                  <Text style={styles.tipItem}>• Privilégiez le jeu porté</Text>
                  <Text style={styles.tipItem}>• Attention aux rebonds possibles</Text>
                  <Text style={styles.tipItem}>• Surface irrégulière, adaptation rapide nécessaire</Text>
                </>
              )}
              {terrain.type === 'Sable' && (
                <>
                  <Text style={styles.tipItem}>• Parfait pour le point plombé</Text>
                  <Text style={styles.tipItem}>• Les boules s'arrêtent rapidement</Text>
                  <Text style={styles.tipItem}>• Privilégiez le tir devant</Text>
                </>
              )}
              {terrain.type === 'Cailloux' && (
                <>
                  <Text style={styles.tipItem}>• Terrain très technique</Text>
                  <Text style={styles.tipItem}>• Rebonds imprévisibles</Text>
                  <Text style={styles.tipItem}>• Réservé aux joueurs expérimentés</Text>
                </>
              )}
              {terrain.type === 'Terre battue' && (
                <>
                  <Text style={styles.tipItem}>• Jeu adaptable selon la météo</Text>
                  <Text style={styles.tipItem}>• Peut devenir collant ou dur</Text>
                  <Text style={styles.tipItem}>• Surface évolutive pendant la partie</Text>
                </>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Upcoming Tournaments */}
        {terrainTournaments.length > 0 && (
          <Animated.View entering={FadeInUp.duration(400).delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>TOURNOIS À VENIR</Text>
            {terrainTournaments.slice(0, 3).map((tournament, index) => (
              <Pressable
                key={tournament.id}
                style={styles.tournamentCard}
                onPress={() => router.push(`/tournament/${tournament.id}`)}
              >
                <View style={styles.tournamentIcon}>
                  <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />
                </View>
                <View style={styles.tournamentInfo}>
                  <Text style={styles.tournamentName}>{tournament.name}</Text>
                  <Text style={styles.tournamentDate}>
                    {new Date(tournament.date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      {terrain && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          itemType="terrain"
          itemId={terrain.id}
          itemName={terrain.name}
        />
      )}
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
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...theme.shadows.card,
  },
  tournamentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
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
    marginBottom: 2,
  },
  tournamentDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
});
