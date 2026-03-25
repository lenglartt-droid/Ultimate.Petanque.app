import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert } from '@/template';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/components/ui/Toast';
import {
  getShareNotifications,
  markShareNotificationsRead,
  deleteShareNotification,
  ShareNotification,
  ShareItemType,
  redeemShareCode as redeemCode,
} from '@/services/shareService';
import { findMeetupByCode } from '@/services/meetupService';

type TabKey = 'redeem' | 'activity' | 'manage';

const TABS: { key: TabKey; labelFr: string; labelEn: string; icon: string; color: string }[] = [
  { key: 'redeem', labelFr: 'Code', labelEn: 'Code', icon: 'qr-code-2', color: theme.primary },
  { key: 'activity', labelFr: 'Activite', labelEn: 'Activity', icon: 'notifications', color: theme.warning },
  { key: 'manage', labelFr: 'Gestion', labelEn: 'Manage', icon: 'dashboard', color: theme.accent },
];

const TYPE_ICON: Record<string, string> = { player: 'person', club: 'home', terrain: 'landscape', tournament: 'emoji-events', match: 'sports', challenge: 'flag' };
const TYPE_COLOR: Record<string, string> = { player: theme.primary, club: theme.accent, terrain: theme.success, tournament: theme.carreauColor, match: theme.tirColor, challenge: theme.warning };
const ROUTE_MAP: Record<string, string> = { player: '/player/', club: '/club/', terrain: '/terrain/', tournament: '/tournament/', match: '/match/', challenge: '' };
const TYPE_LABEL: Record<string, { fr: string; en: string }> = { player: { fr: 'Joueur', en: 'Player' }, club: { fr: 'Club', en: 'Club' }, terrain: { fr: 'Terrain', en: 'Court' }, tournament: { fr: 'Tournoi', en: 'Tournament' }, match: { fr: 'Match', en: 'Match' }, challenge: { fr: 'Defi', en: 'Challenge' } };

function formatRelativeDate(dateStr: string, fr: boolean): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return fr ? "A l'instant" : 'Just now';
  if (mins < 60) return fr ? `Il y a ${mins} min` : `${mins} min ago`;
  if (hours < 24) return fr ? `Il y a ${hours}h` : `${hours}h ago`;
  if (days < 7) return fr ? `Il y a ${days}j` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
}

