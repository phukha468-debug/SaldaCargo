import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ScrollOnFocus } from '@/components/scroll-on-focus';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SaldaCargo',
  description: 'Грузоперевозки Верхняя Салда',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="font-sans antialiased bg-zinc-50">
        <Providers>
          <ScrollOnFocus />
          {children}
        </Providers>
      </body>
    </html>
  );
}
