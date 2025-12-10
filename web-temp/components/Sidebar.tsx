
import React, { useState } from 'react';
import { LayoutDashboard, PieChart, CreditCard, ChevronDown, Plus, ChevronRight } from 'lucide-react';
import { Ledger, UserProfile, UIPreferences } from '../types';
import { I18N } from '../constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  ledgers: Ledger[];
  currentLedgerId: string;
  setCurrentLedgerId: (id: string) => void;
  user: UserProfile;
  onOpenSettings: () => void;
  onCreateLedger: () => void;
  uiPrefs: UIPreferences;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  ledgers, 
  currentLedgerId, 
  setCurrentLedgerId,
  user,
  onOpenSettings,
  onCreateLedger,
  uiPrefs
}) => {
  const [isLedgerMenuOpen, setIsLedgerMenuOpen] = useState(false);
  const t = I18N[user.language];

  const currentLedger = ledgers.find(l => l.id === currentLedgerId) || ledgers[0];

  const menuItems = [
    { id: 'dashboard', label: t.dashboard, icon: <LayoutDashboard size={20} /> },
    uiPrefs.showReports && { id: 'reports', label: t.reports, icon: <PieChart size={20} /> },
    uiPrefs.showAccounts && { id: 'accounts', label: t.accounts, icon: <CreditCard size={20} /> },
  ].filter(Boolean) as { id: string; label: string; icon: React.ReactNode }[];

  return (
    <aside className="hidden md:flex fixed top-0 left-0 h-screen w-72 bg-white/90 backdrop-blur-2xl border-r border-gray-200/60 flex-col z-40">
      
      {/* Ledger Switcher */}
      <div className="p-6 pb-2">
        <div className="relative">
          <button 
            onClick={() => setIsLedgerMenuOpen(!isLedgerMenuOpen)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-gray-100 hover:border-gray-200 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${currentLedger.color} flex items-center justify-center text-xl shadow-sm text-white`}>
                {currentLedger.icon}
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Book</p>
                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{currentLedger.name}</p>
              </div>
            </div>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isLedgerMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isLedgerMenuOpen && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in-up">
              <div className="p-2">
                <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">{t.myLedgers}</p>
                {ledgers.map(l => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setCurrentLedgerId(l.id);
                      setIsLedgerMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-sm transition-colors ${
                      currentLedgerId === l.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="text-lg">{l.icon}</span>
                    <span className="font-medium">{l.name}</span>
                    {currentLedgerId === l.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  </button>
                ))}
                <div className="h-px bg-gray-100 my-1" />
                <button 
                  onClick={() => {
                    onCreateLedger();
                    setIsLedgerMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <div className="w-6 h-6 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                    <Plus size={14} />
                  </div>
                  <span className="font-medium">{t.addLedger}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                activeTab === item.id
                  ? 'bg-black text-white shadow-lg shadow-gray-200'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {React.cloneElement(item.icon as any, { 
                className: activeTab === item.id ? 'text-white' : 'text-gray-400' 
              })}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100">
        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-gray-50 transition-colors group"
        >
          <img 
            src={user.avatar} 
            alt="User" 
            className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
          />
          <div className="flex-1 text-left overflow-hidden">
            <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 group-hover:text-blue-500 transition-colors">
              {t.settings} <ChevronRight size={12} />
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
