
import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import { Transaction, TransactionType, UserProfile, Category, Account, Ledger } from '../types';
import { I18N, CURRENCY_SYMBOLS, ICON_MAP } from '../constants';
import { Sparkles, X, Bot, Calendar, BarChart3, TrendingDown, TrendingUp, Tag } from 'lucide-react';
import { generateMonthlyReport } from '../services/reportService';
import CalendarView from './CalendarView';

interface ReportsProps {
  transactions: Transaction[];
  user: UserProfile;
  categories: Category[];
  currentDate: Date;
  accounts: Account[];
  currentLedger: Ledger;
  exchangeRates: Record<string, number>;
}

const COLORS = ['#007AFF', '#FF9500', '#34C759', '#FF3B30', '#AF52DE', '#5856D6', '#5AC8FA', '#4CD964'];

const Reports: React.FC<ReportsProps> = ({ transactions, user, categories, currentDate, accounts, currentLedger, exchangeRates }) => {
  const t = I18N[user.language];
  const [viewType, setViewType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [activeTab, setActiveTab] = useState<'CHARTS' | 'CALENDAR'>('CHARTS');
  
  // AI Report State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const currencySymbol = CURRENCY_SYMBOLS[currentLedger.currency] || '$';

  // 1. Filter Transactions by Current Month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth();
    });
  }, [transactions, currentDate]);

  // Helper to find category info
  const getCategoryInfo = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (cat) return cat;
    for (const c of categories) {
        if (c.subCategories) {
            const sub = c.subCategories.find(s => s.id === id);
            if (sub) return sub;
        }
    }
    return null;
  };

  const handleGenerateReport = async () => {
      setIsReportModalOpen(true);
      setIsGenerating(true);
      setReport(null);
      
      try {
          // Pass user language and rates to the service
          const result = await generateMonthlyReport(currentDate.getFullYear(), currentDate.getMonth(), user.language, exchangeRates);
          setReport(result);
      } catch (e) {
          console.error(e);
          setReport(t.failedReport || "Error generating report.");
      } finally {
          setIsGenerating(false);
      }
  };

  // 2. Core Metrics Data
  const totalAmount = useMemo(() => {
      return monthlyTransactions
        .filter(t => t.type === viewType)
        .reduce((sum, t) => sum + t.amount, 0);
  }, [monthlyTransactions, viewType]);

  // 3. Trend Data (Daily Breakdown of Current Month)
  const chartData = useMemo(() => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const totalsByDay = new Map<string, number>();

    monthlyTransactions
      .filter(t => t.type === viewType)
      .forEach(t => {
        // Transactions are stored as ISO strings with time (e.g. 2025-12-14T00:00:00),
        // so we must normalize to YYYY-MM-DD to aggregate correctly.
        const dayKey = String(t.date).split('T')[0];
        totalsByDay.set(dayKey, (totalsByDay.get(dayKey) || 0) + t.amount);
      });

    const data: { name: string; fullDate: string; amount: number }[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      data.push({
        name: String(i),
        fullDate: dateStr,
        amount: totalsByDay.get(dateStr) || 0,
      });
    }
    return data;
  }, [monthlyTransactions, currentDate, viewType]);

  // 4. Category Data
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    
    monthlyTransactions
      .filter(t => t.type === viewType)
      .forEach(t => {
        const cat = getCategoryInfo(t.categoryId);
        const name = cat ? cat.name : 'Uncategorized';
        // Simplified: Group by Name for display
        map.set(name, (map.get(name) || 0) + t.amount);
      });
    
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);

    return Array.from(map.entries())
        .map(([name, value]) => {
            // Find icon
            const catObj = categories.find(c => c.name === name) || categories.flatMap(c=>c.subCategories || []).find(s=>s.name===name);
            const icon = catObj ? catObj.icon : 'tag';
            return {
                name,
                value,
                icon,
                percentage: total > 0 ? (value / total) * 100 : 0
            };
        })
        .sort((a, b) => b.value - a.value);
  }, [monthlyTransactions, viewType, categories]);

  return (
    <div className="pb-32 md:pb-0 animate-fade-in space-y-6 max-w-4xl mx-auto relative min-h-[80vh]">
      
      {/* View Switcher */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-200/80 p-1 rounded-xl flex w-full max-w-[200px] shadow-inner">
            <button 
                onClick={() => setActiveTab('CHARTS')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'CHARTS' ? 'bg-white text-gray-900 shadow-sm scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <BarChart3 size={14} />
                {t.charts}
            </button>
            <button 
                onClick={() => setActiveTab('CALENDAR')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'CALENDAR' ? 'bg-white text-gray-900 shadow-sm scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Calendar size={14} />
                {t.calendar}
            </button>
        </div>
      </div>

      {activeTab === 'CHARTS' ? (
        <>
            <div className="flex justify-between items-center mb-2 px-2">
                <h2 className="text-2xl font-bold text-gray-900">{t.reports}</h2>
                <div className="bg-gray-200 p-1 rounded-xl flex">
                    <button 
                        onClick={() => setViewType(TransactionType.EXPENSE)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewType === TransactionType.EXPENSE ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        {t.expenses}
                    </button>
                    <button 
                        onClick={() => setViewType(TransactionType.INCOME)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewType === TransactionType.INCOME ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                    >
                        {t.income}
                    </button>
                </div>
            </div>

            {/* 1. Core Metrics Card */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                        {t.total} {viewType === TransactionType.EXPENSE ? t.expense : t.income}
                    </span>
                    <h3 className="text-4xl font-black text-gray-900 tracking-tight">
                        {currencySymbol}{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    {/* Placeholder Comparison Data removed as hardcoded text was problematic */}
                </div>
            </div>

            {/* 2. Smooth Trend Area Chart */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">{t.spendingActivity}</h3>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={viewType === TransactionType.EXPENSE ? "#007AFF" : "#34C759"} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={viewType === TransactionType.EXPENSE ? "#007AFF" : "#34C759"} stopOpacity={0}/>
                        </linearGradient>
                        </defs>
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#9CA3AF', fontSize: 10, fontWeight: 'bold'}} 
                            dy={10}
                            interval={4} // Show fewer labels
                        />
                        <Tooltip 
                            contentStyle={{
                                borderRadius: '16px', 
                                border: 'none', 
                                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                padding: '12px 16px',
                                fontWeight: 'bold'
                            }}
                            cursor={{stroke: '#007AFF', strokeWidth: 1, strokeDasharray: '4 4'}}
                            formatter={(value: number) => [`${currencySymbol}${value}`, 'Amount']}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="amount" 
                            stroke={viewType === TransactionType.EXPENSE ? "#007AFF" : "#34C759"} 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorAmount)" 
                        />
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Category Breakdown (Split View) */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">{viewType === TransactionType.EXPENSE ? t.expensesByCat : t.incomeByCat}</h3>
                
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Left: Donut Chart */}
                    <div className="w-full md:w-2/5 h-48 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                            <Pie
                                data={categoryData}
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={4}
                                dataKey="value"
                                cornerRadius={4}
                            >
                                {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                ))}
                            </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center Total Text Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs font-bold text-gray-400">{t.total}</span>
                            <span className="text-sm font-black text-gray-900">{currencySymbol}{totalAmount.toLocaleString(undefined, {notation: "compact"})}</span>
                        </div>
                    </div>

                    {/* Right: Detailed List */}
                    <div className="w-full md:w-3/5 space-y-3">
                        {categoryData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
                                {/* Icon */}
                                <div 
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                >
                                    {ICON_MAP[entry.icon] || <Tag size={16}/>}
                                </div>
                                
                                {/* Name & Bar */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-bold text-gray-900 truncate">{entry.name}</span>
                                        <span className="text-sm font-bold text-gray-900">{currencySymbol}{entry.value.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full" 
                                                style={{ 
                                                    width: `${entry.percentage}%`, 
                                                    backgroundColor: COLORS[index % COLORS.length] 
                                                }} 
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 w-8 text-right">{entry.percentage.toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {categoryData.length === 0 && (
                            <div className="text-center py-8 text-gray-400 font-medium text-sm">
                                {t.noTransactions}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
      ) : (
        <CalendarView 
            transactions={monthlyTransactions}
            currentDate={currentDate}
            user={user}
            categories={categories}
            accounts={accounts}
        />
      )}

      {/* Floating Magic AI Button */}
      <button 
         onClick={handleGenerateReport}
         className="fixed bottom-28 md:bottom-10 right-6 md:right-10 w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all z-50 group animate-bounce-slow"
         style={{ bottom: 'calc(112px + env(safe-area-inset-bottom, 0px))' }} // keep above nav and gesture area, slightly higher for visual balance
      >
         <div className="absolute inset-0 bg-white rounded-full opacity-20 group-hover:animate-ping"></div>
         <Sparkles size={32} className="relative z-10" />
      </button>

      {/* AI Report Modal */}
      {isReportModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 24px) + 16px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 24px) + 16px)',
            }}
          >
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isGenerating && setIsReportModalOpen(false)}></div>
              
              <div
                className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden flex flex-col animate-scale-in"
                style={{
                  height: 'min(68vh, calc(100vh - env(safe-area-inset-top, 24px) - env(safe-area-inset-bottom, 24px) - 120px))',
                  maxHeight: 'min(68vh, calc(100vh - env(safe-area-inset-top, 24px) - env(safe-area-inset-bottom, 24px) - 120px))',
                  minHeight: '60vh',
                }}
              >
                  
                  {/* Header */}
                  <div className="px-8 py-6 bg-gradient-to-r from-indigo-50 to-purple-50 flex justify-between items-center border-b border-gray-100">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                              <Bot size={24} />
                          </div>
                          <div>
                              <h3 className="text-lg font-black text-gray-900">{t.aiAdvisor}</h3>
                              <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">{t.monthlyAnalysis}</p>
                          </div>
                      </div>
                      <button 
                        onClick={() => setIsReportModalOpen(false)} 
                        className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors shadow-sm"
                      >
                          <X size={20} />
                      </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-8 pr-10 pb-10 bg-white min-h-0">
                      {isGenerating ? (
                          <div className="flex flex-col items-center justify-center h-full py-10 space-y-8">
                              {/* Herta-style Kuru Kuru Animation */}
                              <div className="relative">
                                  <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                                  <div className="w-24 h-24 bg-gradient-to-tr from-indigo-400 to-purple-400 rounded-xl rotate-45 animate-spin flex items-center justify-center shadow-xl">
                                      <div className="w-16 h-16 bg-white/90 rounded-lg" />
                                  </div>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                      <Sparkles size={40} className="text-purple-600 animate-pulse" />
                                  </div>
                              </div>
                              
                              <div className="text-center space-y-2">
                                  <h4 className="text-xl font-black text-gray-900">{t.thinking}</h4>
                                  <p className="text-gray-400 font-medium">{t.kuruKuru}</p>
                              </div>
                          </div>
                      ) : (
                          <div className="prose prose-indigo prose-lg max-w-none">
                              {/* Simple Markdown Rendering */}
                              {report ? report.split('\n').map((line, i) => {
                                  // Headers
                                  if (line.trim().startsWith('##')) return <h2 key={i} className="text-xl font-bold text-gray-900 mt-6 mb-3">{line.replace(/#/g, '')}</h2>;
                                  if (line.trim().startsWith('**')) return <p key={i} className="font-bold text-gray-800 mt-4 mb-2">{line.replace(/\*\*/g, '')}</p>;
                                  // Lists
                                  if (line.trim().startsWith('-')) return (
                                      <div key={i} className="flex gap-3 mb-2 pl-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2.5 flex-shrink-0" />
                                          <p className="text-gray-600 leading-relaxed">{line.replace('-', '').trim()}</p>
                                      </div>
                                  );
                                  // Normal text
                                  return <p key={i} className="text-gray-600 mb-2 leading-relaxed">{line}</p>;
                              }) : (
                                  <div className="text-center text-gray-400 py-10">
                                      <p>{t.failedReport || "Failed to generate report."}</p>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>

                  {/* Footer */}
                  {!isGenerating && (
                      <div className="p-6 border-t border-gray-50 bg-gray-50/50 flex justify-end">
                          <button 
                            onClick={() => setIsReportModalOpen(false)}
                            className="px-8 py-3 bg-black text-white font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                          >
                              {t.gotIt}
                          </button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default Reports;
