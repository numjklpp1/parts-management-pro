import React from 'react';
import { PartCategory, Language } from '../types';
import { translations } from '../utils/translations';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: 'dashboard' | 'form' | 'list' | 'settings';
  selectedCategory?: PartCategory;
  onNavigate: (view: 'dashboard' | 'form' | 'list' | 'settings') => void;
  onNavigateToForm: (category: PartCategory) => void;
  language: Language;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView, selectedCategory, onNavigate, onNavigateToForm, language }) => {
  const t = (key: string) => translations[language][key] || key;

  const categories = [
    { id: PartCategory.GlassSlidingDoor, label: t('glass_door'), icon: '🪟' },
    { id: PartCategory.IronSlidingDoor, label: t('iron_door'), icon: '🏗️' },
    { id: PartCategory.Drawer, label: t('drawer'), icon: '📥' },
    { id: PartCategory.CabinetBody, label: t('cabinet'), icon: '📦' },
    { id: PartCategory.Paint, label: t('paint'), icon: '🎨' },
  ];

  const handleNavigate = (view: 'dashboard' | 'form' | 'list' | 'settings') => {
    onNavigate(view);
    if (window.innerWidth < 1024) onClose();
  };

  const handleNavigateToForm = (category: PartCategory) => {
    onNavigateToForm(category);
    if (window.innerWidth < 1024) onClose();
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col border-r border-slate-800 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:w-64`}>
        <div className="p-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-blue-400">Inventory</span> Pro
          </h1>
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400">✕</button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-4 mb-1">MENU</p>
          <button onClick={() => handleNavigate('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${currentView === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <span className="text-lg">📊</span>
            <span className="font-medium">{t('dashboard')}</span>
          </button>

          <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-8 mb-1">FORMS</p>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => handleNavigateToForm(cat.id)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl ${currentView === 'form' && selectedCategory === cat.id ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <span className="text-base">{cat.icon}</span>
                <span className="text-sm font-medium">{cat.label}</span>
              </button>
            ))}
          </div>

          <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-8 mb-1">SYSTEM</p>
          <button onClick={() => handleNavigate('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${currentView === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <span className="text-lg">⚙️</span>
            <span className="font-medium">{t('settings')}</span>
          </button>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;