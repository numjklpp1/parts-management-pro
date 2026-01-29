
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
  
  // 從 LocalStorage 初始化狀態，若無則預設進入玻璃拉門表單
  const [currentView, setCurrentView] = useState<'dashboard' | 'form' | 'list' | 'settings'>(
    (localStorage.getItem('last_view') as any) || 'form'
  );
  const [selectedCategory, setSelectedCategory] = useState<PartCategory>(
    (localStorage.getItem('last_category') as PartCategory) || PartCategory.GlassSlidingDoor
  );
  
  const [spreadsheetId, setSpreadsheetId] = useState<string>(localStorage.getItem('sheet_id') || '');
  const [records, setRecords] = useState<PartRecord[]>([]);
  const [cloudTasks, setCloudTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');

  // 當視圖或類別改變時，存入 LocalStorage
  useEffect(() => {
    localStorage.setItem('last_view', currentView);
    localStorage.setItem('last_category', selectedCategory);
  }, [currentView, selectedCategory]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sheetsService = new GoogleSheetsService(spreadsheetId);
      
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
      } else {
        setAiInsights("目前尚無資料可供 AI 分析。");
      }
    } catch (error: any) {
      console.error('Data loading error:', error);
      if (!spreadsheetId) {
         localStorage.removeItem('local_inventory_records');
         localStorage.removeItem('local_inventory_tasks');
      }
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

    try {
      const sheetsService = new GoogleSheetsService(spreadsheetId);
      for (const record of recordsArray) {
        await sheetsService.addRecord(record);
      }
    } catch (err: any) {
      console.error('Save failed:', err);
      alert('存檔失敗：' + err.message);
      setRecords(oldRecords);
    }
  };

  const handleUpdateCloudTasks = async (newTasks: string[]) => {
    setCloudTasks(newTasks);
    try {
      const sheetsService = new GoogleSheetsService(spreadsheetId);
      await sheetsService.updateTasks(newTasks);
    } catch (err) {
      console.error('Task sync failed:', err);
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

  const isLocalMode = !spreadsheetId;

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
            <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3">
              <h2 className="text-xl lg:text-3xl font-black text-white truncate">
                {currentView === 'dashboard' ? '營運數據概覽' : 
                 currentView === 'form' ? `${selectedCategory}` : 
                 currentView === 'list' ? '庫存清單' : '系統設定'}
              </h2>
              {isLocalMode && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20 w-fit">
                  本地測試模式
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={loadData} 
              disabled={loading} 
              className="px-3 py-1.5 lg:px-5 lg:py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl hover:bg-zinc-700 transition-all text-xs lg:text-sm text-zinc-300 flex items-center gap-2"
            >
              {loading ? '...' : '🔄 刷新'}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-12">
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
            <div className="max-w-2xl mx-auto space-y-12">
              <div className="bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-800">
                <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">☁️ Google Sheets 同步設定</h3>
                <p className="text-zinc-500 text-sm mb-6">填寫 ID 後，資料將會即時同步至您的 Google 試算表。</p>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400 uppercase">Spreadsheet ID</label>
                  <input
                    type="text"
                    placeholder="請貼上您的試算表 ID..."
                    className="w-full px-4 py-4 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-mono placeholder-zinc-600"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => { 
                    localStorage.setItem('sheet_id', spreadsheetId); 
                    alert(spreadsheetId ? '已切換至雲端模式！' : '已切換至本地測試模式！'); 
                    loadData(); 
                  }} 
                  className="w-full mt-6 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all"
                >
                  確認變更
                </button>
              </div>

              <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800">
                <h4 className="text-sm font-bold text-zinc-400 mb-4">資料管理</h4>
                <button 
                  onClick={() => {
                    if (window.confirm('確定要清空本地所有紀錄嗎？')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="text-red-400 text-sm hover:underline"
                >
                  🗑️ 清除所有快取 (包含登入設定與上次分頁)
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
