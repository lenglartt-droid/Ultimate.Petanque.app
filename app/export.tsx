import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert } from '@/template';
import {
  exportData,
  ExportFormat,
  ExportDataType,
  ExportPeriod,
  ExportPreset,
  computePeriodStats,
} from '@/services/exportService';
import { Tournament } from '@/services/mockData';

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const { matches, challenges, tournaments, userStats } = useApp();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dataType, setDataType] = useState<ExportDataType>('matches');
  const [period, setPeriod] = useState<ExportPeriod>('all');
  const [exporting, setExporting] = useState(false);

  // Preset state
  const [preset, setPreset] = useState<ExportPreset>('none');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [comparePeriod, setComparePeriod] = useState<ExportPeriod>('30d');
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);

  // Available seasons (Sept-June)
  const availableSeasons = useMemo(() => {
    const now = new Date();
    const currentYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const seasons: { year: number; label: string }[] = [];
    for (let y = currentYear; y >= currentYear - 3; y--) {
      seasons.push({ year: y, label: `${y}-${y + 1}` });
    }
    return seasons;
  }, []);

  // Tournaments with matches
  const tournamentsWithMatches = useMemo(() => {
    return tournaments.filter(tr => matches.some(m => m.tournamentId === tr.id));
  }, [tournaments, matches]);

  // Comparative delta preview
  const deltaPreview = useMemo(() => {
    if (preset !== 'comparative') return null;
    const filteredA = period === 'all' ? matches : matches.filter(m => {
      const cutoff = new Date();
      switch (period) {
        case '7d': cutoff.setDate(cutoff.getDate() - 7); break;
        case '30d': cutoff.setDate(cutoff.getDate() - 30); break;
        case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break;
        case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break;
        case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
      }
      return new Date(m.date) >= cutoff;
    });
    const filteredB = comparePeriod === 'all' ? matches : matches.filter(m => {
      const cutoff = new Date();
      switch (comparePeriod) {
        case '7d': cutoff.setDate(cutoff.getDate() - 7); break;
        case '30d': cutoff.setDate(cutoff.getDate() - 30); break;
        case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break;
        case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break;
        case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
      }
      return new Date(m.date) >= cutoff;
    });
    const challengesA = period === 'all' ? challenges : challenges.filter(c => {
      const cutoff = new Date();
      switch (period) {
        case '7d': cutoff.setDate(cutoff.getDate() - 7); break;
        case '30d': cutoff.setDate(cutoff.getDate() - 30); break;
        case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break;
        case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break;
        case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
      }
      return new Date(c.date) >= cutoff;
    });
    const challengesB = comparePeriod === 'all' ? challenges : challenges.filter(c => {
      const cutoff = new Date();
      switch (comparePeriod) {
        case '7d': cutoff.setDate(cutoff.getDate() - 7); break;
        case '30d': cutoff.setDate(cutoff.getDate() - 30); break;
        case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break;
        case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break;
        case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
      }
      return new Date(c.date) >= cutoff;
    });
    const pLabels: Record<string, string> = language === 'fr'
      ? { all: 'Tout', '7d': '7j', '30d': '30j', '3m': '3m', '6m': '6m', '1y': '1an' }
      : { all: 'All', '7d': '7d', '30d': '30d', '3m': '3m', '6m': '6m', '1y': '1y' };
    const statsA = computePeriodStats(filteredA, challengesA, pLabels[period] || period);
    const statsB = computePeriodStats(filteredB, challengesB, pLabels[comparePeriod] || comparePeriod);
    return { statsA, statsB };
  }, [preset, period, comparePeriod, matches, challenges, language]);

  const dataTypes: { id: ExportDataType; icon: string; color: string }[] = [
    { id: 'matches', icon: 'sports', color: theme.primary },
    { id: 'challenges', icon: 'flag', color: theme.accent },
    { id: 'statistics', icon: 'bar-chart', color: theme.carreauColor },
  ];

  const periods: { id: ExportPeriod; labelFr: string; labelEn: string }[] = [
    { id: 'all', labelFr: 'Tout', labelEn: 'All' },
    { id: '7d', labelFr: '7 jours', labelEn: '7 days' },
    { id: '30d', labelFr: '30 jours', labelEn: '30 days' },
    { id: '3m', labelFr: '3 mois', labelEn: '3 months' },
    { id: '6m', labelFr: '6 mois', labelEn: '6 months' },
    { id: '1y', labelFr: '1 an', labelEn: '1 year' },
  ];

  const formatOptions: { id: ExportFormat; icon: string; label: string; desc: string }[] = [
    { id: 'csv', icon: 'table-chart', label: 'CSV', desc: language === 'fr' ? 'Tableur (Excel, Google Sheets)' : 'Spreadsheet (Excel, Google Sheets)' },
    { id: 'pdf', icon: 'picture-as-pdf', label: 'PDF', desc: language === 'fr' ? 'Document formaté' : 'Formatted document' },
  ];

  const presetOptions: { id: ExportPreset; icon: string; color: string }[] = [
    { id: 'tournament', icon: 'emoji-events', color: theme.carreauColor },
    { id: 'season', icon: 'date-range', color: theme.success },
    { id: 'comparative', icon: 'compare-arrows', color: '#6366F1' },
  ];

  const getPresetLabel = (id: ExportPreset) => {
    switch (id) {
      case 'tournament': return language === 'fr' ? 'Par tournoi' : 'By tournament';
      case 'season': return language === 'fr' ? 'Par saison' : 'By season';
      case 'comparative': return language === 'fr' ? 'Comparatif' : 'Comparative';
      default: return '';
    }
  };

  const getDataTypeLabel = (id: ExportDataType) => {
    switch (id) {
      case 'matches': return language === 'fr' ? 'Matchs' : 'Matches';
      case 'challenges': return language === 'fr' ? 'Defis' : 'Challenges';
      case 'statistics': return language === 'fr' ? 'Statistiques' : 'Statistics';
    }
  };

  const getDataTypeCount = (id: ExportDataType) => {
    switch (id) {
      case 'matches': return matches.length;
      case 'challenges': return challenges.length;
      case 'statistics': return `${matches.length} matchs + ${challenges.length} ${language === 'fr' ? 'defis' : 'challenges'}`;
    }
  };

  const getSummaryText = () => {
    if (preset === 'tournament' && selectedTournament) {
      return language === 'fr'
        ? `Export ${format.toUpperCase()} — Tournoi "${selectedTournament.name}"`
        : `${format.toUpperCase()} export — Tournament "${selectedTournament.name}"`;
    }
    if (preset === 'season' && selectedSeason) {
      return language === 'fr'
        ? `Export ${format.toUpperCase()} — Saison ${selectedSeason}-${selectedSeason + 1}`
        : `${format.toUpperCase()} export — Season ${selectedSeason}-${selectedSeason + 1}`;
    }
    if (preset === 'comparative') {
      const pA = periods.find(p => p.id === period);
      const pB = periods.find(p => p.id === comparePeriod);
      return language === 'fr'
        ? `Comparatif ${format.toUpperCase()} — ${pA?.labelFr} vs ${pB?.labelFr}`
        : `Comparative ${format.toUpperCase()} — ${pA?.labelEn} vs ${pB?.labelEn}`;
    }
    const pLabel = periods.find(p => p.id === period);
    return language === 'fr'
      ? `Export ${format.toUpperCase()} des ${getDataTypeLabel(dataType)?.toLowerCase()} — ${pLabel?.labelFr}`
      : `${format.toUpperCase()} export of ${getDataTypeLabel(dataType)?.toLowerCase()} — ${pLabel?.labelEn}`;
  };

  const handleExport = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExporting(true);

    const result = await exportData(
      {
        format,
        dataType,
        period,
        language,
        username: user?.username || user?.email || 'Joueur',
        preset,
        tournamentId: selectedTournament?.id,
        tournamentName: selectedTournament?.name,
        seasonYear: selectedSeason ?? undefined,
        comparePeriod: preset === 'comparative' ? comparePeriod : undefined,
      },
      matches,
      challenges,
      tournaments,
      userStats,
    );

    setExporting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(
        language === 'fr' ? 'Export reussi' : 'Export successful',
        language === 'fr' ? 'Fichier genere et partage' : 'File generated and shared',
      );
    } else {
      showAlert(
        language === 'fr' ? 'Erreur' : 'Error',
        result.error || (language === 'fr' ? "Erreur lors de l'export" : 'Export error'),
      );
    }
  }, [format, dataType, period, language, user, matches, challenges, tournaments, userStats, showAlert, preset, selectedTournament, selectedSeason, comparePeriod]);

  const handleSelectPreset = (id: ExportPreset) => {
    Haptics.selectionAsync();
    if (preset === id) {
      setPreset('none');
      setSelectedTournament(null);
      setSelectedSeason(null);
    } else {
      setPreset(id);
      if (id === 'tournament') {
        setDataType('matches');
      }
      if (id === 'comparative') {
        setDataType('statistics');
      }
    }
  };

  const DeltaValue = ({ a, b, suffix = '' }: { a: number; b: number; suffix?: string }) => {
    const d = a - b;
    const color = d > 0 ? theme.success : d < 0 ? theme.error : theme.textMuted;
    const sign = d > 0 ? '+' : '';
    return <Text style={{ fontSize: 12, fontWeight: '700', color }}>{sign}{d}{suffix}</Text>;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{language === 'fr' ? 'Exporter mes donnees' : 'Export my data'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
          <View style={styles.heroIconBg}>
            <MaterialIcons name="file-download" size={32} color={theme.primary} />
          </View>
          <Text style={styles.heroTitle}>{language === 'fr' ? 'Exportez vos donnees' : 'Export your data'}</Text>
          <Text style={styles.heroSubtitle}>
            {language === 'fr'
              ? 'Generez un fichier CSV ou PDF avec prereglages intelligents'
              : 'Generate a CSV or PDF file with smart presets'}
          </Text>
        </Animated.View>

        {/* Presets */}
        <Animated.View entering={FadeInDown.duration(400).delay(25)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-awesome" size={16} color={theme.textSecondary} />
            <Text style={styles.sectionTitle}>{language === 'fr' ? 'PREREGLAGES' : 'PRESETS'}</Text>
          </View>
          <View style={styles.presetRow}>
            {presetOptions.map(p => {
              const active = preset === p.id;
              return (
                <Pressable
                  key={p.id}
                  style={[styles.presetChip, active && { backgroundColor: p.color + '12', borderColor: p.color }]}
                  onPress={() => handleSelectPreset(p.id)}
                >
                  <MaterialIcons name={p.icon as any} size={18} color={active ? p.color : theme.textSecondary} />
                  <Text style={[styles.presetChipText, active && { color: p.color, fontWeight: '700' }]}>{getPresetLabel(p.id)}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Tournament Picker */}
          {preset === 'tournament' ? (
            <Animated.View entering={FadeIn.duration(250)} style={styles.presetContent}>
              <Pressable style={styles.tournamentPickerBtn} onPress={() => setShowTournamentPicker(true)}>
                {selectedTournament ? (
                  <View style={styles.tournamentSelected}>
                    <View style={[styles.tournamentSelectedIcon, { backgroundColor: theme.carreauColor + '15' }]}>
                      <MaterialIcons name="emoji-events" size={20} color={theme.carreauColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tournamentSelectedName} numberOfLines={1}>{selectedTournament.name}</Text>
                      <Text style={styles.tournamentSelectedMeta}>
                        {new Date(selectedTournament.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')} {'\u2022'} {matches.filter(m => m.tournamentId === selectedTournament.id).length} matchs
                      </Text>
                    </View>
                    <Pressable onPress={() => { setSelectedTournament(null); Haptics.selectionAsync(); }} hitSlop={8}>
                      <MaterialIcons name="close" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.tournamentPlaceholder}>
                    <MaterialIcons name="emoji-events" size={20} color={theme.textMuted} />
                    <Text style={styles.tournamentPlaceholderText}>
                      {language === 'fr' ? 'Choisir un tournoi' : 'Choose a tournament'}
                    </Text>
                    <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
                  </View>
                )}
              </Pressable>
              {tournamentsWithMatches.length === 0 ? (
                <Text style={styles.presetHint}>{language === 'fr' ? 'Aucun tournoi avec des matchs' : 'No tournaments with matches'}</Text>
              ) : null}
            </Animated.View>
          ) : null}

          {/* Season Picker */}
          {preset === 'season' ? (
            <Animated.View entering={FadeIn.duration(250)} style={styles.presetContent}>
              <View style={styles.seasonGrid}>
                {availableSeasons.map(s => {
                  const active = selectedSeason === s.year;
                  return (
                    <Pressable
                      key={s.year}
                      style={[styles.seasonChip, active && styles.seasonChipActive]}
                      onPress={() => { Haptics.selectionAsync(); setSelectedSeason(active ? null : s.year); }}
                    >
                      <MaterialIcons name="calendar-today" size={14} color={active ? theme.success : theme.textMuted} />
                      <Text style={[styles.seasonChipText, active && styles.seasonChipTextActive]}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.presetHint}>{language === 'fr' ? 'Septembre a Juin' : 'September to June'}</Text>
            </Animated.View>
          ) : null}

          {/* Comparative */}
          {preset === 'comparative' ? (
            <Animated.View entering={FadeIn.duration(250)} style={styles.presetContent}>
              <View style={styles.compareRow}>
                <View style={styles.compareSide}>
                  <Text style={styles.compareLabel}>{language === 'fr' ? 'PERIODE A' : 'PERIOD A'}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {periods.map(p => (
                      <Pressable
                        key={p.id}
                        style={[styles.comparePeriodChip, period === p.id && { backgroundColor: '#6366F1' + '12', borderColor: '#6366F1' }]}
                        onPress={() => { Haptics.selectionAsync(); setPeriod(p.id); }}
                      >
                        <Text style={[styles.comparePeriodText, period === p.id && { color: '#6366F1', fontWeight: '700' }]}>
                          {language === 'fr' ? p.labelFr : p.labelEn}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.compareVs}>
                  <Text style={styles.compareVsText}>vs</Text>
                </View>
                <View style={styles.compareSide}>
                  <Text style={styles.compareLabel}>{language === 'fr' ? 'PERIODE B' : 'PERIOD B'}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {periods.map(p => (
                      <Pressable
                        key={p.id}
                        style={[styles.comparePeriodChip, comparePeriod === p.id && { backgroundColor: theme.accent + '12', borderColor: theme.accent }]}
                        onPress={() => { Haptics.selectionAsync(); setComparePeriod(p.id); }}
                      >
                        <Text style={[styles.comparePeriodText, comparePeriod === p.id && { color: theme.accent, fontWeight: '700' }]}>
                          {language === 'fr' ? p.labelFr : p.labelEn}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Delta Preview */}
              {deltaPreview ? (
                <View style={styles.deltaPreview}>
                  <View style={styles.deltaPreviewHeader}>
                    <MaterialIcons name="analytics" size={14} color="#6366F1" />
                    <Text style={styles.deltaPreviewTitle}>{language === 'fr' ? 'Apercu delta' : 'Delta preview'}</Text>
                  </View>
                  <View style={styles.deltaGrid}>
                    {[
                      { label: language === 'fr' ? 'Matchs' : 'Games', a: deltaPreview.statsA.totalMatches, b: deltaPreview.statsB.totalMatches },
                      { label: language === 'fr' ? 'Victoires' : 'Win%', a: deltaPreview.statsA.winRate, b: deltaPreview.statsB.winRate, pct: true },
                      { label: language === 'fr' ? 'Tir' : 'Shot', a: deltaPreview.statsA.tirRate, b: deltaPreview.statsB.tirRate, pct: true },
                      { label: 'Carreau', a: deltaPreview.statsA.carreauRate, b: deltaPreview.statsB.carreauRate, pct: true },
                    ].map((m, i) => (
                      <View key={i} style={styles.deltaItem}>
                        <Text style={styles.deltaItemLabel}>{m.label}</Text>
                        <View style={styles.deltaItemValues}>
                          <Text style={styles.deltaItemA}>{m.a}{m.pct ? '%' : ''}</Text>
                          <DeltaValue a={m.a} b={m.b} suffix={m.pct ? '%' : ''} />
                          <Text style={styles.deltaItemB}>{m.b}{m.pct ? '%' : ''}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </Animated.View>

        {/* Data Type — hidden in comparative mode */}
        {preset !== 'comparative' ? (
          <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="dataset" size={16} color={theme.textSecondary} />
              <Text style={styles.sectionTitle}>{language === 'fr' ? 'DONNEES A EXPORTER' : 'DATA TO EXPORT'}</Text>
            </View>
            <View style={styles.optionGrid}>
              {dataTypes.map(dt => {
                const disabled = preset === 'tournament' && dt.id === 'challenges';
                return (
                  <Pressable
                    key={dt.id}
                    style={[styles.optionCard, dataType === dt.id && { borderColor: dt.color, backgroundColor: dt.color + '08' }, disabled && { opacity: 0.4 }]}
                    onPress={() => { if (!disabled) { Haptics.selectionAsync(); setDataType(dt.id); } }}
                    disabled={disabled}
                  >
                    <View style={[styles.optionIconBg, { backgroundColor: dt.color + '15' }]}>
                      <MaterialIcons name={dt.icon as any} size={22} color={dt.color} />
                    </View>
                    <Text style={[styles.optionLabel, dataType === dt.id && { color: dt.color, fontWeight: '700' }]}>
                      {getDataTypeLabel(dt.id)}
                    </Text>
                    <Text style={styles.optionCount}>{getDataTypeCount(dt.id)}</Text>
                    {dataType === dt.id ? (
                      <View style={[styles.optionCheck, { backgroundColor: dt.color }]}>
                        <MaterialIcons name="check" size={14} color="#FFF" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {/* Period — hidden in tournament/season/comparative presets */}
        {preset === 'none' ? (
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="date-range" size={16} color={theme.textSecondary} />
              <Text style={styles.sectionTitle}>{language === 'fr' ? 'PERIODE' : 'PERIOD'}</Text>
            </View>
            <View style={styles.periodGrid}>
              {periods.map(p => (
                <Pressable
                  key={p.id}
                  style={[styles.periodChip, period === p.id && styles.periodChipActive]}
                  onPress={() => { Haptics.selectionAsync(); setPeriod(p.id); }}
                >
                  <Text style={[styles.periodChipText, period === p.id && styles.periodChipTextActive]}>
                    {language === 'fr' ? p.labelFr : p.labelEn}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {/* Format */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="description" size={16} color={theme.textSecondary} />
            <Text style={styles.sectionTitle}>FORMAT</Text>
          </View>
          <View style={styles.formatRow}>
            {formatOptions.map(f => (
              <Pressable
                key={f.id}
                style={[styles.formatCard, format === f.id && styles.formatCardActive]}
                onPress={() => { Haptics.selectionAsync(); setFormat(f.id); }}
              >
                <View style={[styles.formatIconBg, format === f.id && { backgroundColor: theme.primary + '20' }]}>
                  <MaterialIcons name={f.icon as any} size={24} color={format === f.id ? theme.primary : theme.textMuted} />
                </View>
                <Text style={[styles.formatLabel, format === f.id && { color: theme.primary, fontWeight: '700' }]}>{f.label}</Text>
                <Text style={styles.formatDesc}>{f.desc}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Summary */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.summaryCard}>
          <MaterialIcons name="info-outline" size={16} color={theme.textSecondary} />
          <Text style={styles.summaryText}>{getSummaryText()}</Text>
        </Animated.View>
      </ScrollView>

      {/* Export Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={exporting || (preset === 'tournament' && !selectedTournament) || (preset === 'season' && !selectedSeason)}
        >
          {exporting ? (
            <>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.exportBtnText}>
                {language === 'fr' ? 'Generation en cours...' : 'Generating...'}
              </Text>
            </>
          ) : (
            <>
              <MaterialIcons name="file-download" size={22} color="#FFF" />
              <Text style={styles.exportBtnText}>
                {language === 'fr' ? `Exporter en ${format.toUpperCase()}` : `Export as ${format.toUpperCase()}`}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Tournament Picker Modal */}
      <Modal visible={showTournamentPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTournamentPicker(false)}>
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{language === 'fr' ? 'Choisir un tournoi' : 'Choose a tournament'}</Text>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowTournamentPicker(false)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
          </View>
          <FlatList
            data={tournamentsWithMatches}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
            renderItem={({ item: tr }) => {
              const matchCount = matches.filter(m => m.tournamentId === tr.id).length;
              const isSelected = selectedTournament?.id === tr.id;
              return (
                <Pressable
                  style={[styles.tournamentItem, isSelected && styles.tournamentItemSelected]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedTournament(tr);
                    setShowTournamentPicker(false);
                  }}
                >
                  <View style={[styles.tournamentItemIcon, { backgroundColor: isSelected ? theme.carreauColor : theme.backgroundSecondary }]}>
                    <MaterialIcons name="emoji-events" size={22} color={isSelected ? '#FFF' : theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tournamentItemName}>{tr.name}</Text>
                    <Text style={styles.tournamentItemMeta}>
                      {new Date(tr.date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' \u2022 '}{matchCount} {language === 'fr' ? 'matchs' : 'matches'}
                      {' \u2022 '}{tr.format}
                    </Text>
                  </View>
                  {isSelected ? <MaterialIcons name="check-circle" size={22} color={theme.carreauColor} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <MaterialIcons name="emoji-events" size={40} color={theme.textMuted} />
                <Text style={styles.emptyListText}>{language === 'fr' ? 'Aucun tournoi avec des matchs' : 'No tournaments with matches'}</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // Hero
  heroCard: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.xl, padding: 24, alignItems: 'center', marginBottom: 20, ...theme.shadows.card },
  heroIconBg: { width: 64, height: 64, borderRadius: 18, backgroundColor: theme.primary + '12', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  heroSubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingLeft: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 },

  // Presets
  presetRow: { flexDirection: 'row', gap: 8 },
  presetChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: theme.borderRadius.md, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border, ...theme.shadows.card },
  presetChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  presetContent: { marginTop: 12 },
  presetHint: { fontSize: 11, color: theme.textMuted, fontStyle: 'italic', marginTop: 6, paddingLeft: 4 },

  // Tournament picker button
  tournamentPickerBtn: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', ...theme.shadows.card },
  tournamentSelected: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  tournamentSelectedIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tournamentSelectedName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  tournamentSelectedMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  tournamentPlaceholder: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  tournamentPlaceholderText: { flex: 1, fontSize: 14, color: theme.textMuted },

  // Season grid
  seasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seasonChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.borderRadius.md, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  seasonChipActive: { backgroundColor: theme.success + '10', borderColor: theme.success },
  seasonChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  seasonChipTextActive: { color: theme.success },

  // Comparative
  compareRow: { gap: 10 },
  compareSide: { gap: 6 },
  compareLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5 },
  compareVs: { alignItems: 'center', paddingVertical: 4 },
  compareVsText: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
  comparePeriodChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  comparePeriodText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },

  // Delta preview
  deltaPreview: { backgroundColor: theme.surface, borderRadius: theme.borderRadius.md, padding: 14, marginTop: 12, borderWidth: 1, borderColor: '#6366F1' + '20', ...theme.shadows.card },
  deltaPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  deltaPreviewTitle: { fontSize: 12, fontWeight: '700', color: '#6366F1' },
  deltaGrid: { gap: 8 },
  deltaItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deltaItemLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, width: 70 },
  deltaItemValues: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deltaItemA: { fontSize: 12, fontWeight: '600', color: '#6366F1', width: 36, textAlign: 'right' },
  deltaItemB: { fontSize: 12, fontWeight: '600', color: theme.accent, width: 36, textAlign: 'right' },

  // Data type cards
  optionGrid: { gap: 10 },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 14, borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card },
  optionIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, flex: 1 },
  optionCount: { fontSize: 12, color: theme.textMuted, marginRight: 8 },
  optionCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  // Period chips
  periodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  periodChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  periodChipActive: { backgroundColor: theme.primary + '12', borderColor: theme.primary },
  periodChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  periodChipTextActive: { color: theme.primary },

  // Format cards
  formatRow: { flexDirection: 'row', gap: 12 },
  formatCard: { flex: 1, backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card },
  formatCardActive: { borderColor: theme.primary, backgroundColor: theme.primary + '05' },
  formatIconBg: { width: 52, height: 52, borderRadius: 14, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  formatLabel: { fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginBottom: 4 },
  formatDesc: { fontSize: 11, color: theme.textMuted, textAlign: 'center' },

  // Summary
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.primary + '08', borderRadius: theme.borderRadius.md, padding: 14, borderWidth: 1, borderColor: theme.primary + '15' },
  summaryText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 18 },

  // Footer
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: theme.primary, paddingVertical: 16, borderRadius: theme.borderRadius.lg, ...theme.shadows.cardElevated },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Tournament picker modal
  modalContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  modalCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tournamentItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, padding: 14, borderRadius: theme.borderRadius.md, marginBottom: 8, ...theme.shadows.card },
  tournamentItemSelected: { borderWidth: 2, borderColor: theme.carreauColor },
  tournamentItemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tournamentItemName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  tournamentItemMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  emptyList: { alignItems: 'center', paddingVertical: 48 },
  emptyListText: { fontSize: 14, color: theme.textMuted, marginTop: 12 },
});
