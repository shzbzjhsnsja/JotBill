
import React, { useState } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { parseTransactionText } from '../services/geminiService';
import { AIParseResult, TransactionType, UserProfile } from '../types';
import { I18N } from '../constants';

interface AITransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (result: AIParseResult) => void;
  user: UserProfile;
}

const AITransactionModal: React.FC<AITransactionModalProps> = ({ isOpen, onClose, onSave, user }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<AIParseResult | null>(null);
  const t = I18N[user.language];

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    const result = await parseTransactionText(input);
    setParsedData(result);
    setIsLoading(false);
  };

  const handleConfirm = () => {
    if (parsedData) {
      onSave(parsedData);
      handleClose();
    }
  };

  const handleClose = () => {
    setInput('');
    setParsedData(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={handleClose}></div>
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden relative z-10 animate-fade-in-up">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-2 text-blue-600">
            <Sparkles size={20} />
            <span className="font-bold text-lg">{t.parse}</span>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!parsedData ? (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700">{t.describeTx}</label>
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.aiTip}
                  className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-gray-900 font-medium"
                  autoFocus
                />
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={handleParse}
                  disabled={!input.trim() || isLoading}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all ${
                    !input.trim() || isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t.parsing}
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      {t.parse}
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-3 animate-scale-in">
                  <Check size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{t.looksGood}</h3>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-500 text-sm font-medium">{t.amount}</span>
                  <span className={`text-lg font-bold ${parsedData.type === TransactionType.INCOME ? 'text-green-600' : 'text-gray-900'}`}>
                    {parsedData.currency} {parsedData.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-500 text-sm font-medium">{t.category}</span>
                  <span className="text-gray-900 font-bold bg-white px-2 py-1 rounded-lg border border-gray-200 text-xs shadow-sm">
                    {parsedData.category}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                  <span className="text-gray-500 text-sm font-medium">{t.merchant}</span>
                  <span className="text-gray-900 font-bold">{parsedData.merchant || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-500 text-sm font-medium">{t.date}</span>
                  <span className="text-gray-900 font-bold">{parsedData.date}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setParsedData(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {t.edit}
                </button>
                <button 
                  onClick={handleConfirm}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30 transition-all"
                >
                  {t.saveTx}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AITransactionModal;
