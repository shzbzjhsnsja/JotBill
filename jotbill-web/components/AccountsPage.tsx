import React, { useMemo } from 'react';
import { Account, UserProfile, Ledger, Transaction } from '../types';
import { Plus, ChevronRight, Wallet, CreditCard, Smartphone, Banknote, Users, HandCoins, Calendar, AlertCircle, Percent, Split, TrendingUp } from 'lucide-react';
import { I18N, CURRENCY_SYMBOLS } from '../constants';

interface AccountsPageProps {
  accounts: Account[];
  user: UserProfile;
  currentLedger: Ledger;
  onAddAccount: () => void;
  onViewAccount: (account: Account) => void;
  transactions?: Transaction[];
  exchangeRates: Record<string, number>;
}

const AccountsPage: React.FC<AccountsPageProps> = ({ accounts, user, currentLedger, onAddAccount, onViewAccount, transactions = [], exchangeRates }) => {
  const t = I18N[user.language];

  // Calculate Net Worth and Total Liabilities
  const { netWorth, totalLiabilities, totalDebtValue, totalReceivableValue } = useMemo(() => {
      let nw = 0;
      let liabilities = 0;
      let debtVal = 0; // Owed to me (Receivable)
      let receivableVal = 0; // I owe (Debt)
      
      const targetCurrency = currentLedger.currency;
      
      // Conversion Logic using Dynamic Rates (Base CNY)
      // Rate = Units of Currency per 1 Base(CNY)
      // To convert AccountCurrency to TargetCurrency:
      // ValueInBase = Balance / RateOfAccount
      // ValueInTarget = ValueInBase * RateOfTarget
      const targetRate = exchangeRates[targetCurrency] || 1;

      accounts.forEach(acc => {
          if (acc.isExcluded) return;

          const accRate = exchangeRates[acc.currency] || 1;
          const balanceInTarget = (acc.balance / accRate) * targetRate;
          
          nw += balanceInTarget;

          // Liability Calculation (Negative Balances)
          if (balanceInTarget < 0) {
              liabilities += Math.abs(balanceInTarget);
          }

          // Specific Debt/Receivable Stats for the small cards
          if (acc.type === 'DEBT') {
              receivableVal += Math.abs(balanceInTarget);
          } else if (acc.type === 'RECEIVABLE') {
              debtVal += Math.abs(balanceInTarget);
          }
      });
      
      return { 
          netWorth: nw, 
          totalLiabilities: liabilities,
          totalDebtValue: debtVal,
          totalReceivableValue: receivableVal
      };
  }, [accounts, currentLedger.currency, exchangeRates]);

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'CHECKING': return <CreditCard size={18}/>;
          case 'SAVINGS': return <Banknote size={18}/>;
          case 'CREDIT_CARD': return <CreditCard size={18}/>;
          case 'CASH': return <Wallet size={18}/>;
          case 'INVESTMENT': return <TrendingUp size={18}/>;
          case 'ALIPAY': 
          case 'WECHAT': return <Smartphone size={18}/>;
          case 'HUABEI': return <CreditCard size={18}/>;
          case 'DEBT': return <Users size={18}/>;
          case 'RECEIVABLE': return <HandCoins size={18}/>;
          default: return <Wallet size={18}/>;
      }
  };

  // Group Accounts
  const liabilities = accounts.filter(a => ['CREDIT_CARD', 'HUABEI', 'DEBT'].includes(a.type));
  const assets = accounts.filter(a => !['CREDIT_CARD', 'HUABEI', 'DEBT'].includes(a.type));

  const renderAccountCard = (acc: Account) => {
      // Calculate Utilization for Credit
      const limit = acc.creditLimit || 0;
      const debt = acc.balance < 0 ? Math.abs(acc.balance) : 0;
      const utilization = limit > 0 ? (debt / limit) * 100 : 0;
      
      // Calculate Days Left for Debt
      let daysLeftText = '';
      if (acc.dueDate) {
          const due = new Date(acc.dueDate);
          const now = new Date();
          const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          daysLeftText = diff >= 0 ? `${diff} ${t.daysLeft}` : t.overdue;
      }

      // Count active installments
      const activeInstallments = transactions.filter(t => t.accountId === acc.id && (t.installmentTotal || 0) > 0 && (t.installmentCurrent || 0) < (t.installmentTotal || 0)).length;

      return (
        <div 
            key={acc.id} 
            onClick={() => onViewAccount(acc)}
            className={`clickable bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-2 hover:bg-gray-50 transition-colors cursor-pointer group ${acc.isExcluded ? 'opacity-60' : ''}`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 transition-all ${acc.isExcluded ? 'bg-gray-100' : 'bg-gray-50 group-hover:bg-white group-hover:shadow-sm'}`}>
                    {getTypeIcon(acc.type)}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 truncate">
                        {acc.name}
                        {acc.isExcluded && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-medium shrink-0">{t.hidden}</span>}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium truncate">{t.accTypes[acc.type] || acc.type}</p>
                </div>
                <div className="text-right shrink-0">
                    <p className={`font-bold ${acc.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                        {CURRENCY_SYMBOLS[acc.currency]}{Math.abs(acc.balance).toLocaleString()}
                        {acc.balance < 0 && <span className="text-xs ml-1">{t.owed}</span>}
                    </p>
                    <p className="text-[10px] text-gray-400 font-bold">{acc.currency}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
            </div>

            {/* Credit Card Specifics Preview */}
            {(acc.type === 'CREDIT_CARD' || acc.type === 'HUABEI') && (
                <div className="mt-1 pt-2 border-t border-gray-50 space-y-2">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-gray-400 font-medium">{t.creditLimit}: {CURRENCY_SYMBOLS[acc.currency]}{limit.toLocaleString()}</span>
                         <span className="text-gray-900 font-bold">{utilization.toFixed(0)}% {t.used}</span>
                     </div>
                     <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${utilization > 90 ? 'bg-red-500' : utilization > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                            style={{width: `${Math.min(utilization, 100)}%`}}
                        />
                     </div>
                     {(acc.statementDay || acc.paymentDueDay || activeInstallments > 0) && (
                         <div className="flex gap-3 mt-1 overflow-x-auto no-scrollbar">
                            {acc.statementDay && (
                                <div className="flex items-center gap-1 text-blue-600 whitespace-nowrap">
                                    <Calendar size={10}/>
                                    <span className="text-[10px] font-bold">{t.billDay}: {acc.statementDay}</span>
                                </div>
                            )}
                            {acc.paymentDueDay && (
                                <div className="flex items-center gap-1 text-orange-600 whitespace-nowrap">
                                    <AlertCircle size={10}/>
                                    <span className="text-[10px] font-bold">{t.repayDay}: {acc.paymentDueDay}</span>
                                </div>
                            )}
                            {activeInstallments > 0 && (
                                <div className="flex items-center gap-1 text-purple-600 whitespace-nowrap">
                                    <Split size={10}/>
                                    <span className="text-[10px] font-bold">{activeInstallments} {t.active}</span>
                                </div>
                            )}
                         </div>
                     )}
                </div>
            )}

            {/* Debt / Loan Specifics Preview */}
            {(acc.type === 'DEBT' || acc.type === 'RECEIVABLE') && (
                <div className="mt-1 pt-2 border-t border-gray-50 flex gap-2">
                     {acc.interestRate && (
                        <div className="flex items-center gap-1 text-purple-600 px-1 py-0.5 rounded-lg flex-1 justify-center bg-purple-50/50">
                            <Percent size={10}/>
                            <span className="text-[10px] font-bold">APR: {acc.interestRate}%</span>
                        </div>
                     )}
                     {acc.dueDate && (
                        <div className={`flex items-center gap-1 px-1 py-0.5 rounded-lg flex-1 justify-center ${daysLeftText === t.overdue ? 'text-red-600 bg-red-50/50' : 'text-gray-500 bg-gray-100/50'}`}>
                            <Calendar size={10}/>
                            <span className="text-[10px] font-bold">{acc.dueDate} ({daysLeftText})</span>
                        </div>
                     )}
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="pb-24 md:pb-0 animate-fade-in max-w-2xl mx-auto relative px-2">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t.accounts}</h2>
        <button 
          onClick={onAddAccount}
          className="p-2 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* 1. Net Assets Hero Card */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 mb-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">{t.netWorth}</p>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                {CURRENCY_SYMBOLS[currentLedger.currency]}{netWorth.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </h2>
            <div className="inline-flex items-center gap-2 mt-3 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">{t.totalLiabilities}:</span>
                <span className="text-sm font-bold text-red-600">{CURRENCY_SYMBOLS[currentLedger.currency]}{totalLiabilities.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            </div>
      </div>

      {/* 2. Compact Debt / Lending Section */}
      <div className="grid grid-cols-2 gap-3 mb-6">
           {/* Debt Box */}
           <div className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm">
               <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                   <CreditCard size={18} />
               </div>
               <div className="min-w-0">
                   <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{t.accTypes.DEBT}</p>
                   <p className="text-sm font-black text-gray-900 truncate">
                      {CURRENCY_SYMBOLS[currentLedger.currency]}{totalDebtValue > 0 ? totalDebtValue.toLocaleString(undefined, {notation:"compact"}) : '0'}
                   </p>
               </div>
           </div>
           
           {/* Lending Box */}
           <div className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center gap-3 shadow-sm">
               <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center shrink-0">
                   <HandCoins size={18} />
               </div>
               <div className="min-w-0">
                   <p className="text-[10px] font-bold text-gray-400 uppercase truncate">{t.accTypes.RECEIVABLE}</p>
                   <p className="text-sm font-black text-gray-900 truncate">
                      {CURRENCY_SYMBOLS[currentLedger.currency]}{totalReceivableValue > 0 ? totalReceivableValue.toLocaleString(undefined, {notation:"compact"}) : '0'}
                   </p>
               </div>
           </div>
      </div>

      <div className="space-y-6">
        {/* Assets Section */}
        {assets.length > 0 && (
            <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="bg-green-100 p-1 rounded-md text-green-600">
                        <Wallet size={14}/>
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.assets}</h3>
                </div>
                <div className="space-y-2">
                    {assets.map(renderAccountCard)}
                </div>
            </div>
        )}

        {/* Liabilities Section */}
        {liabilities.length > 0 && (
            <div>
                <div className="flex items-center gap-2 mb-3 px-1 mt-2">
                    <div className="bg-red-100 p-1 rounded-md text-red-600">
                        <Users size={14}/>
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t.liabilities}</h3>
                </div>
                <div className="space-y-2">
                    {liabilities.map(renderAccountCard)}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AccountsPage;