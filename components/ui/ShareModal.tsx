import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { createShareLink, ShareItemType, AssociatedItem } from '@/services/shareService';
import { useLanguage } from '@/hooks/useLanguage';
import { useApp } from '@/contexts/AppContext';
import QRCode from 'react-native-qrcode-svg';
import { config } from '@/constants/config';

const TYPE_CONFIG: Record<ShareItemType, { labelKey: string; icon: string; color: string }> = {
  player: { labelKey: 'playerLabelUpper', icon: 'person', color: theme.primary },
  club: { labelKey: 'clubLabelUpper', icon: 'home', color: theme.accent },
  terrain: { labelKey: 'terrainLabelUpper', icon: 'landscape', color: theme.success },
  tournament: { labelKey: 'tournamentLabelUpper', icon: 'emoji-events', color: theme.carreauColor },
  match: { labelKey: 'matchLabelUpper', icon: 'sports', color: theme.tirColor },
  challenge: { labelKey: 'challengeLabelUpper', icon: 'flag', color: theme.warning },
};

const TYPE_LOWER_KEY: Record<ShareItemType, string> = {
  player: 'playerLabel',
  club: 'clubLabel',
  terrain: 'terrainLabel',
  tournament: 'tournamentLabel',
  match: 'matchLabel',
  challenge: 'challengeLabel',
};

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  itemType: ShareItemType;
  itemId: string;
  itemName: string;
  forceReadOnly?: boolean;
}

