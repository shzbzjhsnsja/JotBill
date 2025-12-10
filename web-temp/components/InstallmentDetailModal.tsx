
import React, { useState } from 'react';
import { X, CalendarClock, Check, Split, AlertCircle, TrendingDown, HelpCircle } from 'lucide-react';
import { Transaction, UserProfile, Account } from '../types';
import { I18N, CURRENCY_SYMBOLS } from '../constants';

interface InstallmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction;
  user: UserProfile;
  account: Account;
  onEarlyRepayment: (txId: string) => void;
}

const InstallmentDetailModal: React.FC<InstallmentDetailModalProps> = ({ 
  isOpen, onClose, transaction, user, account, onEarlyRepayment 
}) => {
  const t = I18N[user.language];
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!isOpen) return null;

  const total = transaction.installmentTotal || 1;
  const current = transaction.installmentCurrent || 1;
  const remainingPeriods = total - current;
  
  // Calculate amounts
  const totalAmount = transaction.amount + (transaction.installmentFee || 0);
  const monthlyAmount = totalAmount / total;
  const remainingAmount = monthlyAmount * remainingPeriods;

  const handleRepayClick = () => {
      setIsConfirmOpen(true);
  };

  const confirmRepayment = () => {
      onEarlyRepayment(transaction.id);
      setIsConfirmOpen(false);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl relative z-10 animate-fade-in-up overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
           <div className="flex items-center gap-2 text-gray-900">
               <Split size={20} className="text-purple-600"/>
               <h3 className="text-lg font-bold">{t.planDetails}</h3>
           </div>
           <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>

        <div className="p-6 space-y-6">
           {/* Description */}
           <div className="text-center">
               <p className="text-xl font-bold text-gray-900">{transaction.description}</p>
               <p className="text-sm text-gray-400">{transaction.merchant}</p>
           </div>

           {/* Progress */}
           <div>
               <div className="flex justify-between text-xs font-bold mb-2">
                   <span className="text-blue-600">{t.current}: {current}/{total}</span>
                   <span className="text-gray-400">{(current/total * 100).toFixed(0)}%</span>
               </div>
               <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                   <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-700" 
                      style={{ width: `${(current/total * 100)}%` }}
                   />
               </div>
           </div>

           {/* Stats Grid */}
           <div className="grid grid-cols-2 gap-4">
               <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                   <p className="text-[10px] font-bold text-blue-400 uppercase">{t.monthlyPayment}</p>
                   <p className="text-xl font-black text-gray-900 mt-1">
                       {CURRENCY_SYMBOLS[transaction.currency]}{monthlyAmount.toLocaleString(undefined, {maximumFractionDigits: 2})}
                   </p>
               </div>
               <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                   <p className="text-[10px] font-bold text-orange-400 uppercase">{t.remainingPrincipal}</p>
                   <p className="text-xl font-black text-gray-900 mt-1">
                       {CURRENCY_SYMBOLS[transaction.currency]}{remainingAmount.toLocaleString(undefined, {maximumFractionDigits: 2})}
                   </p>
               </div>
           </div>
           
           {/* Details Table */}
           <div className="bg-gray-50 rounded-2xl p-4 text-sm space-y-3">
               <div className="flex justify-between">
                   <span className="text-gray-400">{t.totalCost}</span>
                   <span className="font-bold text-gray-900">{CURRENCY_SYMBOLS[transaction.currency]}{totalAmount.toLocaleString()}</span>
               </div>
               <div className="flex justify-between">
                   <span className="text-gray-400">{t.interestFee}</span>
                   <span className="font-bold text-gray-900">{transaction.installmentFee ? `+ ${transaction.installmentFee}` : '-'}</span>
               </div>
               <div className="flex justify-between">
                   <span className="text-gray-400">{t.account}</span>
                   <span className="font-bold text-gray-900">{account.name}</span>
               </div>
           </div>
           
           {/* Action Button */}
           <button 
             onClick={handleRepayClick}
             className="w-full py-4 bg-black text-white rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95"
           >
               <Check size={20} />
               {t.earlyRepayment}
           </button>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {isConfirmOpen && (
          <div className="absolute inset-0 z-[150] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsConfirmOpen(false)}></div>
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm relative z-20 shadow-2xl animate-scale-in">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 mb-4 mx-auto">
                      <HelpCircle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{t.confirmEarlyRepayment}</h3>
                  <div className="flex gap-3 mt-6">
                      <button 
                          onClick={() => setIsConfirmOpen(false)}
                          className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-2xl transition-colors"
                      >
                          {t.cancel}
                      </button>
                      <button 
                          onClick={confirmRepayment}
                          className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-2xl shadow-lg transition-colors"
                      >
                          {t.save}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default InstallmentDetailModal;
