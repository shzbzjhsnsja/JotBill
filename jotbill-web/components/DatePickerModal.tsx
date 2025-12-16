import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { I18N } from '../constants';
import { UserProfile } from '../types';

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  user: UserProfile;
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_COUNT = 3;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_COUNT; // 132
const WHEEL_PADDING = WHEEL_ITEM_HEIGHT; // top/bottom padding to center selected item

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  onDateChange,
  user,
}) => {
  const t = I18N[user.language];

  const [year, setYear] = useState<number>(currentDate.getFullYear());
  const [month, setMonth] = useState<number>(currentDate.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<number>(currentDate.getDate());
  const [mode, setMode] = useState<'calendar' | 'ym'>('calendar');

  const [wheelYear, setWheelYear] = useState<number>(currentDate.getFullYear());
  const [wheelMonth, setWheelMonth] = useState<number>(currentDate.getMonth());
  const yearWheelRef = useRef<HTMLDivElement>(null);
  const monthWheelRef = useRef<HTMLDivElement>(null);

  const daysMatrix = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0 Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const yearOptions = useMemo(() => {
    const base = currentDate.getFullYear();
    const start = base - 30;
    const end = base + 10;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentDate]);

  const monthLabel =
    user.language === 'zh'
      ? `${year}年 ${month + 1}月`
      : new Date(year, month, 1).toLocaleString('en-US', { year: 'numeric', month: 'long' });

  const scrollToWheelIndex = (container: HTMLDivElement | null, index: number) => {
    if (!container) return;
    container.scrollTop = Math.max(0, index * WHEEL_ITEM_HEIGHT);
  };

  useEffect(() => {
    if (isOpen) {
      setYear(currentDate.getFullYear());
      setMonth(currentDate.getMonth());
      setSelectedDay(currentDate.getDate());
      setMode('calendar');
    }
  }, [isOpen, currentDate]);

  useEffect(() => {
    if (!isOpen) return;
    if (mode !== 'ym') return;

    setWheelYear(year);
    setWheelMonth(month);
    const yIndex = Math.max(0, yearOptions.indexOf(year));
    const mIndex = Math.max(0, month);
    setTimeout(() => {
      scrollToWheelIndex(yearWheelRef.current, yIndex);
      scrollToWheelIndex(monthWheelRef.current, mIndex);
    }, 0);
  }, [isOpen, mode, year, month, yearOptions]);

  const handlePrevMonth = () => {
    setSelectedDay(1);
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDay(1);
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const applyWheelAndBack = () => {
    setYear(wheelYear);
    setMonth(wheelMonth);
    const maxDay = new Date(wheelYear, wheelMonth + 1, 0).getDate();
    setSelectedDay((d) => Math.min(d, maxDay));
    setMode('calendar');
  };

  const handleSelectDay = (d: number) => {
    setSelectedDay(d);
    onDateChange(new Date(year, month, d));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div
        className="bg-white w-full max-w-md rounded-t-[2rem] md:rounded-[2rem] shadow-2xl relative z-10 animate-ios-slide-up flex flex-col overflow-hidden"
        style={{ maxHeight: '85vh' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{t.selectDate}</h3>
          {mode === 'ym' ? (
            <button
              type="button"
              onClick={applyWheelAndBack}
              className="px-3 py-1.5 text-sm font-bold bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            >
              返回
            </button>
          ) : (
            <button
              onClick={onClose}
              className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {mode === 'calendar' ? (
          <div className="flex flex-col px-6 pt-5 pb-10 space-y-5">
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

            <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400">
              {WEEK_LABELS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-3 pb-2">
              {daysMatrix.map((d, idx) => {
                if (!d) return <div key={idx} className="h-10" />;
                const isSelected = d === selectedDay;
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
            <div className="text-sm font-bold text-gray-900 mb-3">
              {user.language === 'zh' ? '选择年月' : 'Select Year & Month'}
            </div>

            <div className="relative bg-gray-50 rounded-2xl p-4 flex gap-4 items-center justify-center overflow-hidden">
              <div
                className="absolute left-4 right-4 bg-white rounded-xl shadow-sm border border-gray-200 pointer-events-none"
                style={{ top: WHEEL_PADDING, height: WHEEL_ITEM_HEIGHT }}
              />
              <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-gray-50 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none" />

              <div className="flex-1 overflow-hidden relative z-10" style={{ height: WHEEL_HEIGHT }}>
                <div
                  ref={yearWheelRef}
                  className="h-full overflow-y-auto no-scrollbar snap-y snap-mandatory"
                  style={{ paddingTop: WHEEL_PADDING, paddingBottom: WHEEL_PADDING, overscrollBehavior: 'contain' as any }}
                  onScroll={(e) => {
                    const idx = Math.round(e.currentTarget.scrollTop / WHEEL_ITEM_HEIGHT);
                    const y = yearOptions[idx];
                    if (y !== undefined) setWheelYear(y);
                  }}
                >
                  {yearOptions.map((y) => (
                    <div
                      key={y}
                      className={`flex items-center justify-center font-black text-2xl snap-center transition-all`}
                      style={{
                        height: WHEEL_ITEM_HEIGHT,
                        transform: wheelYear === y ? 'scale(1.1)' : 'scale(0.9)',
                        color: wheelYear === y ? '#111827' : '#D1D5DB',
                      }}
                    >
                      {y}
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-24 overflow-hidden relative z-10" style={{ height: WHEEL_HEIGHT }}>
                <div
                  ref={monthWheelRef}
                  className="h-full overflow-y-auto no-scrollbar snap-y snap-mandatory"
                  style={{ paddingTop: WHEEL_PADDING, paddingBottom: WHEEL_PADDING, overscrollBehavior: 'contain' as any }}
                  onScroll={(e) => {
                    const idx = Math.round(e.currentTarget.scrollTop / WHEEL_ITEM_HEIGHT);
                    if (idx >= 0 && idx <= 11) setWheelMonth(idx);
                  }}
                >
                  {Array.from({ length: 12 }, (_, m) => (
                    <div
                      key={m}
                      className="flex items-center justify-center font-black text-2xl snap-center transition-all"
                      style={{
                        height: WHEEL_ITEM_HEIGHT,
                        transform: wheelMonth === m ? 'scale(1.1)' : 'scale(0.9)',
                        color: wheelMonth === m ? '#111827' : '#D1D5DB',
                      }}
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
