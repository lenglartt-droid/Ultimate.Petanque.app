// Ultimate Petanque Theme - Dark Navy, Orange/Gold, Metallic Gray
// Supports Light & Dark mode while keeping brand accents

export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  background: string;
  backgroundSecondary: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  success: string;
  successLight: string;
  error: string;
  errorLight: string;
  warning: string;
  warningLight: string;
  pointColor: string;
  tirColor: string;
  carreauColor: string;
  metallic: string;
  metallicLight: string;
  metallicDark: string;
  spacing: typeof SPACING;
  borderRadius: typeof BORDER_RADIUS;
  typography: typeof TYPOGRAPHY;
  shadows: {
    card: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    cardElevated: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
}

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

const TYPOGRAPHY = {
  heroValue: { fontSize: 48, fontWeight: '700' as const },
  heroLabel: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' as const },
  cardValue: { fontSize: 24, fontWeight: '700' as const },
  sectionHeader: { fontSize: 14, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '500' as const },
};

// ============ DARK THEME ============
export const darkTheme: ThemeColors = {
  primary: '#3B7DD8',
  primaryLight: '#5A9AEF',
  primaryDark: '#1B4F8A',
  accent: '#F09030',
  accentLight: '#F5A623',
  accentDark: '#C46A10',
  background: '#0B1520',
  backgroundSecondary: '#111E2E',
  surface: '#182A3E',
  textPrimary: '#F2F5F8',
  textSecondary: '#A0B8D0',
  textMuted: '#607A94',
  border: '#2A4562',
  borderLight: '#1E3550',
  success: '#34D97C',
  successLight: '#1A3D2B',
  error: '#F25A4A',
  errorLight: '#3D1A1A',
  warning: '#F5A623',
  warningLight: '#3D2E10',
  pointColor: '#34D97C',
  tirColor: '#5AA8FF',
  carreauColor: '#F5A623',
  metallic: '#B0C4D8',
  metallicLight: '#D0DEE8',
  metallicDark: '#7A8FA4',
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  typography: TYPOGRAPHY,
  shadows: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
    },
    cardElevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    },
  },
};

// ============ LIGHT THEME ============
export const lightTheme: ThemeColors = {
  primary: '#2563B0',
  primaryLight: '#4A8BE0',
  primaryDark: '#1A4D8A',
  accent: '#D97B1A',
  accentLight: '#F5A623',
  accentDark: '#B86010',
  background: '#F8F6F3',
  backgroundSecondary: '#F0EDEA',
  surface: '#FFFFFF',
  textPrimary: '#1A1D24',
  textSecondary: '#4A5568',
  textMuted: '#8A95A8',
  border: '#DDE1E8',
  borderLight: '#EAECF0',
  success: '#1D9B5A',
  successLight: '#E8F8EE',
  error: '#CC3D33',
  errorLight: '#FDE8E6',
  warning: '#C88012',
  warningLight: '#FEF4E0',
  pointColor: '#1D9B5A',
  tirColor: '#2563B0',
  carreauColor: '#C88012',
  metallic: '#5E6E80',
  metallicLight: '#8A9AB0',
  metallicDark: '#3D4D60',
  spacing: SPACING,
  borderRadius: BORDER_RADIUS,
  typography: TYPOGRAPHY,
  shadows: {
    card: {
      shadowColor: '#0D1520',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    cardElevated: {
      shadowColor: '#0D1520',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.10,
      shadowRadius: 10,
      elevation: 4,
    },
  },
};

// Default export = dark theme (backward compat for files not yet migrated)
export const theme = darkTheme;
export default theme;
