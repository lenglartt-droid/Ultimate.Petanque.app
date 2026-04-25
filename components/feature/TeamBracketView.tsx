/**
 * TeamBracketView — Visual bracket display for tournament teams.
 * Shows registered teams grouped into matchup pairs.
 * Auto-generates bracket from completed tournament_teams records.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from '@/services/haptics';
import theme from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { TournamentTeam, getTeamSize } from '@/services/teamInvitationService';

interface Props {
  tournamentId: string;
  format: string;
  language: string;
}

interface BracketMatchup {
  round: number;
  position: number;
  teamA: TournamentTeam | null;
  teamB: TournamentTeam | null;
}

function mapTeam(row: any): TournamentTeam {
  return {
    id: row.id, tournamentId: row.tournament_id, creatorUserId: row.creator_user_id,
    memberUserIds: row.member_user_ids || [], memberNames: row.member_names || [],
    format: row.format, status: row.status, completedAt: row.completed_at, createdAt: row.created_at,
  };
}

const TEAM_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#7C3AED', '#EC4899', '#06B6D4', '#D97706'];

export default function TeamBracketView({ tournamentId, format, language }: Props) {
  const fr = language === 'fr';
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const sb = getSupabaseClient();
      const { data } = await sb
        .from('tournament_teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('status', 'complete')
        .order('created_at', { ascending: true });
      setTeams((data || []).map(mapTeam));
      setLoading(false);
    };
    load();
  }, [tournamentId]);

  // Generate bracket matchups
  const matchups: BracketMatchup[] = useMemo(() => {
    if (teams.length < 2) return [];
    const result: BracketMatchup[] = [];
    // Simple round-robin pairing for round 1
    for (let i = 0; i < teams.length; i += 2) {
      result.push({
        round: 1,
        position: Math.floor(i / 2) + 1,
        teamA: teams[i] || null,
        teamB: teams[i + 1] || null,
      });
    }
    return result;
  }, [teams]);

  if (loading) {
    return (
      <View style={s.container}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  if (teams.length < 2) return null;

  const totalRounds = Math.ceil(Math.log2(teams.length));

  return (
    <Animated.View entering={FadeInDown.duration(250)} style={s.container}>
      <Pressable style={s.header} onPress={() => { Haptics.selectionAsync(); setExpanded(p => !p); }}>
        <View style={s.headerIcon}>
          <MaterialIcons name="account-tree" size={18} color="#7C3AED" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{fr ? 'Tableau des equipes' : 'Team Bracket'}</Text>
          <Text style={s.headerSub}>{teams.length} {fr ? 'equipes inscrites' : 'teams registered'} • {matchups.length} {fr ? 'matchs' : 'matches'}</Text>
        </View>
        <View style={[s.teamCountBadge, { backgroundColor: '#7C3AED15' }]}>
          <Text style={[s.teamCountText, { color: '#7C3AED' }]}>{teams.length}</Text>
        </View>
        <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color="#64748B" />
      </Pressable>

      {expanded ? (
        <View style={s.bracketBody}>
          {/* Round header */}
          <View style={s.roundHeader}>
            <MaterialIcons name="sports" size={14} color="#64748B" />
            <Text style={s.roundTitle}>{fr ? 'Tour 1' : 'Round 1'} — {matchups.length} {fr ? 'matchs' : 'matches'}</Text>
            {totalRounds > 1 ? (
              <View style={s.roundsBadge}>
                <Text style={s.roundsBadgeText}>{totalRounds} {fr ? 'tours' : 'rounds'}</Text>
              </View>
            ) : null}
          </View>

          {/* Matchups */}
          <ScrollView horizontal={matchups.length > 3} showsHorizontalScrollIndicator={false} contentContainerStyle={s.matchupsScroll}>
            {matchups.map((m, idx) => {
              const colorA = TEAM_COLORS[idx * 2 % TEAM_COLORS.length];
              const colorB = TEAM_COLORS[(idx * 2 + 1) % TEAM_COLORS.length];
              return (
                <Animated.View key={idx} entering={FadeInDown.duration(200).delay(idx * 60)} style={s.matchupCard}>
                  <View style={s.matchupNumber}>
                    <Text style={s.matchupNumberText}>M{m.position}</Text>
                  </View>

                  {/* Team A */}
                  {m.teamA ? (
                    <Pressable
                      style={[s.teamSlot, { borderLeftColor: colorA }]}
                      onPress={() => router.push(`/team-chat/${m.teamA!.id}` as any)}
                    >
                      <View style={s.teamSlotMembers}>
                        {m.teamA.memberNames.map((name, i) => (
                          <View key={i} style={[s.teamMemberDot, { backgroundColor: colorA }]}>
                            <Text style={s.teamMemberInitial}>{name.charAt(0)}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.teamSlotName} numberOfLines={1}>{m.teamA.memberNames.join(' & ')}</Text>
                        <Text style={s.teamSlotFormat}>{m.teamA.format}</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View style={[s.teamSlotEmpty, { borderLeftColor: '#E2E8F0' }]}>
                      <MaterialIcons name="hourglass-empty" size={14} color="#CBD5E1" />
                      <Text style={s.teamSlotEmptyText}>{fr ? 'En attente' : 'TBD'}</Text>
                    </View>
                  )}

                  {/* VS divider */}
                  <View style={s.vsRow}>
                    <View style={s.vsLine} />
                    <View style={s.vsBadge}>
                      <Text style={s.vsText}>VS</Text>
                    </View>
                    <View style={s.vsLine} />
                  </View>

                  {/* Team B */}
                  {m.teamB ? (
                    <Pressable
                      style={[s.teamSlot, { borderLeftColor: colorB }]}
                      onPress={() => router.push(`/team-chat/${m.teamB!.id}` as any)}
                    >
                      <View style={s.teamSlotMembers}>
                        {m.teamB.memberNames.map((name, i) => (
                          <View key={i} style={[s.teamMemberDot, { backgroundColor: colorB }]}>
                            <Text style={s.teamMemberInitial}>{name.charAt(0)}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.teamSlotName} numberOfLines={1}>{m.teamB.memberNames.join(' & ')}</Text>
                        <Text style={s.teamSlotFormat}>{m.teamB.format}</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View style={[s.teamSlotEmpty, { borderLeftColor: '#E2E8F0' }]}>
                      <MaterialIcons name="hourglass-empty" size={14} color="#CBD5E1" />
                      <Text style={s.teamSlotEmptyText}>{fr ? 'En attente' : 'TBD'}</Text>
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </ScrollView>

          {/* Team list summary */}
          <View style={s.teamListSection}>
            <Text style={s.teamListTitle}>{fr ? 'Equipes inscrites' : 'Registered Teams'}</Text>
            {teams.map((t, i) => (
              <Pressable
                key={t.id}
                style={s.teamListItem}
                onPress={() => router.push(`/team-chat/${t.id}` as any)}
              >
                <View style={[s.teamListDot, { backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }]}>
                  <Text style={s.teamListDotText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.teamListName} numberOfLines={1}>{t.memberNames.join(', ')}</Text>
                  <Text style={s.teamListMeta}>{t.format} • {t.memberUserIds.length} {fr ? 'joueurs' : 'players'}</Text>
                </View>
                <MaterialIcons name="chat-bubble-outline" size={16} color="#22C55E" />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1.5, borderColor: '#7C3AED20', overflow: 'hidden', ...Platform.select({ ios: { shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 }, default: {} }) },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#7C3AED12', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  headerSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  teamCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  teamCountText: { fontSize: 14, fontWeight: '800' },
  bracketBody: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingBottom: 16 },
  roundHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  roundTitle: { fontSize: 12, fontWeight: '600', color: '#64748B', flex: 1 },
  roundsBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roundsBadgeText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  matchupsScroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  matchupCard: { width: 220, backgroundColor: '#FAFAFA', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  matchupNumber: { alignSelf: 'center', backgroundColor: '#0F172A', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 10 },
  matchupNumberText: { fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  teamSlot: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 10, padding: 10, borderLeftWidth: 3 },
  teamSlotMembers: { flexDirection: 'row', marginRight: 2 },
  teamMemberDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginLeft: -4, borderWidth: 1.5, borderColor: '#FFF' },
  teamMemberInitial: { fontSize: 8, fontWeight: '800', color: '#FFF' },
  teamSlotName: { fontSize: 12, fontWeight: '600', color: '#0F172A' },
  teamSlotFormat: { fontSize: 9, color: '#94A3B8', marginTop: 1 },
  teamSlotEmpty: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderLeftWidth: 3, borderStyle: 'dashed' },
  teamSlotEmptyText: { fontSize: 11, color: '#CBD5E1', fontWeight: '600' },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  vsLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  vsBadge: { backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  vsText: { fontSize: 9, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  teamListSection: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 8 },
  teamListTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 },
  teamListItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  teamListDot: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  teamListDotText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  teamListName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  teamListMeta: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
});
