
import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Calendar, AlertCircle, ChevronDown, CreditCard, Banknote, Wallet, TrendingUp, Smartphone, Users, HandCoins, Globe, LayoutGrid } from 'lucide-react';
import { Account, AccountType, UserProfile } from '../types';
import { I18N, CURRENCY_SYMBOLS } from '../constants';

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: Partial<Account>) => void;
  onDelete?: (id: string) => void;
  initialData?: Account | null;
  user: UserProfile;
  exchangeRates: Record<string, number>;
}

const AccountFormModal: React.FC<AccountFormModalProps> = ({ isOpen, onClose, onSave, onDelete, initialData, user, exchangeRates }) => {
  const t = I18N[user.language];
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [balance, setBalance] = useState('');
  const [type, setType] = useState<AccountType>('CHECKING');
  const [isExcluded, setIsExcluded] = useState(false);
  
  // Extra Fields
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [paymentDueDay, setPaymentDueDay] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [dueDate, setDueDate] = useState('');

  // UI State
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);
  const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setCurrency(initialData.currency);
        setBalance(initialData.balance.toString());
        setType(initialData.type);
        setIsExcluded(!!initialData.isExcluded);
        setCreditLimit(initialData.creditLimit ? initialData.creditLimit.toString() : '');
        setStatementDay(initialData.statementDay ? initialData.statementDay.toString() : '');
        setPaymentDueDay(initialData.paymentDueDay ? initialData.paymentDueDay.toString() : '');
        setInterestRate(initialData.interestRate ? initialData.interestRate.toString() : '');
        setDueDate(initialData.dueDate || '');
      } else {
        setName('');
        setCurrency('CNY');
        setBalance('');
        setType('CHECKING');
        setIsExcluded(false);
        setCreditLimit('');
        setStatementDay('');
        setPaymentDueDay('');
        setInterestRate('');
        setDueDate('');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name) return;
    const accountData: Partial<Account> = {
      id: initialData?.id,
      name,
      type,
      currency,
      balance: Number(balance),
      isExcluded,
      creditLimit: creditLimit ? Number(creditLimit) : undefined,
      statementDay: statementDay ? Number(statementDay) : undefined,
      paymentDueDay: paymentDueDay ? Number(paymentDueDay) : undefined,
      interestRate: interestRate ? Number(interestRate) : undefined,
      dueDate: dueDate || undefined
    };
    onSave(accountData);
    onClose();
  };

  const accountTypes: AccountType[] = [
    'CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD', 
    'ALIPAY', 'WECHAT', 'HUABEI', 
    'INVESTMENT', 'DEBT', 'RECEIVABLE'
  ];
  
  const getTypeIcon = (t: string) => {
    switch(t) {
        case 'CHECKING': return <CreditCard size={20}/>;
        case 'SAVINGS': return <Banknote size={20}/>;
        case 'CREDIT_CARD': return <CreditCard size={20}/>;
        case 'CASH': return <Wallet size={20}/>;
        case 'INVESTMENT': return <TrendingUp size={20}/>;
        case 'ALIPAY': 
        case 'WECHAT': return <Smartphone size={20}/>;
        case 'HUABEI': return <CreditCard size={20}/>;
        case 'DEBT': return <Users size={20}/>;
        case 'RECEIVABLE': return <HandCoins size={20}/>;
        default: return <Wallet size={20}/>;
    }
  };

  const availableCurrencies = Object.keys(CURRENCY_SYMBOLS);

  // Material 3 Style Classes
  const inputContainerClass = "w-full bg-white border border-gray-300 rounded-xl px-4 py-3 font-bold flex items-center justify-between transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100";
  const inputClass = "w-full bg-transparent outline-none text-gray-900 placeholder:text-gray-300";
  const selectorClass = "w-full bg-white border border-gray-300 rounded-xl px-4 py-3 font-bold flex items-center justify-between cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-all";

  return (
    <>
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-md p-6 rounded-t-[2rem] md:rounded-[2rem] shadow-2xl relative animate-fade-in-up max-h-[90vh] overflow-y-auto z-50">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">{initialData ? t.edit : t.addAccount}</h3>
            <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X size={18}/></button>
        </div>
        
        <div className="space-y-5">
            {/* Account Type Selector (ExposedDropdownMenuBox Style) */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t.type}</label>
                <div 
                  onClick={() => setIsTypeSheetOpen(true)}
                  className={selectorClass}
                >
                   <div className="flex items-center gap-3">
                      <div className="text-gray-500">{getTypeIcon(type)}</div>
                      <span className="text-gray-900">{t.accTypes[type]}</span>
                   </div>
                   <ChevronDown size={20} className="text-gray-400" />
                </div>
            </div>

            {/* Account Name */}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t.name}</label>
                <div className={inputContainerClass}>
                   <input 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className={inputClass}
                      placeholder="e.g. My Wallet" 
                   />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                {/* Currency Selector (ExposedDropdownMenuBox Style) */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t.currency}</label>
                    <div 
                      onClick={() => setIsCurrencySheetOpen(true)}
                      className={selectorClass}
                    >
                        <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">
                                {CURRENCY_SYMBOLS[currency] || '$'}
                             </div>
                             <span className="text-gray-900">{currency}</span>
                        </div>
                        <ChevronDown size={18} className="text-gray-400" />
                    </div>
                </div>

                {/* Initial Balance */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">{t.initialBalance}</label>
                    <div className={inputContainerClass}>
                       <input 
                          type="number" 
                          value={balance} 
                          onChange={e => setBalance(e.target.value)} 
                          className={inputClass} 
                          placeholder="0.00" 
                       />
                    </div>
                </div>
            </div>

            {/* Conditional Fields for Credit Cards / Huabei */}
            {(type === 'CREDIT_CARD' || type === 'HUABEI') && (
                <div className="bg-blue-50 p-4 rounded-2xl space-y-4 animate-fade-in border border-blue-100">
                     <div>
                        <label className="block text-xs font-bold text-blue-500 uppercase mb-1.5 ml-1">{t.creditLimit}</label>
                        <div className="relative bg-white border border-blue-200 rounded-xl px-3 py-3 flex items-center">
                            <span className="text-blue-400 font-bold mr-2">$</span>
                            <input 
                               type="number" 
                               value={creditLimit} 
                               onChange={e => setCreditLimit(e.target.value)} 
                               className="w-full bg-transparent font-bold outline-none text-gray-900 placeholder:text-blue-200" 
                               placeholder="50000" 
                            />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-blue-500 uppercase mb-1.5 ml-1">{t.billDay}</label>
                            <div className="bg-white border border-blue-200 rounded-xl px-3 py-3">
                               <input type="number" min="1" max="31" value={statementDay} onChange={e => setStatementDay(e.target.value)} className="w-full bg-transparent font-bold outline-none text-gray-900 placeholder:text-blue-200" placeholder="DD" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-500 uppercase mb-1.5 ml-1">{t.repayDay}</label>
                            <div className="bg-white border border-blue-200 rounded-xl px-3 py-3">
                               <input type="number" min="1" max="31" value={paymentDueDay} onChange={e => setPaymentDueDay(e.target.value)} className="w-full bg-transparent font-bold outline-none text-gray-900 placeholder:text-blue-200" placeholder="DD" />
                            </div>
                        </div>
                     </div>
                </div>
            )}

            {/* Conditional Fields for Debts / Loans */}
            {(type === 'DEBT' || type === 'RECEIVABLE') && (
                <div className="bg-orange-50 p-4 rounded-2xl space-y-4 animate-fade-in border border-orange-100">
                     <div>
                        <label className="block text-xs font-bold text-orange-500 uppercase mb-1.5 ml-1">{t.interestRate}</label>
                        <div className="relative bg-white border border-orange-200 rounded-xl px-3 py-3 flex items-center justify-between">
                            <input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} className="w-full bg-transparent font-bold outline-none text-gray-900 placeholder:text-orange-200" placeholder="4.5" />
                            <span className="text-orange-400 font-bold">%</span>
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-orange-500 uppercase mb-1.5 ml-1">{t.dueDate}</label>
                        <div className="bg-white border border-orange-200 rounded-xl px-3 py-3">
                           <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-transparent font-bold outline-none text-gray-900" />
                        </div>
                     </div>
                </div>
            )}

            {/* Exclude Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-sm font-bold text-gray-600">{t.includeInTotal}</span>
                <button 
                    onClick={() => setIsExcluded(!isExcluded)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${!isExcluded ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${!isExcluded ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="flex gap-3 mt-6">
                {initialData && onDelete && (
                    <button onClick={() => { onDelete(initialData.id); onClose(); }} className="p-4 bg-white border border-gray-200 text-red-500 rounded-2xl font-bold shadow-sm hover:bg-red-50 transition-colors"><Trash2 size={20}/></button>
                )}
                <button onClick={handleSave} className="flex-1 bg-black text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
                   <Check size={20}/> {initialData ? t.save : t.create}
                </button>
            </div>
        </div>
      </div>
    </div>

    {/* ACCOUNT TYPE SHEET */}
    {isTypeSheetOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsTypeSheetOpen(false)}></div>
            <div className="bg-white w-full rounded-t-[2rem] overflow-hidden animate-ios-slide-up relative z-10 flex flex-col max-h-[70vh]">
                <div className="p-4 text-center border-b border-gray-100 bg-white sticky top-0 z-20">
                    <h3 className="font-bold text-lg text-gray-900">{t.type}</h3>
                </div>
                <div className="overflow-y-auto p-2 pb-safe">
                    <div className="grid grid-cols-1">
                        {accountTypes.map(at => (
                            <button
                                key={at}
                                onClick={() => { setType(at); setIsTypeSheetOpen(false); }}
                                className={`w-full p-4 flex items-center gap-4 border-b border-gray-50 last:border-0 transition-colors
                                    ${type === at ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-900 hover:bg-gray-50'}
                                `}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type === at ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {getTypeIcon(at)}
                                </div>
                                <span className="font-bold text-base flex-1 text-left">{t.accTypes[at]}</span>
                                {type === at && <Check size={20} className="text-blue-600" />}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-gray-100 bg-white pb-safe">
                    <button onClick={() => setIsTypeSheetOpen(false)} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">
                        {t.cancel}
                    </button>
                </div>
            </div>
        </div>
    )}

    {/* CURRENCY SHEET */}
    {isCurrencySheetOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsCurrencySheetOpen(false)}></div>
            <div className="bg-white w-full rounded-t-[2rem] overflow-hidden animate-ios-slide-up relative z-10 flex flex-col max-h-[70vh]">
                <div className="p-4 text-center border-b border-gray-100 bg-white sticky top-0 z-20">
                    <h3 className="font-bold text-lg text-gray-900">{t.currency}</h3>
                </div>
                <div className="overflow-y-auto p-2 pb-safe">
                    <div className="grid grid-cols-1">
                        {availableCurrencies.map(c => (
                            <button
                                key={c}
                                onClick={() => { setCurrency(c); setIsCurrencySheetOpen(false); }}
                                className={`w-full p-4 flex items-center gap-4 border-b border-gray-50 last:border-0 transition-colors
                                    ${currency === c ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-900 hover:bg-gray-50'}
                                `}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${currency === c ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {CURRENCY_SYMBOLS[c] || c[0]}
                                </div>
                                <div className="flex-1 text-left">
                                    <span className="font-bold text-base block">{c}</span>
                                    <span className="text-xs opacity-60 font-medium">
                                        {c === 'CNY' ? 'Chinese Yuan' : c === 'USD' ? 'US Dollar' : c === 'EUR' ? 'Euro' : c}
                                    </span>
                                </div>
                                {currency === c && <Check size={20} className="text-blue-600" />}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-gray-100 bg-white pb-safe">
                    <button onClick={() => setIsCurrencySheetOpen(false)} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">
                        {t.cancel}
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default AccountFormModal;
