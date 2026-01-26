
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DashboardStats } from '../types';

interface DashboardProps {
  stats: DashboardStats;
  aiInsights: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const Dashboard: React.FC<DashboardProps> = ({ stats, aiInsights }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-800">
          <p className="text-sm text-zinc-400 font-medium">總品項數</p>
          <p className="text-3xl font-bold mt-1 text-white">{stats.totalItems}</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-800">
          <p className="text-sm text-zinc-400 font-medium">庫存總數量</p>
          <p className="text-3xl font-bold mt-1 text-blue-400">{stats.totalQuantity}</p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-800">
          <p className="text-sm text-zinc-400 font-medium">最近異動項目</p>
          <p className="text-lg font-bold mt-1 truncate text-zinc-200">
            {stats.recentActivity[0]?.name || '尚無紀錄'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-800 h-[400px]">
          <h3 className="text-lg font-bold mb-6 text-white">分類庫存分佈</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.categoryDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#18181b', 
                  borderRadius: '12px', 
                  border: '1px solid #3f3f46', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)',
                  color: '#fff'
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {stats.categoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-800 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">✨</span>
            <h3 className="text-lg font-bold text-white">AI 智慧分析建議</h3>
          </div>
          <div className="bg-blue-900/10 rounded-xl p-5 border border-blue-900/30 flex-1 overflow-y-auto">
            <p className="text-blue-100/90 leading-relaxed whitespace-pre-wrap text-sm">
              {aiInsights || "正在載入分析報告..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
