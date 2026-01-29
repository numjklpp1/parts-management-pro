import React, { useState } from 'react';
import { PartRecord, Language, PartCategory } from '../types';
import { translations } from '../utils/translations';

interface InventoryListProps {
  records: PartRecord[];
  language: Language;
}

const InventoryList: React.FC<InventoryListProps> = ({ records, language }) => {
  const t = (key: string) => translations[language][key] || key;
  const [search, setSearch] = useState('');

  const catKeyMap: Record<string, string> = {
    [PartCategory.GlassSlidingDoor]: 'glass_door',
    [PartCategory.IronSlidingDoor]: 'iron_door',
    [PartCategory.Drawer]: 'drawer',
    [PartCategory.CabinetBody]: 'cabinet',
    [PartCategory.Paint]: 'paint'
  };

  const filtered = records.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase()) ||
    (r.note && r.note.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-zinc-400">📜</span> {t('history_log')}
          </h3>
          <div className="relative">
            <input
              type="text"
              placeholder={t('search_placeholder')}
              className="pl-10 pr-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-white w-full md:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="absolute left-3 top-2.5 text-zinc-500">🔍</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">{t('time')}</th>
                <th className="px-6 py-4">{t('category')}</th>
                <th className="px-6 py-4">{t('item_note')}</th>
                <th className="px-6 py-4 text-center">{t('change_qty')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {filtered.map((record) => (
                <tr key={record.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-zinc-500 font-mono">{record.timestamp}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-md text-xs font-bold bg-zinc-700/50 text-zinc-300">
                      {t(catKeyMap[record.category] || record.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-white">{record.name}</span>
                    <p className="text-xs text-zinc-500">{record.specification}</p>
                    {record.note && (
                      <div className="mt-2 p-2 bg-black/30 rounded-lg border border-zinc-800/50 text-xs text-blue-300">
                        {record.note}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-bold text-lg ${record.quantity > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                      {record.quantity > 0 ? `+${record.quantity}` : record.quantity}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-600">{t('no_data')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryList;