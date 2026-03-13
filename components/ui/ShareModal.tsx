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
  const [permission, setPermission] = useState<SharePermission>('read');
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    }
  }, [visible, itemId, itemType]);

  const handleGenerate = useCallback(async () => {
    if (!itemId) {
      setError('Item ID is missing');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const result = await createShareLink(itemType, itemId, permission);
      if (result.error) {
        setError(result.error);
      } else {
        setShareCode(result.shareCode);
        setShareUrl(result.shareUrl);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      console.log('Share link creation error:', e);
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

  const handleShare = useCallback(async () => {
    if (!shareCode) return;
    const message = `${t('shareModal', 'shareMessage')} ${typeLabelLower} "${itemName}" ${t('shareModal', 'shareMessageSuffix')}\n\n${t('shareModal', 'shareMessageCode')} ${shareCode}`;
    try {
      await Share.share({
        message,
        title: `${t('shareModal', 'shareMessageTitle')} ${itemName}`,
      });
    } catch (e) {
      // User cancelled
    }
  }, [shareCode, typeLabelLower, itemName, t]);

  const handleClose = useCallback(() => {
    setShareCode(null);
    setShareUrl(null);
    setError(null);
    setCopied(false);
    setPermission('read');
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

          {!shareCode ? (
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

              {/* Share actions */}
              <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.shareActions}>
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
});
