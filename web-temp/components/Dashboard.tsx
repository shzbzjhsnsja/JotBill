
import React, { useMemo, useState } from 'react';
import { Account, Transaction, TransactionType, UserProfile, Ledger, Category } from '../types';
import { CreditCard, Plus, ChevronRight, Search, X, ChevronDown, TrendingUp, ArrowDownRight } from 'lucide-react';
import { I18N, CURRENCY_SYMBOLS } from '../constants';
import TransactionList from './TransactionList';
import DatePickerModal from './DatePickerModal';

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  onAddClick: () => void;
  user: UserProfile;
  currentLedger: Ledger;
  categories: Category[];
  onViewHistory: () => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onBatchDelete?: (txIds: string[]) => void;
  onOpenSettings: () => void;
  onOpenLedgerList: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  accounts, transactions, onAddClick, user, currentLedger, categories, onViewHistory,
  currentDate, onDateChange, onEditTransaction, onBatchDelete, onOpenSettings, onOpenLedgerList
}) => {
  const t = I18N[user.language];
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // SAFE GUARDS: Default to empty arrays if props are somehow null
  const safeAccounts = accounts || [];
  const safeTransactions = transactions || [];

  // Filter Transactions by Month
  const filteredTransactions = useMemo(() => {
    const targetMonth = currentDate.getMonth();
    const targetYear = currentDate.getFullYear();
    
    let txs = safeTransactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      txs = txs.filter(t => 
        t.description.toLowerCase().includes(q) || 
        t.merchant?.toLowerCase().includes(q) ||
        t.amount.toString().includes(q)
      );
    }
    return txs;
  }, [safeTransactions, currentDate, searchQuery]);

  // Monthly Stats
  const monthlyExpense = useMemo(() => 
    filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, curr) => acc + curr.amount, 0)
  , [filteredTransactions]);
  
  const monthlyIncome = useMemo(() => 
    filteredTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, curr) => acc + curr.amount, 0)
  , [filteredTransactions]);

  const monthlyBalance = monthlyIncome - monthlyExpense;

  // Handlers
  const formatDate = (date: Date) => {
    if (user.language === 'zh') {
      return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
    }
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  };

  const currencySymbol = CURRENCY_SYMBOLS[currentLedger.currency] || currentLedger.currency;

  return (
    <div className="relative min-h-full pb-32 md:pb-0 animate-fade-in bg-[#F2F2F7]">
      
      {/* 1. Header: Minimalist iCost Style - Single Row Forced */}
      <header className="flex justify-between items-center px-5 h-[60px] pt-4 pb-2 bg-transparent sticky top-0 z-20 backdrop-blur-sm">
         {/* Left: Ledger Title (Clickable) */}
         <button 
           onClick={onOpenLedgerList}
           className="flex items-center gap-2 active:opacity-60 transition-opacity"
         >
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none truncate max-w-[200px] text-left">
              {currentLedger.name}
            </h1>
            <ChevronDown size={20} className="text-gray-400 shrink-0" strokeWidth={3} />
         </button>

         {/* Right: Actions */}
         <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-900 border border-gray-100 active:scale-90 transition-transform"
            >
              <Search size={18} strokeWidth={2.5} />
            </button>
            <button 
              onClick={onOpenSettings}
              className="w-9 h-9 rounded-full overflow-hidden border border-white shadow-sm active:scale-90 transition-transform"
            >
              <img src={user.avatar} className="w-full h-full object-cover" alt="Settings" />
            </button>
         </div>
      </header>
      
      {/* 2. Search Bar Expansion */}
      {isSearchOpen && (
         <div className="px-5 my-1 animate-fade-in-down">
            <div className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm border border-gray-100">
               <Search size={18} className="text-gray-400 ml-1" />
               <input 
                 autoFocus
                 placeholder={t.searchPlaceholder} 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="flex-1 bg-transparent outline-none font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-300 text-sm"
               />
               {searchQuery && (
                 <button onClick={() => setSearchQuery('')} className="p-1 bg-gray-100 rounded-full text-gray-400">
                   <X size={14} />
                 </button>
               )}
            </div>
         </div>
      )}

      {/* 3. Date Selector: Compact */}
      <div className="flex items-center px-5 mt-0 mb-2">
          <button onClick={() => setDatePickerOpen(true)} className="flex items-center gap-1 text-base font-bold text-gray-500 hover:text-gray-900 transition-colors py-1">
             {formatDate(currentDate)} 
             <ChevronRight size={14} className="mt-0.5" strokeWidth={3}/>
          </button>
      </div>

      {/* 4. Monthly Overview Card: Compact & iCost Style (slightly narrower than list for visual hierarchy) */}
      <div className="bg-white rounded-[1.8rem] px-5 pt-5 pb-5 shadow-sm border border-gray-100 mb-4 mx-5 relative overflow-hidden flex flex-col">
          {/* Label */}
          <p className="text-xs font-bold text-gray-400 mb-1 ml-0.5">{t.monthlyExpense}</p>

          {/* Main Amount */}
          <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl font-bold text-gray-300 translate-y-[-2px]">{currencySymbol}</span>
              <span className="text-5xl font-black text-gray-900 tracking-tighter leading-none">
                  {monthlyExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
          </div>
          
          {/* Footer Info: Single Row */}
          <div className="flex items-center gap-3 text-sm font-bold text-gray-500">
              <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mb-0.5"></div>
                  <span className="opacity-80 text-xs">{t.monthlyIncome}</span>
                  <span className="text-gray-900 font-extrabold">{monthlyIncome.toLocaleString()}</span>
              </div>
              <span className="text-gray-200 font-light">|</span>
              <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full mb-0.5 ${monthlyBalance >= 0 ? 'bg-indigo-500' : 'bg-red-500'}`}></div>
                  <span className="opacity-80 text-xs">{t.monthlyBalance}</span>
                  <span className={`font-extrabold ${monthlyBalance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                      {monthlyBalance.toLocaleString()}
                  </span>
              </div>
          </div>
      </div>

      {/* Filtered Transaction List (match card width) */}
      <div className="px-5">
         <TransactionList 
            transactions={filteredTransactions} 
            user={user} 
            categories={categories}
            accounts={safeAccounts}
            onEdit={onEditTransaction}
            onBatchDelete={onBatchDelete}
         />
      </div>

      {/* "Record" (Add Transaction) Floating Button */}
      <button 
        onClick={onAddClick}
        className="fixed bottom-28 md:bottom-10 right-6 md:right-10 w-16 h-16 bg-black text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50 group"
        style={{ bottom: 'calc(112px + env(safe-area-inset-bottom, 0px))' }} // lift higher above nav + gesture area for aesthetics
      >
        <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      {isDatePickerOpen && (
        <DatePickerModal 
            isOpen={isDatePickerOpen} 
            onClose={() => setDatePickerOpen(false)} 
            currentDate={currentDate}
            onDateChange={onDateChange}
            user={user}
        />
      )}
    </div>
  );
};

export default Dashboard;
