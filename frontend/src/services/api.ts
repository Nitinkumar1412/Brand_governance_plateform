import axios from 'axios';
import.meta.env.VITE_API_BASE_URL

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'
).replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_BASE,
});

// Attach token dynamically from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('inkloom_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'creator' | 'reviewer';
  org_id: string;
}

export interface ContentBlock {
  id: string;
  block_no: number;
  block_type: string;
  content: string;
  page?: number;
}

export interface DocumentDetail {
  id: string;
  title: string;
  status: string;
  version_no?: number;
  version_id?: string;
  scan_job_id?: string;
  scan_status?: string;
  blocks: ContentBlock[];
}

export interface Finding {
  id: string;
  block_id: string;
  layer: 'terminology' | 'facts' | 'tone';
  severity: 'low' | 'medium' | 'high';
  verdict?: string;
  span_start?: number;
  span_end?: number;
  quoted_text?: string;
  explanation: string;
  suggested_fix?: string;
  citation?: string;
  status: 'open' | 'accepted' | 'edited' | 'rejected';
  final_text?: string;
}

export interface ScanPollResult {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  error?: string;
  counts: {
    total: number;
    open: number;
    by_layer: Record<string, number>;
    by_severity: Record<string, number>;
    compliance: {
      score: number;
      grade: 'A' | 'B' | 'C' | 'F';
      risk_level: 'low' | 'moderate' | 'high' | 'critical';
      is_publishable: boolean;
    };
  };
}

export interface BrandDrift {
  summary: {
    total_violations_flagged: number;
    violations_by_layer: Record<string, number>;
    violations_by_severity?: Record<string, number>;
    reviewer_decisions: Record<string, number>;
    brand_alignment_rate: number;
  };
  hall_of_shame: Array<{
    rule_code: string;
    title: string;
    violation_count: number;
    rejection_rate: string;
  }>;
  rule_fatigue_alerts: Array<{
    rule_code: string;
    title: string;
    rejection_rate: string;
    suggestion: string;
  }>;
  recent_findings?: Array<{
    id: string;
    layer: 'terminology' | 'facts' | 'tone';
    severity: 'low' | 'medium' | 'high';
    status: 'open' | 'accepted' | 'edited' | 'rejected';
    quoted_text?: string;
    explanation?: string;
    suggested_fix?: string;
    final_text?: string;
    created_at?: string;
  }>;
}

// API functions
export async function loginUser(email: string, password: string): Promise<{ access_token: string; user: User }> {
  const res = await api.post('/auth/login', { email, password });
  localStorage.setItem('inkloom_token', res.data.access_token);
  return res.data;
}

export async function registerUser(email: string, password: string, fullName: string, role: string): Promise<{ access_token: string; user: User }> {
  const res = await api.post('/auth/register', {
    email,
    password,
    full_name: fullName,
    role,
  });
  localStorage.setItem('inkloom_token', res.data.access_token);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get('/auth/me');
  return res.data;
}

export function logoutUser(): void {
  localStorage.removeItem('inkloom_token');
}

export async function getDemoToken(role: string): Promise<{ access_token: string; user: User }> {
  const res = await api.post('/auth/demo-token', { role });
  localStorage.setItem('inkloom_token', res.data.access_token);
  return res.data;
}

export async function checkHealth(): Promise<{ status: string; db: string; pgvector: boolean }> {
  const res = await api.get('/health');
  return res.data;
}

export async function uploadDocument(file: File, title?: string): Promise<{ document_id: string; version_id: string; blocks_count: number }> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);
  const res = await api.post('/documents/upload', formData);
  return res.data;
}

export async function getDocument(id: string): Promise<DocumentDetail> {
  const res = await api.get(`/documents/${id}`);
  return res.data;
}

export async function triggerScan(documentId: string): Promise<{ scan_job_id: string; status: string; progress: number }> {
  const res = await api.post(`/documents/${documentId}/scans`);
  return res.data;
}

