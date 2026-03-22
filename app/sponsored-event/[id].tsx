import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform, RefreshControl, Share as RNShare } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import theme, { blurhash } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import {
  getSponsoredEvent, getEventParticipants, getMyParticipationStatus,
  registerForEvent, declineEvent, attestAsWitness, publishResults,
  cancelSponsoredEvent, SponsoredEvent, SponsoredEventParticipant,
} from '@/services/sponsoredEventService';

export default function SponsoredEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [event, setEvent] = useState<SponsoredEvent | null>(null);
  const [participants, setParticipants] = useState<SponsoredEventParticipant[]>([]);
  const [myStatus, setMyStatus] = useState<string | null>(null);

  const isCreator = event?.creatorUserId === user?.id;
  const acceptedCount = participants.filter(p => p.status === 'accepted' || p.status === 'completed').length;
  const completedCount = participants.filter(p => p.status === 'completed').length;

  const loadData = useCallback(async () => {
    if (!id) return;
    const [{ event: ev }, { participants: parts }, status] = await Promise.all([
      getSponsoredEvent(id),
      getEventParticipants(id),
      getMyParticipationStatus(id),
    ]);
    setEvent(ev);
    setParticipants(parts);
    setMyStatus(status);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleRegister = async () => {
    if (!id) return;
    const { error } = await registerForEvent(id);
    if (error) { showAlert(language === 'fr' ? 'Erreur' : 'Error', error); return; }
    setMyStatus('accepted');
    loadData();
  };

  const handleDecline = async () => {
    if (!id) return;
    await declineEvent(id);
    setMyStatus('declined');
    loadData();
  };

  const handleAttest = async (participantId: string) => {
    if (!id) return;
    const { error } = await attestAsWitness(id, participantId);
    if (error) { showAlert(language === 'fr' ? 'Erreur' : 'Error', error); return; }
    showAlert(language === 'fr' ? 'Attestation enregistree' : 'Attestation recorded');
    loadData();
  };

  const handlePublish = async () => {
    if (!id) return;
    showAlert(language === 'fr' ? 'Publier les resultats ?' : 'Publish results?', language === 'fr' ? 'Les classements seront calcules et publies.' : 'Rankings will be calculated and published.', [
      { text: language === 'fr' ? 'Annuler' : 'Cancel', style: 'cancel' },
      { text: language === 'fr' ? 'Publier' : 'Publish', onPress: async () => {
        const { error } = await publishResults(id);
        if (error) { showAlert('Error', error); return; }
        loadData();
      }},
    ]);
  };

  const handleCancel = async () => {
    if (!id) return;
    showAlert(language === 'fr' ? 'Annuler l\'evenement ?' : 'Cancel event?', '', [
      { text: language === 'fr' ? 'Non' : 'No', style: 'cancel' },
      { text: language === 'fr' ? 'Oui' : 'Yes', style: 'destructive', onPress: async () => {
        await cancelSponsoredEvent(id);
        router.back();
      }},
    ]);
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await RNShare.share({ message: `${event.title}\nCode: ${event.shareCode}\nUltimate Petanque` });
    } catch {}
  };

  const challengeName = (type: string) => type === '10_tirs' ? '10 Tirs' : type === '10_tirs_sautee' ? '10 Tirs sautee' : 'Precision';

  if (loading) {
    return <SafeAreaView style={s.container}><View style={s.loadingWrap}><ActivityIndicator size="large" color={theme.primary} /></View></SafeAreaView>;
  }

  if (!event) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.headerRow}><Pressable onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} /></Pressable></View>
        <View style={s.loadingWrap}><Text style={{ color: theme.textMuted, fontSize: 16 }}>{language === 'fr' ? 'Evenement introuvable' : 'Event not found'}</Text></View>
      </SafeAreaView>
    );
  }

  const eventDateObj = new Date(event.startTime);
  const endDateObj = new Date(event.endTime);
  const isActive = event.status === 'active' || (event.status === 'upcoming' && new Date() >= eventDateObj && new Date() <= endDateObj);
  const isPast = event.status === 'completed' || new Date() > endDateObj;
  const rankedParticipants = [...participants].filter(p => p.status === 'completed' && p.rank).sort((a, b) => (a.rank || 99) - (b.rank || 99));

  return (
    <SafeAreaView style={s.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}>

        {/* Header */}
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color="#FFF" /></Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={s.shareBtn} onPress={handleShare}><MaterialIcons name="share" size={20} color="#FFF" /></Pressable>
        </View>

        <LinearGradient colors={['#7C3AED', '#9333EA', '#A855F7']} style={s.heroGradient}>
          <View style={s.statusBadge}>
            <View style={[s.statusDot, { backgroundColor: event.status === 'active' ? '#22C55E' : event.status === 'completed' ? '#3B82F6' : event.status === 'cancelled' ? '#EF4444' : '#F59E0B' }]} />
            <Text style={s.statusText}>{event.status === 'upcoming' ? (language === 'fr' ? 'A venir' : 'Upcoming') : event.status === 'active' ? (language === 'fr' ? 'En cours' : 'Active') : event.status === 'completed' ? (language === 'fr' ? 'Termine' : 'Completed') : (language === 'fr' ? 'Annule' : 'Cancelled')}</Text>
          </View>
          <Text style={s.heroTitle}>{event.title}</Text>
          <View style={s.heroMeta}>
            <View style={s.heroMetaItem}><MaterialIcons name="track-changes" size={14} color="rgba(255,255,255,0.7)" /><Text style={s.heroMetaText}>{challengeName(event.challengeType)}</Text></View>
            <View style={s.heroMetaItem}><MaterialIcons name="event" size={14} color="rgba(255,255,255,0.7)" /><Text style={s.heroMetaText}>{eventDateObj.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Text></View>
            <View style={s.heroMetaItem}><MaterialIcons name="schedule" size={14} color="rgba(255,255,255,0.7)" /><Text style={s.heroMetaText}>{eventDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View>
          </View>
          {event.ambassadorName ? (
            <View style={s.sponsorRow}>
              {event.ambassadorPhoto ? <Image source={{ uri: event.ambassadorPhoto }} style={s.sponsorAvatar} contentFit="cover" transition={200} cachePolicy="memory-disk" /> : null}
              <Text style={s.sponsorName}>{language === 'fr' ? 'Par' : 'By'} {event.ambassadorName}</Text>
              <MaterialIcons name="verified" size={14} color="rgba(255,255,255,0.6)" />
            </View>
          ) : null}
        </LinearGradient>

        {/* Share Code */}
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>{language === 'fr' ? 'Code evenement' : 'Event code'}</Text>
          <Text style={s.codeValue}>{event.shareCode}</Text>
          <Text style={s.codeHint}>{language === 'fr' ? 'Partagez ce code pour inviter des participants' : 'Share this code to invite participants'}</Text>
        </View>

        {/* Info Grid */}
        <View style={s.infoGrid}>
          <View style={s.infoItem}>
            <MaterialIcons name={event.scope === 'terrain' ? 'place' : event.scope === 'city' ? 'location-city' : event.scope === 'country' ? 'flag' : 'public'} size={20} color={theme.primary} />
            <Text style={s.infoValue}>{event.terrainName || event.city || event.country || (language === 'fr' ? 'Mondial' : 'World')}</Text>
            <Text style={s.infoLabel}>{language === 'fr' ? 'Zone' : 'Zone'}</Text>
          </View>
          <View style={s.infoItem}>
            <MaterialIcons name="group" size={20} color={theme.success} />
            <Text style={s.infoValue}>{acceptedCount}/{event.maxParticipants}</Text>
            <Text style={s.infoLabel}>{language === 'fr' ? 'Inscrits' : 'Registered'}</Text>
          </View>
          <View style={s.infoItem}>
            <MaterialIcons name="visibility" size={20} color={theme.accent} />
            <Text style={s.infoValue}>{event.minWitnesses}</Text>
            <Text style={s.infoLabel}>{language === 'fr' ? 'Temoins min.' : 'Min. witnesses'}</Text>
          </View>
        </View>

        {event.description ? <View style={s.descCard}><Text style={s.descText}>{event.description}</Text></View> : null}

        {/* Registration CTA */}
        {!isCreator && !isPast && event.status !== 'cancelled' ? (
          <View style={s.ctaSection}>
            {myStatus === 'accepted' || myStatus === 'completed' ? (
              <View style={s.registeredBadge}>
                <MaterialIcons name="check-circle" size={20} color={theme.success} />
                <Text style={s.registeredText}>{language === 'fr' ? 'Vous etes inscrit' : 'You are registered'}</Text>
              </View>
            ) : myStatus === 'declined' ? (
              <View style={s.declinedBadge}>
                <MaterialIcons name="cancel" size={20} color={theme.textMuted} />
                <Text style={s.declinedText}>{language === 'fr' ? 'Vous avez decline' : 'You declined'}</Text>
                <Pressable style={s.reRegisterBtn} onPress={handleRegister}><Text style={s.reRegisterText}>{language === 'fr' ? 'Changer d\'avis' : 'Change mind'}</Text></Pressable>
              </View>
            ) : (
              <View style={s.ctaButtons}>
                <Pressable style={s.registerBtn} onPress={handleRegister}>
                  <MaterialIcons name="how-to-reg" size={20} color="#FFF" />
                  <Text style={s.registerBtnText}>{language === 'fr' ? 'S\'inscrire' : 'Register'}</Text>
                </Pressable>
                <Pressable style={s.declineBtn} onPress={handleDecline}>
                  <Text style={s.declineBtnText}>{language === 'fr' ? 'Decliner' : 'Decline'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {/* Results / Rankings */}
        {event.resultsPublished && rankedParticipants.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <MaterialIcons name="emoji-events" size={18} color={theme.carreauColor} />
              <Text style={s.sectionTitle}>{language === 'fr' ? 'Classement' : 'Rankings'}</Text>
            </View>
            {rankedParticipants.map((p) => {
              const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : null;
              return (
                <View key={p.id} style={[s.rankRow, p.rank === 1 && { backgroundColor: '#FEF3C7' }]}>
                  <Text style={s.rankNum}>{medal || `#${p.rank}`}</Text>
                  {p.userAvatar ? <Image source={{ uri: p.userAvatar }} style={s.rankAvatar} contentFit="cover" cachePolicy="memory-disk" /> : <View style={[s.rankAvatar, { backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontWeight: '700', color: theme.primary }}>{p.userName?.charAt(0)}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={s.rankName}>{p.userName}</Text>
                    <View style={s.rankWitnessRow}>
                      <MaterialIcons name="visibility" size={11} color={p.witnessesAttested! >= event.minWitnesses ? theme.success : theme.textMuted} />
                      <Text style={[s.rankWitnessText, p.witnessesAttested! >= event.minWitnesses && { color: theme.success }]}>{p.witnessesAttested}/{event.minWitnesses}</Text>
                    </View>
                  </View>
                  <Text style={s.rankScore}>{p.scoreValue !== undefined ? `${p.scoreValue}%` : '-'}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Participants List */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <MaterialIcons name="group" size={18} color={theme.primary} />
            <Text style={s.sectionTitle}>{language === 'fr' ? 'Participants' : 'Participants'} ({acceptedCount})</Text>
          </View>
          {participants.length === 0 ? (
            <View style={s.emptyParticipants}>
              <MaterialIcons name="person-add" size={32} color={theme.textMuted} />
              <Text style={s.emptyParticipantsText}>{language === 'fr' ? 'Aucun participant' : 'No participants'}</Text>
            </View>
          ) : (
            participants.filter(p => p.status !== 'declined').map((p) => (
              <View key={p.id} style={s.participantRow}>
                {p.userAvatar ? <Image source={{ uri: p.userAvatar }} style={s.participantAvatar} contentFit="cover" cachePolicy="memory-disk" /> : <View style={[s.participantAvatar, { backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontWeight: '700', color: theme.primary, fontSize: 13 }}>{p.userName?.charAt(0)}</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={s.participantName}>{p.userName} {p.userId === user?.id ? (language === 'fr' ? '(Vous)' : '(You)') : ''}</Text>
                  <View style={s.participantStatusRow}>
                    <View style={[s.participantStatusBadge, { backgroundColor: p.status === 'completed' ? theme.success + '15' : p.status === 'accepted' ? theme.primary + '15' : theme.warning + '15' }]}>
                      <Text style={[s.participantStatusText, { color: p.status === 'completed' ? theme.success : p.status === 'accepted' ? theme.primary : theme.warning }]}>{p.status === 'completed' ? (language === 'fr' ? 'Termine' : 'Done') : p.status === 'accepted' ? (language === 'fr' ? 'Inscrit' : 'Registered') : (language === 'fr' ? 'En attente' : 'Pending')}</Text>
                    </View>
                    {p.status === 'completed' ? (
                      <View style={s.witnessInfo}>
                        <MaterialIcons name="visibility" size={12} color={p.witnessesAttested! >= event.minWitnesses ? theme.success : theme.warning} />
                        <Text style={s.witnessInfoText}>{p.witnessesAttested}/{event.minWitnesses}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {p.status === 'completed' && p.scoreValue !== undefined ? <Text style={s.participantScore}>{p.scoreValue}%</Text> : null}
                {/* Attest button (if not self and participant completed) */}
                {p.status === 'completed' && p.userId !== user?.id ? (
                  <Pressable style={s.attestBtn} onPress={() => handleAttest(p.id)}>
                    <MaterialIcons name="verified" size={16} color={theme.success} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>

        {/* Creator Actions */}
        {isCreator ? (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <MaterialIcons name="settings" size={18} color={theme.textSecondary} />
              <Text style={s.sectionTitle}>{language === 'fr' ? 'Actions' : 'Actions'}</Text>
            </View>
            {!event.resultsPublished && completedCount > 0 ? (
              <Pressable style={s.actionBtn} onPress={handlePublish}>
                <MaterialIcons name="leaderboard" size={20} color={theme.carreauColor} />
                <Text style={s.actionBtnText}>{language === 'fr' ? 'Publier les resultats' : 'Publish results'}</Text>
              </Pressable>
            ) : null}
            {event.status !== 'cancelled' && event.status !== 'completed' ? (
              <Pressable style={[s.actionBtn, { borderColor: theme.error + '30' }]} onPress={handleCancel}>
                <MaterialIcons name="cancel" size={20} color={theme.error} />
                <Text style={[s.actionBtnText, { color: theme.error }]}>{language === 'fr' ? 'Annuler l\'evenement' : 'Cancel event'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { maxWidth: 640, alignSelf: 'center' as const, width: '100%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  heroGradient: { padding: 24, paddingTop: 64, paddingBottom: 28 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#FFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 10 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  sponsorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  sponsorAvatar: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  sponsorName: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  // Code
  codeCard: { backgroundColor: '#FFF', margin: 16, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  codeLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  codeValue: { fontSize: 28, fontWeight: '900', color: '#7C3AED', letterSpacing: 3, marginBottom: 4 },
  codeHint: { fontSize: 12, color: theme.textMuted },
  // Info Grid
  infoGrid: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 16 },
  infoItem: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  infoValue: { fontSize: 15, fontWeight: '800', color: theme.textPrimary, marginTop: 6, textAlign: 'center' },
  infoLabel: { fontSize: 10, fontWeight: '600', color: theme.textMuted, marginTop: 2, textTransform: 'uppercase' },
  descCard: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  descText: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
  // CTA
  ctaSection: { marginHorizontal: 16, marginBottom: 20 },
  ctaButtons: { flexDirection: 'row', gap: 10 },
  registerBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 16 },
  registerBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  declineBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, backgroundColor: '#F1F5F9' },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  registeredBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.success + '10', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.success + '20' },
  registeredText: { fontSize: 15, fontWeight: '600', color: theme.success },
  declinedBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', borderRadius: 14, padding: 16 },
  declinedText: { fontSize: 15, fontWeight: '600', color: theme.textMuted, flex: 1 },
  reRegisterBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '10', borderRadius: 8 },
  reRegisterText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  // Section
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  // Participants
  emptyParticipants: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  emptyParticipantsText: { fontSize: 14, color: theme.textMuted, marginTop: 8 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#F1F5F9' },
  participantAvatar: { width: 38, height: 38, borderRadius: 12, overflow: 'hidden' },
  participantName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  participantStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  participantStatusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  participantStatusText: { fontSize: 10, fontWeight: '700' },
  witnessInfo: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  witnessInfoText: { fontSize: 10, fontWeight: '600', color: theme.textMuted },
  participantScore: { fontSize: 18, fontWeight: '900', color: theme.primary },
  attestBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.success + '10', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.success + '20' },
  // Rankings
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#F1F5F9' },
  rankNum: { fontSize: 18, fontWeight: '900', color: theme.textPrimary, minWidth: 36, textAlign: 'center' },
  rankAvatar: { width: 36, height: 36, borderRadius: 12, overflow: 'hidden' },
  rankName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },
  rankWitnessRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  rankWitnessText: { fontSize: 10, fontWeight: '600', color: theme.textMuted },
  rankScore: { fontSize: 20, fontWeight: '900', color: theme.success },
  // Actions
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: theme.textPrimary },
});
