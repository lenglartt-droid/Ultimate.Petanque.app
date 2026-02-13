import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { createShareLink, ShareItemType, SharePermission } from '@/services/shareService';

const TYPE_LABELS: Record<ShareItemType, { label: string; icon: string; color: string }> = {
  player: { label: 'Joueur', icon: 'person', color: theme.primary },
  club: { label: 'Club', icon: 'home', color: theme.accent },
  terrain: { label: 'Terrain', icon: 'landscape', color: theme.success },
  tournament: { label: 'Tournoi', icon: 'emoji-events', color: theme.carreauColor },
};

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  itemType: ShareItemType;
  itemId: string;
  itemName: string;
}

export default function ShareModal({ visible, onClose, itemType, itemId, itemName }: ShareModalProps) {
  const [permission, setPermission] = useState<SharePermission>('read');
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const config = TYPE_LABELS[itemType];

  const handleGenerate = useCallback(async () => {
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
    } catch (e) {
      setError('Erreur lors de la création du lien');
    } finally {
      setIsGenerating(false);
    }
  }, [itemType, itemId, permission]);

  const handleCopy = useCallback(async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(shareCode);
    setCopied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopied(false), 2000);
  }, [shareCode]);

  const handleShare = useCallback(async () => {
    if (!shareCode) return;
    const message = `Je partage ma fiche ${config.label.toLowerCase()} "${itemName}" sur Ultimate Petanque !\n\nCode de partage : ${shareCode}`;
    try {
      await Share.share({
        message,
        title: `Partager - ${itemName}`,
      });
    } catch (e) {
      // User cancelled
    }
  }, [shareCode, config.label, itemName]);

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
          <Text style={styles.headerTitle}>Partager</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Item preview */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.itemPreview}>
            <View style={[styles.itemIcon, { backgroundColor: config.color + '15' }]}>
              <MaterialIcons name={config.icon as any} size={28} color={config.color} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{itemName}</Text>
              <Text style={styles.itemType}>{config.label}</Text>
            </View>
          </Animated.View>

          {!shareCode ? (
            <>
              {/* Permission selection */}
              <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.permissionSection}>
                <Text style={styles.sectionLabel}>PERMISSION</Text>
                <View style={styles.permissionOptions}>
                  <Pressable
                    style={[styles.permissionOption, permission === 'read' && styles.permissionOptionActive]}
                    onPress={() => { Haptics.selectionAsync(); setPermission('read'); }}
                  >
                    <View style={[styles.permissionIconBox, { backgroundColor: theme.primary + '15' }]}>
                      <MaterialIcons name="visibility" size={22} color={theme.primary} />
                    </View>
                    <View style={styles.permissionInfo}>
                      <Text style={[styles.permissionTitle, permission === 'read' && { color: theme.primary }]}>Lecture seule</Text>
                      <Text style={styles.permissionDesc}>Peut consulter la fiche</Text>
                    </View>
                    <View style={[styles.radio, permission === 'read' && styles.radioActive]}>
                      {permission === 'read' && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>

                  <Pressable
                    style={[styles.permissionOption, permission === 'write' && styles.permissionOptionActive]}
                    onPress={() => { Haptics.selectionAsync(); setPermission('write'); }}
                  >
                    <View style={[styles.permissionIconBox, { backgroundColor: theme.accent + '15' }]}>
                      <MaterialIcons name="edit" size={22} color={theme.accent} />
                    </View>
                    <View style={styles.permissionInfo}>
                      <Text style={[styles.permissionTitle, permission === 'write' && { color: theme.accent }]}>Lecture + Modification</Text>
                      <Text style={styles.permissionDesc}>Peut consulter et modifier</Text>
                    </View>
                    <View style={[styles.radio, permission === 'write' && styles.radioActiveWrite]}>
                      {permission === 'write' && <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />}
                    </View>
                  </Pressable>
                </View>
              </Animated.View>

              {error && (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error" size={18} color={theme.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

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
                      <Text style={styles.generateBtnText}>Générer le code de partage</Text>
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
                <Text style={styles.resultTitle}>Code de partage créé</Text>
                <Text style={styles.resultDesc}>
                  Partagez ce code avec vos amis pour leur donner accès
                </Text>

                {/* Share code display */}
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{shareCode}</Text>
                  <Pressable style={styles.copyBtn} onPress={handleCopy}>
                    <MaterialIcons name={copied ? 'check' : 'content-copy'} size={20} color={copied ? theme.success : theme.primary} />
                    <Text style={[styles.copyBtnText, copied && { color: theme.success }]}>
                      {copied ? 'Copié' : 'Copier'}
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
                    {permission === 'read' ? 'Lecture seule' : 'Lecture + Modification'}
                  </Text>
                </View>
              </Animated.View>

              {/* Share actions */}
              <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.shareActions}>
                <Pressable style={styles.shareActionBtn} onPress={handleShare}>
                  <MaterialIcons name="share" size={24} color={theme.primary} />
                  <Text style={styles.shareActionBtnText}>Partager</Text>
                </Pressable>
                <Pressable style={styles.shareActionBtn} onPress={handleCopy}>
                  <MaterialIcons name="content-copy" size={24} color={theme.accent} />
                  <Text style={styles.shareActionBtnText}>Copier le code</Text>
                </Pressable>
              </Animated.View>

              {/* Info */}
              <Animated.View entering={FadeInDown.duration(300).delay(150)} style={styles.infoBox}>
                <MaterialIcons name="info-outline" size={18} color={theme.textMuted} />
                <Text style={styles.infoText}>
                  Le destinataire doit avoir l'application Ultimate Petanque et saisir le code dans la section "Code de partage" de son profil.
                </Text>
              </Animated.View>
            </>
          )}
        </View>
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
  content: { flex: 1, padding: 16 },
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
  resultSection: { alignItems: 'center', marginBottom: 24 },
  resultIcon: { marginBottom: 12 },
  resultTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  resultDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 20 },
  codeBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg, padding: 16, gap: 14, width: '100%',
    borderWidth: 2, borderColor: theme.primary + '30', borderStyle: 'dashed',
  },
  codeText: { flex: 1, fontSize: 24, fontWeight: '800', color: theme.primary, letterSpacing: 2, textAlign: 'center' },
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
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: theme.backgroundSecondary,
    padding: 14, borderRadius: theme.borderRadius.md,
  },
  infoText: { flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 18 },
});
