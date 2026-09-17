import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { useAppData } from '@/contexts/AppContext';
import {
  fetchTrustScore,
  computeQuickTrustScore,
  getTrustScoreColor,
  getTrustScoreIcon,
  getTrustLevelLabel,
  getTrustBadgeDescription,
  triggerTrustScoreComputation,
  TrustScoreData,
  getLevelFromScore,
  fetchTrustScoreHistory,
  TrustScoreHistoryPoint,
  saveTrustScoreSnapshot,
  requestWitnessAttestation,
} from '@/services/trustScoreService';
import { extraTranslations } from '@/constants/i18nExtra';
import Svg, { Circle } from 'react-native-svg';

const et = extraTranslations.trustScore;

// ============================================
// Large hero gauge
// ============================================
function HeroGauge({ value, size = 180, color }: { value: number; size?: number; color: string }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.max(0, Math.min(100, value));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={'rgba(255,255,255,0.08)'} strokeWidth={strokeWidth} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={strokeWidth + 2}
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" fill="none"
          rotation="-90" origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: size * 0.28, fontWeight: '900', color: '#FFF', letterSpacing: -1 }}>{clamped}</Text>
        <Text style={{ fontSize: size * 0.08, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: -2 }}>/100</Text>
      </View>
    </View>
  );
}

