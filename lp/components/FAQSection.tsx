'use client';

import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { useModal } from '@/contexts/ModalContext';

const faqs = [
  {
    question: '導入は難しくないですか？',
    answer: '専門知識は不要です。初期設定は弊社が完全サポート。Discord BotトークンとFirebaseの設定だけで、最短1日で運用開始可能です。設定マニュアルも完備しています。'
  },
  {
    question: 'どんな規模のコミュニティでも使えますか？',
    answer: '10名〜10,000名まで対応可能です。1日最大50スレッド、スレッドあたり最大120メッセージまで処理でき、規模に応じた最適な設定をご提案します。'
  },
  {
    question: 'プライバシーは大丈夫ですか？',
    answer: '全データは暗号化され、Firebase Firestoreで安全に保管されます。GDPR準拠で、データの取り扱いも安心です。評価に使用したメッセージは処理後に削除され、個人情報は最小限に抑えています。'
  },
  {
    question: '他のツールとの連携は？',
    answer: '現在はDiscordに特化していますが、将来的にNotion、Slack、GitHub等との連携も予定しています。APIを公開予定で、カスタム連携も可能になります。'
  },
  {
    question: 'AIの評価精度はどの程度ですか？',
    answer: 'Google Gemini AIを使用し、5つの評価軸で多角的に分析します。時間減衰アルゴリズムにより、常に最新の活動を重視した公平な評価を実現。人間の評価と90%以上の一致率を達成しています。'
  },
  {
    question: '料金に含まれるものは？',
    answer: 'ボットの利用料、ダッシュボードアクセス、自動アップデート、基本サポートが含まれます。API利用料は月額料金に含まれており、追加料金は発生しません。'
  },
  {
    question: '評価の重複は防げますか？',
    answer: 'はい、各スレッドにユニークIDを付与し、一度評価したスレッドは再評価されません。これにより、同じ貢献が二重にカウントされることを防ぎます。'
  }
];

export default function FAQSection() {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { openContactForm } = useModal();

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="section-padding" ref={ref}>
      <div className="max-width">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            よくある<span className="gradient-text">質問</span>
          </h2>
          <p className="text-xl text-gray-400">
            導入前の疑問にお答えします
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full p-6 glass-effect border border-gray-800 hover:border-primary/30 hover:gradient-shadow transition-all duration-300 text-left"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold pr-4">{faq.question}</h3>
                  <motion.div
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0"
                  >
                    <FaChevronDown className="gradient-text" />
                  </motion.div>
                </div>
              </button>
              
              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0
                }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-6 glass-effect border-x border-b border-gray-800">
                  <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* 追加の質問CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-400 mb-4">
            その他のご質問がございましたら、お気軽にお問い合わせください
          </p>
          <button 
            onClick={openContactForm}
            className="px-8 py-3 glass-effect gradient-border hover:gradient-shadow text-white rounded-lg transition-all duration-300"
          >
            お問い合わせはこちら
          </button>
        </motion.div>
      </div>
    </section>
  );
}