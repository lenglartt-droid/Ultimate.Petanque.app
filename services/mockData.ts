// PetanqueScore Mock Data - Comprehensive Test Data

import { GameFormat, PlayerRole, TournamentType, TerrainType, TournamentLevel, TournamentCategory, RegistrationType, TournamentScope } from '@/constants/config';

// Boules set (equipment)
export interface BoulesSet {
  id: string;
  name: string;
  brand?: string;
  diameter?: number;
  weight?: number;
  serialNumber?: string;
  hardness?: string;
  isPrimary?: boolean;
  notes?: string;
  photo?: string;
  purchasePrice?: number;
}

// Boules info for player
export interface BoulesInfo {
  name?: string;
  diameter?: number; // mm
  weight?: number; // g
  serialNumber?: string;
}

export interface Player {
  id: string;
  name: string;
  nickname?: string;
  avatar?: string;
  club?: string;
  clubId?: string;
  role: PlayerRole;
  level: 'Débutant' | 'Intermédiaire' | 'Confirmé' | 'Expert';
  phone?: string;
  email?: string;
  terrainId?: string;
  terrainName?: string;
  country?: string;
  boules?: BoulesInfo;
  handedness?: 'right' | 'left' | 'ambidextrous';
  isPublic?: boolean;
  showContactPublic?: boolean;
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
  country?: string;
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
  terrainId?: string;
  terrainName?: string;
  membershipCost?: number;
  isPublic?: boolean;
  showContactPublic?: boolean;
  clubCardUrl?: string;
  website?: string;
  facebookUrl?: string;
  instagramHandle?: string;
}

export interface TournamentNotification {
  id: string;
  tournamentId: string;
  enabled: boolean;
  remindDaysBefore: number;
}

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
  publicAccess: boolean;
  courtsCount: number;
  lighting: boolean;
  covered: boolean;
  environment?: 'indoor' | 'outdoor';
  createdAt?: string;
}

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
  matchId?: string;
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
  teams?: TournamentTeam[];
  phases?: TournamentPhase[];
  currentPhaseId?: string;
  tournamentLevel?: TournamentLevel;
  tournamentCategory?: TournamentCategory;
  registrationType?: RegistrationType;
  tournamentScope?: TournamentScope;
  registrationCost?: number;
  prizeWon?: number;
  finalResult?: string;
  isPublic?: boolean;
}

export interface MatchPlayerRole {
  playerId: string;
  role: PlayerRole;
}

export interface SeriesInfo {
  seriesId: string;
  matchNumber: number;
  winsBeforeThisMatch: { teamA: number; teamB: number };
  isFinale?: boolean;
  seriesComplete?: boolean;
  seriesWinner?: 'A' | 'B';
}

