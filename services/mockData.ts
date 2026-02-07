// PetanqueScore Mock Data

import { GameFormat, PlayerRole, TournamentType, TerrainType } from '@/constants/config';

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  club?: string;
  clubId?: string;
  role: PlayerRole;
  level: 'Débutant' | 'Intermédiaire' | 'Confirmé' | 'Expert';
  phone?: string;
  email?: string;
  terrainId?: string;
  terrainName?: string;
  location?: {
    latitude: number;
    longitude: number;
    city: string;
  };
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    tirRate: number;
    pointRate: number;
    carreauRate: number;
    avgPointsScored: number;
    avgPointsConceded: number;
    totalTirs?: number;
    totalTirsSuccess?: number;
    totalPoints?: number;
    totalPointsSuccess?: number;
  };
  createdAt: string;
}

export interface Club {
  id: string;
  name: string;
  logo?: string;
  address: string;
  city: string;
  location: {
    latitude: number;
    longitude: number;
  };
  membersCount: number;
  foundedYear: number;
  description: string;
  facilities: string[];
  contactEmail?: string;
  contactPhone?: string;
}

// Terrain types
export interface Terrain {
  id: string;
  name: string;
  address: string;
  city: string;
  location: {
    latitude: number;
    longitude: number;
  };
  type: TerrainType;
  description?: string;
  facilities?: string[];
  photos?: string[];
  clubId?: string;
  clubName?: string;
  isPublic: boolean;
  courtsCount: number;
  lighting: boolean;
  covered: boolean;
  createdAt?: string;
}

