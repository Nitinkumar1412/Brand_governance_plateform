import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Shield, ArrowRight, Sparkles } from 'lucide-react';
import { loginUser, registerUser, getDemoToken, type User } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'creator' | 'reviewer' | 'admin'>('creator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await loginUser(email, password);
        onAuthSuccess(res.user);
        onClose();
      } else {
        const res = await registerUser(email, password, fullName, role);
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (targetRole: 'admin' | 'creator' | 'reviewer') => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDemoToken(targetRole);
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to switch demo persona.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-surface-border bg-surface p-8 shadow-2xl overflow-hidden">

        {/* Subtle Ambient Copper Glow */}
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-brand-copper/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-brand-copper/30 shadow-glow-copper">
              <Shield className="h-4 w-4 text-brand-gold" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-brand-light tracking-wide">
                Inkloom Access
              </h2>
              <p className="text-[11px] text-neutral-400 font-sans -mt-0.5">
                Role-Based Brand Governance Platform
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-surface-elevated hover:text-neutral-200 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 1-Click Demo Personas (Judges & Devs Fast Login) */}
        <div className="my-5 rounded-xl border border-brand-copper/25 bg-brand-copper/5 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-brand-amber font-semibold mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>1-Click Hackathon Personas (auth_login)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { r: 'admin', label: 'Admin', desc: 'Rules & Insights' },
              { r: 'reviewer', label: 'Reviewer', desc: 'Approve & Edit' },
              { r: 'creator', label: 'Creator', desc: 'Upload & Scan' },
            ].map(({ r, label, desc }) => (
              <button
                key={r}
                type="button"
                onClick={() => handleQuickDemo(r as any)}
                disabled={loading}
                className="flex flex-col items-center justify-center p-2 rounded-lg border border-surface-border bg-surface hover:border-brand-copper/60 hover:bg-surface-elevated transition-all group disabled:opacity-50"
              >
                <span className="text-xs font-semibold text-brand-light group-hover:text-brand-amber">
                  {label}
                </span>
                <span className="text-[9px] text-neutral-400 text-center">{desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-surface-border" />
          </div>
          <div className="relative flex justify-center text-[10px] font-mono uppercase">
            <span className="bg-surface px-2 text-neutral-500">Or use credentials</span>
          </div>
        </div>

        {/* Tab Switcher: Login vs Register */}
        <div className="flex rounded-lg bg-surface-elevated p-1 mb-4 text-xs">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); }}
            className={`flex-1 py-1.5 rounded-md font-medium transition-all ${tab === 'login'
                ? 'bg-surface text-brand-light shadow-sm border border-surface-border'
                : 'text-neutral-400 hover:text-neutral-200'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); }}
            className={`flex-1 py-1.5 rounded-md font-medium transition-all ${tab === 'register'
                ? 'bg-surface text-brand-light shadow-sm border border-surface-border'
                : 'text-neutral-400 hover:text-neutral-200'
              }`}
          >
            Register
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {tab === 'register' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-lg bg-surface-elevated border border-surface-border pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-brand-amber focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
                  Assign Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full rounded-lg bg-surface-elevated border border-surface-border px-3 py-2 text-xs text-neutral-200 focus:border-brand-amber focus:outline-none"
                >
                  <option value="creator">Creator (Upload & Fix Content)</option>
                  <option value="reviewer">Reviewer (Approve & Audit)</option>
                  <option value="admin">Admin (Manage Brand Guidelines)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-lg bg-surface-elevated border border-surface-border pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-brand-amber focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg bg-surface-elevated border border-surface-border pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-brand-amber focus:outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand-copper py-2.5 text-xs font-semibold text-brand-light hover:bg-brand-amber transition-all shadow-glow-copper disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : tab === 'login' ? 'Sign In to Workspace' : 'Create Account'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>

      </div>
    </div>
  );
};

