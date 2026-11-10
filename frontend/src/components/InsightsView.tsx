import React, { useState, useEffect } from 'react';
import { ShieldAlert, Award } from 'lucide-react';
import { getBrandDrift, type BrandDrift } from '../services/api';

export const InsightsView: React.FC = () => {
  const [data, setData] = useState<BrandDrift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrandDrift()
      .then((d) => setData(d))
      .catch((e) => console.error('Failed to load insights:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center text-slate-500 text-sm">
        Loading real-time analytics...
      </div>
    );
  }

  const summary = data?.summary || {
    total_violations_flagged: 0,
    brand_alignment_rate: 100,
    violations_by_layer: { terminology: 0, facts: 0, tone: 0 },
    reviewer_decisions: { open: 0, accepted: 0, edited: 0, rejected: 0 },
  };

  const hallOfShame = data?.hall_of_shame || [];
  const ruleFatigue = data?.rule_fatigue_alerts || [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Brand Insights & Drift</h1>
        <p className="text-sm text-slate-500 mt-1">
          Automated governance metrics, reviewer feedback loops, and rule fatigue monitoring.
        </p>
      </div>

      {/* 4 Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Brand Alignment Rate</div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">{summary.brand_alignment_rate}%</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Violations Flagged</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{summary.total_violations_flagged}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Fixes Accepted</div>
          <div className="text-3xl font-bold text-[#006654] mt-2">{summary.reviewer_decisions?.accepted || 0}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Dismissed by Reviewers</div>
          <div className="text-3xl font-bold text-amber-600 mt-2">{summary.reviewer_decisions?.rejected || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Hall of Shame: Top Flagged Rules */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-4 w-4 text-rose-500" />
            <h2 className="text-base font-bold text-slate-900">Most Frequently Violated Guidelines</h2>
          </div>

          <div className="space-y-3">
            {hallOfShame.length === 0 ? (
              <div className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-lg">
                No violation patterns detected yet. Scans will populate this list as drafts are processed.
              </div>
            ) : (
              hallOfShame.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {item.rule_code}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Rejection rate by reviewers: {item.rejection_rate}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
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
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Rule Fatigue & Feedback Alerts</h2>
          </div>

          {ruleFatigue.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center">No rule fatigue detected. Reviewers agree with automated rules.</div>
          ) : (
            <div className="space-y-4">
              {ruleFatigue.map((rf, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-amber-200 bg-amber-50/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-900">
                      {rf.rule_code}
                    </span>
                    <span className="text-xs font-semibold text-rose-700">
                      {rf.rejection_rate} rejection rate
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 mb-1">{rf.title}</div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">{rf.suggestion}</p>
                  <div className="text-[11px] font-medium text-amber-900">
                    💡 Recommended action: Tune guideline wording or demote severity to low.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