export interface Match {
  id: string;
  date: string;
  mode: 'Entraînement' | 'Tournoi';
  format: GameFormat;
  tournamentId?: string;
  tournamentName?: string;
  tournamentPhase?: string;
  tournamentBracket?: 'A' | 'B' | 'C' | 'D';
  bracketMatchId?: string;
  terrainId?: string;
  terrainType?: string;
  boulesSetId?: string;
  teamA: {
    players: string[];
    playerNames: string[];
    playerRoles?: MatchPlayerRole[];
    score: number;
  };
  teamB: {
    players: string[];
    playerNames: string[];
    playerRoles?: MatchPlayerRole[];
    score: number;
  };
  winner: 'A' | 'B';
  duration: number;
  menes: Mene[];
  playerActions?: PlayerAction[];
  seriesInfo?: SeriesInfo;
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

// Detailed shot record for advanced notation
export interface DetailedShotRecord {
  id: string;
  timestamp: string;
  playerId: string;
  playerName?: string;
  team: 'A' | 'B';
  actionType: 'tir' | 'point';
  success: boolean;
  carreau?: boolean;
  // Tir details
  shotType?: 'au_fer' | 'au_plomb' | 'en_rafle' | 'court_ramasse' | 'carreau';
  shotResult?: 'court_droite' | 'court_gauche' | 'long' | 'tir_bouchon';
  shotQuality?: 'gain_point' | 'sans_effet' | 'negatif' | 'decisif';
  // Point details
  pointType?: 'roule' | 'plombe' | 'demi_portee' | 'portee';
  pointQuality?: 'excellent' | 'bon' | 'moyen' | 'rate' | 'crochete' | 'sorti';
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
  detailedShots?: DetailedShotRecord[];
}

export type ChallengeType = '10_tirs' | '10_tirs_sautee' | 'precision';

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
  timeUsed: number;
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

export type ChallengeMode = 'solo' | '1v1';

export interface ChallengePlayerResult {
  playerId: string;
  playerName: string;
  shots?: ChallengeShot[];
  precisionShots?: PrecisionShot[];
  successCount?: number;
  totalShots?: number;
  carreauCount?: number;
  successRate?: number;
  totalPoints?: number;
  atelierScores?: { [key in PrecisionAtelier]?: number };
}

// Detailed shot record for challenge notation
export interface ChallengeDetailedShot {
  id: string;
  timestamp: string;
  actionType: 'tir' | 'point';
  success: boolean;
  carreau?: boolean;
  // Tir details - success
  shotType?: 'au_fer' | 'au_plomb' | 'en_rafle' | 'court_ramasse' | 'carreau';
  // Tir details - failure result (where the shot went)
  shotResult?: 'court_droite' | 'court_gauche' | 'long' | 'tir_bouchon';
  /** @deprecated Use shotResult instead */
  failedShotType?: 'court_droite' | 'court_gauche' | 'long' | 'tir_bouchon';
  shotQuality?: 'gain_point' | 'sans_effet' | 'negatif' | 'decisif';
  // Point details
  pointType?: 'roule' | 'plombe' | 'demi_portee' | 'portee';
  pointQuality?: 'excellent' | 'bon' | 'moyen' | 'au_bouchon' | 'rate' | 'crochete' | 'sorti';
}

export interface Challenge {
  id: string;
  type: ChallengeType;
  mode: ChallengeMode;
  date: string;
  boulesSetId?: string;
  terrainId?: string;
  playerId?: string;
  playerName?: string;
  sponsorId?: string;
  sponsorName?: string;
  sponsorPhoto?: string;
  opponentId?: string;
  opponentName?: string;
  opponentResult?: ChallengePlayerResult;
  winner?: 'player' | 'opponent' | 'draw';
  shots?: ChallengeShot[];
  successCount?: number;
  totalShots?: number;
  carreauCount?: number;
  successRate?: number;
  precisionShots?: PrecisionShot[];
  totalPoints?: number;
  maxPoints?: number;
  atelierScores?: { [key in PrecisionAtelier]?: number };
  duration?: number;
  notes?: string;
  detailedShots?: ChallengeDetailedShot[];
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

// ============================================
// 20 MOCK PLAYERS
// ============================================
export const mockPlayers: Player[] = [
  {
    id: '1', name: 'Jean-Pierre Martin', nickname: 'JP', club: 'La Boule Lyonnaise', clubId: '1', role: 'Tireur', level: 'Expert',
    phone: '06 12 34 56 78', email: 'jp.martin@email.fr', country: 'France',
    location: { latitude: 45.764042, longitude: 4.835659, city: 'Lyon' },
    boules: { name: 'Obut ATX', diameter: 74, weight: 700 },
    stats: { matchesPlayed: 156, wins: 98, losses: 58, winRate: 62.8, tirRate: 78.5, pointRate: 65.2, carreauRate: 12.4, avgPointsScored: 11.2, avgPointsConceded: 8.4 },
    createdAt: '2022-03-15',
  },
  {
    id: '2', name: 'Marie Dupont', nickname: 'La Marseillaise', club: 'Pétanque Club Marseillais', clubId: '2', role: 'Pointeur', level: 'Confirmé',
    phone: '06 98 76 54 32', email: 'marie.dupont@email.fr', country: 'France',
    location: { latitude: 43.296482, longitude: 5.369780, city: 'Marseille' },
    stats: { matchesPlayed: 89, wins: 52, losses: 37, winRate: 58.4, tirRate: 45.3, pointRate: 82.1, carreauRate: 5.2, avgPointsScored: 10.8, avgPointsConceded: 9.1 },
    createdAt: '2023-01-08',
  },
  {
    id: '3', name: 'Pierre Dubois', nickname: 'Le Niçois', club: 'AS Pétanque Nice', clubId: '3', role: 'Milieu', level: 'Expert',
    email: 'p.dubois@petanque-nice.fr', country: 'France',
    location: { latitude: 43.710173, longitude: 7.261953, city: 'Nice' },
    stats: { matchesPlayed: 203, wins: 142, losses: 61, winRate: 69.9, tirRate: 72.1, pointRate: 74.8, carreauRate: 15.3, avgPointsScored: 11.8, avgPointsConceded: 7.6 },
    createdAt: '2021-06-20',
  },
  {
    id: '4', name: 'Sophie Bernard', club: 'La Boule Bordelaise', clubId: '4', role: 'Pointeur', level: 'Intermédiaire',
    country: 'France', location: { latitude: 44.837789, longitude: -0.579180, city: 'Bordeaux' },
    stats: { matchesPlayed: 45, wins: 22, losses: 23, winRate: 48.9, tirRate: 38.2, pointRate: 71.5, carreauRate: 3.1, avgPointsScored: 9.4, avgPointsConceded: 10.2 },
    createdAt: '2023-09-12',
  },
  {
    id: '5', name: 'Lucas Moreau', nickname: 'Lulu', club: 'Pétanque Club Toulousain', clubId: '5', role: 'Tireur', level: 'Confirmé',
    country: 'France', location: { latitude: 43.604652, longitude: 1.444209, city: 'Toulouse' },
    stats: { matchesPlayed: 112, wins: 71, losses: 41, winRate: 63.4, tirRate: 76.8, pointRate: 58.3, carreauRate: 11.2, avgPointsScored: 10.9, avgPointsConceded: 8.7 },
    createdAt: '2022-07-03',
  },
  {
    id: '6', name: 'Emma Leroy', club: 'La Boule Lyonnaise', clubId: '1', role: 'Milieu', level: 'Confirmé',
    country: 'France', location: { latitude: 45.764042, longitude: 4.835659, city: 'Lyon' },
    stats: { matchesPlayed: 78, wins: 45, losses: 33, winRate: 57.7, tirRate: 65.4, pointRate: 69.8, carreauRate: 8.9, avgPointsScored: 10.5, avgPointsConceded: 9.3 },
    createdAt: '2023-02-28',
  },
  {
    id: '7', name: 'Thomas Garcia', nickname: 'TomTom', club: 'Pétanque Club Marseillais', clubId: '2', role: 'Tireur', level: 'Expert',
    country: 'France', location: { latitude: 43.296482, longitude: 5.369780, city: 'Marseille' },
    stats: { matchesPlayed: 189, wins: 128, losses: 61, winRate: 67.7, tirRate: 81.2, pointRate: 52.4, carreauRate: 18.6, avgPointsScored: 11.5, avgPointsConceded: 7.9 },
    createdAt: '2021-11-14',
  },
  {
    id: '8', name: 'Camille Roux', club: 'AS Pétanque Nice', clubId: '3', role: 'Pointeur', level: 'Débutant',
    country: 'France', location: { latitude: 43.710173, longitude: 7.261953, city: 'Nice' },
    stats: { matchesPlayed: 18, wins: 7, losses: 11, winRate: 38.9, tirRate: 32.1, pointRate: 58.6, carreauRate: 1.2, avgPointsScored: 8.2, avgPointsConceded: 11.4 },
    createdAt: '2024-01-05',
  },
  {
    id: '9', name: 'Antoine Lambert', club: 'Boulistes Parisiens', clubId: '6', role: 'Milieu', level: 'Intermédiaire',
    country: 'France', location: { latitude: 48.856614, longitude: 2.352222, city: 'Paris' },
    stats: { matchesPlayed: 56, wins: 28, losses: 28, winRate: 50.0, tirRate: 55.8, pointRate: 62.4, carreauRate: 6.3, avgPointsScored: 9.8, avgPointsConceded: 10.1 },
    createdAt: '2023-05-22',
  },
  {
    id: '10', name: 'Julie Petit', nickname: 'Juju', club: 'Pétanque Club Nantais', role: 'Pointeur', level: 'Confirmé',
    country: 'France', location: { latitude: 47.218371, longitude: -1.553621, city: 'Nantes' },
    stats: { matchesPlayed: 92, wins: 58, losses: 34, winRate: 63.0, tirRate: 41.7, pointRate: 85.3, carreauRate: 4.8, avgPointsScored: 11.1, avgPointsConceded: 8.5 },
    createdAt: '2022-09-08',
  },
  {
    id: '11', name: 'François Mercier', nickname: 'Fanfan', club: 'La Boule Lyonnaise', clubId: '1', role: 'Tireur', level: 'Expert',
    phone: '06 11 22 33 44', country: 'France', location: { latitude: 45.764042, longitude: 4.835659, city: 'Lyon' },
    boules: { name: 'MS 2110', diameter: 73, weight: 690 },
    stats: { matchesPlayed: 234, wins: 167, losses: 67, winRate: 71.4, tirRate: 82.3, pointRate: 61.5, carreauRate: 19.2, avgPointsScored: 11.9, avgPointsConceded: 7.2 },
    createdAt: '2020-05-15',
  },
  {
    id: '12', name: 'Claire Fontaine', club: 'Pétanque Club Marseillais', clubId: '2', role: 'Pointeur', level: 'Confirmé',
    email: 'claire.f@email.fr', country: 'France', location: { latitude: 43.296482, longitude: 5.369780, city: 'Marseille' },
    stats: { matchesPlayed: 145, wins: 89, losses: 56, winRate: 61.4, tirRate: 48.2, pointRate: 79.8, carreauRate: 6.1, avgPointsScored: 10.7, avgPointsConceded: 8.9 },
    createdAt: '2021-08-20',
  },
  {
    id: '13', name: 'Maxime Durand', nickname: 'Max', club: 'AS Pétanque Nice', clubId: '3', role: 'Milieu', level: 'Intermédiaire',
    country: 'France', location: { latitude: 43.710173, longitude: 7.261953, city: 'Nice' },
    stats: { matchesPlayed: 67, wins: 35, losses: 32, winRate: 52.2, tirRate: 59.4, pointRate: 64.7, carreauRate: 7.8, avgPointsScored: 10.1, avgPointsConceded: 9.8 },
    createdAt: '2023-03-10',
  },
  {
    id: '14', name: 'Isabelle Martin', club: 'La Boule Bordelaise', clubId: '4', role: 'Tireur', level: 'Confirmé',
    country: 'France', location: { latitude: 44.837789, longitude: -0.579180, city: 'Bordeaux' },
    stats: { matchesPlayed: 98, wins: 61, losses: 37, winRate: 62.2, tirRate: 74.5, pointRate: 55.3, carreauRate: 10.8, avgPointsScored: 10.8, avgPointsConceded: 8.6 },
    createdAt: '2022-01-25',
  },
  {
    id: '15', name: 'Nicolas Blanc', nickname: 'Nico', club: 'Pétanque Club Toulousain', clubId: '5', role: 'Pointeur', level: 'Expert',
    phone: '06 55 44 33 22', country: 'France', location: { latitude: 43.604652, longitude: 1.444209, city: 'Toulouse' },
    stats: { matchesPlayed: 178, wins: 121, losses: 57, winRate: 68.0, tirRate: 52.1, pointRate: 88.4, carreauRate: 5.9, avgPointsScored: 11.4, avgPointsConceded: 7.8 },
    createdAt: '2020-11-30',
  },
  {
    id: '16', name: 'Sandrine Lefebvre', club: 'Boulistes Parisiens', clubId: '6', role: 'Milieu', level: 'Confirmé',
    country: 'France', location: { latitude: 48.856614, longitude: 2.352222, city: 'Paris' },
    stats: { matchesPlayed: 89, wins: 52, losses: 37, winRate: 58.4, tirRate: 62.7, pointRate: 71.2, carreauRate: 8.3, avgPointsScored: 10.4, avgPointsConceded: 9.1 },
    createdAt: '2022-06-18',
  },
  {
    id: '17', name: 'Olivier Girard', nickname: 'Olive', club: 'La Boule Lyonnaise', clubId: '1', role: 'Pointeur', level: 'Intermédiaire',
    country: 'France', location: { latitude: 45.764042, longitude: 4.835659, city: 'Lyon' },
    stats: { matchesPlayed: 54, wins: 27, losses: 27, winRate: 50.0, tirRate: 44.6, pointRate: 72.8, carreauRate: 4.2, avgPointsScored: 9.7, avgPointsConceded: 10.0 },
    createdAt: '2023-07-12',
  },
  {
    id: '18', name: 'Valérie Rousseau', club: 'Pétanque Club Marseillais', clubId: '2', role: 'Tireur', level: 'Débutant',
    country: 'France', location: { latitude: 43.296482, longitude: 5.369780, city: 'Marseille' },
    stats: { matchesPlayed: 23, wins: 9, losses: 14, winRate: 39.1, tirRate: 51.2, pointRate: 48.6, carreauRate: 2.8, avgPointsScored: 8.5, avgPointsConceded: 10.8 },
    createdAt: '2024-02-01',
  },
  {
    id: '19', name: 'Philippe Morel', nickname: 'Phil', club: 'AS Pétanque Nice', clubId: '3', role: 'Tireur', level: 'Expert',
    phone: '06 77 88 99 00', country: 'France', location: { latitude: 43.710173, longitude: 7.261953, city: 'Nice' },
    boules: { name: 'La Boule Noire', diameter: 75, weight: 710 },
    stats: { matchesPlayed: 212, wins: 152, losses: 60, winRate: 71.7, tirRate: 84.1, pointRate: 58.9, carreauRate: 21.3, avgPointsScored: 12.1, avgPointsConceded: 7.4 },
    createdAt: '2019-09-05',
  },
  {
    id: '20', name: 'Aurélie Simon', club: 'La Boule Bordelaise', clubId: '4', role: 'Milieu', level: 'Confirmé',
    email: 'aurelie.s@email.fr', country: 'France', location: { latitude: 44.837789, longitude: -0.579180, city: 'Bordeaux' },
    stats: { matchesPlayed: 76, wins: 44, losses: 32, winRate: 57.9, tirRate: 67.3, pointRate: 68.4, carreauRate: 9.1, avgPointsScored: 10.6, avgPointsConceded: 9.2 },
    createdAt: '2022-12-08',
  },
];

// ============================================
// 6 MOCK CLUBS
// ============================================
export const mockClubs: Club[] = [
  {
    id: '1', name: 'La Boule Lyonnaise', address: '15 Rue du Parc', city: 'Lyon', country: 'France',
    location: { latitude: 45.764042, longitude: 4.835659 }, membersCount: 156, foundedYear: 1952,
    description: 'Club historique de Lyon, champion régional 2023', facilities: ['12 terrains', 'Club house', 'Parking', 'Bar'],
    contactEmail: 'contact@boule-lyonnaise.fr', contactPhone: '04 72 00 00 00', terrainId: 't1', terrainName: 'Boulodrome Municipal Lyon',
  },
  {
    id: '2', name: 'Pétanque Club Marseillais', address: '42 Avenue du Prado', city: 'Marseille', country: 'France',
    location: { latitude: 43.296482, longitude: 5.369780 }, membersCount: 203, foundedYear: 1948,
    description: 'Le plus grand club de la région PACA', facilities: ['18 terrains', 'Terrain couvert', 'Restaurant', 'Vestiaires'],
    contactEmail: 'pcm@petanque-marseille.fr', terrainId: 't2', terrainName: 'Terrain du Prado',
  },
  {
    id: '3', name: 'AS Pétanque Nice', address: '8 Boulevard Gambetta', city: 'Nice', country: 'France',
    location: { latitude: 43.710173, longitude: 7.261953 }, membersCount: 89, foundedYear: 1965,
    description: 'Club familial au cœur de Nice', facilities: ['8 terrains', 'École de pétanque', 'Parking'], terrainId: 't3', terrainName: 'Boulodrome de Nice',
  },
  {
    id: '4', name: 'La Boule Bordelaise', address: '23 Quai des Chartrons', city: 'Bordeaux', country: 'France',
    location: { latitude: 44.837789, longitude: -0.579180 }, membersCount: 67, foundedYear: 1978,
    description: 'Ambiance conviviale au bord de la Garonne', facilities: ['6 terrains', 'Bar', 'Terrasse'],
    contactPhone: '05 56 00 00 00', terrainId: 't4', terrainName: 'Terrain des Chartrons',
  },
  {
    id: '5', name: 'Pétanque Club Toulousain', address: '5 Place du Capitole', city: 'Toulouse', country: 'France',
    location: { latitude: 43.604652, longitude: 1.444209 }, membersCount: 134, foundedYear: 1955,
    description: 'Club compétitif avec école de formation', facilities: ['10 terrains', 'Salle de réunion', 'Vestiaires', 'Parking'],
    terrainId: 't5', terrainName: 'Boulodrome Toulouse',
  },
  {
    id: '6', name: 'Boulistes Parisiens', address: '18 Jardin des Tuileries', city: 'Paris', country: 'France',
    location: { latitude: 48.856614, longitude: 2.352222 }, membersCount: 78, foundedYear: 1982,
    description: 'La pétanque au cœur de Paris', facilities: ['4 terrains', 'Club house'], terrainId: 't6', terrainName: 'Jardin des Tuileries',
  },
];

// ============================================
// 12 MOCK TERRAINS
// ============================================
export const mockTerrains: Terrain[] = [
  { id: 't1', name: 'Boulodrome Municipal Lyon', address: '15 Rue du Parc, 69006 Lyon', city: 'Lyon', location: { latitude: 45.764042, longitude: 4.835659 }, type: 'Stabilisé', description: 'Boulodrome officiel de la ville de Lyon avec 12 terrains de compétition.', facilities: ['Vestiaires', 'Bar', 'Parking', 'Éclairage'], clubId: '1', clubName: 'La Boule Lyonnaise', isPublic: true, publicAccess: true, courtsCount: 12, lighting: true, covered: false, environment: 'outdoor', createdAt: '2022-01-15' },
  { id: 't2', name: 'Terrain du Prado', address: '42 Avenue du Prado, 13008 Marseille', city: 'Marseille', location: { latitude: 43.296482, longitude: 5.369780 }, type: 'Graviers', description: 'Terrain gravillonné historique de Marseille.', facilities: ['Restaurant', 'Vestiaires', 'Tribune'], clubId: '2', clubName: 'Pétanque Club Marseillais', isPublic: true, publicAccess: true, courtsCount: 18, lighting: true, covered: true, environment: 'indoor', createdAt: '2021-06-20' },
  { id: 't3', name: 'Boulodrome de Nice', address: '8 Boulevard Gambetta, 06000 Nice', city: 'Nice', location: { latitude: 43.710173, longitude: 7.261953 }, type: 'Stabilisé', description: 'Boulodrome moderne avec vue sur la mer.', facilities: ['Bar', 'Douches', 'Parking'], clubId: '3', clubName: 'AS Pétanque Nice', isPublic: true, publicAccess: true, courtsCount: 8, lighting: true, covered: false, environment: 'outdoor', createdAt: '2023-04-10' },
  { id: 't4', name: 'Terrain des Chartrons', address: '23 Quai des Chartrons, 33000 Bordeaux', city: 'Bordeaux', location: { latitude: 44.860000, longitude: -0.570000 }, type: 'Terre battue', description: 'Terrain naturel au bord de la Garonne.', facilities: ['Bar', 'Terrasse'], clubId: '4', clubName: 'La Boule Bordelaise', isPublic: true, publicAccess: true, courtsCount: 6, lighting: true, covered: false, environment: 'outdoor', createdAt: '2022-09-01' },
  { id: 't5', name: 'Boulodrome Toulouse', address: '5 Place du Capitole, 31000 Toulouse', city: 'Toulouse', location: { latitude: 43.604652, longitude: 1.444209 }, type: 'Stabilisé', description: 'Centre de formation officiel.', facilities: ['Salle de réunion', 'Vestiaires', 'Parking', 'Éclairage'], clubId: '5', clubName: 'Pétanque Club Toulousain', isPublic: true, publicAccess: true, courtsCount: 10, lighting: true, covered: false, environment: 'outdoor', createdAt: '2021-03-15' },
  { id: 't6', name: 'Jardin des Tuileries', address: '18 Jardin des Tuileries, 75001 Paris', city: 'Paris', location: { latitude: 48.863300, longitude: 2.327500 }, type: 'Cailloux', description: 'Terrain historique au cœur de Paris.', facilities: ['Club house'], clubId: '6', clubName: 'Boulistes Parisiens', isPublic: true, publicAccess: true, courtsCount: 4, lighting: false, covered: false, environment: 'outdoor', createdAt: '2023-01-20' },
  { id: 't7', name: 'Plage Pétanque Nice', address: 'Promenade des Anglais, 06000 Nice', city: 'Nice', location: { latitude: 43.694852, longitude: 7.265722 }, type: 'Sable', description: 'Terrain de plage unique avec vue sur la Méditerranée.', facilities: ['Bar de plage', 'Douches'], isPublic: true, publicAccess: true, courtsCount: 6, lighting: false, covered: false, environment: 'outdoor', createdAt: '2023-05-15' },
  { id: 't8', name: 'Boulodrome Couvert Strasbourg', address: '3 Place Kléber, 67000 Strasbourg', city: 'Strasbourg', location: { latitude: 48.573405, longitude: 7.752111 }, type: 'Stabilisé', description: 'Boulodrome couvert pour jouer toute l\'année.', facilities: ['Club house', 'Chauffage', 'Vestiaires'], isPublic: true, publicAccess: true, courtsCount: 5, lighting: true, covered: true, environment: 'indoor', createdAt: '2023-02-28' },
  { id: 't9', name: 'Terrain de la Loire', address: '12 Rue de la Loire, 44000 Nantes', city: 'Nantes', location: { latitude: 47.218371, longitude: -1.553621 }, type: 'Stabilisé', description: 'Terrain éclairé pour les parties nocturnes.', facilities: ['Bar', 'Éclairage nocturne'], isPublic: true, publicAccess: true, courtsCount: 8, lighting: true, covered: false, environment: 'outdoor', createdAt: '2022-07-05' },
  { id: 't10', name: 'Boulodrome de Montpellier', address: '25 Avenue de la Mer, 34000 Montpellier', city: 'Montpellier', location: { latitude: 43.610769, longitude: 3.876716 }, type: 'Graviers', description: 'Grand boulodrome du sud avec terrains variés.', facilities: ['Restaurant', 'Parking', 'Tribune'], isPublic: true, publicAccess: true, courtsCount: 14, lighting: true, covered: false, environment: 'outdoor', createdAt: '2022-04-20' },
  { id: 't11', name: 'Terrain du Parc Borély', address: 'Parc Borély, 13008 Marseille', city: 'Marseille', location: { latitude: 43.261620, longitude: 5.384490 }, type: 'Terre battue', description: 'Terrain naturel dans le magnifique Parc Borély.', facilities: ['Snack', 'WC'], isPublic: true, publicAccess: true, courtsCount: 4, lighting: false, covered: false, environment: 'outdoor', createdAt: '2023-06-01' },
  { id: 't12', name: 'Boulodrome Indoor Lille', address: '10 Rue de la Gare, 59000 Lille', city: 'Lille', location: { latitude: 50.629250, longitude: 3.057256 }, type: 'Stabilisé', description: 'Boulodrome intérieur chauffé pour l\'hiver.', facilities: ['Vestiaires', 'Bar', 'Chauffage'], isPublic: true, publicAccess: true, courtsCount: 6, lighting: true, covered: true, environment: 'indoor', createdAt: '2023-09-15' },
];

// ============================================
// 10 MOCK TOURNAMENTS
// ============================================
export const mockTournaments: Tournament[] = [
  { id: 'tour1', name: 'Tournoi de Printemps Lyon', date: '2026-04-15', type: 'Poules', format: 'Doublette', location: { name: 'Boulodrome Municipal Lyon', city: 'Lyon', latitude: 45.780000, longitude: 4.855000 }, clubId: '1', clubName: 'La Boule Lyonnaise', terrainId: 't1', terrainName: 'Boulodrome Municipal Lyon', status: 'À venir', participants: 24, maxParticipants: 32, prize: '500€', description: 'Tournoi annuel ouvert à tous', registrationCost: 15 },
  { id: 'tour2', name: 'Championnat Régional PACA', date: '2026-02-01', endDate: '2026-02-02', type: 'Mixte', format: 'Triplette', location: { name: 'Boulodrome du Prado', city: 'Marseille', latitude: 43.270000, longitude: 5.380000 }, clubId: '2', clubName: 'Pétanque Club Marseillais', terrainId: 't2', status: 'Terminé', participants: 48, maxParticipants: 48, prize: '2000€', registrationCost: 30, prizeWon: 500, finalResult: 'Finaliste' },
  { id: 'tour3', name: 'Open de Nice', date: '2026-05-10', type: 'Élimination directe', format: 'Doublette', location: { name: 'Boulodrome de Nice', city: 'Nice', latitude: 43.696940, longitude: 7.270590 }, clubId: '3', clubName: 'AS Pétanque Nice', terrainId: 't3', status: 'À venir', participants: 12, maxParticipants: 24, prize: '300€', registrationCost: 10 },
  { id: 'tour4', name: 'Concours Mensuel Bordeaux', date: '2026-01-28', type: 'Suisse', format: 'Tête-à-tête', location: { name: 'Terrain des Chartrons', city: 'Bordeaux', latitude: 44.860000, longitude: -0.570000 }, clubId: '4', clubName: 'La Boule Bordelaise', terrainId: 't4', status: 'Terminé', participants: 16, maxParticipants: 16, registrationCost: 10, prizeWon: 50, finalResult: 'Champion' },
  { id: 'tour5', name: 'Trophée Toulousain', date: '2026-06-01', endDate: '2026-06-02', type: 'A/B/C', format: 'Triplette', location: { name: 'Boulodrome Toulouse', city: 'Toulouse', latitude: 43.600000, longitude: 1.430000 }, clubId: '5', clubName: 'Pétanque Club Toulousain', terrainId: 't5', status: 'À venir', participants: 8, maxParticipants: 32, prize: '1500€', description: 'Grand tournoi de l\'été', registrationCost: 25 },
  { id: 'tour6', name: 'Paris Pétanque Open', date: '2026-07-14', type: 'Tirage intégral', format: 'Doublette', location: { name: 'Jardin des Tuileries', city: 'Paris', latitude: 48.863300, longitude: 2.327500 }, clubId: '6', clubName: 'Boulistes Parisiens', terrainId: 't6', status: 'À venir', participants: 6, maxParticipants: 20, description: 'Tournoi du 14 juillet' },
  { id: 'tour7', name: 'Challenge d\'Automne Nantes', date: '2025-10-15', type: 'Poules', format: 'Doublette', location: { name: 'Terrain de la Loire', city: 'Nantes', latitude: 47.218371, longitude: -1.553621 }, terrainId: 't9', status: 'Terminé', participants: 20, maxParticipants: 24, prize: '400€', finalResult: 'Éliminé' },
  { id: 'tour8', name: 'Coupe de Montpellier', date: '2026-03-20', type: 'Élimination directe', format: 'Triplette', location: { name: 'Boulodrome de Montpellier', city: 'Montpellier', latitude: 43.610769, longitude: 3.876716 }, terrainId: 't10', status: 'À venir', participants: 18, maxParticipants: 32, prize: '800€', registrationCost: 20 },
  { id: 'tour9', name: 'Indoor Winter Cup Lille', date: '2026-01-15', type: 'Mixte', format: 'Doublette', location: { name: 'Boulodrome Indoor Lille', city: 'Lille', latitude: 50.629250, longitude: 3.057256 }, terrainId: 't12', status: 'Terminé', participants: 12, maxParticipants: 16, prize: '250€', finalResult: 'Champion', prizeWon: 250 },
  { id: 'tour10', name: 'Super Challenge Méditerranée', date: '2026-08-15', endDate: '2026-08-16', type: 'A/B/C', format: 'Triplette', location: { name: 'Terrain du Prado', city: 'Marseille', latitude: 43.296482, longitude: 5.369780 }, clubId: '2', terrainId: 't2', status: 'À venir', participants: 32, maxParticipants: 64, prize: '3000€', description: 'Le plus grand tournoi de l\'été', registrationCost: 40 },
];

// ============================================
// 50 MOCK MATCHES (Including Series)
// ============================================
const generateSeriesId = (base: number) => `series-${base}`;

export const mockMatches: Match[] = [
  // MATCHS AVEC NOTATION DÉTAILLÉE (pour tester les statistiques)
  { 
    id: 'mdetail1', 
    date: '2026-02-08T10:00:00', 
    mode: 'Entraînement', 
    format: 'Doublette', 
    teamA: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 }, 
    teamB: { players: ['2', '9'], playerNames: ['Marie Dupont', 'Antoine Lambert'], score: 9 }, 
    winner: 'A', 
    duration: 48, 
    menes: [
      { teamAPoints: 2, teamBPoints: 0, duration: 180 },
      { teamAPoints: 0, teamBPoints: 3, duration: 210 },
      { teamAPoints: 3, teamBPoints: 0, duration: 195 },
      { teamAPoints: 2, teamBPoints: 0, duration: 165 },
      { teamAPoints: 0, teamBPoints: 2, duration: 200 },
      { teamAPoints: 0, teamBPoints: 4, duration: 240 },
      { teamAPoints: 6, teamBPoints: 0, duration: 180 },
    ],
    playerActions: [
      {
        playerId: '1',
        playerName: 'Jean-Pierre Martin',
        team: 'A',
        actions: { tirs: 12, tirsSuccess: 9, points: 8, pointsSuccess: 6, carreaux: 3 },
        detailedShots: [
          // Tirs détaillés - Jean-Pierre
          { id: 'ds1', timestamp: '2026-02-08T10:05:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'gain_point' },
          { id: 'ds2', timestamp: '2026-02-08T10:08:00', playerId: '1', team: 'A', actionType: 'tir', success: true, carreau: true, shotType: 'carreau', shotQuality: 'gain_point' },
          { id: 'ds3', timestamp: '2026-02-08T10:12:00', playerId: '1', team: 'A', actionType: 'tir', success: false, shotType: 'au_plomb', shotResult: 'court_droite', shotQuality: 'negatif' },
          { id: 'ds4', timestamp: '2026-02-08T10:18:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'en_rafle', shotQuality: 'sans_effet' },
          { id: 'ds5', timestamp: '2026-02-08T10:22:00', playerId: '1', team: 'A', actionType: 'tir', success: true, carreau: true, shotType: 'carreau', shotQuality: 'gain_point' },
          { id: 'ds6', timestamp: '2026-02-08T10:28:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'decisif' },
          { id: 'ds7', timestamp: '2026-02-08T10:32:00', playerId: '1', team: 'A', actionType: 'tir', success: false, shotType: 'au_fer', shotResult: 'long', shotQuality: 'negatif' },
          { id: 'ds8', timestamp: '2026-02-08T10:38:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'gain_point' },
          { id: 'ds9', timestamp: '2026-02-08T10:42:00', playerId: '1', team: 'A', actionType: 'tir', success: true, carreau: true, shotType: 'carreau', shotQuality: 'gain_point' },
          { id: 'ds10', timestamp: '2026-02-08T10:45:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_plomb', shotQuality: 'sans_effet' },
          { id: 'ds11', timestamp: '2026-02-08T10:48:00', playerId: '1', team: 'A', actionType: 'tir', success: false, shotType: 'en_rafle', shotResult: 'court_gauche', shotQuality: 'negatif' },
          { id: 'ds12', timestamp: '2026-02-08T10:52:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'decisif' },
          // Points détaillés - Jean-Pierre
          { id: 'dp1', timestamp: '2026-02-08T10:06:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'excellent' },
          { id: 'dp2', timestamp: '2026-02-08T10:10:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'plombe', pointQuality: 'bon' },
          { id: 'dp3', timestamp: '2026-02-08T10:15:00', playerId: '1', team: 'A', actionType: 'point', success: false, pointType: 'demi_portee', pointQuality: 'rate' },
          { id: 'dp4', timestamp: '2026-02-08T10:20:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'moyen' },
          { id: 'dp5', timestamp: '2026-02-08T10:25:00', playerId: '1', team: 'A', actionType: 'point', success: false, pointType: 'portee', pointQuality: 'crochete' },
          { id: 'dp6', timestamp: '2026-02-08T10:30:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'plombe', pointQuality: 'excellent' },
          { id: 'dp7', timestamp: '2026-02-08T10:35:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'bon' },
          { id: 'dp8', timestamp: '2026-02-08T10:40:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'demi_portee', pointQuality: 'moyen' },
        ],
      },
      {
        playerId: '6',
        playerName: 'Emma Leroy',
        team: 'A',
        actions: { tirs: 8, tirsSuccess: 5, points: 10, pointsSuccess: 7, carreaux: 1 },
        detailedShots: [
          // Tirs détaillés - Emma
          { id: 'eds1', timestamp: '2026-02-08T10:07:00', playerId: '6', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'gain_point' },
          { id: 'eds2', timestamp: '2026-02-08T10:13:00', playerId: '6', team: 'A', actionType: 'tir', success: false, shotType: 'au_plomb', shotResult: 'long', shotQuality: 'sans_effet' },
          { id: 'eds3', timestamp: '2026-02-08T10:19:00', playerId: '6', team: 'A', actionType: 'tir', success: true, shotType: 'court_ramasse', shotQuality: 'gain_point' },
          { id: 'eds4', timestamp: '2026-02-08T10:26:00', playerId: '6', team: 'A', actionType: 'tir', success: true, carreau: true, shotType: 'carreau', shotQuality: 'gain_point' },
          { id: 'eds5', timestamp: '2026-02-08T10:33:00', playerId: '6', team: 'A', actionType: 'tir', success: false, shotType: 'en_rafle', shotResult: 'court_droite', shotQuality: 'negatif' },
          { id: 'eds6', timestamp: '2026-02-08T10:39:00', playerId: '6', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'decisif' },
          { id: 'eds7', timestamp: '2026-02-08T10:46:00', playerId: '6', team: 'A', actionType: 'tir', success: false, shotType: 'au_plomb', shotResult: 'tir_bouchon', shotQuality: 'negatif' },
          { id: 'eds8', timestamp: '2026-02-08T10:50:00', playerId: '6', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'sans_effet' },
          // Points détaillés - Emma
          { id: 'edp1', timestamp: '2026-02-08T10:04:00', playerId: '6', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'bon' },
          { id: 'edp2', timestamp: '2026-02-08T10:09:00', playerId: '6', team: 'A', actionType: 'point', success: true, pointType: 'plombe', pointQuality: 'excellent' },
          { id: 'edp3', timestamp: '2026-02-08T10:14:00', playerId: '6', team: 'A', actionType: 'point', success: false, pointType: 'demi_portee', pointQuality: 'sorti' },
          { id: 'edp4', timestamp: '2026-02-08T10:21:00', playerId: '6', team: 'A', actionType: 'point', success: true, pointType: 'portee', pointQuality: 'moyen' },
          { id: 'edp5', timestamp: '2026-02-08T10:27:00', playerId: '6', team: 'A', actionType: 'point', success: false, pointType: 'roule', pointQuality: 'rate' },
          { id: 'edp6', timestamp: '2026-02-08T10:34:00', playerId: '6', team: 'A', actionType: 'point', success: true, pointType: 'plombe', pointQuality: 'bon' },
          { id: 'edp7', timestamp: '2026-02-08T10:41:00', playerId: '6', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'excellent' },
          { id: 'edp8', timestamp: '2026-02-08T10:47:00', playerId: '6', team: 'A', actionType: 'point', success: false, pointType: 'demi_portee', pointQuality: 'crochete' },
          { id: 'edp9', timestamp: '2026-02-08T10:51:00', playerId: '6', team: 'A', actionType: 'point', success: true, pointType: 'portee', pointQuality: 'bon' },
          { id: 'edp10', timestamp: '2026-02-08T10:54:00', playerId: '6', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'moyen' },
        ],
      },
      {
        playerId: '2',
        playerName: 'Marie Dupont',
        team: 'B',
        actions: { tirs: 6, tirsSuccess: 3, points: 12, pointsSuccess: 8, carreaux: 0 },
      },
      {
        playerId: '9',
        playerName: 'Antoine Lambert',
        team: 'B',
        actions: { tirs: 10, tirsSuccess: 6, points: 6, pointsSuccess: 4, carreaux: 1 },
      },
    ],
  },
  {
    id: 'mdetail2', 
    date: '2026-02-09T14:00:00', 
    mode: 'Entraînement', 
    format: 'Tête-à-tête', 
    teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 }, 
    teamB: { players: ['7'], playerNames: ['Thomas Garcia'], score: 11 }, 
    winner: 'A', 
    duration: 52, 
    menes: [
      { teamAPoints: 3, teamBPoints: 0, duration: 200 },
      { teamAPoints: 0, teamBPoints: 2, duration: 180 },
      { teamAPoints: 2, teamBPoints: 0, duration: 165 },
      { teamAPoints: 0, teamBPoints: 3, duration: 210 },
      { teamAPoints: 4, teamBPoints: 0, duration: 190 },
      { teamAPoints: 0, teamBPoints: 3, duration: 205 },
      { teamAPoints: 0, teamBPoints: 3, duration: 195 },
      { teamAPoints: 4, teamBPoints: 0, duration: 220 },
    ],
    playerActions: [
      {
        playerId: '1',
        playerName: 'Jean-Pierre Martin',
        team: 'A',
        actions: { tirs: 15, tirsSuccess: 11, points: 12, pointsSuccess: 9, carreaux: 4 },
        detailedShots: [
          // Tirs supplémentaires avec notation détaillée
          { id: 'ds2_1', timestamp: '2026-02-09T14:05:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'gain_point' },
          { id: 'ds2_2', timestamp: '2026-02-09T14:10:00', playerId: '1', team: 'A', actionType: 'tir', success: true, carreau: true, shotType: 'carreau', shotQuality: 'gain_point' },
          { id: 'ds2_3', timestamp: '2026-02-09T14:15:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_plomb', shotQuality: 'decisif' },
          { id: 'ds2_4', timestamp: '2026-02-09T14:20:00', playerId: '1', team: 'A', actionType: 'tir', success: false, shotType: 'en_rafle', shotResult: 'court_gauche', shotQuality: 'negatif' },
          { id: 'ds2_5', timestamp: '2026-02-09T14:25:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'court_ramasse', shotQuality: 'gain_point' },
          { id: 'ds2_6', timestamp: '2026-02-09T14:30:00', playerId: '1', team: 'A', actionType: 'tir', success: true, carreau: true, shotType: 'carreau', shotQuality: 'gain_point' },
          { id: 'ds2_7', timestamp: '2026-02-09T14:35:00', playerId: '1', team: 'A', actionType: 'tir', success: false, shotType: 'au_fer', shotResult: 'court_droite', shotQuality: 'sans_effet' },
          { id: 'ds2_8', timestamp: '2026-02-09T14:40:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'gain_point' },
          { id: 'ds2_9', timestamp: '2026-02-09T14:45:00', playerId: '1', team: 'A', actionType: 'tir', success: true, carreau: true, shotType: 'carreau', shotQuality: 'gain_point' },
          { id: 'ds2_10', timestamp: '2026-02-09T14:50:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_plomb', shotQuality: 'sans_effet' },
          { id: 'ds2_11', timestamp: '2026-02-09T14:55:00', playerId: '1', team: 'A', actionType: 'tir', success: false, shotType: 'au_plomb', shotResult: 'long', shotQuality: 'negatif' },
          { id: 'ds2_12', timestamp: '2026-02-09T15:00:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'en_rafle', shotQuality: 'gain_point' },
          { id: 'ds2_13', timestamp: '2026-02-09T15:05:00', playerId: '1', team: 'A', actionType: 'tir', success: true, carreau: true, shotType: 'carreau', shotQuality: 'gain_point' },
          { id: 'ds2_14', timestamp: '2026-02-09T15:10:00', playerId: '1', team: 'A', actionType: 'tir', success: false, shotType: 'au_fer', shotResult: 'court_gauche', shotQuality: 'negatif' },
          { id: 'ds2_15', timestamp: '2026-02-09T15:15:00', playerId: '1', team: 'A', actionType: 'tir', success: true, shotType: 'au_fer', shotQuality: 'decisif' },
          // Points supplémentaires
          { id: 'dp2_1', timestamp: '2026-02-09T14:07:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'excellent' },
          { id: 'dp2_2', timestamp: '2026-02-09T14:12:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'plombe', pointQuality: 'bon' },
          { id: 'dp2_3', timestamp: '2026-02-09T14:17:00', playerId: '1', team: 'A', actionType: 'point', success: false, pointType: 'demi_portee', pointQuality: 'rate' },
          { id: 'dp2_4', timestamp: '2026-02-09T14:22:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'excellent' },
          { id: 'dp2_5', timestamp: '2026-02-09T14:27:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'portee', pointQuality: 'moyen' },
          { id: 'dp2_6', timestamp: '2026-02-09T14:32:00', playerId: '1', team: 'A', actionType: 'point', success: false, pointType: 'plombe', pointQuality: 'crochete' },
          { id: 'dp2_7', timestamp: '2026-02-09T14:37:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'bon' },
          { id: 'dp2_8', timestamp: '2026-02-09T14:42:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'demi_portee', pointQuality: 'moyen' },
          { id: 'dp2_9', timestamp: '2026-02-09T14:47:00', playerId: '1', team: 'A', actionType: 'point', success: false, pointType: 'portee', pointQuality: 'sorti' },
          { id: 'dp2_10', timestamp: '2026-02-09T14:52:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'excellent' },
          { id: 'dp2_11', timestamp: '2026-02-09T14:57:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'plombe', pointQuality: 'bon' },
          { id: 'dp2_12', timestamp: '2026-02-09T15:02:00', playerId: '1', team: 'A', actionType: 'point', success: true, pointType: 'roule', pointQuality: 'moyen' },
        ],
      },
      {
        playerId: '7',
        playerName: 'Thomas Garcia',
        team: 'B',
        actions: { tirs: 14, tirsSuccess: 10, points: 10, pointsSuccess: 7, carreaux: 2 },
      },
    ],
  },

  // SÉRIE 1: 2-0 (2 matchs)
  { id: 'm1', date: '2026-02-07T10:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 }, teamB: { players: ['2', '9'], playerNames: ['Marie Dupont', 'Antoine Lambert'], score: 8 }, winner: 'A', duration: 42, menes: [], seriesInfo: { seriesId: generateSeriesId(1), matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm2', date: '2026-02-07T11:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 }, teamB: { players: ['2', '9'], playerNames: ['Marie Dupont', 'Antoine Lambert'], score: 11 }, winner: 'A', duration: 55, menes: [], seriesInfo: { seriesId: generateSeriesId(1), matchNumber: 2, winsBeforeThisMatch: { teamA: 1, teamB: 0 }, isFinale: false, seriesComplete: true, seriesWinner: 'A' } },
  
  // SÉRIE 2: 2-1 (3 matchs avec finale)
  { id: 'm3', date: '2026-02-06T14:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['3', '13'], playerNames: ['Pierre Dubois', 'Maxime Durand'], score: 13 }, teamB: { players: ['7', '12'], playerNames: ['Thomas Garcia', 'Claire Fontaine'], score: 9 }, winner: 'A', duration: 38, menes: [], seriesInfo: { seriesId: generateSeriesId(2), matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm4', date: '2026-02-06T15:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['3', '13'], playerNames: ['Pierre Dubois', 'Maxime Durand'], score: 10 }, teamB: { players: ['7', '12'], playerNames: ['Thomas Garcia', 'Claire Fontaine'], score: 13 }, winner: 'B', duration: 48, menes: [], seriesInfo: { seriesId: generateSeriesId(2), matchNumber: 2, winsBeforeThisMatch: { teamA: 1, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm5', date: '2026-02-06T16:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['3', '13'], playerNames: ['Pierre Dubois', 'Maxime Durand'], score: 13 }, teamB: { players: ['7', '12'], playerNames: ['Thomas Garcia', 'Claire Fontaine'], score: 12 }, winner: 'A', duration: 62, menes: [], seriesInfo: { seriesId: generateSeriesId(2), matchNumber: 3, winsBeforeThisMatch: { teamA: 1, teamB: 1 }, isFinale: true, seriesComplete: true, seriesWinner: 'A' } },

  // SÉRIE 3: 0-2 (défaite en 2 matchs)
  { id: 'm6', date: '2026-02-05T10:00:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 11 }, teamB: { players: ['11'], playerNames: ['François Mercier'], score: 13 }, winner: 'B', duration: 35, menes: [], seriesInfo: { seriesId: generateSeriesId(3), matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm7', date: '2026-02-05T10:45:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 9 }, teamB: { players: ['11'], playerNames: ['François Mercier'], score: 13 }, winner: 'B', duration: 32, menes: [], seriesInfo: { seriesId: generateSeriesId(3), matchNumber: 2, winsBeforeThisMatch: { teamA: 0, teamB: 1 }, isFinale: false, seriesComplete: true, seriesWinner: 'B' } },

  // SÉRIE 4: 1-2 (défaite en finale)
  { id: 'm8', date: '2026-02-04T14:00:00', mode: 'Entraînement', format: 'Triplette', teamA: { players: ['1', '6', '17'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Olivier Girard'], score: 13 }, teamB: { players: ['19', '3', '8'], playerNames: ['Philippe Morel', 'Pierre Dubois', 'Camille Roux'], score: 7 }, winner: 'A', duration: 45, menes: [], seriesInfo: { seriesId: generateSeriesId(4), matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm9', date: '2026-02-04T15:15:00', mode: 'Entraînement', format: 'Triplette', teamA: { players: ['1', '6', '17'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Olivier Girard'], score: 11 }, teamB: { players: ['19', '3', '8'], playerNames: ['Philippe Morel', 'Pierre Dubois', 'Camille Roux'], score: 13 }, winner: 'B', duration: 52, menes: [], seriesInfo: { seriesId: generateSeriesId(4), matchNumber: 2, winsBeforeThisMatch: { teamA: 1, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm10', date: '2026-02-04T16:30:00', mode: 'Entraînement', format: 'Triplette', teamA: { players: ['1', '6', '17'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Olivier Girard'], score: 10 }, teamB: { players: ['19', '3', '8'], playerNames: ['Philippe Morel', 'Pierre Dubois', 'Camille Roux'], score: 13 }, winner: 'B', duration: 58, menes: [], seriesInfo: { seriesId: generateSeriesId(4), matchNumber: 3, winsBeforeThisMatch: { teamA: 1, teamB: 1 }, isFinale: true, seriesComplete: true, seriesWinner: 'B' } },

  // Matchs standalone (sans série)
  { id: 'm11', date: '2026-02-03T09:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['5', '15'], playerNames: ['Lucas Moreau', 'Nicolas Blanc'], score: 13 }, teamB: { players: ['4', '20'], playerNames: ['Sophie Bernard', 'Aurélie Simon'], score: 6 }, winner: 'A', duration: 35, menes: [] },
  { id: 'm12', date: '2026-02-02T16:00:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['7'], playerNames: ['Thomas Garcia'], score: 13 }, teamB: { players: ['5'], playerNames: ['Lucas Moreau'], score: 11 }, winner: 'A', duration: 40, menes: [] },
  { id: 'm13', date: '2026-02-01T14:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['10', '4'], playerNames: ['Julie Petit', 'Sophie Bernard'], score: 9 }, teamB: { players: ['6', '8'], playerNames: ['Emma Leroy', 'Camille Roux'], score: 13 }, winner: 'B', duration: 52, menes: [] },
  
  // SÉRIE 5: 2-0
  { id: 'm14', date: '2026-01-31T10:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['11', '1'], playerNames: ['François Mercier', 'Jean-Pierre Martin'], score: 13 }, teamB: { players: ['14', '20'], playerNames: ['Isabelle Martin', 'Aurélie Simon'], score: 5 }, winner: 'A', duration: 28, menes: [], seriesInfo: { seriesId: generateSeriesId(5), matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm15', date: '2026-01-31T10:40:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['11', '1'], playerNames: ['François Mercier', 'Jean-Pierre Martin'], score: 13 }, teamB: { players: ['14', '20'], playerNames: ['Isabelle Martin', 'Aurélie Simon'], score: 8 }, winner: 'A', duration: 38, menes: [], seriesInfo: { seriesId: generateSeriesId(5), matchNumber: 2, winsBeforeThisMatch: { teamA: 1, teamB: 0 }, isFinale: false, seriesComplete: true, seriesWinner: 'A' } },

  // Matchs de tournoi
  { id: 'm16', date: '2026-02-01T09:00:00', mode: 'Tournoi', format: 'Triplette', tournamentId: 'tour2', tournamentName: 'Championnat Régional PACA', tournamentPhase: 'Poules', teamA: { players: ['1', '6', '11'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'François Mercier'], score: 13 }, teamB: { players: ['5', '4', '8'], playerNames: ['Lucas Moreau', 'Sophie Bernard', 'Camille Roux'], score: 8 }, winner: 'A', duration: 48, menes: [] },
  { id: 'm17', date: '2026-02-01T11:00:00', mode: 'Tournoi', format: 'Triplette', tournamentId: 'tour2', tournamentName: 'Championnat Régional PACA', tournamentPhase: 'Poules', teamA: { players: ['1', '6', '11'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'François Mercier'], score: 13 }, teamB: { players: ['2', '7', '12'], playerNames: ['Marie Dupont', 'Thomas Garcia', 'Claire Fontaine'], score: 11 }, winner: 'A', duration: 55, menes: [] },
  { id: 'm18', date: '2026-02-01T14:00:00', mode: 'Tournoi', format: 'Triplette', tournamentId: 'tour2', tournamentName: 'Championnat Régional PACA', tournamentPhase: '1/8 finale', tournamentBracket: 'A', teamA: { players: ['1', '6', '11'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'François Mercier'], score: 13 }, teamB: { players: ['10', '13', '18'], playerNames: ['Julie Petit', 'Maxime Durand', 'Valérie Rousseau'], score: 7 }, winner: 'A', duration: 38, menes: [] },
  { id: 'm19', date: '2026-02-01T16:00:00', mode: 'Tournoi', format: 'Triplette', tournamentId: 'tour2', tournamentName: 'Championnat Régional PACA', tournamentPhase: 'Quart de finale', tournamentBracket: 'A', teamA: { players: ['1', '6', '11'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'François Mercier'], score: 13 }, teamB: { players: ['7', '2', '9'], playerNames: ['Thomas Garcia', 'Marie Dupont', 'Antoine Lambert'], score: 12 }, winner: 'A', duration: 65, menes: [] },
  { id: 'm20', date: '2026-02-02T10:00:00', mode: 'Tournoi', format: 'Triplette', tournamentId: 'tour2', tournamentName: 'Championnat Régional PACA', tournamentPhase: 'Demi-finale', teamA: { players: ['1', '6', '11'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'François Mercier'], score: 13 }, teamB: { players: ['19', '3', '15'], playerNames: ['Philippe Morel', 'Pierre Dubois', 'Nicolas Blanc'], score: 10 }, winner: 'A', duration: 58, menes: [] },
  { id: 'm21', date: '2026-02-02T14:00:00', mode: 'Tournoi', format: 'Triplette', tournamentId: 'tour2', tournamentName: 'Championnat Régional PACA', tournamentPhase: 'Finale', teamA: { players: ['1', '6', '11'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'François Mercier'], score: 12 }, teamB: { players: ['7', '12', '5'], playerNames: ['Thomas Garcia', 'Claire Fontaine', 'Lucas Moreau'], score: 13 }, winner: 'B', duration: 72, menes: [] },

  // Plus de matchs standalone
  { id: 'm22', date: '2026-01-30T15:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['2', '12'], playerNames: ['Marie Dupont', 'Claire Fontaine'], score: 13 }, teamB: { players: ['16', '9'], playerNames: ['Sandrine Lefebvre', 'Antoine Lambert'], score: 10 }, winner: 'A', duration: 45, menes: [] },
  { id: 'm23', date: '2026-01-29T10:00:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['3'], playerNames: ['Pierre Dubois'], score: 13 }, teamB: { players: ['19'], playerNames: ['Philippe Morel'], score: 11 }, winner: 'A', duration: 38, menes: [] },
  { id: 'm24', date: '2026-01-28T14:00:00', mode: 'Entraînement', format: 'Triplette', teamA: { players: ['1', '6', '17'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Olivier Girard'], score: 13 }, teamB: { players: ['5', '15', '4'], playerNames: ['Lucas Moreau', 'Nicolas Blanc', 'Sophie Bernard'], score: 9 }, winner: 'A', duration: 50, menes: [] },

  // Tournoi Bordeaux
  { id: 'm25', date: '2026-01-28T09:00:00', mode: 'Tournoi', format: 'Tête-à-tête', tournamentId: 'tour4', tournamentName: 'Concours Mensuel Bordeaux', tournamentPhase: 'Ronde 1', teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 }, teamB: { players: ['10'], playerNames: ['Julie Petit'], score: 10 }, winner: 'A', duration: 38, menes: [] },
  { id: 'm26', date: '2026-01-28T10:30:00', mode: 'Tournoi', format: 'Tête-à-tête', tournamentId: 'tour4', tournamentName: 'Concours Mensuel Bordeaux', tournamentPhase: 'Ronde 2', teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 }, teamB: { players: ['3'], playerNames: ['Pierre Dubois'], score: 11 }, winner: 'A', duration: 45, menes: [] },
  { id: 'm27', date: '2026-01-28T13:00:00', mode: 'Tournoi', format: 'Tête-à-tête', tournamentId: 'tour4', tournamentName: 'Concours Mensuel Bordeaux', tournamentPhase: 'Ronde 3', teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 }, teamB: { players: ['9'], playerNames: ['Antoine Lambert'], score: 8 }, winner: 'A', duration: 35, menes: [] },
  { id: 'm28', date: '2026-01-28T15:00:00', mode: 'Tournoi', format: 'Tête-à-tête', tournamentId: 'tour4', tournamentName: 'Concours Mensuel Bordeaux', tournamentPhase: 'Ronde 4', teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 }, teamB: { players: ['8'], playerNames: ['Camille Roux'], score: 5 }, winner: 'A', duration: 28, menes: [] },
  { id: 'm29', date: '2026-01-28T16:30:00', mode: 'Tournoi', format: 'Tête-à-tête', tournamentId: 'tour4', tournamentName: 'Concours Mensuel Bordeaux', tournamentPhase: 'Ronde 5', teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 }, teamB: { players: ['11'], playerNames: ['François Mercier'], score: 10 }, winner: 'A', duration: 42, menes: [] },

  // SÉRIE 6: 2-1 
  { id: 'm30', date: '2026-01-27T14:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['5', '15'], playerNames: ['Lucas Moreau', 'Nicolas Blanc'], score: 8 }, teamB: { players: ['7', '12'], playerNames: ['Thomas Garcia', 'Claire Fontaine'], score: 13 }, winner: 'B', duration: 42, menes: [], seriesInfo: { seriesId: generateSeriesId(6), matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm31', date: '2026-01-27T15:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['5', '15'], playerNames: ['Lucas Moreau', 'Nicolas Blanc'], score: 13 }, teamB: { players: ['7', '12'], playerNames: ['Thomas Garcia', 'Claire Fontaine'], score: 11 }, winner: 'A', duration: 55, menes: [], seriesInfo: { seriesId: generateSeriesId(6), matchNumber: 2, winsBeforeThisMatch: { teamA: 0, teamB: 1 }, isFinale: false, seriesComplete: false } },
  { id: 'm32', date: '2026-01-27T16:15:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['5', '15'], playerNames: ['Lucas Moreau', 'Nicolas Blanc'], score: 13 }, teamB: { players: ['7', '12'], playerNames: ['Thomas Garcia', 'Claire Fontaine'], score: 9 }, winner: 'A', duration: 48, menes: [], seriesInfo: { seriesId: generateSeriesId(6), matchNumber: 3, winsBeforeThisMatch: { teamA: 1, teamB: 1 }, isFinale: true, seriesComplete: true, seriesWinner: 'A' } },

  // Plus de matchs
  { id: 'm33', date: '2026-01-26T10:00:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['6'], playerNames: ['Emma Leroy'], score: 13 }, teamB: { players: ['16'], playerNames: ['Sandrine Lefebvre'], score: 8 }, winner: 'A', duration: 32, menes: [] },
  { id: 'm34', date: '2026-01-25T14:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['19', '3'], playerNames: ['Philippe Morel', 'Pierre Dubois'], score: 13 }, teamB: { players: ['11', '1'], playerNames: ['François Mercier', 'Jean-Pierre Martin'], score: 12 }, winner: 'A', duration: 58, menes: [] },
  { id: 'm35', date: '2026-01-24T16:00:00', mode: 'Entraînement', format: 'Triplette', teamA: { players: ['2', '7', '12'], playerNames: ['Marie Dupont', 'Thomas Garcia', 'Claire Fontaine'], score: 13 }, teamB: { players: ['10', '4', '20'], playerNames: ['Julie Petit', 'Sophie Bernard', 'Aurélie Simon'], score: 11 }, winner: 'A', duration: 52, menes: [] },

  // Tournoi Lille
  { id: 'm36', date: '2026-01-15T09:00:00', mode: 'Tournoi', format: 'Doublette', tournamentId: 'tour9', tournamentName: 'Indoor Winter Cup Lille', tournamentPhase: 'Poules', teamA: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 }, teamB: { players: ['9', '16'], playerNames: ['Antoine Lambert', 'Sandrine Lefebvre'], score: 7 }, winner: 'A', duration: 35, menes: [] },
  { id: 'm37', date: '2026-01-15T11:00:00', mode: 'Tournoi', format: 'Doublette', tournamentId: 'tour9', tournamentName: 'Indoor Winter Cup Lille', tournamentPhase: 'Poules', teamA: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 }, teamB: { players: ['17', '13'], playerNames: ['Olivier Girard', 'Maxime Durand'], score: 10 }, winner: 'A', duration: 42, menes: [] },
  { id: 'm38', date: '2026-01-15T14:00:00', mode: 'Tournoi', format: 'Doublette', tournamentId: 'tour9', tournamentName: 'Indoor Winter Cup Lille', tournamentPhase: 'Demi-finale', teamA: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 }, teamB: { players: ['5', '15'], playerNames: ['Lucas Moreau', 'Nicolas Blanc'], score: 11 }, winner: 'A', duration: 50, menes: [] },
  { id: 'm39', date: '2026-01-15T16:00:00', mode: 'Tournoi', format: 'Doublette', tournamentId: 'tour9', tournamentName: 'Indoor Winter Cup Lille', tournamentPhase: 'Finale', teamA: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 }, teamB: { players: ['7', '12'], playerNames: ['Thomas Garcia', 'Claire Fontaine'], score: 9 }, winner: 'A', duration: 45, menes: [] },

  // Encore des matchs standalone
  { id: 'm40', date: '2026-01-20T10:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['1', '17'], playerNames: ['Jean-Pierre Martin', 'Olivier Girard'], score: 13 }, teamB: { players: ['8', '18'], playerNames: ['Camille Roux', 'Valérie Rousseau'], score: 4 }, winner: 'A', duration: 25, menes: [] },
  { id: 'm41', date: '2026-01-19T15:00:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['15'], playerNames: ['Nicolas Blanc'], score: 13 }, teamB: { players: ['2'], playerNames: ['Marie Dupont'], score: 10 }, winner: 'A', duration: 38, menes: [] },
  { id: 'm42', date: '2026-01-18T14:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['3', '13'], playerNames: ['Pierre Dubois', 'Maxime Durand'], score: 11 }, teamB: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 }, winner: 'B', duration: 48, menes: [] },
  { id: 'm43', date: '2026-01-17T10:00:00', mode: 'Entraînement', format: 'Triplette', teamA: { players: ['7', '2', '9'], playerNames: ['Thomas Garcia', 'Marie Dupont', 'Antoine Lambert'], score: 13 }, teamB: { players: ['5', '4', '20'], playerNames: ['Lucas Moreau', 'Sophie Bernard', 'Aurélie Simon'], score: 8 }, winner: 'A', duration: 45, menes: [] },

  // SÉRIE 7: 2-0
  { id: 'm44', date: '2026-01-16T14:00:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['19'], playerNames: ['Philippe Morel'], score: 13 }, teamB: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 10 }, winner: 'A', duration: 35, menes: [], seriesInfo: { seriesId: generateSeriesId(7), matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false } },
  { id: 'm45', date: '2026-01-16T14:45:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['19'], playerNames: ['Philippe Morel'], score: 13 }, teamB: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 11 }, winner: 'A', duration: 40, menes: [], seriesInfo: { seriesId: generateSeriesId(7), matchNumber: 2, winsBeforeThisMatch: { teamA: 1, teamB: 0 }, isFinale: false, seriesComplete: true, seriesWinner: 'A' } },

  // Derniers matchs
  { id: 'm46', date: '2026-01-14T10:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['12', '2'], playerNames: ['Claire Fontaine', 'Marie Dupont'], score: 13 }, teamB: { players: ['14', '4'], playerNames: ['Isabelle Martin', 'Sophie Bernard'], score: 9 }, winner: 'A', duration: 42, menes: [] },
  { id: 'm47', date: '2026-01-13T15:00:00', mode: 'Entraînement', format: 'Tête-à-tête', teamA: { players: ['11'], playerNames: ['François Mercier'], score: 13 }, teamB: { players: ['7'], playerNames: ['Thomas Garcia'], score: 12 }, winner: 'A', duration: 45, menes: [] },
  { id: 'm48', date: '2026-01-12T14:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['1', '11'], playerNames: ['Jean-Pierre Martin', 'François Mercier'], score: 13 }, teamB: { players: ['19', '3'], playerNames: ['Philippe Morel', 'Pierre Dubois'], score: 11 }, winner: 'A', duration: 52, menes: [] },
  { id: 'm49', date: '2026-01-11T10:00:00', mode: 'Entraînement', format: 'Triplette', teamA: { players: ['5', '15', '10'], playerNames: ['Lucas Moreau', 'Nicolas Blanc', 'Julie Petit'], score: 13 }, teamB: { players: ['1', '6', '17'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy', 'Olivier Girard'], score: 10 }, winner: 'A', duration: 48, menes: [] },
  { id: 'm50', date: '2026-01-10T14:00:00', mode: 'Entraînement', format: 'Doublette', teamA: { players: ['7', '12'], playerNames: ['Thomas Garcia', 'Claire Fontaine'], score: 13 }, teamB: { players: ['2', '9'], playerNames: ['Marie Dupont', 'Antoine Lambert'], score: 8 }, winner: 'A', duration: 38, menes: [] },
];

// ============================================
// 10 MOCK CHALLENGES
// ============================================
export const mockChallenges: Challenge[] = [
  { id: 'c1', type: '10_tirs', mode: 'solo', date: '2026-02-06T10:30:00', playerId: '1', playerName: 'Jean-Pierre Martin', sponsorId: 'sponsor-obut', sponsorName: 'Obut Official', sponsorPhoto: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=200&fit=crop', shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 8, carreau: i === 1 || i === 6, timestamp: new Date().toISOString() })), successCount: 8, totalShots: 10, carreauCount: 2, successRate: 80, duration: 185, notes: 'Defi sponsorise par Obut - Excellent entrainement avec les nouvelles ATX' },
  { id: 'c2', type: '10_tirs_sautee', mode: 'solo', date: '2026-02-05T15:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i % 2 === 0, timestamp: new Date().toISOString() })), successCount: 5, totalShots: 10, carreauCount: 0, successRate: 50, duration: 180 },
  { id: 'c3', type: 'precision', mode: 'solo', date: '2026-02-04T11:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', sponsorId: 'sponsor-laboulebleue', sponsorName: 'La Boule Bleue', sponsorPhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop', precisionShots: [
    { atelier: 'boule_seule', distance: 6, points: 5, timeUsed: 18, timestamp: new Date().toISOString() },
    { atelier: 'boule_seule', distance: 7, points: 3, timeUsed: 22, timestamp: new Date().toISOString() },
    { atelier: 'derriere_but', distance: 6, points: 3, timeUsed: 20, timestamp: new Date().toISOString() },
    { atelier: 'derriere_but', distance: 7, points: 1, timeUsed: 25, timestamp: new Date().toISOString() },
  ], totalPoints: 12, maxPoints: 20, duration: 300, notes: 'Defi precision sponsorise La Boule Bleue - Bon score sur boule seule' },
  { id: 'c4', type: '10_tirs', mode: '1v1', date: '2026-02-03T09:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', opponentId: '5', opponentName: 'Lucas Moreau', winner: 'player', sponsorId: 'sponsor-ms', sponsorName: 'MS Petanque Pro', sponsorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop', shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 7, timestamp: new Date().toISOString() })), successCount: 7, totalShots: 10, carreauCount: 1, successRate: 70, opponentResult: { playerId: '5', playerName: 'Lucas Moreau', successCount: 5, totalShots: 10, successRate: 50 }, duration: 200, notes: 'Defi 1v1 sponsorise par MS Petanque - Belle victoire' },
  { id: 'c5', type: '10_tirs', mode: '1v1', date: '2026-02-02T14:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', opponentId: '7', opponentName: 'Thomas Garcia', winner: 'opponent', shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 6, timestamp: new Date().toISOString() })), successCount: 6, totalShots: 10, carreauCount: 0, successRate: 60, opponentResult: { playerId: '7', playerName: 'Thomas Garcia', successCount: 9, totalShots: 10, successRate: 90 }, duration: 180 },
  { id: 'c6', type: '10_tirs_sautee', mode: '1v1', date: '2026-02-01T10:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', opponentId: '11', opponentName: 'François Mercier', winner: 'draw', shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 6, timestamp: new Date().toISOString() })), successCount: 6, totalShots: 10, carreauCount: 0, successRate: 60, opponentResult: { playerId: '11', playerName: 'François Mercier', successCount: 6, totalShots: 10, successRate: 60 }, duration: 190 },
  { id: 'c7', type: 'precision', mode: '1v1', date: '2026-01-30T15:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', opponentId: '19', opponentName: 'Philippe Morel', winner: 'opponent', precisionShots: [
    { atelier: 'boule_seule', distance: 6, points: 3, timeUsed: 20, timestamp: new Date().toISOString() },
    { atelier: 'entre_2_boules', distance: 7, points: 1, timeUsed: 25, timestamp: new Date().toISOString() },
  ], totalPoints: 4, maxPoints: 10, opponentResult: { playerId: '19', playerName: 'Philippe Morel', totalPoints: 8 }, duration: 250 },
  { id: 'c8', type: '10_tirs', mode: 'solo', date: '2026-01-28T09:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 9, carreau: i === 2 || i === 5 || i === 8, timestamp: new Date().toISOString() })), successCount: 9, totalShots: 10, carreauCount: 3, successRate: 90, duration: 175 },
  { id: 'c9', type: '10_tirs_sautee', mode: 'solo', date: '2026-01-25T14:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 7, timestamp: new Date().toISOString() })), successCount: 7, totalShots: 10, carreauCount: 1, successRate: 70, duration: 195 },
  { id: 'c10', type: 'precision', mode: 'solo', date: '2026-01-20T11:00:00', playerId: '1', playerName: 'Jean-Pierre Martin', precisionShots: [
    { atelier: 'tir_but', distance: 6, points: 5, timeUsed: 15, timestamp: new Date().toISOString() },
    { atelier: 'tir_but', distance: 7, points: 3, timeUsed: 18, timestamp: new Date().toISOString() },
    { atelier: 'sautee', distance: 6, points: 3, timeUsed: 22, timestamp: new Date().toISOString() },
    { atelier: 'sautee', distance: 7, points: 1, timeUsed: 25, timestamp: new Date().toISOString() },
  ], totalPoints: 12, maxPoints: 20, atelierScores: { 'tir_but': 8, 'sautee': 4 }, duration: 280 },
];

// ============================================
// CURRENT USER STATS
// ============================================
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
