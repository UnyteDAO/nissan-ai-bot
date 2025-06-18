'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ThreadDetail } from '@/components/ThreadDetail';
import { ScoreChart } from '@/components/ScoreChart';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { UserScore, Evaluation, Thread } from '@/types';

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  
  const [userScore, setUserScore] = useState<UserScore | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedThread, setSelectedThread] = useState<{ thread: Thread; evaluation: Evaluation } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) {
      fetchUserData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreEvaluations();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, hasMore, page]);

  const fetchUserData = async () => {
    try {
      // Fetch user score
      const rankingsResponse = await fetch('/api/rankings');
      const rankings: UserScore[] = await rankingsResponse.json();
      const user = rankings.find(u => u.userId === userId);
      if (user) {
        setUserScore(user);
      }

      // Fetch initial user evaluations using the new endpoint
      const evalResponse = await fetch(`/api/evaluations/user/${userId}?page=0&limit=20`);
      const evalData = await evalResponse.json();
      setEvaluations(evalData.evaluations || []);
      setHasMore(evalData.hasMore || false);
      setPage(0);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreEvaluations = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const evalResponse = await fetch(`/api/evaluations/user/${userId}?page=${nextPage}&limit=20`);
      const evalData = await evalResponse.json();
      
      if (evalData.evaluations && evalData.evaluations.length > 0) {
        setEvaluations(prev => [...prev, ...evalData.evaluations]);
        setPage(nextPage);
        setHasMore(evalData.hasMore || false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more evaluations:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [userId, page, hasMore, loadingMore]);

  const fetchThreadDetail = async (threadId: string) => {
    try {
      const response = await fetch(`/api/threads/${threadId}`);
      const data = await response.json();
      setSelectedThread(data);
    } catch (error) {
      console.error('Failed to fetch thread detail:', error);
    }
  };

  const formatDate = (timestamp: { _seconds: number }) => {
    return format(new Date(timestamp._seconds * 1000), 'yyyy/MM/dd HH:mm', { locale: ja });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ダッシュボードに戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            User {userId.substring(0, 8)}... の詳細
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* User Stats */}
          <div className="lg:col-span-1">
            {userScore && (
              <>
                <div className="bg-white rounded-lg shadow-md p-6 mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">統計情報</h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">総合スコア</p>
                      <p className="text-3xl font-bold text-indigo-600">{userScore.totalScore}点</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">評価回数</p>
                      <p className="text-xl font-semibold">{userScore.evaluationCount}回</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">平均スコア</p>
                      <p className="text-xl font-semibold">
                        {(userScore.totalScore / userScore.evaluationCount).toFixed(1)}点
                      </p>
                    </div>
                  </div>
                </div>
                <ScoreChart breakdown={userScore.breakdown} />
              </>
            )}
          </div>

          {/* Evaluations */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">評価履歴</h2>
            {evaluations.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-500">評価履歴がありません</p>
              </div>
            ) : (
              <div className="space-y-4">
                {evaluations.map((evaluation) => {
                  const userParticipation = evaluation.evaluation.participants[userId];
                  if (!userParticipation) return null;

                  return (
                    <div
                      key={evaluation.id}
                      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => fetchThreadDetail(evaluation.threadId)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            Thread {evaluation.threadId.substring(0, 8)}...
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(evaluation.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-indigo-600">
                            {userParticipation.score}点
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                        <div>技術的アドバイス: {userParticipation.technicalAdvice}点</div>
                        <div>問題解決: {userParticipation.problemSolving}点</div>
                        <div>実現可能性: {userParticipation.feasibility}点</div>
                        <div>コミュニケーション: {userParticipation.communication}点</div>
                      </div>

                      {userParticipation.comments.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">評価コメント:</p>
                          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                            {userParticipation.comments.map((comment, index) => (
                              <li key={index}>{comment}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Loading indicator for infinite scroll */}
                <div ref={loadMoreRef} className="flex justify-center py-4">
                  {loadingMore && (
                    <div className="flex items-center space-x-2 text-gray-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>評価履歴を読み込み中...</span>
                    </div>
                  )}
                  {!hasMore && evaluations.length > 0 && (
                    <p className="text-gray-500">すべての評価履歴を表示しました</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Thread Detail Modal */}
        {selectedThread && (
          <div 
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all duration-300"
            onClick={() => setSelectedThread(null)}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 transform transition-all duration-300 scale-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-slate-900">スレッド詳細</h2>
                <button
                  onClick={() => setSelectedThread(null)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <ThreadDetail
                thread={selectedThread.thread}
                evaluation={selectedThread.evaluation}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}