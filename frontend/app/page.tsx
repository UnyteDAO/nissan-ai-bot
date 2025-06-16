'use client';

import { useState, useEffect } from 'react';
import { RankingCard } from '@/components/RankingCard';
import { ScoreChart } from '@/components/ScoreChart';
import { Award, Users, TrendingUp, Activity } from 'lucide-react';
import type { UserScore } from '@/types';

export default function HomePage() {
  const [rankings, setRankings] = useState<UserScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserScore | null>(null);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      const response = await fetch('/api/rankings');
      const data = await response.json();
      setRankings(data);
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalScore = rankings.reduce((sum, user) => sum + user.totalScore, 0);
  const totalEvaluations = rankings.reduce((sum, user) => sum + user.evaluationCount, 0);
  const averageScore = rankings.length > 0 ? (totalScore / rankings.length).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            貢献度ダッシュボード
          </h1>
          <p className="mt-2 text-slate-600">
            DAO構築支援コミュニティのメンバー貢献度を可視化
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-slate-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">総メンバー数</p>
                <p className="text-2xl font-bold text-slate-900">{rankings.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-slate-200">
            <div className="flex items-center">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Award className="h-6 w-6 text-amber-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">総スコア</p>
                <p className="text-2xl font-bold text-slate-900">{totalScore}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-slate-200">
            <div className="flex items-center">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Activity className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">総評価数</p>
                <p className="text-2xl font-bold text-slate-900">{totalEvaluations}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 border border-slate-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">平均スコア</p>
                <p className="text-2xl font-bold text-slate-900">{averageScore}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Rankings */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">貢献度ランキング</h2>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse border border-slate-200">
                    <div className="h-20 bg-slate-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {rankings.map((user, index) => (
                  <RankingCard
                    key={user.userId}
                    user={user}
                    rank={index + 1}
                    onClick={() => setSelectedUser(user)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Selected User Details */}
          <div>
            {selectedUser ? (
              <div className="sticky top-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">
                  詳細情報
                </h2>
                <div className="bg-white rounded-xl shadow-sm p-6 mb-4 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">
                    User {selectedUser.userId.substring(0, 8)}...
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">総合スコア</span>
                      <span className="text-xl font-bold text-indigo-600">{selectedUser.totalScore}点</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">評価回数</span>
                      <span className="font-semibold text-slate-900">{selectedUser.evaluationCount}回</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">平均スコア</span>
                      <span className="font-semibold text-slate-900">
                        {(selectedUser.totalScore / selectedUser.evaluationCount).toFixed(1)}点
                      </span>
                    </div>
                  </div>
                </div>
                <ScoreChart breakdown={selectedUser.breakdown} />
                <div className="mt-4">
                  <a
                    href={`/user/${selectedUser.userId}`}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 text-center block font-medium shadow-md hover:shadow-lg"
                  >
                    詳細を見る
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-slate-100 rounded-xl p-8 text-center border-2 border-dashed border-slate-300">
                <p className="text-slate-500">
                  ユーザーを選択すると詳細が表示されます
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
