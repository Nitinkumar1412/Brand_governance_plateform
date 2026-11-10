import React, { useState } from 'react';
import { Plus, FileText, ArrowUpRight, Loader2 } from 'lucide-react';
import type { DocumentListItem } from '../services/api';

interface DocumentsListViewProps {
  documents: DocumentListItem[];
  onOpenDocument: (docId: string) => Promise<void> | void;
  onNewDocument: () => void;
  canCreate: boolean;
}

export const DocumentsListView: React.FC<DocumentsListViewProps> = ({
  documents,
  onOpenDocument,
  onNewDocument,
  canCreate,
}) => {
  const [filter, setFilter] = useState<'all' | 'draft' | 'in_review' | 'changes_requested' | 'approved'>('all');
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  // Metric counts
  const waitingForReview = documents.filter((d) => d.status === 'in_review').length;
  const changesRequested = documents.filter((d) => d.status === 'changes_requested').length;
  const approved = documents.filter((d) => d.status === 'approved').length;
  const draftsAndScanning = documents.filter((d) => d.status === 'draft' || d.status === 'scanning').length;

  const filteredDocs = documents.filter((d) => {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  const handleDocClick = async (docId: string) => {
    if (openingDocId) return; // Prevent concurrent requests
    setOpeningDocId(docId);
    try {
      await onOpenDocument(docId);
    } catch (err) {
      console.error('Error opening document:', err);
    } finally {
      setOpeningDocId(null);
    }
  };

  const getStatusBadge = (doc: DocumentListItem) => {
    if (doc.status === 'scanning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          Scanning{doc.scan_progress ? `, ${doc.scan_progress}%` : ''}
        </span>
      );
    }
    if (doc.status === 'in_review') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          In review
        </span>
      );
    }
    if (doc.status === 'changes_requested') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-800 border border-orange-200">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
          Changes requested
        </span>
      );
    }
    if (doc.status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Approved
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

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) return 'Just now';
      if (diffHours < 24) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Title & Top Action Bar */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Documents</h1>
          <p className="text-sm text-slate-500 mt-1">
            Drafts that were scanned against Acme Mobile's guidelines, and where each one stands.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={onNewDocument}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#006654] hover:bg-[#005244] text-white font-medium text-sm transition-all shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New document</span>
          </button>
        )}
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Waiting for review</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{waitingForReview}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Changes requested</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{changesRequested}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Approved</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{approved}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Drafts and scanning</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{draftsAndScanning}</div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { key: 'all', label: 'All' },
          { key: 'draft', label: 'Draft' },
          { key: 'in_review', label: 'In review' },
          { key: 'changes_requested', label: 'Changes requested' },
          { key: 'approved', label: 'Approved' },
        ].map((item) => {
          const isActive = filter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setFilter(item.key as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
        {/* Subtle Top Loading Line when a document is opening */}
        {openingDocId && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-100 overflow-hidden z-10">
            <div className="h-full bg-[#006654] animate-pulse w-full" />
          </div>
        )}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-6">Title</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4">Findings</th>
              <th className="py-3 px-4">Updated</th>
              <th className="py-3 px-4">Creator</th>
              <th className="py-3 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                  <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  No documents found in this category.
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => {
                const isOpeningThis = openingDocId === doc.id;

                return (
                  <tr
                    key={doc.id}
                    onClick={() => handleDocClick(doc.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-6 font-semibold text-slate-900 group-hover:text-[#006654] transition-colors">
                      {doc.title}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(doc)}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-500">v{doc.version_no}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {doc.status === 'scanning'
                        ? 'In progress'
                        : doc.total_findings === 0 && doc.status === 'draft'
                        ? 'Not scanned yet'
                        : `${doc.open_findings} open of ${doc.total_findings}`}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{formatRelativeTime(doc.updated_at)}</td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">{doc.creator_name}</td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDocClick(doc.id);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold shadow-2xs transition-all ${
                          isOpeningThis
                            ? 'bg-[#006654] text-white border-[#006654]'
                            : 'border-slate-200 bg-white hover:bg-[#006654] hover:text-white hover:border-[#006654] text-slate-700 group-hover:border-slate-300'
                        }`}
                      >
                        {isOpeningThis ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                            <span>Opening...</span>
                          </>
                        ) : (
                          <>
                            <span>Inspect & Review</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
