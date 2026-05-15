/**
 * Partner tier configuration with sponsoring limits and benefits.
 * Single source of truth for all tier-related logic.
 */

export type PartnerTier = 'partner' | 'sponsor' | 'gold_sponsor';

export interface TierLimits {
  maxSponsoringTotal: number | null; // null = unlimited
  canSponsorPlayer: boolean;
  canSponsorTerrain: boolean;
  canSponsorClub: boolean;
  canSponsorTournament: boolean;
  maxEventsPerMonth: number | null; // null = unlimited
  pushPerMonth: number | null; // null = unlimited, 0 = none
  hasAdFallback: boolean;
  hasGallery: boolean;
  maxGalleryPhotos: number;
  hasAbTesting: boolean;
  hasBenchmark: boolean;
  hasCRM: boolean;
  hasBrandKit: boolean;
  hasWeeklyDigest: boolean;
  hasOnboardingSection: boolean;
  hasPriorityDirectory: boolean;
  hasAnimatedBadge: boolean;
  hasROICalculator: boolean;
  hasBudgetTracker: boolean;
  hasMonthlyGoals: boolean;
  hasExportCsvPdf: boolean;
  hasPushTemplates: boolean;
  hasPushScheduling: boolean;
  hasDrillDown: boolean;
  hasAssignmentHistory: boolean;
}

export interface TierConfig {
  id: PartnerTier;
  badgeType: string; // maps to ambassadors.badge_type
  labelFr: string;
  labelEn: string;
  color: string;
  icon: string;
  gradient: [string, string];
  limits: TierLimits;
  benefitsFr: string[];
  benefitsEn: string[];
  criteriaFr: string[];
  criteriaEn: string[];
}

