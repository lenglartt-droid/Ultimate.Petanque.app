import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Image } from 'expo-image';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import ShareModal from '@/components/ui/ShareModal';
import { toggleItemPublic } from '@/services/publicItemsService';

export default function MyPlayerCardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { selfPlayer, userStats, challengeStats, matches, challenges, setItemPublic, getTerrainById, players } = useApp();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [isPublic, setIsPublic] = React.useState(selfPlayer?.isPublic ?? false);
  const [togglingPublic, setTogglingPublic] = React.useState(false);

  // Federation card state
  const [federationCardUrl, setFederationCardUrl] = React.useState<string | null>(null);
  const [federationCardType, setFederationCardType] = React.useState<'image' | 'pdf'>('image');
  const [uploadingCard, setUploadingCard] = React.useState(false);
  const [showFullscreen, setShowFullscreen] = React.useState(false);
  const [loadingCard, setLoadingCard] = React.useState(true);

  const [screenDims, setScreenDims] = React.useState(() => Dimensions.get('window'));
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenDims(window));
    return () => sub?.remove();
  }, []);
  const screenWidth = Math.max(1, screenDims.width);
  const screenHeight = Math.max(1, screenDims.height);

  // Load federation card URL
  React.useEffect(() => {
    if (!user?.id) return;
    const loadCard = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('federation_card_url')
          .eq('id', user.id)
          .single();
        if (!error && data?.federation_card_url) {
          setFederationCardUrl(data.federation_card_url);
          setFederationCardType(data.federation_card_url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image');
        }
      } catch (e) {
        console.log('Error loading federation card:', e);
      } finally {
        setLoadingCard(false);
      }
    };
    loadCard();
  }, [user?.id]);

  React.useEffect(() => {
    if (selfPlayer) setIsPublic(selfPlayer.isPublic ?? false);
  }, [selfPlayer?.isPublic]);

  const handleTogglePublic = React.useCallback(async () => {
    if (!selfPlayer || togglingPublic) return;
    setTogglingPublic(true);
    Haptics.selectionAsync();
    const newVal = !isPublic;
    const { error } = await toggleItemPublic('players', selfPlayer.id, newVal);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      setIsPublic(newVal);
      setItemPublic('players', selfPlayer.id, newVal);
    }
    setTogglingPublic(false);
  }, [selfPlayer, isPublic, togglingPublic, showAlert, t]);

  // Federation card upload
  const uploadFederationFile = async (fileUri: string, fileName: string, mimeType: string) => {
    if (!user?.id) return;
    setUploadingCard(true);
    try {
      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const storagePath = `${user.id}/federation_card_${Date.now()}.${fileExt}`;

      let base64Data: string;
      if (Platform.OS === 'web') {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
      } else {
        base64Data = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const { error: uploadError } = await supabase.storage
        .from('federation-cards')
        .upload(storagePath, decode(base64Data), {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('federation-cards')
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      // Save URL to user_profiles
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ federation_card_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setFederationCardUrl(publicUrl);
      setFederationCardType(fileExt === 'pdf' ? 'pdf' : 'image');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('common', 'success'), t('player', 'federationCardUpdated'));
    } catch (error: any) {
      console.log('Error uploading federation card:', error);
      showAlert(t('common', 'error'), error.message || t('player', 'errorUploadFederationCard'));
    } finally {
      setUploadingCard(false);
    }
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('profile', 'permissionRequired'), t('profile', 'galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      await uploadFederationFile(asset.uri, `federation.${ext}`, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    }
  };

  const handlePickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert(t('profile', 'permissionRequired'), t('profile', 'cameraPermission'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      await uploadFederationFile(asset.uri, `federation.${ext}`, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        await uploadFederationFile(
          file.uri,
          file.name || 'federation.pdf',
          file.mimeType || 'application/pdf'
        );
      }
    } catch (error: any) {
      console.log('Error picking document:', error);
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      t('player', 'chooseSource'),
      t('player', 'federationCardDesc'),
      [
        { text: t('player', 'fromCamera'), onPress: handlePickFromCamera },
        { text: t('player', 'fromGallery'), onPress: handlePickFromGallery },
        { text: t('player', 'fromFiles'), onPress: handlePickDocument },
        { text: t('common', 'cancel'), style: 'cancel' },
      ]
    );
  };

  const handleRemoveFederationCard = () => {
    Alert.alert(
      t('player', 'removeFederationCard'),
      '',
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            try {
              await supabase
                .from('user_profiles')
                .update({ federation_card_url: null })
                .eq('id', user.id);
              setFederationCardUrl(null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showAlert(t('common', 'success'), t('player', 'federationCardRemoved'));
            } catch (error: any) {
              showAlert(t('common', 'error'), error.message);
            }
          },
        },
      ]
    );
  };

  const handleCardPress = () => {
    if (!federationCardUrl) return;
    if (federationCardType === 'pdf') {
      Linking.openURL(federationCardUrl);
    } else {
      setShowFullscreen(true);
    }
  };

  // Resolve profile terrain - with fallback to terrainName for shared contexts
  const profileTerrainEntity = selfPlayer?.terrainId ? getTerrainById(selfPlayer.terrainId) : null;
  const profileTerrainName = profileTerrainEntity?.name || selfPlayer?.terrainName || null;

  // Calculate preferred role from match history
  const roleAnalysis = React.useMemo(() => {
    if (!selfPlayer) return { roleCounts: {}, totalWithRoles: 0, preferredRole: 'Milieu' };
    
    const roleCounts: Record<string, number> = { 'Pointeur': 0, 'Milieu': 0, 'Tireur': 0 };
    
    matches.forEach(match => {
      if (match.teamA.playerRoles) {
        match.teamA.playerRoles.forEach(pr => {
          if (pr.playerId === selfPlayer.id && roleCounts[pr.role] !== undefined) {
            roleCounts[pr.role]++;
          }
        });
      }
    });
    
    const totalWithRoles = Object.values(roleCounts).reduce((a, b) => a + b, 0);
    const preferredRole = totalWithRoles > 0 
      ? Object.entries(roleCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0]
      : selfPlayer?.role || 'Milieu';
    
    return { roleCounts, totalWithRoles, preferredRole };
  }, [matches, selfPlayer]);

  const roleIcons: Record<string, { icon: string; color: string }> = {
    'Pointeur': { icon: 'radio-button-on', color: '#3B82F6' },
    'Milieu': { icon: 'swap-horiz', color: '#8B5CF6' },
    'Tireur': { icon: 'gps-fixed', color: '#F97316' },
  };

  // Terrain type analysis from match history
  const terrainAnalysis = React.useMemo(() => {
    if (!selfPlayer) return { terrainCounts: {} as Record<string, number>, totalWithTerrain: 0, preferredTerrain: '' };

    const terrainCounts: Record<string, number> = {};

    matches.forEach(match => {
      if (match.terrainType) {
        terrainCounts[match.terrainType] = (terrainCounts[match.terrainType] || 0) + 1;
      }
    });

    const totalWithTerrain = Object.values(terrainCounts).reduce((a, b) => a + b, 0);
    const preferredTerrain = totalWithTerrain > 0
      ? Object.entries(terrainCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0]
      : '';

    return { terrainCounts, totalWithTerrain, preferredTerrain };
  }, [matches, selfPlayer]);

  // Partner analysis from match history
  const partnerAnalysis = React.useMemo(() => {
    if (!selfPlayer) return { partnerCounts: {} as Record<string, { count: number; name: string }>, totalWithPartners: 0, preferredPartner: { id: '', name: '', count: 0 } };

    const partnerCounts: Record<string, { count: number; name: string }> = {};

    matches.forEach(match => {
      const inTeamA = match.teamA.players.includes(selfPlayer.id);
      const inTeamB = match.teamB.players.includes(selfPlayer.id);

      if (inTeamA && match.teamA.players.length > 1) {
        match.teamA.players.forEach((pid, idx) => {
          if (pid !== selfPlayer.id) {
            if (!partnerCounts[pid]) {
              partnerCounts[pid] = { count: 0, name: match.teamA.playerNames[idx] || pid };
            }
            partnerCounts[pid].count++;
          }
        });
      } else if (inTeamB && match.teamB.players.length > 1) {
        match.teamB.players.forEach((pid, idx) => {
          if (pid !== selfPlayer.id) {
            if (!partnerCounts[pid]) {
              partnerCounts[pid] = { count: 0, name: match.teamB.playerNames[idx] || pid };
            }
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
  }, [matches, selfPlayer]);

  const partnerColors = ['#3B82F6', '#8B5CF6', '#F97316', '#10B981', '#EC4899', '#6366F1', '#14B8A6'];

  const terrainTypeIcons: Record<string, { icon: string; color: string }> = {
    'Stabilisé': { icon: 'landscape', color: '#6B7280' },
    'Graviers': { icon: 'grain', color: '#92400E' },
    'Sable': { icon: 'beach-access', color: '#D97706' },
    'Cailloux': { icon: 'terrain', color: '#6D28D9' },
    'Terre battue': { icon: 'grass', color: '#15803D' },
  };

  // Calculate detailed stats
  const totalMatches = matches.length;
  const tournamentMatches = matches.filter(m => m.mode === 'Tournoi');
  const trainingMatches = matches.filter(m => m.mode === 'Entraînement');
  
  let totalTirs = 0;
  let totalTirsSuccess = 0;
  let totalPoints = 0;
  let totalPointsSuccess = 0;
  let totalCarreaux = 0;

  matches.forEach(m => {
    if (m.playerActions) {
      m.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
        totalTirs += pa.actions.tirs;
        totalTirsSuccess += pa.actions.tirsSuccess;
        totalPoints += pa.actions.points;
        totalPointsSuccess += pa.actions.pointsSuccess;
        totalCarreaux += pa.actions.carreaux;
      });
    }
  });

  const tirRate = totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : 0;
  const pointRate = totalPoints > 0 ? Math.round((totalPointsSuccess / totalPoints) * 100) : 0;
  const carreauRate = totalTirsSuccess > 0 ? Math.round((totalCarreaux / totalTirsSuccess) * 100) : 0;

  if (!selfPlayer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{t('player', 'loadingCard')}</Text>
        </View>
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
        <Text style={styles.headerTitle}>{t('player', 'myPlayerCard')}</Text>
        <View style={styles.headerActions}>
          <Pressable 
            style={styles.shareButton}
            onPress={() => setShowShareModal(true)}
          >
            <MaterialIcons name="share" size={20} color={theme.success} />
          </Pressable>
          <Pressable 
            style={styles.editButton}
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: '/profile', params: { edit: 'true' } } as any);
            }}
          >
            <MaterialIcons name="edit" size={20} color={theme.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }, screenWidth >= 600 && styles.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
      >
        {/* Player Card Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.playerCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {selfPlayer.avatar ? (
                <Image
                  source={{ uri: selfPlayer.avatar }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {selfPlayer.name?.charAt(0).toUpperCase() || '?'}
                </Text>
              )}
            </View>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(selfPlayer.role) }]}>
              <MaterialIcons name={getRoleIcon(selfPlayer.role)} size={14} color="#FFF" />
            </View>
          </View>
          
          <Text style={styles.playerName}>{selfPlayer.name}</Text>
          {selfPlayer.nickname ? (
            <Text style={styles.playerNickname}>"{selfPlayer.nickname}"</Text>
          ) : null}
          
          <View style={styles.playerMeta}>
            <View style={styles.metaItem}>
              <MaterialIcons name={getRoleIcon(selfPlayer.role)} size={16} color={theme.textSecondary} />
              <Text style={styles.metaText}>{t('roles', selfPlayer.role)}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <MaterialIcons name="trending-up" size={16} color={theme.textSecondary} />
              <Text style={styles.metaText}>{t('levels', selfPlayer.level)}</Text>
            </View>
          </View>

          {/* Contact Section */}
          {(selfPlayer.phone || selfPlayer.email) && (
            <>
            <View style={styles.profileSectionDivider}>
              <MaterialIcons name="contact-phone" size={15} color={theme.primary} />
              <Text style={styles.profileSectionLabel}>Contact</Text>
              <View style={styles.profileSectionLine} />
            </View>
            <View style={styles.contactSection}>
              {selfPlayer.phone && (
                <Pressable
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`tel:${selfPlayer.phone}`)}
                >
                  <MaterialIcons name="phone" size={16} color={theme.primary} />
                  <Text style={styles.contactText}>{selfPlayer.phone}</Text>
                </Pressable>
              )}
              {selfPlayer.email && (
                <Pressable
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`mailto:${selfPlayer.email}`)}
                >
                  <MaterialIcons name="email" size={16} color={theme.primary} />
                  <Text style={styles.contactText}>{selfPlayer.email}</Text>
                </Pressable>
              )}
            </View>
            </>
          )}

          {/* Informations Section */}
          <View style={styles.profileSectionDivider}>
            <MaterialIcons name="info-outline" size={15} color={theme.textSecondary} />
            <Text style={styles.profileSectionLabel}>Informations</Text>
            <View style={styles.profileSectionLine} />
          </View>
          {/* Club Info */}
          {selfPlayer.club ? (
            <View style={styles.clubBadge}>
              <MaterialIcons name="location-city" size={16} color={theme.accent} />
              <Text style={styles.clubText}>{selfPlayer.club}</Text>
            </View>
          ) : (
            <Pressable 
              style={styles.addClubButton}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/profile');
              }}
            >
              <MaterialIcons name="add-circle-outline" size={16} color={theme.primary} />
              <Text style={styles.addClubText}>{t('player', 'addClub')}</Text>
            </Pressable>
          )}
          
          {/* Terrain de pratique */}
          {profileTerrainEntity ? (
            <Pressable 
              style={styles.terrainBadge}
              onPress={() => router.push(`/terrain/${profileTerrainEntity.id}`)}
            >
              <MaterialIcons name="sports-soccer" size={16} color={theme.success} />
              <Text style={styles.terrainBadgeText}>{profileTerrainEntity.name}</Text>
              <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
            </Pressable>
          ) : profileTerrainName ? (
            <View style={styles.terrainBadge}>
              <MaterialIcons name="sports-soccer" size={16} color={theme.success} />
              <Text style={styles.terrainBadgeText}>{profileTerrainName}</Text>
            </View>
          ) : null}

          {/* Location */}
          {(selfPlayer.location?.city || selfPlayer.country) ? (
            <View style={styles.locationBadge}>
              <MaterialIcons name="place" size={16} color={theme.textSecondary} />
              <Text style={styles.locationText}>
                {[selfPlayer.location?.city, selfPlayer.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}

          {/* Handedness */}
          {selfPlayer.handedness ? (
            <View style={styles.handednessContainer}>
              <MaterialIcons 
                name={selfPlayer.handedness === 'left' ? 'front-hand' : selfPlayer.handedness === 'ambidextrous' ? 'swap-horiz' : 'back-hand'} 
                size={16} 
                color="#6366F1" 
              />
              <Text style={styles.handednessText}>
                {selfPlayer.handedness === 'right' ? t('player', 'rightHanded') : selfPlayer.handedness === 'left' ? t('player', 'leftHanded') : t('player', 'ambidextrous')}
              </Text>
            </View>
          ) : null}

          {/* Game Preferences Section */}
          {(roleAnalysis.totalWithRoles > 0 || terrainAnalysis.totalWithTerrain > 0 || partnerAnalysis.totalWithPartners > 0) ? (
            <View style={styles.profileSectionDivider}>
              <MaterialIcons name="psychology" size={15} color={theme.accent} />
              <Text style={styles.profileSectionLabel}>{language === 'fr' ? 'Préférences de jeu' : 'Game Preferences'}</Text>
              <View style={styles.profileSectionLine} />
            </View>
          ) : null}
          {roleAnalysis.totalWithRoles > 0 && (
            <View style={styles.preferredRoleCard}>
              <Text style={styles.preferredRoleTitle}>{t('player', 'preferredRole')}</Text>
              <View style={styles.preferredRoleContent}>
                <View style={[styles.preferredRoleIcon, { backgroundColor: roleIcons[roleAnalysis.preferredRole]?.color || theme.primary }]}>
                  <MaterialIcons 
                    name={(roleIcons[roleAnalysis.preferredRole]?.icon || 'person') as any} 
                    size={20} 
                    color="#FFF" 
                  />
                </View>
                <View style={styles.preferredRoleInfo}>
                  <Text style={styles.preferredRoleName}>{t('roles', roleAnalysis.preferredRole)}</Text>
                  <Text style={styles.preferredRoleStats}>
                    {roleAnalysis.roleCounts[roleAnalysis.preferredRole]} {t('player', 'outOf')} {roleAnalysis.totalWithRoles} {t('player', 'matchesLabel')}
                  </Text>
                </View>
              </View>
              <View style={styles.roleBreakdown}>
                {Object.entries(roleAnalysis.roleCounts).map(([role, count]) => {
                  const config = roleIcons[role];
                  const pct = roleAnalysis.totalWithRoles > 0 ? Math.round((count / roleAnalysis.totalWithRoles) * 100) : 0;
                  return (
                    <View key={role} style={styles.roleBreakdownItem}>
                      <MaterialIcons name={config?.icon as any || 'person'} size={14} color={config?.color || theme.textMuted} />
                      <Text style={styles.roleBreakdownLabel}>{role.charAt(0)}</Text>
                      <View style={styles.roleBreakdownBarBg}>
                        <View style={[styles.roleBreakdownBar, { width: `${pct}%`, backgroundColor: config?.color || theme.primary }]} />
                      </View>
                      <Text style={styles.roleBreakdownPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Preferred Terrain from Match History */}
          {terrainAnalysis.totalWithTerrain > 0 && (
            <View style={styles.preferredRoleCard}>
              <Text style={styles.preferredRoleTitle}>{t('player', 'preferredTerrain')}</Text>
              <View style={styles.preferredRoleContent}>
                <View style={[styles.preferredRoleIcon, { backgroundColor: terrainTypeIcons[terrainAnalysis.preferredTerrain]?.color || theme.primary }]}>
                  <MaterialIcons 
                    name={(terrainTypeIcons[terrainAnalysis.preferredTerrain]?.icon || 'sports-soccer') as any} 
                    size={20} 
                    color="#FFF" 
                  />
                </View>
                <View style={styles.preferredRoleInfo}>
                  <Text style={styles.preferredRoleName}>{t('terrainTypes', terrainAnalysis.preferredTerrain)}</Text>
                  <Text style={styles.preferredRoleStats}>
                    {terrainAnalysis.terrainCounts[terrainAnalysis.preferredTerrain]} {t('player', 'outOf')} {terrainAnalysis.totalWithTerrain} {t('player', 'matchesLabel')}
                  </Text>
                </View>
              </View>
              <View style={styles.roleBreakdown}>
                {Object.entries(terrainAnalysis.terrainCounts).map(([terrainType, count]) => {
                  const config = terrainTypeIcons[terrainType];
                  const pct = terrainAnalysis.totalWithTerrain > 0 ? Math.round((count / terrainAnalysis.totalWithTerrain) * 100) : 0;
                  return (
                    <View key={terrainType} style={styles.roleBreakdownItem}>
                      <MaterialIcons name={(config?.icon || 'sports-soccer') as any} size={14} color={config?.color || theme.textMuted} />
                      <Text style={[styles.roleBreakdownLabel, { width: 18 }]}>{terrainType.substring(0, 2)}</Text>
                      <View style={styles.roleBreakdownBarBg}>
                        <View style={[styles.roleBreakdownBar, { width: `${pct}%`, backgroundColor: config?.color || theme.primary }]} />
                      </View>
                      <Text style={styles.roleBreakdownPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Preferred Partner from Match History */}
          {partnerAnalysis.totalWithPartners > 0 && (() => {
            const sortedPartners = Object.entries(partnerAnalysis.partnerCounts)
              .sort((a, b) => b[1].count - a[1].count);
            const topPartner = sortedPartners[0];
            if (!topPartner) return null;
            const topPartnerPlayer = players.find(p => p.id === topPartner[0]);
            return (
              <View style={styles.preferredRoleCard}>
                <Text style={styles.preferredRoleTitle}>{t('player', 'preferredPartner')}</Text>
                <View style={styles.preferredRoleContent}>
                  <View style={[styles.preferredRoleIcon, { backgroundColor: partnerColors[0], overflow: 'hidden' }]}>
                    {topPartnerPlayer?.avatar ? (
                      <Image source={{ uri: topPartnerPlayer.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
                    ) : (
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFF' }}>{topPartner[1].name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.preferredRoleInfo}>
                    <Text style={styles.preferredRoleName}>{topPartner[1].name}</Text>
                    <Text style={styles.preferredRoleStats}>
                      {topPartner[1].count} {t('player', 'outOf')} {partnerAnalysis.totalWithPartners} {t('player', 'matchesLabel')}
                    </Text>
                  </View>
                </View>
                <View style={styles.roleBreakdown}>
                  {sortedPartners.slice(0, 3).map(([pid, info], idx) => {
                    const pct = partnerAnalysis.totalWithPartners > 0 ? Math.round((info.count / partnerAnalysis.totalWithPartners) * 100) : 0;
                    const color = partnerColors[idx % partnerColors.length];
                    const pp = players.find(p => p.id === pid);
                    return (
                      <View key={pid} style={styles.roleBreakdownItem}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {pp?.avatar ? (
                            <Image source={{ uri: pp.avatar }} style={{ width: 20, height: 20, borderRadius: 10 }} contentFit="cover" />
                          ) : (
                            <Text style={{ fontSize: 9, fontWeight: '700', color: '#FFF' }}>{info.name.charAt(0)}</Text>
                          )}
                        </View>
                        <Text style={[styles.roleBreakdownLabel, { width: 'auto', maxWidth: 40 }]} numberOfLines={1}>{info.name.split(' ')[0].substring(0, 5)}</Text>
                        <View style={styles.roleBreakdownBarBg}>
                          <View style={[styles.roleBreakdownBar, { width: `${pct}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={styles.roleBreakdownPct}>{pct}%</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}
        </Animated.View>

        {/* Federation Card Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('player', 'federationCard').toUpperCase()}</Text>
          {uploadingCard ? (
            <View style={styles.federationUploadingCard}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.federationUploadingText}>{t('player', 'uploadingCard')}</Text>
            </View>
          ) : federationCardUrl ? (
            <View style={styles.federationCardContainer}>
              <Pressable
                style={styles.federationCardPreview}
                onPress={handleCardPress}
              >
                {federationCardType === 'image' ? (
                  <Image
                    source={{ uri: federationCardUrl }}
                    style={styles.federationCardImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={styles.federationPdfPreview}>
                    <MaterialIcons name="picture-as-pdf" size={48} color={theme.error} />
                    <Text style={styles.federationPdfText}>{t('player', 'pdfDocument')}</Text>
                    <Text style={styles.federationPdfSubtext}>{t('player', 'tapToView')}</Text>
                  </View>
                )}
                <View style={styles.federationCardOverlay}>
                  <View style={styles.federationCardOverlayBadge}>
                    <MaterialIcons 
                      name={federationCardType === 'pdf' ? 'open-in-new' : 'fullscreen'} 
                      size={16} 
                      color="#FFF" 
                    />
                    <Text style={styles.federationCardOverlayText}>{t('player', 'viewFullscreen')}</Text>
                  </View>
                </View>
              </Pressable>
              <View style={styles.federationCardActions}>
                <Pressable
                  style={styles.federationReplaceBtn}
                  onPress={showUploadOptions}
                >
                  <MaterialIcons name="refresh" size={18} color={theme.primary} />
                  <Text style={styles.federationReplaceBtnText}>{t('player', 'replaceFederationCard')}</Text>
                </Pressable>
                <Pressable
                  style={styles.federationRemoveBtn}
                  onPress={handleRemoveFederationCard}
                >
                  <MaterialIcons name="delete-outline" size={18} color={theme.error} />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.federationAddCard}
              onPress={showUploadOptions}
            >
              <View style={styles.federationAddIcon}>
                <MaterialIcons name="badge" size={32} color={theme.primary} />
              </View>
              <Text style={styles.federationAddTitle}>{t('player', 'addFederationCard')}</Text>
              <Text style={styles.federationAddDesc}>{t('player', 'federationCardDesc')}</Text>
              <View style={styles.federationAddFormats}>
                <View style={styles.federationFormatChip}>
                  <MaterialIcons name="image" size={14} color={theme.textSecondary} />
                  <Text style={styles.federationFormatText}>JPG / PNG</Text>
                </View>
                <View style={styles.federationFormatChip}>
                  <MaterialIcons name="picture-as-pdf" size={14} color={theme.textSecondary} />
                  <Text style={styles.federationFormatText}>PDF</Text>
                </View>
              </View>
            </Pressable>
          )}
        </Animated.View>

        {/* Quick Stats Grid */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('player', 'summaryLabel')}</Text>
          <View style={styles.quickStatsGrid}>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="sports" size={24} color={theme.primary} />
              </View>
              <Text style={styles.quickStatValue}>{totalMatches}</Text>
              <Text style={styles.quickStatLabel}>{t('player', 'matchesUpper')}</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="emoji-events" size={24} color={theme.success} />
              </View>
              <Text style={[styles.quickStatValue, { color: theme.success }]}>{userStats.wins}</Text>
              <Text style={styles.quickStatLabel}>{t('player', 'victories')}</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="star" size={24} color={theme.carreauColor} />
              </View>
              <Text style={[styles.quickStatValue, { color: theme.carreauColor }]}>{challengeStats.totalChallenges}</Text>
              <Text style={styles.quickStatLabel}>{t('player', 'challenges')}</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="percent" size={24} color={theme.accent} />
              </View>
              <Text style={[styles.quickStatValue, { color: theme.accent }]}>{userStats.winRate}%</Text>
              <Text style={styles.quickStatLabel}>{t('player', 'winsLabel')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Match Statistics */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('player', 'matchesSection')}</Text>
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalMatches}</Text>
                <Text style={styles.statLabel}>{t('player', 'total')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.success }]}>{userStats.wins}</Text>
                <Text style={styles.statLabel}>{t('player', 'won')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.error }]}>{userStats.losses}</Text>
                <Text style={styles.statLabel}>{t('player', 'lost')}</Text>
              </View>
            </View>
            <View style={styles.statsSeparator} />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{tournamentMatches.length}</Text>
                <Text style={styles.statLabel}>{t('player', 'tournaments')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{trainingMatches.length}</Text>
                <Text style={styles.statLabel}>{t('player', 'trainings')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userStats.avgMatchDuration}</Text>
                <Text style={styles.statLabel}>{t('player', 'avgDuration')}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Shot Statistics */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('player', 'performancesLabel')}</Text>
          <View style={styles.performanceCard}>
            <View style={styles.performanceRow}>
              <View style={[styles.performanceIcon, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="gps-fixed" size={20} color={theme.accent} />
              </View>
              <View style={styles.performanceInfo}>
                <Text style={styles.performanceLabel}>{t('player', 'shotRate')}</Text>
                <Text style={styles.performanceSubtext}>
                  {totalTirsSuccess} {t('player', 'succeededOn')} {totalTirs}
                </Text>
              </View>
              <View style={styles.performanceValueContainer}>
                <Text style={[styles.performanceValue, { color: theme.accent }]}>{tirRate}%</Text>
              </View>
            </View>

            <View style={styles.performanceRow}>
              <View style={[styles.performanceIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="adjust" size={20} color={theme.primary} />
              </View>
              <View style={styles.performanceInfo}>
                <Text style={styles.performanceLabel}>{t('player', 'pointRate')}</Text>
                <Text style={styles.performanceSubtext}>
                  {totalPointsSuccess} {t('player', 'succeededOn')} {totalPoints}
                </Text>
              </View>
              <View style={styles.performanceValueContainer}>
                <Text style={[styles.performanceValue, { color: theme.primary }]}>{pointRate}%</Text>
              </View>
            </View>

            <View style={[styles.performanceRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.performanceIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="stars" size={20} color={theme.carreauColor} />
              </View>
              <View style={styles.performanceInfo}>
                <Text style={styles.performanceLabel}>{t('player', 'carreauRate')}</Text>
                <Text style={styles.performanceSubtext}>
                  {totalCarreaux} {t('player', 'carreauxOn')} {totalTirsSuccess} {t('player', 'successfulShots')}
                </Text>
              </View>
              <View style={styles.performanceValueContainer}>
                <Text style={[styles.performanceValue, { color: theme.carreauColor }]}>{carreauRate}%</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Challenges Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('player', 'challengesLabel')}</Text>
          <View style={styles.challengesCard}>
            <View style={styles.challengeRow}>
              <View style={styles.challengeInfo}>
                <View style={[styles.challengeIcon, { backgroundColor: theme.accent + '15' }]}>
                  <MaterialIcons name="gps-fixed" size={18} color={theme.accent} />
                </View>
                <Text style={styles.challengeName}>{t('challengeNames', '10_tirs')}</Text>
              </View>
              <View style={styles.challengeStats}>
                <Text style={styles.challengeCount}>{challengeStats.byType['10_tirs'].count} {t('player', 'challengeCount')}</Text>
                <Text style={styles.challengeBest}>
                  {t('player', 'best')}: {challengeStats.byType['10_tirs'].bestScore}%
                </Text>
              </View>
            </View>
            
            <View style={styles.challengeRow}>
              <View style={styles.challengeInfo}>
                <View style={[styles.challengeIcon, { backgroundColor: theme.primary + '15' }]}>
                  <MaterialIcons name="sports" size={18} color={theme.primary} />
                </View>
                <Text style={styles.challengeName}>{t('challengeNames', '10_tirs_sautee')}</Text>
              </View>
              <View style={styles.challengeStats}>
                <Text style={styles.challengeCount}>{challengeStats.byType['10_tirs_sautee'].count} {t('player', 'challengeCount')}</Text>
                <Text style={styles.challengeBest}>
                  {t('player', 'best')}: {challengeStats.byType['10_tirs_sautee'].bestScore}%
                </Text>
              </View>
            </View>
            
            <View style={[styles.challengeRow, { borderBottomWidth: 0 }]}>
              <View style={styles.challengeInfo}>
                <View style={[styles.challengeIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                  <MaterialIcons name="stars" size={18} color={theme.carreauColor} />
                </View>
                <Text style={styles.challengeName}>{t('challengeNames', 'precision')}</Text>
              </View>
              <View style={styles.challengeStats}>
                <Text style={styles.challengeCount}>{challengeStats.byType['precision'].count} {t('player', 'challengeCount')}</Text>
                <Text style={styles.challengeBest}>
                  {t('player', 'best')}: {challengeStats.byType['precision'].bestScore} pts
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Visibility Toggle */}
        <Animated.View entering={FadeInDown.duration(400).delay(450)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('map', 'visibility').toUpperCase()}</Text>
          <Pressable
            style={styles.visibilityCard}
            onPress={handleTogglePublic}
            disabled={togglingPublic}
          >
            <View style={[styles.visibilityIcon, { backgroundColor: isPublic ? theme.success + '15' : theme.textMuted + '15' }]}>
              <MaterialIcons name={isPublic ? 'public' : 'lock'} size={22} color={isPublic ? theme.success : theme.textMuted} />
            </View>
            <View style={styles.visibilityInfo}>
              <Text style={styles.visibilityTitle}>{t('map', 'visibilityToggle')}</Text>
              <Text style={styles.visibilityDesc}>
                {isPublic ? t('map', 'publicItemsDesc') : t('map', 'makePublic')}
              </Text>
            </View>
            <View style={[styles.visibilityBadge, { backgroundColor: isPublic ? theme.success + '20' : theme.textMuted + '15' }]}>
              <Text style={[styles.visibilityBadgeText, { color: isPublic ? theme.success : theme.textMuted }]}>
                {isPublic ? t('map', 'publicLabel') : t('map', 'privateLabel')}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Edit Profile Button */}
        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <Pressable 
            style={styles.editProfileButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({ pathname: '/profile', params: { edit: 'true' } } as any);
            }}
          >
            <MaterialIcons name="edit" size={20} color="#FFF" />
            <Text style={styles.editProfileButtonText}>{t('player', 'editMyProfile')}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Fullscreen Image Modal */}
      <Modal
        visible={showFullscreen}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFullscreen(false)}
      >
        <View style={styles.fullscreenContainer}>
          <Pressable style={styles.fullscreenClose} onPress={() => setShowFullscreen(false)}>
            <View style={styles.fullscreenCloseBtn}>
              <MaterialIcons name="close" size={28} color="#FFF" />
            </View>
          </Pressable>
          {federationCardUrl ? (
            <Image
              source={{ uri: federationCardUrl }}
              style={{ width: screenWidth, height: screenHeight * 0.8 }}
              contentFit="contain"
              transition={200}
            />
          ) : null}
        </View>
      </Modal>

      {selfPlayer && (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          itemType="player"
          itemId={selfPlayer.id}
          itemName={selfPlayer.name}
          forceReadOnly
        />
      )}
    </SafeAreaView>
  );
}

// Helper functions
function getRoleColor(role: string): string {
  switch (role) {
    case 'Tireur': return theme.accent;
    case 'Pointeur': return theme.primary;
    case 'Milieu': return theme.carreauColor;
    default: return theme.textSecondary;
  }
}

function getRoleIcon(role: string): any {
  switch (role) {
    case 'Tireur': return 'gps-fixed';
    case 'Pointeur': return 'adjust';
    case 'Milieu': return 'swap-horiz';
    default: return 'person';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  scrollContentTablet: {
    maxWidth: 960,
    alignSelf: 'center' as const,
    width: '100%',
    paddingHorizontal: 24,
  },
  // Player Card
  playerCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...theme.shadows.card,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFF',
  },
  roleBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.surface,
  },
  playerName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileSectionDivider: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  profileSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  profileSectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  metaDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.textMuted,
    marginHorizontal: 12,
  },
  clubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.accent + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    marginBottom: 8,
  },
  clubText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },
  addClubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  addClubText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.primary,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  handednessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366F1' + '12',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    marginBottom: 12,
  },
  handednessText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  terrainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.success + '15',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.full,
    marginBottom: 6,
  },
  terrainBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.success,
  },
  contactSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.full,
  },
  contactText: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: '500',
  },
  preferredRoleCard: {
    width: '100%',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border + '60',
  },
  preferredRoleTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  preferredRoleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  preferredRoleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferredRoleInfo: {
    alignItems: 'flex-start',
  },
  preferredRoleName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  preferredRoleStats: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  roleBreakdown: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBreakdownItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.backgroundSecondary,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: theme.borderRadius.md,
  },
  roleBreakdownLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    width: 12,
  },
  roleBreakdownBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  roleBreakdownBar: {
    height: '100%',
    borderRadius: 2,
  },
  roleBreakdownPct: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textPrimary,
    minWidth: 28,
    textAlign: 'right',
  },
  // Sections
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  // Federation Card
  federationUploadingCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...theme.shadows.card,
  },
  federationUploadingText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  federationCardContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  federationCardPreview: {
    position: 'relative',
    width: '100%',
    minHeight: 200,
  },
  federationCardImage: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  federationPdfPreview: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    gap: 8,
  },
  federationPdfText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  federationPdfSubtext: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  federationCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  federationCardOverlayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  federationCardOverlayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  federationCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  federationReplaceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.md,
    marginRight: 8,
  },
  federationReplaceBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  federationRemoveBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.error + '10',
    borderRadius: theme.borderRadius.md,
  },
  federationAddCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.primary + '25',
    borderStyle: 'dashed',
    ...theme.shadows.card,
  },
  federationAddIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  federationAddTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
    marginBottom: 6,
  },
  federationAddDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  federationAddFormats: {
    flexDirection: 'row',
    gap: 12,
  },
  federationFormatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  federationFormatText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  // Quick Stats Grid
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickStatCard: {
    minWidth: 70,
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  quickStatIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  quickStatLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  // Stats Card
  statsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.border,
    marginHorizontal: 8,
  },
  statsSeparator: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 16,
  },
  // Performance Card
  performanceCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  performanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  performanceInfo: {
    flex: 1,
  },
  performanceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  performanceSubtext: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  performanceValueContainer: {
    marginLeft: 8,
  },
  performanceValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  // Challenges Card
  challengesCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  challengeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  challengeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  challengeStats: {
    alignItems: 'flex-end',
  },
  challengeCount: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  challengeBest: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  // Edit Button
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.md,
    marginTop: 8,
    ...theme.shadows.card,
  },
  editProfileButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  playerNickname: {
    fontSize: 15,
    fontStyle: 'italic',
    color: theme.textSecondary,
    marginBottom: 8,
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
  // Fullscreen Modal
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  fullscreenCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Partner breakdown
  partnerBreakdown: {
    gap: 10,
    marginTop: 4,
  },
  partnerBreakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.backgroundSecondary,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: theme.borderRadius.md,
  },
  partnerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  partnerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  partnerInfoCol: {
    flex: 1,
    gap: 4,
  },
  partnerName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  partnerBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  partnerPct: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
});
