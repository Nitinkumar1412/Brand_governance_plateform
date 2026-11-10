import React from 'react';
import { X, Flame, AlertTriangle } from 'lucide-react';
import type { BrandDrift } from '../services/api';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BrandDrift | null;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-surface-border bg-surface p-8 shadow-2xl overflow-hidden">
        
        {/* Glow backdrop */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand-copper/10 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-6 border-b border-surface-border">
          <div>
            <h2 className="font-serif text-2xl font-bold text-brand-light tracking-wide">
              Brand Drift & Executive Governance Analytics
            </h2>
            <p className="text-xs text-neutral-400 mt-1 font-sans">
              Organizational compliance trends, rule fatigue, and violation frequency
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-surface-elevated hover:text-neutral-200 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-3 gap-4 my-6">
          <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
            <span className="text-[11px] font-mono uppercase text-neutral-400">Total Flags</span>
            <div className="font-serif text-3xl font-bold text-brand-light mt-1">
              {data.summary.total_violations_flagged}
            </div>
            <span className="text-[10px] text-neutral-500">Across all scanned drafts</span>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
            <span className="text-[11px] font-mono uppercase text-neutral-400">Alignment Rate</span>
            <div className="font-serif text-3xl font-bold text-emerald-400 mt-1">
              {data.summary.brand_alignment_rate}%
            </div>
            <span className="text-[10px] text-neutral-500">Reviewer accepted ratio</span>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
            <span className="text-[11px] font-mono uppercase text-neutral-400">Layer Split</span>
            <div className="flex items-center gap-2 mt-2 text-xs font-mono">
              <span className="text-rose-400 font-semibold">{data.summary.violations_by_layer.terminology || 0} Terms</span>
              <span className="text-neutral-600">•</span>
              <span className="text-amber-400 font-semibold">{data.summary.violations_by_layer.facts || 0} Facts</span>
              <span className="text-neutral-600">•</span>
              <span className="text-indigo-400 font-semibold">{data.summary.violations_by_layer.tone || 0} Tone</span>
            </div>
            <span className="text-[10px] text-neutral-500">Distribution of issues</span>
          </div>
        </div>

        {/* Hall of Shame & Fatigue Alerts Split */}
        <div className="grid grid-cols-2 gap-6">
          
          {/* Hall of Shame */}
          <div className="rounded-xl border border-surface-border bg-surface-elevated/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-rose-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                Top Violated Guidelines (Hall of Shame)
              </h3>
            </div>

            {data.hall_of_shame.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4 text-center">No recurring violations recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.hall_of_shame.map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-xs p-2 rounded bg-surface border border-surface-border">
                    <div>
                      <span className="font-mono text-[10px] text-brand-amber font-semibold">{r.rule_code}</span>
                      <p className="text-neutral-300 truncate max-w-[200px]">{r.title}</p>
                    </div>
                    <span className="font-mono font-bold text-rose-400">{r.violation_count}x</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Rule Fatigue Alerts */}
          <div className="rounded-xl border border-surface-border bg-surface-elevated/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                Rule Fatigue Alerts (False Positives)
              </h3>
            </div>

            {data.rule_fatigue_alerts.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4 text-center">Guidelines well-calibrated (rejection rate &lt; 35%).</p>
            ) : (
              <ul className="space-y-2">
                {data.rule_fatigue_alerts.map((f, i) => (
                  <li key={i} className="text-xs p-2 rounded bg-surface border border-surface-border">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-brand-amber">{f.rule_code}</span>
                      <span className="text-rose-400 font-semibold">{f.rejection_rate} Rejected</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">{f.suggestion}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
