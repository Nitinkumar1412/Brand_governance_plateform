import React, { useState } from 'react';
import {
  Play,
  Download,
  Check,
  X,
  Edit2,
  Sparkles,
  BookOpen,
  Scale,
  MessageSquare,
  Layers,
  ArrowRight,
  ShieldCheck,
  Send,
  Lock
} from 'lucide-react';
import type { Finding, ScanPollResult, User } from '../services/api';
import { getExportUrl } from '../services/api';

interface InspectorSidebarProps {
  documentId: string | null;
  scanResult: ScanPollResult | null;
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
  onDecideFinding: (findingId: string, decision: 'accepted' | 'edited' | 'rejected' | 'open', finalText?: string) => void;
  onTriggerScan: () => void;
  onSubmitDocument?: () => void;
  onApproveDocument?: () => void;
  isScanning: boolean;
  currentUser: User | null;
  documentStatus?: string;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  documentId,
  scanResult,
  findings,
  selectedFindingId,
  onSelectFinding,
  onDecideFinding,
  onTriggerScan,
  onSubmitDocument,
  onApproveDocument,
  isScanning,
  currentUser,
  documentStatus = 'draft',
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'terminology' | 'facts' | 'tone'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // RBAC Permission Gates:
  // Reviewer & Admin can decide findings and give final approval
  const canReview = currentUser?.role === 'reviewer' || currentUser?.role === 'admin';
  const canApprove = currentUser?.role === 'reviewer' || currentUser?.role === 'admin';
  const canSubmit = currentUser?.role === 'creator' || currentUser?.role === 'admin';

  // Compliance score from scan
  const score = scanResult?.counts?.compliance?.score ?? 100;
  const grade = scanResult?.counts?.compliance?.grade ?? 'A';
  const isPublishable = scanResult?.counts?.compliance?.is_publishable ?? false;

  // Filtered findings
  const filteredFindings = findings.filter((f) => {
    if (activeTab === 'all') return true;
    return f.layer === activeTab;
  });

  const layerCounts = {
    all: findings.length,
    terminology: findings.filter((f) => f.layer === 'terminology').length,
    facts: findings.filter((f) => f.layer === 'facts').length,
    tone: findings.filter((f) => f.layer === 'tone').length,
  };

  const handleStartEdit = (finding: Finding) => {
    setEditingId(finding.id);
    setEditText(finding.final_text || finding.suggested_fix || finding.quoted_text || '');
  };

  const handleSaveEdit = (findingId: string) => {
    onDecideFinding(findingId, 'edited', editText);
    setEditingId(null);
  };

