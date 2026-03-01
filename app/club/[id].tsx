import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
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
import ShareModal from '@/components/ui/ShareModal';
import { isSharedWithMe, saveSharedItemToMyAccount } from '@/services/shareService';
import { useAlert } from '@/template';

export default function ClubDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getClubById, players, tournaments, deleteClub, getSharedPermission } = useApp();
  const { t, language } = useLanguage();

  const club = getClubById(id!);
  const clubPlayers = players.filter(p => p.clubId === id);
  const clubTournaments = tournaments.filter(tr => tr.clubId === id);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [isShared, setIsShared] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const { showAlert } = useAlert();
  const sharedPermission = getSharedPermission(id!);
  const isReadOnly = sharedPermission === 'read';
  const canEdit = !isReadOnly;

  React.useEffect(() => {
    if (id) {
      isSharedWithMe('club', id).then(setIsShared);
    }
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      t('club', 'deleteClub'),
      `${t('club', 'deleteConfirm')} "${club?.name}" ? ${t('club', 'deleteLinkedTerrains')}`,
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('common', 'delete'),
          style: 'destructive',
          onPress: async () => {
            if (club) {
              await deleteClub(club.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (!club) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>{t('club', 'clubNotFound')}</Text>
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
        <Text style={styles.headerTitle}>{t('club', 'clubLabel')}</Text>
        <View style={styles.headerActions}>
          {isShared && (
            <Pressable
              style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
              onPress={async () => {
                setIsSaving(true);
                const { newItemId, error } = await saveSharedItemToMyAccount('club', id!);
                setIsSaving(false);
                if (error) {
                  showAlert(t('common', 'error'), error);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  showAlert(t('club', 'savedLabel'), t('club', 'clubCopied'));
                  if (newItemId) router.replace(`/club/${newItemId}` as any);
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
          {canEdit && (
            <Pressable 
              style={styles.editButton} 
              onPress={() => router.push(`/club/edit/${id}`)}
            >
              <MaterialIcons name="edit" size={22} color={theme.primary} />
            </Pressable>
          )}
          {canEdit && (
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
        {/* Club Card */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.clubCard}>
          <View style={styles.clubIcon}>
            <MaterialIcons name="home" size={48} color="#FFF" />
          </View>
          <Text style={styles.clubName}>{club.name}</Text>
          <View style={styles.clubMeta}>
            <MaterialIcons name="place" size={16} color={theme.textSecondary} />
            <Text style={styles.clubMetaText}>{club.city}</Text>
          </View>
          <Text style={styles.clubDescription}>{club.description}</Text>
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{club.membersCount}</Text>
            <Text style={styles.quickStatLabel}>{t('club', 'members')}</Text>
          </View>
          <View style={[styles.quickStatItem, styles.quickStatBorder]}>
            <Text style={styles.quickStatValue}>{club.foundedYear}</Text>
            <Text style={styles.quickStatLabel}>{t('club', 'founded')}</Text>
          </View>
          <View style={[styles.quickStatItem, styles.quickStatBorder]}>
            <Text style={styles.quickStatValue}>{clubTournaments.length}</Text>
            <Text style={styles.quickStatLabel}>{t('club', 'tournamentsLabel')}</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{club.membershipCost ? `${club.membershipCost}€` : '-'}</Text>
            <Text style={styles.quickStatLabel}>{t('club', 'membership')}</Text>
          </View>
        </Animated.View>

        {/* Location */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('club', 'locationLabel')}</Text>
          <View style={styles.locationCard}>
            <View style={styles.locationInfo}>
              <Text style={styles.locationAddress}>{club.address}</Text>
              <Text style={styles.locationCity}>{club.city}</Text>
            </View>
            <Pressable 
              style={styles.mapButton}
              onPress={() => router.push('/(tabs)/map')}
            >
              <MaterialIcons name="map" size={20} color={theme.primary} />
              <Text style={styles.mapButtonText}>{t('club', 'viewOnMap')}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Facilities */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('club', 'facilitiesLabel')}</Text>
          <View style={styles.facilitiesGrid}>
            {club.facilities.map((facility, index) => (
              <View key={index} style={styles.facilityTag}>
                <MaterialIcons name="check-circle" size={16} color={theme.success} />
                <Text style={styles.facilityText}>{t('facilityLabels', facility) || facility}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Contact */}
        {(club.contactEmail || club.contactPhone) && (
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'contactLabel')}</Text>
            <View style={styles.contactCard}>
              {club.contactEmail && (
                <Pressable 
                  style={styles.contactRow}
                  onPress={() => Linking.openURL(`mailto:${club.contactEmail}`)}
                >
                  <MaterialIcons name="email" size={20} color={theme.primary} />
                  <Text style={styles.contactText}>{club.contactEmail}</Text>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </Pressable>
              )}
              {club.contactPhone && (
                <Pressable 
                  style={[styles.contactRow, !club.contactEmail && { borderTopWidth: 0 }]}
                  onPress={() => Linking.openURL(`tel:${club.contactPhone}`)}
                >
                  <MaterialIcons name="phone" size={20} color={theme.primary} />
                  <Text style={styles.contactText}>{club.contactPhone}</Text>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* Members */}
        {clubPlayers.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('club', 'membersCount')} ({clubPlayers.length})</Text>
            </View>
            {clubPlayers.slice(0, 5).map(player => (
              <Pressable 
                key={player.id} 
                style={styles.memberCard}
                onPress={() => router.push(`/player/${player.id}`)}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitials}>
                    {player.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{player.name}</Text>
                  <Text style={styles.memberRole}>{player.role} • {player.level}</Text>
                </View>
                <View style={styles.memberStats}>
                  <Text style={styles.memberWinRate}>{player.stats.winRate}%</Text>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </View>
              </Pressable>
            ))}
          </Animated.View>
        )}

        {/* Tournaments */}
        {clubTournaments.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('club', 'organizedTournaments')}</Text>
            {clubTournaments.map(tournament => (
              <Pressable 
                key={tournament.id}
                style={styles.tournamentCard}
                onPress={() => router.push(`/tournament/${tournament.id}`)}
              >
                <View style={styles.tournamentDate}>
                  <Text style={styles.tournamentDay}>
                    {new Date(tournament.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric' })}
                  </Text>
                  <Text style={styles.tournamentMonth}>
                    {new Date(tournament.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.tournamentInfo}>
                  <Text style={styles.tournamentName}>{tournament.name}</Text>
                  <Text style={styles.tournamentFormat}>
                    {t('formats', tournament.format)} • {t('tournamentTypes', tournament.type)}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: tournament.status === 'À venir' ? theme.primaryLight + '30' : theme.backgroundSecondary }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: tournament.status === 'À venir' ? theme.primary : theme.textSecondary }
                  ]}>
                    {t('tournamentStatus', tournament.status)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Animated.View>
        )}
      </ScrollView>

      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        itemType="club"
        itemId={id!}
        itemName={club.name}
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
  clubCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  clubIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  clubName: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  clubMetaText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  clubDescription: {
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  locationCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  locationInfo: {
    marginBottom: 16,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  locationCity: {
    fontSize: 15,
    color: theme.textSecondary,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primaryLight + '20',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  mapButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
  },
  facilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facilityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.card,
  },
  facilityText: {
    fontSize: 14,
    color: theme.textPrimary,
  },
  contactCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  contactText: {
    flex: 1,
    fontSize: 15,
    color: theme.textPrimary,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  memberRole: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  memberStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberWinRate: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.success,
  },
  tournamentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 12,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  tournamentDate: {
    width: 50,
    alignItems: 'center',
    marginRight: 12,
  },
  tournamentDay: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  tournamentMonth: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'uppercase',
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  tournamentFormat: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
