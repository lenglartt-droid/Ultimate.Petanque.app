import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl, TextInput, FlatList, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import theme, { blurhash } from '@/constants/theme';
import { useAuth, useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { getSponsoredEvents, registerForEvent, findEventByCode, SponsoredEvent } from '@/services/sponsoredEventService';

type StatusFilter = 'all' | 'upcoming' | 'active' | 'completed';
type TypeFilter = 'all' | '10_tirs' | '10_tirs_sautee' | 'precision';
type ScopeFilter = 'all' | 'terrain' | 'city' | 'country' | 'world';

export default function SponsoredEventListScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ joinCode?: string }>();
  const fr = language === 'fr';

  const [events, setEvents] = useState<SponsoredEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [search, setSearch] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);

  // Auto-fill join code from deep link params
  useEffect(() => {
    if (params.joinCode) {
      setJoinCode(params.joinCode);
      setShowJoinModal(true);
      // Auto-search after a short delay
      const timer = setTimeout(async () => {
        const { event } = await findEventByCode(params.joinCode!);
        if (event) {
          setShowJoinModal(false);
          setJoinCode('');
          router.push(`/sponsored-event/${event.id}` as any);
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [params.joinCode]);

  const loadEvents = useCallback(async () => {
    const { events: evts } = await getSponsoredEvents(statusFilter === 'all' ? undefined : statusFilter);
    setEvents(evts);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { setLoading(true); loadEvents(); }, [loadEvents]);

  const handleRefresh = async () => { setRefreshing(true); await loadEvents(); setRefreshing(false); };

  const filtered = useMemo(() => {
    let result = events;
    if (typeFilter !== 'all') result = result.filter(e => e.challengeType === typeFilter);
    if (scopeFilter !== 'all') result = result.filter(e => e.scope === scopeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q) || (e.ambassadorName || '').toLowerCase().includes(q) || (e.city || '').toLowerCase().includes(q));
    }
    return result;
  }, [events, typeFilter, scopeFilter, search]);

  const handleQuickRegister = async (eventId: string) => {
    setRegisteringId(eventId);
    const { error } = await registerForEvent(eventId);
    setRegisteringId(null);
    if (error) { showAlert(fr ? 'Erreur' : 'Error', error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert(fr ? 'Inscrit !' : 'Registered!');
    loadEvents();
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    setJoinLoading(true);
    const { event } = await findEventByCode(joinCode.trim());
    setJoinLoading(false);
    if (event) {
      setShowJoinModal(false);
      setJoinCode('');
      router.push(`/sponsored-event/${event.id}` as any);
    } else {
      showAlert(fr ? 'Code introuvable' : 'Code not found');
    }
  };

  const challengeName = (type: string) => type === '10_tirs' ? '10 Tirs' : type === '10_tirs_sautee' ? (fr ? '10 Tirs sautee' : '10 Lob Shots') : (fr ? 'Precision' : 'Precision');
  const scopeName = (s: string) => s === 'terrain' ? (fr ? 'Terrain' : 'Court') : s === 'city' ? (fr ? 'Ville' : 'City') : s === 'country' ? (fr ? 'Pays' : 'Country') : (fr ? 'Mondial' : 'World');
  const typeColor: Record<string, string> = { '10_tirs': '#2563EB', '10_tirs_sautee': '#D97706', 'precision': '#7C3AED' };
  const scopeIcon: Record<string, string> = { terrain: 'place', city: 'location-city', country: 'flag', world: 'public' };
  const statusColor: Record<string, string> = { upcoming: '#F59E0B', active: '#22C55E', completed: '#3B82F6', cancelled: '#EF4444' };

  const renderEvent = useCallback(({ item: ev, index }: { item: SponsoredEvent; index: number }) => {
    const evDate = new Date(ev.startTime);
    const endDate = new Date(ev.endTime);
    const isActive = ev.status === 'active' || (ev.status === 'upcoming' && new Date() >= evDate && new Date() <= endDate);
    const isPast = ev.status === 'completed' || new Date() > endDate;
    const daysUntil = Math.max(0, Math.ceil((evDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    return (
      <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index * 60, 300))}>
        <Pressable style={({ pressed }) => [s.eventCard, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]} onPress={() => router.push(`/sponsored-event/${ev.id}` as any)}>
          <View style={s.eventHeader}>
            <View style={[s.eventTypeBadge, { backgroundColor: (typeColor[ev.challengeType] || theme.primary) + '12' }]}>
              <MaterialIcons name={ev.challengeType === '10_tirs' ? 'gps-fixed' : ev.challengeType === 'precision' ? 'stars' : 'flight-takeoff'} size={18} color={typeColor[ev.challengeType] || theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.eventTitle} numberOfLines={2}>{ev.title}</Text>
              <View style={s.eventMetaRow}>
                <View style={[s.statusChip, { backgroundColor: (statusColor[isActive ? 'active' : ev.status] || theme.textMuted) + '15' }]}>
                  <View style={[s.statusDot, { backgroundColor: statusColor[isActive ? 'active' : ev.status] || theme.textMuted }]} />
                  <Text style={[s.statusChipText, { color: statusColor[isActive ? 'active' : ev.status] || theme.textMuted }]}>
                    {isActive ? (fr ? 'En cours' : 'Active') : ev.status === 'upcoming' ? (fr ? 'A venir' : 'Upcoming') : ev.status === 'completed' ? (fr ? 'Termine' : 'Done') : (fr ? 'Annule' : 'Cancelled')}
                  </Text>
                </View>
                <View style={s.eventMetaChip}>
                  <MaterialIcons name={scopeIcon[ev.scope] as any || 'public'} size={11} color={theme.textMuted} />
                  <Text style={s.eventMetaChipText}>{ev.terrainName || ev.city || scopeName(ev.scope)}</Text>
                </View>
              </View>
            </View>
            {!isPast && ev.status !== 'cancelled' && daysUntil <= 3 && daysUntil > 0 ? (
              <View style={s.soonBadge}>
                <Text style={s.soonBadgeText}>{daysUntil === 1 ? (fr ? 'Demain' : 'Tomorrow') : `${daysUntil}${fr ? 'j' : 'd'}`}</Text>
              </View>
            ) : isActive ? (
              <View style={[s.soonBadge, { backgroundColor: '#22C55E' }]}>
                <MaterialIcons name="play-arrow" size={12} color="#FFF" />
                <Text style={s.soonBadgeText}>LIVE</Text>
              </View>
            ) : null}
          </View>

          <View style={s.eventBody}>
            <View style={s.eventInfoRow}>
              <MaterialIcons name="event" size={14} color={theme.textSecondary} />
              <Text style={s.eventInfoText}>{evDate.toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              <View style={s.eventInfoDot} />
              <MaterialIcons name="schedule" size={14} color={theme.textSecondary} />
              <Text style={s.eventInfoText}>{evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <View style={s.eventInfoRow}>
              <MaterialIcons name="track-changes" size={14} color={typeColor[ev.challengeType] || theme.primary} />
              <Text style={[s.eventInfoText, { color: typeColor[ev.challengeType] || theme.primary, fontWeight: '600' }]}>{challengeName(ev.challengeType)}</Text>
              <View style={s.eventInfoDot} />
              <MaterialIcons name="group" size={14} color={theme.textSecondary} />
              <Text style={s.eventInfoText}>{ev.maxParticipants} max</Text>
              <View style={s.eventInfoDot} />
              <MaterialIcons name="visibility" size={14} color={theme.textSecondary} />
              <Text style={s.eventInfoText}>{ev.minWitnesses} {fr ? 'temoins' : 'witnesses'}</Text>
            </View>
          </View>

          {ev.ambassadorName ? (
            <View style={s.eventSponsor}>
              {ev.ambassadorPhoto ? (
                <Image source={{ uri: ev.ambassadorPhoto }} style={s.eventSponsorPhoto} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : null}
              <Text style={s.eventSponsorName}>{fr ? 'Par' : 'By'} {ev.ambassadorName}</Text>
              <MaterialIcons name="verified" size={12} color="#7C3AED" />
            </View>
          ) : null}

          {!isPast && ev.status !== 'cancelled' ? (
            <View style={s.eventActions}>
              <Pressable style={s.eventViewBtn} onPress={() => router.push(`/sponsored-event/${ev.id}` as any)}>
                <MaterialIcons name="visibility" size={14} color={theme.primary} />
                <Text style={s.eventViewBtnText}>{fr ? 'Details' : 'Details'}</Text>
              </Pressable>
              <Pressable style={[s.eventRegisterBtn, registeringId === ev.id && { opacity: 0.6 }]} onPress={() => handleQuickRegister(ev.id)} disabled={registeringId === ev.id}>
                {registeringId === ev.id ? <ActivityIndicator size="small" color="#FFF" /> : (
                  <>
                    <MaterialIcons name="how-to-reg" size={14} color="#FFF" />
                    <Text style={s.eventRegisterBtnText}>{fr ? 'S\'inscrire' : 'Register'}</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  }, [fr, registeringId, loadEvents]);

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <LinearGradient colors={['#7C3AED', '#9333EA', '#A855F7']} style={s.headerGradient}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{fr ? 'Defis Ambassadeurs' : 'Ambassador Challenges'}</Text>
            <Text style={s.headerSubtitle}>{filtered.length} {fr ? 'evenement(s)' : 'event(s)'}</Text>
          </View>
          <Pressable style={s.joinBtn} onPress={() => setShowJoinModal(true)}>
            <MaterialIcons name="qr-code" size={20} color="#FFF" />
          </Pressable>
          <Pressable style={s.createBtn} onPress={() => router.push('/sponsored-event/new' as any)}>
            <MaterialIcons name="add" size={22} color="#FFF" />
          </Pressable>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <MaterialIcons name="search" size={18} color="rgba(255,255,255,0.5)" />
          <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder={fr ? 'Rechercher...' : 'Search...'} placeholderTextColor="rgba(255,255,255,0.4)" />
          {search.length > 0 ? <Pressable onPress={() => setSearch('')}><MaterialIcons name="close" size={16} color="rgba(255,255,255,0.5)" /></Pressable> : null}
        </View>
      </LinearGradient>

      {/* Filters */}
      <View style={s.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {(['all', 'upcoming', 'active', 'completed'] as StatusFilter[]).map(st => (
            <Pressable key={st} style={[s.filterChip, statusFilter === st && s.filterChipActive]} onPress={() => { Haptics.selectionAsync(); setStatusFilter(st); }}>
              <Text style={[s.filterChipText, statusFilter === st && s.filterChipTextActive]}>
                {st === 'all' ? (fr ? 'Tous' : 'All') : st === 'upcoming' ? (fr ? 'A venir' : 'Upcoming') : st === 'active' ? (fr ? 'En cours' : 'Active') : (fr ? 'Termines' : 'Completed')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {(['all', '10_tirs', '10_tirs_sautee', 'precision'] as TypeFilter[]).map(t => (
            <Pressable key={t} style={[s.filterChip, typeFilter === t && { backgroundColor: typeColor[t] || '#7C3AED', borderColor: typeColor[t] || '#7C3AED' }]} onPress={() => { Haptics.selectionAsync(); setTypeFilter(t); }}>
              <Text style={[s.filterChipText, typeFilter === t && { color: '#FFF' }]}>{t === 'all' ? (fr ? 'Tous types' : 'All types') : challengeName(t)}</Text>
            </Pressable>
          ))}
          <View style={{ width: 8 }} />
          {(['all', 'terrain', 'city', 'country', 'world'] as ScopeFilter[]).map(sc => (
            <Pressable key={sc} style={[s.filterChip, scopeFilter === sc && s.filterChipActive]} onPress={() => { Haptics.selectionAsync(); setScopeFilter(sc); }}>
              {sc !== 'all' ? <MaterialIcons name={scopeIcon[sc] as any} size={12} color={scopeFilter === sc ? '#FFF' : theme.textSecondary} /> : null}
              <Text style={[s.filterChipText, scopeFilter === sc && s.filterChipTextActive]}>{sc === 'all' ? (fr ? 'Toutes zones' : 'All zones') : scopeName(sc)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.centerState}><ActivityIndicator size="large" color="#7C3AED" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderEvent}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <MaterialIcons name="campaign" size={56} color={theme.textMuted} />
              <Text style={s.emptyTitle}>{fr ? 'Aucun evenement' : 'No events'}</Text>
              <Text style={s.emptyDesc}>{fr ? 'Les defis ambassadeurs apparaitront ici.' : 'Ambassador challenges will appear here.'}</Text>
            </View>
          }
        />
      )}

      {/* Join by code modal */}
      <Modal visible={showJoinModal} animationType="slide" transparent onRequestClose={() => setShowJoinModal(false)}>
        <View style={s.joinOverlay}>
          <View style={s.joinContent}>
            <View style={s.joinHeader}>
              <Text style={s.joinTitle}>{fr ? 'Rejoindre un evenement' : 'Join an event'}</Text>
              <Pressable onPress={() => setShowJoinModal(false)}><MaterialIcons name="close" size={22} color={theme.textSecondary} /></Pressable>
            </View>
            <Text style={s.joinDesc}>{fr ? 'Saisissez le code de l\'evenement' : 'Enter the event code'}</Text>
            <TextInput style={s.joinInput} value={joinCode} onChangeText={setJoinCode} placeholder="EVT-XXXXXX" placeholderTextColor={theme.textMuted} autoCapitalize="characters" autoFocus />
            <Pressable style={[s.joinSubmitBtn, (!joinCode.trim() || joinLoading) && { opacity: 0.5 }]} onPress={handleJoinByCode} disabled={!joinCode.trim() || joinLoading}>
              {joinLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <MaterialIcons name="search" size={18} color="#FFF" />
                  <Text style={s.joinSubmitText}>{fr ? 'Rechercher' : 'Search'}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerGradient: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  joinBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingHorizontal: 14, height: 42, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#FFF' },
  filtersSection: { paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  filterRow: { paddingHorizontal: 16, gap: 6 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: theme.textSecondary },
  filterChipTextActive: { color: '#FFF' },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 280 },
  // Event card
  eventCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', ...theme.shadows.card },
  eventHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  eventTypeBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 6 },
  eventMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 10, fontWeight: '700' },
  eventMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#F1F5F9', borderRadius: 6 },
  eventMetaChipText: { fontSize: 10, fontWeight: '600', color: theme.textSecondary },
  soonBadge: { backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 3 },
  soonBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  eventBody: { gap: 6, marginBottom: 10 },
  eventInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  eventInfoText: { fontSize: 12, color: theme.textSecondary },
  eventInfoDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.textMuted },
  eventSponsor: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7C3AED08', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  eventSponsorPhoto: { width: 24, height: 24, borderRadius: 8 },
  eventSponsorName: { fontSize: 12, fontWeight: '600', color: '#7C3AED', flex: 1 },
  eventActions: { flexDirection: 'row', gap: 8 },
  eventViewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.primary + '10' },
  eventViewBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },
  eventRegisterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: '#7C3AED' },
  eventRegisterBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  // Join modal
  joinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  joinContent: { backgroundColor: '#FFF', borderRadius: 24, padding: 24 },
  joinHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  joinTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  joinDesc: { fontSize: 14, color: theme.textSecondary, marginBottom: 16 },
  joinInput: { backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700', color: theme.textPrimary, textAlign: 'center', letterSpacing: 2, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  joinSubmitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 16 },
  joinSubmitText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
