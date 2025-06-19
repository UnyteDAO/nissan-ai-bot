import type { Metadata } from 'next'
import './globals.css'
import { ModalProvider } from '@/contexts/ModalContext'
import ClientModal from '@/components/ClientModal'

export const metadata: Metadata = {
  title: 'DAO貢献度測定ボット - AIが公平に評価する次世代Discord運営ツール',
  description: 'Discord上でのDAO参加者の貢献度を自動的に測定・評価。Google Gemini AIによる客観的な評価で、透明性のあるインセンティブ配分を実現します。',
  keywords: 'DAO, Discord, AI評価, 貢献度測定, Web3, コミュニティ運営, 自動評価',
  openGraph: {
    title: 'DAO貢献度測定ボット',
    description: 'AIが公平に評価する次世代Discord運営ツール',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DAO貢献度測定ボット',
    description: 'AIが公平に評価する次世代Discord運営ツール',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased" style={{ backgroundColor: '#0F172A', color: '#f3f4f6' }}>
        <ModalProvider>
          {children}
          <ClientModal />
        </ModalProvider>
      </body>
    </html>
  )
}