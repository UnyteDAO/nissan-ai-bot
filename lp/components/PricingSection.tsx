'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useState, useEffect } from 'react';
import { FaCheck, FaClock, FaGift, FaStar } from 'react-icons/fa';

export default function PricingSection() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  // カウントダウンタイマー
  const [timeLeft, setTimeLeft] = useState({
    days: 7,
    hours: 12,
    minutes: 30,
    seconds: 0
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const benefits = [
    '初期設定サポート無料（通常5万円）',
    '3ヶ月間の優先サポート',
    'カスタマイズ機能の優先開発権',
    '永久アップデート保証',
    '30日間の返金保証'
  ];

  return (
    <section className="section-padding bg-darker" ref={ref}>
      <div className="max-width">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect gradient-border mb-6">
            <FaStar className="text-transparent bg-gradient-to-r from-primary to-secondary bg-clip-text" />
            <span className="text-sm font-medium">期間限定オファー</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            今だけの<span className="gradient-text">特別価格</span>
          </h2>
          <p className="text-xl text-gray-400">
            先着100社限定のプレオーダー特典
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* 通常プラン */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="p-8 rounded-2xl glass-effect border border-gray-700 opacity-60">
              <h3 className="text-2xl font-bold mb-2">通常価格</h3>
              <p className="text-gray-400 mb-6">リリース後の価格</p>
              <div className="mb-8">
                <p className="text-4xl font-bold line-through text-gray-500">
                  ¥50,000<span className="text-lg font-normal">/月</span>
                </p>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center gap-3">
                  <FaCheck className="text-gray-600" />
                  <span>基本機能すべて</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheck className="text-gray-600" />
                  <span>通常サポート</span>
                </li>
                <li className="flex items-center gap-3">
                  <FaCheck className="text-gray-600" />
                  <span>アップデート</span>
                </li>
              </ul>
            </div>
          </motion.div>

          {/* プレオーダープラン */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            {/* おすすめバッジ */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
              <span className="px-4 py-1 gradient-bg text-white text-sm font-bold rounded-full gradient-shadow">
                おすすめ
              </span>
            </div>

            <div className="p-8 rounded-2xl glass-effect gradient-border gradient-shadow-lg">
              <h3 className="text-2xl font-bold mb-2">プレオーダー価格</h3>
              <p className="gradient-text mb-6">今だけ40%OFF</p>
              <div className="mb-8">
                <p className="text-5xl font-bold gradient-text">
                  ¥29,800<span className="text-lg font-normal">/月</span>
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  ※最初の30日間は完全無料
                </p>
              </div>

              <div className="space-y-3 mb-8">
                {benefits.map((benefit, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.4 + idx * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center flex-shrink-0">
                      <FaCheck className="text-white text-xs" />
                    </div>
                    <span>{benefit}</span>
                  </motion.div>
                ))}
              </div>

              <button className="w-full px-8 py-4 gradient-bg text-white font-bold rounded-lg hover-glow transition-all duration-300 gradient-shadow hover:gradient-shadow-lg">
                今すぐ申し込む
              </button>
            </div>
          </motion.div>
        </div>

        {/* カウントダウンタイマー */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 p-6 rounded-2xl glass-effect gradient-border max-w-3xl mx-auto gradient-shadow"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <FaClock className="text-2xl gradient-text" />
            <h3 className="text-xl font-bold">プレオーダー終了まで</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(timeLeft).map(([unit, value]) => (
              <div key={unit} className="text-center">
                <div className="text-3xl font-bold gradient-text">
                  {value.toString().padStart(2, '0')}
                </div>
                <p className="text-sm text-gray-400">
                  {unit === 'days' ? '日' : unit === 'hours' ? '時間' : unit === 'minutes' ? '分' : '秒'}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 特典詳細 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 grid md:grid-cols-3 gap-6"
        >
          <div className="p-6 rounded-xl glass-effect border border-gray-800 hover:border-primary/30 hover:gradient-shadow transition-all duration-300">
            <FaGift className="text-3xl gradient-text mb-4" />
            <h4 className="font-bold mb-2">初期設定サポート</h4>
            <p className="text-sm text-gray-400">
              専門スタッフが設定を完全サポート。最短1日で運用開始。
            </p>
          </div>
          <div className="p-6 rounded-xl glass-effect border border-gray-800 hover:border-primary/30 hover:gradient-shadow transition-all duration-300">
            <FaStar className="text-3xl gradient-text mb-4" />
            <h4 className="font-bold mb-2">優先サポート</h4>
            <p className="text-sm text-gray-400">
              専用のサポートチャンネルで、迅速な対応を保証。
            </p>
          </div>
          <div className="p-6 rounded-xl glass-effect border border-gray-800 hover:border-primary/30 hover:gradient-shadow transition-all duration-300">
            <FaCheck className="text-3xl gradient-text mb-4" />
            <h4 className="font-bold mb-2">返金保証</h4>
            <p className="text-sm text-gray-400">
              30日間お試しいただき、満足いただけない場合は全額返金。
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}