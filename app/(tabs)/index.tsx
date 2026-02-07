import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/template';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, tournaments, matches, challenges, selfPlayer } = useApp();
  const { user } = useAuth();
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);

  // Get display name
  const displayName = user?.username || selfPlayer?.name || user?.email?.split('@')[0] || 'Joueur';

  const upcomingTournaments = tournaments.filter(t => t.status === 'À venir').slice(0, 3);
  const recentMatches = matches.slice(0, 3);


  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Header with Profile */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Pressable style={styles.profileCard} onPress={() => router.push('/player/me')}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileRole}>{selfPlayer?.role || 'Milieu'} • {selfPlayer?.level || 'Intermédiaire'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
          <Pressable style={styles.settingsBtn} onPress={() => router.push('/profile')}>
            <MaterialIcons name="settings" size={22} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Main Actions - Hero Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.heroSection}>
          <Text style={styles.heroTitle}>Que voulez-vous faire ?</Text>
          
          <View style={styles.mainActionsRow}>
            <Pressable 
              style={styles.mainActionCard}
              onPress={() => router.push('/match/new')}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.primary }]}>
                <MaterialIcons name="sports" size={32} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>Match</Text>
              <Text style={styles.mainActionSubtitle}>Entraînement</Text>
            </Pressable>

            <Pressable 
              style={styles.mainActionCard}
              onPress={() => router.push('/challenge/new')}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.accent }]}>
                <MaterialIcons name="track-changes" size={32} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>Défi</Text>
              <Text style={styles.mainActionSubtitle}>Tirs / Points</Text>
            </Pressable>

            <Pressable 
              style={styles.mainActionCard}
              onPress={() => setShowTournamentPicker(true)}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.carreauColor }]}>
                <MaterialIcons name="emoji-events" size={32} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>Tournoi</Text>
              <Text style={styles.mainActionSubtitle}>Mon parcours</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Quick Access Grid */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.quickAccessSection}>
          <View style={styles.quickAccessGrid}>
            <Pressable style={styles.quickAccessItem} onPress={() => router.push('/player/new')}>
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.primary + '12' }]}>
                <MaterialIcons name="person-add" size={22} color={theme.primary} />
              </View>
              <Text style={styles.quickAccessText}>Joueur</Text>
            </Pressable>

            <Pressable style={styles.quickAccessItem} onPress={() => router.push('/tournament/new')}>
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.carreauColor + '12' }]}>
                <MaterialIcons name="add-circle" size={22} color={theme.carreauColor} />
              </View>
              <Text style={styles.quickAccessText}>Tournoi</Text>
            </Pressable>

            <Pressable style={styles.quickAccessItem} onPress={() => router.push('/club/new')}>
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.accent + '12' }]}>
                <MaterialIcons name="home-work" size={22} color={theme.accent} />
              </View>
              <Text style={styles.quickAccessText}>Club</Text>
            </Pressable>

            <Pressable style={styles.quickAccessItem} onPress={() => router.push('/history')}>
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.success + '12' }]}>
                <MaterialIcons name="history" size={22} color={theme.success} />
              </View>
              <Text style={styles.quickAccessText}>Historique</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Recent Activity */}
        {recentMatches.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Derniers matchs</Text>
              <Pressable onPress={() => router.push('/history')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </Pressable>
            </View>
            <View style={styles.recentMatchesContainer}>
              {recentMatches.map((match, index) => {
                const isWin = match.winner === 'A';
                const matchDate = new Date(match.date);
                return (
                  <Pressable
                    key={match.id}
                    style={styles.recentMatchItem}
                    onPress={() => router.push(`/match/${match.id}`)}
                  >
                    <View style={[
                      styles.matchResultIndicator,
                      { backgroundColor: isWin ? theme.success : theme.error }
                    ]} />
                    <View style={styles.matchInfo}>
                      <View style={styles.matchScoreRow}>
                        <Text style={[styles.matchScore, isWin && styles.matchScoreWin]}>
                          {match.teamA.score}
                        </Text>
                        <Text style={styles.matchVs}>-</Text>
                        <Text style={[styles.matchScore, !isWin && styles.matchScoreLoss]}>
                          {match.teamB.score}
                        </Text>
                      </View>
                      <Text style={styles.matchMeta}>
                        {match.mode} • {matchDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <View style={[
                      styles.matchResultBadge,
                      { backgroundColor: isWin ? theme.success + '15' : theme.error + '15' }
                    ]}>
                      <Text style={[
                        styles.matchResultText,
                        { color: isWin ? theme.success : theme.error }
                      ]}>
                        {isWin ? 'V' : 'D'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Upcoming Tournaments */}
        {upcomingTournaments.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tournois à venir</Text>
              <Pressable onPress={() => router.push('/(tabs)/directory')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </Pressable>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tournamentsScroll}
            >
              {upcomingTournaments.map((tournament) => (
                <Pressable 
                  key={tournament.id}
                  style={styles.tournamentCard}
                  onPress={() => router.push(`/tournament/${tournament.id}`)}
                >
                  <View style={styles.tournamentCardHeader}>
                    <View style={styles.tournamentCardIcon}>
                      <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />
                    </View>
                    <View style={styles.tournamentCardBadge}>
                      <Text style={styles.tournamentCardBadgeText}>{tournament.format}</Text>
                    </View>
                  </View>
                  <Text style={styles.tournamentCardName} numberOfLines={2}>
                    {tournament.name}
                  </Text>
                  <View style={styles.tournamentCardMeta}>
                    <MaterialIcons name="event" size={14} color={theme.textMuted} />
                    <Text style={styles.tournamentCardDate}>
                      {new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View style={styles.tournamentCardMeta}>
                    <MaterialIcons name="place" size={14} color={theme.textMuted} />
                    <Text style={styles.tournamentCardLocation}>{tournament.location.city}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Empty State - First Time User */}
        {matches.length === 0 && challenges.length === 0 && (
          <Animated.View entering={FadeIn.duration(500).delay(250)} style={styles.emptyStateCard}>
            <View style={styles.emptyStateIcon}>
              <MaterialIcons name="sports" size={48} color={theme.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>Bienvenue sur PPSS !</Text>
            <Text style={styles.emptyStateText}>
              Commencez par créer un match d'entraînement ou lancez un défi pour suivre vos performances.
            </Text>
            <Pressable 
              style={styles.emptyStateCta}
              onPress={() => router.push('/match/new')}
            >
              <MaterialIcons name="play-arrow" size={20} color="#FFF" />
              <Text style={styles.emptyStateCtaText}>Premier match</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Tournament Picker Modal */}
      <Modal
        visible={showTournamentPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTournamentPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setShowTournamentPicker(false)}
            >
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>Mes Tournois</Text>
            <Pressable
              style={styles.modalAddBtn}
              onPress={() => {
                setShowTournamentPicker(false);
                router.push('/tournament/new');
              }}
            >
              <MaterialIcons name="add" size={24} color={theme.primary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {tournaments.length > 0 ? (
              <>
                <Text style={styles.modalSectionTitle}>CHOISIR UN TOURNOI</Text>
                {tournaments.map((tournament) => {
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    'À venir': { bg: theme.primary + '15', text: theme.primary },
                    'En cours': { bg: theme.warning + '15', text: theme.warning },
                    'Terminé': { bg: theme.success + '15', text: theme.success },
                  };
                  const colors = statusColors[tournament.status] || statusColors['À venir'];
                  
                  return (
                    <Pressable
                      key={tournament.id}
                      style={styles.tournamentPickerItem}
                      onPress={() => {
                        setShowTournamentPicker(false);
                        router.push(`/tournament/${tournament.id}`);
                      }}
                    >
                      <View style={styles.tournamentPickerIcon}>
                        <MaterialIcons name="emoji-events" size={28} color={theme.carreauColor} />
                      </View>
                      <View style={styles.tournamentPickerInfo}>
                        <Text style={styles.tournamentPickerName} numberOfLines={1}>
                          {tournament.name}
                        </Text>
                        <View style={styles.tournamentPickerMeta}>
                          <MaterialIcons name="event" size={12} color={theme.textMuted} />
                          <Text style={styles.tournamentPickerDate}>
                            {new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                          <View style={styles.tournamentPickerDot} />
                          <Text style={styles.tournamentPickerCity}>{tournament.location.city}</Text>
                        </View>
                        <View style={styles.tournamentPickerBadges}>
                          <View style={[styles.tournamentPickerBadge, { backgroundColor: colors.bg }]}>
                            <Text style={[styles.tournamentPickerBadgeText, { color: colors.text }]}>
                              {tournament.status}
                            </Text>
                          </View>
                          <View style={[styles.tournamentPickerBadge, { backgroundColor: theme.backgroundSecondary }]}>
                            <Text style={[styles.tournamentPickerBadgeText, { color: theme.textSecondary }]}>
                              {tournament.format}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <View style={styles.emptyTournamentPicker}>
                <View style={styles.emptyTournamentIcon}>
                  <MaterialIcons name="emoji-events" size={56} color={theme.carreauColor} />
                </View>
                <Text style={styles.emptyTournamentPickerTitle}>Aucun tournoi</Text>
                <Text style={styles.emptyTournamentPickerText}>
                  Créez un tournoi pour commencer à suivre votre parcours en compétition
                </Text>
                <Pressable
                  style={styles.createTournamentBtn}
                  onPress={() => {
                    setShowTournamentPicker(false);
                    router.push('/tournament/new');
                  }}
                >
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.createTournamentBtnText}>Créer un tournoi</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  profileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    ...theme.shadows.card,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },

  // Hero Section
  heroSection: {
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 14,
  },
  mainActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mainActionCard: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  mainActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  mainActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  mainActionSubtitle: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  // Quick Access
  quickAccessSection: {
    marginBottom: 24,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAccessItem: {
    alignItems: 'center',
    width: '23%',
  },
  quickAccessIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickAccessText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
  },
  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: '600',
  },
  // Recent Matches
  recentMatchesContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  recentMatchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  matchResultIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 14,
  },
  matchInfo: {
    flex: 1,
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchScore: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  matchScoreWin: {
    color: theme.success,
  },
  matchScoreLoss: {
    color: theme.error,
  },
  matchVs: {
    fontSize: 14,
    color: theme.textMuted,
    marginHorizontal: 8,
  },
  matchMeta: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  matchResultBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchResultText: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Tournament Cards
  tournamentsScroll: {
    gap: 12,
  },
  tournamentCard: {
    width: 160,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    ...theme.shadows.card,
  },
  tournamentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tournamentCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.carreauColor + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournamentCardBadge: {
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  tournamentCardBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.primary,
  },
  tournamentCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 10,
    minHeight: 36,
  },
  tournamentCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tournamentCardDate: {
    fontSize: 11,
    color: theme.textMuted,
  },
  tournamentCardLocation: {
    fontSize: 11,
    color: theme.textMuted,
  },
  // Empty State
  emptyStateCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    ...theme.shadows.card,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyStateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  emptyStateCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAddBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 16,
  },
  // Tournament picker
  tournamentPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  tournamentPickerIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: theme.carreauColor + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  tournamentPickerInfo: {
    flex: 1,
  },
  tournamentPickerName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 6,
  },
  tournamentPickerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tournamentPickerDate: {
    fontSize: 12,
    color: theme.textMuted,
    marginLeft: 4,
  },
  tournamentPickerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.textMuted,
    marginHorizontal: 6,
  },
  tournamentPickerCity: {
    fontSize: 12,
    color: theme.textMuted,
  },
  tournamentPickerBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  tournamentPickerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  tournamentPickerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Empty tournament picker
  emptyTournamentPicker: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTournamentIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.carreauColor + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTournamentPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptyTournamentPickerText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  createTournamentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.carreauColor,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  createTournamentBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
