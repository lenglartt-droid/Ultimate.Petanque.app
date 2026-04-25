/**
 * Team Chat Page — messaging within formed tournament teams.
 * Similar to meetup chat but scoped to tournament teams (2-3 players).
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useAuth } from '@/template';
import { getSupabaseClient } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { useAppData } from '@/contexts/AppContext';
import {
  TeamMessage, fetchTeamMessages, sendTeamMessage, deleteTeamMessage,
} from '@/services/teamChatService';
import { TournamentTeam, getTeamSize } from '@/services/teamInvitationService';

const POLL_INTERVAL = 6000;
const AVATAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDateSep(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return lang === 'fr' ? "Aujourd'hui" : 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return lang === 'fr' ? 'Hier' : 'Yesterday';
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
}

const QUICK_FR = ['On se retrouve ou ?', 'Je suis pret', 'A quelle heure ?', 'Strategie ?'];
const QUICK_EN = ['Where do we meet?', "I'm ready", 'What time?', 'Strategy?'];

export default function TeamChatScreen() {
  const insets = useSafeAreaInsets();
  const { id: teamId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { selfPlayer } = useAppData();
  const fr = language === 'fr';

  const [team, setTeam] = useState<TournamentTeam | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const lastCountRef = useRef(0);

  // Load team info
  useEffect(() => {
    if (!teamId) return;
    const load = async () => {
      const sb = getSupabaseClient();
      const { data: t } = await sb.from('tournament_teams').select('*').eq('id', teamId).single();
      if (t) {
        setTeam({
          id: t.id, tournamentId: t.tournament_id, creatorUserId: t.creator_user_id,
          memberUserIds: t.member_user_ids || [], memberNames: t.member_names || [],
          format: t.format, status: t.status, completedAt: t.completed_at, createdAt: t.created_at,
        });
        const { data: tour } = await sb.from('tournaments').select('name').eq('id', t.tournament_id).single();
        if (tour) setTournamentName(tour.name);
      }
    };
    load();
  }, [teamId]);

  // Load & poll messages
  const loadMessages = useCallback(async () => {
    if (!teamId) return;
    const { messages: msgs } = await fetchTeamMessages(teamId);
    setMessages(msgs);
    if (msgs.length > lastCountRef.current) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
    lastCountRef.current = msgs.length;
    setLoading(false);
  }, [teamId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => {
    const iv = setInterval(loadMessages, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [loadMessages]);

  const handleSend = useCallback(async (msgText?: string) => {
    const final = (msgText || text).trim();
    if (!final || sending || !teamId || !user?.id) return;
    setSending(true);
    const userName = selfPlayer?.name || user?.username || user?.email?.split('@')[0] || 'Player';
    const { message: newMsg } = await sendTeamMessage(teamId, user.id, userName, selfPlayer?.avatar || null, final);
    setSending(false);
    if (newMsg) {
      setMessages(prev => [...prev, newMsg]);
      setText('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [teamId, user, selfPlayer, text, sending]);

  const handleDelete = useCallback(async (msgId: string) => {
    Haptics.selectionAsync();
    const { error } = await deleteTeamMessage(msgId);
    if (!error) setMessages(prev => prev.filter(m => m.id !== msgId));
  }, []);

  // Messages with date separators
  const messagesWithSeps = useMemo(() => {
    const result: (TeamMessage | { _type: 'sep'; date: string })[] = [];
    let lastDate = '';
    messages.forEach(msg => {
      const d = new Date(msg.created_at).toDateString();
      if (d !== lastDate) { result.push({ _type: 'sep', date: msg.created_at }); lastDate = d; }
      result.push(msg);
    });
    return result;
  }, [messages]);

  const quickMessages = fr ? QUICK_FR : QUICK_EN;
  const teamSize = team ? getTeamSize(team.format) : 2;

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{fr ? 'Chat equipe' : 'Team Chat'}</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {tournamentName || ''} {team ? `• ${team.format}` : ''}
          </Text>
        </View>
        {/* Member avatars */}
        <View style={s.memberAvatars}>
          {(team?.memberNames || []).slice(0, 3).map((name, i) => (
            <View key={i} style={[s.memberDot, { backgroundColor: AVATAR_COLORS[i % 6], marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i }]}>
              <Text style={s.memberInitial}>{name.charAt(0)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Team status bar */}
      {team ? (
        <View style={s.statusBar}>
          <MaterialIcons name={team.status === 'complete' ? 'check-circle' : 'groups'} size={14} color={team.status === 'complete' ? '#22C55E' : '#F59E0B'} />
          <Text style={[s.statusText, { color: team.status === 'complete' ? '#16A34A' : '#D97706' }]}>
            {team.status === 'complete' ? (fr ? 'Equipe complete' : 'Team complete') : `${team.memberUserIds.length}/${teamSize} ${fr ? 'joueurs' : 'players'}`}
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable
            style={s.viewTourneyBtn}
            onPress={() => router.push(`/tournament/${team.tournamentId}` as any)}
          >
            <MaterialIcons name="emoji-events" size={12} color="#2563EB" />
            <Text style={s.viewTourneyText}>{fr ? 'Tournoi' : 'Tournament'}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Messages */}
      {loading ? (
        <View style={s.loadingWrap}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : messages.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}><MaterialIcons name="chat" size={40} color="#CBD5E1" /></View>
          <Text style={s.emptyTitle}>{fr ? 'Lancez la discussion !' : 'Start the conversation!'}</Text>
          <Text style={s.emptyDesc}>{fr ? 'Coordonnez votre strategie et logistique avec vos coequipiers.' : 'Coordinate strategy and logistics with your teammates.'}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messagesWithSeps}
          keyExtractor={(item, idx) => ('_type' in item ? `sep-${idx}` : (item as TeamMessage).id)}
          style={s.messageList}
          contentContainerStyle={[s.messageListContent, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            if ('_type' in item) {
              return (
                <View style={s.dateSep}>
                  <View style={s.dateSepLine} />
                  <Text style={s.dateSepText}>{formatDateSep(item.date, language)}</Text>
                  <View style={s.dateSepLine} />
                </View>
              );
            }
            const msg = item as TeamMessage;
            const isOwn = msg.user_id === user?.id;
            const avatarColor = getAvatarColor(msg.user_id);
            const initials = msg.user_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <Animated.View entering={index < 20 ? FadeInDown.duration(150).delay(Math.min(index * 20, 200)) : undefined}>
                <Pressable
                  style={[s.bubbleRow, isOwn && s.bubbleRowOwn]}
                  onLongPress={() => { if (isOwn) { Haptics.selectionAsync(); handleDelete(msg.id); } }}
                >
                  {!isOwn ? (
                    <View style={[s.bubbleAvatar, { backgroundColor: avatarColor + '20' }]}>
                      <Text style={[s.bubbleAvatarText, { color: avatarColor }]}>{initials}</Text>
                    </View>
                  ) : null}
                  <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
                    {!isOwn ? <Text style={[s.bubbleName, { color: avatarColor }]}>{msg.user_name}</Text> : null}
                    <Text style={[s.bubbleText, isOwn && s.bubbleTextOwn]}>{msg.message}</Text>
                    <Text style={[s.bubbleTime, isOwn && s.bubbleTimeOwn]}>{formatTime(msg.created_at)}</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}

      {/* Quick messages */}
      <View style={s.quickRow}>
        {quickMessages.map((qm, idx) => (
          <Pressable key={idx} style={s.quickChip} onPress={() => handleSend(qm)}>
            <Text style={s.quickChipText} numberOfLines={1}>{qm}</Text>
          </Pressable>
        ))}
      </View>

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder={fr ? 'Votre message...' : 'Your message...'}
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
          />
          <Pressable
            style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!text.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="send" size={18} color="#FFF" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  memberAvatars: { flexDirection: 'row', alignItems: 'center' },
  memberDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  memberInitial: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  statusText: { fontSize: 12, fontWeight: '600' },
  viewTourneyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  viewTourneyText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
  messageList: { flex: 1 },
  messageListContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  dateSep: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dateSepLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dateSepText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 4 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubbleAvatarText: { fontSize: 10, fontWeight: '800' },
  bubble: { maxWidth: '75%' as any, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: '#0F172A', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  bubbleName: { fontSize: 11, fontWeight: '700', marginBottom: 3 },
  bubbleText: { fontSize: 14, color: '#0F172A', lineHeight: 20 },
  bubbleTextOwn: { color: '#FFF' },
  bubbleTime: { fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: 'right' },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.5)' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  quickChip: { backgroundColor: '#22C55E10', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: '#22C55E20' },
  quickChipText: { fontSize: 12, fontWeight: '600', color: '#22C55E' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFF' },
  input: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#0F172A', maxHeight: 80, borderWidth: 1, borderColor: '#E2E8F0' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#94A3B8', opacity: 0.5 },
});
