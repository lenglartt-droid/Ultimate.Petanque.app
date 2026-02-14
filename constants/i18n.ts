// ============================================
// INTERNATIONALIZATION - FR / EN
// ============================================

export type Language = 'fr' | 'en';

export const translations = {
  // ============================================
  // COMMON
  // ============================================
  common: {
    cancel: { fr: 'Annuler', en: 'Cancel' },
    save: { fr: 'Sauver', en: 'Save' },
    delete: { fr: 'Supprimer', en: 'Delete' },
    edit: { fr: 'Modifier', en: 'Edit' },
    close: { fr: 'Fermer', en: 'Close' },
    confirm: { fr: 'Confirmer', en: 'Confirm' },
    back: { fr: 'Retour', en: 'Back' },
    next: { fr: 'Suivant', en: 'Next' },
    search: { fr: 'Rechercher', en: 'Search' },
    all: { fr: 'Tout', en: 'All' },
    yes: { fr: 'Oui', en: 'Yes' },
    no: { fr: 'Non', en: 'No' },
    or: { fr: 'ou', en: 'or' },
    error: { fr: 'Erreur', en: 'Error' },
    success: { fr: 'Succès', en: 'Success' },
    loading: { fr: 'Chargement...', en: 'Loading...' },
    noResults: { fr: 'Aucun résultat', en: 'No results' },
    reset: { fr: 'Réinitialiser', en: 'Reset' },
    seeAll: { fr: 'Voir tout', en: 'See all' },
    items: { fr: 'éléments', en: 'items' },
    results: { fr: 'résultat(s)', en: 'result(s)' },
    for: { fr: 'pour', en: 'for' },
    since: { fr: 'Depuis', en: 'Since' },
    clear: { fr: 'Effacer', en: 'Clear' },
    clearAll: { fr: 'Effacer tout', en: 'Clear all' },
    apply: { fr: 'Appliquer', en: 'Apply' },
    create: { fr: 'Créer', en: 'Create' },
    add: { fr: 'Ajouter', en: 'Add' },
    today: { fr: "Auj.", en: 'Today' },
    version: { fr: 'Ultimate Petanque v1.0.0', en: 'Ultimate Petanque v1.0.0' },
  },

  // ============================================
  // TABS
  // ============================================
  tabs: {
    home: { fr: 'Accueil', en: 'Home' },
    stats: { fr: 'Stats', en: 'Stats' },
    directory: { fr: 'Annuaire', en: 'Directory' },
    map: { fr: 'Carte', en: 'Map' },
  },

  // ============================================
  // HOME
  // ============================================
  home: {
    whatDoYouWant: { fr: 'Que voulez-vous faire ?', en: 'What would you like to do?' },
    match: { fr: 'Match', en: 'Match' },
    training: { fr: 'Entraînement', en: 'Training' },
    challenge: { fr: 'Défi', en: 'Challenge' },
    shotsPoints: { fr: 'Tirs / Points', en: 'Shots / Points' },
    tournament: { fr: 'Tournoi', en: 'Tournament' },
    myJourney: { fr: 'Mon parcours', en: 'My journey' },
    quickAccess: { fr: 'Accès rapide', en: 'Quick access' },
    player: { fr: 'Joueur', en: 'Player' },
    terrain: { fr: 'Terrain', en: 'Terrain' },
    club: { fr: 'Club', en: 'Club' },
    viewHistory: { fr: 'Voir mon historique', en: 'View my history' },
    welcomeTitle: { fr: 'Bienvenue sur Ultimate Petanque !', en: 'Welcome to Ultimate Petanque!' },
    welcomeText: {
      fr: "Commencez par créer un match d'entraînement ou lancez un défi pour suivre vos performances.",
      en: 'Start by creating a training match or launch a challenge to track your performance.',
    },
    firstMatch: { fr: 'Premier match', en: 'First match' },
    myTournaments: { fr: 'Mes Tournois', en: 'My Tournaments' },
    noTournament: { fr: 'Aucun tournoi', en: 'No tournaments' },
    noTournamentText: {
      fr: 'Créez un tournoi pour commencer à suivre votre parcours en compétition',
      en: 'Create a tournament to start tracking your competition journey',
    },
    createTournament: { fr: 'Créer un tournoi', en: 'Create a tournament' },
    noTournamentFilter: { fr: 'Aucun tournoi', en: 'No tournaments' },
  },

  // ============================================
  // LOGIN
  // ============================================
  login: {
    welcomeBack: { fr: 'Content de vous revoir !', en: 'Welcome back!' },
    createAccount: { fr: 'Créez votre compte', en: 'Create your account' },
    signIn: { fr: 'Connexion', en: 'Sign In' },
    signUp: { fr: 'Inscription', en: 'Sign Up' },
    email: { fr: 'Email', en: 'Email' },
    password: { fr: 'Mot de passe', en: 'Password' },
    confirmPassword: { fr: 'Confirmer le mot de passe', en: 'Confirm password' },
    passwordMin: { fr: 'Mot de passe (min. 6 caractères)', en: 'Password (min. 6 characters)' },
    login: { fr: 'Se connecter', en: 'Log in' },
    getCode: { fr: 'Recevoir le code', en: 'Get code' },
    verifyEmail: { fr: 'Vérifiez votre email', en: 'Check your email' },
    codeSent: { fr: 'Un code à 4 chiffres a été envoyé à', en: 'A 4-digit code was sent to' },
    verificationCode: { fr: 'Code de vérification', en: 'Verification code' },
    createMyAccount: { fr: 'Créer mon compte', en: 'Create my account' },
    editEmail: { fr: "Modifier l'email", en: 'Edit email' },
    continueWithGoogle: { fr: 'Continuer avec Google', en: 'Continue with Google' },
    termsText: {
      fr: "En continuant, vous acceptez nos conditions d'utilisation",
      en: 'By continuing, you agree to our terms of use',
    },
    fillAllFields: { fr: 'Veuillez remplir tous les champs', en: 'Please fill in all fields' },
    enterEmail: { fr: 'Veuillez entrer votre email', en: 'Please enter your email' },
    passwordTooShort: { fr: 'Le mot de passe doit contenir au moins 6 caractères', en: 'Password must be at least 6 characters' },
    passwordMismatch: { fr: 'Les mots de passe ne correspondent pas', en: 'Passwords do not match' },
    enterCode: { fr: 'Veuillez entrer le code de vérification', en: 'Please enter the verification code' },
    codeSentSuccess: { fr: 'Code envoyé', en: 'Code sent' },
    codeSentMessage: { fr: 'Un code de vérification a été envoyé à votre email', en: 'A verification code was sent to your email' },
    loginError: { fr: 'Erreur de connexion', en: 'Login error' },
    googleError: { fr: 'Erreur Google', en: 'Google error' },
  },

  // ============================================
  // PROFILE
  // ============================================
  profile: {
    myProfile: { fr: 'Mon Profil', en: 'My Profile' },
    editProfile: { fr: 'MODIFIER MON PROFIL', en: 'EDIT MY PROFILE' },
    username: { fr: "Nom d'utilisateur", en: 'Username' },
    usernamePlaceholder: { fr: 'Votre nom ou pseudo', en: 'Your name or nickname' },
    preferredRole: { fr: 'Rôle préféré', en: 'Preferred role' },
    level: { fr: 'Niveau', en: 'Level' },
    contact: { fr: 'Contact', en: 'Contact' },
    phone: { fr: 'Numéro de téléphone', en: 'Phone number' },
    emailAddress: { fr: 'Adresse email', en: 'Email address' },
    selectClub: { fr: 'Sélectionner un club', en: 'Select a club' },
    chooseClub: { fr: 'Choisir un club', en: 'Choose a club' },
    newClub: { fr: 'Nouveau club', en: 'New club' },
    createNewClub: { fr: 'Créer un nouveau club', en: 'Create a new club' },
    clubName: { fr: 'Nom du club', en: 'Club name' },
    clubCity: { fr: 'Ville', en: 'City' },
    createClub: { fr: 'Créer le club', en: 'Create club' },
    searchClub: { fr: 'Rechercher un club...', en: 'Search for a club...' },
    noClubFound: { fr: 'Aucun club trouvé', en: 'No club found' },
    noClubRegistered: { fr: 'Aucun club enregistré', en: 'No club registered' },
    financialSummary: { fr: 'Bilan financier', en: 'Financial summary' },
    myPlayerCard: { fr: 'Ma fiche joueur', en: 'My player card' },
    viewDetailedStats: { fr: 'Voir mes statistiques détaillées', en: 'View my detailed stats' },
    myPalmares: { fr: 'Mon Palmarès', en: 'My Achievements' },
    tournamentsResultsGains: { fr: 'Tournois, résultats et gains', en: 'Tournaments, results and winnings' },
    settings: { fr: 'PARAMÈTRES', en: 'SETTINGS' },
    password: { fr: 'Mot de passe', en: 'Password' },
    changePassword: { fr: 'Changer votre mot de passe', en: 'Change your password' },
    notifications: { fr: 'Notifications', en: 'Notifications' },
    shareAndTournaments: { fr: 'Partage et tournois', en: 'Sharing and tournaments' },
    shareNotifications: { fr: 'Notifications de partage', en: 'Sharing notifications' },
    newAccess: { fr: 'nouvel accès à vos fiches', en: 'new access to your cards' },
    seeWhoAccessed: { fr: 'Voir qui a accédé à vos fiches', en: 'See who accessed your cards' },
    tournamentNotifications: { fr: 'Notifications de tournois', en: 'Tournament notifications' },
    remindersScheduling: { fr: 'Rappels et programmation', en: 'Reminders and scheduling' },
    sharing: { fr: 'Partage', en: 'Sharing' },
    codesAndManagement: { fr: 'Codes et gestion des partages', en: 'Codes and sharing management' },
    shareCode: { fr: 'Code de partage', en: 'Share code' },
    enterCodeToView: { fr: 'Saisir un code pour voir une fiche', en: 'Enter a code to view a card' },
    shareManagement: { fr: 'Gestion des partages', en: 'Share management' },
    viewManageShared: { fr: 'Voir et gérer vos fiches partagées', en: 'View and manage your shared cards' },
    help: { fr: 'Aide', en: 'Help' },
    helpCenter: { fr: "Centre d'aide et FAQ", en: 'Help center and FAQ' },
    logout: { fr: 'Se déconnecter', en: 'Log out' },
    logoutConfirm: { fr: 'Déconnexion', en: 'Logout' },
    logoutMessage: { fr: 'Êtes-vous sûr de vouloir vous déconnecter ?', en: 'Are you sure you want to log out?' },
    profileUpdated: { fr: 'Profil mis à jour', en: 'Profile updated' },
    usernameRequired: { fr: "Le nom d'utilisateur est requis", en: 'Username is required' },
    nameAndCityRequired: { fr: 'Le nom et la ville du club sont requis', en: 'Club name and city are required' },
    photoProfile: { fr: 'Photo de profil', en: 'Profile photo' },
    chooseOption: { fr: 'Choisissez une option', en: 'Choose an option' },
    takePhoto: { fr: 'Prendre une photo', en: 'Take a photo' },
    chooseGallery: { fr: 'Choisir dans la galerie', en: 'Choose from gallery' },
    removePhoto: { fr: 'Supprimer la photo', en: 'Remove photo' },
    photoUpdated: { fr: 'Photo de profil mise à jour', en: 'Profile photo updated' },
    matches: { fr: 'Matchs', en: 'Matches' },
    victories: { fr: 'Victoires', en: 'Wins' },
    challenges: { fr: 'Défis', en: 'Challenges' },
    language: { fr: 'Langue', en: 'Language' },
    languageSubtext: { fr: 'Français / English', en: 'French / English' },
  },

  // ============================================
  // STATS
  // ============================================
  stats: {
    statistics: { fr: 'Statistiques', en: 'Statistics' },
    matches: { fr: 'parties', en: 'games' },
    victories: { fr: 'victoires', en: 'wins' },
    progression: { fr: 'Progression', en: 'Progression' },
    performance: { fr: 'Perf.', en: 'Perf.' },
    tir: { fr: 'Tir', en: 'Shot' },
    point: { fr: 'Point', en: 'Point' },
    errors: { fr: 'Erreurs', en: 'Errors' },
    week: { fr: '7j', en: '7d' },
    month: { fr: '30j', en: '30d' },
    threeMonths: { fr: '3 mois', en: '3 months' },
    sixMonths: { fr: '6 mois', en: '6 months' },
    year: { fr: '1an', en: '1yr' },
    noStatsYet: { fr: 'Pas encore de statistiques', en: 'No statistics yet' },
    playToSee: { fr: 'Jouez des matchs pour voir vos statistiques évoluer', en: 'Play matches to see your statistics evolve' },
    newMatch: { fr: 'Nouveau match', en: 'New match' },
    gamesPlayed: { fr: 'Parties jouées', en: 'Games played' },
    total: { fr: 'Total', en: 'Total' },
    winRateByMode: { fr: 'Taux de victoire par mode', en: 'Win rate by mode' },
    winRateByFormat: { fr: 'Taux de victoire par format', en: 'Win rate by format' },
    avgScorePerGame: { fr: 'Score moyen par partie', en: 'Average score per game' },
    scored: { fr: 'Marqués', en: 'Scored' },
    conceded: { fr: 'Encaissés', en: 'Conceded' },
    avgPerGame: { fr: 'moy./partie', en: 'avg/game' },
    gameDuration: { fr: 'Durée des parties', en: 'Game duration' },
    avgDuration: { fr: 'durée moyenne', en: 'average duration' },
    fastest: { fr: 'plus rapide', en: 'fastest' },
    longest: { fr: 'plus longue', en: 'longest' },
    totalPlayTime: { fr: 'Temps total de jeu', en: 'Total play time' },
    successRate: { fr: 'Réussite', en: 'Success' },
    succeeded: { fr: 'Réussis', en: 'Succeeded' },
    missed: { fr: 'Manqués', en: 'Missed' },
    volumeSuccess: { fr: 'Volume & Réussite', en: 'Volume & Success' },
    attempted: { fr: 'Tirs tentés', en: 'Shots attempted' },
    successPercent: { fr: '% de réussite', en: '% success' },
    carreauPercent: { fr: '% de carreaux', en: '% carreaux' },
    shotsPerGame: { fr: 'Tirs par partie', en: 'Shots per game' },
    resultBreakdown: { fr: 'Répartition des résultats', en: 'Result breakdown' },
    carreaux: { fr: 'Carreaux', en: 'Carreaux' },
    halfShots: { fr: 'Demi-tirs', en: 'Half-shots' },
    shotTypes: { fr: 'Types de tir', en: 'Shot types' },
    analyzed: { fr: 'analysés', en: 'analyzed' },
    tirTendu: { fr: 'Tir tendu', en: 'Direct shot' },
    tirCloche: { fr: 'Tir en cloche', en: 'Lob shot' },
    enRafle: { fr: 'En rafle', en: 'Rolling shot' },
    courtRamasse: { fr: 'Court ramassé', en: 'Short pick' },
    shotTypeImpact: { fr: 'Type de tir × Impact', en: 'Shot type × Impact' },
    crossed: { fr: 'croisés', en: 'crossed' },
    gain: { fr: 'Gain', en: 'Gain' },
    decisive: { fr: 'Décisif', en: 'Decisive' },
    neutral: { fr: 'Neutre', en: 'Neutral' },
    negative: { fr: 'Négatif', en: 'Negative' },
    shotImpact: { fr: 'Impact du tir', en: 'Shot impact' },
    qualified: { fr: 'qualifiés', en: 'qualified' },
    gainPoint: { fr: 'Gain de point', en: 'Point gain' },
    noEffect: { fr: 'Sans effet', en: 'No effect' },
    pointsAttempted: { fr: 'Points tentés', en: 'Points attempted' },
    pointsPerEnd: { fr: 'Points par mène', en: 'Points per end' },
    pointTypes: { fr: 'Types de points', en: 'Point types' },
    rolledPoint: { fr: 'Point roulé', en: 'Rolled point' },
    droppedPoint: { fr: 'Point plombé', en: 'Dropped point' },
    halfCarry: { fr: 'Demi-portée', en: 'Half carry' },
    carriedPoint: { fr: 'Point portée', en: 'Carried point' },
    successQuality: { fr: 'Qualité des points réussis', en: 'Quality of successful points' },
    excellent: { fr: 'Excellent (< 10 cm)', en: 'Excellent (< 10 cm)' },
    good: { fr: 'Bon (< 30 cm)', en: 'Good (< 30 cm)' },
    average: { fr: 'Moyen (< 50 cm)', en: 'Average (< 50 cm)' },
    atJack: { fr: 'Au bouchon', en: 'At jack' },
    inFrontBall: { fr: 'Devant de boule', en: 'In front of ball' },
    pointTypeQuality: { fr: 'Type de point × Qualité', en: 'Point type × Quality' },
    totalErrors: { fr: 'erreurs totales', en: 'total errors' },
    missedShots: { fr: 'Tirs ratés', en: 'Missed shots' },
    missedPoints: { fr: 'Points ratés', en: 'Missed points' },
    mostCommonError: { fr: 'Erreur la plus fréquente', en: 'Most common error' },
    overallErrorRate: { fr: "Taux d'erreur global", en: 'Overall error rate' },
    errorsByDuration: { fr: 'Erreurs selon durée de partie', en: 'Errors by game duration' },
    fatigueImpact: { fr: 'Impact de la fatigue', en: 'Fatigue impact' },
    shortGames: { fr: 'Parties courtes (< 30 min)', en: 'Short games (< 30 min)' },
    mediumGames: { fr: 'Parties moyennes (30-60 min)', en: 'Medium games (30-60 min)' },
    longGames: { fr: 'Parties longues (> 60 min)', en: 'Long games (> 60 min)' },
    errorsByFormat: { fr: 'Erreurs par format', en: 'Errors by format' },
    errorsByContext: { fr: 'Erreurs par contexte', en: 'Errors by context' },
    trainingVsTournament: { fr: 'Entraînement vs Tournoi', en: 'Training vs Tournament' },
    ofErrors: { fr: "d'erreurs", en: 'errors' },
    shotFailAnalysis: { fr: 'Analyse des échecs (Tir)', en: 'Shot failure analysis' },
    missedAnalyzed: { fr: 'tirs ratés analysés', en: 'missed shots analyzed' },
    pointFailAnalysis: { fr: 'Analyse des échecs (Points)', en: 'Point failure analysis' },
    errorsAnalyzed: { fr: 'erreurs analysées', en: 'errors analyzed' },
    errorStreaks: { fr: "Séries d'erreurs", en: 'Error streaks' },
    difficultPassages: { fr: 'Analyse des passages difficiles', en: 'Difficult passage analysis' },
    maxConsecutive: { fr: 'erreurs consécutives max', en: 'max consecutive errors' },
    streaksOf3Plus: { fr: "séries de 3+ erreurs", en: 'streaks of 3+ errors' },
    useDetailedNotation: {
      fr: "Utilisez la notation détaillée pendant vos matchs pour obtenir une analyse approfondie de vos erreurs",
      en: 'Use detailed notation during your matches to get a thorough analysis of your errors',
    },
    progressionTitle: { fr: 'Progression', en: 'Progression' },
    performanceEvolution: { fr: 'Évolution de vos performances', en: 'Performance evolution' },
    winRate: { fr: 'Taux de victoire', en: 'Win rate' },
    shotRate: { fr: 'Taux de tir', en: 'Shot rate' },
    pointRate: { fr: 'Taux de pointage', en: 'Pointing rate' },
    summary: { fr: 'Résumé', en: 'Summary' },
    notEnoughData: { fr: 'Pas assez de données', en: 'Not enough data' },
    playMoreMatches: { fr: 'Jouez plus de matchs pour voir votre progression', en: 'Play more matches to see your progression' },
    fourWeeks: { fr: '4 sem.', en: '4 wks' },
    eightWeeks: { fr: '8 sem.', en: '8 wks' },
    won: { fr: 'Gagnées', en: 'Won' },
    lost: { fr: 'Perdues', en: 'Lost' },
  },

  // ============================================
  // DIRECTORY
  // ============================================
  directory: {
    directory: { fr: 'Annuaire', en: 'Directory' },
    players: { fr: 'Joueurs', en: 'Players' },
    clubs: { fr: 'Clubs', en: 'Clubs' },
    terrains: { fr: 'Terrains', en: 'Terrains' },
    tournaments: { fr: 'Tournois', en: 'Tournaments' },
    searchPlayer: { fr: 'Rechercher un joueur...', en: 'Search for a player...' },
    searchClub: { fr: 'Rechercher un club...', en: 'Search for a club...' },
    searchTerrain: { fr: 'Rechercher un terrain...', en: 'Search for a terrain...' },
    searchTournament: { fr: 'Rechercher un tournoi...', en: 'Search for a tournament...' },
    filterPlayers: { fr: 'Filtrer les joueurs', en: 'Filter players' },
    filterClubs: { fr: 'Filtrer les clubs', en: 'Filter clubs' },
    filterTerrains: { fr: 'Filtrer les terrains', en: 'Filter terrains' },
    filterTournaments: { fr: 'Filtrer les tournois', en: 'Filter tournaments' },
    role: { fr: 'Rôle', en: 'Role' },
    city: { fr: 'Ville', en: 'City' },
    country: { fr: 'Pays', en: 'Country' },
    status: { fr: 'Statut', en: 'Status' },
    format: { fr: 'Format', en: 'Format' },
    seeResults: { fr: 'Voir', en: 'See' },
    noResult: { fr: 'Aucun résultat', en: 'No result' },
  },

  // ============================================
  // MAP
  // ============================================
  map: {
    map: { fr: 'Carte', en: 'Map' },
    interactiveMap: { fr: 'Carte Interactive', en: 'Interactive Map' },
    availableOnMobile: { fr: 'Disponible sur mobile', en: 'Available on mobile' },
    all: { fr: 'Tout', en: 'All' },
    result: { fr: 'résultat', en: 'result' },
  },

  // ============================================
  // TOURNAMENT STATUSES
  // ============================================
  tournamentStatus: {
    upcoming: { fr: 'À venir', en: 'Upcoming' },
    inProgress: { fr: 'En cours', en: 'In progress' },
    completed: { fr: 'Terminé', en: 'Completed' },
  },

  // ============================================
  // ROLES & LEVELS
  // ============================================
  roles: {
    tireur: { fr: 'Tireur', en: 'Shooter' },
    pointeur: { fr: 'Pointeur', en: 'Pointer' },
    milieu: { fr: 'Milieu', en: 'Middle' },
  },
  levels: {
    debutant: { fr: 'Débutant', en: 'Beginner' },
    intermediaire: { fr: 'Intermédiaire', en: 'Intermediate' },
    confirme: { fr: 'Confirmé', en: 'Advanced' },
    expert: { fr: 'Expert', en: 'Expert' },
  },

  // ============================================
  // FORMATS
  // ============================================
  formats: {
    teteATete: { fr: 'Tête-à-tête', en: 'Singles' },
    doublette: { fr: 'Doublette', en: 'Doubles' },
    triplette: { fr: 'Triplette', en: 'Triples' },
  },

  // ============================================
  // GAME MODES
  // ============================================
  modes: {
    training: { fr: 'Entraînement', en: 'Training' },
    tournament: { fr: 'Tournoi', en: 'Tournament' },
  },
} as const;

// Helper type to get a translation value
export type TranslationKey = keyof typeof translations;

// Helper function to get translation
export function t(section: string, key: string, lang: Language): string {
  const sectionData = (translations as any)[section];
  if (!sectionData) return key;
  const entry = sectionData[key];
  if (!entry) return key;
  return entry[lang] || entry['fr'] || key;
}