// Tournament bracket types
export interface BracketMatch {
  id: string;
  round: number;
  position: number;
  teamA?: {
    teamId?: string;
    name: string;
    score?: number;
  };
  teamB?: {
    teamId?: string;
    name: string;
    score?: number;
  };
  winner?: 'A' | 'B';
  matchId?: string; // Link to actual match
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TournamentPhase {
  id: string;
  name: string;
  type: 'pools' | 'elimination' | 'final';
  order: number;
  matches: BracketMatch[];
}

export interface TournamentTeam {
  id: string;
  name: string;
  playerIds: string[];
  playerNames: string[];
  poolId?: string;
  seed?: number;
  stats: {
    wins: number;
    losses: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDiff: number;
  };
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  type: TournamentType;
  format: GameFormat;
  location: {
    name: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  terrainId?: string;
  terrainName?: string;
  terrainType?: TerrainType;
  clubId?: string;
  clubName?: string;
  status: 'À venir' | 'En cours' | 'Terminé';
  participants: number;
  maxParticipants: number;
  prize?: string;
  description?: string;
  // Enhanced tournament features
  teams?: TournamentTeam[];
  phases?: TournamentPhase[];
  currentPhaseId?: string;
}

export interface Match {
  id: string;
  date: string;
  mode: 'Entraînement' | 'Tournoi';
  format: GameFormat;
  tournamentId?: string;
  tournamentName?: string;
  tournamentPhase?: string; // Poules, 1/8, Quart, etc.
  tournamentBracket?: 'A' | 'B' | 'C' | 'D'; // Tableau after pools
  bracketMatchId?: string; // Link to bracket position
  teamA: {
    players: string[];
    playerNames: string[];
    score: number;
  };
  teamB: {
    players: string[];
    playerNames: string[];
    score: number;
  };
  winner: 'A' | 'B';
  duration: number; // minutes
  menes: Mene[];
  // Real-time action tracking
  playerActions?: PlayerAction[];
}

export interface Mene {
  id?: string;
  number?: number;
  teamAPoints: number;
  teamBPoints: number;
  scoreA?: number;
  scoreB?: number;
  duration?: number;
  isNull?: boolean;
  actions?: ShotAction[];
}

export interface ShotAction {
  id: string;
  playerId: string;
  playerName: string;
  type: 'point' | 'tir' | 'carreau';
  success: boolean;
  timestamp: string;
  meneNumber: number;
}

export interface PlayerAction {
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

// Challenge types
export type ChallengeType = '10_tirs' | '10_tirs_sautee' | 'precision';

// Precision challenge specific types
export type PrecisionAtelier = 
  | 'boule_seule'
  | 'derriere_but'
  | 'entre_2_boules'
  | 'sautee'
  | 'tir_but';

export type PrecisionDistance = 6 | 7 | 8 | 9;

export interface PrecisionShot {
  atelier: PrecisionAtelier;
  distance: PrecisionDistance;
  points: 0 | 1 | 3 | 5;
  timeUsed: number; // seconds used (max 30)
  timestamp: string;
}

export interface PrecisionScoringOption {
  points: 0 | 1 | 3 | 5;
  label: string;
  description: string;
}

export interface PrecisionAtelierConfig {
  id: PrecisionAtelier;
  name: string;
  description: string;
  icon: string;
  scoringOptions: PrecisionScoringOption[];
}

export const PRECISION_ATELIERS: PrecisionAtelierConfig[] = [
  { 
    id: 'boule_seule', 
    name: 'Tir de boule seule', 
    description: 'Tirer une boule isolée placée dans un cercle', 
    icon: 'radio-button-checked',
    scoringOptions: [
      { points: 0, label: 'Raté', description: 'Boule cible non touchée' },
      { points: 1, label: 'Touché', description: 'Boule cible frappée mais reste dans le cercle' },
      { points: 3, label: 'Sorti', description: 'Boule cible frappée et sort du cercle' },
      { points: 5, label: 'Carreau', description: 'Boule envoyée reste dans le cercle après avoir frappé la cible' },
    ]
  },
  { 
    id: 'derriere_but', 
    name: 'Boule derrière le but', 
    description: 'Tirer une boule placée derrière le cochonnet sans toucher le but', 
    icon: 'gps-fixed',
    scoringOptions: [
      { points: 0, label: 'Raté', description: 'Boule non touchée, sol touché avant, ou but touché en premier' },
      { points: 1, label: 'Touché', description: 'Boule cible frappée en premier mais reste dans le cercle' },
      { points: 3, label: 'Sorti', description: 'Boule cible frappée en premier et sort du cercle' },
      { points: 5, label: 'Carreau', description: 'Boule envoyée reste dans le cercle sans toucher le but' },
    ]
  },
  { 
    id: 'entre_2_boules', 
    name: 'Entre 2 boules', 
    description: 'Tirer une boule placée entre deux boules obstacles', 
    icon: 'more-horiz',
    scoringOptions: [
      { points: 0, label: 'Raté', description: 'Obstacle touché en premier ou obstacle sorti après touche' },
      { points: 1, label: 'Touché', description: 'Cible frappée, obstacle touché mais reste, ou cible reste dans cercle' },
      { points: 3, label: 'Sorti', description: 'Cible sort du cercle sans toucher les obstacles' },
      { points: 5, label: 'Carreau', description: 'Boule envoyée reste dans le cercle sans toucher les obstacles' },
    ]
  },
  { 
    id: 'sautee', 
    name: 'Tir à la sautée', 
    description: 'Tir en cloche par-dessus une boule obstacle', 
    icon: 'flight-takeoff',
    scoringOptions: [
      { points: 0, label: 'Raté', description: 'Obstacle touché en premier ou obstacle sorti au recul' },
      { points: 1, label: 'Touché', description: 'Cible touchée, obstacle touché au recul mais reste, ou cible reste' },
      { points: 3, label: 'Sorti', description: 'Cible sort du cercle sans déplacer l\'obstacle' },
      { points: 5, label: 'Carreau', description: 'Boule envoyée reste dans le cercle sans déplacer l\'obstacle' },
    ]
  },
  { 
    id: 'tir_but', 
    name: 'Tir de but', 
    description: 'Tirer directement le cochonnet', 
    icon: 'stars',
    scoringOptions: [
      { points: 0, label: 'Raté', description: 'But non touché' },
      { points: 3, label: 'Touché', description: 'But frappé mais reste dans le cercle' },
      { points: 5, label: 'Sorti', description: 'But frappé et sort du cercle' },
    ]
  },
];

export const PRECISION_DISTANCES: PrecisionDistance[] = [6, 7, 8, 9];

// Legacy config kept for compatibility
export const PRECISION_POINTS_CONFIG = {
  carreau: 5,
  touche: 3,
  frole: 1,
  rate: 0,
};

export interface ChallengeShot {
  number: number;
  success: boolean;
  carreau?: boolean;
  timestamp: string;
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  date: string;
  playerId?: string;
  playerName?: string;
  // For 10_tirs and 10_tirs_sautee
  shots?: ChallengeShot[];
  successCount?: number;
  totalShots?: number;
  carreauCount?: number;
  successRate?: number;
  // For precision challenge
  precisionShots?: PrecisionShot[];
  totalPoints?: number;
  maxPoints?: number; // 100 for precision
  atelierScores?: { [key in PrecisionAtelier]?: number };
  // Common
  duration?: number; // seconds
  notes?: string;
}

export interface ChallengeStats {
  totalChallenges: number;
  byType: {
    '10_tirs': { count: number; avgSuccess: number; bestScore: number };
    '10_tirs_sautee': { count: number; avgSuccess: number; bestScore: number };
    'precision': { count: number; avgSuccess: number; bestScore: number };
  };
  recentChallenges: Challenge[];
  totalShots: number;
  totalSuccess: number;
  overallSuccessRate: number;
}

// Head-to-head comparison data
export interface HeadToHead {
  player1Id: string;
  player2Id: string;
  matches: {
    id: string;
    date: string;
    player1Team: 'A' | 'B';
    player1Won: boolean;
    scoreFor: number;
    scoreAgainst: number;
    format: GameFormat;
    mode: string;
  }[];
  stats: {
    totalMatches: number;
    player1Wins: number;
    player2Wins: number;
    player1WinRate: number;
    player1AvgScore: number;
    player2AvgScore: number;
    lastMatch?: string;
  };
}

// Mock Players Data
export const mockPlayers: Player[] = [
  {
    id: '1',
    name: 'Jean-Pierre Martin',
    club: 'La Boule Lyonnaise',
    clubId: '1',
    role: 'Tireur',
    level: 'Expert',
    phone: '06 12 34 56 78',
    email: 'jp.martin@email.fr',
    location: { latitude: 45.764042, longitude: 4.835659, city: 'Lyon' },
    stats: {
      matchesPlayed: 156,
      wins: 98,
      losses: 58,
      winRate: 62.8,
      tirRate: 78.5,
      pointRate: 65.2,
      carreauRate: 12.4,
      avgPointsScored: 11.2,
      avgPointsConceded: 8.4,
      totalTirs: 890,
      totalTirsSuccess: 698,
      totalPoints: 456,
      totalPointsSuccess: 297,
    },
    createdAt: '2022-03-15',
  },
  {
    id: '2',
    name: 'Marie Dupont',
    club: 'Pétanque Club Marseillais',
    clubId: '2',
    role: 'Pointeur',
    level: 'Confirmé',
    phone: '06 98 76 54 32',
    email: 'marie.dupont@email.fr',
    location: { latitude: 43.296482, longitude: 5.369780, city: 'Marseille' },
    stats: {
      matchesPlayed: 89,
      wins: 52,
      losses: 37,
      winRate: 58.4,
      tirRate: 45.3,
      pointRate: 82.1,
      carreauRate: 5.2,
      avgPointsScored: 10.8,
      avgPointsConceded: 9.1,
      totalTirs: 234,
      totalTirsSuccess: 106,
      totalPoints: 678,
      totalPointsSuccess: 557,
    },
    createdAt: '2023-01-08',
  },
  {
    id: '3',
    name: 'Pierre Dubois',
    club: 'AS Pétanque Nice',
    clubId: '3',
    role: 'Milieu',
    level: 'Expert',
    email: 'p.dubois@petanque-nice.fr',
    location: { latitude: 43.710173, longitude: 7.261953, city: 'Nice' },
    stats: {
      matchesPlayed: 203,
      wins: 142,
      losses: 61,
      winRate: 69.9,
      tirRate: 72.1,
      pointRate: 74.8,
      carreauRate: 15.3,
      avgPointsScored: 11.8,
      avgPointsConceded: 7.6,
      totalTirs: 945,
      totalTirsSuccess: 681,
      totalPoints: 756,
      totalPointsSuccess: 565,
    },
    createdAt: '2021-06-20',
  },
  {
    id: '4',
    name: 'Sophie Bernard',
    club: 'La Boule Bordelaise',
    clubId: '4',
    role: 'Pointeur',
    level: 'Intermédiaire',
    location: { latitude: 44.837789, longitude: -0.579180, city: 'Bordeaux' },
    stats: {
      matchesPlayed: 45,
      wins: 22,
      losses: 23,
      winRate: 48.9,
      tirRate: 38.2,
      pointRate: 71.5,
      carreauRate: 3.1,
      avgPointsScored: 9.4,
      avgPointsConceded: 10.2,
      totalTirs: 112,
      totalTirsSuccess: 43,
      totalPoints: 234,
      totalPointsSuccess: 167,
    },
    createdAt: '2023-09-12',
  },
  {
    id: '5',
    name: 'Lucas Moreau',
    club: 'Pétanque Club Toulousain',
    clubId: '5',
    role: 'Tireur',
    level: 'Confirmé',
    location: { latitude: 43.604652, longitude: 1.444209, city: 'Toulouse' },
    stats: {
      matchesPlayed: 112,
      wins: 71,
      losses: 41,
      winRate: 63.4,
      tirRate: 76.8,
      pointRate: 58.3,
      carreauRate: 11.2,
      avgPointsScored: 10.9,
      avgPointsConceded: 8.7,
      totalTirs: 567,
      totalTirsSuccess: 435,
      totalPoints: 345,
      totalPointsSuccess: 201,
    },
    createdAt: '2022-07-03',
  },
  {
    id: '6',
    name: 'Emma Leroy',
    club: 'La Boule Lyonnaise',
    clubId: '1',
    role: 'Milieu',
    level: 'Confirmé',
    location: { latitude: 45.764042, longitude: 4.835659, city: 'Lyon' },
    stats: {
      matchesPlayed: 78,
      wins: 45,
      losses: 33,
      winRate: 57.7,
      tirRate: 65.4,
      pointRate: 69.8,
      carreauRate: 8.9,
      avgPointsScored: 10.5,
      avgPointsConceded: 9.3,
      totalTirs: 345,
      totalTirsSuccess: 226,
      totalPoints: 423,
      totalPointsSuccess: 295,
    },
    createdAt: '2023-02-28',
  },
  {
    id: '7',
    name: 'Thomas Garcia',
    club: 'Pétanque Club Marseillais',
    clubId: '2',
    role: 'Tireur',
    level: 'Expert',
    location: { latitude: 43.296482, longitude: 5.369780, city: 'Marseille' },
    stats: {
      matchesPlayed: 189,
      wins: 128,
      losses: 61,
      winRate: 67.7,
      tirRate: 81.2,
      pointRate: 52.4,
      carreauRate: 18.6,
      avgPointsScored: 11.5,
      avgPointsConceded: 7.9,
      totalTirs: 1023,
      totalTirsSuccess: 831,
      totalPoints: 312,
      totalPointsSuccess: 163,
    },
    createdAt: '2021-11-14',
  },
  {
    id: '8',
    name: 'Camille Roux',
    club: 'AS Pétanque Nice',
    clubId: '3',
    role: 'Pointeur',
    level: 'Débutant',
    location: { latitude: 43.710173, longitude: 7.261953, city: 'Nice' },
    stats: {
      matchesPlayed: 18,
      wins: 7,
      losses: 11,
      winRate: 38.9,
      tirRate: 32.1,
      pointRate: 58.6,
      carreauRate: 1.2,
      avgPointsScored: 8.2,
      avgPointsConceded: 11.4,
      totalTirs: 56,
      totalTirsSuccess: 18,
      totalPoints: 87,
      totalPointsSuccess: 51,
    },
    createdAt: '2024-01-05',
  },
  {
    id: '9',
    name: 'Antoine Lambert',
    club: 'Boulistes Parisiens',
    clubId: '6',
    role: 'Milieu',
    level: 'Intermédiaire',
    location: { latitude: 48.856614, longitude: 2.352222, city: 'Paris' },
    stats: {
      matchesPlayed: 56,
      wins: 28,
      losses: 28,
      winRate: 50.0,
      tirRate: 55.8,
      pointRate: 62.4,
      carreauRate: 6.3,
      avgPointsScored: 9.8,
      avgPointsConceded: 10.1,
      totalTirs: 234,
      totalTirsSuccess: 131,
      totalPoints: 289,
      totalPointsSuccess: 180,
    },
    createdAt: '2023-05-22',
  },
  {
    id: '10',
    name: 'Julie Petit',
    club: 'Pétanque Club Nantais',
    clubId: '7',
    role: 'Pointeur',
    level: 'Confirmé',
    location: { latitude: 47.218371, longitude: -1.553621, city: 'Nantes' },
    stats: {
      matchesPlayed: 92,
      wins: 58,
      losses: 34,
      winRate: 63.0,
      tirRate: 41.7,
      pointRate: 85.3,
      carreauRate: 4.8,
      avgPointsScored: 11.1,
      avgPointsConceded: 8.5,
      totalTirs: 198,
      totalTirsSuccess: 83,
      totalPoints: 567,
      totalPointsSuccess: 484,
    },
    createdAt: '2022-09-08',
  },
];

// Mock Clubs Data
export const mockClubs: Club[] = [
  {
    id: '1',
    name: 'La Boule Lyonnaise',
    address: '15 Rue du Parc',
    city: 'Lyon',
    location: { latitude: 45.764042, longitude: 4.835659 },
    membersCount: 156,
    foundedYear: 1952,
    description: 'Club historique de Lyon, champion régional 2023',
    facilities: ['12 terrains', 'Club house', 'Parking', 'Bar'],
    contactEmail: 'contact@boule-lyonnaise.fr',
    contactPhone: '04 72 00 00 00',
  },
  {
    id: '2',
    name: 'Pétanque Club Marseillais',
    address: '42 Avenue du Prado',
    city: 'Marseille',
    location: { latitude: 43.296482, longitude: 5.369780 },
    membersCount: 203,
    foundedYear: 1948,
    description: 'Le plus grand club de la région PACA',
    facilities: ['18 terrains', 'Terrain couvert', 'Restaurant', 'Vestiaires'],
    contactEmail: 'pcm@petanque-marseille.fr',
  },
  {
    id: '3',
    name: 'AS Pétanque Nice',
    address: '8 Boulevard Gambetta',
    city: 'Nice',
    location: { latitude: 43.710173, longitude: 7.261953 },
    membersCount: 89,
    foundedYear: 1965,
    description: 'Club familial au cœur de Nice',
    facilities: ['8 terrains', 'École de pétanque', 'Parking'],
  },
  {
    id: '4',
    name: 'La Boule Bordelaise',
    address: '23 Quai des Chartrons',
    city: 'Bordeaux',
    location: { latitude: 44.837789, longitude: -0.579180 },
    membersCount: 67,
    foundedYear: 1978,
    description: 'Ambiance conviviale au bord de la Garonne',
    facilities: ['6 terrains', 'Bar', 'Terrasse'],
    contactPhone: '05 56 00 00 00',
  },
  {
    id: '5',
    name: 'Pétanque Club Toulousain',
    address: '5 Place du Capitole',
    city: 'Toulouse',
    location: { latitude: 43.604652, longitude: 1.444209 },
    membersCount: 134,
    foundedYear: 1955,
    description: 'Club compétitif avec école de formation',
    facilities: ['10 terrains', 'Salle de réunion', 'Vestiaires', 'Parking'],
  },
  {
    id: '6',
    name: 'Boulistes Parisiens',
    address: '18 Jardin des Tuileries',
    city: 'Paris',
    location: { latitude: 48.856614, longitude: 2.352222 },
    membersCount: 78,
    foundedYear: 1982,
    description: 'La pétanque au cœur de Paris',
    facilities: ['4 terrains', 'Club house'],
  },
  {
    id: '7',
    name: 'Pétanque Club Nantais',
    address: '12 Rue de la Loire',
    city: 'Nantes',
    location: { latitude: 47.218371, longitude: -1.553621 },
    membersCount: 92,
    foundedYear: 1971,
    description: 'Club dynamique de l\'Ouest',
    facilities: ['8 terrains', 'Bar', 'Terrain éclairé'],
  },
  {
    id: '8',
    name: 'La Boule Strasbourgeoise',
    address: '3 Place Kléber',
    city: 'Strasbourg',
    location: { latitude: 48.573405, longitude: 7.752111 },
    membersCount: 45,
    foundedYear: 1989,
    description: 'La pétanque alsacienne',
    facilities: ['5 terrains', 'Club house'],
  },
];

// Mock Terrains Data
export const mockTerrains: Terrain[] = [
  {
    id: 't1',
    name: 'Boulodrome Municipal Lyon',
    address: '15 Rue du Parc, 69006 Lyon',
    city: 'Lyon',
    location: { latitude: 45.764042, longitude: 4.835659 },
    type: 'Stabilisé',
    description: 'Boulodrome officiel de la ville de Lyon avec 12 terrains de compétition.',
    facilities: ['Vestiaires', 'Bar', 'Parking', 'Éclairage'],
    clubId: '1',
    clubName: 'La Boule Lyonnaise',
    isPublic: true,
    courtsCount: 12,
    lighting: true,
    covered: false,
    createdAt: '2022-01-15',
  },
  {
    id: 't2',
    name: 'Terrain du Prado',
    address: '42 Avenue du Prado, 13008 Marseille',
    city: 'Marseille',
    location: { latitude: 43.296482, longitude: 5.369780 },
    type: 'Graviers',
    description: 'Terrain gravillonné historique de Marseille, idéal pour le jeu porté.',
    facilities: ['Restaurant', 'Vestiaires', 'Tribune'],
    clubId: '2',
    clubName: 'Pétanque Club Marseillais',
    isPublic: true,
    courtsCount: 18,
    lighting: true,
    covered: true,
    createdAt: '2021-06-20',
  },
  {
    id: 't3',
    name: 'Plage Pétanque Nice',
    address: 'Promenade des Anglais, 06000 Nice',
    city: 'Nice',
    location: { latitude: 43.694852, longitude: 7.265722 },
    type: 'Sable',
    description: 'Terrain de plage unique avec vue sur la Méditerranée. Parfait pour le point plombé.',
    facilities: ['Bar de plage', 'Douches'],
    isPublic: true,
    courtsCount: 6,
    lighting: false,
    covered: false,
    createdAt: '2023-04-10',
  },
  {
    id: 't4',
    name: 'Terrain des Chartrons',
    address: '23 Quai des Chartrons, 33000 Bordeaux',
    city: 'Bordeaux',
    location: { latitude: 44.860000, longitude: -0.570000 },
    type: 'Terre battue',
    description: 'Terrain naturel au bord de la Garonne, ambiance conviviale.',
    facilities: ['Bar', 'Terrasse'],
    clubId: '4',
    clubName: 'La Boule Bordelaise',
    isPublic: true,
    courtsCount: 6,
    lighting: true,
    covered: false,
    createdAt: '2022-09-01',
  },
  {
    id: 't5',
    name: 'Boulodrome Toulouse',
    address: '5 Place du Capitole, 31000 Toulouse',
    city: 'Toulouse',
    location: { latitude: 43.604652, longitude: 1.444209 },
    type: 'Stabilisé',
    description: 'Centre de formation officiel avec terrains aux normes fédérales.',
    facilities: ['Salle de réunion', 'Vestiaires', 'Parking', 'Éclairage'],
    clubId: '5',
    clubName: 'Pétanque Club Toulousain',
    isPublic: true,
    courtsCount: 10,
    lighting: true,
    covered: false,
    createdAt: '2021-03-15',
  },
  {
    id: 't6',
    name: 'Jardin des Tuileries',
    address: '18 Jardin des Tuileries, 75001 Paris',
    city: 'Paris',
    location: { latitude: 48.863300, longitude: 2.327500 },
    type: 'Cailloux',
    description: 'Terrain caillouteux technique au cœur de Paris. Réservé aux joueurs expérimentés.',
    facilities: ['Club house'],
    clubId: '6',
    clubName: 'Boulistes Parisiens',
    isPublic: true,
    courtsCount: 4,
    lighting: false,
    covered: false,
    createdAt: '2023-01-20',
  },
  {
    id: 't7',
    name: 'Terrain de la Loire',
    address: '12 Rue de la Loire, 44000 Nantes',
    city: 'Nantes',
    location: { latitude: 47.218371, longitude: -1.553621 },
    type: 'Stabilisé',
    description: 'Terrain éclairé pour les parties nocturnes, idéal pour les soirées d\'été.',
    facilities: ['Bar', 'Éclairage nocturne'],
    clubId: '7',
    clubName: 'Pétanque Club Nantais',
    isPublic: true,
    courtsCount: 8,
    lighting: true,
    covered: false,
    createdAt: '2022-07-05',
  },
  {
    id: 't8',
    name: 'Boulodrome Alsacien',
    address: '3 Place Kléber, 67000 Strasbourg',
    city: 'Strasbourg',
    location: { latitude: 48.573405, longitude: 7.752111 },
    type: 'Graviers',
    description: 'Terrain couvert permettant de jouer toute l\'année.',
    facilities: ['Club house', 'Chauffage'],
    clubId: '8',
    clubName: 'La Boule Strasbourgeoise',
    isPublic: true,
    courtsCount: 5,
    lighting: true,
    covered: true,
    createdAt: '2023-02-28',
  },
];

// Mock tournament with bracket system
const sampleBracketMatches: BracketMatch[] = [
  // Round 1 (Quarter-finals)
  { id: 'b1', round: 1, position: 1, teamA: { name: 'Équipe Lyon 1', score: 13 }, teamB: { name: 'Équipe Nice', score: 8 }, winner: 'A', status: 'completed' },
  { id: 'b2', round: 1, position: 2, teamA: { name: 'Équipe Marseille', score: 13 }, teamB: { name: 'Équipe Bordeaux', score: 11 }, winner: 'A', status: 'completed' },
  { id: 'b3', round: 1, position: 3, teamA: { name: 'Équipe Toulouse', score: 10 }, teamB: { name: 'Équipe Paris', score: 13 }, winner: 'B', status: 'completed' },
  { id: 'b4', round: 1, position: 4, teamA: { name: 'Équipe Nantes', score: 13 }, teamB: { name: 'Équipe Lyon 2', score: 9 }, winner: 'A', status: 'completed' },
  // Round 2 (Semi-finals)
  { id: 'b5', round: 2, position: 1, teamA: { name: 'Équipe Lyon 1', score: 13 }, teamB: { name: 'Équipe Marseille', score: 12 }, winner: 'A', status: 'completed' },
  { id: 'b6', round: 2, position: 2, teamA: { name: 'Équipe Paris' }, teamB: { name: 'Équipe Nantes' }, status: 'in_progress' },
  // Round 3 (Final)
  { id: 'b7', round: 3, position: 1, teamA: { name: 'Équipe Lyon 1' }, status: 'pending' },
];

const samplePhases: TournamentPhase[] = [
  {
    id: 'p1',
    name: 'Quarts de finale',
    type: 'elimination',
    order: 1,
    matches: sampleBracketMatches.filter(m => m.round === 1),
  },
  {
    id: 'p2',
    name: 'Demi-finales',
    type: 'elimination',
    order: 2,
    matches: sampleBracketMatches.filter(m => m.round === 2),
  },
  {
    id: 'p3',
    name: 'Finale',
    type: 'final',
    order: 3,
    matches: sampleBracketMatches.filter(m => m.round === 3),
  },
];

// Mock Tournaments Data
export const mockTournaments: Tournament[] = [
  {
    id: '1',
    name: 'Tournoi de Printemps Lyon',
    date: '2026-04-15',
    type: 'Poules',
    format: 'Doublette',
    location: { name: 'Parc de la Tête d\'Or', city: 'Lyon', latitude: 45.780000, longitude: 4.855000 },
    clubId: '1',
    clubName: 'La Boule Lyonnaise',
    status: 'À venir',
    participants: 24,
    maxParticipants: 32,
    prize: '500€',
    description: 'Tournoi annuel ouvert à tous les licenciés - Format poules uniquement',
  },
  {
    id: '2',
    name: 'Championnat Régional PACA',
    date: '2026-02-01',
    endDate: '2026-02-02',
    type: 'Mixte',
    format: 'Triplette',
    location: { name: 'Boulodrome du Prado', city: 'Marseille', latitude: 43.270000, longitude: 5.380000 },
    clubId: '2',
    clubName: 'Pétanque Club Marseillais',
    status: 'En cours',
    participants: 48,
    maxParticipants: 48,
    prize: '2000€',
    phases: samplePhases,
    currentPhaseId: 'p2',
    teams: [
      { id: 't1', name: 'Équipe Lyon 1', playerIds: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], stats: { wins: 3, losses: 0, pointsFor: 39, pointsAgainst: 29, pointDiff: 10 } },
      { id: 't2', name: 'Équipe Marseille', playerIds: ['2', '7'], playerNames: ['Marie Dupont', 'Thomas Garcia'], stats: { wins: 2, losses: 1, pointsFor: 38, pointsAgainst: 34, pointDiff: 4 } },
      { id: 't3', name: 'Équipe Paris', playerIds: ['9'], playerNames: ['Antoine Lambert'], stats: { wins: 2, losses: 1, pointsFor: 36, pointsAgainst: 33, pointDiff: 3 } },
      { id: 't4', name: 'Équipe Nantes', playerIds: ['10'], playerNames: ['Julie Petit'], stats: { wins: 2, losses: 1, pointsFor: 35, pointsAgainst: 31, pointDiff: 4 } },
    ],
  },
  {
    id: '3',
    name: 'Open de Nice',
    date: '2026-05-10',
    type: 'Élimination directe',
    format: 'Doublette',
    location: { name: 'Place Masséna', city: 'Nice', latitude: 43.696940, longitude: 7.270590 },
    clubId: '3',
    clubName: 'AS Pétanque Nice',
    status: 'À venir',
    participants: 12,
    maxParticipants: 24,
    prize: '300€',
  },
  {
    id: '4',
    name: 'Concours Mensuel Bordeaux',
    date: '2026-01-28',
    type: 'Suisse',
    format: 'Tête-à-tête',
    location: { name: 'Boulodrome des Chartrons', city: 'Bordeaux', latitude: 44.860000, longitude: -0.570000 },
    clubId: '4',
    clubName: 'La Boule Bordelaise',
    status: 'Terminé',
    participants: 16,
    maxParticipants: 16,
  },
  {
    id: '5',
    name: 'Trophée Toulousain',
    date: '2026-06-01',
    endDate: '2026-06-02',
    type: 'A/B/C',
    format: 'Triplette',
    location: { name: 'Prairie des Filtres', city: 'Toulouse', latitude: 43.600000, longitude: 1.430000 },
    clubId: '5',
    clubName: 'Pétanque Club Toulousain',
    status: 'À venir',
    participants: 8,
    maxParticipants: 32,
    prize: '1500€',
    description: 'Grand tournoi de l\'été avec animations - Format A/B/C avec repêchage',
  },
  {
    id: '6',
    name: 'Paris Pétanque Open',
    date: '2026-07-14',
    type: 'Tirage intégral',
    format: 'Doublette',
    location: { name: 'Jardin des Tuileries', city: 'Paris', latitude: 48.863300, longitude: 2.327500 },
    clubId: '6',
    clubName: 'Boulistes Parisiens',
    status: 'À venir',
    participants: 6,
    maxParticipants: 20,
    description: 'Tournoi du 14 juillet - Tirage intégral au début',
  },
  {
    id: '7',
    name: 'Tournoi Amical Strasbourg',
    date: '2026-03-20',
    type: 'Autre',
    format: 'Doublette',
    location: { name: 'Place Kléber', city: 'Strasbourg', latitude: 48.573405, longitude: 7.752111 },
    clubId: '8',
    clubName: 'La Boule Strasbourgeoise',
    status: 'À venir',
    participants: 10,
    maxParticipants: 16,
    description: 'Format libre et convivial',
  },
];

// Mock Matches Data with player actions
export const mockMatches: Match[] = [
  // Matchs d'entraînement
  {
    id: '1',
    date: '2026-02-05T14:30:00',
    mode: 'Entraînement',
    format: 'Doublette',
    teamA: {
      players: ['1', '6'],
      playerNames: ['Jean-Pierre Martin', 'Emma Leroy'],
      score: 13,
    },
    teamB: {
      players: ['2', '9'],
      playerNames: ['Marie Dupont', 'Antoine Lambert'],
      score: 8,
    },
    winner: 'A',
    duration: 45,
    menes: [],
    playerActions: [
      { playerId: '1', playerName: 'Jean-Pierre Martin', team: 'A', actions: { tirs: 12, tirsSuccess: 10, points: 5, pointsSuccess: 4, carreaux: 2 } },
      { playerId: '6', playerName: 'Emma Leroy', team: 'A', actions: { tirs: 6, tirsSuccess: 4, points: 8, pointsSuccess: 6, carreaux: 1 } },
      { playerId: '2', playerName: 'Marie Dupont', team: 'B', actions: { tirs: 4, tirsSuccess: 2, points: 10, pointsSuccess: 7, carreaux: 0 } },
      { playerId: '9', playerName: 'Antoine Lambert', team: 'B', actions: { tirs: 8, tirsSuccess: 5, points: 6, pointsSuccess: 4, carreaux: 0 } },
    ],
  },
  {
    id: '3',
    date: '2026-02-03T10:00:00',
    mode: 'Entraînement',
    format: 'Tête-à-tête',
    teamA: {
      players: ['1'],
      playerNames: ['Jean-Pierre Martin'],
      score: 13,
    },
    teamB: {
      players: ['5'],
      playerNames: ['Lucas Moreau'],
      score: 6,
    },
    winner: 'A',
    duration: 35,
    menes: [],
    playerActions: [
      { playerId: '1', playerName: 'Jean-Pierre Martin', team: 'A', actions: { tirs: 15, tirsSuccess: 13, points: 8, pointsSuccess: 6, carreaux: 3 } },
      { playerId: '5', playerName: 'Lucas Moreau', team: 'B', actions: { tirs: 12, tirsSuccess: 8, points: 10, pointsSuccess: 5, carreaux: 1 } },
    ],
  },
  {
    id: '4',
    date: '2026-02-01T15:00:00',
    mode: 'Entraînement',
    format: 'Doublette',
    teamA: {
      players: ['10', '4'],
      playerNames: ['Julie Petit', 'Sophie Bernard'],
      score: 9,
    },
    teamB: {
      players: ['6', '8'],
      playerNames: ['Emma Leroy', 'Camille Roux'],
      score: 13,
    },
    winner: 'B',
    duration: 52,
    menes: [],
  },
  // Matchs de tournoi - Championnat Régional PACA (Mixte: Poules puis Élimination)
  {
    id: '2',
    date: '2026-02-01T09:00:00',
    mode: 'Tournoi',
    format: 'Triplette',
    tournamentId: '2',
    tournamentName: 'Championnat Régional PACA',
    tournamentPhase: 'Poules',
    teamA: {
      players: ['1', '6', '3'],
      playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Pierre Dubois'],
      score: 13,
    },
    teamB: {
      players: ['5', '4', '8'],
      playerNames: ['Lucas Moreau', 'Sophie Bernard', 'Camille Roux'],
      score: 8,
    },
    winner: 'A',
    duration: 48,
    menes: [],
    playerActions: [
      { playerId: '1', playerName: 'Jean-Pierre Martin', team: 'A', actions: { tirs: 10, tirsSuccess: 8, points: 4, pointsSuccess: 3, carreaux: 2 } },
      { playerId: '6', playerName: 'Emma Leroy', team: 'A', actions: { tirs: 5, tirsSuccess: 3, points: 6, pointsSuccess: 5, carreaux: 0 } },
      { playerId: '3', playerName: 'Pierre Dubois', team: 'A', actions: { tirs: 6, tirsSuccess: 5, points: 5, pointsSuccess: 4, carreaux: 1 } },
      { playerId: '5', playerName: 'Lucas Moreau', team: 'B', actions: { tirs: 9, tirsSuccess: 6, points: 3, pointsSuccess: 2, carreaux: 1 } },
      { playerId: '4', playerName: 'Sophie Bernard', team: 'B', actions: { tirs: 4, tirsSuccess: 2, points: 7, pointsSuccess: 4, carreaux: 0 } },
      { playerId: '8', playerName: 'Camille Roux', team: 'B', actions: { tirs: 3, tirsSuccess: 1, points: 5, pointsSuccess: 3, carreaux: 0 } },
    ],
  },
  {
    id: '10',
    date: '2026-02-01T11:30:00',
    mode: 'Tournoi',
    format: 'Triplette',
    tournamentId: '2',
    tournamentName: 'Championnat Régional PACA',
    tournamentPhase: 'Poules',
    teamA: {
      players: ['1', '6', '3'],
      playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Pierre Dubois'],
      score: 13,
    },
    teamB: {
      players: ['2', '7', '9'],
      playerNames: ['Marie Dupont', 'Thomas Garcia', 'Antoine Lambert'],
      score: 11,
    },
    winner: 'A',
    duration: 55,
    menes: [],
    playerActions: [
      { playerId: '1', playerName: 'Jean-Pierre Martin', team: 'A', actions: { tirs: 11, tirsSuccess: 9, points: 3, pointsSuccess: 2, carreaux: 2 } },
      { playerId: '6', playerName: 'Emma Leroy', team: 'A', actions: { tirs: 4, tirsSuccess: 3, points: 7, pointsSuccess: 5, carreaux: 0 } },
      { playerId: '3', playerName: 'Pierre Dubois', team: 'A', actions: { tirs: 7, tirsSuccess: 5, points: 4, pointsSuccess: 3, carreaux: 1 } },
      { playerId: '2', playerName: 'Marie Dupont', team: 'B', actions: { tirs: 3, tirsSuccess: 2, points: 9, pointsSuccess: 7, carreaux: 0 } },
      { playerId: '7', playerName: 'Thomas Garcia', team: 'B', actions: { tirs: 12, tirsSuccess: 10, points: 2, pointsSuccess: 1, carreaux: 3 } },
      { playerId: '9', playerName: 'Antoine Lambert', team: 'B', actions: { tirs: 6, tirsSuccess: 4, points: 5, pointsSuccess: 3, carreaux: 0 } },
    ],
  },
  {
    id: '11',
    date: '2026-02-01T14:30:00',
    mode: 'Tournoi',
    format: 'Triplette',
    tournamentId: '2',
    tournamentName: 'Championnat Régional PACA',
    tournamentPhase: '1/8 finale',
    tournamentBracket: 'A',
    teamA: {
      players: ['1', '6', '3'],
      playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Pierre Dubois'],
      score: 13,
    },
    teamB: {
      players: ['10'],
      playerNames: ['Julie Petit'],
      score: 9,
    },
    winner: 'A',
    duration: 42,
    menes: [],
    playerActions: [
      { playerId: '1', playerName: 'Jean-Pierre Martin', team: 'A', actions: { tirs: 9, tirsSuccess: 7, points: 5, pointsSuccess: 4, carreaux: 1 } },
      { playerId: '6', playerName: 'Emma Leroy', team: 'A', actions: { tirs: 5, tirsSuccess: 4, points: 6, pointsSuccess: 5, carreaux: 1 } },
      { playerId: '3', playerName: 'Pierre Dubois', team: 'A', actions: { tirs: 6, tirsSuccess: 4, points: 4, pointsSuccess: 3, carreaux: 0 } },
      { playerId: '10', playerName: 'Julie Petit', team: 'B', actions: { tirs: 8, tirsSuccess: 5, points: 10, pointsSuccess: 6, carreaux: 0 } },
    ],
  },
  {
    id: '12',
    date: '2026-02-01T17:00:00',
    mode: 'Tournoi',
    format: 'Triplette',
    tournamentId: '2',
    tournamentName: 'Championnat Régional PACA',
    tournamentPhase: 'Quart de finale',
    tournamentBracket: 'A',
    teamA: {
      players: ['1', '6', '3'],
      playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Pierre Dubois'],
      score: 13,
    },
    teamB: {
      players: ['7', '2'],
      playerNames: ['Thomas Garcia', 'Marie Dupont'],
      score: 12,
    },
    winner: 'A',
    duration: 65,
    menes: [],
    playerActions: [
      { playerId: '1', playerName: 'Jean-Pierre Martin', team: 'A', actions: { tirs: 14, tirsSuccess: 11, points: 4, pointsSuccess: 3, carreaux: 3 } },
      { playerId: '6', playerName: 'Emma Leroy', team: 'A', actions: { tirs: 6, tirsSuccess: 4, points: 8, pointsSuccess: 6, carreaux: 1 } },
      { playerId: '3', playerName: 'Pierre Dubois', team: 'A', actions: { tirs: 8, tirsSuccess: 6, points: 5, pointsSuccess: 4, carreaux: 1 } },
      { playerId: '7', playerName: 'Thomas Garcia', team: 'B', actions: { tirs: 15, tirsSuccess: 12, points: 2, pointsSuccess: 1, carreaux: 4 } },
      { playerId: '2', playerName: 'Marie Dupont', team: 'B', actions: { tirs: 4, tirsSuccess: 2, points: 11, pointsSuccess: 8, carreaux: 0 } },
    ],
  },
  // Match de tournoi - Concours Mensuel Bordeaux (Suisse)
  {
    id: '5',
    date: '2026-01-28T09:00:00',
    mode: 'Tournoi',
    format: 'Tête-à-tête',
    tournamentId: '4',
    tournamentName: 'Concours Mensuel Bordeaux',
    tournamentPhase: 'Ronde 1',
    teamA: {
      players: ['4'],
      playerNames: ['Sophie Bernard'],
      score: 13,
    },
    teamB: {
      players: ['10'],
      playerNames: ['Julie Petit'],
      score: 10,
    },
    winner: 'A',
    duration: 38,
    menes: [],
  },
  {
    id: '6',
    date: '2026-01-28T10:30:00',
    mode: 'Tournoi',
    format: 'Tête-à-tête',
    tournamentId: '4',
    tournamentName: 'Concours Mensuel Bordeaux',
    tournamentPhase: 'Ronde 2',
    teamA: {
      players: ['4'],
      playerNames: ['Sophie Bernard'],
      score: 11,
    },
    teamB: {
      players: ['3'],
      playerNames: ['Pierre Dubois'],
      score: 13,
    },
    winner: 'B',
    duration: 45,
    menes: [],
  },
  {
    id: '7',
    date: '2026-01-28T13:00:00',
    mode: 'Tournoi',
    format: 'Tête-à-tête',
    tournamentId: '4',
    tournamentName: 'Concours Mensuel Bordeaux',
    tournamentPhase: 'Ronde 3',
    teamA: {
      players: ['4'],
      playerNames: ['Sophie Bernard'],
      score: 13,
    },
    teamB: {
      players: ['9'],
      playerNames: ['Antoine Lambert'],
      score: 8,
    },
    winner: 'A',
    duration: 35,
    menes: [],
  },
  {
    id: '8',
    date: '2026-01-28T15:00:00',
    mode: 'Tournoi',
    format: 'Tête-à-tête',
    tournamentId: '4',
    tournamentName: 'Concours Mensuel Bordeaux',
    tournamentPhase: 'Ronde 4',
    teamA: {
      players: ['4'],
      playerNames: ['Sophie Bernard'],
      score: 13,
    },
    teamB: {
      players: ['8'],
      playerNames: ['Camille Roux'],
      score: 5,
    },
    winner: 'A',
    duration: 28,
    menes: [],
  },
  {
    id: '9',
    date: '2026-01-28T16:30:00',
    mode: 'Tournoi',
    format: 'Tête-à-tête',
    tournamentId: '4',
    tournamentName: 'Concours Mensuel Bordeaux',
    tournamentPhase: 'Ronde 5',
    teamA: {
      players: ['4'],
      playerNames: ['Sophie Bernard'],
      score: 12,
    },
    teamB: {
      players: ['1'],
      playerNames: ['Jean-Pierre Martin'],
      score: 13,
    },
    winner: 'B',
    duration: 52,
    menes: [],
    playerActions: [
      { playerId: '4', playerName: 'Sophie Bernard', team: 'A', actions: { tirs: 8, tirsSuccess: 5, points: 12, pointsSuccess: 8, carreaux: 0 } },
      { playerId: '1', playerName: 'Jean-Pierre Martin', team: 'B', actions: { tirs: 14, tirsSuccess: 11, points: 6, pointsSuccess: 5, carreaux: 2 } },
    ],
  },
];

// Current user stats (for dashboard)
// Mock Challenges Data
export const mockChallenges: Challenge[] = [
  {
    id: 'c1',
    type: '10_tirs',
    date: '2026-02-06T10:30:00',
    playerId: '1',
    playerName: 'Jean-Pierre Martin',
    shots: [
      { number: 1, success: true, timestamp: '2026-02-06T10:30:05' },
      { number: 2, success: true, carreau: true, timestamp: '2026-02-06T10:30:25' },
      { number: 3, success: false, timestamp: '2026-02-06T10:30:45' },
      { number: 4, success: true, timestamp: '2026-02-06T10:31:05' },
      { number: 5, success: true, timestamp: '2026-02-06T10:31:25' },
      { number: 6, success: true, timestamp: '2026-02-06T10:31:45' },
      { number: 7, success: false, timestamp: '2026-02-06T10:32:05' },
      { number: 8, success: true, timestamp: '2026-02-06T10:32:25' },
      { number: 9, success: true, timestamp: '2026-02-06T10:32:45' },
      { number: 10, success: true, timestamp: '2026-02-06T10:33:05' },
    ],
    successCount: 8,
    totalShots: 10,
    carreauCount: 1,
    successRate: 80,
    duration: 185,
  },
  {
    id: 'c2',
    type: '10_tirs_sautee',
    date: '2026-02-05T15:00:00',
    playerId: '1',
    playerName: 'Jean-Pierre Martin',
    shots: [
      { number: 1, success: true, timestamp: '2026-02-05T15:00:05' },
      { number: 2, success: false, timestamp: '2026-02-05T15:00:25' },
      { number: 3, success: true, timestamp: '2026-02-05T15:00:45' },
      { number: 4, success: false, timestamp: '2026-02-05T15:01:05' },
      { number: 5, success: true, timestamp: '2026-02-05T15:01:25' },
      { number: 6, success: true, timestamp: '2026-02-05T15:01:45' },
      { number: 7, success: false, timestamp: '2026-02-05T15:02:05' },
      { number: 8, success: true, timestamp: '2026-02-05T15:02:25' },
      { number: 9, success: false, timestamp: '2026-02-05T15:02:45' },
      { number: 10, success: true, timestamp: '2026-02-05T15:03:05' },
    ],
    successCount: 6,
    totalShots: 10,
    carreauCount: 0,
    successRate: 60,
    duration: 180,
  },
  {
    id: 'c3',
    type: 'precision',
    date: '2026-02-04T11:00:00',
    playerId: '1',
    playerName: 'Jean-Pierre Martin',
    precisionShots: [
      { atelier: 'boule_seule', distance: 6, points: 5, timeUsed: 18, timestamp: '2026-02-04T11:00:30' },
      { atelier: 'boule_seule', distance: 7, points: 3, timeUsed: 22, timestamp: '2026-02-04T11:01:00' },
      { atelier: 'boule_seule', distance: 8, points: 3, timeUsed: 25, timestamp: '2026-02-04T11:01:30' },
      { atelier: 'boule_seule', distance: 9, points: 1, timeUsed: 28, timestamp: '2026-02-04T11:02:00' },
      { atelier: 'derriere_but', distance: 6, points: 3, timeUsed: 20, timestamp: '2026-02-04T11:02:30' },
      { atelier: 'derriere_but', distance: 7, points: 3, timeUsed: 23, timestamp: '2026-02-04T11:03:00' },
      { atelier: 'derriere_but', distance: 8, points: 1, timeUsed: 26, timestamp: '2026-02-04T11:03:30' },
      { atelier: 'derriere_but', distance: 9, points: 0, timeUsed: 30, timestamp: '2026-02-04T11:04:00' },
      { atelier: 'entre_2_boules', distance: 6, points: 5, timeUsed: 19, timestamp: '2026-02-04T11:04:30' },
      { atelier: 'entre_2_boules', distance: 7, points: 3, timeUsed: 21, timestamp: '2026-02-04T11:05:00' },
      { atelier: 'entre_2_boules', distance: 8, points: 1, timeUsed: 24, timestamp: '2026-02-04T11:05:30' },
      { atelier: 'entre_2_boules', distance: 9, points: 0, timeUsed: 30, timestamp: '2026-02-04T11:06:00' },
      { atelier: 'sautee', distance: 6, points: 3, timeUsed: 22, timestamp: '2026-02-04T11:06:30' },
      { atelier: 'sautee', distance: 7, points: 1, timeUsed: 25, timestamp: '2026-02-04T11:07:00' },
      { atelier: 'sautee', distance: 8, points: 1, timeUsed: 27, timestamp: '2026-02-04T11:07:30' },
      { atelier: 'sautee', distance: 9, points: 0, timeUsed: 30, timestamp: '2026-02-04T11:08:00' },
      { atelier: 'tir_but', distance: 6, points: 5, timeUsed: 15, timestamp: '2026-02-04T11:08:30' },
      { atelier: 'tir_but', distance: 7, points: 3, timeUsed: 18, timestamp: '2026-02-04T11:09:00' },
      { atelier: 'tir_but', distance: 8, points: 3, timeUsed: 22, timestamp: '2026-02-04T11:09:30' },
      { atelier: 'tir_but', distance: 9, points: 0, timeUsed: 30, timestamp: '2026-02-04T11:10:00' },
    ],
    totalPoints: 44,
    maxPoints: 100,
    atelierScores: {
      'boule_seule': 12,
      'derriere_but': 7,
      'entre_2_boules': 9,
      'sautee': 5,
      'tir_but': 11,
    },
    duration: 600,
  },
  {
    id: 'c4',
    type: '10_tirs',
    date: '2026-02-03T09:00:00',
    playerId: '1',
    playerName: 'Jean-Pierre Martin',
    shots: [
      { number: 1, success: true, timestamp: '2026-02-03T09:00:05' },
      { number: 2, success: true, timestamp: '2026-02-03T09:00:25' },
      { number: 3, success: true, carreau: true, timestamp: '2026-02-03T09:00:45' },
      { number: 4, success: true, timestamp: '2026-02-03T09:01:05' },
      { number: 5, success: false, timestamp: '2026-02-03T09:01:25' },
      { number: 6, success: true, timestamp: '2026-02-03T09:01:45' },
      { number: 7, success: true, carreau: true, timestamp: '2026-02-03T09:02:05' },
      { number: 8, success: true, timestamp: '2026-02-03T09:02:25' },
      { number: 9, success: true, timestamp: '2026-02-03T09:02:45' },
      { number: 10, success: false, timestamp: '2026-02-03T09:03:05' },
    ],
    successCount: 8,
    totalShots: 10,
    carreauCount: 2,
    successRate: 80,
    duration: 180,
  },
];

export const currentUserStats = {
  playerId: '1',
  playerName: 'Jean-Pierre Martin',
  totalMatches: 156,
  wins: 98,
  losses: 58,
  winRate: 62.8,
  currentStreak: 5,
  longestStreak: 12,
  tirSuccessRate: 78.5,
  pointSuccessRate: 65.2,
  carreauRate: 12.4,
  avgMatchDuration: 42,
  tournamentsWon: 8,
  tournamentsPlayed: 23,
  weeklyProgress: [
    { day: 'Lun', matches: 2, wins: 2 },
    { day: 'Mar', matches: 1, wins: 0 },
    { day: 'Mer', matches: 3, wins: 2 },
    { day: 'Jeu', matches: 0, wins: 0 },
    { day: 'Ven', matches: 2, wins: 2 },
    { day: 'Sam', matches: 4, wins: 3 },
    { day: 'Dim', matches: 1, wins: 1 },
  ],
  recentOpponents: [
    { id: '2', name: 'Marie Dupont', wins: 5, losses: 3 },
    { id: '5', name: 'Lucas Moreau', wins: 4, losses: 2 },
    { id: '3', name: 'Pierre Dubois', wins: 2, losses: 4 },
  ],
};
