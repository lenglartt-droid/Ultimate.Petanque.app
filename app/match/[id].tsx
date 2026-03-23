import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import theme from '@/constants/theme';
import config, { GameFormat, PlayerRole } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { PlayerAction, DetailedShotRecord } from '@/services/mockData';
import { SimplifiedShotNotation, SimpleShotRecord } from '@/components/ui/SimplifiedShotNotation';
import ShareModal from '@/components/ui/ShareModal';
import SharedBadge from '@/components/ui/SharedBadge';
import { getShareRequestsForItem, MatchShareRequest } from '@/services/matchShareService';
import { useAuth } from '@/template';

interface MeneEdit {
  teamAPoints: number;
  teamBPoints: number;
  duration: number;
}

export default function EditMatchScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMatchById, updateMatch, deleteMatch, players, matches, terrains, tournaments, boulesSets, loading: appLoading, isSharedItem, getSharedPermission } = useApp();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const match = getMatchById(id!);

  // Get all matches in the same series
  const seriesMatches = useMemo(() => {
    if (!match?.seriesInfo?.seriesId) return [];
    return matches
      .filter(m => m.seriesInfo?.seriesId === match.seriesInfo?.seriesId)
      .sort((a, b) => (a.seriesInfo?.matchNumber || 1) - (b.seriesInfo?.matchNumber || 1));
  }, [match, matches]);

  const seriesStats = useMemo(() => {
    if (seriesMatches.length === 0) return null;
    let winsA = 0, winsB = 0;
    seriesMatches.forEach(m => { if (m.winner === 'A') winsA++; else if (m.winner === 'B') winsB++; });
    const isComplete = winsA >= 2 || winsB >= 2;
    return { totalMatches: seriesMatches.length, winsA, winsB, isComplete, seriesWinner: isComplete ? (winsA >= 2 ? 'A' : 'B') : null };
  }, [seriesMatches]);

  const [mode, setMode] = useState<'Entraînement' | 'Tournoi'>('Entraînement');
  const [format, setFormat] = useState<GameFormat>('Doublette');
  const [teamAScore, setTeamAScore] = useState(0);
  const [teamBScore, setTeamBScore] = useState(0);
  const [teamAPlayers, setTeamAPlayers] = useState<{id: string, name: string}[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<{id: string, name: string}[]>([]);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [pickingForTeam, setPickingForTeam] = useState<'A' | 'B'>('A');
  const [playerSearch, setPlayerSearch] = useState('');
  const [matchDate, setMatchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState(0);
  const [menes, setMenes] = useState<MeneEdit[]>([]);
  const [location, setLocation] = useState('');
  const [showSeriesPanel, setShowSeriesPanel] = useState(true);

  // Terrain & Tournament selection
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [showTerrainPicker, setShowTerrainPicker] = useState(false);
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const [terrainSearch, setTerrainSearch] = useState('');
  const [tournamentSearch, setTournamentSearch] = useState('');

  // Player actions editor
  const [playerActions, setPlayerActions] = useState<PlayerAction[]>([]);
  const [showShotNotation, setShowShotNotation] = useState(false);
  const [editingActionPlayer, setEditingActionPlayer] = useState<{ id: string; name: string; team: 'A' | 'B' } | null>(null);
  const [editingActionType, setEditingActionType] = useState<'tir' | 'point'>('tir');
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [editingShotRecord, setEditingShotRecord] = useState<any>(null);
  const [expandedPlayerShots, setExpandedPlayerShots] = useState<Set<string>>(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareRequests, setShareRequests] = useState<MatchShareRequest[]>([]);
  const matchIsShared = match ? isSharedItem(match.id) : false;
  const matchPermission = match ? getSharedPermission(match.id) : null;

  const maxScore = config.game.maxScore;
  const locale = language === 'en' ? 'en-US' : 'fr-FR';

  const ROLE_CONFIG: Record<PlayerRole, { icon: string; color: string; labelKey: string }> = {
    'Pointeur': { icon: 'radio-button-on', color: '#3B82F6', labelKey: 'pointeur' },
    'Milieu': { icon: 'swap-horiz', color: '#8B5CF6', labelKey: 'milieu' },
    'Tireur': { icon: 'gps-fixed', color: '#F97316', labelKey: 'tireur' },
  };

  // Load share request info for this match
  useEffect(() => {
    if (!id) return;
    getShareRequestsForItem('match', id).then(({ requests }) => {
      setShareRequests(requests);
    });
  }, [id]);

  useEffect(() => {
    if (match) {
      setMode(match.mode);
      setFormat(match.format);
      setTeamAScore(match.teamA.score);
      setTeamBScore(match.teamB.score);
      setTeamAPlayers(match.teamA.players.map((pid, idx) => ({ id: pid, name: match.teamA.playerNames[idx] || pid })));
      setTeamBPlayers(match.teamB.players.map((pid, idx) => ({ id: pid, name: match.teamB.playerNames[idx] || pid })));
      setMatchDate(new Date(match.date));
      setDuration(match.duration);
      setMenes(match.menes?.map(m => ({ teamAPoints: m.teamAPoints || 0, teamBPoints: m.teamBPoints || 0, duration: m.duration || 0 })) || []);
      setLocation(match.tournamentName || '');
      setSelectedTerrainId(match.terrainId || null);
      setSelectedTournamentId(match.tournamentId || null);
      setPlayerActions(match.playerActions ? JSON.parse(JSON.stringify(match.playerActions)) : []);
    }
  }, [match]);

  const selectedTerrain = useMemo(() => selectedTerrainId ? terrains.find(t => t.id === selectedTerrainId) : null, [selectedTerrainId, terrains]);
  const matchBoulesSet = useMemo(() => match?.boulesSetId ? boulesSets.find(bs => bs.id === match.boulesSetId) : null, [match?.boulesSetId, boulesSets]);
  const selectedTournament = useMemo(() => selectedTournamentId ? tournaments.find(t => t.id === selectedTournamentId) : null, [selectedTournamentId, tournaments]);

  // Sort terrains by match frequency (most played first)
  const sortedTerrains = useMemo(() => {
    const terrainMatchCount: Record<string, number> = {};
    matches.forEach(m => {
      if (m.terrainId) {
        terrainMatchCount[m.terrainId] = (terrainMatchCount[m.terrainId] || 0) + 1;
      }
    });
    const s = terrainSearch.toLowerCase();
    return [...terrains]
      .filter(t => !s || t.name.toLowerCase().includes(s) || t.city.toLowerCase().includes(s) || (t.type && t.type.toLowerCase().includes(s)))
      .map(t => ({ ...t, _matchCount: terrainMatchCount[t.id] || 0 }))
      .sort((a, b) => b._matchCount - a._matchCount);
  }, [terrains, matches, terrainSearch]);

  const filteredTournaments = useMemo(() => {
    const search = tournamentSearch.toLowerCase();
    return tournaments.filter(t => !search || t.name.toLowerCase().includes(search) || (t.location?.city || '').toLowerCase().includes(search));
  }, [tournaments, tournamentSearch]);

  // Build a list of team A and team B players for actions editing
  const teamAPlayersList = useMemo(() => {
    return teamAPlayers.map(p => ({ id: p.id, name: p.name, team: 'A' as const }));
  }, [teamAPlayers]);

  const teamBPlayersList = useMemo(() => {
    return teamBPlayers.map(p => ({ id: p.id, name: p.name, team: 'B' as const }));
  }, [teamBPlayers]);

  const maxPlayersPerTeam = useMemo(() => {
    if (format === 'Tête-à-tête') return 1;
    if (format === 'Doublette') return 2;
    return 3;
  }, [format]);

  const filteredPickerPlayers = useMemo(() => {
    const search = playerSearch.toLowerCase();
    const selectedIds = new Set([...teamAPlayers.map(p => p.id), ...teamBPlayers.map(p => p.id)]);
    return players.filter(p => {
      if (selectedIds.has(p.id)) return false;
      if (search && !p.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [players, teamAPlayers, teamBPlayers, playerSearch]);

  const handleAddPlayer = useCallback((playerId: string, playerName: string) => {
    Haptics.selectionAsync();
    if (pickingForTeam === 'A') {
      if (teamAPlayers.length >= maxPlayersPerTeam) return;
      setTeamAPlayers(prev => [...prev, { id: playerId, name: playerName }]);
    } else {
      if (teamBPlayers.length >= maxPlayersPerTeam) return;
      setTeamBPlayers(prev => [...prev, { id: playerId, name: playerName }]);
    }
  }, [pickingForTeam, teamAPlayers, teamBPlayers, maxPlayersPerTeam]);

  const handleRemovePlayer = useCallback((team: 'A' | 'B', playerId: string) => {
    Haptics.selectionAsync();
    if (team === 'A') {
      setTeamAPlayers(prev => prev.filter(p => p.id !== playerId));
      setPlayerActions(prev => prev.filter(pa => pa.playerId !== playerId));
    } else {
      setTeamBPlayers(prev => prev.filter(p => p.id !== playerId));
      setPlayerActions(prev => prev.filter(pa => pa.playerId !== playerId));
    }
  }, []);

  const getPlayerAction = useCallback((playerId: string): PlayerAction | undefined => {
    return playerActions.find(pa => pa.playerId === playerId);
  }, [playerActions]);

  const updatePlayerActionCount = useCallback((playerId: string, playerName: string, team: 'A' | 'B', field: keyof PlayerAction['actions'], delta: number) => {
    setPlayerActions(prev => {
      const existing = prev.find(pa => pa.playerId === playerId);
      if (existing) {
        return prev.map(pa => {
          if (pa.playerId !== playerId) return pa;
          const newVal = Math.max(0, pa.actions[field] + delta);
          // Ensure success counts don't exceed totals
          let newActions = { ...pa.actions, [field]: newVal };
          if (field === 'tirsSuccess' && newActions.tirsSuccess > newActions.tirs) newActions.tirs = newActions.tirsSuccess;
          if (field === 'pointsSuccess' && newActions.pointsSuccess > newActions.points) newActions.points = newActions.pointsSuccess;
          if (field === 'tirs' && newActions.tirs < newActions.tirsSuccess) newActions.tirsSuccess = newActions.tirs;
          if (field === 'points' && newActions.points < newActions.pointsSuccess) newActions.points = newActions.pointsSuccess;
          if (field === 'carreaux' && newActions.carreaux > newActions.tirsSuccess) newActions.carreaux = newActions.tirsSuccess;
          return { ...pa, actions: newActions };
        });
      } else {
        const newActions = { tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0, [field]: Math.max(0, delta) };
        return [...prev, { playerId, playerName, team, actions: newActions }];
      }
    });
  }, []);

  const openDetailedNotation = useCallback((playerId: string, playerName: string, team: 'A' | 'B', actionType: 'tir' | 'point') => {
    setEditingActionPlayer({ id: playerId, name: playerName, team });
    setEditingActionType(actionType);
    setShowShotNotation(true);
  }, []);

  const handleShotSubmit = useCallback((record: SimpleShotRecord) => {
    if (!editingActionPlayer) return;
    const { id: playerId, name: playerName, team } = editingActionPlayer;

    const detailedShot: DetailedShotRecord = {
      id: record.id,
      timestamp: record.timestamp,
      playerId: record.playerId,
      playerName: record.playerName,
      team: record.team,
      actionType: record.actionType,
      success: record.success,
      carreau: record.carreau,
      shotType: record.shotType as any,
      shotResult: record.shotResult as any,
      shotQuality: record.shotQuality as any,
      pointType: record.pointType as any,
      pointQuality: record.pointQuality as any,
    };

    if (editingShotId) {
      // EDIT MODE: replace existing shot and adjust counters
      setPlayerActions(prev => prev.map(pa => {
        if (pa.playerId !== playerId || !pa.detailedShots) return pa;
        const oldShot = pa.detailedShots.find(s => s.id === editingShotId);
        if (!oldShot) return pa;

        const newActions = { ...pa.actions };
        // Subtract old shot
        if (oldShot.actionType === 'tir') {
          newActions.tirs = Math.max(0, newActions.tirs - 1);
          if (oldShot.success) newActions.tirsSuccess = Math.max(0, newActions.tirsSuccess - 1);
          if (oldShot.carreau) newActions.carreaux = Math.max(0, newActions.carreaux - 1);
        } else {
          newActions.points = Math.max(0, newActions.points - 1);
          if (oldShot.success) newActions.pointsSuccess = Math.max(0, newActions.pointsSuccess - 1);
        }
        // Add new shot
        if (record.actionType === 'tir') {
          newActions.tirs++;
          if (record.success) newActions.tirsSuccess++;
          if (record.carreau) newActions.carreaux++;
        } else {
          newActions.points++;
          if (record.success) newActions.pointsSuccess++;
        }

        return {
          ...pa,
          actions: newActions,
          detailedShots: pa.detailedShots.map(s => s.id === editingShotId ? detailedShot : s),
        };
      }));
      setEditingShotId(null);
      setEditingShotRecord(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // ADD MODE
      setPlayerActions(prev => {
        const existing = prev.find(pa => pa.playerId === playerId);
        if (existing) {
          return prev.map(pa => {
            if (pa.playerId !== playerId) return pa;
            const newActions = { ...pa.actions };
            if (record.actionType === 'tir') {
              newActions.tirs++;
              if (record.success) newActions.tirsSuccess++;
              if (record.carreau) newActions.carreaux++;
            } else {
              newActions.points++;
              if (record.success) newActions.pointsSuccess++;
            }
            return {
              ...pa,
              actions: newActions,
              detailedShots: [...(pa.detailedShots || []), detailedShot],
            };
          });
        } else {
          const newActions = { tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 };
          if (record.actionType === 'tir') {
            newActions.tirs = 1;
            if (record.success) newActions.tirsSuccess = 1;
            if (record.carreau) newActions.carreaux = 1;
          } else {
            newActions.points = 1;
            if (record.success) newActions.pointsSuccess = 1;
          }
          return [...prev, { playerId, playerName, team, actions: newActions, detailedShots: [detailedShot] }];
        }
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [editingActionPlayer, editingShotId]);

  const deleteDetailedShot = useCallback((playerId: string, shotId: string) => {
    setPlayerActions(prev => prev.map(pa => {
      if (pa.playerId !== playerId || !pa.detailedShots) return pa;
      const shot = pa.detailedShots.find(s => s.id === shotId);
      if (!shot) return pa;
      const newActions = { ...pa.actions };
      if (shot.actionType === 'tir') {
        newActions.tirs = Math.max(0, newActions.tirs - 1);
        if (shot.success) newActions.tirsSuccess = Math.max(0, newActions.tirsSuccess - 1);
        if (shot.carreau) newActions.carreaux = Math.max(0, newActions.carreaux - 1);
      } else {
        newActions.points = Math.max(0, newActions.points - 1);
        if (shot.success) newActions.pointsSuccess = Math.max(0, newActions.pointsSuccess - 1);
      }
      return { ...pa, actions: newActions, detailedShots: pa.detailedShots.filter(s => s.id !== shotId) };
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const togglePlayerShots = useCallback((playerId: string) => {
    setExpandedPlayerShots(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }, []);

  const getShotLabel = useCallback((shot: DetailedShotRecord): string => {
    const parts: string[] = [];
    if (shot.actionType === 'tir') {
      if (shot.carreau) parts.push(t('notation', 'carreauLabel'));
      else if (shot.shotType) {
        const typeMap: Record<string, string> = { au_fer: 'tirTendu', au_plomb: 'tirCloche', en_rafle: 'enRafleSimple', court_ramasse: 'courtRamasse', carreau: 'carreauLabel' };
        parts.push(t('notation', typeMap[shot.shotType] || shot.shotType));
      }
      if (!shot.success && shot.shotResult) {
        const resultMap: Record<string, string> = { court_droite: 'courtDroite', court_gauche: 'courtGauche', long: 'longResult', tir_bouchon: 'tirBouchon' };
        parts.push(t('notation', resultMap[shot.shotResult] || shot.shotResult));
      }
      if (shot.shotQuality) {
        const qualMap: Record<string, string> = { gain_point: 'gainPoint', sans_effet: 'noEffect', negatif: 'negative', decisif: 'decisive' };
        parts.push(t('notation', qualMap[shot.shotQuality] || shot.shotQuality));
      }
    } else {
      if (shot.pointType) {
        const ptMap: Record<string, string> = { roule: 'rouleSimple', plombe: 'plombeSimple', demi_portee: 'demiPorteeSimple', portee: 'portee' };
        parts.push(t('notation', ptMap[shot.pointType] || shot.pointType));
      }
      if (shot.pointQuality) {
        const pqMap: Record<string, string> = { excellent: 'excellent', bon: 'bon', moyen: 'moyen', au_bouchon: 'auBouchon', devant_boule: 'devantBoule', rate: 'rate', crochete: 'crochete', sorti: 'sorti' };
        parts.push(t('notation', pqMap[shot.pointQuality] || shot.pointQuality));
      }
    }
    return parts.join(' \u2022 ');
  }, [t]);

  const handleDeleteShot = useCallback((playerId: string, shotId: string, shotLabel: string) => {
    Alert.alert(t('matchEdit', 'deleteShot'), `${shotLabel}`, [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('common', 'delete'), style: 'destructive', onPress: () => deleteDetailedShot(playerId, shotId) },
    ]);
  }, [deleteDetailedShot, t]);

  const handleEditDetailedShot = useCallback((playerId: string, playerName: string, team: 'A' | 'B', shot: DetailedShotRecord) => {
    setEditingActionPlayer({ id: playerId, name: playerName, team });
    setEditingActionType(shot.actionType);
    setEditingShotId(shot.id);
    setEditingShotRecord({
      id: shot.id,
      timestamp: shot.timestamp,
      playerId: shot.playerId,
      playerName: shot.playerName,
      team: shot.team,
      actionType: shot.actionType,
      success: shot.success,
      carreau: shot.carreau,
      shotType: shot.shotType,
      shotResult: shot.shotResult,
      shotQuality: shot.shotQuality,
      pointType: shot.pointType,
      pointQuality: shot.pointQuality,
    });
    setShowShotNotation(true);
  }, []);

  if (!match) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('match', 'editMatch')}</Text>
          <View style={{ width: 40 }} />
        </View>
        {appLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.textSecondary }}>{t('match', 'matchNotFound')}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const handleScoreChange = (team: 'A' | 'B', delta: number) => {
    Haptics.selectionAsync();
    if (team === 'A') setTeamAScore(prev => Math.max(0, Math.min(maxScore, prev + delta)));
    else setTeamBScore(prev => Math.max(0, Math.min(maxScore, prev + delta)));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) { const d = new Date(matchDate); d.setFullYear(selectedDate.getFullYear()); d.setMonth(selectedDate.getMonth()); d.setDate(selectedDate.getDate()); setMatchDate(d); }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) { const d = new Date(matchDate); d.setHours(selectedTime.getHours()); d.setMinutes(selectedTime.getMinutes()); setMatchDate(d); }
  };

  const handleMeneEdit = (index: number, field: 'teamAPoints' | 'teamBPoints', value: number) => {
    setMenes(prev => prev.map((mene, i) => i === index ? { ...mene, [field]: Math.max(0, Math.min(6, value)) } : mene));
  };

  const handleAddMene = () => { setMenes(prev => [...prev, { teamAPoints: 0, teamBPoints: 0, duration: 0 }]); };

  const handleDeleteMene = (index: number) => {
    Alert.alert(t('common', 'delete'), t('match', 'deleteThisMene'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('common', 'delete'), style: 'destructive', onPress: () => setMenes(prev => prev.filter((_, i) => i !== index)) },
    ]);
  };

  const handleSelectTerrain = (terrainId: string) => {
    const terrain = terrains.find(t => t.id === terrainId);
    setSelectedTerrainId(terrainId);
    if (terrain) setLocation(terrain.name);
    setShowTerrainPicker(false);
    Haptics.selectionAsync();
  };

  const handleSelectTournament = (tournamentId: string) => {
    const tour = tournaments.find(t => t.id === tournamentId);
    setSelectedTournamentId(tournamentId);
    if (tour) {
      setLocation(tour.name);
      setMode('Tournoi');
    }
    setShowTournamentPicker(false);
    Haptics.selectionAsync();
  };

  const handleSave = () => {
    let finalTeamAScore = teamAScore;
    let finalTeamBScore = teamBScore;
    if (menes.length > 0) {
      finalTeamAScore = menes.reduce((sum, m) => sum + m.teamAPoints, 0);
      finalTeamBScore = menes.reduce((sum, m) => sum + m.teamBPoints, 0);
    }
    const winner: 'A' | 'B' = finalTeamAScore > finalTeamBScore ? 'A' : 'B';

    updateMatch(id!, {
      date: matchDate.toISOString(),
      mode,
      format,
      teamA: { ...match.teamA, players: teamAPlayers.map(p => p.id), playerNames: teamAPlayers.map(p => p.name), score: finalTeamAScore },
      teamB: { ...match.teamB, players: teamBPlayers.map(p => p.id), playerNames: teamBPlayers.map(p => p.name), score: finalTeamBScore },
      winner,
      duration,
      menes: menes.map((m, i) => ({ ...m, number: i + 1 })),
      tournamentName: location || undefined,
      tournamentId: selectedTournamentId || undefined,
      terrainId: selectedTerrainId || undefined,
      terrainType: selectedTerrain?.type || undefined,
      playerActions: playerActions.length > 0 ? playerActions : undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(t('match', 'deleteMatch'), t('match', 'deleteMatchConfirm'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('common', 'delete'), style: 'destructive', onPress: () => { deleteMatch(id!); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); router.back(); } },
    ]);
  };

  const renderPlayerActionEditor = (player: { id: string; name: string; team: 'A' | 'B' }) => {
    const pa = getPlayerAction(player.id);
    const actions = pa?.actions || { tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 };
    const detailedCount = pa?.detailedShots?.length || 0;

    return (
      <View key={player.id} style={styles.playerActionCard}>
        <View style={styles.playerActionHeader}>
          <View style={[styles.playerActionDot, { backgroundColor: player.team === 'A' ? theme.primary : theme.accent }]} />
          <Text style={styles.playerActionName} numberOfLines={1}>{player.name}</Text>
          {detailedCount > 0 && (
            <View style={styles.detailedBadge}>
              <MaterialIcons name="playlist-add-check" size={12} color={theme.success} />
              <Text style={styles.detailedBadgeText}>{detailedCount}</Text>
            </View>
          )}
        </View>

        {/* Tir counters */}
        <View style={styles.actionRow}>
          <View style={styles.actionLabelGroup}>
            <MaterialIcons name="gps-fixed" size={16} color={theme.tirColor} />
            <Text style={styles.actionLabel}>{t('match', 'shot')}</Text>
          </View>
          <View style={styles.actionCounters}>
            <View style={styles.counterGroup}>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'tirs', -1)}>
                <MaterialIcons name="remove" size={14} color={theme.textMuted} />
              </Pressable>
              <Text style={styles.counterValue}>{actions.tirs}</Text>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'tirs', 1)}>
                <MaterialIcons name="add" size={14} color={theme.primary} />
              </Pressable>
            </View>
            <View style={styles.counterSep}><Text style={styles.counterSepText}>/</Text></View>
            <View style={styles.counterGroup}>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'tirsSuccess', -1)}>
                <MaterialIcons name="remove" size={14} color={theme.textMuted} />
              </Pressable>
              <Text style={[styles.counterValue, { color: theme.success }]}>{actions.tirsSuccess}</Text>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'tirsSuccess', 1)}>
                <MaterialIcons name="add" size={14} color={theme.success} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Point counters */}
        <View style={styles.actionRow}>
          <View style={styles.actionLabelGroup}>
            <MaterialIcons name="adjust" size={16} color={theme.pointColor} />
            <Text style={styles.actionLabel}>{t('match', 'point')}</Text>
          </View>
          <View style={styles.actionCounters}>
            <View style={styles.counterGroup}>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'points', -1)}>
                <MaterialIcons name="remove" size={14} color={theme.textMuted} />
              </Pressable>
              <Text style={styles.counterValue}>{actions.points}</Text>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'points', 1)}>
                <MaterialIcons name="add" size={14} color={theme.primary} />
              </Pressable>
            </View>
            <View style={styles.counterSep}><Text style={styles.counterSepText}>/</Text></View>
            <View style={styles.counterGroup}>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'pointsSuccess', -1)}>
                <MaterialIcons name="remove" size={14} color={theme.textMuted} />
              </Pressable>
              <Text style={[styles.counterValue, { color: theme.success }]}>{actions.pointsSuccess}</Text>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'pointsSuccess', 1)}>
                <MaterialIcons name="add" size={14} color={theme.success} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Carreau counter */}
        <View style={styles.actionRow}>
          <View style={styles.actionLabelGroup}>
            <MaterialIcons name="stars" size={16} color={theme.carreauColor} />
            <Text style={styles.actionLabel}>{t('match', 'carreau')}</Text>
          </View>
          <View style={styles.actionCounters}>
            <View style={styles.counterGroup}>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'carreaux', -1)}>
                <MaterialIcons name="remove" size={14} color={theme.textMuted} />
              </Pressable>
              <Text style={[styles.counterValue, { color: theme.carreauColor }]}>{actions.carreaux}</Text>
              <Pressable style={styles.counterBtn} onPress={() => updatePlayerActionCount(player.id, player.name, player.team, 'carreaux', 1)}>
                <MaterialIcons name="add" size={14} color={theme.carreauColor} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Detailed notation buttons */}
        <View style={styles.detailedBtnRow}>
          <Pressable style={[styles.detailedBtn, { borderColor: theme.tirColor + '40' }]} onPress={() => openDetailedNotation(player.id, player.name, player.team, 'tir')}>
            <MaterialIcons name="gps-fixed" size={14} color={theme.tirColor} />
            <Text style={[styles.detailedBtnText, { color: theme.tirColor }]}>+ {t('match', 'shot')}</Text>
          </Pressable>
          <Pressable style={[styles.detailedBtn, { borderColor: theme.pointColor + '40' }]} onPress={() => openDetailedNotation(player.id, player.name, player.team, 'point')}>
            <MaterialIcons name="adjust" size={14} color={theme.pointColor} />
            <Text style={[styles.detailedBtnText, { color: theme.pointColor }]}>+ {t('match', 'point')}</Text>
          </Pressable>
        </View>

        {/* Detailed shots list */}
        {detailedCount > 0 && (
          <View style={styles.detailedShotsSection}>
            <Pressable style={styles.detailedShotsToggle} onPress={() => togglePlayerShots(player.id)}>
              <MaterialIcons name="playlist-play" size={16} color={theme.textSecondary} />
              <Text style={styles.detailedShotsToggleText}>{t('matchEdit', 'detailedShotsList')} ({detailedCount})</Text>
              <MaterialIcons name={expandedPlayerShots.has(player.id) ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={18} color={theme.textMuted} />
            </Pressable>
            {expandedPlayerShots.has(player.id) && (
              <View style={styles.detailedShotsList}>
                {(pa?.detailedShots || []).map((shot, idx) => {
                  const isTir = shot.actionType === 'tir';
                  const shotLabel = getShotLabel(shot);
                  const timeStr = new Date(shot.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                  return (
                    <Pressable key={shot.id} style={[styles.detailedShotItem, idx === 0 && { borderTopWidth: 0 }]} onPress={() => handleEditDetailedShot(player.id, player.name, player.team, shot)}>
                      <View style={[styles.detailedShotIcon, { backgroundColor: (isTir ? theme.tirColor : theme.pointColor) + '15' }]}>
                        <MaterialIcons name={isTir ? 'gps-fixed' : 'adjust'} size={14} color={isTir ? theme.tirColor : theme.pointColor} />
                      </View>
                      <View style={styles.detailedShotContent}>
                        <View style={styles.detailedShotTopRow}>
                          <View style={[styles.detailedShotBadge, { backgroundColor: shot.success ? theme.success + '20' : theme.error + '20' }]}>
                            <MaterialIcons name={shot.success ? 'check' : 'close'} size={10} color={shot.success ? theme.success : theme.error} />
                            <Text style={[styles.detailedShotBadgeText, { color: shot.success ? theme.success : theme.error }]}>
                              {shot.success ? (shot.carreau ? t('notation', 'carreauLabel') : t('notation', 'succeeded')) : t('notation', 'missed')}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialIcons name="edit" size={12} color={theme.primary + '80'} />
                            <Text style={styles.detailedShotTime}>{timeStr}</Text>
                          </View>
                        </View>
                        {shotLabel ? <Text style={styles.detailedShotLabel} numberOfLines={2}>{shotLabel}</Text> : null}
                      </View>
                      <Pressable style={styles.detailedShotDeleteBtn} onPress={() => handleDeleteShot(player.id, shot.id, `${isTir ? t('notation', 'tirLabel') : t('notation', 'pointLabel')} - ${shot.success ? t('notation', 'succeeded') : t('notation', 'missed')}`)} hitSlop={8}>
                        <MaterialIcons name="delete-outline" size={16} color={theme.error + '80'} />
                      </Pressable>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{t('match', 'editMatch')}</Text>
          {matchIsShared ? (
            <View style={{ marginTop: 2 }}>
              <SharedBadge permission={matchPermission || 'read'} size="small" />
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }} onPress={() => setShowShareModal(true)}>
            <MaterialIcons name="share" size={22} color={theme.primary} />
          </Pressable>
          {!matchIsShared || matchPermission === 'write' ? (
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <MaterialIcons name="delete" size={24} color={theme.error} />
            </Pressable>
          ) : <View style={{ width: 40 }} />}
        </View>
      </View>

      {/* Shared match banner */}
      {matchIsShared ? (
        <View style={styles.sharedBanner}>
          <View style={styles.sharedBannerIcon}>
            <MaterialIcons name="group" size={18} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sharedBannerTitle}>
              {language === 'fr' ? 'Match partagé' : 'Shared match'}
            </Text>
            <Text style={styles.sharedBannerSub}>
              {(() => {
                const senderReq = shareRequests.find(r => r.recipientUserId === user?.id);
                if (senderReq?.senderName) {
                  return (language === 'fr' ? `Partagé par ${senderReq.senderName}` : `Shared by ${senderReq.senderName}`);
                }
                return (language === 'fr' ? 'Partagé avec vous' : 'Shared with you');
              })()}
            </Text>
          </View>
          <View style={[styles.sharedBannerPermBadge, { backgroundColor: (matchPermission === 'write' ? theme.accent : theme.primary) + '15' }]}>
            <MaterialIcons name={matchPermission === 'write' ? 'edit' : 'visibility'} size={12} color={matchPermission === 'write' ? theme.accent : theme.primary} />
            <Text style={[styles.sharedBannerPermText, { color: matchPermission === 'write' ? theme.accent : theme.primary }]}>
              {matchPermission === 'write' ? (language === 'fr' ? 'Modification' : 'Edit') : (language === 'fr' ? 'Lecture' : 'Read only')}
            </Text>
          </View>
        </View>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* Series Panel */}
          {seriesMatches.length > 1 && seriesStats && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <Pressable style={styles.seriesPanelHeader} onPress={() => setShowSeriesPanel(!showSeriesPanel)}>
                <View style={styles.seriesPanelHeaderLeft}>
                  <View style={[styles.seriesIcon, seriesStats.seriesWinner === 'A' && styles.seriesIconWin, seriesStats.seriesWinner === 'B' && styles.seriesIconLoss]}>
                    <MaterialIcons name={seriesStats.isComplete ? 'emoji-events' : 'repeat'} size={20} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.seriesPanelTitle}>{t('match', 'seriesLabel')} ({seriesMatches.length} {t('match', 'matchesCount')})</Text>
                    <Text style={styles.seriesPanelSubtitle}>
                      {seriesStats.isComplete ? (seriesStats.seriesWinner === 'A' ? t('match', 'seriesWon') : t('match', 'seriesLost')) : t('match', 'inProgressLabel')} • {seriesStats.winsA} - {seriesStats.winsB}
                    </Text>
                  </View>
                </View>
                <MaterialIcons name={showSeriesPanel ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={24} color={theme.textSecondary} />
              </Pressable>
              {showSeriesPanel && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.seriesMatchesList}>
                  {seriesMatches.map((sm, idx) => {
                    const isCurrent = sm.id === match.id;
                    const isWin = sm.winner === 'A';
                    const isFinale = sm.seriesInfo?.isFinale;
                    return (
                      <Pressable key={sm.id} style={[styles.seriesMatchCard, isCurrent && styles.seriesMatchCardCurrent, isFinale && styles.seriesMatchCardFinale]}
                        onPress={() => { if (!isCurrent) { Haptics.selectionAsync(); router.replace(`/match/${sm.id}`); } }}>
                        <View style={styles.seriesMatchCardLeft}>
                          <View style={[styles.seriesMatchIndicator, isWin ? styles.seriesMatchIndicatorWin : styles.seriesMatchIndicatorLoss, isFinale && styles.seriesMatchIndicatorFinale]}>
                            <Text style={styles.seriesMatchIndicatorText}>{isFinale ? 'F' : idx + 1}</Text>
                          </View>
                          <View>
                            <Text style={styles.seriesMatchLabel}>{isFinale ? t('match', 'finaleLabel') : `${t('match', 'matchNumber')} ${idx + 1}`}{isCurrent ? ` (${t('match', 'currentLabel')})` : ''}</Text>
                            <Text style={styles.seriesMatchDate}>{new Date(sm.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                        </View>
                        <View style={styles.seriesMatchCardRight}>
                          <Text style={[styles.seriesMatchScore, isWin && styles.seriesMatchScoreWin, !isWin && styles.seriesMatchScoreLoss]}>{sm.teamA.score} - {sm.teamB.score}</Text>
                          <View style={[styles.seriesMatchBadge, isWin ? styles.seriesMatchBadgeWin : styles.seriesMatchBadgeLoss]}>
                            <Text style={[styles.seriesMatchBadgeText, { color: isWin ? theme.success : theme.error }]}>{isWin ? 'V' : 'D'}</Text>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                  <View style={styles.seriesSummary}>
                    <View style={styles.seriesSummaryScore}>
                      <Text style={[styles.seriesSummaryValue, seriesStats.winsA > seriesStats.winsB && styles.seriesSummaryValueWin]}>{seriesStats.winsA}</Text>
                      <Text style={styles.seriesSummarySep}>{t('match', 'victoriesLabel')}</Text>
                      <Text style={[styles.seriesSummaryValue, seriesStats.winsB > seriesStats.winsA && styles.seriesSummaryValueLoss]}>{seriesStats.winsB}</Text>
                    </View>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* Date & Time */}
          <Animated.View entering={FadeInDown.duration(400).delay(seriesMatches.length > 1 ? 50 : 0)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('match', 'dateAndTime')}</Text>
            <View style={styles.dateTimeContainer}>
              <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <MaterialIcons name="event" size={20} color={theme.primary} />
                <Text style={styles.dateText}>{matchDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
              </Pressable>
              <Pressable style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
                <MaterialIcons name="access-time" size={20} color={theme.primary} />
                <Text style={styles.dateText}>{matchDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</Text>
              </Pressable>
            </View>
            {showDatePicker && <DateTimePicker value={matchDate} mode="date" display="default" onChange={handleDateChange} />}
            {showTimePicker && <DateTimePicker value={matchDate} mode="time" display="default" onChange={handleTimeChange} />}
          </Animated.View>

          {/* Boules Set (read-only display) */}
          {matchBoulesSet ? (
            <Animated.View entering={FadeInDown.duration(400).delay(25)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('match', 'boulesSet').toUpperCase()}</Text>
              <View style={styles.pickerButton}>
                <View style={styles.pickerSelected}>
                  <MaterialIcons name="sports-baseball" size={20} color={theme.accent} />
                  <View style={styles.pickerSelectedInfo}>
                    <Text style={styles.pickerSelectedName}>{matchBoulesSet.name}</Text>
                    <Text style={styles.pickerSelectedSub}>
                      {[matchBoulesSet.brand, matchBoulesSet.diameter ? `${matchBoulesSet.diameter} mm` : '', matchBoulesSet.weight ? `${matchBoulesSet.weight} g` : ''].filter(Boolean).join(' \u2022 ')}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {/* Location / Terrain */}
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('match', 'terrain')}</Text>
            <Pressable style={styles.pickerButton} onPress={() => { setTerrainSearch(''); setShowTerrainPicker(true); }}>
              {selectedTerrain ? (
                <View style={styles.pickerSelected}>
                  <MaterialIcons name="place" size={20} color={theme.success} />
                  <View style={styles.pickerSelectedInfo}>
                    <Text style={styles.pickerSelectedName}>{selectedTerrain.name}</Text>
                    <Text style={styles.pickerSelectedSub}>{selectedTerrain.city} • {t('terrainTypes', selectedTerrain.type)}</Text>
                  </View>
                  <Pressable onPress={(e) => { e.stopPropagation(); setSelectedTerrainId(null); Haptics.selectionAsync(); }}>
                    <MaterialIcons name="close" size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.pickerPlaceholder}>
                  <MaterialIcons name="place" size={20} color={theme.textMuted} />
                  <Text style={styles.pickerPlaceholderText}>{t('match', 'chooseTerrain')}</Text>
                  <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Mode (read-only) */}
          {!match.tournamentId && (
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('match', 'modeLabel')}</Text>
              <View style={styles.modeBadgeContainer}>
                <View style={[styles.modeBadgeReadonly, { backgroundColor: (mode === 'Tournoi' ? theme.carreauColor : theme.primary) + '12', borderColor: (mode === 'Tournoi' ? theme.carreauColor : theme.primary) + '30' }]}>
                  <MaterialIcons name={mode === 'Entraînement' ? 'fitness-center' : 'emoji-events'} size={22} color={mode === 'Tournoi' ? theme.carreauColor : theme.primary} />
                  <Text style={[styles.modeBadgeReadonlyText, { color: mode === 'Tournoi' ? theme.carreauColor : theme.primary }]}>
                    {mode === 'Entraînement' ? t('modes', 'training') : t('modes', 'tournament')}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Tournament Badge for tournament matches */}
          {match.tournamentId && (
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
              <Text style={styles.sectionTitle}>{t('match', 'modeLabel')}</Text>
              <View style={styles.tournamentBadgeContainer}>
                <View style={styles.tournamentBadge}>
                  <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />
                  <View style={styles.tournamentBadgeInfo}>
                    <Text style={styles.tournamentBadgeLabel}>{t('match', 'tournamentMatchLabel')}</Text>
                    <Text style={styles.tournamentBadgeName}>{match.tournamentName}</Text>
                  </View>
                </View>
                {match.tournamentPhase && (
                  <View style={styles.phaseBadge}>
                    <Text style={styles.phaseBadgeText}>{t('tournamentPhases', match.tournamentPhase)}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* Format */}
          <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('match', 'formatLabel')}</Text>
            <View style={styles.formatContainer}>
              {config.game.formats.map(f => (
                <Pressable key={f} style={[styles.formatChip, format === f && styles.formatChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setFormat(f); }}>
                  <Text style={[styles.formatChipText, format === f && styles.formatChipTextActive]}>{t('formats', f)}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Teams */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('match', 'teamsLabel')}</Text>
            <View style={styles.teamsCard}>
              {/* Team A */}
              <View style={styles.teamInputGroup}>
                <View style={styles.teamHeaderRow}>
                  <Text style={styles.teamLabel}>{t('match', 'myTeam')}</Text>
                  <Text style={styles.teamCountLabel}>{teamAPlayers.length}/{maxPlayersPerTeam}</Text>
                </View>
                <View style={styles.playerChipsContainer}>
                  {teamAPlayers.map(p => (
                    <View key={p.id} style={styles.playerChip}>
                      <View style={[styles.playerChipAvatar, { backgroundColor: theme.primary }]}>
                        <Text style={styles.playerChipAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.playerChipName} numberOfLines={1}>{p.name}</Text>
                      <Pressable style={styles.playerChipRemove} onPress={() => handleRemovePlayer('A', p.id)} hitSlop={6}>
                        <MaterialIcons name="close" size={14} color={theme.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                  {teamAPlayers.length < maxPlayersPerTeam ? (
                    <Pressable style={styles.addPlayerChip} onPress={() => { setPickingForTeam('A'); setPlayerSearch(''); setShowPlayerPicker(true); }}>
                      <MaterialIcons name="person-add" size={18} color={theme.primary} />
                      <Text style={styles.addPlayerChipText}>{t('match', 'addPlayers')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={styles.teamDivider} />
              {/* Team B */}
              <View style={styles.teamInputGroup}>
                <View style={styles.teamHeaderRow}>
                  <Text style={styles.teamLabel}>{t('match', 'opponent')}</Text>
                  <Text style={styles.teamCountLabel}>{teamBPlayers.length}/{maxPlayersPerTeam}</Text>
                </View>
                <View style={styles.playerChipsContainer}>
                  {teamBPlayers.map(p => (
                    <View key={p.id} style={[styles.playerChip, { borderColor: theme.accent + '30' }]}>
                      <View style={[styles.playerChipAvatar, { backgroundColor: theme.accent }]}>
                        <Text style={styles.playerChipAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.playerChipName} numberOfLines={1}>{p.name}</Text>
                      <Pressable style={styles.playerChipRemove} onPress={() => handleRemovePlayer('B', p.id)} hitSlop={6}>
                        <MaterialIcons name="close" size={14} color={theme.textMuted} />
                      </Pressable>
                    </View>
                  ))}
                  {teamBPlayers.length < maxPlayersPerTeam ? (
                    <Pressable style={styles.addPlayerChip} onPress={() => { setPickingForTeam('B'); setPlayerSearch(''); setShowPlayerPicker(true); }}>
                      <MaterialIcons name="person-add" size={18} color={theme.accent} />
                      <Text style={[styles.addPlayerChipText, { color: theme.accent }]}>{t('match', 'addPlayers')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Score */}
          <Animated.View entering={FadeInDown.duration(400).delay(250)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('match', 'finalScore')}</Text>
            <View style={styles.scoreContainer}>
              <View style={styles.teamScore}>
                <Text style={styles.scoreLabel}>{t('match', 'myTeam')}</Text>
                <View style={styles.scoreControls}>
                  <Pressable style={styles.scoreButton} onPress={() => handleScoreChange('A', -1)}><MaterialIcons name="remove" size={24} color={theme.textSecondary} /></Pressable>
                  <Text style={[styles.scoreValue, teamAScore > teamBScore && styles.scoreValueWin]}>{teamAScore}</Text>
                  <Pressable style={styles.scoreButton} onPress={() => handleScoreChange('A', 1)}><MaterialIcons name="add" size={24} color={theme.primary} /></Pressable>
                </View>
              </View>
              <View style={styles.vsContainer}><Text style={styles.vsText}>-</Text></View>
              <View style={styles.teamScore}>
                <Text style={styles.scoreLabel}>{t('match', 'opponent')}</Text>
                <View style={styles.scoreControls}>
                  <Pressable style={styles.scoreButton} onPress={() => handleScoreChange('B', -1)}><MaterialIcons name="remove" size={24} color={theme.textSecondary} /></Pressable>
                  <Text style={[styles.scoreValue, teamBScore > teamAScore && styles.scoreValueWin]}>{teamBScore}</Text>
                  <Pressable style={styles.scoreButton} onPress={() => handleScoreChange('B', 1)}><MaterialIcons name="add" size={24} color={theme.primary} /></Pressable>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Duration */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('match', 'durationMinutes')}</Text>
            <View style={styles.durationContainer}>
              <Pressable style={styles.durationButton} onPress={() => setDuration(prev => Math.max(0, prev - 5))}><MaterialIcons name="remove" size={24} color={theme.textSecondary} /></Pressable>
              <TextInput style={styles.durationInput} value={duration.toString()} onChangeText={(text) => setDuration(parseInt(text) || 0)} keyboardType="number-pad" />
              <Pressable style={styles.durationButton} onPress={() => setDuration(prev => prev + 5)}><MaterialIcons name="add" size={24} color={theme.primary} /></Pressable>
            </View>
          </Animated.View>

          {/* Player Actions */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.section}>
            <Text style={styles.sectionTitle}>{t('match', 'playerActions')}</Text>
            <Text style={styles.sectionSubtitle}>{t('matchEdit', 'actionsDesc')}</Text>
            {teamAPlayersList.length > 0 && (
              <View style={styles.teamActionsGroup}>
                <Text style={styles.teamActionsLabel}>{t('match', 'myTeam')}</Text>
                {teamAPlayersList.map(p => renderPlayerActionEditor(p))}
              </View>
            )}
            {teamBPlayersList.length > 0 && (
              <View style={styles.teamActionsGroup}>
                <Text style={[styles.teamActionsLabel, { color: theme.accent }]}>{t('match', 'opponent')}</Text>
                {teamBPlayersList.map(p => renderPlayerActionEditor(p))}
              </View>
            )}
          </Animated.View>

          {/* Menes */}
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('match', 'menesCount')} ({menes.length})</Text>
              <Pressable style={styles.addMeneBtn} onPress={handleAddMene}>
                <MaterialIcons name="add" size={18} color={theme.primary} />
                <Text style={styles.addMeneBtnText}>{t('match', 'addLabel')}</Text>
              </Pressable>
            </View>
            {menes.length > 0 ? (
              <View style={styles.menesCard}>
                {menes.map((mene, index) => (
                  <View key={index} style={styles.meneEditRow}>
                    <Text style={styles.meneNumber}>#{index + 1}</Text>
                    <View style={styles.meneScoreEdit}>
                      <Pressable style={styles.meneScoreBtn} onPress={() => handleMeneEdit(index, 'teamAPoints', mene.teamAPoints - 1)}><MaterialIcons name="remove" size={16} color={theme.textMuted} /></Pressable>
                      <Text style={[styles.meneScoreValue, mene.teamAPoints > 0 && { color: theme.success }]}>{mene.teamAPoints}</Text>
                      <Pressable style={styles.meneScoreBtn} onPress={() => handleMeneEdit(index, 'teamAPoints', mene.teamAPoints + 1)}><MaterialIcons name="add" size={16} color={theme.primary} /></Pressable>
                    </View>
                    <Text style={styles.meneSeparator}>-</Text>
                    <View style={styles.meneScoreEdit}>
                      <Pressable style={styles.meneScoreBtn} onPress={() => handleMeneEdit(index, 'teamBPoints', mene.teamBPoints - 1)}><MaterialIcons name="remove" size={16} color={theme.textMuted} /></Pressable>
                      <Text style={[styles.meneScoreValue, mene.teamBPoints > 0 && { color: theme.error }]}>{mene.teamBPoints}</Text>
                      <Pressable style={styles.meneScoreBtn} onPress={() => handleMeneEdit(index, 'teamBPoints', mene.teamBPoints + 1)}><MaterialIcons name="add" size={16} color={theme.primary} /></Pressable>
                    </View>
                    <Pressable style={styles.meneDeleteBtn} onPress={() => handleDeleteMene(index)}><MaterialIcons name="close" size={18} color={theme.error} /></Pressable>
                  </View>
                ))}
                <View style={styles.meneTotalRow}>
                  <Text style={styles.meneTotalLabel}>{t('match', 'totalLabel')}</Text>
                  <Text style={[styles.meneTotalValue, { color: theme.success }]}>{menes.reduce((sum, m) => sum + m.teamAPoints, 0)}</Text>
                  <Text style={styles.meneTotalSeparator}>-</Text>
                  <Text style={[styles.meneTotalValue, { color: theme.error }]}>{menes.reduce((sum, m) => sum + m.teamBPoints, 0)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.noMenesCard}><Text style={styles.noMenesText}>{t('match', 'noMenesRecorded')}</Text></View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {matchIsShared && matchPermission === 'read' ? (
            <View style={styles.readOnlyBanner}>
              <MaterialIcons name="lock" size={18} color={theme.textMuted} />
              <Text style={styles.readOnlyBannerText}>
                {language === 'fr' ? 'Lecture seule — vous ne pouvez pas modifier ce match' : 'Read only — you cannot modify this match'}
              </Text>
            </View>
          ) : (
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <MaterialIcons name="check" size={24} color="#FFF" />
              <Text style={styles.saveButtonText}>{t('match', 'saveChangesBtn')}</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Terrain Picker Modal */}
      <Modal visible={showTerrainPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowTerrainPicker(false); setTerrainSearch(''); }}>
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('match', 'terrain')}</Text>
            <Pressable style={styles.modalCloseBtn} onPress={() => { setShowTerrainPicker(false); setTerrainSearch(''); }}><MaterialIcons name="close" size={24} color={theme.textPrimary} /></Pressable>
          </View>
          <View style={styles.modalSearchContainer}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput style={styles.modalSearchInput} value={terrainSearch} onChangeText={setTerrainSearch} placeholder={t('profile', 'searchTerrain')} placeholderTextColor={theme.textMuted} autoFocus />
            {terrainSearch.length > 0 ? (
              <Pressable onPress={() => setTerrainSearch('')}>
                <MaterialIcons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, marginBottom: 4 }}>
            <Pressable style={styles.terrainAddNewBtn} onPress={() => { setShowTerrainPicker(false); setTerrainSearch(''); router.push('/terrain/new'); }}>
              <MaterialIcons name="add" size={14} color={theme.primary} />
              <Text style={styles.terrainAddNewBtnText}>{t('match', 'addTerrain')}</Text>
            </Pressable>
          </View>
          {/* None option */}
          <Pressable
            style={[styles.terrainPickerItem, !selectedTerrainId && styles.terrainPickerItemActive]}
            onPress={() => { Haptics.selectionAsync(); setSelectedTerrainId(null); setShowTerrainPicker(false); setTerrainSearch(''); }}
          >
            <View style={[styles.terrainPickerItemIcon, { backgroundColor: theme.textMuted + '15' }]}>
              <MaterialIcons name="block" size={20} color={theme.textMuted} />
            </View>
            <Text style={styles.terrainPickerItemName}>{t('tournament', 'none')}</Text>
            {!selectedTerrainId ? <MaterialIcons name="check-circle" size={20} color={theme.primary} /> : null}
          </Pressable>
          <FlatList
            data={sortedTerrains}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            renderItem={({ item: terrain }) => {
              const tc = config.terrainTypes.find(t => t.id === terrain.type);
              return (
                <Pressable
                  style={[styles.terrainPickerItem, { marginHorizontal: 0 }, selectedTerrainId === terrain.id && styles.terrainPickerItemActive]}
                  onPress={() => { Haptics.selectionAsync(); handleSelectTerrain(terrain.id); setTerrainSearch(''); }}
                >
                  <View style={[styles.terrainPickerItemIcon, { backgroundColor: selectedTerrainId === terrain.id ? theme.primary : theme.success + '15' }]}>
                    <MaterialIcons name={(tc?.icon as any) || 'landscape'} size={20} color={selectedTerrainId === terrain.id ? '#FFF' : theme.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.terrainPickerItemName}>{terrain.name}</Text>
                      {(terrain as any)._matchCount > 0 ? (
                        <View style={styles.terrainMatchBadge}>
                          <MaterialIcons name="sports" size={10} color={theme.primary} />
                          <Text style={styles.terrainMatchBadgeText}>{(terrain as any)._matchCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.terrainPickerItemSub}>{t('terrainTypes', terrain.type)} \u2022 {terrain.city}</Text>
                  </View>
                  {selectedTerrainId === terrain.id ? <MaterialIcons name="check-circle" size={22} color={theme.primary} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <MaterialIcons name={terrainSearch ? 'search-off' : 'location-off'} size={40} color={theme.textMuted} />
                <Text style={styles.modalEmptyText}>{terrainSearch ? t('common', 'noResults') : t('match', 'noTerrains')}</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Tournament Picker Modal */}
      <Modal visible={showTournamentPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTournamentPicker(false)}>
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('matchEdit', 'selectTournament')}</Text>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowTournamentPicker(false)}><MaterialIcons name="close" size={24} color={theme.textPrimary} /></Pressable>
          </View>
          <View style={styles.modalSearchContainer}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput style={styles.modalSearchInput} value={tournamentSearch} onChangeText={setTournamentSearch} placeholder={t('common', 'search') + '...'} placeholderTextColor={theme.textMuted} autoFocus />
          </View>
          {filteredTournaments.length > 0 ? (
            <FlatList data={filteredTournaments} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              renderItem={({ item: tour }) => {
                const dateStr = new Date(tour.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <Pressable style={[styles.modalItem, selectedTournamentId === tour.id && styles.modalItemSelected]} onPress={() => handleSelectTournament(tour.id)}>
                    <View style={[styles.modalItemIndicator, { backgroundColor: theme.carreauColor }]} />
                    <View style={styles.modalItemContent}>
                      <Text style={styles.modalItemTitle}>{tour.name}</Text>
                      <View style={styles.modalItemMeta}>
                        <Text style={styles.modalItemMetaText}>{dateStr}</Text>
                        <View style={styles.modalItemDot} />
                        <Text style={styles.modalItemMetaText}>{tour.location?.city}</Text>
                        <View style={styles.modalItemDot} />
                        <Text style={styles.modalItemMetaText}>{t('formats', tour.format)}</Text>
                      </View>
                    </View>
                    {selectedTournamentId === tour.id && <MaterialIcons name="check-circle" size={22} color={theme.carreauColor} />}
                  </Pressable>
                );
              }}
            />
          ) : (
            <View style={styles.modalEmpty}><MaterialIcons name="emoji-events" size={48} color={theme.textMuted} /><Text style={styles.modalEmptyText}>{t('profile', 'noTournamentsAvailable')}</Text></View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Share Modal */}
      <ShareModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        itemType="match"
        itemId={id!}
        itemName={`${match.teamA.playerNames.join(', ')} vs ${match.teamB.playerNames.join(', ')}`}
        forceReadOnly
      />

      {/* Player Picker Modal */}
      <Modal visible={showPlayerPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPlayerPicker(false)}>
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {pickingForTeam === 'A' ? t('match', 'myTeam') : t('match', 'opponent')}
            </Text>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowPlayerPicker(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.modalSearchContainer}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              value={playerSearch}
              onChangeText={setPlayerSearch}
              placeholder={t('match', 'addPlayers')}
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
          </View>
          {/* Current selection */}
          {(() => {
            const currentTeam = pickingForTeam === 'A' ? teamAPlayers : teamBPlayers;
            if (currentTeam.length === 0) return null;
            return (
              <View style={styles.pickerCurrentTeam}>
                <Text style={styles.pickerCurrentTeamLabel}>{t('match', 'selected')} ({currentTeam.length}/{maxPlayersPerTeam})</Text>
                <View style={styles.pickerCurrentTeamChips}>
                  {currentTeam.map(p => (
                    <View key={p.id} style={styles.pickerSelectedChip}>
                      <Text style={styles.pickerSelectedChipText}>{p.name}</Text>
                      <Pressable onPress={() => handleRemovePlayer(pickingForTeam, p.id)} hitSlop={6}>
                        <MaterialIcons name="close" size={14} color={theme.primary} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
          <FlatList
            data={filteredPickerPlayers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            renderItem={({ item: p }) => {
              const currentTeamCount = pickingForTeam === 'A' ? teamAPlayers.length : teamBPlayers.length;
              const isFull = currentTeamCount >= maxPlayersPerTeam;
              return (
                <Pressable
                  style={[styles.modalItem, isFull && { opacity: 0.4 }]}
                  onPress={() => { if (!isFull) { handleAddPlayer(p.id, p.name); } }}
                  disabled={isFull}
                >
                  <View style={[styles.pickerPlayerAvatar, { backgroundColor: (pickingForTeam === 'A' ? theme.primary : theme.accent) + '15' }]}>
                    <Text style={[styles.pickerPlayerAvatarText, { color: pickingForTeam === 'A' ? theme.primary : theme.accent }]}>
                      {p.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.modalItemContent}>
                    <Text style={styles.modalItemTitle}>{p.name}</Text>
                    <View style={styles.modalItemMeta}>
                      <Text style={styles.modalItemMetaText}>{t('roles', p.role)}</Text>
                      <View style={styles.modalItemDot} />
                      <Text style={styles.modalItemMetaText}>{t('levels', p.level)}</Text>
                      {p.club ? (
                        <>
                          <View style={styles.modalItemDot} />
                          <Text style={styles.modalItemMetaText}>{p.club}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <MaterialIcons name="add-circle-outline" size={22} color={isFull ? theme.textMuted : theme.primary} />
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.modalEmpty}>
                <MaterialIcons name="person-search" size={48} color={theme.textMuted} />
                <Text style={styles.modalEmptyText}>{t('match', 'noPlayersFound')}</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Detailed Shot Notation Modal */}
      {editingActionPlayer && (
        <SimplifiedShotNotation
          visible={showShotNotation}
          onClose={() => { setShowShotNotation(false); setEditingShotId(null); setEditingShotRecord(null); }}
          actionType={editingActionType}
          playerId={editingActionPlayer.id}
          playerName={editingActionPlayer.name}
          team={editingActionPlayer.team}
          onSubmit={handleShotSubmit}
          initialRecord={editingShotRecord || undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1, marginBottom: 12 },
  sectionSubtitle: { fontSize: 12, color: theme.textMuted, marginTop: -8, marginBottom: 12 },
  dateTimeContainer: { flexDirection: 'row', gap: 12 },
  dateButton: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, padding: 16, borderRadius: theme.borderRadius.md, ...theme.shadows.card },
  timeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, padding: 16, borderRadius: theme.borderRadius.md, ...theme.shadows.card },
  dateText: { fontSize: 15, color: theme.textPrimary, fontWeight: '500' },
  // Picker button
  pickerButton: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, ...theme.shadows.card, overflow: 'hidden' },
  pickerSelected: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  pickerSelectedInfo: { flex: 1 },
  pickerSelectedName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  pickerSelectedSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  pickerPlaceholder: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  pickerPlaceholderText: { flex: 1, fontSize: 15, color: theme.textMuted },
  // Mode
  modeContainer: { flexDirection: 'row', gap: 12 },
  modeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.surface, paddingVertical: 14, borderRadius: theme.borderRadius.md, ...theme.shadows.card },
  modeButtonActive: { backgroundColor: theme.primary },
  modeText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  modeTextActive: { color: '#FFF' },
  formatContainer: { flexDirection: 'row', gap: 10 },
  formatChip: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card },
  formatChipActive: { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
  formatChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  formatChipTextActive: { color: theme.primary },
  teamsCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, ...theme.shadows.card },
  teamInputGroup: { marginBottom: 4 },
  teamHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  teamLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  teamCountLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  teamDivider: { height: 1, backgroundColor: theme.border, marginVertical: 16 },
  playerChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.backgroundSecondary, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.primary + '30' },
  playerChipAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  playerChipAvatarText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  playerChipName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, maxWidth: 120 },
  playerChipRemove: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  addPlayerChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: theme.borderRadius.full, borderWidth: 1.5, borderColor: theme.primary + '40', borderStyle: 'dashed' as any },
  addPlayerChipText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  // Mode read-only badge
  modeBadgeContainer: {},
  modeBadgeReadonly: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: theme.borderRadius.md, borderWidth: 1 },
  modeBadgeReadonlyText: { fontSize: 15, fontWeight: '700' },
  // Player picker
  pickerCurrentTeam: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  pickerCurrentTeamLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerCurrentTeamChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerSelectedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.primary + '12', paddingVertical: 6, paddingHorizontal: 12, borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.primary + '30' },
  pickerSelectedChipText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  pickerPlayerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  pickerPlayerAvatarText: { fontSize: 16, fontWeight: '700' },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, ...theme.shadows.card },
  teamScore: { flex: 1, alignItems: 'center' },
  scoreLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 12 },
  scoreControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scoreButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 20 },
  scoreValue: { fontSize: 36, fontWeight: '700', color: theme.textPrimary, width: 60, textAlign: 'center' },
  scoreValueWin: { color: theme.success },
  vsContainer: { paddingHorizontal: 8 },
  vsText: { fontSize: 20, fontWeight: '600', color: theme.textMuted },
  durationContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 12, gap: 16, ...theme.shadows.card },
  durationButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 22 },
  durationInput: { fontSize: 28, fontWeight: '700', color: theme.textPrimary, width: 80, textAlign: 'center' },
  // Player actions
  teamActionsGroup: { marginBottom: 16 },
  teamActionsLabel: { fontSize: 11, fontWeight: '700', color: theme.primary, letterSpacing: 0.5, marginBottom: 8 },
  playerActionCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 10, ...theme.shadows.card },
  playerActionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  playerActionDot: { width: 8, height: 8, borderRadius: 4 },
  playerActionName: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  detailedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.success + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  detailedBadgeText: { fontSize: 11, fontWeight: '600', color: theme.success },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  actionLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 60 },
  actionLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  actionCounters: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counterGroup: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  counterBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 13 },
  counterValue: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, width: 28, textAlign: 'center' },
  counterSep: { paddingHorizontal: 2 },
  counterSepText: { fontSize: 14, color: theme.textMuted },
  detailedBtnRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border },
  detailedBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: theme.borderRadius.md, borderWidth: 1 },
  detailedBtnText: { fontSize: 12, fontWeight: '600' },
  // Detailed shots list
  detailedShotsSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, overflow: 'hidden' },
  detailedShotsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  detailedShotsToggleText: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  detailedShotsList: { marginTop: 6, overflow: 'hidden' },
  detailedShotItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border + '60' },
  detailedShotIcon: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  detailedShotContent: { flex: 1 },
  detailedShotTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  detailedShotBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  detailedShotBadgeText: { fontSize: 10, fontWeight: '600' },
  detailedShotTime: { fontSize: 10, color: theme.textMuted },
  detailedShotLabel: { fontSize: 11, color: theme.textSecondary, lineHeight: 15 },
  detailedShotDeleteBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  // Menes
  addMeneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '20', borderRadius: theme.borderRadius.full },
  addMeneBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  menesCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, overflow: 'hidden', ...theme.shadows.card },
  meneEditRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  meneNumber: { width: 36, fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  meneScoreEdit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meneScoreBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 14 },
  meneScoreValue: { fontSize: 18, fontWeight: '600', color: theme.textSecondary, width: 28, textAlign: 'center' },
  meneSeparator: { fontSize: 16, color: theme.textMuted, marginHorizontal: 12 },
  meneDeleteBtn: { marginLeft: 'auto', width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  meneTotalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: theme.backgroundSecondary },
  meneTotalLabel: { width: 36, fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  meneTotalValue: { fontSize: 18, fontWeight: '700', width: 60, textAlign: 'center' },
  meneTotalSeparator: { fontSize: 16, color: theme.textMuted, marginHorizontal: 12 },
  noMenesCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 24, alignItems: 'center', ...theme.shadows.card },
  noMenesText: { fontSize: 14, color: theme.textMuted },
  // Series
  seriesPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 12, ...theme.shadows.card },
  seriesPanelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seriesIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  seriesIconWin: { backgroundColor: theme.success },
  seriesIconLoss: { backgroundColor: theme.error },
  seriesPanelTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary },
  seriesPanelSubtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  seriesMatchesList: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 12, marginBottom: 12, ...theme.shadows.card },
  seriesMatchCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md, marginBottom: 8 },
  seriesMatchCardCurrent: { borderWidth: 2, borderColor: theme.primary, backgroundColor: theme.primary + '10' },
  seriesMatchCardFinale: { borderWidth: 2, borderColor: theme.carreauColor + '50' },
  seriesMatchCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seriesMatchIndicator: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.textMuted, alignItems: 'center', justifyContent: 'center' },
  seriesMatchIndicatorWin: { backgroundColor: theme.success },
  seriesMatchIndicatorLoss: { backgroundColor: theme.error },
  seriesMatchIndicatorFinale: { backgroundColor: theme.carreauColor },
  seriesMatchIndicatorText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  seriesMatchLabel: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  seriesMatchDate: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  seriesMatchCardRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seriesMatchScore: { fontSize: 18, fontWeight: '700', color: theme.textSecondary },
  seriesMatchScoreWin: { color: theme.success },
  seriesMatchScoreLoss: { color: theme.error },
  seriesMatchBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  seriesMatchBadgeWin: { backgroundColor: theme.success + '20' },
  seriesMatchBadgeLoss: { backgroundColor: theme.error + '20' },
  seriesMatchBadgeText: { fontSize: 12, fontWeight: '700' },
  seriesSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  seriesSummaryScore: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seriesSummaryValue: { fontSize: 28, fontWeight: '800', color: theme.textMuted },
  seriesSummaryValueWin: { color: theme.success },
  seriesSummaryValueLoss: { color: theme.error },
  seriesSummarySep: { fontSize: 12, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase' },
  tournamentBadgeContainer: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, borderWidth: 2, borderColor: theme.carreauColor + '30', ...theme.shadows.card },
  tournamentBadge: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tournamentBadgeInfo: { flex: 1 },
  tournamentBadgeLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
  tournamentBadgeName: { fontSize: 16, fontWeight: '600', color: theme.carreauColor },
  phaseBadge: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
  phaseBadgeText: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  footer: { paddingHorizontal: 16, paddingTop: 16, backgroundColor: theme.backgroundSecondary, borderTopWidth: 1, borderTopColor: theme.border },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 18, borderRadius: theme.borderRadius.md },
  saveButtonText: { fontSize: 17, fontWeight: '600', color: '#FFF' },
  // Shared match styles
  sharedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.primary + '08',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.primary + '20',
  },
  sharedBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.primary,
  },
  sharedBannerSub: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 1,
  },
  sharedBannerPermBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  sharedBannerPermText: {
    fontSize: 11,
    fontWeight: '700',
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  readOnlyBannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textMuted,
  },
  // Modal
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  modalCloseBtn: { padding: 8 },
  modalSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.borderRadius.md, gap: 10, borderWidth: 1, borderColor: theme.border },
  modalSearchInput: { flex: 1, fontSize: 15, color: theme.textPrimary, padding: 0 },
  modalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 8, ...theme.shadows.card },
  modalItemSelected: { borderWidth: 2, borderColor: theme.primary },
  modalItemIndicator: { width: 4, height: '80%', borderRadius: 2, marginRight: 12 },
  modalItemContent: { flex: 1 },
  modalItemTitle: { fontSize: 14, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  modalItemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  modalItemMetaText: { fontSize: 11, color: theme.textMuted },
  modalItemDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted },
  modalEmpty: { alignItems: 'center', paddingVertical: 48 },
  modalEmptyText: { fontSize: 15, color: theme.textMuted, marginTop: 12 },
  // Terrain picker styles
  terrainAddNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '12', borderRadius: theme.borderRadius.sm },
  terrainAddNewBtnText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  terrainPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, marginHorizontal: 16, marginBottom: 8, ...theme.shadows.card },
  terrainPickerItemActive: { borderWidth: 2, borderColor: theme.primary },
  terrainPickerItemIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  terrainPickerItemName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  terrainPickerItemSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  terrainMatchBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.primary + '15', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  terrainMatchBadgeText: { fontSize: 11, fontWeight: '700', color: theme.primary },
});
