
import React, { useState, useRef } from 'react';
import { Transaction, TransactionType, UserProfile, Category, Account } from '../types';
import { HelpCircle, CalendarClock, Coins, Trash2, CheckCircle, Circle, X, AlertTriangle, ArrowRightLeft, Banknote } from 'lucide-react';
import { I18N, ICON_MAP } from '../constants';

interface TransactionListProps {
  transactions: Transaction[];
  user: UserProfile;
  limit?: number;
  compact?: boolean;
  categories: Category[];
  accounts?: Account[];
  onEdit?: (tx: Transaction) => void;
  onBatchDelete?: (txIds: string[]) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, user, limit, compact, categories, accounts, onEdit, onBatchDelete }) => {
  const t = I18N[user.language];
  
  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  // Long Press Refs
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defensive Check: Ensure transactions is an array
  if (!transactions || !Array.isArray(transactions)) {
    return null;
  }

  // Helper to find category info
  const getCategoryInfo = (categoryId: string) => {
    for (const cat of categories) {
      if (cat.id === categoryId) return cat;
      if (cat.subCategories) {
        const sub = cat.subCategories.find(s => s.id === categoryId);
        if (sub) return sub;
      }
    }
    return null;
  };

  const getAccountName = (accountId: string) => {
      const acc = accounts?.find(a => a.id === accountId);
      return acc ? acc.name : '';
  };

  // Group by date
  // NOTE: date field might be full ISO timestamp, need to split by 'T'
  const grouped = transactions.reduce((groups, transaction) => {
    const date = transaction.date.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  let sortedDates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  if (limit) {
    sortedDates = sortedDates.slice(0, limit); 
  }

  // Interaction Handlers
  const handleTouchStart = (id: string) => {
      if (isSelectionMode) return;
      timerRef.current = setTimeout(() => {
          setIsSelectionMode(true);
          toggleSelection(id);
          // Haptic feedback if available
          if (navigator.vibrate) navigator.vibrate(50);
      }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
      if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
      }
  };

  // If user scrolls, cancel the long press timer
  const handleTouchMove = () => {
      if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
      }
  };

  const toggleSelection = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const handleItemClick = (tx: Transaction) => {
      if (isSelectionMode) {
          toggleSelection(tx.id);
      } else {
          if (onEdit) onEdit(tx);
      }
  };

  const exitSelectionMode = () => {
      setIsSelectionMode(false);
      setSelectedIds(new Set());
      setIsDeleteConfirmOpen(false);
  };

  const performBatchDelete = () => {
      if (onBatchDelete && selectedIds.size > 0) {
          setIsDeleteConfirmOpen(true);
      }
  };

  const confirmBatchDelete = () => {
      if (onBatchDelete) {
          onBatchDelete(Array.from(selectedIds));
          exitSelectionMode();
      }
  };
  
  // Stagger Delay Counter
  let globalIndex = 0;

  return (
    <div className={`animate-fade-in ${compact ? 'pb-4' : 'pb-32'} md:pb-0 relative`}>
      <div className="space-y-6">
        {sortedDates.map(date => {
          const dailyTx = grouped[date];
          const dailyExpense = dailyTx
            .filter(tx => tx.type === TransactionType.EXPENSE)
            .reduce((sum, tx) => sum + tx.amount, 0);
          const dailyIncome = dailyTx
            .filter(tx => tx.type === TransactionType.INCOME)
            .reduce((sum, tx) => sum + tx.amount, 0);

          const dateObj = new Date(date);
          // Using UTC methods to avoid timezone shift when displaying the header date which is just YYYY-MM-DD
          const utcDateObj = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
          // But 'date' string is already YYYY-MM-DD, creating new Date(date) assumes UTC usually in standard environments for YYYY-MM-DD
          // However, to be safe for display we can just parse the string parts
          
          const dateStr = user.language === 'zh' 
            ? `${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${['周日','周一','周二','周三','周四','周五','周六'][dateObj.getDay()]}`
            : dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

          return (
            <div key={date}>
              <div className="flex justify-between items-center mb-2 px-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {dateStr}
                </h3>
                <div className="text-[10px] font-bold flex gap-3">
                  {dailyExpense > 0 && (
                    <span className="text-gray-500">{t.dayExp}: {dailyExpense.toFixed(2)}</span>
                  )}
                  {dailyIncome > 0 && (
                    <span className="text-green-600">{t.dayInc}: {dailyIncome.toFixed(2)}</span>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
                {dailyTx.map((tx, index) => {
                  const category = getCategoryInfo(tx.categoryId);
                  const accountName = getAccountName(tx.accountId);
                  const isInstallment = tx.installmentTotal && tx.installmentTotal > 1;
                  const isSelected = selectedIds.has(tx.id);
                  
                  // Parse Time if available (ISO string contains T)
                  let timeString = '';
                  if (tx.date.includes('T')) {
                      const d = new Date(tx.date);
                      timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  }

                  // Wave Animation Delay
                  const animDelay = Math.min(globalIndex * 0.05, 0.5);
                  globalIndex++;
                  
                  // --- ICON & COLOR LOGIC ---
                  let displayIcon = <HelpCircle size={18} />;
                  let displayColor = '#9CA3AF'; // Default Gray
                  let amountTextColor = 'text-gray-900';
                  let amountPrefix = '-';

                  if (tx.type === TransactionType.TRANSFER) {
                      displayIcon = <ArrowRightLeft size={18} />;
                      displayColor = '#007AFF'; 
                      amountTextColor = 'text-gray-500';
                      amountPrefix = '';
                  } else if (tx.type === TransactionType.INCOME) {
                      displayIcon = <Banknote size={18} />;
                      displayColor = '#34C759'; 
                      amountTextColor = 'text-green-600';
                      amountPrefix = '+';
                  } else {
                      if (category) {
                           if (ICON_MAP[category.icon]) {
                               displayIcon = ICON_MAP[category.icon] as React.ReactElement;
                           }
                           displayColor = category.color;
                      }
                      amountTextColor = 'text-gray-900';
                      amountPrefix = '-';
                  }

                  return (
                    <div 
                      key={tx.id} 
                      onClick={() => handleItemClick(tx)}
                      onTouchStart={() => handleTouchStart(tx.id)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                      onMouseDown={() => handleTouchStart(tx.id)}
                      onMouseUp={handleTouchEnd}
                      onMouseLeave={handleTouchEnd}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`clickable animate-stagger-item flex items-center p-4 hover:bg-gray-50 transition-all cursor-pointer select-none active:bg-gray-100 ${
                        index !== dailyTx.length - 1 ? 'border-b border-gray-50' : ''
                      } ${isSelected ? 'bg-blue-50/50' : ''}`}
                      style={{ animationDelay: `${animDelay}s` }}
                    >
                      {/* Selection Checkbox */}
                      {isSelectionMode && (
                          <div className="mr-3 animate-scale-in">
                              {isSelected ? (
                                  <CheckCircle className="text-blue-500 fill-blue-500 text-white" size={24} />
                              ) : (
                                  <Circle className="text-gray-300" size={24} />
                              )}
                          </div>
                      )}

                      <div 
                        className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-white shadow-sm transition-transform shrink-0"
                        style={{ backgroundColor: displayColor }}
                      >
                        {displayIcon}
                      </div>
                      <div className="ml-4 flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-between items-start">
                          <p 
                             className="text-sm font-bold text-gray-900 pr-2 truncate"
                             style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                             {tx.description || category?.name}
                          </p>
                          <div className="text-right shrink-0">
                              <p className={`text-sm font-bold ${amountTextColor}`}>
                                {amountPrefix}{tx.amount.toFixed(2)}
                              </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-0.5 min-w-0">
                           <div className="flex gap-2 text-xs items-center overflow-hidden flex-1 min-w-0">
                               <span className="text-gray-500 font-medium whitespace-nowrap shrink-0">{category?.name || 'Uncategorized'}</span>
                               {accountName && (
                                   <>
                                     <span className="text-gray-300 shrink-0">|</span>
                                     <span className="text-blue-500 font-medium whitespace-nowrap truncate">{accountName}</span>
                                   </>
                               )}
                               {/* Time Display if Available */}
                               {timeString && (
                                   <>
                                    <span className="text-gray-300 shrink-0">|</span>
                                    <span className="text-gray-400 font-medium">{timeString}</span>
                                   </>
                               )}
                               
                               {isInstallment && (
                                   <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md shrink-0 ml-1">
                                       <CalendarClock size={10} />
                                       <span className="text-[10px] font-bold">{t.period} {tx.installmentCurrent}/{tx.installmentTotal}</span>
                                   </div>
                               )}
                           </div>
                           <p className="text-[10px] text-gray-300 font-bold whitespace-nowrap ml-2 shrink-0">{tx.currency}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {sortedDates.length === 0 && (
           <div className="flex flex-col items-center justify-center py-20">
             <div className="text-6xl mb-4 transform hover:scale-110 transition-transform cursor-pointer">🌱</div>
             <p className="text-gray-900 font-bold text-lg">{t.freshStart}</p>
             <p className="text-gray-500 text-sm font-medium mt-1">{t.startTx}</p>
           </div>
        )}
      </div>
      
      {/* Bottom Batch Action Bar */}
      {isSelectionMode && (
          <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-3 bg-white/90 backdrop-blur-xl p-2 pr-3 rounded-full shadow-2xl border border-gray-200 animate-slide-in-up max-w-[90vw]">
              <span className="pl-4 pr-2 text-sm font-bold text-gray-700 whitespace-nowrap">
                  {selectedIds.size} {t.selected}
              </span>
              <button 
                  onClick={performBatchDelete}
                  disabled={selectedIds.size === 0}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all whitespace-nowrap ${selectedIds.size > 0 ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-gray-100 text-gray-300'}`}
              >
                  <Trash2 size={16} /> {t.batchDelete}
              </button>
              <button 
                  onClick={exitSelectionMode}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-bold transition-colors"
              >
                  <X size={18} />
              </button>
          </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsDeleteConfirmOpen(false)}></div>
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-scale-in">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                      <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                      {t.batchDelete} {selectedIds.size} Items?
                  </h3>
                  <p className="text-gray-500 text-center mb-6 text-sm font-medium">
                      {t.confirmBatchDelete.replace('{count}', selectedIds.size.toString())}
                  </p>
                  <div className="flex gap-3">
                      <button 
                          onClick={() => setIsDeleteConfirmOpen(false)}
                          className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-2xl transition-colors"
                      >
                          {t.cancel}
                      </button>
                      <button 
                          onClick={confirmBatchDelete}
                          className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-500/30 transition-colors"
                      >
                          {t.batchDelete}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TransactionList;
