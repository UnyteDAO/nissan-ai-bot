'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FaRobot, FaChartPie, FaEye, FaTrophy } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';

const solutions = [
  {
    icon: FaRobot,
    title: '完全自動評価',
    description: '24時間365日、見逃さない',
    details: 'Discordの全メッセージを自動収集・分析。人の手を介さない客観的評価。'
  },
  {
    icon: FaChartPie,
    title: '多角的スコアリング',
    description: '5つの指標で総合評価',
    details: '技術的アドバイス(25点)、問題解決(25点)、実現可能性(20点)、コミュニケーション(20点)、成果物(10点)'
  },
  {
    icon: FaEye,
    title: '透明性の確保',
    description: '全ての評価プロセスを可視化',
    details: '評価基準の完全公開。スコアの詳細な内訳表示。時間減衰アルゴリズム(λ=0.0001/日)採用。'
  }
];

export default function SolutionSection() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <section className="section-padding relative overflow-hidden" ref={ref}>
      {/* 背景装飾 */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="max-width relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/40 mb-6">
            <FaTrophy className="text-yellow-400" />
            <span className="text-sm font-medium">業界初！Google Gemini AI搭載</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            AIが、<span className="gradient-text">全てを変えます。</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            最先端のAI技術で、Discord運営の課題を根本から解決
          </p>
        </motion.div>

        {/* ソリューションカード */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {solutions.map((solution, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group"
            >
              <div className="h-full p-8 rounded-2xl glass-effect hover:bg-white/20 transition-all duration-300 flex flex-col">
                {/* アイコン */}
                <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-primary to-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <solution.icon className="text-3xl text-white" />
                </div>

                <h3 className="text-2xl font-bold mb-2">{solution.title}</h3>
                <p className="text-primary font-medium mb-4">{solution.description}</p>
                <p className="text-gray-300 flex-grow">{solution.details}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 特徴的な機能 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid md:grid-cols-2 gap-8"
        >
          {/* スコアリングシステム */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <HiLightningBolt className="text-yellow-400" />
              高度なスコアリングシステム
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-dark/50 rounded-lg">
                <span>技術的アドバイス</span>
                <span className="font-bold text-primary">0-25点</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-dark/50 rounded-lg">
                <span>問題解決</span>
                <span className="font-bold text-primary">0-25点</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-dark/50 rounded-lg">
                <span>実現可能性</span>
                <span className="font-bold text-primary">0-20点</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-dark/50 rounded-lg">
                <span>コミュニケーション</span>
                <span className="font-bold text-primary">0-20点</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-dark/50 rounded-lg">
                <span>成果物</span>
                <span className="font-bold text-primary">0-10点</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-500/20 rounded-lg">
                <span>ペナルティ</span>
                <span className="font-bold text-red-400">-5～-20点</span>
              </div>
            </div>
          </div>

          {/* 時間減衰アルゴリズム */}
          <div className="p-8 rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 border border-secondary/30">
            <h3 className="text-2xl font-bold mb-6">時間減衰アルゴリズム</h3>
            <p className="text-gray-300 mb-4">
              古い貢献の価値を適切に減少させ、常に最新の活動を重視する公平な評価システム
            </p>
            <div className="p-4 bg-dark/50 rounded-lg font-mono text-sm">
              <p className="text-accent mb-2">{'//'} 時間減衰式</p>
              <p>value = originalScore × e^(-λ × days)</p>
              <p className="text-gray-400 mt-2">λ = 0.0001 (減衰係数)</p>
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-300">
              <p>✓ 30日後: 97%の価値を保持</p>
              <p>✓ 90日後: 91%の価値を保持</p>
              <p>✓ 180日後: 82%の価値を保持</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}