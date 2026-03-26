// PetanqueScore Mock Data - Optimized Demo Data
// 8 players, 4 clubs, 5 terrains, 3 tournaments, 12 matches, 6 challenges
// Covers 100% of features: detailed notation, Best of 3, tournament journey,
// solo/1v1/precision/sponsored challenges, all formats (T-a-T, Doublette, Triplette)

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
  shotType?: 'au_fer' | 'au_plomb' | 'en_rafle' | 'court_ramasse' | 'carreau';
  shotResult?: 'court_droite' | 'court_gauche' | 'long' | 'tir_bouchon';
  /** @deprecated Use shotResult instead */
  failedShotType?: 'court_droite' | 'court_gauche' | 'long' | 'tir_bouchon';
  shotQuality?: 'gain_point' | 'sans_effet' | 'negatif' | 'decisif';
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
// 8 MOCK PLAYERS — All roles, levels, clubs
// ============================================
export const mockPlayers: Player[] = [
  {
    id: '1', name: 'Jean-Pierre Martin', nickname: 'JP', club: 'La Boule Lyonnaise', clubId: '1', role: 'Tireur', level: 'Expert',
    phone: '06 12 34 56 78', email: 'jp.martin@email.fr', country: 'France', handedness: 'right',
    location: { latitude: 45.764042, longitude: 4.835659, city: 'Lyon' },
    boules: { name: 'Obut ATX', diameter: 74, weight: 700, serialNumber: 'ATX-2024-0012' },
    stats: { matchesPlayed: 156, wins: 98, losses: 58, winRate: 62.8, tirRate: 78.5, pointRate: 65.2, carreauRate: 12.4, avgPointsScored: 11.2, avgPointsConceded: 8.4, totalTirs: 520, totalTirsSuccess: 408, totalPoints: 340, totalPointsSuccess: 222 },
    createdAt: '2022-03-15',
  },
  {
    id: '2', name: 'Marie Dupont', nickname: 'La Marseillaise', club: 'Petanque Club Marseillais', clubId: '2', role: 'Pointeur', level: 'Confirmé',
    phone: '06 98 76 54 32', email: 'marie.dupont@email.fr', country: 'France',
    location: { latitude: 43.296482, longitude: 5.369780, city: 'Marseille' },
    boules: { name: 'La Boule Bleue', diameter: 72, weight: 680 },
    stats: { matchesPlayed: 89, wins: 52, losses: 37, winRate: 58.4, tirRate: 45.3, pointRate: 82.1, carreauRate: 5.2, avgPointsScored: 10.8, avgPointsConceded: 9.1 },
    createdAt: '2023-01-08',
  },
  {
    id: '3', name: 'Pierre Dubois', nickname: 'Le Nicois', club: 'AS Petanque Nice', clubId: '3', role: 'Milieu', level: 'Expert',
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
    id: '5', name: 'Lucas Moreau', nickname: 'Lulu', club: 'La Boule Lyonnaise', clubId: '1', role: 'Tireur', level: 'Confirmé',
    country: 'France', location: { latitude: 45.764042, longitude: 4.835659, city: 'Lyon' },
    boules: { name: 'MS 2110', diameter: 73, weight: 690 },
    stats: { matchesPlayed: 112, wins: 71, losses: 41, winRate: 63.4, tirRate: 76.8, pointRate: 58.3, carreauRate: 11.2, avgPointsScored: 10.9, avgPointsConceded: 8.7 },
    createdAt: '2022-07-03',
  },
  {
    id: '6', name: 'Emma Leroy', club: 'Petanque Club Marseillais', clubId: '2', role: 'Milieu', level: 'Confirmé',
    country: 'France', location: { latitude: 43.296482, longitude: 5.369780, city: 'Marseille' },
    stats: { matchesPlayed: 78, wins: 45, losses: 33, winRate: 57.7, tirRate: 65.4, pointRate: 69.8, carreauRate: 8.9, avgPointsScored: 10.5, avgPointsConceded: 9.3 },
    createdAt: '2023-02-28',
  },
  {
    id: '7', name: 'Thomas Garcia', nickname: 'TomTom', club: 'AS Petanque Nice', clubId: '3', role: 'Tireur', level: 'Expert',
    phone: '06 77 88 99 00', country: 'France',
    location: { latitude: 43.710173, longitude: 7.261953, city: 'Nice' },
    boules: { name: 'La Boule Noire', diameter: 75, weight: 710 },
    stats: { matchesPlayed: 189, wins: 128, losses: 61, winRate: 67.7, tirRate: 81.2, pointRate: 52.4, carreauRate: 18.6, avgPointsScored: 11.5, avgPointsConceded: 7.9 },
    createdAt: '2021-11-14',
  },
  {
    id: '8', name: 'Camille Roux', club: 'La Boule Bordelaise', clubId: '4', role: 'Pointeur', level: 'Débutant',
    country: 'France', location: { latitude: 44.837789, longitude: -0.579180, city: 'Bordeaux' },
    stats: { matchesPlayed: 18, wins: 7, losses: 11, winRate: 38.9, tirRate: 32.1, pointRate: 58.6, carreauRate: 1.2, avgPointsScored: 8.2, avgPointsConceded: 11.4 },
    createdAt: '2024-01-05',
  },
];

