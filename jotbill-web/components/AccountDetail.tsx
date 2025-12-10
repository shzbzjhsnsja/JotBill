import React, { useState } from 'react';
import { ArrowLeft, Edit2, Wallet, CreditCard, Banknote, TrendingUp, Smartphone, Users, HandCoins, Calendar, AlertCircle, Percent, Split, CalendarClock } from 'lucide-react';
import { Account, Transaction, UserProfile, Category } from '../types';
import { I18N, CURRENCY_SYMBOLS } from '../constants';
import TransactionList from './TransactionList';
import InstallmentDetailModal from './InstallmentDetailModal';

interface AccountDetailProps {
  account: Account;
  transactions: Transaction[];
  user: UserProfile;
  categories: Category[];
  onBack: () => void;
  onEdit: (account: Account) => void;
  onEarlyRepayment?: (txId: string) => void;
}

const AccountDetail: React.FC<AccountDetailProps> = ({ account, transactions, user, categories, onBack, onEdit, onEarlyRepayment }) => {
  const t = I18N[user.language];
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'INSTALLMENTS'>('HISTORY');
  const [selectedInstallment, setSelectedInstallment] = useState<Transaction | null>(null);

  const getTypeIcon = (type: string) => {
    switch(type) {
        case 'CHECKING': return <CreditCard size={24}/>;
        case 'SAVINGS': return <Banknote size={24}/>;
        case 'CREDIT_CARD': return <CreditCard size={24}/>;
        case 'CASH': return <Wallet size={24}/>;
        case 'INVESTMENT': return <TrendingUp size={24}/>;
        case 'ALIPAY': 
        case 'WECHAT': return <Smartphone size={24}/>;
        case 'HUABEI': return <CreditCard size={24}/>;
        case 'DEBT': return <Users size={24}/>;
        case 'RECEIVABLE': return <HandCoins size={24}/>;
        default: return <Wallet size={24}/>;
    }
  };

  // Stats Logic
  const limit = account.creditLimit || 0;
  const debt = account.balance < 0 ? Math.abs(account.balance) : 0;
  const utilization = limit > 0 ? (debt / limit) * 100 : 0;
  
  // Active Installments: Has total > 0, Current < Total, Status not completed
  const activeInstallments = transactions.filter(t => 
    (t.installmentTotal || 0) > 0 && 
    (t.installmentCurrent || 0) < (t.installmentTotal || 0) &&
    t.installmentStatus !== 'EARLY_REPAID' &&
    t.installmentStatus !== 'COMPLETED'
  );

  return (
    <div className="flex flex-col h-screen bg-[#F2F2F7] animate-slide-in-right fixed inset-0 z-50">
      
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-4 py-3 border-b border-gray-200/50 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-900">
                <ArrowLeft size={22} />
            </button>
            <h1 className="text-lg font-bold text-gray-900">{account.name}</h1>
        </div>
        <button 
            onClick={() => onEdit(account)}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition-colors"
        >
            <Edit2 size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
         
         {/* Hero Card */}
         <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden">
             <div className="flex justify-between items-start mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg ${
                    account.balance < 0 ? 'bg-red-500' : 'bg-black'
                }`}>
                    {getTypeIcon(account.type)}
                </div>
                <div className="text-right">
                    <p className="text-sm font-bold text-gray-400 uppercase">{t.accTypes[account.type]}</p>
                    <p className={`text-3xl font-black mt-1 ${account.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {CURRENCY_SYMBOLS[account.currency]}
                        {Math.abs(account.balance).toLocaleString()}
                        {account.balance < 0 && <span className="text-xs ml-1 text-red-300 font-bold">{t.owed}</span>}
                    </p>
                </div>
             </div>

             {/* Specific Stats Row */}
             {(account.type === 'CREDIT_CARD' || account.type === 'HUABEI') && (
                 <div className="space-y-4">
                    <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-400">{t.creditLimit}</span>
                        <span className="text-sm font-bold text-gray-900">{CURRENCY_SYMBOLS[account.currency]}{limit.toLocaleString()}</span>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-gray-400">{t.utilization}</span>
                            <span className={utilization > 50 ? 'text-orange-500' : 'text-green-500'}>{utilization.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${utilization > 90 ? 'bg-red-500' : utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                                style={{width: `${Math.min(utilization, 100)}%`}}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pt-2">
                        {account.statementDay && (
                            <div className="flex-none bg-blue-50 text-blue-600 px-3 py-2 rounded-xl flex items-center gap-2">
                                <Calendar size={14} />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase opacity-60">{t.billDay}</span>
                                    <span className="text-xs font-black">{account.statementDay}</span>
                                </div>
                            </div>
                        )}
                        {account.paymentDueDay && (
                            <div className="flex-none bg-orange-50 text-orange-600 px-3 py-2 rounded-xl flex items-center gap-2">
                                <AlertCircle size={14} />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase opacity-60">{t.repayDay}</span>
                                    <span className="text-xs font-black">{account.paymentDueDay}</span>
                                </div>
                            </div>
                        )}
                        {activeInstallments.length > 0 && (
                            <div className="flex-none bg-purple-50 text-purple-600 px-3 py-2 rounded-xl flex items-center gap-2">
                                 <Split size={14} />
                                 <div className="flex flex-col">
                                     <span className="text-[10px] font-bold uppercase opacity-60">{t.installments}</span>
                                     <span className="text-xs font-black">{activeInstallments.length} {t.active}</span>
                                 </div>
                            </div>
                        )}
                    </div>
                 </div>
             )}

             {(account.type === 'DEBT' || account.type === 'RECEIVABLE') && (
                 <div className="flex gap-3 pt-2">
                    {account.interestRate && (
                        <div className="flex-1 bg-purple-50 text-purple-600 p-3 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <Percent size={14} />
                                <span className="text-[10px] font-bold uppercase">APR</span>
                            </div>
                            <p className="text-lg font-black">{account.interestRate}%</p>
                        </div>
                    )}
                    {account.dueDate && (
                        <div className="flex-1 bg-gray-100 text-gray-600 p-3 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <Calendar size={14} />
                                <span className="text-[10px] font-bold uppercase">{t.dueDate}</span>
                            </div>
                            <p className="text-lg font-black">{account.dueDate}</p>
                        </div>
                    )}
                 </div>
             )}
         </div>

         {/* Tabs */}
         <div className="bg-gray-200 p-1 rounded-xl flex">
             <button 
                onClick={() => setActiveTab('HISTORY')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'HISTORY' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
             >
                 {t.history}
             </button>
             <button 
                onClick={() => setActiveTab('INSTALLMENTS')}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'INSTALLMENTS' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
             >
                 {t.installments}
             </button>
         </div>

         {/* Content */}
         <div>
            {activeTab === 'HISTORY' ? (
                transactions.length > 0 ? (
                    <TransactionList 
                        transactions={transactions} 
                        user={user} 
                        categories={categories}
                        compact
                    />
                ) : (
                    <div className="p-10 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                        <p className="text-sm font-medium">{t.noTransactions}</p>
                    </div>
                )
            ) : (
                <div className="space-y-4">
                     {activeInstallments.length > 0 ? activeInstallments.map(tx => {
                         const total = tx.installmentTotal || 12;
                         const current = tx.installmentCurrent || 1;
                         const percent = (current / total) * 100;
                         const monthly = (tx.amount + (tx.installmentFee || 0)) / total;
                         
                         return (
                             <div 
                                key={tx.id} 
                                onClick={() => setSelectedInstallment(tx)}
                                className="clickable bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-95 transition-transform"
                             >
                                 <div className="flex justify-between items-start mb-2">
                                     <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                             <Split size={20} />
                                         </div>
                                         <div>
                                             <p className="font-bold text-gray-900">{tx.description}</p>
                                             <p className="text-xs text-gray-400">{t.date}: {tx.date}</p>
                                         </div>
                                     </div>
                                     <div className="text-right">
                                         <p className="font-bold text-gray-900">{CURRENCY_SYMBOLS[tx.currency]}{monthly.toLocaleString(undefined, {maximumFractionDigits:0})} / mo</p>
                                         <div className="flex items-center gap-1 justify-end text-blue-500 text-xs font-bold mt-1">
                                             <CalendarClock size={12}/>
                                             <span>{current} / {total}</span>
                                         </div>
                                     </div>
                                 </div>
                                 <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mt-3">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full" 
                                        style={{width: `${percent}%`}}
                                    />
                                 </div>
                             </div>
                         );
                     }) : (
                        <div className="p-10 text-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                            <p className="text-sm font-medium">{t.noActivePlan}</p>
                        </div>
                     )}
                </div>
            )}
         </div>
         
         <div className="h-10"/>
      </div>

      {selectedInstallment && onEarlyRepayment && (
          <InstallmentDetailModal 
              isOpen={!!selectedInstallment}
              onClose={() => setSelectedInstallment(null)}
              transaction={selectedInstallment}
              user={user}
              account={account}
              onEarlyRepayment={onEarlyRepayment}
          />
      )}
    </div>
  );
};

export default AccountDetail;