import React, { useState, useMemo } from 'react';
import { PartCategory, PartRecord, Language } from '../../types';
import { GLASS_DOOR_GROUPS, GLASS_DOOR_MODELS } from '../../constants';
import { translations } from '../../utils/translations';

interface GlassSlidingDoorFormProps {
  onSubmit: (records: PartRecord | PartRecord[]) => Promise<void>;
  allRecords: PartRecord[];
  quickTasks: string[];
  onUpdateQuickTasks: (tasks: string[]) => Promise<void>;
  language: Language;
}

const DISPATCHER_MODELS = [
  '樹德4尺', '樹德3尺', 'UG3A', 'UG2A', 'AK3U', 'AK2U', 'AK3B', 'AK2B', '4尺88', '3尺88', '4尺106', '4尺74'
];

const GlassSlidingDoorForm: React.FC<GlassSlidingDoorFormProps> = ({ 
  onSubmit, 
  allRecords,
  quickTasks = [],
  onUpdateQuickTasks,
  language
}) => {
  const t = (key: string) => translations[language][key] || key;
  const [loading, setLoading] = useState(false);
  const [showStockOverlay, setShowStockOverlay] = useState(false);
  const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);
  
  const [formData, setFormData] = useState({
    category: PartCategory.GlassSlidingDoor,
    name: GLASS_DOOR_MODELS[0] as string,
    specification: GLASS_DOOR_GROUPS[0] as string,
    quantity: '0' as string | number,
    note: '' as string
  });

  const [newTaskBaseModel, setNewTaskBaseModel] = useState(DISPATCHER_MODELS[0]);
  const [newTaskQty, setNewTaskQty] = useState('1');

  // 對應生產階段的翻譯 Key
  const specKeyMap: Record<string, string> = {
    '完成': 'complete',
    '框_噴完': 'frame_sprayed',
    '框_製作完成': 'frame_produced',
    '框_待辦': 'frame_pending',
    '玻璃條': 'glass_strip',
    '玻璃': 'glass'
  };

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

  const handleAddTaskPair = async () => {
    const qty = parseInt(newTaskQty);
    if (isNaN(qty) || qty <= 0) return alert('Invalid Quantity');
    const taskL = `${newTaskBaseModel}-L*${qty}`;
    const taskR = `${newTaskBaseModel}-R*${qty}`;
    const updatedTasks = [...quickTasks, taskL, taskR];
    await onUpdateQuickTasks(updatedTasks);
    setNewTaskQty('1');
  };

  const handleDeleteTask = async (index: number) => {
    const updatedTasks = [...quickTasks];
    updatedTasks.splice(index, 1);
    await onUpdateQuickTasks(updatedTasks);
  };

  const handleCompleteQuickTask = async (task: string, index: number) => {
    const [modelName, totalRemainingStr] = task.split('*');
    const totalRemaining = parseInt(totalRemainingStr);
    setLoading(true);
    try {
      const timestamp = new Date().toLocaleString('zh-TW');
      const recordsToSubmit: PartRecord[] = [];
      recordsToSubmit.push({ 
        id: generateReadableId(formData.category), 
        timestamp, 
        category: formData.category, 
        name: modelName, 
        specification: '完成', 
        quantity: totalRemaining, 
        note: `[Task Done]` 
      });
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
          note: 'Auto Deduct'
        });
      }
      await onSubmit(recordsToSubmit);
      const updatedTasks = [...quickTasks];
      updatedTasks.splice(index, 1);
      await onUpdateQuickTasks(updatedTasks);
    } catch (err) { 
      alert('Sync Failed'); 
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
        note: isAdjustmentMode ? `[MANUAL] ${formData.note}` : formData.note 
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
            note: 'Auto Deduct'
          });
        }
      }
      await onSubmit(recordsToSubmit);
      setFormData({ ...formData, quantity: '0', note: '' });
      alert('Saved');
    } catch (err) { alert('Error'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className={`bg-zinc-900 rounded-3xl border transition-all shadow-2xl ${isAdjustmentMode ? 'border-amber-500' : 'border-zinc-800'}`}>
        <div className="bg-black px-8 py-6 border-b border-zinc-800 flex justify-between items-center rounded-t-3xl">
          <div>
            <h2 className="text-2xl font-black text-white">{t('glass_door')} - {isAdjustmentMode ? t('manual_adj') : t('production_report')}</h2>
            <p className="text-zinc-500 text-xs mt-1 font-bold uppercase tracking-widest text-blue-400">Inventory Pro</p>
          </div>
          <span className="text-3xl">🪟</span>
        </div>
        
        <form onSubmit={handleManualSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('step_1')}</label>
              <div className="grid grid-cols-2 gap-2">
                {GLASS_DOOR_GROUPS.map(g => (
                  <button 
                    key={g} 
                    type="button" 
                    onClick={() => setFormData({...formData, specification: g})} 
                    className={`py-3 rounded-xl border font-bold text-sm transition-all ${formData.specification === g ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40 scale-[1.02]' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                  >
                    {t(specKeyMap[g] || g)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('step_2')}</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white h-[58px] font-bold outline-none" 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              >
                {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowStockOverlay(true)} className="flex-1 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-blue-400 font-bold hover:bg-zinc-700 transition-colors">📊 {t('view_stock')}</button>
                <button type="button" onClick={() => setIsAdjustmentMode(!isAdjustmentMode)} className={`flex-1 py-3 rounded-xl border font-bold transition-colors ${isAdjustmentMode ? 'bg-amber-600 border-amber-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>{t('manual_adj')}</button>
              </div>
            </div>

            <div className="md:col-span-2 pt-4 border-t border-zinc-800/50 space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('step_3')}</label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="numeric" 
                  className="w-full px-6 py-5 rounded-2xl border border-zinc-700 bg-zinc-800 text-white font-mono text-3xl text-center focus:ring-4 focus:ring-blue-500/20 outline-none" 
                  value={formData.quantity} 
                  onChange={e => setFormData({...formData, quantity: e.target.value})} 
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">{t('pcs')}</div>
              </div>
              <button 
                type="submit" 
                disabled={loading} 
                className={`w-full py-5 rounded-2xl font-black text-xl text-white shadow-2xl mt-4 transition-all ${isAdjustmentMode ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                {loading ? t('syncing') : isAdjustmentMode ? t('confirm_adj') : t('confirm_submit')}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
        <div className="bg-zinc-800/30 px-8 py-5 border-b border-zinc-800 flex items-center gap-3">
          <span className="text-xl">📋</span>
          <h3 className="text-lg font-black text-white tracking-widest uppercase">{t('task_manager')}</h3>
        </div>

        <div className="flex flex-col md:flex-row min-h-[480px]">
          <div className="md:w-1/3 p-8 bg-black/50 border-r border-zinc-800 flex flex-col space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('select_model')}</label>
              <select className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-bold" value={newTaskBaseModel} onChange={e => setNewTaskBaseModel(e.target.value)}>
                {DISPATCHER_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('task_qty')}</label>
              <input type="number" className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-mono text-xl text-center" value={newTaskQty} onChange={e => setNewTaskQty(e.target.value)} />
            </div>
            <button onClick={handleAddTaskPair} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm shadow-xl mt-auto">
              {t('add_task')}
            </button>
            <p className="text-[10px] text-zinc-600 italic text-center px-4">{t('task_hint')}</p>
          </div>

          <div className="flex-1 p-8 bg-zinc-900/40">
            {quickTasks.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 content-start">
                {quickTasks.map((t_str, i) => {
                  const [model, qty] = t_str.split('*');
                  return (
                    <div key={i} className="bg-zinc-800 border border-zinc-700/50 p-6 rounded-2xl flex flex-col justify-between shadow-lg hover:border-blue-500/30 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">TASK #{i+1}</p>
                          <h4 className="text-white font-black text-lg font-mono">{model}</h4>
                        </div>
                        <span className="bg-blue-600/10 text-blue-400 px-3 py-1 rounded-lg font-mono font-black text-sm">{qty} {t('pcs')}</span>
                      </div>
                      <div className="flex gap-2 mt-6">
                        <button onClick={() => handleCompleteQuickTask(t_str, i)} className="flex-1 py-3 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white border border-green-600/20 rounded-xl transition-all shadow-lg">
                          <span className="text-xl font-bold">✓</span>
                        </button>
                        <button onClick={() => handleDeleteTask(i)} className="flex-[0.4] py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 rounded-xl transition-all">
                          <span className="text-lg">🗑️</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-3xl p-12 opacity-40">
                <span className="text-4xl mb-4">📭</span>
                <p className="font-black text-zinc-500 uppercase tracking-widest text-sm">{t('empty_board')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showStockOverlay && (
        <div className="fixed inset-0 bg-black/95 z-50 p-4 md:p-10 flex flex-col backdrop-blur-md overflow-hidden">
          <div className="flex justify-between items-center mb-8 max-w-7xl mx-auto w-full shrink-0">
            <h4 className="text-2xl md:text-4xl font-black text-white flex items-center gap-3">
              <span>📊</span> {t('stock_status')}
            </h4>
            <button onClick={() => setShowStockOverlay(false)} className="bg-zinc-800 text-white w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center text-xl hover:bg-red-600 transition-all">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full pb-20 space-y-16 scroll-smooth pr-2">
            {DISPLAY_ORDER.map(spec => (
              <div key={spec} className="relative">
                <div className="sticky top-0 z-20 py-4 mb-6 bg-black/80 backdrop-blur-md border-b border-blue-600/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                    <h5 className="text-blue-400 font-black text-xl uppercase tracking-[0.2em]">{t(specKeyMap[spec] || spec)}</h5>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    {t('total_variations')}: {Object.keys(fullStockSummary[spec] || {}).length}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {Object.entries(fullStockSummary[spec] || {}).map(([m, q]) => (
                    <div key={m} className={`group p-5 rounded-2xl border transition-all flex flex-col items-center justify-center min-h-[110px] relative overflow-hidden ${Number(q) > 0 ? 'bg-zinc-800 border-zinc-700 shadow-lg hover:border-blue-500/50 hover:bg-zinc-700' : 'bg-zinc-900 border-zinc-800 opacity-40 grayscale pointer-events-none'}`}>
                      <span className="text-zinc-500 text-xl font-bold uppercase truncate w-full text-center mb-2 z-10">{m}</span>
                      <span className={`text-3xl font-black z-10 ${Number(q) > 0 ? 'text-white' : 'text-zinc-700'}`}>
                        {q as React.ReactNode} <span className="text-[10px] ml-1 font-normal opacity-50">{t('pcs')}</span>
                      </span>
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