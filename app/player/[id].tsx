import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
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
  const { getPlayerById, getMatchesByPlayer, getClubById } = useApp();

  const player = getPlayerById(id!);
  const playerMatches = getMatchesByPlayer(id!).slice(0, 5);
  const club = player?.clubId ? getClubById(player.clubId) : null;

  if (!player) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Joueur non trouvé</Text>
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
        <Text style={styles.headerTitle}>Profil joueur</Text>
        <Pressable style={styles.editButton} onPress={() => router.push(`/player/edit/${id}`)}>
          <MaterialIcons name="edit" size={22} color={theme.primary} />
        </Pressable>
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
              <Text style={[styles.badgeText, { color: levelColors[player.level] }]}>{player.level}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: theme.primaryLight + '30' }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>{player.role}</Text>
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
            <Text style={styles.quickStatLabel}>Matchs</Text>
          </View>
          <View style={[styles.quickStatItem, styles.quickStatBorder]}>
            <Text style={[styles.quickStatValue, { color: theme.success }]}>{player.stats.wins}</Text>
            <Text style={styles.quickStatLabel}>Victoires</Text>
          </View>
          <View style={styles.quickStatItem}>
            <Text style={[styles.quickStatValue, { color: theme.error }]}>{player.stats.losses}</Text>
            <Text style={styles.quickStatLabel}>Défaites</Text>
          </View>
        </Animated.View>

        {/* Performance Rings */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>PERFORMANCE</Text>
          <View style={styles.ringsContainer}>
            <View style={styles.ringItem}>
              <StatRing value={player.stats.winRate} color={theme.primary} />
              <Text style={styles.ringLabel}>Victoires</Text>
            </View>
            <View style={styles.ringItem}>
              <StatRing value={player.stats.tirRate} color={theme.tirColor} />
              <Text style={styles.ringLabel}>Tir</Text>
            </View>
            <View style={styles.ringItem}>
              <StatRing value={player.stats.pointRate} color={theme.pointColor} />
              <Text style={styles.ringLabel}>Point</Text>
            </View>
            <View style={styles.ringItem}>
              <StatRing value={player.stats.carreauRate} color={theme.carreauColor} />
              <Text style={styles.ringLabel}>Carreau</Text>
            </View>
          </View>
        </Animated.View>

        {/* Detailed Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>DÉTAILS</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Points marqués / match</Text>
              <Text style={styles.detailValue}>{player.stats.avgPointsScored}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Points encaissés / match</Text>
              <Text style={styles.detailValue}>{player.stats.avgPointsConceded}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Différentiel</Text>
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
                <Text style={styles.detailLabel}>Localisation</Text>
                <Text style={styles.detailValue}>{player.location.city}</Text>
              </View>
            )}
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.detailLabel}>Membre depuis</Text>
              <Text style={styles.detailValue}>
                {new Date(player.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Recent Matches */}
        {playerMatches.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>MATCHS RÉCENTS</Text>
            {playerMatches.map(match => {
              const isTeamA = match.teamA.players.includes(id!);
              const won = (isTeamA && match.winner === 'A') || (!isTeamA && match.winner === 'B');
              
              return (
                <Pressable key={match.id} style={styles.matchCard} onPress={() => router.push(`/match/${match.id}`)}>
                  <View style={[styles.matchIndicator, { backgroundColor: won ? theme.success : theme.error }]} />
                  <View style={styles.matchContent}>
                    <View style={styles.matchHeader}>
                      <Text style={styles.matchFormat}>{match.format}</Text>
                      <Text style={styles.matchDate}>
                        {new Date(match.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
  editButton: {
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
});
