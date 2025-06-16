'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { MessageSquare, User, Calendar, Hash } from 'lucide-react';
import type { Thread, Evaluation, Message } from '@/types';

interface ThreadDetailProps {
  thread: Thread;
  evaluation?: Evaluation | null;
}

export function ThreadDetail({ thread, evaluation }: ThreadDetailProps) {
  const formatTimestamp = (timestamp: { _seconds: number }) => {
    return format(new Date(timestamp._seconds * 1000), 'yyyy/MM/dd HH:mm', { locale: ja });
  };

  return (
    <div className="space-y-6">
      {/* Thread Info */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">スレッド情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">チャンネル:</span>
            <span className="font-medium">{thread.channelName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">参加者数:</span>
            <span className="font-medium">{thread.participantCount}人</span>
          </div>
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">メッセージ数:</span>
            <span className="font-medium">{thread.messageCount}件</span>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">期間:</span>
            <span className="font-medium text-sm">
              {formatTimestamp(thread.startTime)} - {formatTimestamp(thread.endTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Evaluation Summary */}
      {evaluation && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">評価サマリー</h2>
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700">{evaluation.evaluation.summary}</p>
            
            {evaluation.evaluation.highlights.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900">ハイライト</h4>
                <ul className="list-disc list-inside space-y-1">
                  {evaluation.evaluation.highlights.map((highlight, index) => (
                    <li key={index} className="text-gray-600">{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {evaluation.evaluation.concerns.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900">改善点</h4>
                <ul className="list-disc list-inside space-y-1">
                  {evaluation.evaluation.concerns.map((concern, index) => (
                    <li key={index} className="text-gray-600">{concern}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Participant Scores */}
      {evaluation && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">参加者スコア</h2>
          <div className="space-y-4">
            {Object.entries(evaluation.evaluation.participants).map(([userId, data]) => (
              <div key={userId} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">User {userId.substring(0, 8)}...</h4>
                  <span className="text-lg font-bold text-indigo-600">{data.score}点</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>技術的アドバイス: {data.technicalAdvice}点</div>
                  <div>問題解決: {data.problemSolving}点</div>
                  <div>実現可能性: {data.feasibility}点</div>
                  <div>コミュニケーション: {data.communication}点</div>
                  <div>成果物: {data.deliverables}点</div>
                  {data.penalties !== 0 && (
                    <div className="text-red-600">ペナルティ: {data.penalties}点</div>
                  )}
                </div>
                {data.comments.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">コメント:</p>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {data.comments.map((comment, index) => (
                        <li key={index}>{comment}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">会話内容</h2>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {thread.messages.map((message: Message) => (
            <div key={message.id} className="border-l-2 border-gray-200 pl-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900">{message.authorName}</span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </span>
                    {message.isReply && (
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">返信</span>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                  {message.mentions.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      @メンション: {message.mentions.length}人
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}