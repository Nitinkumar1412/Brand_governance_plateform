import React from 'react';
import { Shield, LogOut } from 'lucide-react';
import type { User } from '../services/api';

interface BrandHeaderProps {
  currentTab: 'documents' | 'knowledge' | 'insights';
  onTabChange: (tab: 'documents' | 'knowledge' | 'insights') => void;
  currentUser: User | null;
  onLogout: () => void;
}

export const BrandHeader: React.FC<BrandHeaderProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#162338] text-white px-6 py-2.5 shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        
        {/* Left: Brand Logo & Navigation Tabs */}
        <div className="flex items-center gap-7">
          <div className="flex items-center gap-2 font-bold text-base tracking-wide text-white">
            <Shield className="h-5 w-5 text-emerald-400 fill-emerald-400/20" />
            <span>Brand Governance</span>
          </div>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => onTabChange('documents')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                currentTab === 'documents'
                  ? 'bg-[#24354f] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => onTabChange('knowledge')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                currentTab === 'knowledge'
                  ? 'bg-[#24354f] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Knowledge base
            </button>
            <button
              onClick={() => onTabChange('insights')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                currentTab === 'insights'
                  ? 'bg-[#24354f] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              Insights
            </button>
          </nav>
        </div>

        {/* Right: Organization Name & Assigned Role Pill */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-300 font-medium">
            Acme Mobile
          </span>

          {currentUser && (
            <div className="flex items-center gap-1.5">
              <span className="px-3 py-1 rounded bg-white text-[#162338] font-semibold text-xs capitalize shadow-sm">
                {currentUser.role}
              </span>

              <button
                onClick={onLogout}
                title="Sign out"
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition-all ml-1"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

