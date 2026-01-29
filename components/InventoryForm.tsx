import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PartCategory, PartRecord } from '../types';
import { CATEGORIES, GLASS_DOOR_GROUPS, GLASS_DOOR_MODELS } from '../constants';

interface InventoryFormProps {
  onSubmit: (records: PartRecord | PartRecord[]) => Promise<void>;
  preselectedCategory: PartCategory;
  allRecords: PartRecord[];
  quickTasks: string[];
  onUpdateQuickTasks: (tasks: string[]) => Promise<void>;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ 
  onSubmit, 
  preselectedCategory, 
  allRecords,
  quickTasks = [],
  onUpdateQuickTasks
}) => {
  const [loading, setLoading] = useState(false);
  const [showStockOverlay, setShowStockOverlay] = useState(false);
  const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);
  
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [batchValues, setBatchValues] = useState<Record<string, Record<string, string>>>({});

  const isGlassDoor = preselectedCategory === PartCategory.GlassSlidingDoor;

  const [formData, setFormData] = useState({
    category: preselectedCategory,
    name: '' as string,
    specification: '' as string,
    quantity: '0' as string | number,
    note: '' as string
  });

  const DISPLAY_ORDER = ['完成', '框_噴完', '框_製作完成', '框_待辦', '玻璃條', '玻璃'];
  const BASE_MODEL_SPECS = ['玻璃', '玻璃條']; 

  const getMergedBaseName = (name: string) => {
    const base = name.replace(/-[LR]$/, '');
    if (base === 'UG3A' || base === 'AK3B') return 'UG3A/AK3B';
    if (base === 'UG2A' || base === 'AK2B') return 'UG2A/AK2B';
    return base;
  };

  const generateReadableId = (category: string) => {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const catCode = category.substring(0, 1);
    return `${catCode}-${date}-${random}`;
  };

  const availableModels = useMemo(() => {
    if (!isGlassDoor) return [];
    if (BASE_MODEL_SPECS.includes(formData.specification)) {
      const baseModels = GLASS_DOOR_MODELS.map(m => getMergedBaseName(m));
      return Array.from(new Set(baseModels));
    }
    return GLASS_DOOR_MODELS as unknown as string[];
  }, [isGlassDoor, formData.specification]);

  const getCurrentStock = (spec: string, modelName: string) => {
    const isBasePart = BASE_MODEL_SPECS.includes(spec);
    return allRecords
      .filter(r => {
        const isCorrectCat = r.category === PartCategory.GlassSlidingDoor;
        const isCorrectSpec = r.specification === spec;
        const rName = isBasePart ? getMergedBaseName(r.name) : r.name;
        const searchName = isBasePart ? getMergedBaseName(modelName) : modelName;
        return isCorrectCat && isCorrectSpec && rName === searchName;
      })
      .reduce((acc, r) => acc + r.quantity, 0);
  };

  const fullStockSummary = useMemo<Record<string, Record<string, number>>>(() => {
    if (!isGlassDoor) return {};
    const summary: Record<string, Record<string, number>> = {};
    DISPLAY_ORDER.forEach(spec => {
      summary[spec] = {};
      const isBasePart = BASE_MODEL_SPECS.includes(spec);
      const modelsForThisSpec = isBasePart 
        ? Array.from(new Set(GLASS_DOOR_MODELS.map(m => getMergedBaseName(m))))
        : [...GLASS_DOOR_MODELS] as string[];

      modelsForThisSpec.forEach(m => {
        summary[spec][m] = getCurrentStock(spec, m);
      });
    });
    return summary;
  }, [isGlassDoor, allRecords]);

  useEffect(() => {
    const defaultSpec = isGlassDoor ? (GLASS_DOOR_GROUPS[0] as string) : '';
    let defaultName = '';
    if (isGlassDoor) {
      if (BASE_MODEL_SPECS.includes(defaultSpec)) {
        defaultName = getMergedBaseName(GLASS_DOOR_MODELS[0] as string);
      } else {
        defaultName = GLASS_DOOR_MODELS[0];
      }
    }
    setFormData(prev => ({
      ...prev,
      category: preselectedCategory,
      name: defaultName,
      specification: defaultSpec,
      quantity: '0',
      note: ''
    }));
  }, [preselectedCategory, isGlassDoor]);

  useEffect(() => {
    if (isGlassDoor && availableModels.length > 0) {
      const currentName = formData.name;
      if (availableModels.includes(currentName)) return;
      let bestMatch = '';
      if (BASE_MODEL_SPECS.includes(formData.specification)) {
        const mergedBase = getMergedBaseName(currentName);
        if (availableModels.includes(mergedBase)) bestMatch = mergedBase;
      } else {
        const prefixMatch = availableModels.find(m => m.startsWith(currentName.split('/')[0]));
        if (prefixMatch) bestMatch = prefixMatch;
      }
      if (bestMatch) setFormData(prev => ({ ...prev, name: bestMatch }));
      else setFormData(prev => ({ ...prev, name: availableModels[0] }));
    }
  }, [formData.specification, availableModels, isGlassDoor]);

  const addQuickTask = () => {
    if (!formData.note.trim()) return;
    const newTasks = [...quickTasks, formData.note.trim()];
    onUpdateQuickTasks(newTasks);
    setFormData(prev => ({ ...prev, note: '' }));
  };

  const removeQuickTask = (index: number) => {
    const newTasks = quickTasks.filter((_, i) => i !== index);
    onUpdateQuickTasks(newTasks);
  };

  const completeQuickTask = async (task: string, index: number) => {
    const parts = task.split('*');
    if (parts.length < 2) {
      alert('格式錯誤 (例如: AS3B*120)');
      return;
    }

    const namePart = parts[0].trim();
    const totalQty = parseInt(parts[1].trim());

    if (isNaN(totalQty)) {
      alert('數量格式錯誤');
      return;
    }

    // 支援部分完成的彈窗詢問
    const inputDoneStr = prompt(`【${namePart}】總量 ${totalQty}\n本次完成數量？`, totalQty.toString());
    if (inputDoneStr === null) return; // 使用者取消

    const doneQty = parseInt(inputDoneStr);
    if (isNaN(doneQty) || doneQty <= 0) {
      alert('請輸入正確的完成數量');
      return;
    }

    setLoading(true);
    try {
      const timestamp = new Date().toLocaleString('zh-TW');
      const recordsToSubmit: PartRecord[] = [];

      // 以「實際完成量」產生入庫紀錄
      const mainRecord: PartRecord = {
        category: formData.category,
        name: namePart,
        specification: formData.specification,
        quantity: doneQty,
        id: generateReadableId(formData.category),
        timestamp,
        note: `[快速雲端任務] 完工:${doneQty} (總量:${totalQty})`
      };
      recordsToSubmit.push(mainRecord);

      // 自動扣料邏輯（使用實際完工量 doneQty）
      if (isGlassDoor) {
        if (formData.specification === '完成') {
          const stockA = getCurrentStock('框_噴完', namePart);
          const d1 = Math.min(stockA, doneQty);
          const r1 = doneQty - d1;
          if (d1 > 0) recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: namePart, specification: '框_噴完', quantity: -d1, note: `自動扣料:框_噴完` });
          if (r1 > 0) recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: namePart, specification: '框_製作完成', quantity: -r1, note: `自動扣料:框_製作完成` });
        } else if (formData.specification === '框_噴完') {
          recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: namePart, specification: '框_製作完成', quantity: -doneQty, note: `自動扣料:框_製作完成` });
        } else if (formData.specification === '框_製作完成') {
          recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: namePart, specification: '框_待辦', quantity: -doneQty, note: `自動扣料:框_待辦` });
        }
      }

      await onSubmit(recordsToSubmit);

      // 更新雲端待辦清單
      const remaining = totalQty - doneQty;
      let newTasks = [...quickTasks];
      if (remaining > 0) {
        // 如果還有剩，更新該筆文字
        newTasks[index] = `${namePart}*${remaining}`;
        onUpdateQuickTasks(newTasks);
        alert(`已紀錄完成 ${doneQty}，剩餘 ${remaining} 已更新至清單。`);
      } else {
        // 如果全做完了或超過了，直接移除
        removeQuickTask(index);
        alert(`任務「${namePart}」已全數完成！`);
      }
    } catch (err) {
      alert('任務執行失敗：' + err);
    } finally {
      setLoading(false);
    }
  };

  const enterBatchEdit = () => {
    const initialValues: Record<string, Record<string, string>> = {};
    DISPLAY_ORDER.forEach(spec => {
      initialValues[spec] = {};
      Object.entries(fullStockSummary[spec] || {}).forEach(([model, qty]) => {
        initialValues[spec][model] = qty.toString();
      });
    });
    setBatchValues(initialValues);
    setIsBatchEditing(true);
  };

  const saveBatchAdjustments = async () => {
    const recordsToSubmit: PartRecord[] = [];
    const timestamp = new Date().toLocaleString('zh-TW');

    DISPLAY_ORDER.forEach(spec => {
      Object.entries(batchValues[spec] || {}).forEach(([model, newValueStr]) => {
        const newValue = Number(newValueStr);
        const oldValue = fullStockSummary[spec][model];
        const delta = newValue - oldValue;
        if (delta !== 0) {
          recordsToSubmit.push({
            id: generateReadableId(PartCategory.GlassSlidingDoor),
            timestamp,
            category: PartCategory.GlassSlidingDoor,
            name: model,
            specification: spec,
            quantity: delta,
            note: `[批次調整] 原:${oldValue} -> 新:${newValue}`
          });
        }
      });
    });

    if (recordsToSubmit.length === 0) { setIsBatchEditing(false); return; }

    setLoading(true);
    try {
      await onSubmit(recordsToSubmit);
      alert(`成功儲存 ${recordsToSubmit.length} 項！`);
      setIsBatchEditing(false);
      setShowStockOverlay(false);
    } catch (err) { alert('失敗：' + err); } 
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(formData.quantity);
    if (isNaN(numQty) || numQty === 0) { alert('輸入有效數量'); return; }

    setLoading(true);
    try {
      const recordsToSubmit: PartRecord[] = [];
      const timestamp = new Date().toLocaleString('zh-TW');
      const mainRecord: PartRecord = {
        ...formData,
        quantity: numQty,
        id: generateReadableId(formData.category),
        timestamp,
        note: isAdjustmentMode ? `[手動] ${formData.note}` : formData.note
      };
      recordsToSubmit.push(mainRecord);
      
      if (!isAdjustmentMode && isGlassDoor) {
        if (formData.specification === '完成') {
          const stockA = getCurrentStock('框_噴完', formData.name);
          const d1 = Math.min(stockA, numQty);
          const r1 = numQty - d1;
          if (d1 > 0) recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: formData.name, specification: '框_噴完', quantity: -d1, note: `自動扣料:框_噴完` });
          if (r1 > 0) recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: formData.name, specification: '框_製作完成', quantity: -r1, note: `自動扣料:框_製作完成` });
        } else if (formData.specification === '框_噴完') {
          recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: formData.name, specification: '框_製作完成', quantity: -numQty, note: `自動扣料:框_製作完成` });
        } else if (formData.specification === '框_製作完成') {
          recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: formData.name, specification: '框_待辦', quantity: -numQty, note: `自動扣料:框_待辦` });
        }
      }

      await onSubmit(recordsToSubmit);
      setFormData({ ...formData, quantity: '0', note: '' });
      setIsAdjustmentMode(false);
      alert('紀錄已儲存！');
    } catch (err) { alert('失敗：' + err); } 
    finally { setLoading(false); }
  };

  const displayQty = Number(formData.quantity);

  return (
    <div className="max-w-4xl mx-auto relative">
      <div className={`bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border transition-all duration-300 ${isAdjustmentMode ? 'border-amber-500/50 ring-2 ring-amber-500/20' : 'border-zinc-800'}`}>
        <div className={`bg-black px-8 py-6 text-white border-b flex justify-between items-center ${isAdjustmentMode ? 'border-amber-500/30' : 'border-zinc-800'}`}>
          <div>
            <h2 className="text-2xl font-bold">
              {formData.category} - {isAdjustmentMode ? '🛠️ 手動庫存調整' : (displayQty < 0 ? '手動庫存修正' : '入庫登記')}
            </h2>
          </div>
          <span className="text-4xl">
            {isAdjustmentMode ? '🛠️' : (formData.category === PartCategory.GlassSlidingDoor ? '🪟' : '🏗️')}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isGlassDoor ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400 uppercase">零件組別</label>
                  <div className="grid grid-cols-2 gap-2">
                    {GLASS_DOOR_GROUPS.map(group => (
                      <button key={group} type="button" onClick={() => setFormData({...formData, specification: group})} className={`py-3 rounded-xl border font-bold transition-all ${formData.specification === group ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}>
                        {group}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 flex flex-col">
                  <label className="text-sm font-bold text-zinc-400 uppercase">零件型號</label>
                  <select className="w-full px-4 py-3 rounded-xl border bg-zinc-800 text-white h-[58px]" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setShowStockOverlay(true)} className="py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-xl font-bold text-blue-400">📊 庫存</button>
                    <button type="button" onClick={() => setIsAdjustmentMode(!isAdjustmentMode)} className={`py-2.5 rounded-xl border font-bold text-xs ${isAdjustmentMode ? 'bg-amber-600/20 border-amber-500 text-amber-400' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400'}`}>
                      {isAdjustmentMode ? '🛠️ 調整中' : '🛠️ 手動調整'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400 uppercase">零件名稱</label>
                  <input type="text" required className="w-full px-4 py-3 rounded-xl border bg-zinc-800 text-white" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400 uppercase">規格說明</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl border bg-zinc-800 text-white" value={formData.specification} onChange={(e) => setFormData({ ...formData, specification: e.target.value })} />
                </div>
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-zinc-400 uppercase">數量</label>
              <input type="text" inputMode="numeric" required className="w-full px-4 py-3 rounded-xl border bg-zinc-800 text-white font-mono text-xl" value={formData.quantity} onChange={(e) => { const val = e.target.value; if (val===''||val==='-'||!isNaN(Number(val))) setFormData({...formData, quantity:val}); }} />
              <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-xl ${isAdjustmentMode ? 'bg-amber-600' : 'bg-blue-600'}`}>
                {loading ? '處理中...' : (isAdjustmentMode ? '確認手動調整' : '確認提交紀錄')}
              </button>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-zinc-400 uppercase flex items-center gap-2">
                <span>📝 雲端待辦清單</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">所有電腦同步</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white text-xl placeholder-zinc-600"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addQuickTask(); } }}
                  placeholder="例如: AS3B*120"
                />
                <button type="button" onClick={addQuickTask} className="px-6 bg-zinc-800 text-blue-400 border border-zinc-700 rounded-xl font-bold">➕</button>
              </div>

              {quickTasks.length > 0 && (
                <div className="mt-4 p-4 bg-black/40 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {quickTasks.map((task, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-1 py-1 group shadow-sm">
                        <span className="text-xl font-mono text-white mr-2">{task}</span>
                        <button type="button" onClick={() => completeQuickTask(task, idx)} disabled={loading} className="p-1.5 text-green-500 hover:bg-green-500/20 rounded-md transition-colors" title="標記完成">✅</button>
                        <button type="button" onClick={() => removeQuickTask(idx)} className="p-1.5 text-red-400 hover:bg-red-400/20 rounded-md transition-colors" title="刪除">🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {showStockOverlay && (
        <div className="absolute inset-x-0 bottom-0 top-[88px] bg-black/95 backdrop-blur-md z-20 flex flex-col rounded-b-3xl border-t border-zinc-800 shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <h4 className="font-bold text-white flex items-center gap-2">📚 玻璃門庫存</h4>
            <div className="flex gap-2">
               <button onClick={isBatchEditing ? saveBatchAdjustments : enterBatchEdit} className={`px-4 py-2 rounded-xl font-bold text-sm ${isBatchEditing ? 'bg-green-600 text-white' : 'bg-amber-600/20 text-amber-500'}`}>
                {isBatchEditing ? '💾 儲存調整' : '🛠️ 調整庫存'}
              </button>
              <button onClick={() => setShowStockOverlay(false)} className="p-2 text-zinc-400">✖️</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-10">
            {DISPLAY_ORDER.map(spec => (
              <section key={spec} className="space-y-4">
                <h5 className="text-blue-400 font-black text-sm uppercase tracking-widest">{spec}</h5>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(fullStockSummary[spec] || {}).map(([model, qty]) => (
                    <div key={model} className="flex items-center gap-1.5 p-2 rounded-xl border bg-zinc-800/80 border-zinc-700">
                      <span className="text-xl font-bold text-white truncate flex-1">{model}</span>
                      {isBatchEditing ? (
                        <input type="text" className="w-14 px-1 py-1 bg-zinc-900 border border-amber-500/50 rounded text-amber-400 text-center font-bold" value={batchValues[spec]?.[model] || '0'} onChange={(e) => setBatchValues({...batchValues, [spec]: {...batchValues[spec], [model]: e.target.value}})} />
                      ) : (
                        // Fix: Explicitly cast qty to number to resolve TypeScript operator > error.
                        <span className={`text-base font-black px-1.5 py-0.5 rounded-lg ${Number(qty) > 0 ? 'text-blue-400 bg-blue-600/10' : 'text-zinc-600 bg-zinc-900'}`}>{qty as React.ReactNode}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryForm;