import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import theme from '@/constants/theme';
import * as Haptics from '@/services/haptics';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import PageErrorBoundary from '@/components/ui/PageErrorBoundary';
import { getImpersonationAlertsForUser, ImpersonationAlert } from '@/services/impersonationService';
import { submitReport } from '@/services/reportService';

export default function ImpersonationAlertsScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { showAlert } = useAlert();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<ImpersonationAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<ImpersonationAlert | null>(null);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    const { alerts: list, error } = await getImpersonationAlertsForUser();
    if (error) showAlert(fr ? 'Erreur' : 'Error', error);
    setAlerts(list);
    setLoading(false);
    setRefreshing(false);
  }, [fr, showAlert]);

  useEffect(() => { load(); }, [load]);

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.localPlayerId));

  const handleView = (a: ImpersonationAlert) => {
    Haptics.selectionAsync();
    router.push(`/player/${a.localPlayerId}` as any);
  };

  const handleDismiss = (a: ImpersonationAlert) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissedIds(prev => new Set([...prev, a.localPlayerId]));
  };

  const submitReport_ = async () => {
    if (!reportTarget) return;
    setReporting(true);
    const { error } = await submitReport({
      reportedPlayerId: reportTarget.localPlayerId,
      reportedUserId: reportTarget.creatorUserId,
      reason: 'multiple_accounts',
      details: fr
        ? `Usurpation d'identite suspectee : le joueur local "${reportTarget.localPlayerName}" reprend le nom de mon profil public.`
        : `Suspected impersonation: local player "${reportTarget.localPlayerName}" uses the name of my public profile.`,
    });
    setReporting(false);
    if (error) {
      if (error === 'already_reported') {
        showAlert(fr ? 'Deja signale' : 'Already reported', fr ? 'Vous avez deja signale ce joueur.' : 'You already reported this player.');
      } else {
        showAlert(fr ? 'Erreur' : 'Error', error);
      }
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDismissedIds(prev => new Set([...prev, reportTarget.localPlayerId]));
    setReportTarget(null);
    showAlert(fr ? 'Signalement envoye' : 'Report submitted', fr ? 'Notre equipe examinera ce cas sous 24-48h.' : 'Our team will review within 24-48h.');
  };

  return (
    <PageErrorBoundary pageName="ImpersonationAlerts">
      <SafeAreaView edges={['top']} style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{fr ? 'Alertes d\'usurpation' : 'Impersonation alerts'}</Text>
            <Text style={s.headerSub}>{fr ? 'Joueurs locaux au meme nom que votre profil' : 'Local players with the same name as your profile'}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
        >
          {loading ? (
            <View style={s.loadingBox}><ActivityIndicator size="large" color={theme.primary} /></View>
          ) : visibleAlerts.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(300)} style={s.emptyBox}>
              <MaterialIcons name="verified-user" size={56} color={theme.success} />
              <Text style={s.emptyTitle}>{fr ? 'Aucune alerte' : 'No alerts'}</Text>
              <Text style={s.emptyText}>
                {fr
                  ? 'Personne n\'utilise votre nom de profil actuellement.'
                  : 'No one is currently using your profile name.'}
              </Text>
            </Animated.View>
          ) : (
            <>
              <View style={s.infoBanner}>
                <MaterialIcons name="warning-amber" size={16} color="#B45309" />
                <Text style={s.infoText}>
                  {fr
                    ? `${visibleAlerts.length} entree(s) locale(s) portant votre nom. Verifiez qu'il ne s'agit pas d'usurpation d'identite.`
                    : `${visibleAlerts.length} local entry(ies) using your name. Verify they are not impersonating you.`}
                </Text>
              </View>

              {visibleAlerts.map((a, idx) => (
                <Animated.View key={a.localPlayerId} entering={FadeInDown.duration(300).delay(idx * 40)} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={[s.avatar, { backgroundColor: '#D9770615' }]}>
                      <MaterialIcons name="warning" size={20} color="#B45309" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.playerName}>{a.localPlayerName}</Text>
                      <Text style={s.metaText}>
                        {fr ? 'Cree par ' : 'Created by '}
                        <Text style={s.metaEmphasis}>{a.creatorName}</Text>
                        {' • '}
                        {new Date(a.createdAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>

                  <View style={s.matchIndicator}>
                    <MaterialIcons name="compare-arrows" size={14} color={theme.textMuted} />
                    <Text style={s.matchIndicatorText}>
                      {fr ? 'Correspond a votre profil ' : 'Matches your profile '}
                      <Text style={s.matchIndicatorBold}>{a.originalPlayerName}</Text>
                    </Text>
                  </View>

                  <View style={s.actionsRow}>
                    <Pressable style={[s.actionBtn, s.viewBtn]} onPress={() => handleView(a)}>
                      <MaterialIcons name="visibility" size={16} color={theme.primary} />
                      <Text style={[s.actionBtnText, { color: theme.primary }]}>{fr ? 'Voir' : 'View'}</Text>
                    </Pressable>
                    <Pressable style={[s.actionBtn, s.reportBtn]} onPress={() => setReportTarget(a)}>
                      <MaterialIcons name="flag" size={16} color="#B45309" />
                      <Text style={[s.actionBtnText, { color: '#B45309' }]}>{fr ? 'Signaler' : 'Report'}</Text>
                    </Pressable>
                    <Pressable style={[s.actionBtn, s.dismissBtn]} onPress={() => handleDismiss(a)}>
                      <MaterialIcons name="check" size={16} color={theme.textSecondary} />
                      <Text style={[s.actionBtnText, { color: theme.textSecondary }]}>{fr ? 'Ignorer' : 'Dismiss'}</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ))}
            </>
          )}
        </ScrollView>

        <Modal visible={!!reportTarget} transparent animationType="slide" onRequestClose={() => setReportTarget(null)}>
          <View style={s.modalOverlay}>
            <View style={s.modal}>
              <View style={s.modalHeader}>
                <View style={[s.modalIcon, { backgroundColor: '#D9770615' }]}>
                  <MaterialIcons name="report" size={22} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>{fr ? 'Signaler cette usurpation' : 'Report this impersonation'}</Text>
                  <Text style={s.modalSub}>
                    {fr
                      ? 'Notre equipe de moderation examinera le compte createur et prendra les mesures necessaires.'
                      : 'Our moderation team will review the creator account and take necessary action.'}
                  </Text>
                </View>
              </View>

              <View style={s.modalActions}>
                <Pressable style={s.modalCancelBtn} onPress={() => setReportTarget(null)}>
                  <Text style={s.modalCancelText}>{fr ? 'Annuler' : 'Cancel'}</Text>
                </Pressable>
                <Pressable style={[s.modalConfirmBtn, reporting && { opacity: 0.6 }]} onPress={submitReport_} disabled={reporting}>
                  {reporting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="flag" size={16} color="#FFF" />
                      <Text style={s.modalConfirmText}>{fr ? 'Confirmer' : 'Confirm'}</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </PageErrorBoundary>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  headerSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 16, textAlign: 'center' },
  emptyText: { fontSize: 13, color: theme.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A' },
  infoText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 17 },
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 10, ...theme.shadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  playerName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  metaText: { fontSize: 11, color: theme.textMuted, marginTop: 3 },
  metaEmphasis: { fontWeight: '700', color: theme.textSecondary },
  matchIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12 },
  matchIndicatorText: { flex: 1, fontSize: 11, color: theme.textSecondary },
  matchIndicatorBold: { fontWeight: '700', color: theme.primary },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  viewBtn: { backgroundColor: theme.primary + '10', borderWidth: 1, borderColor: theme.primary + '30' },
  reportBtn: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  dismissBtn: { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  modalIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  modalSub: { fontSize: 12, color: theme.textSecondary, marginTop: 3, lineHeight: 17 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: theme.backgroundSecondary },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  modalConfirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#B45309' },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
