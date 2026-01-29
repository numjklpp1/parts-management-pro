import React, { useState, useMemo } from 'react';
import { PartCategory, PartRecord } from '../../types';
import { GLASS_DOOR_GROUPS, GLASS_DOOR_MODELS } from '../../constants';

interface GlassSlidingDoorFormProps {
  onSubmit: (records: PartRecord | PartRecord[]) => Promise<void>;
  allRecords: PartRecord[];
  quickTasks: string[];
  onUpdateQuickTasks: (tasks: string[]) => Promise<void>;
}

const DISPATCHER_MODELS = [
  '樹德4尺', '樹德3尺', 'UG3A', 'UG2A', 'AK3U', 'AK2U', 'AK3B', 'AK2B', '4尺88', '3尺88', '4尺106', '4尺74'
];

const GlassSlidingDoorForm: React.FC<GlassSlidingDoorFormProps> = ({ 
  onSubmit, 
  allRecords,
  quickTasks = [],
  onUpdateQuickTasks
}) => {
  const [loading, setLoading] = useState(false);
  const [showStockOverlay, setShowStockOverlay] = useState(false);
  const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);
  
  // 入庫表單狀態
  const [formData, setFormData] = useState({
    category: PartCategory.GlassSlidingDoor,
    name: GLASS_DOOR_MODELS[0] as string,
    specification: GLASS_DOOR_GROUPS[0] as string,
    quantity: '0' as string | number,
    note: '' as string
  });

  // 任務調度專用狀態
  const [newTaskBaseModel, setNewTaskBaseModel] = useState(DISPATCHER_MODELS[0]);
  const [newTaskQty, setNewTaskQty] = useState('1');

  const DISPLAY_ORDER = ['完成', '框_噴完', '框_製作完成', '框_待辦', '玻璃條', '玻璃'];
  const NO_SIDE_SPECS = ['玻璃條', '玻璃']; 

  const getMergedBaseName = (name: string) => {
    const base = name.replace(/-[LR]$/, '');
    if (base === 'UG3A' || base === 'AK3B') return 'UG3A/AK3B';
    if (base === 'UG2A' || base === 'AK2B') return 'UG2A/AK2B';
    return base;
  };

  const generateReadableId = (category: string) => {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${category.substring(0, 1)}-${date}-${random}`;
  };

  const availableModels = useMemo(() => {
    if (NO_SIDE_SPECS.includes(formData.specification)) {
      return Array.from(new Set(GLASS_DOOR_MODELS.map(m => getMergedBaseName(m))));
    }
    return GLASS_DOOR_MODELS as unknown as string[];
  }, [formData.specification]);

  const getCurrentStock = (spec: string, modelName: string) => {
    const isBasePart = NO_SIDE_SPECS.includes(spec);
    return allRecords
      .filter(r => {
        const rName = isBasePart ? getMergedBaseName(r.name) : r.name;
        const searchName = isBasePart ? getMergedBaseName(modelName) : modelName;
        return r.category === PartCategory.GlassSlidingDoor && r.specification === spec && rName === searchName;
      })
      .reduce((acc, r) => acc + (r.quantity || 0), 0);
  };

  const fullStockSummary = useMemo(() => {
    const summary: Record<string, Record<string, number>> = {};
    DISPLAY_ORDER.forEach(spec => {
      summary[spec] = {};
      const models = NO_SIDE_SPECS.includes(spec) 
        ? Array.from(new Set(GLASS_DOOR_MODELS.map(m => getMergedBaseName(m))))
        : [...GLASS_DOOR_MODELS] as string[];
      models.forEach(m => { summary[spec][m] = getCurrentStock(spec, m); });
    });
    return summary;
  }, [allRecords]);

  // 新增任務 (自動生成 L 和 R)
  const handleAddTaskPair = async () => {
    const qty = parseInt(newTaskQty);
    if (isNaN(qty) || qty <= 0) return alert('請輸入有效數量');
    
    // 同時生成 L 與 R 兩個任務
    const taskL = `${newTaskBaseModel}-L*${qty}`;
    const taskR = `${newTaskBaseModel}-R*${qty}`;
    
    const updatedTasks = [...quickTasks, taskL, taskR];
    await onUpdateQuickTasks(updatedTasks);
    setNewTaskQty('1');
  };

  // 刪除任務
  const handleDeleteTask = async (index: number) => {
    const updatedTasks = [...quickTasks];
    updatedTasks.splice(index, 1);
    await onUpdateQuickTasks(updatedTasks);
  };

  // 快速完工回報
  const handleCompleteQuickTask = async (task: string, index: number) => {
    // 【關鍵檢核邏輯】：只有在「完成」階段才能點擊完工
    if (formData.specification !== '完成') {
      alert(`⚠️ 操作錯誤：目前生產階段為「${formData.specification}」，無法進行完工報帳。請將階段切換至「完成」後再試。`);
      return;
    }

    const [modelName, totalRemainingStr] = task.split('*');
    const totalRemaining = parseInt(totalRemainingStr);
    
    setLoading(true);
    try {
      const timestamp = new Date().toLocaleString('zh-TW');
      const recordsToSubmit: PartRecord[] = [];

      // 1. 產出完成紀錄
      recordsToSubmit.push({ 
        id: generateReadableId(formData.category), 
        timestamp, 
        category: formData.category, 
        name: modelName, 
        specification: '完成', 
        quantity: totalRemaining, 
        note: `[調度看板完工]` 
      });

      // 2. 自動扣除「框_噴完」庫存
      const stockA = getCurrentStock('框_噴完', modelName);
      const deductQty = Math.min(stockA, totalRemaining);
      if (deductQty > 0) {
        recordsToSubmit.push({
          id: generateReadableId(formData.category),
          timestamp,
          category: formData.category,
          name: modelName,
          specification: '框_噴完',
          quantity: -deductQty,
          note: '完工自動扣料'
        });
      }

      await onSubmit(recordsToSubmit);
      
      // 3. 從看板移除任務
      const updatedTasks = [...quickTasks];
      updatedTasks.splice(index, 1);
      await onUpdateQuickTasks(updatedTasks);
      alert(`${modelName} 已完成報帳並移除任務`);
    } catch (err) { 
      alert('同步失敗'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(formData.quantity);
    if (isNaN(numQty) || numQty === 0) return;
    setLoading(true);
    try {
      const timestamp = new Date().toLocaleString('zh-TW');
      const recordsToSubmit: PartRecord[] = [];

      recordsToSubmit.push({ 
        ...formData, 
        quantity: numQty, 
        id: generateReadableId(formData.category), 
        timestamp, 
        note: isAdjustmentMode ? `[手動] ${formData.note}` : formData.note 
      });

      if (!isAdjustmentMode && formData.specification === '完成') {
        const stockA = getCurrentStock('框_噴完', formData.name);
        const deductQty = Math.min(stockA, numQty);
        if (deductQty > 0) {
          recordsToSubmit.push({
            id: generateReadableId(formData.category),
            timestamp,
            category: formData.category,
            name: formData.name,
            specification: '框_噴完',
            quantity: -deductQty,
            note: '自動扣料'
          });
        }
      }

      await onSubmit(recordsToSubmit);
      setFormData({ ...formData, quantity: '0', note: '' });
      alert('已存檔');
    } catch (err) { alert('錯誤'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* 1. 生產報帳主表單 */}
      <div className={`bg-zinc-900 rounded-3xl border transition-all shadow-2xl ${isAdjustmentMode ? 'border-amber-500' : 'border-zinc-800'}`}>
        <div className="bg-black px-8 py-6 border-b border-zinc-800 flex justify-between items-center rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-black text-white">玻璃拉門 - {isAdjustmentMode ? '🛠️ 手動調整' : '生產回報'}</h2>
            <p className="text-zinc-500 text-xs mt-1 font-bold uppercase tracking-widest text-blue-400">Inventory Management</p>
          </div>
          <span className="text-3xl">🪟</span>
        </div>
        
        <form onSubmit={handleManualSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">第一步：選擇生產階段</label>
              <div className="grid grid-cols-2 gap-2">
                {GLASS_DOOR_GROUPS.map(g => (
                  <button 
                    key={g} 
                    type="button" 
                    onClick={() => setFormData({...formData, specification: g})} 
                    className={`py-3 rounded-xl border font-bold text-sm transition-all ${formData.specification === g ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40 scale-[1.02]' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">第二步：選擇型號與動作</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white h-[58px] font-bold outline-none focus:ring-2 focus:ring-blue-500/50" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              >
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowStockOverlay(true)} className="flex-1 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-blue-400 font-bold hover:bg-zinc-700 transition-colors">📊 查看庫存</button>
                <button type="button" onClick={() => setIsAdjustmentMode(!isAdjustmentMode)} className={`flex-1 py-3 rounded-xl border font-bold transition-colors ${isAdjustmentMode ? 'bg-amber-600 border-amber-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>手動調整模式</button>
              </div>
            </div>

            <div className="md:col-span-2 pt-4 border-t border-zinc-800/50 space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">第三步：輸入數量</label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="numeric" 
                  className="w-full px-6 py-5 rounded-2xl border border-zinc-700 bg-zinc-800 text-white font-mono text-3xl text-center focus:ring-4 focus:ring-blue-500/20 outline-none transition-all" 
                  value={formData.quantity} 
                  onChange={e => setFormData({...formData, quantity: e.target.value})} 
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">PCS</div>
              </div>
              <button 
                type="submit" 
                disabled={loading} 
                className={`w-full py-5 rounded-2xl font-black text-xl text-white shadow-2xl mt-4 transition-all active:scale-[0.98] ${isAdjustmentMode ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                {loading ? '同步中...' : isAdjustmentMode ? '確認修正庫存' : '確認完工提交'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 2. 生產任務調度中心 (強制的左右橫向結構) */}
      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
        {/* 標題列 */}
        <div className="bg-zinc-800/30 px-8 py-5 border-b border-zinc-800 flex items-center gap-3">
          <span className="text-xl">📋</span>
          <h3 className="text-lg font-black text-white tracking-widest">玻璃拉門生產調度任務</h3>
        </div>

        <div className="flex flex-col md:flex-row min-h-[450px]">
          {/* 左側：控制盤 (1/3) */}
          <div className="md:w-1/3 p-8 bg-black/50 border-r border-zinc-800 flex flex-col space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">選擇下單型號</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-bold outline-none focus:ring-2 focus:ring-blue-500/50"
                value={newTaskBaseModel}
                onChange={e => setNewTaskBaseModel(e.target.value)}
              >
                {DISPATCHER_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">任務計畫數量</label>
              <input 
                type="number"
                min="1"
                className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-mono text-xl text-center focus:ring-2 focus:ring-blue-500/50 outline-none"
                value={newTaskQty}
                onChange={e => setNewTaskQty(e.target.value)}
              />
            </div>

            <button 
              onClick={handleAddTaskPair}
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm shadow-xl transition-all active:scale-[0.97] mt-auto"
            >
              加入任務 (自動生成 L/R)
            </button>
            
            <p className="text-[10px] text-zinc-600 italic leading-relaxed text-center px-4">
              系統將會自動建立左右一對的排程任務。
            </p>
          </div>

          {/* 右側：任務看板 (2/3) */}
          <div className="flex-1 p-8 bg-zinc-900/40">
            {quickTasks.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 content-start">
                {quickTasks.map((t, i) => {
                  const [model, qty] = t.split('*');
                  return (
                    <div key={i} className="bg-zinc-800 border border-zinc-700/50 p-6 rounded-2xl flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all group">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">TASK {i+1}</p>
                          <h4 className="text-white font-black text-lg font-mono">{model}</h4>
                        </div>
                        <span className="bg-blue-600/10 text-blue-400 px-3 py-1 rounded-lg font-mono font-black text-sm">{qty} PCS</span>
                      </div>
                      
                      <div className="flex gap-2 mt-6">
                        {/* 綠色完工按鈕 */}
                        <button 
                          onClick={() => handleCompleteQuickTask(t, i)}
                          title="完工報帳"
                          className="flex-1 py-2.5 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white border border-green-600/20 rounded-xl transition-all flex items-center justify-center"
                        >
                          <span className="font-bold">✓</span>
                        </button>
                        {/* 紅色刪除按鈕 */}
                        <button 
                          onClick={() => handleDeleteTask(i)}
                          title="刪除任務"
                          className="flex-[0.5] py-2.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded-xl transition-all flex items-center justify-center"
                        >
                          <span className="text-sm">🗑️</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl p-12 opacity-40">
                <span className="text-4xl mb-4">📭</span>
                <p className="font-black text-zinc-500 uppercase tracking-widest text-sm">看板目前沒有待辦任務</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 庫存彈窗 */}
      {showStockOverlay && (
        <div className="fixed inset-0 bg-black/95 z-50 p-6 flex flex-col backdrop-blur-md">
          <div className="flex justify-between items-center mb-8 max-w-6xl mx-auto w-full">
            <h4 className="text-3xl font-black text-white">📊 玻璃門階段庫存現況</h4>
            <button onClick={() => setShowStockOverlay(false)} className="bg-zinc-800 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl hover:bg-red-600 transition-colors">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto max-w-6xl mx-auto w-full pb-20 space-y-12">
            {DISPLAY_ORDER.map(spec => (
              <div key={spec} className="space-y-4">
                <p className="text-blue-400 font-black text-xs uppercase tracking-widest border-l-4 border-blue-600 pl-3 py-1 bg-blue-600/5">{spec}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(fullStockSummary[spec] || {}).map(([m, q]) => (
                    <div key={m} className={`p-4 rounded-2xl border transition-all flex flex-col items-center ${Number(q) > 0 ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900 border-zinc-800 opacity-40'}`}>
                      <span className="text-zinc-500 text-[10px] font-bold uppercase truncate w-full text-center mb-1">{m}</span>
                      <span className={`text-2xl font-black ${Number(q) > 0 ? 'text-white' : 'text-zinc-700'}`}>{q as React.ReactNode}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlassSlidingDoorForm;