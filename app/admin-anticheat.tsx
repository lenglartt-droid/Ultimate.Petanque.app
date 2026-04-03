import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
  TextInput, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import AdminQuickNav from '@/components/feature/AdminQuickNav';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useApp } from '@/contexts/AppContext';
import {
  fetchSuspiciousPlayers, updateSuspiciousStatus, updateTrustScore,
  getTrustScoreColor, getTrustScoreIcon, getTrustLevelLabel, getLevelFromScore,
  banPlayer,
} from '@/services/trustScoreService';
import { extraTranslations } from '@/constants/i18nExtra';
import { recalculateAllElo, ELO_RANKS, getEloRank, ELO_INITIAL, applyInactivityDecay } from '@/services/eloService';

const et = extraTranslations.trustScore;

type StatusFilter = 'all' | 'flagged' | 'watch' | 'ok' | 'dismissed' | 'banned';

export default function AdminAntiCheatScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { isAdmin } = useApp();
  const isFr = language === 'fr';

  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  // ELO recalculation
  const [recalculating, setRecalculating] = useState(false);

  // ELO dashboard
  const [eloDashboard, setEloDashboard] = useState<{
    totalPlayers: number;
    distribution: { tier: string; count: number; color: string; label: string }[];
    avgElo: number;
    decayCount: number;
    topPlayer: { name: string; elo: number } | null;
  } | null>(null);
  const [eloLoading, setEloLoading] = useState(true);
  const [applyingDecay, setApplyingDecay] = useState(false);

  // Detail modal
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [adjustScore, setAdjustScore] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { players: p, error } = await fetchSuspiciousPlayers();
    if (error) showAlert((et.adminTitle as any)?.[language] || 'Error', error);
    setPlayers(p);
    setLoading(false);
  }, [language]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load ELO dashboard
  useEffect(() => {
    (async () => {
      setEloLoading(true);
      try {
        const supabase = getSupabaseClient();
        const { data: allPlayers } = await supabase
          .from('players')
          .select('id, name, elo_rating, last_match_date');
        if (allPlayers && allPlayers.length > 0) {
          const dist = ELO_RANKS.map(rank => {
            const nextRank = ELO_RANKS[ELO_RANKS.indexOf(rank) - 1];
            const max = nextRank ? nextRank.minElo : Infinity;
            const count = allPlayers.filter(p => {
              const elo = p.elo_rating || ELO_INITIAL;
              return elo >= rank.minElo && elo < max;
            }).length;
            return { tier: rank.tier, count, color: rank.color, label: rank.label[isFr ? 'fr' : 'en'] };
          }).reverse();
          const totalElo = allPlayers.reduce((s, p) => s + (p.elo_rating || ELO_INITIAL), 0);
          const avgElo = Math.round(totalElo / allPlayers.length);
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const decayCount = allPlayers.filter(p => p.last_match_date && new Date(p.last_match_date) < cutoff && (p.elo_rating || ELO_INITIAL) > 800).length;
          const top = allPlayers.reduce((best, p) => (p.elo_rating || 0) > (best?.elo_rating || 0) ? p : best, allPlayers[0]);
          setEloDashboard({
            totalPlayers: allPlayers.length,
            distribution: dist,
            avgElo,
            decayCount,
            topPlayer: top ? { name: top.name, elo: top.elo_rating || ELO_INITIAL } : null,
          });
        }
      } catch { }
      setEloLoading(false);
    })();
  }, [isFr]);

  // Summary statistics
  const summaryStats = React.useMemo(() => {
    if (players.length === 0) return { total: 0, avg: 0, verified: 0, high: 0, medium: 0, low: 0, suspicious: 0, weeklyFlagged: 0 };
    const total = players.length;
    const avg = Math.round(players.reduce((s, p) => s + p.trustScore, 0) / total);
    let verified = 0, high = 0, medium = 0, low = 0, suspicious = 0;
    players.forEach(p => {
      const ts = p.trustScore;
      if (ts >= 80) verified++;
      else if (ts >= 65) high++;
      else if (ts >= 45) medium++;
      else if (ts >= 25) low++;
      else suspicious++;
    });
    // Weekly flagged: players analyzed in the last 7 days with flags
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyFlagged = players.filter(p => {
      if (p.flags.length === 0) return false;
      return p.analyzedAt ? new Date(p.analyzedAt) > oneWeekAgo : false;
    }).length;
    return { total, avg, verified, high, medium, low, suspicious, weeklyFlagged };
  }, [players]);

  const handleBatchDismissOk = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const okPlayers = players.filter(p => p.status === 'ok' && p.flags.length === 0);
    if (okPlayers.length === 0) return;
    for (const p of okPlayers) {
      await updateSuspiciousStatus(p.id, 'dismissed');
    }
    setPlayers(prev => prev.map(p => (p.status === 'ok' && p.flags.length === 0) ? { ...p, status: 'dismissed' } : p));
    showAlert(isFr ? `${okPlayers.length} joueurs ignores` : `${okPlayers.length} players dismissed`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRunFullScan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setScanning(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.functions.invoke('detect-suspicious', { body: { mode: 'full' } });
      setTimeout(async () => {
        await loadData();
        setScanning(false);
        showAlert((et.adminScanComplete as any)?.[language] || 'Done');
      }, 3000);
    } catch (e: any) {
      setScanning(false);
      showAlert('Error', e.message);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    Haptics.selectionAsync();
    if (status === 'banned') {
      // Ban enforcement: set trust score to 0 and status to banned
      const player = players.find(p => p.id === id);
      const { error } = await banPlayer(id, player?.playerId || '');
      if (error) { showAlert('Error', error); return; }
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, status: 'banned', trustScore: 0 } : p));
      if (selectedPlayer?.id === id) setSelectedPlayer((prev: any) => prev ? { ...prev, status: 'banned', trustScore: 0 } : prev);
    } else {
      const { error } = await updateSuspiciousStatus(id, status);
      if (error) { showAlert('Error', error); return; }
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      if (selectedPlayer?.id === id) setSelectedPlayer((prev: any) => prev ? { ...prev, status } : prev);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedPlayer) return;
    setSavingNotes(true);
    const { error } = await updateSuspiciousStatus(selectedPlayer.id, selectedPlayer.status, adminNotes);
    setSavingNotes(false);
    if (error) { showAlert('Error', error); return; }
    setPlayers(prev => prev.map(p => p.id === selectedPlayer.id ? { ...p, adminNotes } : p));
    setSelectedPlayer((prev: any) => prev ? { ...prev, adminNotes } : prev);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAdjustScore = async () => {
    if (!selectedPlayer || !adjustScore) return;
    const newScore = parseInt(adjustScore);
    if (isNaN(newScore) || newScore < 0 || newScore > 100) {
      showAlert('Error', 'Score must be 0-100');
      return;
    }
    const { error } = await updateTrustScore(selectedPlayer.id, newScore);
    if (error) { showAlert('Error', error); return; }
    setPlayers(prev => prev.map(p => p.id === selectedPlayer.id ? { ...p, trustScore: newScore } : p));
    setSelectedPlayer((prev: any) => prev ? { ...prev, trustScore: newScore } : prev);
    setShowAdjustModal(false);
    setAdjustScore('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const filtered = players.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!(p.playerName || '').toLowerCase().includes(q) && !p.playerId.includes(q)) return false;
    }
    return true;
  });

  const statusCounts = {
    all: players.length,
    flagged: players.filter(p => p.status === 'flagged').length,
    watch: players.filter(p => p.status === 'watch').length,
    ok: players.filter(p => p.status === 'ok').length,
    dismissed: players.filter(p => p.status === 'dismissed').length,
    banned: players.filter(p => p.status === 'banned').length,
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={st.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="lock" size={48} color={theme.textMuted} />
          <Text style={{ fontSize: 16, color: theme.textMuted, marginTop: 12 }}>Admin only</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'flagged': return '#EF4444';
      case 'watch': return '#F97316';
      case 'ok': return '#22C55E';
      case 'dismissed': return '#6B7280';
      case 'banned': return '#DC2626';
      default: return theme.textMuted;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, any> = {
      ok: et.adminStatusOk, watch: et.adminStatusWatch,
      flagged: et.adminStatusFlagged, banned: et.adminStatusBanned,
      dismissed: et.adminStatusDismissed,
    };
    return (labels[status] as any)?.[language] || status;
  };

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>{(et.adminTitle as any)?.[language] || 'Anti-cheat'}</Text>
          <Text style={st.headerSub}>{filtered.length} {(et.adminDesc as any)?.[language] || 'players'}</Text>
        </View>
        <Pressable
          style={[st.eloRecalcBtn, recalculating && { opacity: 0.6 }]}
          onPress={async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            setRecalculating(true);
            const { success, error, playersUpdated } = await recalculateAllElo();
            setRecalculating(false);
            if (success) {
              showAlert(t('leaderboard', 'eloRecalculated').replace('{count}', String(playersUpdated)));
            } else {
              showAlert('Error', error || 'Unknown error');
            }
          }}
          disabled={recalculating}
        >
          {recalculating ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="calculate" size={16} color="#FFF" />}
          <Text style={st.eloRecalcBtnText}>{recalculating ? t('leaderboard', 'eloRecalculating') : 'ELO'}</Text>
        </Pressable>
        <Pressable
          style={[st.scanBtn, scanning && { opacity: 0.6 }]}
          onPress={handleRunFullScan}
          disabled={scanning}
        >
          {scanning ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="radar" size={18} color="#FFF" />}
          <Text style={st.scanBtnText}>{scanning ? ((et.adminScanning as any)?.[language] || 'Scanning...') : ((et.adminRunFullScan as any)?.[language] || 'Scan')}</Text>
        </Pressable>
      </View>

      <AdminQuickNav currentRoute="/admin-anticheat" />

      {/* ============ ELO Dashboard ============ */}
      {!eloLoading && eloDashboard ? (
        <View style={st.eloDashSection}>
          <View style={st.eloDashHeader}>
            <View style={[st.eloDashIcon, { backgroundColor: '#9333EA15' }]}>
              <MaterialIcons name="diamond" size={18} color="#9333EA" />
            </View>
            <Text style={st.eloDashTitle}>{isFr ? 'Tableau de bord ELO' : 'ELO Dashboard'}</Text>
          </View>

          {/* Top stats */}
          <View style={st.eloDashStatsRow}>
            <View style={st.eloDashStat}>
              <Text style={[st.eloDashStatValue, { color: '#9333EA' }]}>{eloDashboard.totalPlayers}</Text>
              <Text style={st.eloDashStatLabel}>{isFr ? 'Joueurs' : 'Players'}</Text>
            </View>
            <View style={st.eloDashStat}>
              <Text style={[st.eloDashStatValue, { color: getEloRank(eloDashboard.avgElo).color }]}>{eloDashboard.avgElo}</Text>
              <Text style={st.eloDashStatLabel}>{isFr ? 'ELO moyen' : 'Avg ELO'}</Text>
            </View>
            <View style={st.eloDashStat}>
              <Text style={[st.eloDashStatValue, { color: '#F59E0B' }]}>{eloDashboard.decayCount}</Text>
              <Text style={st.eloDashStatLabel}>{isFr ? 'En decay' : 'Decaying'}</Text>
            </View>
            {eloDashboard.topPlayer ? (
              <View style={st.eloDashStat}>
                <Text style={[st.eloDashStatValue, { color: getEloRank(eloDashboard.topPlayer.elo).color, fontSize: 14 }]}>{eloDashboard.topPlayer.elo}</Text>
                <Text style={st.eloDashStatLabel} numberOfLines={1}>{eloDashboard.topPlayer.name.split(' ')[0]}</Text>
              </View>
            ) : null}
          </View>

          {/* Rank distribution bar */}
          <View style={st.eloDashDistRow}>
            {eloDashboard.distribution.map(d => {
              const pct = eloDashboard.totalPlayers > 0 ? Math.round((d.count / eloDashboard.totalPlayers) * 100) : 0;
              return (
                <View key={d.tier} style={st.eloDashDistItem}>
                  <View style={st.eloDashDistBarTrack}>
                    <View style={[st.eloDashDistBarFill, { height: `${Math.max(pct, 4)}%`, backgroundColor: d.color }]} />
                  </View>
                  <Text style={[st.eloDashDistPct, { color: d.color }]}>{pct}%</Text>
                  <Text style={st.eloDashDistLabel} numberOfLines={1}>{d.label}</Text>
                  <Text style={[st.eloDashDistCount, { color: d.color }]}>{d.count}</Text>
                </View>
              );
            })}
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              style={[st.eloDashActionBtn, { backgroundColor: '#F59E0B15', borderColor: '#F59E0B30' }, applyingDecay && { opacity: 0.6 }]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setApplyingDecay(true);
                const { playersDecayed } = await applyInactivityDecay();
                setApplyingDecay(false);
                showAlert(isFr ? `Decay applique a ${playersDecayed} joueurs` : `Decay applied to ${playersDecayed} players`);
              }}
              disabled={applyingDecay}
            >
              {applyingDecay ? <ActivityIndicator size="small" color="#F59E0B" /> : <MaterialIcons name="timer-off" size={14} color="#F59E0B" />}
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#F59E0B' }}>{isFr ? 'Appliquer decay' : 'Apply decay'}</Text>
            </Pressable>
            <Pressable
              style={[st.eloDashActionBtn, { backgroundColor: '#7C3AED15', borderColor: '#7C3AED30' }, recalculating && { opacity: 0.6 }]}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setRecalculating(true);
                const { success, error, playersUpdated } = await recalculateAllElo();
                setRecalculating(false);
                if (success) {
                  showAlert(t('leaderboard', 'eloRecalculated').replace('{count}', String(playersUpdated)));
                } else {
                  showAlert('Error', error || 'Unknown');
                }
              }}
              disabled={recalculating}
            >
              {recalculating ? <ActivityIndicator size="small" color="#7C3AED" /> : <MaterialIcons name="calculate" size={14} color="#7C3AED" />}
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>{recalculating ? '...' : (isFr ? 'Recalculer ELO' : 'Recalc ELO')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Summary Statistics Dashboard */}
      {!loading && players.length > 0 ? (
        <View style={st.summarySection}>
          {/* Top stats row */}
          <View style={st.summaryRow}>
            <View style={st.summaryCard}>
              <Text style={st.summaryValue}>{summaryStats.total}</Text>
              <Text style={st.summaryLabel}>{isFr ? 'Analyses' : 'Analyzed'}</Text>
            </View>
            <View style={st.summaryCard}>
              <Text style={[st.summaryValue, { color: summaryStats.avg >= 65 ? '#22C55E' : summaryStats.avg >= 45 ? '#D97706' : '#EF4444' }]}>{summaryStats.avg}</Text>
              <Text style={st.summaryLabel}>{isFr ? 'Score moyen' : 'Avg score'}</Text>
            </View>
            <View style={st.summaryCard}>
              <Text style={[st.summaryValue, { color: '#EF4444' }]}>{summaryStats.weeklyFlagged}</Text>
              <Text style={st.summaryLabel}>{isFr ? 'Signales 7j' : 'Flagged 7d'}</Text>
            </View>
          </View>
          {/* Pie chart (simplified bar distribution) */}
          <View style={st.distRow}>
            {[
              { label: isFr ? 'Verifie' : 'Verified', count: summaryStats.verified, color: '#22C55E' },
              { label: isFr ? 'Fiable' : 'Trusted', count: summaryStats.high, color: '#3B82F6' },
              { label: 'Standard', count: summaryStats.medium, color: '#D97706' },
              { label: isFr ? 'A surveiller' : 'Watch', count: summaryStats.low, color: '#F97316' },
              { label: isFr ? 'Suspect' : 'Suspicious', count: summaryStats.suspicious, color: '#EF4444' },
            ].map(d => {
              const pct = summaryStats.total > 0 ? Math.round((d.count / summaryStats.total) * 100) : 0;
              return (
                <View key={d.label} style={st.distItem}>
                  <View style={st.distBarTrack}>
                    <View style={[st.distBarFill, { height: `${Math.max(pct, 4)}%`, backgroundColor: d.color }]} />
                  </View>
                  <Text style={[st.distPct, { color: d.color }]}>{pct}%</Text>
                  <Text style={st.distLabel} numberOfLines={1}>{d.label}</Text>
                  <Text style={st.distCount}>{d.count}</Text>
                </View>
              );
            })}
          </View>
          {/* Batch dismiss button */}
          {summaryStats.total > 0 ? (
            <Pressable style={st.batchDismissBtn} onPress={handleBatchDismissOk}>
              <MaterialIcons name="check-circle" size={16} color="#22C55E" />
              <Text style={st.batchDismissBtnText}>
                {isFr ? 'Ignorer tous les OK sans alertes' : 'Dismiss all OK with no flags'}
                {' '}({players.filter(p => p.status === 'ok' && p.flags.length === 0).length})
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterRow}>
        {(['all', 'flagged', 'watch', 'ok', 'dismissed', 'banned'] as StatusFilter[]).map(sf => (
          <Pressable
            key={sf}
            style={[st.filterChip, statusFilter === sf && { backgroundColor: sf === 'all' ? theme.primary : getStatusColor(sf), borderColor: sf === 'all' ? theme.primary : getStatusColor(sf) }]}
            onPress={() => { Haptics.selectionAsync(); setStatusFilter(sf); }}
          >
            <Text style={[st.filterChipText, statusFilter === sf && { color: '#FFF' }]}>{sf === 'all' ? (isFr ? 'Tous' : 'All') : getStatusLabel(sf)}</Text>
            <View style={[st.filterCount, statusFilter === sf && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
              <Text style={[st.filterCountText, statusFilter === sf && { color: '#FFF' }]}>{statusCounts[sf]}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={st.searchBar}>
        <MaterialIcons name="search" size={18} color={theme.textMuted} />
        <TextInput style={st.searchInput} value={search} onChangeText={setSearch} placeholder={isFr ? 'Rechercher un joueur...' : 'Search player...'} placeholderTextColor={theme.textMuted} />
        {search.length > 0 ? <Pressable onPress={() => setSearch('')} hitSlop={8}><MaterialIcons name="close" size={16} color={theme.textMuted} /></Pressable> : null}
      </View>

      <ScrollView
        style={st.list}
        contentContainerStyle={[st.listContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
      >
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <MaterialIcons name="check-circle" size={48} color={theme.success} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 }}>
              {(et.adminNoPlayers as any)?.[language] || 'No players'}
            </Text>
          </View>
        ) : (
          filtered.map((p, idx) => {
            const scoreColor = getTrustScoreColor(p.trustScore);
            const level = getLevelFromScore(p.trustScore);
            return (
              <Animated.View key={p.id} entering={FadeInDown.duration(300).delay(Math.min(idx * 40, 400))}>
                <Pressable
                  style={[st.playerCard, { borderLeftColor: getStatusColor(p.status) }]}
                  onPress={() => { setSelectedPlayer(p); setAdminNotes(p.adminNotes || ''); }}
                >
                  <View style={st.playerHeader}>
                    <View style={st.playerAvatar}>
                      {p.playerAvatar ? (
                        <Image source={{ uri: p.playerAvatar }} style={{ width: 40, height: 40, borderRadius: 12 }} contentFit="cover" />
                      ) : (
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.textSecondary }}>{(p.playerName || '?').charAt(0)}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.playerName}>{p.playerName || p.playerId.substring(0, 8)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <View style={[st.statusBadge, { backgroundColor: getStatusColor(p.status) + '15', borderColor: getStatusColor(p.status) + '30' }]}>
                          <Text style={[st.statusBadgeText, { color: getStatusColor(p.status) }]}>{getStatusLabel(p.status)}</Text>
                        </View>
                        {p.flags.length > 0 ? (
                          <View style={st.flagCountBadge}>
                            <MaterialIcons name="flag" size={10} color="#EF4444" />
                            <Text style={st.flagCountText}>{p.flags.length}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={[st.scoreCircle, { borderColor: scoreColor }]}>
                      <Text style={[st.scoreText, { color: scoreColor }]}>{p.trustScore}</Text>
                    </View>
                  </View>
                  {p.flags.length > 0 ? (
                    <View style={st.flagsRow}>
                      {p.flags.slice(0, 3).map((flag: string, fi: number) => (
                        <View key={fi} style={st.flagChip}>
                          <Text style={st.flagChipText}>{flag.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                      {p.flags.length > 3 ? <Text style={st.flagMore}>+{p.flags.length - 3}</Text> : null}
                    </View>
                  ) : null}
                  {/* Quick actions */}
                  <View style={st.quickActions}>
                    {p.status !== 'dismissed' ? (
                      <Pressable style={[st.qAction, { backgroundColor: '#6B728015' }]} onPress={() => handleUpdateStatus(p.id, 'dismissed')}>
                        <MaterialIcons name="check" size={14} color="#6B7280" />
                        <Text style={[st.qActionText, { color: '#6B7280' }]}>{(et.adminDismiss as any)?.[language] || 'Dismiss'}</Text>
                      </Pressable>
                    ) : null}
                    {p.status !== 'banned' ? (
                      <Pressable style={[st.qAction, { backgroundColor: '#EF444415' }]} onPress={() => handleUpdateStatus(p.id, 'banned')}>
                        <MaterialIcons name="block" size={14} color="#EF4444" />
                        <Text style={[st.qActionText, { color: '#EF4444' }]}>{(et.adminBan as any)?.[language] || 'Ban'}</Text>
                      </Pressable>
                    ) : null}
                    {p.status === 'banned' || p.status === 'dismissed' ? (
                      <Pressable style={[st.qAction, { backgroundColor: '#22C55E15' }]} onPress={() => handleUpdateStatus(p.id, 'ok')}>
                        <MaterialIcons name="undo" size={14} color="#22C55E" />
                        <Text style={[st.qActionText, { color: '#22C55E' }]}>{isFr ? 'Restaurer' : 'Restore'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={selectedPlayer !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedPlayer(null)}>
        <SafeAreaView style={st.detailContainer}>
          <View style={st.detailHeader}>
            <Pressable style={st.detailClose} onPress={() => setSelectedPlayer(null)}>
              <MaterialIcons name="close" size={24} color={theme.textPrimary} />
            </Pressable>
            <Text style={st.detailTitle}>{selectedPlayer?.playerName || 'Player'}</Text>
            <Pressable style={st.detailViewBtn} onPress={() => { setSelectedPlayer(null); router.push(`/player/${selectedPlayer?.playerId}` as any); }}>
              <MaterialIcons name="open-in-new" size={20} color={theme.primary} />
            </Pressable>
          </View>
          {selectedPlayer ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
              {/* Score hero */}
              <View style={[st.detailScoreCard, { borderColor: getTrustScoreColor(selectedPlayer.trustScore) + '30' }]}>
                <View style={[st.detailScoreCircle, { borderColor: getTrustScoreColor(selectedPlayer.trustScore) }]}>
                  <Text style={[st.detailScoreValue, { color: getTrustScoreColor(selectedPlayer.trustScore) }]}>{selectedPlayer.trustScore}</Text>
                  <Text style={st.detailScoreMax}>/100</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.detailLevel, { color: getTrustScoreColor(selectedPlayer.trustScore) }]}>
                    {getTrustLevelLabel(getLevelFromScore(selectedPlayer.trustScore), isFr)}
                  </Text>
                  <Text style={st.detailStatus}>Status: {getStatusLabel(selectedPlayer.status)}</Text>
                  <Text style={st.detailAnalyzed}>
                    {selectedPlayer.analyzedAt ? new Date(selectedPlayer.analyzedAt).toLocaleString(isFr ? 'fr-FR' : 'en-US') : '-'}
                  </Text>
                </View>
                <Pressable
                  style={st.adjustBtn}
                  onPress={() => { setAdjustScore(String(selectedPlayer.trustScore)); setShowAdjustModal(true); }}
                >
                  <MaterialIcons name="edit" size={16} color={theme.primary} />
                  <Text style={st.adjustBtnText}>{(et.adminAdjustScore as any)?.[language] || 'Adjust'}</Text>
                </Pressable>
              </View>

              {/* Stats from details */}
              {selectedPlayer.details ? (
                <View style={st.detailSection}>
                  <Text style={st.detailSectionTitle}>{(et.adminPlayerStats as any)?.[language] || 'Stats'}</Text>
                  <View style={st.detailStatsGrid}>
                    {[
                      { label: 'Matches', value: selectedPlayer.details.totalMatches || selectedPlayer.details.matchesPlayed || '-' },
                      { label: 'Multi-player %', value: `${selectedPlayer.details.multiPlayerRatio || 0}%` },
                      { label: isFr ? 'Adversaires uniques' : 'Unique opponents', value: selectedPlayer.details.uniqueOpponents || '-' },
                      { label: isFr ? 'Coherence' : 'Consistency', value: `${selectedPlayer.details.performanceConsistency || 0}%` },
                      { label: isFr ? 'Modifs externes' : 'External mods', value: selectedPlayer.details.modificationLogs?.external || 0 },
                      { label: isFr ? 'Matchs/semaine' : 'Matches/week', value: selectedPlayer.details.matchesPerWeek || '-' },
                      { label: isFr ? 'Anciennete (jours)' : 'Account age (days)', value: selectedPlayer.details.accountAgeDays || '-' },
                      { label: isFr ? 'Signalements' : 'Reports', value: selectedPlayer.details.totalReports || 0 },
                    ].map((stat, i) => (
                      <View key={i} style={st.detailStatItem}>
                        <Text style={st.detailStatValue}>{stat.value}</Text>
                        <Text style={st.detailStatLabel}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Flags */}
              <View style={st.detailSection}>
                <Text style={st.detailSectionTitle}>{(et.adminFlags as any)?.[language] || 'Flags'} ({selectedPlayer.flags.length})</Text>
                {selectedPlayer.flags.length === 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
                    <MaterialIcons name="check-circle" size={20} color={theme.success} />
                    <Text style={{ fontSize: 14, color: theme.success, fontWeight: '600' }}>{isFr ? 'Aucune alerte' : 'No flags'}</Text>
                  </View>
                ) : (
                  selectedPlayer.flags.map((flag: string, fi: number) => (
                    <View key={fi} style={st.detailFlagRow}>
                      <MaterialIcons name="warning" size={14} color="#F97316" />
                      <Text style={st.detailFlagText}>{flag.replace(/_/g, ' ')}</Text>
                    </View>
                  ))
                )}
              </View>

              {/* Admin notes */}
              <View style={st.detailSection}>
                <Text style={st.detailSectionTitle}>{(et.adminNotes as any)?.[language] || 'Admin notes'}</Text>
                <TextInput
                  style={st.notesInput}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  placeholder={isFr ? 'Notes internes...' : 'Internal notes...'}
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={4}
                />
                <Pressable style={[st.saveNotesBtn, savingNotes && { opacity: 0.6 }]} onPress={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="save" size={16} color="#FFF" />}
                  <Text style={st.saveNotesBtnText}>{(et.adminSaveNotes as any)?.[language] || 'Save'}</Text>
                </Pressable>
              </View>

              {/* Status actions */}
              <View style={st.detailSection}>
                <Text style={st.detailSectionTitle}>Actions</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['ok', 'watch', 'flagged', 'banned', 'dismissed'].map(s => (
                    <Pressable
                      key={s}
                      style={[st.statusActionBtn, { borderColor: getStatusColor(s), backgroundColor: selectedPlayer.status === s ? getStatusColor(s) : getStatusColor(s) + '10' }]}
                      onPress={() => handleUpdateStatus(selectedPlayer.id, s)}
                    >
                      <Text style={[st.statusActionText, { color: selectedPlayer.status === s ? '#FFF' : getStatusColor(s) }]}>{getStatusLabel(s)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* Adjust score modal */}
      <Modal visible={showAdjustModal} animationType="fade" transparent onRequestClose={() => setShowAdjustModal(false)}>
        <View style={st.adjustOverlay}>
          <View style={st.adjustContent}>
            <Text style={st.adjustTitle}>{(et.adminAdjustScore as any)?.[language] || 'Adjust Score'}</Text>
            <TextInput
              style={st.adjustInput}
              value={adjustScore}
              onChangeText={setAdjustScore}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="0-100"
              placeholderTextColor={theme.textMuted}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={st.adjustCancel} onPress={() => setShowAdjustModal(false)}>
                <Text style={st.adjustCancelText}>{t('common', 'cancel')}</Text>
              </Pressable>
              <Pressable style={st.adjustConfirm} onPress={handleAdjustScore}>
                <Text style={st.adjustConfirmText}>{t('common', 'save')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  headerSub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  scanBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  eloRecalcBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#7C3AED', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  eloRecalcBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.border },
  filterChipText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
  filterCount: { backgroundColor: theme.backgroundSecondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, minWidth: 20, alignItems: 'center' },
  filterCountText: { fontSize: 10, fontWeight: '700', color: theme.textSecondary },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.textPrimary, padding: 0 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 12 },

  playerCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderLeftWidth: 4, ...theme.shadows.card },
  playerHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  playerAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  playerName: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  flagCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EF444412', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  flagCountText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  scoreCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 16, fontWeight: '900' },

  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  flagChip: { backgroundColor: '#F9731612', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  flagChipText: { fontSize: 10, fontWeight: '600', color: '#F97316' },
  flagMore: { fontSize: 10, fontWeight: '600', color: theme.textMuted, alignSelf: 'center' },

  quickActions: { flexDirection: 'row', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border + '40' },
  qAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  qActionText: { fontSize: 12, fontWeight: '600' },

  // Detail modal
  detailContainer: { flex: 1, backgroundColor: theme.backgroundSecondary },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  detailClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: theme.textPrimary, textAlign: 'center' },
  detailViewBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  detailScoreCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, ...theme.shadows.card },
  detailScoreCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  detailScoreValue: { fontSize: 24, fontWeight: '900' },
  detailScoreMax: { fontSize: 10, color: theme.textMuted, fontWeight: '600' },
  detailLevel: { fontSize: 16, fontWeight: '700' },
  detailStatus: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  detailAnalyzed: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  adjustBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '12', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  adjustBtnText: { fontSize: 12, fontWeight: '600', color: theme.primary },

  detailSection: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 12, ...theme.shadows.card },
  detailSectionTitle: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  detailStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailStatItem: { width: '47%', backgroundColor: theme.backgroundSecondary, borderRadius: 10, padding: 10, alignItems: 'center' },
  detailStatValue: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
  detailStatLabel: { fontSize: 10, color: theme.textMuted, marginTop: 2, textAlign: 'center' },
  detailFlagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
  detailFlagText: { fontSize: 13, fontWeight: '500', color: theme.textPrimary, flex: 1 },
  notesInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 14, fontSize: 14, color: theme.textPrimary, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: theme.border, marginBottom: 10 },
  saveNotesBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 12 },
  saveNotesBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  statusActionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5 },
  statusActionText: { fontSize: 13, fontWeight: '700' },

  // Adjust modal
  adjustOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 40 },
  adjustContent: { backgroundColor: theme.surface, borderRadius: 20, padding: 24, alignItems: 'center' },
  adjustTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
  adjustInput: { fontSize: 32, fontWeight: '900', color: theme.primary, textAlign: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, width: 140, marginBottom: 20, borderWidth: 2, borderColor: theme.primary + '30' },
  adjustCancel: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: theme.backgroundSecondary },
  adjustCancelText: { fontSize: 15, fontWeight: '600', color: theme.textSecondary },
  adjustConfirm: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: theme.primary },
  adjustConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Summary dashboard
  summarySection: { marginHorizontal: 16, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  summaryCard: { flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 12, alignItems: 'center', ...theme.shadows.card },
  summaryValue: { fontSize: 22, fontWeight: '900', color: theme.textPrimary },
  summaryLabel: { fontSize: 10, color: theme.textMuted, marginTop: 2, textAlign: 'center', fontWeight: '600' },
  distRow: { flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 6, marginBottom: 10, ...theme.shadows.card },
  distItem: { flex: 1, alignItems: 'center', gap: 4 },
  distBarTrack: { width: '100%', height: 50, backgroundColor: theme.backgroundSecondary, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  distBarFill: { width: '100%', borderRadius: 6 },
  distPct: { fontSize: 11, fontWeight: '800' },
  distLabel: { fontSize: 8, color: theme.textMuted, fontWeight: '600', textAlign: 'center' },
  distCount: { fontSize: 10, fontWeight: '700', color: theme.textSecondary },
  batchDismissBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#22C55E12', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#22C55E30' },
  batchDismissBtnText: { fontSize: 13, fontWeight: '600', color: '#22C55E' },

  // ELO Dashboard
  eloDashSection: { marginHorizontal: 16, marginBottom: 10, backgroundColor: theme.surface, borderRadius: 16, padding: 14, ...theme.shadows.card, borderWidth: 1, borderColor: '#9333EA' + '15' },
  eloDashHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 12 },
  eloDashIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  eloDashTitle: { fontSize: 14, fontWeight: '700' as const, color: theme.textPrimary },
  eloDashStatsRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 10 },
  eloDashStat: { flex: 1, alignItems: 'center' as const, backgroundColor: theme.backgroundSecondary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4 },
  eloDashStatValue: { fontSize: 18, fontWeight: '900' as const },
  eloDashStatLabel: { fontSize: 9, color: theme.textMuted, marginTop: 2, fontWeight: '600' as const, textAlign: 'center' as const },
  eloDashDistRow: { flexDirection: 'row' as const, gap: 4 },
  eloDashDistItem: { flex: 1, alignItems: 'center' as const, gap: 3 },
  eloDashDistBarTrack: { width: '100%' as const, height: 44, backgroundColor: theme.backgroundSecondary, borderRadius: 6, overflow: 'hidden' as const, justifyContent: 'flex-end' as const },
  eloDashDistBarFill: { width: '100%' as const, borderRadius: 6 },
  eloDashDistPct: { fontSize: 10, fontWeight: '800' as const },
  eloDashDistLabel: { fontSize: 7, color: theme.textMuted, fontWeight: '600' as const, textAlign: 'center' as const },
  eloDashDistCount: { fontSize: 10, fontWeight: '700' as const },
  eloDashActionBtn: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
});
