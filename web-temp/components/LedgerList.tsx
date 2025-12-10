import React, { useState } from 'react';
import { ArrowLeft, Plus, Check, Edit2 } from 'lucide-react';
import { Ledger, UserProfile } from '../types';
import { I18N, CURRENCY_SYMBOLS } from '../constants';

interface LedgerListProps {
  onBack: () => void;
  ledgers: Ledger[];
  currentLedgerId: string;
  onSelectLedger: (id: string) => void;
  onCreateLedger: (name: string, currency: string) => void;
  onUpdateLedger: (id: string, name: string, currency: string) => void;
  user: UserProfile;
}

const LedgerList: React.FC<LedgerListProps> = ({ onBack, ledgers, currentLedgerId, onSelectLedger, onCreateLedger, onUpdateLedger, user }) => {
  const t = I18N[user.language];
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');

  const openCreate = () => {
      setEditingId(null);
      setName('');
      setCurrency('USD');
      setModalOpen(true);
  };

  const openEdit = (l: Ledger, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingId(l.id);
      setName(l.name);
      setCurrency(l.currency);
      setModalOpen(true);
  };

  const handleSave = () => {
      if(!name) return;
      if (editingId) {
          onUpdateLedger(editingId, name, currency);
      } else {
          onCreateLedger(name, currency);
      }
      setModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] z-50 fixed inset-0 animate-slide-in-right flex flex-col">
      <div className="bg-white/80 backdrop-blur-md z-10 px-4 py-4 border-b border-gray-100 flex items-center gap-4 sticky top-0">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t.ledgers}</h1>
        <button onClick={openCreate} className="ml-auto p-2 bg-black text-white rounded-full">
            <Plus size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
         {ledgers.map(l => (
             <div 
                key={l.id}
                onClick={() => onSelectLedger(l.id)}
                className={`clickable bg-white p-4 rounded-2xl shadow-sm border-2 transition-all flex items-center gap-4 cursor-pointer ${currentLedgerId === l.id ? 'border-blue-500' : 'border-transparent'}`}
             >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${l.color} text-white`}>
                    {l.icon}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{l.name}</h3>
                    <p className="text-xs text-gray-500 font-bold">{l.currency} Ledger</p>
                </div>
                <button onClick={(e) => openEdit(l, e)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200">
                    <Edit2 size={16}/>
                </button>
                {currentLedgerId === l.id && <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"><Check size={14} className="text-white"/></div>}
             </div>
         ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)}></div>
             <div className="bg-white w-full max-w-sm p-6 rounded-[2rem] relative z-10 animate-fade-in-up">
                 <h3 className="text-xl font-bold mb-4">{editingId ? t.editLedger : t.addLedger}</h3>
                 <div className="space-y-4">
                     <div>
                         <label className="text-xs font-bold text-gray-400 uppercase">Name</label>
                         <input value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold outline-none" placeholder="My Book"/>
                     </div>
                     <div>
                         <label className="text-xs font-bold text-gray-400 uppercase">Currency</label>
                         <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold outline-none">
                             {Object.keys(CURRENCY_SYMBOLS).map(c => <option key={c} value={c}>{c}</option>)}
                         </select>
                     </div>
                     <button onClick={handleSave} className="w-full py-3 bg-black text-white rounded-xl font-bold shadow-lg">
                        {editingId ? t.save : t.create}
                     </button>
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default LedgerList;