// ============================================
// Small gauge ring for factor breakdown
// ============================================
function GaugeRing({ value, size = 72, color, label }: { value: number; size?: number; color: string; label: string }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.max(0, Math.min(100, value));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color + '15'} strokeWidth={strokeWidth} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth + 1}
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" fill="none" rotation="-90" origin={`${size / 2}, ${size / 2}`} />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: size * 0.22, fontWeight: '800', color }}>{clamped}%</Text>
        </View>
      </View>
      <Text style={st.gaugeLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

// ============================================
// Factor bar for detailed breakdown
// ============================================
function FactorBar({ label, value, maxValue, color, icon, description }: {
  label: string; value: number; maxValue: number; color: string; icon: string; description?: string;
}) {
  const pct = maxValue > 0 ? Math.min(100, Math.round((value / maxValue) * 100)) : 0;
  return (
    <View style={st.factorRow}>
      <View style={[st.factorIcon, { backgroundColor: color + '12' }]}>
        <MaterialIcons name={icon as any} size={18} color={color} />
      </View>
      <View style={st.factorContent}>
        <View style={st.factorHeader}>
          <Text style={st.factorLabel}>{label}</Text>
          <Text style={[st.factorValue, { color }]}>{value}/{maxValue}</Text>
        </View>
        <View style={st.factorBarTrack}>
          <View style={[st.factorBarFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        {description ? <Text style={st.factorDesc}>{description}</Text> : null}
      </View>
    </View>
  );
}

// ============================================
// Flag labels
// ============================================
const FLAG_LABELS: Record<string, { fr: string; en: string; icon: string; color: string }> = {
  very_low_multiplayer: { fr: 'Tres peu de matchs multi-joueurs', en: 'Very few multi-player matches', icon: 'people-outline', color: '#F97316' },
  low_multiplayer: { fr: 'Peu de matchs multi-joueurs', en: 'Few multi-player matches', icon: 'people-outline', color: '#D97706' },
  single_opponent: { fr: 'Un seul adversaire', en: 'Single opponent', icon: 'person', color: '#EF4444' },
  low_opponent_diversity: { fr: 'Faible diversite d\'adversaires', en: 'Low opponent diversity', icon: 'groups', color: '#F97316' },
  very_inconsistent_performance: { fr: 'Performances tres instables', en: 'Very inconsistent performance', icon: 'trending-down', color: '#EF4444' },
  inconsistent_performance: { fr: 'Performances instables', en: 'Inconsistent performance', icon: 'trending-down', color: '#F97316' },
  sudden_improvement: { fr: 'Progression soudaine', en: 'Sudden improvement', icon: 'bolt', color: '#D97706' },
  many_external_modifications: { fr: 'Nombreuses modifications externes', en: 'Many external modifications', icon: 'edit', color: '#EF4444' },
  some_external_modifications: { fr: 'Quelques modifications externes', en: 'Some external modifications', icon: 'edit', color: '#D97706' },
  excessive_daily_matches: { fr: 'Trop de matchs par jour', en: 'Excessive daily matches', icon: 'speed', color: '#EF4444' },
  high_daily_matches: { fr: 'Beaucoup de matchs par jour', en: 'Many daily matches', icon: 'speed', color: '#F97316' },
  extreme_win_rate: { fr: 'Taux de victoire extreme', en: 'Extreme win rate', icon: 'warning', color: '#EF4444' },
  unrealistic_combined_rates: { fr: 'Stats combinees irrealistes', en: 'Unrealistic combined rates', icon: 'warning', color: '#EF4444' },
  extreme_carreau_rate: { fr: 'Taux de carreau extreme', en: 'Extreme carreau rate', icon: 'stars', color: '#F97316' },
  very_new_account: { fr: 'Compte tres recent', en: 'Very new account', icon: 'new-releases', color: '#D97706' },
  new_account: { fr: 'Compte recent', en: 'New account', icon: 'new-releases', color: '#D97706' },
  low_match_count: { fr: 'Peu de matchs joues', en: 'Few matches played', icon: 'sports', color: '#D97706' },
  many_very_short_matches: { fr: 'Matchs tres courts suspects', en: 'Suspicious very short matches', icon: 'timer', color: '#F97316' },
  inactive_1month: { fr: 'Inactif depuis 1 mois', en: 'Inactive for 1 month', icon: 'hourglass-empty', color: '#D97706' },
  inactive_2months: { fr: 'Inactif depuis 2+ mois', en: 'Inactive for 2+ months', icon: 'hourglass-disabled', color: '#EF4444' },
  multi_account_device: { fr: 'Multi-compte detecte', en: 'Multi-account detected', icon: 'devices', color: '#F97316' },
  multi_account_device_3plus: { fr: 'Multi-comptes detectes (3+)', en: 'Multi-accounts detected (3+)', icon: 'devices', color: '#EF4444' },
  multiple_reports: { fr: 'Signalements multiples', en: 'Multiple reports', icon: 'flag', color: '#EF4444' },
  has_reports: { fr: 'Signalement recu', en: 'Report received', icon: 'flag', color: '#D97706' },
  arranged_matches: { fr: 'Matchs arranges detectes', en: 'Arranged matches detected', icon: 'gpp-bad', color: '#EF4444' },
  witness_abuse_frequent_pair: { fr: 'Attestations trop frequentes (meme paire)', en: 'Too frequent attestations (same pair)', icon: 'visibility', color: '#F97316' },
  witness_abuse_extreme: { fr: 'Abus d attestations temoins', en: 'Witness attestation abuse', icon: 'visibility-off', color: '#EF4444' },
  witness_abuse_mutual_ring: { fr: 'Attestations mutuelles suspectes', en: 'Suspicious mutual attestations', icon: 'swap-horiz', color: '#F97316' },
  impossible_travel: { fr: 'Trajet geographique impossible (>500km en <6h)', en: 'Impossible geographic travel (>500km in <6h)', icon: 'flight-takeoff', color: '#EF4444' },
  impossible_travel_repeated: { fr: 'Trajets impossibles repetes', en: 'Repeated impossible travels', icon: 'flight', color: '#DC2626' },
  micro_teleportation: { fr: 'Micro-teleportation (>200km en <2h)', en: 'Micro-teleportation (>200km in <2h)', icon: 'speed', color: '#F97316' },
  distant_from_home_city: { fr: 'Matchs eloignes de la ville declaree (>300km)', en: 'Matches far from declared city (>300km)', icon: 'location-off', color: '#F97316' },
  frequent_distant_from_home_city: { fr: 'Matchs frequemment eloignes de la ville declaree', en: 'Matches frequently far from declared city', icon: 'wrong-location', color: '#EF4444' },
  unrealistic_duration: { fr: 'Duree de match irrealiste', en: 'Unrealistic match duration', icon: 'timer-off', color: '#F97316' },
  unrealistic_duration_frequent: { fr: 'Durees irrealistes frequentes', en: 'Frequent unrealistic durations', icon: 'timer-off', color: '#EF4444' },
  nocturnal_pattern: { fr: 'Activite nocturne recurrente (3h-6h)', en: 'Recurring nocturnal activity (3AM-6AM)', icon: 'nightlight-round', color: '#7C3AED' },
  mass_submission: { fr: 'Soumission massive (>20/24h)', en: 'Mass submission (>20/24h)', icon: 'flash-on', color: '#DC2626' },
  mass_submission_repeated: { fr: 'Soumissions massives repetees', en: 'Repeated mass submissions', icon: 'flash-on', color: '#B91C1C' },
  self_match: { fr: 'Auto-affrontement detecte', en: 'Self-match detected', icon: 'content-copy', color: '#EC4899' },
  self_match_frequent: { fr: 'Auto-affrontements frequents', en: 'Frequent self-matches', icon: 'content-copy', color: '#DB2777' },
  symmetric_score_streak: { fr: 'Serie de scores symetriques (13-0/13-1)', en: 'Symmetric score streak (13-0/13-1)', icon: 'repeat', color: '#F43F5E' },
  symmetric_score_streak_extreme: { fr: 'Serie de scores extremes (10+ matchs)', en: 'Extreme score streak (10+ matches)', icon: 'repeat', color: '#E11D48' },
  ghost_opponents: { fr: 'Adversaires fantomes detectes', en: 'Ghost opponents detected', icon: 'person-off', color: '#A855F7' },
  ghost_opponents_dominant: { fr: 'Adversaires fantomes dominants', en: 'Dominant ghost opponents', icon: 'person-off', color: '#9333EA' },
  artificial_progression: { fr: 'Progression ELO artificielle (trop reguliere)', en: 'Artificial ELO progression (too regular)', icon: 'trending-up', color: '#DB2777' },
  suspiciously_linear_elo: { fr: 'Progression ELO suspecte (lineaire)', en: 'Suspicious linear ELO progression', icon: 'show-chart', color: '#EC4899' },
  benford_deviation: { fr: 'Distribution des scores atypique (Benford)', en: 'Atypical score distribution (Benford)', icon: 'insights', color: '#0EA5E9' },
  benford_deviation_severe: { fr: 'Distribution des scores tres atypique (Benford)', en: 'Highly atypical score distribution (Benford)', icon: 'analytics', color: '#0284C7' },
  shared_fingerprint_recent: { fr: 'Empreinte d\'appareil partagee (30 j)', en: 'Shared device fingerprint (30d)', icon: 'devices-other', color: '#F97316' },
  shared_fingerprint_recent_multi: { fr: 'Empreinte partagee par plusieurs comptes (30 j)', en: 'Fingerprint shared by multiple accounts (30d)', icon: 'devices-other', color: '#EF4444' },
  email_farm: { fr: 'Emails sequentiels detectes (email farm)', en: 'Sequential emails detected (email farm)', icon: 'alternate-email', color: '#DC2626' },
  email_farm_auto_ban: { fr: 'Compte auto-banni (email farm > 5 comptes / 6h)', en: 'Auto-banned account (email farm > 5 accts / 6h)', icon: 'block', color: '#991B1B' },
  witness_reputation_biased: { fr: 'Reputation temoin biaisee (concentration)', en: 'Biased witness reputation (concentrated)', icon: 'visibility', color: '#F59E0B' },
  witness_reputation_extreme: { fr: 'Reputation temoin extreme (temoin unique)', en: 'Extreme witness reputation (single witness)', icon: 'remove-red-eye', color: '#D97706' },
};

// ============================================
// MAIN
// ============================================
export default function TrustScoreScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { selfPlayer, matches } = useAppData();
  const isFr = language === 'fr';

  const [trustData, setTrustData] = useState<TrustScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [history, setHistory] = useState<TrustScoreHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [behavioralDigestHistory, setBehavioralDigestHistory] = useState<Array<{ id: string; flags: string[]; alertSummary: string; sentAt: string; isResolved: boolean; resolvedAt: string | null }>>([]);
  const [bdhLoading, setBdhLoading] = useState(false);
  const [bdhFilter, setBdhFilter] = useState<'active' | 'resolved' | 'all'>('all');
  // Nearby witness suggestions (shown when witness concentration >= 60%)
  const [nearbyWitnesses, setNearbyWitnesses] = useState<Array<{ id: string; userId: string; name: string; avatar?: string; city?: string; club?: string; eloRating: number }>>([]);

  // Witness invite modal (sends attestation request; user selects from top 3 recent matches)
  const [inviteModal, setInviteModal] = useState<{
    visible: boolean;
    witness: { id: string; userId: string; name: string; avatar?: string; city?: string; club?: string; eloRating: number } | null;
    message: string;
    sending: boolean;
    matches: Array<{ id: string; date: string; teamAName: string; teamBName: string; scoreA: number; scoreB: number; winner: string | null }>;
    selectedMatchId: string | null;
  }>({ visible: false, witness: null, message: '', sending: false, matches: [], selectedMatchId: null });

  const bdhFiltered = useMemo(() => {
    if (bdhFilter === 'active') return behavioralDigestHistory.filter(h => !h.isResolved);
    if (bdhFilter === 'resolved') return behavioralDigestHistory.filter(h => h.isResolved);
    return behavioralDigestHistory;
  }, [behavioralDigestHistory, bdhFilter]);

  const bdhCounts = useMemo(() => ({
    all: behavioralDigestHistory.length,
    active: behavioralDigestHistory.filter(h => !h.isResolved).length,
    resolved: behavioralDigestHistory.filter(h => h.isResolved).length,
  }), [behavioralDigestHistory]);

  const [screenW, setScreenW] = useState(() => Dimensions.get('window').width || 375);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: any) => setScreenW(window.width));
    return () => sub?.remove();
  }, []);

  const loadTrustScore = async () => {
    if (!selfPlayer) { setLoading(false); return; }
    setLoading(true);
    const dbScore = await fetchTrustScore(selfPlayer.id);
    if (dbScore) {
      setTrustData(dbScore);
    } else {
      setTrustData(computeQuickTrustScore({ stats: selfPlayer.stats, createdAt: selfPlayer.createdAt }));
    }
    setLoading(false);
  };

  useEffect(() => { loadTrustScore(); }, [selfPlayer?.id]);

  useEffect(() => {
    if (!selfPlayer?.id) return;
    setHistoryLoading(true);
    fetchTrustScoreHistory(selfPlayer.id).then(h => {
      setHistory(h);
      setHistoryLoading(false);
    });
  }, [selfPlayer?.id]);

  // Fetch 3 nearby users (by club, then city) as alternative witness suggestions
  // when the dominant-witness concentration ratio exceeds 60%.
  useEffect(() => {
    const wr = trustData?.details?.witnessReputation;
    const shouldFetch = !!(wr && wr.totalAttestations >= 3 && wr.concentrationRatio >= 60 && selfPlayer && user?.id);
    if (!shouldFetch) { setNearbyWitnesses([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const supabaseClient = getSupabaseClient();
        const city = (selfPlayer as any)?.city;
        const clubName = (selfPlayer as any)?.club;
        let rows: any[] = [];
        if (clubName) {
          const { data } = await supabaseClient
            .from('players')
            .select('id, user_id, name, avatar, city, club, elo_rating')
            .eq('is_public', true)
            .neq('user_id', user!.id)
            .eq('club', clubName)
            .limit(3);
          if (data && data.length > 0) rows = data;
        }
        if (rows.length < 3 && city) {
          const { data } = await supabaseClient
            .from('players')
            .select('id, user_id, name, avatar, city, club, elo_rating')
            .eq('is_public', true)
            .neq('user_id', user!.id)
            .eq('city', city)
            .limit(3 - rows.length);
          if (data) {
            const existingIds = new Set(rows.map(r => r.id));
            for (const p of data) if (!existingIds.has(p.id)) rows.push(p);
          }
        }
        if (cancelled) return;
        setNearbyWitnesses(rows.slice(0, 3).map((p: any) => ({
          id: p.id, userId: p.user_id, name: p.name, avatar: p.avatar || undefined,
          city: p.city || undefined, club: p.club || undefined, eloRating: p.elo_rating || 1000,
        })));
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [trustData?.details?.witnessReputation?.concentrationRatio, (selfPlayer as any)?.city, (selfPlayer as any)?.club, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    setBdhLoading(true);
    (async () => {
      try {
        const supabaseClient = getSupabaseClient();
        const { data } = await supabaseClient
          .from('behavioral_digest_history')
          .select('id, flags, alert_summary, sent_at, is_resolved, resolved_at')
          .eq('user_id', user.id)
          .order('sent_at', { ascending: false })
          .limit(10);
        setBehavioralDigestHistory((data || []).map((d: any) => ({
          id: d.id,
          flags: Array.isArray(d.flags) ? d.flags : [],
          alertSummary: d.alert_summary || '',
          sentAt: d.sent_at,
          isResolved: !!d.is_resolved,
          resolvedAt: d.resolved_at,
        })));
      } catch { /* silent */ }
      setBdhLoading(false);
    })();
  }, [user?.id, trustData?.analyzedAt]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTrustScore();
    setRefreshing(false);
  };

  const handleRecompute = async () => {
    setRecomputing(true);
    await triggerTrustScoreComputation();
    setTimeout(async () => {
      await loadTrustScore();
      if (selfPlayer && user) {
        const ts = await fetchTrustScore(selfPlayer.id);
        if (ts) {
          await saveTrustScoreSnapshot(user.id, selfPlayer.id, ts.score, ts.level, ts.flags);
          const h = await fetchTrustScoreHistory(selfPlayer.id);
          setHistory(h);
        }
      }
      setRecomputing(false);
    }, 3000);
  };

  const openInviteModal = (witness: { id: string; userId: string; name: string; avatar?: string; city?: string; club?: string; eloRating: number }) => {
    const defaultMsg = isFr
      ? `Salut ${witness.name}, peux-tu attester mon match ? Merci !`
      : `Hi ${witness.name}, can you witness my match? Thanks!`;
    // Compute up to 3 most recent matches so user can pick which one to attest
    const list = (matches || []) as any[];
    const matchesList: Array<{ id: string; date: string; teamAName: string; teamBName: string; scoreA: number; scoreB: number; winner: string | null }> = [];
    if (list.length > 0) {
      const sorted = [...list].sort((a: any, b: any) => {
        const dA = new Date(a.date || a.createdAt || 0).getTime();
        const dB = new Date(b.date || b.createdAt || 0).getTime();
        return dB - dA;
      });
      for (const m of sorted.slice(0, 3)) {
        if (!m || !m.id) continue;
        const tA = m.teamA || m.team_a || {};
        const tB = m.teamB || m.team_b || {};
        matchesList.push({
          id: m.id,
          date: m.date || m.createdAt || m.created_at || new Date().toISOString(),
          teamAName: tA.name || (isFr ? 'Equipe A' : 'Team A'),
          teamBName: tB.name || (isFr ? 'Equipe B' : 'Team B'),
          scoreA: Number(tA.score) || 0,
          scoreB: Number(tB.score) || 0,
          winner: m.winner || null,
        });
      }
    }
    setInviteModal({ visible: true, witness, message: defaultMsg, sending: false, matches: matchesList, selectedMatchId: matchesList[0]?.id || null });
  };

  const handleSendInvite = async () => {
    if (!inviteModal.witness || !inviteModal.selectedMatchId) return;
    const selected = inviteModal.matches.find(m => m.id === inviteModal.selectedMatchId);
    if (!selected) {
      setInviteModal({ visible: false, witness: null, message: '', sending: false, matches: [], selectedMatchId: null });
      showAlert(isFr ? 'Match introuvable' : 'Match not found');
      return;
    }
    const witnessId = inviteModal.witness.userId;
    const summary = inviteModal.message.trim();
    setInviteModal(prev => ({ ...prev, sending: true }));
    const { error } = await requestWitnessAttestation(selected.id, witnessId, summary);
    setInviteModal({ visible: false, witness: null, message: '', sending: false, matches: [], selectedMatchId: null });
    if (error) {
      showAlert(isFr ? `Erreur: ${error}` : `Error: ${error}`);
    } else {
      showAlert(
        isFr ? 'Invitation envoyee' : 'Invitation sent',
        isFr ? 'Votre temoin recevra une notification push.' : 'Your witness will receive a push notification.'
      );
    }
  };

  const details = trustData?.details || {};
  const multiPlayerRatio = details.multiPlayerRatio || 0;
  const uniqueOpponents = details.uniqueOpponents || 0;
  const totalMatches = details.totalMatches || details.matchesPlayed || 0;
  const performanceConsistency = details.performanceConsistency || 0;
  const modExternal = details.modificationLogs?.external || 0;
  const matchesPerWeek = details.matchesPerWeek || 0;
  const accountAgeDays = details.accountAgeDays || 0;

  const mpScore = Math.round(multiPlayerRatio * 0.3 * 100) / 100;
  const diversityScore = totalMatches > 0 ? Math.min(20, Math.round((uniqueOpponents / totalMatches) * 20)) : 0;
  const consistencyScore = Math.round((performanceConsistency / 100) * 20);
  const historyScore = Math.max(0, 15 - modExternal * 3);
  const frequencyScore = Math.min(10, Math.round(Math.min(matchesPerWeek, 5) / 5 * 10));

  // Strengths & weaknesses
  const strengths = useMemo(() => {
    if (!trustData) return [];
    const items: { label: string; icon: string; color: string }[] = [];
    if (multiPlayerRatio >= 50) items.push({ label: isFr ? 'Bon ratio multi-joueurs' : 'Good multi-player ratio', icon: 'people', color: '#3B82F6' });
    if (performanceConsistency >= 70) items.push({ label: isFr ? 'Performances regulieres' : 'Consistent performance', icon: 'show-chart', color: '#10B981' });
    if (modExternal === 0) items.push({ label: isFr ? 'Historique propre' : 'Clean history', icon: 'history', color: '#14B8A6' });
    if (accountAgeDays >= 90) items.push({ label: isFr ? 'Compte etabli' : 'Established account', icon: 'calendar-today', color: '#7C3AED' });
    if (trustData.flags.length === 0) items.push({ label: isFr ? 'Zero alertes' : 'Zero flags', icon: 'check-circle', color: '#22C55E' });
    if ((details.witnessedMatchCount || 0) >= 5) items.push({ label: isFr ? 'Matchs attestes' : 'Attested matches', icon: 'visibility', color: '#7C3AED' });
    return items.slice(0, 4);
  }, [trustData, multiPlayerRatio, performanceConsistency, modExternal, accountAgeDays, isFr]);

  const weaknesses = useMemo(() => {
    if (!trustData) return [];
    const items: { label: string; icon: string; color: string }[] = [];
    if (multiPlayerRatio < 30) items.push({ label: isFr ? 'Peu de matchs multi-joueurs' : 'Few multi-player matches', icon: 'people-outline', color: '#F97316' });
    if (performanceConsistency < 50) items.push({ label: isFr ? 'Performances instables' : 'Inconsistent performance', icon: 'trending-down', color: '#EF4444' });
    if (modExternal > 3) items.push({ label: isFr ? 'Modifications externes' : 'External modifications', icon: 'edit', color: '#F97316' });
    if (matchesPerWeek < 1) items.push({ label: isFr ? 'Faible frequence de jeu' : 'Low play frequency', icon: 'schedule', color: '#D97706' });
    if (accountAgeDays < 30) items.push({ label: isFr ? 'Compte recent' : 'New account', icon: 'new-releases', color: '#D97706' });
    return items.slice(0, 3);
  }, [trustData, multiPlayerRatio, performanceConsistency, modExternal, matchesPerWeek, accountAgeDays, isFr]);

  if (loading) {
    return (
      <SafeAreaView style={st.container}>
        <View style={st.header}>
          <Pressable style={st.backBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={st.headerTitle}>{(et.pageTitle as any)?.[language] || 'Trust Score'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const scoreColor = trustData ? getTrustScoreColor(trustData.level) : theme.textMuted;
  const scoreIcon = trustData ? getTrustScoreIcon(trustData.level) : 'shield';
  const gaugeSize = Math.min(200, Math.max(150, screenW * 0.45));

  return (
    <SafeAreaView edges={['top']} style={st.container}>
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>{(et.pageTitle as any)?.[language] || 'Trust Score'}</Text>
        <Pressable style={st.backBtn} onPress={() => setShowHowItWorks(true)}>
          <MaterialIcons name="help-outline" size={22} color={theme.textSecondary} />
        </Pressable>
      </View>

      <Modal
        visible={showHowItWorks}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHowItWorks(false)}
      >
        <Pressable style={st.howModalOverlay} onPress={() => setShowHowItWorks(false)}>
          <Pressable style={st.howItWorksCard} onPress={(e) => e.stopPropagation?.()}>
            <View style={st.howHeader}>
              <MaterialIcons name="info" size={20} color="#3B82F6" />
              <Text style={st.howTitle}>{isFr ? 'Comment ca marche ?' : 'How does it work?'}</Text>
              <Pressable onPress={() => setShowHowItWorks(false)} hitSlop={8}>
                <MaterialIcons name="close" size={20} color={theme.textMuted} />
              </Pressable>
            </View>
            <Text style={st.howText}>
              {isFr
                ? 'Le Trust Score (0-100) mesure la fiabilite de vos statistiques. Il determine votre visibilite dans le classement et le poids de vos resultats.'
                : 'The Trust Score (0-100) measures the reliability of your statistics. It determines your ranking visibility and result weight.'}
            </Text>
            <View style={st.howPillars}>
              {[
                { icon: 'people', color: '#3B82F6', label: isFr ? 'Matchs multi-joueurs' : 'Multi-player matches', pts: '30' },
                { icon: 'groups', color: '#8B5CF6', label: isFr ? 'Diversite adversaires' : 'Opponent diversity', pts: '20' },
                { icon: 'show-chart', color: '#10B981', label: isFr ? 'Coherence' : 'Consistency', pts: '20' },
                { icon: 'history', color: '#F97316', label: isFr ? 'Historique' : 'History', pts: '15' },
                { icon: 'schedule', color: '#06B6D4', label: isFr ? 'Frequence' : 'Frequency', pts: '10' },
                { icon: 'calendar-today', color: '#14B8A6', label: isFr ? 'Anciennete' : 'Account age', pts: '5' },
              ].map((p, i) => (
                <View key={i} style={st.howPillarItem}>
                  <View style={[st.howPillarIcon, { backgroundColor: p.color + '15' }]}>
                    <MaterialIcons name={p.icon as any} size={14} color={p.color} />
                  </View>
                  <Text style={st.howPillarLabel}>{p.label}</Text>
                  <Text style={[st.howPillarPts, { color: p.color }]}>{p.pts}pts</Text>
                </View>
              ))}
            </View>
            <View style={st.howBonusRow}>
              <MaterialIcons name="visibility" size={14} color="#7C3AED" />
              <Text style={st.howBonusText}>{isFr ? 'Bonus : attestations temoins (jusqu\'a +8 pts)' : 'Bonus: witness attestations (up to +8 pts)'}</Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        style={st.scrollView}
        contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
      >
        {!trustData ? (
          <Animated.View entering={FadeInDown.duration(400)} style={st.noScoreCard}>
            <View style={st.noScoreIconWrap}>
              <MaterialIcons name="shield" size={48} color={theme.textMuted} />
            </View>
            <Text style={st.noScoreTitle}>{isFr ? 'Pas encore de score' : 'No score yet'}</Text>
            <Text style={st.noScoreText}>{(et.noScoreYet as any)?.[language] || 'No score computed yet.'}</Text>
            <Pressable style={st.recomputeBtn} onPress={handleRecompute} disabled={recomputing}>
              {recomputing ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="refresh" size={18} color="#FFF" />}
              <Text style={st.recomputeBtnText}>{isFr ? 'Calculer mon score' : 'Compute my score'}</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {/* Hero Section with large gauge */}
            <Animated.View entering={FadeInDown.duration(400)}>
              <LinearGradient
                colors={[scoreColor + '20', scoreColor + '08', theme.surface]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={st.heroGradient}
              >
                <View style={st.heroContent}>
                  <HeroGauge value={trustData.score} size={gaugeSize} color={scoreColor} />
                  <View style={[st.heroLevelBadge, { backgroundColor: scoreColor + '20', borderColor: scoreColor + '40' }]}>
                    <MaterialIcons name={scoreIcon as any} size={16} color={scoreColor} />
                    <Text style={[st.heroLevelText, { color: scoreColor }]}>{getTrustLevelLabel(trustData.level, isFr)}</Text>
                  </View>
                  <Text style={st.heroDesc}>{getTrustBadgeDescription(trustData.level, isFr)}</Text>
                </View>

                {/* Level bar */}
                <View style={st.levelBar}>
                  <View style={st.levelBarTrack}>
                    <View style={[st.levelBarFill, { width: `${trustData.score}%`, backgroundColor: scoreColor }]} />
                    <View style={[st.levelBarMarker, { left: '25%' }]} />
                    <View style={[st.levelBarMarker, { left: '45%' }]} />
                    <View style={[st.levelBarMarker, { left: '65%' }]} />
                    <View style={[st.levelBarMarker, { left: '80%' }]} />
                  </View>
                  <View style={st.levelLabels}>
                    <Text style={st.levelLabelText}>{isFr ? 'Suspect' : 'Suspicious'}</Text>
                    <Text style={st.levelLabelText}>{isFr ? 'Surveiller' : 'Watch'}</Text>
                    <Text style={st.levelLabelText}>Standard</Text>
                    <Text style={st.levelLabelText}>{isFr ? 'Fiable' : 'Trusted'}</Text>
                    <Text style={st.levelLabelText}>{isFr ? 'Verifie' : 'Verified'}</Text>
                  </View>
                </View>

                {trustData.analyzedAt ? (
                  <Text style={st.analyzedAt}>
                    {(et.lastAnalyzed as any)?.[language] || 'Last analyzed'}: {new Date(trustData.analyzedAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                ) : null}

                <Pressable style={[st.recomputeBtn, { alignSelf: 'center', marginTop: 12 }]} onPress={handleRecompute} disabled={recomputing}>
                  {recomputing ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="refresh" size={16} color="#FFF" />}
                  <Text style={st.recomputeBtnText}>{isFr ? 'Recalculer' : 'Recompute'}</Text>
                </Pressable>
              </LinearGradient>
            </Animated.View>

            {/* Strengths & Weaknesses */}
            {(strengths.length > 0 || weaknesses.length > 0) ? (
              <Animated.View entering={FadeInDown.duration(400).delay(50)} style={st.swCard}>
                <View style={st.swRow}>
                  {strengths.length > 0 ? (
                    <View style={st.swCol}>
                      <View style={st.swColHeader}>
                        <MaterialIcons name="thumb-up" size={14} color="#22C55E" />
                        <Text style={[st.swColTitle, { color: '#22C55E' }]}>{isFr ? 'Forces' : 'Strengths'}</Text>
                      </View>
                      {strengths.map((s, i) => (
                        <View key={i} style={st.swItem}>
                          <MaterialIcons name={s.icon as any} size={13} color={s.color} />
                          <Text style={st.swItemText}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {weaknesses.length > 0 ? (
                    <View style={[st.swCol, strengths.length > 0 && st.swColRight]}>
                      <View style={st.swColHeader}>
                        <MaterialIcons name="trending-up" size={14} color="#F97316" />
                        <Text style={[st.swColTitle, { color: '#F97316' }]}>{isFr ? 'A ameliorer' : 'Improve'}</Text>
                      </View>
                      {weaknesses.map((w, i) => (
                        <View key={i} style={st.swItem}>
                          <MaterialIcons name={w.icon as any} size={13} color={w.color} />
                          <Text style={st.swItemText}>{w.label}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}

            {/* Factor Gauges */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: '#3B82F6' + '15' }]}>
                  <MaterialIcons name="pie-chart" size={18} color="#3B82F6" />
                </View>
                <Text style={st.sectionTitle}>{(et.breakdownTitle as any)?.[language] || 'Score Breakdown'}</Text>
              </View>
              <View style={st.gaugesGrid}>
                <GaugeRing value={multiPlayerRatio} size={72} color="#3B82F6" label={(et.factorMultiPlayer as any)?.[language] || 'Multi-player'} />
                <GaugeRing value={totalMatches > 0 ? Math.min(100, Math.round((uniqueOpponents / totalMatches) * 100)) : 0} size={72} color="#8B5CF6" label={(et.factorDiversity as any)?.[language] || 'Diversity'} />
                <GaugeRing value={performanceConsistency} size={72} color="#10B981" label={(et.factorConsistency as any)?.[language] || 'Consistency'} />
                <GaugeRing value={Math.max(0, 100 - modExternal * 10)} size={72} color="#F97316" label={(et.factorHistory as any)?.[language] || 'History'} />
              </View>
            </Animated.View>

            {/* Detailed Factors */}
            <Animated.View entering={FadeInDown.duration(400).delay(150)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: '#D97706' + '15' }]}>
                  <MaterialIcons name="analytics" size={18} color="#D97706" />
                </View>
                <Text style={st.sectionTitle}>{(et.detailsTitle as any)?.[language] || 'Factor Details'}</Text>
              </View>

              <FactorBar label={(et.factorMultiPlayer as any)?.[language] || 'Multi-player matches'} value={Math.round(mpScore * 100)} maxValue={30} color="#3B82F6" icon="people"
                description={((et.multiPlayerDesc as any)?.[language] || 'Proportion of matches with other app users ({value}%).').replace('{value}', String(multiPlayerRatio))} />
              <FactorBar label={(et.factorDiversity as any)?.[language] || 'Opponent diversity'} value={diversityScore} maxValue={20} color="#8B5CF6" icon="groups"
                description={((et.diversityDesc as any)?.[language] || '{value} unique opponents across {total} matches.').replace('{value}', String(uniqueOpponents)).replace('{total}', String(totalMatches))} />
              <FactorBar label={(et.factorConsistency as any)?.[language] || 'Performance consistency'} value={consistencyScore} maxValue={20} color="#10B981" icon="show-chart"
                description={((et.consistencyDesc as any)?.[language] || 'Stability of your performance over 4 weeks ({value}%).').replace('{value}', String(performanceConsistency))} />
              <FactorBar label={(et.factorHistory as any)?.[language] || 'Modification history'} value={historyScore} maxValue={15} color="#F97316" icon="history"
                description={((et.historyDesc as any)?.[language] || '{value} external modifications on your records.').replace('{value}', String(modExternal))} />
              <FactorBar label={(et.factorPlayFrequency as any)?.[language] || 'Play frequency'} value={frequencyScore} maxValue={10} color="#06B6D4" icon="schedule"
                description={((et.frequencyDesc as any)?.[language] || '{value} matches per week on average.').replace('{value}', String(matchesPerWeek))} />
              <FactorBar label={(et.factorAccountAge as any)?.[language] || 'Account age'} value={Math.min(5, Math.round(accountAgeDays / 36))} maxValue={5} color="#14B8A6" icon="calendar-today"
                description={((et.ageDesc as any)?.[language] || 'Account created {value} days ago.').replace('{value}', String(accountAgeDays))} />
              <FactorBar label={isFr ? 'Attestations temoins' : 'Witness attestations'} value={Math.min(8, (details.witnessedMatchCount || 0))} maxValue={8} color="#7C3AED" icon="visibility"
                description={isFr ? `${details.witnessedMatchCount || 0} matchs/defis attestes. Bonus progressif jusqu'a 8 pts.` : `${details.witnessedMatchCount || 0} matches/challenges attested. Progressive bonus up to 8 pts.`} />
            </Animated.View>

            {/* Flags */}
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: trustData.flags.length > 0 ? theme.error + '15' : theme.success + '15' }]}>
                  <MaterialIcons name={trustData.flags.length > 0 ? 'flag' : 'check-circle'} size={18} color={trustData.flags.length > 0 ? theme.error : theme.success} />
                </View>
                <Text style={st.sectionTitle}>{(et.flagsTitle as any)?.[language] || 'Detected Flags'}</Text>
                {trustData.flags.length > 0 ? (
                  <View style={[st.flagCountBadge, { backgroundColor: theme.error + '15' }]}>
                    <Text style={[st.flagCountText, { color: theme.error }]}>{trustData.flags.length}</Text>
                  </View>
                ) : null}
              </View>
              {trustData.flags.length === 0 ? (
                <View style={st.noFlagsRow}>
                  <MaterialIcons name="check-circle" size={24} color={theme.success} />
                  <Text style={st.noFlagsText}>{(et.noFlags as any)?.[language] || 'No flags detected. Excellent!'}</Text>
                </View>
              ) : (
                trustData.flags.map((flag, idx) => {
                  const flagInfo = FLAG_LABELS[flag] || { fr: flag, en: flag, icon: 'warning', color: '#D97706' };
                  return (
                    <View key={idx} style={[st.flagRow, { borderLeftColor: flagInfo.color }]}>
                      <View style={[st.flagIcon, { backgroundColor: flagInfo.color + '12' }]}>
                        <MaterialIcons name={flagInfo.icon as any} size={16} color={flagInfo.color} />
                      </View>
                      <Text style={st.flagText}>{isFr ? flagInfo.fr : flagInfo.en}</Text>
                    </View>
                  );
                })
              )}
            </Animated.View>

            {/* Geographic Alerts (personal view) */}
            {(
              ((trustData.details?.impossibleTravel?.count || 0) > 0) ||
              ((trustData.details?.microTeleportation?.count || 0) > 0) ||
              ((trustData.details?.homeCityConsistency?.distantMatchesCount || 0) >= 3)
            ) ? (
              <Animated.View entering={FadeInDown.duration(400).delay(220)} style={st.sectionCard}>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionIconBg, { backgroundColor: '#EF4444' + '15' }]}>
                    <MaterialIcons name="explore-off" size={18} color="#EF4444" />
                  </View>
                  <Text style={st.sectionTitle}>{isFr ? 'Alertes geographiques' : 'Geographic Alerts'}</Text>
                </View>
                <Text style={geoSt.intro}>
                  {isFr
                    ? 'Ces alertes indiquent des incoherences geographiques dans vos matchs. Verifiez les terrains selectionnes ou mettez a jour votre ville.'
                    : 'These alerts indicate geographic inconsistencies in your matches. Check selected terrains or update your city.'}
                </Text>

                {/* Impossible Travel */}
                {(trustData.details?.impossibleTravel?.count || 0) > 0 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="flight-takeoff" size={14} color="#EF4444" />
                      <Text style={[geoSt.groupTitle, { color: '#EF4444' }]}>
                        {isFr ? 'Trajets impossibles' : 'Impossible travel'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#EF444415' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#EF4444' }]}>
                          {trustData.details.impossibleTravel.count}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? '> 500 km parcourus en < 6h entre 2 matchs. Un terrain a peut-etre ete mal selectionne.'
                        : '> 500 km covered in < 6h between 2 matches. A terrain may have been mis-selected.'}
                    </Text>
                    {Array.isArray(trustData.details.impossibleTravel.pairs)
                      ? trustData.details.impossibleTravel.pairs.slice(0, 3).map((p: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#EF4444' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {(p.terrainA || 'A') + '  ->  ' + (p.terrainB || 'B')}
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {p.distanceKm} km · {p.hoursBetween} h · {p.requiredSpeedKmh} km/h
                          </Text>
                        </View>
                      ))
                      : null}
                  </View>
                ) : null}

                {/* Micro-Teleportation */}
                {(trustData.details?.microTeleportation?.count || 0) > 0 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="speed" size={14} color="#F97316" />
                      <Text style={[geoSt.groupTitle, { color: '#F97316' }]}>
                        {isFr ? 'Micro-teleportations' : 'Micro-teleportations'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#F9731615' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#F97316' }]}>
                          {trustData.details.microTeleportation.count}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? '> 200 km en < 2h entre 2 matchs. Verifiez que les terrains selectionnes sont corrects.'
                        : '> 200 km in < 2h between 2 matches. Check that the selected terrains are correct.'}
                    </Text>
                    {Array.isArray(trustData.details.microTeleportation.pairs)
                      ? trustData.details.microTeleportation.pairs.slice(0, 3).map((p: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#F97316' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {(p.terrainA || 'A') + '  ->  ' + (p.terrainB || 'B')}
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {p.distanceKm} km · {p.hoursBetween} h · {p.requiredSpeedKmh} km/h
                          </Text>
                        </View>
                      ))
                      : null}
                  </View>
                ) : null}

                {/* Distant from Home City */}
                {(trustData.details?.homeCityConsistency?.distantMatchesCount || 0) >= 3 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="location-off" size={14} color="#D97706" />
                      <Text style={[geoSt.groupTitle, { color: '#D97706' }]}>
                        {isFr ? 'Matchs eloignes de votre ville' : 'Matches far from your city'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#D9770615' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#D97706' }]}>
                          {trustData.details.homeCityConsistency.distantMatchesCount}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? `${trustData.details.homeCityConsistency.distantMatchesCount} match(s) a plus de 300 km de ${trustData.details.homeCityConsistency.homeCity || 'votre ville'} (${trustData.details.homeCityConsistency.distantRatio || 0}%). Si vous avez demenage, mettez a jour votre profil.`
                        : `${trustData.details.homeCityConsistency.distantMatchesCount} match(es) more than 300 km from ${trustData.details.homeCityConsistency.homeCity || 'your city'} (${trustData.details.homeCityConsistency.distantRatio || 0}%). If you have moved, update your profile.`}
                    </Text>
                    {Array.isArray(trustData.details.homeCityConsistency.examples)
                      ? trustData.details.homeCityConsistency.examples.slice(0, 3).map((ex: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#D97706' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {ex.terrainName || (isFr ? 'Terrain inconnu' : 'Unknown terrain')}
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {ex.distanceKm} km · {ex.date ? new Date(ex.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </Text>
                        </View>
                      ))
                      : null}
                    <Pressable style={[geoSt.cta, { backgroundColor: '#D97706' }]} onPress={() => router.push('/profile')}>
                      <MaterialIcons name="edit-location" size={14} color="#FFF" />
                      <Text style={geoSt.ctaText}>{isFr ? 'Mettre a jour ma ville' : 'Update my city'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* Temporal Alerts (personal view) */}
            {(
              ((trustData.details?.unrealisticDuration?.count || 0) > 0) ||
              ((trustData.details?.nocturnalActivity?.count || 0) > 0) ||
              ((trustData.details?.massSubmission?.daysCount || 0) > 0)
            ) ? (
              <Animated.View entering={FadeInDown.duration(400).delay(240)} style={st.sectionCard}>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionIconBg, { backgroundColor: '#8B5CF6' + '15' }]}>
                    <MaterialIcons name="schedule" size={18} color="#8B5CF6" />
                  </View>
                  <Text style={st.sectionTitle}>{isFr ? 'Alertes temporelles' : 'Temporal Alerts'}</Text>
                </View>
                <Text style={geoSt.intro}>
                  {isFr
                    ? 'Ces alertes reperent des durees de matchs improbables, des sessions nocturnes recurrentes ou des soumissions massives.'
                    : 'These alerts flag unlikely match durations, recurring nocturnal sessions, or mass submissions.'}
                </Text>

                {/* Unrealistic Duration */}
                {(trustData.details?.unrealisticDuration?.count || 0) > 0 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="timer-off" size={14} color="#F97316" />
                      <Text style={[geoSt.groupTitle, { color: '#F97316' }]}>
                        {isFr ? 'Durees irrealistes' : 'Unrealistic durations'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#F9731615' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#F97316' }]}>
                          {trustData.details.unrealisticDuration.count}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? 'Matchs enregistres avec une duree < 5 min ou > 4 h. Verifiez que le chrono a bien ete mis a jour.'
                        : 'Matches recorded with duration < 5 min or > 4 h. Verify the timer was updated correctly.'}
                    </Text>
                    {Array.isArray(trustData.details.unrealisticDuration.examples)
                      ? trustData.details.unrealisticDuration.examples.slice(0, 3).map((ex: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#F97316' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {ex.durationMin} min - {ex.tooShort ? (isFr ? 'Trop court' : 'Too short') : (isFr ? 'Trop long' : 'Too long')}
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {ex.date ? new Date(ex.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </Text>
                        </View>
                      ))
                      : null}
                  </View>
                ) : null}

                {/* Nocturnal Pattern */}
                {(trustData.details?.nocturnalActivity?.count || 0) > 0 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="nightlight-round" size={14} color="#7C3AED" />
                      <Text style={[geoSt.groupTitle, { color: '#7C3AED' }]}>
                        {isFr ? 'Activite nocturne' : 'Nocturnal activity'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#7C3AED15' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#7C3AED' }]}>
                          {trustData.details.nocturnalActivity.count}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? 'Matchs enregistres entre 3 h et 6 h heure locale du terrain. Peut refleter une erreur d\'horaire ou de fuseau.'
                        : 'Matches recorded between 3 AM and 6 AM local terrain time. May reflect a timing or timezone error.'}
                    </Text>
                    {trustData.details.nocturnalActivity.timezoneAware ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, backgroundColor: '#7C3AED10', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}>
                        <MaterialIcons name="public" size={12} color="#7C3AED" />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#7C3AED', flex: 1 }}>
                          {isFr ? 'Detection basee sur le fuseau horaire du terrain' : 'Detection based on terrain timezone'}
                        </Text>
                      </View>
                    ) : null}
                    {Array.isArray(trustData.details.nocturnalActivity.examples)
                      ? trustData.details.nocturnalActivity.examples.slice(0, 3).map((ex: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#7C3AED' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {isFr ? 'Heure locale' : 'Local hour'}: {String(ex.hour ?? 0).padStart(2, '0')}:00
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {ex.date ? new Date(ex.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                            {ex.hasTerrainTz ? ` - UTC${ex.tzOffsetHours >= 0 ? '+' : ''}${ex.tzOffsetHours}` : ' - UTC'}
                          </Text>
                        </View>
                      ))
                      : null}
                  </View>
                ) : null}

                {/* Mass Submission */}
                {(trustData.details?.massSubmission?.daysCount || 0) > 0 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="flash-on" size={14} color="#DC2626" />
                      <Text style={[geoSt.groupTitle, { color: '#DC2626' }]}>
                        {isFr ? 'Soumission massive' : 'Mass submission'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#DC262615' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#DC2626' }]}>
                          {trustData.details.massSubmission.daysCount}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? `${trustData.details.massSubmission.daysCount} jour(s) avec plus de 20 matchs. Max ${trustData.details.massSubmission.maxDailyCount || 0} matchs/24 h.`
                        : `${trustData.details.massSubmission.daysCount} day(s) with more than 20 matches. Peak ${trustData.details.massSubmission.maxDailyCount || 0} matches/24 h.`}
                    </Text>
                    {Array.isArray(trustData.details.massSubmission.examples)
                      ? trustData.details.massSubmission.examples.slice(0, 3).map((ex: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#DC2626' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {ex.day ? new Date(ex.day).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {ex.count} {isFr ? 'matchs enregistres' : 'matches recorded'}
                          </Text>
                        </View>
                      ))
                      : null}
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* Behavioral Alerts (personal view) */}
            {(
              ((trustData.details?.selfMatches?.count || 0) > 0) ||
              ((trustData.details?.symmetricScores?.maxConsecutiveStreak || 0) > 5) ||
              ((trustData.details?.ghostOpponents?.ghostCount || 0) > 0)
            ) ? (
              <Animated.View entering={FadeInDown.duration(400).delay(245)} style={st.sectionCard}>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionIconBg, { backgroundColor: '#EC4899' + '15' }]}>
                    <MaterialIcons name="psychology" size={18} color="#EC4899" />
                  </View>
                  <Text style={st.sectionTitle}>{isFr ? 'Alertes comportementales' : 'Behavioral Alerts'}</Text>
                </View>
                <Text style={geoSt.intro}>
                  {isFr
                    ? 'Ces alertes reperent des patterns suspects dans vos matchs (auto-affrontements, scores extremes repetes, adversaires isoles).'
                    : 'These alerts detect suspicious patterns in your matches (self-matches, repeated extreme scores, isolated opponents).'}
                </Text>

                {/* Self-Match */}
                {(trustData.details?.selfMatches?.count || 0) > 0 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="content-copy" size={14} color="#EC4899" />
                      <Text style={[geoSt.groupTitle, { color: '#EC4899' }]}>
                        {isFr ? 'Auto-affrontements' : 'Self-matches'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#EC489915' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#EC4899' }]}>
                          {trustData.details.selfMatches.count}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? 'Le meme joueur (ou son proprietaire) apparait des deux cotes du match. Verifiez la composition de vos equipes.'
                        : 'The same player (or their owner) appears on both sides of the match. Verify your team compositions.'}
                    </Text>
                    {Array.isArray(trustData.details.selfMatches.examples)
                      ? trustData.details.selfMatches.examples.slice(0, 3).map((ex: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#EC4899' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {ex.directOverlap ? (isFr ? 'Meme joueur des deux cotes' : 'Same player on both sides') : (isFr ? 'Meme proprietaire' : 'Same owner')}
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {ex.date ? new Date(ex.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </Text>
                        </View>
                      ))
                      : null}
                  </View>
                ) : null}

                {/* Symmetric Score Streak */}
                {(trustData.details?.symmetricScores?.maxConsecutiveStreak || 0) > 5 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="repeat" size={14} color="#F43F5E" />
                      <Text style={[geoSt.groupTitle, { color: '#F43F5E' }]}>
                        {isFr ? 'Serie de scores extremes' : 'Extreme score streak'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#F43F5E15' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#F43F5E' }]}>
                          {trustData.details.symmetricScores.maxConsecutiveStreak}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? `${trustData.details.symmetricScores.maxConsecutiveStreak} matchs consecutifs avec des scores 13-0 ou 13-1. Ce type de serie est rare dans un jeu equilibre.`
                        : `${trustData.details.symmetricScores.maxConsecutiveStreak} consecutive matches with 13-0 or 13-1 scores. This type of streak is rare in balanced play.`}
                    </Text>
                    {Array.isArray(trustData.details.symmetricScores.examples)
                      ? trustData.details.symmetricScores.examples.slice(0, 3).map((ex: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#F43F5E' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {isFr ? 'Score' : 'Score'}: {ex.score}
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {ex.date ? new Date(ex.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                          </Text>
                        </View>
                      ))
                      : null}
                  </View>
                ) : null}

                {/* Ghost Opponents */}
                {(trustData.details?.ghostOpponents?.ghostCount || 0) > 0 ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="person-off" size={14} color="#A855F7" />
                      <Text style={[geoSt.groupTitle, { color: '#A855F7' }]}>
                        {isFr ? 'Adversaires fantomes' : 'Ghost opponents'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#A855F715' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#A855F7' }]}>
                          {trustData.details.ghostOpponents.ghostCount}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? `${trustData.details.ghostOpponents.ghostCount}/${trustData.details.ghostOpponents.totalOpponents || 0} adversaires (${trustData.details.ghostOpponents.ratio || 0}%) n'apparaissent que dans vos matchs. Invitez-les a rejoindre l'app pour renforcer la validation.`
                        : `${trustData.details.ghostOpponents.ghostCount}/${trustData.details.ghostOpponents.totalOpponents || 0} opponents (${trustData.details.ghostOpponents.ratio || 0}%) only appear in your matches. Invite them to join the app to strengthen validation.`}
                    </Text>
                    {Array.isArray(trustData.details.ghostOpponents.examples)
                      ? trustData.details.ghostOpponents.examples.slice(0, 3).map((ex: any, i: number) => (
                        <View key={i} style={[geoSt.item, { borderLeftColor: '#A855F7' }]}>
                          <Text style={geoSt.itemTitle} numberOfLines={1}>
                            {ex.opponentName || (isFr ? 'Inconnu' : 'Unknown')}
                          </Text>
                          <Text style={geoSt.itemMeta}>
                            {ex.sameOwner ? (isFr ? 'Cree par vous' : 'Created by you') : (isFr ? 'Aucun autre match enregistre' : 'No other matches recorded')}
                          </Text>
                        </View>
                      ))
                      : null}
                    <Pressable style={[geoSt.cta, { backgroundColor: '#A855F7' }]} onPress={() => router.push('/share-hub')}>
                      <MaterialIcons name="share" size={14} color="#FFF" />
                      <Text style={geoSt.ctaText}>{isFr ? 'Inviter mes adversaires' : 'Invite my opponents'}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* Behavioral Digest History */}
            {bdhLoading ? null : behavioralDigestHistory.length > 0 ? (
              <Animated.View entering={FadeInDown.duration(400).delay(248)} style={st.sectionCard}>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionIconBg, { backgroundColor: '#F43F5E' + '15' }]}>
                    <MaterialIcons name="history" size={18} color="#F43F5E" />
                  </View>
                  <Text style={st.sectionTitle}>{isFr ? 'Historique des rappels comportementaux' : 'Behavioral Alert History'}</Text>
                  <View style={[st.flagCountBadge, { backgroundColor: '#F43F5E15' }]}>
                    <Text style={[st.flagCountText, { color: '#F43F5E' }]}>{behavioralDigestHistory.length}</Text>
                  </View>
                </View>
                <Text style={geoSt.intro}>
                  {isFr
                    ? 'Vos 10 derniers rappels comportementaux. Un rappel resolu indique que le pattern detecte a disparu depuis.'
                    : 'Your last 10 behavioral alerts. A resolved alert means the detected pattern has since disappeared.'}
                </Text>
                <View style={bdhSt.filterRow}>
                  {(['all', 'active', 'resolved'] as const).map(f => {
                    const isActive = bdhFilter === f;
                    const chipColor = f === 'active' ? '#F43F5E' : f === 'resolved' ? '#22C55E' : theme.primary;
                    const label = f === 'all' ? (isFr ? 'Tous' : 'All') : f === 'active' ? (isFr ? 'Actif' : 'Active') : (isFr ? 'Resolu' : 'Resolved');
                    const count = bdhCounts[f];
                    const icon = f === 'active' ? 'radio-button-checked' : f === 'resolved' ? 'check-circle' : 'list';
                    return (
                      <Pressable
                        key={f}
                        style={[bdhSt.filterChip, { borderColor: isActive ? chipColor : chipColor + '40' }, isActive && { backgroundColor: chipColor }]}
                        onPress={() => setBdhFilter(f)}
                      >
                        <MaterialIcons name={icon as any} size={11} color={isActive ? '#FFF' : chipColor} />
                        <Text style={[bdhSt.filterChipText, { color: isActive ? '#FFF' : chipColor }]}>{label}</Text>
                        <View style={[bdhSt.filterCount, { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : chipColor + '15' }]}>
                          <Text style={[bdhSt.filterCountText, { color: isActive ? '#FFF' : chipColor }]}>{count}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {bdhFiltered.length === 0 ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="filter-list" size={26} color={theme.textMuted} />
                    <Text style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>
                      {isFr ? 'Aucun rappel pour ce filtre' : 'No alerts for this filter'}
                    </Text>
                  </View>
                ) : null}
                {bdhFiltered.map((h) => {
                  const dateStr = new Date(h.sentAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const resolvedColor = h.isResolved ? '#22C55E' : '#F43F5E';
                  return (
                    <View key={h.id} style={[bdhSt.row, { borderLeftColor: resolvedColor }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <MaterialIcons name="schedule" size={11} color={theme.textMuted} />
                          <Text style={bdhSt.date}>{dateStr}</Text>
                        </View>
                        <View style={bdhSt.flagsRow}>
                          {h.flags.slice(0, 3).map((f, i) => {
                            const info = FLAG_LABELS[f] || FLAG_LABELS[`${f}_frequent`] || { fr: f, en: f, icon: 'warning', color: '#F97316' };
                            return (
                              <View key={i} style={[bdhSt.flagChip, { backgroundColor: info.color + '15' }]}>
                                <MaterialIcons name={info.icon as any} size={10} color={info.color} />
                                <Text style={[bdhSt.flagChipText, { color: info.color }]} numberOfLines={1}>{isFr ? info.fr : info.en}</Text>
                              </View>
                            );
                          })}
                          {h.flags.length > 3 ? (
                            <Text style={bdhSt.moreText}>+{h.flags.length - 3}</Text>
                          ) : null}
                        </View>
                        {h.isResolved && h.resolvedAt ? (
                          <Text style={bdhSt.resolvedMeta}>
                            {isFr ? 'Resolu le' : 'Resolved on'} {new Date(h.resolvedAt).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[bdhSt.statusBadge, { backgroundColor: resolvedColor + '15', borderColor: resolvedColor + '30' }]}>
                        <MaterialIcons name={h.isResolved ? 'check-circle' : 'radio-button-checked'} size={11} color={resolvedColor} />
                        <Text style={[bdhSt.statusText, { color: resolvedColor }]}>
                          {h.isResolved ? (isFr ? 'Resolu' : 'Resolved') : (isFr ? 'Actif' : 'Active')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
            ) : null}

            {/* Statistical Anomalies (ELO variance + Benford) */}
            {(
              trustData.flags.some((f: string) => f === 'artificial_progression' || f === 'suspiciously_linear_elo' || f === 'benford_deviation' || f === 'benford_deviation_severe')
            ) ? (
              <Animated.View entering={FadeInDown.duration(400).delay(246)} style={st.sectionCard}>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionIconBg, { backgroundColor: '#0EA5E9' + '15' }]}>
                    <MaterialIcons name="analytics" size={18} color="#0EA5E9" />
                  </View>
                  <Text style={st.sectionTitle}>{isFr ? 'Anomalies statistiques' : 'Statistical Anomalies'}</Text>
                </View>
                <Text style={geoSt.intro}>
                  {isFr
                    ? 'Ces analyses statistiques comparent votre progression et vos scores a des distributions attendues dans un jeu equilibre.'
                    : 'These statistical analyses compare your progression and scores against distributions expected in fair play.'}
                </Text>

                {/* ELO variance */}
                {trustData.details?.eloVariance && (trustData.flags.includes('artificial_progression') || trustData.flags.includes('suspiciously_linear_elo')) ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="trending-up" size={14} color="#DB2777" />
                      <Text style={[geoSt.groupTitle, { color: '#DB2777' }]}>
                        {isFr ? 'Progression ELO trop reguliere' : 'ELO progression too regular'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#DB277715' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#DB2777' }]}>
                          R² {trustData.details.eloVariance.linearityR2}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? `${trustData.details.eloVariance.matchesAnalyzed} matchs analyses. Coefficient de variation ${trustData.details.eloVariance.coefficientOfVariation} (trop bas), linearite ${Math.round(trustData.details.eloVariance.linearityR2 * 100)}% (trop haute), ${trustData.details.eloVariance.positiveDeltaRatio}% de gains.`
                        : `${trustData.details.eloVariance.matchesAnalyzed} matches analyzed. Coefficient of variation ${trustData.details.eloVariance.coefficientOfVariation} (too low), linearity ${Math.round(trustData.details.eloVariance.linearityR2 * 100)}% (too high), ${trustData.details.eloVariance.positiveDeltaRatio}% wins.`}
                    </Text>
                    <View style={[geoSt.item, { borderLeftColor: '#DB2777' }]}>
                      <Text style={geoSt.itemTitle}>{isFr ? 'Delta moyen' : 'Mean delta'}</Text>
                      <Text style={geoSt.itemMeta}>{trustData.details.eloVariance.meanAbsDelta} pts · {isFr ? 'pente' : 'slope'} {trustData.details.eloVariance.slope}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Benford */}
                {trustData.details?.benfordAnalysis && (trustData.flags.includes('benford_deviation') || trustData.flags.includes('benford_deviation_severe')) ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="insights" size={14} color="#0EA5E9" />
                      <Text style={[geoSt.groupTitle, { color: '#0EA5E9' }]}>
                        {isFr ? 'Loi de Benford : ecart significatif' : 'Benford Law: significant deviation'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#0EA5E915' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#0EA5E9' }]}>
                          χ² {trustData.details.benfordAnalysis.chiSquare}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? `Distribution des chiffres de tete calculee sur ${trustData.details.benfordAnalysis.sampleSize} valeurs. Chi-carre ${trustData.details.benfordAnalysis.chiSquare} > seuil 95% (${trustData.details.benfordAnalysis.threshold95}).`
                        : `Leading-digit distribution computed on ${trustData.details.benfordAnalysis.sampleSize} values. Chi-square ${trustData.details.benfordAnalysis.chiSquare} > 95% threshold (${trustData.details.benfordAnalysis.threshold95}).`}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
                      {(trustData.details.benfordAnalysis.digitDistribution || []).map((pct: number, i: number) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                          <View style={{ width: '100%', height: 32, backgroundColor: '#0EA5E915', borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' }}>
                            <View style={{ height: Math.max(2, Math.min(32, pct * 0.8)), backgroundColor: '#0EA5E9' }} />
                          </View>
                          <Text style={{ fontSize: 8, color: theme.textMuted, marginTop: 2, fontWeight: '700' }}>{i + 1}</Text>
                          <Text style={{ fontSize: 7, color: '#0EA5E9', fontWeight: '600' }}>{pct}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* Identity/Network Alerts (shared fingerprint + email farm) */}
            {(
              trustData.flags.some((f: string) => f === 'shared_fingerprint_recent' || f === 'shared_fingerprint_recent_multi' || f === 'email_farm')
            ) ? (
              <Animated.View entering={FadeInDown.duration(400).delay(247)} style={st.sectionCard}>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionIconBg, { backgroundColor: '#EF4444' + '15' }]}>
                    <MaterialIcons name="security" size={18} color="#EF4444" />
                  </View>
                  <Text style={st.sectionTitle}>{isFr ? 'Alertes identite / reseau' : 'Identity / Network Alerts'}</Text>
                </View>
                <Text style={geoSt.intro}>
                  {isFr
                    ? 'Ces alertes identifient des comportements typiques de multi-comptes ou de creation en masse.'
                    : 'These alerts identify patterns typical of multi-accounting or bulk account creation.'}
                </Text>

                {trustData.details?.sharedFingerprintRecent && (trustData.flags.includes('shared_fingerprint_recent') || trustData.flags.includes('shared_fingerprint_recent_multi')) ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="devices-other" size={14} color="#F97316" />
                      <Text style={[geoSt.groupTitle, { color: '#F97316' }]}>
                        {isFr ? 'Empreinte d\'appareil partagee (30 j)' : 'Shared device fingerprint (30d)'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#F9731615' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#F97316' }]}>
                          {trustData.details.sharedFingerprintRecent.sharedAccountsCount}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? `${trustData.details.sharedFingerprintRecent.sharedAccountsCount} compte(s) actif(s) sur le meme appareil dans les 30 derniers jours. Assurez-vous de ne pas partager votre appareil avec des comptes suspects.`
                        : `${trustData.details.sharedFingerprintRecent.sharedAccountsCount} account(s) active on the same device in the last 30 days. Make sure your device is not shared with suspicious accounts.`}
                    </Text>
                  </View>
                ) : null}

                {trustData.details?.emailFarm && trustData.flags.includes('email_farm') ? (
                  <View style={geoSt.group}>
                    <View style={geoSt.groupHeader}>
                      <MaterialIcons name="alternate-email" size={14} color="#DC2626" />
                      <Text style={[geoSt.groupTitle, { color: '#DC2626' }]}>
                        {isFr ? 'Emails sequentiels detectes' : 'Sequential emails detected'}
                      </Text>
                      <View style={[geoSt.groupBadge, { backgroundColor: '#DC262615' }]}>
                        <Text style={[geoSt.groupBadgeText, { color: '#DC2626' }]}>
                          {trustData.details.emailFarm.clusterSize}
                        </Text>
                      </View>
                    </View>
                    <Text style={geoSt.groupDesc}>
                      {isFr
                        ? `${trustData.details.emailFarm.clusterSize} emails sequentiels (prefixe "${trustData.details.emailFarm.prefix}") sur le domaine ${trustData.details.emailFarm.domain} crees en ${trustData.details.emailFarm.spanHours} h.`
                        : `${trustData.details.emailFarm.clusterSize} sequential emails (prefix "${trustData.details.emailFarm.prefix}") on domain ${trustData.details.emailFarm.domain} created within ${trustData.details.emailFarm.spanHours} h.`}
                    </Text>
                    {Array.isArray(trustData.details.emailFarm.siblings) && trustData.details.emailFarm.siblings.length > 0 ? (
                      <View style={[geoSt.item, { borderLeftColor: '#DC2626' }]}>
                        <Text style={geoSt.itemTitle}>{isFr ? 'Comptes associes' : 'Associated accounts'}</Text>
                        <Text style={geoSt.itemMeta}>{trustData.details.emailFarm.siblings.slice(0, 5).join(', ')}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* Witness Reputation Alert */}
            {(
              trustData.details?.witnessReputation && trustData.details.witnessReputation.totalAttestations >= 3 &&
              (trustData.flags.includes('witness_reputation_biased') || trustData.flags.includes('witness_reputation_extreme') || trustData.details.witnessReputation.concentrationRatio >= 50)
            ) ? (
              <Animated.View entering={FadeInDown.duration(400).delay(249)} style={st.sectionCard}>
                <View style={st.sectionHeader}>
                  <View style={[st.sectionIconBg, { backgroundColor: '#F59E0B' + '15' }]}>
                    <MaterialIcons name="visibility" size={18} color="#F59E0B" />
                  </View>
                  <Text style={st.sectionTitle}>{isFr ? 'Reputation de vos temoins' : 'Witness Reputation'}</Text>
                </View>
                <Text style={geoSt.intro}>
                  {isFr
                    ? 'Les matchs avec un fort impact ELO doivent etre attestes par des temoins varies. Une concentration excessive sur un seul temoin reduit la credibilite des attestations.'
                    : 'High-ELO-impact matches should be attested by diverse witnesses. Excessive concentration on a single witness reduces attestation credibility.'}
                </Text>
                <View style={geoSt.group}>
                  <View style={geoSt.groupHeader}>
                    <MaterialIcons name="pie-chart" size={14} color="#F59E0B" />
                    <Text style={[geoSt.groupTitle, { color: '#F59E0B' }]}>
                      {isFr ? 'Concentration temoin' : 'Witness concentration'}
                    </Text>
                    <View style={[geoSt.groupBadge, { backgroundColor: '#F59E0B15' }]}>
                      <Text style={[geoSt.groupBadgeText, { color: '#F59E0B' }]}>
                        {trustData.details.witnessReputation.concentrationRatio}%
                      </Text>
                    </View>
                  </View>
                  <Text style={geoSt.groupDesc}>
                    {isFr
                      ? `${trustData.details.witnessReputation.totalAttestations} attestations verifiees dont ${trustData.details.witnessReputation.dominantWitnessCount} par le meme temoin (${trustData.details.witnessReputation.concentrationRatio}%). ${trustData.details.witnessReputation.uniqueWitnesses} temoin(s) unique(s).`
                      : `${trustData.details.witnessReputation.totalAttestations} verified attestations, ${trustData.details.witnessReputation.dominantWitnessCount} by the same witness (${trustData.details.witnessReputation.concentrationRatio}%). ${trustData.details.witnessReputation.uniqueWitnesses} unique witness(es).`}
                  </Text>
                  <View style={[geoSt.item, { borderLeftColor: '#F59E0B' }]}>
                    <Text style={geoSt.itemTitle}>{isFr ? 'Diversite' : 'Diversity'}</Text>
                    <Text style={geoSt.itemMeta}>
                      {trustData.details.witnessReputation.diversityScore}% - {isFr ? 'invitez plus de temoins differents pour renforcer votre score' : 'invite more diverse witnesses to strengthen your score'}
                    </Text>
                  </View>
                  <Pressable style={[geoSt.cta, { backgroundColor: '#F59E0B' }]} onPress={() => router.push('/notifications-hub')}>
                    <MaterialIcons name="person-add" size={14} color="#FFF" />
                    <Text style={geoSt.ctaText}>{isFr ? 'Voir mes attestations' : 'View my attestations'}</Text>
                  </Pressable>
                  {trustData.details.witnessReputation.concentrationRatio >= 60 && nearbyWitnesses.length > 0 ? (
                    <View style={{ marginTop: 12, backgroundColor: '#F59E0B10', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F59E0B30' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <MaterialIcons name="lightbulb" size={14} color="#F59E0B" />
                        <Text style={{ flex: 1, fontSize: 12, fontWeight: '800', color: '#F59E0B' }}>
                          {isFr ? `${nearbyWitnesses.length} temoin(s) alternatif(s) proche(s)` : `${nearbyWitnesses.length} nearby alternative witness(es)`}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 10, lineHeight: 15 }}>
                        {isFr ? 'Diversifiez vos temoins pour renforcer la credibilite de vos attestations.' : 'Diversify your witnesses to strengthen your attestation credibility.'}
                      </Text>
                      {nearbyWitnesses.map(w => (
                        <Pressable
                          key={w.id}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 10, padding: 10, marginBottom: 6 }}
                          onPress={() => openInviteModal(w)}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#F59E0B' }}>{(w.name || '?').charAt(0).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }} numberOfLines={1}>{w.name}</Text>
                            <Text style={{ fontSize: 10, color: theme.textMuted, fontWeight: '500', marginTop: 1 }} numberOfLines={1}>
                              {w.club || w.city || (isFr ? 'A proximite' : 'Nearby')} - ELO {w.eloRating}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F59E0B15', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 }}>
                            <MaterialIcons name="person-add" size={12} color="#F59E0B" />
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#F59E0B' }}>{isFr ? 'Inviter' : 'Invite'}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}

            {/* History Chart */}
            <Animated.View entering={FadeInDown.duration(400).delay(250)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: '#7C3AED' + '15' }]}>
                  <MaterialIcons name="timeline" size={18} color="#7C3AED" />
                </View>
                <Text style={st.sectionTitle}>{isFr ? 'Evolution' : 'Evolution'}</Text>
              </View>
              {historyLoading ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.primary} />
                </View>
              ) : history.length < 2 ? (
                <View style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="show-chart" size={32} color={theme.textMuted} />
                  <Text style={{ fontSize: 13, color: theme.textMuted, textAlign: 'center', lineHeight: 19 }}>
                    {isFr ? 'Le graphique apparaitra apres 2 semaines de donnees.' : 'The chart will appear after 2 weeks of data.'}
                  </Text>
                </View>
              ) : (
                <View>
                  <View style={histSt.chartContainer}>
                    <View style={histSt.yAxis}>
                      <Text style={histSt.yLabel}>100</Text>
                      <Text style={histSt.yLabel}>75</Text>
                      <Text style={histSt.yLabel}>50</Text>
                      <Text style={histSt.yLabel}>25</Text>
                      <Text style={histSt.yLabel}>0</Text>
                    </View>
                    <View style={histSt.chartArea}>
                      {[0, 25, 50, 75].map(v => (
                        <View key={v} style={[histSt.gridLine, { bottom: `${v}%` }]} />
                      ))}
                      <View style={histSt.dataPointsRow}>
                        {history.map((point, idx) => {
                          const pColor = getTrustScoreColor(point.score);
                          return (
                            <View key={idx} style={[histSt.dataCol, { height: '100%' }]}>
                              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                                <View style={{ height: `${point.score}%`, alignItems: 'center', justifyContent: 'flex-start' }}>
                                  <View style={[histSt.dataPoint, { backgroundColor: pColor, borderColor: pColor + '40' }]} />
                                  <Text style={[histSt.dataPointLabel, { color: pColor }]}>{point.score}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                  <View style={histSt.xAxis}>
                    {history.map((point, idx) => {
                      const d = new Date(point.weekStart);
                      const label = `${d.getDate()}/${d.getMonth() + 1}`;
                      if (history.length > 8 && idx % 2 !== 0) return <View key={idx} style={histSt.xLabelSlot} />;
                      return (
                        <View key={idx} style={histSt.xLabelSlot}>
                          <Text style={histSt.xLabel}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Inactivity Warning */}
            {trustData && trustData.details?.daysSinceLastPlay >= 14 ? (
              <Animated.View entering={FadeInDown.duration(400).delay(300)} style={st.inactivityCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={st.inactivityIcon}>
                    <MaterialIcons name="hourglass-empty" size={22} color="#F97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.inactivityTitle}>{isFr ? 'Inactivite detectee' : 'Inactivity detected'}</Text>
                    <Text style={st.inactivityText}>
                      {isFr
                        ? `Vous n'avez pas joue depuis ${trustData.details.daysSinceLastPlay} jours. -5 pts/mois (plancher : 30).`
                        : `You have not played for ${trustData.details.daysSinceLastPlay} days. -5 pts/month (floor: 30).`}
                    </Text>
                    {trustData.details.inactivityDecay ? (
                      <View style={st.inactivityDecayBadge}>
                        <Text style={st.inactivityDecayText}>-{trustData.details.inactivityDecay.decayApplied} pts</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Animated.View>
            ) : null}

            {/* Actionable Tips */}
            <Animated.View entering={FadeInDown.duration(400).delay(350)} style={st.sectionCard}>
              <View style={st.sectionHeader}>
                <View style={[st.sectionIconBg, { backgroundColor: theme.success + '15' }]}>
                  <MaterialIcons name="lightbulb" size={18} color={theme.success} />
                </View>
                <Text style={st.sectionTitle}>{(et.tipsTitle as any)?.[language] || 'Tips to Improve'}</Text>
              </View>
              {(() => {
                const tips: { icon: string; color: string; text: string; route?: string; actionLabel?: string; priority: number }[] = [];
                if (Math.round(mpScore * 100) < 20) tips.push({ icon: 'people', color: '#3B82F6', text: isFr ? `Seulement ${multiPlayerRatio}% de matchs multi-joueurs. Partagez vos matchs avec d'autres joueurs.` : `Only ${multiPlayerRatio}% multi-player matches. Share your matches.`, route: '/share-hub', actionLabel: isFr ? 'Partager' : 'Share', priority: 1 });
                if (diversityScore < 14) tips.push({ icon: 'groups', color: '#8B5CF6', text: isFr ? `${uniqueOpponents} adversaires uniques. Jouez contre de nouveaux joueurs.` : `${uniqueOpponents} unique opponents. Play against new players.`, route: '/(tabs)/directory', actionLabel: isFr ? 'Annuaire' : 'Directory', priority: 2 });
                if (consistencyScore < 14) tips.push({ icon: 'show-chart', color: '#10B981', text: isFr ? `Consistance a ${performanceConsistency}%. Jouez regulierement.` : `Consistency at ${performanceConsistency}%. Play regularly.`, route: '/match/new', actionLabel: isFr ? 'Jouer' : 'Play', priority: 3 });
                if (frequencyScore < 7) tips.push({ icon: 'schedule', color: '#06B6D4', text: isFr ? `${matchesPerWeek} matchs/semaine. Augmentez votre frequence.` : `${matchesPerWeek} matches/week. Increase your frequency.`, route: '/match/new', actionLabel: isFr ? 'Match' : 'Match', priority: 4 });
                if ((details.witnessedMatchCount || 0) < 8) tips.push({ icon: 'visibility', color: '#7C3AED', text: isFr ? `${details.witnessedMatchCount || 0}/8 matchs attestes. Invitez des temoins.` : `${details.witnessedMatchCount || 0}/8 attested. Invite witnesses.`, route: '/notifications-hub', actionLabel: isFr ? 'Attestations' : 'Attestations', priority: 5 });
                if (historyScore < 12 && modExternal > 0) tips.push({ icon: 'edit-off', color: '#F97316', text: isFr ? `${modExternal} modification(s) externe(s). Evitez de modifier apres coup.` : `${modExternal} external mod(s). Avoid editing after the fact.`, priority: 6 });
                tips.sort((a, b) => a.priority - b.priority);
                const displayTips = tips.slice(0, 4);
                if (displayTips.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8 }}>
                      <MaterialIcons name="emoji-events" size={36} color={theme.success} />
                      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.success }}>{isFr ? 'Score excellent !' : 'Excellent score!'}</Text>
                    </View>
                  );
                }
                return displayTips.map((tip, idx) => (
                  <View key={idx} style={st.tipRow}>
                    <View style={[st.tipIcon, { backgroundColor: tip.color + '12' }]}>
                      <MaterialIcons name={tip.icon as any} size={16} color={tip.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.tipText}>{tip.text}</Text>
                      {tip.route ? (
                        <Pressable style={[st.tipActionBtn, { backgroundColor: tip.color + '10', borderColor: tip.color + '25' }]} onPress={() => router.push(tip.route as any)}>
                          <MaterialIcons name="arrow-forward" size={14} color={tip.color} />
                          <Text style={[st.tipActionText, { color: tip.color }]}>{tip.actionLabel}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ));
              })()}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Witness invite modal - sends attestation request for the user's most recent match */}
      <Modal
        visible={inviteModal.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setInviteModal({ visible: false, witness: null, message: '', sending: false, matches: [], selectedMatchId: null })}
      >
        <View style={inviteSt.overlay}>
          <View style={inviteSt.card}>
            <View style={inviteSt.header}>
              <View style={inviteSt.icon}>
                <MaterialIcons name="person-add" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={inviteSt.title}>{isFr ? 'Inviter comme temoin' : 'Invite as witness'}</Text>
                <Text style={inviteSt.sub}>{isFr ? 'Attestation de votre dernier match' : 'Witness your last match'}</Text>
              </View>
              <Pressable
                onPress={() => setInviteModal({ visible: false, witness: null, message: '', sending: false, matches: [], selectedMatchId: null })}
                hitSlop={10}
              >
                <MaterialIcons name="close" size={22} color={theme.textMuted} />
              </Pressable>
            </View>
            {inviteModal.witness ? (
              <View style={inviteSt.witnessRow}>
                <View style={inviteSt.witnessAvatar}>
                  <Text style={inviteSt.witnessInitial}>{(inviteModal.witness.name || '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={inviteSt.witnessName}>{inviteModal.witness.name}</Text>
                  <Text style={inviteSt.witnessMeta}>
                    {inviteModal.witness.club || inviteModal.witness.city || (isFr ? 'A proximite' : 'Nearby')}
                    {'  ELO '}{inviteModal.witness.eloRating}
                  </Text>
                </View>
              </View>
            ) : null}
            {inviteModal.matches.length > 0 ? (
              <View style={inviteSt.matchSelector}>
                <View style={inviteSt.matchSelectorHeader}>
                  <MaterialIcons name="sports" size={12} color={theme.primary} />
                  <Text style={inviteSt.matchSelectorLabel}>
                    {isFr ? `Choisir un match (${inviteModal.matches.length})` : `Choose a match (${inviteModal.matches.length})`}
                  </Text>
                </View>
                {inviteModal.matches.map(m => {
                  const isSelected = inviteModal.selectedMatchId === m.id;
                  const hasWinner = m.winner === 'A' || m.winner === 'B';
                  return (
                    <Pressable
                      key={m.id}
                      style={[inviteSt.matchOption, isSelected && inviteSt.matchOptionSelected]}
                      onPress={() => { setInviteModal(prev => ({ ...prev, selectedMatchId: m.id })); }}
                    >
                      <View style={[inviteSt.matchRadio, isSelected && inviteSt.matchRadioSelected]}>
                        {isSelected ? <View style={inviteSt.matchRadioDot} /> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={inviteSt.matchOptionScoreRow}>
                          <Text style={[inviteSt.matchOptionTeamName, m.winner === 'A' && { color: '#16A34A', fontWeight: '800' }]} numberOfLines={1}>
                            {m.teamAName}
                          </Text>
                          <View style={inviteSt.matchOptionScorePill}>
                            <Text style={[inviteSt.matchOptionScoreText, m.winner === 'A' && { color: '#16A34A' }]}>{m.scoreA}</Text>
                            <Text style={inviteSt.matchOptionScoreSep}>-</Text>
                            <Text style={[inviteSt.matchOptionScoreText, m.winner === 'B' && { color: '#16A34A' }]}>{m.scoreB}</Text>
                          </View>
                          <Text style={[inviteSt.matchOptionTeamName, m.winner === 'B' && { color: '#16A34A', fontWeight: '800' }]} numberOfLines={1}>
                            {m.teamBName}
                          </Text>
                        </View>
                        <View style={inviteSt.matchOptionMetaRow}>
                          <MaterialIcons name="event" size={9} color={theme.textMuted} />
                          <Text style={inviteSt.matchOptionDate}>
                            {new Date(m.date).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                          {hasWinner ? (
                            <View style={inviteSt.matchOptionWinBadge}>
                              <MaterialIcons name="emoji-events" size={8} color="#FFF" />
                              <Text style={inviteSt.matchOptionWinText}>
                                {isFr ? `Equipe ${m.winner}` : `Team ${m.winner}`}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={inviteSt.previewEmpty}>
                <MaterialIcons name="warning-amber" size={13} color="#D97706" />
                <Text style={inviteSt.previewEmptyText}>
                  {isFr ? 'Aucun match recent - enregistrez un match d\'abord pour pouvoir inviter un temoin.' : 'No recent match - record a match first before inviting a witness.'}
                </Text>
              </View>
            )}
            <Text style={inviteSt.messageLabel}>{isFr ? 'Message personnalise' : 'Personalized message'}</Text>
            <TextInput
              style={inviteSt.messageInput}
              value={inviteModal.message}
              onChangeText={txt => setInviteModal(prev => ({ ...prev, message: txt }))}
              multiline
              numberOfLines={3}
              maxLength={280}
              placeholder={isFr ? 'Ecrivez un message court...' : 'Write a short message...'}
              placeholderTextColor={theme.textMuted}
            />
            <Text style={inviteSt.messageCount}>{inviteModal.message.length}/280</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, backgroundColor: '#F59E0B10', borderRadius: 8, padding: 8 }}>
              <MaterialIcons name="info-outline" size={13} color="#F59E0B" />
              <Text style={{ flex: 1, fontSize: 10, color: '#B45309', lineHeight: 14 }}>
                {isFr
                  ? 'Une notification push sera envoyee au temoin pour attester ce match.'
                  : 'A push notification will be sent to the witness to attest this match.'}
              </Text>
            </View>
            <View style={inviteSt.actions}>
              <Pressable
                style={inviteSt.cancelBtn}
                onPress={() => setInviteModal({ visible: false, witness: null, message: '', sending: false, matches: [], selectedMatchId: null })}
                disabled={inviteModal.sending}
              >
                <Text style={inviteSt.cancelText}>{isFr ? 'Annuler' : 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[inviteSt.sendBtn, (inviteModal.sending || inviteModal.message.trim().length === 0 || !inviteModal.selectedMatchId) && { opacity: 0.6 }]}
                onPress={handleSendInvite}
                disabled={inviteModal.sending || inviteModal.message.trim().length === 0 || !inviteModal.selectedMatchId}
              >
                {inviteModal.sending ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="send" size={14} color="#FFF" />}
                <Text style={inviteSt.sendText}>{isFr ? 'Envoyer' : 'Send'}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: theme.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, flexGrow: 1 },

  // How it works modal
  howModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  howItWorksCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#3B82F620',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    ...theme.shadows.cardElevated,
  },
  howHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  howTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  howText: { fontSize: 13, color: theme.textSecondary, lineHeight: 19, marginBottom: 14 },
  howPillars: { gap: 6 },
  howPillarItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  howPillarIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  howPillarLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.textPrimary },
  howPillarPts: { fontSize: 12, fontWeight: '800' },
  howBonusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#7C3AED08', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  howBonusText: { fontSize: 11, fontWeight: '600', color: '#7C3AED', flex: 1 },

  // No score
  noScoreCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, ...theme.shadows.card },
  noScoreIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
  noScoreTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  noScoreText: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Hero
  heroGradient: { borderRadius: 24, padding: 24, marginBottom: 16, ...theme.shadows.card },
  heroContent: { alignItems: 'center', marginBottom: 16 },
  heroLevelBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginTop: 12, marginBottom: 8 },
  heroLevelText: { fontSize: 14, fontWeight: '700' },
  heroDesc: { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 },
  levelBar: { marginTop: 8 },
  levelBarTrack: { height: 10, backgroundColor: theme.backgroundSecondary, borderRadius: 5, overflow: 'hidden', position: 'relative' },
  levelBarFill: { height: '100%', borderRadius: 5 },
  levelBarMarker: { position: 'absolute', top: 0, width: 2, height: '100%', backgroundColor: theme.surface },
  levelLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  levelLabelText: { fontSize: 8, color: theme.textMuted, fontWeight: '600' },
  analyzedAt: { fontSize: 11, color: theme.textMuted, textAlign: 'center', marginTop: 8 },
  recomputeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  recomputeBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Strengths & Weaknesses
  swCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 16, marginBottom: 16, ...theme.shadows.card },
  swRow: { flexDirection: 'row' },
  swCol: { flex: 1, gap: 6 },
  swColRight: { borderLeftWidth: 1, borderLeftColor: theme.border, paddingLeft: 14, marginLeft: 14 },
  swColHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  swColTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  swItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swItemText: { fontSize: 12, fontWeight: '500', color: theme.textSecondary, flex: 1 },

  // Section
  sectionCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 16, marginBottom: 16, ...theme.shadows.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  sectionIconBg: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, flex: 1 },

  // Gauges
  gaugesGrid: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 },
  gaugeLabel: { fontSize: 10, fontWeight: '600', color: theme.textSecondary, marginTop: 6, textAlign: 'center', maxWidth: 80 },

  // Factor rows
  factorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
  factorIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  factorContent: { flex: 1 },
  factorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  factorLabel: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  factorValue: { fontSize: 14, fontWeight: '800' },
  factorBarTrack: { height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  factorBarFill: { height: '100%', borderRadius: 3 },
  factorDesc: { fontSize: 11, color: theme.textMuted, lineHeight: 16 },

  // Flags
  flagCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  flagCountText: { fontSize: 12, fontWeight: '700' },
  noFlagsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  noFlagsText: { fontSize: 14, color: theme.success, fontWeight: '600' },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderLeftWidth: 3, paddingLeft: 10, marginBottom: 6, backgroundColor: theme.backgroundSecondary + '50', borderRadius: 8 },
  flagIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  flagText: { flex: 1, fontSize: 13, fontWeight: '500', color: theme.textPrimary },

  // Inactivity
  inactivityCard: { backgroundColor: theme.surface, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F9731630', ...theme.shadows.card },
  inactivityIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F97316' + '15', alignItems: 'center', justifyContent: 'center' },
  inactivityTitle: { fontSize: 15, fontWeight: '700', color: '#F97316', marginBottom: 4 },
  inactivityText: { fontSize: 13, color: theme.textSecondary, lineHeight: 19 },
  inactivityDecayBadge: { backgroundColor: '#F97316' + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 8 },
  inactivityDecayText: { fontSize: 12, fontWeight: '700', color: '#F97316' },

  // Tips
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border + '30' },
  tipIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipText: { fontSize: 13, color: theme.textPrimary, fontWeight: '500', lineHeight: 18 },
  tipActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, alignSelf: 'flex-start', borderWidth: 1 },
  tipActionText: { fontSize: 12, fontWeight: '700' },
});

const geoSt = StyleSheet.create({
  intro: { fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginBottom: 12 },
  group: { backgroundColor: theme.backgroundSecondary + '80', borderRadius: 12, padding: 12, marginBottom: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  groupTitle: { flex: 1, fontSize: 13, fontWeight: '700' },
  groupBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  groupBadgeText: { fontSize: 11, fontWeight: '800' },
  groupDesc: { fontSize: 11, color: theme.textSecondary, lineHeight: 16, marginBottom: 8 },
  item: { backgroundColor: theme.surface, borderRadius: 8, padding: 8, marginBottom: 6, borderLeftWidth: 3 },
  itemTitle: { fontSize: 12, fontWeight: '700', color: theme.textPrimary },
  itemMeta: { fontSize: 10, color: theme.textMuted, marginTop: 2, fontWeight: '500' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  ctaText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
});

const bdhSt = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: theme.surface, borderWidth: 1.5 },
  filterChipText: { fontSize: 11, fontWeight: '700' },
  filterCount: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, minWidth: 18, alignItems: 'center' },
  filterCountText: { fontSize: 9, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary + '80', borderRadius: 10, padding: 10, marginBottom: 8, borderLeftWidth: 3 },
  date: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },
  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  flagChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, maxWidth: 180 },
  flagChipText: { fontSize: 10, fontWeight: '700' },
  moreText: { fontSize: 10, fontWeight: '700', color: theme.textMuted, alignSelf: 'center', paddingHorizontal: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '800' },
  resolvedMeta: { fontSize: 9, color: '#22C55E', marginTop: 4, fontWeight: '600' },
});

const histSt = StyleSheet.create({
  chartContainer: { flexDirection: 'row', height: 160, marginBottom: 4 },
  yAxis: { width: 28, justifyContent: 'space-between', paddingVertical: 4 },
  yLabel: { fontSize: 8, color: theme.textMuted, fontWeight: '600', textAlign: 'right' },
  chartArea: { flex: 1, position: 'relative', marginLeft: 6, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: theme.border },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: theme.border + '40' },
  dataPointsRow: { flexDirection: 'row', flex: 1, alignItems: 'stretch' },
  dataCol: { flex: 1, alignItems: 'center' },
  dataPoint: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, marginTop: -5 },
  dataPointLabel: { fontSize: 8, fontWeight: '700', marginTop: 2 },
  xAxis: { flexDirection: 'row', marginLeft: 34, marginTop: 4 },
  xLabelSlot: { flex: 1, alignItems: 'center' },
  xLabel: { fontSize: 8, color: theme.textMuted, fontWeight: '600' },
});

const inviteSt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  card: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F59E0B15', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  sub: { fontSize: 11, color: theme.textMuted, marginTop: 1 },
  witnessRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 10, marginBottom: 12 },
  witnessAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center' },
  witnessInitial: { fontSize: 14, fontWeight: '800', color: '#F59E0B' },
  witnessName: { fontSize: 13, fontWeight: '700', color: theme.textPrimary },
  witnessMeta: { fontSize: 10, color: theme.textMuted, marginTop: 1, fontWeight: '500' },
  // Match preview (confirms which match will be attested)
  preview: { backgroundColor: theme.primary + '08', borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.primary + '25' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  previewLabel: { flex: 1, fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 0.4, textTransform: 'uppercase' },
  previewIdBadge: { backgroundColor: theme.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  previewIdText: { fontSize: 8, fontWeight: '800', color: theme.primary, letterSpacing: 0.4 },
  previewScoreRow: { flexDirection: 'row', alignItems: 'stretch', gap: 6, marginBottom: 8 },
  previewTeam: { flex: 1, alignItems: 'center', backgroundColor: theme.surface, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6, gap: 2, position: 'relative', borderWidth: 1, borderColor: theme.border },
  previewTeamWin: { backgroundColor: '#16A34A10', borderColor: '#16A34A40' },
  previewTeamName: { fontSize: 10, fontWeight: '700', color: theme.textSecondary, textAlign: 'center' },
  previewScoreNumber: { fontSize: 22, fontWeight: '900', color: theme.textPrimary },
  previewWinBadge: { position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  previewVs: { fontSize: 11, fontWeight: '800', color: theme.textMuted, alignSelf: 'center' },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  previewMetaText: { fontSize: 10, fontWeight: '600', color: theme.textMuted },
  previewEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  previewEmptyText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#92400E', lineHeight: 15 },
  // Match selector (choose from top 3 recent matches)
  matchSelector: { backgroundColor: theme.primary + '08', borderRadius: 12, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.primary + '25' },
  matchSelectorHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  matchSelectorLabel: { flex: 1, fontSize: 10, fontWeight: '800', color: theme.primary, letterSpacing: 0.4, textTransform: 'uppercase' },
  matchOption: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1.5, borderColor: theme.border },
  matchOptionSelected: { borderColor: theme.primary, backgroundColor: theme.primary + '10' },
  matchRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  matchRadioSelected: { borderColor: theme.primary },
  matchRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary },
  matchOptionScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  matchOptionTeamName: { flex: 1, fontSize: 11, fontWeight: '700', color: theme.textSecondary },
  matchOptionScorePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  matchOptionScoreText: { fontSize: 14, fontWeight: '900', color: theme.textPrimary },
  matchOptionScoreSep: { fontSize: 10, fontWeight: '700', color: theme.textMuted },
  matchOptionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchOptionDate: { fontSize: 9, fontWeight: '600', color: theme.textMuted },
  matchOptionWinBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#16A34A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, marginLeft: 4 },
  matchOptionWinText: { fontSize: 8, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
  messageLabel: { fontSize: 11, fontWeight: '700', color: theme.textSecondary, marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase' },
  messageInput: { backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: 12, fontSize: 13, color: theme.textPrimary, minHeight: 72, textAlignVertical: 'top', borderWidth: 1, borderColor: theme.border },
  messageCount: { fontSize: 10, color: theme.textMuted, fontWeight: '600', textAlign: 'right', marginTop: 4, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: theme.backgroundSecondary },
  cancelText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  sendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F59E0B' },
  sendText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
});