export default function ShareModal({ visible, onClose, itemType, itemId, itemName, forceReadOnly = false }: ShareModalProps) {
  const { t } = useLanguage();
  const { getPlayerById, getClubById, getTerrainById } = useApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Associated items state (for player sharing)
  const [showAssociatedPrompt, setShowAssociatedPrompt] = useState(false);
  const [associatedClub, setAssociatedClub] = useState<{ id: string; name: string } | null>(null);
  const [associatedTerrain, setAssociatedTerrain] = useState<{ id: string; name: string } | null>(null);
  const [includeClub, setIncludeClub] = useState(true);
  const [includeTerrain, setIncludeTerrain] = useState(true);
  // Track what was included in the final share
  const [sharedAssociatedItems, setSharedAssociatedItems] = useState<AssociatedItem[]>([]);

  const typeConfig = TYPE_CONFIG[itemType];
  const typeLabel = t('shareModal', typeConfig.labelKey);
  const typeLabelLower = t('shareModal', TYPE_LOWER_KEY[itemType]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setShareCode(null);
      setError(null);
      setCopied(false);
      setIsGenerating(false);
      setShowAssociatedPrompt(false);
      setAssociatedClub(null);
      setAssociatedTerrain(null);
      setIncludeClub(true);
      setIncludeTerrain(true);
      setSharedAssociatedItems([]);
    }
  }, [visible, itemId, itemType]);

  // Detect associated club/terrain for player sharing
  const detectAssociatedItems = useCallback(() => {
    if (itemType !== 'player') return { club: null, terrain: null };
    const player = getPlayerById(itemId);
    if (!player) return { club: null, terrain: null };

    let club: { id: string; name: string } | null = null;
    let terrain: { id: string; name: string } | null = null;

    if (player.clubId) {
      const clubEntity = getClubById(player.clubId);
      if (clubEntity) {
        club = { id: clubEntity.id, name: clubEntity.name };
      }
    }
    if (player.terrainId) {
      const terrainEntity = getTerrainById(player.terrainId);
      if (terrainEntity) {
        terrain = { id: terrainEntity.id, name: terrainEntity.name };
      }
    }

    return { club, terrain };
  }, [itemType, itemId, getPlayerById, getClubById, getTerrainById]);

  const handleGenerate = useCallback(async () => {
    if (!itemId) {
      setError('Item ID is missing');
      return;
    }

    // For player type, check associated items first (before generating code)
    if (itemType === 'player' && !showAssociatedPrompt && !shareCode) {
      const { club, terrain } = detectAssociatedItems();
      if (club || terrain) {
        setAssociatedClub(club);
        setAssociatedTerrain(terrain);
        setIncludeClub(!!club);
        setIncludeTerrain(!!terrain);
        setShowAssociatedPrompt(true);
        return;
      }
    }

    // Generate single code (no associated items for non-player types)
    await generateShareCode([]);
  }, [itemType, itemId, showAssociatedPrompt, shareCode, detectAssociatedItems]);

  const generateShareCode = useCallback(async (associatedItems: AssociatedItem[]) => {
    setIsGenerating(true);
    setError(null);
    setShowAssociatedPrompt(false);

    try {
      const result = await createShareLink(itemType, itemId, 'read', associatedItems.length > 0 ? associatedItems : undefined);
      if (result.error) {
        setError(result.error);
        setIsGenerating(false);
        return;
      }

      setShareCode(result.shareCode);
      setSharedAssociatedItems(associatedItems);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.log('Share link creation error:', e);
      setError(e?.message || t('shareModal', 'errorCreating'));
    } finally {
      setIsGenerating(false);
    }
  }, [itemType, itemId, t]);

  const handleConfirmWithAssociated = useCallback(async () => {
    const items: AssociatedItem[] = [];
    if (includeClub && associatedClub) {
      items.push({ type: 'club', id: associatedClub.id });
    }
    if (includeTerrain && associatedTerrain) {
      items.push({ type: 'terrain', id: associatedTerrain.id });
    }
    await generateShareCode(items);
  }, [includeClub, includeTerrain, associatedClub, associatedTerrain, generateShareCode]);

  const handleSkipAssociated = useCallback(async () => {
    setIncludeClub(false);
    setIncludeTerrain(false);
    await generateShareCode([]);
  }, [generateShareCode]);

  const handleCopy = useCallback(async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(shareCode);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  }, [shareCode]);

  const handleShare = useCallback(async () => {
    if (!shareCode) return;
    let message = `${t('shareModal', 'shareMessage')} ${typeLabelLower} "${itemName}" ${t('shareModal', 'shareMessageSuffix')}\n\n${t('shareModal', 'shareMessageCode')} ${shareCode}`;

    // Mention included associated items
    if (sharedAssociatedItems.length > 0) {
      message += '\n';
      sharedAssociatedItems.forEach(ai => {
        const label = ai.type === 'club' ? t('shareModal', 'clubLabel') : t('shareModal', 'terrainLabel');
        const name = ai.type === 'club' ? associatedClub?.name : associatedTerrain?.name;
        if (name) message += `\n+ ${label} "${name}" ${t('shareModal', 'includedInShare')}`;
      });
    }

    try {
      await Share.share({
        message,
        title: `${t('shareModal', 'shareMessageTitle')} ${itemName}`,
      });
    } catch (e) {
      // User cancelled
    }
  }, [shareCode, typeLabelLower, itemName, sharedAssociatedItems, associatedClub, associatedTerrain, t]);

  const handleClose = useCallback(() => {
    setShareCode(null);
    setError(null);
    setCopied(false);
    setShowAssociatedPrompt(false);
    setSharedAssociatedItems([]);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <MaterialIcons name="close" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('shareModal', 'shareTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Item preview */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.itemPreview}>
            <View style={[styles.itemIcon, { backgroundColor: typeConfig.color + '15' }]}>
              <MaterialIcons name={typeConfig.icon as any} size={28} color={typeConfig.color} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{itemName}</Text>
              <Text style={styles.itemType}>{typeLabel}</Text>
            </View>
          </Animated.View>

          {/* Associated items prompt — shown BEFORE code generation */}
          {showAssociatedPrompt ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <View style={styles.associatedSection}>
                <View style={styles.associatedHeader}>
                  <MaterialIcons name="link" size={22} color={theme.primary} />
                  <Text style={styles.associatedTitle}>{t('shareModal', 'alsoShareAssociated')}</Text>
                </View>
                <Text style={styles.associatedDesc}>{t('shareModal', 'alsoShareAssociatedDesc')}</Text>

                {associatedClub ? (
                  <Pressable
                    style={[styles.associatedItem, includeClub && styles.associatedItemActive]}
                    onPress={() => { Haptics.selectionAsync(); setIncludeClub(!includeClub); }}
                  >
                    <View style={[styles.associatedItemIcon, { backgroundColor: theme.accent + '15' }]}>
                      <MaterialIcons name="home" size={20} color={theme.accent} />
                    </View>
                    <View style={styles.associatedItemInfo}>
                      <Text style={styles.associatedItemLabel}>{t('shareModal', 'associatedClub')}</Text>
                      <Text style={styles.associatedItemName} numberOfLines={1}>{associatedClub.name}</Text>
                    </View>
                    <View style={[styles.checkbox, includeClub && styles.checkboxActive]}>
                      {includeClub ? <MaterialIcons name="check" size={16} color="#FFF" /> : null}
                    </View>
                  </Pressable>
                ) : null}

                {associatedTerrain ? (
                  <Pressable
                    style={[styles.associatedItem, includeTerrain && styles.associatedItemActive]}
                    onPress={() => { Haptics.selectionAsync(); setIncludeTerrain(!includeTerrain); }}
                  >
                    <View style={[styles.associatedItemIcon, { backgroundColor: theme.success + '15' }]}>
                      <MaterialIcons name="sports-soccer" size={20} color={theme.success} />
                    </View>
                    <View style={styles.associatedItemInfo}>
                      <Text style={styles.associatedItemLabel}>{t('shareModal', 'associatedTerrain')}</Text>
                      <Text style={styles.associatedItemName} numberOfLines={1}>{associatedTerrain.name}</Text>
                    </View>
                    <View style={[styles.checkbox, includeTerrain && styles.checkboxActive]}>
                      {includeTerrain ? <MaterialIcons name="check" size={16} color="#FFF" /> : null}
                    </View>
                  </Pressable>
                ) : null}

                <View style={styles.associatedActions}>
                  <Pressable style={styles.associatedSkipBtn} onPress={handleSkipAssociated}>
                    <Text style={styles.associatedSkipBtnText}>{t('shareModal', 'sharePlayerOnly')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.associatedShareBtn, isGenerating && { opacity: 0.7 }]}
                    onPress={handleConfirmWithAssociated}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="link" size={18} color="#FFF" />
                        <Text style={styles.associatedShareBtnText}>{t('shareModal', 'generateCode')}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ) : !shareCode ? (
            <>
              {/* Read-only info */}
              <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.readOnlyInfo}>
                <View style={[styles.readOnlyBadge, { backgroundColor: theme.primary + '15' }]}>
                  <MaterialIcons name="visibility" size={16} color={theme.primary} />
                  <Text style={[styles.readOnlyBadgeText, { color: theme.primary }]}>{t('shareModal', 'readOnly')}</Text>
                </View>
                <Text style={styles.readOnlyDesc}>{t('shareModal', 'autoSaveDesc')}</Text>
              </Animated.View>

              {error ? (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error" size={18} color={theme.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Generate button */}
              <Animated.View entering={FadeInDown.duration(300).delay(100)}>
                <Pressable
                  style={[styles.generateBtn, isGenerating && { opacity: 0.7 }]}
                  onPress={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="link" size={22} color="#FFF" />
                      <Text style={styles.generateBtnText}>{t('shareModal', 'generateCode')}</Text>
                    </>
                  )}
                </Pressable>
              </Animated.View>
            </>
          ) : (
            <>
              {/* Share code result — single code */}
              <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.resultSection}>
                <View style={styles.resultIcon}>
                  <MaterialIcons name="check-circle" size={48} color={theme.success} />
                </View>
                <Text style={styles.resultTitle}>{t('shareModal', 'codeCreated')}</Text>
                <Text style={styles.resultDesc}>{t('shareModal', 'shareCodeAutoSaveDesc')}</Text>

                {/* Share code display */}
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{shareCode}</Text>
                  <Pressable style={styles.copyBtn} onPress={handleCopy}>
                    <MaterialIcons name={copied ? 'check' : 'content-copy'} size={20} color={copied ? theme.success : theme.primary} />
                    <Text style={[styles.copyBtnText, copied && { color: theme.success }]}>
                      {copied ? t('shareModal', 'copied') : t('shareModal', 'copy')}
                    </Text>
                  </Pressable>
                </View>

                {/* What's included */}
                <View style={styles.includedSection}>
                  <View style={styles.includedItem}>
                    <MaterialIcons name={typeConfig.icon as any} size={16} color={typeConfig.color} />
                    <Text style={styles.includedItemText}>{itemName}</Text>
                  </View>
                  {sharedAssociatedItems.map((ai) => {
                    const aiConfig = ai.type === 'club'
                      ? { icon: 'home' as const, color: theme.accent, name: associatedClub?.name }
                      : { icon: 'sports-soccer' as const, color: theme.success, name: associatedTerrain?.name };
                    return (
                      <View key={ai.type} style={styles.includedItem}>
                        <MaterialIcons name={aiConfig.icon} size={16} color={aiConfig.color} />
                        <Text style={styles.includedItemText}>{aiConfig.name}</Text>
                        <View style={[styles.includedBadge, { backgroundColor: aiConfig.color + '15' }]}>
                          <Text style={[styles.includedBadgeText, { color: aiConfig.color }]}>
                            {ai.type === 'club' ? t('shareModal', 'clubLabel') : t('shareModal', 'terrainLabel')}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Permission badge */}
                <View style={[styles.permissionBadge, { backgroundColor: theme.primary + '15' }]}>
                  <MaterialIcons name="visibility" size={14} color={theme.primary} />
                  <Text style={[styles.permissionBadgeText, { color: theme.primary }]}>
                    {t('shareModal', 'readOnly')} + {t('shareModal', 'autoSaveShort')}
                  </Text>
                </View>
              </Animated.View>

              {/* Share actions */}
              <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.shareActions}>
                <Pressable style={styles.shareActionBtn} onPress={handleShare}>
                  <MaterialIcons name="share" size={24} color={theme.primary} />
                  <Text style={styles.shareActionBtnText}>{t('shareModal', 'shareBtn')}</Text>
                </Pressable>
                <Pressable style={styles.shareActionBtn} onPress={handleCopy}>
                  <MaterialIcons name="content-copy" size={24} color={theme.accent} />
                  <Text style={styles.shareActionBtnText}>{t('shareModal', 'copyCode')}</Text>
                </Pressable>
              </Animated.View>

              {/* QR Code */}
              <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.qrSection}>
                <Text style={styles.qrSectionLabel}>{t('shareModal', 'qrCodeLabel') || (language === 'fr' ? 'QR Code de partage' : 'Share QR Code')}</Text>
                <View style={styles.qrWrapper}>
                  <QRCode
                    value={`${config.appDownloadUrl}?share=${shareCode}`}
                    size={140}
                    color={config.color || theme.primary}
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.qrHint}>{t('shareModal', 'qrHint') || (language === 'fr' ? 'Scannez pour acceder a la fiche' : 'Scan to access the card')}</Text>
              </Animated.View>

              <View style={styles.infoBox}>
                <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
                <Text style={styles.infoText}>{t('shareModal', 'infoTextAutoSave')}</Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  itemPreview: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 20, gap: 14,
    ...theme.shadows.card,
  },
  itemIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  itemType: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  // Read-only info
  readOnlyInfo: { alignItems: 'center', marginBottom: 20 },
  readOnlyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: theme.borderRadius.full, marginBottom: 10,
  },
  readOnlyBadgeText: { fontSize: 14, fontWeight: '600' },
  readOnlyDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.error + '15',
    padding: 12, borderRadius: theme.borderRadius.md, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, color: theme.error },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: theme.primary, paddingVertical: 16, borderRadius: theme.borderRadius.lg,
  },
  generateBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  resultSection: { alignItems: 'center', marginBottom: 20 },
  resultIcon: { marginBottom: 12 },
  resultTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  resultDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 8 },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg, padding: 16, gap: 10, width: '100%',
    borderWidth: 2, borderColor: theme.primary + '30', borderStyle: 'dashed',
  },
  codeText: { flex: 1, fontSize: 22, fontWeight: '800', color: theme.primary, letterSpacing: 1.5, textAlign: 'center' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: theme.primary + '15', borderRadius: theme.borderRadius.md,
  },
  copyBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  // Included items
  includedSection: {
    width: '100%', marginTop: 14, gap: 8,
  },
  includedItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: theme.borderRadius.md,
    borderWidth: 1, borderColor: theme.border,
  },
  includedItemText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  includedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.borderRadius.sm },
  includedBadgeText: { fontSize: 11, fontWeight: '600' },
  permissionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.borderRadius.full, marginTop: 12,
  },
  permissionBadgeText: { fontSize: 12, fontWeight: '600' },
  shareActions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  shareActionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.surface, paddingVertical: 20, borderRadius: theme.borderRadius.lg,
    ...theme.shadows.card,
  },
  shareActionBtnText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: theme.surface,
    padding: 14, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.border,
  },
  infoText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 18 },
  // QR Code
  qrSection: { alignItems: 'center' as const, marginBottom: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.border },
  qrSectionLabel: { fontSize: 12, fontWeight: '700' as const, color: theme.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 14 },
  qrWrapper: { padding: 16, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 2, borderColor: theme.primary + '20', ...theme.shadows.card },
  qrHint: { fontSize: 12, color: theme.textMuted, marginTop: 10 },
  // Associated items prompt
  associatedSection: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 20, marginBottom: 20, ...theme.shadows.card,
  },
  associatedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  associatedTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, flex: 1 },
  associatedDesc: { fontSize: 13, color: theme.textSecondary, lineHeight: 20, marginBottom: 16 },
  associatedItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 10,
    borderWidth: 2, borderColor: 'transparent', gap: 12,
  },
  associatedItemActive: { borderColor: theme.primary + '40', backgroundColor: theme.primary + '05' },
  associatedItemIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  associatedItemInfo: { flex: 1 },
  associatedItemLabel: {
    fontSize: 11, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  associatedItemName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginTop: 2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  associatedActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  associatedSkipBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
    backgroundColor: theme.backgroundSecondary, borderRadius: theme.borderRadius.md,
    borderWidth: 1, borderColor: theme.border,
  },
  associatedSkipBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  associatedShareBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, backgroundColor: theme.primary, borderRadius: theme.borderRadius.md,
  },
  associatedShareBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
