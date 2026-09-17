import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import AdminGuard from '@/components/feature/AdminGuard';
import PageErrorBoundary from '@/components/ui/PageErrorBoundary';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { updateSuspiciousStatus, updateTrustScore } from '@/services/trustScoreService';

interface AutoBanLog {
  id: string;
  playerId: string;
  playerName: string;
  createdAt: string;
  clusterSize: number;
  prefix: string;
  domain: string;
  preAutoBanScore: number;
  previousStatus: string;
  spanHours: number;
  siblings: string[];
}

/**
 * Dedicated admin page for managing the email-farm auto-ban system:
 * - Configure thresholds (cluster size + hour window) stored in app_config
 * - View and undo recent auto-bans (past 24h)
 */
export default function AdminAntiCheatConfigScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const isFr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Config state
  const [config, setConfig] = useState<{ minCluster: number; maxHours: number; enabled: boolean }>({ minCluster: 5, maxHours: 6, enabled: true });
  const [draft, setDraft] = useState<{ minCluster: string; maxHours: string; enabled: boolean }>({ minCluster: '5', maxHours: '6', enabled: true });
  const [saving, setSaving] = useState(false);

  // Auto-ban logs (past 24h)
  const [autoBanLogs, setAutoBanLogs] = useState<AutoBanLog[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const supabase = getSupabaseClient();
    try {
      // Config
      const { data: cfgData } = await supabase
        .from('app_config')
        .select('email_farm_auto_ban_min_cluster, email_farm_auto_ban_max_hours, email_farm_auto_ban_enabled')
        .eq('id', 'main')
        .single();
      if (cfgData) {
        const cfg = {
          minCluster: cfgData.email_farm_auto_ban_min_cluster ?? 5,
          maxHours: cfgData.email_farm_auto_ban_max_hours ?? 6,
          enabled: cfgData.email_farm_auto_ban_enabled !== false,
        };
        setConfig(cfg);
        setDraft({ minCluster: String(cfg.minCluster), maxHours: String(cfg.maxHours), enabled: cfg.enabled });
      }

      // Logs (past 24h)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: logs } = await supabase
        .from('admin_activity_logs')
        .select('id, target_id, target_name, created_at, metadata')
        .eq('action_type', 'auto_ban_email_farm')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(30);
      setAutoBanLogs((logs || []).map((l: any) => ({
        id: l.id,
        playerId: l.target_id,
        playerName: l.target_name || 'Unknown',
        createdAt: l.created_at,
        clusterSize: l.metadata?.clusterSize || 0,
        prefix: l.metadata?.prefix || '',
        domain: l.metadata?.domain || '',
        preAutoBanScore: l.metadata?.preAutoBanScore ?? 30,
        previousStatus: l.metadata?.previousStatus || 'watch',
        spanHours: l.metadata?.spanHours || 0,
        siblings: Array.isArray(l.metadata?.siblings) ? l.metadata.siblings : [],
      })));
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleSaveConfig = async () => {
    const minCluster = parseInt(draft.minCluster, 10);
    const maxHours = parseInt(draft.maxHours, 10);
    if (isNaN(minCluster) || minCluster < 2 || minCluster > 20) {
      showAlert(isFr ? 'Taille cluster invalide' : 'Invalid cluster size', isFr ? 'Choisissez entre 2 et 20 comptes' : 'Choose between 2 and 20 accounts');
      return;
    }
    if (isNaN(maxHours) || maxHours < 1 || maxHours > 72) {
      showAlert(isFr ? 'Fenetre horaire invalide' : 'Invalid time window', isFr ? 'Choisissez entre 1 et 72 heures' : 'Choose between 1 and 72 hours');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('app_config')
        .update({
          email_farm_auto_ban_min_cluster: minCluster,
          email_farm_auto_ban_max_hours: maxHours,
          email_farm_auto_ban_enabled: draft.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'main');
      if (error) {
        showAlert('Error', error.message);
      } else {
        setConfig({ minCluster, maxHours, enabled: draft.enabled });
        await supabase.from('admin_activity_logs').insert({
          admin_user_id: user?.id,
          admin_name: (user as any)?.username || user?.email || 'Admin',
          action_type: 'update_auto_ban_config',
          action_detail: `Email farm auto-ban: cluster>=${minCluster}, span<${maxHours}h, enabled=${draft.enabled}`,
          target_type: 'app_config',
          metadata: { minCluster, maxHours, enabled: draft.enabled },
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert(isFr ? 'Configuration sauvegardee' : 'Configuration saved');
      }
    } catch (e: any) {
      showAlert('Error', e.message);
    }
    setSaving(false);
  };

  const handleUndoAutoBan = async (log: AutoBanLog) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUndoingId(log.id);
    try {
      const supabase = getSupabaseClient();
      const restoredScore = Math.max(15, log.preAutoBanScore - 5);
      const restoredStatus = log.previousStatus || 'watch';

      // Find the suspicious_players entry (by player_id) then update
      const { data: susData } = await supabase
        .from('suspicious_players')
        .select('id')
        .eq('player_id', log.playerId)
        .single();
      if (susData?.id) {
        const { error: sErr } = await updateSuspiciousStatus(susData.id, restoredStatus);
        const { error: tErr } = await updateTrustScore(susData.id, restoredScore);
        if (sErr || tErr) {
          showAlert('Error', sErr || tErr || 'Unknown error');
          setUndoingId(null);
          return;
        }
      } else {
        const { error } = await supabase
          .from('suspicious_players')
          .update({ trust_score: restoredScore, status: restoredStatus, updated_at: new Date().toISOString() })
          .eq('player_id', log.playerId);
        if (error) {
          showAlert('Error', error.message);
          setUndoingId(null);
          return;
        }
      }

      await supabase.from('admin_activity_logs').insert({
        admin_user_id: user?.id,
        admin_name: (user as any)?.username || user?.email || 'Admin',
        action_type: 'undo_auto_ban_email_farm',
        action_detail: `Restored ${log.playerName} to score ${restoredScore}, status ${restoredStatus}`,
        target_type: 'players',
        target_id: log.playerId,
        target_name: log.playerName,
        metadata: {
          originalLogId: log.id,
          clusterSize: log.clusterSize,
          prefix: log.prefix,
          domain: log.domain,
          restoredScore,
          restoredStatus,
          preAutoBanScore: log.preAutoBanScore,
        },
      });

      setAutoBanLogs(prev => prev.filter(l => l.id !== log.id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(
        isFr ? 'Auto-ban annule' : 'Auto-ban undone',
        isFr ? `Score restaure a ${restoredScore}, statut ${restoredStatus}` : `Score restored to ${restoredScore}, status ${restoredStatus}`
      );
    } catch (e: any) {
      showAlert('Error', e.message);
    }
    setUndoingId(null);
  };

  const isDirty =
    parseInt(draft.minCluster, 10) !== config.minCluster ||
    parseInt(draft.maxHours, 10) !== config.maxHours ||
    draft.enabled !== config.enabled;

  return (
    <PageErrorBoundary pageName="AntiCheatConfig">
      <AdminGuard language={language}>
        <SafeAreaView edges={['top']} style={st.container}>
          <View style={st.header}>
            <Pressable style={st.backBtn} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={st.headerTitle}>{isFr ? 'Auto-ban email farm' : 'Email farm auto-ban'}</Text>
              <Text style={st.headerSub}>{isFr ? 'Configuration & annulation' : 'Configuration & undo'}</Text>
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
                <ActivityIndicator size="large" color="#991B1B" />
              </View>
            ) : (
              <>
                {/* Configuration section */}
                <View style={st.section}>
                  <View style={st.sectionHeader}>
                    <View style={[st.sectionIcon, { backgroundColor: '#991B1B15' }]}>
                      <MaterialIcons name="tune" size={18} color="#991B1B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.sectionTitle}>{isFr ? 'Configuration' : 'Configuration'}</Text>
                      <Text style={st.sectionSub}>{isFr ? 'Seuils d\'auto-ban' : 'Auto-ban thresholds'}</Text>
                    </View>
                    <View style={[st.statusPill, config.enabled ? { backgroundColor: '#22C55E15' } : { backgroundColor: '#94A3B815' }]}>
                      <View style={[st.statusDot, { backgroundColor: config.enabled ? '#22C55E' : '#94A3B8' }]} />
                      <Text style={[st.statusText, { color: config.enabled ? '#16A34A' : '#64748B' }]}>
                        {config.enabled ? (isFr ? 'Actif' : 'Active') : (isFr ? 'Off' : 'Off')}
                      </Text>
                    </View>
                  </View>

                  <View style={st.fieldsRow}>
                    <View style={st.field}>
                      <Text style={st.fieldLabel}>{isFr ? 'Taille cluster min' : 'Min cluster size'}</Text>
                      <TextInput
                        style={st.fieldInput}
                        value={draft.minCluster}
                        onChangeText={txt => setDraft(prev => ({ ...prev, minCluster: txt.replace(/[^0-9]/g, '') }))}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="5"
                        placeholderTextColor={theme.textMuted}
                      />
                      <Text style={st.fieldHint}>{isFr ? 'Comptes (2-20)' : 'Accounts (2-20)'}</Text>
                    </View>
                    <View style={st.field}>
                      <Text style={st.fieldLabel}>{isFr ? 'Fenetre max' : 'Max window'}</Text>
                      <TextInput
                        style={st.fieldInput}
                        value={draft.maxHours}
                        onChangeText={txt => setDraft(prev => ({ ...prev, maxHours: txt.replace(/[^0-9]/g, '') }))}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="6"
                        placeholderTextColor={theme.textMuted}
                      />
                      <Text style={st.fieldHint}>{isFr ? 'Heures (1-72)' : 'Hours (1-72)'}</Text>
                    </View>
                  </View>

                  <Pressable
                    style={[st.toggle, draft.enabled && { backgroundColor: '#22C55E15', borderColor: '#22C55E40' }]}
                    onPress={() => { Haptics.selectionAsync(); setDraft(prev => ({ ...prev, enabled: !prev.enabled })); }}
                  >
                    <View style={[st.toggleSwitch, draft.enabled && { backgroundColor: '#22C55E' }]}>
                      <View style={[st.toggleDot, draft.enabled && { transform: [{ translateX: 16 }] }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[st.toggleLabel, draft.enabled && { color: '#16A34A' }]}>
                        {isFr ? 'Auto-ban activé' : 'Auto-ban enabled'}
                      </Text>
                      <Text style={st.toggleHint}>
                        {draft.enabled
                          ? (isFr ? 'Bannit automatiquement quand seuils dépassés' : 'Bans automatically when thresholds exceeded')
                          : (isFr ? 'Aucun ban automatique appliqué' : 'No automatic bans applied')}
                      </Text>
                    </View>
                  </Pressable>

                  <View style={st.infoBox}>
                    <MaterialIcons name="info-outline" size={14} color="#3B82F6" />
                    <Text style={st.infoText}>
                      {isFr
                        ? `Auto-ban actuel : cluster de ${config.minCluster}+ comptes créés en moins de ${config.maxHours} heures avec le même préfixe sur un même domaine.`
                        : `Current auto-ban: cluster of ${config.minCluster}+ accounts created within ${config.maxHours} hours sharing the same prefix on one domain.`}
                    </Text>
                  </View>

                  <Pressable
                    style={[st.saveBtn, (!isDirty || saving) && { opacity: 0.5 }]}
                    onPress={handleSaveConfig}
                    disabled={!isDirty || saving}
                  >
                    {saving ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="save" size={16} color="#FFF" />}
                    <Text style={st.saveBtnText}>
                      {saving ? (isFr ? 'Enregistrement...' : 'Saving...') : (isFr ? 'Enregistrer' : 'Save')}
                    </Text>
                  </Pressable>
                </View>

                {/* Recent auto-bans (24h) */}
                <View style={st.section}>
                  <View style={st.sectionHeader}>
                    <View style={[st.sectionIcon, { backgroundColor: '#991B1B15' }]}>
                      <MaterialIcons name="history" size={18} color="#991B1B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.sectionTitle}>{isFr ? 'Auto-bans récents (24h)' : 'Recent auto-bans (24h)'}</Text>
                      <Text style={st.sectionSub}>{isFr ? 'Annulables individuellement' : 'Individually reversible'}</Text>
                    </View>
                    <View style={st.countBadge}>
                      <Text style={st.countBadgeText}>{autoBanLogs.length}</Text>
                    </View>
                  </View>

                  {autoBanLogs.length === 0 ? (
                    <View style={st.empty}>
                      <MaterialIcons name="check-circle" size={28} color="#22C55E" />
                      <Text style={st.emptyText}>{isFr ? 'Aucun auto-ban dans les 24 dernières heures' : 'No auto-bans in the last 24 hours'}</Text>
                    </View>
                  ) : (
                    autoBanLogs.map(log => {
                      const ageMin = Math.floor((Date.now() - new Date(log.createdAt).getTime()) / 60000);
                      const remH = Math.max(0, 24 - Math.floor(ageMin / 60));
                      const timeLabel = ageMin < 60 ? `${ageMin}m` : `${Math.floor(ageMin / 60)}h`;
                      return (
                        <View key={log.id} style={st.logCard}>
                          <View style={st.logHeader}>
                            <View style={{ flex: 1 }}>
                              <Pressable onPress={() => router.push(`/player/${log.playerId}` as any)}>
                                <Text style={st.logPlayer} numberOfLines={1}>{log.playerName}</Text>
                              </Pressable>
                              <Text style={st.logMeta} numberOfLines={1}>
                                {log.prefix}@{log.domain}
                              </Text>
                            </View>
                            <View style={st.logTimeBadge}>
                              <MaterialIcons name="schedule" size={10} color="#991B1B" />
                              <Text style={st.logTimeText}>{timeLabel}</Text>
                            </View>
                          </View>

                          <View style={st.logStatsRow}>
                            <View style={st.logStat}>
                              <Text style={st.logStatValue}>{log.clusterSize}</Text>
                              <Text style={st.logStatLabel}>{isFr ? 'Comptes' : 'Accts'}</Text>
                            </View>
                            <View style={st.logStat}>
                              <Text style={st.logStatValue}>{log.spanHours}h</Text>
                              <Text style={st.logStatLabel}>{isFr ? 'Fenêtre' : 'Span'}</Text>
                            </View>
                            <View style={st.logStat}>
                              <Text style={[st.logStatValue, { color: '#991B1B' }]}>{log.preAutoBanScore}</Text>
                              <Text style={st.logStatLabel}>{isFr ? 'Pré-ban' : 'Pre-ban'}</Text>
                            </View>
                          </View>

                          <View style={st.logFooter}>
                            <Text style={st.logWindowText}>
                              {isFr ? `Restaurable ${remH}h` : `Undoable ${remH}h`}
                            </Text>
                            <Pressable
                              style={[st.undoBtn, undoingId === log.id && { opacity: 0.6 }]}
                              onPress={() => handleUndoAutoBan(log)}
                              disabled={undoingId === log.id}
                            >
                              {undoingId === log.id ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="undo" size={14} color="#FFF" />}
                              <Text style={st.undoBtnText}>{isFr ? 'Annuler' : 'Undo'}</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })
                  )}
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
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800' },
  countBadge: { backgroundColor: '#991B1B', borderRadius: 10, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countBadgeText: { fontSize: 12, fontWeight: '800', color: '#FFF' },

  fieldsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: theme.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },
  fieldInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 10, padding: 12, fontSize: 22, fontWeight: '900', color: theme.textPrimary, textAlign: 'center', borderWidth: 1.5, borderColor: theme.border },
  fieldHint: { fontSize: 10, color: theme.textMuted, fontWeight: '500', textAlign: 'center' },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: theme.backgroundSecondary, borderRadius: 10, borderWidth: 1.5, borderColor: theme.border, marginBottom: 12 },
  toggleSwitch: { width: 36, height: 20, borderRadius: 10, backgroundColor: theme.border, padding: 2, justifyContent: 'center' },
  toggleDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  toggleHint: { fontSize: 10, color: theme.textMuted, marginTop: 2, fontWeight: '500', lineHeight: 14 },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#3B82F608', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#3B82F620' },
  infoText: { flex: 1, fontSize: 10, color: '#3B82F6', lineHeight: 14, fontWeight: '600' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#991B1B', paddingVertical: 12, borderRadius: 12 },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: '#22C55E', fontWeight: '700', textAlign: 'center' },

  logCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#991B1B' },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  logPlayer: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  logMeta: { fontSize: 10, color: theme.textMuted, marginTop: 2, fontWeight: '500' },
  logTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#991B1B15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  logTimeText: { fontSize: 9, fontWeight: '800', color: '#991B1B' },

  logStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  logStat: { flex: 1, alignItems: 'center', backgroundColor: theme.surface, borderRadius: 8, paddingVertical: 8 },
  logStatValue: { fontSize: 15, fontWeight: '900', color: theme.textPrimary },
  logStatLabel: { fontSize: 8, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 2 },

  logFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logWindowText: { flex: 1, fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#991B1B', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  undoBtnText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
});
