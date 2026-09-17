/**
 * FAQ Analytics Service
 *
 * Lightweight event tracking for the public FAQ page (question views,
 * searches, empty-result searches, category views, and resolution votes).
 * Data is stored in the `faq_analytics` table with admin-only SELECT via RLS.
 */
import { getSupabaseClient } from '@/template';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'faq_session_id';

async function getSessionId(): Promise<string> {
  try {
    let sid = await AsyncStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await AsyncStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `${Date.now()}`;
  }
}

export type FaqEventType = 'question_view' | 'search' | 'search_no_result' | 'category_view' | 'resolved' | 'not_resolved';

export async function trackFaqEvent(params: {
  eventType: FaqEventType;
  questionId?: string;
  categoryId?: string;
  audienceTab?: string;
  searchQuery?: string;
  language?: string;
}): Promise<void> {
  try {
    const sb = getSupabaseClient();
    const { data: userData } = await sb.auth.getUser();
    const sessionId = await getSessionId();
    await sb.from('faq_analytics').insert({
      event_type: params.eventType,
      question_id: params.questionId || null,
      category_id: params.categoryId || null,
      audience_tab: params.audienceTab || null,
      search_query: params.searchQuery ? params.searchQuery.toLowerCase().slice(0, 200) : null,
      language: params.language || 'fr',
      user_id: userData?.user?.id || null,
      session_id: sessionId,
    });
  } catch { /* silent */ }
}

export interface FaqQuestionStat {
  questionId: string;
  count: number;
  categoryId?: string;
  audienceTab?: string;
}

export interface FaqSearchStat {
  query: string;
  count: number;
  hasResults: boolean;
}

export interface FaqCategoryStat {
  categoryId: string;
  count: number;
}

export interface FaqAnalyticsSummary {
  totalEvents: number;
  totalSessions: number;
  totalQuestionViews: number;
  totalSearches: number;
  totalEmptySearches: number;
  emptySearchRate: number;
  resolved: number;
  notResolved: number;
  resolutionRate: number;
  topQuestions: FaqQuestionStat[];
  emptySearches: FaqSearchStat[];
  topSearches: FaqSearchStat[];
  topCategories: FaqCategoryStat[];
  audienceBreakdown: Array<{ audienceTab: string; count: number }>;
}

/**
 * Fetch aggregated analytics over the given time window (days).
 * Admin-only via RLS; returns empty summary for non-admins.
 */
export async function getFaqAnalyticsSummary(days: number = 30): Promise<FaqAnalyticsSummary> {
  const empty: FaqAnalyticsSummary = {
    totalEvents: 0, totalSessions: 0, totalQuestionViews: 0, totalSearches: 0,
    totalEmptySearches: 0, emptySearchRate: 0, resolved: 0, notResolved: 0,
    resolutionRate: 0, topQuestions: [], emptySearches: [], topSearches: [],
    topCategories: [], audienceBreakdown: [],
  };
  try {
    const sb = getSupabaseClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('faq_analytics')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000);
    if (error || !data) return empty;

    const events = data as any[];
    const sessions = new Set<string>();
    const qCount = new Map<string, FaqQuestionStat>();
    const emptyCount = new Map<string, number>();
    const searchCount = new Map<string, number>();
    const catCount = new Map<string, number>();
    const audCount = new Map<string, number>();
    let views = 0, searches = 0, emptySearches = 0, resolved = 0, notResolved = 0;

    for (const e of events) {
      if (e.session_id) sessions.add(e.session_id);
      if (e.event_type === 'question_view' && e.question_id) {
        views++;
        const cur = qCount.get(e.question_id) || { questionId: e.question_id, count: 0, categoryId: e.category_id || undefined, audienceTab: e.audience_tab || undefined };
        cur.count++;
        qCount.set(e.question_id, cur);
      } else if (e.event_type === 'search' && e.search_query) {
        searches++;
        searchCount.set(e.search_query, (searchCount.get(e.search_query) || 0) + 1);
      } else if (e.event_type === 'search_no_result' && e.search_query) {
        emptySearches++;
        emptyCount.set(e.search_query, (emptyCount.get(e.search_query) || 0) + 1);
      } else if (e.event_type === 'category_view' && e.category_id) {
        catCount.set(e.category_id, (catCount.get(e.category_id) || 0) + 1);
      } else if (e.event_type === 'resolved') {
        resolved++;
      } else if (e.event_type === 'not_resolved') {
        notResolved++;
      }
      if (e.audience_tab) {
        audCount.set(e.audience_tab, (audCount.get(e.audience_tab) || 0) + 1);
      }
    }

    const topQuestions = Array.from(qCount.values()).sort((a, b) => b.count - a.count).slice(0, 20);
    const emptySearches_ = Array.from(emptyCount.entries()).map(([q, c]) => ({ query: q, count: c, hasResults: false })).sort((a, b) => b.count - a.count).slice(0, 20);
    const topSearches = Array.from(searchCount.entries()).map(([q, c]) => ({ query: q, count: c, hasResults: true })).sort((a, b) => b.count - a.count).slice(0, 20);
    const topCategories = Array.from(catCount.entries()).map(([id, c]) => ({ categoryId: id, count: c })).sort((a, b) => b.count - a.count);
    const audienceBreakdown = Array.from(audCount.entries()).map(([id, c]) => ({ audienceTab: id, count: c })).sort((a, b) => b.count - a.count);

    return {
      totalEvents: events.length,
      totalSessions: sessions.size,
      totalQuestionViews: views,
      totalSearches: searches,
      totalEmptySearches: emptySearches,
      emptySearchRate: (searches + emptySearches) > 0 ? (emptySearches / (searches + emptySearches)) * 100 : 0,
      resolved,
      notResolved,
      resolutionRate: (resolved + notResolved) > 0 ? (resolved / (resolved + notResolved)) * 100 : 0,
      topQuestions,
      emptySearches: emptySearches_,
      topSearches,
      topCategories,
      audienceBreakdown,
    };
  } catch {
    return empty;
  }
}