export const PARTNER_TIERS: Record<PartnerTier, TierConfig> = {
  partner: {
    id: 'partner',
    badgeType: 'partner',
    labelFr: 'Bronze',
    labelEn: 'Bronze',
    color: '#A1887F',
    icon: 'military-tech',
    gradient: ['#D7CCC8', '#A1887F'],
    limits: {
      maxSponsoringTotal: 1,
      canSponsorPlayer: true,
      canSponsorTerrain: true,
      canSponsorClub: false,
      canSponsorTournament: false,
      maxEventsPerMonth: 0,
      pushPerMonth: 0,
      hasAdFallback: false,
      hasGallery: false,
      maxGalleryPhotos: 0,
      hasAbTesting: false,
      hasBenchmark: false,
      hasCRM: false,
      hasBrandKit: false,
      hasWeeklyDigest: false,
      hasOnboardingSection: false,
      hasPriorityDirectory: false,
      hasAnimatedBadge: false,
      hasROICalculator: false,
      hasBudgetTracker: false,
      hasMonthlyGoals: false,
      hasExportCsvPdf: false,
      hasPushTemplates: false,
      hasPushScheduling: false,
      hasDrillDown: false,
      hasAssignmentHistory: false,
    },
    benefitsFr: [
      'Badge Bronze visible dans l\'annuaire joueurs',
      'Fiche partenaire dans la page "Nos Partenaires"',
      'Lien vers votre site web',
      'Apparition sur la carte avec marqueur personnalise',
      'Acces aux statistiques de base (impressions, clics)',
      '1 sponsoring actif (joueur OU terrain uniquement)',
    ],
    benefitsEn: [
      'Bronze badge visible in player directory',
      'Partner card on the "Our Partners" page',
      'Link to your website',
      'Map appearance with custom marker',
      'Access to basic statistics (impressions, clicks)',
      '1 active sponsorship (player OR terrain only)',
    ],
    criteriaFr: ['Etre une marque ou structure liee a la petanque', 'Fournir un logo et une description', 'Accepter les conditions du programme'],
    criteriaEn: ['Be a brand or structure related to petanque', 'Provide a logo and description', 'Accept the program conditions'],
  },
  sponsor: {
    id: 'sponsor',
    badgeType: 'sponsor',
    labelFr: 'Argent',
    labelEn: 'Silver',
    color: '#78909C',
    icon: 'workspace-premium',
    gradient: ['#CFD8DC', '#78909C'],
    limits: {
      maxSponsoringTotal: 3,
      canSponsorPlayer: true,
      canSponsorTerrain: true,
      canSponsorClub: true,
      canSponsorTournament: false,
      maxEventsPerMonth: 2,
      pushPerMonth: 1,
      hasAdFallback: false,
      hasGallery: true,
      maxGalleryPhotos: 3,
      hasAbTesting: false,
      hasBenchmark: false,
      hasCRM: false,
      hasBrandKit: false,
      hasWeeklyDigest: false,
      hasOnboardingSection: false,
      hasPriorityDirectory: false,
      hasAnimatedBadge: false,
      hasROICalculator: true,
      hasBudgetTracker: true,
      hasMonthlyGoals: true,
      hasExportCsvPdf: true,
      hasPushTemplates: true,
      hasPushScheduling: true,
      hasDrillDown: true,
      hasAssignmentHistory: false,
    },
    benefitsFr: [
      'Tous les avantages Bronze',
      'Jusqu\'a 3 sponsorings actifs (joueurs + terrains + 1 club)',
      'Banniere sponsor sur les pages club, terrain et joueur',
      'Badge "Sponsorise" sur les cartes annuaire',
      'Push notifications (1/mois) aux joueurs cibles',
      'Propositions de sponsoring self-service (validation admin)',
      'Marqueur carte avec bordure marque + badge S',
      'Metriques de performance par item sponsorise (drill-down)',
      'Dashboard analytique complet (ROI, CTR, portee)',
      'Templates push pre-redigees',
      'Programmation des envois push',
      'Suivi budget et cout par action (CPM, CPC)',
      'Objectifs mensuels avec suivi de progression',
      'Export CSV/PDF des statistiques',
      'Galerie photos (3 max)',
      '2 evenements sponsorises par mois',
      'Badge Argent distinctif',
    ],
    benefitsEn: [
      'All Bronze benefits',
      'Up to 3 active sponsorships (players + terrains + 1 club)',
      'Sponsor banner on club, terrain and player pages',
      '"Sponsored" badge on directory cards',
      'Push notifications (1/month) to targeted players',
      'Self-service sponsorship proposals (admin validation)',
      'Map marker with brand border + S badge',
      'Per-item sponsored performance metrics (drill-down)',
      'Full analytics dashboard (ROI, CTR, reach)',
      'Pre-written push templates',
      'Push scheduling',
      'Budget tracker and cost per action (CPM, CPC)',
      'Monthly goals with progress tracking',
      'CSV/PDF stats export',
      'Photo gallery (3 max)',
      '2 sponsored events per month',
      'Distinctive Silver badge',
    ],
    criteriaFr: ['Tous les criteres Bronze', 'Engagement minimum de 3 mois', 'Contenu de marque (logo HD, couleur, description)'],
    criteriaEn: ['All Bronze criteria', 'Minimum 3-month commitment', 'Brand content (HD logo, color, description)'],
  },
  gold_sponsor: {
    id: 'gold_sponsor',
    badgeType: 'gold_sponsor',
    labelFr: 'Or',
    labelEn: 'Gold',
    color: '#D4A017',
    icon: 'emoji-events',
    gradient: ['#F9E547', '#D4A017'],
    limits: {
      maxSponsoringTotal: null,
      canSponsorPlayer: true,
      canSponsorTerrain: true,
      canSponsorClub: true,
      canSponsorTournament: true,
      maxEventsPerMonth: null,
      pushPerMonth: null,
      hasAdFallback: true,
      hasGallery: true,
      maxGalleryPhotos: 999,
      hasAbTesting: true,
      hasBenchmark: true,
      hasCRM: true,
      hasBrandKit: true,
      hasWeeklyDigest: true,
      hasOnboardingSection: true,
      hasPriorityDirectory: true,
      hasAnimatedBadge: true,
      hasROICalculator: true,
      hasBudgetTracker: true,
      hasMonthlyGoals: true,
      hasExportCsvPdf: true,
      hasPushTemplates: true,
      hasPushScheduling: true,
      hasDrillDown: true,
      hasAssignmentHistory: true,
    },
    benefitsFr: [
      'Tous les avantages Argent',
      'Sponsorings illimites (joueurs + terrains + clubs + tournois)',
      'Banniere permanente et prioritaire sur l\'accueil',
      'Position prioritaire dans les resultats de l\'annuaire',
      'Badge Or anime (pulse dore) dans l\'annuaire',
      'Section dediee dans l\'onboarding des nouveaux joueurs',
      'Push notifications illimitees avec A/B testing',
      'Heatmap de performance et benchmark concurrents',
      'Calculateur ROI integre avec projections annuelles',
      'CRM parrainages avec export CSV',
      'Digest hebdomadaire automatique',
      'Kit de marque exportable (PDF)',
      'Historique des assignations sponsor (admin)',
      'Evenements sponsorises illimites',
      'Galerie photos illimitee',
      'Fallback dans l\'espace publicitaire (remplace pubs)',
      'Badge Or exclusif et marqueur carte premium',
    ],
    benefitsEn: [
      'All Silver benefits',
      'Unlimited sponsorships (players + terrains + clubs + tournaments)',
      'Permanent priority banner on home page',
      'Priority position in directory results',
      'Animated Gold badge (golden pulse) in directory',
      'Dedicated section in new player onboarding',
      'Unlimited push notifications with A/B testing',
      'Performance heatmap and competitor benchmark',
      'Integrated ROI calculator with annual projections',
      'Referral CRM with CSV export',
      'Automatic weekly digest',
      'Exportable brand kit (PDF)',
      'Sponsor assignment history (admin)',
      'Unlimited sponsored events',
      'Unlimited photo gallery',
      'Ad space fallback (replaces ads)',
      'Exclusive Gold badge and premium map marker',
    ],
    criteriaFr: ['Tous les criteres Argent', 'Engagement minimum de 6 mois', 'Marque reconnue dans le milieu petanque'],
    criteriaEn: ['All Silver criteria', 'Minimum 6-month commitment', 'Recognized brand in the petanque world'],
  },
};

