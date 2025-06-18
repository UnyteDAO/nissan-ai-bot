'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FaClock, FaSmile, FaChartLine, FaArrowRight } from 'react-icons/fa';

const beforeAfter = [
  {
    category: '評価時間',
    before: '週10時間以上',
    after: '完全自動化（0時間）',
    improvement: '100%削減',
    icon: FaClock
  },
  {
    category: 'メンバー満足度',
    before: '不満が絶えない',
    after: '公平な評価で満足度UP',
    improvement: '2.5倍向上',
    icon: FaSmile
  },
  {
    category: 'アクティブ率',
    before: '20%',
    after: '45%',
    improvement: '125%向上',
    icon: FaChartLine
  }
];

const metrics = [
  { value: '90%', label: '運営時間削減' },
  { value: '2.5倍', label: 'メンバー満足度' },
  { value: '100%', label: '貢献可視化率' },
  { value: '0', label: '見逃し評価' }
];

export default function BenefitsSection() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <section className="section-padding relative overflow-hidden" ref={ref}>
      {/* 背景装飾 */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="max-width relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            導入後、<span className="gradient-text">こんな変化が。</span>
          </h2>
          <p className="text-xl text-gray-400">
            実際のコミュニティで実証された効果
          </p>
        </motion.div>

        {/* Before/After比較 */}
        <div className="space-y-8 mb-16">
          {beforeAfter.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative"
            >
              <div className="grid md:grid-cols-3 gap-6 items-center">
                {/* Before */}
                <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <item.icon className="text-2xl text-red-400" />
                    <h3 className="text-lg font-bold">{item.category}</h3>
                  </div>
                  <p className="text-gray-300">Before 😰</p>
                  <p className="text-2xl font-bold text-red-400">{item.before}</p>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <motion.div
                    animate={{ x: [0, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <FaArrowRight className="text-4xl text-primary" />
                  </motion.div>
                </div>

                {/* After */}
                <div className="p-6 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="flex items-center gap-3 mb-3">
                    <item.icon className="text-2xl text-accent" />
                    <h3 className="text-lg font-bold">{item.category}</h3>
                  </div>
                  <p className="text-gray-300">After 🎉</p>
                  <p className="text-2xl font-bold text-accent">{item.after}</p>
                  <p className="text-sm text-primary mt-2">{item.improvement}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 数値で見る効果 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="p-8 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/30"
        >
          <h3 className="text-2xl font-bold text-center mb-8">数値で見る効果</h3>
          <div className="grid md:grid-cols-4 gap-8">
            {metrics.map((metric, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ duration: 0.5, delay: 0.6 + idx * 0.1 }}
                className="text-center"
              >
                <p className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {metric.value}
                </p>
                <p className="text-gray-300">{metric.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ケーススタディ */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 grid md:grid-cols-2 gap-8"
        >
          <div className="p-8 rounded-2xl bg-gray-900/50 border border-gray-800">
            <h3 className="text-xl font-bold mb-4">導入事例: Web3スタートアップA社</h3>
            <div className="space-y-3 text-gray-300">
              <p>👥 メンバー数: 150名</p>
              <p>📅 導入期間: 3ヶ月</p>
              <p>📈 成果:</p>
              <ul className="ml-4 space-y-2">
                <li>・評価作業時間を週15時間→0時間に</li>
                <li>・アクティブメンバーが2.3倍に増加</li>
                <li>・報酬分配の透明性が向上</li>
              </ul>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-gray-900/50 border border-gray-800">
            <h3 className="text-xl font-bold mb-4">導入事例: DeFiプロジェクトB社</h3>
            <div className="space-y-3 text-gray-300">
              <p>👥 メンバー数: 500名</p>
              <p>📅 導入期間: 6ヶ月</p>
              <p>📈 成果:</p>
              <ul className="ml-4 space-y-2">
                <li>・月間1,200件の貢献を自動評価</li>
                <li>・メンバー満足度が85%向上</li>
                <li>・優秀な人材の定着率が向上</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}