import React, { useState, useRef } from 'react';
import { ArrowLeft, FileText, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { uploadDocument, triggerScan, pollScan } from '../services/api';

interface NewDocumentViewProps {
  onBack: () => void;
  onScanComplete: (documentId: string) => void;
}

export const NewDocumentView: React.FC<NewDocumentViewProps> = ({
  onBack,
  onScanComplete,
}) => {
  const [docTitle, setDocTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [blocksCount, setBlocksCount] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartScan = async (fileToUpload?: File) => {
    let targetFile = fileToUpload || file;
    if (!targetFile && pasteMode && pastedText.trim()) {
      const blob = new Blob([pastedText], { type: 'text/plain' });
      const name = (docTitle.trim() || 'draft').replace(/\s+/g, '-').toLowerCase() + '.txt';
      targetFile = new File([blob], name, { type: 'text/plain' });
    }

    if (!targetFile) {
      alert('Please select a file or enter text to scan.');
      return;
    }

    try {
      setIsScanning(true);
      setScanProgress(10);
      setFile(targetFile);

      const title = docTitle.trim() || targetFile.name.replace(/\.[^/.]+$/, '');
      if (!docTitle) setDocTitle(title);

      // 1. Upload document
      const uploaded = await uploadDocument(targetFile, title);
      setDocumentId(uploaded.document_id);
      setBlocksCount(uploaded.blocks_count || 1);
      setScanProgress(30);

      // 2. Trigger scan
      const started = await triggerScan(uploaded.document_id);

      // 3. Poll scan until done
      const interval = setInterval(async () => {
        try {
          const poll = await pollScan(started.scan_job_id);
          setScanProgress(Math.max(poll.progress, 40));

          if (poll.status === 'done' || poll.status === 'failed') {
            clearInterval(interval);
            setScanProgress(100);
            setIsScanning(false);
          }
        } catch {
          clearInterval(interval);
          setIsScanning(false);
        }
      }, 1500);
    } catch (err) {
      console.error('Scan startup failed:', err);
      setIsScanning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Documents</span>
      </button>

      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New document</h1>
        <p className="text-sm text-slate-500 mt-1">
          Add a draft and we'll check it against Acme Mobile's guidelines, glossary and approved facts.
        </p>
      </div>

      {/* 2-Column Workflow Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Column 1: Your draft */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-4">1 · Your draft</h2>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Document title
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="e.g. Q4 Launch Announcement"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#006654] focus:border-[#006654]"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">File</label>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setFile(e.target.files[0]);
                  handleStartScan(e.target.files[0]);
                }
              }}
              accept=".txt,.docx,.pdf"
              className="hidden"
            />

            <div className="border border-dashed border-slate-300 rounded-lg p-4 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#006654]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    {file ? file.name : 'No file selected'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {file
                      ? `${file.name.endsWith('.pdf') ? 'PDF document' : file.name.endsWith('.docx') ? 'Word document' : 'Text file'} · ${blocksCount > 0 ? `${blocksCount} blocks found` : 'Ready to scan'}`
                      : 'Upload a TXT, DOCX or PDF file'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors shadow-sm"
              >
                {file ? 'Replace file' : 'Select file'}
              </button>
            </div>
            
            <p className="text-[11px] text-slate-400 mt-2">
              Drop a TXT, DOCX or PDF here. Scanned image-only PDFs aren't supported yet.
            </p>
          </div>

          <div className="mb-6">
            <button
              type="button"
              onClick={() => setPasteMode(!pasteMode)}
              className="text-xs font-medium text-[#006654] hover:underline"
            >
              {pasteMode ? 'Hide text editor' : 'Paste text instead'}
            </button>

            {pasteMode && (
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={5}
                className="w-full mt-2 p-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#006654]"
                placeholder="Paste marketing copy here..."
              />
            )}
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => handleStartScan()}
              disabled={isScanning}
              className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs transition-colors disabled:opacity-50"
            >
              {isScanning ? 'Scanning...' : 'Start Scan'}
            </button>
            <span className="text-xs text-slate-500">Your file is saved as version 1.</span>
          </div>
        </div>

        {/* Column 2: Scan progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">2 · Scan progress</h2>
            <span className="text-xs font-mono font-bold text-slate-700">{scanProgress}%</span>
          </div>

          <div className="text-xs text-slate-600 mb-2 font-medium">
            {isScanning ? `Scanning ${file?.name || 'document'}` : file ? `Ready to scan ${file.name}` : 'Awaiting document...'}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 mb-6 overflow-hidden">
            <div
              className="bg-[#006654] h-full transition-all duration-300 rounded-full"
              style={{ width: `${scanProgress}%` }}
            />
          </div>

          {/* 4 Scan Pipeline Steps */}
          <div className="space-y-4 mb-6">
            {/* Step 1: Reading file */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#006654]" />
                <span className="text-slate-800 font-medium">Reading the file</span>
              </div>
              <span className="text-slate-500">Done · {blocksCount} blocks</span>
            </div>

            {/* Step 2: Glossary check */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                {scanProgress >= 40 ? (
                  <CheckCircle2 className="h-4 w-4 text-[#006654]" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300" />
                )}
                <span className="text-slate-800 font-medium">Glossary check</span>
              </div>
              <span className="text-slate-500">
                {scanProgress >= 40 ? 'Done · findings matched' : 'Waiting'}
              </span>
            </div>

            {/* Step 3: Checking facts and claims */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                {scanProgress >= 70 ? (
                  <CheckCircle2 className="h-4 w-4 text-[#006654]" />
                ) : isScanning && scanProgress >= 40 ? (
                  <Loader2 className="h-4 w-4 text-[#006654] animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300" />
                )}
                <span className="text-slate-800 font-medium">Checking facts and claims</span>
              </div>
              <span className={isScanning && scanProgress >= 40 && scanProgress < 70 ? 'text-[#006654] font-semibold' : 'text-slate-500'}>
                {scanProgress >= 70 ? 'Done' : isScanning && scanProgress >= 40 ? 'Running' : 'Waiting'}
              </span>
            </div>

            {/* Step 4: Checking tone */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                {scanProgress >= 100 ? (
                  <CheckCircle2 className="h-4 w-4 text-[#006654]" />
                ) : isScanning && scanProgress >= 70 ? (
                  <Loader2 className="h-4 w-4 text-[#006654] animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300" />
                )}
                <span className="text-slate-800 font-medium">Checking tone</span>
              </div>
              <span className={isScanning && scanProgress >= 70 && scanProgress < 100 ? 'text-[#006654] font-semibold' : 'text-slate-500'}>
                {scanProgress >= 100 ? 'Done' : isScanning && scanProgress >= 70 ? 'Running' : 'Waiting'}
              </span>
            </div>
          </div>

          {/* Yellow Hint Callout */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-lg text-xs text-amber-900 mb-4 leading-relaxed">
            The first scan after the app has been idle can take about a minute. You can leave this page; the scan keeps running and the document appears in your list.
          </div>

          {/* Neutral Info Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 mb-6 leading-relaxed">
            AI checks use a hosted language model. If it can't be reached, you still get the glossary results, with a notice that the AI checks were skipped.
          </div>

          {/* See results button */}
          <button
            onClick={() => documentId && onScanComplete(documentId)}
            disabled={!documentId || isScanning}
            className="w-full py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm text-center"
          >
            See results when ready →
          </button>
        </div>

      </div>
    </div>
  );
};
