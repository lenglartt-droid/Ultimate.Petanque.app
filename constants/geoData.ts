/**
 * Shared geographic data: continent mapping, country list, and helpers.
 */

export const CONTINENT_MAP: Record<string, string> = {
  // Europe
  'France': 'Europe', 'Belgique': 'Europe', 'Belgium': 'Europe', 'Suisse': 'Europe', 'Switzerland': 'Europe',
  'Luxembourg': 'Europe', 'Espagne': 'Europe', 'Spain': 'Europe', 'Italie': 'Europe', 'Italy': 'Europe',
  'Allemagne': 'Europe', 'Germany': 'Europe', 'Portugal': 'Europe', 'Pays-Bas': 'Europe', 'Netherlands': 'Europe',
  'Royaume-Uni': 'Europe', 'United Kingdom': 'Europe', 'Angleterre': 'Europe', 'Croatie': 'Europe', 'Croatia': 'Europe',
  'Monaco': 'Europe', 'Andorre': 'Europe', 'Andorra': 'Europe', 'Grece': 'Europe', 'Greece': 'Europe',
  'Turquie': 'Europe', 'Turkey': 'Europe', 'Autriche': 'Europe', 'Austria': 'Europe',
  'Pologne': 'Europe', 'Poland': 'Europe', 'Republique Tcheque': 'Europe', 'Czech Republic': 'Europe',
  'Hongrie': 'Europe', 'Hungary': 'Europe', 'Roumanie': 'Europe', 'Romania': 'Europe',
  'Suede': 'Europe', 'Sweden': 'Europe', 'Norvege': 'Europe', 'Norway': 'Europe',
  'Danemark': 'Europe', 'Denmark': 'Europe', 'Finlande': 'Europe', 'Finland': 'Europe',
  'Irlande': 'Europe', 'Ireland': 'Europe', 'Ecosse': 'Europe', 'Scotland': 'Europe',
  // Africa
  'Tunisie': 'Africa', 'Tunisia': 'Africa', 'Maroc': 'Africa', 'Morocco': 'Africa',
  'Algerie': 'Africa', 'Algeria': 'Africa', 'Senegal': 'Africa', 'Madagascar': 'Africa',
  'Cote d\'Ivoire': 'Africa', 'Ivory Coast': 'Africa', 'Cameroun': 'Africa', 'Cameroon': 'Africa',
  'Afrique du Sud': 'Africa', 'South Africa': 'Africa', 'Egypte': 'Africa', 'Egypt': 'Africa',
  'Mali': 'Africa', 'Burkina Faso': 'Africa', 'Niger': 'Africa', 'Togo': 'Africa', 'Benin': 'Africa',
  'Gabon': 'Africa', 'Congo': 'Africa', 'Reunion': 'Africa', 'Mayotte': 'Africa', 'Maurice': 'Africa', 'Mauritius': 'Africa',
  // North America
  'Canada': 'North America', 'Etats-Unis': 'North America', 'United States': 'North America', 'USA': 'North America',
  'Mexique': 'North America', 'Mexico': 'North America',
  'Guadeloupe': 'North America', 'Martinique': 'North America', 'Guyane': 'South America',
  // South America
  'Bresil': 'South America', 'Brazil': 'South America', 'Argentine': 'South America', 'Argentina': 'South America',
  'Chili': 'South America', 'Chile': 'South America', 'Colombie': 'South America', 'Colombia': 'South America',
  // Asia
  'Thailande': 'Asia', 'Thailand': 'Asia', 'Japon': 'Asia', 'Japan': 'Asia', 'Chine': 'Asia', 'China': 'Asia',
  'Vietnam': 'Asia', 'Cambodge': 'Asia', 'Cambodia': 'Asia', 'Laos': 'Asia',
  'Inde': 'Asia', 'India': 'Asia', 'Coree du Sud': 'Asia', 'South Korea': 'Asia',
  'Liban': 'Asia', 'Lebanon': 'Asia', 'Israel': 'Asia',
  // Oceania
  'Australie': 'Oceania', 'Australia': 'Oceania', 'Nouvelle-Zelande': 'Oceania', 'New Zealand': 'Oceania',
  'Nouvelle-Caledonie': 'Oceania', 'Polynesie': 'Oceania', 'Tahiti': 'Oceania',
  'Wallis-et-Futuna': 'Oceania',
};

