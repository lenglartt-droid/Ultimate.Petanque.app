import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config, { GameFormat, TournamentType } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';


// Base tournament phases (fallback)
const BASE_PHASES = [
  { id: 'Poules', label: 'Poules', short: 'PL' },
  { id: '1/16 finale', label: '1/16 finale', short: '1/16' },
  { id: '1/8 finale', label: '1/8 finale', short: '1/8' },
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
    { id: '1/16 finale', label: '1/16 finale', short: '1/16' },
    { id: '1/8 finale', label: '1/8 finale', short: '1/8' },
    { id: 'Quart de finale', label: 'Quarts', short: 'QF' },
    { id: 'Demi-finale', label: 'Demis', short: 'DF' },
    { id: 'Finale', label: 'Finale', short: 'F' },
  ],
  'Mixte': [
    { id: 'Poules', label: 'Poules', short: 'PL' },
    { id: '1/8 finale', label: '1/8 finale', short: '1/8' },
    { id: 'Quart de finale', label: 'Quarts', short: 'QF' },
    { id: 'Demi-finale', label: 'Demis', short: 'DF' },
    { id: 'Finale', label: 'Finale', short: 'F' },
  ],
  'Suisse': [
    { id: 'Ronde 1', label: 'Ronde 1', short: 'R1' },
    { id: 'Ronde 2', label: 'Ronde 2', short: 'R2' },
    { id: 'Ronde 3', label: 'Ronde 3', short: 'R3' },
    { id: 'Ronde 4', label: 'Ronde 4', short: 'R4' },
    { id: 'Ronde 5', label: 'Ronde 5', short: 'R5' },
    { id: 'Classement', label: 'Classement', short: 'CL' },
  ],
  'A/B/C': [
    { id: 'Poules', label: 'Poules', short: 'PL' },
    { id: 'Tableau A', label: 'Tableau A', short: 'A' },
    { id: 'Tableau B', label: 'Tableau B', short: 'B' },
    { id: 'Tableau C', label: 'Tableau C', short: 'C' },
    { id: 'Finale', label: 'Finale', short: 'F' },
  ],
  'Tirage intégral': [
    { id: 'Tour 1', label: 'Tour 1', short: 'T1' },
    { id: 'Tour 2', label: 'Tour 2', short: 'T2' },
    { id: 'Tour 3', label: 'Tour 3', short: 'T3' },
    { id: 'Demi-finale', label: 'Demis', short: 'DF' },
    { id: 'Finale', label: 'Finale', short: 'F' },
  ],
  'Autre': BASE_PHASES,
};

const TOURNAMENT_BRACKETS = ['A', 'B', 'C', 'D'] as const;
type TournamentBracket = typeof TOURNAMENT_BRACKETS[number];

interface Mene {
  id: number;
  teamAPoints: number;
  teamBPoints: number;
  duration: number;
  isNull?: boolean;
}

interface PlayerActionState {
  playerId: string;
  playerName: string;
  team: 'A' | 'B';
  actions: {
    tirs: number;
    tirsSuccess: number;
    points: number;
    pointsSuccess: number;
    carreaux: number;
  };
}

// Player role selection for team composition
type PlayerRoleType = 'Pointeur' | 'Milieu' | 'Tireur';

interface TeamPlayerWithRole {
  playerId: string;
  role: PlayerRoleType;
}

type ActionType = 'tir' | 'point' | 'carreau';

