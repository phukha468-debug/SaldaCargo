import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ScrollOnFocus } from '@/components/scroll-on-focus';
import { MinimizeOnBack } from '@/components/minimize-on-back';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ancargo66',
  description: 'Грузоперевозки Верхняя Салда',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ancargo66',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans antialiased bg-zinc-50">
        <Providers>
          <MinimizeOnBack />
          <ScrollOnFocus />
          {children}
        </Providers>
      </body>
    </html>
  );
}