const normalizeCountry = (str: string) =>
  str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

export function getContinent(country: string): string {
  return CONTINENT_MAP[normalizeCountry(country)] || 'Europe';
}

/** Localized continent labels */
export function getContinentLabel(continent: string, fr: boolean): string {
  const labels: Record<string, { fr: string; en: string }> = {
    'Europe': { fr: 'Europe', en: 'Europe' },
    'Africa': { fr: 'Afrique', en: 'Africa' },
    'Asia': { fr: 'Asie', en: 'Asia' },
    'North America': { fr: 'Am. du Nord', en: 'N. America' },
    'South America': { fr: 'Am. du Sud', en: 'S. America' },
    'Oceania': { fr: 'Oceanie', en: 'Oceania' },
  };
  const l = labels[continent];
  return l ? (fr ? l.fr : l.en) : continent;
}

/** Country name to flag emoji mapping */
const COUNTRY_FLAGS: Record<string, string> = {
  'France': '🇫🇷', 'Belgique': '🇧🇪', 'Belgium': '🇧🇪', 'Suisse': '🇨🇭', 'Switzerland': '🇨🇭',
  'Monaco': '🇲🇨', 'Luxembourg': '🇱🇺',
  'Espagne': '🇪🇸', 'Spain': '🇪🇸', 'Italie': '🇮🇹', 'Italy': '🇮🇹',
  'Portugal': '🇵🇹', 'Allemagne': '🇩🇪', 'Germany': '🇩🇪',
  'Pays-Bas': '🇳🇱', 'Netherlands': '🇳🇱', 'Royaume-Uni': '🇬🇧', 'United Kingdom': '🇬🇧',
  'Angleterre': '🏴\u200d', 'Croatie': '🇭🇷', 'Croatia': '🇭🇷',
  'Andorre': '🇦🇩', 'Andorra': '🇦🇩', 'Grece': '🇬🇷', 'Greece': '🇬🇷',
  'Turquie': '🇹🇷', 'Turkey': '🇹🇷', 'Autriche': '🇦🇹', 'Austria': '🇦🇹',
  'Pologne': '🇵🇱', 'Poland': '🇵🇱', 'Republique Tcheque': '🇨🇿', 'Czech Republic': '🇨🇿',
  'Hongrie': '🇭🇺', 'Hungary': '🇭🇺', 'Roumanie': '🇷🇴', 'Romania': '🇷🇴',
  'Suede': '🇸🇪', 'Sweden': '🇸🇪', 'Norvege': '🇳🇴', 'Norway': '🇳🇴',
  'Danemark': '🇩🇰', 'Denmark': '🇩🇰', 'Finlande': '🇫🇮', 'Finland': '🇫🇮',
  'Irlande': '🇮🇪', 'Ireland': '🇮🇪', 'Ecosse': '🏴\u200d',
  'Tunisie': '🇹🇳', 'Tunisia': '🇹🇳', 'Maroc': '🇲🇦', 'Morocco': '🇲🇦',
  'Algerie': '🇩🇿', 'Algeria': '🇩🇿', 'Senegal': '🇸🇳', 'Madagascar': '🇲🇬',
  'Cameroun': '🇨🇲', 'Cameroon': '🇨🇲', 'Cote d\'Ivoire': '🇨🇮', 'Ivory Coast': '🇨🇮',
  'Afrique du Sud': '🇿🇦', 'South Africa': '🇿🇦', 'Egypte': '🇪🇬', 'Egypt': '🇪🇬',
  'Mali': '🇲🇱', 'Burkina Faso': '🇧🇫', 'Niger': '🇳🇪', 'Togo': '🇹🇬', 'Benin': '🇧🇯',
  'Gabon': '🇬🇦', 'Congo': '🇨🇬', 'Reunion': '🇷🇪', 'Mayotte': '🇾🇹',
  'Maurice': '🇲🇺', 'Mauritius': '🇲🇺',
  'Canada': '🇨🇦', 'Etats-Unis': '🇺🇸', 'United States': '🇺🇸', 'USA': '🇺🇸',
  'Mexique': '🇲🇽', 'Mexico': '🇲🇽',
  'Guadeloupe': '🇬🇵', 'Martinique': '🇲🇶', 'Guyane': '🇬🇫',
  'Bresil': '🇧🇷', 'Brazil': '🇧🇷', 'Argentine': '🇦🇷', 'Argentina': '🇦🇷',
  'Chili': '🇨🇱', 'Chile': '🇨🇱', 'Colombie': '🇨🇴', 'Colombia': '🇨🇴',
  'Thailande': '🇹🇭', 'Thailand': '🇹🇭', 'Japon': '🇯🇵', 'Japan': '🇯🇵',
  'Chine': '🇨🇳', 'China': '🇨🇳', 'Vietnam': '🇻🇳',
  'Cambodge': '🇰🇭', 'Cambodia': '🇰🇭', 'Laos': '🇱🇦',
  'Inde': '🇮🇳', 'India': '🇮🇳', 'Coree du Sud': '🇰🇷', 'South Korea': '🇰🇷',
  'Liban': '🇱🇧', 'Lebanon': '🇱🇧', 'Israel': '🇮🇱',
  'Australie': '🇦🇺', 'Australia': '🇦🇺', 'Nouvelle-Zelande': '🇳🇿', 'New Zealand': '🇳🇿',
  'Nouvelle-Caledonie': '🇳🇨', 'Polynesie': '🇵🇫', 'Tahiti': '🇵🇫',
  'Wallis-et-Futuna': '🇼🇫'
};

