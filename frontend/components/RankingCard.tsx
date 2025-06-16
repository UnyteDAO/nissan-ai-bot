'use client';

import { Trophy, TrendingUp, MessageSquare, Code, FileText, Users } from 'lucide-react';
import type { UserScore } from '@/types';

interface RankingCardProps {
  user: UserScore;
  rank: number;
  onClick?: () => void;
}

export function RankingCard({ user, rank, onClick }: RankingCardProps) {
  const getRankIcon = () => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-6 h-6 text-slate-400" />;
    if (rank === 3) return <Trophy className="w-6 h-6 text-orange-600" />;
    return <span className="text-lg font-bold text-slate-600">#{rank}</span>;
  };

  const averageScore = user.evaluationCount > 0 
    ? (user.totalScore / user.evaluationCount).toFixed(1) 
    : '0';

  return (
    <div 
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-slate-200 p-6 hover:border-indigo-300"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {getRankIcon()}
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              User {user.userId.substring(0, 8)}...
            </h3>
            <p className="text-sm text-slate-600">
              評価回数: {user.evaluationCount}回
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-indigo-600">{user.totalScore}点</p>
          <p className="text-sm text-slate-600">平均: {averageScore}点</p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-700 mb-2">スコア内訳</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center space-x-2">
            <Code className="w-4 h-4 text-blue-500" />
            <span className="text-slate-600">技術的アドバイス:</span>
            <span className="font-medium text-slate-900">{user.breakdown.technicalAdvice}</span>
          </div>
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-slate-600">問題解決:</span>
            <span className="font-medium text-slate-900">{user.breakdown.problemSolving}</span>
          </div>
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-purple-500" />
            <span className="text-slate-600">実現可能性:</span>
            <span className="font-medium text-slate-900">{user.breakdown.feasibility}</span>
          </div>
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-amber-500" />
            <span className="text-slate-600">コミュニケーション:</span>
            <span className="font-medium text-slate-900">{user.breakdown.communication}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span className="text-slate-600">成果物:</span>
            <span className="font-medium text-slate-900">{user.breakdown.deliverables}</span>
          </div>
          {user.breakdown.penalties < 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-slate-600">ペナルティ:</span>
              <span className="font-medium text-red-500">{user.breakdown.penalties}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}