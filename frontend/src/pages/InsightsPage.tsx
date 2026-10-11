import React, { useCallback, useEffect, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Info,
  BarChart3,
} from 'lucide-react';
import { PageContainer } from '../components/PageContainer';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { PrivacyCard } from '../components/PrivacyCard';
import { getInsights, type InsightsResponse, type InsightTheme } from '../services/api';

const TOPIC_LABELS: Record<string, string> = {
  FACULTY: 'Faculty',
  INFRASTRUCTURE: 'Infrastructure',
  OTHER: 'Other',
};

interface ThemeGroup {
  key: string;
  topicId: string;
  day: string;
  summary: string;
  items: InsightTheme[];
}

function groupThemes(themes: InsightTheme[]): ThemeGroup[] {
  const map = new Map<string, ThemeGroup>();
  for (const theme of themes) {
    const key = `${theme.topic_id}@${theme.server_day}`;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        topicId: theme.topic_id,
        day: theme.server_day,
        summary: '',
        items: [],
      };
      map.set(key, group);
    }
    group.items.push(theme);
    if (!group.summary && theme.summary) group.summary = theme.summary;
  }
  return Array.from(map.values());
}

export const InsightsPage: React.FC = () => {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await getInsights();
      setData(result);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load campus insights right now.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topics = data?.topics ?? [];
  const themes = data?.themes ?? [];
  const themeGroups = groupThemes(themes);
  const isEmpty = topics.length === 0 && themeGroups.length === 0;
  const threshold = data?.threshold ?? 3;

  return (
    <PageContainer maxWidth="xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#4AB7E0]/30 bg-[#4AB7E0]/10 text-[#4AB7E0] text-xs font-mono mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            AI-ASSISTED · AGGREGATE ONLY
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F8FA] mb-2">
            Campus Insights
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Generalized themes and trends derived from anonymous reports. Only buckets with at
            least {threshold} reports are shown, so no single complaint can be identified.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={load}
          disabled={isLoading}
          className="flex items-center gap-2 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {data?.demoMode && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-amber-200 text-xs flex gap-3 items-start">
          <Info className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">DEMO DATA —</span> This deployment is running in demo mode
            and may include synthetic test reports. The figures below are for demonstration only
            and are not genuine campus findings.
          </div>
        </div>
      )}

      <PrivacyCard
        variant="subtle"
        title="AI-generated, not verified facts:"
        text="Themes and summaries are produced by a language model from anonymous text and are generalized. They may be incomplete or imprecise and are never linked to any student."
        className="mb-8"
      />

      {isLoading ? (
        <LoadingState
          title="Loading campus insights..."
          description="Fetching privacy-safe aggregate themes and trends."
        />
      ) : errorMsg ? (
        <div className="p-6 rounded-2xl border border-rose-500/40 bg-[#0D173B] text-rose-300 text-sm flex gap-3 items-start shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-1">Could not load insights</div>
            <div className="text-rose-200/80">{errorMsg}</div>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="p-10 rounded-2xl border border-[#4AB7E0]/30 bg-[#0D173B] text-center shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-[#4AB7E0]/15 border border-[#4AB7E0]/30 text-[#4AB7E0] flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#F7F8FA] mb-2">Not enough anonymous reports yet</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            The campus needs at least {threshold} reports for a topic on the same day before any
            aggregate is displayed. This protects individual students. Please check back later.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Aggregate trends */}
          {topics.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#4AB7E0]" />
                <h2 className="text-lg font-bold text-[#F7F8FA]">Aggregate trends</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topics.map((t) => {
                  const max = Math.max(...topics.map((x) => x.submission_count), 1);
                  const pct = Math.round((t.submission_count / max) * 100);
                  return (
                    <div
                      key={`${t.topic_id}-${t.server_day}`}
                      className="p-5 rounded-2xl border border-[#4AB7E0]/20 bg-[#0D173B] shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-[#F7F8FA]">
                          {TOPIC_LABELS[t.topic_id] || t.topic_id}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{t.server_day}</span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-black text-[#E2D64B]">
                          {t.submission_count}
                        </span>
                        <span className="text-xs text-slate-300">reports</span>
                        {t.warn_count > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {t.warn_count} flagged
                          </span>
                        )}
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#091029] border border-[#4AB7E0]/15 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#4AB7E0] to-[#E2D64B]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* AI themes */}
          {themeGroups.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-[#E2D64B]" />
                <h2 className="text-lg font-bold text-[#F7F8FA]">Recurring themes</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E2D64B]/15 text-[#E2D64B] border border-[#E2D64B]/30 font-bold">
                  AI-GENERATED
                </span>
              </div>

              <div className="space-y-4">
                {themeGroups.map((group) => (
                  <div
                    key={group.key}
                    className="p-5 sm:p-6 rounded-2xl border border-[#E2D64B]/25 bg-[#0D173B] shadow-xl"
                  >
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#4AB7E0]/15">
                      <span className="text-sm font-bold text-[#F7F8FA]">
                        {TOPIC_LABELS[group.topicId] || group.topicId}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{group.day}</span>
                    </div>

                    {group.summary && (
                      <div className="mb-4 p-3 rounded-xl bg-[#091029] border border-[#4AB7E0]/20 flex gap-2.5 items-start">
                        <Info className="w-4 h-4 text-[#4AB7E0] shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-200 leading-relaxed">{group.summary}</p>
                      </div>
                    )}

                    <ul className="space-y-2.5">
                      {group.items.map((theme) => (
                        <li
                          key={theme.theme_key}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-sm text-[#F7F8FA]">{theme.theme_label}</span>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#4AB7E0]/15 text-[#4AB7E0] border border-[#4AB7E0]/30 whitespace-nowrap">
                            {theme.support_count} reports
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="mt-10">
        <PrivacyCard
          variant="highlight"
          title="Minimum-group protection (k = 3)"
          text="A theme or trend is shown only after at least three independent anonymous reports support it. Raw complaints and per-submission histories are never displayed."
        />
        <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#4AB7E0]" />
          <span>Ingested text is analyzed in memory and never stored or attached to a student.</span>
        </div>
      </div>
    </PageContainer>
  );
};
