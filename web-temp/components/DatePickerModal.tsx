
import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { I18N } from '../constants';
import { UserProfile } from '../types';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  user: UserProfile;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({ isOpen, onClose, currentDate, onDateChange, user }) => {
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const t = I18N[user.language];

  if (!isOpen) return null;

  const months = Array.from({ length: 12 }, (_, i) => i);

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(selectedYear, monthIndex, 1);
    onDateChange(newDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>
      <div 
        className="bg-white w-full max-w-md rounded-t-[2rem] md:rounded-[2rem] shadow-2xl relative z-10 animate-ios-slide-up flex flex-col overflow-hidden"
        style={{ maxHeight: '85vh' }}
      >
        
        {/* Header - Fixed at top */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">{t.selectDate}</h3>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"><X size={18}/></button>
        </div>

        {/* Scrollable Body - flex-1 ensures it takes remaining height and scrolls */}
        {/* ADDED pb-20 to ensure content is never cut off */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 scroll-smooth pb-20">
            {/* Year Selector */}
            <div className="flex items-center justify-center gap-8 mb-8">
                <button onClick={() => setSelectedYear(y => y - 1)} className="p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"><ChevronLeft size={20}/></button>
                <span className="text-3xl font-black text-gray-900">{selectedYear}</span>
                <button onClick={() => setSelectedYear(y => y + 1)} className="p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"><ChevronRight size={20}/></button>
            </div>

            {/* Month Grid */}
            <div className="grid grid-cols-4 gap-4">
                {months.map(m => {
                    const isSelected = selectedYear === currentDate.getFullYear() && m === currentDate.getMonth();
                    return (
                        <button
                            key={m}
                            onClick={() => handleMonthSelect(m)}
                            className={`py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 flex-shrink-0 ${
                                isSelected 
                                ? 'bg-black text-white shadow-lg' 
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            {user.language === 'zh' ? `${m + 1}月` : new Date(2000, m, 1).toLocaleString('en-US', { month: 'short' })}
                        </button>
                    )
                })}
            </div>
            
            {/* Explicit Spacer for Bottom Padding + Safe Area (Increased to h-32) */}
            <div className="h-32 w-full shrink-0" />
            <div className="pb-safe" />
        </div>

      </div>
    </div>
  );
};

export default DatePickerModal;
