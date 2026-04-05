
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Rect, Line, Circle as SvgCircle, Polyline, Text as SvgText, G } from 'react-native-svg';
import theme from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { useAppData, useAppActions } from '@/contexts/AppContext';
import { fetchClubAnalytics, ClubAnalytics } from '@/services/clubAnalyticsService';
import { getEloRank } from '@/services/eloService';
import { Platform } from 'react-native';

function MiniBarChart({ data, width, height, color }: { data: Array<{ label: string; value: number }>; width: number; height: number; color: string }) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(1, (width - 40) / data.length - 4);
  const chartH = height - 24;

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.value / maxVal) * chartH);
        const x = 20 + i * (barW + 4);
        return (
          <G key={i}>
            <Rect x={x} y={chartH - barH} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
            <SvgText x={x + barW / 2} y={height - 2} fontSize="8" fill={theme.textMuted} textAnchor="middle" fontWeight="600">{d.label}</SvgText>
            {d.value > 0 ? <SvgText x={x + barW / 2} y={chartH - barH - 4} fontSize="8" fill={theme.textSecondary} textAnchor="middle" fontWeight="700">{d.value}</SvgText> : null}
          </G>
        );
      })}
    </Svg>
  );
}

function MiniLineChart({ data, width, height, color }: { data: Array<{ label: string; value: number }>; width: number; height: number; color: string }) {
  if (data.length < 2) return null;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = Math.max(maxVal - minVal, 1);
  const chartH = height - 24;
  const chartW = width - 40;
  const stepX = chartW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: 20 + i * stepX,
    y: 8 + chartH - ((d.value - minVal) / range) * chartH,
  }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {/* Grid lines */}
      {[0, 0.5, 1].map((pct, i) => (
        <Line key={i} x1={20} y1={8 + chartH * (1 - pct)} x2={width - 20} y2={8 + chartH * (1 - pct)} stroke={theme.border} strokeWidth={0.5} opacity={0.5} />
      ))}
      <Polyline points={polyline} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <G key={i}>
          <SvgCircle cx={p.x} cy={p.y} r={3.5} fill={color} stroke="#FFF" strokeWidth={2} />
          <SvgText x={p.x} y={height - 2} fontSize="8" fill={theme.textMuted} textAnchor="middle" fontWeight="600">{data[i].label}</SvgText>
        </G>
      ))}
    </Svg>
  );
}

