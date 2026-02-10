import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { Tournament, Match } from '@/services/mockData';

interface TournamentPalmaresItem {
  tournament: Tournament;
  matches: Match[];
  stats: {
    played: number;
    wins: number;
    losses: number;
    winRate: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDiff: number;
    tirRate: number | null;
    carreaux: number;
  };
}

const RESULT_CONFIG: Record<string, { icon: string; color: string; rank: number }> = {
  '1er': { icon: 'emoji-events', color: '#FFD700', rank: 1 },
  '2ème': { icon: 'workspace-premium', color: '#C0C0C0', rank: 2 },
  '3ème': { icon: 'military-tech', color: '#CD7F32', rank: 3 },
  'Demi-finale': { icon: 'trending-up', color: '#4A90D9', rank: 4 },
  'Quart de finale': { icon: 'trending-flat', color: '#F5A623', rank: 5 },
  '1/8 finale': { icon: 'sports', color: '#7B8794', rank: 6 },
  'Poules': { icon: 'group', color: '#7B8794', rank: 7 },
  'Autre': { icon: 'more-horiz', color: '#7B8794', rank: 8 },
};

function TournamentCard({ item, index }: { item: TournamentPalmaresItem; index: number }) {
  const { tournament, stats } = item;
  const resultCfg = RESULT_CONFIG[tournament.finalResult || ''] || { icon: 'sports', color: theme.textMuted, rank: 99 };
  const hasFinancials = (tournament.registrationCost && tournament.registrationCost > 0) || (tournament.prizeWon && tournament.prizeWon > 0);
  const netGain = (tournament.prizeWon || 0) - (tournament.registrationCost || 0);

  return (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
      <Pressable
        style={styles.card}
        onPress={() => {
          Haptics.selectionAsync();
          router.push(`/tournament/${tournament.id}`);
        }}
      >
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={[styles.resultBadge, { backgroundColor: resultCfg.color + '20' }]}>
            <MaterialIcons name={resultCfg.icon as any} size={24} color={resultCfg.color} />
          </View>
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardName} numberOfLines={2}>{tournament.name}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.cardDate}>
                {new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <View style={styles.dot} />
              <Text style={styles.cardFormat}>{tournament.format}</Text>
              <View style={styles.dot} />
              <Text style={styles.cardCity}>{tournament.location?.city}</Text>
            </View>
          </View>
          {tournament.finalResult && (
            <View style={[styles.resultTag, { backgroundColor: resultCfg.color + '15', borderColor: resultCfg.color + '40' }]}>
              <Text style={[styles.resultTagText, { color: resultCfg.color }]}>{tournament.finalResult}</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.played}</Text>
            <Text style={styles.statLabel}>Matchs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.success }]}>{stats.wins}</Text>
            <Text style={styles.statLabel}>V</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.error }]}>{stats.losses}</Text>
            <Text style={styles.statLabel}>D</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{stats.winRate}%</Text>
            <Text style={styles.statLabel}>Vict.</Text>
          </View>
          {stats.tirRate !== null && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.tirColor }]}>{stats.tirRate}%</Text>
                <Text style={styles.statLabel}>Tir</Text>
              </View>
            </>
          )}
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: stats.pointDiff >= 0 ? theme.success : theme.error }]}>
              {stats.pointDiff > 0 ? '+' : ''}{stats.pointDiff}
            </Text>
            <Text style={styles.statLabel}>Diff.</Text>
          </View>
        </View>

        {/* Financials Row */}
        {hasFinancials && (
          <View style={styles.financialRow}>
            {tournament.registrationCost ? (
              <View style={styles.financialItem}>
                <MaterialIcons name="payments" size={14} color={theme.error} />
                <Text style={[styles.financialText, { color: theme.error }]}>-{tournament.registrationCost}€</Text>
              </View>
            ) : null}
            {tournament.prizeWon ? (
              <View style={styles.financialItem}>
                <MaterialIcons name="emoji-events" size={14} color={theme.success} />
                <Text style={[styles.financialText, { color: theme.success }]}>+{tournament.prizeWon}€</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }} />
            <View style={[styles.netBadge, { backgroundColor: netGain >= 0 ? theme.success + '15' : theme.error + '15' }]}>
              <Text style={[styles.netText, { color: netGain >= 0 ? theme.success : theme.error }]}>
                Net: {netGain >= 0 ? '+' : ''}{netGain}€
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.cardType}>
            <MaterialIcons name="category" size={12} color={theme.textMuted} />
            <Text style={styles.cardTypeText}>{tournament.type}</Text>
          </View>
          {stats.carreaux > 0 && (
            <View style={styles.carreauBadge}>
              <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
              <Text style={styles.carreauText}>{stats.carreaux} carreaux</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function PalmaresScreen() {
  const insets = useSafeAreaInsets();
  const { tournaments, matches } = useApp();

  // Build palmares data
  const palmaresData = useMemo(() => {
    const finishedTournaments = tournaments.filter(t => t.status === 'Terminé');

    const items: TournamentPalmaresItem[] = finishedTournaments.map(tournament => {
      const tournamentMatches = matches.filter(m => m.tournamentId === tournament.id);
      const wins = tournamentMatches.filter(m => m.winner === 'A').length;
      const losses = tournamentMatches.length - wins;
      const pointsFor = tournamentMatches.reduce((sum, m) => sum + (m.teamA?.score || 0), 0);
      const pointsAgainst = tournamentMatches.reduce((sum, m) => sum + (m.teamB?.score || 0), 0);

      let totalTirs = 0, totalTirsSuccess = 0, totalCarreaux = 0;
      tournamentMatches.forEach(m => {
        if (m.playerActions) {
          m.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
            totalTirs += pa.actions.tirs;
            totalTirsSuccess += pa.actions.tirsSuccess;
            totalCarreaux += pa.actions.carreaux;
          });
        }
      });

      return {
        tournament,
        matches: tournamentMatches,
        stats: {
          played: tournamentMatches.length,
          wins,
          losses,
          winRate: tournamentMatches.length > 0 ? Math.round((wins / tournamentMatches.length) * 100) : 0,
          pointsFor,
          pointsAgainst,
          pointDiff: pointsFor - pointsAgainst,
          tirRate: totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : null,
          carreaux: totalCarreaux,
        },
      };
    });

    // Sort: by result rank first, then by date descending
    items.sort((a, b) => {
      const rankA = RESULT_CONFIG[a.tournament.finalResult || '']?.rank || 99;
      const rankB = RESULT_CONFIG[b.tournament.finalResult || '']?.rank || 99;
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.tournament.date).getTime() - new Date(a.tournament.date).getTime();
    });

    return items;
  }, [tournaments, matches]);

  // Summary stats
  const summary = useMemo(() => {
    const totalTournaments = palmaresData.length;
    const totalWins = palmaresData.reduce((sum, item) => sum + item.stats.wins, 0);
    const totalMatches = palmaresData.reduce((sum, item) => sum + item.stats.played, 0);
    const totalGains = palmaresData.reduce((sum, item) => sum + (item.tournament.prizeWon || 0), 0);
    const totalCosts = palmaresData.reduce((sum, item) => sum + (item.tournament.registrationCost || 0), 0);
    const podiums = palmaresData.filter(item => ['1er', '2ème', '3ème'].includes(item.tournament.finalResult || '')).length;
    const titles = palmaresData.filter(item => item.tournament.finalResult === '1er').length;

    return { totalTournaments, totalWins, totalMatches, totalGains, totalCosts, podiums, titles };
  }, [palmaresData]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Mon Palmarès</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={palmaresData}
        keyExtractor={item => item.tournament.id}
        renderItem={({ item, index }) => <TournamentCard item={item} index={index} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <>
            {/* Summary Hero */}
            <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
              <View style={styles.heroIconRow}>
                <View style={styles.heroIcon}>
                  <MaterialIcons name="emoji-events" size={36} color={theme.carreauColor} />
                </View>
              </View>
              <Text style={styles.heroTitle}>{summary.totalTournaments} tournois</Text>
              <Text style={styles.heroSubtitle}>{summary.totalMatches} matchs joués</Text>

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.carreauColor }]}>{summary.titles}</Text>
                  <Text style={styles.heroStatLabel}>Titres</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.accent }]}>{summary.podiums}</Text>
                  <Text style={styles.heroStatLabel}>Podiums</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: theme.success }]}>{summary.totalWins}</Text>
                  <Text style={styles.heroStatLabel}>Victoires</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: summary.totalGains - summary.totalCosts >= 0 ? theme.success : theme.error }]}>
                    {summary.totalGains - summary.totalCosts >= 0 ? '+' : ''}{summary.totalGains - summary.totalCosts}€
                  </Text>
                  <Text style={styles.heroStatLabel}>Bilan</Text>
                </View>
              </View>
            </Animated.View>

            {palmaresData.length > 0 && (
              <Text style={styles.listSectionTitle}>DÉTAIL PAR TOURNOI</Text>
            )}
          </>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <MaterialIcons name="emoji-events" size={64} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>Aucun tournoi terminé</Text>
            <Text style={styles.emptyText}>Participez à des tournois pour construire votre palmarès</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push('/tournament/new')}>
              <MaterialIcons name="add" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>Créer un tournoi</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  // Hero
  heroCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.xl,
    padding: 24, alignItems: 'center', marginBottom: 20, ...theme.shadows.card,
  },
  heroIconRow: { marginBottom: 12 },
  heroIcon: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: theme.carreauColor + '15', alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.textPrimary },
  heroSubtitle: { fontSize: 14, color: theme.textSecondary, marginTop: 4, marginBottom: 20 },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.lg,
    paddingVertical: 16, paddingHorizontal: 8,
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
  heroStatLabel: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: theme.border },
  // List
  listSectionTitle: {
    fontSize: 12, fontWeight: '600', color: theme.textSecondary,
    letterSpacing: 1, marginBottom: 12, paddingLeft: 4,
  },
  // Card
  card: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 16, marginBottom: 12, ...theme.shadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  resultBadge: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cardHeaderInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardDate: { fontSize: 12, color: theme.textSecondary },
  cardFormat: { fontSize: 12, color: theme.textSecondary },
  cardCity: { fontSize: 12, color: theme.textSecondary },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted, marginHorizontal: 6 },
  resultTag: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: theme.borderRadius.full, borderWidth: 1,
  },
  resultTagText: { fontSize: 12, fontWeight: '700' },
  // Stats row
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  statLabel: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: theme.border },
  // Financials
  financialRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, marginBottom: 8,
  },
  financialItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  financialText: { fontSize: 13, fontWeight: '600' },
  netBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.borderRadius.full },
  netText: { fontSize: 12, fontWeight: '700' },
  // Footer
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardType: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  cardTypeText: { fontSize: 11, color: theme.textMuted, fontWeight: '500' },
  carreauBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.carreauColor + '15', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  carreauText: { fontSize: 11, color: theme.carreauColor, fontWeight: '600' },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 260, marginBottom: 24 },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  emptyButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});
