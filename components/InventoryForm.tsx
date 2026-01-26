
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PartCategory, PartRecord } from '../types';
import { CATEGORIES, GLASS_DOOR_GROUPS, GLASS_DOOR_MODELS } from '../constants';
import { suggestPartDescription } from '../services/geminiService';

interface InventoryFormProps {
  onSubmit: (records: PartRecord | PartRecord[]) => Promise<void>;
  preselectedCategory: PartCategory;
  allRecords: PartRecord[];
}

const InventoryForm: React.FC<InventoryFormProps> = ({ onSubmit, preselectedCategory, allRecords }) => {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [showStockOverlay, setShowStockOverlay] = useState(false);
  const [isAdjustmentMode, setIsAdjustmentMode] = useState(false);
  
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [batchValues, setBatchValues] = useState<Record<string, Record<string, string>>>({});
  
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const isGlassDoor = preselectedCategory === PartCategory.GlassSlidingDoor;

  const [formData, setFormData] = useState({
    category: preselectedCategory,
    name: '' as string,
    specification: '' as string,
    quantity: '0' as string | number,
    note: '' as string
  });

  const DISPLAY_ORDER = ['完成', '框_完成', '框', '玻璃膠條', '玻璃條', '玻璃'];
  const BASE_MODEL_SPECS = ['玻璃', '玻璃條', '玻璃膠條'];

  // 生成較易讀的 ID：類別-年月日-隨機字元
  const generateReadableId = (category: string) => {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const catCode = category.substring(0, 1);
    return `${catCode}-${date}-${random}`;
  };

  const availableModels = useMemo(() => {
    if (!isGlassDoor) return [];
    if (BASE_MODEL_SPECS.includes(formData.specification)) {
      const baseModels = GLASS_DOOR_MODELS.map(m => m.replace(/-[LR]$/, ''));
      return Array.from(new Set(baseModels));
    }
    return GLASS_DOOR_MODELS as unknown as string[];
  }, [isGlassDoor, formData.specification]);

  const getCurrentStock = (spec: string, modelName: string) => {
    const isBasePart = BASE_MODEL_SPECS.includes(spec);
    const baseSearchName = isBasePart ? modelName.replace(/-[LR]$/, '') : modelName;

    return allRecords
      .filter(r => {
        const isCorrectCat = r.category === PartCategory.GlassSlidingDoor;
        const isCorrectSpec = r.specification === spec;
        const rNameBase = isBasePart ? r.name.replace(/-[LR]$/, '') : r.name;
        return isCorrectCat && isCorrectSpec && rNameBase === baseSearchName;
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
        ? Array.from(new Set(GLASS_DOOR_MODELS.map(m => m.replace(/-[LR]$/, ''))))
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
        defaultName = (GLASS_DOOR_MODELS[0] as string).replace(/-[LR]$/, '');
      } else {
        defaultName = GLASS_DOOR_MODELS[0];
      }
    }
    setFormData(prev => ({
      ...prev,
      category: preselectedCategory,
      name: defaultName,
      specification: defaultSpec,
      quantity: '0'
    }));
  }, [preselectedCategory, isGlassDoor]);

  useEffect(() => {
    if (isGlassDoor && availableModels.length > 0) {
      const currentName = formData.name;
      if (availableModels.includes(currentName)) return;

      let bestMatch = '';
      const isNewSpecBase = BASE_MODEL_SPECS.includes(formData.specification);
      
      if (isNewSpecBase) {
        const base = currentName.replace(/-[LR]$/, '');
        if (availableModels.includes(base)) bestMatch = base;
      } else {
        const withL = currentName + '-L';
        const withR = currentName + '-R';
        if (availableModels.includes(withL)) bestMatch = withL;
        else if (availableModels.includes(withR)) bestMatch = withR;
        else {
          const prefixMatch = availableModels.find(m => m.startsWith(currentName));
          if (prefixMatch) bestMatch = prefixMatch;
        }
      }

      if (bestMatch) setFormData(prev => ({ ...prev, name: bestMatch }));
      else setFormData(prev => ({ ...prev, name: availableModels[0] }));
    }
  }, [formData.specification, availableModels, isGlassDoor]);

  const handleAiSuggest = async () => {
    if (!formData.name) return;
    setAiLoading(true);
    const suggestion = await suggestPartDescription(formData.category, formData.name);
    setAiSuggestion(suggestion || '');
    setAiLoading(false);
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

    if (recordsToSubmit.length === 0) {
      setIsBatchEditing(false);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(recordsToSubmit);
      alert(`已成功儲存 ${recordsToSubmit.length} 項庫存異動！`);
      setIsBatchEditing(false);
      setShowStockOverlay(false);
    } catch (err) {
      alert('批次調整失敗：' + err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(formData.quantity);
    if (isNaN(numQty) || numQty === 0) {
      alert('請輸入有效的數量（非零數字）');
      return;
    }

    setLoading(true);
    try {
      const recordsToSubmit: PartRecord[] = [];
      const timestamp = new Date().toLocaleString('zh-TW');

      const mainRecord: PartRecord = {
        ...formData,
        quantity: numQty,
        id: generateReadableId(formData.category),
        timestamp,
        note: isAdjustmentMode ? `[手動調整] ${formData.note}`.trim() : formData.note
      };
      recordsToSubmit.push(mainRecord);

      if (!isAdjustmentMode && isGlassDoor && numQty > 0) {
        if (formData.specification === '玻璃膠條' || formData.specification === '玻璃條') {
          recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: formData.name, specification: '玻璃', quantity: -numQty, note: `連動扣除 (隨 ${formData.specification} 新增)` });
        } else if (formData.specification === '框_完成') {
          recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: formData.name, specification: '框', quantity: -numQty, note: `連動扣除 (隨 框_完成 新增)` });
        } else if (formData.specification === '完成') {
          const N = numQty;
          const stockFrameFinished = getCurrentStock('框_完成', formData.name);
          const deductFromFrameFinished = Math.min(stockFrameFinished, N);
          const remainingFrameNeed = N - deductFromFrameFinished;
          if (deductFromFrameFinished > 0) recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: formData.name, specification: '框_完成', quantity: -deductFromFrameFinished, note: `完成品扣除 (優先項)` });
          if (remainingFrameNeed > 0) recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: formData.name, specification: '框', quantity: -remainingFrameNeed, note: `完成品扣除 (次要項)` });
          
          const baseName = formData.name.replace(/-[LR]$/, '');
          const stockGlassGasket = getCurrentStock('玻璃膠條', baseName);
          const deductFromGlassGasket = Math.min(stockGlassGasket, N);
          const remainingGlassNeed = N - deductFromGlassGasket;
          if (deductFromGlassGasket > 0) recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: baseName, specification: '玻璃膠條', quantity: -deductFromGlassGasket, note: `完成品扣除 (優先項)` });
          if (remainingGlassNeed > 0) recordsToSubmit.push({ id: generateReadableId(PartCategory.GlassSlidingDoor), timestamp, category: PartCategory.GlassSlidingDoor, name: baseName, specification: '玻璃', quantity: -remainingGlassNeed, note: `完成品扣除 (次要項)` });
        }
      }

      await onSubmit(recordsToSubmit);
      setFormData({
        category: preselectedCategory,
        name: availableModels.length > 0 ? availableModels[0] : '',
        specification: isGlassDoor ? formData.specification : '',
        quantity: '0',
        note: ''
      });
      setIsAdjustmentMode(false);
      setAiSuggestion('');
      alert(isAdjustmentMode ? '手動庫存調整已完成' : '紀錄已儲存！');
    } catch (err) {
      alert('存檔失敗：' + err);
    } finally {
      setLoading(false);
    }
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
            <p className={`${isAdjustmentMode ? 'text-amber-400/80' : 'text-zinc-500'} mt-1 text-sm font-medium`}>
              {isAdjustmentMode ? '⚠️ 此模式下紀錄將標記為手動調整，不觸發連動扣減邏輯' : `正在${displayQty < 0 ? '修正' : '新增'}一筆項目至 ${formData.category} 分類`}
            </p>
          </div>
          <span className={`text-4xl transition-all ${isAdjustmentMode ? 'opacity-100 scale-110 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 'opacity-50'}`}>
            {isAdjustmentMode ? '🛠️' : (
              formData.category === PartCategory.GlassSlidingDoor ? '🪟' :
              formData.category === PartCategory.IronSlidingDoor ? '🏗️' :
              formData.category === PartCategory.Drawer ? '📥' :
              formData.category === PartCategory.CabinetBody ? '📦' : '🎨'
            )}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isGlassDoor ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">零件組別</label>
                  <div className="grid grid-cols-2 gap-2">
                    {GLASS_DOOR_GROUPS.map(group => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setFormData({...formData, specification: group})}
                        className={`py-3 rounded-xl border font-bold transition-all ${
                          formData.specification === group 
                            ? (isAdjustmentMode ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/40' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40')
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 flex flex-col">
                  <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">零件型號</label>
                  <select
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none bg-zinc-800 text-white transition-all h-[58px] ${isAdjustmentMode ? 'border-amber-700 focus:ring-amber-500' : 'border-zinc-700 focus:ring-blue-500'}`}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  >
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowStockOverlay(!showStockOverlay)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-xs font-bold text-blue-400 hover:bg-zinc-700/50 transition-all active:scale-95"
                    >
                      📊 檢視玻璃拉門所有庫存 (依組別排序)
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setIsAdjustmentMode(!isAdjustmentMode)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border font-bold text-xs transition-all active:scale-95 ${
                        isAdjustmentMode 
                        ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {isAdjustmentMode ? '🛠️ 手動調整模式：開啟中' : '🛠️ 切換手動調整存貨 (不連動)'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">零件名稱</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      className={`flex-1 px-4 py-3 rounded-xl border focus:ring-2 outline-none bg-zinc-800 text-white placeholder-zinc-600 transition-all ${isAdjustmentMode ? 'border-amber-700 focus:ring-amber-500' : 'border-zinc-700 focus:ring-blue-500'}`}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                    <button type="button" onClick={handleAiSuggest} disabled={aiLoading} className="px-4 py-3 bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-xl font-bold hover:bg-blue-900/50 whitespace-nowrap">✨ AI</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">規格說明</label>
                  <input
                    type="text"
                    className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none bg-zinc-800 text-white placeholder-zinc-600 transition-all ${isAdjustmentMode ? 'border-amber-700 focus:ring-amber-500' : 'border-zinc-700 focus:ring-blue-500'}`}
                    value={formData.specification}
                    onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setIsAdjustmentMode(!isAdjustmentMode)}
                    className={`mt-2 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border font-bold text-[10px] transition-all ${isAdjustmentMode ? 'bg-amber-600/20 border-amber-500 text-amber-400' : 'bg-zinc-800/30 border-zinc-700/50 text-zinc-500'}`}
                  >
                    {isAdjustmentMode ? '🛠️ 調整模式：開啟' : '🛠️ 切換手動調整存貨'}
                  </button>
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                數量 {isAdjustmentMode ? <span className="text-amber-400 text-xs ml-2">(調整模式)</span> : (displayQty < 0 && <span className="text-red-400 text-xs ml-2">(修正模式)</span>)}
              </label>
              <input
                ref={qtyInputRef}
                type="text"
                inputMode="numeric"
                required
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none transition-all font-mono text-xl ${
                  isAdjustmentMode ? 'border-amber-700 bg-amber-900/10 text-amber-100 focus:ring-amber-500 ring-1 ring-amber-500/30' : 
                  (displayQty < 0 ? 'border-red-900/50 bg-red-900/10 text-red-200' : 'border-zinc-700 bg-zinc-800 text-white focus:ring-blue-500')
                }`}
                value={formData.quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || val === '-' || !isNaN(Number(val))) {
                    setFormData({ ...formData, quantity: val });
                  }
                }}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">備註</label>
              <textarea
                className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none bg-zinc-800 text-white min-h-[100px] transition-all ${isAdjustmentMode ? 'border-amber-700 focus:ring-amber-500' : 'border-zinc-700 focus:ring-blue-500'}`}
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder={isAdjustmentMode ? "請輸入調整原因..." : "選填，如修正請註明原因..."}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-all ${isAdjustmentMode ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20' : (displayQty < 0 ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20')} text-white`}
          >
            {loading ? '處理中...' : (isAdjustmentMode ? '確認手動調整 (不連動)' : '確認提交紀錄')}
          </button>
        </form>
      </div>

      {showStockOverlay && isGlassDoor && (
        <div className="absolute inset-x-0 bottom-0 top-[88px] bg-black/95 backdrop-blur-md z-20 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-b-3xl border-t border-zinc-800 shadow-2xl">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center sticky top-0 bg-black/60 backdrop-blur-md z-30">
            <h4 className="font-bold text-white flex items-center gap-2 text-lg">
              <span className="text-blue-400">📊</span> 玻璃拉門全項庫存
            </h4>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={isBatchEditing ? saveBatchAdjustments : enterBatchEdit}
                disabled={loading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                  isBatchEditing 
                    ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' 
                    : 'bg-amber-600/20 border border-amber-500/50 text-amber-500 hover:bg-amber-600 hover:text-white'
                }`}
              >
                {loading ? '儲存中...' : (isBatchEditing ? '💾 儲存所有調整項目' : '🛠️ 調整庫存')}
              </button>
              
              {isBatchEditing && (
                <button 
                  onClick={() => setIsBatchEditing(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-400 rounded-xl font-bold text-sm hover:text-white"
                >
                  ❌ 取消
                </button>
              )}

              <button 
                onClick={() => { setShowStockOverlay(false); setIsBatchEditing(false); }}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors"
              >
                ✖️
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-10">
            {isBatchEditing && (
              <div className="bg-amber-900/20 border border-amber-800/30 p-4 rounded-2xl mb-4 text-amber-200 text-xs flex items-center gap-3">
                <span>💡 提示：您現在可以直接點擊下方數值進行修改。完成後請點擊右上角「儲存」。</span>
              </div>
            )}

            {DISPLAY_ORDER.map(spec => (
              <section key={spec} className="space-y-4">
                <div className="flex items-center gap-4 sticky top-0 bg-zinc-950/80 backdrop-blur-sm py-2 z-10">
                  <h5 className="text-blue-400 font-black text-sm uppercase tracking-widest px-3 py-1 bg-blue-900/20 rounded-lg border border-blue-800/30">
                    {spec}
                  </h5>
                  <div className="h-px flex-1 bg-zinc-800"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(fullStockSummary[spec] || {}).map(([model, qty]) => (
                    <div 
                      key={model} 
                      className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isBatchEditing ? 'border-amber-500/30 bg-amber-900/5' : ((qty as number) > 0 ? 'bg-zinc-800/80 border-zinc-700 shadow-sm' : 'bg-zinc-900/30 border-zinc-800/50 opacity-40')
                      }`}
                    >
                      <span className="text-xs font-medium text-zinc-300 truncate pr-2">{model}</span>
                      
                      <div className="flex items-center gap-2">
                        {isBatchEditing ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            className="w-16 px-2 py-1 bg-zinc-900 border border-amber-500/50 rounded-md text-xs text-amber-400 text-center focus:ring-1 focus:ring-amber-500 outline-none font-bold"
                            value={batchValues[spec]?.[model] || '0'}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || val === '-' || !isNaN(Number(val))) {
                                setBatchValues({
                                  ...batchValues,
                                  [spec]: { ...batchValues[spec], [model]: val }
                                });
                              }
                            }}
                          />
                        ) : (
                          <span className={`text-xs font-black px-2 py-1 rounded-md min-w-[2.5rem] text-center ${
                            (qty as number) > 0 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-600'
                          }`}>
                            {qty as React.ReactNode}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          
          <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 text-center text-[10px] text-zinc-500 italic">
            {isBatchEditing ? '⚠️ 批次調整將會自動產生增減紀錄 (Delta)，不會連動其他零件。' : '提示：使用右上角「🛠️ 調整庫存」可進入批次修改模式。'}
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryForm;
