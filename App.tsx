
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
  const [cloudTasks, setCloudTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');

  const loadData = useCallback(async () => {
    if (!spreadsheetId) return;

    setLoading(true);
    try {
      const sheetsService = new GoogleSheetsService(spreadsheetId);
      
      // 平行載入紀錄與任務
      const [data, tasks] = await Promise.all([
        sheetsService.fetchRecords(),
        sheetsService.fetchTasks()
      ]);
      
      setRecords(data);
      setCloudTasks(tasks);
      
      if (data.length > 0) {
        try {
          const insights = await analyzeInventory(data);
          setAiInsights(insights || '');
        } catch (aiErr) {
          console.error("AI Analysis skipped:", aiErr);
          setAiInsights("AI 分析功能暫時不可用。");
        }
      }
    } catch (error: any) {
      console.error('Data loading error:', error);
      alert('雲端資料同步失敗：' + error.message);
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId]);

  useEffect(() => {
    loadData();
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

  const handleUpdateCloudTasks = async (newTasks: string[]) => {
    setCloudTasks(newTasks);
    if (spreadsheetId) {
      try {
        const sheetsService = new GoogleSheetsService(spreadsheetId);
        await sheetsService.updateTasks(newTasks);
      } catch (err) {
        console.error('Task sync failed:', err);
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
        <header className="bg-zinc-900/50 border-b border-zinc-800 p-4 lg:p-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors lg:hidden">
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} disabled={loading} className="px-3 py-1.5 lg:px-5 lg:py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-all text-xs lg:text-sm text-zinc-300 flex items-center gap-2">
              {loading ? '...' : '🔄 同步'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-12">
          {!spreadsheetId && currentView !== 'settings' && (
            <div className="bg-amber-900/20 border border-amber-800/50 p-6 rounded-2xl mb-8 flex items-center gap-4 shadow-sm animate-pulse">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-amber-200">尚未配置雲端試算表</p>
                <button onClick={() => setCurrentView('settings')} className="text-amber-400 underline text-sm">前往設定</button>
              </div>
            </div>
          )}

          {currentView === 'dashboard' && <Dashboard stats={stats} aiInsights={aiInsights} />}
          {currentView === 'form' && (
            <InventoryForm 
              key={selectedCategory} 
              onSubmit={handleAddRecords} 
              preselectedCategory={selectedCategory}
              allRecords={records}
              quickTasks={cloudTasks}
              onUpdateQuickTasks={handleUpdateCloudTasks}
            />
          )}
          {currentView === 'list' && <InventoryList records={records} />}
          {currentView === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-800">
                <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">☁️ 同步設定</h3>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400 uppercase">Spreadsheet ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-4 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-mono"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                  />
                </div>
              </div>
              <button onClick={() => { localStorage.setItem('sheet_id', spreadsheetId); alert('設定已儲存！'); loadData(); }} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all">儲存並同步</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
