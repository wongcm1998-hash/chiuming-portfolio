import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const siteUrl = new URL('https://move-to-turn-time.wongchiu1016.chatgpt.site');
const socialImageUrl = new URL('/og.png', siteUrl).toString();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: 'Move to Turn Time — Interactive Portrait',
  description: '横向移动或拖动，以位置控制人物转头视频的时间。',
  openGraph: {
    title: 'Move to Turn Time — Interactive Portrait',
    description: '横向位置，决定画面。',
    url: siteUrl,
    images: [
      {
        url: socialImageUrl,
        width: 1200,
        height: 630,
        alt: 'Move to Turn Time — 横向位置，决定画面',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Move to Turn Time — Interactive Portrait',
    description: '横向位置，决定画面。',
    images: [socialImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
