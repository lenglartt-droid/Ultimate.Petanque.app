import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import theme from '@/constants/theme';
import {
  getMySharedItems,
  getSharedWithMe,
  revokeShare,
  updateSharePermission,
  fetchItemName,
  saveSharedItemToMyAccount,
  SharedItem,
  ShareItemType,
  SharePermission,
} from '@/services/shareService';
import { useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';

const TYPE_ICON: Record<ShareItemType, string> = {
  player: 'person',
  club: 'home',
  terrain: 'landscape',
  tournament: 'emoji-events',
};

const TYPE_COLOR: Record<ShareItemType, string> = {
  player: theme.primary,
  club: theme.accent,
  terrain: theme.success,
  tournament: theme.carreauColor,
};

const TYPE_LABEL_KEY: Record<ShareItemType, string> = {
  player: 'playerLabel',
  club: 'clubLabel',
  terrain: 'terrainLabel',
  tournament: 'tournamentLabel',
};

const ROUTE_MAP: Record<ShareItemType, string> = {
  player: '/player/',
  club: '/club/',
  terrain: '/terrain/',
  tournament: '/tournament/',
};

type Tab = 'shared_by_me' | 'shared_with_me';

interface EnrichedSharedItem extends SharedItem {
  itemName: string;
}

export default function SharedItemsScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('shared_by_me');
  const [myShares, setMyShares] = useState<EnrichedSharedItem[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<EnrichedSharedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const enrichItems = useCallback(async (items: SharedItem[]): Promise<EnrichedSharedItem[]> => {
    const enriched: EnrichedSharedItem[] = [];
    const nameCache: Record<string, string> = {};
    for (const item of items) {
      const key = `${item.itemType}_${item.itemId}`;
      if (!nameCache[key]) {
        nameCache[key] = await fetchItemName(item.itemType, item.itemId);
      }
      enriched.push({ ...item, itemName: nameCache[key] });
    }
    return enriched;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [myResult, withMeResult] = await Promise.all([
        getMySharedItems(),
        getSharedWithMe(),
      ]);

      if (!myResult.error) {
        const enrichedMy = await enrichItems(myResult.items);
        setMyShares(enrichedMy);
      }
      if (!withMeResult.error) {
        const enrichedWithMe = await enrichItems(withMeResult.items);
        setSharedWithMe(enrichedWithMe);
      }
    } catch (e) {
      console.log('Error loading shared items:', e);
    }
  }, [enrichItems]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    init();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleCopyCode = useCallback(async (code: string, id: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleRevoke = useCallback((item: EnrichedSharedItem) => {
    Alert.alert(
      t('share', 'revokeShare'),
      `${t('share', 'revokeShareMsg')} "${item.itemName}" ${t('share', 'revokeShareMsgEnd')}`,
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('share', 'revoke'),
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const { error } = await revokeShare(item.id);
            if (error) {
              showAlert(t('common', 'error'), error);
            } else {
              setMyShares(prev => prev.filter(s => s.id !== item.id));
            }
          },
        },
      ]
    );
  }, [showAlert, t]);

  const handleTogglePermission = useCallback(async (item: EnrichedSharedItem) => {
    const newPermission: SharePermission = item.permission === 'read' ? 'write' : 'read';
    const label = newPermission === 'read' ? t('share', 'readOnlyLabel') : t('share', 'readWriteLabel');

    Haptics.selectionAsync();
    const { error } = await updateSharePermission(item.id, newPermission);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      setMyShares(prev =>
        prev.map(s => (s.id === item.id ? { ...s, permission: newPermission } : s))
      );
      showAlert(t('share', 'permissionChanged'), `${t('share', 'nowIn')} "${label}"`);
    }
  }, [showAlert, t]);

  const handleNavigate = useCallback((itemType: ShareItemType, itemId: string) => {
    Haptics.selectionAsync();
    router.push(`${ROUTE_MAP[itemType]}${itemId}` as any);
  }, []);

  const handleRemoveSharedWithMe = useCallback((item: EnrichedSharedItem) => {
    Alert.alert(
      t('share', 'removeShare'),
      `${t('share', 'removeShareMsg')} "${item.itemName}" ?`,
      [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('share', 'removeLabel'),
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const { error } = await revokeShare(item.id);
            if (error) {
              showAlert(t('common', 'error'), error);
            } else {
              setSharedWithMe(prev => prev.filter(s => s.id !== item.id));
            }
          },
        },
      ]
    );
  }, [showAlert, t]);

  const handleSaveToMyAccount = useCallback(async (item: EnrichedSharedItem) => {
    Haptics.selectionAsync();
    const { newItemId, error } = await saveSharedItemToMyAccount(item.itemType, item.itemId);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('share', 'saved'), `"${item.itemName}" ${t('share', 'copiedToDirectory')}`);
      if (newItemId) {
        handleNavigate(item.itemType, newItemId);
      }
    }
  }, [showAlert, handleNavigate, t]);

  const currentItems = activeTab === 'shared_by_me' ? myShares : sharedWithMe;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('share', 'shareManagement')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('share', 'shareManagement')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'shared_by_me' && styles.tabActive]}
          onPress={() => { Haptics.selectionAsync(); setActiveTab('shared_by_me'); }}
        >
          <MaterialIcons
            name="upload"
            size={18}
            color={activeTab === 'shared_by_me' ? theme.primary : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'shared_by_me' && styles.tabTextActive]}>
            {t('share', 'myShares')}
          </Text>
          {myShares.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'shared_by_me' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'shared_by_me' && styles.tabBadgeTextActive]}>
                {myShares.length}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'shared_with_me' && styles.tabActive]}
          onPress={() => { Haptics.selectionAsync(); setActiveTab('shared_with_me'); }}
        >
          <MaterialIcons
            name="download"
            size={18}
            color={activeTab === 'shared_with_me' ? theme.primary : theme.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'shared_with_me' && styles.tabTextActive]}>
            {t('share', 'received')}
          </Text>
          {sharedWithMe.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'shared_with_me' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'shared_with_me' && styles.tabBadgeTextActive]}>
                {sharedWithMe.length}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        {/* Summary */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.summaryCard}>
          <View style={[styles.summaryIcon, {
            backgroundColor: activeTab === 'shared_by_me' ? theme.primary + '15' : theme.accent + '15',
          }]}>
            <MaterialIcons
              name={activeTab === 'shared_by_me' ? 'folder-shared' : 'people'}
              size={28}
              color={activeTab === 'shared_by_me' ? theme.primary : theme.accent}
            />
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle}>
              {activeTab === 'shared_by_me'
                ? `${myShares.length} ${myShares.length !== 1 ? t('share', 'cardsShared') : t('share', 'cardShared')}`
                : `${sharedWithMe.length} ${sharedWithMe.length !== 1 ? t('share', 'cardsReceived') : t('share', 'cardReceived')}`}
            </Text>
            <Text style={styles.summarySubtitle}>
              {activeTab === 'shared_by_me'
                ? t('share', 'activeCodesGenerated')
                : t('share', 'cardsSharedByOthers')}
            </Text>
          </View>
        </Animated.View>

        {/* Items list */}
        {currentItems.length > 0 ? (
          <View style={styles.itemsList}>
            {currentItems.map((item, index) => {
              const color = TYPE_COLOR[item.itemType];
              const icon = TYPE_ICON[item.itemType];
              const labelKey = TYPE_LABEL_KEY[item.itemType];
              const isCopied = copiedId === item.id;
              return (
                <Animated.View key={item.id} entering={FadeIn.duration(200).delay(index * 40)}>
                  <Pressable
                    style={styles.itemCard}
                    onPress={() => handleNavigate(item.itemType, item.itemId)}
                  >
                    {/* Type icon */}
                    <View style={[styles.itemIcon, { backgroundColor: color + '15' }]}>
                      <MaterialIcons name={icon as any} size={24} color={color} />
                    </View>

                    {/* Item info */}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
                      <View style={styles.itemMeta}>
                        <View style={[styles.itemTypeBadge, { backgroundColor: color + '12' }]}>
                          <Text style={[styles.itemTypeBadgeText, { color }]}>{t('share', labelKey)}</Text>
                        </View>
                        <View style={[
                          styles.itemPermBadge,
                          { backgroundColor: item.permission === 'read' ? theme.primary + '12' : theme.accent + '12' },
                        ]}>
                          <MaterialIcons
                            name={item.permission === 'read' ? 'visibility' : 'edit'}
                            size={10}
                            color={item.permission === 'read' ? theme.primary : theme.accent}
                          />
                          <Text style={[
                            styles.itemPermBadgeText,
                            { color: item.permission === 'read' ? theme.primary : theme.accent },
                          ]}>
                            {item.permission === 'read' ? t('share', 'readShort') : t('share', 'editShort')}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.itemDate}>
                        {new Date(item.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </Text>
                    </View>

                    {/* Actions */}
                    {activeTab === 'shared_by_me' ? (
                      <View style={styles.itemActions}>
                        {/* Copy code */}
                        <Pressable
                          style={[styles.actionBtn, isCopied && styles.actionBtnSuccess]}
                          onPress={() => handleCopyCode(item.shareCode, item.id)}
                          hitSlop={4}
                        >
                          <MaterialIcons
                            name={isCopied ? 'check' : 'content-copy'}
                            size={16}
                            color={isCopied ? theme.success : theme.primary}
                          />
                        </Pressable>
                        {/* Toggle permission */}
                        <Pressable
                          style={styles.actionBtn}
                          onPress={() => handleTogglePermission(item)}
                          hitSlop={4}
                        >
                          <MaterialIcons
                            name={item.permission === 'read' ? 'lock' : 'lock-open'}
                            size={16}
                            color={theme.warning}
                          />
                        </Pressable>
                        {/* Revoke */}
                        <Pressable
                          style={[styles.actionBtn, styles.actionBtnDanger]}
                          onPress={() => handleRevoke(item)}
                          hitSlop={4}
                        >
                          <MaterialIcons name="delete-outline" size={16} color={theme.error} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.itemActions}>
                        <Pressable
                          style={[styles.actionBtn, styles.actionBtnSave]}
                          onPress={() => handleSaveToMyAccount(item)}
                          hitSlop={4}
                        >
                          <MaterialIcons name="save-alt" size={16} color={theme.accent} />
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, styles.actionBtnDanger]}
                          onPress={() => handleRemoveSharedWithMe(item)}
                          hitSlop={4}
                        >
                          <MaterialIcons name="close" size={16} color={theme.error} />
                        </Pressable>
                      </View>
                    )}
                  </Pressable>

                  {/* Share code display for my shares */}
                  {activeTab === 'shared_by_me' && (
                    <View style={styles.codeRow}>
                      <MaterialIcons name="vpn-key" size={12} color={theme.textMuted} />
                      <Text style={styles.codeText}>{item.shareCode}</Text>
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </View>
        ) : (
          <Animated.View entering={FadeInDown.duration(300).delay(100)} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons
                name={activeTab === 'shared_by_me' ? 'folder-off' : 'person-off'}
                size={56}
                color={theme.textMuted}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'shared_by_me' ? t('share', 'noActiveShares') : t('share', 'noReceivedCards')}
            </Text>
            <Text style={styles.emptyDesc}>
              {activeTab === 'shared_by_me'
                ? t('share', 'noActiveSharesDesc')
                : t('share', 'noReceivedCardsDesc')}
            </Text>
          </Animated.View>
        )}

        {/* Legend */}
        {activeTab === 'shared_by_me' && myShares.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.legendCard}>
            <Text style={styles.legendTitle}>{t('share', 'actions')}</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="content-copy" size={14} color={theme.primary} />
              </View>
              <Text style={styles.legendText}>{t('share', 'copyShareCode')}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: theme.warning + '15' }]}>
                <MaterialIcons name="lock" size={14} color={theme.warning} />
              </View>
              <Text style={styles.legendText}>{t('share', 'toggleReadWrite')}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: theme.error + '15' }]}>
                <MaterialIcons name="delete-outline" size={14} color={theme.error} />
              </View>
              <Text style={styles.legendText}>{t('share', 'revokeTheShare')}</Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: theme.surface, paddingHorizontal: 16,
    paddingTop: 8, paddingBottom: 4, gap: 8,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: theme.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  tabTextActive: { color: theme.primary },
  tabBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: theme.backgroundSecondary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  tabBadgeActive: { backgroundColor: theme.primary + '15' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  tabBadgeTextActive: { color: theme.primary },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Summary
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg, padding: 16, marginBottom: 16,
    ...theme.shadows.card,
  },
  summaryIcon: {
    width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  summaryInfo: { flex: 1 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
  summarySubtitle: { fontSize: 13, color: theme.textSecondary },

  // Items
  itemsList: { gap: 4, marginBottom: 20 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.surface,
    borderTopLeftRadius: theme.borderRadius.lg, borderTopRightRadius: theme.borderRadius.lg,
    padding: 14, gap: 12, ...theme.shadows.card,
  },
  itemIcon: {
    width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  itemMeta: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  itemTypeBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  itemTypeBadgeText: { fontSize: 10, fontWeight: '600' },
  itemPermBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  itemPermBadgeText: { fontSize: 10, fontWeight: '600' },
  itemDate: { fontSize: 11, color: theme.textMuted },
  itemActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: theme.backgroundSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnSuccess: { backgroundColor: theme.success + '15' },
  actionBtnDanger: { backgroundColor: theme.error + '10' },
  actionBtnSave: { backgroundColor: theme.accent + '15' },

  // Code row
  codeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.surface, paddingHorizontal: 14, paddingTop: 0, paddingBottom: 10,
    borderBottomLeftRadius: theme.borderRadius.lg, borderBottomRightRadius: theme.borderRadius.lg,
    borderTopWidth: 1, borderTopColor: theme.border + '40',
    marginBottom: 10,
  },
  codeText: {
    fontSize: 12, fontWeight: '600', color: theme.textMuted, letterSpacing: 1, fontFamily: 'monospace',
  },

  // Empty
  emptyState: {
    alignItems: 'center', backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 40, ...theme.shadows.card, marginBottom: 20,
  },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyDesc: {
    fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300,
  },

  // Legend
  legendCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 16, gap: 10, ...theme.shadows.card,
  },
  legendTitle: {
    fontSize: 12, fontWeight: '600', color: theme.textSecondary, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 2,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendIcon: {
    width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
  },
  legendText: { fontSize: 13, color: theme.textPrimary },
});
