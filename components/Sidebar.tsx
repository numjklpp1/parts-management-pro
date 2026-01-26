
import React from 'react';
import { PartCategory } from '../types';

interface SidebarProps {
  currentView: 'dashboard' | 'form' | 'list' | 'settings';
  selectedCategory?: PartCategory;
  onNavigate: (view: 'dashboard' | 'form' | 'list' | 'settings') => void;
  onNavigateToForm: (category: PartCategory) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, selectedCategory, onNavigate, onNavigateToForm }) => {
  const categories = [
    { id: PartCategory.GlassSlidingDoor, label: '玻璃拉門', icon: '🪟' },
    { id: PartCategory.IronSlidingDoor, label: '鐵拉門', icon: '🏗️' },
    { id: PartCategory.Drawer, label: '抽屜', icon: '📥' },
    { id: PartCategory.CabinetBody, label: '桶身', icon: '📦' },
    { id: PartCategory.Paint, label: '噴漆', icon: '🎨' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full sticky top-0 border-r border-slate-800 overflow-y-auto">
      <div className="p-8">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span className="text-blue-400">Inventory</span> Pro
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-4 mb-1">
          主要功能
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            currentView === 'dashboard' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="text-lg">📊</span>
          <span className="font-medium">儀表板</span>
        </button>

        <button
          onClick={() => onNavigate('list')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            currentView === 'list' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="text-lg">📋</span>
          <span className="font-medium">庫存清單</span>
        </button>

        <p className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-8 mb-1">
          新增入庫
        </p>
        <div className="space-y-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onNavigateToForm(cat.id)}
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
          onClick={() => onNavigate('settings')}
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
        <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Status</p>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            系統運行中
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
