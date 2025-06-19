'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { FaLock, FaCreditCard, FaEnvelope, FaArrowRight } from 'react-icons/fa';
import { useModal } from '@/contexts/ModalContext';

export default function CTASection() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });
  const { openContactForm } = useModal();

  return (
    <section className="section-padding bg-gradient-to-b from-dark via-dark to-dark relative overflow-hidden" ref={ref}>
      {/* 背景装飾 */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gradient-to-br from-primary/30 to-secondary/30 rounded-full blur-3xl" />
      </div>

      <div className="max-width relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6">
            今すぐ、コミュニティ運営を
            <span className="block gradient-text mt-2">変革しませんか？</span>
          </h2>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
            メンバーが輝く、公平で透明なコミュニティへ。
          </p>

          {/* CTAボタン */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openContactForm}
              className="px-8 py-4 gradient-bg text-white font-bold rounded-lg hover-glow transition-all duration-300 flex items-center justify-center gap-3 group gradient-shadow hover:gradient-shadow-lg"
            >
              無料で始める（30日間）
              <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 glass-effect text-white font-bold rounded-lg hover:gradient-shadow transition-all duration-300 gradient-border"
            >
              資料をダウンロード
            </motion.button>
          </div>

          {/* 信頼性バッジ */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <FaLock className="gradient-text" />
              <span>SSL暗号化通信</span>
            </div>
            <div className="flex items-center gap-2">
              <FaCreditCard className="gradient-text" />
              <span>クレジットカード不要</span>
            </div>
            <div className="flex items-center gap-2">
              <FaEnvelope className="gradient-text" />
              <span>1分で登録完了</span>
            </div>
          </div>

          {/* 追伸 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 p-6 rounded-xl glass-effect gradient-border max-w-2xl mx-auto gradient-shadow"
          >
            <p className="gradient-text font-bold mb-2">P.S.</p>
            <p className="text-gray-300">
              プレオーダー特典は<span className="gradient-text font-bold">先着100社限定</span>です。
              <br />
              この機会をお見逃しなく。
            </p>
          </motion.div>

          {/* 実績数値 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 grid md:grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            {[
              { value: '1,270+', label: '評価済みスレッド' },
              { value: '180+', label: 'アクティブユーザー' },
              { value: '99.9%', label: '稼働率' },
              { value: '24/7', label: '自動評価' }
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <p className="text-3xl font-bold gradient-text mb-2">{stat.value}</p>
                <p className="text-sm text-gray-400">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}