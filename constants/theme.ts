// Ultimate Petanque Theme - Dark Navy, Orange/Gold, Metallic Gray

export const theme = {
  // Primary Colors - Deep Navy Blue
  primary: '#1B3A5C',
  primaryLight: '#2D5A8E',
  primaryDark: '#0F2440',
  
  // Accent Colors - Orange/Gold (from banner flame trail)
  accent: '#E8862A',
  accentLight: '#F5A623',
  accentDark: '#C46A10',
  
  // Backgrounds - Dark Navy tinted
  background: '#0D1B2A',
  backgroundSecondary: '#132233',
  surface: '#1A2D42',
  
  // Text - Light on dark
  textPrimary: '#ECF0F4',
  textSecondary: '#8DA4BE',
  textMuted: '#506A84',
  
  // Borders - Subtle navy tones
  border: '#253D56',
  borderLight: '#1E3348',
  
  // Status
  success: '#2ECC71',
  successLight: '#1A3D2B',
  error: '#E74C3C',
  errorLight: '#3D1A1A',
  warning: '#F5A623',
  warningLight: '#3D2E10',
  
  // Game specific - Adapted to branding
  pointColor: '#2ECC71',
  tirColor: '#4A9BF5',
  carreauColor: '#F5A623',
  
  // Metallic accent (for special highlights)
  metallic: '#A8B8C8',
  metallicLight: '#C8D6E5',
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
