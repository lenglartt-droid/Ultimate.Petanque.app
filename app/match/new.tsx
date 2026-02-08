import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import Animated, { FadeInDown, FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import config, { GameFormat, TournamentType } from '@/constants/config';
import { useApp } from '@/contexts/AppContext';

// Tournament phases configuration
const BASE_PHASES = [
  { id: 'Poules', label: 'Poules', short: 'PL' },
  { id: '1/16 finale', label: '1/16 finale', short: '1/16' },
  { id: '1/8 finale', label: '1/8 finale', short: '1/8' },
  { id: 'Quart de finale', label: 'Quarts', short: 'QF' },
  { id: 'Demi-finale', label: 'Demis', short: 'DF' },
  { id: 'Petite finale', label: 'Petite F.', short: 'PF' },
  { id: 'Finale', label: 'Finale', short: 'F' },
];

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

type PlayerRoleType = 'Pointeur' | 'Milieu' | 'Tireur';

// Available roles per format
const ROLES_BY_FORMAT: Record<GameFormat, PlayerRoleType[]> = {
  'Tête-à-tête': [], // No roles for 1v1
  'Doublette': ['Pointeur', 'Tireur'], // Only 2 roles for 2v2
  'Triplette': ['Pointeur', 'Milieu', 'Tireur'], // All 3 roles for 3v3
};

interface TeamPlayerWithRole {
  playerId: string;
  role: PlayerRoleType;
}

type ActionType = 'tir' | 'point' | 'carreau';

// Step indicator component
const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => (
  <View style={styles.stepIndicator}>
    {Array.from({ length: totalSteps }).map((_, i) => (
      <View key={i} style={styles.stepRow}>
        <View style={[
          styles.stepDot,
          i < currentStep && styles.stepDotCompleted,
          i === currentStep && styles.stepDotActive,
        ]}>
          {i < currentStep ? (
            <MaterialIcons name="check" size={12} color="#FFF" />
          ) : (
            <Text style={[styles.stepNumber, i === currentStep && styles.stepNumberActive]}>
              {i + 1}
            </Text>
          )}
        </View>
        {i < totalSteps - 1 && (
          <View style={[styles.stepLine, i < currentStep && styles.stepLineCompleted]} />
        )}
      </View>
    ))}
  </View>
);

export default function NewMatchScreen() {
  const insets = useSafeAreaInsets();
  const { tournamentId, revanche, format: revancheFormat, teamA: revancheTeamA, teamB: revancheTeamB } = useLocalSearchParams<{ 
    tournamentId?: string;
    revanche?: string;
    format?: string;
    teamA?: string;
    teamB?: string;
  }>();
  const { addMatch, players, tournaments, matches, selfPlayer, terrains } = useApp();
  
  const isRevanche = revanche === 'true';
  const linkedTournament = tournamentId ? tournaments.find(t => t.id === tournamentId) : null;
  const isTournamentMode = !!linkedTournament;
  
  const tournamentPhases = useMemo(() => {
    if (!linkedTournament) return BASE_PHASES;
    return PHASES_BY_CADRAGE[linkedTournament.type] || BASE_PHASES;
  }, [linkedTournament]);

  const tournamentHistory = useMemo(() => {
    if (!linkedTournament) return { lastPhase: null, lastBracket: null, lastTeamAPlayers: [] as string[] };
    const prevMatches = matches
      .filter(m => m.tournamentId === linkedTournament.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const firstPhase = tournamentPhases[0]?.id || 'Poules';
    
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
    const lastTeamAPlayers = last.teamA.players.filter(id => players.some(p => p.id === id));
    return { lastPhase: suggestedPhase, lastBracket: last.tournamentBracket || null, lastTeamAPlayers };
  }, [linkedTournament, matches, players, tournamentPhases, selfPlayer]);
  
  // States
  const [format, setFormat] = useState<GameFormat>(linkedTournament?.format || (isRevanche && revancheFormat ? revancheFormat as GameFormat : 'Doublette'));
  const [teamAScore, setTeamAScore] = useState(0);
  const [teamBScore, setTeamBScore] = useState(0);
  const [teamAPlayers, setTeamAPlayers] = useState<TeamPlayerWithRole[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<TeamPlayerWithRole[]>([]);
  const [showPlayerPicker, setShowPlayerPicker] = useState<'A' | 'B' | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<string | null>(tournamentHistory.lastPhase);
  const [selectedBracket, setSelectedBracket] = useState<TournamentBracket | null>(tournamentHistory.lastBracket as TournamentBracket | null);
  const [scoringMode, setScoringMode] = useState<'simple' | 'detailed' | 'actions'>('simple');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [matchTime, setMatchTime] = useState(0);
  const [meneTime, setMeneTime] = useState(0);
  const [menes, setMenes] = useState<Mene[]>([]);
  const [currentMenePoints, setCurrentMenePoints] = useState({ teamA: 0, teamB: 0 });
  const [isNullMene, setIsNullMene] = useState(false);
  const [playerActions, setPlayerActions] = useState<PlayerActionState[]>([]);
  const [manualActionMode, setManualActionMode] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [selectedTerrainId, setSelectedTerrainId] = useState<string | null>(null);
  const [showTerrainPicker, setShowTerrainPicker] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [meneAlarmEnabled, setMeneAlarmEnabled] = useState(false);
  const [meneAlarmTriggered, setMeneAlarmTriggered] = useState(false);
  const [selectedAlarmSound, setSelectedAlarmSound] = useState<string>('bell');
  const alarmSoundRef = useRef<Audio.Sound | null>(null);

  // Load alarm sound preference
  useEffect(() => {
    const loadAlarmPreference = async () => {
      try {
        const savedSound = await AsyncStorage.getItem('meneAlarmSound');
        if (savedSound) {
          setSelectedAlarmSound(savedSound);
        }
      } catch (error) {
        console.log('Error loading alarm preference:', error);
      }
    };
    loadAlarmPreference();
  }, []);

  const maxScore = config.game.maxScore;

  // Points per mène based on format
  const maxPointsPerMene = useMemo(() => {
    return format === 'Tête-à-tête' ? 3 : 6;
  }, [format]);

  // Available roles based on format
  const availableRoles = useMemo(() => {
    return ROLES_BY_FORMAT[format] || [];
  }, [format]);

  const selectedTerrain = useMemo(() => {
    if (!selectedTerrainId) return null;
    return terrains.find(t => t.id === selectedTerrainId) || null;
  }, [selectedTerrainId, terrains]);

  const maxPlayersPerTeam = useMemo(() => {
    switch (format) {
      case 'Tête-à-tête': return 1;
      case 'Doublette': return 2;
      case 'Triplette': return 3;
      default: return 2;
    }
  }, [format]);

  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return players;
    const search = playerSearch.toLowerCase();
    return players.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.club?.toLowerCase().includes(search) ||
      p.role.toLowerCase().includes(search)
    );
  }, [players, playerSearch]);

  // Auto-include self player
  useEffect(() => {
    if (isRevanche) return;
    if (!selfPlayer || teamAPlayers.length > 0) return;
    
    if (isTournamentMode) {
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
      setTeamAPlayers([{ playerId: selfPlayer.id, role: (selfPlayer.role || 'Milieu') as PlayerRoleType }]);
    }
  }, [selfPlayer, isTournamentMode, tournamentHistory.lastTeamAPlayers, players]);

  // Pre-populate teams from revanche
  useEffect(() => {
    if (isRevanche) {
      if (revancheTeamA) {
        const teamANames = decodeURIComponent(revancheTeamA).split(',').map(n => n.trim());
        const teamAPlayersWithRoles = teamANames.map(name => {
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

  // Auto-set format and phase when tournament is linked
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

  useEffect(() => {
    if (selectedPhase === 'Poules') {
      setSelectedBracket(null);
    }
  }, [selectedPhase]);

  const togglePlayer = (playerId: string, team: 'A' | 'B') => {
    Haptics.selectionAsync();
    const setTeam = team === 'A' ? setTeamAPlayers : setTeamBPlayers;
    const otherTeam = team === 'A' ? teamBPlayers : teamAPlayers;
    const currentTeam = team === 'A' ? teamAPlayers : teamBPlayers;

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
      const player = players.find(p => p.id === playerId);
      // Get default role based on format
      let defaultRole: PlayerRoleType = 'Milieu';
      if (availableRoles.length > 0) {
        const playerPreferredRole = player?.role as PlayerRoleType;
        defaultRole = availableRoles.includes(playerPreferredRole) 
          ? playerPreferredRole 
          : availableRoles[0];
      }
      setTeam(prev => [...prev, { playerId, role: defaultRole }]);
    }
  };

  const updatePlayerRole = (playerId: string, team: 'A' | 'B', newRole: PlayerRoleType) => {
    Haptics.selectionAsync();
    const setTeam = team === 'A' ? setTeamAPlayers : setTeamBPlayers;
    setTeam(prev => prev.map(p => 
      p.playerId === playerId ? { ...p, role: newRole } : p
    ));
  };

  const getPlayerName = (id: string) => {
    if (selfPlayer && id === selfPlayer.id) {
      return selfPlayer.name || 'Moi';
    }
    return players.find(p => p.id === id)?.name || 'Inconnu';
  };

  const getTeamPlayerIds = (team: TeamPlayerWithRole[]): string[] => {
    return team.map(p => p.playerId);
  };

  useEffect(() => {
    if (teamAPlayers.length > maxPlayersPerTeam) {
      setTeamAPlayers(prev => prev.slice(0, maxPlayersPerTeam));
    }
    if (teamBPlayers.length > maxPlayersPerTeam) {
      setTeamBPlayers(prev => prev.slice(0, maxPlayersPerTeam));
    }
  }, [maxPlayersPerTeam, teamAPlayers.length, teamBPlayers.length]);

  // Update player roles when format changes (to ensure valid roles)
  useEffect(() => {
    if (availableRoles.length === 0) return; // No roles for this format
    
    // Update Team A roles to valid ones
    setTeamAPlayers(prev => prev.map(p => {
      if (!availableRoles.includes(p.role)) {
        return { ...p, role: availableRoles[0] };
      }
      return p;
    }));
    
    // Update Team B roles to valid ones
    setTeamBPlayers(prev => prev.map(p => {
      if (!availableRoles.includes(p.role)) {
        return { ...p, role: availableRoles[0] };
      }
      return p;
    }));
  }, [availableRoles]);

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

  const updatePlayerAction = useCallback((playerId: string, field: keyof PlayerActionState['actions'], value: number) => {
    Haptics.selectionAsync();
    setPlayerActions(prev => prev.map(p => {
      if (p.playerId !== playerId) return p;
      const newActions = { ...p.actions, [field]: Math.max(0, value) };
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

  const getPlayerActionStats = (playerId: string) => {
    return playerActions.find(p => p.playerId === playerId)?.actions || 
      { tirs: 0, tirsSuccess: 0, points: 0, pointsSuccess: 0, carreaux: 0 };
  };

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
      'Voulez-vous réinitialiser le match ?',
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

  // Mène alarm effect - trigger when mène time exceeds 60 seconds
  useEffect(() => {
    if (meneAlarmEnabled && meneTime === 60 && !meneAlarmTriggered) {
      triggerMeneAlarm();
    }
    // Reset alarm triggered state when mène resets
    if (meneTime < 60 && meneAlarmTriggered) {
      setMeneAlarmTriggered(false);
    }
  }, [meneTime, meneAlarmEnabled, meneAlarmTriggered]);

  // Cleanup alarm sound on unmount
  useEffect(() => {
    return () => {
      if (alarmSoundRef.current) {
        alarmSoundRef.current.unloadAsync();
      }
    };
  }, []);

  // Get alarm sound URI based on type
  const getAlarmSoundUri = (soundId: string): string => {
    const sounds: Record<string, string> = {
      bell: 'https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3',
      buzzer: 'https://cdn.freesound.org/previews/254/254316_4597795-lq.mp3',
      whistle: 'https://cdn.freesound.org/previews/352/352661_4019029-lq.mp3',
      chime: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
    };
    return sounds[soundId] || sounds.bell;
  };

  const triggerMeneAlarm = async () => {
    setMeneAlarmTriggered(true);
    
    // Always play haptics
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, i * 300);
    }
    
    // Play audio alarm if not set to 'none'
    if (selectedAlarmSound !== 'none') {
      try {
        // Unload previous sound if exists
        if (alarmSoundRef.current) {
          await alarmSoundRef.current.unloadAsync();
        }
        
        const { sound } = await Audio.Sound.createAsync(
          { uri: getAlarmSoundUri(selectedAlarmSound) },
          { shouldPlay: true, volume: 1.0 }
        );
        alarmSoundRef.current = sound;
        
        // Unload after playback
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            sound.unloadAsync();
            alarmSoundRef.current = null;
          }
        });
      } catch (error) {
        console.log('Error playing alarm sound:', error);
      }
    }
  };

  const toggleMeneAlarm = () => {
    Haptics.selectionAsync();
    setMeneAlarmEnabled(prev => !prev);
    if (!meneAlarmEnabled) {
      setMeneAlarmTriggered(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMenePoint = (team: 'teamA' | 'teamB', points: number) => {
    Haptics.selectionAsync();
    setIsNullMene(false);
    setCurrentMenePoints(prev => ({
      ...prev,
      [team]: prev[team] === points ? 0 : points,
    }));
  };

  const handleNullMene = () => {
    Haptics.selectionAsync();
    setIsNullMene(prev => !prev);
    if (!isNullMene) {
      setCurrentMenePoints({ teamA: 0, teamB: 0 });
    }
  };

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

  const handleScoreChange = (team: 'A' | 'B', delta: number, autoMene: boolean = true) => {
    Haptics.selectionAsync();
    
    // Only create mène for positive changes (points scored)
    if (autoMene && delta > 0) {
      const newMene: Mene = {
        id: menes.length + 1,
        teamAPoints: team === 'A' ? delta : 0,
        teamBPoints: team === 'B' ? delta : 0,
        duration: meneTime,
        isNull: false,
      };
      setMenes(prev => [...prev, newMene]);
      setMeneTime(0); // Reset mène timer
    }
    
    if (team === 'A') {
      setTeamAScore(prev => Math.max(0, Math.min(maxScore, prev + delta)));
    } else {
      setTeamBScore(prev => Math.max(0, Math.min(maxScore, prev + delta)));
    }
  };

  // Quick score function for fullscreen mode (adds multiple points at once)
  const handleQuickScore = (team: 'A' | 'B', points: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const newMene: Mene = {
      id: menes.length + 1,
      teamAPoints: team === 'A' ? points : 0,
      teamBPoints: team === 'B' ? points : 0,
      duration: meneTime,
      isNull: false,
    };
    setMenes(prev => [...prev, newMene]);
    setMeneTime(0);
    
    if (team === 'A') {
      setTeamAScore(prev => Math.max(0, Math.min(maxScore, prev + points)));
    } else {
      setTeamBScore(prev => Math.max(0, Math.min(maxScore, prev + points)));
    }
  };

  // Undo last mène
  const undoLastMene = () => {
    if (menes.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    const lastMene = menes[menes.length - 1];
    setTeamAScore(prev => Math.max(0, prev - lastMene.teamAPoints));
    setTeamBScore(prev => Math.max(0, prev - lastMene.teamBPoints));
    setMenes(prev => prev.slice(0, -1));
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

    if (isTimerRunning) {
      setIsTimerRunning(false);
    }

    const winner = teamAScore > teamBScore ? 'A' : 'B';
    const duration = matchTime > 0 ? Math.round(matchTime / 60) : Math.floor(Math.random() * 30) + 30;
    
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
    
    const teamAPlayerRoles = teamAPlayers.map(p => ({
      playerId: p.playerId,
      role: p.role,
    }));
    const teamBPlayerRoles = teamBPlayers.map(p => ({
      playerId: p.playerId,
      role: p.role,
    }));
    
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
        playerRoles: teamAPlayerRoles.length > 0 ? teamAPlayerRoles : undefined,
        score: teamAScore,
      },
      teamB: {
        players: teamBPlayerIds.length > 0 ? teamBPlayerIds : ['2'],
        playerNames: teamBPlayerNames,
        playerRoles: teamBPlayerRoles.length > 0 ? teamBPlayerRoles : undefined,
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

  // Calculate current step for indicator
  const currentStep = useMemo(() => {
    if (teamAScore > 0 || teamBScore > 0) return 2;
    if (teamAPlayers.length > 0 || teamBPlayers.length > 0) return 1;
    return 0;
  }, [teamAPlayers, teamBPlayers, teamAScore, teamBScore]);

  const isMatchReady = teamAScore > 0 || teamBScore > 0;

  // Track shots in fullscreen mode
  const [fsShowActions, setFsShowActions] = useState(false);
  const [fsSelectedPoints, setFsSelectedPoints] = useState<{ team: 'A' | 'B' | null; points: number }>({ team: null, points: 0 });
  const [fsNewMeneIndicator, setFsNewMeneIndicator] = useState<number | null>(null);

  // Validate and add mène in fullscreen - auto-start next mène
  const handleFsValidateMene = () => {
    if (!fsSelectedPoints.team || fsSelectedPoints.points === 0) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const newMene: Mene = {
      id: menes.length + 1,
      teamAPoints: fsSelectedPoints.team === 'A' ? fsSelectedPoints.points : 0,
      teamBPoints: fsSelectedPoints.team === 'B' ? fsSelectedPoints.points : 0,
      duration: meneTime,
      isNull: false,
    };
    
    setMenes(prev => [...prev, newMene]);
    if (fsSelectedPoints.team === 'A') {
      setTeamAScore(prev => Math.min(maxScore, prev + fsSelectedPoints.points));
    } else {
      setTeamBScore(prev => Math.min(maxScore, prev + fsSelectedPoints.points));
    }
    
    // Auto-start next mène
    setMeneTime(0);
    setMeneAlarmTriggered(false); // Reset alarm for new mène
    setFsSelectedPoints({ team: null, points: 0 });
    
    // Show new mène indicator
    const nextMeneNumber = menes.length + 2;
    setFsNewMeneIndicator(nextMeneNumber);
    setTimeout(() => setFsNewMeneIndicator(null), 1500);
    
    // Auto-start timer if not already running
    if (!isTimerRunning) {
      setIsTimerRunning(true);
    }
  };
  
  // Handle null mène in fullscreen - auto-start next mène
  const handleFsNullMene = () => {
    Haptics.selectionAsync();
    
    const newMene: Mene = {
      id: menes.length + 1,
      teamAPoints: 0,
      teamBPoints: 0,
      duration: meneTime,
      isNull: true,
    };
    setMenes(prev => [...prev, newMene]);
    
    // Auto-start next mène
    setMeneTime(0);
    setMeneAlarmTriggered(false); // Reset alarm for new mène
    setFsSelectedPoints({ team: null, points: 0 });
    
    // Show new mène indicator
    const nextMeneNumber = menes.length + 2;
    setFsNewMeneIndicator(nextMeneNumber);
    setTimeout(() => setFsNewMeneIndicator(null), 1500);
    
    // Auto-start timer if not already running
    if (!isTimerRunning) {
      setIsTimerRunning(true);
    }
  };

  // Fullscreen Score View - Completely Redesigned
  const renderFullscreenScore = () => {
    const pointOptions = Array.from({ length: maxPointsPerMene }, (_, i) => i + 1);

    return (
      <Modal
        visible={fullscreenMode}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFullscreenMode(false)}
      >
        <View style={styles.fullscreenContainer}>
          <SafeAreaView style={styles.fullscreenSafeArea}>
            {/* Compact Top Bar */}
            <View style={styles.fsTopBar}>
              <Pressable 
                style={styles.fsExitBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFullscreenMode(false);
                }}
              >
                <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.8)" />
              </Pressable>

              <View style={styles.fsTopCenter}>
                <Text style={styles.fsFormatBadge}>{format}</Text>
                {selectedTerrain && (
                  <Text style={styles.fsTerrainName} numberOfLines={1}>
                    <MaterialIcons name="place" size={12} color="rgba(255,255,255,0.5)" /> {selectedTerrain.name}
                  </Text>
                )}
              </View>

              {/* Alarm Toggle */}
              <Pressable 
                style={[styles.fsAlarmToggle, meneAlarmEnabled && styles.fsAlarmToggleActive]}
                onPress={toggleMeneAlarm}
              >
                <MaterialIcons 
                  name={meneAlarmEnabled ? 'notifications-active' : 'notifications-off'} 
                  size={20} 
                  color={meneAlarmEnabled ? '#FBBF24' : 'rgba(255,255,255,0.4)'} 
                />
              </Pressable>
            </View>

            {/* Dual Timer Display */}
            <View style={styles.fsDualTimerBar}>
              {/* Total Match Time */}
              <Pressable 
                style={[styles.fsDualTimerPill, isTimerRunning && styles.fsDualTimerPillActive]}
                onPress={isTimerRunning ? pauseTimer : startTimer}
              >
                <MaterialIcons 
                  name={isTimerRunning ? 'pause' : 'play-arrow'} 
                  size={18} 
                  color={isTimerRunning ? '#4ADE80' : 'rgba(255,255,255,0.5)'} 
                />
                <View style={styles.fsDualTimerContent}>
                  <Text style={styles.fsDualTimerLabel}>PARTIE</Text>
                  <Text style={[styles.fsDualTimerValue, isTimerRunning && styles.fsDualTimerValueActive]}>
                    {formatTime(matchTime)}
                  </Text>
                </View>
              </Pressable>

              {/* Mène Time */}
              <View style={[
                styles.fsDualTimerPill, 
                styles.fsDualTimerPillMene,
                meneAlarmTriggered && styles.fsDualTimerPillAlarm
              ]}>
                <MaterialIcons 
                  name="sports" 
                  size={18} 
                  color={meneAlarmTriggered ? '#FBBF24' : 'rgba(255,255,255,0.5)'} 
                />
                <View style={styles.fsDualTimerContent}>
                  <Text style={styles.fsDualTimerLabel}>MÈNE {menes.length + 1}</Text>
                  <Text style={[
                    styles.fsDualTimerValue, 
                    meneTime >= 60 && styles.fsDualTimerValueWarning,
                    meneAlarmTriggered && styles.fsDualTimerValueAlarm
                  ]}>
                    {formatTime(meneTime)}
                  </Text>
                </View>
                {meneAlarmEnabled && (
                  <View style={[
                    styles.fsAlarmIndicator,
                    meneAlarmTriggered && styles.fsAlarmIndicatorActive
                  ]}>
                    <MaterialIcons 
                      name={meneAlarmTriggered ? 'warning' : 'alarm'} 
                      size={14} 
                      color={meneAlarmTriggered ? '#FBBF24' : 'rgba(255,255,255,0.4)'} 
                    />
                    {!meneAlarmTriggered && <Text style={styles.fsAlarmIndicatorText}>1min</Text>}
                  </View>
                )}
              </View>
            </View>

            {/* Giant Score Display */}
            <View style={styles.fsGiantScoreArea}>
              {/* Team A Score */}
              <Pressable 
                style={[
                  styles.fsGiantScoreBlock,
                  fsSelectedPoints.team === 'A' && styles.fsGiantScoreBlockSelected,
                  { borderColor: theme.primary + '40' }
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFsSelectedPoints(prev => ({ 
                    team: prev.team === 'A' ? null : 'A', 
                    points: prev.team === 'A' ? 0 : prev.points || 1 
                  }));
                }}
              >
                <View style={styles.fsGiantScoreHeader}>
                  <View style={[styles.fsGiantTeamDot, { backgroundColor: theme.primary }]} />
                  <Text style={styles.fsGiantTeamLabel}>MON ÉQUIPE</Text>
                </View>
                {teamAPlayers.length > 0 && (
                  <Text style={styles.fsGiantPlayerNames} numberOfLines={1}>
                    {teamAPlayers.map(p => getPlayerName(p.playerId).split(' ')[0]).join(' • ')}
                  </Text>
                )}
                <Text style={[
                  styles.fsGiantScoreValue,
                  teamAScore >= teamBScore && teamAScore > 0 && styles.fsGiantScoreWinning
                ]}>
                  {teamAScore}
                </Text>
                {fsSelectedPoints.team === 'A' && (
                  <View style={[styles.fsSelectedIndicator, { backgroundColor: theme.primary }]}>
                    <Text style={styles.fsSelectedIndicatorText}>+{fsSelectedPoints.points}</Text>
                  </View>
                )}
              </Pressable>

              {/* VS Badge */}
              <View style={styles.fsGiantVsBadge}>
                <Text style={styles.fsGiantVsText}>VS</Text>
                <View style={styles.fsGiantMeneBadge}>
                  <Text style={styles.fsGiantMeneText}>M{menes.length + 1}</Text>
                </View>
              </View>

              {/* Team B Score */}
              <Pressable 
                style={[
                  styles.fsGiantScoreBlock,
                  fsSelectedPoints.team === 'B' && styles.fsGiantScoreBlockSelected,
                  { borderColor: theme.accent + '40' }
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFsSelectedPoints(prev => ({ 
                    team: prev.team === 'B' ? null : 'B', 
                    points: prev.team === 'B' ? 0 : prev.points || 1 
                  }));
                }}
              >
                <View style={styles.fsGiantScoreHeader}>
                  <View style={[styles.fsGiantTeamDot, { backgroundColor: theme.accent }]} />
                  <Text style={styles.fsGiantTeamLabel}>ADVERSAIRE</Text>
                </View>
                {teamBPlayers.length > 0 && (
                  <Text style={styles.fsGiantPlayerNames} numberOfLines={1}>
                    {teamBPlayers.map(p => getPlayerName(p.playerId).split(' ')[0]).join(' • ')}
                  </Text>
                )}
                <Text style={[
                  styles.fsGiantScoreValue,
                  teamBScore > teamAScore && styles.fsGiantScoreLosing
                ]}>
                  {teamBScore}
                </Text>
                {fsSelectedPoints.team === 'B' && (
                  <View style={[styles.fsSelectedIndicator, { backgroundColor: theme.accent }]}>
                    <Text style={styles.fsSelectedIndicatorText}>+{fsSelectedPoints.points}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Point Selection - Large Buttons */}
            <View style={styles.fsPointSelection}>
              <Text style={styles.fsPointSelectionTitle}>
                {fsSelectedPoints.team ? `Points pour ${fsSelectedPoints.team === 'A' ? 'Mon équipe' : 'Adversaire'}` : 'Sélectionner une équipe'}
              </Text>
              <View style={styles.fsPointButtonsRow}>
                {pointOptions.map(pts => (
                  <Pressable
                    key={pts}
                    style={[
                      styles.fsPointButton,
                      fsSelectedPoints.points === pts && fsSelectedPoints.team && styles.fsPointButtonActive,
                      fsSelectedPoints.points === pts && fsSelectedPoints.team === 'A' && { backgroundColor: theme.primary },
                      fsSelectedPoints.points === pts && fsSelectedPoints.team === 'B' && { backgroundColor: theme.accent },
                      !fsSelectedPoints.team && styles.fsPointButtonDisabled,
                    ]}
                    onPress={() => {
                      if (!fsSelectedPoints.team) return;
                      Haptics.selectionAsync();
                      setFsSelectedPoints(prev => ({ ...prev, points: pts }));
                    }}
                    disabled={!fsSelectedPoints.team}
                  >
                    <Text style={[
                      styles.fsPointButtonText,
                      fsSelectedPoints.points === pts && fsSelectedPoints.team && styles.fsPointButtonTextActive,
                      !fsSelectedPoints.team && styles.fsPointButtonTextDisabled,
                    ]}>
                      {pts}
                    </Text>
                  </Pressable>
                ))}
              </View>
              
              {/* Validate Mène Button */}
              <View style={styles.fsValidateRow}>
                <Pressable
                  style={[
                    styles.fsValidateMeneBtn,
                    (!fsSelectedPoints.team || fsSelectedPoints.points === 0) && styles.fsValidateMeneBtnDisabled,
                  ]}
                  onPress={handleFsValidateMene}
                  disabled={!fsSelectedPoints.team || fsSelectedPoints.points === 0}
                >
                  <MaterialIcons name="check" size={28} color="#FFF" />
                  <Text style={styles.fsValidateMeneBtnText}>Valider la mène</Text>
                </Pressable>
                
                <Pressable
                  style={styles.fsNullMeneBtn}
                  onPress={handleFsNullMene}
                >
                  <MaterialIcons name="block" size={24} color="#FBBF24" />
                </Pressable>
              </View>
            </View>

            {/* Mène Timeline - Large & Visual */}
            <View style={styles.fsMeneTimeline}>
              <View style={styles.fsMeneTimelineHeader}>
                <Text style={styles.fsMeneTimelineTitle}>Déroulé du match</Text>
                {menes.length > 0 && (
                  <Pressable style={styles.fsMeneUndoBtn} onPress={undoLastMene}>
                    <MaterialIcons name="undo" size={18} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.fsMeneUndoBtnText}>Annuler</Text>
                  </Pressable>
                )}
              </View>
              
              {menes.length === 0 ? (
                <View style={styles.fsMeneEmptyState}>
                  <MaterialIcons name="sports" size={32} color="rgba(255,255,255,0.2)" />
                  <Text style={styles.fsMeneEmptyText}>Le match commence...</Text>
                </View>
              ) : (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.fsMeneTimelineScroll}
                >
                  {menes.map((m, idx) => {
                    // Calculate running score
                    const runningScoreA = menes.slice(0, idx + 1).reduce((sum, me) => sum + me.teamAPoints, 0);
                    const runningScoreB = menes.slice(0, idx + 1).reduce((sum, me) => sum + me.teamBPoints, 0);
                    
                    return (
                      <View key={m.id} style={styles.fsMeneCard}>
                        <Text style={styles.fsMeneCardNumber}>M{idx + 1}</Text>
                        {m.isNull ? (
                          <View style={styles.fsMeneCardNull}>
                            <MaterialIcons name="block" size={24} color="#FBBF24" />
                            <Text style={styles.fsMeneCardNullText}>Nulle</Text>
                          </View>
                        ) : (
                          <View style={styles.fsMeneCardScore}>
                            <View style={[
                              styles.fsMeneCardDelta,
                              m.teamAPoints > 0 && styles.fsMeneCardDeltaA
                            ]}>
                              <Text style={styles.fsMeneCardDeltaText}>
                                {m.teamAPoints > 0 ? `+${m.teamAPoints}` : '-'}
                              </Text>
                            </View>
                            <View style={[
                              styles.fsMeneCardDelta,
                              m.teamBPoints > 0 && styles.fsMeneCardDeltaB
                            ]}>
                              <Text style={styles.fsMeneCardDeltaText}>
                                {m.teamBPoints > 0 ? `+${m.teamBPoints}` : '-'}
                              </Text>
                            </View>
                          </View>
                        )}
                        <Text style={styles.fsMeneCardRunning}>{runningScoreA} - {runningScoreB}</Text>
                        <Text style={styles.fsMeneCardDuration}>{formatTime(m.duration)}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Shot Notation - Bottom Panel */}
            {(teamAPlayers.length > 0 || teamBPlayers.length > 0) && (
              <View style={styles.fsBottomPanel}>
                <Pressable 
                  style={[styles.fsBottomPanelHeader, fsShowActions && styles.fsBottomPanelHeaderActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setFsShowActions(!fsShowActions);
                  }}
                >
                  <MaterialIcons 
                    name="sports" 
                    size={20} 
                    color={fsShowActions ? '#FFF' : 'rgba(255,255,255,0.6)'} 
                  />
                  <Text style={[styles.fsBottomPanelTitle, fsShowActions && styles.fsBottomPanelTitleActive]}>
                    Notation des coups
                  </Text>
                  <MaterialIcons 
                    name={fsShowActions ? 'keyboard-arrow-down' : 'keyboard-arrow-up'} 
                    size={24} 
                    color="rgba(255,255,255,0.6)" 
                  />
                </Pressable>
                
                {fsShowActions && (
                  <Animated.View entering={FadeInUp.duration(200)} style={styles.fsActionsContent}>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.fsActionsScrollContent}
                    >
                      {/* All players in a row */}
                      {[...teamAPlayers, ...teamBPlayers].map((p, idx) => {
                        const isTeamA = idx < teamAPlayers.length;
                        const stats = getPlayerActionStats(p.playerId);
                        const teamColor = isTeamA ? theme.primary : theme.accent;
                        
                        return (
                          <View key={p.playerId} style={[styles.fsPlayerActionCard, { borderColor: teamColor + '40' }]}>
                            <View style={styles.fsPlayerActionHeader}>
                              <View style={[styles.fsPlayerActionDot, { backgroundColor: teamColor }]} />
                              <Text style={styles.fsPlayerActionName} numberOfLines={1}>
                                {getPlayerName(p.playerId).split(' ')[0]}
                              </Text>
                            </View>
                            
                            <View style={styles.fsPlayerActionButtons}>
                              <Pressable
                                style={[styles.fsPlayerActionBtn, { backgroundColor: theme.tirColor }]}
                                onPress={() => recordAction(p.playerId, 'tir', true)}
                                onLongPress={() => recordAction(p.playerId, 'tir', false)}
                              >
                                <MaterialIcons name="gps-fixed" size={22} color="#FFF" />
                                <Text style={styles.fsPlayerActionBtnLabel}>TIR</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.fsPlayerActionBtn, { backgroundColor: theme.pointColor }]}
                                onPress={() => recordAction(p.playerId, 'point', true)}
                                onLongPress={() => recordAction(p.playerId, 'point', false)}
                              >
                                <MaterialIcons name="adjust" size={22} color="#FFF" />
                                <Text style={styles.fsPlayerActionBtnLabel}>POINT</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.fsPlayerActionBtn, { backgroundColor: theme.carreauColor }]}
                                onPress={() => recordAction(p.playerId, 'carreau', true)}
                              >
                                <MaterialIcons name="stars" size={22} color="#FFF" />
                                <Text style={styles.fsPlayerActionBtnLabel}>CARREAU</Text>
                              </Pressable>
                            </View>
                            
                            <View style={styles.fsPlayerActionStats}>
                              <Text style={styles.fsPlayerActionStatsText}>
                                T: {stats.tirsSuccess}/{stats.tirs} • P: {stats.pointsSuccess}/{stats.points} • C: {stats.carreaux}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                    <Text style={styles.fsActionsHint}>Appui long = coup raté</Text>
                  </Animated.View>
                )}
              </View>
            )}

            {/* New Mène Indicator Overlay */}
            {fsNewMeneIndicator && !(teamAScore >= maxScore || teamBScore >= maxScore) && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.fsNewMeneOverlay}>
                <Animated.View entering={FadeInUp.springify().damping(12)} style={styles.fsNewMeneCard}>
                  <MaterialIcons name="sports" size={40} color="#4ADE80" />
                  <Text style={styles.fsNewMeneTitle}>Mène {fsNewMeneIndicator}</Text>
                  <Text style={styles.fsNewMeneSubtitle}>C'est parti !</Text>
                  <View style={styles.fsNewMeneTimerIndicator}>
                    <MaterialIcons name="timer" size={16} color="#4ADE80" />
                    <Text style={styles.fsNewMeneTimerText}>Chrono démarré</Text>
                  </View>
                </Animated.View>
              </Animated.View>
            )}

            {/* Winner Overlay */}
            {(teamAScore >= maxScore || teamBScore >= maxScore) && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.fsWinnerOverlay}>
                <View style={styles.fsWinnerCard}>
                  <MaterialIcons 
                    name={teamAScore > teamBScore ? 'emoji-events' : 'sentiment-dissatisfied'} 
                    size={80} 
                    color={teamAScore > teamBScore ? '#FFD700' : '#F87171'} 
                  />
                  <Text style={styles.fsWinnerTitle}>
                    {teamAScore > teamBScore ? 'VICTOIRE !' : 'DÉFAITE'}
                  </Text>
                  <Text style={styles.fsWinnerScore}>{teamAScore} - {teamBScore}</Text>
                  <Text style={styles.fsWinnerMenes}>{menes.length} mène{menes.length > 1 ? 's' : ''} • {formatTime(matchTime)}</Text>
                  <Pressable 
                    style={styles.fsWinnerBtn}
                    onPress={() => setFullscreenMode(false)}
                  >
                    <Text style={styles.fsWinnerBtnText}>Terminer le match</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Fullscreen Score Modal */}
      {renderFullscreenScore()}

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isTournamentMode ? 'Match Tournoi' : isRevanche ? 'Revanche' : 'Nouveau Match'}
          </Text>
          {isTournamentMode && linkedTournament && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{linkedTournament.name}</Text>
          )}
        </View>
        <Pressable 
          style={styles.fullscreenToggleBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setFullscreenMode(true);
          }}
        >
          <MaterialIcons name="fullscreen" size={24} color={theme.textSecondary} />
        </Pressable>
      </View>

      {/* Step Indicator */}
      <View style={styles.stepContainer}>
        <StepIndicator currentStep={currentStep} totalSteps={3} />
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabel, currentStep >= 0 && styles.stepLabelActive]}>Équipes</Text>
          <Text style={[styles.stepLabel, currentStep >= 1 && styles.stepLabelActive]}>Score</Text>
          <Text style={[styles.stepLabel, currentStep >= 2 && styles.stepLabelActive]}>Terminé</Text>
        </View>
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
          {/* Mode Banner & Terrain Selection */}
          {!isTournamentMode && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.trainingSetupCard}>
              <View style={[styles.modeBanner, isRevanche && styles.modeBannerRevanche]}>
                <View style={[styles.modeBannerIcon, isRevanche && styles.modeBannerIconRevanche]}>
                  <MaterialIcons name={isRevanche ? 'sports-mma' : 'fitness-center'} size={20} color="#FFF" />
                </View>
                <Text style={styles.modeBannerText}>
                  {isRevanche ? 'Match revanche' : 'Entraînement'}
                </Text>
              </View>
              
              {/* Terrain Selection */}
              <Pressable 
                style={styles.terrainSelector}
                onPress={() => setShowTerrainPicker(true)}
              >
                <View style={styles.terrainSelectorIcon}>
                  <MaterialIcons name="place" size={20} color={selectedTerrain ? theme.primary : theme.textMuted} />
                </View>
                <View style={styles.terrainSelectorContent}>
                  <Text style={styles.terrainSelectorLabel}>Terrain</Text>
                  <Text style={[styles.terrainSelectorValue, !selectedTerrain && styles.terrainSelectorPlaceholder]} numberOfLines={1}>
                    {selectedTerrain ? selectedTerrain.name : 'Choisir un terrain (optionnel)'}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            </Animated.View>
          )}

          {/* Tournament Phase Selection */}
          {isTournamentMode && linkedTournament && (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.phaseSection}>
              <Text style={styles.sectionLabel}>PHASE DU TOURNOI</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phaseScroll}>
                {tournamentPhases.map((phase) => (
                  <Pressable
                    key={phase.id}
                    style={[styles.phaseChip, selectedPhase === phase.id && styles.phaseChipActive]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedPhase(phase.id);
                    }}
                  >
                    <Text style={[styles.phaseChipText, selectedPhase === phase.id && styles.phaseChipTextActive]}>
                      {phase.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              
              {linkedTournament.type === 'Mixte' && selectedPhase && selectedPhase !== 'Poules' && (
                <View style={styles.bracketRow}>
                  <Text style={styles.bracketLabel}>Tableau :</Text>
                  {TOURNAMENT_BRACKETS.map((bracket) => (
                    <Pressable
                      key={bracket}
                      style={[styles.bracketChip, selectedBracket === bracket && styles.bracketChipActive]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedBracket(bracket);
                      }}
                    >
                      <Text style={[styles.bracketChipText, selectedBracket === bracket && styles.bracketChipTextActive]}>
                        {bracket}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Animated.View>
          )}

          {/* Format Selection */}
          <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.formatSection}>
            <Text style={styles.sectionLabel}>FORMAT</Text>
            <View style={styles.formatRow}>
              {config.game.formats.map(f => {
                const isActive = format === f;
                const isDisabled = linkedTournament && f !== linkedTournament.format;
                return (
                  <Pressable
                    key={f}
                    style={[styles.formatChip, isActive && styles.formatChipActive, isDisabled && styles.formatChipDisabled]}
                    onPress={() => {
                      if (isDisabled) return;
                      Haptics.selectionAsync();
                      setFormat(f);
                    }}
                    disabled={isDisabled}
                  >
                    <MaterialIcons 
                      name={f === 'Tête-à-tête' ? 'person' : f === 'Doublette' ? 'people' : 'groups'} 
                      size={18} 
                      color={isActive ? '#FFF' : isDisabled ? theme.textMuted : theme.textSecondary} 
                    />
                    <Text style={[styles.formatChipText, isActive && styles.formatChipTextActive, isDisabled && styles.formatChipTextDisabled]}>
                      {f}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Main Score Display - Central and Prominent */}
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.scoreSection}>
            <View style={styles.scoreCard}>
              {/* Team A */}
              <View style={styles.scoreTeam}>
                <Pressable 
                  style={styles.scoreTeamHeader}
                  onPress={() => setShowPlayerPicker('A')}
                >
                  <View style={[styles.teamColorDot, { backgroundColor: theme.primary }]} />
                  <Text style={styles.scoreTeamLabel}>Mon équipe</Text>
                  <MaterialIcons name="edit" size={16} color={theme.textMuted} />
                </Pressable>
                
                <View style={styles.scoreTeamPlayers}>
                  {teamAPlayers.length > 0 ? (
                    teamAPlayers.map((p, idx) => (
                      <View key={p.playerId} style={styles.playerMiniChip}>
                        <Text style={styles.playerMiniName} numberOfLines={1}>
                          {getPlayerName(p.playerId).split(' ')[0]}
                        </Text>
                        {availableRoles.length > 0 && (
                          <View style={[styles.roleMiniDot, { 
                            backgroundColor: p.role === 'Tireur' ? '#F97316' : p.role === 'Pointeur' ? '#3B82F6' : '#8B5CF6' 
                          }]} />
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPlayersHint}>Ajouter joueurs</Text>
                  )}
                </View>

                <View style={styles.scoreControlsVertical}>
                  <Pressable 
                    style={styles.scoreControlBtn}
                    onPress={() => handleScoreChange('A', 1, false)}
                  >
                    <MaterialIcons name="add" size={28} color={theme.primary} />
                  </Pressable>
                  <Text style={[styles.scoreValueLarge, teamAScore >= teamBScore && teamAScore > 0 && styles.scoreValueWinning]}>
                    {teamAScore}
                  </Text>
                  <Pressable 
                    style={styles.scoreControlBtn}
                    onPress={() => handleScoreChange('A', -1, false)}
                  >
                    <MaterialIcons name="remove" size={28} color={theme.textMuted} />
                  </Pressable>
                </View>
              </View>

              {/* VS Divider */}
              <View style={styles.vsDivider}>
                <View style={styles.vsLine} />
                <View style={styles.vsCircle}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                <View style={styles.vsLine} />
              </View>

              {/* Team B */}
              <View style={styles.scoreTeam}>
                <Pressable 
                  style={styles.scoreTeamHeader}
                  onPress={() => setShowPlayerPicker('B')}
                >
                  <View style={[styles.teamColorDot, { backgroundColor: theme.accent }]} />
                  <Text style={styles.scoreTeamLabel}>Adversaire</Text>
                  <MaterialIcons name="edit" size={16} color={theme.textMuted} />
                </Pressable>
                
                <View style={styles.scoreTeamPlayers}>
                  {teamBPlayers.length > 0 ? (
                    teamBPlayers.map((p, idx) => (
                      <View key={p.playerId} style={[styles.playerMiniChip, styles.playerMiniChipB]}>
                        <Text style={styles.playerMiniName} numberOfLines={1}>
                          {getPlayerName(p.playerId).split(' ')[0]}
                        </Text>
                        {availableRoles.length > 0 && (
                          <View style={[styles.roleMiniDot, { 
                            backgroundColor: p.role === 'Tireur' ? '#F97316' : p.role === 'Pointeur' ? '#3B82F6' : '#8B5CF6' 
                          }]} />
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noPlayersHint}>Ajouter joueurs</Text>
                  )}
                </View>

                <View style={styles.scoreControlsVertical}>
                  <Pressable 
                    style={styles.scoreControlBtn}
                    onPress={() => handleScoreChange('B', 1, false)}
                  >
                    <MaterialIcons name="add" size={28} color={theme.accent} />
                  </Pressable>
                  <Text style={[styles.scoreValueLarge, teamBScore > teamAScore && styles.scoreValueLosing]}>
                    {teamBScore}
                  </Text>
                  <Pressable 
                    style={styles.scoreControlBtn}
                    onPress={() => handleScoreChange('B', -1, false)}
                  >
                    <MaterialIcons name="remove" size={28} color={theme.textMuted} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Quick Score Buttons */}
            <View style={styles.quickScoreRow}>
              <Text style={styles.quickScoreLabel}>Score rapide :</Text>
              {[13, 11, 9, 7].map(score => (
                <Pressable
                  key={score}
                  style={styles.quickScoreBtn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setTeamAScore(score);
                    setTeamBScore(Math.floor(Math.random() * (score - 2)));
                  }}
                >
                  <Text style={styles.quickScoreBtnText}>{score}-X</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Winner Indicator */}
          {isMatchReady && (
            <Animated.View entering={FadeInUp.duration(300)} style={styles.winnerBanner}>
              <MaterialIcons 
                name={teamAScore > teamBScore ? 'emoji-events' : teamAScore < teamBScore ? 'sentiment-dissatisfied' : 'drag-handle'} 
                size={28} 
                color={teamAScore > teamBScore ? theme.success : teamAScore < teamBScore ? theme.error : theme.textMuted} 
              />
              <Text style={[
                styles.winnerText,
                { color: teamAScore > teamBScore ? theme.success : teamAScore < teamBScore ? theme.error : theme.textMuted }
              ]}>
                {teamAScore > teamBScore ? 'Victoire !' : teamAScore < teamBScore ? 'Défaite' : 'Égalité'}
              </Text>
            </Animated.View>
          )}

          {/* Advanced Options Toggle */}
          <Pressable 
            style={styles.advancedToggle}
            onPress={() => {
              Haptics.selectionAsync();
              setShowAdvancedOptions(!showAdvancedOptions);
            }}
          >
            <MaterialIcons 
              name={showAdvancedOptions ? 'expand-less' : 'expand-more'} 
              size={24} 
              color={theme.textSecondary} 
            />
            <Text style={styles.advancedToggleText}>
              {showAdvancedOptions ? 'Masquer les options avancées' : 'Options avancées (mènes, actions, chrono)'}
            </Text>
          </Pressable>

          {/* Advanced Scoring Options - Collapsible */}
          {showAdvancedOptions && (
            <Animated.View entering={FadeInDown.duration(300)}>
              {/* Scoring Mode Selection */}
              <View style={styles.scoringModeSection}>
                <Text style={styles.sectionLabel}>MODE DE NOTATION</Text>
                <View style={styles.scoringModeRow}>
                  <Pressable
                    style={[styles.scoringModeBtn, scoringMode === 'simple' && styles.scoringModeBtnActive]}
                    onPress={() => setScoringMode('simple')}
                  >
                    <MaterialIcons name="speed" size={20} color={scoringMode === 'simple' ? '#FFF' : theme.textSecondary} />
                    <Text style={[styles.scoringModeBtnText, scoringMode === 'simple' && styles.scoringModeBtnTextActive]}>Simple</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.scoringModeBtn, scoringMode === 'detailed' && styles.scoringModeBtnActive]}
                    onPress={() => setScoringMode('detailed')}
                  >
                    <MaterialIcons name="format-list-numbered" size={20} color={scoringMode === 'detailed' ? '#FFF' : theme.textSecondary} />
                    <Text style={[styles.scoringModeBtnText, scoringMode === 'detailed' && styles.scoringModeBtnTextActive]}>Mènes</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.scoringModeBtn, scoringMode === 'actions' && styles.scoringModeBtnActiveAlt]}
                    onPress={() => setScoringMode('actions')}
                  >
                    <MaterialIcons name="sports" size={20} color={scoringMode === 'actions' ? '#FFF' : theme.textSecondary} />
                    <Text style={[styles.scoringModeBtnText, scoringMode === 'actions' && styles.scoringModeBtnTextActive]}>Actions</Text>
                  </Pressable>
                </View>
              </View>

              {/* Timer - Show for detailed mode */}
              {scoringMode === 'detailed' && (
                <View style={styles.timerSection}>
                  <View style={styles.timerDisplay}>
                    <View style={styles.timerMain}>
                      <MaterialIcons name="timer" size={24} color={isTimerRunning ? theme.primary : theme.textMuted} />
                      <Text style={[styles.timerValue, isTimerRunning && styles.timerValueActive]}>
                        {formatTime(matchTime)}
                      </Text>
                    </View>
                    <View style={styles.timerControls}>
                      {!isTimerRunning ? (
                        <Pressable style={[styles.timerBtn, styles.timerBtnStart]} onPress={startTimer}>
                          <MaterialIcons name="play-arrow" size={24} color="#FFF" />
                        </Pressable>
                      ) : (
                        <Pressable style={[styles.timerBtn, styles.timerBtnPause]} onPress={pauseTimer}>
                          <MaterialIcons name="pause" size={24} color="#FFF" />
                        </Pressable>
                      )}
                      <Pressable style={[styles.timerBtn, styles.timerBtnReset]} onPress={resetTimer}>
                        <MaterialIcons name="refresh" size={20} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}

              {/* Mène Input - Show for detailed mode */}
              {scoringMode === 'detailed' && (
                <View style={styles.meneSection}>
                  <Text style={styles.sectionLabel}>POINTS DE LA MÈNE</Text>
                  <View style={styles.meneCard}>
                    <View style={styles.meneRow}>
                      <Text style={styles.meneTeamLabel}>Mon équipe</Text>
                      <View style={styles.menePointsRow}>
                        {Array.from({ length: maxPointsPerMene }, (_, i) => i + 1).map(pts => (
                          <Pressable
                            key={`A-${pts}`}
                            style={[styles.menePointBtn, currentMenePoints.teamA === pts && styles.menePointBtnActiveA]}
                            onPress={() => handleMenePoint('teamA', pts)}
                          >
                            <Text style={[styles.menePointText, currentMenePoints.teamA === pts && styles.menePointTextActive]}>
                              {pts}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.meneDivider} />
                    
                    <View style={styles.meneRow}>
                      <Text style={styles.meneTeamLabel}>Adversaire</Text>
                      <View style={styles.menePointsRow}>
                        {Array.from({ length: maxPointsPerMene }, (_, i) => i + 1).map(pts => (
                          <Pressable
                            key={`B-${pts}`}
                            style={[styles.menePointBtn, currentMenePoints.teamB === pts && styles.menePointBtnActiveB]}
                            onPress={() => handleMenePoint('teamB', pts)}
                          >
                            <Text style={[styles.menePointText, currentMenePoints.teamB === pts && styles.menePointTextActive]}>
                              {pts}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <Pressable style={[styles.nullMeneBtn, isNullMene && styles.nullMeneBtnActive]} onPress={handleNullMene}>
                      <MaterialIcons 
                        name={isNullMene ? 'check-box' : 'check-box-outline-blank'} 
                        size={18} 
                        color={isNullMene ? theme.warning : theme.textMuted} 
                      />
                      <Text style={[styles.nullMeneText, isNullMene && styles.nullMeneTextActive]}>Mène nulle</Text>
                    </Pressable>

                    <Pressable 
                      style={[styles.addMeneBtn, (!isNullMene && !currentMenePoints.teamA && !currentMenePoints.teamB) && styles.addMeneBtnDisabled]}
                      onPress={addMene}
                    >
                      <MaterialIcons name="check" size={20} color="#FFF" />
                      <Text style={styles.addMeneBtnText}>Valider mène {menes.length + 1}</Text>
                    </Pressable>
                  </View>

                  {/* Mènes History */}
                  {menes.length > 0 && (
                    <View style={styles.menesHistory}>
                      <Text style={styles.menesHistoryTitle}>Historique ({menes.length} mènes)</Text>
                      <View style={styles.menesHistoryList}>
                        {menes.map((m) => (
                          <View key={m.id} style={styles.meneHistoryItem}>
                            <Text style={styles.meneHistoryNum}>M{m.id}</Text>
                            {m.isNull ? (
                              <Text style={styles.meneHistoryNull}>⊘</Text>
                            ) : (
                              <>
                                <Text style={[styles.meneHistoryScore, m.teamAPoints > 0 && styles.meneHistoryWin]}>
                                  {m.teamAPoints > 0 ? `+${m.teamAPoints}` : '-'}
                                </Text>
                                <Text style={styles.meneHistorySep}>/</Text>
                                <Text style={[styles.meneHistoryScore, m.teamBPoints > 0 && styles.meneHistoryLoss]}>
                                  {m.teamBPoints > 0 ? `+${m.teamBPoints}` : '-'}
                                </Text>
                              </>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Action Tracker - Show for actions mode */}
              {scoringMode === 'actions' && (
                <View style={styles.actionsSection}>
                  <View style={styles.actionModeToggle}>
                    <Pressable
                      style={[styles.actionModeBtn, !manualActionMode && styles.actionModeBtnActive]}
                      onPress={() => setManualActionMode(false)}
                    >
                      <MaterialIcons name="touch-app" size={16} color={!manualActionMode ? '#FFF' : theme.textSecondary} />
                      <Text style={[styles.actionModeBtnText, !manualActionMode && styles.actionModeBtnTextActive]}>Temps réel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionModeBtn, manualActionMode && styles.actionModeBtnActive]}
                      onPress={() => setManualActionMode(true)}
                    >
                      <MaterialIcons name="edit" size={16} color={manualActionMode ? '#FFF' : theme.textSecondary} />
                      <Text style={[styles.actionModeBtnText, manualActionMode && styles.actionModeBtnTextActive]}>Manuel</Text>
                    </Pressable>
                  </View>

                  {(teamAPlayers.length === 0 && teamBPlayers.length === 0) ? (
                    <View style={styles.actionsEmptyState}>
                      <MaterialIcons name="info-outline" size={24} color={theme.textMuted} />
                      <Text style={styles.actionsEmptyText}>Ajoutez des joueurs pour suivre leurs actions</Text>
                    </View>
                  ) : (
                    <View style={styles.actionsGrid}>
                      {/* Team A Players */}
                      {teamAPlayers.length > 0 && (
                        <View style={styles.actionsTeam}>
                          <View style={styles.actionsTeamHeader}>
                            <View style={[styles.actionsTeamDot, { backgroundColor: theme.primary }]} />
                            <Text style={styles.actionsTeamTitle}>Mon équipe</Text>
                          </View>
                          {teamAPlayers.map(p => {
                            const stats = getPlayerActionStats(p.playerId);
                            return (
                              <View key={p.playerId} style={styles.actionPlayerCard}>
                                <Text style={styles.actionPlayerName} numberOfLines={1}>{getPlayerName(p.playerId)}</Text>
                                {manualActionMode ? (
                                  <View style={styles.actionManualRow}>
                                    <View style={styles.actionManualGroup}>
                                      <Text style={styles.actionManualLabel}>T</Text>
                                      <Text style={styles.actionManualValue}>{stats.tirsSuccess}/{stats.tirs}</Text>
                                    </View>
                                    <View style={styles.actionManualGroup}>
                                      <Text style={styles.actionManualLabel}>P</Text>
                                      <Text style={styles.actionManualValue}>{stats.pointsSuccess}/{stats.points}</Text>
                                    </View>
                                    <View style={styles.actionManualGroup}>
                                      <Text style={styles.actionManualLabel}>C</Text>
                                      <Text style={[styles.actionManualValue, { color: theme.carreauColor }]}>{stats.carreaux}</Text>
                                    </View>
                                  </View>
                                ) : (
                                  <View style={styles.actionBtnsRow}>
                                    <Pressable
                                      style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                                      onPress={() => recordAction(p.playerId, 'tir', true)}
                                      onLongPress={() => recordAction(p.playerId, 'tir', false)}
                                    >
                                      <MaterialIcons name="gps-fixed" size={16} color="#FFF" />
                                    </Pressable>
                                    <Pressable
                                      style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                                      onPress={() => recordAction(p.playerId, 'point', true)}
                                      onLongPress={() => recordAction(p.playerId, 'point', false)}
                                    >
                                      <MaterialIcons name="adjust" size={16} color="#FFF" />
                                    </Pressable>
                                    <Pressable
                                      style={[styles.actionBtn, { backgroundColor: theme.carreauColor }]}
                                      onPress={() => recordAction(p.playerId, 'carreau', true)}
                                    >
                                      <MaterialIcons name="stars" size={16} color="#FFF" />
                                    </Pressable>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}

                      {/* Team B Players */}
                      {teamBPlayers.length > 0 && (
                        <View style={styles.actionsTeam}>
                          <View style={styles.actionsTeamHeader}>
                            <View style={[styles.actionsTeamDot, { backgroundColor: theme.accent }]} />
                            <Text style={styles.actionsTeamTitle}>Adversaire</Text>
                          </View>
                          {teamBPlayers.map(p => {
                            const stats = getPlayerActionStats(p.playerId);
                            return (
                              <View key={p.playerId} style={styles.actionPlayerCard}>
                                <Text style={styles.actionPlayerName} numberOfLines={1}>{getPlayerName(p.playerId)}</Text>
                                {manualActionMode ? (
                                  <View style={styles.actionManualRow}>
                                    <View style={styles.actionManualGroup}>
                                      <Text style={styles.actionManualLabel}>T</Text>
                                      <Text style={styles.actionManualValue}>{stats.tirsSuccess}/{stats.tirs}</Text>
                                    </View>
                                    <View style={styles.actionManualGroup}>
                                      <Text style={styles.actionManualLabel}>P</Text>
                                      <Text style={styles.actionManualValue}>{stats.pointsSuccess}/{stats.points}</Text>
                                    </View>
                                    <View style={styles.actionManualGroup}>
                                      <Text style={styles.actionManualLabel}>C</Text>
                                      <Text style={[styles.actionManualValue, { color: theme.carreauColor }]}>{stats.carreaux}</Text>
                                    </View>
                                  </View>
                                ) : (
                                  <View style={styles.actionBtnsRow}>
                                    <Pressable
                                      style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                                      onPress={() => recordAction(p.playerId, 'tir', true)}
                                      onLongPress={() => recordAction(p.playerId, 'tir', false)}
                                    >
                                      <MaterialIcons name="gps-fixed" size={16} color="#FFF" />
                                    </Pressable>
                                    <Pressable
                                      style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                                      onPress={() => recordAction(p.playerId, 'point', true)}
                                      onLongPress={() => recordAction(p.playerId, 'point', false)}
                                    >
                                      <MaterialIcons name="adjust" size={16} color="#FFF" />
                                    </Pressable>
                                    <Pressable
                                      style={[styles.actionBtn, { backgroundColor: theme.carreauColor }]}
                                      onPress={() => recordAction(p.playerId, 'carreau', true)}
                                    >
                                      <MaterialIcons name="stars" size={16} color="#FFF" />
                                    </Pressable>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {!manualActionMode && (teamAPlayers.length > 0 || teamBPlayers.length > 0) && (
                    <View style={styles.actionLegend}>
                      <Text style={styles.actionLegendText}>
                        <MaterialIcons name="gps-fixed" size={12} color={theme.accent} /> Tir (appui long = raté)  •  
                        <MaterialIcons name="adjust" size={12} color={theme.primary} /> Point  •  
                        <MaterialIcons name="stars" size={12} color={theme.carreauColor} /> Carreau
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* Save Button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable 
            style={[styles.saveButton, !isMatchReady && styles.saveButtonDisabled]}
            onPress={handleSaveMatch}
          >
            <MaterialIcons name="check" size={24} color="#FFF" />
            <Text style={styles.saveButtonText}>Enregistrer le match</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Terrain Picker Modal */}
      <Modal
        visible={showTerrainPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTerrainPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowTerrainPicker(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>Choisir un terrain</Text>
            <Pressable 
              style={styles.modalDoneBtn} 
              onPress={() => {
                setSelectedTerrainId(null);
                setShowTerrainPicker(false);
              }}
            >
              <Text style={[styles.modalDoneText, { color: theme.textMuted }]}>Aucun</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.playersList} contentContainerStyle={styles.playersListContent}>
            {/* Create new terrain */}
            <Pressable
              style={styles.createPlayerBtn}
              onPress={() => {
                setShowTerrainPicker(false);
                router.push('/terrain/new');
              }}
            >
              <View style={[styles.createPlayerIcon, { backgroundColor: theme.primary + '20' }]}>
                <MaterialIcons name="add-location" size={22} color={theme.primary} />
              </View>
              <View style={styles.createPlayerInfo}>
                <Text style={[styles.createPlayerTitle, { color: theme.primary }]}>Ajouter un terrain</Text>
                <Text style={styles.createPlayerSubtitle}>Créer un nouveau boulodrome</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
            </Pressable>

            {/* Terrain list */}
            {terrains.length === 0 ? (
              <View style={styles.emptySearch}>
                <MaterialIcons name="location-off" size={40} color={theme.textMuted} />
                <Text style={styles.emptySearchText}>Aucun terrain enregistré</Text>
              </View>
            ) : (
              terrains.map(terrain => (
                <Pressable
                  key={terrain.id}
                  style={[styles.playerItem, selectedTerrainId === terrain.id && styles.playerItemSelected]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedTerrainId(terrain.id);
                    setShowTerrainPicker(false);
                  }}
                >
                  <View style={[styles.playerAvatar, selectedTerrainId === terrain.id && styles.playerAvatarSelected]}>
                    <MaterialIcons name="place" size={22} color="#FFF" />
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={styles.playerName}>{terrain.name}</Text>
                    <Text style={styles.playerMeta}>{terrain.type} • {terrain.city}</Text>
                  </View>
                  <MaterialIcons 
                    name={selectedTerrainId === terrain.id ? 'check-circle' : 'radio-button-unchecked'} 
                    size={24} 
                    color={selectedTerrainId === terrain.id ? theme.primary : theme.border} 
                  />
                </Pressable>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
            <Pressable style={styles.modalCloseBtn} onPress={() => { setShowPlayerPicker(null); setPlayerSearch(''); }}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={styles.modalTitle}>
              {showPlayerPicker === 'A' ? 'Mon équipe' : 'Adversaire'}
            </Text>
            <Pressable style={styles.modalDoneBtn} onPress={() => { setShowPlayerPicker(null); setPlayerSearch(''); }}>
              <Text style={styles.modalDoneText}>OK</Text>
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={playerSearch}
              onChangeText={setPlayerSearch}
              placeholder="Rechercher..."
              placeholderTextColor={theme.textMuted}
            />
            {playerSearch.length > 0 && (
              <Pressable onPress={() => setPlayerSearch('')}>
                <MaterialIcons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            )}
          </View>

          <Text style={styles.selectionCount}>
            {showPlayerPicker === 'A' ? teamAPlayers.length : teamBPlayers.length} / {maxPlayersPerTeam} sélectionné(s)
          </Text>

          <ScrollView style={styles.playersList} contentContainerStyle={styles.playersListContent}>
            {/* Self player for Team A */}
            {showPlayerPicker === 'A' && selfPlayer && (
              <Pressable
                style={[styles.playerItem, teamAPlayers.some(p => p.playerId === selfPlayer.id) && styles.playerItemSelected]}
                onPress={() => togglePlayer(selfPlayer.id, 'A')}
              >
                <View style={[styles.playerAvatar, teamAPlayers.some(p => p.playerId === selfPlayer.id) && styles.playerAvatarSelected]}>
                  <Text style={styles.playerAvatarText}>{selfPlayer.name?.charAt(0) || 'M'}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <View style={styles.playerNameRow}>
                    <Text style={styles.playerName}>{selfPlayer.name || 'Moi'}</Text>
                    <View style={styles.moiBadge}><Text style={styles.moiBadgeText}>MOI</Text></View>
                  </View>
                  <Text style={styles.playerMeta}>{selfPlayer.role} • {selfPlayer.level}</Text>
                </View>
                <MaterialIcons 
                  name={teamAPlayers.some(p => p.playerId === selfPlayer.id) ? 'check-circle' : 'radio-button-unchecked'} 
                  size={24} 
                  color={teamAPlayers.some(p => p.playerId === selfPlayer.id) ? theme.primary : theme.border} 
                />
              </Pressable>
            )}

            {/* Role Selection for selected players - Only show if format has roles */}
            {showPlayerPicker && availableRoles.length > 0 && (showPlayerPicker === 'A' ? teamAPlayers : teamBPlayers).length > 0 && (
              <View style={styles.roleSelectionSection}>
                <Text style={styles.roleSelectionTitle}>Rôles des joueurs sélectionnés</Text>
                {(showPlayerPicker === 'A' ? teamAPlayers : teamBPlayers).map(p => (
                  <View key={p.playerId} style={styles.roleSelectionRow}>
                    <Text style={styles.roleSelectionName} numberOfLines={1}>{getPlayerName(p.playerId)}</Text>
                    <View style={styles.roleButtonsRow}>
                      {availableRoles.map(role => (
                        <Pressable
                          key={role}
                          style={[
                            styles.roleButton,
                            p.role === role && (showPlayerPicker === 'A' ? styles.roleButtonActiveA : styles.roleButtonActiveB)
                          ]}
                          onPress={() => updatePlayerRole(p.playerId, showPlayerPicker!, role)}
                        >
                          <MaterialIcons 
                            name={role === 'Tireur' ? 'gps-fixed' : role === 'Pointeur' ? 'radio-button-on' : 'swap-horiz'} 
                            size={14} 
                            color={p.role === role ? '#FFF' : theme.textSecondary} 
                          />
                          <Text style={[styles.roleButtonText, p.role === role && styles.roleButtonTextActive]}>
                            {role.slice(0, 1)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Create new opponent - Team B only */}
            {showPlayerPicker === 'B' && (
              <Pressable
                style={styles.createPlayerBtn}
                onPress={() => {
                  setShowPlayerPicker(null);
                  setPlayerSearch('');
                  router.push('/player/new');
                }}
              >
                <View style={styles.createPlayerIcon}>
                  <MaterialIcons name="person-add" size={22} color={theme.accent} />
                </View>
                <View style={styles.createPlayerInfo}>
                  <Text style={styles.createPlayerTitle}>Créer un adversaire</Text>
                  <Text style={styles.createPlayerSubtitle}>Ajouter un nouveau joueur</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
              </Pressable>
            )}

            {/* Other players */}
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
                    style={[styles.playerItem, isSelected && styles.playerItemSelected, isInOtherTeam && styles.playerItemDisabled]}
                    onPress={() => !isInOtherTeam && togglePlayer(player.id, showPlayerPicker!)}
                    disabled={isInOtherTeam}
                  >
                    <View style={[
                      styles.playerAvatar,
                      isSelected && (showPlayerPicker === 'A' ? styles.playerAvatarSelectedA : styles.playerAvatarSelectedB),
                      isInOtherTeam && styles.playerAvatarDisabled
                    ]}>
                      <Text style={styles.playerAvatarText}>{player.name.split(' ').map(n => n[0]).join('')}</Text>
                    </View>
                    <View style={styles.playerInfo}>
                      <Text style={[styles.playerName, isInOtherTeam && { color: theme.textMuted }]}>{player.name}</Text>
                      <Text style={styles.playerMeta}>{player.role} • {player.level}{player.club ? ` • ${player.club}` : ''}</Text>
                    </View>
                    {isInOtherTeam ? (
                      <Text style={styles.otherTeamLabel}>Autre équipe</Text>
                    ) : (
                      <MaterialIcons 
                        name={isSelected ? 'check-circle' : 'radio-button-unchecked'} 
                        size={24} 
                        color={isSelected ? (showPlayerPicker === 'A' ? theme.primary : theme.accent) : theme.border} 
                      />
                    )}
                  </Pressable>
                );
              })}

            {filteredPlayers.length === 0 && (
              <View style={styles.emptySearch}>
                <MaterialIcons name="search-off" size={40} color={theme.textMuted} />
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  // Step Indicator
  stepContainer: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.border,
  },
  stepDotCompleted: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  stepDotActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '15',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  stepNumberActive: {
    color: theme.primary,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: theme.border,
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: theme.success,
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  stepLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: theme.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Mode Banner
  trainingSetupCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.xl,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  modeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.primary + '10',
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    gap: 12,
  },
  modeBannerRevanche: {
    backgroundColor: theme.accent + '10',
  },
  modeBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBannerIconRevanche: {
    backgroundColor: theme.accent,
  },
  modeBannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  terrainSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 10,
  },
  terrainSelectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  terrainSelectorContent: {
    flex: 1,
  },
  terrainSelectorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 2,
  },
  terrainSelectorValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  terrainSelectorPlaceholder: {
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  // Phase Section
  phaseSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  phaseScroll: {
    gap: 8,
  },
  phaseChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.border,
  },
  phaseChipActive: {
    backgroundColor: theme.carreauColor,
    borderColor: theme.carreauColor,
  },
  phaseChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  phaseChipTextActive: {
    color: '#FFF',
  },
  bracketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  bracketLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  bracketChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bracketChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  bracketChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  bracketChipTextActive: {
    color: '#FFF',
  },
  // Format Section
  formatSection: {
    marginBottom: 16,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formatChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatChipActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  formatChipDisabled: {
    opacity: 0.4,
  },
  formatChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  formatChipTextActive: {
    color: '#FFF',
  },
  formatChipTextDisabled: {
    color: theme.textMuted,
  },
  // Main Score Section
  scoreSection: {
    marginBottom: 16,
  },
  scoreCard: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.xl,
    padding: 16,
    ...theme.shadows.card,
  },
  scoreTeam: {
    flex: 1,
    alignItems: 'center',
  },
  scoreTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  teamColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoreTeamLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  scoreTeamPlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 12,
    minHeight: 28,
  },
  playerMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.primary + '15',
    borderRadius: theme.borderRadius.sm,
  },
  playerMiniChipB: {
    backgroundColor: theme.accent + '15',
  },
  playerMiniName: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.textPrimary,
    maxWidth: 60,
  },
  roleMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  noPlayersHint: {
    fontSize: 12,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  scoreControlsVertical: {
    alignItems: 'center',
  },
  scoreControlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 22,
  },
  scoreValueLarge: {
    fontSize: 56,
    fontWeight: '800',
    color: theme.textPrimary,
    marginVertical: 4,
  },
  scoreValueWinning: {
    color: theme.success,
  },
  scoreValueLosing: {
    color: theme.error,
  },
  // VS Divider
  vsDivider: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  vsLine: {
    width: 1,
    height: 40,
    backgroundColor: theme.border,
  },
  vsCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  vsText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  // Quick Score
  quickScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  quickScoreLabel: {
    fontSize: 12,
    color: theme.textMuted,
  },
  quickScoreBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
  },
  quickScoreBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  // Winner Banner
  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  winnerText: {
    fontSize: 20,
    fontWeight: '700',
  },
  // Advanced Toggle
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: 16,
  },
  advancedToggleText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  // Scoring Mode Section
  scoringModeSection: {
    marginBottom: 16,
  },
  scoringModeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scoringModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  scoringModeBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  scoringModeBtnActiveAlt: {
    backgroundColor: theme.tirColor,
    borderColor: theme.tirColor,
  },
  scoringModeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  scoringModeBtnTextActive: {
    color: '#FFF',
  },
  // Timer Section
  timerSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    marginBottom: 16,
  },
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.textMuted,
    fontVariant: ['tabular-nums'],
  },
  timerValueActive: {
    color: theme.primary,
  },
  timerControls: {
    flexDirection: 'row',
    gap: 10,
  },
  timerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBtnStart: {
    backgroundColor: theme.success,
  },
  timerBtnPause: {
    backgroundColor: theme.warning,
  },
  timerBtnReset: {
    backgroundColor: theme.backgroundSecondary,
  },
  // Mène Section
  meneSection: {
    marginBottom: 16,
  },
  meneCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
  },
  meneRow: {
    marginBottom: 12,
  },
  meneTeamLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  menePointsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  menePointBtn: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  menePointBtnActiveA: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  menePointBtnActiveB: {
    backgroundColor: theme.accent + '20',
    borderColor: theme.accent,
  },
  menePointText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  menePointTextActive: {
    color: theme.textPrimary,
  },
  meneDivider: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 8,
  },
  nullMeneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    marginTop: 8,
  },
  nullMeneBtnActive: {
    backgroundColor: theme.warning + '15',
  },
  nullMeneText: {
    fontSize: 13,
    color: theme.textMuted,
  },
  nullMeneTextActive: {
    color: theme.warning,
    fontWeight: '600',
  },
  addMeneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    marginTop: 12,
  },
  addMeneBtnDisabled: {
    backgroundColor: theme.textMuted,
  },
  addMeneBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Mènes History
  menesHistory: {
    marginTop: 16,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 12,
  },
  menesHistoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 10,
  },
  menesHistoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  meneHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  meneHistoryNum: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
  },
  meneHistoryScore: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  meneHistoryWin: {
    color: theme.success,
  },
  meneHistoryLoss: {
    color: theme.error,
  },
  meneHistorySep: {
    fontSize: 10,
    color: theme.textMuted,
  },
  meneHistoryNull: {
    fontSize: 12,
    color: theme.warning,
  },
  // Actions Section
  actionsSection: {
    marginBottom: 16,
  },
  actionModeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
  },
  actionModeBtnActive: {
    backgroundColor: theme.primary,
  },
  actionModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  actionModeBtnTextActive: {
    color: '#FFF',
  },
  actionsEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    paddingVertical: 24,
    borderRadius: theme.borderRadius.lg,
  },
  actionsEmptyText: {
    fontSize: 13,
    color: theme.textMuted,
  },
  actionsGrid: {
    gap: 12,
  },
  actionsTeam: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
  },
  actionsTeamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  actionsTeamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionsTeamTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  actionPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    marginBottom: 6,
  },
  actionPlayerName: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionManualRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionManualGroup: {
    alignItems: 'center',
  },
  actionManualLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 2,
  },
  actionManualValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  actionLegend: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  actionLegendText: {
    fontSize: 11,
    color: theme.textMuted,
    lineHeight: 18,
  },
  // Footer
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
    borderRadius: theme.borderRadius.lg,
  },
  saveButtonDisabled: {
    backgroundColor: theme.textMuted,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
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
  selectionCount: {
    fontSize: 13,
    color: theme.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 8,
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
    borderRadius: theme.borderRadius.lg,
    marginBottom: 8,
  },
  playerItemSelected: {
    borderWidth: 2,
    borderColor: theme.primary,
  },
  playerItemDisabled: {
    opacity: 0.5,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playerAvatarSelected: {
    backgroundColor: theme.primary,
  },
  playerAvatarSelectedA: {
    backgroundColor: theme.primary,
  },
  playerAvatarSelectedB: {
    backgroundColor: theme.accent,
  },
  playerAvatarDisabled: {
    backgroundColor: theme.textMuted,
  },
  playerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  playerInfo: {
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  playerMeta: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  moiBadge: {
    backgroundColor: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
  otherTeamLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  // Role Selection in Modal
  roleSelectionSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    marginBottom: 12,
  },
  roleSelectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 10,
  },
  roleSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  roleSelectionName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
    flex: 1,
  },
  roleButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.sm,
  },
  roleButtonActiveA: {
    backgroundColor: theme.primary,
  },
  roleButtonActiveB: {
    backgroundColor: theme.accent,
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  roleButtonTextActive: {
    color: '#FFF',
  },
  // Create Player
  createPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.accent + '10',
    padding: 14,
    borderRadius: theme.borderRadius.lg,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.accent + '30',
    borderStyle: 'dashed',
  },
  createPlayerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  createPlayerInfo: {
    flex: 1,
  },
  createPlayerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.accent,
  },
  createPlayerSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  emptySearch: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptySearchText: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 10,
  },
  // Fullscreen Mode Styles - Completely Redesigned
  fullscreenToggleBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  fullscreenSafeArea: {
    flex: 1,
  },
  // FS Top Bar
  fsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fsExitBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsTopCenter: {
    alignItems: 'center',
  },
  fsFormatBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  fsTerrainName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  fsTimerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 22,
  },
  fsTimerPillActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  fsTimerText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    fontVariant: ['tabular-nums'],
  },
  fsTimerTextActive: {
    color: '#4ADE80',
  },
  // FS Alarm Toggle
  fsAlarmToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsAlarmToggleActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  // FS Dual Timer Bar
  fsDualTimerBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  fsDualTimerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    minWidth: 140,
  },
  fsDualTimerPillActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  fsDualTimerPillMene: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  fsDualTimerPillAlarm: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  fsDualTimerContent: {
    flex: 1,
  },
  fsDualTimerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },
  fsDualTimerValue: {
    fontSize: 20,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    fontVariant: ['tabular-nums'],
  },
  fsDualTimerValueActive: {
    color: '#4ADE80',
  },
  fsDualTimerValueWarning: {
    color: '#F97316',
  },
  fsDualTimerValueAlarm: {
    color: '#FBBF24',
  },
  fsAlarmIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  fsAlarmIndicatorActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
  },
  fsAlarmIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  // FS Giant Score Area
  fsGiantScoreArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 20,
    gap: 12,
  },
  fsGiantScoreBlock: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  fsGiantScoreBlockSelected: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  fsGiantScoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  fsGiantTeamDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  fsGiantTeamLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  fsGiantPlayerNames: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  fsGiantScoreValue: {
    fontSize: 100,
    fontWeight: '900',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  fsGiantScoreWinning: {
    color: '#4ADE80',
  },
  fsGiantScoreLosing: {
    color: '#F87171',
  },
  fsSelectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  fsSelectedIndicatorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  fsGiantVsBadge: {
    alignItems: 'center',
  },
  fsGiantVsText: {
    fontSize: 16,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.3)',
  },
  fsGiantMeneBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
  },
  fsGiantMeneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  // FS Point Selection
  fsPointSelection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  fsPointSelectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 16,
  },
  fsPointButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  fsPointButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fsPointButtonActive: {
    borderColor: 'transparent',
  },
  fsPointButtonDisabled: {
    opacity: 0.4,
  },
  fsPointButtonText: {
    fontSize: 24,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
  },
  fsPointButtonTextActive: {
    color: '#FFF',
  },
  fsPointButtonTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
  fsValidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  fsValidateMeneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.success,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 28,
  },
  fsValidateMeneBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fsValidateMeneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  fsNullMeneBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  // FS Mène Timeline
  fsMeneTimeline: {
    flex: 1,
    paddingVertical: 12,
  },
  fsMeneTimelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  fsMeneTimelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  fsMeneUndoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
  },
  fsMeneUndoBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  fsMeneEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  fsMeneEmptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
    fontStyle: 'italic',
  },
  fsMeneTimelineScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  fsMeneCard: {
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  fsMeneCardNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  fsMeneCardNull: {
    alignItems: 'center',
  },
  fsMeneCardNullText: {
    fontSize: 10,
    color: '#FBBF24',
    marginTop: 4,
  },
  fsMeneCardScore: {
    flexDirection: 'row',
    gap: 8,
  },
  fsMeneCardDelta: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsMeneCardDeltaA: {
    backgroundColor: 'rgba(74, 222, 128, 0.25)',
  },
  fsMeneCardDeltaB: {
    backgroundColor: 'rgba(248, 113, 113, 0.25)',
  },
  fsMeneCardDeltaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  fsMeneCardRunning: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  fsMeneCardDuration: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  // FS Bottom Panel (Actions)
  fsBottomPanel: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  fsBottomPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fsBottomPanelHeaderActive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  fsBottomPanelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  fsBottomPanelTitleActive: {
    color: '#FFF',
  },
  fsActionsContent: {
    paddingBottom: 12,
  },
  fsActionsScrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  fsPlayerActionCard: {
    width: 160,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
  },
  fsPlayerActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  fsPlayerActionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fsPlayerActionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  fsPlayerActionButtons: {
    gap: 8,
  },
  fsPlayerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  fsPlayerActionBtnLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  fsPlayerActionStats: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  fsPlayerActionStatsText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  fsActionsHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  // FS Winner Overlay
  fsWinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsWinnerCard: {
    alignItems: 'center',
    padding: 40,
  },
  fsWinnerTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 20,
    letterSpacing: 3,
  },
  fsWinnerScore: {
    fontSize: 32,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
  },
  fsWinnerMenes: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  fsWinnerBtn: {
    marginTop: 32,
    paddingHorizontal: 40,
    paddingVertical: 18,
    backgroundColor: theme.primary,
    borderRadius: 28,
  },
  fsWinnerBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  // FS New Mène Indicator
  fsNewMeneOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  fsNewMeneCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    borderRadius: 32,
    padding: 40,
    minWidth: 240,
  },
  fsNewMeneTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 16,
    letterSpacing: 2,
  },
  fsNewMeneSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  fsNewMeneTimerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderRadius: 20,
  },
  fsNewMeneTimerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4ADE80',
  },
});
