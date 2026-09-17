/**
 * ShareRequestModal - Post-save popup to send share requests to linked players.
 *
 * Two-step unified flow:
 *   Step 1  — Auto-detection of linked accounts + read/write permission per
 *              recipient. Non-intrusive banner "X player(s) with an account
 *              detected".
 *   Step 2  — Advanced options: public share link, QR code, expiry, granular
 *              permissions. Merges the previous "Share with teammates" and
 *              "Share with participants" buttons.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, Switch, ScrollView, Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { detectLinkedPlayers, createShareRequests } from '@/services/matchShareService';
import { createShareLink } from '@/services/shareService';
import { buildAppDownloadLink } from '@/utils/appDownload';
import { useAuth } from '@/template';

interface LinkedPlayer {
  playerId: string;
  playerName: string;
  userId: string;
  email: string;
  permission: 'read' | 'write';
  selected: boolean;
}

interface ShareRequestModalProps {
  visible: boolean;
  onClose: () => void;
  itemType: 'match' | 'challenge';
  itemId: string | null;
  playerIds: string[];
  senderName: string;
  itemSummary?: string;
  language?: string;
  /** Team player IDs for wrong-share detection */
  matchPlayerIds?: string[];
}

export default function ShareRequestModal({
  visible,
  onClose,
  itemType,
  itemId,
  playerIds,
  senderName,
  itemSummary,
  language = 'fr',
  matchPlayerIds,
}: ShareRequestModalProps) {
  const { user } = useAuth();
  const fr = language === 'fr';
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayer[]>([]);
  const [sent, setSent] = useState(false);
  // 2-step flow state
  const [step, setStep] = useState<1 | 2>(1);
  const [publicLinkCode, setPublicLinkCode] = useState<string | null>(null);
  const [publicLinkLoading, setPublicLinkLoading] = useState(false);
  const [publicLinkPermission, setPublicLinkPermission] = useState<'read' | 'write'>('read');

  useEffect(() => {
    if (!visible || !itemId || playerIds.length === 0) {
      setLinkedPlayers([]);
      setLoading(false);
      setSent(false);
      setStep(1);
      setPublicLinkCode(null);
      return;
    }

    setLoading(true);
    setSent(false);
    setStep(1);
    setPublicLinkCode(null);
    detectLinkedPlayers(playerIds, user?.id).then(({ linkedPlayers: linked }) => {
      setLinkedPlayers(
        linked.map(p => ({
          ...p,
          permission: 'read' as const,
          selected: true,
        }))
      );
      setLoading(false);
    });
  }, [visible, itemId, playerIds, user?.id]);

  const togglePlayer = useCallback((userId: string) => {
    Haptics.selectionAsync();
    setLinkedPlayers(prev =>
      prev.map(p => (p.userId === userId ? { ...p, selected: !p.selected } : p))
    );
  }, []);

  const togglePermission = useCallback((userId: string) => {
    Haptics.selectionAsync();
    setLinkedPlayers(prev =>
      prev.map(p =>
        p.userId === userId
          ? { ...p, permission: p.permission === 'read' ? 'write' : 'read' }
          : p
      )
    );
  }, []);

  const [showNonParticipantWarning, setShowNonParticipantWarning] = useState(false);
  const [nonParticipantNames, setNonParticipantNames] = useState<string[]>([]);

  const doSend = useCallback(async () => {
    if (!itemId || !user?.id) return;
    const selected = linkedPlayers.filter(p => p.selected);
    if (selected.length === 0) {
      onClose();
      return;
    }

    setSending(true);
    const { error } = await createShareRequests({
      itemType,
      itemId,
      senderUserId: user.id,
      senderName,
      recipients: selected.map(p => ({ userId: p.userId, permission: p.permission })),
      itemSummary,
    });

    setSending(false);
    if (!error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
      setTimeout(onClose, 1200);
    } else {
      onClose();
    }
  }, [itemId, user?.id, linkedPlayers, itemType, senderName, itemSummary, onClose]);

  const handleSend = useCallback(async () => {
    if (!itemId || !user?.id) return;
    const selected = linkedPlayers.filter(p => p.selected);
    if (selected.length === 0) {
      onClose();
      return;
    }

    // Check for non-participant recipients
    if (matchPlayerIds && matchPlayerIds.length > 0) {
      const nonParticipants = selected.filter(p => !matchPlayerIds.includes(p.playerId));
      if (nonParticipants.length > 0) {
        setNonParticipantNames(nonParticipants.map(p => p.playerName));
        setShowNonParticipantWarning(true);
        return;
      }
    }

    await doSend();
  }, [itemId, user?.id, linkedPlayers, matchPlayerIds, onClose, doSend]);

  const selectedCount = linkedPlayers.filter(p => p.selected).length;
  const hasLinkedPlayers = linkedPlayers.length > 0;

  const generatePublicLink = useCallback(async () => {
    if (!itemId) return;
    setPublicLinkLoading(true);
    const { shareCode, error } = await createShareLink(itemType, itemId, publicLinkPermission);
    setPublicLinkLoading(false);
    if (error) return;
    setPublicLinkCode(shareCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [itemId, itemType, publicLinkPermission]);

  const copyPublicLink = useCallback(async () => {
    if (!publicLinkCode) return;
    const link = buildAppDownloadLink({ shareCode: publicLinkCode });
    await Clipboard.setStringAsync(link);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [publicLinkCode]);

  const sharePublicLink = useCallback(async () => {
    if (!publicLinkCode) return;
    const link = buildAppDownloadLink({ shareCode: publicLinkCode });
    try {
      await Share.share({
        message: fr
          ? `Consultez ce ${itemType === 'match' ? 'match' : 'defi'} sur Ultimate Petanque : ${link}`
          : `View this ${itemType} on Ultimate Petanque: ${link}`,
        url: link,
      });
    } catch { /* silent */ }
  }, [publicLinkCode, fr, itemType]);

  // Auto-close if no linked players found
  useEffect(() => {
    if (!loading && !hasLinkedPlayers && visible && step === 1) {
      // If no linked players, jump directly to step 2 (public link / QR)
      setStep(2);
    }
  }, [loading, hasLinkedPlayers, visible, step]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.modal}>
          {/* Header */}
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: theme.primary + '15' }]}>
              <MaterialIcons name={step === 1 ? 'group-add' : 'ios-share'} size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headerTitle}>
                {step === 1
                  ? (fr ? 'Partager avec les joueurs' : 'Share with players')
                  : (fr ? 'Options avancees' : 'Advanced options')}
              </Text>
              <Text style={s.headerSub}>
                {step === 1
                  ? (hasLinkedPlayers
                      ? (fr
                          ? `${linkedPlayers.length} joueur(s) avec un compte detecte(s)`
                          : `${linkedPlayers.length} player(s) with an account detected`)
                      : (fr
                          ? 'Aucun compte lie — partagez via lien public'
                          : 'No linked accounts — share via public link'))
                  : (fr ? 'Lien public, QR code, permissions granulaires' : 'Public link, QR code, granular permissions')}
              </Text>
            </View>
            {/* Step indicator */}
            <View style={s.stepIndicator}>
              <View style={[s.stepDot, step === 1 && s.stepDotActive]} />
              <View style={[s.stepDot, step === 2 && s.stepDotActive]} />
            </View>
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Content */}
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={s.loadingText}>
                {fr ? 'Detection des comptes...' : 'Detecting accounts...'}
              </Text>
            </View>
          ) : sent ? (
            <View style={s.sentWrap}>
              <MaterialIcons name="check-circle" size={56} color={theme.success} />
              <Text style={s.sentTitle}>
                {fr ? 'Demandes envoyees !' : 'Requests sent!'}
              </Text>
              <Text style={s.sentSub}>
                {fr
                  ? `${selectedCount} joueur(s) recevront une notification`
                  : `${selectedCount} player(s) will receive a notification`}
              </Text>
            </View>
          ) : step === 1 ? (
            <>
              {/* Non-intrusive detection banner */}
              {hasLinkedPlayers ? (
                <View style={s.detectionBanner}>
                  <View style={s.detectionBannerIcon}>
                    <MaterialIcons name="verified-user" size={16} color={theme.success} />
                  </View>
                  <Text style={s.detectionBannerText}>
                    {fr
                      ? `${linkedPlayers.length} joueur(s) avec un compte detecte(s) — envoyer une demande de partage ?`
                      : `${linkedPlayers.length} player(s) with an account detected — send a sharing request?`}
                  </Text>
                </View>
              ) : null}

              {/* Player List */}
              <ScrollView style={{ maxHeight: 320 }}>
                <View style={s.playerList}>
                  {linkedPlayers.map(p => (
                    <View key={p.userId} style={[s.playerRow, !p.selected && s.playerRowDisabled]}>
                      <Pressable style={s.playerCheckbox} onPress={() => togglePlayer(p.userId)}>
                        <MaterialIcons
                          name={p.selected ? 'check-box' : 'check-box-outline-blank'}
                          size={22}
                          color={p.selected ? theme.primary : theme.textMuted}
                        />
                      </Pressable>
                      <View style={s.playerAvatar}>
                        <Text style={s.playerAvatarText}>
                          {p.playerName
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </Text>
                      </View>
                      <View style={s.playerInfo}>
                        <Text style={s.playerName} numberOfLines={1}>
                          {p.playerName}
                        </Text>
                        <Text style={s.playerEmail} numberOfLines={1}>
                          {p.email || (fr ? 'Compte lie' : 'Linked account')}
                        </Text>
                      </View>
                      {p.selected ? (
                        <Pressable
                          style={[
                            s.permBadge,
                            {
                              backgroundColor:
                                p.permission === 'write'
                                  ? theme.accent + '15'
                                  : theme.primary + '15',
                            },
                          ]}
                          onPress={() => togglePermission(p.userId)}
                        >
                          <MaterialIcons
                            name={p.permission === 'write' ? 'edit' : 'visibility'}
                            size={14}
                            color={
                              p.permission === 'write' ? theme.accent : theme.primary
                            }
                          />
                          <Text
                            style={[
                              s.permText,
                              {
                                color:
                                  p.permission === 'write'
                                    ? theme.accent
                                    : theme.primary,
                              },
                            ]}
                          >
                            {p.permission === 'write'
                              ? fr
                                ? 'Modif.'
                                : 'Edit'
                              : fr
                              ? 'Lecture'
                              : 'Read'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Permission Legend */}
              {hasLinkedPlayers ? (
                <View style={s.legendRow}>
                  <View style={s.legendItem}>
                    <MaterialIcons name="visibility" size={12} color={theme.primary} />
                    <Text style={s.legendText}>
                      {fr ? 'Lecture = voir le match' : 'Read = view the match'}
                    </Text>
                  </View>
                  <View style={s.legendItem}>
                    <MaterialIcons name="edit" size={12} color={theme.accent} />
                    <Text style={s.legendText}>
                      {fr ? 'Modif. = voir et modifier' : 'Edit = view and modify'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Non-participant Warning */}
              {showNonParticipantWarning ? (
                <View style={s.warningBanner}>
                  <View style={s.warningIconBg}>
                    <MaterialIcons name="warning" size={18} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.warningTitle}>
                      {fr ? 'Joueur(s) non-participant(s)' : 'Non-participant player(s)'}
                    </Text>
                    <Text style={s.warningText}>
                      {nonParticipantNames.join(', ')}{' '}
                      {fr
                        ? 'ne fait pas partie de ce match. Ses stats et ELO ne seront PAS mis a jour.'
                        : 'is not part of this match. Their stats and ELO will NOT be updated.'}
                    </Text>
                    <View style={s.warningActions}>
                      <Pressable
                        style={s.warningCancelBtn}
                        onPress={() => setShowNonParticipantWarning(false)}
                      >
                        <Text style={s.warningCancelText}>{fr ? 'Modifier' : 'Edit'}</Text>
                      </Pressable>
                      <Pressable
                        style={s.warningConfirmBtn}
                        onPress={() => {
                          setShowNonParticipantWarning(false);
                          doSend();
                        }}
                      >
                        <Text style={s.warningConfirmText}>{fr ? 'Envoyer quand meme' : 'Send anyway'}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Step 1 Actions */}
              <View style={s.actions}>
                <Pressable style={s.skipBtn} onPress={() => setStep(2)}>
                  <MaterialIcons name="link" size={16} color={theme.textSecondary} />
                  <Text style={s.skipText}>
                    {fr ? 'Options avancees' : 'Advanced'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.sendBtn, selectedCount === 0 && s.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={selectedCount === 0 || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={18} color="#FFF" />
                      <Text style={s.sendText}>
                        {fr
                          ? `Envoyer (${selectedCount})`
                          : `Send (${selectedCount})`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              {/* Step 2: Public link / QR code */}
              <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
                <View style={s.step2Section}>
                  <View style={s.step2Header}>
                    <MaterialIcons name="public" size={18} color={theme.primary} />
                    <Text style={s.step2Title}>{fr ? 'Lien public' : 'Public link'}</Text>
                  </View>
                  <Text style={s.step2Desc}>
                    {fr
                      ? 'Genere un lien accessible par toute personne qui le recoit (aucun compte requis).'
                      : 'Generate a link accessible to anyone who receives it (no account required).'}
                  </Text>

                  {/* Permission toggle */}
                  <View style={s.permTogglePill}>
                    <Pressable
                      style={[s.permToggleBtn, publicLinkPermission === 'read' && s.permToggleBtnActive]}
                      onPress={() => { Haptics.selectionAsync(); setPublicLinkPermission('read'); setPublicLinkCode(null); }}
                    >
                      <MaterialIcons name="visibility" size={13} color={publicLinkPermission === 'read' ? '#FFF' : theme.textSecondary} />
                      <Text style={[s.permToggleBtnText, publicLinkPermission === 'read' && { color: '#FFF' }]}>
                        {fr ? 'Lecture' : 'Read'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[s.permToggleBtn, publicLinkPermission === 'write' && s.permToggleBtnActiveAccent]}
                      onPress={() => { Haptics.selectionAsync(); setPublicLinkPermission('write'); setPublicLinkCode(null); }}
                    >
                      <MaterialIcons name="edit" size={13} color={publicLinkPermission === 'write' ? '#FFF' : theme.textSecondary} />
                      <Text style={[s.permToggleBtnText, publicLinkPermission === 'write' && { color: '#FFF' }]}>
                        {fr ? 'Modification' : 'Edit'}
                      </Text>
                    </Pressable>
                  </View>

                  {!publicLinkCode ? (
                    <Pressable style={s.genLinkBtn} onPress={generatePublicLink} disabled={publicLinkLoading}>
                      {publicLinkLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <MaterialIcons name="link" size={18} color="#FFF" />
                          <Text style={s.genLinkBtnText}>
                            {fr ? 'Generer un lien' : 'Generate link'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : (
                    <>
                      <View style={s.linkResultCard}>
                        <View style={s.linkCodeRow}>
                          <Text style={s.linkCodeText} numberOfLines={1}>{publicLinkCode}</Text>
                          <Pressable style={s.linkCopyBtn} onPress={copyPublicLink}>
                            <MaterialIcons name="content-copy" size={16} color={theme.primary} />
                          </Pressable>
                        </View>
                        <View style={s.linkQrWrap}>
                          <QRCode
                            value={buildAppDownloadLink({ shareCode: publicLinkCode })}
                            size={140}
                            color={theme.primary}
                            backgroundColor="#FFFFFF"
                          />
                        </View>
                        <Text style={s.linkQrHint}>
                          {fr ? 'Scannez pour ouvrir dans l\'app' : 'Scan to open in the app'}
                        </Text>
                      </View>
                      <Pressable style={s.linkShareBtn} onPress={sharePublicLink}>
                        <MaterialIcons name="ios-share" size={16} color="#FFF" />
                        <Text style={s.linkShareBtnText}>{fr ? 'Partager' : 'Share'}</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </ScrollView>

              {/* Step 2 Actions */}
              <View style={s.actions}>
                {hasLinkedPlayers ? (
                  <Pressable style={s.skipBtn} onPress={() => setStep(1)}>
                    <MaterialIcons name="arrow-back" size={16} color={theme.textSecondary} />
                    <Text style={s.skipText}>
                      {fr ? 'Retour' : 'Back'}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable style={[s.sendBtn, { flex: hasLinkedPlayers ? 2 : 1 }]} onPress={onClose}>
                  <MaterialIcons name="check" size={18} color="#FFF" />
                  <Text style={s.sendText}>{fr ? 'Terminer' : 'Done'}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  headerSub: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: theme.backgroundSecondary,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  sentWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  sentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.success,
  },
  sentSub: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  playerList: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 14,
    padding: 12,
  },
  playerRowDisabled: {
    opacity: 0.5,
  },
  playerCheckbox: {
    padding: 2,
  },
  playerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  playerEmail: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 1,
  },
  permBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  permText: {
    fontSize: 12,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 11,
    color: theme.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    marginTop: 14,
  },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.backgroundSecondary,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  sendBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.primary,
  },
  sendBtnDisabled: {
    backgroundColor: theme.textMuted,
    opacity: 0.5,
  },
  sendText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  warningIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 3,
  },
  warningText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 17,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  warningCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D97706',
  },
  warningCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  warningConfirmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#D97706',
    borderRadius: 10,
  },
  warningConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  // Step 2 unified flow styles
  stepIndicator: { flexDirection: 'row', gap: 4, marginRight: 8, alignItems: 'center' },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.border },
  stepDotActive: { backgroundColor: theme.primary, width: 12 },
  detectionBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, padding: 10, backgroundColor: '#22C55E10', borderRadius: 10, borderWidth: 1, borderColor: '#22C55E30' },
  detectionBannerIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#22C55E15', alignItems: 'center', justifyContent: 'center' },
  detectionBannerText: { flex: 1, fontSize: 11.5, color: '#166534', fontWeight: '600', lineHeight: 16 },
  step2Section: { paddingTop: 16, gap: 10 },
  step2Header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  step2Title: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
  step2Desc: { fontSize: 12, color: theme.textSecondary, lineHeight: 17, marginBottom: 6 },
  permTogglePill: { flexDirection: 'row', backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 3, marginBottom: 10 },
  permToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  permToggleBtnActive: { backgroundColor: theme.primary },
  permToggleBtnActiveAccent: { backgroundColor: theme.accent },
  permToggleBtnText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
  genLinkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 14 },
  genLinkBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  linkResultCard: { backgroundColor: theme.backgroundSecondary, borderRadius: 14, padding: 14, alignItems: 'center', gap: 12 },
  linkCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, width: '100%' },
  linkCodeText: { flex: 1, fontSize: 15, fontWeight: '800', color: theme.primary, letterSpacing: 1 },
  linkCopyBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  linkQrWrap: { padding: 10, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  linkQrHint: { fontSize: 11, color: theme.textMuted, fontStyle: 'italic' },
  linkShareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, backgroundColor: theme.accent, paddingVertical: 12, borderRadius: 12 },
  linkShareBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
