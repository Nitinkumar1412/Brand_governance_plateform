import React, { useState, useEffect } from 'react';
import { BookOpen, AlertTriangle, Database, Plus, Search } from 'lucide-react';
import {
  type GuidelineRuleItem,
  type GlossaryItem,
  type ApprovedFactItem,
  getRules,
  createRule,
  getGlossary,
  createGlossaryTerm,
  getFacts,
  createFact,
} from '../services/api';

interface KnowledgeBaseViewProps {
  canManage: boolean;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ canManage }) => {
  const [subTab, setSubTab] = useState<'rules' | 'glossary' | 'facts'>('rules');
  const [search, setSearch] = useState('');
  
  // Data states
  const [rules, setRules] = useState<GuidelineRuleItem[]>([]);
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
  const [facts, setFacts] = useState<ApprovedFactItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal form states
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isAddTermOpen, setIsAddTermOpen] = useState(false);
  const [isAddFactOpen, setIsAddFactOpen] = useState(false);

  const [ruleCode, setRuleCode] = useState('');
  const [ruleCategory, setRuleCategory] = useState('tone');
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleBody, setRuleBody] = useState('');

  const [termText, setTermText] = useState('');
  const [termKind, setTermKind] = useState<'forbidden' | 'approved'>('forbidden');
  const [termReplacement, setTermReplacement] = useState('');
  const [termNote, setTermNote] = useState('');

  // Fact Form State
  const [factEntity, setFactEntity] = useState('');
  const [factAttribute, setFactAttribute] = useState('');
  const [factStatement, setFactStatement] = useState('');
  const [factValueNum, setFactValueNum] = useState<string>('');
  const [factValueText, setFactValueText] = useState('');
  const [factUnit, setFactUnit] = useState('');
  const [factSourceName, setFactSourceName] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, g, f] = await Promise.all([getRules(), getGlossary(), getFacts()]);
      setRules(r);
      setGlossary(g);
      setFacts(f);
    } catch (e) {
      console.error('Failed to load knowledge base:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRule({
        code: ruleCode,
        category: ruleCategory,
        title: ruleTitle,
        body: ruleBody,
      });
      setIsAddRuleOpen(false);
      setRuleCode('');
      setRuleTitle('');
      setRuleBody('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to create rule');
    }
  };

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createGlossaryTerm({
        term: termText,
        kind: termKind,
        replacement: termReplacement || undefined,
        note: termNote || undefined,
      });
      setIsAddTermOpen(false);
      setTermText('');
      setTermReplacement('');
      setTermNote('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to add glossary term');
    }
  };

  const handleCreateFact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFact({
        entity: factEntity,
        attribute: factAttribute,
        statement: factStatement,
        value_num: factValueNum ? parseFloat(factValueNum) : undefined,
        value_text: factValueText || undefined,
        unit: factUnit || undefined,
        source_name: factSourceName || undefined,
      });
      setIsAddFactOpen(false);
      setFactEntity('');
      setFactAttribute('');
      setFactStatement('');
      setFactValueNum('');
      setFactValueText('');
      setFactUnit('');
      setFactSourceName('');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to add approved fact');
    }
  };

  const filteredRules = rules.filter(
    (r) =>
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.body.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGlossary = glossary.filter(
    (g) =>
      g.term.toLowerCase().includes(search.toLowerCase()) ||
      (g.replacement && g.replacement.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredFacts = facts.filter(
    (f) =>
      f.entity.toLowerCase().includes(search.toLowerCase()) ||
      f.attribute.toLowerCase().includes(search.toLowerCase()) ||
      f.statement.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-slate-500 mt-1">
            Rules, approved product facts, and forbidden vocabulary powering AI compliance scans.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {subTab === 'rules' && (
              <button
                onClick={() => setIsAddRuleOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#006654] hover:bg-[#005244] text-white font-medium text-xs transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Guideline Rule</span>
              </button>
            )}
            {subTab === 'glossary' && (
              <button
                onClick={() => setIsAddTermOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#006654] hover:bg-[#005244] text-white font-medium text-xs transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Glossary Term</span>
              </button>
            )}
            {subTab === 'facts' && (
              <button
                onClick={() => setIsAddFactOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#006654] hover:bg-[#005244] text-white font-medium text-xs transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add Approved Fact</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('rules')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'rules'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Guideline Rules ({rules.length})</span>
          </button>

          <button
            onClick={() => setSubTab('glossary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'glossary'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Glossary & Terms ({glossary.length})</span>
          </button>

          <button
            onClick={() => setSubTab('facts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'facts'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Approved Facts ({facts.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search guidelines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-800"
          />
        </div>
      </div>

      {/* Content Rendering */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs">Loading Knowledge Base items...</div>
      ) : (
        <>
          {/* 1. Guideline Rules Grid */}
          {subTab === 'rules' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRules.map((rule) => (
                <div key={rule.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-700">
                        {rule.code}
                      </span>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        {rule.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-2">{rule.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">{rule.body}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Severity: <span className="font-semibold text-slate-700 capitalize">{rule.severity}</span></span>
                    {rule.page && <span>Page {rule.page}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. Glossary Table */}
          {subTab === 'glossary' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Term</th>
                    <th className="py-3 px-4">Kind</th>
                    <th className="py-3 px-6">Approved Replacement</th>
                    <th className="py-3 px-6">Guidance Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredGlossary.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-900">{t.term}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            t.kind === 'forbidden'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {t.kind}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-medium text-emerald-700">
                        {t.replacement ? `→ ${t.replacement}` : '—'}
                      </td>
                      <td className="py-3.5 px-6 text-slate-500">{t.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. Approved Facts Table */}
          {subTab === 'facts' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Product / Entity</th>
                    <th className="py-3 px-4">Attribute</th>
                    <th className="py-3 px-4">Approved Spec / Value</th>
                    <th className="py-3 px-6">Official Statement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredFacts.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-900">{f.entity}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{f.attribute}</td>
                      <td className="py-3.5 px-4 font-bold text-[#006654]">
                        {f.value_num !== null && f.value_num !== undefined
                          ? `${f.value_num} ${f.unit || ''}`
                          : f.value_text || '—'}
                      </td>
                      <td className="py-3.5 px-6 text-slate-700">{f.statement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal: Add Rule */}
      {isAddRuleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Add Guideline Rule</h3>
            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Code (e.g. TONE-03)</label>
                <input
                  type="text"
                  required
                  value={ruleCode}
                  onChange={(e) => setRuleCode(e.target.value)}
                  placeholder="TONE-03"
                  className="w-full p-2 border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={ruleCategory}
                  onChange={(e) => setRuleCategory(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                >
                  <option value="tone">Tone and Voice</option>
                  <option value="terminology">Terminology</option>
                  <option value="facts">Facts & Claims</option>
                  <option value="visual">Visual & Layout</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Title</label>
                <input
                  type="text"
                  required
                  value={ruleTitle}
                  onChange={(e) => setRuleTitle(e.target.value)}
                  placeholder="Warm, Plain Language"
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Rule Body</label>
                <textarea
                  required
                  rows={3}
                  value={ruleBody}
                  onChange={(e) => setRuleBody(e.target.value)}
                  placeholder="Do not use aggressive marketing superlatives like 'unmatched' or 'guaranteed'..."
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(false)}
                  className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#006654] text-white hover:bg-[#005244] font-semibold"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Glossary Term */}
      {isAddTermOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Add Forbidden/Approved Term</h3>
            <form onSubmit={handleCreateTerm} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Word or Phrase</label>
                <input
                  type="text"
                  required
                  value={termText}
                  onChange={(e) => setTermText(e.target.value)}
                  placeholder="e.g. cheap"
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kind</label>
                <select
                  value={termKind}
                  onChange={(e) => setTermKind(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                >
                  <option value="forbidden">Forbidden</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Approved Replacement</label>
                <input
                  type="text"
                  value={termReplacement}
                  onChange={(e) => setTermReplacement(e.target.value)}
                  placeholder="e.g. affordable, cost-effective"
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Guidance Note</label>
                <input
                  type="text"
                  value={termNote}
                  onChange={(e) => setTermNote(e.target.value)}
                  placeholder="e.g. 'cheap' undermines brand value"
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddTermOpen(false)}
                  className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#006654] text-white hover:bg-[#005244] font-semibold"
                >
                  Save Term
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Add Fact */}
      {isAddFactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4">Add Approved Product Fact</h3>
            <form onSubmit={handleCreateFact} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Entity / Product *</label>
                  <input
                    type="text"
                    required
                    value={factEntity}
                    onChange={(e) => setFactEntity(e.target.value)}
                    placeholder="e.g. Phone X"
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Attribute *</label>
                  <input
                    type="text"
                    required
                    value={factAttribute}
                    onChange={(e) => setFactAttribute(e.target.value)}
                    placeholder="e.g. battery capacity"
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Fact Statement *</label>
                <textarea
                  required
                  rows={2}
                  value={factStatement}
                  onChange={(e) => setFactStatement(e.target.value)}
                  placeholder="e.g. Phone X battery capacity is 5000 mAh."
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Numeric Value</label>
                  <input
                    type="number"
                    step="any"
                    value={factValueNum}
                    onChange={(e) => setFactValueNum(e.target.value)}
                    placeholder="5000"
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={factUnit}
                    onChange={(e) => setFactUnit(e.target.value)}
                    placeholder="mAh, W, MP"
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Text Value</label>
                  <input
                    type="text"
                    value={factValueText}
                    onChange={(e) => setFactValueText(e.target.value)}
                    placeholder="e.g. Gorilla Glass"
                    className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source / Citation</label>
                <input
                  type="text"
                  value={factSourceName}
                  onChange={(e) => setFactSourceName(e.target.value)}
                  placeholder="e.g. Product Spec v3, Page 2"
                  className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddFactOpen(false)}
                  className="px-4 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#006654] text-white hover:bg-[#005244] font-semibold"
                >
                  Save Fact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

