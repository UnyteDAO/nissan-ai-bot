'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useState } from 'react';
import { FaChartBar, FaCog, FaTerminal } from 'react-icons/fa';

const features = [
  {
    id: 'dashboard',
    icon: FaChartBar,
    title: 'リアルタイムダッシュボード',
    description: '美しいビジュアルで貢献度を可視化',
    details: [
      '一目で分かる貢献度ランキング',
      '個人の詳細な評価履歴',
      '美しいチャートで可視化',
      'Next.js 15 + Tailwind CSS v4で構築'
    ],
    image: '/dashboard-preview.png'
  },
  {
    id: 'automation',
    icon: FaCog,
    title: '自動評価システム',
    description: '完全自動で評価を実行',
    details: [
      'Google Gemini AI搭載',
      '毎日定時に自動実行',
      '時間減衰式で公平性確保',
      '最大50スレッド/日を処理'
    ],
    image: '/automation-flow.png'
  },
  {
    id: 'commands',
    icon: FaTerminal,
    title: '柔軟なDiscordコマンド',
    description: '豊富なコマンドで運営をサポート',
    details: [
      '/evaluate - 過去の会話を評価',
      '/check-evaluation - 評価結果確認',
      '/leaderboard - ランキング表示',
      '/export-nft - NFTデータ出力',
      '/trigger-evaluation - 手動実行',
      '/channels - チャンネル管理',
      '/api-logs - API使用統計'
    ],
    image: '/commands-demo.png'
  }
];

export default function FeaturesSection() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });
  const [activeFeature, setActiveFeature] = useState('dashboard');

  return (
    <section className="section-padding bg-darker" ref={ref}>
      <div className="max-width">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            パワフルな機能で、<span className="gradient-text">運営を効率化</span>
          </h2>
          <p className="text-xl text-gray-400">
            Discord運営に必要な全ての機能を搭載
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* 機能タブ */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`p-6 rounded-xl cursor-pointer transition-all duration-300 ${
                  activeFeature === feature.id
                    ? 'bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/40'
                    : 'bg-gray-900/50 border border-gray-800 hover:border-gray-700'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    activeFeature === feature.id
                      ? 'bg-gradient-to-r from-primary to-secondary'
                      : 'bg-gray-800'
                  }`}>
                    <feature.icon className="text-2xl text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                    <p className="text-gray-400 mb-3">{feature.description}</p>
                    
                    {activeFeature === feature.id && (
                      <motion.ul
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={{ duration: 0.3 }}
                        className="space-y-2"
                      >
                        {feature.details.map((detail, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-accent mt-1">✓</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* プレビュー画像 */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="relative"
          >
            <div className="aspect-video rounded-2xl overflow-hidden glass-effect p-8">
              {/* ダッシュボードのモックアップ */}
              {activeFeature === 'dashboard' && (
                <div className="h-full bg-gray-900/80 rounded-lg p-6">
                  <div className="mb-4">
                    <div className="h-8 w-48 bg-gradient-to-r from-primary to-secondary rounded animate-pulse" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="h-24 bg-gray-800 rounded-lg animate-pulse" />
                    <div className="h-24 bg-gray-800 rounded-lg animate-pulse animation-delay-200" />
                    <div className="h-24 bg-gray-800 rounded-lg animate-pulse animation-delay-400" />
                  </div>
                  <div className="h-48 bg-gray-800 rounded-lg animate-pulse animation-delay-600" />
                </div>
              )}

              {/* 自動化フローのモックアップ */}
              {activeFeature === 'automation' && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-4 mb-8">
                      <div className="w-16 h-16 bg-blue-500 rounded-full animate-pulse" />
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <div className="w-16 h-16 bg-primary rounded-full animate-pulse animation-delay-200" />
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <div className="w-16 h-16 bg-accent rounded-full animate-pulse animation-delay-400" />
                    </div>
                    <p className="text-gray-400">Discord → AI分析 → スコア算出</p>
                  </div>
                </div>
              )}

              {/* コマンドデモのモックアップ */}
              {activeFeature === 'commands' && (
                <div className="h-full bg-gray-900/80 rounded-lg p-4 font-mono text-sm">
                  <div className="space-y-2">
                    <p className="text-blue-400">&gt; /evaluate</p>
                    <p className="text-green-400 ml-4">✓ 過去7日間の会話を評価中...</p>
                    <p className="text-blue-400 mt-4">&gt; /leaderboard</p>
                    <p className="text-gray-300 ml-4">🏆 トップ貢献者:</p>
                    <p className="text-gray-300 ml-8">1. User123 - 850点</p>
                    <p className="text-gray-300 ml-8">2. User456 - 780点</p>
                    <p className="text-gray-300 ml-8">3. User789 - 720点</p>
                    <div className="mt-4 h-2 bg-primary/50 rounded animate-pulse" />
                  </div>
                </div>
              )}
            </div>

            {/* 装飾 */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-secondary/20 rounded-full blur-2xl" />
          </motion.div>
        </div>

        {/* 追加機能リスト */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-16 grid md:grid-cols-4 gap-6"
        >
          {[
            { title: 'Firebase連携', desc: 'スケーラブルなデータ管理' },
            { title: 'コスト追跡', desc: 'API使用量を可視化' },
            { title: '除外設定', desc: 'チャンネル単位で制御' },
            { title: 'エクスポート機能', desc: 'NFTデータ出力対応' }
          ].map((item, idx) => (
            <div key={idx} className="p-6 rounded-xl bg-gray-900/50 border border-gray-800">
              <h4 className="font-bold mb-2">{item.title}</h4>
              <p className="text-sm text-gray-400">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}