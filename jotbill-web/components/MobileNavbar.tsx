
import React from 'react';
import { LayoutDashboard, PieChart, CreditCard } from 'lucide-react';
import { I18N } from '../constants';
import { UserProfile, UIPreferences } from '../types';

interface MobileNavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: UserProfile;
  uiPrefs: UIPreferences;
}

const MobileNavbar: React.FC<MobileNavbarProps> = ({ activeTab, setActiveTab, user, uiPrefs }) => {
  const t = I18N[user.language];

  // Dynamic Tabs based on Preferences
  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: <LayoutDashboard size={22} /> },
    uiPrefs.showReports && { id: 'reports', label: t.reports, icon: <PieChart size={22} /> },
    uiPrefs.showAccounts && { id: 'accounts', label: t.accounts, icon: <CreditCard size={22} /> },
  ].filter(Boolean) as { id: string; label: string; icon: React.ReactNode }[];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-200 pb-safe pt-2 z-40">
      <div
        className="grid px-6"
        style={{ gridTemplateColumns: `repeat(${Math.max(navItems.length, 1)}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 gap-1.5 transition-all duration-300 ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {React.cloneElement(item.icon as any, { 
                size: isActive ? 26 : 24, 
                strokeWidth: isActive ? 2.5 : 2,
                className: `transition-transform duration-300 ${isActive ? 'scale-110' : ''}`
              })}
              <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-80'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe area spacer for iPhone home indicator */}
      <div className="h-6 w-full" /> 
    </div>
  );
};

export default MobileNavbar;
