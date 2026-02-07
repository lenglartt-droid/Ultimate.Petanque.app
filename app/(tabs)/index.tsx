import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
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
        {/* Banner */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.bannerContainer}>
          <Image
            source={require('@/assets/images/banner-ppss.png')}
            style={styles.bannerImage}
            contentFit="cover"
          />
        </Animated.View>

        {/* Compact Header with Profile */}
        <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.header}>
          <Pressable style={styles.profileCardEnhanced} onPress={() => router.push('/profile')}>
            <View style={styles.profileAvatarEnhanced}>
              <Text style={styles.profileAvatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfoEnhanced}>
              <Text style={styles.profileNameEnhanced} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileRoleEnhanced}>{selfPlayer?.role || 'Milieu'} • {selfPlayer?.level || 'Intermédiaire'}</Text>
            </View>
            <View style={styles.profileArrowContainer}>
              <MaterialIcons name="person" size={18} color={theme.primary} />
              <MaterialIcons name="chevron-right" size={18} color={theme.primary} />
            </View>
          </Pressable>
        </Animated.View>

        {/* Main Actions - Hero Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.heroSection}>
          <Text style={styles.heroTitle}>Que voulez-vous faire ?</Text>
          
          <View style={styles.mainActionsRow}>
            <Pressable 
              style={({ pressed }) => [styles.mainActionCard, pressed && styles.mainActionCardPressed]}
              onPress={() => router.push('/match/new')}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.primary }]}>
                <MaterialIcons name="sports" size={36} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>Match</Text>
              <Text style={styles.mainActionSubtitle}>Entraînement</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.mainActionCard, pressed && styles.mainActionCardPressed]}
              onPress={() => router.push('/challenge/new')}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.accent }]}>
                <MaterialIcons name="track-changes" size={36} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>Défi</Text>
              <Text style={styles.mainActionSubtitle}>Tirs / Points</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.mainActionCard, pressed && styles.mainActionCardPressed]}
              onPress={() => setShowTournamentPicker(true)}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.carreauColor }]}>
                <MaterialIcons name="emoji-events" size={36} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>Tournoi</Text>
              <Text style={styles.mainActionSubtitle}>Mon parcours</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Quick Access Grid */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.quickAccessSection}>
          <Text style={styles.quickAccessTitle}>Accès rapide</Text>
          <View style={styles.quickAccessGrid}>
            <Pressable 
              style={({ pressed }) => [styles.quickAccessItem, pressed && styles.quickAccessItemPressed]} 
              onPress={() => router.push('/player/new')}
            >
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.primary }]}>
                <MaterialIcons name="person-add" size={24} color="#FFF" />
              </View>
              <Text style={styles.quickAccessText}>Joueur</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.quickAccessItem, pressed && styles.quickAccessItemPressed]} 
              onPress={() => router.push('/tournament/new')}
            >
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.carreauColor }]}>
                <MaterialIcons name="add-circle" size={24} color="#FFF" />
              </View>
              <Text style={styles.quickAccessText}>Tournoi</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.quickAccessItem, pressed && styles.quickAccessItemPressed]} 
              onPress={() => router.push('/terrain/new')}
            >
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.accent }]}>
                <MaterialIcons name="sports-soccer" size={24} color="#FFF" />
              </View>
              <Text style={styles.quickAccessText}>Terrain</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.quickAccessItem, pressed && styles.quickAccessItemPressed]} 
              onPress={() => router.push('/club/new')}
            >
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.success }]}>
                <MaterialIcons name="add-home" size={24} color="#FFF" />
              </View>
              <Text style={styles.quickAccessText}>Club</Text>
            </Pressable>
          </View>
        </Animated.View>

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

        {/* History Button */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.historySection}>
          <Pressable 
            style={({ pressed }) => [styles.historyButton, pressed && styles.historyButtonPressed]}
            onPress={() => router.push('/history')}
          >
            <MaterialIcons name="history" size={22} color={theme.primary} />
            <Text style={styles.historyButtonText}>Voir mon historique</Text>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </Pressable>
        </Animated.View>
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
    paddingTop: 0,
  },
  // Banner
  bannerContainer: {
    marginHorizontal: -16,
    marginBottom: 16,
    borderBottomLeftRadius: theme.borderRadius.xl,
    borderBottomRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  bannerImage: {
    width: '100%',
    height: 140,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  profileCardEnhanced: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: theme.primary + '20',
    ...theme.shadows.card,
  },
  profileAvatarEnhanced: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  profileInfoEnhanced: {
    flex: 1,
  },
  profileNameEnhanced: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 3,
  },
  profileRoleEnhanced: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  profileArrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    gap: 2,
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
    borderRadius: theme.borderRadius.xl,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  mainActionCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  mainActionIcon: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...theme.shadows.card,
  },
  mainActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 3,
  },
  mainActionSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  // Quick Access
  quickAccessSection: {
    marginBottom: 28,
  },
  quickAccessTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 14,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickAccessItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 8,
    ...theme.shadows.card,
  },
  quickAccessItemPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
  quickAccessIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...theme.shadows.card,
  },
  quickAccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
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
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: '600',
  },
  // History Button
  historySection: {
    marginTop: 8,
    marginBottom: 24,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.primary + '30',
    ...theme.shadows.card,
  },
  historyButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
    backgroundColor: theme.primary + '08',
  },
  historyButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
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