export default function ShareHubScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { refreshData } = useApp();
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ tab?: string; deepLinkCode?: string; deepLinkType?: string }>();
  const fr = language === 'fr';

  const [activeTab, setActiveTab] = useState<TabKey>((params.tab as TabKey) || 'redeem');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- REDEEM ----
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ itemType: ShareItemType; itemId: string; autoSavedItems: { type: ShareItemType; id: string; newItemId: string | null }[] } | null>(null);

  // ---- ACTIVITY ----
  const [notifications, setNotifications] = useState<ShareNotification[]>([]);

  // Deep link handling
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  useEffect(() => {
    if (deepLinkHandled || !params.deepLinkCode) return;
    setDeepLinkHandled(true);
    setCode(params.deepLinkCode);
    setActiveTab('redeem');
    if (params.deepLinkType === 'meetup') {
      (async () => {
        setIsRedeeming(true);
        const { meetup } = await findMeetupByCode(params.deepLinkCode!);
        setIsRedeeming(false);
        if (meetup) router.replace(`/meetup/${meetup.id}` as any);
        else showAlert(t('common', 'error'), t('meetup', 'invalidCode'));
      })();
    } else {
      setTimeout(() => handleRedeem(params.deepLinkCode!), 300);
    }
  }, [params.deepLinkCode, params.deepLinkType, deepLinkHandled]);

  const loadData = useCallback(async () => {
    try {
      const result = await getShareNotifications();
      if (!result.error) setNotifications(result.notifications);
    } catch (e) { console.log('Error loading share hub:', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Mark notifications as read after delay
  useEffect(() => {
    const timer = setTimeout(async () => {
      const unread = notifications.filter(n => !n.isRead);
      if (unread.length > 0) {
        await markShareNotificationsRead();
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [notifications.length]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ============ REDEEM ============
  const handleRedeem = async (codeValue?: string) => {
    const c = (codeValue || code).trim();
    if (!c) { showAlert(t('common', 'error'), t('share', 'enterCode')); return; }
    setIsRedeeming(true);
    try {
      if (c.toUpperCase().startsWith('RDV-')) {
        const { meetup } = await findMeetupByCode(c);
        if (meetup) { setIsRedeeming(false); router.replace(`/meetup/${meetup.id}` as any); return; }
      }
      const result = await redeemCode(c);
      if (result.error) { showAlert(t('common', 'error'), result.error); }
      else {
        setRedeemResult({ itemType: result.itemType, itemId: result.itemId, autoSavedItems: result.autoSavedItems });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshData();
      }
    } catch { showAlert(t('common', 'error'), t('share', 'cannotValidate')); }
    finally { setIsRedeeming(false); }
  };

  const handleNavigate = (type: string, id: string) => {
    const route = ROUTE_MAP[type];
    if (route) router.push(`${route}${id}` as any);
  };

  // ============ ACTIVITY ============
  const handleDeleteNotif = useCallback((id: string) => {
    Alert.alert(fr ? 'Supprimer' : 'Delete', fr ? 'Supprimer cette notification ?' : 'Delete this notification?', [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: t('common', 'delete'), style: 'destructive', onPress: async () => { await deleteShareNotification(id); setNotifications(prev => prev.filter(n => n.id !== id)); } },
    ]);
  }, [fr, t]);

  const handleClearAll = useCallback(() => {
    if (notifications.length === 0) return;
    Alert.alert(fr ? 'Tout supprimer' : 'Clear all', fr ? 'Supprimer toutes les notifications ?' : 'Delete all notifications?', [
      { text: t('common', 'cancel'), style: 'cancel' },
      { text: fr ? 'Tout supprimer' : 'Clear all', style: 'destructive', onPress: async () => { for (const n of notifications) await deleteShareNotification(n.id); setNotifications([]); } },
    ]);
  }, [notifications, fr, t]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const tabBadges: Record<TabKey, number> = {
    redeem: 0,
    activity: unreadCount,
    manage: 0,
  };

  if (loading) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.header}><Pressable style={st.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} /></Pressable><Text style={st.headerTitle}>{fr ? 'Partage' : 'Sharing'}</Text><View style={{ width: 40 }} /></View>
        <View style={st.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()}><MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} /></Pressable>
        <Text style={st.headerTitle}>{fr ? 'Partage' : 'Sharing'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={st.tabBar}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const badge = tabBadges[tab.key];
          return (
            <Pressable key={tab.key} style={[st.tab, isActive && { borderBottomColor: tab.color, backgroundColor: tab.color + '08' }]} onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.key); }}>
              <MaterialIcons name={tab.icon as any} size={18} color={isActive ? tab.color : theme.textMuted} />
              <Text style={[st.tabLabel, isActive && { color: tab.color, fontWeight: '700' }]}>{fr ? tab.labelFr : tab.labelEn}</Text>
              {badge > 0 ? <View style={[st.tabBadge, { backgroundColor: tab.color }]}><Text style={st.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
            </Pressable>
          );
        })}
      </View>

      {/* ============ TAB: REDEEM ============ */}
      {activeTab === 'redeem' ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
            {!redeemResult ? (
              <Animated.View entering={FadeInDown.duration(300)} style={st.redeemSection}>
                <View style={st.redeemIcon}><MaterialIcons name="qr-code-2" size={48} color={theme.primary} /></View>
                <Text style={st.redeemTitle}>{t('share', 'enterShareCode')}</Text>
                <Text style={st.redeemDesc}>{t('share', 'enterShareCodeDesc')}</Text>
                <View style={st.redeemInputRow}>
                  <TextInput style={st.redeemInput} value={code} onChangeText={setCode} placeholder="Ex: AbC12xYz" placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} maxLength={12} />
                </View>
                <Pressable style={[st.redeemBtn, (!code.trim() || isRedeeming) && { opacity: 0.6 }]} onPress={() => handleRedeem()} disabled={!code.trim() || isRedeeming}>
                  {isRedeeming ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="lock-open" size={20} color="#FFF" /><Text style={st.redeemBtnText}>{t('share', 'validateCode')}</Text></>}
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.duration(400)} style={st.redeemSection}>
                <View style={[st.redeemIcon, { backgroundColor: theme.success + '20' }]}><MaterialIcons name="check-circle" size={48} color={theme.success} /></View>
                <Text style={st.redeemTitle}>{t('share', 'cardUnlocked')}</Text>
                <Text style={st.redeemDesc}>{t('share', 'autoSavedToDirectory')}</Text>
                <View style={st.importedList}>
                  {redeemResult.autoSavedItems.map((item, idx) => {
                    const color = TYPE_COLOR[item.type] || theme.primary;
                    const icon = TYPE_ICON[item.type] || 'description';
                    const label = TYPE_LABEL[item.type];
                    return (
                      <Pressable key={`${item.type}-${idx}`} style={st.importedItem} onPress={() => item.newItemId ? handleNavigate(item.type, item.newItemId) : null}>
                        <View style={[st.importedItemIcon, { backgroundColor: color + '15' }]}><MaterialIcons name={icon as any} size={20} color={color} /></View>
                        <View style={{ flex: 1 }}><Text style={st.importedItemType}>{fr ? label?.fr : label?.en}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}><MaterialIcons name="check" size={12} color={theme.success} /><Text style={{ fontSize: 11, color: theme.success, fontWeight: '500' }}>{t('share', 'savedToDirectory')}</Text></View></View>
                        {item.newItemId ? <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
                {redeemResult.itemType !== 'challenge' ? (
                  <Pressable style={[st.redeemBtn, { backgroundColor: TYPE_COLOR[redeemResult.itemType] || theme.primary }]} onPress={() => { const main = redeemResult.autoSavedItems.find(i => i.type === redeemResult.itemType); handleNavigate(redeemResult.itemType, main?.newItemId || redeemResult.itemId); }}>
                    <MaterialIcons name="open-in-new" size={20} color="#FFF" />
                    <Text style={st.redeemBtnText}>{t('share', 'viewCard')}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={st.resetBtn} onPress={() => { setRedeemResult(null); setCode(''); }}>
                  <Text style={st.resetBtnText}>{fr ? 'Entrer un autre code' : 'Enter another code'}</Text>
                </Pressable>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      {/* ============ TAB: ACTIVITY ============ */}
      {activeTab === 'activity' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
        >
          {/* Summary */}
          <Animated.View entering={FadeInDown.duration(300)} style={st.summaryCard}>
            <View style={[st.summaryIcon, { backgroundColor: theme.success + '15' }]}><MaterialIcons name="share" size={24} color={theme.success} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.summaryTitle}>{notifications.length === 0 ? (fr ? 'Aucune notification' : 'No notifications') : `${notifications.length} ${fr ? 'acces enregistres' : 'accesses recorded'}`}</Text>
              <Text style={st.summarySub}>{unreadCount > 0 ? `${unreadCount} ${fr ? 'non lues' : 'unread'}` : (fr ? 'Tout a jour' : 'All up to date')}</Text>
            </View>
            {notifications.length > 0 ? <Pressable style={st.clearAllBtn} onPress={handleClearAll}><MaterialIcons name="delete-sweep" size={20} color={theme.error} /></Pressable> : null}
          </Animated.View>

          {notifications.length > 0 ? (
            <View style={st.notifList}>
              {notifications.map((notif, i) => {
                const color = TYPE_COLOR[notif.itemType] || theme.primary;
                const icon = TYPE_ICON[notif.itemType] || 'description';
                const label = TYPE_LABEL[notif.itemType];
                return (
                  <Animated.View key={notif.id} entering={FadeIn.duration(200).delay(i * 30)}>
                    <Pressable style={[st.notifCard, !notif.isRead && st.notifCardUnread]} onPress={() => handleNavigate(notif.itemType, notif.itemId)} onLongPress={() => handleDeleteNotif(notif.id)}>
                      {!notif.isRead ? <View style={st.unreadDot} /> : null}
                      <View style={st.notifAvatar}><Text style={st.notifAvatarText}>{(notif.accessorName || '?').charAt(0).toUpperCase()}</Text></View>
                      <View style={{ flex: 1 }}>
                        <View style={st.notifRow}><Text style={st.notifName} numberOfLines={1}>{notif.accessorName || 'User'}</Text><Text style={st.notifTime}>{formatRelativeDate(notif.createdAt, fr)}</Text></View>
                        <Text style={st.notifAction} numberOfLines={1}>{t('share', 'accessedYourCard')} {(fr ? label?.fr : label?.en)?.toLowerCase()}{notif.itemName ? ` "${notif.itemName}"` : ''}</Text>
                        <View style={st.notifBadges}>
                          <View style={[st.notifTypeBadge, { backgroundColor: color + '15' }]}><MaterialIcons name={icon as any} size={10} color={color} /><Text style={[st.notifTypeBadgeText, { color }]}>{fr ? label?.fr : label?.en}</Text></View>
                        </View>
                      </View>
                      <MaterialIcons name="chevron-right" size={18} color={theme.textMuted} />
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <View style={st.emptyState}><MaterialIcons name="notifications-none" size={48} color={theme.textMuted} /><Text style={st.emptyTitle}>{fr ? 'Aucune notification' : 'No notifications'}</Text><Text style={st.emptyDesc}>{fr ? 'Quand quelqu\'un utilisera votre code de partage, vous le verrez ici.' : 'When someone uses your share code, you will see it here.'}</Text></View>
          )}
        </ScrollView>
      ) : null}

      {/* ============ TAB: MANAGE ============ */}
      {activeTab === 'manage' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable style={st.manageCard} onPress={() => router.push('/shared-items')}>
              <View style={[st.manageCardIcon, { backgroundColor: theme.accent + '15' }]}><MaterialIcons name="dashboard" size={28} color={theme.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.manageCardTitle}>{fr ? 'Tableau de bord des partages' : 'Share Dashboard'}</Text>
                <Text style={st.manageCardSub}>{fr ? 'Gestion, analytiques, codes, expiration' : 'Management, analytics, codes, expiration'}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={theme.textMuted} />
            </Pressable>
          </Animated.View>

          <View style={st.infoNote}><MaterialIcons name="info-outline" size={14} color={theme.textMuted} /><Text style={st.infoNoteText}>{fr ? 'Le tableau de bord regroupe tous vos partages actifs, les statistiques de consultation, et les outils de gestion groupee.' : 'The dashboard brings together all your active shares, view statistics, and bulk management tools.'}</Text></View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: theme.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: theme.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: theme.textMuted },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Redeem
  redeemSection: { alignItems: 'center', paddingTop: 24 },
  redeemIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  redeemTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  redeemDesc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  redeemInputRow: { width: '100%', backgroundColor: theme.surface, borderRadius: 16, borderWidth: 2, borderColor: theme.border, marginBottom: 16 },
  redeemInput: { fontSize: 22, fontWeight: '700', color: theme.textPrimary, padding: 16, textAlign: 'center', letterSpacing: 2 },
  redeemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 14 },
  redeemBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  importedList: { width: '100%', gap: 8, marginBottom: 20 },
  importedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 12, ...theme.shadows.card },
  importedItemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  importedItemType: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  resetBtn: { paddingVertical: 14, marginTop: 8 },
  resetBtnText: { fontSize: 14, fontWeight: '600', color: theme.primary },

  // Activity
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 16, gap: 12, ...theme.shadows.card },
  summaryIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  summarySub: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  clearAllBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.error + '10', alignItems: 'center', justifyContent: 'center' },
  notifList: { gap: 8 },
  notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 14, padding: 12, gap: 10, ...theme.shadows.card },
  notifCardUnread: { backgroundColor: theme.primary + '08', borderWidth: 1, borderColor: theme.primary + '20' },
  unreadDot: { position: 'absolute', top: 12, left: 12, width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.primary, zIndex: 1 },
  notifAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  notifAvatarText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  notifName: { fontSize: 14, fontWeight: '700', color: theme.textPrimary, flex: 1, marginRight: 8 },
  notifTime: { fontSize: 10, color: theme.textMuted },
  notifAction: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
  notifBadges: { flexDirection: 'row', gap: 6 },
  notifTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  notifTypeBadgeText: { fontSize: 10, fontWeight: '600' },

  // Manage
  manageCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface, borderRadius: 18, padding: 20, gap: 16, ...theme.shadows.card, marginBottom: 16 },
  manageCardIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  manageCardTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  manageCardSub: { fontSize: 13, color: theme.textSecondary },

  // Info note
  infoNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: theme.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border },
  infoNoteText: { flex: 1, fontSize: 11, color: theme.textMuted, lineHeight: 16 },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginTop: 12, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },
});
