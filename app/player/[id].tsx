import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
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
  const { getPlayerById, getMatchesByPlayer, getClubById, getTerrainById, deletePlayer, selfPlayer, matches, getSharedPermission } = useApp();
  const { t, language } = useLanguage();

  const player = getPlayerById(id!);
  const playerMatches = getMatchesByPlayer(id!).slice(0, 5);
  const club = player?.clubId ? getClubById(player.clubId) : null;
  const terrain = player?.terrainId ? getTerrainById(player.terrainId) : null;
  const isSelf = selfPlayer && player?.id === selfPlayer.id;
  const sharedPermission = getSharedPermission(id!);
  const isReadOnly = sharedPermission === 'read';
  const canEdit = !isReadOnly;


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
        <Text>{t('player', 'playerNotFound')}</Text>
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
          {canEdit && (
            <Pressable style={styles.editButton} onPress={() => router.push(`/player/edit/${id}`)}>
              <MaterialIcons name="edit" size={22} color={theme.primary} />
            </Pressable>
          )}
          {canEdit && !isSelf && (
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <MaterialIcons name="delete" size={22} color={theme.error} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {player.name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <Text style={styles.playerName}>{player.name}</Text>
          <View style={styles.profileBadges}>
            <View style={[styles.badge, { backgroundColor: levelColors[player.level] + '20' }]}>
              <Text style={[styles.badgeText, { color: levelColors[player.level] }]}>{t('levels', player.level)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.primaryLight + '30' }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>{t('roles', player.role)}</Text>
            </View>
          </View>
          {club && (
            <Pressable 
              style={styles.clubLink}
              onPress={() => router.push(`/club/${club.id}`)}
            >
              <MaterialIcons name="home" size={16} color={theme.textSecondary} />
              <Text style={styles.clubName}>{club.name}</Text>
              <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
            </Pressable>
          )}
          
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
          
          {/* Terrain de pratique */}
          {terrain && (
            <Pressable 
              style={styles.terrainLink}
              onPress={() => router.push(`/terrain/${terrain.id}`)}
            >
              <MaterialIcons name="sports-soccer" size={16} color={theme.accent} />
              <Text style={styles.terrainName}>{terrain.name}</Text>
              <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
            </Pressable>
          )}
          
          {/* Nickname */}
          {player.nickname && (
            <Text style={styles.playerNickname}>"{player.nickname}"</Text>
          )}
          
          {/* Contact Info */}
          {(player.phone || player.email) && (
            <View style={styles.contactInfo}>
              {player.phone && (
                <Pressable 
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`tel:${player.phone}`)}
                >
                  <MaterialIcons name="phone" size={16} color={theme.primary} />
                  <Text style={styles.contactText}>{player.phone}</Text>
                </Pressable>
              )}
              {player.email && (
                <Pressable 
                  style={styles.contactItem}
                  onPress={() => Linking.openURL(`mailto:${player.email}`)}
                >
                  <MaterialIcons name="email" size={16} color={theme.primary} />
                  <Text style={styles.contactText}>{player.email}</Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.quickStats}>
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

        {/* Performance Rings */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
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
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
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
      </ScrollView>

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
  terrainName: {
    fontSize: 15,
    color: theme.accent,
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
});