// ============================================
// 4 MOCK CLUBS
// ============================================
export const mockClubs: Club[] = [
  {
    id: '1', name: 'La Boule Lyonnaise', address: '15 Rue du Parc', city: 'Lyon', country: 'France',
    location: { latitude: 45.764042, longitude: 4.835659 }, membersCount: 156, foundedYear: 1952,
    description: 'Club historique de Lyon, champion regional 2023', facilities: ['12 terrains', 'Club house', 'Parking', 'Bar'],
    contactEmail: 'contact@boule-lyonnaise.fr', contactPhone: '04 72 00 00 00', terrainId: 't1', terrainName: 'Boulodrome Municipal Lyon',
  },
  {
    id: '2', name: 'Petanque Club Marseillais', address: '42 Avenue du Prado', city: 'Marseille', country: 'France',
    location: { latitude: 43.296482, longitude: 5.369780 }, membersCount: 203, foundedYear: 1948,
    description: 'Le plus grand club de la region PACA', facilities: ['18 terrains', 'Terrain couvert', 'Restaurant', 'Vestiaires'],
    contactEmail: 'pcm@petanque-marseille.fr', terrainId: 't2', terrainName: 'Terrain du Prado',
  },
  {
    id: '3', name: 'AS Petanque Nice', address: '8 Boulevard Gambetta', city: 'Nice', country: 'France',
    location: { latitude: 43.710173, longitude: 7.261953 }, membersCount: 89, foundedYear: 1965,
    description: 'Club familial au coeur de Nice', facilities: ['8 terrains', 'Ecole de petanque', 'Parking'], terrainId: 't3', terrainName: 'Boulodrome de Nice',
  },
  {
    id: '4', name: 'La Boule Bordelaise', address: '23 Quai des Chartrons', city: 'Bordeaux', country: 'France',
    location: { latitude: 44.837789, longitude: -0.579180 }, membersCount: 67, foundedYear: 1978,
    description: 'Ambiance conviviale au bord de la Garonne', facilities: ['6 terrains', 'Bar', 'Terrasse'],
    contactPhone: '05 56 00 00 00', terrainId: 't4', terrainName: 'Terrain des Chartrons',
  },
];

