import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
  Switch,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { TextInput } from 'react-native';
import { TournamentType } from '@/constants/config';
import {
  requestNotificationPermissions,
  areNotificationsEnabled,
  scheduleTournamentNotifications,
  cancelTournamentNotifications,
  sendTestNotification,
} from '@/services/notificationService';

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

export default function TournamentDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTournamentById, getClubById, getTerrainById, getMatchesByTournament, updateTournament, tournamentNotifications, toggleTournamentNotification, isTournamentNotificationEnabled } = useApp();

  const tournament = getTournamentById(id!);
  const terrain = tournament?.terrainId ? getTerrainById(tournament.terrainId) : null;
  const tournamentMatches = getMatchesByTournament(id!);
  
  // Get phases based on tournament cadrage
  const tournamentPhases = useMemo(() => {
    if (!tournament) return BASE_PHASES;
    return PHASES_BY_CADRAGE[tournament.type] || BASE_PHASES;
  }, [tournament]);

  // End tournament modal state
  const [endTournamentStep, setEndTournamentStep] = useState(0); // 0=hidden, 1=result, 2=details, 3=summary
  const [selectedFinalResult, setSelectedFinalResult] = useState<string | null>(null);
  const [prizeWonInput, setPrizeWonInput] = useState('');
  const [isSavingEnd, setIsSavingEnd] = useState(false);
  
  // Notification modal state
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    oneWeek: true,
    threeDays: true,
    oneDayBefore: true,
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  
  // Notification state
  const isNotificationEnabled = tournament ? isTournamentNotificationEnabled(tournament.id) : false;

  // Check if tournament is upcoming (can set notifications)
  const isUpcoming = tournament && tournament.status === 'À venir';
  const tournamentDate = tournament ? new Date(tournament.date) : new Date();
  const daysUntilTournament = Math.ceil((tournamentDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  // Check notification permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      const enabled = await areNotificationsEnabled();
      setPermissionStatus(enabled ? 'granted' : 'denied');
    };
    checkPermission();
  }, []);

  // Handle notification toggle
  const handleNotificationPress = useCallback(async () => {
    if (!tournament) return;
    Haptics.selectionAsync();
    
    if (!isUpcoming) {
      Alert.alert(
        'Tournoi passé',
        'Les notifications ne sont disponibles que pour les tournois à venir.'
      );
      return;
    }
    
    // Check permission status
    const enabled = await areNotificationsEnabled();
    setPermissionStatus(enabled ? 'granted' : 'denied');
    
    setShowNotificationModal(true);
  }, [tournament, isUpcoming]);

  // Request permission
  const handleRequestPermission = useCallback(async () => {
    Haptics.selectionAsync();
    const granted = await requestNotificationPermissions();
    setPermissionStatus(granted ? 'granted' : 'denied');
    
    if (!granted) {
      Alert.alert(
        'Autorisation requise',
        'Pour recevoir des rappels, activez les notifications dans les paramètres de votre téléphone.',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Ouvrir Paramètres', 
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          },
        ]
      );
    }
  }, []);

  // Send test notification
  const handleTestNotification = useCallback(async () => {
    Haptics.selectionAsync();
    await sendTestNotification();
    Alert.alert('Test envoyé', 'Vous devriez recevoir une notification de test.');
  }, []);

  // Save notification settings
  const handleSaveNotifications = useCallback(async () => {
    if (!tournament) return;
    
    setIsScheduling(true);
    
    try {
      if (isNotificationEnabled) {
        // Disable - cancel notifications
        await cancelTournamentNotifications(tournament.id);
        toggleTournamentNotification(tournament.id);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowNotificationModal(false);
        Alert.alert('Notifications désactivées', 'Vous ne recevrez plus de rappel pour ce tournoi.');
      } else {
        // Enable - schedule notifications
        const scheduledIds = await scheduleTournamentNotifications({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          tournamentDate: tournamentDate,
          oneWeekBefore: notificationSettings.oneWeek && daysUntilTournament >= 7,
          threeDaysBefore: notificationSettings.threeDays && daysUntilTournament >= 3,
          oneDayBefore: notificationSettings.oneDayBefore && daysUntilTournament >= 1,
        });
        
        toggleTournamentNotification(tournament.id);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowNotificationModal(false);
        
        // Build reminder message
        const reminders = [];
        if (notificationSettings.oneWeek && daysUntilTournament >= 7) reminders.push('1 semaine avant');
        if (notificationSettings.threeDays && daysUntilTournament >= 3) reminders.push('3 jours avant');
        if (notificationSettings.oneDayBefore && daysUntilTournament >= 1) reminders.push('la veille');
        
        Alert.alert(
          'Notifications programmées',
          scheduledIds.length > 0 
            ? `${scheduledIds.length} rappel(s) programmé(s) : ${reminders.join(', ')}.`
            : 'Le tournoi est très proche, aucun rappel programmé.'
        );
      }
    } catch (error) {
      console.log('Error scheduling notifications:', error);
      Alert.alert('Erreur', 'Impossible de programmer les notifications.');
    } finally {
      setIsScheduling(false);
    }
  }, [tournament, isNotificationEnabled, notificationSettings, daysUntilTournament, tournamentDate, toggleTournamentNotification]);

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

  // Journey status
  const journeyStatus = useMemo(() => {
    if (myMatches.length === 0) return { status: 'not_started', label: 'En attente', color: theme.textMuted, icon: 'hourglass-empty' };
    
    const lastMatch = myMatches[myMatches.length - 1];
    const lastMatchWon = lastMatch.winner === 'A';
    const phase = lastMatch.tournamentPhase?.toLowerCase() || '';
    const lastPhaseIndex = tournamentPhases.findIndex(p => p.id === lastMatch.tournamentPhase);
    const isLastPhase = lastPhaseIndex === tournamentPhases.length - 1;
    
    if (isLastPhase && lastMatchWon) {
      return { status: 'champion', label: 'Champion !', color: theme.carreauColor, icon: 'emoji-events' };
    }
    if ((phase.includes('finale') || isLastPhase) && !lastMatchWon) {
      return { status: 'finalist', label: phase === 'finale' ? 'Finaliste' : 'Parcours terminé', color: theme.accent, icon: 'workspace-premium' };
    }
    if ((tournament?.type === 'Suisse' || tournament?.type === 'Poules') && phase.includes('classement')) {
      return { status: 'completed', label: 'Classé', color: theme.success, icon: 'emoji-events' };
    }
    if (lastMatchWon) {
      return { status: 'advancing', label: 'En course', color: theme.success, icon: 'trending-up' };
    }
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

  // End tournament: select result
  const handleSelectResult = useCallback((result: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedFinalResult(result);
    // Pre-fill prize if tournament already has one
    if (tournament?.prizeWon) setPrizeWonInput(tournament.prizeWon.toString());
    setEndTournamentStep(2);
  }, [tournament]);

  // End tournament: go to summary
  const handleGoToSummary = useCallback(() => {
    Haptics.selectionAsync();
    setEndTournamentStep(3);
  }, []);

  // End tournament: confirm and save
  const handleConfirmEndTournament = useCallback(async () => {
    if (!tournament || !selectedFinalResult) return;
    setIsSavingEnd(true);
    try {
      const prizeValue = prizeWonInput ? parseFloat(prizeWonInput) : undefined;
      await updateTournament(tournament.id, {
        status: 'Terminé',
        finalResult: selectedFinalResult,
        prizeWon: prizeValue,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEndTournamentStep(0);
      setSelectedFinalResult(null);
      setPrizeWonInput('');
    } catch (e) {
      console.log('Error ending tournament:', e);
      Alert.alert('Erreur', 'Impossible de terminer le tournoi.');
    } finally {
      setIsSavingEnd(false);
    }
  }, [tournament, selectedFinalResult, prizeWonInput, updateTournament]);

  // Reset end tournament modal
  const handleCloseEndTournament = useCallback(() => {
    setEndTournamentStep(0);
    setSelectedFinalResult(null);
    setPrizeWonInput('');
  }, []);

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
        <View style={styles.headerActions}>
          <Pressable 
            style={[styles.notificationButton, isNotificationEnabled && styles.notificationButtonActive]}
            onPress={handleNotificationPress}
          >
            <MaterialIcons 
              name={isNotificationEnabled ? 'notifications-active' : 'notifications-none'} 
              size={20} 
              color={isNotificationEnabled ? theme.warning : theme.textSecondary} 
            />
          </Pressable>
          <Pressable 
            style={styles.editButton}
            onPress={() => router.push(`/tournament/edit/${tournament.id}`)}
          >
            <MaterialIcons name="edit" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
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
          
          {/* Final Result Badge */}
          {tournament.finalResult && tournament.status === 'Terminé' && (() => {
            const resultConfig: Record<string, { icon: string; color: string }> = {
              '1er': { icon: 'emoji-events', color: theme.carreauColor },
              '2ème': { icon: 'workspace-premium', color: theme.accent },
              '3ème': { icon: 'military-tech', color: '#CD7F32' },
              'Demi-finale': { icon: 'trending-up', color: theme.primary },
              'Quart de finale': { icon: 'trending-flat', color: theme.warning },
              '1/8 finale': { icon: 'sports', color: theme.textSecondary },
              'Poules': { icon: 'group', color: theme.textSecondary },
              'Autre': { icon: 'more-horiz', color: theme.textMuted },
            };
            const cfg = resultConfig[tournament.finalResult || ''] || { icon: 'sports', color: theme.textSecondary };
            return (
              <View style={styles.finalResultBanner}>
                <MaterialIcons name={cfg.icon as any} size={20} color={cfg.color} />
                <Text style={[styles.finalResultBannerText, { color: cfg.color }]}>
                  {tournament.finalResult}
                </Text>
              </View>
            );
          })()}
          
          {/* Tournament Classification Badges */}
          {(tournament.tournamentLevel || tournament.tournamentCategory || tournament.registrationType || tournament.tournamentScope) && (
            <View style={styles.classificationBadgesContainer}>
              {tournament.tournamentLevel && (
                <View style={[styles.classificationBadge, { backgroundColor: theme.success + '15' }]}>
                  <MaterialIcons name="signal-cellular-alt" size={12} color={theme.success} />
                  <Text style={[styles.classificationBadgeText, { color: theme.success }]}>{tournament.tournamentLevel}</Text>
                </View>
              )}
              {tournament.tournamentCategory && (
                <View style={[styles.classificationBadge, { backgroundColor: theme.warning + '15' }]}>
                  <MaterialIcons name="category" size={12} color={theme.warning} />
                  <Text style={[styles.classificationBadgeText, { color: theme.warning }]}>{tournament.tournamentCategory}</Text>
                </View>
              )}
              {tournament.registrationType && (
                <View style={[styles.classificationBadge, { backgroundColor: theme.primary + '15' }]}>
                  <MaterialIcons name="how-to-reg" size={12} color={theme.primary} />
                  <Text style={[styles.classificationBadgeText, { color: theme.primary }]}>{tournament.registrationType}</Text>
                </View>
              )}
              {tournament.tournamentScope && (
                <View style={[styles.classificationBadge, { backgroundColor: theme.accent + '15' }]}>
                  <MaterialIcons name="public" size={12} color={theme.accent} />
                  <Text style={[styles.classificationBadgeText, { color: theme.accent }]}>{tournament.tournamentScope}</Text>
                </View>
              )}
            </View>
          )}
          
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
                        <Text style={[styles.phaseNumber, isCurrent && styles.phaseNumberCurrent]}>
                          {matchesInPhase.length}
                        </Text>
                      ) : (
                        <Text style={[styles.phaseNumber, isCurrent && styles.phaseNumberCurrent]}>
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
                      <View style={[styles.phaseLine, isCompleted && wonPhase && styles.phaseLineCompleted]} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
            
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
              {myMatches.map((match) => {
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
          onPress={() => setEndTournamentStep(1)}
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

      {/* Notification Settings Modal */}
      <Modal
        visible={showNotificationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalClose} onPress={() => setShowNotificationModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>Notifications</Text>
            <Pressable 
              style={[styles.modalSave, (isScheduling || permissionStatus !== 'granted') && styles.modalSaveDisabled]}
              onPress={handleSaveNotifications}
              disabled={isScheduling || permissionStatus !== 'granted'}
            >
              {isScheduling ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[styles.modalSaveText, permissionStatus !== 'granted' && styles.modalSaveTextDisabled]}>
                  {isNotificationEnabled ? 'Désactiver' : 'Activer'}
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.notificationModalScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Tournament Info */}
            <View style={styles.notificationTournamentInfo}>
              <View style={styles.notificationTournamentIcon}>
                <MaterialIcons name="emoji-events" size={28} color={theme.carreauColor} />
              </View>
              <View style={styles.notificationTournamentDetails}>
                <Text style={styles.notificationTournamentName} numberOfLines={2}>
                  {tournament?.name}
                </Text>
                <Text style={styles.notificationTournamentDate}>
                  {tournamentDate.toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </Text>
                {daysUntilTournament > 0 ? (
                  <View style={styles.daysCountdown}>
                    <MaterialIcons name="schedule" size={14} color={theme.primary} />
                    <Text style={styles.daysCountdownText}>
                      Dans {daysUntilTournament} jour{daysUntilTournament > 1 ? 's' : ''}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.daysCountdown, { backgroundColor: theme.warning + '15' }]}>
                    <MaterialIcons name="event" size={14} color={theme.warning} />
                    <Text style={[styles.daysCountdownText, { color: theme.warning }]}>
                      {daysUntilTournament === 0 ? "Aujourd'hui" : 'Passé'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Permission Status */}
            {permissionStatus !== 'granted' && (
              <View style={styles.permissionBanner}>
                <View style={styles.permissionBannerIcon}>
                  <MaterialIcons name="notifications-off" size={24} color={theme.warning} />
                </View>
                <View style={styles.permissionBannerContent}>
                  <Text style={styles.permissionBannerTitle}>Autorisations requises</Text>
                  <Text style={styles.permissionBannerDesc}>
                    Activez les notifications pour recevoir des rappels
                  </Text>
                </View>
                <Pressable style={styles.permissionBannerBtn} onPress={handleRequestPermission}>
                  <Text style={styles.permissionBannerBtnText}>Autoriser</Text>
                </Pressable>
              </View>
            )}

            {/* Current Status */}
            <View style={[
              styles.notificationStatusBanner,
              isNotificationEnabled ? styles.notificationStatusEnabled : styles.notificationStatusDisabled
            ]}>
              <MaterialIcons 
                name={isNotificationEnabled ? 'notifications-active' : 'notifications-off'} 
                size={24} 
                color={isNotificationEnabled ? theme.success : theme.textMuted} 
              />
              <View style={styles.notificationStatusInfo}>
                <Text style={[
                  styles.notificationStatusTitle,
                  { color: isNotificationEnabled ? theme.success : theme.textSecondary }
                ]}>
                  {isNotificationEnabled ? 'Rappels programmés' : 'Rappels désactivés'}
                </Text>
                <Text style={styles.notificationStatusDesc}>
                  {isNotificationEnabled 
                    ? 'Vous recevrez des notifications push'
                    : 'Activez pour recevoir des rappels'
                  }
                </Text>
              </View>
            </View>

            {/* Reminder Options */}
            <View style={styles.notificationSection}>
              <Text style={styles.notificationSectionTitle}>RAPPELS À PROGRAMMER</Text>
              <Text style={styles.notificationSectionSubtitle}>
                Choisissez quand recevoir une notification
              </Text>

              {/* 1 Week Before */}
              <View style={[
                styles.notificationOption,
                daysUntilTournament < 7 && styles.notificationOptionDisabled
              ]}>
                <View style={[styles.notificationOptionIcon, { backgroundColor: theme.primary + '15' }]}>
                  <MaterialIcons name="date-range" size={22} color={theme.primary} />
                </View>
                <View style={styles.notificationOptionInfo}>
                  <Text style={styles.notificationOptionTitle}>1 semaine avant</Text>
                  <Text style={styles.notificationOptionDesc}>
                    {daysUntilTournament >= 7 
                      ? `Le ${new Date(tournamentDate.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à 9h00`
                      : 'Délai dépassé'
                    }
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.oneWeek && daysUntilTournament >= 7}
                  onValueChange={(val) => setNotificationSettings(prev => ({ ...prev, oneWeek: val }))}
                  trackColor={{ false: theme.border, true: theme.primary + '50' }}
                  thumbColor={notificationSettings.oneWeek && daysUntilTournament >= 7 ? theme.primary : theme.surface}
                  disabled={daysUntilTournament < 7}
                />
              </View>

              {/* 3 Days Before */}
              <View style={[
                styles.notificationOption,
                daysUntilTournament < 3 && styles.notificationOptionDisabled
              ]}>
                <View style={[styles.notificationOptionIcon, { backgroundColor: theme.accent + '15' }]}>
                  <MaterialIcons name="event-note" size={22} color={theme.accent} />
                </View>
                <View style={styles.notificationOptionInfo}>
                  <Text style={styles.notificationOptionTitle}>3 jours avant</Text>
                  <Text style={styles.notificationOptionDesc}>
                    {daysUntilTournament >= 3 
                      ? `Le ${new Date(tournamentDate.getTime() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à 9h00`
                      : 'Délai dépassé'
                    }
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.threeDays && daysUntilTournament >= 3}
                  onValueChange={(val) => setNotificationSettings(prev => ({ ...prev, threeDays: val }))}
                  trackColor={{ false: theme.border, true: theme.accent + '50' }}
                  thumbColor={notificationSettings.threeDays && daysUntilTournament >= 3 ? theme.accent : theme.surface}
                  disabled={daysUntilTournament < 3}
                />
              </View>

              {/* 1 Day Before */}
              <View style={[
                styles.notificationOption,
                daysUntilTournament < 1 && styles.notificationOptionDisabled
              ]}>
                <View style={[styles.notificationOptionIcon, { backgroundColor: theme.warning + '15' }]}>
                  <MaterialIcons name="today" size={22} color={theme.warning} />
                </View>
                <View style={styles.notificationOptionInfo}>
                  <Text style={styles.notificationOptionTitle}>La veille</Text>
                  <Text style={styles.notificationOptionDesc}>
                    {daysUntilTournament >= 1 
                      ? `Le ${new Date(tournamentDate.getTime() - 1 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à 18h00`
                      : 'Délai dépassé'
                    }
                  </Text>
                </View>
                <Switch
                  value={notificationSettings.oneDayBefore && daysUntilTournament >= 1}
                  onValueChange={(val) => setNotificationSettings(prev => ({ ...prev, oneDayBefore: val }))}
                  trackColor={{ false: theme.border, true: theme.warning + '50' }}
                  thumbColor={notificationSettings.oneDayBefore && daysUntilTournament >= 1 ? theme.warning : theme.surface}
                  disabled={daysUntilTournament < 1}
                />
              </View>
            </View>

            {/* Test notification */}
            {permissionStatus === 'granted' && (
              <Pressable style={styles.testNotificationBtn} onPress={handleTestNotification}>
                <MaterialIcons name="send" size={18} color={theme.primary} />
                <Text style={styles.testNotificationBtnText}>Envoyer une notification test</Text>
              </Pressable>
            )}

            {/* Info */}
            <View style={styles.notificationInfoCard}>
              <MaterialIcons name="info-outline" size={20} color={theme.textMuted} />
              <Text style={styles.notificationInfoText}>
                Les rappels seront envoyés sous forme de notifications push locales. Ils fonctionnent même sans connexion internet.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* End Tournament Modal - Multi-Step */}
      <Modal
        visible={endTournamentStep > 0}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseEndTournament}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalClose} onPress={endTournamentStep > 1 ? () => setEndTournamentStep(endTournamentStep - 1) : handleCloseEndTournament}>
              <MaterialIcons name={endTournamentStep > 1 ? 'arrow-back' : 'close'} size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {endTournamentStep === 1 ? 'Classement final' : endTournamentStep === 2 ? 'Détails' : 'Confirmation'}
            </Text>
            <View style={styles.endStepIndicator}>
              <Text style={styles.endStepText}>{endTournamentStep}/3</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.endProgressBar}>
            <View style={[styles.endProgressFill, { width: `${(endTournamentStep / 3) * 100}%` }]} />
          </View>

          <ScrollView 
            style={styles.modalContent}
            contentContainerStyle={styles.modalScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Tournament header in all steps */}
            <View style={styles.quickTournamentInfo}>
              <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />
              <Text style={styles.quickTournamentName}>{tournament.name}</Text>
            </View>

            {/* STEP 1: Result Selection with Podium */}
            {endTournamentStep === 1 && (
              <Animated.View entering={FadeInDown.duration(300)}>
                <Text style={styles.endTournamentQuestion}>Quel est votre classement final ?</Text>

                {/* Visual Podium - Top 3 */}
                <View style={styles.podiumContainer}>
                  {/* 2nd place */}
                  <Pressable style={styles.podiumSpot} onPress={() => handleSelectResult('2ème')}>
                    <View style={[styles.podiumIcon, { backgroundColor: '#C0C0C0' + '25' }]}>
                      <MaterialIcons name="workspace-premium" size={28} color="#C0C0C0" />
                    </View>
                    <View style={[styles.podiumBlock, styles.podiumBlock2nd]}>
                      <Text style={[styles.podiumLabel, { color: '#C0C0C0' }]}>2ème</Text>
                    </View>
                  </Pressable>
                  {/* 1st place */}
                  <Pressable style={styles.podiumSpot} onPress={() => handleSelectResult('1er')}>
                    <View style={[styles.podiumIcon, { backgroundColor: '#FFD700' + '25' }]}>
                      <MaterialIcons name="emoji-events" size={36} color="#FFD700" />
                    </View>
                    <View style={[styles.podiumBlock, styles.podiumBlock1st]}>
                      <Text style={[styles.podiumLabel, { color: '#FFD700' }]}>1er</Text>
                    </View>
                  </Pressable>
                  {/* 3rd place */}
                  <Pressable style={styles.podiumSpot} onPress={() => handleSelectResult('3ème')}>
                    <View style={[styles.podiumIcon, { backgroundColor: '#CD7F32' + '25' }]}>
                      <MaterialIcons name="military-tech" size={28} color="#CD7F32" />
                    </View>
                    <View style={[styles.podiumBlock, styles.podiumBlock3rd]}>
                      <Text style={[styles.podiumLabel, { color: '#CD7F32' }]}>3ème</Text>
                    </View>
                  </Pressable>
                </View>

                {/* Other results */}
                <Text style={styles.endOtherResultsTitle}>Autre classement</Text>
                <View style={styles.endOtherResults}>
                  {[
                    { id: 'Demi-finale', label: 'Demi-finale', icon: 'trending-up', color: '#4A90D9' },
                    { id: 'Quart de finale', label: 'Quart de finale', icon: 'trending-flat', color: '#F5A623' },
                    { id: '1/8 finale', label: '1/8 de finale', icon: 'sports', color: '#7B8794' },
                    { id: 'Poules', label: 'Éliminé en poules', icon: 'group', color: '#7B8794' },
                    { id: 'Autre', label: 'Autre', icon: 'more-horiz', color: theme.textMuted },
                  ].map(item => (
                    <Pressable
                      key={item.id}
                      style={styles.endOtherResultItem}
                      onPress={() => handleSelectResult(item.id)}
                    >
                      <View style={[styles.endOtherResultIcon, { backgroundColor: item.color + '15' }]}>
                        <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                      </View>
                      <Text style={styles.endOtherResultLabel}>{item.label}</Text>
                      <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* STEP 2: Prize & Details */}
            {endTournamentStep === 2 && selectedFinalResult && (
              <Animated.View entering={FadeInDown.duration(300)}>
                {/* Selected result badge */}
                {(() => {
                  const cfg = {
                    '1er': { icon: 'emoji-events', color: '#FFD700', label: 'Champion' },
                    '2ème': { icon: 'workspace-premium', color: '#C0C0C0', label: 'Finaliste' },
                    '3ème': { icon: 'military-tech', color: '#CD7F32', label: '3ème place' },
                  }[selectedFinalResult] || { icon: 'sports', color: theme.textSecondary, label: selectedFinalResult };
                  const isPodium = ['1er', '2ème', '3ème'].includes(selectedFinalResult);
                  return (
                    <View style={[styles.endSelectedResultBadge, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '40' }]}>
                      <MaterialIcons name={cfg.icon as any} size={32} color={cfg.color} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.endSelectedResultLabel, { color: cfg.color }]}>{cfg.label}</Text>
                        {isPodium && <Text style={styles.endSelectedResultSub}>Classement final</Text>}
                      </View>
                      <Pressable style={styles.endChangeBtn} onPress={() => setEndTournamentStep(1)}>
                        <Text style={styles.endChangeBtnText}>Modifier</Text>
                      </Pressable>
                    </View>
                  );
                })()}

                {/* Prize input */}
                <View style={styles.endDetailSection}>
                  <Text style={styles.endDetailSectionTitle}>Gains du tournoi (optionnel)</Text>
                  <View style={styles.endPrizeInputRow}>
                    <MaterialIcons name="emoji-events" size={22} color={theme.success} />
                    <TextInput
                      style={styles.endPrizeInput}
                      value={prizeWonInput}
                      onChangeText={setPrizeWonInput}
                      placeholder="0"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.endPrizeUnit}>€</Text>
                  </View>
                  {tournament.registrationCost ? (
                    <View style={styles.endCostInfo}>
                      <MaterialIcons name="info-outline" size={14} color={theme.textMuted} />
                      <Text style={styles.endCostInfoText}>
                        Inscription : {tournament.registrationCost}€ — 
                        Net : {((parseFloat(prizeWonInput) || 0) - tournament.registrationCost) >= 0 ? '+' : ''}
                        {((parseFloat(prizeWonInput) || 0) - tournament.registrationCost).toFixed(0)}€
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Stats summary */}
                <View style={styles.endDetailSection}>
                  <Text style={styles.endDetailSectionTitle}>Résumé du parcours</Text>
                  <View style={styles.endTournamentStats}>
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
                      {myStats.tirRate !== null ? (
                        <View style={styles.endTournamentStatItem}>
                          <Text style={[styles.endTournamentStatValue, { color: theme.tirColor }]}>{myStats.tirRate}%</Text>
                          <Text style={styles.endTournamentStatLabel}>Tir</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Continue button */}
                <Pressable style={styles.endContinueBtn} onPress={handleGoToSummary}>
                  <Text style={styles.endContinueBtnText}>Continuer</Text>
                  <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
                </Pressable>
              </Animated.View>
            )}

            {/* STEP 3: Confirmation Summary */}
            {endTournamentStep === 3 && selectedFinalResult && (
              <Animated.View entering={FadeInDown.duration(300)}>
                {(() => {
                  const isPodium = ['1er', '2ème', '3ème'].includes(selectedFinalResult);
                  const resultCfg: Record<string, { icon: string; color: string }> = {
                    '1er': { icon: 'emoji-events', color: '#FFD700' },
                    '2ème': { icon: 'workspace-premium', color: '#C0C0C0' },
                    '3ème': { icon: 'military-tech', color: '#CD7F32' },
                  };
                  const cfg = resultCfg[selectedFinalResult] || { icon: 'sports', color: theme.textSecondary };
                  const prize = parseFloat(prizeWonInput) || 0;

                  return (
                    <>
                      {/* Celebration for podium */}
                      {isPodium && (
                        <Animated.View entering={FadeIn.duration(500)} style={styles.endCelebration}>
                          <View style={[styles.endCelebrationIcon, { backgroundColor: cfg.color + '20' }]}>
                            <MaterialIcons name={cfg.icon as any} size={56} color={cfg.color} />
                          </View>
                          <Text style={[styles.endCelebrationTitle, { color: cfg.color }]}>
                            {selectedFinalResult === '1er' ? 'Champion !' : selectedFinalResult === '2ème' ? 'Finaliste !' : 'Podium !'}
                          </Text>
                          <Text style={styles.endCelebrationSub}>{tournament.name}</Text>
                        </Animated.View>
                      )}

                      {!isPodium && (
                        <View style={styles.endSummaryHeader}>
                          <View style={[styles.endSummaryIcon, { backgroundColor: cfg.color + '20' }]}>
                            <MaterialIcons name={cfg.icon as any} size={36} color={cfg.color} />
                          </View>
                          <Text style={styles.endSummaryResult}>{selectedFinalResult}</Text>
                          <Text style={styles.endSummaryTournament}>{tournament.name}</Text>
                        </View>
                      )}

                      {/* Summary card */}
                      <View style={styles.endSummaryCard}>
                        <View style={styles.endSummaryRow}>
                          <MaterialIcons name="emoji-events" size={18} color={theme.textSecondary} />
                          <Text style={styles.endSummaryRowLabel}>Classement</Text>
                          <Text style={[styles.endSummaryRowValue, { color: cfg.color }]}>{selectedFinalResult}</Text>
                        </View>
                        <View style={styles.endSummaryDivider} />
                        <View style={styles.endSummaryRow}>
                          <MaterialIcons name="sports" size={18} color={theme.textSecondary} />
                          <Text style={styles.endSummaryRowLabel}>Matchs joués</Text>
                          <Text style={styles.endSummaryRowValue}>{myStats.played} ({myStats.wins}V-{myStats.losses}D)</Text>
                        </View>
                        <View style={styles.endSummaryDivider} />
                        <View style={styles.endSummaryRow}>
                          <MaterialIcons name="show-chart" size={18} color={theme.textSecondary} />
                          <Text style={styles.endSummaryRowLabel}>Diff. points</Text>
                          <Text style={[styles.endSummaryRowValue, { color: myStats.pointDiff >= 0 ? theme.success : theme.error }]}>
                            {myStats.pointDiff > 0 ? '+' : ''}{myStats.pointDiff}
                          </Text>
                        </View>
                        {prize > 0 && (
                          <>
                            <View style={styles.endSummaryDivider} />
                            <View style={styles.endSummaryRow}>
                              <MaterialIcons name="payments" size={18} color={theme.success} />
                              <Text style={styles.endSummaryRowLabel}>Gains</Text>
                              <Text style={[styles.endSummaryRowValue, { color: theme.success }]}>+{prize}€</Text>
                            </View>
                          </>
                        )}
                        {tournament.registrationCost ? (
                          <>
                            <View style={styles.endSummaryDivider} />
                            <View style={styles.endSummaryRow}>
                              <MaterialIcons name="receipt" size={18} color={theme.textMuted} />
                              <Text style={styles.endSummaryRowLabel}>Inscription</Text>
                              <Text style={[styles.endSummaryRowValue, { color: theme.error }]}>-{tournament.registrationCost}€</Text>
                            </View>
                          </>
                        ) : null}
                      </View>

                      {/* Status change notice */}
                      <View style={styles.endNotice}>
                        <MaterialIcons name="info" size={18} color={theme.primary} />
                        <Text style={styles.endNoticeText}>
                          Le tournoi sera marqué comme « Terminé » et apparaîtra dans votre palmarès.
                        </Text>
                      </View>

                      {/* Confirm button */}
                      <Pressable
                        style={[styles.endConfirmBtn, isSavingEnd && { opacity: 0.7 }]}
                        onPress={handleConfirmEndTournament}
                        disabled={isSavingEnd}
                      >
                        {isSavingEnd ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <MaterialIcons name="check" size={22} color="#FFF" />
                            <Text style={styles.endConfirmBtnText}>Terminer le tournoi</Text>
                          </>
                        )}
                      </Pressable>
                    </>
                  );
                })()}
              </Animated.View>
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
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  notificationButtonActive: {
    backgroundColor: theme.warning + '20',
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
  classificationBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  classificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  classificationBadgeText: {
    fontSize: 11,
    fontWeight: '600',
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
  finalResultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  finalResultBannerText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.textMuted,
    marginHorizontal: 6,
  },
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
  endTournamentQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  endStepIndicator: {
    width: 40,
    alignItems: 'center',
  },
  endStepText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  endProgressBar: {
    height: 3,
    backgroundColor: theme.border,
  },
  endProgressFill: {
    height: '100%',
    backgroundColor: theme.primary,
  },
  // Podium
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  podiumSpot: {
    alignItems: 'center',
    flex: 1,
  },
  podiumIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  podiumBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: theme.border,
  },
  podiumBlock1st: {
    height: 64,
    borderColor: '#FFD700' + '60',
    backgroundColor: '#FFD700' + '10',
  },
  podiumBlock2nd: {
    height: 48,
    borderColor: '#C0C0C0' + '60',
    backgroundColor: '#C0C0C0' + '10',
  },
  podiumBlock3rd: {
    height: 36,
    borderColor: '#CD7F32' + '60',
    backgroundColor: '#CD7F32' + '10',
  },
  podiumLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Other results
  endOtherResultsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingLeft: 4,
  },
  endOtherResults: {
    gap: 8,
  },
  endOtherResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 14,
    borderRadius: theme.borderRadius.md,
    gap: 12,
    ...theme.shadows.card,
  },
  endOtherResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOtherResultLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  // Step 2: Details
  endSelectedResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  endSelectedResultLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  endSelectedResultSub: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  endChangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.backgroundSecondary,
  },
  endChangeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
  endDetailSection: {
    marginBottom: 20,
  },
  endDetailSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 10,
  },
  endPrizeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  endPrizeInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    padding: 0,
  },
  endPrizeUnit: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  endCostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  endCostInfoText: {
    fontSize: 12,
    color: theme.textMuted,
  },
  endTournamentStats: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
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
  endContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    marginTop: 8,
  },
  endContinueBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  // Step 3: Summary & Confirmation
  endCelebration: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  endCelebrationIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  endCelebrationTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  endCelebrationSub: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  endSummaryHeader: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 16,
  },
  endSummaryIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  endSummaryResult: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  endSummaryTournament: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  endSummaryCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  endSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  endSummaryRowLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.textSecondary,
  },
  endSummaryRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  endSummaryDivider: {
    height: 1,
    backgroundColor: theme.border,
  },
  endNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.primary + '10',
    padding: 14,
    borderRadius: theme.borderRadius.md,
    marginBottom: 20,
  },
  endNoticeText: {
    flex: 1,
    fontSize: 12,
    color: theme.primary,
    lineHeight: 18,
  },
  endConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.success,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
  },
  endConfirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  notificationModalScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  notificationTournamentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  notificationTournamentIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: theme.carreauColor + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  notificationTournamentDetails: {
    flex: 1,
  },
  notificationTournamentName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  notificationTournamentDate: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  daysCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  daysCountdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.warning + '15',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.warning + '30',
  },
  permissionBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.warning + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBannerContent: {
    flex: 1,
  },
  permissionBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  permissionBannerDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  permissionBannerBtn: {
    backgroundColor: theme.warning,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  permissionBannerBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  notificationStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 20,
    gap: 14,
  },
  notificationStatusEnabled: {
    backgroundColor: theme.success + '15',
    borderWidth: 1,
    borderColor: theme.success + '30',
  },
  notificationStatusDisabled: {
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  notificationStatusInfo: {
    flex: 1,
  },
  notificationStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  notificationStatusDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  notificationSection: {
    marginBottom: 20,
  },
  notificationSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  notificationSectionSubtitle: {
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 16,
  },
  notificationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 10,
    ...theme.shadows.card,
  },
  notificationOptionDisabled: {
    opacity: 0.5,
  },
  notificationOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  notificationOptionInfo: {
    flex: 1,
  },
  notificationOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  notificationOptionDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  testNotificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary + '15',
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 16,
  },
  testNotificationBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  notificationInfoCard: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    gap: 12,
  },
  notificationInfoText: {
    flex: 1,
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 18,
  },
});
