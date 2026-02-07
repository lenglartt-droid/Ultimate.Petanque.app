// PetanqueScore Configuration

export const config = {
  appName: 'PetanqueScore',
  version: '1.0.0',
  
  // Game Rules
  game: {
    maxScore: 13,
    formats: ['Tête-à-tête', 'Doublette', 'Triplette'] as const,
    boulesPerPlayer: {
      'Tête-à-tête': 3,
      'Doublette': 3,
      'Triplette': 2,
    } as const,
  },
  
  // Match Modes
  matchModes: ['Entraînement', 'Tournoi'] as const,
  
  // Tournament Types (Cadrage)
  tournamentTypes: ['Poules', 'Élimination directe', 'Mixte', 'Suisse', 'A/B/C', 'Tirage intégral', 'Autre'] as const,
  
  // Shot Types
  shotTypes: [
    { id: 'point', label: 'Point', icon: 'radio-button-on' },
    { id: 'tir', label: 'Tir', icon: 'flame' },
    { id: 'carreau', label: 'Carreau', icon: 'star' },
  ] as const,
  
  // Player Roles
  playerRoles: ['Pointeur', 'Tireur', 'Milieu'] as const,
  
  // Map Settings
  map: {
    defaultRegion: {
      latitude: 46.603354,
      longitude: 1.888334,
      latitudeDelta: 8,
      longitudeDelta: 8,
    },
    markerColors: {
      club: '#2563EB',
      player: '#10B981',
      tournament: '#F59E0B',
    },
  },
  
  // Statistics Categories
  statsCategories: [
    { id: 'global', label: 'Global' },
    { id: 'tir', label: 'Tir' },
    { id: 'point', label: 'Point' },
    { id: 'matchups', label: 'Face à Face' },
  ] as const,
};

export type GameFormat = typeof config.game.formats[number];
export type MatchMode = typeof config.matchModes[number];
export type TournamentType = typeof config.tournamentTypes[number];
export type ShotType = typeof config.shotTypes[number]['id'];
export type PlayerRole = typeof config.playerRoles[number];

export default config;