// ============================================
// 5 MOCK TERRAINS — varied types, indoor/outdoor
// ============================================
export const mockTerrains: Terrain[] = [
  {
    id: 't1', name: 'Boulodrome Municipal Lyon', address: '15 Rue du Parc, 69006 Lyon', city: 'Lyon',
    location: { latitude: 45.764042, longitude: 4.835659 }, type: 'Stabilisé',
    description: 'Boulodrome officiel de la ville de Lyon avec 12 terrains de competition.',
    facilities: ['Vestiaires', 'Bar', 'Parking', 'Eclairage'], clubId: '1', clubName: 'La Boule Lyonnaise',
    isPublic: true, publicAccess: true, courtsCount: 12, lighting: true, covered: false, environment: 'outdoor', createdAt: '2022-01-15',
  },
  {
    id: 't2', name: 'Terrain du Prado', address: '42 Avenue du Prado, 13008 Marseille', city: 'Marseille',
    location: { latitude: 43.296482, longitude: 5.369780 }, type: 'Graviers',
    description: 'Terrain gravillonne historique de Marseille, couvert pour jouer toute l\'annee.',
    facilities: ['Restaurant', 'Vestiaires', 'Tribune'], clubId: '2', clubName: 'Petanque Club Marseillais',
    isPublic: true, publicAccess: true, courtsCount: 18, lighting: true, covered: true, environment: 'indoor', createdAt: '2021-06-20',
  },
  {
    id: 't3', name: 'Boulodrome de Nice', address: '8 Boulevard Gambetta, 06000 Nice', city: 'Nice',
    location: { latitude: 43.710173, longitude: 7.261953 }, type: 'Stabilisé',
    description: 'Boulodrome moderne avec vue sur la mer.',
    facilities: ['Bar', 'Douches', 'Parking'], clubId: '3', clubName: 'AS Petanque Nice',
    isPublic: true, publicAccess: true, courtsCount: 8, lighting: true, covered: false, environment: 'outdoor', createdAt: '2023-04-10',
  },
  {
    id: 't4', name: 'Terrain des Chartrons', address: '23 Quai des Chartrons, 33000 Bordeaux', city: 'Bordeaux',
    location: { latitude: 44.860000, longitude: -0.570000 }, type: 'Terre battue',
    description: 'Terrain naturel au bord de la Garonne.',
    facilities: ['Bar', 'Terrasse'], clubId: '4', clubName: 'La Boule Bordelaise',
    isPublic: true, publicAccess: true, courtsCount: 6, lighting: true, covered: false, environment: 'outdoor', createdAt: '2022-09-01',
  },
  {
    id: 't5', name: 'Plage Petanque Nice', address: 'Promenade des Anglais, 06000 Nice', city: 'Nice',
    location: { latitude: 43.694852, longitude: 7.265722 }, type: 'Sable',
    description: 'Terrain de plage unique avec vue sur la Mediterranee.',
    facilities: ['Bar de plage', 'Douches'],
    isPublic: true, publicAccess: true, courtsCount: 4, lighting: false, covered: false, environment: 'outdoor', createdAt: '2023-05-15',
  },
];

// ============================================
// 3 MOCK TOURNAMENTS
// ============================================
export const mockTournaments: Tournament[] = [
  // À venir — Doublette, Poules
  {
    id: 'tour1', name: 'Tournoi de Printemps Lyon', date: '2026-04-15', type: 'Poules', format: 'Doublette',
    location: { name: 'Boulodrome Municipal Lyon', city: 'Lyon', latitude: 45.780000, longitude: 4.855000 },
    clubId: '1', clubName: 'La Boule Lyonnaise', terrainId: 't1', terrainName: 'Boulodrome Municipal Lyon',
    status: 'À venir', participants: 24, maxParticipants: 32, prize: '500\u20AC',
    description: 'Tournoi annuel ouvert a tous', registrationCost: 15,
  },
  // Terminé — Triplette, parcours complet (Poules > Demi > Finale) — Finaliste
  {
    id: 'tour2', name: 'Championnat Regional PACA', date: '2026-02-01', endDate: '2026-02-02', type: 'Mixte', format: 'Triplette',
    location: { name: 'Boulodrome du Prado', city: 'Marseille', latitude: 43.270000, longitude: 5.380000 },
    clubId: '2', clubName: 'Petanque Club Marseillais', terrainId: 't2',
    status: 'Terminé', participants: 48, maxParticipants: 48, prize: '2000\u20AC',
    registrationCost: 30, prizeWon: 500, finalResult: 'Finaliste',
  },
  // Terminé — Tête-à-tête Suisse — Champion
  {
    id: 'tour3', name: 'Concours Mensuel Bordeaux', date: '2026-01-28', type: 'Suisse', format: 'Tête-à-tête',
    location: { name: 'Terrain des Chartrons', city: 'Bordeaux', latitude: 44.860000, longitude: -0.570000 },
    clubId: '4', clubName: 'La Boule Bordelaise', terrainId: 't4',
    status: 'Terminé', participants: 16, maxParticipants: 16,
    registrationCost: 10, prizeWon: 50, finalResult: 'Champion',
  },
];

