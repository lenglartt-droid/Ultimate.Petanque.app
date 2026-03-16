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
import { useAlert } from '@/template';
import { toggleItemPublic } from '@/services/publicItemsService';
import Svg, { Polygon, Line, Circle as SvgCircle, Text as SvgText, G } from 'react-native-svg';
import { Modal, Switch } from 'react-native';
import * as Linking from 'expo-linking';

// ============================================
// Mini Radar Chart for preferences
// ============================================
function MiniRadar({ data, labels, size }: {
  data: { label: string; value: number; color: string }[];
  labels: string[];
  size: number;
}) {
  if (data.length < 3) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = (size - 50) / 2;
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;
  const levels = [33, 66, 100];

  const getPoint = (angle: number, value: number) => ({
    x: cx + (value / 100) * R * Math.sin(angle),
    y: cy - (value / 100) * R * Math.cos(angle),
  });

  const pts = data.map((d, i) => getPoint(i * angleStep, d.value));
  const polygon = pts.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={size} height={size}>
      {levels.map(level => {
        const lpts = Array.from({ length: n }, (_, i) => {
          const p = getPoint(i * angleStep, level);
          return `${p.x},${p.y}`;
        }).join(' ');
        return <Polygon key={level} points={lpts} fill="none" stroke={theme.border} strokeWidth={0.8} opacity={0.4} />;
      })}
      {data.map((_, i) => {
        const p = getPoint(i * angleStep, 100);
        return <Line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={theme.border} strokeWidth={0.6} opacity={0.4} />;
      })}
      <Polygon points={polygon} fill={theme.primary + '18'} stroke={theme.primary} strokeWidth={2} opacity={0.9} />
      {pts.map((p, i) => (
        <SvgCircle key={i} cx={p.x} cy={p.y} r={4} fill={data[i].color} stroke="#FFF" strokeWidth={2} />
      ))}
      {data.map((d, i) => {
        const p = getPoint(i * angleStep, 120);
        return (
          <G key={`l-${i}`}>
            <SvgText x={p.x} y={p.y + 4} fontSize="10" fill={theme.textSecondary} textAnchor="middle" fontWeight="600">
              {labels[i]}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'Tireur': return '#F97316';
    case 'Pointeur': return '#3B82F6';
    case 'Milieu': return '#8B5CF6';
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

export default function PlayerDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { getPlayerById, getMatchesByPlayer, getClubById, getTerrainById, deletePlayer, updatePlayer, selfPlayer, matches, getSharedPermission, loading: appLoading, boulesSets, players, challenges: allChallenges } = useApp();

  const player = getPlayerById(id!);
  const playerMatches = getMatchesByPlayer(id!);
  const recentMatches = playerMatches.slice(0, 5);
  const { clubs, terrains: allTerrains } = useApp();
  const clubEntity = player?.clubId ? getClubById(player.clubId) : null;
  const terrainEntity = player?.terrainId ? getTerrainById(player.terrainId) : null;
  const clubDisplayName = clubEntity?.name || player?.club || null;
  const terrainDisplayName = terrainEntity?.name || player?.terrainName || null;
  const isSelf = selfPlayer && player?.id === selfPlayer.id;
  const sharedPermission = getSharedPermission(id!);
  const isSharedItem = sharedPermission !== null;
  const isReadOnly = sharedPermission === 'read';
  const canEdit = !isReadOnly;

  const [showShareModal, setShowShareModal] = React.useState(false);
  const [showMergePicker, setShowMergePicker] = React.useState(false);
  const [showSharePreview, setShowSharePreview] = React.useState(false);
  const [showPublicPreview, setShowPublicPreview] = React.useState(false);
  const [previewShowContacts, setPreviewShowContacts] = React.useState(false);
  const [isPublicState, setIsPublicState] = React.useState(player?.isPublic ?? false);
  const [togglingPublic, setTogglingPublic] = React.useState(false);
  const { showAlert } = useAlert();
  const { updatePlayer: updatePlayerFn, setItemPublic } = useApp();
  const [refreshing, setRefreshing] = React.useState(false);
  const [screenDims, setScreenDims] = React.useState(() => Dimensions.get('window'));
  React.useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenDims(window));
    return () => sub?.remove();
  }, []);
  const screenWidth = Math.max(1, screenDims.width);
  const isTablet = screenWidth >= 600;
  const { refreshData } = useApp();

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  React.useEffect(() => {
    if (player) setIsPublicState(player.isPublic ?? false);
  }, [player?.isPublic]);

  const handleOpenPublicPreview = React.useCallback(() => {
    if (!player || togglingPublic || isSharedItem) return;
    Haptics.selectionAsync();
    setPreviewShowContacts(player.showContactPublic ?? false);
    setShowPublicPreview(true);
  }, [player, togglingPublic, isSharedItem]);

  const handleConfirmPublic = React.useCallback(async () => {
    if (!player) return;
    setTogglingPublic(true);
    Haptics.selectionAsync();
    const newVal = !isPublicState;
    const { error } = await toggleItemPublic('players', player.id, newVal);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      setIsPublicState(newVal);
      setItemPublic('players', player.id, newVal);
      await updatePlayerFn(player.id, { showContactPublic: previewShowContacts });
    }
    setTogglingPublic(false);
    setShowPublicPreview(false);
  }, [player, isPublicState, togglingPublic, previewShowContacts, showAlert, t, updatePlayerFn]);

  const handleOpenSharePreview = React.useCallback(() => {
    if (!player) return;
    Haptics.selectionAsync();
    setPreviewShowContacts(player.showContactPublic ?? false);
    setShowSharePreview(true);
  }, [player]);

  const handleConfirmShare = React.useCallback(async () => {
    if (!player) return;
    await updatePlayerFn(player.id, { showContactPublic: previewShowContacts });
    setShowSharePreview(false);
    setShowShareModal(true);
  }, [player, previewShowContacts, updatePlayerFn]);

  // Role analysis
  const roleAnalysis = React.useMemo(() => {
    const roleCounts: Record<string, number> = { 'Pointeur': 0, 'Milieu': 0, 'Tireur': 0 };
    const allMatches = matches.filter(m => m.teamA.players.includes(id!) || m.teamB.players.includes(id!));
    allMatches.forEach(match => {
      if (match.teamA.players.includes(id!) && match.teamA.playerRoles) {
        const pr = match.teamA.playerRoles.find(r => r.playerId === id!);
        if (pr && roleCounts[pr.role] !== undefined) roleCounts[pr.role]++;
      }
      if (match.teamB.players.includes(id!) && match.teamB.playerRoles) {
        const pr = match.teamB.playerRoles.find(r => r.playerId === id!);
        if (pr && roleCounts[pr.role] !== undefined) roleCounts[pr.role]++;
      }
    });
    const totalWithRoles = Object.values(roleCounts).reduce((a, b) => a + b, 0);
    const preferredRole = totalWithRoles > 0 ? Object.entries(roleCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0] : player?.role || 'Milieu';
    return { roleCounts, totalWithRoles, preferredRole };
  }, [matches, id, player?.role]);

  // Terrain analysis
  const terrainAnalysis = React.useMemo(() => {
    const terrainCounts: Record<string, number> = {};
    const allMatches = matches.filter(m => m.teamA.players.includes(id!) || m.teamB.players.includes(id!));
    allMatches.forEach(m => { if (m.terrainType) terrainCounts[m.terrainType] = (terrainCounts[m.terrainType] || 0) + 1; });
    const totalWithTerrain = Object.values(terrainCounts).reduce((a, b) => a + b, 0);
    const preferredTerrain = totalWithTerrain > 0 ? Object.entries(terrainCounts).reduce((a, b) => b[1] > a[1] ? b : a)[0] : '';
    return { terrainCounts, totalWithTerrain, preferredTerrain };
  }, [matches, id]);

  // Partner analysis
  const partnerAnalysis = React.useMemo(() => {
    const partnerCounts: Record<string, { count: number; name: string }> = {};
    const allMatches = matches.filter(m => m.teamA.players.includes(id!) || m.teamB.players.includes(id!));
    allMatches.forEach(match => {
      const inA = match.teamA.players.includes(id!);
      const inB = match.teamB.players.includes(id!);
      if (inA && match.teamA.players.length > 1) {
        match.teamA.players.forEach((pid, idx) => {
          if (pid !== id!) { if (!partnerCounts[pid]) partnerCounts[pid] = { count: 0, name: match.teamA.playerNames[idx] || pid }; partnerCounts[pid].count++; }
        });
      } else if (inB && match.teamB.players.length > 1) {
        match.teamB.players.forEach((pid, idx) => {
          if (pid !== id!) { if (!partnerCounts[pid]) partnerCounts[pid] = { count: 0, name: match.teamB.playerNames[idx] || pid }; partnerCounts[pid].count++; }
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

  // Preferred boules
  const preferredBoulesAnalysis = React.useMemo(() => {
    if (!isSelf || !player || boulesSets.length === 0) return null;
    const pid = player.id;
    const role = player.role || 'Milieu';
    const setPerf: Record<string, { matches: number; wins: number; tirsSuccess: number; totalTirs: number; pointsSuccess: number; totalPoints: number; carreaux: number }> = {};
    matches.forEach(m => {
      if (!m.boulesSetId) return;
      const inA = m.teamA.players.includes(pid);
      const inB = m.teamB.players.includes(pid);
      if (!inA && !inB) return;
      if (!setPerf[m.boulesSetId]) setPerf[m.boulesSetId] = { matches: 0, wins: 0, tirsSuccess: 0, totalTirs: 0, pointsSuccess: 0, totalPoints: 0, carreaux: 0 };
      const s = setPerf[m.boulesSetId]; s.matches++;
      if ((inA && m.winner === 'A') || (inB && m.winner === 'B')) s.wins++;
      if (m.playerActions) { const pa = m.playerActions.find(a => a.playerId === pid); if (pa) { s.tirsSuccess += pa.actions.tirsSuccess; s.totalTirs += pa.actions.tirs; s.pointsSuccess += pa.actions.pointsSuccess; s.totalPoints += pa.actions.points; s.carreaux += pa.actions.carreaux; } }
    });
    const entries = Object.entries(setPerf).filter(([_, s]) => s.matches > 0);
    if (entries.length === 0) return null;
    const scored = entries.map(([setId, s]) => {
      let score = 0;
      if (role === 'Tireur') score = s.wins * 3 + s.tirsSuccess + s.carreaux * 2;
      else if (role === 'Pointeur') score = s.wins * 3 + s.pointsSuccess * 2;
      else score = s.wins * 3 + s.tirsSuccess + s.pointsSuccess + s.carreaux;
      return { setId, ...s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const set = boulesSets.find(bs => bs.id === best.setId);
    if (!set) return null;
    return { set, stats: best, role };
  }, [isSelf, player?.id, player?.role, matches, boulesSets]);

  // Shot stats
  let totalTirs = 0, totalTirsSuccess = 0, totalPoints = 0, totalPointsSuccess = 0, totalCarreaux = 0;
  if (player) {
    matches.filter(m => m.teamA.players.includes(id!) || m.teamB.players.includes(id!)).forEach(m => {
      if (m.playerActions) {
        const inA = m.teamA.players.includes(id!);
        m.playerActions.filter(pa => pa.playerId === id!).forEach(pa => {
          totalTirs += pa.actions.tirs; totalTirsSuccess += pa.actions.tirsSuccess;
          totalPoints += pa.actions.points; totalPointsSuccess += pa.actions.pointsSuccess;
          totalCarreaux += pa.actions.carreaux;
        });
      }
    });
  }
  const tirRate = totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : (player?.stats.tirRate || 0);
  const pointRate = totalPoints > 0 ? Math.round((totalPointsSuccess / totalPoints) * 100) : (player?.stats.pointRate || 0);
  const carreauRate = totalTirsSuccess > 0 ? Math.round((totalCarreaux / totalTirsSuccess) * 100) : (player?.stats.carreauRate || 0);

  const totalMatchCount = playerMatches.length;
  const tournamentMatches = playerMatches.filter(m => m.mode === 'Tournoi');
  const trainingMatches = playerMatches.filter(m => m.mode === 'Entraînement');

  // Radar data
  const radarData = React.useMemo(() => {
    if (!player) return [];
    const rolePct = roleAnalysis.totalWithRoles > 0 ? Math.round((roleAnalysis.roleCounts[roleAnalysis.preferredRole] / roleAnalysis.totalWithRoles) * 100) : 50;
    const terrainPct = terrainAnalysis.totalWithTerrain > 0 ? Math.round((terrainAnalysis.terrainCounts[terrainAnalysis.preferredTerrain] / terrainAnalysis.totalWithTerrain) * 100) : 50;
    const partnerPct = partnerAnalysis.totalWithPartners > 0 ? Math.round((partnerAnalysis.preferredPartner.count / partnerAnalysis.totalWithPartners) * 100) : 50;
    return [
      { label: 'Role', value: rolePct, color: getRoleColor(roleAnalysis.preferredRole) },
      { label: 'Terrain', value: terrainPct, color: theme.success },
      { label: language === 'fr' ? 'Duo' : 'Partner', value: partnerPct, color: '#EC4899' },
      { label: language === 'fr' ? 'Victoire' : 'Win', value: player.stats.winRate, color: theme.carreauColor },
      { label: language === 'fr' ? 'Tir' : 'Shot', value: tirRate, color: theme.accent },
    ];
  }, [player, roleAnalysis, terrainAnalysis, partnerAnalysis, tirRate, language]);

  const handleDelete = () => {
    if (isSelf) { Alert.alert(t('player', 'impossible'), t('player', 'cannotDeleteSelf')); return; }
    Alert.alert(t('player', 'deletePlayer'), `${t('player', 'deleteConfirm')} "${player?.name}" ? ${t('player', 'deleteIrreversible')}`, [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('common', 'delete'), style: 'destructive', onPress: async () => { if (player) { await deletePlayer(player.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.back(); } } },
    ]);
  };

  if (!player) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.headerBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} /></Pressable>
          <Text style={s.headerTitle}>{t('player', 'playerProfile')}</Text>
          <View style={{ width: 40 }} />
        </View>
        {appLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.textSecondary }}>{t('player', 'playerNotFound')}</Text></View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>{t('player', 'playerProfile')}</Text>
        <View style={s.headerActions}>
          <Pressable style={s.headerIconBtn} onPress={handleOpenSharePreview}>
            <MaterialIcons name="share" size={20} color={theme.success} />
          </Pressable>
          {canEdit ? (
            <Pressable style={s.headerIconBtn} onPress={() => setShowMergePicker(true)}>
              <MaterialIcons name="compare-arrows" size={20} color={theme.accent} />
            </Pressable>
          ) : null}
          {canEdit ? (
            <Pressable style={[s.headerIconBtn, { backgroundColor: theme.primary + '15' }]} onPress={() => router.push(`/player/edit/${id}`)}>
              <MaterialIcons name="edit" size={20} color={theme.primary} />
            </Pressable>
          ) : null}
          {canEdit && !isSelf && !isSharedItem ? (
            <Pressable style={[s.headerIconBtn, { backgroundColor: theme.error + '15' }]} onPress={handleDelete}>
              <MaterialIcons name="delete" size={20} color={theme.error} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }, isTablet && s.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
      >
        <View style={isTablet ? s.tabletRow : undefined}>
          <View style={isTablet ? s.tabletLeft : undefined}>

            {/* ===== HERO CARD ===== */}
            <Animated.View entering={FadeInDown.duration(400)} style={s.heroCard}>
              {/* Shared Badge */}
              {sharedPermission ? (
                <View style={{ marginBottom: 8 }}><SharedBadge permission={sharedPermission} /></View>
              ) : null}

              {/* Avatar */}
              <View style={s.avatarContainer}>
                <View style={s.avatar}>
                  {player.avatar ? (
                    <Image source={{ uri: player.avatar }} style={s.avatarImage} contentFit="cover" transition={200} />
                  ) : (
                    <Text style={s.avatarText}>{player.name.split(' ').map(n => n[0]).join('')}</Text>
                  )}
                </View>
                <View style={[s.roleBadgeOnAvatar, { backgroundColor: getRoleColor(player.role) }]}>
                  <MaterialIcons name={getRoleIcon(player.role)} size={14} color="#FFF" />
                </View>
              </View>

              {/* Name & Nickname */}
              <Text style={s.heroName}>{player.name}</Text>
              {player.nickname ? <Text style={s.heroNickname}>"{player.nickname}"</Text> : null}

              {/* Badges Row */}
              <View style={s.badgesRow}>
                <View style={[s.pillBadge, { backgroundColor: getRoleColor(player.role) + '15' }]}>
                  <MaterialIcons name={getRoleIcon(player.role)} size={14} color={getRoleColor(player.role)} />
                  <Text style={[s.pillBadgeText, { color: getRoleColor(player.role) }]}>{t('roles', player.role)}</Text>
                </View>
                <View style={[s.pillBadge, { backgroundColor: theme.accent + '15' }]}>
                  <MaterialIcons name="trending-up" size={14} color={theme.accent} />
                  <Text style={[s.pillBadgeText, { color: theme.accent }]}>{t('levels', player.level)}</Text>
                </View>
                {player.handedness ? (
                  <View style={[s.pillBadge, { backgroundColor: '#6366F1' + '15' }]}>
                    <MaterialIcons name={player.handedness === 'left' ? 'front-hand' : player.handedness === 'ambidextrous' ? 'swap-horiz' : 'back-hand'} size={14} color="#6366F1" />
                    <Text style={[s.pillBadgeText, { color: '#6366F1' }]}>
                      {player.handedness === 'right' ? t('player', 'rightHanded') : player.handedness === 'left' ? t('player', 'leftHanded') : t('player', 'ambidextrous')}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Club & Terrain pills */}
              {(clubDisplayName || terrainDisplayName) ? (
                <View style={s.infoPillsRow}>
                  {clubDisplayName ? (
                    clubEntity ? (
                      <Pressable style={[s.infoPill, { backgroundColor: theme.carreauColor + '12' }]} onPress={() => router.push(`/club/${clubEntity.id}`)}>
                        <MaterialIcons name="location-city" size={14} color={theme.carreauColor} />
                        <Text style={[s.infoPillText, { color: theme.carreauColor }]}>{clubDisplayName}</Text>
                        <MaterialIcons name="chevron-right" size={14} color={theme.carreauColor} />
                      </Pressable>
                    ) : (
                      <View style={[s.infoPill, { backgroundColor: theme.carreauColor + '12' }]}>
                        <MaterialIcons name="location-city" size={14} color={theme.carreauColor} />
                        <Text style={[s.infoPillText, { color: theme.carreauColor }]}>{clubDisplayName}</Text>
                      </View>
                    )
                  ) : null}
                  {terrainDisplayName ? (
                    terrainEntity ? (
                      <Pressable style={[s.infoPill, { backgroundColor: theme.success + '12' }]} onPress={() => router.push(`/terrain/${terrainEntity.id}`)}>
                        <MaterialIcons name="sports-soccer" size={14} color={theme.success} />
                        <Text style={[s.infoPillText, { color: theme.success }]}>{terrainDisplayName}</Text>
                        <MaterialIcons name="chevron-right" size={14} color={theme.success} />
                      </Pressable>
                    ) : (
                      <View style={[s.infoPill, { backgroundColor: theme.success + '12' }]}>
                        <MaterialIcons name="sports-soccer" size={14} color={theme.success} />
                        <Text style={[s.infoPillText, { color: theme.success }]}>{terrainDisplayName}</Text>
                      </View>
                    )
                  ) : null}
                </View>
              ) : null}

              {/* Contact pills */}
              {(player.phone || player.email) && (
                isSharedItem ? (player.showContactPublic === true) : (player.showContactPublic !== false || !player.isPublic)
              ) ? (
                <View style={s.contactPillsRow}>
                  {player.phone ? (
                    <Pressable style={s.contactPill} onPress={() => Linking.openURL(`tel:${player.phone}`)}>
                      <MaterialIcons name="phone" size={14} color={theme.primary} />
                      <Text style={s.contactPillText}>{player.phone}</Text>
                    </Pressable>
                  ) : null}
                  {player.email ? (
                    <Pressable style={s.contactPill} onPress={() => Linking.openURL(`mailto:${player.email}`)}>
                      <MaterialIcons name="email" size={14} color={theme.primary} />
                      <Text style={s.contactPillText}>{player.email}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* Location pill */}
              {(player.location?.city || player.country) ? (
                <View style={s.locationPill}>
                  <MaterialIcons name="place" size={14} color={theme.textSecondary} />
                  <Text style={s.locationPillText}>{[player.location?.city, player.country].filter(Boolean).join(', ')}</Text>
                </View>
              ) : null}

              {/* Quick Stats bar */}
              <View style={s.quickStatsBar}>
                <View style={s.quickStatItem}>
                  <Text style={s.quickStatValue}>{player.stats.matchesPlayed}</Text>
                  <Text style={s.quickStatLabel}>{t('player', 'matchesUpper')}</Text>
                </View>
                <View style={s.quickStatDivider} />
                <View style={s.quickStatItem}>
                  <Text style={[s.quickStatValue, { color: theme.success }]}>{player.stats.wins}</Text>
                  <Text style={s.quickStatLabel}>{t('player', 'victories')}</Text>
                </View>
                <View style={s.quickStatDivider} />
                <View style={s.quickStatItem}>
                  <Text style={[s.quickStatValue, { color: theme.accent }]}>{player.stats.winRate}%</Text>
                  <Text style={s.quickStatLabel}>{t('player', 'winsLabel')}</Text>
                </View>
                <View style={s.quickStatDivider} />
                <View style={s.quickStatItem}>
                  <Text style={[s.quickStatValue, { color: theme.error }]}>{player.stats.losses}</Text>
                  <Text style={s.quickStatLabel}>{t('player', 'defeats')}</Text>
                </View>
              </View>
            </Animated.View>
          </View>

          <View style={isTablet ? s.tabletRight : undefined}>

            {/* ===== GAME PREFERENCES with Radar ===== */}
            {(roleAnalysis.totalWithRoles > 0 || terrainAnalysis.totalWithTerrain > 0 || partnerAnalysis.totalWithPartners > 0 || preferredBoulesAnalysis) ? (
              <Animated.View entering={FadeInDown.duration(400).delay(50)} style={s.sectionCard}>
                <View style={s.sectionHeader}>
                  <View style={[s.sectionIconBox, { backgroundColor: '#8B5CF6' + '15' }]}>
                    <MaterialIcons name="psychology" size={18} color="#8B5CF6" />
                  </View>
                  <Text style={s.sectionTitle}>{language === 'fr' ? 'Preferences de jeu' : 'Game Preferences'}</Text>
                </View>
                <Text style={s.sectionDesc}>{language === 'fr' ? 'Analyse automatique basee sur les matchs joues : role favori, terrain prefere, partenaire regulier et equipement.' : 'Automatic analysis based on matches played: preferred role, terrain, regular partner and equipment.'}</Text>

                {radarData.length >= 3 ? (
                  <View style={s.radarContainer}>
                    <MiniRadar data={radarData} labels={radarData.map(d => d.label)} size={Math.min(screenWidth - 96, 220)} />
                  </View>
                ) : null}

                {/* Radar Legend */}
                {radarData.length >= 3 ? (
                  <View style={s.radarLegend}>
                    {[
                      { color: radarData[0]?.color, label: radarData[0]?.label, desc: language === 'fr' ? 'Fidelite au role favori' : 'Preferred role loyalty' },
                      { color: radarData[1]?.color, label: radarData[1]?.label, desc: language === 'fr' ? 'Fidelite au terrain favori' : 'Preferred terrain loyalty' },
                      { color: radarData[2]?.color, label: radarData[2]?.label, desc: language === 'fr' ? 'Regularite avec le partenaire' : 'Partner consistency' },
                      { color: radarData[3]?.color, label: radarData[3]?.label, desc: language === 'fr' ? 'Taux de victoire global' : 'Overall win rate' },
                      { color: radarData[4]?.color, label: radarData[4]?.label, desc: language === 'fr' ? 'Reussite au tir' : 'Shot accuracy' },
                    ].map((item, i) => (
                      <View key={i} style={s.radarLegendItem}>
                        <View style={[s.radarLegendDot, { backgroundColor: item.color }]} />
                        <View style={s.radarLegendTexts}>
                          <Text style={s.radarLegendLabel}>{item.label}</Text>
                          <Text style={s.radarLegendDesc}>{item.desc}</Text>
                        </View>
                        <Text style={[s.radarLegendValue, { color: item.color }]}>{radarData[i]?.value}%</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Preferred Role */}
                {roleAnalysis.totalWithRoles > 0 ? (
                  <View style={s.prefItem}>
                    <View style={[s.prefItemIcon, { backgroundColor: (getRoleColor(roleAnalysis.preferredRole)) + '15' }]}>
                      <MaterialIcons name={getRoleIcon(roleAnalysis.preferredRole)} size={18} color={getRoleColor(roleAnalysis.preferredRole)} />
                    </View>
                    <View style={s.prefItemInfo}>
                      <Text style={s.prefItemLabel}>{t('player', 'preferredRole')}</Text>
                      <Text style={s.prefItemValue}>{t('roles', roleAnalysis.preferredRole)}</Text>
                    </View>
                    <Text style={s.prefItemPct}>{Math.round((roleAnalysis.roleCounts[roleAnalysis.preferredRole] / roleAnalysis.totalWithRoles) * 100)}%</Text>
                  </View>
                ) : null}

                {/* Preferred Terrain */}
                {terrainAnalysis.totalWithTerrain > 0 ? (
                  <View style={s.prefItem}>
                    <View style={[s.prefItemIcon, { backgroundColor: theme.success + '15' }]}>
                      <MaterialIcons name="landscape" size={18} color={theme.success} />
                    </View>
                    <View style={s.prefItemInfo}>
                      <Text style={s.prefItemLabel}>{t('player', 'preferredTerrain')}</Text>
                      <Text style={s.prefItemValue}>{t('terrainTypes', terrainAnalysis.preferredTerrain)}</Text>
                    </View>
                    <Text style={s.prefItemPct}>{Math.round((terrainAnalysis.terrainCounts[terrainAnalysis.preferredTerrain] / terrainAnalysis.totalWithTerrain) * 100)}%</Text>
                  </View>
                ) : null}

                {/* Preferred Partner */}
                {partnerAnalysis.totalWithPartners > 0 ? (() => {
                  const pp = getPlayerById(partnerAnalysis.preferredPartner.id);
                  return (
                    <View style={s.prefItem}>
                      <View style={[s.prefItemIcon, { backgroundColor: '#EC4899' + '15', overflow: 'hidden' }]}>
                        {pp?.avatar ? (
                          <Image source={{ uri: pp.avatar }} style={{ width: 36, height: 36, borderRadius: 10 }} contentFit="cover" />
                        ) : (
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#EC4899' }}>{partnerAnalysis.preferredPartner.name.charAt(0)}</Text>
                        )}
                      </View>
                      <View style={s.prefItemInfo}>
                        <Text style={s.prefItemLabel}>{t('player', 'preferredPartner')}</Text>
                        <Text style={s.prefItemValue}>{partnerAnalysis.preferredPartner.name}</Text>
                      </View>
                      <Text style={s.prefItemPct}>{partnerAnalysis.preferredPartner.count} {language === 'fr' ? 'matchs' : 'matches'}</Text>
                    </View>
                  );
                })() : null}

                {/* Preferred Boules */}
                {preferredBoulesAnalysis ? (
                  <View style={s.prefItem}>
                    <View style={[s.prefItemIcon, { backgroundColor: theme.accent + '15' }]}>
                      <MaterialIcons name="sports-baseball" size={18} color={theme.accent} />
                    </View>
                    <View style={s.prefItemInfo}>
                      <Text style={s.prefItemLabel}>{language === 'fr' ? 'Boules preferees' : 'Preferred Boules'}</Text>
                      <Text style={s.prefItemValue}>{preferredBoulesAnalysis.set.name}</Text>
                    </View>
                    <Text style={s.prefItemPct}>{preferredBoulesAnalysis.stats.matches} {language === 'fr' ? 'matchs' : 'matches'}</Text>
                  </View>
                ) : player.boules && (player.boules.name || player.boules.diameter) ? (
                  <View style={s.prefItem}>
                    <View style={[s.prefItemIcon, { backgroundColor: theme.accent + '15' }]}>
                      <MaterialIcons name="sports-baseball" size={18} color={theme.accent} />
                    </View>
                    <View style={s.prefItemInfo}>
                      <Text style={s.prefItemLabel}>{language === 'fr' ? 'Boules' : 'Boules'}</Text>
                      <Text style={s.prefItemValue}>{player.boules.name || t('player', 'boulesLabel')}</Text>
                    </View>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}
          </View>
        </View>

        {/* ===== MATCH STATISTICS ===== */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIconBox, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name="sports" size={18} color={theme.primary} />
            </View>
            <Text style={s.sectionTitle}>{t('player', 'matchesSection')}</Text>
          </View>

          {/* Win/Loss bar */}
          <View style={s.matchStatRow}>
            <View style={s.matchStatLabels}>
              <Text style={[s.matchStatLabel, { color: theme.success }]}>{player.stats.wins} {t('player', 'won')}</Text>
              <Text style={[s.matchStatLabel, { color: theme.error }]}>{player.stats.losses} {t('player', 'lost')}</Text>
            </View>
            <View style={s.progressBarTrack}>
              <View style={[s.progressBarFill, { flex: Math.max(player.stats.wins, 0.01), backgroundColor: theme.success }]} />
              <View style={[s.progressBarFill, { flex: Math.max(player.stats.losses, 0.01), backgroundColor: theme.error }]} />
            </View>
          </View>

          {/* Mode breakdown */}
          <View style={s.modeBreakdownRow}>
            <View style={s.modeBreakdownItem}>
              <View style={[s.modeBreakdownIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="emoji-events" size={16} color={theme.carreauColor} />
              </View>
              <View>
                <Text style={s.modeBreakdownValue}>{tournamentMatches.length}</Text>
                <Text style={s.modeBreakdownLabel}>{t('player', 'tournaments')}</Text>
              </View>
            </View>
            <View style={s.modeBreakdownItem}>
              <View style={[s.modeBreakdownIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="fitness-center" size={16} color={theme.primary} />
              </View>
              <View>
                <Text style={s.modeBreakdownValue}>{trainingMatches.length}</Text>
                <Text style={s.modeBreakdownLabel}>{t('player', 'trainings')}</Text>
              </View>
            </View>
            <View style={s.modeBreakdownItem}>
              <View style={[s.modeBreakdownIcon, { backgroundColor: theme.textSecondary + '15' }]}>
                <MaterialIcons name="numbers" size={16} color={theme.textSecondary} />
              </View>
              <View>
                <Text style={s.modeBreakdownValue}>{((player.stats.avgPointsScored - player.stats.avgPointsConceded) > 0 ? '+' : '')}{(player.stats.avgPointsScored - player.stats.avgPointsConceded).toFixed(1)}</Text>
                <Text style={s.modeBreakdownLabel}>{t('player', 'differential')}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ===== SHOT PERFORMANCE ===== */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIconBox, { backgroundColor: theme.accent + '15' }]}>
              <MaterialIcons name="gps-fixed" size={18} color={theme.accent} />
            </View>
            <Text style={s.sectionTitle}>{t('player', 'performancesLabel')}</Text>
          </View>

          {[
            { icon: 'gps-fixed', label: t('player', 'shotRate'), rate: tirRate, success: totalTirsSuccess || player.stats.tirRate, total: totalTirs || 100, color: theme.accent },
            { icon: 'adjust', label: t('player', 'pointRate'), rate: pointRate, success: totalPointsSuccess || player.stats.pointRate, total: totalPoints || 100, color: theme.primary },
            { icon: 'stars', label: t('player', 'carreauRate'), rate: carreauRate, success: totalCarreaux || player.stats.carreauRate, total: totalTirsSuccess || 100, color: theme.carreauColor },
          ].map((item, idx) => (
            <View key={idx} style={[s.perfRow, idx === 2 && { borderBottomWidth: 0 }]}>
              <View style={[s.perfIcon, { backgroundColor: item.color + '15' }]}>
                <MaterialIcons name={item.icon as any} size={18} color={item.color} />
              </View>
              <View style={s.perfInfo}>
                <View style={s.perfTopRow}>
                  <Text style={s.perfLabel}>{item.label}</Text>
                  <Text style={[s.perfValue, { color: item.color }]}>{item.rate}%</Text>
                </View>
                <View style={s.perfBarTrack}>
                  <View style={[s.perfBarFill, { width: `${item.rate}%`, backgroundColor: item.color }]} />
                </View>
                {(totalTirs > 0 || totalPoints > 0) ? (
                  <Text style={s.perfSubtext}>{item.success} / {item.total}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </Animated.View>

        {/* ===== DETAILED STATS ===== */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={s.sectionCard}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIconBox, { backgroundColor: theme.warning + '15' }]}>
              <MaterialIcons name="bar-chart" size={18} color={theme.warning} />
            </View>
            <Text style={s.sectionTitle}>{t('player', 'details')}</Text>
          </View>

          <View style={s.detailRow}>
            <Text style={s.detailLabel}>{t('player', 'pointsScoredPerMatch')}</Text>
            <Text style={s.detailValue}>{player.stats.avgPointsScored}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>{t('player', 'pointsConcededPerMatch')}</Text>
            <Text style={s.detailValue}>{player.stats.avgPointsConceded}</Text>
          </View>
          <View style={[s.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={s.detailLabel}>{t('player', 'memberSince')}</Text>
            <Text style={s.detailValue}>{new Date(player.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' })}</Text>
          </View>
        </Animated.View>

        {/* Visibility Section */}
        {canEdit && !isSharedItem ? (
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: (isPublicState ? theme.success : theme.textMuted) + '15' }]}>
                <MaterialIcons name={isPublicState ? 'public' : 'lock'} size={18} color={isPublicState ? theme.success : theme.textMuted} />
              </View>
              <Text style={s.sectionTitle}>{t('map', 'visibility').toUpperCase()}</Text>
            </View>
            <Pressable style={s.visibilityRow} onPress={handleOpenPublicPreview} disabled={togglingPublic}>
              <View style={s.visibilityInfo}>
                <Text style={s.visibilityTitle}>{t('map', 'visibilityToggle')}</Text>
                <Text style={s.visibilityDesc}>{isPublicState ? t('map', 'publicItemsDesc') : t('map', 'makePublic')}</Text>
              </View>
              <View style={[s.visibilityBadge, { backgroundColor: isPublicState ? theme.success + '20' : theme.textMuted + '15' }]}>
                <Text style={[s.visibilityBadgeText, { color: isPublicState ? theme.success : theme.textMuted }]}>{isPublicState ? t('map', 'publicLabel') : t('map', 'privateLabel')}</Text>
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ===== RECENT MATCHES ===== */}
        {recentMatches.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="history" size={18} color={theme.success} />
              </View>
              <Text style={s.sectionTitle}>{t('player', 'recentMatches')}</Text>
            </View>

            {recentMatches.map((match, idx) => {
              const isTeamA = match.teamA.players.includes(id!);
              const won = (isTeamA && match.winner === 'A') || (!isTeamA && match.winner === 'B');
              return (
                <Pressable key={match.id} style={[s.matchCard, idx === recentMatches.length - 1 && { borderBottomWidth: 0 }]} onPress={() => router.push(`/match/${match.id}`)}>
                  <View style={[s.matchIndicator, { backgroundColor: won ? theme.success : theme.error }]} />
                  <View style={s.matchContent}>
                    <Text style={s.matchTeams} numberOfLines={1}>{match.teamA.playerNames.join(', ')} vs {match.teamB.playerNames.join(', ')}</Text>
                    <Text style={s.matchMeta}>{t('formats', match.format)} \u2022 {new Date(match.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Text>
                  </View>
                  <View style={s.matchScoreBox}>
                    <Text style={[s.matchScoreText, won && { color: theme.success }]}>{isTeamA ? match.teamA.score : match.teamB.score}</Text>
                    <Text style={s.matchScoreSep}>-</Text>
                    <Text style={[s.matchScoreText, !won && { color: theme.error }]}>{isTeamA ? match.teamB.score : match.teamA.score}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}

        {/* Modification Logs */}
        <ModificationLogsSection itemType="player" itemId={id!} isOwner={!isSharedItem && !!user?.id} />
      </ScrollView>

      {/* ===== SHARE PREVIEW MODAL ===== */}
      <Modal visible={showSharePreview} animationType="slide" transparent>
        <View style={s.pvOverlay}>
          <View style={s.pvModal}>
            <View style={s.pvHeader}>
              <View style={[s.pvHeaderIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="share" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.pvHeaderTitle}>{language === 'fr' ? 'Apercu du partage' : 'Share Preview'}</Text>
                <Text style={s.pvHeaderSub}>{language === 'fr' ? 'Voici ce que le destinataire verra' : 'This is what the recipient will see'}</Text>
              </View>
              <Pressable style={s.pvCloseBtn} onPress={() => setShowSharePreview(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={s.pvScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={s.pvReadOnlyBadge}>
                <MaterialIcons name="lock" size={14} color={theme.warning} />
                <Text style={s.pvReadOnlyText}>{language === 'fr' ? 'Lecture seule - Le destinataire ne pourra pas modifier cette fiche' : 'Read-only - The recipient cannot edit this card'}</Text>
              </View>
              <View style={s.pvCard}>
                <View style={s.pvAvatarRow}>
                  <View style={s.pvAvatar}>
                    {player.avatar ? (
                      <Image source={{ uri: player.avatar }} style={s.pvAvatarImg} contentFit="cover" transition={200} />
                    ) : (
                      <Text style={s.pvAvatarText}>{player.name?.split(' ').map(n => n[0]).join('')}</Text>
                    )}
                    <View style={[s.pvRoleBadge, { backgroundColor: getRoleColor(player.role) }]}>
                      <MaterialIcons name={getRoleIcon(player.role)} size={10} color="#FFF" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pvName}>{player.name}</Text>
                    {player.nickname ? <Text style={s.pvNickname}>"{player.nickname}"</Text> : null}
                  </View>
                </View>
                <View style={s.pvBadgesRow}>
                  <View style={[s.pvBadge, { backgroundColor: getRoleColor(player.role) + '15' }]}>
                    <Text style={[s.pvBadgeText, { color: getRoleColor(player.role) }]}>{t('roles', player.role)}</Text>
                  </View>
                  <View style={[s.pvBadge, { backgroundColor: theme.accent + '15' }]}>
                    <Text style={[s.pvBadgeText, { color: theme.accent }]}>{t('levels', player.level)}</Text>
                  </View>
                  {player.handedness ? (
                    <View style={[s.pvBadge, { backgroundColor: '#6366F1' + '15' }]}>
                      <Text style={[s.pvBadgeText, { color: '#6366F1' }]}>
                        {player.handedness === 'right' ? t('player', 'rightHanded') : player.handedness === 'left' ? t('player', 'leftHanded') : t('player', 'ambidextrous')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {(clubDisplayName || terrainDisplayName) ? (
                  <View style={s.pvInfoRow}>
                    {clubDisplayName ? (
                      <View style={s.pvInfoPill}>
                        <MaterialIcons name="location-city" size={12} color={theme.carreauColor} />
                        <Text style={[s.pvInfoText, { color: theme.carreauColor }]}>{clubDisplayName}</Text>
                      </View>
                    ) : null}
                    {terrainDisplayName ? (
                      <View style={s.pvInfoPill}>
                        <MaterialIcons name="sports-soccer" size={12} color={theme.success} />
                        <Text style={[s.pvInfoText, { color: theme.success }]}>{terrainDisplayName}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {(player.location?.city || player.country) ? (
                  <View style={s.pvLocationRow}>
                    <MaterialIcons name="place" size={14} color={theme.textSecondary} />
                    <Text style={s.pvLocationText}>{[player.location?.city, player.country].filter(Boolean).join(', ')}</Text>
                  </View>
                ) : null}
                {previewShowContacts && (player.phone || player.email) ? (
                  <View style={s.pvContactRow}>
                    {player.phone ? (
                      <View style={s.pvContactPill}>
                        <MaterialIcons name="phone" size={12} color={theme.primary} />
                        <Text style={s.pvContactText}>{player.phone}</Text>
                      </View>
                    ) : null}
                    {player.email ? (
                      <View style={s.pvContactPill}>
                        <MaterialIcons name="email" size={12} color={theme.primary} />
                        <Text style={s.pvContactText}>{player.email}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View style={s.pvStatsRow}>
                  <View style={s.pvStatItem}>
                    <Text style={s.pvStatValue}>{player.stats.matchesPlayed}</Text>
                    <Text style={s.pvStatLabel}>{t('player', 'matchesUpper')}</Text>
                  </View>
                  <View style={s.pvStatDivider} />
                  <View style={s.pvStatItem}>
                    <Text style={[s.pvStatValue, { color: theme.success }]}>{player.stats.wins}</Text>
                    <Text style={s.pvStatLabel}>{t('player', 'victories')}</Text>
                  </View>
                  <View style={s.pvStatDivider} />
                  <View style={s.pvStatItem}>
                    <Text style={[s.pvStatValue, { color: theme.accent }]}>{player.stats.winRate}%</Text>
                    <Text style={s.pvStatLabel}>{t('player', 'winsLabel')}</Text>
                  </View>
                </View>
              </View>
              {(player.phone || player.email) ? (
                <View style={s.pvToggleCard}>
                  <View style={s.pvToggleRow}>
                    <View style={[s.pvToggleIcon, { backgroundColor: (previewShowContacts ? theme.success : theme.textMuted) + '15' }]}>
                      <MaterialIcons name={previewShowContacts ? 'contact-phone' : 'phone-disabled'} size={18} color={previewShowContacts ? theme.success : theme.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pvToggleTitle}>{language === 'fr' ? 'Afficher les contacts' : 'Show contacts'}</Text>
                      <Text style={s.pvToggleDesc}>{previewShowContacts
                        ? (language === 'fr' ? 'Telephone et email seront visibles' : 'Phone and email will be visible')
                        : (language === 'fr' ? 'Les contacts resteront masques' : 'Contacts will remain hidden')
                      }</Text>
                    </View>
                    <Switch value={previewShowContacts} onValueChange={setPreviewShowContacts} trackColor={{ false: theme.border, true: theme.success + '60' }} thumbColor={previewShowContacts ? theme.success : theme.textMuted} />
                  </View>
                </View>
              ) : null}
              <View style={s.pvNote}>
                <MaterialIcons name="visibility" size={16} color={theme.primary} />
                <Text style={s.pvNoteText}>{language === 'fr' ? 'Le destinataire aura un acces en lecture seule a cette fiche joueur.' : 'The recipient will have read-only access to this player card.'}</Text>
              </View>
            </ScrollView>
            <View style={s.pvActions}>
              <Pressable style={s.pvCancelBtn} onPress={() => setShowSharePreview(false)}>
                <Text style={s.pvCancelText}>{t('common', 'cancel')}</Text>
              </Pressable>
              <Pressable style={[s.pvConfirmBtn, { backgroundColor: theme.primary }]} onPress={handleConfirmShare}>
                <MaterialIcons name="share" size={18} color="#FFF" />
                <Text style={s.pvConfirmText}>{language === 'fr' ? 'Partager' : 'Share'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== PUBLIC PREVIEW MODAL ===== */}
      <Modal visible={showPublicPreview} animationType="slide" transparent>
        <View style={s.pvOverlay}>
          <View style={s.pvModal}>
            <View style={s.pvHeader}>
              <View style={[s.pvHeaderIcon, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="public" size={22} color={theme.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.pvHeaderTitle}>{language === 'fr' ? 'Apercu carte publique' : 'Public Card Preview'}</Text>
                <Text style={s.pvHeaderSub}>{language === 'fr' ? 'Voici comment cette fiche apparaitra sur la Carte' : 'This is how this card will appear on the Map'}</Text>
              </View>
              <Pressable style={s.pvCloseBtn} onPress={() => setShowPublicPreview(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={s.pvScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={s.pvCard}>
                <View style={s.pvAvatarRow}>
                  <View style={s.pvAvatar}>
                    {player.avatar ? (
                      <Image source={{ uri: player.avatar }} style={s.pvAvatarImg} contentFit="cover" transition={200} />
                    ) : (
                      <Text style={s.pvAvatarText}>{player.name?.split(' ').map(n => n[0]).join('')}</Text>
                    )}
                    <View style={[s.pvRoleBadge, { backgroundColor: getRoleColor(player.role) }]}>
                      <MaterialIcons name={getRoleIcon(player.role)} size={10} color="#FFF" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pvName}>{player.name}</Text>
                    {player.nickname ? <Text style={s.pvNickname}>"{player.nickname}"</Text> : null}
                  </View>
                </View>
                <View style={s.pvBadgesRow}>
                  <View style={[s.pvBadge, { backgroundColor: getRoleColor(player.role) + '15' }]}>
                    <Text style={[s.pvBadgeText, { color: getRoleColor(player.role) }]}>{t('roles', player.role)}</Text>
                  </View>
                  <View style={[s.pvBadge, { backgroundColor: theme.accent + '15' }]}>
                    <Text style={[s.pvBadgeText, { color: theme.accent }]}>{t('levels', player.level)}</Text>
                  </View>
                </View>
                {(clubDisplayName || terrainDisplayName) ? (
                  <View style={s.pvInfoRow}>
                    {clubDisplayName ? (
                      <View style={s.pvInfoPill}>
                        <MaterialIcons name="location-city" size={12} color={theme.carreauColor} />
                        <Text style={[s.pvInfoText, { color: theme.carreauColor }]}>{clubDisplayName}</Text>
                      </View>
                    ) : null}
                    {terrainDisplayName ? (
                      <View style={s.pvInfoPill}>
                        <MaterialIcons name="sports-soccer" size={12} color={theme.success} />
                        <Text style={[s.pvInfoText, { color: theme.success }]}>{terrainDisplayName}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {(player.location?.city || player.country) ? (
                  <View style={s.pvLocationRow}>
                    <MaterialIcons name="place" size={14} color={theme.textSecondary} />
                    <Text style={s.pvLocationText}>{[player.location?.city, player.country].filter(Boolean).join(', ')}</Text>
                  </View>
                ) : null}
                {previewShowContacts && (player.phone || player.email) ? (
                  <View style={s.pvContactRow}>
                    {player.phone ? (
                      <View style={s.pvContactPill}>
                        <MaterialIcons name="phone" size={12} color={theme.primary} />
                        <Text style={s.pvContactText}>{player.phone}</Text>
                      </View>
                    ) : null}
                    {player.email ? (
                      <View style={s.pvContactPill}>
                        <MaterialIcons name="email" size={12} color={theme.primary} />
                        <Text style={s.pvContactText}>{player.email}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View style={s.pvStatsRow}>
                  <View style={s.pvStatItem}>
                    <Text style={s.pvStatValue}>{player.stats.matchesPlayed}</Text>
                    <Text style={s.pvStatLabel}>{t('player', 'matchesUpper')}</Text>
                  </View>
                  <View style={s.pvStatDivider} />
                  <View style={s.pvStatItem}>
                    <Text style={[s.pvStatValue, { color: theme.success }]}>{player.stats.wins}</Text>
                    <Text style={s.pvStatLabel}>{t('player', 'victories')}</Text>
                  </View>
                  <View style={s.pvStatDivider} />
                  <View style={s.pvStatItem}>
                    <Text style={[s.pvStatValue, { color: theme.accent }]}>{player.stats.winRate}%</Text>
                    <Text style={s.pvStatLabel}>{t('player', 'winsLabel')}</Text>
                  </View>
                </View>
              </View>
              {(player.phone || player.email) ? (
                <View style={s.pvToggleCard}>
                  <View style={s.pvToggleRow}>
                    <View style={[s.pvToggleIcon, { backgroundColor: (previewShowContacts ? theme.success : theme.textMuted) + '15' }]}>
                      <MaterialIcons name={previewShowContacts ? 'contact-phone' : 'phone-disabled'} size={18} color={previewShowContacts ? theme.success : theme.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pvToggleTitle}>{language === 'fr' ? 'Afficher les contacts' : 'Show contacts'}</Text>
                      <Text style={s.pvToggleDesc}>{previewShowContacts
                        ? (language === 'fr' ? 'Telephone et email seront visibles' : 'Phone and email will be visible')
                        : (language === 'fr' ? 'Les contacts resteront masques' : 'Contacts will remain hidden')
                      }</Text>
                    </View>
                    <Switch value={previewShowContacts} onValueChange={setPreviewShowContacts} trackColor={{ false: theme.border, true: theme.success + '60' }} thumbColor={previewShowContacts ? theme.success : theme.textMuted} />
                  </View>
                </View>
              ) : null}
              <View style={s.pvNote}>
                <MaterialIcons name="map" size={16} color={theme.primary} />
                <Text style={s.pvNoteText}>{language === 'fr' ? 'Cette fiche sera geolocalisee et visible sur la Carte pour tous les utilisateurs.' : 'This card will be geolocated and visible on the Map to all users.'}</Text>
              </View>
            </ScrollView>
            <View style={s.pvActions}>
              <Pressable style={s.pvCancelBtn} onPress={() => setShowPublicPreview(false)}>
                <Text style={s.pvCancelText}>{t('common', 'cancel')}</Text>
              </Pressable>
              <Pressable style={[s.pvConfirmBtn, { backgroundColor: isPublicState ? theme.error : theme.success }]} onPress={handleConfirmPublic} disabled={togglingPublic}>
                {togglingPublic ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name={isPublicState ? 'lock' : 'public'} size={18} color="#FFF" />
                    <Text style={s.pvConfirmText}>{isPublicState
                      ? (language === 'fr' ? 'Rendre prive' : 'Make Private')
                      : (language === 'fr' ? 'Rendre public' : 'Make Public')
                    }</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {player ? (
        <ShareModal visible={showShareModal} onClose={() => setShowShareModal(false)} itemType="player" itemId={player.id} itemName={player.name} />
      ) : null}

      <MergePickerModal visible={showMergePicker} onClose={() => setShowMergePicker(false)} itemType="player" currentItemId={id!} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.success + '15', borderRadius: 20 },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  scrollContentTablet: { maxWidth: 960, alignSelf: 'center' as const, width: '100%', paddingHorizontal: 24 },
  tabletRow: { flexDirection: 'row' as const, gap: 16, marginBottom: 4 },
  tabletLeft: { flex: 1 },
  tabletRight: { flex: 1 },

  // Hero Card
  heroCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.xl, padding: 24, alignItems: 'center', marginBottom: 16, ...theme.shadows.card },
  avatarContainer: { position: 'relative', marginBottom: 14 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarText: { fontSize: 36, fontWeight: '700', color: '#FFF' },
  roleBadgeOnAvatar: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: theme.surface },
  heroName: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  heroNickname: { fontSize: 15, fontStyle: 'italic', color: theme.textSecondary, marginBottom: 8 },

  // Badges
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 12, marginTop: 4 },
  pillBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillBadgeText: { fontSize: 13, fontWeight: '600' },

  // Info pills
  infoPillsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 8 },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  infoPillText: { fontSize: 13, fontWeight: '600' },

  // Contact pills
  contactPillsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 8 },
  contactPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '10', borderRadius: 20 },
  contactPillText: { fontSize: 13, fontWeight: '500', color: theme.primary },

  // Location pill
  locationPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 16 },
  locationPillText: { fontSize: 13, fontWeight: '500', color: theme.textSecondary },

  // Quick Stats bar
  quickStatsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.lg, paddingVertical: 14, paddingHorizontal: 16, width: '100%' },
  quickStatItem: { alignItems: 'center', flex: 1 },
  quickStatValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  quickStatLabel: { fontSize: 10, color: theme.textSecondary, marginTop: 2 },
  quickStatDivider: { width: 1, height: 28, backgroundColor: theme.border, marginHorizontal: 8 },

  // Section Card
  sectionCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 14, ...theme.shadows.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  sectionDesc: { fontSize: 12, color: theme.textMuted, lineHeight: 17, marginBottom: 12 },

  // Radar container
  radarContainer: { alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  radarLegend: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
  radarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  radarLegendDot: { width: 8, height: 8, borderRadius: 4 },
  radarLegendTexts: { flex: 1 },
  radarLegendLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  radarLegendDesc: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  radarLegendValue: { fontSize: 14, fontWeight: '700' },

  // Preference items
  prefItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border + '60' },
  prefItemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prefItemInfo: { flex: 1 },
  prefItemLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  prefItemValue: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginTop: 2 },
  prefItemPct: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },

  // Match stats
  matchStatRow: { marginBottom: 16 },
  matchStatLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  matchStatLabel: { fontSize: 13, fontWeight: '600' },
  progressBarTrack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: theme.backgroundSecondary },
  progressBarFill: { height: '100%' },

  modeBreakdownRow: { flexDirection: 'row', gap: 10 },
  modeBreakdownItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, padding: 12 },
  modeBreakdownIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modeBreakdownValue: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  modeBreakdownLabel: { fontSize: 10, color: theme.textMuted },

  // Performance rows
  perfRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  perfIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  perfInfo: { flex: 1 },
  perfTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  perfLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  perfValue: { fontSize: 20, fontWeight: '800' },
  perfBarTrack: { height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  perfBarFill: { height: '100%', borderRadius: 3 },
  perfSubtext: { fontSize: 11, color: theme.textMuted },

  // Detail rows
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  detailLabel: { fontSize: 14, color: theme.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },

  // Visibility
  visibilityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  visibilityInfo: { flex: 1 },
  visibilityTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  visibilityDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  visibilityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  visibilityBadgeText: { fontSize: 12, fontWeight: '700' },

  // Match cards
  matchCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  matchIndicator: { width: 4, height: 36, borderRadius: 2, marginRight: 12 },
  matchContent: { flex: 1 },
  matchTeams: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 2 },
  matchMeta: { fontSize: 12, color: theme.textMuted },
  matchScoreBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  matchScoreText: { fontSize: 18, fontWeight: '700', color: theme.textSecondary },
  matchScoreSep: { fontSize: 14, color: theme.textMuted },

  // Preview Modal
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
  pvAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary, alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const, position: 'relative' as const },
  pvAvatarImg: { width: 56, height: 56, borderRadius: 28 },
  pvAvatarText: { fontSize: 22, fontWeight: '700' as const, color: '#FFF' },
  pvRoleBadge: { position: 'absolute' as const, bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 2, borderColor: theme.backgroundSecondary },
  pvName: { fontSize: 18, fontWeight: '700' as const, color: theme.textPrimary },
  pvNickname: { fontSize: 13, fontStyle: 'italic' as const, color: theme.textSecondary, marginTop: 2 },
  pvBadgesRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 10 },
  pvBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  pvBadgeText: { fontSize: 12, fontWeight: '600' as const },
  pvInfoRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 },
  pvInfoPill: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.surface, borderRadius: 12 },
  pvInfoText: { fontSize: 12, fontWeight: '600' as const },
  pvLocationRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginBottom: 8 },
  pvLocationText: { fontSize: 12, color: theme.textSecondary },
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
