/**
 * i18n barrel — re-exports everything from the original monolithic file.
 * 
 * This folder structure exists for maintainability.
 * Metro bundler does not support code-splitting, so splitting into
 * sub-files would NOT reduce bundle size. The original i18n.ts 
 * remains the single source of truth.
 * 
 * New code should import from '@/constants/i18n' as before.
 */

export { translations, t } from '../i18n';
export type { Language } from '../i18n';