  return (
    <aside className="w-96 flex flex-col h-full border-l border-surface-border bg-surface/80 backdrop-blur-md">
      
      {/* 1. Score & Governance Status (National Mining Museum Editorial Header) */}
      <div className="p-5 border-b border-surface-border bg-surface-elevated/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Brand Compliance
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-serif text-3xl font-bold text-brand-light">
                {score}
              </span>
              <span className="text-xs text-neutral-400 font-mono">/ 100</span>
              <span
                className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full uppercase border ${
                  grade === 'A'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : grade === 'B'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                Grade {grade}
              </span>
            </div>
          </div>

          {/* Trigger Scan Button */}
          <button
            onClick={onTriggerScan}
            disabled={isScanning || !documentId}
            className="flex items-center gap-1.5 rounded-lg bg-brand-copper px-3 py-2 text-xs font-semibold text-brand-light hover:bg-brand-amber transition-all shadow-glow-copper disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? `${scanResult?.progress ?? 0}%` : 'Run Scan'}</span>
          </button>
        </div>

        {/* Scan Progress Bar */}
        {isScanning && (
          <div className="w-full bg-surface-border rounded-full h-1.5 overflow-hidden mb-3">
            <div
              className="bg-brand-amber h-full transition-all duration-300"
              style={{ width: `${scanResult?.progress ?? 15}%` }}
            />
          </div>
        )}

        {/* RBAC Governance Actions (Submit vs Approve) */}
        <div className="space-y-2">
          {documentId && (
            <a
              href={getExportUrl(documentId)}
              download
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-brand-copper/50 hover:text-brand-light transition-all"
            >
              <Download className="h-3.5 w-3.5 text-brand-amber" />
              <span>Export Clean Document (.docx)</span>
            </a>
          )}

          {/* Creator action: Submit to Review */}
          {canSubmit && documentStatus === 'draft' && documentId && (
            <button
              onClick={onSubmitDocument}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-brand-amber/30 bg-brand-amber/10 px-3 py-1.5 text-xs font-semibold text-brand-amber hover:bg-brand-amber/20 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit Draft for Review</span>
            </button>
          )}

          {/* Reviewer / Admin action: Final Approval */}
          {canApprove && documentStatus === 'in_review' && (
            <button
              onClick={onApproveDocument}
              disabled={!isPublishable}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title={isPublishable ? 'Approve document for publishing' : 'Resolve all findings before approving'}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isPublishable ? 'Approve Document' : 'Approval Locked (Resolve Flags)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Layer Filter Tabs */}
      <div className="flex border-b border-surface-border px-3 bg-surface/50 text-xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
            activeTab === 'all'
              ? 'border-brand-amber text-brand-light'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>All ({layerCounts.all})</span>
        </button>

        <button
          onClick={() => setActiveTab('terminology')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
            activeTab === 'terminology'
              ? 'border-ink-terminology text-rose-300'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-ink-terminology" />
          <span>Terms ({layerCounts.terminology})</span>
        </button>

        <button
          onClick={() => setActiveTab('facts')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
            activeTab === 'facts'
              ? 'border-ink-facts text-amber-300'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Scale className="h-3.5 w-3.5 text-ink-facts" />
          <span>Facts ({layerCounts.facts})</span>
        </button>

        <button
          onClick={() => setActiveTab('tone')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium transition-all ${
            activeTab === 'tone'
              ? 'border-ink-tone text-indigo-300'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5 text-ink-tone" />
          <span>Tone ({layerCounts.tone})</span>
        </button>
      </div>

      {/* 3. Findings Cards List (Grammarly Suggestion Cards) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredFindings.length === 0 ? (
          <div className="text-center py-12 text-xs text-neutral-500">
            <Sparkles className="h-6 w-6 text-neutral-600 mx-auto mb-2" />
            No flags detected in this category.
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isSelected = selectedFindingId === finding.id;
            const isResolved = finding.status !== 'open';

            let tagColor = 'text-rose-400 border-rose-500/20 bg-rose-500/10';
            if (finding.layer === 'facts') tagColor = 'text-amber-400 border-amber-500/20 bg-amber-500/10';
            if (finding.layer === 'tone') tagColor = 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10';

            return (
              <div
                key={finding.id}
                onClick={() => onSelectFinding(finding.id)}
                className={`rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'border-brand-copper/60 bg-surface-elevated shadow-glow-card'
                    : 'border-surface-border bg-surface/60 hover:border-surface-border/80 hover:bg-surface'
                } ${isResolved ? 'opacity-50' : ''}`}
              >
                {/* Header: Layer Pill & Status */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${tagColor}`}>
                    {finding.layer}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400 capitalize">
                    {finding.status}
                  </span>
                </div>

                {/* Quoted Text & Fix */}
                <div className="mb-2">
                  <div className="text-xs text-neutral-400 line-through">
                    "{finding.quoted_text}"
                  </div>
                  {finding.suggested_fix && (
                    <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      <span>{finding.suggested_fix}</span>
                    </div>
                  )}
                </div>

                {/* Explanation */}
                <p className="text-xs text-neutral-300 leading-relaxed mb-3">
                  {finding.explanation}
                </p>

                {/* Citation */}
                {finding.citation && (
                  <div className="text-[10px] text-neutral-400 font-mono bg-surface-elevated px-2 py-1 rounded border border-surface-border mb-3 truncate">
                    📜 {finding.citation}
                  </div>
                )}

                {/* Inline Editing Mode */}
                {editingId === finding.id ? (
                  <div className="space-y-2 pt-2 border-t border-surface-border">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full rounded bg-background px-2.5 py-1.5 text-xs text-neutral-200 border border-surface-border focus:border-brand-amber focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(finding.id)}
                        className="rounded bg-brand-copper px-2.5 py-1 text-[11px] font-semibold text-brand-light"
                      >
                        Save Fix
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons: RBAC Check (Only Reviewer & Admin can decide, Creator sees read-only info) */
                  !isResolved && (
                    <div className="flex items-center justify-between pt-2 border-t border-surface-border">
                      {canReview ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDecideFinding(finding.id, 'accepted');
                            }}
                            className="flex items-center gap-1 rounded px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-all"
                          >
                            <Check className="h-3 w-3" />
                            <span>Accept</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(finding);
                            }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-400 hover:bg-surface-elevated transition-all"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDecideFinding(finding.id, 'rejected');
                            }}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-all"
                          >
                            <X className="h-3 w-3" />
                            <span>Dismiss</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono py-1">
                          <Lock className="h-3 w-3 text-neutral-600" />
                          <span>Reviewer decision required</span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            );
          })
        )}
      </div>

    </aside>
  );
};
