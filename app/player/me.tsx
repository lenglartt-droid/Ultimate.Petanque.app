import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert } from '@/template';
import ShareModal from '@/components/ui/ShareModal';
import { toggleItemPublic } from '@/services/publicItemsService';

export default function MyPlayerCardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { selfPlayer, userStats, challengeStats, matches, challenges, setItemPublic } = useApp();
  const { showAlert } = useAlert();
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [isPublic, setIsPublic] = React.useState(selfPlayer?.isPublic ?? false);
  const [togglingPublic, setTogglingPublic] = React.useState(false);

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

  // Calculate preferred role from match history
  const roleAnalysis = React.useMemo(() => {
    if (!selfPlayer) return { roleCounts: {}, totalWithRoles: 0, preferredRole: 'Milieu' };
    
    const roleCounts: Record<string, number> = { 'Pointeur': 0, 'Milieu': 0, 'Tireur': 0 };
    
    matches.forEach(match => {
      // Check team A roles (our team)
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

  // Calculate detailed stats
  const totalMatches = matches.length;
  const tournamentMatches = matches.filter(m => m.mode === 'Tournoi');
  const trainingMatches = matches.filter(m => m.mode === 'Entraînement');
  
  // Calculate shot stats from player actions
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
              router.push('/profile');
            }}
          >
            <MaterialIcons name="edit" size={20} color={theme.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Player Card Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.playerCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {selfPlayer.name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(selfPlayer.role) }]}>
              <MaterialIcons name={getRoleIcon(selfPlayer.role)} size={14} color="#FFF" />
            </View>
          </View>
          
          <Text style={styles.playerName}>{selfPlayer.name}</Text>
          
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

          {/* Contact Info */}
          {(selfPlayer.phone || selfPlayer.email) && (
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
          )}

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
            {/* Tir */}
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

            {/* Point */}
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

            {/* Carreau */}
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
              router.push('/profile');
            }}
          >
            <MaterialIcons name="edit" size={20} color="#FFF" />
            <Text style={styles.editProfileButtonText}>{t('player', 'editMyProfile')}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

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
    marginBottom: 16,
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
  },
  addClubText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.primary,
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
  // Quick Stats Grid
  quickStatsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  quickStatLabel: {
    fontSize: 11,
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
});