/** Get tier config from badge_type string */
export function getTierConfig(badgeType: string): TierConfig {
  if (badgeType === 'gold_sponsor') return PARTNER_TIERS.gold_sponsor;
  if (badgeType === 'sponsor') return PARTNER_TIERS.sponsor;
  return PARTNER_TIERS.partner;
}

/** Get tier limits from badge_type string */
export function getTierLimits(badgeType: string): TierLimits {
  return getTierConfig(badgeType).limits;
}

/** Check if a specific item type can be sponsored at this tier */
export function canSponsorItemType(badgeType: string, itemType: 'terrains' | 'clubs' | 'tournaments' | 'players'): boolean {
  const limits = getTierLimits(badgeType);
  switch (itemType) {
    case 'players': return limits.canSponsorPlayer;
    case 'terrains': return limits.canSponsorTerrain;
    case 'clubs': return limits.canSponsorClub;
    case 'tournaments': return limits.canSponsorTournament;
    default: return false;
  }
}

/** Get the label for a tier's sponsoring limit */
export function getSponsoringLimitLabel(badgeType: string, fr: boolean): string {
  const limits = getTierLimits(badgeType);
  if (limits.maxSponsoringTotal === null) return fr ? 'Illimite' : 'Unlimited';
  return `${limits.maxSponsoringTotal} max`;
}

/** Build comparison table rows */
export function getComparisonRows(fr: boolean): { feature: string; bronze: boolean; silver: boolean; gold: boolean }[] {
  return [
    { feature: fr ? 'Badge annuaire' : 'Directory badge', bronze: true, silver: true, gold: true },
    { feature: fr ? 'Fiche partenaire' : 'Partner card', bronze: true, silver: true, gold: true },
    { feature: fr ? 'Marqueur carte' : 'Map marker', bronze: true, silver: true, gold: true },
    { feature: fr ? 'Sponsoring joueur' : 'Player sponsorship', bronze: true, silver: true, gold: true },
    { feature: fr ? 'Sponsoring terrain' : 'Terrain sponsorship', bronze: true, silver: true, gold: true },
    { feature: fr ? 'Sponsoring club' : 'Club sponsorship', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Sponsoring tournoi' : 'Tournament sponsorship', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Limite sponsoring' : 'Sponsoring limit', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Banniere sponsor (club/terrain/joueur)' : 'Sponsor banner (club/terrain/player)', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Badge "Sponsorise" sur cartes' : '"Sponsored" badge on cards', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Propositions sponsoring self-service' : 'Self-service sponsorship proposals', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Push notifications' : 'Push notifications', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Templates push' : 'Push templates', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Programmation push' : 'Push scheduling', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Suivi budget & ROI' : 'Budget tracker & ROI', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Objectifs mensuels' : 'Monthly goals', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Export CSV/PDF' : 'CSV/PDF export', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Galerie photos' : 'Photo gallery', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Marqueur carte sponsorise (S)' : 'Sponsored map marker (S)', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Drill-down par item' : 'Per-item drill-down', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Evenements sponsorises' : 'Sponsored events', bronze: false, silver: true, gold: true },
    { feature: fr ? 'Position prioritaire annuaire' : 'Priority directory position', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Badge anime (pulse)' : 'Animated badge (pulse)', bronze: false, silver: false, gold: true },
    { feature: 'A/B Testing', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Push illimites' : 'Unlimited push', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Heatmap & Benchmark' : 'Heatmap & Benchmark', bronze: false, silver: false, gold: true },
    { feature: 'CRM & Export', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Digest hebdomadaire' : 'Weekly digest', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Section onboarding' : 'Onboarding section', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Kit de marque PDF' : 'Brand kit PDF', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Fallback publicitaire' : 'Ad fallback', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Historique assignations' : 'Assignment history', bronze: false, silver: false, gold: true },
    { feature: fr ? 'Sponsoring tournois' : 'Tournament sponsorship', bronze: false, silver: false, gold: true },
  ];
}
