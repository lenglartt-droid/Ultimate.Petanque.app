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
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/template';

export default function MyPlayerCardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selfPlayer, userStats, challengeStats, matches, challenges } = useApp();

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
          <Text style={styles.loadingText}>Chargement de votre fiche...</Text>
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
        <Text style={styles.headerTitle}>Ma Fiche Joueur</Text>
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
              <Text style={styles.metaText}>{selfPlayer.role}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <MaterialIcons name="trending-up" size={16} color={theme.textSecondary} />
              <Text style={styles.metaText}>{selfPlayer.level}</Text>
            </View>
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
              <Text style={styles.addClubText}>Ajouter un club</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Quick Stats Grid */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>RÉSUMÉ</Text>
          <View style={styles.quickStatsGrid}>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="sports" size={24} color={theme.primary} />
              </View>
              <Text style={styles.quickStatValue}>{totalMatches}</Text>
              <Text style={styles.quickStatLabel}>Matchs</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="emoji-events" size={24} color={theme.success} />
              </View>
              <Text style={[styles.quickStatValue, { color: theme.success }]}>{userStats.wins}</Text>
              <Text style={styles.quickStatLabel}>Victoires</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="star" size={24} color={theme.carreauColor} />
              </View>
              <Text style={[styles.quickStatValue, { color: theme.carreauColor }]}>{challengeStats.totalChallenges}</Text>
              <Text style={styles.quickStatLabel}>Défis</Text>
            </View>
            <View style={styles.quickStatCard}>
              <View style={[styles.quickStatIcon, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="percent" size={24} color={theme.accent} />
              </View>
              <Text style={[styles.quickStatValue, { color: theme.accent }]}>{userStats.winRate}%</Text>
              <Text style={styles.quickStatLabel}>Victoires</Text>
            </View>
          </View>
        </Animated.View>

        {/* Match Statistics */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>MATCHS</Text>
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalMatches}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.success }]}>{userStats.wins}</Text>
                <Text style={styles.statLabel}>Gagnés</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.error }]}>{userStats.losses}</Text>
                <Text style={styles.statLabel}>Perdus</Text>
              </View>
            </View>
            <View style={styles.statsSeparator} />
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{tournamentMatches.length}</Text>
                <Text style={styles.statLabel}>Tournois</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{trainingMatches.length}</Text>
                <Text style={styles.statLabel}>Entraînements</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{userStats.avgMatchDuration}</Text>
                <Text style={styles.statLabel}>Durée moy.</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Shot Statistics */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>PERFORMANCES</Text>
          <View style={styles.performanceCard}>
            {/* Tir */}
            <View style={styles.performanceRow}>
              <View style={[styles.performanceIcon, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="gps-fixed" size={20} color={theme.accent} />
              </View>
              <View style={styles.performanceInfo}>
                <Text style={styles.performanceLabel}>Taux de Tir</Text>
                <Text style={styles.performanceSubtext}>
                  {totalTirsSuccess} réussis sur {totalTirs}
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
                <Text style={styles.performanceLabel}>Taux de Point</Text>
                <Text style={styles.performanceSubtext}>
                  {totalPointsSuccess} réussis sur {totalPoints}
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
                <Text style={styles.performanceLabel}>Taux de Carreau</Text>
                <Text style={styles.performanceSubtext}>
                  {totalCarreaux} carreaux sur {totalTirsSuccess} tirs réussis
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
          <Text style={styles.sectionTitle}>DÉFIS</Text>
          <View style={styles.challengesCard}>
            <View style={styles.challengeRow}>
              <View style={styles.challengeInfo}>
                <View style={[styles.challengeIcon, { backgroundColor: theme.accent + '15' }]}>
                  <MaterialIcons name="gps-fixed" size={18} color={theme.accent} />
                </View>
                <Text style={styles.challengeName}>10 Tirs</Text>
              </View>
              <View style={styles.challengeStats}>
                <Text style={styles.challengeCount}>{challengeStats.byType['10_tirs'].count} défis</Text>
                <Text style={styles.challengeBest}>
                  Meilleur: {challengeStats.byType['10_tirs'].bestScore}%
                </Text>
              </View>
            </View>
            
            <View style={styles.challengeRow}>
              <View style={styles.challengeInfo}>
                <View style={[styles.challengeIcon, { backgroundColor: theme.primary + '15' }]}>
                  <MaterialIcons name="sports" size={18} color={theme.primary} />
                </View>
                <Text style={styles.challengeName}>10 Tirs Sautée</Text>
              </View>
              <View style={styles.challengeStats}>
                <Text style={styles.challengeCount}>{challengeStats.byType['10_tirs_sautee'].count} défis</Text>
                <Text style={styles.challengeBest}>
                  Meilleur: {challengeStats.byType['10_tirs_sautee'].bestScore}%
                </Text>
              </View>
            </View>
            
            <View style={[styles.challengeRow, { borderBottomWidth: 0 }]}>
              <View style={styles.challengeInfo}>
                <View style={[styles.challengeIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                  <MaterialIcons name="stars" size={18} color={theme.carreauColor} />
                </View>
                <Text style={styles.challengeName}>Précision</Text>
              </View>
              <View style={styles.challengeStats}>
                <Text style={styles.challengeCount}>{challengeStats.byType['precision'].count} défis</Text>
                <Text style={styles.challengeBest}>
                  Meilleur: {challengeStats.byType['precision'].bestScore} pts
                </Text>
              </View>
            </View>
          </View>
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
            <Text style={styles.editProfileButtonText}>Modifier mon profil</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
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
});