export async function pollScan(scanId: string): Promise<ScanPollResult> {
  const res = await api.get(`/scans/${scanId}`);
  return res.data;
}

export interface DocumentListItem {
  id: string;
  title: string;
  status: string;
  version_no: number;
  version_id?: string;
  scan_progress?: number | null;
  scan_status?: string | null;
  open_findings: number;
  total_findings: number;
  creator_name: string;
  created_at: string;
  updated_at: string;
}

export async function getDocumentsList(): Promise<DocumentListItem[]> {
  const res = await api.get('/documents');
  return res.data;
}

export async function requestChanges(documentId: string): Promise<{ id: string; status: string }> {
  const res = await api.post(`/documents/${documentId}/request-changes`);
  return res.data;
}

export async function getFindings(documentId: string): Promise<Finding[]> {
  const res = await api.get(`/documents/${documentId}/findings`);
  return res.data;
}

export async function submitDocument(documentId: string): Promise<{ id: string; status: string }> {
  const res = await api.post(`/documents/${documentId}/submit`);
  return res.data;
}

export async function approveDocument(documentId: string): Promise<{ id: string; status: string; approved_at: string }> {
  const res = await api.post(`/documents/${documentId}/approve`);
  return res.data;
}

export async function decideFinding(findingId: string, decision: 'accepted' | 'edited' | 'rejected' | 'open', finalText?: string): Promise<{ id: string; status: string }> {
  const res = await api.patch(`/findings/${findingId}/decision`, {
    decision,
    final_text: finalText,
  });
  return res.data;
}

export async function getBrandDrift(): Promise<BrandDrift> {
  const res = await api.get('/insights/brand-drift');
  return res.data;
}

export interface GuidelineRuleItem {
  id: string;
  code: string;
  category: string;
  title: string;
  body: string;
  severity: string;
  page?: number | null;
}

export interface GlossaryItem {
  id: string;
  term: string;
  kind: 'approved' | 'forbidden';
  replacement?: string | null;
  note?: string | null;
}

export interface ApprovedFactItem {
  id: string;
  entity: string;
  attribute: string;
  value_num?: number | null;
  value_text?: string | null;
  unit?: string | null;
  statement: string;
  valid_to?: string | null;
}

export interface DocumentHistoryItem {
  action: string;
  entity_type: string;
  created_at: string;
  actor?: {
    name: string;
    role: string;
    email: string;
  } | null;
  details: Record<string, any>;
}

export async function getRules(): Promise<GuidelineRuleItem[]> {
  const res = await api.get('/rules');
  return res.data;
}

export async function createRule(payload: { code: string; category: string; title: string; body: string; severity?: string }): Promise<{ id: string; code: string }> {
  const res = await api.post('/rules', payload);
  return res.data;
}

export async function getGlossary(): Promise<GlossaryItem[]> {
  const res = await api.get('/glossary');
  return res.data;
}

export async function createGlossaryTerm(payload: { term: string; kind: 'approved' | 'forbidden'; replacement?: string; note?: string }): Promise<{ id: string; term: string }> {
  const res = await api.post('/glossary', payload);
  return res.data;
}

export async function getFacts(): Promise<ApprovedFactItem[]> {
  const res = await api.get('/facts');
  return res.data;
}

export async function createFact(payload: {
  entity: string;
  attribute: string;
  statement: string;
  value_num?: number;
  value_text?: string;
  unit?: string;
  source_name?: string;
  source_page?: number;
}): Promise<{ id: string; entity: string; attribute: string; statement: string }> {
  const res = await api.post('/facts', payload);
  return res.data;
}

export async function getDocumentHistory(documentId: string): Promise<DocumentHistoryItem[]> {
  const res = await api.get(`/documents/${documentId}/history`);
  return res.data;
}

export function getExportUrl(documentId: string): string {
  return `${API_BASE}/documents/${documentId}/export`;
}

