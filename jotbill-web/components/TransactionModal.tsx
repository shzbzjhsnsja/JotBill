
import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, Calendar, CreditCard, ChevronDown, ChevronRight, Edit2, Plus, ArrowLeft, Trash2, Split, Coins, AlertTriangle, Globe, Smile, ChevronUp, Wallet, Smartphone, Banknote, TrendingDown, TrendingUp, ArrowRightLeft, Clock } from 'lucide-react';
import { parseTransactionText } from '../services/geminiService';
import { AIParseResult, TransactionType, UserProfile, Account, Category, Transaction } from '../types';
import { I18N, ICON_MAP, CURRENCY_SYMBOLS } from '../constants';
import { formatLastUpdated } from '../services/currencyService';
import CategoryManager from './CategoryManager';
import DatePickerModal from './DatePickerModal';
import TimePickerModal from './TimePickerModal';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (result: AIParseResult, accountId: string) => void;
  onDelete?: (txId: string) => void;
  user: UserProfile;
  accounts: Account[];
  categories: Category[];
  onUpdateCategories: (newCategories: Category[]) => void;
  initialData?: Transaction | null;
  ledgerCurrency: string;
  exchangeRates: Record<string, number>;
  lastUpdated: number;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ 
  isOpen, onClose, onSave, onDelete, user, accounts, categories, onUpdateCategories, initialData, ledgerCurrency, exchangeRates, lastUpdated
}) => {
  const t = I18N[user.language];
  const [mode, setMode] = useState<'MANUAL' | 'AI'>('MANUAL');
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  // AI State
  const [aiInput, setAiInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<AIParseResult | null>(null);
  const [aiSelectedCatId, setAiSelectedCatId] = useState<string>('');
  const [aiSelectedAccountId, setAiSelectedAccountId] = useState<string>('');

  // Manual State
  const [amount, setAmount] = useState(''); 
  const [currency, setCurrency] = useState('CNY');
  const [exchangeRate, setExchangeRate] = useState('');
  
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  
  // Minimalist UI State
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  // Pickers State
  const [isCurrencyPickerOpen, setIsCurrencyPickerOpen] = useState(false);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [accountSheetTarget, setAccountSheetTarget] = useState<'MANUAL' | 'AI'>('MANUAL');
  const [isTypeSheetOpen, setIsTypeSheetOpen] = useState(false);

  // Date & Time State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  // Extra Features State (Toolbar)
  const [showMoods, setShowMoods] = useState(false);
  const [mood, setMood] = useState('neutral');
  
  // Installment State
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCurrent, setInstallmentCurrent] = useState('1');
  const [installmentTotal, setInstallmentTotal] = useState('12');
  const [installmentFee, setInstallmentFee] = useState('');
  
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [date, setDate] = useState(''); // YYYY-MM-DD
  const [time, setTime] = useState(''); // HH:mm

  const MOODS = [
    { id: 'happy', emoji: '😄', label: t.moodHappy },
    { id: 'neutral', emoji: '😐', label: t.moodNeutral },
    { id: 'regret', emoji: '😭', label: t.moodRegret },
    { id: 'money', emoji: '💸', label: t.moodSplurge },
  ];

  // Helper: Get Local ISO Date (YYYY-MM-DD)
  const getLocalDate = (d = new Date()) => {
      const offset = d.getTimezoneOffset() * 60000;
      const local = new Date(d.getTime() - offset);
      return local.toISOString().split('T')[0];
  };
  
  // Helper: Get Local Time (HH:mm)
  const getLocalTime = (d = new Date()) => {
      return d.toTimeString().slice(0, 5);
  };

  // Reset or Populate on Open
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setMode('MANUAL');
        setDescription(initialData.description);
        setMerchant(initialData.merchant || '');
        setSelectedCategoryId(initialData.categoryId);
        setSelectedAccountId(initialData.accountId);
        setType(initialData.type);
        
        // Parse Date & Time from stored ISO string or Date string
        const dt = new Date(initialData.date);
        // Handle Invalid Date fallback
        if (!isNaN(dt.getTime())) {
             // Since we store ISO strings (UTC) or YYYY-MM-DD (UTC midnight usually), 
             // we want to display them in local time for editing.
             // However, legacy data might just be YYYY-MM-DD.
             if (initialData.date.includes('T')) {
                 // Has time component
                 setDate(getLocalDate(dt));
                 setTime(getLocalTime(dt));
             } else {
                 // Just date, default to current time or 00:00? 
                 // If editing a date-only record, keep date, set time to current or 12:00
                 setDate(initialData.date);
                 setTime(getLocalTime(new Date())); 
             }
        } else {
             setDate(getLocalDate());
             setTime(getLocalTime());
        }

        setShowMoreOptions(true); // Show details when editing
        
        // Populate Mood
        const m = initialData.mood || 'neutral';
        setMood(m);
        setShowMoods(m !== 'neutral');

        // Populate Currency & Amount
        if (initialData.original_amount && initialData.original_currency) {
            setAmount(initialData.original_amount.toString());
            setCurrency(initialData.original_currency);
            setExchangeRate(initialData.exchange_rate?.toString() || '1');
        } else {
            setAmount(initialData.amount.toString());
            setCurrency(initialData.currency);
            setExchangeRate('1');
        }
        
        if (initialData.installmentTotal) {
           setIsInstallment(true);
           setInstallmentCurrent(initialData.installmentCurrent?.toString() || '1');
           setInstallmentTotal(initialData.installmentTotal.toString());
           setInstallmentFee(initialData.installmentFee ? initialData.installmentFee.toString() : '');
        } else {
           setIsInstallment(false);
           setInstallmentCurrent('1');
           setInstallmentTotal('12');
           setInstallmentFee('');
        }

      } else {
        // Reset New
        setMode('MANUAL');
        setAmount('');
        setDescription('');
        setMerchant('');
        setMood('neutral');
        setShowMoods(false);
        setCurrency(ledgerCurrency || 'CNY');
        setExchangeRate('1');
        setIsInstallment(false);
        setInstallmentCurrent('1');
        setInstallmentTotal('12');
        setInstallmentFee('');
        setShowMoreOptions(false); 
        
        // Default Selection
        const defaultCat = categories.find(c => c.type === TransactionType.EXPENSE);
        if (defaultCat) setSelectedCategoryId(defaultCat.id);
        
        if (accounts.length > 0) {
            setSelectedAccountId(accounts[0].id);
            setAiSelectedAccountId(accounts[0].id);
        }
        
        // Defaults to Now
        const now = new Date();
        setDate(getLocalDate(now));
        setTime(getLocalTime(now));
        setType(TransactionType.EXPENSE);
      }
    }
  }, [isOpen, initialData, accounts, ledgerCurrency]);

  useEffect(() => {
     if (currency && ledgerCurrency && exchangeRates) {
         if (currency === ledgerCurrency) {
             setExchangeRate('1');
         } else {
             const rateCurrency = exchangeRates[currency] || 1;
             const rateLedger = exchangeRates[ledgerCurrency] || 1;
             const estimatedRate = (1 / rateCurrency) * rateLedger;
             setExchangeRate(estimatedRate.toFixed(4));
         }
     }
  }, [currency, ledgerCurrency, exchangeRates]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: TransactionType) => {
      setType(newType);
      const firstCat = categories.find(c => c.type === newType);
      if (firstCat) {
          setSelectedCategoryId(firstCat.id);
          setExpandedCategoryId(null);
      }
      setIsTypeSheetOpen(false);
  };

  const handleAiParse = async () => {
    if (!aiInput.trim()) return;
    setIsLoading(true);
    const result = await parseTransactionText(aiInput, user.language);
    
    if (result) {
        let matchCatId = categories[0].id;
        const lowerCat = result.category.toLowerCase();
        
        const exactCat = categories.find(c => c.name.toLowerCase() === lowerCat || c.subCategories?.some(s => s.name.toLowerCase() === lowerCat));
        
        if (exactCat) {
            matchCatId = exactCat.id;
            if (exactCat.subCategories) {
                const sub = exactCat.subCategories.find(s => s.name.toLowerCase() === lowerCat);
                if (sub) matchCatId = sub.id;
            }
        }
        setAiSelectedCatId(matchCatId);

        let matchAccId = accounts[0]?.id;
        if (result.accountName) {
            const lowerAccName = result.accountName.toLowerCase();
            const foundAcc = accounts.find(a => 
                a.name.toLowerCase().includes(lowerAccName) || 
                lowerAccName.includes(a.name.toLowerCase())
            );
            if (foundAcc) matchAccId = foundAcc.id;
        }
        setAiSelectedAccountId(matchAccId);

        // 如果解析出了日期/时间，填充到表单；否则使用当前
        if (result.date) {
            const dt = new Date(result.date);
            if (!isNaN(dt.getTime())) {
                setDate(getLocalDate(dt));
                setTime(getLocalTime(dt));
            } else {
                const now = new Date();
                setDate(getLocalDate(now));
                setTime(getLocalTime(now));
            }
        } else {
            const now = new Date();
            setDate(getLocalDate(now));
            setTime(getLocalTime(now));
        }
        setShowMoreOptions(true); // 展开时间/日期等明细，便于校正
    }

    setParsedData(result);
    setIsLoading(false);
  };

  const handleManualSave = () => {
    if (!amount || isNaN(Number(amount))) return;
    
    let numAmount = Number(amount);
    let finalType = type;

    if (numAmount < 0) {
        numAmount = Math.abs(numAmount);
        if (type === TransactionType.EXPENSE) {
            finalType = TransactionType.INCOME;
        } else if (type === TransactionType.INCOME) {
            finalType = TransactionType.EXPENSE;
        }
    }
    
    let finalAmount = numAmount;
    let finalOriginalAmount = undefined;
    let finalOriginalCurrency = undefined;
    let finalExchangeRate = undefined;

    if (currency !== ledgerCurrency) {
        finalOriginalAmount = numAmount;
        finalOriginalCurrency = currency;
        finalExchangeRate = Number(exchangeRate);
        finalAmount = numAmount * finalExchangeRate;
    }

    // Combine Date and Time (本地时间，不转 UTC，避免时区偏移)
    const finalDateStr = `${date}T${time || '00:00'}:00`;

    const result: any = {
      amount: finalAmount,
      currency: ledgerCurrency, 
      category: selectedCategoryId, 
      date: finalDateStr, // Save as Full ISO string
      description: description,
      merchant: merchant || description,
      type: finalType,
      mood: mood,
      original_amount: finalOriginalAmount,
      original_currency: finalOriginalCurrency,
      exchange_rate: finalExchangeRate,
    };

    if (isInstallment && finalType === TransactionType.EXPENSE) {
       result.installmentCurrent = Number(installmentCurrent);
       result.installmentTotal = Number(installmentTotal);
       if (installmentFee) result.installmentFee = Number(installmentFee);
    }
    
    onSave(result, selectedAccountId || accounts[0]?.id);
    handleClose();
  };

  const handleDeleteClick = () => {
      if (initialData && onDelete) {
          setIsDeleteConfirmOpen(true);
      }
  };

  const confirmDelete = () => {
      if (initialData && onDelete) {
          onDelete(initialData.id);
          setIsDeleteConfirmOpen(false);
          handleClose();
      }
  };

  const handleAiConfirm = () => {
    if (parsedData) {
      // 使用当前表单的日期+时间，避免使用旧的解析时间
      const aiDateStr = `${date || getLocalDate(new Date())}T${time || getLocalTime(new Date())}:00`;
      onSave({ ...parsedData, category: aiSelectedCatId, date: aiDateStr }, aiSelectedAccountId || accounts[0]?.id); 
      handleClose();
    }
  };

  const handleClose = () => {
    setAiInput('');
    setParsedData(null);
    setAmount('');
    setDescription('');
    setMerchant('');
    setMood('neutral');
    setShowMoods(false);
    setCurrency(ledgerCurrency || 'CNY');
    setExchangeRate('1');
    setMode('MANUAL');
    setExpandedCategoryId(null);
    setIsInstallment(false);
    onClose();
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
        case 'WECHAT': return <Smartphone size={18} />;
        case 'ALIPAY': return <Smartphone size={18} />;
        case 'CASH': return <Wallet size={18} />;
        case 'CHECKING': return <CreditCard size={18} />;
        case 'SAVINGS': return <Banknote size={18} />;
        case 'CREDIT_CARD': return <CreditCard size={18} />;
        default: return <Wallet size={18} />;
    }
  };

  const handleAccountSelect = (accId: string) => {
      if (accountSheetTarget === 'MANUAL') {
          setSelectedAccountId(accId);
      } else {
          setAiSelectedAccountId(accId);
      }
      setIsAccountSheetOpen(false);
  };

  const openAccountSheet = (target: 'MANUAL' | 'AI') => {
      setAccountSheetTarget(target);
      setIsAccountSheetOpen(true);
  };

  const renderCategories = () => {
    const activeCategories = categories.filter(c => c.type === type);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <label className="text-xs font-bold text-gray-400 uppercase">{t.category}</label>
          <button 
            onClick={() => setCategoryManagerOpen(true)}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg"
          >
            <Edit2 size={12}/> {t.manageCategories}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {activeCategories.map(cat => {
            const isSelfSelected = selectedCategoryId === cat.id;
            const isSubSelected = cat.subCategories?.some(sub => sub.id === selectedCategoryId);
            const isSelected = isSelfSelected || isSubSelected;
            
            const isExpanded = expandedCategoryId === cat.id;
            const hasSubs = cat.subCategories && cat.subCategories.length > 0;
            
            return (
              <React.Fragment key={cat.id}>
                <button 
                  onClick={() => {
                     setSelectedCategoryId(cat.id);
                     if (hasSubs) {
                       setExpandedCategoryId(isExpanded ? null : cat.id);
                     } else {
                       setExpandedCategoryId(null);
                     }
                  }}
                  className={`flex flex-col items-center gap-1 p-1 rounded-xl transition-all active:scale-95`}
                >
                  <div 
                    className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-all`}
                    style={{ 
                        backgroundColor: isSelected ? `${cat.color}15` : '#F9FAFB',
                        color: isSelected ? cat.color : '#9CA3AF'
                    }}
                  >
                     {ICON_MAP[cat.icon] || <CreditCard size={16}/>}
                  </div>
                  <span 
                    className={`text-[10px] font-bold truncate w-full text-center transition-colors`}
                    style={{ color: isSelected ? cat.color : '#9CA3AF' }}
                  >
                    {cat.name}
                  </span>
                  
                  {hasSubs && (
                    <div className={`absolute top-0 right-0 flex gap-0.5 pointer-events-none p-1`}>
                       <div className="w-1 h-1 rounded-full bg-gray-300" style={isSelected ? {backgroundColor: cat.color} : {}} />
                    </div>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {expandedCategoryId && (
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-fade-in">
             <div className="flex items-center gap-2 mb-3">
                <ArrowLeft size={14} className="text-gray-400"/>
                <span className="text-xs font-bold text-gray-500">{t.subCategory}</span>
             </div>
             <div className="grid grid-cols-4 gap-3">
                <button 
                  onClick={() => {
                    setSelectedCategoryId(expandedCategoryId);
                    setExpandedCategoryId(null);
                  }}
                   className={`p-2 rounded-xl text-xs font-bold border h-full flex items-center justify-center text-center transition-all ${
                       selectedCategoryId === expandedCategoryId 
                       ? 'bg-white border-blue-500 text-blue-600 shadow-sm' 
                       : 'bg-white text-gray-500 border-gray-200'
                   }`}
                >
                  {t.viewAll} / Main
                </button>

                {categories.find(c => c.id === expandedCategoryId)?.subCategories?.map(sub => (
                   <button 
                     key={sub.id}
                     onClick={() => setSelectedCategoryId(sub.id)}
                     className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                         selectedCategoryId === sub.id 
                         ? 'bg-white border-blue-500 text-blue-600 shadow-sm' 
                         : 'bg-white border-gray-200 text-gray-500'
                     }`}
                   >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{backgroundColor: `${sub.color}20`, color: sub.color}}>
                          {ICON_MAP[sub.icon] || <CreditCard size={14}/>}
                      </div>
                      <span className="text-[10px] font-bold truncate w-full text-center">{sub.name}</span>
                   </button>
                ))}
             </div>
          </div>
        )}
      </div>
    );
  };
  
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const isCreditAccount = selectedAccount && (selectedAccount.type === 'CREDIT_CARD' || selectedAccount.type === 'HUABEI');
  const aiSelectedAccount = accounts.find(a => a.id === aiSelectedAccountId);

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={handleClose}></div>
      
      <div className="bg-[#F2F2F7] md:bg-white rounded-t-[2rem] md:rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden relative z-10 animate-ios-slide-up h-[90vh] md:h-auto flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200 flex flex-col gap-4">
          <div className="flex justify-between items-center">
             <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  onClick={() => setMode('MANUAL')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === 'MANUAL' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {t.manual}
                </button>
                <button 
                  onClick={() => setMode('AI')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === 'AI' ? 'bg-blue-500 shadow-sm text-white' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Sparkles size={14} />
                  {t.parse}
                </button>
             </div>
             <button onClick={handleClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={20} />
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          {mode === 'AI' ? (
             !parsedData ? (
              <div className="space-y-4 h-full flex flex-col relative">
                <textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder={t.aiTip}
                  className="w-full flex-1 min-h-[150px] p-5 bg-white border-none shadow-sm rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-gray-900 text-lg leading-relaxed placeholder:text-gray-300 mb-16"
                  autoFocus
                />
                
                <button 
                  onClick={handleAiParse}
                  disabled={!aiInput.trim() || isLoading}
                  className={`w-full py-4 rounded-2xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    !aiInput.trim() || isLoading ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                  }`}
                >
                  {isLoading ? <div className="animate-spin w-5 h-5 border-2 border-white/50 border-t-white rounded-full"/> : <Sparkles size={20} />}
                  {isLoading ? t.parsing : t.parse}
                </button>
              </div>
            ) : (
                <div className="space-y-6">
                 <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-400 font-medium uppercase tracking-wider">{t.amount}</p>
                    <p className="text-4xl font-black text-gray-900 mt-1">{parsedData.currency} {parsedData.amount}</p>
                  </div>
                  <div className="h-px bg-gray-100" />
                  <div className="grid grid-cols-1 gap-4 text-sm">
                    <div>
                        <p className="text-gray-400 mb-1">{t.account}</p>
                        <button 
                           onClick={() => openAccountSheet('AI')}
                           className="w-full p-2 bg-gray-50 rounded-lg font-bold text-gray-900 flex items-center justify-between"
                        >
                            <span>{aiSelectedAccount?.name || 'Select Account'}</span>
                            <ChevronDown size={14} className="text-gray-400"/>
                        </button>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">{t.category}</p>
                      <select 
                         value={aiSelectedCatId} 
                         onChange={(e) => setAiSelectedCatId(e.target.value)}
                         className="w-full p-2 bg-gray-50 rounded-lg font-bold text-gray-900 outline-none"
                      >
                         {categories.map(c => (
                            <optgroup key={c.id} label={c.name}>
                                <option value={c.id}>{c.name}</option>
                                {c.subCategories?.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </optgroup>
                         ))}
                      </select>
                    </div>
                    <div className="flex justify-between">
                       <div>
                           <p className="text-gray-400">{t.merchant}</p>
                           <p className="font-bold text-gray-900">{parsedData.merchant || '-'}</p>
                       </div>
                       <div className="text-right">
                           <p className="text-gray-400">{t.date}</p>
                           <p className="font-bold text-gray-900">{parsedData.date}</p>
                       </div>
                   </div>
                    {/* Inline date & time pickers so AI结果可以校正时间 */}
                    <div className="flex items-center gap-3 mt-3">
                        <button 
                           onClick={() => setIsDatePickerOpen(true)}
                           className="flex-1 flex items-center gap-2 bg-gray-50 p-2.5 rounded-xl hover:bg-gray-100 transition-colors active:scale-95"
                        >
                           <Calendar size={18} className="text-gray-400" />
                           <span className="font-bold text-sm text-gray-900">{date || 'Select Date'}</span>
                        </button>
                        <button 
                           onClick={() => setIsTimePickerOpen(true)}
                           className="flex-1 flex items-center justify-end gap-2 bg-gray-50 p-2.5 rounded-xl hover:bg-gray-100 transition-colors active:scale-95"
                        >
                           <Clock size={18} className="text-gray-400" />
                           <span className="font-bold text-sm text-gray-900">{time || '00:00'}</span>
                        </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setParsedData(null)} className="flex-1 py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200">{t.edit}</button>
                  <button onClick={handleAiConfirm} className="flex-1 py-3 bg-black text-white font-bold rounded-xl shadow-lg">{t.saveTx}</button>
                </div>
              </div>
            )
          ) : (
            /* Manual View - Minimalist Redesign */
            <div className="space-y-6 pb-20">
              
              {/* Unified Amount Card */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative">
                  <div className="flex items-center gap-3">
                      {/* Custom Type Trigger */}
                      <div className="shrink-0">
                         <button 
                           onClick={() => setIsTypeSheetOpen(true)}
                           className={`flex items-center gap-1.5 py-2 pl-3 pr-2 rounded-xl text-sm font-bold transition-colors active:scale-95 ${
                             type === TransactionType.EXPENSE ? 'bg-red-50 text-red-600' : 
                             type === TransactionType.INCOME ? 'bg-green-50 text-green-600' : 
                             'bg-blue-50 text-blue-600'
                           }`}
                         >
                            {type === TransactionType.EXPENSE && <TrendingDown size={16} />}
                            {type === TransactionType.INCOME && <TrendingUp size={16} />}
                            {type === TransactionType.TRANSFER && <ArrowRightLeft size={16} />}
                            <span className="min-w-[32px] text-center">
                              {type === TransactionType.EXPENSE ? t.expense : 
                               type === TransactionType.INCOME ? t.income : 
                               t.transfer}
                            </span>
                            <ChevronDown size={14} className="opacity-50"/>
                         </button>
                      </div>
                      
                      {/* Amount Input */}
                      <input 
                          type="number" 
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          className="flex-1 w-full border-none bg-transparent p-0 text-4xl font-black text-gray-900 placeholder:text-gray-200 focus:outline-none text-right"
                          autoFocus
                      />
                  </div>
                  
                  {/* Currency & Account Row */}
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                       <button onClick={() => setIsCurrencyPickerOpen(true)} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 px-2 py-1 rounded-lg">
                           {currency} <ChevronDown size={10} />
                       </button>

                       {/* CUSTOM ACCOUNT SELECTOR TRIGGER */}
                       <div 
                         onClick={() => openAccountSheet('MANUAL')}
                         className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors active:scale-95"
                       >
                           {selectedAccount ? getAccountIcon(selectedAccount.type) : <Wallet size={14}/>}
                           <span className="max-w-[100px] truncate">{selectedAccount ? selectedAccount.name : 'Select Account'}</span>
                           <ChevronDown size={12} className="text-gray-400" />
                       </div>
                  </div>
              </div>

              {/* COMPACT TOOLBAR for Extras */}
              <div className="flex gap-3 px-1 overflow-x-auto no-scrollbar">
                  <button 
                     onClick={() => setShowMoods(!showMoods)}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border whitespace-nowrap ${mood !== 'neutral' || showMoods ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}
                  >
                     <Smile size={12} />
                     {mood !== 'neutral' ? MOODS.find(m=>m.id===mood)?.label : t.mood}
                  </button>

                  {isCreditAccount && type === TransactionType.EXPENSE && (
                       <button
                          onClick={() => setIsInstallment(!isInstallment)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border whitespace-nowrap ${isInstallment ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}
                       >
                          <Split size={12} />
                          {isInstallment ? t.installmentOn : t.installments}
                       </button>
                  )}
              </div>

              {/* Mood Selector Panel */}
              {showMoods && (
                  <div className="flex justify-between gap-2 animate-fade-in">
                     {MOODS.map(m => (
                        <button 
                           key={m.id}
                           onClick={() => setMood(m.id)}
                           className={`flex-1 py-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                               mood === m.id 
                               ? 'bg-yellow-50 border-yellow-200 shadow-sm scale-105' 
                               : 'bg-white border-gray-100 grayscale hover:grayscale-0 hover:bg-gray-50'
                           }`}
                        >
                            <span className="text-2xl">{m.emoji}</span>
                            <span className="text-[10px] font-bold text-gray-500">{m.label}</span>
                        </button>
                     ))}
                  </div>
              )}

              {/* Installment Panel */}
              {isInstallment && (
                   <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 space-y-4 animate-fade-in">
                       <div className="flex gap-4">
                           <div className="flex-1">
                               <label className="text-[10px] font-bold text-purple-400 uppercase">{t.current}</label>
                               <div className="flex items-center bg-white border border-purple-100 rounded-xl mt-1 overflow-hidden">
                                   <input 
                                     type="number" 
                                     value={installmentCurrent}
                                     onChange={e => setInstallmentCurrent(e.target.value)}
                                     className="w-full bg-transparent p-2 font-bold text-gray-900 outline-none text-center"
                                     placeholder="1"
                                   />
                                   <span className="text-xs font-bold text-gray-400 pr-3">/</span>
                               </div>
                           </div>
                           <div className="flex-1">
                               <label className="text-[10px] font-bold text-purple-400 uppercase">{t.total}</label>
                               <div className="flex items-center bg-white border border-purple-100 rounded-xl mt-1 overflow-hidden">
                                   <input 
                                     type="number" 
                                     value={installmentTotal}
                                     onChange={e => setInstallmentTotal(e.target.value)}
                                     className="w-full bg-transparent p-2 font-bold text-gray-900 outline-none text-center"
                                     placeholder="12"
                                   />
                                    <span className="text-xs font-bold text-gray-400 pr-3">{t.period}</span>
                               </div>
                           </div>
                       </div>
                       <div>
                           <label className="text-[10px] font-bold text-purple-400 uppercase">{t.interestFee}</label>
                           <div className="relative">
                             <span className="absolute left-3 top-2.5 text-purple-300 text-sm font-bold">{CURRENCY_SYMBOLS[currency] || '$'}</span>
                             <input 
                               type="number" 
                               value={installmentFee}
                               onChange={e => setInstallmentFee(e.target.value)}
                               className="w-full bg-white border border-purple-100 pl-8 p-2 rounded-xl font-bold text-gray-900 outline-none mt-1"
                               placeholder="0.00"
                             />
                           </div>
                       </div>
                   </div>
              )}

              {renderCategories()}

              {/* Show/Hide Details Toggle */}
              <button 
                  onClick={() => setShowMoreOptions(!showMoreOptions)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-500 mx-auto hover:text-blue-600 transition-colors bg-blue-50 px-3 py-1.5 rounded-full"
              >
                  {showMoreOptions ? t.cancel : t.moreOptions}
                  {showMoreOptions ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              </button>

              {/* Collapsible Details */}
              {showMoreOptions && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm animate-fade-in">
                     
                     {/* Split Date & Time Selection */}
                     <div className="flex items-center p-3 border-b border-gray-50 gap-3">
                         {/* Date Picker Button */}
                <button 
                   onClick={() => setIsDatePickerOpen(true)}
                   className="flex-1 flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl hover:bg-gray-100 transition-colors active:scale-95"
                >
                   <Calendar size={18} className="text-gray-400" />
                   <span className="font-bold text-sm text-gray-900">{date || 'Select Date'}</span>
                </button>

                {/* Time Picker Button */}
                <button 
                   onClick={() => setIsTimePickerOpen(true)}
                   className="flex-1 flex items-center justify-end gap-3 bg-gray-50 p-2.5 rounded-xl hover:bg-gray-100 transition-colors active:scale-95"
                >
                   <Clock size={18} className="text-gray-400" />
                   <span className="font-bold text-sm text-gray-900">{time || '00:00'}</span>
                </button>
                     </div>

                     <div className="flex items-center p-3">
                        <Edit2 size={18} className="text-gray-400 mr-3" />
                        <input 
                          type="text" 
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={t.description}
                          className="flex-1 font-medium text-gray-900 focus:outline-none bg-transparent"
                        />
                     </div>
                  </div>
              )}

              <div className="flex gap-3">
                 {initialData && onDelete && (
                    <button 
                        onClick={handleDeleteClick} 
                        className="p-4 bg-white border border-gray-200 text-red-500 rounded-2xl font-bold shadow-sm"
                    >
                        <Trash2 size={24}/>
                    </button>
                 )}
                 <button 
                   onClick={handleManualSave}
                   className="flex-1 py-4 bg-black text-white rounded-2xl font-bold text-lg shadow-xl shadow-gray-300 hover:scale-[1.02] transition-transform active:scale-95"
                 >
                   {initialData ? t.save : t.save}
                 </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Pickers & Modals */}
    {isCurrencyPickerOpen && (
        // ... (existing currency picker XML remains logic same, just re-rendering here not needed if unchanged logic, but for completeness)
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCurrencyPickerOpen(false)}></div>
            <div className="bg-white w-full max-w-sm rounded-t-[2rem] md:rounded-[2rem] shadow-2xl relative z-10 animate-fade-in-up flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-lg">{t.currency}</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">{t.rateUpdated} {formatLastUpdated(lastUpdated, user.language)}</p>
                    </div>
                    <button onClick={() => setIsCurrencyPickerOpen(false)} className="bg-gray-100 p-2 rounded-full"><X size={18}/></button>
                </div>
                
                {currency !== ledgerCurrency && (
                    <div className="p-4 bg-blue-50 border-b border-blue-100">
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-xs font-bold text-blue-600 uppercase">{t.exchangeRate}</span>
                             <button onClick={() => setExchangeRate('1')} className="text-[10px] font-bold text-blue-400 underline">{t.reset}</button>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-blue-200 shadow-sm">
                             <div className="flex-1 text-center border-r border-gray-100">
                                 <span className="block text-xs text-gray-400 font-bold">{currency}</span>
                                 <span className="block font-black text-lg">1</span>
                             </div>
                             <div className="text-gray-300 font-bold">=</div>
                             <div className="flex-1 text-center">
                                 <span className="block text-xs text-gray-400 font-bold">{ledgerCurrency}</span>
                                 <input 
                                    type="number" 
                                    value={exchangeRate}
                                    onChange={(e) => setExchangeRate(e.target.value)}
                                    className="w-full text-center font-black text-lg text-blue-600 bg-transparent outline-none border-b border-blue-200 focus:border-blue-500"
                                 />
                             </div>
                        </div>
                    </div>
                )}

                <div className="overflow-y-auto p-2">
                    {Object.keys(CURRENCY_SYMBOLS).map(c => (
                        <button 
                            key={c}
                            onClick={() => {
                                setCurrency(c);
                                if (c === ledgerCurrency) {
                                    setIsCurrencyPickerOpen(false);
                                }
                            }}
                            className={`w-full p-4 flex items-center justify-between rounded-xl transition-colors ${currency === c ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-900">{c}</span>
                                <span className="text-sm text-gray-400 font-medium">
                                  {c === 'CNY' ? '人民币' : 
                                   c === 'USD' ? 'US Dollar' : 
                                   c === 'JPY' ? 'Japanese Yen' : 
                                   c === 'EUR' ? 'Euro' : 
                                   c === 'CHF' ? 'Swiss Franc' : c}
                                </span>
                            </div>
                            {currency === c && <Check size={20} className="text-black" />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )}
    
    {isAccountSheetOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsAccountSheetOpen(false)}></div>
            <div className="bg-white w-full rounded-t-[2rem] overflow-hidden animate-ios-slide-up relative z-10 flex flex-col max-h-[70vh]">
                <div className="p-4 text-center border-b border-gray-100 bg-white sticky top-0 z-20">
                    <h3 className="font-bold text-lg text-gray-900">{t.account}</h3>
                </div>
                <div className="overflow-y-auto p-2 pb-safe">
                    {accounts.map(acc => (
                        <button
                            key={acc.id}
                            onClick={() => handleAccountSelect(acc.id)}
                            className={`w-full p-4 flex items-center gap-4 border-b border-gray-50 last:border-0 active:bg-gray-50 transition-colors ${
                                (accountSheetTarget === 'MANUAL' ? selectedAccountId : aiSelectedAccountId) === acc.id ? 'bg-gray-50' : 'bg-white'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 bg-gray-100`}>
                                {getAccountIcon(acc.type)}
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-bold text-gray-900 text-sm">{acc.name}</p>
                                <p className="text-xs text-gray-500 font-medium">{t.accTypes[acc.type] || acc.type} • {acc.currency}</p>
                            </div>
                            {(accountSheetTarget === 'MANUAL' ? selectedAccountId : aiSelectedAccountId) === acc.id && (
                                <Check size={20} className="text-black" />
                            )}
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-100 bg-white">
                    <button onClick={() => setIsAccountSheetOpen(false)} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">
                        {t.cancel}
                    </button>
                </div>
            </div>
        </div>
    )}
    
    {isTypeSheetOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsTypeSheetOpen(false)}></div>
            <div className="bg-white w-full rounded-t-[2rem] overflow-hidden animate-ios-slide-up relative z-10 flex flex-col pb-safe">
                <div className="p-4 text-center border-b border-gray-100 bg-white sticky top-0 z-20">
                    <h3 className="font-bold text-lg text-gray-900">{t.type}</h3>
                </div>
                <div className="p-4 space-y-3">
                    <button 
                       onClick={() => handleTypeChange(TransactionType.EXPENSE)}
                       className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${type === TransactionType.EXPENSE ? 'bg-red-50 ring-2 ring-red-100' : 'bg-white border border-gray-100'}`}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${type === TransactionType.EXPENSE ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <TrendingDown size={24} />
                        </div>
                        <div className="flex-1 text-left">
                            <span className={`text-lg font-bold ${type === TransactionType.EXPENSE ? 'text-gray-900' : 'text-gray-600'}`}>
                                {t.expense}
                            </span>
                        </div>
                        {type === TransactionType.EXPENSE && <Check size={24} className="text-red-500"/>}
                    </button>

                    <button 
                       onClick={() => handleTypeChange(TransactionType.INCOME)}
                       className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${type === TransactionType.INCOME ? 'bg-green-50 ring-2 ring-green-100' : 'bg-white border border-gray-100'}`}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${type === TransactionType.INCOME ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <TrendingUp size={24} />
                        </div>
                        <div className="flex-1 text-left">
                            <span className={`text-lg font-bold ${type === TransactionType.INCOME ? 'text-gray-900' : 'text-gray-600'}`}>
                                {t.income}
                            </span>
                        </div>
                        {type === TransactionType.INCOME && <Check size={24} className="text-green-500"/>}
                    </button>

                    <button 
                       onClick={() => handleTypeChange(TransactionType.TRANSFER)}
                       className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${type === TransactionType.TRANSFER ? 'bg-blue-50 ring-2 ring-blue-100' : 'bg-white border border-gray-100'}`}
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${type === TransactionType.TRANSFER ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            <ArrowRightLeft size={24} />
                        </div>
                        <div className="flex-1 text-left">
                            <span className={`text-lg font-bold ${type === TransactionType.TRANSFER ? 'text-gray-900' : 'text-gray-600'}`}>
                                {t.transfer}
                            </span>
                        </div>
                        {type === TransactionType.TRANSFER && <Check size={24} className="text-blue-500"/>}
                    </button>
                </div>
                <div className="p-4 pt-0">
                    <button onClick={() => setIsTypeSheetOpen(false)} className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold">
                        {t.cancel}
                    </button>
                </div>
            </div>
        </div>
    )}

    {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDeleteConfirmOpen(false)}></div>
            <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-10 shadow-2xl animate-scale-in">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                    <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{t.confirmDelete}</h3>
                <p className="text-gray-500 text-center mb-6 text-sm font-medium">This action cannot be undone.</p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsDeleteConfirmOpen(false)}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-2xl transition-colors"
                    >
                        {t.cancel}
                    </button>
                    <button 
                        onClick={confirmDelete}
                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-500/30 transition-colors"
                    >
                        {t.delete}
                    </button>
                </div>
            </div>
        </div>
    )}

    {isCategoryManagerOpen && (
      <CategoryManager 
        isOpen={isCategoryManagerOpen} 
        onClose={() => setCategoryManagerOpen(false)}
        user={user}
        categories={categories}
        onUpdateCategories={onUpdateCategories}
      />
    )}

    {/* Date Picker Modal Integration */}
    <DatePickerModal 
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        currentDate={new Date(date)} // We pass the selected date as object
        onDateChange={(d) => {
             // Convert selected Date object to YYYY-MM-DD
             const offset = d.getTimezoneOffset() * 60000;
             const local = new Date(d.getTime() - offset);
             setDate(local.toISOString().split('T')[0]);
        }}
        user={user}
    />

    {/* Time Picker Modal Integration */}
    <TimePickerModal
        isOpen={isTimePickerOpen}
        onClose={() => setIsTimePickerOpen(false)}
        onConfirm={(newTime) => setTime(newTime)}
        initialTime={time}
    />
    </>
  );
};

export default TransactionModal;
