
import React, { useState, useMemo } from 'react';
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
import { useLanguage } from '@/hooks/useLanguage';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { userStats, tournaments, matches, challenges, selfPlayer } = useApp();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'À venir' | 'En cours' | 'Terminé'>('all');

  // Status priority: En cours > À venir > Terminé
  const statusOrder: Record<string, number> = { 'En cours': 0, 'À venir': 1, 'Terminé': 2 };

  // Filtered tournaments by status, sorted by priority
  const filteredTournaments = useMemo(() => {
    const list = statusFilter === 'all' ? [...tournaments] : tournaments.filter(t => t.status === statusFilter);
    return list.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));
  }, [tournaments, statusFilter]);

  // Status counts
  const statusCounts = useMemo(() => ({
    all: tournaments.length,
    'À venir': tournaments.filter(t => t.status === 'À venir').length,
    'En cours': tournaments.filter(t => t.status === 'En cours').length,
    'Terminé': tournaments.filter(t => t.status === 'Terminé').length,
  }), [tournaments]);

  // Get display name
  const displayName = user?.username || selfPlayer?.name || user?.email?.split('@')[0] || (language === 'en' ? 'Player' : 'Joueur');




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
              <Text style={styles.profileRoleEnhanced}>{selfPlayer?.role || t('roles', 'milieu')} • {selfPlayer?.level || t('levels', 'intermediaire')}</Text>
            </View>
            <View style={styles.profileArrowContainer}>
              <MaterialIcons name="person" size={18} color={theme.primary} />
              <MaterialIcons name="chevron-right" size={18} color={theme.primary} />
            </View>
          </Pressable>
        </Animated.View>

        {/* Main Actions - Hero Section */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.heroSection}>
          <Text style={styles.heroTitle}>{t('home', 'whatDoYouWant')}</Text>
          
          <View style={styles.mainActionsRow}>
            <Pressable 
              style={({ pressed }) => [styles.mainActionCard, pressed && styles.mainActionCardPressed]}
              onPress={() => router.push('/match/new')}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.primary }]}>
                <MaterialIcons name="sports" size={36} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>{t('home', 'match')}</Text>
              <Text style={styles.mainActionSubtitle}>{t('home', 'training')}</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.mainActionCard, pressed && styles.mainActionCardPressed]}
              onPress={() => router.push('/challenge/new')}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.accent }]}>
                <MaterialIcons name="track-changes" size={36} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>{t('home', 'challenge')}</Text>
              <Text style={styles.mainActionSubtitle}>{t('home', 'shotsPoints')}</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.mainActionCard, pressed && styles.mainActionCardPressed]}
              onPress={() => setShowTournamentPicker(true)}
            >
              <View style={[styles.mainActionIcon, { backgroundColor: theme.carreauColor }]}>
                <MaterialIcons name="emoji-events" size={36} color="#FFF" />
              </View>
              <Text style={styles.mainActionTitle}>{t('home', 'tournament')}</Text>
              <Text style={styles.mainActionSubtitle}>{t('home', 'myJourney')}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Quick Access Grid */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.quickAccessSection}>
          <Text style={styles.quickAccessTitle}>{t('home', 'quickAccess')}</Text>
          <View style={styles.quickAccessGrid}>
            <Pressable 
              style={({ pressed }) => [styles.quickAccessItem, pressed && styles.quickAccessItemPressed]} 
              onPress={() => router.push('/player/new')}
            >
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.primary }]}>
                <MaterialIcons name="person-add" size={24} color="#FFF" />
              </View>
              <Text style={styles.quickAccessText}>{t('home', 'player')}</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.quickAccessItem, pressed && styles.quickAccessItemPressed]} 
              onPress={() => router.push('/tournament/new')}
            >
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.carreauColor }]}>
                <MaterialIcons name="add-circle" size={24} color="#FFF" />
              </View>
              <Text style={styles.quickAccessText}>{t('home', 'tournament')}</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.quickAccessItem, pressed && styles.quickAccessItemPressed]} 
              onPress={() => router.push('/terrain/new')}
            >
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.accent }]}>
                <MaterialIcons name="sports-soccer" size={24} color="#FFF" />
              </View>
              <Text style={styles.quickAccessText}>{t('home', 'terrain')}</Text>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.quickAccessItem, pressed && styles.quickAccessItemPressed]} 
              onPress={() => router.push('/club/new')}
            >
              <View style={[styles.quickAccessIcon, { backgroundColor: theme.success }]}>
                <MaterialIcons name="add-home" size={24} color="#FFF" />
              </View>
              <Text style={styles.quickAccessText}>{t('home', 'club')}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Empty State - First Time User */}
        {matches.length === 0 && challenges.length === 0 && (
          <Animated.View entering={FadeIn.duration(500).delay(250)} style={styles.emptyStateCard}>
            <View style={styles.emptyStateIcon}>
              <MaterialIcons name="sports" size={48} color={theme.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>{t('home', 'welcomeTitle')}</Text>
            <Text style={styles.emptyStateText}>
              {t('home', 'welcomeText')}
            </Text>
            <Pressable 
              style={styles.emptyStateCta}
              onPress={() => router.push('/match/new')}
            >
              <MaterialIcons name="play-arrow" size={20} color="#FFF" />
              <Text style={styles.emptyStateCtaText}>{t('home', 'firstMatch')}</Text>
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
            <Text style={styles.historyButtonText}>{t('home', 'viewHistory')}</Text>
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
            <Text style={styles.modalTitle}>{t('home', 'myTournaments')}</Text>
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
                {/* Status Filter */}
                <View style={styles.statusFilterRow}>
                  {(['all', 'À venir', 'En cours', 'Terminé'] as const).map((status) => {
                    const isActive = statusFilter === status;
                    const statusConfig: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string }> = {
                      'all': { icon: 'layers', color: theme.textSecondary },
                      'À venir': { icon: 'event', color: theme.primary },
                      'En cours': { icon: 'play-circle-filled', color: theme.warning },
                      'Terminé': { icon: 'check-circle', color: theme.success },
                    };
                    const cfg = statusConfig[status];
                    
                    return (
                      <Pressable
                        key={status}
                        style={[
                          styles.statusFilterChip,
                          isActive && { backgroundColor: cfg.color, borderColor: cfg.color },
                        ]}
                        onPress={() => setStatusFilter(status)}
                      >
                        <MaterialIcons 
                          name={cfg.icon} 
                          size={14} 
                          color={isActive ? '#FFF' : cfg.color} 
                        />
                        <Text style={[
                          styles.statusFilterText,
                          isActive && styles.statusFilterTextActive,
                          !isActive && { color: cfg.color },
                        ]}>
                          {status === 'all' ? t('common', 'all') : status === 'À venir' ? t('tournamentStatus', 'upcoming') : status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'completed')}
                        </Text>
                        <View style={[
                          styles.statusFilterCount,
                          isActive && styles.statusFilterCountActive,
                        ]}>
                          <Text style={[
                            styles.statusFilterCountText,
                            isActive && styles.statusFilterCountTextActive,
                          ]}>
                            {statusCounts[status]}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {filteredTournaments.length > 0 ? (
                  filteredTournaments.map((tournament) => {
                  const statusColors: Record<string, { bg: string; text: string }> = {
                    'À venir': { bg: theme.primary + '15', text: theme.primary },
                    'En cours': { bg: theme.warning + '15', text: theme.warning },
                    'Terminé': { bg: theme.success + '15', text: theme.success },
                  };
                  // Add a default case or ensure tournament.status is always one of the keys.
                  // For now, assuming it might be undefined or an unexpected string,
                  // we'll default to 'À venir' colors if not found.
                  const colors = statusColors[tournament.status as keyof typeof statusColors] || statusColors['À venir'];
                  
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
                            {new Date(tournament.date).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                          <View style={styles.tournamentPickerDot} />
                          <Text style={styles.tournamentPickerCity}>{tournament.location.city}</Text>
                        </View>
                        <View style={styles.tournamentPickerBadges}>
                          <View style={[styles.tournamentPickerBadge, { backgroundColor: colors.bg }]}>
                            <Text style={[styles.tournamentPickerBadgeText, { color: colors.text }]}>
                              {tournament.status === 'À venir' ? t('tournamentStatus', 'upcoming') : tournament.status === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'completed')}
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
                })) : ( // Added closing parenthesis for filteredTournaments.map
                  <View style={styles.emptyFilterState}>
                    <MaterialIcons name="filter-list-off" size={40} color={theme.textMuted} />
                    <Text style={styles.emptyFilterText}>{t('home', 'noTournamentFilter')} {statusFilter !== 'all' ? `"${statusFilter === 'À venir' ? t('tournamentStatus', 'upcoming') : statusFilter === 'En cours' ? t('tournamentStatus', 'inProgress') : t('tournamentStatus', 'completed')}"` : ''}</Text>
                    <Pressable
                      style={styles.resetFilterBtn}
                      onPress={() => setStatusFilter('all')}
                    >
                      <Text style={styles.resetFilterBtnText}>{t('common', 'seeAll')}</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyTournamentPicker}>
                <View style={styles.emptyTournamentIcon}>
                  <MaterialIcons name="emoji-events" size={56} color={theme.carreauColor} />
                </View>
                <Text style={styles.emptyTournamentPickerTitle}>{t('home', 'noTournament')}</Text>
                <Text style={styles.emptyTournamentPickerText}>
                  {t('home', 'noTournamentText')}
                </Text>
                <Pressable
                  style={styles.createTournamentBtn}
                  onPress={() => {
                    setShowTournamentPicker(false);
                    router.push('/tournament/new');
                  }}
                >
                  <MaterialIcons name="add" size={20} color="#FFF" />
                  <Text style={styles.createTournamentBtnText}>{t('home', 'createTournament')}</Text>
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
  // Status filter styles
  statusFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statusFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  statusFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  statusFilterTextActive: {
    color: '#FFF',
  },
  statusFilterCount: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  statusFilterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  statusFilterCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  statusFilterCountTextActive: {
    color: '#FFF',
  },
  emptyFilterState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFilterText: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 12,
    marginBottom: 16,
  },
  resetFilterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.full,
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
});