// ============================================
// 12 MOCK MATCHES
// Covers: detailed notation, Best of 3 (2-0 & 2-1), standalone all formats, tournament journey
// ============================================
export const mockMatches: Match[] = [
  // ── MATCH 1: DETAILED NOTATION (Doublette, Entrainement) ──
  {
    id: 'mdetail1', date: '2026-02-08T10:00:00', mode: 'Entraînement', format: 'Doublette', terrainId: 't1',
    teamA: { players: ['1', '6'], playerNames: ['Jean-Pierre Martin', 'Emma Leroy'], score: 13 },
    teamB: { players: ['2', '4'], playerNames: ['Marie Dupont', 'Sophie Bernard'], score: 9 },
    winner: 'A', duration: 48,
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
        playerId: '1', playerName: 'Jean-Pierre Martin', team: 'A',
        actions: { tirs: 12, tirsSuccess: 9, points: 8, pointsSuccess: 6, carreaux: 3 },
        detailedShots: [
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
        playerId: '6', playerName: 'Emma Leroy', team: 'A',
        actions: { tirs: 8, tirsSuccess: 5, points: 10, pointsSuccess: 7, carreaux: 1 },
      },
      {
        playerId: '2', playerName: 'Marie Dupont', team: 'B',
        actions: { tirs: 6, tirsSuccess: 3, points: 12, pointsSuccess: 8, carreaux: 0 },
      },
      {
        playerId: '4', playerName: 'Sophie Bernard', team: 'B',
        actions: { tirs: 4, tirsSuccess: 2, points: 8, pointsSuccess: 5, carreaux: 0 },
      },
    ],
  },

  // ── SERIES Best of 3: 2-0 (Doublette) ──
  {
    id: 'm1', date: '2026-02-07T10:00:00', mode: 'Entraînement', format: 'Doublette', terrainId: 't1',
    teamA: { players: ['1', '5'], playerNames: ['Jean-Pierre Martin', 'Lucas Moreau'], score: 13 },
    teamB: { players: ['3', '6'], playerNames: ['Pierre Dubois', 'Emma Leroy'], score: 8 },
    winner: 'A', duration: 42, menes: [],
    seriesInfo: { seriesId: 'series-1', matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false },
  },
  {
    id: 'm2', date: '2026-02-07T11:00:00', mode: 'Entraînement', format: 'Doublette', terrainId: 't1',
    teamA: { players: ['1', '5'], playerNames: ['Jean-Pierre Martin', 'Lucas Moreau'], score: 13 },
    teamB: { players: ['3', '6'], playerNames: ['Pierre Dubois', 'Emma Leroy'], score: 11 },
    winner: 'A', duration: 55, menes: [],
    seriesInfo: { seriesId: 'series-1', matchNumber: 2, winsBeforeThisMatch: { teamA: 1, teamB: 0 }, isFinale: false, seriesComplete: true, seriesWinner: 'A' },
  },

  // ── SERIES Best of 3: 2-1 with finale (Tete-a-tete) ──
  {
    id: 'm3', date: '2026-02-05T14:00:00', mode: 'Entraînement', format: 'Tête-à-tête', terrainId: 't3',
    teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 },
    teamB: { players: ['7'], playerNames: ['Thomas Garcia'], score: 9 },
    winner: 'A', duration: 38, menes: [],
    seriesInfo: { seriesId: 'series-2', matchNumber: 1, winsBeforeThisMatch: { teamA: 0, teamB: 0 }, isFinale: false, seriesComplete: false },
  },
  {
    id: 'm4', date: '2026-02-05T15:00:00', mode: 'Entraînement', format: 'Tête-à-tête', terrainId: 't3',
    teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 10 },
    teamB: { players: ['7'], playerNames: ['Thomas Garcia'], score: 13 },
    winner: 'B', duration: 48, menes: [],
    seriesInfo: { seriesId: 'series-2', matchNumber: 2, winsBeforeThisMatch: { teamA: 1, teamB: 0 }, isFinale: false, seriesComplete: false },
  },
  {
    id: 'm5', date: '2026-02-05T16:00:00', mode: 'Entraînement', format: 'Tête-à-tête', terrainId: 't3',
    teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 },
    teamB: { players: ['7'], playerNames: ['Thomas Garcia'], score: 12 },
    winner: 'A', duration: 62, menes: [],
    seriesInfo: { seriesId: 'series-2', matchNumber: 3, winsBeforeThisMatch: { teamA: 1, teamB: 1 }, isFinale: true, seriesComplete: true, seriesWinner: 'A' },
  },

  // ── STANDALONE: Triplette Entrainement ──
  {
    id: 'm6', date: '2026-02-03T14:00:00', mode: 'Entraînement', format: 'Triplette', terrainId: 't4',
    teamA: { players: ['1', '5', '4'], playerNames: ['Jean-Pierre Martin', 'Lucas Moreau', 'Sophie Bernard'], score: 13 },
    teamB: { players: ['3', '7', '8'], playerNames: ['Pierre Dubois', 'Thomas Garcia', 'Camille Roux'], score: 7 },
    winner: 'A', duration: 45, menes: [],
  },

  // ── STANDALONE: Tete-a-tete Entrainement ──
  {
    id: 'm7', date: '2026-02-01T16:00:00', mode: 'Entraînement', format: 'Tête-à-tête', terrainId: 't5',
    teamA: { players: ['7'], playerNames: ['Thomas Garcia'], score: 13 },
    teamB: { players: ['5'], playerNames: ['Lucas Moreau'], score: 11 },
    winner: 'A', duration: 40, menes: [],
  },

  // ── TOURNAMENT tour2: Parcours complet Triplette (Poules > Demi > Finale) ──
  {
    id: 'm8', date: '2026-02-01T09:00:00', mode: 'Tournoi', format: 'Triplette',
    tournamentId: 'tour2', tournamentName: 'Championnat Regional PACA', tournamentPhase: 'Poules',
    teamA: { players: ['1', '5', '6'], playerNames: ['Jean-Pierre Martin', 'Lucas Moreau', 'Emma Leroy'], score: 13 },
    teamB: { players: ['4', '8', '2'], playerNames: ['Sophie Bernard', 'Camille Roux', 'Marie Dupont'], score: 8 },
    winner: 'A', duration: 48, menes: [],
  },
  {
    id: 'm9', date: '2026-02-02T10:00:00', mode: 'Tournoi', format: 'Triplette',
    tournamentId: 'tour2', tournamentName: 'Championnat Regional PACA', tournamentPhase: 'Demi-finale',
    teamA: { players: ['1', '5', '6'], playerNames: ['Jean-Pierre Martin', 'Lucas Moreau', 'Emma Leroy'], score: 13 },
    teamB: { players: ['3', '7', '4'], playerNames: ['Pierre Dubois', 'Thomas Garcia', 'Sophie Bernard'], score: 10 },
    winner: 'A', duration: 58, menes: [],
  },
  {
    id: 'm10', date: '2026-02-02T14:00:00', mode: 'Tournoi', format: 'Triplette',
    tournamentId: 'tour2', tournamentName: 'Championnat Regional PACA', tournamentPhase: 'Finale',
    teamA: { players: ['1', '5', '6'], playerNames: ['Jean-Pierre Martin', 'Lucas Moreau', 'Emma Leroy'], score: 12 },
    teamB: { players: ['7', '2', '3'], playerNames: ['Thomas Garcia', 'Marie Dupont', 'Pierre Dubois'], score: 13 },
    winner: 'B', duration: 72, menes: [],
  },

  // ── TOURNAMENT tour3: Tete-a-tete Suisse (2 rondes) ──
  {
    id: 'm11', date: '2026-01-28T09:00:00', mode: 'Tournoi', format: 'Tête-à-tête',
    tournamentId: 'tour3', tournamentName: 'Concours Mensuel Bordeaux', tournamentPhase: 'Ronde 1',
    teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 },
    teamB: { players: ['3'], playerNames: ['Pierre Dubois'], score: 10 },
    winner: 'A', duration: 38, menes: [],
  },
  {
    id: 'm12', date: '2026-01-28T10:30:00', mode: 'Tournoi', format: 'Tête-à-tête',
    tournamentId: 'tour3', tournamentName: 'Concours Mensuel Bordeaux', tournamentPhase: 'Ronde 2',
    teamA: { players: ['1'], playerNames: ['Jean-Pierre Martin'], score: 13 },
    teamB: { players: ['7'], playerNames: ['Thomas Garcia'], score: 11 },
    winner: 'A', duration: 45, menes: [],
  },
];

