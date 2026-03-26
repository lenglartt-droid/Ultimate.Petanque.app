import React, { memo, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, TextInput, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import theme from '@/constants/theme';
import { TimelineSkeleton } from '@/components/ui/SkeletonLoader';
import { findMeetupByCode } from '@/services/meetupService';

interface UpcomingItem {
  id: string;
  type: 'tournament' | 'meetup' | 'challenge';
  date: Date;
  data: any;
}

interface Props {
  tournaments: any[];
  meetups: any[];
  upcomingEvents: any[];
  meetupsLoading: boolean;
  eventsLoading: boolean;
  pendingInviteCount: number;
  language: string;
  t: (ns: string, key: string) => string;
  now: number;
  onShowJoinMeetup: () => void;
  onShowMeetupList: () => void;
  onJoinSuccess?: (meetupId: string) => void;
}

function UpcomingTimeline({
  tournaments, meetups, upcomingEvents, meetupsLoading, eventsLoading,
  pendingInviteCount, language, t, now, onShowJoinMeetup, onShowMeetupList, onJoinSuccess,
}: Props) {
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const handleJoinByCode = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    setJoinError('');
    try {
      const { meetup: found } = await findMeetupByCode(code);
      if (!found) {
        setJoinError(language === 'fr' ? 'Code invalide ou RDV introuvable' : 'Invalid code or meetup not found');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setJoinCode('');
        if (onJoinSuccess) onJoinSuccess(found.id);
        else router.push(`/meetup/${found.id}` as any);
      }
    } catch {
      setJoinError(language === 'fr' ? 'Erreur de connexion' : 'Connection error');
    } finally {
      setJoining(false);
    }
  }, [joinCode, language, onJoinSuccess]);
  const typeConfig = {
    meetup: { bg: '#E0F2FE', accent: '#0369A1', icon: 'event' as const, label: language === 'fr' ? 'RDV' : 'Meetup' },
    tournament: { bg: '#FEF3C7', accent: '#B45309', icon: 'emoji-events' as const, label: language === 'fr' ? 'Tournoi' : 'Tournament' },
    challenge: { bg: '#EDE9FE', accent: '#7C3AED', icon: 'campaign' as const, label: language === 'fr' ? 'Defi' : 'Challenge' },
  };

  // Build unified items
  const items: UpcomingItem[] = [];
  tournaments
    .filter((tr: any) => tr.status === 'À venir' || tr.status === 'En cours')
    .forEach((tr: any) => items.push({ id: `t-${tr.id}`, type: 'tournament', date: new Date(tr.date), data: tr }));
  meetups.forEach(m => items.push({ id: `m-${m.id}`, type: 'meetup', date: new Date(m.date), data: m }));
  upcomingEvents.forEach(e => items.push({ id: `e-${e.id}`, type: 'challenge', date: new Date(e.eventDate), data: e }));
  items.sort((a, b) => a.date.getTime() - b.date.getTime());
  const visibleItems = items.slice(0, 6);

  return (
    <View>
      <View style={s.headerRow}>
        <MaterialIcons name="event-note" size={18} color={theme.primary} />
        <Text style={s.headerTitle}>{t('home', 'upcoming')}</Text>
        <View style={{ flex: 1 }} />
        <View style={s.actions}>
          {pendingInviteCount > 0 ? (
            <Pressable style={s.actionBtn} onPress={() => router.push('/meetup/invitations' as any)}>
              <MaterialIcons name="mail" size={14} color={theme.error} />
              <View style={s.actionBadge}><Text style={s.actionBadgeText}>{pendingInviteCount > 9 ? '9+' : pendingInviteCount}</Text></View>
            </Pressable>
          ) : null}
          <Pressable style={s.joinBtn} onPress={onShowJoinMeetup}>
            <MaterialIcons name="event" size={14} color="#FFF" />
            <Text style={s.joinBtnText}>{language === 'fr' ? 'Rejoindre RDV' : 'Join Meetup'}</Text>
          </Pressable>
        </View>
      </View>

      {(meetupsLoading || eventsLoading) ? (
        <TimelineSkeleton items={3} />
      ) : visibleItems.length === 0 ? (
        <View style={s.emptyWrap}>
          {/* Prominent Join Meetup Card */}
          <View style={s.joinCard}>
            <View style={s.joinCardHeader}>
              <View style={s.joinCardIconBg}>
                <MaterialIcons name="qr-code-2" size={32} color="#0369A1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.joinCardTitle}>{language === 'fr' ? 'Rejoindre un RDV' : 'Join a Meetup'}</Text>
                <Text style={s.joinCardDesc}>{language === 'fr' ? 'Entrez le code ou scannez le QR' : 'Enter the code or scan the QR'}</Text>
              </View>
              <Pressable style={s.joinScanBtn} onPress={() => router.push('/scanner' as any)}>
                <MaterialIcons name="qr-code-scanner" size={20} color="#0369A1" />
              </Pressable>
            </View>
            <View style={s.joinInputRow}>
              <View style={s.joinInputWrap}>
                <MaterialIcons name="tag" size={18} color={joinCode ? '#0369A1' : '#94A3B8'} />
                <TextInput
                  style={s.joinInput}
                  value={joinCode}
                  onChangeText={(text) => { setJoinCode(text.toUpperCase()); if (joinError) setJoinError(''); }}
                  placeholder={language === 'fr' ? 'CODE DU RDV' : 'MEETUP CODE'}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  maxLength={10}
                  editable={!joining}
                  returnKeyType="go"
                  onSubmitEditing={handleJoinByCode}
                />
              </View>
              <Pressable
                style={[s.joinSubmitBtn, !joinCode.trim() && s.joinSubmitBtnDisabled]}
                onPress={handleJoinByCode}
                disabled={!joinCode.trim() || joining}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="login" size={16} color="#FFF" />
                    <Text style={s.joinSubmitText}>{language === 'fr' ? 'Rejoindre' : 'Join'}</Text>
                  </>
                )}
              </Pressable>
            </View>
            {joinError ? (
              <View style={s.joinErrorRow}>
                <MaterialIcons name="error-outline" size={13} color="#DC2626" />
                <Text style={s.joinErrorText}>{joinError}</Text>
              </View>
            ) : null}
          </View>

          {/* Empty state */}
          <View style={s.empty}>
            <View style={s.emptyIcon}><MaterialIcons name="event-available" size={36} color={theme.textMuted} /></View>
            <Text style={s.emptyTitle}>{language === 'fr' ? 'Rien de prevu' : 'Nothing planned'}</Text>
            <Text style={s.emptyDesc}>{language === 'fr' ? 'Planifie un RDV, un tournoi ou un defi.' : 'Plan a meetup, tournament or challenge.'}</Text>
            <View style={s.emptyActions}>
              <Pressable style={[s.emptyBtn, { backgroundColor: '#0369A1' }]} onPress={() => router.push('/meetup/new' as any)}>
                <MaterialIcons name="event" size={16} color="#FFF" />
                <Text style={s.emptyBtnText}>{language === 'fr' ? 'RDV' : 'Meetup'}</Text>
              </Pressable>
              <Pressable style={[s.emptyBtn, { backgroundColor: '#B45309' }]} onPress={() => router.push('/tournament/new' as any)}>
                <MaterialIcons name="emoji-events" size={16} color="#FFF" />
                <Text style={s.emptyBtnText}>{language === 'fr' ? 'Tournoi' : 'Tournament'}</Text>
              </Pressable>
              <Pressable style={[s.emptyBtn, { backgroundColor: '#7C3AED' }]} onPress={() => router.push('/sponsored-event/list' as any)}>
                <MaterialIcons name="campaign" size={16} color="#FFF" />
                <Text style={s.emptyBtnText}>{language === 'fr' ? 'Defis' : 'Challenges'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View style={s.timeline}>
          {visibleItems.map((item) => {
            const cfg = typeConfig[item.type];
            const d = item.date;
            const daysUntil = Math.max(0, Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const isToday = daysUntil === 0;
            const isTomorrow = daysUntil === 1;

            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [s.card, { borderLeftColor: cfg.accent, backgroundColor: cfg.bg }, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}
                onPress={() => {
                  if (item.type === 'tournament') router.push(`/tournament/${item.data.id}`);
                  else if (item.type === 'meetup') router.push(`/meetup/${item.data.id}` as any);
                  else router.push(`/sponsored-event/${item.data.id}` as any);
                }}
              >
                <View style={[s.dateCol, { backgroundColor: cfg.accent + '15' }]}>
                  <Text style={[s.dateDay, { color: cfg.accent }]}>{d.getDate()}</Text>
                  <Text style={[s.dateMonth, { color: cfg.accent }]}>{d.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()}</Text>
                </View>
                <View style={s.content}>
                  <View style={s.contentTop}>
                    <View style={[s.typeBadge, { backgroundColor: cfg.accent + '18' }]}>
                      <MaterialIcons name={cfg.icon} size={10} color={cfg.accent} />
                      <Text style={[s.typeBadgeText, { color: cfg.accent }]}>{cfg.label}</Text>
                    </View>
                    {(isToday || isTomorrow) ? (
                      <View style={[s.soonBadge, isToday && { backgroundColor: '#FEE2E2' }]}>
                        {isToday ? <MaterialIcons name="local-fire-department" size={10} color="#DC2626" /> : null}
                        <Text style={[s.soonText, isToday && { color: '#DC2626' }]}>{isToday ? t('notifications', 'todayLabel') : t('notifications', 'tomorrowLabel')}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[s.title, { color: cfg.accent }]} numberOfLines={1}>
                    {item.type === 'tournament' ? item.data.name : item.data.title}
                  </Text>
                  <View style={s.meta}>
                    <View style={s.metaItem}>
                      <MaterialIcons name="schedule" size={11} color={cfg.accent + '90'} />
                      <Text style={[s.metaText, { color: cfg.accent + '90' }]}>
                        {item.type === 'challenge'
                          ? new Date(item.data.startTime).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
                          : d.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {(item.type === 'tournament' && item.data.location?.city) ? (
                      <View style={s.metaItem}><MaterialIcons name="place" size={11} color={cfg.accent + '90'} /><Text style={[s.metaText, { color: cfg.accent + '90' }]} numberOfLines={1}>{item.data.location.city}</Text></View>
                    ) : (item.type === 'challenge' && item.data.city) ? (
                      <View style={s.metaItem}><MaterialIcons name="place" size={11} color={cfg.accent + '90'} /><Text style={[s.metaText, { color: cfg.accent + '90' }]} numberOfLines={1}>{item.data.city}</Text></View>
                    ) : null}
                    {item.type === 'meetup' ? (
                      <View style={s.metaItem}><MaterialIcons name="group" size={11} color={cfg.accent + '90'} /><Text style={[s.metaText, { color: cfg.accent + '90' }]}>{item.data._acceptedCount || 0}/{item.data._maxParticipants || 8}</Text></View>
                    ) : item.type === 'challenge' && item.data.ambassadorName ? (
                      <View style={s.metaItem}><MaterialIcons name="verified" size={11} color="#7C3AED" /><Text style={[s.metaText, { color: '#7C3AED' }]} numberOfLines={1}>{item.data.ambassadorName}</Text></View>
                    ) : item.type === 'tournament' ? (
                      <View style={s.metaItem}><MaterialIcons name="sports" size={11} color={cfg.accent + '90'} /><Text style={[s.metaText, { color: cfg.accent + '90' }]}>{t('formats', item.data.format)}</Text></View>
                    ) : null}
                  </View>
                  {(() => {
                    const diffMs = d.getTime() - now;
                    if (diffMs <= 0 || isToday || isTomorrow) return null;
                    const cDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const cHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const cMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    return (
                      <View style={[s.countdown, { backgroundColor: cfg.accent + '10' }]}>
                        <MaterialIcons name="timer" size={11} color={cfg.accent} />
                        <Text style={[s.countdownText, { color: cfg.accent }]}>
                          {cDays > 0 ? (language === 'fr' ? `dans ${cDays}j ${cHours}h` : `in ${cDays}d ${cHours}h`) : (language === 'fr' ? `dans ${cHours}h ${cMinutes}min` : `in ${cHours}h ${cMinutes}min`)}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <MaterialIcons name="chevron-right" size={18} color={cfg.accent + '60'} />
              </Pressable>
            );
          })}

          <View style={s.addRow}>
            <Pressable style={[s.addBtn, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' }]} onPress={() => router.push('/meetup/new' as any)}>
              <MaterialIcons name="event" size={15} color="#0369A1" />
              <Text style={[s.addBtnText, { color: '#0369A1' }]}>+ {language === 'fr' ? 'RDV' : 'Meetup'}</Text>
            </Pressable>
            <Pressable style={[s.addBtn, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]} onPress={() => router.push('/tournament/new' as any)}>
              <MaterialIcons name="emoji-events" size={15} color="#B45309" />
              <Text style={[s.addBtnText, { color: '#B45309' }]}>+ {language === 'fr' ? 'Tournoi' : 'Tournament'}</Text>
            </Pressable>
            <Pressable style={[s.addBtn, { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' }]} onPress={() => router.push('/sponsored-event/list' as any)}>
              <MaterialIcons name="campaign" size={15} color="#7C3AED" />
              <Text style={[s.addBtnText, { color: '#7C3AED' }]}>+ {language === 'fr' ? 'Defi' : 'Challenge'}</Text>
            </Pressable>
          </View>

          {items.length > 6 ? (
            <Pressable style={s.moreLink} onPress={onShowMeetupList}>
              <Text style={s.moreText}>+{items.length - 6} {language === 'fr' ? 'autre(s)' : 'more'}</Text>
              <MaterialIcons name="chevron-right" size={14} color={theme.primary} />
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default memo(UpcomingTimeline);

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  actionBadge: { position: 'absolute' as const, top: -4, right: -4, backgroundColor: theme.error, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#F8FAFC' },
  actionBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  joinBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: '#0369A1', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: '#0284C7', shadowColor: '#0369A1', shadowOffset: { width: 0, height: 2 } as const, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  joinBtnText: { fontSize: 12, fontWeight: '800' as const, color: '#FFF', letterSpacing: 0.3 },
  timeline: { gap: 8 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, gap: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: 'transparent', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }, android: { elevation: 1 }, default: {} }) },
  dateCol: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  dateMonth: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3, marginTop: 1 },
  content: { flex: 1, gap: 4 },
  contentTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  soonBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  soonText: { fontSize: 9, fontWeight: '700', color: '#B45309' },
  title: { fontSize: 14, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, fontWeight: '600' },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start', marginTop: 2 },
  countdownText: { fontSize: 11, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  addBtnText: { fontSize: 11, fontWeight: '700' },
  moreLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, marginTop: 4 },
  moreText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  emptyWrap: { gap: 12 },
  // Join card
  joinCard: { backgroundColor: '#F0F9FF', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: '#BAE6FD' },
  joinCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  joinCardIconBg: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BAE6FD' },
  joinCardTitle: { fontSize: 16, fontWeight: '700', color: '#0C4A6E' },
  joinCardDesc: { fontSize: 12, color: '#0369A1', marginTop: 2 },
  joinScanBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BAE6FD' },
  joinInputRow: { flexDirection: 'row', gap: 10 },
  joinInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#BAE6FD' },
  joinInput: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0C4A6E', paddingVertical: Platform.select({ ios: 13, android: 10, default: 12 }), letterSpacing: 1.5 },
  joinSubmitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0369A1', paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center' },
  joinSubmitBtnDisabled: { backgroundColor: '#93C5FD', opacity: 0.6 },
  joinSubmitText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  joinErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 },
  joinErrorText: { fontSize: 12, color: '#DC2626', fontWeight: '500' },
  empty: { backgroundColor: '#FFF', borderRadius: 18, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  emptyActions: { flexDirection: 'row', gap: 8 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
});
