
import React, { useState, useEffect, useCallback } from 'react';
import { PartRecord, DashboardStats, PartCategory } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InventoryForm from './components/InventoryForm';
import InventoryList from './components/InventoryList';
import { GoogleSheetsService } from './services/googleSheetsService';
import { analyzeInventory } from './services/geminiService';
import { CATEGORIES } from './constants';

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'form' | 'list' | 'settings'>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<PartCategory>(PartCategory.CabinetBody);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(localStorage.getItem('sheet_id') || '');
  const [records, setRecords] = useState<PartRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');

  const loadData = useCallback(async () => {
    if (!spreadsheetId) return;

    setLoading(true);
    try {
      const sheetsService = new GoogleSheetsService(spreadsheetId);
      const data = await sheetsService.fetchRecords();
      setRecords(data);
      
      if (data.length > 0) {
        try {
          const insights = await analyzeInventory(data);
          setAiInsights(insights || '');
        } catch (aiErr) {
          console.error("AI Analysis skipped due to error:", aiErr);
          setAiInsights("AI 分析功能暫時不可用。");
        }
      }
    } catch (error: any) {
      console.error('Data loading error:', error);
      alert('試算表資料同步失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId]);

  useEffect(() => {
    loadData();
    
    // 初始化側邊欄狀態 (電腦版預設開啟)
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, [loadData]);

  const handleAddRecords = async (newRecords: PartRecord | PartRecord[]) => {
    const recordsArray = Array.isArray(newRecords) ? newRecords : [newRecords];
    const oldRecords = [...records];
    setRecords(prev => [...prev, ...recordsArray]);

    if (spreadsheetId) {
      try {
        const sheetsService = new GoogleSheetsService(spreadsheetId);
        for (const record of recordsArray) {
          await sheetsService.addRecord(record);
        }
      } catch (err: any) {
        console.error('Failed to sync via proxy:', err);
        alert('存檔至試算表失敗：' + err.message);
        setRecords(oldRecords);
      }
    }
  };

  const navigateToForm = (category: PartCategory) => {
    setSelectedCategory(category);
    setCurrentView('form');
  };

  const stats: DashboardStats = {
    totalItems: records.length,
    totalQuantity: records.reduce((acc, r) => acc + (r.quantity || 0), 0),
    categoryDistribution: CATEGORIES.map(cat => ({
      name: cat,
      value: records.filter(r => r.category === cat).reduce((acc, r) => acc + (r.quantity || 0), 0)
    })),
    recentActivity: [...records].slice(-5).reverse(),
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentView={currentView} 
        selectedCategory={selectedCategory}
        onNavigate={setCurrentView} 
        onNavigateToForm={navigateToForm}
      />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 主要頂部導航欄 (手機版核心) */}
        <header className="bg-zinc-900/50 border-b border-zinc-800 p-4 lg:p-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-colors lg:hidden"
            >
              <div className="w-6 h-0.5 bg-zinc-400 mb-1.5"></div>
              <div className="w-6 h-0.5 bg-zinc-400 mb-1.5"></div>
              <div className="w-4 h-0.5 bg-zinc-400"></div>
            </button>
            <div>
              <h2 className="text-xl lg:text-3xl font-black text-white truncate">
                {currentView === 'dashboard' ? '營運數據概覽' : 
                 currentView === 'form' ? `${selectedCategory}` : 
                 currentView === 'list' ? '庫存清單' : '系統設定'}
              </h2>
              <p className="hidden md:block text-zinc-500 text-xs font-medium">零件管理雲端系統</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 lg:px-5 lg:py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-all text-xs lg:text-sm text-zinc-300 flex items-center gap-2"
            >
              {loading ? '...' : '🔄 同步'}
            </button>
          </div>
        </header>

        {/* 內容捲動區 */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-12">
          {!spreadsheetId && currentView !== 'settings' && (
            <div className="bg-amber-900/20 border border-amber-800/50 p-6 rounded-2xl mb-8 flex items-center gap-4 shadow-sm animate-pulse">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-amber-200">尚未配置雲端試算表</p>
                <p className="text-amber-300/80 text-sm">請至「系統設定」完成配置。</p>
              </div>
              <button onClick={() => setCurrentView('settings')} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-500 transition-colors">設定</button>
            </div>
          )}

          {currentView === 'dashboard' && <Dashboard stats={stats} aiInsights={aiInsights} />}
          {currentView === 'form' && (
            <InventoryForm 
              key={selectedCategory} 
              onSubmit={handleAddRecords} 
              preselectedCategory={selectedCategory}
              allRecords={records}
            />
          )}
          {currentView === 'list' && <InventoryList records={records} />}
          {currentView === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-800">
                <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                  <span className="text-green-500">☁️</span> 同步設定
                </h3>
                
                <div className="space-y-6">
                  <div className="bg-blue-900/10 border border-blue-800/30 p-5 rounded-xl text-[10px] lg:text-xs text-blue-200 space-y-3">
                    <p className="font-bold text-xs lg:text-sm mb-1 text-blue-300">💡 ID 在哪裡？</p>
                    <div className="bg-black/40 p-3 rounded-lg font-mono break-all border border-blue-900/30">
                      spreadsheets/d/<span className="bg-amber-500/30 text-amber-400 px-1 rounded">您的試算表ID</span>/edit
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Spreadsheet ID</label>
                    <input
                      type="text"
                      className="w-full px-4 py-4 rounded-xl border border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm bg-zinc-800 text-white placeholder-zinc-600"
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      placeholder="貼上 ID..."
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  localStorage.setItem('sheet_id', spreadsheetId);
                  alert('設定已儲存！');
                  loadData();
                }}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg active:scale-[0.98]"
              >
                儲存並啟用自動同步
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
