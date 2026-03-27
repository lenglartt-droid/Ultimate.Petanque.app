import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { Player } from '@/types/petanque';
import { useLanguage } from '@/hooks/useLanguage';

const { width: screenWidth } = Dimensions.get('window');

export default function PlayerCompareScreen() {
  const insets = useSafeAreaInsets();
  const { player1: initialPlayer1, player2: initialPlayer2 } = useLocalSearchParams<{ 
    player1?: string; 
    player2?: string;
  }>();
  
  const { players, getPlayerById, getHeadToHead, getCommonOpponents, getMatchesByPlayer } = useApp();
  const { t, language } = useLanguage();
  
  const [player1Id, setPlayer1Id] = useState<string | null>(initialPlayer1 || null);
  const [player2Id, setPlayer2Id] = useState<string | null>(initialPlayer2 || null);
  const [showPicker, setShowPicker] = useState<1 | 2 | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const player1 = player1Id ? getPlayerById(player1Id) : null;
  const player2 = player2Id ? getPlayerById(player2Id) : null;

  const headToHead = useMemo(() => {
    if (!player1Id || !player2Id) return null;
    return getHeadToHead(player1Id, player2Id);
  }, [player1Id, player2Id, getHeadToHead]);

  const commonOpponents = useMemo(() => {
    if (!player1Id || !player2Id) return [];
    return getCommonOpponents(player1Id, player2Id);
  }, [player1Id, player2Id, getCommonOpponents]);

  const filteredPlayers = useMemo(() => {
    const excludeId = showPicker === 1 ? player2Id : player1Id;
    return players.filter(p => {
      if (p.id === excludeId) return false;
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(query) || 
             p.club?.toLowerCase().includes(query);
    });
  }, [players, searchQuery, showPicker, player1Id, player2Id]);

  const selectPlayer = (playerId: string) => {
    if (showPicker === 1) {
      setPlayer1Id(playerId);
    } else {
      setPlayer2Id(playerId);
    }
    setShowPicker(null);
    setSearchQuery('');
  };

  const renderStatComparison = (
    label: string,
    value1: number,
    value2: number,
    suffix: string = '',
    higherIsBetter: boolean = true
  ) => {
    const better1 = higherIsBetter ? value1 > value2 : value1 < value2;
    const better2 = higherIsBetter ? value2 > value1 : value2 < value1;
    const equal = value1 === value2;
    
    return (
      <View style={styles.statRow}>
        <View style={[styles.statValue, better1 && styles.statValueWinner]}>
          <Text style={[styles.statValueText, better1 && styles.statValueTextWinner]}>
            {value1.toFixed(1)}{suffix}
          </Text>
          {better1 && !equal && (
            <MaterialIcons name="arrow-drop-up" size={20} color={theme.success} />
          )}
        </View>
        <View style={styles.statLabel}>
          <Text style={styles.statLabelText}>{label}</Text>
        </View>
        <View style={[styles.statValue, better2 && styles.statValueWinner]}>
          {better2 && !equal && (
            <MaterialIcons name="arrow-drop-up" size={20} color={theme.success} />
          )}
          <Text style={[styles.statValueText, better2 && styles.statValueTextWinner]}>
            {value2.toFixed(1)}{suffix}
          </Text>
        </View>
      </View>
    );
  };

  const renderBarComparison = (
    label: string,
    value1: number,
    value2: number,
    color1: string = theme.primary,
    color2: string = theme.accent
  ) => {
    const total = value1 + value2;
    const percent1 = total > 0 ? (value1 / total) * 100 : 50;
    const percent2 = total > 0 ? (value2 / total) * 100 : 50;
    
    return (
      <View style={styles.barComparisonRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <View style={styles.barContainer}>
          <View style={styles.barWrapper}>
            <View style={[styles.bar, styles.barLeft, { width: `${percent1}%`, backgroundColor: color1 }]} />
            <View style={[styles.bar, styles.barRight, { width: `${percent2}%`, backgroundColor: color2 }]} />
          </View>
        </View>
        <View style={styles.barValues}>
          <Text style={[styles.barValueText, { color: color1 }]}>{value1}</Text>
          <Text style={[styles.barValueText, { color: color2 }]}>{value2}</Text>
        </View>
      </View>
    );
  };

  const PlayerSelector = ({ player, slot }: { player: Player | null; slot: 1 | 2 }) => (
    <Pressable
      style={[
        styles.playerSelector,
        slot === 1 ? styles.playerSelector1 : styles.playerSelector2,
        player && styles.playerSelectorFilled
      ]}
      onPress={() => setShowPicker(slot)}
    >
      {player ? (
        <>
          <View style={[
            styles.playerAvatar,
            { backgroundColor: slot === 1 ? theme.primary : theme.accent }
          ]}>
            <Text style={styles.playerInitials}>
              {player.name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>
          <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
          <Text style={styles.playerClub} numberOfLines={1}>{player.club || t('player', 'noClub')}</Text>
          <View style={styles.playerRoleBadge}>
            <Text style={styles.playerRoleText}>{player.role}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.playerPlaceholder}>
            <MaterialIcons name="person-add" size={32} color={theme.textMuted} />
          </View>
          <Text style={styles.playerPlaceholderText}>
            {t('compare', 'selectPlayer')} {slot}
          </Text>
        </>
      )}
    </Pressable>
  );

  const dateLocale = language === 'en' ? 'en-US' : 'fr-FR';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('compare', 'comparison')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Player Selection */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.selectionSection}>
          <PlayerSelector player={player1} slot={1} />
          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <PlayerSelector player={player2} slot={2} />
        </Animated.View>

        {player1 && player2 ? (
          <>
            {/* Head to Head Summary */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('compare', 'faceToFace')}</Text>
              <View style={styles.h2hCard}>
                {headToHead && headToHead.stats.totalMatches > 0 ? (
                  <>
                    <View style={styles.h2hScoreRow}>
                      <View style={styles.h2hScoreItem}>
                        <Text style={[styles.h2hScoreValue, { color: theme.primary }]}>
                          {headToHead.stats.player1Wins}
                        </Text>
                        <Text style={styles.h2hScoreLabel}>{t('compare', 'victories')}</Text>
                      </View>
                      <View style={styles.h2hMatchCount}>
                        <Text style={styles.h2hMatchCountValue}>
                          {headToHead.stats.totalMatches}
                        </Text>
                        <Text style={styles.h2hMatchCountLabel}>{t('compare', 'matches')}</Text>
                      </View>
                      <View style={styles.h2hScoreItem}>
                        <Text style={[styles.h2hScoreValue, { color: theme.accent }]}>
                          {headToHead.stats.player2Wins}
                        </Text>
                        <Text style={styles.h2hScoreLabel}>{t('compare', 'victories')}</Text>
                      </View>
                    </View>
                    
                    {/* Win rate bar */}
                    <View style={styles.h2hBarContainer}>
                      <View 
                        style={[
                          styles.h2hBar, 
                          styles.h2hBarLeft,
                          { width: `${headToHead.stats.player1WinRate}%` }
                        ]} 
                      />
                      <View 
                        style={[
                          styles.h2hBar, 
                          styles.h2hBarRight,
                          { width: `${100 - headToHead.stats.player1WinRate}%` }
                        ]} 
                      />
                    </View>
                    <View style={styles.h2hPercentRow}>
                      <Text style={[styles.h2hPercent, { color: theme.primary }]}>
                        {headToHead.stats.player1WinRate.toFixed(0)}%
                      </Text>
                      <Text style={[styles.h2hPercent, { color: theme.accent }]}>
                        {(100 - headToHead.stats.player1WinRate).toFixed(0)}%
                      </Text>
                    </View>

                    {/* Average scores */}
                    <View style={styles.h2hAvgRow}>
                      <View style={styles.h2hAvgItem}>
                        <Text style={styles.h2hAvgValue}>{headToHead.stats.player1AvgScore}</Text>
                        <Text style={styles.h2hAvgLabel}>{t('compare', 'ptsPerMatch')}</Text>
                      </View>
                      <Text style={styles.h2hAvgDivider}>{t('compare', 'avgScore')}</Text>
                      <View style={styles.h2hAvgItem}>
                        <Text style={styles.h2hAvgValue}>{headToHead.stats.player2AvgScore}</Text>
                        <Text style={styles.h2hAvgLabel}>{t('compare', 'ptsPerMatch')}</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.noH2hContainer}>
                    <MaterialIcons name="sports" size={48} color={theme.textMuted} />
                    <Text style={styles.noH2hText}>
                      {t('compare', 'neverPlayed')}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Stats Comparison */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('compare', 'statistics')}</Text>
              <View style={styles.statsCard}>
                <View style={styles.statsHeader}>
                  <Text style={[styles.statsHeaderName, { color: theme.primary }]}>
                    {player1.name.split(' ')[0]}
                  </Text>
                  <View style={styles.statsHeaderDivider} />
                  <Text style={[styles.statsHeaderName, { color: theme.accent }]}>
                    {player2.name.split(' ')[0]}
                  </Text>
                </View>

                {renderStatComparison(t('compare', 'matchesPlayed'), player1.stats.matchesPlayed, player2.stats.matchesPlayed)}
                {renderStatComparison(t('compare', 'winRate'), player1.stats.winRate, player2.stats.winRate, '%')}
                {renderStatComparison(t('compare', 'shotRate'), player1.stats.tirRate, player2.stats.tirRate, '%')}
                {renderStatComparison(t('compare', 'pointRate'), player1.stats.pointRate, player2.stats.pointRate, '%')}
                {renderStatComparison(t('compare', 'carreauRate'), player1.stats.carreauRate, player2.stats.carreauRate, '%')}
                {renderStatComparison(t('compare', 'ptsScoredPerMatch'), player1.stats.avgPointsScored, player2.stats.avgPointsScored)}
                {renderStatComparison(t('compare', 'ptsConcededPerMatch'), player1.stats.avgPointsConceded, player2.stats.avgPointsConceded, '', false)}
              </View>
            </Animated.View>

            {/* Wins/Losses Comparison */}
            <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('compare', 'globalRecord')}</Text>
              <View style={styles.comparisonCard}>
                {renderBarComparison(t('compare', 'wins'), player1.stats.wins, player2.stats.wins)}
                {renderBarComparison(t('compare', 'losses'), player1.stats.losses, player2.stats.losses)}
              </View>
            </Animated.View>

            {/* Role & Level Comparison */}
            <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('compare', 'profileSection')}</Text>
              <View style={styles.profileCompareCard}>
                <View style={styles.profileRow}>
                  <View style={[styles.profileBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.profileBadgeText, { color: theme.primary }]}>{player1.role}</Text>
                  </View>
                  <Text style={styles.profileLabel}>{t('compare', 'role')}</Text>
                  <View style={[styles.profileBadge, { backgroundColor: theme.accent + '20' }]}>
                    <Text style={[styles.profileBadgeText, { color: theme.accent }]}>{player2.role}</Text>
                  </View>
                </View>
                <View style={styles.profileRow}>
                  <View style={[styles.profileBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.profileBadgeText, { color: theme.primary }]}>{player1.level}</Text>
                  </View>
                  <Text style={styles.profileLabel}>{t('compare', 'level')}</Text>
                  <View style={[styles.profileBadge, { backgroundColor: theme.accent + '20' }]}>
                    <Text style={[styles.profileBadgeText, { color: theme.accent }]}>{player2.level}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Common Opponents */}
            {commonOpponents.length > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(500)} style={styles.section}>
                <Text style={styles.sectionTitle}>{t('compare', 'commonOpponents')} ({commonOpponents.length})</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.opponentsScroll}
                >
                  {commonOpponents.map(opponentId => {
                    const opponent = getPlayerById(opponentId);
                    if (!opponent) return null;
                    return (
                      <Pressable
                        key={opponentId}
                        style={styles.opponentCard}
                        onPress={() => router.push(`/player/${opponentId}`)}
                      >
                        <View style={styles.opponentAvatar}>
                          <Text style={styles.opponentInitials}>
                            {opponent.name.split(' ').map(n => n[0]).join('')}
                          </Text>
                        </View>
                        <Text style={styles.opponentName} numberOfLines={1}>
                          {opponent.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            )}

            {/* Match History */}
            {headToHead && headToHead.matches.length > 0 && (
              <Animated.View entering={FadeInDown.duration(400).delay(600)} style={styles.section}>
                <Text style={styles.sectionTitle}>{t('compare', 'matchHistory')}</Text>
                {headToHead.matches.slice(0, 5).map((match, index) => (
                  <Pressable
                    key={match.id}
                    style={styles.matchHistoryCard}
                    onPress={() => router.push(`/match/${match.id}`)}
                  >
                    <View style={styles.matchHistoryDate}>
                      <Text style={styles.matchHistoryDateText}>
                        {new Date(match.date).toLocaleDateString(dateLocale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                      <View style={styles.matchHistoryModeBadge}>
                        <Text style={styles.matchHistoryModeText}>{t('formats', match.format)}</Text>
                      </View>
                    </View>
                    <View style={styles.matchHistoryScore}>
                      <Text style={[
                        styles.matchHistoryScoreText,
                        match.player1Won ? styles.matchHistoryScoreWin : styles.matchHistoryScoreLose
                      ]}>
                        {match.scoreFor}
                      </Text>
                      <Text style={styles.matchHistoryScoreDash}>-</Text>
                      <Text style={[
                        styles.matchHistoryScoreText,
                        !match.player1Won ? styles.matchHistoryScoreWin : styles.matchHistoryScoreLose
                      ]}>
                        {match.scoreAgainst}
                      </Text>
                    </View>
                    <View style={[
                      styles.matchHistoryResult,
                      { backgroundColor: match.player1Won ? theme.success + '15' : theme.error + '15' }
                    ]}>
                      <MaterialIcons 
                        name={match.player1Won ? 'emoji-events' : 'close'} 
                        size={16} 
                        color={match.player1Won ? theme.success : theme.error} 
                      />
                    </View>
                  </Pressable>
                ))}
              </Animated.View>
            )}
          </>
        ) : (
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
            <MaterialIcons name="compare-arrows" size={64} color={theme.textMuted} />
            <Text style={styles.emptyStateTitle}>{t('compare', 'compareTwoPlayers')}</Text>
            <Text style={styles.emptyStateText}>
              {t('compare', 'emptyStateText')}
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Player Picker Modal */}
      <Modal
        visible={showPicker !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowPicker(null);
          setSearchQuery('');
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => {
                setShowPicker(null);
                setSearchQuery('');
              }}
            >
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {t('compare', 'selectPlayer')} {showPicker}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('compare', 'searchPlayer')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          <ScrollView
            style={styles.playersList}
            contentContainerStyle={styles.playersListContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredPlayers.map(player => (
              <Pressable
                key={player.id}
                style={styles.playerItem}
                onPress={() => selectPlayer(player.id)}
              >
                <View style={styles.playerItemAvatar}>
                  <Text style={styles.playerItemInitials}>
                    {player.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </View>
                <View style={styles.playerItemInfo}>
                  <Text style={styles.playerItemName}>{player.name}</Text>
                  <Text style={styles.playerItemMeta}>
                    {player.role} • {player.level} • {player.stats.winRate.toFixed(0)}% {t('compare', 'winsPercent')}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={theme.textMuted} />
              </Pressable>
            ))}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  selectionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  playerSelector: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  playerSelector1: {
    marginRight: 8,
  },
  playerSelector2: {
    marginLeft: 8,
  },
  playerSelectorFilled: {
    borderColor: theme.border,
  },
  playerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  playerInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  playerClub: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  playerRoleBadge: {
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  playerRoleText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  playerPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  playerPlaceholderText: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
  },
  vsCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -18,
    zIndex: 1,
    ...theme.shadows.card,
  },
  vsText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  // Head to head styles
  h2hCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  h2hScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  h2hScoreItem: {
    alignItems: 'center',
    flex: 1,
  },
  h2hScoreValue: {
    fontSize: 42,
    fontWeight: '700',
  },
  h2hScoreLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  h2hMatchCount: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  h2hMatchCountValue: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  h2hMatchCountLabel: {
    fontSize: 12,
    color: theme.textMuted,
  },
  h2hBarContainer: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: theme.backgroundSecondary,
  },
  h2hBar: {
    height: '100%',
  },
  h2hBarLeft: {
    backgroundColor: theme.primary,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  h2hBarRight: {
    backgroundColor: theme.accent,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  h2hPercentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  h2hPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  h2hAvgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  h2hAvgItem: {
    alignItems: 'center',
  },
  h2hAvgValue: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  h2hAvgLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
  h2hAvgDivider: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  noH2hContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noH2hText: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  // Stats comparison styles
  statsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.backgroundSecondary,
  },
  statsHeaderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsHeaderDivider: {
    width: 100,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  statValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueWinner: {
    backgroundColor: theme.success + '10',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  statValueText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  statValueTextWinner: {
    color: theme.success,
    fontWeight: '700',
  },
  statLabel: {
    width: 100,
    alignItems: 'center',
  },
  statLabelText: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  // Bar comparison styles
  comparisonCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  barComparisonRow: {
    marginBottom: 16,
  },
  barLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  barContainer: {
    marginBottom: 4,
  },
  barWrapper: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.backgroundSecondary,
  },
  bar: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barLeft: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  barRight: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  barValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Profile comparison
  profileCompareCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileBadge: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  profileBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  profileLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginHorizontal: 16,
    width: 60,
    textAlign: 'center',
  },
  // Common opponents
  opponentsScroll: {
    paddingRight: 16,
  },
  opponentCard: {
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: theme.borderRadius.md,
    width: 80,
    ...theme.shadows.card,
  },
  opponentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  opponentInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  opponentName: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  // Match history
  matchHistoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  matchHistoryDate: {
    flex: 1,
  },
  matchHistoryDateText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  matchHistoryModeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  matchHistoryModeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textMuted,
  },
  matchHistoryScore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  matchHistoryScoreText: {
    fontSize: 18,
    fontWeight: '700',
    width: 28,
    textAlign: 'center',
  },
  matchHistoryScoreWin: {
    color: theme.success,
  },
  matchHistoryScoreLose: {
    color: theme.textMuted,
  },
  matchHistoryScoreDash: {
    fontSize: 14,
    color: theme.textMuted,
    marginHorizontal: 4,
  },
  matchHistoryResult: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    padding: 0,
  },
  playersList: {
    flex: 1,
  },
  playersListContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  playerItemAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playerItemInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  playerItemInfo: {
    flex: 1,
  },
  playerItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  playerItemMeta: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
});
