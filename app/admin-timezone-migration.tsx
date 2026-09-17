import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import AdminGuard from '@/components/feature/AdminGuard';
import PageErrorBoundary from '@/components/ui/PageErrorBoundary';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import {
  listTerrainsMissingTimezone,
  batchRefreshTerrainTimezones,
  BatchRefreshOutcome,
  TerrainMissingTz,
} from '@/services/timezoneAutoRefreshService';
import { shortTimezoneLabel } from '@/services/timezoneService';

/**
 * Admin migration tool: list all terrains without a stored timezone and batch
 * fill them using Google Places API (when `google_place_id` exists) with a
 * longitude-based fallback. Displays outcomes per terrain so the admin can
 * verify results before running another batch.
 */
export default function AdminTimezoneMigrationScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { showAlert } = useAlert();
  const isFr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const [terrains, setTerrains] = useState<TerrainMissingTz[]>([]);
  const [totalMissing, setTotalMissing] = useState(0);
  const [withPlaceId, setWithPlaceId] = useState(0);

  const [useLongitudeFallback, setUseLongitudeFallback] = useState(true);
  const [batchLimit, setBatchLimit] = useState(50);

  const [outcomes, setOutcomes] = useState<BatchRefreshOutcome[]>([]);

  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const loadTerrains = useCallback(async () => {
    const { terrains: list, total, withPlaceId: withPid, error } = await listTerrainsMissingTimezone(batchLimit);
    if (error) {
      showAlert(isFr ? 'Erreur' : 'Error', error);
    }
    setTerrains(list);
    setTotalMissing(total);
    setWithPlaceId(withPid);
    setLoading(false);
  }, [batchLimit, isFr, showAlert]);

  useEffect(() => {
    loadTerrains();
  }, [loadTerrains]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTerrains();
    setRefreshing(false);
  };

  const handleRunBatch = async () => {
    if (running) return;
    if (!apiKey && !useLongitudeFallback) {
      showAlert(
        isFr ? 'Cle API manquante' : 'Missing API key',
        isFr
          ? 'Aucune cle Google Maps configuree. Activez au moins le fallback longitude pour continuer.'
          : 'No Google Maps API key configured. Enable at least the longitude fallback to continue.'
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning(true);
    setProgress({ current: 0, total: terrains.length });
    setOutcomes([]);

    const { outcomes: result, updated } = await batchRefreshTerrainTimezones({
      terrains,
      apiKey: apiKey || null,
      language,
      useLongitudeFallback,
      onProgress: (index, total) => {
        setProgress({ current: index + 1, total });
      },
    });

    setOutcomes(result);
    setProgress(null);
    setRunning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(
      isFr ? 'Batch termine' : 'Batch complete',
      isFr
        ? `${updated}/${result.length} terrain(s) mis a jour.`
        : `${updated}/${result.length} terrain(s) updated.`
    );
    // Refresh remaining list
    await loadTerrains();
  };

  const successCount = outcomes.filter(o => o.status === 'updated_google' || o.status === 'updated_longitude').length;
  const skippedCount = outcomes.filter(o => o.status === 'skipped').length;
  const errorCount = outcomes.filter(o => o.status === 'error').length;

  return (
    <PageErrorBoundary pageName="TimezoneMigration">
      <AdminGuard language={language}>
        <SafeAreaView edges={['top']} style={st.container}>
          <View style={st.header}>
            <Pressable style={st.backBtn} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={st.headerTitle}>{isFr ? 'Migration fuseaux horaires' : 'Timezone migration'}</Text>
              <Text style={st.headerSub}>{isFr ? 'Batch fill via Google Places' : 'Batch fill via Google Places'}</Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
          >
            {loading ? (
              <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : (
              <>
                {/* Stats summary */}
                <View style={st.section}>
                  <View style={st.sectionHeader}>
                    <View style={[st.sectionIcon, { backgroundColor: '#7C3AED15' }]}>
                      <MaterialIcons name="public" size={18} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.sectionTitle}>{isFr ? 'Vue d\'ensemble' : 'Overview'}</Text>
                      <Text style={st.sectionSub}>{isFr ? 'Terrains sans fuseau horaire' : 'Terrains without timezone'}</Text>
                    </View>
                  </View>
                  <View style={st.statsRow}>
                    <View style={st.statCard}>
                      <Text style={[st.statValue, { color: '#7C3AED' }]}>{totalMissing}</Text>
                      <Text style={st.statLabel}>{isFr ? 'Total' : 'Total'}</Text>
                    </View>
                    <View style={st.statCard}>
                      <Text style={[st.statValue, { color: '#3B82F6' }]}>{withPlaceId}</Text>
                      <Text style={st.statLabel}>{isFr ? 'Place ID' : 'With Place ID'}</Text>
                    </View>
                    <View style={st.statCard}>
                      <Text style={[st.statValue, { color: '#F59E0B' }]}>{Math.max(0, totalMissing - withPlaceId)}</Text>
                      <Text style={st.statLabel}>{isFr ? 'Longitude only' : 'Longitude only'}</Text>
                    </View>
                  </View>
                </View>

                {/* Config */}
                <View style={st.section}>
                  <View style={st.sectionHeader}>
                    <View style={[st.sectionIcon, { backgroundColor: '#3B82F615' }]}>
                      <MaterialIcons name="settings" size={18} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.sectionTitle}>{isFr ? 'Configuration' : 'Configuration'}</Text>
                    </View>
                  </View>

                  <View style={st.configRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.configLabel}>{isFr ? 'Fallback longitude' : 'Longitude fallback'}</Text>
                      <Text style={st.configHint}>
                        {isFr
                          ? 'Utilise la longitude pour estimer UTC±H quand Google echoue'
                          : 'Use longitude to estimate UTC±H when Google fails'}
                      </Text>
                    </View>
                    <Switch
                      value={useLongitudeFallback}
                      onValueChange={setUseLongitudeFallback}
                      trackColor={{ false: theme.border, true: '#F59E0B60' }}
                      thumbColor={useLongitudeFallback ? '#F59E0B' : theme.textMuted}
                    />
                  </View>

                  <View style={st.configRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.configLabel}>{isFr ? 'Taille du batch' : 'Batch size'}</Text>
                      <Text style={st.configHint}>
                        {isFr
                          ? `Traite jusqu'a ${batchLimit} terrains par execution`
                          : `Process up to ${batchLimit} terrains per run`}
                      </Text>
                    </View>
                    <View style={st.batchLimitRow}>
                      {[25, 50, 100].map(n => (
                        <Pressable
                          key={n}
                          style={[st.batchLimitChip, batchLimit === n && st.batchLimitChipActive]}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setBatchLimit(n);
                            setLoading(true);
                          }}
                        >
                          <Text style={[st.batchLimitChipText, batchLimit === n && st.batchLimitChipTextActive]}>{n}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {!apiKey ? (
                    <View style={st.warnBox}>
                      <MaterialIcons name="warning" size={14} color="#F59E0B" />
                      <Text style={st.warnText}>
                        {isFr
                          ? 'Cle Google Maps absente : seul le fallback longitude sera utilise.'
                          : 'Google Maps API key missing: only longitude fallback will run.'}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    style={[st.runBtn, (running || terrains.length === 0) && { opacity: 0.5 }]}
                    onPress={handleRunBatch}
                    disabled={running || terrains.length === 0}
                  >
                    {running ? (
                      <>
                        <ActivityIndicator size="small" color="#FFF" />
                        <Text style={st.runBtnText}>
                          {progress ? `${progress.current}/${progress.total}` : (isFr ? 'En cours...' : 'Running...')}
                        </Text>
                      </>
                    ) : (
                      <>
                        <MaterialIcons name="auto-fix-high" size={18} color="#FFF" />
                        <Text style={st.runBtnText}>
                          {isFr ? `Lancer le batch (${terrains.length})` : `Run batch (${terrains.length})`}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {/* Outcomes summary after run */}
                {outcomes.length > 0 ? (
                  <View style={st.section}>
                    <View style={st.sectionHeader}>
                      <View style={[st.sectionIcon, { backgroundColor: '#22C55E15' }]}>
                        <MaterialIcons name="assignment-turned-in" size={18} color="#22C55E" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.sectionTitle}>{isFr ? 'Resultats' : 'Results'}</Text>
                        <Text style={st.sectionSub}>{outcomes.length} {isFr ? 'terrains traites' : 'terrains processed'}</Text>
                      </View>
                    </View>
                    <View style={st.outcomeSummary}>
                      <View style={[st.outcomeChip, { backgroundColor: '#22C55E12' }]}>
                        <MaterialIcons name="check-circle" size={12} color="#16A34A" />
                        <Text style={[st.outcomeChipText, { color: '#16A34A' }]}>{successCount} {isFr ? 'reussis' : 'success'}</Text>
                      </View>
                      <View style={[st.outcomeChip, { backgroundColor: '#F59E0B12' }]}>
                        <MaterialIcons name="skip-next" size={12} color="#D97706" />
                        <Text style={[st.outcomeChipText, { color: '#D97706' }]}>{skippedCount} {isFr ? 'ignores' : 'skipped'}</Text>
                      </View>
                      {errorCount > 0 ? (
                        <View style={[st.outcomeChip, { backgroundColor: '#EF444412' }]}>
                          <MaterialIcons name="error-outline" size={12} color="#DC2626" />
                          <Text style={[st.outcomeChipText, { color: '#DC2626' }]}>{errorCount} {isFr ? 'erreurs' : 'errors'}</Text>
                        </View>
                      ) : null}
                    </View>
                    {outcomes.slice(0, 30).map(o => {
                      const cfg = o.status === 'updated_google'
                        ? { icon: 'auto-awesome', color: '#3B82F6', label: isFr ? 'Google Places' : 'Google Places' }
                        : o.status === 'updated_longitude'
                          ? { icon: 'my-location', color: '#F59E0B', label: isFr ? 'Longitude' : 'Longitude' }
                          : o.status === 'skipped'
                            ? { icon: 'block', color: '#94A3B8', label: isFr ? 'Ignore' : 'Skipped' }
                            : { icon: 'error-outline', color: '#EF4444', label: 'Error' };
                      return (
                        <View key={o.terrainId} style={st.outcomeRow}>
                          <View style={[st.outcomeIcon, { backgroundColor: cfg.color + '15' }]}>
                            <MaterialIcons name={cfg.icon as any} size={13} color={cfg.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.outcomeName} numberOfLines={1}>{o.terrainName}</Text>
                            <Text style={st.outcomeMeta}>
                              {cfg.label}
                              {o.timezone ? ` • ${o.timezone} (${shortTimezoneLabel(o.timezone)})` : ''}
                              {o.error ? ` • ${o.error}` : ''}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                    {outcomes.length > 30 ? (
                      <Text style={st.moreText}>
                        {isFr ? `+ ${outcomes.length - 30} autres...` : `+ ${outcomes.length - 30} more...`}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Missing terrains preview */}
                <View style={st.section}>
                  <View style={st.sectionHeader}>
                    <View style={[st.sectionIcon, { backgroundColor: '#F59E0B15' }]}>
                      <MaterialIcons name="list" size={18} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.sectionTitle}>{isFr ? 'File d\'attente' : 'Queue'}</Text>
                      <Text style={st.sectionSub}>
                        {isFr ? `${terrains.length} terrains a traiter` : `${terrains.length} terrains to process`}
                      </Text>
                    </View>
                  </View>
                  {terrains.length === 0 ? (
                    <View style={st.empty}>
                      <MaterialIcons name="check-circle" size={28} color="#22C55E" />
                      <Text style={st.emptyText}>
                        {isFr ? 'Tous les terrains ont un fuseau horaire !' : 'All terrains have a timezone!'}
                      </Text>
                    </View>
                  ) : (
                    terrains.slice(0, 20).map(t => {
                      const canGoogle = !!t.googlePlaceId && !!apiKey;
                      const canLongitude = typeof t.longitude === 'number' && Number.isFinite(t.longitude);
                      return (
                        <View key={t.id} style={st.queueRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={st.queueName} numberOfLines={1}>{t.name}</Text>
                            <Text style={st.queueMeta} numberOfLines={1}>
                              {t.city}
                              {typeof t.longitude === 'number' ? ` • lon ${t.longitude.toFixed(2)}` : ''}
                            </Text>
                          </View>
                          {canGoogle ? (
                            <View style={[st.queueBadge, { backgroundColor: '#3B82F615' }]}>
                              <MaterialIcons name="auto-awesome" size={10} color="#3B82F6" />
                              <Text style={[st.queueBadgeText, { color: '#3B82F6' }]}>Google</Text>
                            </View>
                          ) : canLongitude ? (
                            <View style={[st.queueBadge, { backgroundColor: '#F59E0B15' }]}>
                              <MaterialIcons name="my-location" size={10} color="#F59E0B" />
                              <Text style={[st.queueBadgeText, { color: '#F59E0B' }]}>Long.</Text>
                            </View>
                          ) : (
                            <View style={[st.queueBadge, { backgroundColor: '#94A3B815' }]}>
                              <MaterialIcons name="help-outline" size={10} color="#64748B" />
                              <Text style={[st.queueBadgeText, { color: '#64748B' }]}>{isFr ? 'Aucun' : 'None'}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                  {terrains.length > 20 ? (
                    <Text style={st.moreText}>
                      {isFr ? `+ ${terrains.length - 20} autres dans ce batch` : `+ ${terrains.length - 20} more in this batch`}
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </AdminGuard>
    </PageErrorBoundary>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  headerSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },

  section: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 12, ...theme.shadows.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  sectionSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },

  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 12, paddingVertical: 14 },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', color: theme.textMuted, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.4 },

  configRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  configLabel: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  configHint: { fontSize: 11, color: theme.textMuted, marginTop: 2, lineHeight: 15 },
  batchLimitRow: { flexDirection: 'row', gap: 4 },
  batchLimitChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  batchLimitChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  batchLimitChipText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  batchLimitChipTextActive: { color: '#FFF' },

  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F59E0B10', borderRadius: 8, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#F59E0B25' },
  warnText: { flex: 1, fontSize: 11, color: '#92400E', fontWeight: '600', lineHeight: 15 },

  runBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 14, borderRadius: 12, marginTop: 14 },
  runBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  outcomeSummary: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  outcomeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  outcomeChipText: { fontSize: 11, fontWeight: '700' },
  outcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
  outcomeIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  outcomeName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  outcomeMeta: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  moreText: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },

  queueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
  queueName: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  queueMeta: { fontSize: 10, color: theme.textMuted, marginTop: 1 },
  queueBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  queueBadgeText: { fontSize: 10, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: '#22C55E', fontWeight: '700', textAlign: 'center' },
});
