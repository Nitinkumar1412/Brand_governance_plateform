import React, { useState } from 'react';
import { UserCheck, BarChart3, Database, LogIn, LogOut, ChevronDown } from 'lucide-react';
import type { User } from '../services/api';

interface NavbarProps {
  currentUser: User | null;
  onRoleSwitch?: (role: 'admin' | 'creator' | 'reviewer') => void;
  onOpenAnalytics: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  dbHealthy: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenAnalytics,
  onOpenAuth,
  onLogout,
  dbHealthy,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Role permissions:
  // Admin & Reviewer can see Analytics
  const canViewAnalytics = currentUser?.role === 'admin' || currentUser?.role === 'reviewer';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        
        {/* Left: Brand Identity (National Mining Museum editorial aesthetic) */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-brand-copper/30 shadow-glow-copper">
            <span className="font-serif text-xl font-bold tracking-tight text-brand-gold">I</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg font-medium tracking-wider text-brand-light">
                INKLOOM
              </span>
              <span className="rounded-full bg-brand-copper/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-brand-amber border border-brand-copper/20">
                Governance
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 font-mono tracking-tight -mt-0.5">
              Multi-Layer Automated Compliance Engine
            </p>
          </div>
        </div>

        {/* Center: DB & Neon Health Indicator */}
        <div className="hidden md:flex items-center gap-2 rounded-full border border-surface-border bg-surface px-3 py-1 text-xs text-neutral-300">
          <Database className="h-3.5 w-3.5 text-neutral-400" />
          <span className="font-mono text-[11px] text-neutral-400">Neon pgvector:</span>
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className={`h-1.5 w-1.5 rounded-full ${dbHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {dbHealthy ? 'Live' : 'Disconnected'}
          </span>
        </div>

        {/* Right: RBAC Controls & User Profile */}
        <div className="flex items-center gap-3">
          
          {/* Executive Analytics Button (Only Admin & Reviewer) */}
          {canViewAnalytics && (
            <button
              onClick={onOpenAnalytics}
              className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-brand-copper/40 hover:text-brand-light transition-all duration-200"
            >
              <BarChart3 className="h-3.5 w-3.5 text-brand-amber" />
              <span>Brand Drift</span>
            </button>
          )}

          {/* User Profile / Auth State */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-brand-copper/40 transition-all"
              >
                <div className="h-5 w-5 rounded-full bg-brand-copper/30 border border-brand-copper/50 flex items-center justify-center font-bold text-[10px] text-brand-gold">
                  {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="truncate max-w-[100px] leading-tight font-semibold text-brand-light">
                    {currentUser.full_name || currentUser.email.split('@')[0]}
                  </div>
                  <div className="text-[10px] font-mono text-brand-amber uppercase tracking-wider">
                    {currentUser.role}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-surface-border bg-surface-elevated p-2 shadow-2xl z-50 animate-fade-in">
                  <div className="px-3 py-2 border-b border-surface-border/50">
                    <p className="text-xs font-semibold text-brand-light truncate">{currentUser.full_name}</p>
                    <p className="text-[11px] font-mono text-neutral-400 truncate">{currentUser.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase bg-brand-copper/20 text-brand-amber border border-brand-copper/30">
                      {currentUser.role} permissions
                    </span>
                  </div>

                  <div className="p-1 space-y-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onOpenAuth();
                      }}
                      className="w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-neutral-300 hover:bg-surface hover:text-brand-light transition-all text-left"
                    >
                      <UserCheck className="h-3.5 w-3.5 text-brand-amber" />
                      <span>Switch Account</span>
                    </button>

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition-all text-left"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-lg bg-brand-copper px-3 py-1.5 text-xs font-semibold text-brand-light hover:bg-brand-amber transition-all shadow-glow-copper"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
