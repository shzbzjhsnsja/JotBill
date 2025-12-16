import React, { useEffect, useMemo, useRef, useState } from 'react';
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

// 星期标题（从周日开始，与示例一致）
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  onDateChange,
  user,
}) => {
  // 固定 Hooks 顺序：3 个 useState + 1 个 useEffect
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth()); // 0-11
  const [day, setDay] = useState(currentDate.getDate());
  const [mode, setMode] = useState<'calendar' | 'ym'>('calendar');

  // Year/Month wheel state
  const [wheelYear, setWheelYear] = useState(currentDate.getFullYear());
  const [wheelMonth, setWheelMonth] = useState(currentDate.getMonth()); // 0-11
  const yearWheelRef = useRef<HTMLDivElement>(null);
  const monthWheelRef = useRef<HTMLDivElement>(null);

  // 计算当月日历（周日开头）
  const daysMatrix = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0-6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // 补足尾部，使其凑整 7 列
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const handlePrevMonth = () => {
    setDay(1);
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setDay(1);
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (d: number) => {
    if (!d) return;
    setDay(d);
    onDateChange(new Date(year, month, d));
    onClose();
  };

  const monthLabel =
    user.language === 'zh'
      ? `${year}年 ${month + 1}月`
      : new Date(year, month, 1).toLocaleString('en-US', { year: 'numeric', month: 'long' });

  const t = I18N[user.language];

  // 同步外部日期，仅在 isOpen 时更新状态
  useEffect(() => {
    if (isOpen) {
      setYear(currentDate.getFullYear());
      setMonth(currentDate.getMonth());
      setDay(currentDate.getDate());
      setMode('calendar');
    }
  }, [isOpen, currentDate]);

  const yearOptions = useMemo(() => {
    const base = currentDate.getFullYear();
    const start = base - 30;
    const end = base + 10;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentDate]);

  const scrollToWheelIndex = (container: HTMLDivElement | null, index: number, itemHeight: number) => {
    if (!container) return;
    container.scrollTop = Math.max(0, index * itemHeight);
  };

  // 当进入年月选择模式时，同步 wheel 并滚动到对应位置
  useEffect(() => {
    if (!isOpen) return;
    if (mode !== 'ym') return;

    setWheelYear(year);
    setWheelMonth(month);
    const itemHeight = 44;

    const yearIndex = Math.max(0, yearOptions.indexOf(year));
    const monthIndex = Math.max(0, month);
    setTimeout(() => {
      scrollToWheelIndex(yearWheelRef.current, yearIndex, itemHeight);
      scrollToWheelIndex(monthWheelRef.current, monthIndex, itemHeight);
    }, 0);
  }, [isOpen, mode, year, month, yearOptions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-md rounded-t-[2rem] md:rounded-[2rem] shadow-2xl relative z-10 animate-ios-slide-up flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{t.selectDate}</h3>
          <div className="flex items-center gap-2">
            {mode === 'ym' && (
              <button
                type="button"
                onClick={() => {
                  setYear(wheelYear);
                  setMonth(wheelMonth);
                  const maxDay = new Date(wheelYear, wheelMonth + 1, 0).getDate();
                  setDay((d) => Math.min(d, maxDay));
                  setMode('calendar');
                }}
                className="px-3 py-1.5 text-sm font-bold bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                完成
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {mode === 'calendar' ? (
          <div className="flex flex-col px-6 pt-5 pb-10 space-y-5">
            {/* Month / Year selector */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setMode('ym')}
                className="text-lg font-black text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                {monthLabel}
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Week labels */}
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400">
              {WEEK_LABELS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-3 pb-2">
              {daysMatrix.map((d, idx) => {
                if (!d) return <div key={idx} className="h-10" />;
                const isSelected = d === day;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectDay(d)}
                    className={`h-10 rounded-xl text-sm font-semibold transition-all active:scale-95 border border-transparent ${
                      isSelected
                        ? 'bg-black text-white shadow-lg'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-6 pt-5 pb-6">
            <div className="text-sm font-bold text-gray-900 mb-3">{user.language === 'zh' ? '选择年月' : 'Select Year & Month'}</div>

            <div className="relative bg-gray-50 rounded-2xl p-4 flex gap-4">
              {/* highlight */}
              <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-11 bg-white rounded-xl shadow-sm border border-gray-200 pointer-events-none" />

              {/* Year wheel */}
              <div className="flex-1 overflow-hidden relative z-10 h-[132px]">
                <div
                  ref={yearWheelRef}
                  className="h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-[44px]"
                  onScroll={(e) => {
                    const idx = Math.round(e.currentTarget.scrollTop / 44);
                    const y = yearOptions[idx];
                    if (y !== undefined) setWheelYear(y);
                  }}
                >
                  {yearOptions.map((y) => (
                    <div
                      key={y}
                      className={`h-[44px] flex items-center justify-center font-black text-2xl snap-center transition-all ${
                        wheelYear === y ? 'text-gray-900 scale-110' : 'text-gray-300 scale-90'
                      }`}
                    >
                      {y}
                    </div>
                  ))}
                </div>
              </div>

              {/* Month wheel */}
              <div className="w-24 overflow-hidden relative z-10 h-[132px]">
                <div
                  ref={monthWheelRef}
                  className="h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-[44px]"
                  onScroll={(e) => {
                    const idx = Math.round(e.currentTarget.scrollTop / 44);
                    if (idx >= 0 && idx <= 11) setWheelMonth(idx);
                  }}
                >
                  {Array.from({ length: 12 }, (_, m) => (
                    <div
                      key={m}
                      className={`h-[44px] flex items-center justify-center font-black text-2xl snap-center transition-all ${
                        wheelMonth === m ? 'text-gray-900 scale-110' : 'text-gray-300 scale-90'
                      }`}
                    >
                      {user.language === 'zh' ? `${m + 1}月` : String(m + 1).padStart(2, '0')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatePickerModal;
