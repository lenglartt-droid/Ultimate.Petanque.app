/**
 * Admin User Management Page
 *
 * Allows admins to:
 * - Search users by name/email
 * - Toggle premium/admin status
 * - View user stats (matches, last connection)
 * - View user count and premium count
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { logAdminAction } from '@/services/adminActivityLogService';

interface AdminUser {
  id: string;
  username: string | null;
  email: string;
  avatar: string | null;
  role: string | null;
  level: string | null;
  club: string | null;
  isPremium: boolean;
  isAdmin: boolean;
  xp: number;
  createdAt: string;
  matchCount?: number;
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const { showAlert } = useAlert();
  const fr = language === 'fr';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'premium' | 'admin'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, email, avatar, role, level, club, is_premium, is_admin, xp')
        .order('email', { ascending: true })
        .limit(500);

      if (error) { console.log('[AdminUsers] Error:', error); return; }

      // Fetch match counts per user
      const userIds = (data || []).map((u: any) => u.id);
      let matchCounts = new Map<string, number>();
      if (userIds.length > 0) {
        const { data: matches } = await supabase
          .from('matches')
          .select('user_id')
          .in('user_id', userIds);
        (matches || []).forEach((m: any) => {
          matchCounts.set(m.user_id, (matchCounts.get(m.user_id) || 0) + 1);
        });
      }

      setUsers((data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        avatar: u.avatar,
        role: u.role,
        level: u.level,
        club: u.club,
        isPremium: u.is_premium || false,
        isAdmin: u.is_admin || false,
        xp: u.xp || 0,
        createdAt: u.created_at || new Date().toISOString(),
        matchCount: matchCounts.get(u.id) || 0,
      })));
    } catch (e) {
      console.log('[AdminUsers] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    let items = users;
    if (filterType === 'premium') items = items.filter(u => u.isPremium);
    else if (filterType === 'admin') items = items.filter(u => u.isAdmin);
    if (search.trim()) {
      const s = search.toLowerCase();
      items = items.filter(u =>
        u.username?.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.club?.toLowerCase().includes(s)
      );
    }
    return items;
  }, [users, search, filterType]);

  const stats = useMemo(() => ({
    total: users.length,
    premium: users.filter(u => u.isPremium).length,
    admin: users.filter(u => u.isAdmin).length,
    totalMatches: users.reduce((sum, u) => sum + (u.matchCount || 0), 0),
  }), [users]);

  const handleTogglePremium = useCallback(async (user: AdminUser) => {
    const newVal = !user.isPremium;
    Alert.alert(
      fr ? 'Changer le statut Premium ?' : 'Change Premium status?',
      `${user.username || user.email}\n${newVal ? (fr ? 'Activer Premium' : 'Enable Premium') : (fr ? 'Desactiver Premium' : 'Disable Premium')}`,
      [
        { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
        { text: fr ? 'Confirmer' : 'Confirm', onPress: async () => {
          setTogglingId(user.id);
          const supabase = getSupabaseClient();
          const { error } = await supabase
            .from('user_profiles')
            .update({ is_premium: newVal })
            .eq('id', user.id);
          setTogglingId(null);
          if (error) { showAlert(fr ? 'Erreur' : 'Error', error.message); return; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isPremium: newVal } : u));
          logAdminAction({ actionType: newVal ? 'user_premium_enable' : 'user_premium_disable', targetType: 'user', targetId: user.id, targetName: user.username || user.email, actionDetail: `Premium ${newVal ? 'enabled' : 'disabled'}` });
        }},
      ]
    );
  }, [fr, showAlert]);

  const handleToggleAdmin = useCallback(async (user: AdminUser) => {
    const newVal = !user.isAdmin;
    Alert.alert(
      fr ? 'Changer le statut Admin ?' : 'Change Admin status?',
      `${user.username || user.email}\n${newVal ? (fr ? 'Promouvoir admin' : 'Promote to admin') : (fr ? 'Retirer admin' : 'Remove admin')}`,
      [
        { text: fr ? 'Annuler' : 'Cancel', style: 'cancel' },
        { text: fr ? 'Confirmer' : 'Confirm', style: newVal ? 'default' : 'destructive', onPress: async () => {
          setTogglingId(user.id);
          const supabase = getSupabaseClient();
          const { error } = await supabase
            .from('user_profiles')
            .update({ is_admin: newVal })
            .eq('id', user.id);
          setTogglingId(null);
          if (error) { showAlert(fr ? 'Erreur' : 'Error', error.message); return; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isAdmin: newVal } : u));
          logAdminAction({ actionType: newVal ? 'user_admin_promote' : 'user_admin_demote', targetType: 'user', targetId: user.id, targetName: user.username || user.email, actionDetail: `Admin ${newVal ? 'promoted' : 'demoted'}` });
        }},
      ]
    );
  }, [fr, showAlert]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
          </Pressable>
          <Text style={s.headerTitle}>{fr ? 'Utilisateurs' : 'Users'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={s.headerTitle}>{fr ? 'Gestion Utilisateurs' : 'User Management'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {/* Stats */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={s.statsGrid}>
            <View style={[s.statCard, { borderColor: '#3B82F620' }]}>
              <View style={[s.statIcon, { backgroundColor: '#DBEAFE' }]}>
                <MaterialIcons name="people" size={18} color="#3B82F6" />
              </View>
              <Text style={[s.statValue, { color: '#3B82F6' }]}>{stats.total}</Text>
              <Text style={s.statLabel}>{fr ? 'Total' : 'Total'}</Text>
            </View>
            <View style={[s.statCard, { borderColor: '#D4A01720' }]}>
              <View style={[s.statIcon, { backgroundColor: '#FEF3C7' }]}>
                <MaterialIcons name="star" size={18} color="#D4A017" />
              </View>
              <Text style={[s.statValue, { color: '#D4A017' }]}>{stats.premium}</Text>
              <Text style={s.statLabel}>Premium</Text>
            </View>
            <View style={[s.statCard, { borderColor: '#DC262620' }]}>
              <View style={[s.statIcon, { backgroundColor: '#FEF2F2' }]}>
                <MaterialIcons name="admin-panel-settings" size={18} color="#DC2626" />
              </View>
              <Text style={[s.statValue, { color: '#DC2626' }]}>{stats.admin}</Text>
              <Text style={s.statLabel}>Admins</Text>
            </View>
            <View style={[s.statCard, { borderColor: '#10B98120' }]}>
              <View style={[s.statIcon, { backgroundColor: '#DCFCE7' }]}>
                <MaterialIcons name="sports" size={18} color="#10B981" />
              </View>
              <Text style={[s.statValue, { color: '#10B981' }]}>{stats.totalMatches}</Text>
              <Text style={s.statLabel}>{fr ? 'Matchs' : 'Matches'}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Search */}
        <View style={s.searchWrap}>
          <MaterialIcons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={fr ? 'Rechercher nom, email, club...' : 'Search name, email, club...'}
            placeholderTextColor="#94A3B8"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <MaterialIcons name="close" size={16} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        {/* Filter chips */}
        <View style={s.filterRow}>
          {([
            { key: 'all' as const, label: fr ? 'Tout' : 'All', icon: 'people', count: stats.total },
            { key: 'premium' as const, label: 'Premium', icon: 'star', count: stats.premium },
            { key: 'admin' as const, label: 'Admin', icon: 'admin-panel-settings', count: stats.admin },
          ]).map(f => {
            const isActive = filterType === f.key;
            return (
              <Pressable
                key={f.key}
                style={[s.filterChip, isActive && s.filterChipActive]}
                onPress={() => { Haptics.selectionAsync(); setFilterType(f.key); }}
              >
                <MaterialIcons name={f.icon as any} size={13} color={isActive ? '#FFF' : '#64748B'} />
                <Text style={[s.filterChipText, isActive && { color: '#FFF' }]}>{f.label}</Text>
                <View style={[s.filterChipBadge, isActive && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={[s.filterChipBadgeText, isActive && { color: '#FFF' }]}>{f.count}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Users list */}
        {filteredUsers.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}><MaterialIcons name="person-search" size={40} color="#CBD5E1" /></View>
            <Text style={s.emptyTitle}>{fr ? 'Aucun utilisateur' : 'No users found'}</Text>
          </View>
        ) : (
          filteredUsers.map((user, idx) => (
            <Animated.View key={user.id} entering={FadeInDown.duration(200).delay(Math.min(idx * 15, 300))}>
              <View style={s.userCard}>
                <View style={s.userHeader}>
                  {user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={s.userAvatar} contentFit="cover" transition={200} />
                  ) : (
                    <View style={s.userAvatarPlaceholder}>
                      <Text style={s.userAvatarText}>{(user.username || user.email).charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.userNameRow}>
                      <Text style={s.userName} numberOfLines={1}>{user.username || (fr ? 'Sans nom' : 'No name')}</Text>
                      {user.isAdmin ? (
                        <View style={s.adminBadge}><MaterialIcons name="shield" size={10} color="#DC2626" /></View>
                      ) : null}
                      {user.isPremium ? (
                        <View style={s.premiumBadge}><MaterialIcons name="star" size={10} color="#D4A017" /></View>
                      ) : null}
                    </View>
                    <Text style={s.userEmail} numberOfLines={1}>{user.email}</Text>
                    <View style={s.userMetaRow}>
                      {user.role ? (
                        <View style={s.userMetaChip}>
                          <MaterialIcons name="sports" size={9} color="#64748B" />
                          <Text style={s.userMetaText}>{user.role}</Text>
                        </View>
                      ) : null}
                      {user.club ? (
                        <View style={s.userMetaChip}>
                          <MaterialIcons name="home" size={9} color="#64748B" />
                          <Text style={s.userMetaText} numberOfLines={1}>{user.club}</Text>
                        </View>
                      ) : null}
                      <View style={s.userMetaChip}>
                        <MaterialIcons name="sports" size={9} color="#64748B" />
                        <Text style={s.userMetaText}>{user.matchCount || 0} {fr ? 'matchs' : 'matches'}</Text>
                      </View>
                      <View style={s.userMetaChip}>
                        <MaterialIcons name="bolt" size={9} color="#7C3AED" />
                        <Text style={[s.userMetaText, { color: '#7C3AED' }]}>{user.xp} XP</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Toggle row */}
                <View style={s.toggleRow}>
                  <View style={s.toggleItem}>
                    <MaterialIcons name="star" size={14} color={user.isPremium ? '#D4A017' : '#94A3B8'} />
                    <Text style={[s.toggleLabel, user.isPremium && { color: '#D4A017' }]}>Premium</Text>
                    <Switch
                      value={user.isPremium}
                      onValueChange={() => handleTogglePremium(user)}
                      trackColor={{ false: '#E2E8F0', true: '#D4A01760' }}
                      thumbColor={user.isPremium ? '#D4A017' : '#94A3B8'}
                      disabled={togglingId === user.id}
                    />
                  </View>
                  <View style={s.toggleDivider} />
                  <View style={s.toggleItem}>
                    <MaterialIcons name="admin-panel-settings" size={14} color={user.isAdmin ? '#DC2626' : '#94A3B8'} />
                    <Text style={[s.toggleLabel, user.isAdmin && { color: '#DC2626' }]}>Admin</Text>
                    <Switch
                      value={user.isAdmin}
                      onValueChange={() => handleToggleAdmin(user)}
                      trackColor={{ false: '#E2E8F0', true: '#DC262660' }}
                      thumbColor={user.isAdmin ? '#DC2626' : '#94A3B8'}
                      disabled={togglingId === user.id}
                    />
                  </View>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Stats
  statsGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  statIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', color: '#94A3B8', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 14, gap: 8, marginBottom: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A', paddingVertical: 12 },

  // Filter
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  filterChipBadge: { minWidth: 20, height: 18, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  filterChipBadgeText: { fontSize: 9, fontWeight: '800', color: '#94A3B8' },

  // User card
  userCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  userAvatar: { width: 44, height: 44, borderRadius: 12 },
  userAvatarPlaceholder: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { fontSize: 18, fontWeight: '700', color: '#64748B' },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  userEmail: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  userMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  userMetaChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F8FAFC', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  userMetaText: { fontSize: 10, fontWeight: '600', color: '#64748B', maxWidth: 80 },
  adminBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
  premiumBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDE68A' },

  // Toggles
  toggleRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  toggleItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  toggleLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', flex: 1 },
  toggleDivider: { width: 1, height: 24, backgroundColor: '#E2E8F0', marginHorizontal: 6 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 56 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
});
