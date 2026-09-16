/**
 * Invite-friends QR: encodes the smart download URL so one scan
 * reaches iOS App Store or Android Play Store via /download.
 */
import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Share as RNShare, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import {
  buildAppShareMessage,
  getAndroidPlayStoreUrl,
  getAppDownloadUrl,
  getIosAppStoreUrl,
} from '@/utils/appDownload';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function QRShareModal({ visible, onClose }: Props) {
  const { t, language } = useLanguage();
  const { showAlert } = useAlert();
  const fr = language === 'fr';
  const downloadUrl = getAppDownloadUrl();
  const iosUrl = getIosAppStoreUrl();
  const androidUrl = getAndroidPlayStoreUrl();

  const handleCopy = async () => {
    const message = buildAppShareMessage(fr);
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(message);
    } catch {
      try { await RNShare.share({ message, url: downloadUrl }); } catch {}
    }
    showAlert(t('home', 'linkCopied'));
  };

  const handleShare = async () => {
    try {
      await RNShare.share({ message: buildAppShareMessage(fr), url: downloadUrl });
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.content}>
          <View style={s.header}>
            <Text style={s.headerTitle}>{t('home', 'shareAppTitle')}</Text>
            <Pressable style={s.closeBtn} onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          <View style={s.body}>
            <View style={s.qrWrapper}>
              <QRCode value={downloadUrl} size={180} color="#1E3A8A" backgroundColor="#FFFFFF" />
            </View>
            <Text style={s.appName}>Ultimate Petanque</Text>
            <Text style={s.desc}>{t('home', 'shareAppDesc')}</Text>
            <Text style={s.qrUrl} numberOfLines={2}>{downloadUrl}</Text>

            {(iosUrl || androidUrl) ? (
              <View style={s.storeRow}>
                {iosUrl ? (
                  <Pressable style={s.storeBtn} onPress={() => Linking.openURL(iosUrl)}>
                    <MaterialIcons name="phone-iphone" size={18} color="#0F172A" />
                    <Text style={s.storeBtnText}>App Store</Text>
                  </Pressable>
                ) : null}
                {androidUrl ? (
                  <Pressable style={s.storeBtn} onPress={() => Linking.openURL(androidUrl)}>
                    <MaterialIcons name="android" size={18} color="#0F172A" />
                    <Text style={s.storeBtnText}>Google Play</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={s.note}>
              <MaterialIcons name="people" size={18} color={theme.success} />
              <Text style={s.noteText}>{t('home', 'shareAppNote')}</Text>
            </View>
          </View>
          <View style={s.actions}>
            <Pressable style={s.copyBtn} onPress={handleCopy}>
              <MaterialIcons name="content-copy" size={18} color={theme.primary} />
              <Text style={s.copyBtnText}>{t('home', 'copyLink')}</Text>
            </Pressable>
            <Pressable style={s.doneBtn} onPress={handleShare}>
              <MaterialIcons name="share" size={18} color={theme.textSecondary} />
              <Text style={s.doneBtnText}>{t('home', 'shareApp')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default memo(QRShareModal);

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  content: { backgroundColor: '#FFF', borderRadius: 24, overflow: 'hidden', maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, flex: 1, paddingRight: 8 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  body: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 24 },
  qrWrapper: { backgroundColor: '#FFF', padding: 14, borderRadius: 20, borderWidth: 2, borderColor: '#E2E8F0', marginBottom: 16 },
  appName: { fontSize: 20, fontWeight: '800', color: '#1E3A8A', marginBottom: 6 },
  desc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  qrUrl: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginBottom: 14 },
  storeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 },
  storeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  storeBtnText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: theme.success + '08', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.success + '15' },
  noteText: { flex: 1, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  copyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.primary + '10' },
  copyBtnText: { fontSize: 15, fontWeight: '600', color: theme.primary },
  doneBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9' },
  doneBtnText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
});
