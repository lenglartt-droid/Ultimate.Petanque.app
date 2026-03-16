import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  getShareNotifications,
  SharedItem,
  ShareItemType,
  SharePermission,
  ShareNotification,
} from '@/services/shareService';
import { useAlert } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';

const ALL_TYPES: ShareItemType[] = ['player', 'club', 'terrain', 'tournament', 'match', 'challenge'];

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

const TYPE_LABEL_KEY: Record<ShareItemType, string> = {
  player: 'playerLabel',
  club: 'clubLabel',
  terrain: 'terrainLabel',
  tournament: 'tournamentLabel',
  match: 'matchLabel',
  challenge: 'challengeLabel',
};

const TYPE_FILTER_KEY: Record<string, string> = {
  all: 'filterAll',
  player: 'filterPlayer',
  club: 'filterClub',
  terrain: 'filterTerrain',
  tournament: 'filterTournament',
  match: 'filterMatch',
  challenge: 'filterChallenge',
};

const ROUTE_MAP: Record<ShareItemType, string> = {
  player: '/player/',
  club: '/club/',
  terrain: '/terrain/',
  tournament: '/tournament/',
  match: '/match/',
  challenge: '',
};

type Tab = 'shared_by_me' | 'shared_with_me';
type FilterType = 'all' | ShareItemType;