export default function NewMatchScreen() {
  const insets = useSafeAreaInsets();
  const { tournamentId, revanche, format: revancheFormat, teamA: revancheTeamA, teamB: revancheTeamB } = useLocalSearchParams<{ 
    tournamentId?: string;
    revanche?: string;
    format?: string;
    teamA?: string;
    teamB?: string;
  }>();
  const { addMatch, players, tournaments, matches, selfPlayer } = useApp();
  
  // Check if this is a revanche match
  const isRevanche = revanche === 'true';
  
  // Auto-detect tournament mode from params
  const linkedTournament = tournamentId ? tournaments.find(t => t.id === tournamentId) : null;
  const isTournamentMode = !!linkedTournament;
  
  // Get phases based on tournament cadrage
  const tournamentPhases = useMemo(() => {
    if (!linkedTournament) return BASE_PHASES;
    return PHASES_BY_CADRAGE[linkedTournament.type] || BASE_PHASES;
  }, [linkedTournament]);

  // Get previous matches in this tournament to suggest next phase and team
  const tournamentHistory = useMemo(() => {
    if (!linkedTournament) return { lastPhase: null, lastBracket: null, lastTeamAPlayers: [] as string[] };
    const prevMatches = matches
      .filter(m => m.tournamentId === linkedTournament.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Get first phase for this cadrage type
    const firstPhase = tournamentPhases[0]?.id || 'Poules';
    
    // If no previous matches, include self player by default
    if (prevMatches.length === 0) {
      const defaultPlayers = selfPlayer ? [selfPlayer.id] : [];
      return { lastPhase: firstPhase, lastBracket: null, lastTeamAPlayers: defaultPlayers };
    }
    
    const last = prevMatches[0];
    const lastWon = last.winner === 'A';
    let suggestedPhase = last.tournamentPhase;
    if (lastWon && suggestedPhase) {
      const idx = tournamentPhases.findIndex(p => p.id === suggestedPhase);
      if (idx < tournamentPhases.length - 1) {
        suggestedPhase = tournamentPhases[idx + 1].id;
      }
    }
    // Get last team A players for pre-fill
    const lastTeamAPlayers = last.teamA.players.filter(id => players.some(p => p.id === id));
    return { lastPhase: suggestedPhase, lastBracket: last.tournamentBracket || null, lastTeamAPlayers };
  }, [linkedTournament, matches, players, tournamentPhases, selfPlayer]);
  
  // Auto-include self player in team A for all modes (only if not revanche with pre-filled teams)
  useEffect(() => {
    if (isRevanche) return; // Skip for revanche - teams come from params
    if (!selfPlayer || teamAPlayers.length > 0) return;
    
    if (isTournamentMode) {
      // For tournament mode, prefer last match's team composition, fallback to selfPlayer
      if (tournamentHistory.lastTeamAPlayers.length > 0) {
        const playersWithRoles = tournamentHistory.lastTeamAPlayers.map(id => {
          const player = players.find(p => p.id === id);
          return { playerId: id, role: (player?.role || 'Milieu') as PlayerRoleType };
        });
        setTeamAPlayers(playersWithRoles);
      } else {
        setTeamAPlayers([{ playerId: selfPlayer.id, role: (selfPlayer.role || 'Milieu') as PlayerRoleType }]);
      }
    } else {
      // For training mode, always add selfPlayer
      setTeamAPlayers([{ playerId: selfPlayer.id, role: (selfPlayer.role || 'Milieu') as PlayerRoleType }]);
    }
  }, [selfPlayer, isTournamentMode, tournamentHistory.lastTeamAPlayers, players]);
  
  const [format, setFormat] = useState<GameFormat>(linkedTournament?.format || (isRevanche && revancheFormat ? revancheFormat as GameFormat : 'Doublette'));
  const [teamAScore, setTeamAScore] = useState(0);
  const [teamBScore, setTeamBScore] = useState(0);
  const [teamAPlayers, setTeamAPlayers] = useState<TeamPlayerWithRole[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<TeamPlayerWithRole[]>([]);
  const [showPlayerPicker, setShowPlayerPicker] = useState<'A' | 'B' | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<string | null>(tournamentHistory.lastPhase);
  const [selectedBracket, setSelectedBracket] = useState<TournamentBracket | null>(tournamentHistory.lastBracket as TournamentBracket | null);

  // Pre-populate teams from revanche params
  useEffect(() => {
    if (isRevanche) {
      if (revancheTeamA) {
        const teamANames = decodeURIComponent(revancheTeamA).split(',').map(n => n.trim());
        const teamAPlayersWithRoles = teamANames.map(name => {
          // Try to find player by name
          const player = players.find(p => p.name.toLowerCase() === name.toLowerCase());
          if (player) {
            return { playerId: player.id, role: (player.role || 'Milieu') as PlayerRoleType };
          }
          return null;
        }).filter((p): p is TeamPlayerWithRole => p !== null);
        if (teamAPlayersWithRoles.length > 0) {
          setTeamAPlayers(teamAPlayersWithRoles);
        }
      }
      if (revancheTeamB) {
        const teamBNames = decodeURIComponent(revancheTeamB).split(',').map(n => n.trim());
        const teamBPlayersWithRoles = teamBNames.map(name => {
          const player = players.find(p => p.name.toLowerCase() === name.toLowerCase());
          if (player) {
            return { playerId: player.id, role: (player.role || 'Milieu') as PlayerRoleType };
          }
          return null;
        }).filter((p): p is TeamPlayerWithRole => p !== null);
        if (teamBPlayersWithRoles.length > 0) {
          setTeamBPlayers(teamBPlayersWithRoles);
        }
      }
    }
  }, [isRevanche, revancheTeamA, revancheTeamB, players]);
  
  // Scoring mode: 'detailed' (mènes) or 'actions' (tirs/points)
  const [scoringMode, setScoringMode] = useState<'detailed' | 'actions'>('detailed');
  
  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [matchTime, setMatchTime] = useState(0);
  const [meneTime, setMeneTime] = useState(0);
  const [menes, setMenes] = useState<Mene[]>([]);
  const [currentMenePoints, setCurrentMenePoints] = useState({ teamA: 0, teamB: 0 });
  const [isNullMene, setIsNullMene] = useState(false);
  const [showActionTracker, setShowActionTracker] = useState(false);
  const [playerActions, setPlayerActions] = useState<PlayerActionState[]>([]);
  const [manualActionMode, setManualActionMode] = useState(false); // Manual input for actions
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxScore = config.game.maxScore;

  // Get max players per team based on format
  const maxPlayersPerTeam = useMemo(() => {
    switch (format) {
      case 'Tête-à-tête': return 1;
      case 'Doublette': return 2;
      case 'Triplette': return 3;
      default: return 2;
    }
  }, [format]);

  // Filter players for search
  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return players;
    const search = playerSearch.toLowerCase();
    return players.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.club?.toLowerCase().includes(search) ||
      p.role.toLowerCase().includes(search)
    );
  }, [players, playerSearch]);

  // Auto-set format, phase, and bracket when tournament is linked
  useEffect(() => {
    if (linkedTournament) {
      setFormat(linkedTournament.format);
      if (tournamentHistory.lastPhase && !selectedPhase) {
        setSelectedPhase(tournamentHistory.lastPhase);
      }
      if (tournamentHistory.lastBracket && !selectedBracket) {
        setSelectedBracket(tournamentHistory.lastBracket as TournamentBracket);
      }
    }
  }, [linkedTournament, tournamentHistory]);

  // Clear bracket when switching to Poules phase
  useEffect(() => {
    if (selectedPhase === 'Poules') {
      setSelectedBracket(null);
    }
  }, [selectedPhase]);

  // Toggle player selection
  const togglePlayer = (playerId: string, team: 'A' | 'B') => {
    Haptics.selectionAsync();
    const setTeam = team === 'A' ? setTeamAPlayers : setTeamBPlayers;
    const otherTeam = team === 'A' ? teamBPlayers : teamAPlayers;
    const currentTeam = team === 'A' ? teamAPlayers : teamBPlayers;

    // Check if player is in other team
    if (otherTeam.some(p => p.playerId === playerId)) {
      Alert.alert('Erreur', 'Ce joueur est déjà dans l\'autre équipe');
      return;
    }

    if (currentTeam.some(p => p.playerId === playerId)) {
      setTeam(prev => prev.filter(p => p.playerId !== playerId));
    } else {
      if (currentTeam.length >= maxPlayersPerTeam) {
        Alert.alert('Équipe complète', `Maximum ${maxPlayersPerTeam} joueur(s) en ${format}`);
        return;
      }
      // Get player's default role from their profile
      const player = players.find(p => p.id === playerId);
      const defaultRole = (player?.role || 'Milieu') as PlayerRoleType;
      setTeam(prev => [...prev, { playerId, role: defaultRole }]);
    }
  };

  // Update player role
  const updatePlayerRole = (playerId: string, team: 'A' | 'B', newRole: PlayerRoleType) => {
    Haptics.selectionAsync();
    const setTeam = team === 'A' ? setTeamAPlayers : setTeamBPlayers;
    setTeam(prev => prev.map(p => 
      p.playerId === playerId ? { ...p, role: newRole } : p
    ));
  };

  // Get player role in team
  const getPlayerRole = (playerId: string, team: 'A' | 'B'): PlayerRoleType => {
    const teamPlayers = team === 'A' ? teamAPlayers : teamBPlayers;
    const player = teamPlayers.find(p => p.playerId === playerId);
    return player?.role || 'Milieu';
  };

  // Get player name by ID - show "Moi" for self player
  const getPlayerName = (id: string) => {
    if (selfPlayer && id === selfPlayer.id) {
      return selfPlayer.name || 'Moi';
    }
    return players.find(p => p.id === id)?.name || 'Inconnu';
  };

  // Get player IDs from team with roles
  const getTeamPlayerIds = (team: TeamPlayerWithRole[]): string[] => {
    return team.map(p => p.playerId);
  };

  // Clear team players when format changes (if exceeds limit)
  useEffect(() => {
    if (teamAPlayers.length > maxPlayersPerTeam) {
      setTeamAPlayers(prev => prev.slice(0, maxPlayersPerTeam));
    }
    if (teamBPlayers.length > maxPlayersPerTeam) {
      setTeamBPlayers(prev => prev.slice(0, maxPlayersPerTeam));
    }
  }, [maxPlayersPerTeam, teamAPlayers.length, teamBPlayers.length]);

  // Initialize player actions when teams change
  useEffect(() => {
    const allPlayers = [
      ...teamAPlayers.map(p => ({ id: p.playerId, team: 'A' as const })),
      ...teamBPlayers.map(p => ({ id: p.playerId, team: 'B' as const })),
    ];
    
    setPlayerActions(prev => {
      const newActions: PlayerActionState[] = allPlayers.map(({ id, team }) => {
        const existing = prev.find(p => p.playerId === id);
        if (existing) return { ...existing, team };
        return {
          playerId: id,
          playerName: getPlayerName(id),
          team,
          actions: { tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 },
        };
      });
      return newActions;
    });
  }, [teamAPlayers, teamBPlayers]);

  // Record a player action
  const recordAction = useCallback((playerId: string, actionType: ActionType, success: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlayerActions(prev => prev.map(p => {
      if (p.playerId !== playerId) return p;
      const newActions = { ...p.actions };
      if (actionType === 'tir') {
        newActions.tirs++;
        if (success) newActions.tirsSuccess++;
      } else if (actionType === 'point') {
        newActions.points++;
        if (success) newActions.pointsSuccess++;
      } else if (actionType === 'carreau') {
        newActions.tirs++;
        newActions.tirsSuccess++;
        newActions.carreaux++;
      }
      return { ...p, actions: newActions };
    }));
  }, []);

  // Manual update of player action (for manual mode)
  const updatePlayerAction = useCallback((playerId: string, field: keyof PlayerActionState['actions'], value: number) => {
    Haptics.selectionAsync();
    setPlayerActions(prev => prev.map(p => {
      if (p.playerId !== playerId) return p;
      const newActions = { ...p.actions, [field]: Math.max(0, value) };
      // Ensure success <= total
      if (field === 'tirsSuccess' && newActions.tirsSuccess > newActions.tirs) {
        newActions.tirs = newActions.tirsSuccess;
      }
      if (field === 'tirs' && newActions.tirsSuccess > newActions.tirs) {
        newActions.tirsSuccess = newActions.tirs;
      }
      if (field === 'pointsSuccess' && newActions.pointsSuccess > newActions.points) {
        newActions.points = newActions.pointsSuccess;
      }
      if (field === 'points' && newActions.pointsSuccess > newActions.points) {
        newActions.pointsSuccess = newActions.points;
      }
      if (field === 'carreaux' && newActions.carreaux > newActions.tirsSuccess) {
        newActions.tirsSuccess = newActions.carreaux;
        if (newActions.tirs < newActions.tirsSuccess) {
          newActions.tirs = newActions.tirsSuccess;
        }
      }
      return { ...p, actions: newActions };
    }));
  }, []);

  // Get action stats for a player
  const getPlayerActionStats = (playerId: string) => {
    return playerActions.find(p => p.playerId === playerId)?.actions || 
      { tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 };
  };

  // Calculate team action totals
  const getTeamActionTotals = (team: 'A' | 'B') => {
    return playerActions
      .filter(p => p.team === team)
      .reduce((acc, p) => ({
        tirs: acc.tirs + p.actions.tirs,
        tirsSuccess: acc.tirsSuccess + p.actions.tirsSuccess,
        points: acc.points + p.actions.points,
        pointsSuccess: acc.pointsSuccess + p.actions.pointsSuccess,
        carreaux: acc.carreaux + p.actions.carreaux,
      }), { tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 });
  };

  // Timer functions
  const startTimer = useCallback(() => {
    if (!isTimerRunning) {
      setIsTimerRunning(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [isTimerRunning]);

  const pauseTimer = useCallback(() => {
    setIsTimerRunning(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const resetTimer = useCallback(() => {
    Alert.alert(
      'Réinitialiser',
      'Voulez-vous réinitialiser le chronomètre et les mènes ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => {
            setIsTimerRunning(false);
            setMatchTime(0);
            setMeneTime(0);
            setMenes([]);
            setCurrentMenePoints({ teamA: 0, teamB: 0 });
            setIsNullMene(false);
            setTeamAScore(0);
            setTeamBScore(0);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }, []);

  // Timer effect
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setMatchTime(prev => prev + 1);
        setMeneTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle mène point selection
  const handleMenePoint = (team: 'teamA' | 'teamB', points: number) => {
    Haptics.selectionAsync();
    setIsNullMene(false);
    setCurrentMenePoints(prev => ({
      ...prev,
      [team]: prev[team] === points ? 0 : points,
    }));
  };

  // Handle null mène toggle
  const handleNullMene = () => {
    Haptics.selectionAsync();
    setIsNullMene(prev => !prev);
    if (!isNullMene) {
      setCurrentMenePoints({ teamA: 0, teamB: 0 });
    }
  };

  // Validate and add mène
  const addMene = () => {
    if (!isNullMene && currentMenePoints.teamA === 0 && currentMenePoints.teamB === 0) {
      Alert.alert('Erreur', 'Sélectionnez les points ou cochez "Mène nulle"');
      return;
    }
    if (currentMenePoints.teamA > 0 && currentMenePoints.teamB > 0) {
      Alert.alert('Erreur', 'Une seule équipe peut marquer par mène');
      return;
    }

    const newMene: Mene = {
      id: menes.length + 1,
      teamAPoints: currentMenePoints.teamA,
      teamBPoints: currentMenePoints.teamB,
      duration: meneTime,
      isNull: isNullMene,
    };

    setMenes(prev => [...prev, newMene]);
    setTeamAScore(prev => prev + currentMenePoints.teamA);
    setTeamBScore(prev => prev + currentMenePoints.teamB);
    setCurrentMenePoints({ teamA: 0, teamB: 0 });
    setIsNullMene(false);
    setMeneTime(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleScoreChange = (team: 'A' | 'B', delta: number) => {
    Haptics.selectionAsync();
    if (team === 'A') {
      setTeamAScore(prev => Math.max(0, Math.min(maxScore, prev + delta)));
    } else {
      setTeamBScore(prev => Math.max(0, Math.min(maxScore, prev + delta)));
    }
  };

  const handleSaveMatch = () => {
    if (teamAScore === 0 && teamBScore === 0) {
      Alert.alert('Erreur', 'Veuillez entrer un score valide');
      return;
    }

    if (isTournamentMode && !selectedPhase) {
      Alert.alert('Phase requise', 'Veuillez sélectionner la phase du tournoi');
      return;
    }

    // Stop timer if running
    if (isTimerRunning) {
      setIsTimerRunning(false);
    }

    const winner = teamAScore > teamBScore ? 'A' : 'B';
    const duration = matchTime > 0 ? Math.round(matchTime / 60) : Math.floor(Math.random() * 30) + 30;
    
    // Build player names with roles
    const teamAPlayerIds = getTeamPlayerIds(teamAPlayers);
    const teamBPlayerIds = getTeamPlayerIds(teamBPlayers);
    const teamAPlayerNames = teamAPlayers.length > 0 
      ? teamAPlayers.map(p => {
          const player = players.find(pl => pl.id === p.playerId);
          return player?.name || 'Joueur';
        })
      : ['Mon équipe'];
    const teamBPlayerNames = teamBPlayers.length > 0 
      ? teamBPlayers.map(p => {
          const player = players.find(pl => pl.id === p.playerId);
          return player?.name || 'Joueur';
        })
      : ['Adversaire'];
    
    addMatch({
      date: new Date().toISOString(),
      mode: isTournamentMode ? 'Tournoi' : 'Entraînement',
      format,
      tournamentId: linkedTournament?.id,
      tournamentName: linkedTournament?.name,
      tournamentPhase: isTournamentMode ? (selectedPhase || undefined) : undefined,
      tournamentBracket: isTournamentMode && selectedPhase !== 'Poules' ? selectedBracket || undefined : undefined,
      teamA: {
        players: teamAPlayerIds.length > 0 ? teamAPlayerIds : ['1'],
        playerNames: teamAPlayerNames,
        score: teamAScore,
      },
      teamB: {
        players: teamBPlayerIds.length > 0 ? teamBPlayerIds : ['2'],
        playerNames: teamBPlayerNames,
        score: teamBScore,
      },
      winner,
      duration,
      menes: menes.map(m => ({
        teamAPoints: m.teamAPoints,
        teamBPoints: m.teamBPoints,
        duration: m.duration,
      })),
      playerActions: playerActions.length > 0 ? playerActions : undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Nouveau Match</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tournament Info Card (shown when coming from tournament page) */}
          {isTournamentMode && linkedTournament && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.tournamentInfoCard}>
              <View style={styles.tournamentInfoHeader}>
                <View style={styles.tournamentInfoIcon}>
                  <MaterialIcons name="emoji-events" size={24} color={theme.carreauColor} />
                </View>
                <View style={styles.tournamentInfoContent}>
                  <Text style={styles.tournamentInfoName} numberOfLines={1}>{linkedTournament.name}</Text>
                  <Text style={styles.tournamentInfoFormat}>{linkedTournament.format} • {linkedTournament.location.city}</Text>
                </View>
              </View>
              
              {/* Phase Selection - Grid layout */}
              <View style={styles.phaseGrid}>
                <View style={styles.phaseGridHeader}>
                  <Text style={styles.phaseGridLabel}>Phase du tournoi</Text>
                  <View style={styles.cadrageBadge}>
                    <MaterialIcons name="category" size={12} color={theme.primary} />
                    <Text style={styles.cadrageBadgeText}>{linkedTournament.type}</Text>
                  </View>
                </View>
                <View style={styles.phaseGridContainer}>
                  {tournamentPhases.map((phase) => (
                    <Pressable
                      key={phase.id}
                      style={[
                        styles.phaseGridItem,
                        selectedPhase === phase.id && styles.phaseGridItemActive
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedPhase(phase.id);
                        // Reset bracket for certain phases
                        if (phase.id === 'Poules' || phase.id.startsWith('Poule') || phase.id.startsWith('Ronde')) {
                          setSelectedBracket(null);
                        }
                      }}
                    >
                      <Text style={[
                        styles.phaseGridText,
                        selectedPhase === phase.id && styles.phaseGridTextActive
                      ]}>
                        {phase.short}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Bracket Selection (only for certain cadrages and after pools) */}
              {linkedTournament.type === 'Mixte' && selectedPhase && selectedPhase !== 'Poules' && (
                <View style={styles.bracketGrid}>
                  <Text style={styles.bracketGridLabel}>Tableau</Text>
                  <View style={styles.bracketGridContainer}>
                    {TOURNAMENT_BRACKETS.map((bracket) => (
                      <Pressable
                        key={bracket}
                        style={[
                          styles.bracketGridItem,
                          selectedBracket === bracket && styles.bracketGridItemActive
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedBracket(bracket);
                        }}
                      >
                        <Text style={[
                          styles.bracketGridText,
                          selectedBracket === bracket && styles.bracketGridTextActive
                        ]}>
                          {bracket}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* Training Mode Label (shown when NOT in tournament mode) */}
          {!isTournamentMode && (
            <Animated.View entering={FadeInDown.duration(300)} style={isRevanche ? styles.revancheModeCard : styles.trainingModeCard}>
              <MaterialIcons name={isRevanche ? 'sports-mma' : 'fitness-center'} size={24} color={isRevanche ? theme.accent : theme.primary} />
              <View style={styles.trainingModeContent}>
                <Text style={[styles.trainingModeTitle, isRevanche && { color: theme.accent }]}>
                  {isRevanche ? 'Match Revanche !' : "Match d'entraînement"}
                </Text>
                <Text style={styles.trainingModeSubtitle}>
                  {isRevanche 
                    ? 'Même équipes, nouvelle partie' 
                    : 'Pour un match de tournoi, passez par "Mon Parcours"'
                  }
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Format Selection */}
          <Animated.View entering={FadeInDown.duration(300).delay(isTournamentMode ? 100 : 50)} style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>FORMAT</Text>
              {linkedTournament && (
                <View style={styles.formatLockedBadge}>
                  <MaterialIcons name="lock" size={12} color={theme.textSecondary} />
                  <Text style={styles.formatLockedText}>Défini par le tournoi</Text>
                </View>
              )}
            </View>
            <View style={styles.formatContainer}>
              {config.game.formats.map(f => (
                <Pressable
                  key={f}
                  style={[
                    styles.formatButton,
                    format === f && styles.formatButtonActive,
                    linkedTournament && f !== linkedTournament.format && styles.formatButtonDisabled
                  ]}
                  onPress={() => {
                    if (linkedTournament && f !== linkedTournament.format) {
                      return; // Don't allow changing format when tournament is linked
                    }
                    Haptics.selectionAsync();
                    setFormat(f);
                  }}
                  disabled={linkedTournament !== null && f !== linkedTournament.format}
                >
                  <Text style={[
                    styles.formatText,
                    format === f && styles.formatTextActive,
                    linkedTournament && f !== linkedTournament.format && styles.formatTextDisabled
                  ]}>
                    {f}
                  </Text>
                  <Text style={[
                    styles.formatBoules,
                    format === f && styles.formatBoulesActive,
                    linkedTournament && f !== linkedTournament.format && styles.formatBoulesDisabled
                  ]}>
                    {config.game.boulesPerPlayer[f]} boules/joueur
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Team Selection */}
          <Animated.View entering={FadeInDown.duration(300).delay(isTournamentMode ? 150 : 100)} style={styles.section}>
            <Text style={styles.sectionTitle}>ÉQUIPES</Text>
            <View style={styles.teamsContainer}>
              {/* Team A */}
              <View style={styles.teamCard}>
                <View style={styles.teamCardHeader}>
                  <View style={styles.teamCardTitleRow}>
                    <Text style={styles.teamCardTitle}>Mon équipe</Text>
                    {isTournamentMode && tournamentHistory.lastTeamAPlayers.length > 0 && teamAPlayers.length > 0 && (
                      <View style={styles.teamPrefilledBadge}>
                        <MaterialIcons name="history" size={12} color={theme.primary} />
                        <Text style={styles.teamPrefilledText}>Dernier match</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.teamCardCount}>
                    {teamAPlayers.length}/{maxPlayersPerTeam}
                  </Text>
                </View>
                <View style={styles.selectedPlayers}>
                  {teamAPlayers.length > 0 ? (
                    teamAPlayers.map(p => (
                      <View key={p.playerId} style={styles.selectedPlayerCard}>
                        <View style={styles.selectedPlayerHeader}>
                          <Text style={styles.selectedPlayerName} numberOfLines={1}>
                            {getPlayerName(p.playerId)}
                          </Text>
                          {p.playerId === selfPlayer?.id && (
                            <View style={styles.youBadge}>
                              <Text style={styles.youBadgeText}>Vous</Text>
                            </View>
                          )}
                          <Pressable
                            style={styles.removePlayerBtn}
                            onPress={() => togglePlayer(p.playerId, 'A')}
                            hitSlop={8}
                          >
                            <MaterialIcons name="close" size={16} color={theme.textSecondary} />
                          </Pressable>
                        </View>
                        <View style={styles.roleSelector}>
                          {(['Pointeur', 'Milieu', 'Tireur'] as PlayerRoleType[]).map(role => (
                            <Pressable
                              key={role}
                              style={[
                                styles.roleChip,
                                p.role === role && styles.roleChipActiveA
                              ]}
                              onPress={() => updatePlayerRole(p.playerId, 'A', role)}
                            >
                              <MaterialIcons 
                                name={role === 'Tireur' ? 'gps-fixed' : role === 'Pointeur' ? 'radio-button-on' : 'swap-horiz'} 
                                size={12} 
                                color={p.role === role ? '#FFF' : theme.textSecondary} 
                              />
                              <Text style={[
                                styles.roleChipText,
                                p.role === role && styles.roleChipTextActive
                              ]}>
                                {role.charAt(0)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPlayersText}>Aucun joueur</Text>
                  )}
                </View>
                <Pressable
                  style={styles.addPlayerButton}
                  onPress={() => setShowPlayerPicker('A')}
                >
                  <MaterialIcons name="person-add" size={20} color={theme.primary} />
                  <Text style={styles.addPlayerText}>Ajouter joueurs</Text>
                </Pressable>
              </View>

              {/* Team B */}
              <View style={styles.teamCard}>
                <View style={styles.teamCardHeader}>
                  <Text style={styles.teamCardTitle}>Adversaire</Text>
                  <Text style={styles.teamCardCount}>
                    {teamBPlayers.length}/{maxPlayersPerTeam}
                  </Text>
                </View>
                <View style={styles.selectedPlayers}>
                  {teamBPlayers.length > 0 ? (
                    teamBPlayers.map(p => (
                      <View key={p.playerId} style={[styles.selectedPlayerCard, styles.selectedPlayerCardB]}>
                        <View style={styles.selectedPlayerHeader}>
                          <Text style={styles.selectedPlayerName} numberOfLines={1}>
                            {getPlayerName(p.playerId)}
                          </Text>
                          <Pressable
                            style={styles.removePlayerBtn}
                            onPress={() => togglePlayer(p.playerId, 'B')}
                            hitSlop={8}
                          >
                            <MaterialIcons name="close" size={16} color={theme.textSecondary} />
                          </Pressable>
                        </View>
                        <View style={styles.roleSelector}>
                          {(['Pointeur', 'Milieu', 'Tireur'] as PlayerRoleType[]).map(role => (
                            <Pressable
                              key={role}
                              style={[
                                styles.roleChip,
                                p.role === role && styles.roleChipActiveB
                              ]}
                              onPress={() => updatePlayerRole(p.playerId, 'B', role)}
                            >
                              <MaterialIcons 
                                name={role === 'Tireur' ? 'gps-fixed' : role === 'Pointeur' ? 'radio-button-on' : 'swap-horiz'} 
                                size={12} 
                                color={p.role === role ? '#FFF' : theme.textSecondary} 
                              />
                              <Text style={[
                                styles.roleChipText,
                                p.role === role && styles.roleChipTextActive
                              ]}>
                                {role.charAt(0)}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPlayersText}>Aucun joueur</Text>
                  )}
                </View>
                <Pressable
                  style={[styles.addPlayerButton, styles.addPlayerButtonB]}
                  onPress={() => setShowPlayerPicker('B')}
                >
                  <MaterialIcons name="person-add" size={20} color={theme.accent} />
                  <Text style={[styles.addPlayerText, { color: theme.accent }]}>Ajouter joueurs</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>

          {/* Scoring Mode Toggle */}
          <Animated.View entering={FadeInDown.duration(300).delay(isTournamentMode ? 150 : 100)} style={styles.scoringModeSection}>
            <Pressable
              style={[
                styles.scoringModeBtn,
                scoringMode === 'detailed' && styles.scoringModeBtnActive
              ]}
              onPress={() => {
                setScoringMode('detailed');
                setShowActionTracker(false);
              }}
            >
              <MaterialIcons 
                name="format-list-numbered" 
                size={20} 
                color={scoringMode === 'detailed' ? '#FFF' : theme.textSecondary} 
              />
              <View style={styles.scoringModeBtnContent}>
                <Text style={[
                  styles.scoringModeBtnText,
                  scoringMode === 'detailed' && styles.scoringModeBtnTextActive
                ]}>
                  Mènes
                </Text>
                <Text style={[
                  styles.scoringModeBtnDesc,
                  scoringMode === 'detailed' && styles.scoringModeBtnDescActive
                ]}>
                  Score par mène
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={[
                styles.scoringModeBtn,
                scoringMode === 'actions' && styles.scoringModeBtnActiveActions
              ]}
              onPress={() => {
                setScoringMode('actions');
                setShowActionTracker(true);
              }}
            >
              <MaterialIcons 
                name="sports" 
                size={20} 
                color={scoringMode === 'actions' ? '#FFF' : theme.textSecondary} 
              />
              <View style={styles.scoringModeBtnContent}>
                <Text style={[
                  styles.scoringModeBtnText,
                  scoringMode === 'actions' && styles.scoringModeBtnTextActive
                ]}>
                  Tirs / Points
                </Text>
                <Text style={[
                  styles.scoringModeBtnDesc,
                  scoringMode === 'actions' && styles.scoringModeBtnDescActive
                ]}>
                  Suivi détaillé
                </Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* Score Display */}
          <Animated.View entering={FadeInDown.duration(300).delay(isTournamentMode ? 200 : 150)} style={styles.section}>
            <Text style={styles.sectionTitle}>SCORE</Text>
            <View style={styles.scoreContainer}>
              {/* Team A */}
              <View style={styles.teamScore}>
                <Text style={styles.teamLabel}>Mon équipe</Text>
                <View style={styles.scoreControls}>
                  <Pressable 
                    style={styles.scoreButton}
                    onPress={() => handleScoreChange('A', -1)}
                  >
                    <MaterialIcons name="remove" size={28} color={theme.textSecondary} />
                  </Pressable>
                  <Text style={[
                    styles.scoreValue,
                    teamAScore === maxScore && styles.scoreValueWin
                  ]}>
                    {teamAScore}
                  </Text>
                  <Pressable 
                    style={styles.scoreButton}
                    onPress={() => handleScoreChange('A', 1)}
                  >
                    <MaterialIcons name="add" size={28} color={theme.primary} />
                  </Pressable>
                </View>
              </View>

              {/* VS */}
              <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
              </View>

              {/* Team B */}
              <View style={styles.teamScore}>
                <Text style={styles.teamLabel}>Adversaire</Text>
                <View style={styles.scoreControls}>
                  <Pressable 
                    style={styles.scoreButton}
                    onPress={() => handleScoreChange('B', -1)}
                  >
                    <MaterialIcons name="remove" size={28} color={theme.textSecondary} />
                  </Pressable>
                  <Text style={[
                    styles.scoreValue,
                    teamBScore === maxScore && styles.scoreValueWin
                  ]}>
                    {teamBScore}
                  </Text>
                  <Pressable 
                    style={styles.scoreButton}
                    onPress={() => handleScoreChange('B', 1)}
                  >
                    <MaterialIcons name="add" size={28} color={theme.primary} />
                  </Pressable>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Timer Section - Only show in detailed mode or training */}
          {(!isTournamentMode || scoringMode === 'detailed') && (
          <Animated.View entering={FadeInDown.duration(300).delay(isTournamentMode ? 250 : 200)} style={styles.section}>
            <Text style={styles.sectionTitle}>CHRONOMÈTRE</Text>
            <View style={styles.timerCard}>
              {/* Main Timer Display */}
              <View style={styles.timerDisplay}>
                <View style={styles.timerMain}>
                  <MaterialIcons 
                    name="timer" 
                    size={28} 
                    color={isTimerRunning ? theme.primary : theme.textMuted} 
                  />
                  <Text style={[
                    styles.timerValue,
                    isTimerRunning && styles.timerValueActive
                  ]}>
                    {formatTime(matchTime)}
                  </Text>
                </View>
                <View style={styles.timerMene}>
                  <Text style={styles.timerMeneLabel}>Mène actuelle</Text>
                  <Text style={styles.timerMeneValue}>{formatTime(meneTime)}</Text>
                </View>
              </View>

              {/* Timer Controls */}
              <View style={styles.timerControls}>
                {!isTimerRunning ? (
                  <Pressable 
                    style={[styles.timerButton, styles.timerButtonStart]}
                    onPress={startTimer}
                  >
                    <MaterialIcons name="play-arrow" size={28} color="#FFF" />
                    <Text style={styles.timerButtonText}>
                      {matchTime === 0 ? 'Démarrer' : 'Reprendre'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable 
                    style={[styles.timerButton, styles.timerButtonPause]}
                    onPress={pauseTimer}
                  >
                    <MaterialIcons name="pause" size={28} color="#FFF" />
                    <Text style={styles.timerButtonText}>Pause</Text>
                  </Pressable>
                )}
                <Pressable 
                  style={[styles.timerButton, styles.timerButtonReset]}
                  onPress={resetTimer}
                >
                  <MaterialIcons name="refresh" size={24} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>
          </Animated.View>
          )}

          {/* Mène Input Section - Only show in detailed mode or training */}
          {(!isTournamentMode || scoringMode === 'detailed') && (
          <Animated.View entering={FadeInDown.duration(300).delay(isTournamentMode ? 300 : 250)} style={styles.section}>
            <Text style={styles.sectionTitle}>POINTS DE LA MÈNE</Text>
            <View style={styles.meneInputCard}>
              <View style={styles.meneTeamRow}>
                <Text style={styles.meneTeamLabel}>Mon équipe</Text>
                <View style={styles.menePointsRow}>
                  {[1, 2, 3, 4, 5, 6].map(points => (
                    <Pressable
                      key={`A-${points}`}
                      style={[
                        styles.menePointButton,
                        currentMenePoints.teamA === points && styles.menePointButtonActiveA
                      ]}
                      onPress={() => handleMenePoint('teamA', points)}
                    >
                      <Text style={[
                        styles.menePointText,
                        currentMenePoints.teamA === points && styles.menePointTextActive
                      ]}>
                        {points}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.meneDivider} />
              <View style={styles.meneTeamRow}>
                <Text style={styles.meneTeamLabel}>Adversaire</Text>
                <View style={styles.menePointsRow}>
                  {[1, 2, 3, 4, 5, 6].map(points => (
                    <Pressable
                      key={`B-${points}`}
                      style={[
                        styles.menePointButton,
                        currentMenePoints.teamB === points && styles.menePointButtonActiveB
                      ]}
                      onPress={() => handleMenePoint('teamB', points)}
                    >
                      <Text style={[
                        styles.menePointText,
                        currentMenePoints.teamB === points && styles.menePointTextActive
                      ]}>
                        {points}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable 
                style={[
                  styles.nullMeneButton,
                  isNullMene && styles.nullMeneButtonActive
                ]}
                onPress={handleNullMene}
              >
                <MaterialIcons 
                  name={isNullMene ? 'check-box' : 'check-box-outline-blank'} 
                  size={20} 
                  color={isNullMene ? theme.warning : theme.textSecondary} 
                />
                <Text style={[
                  styles.nullMeneText,
                  isNullMene && styles.nullMeneTextActive
                ]}>
                  Mène nulle (cochonnet sorti)
                </Text>
              </Pressable>
              <Pressable 
                style={[
                  styles.addMeneButton,
                  (!isNullMene && currentMenePoints.teamA === 0 && currentMenePoints.teamB === 0) && styles.addMeneButtonDisabled
                ]}
                onPress={addMene}
              >
                <MaterialIcons name="add" size={20} color="#FFF" />
                <Text style={styles.addMeneButtonText}>Valider la mène</Text>
              </Pressable>
            </View>
          </Animated.View>
          )}

          {/* Mènes History */}
          {menes.length > 0 && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
              <Text style={styles.sectionTitle}>MÈNES ({menes.length})</Text>
              <View style={styles.menesHistoryCard}>
                <View style={styles.menesHeader}>
                  <Text style={styles.menesHeaderCell}>#</Text>
                  <Text style={styles.menesHeaderCell}>MON ÉQ.</Text>
                  <Text style={styles.menesHeaderCell}>ADV.</Text>
                  <Text style={styles.menesHeaderCell}>DURÉE</Text>
                </View>
                {menes.map((mene) => (
                  <View key={mene.id} style={styles.meneRow}>
                    <Text style={styles.meneCell}>{mene.id}</Text>
                    <Text style={[
                      styles.meneCell,
                      mene.teamAPoints > 0 && styles.meneCellWin,
                      mene.isNull && styles.meneCellNull
                    ]}>
                      {mene.isNull ? '⊘' : mene.teamAPoints > 0 ? `+${mene.teamAPoints}` : '-'}
                    </Text>
                    <Text style={[
                      styles.meneCell,
                      mene.teamBPoints > 0 && styles.meneCellLoss,
                      mene.isNull && styles.meneCellNull
                    ]}>
                      {mene.isNull ? '⊘' : mene.teamBPoints > 0 ? `+${mene.teamBPoints}` : '-'}
                    </Text>
                    <Text style={styles.meneCellTime}>{formatTime(mene.duration)}</Text>
                  </View>
                ))}
                <View style={styles.menesTotalRow}>
                  <Text style={styles.menesTotalLabel}>Total</Text>
                  <Text style={[styles.menesTotalValue, { color: theme.primary }]}>{teamAScore}</Text>
                  <Text style={[styles.menesTotalValue, { color: theme.accent }]}>{teamBScore}</Text>
                  <Text style={styles.menesTotalTime}>{formatTime(matchTime)}</Text>
                </View>
              </View>
            </Animated.View>
          )}





          {/* Action Tracker Panel */}
          {scoringMode === 'actions' && (
            <Animated.View entering={FadeInDown.duration(300).delay(isTournamentMode ? 250 : 200)} style={styles.section}>
              {/* Info banner when no players selected */}
              {getTeamPlayerIds(teamAPlayers).length === 0 && getTeamPlayerIds(teamBPlayers).length === 0 && (
                <View style={styles.actionTrackerEmptyBanner}>
                  <MaterialIcons name="info-outline" size={24} color={theme.primary} />
                  <View style={styles.actionTrackerEmptyContent}>
                    <Text style={styles.actionTrackerEmptyTitle}>Ajoutez des joueurs</Text>
                    <Text style={styles.actionTrackerEmptyText}>Sélectionnez des joueurs dans les équipes pour suivre leurs actions</Text>
                  </View>
                </View>
              )}
              
              {(getTeamPlayerIds(teamAPlayers).length > 0 || getTeamPlayerIds(teamBPlayers).length > 0) && (
              <View style={styles.actionTrackerPanel}>
                {/* Mode Toggle */}
                <View style={styles.actionModeToggle}>
                  <Pressable
                    style={[
                      styles.actionModeBtn,
                      !manualActionMode && styles.actionModeBtnActive
                    ]}
                    onPress={() => setManualActionMode(false)}
                  >
                    <MaterialIcons 
                      name="touch-app" 
                      size={18} 
                      color={!manualActionMode ? '#FFF' : theme.textSecondary} 
                    />
                    <Text style={[
                      styles.actionModeBtnText,
                      !manualActionMode && styles.actionModeBtnTextActive
                    ]}>
                      Temps réel
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.actionModeBtn,
                      manualActionMode && styles.actionModeBtnActive
                    ]}
                    onPress={() => setManualActionMode(true)}
                  >
                    <MaterialIcons 
                      name="edit" 
                      size={18} 
                      color={manualActionMode ? '#FFF' : theme.textSecondary} 
                    />
                    <Text style={[
                      styles.actionModeBtnText,
                      manualActionMode && styles.actionModeBtnTextActive
                    ]}>
                      Manuel
                    </Text>
                  </Pressable>
                </View>
                {/* Team A Actions */}
                {getTeamPlayerIds(teamAPlayers).length > 0 && (
                  <View style={styles.actionTeamSection}>
                    <View style={styles.actionTeamHeader}>
                      <View style={[styles.actionTeamDot, { backgroundColor: theme.primary }]} />
                      <Text style={styles.actionTeamTitle}>Mon équipe</Text>
                      <View style={styles.actionTeamStats}>
                        <Text style={styles.actionTeamStatText}>
                          T: {getTeamActionTotals('A').tirsSuccess}/{getTeamActionTotals('A').tirs}
                        </Text>
                        <Text style={styles.actionTeamStatText}>
                          P: {getTeamActionTotals('A').pointsSuccess}/{getTeamActionTotals('A').points}
                        </Text>
                      </View>
                    </View>
                    {getTeamPlayerIds(teamAPlayers).map(playerId => {
                      const stats = getPlayerActionStats(playerId);
                      const tirRate = stats.tirs > 0 ? Math.round((stats.tirsSuccess / stats.tirs) * 100) : 0;
                      const pointRate = stats.points > 0 ? Math.round((stats.pointsSuccess / stats.points) * 100) : 0;
                      return (
                        <View key={playerId} style={styles.actionPlayerRow}>
                          <View style={styles.actionPlayerInfo}>
                            <Text style={styles.actionPlayerName} numberOfLines={1}>
                              {getPlayerName(playerId)}
                            </Text>
                            <View style={styles.actionPlayerStats}>
                              {stats.tirs > 0 && (
                                <View style={styles.actionMiniStat}>
                                  <MaterialIcons name="gps-fixed" size={12} color={theme.accent} />
                                  <Text style={styles.actionMiniStatText}>{tirRate}%</Text>
                                </View>
                              )}
                              {stats.points > 0 && (
                                <View style={styles.actionMiniStat}>
                                  <MaterialIcons name="adjust" size={12} color={theme.primary} />
                                  <Text style={styles.actionMiniStatText}>{pointRate}%</Text>
                                </View>
                              )}
                              {stats.carreaux > 0 && (
                                <View style={styles.actionMiniStat}>
                                  <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
                                  <Text style={styles.actionMiniStatText}>{stats.carreaux}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {manualActionMode ? (
                            <View style={styles.manualInputRow}>
                              <View style={styles.manualInputGroup}>
                                <Text style={styles.manualInputLabel}>Tirs</Text>
                                <View style={styles.manualInputControls}>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'tirsSuccess', stats.tirsSuccess - 1)}
                                  >
                                    <MaterialIcons name="remove" size={16} color={theme.textSecondary} />
                                  </Pressable>
                                  <Text style={styles.manualInputValue}>{stats.tirsSuccess}/{stats.tirs}</Text>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'tirsSuccess', stats.tirsSuccess + 1)}
                                  >
                                    <MaterialIcons name="add" size={16} color={theme.success} />
                                  </Pressable>
                                  <Pressable
                                    style={[styles.manualInputBtn, { marginLeft: 4 }]}
                                    onPress={() => updatePlayerAction(playerId, 'tirs', stats.tirs + 1)}
                                  >
                                    <MaterialIcons name="add-circle-outline" size={16} color={theme.error} />
                                  </Pressable>
                                </View>
                              </View>
                              <View style={styles.manualInputGroup}>
                                <Text style={styles.manualInputLabel}>Points</Text>
                                <View style={styles.manualInputControls}>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'pointsSuccess', stats.pointsSuccess - 1)}
                                  >
                                    <MaterialIcons name="remove" size={16} color={theme.textSecondary} />
                                  </Pressable>
                                  <Text style={styles.manualInputValue}>{stats.pointsSuccess}/{stats.points}</Text>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'pointsSuccess', stats.pointsSuccess + 1)}
                                  >
                                    <MaterialIcons name="add" size={16} color={theme.success} />
                                  </Pressable>
                                  <Pressable
                                    style={[styles.manualInputBtn, { marginLeft: 4 }]}
                                    onPress={() => updatePlayerAction(playerId, 'points', stats.points + 1)}
                                  >
                                    <MaterialIcons name="add-circle-outline" size={16} color={theme.error} />
                                  </Pressable>
                                </View>
                              </View>
                              <View style={styles.manualInputGroup}>
                                <Text style={styles.manualInputLabel}>Carr.</Text>
                                <View style={styles.manualInputControls}>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'carreaux', stats.carreaux - 1)}
                                  >
                                    <MaterialIcons name="remove" size={16} color={theme.textSecondary} />
                                  </Pressable>
                                  <Text style={[styles.manualInputValue, { color: theme.carreauColor }]}>{stats.carreaux}</Text>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'carreaux', stats.carreaux + 1)}
                                  >
                                    <MaterialIcons name="add" size={16} color={theme.carreauColor} />
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          ) : (
                            <View style={styles.actionButtons}>
                              <Pressable
                                style={[styles.actionBtn, styles.actionBtnTir]}
                                onPress={() => recordAction(playerId, 'tir', true)}
                                onLongPress={() => recordAction(playerId, 'tir', false)}
                              >
                                <MaterialIcons name="gps-fixed" size={18} color="#FFF" />
                              </Pressable>
                              <Pressable
                                style={[styles.actionBtn, styles.actionBtnPoint]}
                                onPress={() => recordAction(playerId, 'point', true)}
                                onLongPress={() => recordAction(playerId, 'point', false)}
                              >
                                <MaterialIcons name="adjust" size={18} color="#FFF" />
                              </Pressable>
                              <Pressable
                                style={[styles.actionBtn, styles.actionBtnCarreau]}
                                onPress={() => recordAction(playerId, 'carreau', true)}
                              >
                                <MaterialIcons name="stars" size={18} color="#FFF" />
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Divider */}
                {getTeamPlayerIds(teamAPlayers).length > 0 && getTeamPlayerIds(teamBPlayers).length > 0 && (
                  <View style={styles.actionDivider} />
                )}

                {/* Team B Actions */}
                {getTeamPlayerIds(teamBPlayers).length > 0 && (
                  <View style={styles.actionTeamSection}>
                    <View style={styles.actionTeamHeader}>
                      <View style={[styles.actionTeamDot, { backgroundColor: theme.accent }]} />
                      <Text style={styles.actionTeamTitle}>Adversaire</Text>
                      <View style={styles.actionTeamStats}>
                        <Text style={styles.actionTeamStatText}>
                          T: {getTeamActionTotals('B').tirsSuccess}/{getTeamActionTotals('B').tirs}
                        </Text>
                        <Text style={styles.actionTeamStatText}>
                          P: {getTeamActionTotals('B').pointsSuccess}/{getTeamActionTotals('B').points}
                        </Text>
                      </View>
                    </View>
                    {getTeamPlayerIds(teamBPlayers).map(playerId => {
                      const stats = getPlayerActionStats(playerId);
                      const tirRate = stats.tirs > 0 ? Math.round((stats.tirsSuccess / stats.tirs) * 100) : 0;
                      const pointRate = stats.points > 0 ? Math.round((stats.pointsSuccess / stats.points) * 100) : 0;
                      return (
                        <View key={playerId} style={styles.actionPlayerRow}>
                          <View style={styles.actionPlayerInfo}>
                            <Text style={styles.actionPlayerName} numberOfLines={1}>
                              {getPlayerName(playerId)}
                            </Text>
                            <View style={styles.actionPlayerStats}>
                              {stats.tirs > 0 && (
                                <View style={styles.actionMiniStat}>
                                  <MaterialIcons name="gps-fixed" size={12} color={theme.accent} />
                                  <Text style={styles.actionMiniStatText}>{tirRate}%</Text>
                                </View>
                              )}
                              {stats.points > 0 && (
                                <View style={styles.actionMiniStat}>
                                  <MaterialIcons name="adjust" size={12} color={theme.primary} />
                                  <Text style={styles.actionMiniStatText}>{pointRate}%</Text>
                                </View>
                              )}
                              {stats.carreaux > 0 && (
                                <View style={styles.actionMiniStat}>
                                  <MaterialIcons name="stars" size={12} color={theme.carreauColor} />
                                  <Text style={styles.actionMiniStatText}>{stats.carreaux}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {manualActionMode ? (
                            <View style={styles.manualInputRow}>
                              <View style={styles.manualInputGroup}>
                                <Text style={styles.manualInputLabel}>Tirs</Text>
                                <View style={styles.manualInputControls}>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'tirsSuccess', stats.tirsSuccess - 1)}
                                  >
                                    <MaterialIcons name="remove" size={16} color={theme.textSecondary} />
                                  </Pressable>
                                  <Text style={styles.manualInputValue}>{stats.tirsSuccess}/{stats.tirs}</Text>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'tirsSuccess', stats.tirsSuccess + 1)}
                                  >
                                    <MaterialIcons name="add" size={16} color={theme.success} />
                                  </Pressable>
                                  <Pressable
                                    style={[styles.manualInputBtn, { marginLeft: 4 }]}
                                    onPress={() => updatePlayerAction(playerId, 'tirs', stats.tirs + 1)}
                                  >
                                    <MaterialIcons name="add-circle-outline" size={16} color={theme.error} />
                                  </Pressable>
                                </View>
                              </View>
                              <View style={styles.manualInputGroup}>
                                <Text style={styles.manualInputLabel}>Points</Text>
                                <View style={styles.manualInputControls}>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'pointsSuccess', stats.pointsSuccess - 1)}
                                  >
                                    <MaterialIcons name="remove" size={16} color={theme.textSecondary} />
                                  </Pressable>
                                  <Text style={styles.manualInputValue}>{stats.pointsSuccess}/{stats.points}</Text>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'pointsSuccess', stats.pointsSuccess + 1)}
                                  >
                                    <MaterialIcons name="add" size={16} color={theme.success} />
                                  </Pressable>
                                  <Pressable
                                    style={[styles.manualInputBtn, { marginLeft: 4 }]}
                                    onPress={() => updatePlayerAction(playerId, 'points', stats.points + 1)}
                                  >
                                    <MaterialIcons name="add-circle-outline" size={16} color={theme.error} />
                                  </Pressable>
                                </View>
                              </View>
                              <View style={styles.manualInputGroup}>
                                <Text style={styles.manualInputLabel}>Carr.</Text>
                                <View style={styles.manualInputControls}>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'carreaux', stats.carreaux - 1)}
                                  >
                                    <MaterialIcons name="remove" size={16} color={theme.textSecondary} />
                                  </Pressable>
                                  <Text style={[styles.manualInputValue, { color: theme.carreauColor }]}>{stats.carreaux}</Text>
                                  <Pressable
                                    style={styles.manualInputBtn}
                                    onPress={() => updatePlayerAction(playerId, 'carreaux', stats.carreaux + 1)}
                                  >
                                    <MaterialIcons name="add" size={16} color={theme.carreauColor} />
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          ) : (
                            <View style={styles.actionButtons}>
                              <Pressable
                                style={[styles.actionBtn, styles.actionBtnTir]}
                                onPress={() => recordAction(playerId, 'tir', true)}
                                onLongPress={() => recordAction(playerId, 'tir', false)}
                              >
                                <MaterialIcons name="gps-fixed" size={18} color="#FFF" />
                              </Pressable>
                              <Pressable
                                style={[styles.actionBtn, styles.actionBtnPoint]}
                                onPress={() => recordAction(playerId, 'point', true)}
                                onLongPress={() => recordAction(playerId, 'point', false)}
                              >
                                <MaterialIcons name="adjust" size={18} color="#FFF" />
                              </Pressable>
                              <Pressable
                                style={[styles.actionBtn, styles.actionBtnCarreau]}
                                onPress={() => recordAction(playerId, 'carreau', true)}
                              >
                                <MaterialIcons name="stars" size={18} color="#FFF" />
                              </Pressable>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Legend */}
                {!manualActionMode && (
                  <View style={styles.actionLegend}>
                    <Text style={styles.actionLegendTitle}>Légende :</Text>
                    <View style={styles.actionLegendRow}>
                      <View style={styles.actionLegendItem}>
                        <MaterialIcons name="gps-fixed" size={14} color={theme.accent} />
                        <Text style={styles.actionLegendText}>Tir (long = raté)</Text>
                      </View>
                      <View style={styles.actionLegendItem}>
                        <MaterialIcons name="adjust" size={14} color={theme.primary} />
                        <Text style={styles.actionLegendText}>Point (long = raté)</Text>
                      </View>
                      <View style={styles.actionLegendItem}>
                        <MaterialIcons name="stars" size={14} color={theme.carreauColor} />
                        <Text style={styles.actionLegendText}>Carreau</Text>
                      </View>
                    </View>
                  </View>
                )}
                {manualActionMode && (
                  <View style={styles.actionLegend}>
                    <Text style={styles.actionLegendTitle}>Mode manuel :</Text>
                    <View style={styles.actionLegendRow}>
                      <View style={styles.actionLegendItem}>
                        <MaterialIcons name="add" size={14} color={theme.success} />
                        <Text style={styles.actionLegendText}>Ajouter réussi</Text>
                      </View>
                      <View style={styles.actionLegendItem}>
                        <MaterialIcons name="add-circle-outline" size={14} color={theme.error} />
                        <Text style={styles.actionLegendText}>Ajouter raté</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
              )}
            </Animated.View>
          )}

          {/* Winner Indicator */}
          {(teamAScore > 0 || teamBScore > 0) && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.winnerCard}>
              <MaterialIcons 
                name={teamAScore > teamBScore ? 'emoji-events' : teamBScore > teamAScore ? 'sentiment-dissatisfied' : 'drag-handle'} 
                size={32} 
                color={teamAScore > teamBScore ? theme.success : teamBScore > teamAScore ? theme.error : theme.textMuted} 
              />
              <Text style={[
                styles.winnerText,
                { color: teamAScore > teamBScore ? theme.success : teamBScore > teamAScore ? theme.error : theme.textMuted }
              ]}>
                {teamAScore > teamBScore 
                  ? 'Victoire !' 
                  : teamBScore > teamAScore 
                    ? 'Défaite' 
                    : 'Égalité'}
              </Text>
            </Animated.View>
          )}
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable 
            style={[
              styles.saveButton,
              (teamAScore === 0 && teamBScore === 0) && styles.saveButtonDisabled
            ]}
            onPress={handleSaveMatch}
          >
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>Enregistrer le match</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {/* Player Picker Modal */}
      <Modal
        visible={showPlayerPicker !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowPlayerPicker(null);
          setPlayerSearch('');
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => {
                setShowPlayerPicker(null);
                setPlayerSearch('');
              }}
            >
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {showPlayerPicker === 'A' ? 'Mon équipe' : 'Adversaire'}
            </Text>
            <Pressable
              style={styles.modalDoneBtn}
              onPress={() => {
                setShowPlayerPicker(null);
                setPlayerSearch('');
              }}
            >
              <Text style={styles.modalDoneText}>OK</Text>
            </Pressable>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={playerSearch}
              onChangeText={setPlayerSearch}
              placeholder="Rechercher un joueur..."
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {playerSearch.length > 0 && (
              <Pressable onPress={() => setPlayerSearch('')}>
                <MaterialIcons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Selected count */}
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionInfoText}>
              {showPlayerPicker === 'A' ? teamAPlayers.length : teamBPlayers.length} / {maxPlayersPerTeam} sélectionné(s)
            </Text>
          </View>

          {/* Players List */}
          <ScrollView
            style={styles.playersList}
            contentContainerStyle={styles.playersListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* "Moi" card at top for Team A */}
            {showPlayerPicker === 'A' && selfPlayer && (
              <Pressable
                style={[
                  styles.selfPlayerCardModal,
                  teamAPlayers.some(p => p.playerId === selfPlayer.id) && styles.selfPlayerCardModalSelected,
                ]}
                onPress={() => togglePlayer(selfPlayer.id, 'A')}
              >
                <View style={[
                  styles.selfPlayerAvatar,
                  teamAPlayers.some(p => p.playerId === selfPlayer.id) && styles.selfPlayerAvatarSelected,
                ]}>
                  <Text style={styles.selfPlayerAvatarText}>
                    {selfPlayer.name?.charAt(0).toUpperCase() || 'M'}
                  </Text>
                </View>
                <View style={styles.selfPlayerInfo}>
                  <View style={styles.selfPlayerNameRow}>
                    <Text style={styles.selfPlayerName}>{selfPlayer.name || 'Moi'}</Text>
                    <View style={styles.moiBadge}>
                      <Text style={styles.moiBadgeText}>MOI</Text>
                    </View>
                  </View>
                  <Text style={styles.selfPlayerMeta}>
                    {selfPlayer.role} • {selfPlayer.level}
                    {selfPlayer.club ? ` • ${selfPlayer.club}` : ''}
                  </Text>
                </View>
                {teamAPlayers.some(p => p.playerId === selfPlayer.id) ? (
                  <MaterialIcons name="check-circle" size={24} color={theme.primary} />
                ) : (
                  <MaterialIcons name="radio-button-unchecked" size={24} color={theme.border} />
                )}
              </Pressable>
            )}

            {/* Create new opponent button - only for Team B */}
            {showPlayerPicker === 'B' && (
              <Pressable
                style={styles.createOpponentButton}
                onPress={() => {
                  setShowPlayerPicker(null);
                  setPlayerSearch('');
                  router.push('/player/new');
                }}
              >
                <View style={styles.createOpponentIcon}>
                  <MaterialIcons name="person-add" size={24} color={theme.accent} />
                </View>
                <View style={styles.createOpponentInfo}>
                  <Text style={styles.createOpponentTitle}>Créer un adversaire</Text>
                  <Text style={styles.createOpponentSubtitle}>Ajouter un nouveau joueur</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            )}

            {filteredPlayers
              .filter(player => !(showPlayerPicker === 'A' && selfPlayer && player.id === selfPlayer.id))
              .map(player => {
              const isSelectedA = teamAPlayers.some(p => p.playerId === player.id);
              const isSelectedB = teamBPlayers.some(p => p.playerId === player.id);
              const isInOtherTeam = showPlayerPicker === 'A' ? isSelectedB : isSelectedA;
              const isSelected = showPlayerPicker === 'A' ? isSelectedA : isSelectedB;

              return (
                <Pressable
                  key={player.id}
                  style={[
                    styles.playerPickerItem,
                    isSelected && styles.playerPickerItemSelected,
                    isInOtherTeam && styles.playerPickerItemDisabled,
                  ]}
                  onPress={() => !isInOtherTeam && togglePlayer(player.id, showPlayerPicker!)}
                  disabled={isInOtherTeam}
                >
                  <View style={[
                    styles.playerPickerAvatar,
                    isSelected && (showPlayerPicker === 'A' 
                      ? { backgroundColor: theme.primary }
                      : { backgroundColor: theme.accent }
                    ),
                    isInOtherTeam && { backgroundColor: theme.textMuted },
                  ]}>
                    <Text style={styles.playerPickerInitials}>
                      {player.name.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View style={styles.playerPickerInfo}>
                    <View style={styles.playerPickerNameRow}>
                      <Text style={[
                        styles.playerPickerName,
                        isInOtherTeam && { color: theme.textMuted },
                      ]}>
                        {player.name}
                      </Text>
                      {player.id === selfPlayer?.id && (
                        <View style={styles.youBadgeSmall}>
                          <Text style={styles.youBadgeSmallText}>Vous</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.playerPickerMeta}>
                      {player.role} • {player.level}
                      {player.club ? ` • ${player.club}` : ''}
                    </Text>
                  </View>
                  <View style={styles.playerPickerCheck}>
                    {isSelected ? (
                      <MaterialIcons 
                        name="check-circle" 
                        size={24} 
                        color={showPlayerPicker === 'A' ? theme.primary : theme.accent} 
                      />
                    ) : isInOtherTeam ? (
                      <Text style={styles.otherTeamLabel}>Autre équipe</Text>
                    ) : (
                      <MaterialIcons name="radio-button-unchecked" size={24} color={theme.border} />
                    )}
                  </View>
                </Pressable>
              );
            })}

            {filteredPlayers.length === 0 && (
              <View style={styles.emptySearch}>
                <MaterialIcons name="search-off" size={48} color={theme.textMuted} />
                <Text style={styles.emptySearchText}>Aucun joueur trouvé</Text>
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
  closeButton: {
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
  section: {
    marginBottom: 20,
  },
  // Tournament info card styles
  tournamentInfoCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    ...theme.shadows.card,
  },
  tournamentInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tournamentInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.carreauColor + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tournamentInfoContent: {
    flex: 1,
  },
  tournamentInfoName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  tournamentInfoFormat: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  // Phase grid styles
  phaseGrid: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  phaseGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  phaseGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  cadrageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  cadrageBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.primary,
  },
  phaseGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  phaseGridItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  phaseGridItemActive: {
    backgroundColor: theme.carreauColor,
    borderColor: theme.carreauColor,
  },
  phaseGridText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  phaseGridTextActive: {
    color: '#FFF',
  },
  // Bracket grid styles
  bracketGrid: {
    marginTop: 12,
  },
  bracketGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 10,
  },
  bracketGridContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  bracketGridItem: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bracketGridItemActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  bracketGridText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  bracketGridTextActive: {
    color: '#FFF',
  },
  // Scoring mode toggle
  scoringModeSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  scoringModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.border,
    ...theme.shadows.card,
  },
  scoringModeBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  scoringModeBtnActiveActions: {
    backgroundColor: theme.tirColor,
    borderColor: theme.tirColor,
  },
  scoringModeBtnContent: {
    flex: 1,
  },
  scoringModeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  scoringModeBtnTextActive: {
    color: '#FFF',
  },
  scoringModeBtnDesc: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  scoringModeBtnDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  // Action tracker empty state
  actionTrackerEmptyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.primary + '25',
    gap: 14,
  },
  actionTrackerEmptyContent: {
    flex: 1,
  },
  actionTrackerEmptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.primary,
    marginBottom: 2,
  },
  actionTrackerEmptyText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  // Training mode card
  trainingModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  trainingModeContent: {
    flex: 1,
    marginLeft: 14,
  },
  trainingModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
    marginBottom: 2,
  },
  trainingModeSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  // Revanche mode card
  revancheModeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent + '10',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.accent + '30',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 12,
  },



  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  formatLockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.backgroundSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  formatLockedText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  formatButtonDisabled: {
    opacity: 0.4,
  },
  formatTextDisabled: {
    color: theme.textMuted,
  },
  formatBoulesDisabled: {
    color: theme.textMuted,
  },
  // Timer styles
  timerCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  timerDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  timerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerValue: {
    fontSize: 42,
    fontWeight: '700',
    color: theme.textMuted,
    fontVariant: ['tabular-nums'],
  },
  timerValueActive: {
    color: theme.primary,
  },
  timerMene: {
    alignItems: 'flex-end',
  },
  timerMeneLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  timerMeneValue: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  timerControls: {
    flexDirection: 'row',
    gap: 12,
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
  },
  timerButtonStart: {
    flex: 1,
    backgroundColor: theme.success,
  },
  timerButtonPause: {
    flex: 1,
    backgroundColor: theme.warning,
  },
  timerButtonReset: {
    width: 52,
    backgroundColor: theme.backgroundSecondary,
  },
  timerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  formatContainer: {
    gap: 10,
  },
  formatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...theme.shadows.card,
  },
  formatButtonActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  formatText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  formatTextActive: {
    color: theme.primary,
  },
  formatBoules: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  formatBoulesActive: {
    color: theme.primary,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    ...theme.shadows.card,
  },
  teamScore: {
    flex: 1,
    alignItems: 'center',
  },
  teamLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 16,
  },
  scoreControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 24,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: theme.textPrimary,
    width: 70,
    textAlign: 'center',
  },
  scoreValueWin: {
    color: theme.success,
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textMuted,
  },
  // Mène input styles
  meneInputCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  meneTeamRow: {
    marginBottom: 8,
  },
  meneTeamLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 10,
  },
  menePointsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  menePointButton: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  menePointButtonActiveA: {
    backgroundColor: theme.primary + '15',
    borderColor: theme.primary,
  },
  menePointButtonActiveB: {
    backgroundColor: theme.accent + '15',
    borderColor: theme.accent,
  },
  menePointText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  menePointTextActive: {
    color: theme.textPrimary,
  },
  meneDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 12,
  },
  addMeneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    marginTop: 16,
  },
  addMeneButtonDisabled: {
    backgroundColor: theme.textMuted,
  },
  addMeneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  nullMeneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    marginTop: 12,
  },
  nullMeneButtonActive: {
    backgroundColor: theme.warning + '15',
  },
  nullMeneText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  nullMeneTextActive: {
    color: theme.warning,
    fontWeight: '600',
  },
  // Mènes history styles
  menesHistoryCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  menesHeader: {
    flexDirection: 'row',
    backgroundColor: theme.backgroundSecondary,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  menesHeaderCell: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
  },
  meneRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  meneCell: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: theme.textSecondary,
    textAlign: 'center',
  },
  meneCellWin: {
    color: theme.success,
    fontWeight: '700',
  },
  meneCellLoss: {
    color: theme.error,
    fontWeight: '700',
  },
  meneCellNull: {
    color: theme.warning,
    fontWeight: '600',
  },
  meneCellTime: {
    flex: 1,
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
  },
  menesTotalRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.backgroundSecondary,
  },
  menesTotalLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
  },
  menesTotalValue: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  menesTotalTime: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    textAlign: 'center',
  },
  winnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: theme.surface,
    paddingVertical: 20,
    borderRadius: theme.borderRadius.lg,
    marginTop: 8,
    ...theme.shadows.card,
  },
  winnerText: {
    fontSize: 20,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: theme.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: theme.borderRadius.md,
  },
  saveButtonDisabled: {
    backgroundColor: theme.textMuted,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  // Team selection styles
  teamsContainer: {
    gap: 12,
  },
  teamCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  teamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  teamPrefilledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  teamPrefilledText: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.primary,
  },
  teamCardCount: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  selectedPlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minHeight: 36,
    marginBottom: 12,
  },
  selectedPlayerCard: {
    backgroundColor: theme.primary + '08',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.primary + '25',
    width: '100%',
  },
  selectedPlayerCardB: {
    backgroundColor: theme.accent + '08',
    borderColor: theme.accent + '25',
  },
  selectedPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedPlayerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
  },
  roleChipActiveA: {
    backgroundColor: theme.primary,
  },
  roleChipActiveB: {
    backgroundColor: theme.accent,
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  roleChipTextActive: {
    color: '#FFF',
  },
  youBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginLeft: 4,
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  removePlayerBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 12,
  },
  noPlayersText: {
    fontSize: 14,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  addPlayerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary + '10',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.primary + '30',
    borderStyle: 'dashed',
  },
  addPlayerButtonB: {
    backgroundColor: theme.accent + '10',
    borderColor: theme.accent + '30',
  },
  addPlayerText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
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
  modalDoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.primary,
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
  selectionInfo: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectionInfoText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  playersList: {
    flex: 1,
  },
  playersListContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  playerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: 8,
    ...theme.shadows.card,
  },
  playerPickerItemSelected: {
    borderWidth: 2,
    borderColor: theme.primary,
  },
  playerPickerItemDisabled: {
    opacity: 0.5,
  },
  playerPickerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playerPickerInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  playerPickerInfo: {
    flex: 1,
  },
  playerPickerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerPickerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  youBadgeSmall: {
    backgroundColor: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  youBadgeSmallText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
  playerPickerMeta: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  playerPickerCheck: {
    marginLeft: 8,
  },
  otherTeamLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  // Action tracker styles
  actionTrackerPanel: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    ...theme.shadows.card,
  },
  actionTeamSection: {
    marginBottom: 8,
  },
  actionTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTeamDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  actionTeamTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  actionTeamStats: {
    flexDirection: 'row',
    gap: 12,
  },
  actionTeamStatText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  actionPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 8,
  },
  actionPlayerInfo: {
    flex: 1,
    marginRight: 8,
  },
  actionPlayerName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  actionPlayerStats: {
    flexDirection: 'row',
    gap: 8,
  },
  actionMiniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionMiniStatText: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTir: {
    backgroundColor: theme.accent,
  },
  actionBtnPoint: {
    backgroundColor: theme.primary,
  },
  actionBtnCarreau: {
    backgroundColor: theme.carreauColor,
  },
  actionDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 12,
  },
  actionLegend: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  actionLegendTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 8,
  },
  actionLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionLegendText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  // Action mode toggle
  actionModeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
  },
  actionModeBtnActive: {
    backgroundColor: theme.primary,
  },
  actionModeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  actionModeBtnTextActive: {
    color: '#FFF',
  },
  // Manual input styles
  manualInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInputGroup: {
    alignItems: 'center',
  },
  manualInputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 4,
  },
  manualInputControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  manualInputBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  manualInputValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptySearchText: {
    fontSize: 15,
    color: theme.textMuted,
    marginTop: 12,
  },
  // Create opponent button
  createOpponentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent + '10',
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.accent + '30',
    borderStyle: 'dashed',
  },
  createOpponentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  createOpponentInfo: {
    flex: 1,
  },
  createOpponentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accent,
  },
  createOpponentSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  // Self player "Moi" card styles
  selfPlayerCardModal: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '08',
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: theme.primary + '30',
  },
  selfPlayerCardModalSelected: {
    backgroundColor: theme.primary + '15',
    borderColor: theme.primary,
  },
  selfPlayerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  selfPlayerAvatarSelected: {
    backgroundColor: theme.primary,
  },
  selfPlayerAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  selfPlayerInfo: {
    flex: 1,
  },
  selfPlayerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selfPlayerName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  selfPlayerMeta: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
  },
  moiBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  moiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
