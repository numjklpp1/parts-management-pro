
import React, { useState } from 'react';
import { PartCategory, PartRecord } from '../../types';

interface StandardPartFormProps {
  category: PartCategory;
  onSubmit: (record: PartRecord) => Promise<void>;
  icon: string;
}

const StandardPartForm: React.FC<StandardPartFormProps> = ({ category, onSubmit, icon }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    specification: '一般',
    quantity: '0',
    note: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(formData.quantity);
    if (isNaN(qty) || qty === 0 || !formData.name) return alert('請填寫正確名稱與數量');
    
    setLoading(true);
    try {
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      
      await onSubmit({
        id: `${category.substring(0, 1)}-${date}-${random}`,
        timestamp: new Date().toLocaleString('zh-TW'),
        category,
        name: formData.name,
        specification: formData.specification,
        quantity: qty,
        note: formData.note
      });
      setFormData({ ...formData, name: '', quantity: '0', note: '' });
      alert('已存檔');
    } catch (err) {
      alert('同步失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl">
        <div className="bg-black px-8 py-6 border-b border-zinc-800 flex justify-between items-center rounded-t-3xl">
          <h2 className="text-2xl font-black text-white">{category} - 零件入庫</h2>
          <span className="text-3xl">{icon}</span>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">零件名稱 / 型號</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white h-[58px]"
                placeholder="例如：樹德標準拉手"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">規格備註</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl border border-zinc-700 bg-zinc-800 text-white h-[58px]"
                placeholder="例如：4尺用、霧黑色"
                value={formData.note}
                onChange={e => setFormData({...formData, note: e.target.value})}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">入庫量</label>
              <input 
                type="text" 
                inputMode="numeric"
                required
                className="w-full px-4 py-4 rounded-xl border border-zinc-700 bg-zinc-800 text-white font-mono text-2xl"
                value={formData.quantity}
                onChange={e => setFormData({...formData, quantity: e.target.value})}
              />
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-blue-600 rounded-xl font-bold text-white shadow-xl mt-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                {loading ? '同步中...' : '確認入庫提交'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StandardPartForm;
