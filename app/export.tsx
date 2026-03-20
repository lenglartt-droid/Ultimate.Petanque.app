import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert } from '@/template';
import { exportData, ExportFormat, ExportDataType, ExportPeriod } from '@/services/exportService';

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

  const getDataTypeLabel = (id: ExportDataType) => {
    switch (id) {
      case 'matches': return language === 'fr' ? 'Matchs' : 'Matches';
      case 'challenges': return language === 'fr' ? 'Défis' : 'Challenges';
      case 'statistics': return language === 'fr' ? 'Statistiques' : 'Statistics';
    }
  };

  const getDataTypeCount = (id: ExportDataType) => {
    switch (id) {
      case 'matches': return matches.length;
      case 'challenges': return challenges.length;
      case 'statistics': return `${matches.length} matchs + ${challenges.length} ${language === 'fr' ? 'défis' : 'challenges'}`;
    }
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
        language === 'fr' ? 'Export réussi' : 'Export successful',
        language === 'fr' ? 'Fichier généré et partagé' : 'File generated and shared',
      );
    } else {
      showAlert(
        language === 'fr' ? 'Erreur' : 'Error',
        result.error || (language === 'fr' ? 'Erreur lors de l\'export' : 'Export error'),
      );
    }
  }, [format, dataType, period, language, user, matches, challenges, tournaments, userStats, showAlert]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{language === 'fr' ? 'Exporter mes données' : 'Export my data'}</Text>
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
          <Text style={styles.heroTitle}>{language === 'fr' ? 'Exportez vos données' : 'Export your data'}</Text>
          <Text style={styles.heroSubtitle}>
            {language === 'fr'
              ? 'Générez un fichier CSV ou PDF de vos matchs, défis ou statistiques'
              : 'Generate a CSV or PDF file of your matches, challenges or statistics'}
          </Text>
        </Animated.View>

        {/* Data Type */}
        <Animated.View entering={FadeInDown.duration(400).delay(50)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="dataset" size={16} color={theme.textSecondary} />
            <Text style={styles.sectionTitle}>{language === 'fr' ? 'DONNÉES À EXPORTER' : 'DATA TO EXPORT'}</Text>
          </View>
          <View style={styles.optionGrid}>
            {dataTypes.map(dt => (
              <Pressable
                key={dt.id}
                style={[styles.optionCard, dataType === dt.id && { borderColor: dt.color, backgroundColor: dt.color + '08' }]}
                onPress={() => { Haptics.selectionAsync(); setDataType(dt.id); }}
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
            ))}
          </View>
        </Animated.View>

        {/* Period */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="date-range" size={16} color={theme.textSecondary} />
            <Text style={styles.sectionTitle}>{language === 'fr' ? 'PÉRIODE' : 'PERIOD'}</Text>
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

        {/* Format */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="description" size={16} color={theme.textSecondary} />
            <Text style={styles.sectionTitle}>{language === 'fr' ? 'FORMAT' : 'FORMAT'}</Text>
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
          <Text style={styles.summaryText}>
            {language === 'fr'
              ? `Export ${format.toUpperCase()} des ${getDataTypeLabel(dataType)?.toLowerCase()} — ${periods.find(p => p.id === period)?.labelFr}`
              : `${format.toUpperCase()} export of ${getDataTypeLabel(dataType)?.toLowerCase()} — ${periods.find(p => p.id === period)?.labelEn}`}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Export Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={styles.exportBtnText}>
                {language === 'fr' ? 'Génération en cours...' : 'Generating...'}
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
});
