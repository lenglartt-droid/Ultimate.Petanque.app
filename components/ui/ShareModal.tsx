import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  ScrollView,
  Switch,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import { createShareLink, ShareItemType, AssociatedItem } from '@/services/shareService';
import { useLanguage } from '@/hooks/useLanguage';
import { useApp } from '@/contexts/AppContext';
import QRCode from 'react-native-qrcode-svg';
import { config } from '@/constants/config';

const TYPE_CONFIG: Record<ShareItemType, { labelKey: string; icon: string; color: string; gradient: [string, string, string] }> = {
  player: { labelKey: 'playerLabelUpper', icon: 'person', color: '#2563EB', gradient: ['#1D4ED8', '#2563EB', '#3B82F6'] },
  club: { labelKey: 'clubLabelUpper', icon: 'home', color: '#D97706', gradient: ['#B45309', '#D97706', '#F59E0B'] },
  terrain: { labelKey: 'terrainLabelUpper', icon: 'landscape', color: '#059669', gradient: ['#047857', '#059669', '#10B981'] },
  tournament: { labelKey: 'tournamentLabelUpper', icon: 'emoji-events', color: '#CA8A04', gradient: ['#A16207', '#CA8A04', '#EAB308'] },
  match: { labelKey: 'matchLabelUpper', icon: 'sports', color: '#2563EB', gradient: ['#1E40AF', '#2563EB', '#60A5FA'] },
  challenge: { labelKey: 'challengeLabelUpper', icon: 'flag', color: '#EA580C', gradient: ['#C2410C', '#EA580C', '#F97316'] },
};

const TYPE_LOWER_KEY: Record<ShareItemType, string> = {
  player: 'playerLabel', club: 'clubLabel', terrain: 'terrainLabel',
  tournament: 'tournamentLabel', match: 'matchLabel', challenge: 'challengeLabel',
};

type ExpirationOption = 'never' | '1day' | '1week' | '1month';
type ShareStep = 'options' | 'expiration' | 'associated' | 'result';

const EXPIRATION_OPTIONS: { key: ExpirationOption; labelKey: string; icon: string }[] = [
  { key: 'never', labelKey: 'expirationNever', icon: 'all-inclusive' },
  { key: '1day', labelKey: 'expiration1Day', icon: 'schedule' },
  { key: '1week', labelKey: 'expiration1Week', icon: 'date-range' },
  { key: '1month', labelKey: 'expiration1Month', icon: 'calendar-today' },
];

function computeExpiresAt(opt: ExpirationOption): string | null {
  if (opt === 'never') return null;
  const d = new Date();
  if (opt === '1day') d.setDate(d.getDate() + 1);
  else if (opt === '1week') d.setDate(d.getDate() + 7);
  else if (opt === '1month') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  itemType: ShareItemType;
  itemId: string;
  itemName: string;
  forceReadOnly?: boolean;
  /** Optional: show contact visibility toggle */
  showContactToggle?: boolean;
  contactVisible?: boolean;
  onToggleContact?: (val: boolean) => void;
}

