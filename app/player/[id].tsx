import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/template';
import ModificationLogsSection from '@/components/ui/ModificationLogsSection';
import SharedBadge from '@/components/ui/SharedBadge';
import ShareModal from '@/components/ui/ShareModal';
import MergePickerModal from '@/components/ui/MergePickerModal';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import * as Linking from 'expo-linking';


function StatRing({ value, color, size = 80 }: { value: number; color: string; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <View style={{ position: 'relative', width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size/2} cy={size/2} r={radius} stroke={theme.border} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size/2} cy={size/2} r={radius}
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" fill="none" rotation="-90" origin={`${size/2},${size/2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.ringValue, { color }]}>{value}%</Text>
      </View>
    </View>
  );
}

export default function PlayerDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { user } = useAuth();
  const { t, language } = useLanguage();

  const { getPlayerById, getMatchesByPlayer, getClubById, getTerrainById, deletePlayer, updatePlayer, selfPlayer, matches, getSharedPermission, refreshData: _rd, loading: appLoading } = useApp();
  const player = getPlayerById(id!);
  const playerMatches = getMatchesByPlayer(id!).slice(0, 5);
  const { clubs, terrains: allTerrains } = useApp();
  const clubEntity = player?.clubId ? getClubById(player.clubId) : null;
  const terrainEntity = player?.terrainId ? getTerrainById(player.terrainId) : null;
  // For shared players, the club/terrain may not exist in recipient's local context
  const clubDisplayName = clubEntity?.name || player?.club || null;
  const terrainDisplayName = terrainEntity?.name || player?.terrainName || null;
  const isSelf = selfPlayer && player?.id === selfPlayer.id;
  const sharedPermission = getSharedPermission(id!);
  const isSharedItem = sharedPermission !== null;
  const isReadOnly = sharedPermission === 'read';
  const canEdit = !isReadOnly;

  const [showShareModal, setShowShareModal] = React.useState(false);
  const [showMergePicker, setShowMergePicker] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [screenWidth, setScreenWidth] = React.useState(() => Dimensions.get('window').width);
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: any) => setScreenWidth(window.width));
    return () => sub?.remove();
  }, []);
  const isTablet = screenWidth >= 600;
  const { refreshData } = useApp();

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);


  // Calculate preferred role from match history
  const roleAnalysis = React.useMemo(() => {
    const roleCounts: Record<string, number> = { 'Pointeur': 0, 'Milieu': 0, 'Tireur': 0 };
    const allMatches = matches.filter(m => 
      m.teamA.players.includes(id!) || m.teamB.players.includes(id!)
    );
    
    allMatches.forEach(match => {
      // Check team A roles
      if (match.teamA.players.includes(id!) && match.teamA.playerRoles) {
        const playerRole = match.teamA.playerRoles.find(pr => pr.playerId === id!);
        if (playerRole && roleCounts[playerRole.role] !== undefined) {
          roleCounts[playerRole.role]++;
        }
      }
      // Check team B roles
      if (match.teamB.players.includes(id!) && match.teamB.playerRoles) {
        const playerRole = match.teamB.playerRoles.find(pr => pr.playerId === id!);
        if (playerRole && roleCounts[playerRole.role] !== undefined) {
          roleCounts[playerRole.role]++;
        }
      }
    });
    
    const totalWithRoles = Object.values(roleCounts).reduce((a, b) => a + b, 0);
    const preferredRole = totalWithRoles > 0 
      ? Object.entries(roleCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0]
      : player?.role || 'Milieu';
    
    return { roleCounts, totalWithRoles, preferredRole };
  }, [matches, id, player?.role]);

  const roleIcons: Record<string, { icon: string; color: string }> = {
    'Pointeur': { icon: 'radio-button-on', color: '#3B82F6' },
    'Milieu': { icon: 'swap-horiz', color: '#8B5CF6' },
    'Tireur': { icon: 'gps-fixed', color: '#F97316' },
  };

  const terrainTypeIcons: Record<string, { icon: string; color: string }> = {
    'Stabilisé': { icon: 'landscape', color: '#6B7280' },
    'Graviers': { icon: 'grain', color: '#92400E' },
    'Sable': { icon: 'beach-access', color: '#D97706' },
    'Cailloux': { icon: 'terrain', color: '#6D28D9' },
    'Terre battue': { icon: 'grass', color: '#15803D' },
  };

  const partnerColors = ['#3B82F6', '#8B5CF6', '#F97316', '#10B981', '#EC4899', '#6366F1', '#14B8A6'];

  // Terrain type analysis from match history
  const terrainAnalysis = React.useMemo(() => {
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

  // Partner analysis from match history
  const partnerAnalysis = React.useMemo(() => {
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
            if (!partnerCounts[pid]) {
              partnerCounts[pid] = { count: 0, name: match.teamA.playerNames[idx] || pid };
            }
            partnerCounts[pid].count++;
          }
        });
      } else if (inTeamB && match.teamB.players.length > 1) {
        match.teamB.players.forEach((pid, idx) => {
          if (pid !== id) {
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
  }, [matches, id]);

  const handleDelete = () => {
    if (isSelf) {
      Alert.alert(t('player', 'impossible'), t('player', 'cannotDeleteSelf'));
      return;
    }
    
    Alert.alert(
      t('player', 'deletePlayer'),
      `${t('player', 'deleteConfirm')} "${player?.name}" ? ${t('player', 'deleteIrreversible')}`,
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: async () => {
            if (player) {
              await deletePlayer(player.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('player', 'playerProfile')}</Text>
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

  const levelColors = {
    'Débutant': theme.textSecondary,
    'Intermédiaire': theme.primary,
    'Confirmé': theme.accent,
    'Expert': theme.success,
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('player', 'playerProfile')}</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.editButton} onPress={() => setShowShareModal(true)}>
            <MaterialIcons name="share" size={22} color={theme.success} />
          </Pressable>
          {canEdit && (
            <Pressable style={styles.editButton} onPress={() => setShowMergePicker(true)}>
              <MaterialIcons name="compare-arrows" size={22} color={theme.accent} />
            </Pressable>
          )}
          {canEdit && (
            <Pressable style={styles.editButton} onPress={() => router.push(`/player/edit/${id}`)}>
              <MaterialIcons name="edit" size={22} color={theme.primary} />
            </Pressable>
          )}
          {canEdit && !isSelf && !isSharedItem && (
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
        {/* Profile Card */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.profileCard, isTablet && styles.profileCardTablet]}>
          <View style={styles.avatar}>
            {player.avatar ? (
              <Image
                source={{ uri: player.avatar }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text style={styles.avatarText}>
                {player.name.split(' ').map(n => n[0]).join('')}
              </Text>
            )}
          </View>
          <Text style={styles.playerName}>{player.name}</Text>
          {player.nickname ? (
            <Text style={styles.playerNickname}>"{player.nickname}"</Text>
          ) : null}
          {sharedPermission ? (
            <View style={{ marginBottom: 8 }}>
              <SharedBadge permission={sharedPermission} />
            </View>
          ) : null}
          <View style={styles.profileBadges}>
            <View style={[styles.badge, { backgroundColor: levelColors[player.level] + '20' }]}>
              <Text style={[styles.badgeText, { color: levelColors[player.level] }]}>{t('levels', player.level)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.primaryLight + '30' }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>{t('roles', player.role)}</Text>
            </View>
          </View>
          {/* Contact Info */}
          {(player.phone || player.email) && !isSharedItem && (player.showContactPublic !== false || !player.isPublic) ? (
            <View style={styles.contactInfo}>
              {player.phone ? (
                <Pressable 
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`tel:${player.phone}`)}
                >
                  <MaterialIcons name="phone" size={16} color={theme.primary} />
                  <Text style={styles.contactText}>{player.phone}</Text>
                </Pressable>
              ) : null}
              {player.email ? (
                <Pressable 
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`mailto:${player.email}`)}
                >
                  <MaterialIcons name="email" size={16} color={theme.primary} />
                  <Text style={styles.contactText}>{player.email}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {clubDisplayName ? (
            clubEntity ? (
              <Pressable 
                style={styles.clubLink}
                onPress={() => router.push(`/club/${clubEntity.id}`)}
              >
                <MaterialIcons name="home" size={16} color={theme.textSecondary} />
                <Text style={styles.clubName}>{clubEntity.name}</Text>
                <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
              </Pressable>
            ) : (
              <View style={styles.clubLink}>
                <MaterialIcons name="home" size={16} color={theme.textSecondary} />
                <Text style={styles.clubName}>{clubDisplayName}</Text>
              </View>
            )
          ) : null}

          {/* Terrain de pratique */}
          {terrainDisplayName ? (
            terrainEntity ? (
              <Pressable 
                style={styles.terrainLink}
                onPress={() => router.push(`/terrain/${terrainEntity.id}`)}
              >
                <MaterialIcons name="sports-soccer" size={16} color={theme.success} />
                <Text style={styles.terrainLinkText}>{terrainEntity.name}</Text>
                <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
              </Pressable>
            ) : (
              <View style={styles.terrainLink}>
                <MaterialIcons name="sports-soccer" size={16} color={theme.success} />
                <Text style={styles.terrainLinkText}>{terrainDisplayName}</Text>
              </View>
            )
          ) : null}
          
          {/* Location with fallback indicator */}
          {(() => {
            const hasOwnLocation = (player.location?.latitude && player.location.latitude !== 0) || (player.location?.longitude && player.location.longitude !== 0);
            if (hasOwnLocation) return null;
            // Check if location can be derived from terrain or club
            let fallbackSource: 'terrain' | 'club' | null = null;
            let fallbackName = '';
            let fallbackCity = '';
            if (player.terrainId) {
              const tr = allTerrains.find(t => t.id === player.terrainId);
              if (tr && tr.location && (tr.location.latitude || tr.location.longitude)) {
                fallbackSource = 'terrain';
                fallbackName = tr.name;
                fallbackCity = tr.city;
              }
            }
            if (!fallbackSource && player.clubId) {
              const cl = clubs.find(c => c.id === player.clubId);
              if (cl && cl.location && (cl.location.latitude || cl.location.longitude)) {
                fallbackSource = 'club';
                fallbackName = cl.name;
                fallbackCity = cl.city;
              }
            }
            if (!fallbackSource) return null;
            return (
              <Pressable
                style={styles.fallbackLocationBanner}
                onPress={() => {
                  if (canEdit) {
                    Haptics.selectionAsync();
                    router.push(`/player/edit/${id}`);
                  }
                }}
              >
                <View style={[styles.fallbackLocationIcon, { backgroundColor: fallbackSource === 'terrain' ? theme.success + '15' : theme.accent + '15' }]}>
                  <MaterialIcons name={fallbackSource === 'terrain' ? 'sports-soccer' : 'home'} size={16} color={fallbackSource === 'terrain' ? theme.success : theme.accent} />
                </View>
                <View style={styles.fallbackLocationInfo}>
                  <Text style={styles.fallbackLocationTitle}>
                    {fallbackCity} <Text style={styles.fallbackLocationVia}>{t('player', 'locationFrom')} {fallbackName}</Text>
                  </Text>
                  <Text style={styles.fallbackLocationDesc}>
                    {fallbackSource === 'terrain' ? t('player', 'locationFallbackTerrain') : t('player', 'locationFallbackClub')}
                  </Text>
                </View>
                {canEdit ? (
                  <View style={styles.fallbackLocationEditBtn}>
                    <MaterialIcons name="edit-location-alt" size={16} color={theme.primary} />
                  </View>
                ) : null}
              </Pressable>
            );
          })()}

          {/* Handedness */}
          {player.handedness ? (
            <View style={styles.handednessContainer}>
              <MaterialIcons 
                name={player.handedness === 'left' ? 'front-hand' : player.handedness === 'ambidextrous' ? 'swap-horiz' : 'back-hand'} 
                size={16} 
                color="#6366F1" 
              />
              <Text style={styles.handednessText}>
                {player.handedness === 'right' ? t('player', 'rightHanded') : player.handedness === 'left' ? t('player', 'leftHanded') : t('player', 'ambidextrous')}
              </Text>
            </View>
          ) : null}

          {/* Preferred Role from Match History */}
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
            const topPartnerPlayer = getPlayerById(topPartner[0]);
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
                    const pp = getPlayerById(pid);
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

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={[styles.quickStats, isTablet && styles.quickStatsTablet]}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{player.stats.matchesPlayed}</Text>
            <Text style={styles.quickStatLabel}>{t('player', 'matchesUpper')}</Text>
          </View>
          <View style={[styles.quickStatItem, styles.quickStatBorder]}>
            <Text style={[styles.quickStatValue, { color: theme.success }]}>{player.stats.wins}</Text>
            <Text style={styles.quickStatLabel}>{t('player', 'victories')}</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatValue, { color: theme.error }]}>{player.stats.losses}</Text>
            <Text style={styles.quickStatLabel}>{t('player', 'defeats')}</Text>
          </View>
        </Animated.View>

        {/* Boules Section */}
        {player.boules && (player.boules.name || player.boules.diameter || player.boules.weight) && (
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('player', 'boulesLabel')}</Text>
            <View style={styles.boulesCard}>
              <View style={styles.boulesIconContainer}>
                <MaterialIcons name="sports-baseball" size={32} color={theme.accent} />
              </View>
              <View style={styles.boulesInfo}>
                {player.boules.name && (
                  <Text style={styles.boulesName}>{player.boules.name}</Text>
                )}
                <View style={styles.boulesSpecs}>
                  {player.boules.diameter && (
                    <View style={styles.boulesSpecItem}>
                      <Text style={styles.boulesSpecLabel}>{t('player', 'diameter')}</Text>
                      <Text style={styles.boulesSpecValue}>{player.boules.diameter} mm</Text>
                    </View>
                  )}
                  {player.boules.weight && (
                    <View style={styles.boulesSpecItem}>
                      <Text style={styles.boulesSpecLabel}>{t('player', 'weight')}</Text>
                      <Text style={styles.boulesSpecValue}>{player.boules.weight} g</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        <View style={isTablet ? styles.tabletRow : undefined}>
        {/* Performance Rings */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={[styles.section, isTablet && styles.tabletHalf]}>
          <Text style={styles.sectionTitle}>{t('player', 'performance')}</Text>
          <View style={styles.ringsContainer}>
            <View style={styles.ringItem}>
              <StatRing value={player.stats.winRate} color={theme.primary} />
              <Text style={styles.ringLabel}>{t('player', 'victories')}</Text>
            </View>
            <View style={styles.ringItem}>
              <StatRing value={player.stats.tirRate} color={theme.tirColor} />
              <Text style={styles.ringLabel}>{t('player', 'shot')}</Text>
            </View>
            <View style={styles.ringItem}>
              <StatRing value={player.stats.pointRate} color={theme.pointColor} />
              <Text style={styles.ringLabel}>{t('player', 'pointLabel')}</Text>
            </View>
            <View style={styles.ringItem}>
              <StatRing value={player.stats.carreauRate} color={theme.carreauColor} />
              <Text style={styles.ringLabel}>{t('player', 'carreau')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Detailed Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={[styles.section, isTablet && styles.tabletHalf]}>
          <Text style={styles.sectionTitle}>{t('player', 'details')}</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('player', 'pointsScoredPerMatch')}</Text>
              <Text style={styles.detailValue}>{player.stats.avgPointsScored}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('player', 'pointsConcededPerMatch')}</Text>
              <Text style={styles.detailValue}>{player.stats.avgPointsConceded}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('player', 'differential')}</Text>
              <Text style={[styles.detailValue, { 
                color: player.stats.avgPointsScored - player.stats.avgPointsConceded > 0 
                  ? theme.success 
                  : theme.error 
              }]}>
                {(player.stats.avgPointsScored - player.stats.avgPointsConceded) > 0 ? '+' : ''}
                {(player.stats.avgPointsScored - player.stats.avgPointsConceded).toFixed(1)}
              </Text>
            </View>
            {player.location && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('player', 'location')}</Text>
                <Text style={styles.detailValue}>{player.location.city}</Text>
              </View>
            )}
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>{t('player', 'memberSince')}</Text>
              <Text style={styles.detailValue}>
                {new Date(player.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>
        </Animated.View>

        </View>

        {/* Contact Visibility Toggle - only when public and has contact */}
        {canEdit && !isSharedItem && (player?.isPublic ?? false) && (player?.phone || player?.email) && (
          <Animated.View entering={FadeInDown.duration(400).delay(450)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('player', 'contactVisibility')}</Text>
            <Pressable
              style={[styles.detailsCard, { flexDirection: 'row', alignItems: 'center', padding: 16 }]}
              onPress={() => {
                Haptics.selectionAsync();
                const newVal = !(player.showContactPublic ?? false);
                updatePlayer(player.id, { showContactPublic: newVal });
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: (player.showContactPublic ? theme.success : theme.textMuted) + '15', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <MaterialIcons name={player.showContactPublic ? 'contact-phone' : 'phone-disabled'} size={22} color={player.showContactPublic ? theme.success : theme.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.textPrimary }}>{t('map', 'showContactPublic')}</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
                  {player.showContactPublic ? t('map', 'contactVisibleDesc') : t('map', 'contactHiddenDesc')}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: (player.showContactPublic ? theme.success : theme.textMuted) + '15' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: player.showContactPublic ? theme.success : theme.textMuted }}>
                  {player.showContactPublic ? t('map', 'visibleLabel') : t('map', 'hiddenLabel')}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Recent Matches */}
        {playerMatches.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('player', 'recentMatches')}</Text>
            {playerMatches.map(match => {
              const isTeamA = match.teamA.players.includes(id!);
              const won = (isTeamA && match.winner === 'A') || (!isTeamA && match.winner === 'B');
              
              return (
                <Pressable key={match.id} style={styles.matchCard} onPress={() => router.push(`/match/${match.id}`)}>
                  <View style={[styles.matchIndicator, { backgroundColor: won ? theme.success : theme.error }]} />
                  <View style={styles.matchContent}>
                    <View style={styles.matchHeader}>
                      <Text style={styles.matchFormat}>{t('formats', match.format)}</Text>
                      <Text style={styles.matchDate}>
                        {new Date(match.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <Text style={styles.matchTeams} numberOfLines={1}>
                      {match.teamA.playerNames.join(', ')} vs {match.teamB.playerNames.join(', ')}
                    </Text>
                  </View>
                  <View style={styles.matchScore}>
                    <Text style={[styles.matchScoreText, won && styles.matchScoreWin]}>
                      {isTeamA ? match.teamA.score : match.teamB.score}
                    </Text>
                    <Text style={styles.matchScoreSeparator}>-</Text>
                    <Text style={[styles.matchScoreText, !won && styles.matchScoreLoss]}>
                      {isTeamA ? match.teamB.score : match.teamA.score}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
        {/* Modification Logs - only visible to owner */}
        <ModificationLogsSection
          itemType="player"
          itemId={id!}
          isOwner={!isSharedItem && !!user?.id}
        />
      </ScrollView>

      {player ? (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          itemType="player"
          itemId={player.id}
          itemName={player.name}
        />
      ) : null}

      <MergePickerModal
        visible={showMergePicker}
        onClose={() => setShowMergePicker(false)}
        itemType="player"
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
  profileCardTablet: {
    padding: 32,
  },
  quickStatsTablet: {
    marginTop: 20,
  },
  tabletRow: {
    flexDirection: 'row' as const,
    gap: 16,
  },
  tabletHalf: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
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
  playerName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clubLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  clubName: {
    fontSize: 15,
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
    marginBottom: 8,
  },
  handednessText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
  },
  preferredRoleCard: {
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
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
  playerNickname: {
    fontSize: 15,
    fontStyle: 'italic',
    color: theme.textSecondary,
    marginBottom: 12,
  },
  terrainLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  terrainLinkText: {
    fontSize: 15,
    color: theme.success,
  },
  contactInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  ringsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  ringItem: {
    alignItems: 'center',
  },
  ringValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  ringLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 8,
  },
  detailsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  detailLabel: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  matchIndicator: {
    width: 4,
    height: '100%',
  },
  matchContent: {
    flex: 1,
    padding: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  matchFormat: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
  matchDate: {
    fontSize: 12,
    color: theme.textMuted,
  },
  matchTeams: {
    fontSize: 14,
    color: theme.textPrimary,
  },
  matchScore: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    gap: 4,
  },
  matchScoreText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  matchScoreWin: {
    color: theme.success,
  },
  matchScoreLoss: {
    color: theme.error,
  },
  matchScoreSeparator: {
    fontSize: 14,
    color: theme.textMuted,
  },
  // Boules styles
  boulesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  boulesIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: theme.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  boulesInfo: {
    flex: 1,
  },
  boulesName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  boulesSpecs: {
    flexDirection: 'row',
    gap: 20,
  },
  boulesSpecItem: {
    alignItems: 'flex-start',
  },
  boulesSpecLabel: {
    fontSize: 11,
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  boulesSpecValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.accent,
    marginTop: 2,
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
  // Fallback location indicator
  fallbackLocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.warning + '08',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.warning + '25',
    gap: 10,
    width: '100%',
  },
  fallbackLocationIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLocationInfo: {
    flex: 1,
  },
  fallbackLocationTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  fallbackLocationVia: {
    fontSize: 12,
    fontWeight: '400',
    color: theme.textSecondary,
  },
  fallbackLocationDesc: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  fallbackLocationEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
