import React, { useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Download, Send, History, Sparkles, PlusCircle } from 'lucide-react';
import type { DocumentDetail, Finding, User } from '../services/api';
import { getExportUrl, submitDocument, getDocumentHistory, createFact, type DocumentHistoryItem } from '../services/api';

interface DocumentDetailViewProps {
  document: DocumentDetail;
  findings: Finding[];
  currentUser: User | null;
  onBack: () => void;
  onDecideFinding: (findingId: string, decision: 'accepted' | 'edited' | 'rejected', finalText?: string) => void;
  onRequestChanges: () => void;
  onApproveDocument: () => void;
}

export const DocumentDetailView: React.FC<DocumentDetailViewProps> = ({
  document,
  findings,
  currentUser,
  onBack,
  onDecideFinding,
  onRequestChanges,
  onApproveDocument,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'facts' | 'terminology' | 'tone' | 'accessibility'>('all');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    findings.length > 0 ? findings[0].id : null
  );
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<DocumentHistoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Fact Registration Modal (Admin inline capability)
  const [isAddFactModalOpen, setIsAddFactModalOpen] = useState(false);
  const [targetFindingForFact, setTargetFindingForFact] = useState<Finding | null>(null);
  const [newFactEntity, setNewFactEntity] = useState('');
  const [newFactAttribute, setNewFactAttribute] = useState('');
  const [newFactStatement, setNewFactStatement] = useState('');
  const [newFactValue, setNewFactValue] = useState('');
  const [newFactUnit, setNewFactUnit] = useState('');
  const [isSavingFact, setIsSavingFact] = useState(false);

  // RBAC Permission Gates:
  const canReview = currentUser?.role === 'reviewer' || currentUser?.role === 'admin';
  const canSubmit = currentUser?.role === 'creator' || currentUser?.role === 'admin';

  const handlePromptAdminForFact = (finding: Finding) => {
    setTargetFindingForFact(finding);
    // Parse entity & attribute from quoted text / explanation
    const quoted = finding.quoted_text || '';
    setNewFactEntity(document.title.split(' ')[0] || 'Brand Asset');
    setNewFactAttribute(quoted);
    setNewFactStatement(`The approved ${quoted} is specified as: `);
    setNewFactValue('');
    setNewFactUnit('');
    setIsAddFactModalOpen(true);
  };

  const handleSaveInlineFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFindingForFact) return;
    try {
      setIsSavingFact(true);
      await createFact({
        entity: newFactEntity.trim(),
        attribute: newFactAttribute.trim(),
        statement: newFactStatement.trim(),
        value_text: newFactValue.trim() || undefined,
        unit: newFactUnit.trim() || undefined,
        source_name: `Verified by ${currentUser?.full_name || 'Admin'} during document review`,
      });

      // Auto-update finding with the new verified value!
      onDecideFinding(
        targetFindingForFact.id,
        'edited',
        newFactValue.trim() ? `${newFactValue.trim()} ${newFactUnit.trim()}`.trim() : newFactStatement.trim()
      );
      setIsAddFactModalOpen(false);
      setTargetFindingForFact(null);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to register approved fact');
    } finally {
      setIsSavingFact(false);
    }
  };

  const handleOpenHistory = async () => {
    try {
      const logs = await getDocumentHistory(document.id);
      setHistoryLogs(logs);
      setIsHistoryOpen(true);
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const handleSubmitDraft = async () => {
    try {
      setIsSubmitting(true);
      await submitDocument(document.id);
      window.location.reload();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to submit document');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Counts & Progress
  const totalFindings = findings.length;
  const decidedFindings = findings.filter((f) => f.status !== 'open').length;
  const openFindingsCount = totalFindings - decidedFindings;
  const progressPercent = totalFindings === 0 ? 100 : Math.round((decidedFindings / totalFindings) * 100);

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'facts') return f.layer === 'facts';
    if (selectedCategory === 'terminology') return f.layer === 'terminology';
    if (selectedCategory === 'tone') return f.layer === 'tone';
    return false;
  });

  const layerCounts = {
    all: totalFindings,
    facts: findings.filter((f) => f.layer === 'facts').length,
    terminology: findings.filter((f) => f.layer === 'terminology').length,
    tone: findings.filter((f) => f.layer === 'tone').length,
    accessibility: 1, // sample placeholder pill from screenshot
  };

  const getStatusBadge = (status: string) => {
    if (status === 'in_review') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          In review
        </span>
      );
    }
    if (status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Approved
        </span>
      );
    }
    if (status === 'changes_requested') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-800 border border-orange-200">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          Changes requested
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Draft
      </span>
    );
  };

  // Render content block text with Exact Pink Box Grammarly Style Highlight
  const renderBlockText = (blockContent: string, blockId: string) => {
    const blockFindings = findings.filter((f) => f.block_id === blockId);
    if (!blockFindings.length) return <span>{blockContent}</span>;

    let elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Sort by start
    const sorted = [...blockFindings].sort((a, b) => (a.span_start ?? 0) - (b.span_start ?? 0));

    sorted.forEach((finding, idx) => {
      let start = finding.span_start;
      let end = finding.span_end;

      if ((start === undefined || start === null) && finding.quoted_text) {
        start = blockContent.indexOf(finding.quoted_text);
        if (start !== -1) end = start + finding.quoted_text.length;
      }

      if (start !== undefined && end !== undefined && start >= lastIndex && start < blockContent.length) {
        if (start > lastIndex) {
          elements.push(
            <span key={`plain-${idx}-${lastIndex}`}>
              {blockContent.substring(lastIndex, start)}
            </span>
          );
        }

        const isSelected = selectedFindingId === finding.id;

        // Clean pink border & background matching screenshot 3
        elements.push(
          <span
            key={`flag-${finding.id}`}
            onClick={() => setSelectedFindingId(finding.id)}
            className={`cursor-pointer px-1 py-0.5 rounded font-medium transition-all ${
              isSelected
                ? 'bg-rose-100 text-rose-950 border-2 border-slate-900 shadow-sm'
                : 'bg-rose-50 text-rose-900 border border-rose-300 hover:bg-rose-100'
            }`}
          >
            {blockContent.substring(start, end)}
          </span>
        );

        lastIndex = end;
      }
    });

    if (lastIndex < blockContent.length) {
      elements.push(<span key={`end-${lastIndex}`}>{blockContent.substring(lastIndex)}</span>);
    }

    return elements;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Top Back Nav Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 shadow-xs transition-all mb-4 group cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
        <span>← Back to Documents</span>
      </button>

      {/* Header Bar with Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight break-words max-w-full">
              {document.title}
            </h1>
            {getStatusBadge(document.status)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Version {document.version_no || 1} · scanned · {findings.length} findings detected
          </p>
        </div>

        {/* Action Buttons: Request changes vs Approve document */}
        <div className="flex items-center gap-2">
          {/* Export Clean Document */}
          <a
            href={getExportUrl(document.id)}
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export DOCX</span>
          </a>

          {/* Audit History */}
          <button
            onClick={handleOpenHistory}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-sm"
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span>Audit History</span>
          </button>

          {/* Creator Submit for review */}
          {canSubmit && document.status === 'draft' && (
            <button
              onClick={handleSubmitDraft}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#006654] hover:bg-[#005244] text-white font-medium text-xs transition-colors shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit for Review</span>
            </button>
          )}

          {/* Reviewer / Admin Action Buttons (Only active when in_review) */}
          {canReview && document.status === 'in_review' && (
            <>
              <button
                onClick={onRequestChanges}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-sm"
              >
                Request changes
              </button>

              <button
                onClick={onApproveDocument}
                disabled={openFindingsCount > 0}
                className="px-4 py-2 rounded-lg bg-[#006654] hover:bg-[#005244] text-white font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                Approve document
              </button>
            </>
          )}

          {canReview && document.status === 'draft' && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              Draft mode — Awaiting submission by creator
            </span>
          )}
        </div>
      </div>

      {/* Progress Metric Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
          <div className="text-xs font-bold text-slate-900">
            {decidedFindings} of {totalFindings} findings decided
          </div>
          <div className="text-xs text-slate-500 max-w-2xl text-left md:text-right">
            {openFindingsCount} findings are still open. Decide each one to unlock approval. The AI only suggests; every flag shows its source, and nothing is approved until a person approves it.
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-[#006654] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Content: Left Draft Text, Right Findings Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Draft text */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <h2 className="text-sm font-bold text-slate-900">Draft text</h2>
            <span className="text-xs text-slate-400">
              Highlighted phrases have a finding. Select one to see it.
            </span>
          </div>

          <div className="space-y-6">
            {document.blocks.map((block, idx) => {
              const bType = (block.block_type || 'paragraph').toLowerCase();

              // Special handling for image blocks as shown in Screenshot 3
              if (block.content.includes('Image:') || block.content.includes('.png')) {
                return (
                  <div key={block.id} className="flex gap-4 items-start">
                    <span className="text-xs font-mono text-slate-300 w-5 pt-1 text-right select-none">
                      {idx + 1}
                    </span>
                    <div className="flex-1 border border-dashed border-emerald-300 bg-emerald-50/40 rounded-lg p-3 text-xs text-emerald-800 font-mono">
                      Image: phone-front.png
                    </div>
                  </div>
                );
              }

              if (bType === 'heading' || idx === 0) {
                return (
                  <div key={block.id} className="flex gap-4 items-start">
                    <span className="text-xs font-mono text-slate-300 w-5 pt-1 text-right select-none shrink-0">
                      {idx + 1}
                    </span>
                    <h3 className="flex-1 font-bold text-base text-slate-900 break-words overflow-hidden leading-snug">
                      {renderBlockText(block.content, block.id)}
                    </h3>
                  </div>
                );
              }

              return (
                <div key={block.id} className="flex gap-4 items-start">
                  <span className="text-xs font-mono text-slate-300 w-5 pt-1 text-right select-none shrink-0">
                    {idx + 1}
                  </span>
                  <p className="flex-1 text-sm text-slate-800 leading-relaxed break-words overflow-hidden">
                    {renderBlockText(block.content, block.id)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Findings Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900">Findings</h2>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All · {layerCounts.all}
            </button>
            <button
              onClick={() => setSelectedCategory('facts')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCategory === 'facts'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Facts · {layerCounts.facts}
            </button>
            <button
              onClick={() => setSelectedCategory('terminology')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCategory === 'terminology'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Terminology · {layerCounts.terminology}
            </button>
            <button
              onClick={() => setSelectedCategory('tone')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCategory === 'tone'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Tone · {layerCounts.tone}
            </button>
            <button
              onClick={() => setSelectedCategory('accessibility')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCategory === 'accessibility'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Accessibility · 1
            </button>
          </div>

          {/* Findings Cards List */}
          <div className="space-y-4">
            {filteredFindings.map((finding) => {
              const isSelected = selectedFindingId === finding.id;
              const isDecided = finding.status !== 'open';

              return (
                <div
                  key={finding.id}
                  onClick={() => setSelectedFindingId(finding.id)}
                  className={`bg-white rounded-xl p-5 border transition-all cursor-pointer shadow-sm ${
                    isSelected
                      ? 'border-slate-800 ring-1 ring-slate-800'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Tags */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700">
                      {finding.layer === 'facts' ? 'Facts and claims' : finding.layer === 'terminology' ? 'Terminology' : 'Tone'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800">
                      {finding.severity || 'Medium'} severity
                    </span>
                    {finding.verdict && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 capitalize">
                        {finding.verdict}
                      </span>
                    )}
                  </div>

                  {/* Quoted Text */}
                  <h3 className="text-sm font-bold text-slate-900 mb-2">
                    "{finding.quoted_text}"
                  </h3>

                  {/* Explanation */}
                  <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                    {finding.explanation}
                  </p>

                  {/* Source Box */}
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs mb-3">
                    <div className="text-[11px] text-slate-400 font-medium">Source · Product spec v3, page 2</div>
                    <div className="text-slate-700 mt-0.5 font-medium">
                      "{finding.citation || 'Approved brand guidelines'}"
                    </div>
                  </div>

                  {/* Suggested fix */}
                  <div className="text-xs text-slate-700 mb-4">
                    <span className="font-semibold text-slate-900">Suggested fix: </span>
                    <span className={finding.suggested_fix?.includes('Pending official specification') ? 'text-amber-800 font-medium' : ''}>
                      {finding.final_text || finding.suggested_fix || 'Remove phrase'}
                    </span>
                  </div>

                  {/* Admin Inline Fact Definition Callout */}
                  {(finding.verdict === 'unverified' || finding.suggested_fix?.includes('Pending official specification')) && !isDecided && (
                    <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50/70 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                        <Sparkles className="h-3.5 w-3.5 text-amber-700" />
                        <span>Unverified in Knowledge Base</span>
                      </div>
                      <p className="text-amber-800 text-[11px] mb-2 leading-relaxed">
                        This claim is not yet registered in company facts. Admin can define it right now to enrich brand memory.
                      </p>
                      {currentUser?.role === 'admin' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePromptAdminForFact(finding);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-900 hover:bg-amber-800 text-white font-semibold text-[11px] shadow-2xs transition-colors"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          <span>Define & Approve Fact</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-amber-700 font-medium italic">
                          (Ask an Admin to approve this fact, or use 'Edit' to provide manual correction)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Decision Action Buttons */}
                  {canReview && (
                    <div className="pt-3 border-t border-slate-100">
                      {editingFindingId === finding.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full text-xs p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFindingId(null);
                              }}
                              className="text-xs text-slate-500 px-2 py-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDecideFinding(finding.id, 'edited', editText);
                                setEditingFindingId(null);
                              }}
                              className="text-xs bg-slate-800 text-white px-3 py-1 rounded font-medium"
                            >
                              Save fix
                            </button>
                          </div>
                        </div>
                      ) : isDecided ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                            <Check className="h-4 w-4" />
                            {finding.status === 'accepted' ? 'Accepted by you' : finding.status === 'edited' ? 'Edited by you' : 'Rejected'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDecideFinding(finding.id, 'rejected');
                            }}
                            className="text-slate-500 hover:text-slate-800 font-medium underline flex items-center gap-1"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Undo</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDecideFinding(finding.id, 'accepted');
                            }}
                            className="px-4 py-1.5 rounded-lg bg-[#006654] hover:bg-[#005244] text-white font-medium text-xs transition-colors shadow-sm"
                          >
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFindingId(finding.id);
                              setEditText(finding.final_text || finding.suggested_fix || finding.quoted_text || '');
                            }}
                            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDecideFinding(finding.id, 'rejected');
                            }}
                            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-sm"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
      {/* Modal: Audit History */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Document Audit Trail</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete verifiable lifecycle log for <span className="font-semibold text-slate-800">"{document.title}"</span>
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {historyLogs.length} Events
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
              {historyLogs.length === 0 ? (
                <div className="text-xs text-slate-400 py-12 text-center">No audit trail logged yet for this draft.</div>
              ) : (
                historyLogs.map((log, idx) => {
                  // Format human-readable event label & badge color
                  let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200';
                  let actionTitle = log.action;
                  let description = '';

                  switch (log.action) {
                    case 'document.submitted':
                      badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';
                      actionTitle = 'Submitted for Review';
                      description = 'Draft was formally submitted to reviewers for brand governance sign-off.';
                      break;
                    case 'document.approved':
                      badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      actionTitle = 'Document Approved';
                      description = 'All findings decided and version signed off by reviewer.';
                      break;
                    case 'document.changes_requested':
                      badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                      actionTitle = 'Changes Requested';
                      description = 'Reviewer requested revisions before re-scanning.';
                      break;
                    case 'scan.started':
                      badgeBg = 'bg-cyan-50 text-cyan-700 border-cyan-200';
                      actionTitle = 'AI Scan Initiated';
                      description = '3-layer scan (Terminology, Facts, Tone) queued for evaluation.';
                      break;
                    case 'scan.finished':
                      badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      actionTitle = 'AI Scan Completed';
                      description = 'Scan successfully finished and findings generated.';
                      break;
                    case 'scan.failed':
                      badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
                      actionTitle = 'AI Scan Failed';
                      description = 'Scan encountered an issue during execution.';
                      break;
                    case 'finding.accepted':
                      badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      actionTitle = 'Fix Accepted';
                      description = `Suggested correction accepted in ${log.details?.layer || 'content'}.`;
                      break;
                    case 'finding.edited':
                      badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                      actionTitle = 'Fix Edited';
                      description = 'Custom replacement text provided by reviewer.';
                      break;
                    case 'finding.rejected':
                      badgeBg = 'bg-slate-100 text-slate-700 border-slate-300';
                      actionTitle = 'Finding Dismissed';
                      description = `Flag dismissed by reviewer (${log.details?.layer || 'guideline'}).`;
                      break;
                  }

                  return (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-all text-xs shadow-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-[11px] px-2.5 py-0.5 rounded-full border ${badgeBg}`}>
                            {actionTitle}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {log.action}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {new Date(log.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <p className="text-slate-600 text-xs mb-2 leading-relaxed">
                        {description}
                      </p>

                      {/* Actor Information & Details */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span>By:</span>
                          <span className="font-semibold text-slate-800">
                            {log.actor ? `${log.actor.name} (${log.actor.role})` : 'System Engine'}
                          </span>
                        </div>

                        {log.details?.version_id && (
                          <span className="font-mono text-[10px] text-slate-400">
                            ver: {String(log.details.version_id).substring(0, 8)}...
                          </span>
                        )}
                        {log.details?.previous_status && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {log.details.previous_status} → {log.action.split('.')[1]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end mt-4">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Close Trail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Admin Inline Fact Registration */}
      {isAddFactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">Define Verified Company Fact</h3>
            </div>
            <p className="text-slate-500 text-[11px] mb-4">
              Registering this fact permanently enriches the company knowledge base and resolves this unverified claim.
            </p>

            <form onSubmit={handleSaveInlineFact} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entity / Product</label>
                  <input
                    type="text"
                    required
                    value={newFactEntity}
                    onChange={(e) => setNewFactEntity(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Attribute Name</label>
                  <input
                    type="text"
                    required
                    value={newFactAttribute}
                    onChange={(e) => setNewFactAttribute(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Fact Statement *</label>
                <textarea
                  required
                  rows={2}
                  value={newFactStatement}
                  onChange={(e) => setNewFactStatement(e.target.value)}
                  placeholder="e.g. Phone X primary background color is Midnight Navy (#162338)."
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Approved Value</label>
                  <input
                    type="text"
                    value={newFactValue}
                    onChange={(e) => setNewFactValue(e.target.value)}
                    placeholder="e.g. Midnight Navy (#162338)"
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit / Format (Optional)</label>
                  <input
                    type="text"
                    value={newFactUnit}
                    onChange={(e) => setNewFactUnit(e.target.value)}
                    placeholder="HEX, mAh, W"
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddFactModalOpen(false)}
                  className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingFact}
                  className="px-4 py-2 rounded bg-amber-900 hover:bg-amber-800 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSavingFact ? 'Saving Fact...' : 'Save & Resolve Finding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
