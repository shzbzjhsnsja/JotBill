
import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (time: string) => void;
  initialTime: string; // HH:mm format
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({ isOpen, onClose, onConfirm, initialTime }) => {
  const [selectedHour, setSelectedHour] = useState('00');
  const [selectedMinute, setSelectedMinute] = useState('00');
  
  // Refs for scrolling to position
  const hourContainerRef = useRef<HTMLDivElement>(null);
  const minuteContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        const [h, m] = (initialTime || '00:00').split(':');
        setSelectedHour(h || '00');
        setSelectedMinute(m || '00');
        
        // Scroll to position after render
        setTimeout(() => {
            scrollToValue(hourContainerRef.current, parseInt(h || '0'), 50); 
            scrollToValue(minuteContainerRef.current, parseInt(m || '0'), 50);
        }, 100);
    }
  }, [isOpen, initialTime]);

  const scrollToValue = (container: HTMLDivElement | null, value: number, itemHeight: number) => {
      if (container) {
          container.scrollTop = value * itemHeight;
      }
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  if (!isOpen) return null;

  const handleConfirm = () => {
      onConfirm(`${selectedHour}:${selectedMinute}`);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-sm rounded-t-[2rem] md:rounded-[2rem] shadow-2xl relative z-10 animate-ios-slide-up flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-20 relative">
            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                <X size={18}/>
            </button>
            <h3 className="text-lg font-bold text-gray-900">Select Time</h3>
            <button onClick={handleConfirm} className="p-2 bg-black text-white rounded-full hover:scale-105 transition-transform shadow-md">
                <Check size={18}/>
            </button>
        </div>

        <div className="p-8 pb-12 flex justify-center items-center gap-4 h-64 relative bg-gray-50">
            {/* Selection Highlight Bar */}
            <div className="absolute top-1/2 -translate-y-1/2 left-4 right-4 h-12 bg-white rounded-xl shadow-sm border border-gray-200 pointer-events-none z-0"></div>

            {/* Hour Wheel */}
            <div className="flex-1 h-full relative z-10 overflow-hidden group">
                 <div 
                    ref={hourContainerRef}
                    className="h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-[100px]"
                    onScroll={(e) => {
                        const target = e.currentTarget;
                        const index = Math.round(target.scrollTop / 50);
                        if (hours[index]) setSelectedHour(hours[index]);
                    }}
                 >
                     {hours.map(h => (
                         <div key={h} className={`h-[50px] flex items-center justify-center font-bold text-2xl snap-center transition-all ${selectedHour === h ? 'text-gray-900 scale-110' : 'text-gray-300 scale-90'}`}>
                             {h}
                         </div>
                     ))}
                 </div>
                 <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-gray-50 to-transparent pointer-events-none"></div>
                 <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
            </div>

            {/* Separator */}
            <div className="text-2xl font-black text-gray-300 pb-1">:</div>

            {/* Minute Wheel */}
            <div className="flex-1 h-full relative z-10 overflow-hidden group">
                 <div 
                    ref={minuteContainerRef}
                    className="h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-[100px]"
                    onScroll={(e) => {
                        const target = e.currentTarget;
                        const index = Math.round(target.scrollTop / 50);
                        if (minutes[index]) setSelectedMinute(minutes[index]);
                    }}
                 >
                     {minutes.map(m => (
                         <div key={m} className={`h-[50px] flex items-center justify-center font-bold text-2xl snap-center transition-all ${selectedMinute === m ? 'text-gray-900 scale-110' : 'text-gray-300 scale-90'}`}>
                             {m}
                         </div>
                     ))}
                 </div>
                 <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-gray-50 to-transparent pointer-events-none"></div>
                 <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TimePickerModal;
