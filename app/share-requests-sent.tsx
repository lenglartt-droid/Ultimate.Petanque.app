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
import {
  getSentShareRequests,
  getShareRequestRemainingTime,
  revokeShareRequest,
  MatchShareRequest,
} from '@/services/matchShareService';
import { resendShareRequest } from '@/services/shareReminderService';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'declined';

export default function ShareRequestsSentScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { showAlert } = useAlert();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<MatchShareRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<{ success: number; failed: number } | null>(null);

  const load = useCallback(async () => {
    const { requests: list, error } = await getSentShareRequests();
    if (error) showAlert(fr ? 'Erreur' : 'Error', error);
    setRequests(list);
    setLoading(false);
    setRefreshing(false);
  }, [fr, showAlert]);

  useEffect(() => { load(); }, [load]);

  const filtered = requests.filter(r => statusFilter === 'all' || r.status === statusFilter);

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    declined: requests.filter(r => r.status === 'declined').length,
  };

  const canResendRequest = (r: MatchShareRequest): boolean => {
    const rem = getShareRequestRemainingTime(r.createdAt, r.status);
    return r.status === 'declined' || (r.status === 'pending' && !!rem?.isExpired);
  };

  const eligibleForBulk = requests.filter(canResendRequest);

  const toggleSelectionMode = () => {
    Haptics.selectionAsync();
    setSelectionMode(prev => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const toggleSelected = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEligible = () => {
    Haptics.selectionAsync();
    if (selectedIds.size === eligibleForBulk.length && eligibleForBulk.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleForBulk.map(r => r.id)));
    }
  };

  const executeBulkResend = async () => {
    setConfirmOpen(false);
    const toResend = requests.filter(r => selectedIds.has(r.id));
    const total = toResend.length;
    if (total === 0) return;
    setBulkProgress({ current: 0, total });
    let successCount = 0;
    let failedCount = 0;
    for (let i = 0; i < toResend.length; i++) {
      const r = toResend[i];
      setBulkProgress({ current: i + 1, total });
      const { error } = await resendShareRequest({
        itemType: r.itemType,
        itemId: r.itemId,
        recipientUserId: r.recipientUserId,
        senderName: r.senderName,
        itemSummary: r.itemSummary,
        permission: r.permission,
      });
      if (error) failedCount++;
      else successCount++;
    }
    setBulkProgress(null);
    setBulkResults({ success: successCount, failed: failedCount });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedIds(new Set());
    setSelectionMode(false);
    load();
    setTimeout(() => setBulkResults(null), 4000);
  };

  const handleResend = async (r: MatchShareRequest) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusyId(r.id);
    const { requestId, error } = await resendShareRequest({
      itemType: r.itemType,
      itemId: r.itemId,
      recipientUserId: r.recipientUserId,
      senderName: r.senderName,
      itemSummary: r.itemSummary,
      permission: r.permission,
    });
    setBusyId(null);
    if (error) {
      showAlert(fr ? 'Erreur' : 'Error', error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(fr ? 'Demande renvoyee' : 'Request resent', fr ? 'La personne recevra une nouvelle notification.' : 'The recipient will receive a new notification.');
    load();
  };

  const handleRevoke = async (r: MatchShareRequest) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusyId(r.id);
    const { error } = await revokeShareRequest(r.id);
    setBusyId(null);
    if (error) {
      showAlert(fr ? 'Erreur' : 'Error', error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRequests(prev => prev.filter(x => x.id !== r.id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return theme.success;
      case 'declined': return theme.error;
      default: return '#D97706';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted': return fr ? 'Acceptee' : 'Accepted';
      case 'declined': return fr ? 'Refusee' : 'Declined';
      default: return fr ? 'En attente' : 'Pending';
    }
  };

  return (
    <PageErrorBoundary pageName="ShareRequestsSent">
      <SafeAreaView edges={['top']} style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{selectionMode ? (fr ? `${selectedIds.size} selectionnee(s)` : `${selectedIds.size} selected`) : (fr ? 'Demandes envoyees' : 'Sent requests')}</Text>
            <Text style={s.headerSub}>{selectionMode ? (fr ? 'Choisissez les demandes a renvoyer' : 'Choose which requests to resend') : (fr ? 'Gerez vos partages et renvoyez les refuses' : 'Manage your shares and resend declined ones')}</Text>
          </View>
          {eligibleForBulk.length > 0 ? (
            <Pressable style={[s.selectModeBtn, selectionMode && s.selectModeBtnActive]} onPress={toggleSelectionMode}>
              <MaterialIcons name={selectionMode ? 'close' : 'checklist'} size={20} color={selectionMode ? '#FFF' : theme.primary} />
            </Pressable>
          ) : null}
        </View>

        {/* Status filter chips */}
        <View style={s.filterBar}>
          {(['all', 'pending', 'accepted', 'declined'] as const).map(f => {
            const active = statusFilter === f;
            return (
              <Pressable
                key={f}
                style={[s.filterChip, active && s.filterChipActive]}
                onPress={() => { Haptics.selectionAsync(); setStatusFilter(f); }}
              >
                <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                  {f === 'all' ? (fr ? 'Toutes' : 'All')
                    : f === 'pending' ? (fr ? 'En attente' : 'Pending')
                    : f === 'accepted' ? (fr ? 'Acceptees' : 'Accepted')
                    : (fr ? 'Refusees' : 'Declined')}
                </Text>
                <View style={[s.filterCount, active && s.filterCountActive]}>
                  <Text style={[s.filterCountText, active && s.filterCountTextActive]}>{counts[f]}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
        >
          {loading ? (
            <View style={s.loadingBox}><ActivityIndicator size="large" color={theme.primary} /></View>
          ) : filtered.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(300)} style={s.emptyBox}>
              <MaterialIcons name="outbox" size={56} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{fr ? 'Aucune demande' : 'No requests'}</Text>
              <Text style={s.emptyText}>
                {statusFilter === 'declined'
                  ? (fr ? 'Aucune demande refusee ou expiree.' : 'No declined or expired requests.')
                  : (fr ? 'Aucune demande de partage envoyee.' : 'No share requests sent yet.')}
              </Text>
            </Animated.View>
          ) : (
            filtered.map((r, idx) => {
              const remaining = getShareRequestRemainingTime(r.createdAt, r.status);
              const statusColor = getStatusColor(r.status);
              const busy = busyId === r.id;
              const eligible = canResendRequest(r);
              const isExpired = remaining?.isExpired;
              const isSelected = selectedIds.has(r.id);

              return (
                <Animated.View key={r.id} entering={FadeInDown.duration(300).delay(idx * 40)}>
                  <Pressable
                    style={[s.card, selectionMode && !eligible && s.cardDimmed, selectionMode && isSelected && s.cardSelected]}
                    onPress={selectionMode && eligible ? () => toggleSelected(r.id) : undefined}
                    disabled={!selectionMode || !eligible}
                  >
                    {selectionMode ? (
                      <View style={s.selectionIndicator}>
                        <View style={[s.checkbox, isSelected && s.checkboxSelected, !eligible && s.checkboxDisabled]}>
                          {isSelected ? <MaterialIcons name="check" size={14} color="#FFF" /> : null}
                          {!eligible && !isSelected ? <MaterialIcons name="lock" size={11} color={theme.textMuted} /> : null}
                        </View>
                        <Text style={[s.selectionHint, !eligible && s.selectionHintDisabled]}>
                          {!eligible ? (fr ? 'Non renvoyable' : 'Not resendable') : isSelected ? (fr ? 'Selectionnee' : 'Selected') : (fr ? 'Toucher pour selectionner' : 'Tap to select')}
                        </Text>
                      </View>
                    ) : null}
                    <View style={s.cardHeader}>
                    <View style={[s.itemTypeIcon, { backgroundColor: theme.primary + '15' }]}>
                      <MaterialIcons name={r.itemType === 'match' ? 'sports' : 'track-changes'} size={20} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemSummary} numberOfLines={2}>
                        {r.itemSummary || (r.itemType === 'match' ? (fr ? 'Match' : 'Match') : (fr ? 'Defi' : 'Challenge'))}
                      </Text>
                      <Text style={s.sentDate}>
                        {fr ? 'Envoyee ' : 'Sent '}
                        {new Date(r.createdAt).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: statusColor + '15' }]}>
                      <View style={[s.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[s.statusText, { color: statusColor }]}>{getStatusLabel(r.status)}</Text>
                    </View>
                  </View>

                  <View style={s.metaRow}>
                    <MaterialIcons name={r.permission === 'write' ? 'edit' : 'visibility'} size={13} color={theme.textMuted} />
                    <Text style={s.metaText}>
                      {r.permission === 'write' ? (fr ? 'Modification' : 'Edit') : (fr ? 'Lecture seule' : 'Read only')}
                    </Text>
                    {r.status === 'pending' && remaining && !remaining.isExpired ? (
                      <>
                        <View style={s.metaDot} />
                        <MaterialIcons name="schedule" size={13} color={theme.textMuted} />
                        <Text style={s.metaText}>
                          {remaining.daysLeft > 0
                            ? (fr ? `Expire dans ${remaining.daysLeft}j` : `Expires in ${remaining.daysLeft}d`)
                            : (fr ? `Expire dans ${remaining.hoursLeft}h` : `Expires in ${remaining.hoursLeft}h`)}
                        </Text>
                      </>
                    ) : null}
                    {isExpired ? (
                      <>
                        <View style={s.metaDot} />
                        <MaterialIcons name="hourglass-empty" size={13} color={theme.error} />
                        <Text style={[s.metaText, { color: theme.error, fontWeight: '700' }]}>{fr ? 'Expiree' : 'Expired'}</Text>
                      </>
                    ) : null}
                  </View>

                  <View style={s.actionsRow}>
                    {eligible && !selectionMode ? (
                      <Pressable style={[s.actionBtn, s.resendBtn, busy && { opacity: 0.5 }]} onPress={() => handleResend(r)} disabled={busy}>
                        {busy ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <MaterialIcons name="refresh" size={16} color="#FFF" />
                            <Text style={[s.actionBtnText, { color: '#FFF' }]}>{fr ? 'Renvoyer' : 'Resend'}</Text>
                          </>
                        )}
                      </Pressable>
                    ) : null}
                    <Pressable style={[s.actionBtn, s.revokeBtn, busy && { opacity: 0.5 }]} onPress={() => handleRevoke(r)} disabled={busy || selectionMode}>
                      <MaterialIcons name="close" size={16} color={theme.error} />
                      <Text style={[s.actionBtnText, { color: theme.error }]}>{fr ? 'Retirer' : 'Revoke'}</Text>
                    </Pressable>
                  </View>
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </ScrollView>

        {selectionMode ? (
          <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable style={s.selectAllBtn} onPress={selectAllEligible} disabled={eligibleForBulk.length === 0}>
              <MaterialIcons name={selectedIds.size === eligibleForBulk.length && eligibleForBulk.length > 0 ? 'deselect' : 'select-all'} size={16} color={theme.primary} />
              <Text style={s.selectAllText}>{selectedIds.size === eligibleForBulk.length && eligibleForBulk.length > 0 ? (fr ? 'Deselectionner' : 'Deselect') : (fr ? 'Tout' : 'All')}</Text>
            </Pressable>
            <Pressable style={[s.bulkResendBtn, selectedIds.size === 0 && s.bulkResendBtnDisabled]} onPress={() => setConfirmOpen(true)} disabled={selectedIds.size === 0}>
              <MaterialIcons name="refresh" size={16} color="#FFF" />
              <Text style={s.bulkResendText}>{fr ? `Renvoyer (${selectedIds.size})` : `Resend (${selectedIds.size})`}</Text>
            </Pressable>
          </View>
        ) : null}

        <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => setConfirmOpen(false)}>
          <View style={s.confirmOverlay}>
            <View style={s.confirmModal}>
              <View style={s.confirmIconBox}>
                <MaterialIcons name="refresh" size={32} color={theme.primary} />
              </View>
              <Text style={s.confirmTitle}>{fr ? 'Renvoyer les demandes ?' : 'Resend requests?'}</Text>
              <Text style={s.confirmMsg}>
                {fr
                  ? `Une nouvelle notification sera envoyee a ${selectedIds.size} destinataire(s). Voulez-vous continuer ?`
                  : `A new notification will be sent to ${selectedIds.size} recipient(s). Do you want to continue?`}
              </Text>
              <View style={s.confirmActions}>
                <Pressable style={s.confirmCancel} onPress={() => setConfirmOpen(false)}>
                  <Text style={s.confirmCancelText}>{fr ? 'Annuler' : 'Cancel'}</Text>
                </Pressable>
                <Pressable style={s.confirmOk} onPress={executeBulkResend}>
                  <MaterialIcons name="check" size={16} color="#FFF" />
                  <Text style={s.confirmOkText}>{fr ? 'Confirmer' : 'Confirm'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!bulkProgress} transparent animationType="fade">
          <View style={s.confirmOverlay}>
            <View style={s.progressModal}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={s.progressTitle}>{fr ? 'Renvoi en cours...' : 'Resending...'}</Text>
              {bulkProgress ? (
                <>
                  <Text style={s.progressText}>{bulkProgress.current} / {bulkProgress.total}</Text>
                  <View style={s.progressBar}>
                    <View style={[s.progressFill, { width: `${(bulkProgress.current / Math.max(1, bulkProgress.total)) * 100}%` }]} />
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>

        {bulkResults ? (
          <View style={[s.resultsBanner, { bottom: insets.bottom + 24 }]}>
            <MaterialIcons name={bulkResults.failed === 0 ? 'check-circle' : 'error'} size={20} color={bulkResults.failed === 0 ? theme.success : '#F59E0B'} />
            <Text style={s.resultsText}>
              {fr
                ? `${bulkResults.success} renvoyee(s)${bulkResults.failed > 0 ? `, ${bulkResults.failed} echec(s)` : ''}`
                : `${bulkResults.success} resent${bulkResults.failed > 0 ? `, ${bulkResults.failed} failed` : ''}`}
            </Text>
          </View>
        ) : null}
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
  filterBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: theme.backgroundSecondary, borderRadius: 20 },
  filterChipActive: { backgroundColor: theme.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  filterChipTextActive: { color: '#FFF' },
  filterCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: theme.surface, borderRadius: 10, alignItems: 'center' },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary },
  filterCountTextActive: { color: '#FFF' },
  loadingBox: { paddingVertical: 60, alignItems: 'center' },
  emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 16, textAlign: 'center' },
  emptyText: { fontSize: 13, color: theme.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 10, ...theme.shadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  itemTypeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemSummary: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, lineHeight: 18 },
  sentDate: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted, marginHorizontal: 4 },
  metaText: { fontSize: 11, color: theme.textMuted, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  resendBtn: { backgroundColor: theme.primary },
  revokeBtn: { backgroundColor: theme.error + '10', borderWidth: 1, borderColor: theme.error + '30' },
  selectModeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: theme.primary + '15' },
  selectModeBtnActive: { backgroundColor: theme.primary },
  cardDimmed: { opacity: 0.5 },
  cardSelected: { borderWidth: 2, borderColor: theme.primary },
  selectionIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  checkboxDisabled: { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
  selectionHint: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  selectionHintDisabled: { color: theme.textMuted, fontStyle: 'italic' },
  bottomBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.primary + '10', borderWidth: 1, borderColor: theme.primary + '30' },
  selectAllText: { fontSize: 13, fontWeight: '700', color: theme.primary },
  bulkResendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.primary },
  bulkResendBtnDisabled: { backgroundColor: theme.textMuted, opacity: 0.6 },
  bulkResendText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  confirmModal: { width: '100%', maxWidth: 360, backgroundColor: theme.surface, borderRadius: 20, padding: 24, alignItems: 'center' },
  confirmIconBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', marginBottom: 8 },
  confirmMsg: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  confirmActions: { flexDirection: 'row', gap: 10, width: '100%' },
  confirmCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: theme.backgroundSecondary },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  confirmOk: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.primary },
  confirmOkText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  progressModal: { width: '80%', maxWidth: 320, backgroundColor: theme.surface, borderRadius: 20, padding: 24, alignItems: 'center' },
  progressTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginTop: 16 },
  progressText: { fontSize: 13, color: theme.textSecondary, marginTop: 6 },
  progressBar: { width: '100%', height: 6, borderRadius: 3, backgroundColor: theme.backgroundSecondary, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.primary, borderRadius: 3 },
  resultsBanner: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, ...theme.shadows.card },
  resultsText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.textPrimary },
});
