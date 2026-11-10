import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Award,
  BarChart3,
  CheckCircle2,
  XCircle,
  Layers,
  RefreshCw,
  Search,
  Activity
} from 'lucide-react';
import { getBrandDrift, type BrandDrift } from '../services/api';

interface InsightsViewProps {
  onNavigateToDocument?: (docId: string) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = () => {
  const [data, setData] = useState<BrandDrift | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeLayerFilter, setActiveLayerFilter] = useState<'all' | 'terminology' | 'facts' | 'tone'>('all');
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFeedFinding, setSelectedFeedFinding] = useState<any | null>(null);

  const loadData = () => {
    setIsRefreshing(true);
    getBrandDrift()
      .then((d) => setData(d))
      .catch((e) => console.error('Failed to load insights:', e))
      .finally(() => {
        setLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 text-slate-500 text-sm font-medium">
          <RefreshCw className="h-4 w-4 animate-spin text-[#006654]" />
          <span>Analyzing brand drift & compliance across all scan runs...</span>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    total_violations_flagged: 0,
    brand_alignment_rate: 100,
    violations_by_layer: { terminology: 0, facts: 0, tone: 0 },
    violations_by_severity: { high: 0, medium: 0, low: 0 },
    reviewer_decisions: { open: 0, accepted: 0, edited: 0, rejected: 0 },
  };

  const hallOfShame = data?.hall_of_shame || [];
  const ruleFatigue = data?.rule_fatigue_alerts || [];
  const recentFindings = data?.recent_findings || [];

  const totalViolations = summary.total_violations_flagged || 1;
  const termPercent = Math.round(((summary.violations_by_layer?.terminology || 0) / totalViolations) * 100);
  const factsPercent = Math.round(((summary.violations_by_layer?.facts || 0) / totalViolations) * 100);
  const tonePercent = Math.round(((summary.violations_by_layer?.tone || 0) / totalViolations) * 100);

  const filteredFindings = recentFindings.filter((f) => {
    if (activeLayerFilter !== 'all' && f.layer !== activeLayerFilter) return false;
    if (activeSeverityFilter !== 'all' && f.severity !== activeSeverityFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchQuote = f.quoted_text?.toLowerCase().includes(q);
      const matchExpl = f.explanation?.toLowerCase().includes(q);
      const matchFix = f.suggested_fix?.toLowerCase().includes(q);
      if (!matchQuote && !matchExpl && !matchFix) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page Title & Interactive Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Brand Governance Insights</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Live Real-Time
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Automated compliance analytics, reviewer feedback loops, and rule fatigue monitoring.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-sm transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Syncing...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {/* 4 Primary Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Health Index */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alignment Index</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-3xl font-extrabold text-emerald-700">{summary.brand_alignment_rate}%</div>
            <span className="text-[11px] text-slate-400 font-medium">overall health</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${summary.brand_alignment_rate}%` }}
            />
          </div>
        </div>

        {/* Card 2: Total Flags */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Violations Flagged</div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-3xl font-extrabold text-slate-900">{summary.total_violations_flagged}</div>
            <span className="text-[11px] text-slate-400 font-medium">all historical scans</span>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-500">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <span>Across Terminology, Facts & Tone</span>
          </div>
        </div>

        {/* Card 3: Reviewer Decisions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Corrections Adopted</div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-3xl font-extrabold text-[#006654]">
              {(summary.reviewer_decisions?.accepted || 0) + (summary.reviewer_decisions?.edited || 0)}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">accepted / edited</span>
          </div>
          <div className="flex items-center gap-1 mt-3 text-[11px] text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>AI suggestions applied by human</span>
          </div>
        </div>

        {/* Card 4: Rejections & Dismissals */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dismissed by Reviewers</div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-3xl font-extrabold text-amber-600">
              {summary.reviewer_decisions?.rejected || 0}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">false-positives / overrides</span>
          </div>
          <div className="flex items-center gap-1 mt-3 text-[11px] text-amber-700">
            <XCircle className="h-3.5 w-3.5" />
            <span>Feeds rule fatigue tuning</span>
          </div>
        </div>
      </div>

      {/* Interactive Distribution Bar: Breakdown by Governance Layer */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#006654]" />
              <span>Violations Distribution Across 3 Checker Layers</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Click any layer below to filter live findings feed.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveLayerFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activeLayerFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Layers
            </button>
            <button
              onClick={() => setActiveLayerFilter(activeLayerFilter === 'facts' ? 'all' : 'facts')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeLayerFilter === 'facts'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span>Facts & Claims ({summary.violations_by_layer?.facts || 0})</span>
            </button>
            <button
              onClick={() => setActiveLayerFilter(activeLayerFilter === 'terminology' ? 'all' : 'terminology')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeLayerFilter === 'terminology'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Terminology ({summary.violations_by_layer?.terminology || 0})</span>
            </button>
            <button
              onClick={() => setActiveLayerFilter(activeLayerFilter === 'tone' ? 'all' : 'tone')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeLayerFilter === 'tone'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              <span>Tone & Voice ({summary.violations_by_layer?.tone || 0})</span>
            </button>
          </div>
        </div>

        {/* Visual Multi-Segment Bar */}
        <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden gap-0.5">
          <div
            style={{ width: `${factsPercent}%` }}
            title={`Facts: ${summary.violations_by_layer?.facts || 0} (${factsPercent}%)`}
            className="bg-blue-500 h-full transition-all duration-500 hover:opacity-85 cursor-pointer"
            onClick={() => setActiveLayerFilter('facts')}
          />
          <div
            style={{ width: `${termPercent}%` }}
            title={`Terminology: ${summary.violations_by_layer?.terminology || 0} (${termPercent}%)`}
            className="bg-emerald-500 h-full transition-all duration-500 hover:opacity-85 cursor-pointer"
            onClick={() => setActiveLayerFilter('terminology')}
          />
          <div
            style={{ width: `${tonePercent}%` }}
            title={`Tone: ${summary.violations_by_layer?.tone || 0} (${tonePercent}%)`}
            className="bg-purple-500 h-full transition-all duration-500 hover:opacity-85 cursor-pointer"
            onClick={() => setActiveLayerFilter('tone')}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-medium">
          <span>Facts Layer: {factsPercent}%</span>
          <span>Terminology: {termPercent}%</span>
          <span>Tone & Voice: {tonePercent}%</span>
        </div>
      </div>

      {/* Grid: Most Violated Rules & Rule Fatigue Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 items-start">
        {/* Hall of Shame */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-rose-500" />
              <h2 className="text-base font-bold text-slate-900">Most Frequently Violated Guidelines</h2>
            </div>
            <span className="text-[11px] text-slate-400">Top violated patterns</span>
          </div>

          <div className="space-y-3">
            {hallOfShame.length === 0 ? (
              <div className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-lg">
                No violation patterns detected yet. Scans will populate this list as drafts are processed.
              </div>
            ) : (
              hallOfShame.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setSearchTerm(item.rule_code)}
                  title="Click to filter recent findings by this rule code"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 transition-all cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 group-hover:bg-[#006654] group-hover:text-white transition-colors">
                        {item.rule_code}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                      <span>Rejection by reviewers: <strong className="text-slate-700">{item.rejection_rate}</strong></span>
                      <span>·</span>
                      <span className="text-[#006654] underline group-hover:text-emerald-700 text-[10px]">Filter findings →</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full shadow-2xs">
                      {item.violation_count} flags
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Rule Fatigue Alerts */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Rule Fatigue & Feedback Alerts</h2>
            </div>
            <span className="text-[11px] text-slate-400">Reviewer pushback loops</span>
          </div>

          {ruleFatigue.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center">
              <div className="h-9 w-9 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-xs font-semibold text-slate-800">No rule fatigue detected</div>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Reviewers agree with automated rules. When rejection rate exceeds 35% on any rule, automated alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {ruleFatigue.map((rf, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
                      {rf.rule_code}
                    </span>
                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      {rf.rejection_rate} dismissal rate
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 mb-1">{rf.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">{rf.suggestion}</p>
                  <div className="text-[11px] font-medium text-amber-900 bg-white/70 p-2 rounded-lg border border-amber-100 flex items-center gap-1.5">
                    <span>💡 Action:</span>
                    <span>Consider loosening strictness in Knowledge Base rules.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Real-Time Findings Audit Feed */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#006654]" />
              <span>Real-Time Violations Feed</span>
              <span className="text-xs font-normal text-slate-400">({filteredFindings.length} displayed)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filterable stream of actual scan detections, explanations, and reviewer resolutions.
            </p>
          </div>

          {/* Search & Quick Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search phrase, explanation..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#006654] w-48 sm:w-56"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* Severity Filter */}
            <select
              value={activeSeverityFilter}
              onChange={(e) => setActiveSeverityFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>
          </div>
        </div>

        {/* Findings Feed List */}
        <div className="space-y-3">
          {filteredFindings.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              No scan findings match the selected filter criteria.
            </div>
          ) : (
            filteredFindings.map((f) => {
              const isSelected = selectedFeedFinding?.id === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFeedFinding(isSelected ? null : f)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#006654] bg-emerald-50/20 ring-1 ring-[#006654]'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          f.layer === 'facts'
                            ? 'bg-blue-100 text-blue-800'
                            : f.layer === 'terminology'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {f.layer}
                      </span>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          f.severity === 'high'
                            ? 'bg-rose-100 text-rose-800'
                            : f.severity === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {f.severity}
                      </span>

                      <span className="text-xs font-bold text-slate-900">
                        "{f.quoted_text || 'Flagged statement'}"
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                          f.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : f.status === 'rejected'
                            ? 'bg-slate-200 text-slate-700'
                            : f.status === 'edited'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        Status: {f.status}
                      </span>
                      {f.created_at && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(f.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                    {f.explanation}
                  </p>

                  {/* Dropdown inspection when clicked */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-slate-200/80 text-xs grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-lg border">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Suggested Fix</div>
                        <div className="text-emerald-700 font-semibold mt-0.5">
                          {f.suggested_fix || 'No automated replacement provided'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Final Decision / Override</div>
                        <div className="text-slate-800 font-medium mt-0.5">
                          {f.final_text ? `Custom edit: "${f.final_text}"` : `Marked as ${f.status}`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

