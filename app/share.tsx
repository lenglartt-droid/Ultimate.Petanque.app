import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { redeemShareCode, saveSharedItemToMyAccount, ShareItemType } from '@/services/shareService';
import { useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';

const ROUTE_MAP: Record<ShareItemType, string> = {
  player: '/player/',
  club: '/club/',
  terrain: '/terrain/',
  tournament: '/tournament/',
  match: '/match/',
  challenge: '',
};

const TYPE_LABEL_KEY: Record<ShareItemType, string> = {
  player: 'playerLabel',
  club: 'clubLabel',
  terrain: 'terrainLabel',
  tournament: 'tournamentLabel',
  match: 'matchLabel',
  challenge: 'challengeLabel',
};

const TYPE_ICON: Record<ShareItemType, string> = {
  player: 'person',
  club: 'home',
  terrain: 'landscape',
  tournament: 'emoji-events',
  match: 'sports',
  challenge: 'flag',
};

const TYPE_COLOR: Record<ShareItemType, string> = {
  player: theme.primary,
  club: theme.accent,
  terrain: theme.success,
  tournament: theme.carreauColor,
  match: theme.tirColor,
  challenge: theme.warning,
};

export default function RedeemShareScreen() {
  const { showAlert } = useAlert();
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ itemType: ShareItemType; itemId: string; permission: string } | null>(null);
  const [isSavingCopy, setIsSavingCopy] = useState(false);

  const handleRedeem = async () => {
    if (!code.trim()) {
      showAlert(t('common', 'error'), t('share', 'enterCode'));
      return;
    }

    setIsRedeeming(true);
    try {
      const result = await redeemShareCode(code.trim());
      if (result.error) {
        showAlert(t('common', 'error'), result.error);
      } else {
        setRedeemResult({ itemType: result.itemType, itemId: result.itemId, permission: result.permission });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      showAlert(t('common', 'error'), t('share', 'cannotValidate'));
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleNavigate = () => {
    if (!redeemResult) return;
    const route = `${ROUTE_MAP[redeemResult.itemType]}${redeemResult.itemId}`;
    router.replace(route as any);
  };

  const typeColor = redeemResult ? TYPE_COLOR[redeemResult.itemType] : null;
  const typeIcon = redeemResult ? TYPE_ICON[redeemResult.itemType] : null;
  const typeLabel = redeemResult ? t('share', TYPE_LABEL_KEY[redeemResult.itemType]).toLowerCase() : '';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('share', 'shareCode')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {!redeemResult ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.inputSection}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="qr-code-2" size={48} color={theme.primary} />
            </View>
            <Text style={styles.title}>{t('share', 'enterShareCode')}</Text>
            <Text style={styles.desc}>
              {t('share', 'enterShareCodeDesc')}
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Ex: AbC12xYz"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={12}
              />
            </View>

            <Pressable
              style={[styles.redeemBtn, (!code.trim() || isRedeeming) && { opacity: 0.6 }]}
              onPress={handleRedeem}
              disabled={!code.trim() || isRedeeming}
            >
              {isRedeeming ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <MaterialIcons name="lock-open" size={20} color="#FFF" />
                  <Text style={styles.redeemBtnText}>{t('share', 'validateCode')}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.successSection}>
            <View style={[styles.successIcon, { backgroundColor: typeColor + '20' }]}>
              <MaterialIcons name={typeIcon as any} size={48} color={typeColor} />
            </View>
            <Text style={styles.successTitle}>{t('share', 'cardUnlocked')}</Text>
            <Text style={styles.successDesc}>
              {t('share', 'accessGranted')} {typeLabel} {t('share', 'inMode')}{' '}
              <Text style={{ fontWeight: '700' }}>
                {redeemResult.permission === 'read' ? t('share', 'readOnly') : t('share', 'readWrite')}
              </Text>.
            </Text>

            {redeemResult.itemType !== 'challenge' && (
            <Pressable style={[styles.navigateBtn, { backgroundColor: typeColor }]} onPress={handleNavigate}>
              <MaterialIcons name="open-in-new" size={20} color="#FFF" />
              <Text style={styles.navigateBtnText}>{t('share', 'viewCard')}</Text>
            </Pressable>
            )}

            <Pressable
              style={[styles.saveBtn, isSavingCopy && { opacity: 0.6 }]}
              onPress={async () => {
                if (!redeemResult) return;
                setIsSavingCopy(true);
                const { newItemId, error } = await saveSharedItemToMyAccount(redeemResult.itemType, redeemResult.itemId);
                setIsSavingCopy(false);
                if (error) {
                  showAlert(t('common', 'error'), error);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  const isMatchOrChallenge = redeemResult.itemType === 'match' || redeemResult.itemType === 'challenge';
                  showAlert(t('share', 'saved'), isMatchOrChallenge ? t('share', 'importedToAccount') : t('share', 'copiedToDirectory'));
                  if (newItemId && ROUTE_MAP[redeemResult.itemType]) {
                    router.replace(`${ROUTE_MAP[redeemResult.itemType]}${newItemId}` as any);
                  } else {
                    router.replace('/(tabs)' as any);
                  }
                }
              }}
              disabled={isSavingCopy}
            >
              <MaterialIcons name="save-alt" size={20} color={theme.accent} />
              <Text style={styles.saveBtnText}>
                {(redeemResult.itemType === 'match' || redeemResult.itemType === 'challenge') 
                  ? t('share', 'importToMyAccount') 
                  : t('share', 'saveToDirectory')}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  body: { flex: 1, justifyContent: 'center', padding: 24 },
  inputSection: { alignItems: 'center' },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: theme.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  desc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  inputRow: {
    width: '100%', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    borderWidth: 2, borderColor: theme.border, marginBottom: 16,
  },
  input: {
    fontSize: 22, fontWeight: '700', color: theme.textPrimary, padding: 16,
    textAlign: 'center', letterSpacing: 2,
  },
  redeemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', backgroundColor: theme.primary, paddingVertical: 16,
    borderRadius: theme.borderRadius.lg,
  },
  redeemBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  successSection: { alignItems: 'center' },
  successIcon: {
    width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  successDesc: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  navigateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', paddingVertical: 16, borderRadius: theme.borderRadius.lg,
  },
  navigateBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', paddingVertical: 16, borderRadius: theme.borderRadius.lg,
    marginTop: 12, backgroundColor: theme.accent + '15', borderWidth: 1.5,
    borderColor: theme.accent + '40',
  },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: theme.accent },
});
