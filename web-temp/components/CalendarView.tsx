
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, UserProfile, Category, Account } from '../types';
import { X } from 'lucide-react';
import { I18N } from '../constants';
import TransactionList from './TransactionList';

interface CalendarViewProps {
  transactions: Transaction[];
  currentDate: Date;
  user: UserProfile;
  categories: Category[];
  accounts: Account[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ transactions, currentDate, user, categories, accounts }) => {
  const t = I18N[user.language];
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // 1. Get Calendar Info
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun

  // 2. Process Data
  const dailyData = useMemo(() => {
    const map = new Map<number, { expense: number; income: number; transactions: Transaction[] }>();
    
    // Initialize
    for (let i = 1; i <= daysInMonth; i++) {
        map.set(i, { expense: 0, income: 0, transactions: [] });
    }

    transactions.forEach(tx => {
        const d = new Date(tx.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
            const day = d.getDate();
            const data = map.get(day);
            if (data) {
                if (tx.type === TransactionType.EXPENSE) {
                    data.expense += tx.amount;
                } else if (tx.type === TransactionType.INCOME) {
                    data.income += tx.amount;
                }
                data.transactions.push(tx);
            }
        }
    });
    return map;
  }, [transactions, year, month, daysInMonth]);

  const maxExpense = useMemo(() => {
      let max = 0;
      dailyData.forEach(v => {
          if (v.expense > max) max = v.expense;
      });
      return max;
  }, [dailyData]);

  // 3. Render Helper
  const renderDays = () => {
    const days = [];
    
    // Padding for empty start
    for (let i = 0; i < firstDayOfWeek; i++) {
        days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
        const data = dailyData.get(day);
        const expense = data?.expense || 0;
        const income = data?.income || 0;
        const hasExpense = expense > 0;
        const hasIncome = income > 0;
        const hasActivity = hasExpense || hasIncome;
        
        // Calculate opacity for red background (Driven by Expense intensity)
        const intensity = hasExpense && maxExpense > 0 ? (expense / maxExpense) : 0;
        const bgOpacity = hasExpense ? (intensity * 0.2 + 0.05) : 0;
        
        let bgColor = 'transparent';
        let borderColor = 'transparent';

        if (hasExpense) {
            bgColor = `rgba(255, 59, 48, ${bgOpacity})`;
            borderColor = `rgba(255, 59, 48, ${Math.min(bgOpacity + 0.1, 0.3)})`;
        } else if (hasIncome) {
             // Very subtle green for income-only days
             bgColor = `rgba(52, 199, 89, 0.05)`;
             borderColor = `rgba(52, 199, 89, 0.1)`;
        }
        
        days.push(
            <button 
                key={day}
                onClick={() => setSelectedDate(new Date(year, month, day))}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1 md:pt-1.5 border transition-all duration-200 ${hasActivity ? 'hover:brightness-95' : 'hover:bg-gray-50 border-gray-100'} active:scale-95 overflow-hidden`}
                style={{ 
                    backgroundColor: bgColor,
                    borderColor: hasActivity ? borderColor : 'transparent'
                }}
            >
                <span className={`text-[10px] md:text-xs font-bold mb-0.5 ${hasActivity ? 'text-gray-700' : 'text-gray-400'}`}>{day}</span>
                
                <div className="flex flex-col items-center gap-0 w-full px-0.5">
                    {hasIncome && (
                        <span className="text-[8px] md:text-[9px] font-black text-green-600 tracking-tighter leading-none truncate w-full text-center">
                           +{Math.round(income)}
                        </span>
                    )}
                    {hasExpense && (
                        <span className="text-[8px] md:text-[9px] font-black text-red-500 tracking-tighter leading-none truncate w-full text-center">
                           -{Math.round(expense)}
                        </span>
                    )}
                </div>
            </button>
        );
    }
    return days;
  };

  const weekDays = user.language === 'zh' 
    ? ['日', '一', '二', '三', '四', '五', '六'] 
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Modal Transactions
  const selectedTransactions = useMemo(() => {
      if (!selectedDate) return [];
      const day = selectedDate.getDate();
      const data = dailyData.get(day);
      return data ? data.transactions : [];
  }, [selectedDate, dailyData]);

  return (
    <div className="animate-fade-in">
        {/* Calendar Grid */}
        <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100">
            <div className="grid grid-cols-7 mb-2">
                {weekDays.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-gray-400 py-2">
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                {renderDays()}
            </div>
        </div>

        {/* Day Detail Modal */}
        {selectedDate && (
             <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedDate(null)}></div>
                
                {/* Modal Content */}
                <div className="bg-[#F2F2F7] w-full max-w-md h-[70vh] rounded-t-[2rem] md:rounded-[2rem] shadow-2xl relative z-10 animate-slide-in-up flex flex-col overflow-hidden">
                    <div className="bg-white p-4 rounded-t-[2rem] border-b border-gray-200 flex justify-between items-center sticky top-0 z-20">
                        <div>
                             <h3 className="text-lg font-bold text-gray-900">
                                 {selectedDate.toLocaleDateString(user.language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}
                             </h3>
                             <div className="flex gap-3 text-xs font-bold mt-1">
                                {dailyData.get(selectedDate.getDate())?.income! > 0 && <span className="text-green-600">+{dailyData.get(selectedDate.getDate())?.income.toFixed(2)}</span>}
                                {dailyData.get(selectedDate.getDate())?.expense! > 0 && <span className="text-red-500">-{dailyData.get(selectedDate.getDate())?.expense.toFixed(2)}</span>}
                             </div>
                        </div>
                        <button onClick={() => setSelectedDate(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        <TransactionList 
                             transactions={selectedTransactions}
                             user={user}
                             categories={categories}
                             accounts={accounts} 
                        />
                    </div>
                </div>
             </div>
        )}
    </div>
  );
};

export default CalendarView;
