/**
 * i18n barrel — Assembles translations from topic-specific files + original.
 * 
 * Architecture: Sections are incrementally migrated from i18n.ts into
 * topic-specific files under constants/i18n/. The barrel merges them.
 * 
 * Migrated topics:
 * - common.ts: common, tabs, roles, levels, formats, modes, offlineBanner,
 *              conflict, toast, directoryExtra, statsExtra
 * - home.ts: home, login, onboarding
 * 
 * All remaining sections still import from the original i18n.ts.
 * 
 * To add a new topic file:
 * 1. Create constants/i18n/{topic}.ts with exported object
 * 2. Import here and spread into `translations`
 * 3. Optionally remove the section from i18n.ts (not required since
 *    spread order means topic files override the original)
 */

// The original monolithic file (still the primary source)
import { translations as originalTranslations } from '../i18n';
export type { Language } from '../i18n';

// Topic-specific overrides (migrated sections)
import { commonTranslations } from './common';
import { homeTranslations } from './home';

// Merge: topic files take precedence over original
export const translations = {
  ...originalTranslations,
  ...commonTranslations,
  ...homeTranslations,
} as const;

// Translation helper function
export function t(section: string, key: string, language: 'fr' | 'en'): string {
  const sectionData = (translations as any)[section];
  if (!sectionData) return key;
  const entry = sectionData[key];
  if (!entry) return key;
  return entry[language] || entry['fr'] || key;
}
