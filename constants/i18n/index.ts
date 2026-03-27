/**
 * i18n barrel — Assembles translations from topic-specific files + original.
 *
 * Architecture: Sections are incrementally migrated from i18n.ts into
 * topic-specific files under constants/i18n/. The barrel merges them.
 *
 * Fully migrated topics:
 * - common.ts: common, tabs, roles, levels, formats, modes, offlineBanner,
 *              conflict, toast, directoryExtra, statsExtra
 * - home.ts: home, login, onboarding
 * - profile.ts: profile
 * - stats.ts: stats
 * - directory.ts: directory
 * - match.ts: match
 * - challenge.ts: challenge
 * - history.ts: history
 * - tournament.ts: tournament
 * - player.ts: player
 * - club.ts: club
 * - terrain.ts: terrain, terrainTypes, terrainTypeDescs, terrainEnv
 * - equipment.ts: equipment
 * - palmares.ts: palmares, palmaresResults
 * - financial.ts: financial
 * - map.ts: map
 * - share.ts: share, matchEdit
 * - meetup.ts: meetup
 * - leaderboard.ts: leaderboard
 *
 * Remaining sections still import from the original i18n.ts via fallback:
 * notifications, eventNotifications, password, syncHistory, mergeHistory,
 * modificationLogs, facilityLabels, locationPicker, creatorNote, reports,
 * trustScore, gamePreferences, preview, cadrage, historyExtra, challengeNames,
 * precisionWorkshops, tournamentStatus, tournamentTypes, tournamentPhases,
 * tournamentScopes, tournamentLevels, tournamentCategories, registrationTypes,
 * consent, tracking, privacy, privacyExtra, terms, notation, faq
 */

// The original monolithic file (fallback for unmigrated sections)
import { translations as originalTranslations } from '../i18n';
export type { Language } from '../i18n';

// Topic-specific overrides (migrated sections)
import { commonTranslations } from './common';
import { homeTranslations } from './home';
import { profileTranslations } from './profile';
import { statsTranslations } from './stats';
import { directoryTranslations } from './directory';
import { matchTranslations } from './match';
import { challengeTranslations } from './challenge';
import { historyTranslations } from './history';
import { tournamentTranslations } from './tournament';
import { playerTranslations } from './player';
import { clubTranslations } from './club';
import { terrainTranslations } from './terrain';
import { equipmentTranslations } from './equipment';
import { palmaresTranslations } from './palmares';
import { financialTranslations } from './financial';
import { mapTranslations } from './map';
import { shareTranslations } from './share';
import { meetupTranslations } from './meetup';
import { leaderboardTranslations } from './leaderboard';

// Merge: topic files take precedence over original via spread order
export const translations = {
  ...originalTranslations,
  // Wave 1
  ...commonTranslations,
  ...homeTranslations,
  ...profileTranslations,
  ...statsTranslations,
  ...directoryTranslations,
  ...matchTranslations,
  ...challengeTranslations,
  ...historyTranslations,
  ...tournamentTranslations,
  // Wave 2
  ...playerTranslations,
  ...clubTranslations,
  ...terrainTranslations,
  ...equipmentTranslations,
  ...palmaresTranslations,
  ...financialTranslations,
  ...mapTranslations,
  ...shareTranslations,
  ...meetupTranslations,
  ...leaderboardTranslations,
} as const;

// Translation helper function
export function t(section: string, key: string, language: 'fr' | 'en'): string {
  const sectionData = (translations as any)[section];
  if (!sectionData) return key;
  const entry = sectionData[key];
  if (!entry) return key;
  return entry[language] || entry['fr'] || key;
}