export default function ShareModal({ visible, onClose, itemType, itemId, itemName, forceReadOnly = false, showContactToggle, contactVisible, onToggleContact }: ShareModalProps) {
  const { t, language } = useLanguage();
  const { getPlayerById, getClubById, getTerrainById, getTournamentById, getMatchById, challenges } = useApp();
  const fr = language === 'fr';

  const [step, setStep] = useState<ShareStep>('options');
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiration, setExpiration] = useState<ExpirationOption>('never');
  const [expiresAtDate, setExpiresAtDate] = useState<Date | null>(null);
  const [countdownNow, setCountdownNow] = useState(Date.now());

  // Associated items (player sharing)
  const [associatedClub, setAssociatedClub] = useState<{ id: string; name: string } | null>(null);
  const [associatedTerrain, setAssociatedTerrain] = useState<{ id: string; name: string } | null>(null);
  const [includeClub, setIncludeClub] = useState(true);
  const [includeTerrain, setIncludeTerrain] = useState(true);
  const [sharedAssociatedItems, setSharedAssociatedItems] = useState<AssociatedItem[]>([]);

  // Pending share action after code generation
  const [pendingAction, setPendingAction] = useState<'native' | 'code' | 'invitation' | 'qr' | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const typeConfig = TYPE_CONFIG[itemType];
  const typeLabelLower = t('shareModal', TYPE_LOWER_KEY[itemType]);

  // Countdown timer
  React.useEffect(() => {
    if (!expiresAtDate) return;
    const interval = setInterval(() => setCountdownNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [expiresAtDate]);

  const expirationCountdown = useMemo(() => {
    if (!expiresAtDate) return null;
    const diff = expiresAtDate.getTime() - countdownNow;
    if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { expired: false, days, hours, minutes };
  }, [expiresAtDate, countdownNow]);

  // Build preview subtitle
  const previewSubtitle = useMemo(() => {
    if (itemType === 'player') {
      const p = getPlayerById(itemId);
      return p ? [p.role, p.club, p.country].filter(Boolean).join(' \u2022 ') : '';
    }
    if (itemType === 'club') {
      const c = getClubById(itemId);
      return c ? [c.city, c.country, c.membersCount ? `${c.membersCount} ${fr ? 'membres' : 'members'}` : ''].filter(Boolean).join(' \u2022 ') : '';
    }
    if (itemType === 'terrain') {
      const tr = getTerrainById(itemId);
      return tr ? [tr.type, tr.city, tr.clubName].filter(Boolean).join(' \u2022 ') : '';
    }
    if (itemType === 'tournament') {
      const to = getTournamentById(itemId);
      if (!to) return '';
      const dateStr = to.date ? new Date(to.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : '';
      return [to.format, to.location?.city, dateStr].filter(Boolean).join(' \u2022 ');
    }
    if (itemType === 'match') {
      const m = getMatchById(itemId) as any;
      if (!m) return '';
      const scoreA = m.teamA?.score ?? 0;
      const scoreB = m.teamB?.score ?? 0;
      const dateStr = m.date ? new Date(m.date).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : '';
      return [`${scoreA}-${scoreB}`, m.format, dateStr].filter(Boolean).join(' \u2022 ');
    }
    if (itemType === 'challenge') {
      const ch = challenges.find((c: any) => c.id === itemId) as any;
      if (!ch) return '';
      const typeName = ch.type === '10_tirs' ? '10 Tirs' : ch.type === '10_tirs_sautee' ? '10 Tirs sautee' : 'Precision';
      return [typeName, ch.mode === 'duel' ? 'Duel' : 'Solo'].filter(Boolean).join(' \u2022 ');
    }
    return '';
  }, [itemType, itemId, fr, getPlayerById, getClubById, getTerrainById, getTournamentById, getMatchById, challenges]);

  // Build share invitation message
  const buildShareMessage = useCallback(() => {
    let msg = fr
      ? `Je partage avec toi ma fiche ${typeLabelLower} "${itemName}" sur Ultimate Petanque !`
      : `I am sharing my ${typeLabelLower} "${itemName}" on Ultimate Petanque!`;
    if (shareCode) msg += `\n${fr ? 'Code' : 'Code'}: ${shareCode}`;
    if (previewSubtitle) msg += `\n${previewSubtitle}`;
    if (sharedAssociatedItems.length > 0) {
      sharedAssociatedItems.forEach(ai => {
        const name = ai.type === 'club' ? associatedClub?.name : associatedTerrain?.name;
        if (name) msg += `\n+ ${ai.type === 'club' ? 'Club' : 'Terrain'}: ${name}`;
      });
    }
    msg += `\n\n${fr ? 'Telecharge l\'app' : 'Download the app'}: ${config.appDownloadUrl}`;
    return msg;
  }, [fr, typeLabelLower, itemName, shareCode, previewSubtitle, sharedAssociatedItems, associatedClub, associatedTerrain]);

  // Reset on open
  React.useEffect(() => {
    if (visible) {
      setStep('options');
      setShareCode(null);
      setError(null);
      setCopied(false);
      setIsGenerating(false);
      setExpiration('never');
      setExpiresAtDate(null);
      setAssociatedClub(null);
      setAssociatedTerrain(null);
      setIncludeClub(true);
      setIncludeTerrain(true);
      setSharedAssociatedItems([]);
      setPendingAction(null);
    }
  }, [visible, itemId, itemType]);

  // Detect associated items for player
  const detectAssociatedItems = useCallback(() => {
    if (itemType !== 'player') return { club: null, terrain: null };
    const player = getPlayerById(itemId);
    if (!player) return { club: null, terrain: null };
    let club: { id: string; name: string } | null = null;
    let terrain: { id: string; name: string } | null = null;
    if (player.clubId) { const c = getClubById(player.clubId); if (c) club = { id: c.id, name: c.name }; }
    if (player.terrainId) { const tr = getTerrainById(player.terrainId); if (tr) terrain = { id: tr.id, name: tr.name }; }
    return { club, terrain };
  }, [itemType, itemId, getPlayerById, getClubById, getTerrainById]);

  // Core generate function
  const doGenerateShareCode = useCallback(async (associatedItems: AssociatedItem[], expiresAtISO?: string | null) => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await createShareLink(itemType, itemId, 'read', associatedItems.length > 0 ? associatedItems : undefined, expiresAtISO);
      if (result.error) { setError(result.error); setIsGenerating(false); return; }
      setShareCode(result.shareCode);
      setSharedAssociatedItems(associatedItems);
      if (expiresAtISO) setExpiresAtDate(new Date(expiresAtISO));
      else setExpiresAtDate(null);
      setStep('result');
      scrollToTop();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message || t('shareModal', 'errorCreating'));
    } finally {
      setIsGenerating(false);
    }
  }, [itemType, itemId, t]);

  // Scroll to top helper
  const scrollToTop = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  }, []);

  // Initiate share flow: check for associated items, then generate
  const initiateGenerate = useCallback(async (action: 'native' | 'code' | 'invitation' | 'qr') => {
    setPendingAction(action);
    // For player, check associated items
    if (itemType === 'player') {
      const { club, terrain } = detectAssociatedItems();
      if (club || terrain) {
        setAssociatedClub(club);
        setAssociatedTerrain(terrain);
        setIncludeClub(!!club);
        setIncludeTerrain(!!terrain);
        setStep('associated');
        scrollToTop();
        return;
      }
    }
    // Show expiration step
    setStep('expiration');
    scrollToTop();
  }, [itemType, detectAssociatedItems, scrollToTop]);

  const handleConfirmAssociated = useCallback(() => {
    setStep('expiration');
    scrollToTop();
  }, [scrollToTop]);

  const handleSkipAssociated = useCallback(() => {
    setIncludeClub(false);
    setIncludeTerrain(false);
    setStep('expiration');
    scrollToTop();
  }, [scrollToTop]);

  const handleConfirmExpiration = useCallback(async () => {
    const items: AssociatedItem[] = [];
    if (includeClub && associatedClub) items.push({ type: 'club', id: associatedClub.id });
    if (includeTerrain && associatedTerrain) items.push({ type: 'terrain', id: associatedTerrain.id });
    await doGenerateShareCode(items, computeExpiresAt(expiration));
  }, [includeClub, includeTerrain, associatedClub, associatedTerrain, expiration, doGenerateShareCode]);

  // Execute the pending share action after code is generated
  React.useEffect(() => {
    if (step === 'result' && shareCode && pendingAction) {
      const timer = setTimeout(() => {
        if (pendingAction === 'native') handleNativeShare();
        else if (pendingAction === 'code') handleCopyCode();
        else if (pendingAction === 'invitation') handleCopyInvitation();
        // qr: just show the result with QR
        setPendingAction(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [step, shareCode, pendingAction]);

  const handleCopyCode = useCallback(async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(shareCode);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  }, [shareCode]);

  const handleNativeShare = useCallback(async () => {
    if (!shareCode) return;
    try { await Share.share({ message: buildShareMessage(), title: `${fr ? 'Partage' : 'Share'} - ${itemName}` }); } catch {}
  }, [shareCode, buildShareMessage, fr, itemName]);

  const handleCopyInvitation = useCallback(async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(buildShareMessage());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [shareCode, buildShareMessage]);

  const handleClose = useCallback(() => {
    setShareCode(null);
    setError(null);
    setCopied(false);
    setSharedAssociatedItems([]);
    setExpiresAtDate(null);
    setPendingAction(null);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>{t('shareModal', 'shareTitle')}</Text>
            <Pressable style={s.closeBtn} onPress={handleClose}>
              <MaterialIcons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView ref={scrollRef} style={s.scrollView} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false} nestedScrollEnabled>

            {/* ===== PREVIEW CARD (always visible) ===== */}
            <LinearGradient colors={typeConfig.gradient} style={s.previewGradient}>
              <MaterialIcons name={typeConfig.icon as any} size={22} color="rgba(255,255,255,0.85)" />
              <View style={{ flex: 1 }}>
                <Text style={s.previewTitle} numberOfLines={1}>{itemName}</Text>
                {previewSubtitle ? <Text style={s.previewSub} numberOfLines={1}>{previewSubtitle}</Text> : null}
              </View>
              {shareCode ? (
                <View style={s.previewCodeBadge}>
                  <Text style={s.previewCodeText}>{shareCode}</Text>
                </View>
              ) : (
                <View style={s.previewTypeBadge}>
                  <Text style={s.previewTypeText}>{t('shareModal', TYPE_LOWER_KEY[itemType])}</Text>
                </View>
              )}
            </LinearGradient>

            {/* ===== STEP: OPTIONS (share mode selection) ===== */}
            {step === 'options' ? (
              <View>
                {/* Contact visibility toggle */}
                {showContactToggle ? (
                  <Animated.View entering={FadeInDown.duration(250)} style={s.contactToggleCard}>
                    <View style={[s.contactToggleIcon, { backgroundColor: (contactVisible ? '#10B981' : '#94A3B8') + '15' }]}>
                      <MaterialIcons name={contactVisible ? 'contact-phone' : 'phone-disabled'} size={18} color={contactVisible ? '#10B981' : '#94A3B8'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.contactToggleLabel}>{fr ? 'Contacts visibles' : 'Contacts visible'}</Text>
                      <Text style={s.contactToggleDesc}>{contactVisible ? (fr ? 'Email et telephone visibles' : 'Email and phone visible') : (fr ? 'Contacts masques pour le destinataire' : 'Contacts hidden from recipient')}</Text>
                    </View>
                    <Switch
                      value={contactVisible ?? false}
                      onValueChange={(v) => { Haptics.selectionAsync(); onToggleContact?.(v); }}
                      trackColor={{ false: '#E2E8F0', true: '#10B98160' }}
                      thumbColor={contactVisible ? '#10B981' : '#94A3B8'}
                    />
                  </Animated.View>
                ) : null}

                {/* Share options */}
                <Animated.View entering={FadeInDown.duration(250).delay(50)} style={s.optionsList}>
                  <Pressable style={({ pressed }) => [s.optionCard, pressed && s.optionCardPressed]} onPress={() => initiateGenerate('native')}>
                    <View style={[s.optionIcon, { backgroundColor: typeConfig.color + '12' }]}>
                      <MaterialIcons name="share" size={22} color={typeConfig.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>{fr ? 'Partager via...' : 'Share via...'}</Text>
                      <Text style={s.optionDesc}>{fr ? 'WhatsApp, SMS, e-mail, etc.' : 'WhatsApp, SMS, email, etc.'}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                  </Pressable>

                  <Pressable style={({ pressed }) => [s.optionCard, pressed && s.optionCardPressed]} onPress={() => initiateGenerate('code')}>
                    <View style={[s.optionIcon, { backgroundColor: '#F59E0B12' }]}>
                      <MaterialIcons name="content-copy" size={22} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>{fr ? 'Copier le code' : 'Copy code'}</Text>
                      <Text style={s.optionDesc}>{fr ? 'Generer et copier le code de partage' : 'Generate and copy the share code'}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                  </Pressable>

                  <Pressable style={({ pressed }) => [s.optionCard, pressed && s.optionCardPressed]} onPress={() => initiateGenerate('invitation')}>
                    <View style={[s.optionIcon, { backgroundColor: '#3B82F612' }]}>
                      <MaterialIcons name="description" size={22} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>{fr ? 'Copier l\'invitation' : 'Copy invitation'}</Text>
                      <Text style={s.optionDesc}>{fr ? 'Message complet avec details' : 'Full message with details'}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                  </Pressable>

                  <Pressable style={({ pressed }) => [s.optionCard, pressed && s.optionCardPressed]} onPress={() => initiateGenerate('qr')}>
                    <View style={[s.optionIcon, { backgroundColor: '#22C55E12' }]}>
                      <MaterialIcons name="qr-code-2" size={22} color="#22C55E" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>{fr ? 'QR Code de partage' : 'Share QR Code'}</Text>
                      <Text style={s.optionDesc}>{fr ? 'Generer un QR code scannable' : 'Generate a scannable QR code'}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#CBD5E1" />
                  </Pressable>
                </Animated.View>

                {/* Read-only info */}
                <View style={s.infoRow}>
                  <MaterialIcons name="visibility" size={14} color={typeConfig.color} />
                  <Text style={s.infoText}>{t('shareModal', 'autoSaveDesc')}</Text>
                </View>
              </View>
            ) : null}

            {/* ===== STEP: ASSOCIATED ITEMS (player only) ===== */}
            {step === 'associated' ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View style={s.stepCard}>
                  <View style={s.stepHeader}>
                    <MaterialIcons name="link" size={20} color={typeConfig.color} />
                    <Text style={s.stepTitle}>{t('shareModal', 'alsoShareAssociated')}</Text>
                  </View>
                  <Text style={s.stepDesc}>{t('shareModal', 'alsoShareAssociatedDesc')}</Text>

                  {associatedClub ? (
                    <Pressable style={[s.assocItem, includeClub && s.assocItemActive]} onPress={() => { Haptics.selectionAsync(); setIncludeClub(!includeClub); }}>
                      <View style={[s.assocItemIcon, { backgroundColor: '#D9770615' }]}><MaterialIcons name="home" size={20} color="#D97706" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.assocItemLabel}>{t('shareModal', 'associatedClub')}</Text>
                        <Text style={s.assocItemName} numberOfLines={1}>{associatedClub.name}</Text>
                      </View>
                      <View style={[s.checkbox, includeClub && s.checkboxActive]}>{includeClub ? <MaterialIcons name="check" size={14} color="#FFF" /> : null}</View>
                    </Pressable>
                  ) : null}

                  {associatedTerrain ? (
                    <Pressable style={[s.assocItem, includeTerrain && s.assocItemActive]} onPress={() => { Haptics.selectionAsync(); setIncludeTerrain(!includeTerrain); }}>
                      <View style={[s.assocItemIcon, { backgroundColor: '#10B98115' }]}><MaterialIcons name="sports-soccer" size={20} color="#10B981" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.assocItemLabel}>{t('shareModal', 'associatedTerrain')}</Text>
                        <Text style={s.assocItemName} numberOfLines={1}>{associatedTerrain.name}</Text>
                      </View>
                      <View style={[s.checkbox, includeTerrain && s.checkboxActive]}>{includeTerrain ? <MaterialIcons name="check" size={14} color="#FFF" /> : null}</View>
                    </Pressable>
                  ) : null}

                  <View style={s.stepActions}>
                    <Pressable style={s.stepSecondaryBtn} onPress={handleSkipAssociated}>
                      <Text style={s.stepSecondaryBtnText}>{t('shareModal', 'sharePlayerOnly')}</Text>
                    </Pressable>
                    <Pressable style={[s.stepPrimaryBtn, { backgroundColor: typeConfig.color }]} onPress={handleConfirmAssociated}>
                      <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
                      <Text style={s.stepPrimaryBtnText}>{fr ? 'Continuer' : 'Continue'}</Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            ) : null}

            {/* ===== STEP: EXPIRATION ===== */}
            {step === 'expiration' ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View style={s.stepCard}>
                  <View style={s.stepHeader}>
                    <MaterialIcons name="timer" size={20} color={typeConfig.color} />
                    <Text style={s.stepTitle}>{t('shareModal', 'expirationLabel')}</Text>
                  </View>
                  <Text style={s.stepDesc}>{fr ? 'Choisissez la duree de validite du code de partage' : 'Choose how long the share code should be valid'}</Text>

                  <View style={s.expirationGrid}>
                    {EXPIRATION_OPTIONS.map((opt) => {
                      const isActive = expiration === opt.key;
                      return (
                        <Pressable key={opt.key} style={[s.expirationChip, isActive && { backgroundColor: typeConfig.color, borderColor: typeConfig.color }]} onPress={() => { Haptics.selectionAsync(); setExpiration(opt.key); }}>
                          <MaterialIcons name={opt.icon as any} size={16} color={isActive ? '#FFF' : '#64748B'} />
                          <Text style={[s.expirationChipText, isActive && { color: '#FFF' }]}>{t('shareModal', opt.labelKey)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {error ? (
                    <View style={s.errorBox}>
                      <MaterialIcons name="error" size={16} color="#EF4444" />
                      <Text style={s.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={s.stepActions}>
                    <Pressable style={s.stepSecondaryBtn} onPress={() => setStep(itemType === 'player' && (associatedClub || associatedTerrain) ? 'associated' : 'options')}>
                      <MaterialIcons name="arrow-back" size={16} color="#64748B" />
                      <Text style={s.stepSecondaryBtnText}>{fr ? 'Retour' : 'Back'}</Text>
                    </Pressable>
                    <Pressable style={[s.stepPrimaryBtn, { backgroundColor: typeConfig.color }, isGenerating && { opacity: 0.6 }]} onPress={handleConfirmExpiration} disabled={isGenerating}>
                      {isGenerating ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="link" size={18} color="#FFF" /><Text style={s.stepPrimaryBtnText}>{t('shareModal', 'generateCode')}</Text></>}
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            ) : null}

            {/* ===== STEP: RESULT ===== */}
            {step === 'result' && shareCode ? (
              <View>
                {/* Code display */}
                <Animated.View entering={FadeInDown.duration(300)} style={s.codeCard}>
                  <View style={s.codeCardRow}>
                    <View style={[s.codeSuccessIcon, { backgroundColor: '#10B98115' }]}>
                      <MaterialIcons name="check-circle" size={24} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.codeCardTitle}>{t('shareModal', 'codeCreated')}</Text>
                      <Text style={s.codeCardSub}>{t('shareModal', 'shareCodeAutoSaveDesc')}</Text>
                    </View>
                  </View>
                  <View style={s.codeDisplay}>
                    <Text style={[s.codeText, { color: typeConfig.color }]}>{shareCode}</Text>
                    <Pressable style={[s.codeCopyBtn, { backgroundColor: typeConfig.color + '12' }]} onPress={handleCopyCode}>
                      <MaterialIcons name={copied ? 'check' : 'content-copy'} size={18} color={copied ? '#10B981' : typeConfig.color} />
                      <Text style={[s.codeCopyBtnText, { color: copied ? '#10B981' : typeConfig.color }]}>{copied ? t('shareModal', 'copied') : t('shareModal', 'copy')}</Text>
                    </Pressable>
                  </View>

                  {/* Included items */}
                  {sharedAssociatedItems.length > 0 ? (
                    <View style={s.includedList}>
                      {sharedAssociatedItems.map(ai => {
                        const conf = ai.type === 'club' ? { icon: 'home' as const, color: '#D97706', name: associatedClub?.name } : { icon: 'sports-soccer' as const, color: '#10B981', name: associatedTerrain?.name };
                        return (
                          <View key={ai.type} style={s.includedRow}>
                            <MaterialIcons name={conf.icon} size={14} color={conf.color} />
                            <Text style={s.includedRowText}>{conf.name}</Text>
                            <View style={[s.includedBadge, { backgroundColor: conf.color + '12' }]}><Text style={[s.includedBadgeText, { color: conf.color }]}>{ai.type === 'club' ? 'Club' : 'Terrain'}</Text></View>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}

                  {/* Expiration indicator */}
                  {expiresAtDate ? (
                    <View style={[s.expirationIndicator, { backgroundColor: typeConfig.color + '08', borderColor: typeConfig.color + '18' }]}>
                      <MaterialIcons name="timer" size={14} color={typeConfig.color} />
                      {expirationCountdown && !expirationCountdown.expired ? (
                        <Text style={[s.expirationIndicatorText, { color: typeConfig.color }]}>
                          {t('shareModal', 'expiresIn')} {expirationCountdown.days > 0 ? `${expirationCountdown.days}${t('shareModal', 'daysShort')} ` : ''}{expirationCountdown.hours}{t('shareModal', 'hoursShort')}{expirationCountdown.days === 0 ? ` ${expirationCountdown.minutes}${t('shareModal', 'minutesShort')}` : ''}
                        </Text>
                      ) : (
                        <Text style={[s.expirationIndicatorText, { color: '#EF4444' }]}>{t('shareModal', 'expired')}</Text>
                      )}
                    </View>
                  ) : (
                    <View style={[s.expirationIndicator, { backgroundColor: '#10B98108', borderColor: '#10B98118' }]}>
                      <MaterialIcons name="all-inclusive" size={14} color="#10B981" />
                      <Text style={[s.expirationIndicatorText, { color: '#10B981' }]}>{t('shareModal', 'noExpiration')}</Text>
                    </View>
                  )}
                </Animated.View>

                {/* QR Code */}
                <Animated.View entering={FadeInDown.duration(300).delay(100)} style={s.qrSection}>
                  <View style={s.qrHeader}>
                    <MaterialIcons name="qr-code-2" size={16} color={typeConfig.color} />
                    <Text style={s.qrTitle}>{fr ? 'QR Code de partage' : 'Share QR Code'}</Text>
                  </View>
                  <View style={s.qrBody}>
                    <View style={[s.qrWrapper, { borderColor: typeConfig.color + '20' }]}>
                      <QRCode value={`${config.appDownloadUrl}?share=${shareCode}`} size={130} color={typeConfig.color} backgroundColor="#FFFFFF" />
                    </View>
                    <Text style={s.qrHint}>{fr ? 'Scannez pour acceder a la fiche' : 'Scan to access the card'}</Text>
                  </View>
                </Animated.View>

                {/* Share action buttons */}
                <Animated.View entering={FadeIn.duration(200).delay(200)} style={s.resultActions}>
                  <Pressable style={({ pressed }) => [s.resultActionBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]} onPress={handleNativeShare}>
                    <View style={[s.resultActionIcon, { backgroundColor: typeConfig.color + '12' }]}><MaterialIcons name="share" size={20} color={typeConfig.color} /></View>
                    <Text style={s.resultActionText}>{fr ? 'Partager' : 'Share'}</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [s.resultActionBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]} onPress={handleCopyCode}>
                    <View style={[s.resultActionIcon, { backgroundColor: '#F59E0B12' }]}><MaterialIcons name="content-copy" size={20} color="#F59E0B" /></View>
                    <Text style={s.resultActionText}>{t('shareModal', 'copyCode')}</Text>
                  </Pressable>
                  <Pressable style={({ pressed }) => [s.resultActionBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]} onPress={handleCopyInvitation}>
                    <View style={[s.resultActionIcon, { backgroundColor: '#3B82F612' }]}><MaterialIcons name="description" size={20} color="#3B82F6" /></View>
                    <Text style={s.resultActionText}>{fr ? 'Invitation' : 'Invitation'}</Text>
                  </Pressable>
                </Animated.View>

                {/* Tip */}
                <View style={s.tipRow}>
                  <MaterialIcons name="lightbulb" size={14} color="#F59E0B" />
                  <Text style={s.tipText}>{t('shareModal', 'infoTextAutoSave')}</Text>
                </View>
              </View>
            ) : null}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#FFF' },
  sheet: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 48, flexGrow: 1 },

  // Preview gradient
  previewGradient: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginHorizontal: 16, marginTop: 16, borderRadius: 16 },
  previewTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  previewSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  previewCodeBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  previewCodeText: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 1.5 },
  previewTypeBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  previewTypeText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Contact toggle
  contactToggleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 16, backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  contactToggleIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactToggleLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  contactToggleDesc: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  // Options list
  optionsList: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  optionCardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  optionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  optionDesc: { fontSize: 12, color: '#94A3B8', marginTop: 1 },

  // Info row
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  infoText: { flex: 1, fontSize: 11, color: '#94A3B8', lineHeight: 16 },

  // Step card (associated + expiration)
  stepCard: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1 },
  stepDesc: { fontSize: 13, color: '#64748B', lineHeight: 19, marginBottom: 16 },
  stepActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  stepSecondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9' },
  stepSecondaryBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  stepPrimaryBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  stepPrimaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Associated items
  assocItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  assocItemActive: { borderColor: '#2563EB30', backgroundColor: '#2563EB05' },
  assocItemIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  assocItemLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
  assocItemName: { fontSize: 15, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },

  // Expiration
  expirationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  expirationChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0' },
  expirationChipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  // Error
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { flex: 1, fontSize: 12, color: '#EF4444' },

  // Code card (result)
  codeCard: { marginHorizontal: 16, marginTop: 16, backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  codeCardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  codeSuccessIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  codeCardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  codeCardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  codeDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, gap: 10, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  codeText: { flex: 1, fontSize: 22, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  codeCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  codeCopyBtnText: { fontSize: 12, fontWeight: '700' },

  // Included
  includedList: { gap: 6, marginTop: 12 },
  includedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  includedRowText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0F172A' },
  includedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  includedBadgeText: { fontSize: 10, fontWeight: '700' },

  // Expiration indicator
  expirationIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 12 },
  expirationIndicatorText: { fontSize: 12, fontWeight: '600' },

  // QR
  qrSection: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  qrHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  qrTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  qrBody: { alignItems: 'center' },
  qrWrapper: { padding: 14, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 2 },
  qrHint: { fontSize: 11, color: '#94A3B8', marginTop: 10 },

  // Result actions
  resultActions: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 },
  resultActionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF', paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  resultActionIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resultActionText: { fontSize: 11, fontWeight: '600', color: '#0F172A' },

  // Tip
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginTop: 16, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' },
  tipText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },
});
