import { useState, useEffect } from 'react';
import { BrandHeader } from './components/BrandHeader';
import { DocumentsListView } from './components/DocumentsListView';
import { NewDocumentView } from './components/NewDocumentView';
import { DocumentDetailView } from './components/DocumentDetailView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { InsightsView } from './components/InsightsView';
import { AuthModal } from './components/AuthModal';
import {
  type User,
  type DocumentListItem,
  type DocumentDetail,
  type Finding,
  getDocumentsList,
  getDocument,
  getFindings,
  decideFinding,
  requestChanges,
  approveDocument,
  getMe,
  logoutUser,
} from './services/api';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Navigation state: 'list' | 'new' | 'detail'
  const [currentView, setCurrentView] = useState<'list' | 'new' | 'detail'>('list');
  const [currentTab, setCurrentTab] = useState<'documents' | 'knowledge' | 'insights'>('documents');

  // Document states
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [currentDocDetail, setCurrentDocDetail] = useState<DocumentDetail | null>(null);
  const [currentFindings, setCurrentFindings] = useState<Finding[]>([]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Auth Initialization on page mount
  useEffect(() => {
    const token = localStorage.getItem('inkloom_token');
    if (token) {
      getMe()
        .then((user) => {
          setCurrentUser(user);
          setAuthInitialized(true);
        })
        .catch(() => {
          logoutUser();
          setCurrentUser(null);
          setIsAuthOpen(true);
          setAuthInitialized(true);
        });
    } else {
      setIsAuthOpen(true);
      setAuthInitialized(true);
    }
  }, []);

  // Fetch documents list whenever user logs in or returns to 'list' view
  const fetchDocuments = async () => {
    if (!currentUser) return;
    try {
      const list = await getDocumentsList();
      setDocuments(list);
    } catch (e) {
      console.error('Failed to load documents list:', e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDocuments();
    }
  }, [currentUser, currentView]);

  // Handle open document detail
  const handleOpenDocument = async (docId: string) => {
    try {
      setSelectedDocId(docId);
      const doc = await getDocument(docId);
      const findings = await getFindings(docId);
      setCurrentDocDetail(doc);
      setCurrentFindings(findings);
      setCurrentView('detail');
    } catch (e) {
      console.error('Failed to load document detail:', e);
      showToast('Failed to open document detail');
    }
  };

  // Handle finding decision (Accept, Edit, Reject)
  const handleDecideFinding = async (
    findingId: string,
    decision: 'accepted' | 'edited' | 'rejected',
    finalText?: string
  ) => {
    if (!currentUser || (currentUser.role !== 'reviewer' && currentUser.role !== 'admin')) {
      showToast('Action forbidden: Only Reviewers and Admins can decide findings.');
      return;
    }

    try {
      await decideFinding(findingId, decision, finalText);

      setCurrentFindings((prev) =>
        prev.map((f) =>
          f.id === findingId
            ? { ...f, status: decision, final_text: finalText || f.final_text }
            : f
        )
      );

      // Replace text inline in currentDocDetail if accepted or edited
      const targetFinding = currentFindings.find((f) => f.id === findingId);
      const replacement = finalText || targetFinding?.suggested_fix;
      const original = targetFinding?.quoted_text;

      if (replacement && original && targetFinding?.block_id) {
        setCurrentDocDetail((prevDoc) => {
          if (!prevDoc) return prevDoc;
          return {
            ...prevDoc,
            blocks: prevDoc.blocks.map((b) => {
              if (b.id === targetFinding.block_id && b.content.includes(original)) {
                return {
                  ...b,
                  content: b.content.replace(original, replacement),
                };
              }
              return b;
            }),
          };
        });
      }

      showToast(
        decision === 'accepted'
          ? `✓ Accepted: "${replacement}"`
          : decision === 'edited'
          ? `✓ Edited: "${finalText}"`
          : `Dismissed flag`
      );
    } catch (e) {
      console.error('Failed to decide finding:', e);
      showToast('Failed to update finding');
    }
  };

  // Handle request changes (Reviewer / Admin)
  const handleRequestChanges = async () => {
    if (!selectedDocId) return;
    try {
      const res = await requestChanges(selectedDocId);
      setCurrentDocDetail((prev) => prev ? { ...prev, status: res.status } : prev);
      showToast('✓ Document status updated: Changes requested');
      fetchDocuments();
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'Failed to request changes');
    }
  };

  // Handle approve document (Reviewer / Admin)
  const handleApproveDocument = async () => {
    if (!selectedDocId) return;
    try {
      const res = await approveDocument(selectedDocId);
      setCurrentDocDetail((prev) => prev ? { ...prev, status: res.status } : prev);
      showToast('🎉 Document approved successfully!');
      fetchDocuments();
    } catch (err: any) {
      showToast(err?.response?.data?.detail || 'All findings must be decided before approving.');
    }
  };

  // Logout handler
  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setCurrentView('list');
    setIsAuthOpen(true);
    showToast('Signed out of workspace.');
  };

  // Tab switch handler
  const handleTabChange = (tab: 'documents' | 'knowledge' | 'insights') => {
    setCurrentTab(tab);
    if (tab === 'documents') {
      setCurrentView('list');
    }
  };

  if (!authInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-sans text-sm">
        Loading Brand Governance Workspace...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      {/* 1. Top Navbar matching exact Brand Governance screenshot design */}
      <BrandHeader
        currentTab={currentTab}
        onTabChange={handleTabChange}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* 2. Main Page Views */}
      <main className="flex-1 pb-16">
        {currentTab === 'documents' && (
          <>
            {currentView === 'list' && (
              <DocumentsListView
                documents={documents}
                onOpenDocument={handleOpenDocument}
                onNewDocument={() => setCurrentView('new')}
                canCreate={currentUser?.role === 'creator' || currentUser?.role === 'admin'}
              />
            )}

            {currentView === 'new' && (
              <NewDocumentView
                onBack={() => setCurrentView('list')}
                onScanComplete={handleOpenDocument}
              />
            )}

            {currentView === 'detail' && currentDocDetail && (
              <DocumentDetailView
                document={currentDocDetail}
                findings={currentFindings}
                currentUser={currentUser}
                onBack={() => setCurrentView('list')}
                onDecideFinding={handleDecideFinding}
                onRequestChanges={handleRequestChanges}
                onApproveDocument={handleApproveDocument}
              />
            )}
          </>
        )}

        {currentTab === 'knowledge' && (
          <KnowledgeBaseView canManage={currentUser?.role === 'admin'} />
        )}

        {currentTab === 'insights' && (
          <InsightsView />
        )}
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-medium shadow-2xl animate-fade-in border-l-4 border-l-emerald-500">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Role-Based Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          if (currentUser) setIsAuthOpen(false);
        }}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthOpen(false);
          showToast(`Signed in as ${user.full_name || user.email} (${user.role.toUpperCase()})`);
        }}
      />
    </div>
  );
}

export default App;