interface EnrichedSharedItem extends SharedItem {
  itemName: string;
  accessorNames?: string[];
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
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const enrichItems = useCallback(async (items: SharedItem[], notifications?: ShareNotification[]): Promise<EnrichedSharedItem[]> => {
    const enriched: EnrichedSharedItem[] = [];
    const nameCache: Record<string, string> = {};
    for (const item of items) {
      const key = `${item.itemType}_${item.itemId}`;
      if (!nameCache[key]) {
        nameCache[key] = await fetchItemName(item.itemType, item.itemId);
      }
      // Find who used this share code
      const accessorNames: string[] = [];
      if (notifications) {
        const relatedNotifs = notifications.filter(
          n => n.itemType === item.itemType && n.itemId === item.itemId
        );
        relatedNotifs.forEach(n => {
          if (n.accessorName && !accessorNames.includes(n.accessorName)) {
            accessorNames.push(n.accessorName);
          }
        });
      }
      enriched.push({ ...item, itemName: nameCache[key], accessorNames });
    }
    return enriched;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [myResult, withMeResult, notifsResult] = await Promise.all([
        getMySharedItems(),
        getSharedWithMe(),
        getShareNotifications(),
      ]);

      const notifications = notifsResult.error ? [] : notifsResult.notifications;

      if (!myResult.error) {
        const enrichedMy = await enrichItems(myResult.items, notifications);
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
    if (!ROUTE_MAP[itemType]) return;
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
    const isMatchOrChallenge = item.itemType === 'match' || item.itemType === 'challenge';
    const { newItemId, error } = await saveSharedItemToMyAccount(item.itemType, item.itemId);
    if (error) {
      showAlert(t('common', 'error'), error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showAlert(t('share', 'saved'), isMatchOrChallenge ? t('share', 'importedToAccount') : `"${item.itemName}" ${t('share', 'copiedToDirectory')}`);
      if (newItemId && ROUTE_MAP[item.itemType]) {
        handleNavigate(item.itemType, newItemId);
      }
    }
  }, [showAlert, handleNavigate, t]);

  // Current items based on tab
  const allCurrentItems = activeTab === 'shared_by_me' ? myShares : sharedWithMe;

  // Available types for filter chips
  const availableTypes = useMemo(() => {
    const types = new Set<ShareItemType>();
    allCurrentItems.forEach(item => types.add(item.itemType));
    return Array.from(types);
  }, [allCurrentItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return allCurrentItems;
    return allCurrentItems.filter(item => item.itemType === activeFilter);
  }, [allCurrentItems, activeFilter]);

  // Group items by type
  const groupedItems = useMemo(() => {
    const groups: Record<ShareItemType, EnrichedSharedItem[]> = {
      player: [], club: [], terrain: [], tournament: [], match: [], challenge: [],
    };
    filteredItems.forEach(item => {
      groups[item.itemType].push(item);
    });
    return ALL_TYPES.filter(type => groups[type].length > 0).map(type => ({
      type,
      items: groups[type],
    }));
  }, [filteredItems]);

  // Stats per type
  const typeStats = useMemo(() => {
    const stats: Record<ShareItemType, number> = {
      player: 0, club: 0, terrain: 0, tournament: 0, match: 0, challenge: 0,
    };
    allCurrentItems.forEach(item => { stats[item.itemType]++; });
    return stats;
  }, [allCurrentItems]);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }, [language]);

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
          onPress={() => { Haptics.selectionAsync(); setActiveTab('shared_by_me'); setActiveFilter('all'); }}
        >
          <MaterialIcons name="upload" size={18} color={activeTab === 'shared_by_me' ? theme.primary : theme.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'shared_by_me' && styles.tabTextActive]}>{t('share', 'myShares')}</Text>
          {myShares.length > 0 ? (
            <View style={[styles.tabBadge, activeTab === 'shared_by_me' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'shared_by_me' && styles.tabBadgeTextActive]}>{myShares.length}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'shared_with_me' && styles.tabActive]}
          onPress={() => { Haptics.selectionAsync(); setActiveTab('shared_with_me'); setActiveFilter('all'); }}
        >
          <MaterialIcons name="download" size={18} color={activeTab === 'shared_with_me' ? theme.primary : theme.textSecondary} />
          <Text style={[styles.tabText, activeTab === 'shared_with_me' && styles.tabTextActive]}>{t('share', 'received')}</Text>
          {sharedWithMe.length > 0 ? (
            <View style={[styles.tabBadge, activeTab === 'shared_with_me' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'shared_with_me' && styles.tabBadgeTextActive]}>{sharedWithMe.length}</Text>
            </View>
          ) : null}
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
        {/* Type Stats Summary */}
        {allCurrentItems.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.statsGrid}>
            {ALL_TYPES.filter(type => typeStats[type] > 0).map(type => {
              const color = TYPE_COLOR[type];
              const icon = TYPE_ICON[type];
              return (
                <Pressable
                  key={type}
                  style={[styles.statChip, activeFilter === type && { borderColor: color, backgroundColor: color + '10' }]}
                  onPress={() => { Haptics.selectionAsync(); setActiveFilter(activeFilter === type ? 'all' : type); }}
                >
                  <View style={[styles.statChipIcon, { backgroundColor: color + '15' }]}>
                    <MaterialIcons name={icon as any} size={16} color={color} />
                  </View>
                  <Text style={[styles.statChipCount, { color }]}>{typeStats[type]}</Text>
                  <Text style={styles.statChipLabel} numberOfLines={1}>{t('share', TYPE_LABEL_KEY[type])}</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}

        {/* Filter active indicator */}
        {activeFilter !== 'all' ? (
          <View style={styles.filterActiveRow}>
            <View style={[styles.filterActiveBadge, { backgroundColor: TYPE_COLOR[activeFilter] + '15' }]}>
              <MaterialIcons name={TYPE_ICON[activeFilter] as any} size={14} color={TYPE_COLOR[activeFilter]} />
              <Text style={[styles.filterActiveText, { color: TYPE_COLOR[activeFilter] }]}>
                {t('share', TYPE_FILTER_KEY[activeFilter])} ({filteredItems.length})
              </Text>
            </View>
            <Pressable style={styles.clearFilterBtn} onPress={() => { Haptics.selectionAsync(); setActiveFilter('all'); }}>
              <MaterialIcons name="close" size={16} color={theme.textMuted} />
              <Text style={styles.clearFilterText}>{t('common', 'clear')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Grouped items */}
        {groupedItems.length > 0 ? (
          groupedItems.map((group, groupIdx) => {
            const groupColor = TYPE_COLOR[group.type];
            const groupIcon = TYPE_ICON[group.type];
            return (
              <Animated.View key={group.type} entering={FadeInDown.duration(300).delay(groupIdx * 50)} style={styles.groupSection}>
                {/* Group Header */}
                <View style={styles.groupHeader}>
                  <View style={[styles.groupHeaderIcon, { backgroundColor: groupColor + '15' }]}>
                    <MaterialIcons name={groupIcon as any} size={16} color={groupColor} />
                  </View>
                  <Text style={styles.groupHeaderTitle}>{t('share', TYPE_LABEL_KEY[group.type])}</Text>
                  <View style={[styles.groupHeaderCount, { backgroundColor: groupColor + '12' }]}>
                    <Text style={[styles.groupHeaderCountText, { color: groupColor }]}>{group.items.length}</Text>
                  </View>
                  <View style={[styles.groupHeaderLine, { backgroundColor: groupColor + '20' }]} />
                </View>

                {/* Items */}
                <View style={styles.groupItemsList}>
                  {group.items.map((item, index) => {
                    const color = TYPE_COLOR[item.itemType];
                    const isCopied = copiedId === item.id;
                    const hasAccessors = item.accessorNames && item.accessorNames.length > 0;

                    return (
                      <Animated.View key={item.id} entering={FadeIn.duration(200).delay(index * 30)}>
                        <Pressable
                          style={styles.itemCard}
                          onPress={() => handleNavigate(item.itemType, item.itemId)}
                        >
                          {/* Left accent */}
                          <View style={[styles.itemAccent, { backgroundColor: color }]} />

                          <View style={styles.itemBody}>
                            {/* Top row: name + actions */}
                            <View style={styles.itemTopRow}>
                              <View style={styles.itemNameGroup}>
                                <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
                                <View style={styles.itemBadges}>
                                  <View style={[styles.itemPermBadge, { backgroundColor: item.permission === 'read' ? theme.primary + '12' : theme.accent + '12' }]}>
                                    <MaterialIcons
                                      name={item.permission === 'read' ? 'visibility' : 'edit'}
                                      size={10}
                                      color={item.permission === 'read' ? theme.primary : theme.accent}
                                    />
                                    <Text style={[styles.itemPermBadgeText, { color: item.permission === 'read' ? theme.primary : theme.accent }]}>
                                      {item.permission === 'read' ? t('share', 'readShort') : t('share', 'editShort')}
                                    </Text>
                                  </View>
                                  <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
                                </View>
                              </View>

                              {/* Action buttons */}
                              {activeTab === 'shared_by_me' ? (
                                <View style={styles.itemActions}>
                                  <Pressable style={[styles.actionBtn, isCopied && styles.actionBtnSuccess]} onPress={() => handleCopyCode(item.shareCode, item.id)} hitSlop={4}>
                                    <MaterialIcons name={isCopied ? 'check' : 'content-copy'} size={15} color={isCopied ? theme.success : theme.primary} />
                                  </Pressable>
                                  <Pressable style={styles.actionBtn} onPress={() => handleTogglePermission(item)} hitSlop={4}>
                                    <MaterialIcons name={item.permission === 'read' ? 'lock' : 'lock-open'} size={15} color={theme.warning} />
                                  </Pressable>
                                  <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleRevoke(item)} hitSlop={4}>
                                    <MaterialIcons name="delete-outline" size={15} color={theme.error} />
                                  </Pressable>
                                </View>
                              ) : (
                                <View style={styles.itemActions}>
                                  <Pressable style={[styles.actionBtn, styles.actionBtnSave]} onPress={() => handleSaveToMyAccount(item)} hitSlop={4}>
                                    <MaterialIcons name="save-alt" size={15} color={theme.accent} />
                                  </Pressable>
                                  <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleRemoveSharedWithMe(item)} hitSlop={4}>
                                    <MaterialIcons name="close" size={15} color={theme.error} />
                                  </Pressable>
                                </View>
                              )}
                            </View>

                            {/* Share code + accessor info (my shares only) */}
                            {activeTab === 'shared_by_me' ? (
                              <View style={styles.itemBottomRow}>
                                <View style={styles.codeContainer}>
                                  <MaterialIcons name="vpn-key" size={11} color={theme.textMuted} />
                                  <Text style={styles.codeText}>{item.shareCode}</Text>
                                </View>
                                {hasAccessors ? (
                                  <View style={styles.accessorContainer}>
                                    <MaterialIcons name="people" size={12} color={theme.success} />
                                    <Text style={styles.accessorText} numberOfLines={1}>
                                      {item.accessorNames!.slice(0, 2).join(', ')}
                                      {item.accessorNames!.length > 2 ? ` +${item.accessorNames!.length - 2}` : ''}
                                    </Text>
                                  </View>
                                ) : (
                                  <View style={styles.accessorContainer}>
                                    <MaterialIcons name="person-off" size={12} color={theme.textMuted} />
                                    <Text style={[styles.accessorText, { color: theme.textMuted }]}>{t('share', 'noOneYet')}</Text>
                                  </View>
                                )}
                              </View>
                            ) : null}
                          </View>
                        </Pressable>
                      </Animated.View>
                    );
                  })}
                </View>
              </Animated.View>
            );
          })
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
              {activeFilter !== 'all'
                ? t('common', 'noResults')
                : activeTab === 'shared_by_me' ? t('share', 'noActiveShares') : t('share', 'noReceivedCards')}
            </Text>
            <Text style={styles.emptyDesc}>
              {activeFilter !== 'all'
                ? `${t('share', TYPE_FILTER_KEY[activeFilter])} — ${t('statsExtra', 'noItemsFound')}`
                : activeTab === 'shared_by_me'
                  ? t('share', 'noActiveSharesDesc')
                  : t('share', 'noReceivedCardsDesc')}
            </Text>
            {activeFilter !== 'all' ? (
              <Pressable style={styles.resetFilterBtn} onPress={() => setActiveFilter('all')}>
                <MaterialIcons name="refresh" size={16} color="#FFF" />
                <Text style={styles.resetFilterBtnText}>{t('common', 'reset')}</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        )}

        {/* Legend */}
        {activeTab === 'shared_by_me' && myShares.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.legendCard}>
            <Text style={styles.legendTitle}>{t('share', 'actions')}</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="content-copy" size={13} color={theme.primary} />
              </View>
              <Text style={styles.legendText}>{t('share', 'copyShareCode')}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: theme.warning + '15' }]}>
                <MaterialIcons name="lock" size={13} color={theme.warning} />
              </View>
              <Text style={styles.legendText}>{t('share', 'toggleReadWrite')}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendIcon, { backgroundColor: theme.error + '15' }]}>
                <MaterialIcons name="delete-outline" size={13} color={theme.error} />
              </View>
              <Text style={styles.legendText}>{t('share', 'revokeTheShare')}</Text>
            </View>
          </Animated.View>
        ) : null}
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

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
  },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.md,
    paddingVertical: 8, paddingHorizontal: 10,
    borderWidth: 1.5, borderColor: theme.border,
    ...theme.shadows.card,
  },
  statChipIcon: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  statChipCount: { fontSize: 16, fontWeight: '800' },
  statChipLabel: { fontSize: 12, fontWeight: '500', color: theme.textSecondary },

  // Filter active row
  filterActiveRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  filterActiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.borderRadius.full,
  },
  filterActiveText: { fontSize: 13, fontWeight: '600' },
  clearFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  clearFilterText: { fontSize: 12, fontWeight: '500', color: theme.textMuted },

  // Group section
  groupSection: { marginBottom: 20 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  groupHeaderIcon: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  groupHeaderTitle: {
    fontSize: 13, fontWeight: '700', color: theme.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  groupHeaderCount: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  groupHeaderCountText: { fontSize: 11, fontWeight: '700' },
  groupHeaderLine: { flex: 1, height: 1 },

  // Item card
  groupItemsList: { gap: 8 },
  itemCard: {
    flexDirection: 'row', backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md, overflow: 'hidden',
    ...theme.shadows.card,
  },
  itemAccent: { width: 4 },
  itemBody: { flex: 1, padding: 12 },
  itemTopRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  itemNameGroup: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 4 },
  itemBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemPermBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  itemPermBadgeText: { fontSize: 10, fontWeight: '600' },
  itemDate: { fontSize: 11, color: theme.textMuted },
  itemActions: { flexDirection: 'row', gap: 5 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: theme.backgroundSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnSuccess: { backgroundColor: theme.success + '15' },
  actionBtnDanger: { backgroundColor: theme.error + '10' },
  actionBtnSave: { backgroundColor: theme.accent + '15' },

  // Bottom row (code + accessor)
  itemBottomRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border + '60',
  },
  codeContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  codeText: {
    fontSize: 12, fontWeight: '600', color: theme.textMuted, letterSpacing: 1, fontFamily: 'monospace',
  },
  accessorContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    maxWidth: '50%',
  },
  accessorText: {
    fontSize: 11, fontWeight: '500', color: theme.success,
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
  resetFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 20,
    backgroundColor: theme.primary, borderRadius: theme.borderRadius.full, marginTop: 16,
  },
  resetFilterBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },

  // Legend
  legendCard: {
    backgroundColor: theme.surface, borderRadius: theme.borderRadius.lg,
    padding: 14, gap: 8, borderWidth: 1, borderColor: theme.border,
  },
  legendTitle: {
    fontSize: 11, fontWeight: '600', color: theme.textSecondary, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 2,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendIcon: {
    width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
  },
  legendText: { fontSize: 12, color: theme.textPrimary },
});