// ============================================
// 6 MOCK CHALLENGES — all types, solo/1v1, sponsored
// ============================================
const ts = () => new Date().toISOString();

export const mockChallenges: Challenge[] = [
  // c1: 10_tirs solo (sponsored)
  {
    id: 'c1', type: '10_tirs', mode: 'solo', date: '2026-02-06T10:30:00',
    playerId: '1', playerName: 'Jean-Pierre Martin',
    sponsorId: 'sponsor-obut', sponsorName: 'Obut Official',
    sponsorPhoto: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=200&fit=crop',
    shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 8, carreau: i === 1 || i === 6, timestamp: ts() })),
    successCount: 8, totalShots: 10, carreauCount: 2, successRate: 80, duration: 185,
    notes: 'Defi sponsorise par Obut - Excellent entrainement avec les nouvelles ATX',
  },
  // c2: 10_tirs_sautee solo
  {
    id: 'c2', type: '10_tirs_sautee', mode: 'solo', date: '2026-02-04T15:00:00',
    playerId: '1', playerName: 'Jean-Pierre Martin',
    shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 7, timestamp: ts() })),
    successCount: 7, totalShots: 10, carreauCount: 1, successRate: 70, duration: 195,
  },
  // c3: precision solo (sponsored)
  {
    id: 'c3', type: 'precision', mode: 'solo', date: '2026-02-03T11:00:00',
    playerId: '1', playerName: 'Jean-Pierre Martin',
    sponsorId: 'sponsor-laboulebleue', sponsorName: 'La Boule Bleue',
    sponsorPhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    precisionShots: [
      { atelier: 'boule_seule', distance: 6, points: 5, timeUsed: 18, timestamp: ts() },
      { atelier: 'boule_seule', distance: 7, points: 3, timeUsed: 22, timestamp: ts() },
      { atelier: 'derriere_but', distance: 6, points: 3, timeUsed: 20, timestamp: ts() },
      { atelier: 'derriere_but', distance: 7, points: 1, timeUsed: 25, timestamp: ts() },
      { atelier: 'tir_but', distance: 6, points: 5, timeUsed: 15, timestamp: ts() },
      { atelier: 'tir_but', distance: 7, points: 3, timeUsed: 18, timestamp: ts() },
    ],
    totalPoints: 20, maxPoints: 30, duration: 300,
    atelierScores: { 'boule_seule': 8, 'derriere_but': 4, 'tir_but': 8 },
    notes: 'Defi precision sponsorise La Boule Bleue - Bon score sur boule seule et tir au but',
  },
  // c4: 10_tirs 1v1 (sponsored) — player wins
  {
    id: 'c4', type: '10_tirs', mode: '1v1', date: '2026-02-02T09:00:00',
    playerId: '1', playerName: 'Jean-Pierre Martin',
    opponentId: '5', opponentName: 'Lucas Moreau', winner: 'player',
    sponsorId: 'sponsor-ms', sponsorName: 'MS Petanque Pro',
    sponsorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 7, timestamp: ts() })),
    successCount: 7, totalShots: 10, carreauCount: 1, successRate: 70,
    opponentResult: { playerId: '5', playerName: 'Lucas Moreau', successCount: 5, totalShots: 10, successRate: 50 },
    duration: 200, notes: 'Defi 1v1 sponsorise par MS Petanque - Belle victoire',
  },
  // c5: 10_tirs_sautee 1v1 — draw
  {
    id: 'c5', type: '10_tirs_sautee', mode: '1v1', date: '2026-01-30T10:00:00',
    playerId: '1', playerName: 'Jean-Pierre Martin',
    opponentId: '7', opponentName: 'Thomas Garcia', winner: 'draw',
    shots: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, success: i < 6, timestamp: ts() })),
    successCount: 6, totalShots: 10, carreauCount: 0, successRate: 60,
    opponentResult: { playerId: '7', playerName: 'Thomas Garcia', successCount: 6, totalShots: 10, successRate: 60 },
    duration: 190,
  },
  // c6: precision 1v1 — opponent wins
  {
    id: 'c6', type: 'precision', mode: '1v1', date: '2026-01-28T15:00:00',
    playerId: '1', playerName: 'Jean-Pierre Martin',
    opponentId: '3', opponentName: 'Pierre Dubois', winner: 'opponent',
    precisionShots: [
      { atelier: 'boule_seule', distance: 6, points: 3, timeUsed: 20, timestamp: ts() },
      { atelier: 'entre_2_boules', distance: 7, points: 1, timeUsed: 25, timestamp: ts() },
      { atelier: 'sautee', distance: 6, points: 3, timeUsed: 22, timestamp: ts() },
    ],
    totalPoints: 7, maxPoints: 15,
    opponentResult: { playerId: '3', playerName: 'Pierre Dubois', totalPoints: 11 },
    duration: 250,
  },
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
    { id: '7', name: 'Thomas Garcia', wins: 3, losses: 2 },
    { id: '3', name: 'Pierre Dubois', wins: 2, losses: 1 },
    { id: '5', name: 'Lucas Moreau', wins: 4, losses: 1 },
  ],
};
