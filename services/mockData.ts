/**
 * Re-export barrel for backward compatibility.
 * All types are now defined in @/types/petanque.
 * All constants are now in @/constants/challengeConfig.
 *
 * New code should import directly from:
 *   import { Player, Match } from '@/types/petanque';
 *   import { PRECISION_ATELIERS } from '@/constants/challengeConfig';
 */

export type {
  BoulesSet,
  BoulesInfo,
  Player,
  Club,
  TournamentNotification,
  Terrain,
  BracketMatch,
  TournamentPhase,
  TournamentTeam,
  Tournament,
  MatchPlayerRole,
  SeriesInfo,
  Match,
  Mene,
  ShotAction,
  DetailedShotRecord,
  PlayerAction,
  ChallengeType,
  PrecisionAtelier,
  PrecisionDistance,
  PrecisionShot,
  PrecisionScoringOption,
  PrecisionAtelierConfig,
  ChallengeShot,
  ChallengeMode,
  ChallengePlayerResult,
  ChallengeDetailedShot,
  Challenge,
  ChallengeStats,
  HeadToHead,
} from '@/types/petanque';

export {
  PRECISION_ATELIERS,
  PRECISION_DISTANCES,
  PRECISION_POINTS_CONFIG,
} from '@/constants/challengeConfig';
