/**
 * WeeklyStatsCard — Weekly summary card for the Stats tab.
 * Shows win rate trend vs last week, best performance, and sparkline daily activity.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import theme from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/hooks/useLanguage';
import { computeStreakFromDates, getDailyActivityLast7Days } from '@/services/streakService';
import { extraTranslations } from '@/constants/i18nExtra';

export default function WeeklyStatsCard() {
  const { matches, challenges } = useApp();
  const { t, language } = useLanguage();
  const et = extraTranslations.streak;

  const weeklyData = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const thisWeekMatches = matches.filter(m => new Date(m.date) >= weekStart);
    const lastWeekMatches = matches.filter(m => {
      const d = new Date(m.date);
      return d >= prevWeekStart && d < weekStart;
    });
    const thisWeekChallenges = challenges.filter(c => new Date(c.date) >= weekStart);

    const thisWeekWins = thisWeekMatches.filter(m => m.winner === 'A').length;
    const thisWeekWR = thisWeekMatches.length > 0 ? Math.round((thisWeekWins / thisWeekMatches.length) * 100) : 0;
    const lastWeekWins = lastWeekMatches.filter(m => m.winner === 'A').length;
    const lastWeekWR = lastWeekMatches.length > 0 ? Math.round((lastWeekWins / lastWeekMatches.length) * 100) : 0;
    const wrDiff = thisWeekWR - lastWeekWR;

    let bestPerf = '';
    if (thisWeekMatches.length > 0) {
      const maxScore = Math.max(...thisWeekMatches.map(m => m.teamA?.score || 0));
      const bestMatch = thisWeekMatches.find(m => (m.teamA?.score || 0) === maxScore);
      if (bestMatch) bestPerf = `${bestMatch.teamA?.score || 0}-${bestMatch.teamB?.score || 0}`;
    }

    const dailyActivity = getDailyActivityLast7Days(matches, challenges);
    const maxDaily = Math.max(...dailyActivity.map(d => d.total), 1);

    const allDates = [...matches.map(m => m.date), ...challenges.map(c => c.date)];
    const streakData = computeStreakFromDates(allDates);

    const hasWeeklyData = thisWeekMatches.length > 0 || thisWeekChallenges.length > 0;

    return {
      thisWeekMatches: thisWeekMatches.length,
      thisWeekChallenges: thisWeekChallenges.length,
      lastWeekMatches: lastWeekMatches.length,
      thisWeekWR,
      lastWeekWR,
      wrDiff,
      bestPerf,
      dailyActivity,
      maxDaily,
      streakData,
      hasWeeklyData,
    };
  }, [matches, challenges]);

  if (!weeklyData.hasWeeklyData && weeklyData.streakData.currentStreak === 0) return null;
  if (matches.length === 0 && challenges.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ marginBottom: 16 }}>
      <View style={s.card}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerIcon}>
            <MaterialIcons name="date-range" size={18} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{(et.weeklyStatsTitle as any)?.[language] || 'Weekly Summary'}</Text>
            <Text style={s.subtitle}>{weeklyData.thisWeekMatches} {(et.matchesThisWeek as any)?.[language] || 'matches this week'}</Text>
          </View>
          {weeklyData.streakData.currentStreak > 0 ? (
            <View style={s.streakBadge}>
              <MaterialIcons name="local-fire-department" size={14} color="#F97316" />
              <Text style={s.streakBadgeText}>{weeklyData.streakData.currentStreak}j</Text>
            </View>
          ) : null}
        </View>

        {/* Stats Row */}
        {weeklyData.hasWeeklyData ? (
          <View style={s.statsRow}>
            <View style={s.statBlock}>
              <Text style={s.statLabel}>{(et.winRateTrend as any)?.[language] || 'Win rate'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[s.statValue, { color: '#2563EB' }]}>{weeklyData.thisWeekWR}%</Text>
                {weeklyData.lastWeekMatches > 0 ? (
                  <View style={[s.trendBadge, { backgroundColor: weeklyData.wrDiff > 0 ? '#10B98115' : weeklyData.wrDiff < 0 ? '#EF444415' : '#9CA3AF15' }]}>
                    <MaterialIcons name={weeklyData.wrDiff > 0 ? 'trending-up' : weeklyData.wrDiff < 0 ? 'trending-down' : 'remove'} size={12} color={weeklyData.wrDiff > 0 ? '#10B981' : weeklyData.wrDiff < 0 ? '#EF4444' : '#9CA3AF'} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: weeklyData.wrDiff > 0 ? '#10B981' : weeklyData.wrDiff < 0 ? '#EF4444' : '#9CA3AF' }}>
                      {weeklyData.wrDiff > 0 ? '+' : ''}{weeklyData.wrDiff}%
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            {weeklyData.bestPerf ? (
              <View style={s.statBlock}>
                <Text style={s.statLabel}>{(et.bestPerformance as any)?.[language] || 'Best perf.'}</Text>
                <Text style={[s.statValue, { color: theme.success }]}>{weeklyData.bestPerf}</Text>
              </View>
            ) : null}
            {weeklyData.thisWeekChallenges > 0 ? (
              <View style={s.statBlock}>
                <Text style={s.statLabel}>{t('profile', 'challenges')}</Text>
                <Text style={[s.statValue, { color: theme.accent }]}>{weeklyData.thisWeekChallenges}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Mini Sparkline */}
        <View style={s.sparklineSection}>
          <View style={s.sparklineHeader}>
            <Text style={s.sparklineLabel}>{(et.dailyActivity as any)?.[language] || 'Daily activity'}</Text>
            <View style={s.sparklineLegend}>
              <View style={s.sparklineLegendItem}>
                <View style={[s.sparklineLegendDot, { backgroundColor: theme.primary + '80' }]} />
                <Text style={s.sparklineLegendText}>{language === 'fr' ? 'Matchs' : 'Matches'}</Text>
              </View>
              <View style={s.sparklineLegendItem}>
                <View style={[s.sparklineLegendDot, { backgroundColor: theme.accent + '80' }]} />
                <Text style={s.sparklineLegendText}>{language === 'fr' ? 'Defis' : 'Challenges'}</Text>
              </View>
            </View>
          </View>
          <Text style={s.sparklineDesc}>{language === 'fr' ? 'Sessions jouees chaque jour (7 derniers jours)' : 'Sessions played each day (last 7 days)'}</Text>
          <View style={s.sparklineRow}>
            {weeklyData.dailyActivity.map((day, idx) => {
              const height = day.total > 0 ? Math.max(8, (day.total / weeklyData.maxDaily) * 36) : 4;
              const isToday = idx === 6;
              return (
                <View key={idx} style={s.sparklineCol}>
                  <View style={s.sparklineBarTrack}>
                    <View style={[
                      s.sparklineBar,
                      {
                        height,
                        backgroundColor: day.total > 0
                          ? (isToday ? '#2563EB' : day.matchCount > 0 ? theme.primary + '80' : theme.accent + '80')
                          : theme.border,
                      },
                    ]} />
                  </View>
                  <Text style={[s.sparklineDayLabel, isToday && { color: '#2563EB', fontWeight: '700' }]}>{day.dayLabel}</Text>
                  {day.total > 0 ? <Text style={s.sparklineCount}>{day.total}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* See full stats link */}
        <Pressable
          style={s.seeStatsBtn}
          onPress={() => router.push({ pathname: '/(tabs)/stats', params: { timeFilter: 'week' } } as any)}
        >
          <Text style={s.seeStatsBtnText}>{language === 'fr' ? 'Voir les stats completes' : 'View complete stats'}</Text>
          <MaterialIcons name="chevron-right" size={16} color={theme.primary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8EDF2',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2563EB12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F9731615',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F9731625',
  },
  streakBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F97316',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sparklineSection: {
    gap: 6,
  },
  sparklineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparklineLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparklineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sparklineLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sparklineLegendText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
  },
  sparklineDesc: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 2,
  },
  sparklineLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sparklineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 56,
  },
  sparklineCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  sparklineBarTrack: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
    borderRadius: 4,
  },
  sparklineBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  sparklineDayLabel: {
    fontSize: 9,
    fontWeight: '500',
    color: '#94A3B8',
  },
  sparklineCount: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
  },
  seeStatsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  seeStatsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
});