/** Get flag emoji for a country name. Returns empty string if not found. */
export function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[normalizeCountry(country)] || '';
}

/** Continent flag/emoji */
export function getContinentFlag(continent: string): string {
  const flags: Record<string, string> = {
    'Europe': '🇪🇺', 'Africa': '🌍', 'Asia': '🌏',
    'North America': '🌎', 'South America': '🌎', 'Oceania': '🌏',
  };
  return flags[continent] || '🌐';
}

/** Common petanque countries for picker (sorted by relevance) */
export const COMMON_COUNTRIES = [
  'France', 'Belgique', 'Suisse', 'Monaco', 'Luxembourg',
  'Espagne', 'Italie', 'Portugal', 'Allemagne',
  'Pays-Bas', 'Royaume-Uni', 'Croatie', 'Grece', 'Turquie',
  'Autriche', 'Pologne', 'Hongrie', 'Roumanie', 'Andorre',
  'Suede', 'Norvege', 'Danemark', 'Finlande', 'Irlande',
  'Tunisie', 'Maroc', 'Algerie', 'Senegal', 'Madagascar',
  'Cameroun', 'Cote d\'Ivoire', 'Mali', 'Gabon', 'Togo', 'Benin',
  'Reunion', 'Mayotte', 'Maurice',
  'Canada', 'Etats-Unis', 'Mexique',
  'Guadeloupe', 'Martinique', 'Guyane',
  'Bresil', 'Argentine', 'Chili', 'Colombie',
  'Thailande', 'Japon', 'Cambodge', 'Vietnam', 'Laos', 'Chine',
  'Liban',
  'Australie', 'Nouvelle-Zelande', 'Nouvelle-Caledonie', 'Polynesie', 'Tahiti',
];
