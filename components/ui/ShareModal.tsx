import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { createShareLink, ShareItemType, SharePermission } from '@/services/shareService';
import { useLanguage } from '@/hooks/useLanguage';
import { useApp } from '@/contexts/AppContext';

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

interface AssociatedShareResult {
  type: 'club' | 'terrain';
  name: string;
  shareCode: string;
}

export default function ShareModal({ visible, onClose, itemType, itemId, itemName, forceReadOnly = false }: ShareModalProps) {
  const { t } = useLanguage();
  const { getPlayerById, getClubById, getTerrainById } = useApp();
  const [permission, setPermission] = useState<SharePermission>('read');
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Associated items state (for player sharing)
  const [showAssociatedPrompt, setShowAssociatedPrompt] = useState(false);
  const [associatedClub, setAssociatedClub] = useState<{ id: string; name: string } | null>(null);
  const [associatedTerrain, setAssociatedTerrain] = useState<{ id: string; name: string } | null>(null);
  const [includeClub, setIncludeClub] = useState(true);
  const [includeTerrain, setIncludeTerrain] = useState(true);
  const [associatedResults, setAssociatedResults] = useState<AssociatedShareResult[]>([]);
  const [copiedAssociated, setCopiedAssociated] = useState<Record<string, boolean>>({});

  const config = TYPE_CONFIG[itemType];
  const typeLabel = t('shareModal', config.labelKey);
  const typeLabelLower = t('shareModal', TYPE_LOWER_KEY[itemType]);

  // Reset state when modal opens with new item
  React.useEffect(() => {
    if (visible) {
      setShareCode(null);
      setShareUrl(null);
      setError(null);
      setCopied(false);
      setPermission('read');
      setIsGenerating(false);
      setShowAssociatedPrompt(false);
      setAssociatedClub(null);
      setAssociatedTerrain(null);
      setIncludeClub(true);
      setIncludeTerrain(true);
      setAssociatedResults([]);
      setCopiedAssociated({});
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

    // For player type, check associated items first
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

    await generateShareCodes();
  }, [itemType, itemId, permission, showAssociatedPrompt, shareCode, detectAssociatedItems]);

  const generateShareCodes = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setShowAssociatedPrompt(false);

    try {
      // Generate main player share code
      const result = await createShareLink(itemType, itemId, permission);
      if (result.error) {
        setError(result.error);
        setIsGenerating(false);
        return;
      }

      setShareCode(result.shareCode);
      setShareUrl(result.shareUrl);

      // Generate associated share codes if applicable
      const associatedCodes: AssociatedShareResult[] = [];

      if (itemType === 'player') {
        if (includeClub && associatedClub) {
          const clubResult = await createShareLink('club', associatedClub.id, 'read');
          if (!clubResult.error) {
            associatedCodes.push({
              type: 'club',
              name: associatedClub.name,
              shareCode: clubResult.shareCode,
            });
          }
        }

        if (includeTerrain && associatedTerrain) {
          const terrainResult = await createShareLink('terrain', associatedTerrain.id, 'read');
          if (!terrainResult.error) {
            associatedCodes.push({
              type: 'terrain',
              name: associatedTerrain.name,
              shareCode: terrainResult.shareCode,
            });
          }
        }
      }

      setAssociatedResults(associatedCodes);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      console.log('Share link creation error:', e);
      setError(e?.message || t('shareModal', 'errorCreating'));
    } finally {
      setIsGenerating(false);
    }
  }, [itemType, itemId, permission, includeClub, includeTerrain, associatedClub, associatedTerrain, t]);

  const handleSkipAssociated = useCallback(async () => {
    setIncludeClub(false);
    setIncludeTerrain(false);
    // After clearing, proceed with generation
    setIsGenerating(true);
    setError(null);
    setShowAssociatedPrompt(false);

    try {
      const result = await createShareLink(itemType, itemId, permission);
      if (result.error) {
        setError(result.error);
      } else {
        setShareCode(result.shareCode);
        setShareUrl(result.shareUrl);
        setAssociatedResults([]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setError(e?.message || t('shareModal', 'errorCreating'));
    } finally {
      setIsGenerating(false);
    }
  }, [itemType, itemId, permission, t]);

  const handleCopy = useCallback(async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(shareCode);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  }, [shareCode]);

  const handleCopyAssociated = useCallback(async (code: string, type: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedAssociated(prev => ({ ...prev, [type]: true }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopiedAssociated(prev => ({ ...prev, [type]: false })), 2000);
  }, []);

  const handleShare = useCallback(async () => {
    if (!shareCode) return;
    let message = `${t('shareModal', 'shareMessage')} ${typeLabelLower} "${itemName}" ${t('shareModal', 'shareMessageSuffix')}\n\n${t('shareModal', 'shareMessageCode')} ${shareCode}`;

    // Include associated codes in the share message
    if (associatedResults.length > 0) {
      message += '\n';
      associatedResults.forEach(ar => {
        const typeLabel = ar.type === 'club' ? t('shareModal', 'clubLabel') : t('shareModal', 'terrainLabel');
        message += `\n${typeLabel} "${ar.name}" : ${ar.shareCode}`;
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
  }, [shareCode, typeLabelLower, itemName, associatedResults, t]);

  const handleClose = useCallback(() => {
    setShareCode(null);
    setShareUrl(null);
    setError(null);
    setCopied(false);
    setPermission('read');
    setShowAssociatedPrompt(false);
    setAssociatedResults([]);
    setCopiedAssociated({});
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
            <View style={[styles.itemIcon, { backgroundColor: config.color + '15' }]}>
              <MaterialIcons name={config.icon as any} size={28} color={config.color} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{itemName}</Text>
              <Text style={styles.itemType}>{typeLabel}</Text>
            </View>
          </Animated.View>

          {/* Associated items prompt */}
          {showAssociatedPrompt ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <View style={styles.associatedSection}>
                <View style={styles.associatedHeader}>
                  <MaterialIcons name="link" size={22} color={theme.primary} />
                  <Text style={styles.associatedTitle}>{t('shareModal', 'alsoShareAssociated')}</Text>
                </View>
                <Text style={styles.associatedDesc}>{t('shareModal', 'alsoShareAssociatedDesc')}</Text>

                {/* Club toggle */}
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

                {/* Terrain toggle */}
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

                {/* Action buttons */}
                <View style={styles.associatedActions}>
                  <Pressable
                    style={styles.associatedSkipBtn}
                    onPress={handleSkipAssociated}
                  >
                    <Text style={styles.associatedSkipBtnText}>{t('shareModal', 'sharePlayerOnly')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.associatedShareBtn, isGenerating && { opacity: 0.7 }]}
                    onPress={generateShareCodes}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <MaterialIcons name="link" size={18} color="#FFF" />
                        <Text style={styles.associatedShareBtnText}>{t('shareModal', 'shareWithAssociated')}</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ) : !shareCode ? (
            <>
              {/* Permission selection */}
              <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.permissionSection}>
                <Text style={styles.sectionLabel}>{t('shareModal', 'permissionLabel')}</Text>
                <View style={styles.permissionOptions}>
                  <Pressable
                    style={[styles.permissionOption, permission === 'read' && styles.permissionOptionActive]}
                    onPress={() => { Haptics.selectionAsync(); setPermission('read'); }}
                  >
                    <View style={[styles.permissionIconBox, { backgroundColor: theme.primary + '15' }]}>
                      <MaterialIcons name="visibility" size={22} color={theme.primary} />
                    </View>
                    <View style={styles.permissionInfo}>
                      <Text style={[styles.permissionTitle, permission === 'read' && { color: theme.primary }]}>{t('shareModal', 'readOnly')}</Text>
                      <Text style={styles.permissionDesc}>{t('shareModal', 'canViewCard')}</Text>
                    </View>
                    <View style={[styles.radio, permission === 'read' && styles.radioActive]}>
                      {permission === 'read' ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>

                  {!forceReadOnly ? (
                  <Pressable
                    style={[styles.permissionOption, permission === 'write' && styles.permissionOptionActive]}
                    onPress={() => { Haptics.selectionAsync(); setPermission('write'); }}
                  >
                    <View style={[styles.permissionIconBox, { backgroundColor: theme.accent + '15' }]}>
                      <MaterialIcons name="edit" size={22} color={theme.accent} />
                    </View>
                    <View style={styles.permissionInfo}>
                      <Text style={[styles.permissionTitle, permission === 'write' && { color: theme.accent }]}>{t('shareModal', 'readWrite')}</Text>
                      <Text style={styles.permissionDesc}>{t('shareModal', 'canViewAndEdit')}</Text>
                    </View>
                    <View style={[styles.radio, permission === 'write' && styles.radioActiveWrite]}>
                      {permission === 'write' ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
                    </View>
                  </Pressable>
                  ) : null}
                </View>
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
              {/* Share code result */}
              <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.resultSection}>
                <View style={styles.resultIcon}>
                  <MaterialIcons name="check-circle" size={48} color={theme.success} />
                </View>
                <Text style={styles.resultTitle}>{t('shareModal', 'codeCreated')}</Text>
                <Text style={styles.resultDesc}>
                  {t('shareModal', 'shareCodeDesc')}
                </Text>

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

                {/* Permission badge */}
                <View style={[styles.permissionBadge, { backgroundColor: permission === 'read' ? theme.primary + '15' : theme.accent + '15' }]}>
                  <MaterialIcons
                    name={permission === 'read' ? 'visibility' : 'edit'}
                    size={14}
                    color={permission === 'read' ? theme.primary : theme.accent}
                  />
                  <Text style={[styles.permissionBadgeText, { color: permission === 'read' ? theme.primary : theme.accent }]}>
                    {permission === 'read' ? t('shareModal', 'readOnly') : t('shareModal', 'readWrite')}
                  </Text>
                </View>
              </Animated.View>

              {/* Associated share codes */}
              {associatedResults.length > 0 ? (
                <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.associatedResultSection}>
                  <Text style={styles.associatedResultTitle}>{t('shareModal', 'associatedCodesTitle')}</Text>
                  {associatedResults.map((ar) => {
                    const arConfig = ar.type === 'club'
                      ? { icon: 'home' as const, color: theme.accent, label: t('shareModal', 'clubShared') }
                      : { icon: 'sports-soccer' as const, color: theme.success, label: t('shareModal', 'terrainShared') };
                    const isCopied = copiedAssociated[ar.type] || false;
                    return (
                      <View key={ar.type} style={styles.associatedResultCard}>
                        <View style={styles.associatedResultCardHeader}>
                          <View style={[styles.associatedResultIcon, { backgroundColor: arConfig.color + '15' }]}>
                            <MaterialIcons name={arConfig.icon} size={18} color={arConfig.color} />
                          </View>
                          <View style={styles.associatedResultInfo}>
                            <Text style={styles.associatedResultLabel}>{arConfig.label}</Text>
                            <Text style={styles.associatedResultName} numberOfLines={1}>{ar.name}</Text>
                          </View>
                        </View>
                        <View style={styles.associatedCodeRow}>
                          <Text style={styles.associatedCodeText}>{ar.shareCode}</Text>
                          <Pressable
                            style={styles.associatedCopyBtn}
                            onPress={() => handleCopyAssociated(ar.shareCode, ar.type)}
                          >
                            <MaterialIcons
                              name={isCopied ? 'check' : 'content-copy'}
                              size={16}
                              color={isCopied ? theme.success : arConfig.color}
                            />
                            <Text style={[styles.associatedCopyBtnText, { color: isCopied ? theme.success : arConfig.color }]}>
                              {isCopied ? t('shareModal', 'copied') : t('shareModal', 'copy')}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </Animated.View>
              ) : null}

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

              {/* Info — separated from content above */}
              <View style={styles.infoBox}>
                <MaterialIcons name="info-outline" size={16} color={theme.textMuted} />
                <Text style={styles.infoText}>
                  {t('shareModal', 'infoText')}
                </Text>
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
  permissionSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 1, marginBottom: 10 },
  permissionOptions: { gap: 10 },
  permissionOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg, padding: 14, gap: 12,
    borderWidth: 2, borderColor: 'transparent', ...theme.shadows.card,
  },
  permissionOptionActive: { borderColor: theme.primary + '40' },
  permissionIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  permissionInfo: { flex: 1 },
  permissionTitle: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  permissionDesc: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: theme.primary },
  radioActiveWrite: { borderColor: theme.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.primary },
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
  // Associated items prompt styles
  associatedSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 20,
    marginBottom: 20,
    ...theme.shadows.card,
  },
  associatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  associatedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    flex: 1,
  },
  associatedDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  associatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
  },
  associatedItemActive: {
    borderColor: theme.primary + '40',
    backgroundColor: theme.primary + '05',
  },
  associatedItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  associatedItemInfo: {
    flex: 1,
  },
  associatedItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  associatedItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  associatedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  associatedSkipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  associatedSkipBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  associatedShareBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.md,
  },
  associatedShareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Associated results display
  associatedResultSection: {
    marginBottom: 20,
  },
  associatedResultTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  associatedResultCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 10,
    ...theme.shadows.card,
  },
  associatedResultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  associatedResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  associatedResultInfo: {
    flex: 1,
  },
  associatedResultLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  associatedResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: 1,
  },
  associatedCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    gap: 8,
  },
  associatedCodeText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  associatedCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  associatedCopyBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
