/**
 * Smart download landing page.
 * Invite / share-card QRs open https://ultimatepetanque.app/download
 * which sends iOS to the App Store and Android to Play Store when those URLs
 * are configured. Query params (?meetup=, ?event=, ?share=) still deep-link
 * into the installed app.
 */
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import {
  getAndroidPlayStoreUrl,
  getAppDownloadUrl,
  getIosAppStoreUrl,
  getPreferredStoreUrl,
} from '@/utils/appDownload';

export default function DownloadScreen() {
  const { language } = useLanguage();
  const fr = language === 'fr';
  const params = useLocalSearchParams<{ event?: string; meetup?: string; share?: string }>();
  const iosUrl = getIosAppStoreUrl();
  const androidUrl = getAndroidPlayStoreUrl();
  const preferred = getPreferredStoreUrl(
    Platform.OS,
    typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  );

  useEffect(() => {
    if (params.event) {
      router.replace({ pathname: '/sponsored-event/list', params: { joinCode: String(params.event) } } as any);
      return;
    }
    if (params.meetup) {
      router.replace({ pathname: '/share', params: { deepLinkCode: String(params.meetup), deepLinkType: 'meetup' } } as any);
      return;
    }
    if (params.share) {
      router.replace({ pathname: '/share', params: { deepLinkCode: String(params.share), deepLinkType: 'share' } } as any);
    }
  }, [params.event, params.meetup, params.share]);

  useEffect(() => {
    if (params.event || params.meetup || params.share) return;
    if (Platform.OS === 'web' && preferred !== getAppDownloadUrl()) {
      Linking.openURL(preferred).catch(() => {});
    }
  }, [params.event, params.meetup, params.share, preferred]);

  const open = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={s.container}>
      <Pressable style={s.back} onPress={() => router.back()} hitSlop={8}>
        <MaterialIcons name="arrow-back" size={22} color={theme.textPrimary} />
      </Pressable>
      <View style={s.body}>
        <Image
          source={require('@/assets/images/logo-ultimate-petanque.png')}
          style={s.logo}
          contentFit="contain"
        />
        <Text style={s.title}>Ultimate Petanque</Text>
        <Text style={s.subtitle}>
          {fr
            ? 'Telechargez l\'application sur votre telephone.'
            : 'Download the app on your phone.'}
        </Text>

        {iosUrl ? (
          <Pressable style={s.storeBtn} onPress={() => open(iosUrl)}>
            <MaterialIcons name="phone-iphone" size={22} color="#FFF" />
            <Text style={s.storeBtnText}>App Store</Text>
          </Pressable>
        ) : null}
        {androidUrl ? (
          <Pressable style={[s.storeBtn, { backgroundColor: '#0F172A' }]} onPress={() => open(androidUrl)}>
            <MaterialIcons name="android" size={22} color="#FFF" />
            <Text style={s.storeBtnText}>Google Play</Text>
          </Pressable>
        ) : null}

        {!iosUrl && !androidUrl ? (
          <Text style={s.pending}>
            {fr
              ? 'Les liens App Store et Google Play seront actives des que l\'application sera publiee. Le QR code restera le meme.'
              : 'App Store and Google Play links will go live when the app is published. The QR code will stay the same.'}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  back: { width: 40, height: 40, marginLeft: 12, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 48 },
  logo: { width: 160, height: 160, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 15, color: theme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  storeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  storeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  pending: { fontSize: 14, color: theme.textMuted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
});
