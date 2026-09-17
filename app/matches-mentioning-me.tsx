import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import theme from '@/constants/theme';
import * as Haptics from '@/services/haptics';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import PageErrorBoundary from '@/components/ui/PageErrorBoundary';
import { getMatchesMentioningUser, reportFakeMatch, MatchMention } from '@/services/mentionsService';
import { acceptShareRequest, declineShareRequest, createShareRequests } from '@/services/matchShareService';
import { useAuth } from '@/template';

export default function MatchesMentioningMeScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mentions, setMentions] = useState<MatchMention[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<MatchMention | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    const { mentions: list, error } = await getMatchesMentioningUser();
    if (error) {
      showAlert(fr ? 'Erreur' : 'Error', error);
    }
    setMentions(list);
    setLoading(false);
    setRefreshing(false);
  }, [fr, showAlert]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (m: MatchMention) => {
    if (!m.pendingRequestId) {
      showAlert(fr ? 'Info' : 'Info', fr ? 'Aucune demande de partage active — demandez au createur de partager le match.' : 'No active share request — ask the creator to share the match.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionInProgress(m.matchId);
    const { error } = await acceptShareRequest(m.pendingRequestId);
    setActionInProgress(null);
    if (error) {
      showAlert(fr ? 'Erreur' : 'Error', error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMentions(prev => prev.filter(x => x.matchId !== m.matchId));
  };

  const handleDecline = async (m: MatchMention) => {
    if (!m.pendingRequestId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionInProgress(m.matchId);
    const { error } = await declineShareRequest(m.pendingRequestId);
    setActionInProgress(null);
    if (error) {
      showAlert(fr ? 'Erreur' : 'Error', error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMentions(prev => prev.filter(x => x.matchId !== m.matchId));
  };

  const handleRequestShare = async (m: MatchMention) => {
    if (!user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionInProgress(m.matchId);
    const { error } = await createShareRequests({
      itemType: 'match',
      itemId: m.matchId,
      senderUserId: m.senderUserId,
      senderName: m.senderName || 'Auteur',
      recipients: [{ userId: user.id, permission: 'read' }],
      itemSummary: `${m.teamANames.join(', ')} vs ${m.teamBNames.join(', ')}`,
    });
    setActionInProgress(null);
    if (error) {
      showAlert(fr ? 'Erreur' : 'Error', error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(fr ? 'Demande envoyee' : 'Request sent', fr ? 'Vous recevrez le match une fois valide.' : 'You will receive the match once validated.');
    load();
  };

  const openReport = (m: MatchMention) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReportTarget(m);
    setReportDetails('');
    setReportModalOpen(true);
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    setReporting(true);
    const { error } = await reportFakeMatch({
      matchId: reportTarget.matchId,
      senderUserId: reportTarget.senderUserId,
      details: reportDetails.trim() || undefined,
    });
    setReporting(false);
    if (error) {
      if (error === 'already_reported') {
        showAlert(fr ? 'Deja signale' : 'Already reported', fr ? 'Vous avez deja signale ce match.' : 'You already reported this match.');
      } else {
        showAlert(fr ? 'Erreur' : 'Error', error);
      }
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReportModalOpen(false);
    setReportTarget(null);
    showAlert(fr ? 'Signalement envoye' : 'Report submitted', fr ? 'Notre equipe examinera ce match sous 24-48h.' : 'Our team will review this match within 24-48h.');
    setMentions(prev => prev.filter(x => x.matchId !== reportTarget.matchId));
  };

  return (
    <PageErrorBoundary pageName="MatchesMentioningMe">
      <SafeAreaView edges={['top']} style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{fr ? 'Matchs me mentionnant' : 'Matches mentioning me'}</Text>
            <Text style={s.headerSub}>{fr ? 'Verifiez avant d\'accepter dans vos stats' : 'Verify before adding to your stats'}</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
        >
          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : mentions.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(300)} style={s.emptyBox}>
              <MaterialIcons name="check-circle" size={56} color={theme.success} />
              <Text style={s.emptyTitle}>{fr ? 'Aucun match a verifier' : 'No matches to verify'}</Text>
              <Text style={s.emptyText}>
                {fr
                  ? 'Vous n\'avez aucun match cree par un autre joueur en attente de votre confirmation.'
                  : 'You have no pending matches created by other players awaiting your confirmation.'}
              </Text>
            </Animated.View>
          ) : (
            <>
              <View style={s.infoBanner}>
                <MaterialIcons name="info-outline" size={16} color={theme.primary} />
                <Text style={s.infoText}>
                  {fr
                    ? `${mentions.length} match(s) vous mentionnant. Accepter ajoutera le match a vos stats et ELO.`
                    : `${mentions.length} match(es) mentioning you. Accepting will add the match to your stats and ELO.`}
                </Text>
              </View>

              {mentions.map((m, idx) => {
                const busy = actionInProgress === m.matchId;
                const isWin = m.winner === 'A' ? m.teamANames.some(n => n) : m.teamBNames.some(n => n);
                return (
                  <Animated.View key={m.matchId} entering={FadeInDown.duration(300).delay(idx * 40)} style={s.card}>
                    <View style={s.cardHeader}>
                      <View style={[s.senderAvatar, { backgroundColor: theme.primary + '15' }]}>
                        <MaterialIcons name="person" size={20} color={theme.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.senderName}>{m.senderName || (fr ? 'Auteur' : 'Author')}</Text>
                        <Text style={s.matchDate}>{new Date(m.matchDate).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <View style={[s.formatBadge, { backgroundColor: theme.carreauColor + '15' }]}>
                        <Text style={[s.formatBadgeText, { color: theme.carreauColor }]}>{m.format}</Text>
                      </View>
                    </View>

                    <View style={s.scoreRow}>
                      <View style={s.teamCol}>
                        <Text style={s.teamNames} numberOfLines={2}>{m.teamANames.join(' • ')}</Text>
                      </View>
                      <View style={s.scoreBox}>
                        <Text style={[s.scoreNum, m.winner === 'A' && s.scoreWin]}>{m.teamAScore}</Text>
                        <Text style={s.scoreSep}>-</Text>
                        <Text style={[s.scoreNum, m.winner === 'B' && s.scoreWin]}>{m.teamBScore}</Text>
                      </View>
                      <View style={[s.teamCol, { alignItems: 'flex-end' }]}>
                        <Text style={[s.teamNames, { textAlign: 'right' }]} numberOfLines={2}>{m.teamBNames.join(' • ')}</Text>
                      </View>
                    </View>

                    {!m.hasPendingRequest ? (
                      <View style={s.silentBanner}>
                        <MaterialIcons name="warning" size={14} color="#D97706" />
                        <Text style={s.silentBannerText}>
                          {fr
                            ? 'Match sans demande de partage explicite — vous n\'avez pas ete officiellement invite.'
                            : 'Match without explicit share request — you were not officially invited.'}
                        </Text>
                      </View>
                    ) : null}

                    <View style={s.actionsRow}>
                      {m.hasPendingRequest ? (
                        <>
                          <Pressable
                            style={[s.actionBtn, s.declineBtn, busy && { opacity: 0.5 }]}
                            onPress={() => handleDecline(m)}
                            disabled={busy}
                          >
                            <MaterialIcons name="close" size={16} color={theme.error} />
                            <Text style={[s.actionBtnText, { color: theme.error }]}>{fr ? 'Refuser' : 'Decline'}</Text>
                          </Pressable>
                          <Pressable
                            style={[s.actionBtn, s.acceptBtn, busy && { opacity: 0.5 }]}
                            onPress={() => handleAccept(m)}
                            disabled={busy}
                          >
                            {busy ? (
                              <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                              <>
                                <MaterialIcons name="check" size={16} color="#FFF" />
                                <Text style={[s.actionBtnText, { color: '#FFF' }]}>{fr ? 'Accepter' : 'Accept'}</Text>
                              </>
                            )}
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          style={[s.actionBtn, s.requestBtn, busy && { opacity: 0.5 }]}
                          onPress={() => handleRequestShare(m)}
                          disabled={busy}
                        >
                          <MaterialIcons name="mail" size={16} color={theme.primary} />
                          <Text style={[s.actionBtnText, { color: theme.primary }]}>{fr ? 'Demander partage' : 'Request share'}</Text>
                        </Pressable>
                      )}
                      <Pressable style={[s.actionBtn, s.reportBtn, busy && { opacity: 0.5 }]} onPress={() => openReport(m)} disabled={busy}>
                        <MaterialIcons name="flag" size={16} color="#B45309" />
                        <Text style={[s.actionBtnText, { color: '#B45309' }]}>{fr ? 'Faux match' : 'Fake match'}</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              })}
            </>
          )}
        </ScrollView>

        <Modal visible={reportModalOpen} transparent animationType="slide" onRequestClose={() => setReportModalOpen(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modal}>
              <View style={s.modalHeader}>
                <View style={[s.modalIcon, { backgroundColor: '#D9770615' }]}>
                  <MaterialIcons name="report" size={22} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>{fr ? 'Ce match n\'a jamais eu lieu' : 'This match never happened'}</Text>
                  <Text style={s.modalSub}>
                    {fr
                      ? 'Notre equipe de moderation examinera votre signalement. Le score de confiance du createur sera reduit.'
                      : 'Our moderation team will review your report. The creator\'s trust score will be reduced.'}
                  </Text>
                </View>
                <Pressable style={s.modalClose} onPress={() => setReportModalOpen(false)}>
                  <MaterialIcons name="close" size={22} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={s.modalBody}>
                <Text style={s.modalLabel}>{fr ? 'Details (optionnel)' : 'Details (optional)'}</Text>
                <TextInput
                  style={s.modalInput}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  placeholder={fr ? 'Expliquez pourquoi ce match est faux...' : 'Explain why this match is fake...'}
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={s.modalActions}>
                <Pressable style={s.modalCancelBtn} onPress={() => setReportModalOpen(false)}>
                  <Text style={s.modalCancelText}>{fr ? 'Annuler' : 'Cancel'}</Text>
                </Pressable>
                <Pressable
                  style={[s.modalConfirmBtn, reporting && { opacity: 0.6 }]}
                  onPress={submitReport}
                  disabled={reporting}
                >
                  {reporting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="flag" size={16} color="#FFF" />
                      <Text style={s.modalConfirmText}>{fr ? 'Signaler' : 'Report'}</Text>
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
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.primary + '10', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: theme.primary + '25' },
  infoText: { flex: 1, fontSize: 12, color: theme.primary, fontWeight: '600', lineHeight: 17 },
  card: { backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 10, ...theme.shadows.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  senderAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  senderName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  matchDate: { fontSize: 11, color: theme.textMuted, marginTop: 2 },
  formatBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  formatBadgeText: { fontSize: 11, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  teamCol: { flex: 1 },
  teamNames: { fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  scoreBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginHorizontal: 8 },
  scoreNum: { fontSize: 20, fontWeight: '800', color: theme.textSecondary, minWidth: 22, textAlign: 'center' },
  scoreWin: { color: theme.success },
  scoreSep: { fontSize: 14, color: theme.textMuted, marginHorizontal: 4 },
  silentBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: '#FDE68A' },
  silentBannerText: { flex: 1, fontSize: 10.5, color: '#92400E', fontWeight: '600', lineHeight: 14 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  acceptBtn: { backgroundColor: theme.success },
  declineBtn: { backgroundColor: theme.error + '10', borderWidth: 1, borderColor: theme.error + '30' },
  requestBtn: { backgroundColor: theme.primary + '10', borderWidth: 1, borderColor: theme.primary + '30' },
  reportBtn: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  modalIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  modalSub: { fontSize: 12, color: theme.textSecondary, marginTop: 3, lineHeight: 17 },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  modalBody: { marginBottom: 16 },
  modalLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  modalInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 12, fontSize: 14, color: theme.textPrimary, minHeight: 90, borderWidth: 1, borderColor: theme.border, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: theme.backgroundSecondary },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  modalConfirmBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#B45309' },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
