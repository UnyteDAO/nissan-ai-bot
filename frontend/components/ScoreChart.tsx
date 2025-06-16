'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ScoreChartProps {
  breakdown: {
    technicalAdvice: number;
    problemSolving: number;
    feasibility: number;
    communication: number;
    deliverables: number;
    penalties: number;
  };
}

const COLORS = {
  technicalAdvice: '#3B82F6',
  problemSolving: '#10B981',
  feasibility: '#8B5CF6',
  communication: '#F59E0B',
  deliverables: '#6366F1',
  penalties: '#EF4444'
};

const LABELS = {
  technicalAdvice: '技術的アドバイス',
  problemSolving: '問題解決',
  feasibility: '実現可能性',
  communication: 'コミュニケーション',
  deliverables: '成果物',
  penalties: 'ペナルティ'
};

export function ScoreChart({ breakdown }: ScoreChartProps) {
  const data = Object.entries(breakdown)
    .filter(([key, value]) => key !== 'penalties' && value > 0)
    .map(([key, value]) => ({
      name: LABELS[key as keyof typeof LABELS],
      value: value,
      color: COLORS[key as keyof typeof COLORS]
    }));

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">スコア分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      {breakdown.penalties < 0 && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-800">
            ペナルティ: <span className="font-semibold">{breakdown.penalties}点</span>
          </p>
        </div>
      )}
    </div>
  );
}