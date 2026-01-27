
import React from 'react';
import { PartCategory } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: 'dashboard' | 'form' | 'list' | 'settings';
  selectedCategory?: PartCategory;
  onNavigate: (view: 'dashboard' | 'form' | 'list' | 'settings') => void;
  onNavigateToForm: (category: PartCategory) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView, selectedCategory, onNavigate, onNavigateToForm }) => {
  const categories = [
    { id: PartCategory.GlassSlidingDoor, label: '玻璃拉門', icon: '🪟' },
    { id: PartCategory.IronSlidingDoor, label: '鐵拉門', icon: '🏗️' },
    { id: PartCategory.Drawer, label: '抽屜', icon: '📥' },
    { id: PartCategory.CabinetBody, label: '桶身', icon: '📦' },
    { id: PartCategory.Paint, label: '噴漆', icon: '🎨' },
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
      {/* 手機版遮罩背景 */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* 側邊欄本體 */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col border-r border-slate-800 
        transition-transform duration-300 ease-in-out transform
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:w-64
      `}>
        <div className="p-8 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-blue-400">Inventory</span> Pro
          </h1>
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400">
            ✕
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-4 mb-1">
            主要功能
          </p>
          <button
            onClick={() => handleNavigate('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'dashboard' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-lg">📊</span>
            <span className="font-medium">儀表板</span>
          </button>

          <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-8 mb-1">
            新增入庫
          </p>
          <div className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleNavigateToForm(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                  currentView === 'form' && selectedCategory === cat.id
                    ? 'bg-zinc-800 text-white border border-zinc-700' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <span className="text-sm font-medium">{cat.label}</span>
              </button>
            ))}
          </div>

          <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-8 mb-1">
            系統
          </p>
          <button
            onClick={() => handleNavigate('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              currentView === 'settings' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-lg">⚙️</span>
            <span className="font-medium">系統設定</span>
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800 mt-auto">
          <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">System Info</p>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              v2.5.0 Stable
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
