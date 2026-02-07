import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { TournamentType } from '@/constants/config';

// Base tournament phases
const BASE_PHASES = [
  { id: 'Poules', label: 'Poules', short: 'PL' },
  { id: '1/16 finale', label: '1/16', short: '1/16' },
  { id: '1/8 finale', label: '1/8', short: '1/8' },
  { id: 'Quart de finale', label: 'Quarts', short: 'QF' },
  { id: 'Demi-finale', label: 'Demis', short: 'DF' },
  { id: 'Petite finale', label: 'Petite F.', short: 'PF' },
  { id: 'Finale', label: 'Finale', short: 'F' },
];

// Phases configuration by cadrage type
const PHASES_BY_CADRAGE: Record<TournamentType, { id: string; label: string; short: string }[]> = {
  'Poules': [
    { id: 'Poule 1', label: 'Poule 1', short: 'P1' },
    { id: 'Poule 2', label: 'Poule 2', short: 'P2' },
    { id: 'Poule 3', label: 'Poule 3', short: 'P3' },
    { id: 'Classement', label: 'Classement', short: 'CL' },
  ],
  'Élimination directe': [
    { id: '1/16 finale', label: '1/16', short: '1/16' },
    { id: '1/8 finale', label: '1/8', short: '1/8' },
    { id: 'Quart de finale', label: 'Quarts', short: 'QF' },
    { id: 'Demi-finale', label: 'Demis', short: 'DF' },
    { id: 'Finale', label: 'Finale', short: 'F' },
  ],
  'Mixte': [
    { id: 'Poules', label: 'Poules', short: 'PL' },
    { id: '1/8 finale', label: '1/8', short: '1/8' },
    { id: 'Quart de finale', label: 'Quarts', short: 'QF' },
    { id: 'Demi-finale', label: 'Demis', short: 'DF' },
    { id: 'Finale', label: 'Finale', short: 'F' },
  ],
  'Suisse': [
    { id: 'Ronde 1', label: 'R1', short: 'R1' },
    { id: 'Ronde 2', label: 'R2', short: 'R2' },
    { id: 'Ronde 3', label: 'R3', short: 'R3' },
    { id: 'Ronde 4', label: 'R4', short: 'R4' },
    { id: 'Ronde 5', label: 'R5', short: 'R5' },
    { id: 'Classement', label: 'Class.', short: 'CL' },
  ],
  'A/B/C': [
    { id: 'Poules', label: 'Poules', short: 'PL' },
    { id: 'Tableau A', label: 'Tab. A', short: 'A' },
    { id: 'Tableau B', label: 'Tab. B', short: 'B' },
    { id: 'Tableau C', label: 'Tab. C', short: 'C' },
    { id: 'Finale', label: 'Finale', short: 'F' },
  ],
  'Tirage intégral': [
    { id: 'Tour 1', label: 'T1', short: 'T1' },
    { id: 'Tour 2', label: 'T2', short: 'T2' },
    { id: 'Tour 3', label: 'T3', short: 'T3' },
    { id: 'Demi-finale', label: 'Demis', short: 'DF' },
    { id: 'Finale', label: 'Finale', short: 'F' },
  ],
  'Autre': BASE_PHASES,
};

const BRACKETS = ['A', 'B', 'C', 'D'] as const;

