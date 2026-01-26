
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
  const [currentView, setCurrentView] = useState<'dashboard' | 'form' | 'list' | 'settings'>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<PartCategory>(PartCategory.CabinetBody);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(localStorage.getItem('sheet_id') || '');
  const [accessToken, setAccessToken] = useState<string>(localStorage.getItem('access_token') || '');
  const [records, setRecords] = useState<PartRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');

  const loadData = useCallback(async () => {
    if (!spreadsheetId || !accessToken) return;

    setLoading(true);
    try {
      const sheetsService = new GoogleSheetsService(accessToken, spreadsheetId);
      const data = await sheetsService.fetchRecords();
      setRecords(data);
      
      if (data.length > 0) {
        const insights = await analyzeInventory(data);
        setAiInsights(insights || '');
      }
    } catch (error: any) {
      console.error('Data loading error:', error);
      if (error.message.includes('401')) {
        alert('Access Token 已過期或無效，請在設定中更新。');
      }
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 修改：支援傳入單一紀錄或紀錄陣列
  const handleAddRecords = async (newRecords: PartRecord | PartRecord[]) => {
    const recordsArray = Array.isArray(newRecords) ? newRecords : [newRecords];
    
    // 先更新 UI 狀態
    setRecords(prev => [...prev, ...recordsArray]);

    if (spreadsheetId && accessToken) {
      try {
        const sheetsService = new GoogleSheetsService(accessToken, spreadsheetId);
        // 循序寫入所有紀錄到 Google Sheets
        for (const record of recordsArray) {
          await sheetsService.addRecord(record);
        }
      } catch (err) {
        console.error('Failed to sync to Google Sheets:', err);
        alert('同步至 Google Sheets 失敗，請檢查 Token 與 ID。');
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
        currentView={currentView} 
        selectedCategory={selectedCategory}
        onNavigate={setCurrentView} 
        onNavigateToForm={navigateToForm}
      />
      
      <main className="flex-1 p-8 lg:p-12 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-black text-white">
              {currentView === 'dashboard' ? '營運數據概覽' : 
               currentView === 'form' ? `${selectedCategory} - 入庫登記` : 
               currentView === 'list' ? '庫存清單' : '系統設定'}
            </h2>
            <p className="text-zinc-400 font-medium mt-1">零件管理雲端系統 (智慧庫存版)</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={loadData}
              disabled={loading}
              className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all text-zinc-300 shadow-sm flex items-center gap-2"
            >
              {loading ? '同步中...' : '🔄 重新整理'}
            </button>
          </div>
        </header>

        {(!spreadsheetId || !accessToken) && currentView !== 'settings' && (
          <div className="bg-blue-900/20 border border-blue-800/50 p-6 rounded-2xl mb-8 flex items-center gap-4 shadow-sm">
            <span className="text-2xl">ℹ️</span>
            <div className="flex-1">
              <p className="font-bold text-blue-200">同步功能尚未啟用</p>
              <p className="text-blue-300/80 text-sm">目前為本地預覽模式。若要同步至 Google Sheets，請至「系統設定」配置參數。</p>
            </div>
            <button onClick={() => setCurrentView('settings')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors">前往設定</button>
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
          <div className="max-w-2xl space-y-6">
            <div className="bg-zinc-900 p-8 rounded-3xl shadow-sm border border-zinc-800">
              <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                <span className="text-green-500">📊</span> Google Sheets 同步設定
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400">Spreadsheet ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm bg-zinc-800 text-white"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    placeholder="例如: 1A2B3C..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400">Google Access Token</label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm bg-zinc-800 text-white"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="請輸入您的 OAuth2 Token"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                localStorage.setItem('sheet_id', spreadsheetId);
                localStorage.setItem('access_token', accessToken);
                alert('設定已儲存！');
                loadData();
              }}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-900/20"
            >
              儲存並套用所有設定
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
