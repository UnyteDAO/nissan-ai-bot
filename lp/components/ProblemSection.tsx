'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FaSadTear, FaClock, FaUserSlash } from 'react-icons/fa';

const problems = [
  {
    icon: FaSadTear,
    title: '評価の不透明性',
    subtitle: '「誰がどれだけ貢献しているか分からない...」',
    points: [
      'アクティブメンバーの把握が困難',
      '貢献内容の質が評価されない',
      '報酬分配の根拠が曖昧'
    ]
  },
  {
    icon: FaClock,
    title: '手動評価の限界',
    subtitle: '「毎日のメッセージを全部チェックなんて無理...」',
    points: [
      '大量のメッセージを見逃してしまう',
      '評価に膨大な時間がかかる',
      '人的バイアスが避けられない'
    ]
  },
  {
    icon: FaUserSlash,
    title: 'メンバーのモチベーション低下',
    subtitle: '「頑張っても評価されない...」',
    points: [
      '貢献が正当に評価されない不満',
      '活発なメンバーが離脱',
      'コミュニティの活力低下'
    ]
  }
];

export default function ProblemSection() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  };

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
            こんな悩み、<span className="gradient-text">ありませんか？</span>
          </h2>
          <p className="text-xl text-gray-400">
            Discord運営者の90%が抱える3大課題
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid md:grid-cols-3 gap-8"
        >
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="relative group"
            >
              <div className="h-full p-8 rounded-2xl glass-effect gradient-border hover:gradient-shadow transition-all duration-300 flex flex-col">
                {/* アイコン */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <problem.icon className="text-3xl gradient-text" />
                </div>

                {/* タイトル */}
                <h3 className="text-2xl font-bold mb-3">{problem.title}</h3>
                
                {/* サブタイトル */}
                <p className="text-gray-400 mb-6 italic">
                  {problem.subtitle}
                </p>

                {/* ポイント */}
                <ul className="space-y-3 flex-grow">
                  {problem.points.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-secondary mt-1 flex-shrink-0">✗</span>
                      <span className="text-gray-300">{point}</span>
                    </li>
                  ))}
                </ul>

                {/* 背景装飾 */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-3xl -z-10" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* 統計情報 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 p-8 rounded-2xl glass-effect gradient-border gradient-shadow"
        >
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold gradient-text mb-2">87%</p>
              <p className="text-gray-300">の運営者が評価に課題</p>
            </div>
            <div>
              <p className="text-4xl font-bold gradient-text mb-2">週10時間</p>
              <p className="text-gray-300">平均的な評価作業時間</p>
            </div>
            <div>
              <p className="text-4xl font-bold gradient-text mb-2">45%</p>
              <p className="text-gray-300">が不公平を理由に離脱</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}