export default function TournamentDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTournamentById, getClubById, getTerrainById, getMatchesByTournament, addMatch, players } = useApp();

  const tournament = getTournamentById(id!);
  const club = tournament?.clubId ? getClubById(tournament.clubId) : null;
  const terrain = tournament?.terrainId ? getTerrainById(tournament.terrainId) : null;
  const tournamentMatches = getMatchesByTournament(id!);
  
  // Get phases based on tournament cadrage
  const tournamentPhases = useMemo(() => {
    if (!tournament) return BASE_PHASES;
    return PHASES_BY_CADRAGE[tournament.type] || BASE_PHASES;
  }, [tournament]);

  // End tournament modal state
  const [showEndTournament, setShowEndTournament] = useState(false);

  // Filter and sort matches
  const myMatches = useMemo(() => {
    return tournamentMatches.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [tournamentMatches]);

  // Calculate stats
  const myStats = useMemo(() => {
    const wins = myMatches.filter(m => m.winner === 'A').length;
    const losses = myMatches.filter(m => m.winner === 'B').length;
    const totalPointsFor = myMatches.reduce((acc, m) => acc + m.teamA.score, 0);
    const totalPointsAgainst = myMatches.reduce((acc, m) => acc + m.teamB.score, 0);
    
    let totalTirs = 0, totalTirsSuccess = 0, totalCarreaux = 0;
    myMatches.forEach(match => {
      if (match.playerActions) {
        match.playerActions.filter(pa => pa.team === 'A').forEach(pa => {
          totalTirs += pa.actions.tirs;
          totalTirsSuccess += pa.actions.tirsSuccess;
          totalCarreaux += pa.actions.carreaux;
        });
      }
    });

    return {
      played: myMatches.length,
      wins,
      losses,
      winRate: myMatches.length > 0 ? Math.round((wins / myMatches.length) * 100) : 0,
      totalPointsFor,
      totalPointsAgainst,
      pointDiff: totalPointsFor - totalPointsAgainst,
      tirRate: totalTirs > 0 ? Math.round((totalTirsSuccess / totalTirs) * 100) : null,
      carreaux: totalCarreaux,
    };
  }, [myMatches]);

  // Determine suggested next phase
  const suggestedNextPhase = useMemo(() => {
    if (myMatches.length === 0) return tournamentPhases[0]?.id || 'Poules';
    
    const lastMatch = myMatches[myMatches.length - 1];
    const lastPhase = lastMatch.tournamentPhase;
    const lastWon = lastMatch.winner === 'A';
    
    if (!lastWon) return lastPhase; // If lost, might replay same phase or eliminated
    
    const phaseIndex = tournamentPhases.findIndex(p => p.id === lastPhase);
    if (phaseIndex < tournamentPhases.length - 1) {
      return tournamentPhases[phaseIndex + 1].id;
    }
    return lastPhase;
  }, [myMatches, tournamentPhases]);

  // Determine bracket from last match
  const suggestedBracket = useMemo(() => {
    if (myMatches.length === 0) return null;
    const lastMatch = myMatches[myMatches.length - 1];
    return lastMatch.tournamentBracket || null;
  }, [myMatches]);

  // Journey status
  const journeyStatus = useMemo(() => {
    if (myMatches.length === 0) return { status: 'not_started', label: 'En attente', color: theme.textMuted, icon: 'hourglass-empty' };
    
    const lastMatch = myMatches[myMatches.length - 1];
    const lastMatchWon = lastMatch.winner === 'A';
    const phase = lastMatch.tournamentPhase?.toLowerCase() || '';
    const lastPhaseIndex = tournamentPhases.findIndex(p => p.id === lastMatch.tournamentPhase);
    const isLastPhase = lastPhaseIndex === tournamentPhases.length - 1;
    
    // Check for champion status (won the last phase)
    if (isLastPhase && lastMatchWon) {
      return { status: 'champion', label: 'Champion !', color: theme.carreauColor, icon: 'emoji-events' };
    }
    // Check for finalist (lost in finale)
    if ((phase.includes('finale') || isLastPhase) && !lastMatchWon) {
      return { status: 'finalist', label: phase === 'finale' ? 'Finaliste' : 'Parcours terminé', color: theme.accent, icon: 'workspace-premium' };
    }
    // For Swiss/Poules systems, check if all rounds completed
    if ((tournament?.type === 'Suisse' || tournament?.type === 'Poules') && phase.includes('classement')) {
      return { status: 'completed', label: 'Classé', color: theme.success, icon: 'emoji-events' };
    }
    if (lastMatchWon) {
      return { status: 'advancing', label: 'En course', color: theme.success, icon: 'trending-up' };
    }
    // For elimination formats
    if (tournament?.type === 'Élimination directe' || tournament?.type === 'Tirage intégral') {
      return { status: 'eliminated', label: 'Éliminé', color: theme.error, icon: 'block' };
    }
    return { status: 'continuing', label: 'Continue', color: theme.warning, icon: 'trending-flat' };
  }, [myMatches, tournamentPhases, tournament]);

  // Current phase progress
  const currentPhaseIndex = useMemo(() => {
    if (myMatches.length === 0) return 0;
    const lastMatch = myMatches[myMatches.length - 1];
    const idx = tournamentPhases.findIndex(p => p.id === lastMatch.tournamentPhase);
    return idx >= 0 ? idx + 1 : 0;
  }, [myMatches, tournamentPhases]);

  // End tournament handler
  const handleEndTournament = (finalStatus: 'Champion' | 'Finaliste' | 'Éliminé') => {
    // Update tournament status to finished
    if (tournament) {
      // Could update tournament status here if needed
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowEndTournament(false);
    router.back();
  };

  if (!tournament) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Mon Parcours</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="error-outline" size={64} color={theme.textMuted} />
          <Text style={styles.emptyText}>Tournoi non trouvé</Text>
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
        <Text style={styles.headerTitle}>Mon Parcours</Text>
        <Pressable 
          style={styles.editButton}
          onPress={() => router.push(`/tournament/edit/${tournament.id}`)}
        >
          <MaterialIcons name="edit" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tournament Header Card */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.tournamentCard}>
          <View style={styles.tournamentRow}>
            <View style={styles.tournamentIcon}>
              <MaterialIcons name="emoji-events" size={28} color={theme.carreauColor} />
            </View>
            <View style={styles.tournamentInfo}>
              <Text style={styles.tournamentName} numberOfLines={2}>{tournament.name}</Text>
              <View style={styles.tournamentMeta}>
                <MaterialIcons name="event" size={14} color={theme.textSecondary} />
                <Text style={styles.tournamentMetaText}>
                  {new Date(tournament.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </Text>
                <View style={styles.dot} />
                <Text style={styles.tournamentMetaText}>{tournament.location.city}</Text>
                <View style={styles.dot} />
                <Text style={styles.tournamentMetaText}>{tournament.format}</Text>
              </View>
            </View>
          </View>
          
          {/* Terrain Info */}
          {terrain && (
            <Pressable 
              style={styles.terrainInfoRow}
              onPress={() => router.push(`/terrain/${terrain.id}`)}
            >
              <View style={styles.terrainInfoIcon}>
                <MaterialIcons 
                  name={config.terrainTypes.find(t => t.id === terrain.type)?.icon as any || 'landscape'} 
                  size={18} 
                  color={theme.accent} 
                />
              </View>
              <View style={styles.terrainInfoContent}>
                <Text style={styles.terrainInfoName}>{terrain.name}</Text>
                <Text style={styles.terrainInfoType}>{terrain.type} • {terrain.address}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>
          )}
        </Animated.View>

        {/* Status Card */}
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.statusCard}>
          <View style={[styles.statusIconBox, { backgroundColor: journeyStatus.color + '20' }]}>
            <MaterialIcons name={journeyStatus.icon as any} size={32} color={journeyStatus.color} />
          </View>
          <View style={styles.statusInfo}>
            <Text style={[styles.statusLabel, { color: journeyStatus.color }]}>{journeyStatus.label}</Text>
            <Text style={styles.statusSubtext}>
              {myStats.wins}V - {myStats.losses}D • {myStats.pointDiff > 0 ? '+' : ''}{myStats.pointDiff} pts
            </Text>
          </View>
          {myStats.tirRate !== null && (
            <View style={styles.statusStat}>
              <Text style={[styles.statusStatValue, { color: theme.tirColor }]}>{myStats.tirRate}%</Text>
              <Text style={styles.statusStatLabel}>Tir</Text>
            </View>
          )}
        </Animated.View>

        {/* Phase Progress */}
        <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>PROGRESSION</Text>
            <View style={styles.cadrageBadge}>
              <MaterialIcons name="category" size={12} color={theme.primary} />
              <Text style={styles.cadrageBadgeText}>{tournament.type}</Text>
            </View>
          </View>
          <View style={styles.progressCard}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.phasesScroll}
            >
              {tournamentPhases.map((phase, index) => {
                const isCompleted = index < currentPhaseIndex;
                const isCurrent = index === currentPhaseIndex;
                const matchesInPhase = myMatches.filter(m => m.tournamentPhase === phase.id);
                const hasMatchInPhase = matchesInPhase.length > 0;
                const lastMatchInPhase = matchesInPhase[matchesInPhase.length - 1];
                const wonPhase = lastMatchInPhase?.winner === 'A';
                
                // For Swiss/Poules, show number of matches in phase
                const showMatchCount = (tournament.type === 'Suisse' || tournament.type === 'Poules') && matchesInPhase.length > 0;
                
                return (
                  <View key={phase.id} style={styles.phaseItem}>
                    <View style={[
                      styles.phaseCircle,
                      isCompleted && wonPhase && styles.phaseCircleWon,
                      isCompleted && !wonPhase && styles.phaseCircleLost,
                      isCurrent && styles.phaseCircleCurrent,
                    ]}>
                      {isCompleted && hasMatchInPhase ? (
                        <MaterialIcons 
                          name={wonPhase ? 'check' : 'close'} 
                          size={16} 
                          color="#FFF" 
                        />
                      ) : showMatchCount ? (
                        <Text style={[
                          styles.phaseNumber,
                          isCurrent && styles.phaseNumberCurrent
                        ]}>
                          {matchesInPhase.length}
                        </Text>
                      ) : (
                        <Text style={[
                          styles.phaseNumber,
                          isCurrent && styles.phaseNumberCurrent
                        ]}>
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    <Text style={[
                      styles.phaseLabel,
                      isCompleted && styles.phaseLabelCompleted,
                      isCurrent && styles.phaseLabelCurrent
                    ]}>
                      {phase.short}
                    </Text>
                    {index < tournamentPhases.length - 1 && (
                      <View style={[
                        styles.phaseLine,
                        isCompleted && wonPhase && styles.phaseLineCompleted
                      ]} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
            
            {/* Cadrage description */}
            <View style={styles.cadrageDescription}>
              <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
              <Text style={styles.cadrageDescriptionText}>
                {tournament.type === 'Poules' && 'Matchs en poules, classement final'}
                {tournament.type === 'Élimination directe' && 'Élimination simple, un match perdu = éliminé'}
                {tournament.type === 'Mixte' && 'Poules puis tableau à élimination'}
                {tournament.type === 'Suisse' && 'Rondes successives contre adversaires de même niveau'}
                {tournament.type === 'A/B/C' && 'Tableaux multiples avec repêchage'}
                {tournament.type === 'Tirage intégral' && 'Tableau fixé au tirage, élimination directe'}
                {tournament.type === 'Autre' && 'Format personnalisé'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Match Timeline */}
        <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MES MATCHS</Text>
            <Text style={styles.sectionCount}>{myMatches.length}</Text>
          </View>
          
          {myMatches.length > 0 ? (
            <View style={styles.matchList}>
              {myMatches.map((match, index) => {
                const isWin = match.winner === 'A';
                
                return (
                  <Pressable 
                    key={match.id}
                    style={[styles.matchCard, isWin ? styles.matchCardWin : styles.matchCardLoss]}
                    onPress={() => router.push(`/match/${match.id}`)}
                  >
                    <View style={styles.matchHeader}>
                      <View style={[styles.matchBadge, { backgroundColor: isWin ? theme.success + '20' : theme.error + '20' }]}>
                        <Text style={[styles.matchBadgeText, { color: isWin ? theme.success : theme.error }]}>
                          {match.tournamentPhase || 'Match'}
                        </Text>
                      </View>
                      {match.tournamentBracket && (
                        <View style={styles.bracketTag}>
                          <Text style={styles.bracketTagText}>Tableau {match.tournamentBracket}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }} />
                      <Text style={styles.matchDate}>
                        {new Date(match.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    
                    <View style={styles.matchBody}>
                      <View style={styles.matchTeam}>
                        <Text style={styles.matchTeamLabel}>Moi</Text>
                        <Text style={[styles.matchScore, isWin && styles.matchScoreWin]}>
                          {match.teamA.score}
                        </Text>
                      </View>
                      <View style={styles.matchVs}>
                        <Text style={styles.matchVsText}>-</Text>
                      </View>
                      <View style={[styles.matchTeam, { alignItems: 'flex-end' }]}>
                        <Text style={styles.matchTeamLabel} numberOfLines={1}>
                          {match.teamB.playerNames[0] || 'Adversaire'}
                        </Text>
                        <Text style={[styles.matchScore, !isWin && styles.matchScoreWin]}>
                          {match.teamB.score}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.matchFooter}>
                      <MaterialIcons 
                        name={isWin ? 'check-circle' : 'cancel'} 
                        size={16} 
                        color={isWin ? theme.success : theme.error} 
                      />
                      <Text style={[styles.matchResult, { color: isWin ? theme.success : theme.error }]}>
                        {isWin ? 'Victoire' : 'Défaite'}
                      </Text>
                      <View style={{ flex: 1 }} />
                      <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyMatches}>
              <MaterialIcons name="sports" size={48} color={theme.textMuted} />
              <Text style={styles.emptyMatchesText}>Aucun match enregistré</Text>
              <Text style={styles.emptyMatchesHint}>Ajoutez votre premier match pour commencer à suivre votre parcours</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Action Buttons */}
      <Animated.View 
        entering={FadeIn.duration(300).delay(300)}
        style={[styles.fabContainer, { bottom: insets.bottom + 24 }]}
      >
        <Pressable 
          style={styles.fabSecondary}
          onPress={() => setShowEndTournament(true)}
        >
          <MaterialIcons name="flag" size={22} color={theme.error} />
        </Pressable>
        <Pressable 
          style={styles.fab} 
          onPress={() => router.push(`/match/new?tournamentId=${tournament.id}`)}
        >
          <MaterialIcons name="add" size={28} color="#FFF" />
          <Text style={styles.fabText}>Nouveau Match</Text>
        </Pressable>
      </Animated.View>

      {/* End Tournament Modal */}
      <Modal
        visible={showEndTournament}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEndTournament(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalClose} onPress={() => setShowEndTournament(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>Fin du Tournoi</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Tournament Info */}
            <View style={styles.quickTournamentInfo}>
              <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />
              <Text style={styles.quickTournamentName}>{tournament.name}</Text>
            </View>

            <Text style={styles.endTournamentQuestion}>Comment s'est terminé votre parcours ?</Text>

            {/* Status Options */}
            <View style={styles.endTournamentOptions}>
              <Pressable 
                style={[styles.endTournamentOption, styles.endTournamentOptionChampion]}
                onPress={() => handleEndTournament('Champion')}
              >
                <View style={[styles.endTournamentIconBox, { backgroundColor: theme.carreauColor + '20' }]}>
                  <MaterialIcons name="emoji-events" size={32} color={theme.carreauColor} />
                </View>
                <Text style={styles.endTournamentOptionTitle}>Champion !</Text>
                <Text style={styles.endTournamentOptionDesc}>J'ai remporté le tournoi</Text>
              </Pressable>

              <Pressable 
                style={[styles.endTournamentOption, styles.endTournamentOptionFinalist]}
                onPress={() => handleEndTournament('Finaliste')}
              >
                <View style={[styles.endTournamentIconBox, { backgroundColor: theme.accent + '20' }]}>
                  <MaterialIcons name="workspace-premium" size={32} color={theme.accent} />
                </View>
                <Text style={styles.endTournamentOptionTitle}>Finaliste</Text>
                <Text style={styles.endTournamentOptionDesc}>Perdu en finale</Text>
              </Pressable>

              <Pressable 
                style={[styles.endTournamentOption, styles.endTournamentOptionEliminated]}
                onPress={() => handleEndTournament('Éliminé')}
              >
                <View style={[styles.endTournamentIconBox, { backgroundColor: theme.error + '20' }]}>
                  <MaterialIcons name="block" size={32} color={theme.error} />
                </View>
                <Text style={styles.endTournamentOptionTitle}>Éliminé</Text>
                <Text style={styles.endTournamentOptionDesc}>Parcours terminé</Text>
              </Pressable>
            </View>

            {/* Stats Summary */}
            <View style={styles.endTournamentStats}>
              <Text style={styles.endTournamentStatsTitle}>Résumé du parcours</Text>
              <View style={styles.endTournamentStatsRow}>
                <View style={styles.endTournamentStatItem}>
                  <Text style={styles.endTournamentStatValue}>{myStats.played}</Text>
                  <Text style={styles.endTournamentStatLabel}>Matchs</Text>
                </View>
                <View style={styles.endTournamentStatItem}>
                  <Text style={[styles.endTournamentStatValue, { color: theme.success }]}>{myStats.wins}</Text>
                  <Text style={styles.endTournamentStatLabel}>Victoires</Text>
                </View>
                <View style={styles.endTournamentStatItem}>
                  <Text style={[styles.endTournamentStatValue, { color: theme.error }]}>{myStats.losses}</Text>
                  <Text style={styles.endTournamentStatLabel}>Défaites</Text>
                </View>
                {myStats.tirRate !== null && (
                  <View style={styles.endTournamentStatItem}>
                    <Text style={[styles.endTournamentStatValue, { color: theme.tirColor }]}>{myStats.tirRate}%</Text>
                    <Text style={styles.endTournamentStatLabel}>Tir</Text>
                  </View>
                )}
              </View>
            </View>
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
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.textMuted,
    marginTop: 12,
  },
  // Tournament card
  tournamentCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 12,
    ...theme.shadows.card,
  },
  tournamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tournamentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.carreauColor + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 6,
  },
  tournamentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tournamentMetaText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginLeft: 4,
  },
  terrainInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 10,
  },
  terrainInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  terrainInfoContent: {
    flex: 1,
  },
  terrainInfoName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  terrainInfoType: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.textMuted,
    marginHorizontal: 6,
  },
  // Status card
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    ...theme.shadows.card,
  },
  statusIconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  statusSubtext: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  statusStat: {
    alignItems: 'center',
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
  },
  statusStatValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statusStatLabel: {
    fontSize: 11,
    color: theme.textMuted,
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cadrageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  cadrageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.primary,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
    marginLeft: 8,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  // Progress
  progressCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  phasesScroll: {
    gap: 8,
  },
  phaseItem: {
    alignItems: 'center',
    paddingHorizontal: 4,
    position: 'relative',
  },
  phaseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  phaseCircleWon: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  phaseCircleLost: {
    backgroundColor: theme.error,
    borderColor: theme.error,
  },
  phaseCircleCurrent: {
    borderColor: theme.primary,
    borderWidth: 3,
  },
  phaseNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textMuted,
  },
  phaseNumberCurrent: {
    color: theme.primary,
  },
  phaseLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '500',
  },
  phaseLabelCompleted: {
    color: theme.textSecondary,
  },
  phaseLabelCurrent: {
    color: theme.primary,
    fontWeight: '600',
  },
  phaseLine: {
    position: 'absolute',
    top: 16,
    left: 44,
    width: 20,
    height: 2,
    backgroundColor: theme.border,
  },
  phaseLineCompleted: {
    backgroundColor: theme.success,
  },
  cadrageDescription: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  cadrageDescriptionText: {
    fontSize: 12,
    color: theme.textMuted,
    flex: 1,
  },
  // Match list
  matchList: {
    gap: 12,
  },
  matchCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderLeftWidth: 4,
    ...theme.shadows.card,
  },
  matchCardWin: {
    borderLeftColor: theme.success,
  },
  matchCardLoss: {
    borderLeftColor: theme.error,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.backgroundSecondary,
    gap: 8,
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bracketTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.sm,
  },
  bracketTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.primary,
  },
  matchDate: {
    fontSize: 12,
    color: theme.textMuted,
  },
  matchBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  matchTeam: {
    flex: 1,
  },
  matchTeamLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  matchScore: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  matchScoreWin: {
    color: theme.textPrimary,
  },
  matchVs: {
    paddingHorizontal: 12,
  },
  matchVsText: {
    fontSize: 18,
    color: theme.textMuted,
  },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 6,
  },
  matchResult: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Empty matches
  emptyMatches: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    ...theme.shadows.card,
  },
  emptyMatchesText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 12,
  },
  emptyMatchesHint: {
    fontSize: 13,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  // FAB
  fabContainer: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.full,
    gap: 8,
    ...theme.shadows.cardElevated,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.primary,
    ...theme.shadows.card,
  },
  // Modal
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
  modalClose: {
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
  modalSave: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
  },
  modalSaveTextDisabled: {
    color: theme.textMuted,
  },
  modalContent: {
    flex: 1,
  },
  modalScroll: {
    padding: 16,
  },
  // Quick match styles
  quickTournamentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.carreauColor + '10',
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 20,
  },
  quickTournamentName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  quickSection: {
    marginBottom: 24,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 10,
  },
  quickPhasesScroll: {
    gap: 8,
  },
  quickPhaseChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  quickPhaseChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  quickPhaseChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  quickPhaseChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  quickBracketRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickBracketBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
  },
  quickBracketBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  quickBracketBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  quickBracketBtnTextActive: {
    color: '#FFF',
  },
  // End tournament modal styles
  endTournamentQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  endTournamentOptions: {
    gap: 12,
    marginBottom: 24,
  },
  endTournamentOption: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  endTournamentOptionChampion: {
    borderColor: theme.carreauColor + '40',
  },
  endTournamentOptionFinalist: {
    borderColor: theme.accent + '40',
  },
  endTournamentOptionEliminated: {
    borderColor: theme.error + '40',
  },
  endTournamentIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  endTournamentOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  endTournamentOptionDesc: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  endTournamentStats: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  endTournamentStatsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  endTournamentStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  endTournamentStatItem: {
    alignItems: 'center',
  },
  endTournamentStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  endTournamentStatLabel: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 2,
  },
});
