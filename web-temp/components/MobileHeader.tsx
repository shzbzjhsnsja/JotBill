
import React from 'react';
import { Ledger, UserProfile } from '../types';
import { ChevronDown } from 'lucide-react';
import { I18N } from '../constants';

interface MobileHeaderProps {
  currentLedger: Ledger;
  user: UserProfile;
  onOpenSettings: () => void;
  onOpenLedgerList: () => void;
  activeTab: string;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ currentLedger, user, onOpenSettings, onOpenLedgerList, activeTab }) => {
  const t = I18N[user.language];

  // Helper to determine the title based on the active tab
  const getTitle = () => {
    switch (activeTab) {
      case 'reports':
        return t.reports; // "Statistics" / "统计"
      case 'accounts':
        return user.language === 'zh' ? '我的账户' : 'My Accounts'; // Custom override per user request
      default:
        return '';
    }
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-[60px] flex justify-between items-center px-5 bg-[#F2F2F7]/80 backdrop-blur-md z-30 transition-all border-b border-gray-200/50">
      {/* Left Section */}
      <div className="flex-1 flex justify-start">
        {/* Only show Ledger Switcher on Dashboard (Conceptually, currently handled by Dashboard.tsx) */}
        {activeTab === 'dashboard' && (
          <button 
            onClick={onOpenLedgerList}
            className="flex items-center gap-2 active:opacity-60 transition-opacity"
          >
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none truncate max-w-[200px] text-left">
              {currentLedger.name}
            </h1>
            <ChevronDown size={20} className="text-gray-400 shrink-0" strokeWidth={3} />
          </button>
        )}
      </div>

      {/* Center Title (For Statistics and Accounts) */}
      {activeTab !== 'dashboard' && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <h1 className="text-lg font-bold text-gray-900">{getTitle()}</h1>
        </div>
      )}

      {/* Right Section */}
      <div className="flex-1 flex justify-end">
        <button 
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-full overflow-hidden border border-white shadow-sm active:scale-90 transition-transform"
        >
          <img src={user.avatar} className="w-full h-full object-cover" alt="Settings" />
        </button>
      </div>
    </header>
  );
};

export default MobileHeader;
