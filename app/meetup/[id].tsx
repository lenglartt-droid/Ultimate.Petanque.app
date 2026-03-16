import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/template';
import { useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Meetup,
  MeetupResponse,
  findMeetupByCode,
  getMeetupResponses,
  respondToMeetup,
  cancelMeetup,
  deleteMeetup,
  getMyResponseStatus,
  scheduleMeetupReminder,
  cancelMeetupReminder,
} from '@/services/meetupService';

export default function MeetupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string; code?: string }>();
  const params = useLocalSearchParams<{ id: string; code?: string }>();
  const insets = useSafeAreaInsets();
  const { terrains } = useApp();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { t, language } = useLanguage();

  const [meetup, setMeetup] = useState<Meetup | null>(null);
  const [responses, setResponses] = useState<MeetupResponse[]>([]);
  const [myStatus, setMyStatus] = useState<'accepted' | 'declined' | 'pending' | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCreator = meetup && user && meetup.creator_id === user.id;
  const terrain = meetup ? terrains.find(tr => tr.id === meetup.terrain_id) : null;
  const meetupDate = meetup ? new Date(meetup.date) : null;
  const isPast = meetupDate ? meetupDate < new Date() : false;
  const acceptedCount = responses.filter(r => r.status === 'accepted').length;
  const declinedCount = responses.filter(r => r.status === 'declined').length;
  const pendingCount = responses.filter(r => r.status === 'pending').length;

  const loadMeetup = useCallback(async () => {
    if (!id) return;

    // If id looks like a share code (starts with RDV-), find by code
    const isCode = id.startsWith('RDV-') || (params.code && params.code === 'true');
    let foundMeetup: Meetup | null = null;

    if (isCode) {
      const { meetup: m } = await findMeetupByCode(id);
      foundMeetup = m;
    } else {
      // Direct DB fetch
      const { getSupabaseClient } = require('@/template');
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('terrain_meetups')
        .select('*')
        .eq('id', id)
        .single();
      foundMeetup = data;
    }

    if (foundMeetup) {
      setMeetup(foundMeetup);
      // Load responses
      const { responses: resp } = await getMeetupResponses(foundMeetup.id);
      setResponses(resp);
      // Check my status
      const status = await getMyResponseStatus(foundMeetup.id);
      setMyStatus(status);
    }

    setLoading(false);
  }, [id, params.code]);

  useEffect(() => {
    loadMeetup();
  }, [loadMeetup]);

  // Polling for new responses (every 15 seconds)
  useEffect(() => {
    if (!meetup || isPast) return;

    pollingRef.current = setInterval(async () => {
      const { responses: resp } = await getMeetupResponses(meetup.id);
      setResponses(resp);
    }, 15000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [meetup?.id, isPast]);

  const handleRespond = useCallback(async (status: 'accepted' | 'declined') => {
    if (!meetup) return;
    setResponding(true);
    const { error } = await respondToMeetup(meetup.id, status);
    setResponding(false);

    if (error) {
      showAlert(t('common', 'error'), error);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMyStatus(status);

    // Schedule/cancel reminder
    if (status === 'accepted' && terrain) {
      await scheduleMeetupReminder(meetup, terrain.name);
    } else {
      await cancelMeetupReminder(meetup.id);
    }

    // Refresh responses
    const { responses: resp } = await getMeetupResponses(meetup.id);
    setResponses(resp);
  }, [meetup, terrain, t, showAlert]);

  const handleCancel = useCallback(() => {
    if (!meetup) return;
    Alert.alert(t('meetup', 'cancelMeetup'), t('meetup', 'cancelConfirm'), [
      { text: t('common', 'no'), style: 'cancel' },
      {
        text: t('common', 'yes'), style: 'destructive', onPress: async () => {
          await cancelMeetup(meetup.id);
          await cancelMeetupReminder(meetup.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  }, [meetup, t]);

  const handleDelete = useCallback(() => {
    if (!meetup) return;
    Alert.alert(t('meetup', 'deleteMeetup'), t('meetup', 'deleteConfirm'), [
      { text: t('common', 'cancel'), style: 'cancel' },
      {
        text: t('common', 'delete'), style: 'destructive', onPress: async () => {
          await deleteMeetup(meetup.id);
          await cancelMeetupReminder(meetup.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  }, [meetup, t]);

  const handleCopyCode = useCallback(async () => {
    if (meetup) {
      await Clipboard.setStringAsync(meetup.share_code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('common', 'success'), t('meetup', 'codeCopied'));
    }
  }, [meetup, t, showAlert]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('meetup', 'meetupLabel')}</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!meetup) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('meetup', 'meetupLabel')}</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="event-busy" size={64} color={theme.textMuted} />
          <Text style={styles.emptyText}>{t('meetup', 'meetupNotFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const dateFormatted = meetupDate!.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeFormatted = meetupDate!.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('meetup', 'meetupLabel')}</Text>
        <View style={styles.headerActions}>
          {isCreator ? (
            <>
              <Pressable style={styles.actionBtn} onPress={handleCopyCode}>
                <MaterialIcons name="content-copy" size={20} color={theme.primary} />
              </Pressable>
              <Pressable style={styles.actionBtn} onPress={handleDelete}>
                <MaterialIcons name="delete" size={20} color={theme.error} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        {isPast ? (
          <View style={[styles.statusBanner, { backgroundColor: theme.textMuted + '15' }]}>
            <MaterialIcons name="history" size={18} color={theme.textMuted} />
            <Text style={[styles.statusBannerText, { color: theme.textMuted }]}>{t('meetup', 'meetupPassed')}</Text>
          </View>
        ) : meetup.status === 'cancelled' ? (
          <View style={[styles.statusBanner, { backgroundColor: theme.error + '15' }]}>
            <MaterialIcons name="cancel" size={18} color={theme.error} />
            <Text style={[styles.statusBannerText, { color: theme.error }]}>{t('meetup', 'meetupCancelled')}</Text>
          </View>
        ) : null}

        {/* Hero Card */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
          <View style={styles.heroIconBg}>
            <MaterialIcons name="event" size={32} color={theme.primary} />
          </View>
          <Text style={styles.heroTitle}>{meetup.title}</Text>
          
          <View style={styles.heroInfoRow}>
            <MaterialIcons name="calendar-today" size={16} color={theme.textSecondary} />
            <Text style={styles.heroInfoText}>{dateFormatted}</Text>
          </View>
          <View style={styles.heroInfoRow}>
            <MaterialIcons name="schedule" size={16} color={theme.textSecondary} />
            <Text style={styles.heroInfoText}>{timeFormatted}</Text>
          </View>
          
          {terrain ? (
            <Pressable style={styles.terrainRow} onPress={() => router.push(`/terrain/${terrain.id}`)}>
              <MaterialIcons name="place" size={16} color={theme.primary} />
              <Text style={styles.terrainRowText}>{terrain.name} \u2022 {terrain.city}</Text>
              <MaterialIcons name="chevron-right" size={16} color={theme.textMuted} />
            </Pressable>
          ) : null}

          {meetup.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{meetup.notes}</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Share Code */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Pressable style={styles.shareCodeCard} onPress={handleCopyCode}>
            <View style={styles.shareCodeLeft}>
              <Text style={styles.shareCodeLabel}>{t('meetup', 'shareCodeLabel')}</Text>
              <Text style={styles.shareCodeValue}>{meetup.share_code}</Text>
            </View>
            <View style={styles.shareCodeCopy}>
              <MaterialIcons name="content-copy" size={20} color={theme.primary} />
            </View>
          </Pressable>
        </Animated.View>

        {/* Participants Summary */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)} style={styles.participantsCard}>
          <Text style={styles.sectionTitle}>{t('meetup', 'participants')} ({acceptedCount}/{meetup.max_participants})</Text>
          <View style={styles.participantsGrid}>
            <View style={styles.pStatItem}>
              <View style={[styles.pStatDot, { backgroundColor: theme.success }]} />
              <Text style={styles.pStatValue}>{acceptedCount}</Text>
              <Text style={styles.pStatLabel}>{t('meetup', 'accepted')}</Text>
            </View>
            <View style={styles.pStatItem}>
              <View style={[styles.pStatDot, { backgroundColor: theme.error }]} />
              <Text style={styles.pStatValue}>{declinedCount}</Text>
              <Text style={styles.pStatLabel}>{t('meetup', 'declined')}</Text>
            </View>
            <View style={styles.pStatItem}>
              <View style={[styles.pStatDot, { backgroundColor: theme.warning }]} />
              <Text style={styles.pStatValue}>{pendingCount}</Text>
              <Text style={styles.pStatLabel}>{t('meetup', 'pending')}</Text>
            </View>
          </View>

          {/* Responses list */}
          {responses.length > 0 ? (
            <View style={styles.responsesList}>
              {responses.map(r => (
                <View key={r.id} style={styles.responseItem}>
                  <View style={[styles.responseAvatar, {
                    backgroundColor: r.status === 'accepted' ? theme.success + '15' : r.status === 'declined' ? theme.error + '15' : theme.warning + '15',
                  }]}>
                    <MaterialIcons
                      name={r.status === 'accepted' ? 'check' : r.status === 'declined' ? 'close' : 'schedule'}
                      size={16}
                      color={r.status === 'accepted' ? theme.success : r.status === 'declined' ? theme.error : theme.warning}
                    />
                  </View>
                  <Text style={styles.responseName}>{r.user_name || t('meetup', 'unknownUser')}</Text>
                  <Text style={[styles.responseStatus, {
                    color: r.status === 'accepted' ? theme.success : r.status === 'declined' ? theme.error : theme.warning,
                  }]}>
                    {r.status === 'accepted' ? t('meetup', 'accepted') : r.status === 'declined' ? t('meetup', 'declined') : t('meetup', 'pending')}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noResponses}>
              <MaterialIcons name="group" size={32} color={theme.textMuted} />
              <Text style={styles.noResponsesText}>{t('meetup', 'noResponsesYet')}</Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom Action - Response Buttons or Cancel */}
      {!isPast && meetup.status === 'active' ? (
        <View style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}>
          {isCreator ? (
            <Pressable style={styles.cancelMeetupBtn} onPress={handleCancel}>
              <MaterialIcons name="cancel" size={20} color={theme.error} />
              <Text style={styles.cancelMeetupBtnText}>{t('meetup', 'cancelMeetup')}</Text>
            </Pressable>
          ) : (
            <View style={styles.responseBtns}>
              <Pressable
                style={[styles.responseBtn, styles.declineBtn, myStatus === 'declined' && styles.responseBtnActive]}
                onPress={() => handleRespond('declined')}
                disabled={responding}
              >
                <MaterialIcons name="close" size={22} color={myStatus === 'declined' ? '#FFF' : theme.error} />
                <Text style={[styles.responseBtnText, { color: myStatus === 'declined' ? '#FFF' : theme.error }]}>
                  {t('meetup', 'decline')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.responseBtn, styles.acceptBtn, myStatus === 'accepted' && styles.responseBtnActiveAccept]}
                onPress={() => handleRespond('accepted')}
                disabled={responding}
              >
                {responding ? (
                  <ActivityIndicator size="small" color={myStatus === 'accepted' ? '#FFF' : theme.success} />
                ) : (
                  <>
                    <MaterialIcons name="check" size={22} color={myStatus === 'accepted' ? '#FFF' : theme.success} />
                    <Text style={[styles.responseBtnText, { color: myStatus === 'accepted' ? '#FFF' : theme.success }]}>
                      {t('meetup', 'accept')}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  headerActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16, color: theme.textMuted },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  // Status Banner
  statusBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, marginBottom: 16 },
  statusBannerText: { fontSize: 14, fontWeight: '700' },
  // Hero
  heroCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, ...theme.shadows.cardElevated, borderWidth: 1, borderColor: theme.border },
  heroIconBg: { width: 64, height: 64, borderRadius: 20, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: theme.textPrimary, textAlign: 'center', marginBottom: 16 },
  heroInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  heroInfoText: { fontSize: 15, color: theme.textSecondary },
  terrainRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: theme.primary + '08', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  terrainRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.primary },
  notesBox: { marginTop: 16, backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 14, width: '100%' },
  notesText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  // Share Code
  shareCodeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: theme.primary + '25', ...theme.shadows.card },
  shareCodeLeft: { flex: 1 },
  shareCodeLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  shareCodeValue: { fontSize: 22, fontWeight: '900', color: theme.primary, letterSpacing: 2 },
  shareCodeCopy: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' },
  // Participants
  participantsCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 20, marginBottom: 16, ...theme.shadows.card, borderWidth: 1, borderColor: theme.border },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  participantsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  pStatItem: { alignItems: 'center', gap: 4 },
  pStatDot: { width: 8, height: 8, borderRadius: 4 },
  pStatValue: { fontSize: 24, fontWeight: '900', color: theme.textPrimary },
  pStatLabel: { fontSize: 11, color: theme.textSecondary, fontWeight: '600' },
  responsesList: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14, gap: 10 },
  responseItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  responseAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  responseName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.textPrimary },
  responseStatus: { fontSize: 12, fontWeight: '700' },
  noResponses: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  noResponsesText: { fontSize: 14, color: theme.textMuted },
  // Bottom Action
  bottomAction: { paddingHorizontal: 16, paddingTop: 14, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border },
  cancelMeetupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, backgroundColor: theme.error + '10', borderWidth: 1.5, borderColor: theme.error + '30' },
  cancelMeetupBtnText: { fontSize: 16, fontWeight: '700', color: theme.error },
  responseBtns: { flexDirection: 'row', gap: 12 },
  responseBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 2 },
  declineBtn: { borderColor: theme.error + '30', backgroundColor: theme.error + '08' },
  acceptBtn: { borderColor: theme.success + '30', backgroundColor: theme.success + '08' },
  responseBtnActive: { backgroundColor: theme.error, borderColor: theme.error },
  responseBtnActiveAccept: { backgroundColor: theme.success, borderColor: theme.success },
  responseBtnText: { fontSize: 16, fontWeight: '700' },
});
