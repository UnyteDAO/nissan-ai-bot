'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaUsers, FaCheckCircle } from 'react-icons/fa';
import { useModal } from '@/contexts/ModalContext';

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactFormModal({ isOpen, onClose }: ContactFormModalProps) {
  const { formData, setFormData, resetFormData } = useModal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 送信完了状態のリセット
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitted(false);
    }
  }, [isOpen]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // モック送信処理
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Form submitted:', formData);
    setIsSubmitting(false);
    setIsSubmitted(true);
    
    // フォームデータをクリア
    resetFormData();
    
    // 3秒後に自動的にモーダルを閉じる
    setTimeout(() => {
      onClose();
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const newFormData = {
      ...formData,
      [e.target.name]: e.target.value
    };
    setFormData(newFormData);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 z-50"
            onClick={onClose}
          />

          {/* モーダル */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={onClose}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] bg-darker border border-primary/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 装飾的な背景 */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-secondary/10 blur-3xl -z-10" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-secondary/10 to-primary/10 blur-3xl -z-10" />
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-4 relative z-10">
                <h2 className="text-2xl font-bold gradient-text">お申し込みフォーム</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <FaTimes className="text-xl text-gray-400" />
                </button>
              </div>

              {!isSubmitted ? (
                <>
                  <p className="text-gray-300 mb-6 text-sm">
                    下記フォームに必要事項をご記入ください。担当者より1営業日以内にご連絡いたします。
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 所属 */}
                    <div>
                      <label htmlFor="organization" className="block text-sm font-medium mb-1">
                        所属（会社名・コミュニティ名）<span className="text-secondary">*</span>
                      </label>
                      <input
                        type="text"
                        id="organization"
                        name="organization"
                        value={formData.organization}
                        onChange={handleChange}
                        required
                        placeholder="例：株式会社〇〇 / 〇〇DAO"
                        className="w-full px-4 py-2.5 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors duration-200"
                      />
                    </div>

                    {/* 氏名 */}
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium mb-1">
                        氏名<span className="text-secondary">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="例：山田 太郎"
                        className="w-full px-4 py-2.5 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors duration-200"
                      />
                    </div>

                    {/* メールアドレス */}
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-1">
                        メールアドレス<span className="text-secondary">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="例：example@company.com"
                        className="w-full px-4 py-2.5 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors duration-200"
                      />
                    </div>

                    {/* コミュニティ規模 */}
                    <div>
                      <label htmlFor="communitySize" className="block text-sm font-medium mb-1">
                        利用を想定されているコミュニティの規模<span className="text-secondary">*</span>
                      </label>
                      <select
                        id="communitySize"
                        name="communitySize"
                        value={formData.communitySize}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors duration-200 [&>option]:bg-darker [&>option]:text-white"
                      >
                        <option value="">選択してください</option>
                        <option value="10-50">10〜50名</option>
                        <option value="51-100">51〜100名</option>
                        <option value="101-500">101〜500名</option>
                        <option value="501-1000">501〜1,000名</option>
                        <option value="1001-5000">1,001〜5,000名</option>
                        <option value="5001+">5,001名以上</option>
                      </select>
                    </div>

                    {/* 自由記述 */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium mb-1">
                        ご要望・ご質問（任意）
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={3}
                        placeholder="導入にあたってのご要望やご質問がございましたらご記入ください"
                        className="w-full px-4 py-2.5 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors duration-200 resize-none"
                      />
                    </div>

                    {/* 送信ボタン */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full px-8 py-4 gradient-bg text-white font-bold rounded-lg hover-glow transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed gradient-shadow hover:gradient-shadow-lg"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          送信中...
                        </span>
                      ) : (
                        '送信する'
                      )}
                    </button>

                    <p className="text-xs text-gray-400 text-center">
                      ※ご入力いただいた情報は、本サービスの提供・改善のみに使用いたします。
                    </p>
                  </form>
                </>
              ) : (
                /* 送信完了画面 */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-center py-12"
                >
                  <div className="w-20 h-20 gradient-bg rounded-full flex items-center justify-center mx-auto mb-6 gradient-shadow">
                    <FaCheckCircle className="text-4xl text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">送信完了しました！</h3>
                  <p className="text-gray-300 mb-2">
                    お申し込みありがとうございます。
                  </p>
                  <p className="text-gray-300">
                    1営業日以内に担当者よりご連絡いたします。
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}