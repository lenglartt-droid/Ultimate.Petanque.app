// Ultimate Petanque Theme - Dark Navy, Orange/Gold, Metallic Gray
// Optimized for readability with high contrast text

export const theme = {
  // Primary Colors - Brighter Navy Blue for better visibility
  primary: '#3B7DD8',
  primaryLight: '#5A9AEF',
  primaryDark: '#1B4F8A',
  
  // Accent Colors - Orange/Gold (from banner flame trail)
  accent: '#F09030',
  accentLight: '#F5A623',
  accentDark: '#C46A10',
  
  // Backgrounds - Dark Navy tinted with more separation
  background: '#0B1520',
  backgroundSecondary: '#111E2E',
  surface: '#182A3E',
  
  // Text - High contrast for readability
  textPrimary: '#F2F5F8',
  textSecondary: '#A0B8D0',
  textMuted: '#607A94',
  
  // Borders - More visible separation
  border: '#2A4562',
  borderLight: '#1E3550',
  
  // Status - Brighter for dark backgrounds
  success: '#34D97C',
  successLight: '#1A3D2B',
  error: '#F25A4A',
  errorLight: '#3D1A1A',
  warning: '#F5A623',
  warningLight: '#3D2E10',
  
  // Game specific - Higher saturation for dark theme
  pointColor: '#34D97C',
  tirColor: '#5AA8FF',
  carreauColor: '#F5A623',
  
  // Metallic accent (for special highlights)
  metallic: '#B0C4D8',
  metallicLight: '#D0DEE8',
  metallicDark: '#7A8FA4',
  
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  
  // Border Radius
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  
  // Typography
  typography: {
    heroValue: {
      fontSize: 48,
      fontWeight: '700' as const,
    },
    heroLabel: {
      fontSize: 11,
      fontWeight: '600' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
    },
    cardValue: {
      fontSize: 24,
      fontWeight: '700' as const,
    },
    sectionHeader: {
      fontSize: 14,
      fontWeight: '600' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    body: {
      fontSize: 15,
      fontWeight: '400' as const,
    },
    caption: {
      fontSize: 13,
      fontWeight: '400' as const,
    },
    small: {
      fontSize: 11,
      fontWeight: '500' as const,
    },
  },
  
  // Shadows - Adapted for dark theme
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

export default theme;
