import React, { useState } from 'react';
import { ArrowLeft, Plus, X, Trash2, Check, Edit2 } from 'lucide-react';
import { Category, UserProfile, TransactionType } from '../types';
import { I18N, ICON_MAP } from '../constants';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  categories: Category[];
  onUpdateCategories: (newCats: Category[]) => void;
}

const COLORS = ['#FF9500', '#007AFF', '#AF52DE', '#34C759', '#FF2D55', '#5856D6', '#FF3B30', '#5AC8FA', '#4CD964', '#8E8E93'];
const ICONS = Object.keys(ICON_MAP);

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose, user, categories, onUpdateCategories }) => {
  const t = I18N[user.language];
  const [activeTab, setActiveTab] = useState<TransactionType>(TransactionType.EXPENSE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null); // If adding/editing sub-category

  // Form State
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(ICONS[0]);

  if (!isOpen) return null;

  const handleEdit = (cat: Category, parent?: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color);
    setIcon(cat.icon);
    setParentId(parent ? parent.id : null);
  };

  const handleAddNew = (parentCatId?: string) => {
    setEditingId(null);
    setName('');
    setColor(COLORS[0]);
    setIcon(ICONS[0]);
    setParentId(parentCatId || null);
    // Switch view to form... handled by conditional rendering below?
    // Let's toggle a "form view" state
    setEditingId('NEW');
  };

  const handleSave = () => {
    if (!name) return;

    if (editingId === 'NEW') {
      // Create
      const newCat: Category = {
        id: `c-${Date.now()}`,
        name,
        color,
        icon,
        type: activeTab,
        subCategories: []
      };

      if (parentId) {
         // Add as sub-category
         const updated = categories.map(c => {
           if (c.id === parentId) {
             return { ...c, subCategories: [...(c.subCategories || []), newCat] };
           }
           return c;
         });
         onUpdateCategories(updated);
      } else {
         // Add as main
         onUpdateCategories([...categories, newCat]);
      }
    } else {
      // Update
      let updated = categories.map(c => {
        if (c.id === editingId) {
           return { ...c, name, color, icon };
        }
        // Check subs
        if (c.subCategories) {
           const updatedSubs = c.subCategories.map(s => s.id === editingId ? { ...s, name, color, icon } : s);
           return { ...c, subCategories: updatedSubs };
        }
        return c;
      });
      onUpdateCategories(updated);
    }
    setEditingId(null);
  };

  const handleDelete = () => {
    if (!editingId || editingId === 'NEW') return;
    
    // Logic to remove
    const updated = categories.filter(c => c.id !== editingId).map(c => {
       if (c.subCategories) {
         return { ...c, subCategories: c.subCategories.filter(s => s.id !== editingId) };
       }
       return c;
    });
    onUpdateCategories(updated);
    setEditingId(null);
  };

  const filteredCategories = categories.filter(c => c.type === activeTab);

  return (
    <div className="fixed inset-0 z-[70] bg-[#F2F2F7] animate-slide-in-right flex flex-col">
       {/* Header */}
       <div className="bg-white/80 backdrop-blur-md px-4 py-4 border-b border-gray-100 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <button onClick={editingId ? () => setEditingId(null) : onClose} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft size={24} />
            </button>
            <h2 className="text-xl font-bold">{editingId ? (editingId === 'NEW' ? t.addCategory : t.edit) : t.manageCategories}</h2>
         </div>
       </div>

       {/* Content */}
       <div className="flex-1 overflow-y-auto p-4">
          
          {editingId ? (
            /* Edit/Add Form */
            <div className="space-y-6 max-w-lg mx-auto">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">{t.name}</label>
                    <input 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className="w-full text-lg font-bold border-b border-gray-200 py-2 focus:outline-none focus:border-blue-500"
                      placeholder="Category Name"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">{t.color}</label>
                    <div className="flex flex-wrap gap-3">
                       {COLORS.map(c => (
                         <button 
                           key={c}
                           onClick={() => setColor(c)}
                           className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                           style={{backgroundColor: c}}
                         />
                       ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">{t.icon}</label>
                    <div className="grid grid-cols-6 gap-2">
                       {ICONS.map(i => (
                         <button 
                           key={i}
                           onClick={() => setIcon(i)}
                           className={`p-2 rounded-xl flex items-center justify-center transition-all ${icon === i ? 'bg-black text-white' : 'bg-gray-50 text-gray-500'}`}
                         >
                           {ICON_MAP[i]}
                         </button>
                       ))}
                    </div>
                  </div>
               </div>
               
               <div className="flex gap-4">
                  {editingId !== 'NEW' && (
                    <button onClick={handleDelete} className="flex-1 py-4 bg-white text-red-500 font-bold rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center gap-2">
                      <Trash2 size={18}/> {t.delete}
                    </button>
                  )}
                  <button onClick={handleSave} className="flex-[2] py-4 bg-black text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2">
                     <Check size={18}/> {t.save}
                  </button>
               </div>
            </div>
          ) : (
            /* List View */
            <div className="space-y-6">
                {/* Tabs */}
                <div className="flex bg-gray-200 p-1 rounded-xl">
                    <button onClick={() => setActiveTab(TransactionType.EXPENSE)} className={`flex-1 py-2 rounded-lg font-bold text-sm ${activeTab === TransactionType.EXPENSE ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{t.expense}</button>
                    <button onClick={() => setActiveTab(TransactionType.INCOME)} className={`flex-1 py-2 rounded-lg font-bold text-sm ${activeTab === TransactionType.INCOME ? 'bg-white shadow-sm' : 'text-gray-500'}`}>{t.income}</button>
                </div>

                <div className="space-y-3">
                   {filteredCategories.map(cat => (
                     <div key={cat.id} className="clickable bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="flex items-center p-3 gap-3" onClick={() => handleEdit(cat)}>
                           <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{backgroundColor: cat.color}}>
                              {ICON_MAP[cat.icon]}
                           </div>
                           <span className="font-bold flex-1">{cat.name}</span>
                           <button className="text-gray-300"><ArrowLeft size={16} className="rotate-180"/></button>
                        </div>
                        {/* Subs */}
                        {cat.subCategories && cat.subCategories.length > 0 && (
                          <div className="bg-gray-50 p-2 pl-14 grid grid-cols-1 gap-1">
                             {cat.subCategories.map(sub => (
                               <div key={sub.id} className="clickable flex items-center justify-between p-2 rounded-lg hover:bg-gray-100" onClick={() => handleEdit(sub, cat)}>
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: sub.color}}/>
                                    <span className="text-sm font-medium text-gray-600">{sub.name}</span>
                                  </div>
                                  <Edit2 size={12} className="text-gray-300"/>
                               </div>
                             ))}
                          </div>
                        )}
                        <button onClick={() => handleAddNew(cat.id)} className="w-full py-2 text-xs font-bold text-blue-500 bg-gray-50 border-t border-gray-100">
                           + {t.addCategory}
                        </button>
                     </div>
                   ))}
                </div>

                <button onClick={() => handleAddNew()} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 font-bold flex items-center justify-center gap-2 hover:bg-white hover:border-gray-400 transition-colors">
                   <Plus size={20}/> {t.addCategory}
                </button>
            </div>
          )}
       </div>
    </div>
  );
};

export default CategoryManager;