export default function ClubAnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useLanguage();
  const fr = language === 'fr';
  const { players, matches, tournaments } = useAppData();
  const { getClubById } = useAppActions();

  const club = getClubById(id!);
  const clubMembers = useMemo(() => players.filter(p => p.clubId === id), [players, id]);

  const [analytics, setAnalytics] = useState<ClubAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const [screenDims, setScreenDims] = useState(() => Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setScreenDims(window));
    return () => sub?.remove();
  }, []);
  const screenWidth = Math.max(1, screenDims.width);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchClubAnalytics(id, clubMembers, matches, tournaments).then(data => {
      setAnalytics(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, clubMembers.length, matches.length, tournaments.length]);

  const roleColors: Record<string, string> = {
    'Tireur': '#F97316',
    'Pointeur': '#3B82F6',
    'Milieu': '#8B5CF6',
  };

  if (!club) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Pressable style={s.headerBtn} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>{fr ? 'Analytique Club' : 'Club Analytics'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.textMuted }}>{fr ? 'Club introuvable' : 'Club not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.container}>
      <View style={s.header}>
        <Pressable style={s.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>{fr ? 'Analytique' : 'Analytics'}</Text>
          <Text style={s.headerSubtitle}>{club.name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ fontSize: 14, color: theme.textMuted }}>{fr ? 'Chargement...' : 'Loading...'}</Text>
        </View>
      ) : analytics ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          {/* Overview Cards */}
          <View style={s.overviewGrid}>
            <View style={s.overviewCard}>
              <View style={[s.overviewIcon, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="people" size={20} color={theme.primary} />
              </View>
              <Text style={s.overviewValue}>{analytics.totalMembers}</Text>
              <Text style={s.overviewLabel}>{fr ? 'Membres' : 'Members'}</Text>
            </View>
            <View style={s.overviewCard}>
              <View style={[s.overviewIcon, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="trending-up" size={20} color={theme.success} />
              </View>
              <Text style={s.overviewValue}>{analytics.activeMembersThisMonth}</Text>
              <Text style={s.overviewLabel}>{fr ? 'Actifs ce mois' : 'Active this month'}</Text>
            </View>
            <View style={s.overviewCard}>
              <View style={[s.overviewIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
                <MaterialIcons name="diamond" size={20} color="#8B5CF6" />
              </View>
              <Text style={s.overviewValue}>{analytics.avgElo}</Text>
              <Text style={s.overviewLabel}>{fr ? 'ELO moyen' : 'Avg ELO'}</Text>
            </View>
            <View style={s.overviewCard}>
              <View style={[s.overviewIcon, { backgroundColor: theme.accent + '15' }]}>
                <MaterialIcons name="sports" size={20} color={theme.accent} />
              </View>
              <Text style={s.overviewValue}>{analytics.avgWinRate}%</Text>
              <Text style={s.overviewLabel}>{fr ? 'Taux victoire' : 'Win rate'}</Text>
            </View>
          </View>

          {/* Matches by Month */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: theme.primary + '15' }]}>
                <MaterialIcons name="bar-chart" size={18} color={theme.primary} />
              </View>
              <Text style={s.sectionTitle}>{fr ? 'Matchs par mois' : 'Matches by Month'}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <MiniBarChart
                data={analytics.matchesByMonth.map(m => ({ label: m.month, value: m.count }))}
                width={Math.min(screenWidth - 64, 340)}
                height={120}
                color={theme.primary}
              />
            </View>
            <View style={s.chartLegend}>
              <Text style={s.chartLegendText}>{analytics.totalMatches} {fr ? 'matchs au total' : 'total matches'}</Text>
            </View>
          </View>

          {/* Win Rate Evolution */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: theme.success + '15' }]}>
                <MaterialIcons name="show-chart" size={18} color={theme.success} />
              </View>
              <Text style={s.sectionTitle}>{fr ? 'Evolution taux de victoire' : 'Win Rate Evolution'}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <MiniLineChart
                data={analytics.winRateEvolution.map(m => ({ label: m.month, value: m.winRate }))}
                width={Math.min(screenWidth - 64, 340)}
                height={120}
                color={theme.success}
              />
            </View>
          </View>

          {/* National Average Comparison */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: '#3B82F6' + '15' }]}>
                <MaterialIcons name="compare-arrows" size={18} color="#3B82F6" />
              </View>
              <Text style={s.sectionTitle}>{fr ? 'Comparaison nationale' : 'National Comparison'}</Text>
            </View>
            {[
              { label: fr ? 'ELO moyen' : 'Avg ELO', club: analytics.avgElo, national: analytics.nationalAvgElo, icon: 'diamond', color: '#8B5CF6' },
              { label: fr ? 'Taux victoire' : 'Win Rate', club: analytics.avgWinRate, national: analytics.nationalAvgWinRate, icon: 'emoji-events', color: theme.success, suffix: '%' },
              { label: fr ? 'Matchs/membre' : 'Matches/member', club: analytics.totalMembers > 0 ? Math.round((analytics.totalMatches / analytics.totalMembers) * 10) / 10 : 0, national: analytics.nationalAvgMatchesPerMember, icon: 'sports', color: theme.primary },
            ].map((item, idx) => {
              const diff = item.club - item.national;
              const isAbove = diff > 0;
              return (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: idx < 2 ? 1 : 0, borderBottomColor: theme.border + '60' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>{item.label}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: item.color }}>{item.club}{item.suffix || ''}</Text>
                      <Text style={{ fontSize: 11, color: theme.textMuted }}>vs</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>{item.national}{item.suffix || ''}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: isAbove ? '#22C55E15' : '#EF444415', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <MaterialIcons name={isAbove ? 'arrow-upward' : 'arrow-downward'} size={12} color={isAbove ? '#22C55E' : '#EF4444'} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isAbove ? '#22C55E' : '#EF4444' }}>{isAbove ? '+' : ''}{Math.round(diff * 10) / 10}{item.suffix || ''}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Top 5 Members */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: '#F59E0B' + '15' }]}>
                <MaterialIcons name="emoji-events" size={18} color="#F59E0B" />
              </View>
              <Text style={s.sectionTitle}>{fr ? 'Top 5 Joueurs' : 'Top 5 Players'}</Text>
            </View>
            {analytics.topMembers.map((member, idx) => {
              const eloR = getEloRank(member.elo);
              const medals = ['#F59E0B', '#94A3B8', '#CD7F32'];
              return (
                <Pressable key={member.id} style={s.memberRow} onPress={() => router.push(`/player/${member.id}`)}>
                  <View style={[s.memberRank, idx < 3 && { backgroundColor: medals[idx] + '20' }]}>
                    {idx < 3 ? (
                      <MaterialIcons name="emoji-events" size={14} color={medals[idx]} />
                    ) : (
                      <Text style={s.memberRankText}>{idx + 1}</Text>
                    )}
                  </View>
                  <View style={s.memberAvatar}>
                    {member.avatar ? (
                      <Image source={{ uri: member.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} contentFit="cover" />
                    ) : (
                      <Text style={s.memberAvatarText}>{member.name.charAt(0)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.memberName} numberOfLines={1}>{member.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: theme.textMuted }}>{member.matches} {fr ? 'matchs' : 'games'}</Text>
                      <Text style={{ fontSize: 11, color: theme.success, fontWeight: '600' }}>{member.winRate}%</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.memberElo, { color: eloR.color }]}>{member.elo}</Text>
                    <Text style={{ fontSize: 9, color: eloR.color, fontWeight: '600' }}>{eloR.label[fr ? 'fr' : 'en']}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Role Distribution */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: '#8B5CF6' + '15' }]}>
                <MaterialIcons name="pie-chart" size={18} color="#8B5CF6" />
              </View>
              <Text style={s.sectionTitle}>{fr ? 'Distribution des roles' : 'Role Distribution'}</Text>
            </View>
            {analytics.roleDistribution.map(rd => {
              const color = roleColors[rd.role] || theme.textMuted;
              return (
                <View key={rd.role} style={s.roleRow}>
                  <View style={[s.roleIcon, { backgroundColor: color + '15' }]}>
                    <MaterialIcons name={rd.role === 'Tireur' ? 'gps-fixed' : rd.role === 'Pointeur' ? 'adjust' : 'swap-horiz'} size={16} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textPrimary }}>{rd.role}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color }}>{rd.pct}%</Text>
                    </View>
                    <View style={s.roleBarTrack}>
                      <View style={[s.roleBarFill, { width: `${rd.pct}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{rd.count} {fr ? 'joueurs' : 'players'}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Export CSV Button */}
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#10B981', paddingVertical: 16, borderRadius: 14, marginBottom: 10, ...theme.shadows.card }}
            onPress={async () => {
              if (!analytics || !club) return;
              try {
                const rows: string[] = [];
                // Header
                rows.push(`"${club.name} - ${fr ? 'Rapport Analytique' : 'Analytics Report'}"`);
                rows.push('');
                rows.push(`${fr ? 'Metrique' : 'Metric'},${fr ? 'Valeur' : 'Value'}`);
                rows.push(`${fr ? 'Membres' : 'Members'},${analytics.totalMembers}`);
                rows.push(`${fr ? 'Actifs ce mois' : 'Active this month'},${analytics.activeMembersThisMonth}`);
                rows.push(`${fr ? 'ELO moyen' : 'Avg ELO'},${analytics.avgElo}`);
                rows.push(`${fr ? 'Taux victoire' : 'Win Rate'},${analytics.avgWinRate}%`);
                rows.push(`${fr ? 'Total matchs' : 'Total Matches'},${analytics.totalMatches}`);
                rows.push(`${fr ? 'Tournois joues' : 'Tournaments Played'},${analytics.tournamentsPlayed}`);
                rows.push('');
                rows.push(`${fr ? 'ELO moyen national' : 'National Avg ELO'},${analytics.nationalAvgElo}`);
                rows.push(`${fr ? 'Taux victoire national' : 'National Win Rate'},${analytics.nationalAvgWinRate}%`);
                rows.push('');
                // Top members
                rows.push(`${fr ? 'Rang' : 'Rank'},${fr ? 'Joueur' : 'Player'},ELO,${fr ? 'Matchs' : 'Matches'},${fr ? 'Victoires' : 'Win Rate'}`);
                analytics.topMembers.forEach((m, i) => {
                  rows.push(`${i + 1},"${m.name}",${m.elo},${m.matches},${m.winRate}%`);
                });
                rows.push('');
                // Role distribution
                rows.push(`${fr ? 'Role' : 'Role'},${fr ? 'Joueurs' : 'Players'},%`);
                analytics.roleDistribution.forEach(r => {
                  rows.push(`${r.role},${r.count},${r.pct}%`);
                });
                rows.push('');
                // Matches by month
                rows.push(`${fr ? 'Mois' : 'Month'},${fr ? 'Matchs' : 'Matches'}`);
                analytics.matchesByMonth.forEach(m => {
                  rows.push(`${m.month},${m.count}`);
                });
                const csv = rows.join('\n');
                if (Platform.OS === 'web') {
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `analytics_${club.name.replace(/\s+/g, '_').slice(0, 20)}.csv`; a.click();
                  URL.revokeObjectURL(url);
                } else {
                  const FSModule = require('expo-file-system');
                  const SharingModule = require('expo-sharing');
                  const fileName = `analytics_${club.name.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.csv`;
                  const fileUri = `${FSModule.cacheDirectory}${fileName}`;
                  await FSModule.writeAsStringAsync(fileUri, csv, { encoding: FSModule.EncodingType.UTF8 });
                  if (await SharingModule.isAvailableAsync()) {
                    await SharingModule.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: fileName });
                  }
                }
              } catch (e) { console.log('CSV export error:', e); }
            }}
          >
            <MaterialIcons name="table-chart" size={20} color="#FFF" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>{fr ? 'Exporter en CSV' : 'Export CSV'}</Text>
          </Pressable>

          {/* Export PDF Button */}
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 14, marginBottom: 14, ...theme.shadows.card }}
            onPress={async () => {
              if (!analytics || !club) return;
              try {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${club.name} - Analytics</title><style>body{font-family:system-ui;max-width:800px;margin:0 auto;padding:24px;color:#1E293B}h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;margin-top:24px;margin-bottom:12px;color:#475569;border-bottom:2px solid #E2E8F0;padding-bottom:6px}.grid{display:flex;gap:16px;flex-wrap:wrap}.card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;flex:1;min-width:140px;text-align:center}.card .value{font-size:28px;font-weight:800;color:#1E40AF}.card .label{font-size:12px;color:#64748B;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #E2E8F0}th{background:#F1F5F9;font-weight:600;font-size:12px;color:#475569;text-transform:uppercase}td{font-size:14px}.compare{display:flex;gap:8px;align-items:center}.above{color:#22C55E;font-weight:700}.below{color:#EF4444;font-weight:700}.footer{margin-top:32px;text-align:center;color:#94A3B8;font-size:11px}</style></head><body><h1>${club.name}</h1><p style="color:#64748B;margin-bottom:24px">${fr ? 'Rapport analytique' : 'Analytics Report'} - ${new Date().toLocaleDateString(fr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p><div class="grid"><div class="card"><div class="value">${analytics.totalMembers}</div><div class="label">${fr ? 'Membres' : 'Members'}</div></div><div class="card"><div class="value">${analytics.avgElo}</div><div class="label">${fr ? 'ELO moyen' : 'Avg ELO'}</div></div><div class="card"><div class="value">${analytics.avgWinRate}%</div><div class="label">${fr ? 'Taux victoire' : 'Win Rate'}</div></div><div class="card"><div class="value">${analytics.totalMatches}</div><div class="label">${fr ? 'Matchs total' : 'Total Matches'}</div></div></div><h2>${fr ? 'Comparaison nationale' : 'National Comparison'}</h2><table><tr><th>${fr ? 'Metrique' : 'Metric'}</th><th>Club</th><th>${fr ? 'Moyenne nationale' : 'National Avg'}</th><th>${fr ? 'Diff' : 'Diff'}</th></tr><tr><td>${fr ? 'ELO moyen' : 'Avg ELO'}</td><td><strong>${analytics.avgElo}</strong></td><td>${analytics.nationalAvgElo}</td><td class="${analytics.avgElo >= analytics.nationalAvgElo ? 'above' : 'below'}">${analytics.avgElo >= analytics.nationalAvgElo ? '+' : ''}${analytics.avgElo - analytics.nationalAvgElo}</td></tr><tr><td>${fr ? 'Taux victoire' : 'Win Rate'}</td><td><strong>${analytics.avgWinRate}%</strong></td><td>${analytics.nationalAvgWinRate}%</td><td class="${analytics.avgWinRate >= analytics.nationalAvgWinRate ? 'above' : 'below'}">${analytics.avgWinRate >= analytics.nationalAvgWinRate ? '+' : ''}${Math.round((analytics.avgWinRate - analytics.nationalAvgWinRate) * 10) / 10}%</td></tr></table><h2>${fr ? 'Top 5 Joueurs' : 'Top 5 Players'}</h2><table><tr><th>#</th><th>${fr ? 'Joueur' : 'Player'}</th><th>ELO</th><th>${fr ? 'Matchs' : 'Matches'}</th><th>${fr ? 'Victoires' : 'Win Rate'}</th></tr>${analytics.topMembers.map((m, i) => `<tr><td>${i + 1}</td><td>${m.name}</td><td><strong>${m.elo}</strong></td><td>${m.matches}</td><td>${m.winRate}%</td></tr>`).join('')}</table><h2>${fr ? 'Distribution des roles' : 'Role Distribution'}</h2><table><tr><th>${fr ? 'Role' : 'Role'}</th><th>${fr ? 'Joueurs' : 'Players'}</th><th>%</th></tr>${analytics.roleDistribution.map(r => `<tr><td>${r.role}</td><td>${r.count}</td><td>${r.pct}%</td></tr>`).join('')}</table><div class="footer">Ultimate Petanque - ${new Date().toISOString().slice(0, 10)}</div></body></html>`;
                if (Platform.OS === 'web') {
                  const pw = window.open('', '_blank');
                  if (pw) { pw.document.write(html); pw.document.close(); pw.print(); }
                } else {
                  const PrintModule = require('expo-print');
                  const SharingModule = require('expo-sharing');
                  const FSModule = require('expo-file-system');
                  const { uri } = await PrintModule.printToFileAsync({ html });
                  const fileName = `analytics_${club.name.replace(/\s+/g, '_').slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.pdf`;
                  const newUri = `${FSModule.cacheDirectory}${fileName}`;
                  await FSModule.moveAsync({ from: uri, to: newUri });
                  if (await SharingModule.isAvailableAsync()) {
                    await SharingModule.shareAsync(newUri, { mimeType: 'application/pdf', dialogTitle: fileName });
                  }
                }
              } catch (e) { console.log('Analytics PDF export error:', e); }
            }}
          >
            <MaterialIcons name="picture-as-pdf" size={20} color="#FFF" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>{fr ? 'Exporter en PDF' : 'Export PDF'}</Text>
          </Pressable>

          {/* Tournament Stats */}
          <View style={s.sectionCard}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIconBox, { backgroundColor: theme.carreauColor + '15' }]}>
                <MaterialIcons name="emoji-events" size={18} color={theme.carreauColor} />
              </View>
              <Text style={s.sectionTitle}>{fr ? 'Tournois' : 'Tournaments'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={s.tournamentStat}>
                <Text style={s.tournamentStatValue}>{analytics.tournamentsPlayed}</Text>
                <Text style={s.tournamentStatLabel}>{fr ? 'Total organises' : 'Total organized'}</Text>
              </View>
              <View style={s.tournamentStat}>
                <Text style={[s.tournamentStatValue, { color: theme.carreauColor }]}>{analytics.tournamentsThisYear}</Text>
                <Text style={s.tournamentStatLabel}>{fr ? 'Cette annee' : 'This year'}</Text>
              </View>
              <View style={s.tournamentStat}>
                <Text style={[s.tournamentStatValue, { color: theme.success }]}>{analytics.newMembersThisMonth}</Text>
                <Text style={s.tournamentStatLabel}>{fr ? 'Nouveaux ce mois' : 'New this month'}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="analytics" size={48} color={theme.textMuted} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textPrimary, marginTop: 12 }}>{fr ? 'Aucune donnee' : 'No data'}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  headerSubtitle: { fontSize: 12, color: theme.textSecondary, marginTop: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Overview
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  overviewCard: { flex: 1, minWidth: '45%', backgroundColor: theme.surface, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, ...theme.shadows.card },
  overviewIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  overviewValue: { fontSize: 24, fontWeight: '800', color: theme.textPrimary },
  overviewLabel: { fontSize: 11, color: theme.textMuted, textAlign: 'center' },

  // Section
  sectionCard: { backgroundColor: theme.surface, borderRadius: 16, padding: 16, marginBottom: 14, ...theme.shadows.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.textPrimary },

  // Chart legend
  chartLegend: { alignItems: 'center', marginTop: 8 },
  chartLegendText: { fontSize: 12, color: theme.textMuted },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border + '60' },
  memberRank: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.backgroundSecondary },
  memberRankText: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  memberAvatarText: { fontSize: 14, fontWeight: '700', color: theme.primary },
  memberName: { fontSize: 14, fontWeight: '600', color: theme.textPrimary },
  memberElo: { fontSize: 16, fontWeight: '800' },

  // Roles
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  roleIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  roleBarTrack: { height: 6, backgroundColor: theme.backgroundSecondary, borderRadius: 3, overflow: 'hidden' },
  roleBarFill: { height: '100%', borderRadius: 3 },

  // Tournaments
  tournamentStat: { flex: 1, alignItems: 'center', backgroundColor: theme.backgroundSecondary, borderRadius: 12, paddingVertical: 16, gap: 4 },
  tournamentStatValue: { fontSize: 22, fontWeight: '800', color: theme.textPrimary },
  tournamentStatLabel: { fontSize: 10, color: theme.textMuted, textAlign: 'center' },
});
