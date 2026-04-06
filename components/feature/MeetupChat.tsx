/**
 * MeetupChat — Mini-chat component for meetup detail page.
 * Displays messages, auto-polls for new ones, and allows sending.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from '@/services/haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import theme from '@/constants/theme';
import {
  MeetupMessage,
  fetchMeetupMessages,
  sendMeetupMessage,
  deleteMeetupMessage,
} from '@/services/meetupChatService';

interface MeetupChatProps {
  meetupId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  isParticipant: boolean;
  language: string;
}

const POLL_INTERVAL = 8000; // 8 seconds

const QUICK_MESSAGES_FR = [
  "J'arrive dans 10 min",
  "Combien de boules ?",
  "On commence a quelle heure ?",
  "Je serai en retard",
];

const QUICK_MESSAGES_EN = [
  "I'll be there in 10 min",
  "How many boules?",
  "What time do we start?",
  "I'll be late",
];

// Color palette for user avatars
const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#D97706', '#6366F1', '#14B8A6',
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return lang === 'fr' ? "Aujourd'hui" : 'Today';
  if (isYesterday) return lang === 'fr' ? 'Hier' : 'Yesterday';
  return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
}

const MessageBubble = React.memo(({ msg, isOwn, onDelete, language }: {
  msg: MeetupMessage;
  isOwn: boolean;
  onDelete: (id: string) => void;
  language: string;
}) => {
  const [showDelete, setShowDelete] = useState(false);
  const avatarColor = getAvatarColor(msg.user_id);
  const initials = msg.user_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Pressable
      style={[s.bubbleRow, isOwn && s.bubbleRowOwn]}
      onLongPress={() => { if (isOwn) { Haptics.selectionAsync(); setShowDelete(prev => !prev); } }}
    >
      {!isOwn ? (
        <View style={[s.bubbleAvatar, { backgroundColor: avatarColor + '20' }]}>
          <Text style={[s.bubbleAvatarText, { color: avatarColor }]}>{initials}</Text>
        </View>
      ) : null}
      <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
        {!isOwn ? (
          <Text style={[s.bubbleName, { color: avatarColor }]}>{msg.user_name}</Text>
        ) : null}
        <Text style={[s.bubbleText, isOwn && s.bubbleTextOwn]}>{msg.message}</Text>
        <Text style={[s.bubbleTime, isOwn && s.bubbleTimeOwn]}>{formatTime(msg.created_at)}</Text>
      </View>
      {showDelete && isOwn ? (
        <Pressable style={s.deleteBtn} onPress={() => { onDelete(msg.id); setShowDelete(false); }}>
          <MaterialIcons name="delete-outline" size={16} color={theme.error} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

export default function MeetupChat({ meetupId, userId, userName, userAvatar, isParticipant, language }: MeetupChatProps) {
  const [messages, setMessages] = useState<MeetupMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCountRef = useRef(0);
  const quickMessages = language === 'fr' ? QUICK_MESSAGES_FR : QUICK_MESSAGES_EN;

  const loadMessages = useCallback(async () => {
    const { messages: msgs } = await fetchMeetupMessages(meetupId);
    setMessages(msgs);
    // Auto-scroll if new messages arrived
    if (msgs.length > lastCountRef.current && expanded) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
    lastCountRef.current = msgs.length;
    setLoading(false);
  }, [meetupId, expanded]);

  // Initial load
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Polling
  useEffect(() => {
    if (!expanded) return;
    pollRef.current = setInterval(loadMessages, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [expanded, loadMessages]);

  const handleSend = useCallback(async (msgText?: string) => {
    const finalText = (msgText || text).trim();
    if (!finalText || sending) return;
    setSending(true);
    const { message: newMsg, error } = await sendMeetupMessage(meetupId, userId, userName, userAvatar, finalText);
    setSending(false);
    if (!error && newMsg) {
      setMessages(prev => [...prev, newMsg]);
      setText('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [meetupId, userId, userName, userAvatar, text, sending]);

  const handleDelete = useCallback(async (msgId: string) => {
    Haptics.selectionAsync();
    const { error } = await deleteMeetupMessage(msgId);
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    }
  }, []);

  const handleToggle = useCallback(() => {
    Haptics.selectionAsync();
    setExpanded(prev => !prev);
  }, []);

  // Group messages by date for separators
  const messagesWithSeparators = React.useMemo(() => {
    const result: (MeetupMessage | { _type: 'separator'; date: string })[] = [];
    let lastDate = '';
    messages.forEach(msg => {
      const d = new Date(msg.created_at).toDateString();
      if (d !== lastDate) {
        result.push({ _type: 'separator', date: msg.created_at });
        lastDate = d;
      }
      result.push(msg);
    });
    return result;
  }, [messages]);

  const unreadCount = messages.length;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={s.container}>
      {/* Header — always visible */}
      <Pressable style={s.header} onPress={handleToggle}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <MaterialIcons name="chat-bubble-outline" size={18} color={theme.primary} />
          </View>
          <Text style={s.headerTitle}>{language === 'fr' ? 'Discussion' : 'Chat'}</Text>
          {unreadCount > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color={theme.textMuted} />
      </Pressable>

      {/* Expanded chat body */}
      {expanded ? (
        <View style={s.body}>
          {loading ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={s.emptyWrap}>
              <MaterialIcons name="chat" size={36} color={theme.textMuted} />
              <Text style={s.emptyText}>
                {language === 'fr' ? 'Aucun message. Lancez la discussion !' : 'No messages yet. Start the conversation!'}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messagesWithSeparators}
              keyExtractor={(item, idx) => ('_type' in item && item._type === 'separator') ? `sep-${idx}` : (item as MeetupMessage).id}
              style={s.messageList}
              contentContainerStyle={s.messageListContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                if ('_type' in item && item._type === 'separator') {
                  return (
                    <View style={s.dateSeparator}>
                      <View style={s.dateSeparatorLine} />
                      <Text style={s.dateSeparatorText}>{formatDateSeparator(item.date, language)}</Text>
                      <View style={s.dateSeparatorLine} />
                    </View>
                  );
                }
                const msg = item as MeetupMessage;
                return (
                  <MessageBubble
                    msg={msg}
                    isOwn={msg.user_id === userId}
                    onDelete={handleDelete}
                    language={language}
                  />
                );
              }}
            />
          )}

          {/* Quick message chips */}
          {isParticipant ? (
            <View style={s.quickRow}>
              {quickMessages.map((qm, idx) => (
                <Pressable key={idx} style={s.quickChip} onPress={() => handleSend(qm)}>
                  <Text style={s.quickChipText} numberOfLines={1}>{qm}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Input area */}
          {isParticipant ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={text}
                  onChangeText={setText}
                  placeholder={language === 'fr' ? 'Votre message...' : 'Your message...'}
                  placeholderTextColor={theme.textMuted}
                  multiline
                  maxLength={500}
                />
                <Pressable
                  style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
                  onPress={() => handleSend()}
                  disabled={!text.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <MaterialIcons name="send" size={18} color="#FFF" />
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          ) : (
            <View style={s.notParticipant}>
              <MaterialIcons name="lock" size={14} color={theme.textMuted} />
              <Text style={s.notParticipantText}>
                {language === 'fr' ? 'Acceptez le RDV pour envoyer des messages' : 'Accept the meetup to send messages'}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden' as const,
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.primary + '12',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: theme.textPrimary,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#FFF',
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
    maxHeight: 400,
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: 'center' as const,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center' as const,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center' as const,
    paddingHorizontal: 24,
  },
  messageList: {
    maxHeight: 280,
  },
  messageListContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  dateSeparator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 8,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: theme.textMuted,
  },
  bubbleRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 6,
    marginBottom: 4,
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end' as const,
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  bubbleAvatarText: {
    fontSize: 10,
    fontWeight: '800' as const,
  },
  bubble: {
    maxWidth: '75%' as any,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: theme.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: theme.backgroundSecondary,
    borderBottomLeftRadius: 4,
  },
  bubbleName: {
    fontSize: 11,
    fontWeight: '700' as const,
    marginBottom: 3,
  },
  bubbleText: {
    fontSize: 14,
    color: theme.textPrimary,
    lineHeight: 20,
  },
  bubbleTextOwn: {
    color: '#FFF',
  },
  bubbleTime: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end' as const,
  },
  bubbleTimeOwn: {
    color: 'rgba(255,255,255,0.6)',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.error + '12',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 4,
  },
  quickRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  quickChip: {
    backgroundColor: theme.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.primary + '20',
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: theme.primary,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.textPrimary,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendBtnDisabled: {
    backgroundColor: theme.textMuted,
    opacity: 0.5,
  },
  notParticipant: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  notParticipantText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '500' as const,
  },
});
