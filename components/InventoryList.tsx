
import React, { useState } from 'react';
import { PartRecord } from '../types';

interface InventoryListProps {
  records: PartRecord[];
}

const InventoryList: React.FC<InventoryListProps> = ({ records }) => {
  const [search, setSearch] = useState('');

  const filtered = records.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden">
      <div className="p-6 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-white">庫存總表</h3>
        <div className="relative">
          <input
            type="text"
            placeholder="搜尋名稱、類別..."
            className="pl-10 pr-4 py-2 rounded-xl border border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64 bg-zinc-800 text-white placeholder-zinc-500"
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
              <th className="px-6 py-4">時間</th>
              <th className="px-6 py-4">分類</th>
              <th className="px-6 py-4">項目名稱</th>
              <th className="px-6 py-4 text-center">數量</th>
              <th className="px-6 py-4">備註</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-zinc-300">
            {filtered.map((record) => (
              <tr key={record.id} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4 text-sm text-zinc-500 whitespace-nowrap font-mono">{record.timestamp}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    record.category === '噴漆' ? 'bg-orange-900/40 text-orange-400' :
                    record.category === '玻璃拉門' ? 'bg-blue-900/40 text-blue-400' :
                    'bg-zinc-700/50 text-zinc-300'
                  }`}>
                    {record.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="font-semibold text-white">{record.name}</span>
                  <p className="text-xs text-zinc-500 font-normal mt-0.5">{record.specification}</p>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="font-bold text-blue-400 text-lg">{record.quantity}</span>
                </td>
                <td className="px-6 py-4 text-sm text-zinc-500 italic max-w-xs truncate">{record.note || '-'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-600">
                  查無庫存資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InventoryList;
